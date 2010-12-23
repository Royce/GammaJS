/*global require */
require.def('gma/entities/platform',
    ['gma/base', 'gma/entities/base', 'gma/entities/shapes', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a base platform object
     * @class platform
     * @extends gma.shapes.rectangle
    */
    gma.platform = function(spec) {
    
        var self = gma.shapes.rectangle(spec || {x:0, y:0, width:1, height:1});
        if (!self) {throw new Error("Can't create rectangle for platform");}

        /** @tag platform */
        self.tags.platform = true;

        /** 
        * Does super.collided checks and also looks for the deathtouch tag
        * @method collided 
        */
        var oldCollided = self.collided;
        self.collided = function() {
            oldCollided.apply(this, arguments);
            if (self.tags.deathtouch) {
                self.collided__deathtouch.apply(this, arguments);
            }
        };

        return self;
    
    };
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a death platform object
     * @class deathPlatform
     * @extends gma.platform
    */
    gma.deathPlatform = function(spec) {
    
        var self = gma.platform(spec);

        /** @tag deathtouch */
        self.tags.deathtouch = true;
        
        return self;
    };
    
///////////////////////////////////////////////////////////////////////////////

    }
);
