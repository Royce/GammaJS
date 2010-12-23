from APIgen.main import main as genApi

import subprocess
import os

def runBash(cmd):
	"""Runs a bash command and returns the output"""
	process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE)
	out = process.stdout.read().strip()
	return out

def createAPI(app):
    buildir = app.env.srcdir
    outdir = os.path.join(buildir, os.sep.join(["_temp", "jsapi", "docs"]))
    resultdir = os.path.join(buildir, "api")
    tempdir = os.path.join(buildir, os.sep.join(["_temp", "jsapi", "temp"]))
    templatedirs = [os.path.join(buildir, "_templates")]
    
    for path in (outdir, resultdir, tempdir) + tuple(templatedirs):
        if not os.path.exists(path):
            os.makedirs(path)
    
    information = genApi(os.environ['GMA_SRC'], outDir=outdir, tempDir=tempdir, templateDirs=templatedirs)
    
    app.jsapi = information
    rsync = "rsync %s %s -r --delete -c" % (outdir, resultdir)
    print runBash(rsync)

def removeInfo(app, doctree):
    app.env.jsapi = None

def addInfo(app, env, docname):
    app.env.jsapi = app.jsapi
    
def setup(app):
    app.connect('builder-inited', createAPI)
    app.connect('doctree-read', removeInfo)
    app.connect("env-purge-doc", addInfo)
