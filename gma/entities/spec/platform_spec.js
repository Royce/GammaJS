require(
    ['gma/base', 'gma/entities/platform', 'gma/utils/collisions', 'gma/manager', 
               'gma/entities/character'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

describe "Gamma Platform"
    it "should have tag of platform"
        platform = gma.platform({x:10, y:10, width:1, height:1})
        platform.tags.platform.should.not.be_undefined
    end
end

describe "Gamma Death Platform"
    it "should have tag of platform and deathtouch"
        platform = gma.deathPlatform({x:10, y:10, width:1, height:1})
        platform.tags.platform.should.not.be_undefined
        platform.tags.deathtouch.should.not.be_undefined
    end

    it "should kill character if one walks into the platform"
        platform = gma.deathPlatform({x:10, y:10, width:1, height:1})

        character = gma.character({x:0, y:0, width:1, height:1})
        
        character.alive = true
        platform.collided(gma.constants.LEFT, character, gma.constants.RIGHT, [3, 0])
        character.alive.should.be false

        character.alive = true
        platform.collided(gma.constants.RIGHT, character, gma.constants.LEFT, [-3, 0])
        character.alive.should.be false

        character.alive = true
        platform.collided(gma.constants.TOP, character, gma.constants.BOTTOM, [0, -1])
        character.alive.should.be false

        character.alive = true
        platform.collided(gma.constants.BOTTOM, character, gma.constants.TOP, [0, 2])
        character.alive.should.be false
    end
end
    
///////////////////////////////////////////////////////////////////////////////

        }
    }
)
