/*global require, $, _, window, setTimeout*/
require.def('gma/manager',
    [
        'gma/base', 
        'gma/entities/platform', 
        'gma/utils/hud', 
        'gma/utils/render',
        'gma/utils/parser'
    ],
    function(gma) {
    
        /** 
         * Everything resides under the gma namespace
         * @module gma 
        */
        
        /**
         * Provides basic setup functionality
         * @class manager
        */
        gma.manager = function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////
    
    /**######################
    ###
    ###   CANVAS/CONTAINER
    ###
    ######################*/
    
    /**
     * Holds the width of the canvas
     * @property width
     * @type Number
     * @default 800
    */
    self.width = self.width || 800;
    
    /**
     * Holds the height of the canvas
     * @property height
     * @type Number
     * @default 600
    */
    self.height = self.height || 600;
    
    /**
     * Id for the gamma div
     * @property containerID
     * @type String
     * @default "gamma"
    */
    self.containerID = self.containerID || "gamma";

    /**
     * The gamma div
     * @property container
     * @type Element
     * @default $("#gamma")
    */
    self.container = self.container || $("#"+self.containerID);
    self.container.css({'width': self.width, 'height': self.height});
    
    /**
     * Holds the canvas
     * @property canvas
     * @type DOM Element
    */
    self.canvas = self.canvas || function() {
        var canvas = self.container.find("canvas");
        if (canvas.length === 0) {
            self.container.html('<canvas id="theCanvas" height="'+self.height+'" width="'+self.width+'"></canvas>');
            canvas = self.container.find("canvas");
        }
        return canvas[0];
    }();    
    
    /**######################
    ###
    ###   RENDERING
    ###
    ######################*/
    
    /**
     * Helper object connecting manager to rendering library
     * @property sceneHelper
     * @type :api:`gma.sceneHelper`
    */
    self.sceneHelper = self.sceneHelper || gma.sceneHelper();
    
    /**
     * List of resources to give the renderer
     * @property resources
     * @type [String]
    */
    self.resources = self.resources || [];
    
    /**######################
    ###
    ###   OTHER
    ###
    ######################*/

    /**
     * The manager's levelParser object
     * @property levelParser
     * @type :api:`gma.levelParser`
    */
    self.levelParser = self.levelParser || gma.levelParser();

    /**
     * Holds the level specs
     * @property levels
     * @type List
     * @default []
    */
    self.levels = self.levels || [];

    /**
     * Holds the level index. (a level must be loaded first for it to be accurate)
     * @property levelIndex
     * @type Number
     * @default 0
    */
    self.levelIndex = self.levelIndex || 0;
    
    /**
     * Holds the hud
     * @property hud
     * @type :api:`gma.hud`
    */
    self.hud = self.hud || gma.hud({
        canvasContainer: self.container
    });
    
    /**
     * Specifies whether it should display a loading message
     * @property showLoading
     * @type Boolean
     * @default true
    */
    if (self.showLoading !== false) {
        self.showLoading = true;
    }
    
    if (self.showLoading) {
        self.hud.displayMessage("Loading...", 500);
    }
    
    /**
     * Holds a character object
     * This is optional
     * @property character
     * @type :api:`gma.character`
     * @default undefined
    */
    
    /**######################
    ###
    ###   PRIVATE
    ###
    ######################*/
    
    /**
     * Holds the last time scene was rendered
     * @private
     * @property time
     * @type Number
    */
    var time;
    
    /**
     * Holds an accumulation of time to be used for fps calculation
     * @private
     * @property counter
     * @type Number
     * @default 0
    */
    var counter = 0;
    
    /**
     * Holds the frames per second
     * @private
     * @property fps
     * @type Number
     * @default 0
    */
    var fps = 0;
    
    /**
     * Number of times the scene has twitched since fps last calculated
     * @private
     * @property twitchCount
     * @type Number
     * @default 0
    */
    var twitchCount = 0;
    
    /**######################
    ###
    ###   GETTERS
    ###
    ######################*/
    
    /**
     * Get the current FPS
     * @method getFPS
     * @return {Number}
    */
    self.getFPS = self.getFPS || function() {
        return fps;
    };

    /**
     * Returns a list of all background
     * @method background
     * @return {Array}
    */
    self.background = self.background || function() {
        if (self.sceneHelper && self.sceneHelper.background) {
            return self.sceneHelper.background;
        }
        else {
            return [];
        }
    };

    /**
     * Returns a list of all entities in the current level
     * @method entities
     * @return {Array}
    */
    self.entities = self.entities || function() {
        if (self.currentLevel) {
            if (self.character && self.character.alive) {
                return _.flatten([self.currentLevel.entities, self.character]);
            }
            else {
                return self.currentLevel.entities;
            }
        }
        else {
            return [];
        }
    };

    /**
     * Returns a gamma object given the type given
     * If type is a string, then we look on gma to see if it exists
     * Otherwise it is used as is
     * And any options supplied in the opts object is applied to this object
     * @method determineObject
     * @param type {Gamma Object or string} Name of a gamma object or just a gamma object
     * @param opts {Gamma Object or string} Name of a gamma object or just a gamma object
     * @return {Gamma Object}
    */
    self.determineObject = self.determineObject || function(type, opts) {
        if (_.isString(type)) {
            var obj = gma[type];
            if (obj) {
                type = gma[type](opts);
            }
            else {
                throw new Error("No such object as gma." + type);
            }
        }
        else {
            if (opts) {
                _.each(opts, function(value, key) {
                    type[key] = value;
                });
            }
        }
        return type;
    };

    /**
     * Attaches renderHelper and renderTemplate to the gamma object given
     * Also applies any extra options to this Gamma object
     * @method prepareEntity
     * @param focus {Gamma Object} Gamma object
     * @param template {renderTemplate} A renderTemplate object to be given to the gamma object
     * @param opts {{}} Options to be applied to the gamma object
     * @return {Gamma Object}
    */
    self.prepareEntity = self.prepareEntity || function(focus, template, opts) {
        if (opts) {
            _.each(opts, function(value, key) {
                focus[key] = value;
            });
        }
        
        focus.helper = gma.renderHelper({template : template || gma.unitCube});
        focus.helper.template.sceneHelper = self.sceneHelper;
        focus.helper.attachTo(focus);
        return focus;        
    };
    
    /**######################
    ###
    ###   LEVEL STUFF
    ###
    ######################*/
    
    /**
     * Gives an object othe levelParser to process, without storing the result anywhere
     * Useful for giving the levelParser type and template specifications
     * Which end up stored on the levelParser
     * @method addCustomDefinitions
     * @param opts {Object} Options that are given to the levelParser
    */
    self.addCustomDefinitions = self.addCustomDefinitions || function(opts) {
        self.levelParser.process(self, opts);
    }
    
    /**
     * Stores level specifications on the manager
     * @method storeLevels
     * @param levels {Array} A list of level objets to store
     * @param replaceAll {Boolean} Flag specifying whether to replace all current levels
    */
    self.storeLevels = self.storeLevels || function(levels, replaceAll) {
        if (replaceAll) {
            self.levels = [];
        } 
        
        if (!_.isArray(levels)) {
            levels = [levels];
        }
        
        self.levels = _.flatten([self.levels, levels]);
    };

    /**
     * Will load the specified level into the manager
     * Or the first level in self.levels if no level is specified
     * Or complain if manager has no stored levels
     * It will also remove any current levels in the manager
     * And set the position of the character according to the spawn location specified
     * @method loadLevel
     * @param level {Number} The index of the level to load
     * @param spawnId {String} Id of the spawn location for character
    */
    self.loadLevel = self.loadLevel || function(level, spawnId) {
        if (!self.levelParser) {
            throw new Error("The manager must be given a level parser object before it can load a level");
        }
        
        if (!_.isArray(self.levels) || self.levels.length === 0) {
            throw new Error("You must call storeLevels on the manager first before you can load any level");
        }
        
        if (level > self.levels.length-1) {
            throw new Error("No level at index " + level + ", manager only has " + self.levels.length + " levels");
        }
        
        // Clear the current level
        self.clearLevel();
        
        // Make sure we have somewhere to spawn
        if (!spawnId) {
            spawnId = 'main';
        }
        
        //make sure we have a level number
        level = self.levelIndex = level || 0;
        
        //Process the level
        //Put processed level back in self.levels
        //And keep a reference for the rest of this function
        level = self.levels[level] = self.levelParser.process(self, self.levels[level]);
        
        var sh = self.sceneHelper;
        if (self.character) {
            // Move the character to it's spawn point
            self.character.setBottomLeft(level.spawn[spawnId]);
            
            // Discover what template the character has
            var characterTemplate = self.character.template || "cube";
            var characterNeedsTemplate = false;
            if (_.isString(characterTemplate)) {
                characterTemplate = self.levelParser.templates[self.character.template];
                characterNeedsTemplate = true;
            }
            
            // Ensure character has a template and render helper
            if (characterNeedsTemplate || !self.character.helper) {
                if (!_.isArray(characterTemplate)) {
                    characterTemplate = [characterTemplate];
                }
                var template = self.determineObject.apply(this, characterTemplate);
                self.prepareEntity(self.character, template);
                self.character.template = template;
            }
        };
        
        // Add the camera
        level.camera = sh.addExtra("camera", "camera", level.camera);
        
        // Add the lights
        _.each(level.light, function(opts, id) {
            level.light[id] = sh.addExtra(id, "light", opts);
        });
        
        // Add the background
        _.each(level.background, function(v) {
            sh.addExtra(v.id, "background", v);
        });
        
        //TODO :: Have the capacity for other types of extras
        
        // Attach things
        _.each(level.following, function(opts, followed) {
            if (opts[0] === 'character') {
                opts[0] = self.character;
            }
            if (opts[0]) {
                sh.attach.curry(followed).apply(this, opts);
            }
        });
        
        //Make the currentLevel equal to this level
        self.currentLevel = level;
        
        // Add back any reincarnating dead entities
        // And ensure they aren't in removed anymore
        // So they can't potentially be readded later
        var focus;
        while (level.removed.length > 0) {
            focus = level.removed.pop();
            focus.alive = true;
            level.entities.push(focus);
        }
        
        //Add entities to the scene
        _.each(self.entities(), function(focus) {
            sh.add(focus.helper);
        });
        
        //Add  background to the scene
        _.each(self.background(), function(helper) {
            sh.add(helper);
        });
        
        // Setup scenehelper
        sh.setupScene(self);
    };

    /**
     * Clears the current level from the scenehelper
     * @method clearLevel
    */
    self.clearLevel = self.clearLevel || function() {
        if (self.currentLevel) {
            
            // Detach things
            _.each(self.currentLevel.following, function(opts, followed) {
                self.sceneHelper.detach(followed);
            });
            
            self.sceneHelper.removeBackground(self.currentLevel.bkgIds)
            
            //Remove any level specific extras
            if (self.currentLevel.levelExtras) {
                self.sceneHelper.removeExtras(self.currentLevel.levelExtras)
            }
           
           //Remove all entities
            _.each(self.entities(), function(focus) {
                focus.helper && focus.helper.remove();
            });
            
            self.sceneHelper.clear();
        }
    };
    
    /**######################
    ###
    ###   GAME LOOP
    ###
    ######################*/
    
    /**
     * Called when we want the game to start 
     * It creates a Scene and then starts the twitch 
     * It will also call loadLevel if no level is currently loaded
     * Or if a level has been specified
     * @method init
     * @param level {Number} The index of the level to load
     * @param spawn {String} Alternate spawn point to use
    */
    self.init = self.init || function(level, spawn) {
        self.sceneHelper.init(self, self.resources, function() {
            if (!self.currentLevel || level) {
                self.loadLevel(level, spawn);
            }
            
            time = new Date();
            window.manager = self;
            setTimeout(self.twitch.curry(self), 25);
        });
    };
    
    /**
     * The game loop function 
     * Responsible for :
     * 
     * * Calling animate
     * * Calling render
     * * Calculating fps
     * * Removing entities that are dead
     * * Calling itself again to continue the loop
     * 
     * @method twitch
     * @param self {gma.manager}
    */
    self.twitch = self.twitch || function(self) {
        if (self.currentLevel) {
            if (time === undefined) {
                time = new Date();
            }
            var nextTime = new Date();
            var delta = (nextTime - time)/1000;
            counter += delta;
            twitchCount ++;
            
            self.animate(delta);
            self.removeDead(self.currentLevel.entities, self.currentLevel.removed);
            self.checkCharacter();
            
            time = nextTime;
            self.sceneHelper.render(self);
            
            if (counter > 1) {
                fps = twitchCount / counter;
                counter = 0;
                twitchCount = 0;
            }
            self.hud.refresh();
            var refreshDelta = new Date() - time;
            setTimeout(self.twitch.curry(self), refreshDelta > 30 ? 0 : 30 - refreshDelta);
        }
    };

    /**
     * Calls the animate function on objects inside the map
     * @method animate
     * @param tick {Integer} Number representing the time since the last twitch
    */
    self.animate = self.animate || function(tick) {
        _.each(self.entities(), function(focus) {
            if (focus.animate !== undefined) {
                focus.animate(tick, self);
            }
        });
    };

    /**
     * Removes any dead entities from the map
     * @method removeDead
     * @param entities {List} List of entities to look through
     * @param cemetry {List} List to add dead entities to if they have the reincarnate tag
    */
    self.removeDead = self.removeDead || function(entities, cemetry) {
        var index = 0
        var entity;
        while (index < entities.length) {
            entity = entities[index];
            if (entity.alive !== true) {
                entity.helper.remove();
                entities.splice(index, 1);
                if (entity.tags.reincarnate) {
                    cemetry.push(entity);
                }
            }
            else {
                index += 1;
            }
        }
    };

    /**
     * Determines if the character is dead and does something about it if it is
     * @method checkCharacter
    */
    self.checkCharacter = self.checkCharacter || function() {
        if (self.character && self.character.alive !== true) {
            self.character.helper.remove();
        }
    };

    /**
     * Puts character back to the beginning
     * @param spawnId {String} String specifying where to respawn the character. This defaults to "main"
     * @method respawn
    */
    self.respawn = self.respawn || function(spawnId) {
        if (self.character && self.currentLevel) {
            self.character.alive = true;
            self.character.setBottomLeft(self.currentLevel.spawn[spawnId || "main"]);
            self.sceneHelper.add(self.character.helper);
        }
    };

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);

