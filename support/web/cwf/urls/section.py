from django.conf.urls.defaults import include, patterns
from django.views.generic.simple import redirect_to

class Section(object):
    def __init__(self, name, obj=None, target=None, redirectTo=None,
        match=None, values=None, new=None, valuesAsSet=True, compareFunc=None, 
        needsAuth=False, perms=None, display=True, alias=None,
        parent=None, package=None, root=False, active=True, sortByAlias=True,
        extraContext=None, condition=None):
            
        self.contents = []
        self.contentsDict = {}
        self.url = '/'
            
        #set everything passed in to a self.xxx attribute
        import inspect
        args, _, _, _ = inspect.getargvalues(inspect.currentframe())
        for arg in args:
            setattr(self, arg, locals()[arg])
        
        if not self.alias:
            self.alias = self.name.capitalize()
            
        if hasattr(self, 'setup'):
            self.setup()
        
    def rootAncestor(self):
        if self.parent:
            return self.parent.rootAncestor()
        else:
            return self
    
    ########################
    ###   UTILITY
    ########################
    
    def show(self):
        parentShow = True
        if self.parent:
            parentShow = self.parent.show()
        
        if parentShow:
            if self.condition:
                if callable(self.condition):
                    return self.condition()
                else:
                    return self.condition
            else:
                return True
        else:
            return False
    
    def appear(self):
        return self.display and self.show()
        
    def getSects(self, section):
        if callable(section):
            for sect in section():
                if sect:
                    yield sect
                
        elif type(section) in (list, tuple):
            for sect in section:
                if sect:
                    yield sect
        else:
            if section:
                yield section
        
    ########################
    ###   MENU STUFF
    ########################
    
    def getChildrenMenu(self, *args, **kwargs):
        if any(part for part in self.contents):
            return self.childrenMenuGen(*args, **kwargs)
        else:
            return None
        
    def childrenMenuGen(self, request, path, used):
        for part in self.contents:
            if type(part) is tuple:
                part, _ = part
            for p in part.getMenu(request, path, used):
                yield p
                
    def getMenu(self, request, path, used):    
        selected = False
        resultUsed = used
        
        if self.values:
            #determine values
            valuesToUse = list(value for value in self.values(used.split('/')))
        else:
            valuesToUse = None
            
        if valuesToUse and any(value for value in valuesToUse):
            if self.valuesAsSet:
                valuesToUse = set(valuesToUse)
            
            def getValues(values):
                if self.new:
                    values = [self.new(path, value) for value in values]
                else:
                    values = [(value, value) for value in values]
                
                return values
                
            if self.compareFunc:
                if self.sortByAlias:
                    valuesToUse = getValues(valuesToUse)
                    valuesToUse = sorted(valuesToUse, self.compareFunc)
                else:
                    valuesToUse = sorted(valuesToUse, self.compareFunc)
                    valuesToUse = getValues(valuesToUse)
            else:
                valuesToUse = getValues(valuesToUse)
            
            #for all values, create items in the menu
            for alias, match in valuesToUse:
                    
                url = '%s/%s' % (used, match)
                args = [alias, url, self]
                
                #determine if this item has been selected
                if len(path) != 0:
                    if unicode(match).lower() == path[0].lower():
                        selected = True
                        resultUsed += '/%s' % path[0]
                    else:
                        selected = False
                
                args += [selected]
                
                #If there is a chance of children, add the generator function, otherwise add nothing
                if any(part for part in self):
                    args += [self.getChildrenMenu(request, path[1:], resultUsed)]
                else:
                    args += [None]
                    
                yield args
                
        else:
            if not self.values:
                for p in self.singleFillMenu(request, path, used):
                    yield p
        
        if len(path) != 0:
            url = '%s/%s' % (used, path[0])
            
            if not self.parent:
                gen = self.getChildrenMenu(request, path[1:], url)
                if gen:
                    for p in gen:
                        yield p
    
    def singleFillMenu(self, request, path, used):
        url = '%s/%s' % (used, self.name)
        selected = False
            
        if hasattr(self, 'base'):
            args = [self.base.alias, url, self.base]
            
            if len(path) != 0:
                if unicode(self.name) == path[0]:    
                    selected = True
                    
                    #Make sure the base item isn't selected unnecessarily
                    if not self.parent:
                        if path[-1] == '' and len(path) > 2:
                            selected = False
                        elif path[-1] != '' and len(path) > 1:
                            selected = False
            
            args += [selected]
                                                
            if self.parent:
                args += [self.getChildrenMenu(request, path[1:], url)]
            else:
                args += [[]]
            
        else:
            if len(path) != 0:
                if unicode(self.name) == path[0]:
                    selected = True
            
            args = [self.alias, url, self, selected]
            
            if selected:
                args += [self.getChildrenMenu(request, path[1:], url)]
            else:
                args += [[]]
            
        yield args
                
        
    ########################
    ###   URL PATTERNS
    ########################

    def getPatterns(self, includesOnly=False):
        l = []
        
        for part in self.getPatternList():
            l.append(part)
        return patterns('', *l)

    def getPattern(self, name, includeAs=None):
        l = []
        
        for p in self.contentsDict[name].getInclude(includeAs):
            l.append(p)
        
        return patterns('', *l)
        
    def getPatternList(self, isBase=False):
        
        if self.redirectTo:
            yield ('^%s$' % self.url, redirect_to, {'url' : str(self.redirectTo)})
        else:
            if hasattr(self, 'base'):
                if hasattr(self.base, 'getInclude'):
                    for p in self.base.getInclude(base=True):
                        yield p
                else:
                    for p in self.base.getPatternList(isBase=True):
                        yield p
        
        for part in self.contents:    
            if type(part) is tuple:
                part, includeAs = part
                                
            if hasattr(part, 'getInclude'):
                for p in part.getInclude(includeAs):
                    yield p
            else:
                for p in part.getPatternList():
                    yield p    
        
    ########################
    ###   SPECIAL
    ########################
    
    def __iter__(self):
        if hasattr(self, 'base'):
                
            if hasattr(self.base, 'part'):
                for s in self.base:
                    yield s
            else:
                yield self.base
                
        for sect in self.contents:
            if type(sect) is tuple:
                section, _ = sect
            else:
                section = sect
                
            if hasattr(section, 'part'):
                for s in section:
                    yield s
            else:
                yield section
    
    def __getitem__(self, key):
        return self.contentsDict[key]
    
    def __unicode__(self):
        return "<CWF Section %s : %s : %s>" % (self.name, self.alias, self.url)

    def __repr__(self):
        return unicode(self)
    
