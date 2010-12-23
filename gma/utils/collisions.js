/*global require, _ */
require.def('gma/utils/collisions',
    ['gma/base', 'gma/utils/base' ],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides collision detection functionality
         * @instantiated
         * @class collisions
        */
        gma.collisions = function(spec) {
        
            var self = spec || {};

///////////////////////////////////////////////////////////////////////////////

/**
 * Provides factories for creating filter functions
 * @property factories
*/
self.factories = {
    /**
     * Factory for creating a function that filters stuff outside the enclosing box of our focus
     * The enclosing box is the box that encloses the focus where it is now and after it's intended movement
     * This works by saying what isn't outside the enclosing box
     * Outside occurs when one of the following is true
     * 
     * * Top of the obstacle is below the bottom of the focus
     * * Left of the obstacle is to the right the right of the focus
     * * Right of the obstacle is to the left the left of the focus
     * * Bottom of the obstacle is above the top of the focus
     * @method factories.findBlockers
     * @param focus {:api:`gma.shapes.rectangle`} Object representing the thing we are moving
     * @param vector {[x, y]} Vector representing movement horizontally and vertically
     * @return {Function(environ):Boolean}
    */
    findBlockers : function(focus, vector) {
        var enclosingTop    = _.max([focus.top,    focus.top    + vector[1]]);
        var enclosingLeft   = _.min([focus.left,   focus.left   + vector[0]]);
        var enclosingRight  = _.max([focus.right,  focus.right  + vector[0]]);
        var enclosingBottom = _.min([focus.bottom, focus.bottom + vector[1]]);
        
        return function(environ) {
            return environ !== focus && !_.any([
                environ.top    <= enclosingBottom,
                environ.left   >= enclosingRight,
                environ.right  <= enclosingLeft,
                environ.bottom >= enclosingTop
            ]);
        };
    },
    
    /**
     * Factory for creating a function that filters everything that could be ground to our focus
     * Something is ground if it's top is at the same y position of the focus
     * And the object shares horizontal position with the focus
     * @method factories.findGround
     * @param focus {:api:`gma.shapes.rectangle`} Object representing the thing we are moving
     * @return {Function(environ):Boolean}
    */
    findGround : function(focus) {
        var focusBottom = focus.bottom;
        var focusLeft   = focus.left;
        var focusRight  = focus.right;
        
        return function(environ) {
            if (environ.solid === false) {
                return false;
            }
            
            var distanceToFocus = focusBottom - environ.top;
            var topIsGround     = distanceToFocus >= 0 && distanceToFocus < 0.1;
                
            var leftBetween   = environ.left  > focusLeft && environ.left   < focusRight;
            var rightBetween  = environ.right > focusLeft && environ.right  < focusRight;
            var horizontallyGreater = environ.left <= focusLeft && environ.right  >= focusRight;
            
            var onGround = topIsGround && _.any([
                leftBetween,
                rightBetween,
                horizontallyGreater
            ]);
            
            if (onGround) {
                focus.collided  (gma.constants.BOTTOM, environ, gma.constants.TOP,  null);
                environ.collided(gma.constants.TOP,  focus,   gma.constants.BOTTOM, null);
            }
            
            return onGround;
        };
    },
    
    /**
     * This factory will create a filter function that determines how far focus can go before it hits a particular object in the environment
     * 
     * It first creates a closure containing 
     * 
     * * the gradient of the vecotr
     * * the sides of the focus facing the direction of the vector
     * * the sides of the environ facing the focus
     * 
     * The filter works by first setting possibleX and possibleY to the vector passed in. The filter will end up either returning these values or new values possibleX and possibleY.
     * 
     * It will then decide if the direction is straight or diagonal.
     * 
     * If we're going straight, then we can only go in that direction the minium of the distance between focus and environ or the appropiatepart of the vector.
     * 
     * If we're going diagonal, then we determine which axis is constrained (horizontal, vertical, both or neither) and move the object accordingly. (how is explained below). Whichever is constrained will move the exact distance between the focus and the environ, whilst the other axis will be determined by the full amount of the vector
     * 
     * We then call collidedWith and collidedBy on the appropiate objects with the appropiate parameters and return [possibleX, possibleY]
     * 
     * To determine what to do when going diagonally, we first determine the following
     * 
     * * X and y co-ordinates of the vertical and horizontal axis ofthe environ respectively
     * * The equivalent of the focus
     * * Where the particular sides chosen is determined by the direction of the vector
     * * The horizontal and vertical distance between focus and environ (xd and yd)
     * * We then determine whether horizontal or vertical axis are constrained using the following rules per axis
     * 
     *   * If the distance is zero
     *   * , or this axis is already past the respective axis of the environ
     * 
     * * Then we determine whether xd or yd should be negative or positive depending on the direction and gradient of the vector
     * * Then we determine a projection of xd and yd on the gradient (i.e. If we moved the character xd or yd, then what the respective amount they'd travel in the other axis according to the gradient). We call these values, yxd and xyd. These values are made absolute astheir polarity doesn't make a difference past this point
     * * If at this point, both axis are still constrained, then we see if we can unconstrain one of the axis. We say that for each axis, if the amount projected is less than the distance between between focusand environ, then the other axis isn't constrained, which leaves this axis to still be constrained.
     * * We then say that each axis that is constrained can only move the distance between focus and environ and each axis that is not constrained moves the full amount of the vector
     * * We also determine if the focus will completely miss the environ. if both or neither axis are constrained, then it doesn't miss.
     * * If only one axis is constrained, then we look at the distance between the opposite sides of focus and environ. So say for example focus is moving left, then we look at the distance between focus' left side and environ's right side. If this distance is smaller than the projected distance, then the focus must not be hitting the environ, and we've missed it
     * 
     * @method factories.findCollisions
     * @param focus {:api:`gma.shapes.rectangle`} Object representing the thing we are moving
     * @param vector {[x, y]} Vector representing movement horizontally and vertically
     * @return {Function(environ):[possibleX, possibleY]}
    */
    findCollisions : function(focus, vector) {

		// Determine environSides
        var environSides = [];
        var focusSides = [];
        
        if (vector[0] > 0) {
            environSides.push(gma.constants.LEFT);
            focusSides.push(gma.constants.RIGHT);
        }
        else if (vector[0] < 0) {
            environSides.push(gma.constants.RIGHT);
            focusSides.push(gma.constants.LEFT);
        }
        
        if (vector[1] > 0) {
            environSides.push(gma.constants.BOTTOM);
            focusSides.push(gma.constants.TOP);
        }
        else if (vector[1] < 0) {
            environSides.push(gma.constants.TOP);
            focusSides.push(gma.constants.BOTTOM);
        } 
        
        //determine gradient
        var gradient = 0;
        if (vector[1] !== 0) {
            gradient = vector[1]/vector[0];
        }
        
        var diff;
        var miss;
        var collidedFocusSide;
        var collidedEnvironSide;
        
        var possibleX;
        var possibleY;
        var xMovement;
        var yMovement;
        
        var environX;
        var focusX;
        var environY;
        var focusY;
        
        var xd;
        var yd;
        var yxd;
        var xyd;
        
        var newDirection;
        var yConstrained;
        var xConstrained;
        
        return function(environ) {
            
            possibleX = vector[0];
            possibleY = vector[1];
            if (environSides.length === 1) {
                if (environSides[0] === gma.constants.RIGHT || environSides[0] === gma.constants.LEFT) {
                    // Going horizontally
                    environX = environ.xOf(environSides[0]);
                    focusX   = focus.xOf(focusSides[0]);
                    
                    possibleX    = _.min([environX - focusX, vector[0]], Math.abs);
                    collidedEnvironSide = environSides[0];
                    collidedFocusSide   = focusSides[0]; 
                }
                else {
                    // Going vertically
                    environY = environ.yOf(environSides[0]);
                    focusY   = focus.yOf(focusSides[0]);
                    
                    possibleY    = _.min([environY - focusY, vector[1]], Math.abs);
                    collidedEnvironSide = environSides[0];
                    collidedFocusSide   = focusSides[0];
                }
            }
            
            else {
                // Going diagonally
        
                //Determine environ edges
                environX = environ.xOf(environSides[0]);
                environY = environ.yOf(environSides[1]);
                
                //Determine focus edges 
                focusX = focus.xOf(focusSides[0]);
                focusY = focus.yOf(focusSides[1]);
                
                // Determine distances
                xd = environX - focusX;
                yd = environY - focusY;
                
                // Determine which axis is constrained
                yConstrained = false;
                xConstrained = false;
                
                if (xd === 0 || (environSides[0] === gma.constants.RIGHT && xd < 0) || (environSides[0] === gma.constants.LEFT && xd > 0)) {
                    xConstrained = true;
                }
                
                if (yd === 0 || (environSides[1] === gma.constants.BOTTOM && yd > 0) || (environSides[1] === gma.constants.TOP && yd < 0)) {
                    yConstrained = true;
                }

                // Gradient is never zero, because we're going diagonally
                yd = Math.abs(yd);
                xd = Math.abs(xd);
                if (focusSides[0] === gma.constants.RIGHT) {
                    if (focusSides[1] === gma.constants.TOP) {
                        //Going Diagonally up-right
                        //Both yd and xd should be positive
                    }
                    else {
                        //Going Diagonally down-right
                        //y should be negative
                        yd = -yd;
                    }
                }
                if (focusSides[0] === gma.constants.LEFT) {
                    if (focusSides[1] === gma.constants.TOP) {
                        //Going Diagonally up-left
                        //x should be negative
                        xd = -xd;
                    }
                    else {
                        //Going Diagonally down-left
                        //both should be negative
                        xd = -xd;
                        yd = -yd;
                    }
                }
                
                xyd = Math.abs(yd / gradient);
                yxd = Math.abs(gradient * xd);
                
                if (xConstrained && yConstrained) {
                    // Both are constrained, do more tests to determine which to constrain
                    if (yxd < Math.abs(yd)) {
                        xConstrained = false;
                    }
                    
                    if (xyd < Math.abs(xd)) {
                        yConstrained = false;
                    }
                }
                
                miss = true;
                if (xConstrained && yConstrained) {
                    yMovement = yd;
                    xMovement = xd;
                    collidedEnvironSide = environSides[1];
                    collidedFocusSide   = focusSides[1];
                    miss = false;
                }
                else if (xConstrained) {
                    xMovement = xd;
                    yMovement = possibleY;
                    collidedEnvironSide = environSides[0];
                    collidedFocusSide   = focusSides[0];
                    
                    //Determine if we actually miss the environ
                    diff = Math.abs(environ.yOf(focusSides[1]) - focus.yOf(environSides[1]));
                    miss = yxd >= diff;
                    
                }
                else if (yConstrained) {
                    yMovement = yd;
                    xMovement = possibleX;
                    collidedEnvironSide = environSides[1];
                    collidedFocusSide   = focusSides[1];
                    
                    //Determine if we actually miss the environ
                    diff = Math.abs(environ.xOf(focusSides[0]) - focus.xOf(environSides[0]));
                    miss = xyd >= diff;
                    
                }
                
                if (miss === false) {
                    possibleX = xMovement;
                    possibleY = yMovement;
                }
                
            }
            
            // If vector is different than possibleX and possibleY then we assume collision has occured
            // Because for this function to be called, focus must already have tried to move
            
            if (possibleX !== vector[0] || possibleY !== vector[1]) {
                focus.collided  (collidedFocusSide,   environ, collidedEnvironSide, null);
                environ.collided(collidedEnvironSide, focus,   collidedFocusSide,   vector);
            }
            
            if (environ.solid === true) {
                newDirection = [possibleX, possibleY];
            }
            else {
                newDirection = vector;
            }
            
            return newDirection;
        };
    }
};

/**
 * Given a focus, it's movement and what's in the environment, this will determine where that focus can go. 
 * It will first filter out anything that is outside the enclosing box
 * It will then determine if there are any collisions
 * If there aren't collisions, it will return the original vector
 * If there are no collisions, it will return a vector representing the smallest amount of movement it can do given the collisions
 * @method detectCollisions
 * @param focus {:api:`gma.shapes.rectangle`} Object representing the thing we are moving
 * @param vector {[x, y]} Vector representing movement horizontally and vertically
 * @param environment {[many :api:`gma.shapes.rectangle`]} List of shapes representing collidable objects in the visible environment
 * @return {[x, y]}
*/
self.detectCollisions = self.detectCollisions || function(focus, vector, environment) {
    //At this point, focus has to be moving
    //Environment is a list of objects in the environment
    var findBlockers = self.factories.findBlockers(focus, vector);
    var findCollisions = self.factories.findCollisions(focus, vector);
    
    // Blocking is any object within the enclosing space created from originial and target position
    //console.log("Environment: "+environment.length);
    var blocking  = _.filter(environment, findBlockers);
    //console.log("Blocking: "+blocking.length);

    // The findCollisions filter changes collidingLines
    //console.log("Vector: "+vector);
    var collisions = _.map(blocking, findCollisions);
    //_.each(collisions, function(o) { console.log("Results: "+o); });
    
    var x;
    var y;
    if (collisions.length > 0) {
        x = _.min(_.map(collisions, function(v) { return v[0]; }), Math.abs);
        y = _.min(_.map(collisions, function(v) { return v[1]; }), Math.abs);
    }
    else {
        x = vector[0];
        y = vector[1];
    }
    
    return [x, y];
};

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        }();
    }
);
