require(
    ['gma/base', 'gma/manager', 'gma/utils/render', 'gma/entities/platform', 'gma/entities/character', 'gma/entities/enemy', 'gma/utils/background'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

describe "Gamma Manager"
    before_each
        manager = gma.manager()
        manager.clearLevel()
        manager.sceneHelper.clear()
    end
    
    it "should have a scene helper object"
        manager.should.have_property "sceneHelper"
    end
    
    it "should have a list of resources to give to the scene helper"
        manager.should.have_property "resources"
        _.isArray(manager.resources).should.be true
    end
    
    it "should have a hud object that references the manager's container DOM Object"
        manager.should.have_property "hud"
        manager.hud.canvasContainer.should.eql manager.container
    end
    
    it "should be possible to get current fps"
        manager.should.respond_to "getFPS"
        _.isNumber(manager.getFPS()).should.be true
    end
        
    it "should have a list for level specifications to go into"
        manager.should.have_property "levels"
        _.isArray(manager.levels).should.be true
    end
    
    describe "Entities Getter"
        it "should return an empty list if no current level"
            manager.currentLevel.should.be_undefined
            manager.entities().should.eql []
        end
        
        it "should return just the current level's entities list if no character"
            manager.character.should.be_undefined
            manager.currentLevel = {entities : [1, 2, 3]}
            manager.entities().should.eql [1,2,3]
        end
        
        it "should return the current level's entities followed by character if both exist and character is alive"
            manager.character = {alive : true}
            manager.currentLevel = {entities : [1, 2, 3]}
            manager.entities().should.eql [1,2,3,{alive:true}]
        end
        
        it "should not return character as well if character is not alive"
            manager.character = {alive : false}
            manager.currentLevel= {entities : [1, 2, 3]}
            manager.entities().should.eql [1,2,3]
        end
    end
    
    describe "Background Getter"
        it "should return an empty list if the sceneHelper doesn't exist or has no background"
            manager.sceneHelper.should.not.be_undefined
            manager.sceneHelper.background = null;
            manager.background().should.eql []
            
            manager.sceneHelper = null
            manager.background().should.eql []
        end
        
        it "should return the sceneHelper's background list"
            manager.sceneHelper.background = [1,2,3]
            manager.background().should.eql [1,2,3]
        end
    end
    
    describe "Canvas and Container"
        it "should have reference to a container DOM object"
            manager.should.have_property "container"
        end
        
        it "should have reference to a canvas DOM object that is inside the container"
            manager.should.have_property "canvas"
            manager.container.should.have_one "canvas"
        end
        
        it "should be possible to specify the width and height of the canvas"
            $(manager.canvas).remove()
            manager = gma.manager({width:10, height:11})
            manager.canvas.width.should.eql 10
            manager.canvas.height.should.eql 11
        end
        
        it "should be possible to specify the id of the container DOM Object"
            manager.should.have_property "containerID"
            manager.container[0].id.should.eql manager.containerID
        end
    end
    
    describe "when determining an object"
        it "should make an object from input if it is a string"
            gma.test = function(spec) { }
            gma.should.receive("test")
            manager.determineObject("test")
        end
        
        it "should return the input object if not a string"
            object = {1:1, 2:2}
            ret = manager.determineObject(object)
            ret.should.be object
        end
        
        it "should accept options to initialize the object with when specified as a string"
            gma.test = function(spec) {  }
            spec = {1:1, 2:2}
            gma.should.receive("test").with_args(spec)
            manager.determineObject("test", spec)
        end
        
        it "should accept options to apply to input object if not a string"
            object = {1:1, 2:2}
            object[3].should.be_undefined
            object[4].should.be_undefined
            ret = manager.determineObject(object, {3:3, 4:4})
            object[3].should.be 3
            object[4].should.be 4
        end
        
        it "should complain if input string cannot be resolved on gma namespace"
            -{manager.determineObject("blah")}.should.throw_error
        end
    end
    
    describe "when preparing entities"
        before_each
            entity = gma.platform()
        end
        
        it "should be able to apply options to the entity"
            entity[3].should.be_undefined
            res = manager.prepareEntity(entity, undefined, {3:3})
            res[3].should.be 3
        end
        
        it "should provide the entity with a render helper"
            entity.helper.should.be_undefined
            manager.prepareEntity(entity)
            entity.helper.should.not.be_undefined
        end
        
        it "should give entity a unit cube template if it doesn't specify a template of it's own"
            entity.helper.should.be_undefined
            manager.prepareEntity(entity)
            entity.helper.should.not.be_undefined
            entity.helper.template.should.be gma.unitCube
        end
        
        it "should give the template a reference to the scene helper"
            entity.helper.should.be_undefined
            manager.prepareEntity(entity)
            entity.helper.should.not.be_undefined
            entity.helper.template.sceneHelper.should.be manager.sceneHelper
        end
        
        it "should attach the entity to it's render helper object"
            entity.helper.should.be_undefined
            manager.prepareEntity(entity)
            entity.helper.entity.should.eql entity
        end
    end
    
    describe "level"
        before_each
        
            manager.addCustomDefinitions({
                templates : {
                    redCube : ['meshTemplate', 
                        {
                            mesh : gma.unitCubeInfo.mesh,
                            material : {color : "#009"}
                        }
                    ]
                },
                
                types : {
                    platform : ['platform', 
                        {
                            template : 'cube'
                        }
                    ]
                }
            });
        end
        
        describe "storage"
            it "should accept a level specification to store"
                manager.levels.should.have_length 0
                manager.storeLevels({})
                manager.levels.should.have_length 1
                manager.storeLevels({})
                manager.levels.should.have_length 2
            end
            
            it "should replace all level specifications when specified"
                manager.levels.should.have_length 0
                manager.storeLevels({})
                manager.levels.should.have_length 1
                manager.storeLevels({}, replaceAll=true)
                manager.levels.should.have_length 1
            end
            
            it "should accept many levels at once"
                manager.levels.should.have_length 0
                manager.storeLevels([{}, {}, {}])
                manager.levels.should.have_length 3
            end
        end
        
        describe "loading"
            
            it "should complain if the manager doesn't have a level parser object"
                manager.levelParser = undefined
                manager.levelParser.should.be_undefined
                manager.loadLevel.should.throw_error "The manager must be given a level parser object before it can load a level"
            end
            
            it "should have a level parser object by default"
                manager.levelParser.should.not.be_undefined
                manager.loadLevel.should.not.throw_error "The manager must be given a level parser object before it can load a level"
            end
            
            it "should complain if levels isn't an array or has no levels"
                manager.levels.should.have_length 0
                -{manager.loadLevel()}.should.throw_error "You must call storeLevels on the manager first before you can load any level"
                
                manager.levels = {}
                -{manager.loadLevel()}.should.throw_error "You must call storeLevels on the manager first before you can load any level"
            end
            
            it "should complain if specified level doesn't exist"
                manager.storeLevels({})
                -{manager.loadLevel(2)}.should.throw_error "No level at index 2, manager only has 1 levels"
            end
            
            it "should clear the current level first"
                manager.should.receive("clearLevel")
                manager.storeLevels({})
                manager.loadLevel()
            end
            
            it "should use spawn id of main if no spawn is given"
                manager.character = gma.character()
                manager.storeLevels({spawn : {main : [1, 1]}})
                manager.loadLevel(0)
                manager.character.left.should.be 1
                manager.character.bottom.should.be 1
            end
            
            it "should be possible to specify what spawn point is used for the character"
                manager.character = gma.character()
                manager.storeLevels({spawn : {other : [2, 3]}})
                manager.loadLevel(0, 'other')
                manager.character.left.should.be 2
                manager.character.bottom.should.be 3
            end
            
            it "should ensure the character has a template and render helper"
                manager.character = gma.character()
                manager.character.helper.should.be_undefined
                
                manager.storeLevels({})
                manager.loadLevel()
                manager.character.helper.template.should.not.be_undefined
                manager.character.helper.should.not.be_undefined
            end
            
            it "should not complain if character already has a template and/or render helper"
                manager.character = gma.character()
                manager.character.helper.should.be_undefined
                
                manager.storeLevels([{}, {}])
                manager.loadLevel()
                manager.character.helper.template.should.not.be_undefined
                manager.character.helper.should.not.be_undefined
                
                manager.loadLevel(1)
            end
            
            it "should use the first level in the levels array if no level is specified"
                manager.character = gma.character()
                manager.storeLevels(
                    {spawn : {main : [1, 1]}},
                    {spawn : {main : [4, 5]}}
                )
                manager.loadLevel()
                manager.character.left.should.be 1
                manager.character.bottom.should.be 1
            end
            
            it "should attach the position of camera to the character if specified"
                manager.character = gma.character()
                manager.storeLevels({camera : {attached : ['character', 0, 3]}})
                manager.sceneHelper.should.receive("attach").with_args("camera", manager.character, 0, 3)
                manager.loadLevel()
            end
            
            it "should attach the position of light to the character if specified"
                manager.character = gma.character()
                manager.storeLevels({
                    camera : {},
                    
                    light : {
                        light1 : {attached : ['character', 2, 5]},
                        light2 : {}
                    }
                })
                manager.sceneHelper.should.receive("attach", 'once').with_args("light1", manager.character, 2, 5)
                manager.loadLevel()
            end
            
            it "should store processed level back in the levels array"
                manager.storeLevels([
                    {spawn : {main : [1, 1]}},
                    {spawn : {main : [4, 5]}}
                ])
                manager.levels[0].processed.should.be_undefined
                manager.levels[1].processed.should.be_undefined
                
                manager.loadLevel(0)
                manager.levels[0].processed.should.be true
                manager.levels[1].processed.should.be_undefined
                
                manager.loadLevel(1)
                manager.levels[0].processed.should.be true
                manager.levels[1].processed.should.be true
            end
            
            it "should add the camera to the scene helper"
                level = {camera : {locX : 20}}
                manager.storeLevels(level)
                manager.sceneHelper.should.receive("addExtra").with_args("camera", "camera", level.camera)
                manager.loadLevel()
            end
            
            it "should add any lights to the scene helper"
                level = {light : {
                    light1 : {locX : 20}, 
                    light2 : {locY:40}
                }}
                manager.storeLevels(level)
                // Two for the light, one for the camera
                manager.sceneHelper.should.receive("addExtra", 3)
                manager.sceneHelper.extras.camera.should.be_undefined
                manager.sceneHelper.extras.light1.should.be_undefined
                manager.sceneHelper.extras.light2.should.be_undefined
                
                manager.loadLevel()
                manager.sceneHelper.extras.camera.should.not.be_undefined
                manager.sceneHelper.extras.light1.should.not.be_undefined
                manager.sceneHelper.extras.light2.should.not.be_undefined
            end
            
            it "should add any background to the scene helper"
                level = {
                    background : [
                        {id:1}, 
                        {id:2}
                    ]
                }
                manager.storeLevels(level)
                // Two for the background, one for the camera
                manager.sceneHelper.should.receive("addExtra", 3)
                manager.sceneHelper.background.length.should.eql 0
                
                manager.loadLevel()
                manager.sceneHelper.background.length.should.be 2
            end
            
            it "should set the current level to the one specified"
                level = {}
                manager.currentLevel.should.be_undefined
                manager.storeLevels(level)
                manager.loadLevel()
                manager.currentLevel.should.be level
            end
            
            it "should re-add any dead entities that are reincarnating"
                platform1 = manager.prepareEntity(
                    gma.platform({x:0, y:0, width:1, height:1}), 
                    gma.unitCube
                )
                platform2 = manager.prepareEntity(
                    gma.platform({x:7, y:7, width:1, height:1}), 
                    gma.unitCube
                )
                
                level = {removed : [platform1, platform2]}
                manager.storeLevels(level)
                manager.loadLevel()
                level.entities.should.include platform1, platform2
                level.removed.should.eql []
            end
            
            it "should add all entities to the scene helper"
                manager.sceneHelper.countContained().should.be 0
                manager.storeLevels([
                    {},
                    {
                        light : {
                            light1 : {},
                            light2 : {}
                        }
                    },
                    {
                        light : {
                            light1 : {},
                            light2 : {}
                        },
                        
                        entities : [
                            {type:"platform", x:0, y:0, width:2, height:2}
                        ]
                    },
                    {
                        light : {
                            light1 : {},
                            light2 : {}
                        },
                        
                        entities : [
                            {type:"platform", width:2, height:2, replicateWith : [
                                {x:0, y:0},
                                {x:7, y:8},
                                {x:10, y:20}
                            ]}
                        ]
                    }
                    
                ])
                manager.loadLevel()
                manager.sceneHelper.countContained().should.be 1
                
                manager.character = gma.character()
                manager.loadLevel()
                manager.sceneHelper.countContained().should.be 2
                
                manager.loadLevel(1)
                manager.sceneHelper.countContained().should.be 4
                
                manager.loadLevel(2)
                manager.sceneHelper.countContained().should.be 5
                
                manager.loadLevel(3)
                manager.sceneHelper.countContained().should.be 7
            end
            
            it "should add all background to the sceneHelper"
                manager.sceneHelper.countContained().should.be 0
                manager.storeLevels([
                    {},
                    {
                        background : [{}, {}]
                    },
                    {
                        background : [{}, {}],
                        
                        entities : [
                            {type:"platform", x:0, y:0, width:2, height:2}
                        ]
                    },
                    {
                        background : [{}, {}],
                        
                        light : {
                            light1 : {},
                            light2 : {}
                        },
                        
                        entities : [
                            {type:"platform", width:2, height:2, replicateWith : [
                                {x:0, y:0},
                                {x:7, y:8},
                                {x:10, y:20}
                            ]}
                        ]
                    }
                    
                ])
                manager.loadLevel()
                manager.sceneHelper.countContained().should.be 1
                
                manager.character = gma.character()
                manager.loadLevel()
                manager.sceneHelper.countContained().should.be 2
                
                manager.loadLevel(1)
                manager.sceneHelper.countContained().should.be 4
                
                manager.loadLevel(2)
                manager.sceneHelper.countContained().should.be 5
                
                manager.loadLevel(3)
                manager.sceneHelper.countContained().should.be 9
            end
            
            it "should tell the scene helper to set itself up"
                manager.storeLevels({})
                manager.sceneHelper.should.receive("setupScene")
                manager.loadLevel()
            end
            
        end
           
        describe "clearing"
            it "should not do anything if manager doesn't have a current level"
                manager.currentLevel.should.be_undefined
                manager.sceneHelper.should.not.receive("removeExtras")
                manager.sceneHelper.should.not.receive("clear")
                manager.clearLevel()
            end
            
            it "should detach everything in currentLevel.following"
                manager.storeLevels({})
                manager.loadLevel()
                manager.sceneHelper.should.receive("detach").with_args("camera")
                manager.clearLevel()
            end
            
            it "should detach everything in currentLevel.following (second test)"
                manager.storeLevels({
                    background : [{id:'rah', attached : ['character']}]
                })
                manager.loadLevel()
                manager.sceneHelper.should.receive("detach", 2)
                manager.clearLevel()
            end
            
            it "should remove any background defined by the level"
                item = {id:'rah'}
                item2 = gma.backgroundMaker().process(manager, {id:'blah'})
                manager.sceneHelper.addExtra('bkg', "background", item2)
                
                manager.sceneHelper.background.should.include item2
                manager.sceneHelper.background.length.should.eql 1
                _.keys(manager.sceneHelper.bkgIds).should.eql ['blah']
                
                
                manager.storeLevels({background : [item]})
                manager.loadLevel()
                manager.sceneHelper.background.length.should.eql 2
                
                _.keys(manager.sceneHelper.bkgIds).should.eql ['blah', 'rah']
                
                
                manager.sceneHelper.should.receive("removeBackground").with_args(['rah'])
                manager.clearLevel()
                manager.sceneHelper.background.should.include item2
                manager.sceneHelper.background.should.not.include item
                manager.sceneHelper.background.length.should.eql 1
                _.keys(manager.sceneHelper.bkgIds).should.eql ['blah']
                
            end
            
            it "should remove any extras defined by the level"
                manager.sceneHelper.extras.should.not.include "light1", "light2", "camera"
                manager.storeLevels({
                    light : {
                        light1 : {},
                        light2 : {}
                    }
                })
                manager.loadLevel()
                manager.sceneHelper.extras.should.include "light1", "light2", "camera"
                manager.clearLevel()
                manager.sceneHelper.extras.should.not.include "light1", "light2", "camera"
            end
            
            it "should not remove extras defined outside the level"
                manager.sceneHelper.addExtra("light3", "light")
                manager.sceneHelper.extras.should.include "light3"
                manager.sceneHelper.extras.should.not.include "light1", "light2", "camera"
                manager.storeLevels({
                    light : {
                        light1 : {},
                        light2 : {}
                    }
                })
                manager.loadLevel()
                manager.sceneHelper.extras.should.include "light1", "light2", "light3", "camera"
                manager.clearLevel()
                manager.sceneHelper.extras.should.include "light3"
                manager.sceneHelper.extras.should.not.include "light1", "light2", "camera"
            end
            
            it "should clear the scene helper"
                manager.storeLevels({})
                manager.loadLevel()
                manager.sceneHelper.should.receive("clear")
                manager.clearLevel()
            end
        end
    end
    
    describe "Game Loop"
        describe "initialization"
            it "should load level and initialize the scene helper"
                manager.stub("loadLevel")
                manager.stub("twitch")
                manager.sceneHelper.init = function(manager, resources, callback) { callback() }
                manager.should.receive("loadLevel")
                manager.sceneHelper.should.receive("init").with_args(manager, manager.resources)
                manager.init()
            end
            
            it "should not load level if we already have loaded a level"
                level1 = {}
                level2 = {}
                manager.stub("twitch")
                manager.storeLevels([level1, level2])
                manager.loadLevel(1)
                manager.loadLevel = -{}
                manager.sceneHelper.init = function(manager, resources, callback) { callback() }
                manager.sceneHelper.should.receive("init").with_args(manager, manager.resources)
                manager.init()
                manager.currentLevel.should.be level2
            end
            
            it "should accept a level index and use it to determine what level to load"
                manager.stub("loadLevel")
                manager.stub("twitch")
                manager.sceneHelper.init = function(manager, resources, callback) { callback() }
                level = 3
                manager.should.receive("loadLevel").with_args(level)
                manager.init(level)
            end
            
            it "should accept a spawn id and use to spawn the character in a particular part of the level"
                manager.stub("loadLevel")
                manager.stub("twitch")
                manager.sceneHelper.init = function(manager, resources, callback) { callback() }
                level = 3
                spawnId = "other"
                manager.should.receive("loadLevel").with_args(level, spawnId)
                manager.init(level, spawnId)
            end

        end
        
        describe "twitching"
            it "should not do anything if the manager doesn't have a currently loaded level"
                manager.should.not.receive("animate")
                manager.sceneHelper.should.not.receive("render")
                manager.twitch(manager)
            end
            
            it "should animate, remove dead entities, check status of character, render and refresh hud"
                old = window.setTimeout
                window.setTimeout = -{}
                manager.storeLevels({})
                manager.loadLevel()
                manager.sceneHelper.stub("render")
                manager.should.receive("animate")
                manager.should.receive("removeDead").with_args(manager.currentLevel.entities, manager.currentLevel.removed)
                manager.should.receive("checkCharacter")
                manager.sceneHelper.should.receive("render").with_args(manager)
                manager.hud.should.receive("refresh")
                
                manager.twitch(manager)
                window.setTimeout = old
            end
            
            it "should set a timeout to call itself"
                //not sure how to test this one
            end
            
            it "should determine fps"
                manager.currentLevel = manager.levelParser.process(manager, {})
                manager.sceneHelper.stub("render")
                
                var base = new Date();
                var delta = 0
                var counter = 0
                var twitchCount = 0
                
                while (manager.getFPS() === 0) {
                    delta = 0
                    while (delta < 200) {
                        var nextTime = new Date()
                        delta = (nextTime - base)
                    }
                    base = nextTime
                    counter += (delta/1000)
                    twitchCount ++
                    old = window.setTimeout
                    window.setTimeout = -{}
                    manager.twitch(manager)
                    window.setTimeout = old
                }
                
                Math.abs(manager.getFPS() - twitchCount/counter).should.be_less_than 1
            end
        end
    end
    
    describe "when animating all entities"
        it "should call animate on character if it exists"
            manager.character = gma.character()
            manager.storeLevels({})
            manager.loadLevel()
            tick = 3
            manager.character.should.receive("animate").with_args(tick, manager)
            manager.animate(tick)
        end
        it "should not fail if character doesn't exist"
            manager.storeLevels({})
            manager.loadLevel()
            manager.animate(tick)
            true.should.be true
        end
        
        it "should not call animate on entities that don't define animate"
            //jspec has a bug that means we can't test if animate 
            //doesn't get called on an object that doesn't define animate
        end
        
        it "should call animate on entities"
            enemy = gma.enemy()
            manager.storeLevels({
                entities : [
                    enemy
                ]
            })
            manager.loadLevel()
            enemy.should.receive("animate").with_args(tick, manager)
            manager.animate(tick)
        end
        
    end
    
    describe "when removing dead entities"
        it "should ensure the render helper of each dead entity is asked to remove itself from the scene"
            enemy = manager.prepareEntity(gma.enemy(), gma.unitCube)
            enemy.kill()
            cemetry = []
            entities = [enemy]
            enemy.helper.should.receive("remove")
            manager.removeDead(entities, [])
        end
        
        it "should remove the entity from the supplied entity array if dead"
            enemy = manager.prepareEntity(gma.enemy(), gma.unitCube)
            enemy.kill()
            entities = [enemy]
            enemy.helper.should.receive("remove")
            manager.removeDead(entities, [])
            entities.should.have_length 0
        end
        
        it "should put reincarnating entities in the cemetery"
            enemy = manager.prepareEntity(gma.enemy(), gma.unitCube)
            enemy.kill()
            enemy.tags.reincarnate = true
            cemetry = []
            entities = [enemy]
            enemy.helper.should.receive("remove")
            manager.removeDead(entities, cemetry)
            entities.should.have_length 0
            cemetry.should.eql [enemy]
        end
        
        it "should not put non-reincarnating entities in the cemetery"
            enemy = manager.prepareEntity(gma.enemy(), gma.unitCube)
            enemy.kill()
            enemy.tags.reincarnate = false
            cemetry = []
            entities = [enemy]
            enemy.helper.should.receive("remove")
            manager.removeDead(entities, cemetry)
            entities.should.have_length 0
            cemetry.should.have_length 0
        end
        
        it "should handle having some entities reincarnate and some not"
            enemy = manager.prepareEntity(gma.enemy(), gma.unitCube)
            enemy.kill()
            enemy.tags.reincarnate = false
            
            enemy2 = manager.prepareEntity(gma.enemy(), gma.unitCube)
            enemy2.kill()
            enemy2.tags.reincarnate = true
            
            cemetry = []
            entities = [enemy, enemy2]
            manager.removeDead(entities, cemetry)
            entities.should.have_length 0
            cemetry.should.eql [enemy2]
        end
        
        it "should leave alive entities alone"
            enemy = manager.prepareEntity(gma.enemy(), gma.unitCube)
            entities = [enemy]
            cemetry = []
            manager.removeDead(entities, cemetry)
            entities.should.have_length 1
            entities[0].should.be enemy
            cemetry.should.have_length 0
        end
    end
    
    describe "checking the status of the character"
        it "should not fail if there is no character"
            manager.character.should.be_undefined
            manager.checkCharacter()
            true.should.be true
        end
        
        it "should remove character if it is dead"
            manager.character = manager.prepareEntity(gma.character(), gma.unitCube)
            manager.character.kill()
            manager.character.helper.should.receive("remove")
            manager.checkCharacter()
        end
    end
    
    describe "when respawning the character"
        it "should do nothing if we don't have a character"
            manager.character.should.be_undefined
            manager.sceneHelper.should.not.receive
            manager.respawn()
        end
        
        it "should do nothing if we don't have a current level"
            manager.character = gma.character()
            manager.character.kill()
            manager.currentLevel.should.be_undefined
            
            manager.character.alive.should.be false
            manager.respawn()
            manager.character.alive.should.be false
            manager.sceneHelper.should.not.receive
        end
        
        it "should make character alive"
            manager.character = gma.character({x:7, y:8, width:1, height:1})
            manager.character.kill()
            manager.character.alive.should.be false
            
            manager.storeLevels({})
            manager.loadLevel()
            
            manager.respawn()
            manager.character.alive.should.be true
        end
        
        it "should set character to main spawn point if none specified"
            manager.character = gma.character({x:7, y:8, width:1, height:1})
            manager.character.kill()
            manager.character.alive.should.be false
            
            manager.storeLevels({})
            manager.loadLevel()
            
            manager.character.should.receive("setBottomLeft").with_args([0, 0])
            manager.respawn()
        end
        
        it "should set character to specified spawn point"
            manager.character = gma.character({x:7, y:8, width:1, height:1})
            manager.character.kill()
            manager.character.alive.should.be false
            
            manager.storeLevels({
                spawn : {other : [1, 1]}
            })
            manager.loadLevel()
            
            manager.character.should.receive("setBottomLeft").with_args([1, 1])
            manager.respawn('other')
        end
        
        it "should add character to the scene helper"
            manager.character = gma.character({x:7, y:8, width:1, height:1})
            manager.character.kill()
            manager.character.alive.should.be false
            
            manager.storeLevels({})
            manager.loadLevel()
            
            manager.sceneHelper.should.receive("add").with_args(manager.character.helper)
            manager.respawn()
        end
    end
    
end
///////////////////////////////////////////////////////////////////////////////

        }
    }
)
 
