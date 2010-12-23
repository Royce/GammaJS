########################
###
###   IMPORTS
###
########################

    ########################
    ###   BUILTIN
    ########################

from itertools import chain
from functools import wraps
import codecs
import pprint
import sys
import re
import os

    ########################
    ###   LOCAL
    ########################

from utility import cleanstr
from regexes import regexes
from const import *

    ########################
    ###   LOGGING
    ########################

import logging, logging.config

try:
    logging.config.fileConfig(os.path.join(sys.path[0], LOGCONFIG))
except:
    pass

log = logging.getLogger('parser.containers')
        
########################
###
###   CONTAINERS
###
########################

class Info(object):
    def __init__(self, **kwargs):
        self.props = {}
        for k, v in kwargs.items():
            self[k] = v
        
        #Params must be in an array to stay in order
        
        self[CLASS] = None
        self[PARAMS]  = []
        self[PACKAGE] = None
        
        if DESCRIPTION not in self:
            self[DESCRIPTION] = ""
        
        if hasattr(self, "_init"):
            self._init(**kwargs)
    
    def __getitem__(self, key):
        name = 'get_%s' % key
        if hasattr(self, name):
            getattr(self, name)(key, value)
        return self.props[key]

    def __setitem__(self, key, value):
        name = 'set_%s' % key
        if hasattr(self, name):
            getattr(self, name)(key, value)
        self.props[key] = value
    
    def __contains__(self, key):
        return key in self.props
    
    def printout(self):
        def printed(v):
            s = []
            
            if type(v) in (str, unicode):
                s.append(unicode(v))
                
            elif type(v) in (list, tuple):
                s.append('[')
                for thing in v:
                    thing = '\n\t'.join(printed(thing).split('\n'))
                    s.append('\t%s' % thing)
                s.append(']')
                
            elif type(v) is dict:
                s.append('{')
                for key, value in v.items():
                    value = '\n\t'.join( printed(value).split('\n') )
                    s.append('\t%s : %s' % (key, value))
                s.append('}')
            
            else:
                if v is None:
                    v = 'none'
                s.append(unicode(v))
            
            return '\n'.join(s)
        
        return '\n'.join([
            self.__class__.__name__, 
            '\t%s' % '\n\t'.join(
                printed(self.props).split('\n')
            )
        ]).replace('\t', '    ')
    
    def __unicode__(self):
        return "<%s : [\n\t%s]>" % (
            self.__class__.__name__, 
            '\n\t'.join([k for k, v in self.props.items() if v is not None])
        )

    def __str__(self):
        return unicode(self)
    
    def name(self):
        return self[NAME]
    
    def items(self):
        for item in self.props.items():
            yield item
    
    def registerModule(self, state, module):
        self[MODULE] = module
    
    def parseParams(self, state, tokenMap):
        if PARAM in tokenMap:
            for param in tokenMap[PARAM]:
                if True:
                    match = regexes['compound'].match(param)

                    if match:
                        if match.group(4):
                            t, description = "", match.group(4) + match.group(5)
                        else:
                            t, description = match.group(2), (match.group(1) + match.group(3)).strip()

                    else:
                        t, description = "", ""
                
                m = regexes['param'].match(description)
                if m:
                    name = m.group(1)
                    description = m.group(2).strip()

                    self[PARAMS].append(
                        state.parser.paramKls(
                            **{ TYPE : t
                              , NAME : name
                              , DESCRIPTION : description
                              }
                        )
                    )
                else:
                    log.error("Error, could not parse param -- %s, %s --" % (t, description))

            tokenMap.pop(PARAM)
        return self
        
    def parseReturn(self, state, tokenMap):
        if RETURN in tokenMap:
            ret = tokenMap[RETURN][0]
            try:
                match = regexes['compound'].match(ret)

                if match:
                    if match.group(4):
                        t, description = "", match.group(4) + match.group(5)
                    else:
                        t, description = match.group(2), (match.group(1) + match.group(3)).strip()
                else:
                    t, description = "", ""

            except:
                log.error("\nError, a return statement could not be parsed:\n\n %s\n\n %s\n" % (ret, pprint.pformat(tokenMap)))
                sys.exit()

            self[RETURN] = state.parser.returnKls(
                **{ TYPE : t, DESCRIPTION : description}
            )
            tokenMap.pop(RETURN)
        return self

