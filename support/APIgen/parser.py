########################
###
###   IMPORTS
###
########################

    ########################
    ###   BUILTIN
    ########################

import sys
import os

    ########################
    ###   LOCAL
    ########################

from containers import File, Param, Class, Event, Config, Module, Global, Namespace
from containers import Return, Method, Property, SubModule, Constructor
from utility import cleanstr
from const import *

    ########################
    ###   LOGGING
    ########################

import logging, logging.config

try:
    logging.config.fileConfig(os.path.join(sys.path[0], LOGCONFIG))
except:
    pass

log = logging.getLogger('parser.parse')
        
########################
###
###   TOKEN WRAPPER
###
########################
    
class TokenWrapper(object):
    """Wrapper around the tokens list"""

    # tags that do not require a description, used by the tokenizer so that these
    # tags can be used above the block description without breaking things
    singleTags = "constructor public private protected static final beta experimental writeonce readonly global chainable instantiated"
    
    def __init__(self, tokens, state):
        self.tokens = tokens
        self.blocks = []
        
        self.state = state
        
        # Copy is kept for error messages
        self.copy = tokens[:]
    
    def peek(self):
        if len(self.tokens) > 0:
            return self.tokens[0].strip()
    
    def next(self):
        if len(self.tokens) > 0:
            return self.tokens.pop(0).strip()
        
    def __contains__(self, key):
        return key in self.tokens
    
    def __getitem__(self, key):
        return self.tokens[key]
    
    def isTag(self, token):
        return token.strip()[:1] == "@"
    
    def __unicode__(self):
        return unicode(self.copy)
            
    def createTokenMap(self):
        tokenMap = {}
        
        token = self.next()
        while token is not None:
            peek = self.peek()
            if self.isTag(token):
                token = token[1:].lower() # remove the @ and lowercase
                desc = ""

                # most tags require a description after, some do not
                if token not in self.singleTags and not self.isTag(peek):
                    desc = self.next()
                    if not desc or self.isTag(desc):
                        if desc:
                            msg = "WARNING: expected a description block for tag @%s but found another tag @%s" % (token, desc)
                        else:
                            msg = "WARNING: expected a description block for tag @%s but it was empty" % token

                        log.warn("\n" + self.state.currentFile.name() + "\n" + msg + ":\n\n" + unicode(token) + "\n")
                        
                # keep a map of the different tags we have found, with an
                # array to keep track of each occurrance
                if token not in tokenMap:
                    tokenMap[token] = []

                tokenMap[token].append(desc)
                self.state.processToken(token, desc)

            else:
                # the first block without a description should be the description
                # for the block
                if token and DESCRIPTION not in tokenMap:
                    tokenMap[DESCRIPTION] = [token]
            
            token = self.next()

        self.blocks.append(tokenMap);
        
        if NAMESPACE in tokenMap:
            ns = tokenMap[NAMESPACE][0]
            self.state.addNamespace(ns, self.namespaceKls(
                **{NAME : tokenMap[NAMESPACE][0]}
            ))
            tokenMap.pop(NAMESPACE)
            
        return tokenMap

########################
###
###   Parser
###
########################

