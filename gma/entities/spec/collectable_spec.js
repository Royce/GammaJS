require(
    ['gma/base', 'gma/entities/collectable', 'gma/utils/collisions', 'gma/manager', 
        'gma/entities/character'],
    function(gma) {
        with (JSpec) {

///////////////////////////////////////////////////////////////////////////////

describe "Gamma Collectables"
    it "should have tag of collectable"
        collectable = gma.collectable({x:10, y:10, width:1, height:1})
        collectable.tags.collectable.should.not.be_undefined
    end

    it "should 'die' (disappear) when character touches it"
        collectable = gma.collectable({x:10, y:10, width:1, height:1})
        character = gma.character({x:0, y:0, width:1, height:1})

        collectable.alive = true
        collectable.collided(gma.constants.LEFT, character, gma.constants.RIGHT, [3, 0])
        character.collided(gma.constants.RIGHT, collectable, gma.constants.LEFT, null)
        collectable.alive.should.be false

        collectable.alive = true
        collectable.collided(gma.constants.TOP, character, gma.constants.BOTTOM, [3, 0])
        character.collided(gma.constants.BOTTOM, collectable, gma.constants.TOP, null)
        collectable.alive.should.be false

        collectable.alive = true
        collectable.collided(gma.constants.RIGHT, character, gma.constants.LEFT, [3, 0])
        character.collided(gma.constants.LEFT, collectable, gma.constants.RIGHT, null)
        collectable.alive.should.be false

        collectable.alive = true
        collectable.collided(gma.constants.BOTTOM, character, gma.constants.TOP, [3, 0])
        character.collided(gma.constants.TOP, collectable, gma.constants.BOTTOM, null)
        collectable.alive.should.be false
    end
end

describe "Gamma Score Collectable"
    it "should have tag of scoreCollectable"
        c = gma.scoreCollectable({x:10, y:10, width:1, height:1})
        c.tags.scoreCollectable.should.not.be_undefined
    end

    it "should gain the character 1 point"
        c = gma.scoreCollectable({x:10, y:10, width:1, height:1})
        character = gma.character({x:0, y:0, width:1, height:1, score:0})

        c.collided(gma.constants.LEFT, character, gma.constants.RIGHT, [3, 0])
        character.collided(gma.constants.RIGHT, c, gma.constants.LEFT, null)
        character.score.should.be 1

        c.collided(gma.constants.LEFT, character, gma.constants.RIGHT, [3, 0])
        character.collided(gma.constants.RIGHT, c, gma.constants.LEFT, null)
        character.score.should.be 2
    end
end

///////////////////////////////////////////////////////////////////////////////

        }
    }
)
 
