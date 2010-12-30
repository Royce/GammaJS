//#JSCOVERAGE_IF 0
/*global require, $, window, _, JSpec, console */
require.def('gma/base', 
    ['gma/constants', 'gma/convenience'], 
    function(constants) {
        var self = {};
        window.gma = self;
        self.constants = constants;
        
        /**
        * The gma namespace holds everything
        * @class gma 
        */

        /**
         * Object for logging stuff to
         * We use this so that we don't get errors when there is no console
         * @property logger
         * @default console
        */
        self.logger = console;

        /**
         * Inserts a javascript script tag into the document with the specified text
         * @method insertScript
         * @param string {String} text to put inside the new script tag
        */
        self.insertScript = function(string) {
            $("head").append("<script type='text/javascript'>"+string+"</script>");
        };

        /**
         * Inserts a javascript tag containing a preprocessed test
         * @method test
         * @param location {String} Location of the test to run
         * @param jingoName {String} Name to use in the jingo.declare block that is created around the test
        */
        self.test = function(location, requireName) {
            var raw = JSpec.load(location);
            if (requireName) {
                raw = raw.replace("require(", 'require.def("' + requireName + '", ');
            }

            self.insertScript(JSpec.preprocess(raw));
        };

        /**
         * Convenience function for examples to show some instruction text and be able to toggle it
         * @method instructions
         * @param hud {:api:`gma.hud`} Hud to display message with
         * @param msg {String} The message to display
         * @param key {Number} Key to use to toggle message
         * @param display {Boolean} Specify whether to display straight away
        */
        self.instructions = function(hud, msg, key, display, level) {
            if (display === undefined) {
                display = true;
            }
            
            if (display) {
                hud.displayMessage(msg)
            }
            
            if (key) {
                var infoToggle = function() {
                    var state = false;
                    return function(e, force) {
                        if (e.type==="keydown") {
                            if (force) {
                                state = true;
                            }
                            if (state) {
                                if (level === undefined || manager.levelIndex === level) {
                                    manager.hud.displayMessage(msg);
                                }
                                state = false;
                            }
                            else {
                                manager.hud.hideMessage();
                                state = true;
                            }
                        }
                    };
                }();
                
                gma.keyHandler.register(key, infoToggle);
            }
            return infoToggle;
        };
        
        
        return self;
    }
);
//#JSCOVERAGE_ENDIF
