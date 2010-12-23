require(
    ['gma/base', 'gma/entities/enemy', 'gma/utils/collisions', 'gma/manager', 
               'gma/entities/character'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

eval(JSpec.preprocess(JSpec.load('/scripts/gma/entities/spec/moveable_spec_helpers.js')))

shared_behaviors_for "Enemy"
    should_behave_like('Moveable Objects')
    should_behave_like('Killable Objects') 
    should_behave_like('DeathTouch Enemy')
    should_behave_like('WeakHead Enemy')
    should_behave_like('CombinedDeathWeak Enemy')
    
    it "should have tag of enemy"
        enemy.tags.enemy.should.not.be_undefined
    end
end

shared_behaviors_for "DeathTouch Enemy"
    describe "With deathtouch"
        it "should kill character when touching one"
            enemy.tags.deathtouch = true
            character = gma.character({x:0, y:0, width:1, height:1})
            character.alive.should.be true
            enemy.collided(gma.constants.LEFT, character, gma.constants.RIGHT, null)
            character.alive.should.be false
            
            character = gma.character({x:0, y:0, width:1, height:1})
            enemy.collided(gma.constants.RIGHT, character, gma.constants.LEFT, null)
            character.alive.should.be false
            
            character = gma.character({x:0, y:0, width:1, height:1})
            enemy.collided(gma.constants.BOTTOM, character, gma.constants.TOP, null)
            character.alive.should.be false
            
            character = gma.character({x:0, y:0, width:1, height:1})
            enemy.collided(gma.constants.TOP, character, gma.constants.BOTTOM, null)
            character.alive.should.be false
        end
        
        it "should kill character when one walks into the enemy"
            enemy.tags.deathtouch = true
            character = gma.character({x:0, y:0, width:1, height:1})
            character.alive.should.be true
            enemy.collided(gma.constants.LEFT, character, gma.constants.RIGHT, [3, 0])
            character.alive.should.be false
            
            character = gma.character({x:0, y:0, width:1, height:1})
            enemy.collided(gma.constants.RIGHT, character, gma.constants.LEFT, [-4, 0])
            character.alive.should.be false
            
            character = gma.character({x:0, y:0, width:1, height:1})
            enemy.collided(gma.constants.BOTTOM, character, gma.constants.TOP, [-4, 0])
            character.alive.should.be false
            
            character = gma.character({x:0, y:0, width:1, height:1})
            enemy.collided(gma.constants.TOP, character, gma.constants.BOTTOM, [-4, 0])
            character.alive.should.be false
        end
    end
end

shared_behaviors_for "WeakHead Enemy"
    describe "With weak head"
        
        it "should die when a character lands on it's head"
            enemy.tags.weakhead = true
            enemy.alive.should.be true
            character = gma.character({x:0, y:0, width:1, height:1})
            enemy.collided(gma.constants.TOP, character, gma.constants.BOTTOM, [3, 0])
            enemy.alive.should.be false
            enemy.tags.weakhead = undefined
            enemy.tags.deathtouch = undefined
        end
        
        it "should not kill a character when it lands on it's head"
            enemy.tags.weakhead = true
            
            character = gma.character({x:0, y:0, width:1, height:1})
            character.alive.should.be true
            enemy.collided(gma.constants.TOP, character, gma.constants.BOTTOM, [3, 0])
            character.alive.should.be true
        end
    end
end

shared_behaviors_for "CombinedDeathWeak Enemy"
    describe "With combined death touch and weak head"
        it "should kill character from every side but top"
            enemy.tags.deathtouch = true
            enemy.tags.weakhead = true
            character = gma.character({x:0, y:0, width:1, height:1})
            
            character.alive = true
            enemy.collided(gma.constants.TOP, character, gma.constants.BOTTOM, [3, 0])
            character.alive.should.be true
            
            enemy.alive = true
            character.alive = true
            enemy.collided(gma.constants.BOTTOM, character, gma.constants.TOP, [3, 0])
            character.alive.should.be false
            
            character.alive = true
            enemy.collided(gma.constants.LEFT, character, gma.constants.RIGHT, [3, 0])
            character.alive.should.be false
            
            character.alive = true
            enemy.collided(gma.constants.RIGHT, character, gma.constants.LEFT, [3, 0])
            character.alive.should.be false
        end
        
        it "should die when hit on top"
            enemy.tags.deathtouch = true
            enemy.tags.weakhead = true
            character = gma.character({x:0, y:0, width:1, height:1})
            
            enemy.alive = true
            enemy.collided(gma.constants.TOP, character, gma.constants.BOTTOM, [3, 0])
            enemy.alive.should.be false
            
            enemy.alive = true
            enemy.collided(gma.constants.BOTTOM, character, gma.constants.TOP, [3, 0])
            enemy.alive.should.be true
            
            enemy.alive = true
            enemy.collided(gma.constants.LEFT, character, gma.constants.RIGHT, [3, 0])
            enemy.alive.should.be true
            
            character.alive = true
            enemy.collided(gma.constants.RIGHT, character, gma.constants.LEFT, [3, 0])
            enemy.alive.should.be true
        end
    end
end

describe "A Gamma platform enemy"
    should_behave_like('Enemy')
    
    before_each
        enemy = gma.platformEnemy({bottom:2, left:2, width:2, height:2})
        enemy.tags.weakhead = undefined
        enemy.tags.deathtouch = undefined
        collisions = gma.collisions;
        O = gma.shapes.rectangle
        
        makeEnemy = function(x) {
            return gma.platformEnemy({bottom:2, x:x, width:2, height:2})
        }
    end

    it "should have a findGround function that does nothing"
        enemy.yState = gma.constants.FALLING
        enemy.findGround.should.not.throw_error
        enemy.yState.should.be gma.constants.FALLING
    end
    
    it "should have a findGround function that does nothing if created using gma.enemy"
        enemy = gma.enemy({bottom:2, left:2, width:2, height:2, tags:['platformer']})
        enemy.yState = gma.constants.FALLING
        enemy.findGround.should.not.throw_error
        enemy.yState.should.be gma.constants.FALLING
    end
    
    describe "should turn around"
        before_each            
            environment = {
                below  : O({left:0, top:1, height:2, width:10}),
                ground : O({left:0, top:2, height:2, width:10}),
                leftObstacle: O({left:0, right:2, top:10, height:20})
            }
            makeManager = function(map) {
                m = gma.manager();
                m.storeLevels({entities : map})
                m.loadLevel()
                return m;
            }
        end
        
        it "when reaching the left of the platform it's on"
            enemy = makeEnemy(0)
            enemy.xState = gma.constants.LEFT
            enemy.animate(0.05, makeManager([environment.ground]))
            
            enemy.xState.should.be gma.constants.RIGHT
            
        end
        it "when reaching the right of the platform it's on"
            enemy = makeEnemy(10)
            enemy.xState = gma.constants.RIGHT
            enemy.animate(0.05, makeManager([environment.ground]))
            
            enemy.xState.should.be gma.constants.LEFT
        end
        
        it "when starting to the left of the middle of the platform"
            enemy = makeEnemy(3)
            enemy.xState = gma.constants.STILL
            enemy.animate(0.05, makeManager([environment.ground]))
            
            enemy.xState.should.be gma.constants.RIGHT
        end
        
        it "when starting to the right of the middle of the platform"
            enemy = makeEnemy(7)
            enemy.xState = gma.constants.STILL
            enemy.animate(0.05, makeManager([environment.ground]))
            
            enemy.xState.should.be gma.constants.LEFT
        end
        it "when starting on the middle of the platform"
            enemy = makeEnemy(5)
            enemy.xState = gma.constants.STILL
            enemy.animate(0.05, makeManager([environment.ground]))
            
            enemy.xState.should.be gma.constants.LEFT
        end
        
        it "when it walks into another obstacle"
            enemy.xState = gma.constants.LEFT
            enemy.animate(0.05, makeManager([environment.ground, environment.leftObstacle]))
            
            enemy.xState.should.be gma.constants.RIGHT
            
            enemy.animate(0.05, makeManager([environment.ground, environment.leftObstacle]))
            enemy.left.should.be_greater_than 2
        end
    
        it "should fall onto the platform if it starts above it"
            enemy = gma.platformEnemy({bottom:5, left:2, width:2, height:2})
            enemy.xState = gma.constants.LEFT
            enemy.animate(0.05, makeManager([environment.below]))
            
            enemy.yState.should.be gma.constants.FALLING
        end
        
    end
end

describe "A Gamma jumping enemy"
    should_behave_like('Enemy')
    
    before_each
        enemy = gma.jumpingEnemy({bottom:2, left:2, width:2, height:2, jumpVelocity:2})
        enemy.tags.weakhead = undefined
        enemy.tags.deathtouch = undefined
        O = gma.shapes.rectangle
        environment = {
            ground : O({left:0, top:2, height:2, width:10})
        }
    end
    
    it "should jump automatically like a nice enemy"
        enemy.yState = gma.constants.STILL
        man = gma.manager()
        man.storeLevels({entities : [environment.ground]})
        man.loadLevel()
        enemy.animate(0.01, man)
        enemy.yState.should.be gma.constants.JUMPING
        enemy.velocity.should.be_greater_than 0
    end
end

describe "A Gamma patrol enemy"
    should_behave_like('Enemy')
    
    before_each
        enemy = gma.patrolEnemy({
            bottom:2,
            left:0,
            width:1,
            height:2,
            limitLeft: 2,
            limitRight: 8,
        })
        enemy.tags.weakhead = undefined
        enemy.tags.deathtouch = undefined
        
        makeEnemy = function(x) {
            return gma.patrolEnemy({
                bottom:2,
                x:x,
                width:1,
                height:2,
                limitLeft: 2,
                limitRight: 8,
            })
        }
        
        O = gma.shapes.rectangle
        environment = {
            ground : O({left:0, top:2, height:1, width:10}),
            leftObstacle: O({left:5, right:6, bottom:2, height:20})
        }    
        makeManager = function(map) {
            m = gma.manager();
            m.storeLevels({entities : map})
            m.loadLevel()
            return m;
        }
    end
    
    it "should start moving when still"
        enemy = makeEnemy(4)
        enemy.xState = gma.constants.STILL
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.not.be gma.constants.STILL
    end

    it "should turn around reaching limit left/right"
        enemy = makeEnemy(8)
        enemy.xState = gma.constants.STILL
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.LEFT

        enemy = makeEnemy(8)
        enemy.xState = gma.constants.RIGHT
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.LEFT

        enemy = makeEnemy(2)
        enemy.xState = gma.constants.STILL
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.RIGHT

        enemy = makeEnemy(2)
        enemy.xState = gma.constants.LEFT
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.RIGHT
    end

    it "should move back into it's patrol area (limit left/right) when outside"
        enemy = makeEnemy(9)
        enemy.xState = gma.constants.STILL
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.LEFT

        enemy = makeEnemy(9)
        enemy.xState = gma.constants.RIGHT
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.LEFT

        enemy = makeEnemy(1)
        enemy.xState = gma.constants.STILL
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.RIGHT

        enemy = makeEnemy(1)
        enemy.xState = gma.constants.LEFT
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.RIGHT
    end
    
    it "should continue in the same direct when inside it's patrol area (limit left/right)"
        enemy = makeEnemy(5)
        enemy.xState = gma.constants.RIGHT
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.RIGHT

        enemy = makeEnemy(5)
        enemy.xState = gma.constants.RIGHT
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.RIGHT
    end
    
    it "should continue in the same direct when inside it's patrol area (limit left/right)"
        enemy = makeEnemy(5)
        enemy.xState = gma.constants.RIGHT
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.RIGHT

        enemy = makeEnemy(5)
        enemy.xState = gma.constants.RIGHT
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.RIGHT
    end
    
    it "should turn around when it walks into another obstacle"
        enemy = gma.patrolEnemy({
            bottom:2,
            left:6,
            width:1,
            height:2,
            limitLeft: 2,
            limitRight: 8,
        })
        enemy.xState = gma.constants.LEFT
        enemy.animate(0.05, makeManager([environment.ground, environment.leftObstacle]))
        enemy.xState.should.be gma.constants.RIGHT
    
        enemy = gma.patrolEnemy({
            bottom:2,
            right:5,
            width:1,
            height:2,
            limitLeft: 2,
            limitRight: 8,
        })
        enemy.xState = gma.constants.RIGHT
        enemy.animate(0.05, makeManager([environment.ground, environment.leftObstacle]))
        enemy.xState.should.be gma.constants.LEFT
    end

    it "should fall onto the platform if it starts above it"
        
        enemy = gma.patrolEnemy({
            bottom:20,
            right:5,
            width:1,
            height:2,
            limitLeft: 2,
            limitRight: 8,
        })
        enemy.xState = gma.constants.LEFT
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.yState.should.be gma.constants.FALLING
    end
    
    it "should turn around if it starts at it's left limit"
        enemy = gma.patrolEnemy({
            x:1, width:5, top:4, bottom:2,
            limitLeft:1
        })
        enemy.xState = gma.constants.STILL
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.RIGHT
    end
    
    it "should turn around if it starts at it's right limit"
        enemy = gma.patrolEnemy({
            left:4, right:5, top:4, bottom:2,
            limitRight:5
        })
        enemy.xState = gma.constants.STILL
        enemy.animate(0.05, makeManager([environment.ground]))
        enemy.xState.should.be gma.constants.LEFT
    end

end
    
///////////////////////////////////////////////////////////////////////////////

        }
    }
)