class Parser(object):
    def __init__(self, info, containerKls=None, **kwargs):
        super(Parser, self).__init__(**kwargs)
        
        self.info = info
        
        self.fileKls   = File
        self.paramKls  = Param
        self.classKls  = Class
        self.eventKls  = Event
        self.configKls = Config
        self.moduleKls = Module
        self.returnKls = Return
        self.methodKls = Method
        self.globalKls = Global
        
        self.namespaceKls = Namespace
        
        self.propertyKls    = Property
        self.submoduleKls   = SubModule
        self.constructorKls = Constructor
        
        # ContainerKls may contain custom classes for Function, Class, Property, etc
        if containerKls:
            for k, v in containerKls.items():
                setattr(self, '%sKls' % k.lower(), v)
            
    ########################
    ###   UTILITY
    ########################

    def afterParsing(self, state):
        for kls in state.currentModule[CLASS_LIST]:
            kls.checkMethods()
            
        for kls in state.currentModule[CLASS_LIST]:
            kls.determineInheritence()
            
        self.info.finish()
        
    def defineClass(self, state, name):
        shortName, longName = state.getNamespace(name)
            
        ns = state.currentNamespace
        if ns:
            ns = ns.name()
            
        state.addClass(longName,
            self.classKls(
              **{ NAME : longName
                , NAMESPACE : ns
                , SHORTNAME : shortName
                }
            )
        )

        return shortName, longName

    def parseModule(self, state, tokenMap):
        target = None
        state.subModName = False
        
        for module in tokenMap[MODULE]:
            if not state.hasModule(module):
                target = state.addModule(module, self.moduleKls(**{NAME : module}))
            else:
                target = state.getModule(module)

        if SUBMODULE in tokenMap:
            subname = tokenMap[SUBMODULE][0]
            sm = target.addSubModule(subname, self.submoduleKls(**{NAME : state.currentClass.name()}))
            
            if DESCRIPTION in tokenMap:
                sm[DESCRIPTION] = tokenMap[DESCRIPTION][0]
                
            tokenMap.pop(SUBMODULE)
            
        elif DESCRIPTION in tokenMap:
            target[DESCRIPTION] = tokenMap[DESCRIPTION][0]
        
        state.handleDeferred(state)

        tokenMap.pop(MODULE)
        return target
    
    ########################
    ###   PARSE
    ########################
    
    def parse(self, state, tokens):
        """Parse the token stream for a single comment block"""
        
        target   = None
        tokens   = TokenWrapper(tokens, state)
        tokenMap = tokens.createTokenMap()
        
        if tokenMap:
            if FOR in tokenMap:
                self.parse_for(state, tokens, tokenMap)
            
            if TAG in tokenMap:
                self.parse_tag(state, tokens, tokenMap)

            if not any(thing in tokenMap for thing in [
                CLASS, METHOD, PROPERTY, CONSTRUCTOR, EVENT, CONFIG, ATTRIBUTE, MODULE
            ]):
                self.parse_guessed(state, tokens, tokenMap)

            if FILE_MARKER in tokenMap:
                target = self.parse_filemarker(state, tokens, tokenMap)

            elif CLASS in tokenMap:
                target = self.parse_class(state, tokens, tokenMap)
                    
            elif METHOD in tokenMap:
                target = self.parse_method(state, tokens, tokenMap)

            elif PROPERTY in tokenMap and TAG not in tokenMap:
                target = self.parse_property(state, tokens, tokenMap)

            elif CONFIG in tokenMap or ATTRIBUTE in tokenMap:
                target = self.parse_config(state, tokens, tokenMap)
                
            # module blocks won't be picked up unless they are standalone
            elif MODULE in tokenMap:
                target = self.parseModule(state, tokenMap)
            
            if target and state.currentModule:
                target[PACKAGE] = state.currentFile.asPackage(state.currentModule[NAME])
                
            # constructors are added as an array to the currentClass.  This makes it so
            # multiple constructors can be supported even though that is out of scope
            # for documenting javascript
            if CONSTRUCTOR in tokenMap:

                if not state.currentClass:
                    log.error("Error: @constructor tag found but @class was not found.\n****\n")
                    sys.exit(1)
                    
                state.currentClass.addConstructor(state,
                    self.constructorKls(**{DESCRIPTION : tokenMap[DESCRIPTION][0]}).parseParams(state, tokenMap)
                )
                tokenMap.pop(CONSTRUCTOR)

            # process the rest of the tags
            if target != None:
                for token in tokenMap:
                    if token not in target:
                        target[token] = tokenMap[token][0]
    
    ########################
    ###   PARSE FOR
    ########################
    
    def parse_for(self, state, tokens, tokenMap):
        """@for tells the parser either that the class that is being parsed is an inner class
        or, in the case of it being defined outside of a class definition, that an inner class definition 
        is complete and we need to resume processing the remainder of the outer class
        """
        name = tokenMap[FOR][0]
        
        if CLASS not in tokenMap:
            tokenMap.pop(FOR)
            
        state.forKls(name, self.defineClass)
    
    ########################
    ###   PARSE TAG
    ########################
    
    def parse_tag(self, state, tokens, tokenMap):
        """@tag adds another tag to this class"""
        name = tokenMap[TAG][0]
        
        state.currentClass[TAGS].append(name)
    
    ########################
    ###   PARSE GUESSED
    ########################
    
    def parse_guessed(self, state, tokens, tokenMap):
        """Use the guessed name and type if a block type was not found"""
        if GUESSEDNAME in tokenMap:
            if GUESSEDTYPE in tokenMap:
                if tokenMap[GUESSEDTYPE][0] == FUNCTION:
                    tokenMap[METHOD] = tokenMap[GUESSEDNAME]
                else:
                    tokenMap[PROPERTY] = tokenMap[GUESSEDNAME]
    
    ########################
    ###   PARSE FILEMARKER
    ########################
                    
    def parse_filemarker(self, state, tokens, tokenMap):
        fileName = tokenMap[FILE_MARKER][0]
        target = state.addFile(fileName, self.fileKls(**{NAME : fileName}))

        if state.currentModule:
            target[MODULE] = state.currentModule
            state.currentModule.addFile(state, target)
        else:
            # Defer the module assignment until we find the token
            state.addDeferredFile(state, fileName, target)

        tokenMap.pop(FILE_MARKER)
        return target
    
    ########################
    ###   PARSE CLASS
    ########################
        
    def parse_class(self, state, tokens, tokenMap):

        name = tokenMap[CLASS][0]
        shortName, longName = self.defineClass(state, name)
        if DESCRIPTION in tokenMap:
            state.getClass(longName)[DESCRIPTION] = tokenMap[DESCRIPTION]

        if MODULE in tokenMap:
            target, tokenMap = self.parseModule(state, tokenMap)
        
        if state.subModName:
            # provides a place to link to on the module landing page
            state.currentModule[SUBDATA][state.subModName][NAME] = longName

        if GLOBAL in tokenMap:
            target = state.addGlobal(longName, self.globalKls(**{NAME : longName}))

        target = state.getClass(longName)

        if state.currentFor and state.currentFor != longName: # this is an inner class     
            target.addInnerKls(state, state.currentFor)

        if state.currentModule:
            target[MODULE] = state.currentModule
            state.currentModule.addClass(state, longName)
        else:
            # Defer the module assignment until we find the token
            state.addDeferredClass(state, longName, target)

        if state.currentFile:
            target[FILE] = state.currentFile
            state.currentFile.addClass(state, longName)

        if EXTENDS in tokenMap:
            target.addSuper(state, tokenMap[EXTENDS][0])
            
        if USES in tokenMap:
            for use in tokenMap[USES]:
                target.addUse(state, use)
        
        if INSTANTIATED in tokenMap:
            target[INSTANTIATED] = True
        
        if DEPENDENCY in tokenMap:
            target[DEPENDENCY] = tokenMap[DEPENDENCY][0]
            
        tokenMap.pop(CLASS)
        return target
    
    ########################
    ###   PARSE METHOD
    ########################
        
    def parse_method(self, state, tokens, tokenMap):
        method = tokenMap[METHOD][0]

        if not state.currentClass:
            log.warn(
                "WARNING: @method tag found before @class was found.\n****\n%s, making global %s current class" % (
                    method, state.currentGlobal
                )
            )
            state.currentClass = state.currentGlobal

        c = state.currentClass
        target = self.methodKls(**{NAME : method}).parseParams(state, tokenMap).parseReturn(state, tokenMap)
        c.addMethod(state, method, target)
        if DESCRIPTION in tokenMap:
            target[DESCRIPTION] = tokenMap[DESCRIPTION][0]
            
        if COPY in tokenMap:
            target[COPY] = tokenMap[COPY][0]
            
        tokenMap.pop(METHOD)
        return target
    
    ########################
    ###   PARSE PROPERTY
    ########################
        
    def parse_property(self, state, tokens, tokenMap):
        if not state.currentClass:
            log.warn("Error: @property tag found before @class was found.\n****\n")
            state.currentClass = state.currentGlobal
        
        c = state.currentClass
        name = tokenMap[PROPERTY][0]
        target = c.addProperty(state, name, self.propertyKls(**{NAME : name}))
        if DESCRIPTION in tokenMap:
            target[DESCRIPTION] = tokenMap[DESCRIPTION]

        tokenMap.pop(PROPERTY)
        return target
    
    ########################
    ###   PARSE CONFIG
    ########################
        
    def parse_config(self, state, tokens, tokenMap):
    
        if not state.currentClass:
            log.warn("Error: @config tag found before @class was found.\n****\n")
            state.currentClass = state.currentGlobal

        c = state.currentClass
        if ATTRIBUTE in tokenMap:
            config = tokenMap[ATTRIBUTE][0]
        else:
            config = tokenMap[CONFIG][0]
        
        target = c.addConfig(state, config, self.configKls())

        tokenMap.pop(CONFIG)
        return target
