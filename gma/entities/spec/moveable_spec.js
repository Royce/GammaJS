require(
    ['gma/base', 'gma/entities/moveable', 'gma/manager'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

eval(JSpec.preprocess(JSpec.load('/scripts/gma/entities/spec/moveable_spec_helpers.js')))

describe "Gamma Moveable Entities"
    should_behave_like('Moveable Objects')
    should_behave_like('Killable Objects')
    
    it "should become still when killed"
        moveable = gma.moveable({xState: gma.constants.LEFT, x:0, y:0, width:1, height:1})
        moveable.kill()
        moveable.xState.should.be gma.constants.STILL
    end
end

///////////////////////////////////////////////////////////////////////////////

        }
    }
)
