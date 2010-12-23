require(
    ['gma/base', 'gma/entities/character', 'gma/manager'],
    function (gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

eval(JSpec.preprocess(JSpec.load('/scripts/gma/entities/spec/moveable_spec_helpers.js')))

describe "Gamma Character"
    should_behave_like('Moveable Objects')
    should_behave_like('Killable Objects')
    
    before_each
        manager = gma.manager()
        
        eKeyDown = {type:'keydown'}
        eKeyUp = {type:'keyup'}
        
        character = gma.character()
    end
    
    it "should have tag of character"
        character.tags.character.should.not.be_undefined
    end
    
    describe "jumping"
        it "should be possible with a jump method"
            character.should.respond_to "jump"
        end
        
        it "should change vertical state when startin' a jumpin'"
            character.yState = gma.constants.STILL
            character.jump(eKeyDown)
            character.yState.should.eql gma.constants.JUMPING
        end

        it "should set velocity when startin' a jumpin'"
            character.yState = gma.constants.STILL
            character.velocity.should.eql 0
            character.jump(eKeyDown)
            character.velocity.should.be_greater_than 0
        end
    
        it "should not reset velocity when already jumping"
            character.yState = gma.constants.STILL
            
            character.jump(eKeyDown)
            v = character.velocity
            
            character.jump(eKeyDown)
            character.velocity.should.eql v
        end
    end
    
    describe "movement"
        
        it "should be possible with a move method"
            character.should.respond_to "move"
        end
        
        it "should complain if the move method is given a keydown and no direction"
            character.move.curry(null, eKeyDown).should.throw_error
        end

        it "can only be done with LEFT and RIGHT directions"
            -{ character.move(gma.constants.LEFT, eKeyUp) }.should.not.throw_error
            -{ character.move(gma.constants.LEFT, eKeyDown) }.should.not.throw_error
            
            -{ character.move(gma.constants.RIGHT, eKeyUp) }.should.not.throw_error
            -{ character.move(gma.constants.RIGHT, eKeyDown) }.should.not.throw_error
            
            -{ character.move(eKeyDown) }.should.throw_error
            -{ character.move('a', eKeyDown) }.should.throw_error
            -{ character.move(2, eKeyDown) }.should.throw_error
        end
        
        describe "after releasing a keyboard key"
            
            it "should become STILL when movement direction is same as current direction"
                character.xState = gma.constants.RIGHT
                character.move(gma.constants.RIGHT, eKeyUp)
                character.xState.should.eql gma.constants.STILL
                
                character.xState = gma.constants.LEFT
                character.move(gma.constants.LEFT, eKeyUp)
                character.xState.should.eql gma.constants.STILL
            end
            
            it "should not become STILL when movement direction is different to current direction"
                character.xState = gma.constants.LEFT
                character.move(gma.constants.RIGHT, eKeyUp)
                character.xState.should.eql gma.constants.LEFT
                
                character.xState = gma.constants.RIGHT
                character.move(gma.constants.LEFT, eKeyUp)
                character.xState.should.eql gma.constants.RIGHT
            end
        end
        
        it "should change horizontal state if changing direction"
            character.xState = gma.constants.STILL
            character.move(gma.constants.RIGHT, eKeyDown)
            character.xState.should.eql gma.constants.RIGHT
            
            character.xState = gma.constants.LEFT
            character.move(gma.constants.RIGHT, eKeyDown)
            character.xState.should.eql gma.constants.RIGHT
            
            character.xState = gma.constants.RIGHT
            character.move(gma.constants.LEFT, eKeyDown)
            character.xState.should.eql gma.constants.LEFT
            
            character.xState = gma.constants.STILL
            character.move(gma.constants.LEFT, eKeyDown)
            character.xState.should.eql gma.constants.LEFT
        end
        
        it "should not change vertical state when called"
            character.yState = gma.constants.STILL
            
            character.move(gma.constants.RIGHT, eKeyUp)
            character.yState.should.eql gma.constants.STILL
            character.move(gma.constants.RIGHT, eKeyDown)
            character.yState.should.eql gma.constants.STILL
            
            character.move(gma.constants.LEFT, eKeyUp)
            character.yState.should.eql gma.constants.STILL
            character.move(gma.constants.LEFT, eKeyDown)
            character.yState.should.eql gma.constants.STILL
            
            character.yState = gma.constants.JUMPING
            
            character.move(gma.constants.RIGHT, eKeyUp)
            character.yState.should.eql gma.constants.JUMPING
            character.move(gma.constants.RIGHT, eKeyDown)
            character.yState.should.eql gma.constants.JUMPING
            
            character.move(gma.constants.LEFT, eKeyUp)
            character.yState.should.eql gma.constants.JUMPING
            character.move(gma.constants.LEFT, eKeyDown)
            character.yState.should.eql gma.constants.JUMPING
        end
        
        it "should not change position"
            character.x = 34
            character.y = 87
            
            character.move(gma.constants.RIGHT, eKeyUp)
            character.x.should.eql 34
            character.y.should.eql 87
            character.move(gma.constants.RIGHT, eKeyDown)
            character.x.should.eql 34
            character.y.should.eql 87
            
            character.move(gma.constants.LEFT, eKeyUp)
            character.x.should.eql 34
            character.y.should.eql 87
            character.move(gma.constants.LEFT, eKeyDown)
            character.x.should.eql 34
            character.y.should.eql 87
        end
    end
    
    it "should not move when dead"
        character.kill()
        
        character.move(gma.constants.LEFT, eKeyDown)
        character.xState.should.be gma.constants.STILL
        character.move(gma.constants.LEFT, eKeyUp)
        character.xState.should.be gma.constants.STILL
        
        character.move(gma.constants.RIGHT, eKeyDown)
        character.xState.should.be gma.constants.STILL
        character.move(gma.constants.RIGHT, eKeyUp)
        character.xState.should.be gma.constants.STILL
        
        character.yState = gma.constants.STILL
        character.jump(eKeyDown)
        character.yState.should.be gma.constants.STILL
        character.jump(eKeyUp)
        character.yState.should.be gma.constants.STILL
    end
    
end

///////////////////////////////////////////////////////////////////////////////

        }
    }
)
