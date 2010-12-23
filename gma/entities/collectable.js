/*global require */
require.def('gma/entities/collectable',
    ['gma/base', 'gma/entities/base', 'gma/entities/shapes', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a base platform object
     * @class collectable
     * @extends gma.shapes.rectangle
    */
    gma.collectable = function(spec) {
    
        var self = gma.shapes.rectangle(spec || {x:0, y:0, width:1, height:1});
        if (!self) {throw new Error("Can't create rectangle for platform");}

        /** @tag collectable */
        self.tags.collectable = true;
        
        /**
         * Remove the collectable. Should be overwritten to do something useful.
         * @method pickup
        */
        self.pickup = self.pickup || function() {
            self.alive = false;
        };

        return self;
    
    };
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a collectible object htat increases score
     * @class scoreCollectable
     * @extends gma.collectable
    */
    gma.scoreCollectable = function(spec) {
    
        var self = gma.collectable(spec);

        /** @tag scoreCollectable */
        self.tags.scoreCollectable = true;
        
        return self;
    };
    
///////////////////////////////////////////////////////////////////////////////

    }
);
