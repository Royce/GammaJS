/*global require, _ */
require.def('gma/entities/shapes',
    ['gma/base', 'gma/entities/base'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides shape factories
         * @instantiated
         * @class shapes
        */
        gma.shapes = function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////

/**
 * Provides a rectangle factory
 * Accepts an object that has enough information to specify a rectangle
 * Precedence of information is as follows :
 * 
 * * points
 * * width and height
 * * centre
 * * top, left, right, bottom
 * 
 * If there isn't enough information or it's invalid, then undefined is returned
 * @method rectangle
 * @param opts {config}
 * @return {gma.shapes.rectangle or undefined}
*/
self.rectangle = self.rectangle || function(opts) {
    if (opts.centre === undefined && (opts.x !== undefined && opts.y !== undefined)) {
        opts.centre = [opts.x, opts.y];
    }
    
    if (opts.points === null) {
        opts.points = undefined;
    }
    
    if (opts.points !== undefined) {
        //four points
        opts.top    = undefined;
        opts.left   = undefined;
        opts.right  = undefined;
        opts.bottom = undefined;
        
        if (opts.points.length >= 2) {
            _.each(opts.points, function(point) {
                var x = point[0];
                var y = point[1];
                if (opts.left === undefined || opts.left > x) {
                    if (opts.left !== undefined && (opts.right === undefined || opts.right < opts.left)) {
                        opts.right = opts.left;
                    }
                    opts.left = x;
                }
                else if (opts.right === undefined || opts.right < x) {
                    opts.right = x;
                }
                
                if (opts.top === undefined || opts.top < y) {
                    if (opts.top !== undefined && (opts.bottom === undefined || opts.top < opts.bottom)) {
                        opts.bottom = opts.top;
                    }
                    opts.top = y;
                    
                }
                else if (opts.bottom === undefined || opts.bottom > y) {
                    opts.bottom = y;
                }
                
            });
            
            if (opts.left === opts.right || opts.top === opts.bottom) {
                opts.top    = undefined;
                opts.left   = undefined;
                opts.right  = undefined;
                opts.bottom = undefined;
            }
            else {
                opts.width = opts.right - opts.left;
                opts.height = opts.top - opts.bottom;
            }
        }
        else {
            opts.points = undefined;
        }
        
    }
    
    if (opts.points === undefined) {

        if (opts.width !== undefined && opts.height !== undefined) {
            if (opts.top !== undefined && opts.bottom !== undefined) {
                if (opts.top - opts.bottom !== opts.height) {
                    opts.top = undefined;
                    opts.bottom = undefined;
                }
            }
            if (opts.left !== undefined && opts.right !== undefined) {
                if (opts.right - opts.left !== opts.width) {
                    opts.right = undefined;
                    opts.left = undefined;
                }
            }
            if (opts.width > 0 && opts.height > 0) {
                if (opts.centre) {
                    //width and height + centre
                    opts.top = opts.centre[1] + opts.height / 2;
                    opts.bottom = opts.centre[1] - opts.height / 2;
            
                    opts.left = opts.centre[0] - opts.width / 2;
                    opts.right = opts.centre[0] + opts.width / 2;
            
                }
                else {
                    //width and height + top or bottom + left or right
                    if (opts.top !== undefined) {
                        opts.bottom = opts.top - opts.height;
                    }
                    else if (opts.bottom !== undefined) {
                        opts.top = opts.bottom + opts.height;
                    }
                    else if (opts.y !== undefined) {
                        opts.bottom = opts.y - opts.height/2;
                        opts.top = opts.y + opts.height/2;
                    }
            
                    if (opts.left !== undefined) {
                        opts.right = opts.left + opts.width;
                    }
                    else if (opts.right !== undefined) {
                        opts.left = opts.right - opts.width;
                    }
                    else if (opts.x !== undefined) {
                        opts.left = opts.x - opts.width/2;
                        opts.right = opts.x + opts.width/2;
                    }
                }
            }
            //otherwise shape is invalid
        
        } else if (opts.width !== undefined && opts.width > 0) {
            //top and bottom + left or right + width
            if (opts.left !== undefined && opts.right !== undefined) {
                if (opts.right - opts.left !== opts.width) {
                    opts.right = undefined;
                    opts.left = undefined;
                }
            }
            else if (opts.top !== undefined && opts.bottom !== undefined) {
                //Either left or right is undefined at this point
                if (opts.left !== undefined) {
                    opts.right = opts.left + opts.width;
                }
                else if (opts.right !== undefined) {
                    opts.left = opts.right - opts.width;
                }
                else if (opts.x !== undefined) {
                    opts.left = opts.x - opts.width/2;
                    opts.right = opts.x + opts.width/2;
                }
            }
            opts.height = opts.top - opts.bottom;
        }
        else if (opts.height !== undefined && opts.height > 0) {
            //left and right + top or bottom + height
            if (opts.top !== undefined && opts.bottom !== undefined) {
                if (opts.top - opts.bottom !== opts.height) {
                    opts.top = undefined;
                    opts.bottom = undefined;
                }
            }
            else if (opts.right !== undefined && opts.left !== undefined) {
                //Either top or bottom is undefined at this point
                if (opts.top !== undefined) {
                    opts.bottom = opts.top - opts.height;
                }
                else if (opts.bottom !== undefined) {
                    opts.top = opts.bottom + opts.height;
                }
                else if (opts.y !== undefined) {
                    opts.top = opts.y + opts.height/2;
                    opts.bottom = opts.y - opts.height/2;
                }
            }
            opts.width = opts.right - opts.left;
        }
        else {
            opts.width = opts.right - opts.left;
            opts.height = opts.top - opts.bottom;
        }
    }
    
    if (
            opts.top    !== undefined &&
            opts.left   !== undefined &&
            opts.right  !== undefined &&
            opts.bottom !== undefined
        ) {

/**
 * Represents a rectangle
 * @class shapes.rectangle
*/

/**
 * List of points that makes up the rectangle
 * @property points
 * @type [many [x, y]]
*/

/**
 * List of edges that makes up the rectangle
 * @property edges
 * @type [many [x1, y1, x2, y2]]
*/

/**
 * The width of the rectangle
 * @property width
 * @type Number
*/

/**
 * The height of the rectangle
 * @property height
 * @type Number
*/

/**
 * The depth of the rectangle
 * @property depth
 * @type Number
*/

/**
 * The z co-ordinate of the rectangle's centre
 * @property z
 * @type Number
*/

/**
 * The x co-ordinate of the rectangle's centre
 * @property x
 * @type Number
*/

/**
 * The y co-ordinate of the rectangle's centre
 * @property y
 * @type Number
*/

/**
 * List representing the rectangle's centre
 * @property centre
 * @type [self.x, self.y]
*/

/**
 * The x co-ordinate of the left of the rectangle
 * @property left
 * @type Number
*/

/**
 * The x co-ordinate of the right of the rectangle
 * @property right
 * @type Number
*/

/**
 * The y co-ordinate of the top of the rectangle
 * @property top
 * @type Number
*/

/**
 * The bottom co-ordinate of the bottom of the rectangle
 * @property bottom
 * @type Number
*/

/**
 * Amount to offset model in y axis when rendering it
 * @property yOffset
 * @type Number
*/

/**
 * Amount to offset model in x axis when rendering it
 * @property xOffset
 * @type Number
*/

/**
 * Dictionary containing keys for each type the object is
 * @property type
 * @type Dictionary
*/

/**
 * Flag representing the alive/dead status
 * @property alive
 * @type Boolean
 * @default true
*/

/**
 * Flag representing the solid-ness
 * @property solid
 * @type Boolean
 * @default true
*/

/**
 * Hash containing tags
 * This should be specified as an array of strings, if at all.
 * Then each string in the list will be set to true in the resulting hash
 * @property tags
 * @type Object
 * @default {shapes : true}
*/

        opts.alive = opts.alive || true;
        
        opts.z = opts.z || 0;
        opts.depth = opts.depth || 1;
    
        //Can't use usual = thing || default because it could be false :(
        if (opts.solid === undefined) {
            opts.solid = true;
        }
        
        var tags = {};
        if (_.isArray(opts.tags)) {
            _.each(opts.tags, function(tag) {
                tags[tag] = true;
            });
        }
        opts.tags = tags;
        /** @tag shape */
        opts.tags.shape = true;
        
        if (opts.x === undefined || opts.y === undefined ) {
            opts.x = opts.left + opts.width / 2;
            opts.y = opts.bottom + opts.height / 2;
        }
        
        opts.xOffset = opts.xOffset || 0;
        opts.yOffset = opts.yOffset || 0;
        
        /**
         * Function to reset the rectangle's points and edges
         * @method setPointsAndEdges
        */
        opts.setPointsAndEdges = opts.setPointsAndEdges || function() {

            opts.points = [
                [opts.left,  opts.bottom],  // bottom left  -- 0
                [opts.right, opts.bottom],  // bottom right -- 1
                [opts.right, opts.top],     // top right    -- 2
                [opts.left,  opts.top]      // top left     -- 3
            ];
            
            opts.edges = {};
            opts.edges[gma.constants.BOTTOM] =  [opts.points[0], opts.points[1]];
            opts.edges[gma.constants.RIGHT]  =  [opts.points[1], opts.points[2]];
            opts.edges[gma.constants.TOP]    =  [opts.points[2], opts.points[3]];
            opts.edges[gma.constants.LEFT]   =  [opts.points[3], opts.points[0]];
        };
        
        /**
         * Function to reset the rectangle's points and edges
         * @param centre {[x, y]}
         * @method setCentre
        */
        opts.setCentre = opts.setCentre || function(centre) {
            opts.centre = centre;
            
            opts.x = centre[0];
            opts.left = opts.x - opts.width/2;
            opts.right = opts.x + opts.width/2;
            
            opts.y = centre[1];
            opts.top = opts.y + opts.height/2;
            opts.bottom = opts.y - opts.height/2;
            
            opts.setPointsAndEdges();
        };
        
        /**
         * Function to reset the rectangle's points and edges
         * @param bl {[x, y]} Co-ordinates you want to move the bottom left corner of the entity to
         * @method setBottomLeft
        */
        opts.setBottomLeft = opts.setBottomLeft || function(bl) {
            opts.left = bl[0];
            opts.bottom = bl[1];
            
            opts.right = opts.left + opts.width;
            opts.top = opts.bottom + opts.height;
            
            opts.x = opts.left + (opts.width / 2);
            opts.y = opts.bottom + (opts.height/2);
            
            opts.setPointsAndEdges();
        };
        
        /**
         * Determines the x coordinate of the side specified
         * @method xOf
         * @param side {:constant:`LEFT` or :constant:`RIGHT` or null}
         * @return {Number}
        */
        opts.xOf = function(side) {
            if (side === gma.constants.LEFT) {
                return opts.left;
            }
            else if (side === gma.constants.RIGHT) {
                return opts.right;
            }
            else {
                return null;
            }
        };
        
        /**
         * Determines the y coordinate of the side specified
         * @method yOf
         * @param side {:constant:`TOP` or :constant:`BOTTOM` or null}
         * @return {Number}
        */
        opts.yOf = function(side) {
            if (side === gma.constants.TOP) {
                return opts.top;
            }
            else if (side === gma.constants.BOTTOM) {
                return opts.bottom;
            }
            else {
                return null;
            }
        };
        
        /**
         * Returns information about rectangle as a string
         * @method toString
         * @return {String}
        */
        opts.toString = function() {
            return "y:" + opts.y +
            " x:" + opts.x +
            " t:" + opts.top +
            " b:" + opts.bottom +
            " l:" + opts.left +
            " r:" + opts.right +
            " w:" + opts.width +
            " h:" + opts.height;
        };
        
        /**
         * Hook for when a collision with something occurs
         * @method collided
         * @param where       {:api:`gma.constant`} Side of this object that was collided with 
         * @param focus       {object} Thing we collided with
         * @param focusSide   {:api:`gma.constant`} Side of the focus object that was collided with
         * @param focusVector {[x,y]} Amount focus is trying to move
        */
        opts.collided = self.collided || function(where, focus, focusSide, focusVector) {
            // No default behaviour
        };
        

        /**
         * Hook for when a collision with something occurs when we have deathtouch
         * @method collided__deathtouch
         * @copy collided
        */
        opts.collided__deathtouch = self.collided__deathtouch || function(w, focus, fs, fv) {
            if (focus.tags.character) {
                focus.kill();
            }
        };
        
        opts.setPointsAndEdges();
        
        return opts;
    }
    

    //else return nothing cause it ain't valid
};

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        }();
    }
);
