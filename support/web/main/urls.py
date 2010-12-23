from cwf.urls.sectionTypes import SectRootInclude

########################
###
###   INITIATE SECTION
###
########################
section = SectRootInclude(package=__package__, name='main')

########################
###   ADD PAGES
########################
section.addBase('', target='index')

section.addPage('jscoverage', target='jscoverage')

for testType in ('test', 'coverage'):
    gettingCoverage = testType == 'coverage'
    test = section.addSection(testType)
    test.addPage("all", target="allTests", extraContext={'gettingCoverage' : gettingCoverage})
    test.addPage("server", target="allTests", extraContext={'server' : True, 'gettingCoverage' : gettingCoverage})
    test.addPage(".+", match="path", target="test", extraContext={'gettingCoverage' : gettingCoverage})

section.addPage('rev', target='rev')

for t in ('view', 'compile', 'compiled'):
    next = section.addSection(t)
    next.addPage('.+', match="path", target=t)

########################
###
###   CREATE PATTERNS
###
########################

urlpatterns = section.getPatterns()
