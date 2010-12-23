/*global require, _, $ */
require.def('gma/events',
    ['gma/base'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides key event handling
         * @instantiated
         * @class keyHandler
        */
        gma.keyHandler = function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a dictionary of keycode : array
     * The array holds functions which are called when the corresponding keycode is triggered
     * @private
     * @property handlers
     * @type Dictionary
    */
    var handlers = {};
    
    /**
     * Determines what functions should be called when a keypress event is triggered
     * @param e {Event} The event that has been triggered
     * @method keyCheck
    */
    self.keyCheck = function(e) {
        var code = e.which || e.keyCode;
        
        if (handlers[code]) {
            _.each(handlers[code], function(func) {
                func(e);
            });
        }
    };
    
    //Make keyCheck get called whenever a key is pressed
    $(document).keydown(self.keyCheck);
    $(document).keyup(self.keyCheck);
    
    /**
     * Allows you to register a function to a keyCode
     * @param keyCode {Number or Character} The keycode that triggers this function
     * @param func {Function} Function to call when we have this event
     * @method register
    */
    self.register = function(keyCode, func) {
        if ((_.isString(keyCode) && keyCode.length > 1) || (!_.isString(keyCode) && !_.isNumber(keyCode))) {
            throw new Error("Can only register keycodes or characters");
        }
        
        if (_.isString(keyCode)) {
            keyCode = keyCode.charCodeAt(0);
        }
        
        if (!handlers[keyCode]) {
            handlers[keyCode] = [];
        }
        
        handlers[keyCode].push(func);
    };
    
    /**
     * Tells you how many functions you have registered for provided keyCode
     * If no keycode is given, then it tells you total functions you have registered
     * @param keyCode {Number or Character} The keycode you want to inspect
     * @method numEvents
    */
    self.numEvents = function(keyCode) {
        if (keyCode) {
            if (handlers[keyCode]) {
                return handlers[keyCode].length;
            }
            return 0;
        }
        else {
            return _.flatten(handlers).length;
        }
    };
    
    /**
     * Unregisters everything
     * @method reset
    */
    self.reset = function() {
        handlers = {};
    };
            
///////////////////////////////////////////////////////////////////////////////

            return self;
        
        }();
    }
);
