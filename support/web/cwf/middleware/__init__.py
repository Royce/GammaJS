from utils.logger import tracer
class cwfMiddleWare(object):
	
	def process_view(self, request, view, args, kwargs):
		"""Use this if you have more than one site object, otherwise use settings.SITE"""
		if 'section' in kwargs:
			section = kwargs['section']
			kwargs['site'] = section.rootAncestor().site
			
			return view(request, *args, **kwargs)
		
		else:
			return None
