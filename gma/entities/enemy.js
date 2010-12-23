/*global require, _ */
require.def('gma/entities/enemy',
    ['gma/base', 'gma/entities/base', 'gma/entities/moveable', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a base enemy object
     * @class enemy
     * @extends gma.moveable
    */
    gma.enemy = function(spec) {
    
        var self = gma.moveable(spec || {x:0, y:0, width:1, height:1});

        /** @tag enemy */
        self.tags.enemy = true;
        
        if (self.tags.platformer) {
            // Platformer's determineState does the same thing as moveable's findGround function
            self.findGround = function() {};
        }

        /** 
        * Enemy getMovement will first call determineState before doing super.getMovement
        * The enemy is the same as the character, except it
        * determines it's own next state, rather than the player
        * @method getMovement 
        */
        var oldGetMovement = self.getMovement;
        self.getMovement = function(moveAmount, manager) {
            self.determineState(moveAmount, manager);
            return oldGetMovement(moveAmount, manager);
        };
        
        /**
         * Determine the state of the enemy for the next movement
         * - Calls behaviour__jumping if it has jumping tag
         * - Calls behaviour__patrolling if it has patrolling tag
         * - Calls behaviour__platformer if it has platformer tag
         * @method determineState
         * @param moveAmount {Number} amount to move; based on delta from twitch
         * @param manager {:api:`gma.manager`}
        */
        self.determineState = self.determineState || function() {
            if (self.tags.jumping) {
                self.behaviour__jumping.apply(this, arguments);
            }
            
            if (self.tags.patrolling) {
                self.behaviour__patrolling.apply(this, arguments);
            }
            
            if (self.tags.platformer) {
                self.behaviour__platformer.apply(this, arguments);
            }
        };

        /** 
        * Enemy looks for rebound and weakhead tags as well as what super.collided looks for
        * It will also look for deathtouch, if enemy is still alive after all other checks
        * @method collided 
        */
        var oldCollided = self.collided;
        self.collided = function() {
            oldCollided.apply(this, arguments);
            if (self.tags.rebound) {
                self.collided__rebound.apply(this, arguments);
            }
            if (self.tags.weakhead) {
                self.collided__weakhead.apply(this, arguments);
            }
            
            if (self.alive && self.tags.deathtouch) {
                self.collided__deathtouch.apply(this, arguments);
            }
        };
        
        /**
         * Makes enemy jump when touching ground
         * @method behaviour__jumping
         * @copy determineState
        */
        self.behaviour__jumping = function(moveAmount, manager) {
            if (self.yState === gma.constants.STILL) {
                self.yState = gma.constants.JUMPING;
                self.velocity = self.jumpVelocity;
            }
        };
        
        /**
         * Makes enemy turn around when reaching the edge of the platform it is currently on
         * @method behaviour__platformer
         * @copy determineState
        */
        self.behaviour__platformer = function(moveAmount, manager) {
            var findGround = gma.collisions.factories.findGround(self);
            
            if (self.yState !== gma.constants.JUMPING) {
                var grounds = _.filter(manager.entities(), findGround);
                if (grounds.length > 0) {
                    if (self.yState === gma.constants.FALLING) {
                        self.yState = gma.constants.STILL;
                    }
                    var ground = grounds[0];
                    if (self.x <= ground.left) {
                        self.xState = gma.constants.RIGHT;
                    }
                    
                    if (self.x >= ground.right) {
                        self.xState = gma.constants.LEFT;
                    }
                    
                    if (self.xState === gma.constants.STILL) {
                        if (self.x < ground.x) {
                            self.xState = gma.constants.RIGHT;
                        }
                        else {
                            self.xState = gma.constants.LEFT;
                        }
                    }
                }
                else {
                    self.yState = gma.constants.FALLING;
                }
            }
        };
        
        /**
         * Makes enemy patrol a range 
         * Requires self.limitLeft and/or self.limitRight properties
         * @method behaviour__patrolling
         * @copy determineState
        */
        self.behaviour__patrolling = function(moveAmount, manager) {
            if(self.limitLeft && self.x <= self.limitLeft) {
                self.xState = gma.constants.RIGHT;
            }

            if (self.limitRight && self.x >= self.limitRight) {
                self.xState = gma.constants.LEFT;
            }

            if (self.xState === gma.constants.STILL) {
                self.xState = gma.constants.LEFT;
            }
        };
        
        /**
         * Makes enemy turn around if it hits something
         * @method collided__rebound
         * @copy collided
        */
        self.collided__rebound = function(where) {
            if (where === gma.constants.LEFT) {
                self.xState = gma.constants.RIGHT;
            }
            else if (where === gma.constants.RIGHT) {
                self.xState = gma.constants.LEFT;
            }
        };
        
        /**
         * Makes enemy die when character hit it's top
         * @method collided__weakhead
         * @copy collided
        */
        self.collided__weakhead = function(where, focus) {
            if (where === gma.constants.TOP && focus.tags.character) {
                self.kill();
            }
        };

        return self;
    
    };
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides an enemy that stays on a platform
     * @class platformEnemy
     * @extends gma.enemy
    */
    gma.platformEnemy = function(spec) {
    
        var self = gma.enemy(spec);
        
        /** @tag rebound */
        self.tags.rebound = true;
        /** @tag deathtouch */
        self.tags.deathtouch = true;
        /** @tag weakhead */
        self.tags.weakhead = true;
        /** @tag platformer */
        self.tags.platformer = true;

        // platformer tag makes determineState does the same thing as the findGround function
        self.findGround = function() {};
        
        return self;
    
    };

    /**
     * Provides an enemy that jumps on a platform
     * @class jumpingEnemy
     * @extends gma.enemy
    */
    gma.jumpingEnemy = function(spec) {
    
        var self = gma.enemy(spec);

        /** @tag deathtouch */
        self.tags.deathtouch = true;
        /** @tag weakhead */
        self.tags.weakhead = true;
        /** @tag jumping */
        self.tags.jumping = true;
        
        return self;
    
    };

    /**
     * Provides an enemy that patrols a particular range
     * @class patrolEnemy
     * @extends gma.enemy
    */
    gma.patrolEnemy = function(spec) {

        var self = gma.enemy(spec);

        /** @tag rebound */
        self.tags.rebound = true;
        /** @tag deathtouch */
        self.tags.deathtouch = true;
        /** @tag weakhead */
        self.tags.weakhead = true;
        /** @tag patrolling */
        self.tags.patrolling = true;

        return self;

    };
    
///////////////////////////////////////////////////////////////////////////////

    }
);
