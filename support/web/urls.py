from django.conf.urls.defaults import *
from django.http import HttpResponse
from django.conf import settings

import httplib

def proxy(request, domain, port, debugOnly=False, add="", path=""):
    if path:
        querystring = path
    else:
        querystring = request.META['PATH_INFO']
        
    if add:
        querystring = "%s%s" % (add, querystring)
        
    t = httplib.HTTPConnection(domain, port)
    t.request("GET", querystring)
    s = t.getresponse()
        
    response = HttpResponse(s.read(), status=s.status)
    for key, value in s.getheaders():
        response[key] = value
    
    return response

urlpatterns = patterns('',
    (r'^wglemedia/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': '%s/media' % settings.PROJECTDIR}),
        
    (r'^support/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': '%s/lib' % settings.GMA_SUPPORT}),
        
    (r'^scripts/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.GMA}),
        
    (r'^spikes/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.SPIKEDIR}),
        
    (r'^docs/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': "%s/docs/_build/html" % settings.GMA}),
        
    (r'^examples/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.EXAMPLEDIR}),
        
    (r'^built/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.BUILTDIR}),
        
    (r'^build/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.BUILTDIR}),
        
    (r'^gmamedia/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': settings.GMA_MEDIA}),
    
    (r'^instrumented/(?P<path>.*)$', proxy, 
        {'domain' : '0.0.0.0', 'port' : 8081, 'add' : '/'}
    ),
    
    (r'^', include('main.urls')),
)
