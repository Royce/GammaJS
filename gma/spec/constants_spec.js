require(
    ['gma/base'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////


describe "Gamma Constants"
    before_each
        constantList = {
            sides      : ["TOP", "BOTTOM"],
            movement   : ["STILL"],
            vMovement  : ["JUMPING", "FALLING"],
            hDirection : ["LEFT", "RIGHT"]
        }
    end
    
    it "should all be unique"
        list = _.flatten(_.map(constantList, function(value, key) { return value }))
        constants = _.map(list, function(constant) {
            return gma.constants[constant]
        });
        
        uniq = _.uniq(constants)
        
        uniq.length.should.eql constants.length
        
    end
    
    describe "related to movement"
        it "STILL"
            gma.constants.STILL.should.not.be_undefined
        end
    end
    
    describe "related to vertical movement"
        it "JUMPING"
            gma.constants.JUMPING.should.not.be_undefined
        end
    
        it "FALLING"
            gma.constants.FALLING.should.not.be_undefined
        end
    end
    
    describe "related to horizontal direction"
        it "LEFT"
            gma.constants.LEFT.should.not.be_undefined
        end
    
        it "RIGHT"
            gma.constants.RIGHT.should.not.be_undefined
        end
    end
    
    describe "related to sides"
        it "TOP"
            gma.constants.TOP.should.not.be_undefined
        end
    
        it "BOTTOM"
            gma.constants.BOTTOM.should.not.be_undefined
        end
        
        it "Also can use LEFT and RIGHT for sides"
        end
    end
    
end

///////////////////////////////////////////////////////////////////////////////

        }
    }
)
