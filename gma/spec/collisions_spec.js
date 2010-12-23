require(
    ['gma/base', 'gma/spec/collisions_spec_helper'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

describe "Collision Detection"
    before_each
        helper = gma.collisions.specHelper()
        
        testScenario = function(fixtureName) {
            var scenarios = helper.getScenariosFromFixture(json_fixture, fixtureName)
            var next;
            
            _.each(scenarios, function(scenario) {
                _.each(helper.rotationPossibilities, function(possibility) {
                    next = helper.rotate(scenario, possibility);
                    next.should.be_correct_collision_scenario;
                });
            });
        }
    end
    
    it "should not move when already adjoining something"
        testScenario('collision_specs/adjoining.js')
    end
    
    it "should stop when hitting an obstacle before reaching target position"
        testScenario('collision_specs/moveAndStop.js')
    end
    
    it "should be able to slide past obstacles"
        testScenario('collision_specs/slidePast.js')
    end
    
    it "should slide along obstacle when moving diagonally"
        testScenario('collision_specs/slidingDiagonally.js')
    end
    
    it "should stop when going diagonally and hitting corner to corner"
        testScenario('collision_specs/hitCornerDiagonally.js')
    end
    
    it "should stop going into a corner defined by multiple obstacles"
        testScenario('collision_specs/multipleInCorner.js')
    end
    
    it "should not stop when diagonally skimming past obstacles"
        testScenario('collision_specs/skimDiagonally.js')
        testScenario('collision_specs/weirdDiagonally.js')
    end

    it "should be constrained when moving diagonally and hitting a smaller object"
        testScenario('collision_specs/smallerDiagonally.js')
    end
end


///////////////////////////////////////////////////////////////////////////////

        }
    }
)
