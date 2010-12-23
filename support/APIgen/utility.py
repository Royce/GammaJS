from const import *
import codecs
import os

########################
###
###   UTILITY
###
########################

def cleanstr(s):
    regex    = re.compile(r"[^\w\-]")
    cleansed = regex.sub('', s.lower())
    return "%s%s" % (MODULE_PREFIX, cleansed)

def mkdir(newdir):
    if os.path.isfile(newdir):
        raise OSError("A file with the same name as the desired dir, '%s', already exists." % newdir)
    else:
        if not os.path.exists(newdir):
            os.makedirs(newdir)

def getFileContent(path, fileName, base):
    f = codecs.open(os.path.join(path, fileName), "r", "utf-8" )
    
    # add a file marker token so the parser can keep track of what is in what file
    name = os.path.join(path, fileName)[len(base):]
    if name.startswith('/'):
        name = name[1:]
        
    content = "\n/** @%s %s \n*/\n" % (FILE_MARKER, name)

    return "%s\n%s" % (content, f.read())

def getDirContent(path, extension_check, base=None, names=None):
    if base is None:
        base = path
        
    if names is None:
        names = []
    subdirs    = []
    dirfiles   = sorted(f for f in os.listdir(path) if not f.startswith('.'))
    dircontent = []
    
    for f in dirfiles:
        if not IGNORE_REGEX.match(f):
            fullname = os.path.join(path, f)
            if fullname not in names:
                names.append(fullname)
                if os.path.isdir(fullname):
                    subdirs.append(fullname)
                else:
                    for ext in extension_check:
                        if f.lower().endswith(ext) and not f.lower().endswith('_spec.js'):
                            dircontent.append(getFileContent(path, f, base))

    for p in subdirs:
        dircontent.append(getDirContent(p, extension_check, base, names))

    return '\n'.join(dircontent)
