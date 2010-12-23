shared_behaviors_for "Moveable Objects"
    before_each
        manager = gma.manager()
        
        eKeyDown = {type:'keydown'}
        eKeyUp = {type:'keyup'}
        
        moveable = gma.moveable()
    end
    
    it "should have tag of moveable"
        moveable.tags.moveable.should.not.be_undefined
    end
    
    it "should have default position"
        moveable.x.should.not.be_undefined
        moveable.y.should.not.be_undefined
    end
    
    it "should have default width and height"
        moveable.width.should.not.be_undefined
        moveable.height.should.not.be_undefined
    end

    it "should have a vertical direction state"
        moveable.yState.should.not.be_undefined
    end

    it "should start in a 'falling' vertical state"
        moveable.yState.should.eql gma.constants.FALLING
    end
    
    it "should have horizontal state"
        moveable.xState.should.not.be_undefined
    end

    it "can be created with a specified position and dimensions"
        moveable = gma.moveable({x:20, y:40, width: 1, height:1})
        moveable.x.should.eql 20
        moveable.y.should.eql 40
    end
    
    describe "Moving"
        it "should be possible with an animate method"
            moveable.should.respond_to "animate"
        end
        
        it "should not change horizontal direction if xState is STILL"
            moveable.x = 20
            moveable.xState = gma.constants.STILL
            
            moveable.animate(5, manager)
            
            moveable.x.should.eql 20
            moveable.xState.should.eql gma.constants.STILL
        end
        
        it "should not change vertical direction if yState is STILL"
            moveable.y = 20
            moveable.yState = gma.constants.STILL
            
            moveable.animate(5, manager)
            
            moveable.y.should.eql 20
        end
        
        it "should stay falling if there is no ground"
            moveable.yState = gma.constants.STILL
            moveable.animate(5, manager)
            moveable.yState.should.eql gma.constants.FALLING
            
            moveable.yState = gma.constants.FALLING
            moveable.animate(5, manager)
            moveable.yState.should.eql gma.constants.FALLING
        end
        
        describe "When Jumping"
        
            it "should increase y by a descreasing amount until it is FALLING"
                moveable.y = 20
                
                moveable.yState = gma.constants.JUMPING
                
                oldY = moveable.y
                moveable.animate(0.01, manager)
                newY = moveable.y
                oldDelta = newY-oldY
                do {
                    oldY = moveable.y
                    moveable.animate(0.01, manager)
                    newY = moveable.y
                    newDelta = newY-oldY
                    newDelta.should.be_less_than oldDelta
                    oldDelta = newDelta  
                } while (moveable.yState !== gma.constants.FALLING)
                
            end
            
            it "should start falling if it's jumping and told to move upwards by a zero amount"
                moveable.y = 20
                moveable.yState = gma.constants.JUMPING
                moveable.stub("getMovement").and_return([0, 0])
                moveable.animate(0.01, manager)
                moveable.yState.should.be gma.constants.FALLING
            end
            
        end
        
        describe "When Falling"
            
            it "should decrease y"
                moveable.y = 20
                
                moveable.yState = gma.constants.FALLING
                
                moveable.animate(5, manager)
                
                moveable.y.should.be_less_than 20
            end
            
            it "should decrease by the correct amount"
                
            end
            
            it "should stop falling when it hits ground"
                moveable = gma.moveable({x:20, width:3, bottom:1, height:1})
                manager.storeLevels({
                    entities :[
                        {x:20, width:5, top:1, height:1}
                    ]
                })
                manager.loadLevel()
                moveable.yState = gma.constants.FALLING
                moveable.animate(5, manager)
                moveable.yState.should.be gma.constants.STILL
            end
            
        end
        
        describe "With a non-STILL horizontal state"
            it "should make x greater if moving right"
                moveable.x = 20
                
                moveable.xState = gma.constants.RIGHT
                
                moveable.animate(5, manager)
                
                moveable.x.should.be_greater_than 20
            end
            
            it "should make x smaller if moving left"
                moveable.x = 20
                
                moveable.xState = gma.constants.LEFT
                
                moveable.animate(5, manager)
                
                moveable.x.should.be_less_than 20
            end
            
            it "should change by the correct amount"
            end
        end
        
    end
    
    describe "Rotation"
        it "should be possible to determine rotation with a getRotation method"
            moveable.should.respond_to "getRotation"
        end
        
        it "should start at an angle of 0.5"
            moveable.lastXState = gma.constants.LEFT
            moveable.xState = gma.constants.STILL
            moveable.getRotation().should.be 0
        end
        
        it "should increase angle in lots of 0.5 untill it reaches 3.14 when looking right"
            moveable.xState = gma.constants.RIGHT
            angle = moveable.getRotation()
            angle.should.be 0.5
            angle = moveable.getRotation()
            angle.should.be 1
            angle = moveable.getRotation()
            angle.should.be 1.5
            angle = moveable.getRotation()
            angle.should.be 2
            angle = moveable.getRotation()
            angle.should.be 2.5
            angle = moveable.getRotation()
            angle.should.be 3.0
            angle = moveable.getRotation()
            angle.should.be 3.14
            angle = moveable.getRotation()
            angle.should.be 3.14
        end
        
        it "should decreases angle in lots of 0.5 untill it reaches 0 when looking left"
            moveable.xState = gma.constants.RIGHT
            angle = moveable.getRotation()
            angle.should.be 0.5
            angle = moveable.getRotation()
            angle.should.be 1
            angle = moveable.getRotation()
            angle.should.be 1.5
            
            moveable.xState = gma.constants.LEFT
            angle = moveable.getRotation()
            angle.should.be 1.0
            angle = moveable.getRotation()
            angle.should.be 0.5
            angle = moveable.getRotation()
            angle.should.be 0
            angle = moveable.getRotation()
            angle.should.be 0
        end
    end

end

shared_behaviors_for "Killable Objects"
    before_each
        moveable = gma.moveable()
    end
    
    describe "kill function"
        it "should exist"
            moveable.should.respond_to "kill"
        end
        
        it "should change the 'alive' status to false"
            moveable.alive.should.be true
            moveable.kill()
            moveable.alive.should.be false
        end
    end
end
