#!/usr/bin/env python
"""Requires Paste and Werkzeug, use pip/easy_install to install::
$ pip Paste
$ pip Werkzeug
"""
import os
import sys

from werkzeug import run_simple, DebuggedApplication
from django.views import debug
from django.core.handlers.wsgi import WSGIHandler

def null_technical_500_response(request, exc_type, exc_value, tb):
    raise exc_type, exc_value, tb
debug.technical_500_response = null_technical_500_response

os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

from paste.debug.prints import PrintDebugMiddleware

app = WSGIHandler()
app = PrintDebugMiddleware(app)
app = DebuggedApplication(app, True)

if __name__ == '__main__':
    try:
        port = int(sys.argv[1])
    except (ValueError, IndexError):
        port = 8000
    run_simple('0.0.0.0', port, app, True)

