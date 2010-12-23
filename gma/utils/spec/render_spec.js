require(
    ['gma/base', 'gma/utils/render', 'gma/entities/character', 'gma/manager', 'gma/utils/parser'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

shared_behaviors_for "template Helper"    
    it "should have a getInstances function that returns different instances of the object provided by its determine method"
        obj = new GLGE.Object()
        helper.stub('defineInstance').and_return(obj)
        i1 = helper.getInstance()
        i2 = helper.getInstance()
        
        i1.setLocX(20)
        i2.setLocX(30)
        i1.getLocX().should.be 20
    end
end

//Describe needs no name so our reports look nicer :p
describe ""
    before_each
        manager = gma.manager()
        character = gma.character({x:0, y:0, width:1, height:2})
    end
    
    describe "Scene Helper"
        before_each
            helper = gma.sceneHelper({scene:new GLGE.Scene()})
        end
        
        after_each
            helper.clear()
        end
        
        it "should have a setRenderedLocations method"
            helper.should.respond_to "setRenderedLocations"
        end
        
        it "should be possible to make the position of extra objects relative to the position of another object"
            camera = helper.addExtra("camera", "camera", {locZ:500, locX:0, locY:0})
            helper.attach("camera", character)
            helper.attached.camera.should.eql [character, 0, 0, undefined]
            
            helper.attach("camera", character, 0, 1, 2)
            helper.attached.camera.should.eql [character, 0, 1, 2]
            
            manager.character = manager.prepareEntity(character, gma.unitCube)
            manager.storeLevels({})
            manager.loadLevel()

            character.updatePositions([1,1])
            helper.setRenderedLocations(manager)
            
            camera.getLocX().should.be character.x
            camera.getLocY().should.be character.y+1
            camera.getLocZ().should.be character.z+2
        end
        
        it "should be possible to make the position of background objects relative to the position of another object"
            level = {
                background : [
                    {config : 'skybox', id : 'rah', attached : ['character', 0, 1, 2]}
                ]
            }
            
            manager.character = manager.prepareEntity(character, gma.unitCube)
            manager.storeLevels(level)
            manager.loadLevel()
            
            character.updatePositions([1,1])
            manager.sceneHelper.setRenderedLocations(manager)
            
            obj = manager.sceneHelper.bkgIds.rah.getRenderedObj()
            obj.getLocX().should.be character.x
            obj.getLocY().should.be character.y+1
            obj.getLocZ().should.be character.z+2
        end
        
        it "should not change locZ if the entity is following something and hasn't specified offsetZ"
            camera = helper.addExtra("camera", "camera", {locZ:500, locX:2900, locY:540})
            helper.attach("camera", character)
            helper.attached.camera.should.eql [character, 0, 0, undefined]
            
            manager.character = manager.prepareEntity(character, gma.unitCube)
            manager.storeLevels({})
            manager.loadLevel()
            
            character.updatePositions([1, 1])
            helper.setRenderedLocations(manager)
            
            camera.getLocX().should.be character.x
            camera.getLocY().should.be character.y
            camera.getLocZ().should.be 500
        end
        
        it "should be possible to detach the position of an object from one of the extras"
            helper.attach("camera", {})
            helper.attached.camera.should.eql [{}, 0, 0, undefined]
            
            helper.detach("camera")
            helper.attached.camera.should.be_undefined
        end
        
        it "should be possible to detach an object that isn't attached"
            -{helper.detach("asdf")}.should.not_throw_error
        end
        
        describe "initialization"
            it "should accept a manager, list of strings to different xml files and a callback function"
                helper.should.respond_to "init"
                helper.init.length.should.be 3
            end
            
            it "should load those xml files into a GLGE document"
				doc = {'loadDocument' : -{}}
				helper.doc = doc
                
                doc.should.receive('loadDocument', 'twice')
                
                helper.init(
                    manager, 
                    ['/scripts/gma/entities/tests/test1.xml', '/scripts/gma/entities/tests/test2.xml'], 
                    -{}
                )
            end
            
            it "should call callback when all xml files are loaded"
            end
            
            it "should call onLoad even if there are no xml files"
                test = {'callback' : function() {}}
                test.should.receive('callback', 'once')
                helper.init(manager, [],  function() { test.callback() })
            end
        end
        
        describe "when setting up the Scene"
            it "should ensure the scenHelper has a camera"
                helper.extras.camera.should.be_undefined
                helper.setupScene()
                helper.extras.camera.should.not.be_undefined
                (typeof helper.extras.camera).should.be "object"
            end
            
            it "should set camera on the scene"
                helper.setupScene()
                helper.scene.camera.should.not.be_undefined
                
                // and test when there is already a camera
                helper.extras.camera.should.not.be_undefined
                helper.scene.camera = {}
                helper.setupScene()
                helper.scene.camera.should.be helper.extras.camera
            end
            
            it "should add all extras to the grp"
                helper.should.receive("setupScene").with_args(manager)
                manager.sceneHelper = helper
                manager.storeLevels({
                    light : {
                        light1 : {},
                        light2 : {},
                        light3 : {}
                    },
                    camera : {}
                })
                manager.loadLevel()
                _.each(manager.currentLevel.light, function(l) {
                    helper.grp.should.include l
                });
                
                helper.grp.should.include manager.currentLevel.camera
                
                helper.grp.children.should.have_length 4
            end
            
            it "should add the grp to the scene"
                helper.scene.children.should.have_length 0
                helper.setupScene()
                helper.scene.children.should.include helper.grp
                helper.scene.children.should.have_length 1
            end
            
            it "should not add multiple instances of grp to the scene if called before clear"
                helper.scene.children.should.have_length 0
                helper.setupScene()
                helper.setupScene()
                helper.scene.children.should.include helper.grp
                helper.scene.children.should.have_length 1
            end
            
            it "should attach scene to renderer if one exists"
                helper.stub('makeRenderer')
                helper.should.receive('makeRenderer')
                helper.renderer = {}
                helper.setupScene()
            end
        end
        
        describe "when making a Renderer"
            it "should set the renderer if one doesn't already exist"
                renderer = {}
                renderer.stub('setScene')
                GLGE.stub("Renderer").and_return(renderer)
                
                GLGE.should.receive("Renderer").with_args(manager.canvas)
                helper.makeRenderer(manager)
                helper.renderer.should.be renderer
            end
            
            it "should set the scene on the renderer"
                renderer = {}
                renderer.stub('setScene')
                GLGE.stub("Renderer").and_return(renderer)
                renderer.should.receive("setScene").with_args(helper.scene)
                helper.makeRenderer(manager)
            end
        end
        
        describe "when determining how many objects are controlled by the SceneHelper"
            it "should return the number of items in the scene helper's group"
                helper.should.receive("setupScene").with_args(manager)
                manager.sceneHelper = helper
                manager.storeLevels({
                    light : {
                        light1 : {},
                        light2 : {},
                        light3 : {}
                    },
                    camera : {},
                    entities : [
                        gma.platform({x:0, y:0, width:1, height:1}),
                        gma.platform({x:3, y:5, width:1, height:1})
                    ]
                })
                manager.loadLevel()
                _.each(manager.currentLevel.light, function(l) {
                    helper.grp.should.include l
                });
                _.each(manager.currentLevel.entities, function(e) {
                    helper.grp.should.include e.helper.getRenderedObj()
                });
                
                helper.grp.should.include manager.currentLevel.camera
                
                helper.grp.children.should.have_length 6
                helper.countContained().should.be 6
            end
            
        end
        
        describe "when removing background objects"
            it "should not break if there is no background"
                helper.removeBackground.should.not.throw_error
            end
            
            it "should remove background from bkgIds using backgrounds list"
                helper.bkgIds = {'rah' : {}, 'blah' : {}}
                helper.removeBackground(['rah'])
                _.keys(helper.bkgIds).should.eql ['blah']
                helper.bkgIds.rah.should.be_undefined
            end
            
            it "should call remove on background objects"
                var item = {remove : function() {}}
                helper.bkgIds = {'rah' : item}
                item.should.receive('remove')
                helper.removeBackground(['rah'])
            end
            
            it "should remove everything in the background list"
                helper.background = [{}, {}, {}]
                helper.removeBackground()
                helper.background.should.eql []
            end
            
            it "should call remove on everything in background list"
                var item = {remove : function() {}}
                var item2 = {remove : function() {}}
                helper.background = [item, item2]
                item.should.receive('remove')
                item2.should.receive('remove')
                helper.removeBackground()
            end
            
            it "should not call remove on items still in bkgIds"
                var item = {remove : function() {}}
                var item2 = {id : 'rah', remove : function() {}}
                helper.bkgIds['rah'] = item2
                helper.background = [item, item2]
                item.should.receive('remove')
                item2.should.not.receive('remove')
                helper.removeBackground()
            end
            
            it "should not remove items still in bkgIds"
                var item = {remove : function() {}}
                var item2 = {id : 'rah', remove : function() {}}
                helper.bkgIds['rah'] = item2
                helper.background = [item, item2]
                helper.removeBackground()
                helper.background.should.include item2
                helper.background.length.should.eql 1
            end
        end
        
        describe "when removing Extra objects"
            it "should remove any extras from the scene helper that are specified"
                helper.should.receive("setupScene").with_args(manager)
                manager.sceneHelper = helper
                manager.storeLevels({
                    light : {
                        light1 : {},
                        light2 : {},
                        light3 : {}
                    },
                })
                
                manager.loadLevel()
                helper.extras.should.include 'light1', 'light2', 'light3'
                
                helper.removeExtras(['light1', 'light3'])
                helper.extras.should.include 'light2'
                helper.extras.should.not.include 'light1', 'light3'
            end
            
            it "should remove extras from the grp as well"
                helper.should.receive("setupScene").with_args(manager)
                manager.sceneHelper = helper
                manager.storeLevels({
                    light : {
                        light1 : {},
                        light2 : {},
                        light3 : {}
                    },
                })
                manager.loadLevel()
                _.each(manager.currentLevel.light, function(l) {
                    helper.grp.should.include l
                });
                
                helper.removeExtras(['light1', 'light3'])
                helper.grp.should.include manager.currentLevel.light.light2
                helper.grp.should.include helper.scene.camera
                helper.countContained().should.be 2
            end
        end
        
        describe "when clearing the Scene"
            it "should be possible with a clear method"
                helper.should.respond_to "clear"
            end
            
            it "should remove children from the scene"
                helper.scene.addChild(helper.grp)
                helper.scene.children.should.have_length 1
                helper.clear()
                helper.scene.children.should.have_length 0
            end
        end
        
        describe "when rendering the Scene"
            it "should be possible with a render method"
                helper.should.respond_to "render"
            end
            
            it "should call setRenderedLocations"
                helper.should.receive('setRenderedLocations', 'once')
                helper.renderer = {}
                helper.renderer.stub("render")
                helper.render(manager)
            end
            
            it "should make a renderer if one doesn't exist"
                helper.renderer.should.be_undefined
                helper.makeRenderer = function() {
                    helper.renderer = {}
                    helper.renderer.stub("render")
                }
                helper.should.receive("makeRenderer").with_args(manager)
                helper.render(manager)
            end
            
            it "should call render on the renderer"
                renderer = {}
                renderer.stub("render")
                renderer.should.receive("render")
                helper.renderer = renderer
                helper.render(manager)
            end
        end
        
        describe "when adding extra objects to the scene that aren't handled by manager"
            it "should be possible to add a camera"
                helper.extras.camera.should.be_undefined
                helper.addExtra("camera", "camera", {locZ:500, locX:0, locY:0})
                helper.extras.camera.should.not.be_undefined
                helper.extras.camera.id.should.equal "camera"
            end
            
            it "should be possible to add a light"
                helper.extras.camera.should.be_undefined
                helper.addExtra("spotLight", "light", {
                    rotOrder:"ROT_XZY", rotX:0, rotY:180, rotZ:0, 
                    attenuationQuadratic:0.00, attenuationLinear:0.0, color:"#fff", 
                    attenuationConstant:2.0, type:"L_POINT"
                })
                helper.extras.spotLight.should.not.be_undefined
                helper.extras.spotLight.id.should.equal "spotLight"
            end
            
            it "should be possible to add some background"
                helper.extras.background = []
                helper.addExtra('1', 'background', {id:'1'})
                helper.background.length.should.be 1
                helper.background[0].should.eql {id:'1'}
            end
            
            it "should add background to bkgIds if it has an id"
                helper.extras.bkgIds = {}
                helper.addExtra('1', 'background', {id:'1'})
                helper.bkgIds['1'].should.eql {id:'1'}
                _.keys(helper.bkgIds).should.eql ['1']
            end
            
            it "should shouldn't add background to bkgIds if it has an id"
                helper.extras.bkgIds = {}
                helper.addExtra('1', 'background', {blah:'1'})
                helper.bkgIds.should.eql {}
            end
        end
    end
    
    describe "Render Helper"
        before_each
            helper = gma.renderHelper()
            helper.template = gma.unitCube
        end
        
        it "should have an addTo method"
            character.helper = helper
            helper.attachTo(character)
            
            grp = new GLGE.Group()
            helper.addTo(grp)
            helper.parent.should.be grp
        end
  
        describe "AttachTo method"
            it "should exist"
                helper.should.respond_to 'attachTo'
            end
            
            it "should set entity to the object passed in"
                helper.entity.should.be_undefined
                helper.attachTo(character)
                helper.entity.should_not.be_undefined
                helper.entity.tags.should_not.be_undefined
            end
            
            it "should make self._instance undefined"
                helper._instance = 2
                helper.attachTo(character)
                helper._instance.should.be_undefined
            end
        end
  
        describe "when setting Location of visual representation"
            it "should be possible with a setLocation method"
                helper.should.respond_to 'setLocation'
            end
            
            it "should set location of self._instance to the location of entity"
                character.helper = helper
                helper.attachTo(character)
                helper.setLocation()
                
                helper._instance.getLocX().should.be 0
                helper._instance.getLocY().should.be 0
                
                helper.entity.updatePositions([1, 3])
                
                helper.setLocation()
                helper._instance.getLocX().should.be 1
                helper._instance.getLocY().should.be 3
            end
        end
        
        describe "when getting the object controlling the visual representation"
            it "should be possible with a getRenderedObj method"
                helper.should.respond_to 'getRenderedObj'
            end
            
            it "should return an instance of baseTemplate"
                helper.template = {'getInstance' : function() {return 7}}
                helper.getRenderedObj().should.be 7
            end
            
            it "should not return different instances each time it is called"
                helper.template = function() {
                    self = {}
                    counter = 0
                    self.getInstance = function() {
                        counter += 1
                        return counter
                    }
                    return self
                }()
                helper.getRenderedObj().should.be 1
                helper.getRenderedObj().should.be 1
                helper.getRenderedObj().should.be 1
                
                helper.template.getInstance().should.be 2
                helper.template.getInstance().should.be 3
                
                helper.getRenderedObj().should.be 1
            end
        end
        
        describe "when toggling the visual representation"
            it "should be possible to toggle between two different visual representations"
                grp = new GLGE.Group()
                character.helper = helper
                helper.attachTo(character)
                helper.addTo(grp)
                
                instance1 = helper.getRenderedObj()
                helper.toggleBounding()
                instance2 = helper.getRenderedObj()
                
                instance1.should.not.be instance2
                
                helper.toggleBounding()
                helper.getRenderedObj().should.be instance1
                
                helper.toggleBounding()
                helper.getRenderedObj().should.be instance2
            end
        end
        
        describe "when removing itself from the scene"
            it "should not fail if has no parent"
                helper.parent.should.be_undefined
                helper.remove.should.not.throw_error
            end
            
            it "should remove helper from it's parent"
                grp = new GLGE.Group()
                character.helper = helper
                helper.attachTo(character)
                helper.addTo(grp)
                helper.parent.should.not.be_undefined
                helper.parent.children.should.include helper.getRenderedObj()
                helper.remove()
                helper.parent.should.be_undefined
            end
        end
    end
    
    describe "Base Template Helper"
        should_behave_like('template Helper')
        before_each
            helper = gma.baseTemplate()
        end
        
        it "should return a GLGE.Object object when calling defineInstance"
            helper.defineInstance().className.should.be "Object"
        end
    end
    
    describe "Collada Template helper"
        should_behave_like('template Helper')
        before_each
            helper = gma.colladaTemplate({collada : {}})
        end
        
        it "should return a GLGE.Collada object when calling defineInstance"
            helper.defineInstance().className.should.be "Group"
        end
        
        it "should call setDocument with the window's current url if given a document property in a collada spec"
            old = GLGE.Collada.prototype.setDocument
            GLGE.Collada.prototype.setDocument = function(arg1, arg2) {
                arg1.should.be '/someDocument'
                arg2.should.be new GLGE.Collada().getAbsolutePath(window.location.toString(), null)
            }
            gma.colladaTemplate({collada : {document : '/someDocument'}}).defineInstance()
            GLGE.Collada.prototype.setDocument = old
        end
    end
    
    describe "GLGEID Template helper"
        should_behave_like('template Helper')
        before_each
            helper = gma.glgeIDTemplate({id:'blob'})
            helper.sceneHelper = manager.sceneHelper
            helper.sceneHelper.doc = new GLGE.Document()
        end
        
        it "should use getElement on the scene helper's Document to get the object instance"
            helper.sceneHelper.doc.getElement = function(id) {
                id.should.be 'blob'
            }
            helper.defineInstance()
        end
        
    end
    
    describe "Mesh template Helper"
        should_behave_like('template Helper')
        before_each
            helper = gma.meshTemplate()
        end
        
        it "should return a GLGE.Object when calling defineInstance"
            helper.defineInstance().className.should.be "Object"
        end
        
        describe "with the texture option"
            it "should do what is necessary to add to specified texture to the object"
                instance = gma.meshTemplate({texture : {src : 'theUrlToTheImage'}}).defineInstance()
                
                instance.multimaterials[0].className.should.be 'MultiMaterial'
                material = instance.multimaterials[0].lods[0].material
                material.className.should.be 'Material'
                material.layers[0].mapinput.should.be GLGE.UV1
                material.layers[0].mapto.should.be GLGE.M_COLOR
                
                texture = instance.multimaterials[0].lods[0].material.textures[0]
                texture.className.should.be "Texture"
                texture.url.should.be "theUrlToTheImage"
            end
            
            it "should add a notifyOfScale method to the instance so we can tell it later what to scale to"
                helper = gma.meshTemplate({
                    texture : {
                        src : 'theURLToTheImage',
                        repeatX : 2,
                        repeatY : 3
                    }
                })
                
                instance = helper.defineInstance()
                materialLayer = instance.multimaterials[0].lods[0].material.layers[0]
                materialLayer.should.receive("setDScaleX").with_args(10)
                materialLayer.should.receive("setDScaleY").with_args(15)
                instance.notifyOfScale(5, 5)
            end
        end
    end
end

///////////////////////////////////////////////////////////////////////////////

        }
    }
)
