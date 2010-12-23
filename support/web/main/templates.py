from django.template.loaders.filesystem import load_template_source as django_load_template_source
from django.conf import settings

def load_template_source(templateName, templateDirs=None):
    if not templateDirs:
        templateDirs = list(settings.TEMPLATE_DIRS)
    
    parts = templateName.split(":")
    
    if len(parts) > 1:
        if len(parts) == 3:
            folder, sub, name = parts
        elif len(parts) == 2:
            folder, name = parts
            sub = None
        else:
            raise Exception("Must only have one or two ':' in template name")
    
        
        location = {
            'spikes'   : settings.SPIKEDIR,
            'examples' : settings.EXAMPLEDIR,
        }.get(folder, None)
        
        if not location:
            raise Exception("No such location as %s" % location)
    
        if sub:
            location = '/'.join([location, sub])
        
        templateDirs = [location] + templateDirs
        templateName = name
    
    return django_load_template_source(templateName, templateDirs)

load_template_source.is_usable = True