class Everything(Info):
    def _init(self):
        self[GLOBAL]     = {}
        self[MODULES]    = {}
        self[FILE_MAP]   = {}
        self[CLASS_MAP]  = {}
        self[NAMESPACES] = {}
        
        self.association = [
              ('File',      FILE_MAP)
            , ('Class',     CLASS_MAP)
            , ('Global',    GLOBAL)
            , ('Module',    MODULES)
            , ('Namespace', NAMESPACES)
        ]
        
        # Dynamically create some methods
        for name, lookIn in self.association:
            self.addSomeFunctions(name, lookIn)
    
    def addSomeFunctions(self, name, lookIn):
        setattr(self, 'has%s' % name, lambda s, n : self._has(s, lookIn, n))
        
        setattr(self, 'get%s' % name, lambda s, n : self._get(s, lookIn, n))
        
        setattr(self, 'setCurrent%s' % name, lambda s, n : self.addClass(s, n, None))
        
        setattr(self, 'add%s' % name, lambda s, n, k : self._add(s, n, k, lookIn, name))
    
    def finish(self):
        self.moduleNames         = sorted(self[MODULES].keys(), lambda x,y: cmp(x.lower(), y.lower()))
        self.cleansedModuleNames = dict((mod, cleanstr(mod)) for mod in self.moduleNames)
    
    def _has(self, state, lookIn, name):
        return name in self[lookIn]
    
    def _get(self, state, lookIn, name):
        return self[lookIn][name]
        
    def _add(self, state, name, kls, lookIn, desc):
        lookAt = self[lookIn]
        if name in lookAt:
            if kls is None and type(lookAt) not in (list, tuple):
                kls = lookAt[name]
            else:
                log.warn("WARNING: %s %s was redefined" % (desc, name))
        else:
            if type(lookAt) in (list, tuple):
                lookAt.append(kls)
            else:
                self[lookIn][name] = kls
                
        setattr(state, 'current%s' % desc, kls)
        return kls
        
class File(Info):
    def _init(self, **kwargs):
        self[CLASS_LIST] = []
            
    def addClass(self, state, c):
        if type(c) in (str, unicode):
            c = state.getClass(c)
            
        if c not in self[CLASS_LIST]:
            self[CLASS_LIST].append(c)
    
    def asPackage(self, moduleName):
        package = self[NAME]
        return '%s/%s' % (moduleName, package[:package.find('.js')].replace('.', '/'))

