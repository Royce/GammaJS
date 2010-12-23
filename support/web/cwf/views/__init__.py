from django.template import loader, RequestContext, Context, Template
from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse, Http404, HttpResponseRedirect
from django.shortcuts import render_to_response
from django.utils.safestring import mark_safe
from django.core import urlresolvers
from django.utils import simplejson
from django.conf import settings
from datetime import datetime


if hasattr(settings, 'SITE'):
    try:
        defaultSite = __import__(settings.SITE, globals(), locals(), ['site'], -1).site
    except ImportError:
        defaultSite = []
else:
    defaultSite = []


if hasattr(settings, 'PROJECTDIR'):
    projectDir = settings.PROJECTDIR
else:
    projectDir = '/var/www'

class Logger(object):
    def __init__(self):
        self.messages = []
    
    def addList(self, lst):
        self.messages.append("<ul>\n\t%s\n</ul>" % "\n\t<li>%s</li>".join(lst))
        
    def __add__(self, value):
        self.messages.append("<p>%s</p>" % value)
        
    def __unicode__(self):
        return '\n'.join(self.messages)
    
class View(object):
    def __init__(self, request):   
        if request:
            self.request = request
            try:
                self.base_url = request._meta['SCRIPT_NAME']
            except:
                self.base_url = request.META['SCRIPT_NAME']
        self.projectDir = projectDir
    
    ########################
    ###   CALL STUFF
    ########################    

    def getExtra(self, request, target, section, site, extra=None):
        if extra is None:
            extra = {}
            
        if not site:
            site = defaultSite
            
        extra['site'] = site
            
        extra['section'] = section
        
        path = [p for p in request.path.split('/')]
        
        if path[0] == '':
            path.pop(0)
            
        used = ''
        
        if self.base_url != "":
            path.pop(0)
        
        extra['navMenu'] = section.rootAncestor().getMenu(request, path, used)
        
        extra['baseUrl'] = self.base_url
        
        return extra
    
    def getResult(self, request, target, *args, **kwargs):            
        return getattr(self, target)(request, *args, **kwargs)
    
    def __call__(self, request, target, section, site=None, *args, **kwargs):
        self.request = request
        
        for key, item in kwargs.items():
            if type(item) is unicode:
                if item[-1] == '/':
                    kwargs[key] = item[:-1]
        
        if hasattr(self, 'override'):
            result = self.override(request, *args, **kwargs)
        else:
            if hasattr(self, target):
                result = self.getResult(request, target, *args, **kwargs)
                if callable(result):
                    return result(request, self.getExtra(request, target, section, site))
            else:
                raise Exception, "View object doesn't have a target : %s" % target
        
        if not result:
            self.raise404()
            
        try:
            File, extra = result
        except:
            return result
        
        self.getExtra(request, target, section, site, extra)        
        
        t = loader.get_template(File)
        c = RequestContext(request, extra)
        
        try:
            render = t.render(c)
        except Exception, error:
            import traceback
            raise Exception, (error, traceback.format_exc())
        
            
        return HttpResponse(render)
    
    ########################
    ###   RAISES/RETURNS
    ########################    

    def raise404(self):
        raise Http404
    
    def Http(self, *args, **kwargs):
        return HttpResponse(*args, **kwargs)

    def redirect(self, request, address, relative=True):
        address = unicode(address)
        
        if address[0] == '/':
            address = '%s%s' % (self.base_url, address)
        
        else:
            if relative:
                address = "%s/%s" % (request.path, address)
        
        return HttpResponseRedirect(address)

    def xml(self, address):
        return render_to_response(address, mimetype="application/xml")   
    
    def logToAdmin(self, request, File, url=None):
        extra = {
            'message' : mark_safe(unicode(self.log)),
            'needsConfirmation' : True,
        }
        
        if request.GET and request.GET.get("yes"):
            extra['needsConfirmation'] = False
        
        if url:
            extra['goBack'] = url
            
        return File, extra
    
    ########################
    ###   MONTH STUFF
    ########################    

    def getMonthLong(self, month):
        if not hasattr(self, 'monthLongs'):
            months = {}
            for i in xrange(1, 13):
                months[datetime(2009, i, 3).strftime("%b").lower()] = datetime(2009, i, 3).strftime("%B").lower()
            
            self.monthLongs = months
        
        return self.monthLongs[month.lower()]

    def getMonthNum(self, month):
        if not hasattr(self, 'monthNums'):
            months = {}
            for i in xrange(1, 13):
                months[datetime(2009, i, 3).strftime("%b").lower()] = i
            
            self.monthNums = months
        
        return self.monthNums[month.lower()]
        
    ########################
    ###   OTHER
    ########################    
    
    def getAdminChangeView(self, obj):
        #address = 'admin:%s_%s_change' % (obj._meta.app_label, obj._meta.module_name)
        #return urlresolvers.reverse(address , args=(obj.id,))
        return '/admin/%s/%s/%s' % (obj._meta.app_label, obj._meta.module_name, obj.id)
    
    def getAdminChangeList(self, obj):
        #address = 'admin:%s_%s_change' % (obj._meta.app_label, obj._meta.module_name)
        #return urlresolvers.reverse(address , args=(obj.id,))
        return '/admin/%s/%s' % (obj._meta.app_label, obj._meta.module_name)

    def startLog(self):
        self.log = Logger()
    
########################
### 
###   STAFF VIEW
### 
######################## 

class StaffView(View):
    def getResult(self, request, target, *args, **kwargs):  
        def view(request, *args, **kwargs):
            return getattr(self, target)(request, *args, **kwargs)
        
        return staff_member_required(view)(request, *args, **kwargs)

    
########################
### 
###   LOCAL ONLY
### 
######################## 

class LocalOnlyView(View):
    def getResult(self, request, target, *args, **kwargs):  
        ip = request.META.get('REMOTE_ADDR')
        if ip == '127.0.0.1':
            return getattr(self, target)(request, *args, **kwargs)
        else:
            self.raise404()
            
########################
### 
###   JAVASCRIPT
### 
######################## 

class JSView(View):
    def getResult(self, request, target, *args, **kwargs):  
        result = super(JSView, self).getResult(request, target, *args, **kwargs)
        File, extra = result
        return HttpResponse(simplejson.dumps(extra), mimetype='application/javascript')

