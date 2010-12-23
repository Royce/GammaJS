/*global require, _ */
require.def('gma/utils/background',
    ['gma/base', 'gma/utils/render', 'gma/entities/shapes'],
    function(gma) {
        
        /** @module gma */

        /**
         * Provides some functions to transform specification into background
         * @class backgroundMaker
        */
        gma.backgroundMaker = function(spec) {
        
            var self = spec || {};

///////////////////////////////////////////////////////////////////////////////

/**
 * The z co-ordinate given to all background items
 * @property z
 * @type Number
*/
self.z = self.z || 0;

/**
 * Dispatcher for determining how to treat background specifications
 * @method process
 * @param manager {:api:`gma.manager`}
 * @param value {specification}
 * @return {:api:`gma.renderHelper`}
*/
self.process = self.process || function(manager, value) {
    if (value) {
        if (_.isString(value.config)) {
            func = self['process_' + value.config];
            if (_.isFunction(func)) {
                return func(manager, value, value.config);
            }
        }
        else if (_.isFunction(value.config)) {
            return value.config(manager, value);
        }
        
        //If we've made it this far, config is either unknown or undefined
        return self.process_other(manager, value, value.config);
    }
};

/**
 * Function to ensure value.entity is a rectangle
 * @method sanitise
 * @param value {specification}
 * @param opts {Options}
*/
self.sanitise = self.sanitise || function(value, opts) {
    opts = opts || {x:0, y:0, width:1, height:1};
    opts = _.extend(opts, value, value.entity)
    value.entity = gma.shapes.rectangle(opts)
};

/**
 * Processer for specifications with no or unknown type
 * @method process_other
 * @param manager {:api:`gma.manager`}
 * @param value {specification}
 * @param type {String}
 * @return {:api:`gma.renderHelper`}
*/
self.process_other = self.process_other || function(manager, value, type) {
    self.sanitise(value);
    var templateHelper = value.template || gma.unitCube;
    var box = templateHelper.getInstance();
    value._instance = box;
    return gma.renderHelper(value);
};

/**
 * Processer for skybox
 * @method process_skybox
 * @copy process_other
*/
self.process_skybox = self.process_skybox || function(manager, value, type) {
    if (!value.mesh) {
        value.mesh = gma.unitCubeInfo.mesh;
    }
    
    if (!value.texture && !value.material) {
        value.material = gma.unitCubeInfo.material;
    }
    
    if (value.texture && value.material) {
        delete value.material;
    }
    
    self.sanitise(value, {width:50, height:50, depth:1, x:0, y:0, z:-50})
    var box = gma.meshTemplate(value).getInstance();
    value._instance = box;
    return gma.renderHelper(value);
};

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
