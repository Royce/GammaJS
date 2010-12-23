/*global require, window */
require.def('gma/entities/door',
    ['gma/base', 'gma/entities/base', 'gma/entities/moveable', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides a character object
         * @class door
         * @extends gma.shapes.rectangle
        */
        gma.door = function(spec) {
        
            var self = gma.shapes.rectangle(spec || {x:0, y:0, width:1, height:1});
            if (!self) {throw new Error("Can't create rectangle for door");}
            
///////////////////////////////////////////////////////////////////////////////
    
    /** @tag door */
    self.tags.door = true;
    
    /** 
    * Looks for door tag along with what super.collided does
    * @method collided 
    */
    var oldCollided = self.collided;
    self.collided = function() {
        oldCollided.apply(this, arguments);
        if (self.tags.door) {
            self.collided__door.apply(this, arguments);
        }
    };
    
    /**
     * Collision function for hitting a door
     * @method collided__door
     * @copy collided
    */
    self.collided__door = self.collided__door || function(w, focus) {
        if (focus.tags.character) {
            window.manager.loadLevel(self.level, self.spawnId);
        }
    };
///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
