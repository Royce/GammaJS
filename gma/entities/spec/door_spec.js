require(
    [
        'gma/base', 'gma/entities/door', 'gma/manager', 
        'gma/entities/character', 'gma/entities/enemy'
    ],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

describe "Gamma Door entity"
    before_each
        manager = gma.manager()
        window.manager = manager
        called = null
        manager.loadLevel = function() {called = arguments}
        character = gma.character()
    end

    it "should have a 'door' tag"
        door = gma.door({levelId: 2, x:0, y:0, width:1, height:1})
        door.tags.door.should.not.be_undefined
    end
    
    it "should cause manager to load the specified level when character collides with it"
        called.should.be null
        door = gma.door({level: 2, x:0, y:0, width:1, height:1})
        door.collided(gma.constants.RIGHT, character, gma.constants.LEFT, null)
        called.should.eql [2, undefined]
    end

    it "should cause manager to load the specified level with specified spawn point when character collides with it"
        called.should.be null
        door = gma.door({level: 2, spawnId: "other", x:0, y:0, width:1, height:1})
        door.collided(gma.constants.RIGHT, character, gma.constants.LEFT, null)
        called.should.eql [2, 'other']
    end
    
    it "should not cause manager to load new level if something that isn't a character collides with it"
        called.should.be null
        door = gma.door({level: 2, spawnId: "other", x:0, y:0, width:1, height:1})
        enemy = gma.enemy()
        door.collided(gma.constants.RIGHT, enemy, gma.constants.LEFT, null)
        called.should.be null
        
    end
end

///////////////////////////////////////////////////////////////////////////////
        }
    }
)
