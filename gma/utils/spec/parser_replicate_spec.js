require(
    ['gma/base', 'gma/utils/parser'],
    function(gma) {
        with (JSpec) {

///////////////////////////////////////////////////////////////////////////////

describe "Expanding `replicateWith' lists"
    it "should be implemented in a function at gma.utils.expandReplicateWith"
        gma.utils.expandReplicateWith.should.not.be_undefined
    end
    
    it "should return the same structure if nothing has a replicateWith property"
        test = {
            'hash' : {'first': 1, 'second': "a"},
            'arr' : [4, 5, 6, "asdf"],
            'nested': {
                "arr": [{"one": "one", "two": 1}, 123, "abc"],
                "h": {"a": "aaa", "b": "bbb", "catch": 22}
            }
        }
        test.should.eql gma.utils.expandReplicateWith(test)
    end
  
    it "should expand entries that have a replicateWith property with defaults provided by parent"
        input = {
            'property1' : 1,
            'replicateWith' : [
                {'property2' : "a"},
                {'property2' : "b"},
                {'property2' : "c"}
            ]
        }
        output = [
                {'property1' : 1, 'property2' : "a"},
                {'property1' : 1, 'property2' : "b"},
                {'property1' : 1, 'property2' : "c"}
        ]
        output.should.eql gma.utils.expandReplicateWith(input)
    
        input = {
            'this' : {
                'property1' : 1,
                'replicateWith' : [
                    {'property2' : 20},
                    {'property2' : 21},
                    {'property2' : 22}
                ]
            }
        }
        output = {
            'this' : [
                {'property1' : 1, 'property2' : 20},
                {'property1' : 1, 'property2' : 21},
                {'property1' : 1, 'property2' : 22}
            ]
        }
        output.should.eql gma.utils.expandReplicateWith(input)
    end

    it "should not create an array if the replicateWith is a single item"
        input = {
            'property1' : 1,
            'replicateWith' : [
                {'property2' : "a"}
            ]
        }
        output = {'property1' : 1, 'property2' : "a"}
        output.should.eql gma.utils.expandReplicateWith(input)
    end
    
    it "should add replicants to parents array if it is in on"
        input = [
            {
                'property1' : 1,
                'replicateWith' : [
                    {'property2' : 20},
                    {'property2' : 21}
                ]
            }
        ]
        output = [
            {'property1' : 1, 'property2' : 20},
            {'property1' : 1, 'property2' : 21}
        ]
        output.should.eql gma.utils.expandReplicateWith(input)
        
        input = {
            'this' : [
                {
                    'property1' : 1,
                    'replicateWith' : [
                        {'property2' : 20},
                        {'property2' : 21},
                        {'property2' : 22}
                    ]
                },
                {
                    'property1' : 11,
                    'replicateWith' : [
                        {'property2' : 20},
                        {'property2' : 21},
                        {'property2' : 22}
                    ]
                }
            ]
        }
        output = {
            'this' : [
                {'property1' : 1, 'property2' : 20},
                {'property1' : 1, 'property2' : 21},
                {'property1' : 1, 'property2' : 22},
                {'property1' : 11, 'property2' : 20},
                {'property1' : 11, 'property2' : 21},
                {'property1' : 11, 'property2' : 22}
            ]
        }
        output.should.eql gma.utils.expandReplicateWith(input)
    end
    
    it "should allow nested replicateWith"
        input = {
            'this' : {
                'property1' : 1,
                'replicateWith' : [
                    {'property2' : 20},
                    {'property2' : 21, "replicateWith": [{"x":0, "y":0}, {"x":1, "y":2}]},
                    {'property2' : 22}
                ]
            }
        }
        output = {
            'this' : [
                {'property1' : 1, 'property2' : 20},
                {'property1' : 1, 'property2' : 21, "x":0, "y":0},
                {'property1' : 1, 'property2' : 21, "x":1, "y":2},
                {'property1' : 1, 'property2' : 22}
            ]
        }
        output.should.eql gma.utils.expandReplicateWith(input)
        
    end
    
    it "should not replicate complex objects (atm, those with functions)"
        input = {
            'this' : {
                'property1' : 1,
                'aFunc' : function() {},
                'replicateWith' : [
                    {'property2' : 20},
                    {'property2' : 21, "replicateWith": [{"x":0, "y":0}, {"x":1, "y":2}]},
                    {'property2' : 22}
                ]
            }
        }
        input.should.eql gma.utils.expandReplicateWith(input)
        
    end
end

///////////////////////////////////////////////////////////////////////////////
        }
    }
)
