#########################
# settings.py

import os
import sys
PROJECTDIR = os.sep.join(__file__.split(os.sep)[:-1])
GMA = os.environ['GMA']
GMA_SRC = os.environ['GMA_SRC']
GMA_MEDIA = os.environ['GMA_MEDIA']
GMA_SUPPORT = os.environ['GMA_SUPPORT']

COLLADADIR = os.path.join(PROJECTDIR, 'collada')
BUILTDIR   = os.path.join(PROJECTDIR, 'built')

EXAMPLEDIR = os.path.join(GMA, 'examples')
SPIKEDIR   = os.path.join(GMA, 'spikes')
LIBDIR     = os.path.join(GMA, 'lib')
TESTS      = os.path.join(GMA, 'tests')
DOCS       = os.path.join(GMA, 'docs')

d = lambda p : os.path.join(PROJECTDIR, p)
MEDIADIR   = d('media')

sys.path.append(os.sep.join([PROJECTDIR, '..', 'lib']))

TEMPLATE_DEBUG = DEBUG = True

DATABASE_ENGINE = 'sqlite3'
DATABASE_NAME = 'info'
DATABASE_USER = 'user'
DATABASE_PASSWORD = 'user'
DATABASE_HOST = ''
DATABASE_PORT = ''
SECRET_KEY = '-k-a&lznb=4khjc6)m^+1py6dg3s70y0)n8nu=*2zbpv%z#*b2'

ROOT_URLCONF = 'urls'

########################
###
###   URLS
###
########################

MEDIA_ROOT = os.sep.join([PROJECTDIR, 'media'])
MEDIA_URL = '/wglemedia'

########################
###
###   RANDOM
###
########################

LANGUAGE_CODE = 'en-us'
SITE_ID = 1
TIME_ZONE = 'Australia/Perth'
EMAIL_PORT = 1025
ALLOWED_INCLUDE_ROOTS = (PROJECTDIR,)
LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/'
USE_I18N = False
INTERNAL_IPS = ('127.0.0.1', )
CACHE_BACKEND = 'dummy://'
APPEND_SLASH=False
CACHE_MIDDLEWARE_SECONDS = 1

########################
###
###   INCLUSIONS
###
########################

INSTALLED_APPS = (
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'cwf',
    'main',
)

TEMPLATE_CONTEXT_PROCESSORS = (
	'django.core.context_processors.auth',
	'django.core.context_processors.debug',
	'django.core.context_processors.i18n',
	'django.core.context_processors.media',
	'django.core.context_processors.request',
)

MIDDLEWARE_CLASSES = (
    'django.middleware.cache.UpdateCacheMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.middleware.cache.FetchFromCacheMiddleware',
    'main.builder.Build'
)

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'main.templates.load_template_source',
    'django.template.loaders.filesystem.load_template_source',
    'django.template.loaders.app_directories.load_template_source',
#   'django.template.loaders.eggs.load_template_source',
)


TEMPLATE_DIRS = (
	os.sep.join([PROJECTDIR, 'templates'])
)
