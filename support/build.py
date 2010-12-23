import subprocess
import os

def runBash(cmd):
    process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE)
    out = process.stdout.read().strip()
    return out

def findJS(base):
    for path, dirs, files in os.walk(base):   
        if 'spec' in dirs:
            specAt = dirs.index('spec')
            del dirs[specAt]
                   
        for f in files:
            if f.endswith(".js") and not f.endswith("_spec.js"):
                p = path[len(base)+1:]
                yield os.path.join(p, f[:f.find('.js')].replace('.', '/'))

template = """
{
    baseUrl: "../",
    appDir: "%(appDir)s",
    optimize: "closure",
    dir: "%(dir)s",
    paths: {
        "lib": "%(lib)s",
        "glge": "%(lib)s/glge",
        "compiled": "%(lib)s/compiled"
    },
    modules: [
        {   
            name: 'compiled/libs',
            include: [
                "lib/jquery-1.4.2",
                "lib/underscore",
                
                "glge/glge_math",
                "glge/glge",
                "glge/glge_input",
                "glge/glge_collada"
            ]
        },
        {
            name: "compiled/gma",
            includeRequire: true,
            include: [
                "compiled/libs",
                %(modules)s
            ]
        }
    ]
    
}
"""
if __name__ == '__main__':
    SUPPORT = os.environ['GMA_SUPPORT']
    
    baseUrl = os.environ['GMA_SRC']
    outDir = '%s/built' % os.environ['GMA']
    modules = [f for f in findJS(baseUrl)]
    if not os.path.exists(outDir):
        os.makedirs(outDir)
        
    contents = template % {
        'appDir' : baseUrl,
        'dir' : outDir,
        'lib' : '%s/lib' % SUPPORT,
        'modules' : ', '.join('\n            "gma/%s"' % n for n in modules)
    }
    buildSpec = '%s/app-build.js' % os.environ['GMA']
    f = open(buildSpec, 'w')
    f.write(contents)
    f.close()
    
    builder = '%s/build/build.sh' % os.environ['REQUIRE']
    command = '%s %s' % (builder, buildSpec)
    print runBash(command)
    
    command = 'java -jar "%(compiler)s" --js "%(input)s" --js_output_file "%(output)s"' % {
        'compiler' : '%s/build/lib/closure/compiler.jar' % os.environ['REQUIRE'],
        'input' : '%s/lib/compiled/gma.js' % SUPPORT,
        'output' : '%s/lib/compiled/gma-min.js' % SUPPORT
    }
    print command
    print runBash(command)
