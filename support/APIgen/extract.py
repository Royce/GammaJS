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

from utility import mkdir, getDirContent
from containers import Everything, State
from regexes import regexes
from parser import Parser
from const import *

    ########################
    ###   LOGGING
    ########################

import logging, logging.config

try:
    logging.config.fileConfig(os.path.join(sys.path[0], LOGCONFIG))
except:
    pass

log = logging.getLogger('parser.extractor')
    
########################
###
###   EXTRACTOR
###
########################

class Extractor(object):
    
    # the token we will use to restore the string literals
    replaceToken = '~~~%s~~~'

    def __init__(self, inputdirs
        , infoKls    = None
        , tempDir    = '/tmp'
        , stateKls   = None
        , parserKls  = None
        , extension  = ".js"
        ):
            
        if len(inputdirs) == 0:
            raise ValueError("Need more than one inputdir")
        
        if not infoKls:
            infoKls = Everything
            
        if not parserKls:
            parserKls = Parser
        
        if not stateKls:
            stateKls = State
            
        self.infoKls   = infoKls
        self.stateKls  = stateKls
        self.parserKls = parserKls
        self.inputdirs = inputdirs
        
        self.extension = extension
        self.extension_check = extension.split(',')
    
    ########################
    ###   GENERATE
    ########################
    
    def generate(self):
        info = self.infoKls()
        
        parser = self.parserKls(info)
        state = self.stateKls(parser)

        script         = ""
        subModName     = False
        theGlobals     = {}
        currentGlobal  = ""
        
        deferredModuleFiles   = []
        deferredModuleClasses = []

        log.info("\n---------------------EXTRACTING------------------------\n")
        
        if type(self.inputdirs) in (str, unicode):
            self.inputdirs = [self.inputdirs]
            
        for i in self.inputdirs:
            path   = os.path.abspath(i)
            script = getDirContent(path, self.extension_check)
            
            for match in self.extract(script):
                parser.parse(state, self.tokenize(match))
        
        parser.afterParsing(state)
        return parser.info
    
    ########################
    ###   TOKENISE
    ########################
    
    def tokenize(self, block):
        return regexes['tokenize'].split(block)
    
    ########################
    ###   EXTRACT
    ########################
        
    def extract(self, script):
        matches = []
        
        # Array to keep track of string literals so they are not tokenized with
        # the rest of the comment block
        literals = []

        def insertToken(m):
            """Remove string literals and puts in a placeholder"""
            replacement = self.replaceToken % len(literals)
            literals.append(m.group())
            return replacement
    
        def restore(m):
            """Restore string literals"""
            return literals[int(m.group(1))]

        def guess(m):
            """Guess name and type"""
            t = PROPERTY
            if m.group(1) or m.group(3):
                t = FUNCTION

            self.guessedtype = type
            self.guessedname = m.group(2) 

        def match(m):
            """Extract the comment blocks"""
            if m.group(5):
                return m.group(5)
            else:
                # get the block and filter out unwanted chars
                block = regexes['blockFilter'].sub("", m.group(2))

                # restore string literals
                block = regexes['restore'].sub(restore, block)

                # twice
                block = regexes['restore'].sub(restore, block)
                
                block = '%s\n' % block.strip()
                
                # guess the name and type of the property/method based on the line
                # after the comment
                if m.group(4):
                    nextline = m.group(4)
                    mGuess = regexes['guess'].search(nextline)
                    if mGuess:
                        t = PROPERTY
                        if nextline.find(FUNCTION) > 0:
                            t = FUNCTION

                        block += "@" + GUESSEDTYPE + " " + t + "\n"
                        block += "@" + GUESSEDNAME + " " + mGuess.group(2) + "\n"

                if len(block) > 0:
                    matches.append(block)

                return ''

        # remove regex literals
        script = regexes['regex'].sub(insertToken, script)

        # remove string literals
        script = regexes['literals'].sub(insertToken, script)
    
        # extract comment blocks
        regexes['docBlock'].sub(match, script)
        
        return matches
