//#JSCOVERAGE_IF 0
require.def('gma/spec/collisions_spec_helper',
    ['gma/base', 'gma/entities/shapes', 'gma/utils/collisions', 'gma/entities/character'],
    function(gma) {
        
        gma.collisions = gma.collisions || {};
        gma.collisions.specHelper = function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////
    
    self.rotationPossibilities = self.rotationPossibilities || [
        //clockwise
        $M([[1,  0], [0,  1]]), //0   degrees
        $M([[0, -1], [1,  0]]), //90  degrees
        $M([[-1, 0], [0, -1]]), //180 degrees
        $M([[0,  1], [-1, 0]]), //270 degrees
        
        //flipped over x-axis, then rotate
        $M([[-1, 0], [0,  1]]), //0   degrees
        $M([[0, -1], [-1, 0]]), //90  degrees
        $M([[1,  0], [0, -1]]), //180 degrees
        $M([[0,  1], [1,  0]]), //270 degrees
    ];
    
    self.getScenarios = self.getScenarios || function(fixture, fixtureName) {
        var scenarios = [];
        _.each(fixture.scenarios, function(scenario) {
            scenario.character = scenario.character || fixture.character;
            scenario.movement  = scenario.movement  || fixture.movement;
            scenario.expected  = scenario.expected  || fixture.expected;
            
            if (scenario.mapUse) {
                if (!fixture.map) {
                    JSpec.fail('In "' + fixtureName + '", A scenario uses mapUse but fixture has no collection of map');
                }
                else {
                    scenario.map = _.map(scenario.mapUse, function(num) { return fixture.map[num]; });
                }
            }
            else if (scenario.map1) {
                scenario.map = [scenario.map1];
            }
            else {
                scenario.map = scenario.map || fixture.map
            }
            
            if (scenario.individual) {
                _.each(scenario.map, function(obstacle) {
                    var newScenario = jQuery.extend(true, {}, scenario);
                    newScenario.map = [obstacle];
                    scenarios.push(newScenario);
                });
            }
            else {
                scenarios.push(scenario);
            }
        });
        return scenarios;
    }
    
    self.rotate = self.rotate || function(scenario, rotation) {
        var newScenario = jQuery.extend(true, {}, scenario);
        newScenario.map       = _.map(newScenario.map, function(obstacle) { return $M(obstacle).x(rotation).elements });
        newScenario.character = $M(newScenario.character).x(rotation).elements;
        newScenario.movement  = $M([newScenario.movement]).x(rotation).elements[0];
        newScenario.expected  = $M([newScenario.expected]).x(rotation).elements[0];
        return newScenario;
    }
    
    self.getScenariosFromFixture = self.getScenariosFromFixture || function(fixtureFunction, fixtureName) {
        fixture = fixtureFunction(fixtureName)
        if (!fixture) {
            JSpec.fail('Couldn\'t find fixture "' + fixtureName + '"');
        }
        
        if (!fixture.scenarios) {
            JSpec.fail('Fixture must define some scenarios to run (' + fixtureName + ')');
        }
        
        return self.getScenarios(fixture, fixtureName);
    }

    JSpec.addMatchers({
        be_correct_collision_scenario : {
            match : function(scenario) {
                var focus = gma.character({points:scenario.character});
                var map = _.map(scenario.map, function(m) { return gma.shapes.rectangle({points:m}); });
                return checkPoint([gma.collisions.detectCollisions(focus, scenario.movement, map), scenario.expected]);
            },
            message : function(scenario, expected, negate) {
                var verb = "";
                if (negate) {
                    verb = "not ";
                }
                
                var focus = gma.character({points:scenario.character});
                var map = _.map(scenario.map, function(m) { return gma.shapes.rectangle({points:m}); });
                
                return "Character at [" + scenario.character + "] movement [" + scenario.movement + "] map of [" + scenario.map + "] should " + verb + "result in movement of [" + scenario.expected + "] got [" + gma.collisions.detectCollisions(focus, scenario.movement, map) + "] instead";
            }
        }
    })
            
///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
//#JSCOVERAGE_ENDIF
