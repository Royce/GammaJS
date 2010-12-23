/*global require, _, GLGE, window */
require.def('gma/utils/render',
    ['gma/base', 'gma/utils/base'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Sets options on a GLGE object
         * @param obj {object} The object we are setting options on
         * @param opts {Object} The options to set on the object
         * @param avoid {[String]} List of options not to set on object
         * @method setProperties
         * @private
        */
        var setProperties = function(obj, opts, avoid) {
            var func;
            _.each(opts, function(value, key) {
                if (!avoid || !_.any(_.map(avoid, function(k) {return k === key;}))) {
                    func = obj["set" + key[0].toUpperCase() + key.substr(1)];
                    if (_.isFunction(func)) {
                        func.apply(obj, [value]);
                    }
                }
            });
        };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Connects the rendering library to gamma manager
     * @class sceneHelper
    */
    gma.sceneHelper = function(spec) {
    
        var self = spec || {};
        
        /**
         * Dictionairy of {id:render Helpers} for things to appear in background
         * @property bkgIds
         * @type {{id : :api:`gma.renderHelper`}}
        */
        self.bkgIds = self.bkgIds || {};
        
        /**
         * List of render Helpers for things to appear in background
         * @property background
         * @type {[:api:`gma.renderHelper`]}
        */
        self.background = self.background || [];
        
        /**
         * List of extra objects to be rendered in the scene
         * @property extras
         * @type {name : obj}
        */
        self.extras = self.extras || {};
        
        /**
         * List associating GLGE objects to gamma objects
         * @property attached
         * @type {name : [obj, offsetX, offsetY]}
        */
        self.attached = self.attached || {};
        
        /**
         * The GLGE.Scene being rendered
         * @property scene
         * @type :glge:`Scene`
        */
        self.scene = self.scene || (function() {
            self.scene = new GLGE.Scene();
            self.scene.setAmbientColor("#999");
            self.scene.setBackgroundColor("#999");
            return self.scene;
        })();
        
        /**
         * The GLGE.Renderer being used
         * @property renderer
         * @type :glge:`Renderer`
        */
        
        /**
         * The GLGE.Document being used
         * @property doc
         * @type :glge:`Document`
        */
        
        /**
         * The GLGE.Group that holds everything
         * @property grp
         * @type :glge:`Group`
        */
        self.grp = new GLGE.Group();
          
        /**
         * Initialises the GLGE scene
         * @param manager {:api:`gma.manager`}
         * @param resources {[String]} a list of paths to xml files
         * @param callback {function} The callback to call when the document is loaded
         * @method init
        */
        self.init = self.init || function (manager, resources, callback) {
            self.doc = self.doc || new GLGE.Document();
            self.doc.onLoad = function() {
                callback();
            };
            
            if (resources && resources.length > 0) {
                _.each(resources, function(resource) {
                    self.doc.loadDocument(resource);
                });
            }
            else {
                self.doc.onLoad();
            }
            
        };
        
        /**
         * Setups the scene with a camera, group and extras
         * @method setupScene
         * @param manager {:api:`gma.manager`}
        */
        self.setupScene = self.setupScene || function(manager) {
            if (!self.extras.camera) {
                self.extras.camera = new GLGE.Camera();
            }
            
            self.scene.camera = self.extras.camera;
            _.each(self.extras, function(extra) {
                self.grp.addObject(extra);
            });
            
            self.scene.addChild(self.grp);
            
            // Need to attach scene to renderer even if renderer already exists
            // Otherwise lights don't work properly
            // If we have no renderer, then this is done inside the render method
            // For the purpose of making sure tests pass in non-webgl browsers,
            // We make sure a renderer exists before doing this
            self.renderer && self.makeRenderer(manager);
        };
        
        /**
         * Function that creates renderer object
         * And sets the scene
         * @method makeRenderer
         * @param manager {:api:`gma.manager`}
        */
        self.makeRenderer = self.makeRenderer || function(manager) {
            self.renderer = self.renderer || new GLGE.Renderer(manager.canvas);
            self.renderer.setScene(self.scene);
        };
        
        /**
         * Function that clears everything from the scene
         * @method clear
        */
        self.clear = self.clear || function () {
            self.scene.removeChild(self.grp);
        }; 
        
        /**
         * Function that adds a helper to the scene
         * @method add
         * @param helper {gma.renderHelper}
        */
        self.add = self.add || function (helper) {
            helper.addTo(self.grp);
        };
        
        /**
         * Returns how many things are rendered by the scene
         * @method countContained
        */
        self.countContained = self.countContained || function () {
            return self.grp.children.length;
        };
        
        /**
         * Function that sets locations and renders the scene
         * @method render
         * @param manager {:api:`gma.manager`}
        */
        self.render = self.render || function (manager) {
            // Create renderer at last possible moment
            // Purely so that tests run in non-webgl browsers without failing
            self.renderer || self.makeRenderer(manager);
            
            // Set location of all rendered objects
            self.setRenderedLocations(manager);
            
            // Render !
            self.renderer.render();
        };
        
        /**
         * Sets locations of everything in the scene
         * @method setRenderedLocations
         * @param manager {:api:`gma.manager`}
        */
        self.setRenderedLocations = self.setRenderedLocations || function (manager) {
            _.each(manager.entities(), function(focus) {
                if (focus.helper) {
                    focus.helper.setLocation();
                }
            });
            
            _.each(self.attached, function(value, key) {
                var obj = value[0];
                var ofx = value[1];
                var ofy = value[2];
                var ofz = value[3];
                var extra = self.extras[key];
                if (!extra) {
                    extra = self.bkgIds[key].getRenderedObj();
                }
                if (extra) {
                    extra.setLocX(obj.x + ofx);
                    extra.setLocY(obj.y + ofy);
                    if (ofz) {
                    	extra.setLocZ(obj.z + ofz);
                    }
                }
            });
        };
        
        /**
         * Adds other objects into the scene
         * @method addExtra
         * @param name {String}
         * @param type {String}
         * @param spec {Object}
         * @return {Object just added}
        */
        self.addExtra = self.addExtra || function (name, type, spec) {
            var obj = spec || {};
            var isNew = false;
            
            if (type === 'background') {
                if (spec) {
                    self.background.push(spec);
                    if (spec.id) {
                        self.bkgIds[spec.id] = spec;
                    }
                }
                return spec;
            }
            
            if (type === 'light') {
                if (obj.className != 'Light') {
                    obj = new GLGE.Light();
                    isNew = true;
                }
            }
            
            if (type === 'camera') {
                if (obj.className != "Camera") {
                    obj = new GLGE.Camera();
                    isNew = true;
                }
            }
            
            if (spec && isNew) {
                setProperties(obj, spec);
            }
            
            obj.setId(name);
            self.extras[name] = obj;
            return obj;
        };
        
        /**
         * Removes specified extras from the scene helper
         * @method removeExtras
         * @param extras {[String]} List of extra ids to remove
        */
        self.removeExtras = self.removeExtras || function(extras) {
            if (extras) {
                _.each(extras, function(extra) {
                    var next = self.extras[extra];
                    if (next) {
                        self.grp.removeChild(next);
                        self.extras[extra] = undefined;
                        delete self.extras[extra];
                    }
                });
            }
        };
        
        /**
         * Removes specified background from the scene helper
         * @method removeBackground
         * @param backgrounds {[String]} List of background ids to remove
        */
        self.removeBackground = self.removeBackground || function(backgrounds) {
            if (backgrounds) {
                _.each(backgrounds, function(id) {
                    var next = self.bkgIds[id];
                    if (next) {
                        next.remove && next.remove();
                        self.bkgIds[id] = undefined;
                        delete self.bkgIds[id];
                    }
                });
            }
            
            if (self.background) {
                temp = [];
                _.each(self.background, function(b) {
                    if (b.id && self.bkgIds[b.id]) {
                        temp.push(b);
                    }
                    else {
                        b.remove && b.remove();
                    }
                });
                
                self.background = temp;
            }
        };
        
        /**
         * Records the necessary information to allow an object to follow another
         * @method attach
         * @param name {String} Name of the object in self.extras we are attaching the gma object to
         * @param obj {:api:`gma.shapes.rectangle`}
         * @param offsetX {Number}
         * @param offsetY {Number}
         * @param offsetZ {Number}
        */
        self.attach = self.attach || function (name, obj, offsetX, offsetY, offsetZ) {
            self.attached[name] = [obj, offsetX || 0, offsetY || 0, offsetZ];
        };
        
        /**
         * Dissociates a object from another to stop an object following another object
         * @method detach
         * @param name {String}
        */
        self.detach = self.detach || function (name) {
            if (self.attached[name]) {
                delete self.attached[name];
            }
        };
        
        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Connects rendered object to gamma object
     * @class renderHelper
    */
    gma.renderHelper = function(spec) {
 
        var self = spec || {};
        var previousInstance;
 
        /**
         * The entity that is attached to this helper (and vice verca)
         * @property entity
         * @type Gamma object
        */
 
        /**
         * The template object
         * <strong> must be passed in or set after creation</strong>
         * @property template
         * @type :api:`gma.baseTemplate`
        */
        
        /**
         * The parent object that the rendered object belongs to
         * @property parent
         * @type :glge:`Group`
        */
        
        /**
         * Attaches an object to this helper
         * @method attachTo
         * @param obj {object} The object which we wish to attach to the helper
        */
        self.attachTo = self.attachTo || function (obj) {
            self.entity = obj;
            self._instance = undefined;
        };
        
        /**
         * Attaches the object to the group
         * @method addTo
         * @param grp {:glge:`Group`} The group that we will add the object to
        */
        self.addTo = self.addTo || function (grp) {
            self.parent = grp;
            
            var obj = self.getRenderedObj();
            obj.setScale(self.entity.width, self.entity.height, self.entity.depth);
            obj.notifyOfScale && obj.notifyOfScale(self.entity.width, self.entity.height, self.entity.depth);
            obj.setLoc(self.entity.x, self.entity.y, self.entity.z);
            
            grp.addObject(obj);
        };
        
        /**
         * Sets the location of the rendered object using self.entity
         * @method setLocation
        */
        self.setLocation = self.setLocation || function () {
            var obj = self.getRenderedObj();
            obj.setLocX(self.entity.x);
            obj.setLocY(self.entity.y);
            if (self.entity.getRotation) {
                obj.setRotY(self.entity.getRotation());
            }
        };
        
        /**
         * Gets the object that we are rendering
         * @method getRenderedObj
         * @return {:glge:`Object`}
        */
        self.getRenderedObj = self.getRenderedObj || function () {
            if (!self._instance) {
                self._instance = self.template.getInstance();
            }
            return self._instance;
        };
        
        /**
         * Removes the objects from the parent group and sets the parent to undefined
         * @method remove
        */
        self.remove = self.remove || function () {
            if (self.parent) {
                self.parent.removeChild(self.getRenderedObj());
                self.parent = undefined;
            }
        };
        
        /**
         * Toggles from rendering the desired object to rendering a unit cube (this shows the bounding box)
         * @method toggleBounding
        */
        self.toggleBounding = self.toggleBounding || function () {
            var currentInstance = self.getRenderedObj();
            var parent = self.parent;
            self.remove();
            self._instance = previousInstance || gma.unitCube.getInstance();
            previousInstance = currentInstance;
            self.addTo(parent);
        };
        
        

        return self;
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Allows the specification of a rendered object
     * @class baseTemplate
    */
    gma.baseTemplate = function(spec) {
        
        var self = spec || {};
          
        /**
         * The helper object for the scene 
         * <strong> must be passed in </strong>
         * @property sceneHelper
         * @type :api:`gma.sceneHelper`
        */
        
        /**
         * The object that we are instancing 
         * @property _blueprint
         * @type :glge:`Object`
        */
        
        /**
         * The ammount to rotate the object in the x axis 
         * @property xRot
         * @type Number
         * @default 0
        */
        self.xRot = self.xRot || 0;
        
        /**
         * The ammount to rotate the object in the y axis 
         * @property yRot
         * @type Number
         * @default 0
        */
        self.yRot = self.yRot || 0;
        
        /**
         * The ammount to rotate the object in the z axis 
         * @property zRot
         * @type Number
         * @default 0
        */
        self.zRot = self.zRot || 0;
        
        /**
         * The ammount to scale the object in the x axis 
         * @property xScale
         * @type Number
         * @default 0
        */
        self.xScale = self.xScale || 1;
        
        /**
         * The ammount to scale the object in the y axis 
         * @property yScale
         * @type Number
         * @default 0
        */
        self.yScale = self.yScale || 1;
        
        /**
         * The ammount to scale the object in the z axis 
         * @property zScale
         * @type Number
         * @default 0
        */
        self.zScale = self.zScale || 1;
        
        /**
         * The ammount to shift the object in the x axis 
         * @property xOffset
         * @type Number
         * @default 0
        */
        self.xOffset = self.xOffset || 0;
        
        /**
         * The ammount to shift the object in the y axis 
         * @property yOffset
         * @type :glge:`Object`
         * @default 0
        */
        self.yOffset = self.yOffset || 0;
        
        /**
         * The ammount to shift the object in the z axis 
         * @property zOffset
         * @type :glge:`Object`
         * @default 0
        */
        self.zOffset = self.zOffset || 0;
        
        /**
         * Determines object that will be instanced
         * @method defineInstance
         * @return {:glge:`Object`}
        */
        self.defineInstance = self.defineInstance || function () {
            return new GLGE.Object();
        };
        
        /**
         * Puts the object into a GLGE group and offsets its position appropriately
         * It then returns a new instance of the group
         * @method getInstance
         * @return {:glge:`Group`}
        */
        self.getInstance = self.getInstance || function () {
            var raw = self.defineInstance();
            var grp = new GLGE.Group();
            raw.setLoc(self.xOffset, self.yOffset, self.zOffset);
            raw.setScale(self.xScale, self.yScale, self.zScale);
            raw.setRot(self.xRot, self.yRot, self.zRot);
            grp.addChild(raw);
            grp.notifyOfScale = raw.notifyOfScale || function() {};
            return grp;
        };

        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides the specification of a collada object
     * @extends gma.baseTemplate
     * @class colladaTemplate
    */
    gma.colladaTemplate = function(spec) {
    
        var self = gma.baseTemplate(spec || {});

        /** @method defineInstance */
        self.defineInstance = function() {
            var obj = new GLGE.Collada();
            if (self.collada.document) {
                obj.setDocument(self.collada.document, obj.getAbsolutePath(window.location.toString(), null));
            }
            if (self.collada) {
                setProperties(obj, self.collada, ['document']);
            }
            return obj;
        };
        
        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Allows the specification of an object that exists within the xml
     * @extends gma.baseTemplate
     * @class glgeIDTemplate
    */
    gma.glgeIDTemplate = function(spec) {
    
        var self = gma.baseTemplate(spec || {});

        /** @method defineInstance */
        self.defineInstance = function() {
            return self.sceneHelper.doc.getElement(self.id);
        };
        
        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides the specification of an object which is using a mesh
     * @extends gma.baseTemplate
     * @class meshTemplate
    */
    gma.meshTemplate = function(spec) {
    
        var self = gma.baseTemplate(spec || {});

        /** 
        * Meshtemplate will look for mesh and material options
        * It will create mesh and material objects from these options
        * That are then attached a GLGE Object, which is returned
        * @method defineInstance 
        */
        self.defineInstance = function() {
            var obj = new GLGE.Object();
            var material;
            
            if (self.mesh) {
                var mesh = new GLGE.Mesh();
                setProperties(mesh, self.mesh);
                obj.setMesh(mesh);
            }
            
            if (self.material) {
                material = new GLGE.Material();
                setProperties(material, self.material);
                obj.setMaterial(material);
            }
            else if (self.texture) {
                var materialLayer = new GLGE.MaterialLayer();
                var texture = new GLGE.Texture()
                
                texture.setSrc(self.texture.src);
                
                materialLayer.setMapinput(GLGE.UV1);
                materialLayer.setMapto(GLGE.M_COLOR);
                materialLayer.setTexture(texture);
                
                obj.notifyOfScale = function(_width, _height, _depth) {
                    materialLayer.setDScaleX(self.texture.repeatX * _width);
                    materialLayer.setDScaleY(self.texture.repeatY * _height);
                };
                
                material = new GLGE.Material();
                obj.setMaterial(material);
                material.addTexture(texture);
                material.addMaterialLayer(materialLayer);
            }
            return obj;
        };
        
        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /** @for gma */
    
    /**
     * Info used to create Unit cube template
     * @property unitCubeInfo
     * @type Object
    */
    gma.unitCubeInfo = {
        mesh : {
            positions : [0.5 , 0.5 , -0.5 , 0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , -0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , 0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , -0.5 , 0.5 , 0.5],
		
            normals : [0 , 0 , -0.5 , 0 , 0 , -0.5 , 0 , 0 , -0.5 , 0 , 0 , -0.5 , 0 , -0 , 0.5 , 0 , -0 , 0.5 , 0 , -0 , 0.5 , 0 , -0 , 0.5 , 0.5 , -0 , 0 , 0.5 , -0 , 0 , 0.5 , -0 , 0 , 0.5 , -0 , 0 , -0 , -0.5 , -0 , -0 , -0.5 , -0 , -0 , -0.5 , -0 , -0 , -0.5 , -0 , -0.5 , 0 , -0 , -0.5 , 0 , -0 , -0.5 , 0 , -0 , -0.5 , 0 , -0 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0 , 0.5 , 0],

            UV : [0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5],

            faces : [0 , 1 , 2 , 0 , 2 , 3 , 4 , 5 , 6 , 4 , 6 , 7 , 8 , 9 , 10 , 8 , 10 , 11 , 12 , 13 , 14 , 12 , 14 , 15 , 16 , 17 , 18 , 16 , 18 , 19 , 20 , 21 , 22 , 20 , 22 , 23]
        },
        
        material : {
            color:"#009"
        }
    };
    
    /**
     * An instantiated meshTemplate using unitCubeInfo
     * @property unitCube
     * @type :api:`gma.meshTemplate`
    */
    gma.unitCube = gma.meshTemplate(gma.unitCubeInfo);

///////////////////////////////////////////////////////////////////////////////

    }
);
