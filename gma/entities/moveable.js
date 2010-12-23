/*global require, _ */
require.def('gma/entities/moveable',
    ['gma/base', 'gma/entities/base', 'gma/entities/shapes', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides functionality for a moveable shape
         * @class moveable
         * @extends gma.shapes.rectangle
        */
        gma.moveable = function(spec) {
        
            var self = gma.shapes.rectangle(spec || {x:0, y:0, width:1, height:1});
            if (!self) {throw new Error("Can't create rectangle for moveable");}
            
///////////////////////////////////////////////////////////////////////////////

    /** @tag moveable */
    self.tags.moveable = true;
    
    /**
     * Flag saying whether character is jumping, falling or neither
     * @property yState
     * @type :api:`gma.constant`
     * @default :constant:`FALLING`
    */
    self.yState      = self.yState || gma.constants.FALLING;
    
    /**
     * Flag saying whether character is going left, right or neither
     * @property xState
     * @type :api:`gma.constant`
     * @default :constant:`STILL`
    */
    self.xState     = self.xState || gma.constants.STILL;
    
    
    /**
     * Flag saying what direction character was going last before becoming horizontally still
     * @property lastXState
     * @type :api:`gma.constant`
     * @default self.xState
    */
    self.lastXState = self.lastXState || self.xState;
    
    /**
     * Number representing how fast the character is moving vertically
     * @property velocity
     * @type Number
     * @default 0
    */
    self.velocity = self.velocity || 0;

    /**
     * Number representing the initial velocity of a jump
     * @property jumpVelocity
     * @type Number
     * @default 4
    */
    self.jumpVelocity = self.jumpVelocity || 4;
    
    /**
     * Looks at the character's state and determines how far it should move
     * This result will then be checked for collisions and may be modified
     * If the character is jumping :
     * 
     * * Keep going up if haven't reached targetY
     * * else set vertical state to FALLING
     * 
     * If we're falling, then we go down
     * If horizontal state is not STILL, then we add horizontal movement.
     * @method getMovement
     * @param moveAmount {Number} The amount the character should move
     * @return {Amount to move as [x, y]}
    */
    self.getMovement = self.getMovement || function(moveAmount, manager) {
        var xMovement = 0;
        var yMovement = 0;
        var newVelocity = 0;
        
        // Vertical
        if (self.yState === gma.constants.JUMPING || self.yState === gma.constants.FALLING) {
            newVelocity = self.velocity + gma.constants.GRAVITY * moveAmount;
            yMovement = (newVelocity+self.velocity)/2*moveAmount;
            self.velocity = newVelocity;
            if (self.velocity <= 0) {
                self.yState = gma.constants.FALLING;
            }
        }
        
        // Horizontal
        if (self.xState === gma.constants.RIGHT) {
            xMovement += moveAmount;
        }
        
        if (self.xState === gma.constants.LEFT) {
            xMovement -= moveAmount;
        }
        
        return [xMovement, yMovement];
    };
    
    /**
     * Changes character's position according to it's state
     * First it asks getMovement how much we should move
     * Then it determines how far we can move given the environment
     * It will then change the state of the character accordingly
     * It will then determine if the character is on top of ground
     * and set vertical state to FALLING or STILL accordingly
     * @method animate
     * @param delta {Number} Time since last animation
     * @param manager {:api:`gma.manager`}
    */
    self.animate = self.animate || function(delta, manager) {
        if (delta < 0.05) { delta = 0.05; }
        var moveAmount = 10*delta;
        var movement = self.getMovement(moveAmount, manager);
        var xMovement = movement[0];
        var yMovement = movement[1];
        
        var vector = [0, 0];
        if (self.xState !== gma.constants.STILL || self.yState !== gma.constants.STILL) {
            vector = gma.collisions.detectCollisions(self, [xMovement, yMovement], manager.entities());
        }
        
        if (vector[1] === 0 && self.yState === gma.constants.JUMPING){
            self.yState = gma.constants.FALLING;
            self.velocity = 0;
        }
        self.updatePositions(vector);
        self.findGround(manager);
    };
    
    /**
     * Finds any ground the character is on and changes state accordingly
     * @param manager {:api:`gma.manager`}
     * @method findGround
    */
    self.findGround = self.findGround || function(manager) {
        var findGround = gma.collisions.factories.findGround(self);
        
        if (self.yState !== gma.constants.JUMPING) {
            if (_.filter(manager.entities(), findGround).length > 0) {
                self.yState = gma.constants.STILL;
                self.velocity = 0;
            }
            else {
                self.yState = gma.constants.FALLING;
            }
        }
    };
    
    /**
     * Changes it's position, centre, points and edges.
     * @method updatePositions
     * @param vector {[x, y]} Vector representing the amount character can move
    */
    self.updatePositions = self.updatePositions || function(vector) {
        var xMovement = vector[0];
        var yMovement = vector[1];
        
        if (_.isNumber(xMovement) && !isNaN(xMovement) && _.isNumber(yMovement) && !isNaN(yMovement)) {
        
            self.x += xMovement;
            self.left += xMovement;
            self.right += xMovement;
            
            self.y += yMovement;
            self.top += yMovement;
            self.bottom += yMovement;
            
            self.centre = [self.x, self.y];
            
            self.setPointsAndEdges();
        }
    };
    
    var angle = 0;
    
    /**
     * Gets rotation in radians
     * @method getRotation
     * @return {Number}
    */
    self.getRotation = self.getRotation || function () {
        var characterDirection = self.xState;
        if (characterDirection === gma.constants.STILL) {
            characterDirection = self.lastXState;
        }
        
        if (characterDirection === gma.constants.LEFT) {
            if (angle < 0.1) {
                angle += 0.5;
            }
            if (angle > 0.1) {
                angle = 0;
            }
        }
        else {
            if (angle > -3.15) {
                angle -= 0.5;
           }
            if (angle < -3.15) {
                angle = -3.14;
            }
        }
        return -angle;
    };
    
    /**
     * Kills the entity. Should be overwritten to do something useful.
     * @method kill
    */
    self.kill = self.kill || function() {
        self.xState = gma.constants.STILL;
        // Leave yState as it may be mid-jump
        self.alive = false;
    };

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
