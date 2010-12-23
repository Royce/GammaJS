/*global require */
require.def('gma/constants',
    [],
    function() {
        
        /** @module gma */
        
        /**
         * Provides some constants
         * @instantiated
         * @class constants
        */
        return function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////
    
    /**
     * Movement -- Jumping
     * @property JUMPING
     * @type String
     * @final
    */
    self.JUMPING    = "gma_j";
    
    /**
     * Movement -- Falling
     * @property FALLING
     * @type String
     * @final
    */
    self.FALLING    = "gma_f";
    
    /**
     * Movement -- Still
     * @property STILL
     * @type String
     * @final
    */
    self.STILL    = "gma_s";

    /**
     * Direction -- Left
     * @property LEFT
     * @type String
     * @final
    */
    self.LEFT    = "gma_l";

    /**
     * Direction -- Right
     * @property RIGHT
     * @type String
     * @final
    */
    self.RIGHT    = "gma_r";

    /**
     * Direction -- Top
     * @property TOP
     * @type String
     * @final
    */
    self.TOP    = "gma_t";

    /**
     * Direction -- Bottom
     * @property BOTTOM
     * @type String
     * @final
    */
    self.BOTTOM    = "gma_b";

    /**
     * Acceleration -- Gravity
     * @property GRAVITY
     * @type String
     * @final
    */
    self.GRAVITY    = -0.5;

    
///////////////////////////////////////////////////////////////////////////////

            return self;
        
        }();
    }
);
