from django.views.decorators.cache import cache_control
from django.http import HttpResponse
from django.conf import settings

from datetime import datetime

import subprocess
import operator
import shutil
import math
import time
import os
import re

from cwf.views import View, JSView

########################
###
###   UTILITY
###
########################

def runBash(cmd):
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE)
    out = process.stdout.read().strip()
    return out

def locationAlias(name, folder, tests=False):
    if name.startswith(folder):
        name = name[len(folder):]
    
    if name.startswith('/'):
        name = name[1:]
    
    name = name[:name.find('.')]
    
    if tests:
        parts = name.split('/')
        fileName = parts[-1]
        if len(parts) > 1 and parts[-2] == 'spec':
            pathTo = parts[:-2]
            if pathTo:
                name = "%s%s%s" % ('/'.join(pathTo), os.sep, fileName)
            else:
                name = fileName
    
    if name.endswith("_spec"):
        name = name[:-5]
    
    return name
    
def findJs(folder, tests=False, uriOnly=False, exclude=None):
    if exclude:
        if type(exclude) in (str, unicode):
            exclude = [exclude]
    else:
        exclude = []
        
    base = settings.GMA

    class Path(object):
        def __init__(self, alias, tests):
            
            self.base = base
            if tests:
                path = 'test'
            else:
                path = 'view'
                
            if not uriOnly:
                self.path = '/'.join([path, alias])
                self.compile = '/'.join(['compile', alias])
                self.compiled = '/'.join(['compiled', alias])
                self.coverageLocation = '/coverage/%s' % alias
                self.coverage = '/jscoverage?url=%s' % self.coverageLocation
            else:
                self.path = alias
                
            self.alias = locationAlias(alias, folder, tests)
            self.last = self.alias.split(os.sep)[-1]
            self.parts = self.path.split('/')
            self.title = self.path
        
        def __cmp__(self, other):
            if type(other) is not Path:
                return -1
            else:
                if other.alias < self.alias:
                    return 1
                else:
                    return -1
    
    lookIn = os.sep.join([base, folder])
    exclude = [os.path.normpath(os.sep.join([base, f])) for f in exclude]
    exclude = map(lambda item : {True : item[:-1], False : item}[item.endswith('/')], exclude)
    for path, dirs, files in os.walk(lookIn):
        for e in exclude:
            lookFor = e[len(path):]
            if lookFor.startswith('/'):
                lookFor = lookFor[1:]
            if lookFor in dirs:
                del dirs[dirs.index(lookFor)]
        
        hidden = []
        for d in dirs:
            if d.startswith('_'):
                hidden.append(dirs.index(d))
        
        for n in hidden:
            del dirs[n]
                
        def filter():
            for f in files:
                if tests:
                    if f.endswith('_spec_pp.js') or f.endswith('_spec.js'):
                        yield f
                else:
                    if f.endswith(".js") and not f.endswith("_spec.js"):
                        yield f
        
        for f in filter():
            yield Path('/'.join([path.replace(os.sep, '/'), f])[len(base)+1:], tests)

########################
###
###   PAGES
###
########################

regexes = {
    'multiSlash' : re.compile(r'/+'),
}

