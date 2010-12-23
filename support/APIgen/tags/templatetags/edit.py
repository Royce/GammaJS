from django.utils.safestring import mark_safe, SafeUnicode
from django.template import Node
from django import template
import re

register = template.Library()

regexes = {
      'findSpace' : re.compile("^(\s*)([^$]+)$")
    , 'whitespace' : re.compile("^\s+$")
    }

def resolveVar(context, var):
    if var is not None:
        variable = template.Variable(var)
        try:
            actualVar = variable.resolve(context)
            exists = True
        except template.VariableDoesNotExist:
            actualVar = var
            exists = False
    
    return actualVar, exists
        
########################
###
###   EDITOR
###
########################

class Editor(object):
    def __init__(self):
        self.stacks = [[]]
        self.currentStack = 0
        self.changes = []
    
    def newStack(self, value=None):
        if self.stack():
            self.stacks.append([])
            self.currentStack += 1
        
        if value:
            self.stack().append(value)
    
    def removeStack(self):
        if len(self.stacks) > 1:
            self.stacks.pop()
            self.currentStack -= 1
    
    def stack(self, index=None):
        if not index:
            index = self.currentStack
        return self.stacks[self.currentStack]
    
        editor = context.get('editor')
        
    def push(self, value):
        if type(value) in (str, unicode):
            self.stack().append(value)
        else:
            self.newStack(value)
    
    def pop(self):
        stack = self.stack()
        stack.pop()
        if len(stack) == 0:
            self.removeStack()
    
    def editWith(self, value):
        base, prop, default = self.resolve()
        self.changes.append((base, prop, default, value))
    
    def resolve(self, stack=None, index=None):
        if not stack:
            stack = self.stack(index)
            
        base = stack[0]
        prop = None
        original = None
        
        if len(stack) > 1:
            for prop in stack[1:-1]:
                base = base[prop]
            
            prop = stack[-1]
            original = base[prop]
        
        return (base, prop, original)
    
    def change(self):
        for base, prop, _, value in self.changes:
            if prop is not None and value is not None:
                print "Changing %s[%s] to '%s'" % (base, prop, value)
                base[prop] = value
    
    def revert(self):
        for base, prop, default, _ in self.changes:
            if prop is not None and default is not None:
                base[prop] = default
        
########################
###
###   TAGS
###
########################

@register.tag
def edit(parser, token):
    nodelist = parser.parse(('endedit',))
    parser.delete_first_token()
    bits = token.contents.split(' ')
    if bits and len(bits) > 1:
        bit = bits[1]
    return EditNode(nodelist=nodelist, bit=bit)

@register.tag
def edit_change(parser, token):
    return EditNode(change=True)

@register.tag
def edit_revert(parser, token):
    return EditNode(revert=True)

class EditNode(Node):
    def __init__(self, bit=None, nodelist=None, change=False, revert=False):
        self.bit = bit
        self.nodelist = nodelist
        self.change = change
        self.revert = revert
        
    def render(self, context):
        if 'editor' not in context.dicts[0]:
            context.dicts[0]['editor'] = Editor()
        editor = context.get('editor')
        
        if self.change:
            editor.change()
            return ""
        
        if self.revert:
            editor.revert()
            return ""
        
        variable, _ = resolveVar(context, self.bit)
        if type(variable) is SafeUnicode:
            variable = unicode(variable)
        editor.push(variable)
        
        output = self.nodelist.render(context).strip().split('\n')
        for index, line in enumerate(output):
            output[index] = line.strip()
        
        output = '\n'.join(output)
        if regexes['whitespace'].match(output):
            output = ""
            
        if output:
            editor.editWith(output)
        editor.pop()
        return ""