class Module(Info):
    def _init(self, **kwargs):
        self[SUBDATA]    = {}
        self[CLASSES]    = {}
        self[CLASS_LIST] = []
        self[FILE_LIST]  = []
        self[SUBMODULES] = []
        
        self[TOPLEVEL_CLASSES] = []
    
    def determineInherited(self):
        for layer, sup in self.classLayers():
            for kls in layer:
                kls.findInherited(sup)
    
    def addSubModule(self, state, name, kls):
        state.subModName = name
        
        if subname not in self[SUBMODULES]:
            self[SUBMODULES].append(subname)
        
        if name not in self[SUBDATA]:
            self[SUBDATA][name] = kls
        
        return kls
            
    def addFile(self, state, f):
        if type(f) in (str, unicode):
            f = state.getFile(c)
    
        if f not in self[FILE_LIST]:
            self[FILE_LIST].append(f)
            
    def addClass(self, state, c):
        if type(c) in (str, unicode):
            c = state.getClass(c)
            
        if c not in self[CLASS_LIST]:
            self[CLASS_LIST].append(c)
        
        self[CLASSES]['%s.%s' % (self[NAME], c[NAME])] = c
    
    def links(self):
        out = []
        root = []
        folders = {}
        for f in self[FILE_LIST]:
            parts = f[NAME].split('/')
            if len(parts) == 1:
                for kls in f[CLASS_LIST]:
                    root.append(kls)
            else:
                folder = parts[-2]
                if folder not in folders:
                    folders[folder] = []
                
                for kls in f[CLASS_LIST]:
                    folders[folder].append(kls)
        if root:
            out.append('* Top Level\n')
            for kls in root:
                out.append('  * :doc:`%s <%s/%s>`' % (kls[NAME], self[NAME], kls[NAME]))
        
        for folder, klsList in folders.items():
            if klsList:
                out.append('* %s\n' % folder)
                for kls in klsList:
                    out.append('  * :doc:`%s <%s/%s>`' % (kls[NAME], self[NAME], kls[NAME]))
        
        return '\n'.join(out)

