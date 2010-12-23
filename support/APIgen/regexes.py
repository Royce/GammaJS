import re

########################
###
###   REGEXES
###
########################

regexes = {'' : ''

    # pulls out the first word of the description parsed by compound: foo, a foo
    , 'param'    : re.compile('^\s*?([^\s]+)(.*)', re.S)

    # guess the name and type of a block based upon the code following it
    , 'guess'    : re.compile('\s*?(var|function)?\s*?(\w+)\s*?[=:]\s*?(function)?.*', re.S)

    # extract regex literals in case they contain the doc comment pattern
    , 'regex'    : re.compile(r'(\/[^\s\/\*][^\n]*\/)')
    
    # extract string literals in case they contain the doc comment pattern
    , 'literals' : re.compile(r'(\'.*?(?<=[^\\])\')|(\".*?(?<=[^\\])\")')
    
    # the pattern to restore the string literals
    , 'restore'  : re.compile('~~~(\d+)~~~')
    
    # the pattern for extracting a documentation block and the next line
    , 'docBlock' : re.compile('(/\*\*)(.*?)(\*/)([\s\n]*[^\/\n]*)?|(".*?")', re.S)

    # the pattern used to split a comment block to create our token stream
    # this will currently break if there are ampersands in the comments if there
    # is a space before it
    , 'tokenize'    : re.compile('^\s?(@\w\w*)', re.M)
    
    # after extracting the comment, fix it up (remove *s and leading spaces)
    , 'blockFilter' : re.compile('^\s*\* ', re.M)

    # separates compound descriptions: @param foo {int} a foo -> int, foo a foo
    # also:                            @param {int} foo a foo -> int, foo a foo
    , 'compound'    : re.compile('^\s*?(.*?)\{(.*)\}(.*)|^\s*?(\w+)(.*)', re.S)
    
    }
