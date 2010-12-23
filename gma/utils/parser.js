/*global require, _ */
require.def('gma/utils/parser',
    ['gma/base', 'gma/utils/base', 'gma/utils/background'],
    function(gma) {
        
        /** @module gma */
        /** @for utils */
        

///////////////////////////////////////////////////////////////////////////////

/**
 * Expands objects with "replicateWith" keys
 * @method expandReplicateWith
 * @param spec {Object} the object that we are expanding
 * @return {Expanded Spec}
*/
gma.utils.expandReplicateWith = function(spec) {
    var oldSpec = spec;
    
    // Apply replicate
    if (spec.replicateWith !== undefined) {
        spec = spec.replicateWith;
        delete oldSpec.replicateWith;
        spec = _.map(spec, function(item) {
            // Copy parent values into each new item
            var next = {};
            _.each(oldSpec, function(v, k) {
                next[k] = v;
            });
            
            _.each(item, function(v, k) {
                next[k] = v;
            });
            return next;
        });
        if (spec.length === 1) {
            spec = spec[0];
        }
    }
    oldSpec = spec;
    
    // Recurse
    if (_.isArray(spec)) {
        spec = [];
        _.each(oldSpec, function(item, index) {
            var flatten = (item.replicateWith !== undefined);
            var expanded = gma.utils.expandReplicateWith(item);
            if (flatten) {
                _.each(expanded, function(newItem) {
                    spec.push(newItem);
                });
            }
            else {
                spec.push(item);
            }
        });
    }
    else {
        if (!_.isString(spec) &&
            !_.isFunction(spec) &&
            !_.isNumber(spec) &&
            !_.isDate(spec) &&
            !_.isBoolean(spec)
        ) {
            // We assume a complex object has atleast one function in it
            if (!_.any(spec, function(s) { return _.isFunction(s); })) {
                _.each(spec, function(value, key) {
                    spec[key] = gma.utils.expandReplicateWith(value);
                });
            }
        }
    }
    return spec;
};


///////////////////////////////////////////////////////////////////////////////

/**
 * Creates Gamma objects and associated render helpers from a level specification
 * @class levelParser
*/
gma.levelParser = function(spec) {
    var self = spec || {};
    
    /**
     * Holds Render template objects to be assigned to entities
     * Could say something like
     *      
     *      banana = ['colladaTemplate',
     *           {
     *               collada : {
     *                   document : 'banana.gae'
     *               },
     *               yRot : 1.57,
     *               yOffset : -0.5,
     *               yScale : 0.7
     *           }
     *      ],
     * 
     * or have entries that are already an instantiated templateHelper
     * @property templates
     * @type Object
     * @default {} with "cube" and "redcube"
    */
    self.templates = self.templates || {
        cube : gma.unitCube,
        
        redcube : ['meshTemplate', {
            mesh : gma.unitCubeInfo.mesh,
            material : {color : "#900"}
        }]
    };
    
    /**
     * Associates names to gamma objects/render helpers
     * It 
     * @property types
     * @type Object
     * @default {default : ['platform', {template : "cube"}]}
    */
    self.types = self.types || {
        'default' : ['platform', {template : "cube"}]
    };
    
    /**
     * Processes a level specification and replaces it's content with gamma objects
     * @method processLevel
     * @param level {Object} The level specification
     * @return {Processed specification}
    */
    self.process = self.process || function(manager, level) {
        if (level.processed === true) {
            //Already processed, nothing to do
            return level;
        }
        
        // Create some variables        
        var validateOther = self.validate_other;
        var processOther  = self.process_other;
        
        level = self.preProcess(manager, level);

        // Handle all the parts of the specification
        _.each(level, function(value, key) {
            var func = self['validate_' + key] || validateOther;
            var valid = func(manager, key, value, level);
            
            if (!valid) {
                value = undefined;
                func = self['default_' + key];
                if (func) {
                    value = func();
                }
                else {
                    // Not valid and no default, remove it
                    delete level[key];
                }
            }
            
            if (value) {
                func = self['process_' + key] || processOther;
                func(manager, key, value, level);
            }
        });
        
        // Set the processed flag and return
        level.processed = true;
        return level;
    };
    
    /**
     * Ensures the level has the minimum amount specified
     * @method preProcess
     * @param level {Object} The level specification
    */
    self.preProcess = self.preProcess || function(manager, level) {
    
        level = gma.utils.expandReplicateWith(level);
        
        level.spawn = level.spawn || self.default_spawn();
        if (!level.spawn.main) {
            level.spawn.main = [0, 0];
        }
        
        level.light     = level.light     || self.default_light();
        level.camera    = level.camera    || self.default_camera();
        level.entities  = level.entities  || self.default_entities();
        
        level.bkgIds      = level.bkgIds      || [];
        level.removed     = level.removed     || [];
        level.following   = level.following   || {};
        level.background  = level.background  || [];
        level.levelExtras = level.levelExtras || ['camera'];
        
        return level;
    };
    
    /**######################
    ###
    ###   UTILITY
    ###
    ######################*/
    
    /**
     * Creates locX, locY and locZ keys from items in position array.
     * @method processPosition
     * @param obj {Object} Object potentially containing a position array
    */
    self.processPosition = self.processPosition || function(obj) {
        var locX = obj.locX || 0;
        var locY = obj.locY || 0;
        var locZ = obj.locZ || 0;
        
        if (obj.position) {
            var position = obj.position;
            var l = position.length;
            if (l > 0) {
                locX = position[0];
            }
            if (l > 1) {
                locY = position[1];
            }
            if (l > 2) {
                locZ = position[2];
            }
            
            obj.locX = locX;
            obj.locY = locY;
            obj.locZ = locZ;
            
            delete obj.position;
        }
    };
    
    
    /**
     * Remove attached from value and given to level.following
     * @param key {string} The key that will be used to reference the attached data
     * @param value {object} The specification that may have an 'attached' property
     * @param level {Level Specification} The level that we are attaching information to
     * @method processAttached
    */
    self.processAttached = self.processAttached || function(key, value, level) {
        if (value.attached) {
            if (key) {
                level.following[key] = value.attached;
            }
            delete value.attached;
        }
    };
    
    /**
     * Gets a template Helper from a spec
     * @param manager {:api:`gma.manager`}
     * @param templateSpec {String} Name of the template
     * @method determineTemplate
    */
    self.determineTemplate = self.determineTemplate || function(manager, templateSpec) {
        templateSpec = templateSpec || "cube";
        if (_.isString(templateSpec)) {
            var temp = templateSpec;
            templateSpec = self.templates[templateSpec];
            if (!templateSpec) {
                throw new Error("No such template as " + temp);
            }
        }
        
        if (!_.isArray(templateSpec)) {
            templateSpec = [templateSpec];
        }
        return manager.determineObject.apply(this, templateSpec);
    }
    
    /**######################
    ###
    ###   OTHER
    ###
    ######################*/
    
    /**
     * Validates other stuff
     * For the moment, nothing happens
     * @method validate_other
     * @param manager {:api:`gma.manager`}
     * @param key {String} The key of the parent object this value belongs to
     * @param value {Object} The value object being validated
     * @param level {Level Specification} The level currently being parsed
     * @return {Boolean}
    */
    self.validate_other = self.validate_other || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes other stuff
     * For the moment, nothing happens
     * @method process_other
     * @param manager {:api:`gma.manager`}
     * @param key {String} The key of the parent object this value belongs to
     * @param value {Object} The value object being processed
     * @param level {Level Specification} The level currently being parsed
     * @return {Boolean}
    */
    self.process_other = self.process_other || function(manager, key, value, level) {
    };
    
    /**######################
    ###
    ###   SPAWN
    ###
    ######################*/
    
    /**
     * Returns default value for the spawn object
     * @method default_spawn
    */
    self.default_spawn = self.default_spawn || function() {
        return {};
    };
    
    /**
     * Validates a spawn object
     * Spawn must be an object of {id : [x, y]}
     * @method validate_spawn
     * @copy validate_other
    */
    self.validate_spawn = self.validate_spawn || function(manager, key, value, level) {
        var valid = true;
        if (_.isArray(value) || _.isNumber(value) || _.isString(value) || _.isBoolean(value)) {
            valid = false;
            throw new Error("Spawn must be an object of {id : [x, y]}, not " + value);
        }
        
        _.each(value, function(v, k) {
            if (!_.isArray(v)) {
                valid = false;
                throw new Error("Each spawn location must be an array of [x, y], not " + v);
            }
            else {
                if (v.length > 2) {
                    valid = false;
                    throw new Error("Spawn location " + k + " should be [x, y], not " + v);
                }
            }
        });
        return valid;
    };
    
    /**
     * Processes a spawn object
     * Must ensure each position array has two numbers in it
     * @method process_spawn
     * @copy process_other
    */
    self.process_spawn = self.process_spawn || function(manager, key, value, level) {
        _.each(value, function(v, k) {
            if (v.length === 0) {
                // Don't have an x co-ordinate, so give it one
                v.push(0);
            }
            
            if (v.length === 1) {
                // Only have x co-ordinate, so we're giving it a y co-ordinate
                v.push(0);
            }
        });
    };

    /**######################
    ###
    ###   CAMERA
    ###
    ######################*/
    
    /**
     * Returns default value for the camera object
     * @method default_camera
    */
    self.default_camera = self.default_camera || function() {
        return {position : [0, 0, 50], attached : ['character']};
    };
    
    /**
     * Validates a camera specification
     * Camera must be an object
     * @method validate_camera
     * @copy validate_other
    */
    self.validate_camera = self.validate_camera || function(manager, key, value, level) {
        var valid = true;
        if (_.isArray(value) || _.isNumber(value) || _.isString(value) || _.isBoolean(value)) {
            valid = false;
            throw new Error("Camera must be an object, not " + value);
        }
        
        return valid;
    };
    
    /**
     * Processes a camera specification
     * Turn position in locX, locY and locZ
     * Remove attached from value and given to level.following
     * @method process_camera
     * @copy process_other
    */
    self.process_camera = self.process_camera || function(manager, key, value, level) {
        self.processPosition(value);
        self.processAttached(key, value, level);
    };
    
    /**######################
    ###
    ###   LIGHT
    ###
    ######################*/
    
    /**
     * Returns default value for the light object
     * @method default_light
    */
    self.default_light = self.default_light || function() {
        return {};
    };
    
    /**
     * Validates a light object
     * Light must be an array
     * @method validate_light
     * @copy validate_other
    */
    self.validate_light = self.validate_light || function(manager, key, value, level) {
        var valid = true;
        if (_.isArray(value) || _.isString(value) || _.isBoolean(value) || _.isNumber(value)) {
            valid = false;
            throw new Error("Light must be an object, not " + value);
        }
        
        return valid;
    };
    
    /**
     * Processes a light object
     * Turn position in locX, locY and locZ
     * Remove attached from level and given to level.following
     * @method process_light
     * @copy process_other
    */
    self.process_light = self.process_light || function(manager, key, value, level) {
        _.each(value, function(v, k) {
            level.levelExtras.push(k);
            self.processPosition(v);
            self.processAttached(k, v, level);
        });
    };
    
    /**######################
    ###
    ###   ENTITIES
    ###
    ######################*/
    
    /**
     * Returns default value for the entities list
     * @method default_entities
    */
    self.default_entities = self.default_entities || function() {
        return [];
    };
    
    /**
     * Validates an entities list
     * Entities must be an array
     * @method validate_entities
     * @copy validate_other
    */
    self.validate_entities = self.validate_entities || function(manager, key, value, level) {
        var valid = true;
        if (!_.isArray(value)) {
            valid = false;
            throw new Error("Entities must be a list, not " + value);
        }
        
        return valid;
    };
    
    /**
     * Processes a entities list
     * Turns them into gamma objects
     * @method process_entities
     * @copy process_other
    */
    
    self.process_entities = self.process_entities || function(manager, key, value, level) {
        _.each(value, function(obj, index) {
            if (obj.type === undefined) {
                obj.type = "default";
            }
            var templateSpec = obj.template;
            if (!_.any(obj, function(v, k) { return _.isFunction(v) && k !== 'getRotation'; })) {
                var typeInfo = self.types[obj.type];
                if (!typeInfo) {
                    throw new Error("No such type as " + obj.type);
                }
                
                // Don't need type on the object anymore
                delete obj.type;
                
                var typeName = typeInfo[0];
                var typeOpts = {};
                if (typeInfo[1]) {
                    _.each(typeInfo[1], function(v, k) {
                        typeOpts[k] = v;
                    });
                }
                
                if (obj) {
                    _.each(obj, function(v, k) {
                        typeOpts[k] = v;
                    });
                }
            
                templateSpec = templateSpec || typeOpts.template;
                delete typeOpts.template;
                
                obj = manager.determineObject(typeName, typeOpts);
            }
            
            var templateHelper = self.determineTemplate(manager, templateSpec);
            var focus = manager.prepareEntity(obj, templateHelper);
            value[index] = focus;
        });  
    };
    
    /**######################
    ###
    ###   BACKGROUND
    ###
    ######################*/
    
    /**
     * Validates a background list
     * @method validate_background
     * @copy validate_other
    */
    self.validate_background = self.validate_background || function(manager, key, value, level) {
        var valid = true;
        if (!_.isArray(value)) {
            valid = false;
            throw new Error("Background must be a list, not " + value);
        }
        
        return valid;
    };
    
    /**
     * Processes a background list
     * Just adds to self.background
     * @method process_background
     * @copy process_other
    */
    self.process_background = self.process_background || function(manager, key, value, level) {
        if (self.backgroundMaker === undefined) {
            self.backgroundMaker = gma.backgroundMaker({z:level.backgroundZ || -20})
        }
        
        var items = _.map(value, function(v) {
            if (v !== null && v !== undefined) {
                v.template = self.determineTemplate(manager, v.template);
            }
            return self.backgroundMaker.process(manager, v);
        });
        
        level.background = [];
        _.each(items, function(item) {
            if (item !== null && item !== undefined) {
                self.processAttached(item.id, item, level);
                if (item.id) {
                    level.bkgIds.push(item.id);
                }
                level.background.push(item);
            }
        });
    };
    
    /**######################
    ###
    ###   TYPES
    ###
    ######################*/
    
    /**
     * Validates a types object
     * @method validate_types
     * @copy validate_other
    */
    self.validate_types = self.validate_types || function(manager, key, value, level) {
        var valid = true;
        
        _.each(value, function(v, k) {
            if (!_.isArray(v)) {
                valid = false;
                throw new Error("Types must be arrays of [type, opts] Where type is a string name of the type, or the type itself");
            }
        });
        
        return valid;
    };
    
    /**
     * Processes a types object
     * Just adds to self.types
     * @method process_types
     * @copy process_other
    */
    self.process_types = self.process_types || function(manager, key, value, level) {
        _.each(value, function(v, k) {
            self.types[k] = v;
        });
    };
    
    /**######################
    ###
    ###   TEMPLATES
    ###
    ######################*/
    
    /**
     * Validates a templates object
     * @method validate_templates
     * @copy validate_other
    */
    self.validate_templates = self.validate_templates || function(manager, key, value, level) {
        var valid = true;
        
        _.each(value, function(v, k) {
            if (!_.isArray(v) && !_.any(v, function(v2, k2) { return _.isFunction(v[k2]);})) {
                valid = false;
                throw new Error("Templates must be arrays of [template, opts] Where template is a string name of the template, or the template itself");
            }
        });
        
        return valid;
    };
    
    /**
     * Processes a templates object
     * Just adds to self.templates
     * @method process_templates
     * @copy process_other
    */
    self.process_templates = self.process_templates || function(manager, key, value, level) {
        _.each(value, function(v, k) {
            self.templates[k] = v;
        });
    };        
    /**######################
    ###
    ###   BKGIDS
    ###
    ######################*/
    
    /**
     * Validates bkgIds
     * This is populated by process_background
     * @method validate_bkgIds
     * @copy validate_other
    */
    self.validate_bkgIds = self.validate_bkgIds || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes bkgIds
     * This is populated by process_background
     * @method process_bkgIds
     * @copy process_other
    */
    self.process_bkgIds = self.process_bkgIds || function(manager, key, value, level) {
    };
    
    /**######################
    ###
    ###   LEVEL EXTRAS
    ###
    ######################*/
    
    /**
     * Validates level extras specification
     * This is generated at run time and should be ignored
     * @method validate_levelExtras
     * @copy validate_other
    */
    self.validate_levelExtras = self.validate_levelExtras || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes level extras stuff
     * This is generated at run time and should be ignored
     * @method process_levelExtras
     * @copy process_other
    */
    self.process_levelExtras = self.process_levelExtras || function(manager, key, value, level) {
    };
    
    /**######################
    ###
    ###   FOLLOWING
    ###
    ######################*/
    
    /**
     * Validates following specification
     * This is generated at run time and should be ignored
     * @method validate_following
     * @copy validate_other
    */
    self.validate_following = self.validate_following || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes following stuff
     * This is generated at run time and should be ignored
     * @method process_following
     * @copy process_other
    */
    self.process_following = self.process_following || function(manager, key, value, level) {
    };
    
    /**######################
    ###
    ###   REMOVED
    ###
    ######################*/
    
    /**
     * Validates removed stuff
     * This is generated at run time and should be ignored
     * @method validate_removed
     * @copy validate_other
    */
    self.validate_removed = self.validate_removed || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes removed stuff
     * This is generated at run time and should be ignored
     * @method process_removed
     * @copy process_other
    */
    self.process_removed = self.process_removed || function(manager, key, value, level) {
    };
    
    
    return self;
};


///////////////////////////////////////////////////////////////////////////////

    }
);
