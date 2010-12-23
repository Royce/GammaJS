#!/bin/sh
jsure $(find $GMA_SRC -name "*.js" | grep -v ".spec.js" | grep -v ".frag.js" | grep -v ".vert.js") -unused-ident-regexp __ $*
