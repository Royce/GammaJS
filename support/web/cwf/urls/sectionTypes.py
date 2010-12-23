from cwf.urls.section import Section
from cwf.urls.dispatch import dispatch
from django.conf.urls.defaults import include
from django.views.generic.simple import redirect_to

########################
###
###   MIXINS
###
########################

class IncludeMixin(object):
    """Provides a means to get includes in urlpatterns"""
    def getInclude(self, includeAs=None, base=False):
        
        if self.root and not includeAs:
            regex = '^$'
        else:
            if base:
                regex = '^'
            else:
                if not includeAs:
                    includeAs = self.name
                regex = '^%s/' % includeAs
        
        yield (regex, include('%s.urls' % self.package))

class NormalMixin(object):
    """Provides init type functionality for a section/page that has a parent"""
    def setup(self):
        
        if self.match:
            self.regex = r'(?P<%s>%s)' % (self.match, self.name)
        else:
            self.regex = self.name
        
        self.url = self.regex        
        if not hasattr(self.parent, 'getInclude'):                
            self.url = "/".join(self.parent.url.split('/') + [self.regex])
                
        for attr in ['target', 'obj', 'package']:
            if not getattr(self, attr):
                setattr(self, attr, getattr(self.parent, attr))
            
        if not self.target:
            self.target = self.name
        
        if not self.obj:
            self.obj = 'views.%s' % self.target

########################
###
###   PARENTAL SECTION
###
########################

class SectParentBase(object):
    
    def addExistingSection(self, section, root=False, includeAs=None):
        if hasattr(section, 'getInclude'):
            self.contents.append((section, includeAs))
        else:
            self.contents.append(section)
        
        if root:
            section.root = root
            
        self.contentsDict[section.name] = section
    
    def addExistingBase(self, base, root=False):
        self.base = base
            
        if root:
            base.root = root
            
        self.contentsDict[base.name] = base
        
class SectParent(Section, SectParentBase):
    """Provides functions to be able to easily add children"""
    def addBase(self, root=False, *args, **kwargs):
        base = Page(self.name,  parent=self, match=self.match, *args, **kwargs)
        self.addExistingBase(base, root)
        
    def addPage(self, *args, **kwargs):
        page = Page(parent=self, *args, **kwargs)
        self.contents.append(page)
            
    def addSect(self, kls, name, root=False, includeAs=None, *args, **kwargs):
        kwargs['parent'] = self
        next = kls(name, *args, **kwargs)
        self.addExistingSection(next, root, includeAs)
        return next
    
    def addSection(self, *args, **kwargs):
        return self.addSect(SectNormal, *args, **kwargs)
    
    def addInclude(self, *args, **kwargs):
        return self.addSect(SectNormalInclude, *args, **kwargs)
    
    def addExternal(self, section, root=False, includeAs=None, base=False):
        self.addExistingSection(section, root, includeAs)    
        
    def addPart(self, obj, base=False, root=False, includeAs=None):
        if type(obj) in (str, unicode):
            obj = obj.split('.')
            pkg = __import__('.'.join(obj[:-1]), globals(), locals(), [obj[-1]], -1)
            section = getattr(pkg, obj[-1])
        else:
            section = obj
        
        for sect in self.getSects(section):
            sect.parent = self
            
            if base:
                self.addExistingBase(sect, root)
            else:
                self.addExistingSection(sect, root, includeAs)
        
        return section
    
########################
###
###   ROOT SECTION
###
########################

class SectRoot(SectParent):
    """A Parental section that  doesn't have a parent"""
    def setup(self):
        if self.match:
            self.url = "(?P<%s>%s)" % (self.match, self.name)
        else:
            self.url = self.name
        if not self.obj:
            self.obj = '%s.views.views' % self.package
        if not self.target:
            self.target = 'base'

########################
###
###   PAGE
###
########################
    
class Page(Section, NormalMixin):
    """Can't add anything to a page, and this yields the actuall patterns for urlpatterns"""
    def getPatternList(self, isBase=False):
        if self.redirectTo:
            def redirect(request):
                if self.show():
                    return redirect_to(request, url=unicode(self.redirectTo))
                else:
                    self.raise404()
                
            yield ('^$', redirect)
        else:
            if self.parent and not hasattr(self.parent, 'getInclude') and not isBase:
                regex = '%s/%s' % (self.parent.url, self.regex)
            else:
                if isBase:
                    if hasattr(self.parent, 'getInclude'):
                        regex = ''
                    else:
                        regex = self.parent.url
                else:
                    regex = self.regex
            
            extra = {'obj' : self.obj, 'target' : self.target, 'section' : self.parent, 'condition' : self.show}
            if self.extraContext:
                extra.update(self.extraContext)
                
            yield ('^%s/?$' % regex, dispatch, extra)

########################
###
###   SITE
###
########################

class Site(Section, SectParentBase):
    """A site is a section but you can only add sections you've already created"""
        
    def addSection(self, section, root=False, includeAs=None):
        section.site = self
        self.addExistingSection(section, root, includeAs)
        
    def addBase(self, section, root=False):
        section.site = self
        self.addExistingBase(section, root)
        
    def addPart(self, obj, base=False, root=False, includeAs=None, **kwargs):
        if type(obj) in (unicode, str):
            obj = obj.split('.')
            pkg = __import__('.'.join(obj[:-1]), globals(), locals(), [obj[-1]], -1)
            section = getattr(pkg, obj[-1])
        else:
            section = obj
        
        for sect in self.getSects(section):
            if hasattr(sect, 'base'):
                for part in sect:
                    part.site = self
                
            if base:
                self.addBase(sect, root)
            else:
                self.addSection(sect, root, includeAs)
        
        return section

class SitePart(Site, IncludeMixin):
    def setup(self):
        self.package = self.name
        self.part = True
        
########################
###
###   MIX AND MATCH :p
###
########################

class SectNormal(SectParent, NormalMixin):
    """A parental section that does have a parent itself"""
    pass

class SectNormalInclude(SectNormal, IncludeMixin):
    pass

class SectRootInclude(SectRoot, IncludeMixin):
    pass