class views(View):
    
    ########################
    ###   UTILITY
    ########################
    
    def clean(self, url, sep=os.sep, root=True):
        ret = regexes['multiSlash'].sub('/', url.replace('\\', '/').lstrip().rstrip()).replace('/', os.sep)
        if sep != os.sep:
            ret = ret.replace(os.sep, sep)
            
        if ret.endswith(sep):
            ret = ret[:-1]
        
        if root and not ret.startswith(sep):
            return "%s%s" % (sep, ret)
        
        if not root and ret.startswith(sep):
            return ret[1:]
        
        return ret
    
    def jscoverage(self, request):
        File = 'jscoverage.html'
        tests = [j for j in findJs("gma", tests=True)]
        selectedTest = 0
        if 'url' in request.GET:
            url = request.GET['url']
            if url == '/coverage/all':
                selectedTest = 1
            else:
                for index, test in enumerate(tests):
                    if url == test.coverageLocation:
                        selectedTest = index + 2
                        break
        extra = {
            'title' : "Coverage",
            'tests' : tests,
            'selectedTest' : selectedTest,
            'isCoverage' : True
        }
        return File, extra
        
    ########################
    ###   INDEX
    ########################
    
    def store(self, obj, result, parts):
        if len(parts) == 1:
            result.append(obj)
        else:
            next = parts.pop(0)
            parent = None
            for n in result:
                if hasattr(n, 'keys') and next in n.keys():
                    parent = n
                    break
            
            if not parent:
                parent = {next : []}
                result.append(parent)
            self.store(obj, parent[next], parts)
            
    def tree(self, js):
        assoc = dict((p.alias, p) for p in js)
        aliases = sorted(assoc.keys())
        result = {'top' : []}
        for alias in aliases:
            parts = alias.split(os.sep)
            self.store(assoc[alias], result['top'], parts)
        
        return result['top']
        
    def index(self, request):
        File = 'index.html'
        extra = self.getCommon(request, {}, {
            'examples'   : self.tree(findJs("examples", exclude="examples/tutorial")),
            'tutorials'  : self.tree([j for j in findJs("examples/tutorial")]),
            'tests'      : self.tree([j for j in findJs("gma", tests=True)]),
            'title'      : 'Index',
        })
        return File, extra
        
    ########################
    ###   USEFUL
    ########################
    
    def rev(self, request):
        rev = runBash('cd %s && hg id' % settings.PROJECTDIR)
        return 'rev.html', {'rev' : rev}
        
    ########################
    ###   JAVASCRIPT
    ########################
    
    def getLocation(self, folder, rest):
        location = {
            'spikes'   : settings.SPIKEDIR,
            'examples' : settings.EXAMPLEDIR,
        }.get(folder, None)
        
        if location:
            return '/'.join([location, rest])
    
    def getCommon(self, request, extra, other):
        useStatic = 'useStatic' in request.GET
        useStatic = useStatic or 'usestatic' in request.GET
        extra['useStatic'] = useStatic
        extra.update(other)
        return extra
    
    def singlePath(self, path, title, fileName, File):
        css = []
        path = self.clean(path, '/', root=False)
        parts = path.split('/')
        if parts[0] in ('built', 'build'):
            parts.pop(0)
            
        folder = self.getLocation(parts[0], '/'.join(parts[1:-1]))
        if folder:
            css = ['/'.join(['', '/'.join(parts[:-1]), f]) for f in os.listdir(folder) if f.endswith('.css')]
        
        if parts[0] in ('examples', 'spikes'):
            if len(parts) > 2:
                File = '%s:%s:%s.html' % (parts[0], '/'.join(parts[1:-1]), fileName)
            else:
                File = '%s:%s.html' % (parts[0], fileName)

        paths = ['/%s' % path]
        if not title:
            title = paths[0]
            if title.startswith('/'):
                title = title[1:]

            if title.startswith("gma/"):
                title = title[4:]

            title = locationAlias(title, parts[0], fileName=='test')
        return File, paths, css, title
        
    def view(self, request, path, fileName='view', title=None, **kwargs):
        File = '%s.html' % fileName
        css = []
        if type(path) in (str, unicode):
            File, paths, css, title = self.singlePath(path, title, fileName, File)
        else:
            def iterator(paths):
                for p in paths:
                    if type(p) in (str, unicode):
                        yield self.clean(p, '/')
                    else:
                        yield self.clean(p.path, '/')
                        
            paths = [p for p in iterator(path)]
        
        extra = self.getCommon(request, kwargs, {
            'paths' : paths, 'title' : title, 'css' : css
        })
        
        if kwargs.get("testing", False) and len(paths) == 1:
            extra['coverage'] = '/coverage/%s' % path
            
        if kwargs.get("testingAll", False):
            extra['coverage'] = '/coverage/all'
            
        return File, extra
    
    def compile(self, request, path, fileName='view', title=None, **kwargs):
        File = '%s.html' % fileName
        css = []
        if type(path) in (str, unicode):
            path = 'build/%s' % path
            File, paths, css, title = self.singlePath(path, title, fileName, File)
        else:
            raise Exception, "Can only compile one file at a time....."
        
        extra = self.getCommon(request, kwargs, {
            'paths' : paths, 'title' : title, 'css' : css, 'compiled' : True
        })
        return File, extra
    
    def compiled(self, request, path, fileName='view', title=None, **kwargs):
        File = '%s.html' % fileName
        css = []
        if type(path) in (str, unicode):
            path = 'built/%s' % path
            File, paths, css, title = self.singlePath(path, title, fileName, File)
        else:
            raise Exception, "Can only compile one file at a time....."
        
        extra = self.getCommon(request, kwargs, {
            'paths' : paths, 'title' : title, 'css' : css, 'compiled' : True
        })
        return File, extra
        
    def allTests(self, request, server=False, **kwargs):
        paths = [j for j in findJs("gma", tests=True, uriOnly=True)]
        if server:
            page = 'testServer'
        else:
            page = 'test'
        return self.view(request, paths, page, title="All the tests", testing=True, testingAll=True, **kwargs)
    
    def test(self, request, path, **kwargs):
        return self.view(request, path, 'test', testing=True, **kwargs)

