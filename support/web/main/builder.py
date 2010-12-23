from django.conf import settings
import subprocess
import os

def runBash(cmd):
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE)
    out = process.stdout.read().strip()
    return out

class Build(object):
    def process_view(self, request, *args, **kwargs):
        if request.path.startswith('/build') or request.path.startswith('/built'):
            parts = request.path.split('/')
            path = '/%s' % '/'.join(parts[2:])
            name = path[1:][:path.find('.js')-1]
            out = '/%s/%s' % (settings.BUILTDIR, path)
            
            doContinue = True
            if request.path.startswith('/built') and os.path.exists(out):
                doContinue = False
            
            if doContinue:
                outDir = '/'.join(out.split('/')[:-1])
                if not os.path.exists(outDir):
                    os.makedirs(outDir)
                
                path = path.replace('/examples', settings.EXAMPLEDIR)
                builder = '%s/build/build.sh' % os.environ['REQUIRE']
            
                command = '%s name="%s" out="%s" baseUrl="%s" optimize="closure" includeRequire="true"' % (builder, name, out, settings.GMA)
                runBash(command)