class Class(Info):
    def _init(self, **kwargs):
        self[TAGS]          = []
        self[USES]          = []
        self[FILE]          = None
        self[MODULE]        = None
        self[CONFIGS]       = {}
        self[METHODS]       = {}
        self[CHILDREN]      = []
        self[DEPENDENCY]    = ""
        self[PROPERTIES]    = {}
        self[SUPERCLASS]    = None
        self[SUPER_CHAIN]   = []
        self[INSTANTIATED]  = False
        self[CONSTRUCTORS]  = []
        self[INNER_CLASSES] = []
        
        self[ALL_METHODS]          = []
        self[ALL_PROPERTIES]       = []
        self[INHERITED_METHODS]    = []
        self[INHERITED_PROPERTIES] = []
        
        self.methodCount    = 0
        self.propertyCount  = 0
    
    def findInherited(self, typ, name):
        if typ == 'method':
            lookin = INHERITED_METHODS
        else:
            lookin = INHERITED_PROPERTIES
        
        for kls, names in self[lookin]:
            if name in names:
                return kls[NAME]
        
    def table(self):
        col1 = []
        col2 = []
        
        if DEPENDENCY in self and self[DEPENDENCY]:
            col1.append('Package')
            col2.append(self[DEPENDENCY])
        else:
            col1.append('Package')
            col2.append(self[PACKAGE])
            
        if INSTANTIATED in self and self[INSTANTIATED]:
            col1.append('Already Instantiated')
            col2.append("")
        
        if SUPER_CHAIN in self and self[SUPER_CHAIN]:
            col1.append('Inheritance chain')
            chain = [':api:`gma.%s`' % s[NAME] for s in self[SUPER_CHAIN]]
            chain.reverse()
            col2.append(' >> '.join(chain))
        
        if CHILDREN in self and self[CHILDREN]:
            col1.append('Descendants')
            col2.append(self.getDescendants())
            
        if col1 and col2:
            length1 = max(len(n)+2 for n in col1)
            length2 = max(len(t)+2 for t in col2)
            
            enclosing = '%s %s' % ('=' * length1, '=' * length2)
            table = [enclosing]
            
            for n, t in zip(col1, col2):
                eachLine = '%s%s %s'
                firstSpace = ' ' * (length1 - len(n))
                table.append(eachLine % (n, firstSpace, t))
            
            table.append(enclosing)
            
            return '\n'.join(table)
    
        return ""
    
    def determineInheritence(self):
        sup = self.getSuper()
        if sup and self not in sup[CHILDREN]:
            sup[CHILDREN].append(self)
            
        while sup:
            self[SUPER_CHAIN].append(sup)
            sup = sup.getSuper()
        
        for sup in self[SUPER_CHAIN]:
            added = []
            for prop in sup[PROPERTIES]:
                if prop not in self[ALL_PROPERTIES]:
                    self[ALL_PROPERTIES].append(prop)
                    added.append(prop)
            
            if added:
                self[INHERITED_PROPERTIES].append((sup, added))
        
        for sup in self[SUPER_CHAIN]:
            added = []
            for prop in sup[METHODS]:
                if prop not in self[ALL_METHODS]:
                    self[ALL_METHODS].append(prop)
                    added.append(prop)
            
            if added:
                self[INHERITED_METHODS].append((sup, added))
        
    def hasTags(self):
        if self[TAGS]:
            return True
        else:
            return False
        
    def hasProperties(self):
        if self[ALL_PROPERTIES]:
            return True
        else:
            return False
    
    def hasMethods(self):
        if self[ALL_METHODS]:
            return True
        else:
            return False
    
    def getTags(self):
        tags = []
        sup = self.getSuper()
        if sup:
            for tag in sup.getTags():
                if tag not in tags:
                    tags.append(tag)
        
        for tag in self[TAGS]:
            tags.append(tag)
            
        return tags
    
    def getInheritedProperties(self):
        out = []
        for kls, props in self[INHERITED_PROPERTIES]:
            next = 'Inherited from :api:`gma.%s`\n\n\t%%s' % kls[NAME]
            refs = [':prop:`%s <gma.%s.%s>`' % (p, kls[NAME], p) for p in props]
            out.append(next % ', '.join(refs))
        
        return '\n\n'.join('.. admonition:: %s' % o for o in out)
    
    def getInheritedMethods(self):
        out = []
        for kls, methods in self[INHERITED_METHODS]:
            next = 'Inherited from :api:`gma.%s`\n\n\t%%s' % kls[NAME]
            refs = [':metho:`%s <gma.%s.%s>`' % (m, kls[NAME], m) for m in methods]
            out.append(next % ', '.join(refs))
        
        return '\n\n'.join('.. admonition:: %s' % o for o in out)
    
    def descendants(self):
        for child in self[CHILDREN]:
            yield child
            for c in child.descendants():
                yield c
    
    def getDescendants(self):
        return ', '.join(':api:`gma.%s`' % c[NAME] for c in self.descendants())
        
    def tagString(self):
        return ', '.join('*%s*' % t for t in self.getTags())
    
    def className(self):
        return self[NAME]
    
    def addConstructor(self, state, constructor):
        self[CONSTRUCTORS].append(constructor)
    
    def addInnerKls(self, state, name):
        if name not in self[INNER_CLASSES]:
            self[INNER_CLASSES].append(name)
    
    def addSuper(self, state, kls):
        self[SUPERCLASS] = kls
    
    def addUse(self, state, use):
        if use not in self[USES]:
            self[USES].append(use)
    
    def getSuper(self):
        if self[SUPERCLASS]:
            try:
                return self[MODULE][CLASSES][self[SUPERCLASS]]
            except:
                raise Exception, "Trying to find %s in %s" % (self[SUPERCLASS], self[MODULE][CLASSES].keys())
            
    def findSuperMethod(self, name):
        sup = self.getSuper()
        if sup:
            if name in sup[METHODS]:
                ref = '%s.%s.%s' % (self[MODULE][NAME], sup[NAME], name)
                return sup[METHODS][name][1], ':metho:`%s <%s>`' % (ref, ref)
            
            return sup.findSuperMethod(name)
        
        return None, ''
    
    def checkMethods(self):
        for name, (_, kls) in self[METHODS].items():
            copiedMethod = None
            if kls[COPY]:
                copiedMethod = kls[COPY]
                if copiedMethod in self[METHODS]:
                    copiedMethod = self[METHODS][copiedMethod][1]
                else:
                    copiedMethod, _ = self.findSuperMethod(copiedMethod)
                    if not copiedMethod:
                        log.warn("%s is trying to copy %s, which doesn't exist" % (kls[NAME], kls[COPY]))
            
            if copiedMethod:
                kls[PARAMS] = kls[PARAMS] or copiedMethod[PARAMS]
                kls[RETURN] = kls[RETURN] or copiedMethod[RETURN]
                kls[DESCRIPTION] = kls[DESCRIPTION] or copiedMethod[DESCRIPTION]
                
                copiedMethod[COPIEDBY].append(kls)
                kls.doCopies()
                    
            superMethod, link = self.findSuperMethod(name)
            if superMethod:
                kls[OVERRIDE] = link
                kls[PARAMS] = kls[PARAMS] or superMethod[PARAMS]
                kls[RETURN] = kls[RETURN] or superMethod[RETURN]
                kls[DESCRIPTION] = kls[DESCRIPTION] or superMethod[DESCRIPTION]
                
                superMethod[OVERRIDEDBY].append(kls)
                kls.doCopies()
                
    def addMethod(self, state, name, kls):
        if name in self[METHODS]:
            log.warn("WARNING: Method %s was redefined" % name)
        else:
            self[ALL_METHODS].append(name)
            self[METHODS][name] = (self.methodCount, kls)
            kls[CLASS] = self
            self.methodCount += 1
        
        return kls
        
    def addProperty(self, state, name, kls):
        if name in self[PROPERTIES]:
            log.warn("WARNING: Property %s was redefined" % name)
        else:
            self[ALL_PROPERTIES].append(name)
            self[PROPERTIES][name] = (self.propertyCount, kls)
            kls[CLASS] = self
            self.propertyCount += 1
        
        return kls
        
    def addConfig(self, state, name, kls):
        if name in self[CONFIGS]:
            log.warn("WARNING: Config %s was redefined" % name)
        else:
            self[CONFIGS][name] = kls
    
    def iterMethods(self):
        for _, method in sorted(self[METHODS].values()):
            yield method
    
    def iterProperties(self):
        for _, prop in sorted(self[PROPERTIES].values()):
            yield prop

