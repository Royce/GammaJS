require(
    ['gma/base', 'gma/utils/background', 'gma/manager', 'gma/entities/shapes'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

describe 'Background Maker'

    before_each
        manager = gma.manager()
        maker = gma.backgroundMaker()
    end
    
    it 'should have a z value'
        maker.z.should.not.be_undefined
        _.isNumber(maker.z).should.be true
    end
    
    describe 'Dispatcher'
        it 'should return nothing if value is nothing'
            maker.process().should.be_undefined
        end
        
        it 'should use value.config to get the render helper if it is a function'
            value = {config : function() { return 2; }}
            value.should.receive('config').with_args(manager, value)
            maker.process(manager, value).should.eql 2
        end
        
        it 'should use call process_%s where %s is the config if it is a string'
            maker.stub('process_blah')
            value = {config : 'blah'}
            maker.should.receive('process_blah').with_args(manager, value)
            maker.process(manager, value)
        end
        
        it 'should use process_other if value has no config'
            value = {}
            maker.should.receive('process_other').with_args(manager, value)
            maker.process(manager, value)
        end
        
        it 'should use process_other if value has an unkown config'
            value = {config:'asdf'}
            maker.should.receive('process_other').with_args(manager, value)
            maker.process(manager, value)
        end
        
        it 'should not use process_other if value has a known config'
            maker.stub('process_blah')
            value = {config:'blah'}
            maker.should.not.receive('process_other')
            maker.process(manager, value)
        end
    end
    
    describe "Sanitizing"
        before_each
            ensure = function(entity, result) {
                _.each(result, function(v, k) {
                    entity[k].should.eql v
                })
            }
        end
        
        it "Should ensure given object has entity with depth, width, height, x, y and z"
            item = {}
            maker.sanitise(item)
            item.entity.tags.should.not.be_undefined
            item.entity.tags.shape.should.not.be_undefined
        end
        
        it "should not modify existing entity"
            item = {
                entity : {depth : 20, width : 21, height : 22, x : 30, y : 31, z : 32}
            }
            
            result = {depth : 20, width : 21, height : 22, x : 30, y : 31, z : 32}
            maker.sanitise(item)
            ensure(item.entity, result)
            
            item.depth = 10
            item.width = 11
            item.height = 12
            item.x = 40
            item.y = 41
            item.z = 42
            
            maker.sanitise(item)
            ensure(item.entity, result)
            
            maker.sanitise(item, {depth:0, width:1, height:2, x : 50, y:51, z:52})
            ensure(item.entity, result)
        end
        
        it "should use property on value if none on entity"
            item = {
                depth : 10,
                width : 11,
                height : 12,
                x : 40,
                y : 41,
                z : 42
            }
            
            result = {depth : 10, width : 11, height : 12, x : 40, y : 41, z : 42}
            maker.sanitise(item)
            ensure(item.entity, result)
            
            delete item.entity
            result = {depth : 10, width : 11, height : 12, x : 40, y : 41, z : 42}
            maker.sanitise(item, {depth:30, width:31, height:32, x:50, y:51, z:52})
            ensure(item.entity, result)
        end
        
        it "should use property on passed in opts if not on value or entity"
            item = {}
            
            result = {depth : 10, width : 11, height : 12, x : 40, y : 41, z : 42}
            maker.sanitise(item, {depth : 10, width : 11, height : 12, x : 40, y : 41, z : 42})
            ensure(item.entity, result)
        end
        
        it "should be able to mix between three locations"
            item = {
                depth : 10,
                entity : {
                    width : 21,
                    
                    x : 30,
                    y : 31,
                    z : 32
                }
            }
            
            result = {depth : 10, width : 21, height : 32, x : 30, y : 31, z : 32}
            maker.sanitise(item, {height : 32})
            ensure(item.entity, result)
        end
    end
    
    describe "Processing Miscellaneous items"
        it "should sanitise the given variable"
            item = {}
            maker.should.receive('sanitise').with_args(item)
            maker.process_other(manager, item)
        end
        
        it "should give back a render helper with an instance already"
            result = maker.process_other(manager, {})
            result._instance.should.not.be_undefined
            result.should.respond_to 'getRenderedObj'
            result.should.respond_to 'addTo'
            result.should.respond_to 'remove'
        end
    end
    
    describe "Processing skybox items"
        it "should call sanitise on the given item"
            dflt = {width:50, height:50, depth:1, x:0, y:0, z:-50} 
            item = {}
            maker.should.receive('sanitise').with_args(item, dflt)
            maker.process_skybox(manager, item)
        end
        
        it "should give a mesh of unitCube if no mesh defined"
            item = {}
            maker.process_skybox(manager, item)
            item.mesh.should.eql gma.unitCubeInfo.mesh
        end
        
        it "should use mesh already on object"
            gma.stub('renderHelper')
            gma.stub('meshTemplate').and_return({ getInstance : -{}})
            item = {mesh : 1}
            maker.process_skybox(manager, item)
            item.mesh.should.eql 1
        end
        
        it "should default to gma.unitCubeInfo.material for a material"
            item = {}
            maker.process_skybox(manager, item)
            item.material.should.eql gma.unitCubeInfo.material
        end
        
        it "should use material already on object"
            gma.stub('renderHelper')
            gma.stub('meshTemplate').and_return({ getInstance : -{}})
            item = {material : 1}
            maker.process_skybox(manager, item)
            item.material.should.eql 1
        end
        
        it "should use texture instead of material if already on object"
            gma.stub('renderHelper')
            gma.stub('meshTemplate').and_return({ getInstance : -{}})
            item = {texture : 1}
            maker.process_skybox(manager, item)
            item.material.should.be_undefined
            item.texture.should.eql 1
        end
        
        it "should remove material if texture and material on object"
            gma.stub('renderHelper')
            gma.stub('meshTemplate').and_return({ getInstance : -{}})
            item = {texture : 1, material : 2}
            maker.process_skybox(manager, item)
            _.keys(item).should.not.include 'material'
        end
        
        it "should give back a render helper with an instance already"
            result = maker.process_skybox(manager, {})
            result._instance.should.not.be_undefined
            result.should.respond_to 'getRenderedObj'
            result.should.respond_to 'addTo'
            result.should.respond_to 'remove'
        end
    end
end

///////////////////////////////////////////////////////////////////////////////

        }
    }
)
