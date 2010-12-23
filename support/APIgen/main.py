from containers import Everything, State
from generate import Generator
from extract import Extractor
from parser import Parser
from const import *

from datetime import date
import os

here = os.sep.join(__file__.split(os.sep)[:-1])
   
########################
###
###   MAIN FUNCTION
###
########################

def main(inputdirs, opts=None, **extraOpts):
    information = None
    
    if not opts and extraOpts:
        # extraOpts is only here for convenience if you want to specify options as keyword arguements
        # It requires you haven't specified opts
        opts = extraOpts
    
    if opts and len(inputdirs) > 0:
        extractor = Extractor( inputdirs
            , infoKls    = Everything
            , tempDir    = opts.get("tempDir")
            , stateKls   = State
            , parserKls  = Parser
            , extension  = opts.get("extension", "js")
            )
            
        information = extractor.generate()
        
        information[PROJECT] = opts.get("project", None)
        information[VERSION] = opts.get("version", None)
        
        information[PROJECT_URL]   = opts.get("projectUrl", None)
        information[COPYRIGHT_TAG] = opts.get("copyrightTag", None)
        
        templatedirs = opts.get("templateDirs", [])
        defaultTemplates = os.path.join(here, "templates")
        if defaultTemplates not in templatedirs:
            templatedirs.insert(0, defaultTemplates)
        
        gen = Generator(
              tempdir  = opts.get("tempDir")
            , outDir   = opts.get("outDir")
            , assetDirs    = opts.get("assetDirs", None)
            , showPrivate  = opts.get("showPrivate", True)
            , templateDirs = templatedirs
            )
        
        gen.process(information)

    else:

        optparser.error("Incorrect number of arguments")
    
    return information

########################
###
###   EXECUTED AS SCRIPT
###
#######################

if __name__ == '__main__':
    from optparse import OptionParser
    optparser = OptionParser("usage: %prog inputdir [options] inputdir")
    optparser.set_defaults(
          outDir       = os.path.join(here, "docs")
        , tempDir      = os.path.join(here, "tmp")
        , project      = "Project"
        , version      = ""
        , extension    = ".js"
        , projectUrl   = "http://project.com"
        , showPrivate  = False
        , copyrightTag = "Copyright %d" % date.today().year
        )

    optparser.add_option(
        "-p", "--tempdir",
        action = "store", dest = "tempDir", type = "string",
        help   = "Directory to write the parser temp data"
    )

    optparser.add_option(
        "-o", "--outdir",
        action = "store", dest = "outDir", type = "string",
        help   = "Directory to write the html documentation"
    )

    optparser.add_option(
        "-t", "--template",
        action = "append", dest = "templateDirs", type = "string",
        help   = "A directory containing html tmplates"
    )

    optparser.add_option(
        "-a", "--asset",
        action = "append", dest = "assetDirs", type = "string",
        help   = "A directory containing assets"
    )

    optparser.add_option(
        "-C", "--copyright",
        action = "store", dest = "copyrightTag", type = "string",
        help   = "The name to use in the copyright line at the bottom of the pages."
    )

    optparser.add_option(
        "-s", "--showprivate",
        action = "store_true", dest = "showPrivate",
        help   = "Should private properties/methods be in the docs?"
    )

    optparser.add_option(
        "-e", "--extension",
        action = "store", dest = "extension", type = "string",
        help   = "The extension to parse"
    )

    optparser.add_option(
        "-m", "--project",
        action = "store", dest = "project", type = "string",
        help   = "The name of the project"
    )

    optparser.add_option(
        "-v", "--version",
        action = "store", dest = "version", type = "string",
        help   = "The version of the project"
    )

    optparser.add_option(
        "-u", "--projecturl",
        action = "store", dest = "projectUrl", type = "string",
        help   = "The project url"
    )

    (opts, inputdirs) = optparser.parse_args()

    main(inputdirs, opts)
