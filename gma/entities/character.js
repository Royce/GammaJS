/*global require */
require.def('gma/entities/character',
    ['gma/base', 'gma/entities/moveable', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides a character object
         * @class character
         * @extends gma.moveable
        */
        gma.character = function(spec) {
        
            var self = gma.moveable(spec || {x:0, y:0, width:1, height:1});
            if (!self) {throw new Error("Can't create rectangle for character");}
            
///////////////////////////////////////////////////////////////////////////////
    
    /** @tag character */
    self.tags.character = true;
     
    /**
     * Holds a score counter
     * @property score
     * @type Number
    */
    self.score = self.score || 0;
    
    /**
     * Makes character ready for jumping
     * It will only set character to jumping if it's in the STILL state
     * It will also set self.targetY to it's current y plus it's jumpHeigt
     * @method jump
     * @param e {Event} Keyboard event object
    */
    self.jump = self.jump || function(e) {
        if (self.alive) {
            if (self.yState === gma.constants.STILL) {
                self.yState = gma.constants.JUMPING;
                self.velocity = self.jumpVelocity;
            }
        }
    };
    
    /**
     * Changes character's horizontal state
     * @method move
     * @param direction {:api:`gma.constant`} gma.constant representing whether character is going left or right
     * @param e {Event} Keyboard event object
    */
    self.move = self.move || function(direction, e) {
        if (self.alive) {
            if (e.type==="keyup") {
                if (self.xState === direction) {
                    self.lastXState = self.xState;
                    self.xState = gma.constants.STILL;
                }
            }
            else {
                if (direction) {
                    if (direction === gma.constants.LEFT || direction === gma.constants.RIGHT) {
                        self.xState = direction;
                    }
                    else {
                        throw new Error("You can only call move() with constants.LEFT or constants.RIGHT");
                    }
                }
                else {
                    throw new Error("You need to supply a direction to move()");
                }
            }
        }
    };
    
    /**
     * Collided function for character
     * Determines if we hit a collectable and what to do with it
     * @method collided
    */
    var oldCollided = self.collided;
    self.collided = function(w, focus) {
        oldCollided.apply(this, arguments);
        if (focus.tags.collectable) {
            self.collided__pickupCollectable.apply(this, arguments);
        }
    };
    
    
    /**
     * Collision function for hitting a collectable
     * @method collided__pickupCollectable
     * @copy collided
    */
    self.collided__pickupCollectable = self.collided__pickupCollectable || function(w, focus) {
        focus.pickup();
        if (focus.tags.scoreCollectable) {
            self.score = self.score + 1;
        }
    };

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
