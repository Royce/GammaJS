/*global require, _, JSpec */
//#JSCOVERAGE_IF 0
require.def('gma/convenience',
    [],
    function(gma) {
        
///////////////////////////////////////////////////////////////////////////////
////// PROVIDES OVERIDES ON PROTOTYPES
// Some convenience methods borrowed from "JavaScript: The Good Parts"
// A book written by Douglas Crockford and published by O'Reilly Media

if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        var F = function () {};
        F.prototype = o;
        return new F();
    };
}

Function.prototype.method = function (name, func)
{
    this.prototype[name] = func;
    return this;
};

Function.method('bind',
    function (that)
    {
        // Return a function that will call this function as
        // though it is a method of that object.
        var slice  = Array.prototype.slice;
        var args   = slice.apply(arguments, [1]);
        var method = this;
        
        return function ( )
        {
            return method.apply(that,
                args.concat(slice.apply(arguments, [0]))
            );
        };
    }
);

Function.method('curry',
    function ( )
    {
        var that  = this;
        var slice = Array.prototype.slice;
        var args  = slice.apply(arguments);
        
        return function ( )
        {
            return that.apply(null, args.concat(slice.apply(arguments)));
        };
    }
);

Object.method('superior',
    function (name)
    {
        var that = this;
        var method = that[name];
        return function()
        {
            return method.apply(that, arguments);
        };
    }
);

RegExp.method('test',
    function (string)
    {
        return this.exec(string) !== null;
    }
);

Number.method('integer',
    function ( )
    {
        return Math[this < 0 ? 'ceil' : 'floor'](this);
    }
);


String.method('charAt',
    function (pos)
    {
        return this.slice(pos, pos + 1);
    }
);

String.method('trim',
    function ( )
    {
        return this.replace(/^\s+|\s+$/g, '');
    }
);


String.method('entityify',
    function ( )
    {
        var character = {
            '<' : '&lt;',
            '>' : '&gt;',
            '&' : '&amp;',
            '"' : '&quot;'
        };
        
        return function ( )
        {
            return this.replace(/[<>&"]/g,
                function (c)
                {
                    return character[c];
                }
            );
        };
    }( )
);

String.method('deentityify',
    function ( )
    {
        var entity = {
            quot: '"',
            lt:   '<',
            gt:   '>'
        };
        
        return function ( )
        {
            return this.replace(/&([^&;]+);/g,
                function (a, b)
                {
                    var r = entity[b];
                    return typeof r === 'string' ? r : a;
                }
            );
        };
    }()
);

Array.method('pop',
    function ( )
    {
        return this.splice(this.length - 1, 1)[0];
    }
);

Array.method('push',
    function ( )
    {
        this.splice.apply(
            this,
            [this.length, 0].concat(Array.prototype.slice.apply(arguments))
        );
        return this.length;
    }
);

Array.method('shift',
    function ()
    {
        return this.splice(0, 1)[0];
    }
);

Array.method('unshift',
    function ( )
    {
        this.splice.apply(this,
            [0, 0].concat(Array.prototype.slice.apply(arguments))
        );
        return this.length;
    }
);

Array.method('splice',
    function (start, deleteCount)
    {
    
        var delta;
        var element;
        var newLen;
        var shiftCount;
        
        var k           = 0;
        var max         = Math.max;
        var min         = Math.min;
        var len         = this.length;
        var result      = [];
        var insertCount = max(arguments.length - 2, 0);
        
        start = start || 0;
        if (start < 0) {
            start += len;
        }
        start = max(min(start, len), 0);
        
        deleteCount = max(
            min(
                typeof deleteCount === 'number' ? deleteCount : len, len - start
            ), 0
        );
        
        delta = insertCount - deleteCount;
        newLen = len + delta;
        
        while (k < deleteCount)
        {
            element = this[start + k];
            if (element !== undefined)
            {
                result[k] = element;
            }
            k += 1;
        }
        
        shiftCount = len - start - deleteCount;
        
        if (delta < 0)
        {
            k = start + insertCount;
            while (shiftCount)
            {
                this[k] = this[k - delta];
                k += 1;
                shiftCount -= 1;
            }
            this.length = newLen;
        }
        else if (delta > 0)
        {
            k = 1;
            while (shiftCount)
            {
                this[newLen - k] = this[len - k];
                k += 1;
                shiftCount -= 1;
            }
        }
        
        for (k = 0; k < insertCount; k += 1)
        {
            this[start + k] = arguments[k + 2];
        }
        
        return result;
    }
);

///////////////////////////////////////////////////////////////////////////////

    }
);
//#JSCOVERAGE_ENDIF