class Param(Info):
    def forSignature(self):
        base = self[NAME]
        if TYPE in self:
            base = "%s : %s" % (base, self[TYPE])
        
        return base

class Global(Info): pass

class Event(Info): pass

class Method(Info):
    def _init(self, **kwargs):
        self[COPY]        = None
        self[RETURN]      = None
        self[COPIEDBY]    = []
        self[OVERRIDE]    = None
        self[OVERRIDEDBY] = []
        
    def doCopies(self):
        for k in self[OVERRIDEDBY]:
            k[PARAMS] = k[PARAMS] or self[PARAMS]
            k[RETURN] = k[RETURN] or self[RETURN]
            k[DESCRIPTION] = k[DESCRIPTION] or self[DESCRIPTION]
        
        for k in self[COPIEDBY]:
            k[PARAMS] = k[PARAMS] or self[PARAMS]
            k[RETURN] = k[RETURN] or self[RETURN]
            k[DESCRIPTION] = k[DESCRIPTION] or self[DESCRIPTION]
                
        self[COPIEDBY] = []
        self[OVERRIDEDBY] = []
        
    def getName(self):
        if NAME in self:
            return self[NAME]
        
        if GUESSEDNAME in self:
            return self[GUESSEDNAME]
        
        raise Exception, self.props
        
    def signature(self):
        signature = '**%s** (%%s)%%s' % self.getName()
        params = ', '.join(p[NAME] for p in self[PARAMS])
            
        if not params:
            params = ' '
            
        ret = ""
        if RETURN in self and self[RETURN]:
            ret = " -> %s" % self[RETURN][TYPE]
        return signature % (params, ret)

    def describedParams(self):
        if PARAMS in self:
            if any(DESCRIPTION in p and p[DESCRIPTION] for p in self[PARAMS]):
                return True
        
        return False

    def hasParams(self):
        return len(self[PARAMS]) > 0

    def getParams(self):
        return '\n'.join(p.forSignature() for p in self[PARAMS])
    
    def paramTable(self):
        names = (p[NAME] for p in self[PARAMS])
        types = (p[TYPE] for p in self[PARAMS])
        descs = []
        if self.describedParams():
            for p in self[PARAMS]:
                if DESCRIPTION in p:
                    descs.append(p[DESCRIPTION])
                else:
                    descs.append("")
        
        if descs:
            return self._paramTableWithDescription(zip(names, types, descs))
        else:
            return self._paramTableNoDescription(zip(names, types))
        
    def _paramTableNoDescription(self, params):
        names = []
        types = []
        for n, t in params:
            names.append(n)
            types.append(t)
        
        length1 = max(len(n)+2 for n in names)
        length2 = max(len(t)+2 for t in types)
        
        totalLength = length1 + length2
        headingLength = 80
        if totalLength < headingLength:
            diff = (headingLength - totalLength)
            length1 += int(diff * (float(length1)/totalLength))
            length2 += int(diff * (float(length2)/totalLength))
            totalLength = length1 + length2
            if totalLength < headingLength:
                length2 += (headingLength - totalLength)
                totalLength = length1 + length2
        
        tableHeader = "+%s+\n| Parameters %s|\n+%s+"
        firstLine = '-' * (totalLength+1)
        firstSpace = ' ' * (totalLength - len(" Parameters"))
        secondLine = '%s+%s' % ('=' * length1, '=' * length2)
        
        table = [tableHeader % (firstLine, firstSpace, secondLine)]
        
        for n, t in zip(names, types):
            eachLine = '| %s%s| %s%s|\n+%s+'
            firstSpace = ' ' * (length1 - len(n) - 1)
            secondSpace = ' ' * (length2 - len(t) - 1)
            secondLine = '%s+%s' % ('-' * length1, '-' * length2)
            
            table.append(eachLine % (n, firstSpace, t, secondSpace, secondLine))
        
        return '\n'.join(table)
    
        
    def _paramTableWithDescription(self, params):
        names = []
        types = []
        descs = []
        for n, t, d in params:
            names.append(n)
            types.append(t)
            descs.append(d)
        
        length1 = max(len(n)+2 for n in names)
        length2 = max(len(t)+2 for t in types)
        length3 = max(len(d)+2 for d in descs)
        
        totalLength = length1 + length2 + length3
        headingLength = 80
        if totalLength < headingLength:
            diff = (headingLength - totalLength)
            length1 += int(diff * (float(length1)/totalLength))
            length2 += int(diff * (float(length2)/totalLength))
            length3 += int(diff * (float(length3)/totalLength))
            totalLength = length1 + length2 + length3
            if totalLength < headingLength:
                length3 += (headingLength - totalLength)
                totalLength = length1 + length2 + length3
        
        tableHeader = "+%s+\n| Parameters %s|\n+%s+"
        firstLine = '-' * (totalLength+2)
        firstSpace = ' ' * (totalLength - len("Parameters"))
        secondLine = '%s+%s+%s' % ('=' * length1, '=' * length2, '=' * length3)
        
        table = [tableHeader % (firstLine, firstSpace, secondLine)]
        
        for n, t, d in zip(names, types, descs):
            eachLine = '| %s%s| %s%s| %s%s|\n+%s+'
            firstSpace = ' ' * (length1 - len(n) - 1)
            secondSpace = ' ' * (length2 - len(t) - 1)
            thirdSpace = ' ' * (length3 - len(d) - 1)
            secondLine = '%s+%s+%s' % ('-' * length1, '-' * length2, '-' * length3)
            
            table.append(eachLine % (n, firstSpace, t, secondSpace, d, thirdSpace, secondLine))
        
        return '\n'.join(table)
            

