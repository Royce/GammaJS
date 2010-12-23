#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import os

sys.path.append(os.environ['GMA_SUPPORT'])
    
if __name__ == '__main__':
    from sphinx import main
    sys.exit(main(sys.argv))
