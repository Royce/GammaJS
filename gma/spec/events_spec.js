require(
    ['gma/base', 'gma/events'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

describe "Gamma KeyHandler"
    
    before_each
        handler = gma.keyHandler
    end
    
    after_each
        handler.reset()
    end
    
    it "should have a register function"
        handler.should.respond_to "register"
    end
    
    it "should have a reset function"
        handler.should.respond_to "reset"
    end
    
    it "should be able to register a function"
        handler.numEvents(97).should.eql 0
        handler.register(97, -{})
        handler.numEvents(97).should.eql 1
    end
    
    it "should be able to register using a character"
        handler.numEvents(97).should.eql 0
        handler.register('a', -{})
        handler.numEvents(97).should.eql 1
    end
    
    it "should be able to find and execute all registered functions for a particular keycode"
        count = 0
        count2 = 0
        handler.register('a', -{count = 1})
        handler.register(97, -{count2 = 2})
        handler.keyCheck({'keyCode' : 97})
        
        count.should.be 1
        count2.should.be 2
    end
    
    it "should throw an error if you register with anything other than number or character"
        -{handler.register('aa', -{})}.should.throw_error
        -{handler.register({}, -{})}.should.throw_error
        -{handler.register([], -{})}.should.throw_error
        -{handler.register(function(){}, -{})}.should.throw_error
    end
    
    it "should be able to register many functions for same keypress"
        handler.numEvents(97).should.eql 0
        handler.register(97, -{})
        handler.register(97, -{})
        handler.register(97, -{})
        handler.numEvents(97).should.eql 3
    end
    
    it "should be able to reset handles"
        handler.numEvents().should.eql 0
        handler.register(97, -{})
        handler.register(97, -{})
        handler.register(97, -{})
        handler.numEvents().should.be_greater_than 0
        
        handler.reset()
        handler.numEvents().should.eql 0
    end
    
end

///////////////////////////////////////////////////////////////////////////////

        }
    }
)
