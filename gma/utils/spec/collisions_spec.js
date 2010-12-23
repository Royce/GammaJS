require(
    ['gma/base', 'gma/utils/collisions', 'gma/entities/shapes', 'gma/entities/character', 'gma/manager'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

//Doesn't need a name, the nested describes in our report read better this way :p
describe ""    
    before_each
        //We don't want to write gma.constants that much :p
        kTOP     = gma.constants.TOP
        kLEFT    = gma.constants.LEFT
        kSTILL   = gma.constants.STILL
        kRIGHT   = gma.constants.RIGHT
        kBOTTOM  = gma.constants.BOTTOM
        kJUMPING = gma.constants.JUMPING
        kFALLING = gma.constants.FALLING
          
        O          = gma.shapes.rectangle
        factories  = gma.collisions.factories
        collisions = gma.collisions;
        
        //(0,0) is bottom left of the screen
    end
    
    describe "Culling"
        before_each
            vector = [20, 30]

            focus = gma.character(
                {
                    bottom:10, left:20, width:20, height:20,
                    xState:kRIGHT, yState:kJUMPING
                }
            )
            
            outside = {
                tl : O({left:0,  top:80, width:20, height:20}), // top left
                bl : O({left:0,  top:10, width:10, height:10}), // bottom left
                br : O({left:60, top:10, width:10, height:10}), // bottom right
                tr : O({left:65, top:65, width:10, height:10}), // top right
                
                lf : O({left:10, top:30, width:10, height:20}), // left of focus
            }
            
            inside = {
                
                onCornerBorder : {
                    tec : O({left:30, top:60, width:10, height:10}), // above top empty corner
                    bec : O({left:50, top:20, width:20, height:10}), // below bottom empty corner
                },
                
                crossesCorner : {
                    tec   : O({left:20, top:50, width:10, height:20}), // crosses top empty corner
                    tec_t : O({left:30, top:60, width:20, height:30}), // crosses top empty corner and target
                },
                
                between : {
                    bes : O({left:40, top:30, width:10, height:10}), // inside  bottom empty space
                },
                
                target : {
                    completely : O({left:45, top:45, width:10, height:10}), // inside  target
                    cross_r    : O({left:50, top:50, width:20, height:10}), // crosses target out the right
                }
                
                //Can't be inside the focus area
                //focus = {}
            }
        end
    
        it "should cull everything outside enclosure"
            findBlockers = collisions.factories.findBlockers(focus, vector);
            environment = _.flatten(outside)
            environment.length.should.be_greater_than 0
            
            blocking   = _.filter(environment, findBlockers)
            blocking.length.should.eql 0
        end
        
        it "should not cull anything inside enclosure"
            findBlockers = collisions.factories.findBlockers(focus, vector)
            environment = _.flatten(
                _.map(inside, function(o) { return _.flatten(o) })
            )
            environment.length.should.be_greater_than 0
            
            blocking   = _.filter(environment, findBlockers)
            blocking.length.should.eql environment.length
        end
    end
    
    describe "Finding Ground"
        before_each
            focus = gma.character({bottom:1, left:2, width:2, height:2, yState : gma.constants.FALLING})
        
            environment = {
                left   : O({right:1, top:1,  width:2, height:2}),
                right  : O({left:5,  top:1,  width:2, height:2}),
                centre : O({left:2,  top:1,  width:2, height:2}),
                lower  : O({left:2,  top:0,  width:2, height:2})
            }
            
            findGround = collisions.factories.findGround(focus)
        end
        
        it "should return true if the entity is on a platform"
            findGround(environment.centre).should.be true
        end
        
        it "should return false if the entity is not on a platform"
            findGround(environment.left).should.be false
            findGround(environment.right).should.be false
            findGround(environment.lower).should.be false
        end
        
        it "should return false if on a platform that is not solid"
            findGround(environment.centre).should.be true
            environment.centre.solid = false
            findGround(environment.centre).should.be false
        end
    end

    describe "Collision Detection"
        before_each
            focus = gma.character({bottom:2, left:2, width:2, height:2})
        
            environment = {
                top         : O({left:2,  bottom:5, width:2, height:2}),
                topLeft     : O({right:1, bottom:3, width:2, height:2}),
                topRight    : O({left:5,  bottom:3, width:2, height:2}),
                bottomLeft  : O({right:1, top:2,    width:2, height:2}),
                bottomRight : O({left:5,  top:1,    width:2, height:2}),
                bottom      : O({left:2,  top:1,    width:2, height:2}),
                
                nextToFocusLeft   : O({right:2,  bottom:2, width:2, height:2}),
                nextToFocusBottom : O({left:2,   top:2,    width:2, height:2}),
            }
        end
    
        describe "should calculate correct modified movement"
            it "when moving upwards"
                vector = [0, 2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                findCollisions(environment.top   ).should.be_same_point_as [0, 1]
                
                collisions.detectCollisions(focus, vector, [environment.bottom]).should.be_same_point_as vector
            end
            
            it "when moving diagonally left-up"
                vector = [-2, 2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                findCollisions(environment.top    ).should.be_same_point_as [-2, 1]
                findCollisions(environment.topLeft).should.be_same_point_as [-1, 2]
                
                collisions.detectCollisions(focus, vector, [environment.bottom]).should.be_same_point_as vector
            end
            
            it "when moving diagonally left-down"
                vector = [-2, -2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                findCollisions(environment.bottomLeft).should.be_same_point_as [-1, -2]
                findCollisions(environment.bottom    ).should.be_same_point_as [-2, -1]
                
                collisions.detectCollisions(focus, vector, [environment.top]).should.be_same_point_as vector
            end
            
            it "when moving diagonally right-up"
                vector = [2, 2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                findCollisions(environment.top     ).should.be_same_point_as [2, 1]
                findCollisions(environment.topRight).should.be_same_point_as [1, 2]
                
                collisions.detectCollisions(focus, vector, [environment.bottom]).should.be_same_point_as vector
            end
            
            it "when moving diagonally right-down"
                vector = [2, -2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                findCollisions(environment.bottom     ).should.be_same_point_as [2, -1]
                findCollisions(environment.bottomRight).should.be_same_point_as [1, -1]
                
                collisions.detectCollisions(focus, vector, [environment.top]).should.be_same_point_as vector
            end
            
            it "when moving downwards"
                vector = [0, -2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                findCollisions(environment.bottom).should.be_same_point_as [0, -1]
                
                collisions.detectCollisions(focus, vector, [environment.top]).should.be_same_point_as vector
            end
            
            it "when moving left"
                vector = [-2, 0]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                findCollisions(environment.topLeft   ).should.be_same_point_as [-1, 0]
                findCollisions(environment.bottomLeft).should.be_same_point_as [-1, 0]
                
                collisions.detectCollisions(focus, vector, [environment.topRight]).should.be_same_point_as vector
            end
            
            it "when moving right"
                vector = [2, 0]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                findCollisions(environment.topRight   ).should.be_same_point_as [1, 0]
                
                collisions.detectCollisions(focus, vector, [environment.bottomRight, environment.bottomLeft]).should.be_same_point_as vector
            
            end
            
            it "when colliding with a non-solid entity"
                vector = [0, 2]
                
                topObj = O({left:2,  bottom:5, width:2, height:2, solid:false})
                topObj.solid.should.be false
                
                findCollisions = collisions.factories.findCollisions(focus, vector)
                findCollisions(topObj).should.be_same_point_as vector
            end
        end

        describe "should call Collision Hooks"        
            it "when moving upwards"
                vector = [0, 2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once').with_args(kTOP, environment.top, kBOTTOM, null)
                environment.top.should.receive('collided', 'once').with_args(kBOTTOM, focus, kTOP, vector)
                
                findCollisions(environment.top)
            end
            
            it "when moving downwards"
                vector = [0, -2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once').with_args(kBOTTOM, environment.bottom, kTOP, null)
                environment.bottom.should.receive('collided', 'once').with_args(kTOP, focus, kBOTTOM, vector)
                
                findCollisions(environment.bottom)
            end
            
            it "when moving left"
                vector = [-2, 0]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once').with_args(kLEFT, environment.topLeft, kRIGHT, null)
                environment.topLeft.should.receive('collided', 'once').with_args(kRIGHT, focus, kLEFT, vector)
                
                findCollisions(environment.topLeft)
            end
            
            it "when moving right"
                vector = [2, 0]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once').with_args(kRIGHT, environment.topRight, kLEFT, null)
                environment.topRight.should.receive('collided', 'once').with_args(kLEFT, focus, kRIGHT, vector)
                
                findCollisions(environment.topRight)
            end
            
            it "when moving diagonally left-up"
                vector = [-2, 2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once').with_args(kTOP, environment.top    , kBOTTOM, null)
                environment.top.should.receive('collided', 'once').with_args(kBOTTOM, focus, kTOP, vector)
                
                findCollisions(environment.top    )
                //should.be_same_point_as [-2, 1]
            end
            
            it "when moving diagonally left-down"
                vector = [-2, -2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once').with_args(kLEFT, environment.bottomLeft, kRIGHT, null)
                environment.bottomLeft.should.receive('collided', 'once').with_args(kRIGHT, focus, kLEFT, vector)
                
                findCollisions(environment.bottomLeft)
                //should.be_same_point_as [-1, -2]
            end
            
            it "when moving diagonally right-up"
                vector = [2, 2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once').with_args(kRIGHT, environment.topRight, kLEFT, null)
                environment.topRight.should.receive('collided', 'once').with_args(kLEFT, focus, kRIGHT, vector)
                
                findCollisions(environment.topRight)
                //should.be_same_point_as [1, 2]
            end
            
            it "when moving diagonally right-down (also hits corner)"
                vector = [2, -2]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once').with_args(kBOTTOM, environment.bottomRight    , kTOP, null)
                environment.bottomRight.should.receive('collided', 'once').with_args(kTOP, focus, kBOTTOM, vector)
                
                findCollisions(environment.bottomRight)
                //should.be_same_point_as [1, -1]
            end
        
            it "when colliding into something else"
                vector = [2, 0]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once')
                focus.should.receive('collided', 'once').with_args(kRIGHT, environment.topRight, kLEFT, null)
                
                environment.topRight.should.receive('collided', 'once').with_args(kLEFT, focus, kRIGHT, [2, 0])
                environment.bottomRight.should_not.receive('collided')
                environment.bottomLeft.should_not.receive('collided')
                
                findCollisions(environment.topRight   ).should.be_same_point_as [1, 0]
                collisions.detectCollisions(focus, vector, [environment.bottomRight, environment.bottomLeft]).should.be_same_point_as vector
            end
            
            it "when colliding objects are adjacent"
                vector = [-2, 0]
                findCollisions = collisions.factories.findCollisions(focus, vector)
                
                focus.should.receive('collided', 'once')
                focus.should.receive('collided', 'once').with_args(kLEFT, environment.nextToFocusLeft, kRIGHT, null)
                            
                environment.nextToFocusLeft.should.receive('collided', 'once').with_args(kRIGHT, focus, kLEFT, [-2, 0])
                environment.nextToFocusBottom.should_not.receive('collided')
                
                findCollisions(environment.nextToFocusLeft   ).should.be_same_point_as [0,  0]
                
                collisions.detectCollisions(focus, vector, [environment.nextToFocusBottom]).should.be_same_point_as vector
            end
        
            it "when colliding with a non-sold entity"
                vector = [0, 2]
                topObj         = O({left:2,  bottom:5, width:2, height:2, solid:false})
                topObj.solid.should.be false
                
                findCollisions = collisions.factories.findCollisions(focus, vector)

                focus.should.receive('collided', 'once').with_args(kTOP, topObj, kBOTTOM, null)
                topObj.should.receive('collided', 'once').with_args(kBOTTOM, focus, kTOP, vector)
                
                findCollisions(topObj).should.be_same_point_as vector
            end
        end
        
        it "should not call collision hooks if nothing collides"
            vector = [2, 0]
            findCollisions = collisions.factories.findCollisions(focus, vector)
            
            focus.should_not.receive('collided').with_args(kRIGHT, environment.nextToFocusLeft)
            focus.should_not.receive('collided').with_args(kRIGHT, environment.nextToFocusBottom)
            
            environment.nextToFocusLeft.should_not.receive('collided')
            environment.nextToFocusBottom.should_not.receive('collided')
            
            collisions.detectCollisions(focus, vector, [environment.nextToFocusLeft, environment.nextToFocusBottom]).should.be_same_point_as vector
        end

    end

    describe "Culling and Collision Detection, when combined"
        before_each        
            testNonColliding =  function(focus, vector, platform, findBlockers, findCollisions) {
                if (findBlockers === undefined || findCollisions === undefined) {
                    findBlockers = factories.findBlockers(focus, vector);
                    findCollisions = factories.findCollisions(focus, vector);
                }
                vector = [0, 2]
                
                findBlockers(platform).should.eql false
                gma.collisions.detectCollisions(focus, vector, [platform]).should.eql vector
            }
            
            testStop = function(focus, vector, platform, findBlockers, findCollisions) {
                if (findBlockers === undefined || findCollisions === undefined) {
                    findBlockers = factories.findBlockers(focus, vector);
                    findCollisions = factories.findCollisions(focus, vector);
                }
                
                findBlockers(platform).should.eql true
                findCollisions(platform).should.eql [0, 0]
                gma.collisions.detectCollisions(focus, vector, [platform]).should.eql [0, 0]
            }
            
            focus = gma.character({left:1, right:2, top:2, bottom:1})
        end
        
        describe "should stop after a collision after no movement"
            it "when moving down into platform"
                vector = [0, -0.002]
                platform = O({left:0, right:3, bottom:0, top:1})
                testStop(focus, vector, platform)
            end
            
            it "when moving right into a wall"
                vector = [0.002, 0]
                platform = O({left:2, right:3, bottom:1, top:2})
                testStop(focus, vector, platform)
            end
        
            it "when in a corner going down"
                vector = [0, -0.002]
                platform1 = O({left:0, right:3, bottom:0, top:1})
                platform2 = O({left:2, right:3, bottom:1, top:2})
                
                findBlockers = factories.findBlockers(focus, vector);
                findCollisions = factories.findCollisions(focus, vector);
                
                findBlockers(platform1).should.eql true
                findBlockers(platform2).should.eql false
                
                findCollisions(platform1).should.be_same_point_as [0, 0]
                findCollisions(platform2).should.be_same_point_as vector
                
                gma.collisions.detectCollisions(focus, vector, [platform1, platform2]).should.be_same_point_as [0, 0]
            end
        
            it "when in a corner going right"
                vector = [0.002, 0]
                platform1 = O({left:0, right:3, bottom:0, top:1})
                platform2 = O({left:2, right:3, bottom:1, top:2})
                
                findBlockers = factories.findBlockers(focus, vector);
                findCollisions = factories.findCollisions(focus, vector);
                
                findBlockers(platform1).should.eql false
                findBlockers(platform2).should.eql true
                
                findCollisions(platform1).should.be_same_point_as vector
                findCollisions(platform2).should.be_same_point_as [0, 0]
                
                gma.collisions.detectCollisions(focus, vector, [platform1, platform2]).should.be_same_point_as [0, 0]
            end
        
            it "when moving diagonally into a corner"
                vector = [0.002, -0.002]
                platform1 = O({left:0, right:3, bottom:0, top:1})
                platform2 = O({left:2, right:3, bottom:1, top:2})
                
                findBlockers = factories.findBlockers(focus, vector);
                findCollisions = factories.findCollisions(focus, vector);
                
                findBlockers(platform1).should.eql true
                findBlockers(platform2).should.eql true
                
                findCollisions(platform1).should.be_same_point_as [0.002, 0]
                findCollisions(platform2).should.be_same_point_as [0, -0.002]
                
                gma.collisions.detectCollisions(focus, vector, [platform1, platform2]).should.be_same_point_as [0, 0]
            end
        end
        
        describe "should not change vector when there is no collision"
        
            it "when on top of a platform moving up"
                vector = [0, 0.002]
                platform = O({left:0, right:3, bottom:0, top:1})
                testNonColliding(focus, vector, platform)
            end
            
            it "when above a platform, moving down"
                vector = [0, -0.002]
                platform = O({left:0, right:3, bottom:-2, top:-1})
                testNonColliding(focus, vector, platform)
            end
            
            it "when on top of a platform moving right"
                vector = [2, 0]
                platform = O({left:0, right:3, bottom:0, top:1})
                testNonColliding(focus, vector, platform)
            end
            
            it "when on top of a platform moving left"
                vector = [-2, 0]
                platform = O({left:0, right:3, bottom:0, top:1})
                testNonColliding(focus, vector, platform)
            end
            
            it "when left of a platform moving down"
                vector = [0, -0.002]
                platform = O({left:2, right:3, bottom:1, top:2})
                testNonColliding(focus, vector, platform)
            end
            
            it "when left of a platform moving up"
                vector = [0, 0.002]
                platform = O({left:2, right:3, bottom:1, top:2})
                testNonColliding(focus, vector, platform)
            end
            
            it "when right of a platform moving up"
                vector = [0, 0.002]
                platform = O({left:-2, right:1, bottom:1, top:2})
                testNonColliding(focus, vector, platform)
            end
            
            it "when right of a platform moving down"
                vector = [0, -0.002]
                platform = O({left:-2, right:1, bottom:1, top:2})
                testNonColliding(focus, vector, platform)
            end
        end
        
        it "should cause a jumping entity to fall when it hits a roof mid-jump"
            manager = gma.manager()
            
            manager.storeLevels({
                entities : [
                    gma.platform({left:0, right:3, bottom:3, top:4})
                ]
            })
            manager.loadLevel()
            
            focus.yState = kSTILL
            focus.jump()
            focus.animate(1, manager)
            focus.top.should.be 3
            focus.animate(1, manager)
            focus.yState.should.eql kFALLING
            focus.top.should.be_less_than 3
        end
    end
end


///////////////////////////////////////////////////////////////////////////////

        }
    }
)
