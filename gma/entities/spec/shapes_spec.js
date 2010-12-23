require(
    ['gma/base', 'gma/entities/shapes', 'gma/constants', 'gma/entities/character'],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

describe "Gamma Rectangle"

    before_each
        O = gma.shapes.rectangle
        
        test = function(res) {
            res.should.not.be_undefined
            if (res) {
                res.y.should.eql 30
                res.x.should.eql 20
                
                res.top.should.eql 50
                res.bottom.should.eql 10
                
                res.left.should.eql 10
                res.right.should.eql 30
                
                res.width.should.eql 20
                res.height.should.eql 40
                
                res.edges[gma.constants.LEFT  ].should.have_same_points_as [[10,50], [10,10]]
                res.edges[gma.constants.RIGHT ].should.have_same_points_as [[30,10], [30,50]]
                res.edges[gma.constants.TOP   ].should.have_same_points_as [[30,50], [10,50]]
                res.edges[gma.constants.BOTTOM].should.have_same_points_as [[10,10], [30,10]]
            }
        }
    end
    
    it "should exist"
        gma.shapes.rectangle.should.not.be_undefined
    end
        
    it "should have a tag of shape"
        result = O({left:0, width:20, top:30, bottom:40})
        result.tags.shape.should.not.be_undefined
    end
    
    it "should accept a list of extra tags"
        result = O({left:0, width:20, top:30, bottom:40, tags:["hello", "there"]})
        result.tags.hello.should.not.be_undefined
        result.tags.there.should.not.be_undefined
        result.tags.shape.should.not.be_undefined
    end
    
    it "should use other properties if given points is null"
        O({points:null, x:0, y:0, width:1, height:1}).should.not.be null
    end
    
    it "should be possible to get a string representation of the object"
        result = O({width:20, height:40, bottom:10, right:30})
        result.toString().should.eql "y:30 x:20 t:50 b:10 l:10 r:30 w:20 h:40"
    end
    
    it "should provide deathtouch collision functionality"
        rec = O({left:0, bottom:0, width:1, height:1})
        character = gma.character({right:0, bottom:0, width:1, height:1})
        character.alive.should.be true
        rec.collided__deathtouch(gma.constants.RIGHT, character, gma.constants.LEFT)
        character.alive.should.be false
    end
    
    it "should provide the x-coordinate of a specific side"
        rec = O({left:10, right:30, top:50, bottom:10})
        rec.xOf(gma.constants.LEFT).should.eql 10
        rec.xOf(gma.constants.RIGHT).should.eql 30
        rec.xOf(gma.constants.TOP).should.eql null
        rec.xOf(gma.constants.BOTTOM).should.eql null
    end
    
    it "should provide the y-coordinate of a specific side"
        rec = O({left:10, right:30, top:50, bottom:10})
        rec.yOf(gma.constants.TOP).should.eql 50
        rec.yOf(gma.constants.BOTTOM).should.eql 10
        rec.yOf(gma.constants.LEFT).should.eql null
        rec.yOf(gma.constants.RIGHT).should.eql null
    end
    
    it "should allow the entity to be recentered"
        rec = O({x:1, y:1, width:20, height:40})
        rec.left.should.be -9
        rec.right.should.be 11
        rec.top.should.be 21
        rec.bottom.should.be -19
        
        rec.setCentre([20, 30])
        test(rec)
    end
    
    it "should allow the entity to be repositioned with respect to it's bottom left corner"
        rec = O({x:1, y:1, width:20, height:40})
        rec.left.should.be -9
        rec.right.should.be 11
        rec.top.should.be 21
        rec.bottom.should.be -19
        
        rec.setBottomLeft([10, 10])
        test(rec)
    end

    describe "factory"
        
        describe "will accept zero as a valid input"
            
            it "for left"
                result = O({left:0, width:20, top:30, bottom:40})
                result.right.should.eql 20
            end
            
            it "for right"
                result = O({width:20, right:0, top:30, bottom:40})
                result.left.should.eql -20
            end
            
            it "for top"
                result = O({left:10, right:20, top:0, height:40})
                result.bottom.should.eql -40
            end
            
            it "for bottom"
                result = O({left:10, right:20, height:30, bottom:0})
                result.top.should.eql 30
            end
        end
        
        describe "will create a rectangle after accepting only"
            it "width and height + centre as an array"
                result = O({width:20, height:40, centre:[20,30]})
                test(result)
            end
            
            it "width and height + centre as an x and y"
                result = O({width:20, height:40, x:20, y:30})
                test(result)
            end
            
            it "width and height + top or bottom + left or right"
                result = O({width:20, height:40, top:50, left:10})
                test(result)
                
                result = O({width:20, height:40, top:50, right:30})
                test(result)
                
                result = O({width:20, height:40, bottom:10, left:10})
                test(result)
                
                result = O({width:20, height:40, bottom:10, right:30})
                test(result)
            end
            
            it "width and height + top or bottom + x"
                result = O({width:20, height:40, top:50, x:20})
                test(result)
                
                result = O({width:20, height:40, bottom:10, x:20})
                test(result)
            end
            
            it "width and height + left or right + y"
                result = O({width:20, height:40, left:10, y:30})
                test(result)
                
                result = O({width:20, height:40, right:30, y:30})
                test(result)
            end
            
            it "top and bottom + left or right + width"
                result = O({top:50, bottom:10, left:10, width:20})
                test(result)
                
                result = O({top:50, bottom:10, right:30, width:20})
                test(result)
            end
            
            
            it "left and right + top or bottom + height"
                result = O({left:10, right:30, top:50, height:40})
                test(result)
                
                result = O({left:10, right:30, bottom:10, height:40})
                test(result)
            end
            
            it "width and x + top and bottom"
                result = O({width:20, x:20, bottom:10, top:50})
                test(result)
            end
            
            it "height and y + left and right"
                result = O({height:40, y:30, left:10, right:30})
                test(result)
            end
            
            it "more than two points"
                result = O({points:[[10,10], [30, 50]]})
                test(result)
                result = O({points:[[30,50], [10, 10]]})
                test(result)
                
                result = O({points:[[10,10], [30,10], [30, 50]]})
                test(result)
                result = O({points:[[10,10], [30, 50], [10,50]]})
                test(result)
                
                result = O({points:[[30,10], [10,10], [30, 50]]})
                test(result)
                result = O({points:[[30, 50], [10,10], [10,50]]})
                test(result)
                
                result = O({points:[[10,10], [30, 50], [30,10], [10,50]]})
                test(result)
            end
            
            it "any points as long as we have two diagonally opposite corners"
                result = O({points:[[11,10], [29, 50], [30,10], [10,50]]})
                test(result)
            end
            
            it "two opposite corners"
                result = O({points:[[10,10], [30,50]]})
                test(result)
            end
            
            it "left, right, top and bottom"
                result = O({left:10, right:30, top:50, bottom:10})
                test(result)
            end
            
        end
        
        describe "won't create a rectangle after"
            
            it "accepting only two non-opposite corners"
                result = O({points:[[10,10], [10,50]]})
                result.should.be_undefined
                
                result = O({points:[[30,10], [30,50]]})
                result.should.be_undefined
                
                result = O({points:[[10,10], [30,10]]})
                result.should.be_undefined
                
                result = O({points:[[10,50], [30,50]]})
                result.should.be_undefined
            end
            
            it "accepting less than two points"
                result = O({points:[[10,10]]})
                result.should.be_undefined
            end
            
            it "having discreprency between left and right and width"
                O({left:1, right:5, width:10, bottom:1, height:1}).should.be_undefined
                O({left:5, right:1, width:10, bottom:1, height:1}).should.be_undefined
                O({left:5, right:1, width:10, bottom:1, top:2}).should.be_undefined
                O({left:1, right:5, width:4, bottom:1, height:1}).should.not.be_undefined
            end
            
            it "having discreprency between top and bottom and height"
                O({left:1, right:5, width:4, top:10, bottom:1, height:3}).should.be_undefined
                O({left:1, right:5, top:10, bottom:1, height:3}).should.be_undefined
                O({left:5, right:1, top:1, bottom:10, height:3}).should.be_undefined
                O({left:5, right:1, top:4, bottom:1, height:3}).should.not.be_undefined
            end
        end
    end
end

///////////////////////////////////////////////////////////////////////////////

        }
    }
)
