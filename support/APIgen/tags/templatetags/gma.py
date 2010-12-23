from django.template import Library, Node, TemplateSyntaxError
from django.template.defaultfilters import stringfilter
from django.utils.safestring import mark_safe
from django import template
import re

regexes = {
      'findSpace' : re.compile("^(\s*)([^$]+)$")
    , 'whitespace' : re.compile("^\s+$")
    }
    
register = template.Library()

@register.filter
def description(value):
    if type(value) in (list, tuple):
        value = '\n'.join(value)
    return mark_safe(value)

########################
###
###   UNDERLINE
###
########################

@register.tag
def underline(parser, token):
    nodelist = parser.parse(('endunderline',))
    parser.delete_first_token()
    bits = token.contents.split('"')
    if bits and len(bits) > 1:
        bit = bits[1]
    else:
        bit = '='
    return UnderlineNode(bit, nodelist)

class UnderlineNode(template.Node):
    def __init__(self, bit, nodelist):
        self.bit = bit
        self.nodelist = nodelist
        
    def render(self, context):
        output = self.nodelist.render(context).replace('\n', '').rstrip()
        m = regexes['findSpace'].match(output)
        space, line = m.groups()
        return mark_safe("%s\n%s" % (
            output, 
            '%s%s' % (
                ' ' * len(space), 
                self.bit * len(line)
            )
        ))

########################
###
###   INDENT
###
########################

@register.tag
def indent(parser, token):
    nodelist = parser.parse(('endindent', ))
    parser.delete_first_token()
    bits = token.contents.split('"')
    if bits and len(bits) > 1:
        start = bits[1]
    else:
        start = ''
    return IndentNode(start, nodelist)

class IndentNode(template.Node):
    def __init__(self, start, nodelist):
        self.start = start
        self.nodelist = nodelist
        
    def render(self, context):
        lines = self.nodelist.render(context).rstrip().split('\n')
        while lines:
            line = lines[0]
            if not line or regexes['whitespace'].match(line):
                lines.pop(0)
            else:
                break
        
        if lines:
            m = regexes['findSpace'].match(lines[0])
            space, firstLine = m.groups()
            start = ''
            if self.start:
                start = "%s " % self.start 
            joiner = '%s%s%%s' % (space, start)
            if len(lines) > 1:
                output = ['%s%s%s' % (space, start, lines[0].strip())]
                for line in lines[1:]:
                    stripped = line.strip()
                    if stripped and stripped[0] == '*':
                        output.append('%s%s' % (space, line))
                    else:
                        if not stripped:
                            output.append(space)
                        else:
                            output.append(joiner % line)
                        
                return  mark_safe('\n'.join(output))
            else:
                return mark_safe('%s%s' % (space, firstLine))
        else:
            return ""
