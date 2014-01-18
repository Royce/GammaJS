from sphinx.writers.html import SmartyPantsHTMLTranslator
from sphinx.builders.html import StandaloneHTMLBuilder
from sphinx.domains.std import StandardDomain
from sphinx.roles import XRefRole

from docutils import nodes, transforms
import os
    
class BaseRole(XRefRole):
    isFunction = False
        
    def process_link(self, env, refnode, has_explicit_title, title, target):
        if not has_explicit_title:
            title = title.lstrip('.')
            title = title[1:]
            dot = title.rfind('.')
            if dot != -1:
                title = title[dot+1:]
            
            #I dislike this for references
            #if self.isFunction:
            #    title = '%s()' % title
        
        parts = target.split('.')
        if len(parts) > 2:
            last = parts[-1]
            kls = '.'.join(parts[:-1])
            classes = env.jsapi['modules'][parts[0]]['classes']
            if kls in classes:
                kls = classes[kls]
            else:
                kls = '.'.join(parts[:-2])
                last = '.'.join(parts[-2:])
                if kls not in classes:
                    raise Exception, "Trying and failing to find kls '%s' from '%s'" % (kls, '.'.join(parts))
                kls = classes[kls]

            typ = 'property'
            if self.isFunction:
                typ = 'method'
            inherited = kls.findInherited(typ, last)
            if inherited:
                target = '%s.%s.%s' % (parts[0], inherited, last)
            
        return title, target
    
class MethodRole(BaseRole):
    isFunction = True
        
class PropertyRole(BaseRole): pass

def moreContext(app, pagename, templatename, context, doctree):
    def p(url):
        parts = pagename.split('/')[:-1]
        if len(parts) == 0:
            return url[1:]
        return os.path.relpath(url, '/%s' % '/'.join(parts))
    
    context['toplinks'] = [
          ('Overview', p('/index.html'), pagename=='index')
        , ('Tutorial', p('/intro/tutorials.html'),
            pagename.startswith("intro/tutorials")
            or pagename.startswith("tutorials"))
        , ('Topics', p('/topics/index.html'),
            pagename.startswith("topics/")
            or pagename.startswith("advanced/"))
        , ('API', p('/api/docs/gma.html'), pagename.startswith("api/docs/gma"))
        , ('Examples/Tests', 'http://example.gamma.delfick.com', pagename == '~')
        , ('Download', p('/intro/install.html'), pagename == 'intro/install')
    ]

def setup(app):
    app.add_crossref_type(
        directivename = "entity",
        rolename      = "entity",
        indextemplate = "pair: %s; entity",
    )
    
    app.add_crossref_type(
        directivename = "rhelper",
        rolename      = "rhelper",
        indextemplate = "pair: %s; Render Helper",
    )
    
    app.add_crossref_type(
        directivename = "api",
        rolename      = "api",
        indextemplate = "single: %s",
    )
    
    app.add_crossref_type(
        directivename = "constant",
        rolename      = "constant",
        indextemplate = "pair: %s; constant",
    )
    
    app.add_crossref_type(
        directivename = "metho",
        rolename      = "metho",
    )
    
    app.add_crossref_type(
        directivename = "prop",
        rolename      = "prop",
    )
    
    StandardDomain.roles["metho"] = MethodRole()
    StandardDomain.roles["prop"] = PropertyRole()
    
    
    app.add_builder(GMA_HTML_Builder)
    app.add_transform(SuppressBlockquotes)
    
    app.connect("html-page-context", moreContext)


class SuppressBlockquotes(transforms.Transform):
    """
    Remove the default blockquotes that encase indented list, tables, etc.
    """
    default_priority = 300

    suppress_blockquote_child_nodes = (
        nodes.bullet_list,
        nodes.enumerated_list,
        nodes.definition_list,
        nodes.literal_block,
        nodes.doctest_block,
        nodes.line_block,
        nodes.table
    )

    def apply(self):
        for node in self.document.traverse(nodes.block_quote):
            if len(node.children) == 1 and isinstance(node.children[0], self.suppress_blockquote_child_nodes):
                node.replace_self(node.children[0])

class GmaHTMLTranslator(SmartyPantsHTMLTranslator):
    """
    Django-specific reST to HTML tweaks.
    """
            
    # Don't use border=1, which docutils does by default.
    def visit_table(self, node):
        self.body.append(self.starttag(node, 'table', CLASS='docutils'))

    # <big>? Really?
    def visit_desc_parameterlist(self, node):
        self.body.append('(')
        self.first_param = 1

    def depart_desc_parameterlist(self, node):
        self.body.append(')')

    #
    # Don't apply smartypants to literal blocks
    #
    def visit_literal_block(self, node):
        self.no_smarty += 1
        SmartyPantsHTMLTranslator.visit_literal_block(self, node)

    def depart_literal_block(self, node):
        SmartyPantsHTMLTranslator.depart_literal_block(self, node)
        self.no_smarty -= 1

    # Give each section a unique ID -- nice for custom CSS hooks
    def visit_section(self, node):
        old_ids = node.get('ids', [])
        node['ids'] = ['s-' + i for i in old_ids]
        node['ids'].extend(old_ids)
        SmartyPantsHTMLTranslator.visit_section(self, node)
        node['ids'] = old_ids
        
class GMA_HTML_Builder(StandaloneHTMLBuilder):

    name = 'gmahtml'
    
    def write_genindex(self):
        # the total count of lines for each index letter, used to distribute
        # the entries into two columns
        genindex = self.env.create_index(self)

        for key, entries in genindex:
            for index, (name, (links, subitems)) in enumerate(entries):
                if len(subitems) == 1 and not links:
                    entries[index] = ('%s (%s)' % (name, subitems[0][0]), [subitems[0][1], []])

        indexcounts = []
        for _, entries in genindex:
            indexcounts.append(sum(1 + len(subitems)
                                   for _, (_, subitems) in entries))
        
        genindexcontext = dict(
            genindexentries = genindex,
            genindexcounts = indexcounts,
            split_index = self.config.html_split_index,
        )
        self.info(' genindex', nonl=1)
        #import pdb
        #pdb.set_trace()
        if self.config.html_split_index:
            self.handle_page('genindex', genindexcontext,
                             'genindex-split.html')
            self.handle_page('genindex-all', genindexcontext,
                             'genindex.html')
            
            for (key, entries), count in zip(genindex, indexcounts):
                ctx = {'key': key, 'entries': entries, 'count': count,
                       'genindexentries': genindex}
                self.handle_page('genindex-' + key, ctx,
                                 'genindex-single.html')
        else:
            self.handle_page('genindex', genindexcontext, 'genindex.html')