class Property(Info):
    
    def getName(self):
        if NAME in self:
            return self[NAME]
        
        if GUESSEDNAME in self:
            return self[GUESSEDNAME]
        
        raise Exception, self.props
    
    def table(self):
        col1 = []
        col2 = []
        
        if TYPE in self:
            col1.append('Type')
            col2.append(self[TYPE])
            
        if DEFAULT in self:
            col1.append('Default')
            col2.append(self[DEFAULT])
        
        if FINAL in self:
            col1.append('Final')
            col2.append('True')
        
        if PACKAGE in self and self[PACKAGE] and self[PACKAGE] != self[CLASS][PACKAGE]:
            col1.append("Package")
            col2.append(self[PACKAGE])
            
        if col1 and col2:
            length1 = max(len(n)+2 for n in col1)
            length2 = max(len(t)+2 for t in col2)
            
            table = ['+%s+%s+' % ('-' * length1, '-' * length2)]
            
            for n, t in zip(col1, col2):
                eachLine = '| %s%s| %s%s|\n+%s+'
                firstSpace = ' ' * (length1 - len(n) - 1)
                secondSpace = ' ' * (length2 - len(t) - 1)
                secondLine = '%s+%s' % ('-' * length1, '-' * length2)
                
                table.append(eachLine % (n, firstSpace, t, secondSpace, secondLine))
            
            return '\n'.join(table)
    
        return ""

