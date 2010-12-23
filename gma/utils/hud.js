/*global require, $, _ */
require.def('gma/utils/hud',
    ['gma/base', 'gma/utils/base'],
    function(gma) {
    
        /** @module gma */
        
        /**
         * Provides HUD functionality
         * @class hud
        */
        gma.hud = function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////

    //Holds the information that specifies what goes in the HUD
    var positions = [];
    
    /**
    * Creates the necessary HTML elements that form the hud
    * It will also store this on self and inside positions
    * @param spec {Object} Specifies what displays where on the HUD
    * @method setup
    */
    self.setup = self.setup || function(spec) {        
        if (!self.canvasContainer) {
            throw new Error("HUD needs a canvas container");
        }
        
        self.reset();
        if (spec) {
            _.each(spec, function(list, position) {
                var arr = position.split('_');
                self[position] = self.createSection.apply(this, arr);
                var $container = self[position];
                $container.functions = [];
                self.fillSection($container, list);
                
                positions.push(position);
            });
        }
    };
    
    /**
    * Return a dl element inside a div element
    * Both of these elements are created if they don't already exist
    * The div element will have a particular id
    * The dl element will have a particular class
    * Both id/class are found with (and created on) using those passed into the function
    * @param divID {String} The id of the div element
    * @param dlClass {String} The class of the dl element
    * @method createSection
    * @return {The created/found dl element}
    */
    self.createSection = self.createSection || function(divID, dlClass) {
        var $div = $(self.canvasContainer).find("#" + divID + '_hud');        
        if ($div.length === 0) {
            // Div doesn't exist, so let's create one
            $div = $('<div id="' + divID + '_hud"></div>');
            $div.appendTo($(self.canvasContainer));
        }
        
        var $dl = $div.find("." + dlClass).first();
        if ($dl.length === 0) {
            //dl doesn't exist, so let's create one and add it to the div
            $dl = $('<dl class="' + dlClass + '"></dl>');
            $dl.appendTo($div);
        }
        
        return $dl;
    };
    
    /**
    * Fills some element (suggested to be a dl) with dt and dd elements
    * It will prepend each element's label with "hud\_" and convert to lowercase to form the id for each dt
    * And insert the lable inside a span element inside the dt
    * It will then use the the value for the label as the value for the dd,
    * or if the value is a function, then using the result of calling that function as the value inside the dd
    * This function will then register this function to this particular dt for updating at a later stage
    * @param $container {HTML Element} The container to add the dt and dd elements to
    * @param items {Dictionary} Dictionary of label:value to put into the $container
    * @method fillSection
    */
    self.fillSection = self.fillSection || function($container, items) {
        _.each(items, function(value, label) {
            var dtId = "hud_" + label.toLowerCase();
            var dt = $container.find("dt#" + dtId);
            if (dt.length === 0) {
                $container.append('<dt id="' + dtId + '"></dt>');
            }
            
            dt = $container.find("dt#" + dtId);
            if (dt.find("span").length === 0) {
                dt.append("<span>" + label + "</span");
            }
            
            var $temp;
            if (_.isFunction(value)) {
                $temp = $('<dd>' + value() + '</dd>');
                if (!_.isArray($container.functions)) {
                    $container.functions = [];
                }
                $container.functions.push([$temp, value]);
            }
            else {
                $temp = $('<dd>' + value + '</dd>');
            }
            $temp.appendTo($container);
        });
    };
    
    /**
    * Ensures the canvasContainer is empty
    * @method reset
    */
    self.reset = self.reset || function() {
        $(self.canvasContainer).find("div[id$='_hud']").remove();
        _.each(positions, function(position) {
            self[position] = undefined;
        });
        positions = [];
    };
    
    /**
    * Fills out HUD information using the functions provided to setup
    * @method refresh
    */
    self.refresh = self.refresh || function() {
        _.each(positions, function(position) {
            _.each(self[position].functions, function(arr) {
                arr[0].text(arr[1]());
            });
        });
    };

    /**
    * Hides the HTML elements that makes up the HUD
    * Optionally, you can hide just a particular part of the HUD
    * @param position {String} Particular part of the HUD you want to hide
    * @method hide
    */
    self.hide = self.hide || function(position) {
        if (position !== undefined) {
            if (position.indexOf('_') === -1) {
                $(self.canvasContainer).find("#" + position + '_hud').first().hide();
                $(self.canvasContainer).find("#" + position + '_hud').find('dl').hide();
            }
            else {
                self[position].hide();
                var parent = self[position].parent()
                var hideParent = _.all(parent.children(), function(child) {
                    return $(child).css('display') === 'none'
                });
                
                if (hideParent) {
                    parent.hide();
                }
            }
        }
        else {
            // No position specified, hide them all
            $(self.canvasContainer).find("div[id$='_hud']").hide();
            $(self.canvasContainer).find("div[id$='_hud'] dl").hide();
        }
    };
    
    /**
    * Shows the HTML elements that makes up the HUD
    * Optionally, you can show just a particular part of the HUD
    * @param position {String} Particular part of the HUD you want to show
    * @method show
    */
    self.show = self.show || function(position) {
        if (position !== undefined) {
            if (position.indexOf('_') === -1) {
                $(self.canvasContainer).find("#" + position + '_hud').first().show();
                $(self.canvasContainer).find("#" + position + '_hud').find('dl').show();
            }
            else {
                self[position].show();
                self[position].parent().show();
            }
        }
        else {
            $(self.canvasContainer).find("div[id$='_hud']").show();
            $(self.canvasContainer).find("div[id$='_hud'] dl").show();
        }
    };
    
    
    /**######################
    ###
    ###   MESSAGES
    ###
    ######################*/
    
    
    /**
    * Hides the HTML elements that makes up the HUD
    * Optionally, you can hide just a particular part of the HUD
    * It will use a div with id of "message" to display the message in
    * @param msg {String} The message to display
    * @param wait {Number} The amount to wait before automatically hiding the message
    * @param callBack {Function} Optional function that is executed either immediately or when the timeout has finished
    * @method displayMessage
    */
    self.displayMessage = self.displayMessage || function(msg, wait, callBack) {
        var $messageDiv = $(self.canvasContainer).find("div#message");
        if ($messageDiv.length === 0) {
            $messageDiv = $("<div id='message'></div>");
            $(self.canvasContainer).append($messageDiv);
        }
        else {
            $messageDiv = $messageDiv.first();
        }
        
        $messageDiv.html(msg);
        $messageDiv.show();
        
        if (_.isNumber(wait)) {
            //Apparently, have to do this for callBack to be in the closure
            var cb = callBack;
            var afterTimeout = function() {
                self.hideMessage();
                if (_.isFunction(cb)) {
                    cb();
                }
            };
            setTimeout(afterTimeout, wait);
        }
        else if (_.isFunction(callBack)) {
            // No timeout, just call the callback
            callBack();
        }
    };
    
    /**
    * Hides the message div (div with id "message")
    * @method hideMessage
    */
    self.hideMessage = self.hideMessage || function() {
        var $messageDiv = $(self.canvasContainer).find("div#message");
        if ($messageDiv.length !== 0) {
            $messageDiv = $messageDiv.first().hide();
        }
    };
    
///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
