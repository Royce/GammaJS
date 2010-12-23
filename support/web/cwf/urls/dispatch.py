from django.http import Http404

class Dispatcher(object):
    def __init__(self):
        self.viewObjs = {}
    
    def __getitem__(self, key):
        try:
            view = self.viewObjs[key]
        except KeyError:
            if type(key) in (unicode, str):
                obj = key.split('.')
                pkg = __import__('.'.join(obj[:-1]), globals(), locals(), [obj[-1]], -1)
                view = getattr(pkg, obj[-1])
            else:
                view = key
                key = key.__module__
            self.viewObjs[key] = view = view(self.request)
        
        return view
        
    def __call__(self, request, obj, target, section, condition, *args, **kwargs):
        if condition():
            self.request = request
            return self[obj](request, target, section=section, *args, **kwargs)
        else:
            raise Http404
    
dispatch = Dispatcher()