class Config(Info): pass

class Return(Info): pass

class Namespace(Info): pass

class Constructor(Info): pass

class SubModule(Info): pass
        
########################
###
###   STATE
###
########################

class State(object):
    def __init__(self, parser):
        self.parser = parser
        self.info   = self.parser.info
        
        self.subModName       = ""
        self.currentFor       = ""
        self.currentFile      = ""
        self.currentGlobal    = ""
        self.currentModule    = ""
        self.currentNamespace = ""
        
        self.deferredModuleFiles   = {}
        self.deferredModuleClasses = {}
    
    def __getattr__(self, key):
        if not key.startswith('_') and key not in self.__dict__:
            if hasattr(self.info, key):
                func = getattr(self.info, key)
                if callable(func):
                    @wraps(func)
                    def ret(*args, **kwargs):
                        return func(self, *args, **kwargs)
                    
                    return ret
        
        return object.__getattribute__(self, key)
    
    def handleDeferred(self, state):
        if self.currentModule:
            if self.deferredModuleFiles:
                for df in self.deferredModuleFiles.values():
                    df.registerModule(state, self.currentModule)
                    self.currentModule.addFile(self, df)

                self.deferredModuleFiles = {}

            if self.deferredModuleClasses:
                for mc in self.deferredModuleClasses.values():
                    mc.registerModule(state, self.currentModule)
                    self.currentModule.addClass(self, mc)

                self.deferredModuleClasses = {}
        
    def addDeferredFile(self, state, name, target):
        log.info('deferred module file: ' + name)
        if name not in self.deferredModuleFiles:
            self.deferredModuleFiles[name] = target
        
    def addDeferredClass(self, state, name, target):
        log.info('deferred module CLASS: ' + name)
        if name not in self.deferredModuleClasses:
            self.deferredModuleClasses[name] = target
            
    def processToken(self, token, desc):
        if token == MODULE:
            if desc:
                if self.hasModule(desc):
                    self.currentModule = self.getModule(desc)
            else:
                log.warn("No name for module")
        
    def getClassName(self, classString, namespace):
        shortName = classString.replace("%s." % namespace, "")
        longName  = '%s.%s' % (namespace, shortName)
        return shortName, longName
        
    def getNamespace(self, name):
        if self.currentNamespace:
            shortName, longName = self.getClassName(name, self.currentNamespace)
        else:
            shortName = longName = name
        
        return shortName, longName
    
    def forKls(self, name, creationFunc):
        self.currentFor = name
        if name in self.info[CLASS_MAP]:
            self.setCurrentClass(name)
        else:
            creationFunc(name)
