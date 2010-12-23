require(
    ['gma/base', 'gma/utils/parser', 'gma/manager', 'gma/utils/render', 'gma/entities/platform'],
    function(gma) {
        with (JSpec) {

///////////////////////////////////////////////////////////////////////////////

describe "Level Parser"
    before_each
        manager = gma.manager()
        lp = gma.levelParser()
        manager.levelParser = lp
        level = lp.preProcess(manager, {})
    end
    
    it "should have cube template by default"
        lp.templates.should.include 'cube' 
        lp.templates.cube.should.eql gma.unitCube
    end
    
    it "should have nothing functions for generated keys removed, following and levelExtras"
        lp.validate_removed().should.be true
        lp.validate_following().should.be true
        lp.validate_levelExtras().should.be true
        
        lp.process_removed.should.not_throw_error
        lp.process_following.should.not_throw_error
        lp.process_levelExtras.should.not_throw_error
    end
    
    it "should have validate_other and process_other"
        lp.should.respond_to("validate_other")
        lp.should.respond_to('process_other')
    end
    
    describe "when processing"
        it "should return the object if it's processed property is true"
            obj = {processed : true}
            lp.process(manager, obj).should.be obj
        end
        
        it "should call preProcess with the level"
            obj = {}
            lp.stub('preProcess').and_return(obj)
            lp.should.receive('preProcess').with_args(manager, obj)
            lp.process(manager, obj)
        end
        
        it "should set processed to true on the level when it's finished"
            obj = {}
            lp.stub('preProcess').and_return(obj)
            lp.process(manager, obj).processed.should.be true
        end
        
        it "should call validate and process functions for each key of the level"
            obj = {
                blah : 8,
                meh : 7,
                thing : 20
            }
            
            lp.stub('process_blah')
            lp.stub('validate_blah').and_return(true)
            lp.should.receive('validate_blah').with_args(manager, 'blah', obj.blah, obj)
            lp.should.receive('process_blah').with_args(manager, 'blah', obj.blah, obj)
            
            lp.stub('process_meh')
            lp.stub('validate_meh').and_return(true)
            lp.should.receive('validate_meh').with_args(manager, 'meh', obj.meh, obj)
            lp.should.receive('process_meh').with_args(manager, 'meh', obj.meh, obj)
            
            lp.stub('process_thing')
            lp.stub('validate_thing').and_return(true)
            lp.should.receive('validate_thing').with_args(manager, 'thing', obj.thing, obj)
            lp.should.receive('process_thing').with_args(manager, 'thing', obj.thing, obj)
            
            lp.process(manager, obj)
        end
        
        it "should call validate_other and process_other if no respective function for that key is defined"
            obj = {
                blah : 8,
                meh : 7
            }
            
            lp.stub('validate_blah').and_return(true)
            lp.should.receive('validate_blah').with_args(manager, 'blah', obj.blah, obj)
            lp.should.receive('process_other').with_args(manager, 'blah', obj.blah, obj)
            
            lp.stub('process_meh')
            lp.should.receive('validate_other').with_args(manager, 'meh', obj.meh, obj)
            lp.should.receive('process_meh').with_args(manager, 'meh', obj.meh, obj)
            
            lp.process(manager, obj)
        end
        
        it "should call validate_other and process_other if neither validate or process is defined for that key"
            obj = {
                blah : 8
            }
            
            lp.stub('validate_other').and_return(true)
            lp.stub('process_other').and_return(true)
            
            lp.should.receive('validate_other').with_args(manager, 'blah', obj.blah, obj)
            lp.should.receive('process_other').with_args(manager, 'blah', obj.blah, obj)
            
            lp.process(manager, obj)
        end
        
        it "should not set the return value of the process functions for each key of the level"
            obj = {
                blah : 8,
                meh : 7,
                thing : 20
            }
            
            lp.stub('validate_blah').and_return(true)
            lp.stub('process_blah').and_return(1)
            
            lp.stub('validate_meh').and_return(true)
            lp.stub('process_meh').and_return(2)
            
            lp.stub('validate_thing').and_return(true)
            lp.stub('process_thing').and_return(3)
            
            result = lp.process(manager, obj)
            result.blah.should.be 8
            result.meh.should.be 7
            result.thing.should.be 20
        end
        
        it "should not use a default function if the validate function says no for a particular key"
            obj = {
                blah : 8
            }
            
            lp.stub('validate_blah').and_return(false)
            lp.stub('default_blah').and_return(2)
            lp.stub('process_blah')
            
            result = lp.process(manager, obj)
            result.blah.should.be 8
        end
        
        it "should pass a default value into process function if validate functions says no"
            obj = {
                blah : 8
            }
            
            lp.stub('validate_blah').and_return(false)
            lp.stub('default_blah').and_return(2)
            lp.stub('process_blah')
            
            lp.should.receive("process_blah").with_args(manager, "blah", 2, obj)
            result = lp.process(manager, obj)
        end
        
        it "should delete the key if it isn't valid and there is no default function"
            obj = {
                blah : 8
            }
            
            lp.stub('validate_blah').and_return(false)
            lp.stub('process_blah')
            
            result = lp.process(manager, obj)
            result.should.not.include "blah"
        end
    end
    
    describe "when pre processing"
        it "should use expandReplicateWith on the level"
            obj = {}
            gma.utils.should.receive("expandReplicateWith").with_args(obj)
            lp.preProcess(manager, obj)
        end
        
        it "should return the preprocessed level"
            obj = {}
            lp.preProcess(manager, obj)
            _.keys(obj).length.should.be_greater_than 0
        end
        
        it "should ensure there is a main spawn location"
            result = lp.preProcess(manager, {})
            result.spawn.should.include 'main'
            result.spawn.main.should.eql [0, 0]
        end
        
        it "should give default spawn, light, camera and entities"
            defaultSpawn = lp.default_spawn()
            defaultLight = lp.default_light()
            defaultCamera = lp.default_camera()
            defaultEntities = lp.default_entities()
            
            result = lp.preProcess(manager, {})
            _.each(defaultSpawn, function(v, k) {
                result.spawn[k].should.eql v
            })
            result.light.should.eql defaultLight
            result.camera.should.eql defaultCamera
            result.entities.should.eql defaultEntities
        end
        
        it "should give default removed, following, levelExtras and background"
            result = lp.preProcess(manager, {})
            result.bkgIds.should.eql []
            result.removed.should.eql []
            result.following.should.eql {}
            result.background.should.eql []
            result.levelExtras.should.eql ['camera']
        end
    end
    
    describe "processsing position option"
        it "should work with just x co-ordinate"
            obj = {position : [1]}
            lp.processPosition(obj)
            obj.should.not.include 'position'
            obj.locX.should.eql 1
            obj.locY.should.eql 0
            obj.locZ.should.eql 0
        end
        
        it "should work with just x and y co-ordinates"
            obj = {position : [1, 2]}
            lp.processPosition(obj)
            obj.should.not.include 'position'
            obj.locX.should.eql 1
            obj.locY.should.eql 2
            obj.locZ.should.eql 0
        end
        
        it "should work with x, y and z co-ordinates"
            obj = {position : [1, 2, 3]}
            lp.processPosition(obj)
            obj.should.not.include 'position'
            obj.locX.should.eql 1
            obj.locY.should.eql 2
            obj.locZ.should.eql 3
        end
        
        it "should default to current locX, locY and locZ or 0"
            obj = {position : [], locX:1}
            lp.processPosition(obj)
            obj.should.not.include 'position'
            obj.locX.should.eql 1
            obj.locY.should.eql 0
            obj.locZ.should.eql 0
        end
        
        it "should override current locX, locY and locZ"
            obj = {position : [1, 2], locX:1, locZ:5}
            lp.processPosition(obj)
            obj.should.not.include 'position'
            obj.locX.should.eql 1
            obj.locY.should.eql 2
            obj.locZ.should.eql 5
        end
    end
    
    describe "determining template helper"
        it "should return a template helper"
            lp.determineTemplate(manager).should.respond_to 'getInstance'
        end
        
        it "should default to 'cube'"
            manager.should.receive("determineObject").with_args(lp.templates['cube'])
            lp.determineTemplate(manager)
        end
        
        it "should complain if template is unknown"
            -{lp.determineTemplate("blah")}.should.throw_error
        end
        
        it "should be possible to specify a template"
            manager.should.receive("determineObject").with_args.apply(lp.templates['redcube'])
            lp.determineTemplate(manager, 'redcube')
        end
    end
    
    describe "processsing attached option"
        it "should not break if given object has no attached property"
            -{lp.processAttached(undefined, {}, level)}.should.not_throw_error
            -{lp.processAttached('key', {}, level)}.should.not_throw_error
        end
        
        it "should only add to following if key is defined"
            obj = {attached : ['character']}
            _.keys(level.following).length.should.eql 0
            lp.processAttached(undefined, obj, level)
            _.keys(level.following).length.should.eql 0
        end
        
        it "should remove attached from the obj"
            obj = {attached : ['character']}
            lp.processAttached('key', obj, level)
            obj.should.not.include 'attached'
        end
        
        it "should remove attached from the obj even if key is undefined"
            obj = {attached : ['character']}
            lp.processAttached(undefined, obj, level)
            obj.should.not.include 'attached'
        end
        
        it "should set level.following to the given value at given key"
            obj = {attached : ['character', 1, 2]}
            lp.processAttached('key', obj, level)
            obj.should.not.include 'attached'
            level.following.should.include 'key'
            level.following.key.should.eql ['character', 1, 2]
        end
    end
    
    describe "when parsing a"
        describe "templates key"
            it "should ensure template value is an array"
                -{lp.validate_templates(manager, 'templates', {'d' : {}})}.should.throw_error
                -{lp.validate_templates(manager, 'templates', {'d' : 2})}.should.throw_error
                -{lp.validate_templates(manager, 'templates', {'d' : true})}.should.throw_error
                -{lp.validate_templates(manager, 'templates', {'d' : []})}.should.not.throw_error
            end
            
            it "should allow complex objects as templates"
                -{lp.validate_templates(manager, 'templates', {'d' : gma.unitCube})}.should.not.throw_error
            end
            
            it "should add each template to the levelparser templates property"
                lp.templates.should.not.include 'd', 'e', 'f'
                lp.process_templates(manager, 'templates', {'d' : [], 'e' : [], 'f' : []}, level)
                lp.templates.should.include 'd', 'e', 'f'
            end
        end
        
        describe "background key"
            it "should process position on each obj"
                lp.stub('processPosition')
                lp.stub('processAttached')
                background = [{id:'rah'}]
                lp.should.receive("processAttached").with_args('rah', background[0], level)
                lp.process_background(manager, 'background', background, level)
            end

            it "should ensure background value is an array"
                -{lp.validate_background(manager, 'background', {})}.should.throw_error
                -{lp.validate_background(manager, 'background', 2)}.should.throw_error
                -{lp.validate_background(manager, 'background', true)}.should.throw_error
                -{lp.validate_background(manager, 'background', [])}.should.not.throw_error
            end
            
            it 'should create a backgroundMaker when processing background'
                lp.backgroundMaker.should.be_undefined
                lp.process_background(manager, 'background', [{}, {}], level)
                lp.backgroundMaker.should.not.be_undefined
            end
            
            it 'should call process on backgroundMaker with each item in the list'
                lp.backgroundMaker = {process : function(manager, v) { return v + 1;}};
                lp.backgroundMaker.should.receive('process', 2)
                lp.process_background(manager, 'background', [1, 2], level)
                level.background.should.eql [2,3]
                level.background.length.should.eql 2
            end
            
            it "should pass manager to backgroundMaker's process function"
                lp.backgroundMaker = {process : function(manager, v) { return v + 1;}};
                lp.backgroundMaker.should.receive('process').with_args(manager, 1)
                lp.process_background(manager, 'background', [1], level)
            end

            it 'should not add falsey values to level.background'
                lp.backgroundMaker = {process : function(manager, v) { if (v) { return v + 1; }}};
                lp.backgroundMaker.should.receive('process', 3)
                lp.process_background(manager, 'background', [1, null, 2], level)
                level.background.should.eql [2,3]
                level.background.length.should.eql 2
            end
            
            it 'should ensure a template helper on all objects'
                item = {}
                lp.should.receive('determineTemplate').with_args(manager, item.template)
                lp.process_background(manager, 'background', [item], level)
                level.background[0].template.should.not.be_undefined
            end
            
            it 'should resolve template on background object'
                item = {template : 'redcube'}
                lp.should.receive('determineTemplate').with_args(manager, item.template)
                lp.process_background(manager, 'background', [item], level)
                level.background[0].template.should.not.eql 'redcube'
                level.background[0].template.should.respond_to 'getInstance'
            end
        end
        
        describe "types key"
            it "should ensure each type is an array"
                -{lp.validate_types(manager, 'types', {'d' : {}})}.should.throw_error
                -{lp.validate_types(manager, 'types', {'d' : 2})}.should.throw_error
                -{lp.validate_types(manager, 'types', {'d' : true})}.should.throw_error
                -{lp.validate_types(manager, 'types', {'d' : []})}.should.not.throw_error
            end
            
            it "should add each type to the levelparser types property"
                lp.types.should.not.include 'd', 'e', 'f'
                lp.process_types(manager, 'types', {'d' : [], 'e' : [], 'f' : []}, level)
                lp.types.should.include 'd', 'e', 'f'
            end
        end
        
        describe "entities key"
            it "should have default entities of an empty array"
                lp.default_entities().should.eql []
            end
            
            it "should ensure the entities is an array"
                func = lp.validate_entities.curry(manager, 'entities')
                -{func({}, level)}.should.throw_error
                -{func(true, level)}.should.throw_error
                -{func(2, level)}.should.throw_error
                -{func("", level)}.should.throw_error
                -{func([], level)}.should.not.throw_error
            end
            
            describe "and processing"
                before_each
                    func = lp.process_entities.curry(manager, 'entities')
                end
                
                it "should not resolve type or template if entity is complex"
                    entities = [gma.platform()]
                    entities[0].type = 'daf'
                    entities[0].helper.should.be_undefined
                    
                    manager.should.receive("determineObject").with_args(lp.templates["cube"])
                    manager.should.receive("prepareEntity").with_args(entities[0])
                    func(entities, level)
                    entities[0].type.should.eql 'daf'
                    entities[0].helper.should.not.be_undefined
                end
                
                it "should have default template of cube for complex entities with no template"
                    entities = [gma.platform()]                    
                    manager.should.receive("determineObject").with_args(lp.templates["cube"])
                    manager.should.receive("prepareEntity").with_args(entities[0], lp.templates["cube"])
                    func(entities, level)
                end
                
                it "should make entities a platform with cube template by default"
                    entities = [{depth:2, x:1, y:1, width:2, height:2}]
                    func(entities, level)
                    entities[0].tags.platform.should.not.be_undefined
                    entities[0].helper.template.should.be gma.unitCube
                end
                
                it "should replace entity in the entities array with resolved entity"
                    manager.addCustomDefinitions({
                        types : {platform : ['platform', {}]}
                    })
                    entities = [gma.platform(), gma.platform(), gma.platform(), gma.platform(), 
                        {type:"platform", x:0, y:0, width:1, height:1}
                    ]
                    
                    _.each(entities, function(focus) {
                        entities.helper.should.be_undefined
                    })
                    
                    func(entities, level)
                    
                    _.each(entities, function(focus) {
                        focus.helper.should.not.be_undefined
                    })
                end
                
                describe "and resolving type and template for each simple entity"
                    before_each
                        manager.addCustomDefinitions({
                            types : {platform : ['platform', {}]}
                        })
                    end
                    
                    it "should remove type and template property from the entity"
                        entities = [
                            {type:'platform', template:'cube', x:0, y:1, width:1, height:1},
                            {type:'platform', template:'cube', x:2, y:4, width:31, height:2}
                        ]
                        
                        func(entities, level)
                        
                        _.each(entities, function(focus) {
                            _.keys(focus).should.not.include 'type', 'template'
                        })
                    end
                    
                    it "should complain if given an unkown type"
                        entities = [{type:'asd'}]
                        -{func(entities, level)}.should.throw_error "No such type as asd"
                    end
                    
                    it "should complain if given an unkown template"
                        entities = [{template:'asd', x:0, y:0, width:1, height:1}]
                        -{func(entities, level)}.should.throw_error "No such template as asd"
                    end

                    it "should give all other options to determineObject when determining type"
                        entities = [
                            {type:'platform', template:'cube', x:0, y:1, width:1, height:1, asdf:55}
                        ]
                        
                        given = {}
                        given.x = 0
                        given.y = 1
                        given.width = 1
                        given.height = 1
                        given.asdf = 55
                        
                        gma.should.receive("platform").with_args(given)
                        func(entities, level)
                        
                        _.each(given, function(v, k) {
                            entities[0][k].should.eql v
                        })
                    end
                    
                    it "should favour entity template over type template"
                        redcube = gma.meshTemplate({
                            mesh : gma.unitCubeInfo.mesh,
                            material : {color : "#fff"}
                        })
                        manager.addCustomDefinitions({templates : {redcube : redcube}})
                        
                        entities = [
                            {type:'platform', template:'redcube', x:0, y:1, width:1, height:1, asdf:55}
                        ]
                        func(entities, level)
                        
                        instance = entities[0].helper.template.getInstance()
                        instance.getChildren()[0].getMaterial().color.should.eql {b : 1, g : 1, r : 1}
                    end
                    
                    it "should ensure templates are template helper objects"
                        redcube = ['meshTemplate', 
                            {
                                mesh : gma.unitCubeInfo.mesh,
                                material : {color : "#fff"}
                            }
                        ]
                        manager.addCustomDefinitions({templates : {redcube : redcube}})
                        
                        entities = [
                            {type:'platform', template:'redcube', x:0, y:1, width:1, height:1, asdf:55}
                        ]
                        func(entities, level)
                        entities[0].helper.template.should.not.eql redcube
                        entities[0].helper.template.should.respond_to "getInstance"
                    end
                end
            end
        end
        
        describe "light key"
            it "should have a default light of an empty object"
                lp.default_light().should.eql {}
            end
            
            it "should ensure that the light is not an array"
                -{lp.validate_light(manager, 'light', [], level)}.should.throw_error
                -{lp.validate_light(manager, 'light', {}, level)}.should.not.throw_error
            end
            
            it "should add each light key to levelExtras"
                level.levelExtras.should.not.include 'light1'
                lp.stub('processPosition')
                light = {light1 : {}}
                lp.process_light(manager, 'light', light, level)
                level.levelExtras.should.include 'light1'
            end
            
            it "should process position on each light"
                lp.stub('processPosition')
                lp.stub('processAttached')
                light = {light1 : {}}
                lp.should.receive("processPosition").with_args(light.light1)
                lp.should.receive("processAttached").with_args('light1', light.light1, level)
                lp.process_light(manager, 'light', light, level)
            end
        end
        
        describe "camera key"
            it "should have a default camera at [0, 0, 50]"
                lp.default_camera().position.should.eql [0, 0, 50]
            end
            
            it "should attempt to follow character by default"
                lp.default_camera().attached.should.eql ['character']
            end
            
            it "should try to ensure camera is an object"
                func = lp.validate_camera.curry(manager, 'camera')
                -{func([], level)}.should.throw_error
                -{func(true, level)}.should.throw_error
                -{func(2, level)}.should.throw_error
                -{func("", level)}.should.throw_error
                -{func({}, level)}.should.not.throw_error
            end
            
            it "should process position on the camera"
                lp.stub('processPosition')
                lp.stub('processAttached')
                camera = {}
                lp.should.receive("processPosition").with_args(camera)
                lp.should.receive("processAttached").with_args('camera', camera, level)
                lp.process_camera(manager, 'camera', camera, level)
            end
        end
        
        describe "spawn key"
            it "should have a default spawn of empty object"
                lp.default_spawn().should.eql {}
            end
            
            it "should ensure the spawn is an object"
                func = lp.validate_spawn.curry(manager, 'spawn')
                -{func([], level)}.should.throw_error
                -{func(true, level)}.should.throw_error
                -{func(2, level)}.should.throw_error
                -{func("", level)}.should.throw_error
                -{func({}, level)}.should.not.throw_error
            end
            
            it "should ensure each spawn location is an array"
                func = lp.validate_spawn.curry(manager, 'spawn')
                -{func({'d' : {}}, level)}.should.throw_error
                -{func({'d' : true}, level)}.should.throw_error
                -{func({'d' : 2}, level)}.should.throw_error
                -{func({'d' : ""}, level)}.should.throw_error
                -{func({'d' : []}, level)}.should.not.throw_error
            end
            
            it "should ensure that each spawn location has no more than 2 numbers"
                func = lp.validate_spawn.curry(manager, 'spawn')
                -{func({'d' : []}, level)}.should.not.throw_error
                -{func({'d' : [1]}, level)}.should.not.throw_error
                -{func({'d' : [1,2]}, level)}.should.not.throw_error
                -{func({'d' : [1,2,3]}, level)}.should.throw_error
            end
            
            it "should give a default x and y to spawn locations if they're not specified"
                func = lp.process_spawn.curry(manager, 'spawn')
                level.spawn = {
                    'd' : [],
                    'e' : [1],
                    'f' : [1,2]
                }
                
                func(level.spawn, level)
                level.spawn.d.should.eql [0, 0]
                level.spawn.e.should.eql [1, 0]
                level.spawn.f.should.eql [1, 2]
            end
        end
    end
    
end

///////////////////////////////////////////////////////////////////////////////
        }
    }
)
