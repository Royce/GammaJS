require(
    ["gma/base", "gma/manager", "gma/utils/hud"],
    function(gma) {
        with (JSpec) {
        
///////////////////////////////////////////////////////////////////////////////

describe "Gamma HUD"
    
    before_each
        
        value = 1
        getLives = -{return 3*value}
        getStars = -{return 5*value}
        getFPS   = -{return 7*value}
        
        hud = gma.hud()
        html = $('<div id="gamma"></div>')
        
        makeHud = function(spec) {
            html = $('<div id="gamma"></div>')
            hud.canvasContainer = html
            hud.setup(spec)
            return html
        }
        
        checkSection = function(position, kls, numbers) {
            var spec = "#" + position
            if (kls) {
                spec = spec + " ." + kls
            }
            
            html.find(spec).length.should.be 1
            element = $(spec, html)
            
            sum = 0
            if (numbers) {
                _.each(numbers, function(amount, type) {
                    if (amount === 1) {
                        element.should.have_one type
                    }
                    else {
                        element.should.have_many type
                    }
                    
                    element.find(type).length.should.be amount
                    sum += amount
                })
                
                element.children().length.should.be sum
            }
            
        }
        
        checkOrder = function(position, kls, expected) {
            if (!_.isArray(expected[0])) {
                expected = [expected]
            }
            
            _.each(expected, function(couple) {
                first = inside = couple[0]
                second = couple[1]
                if (couple.length === 3) {
                    second = couple[2];
                    inside = couple[1];
                }
                
                base = "div#" + position + " dl." + kls + " dt#hud_" + first
                $(base + " span", html).should.have_text inside
                $(base + "+dd", html).should.have_text second
            })
        }
        
    end
    
    
    describe "when Setting up"
        it "should complain if the hud doesn't have a canvasContainer property"
            gma.hud().setup.should.throw_error
        end
        
        it "should not fail if there is no spec"
            makeHud.should.not.throw_error
        end
        
        it "should call reset when no spec is provided"
            hud.should.receive("reset")
            html = makeHud()
        end
        
        it "should call reset when spec is provided"
            hud.should.receive("reset")
            makeHud({top_left : {a : 1}})
        end
        
        describe "and creating all specified sections"
            it "should split position and use both parts as arguments to hud.createSection"
                hud.should.receive("createSection").with_args("top", "left")
                makeHud({top_left : {a : 1}})
            end
            
            it "should call createSection for each section"
                hud.should.receive("createSection", 3)
                html = makeHud({
                    some_section : {},
                    another_section :{},
                    blah_meh : {}
                })
            end
        end
        
        it "should not attempt to create sections that aren't specified"
            html = makeHud({
                some_section : {},
                another_section :{},
                blah_meh : {}
            })
            
            html.should.have_only ["#some_hud", "#another_hud", "#blah_hud"]
        end
        
        it "should attempt to fill each section with specified list"
            container = hud.createSection("top", "left")
            options = {a : 1}
            //Seems it won't let me use container inside with_args
            hud.should.receive("fillSection")
            makeHud({top_left : options})
        end
        
        it "should create section containers only if specified"
            html = makeHud({
                top_right : {c : -{return 6}}
            })
            html.should.have_only "#top_hud"
        end
        
        describe "should create each section containers only once"
            it "when only one section container is specified"
                html = makeHud({
                    bottom_right : {c : -{return 6}}
                })
                html.should.have_only "#bottom_hud"
                
                html = makeHud({
                    top_right : {c : -{return 6}}
                })
                html.should.have_only "#top_hud"
            end
            
            it "when multiple section containers are specified"
                html = makeHud({
                    bottom_right : {c : -{return 6}},
                    top_right : {c : -{return 6}}
                })
                html.should.have_only ["#bottom_hud", "#top_hud"]
            end
        end
    end
    
    describe "when creating sections"
        it "should create a div section with a dl inside"
            makeHud()
            hud.createSection("top", "left")
            checkSection("top_hud", null, {dl : 1})
        end
        
        it "should create both elements if they don't already exist"
            html.should.have_only []
            
            makeHud()
            hud.createSection("top", "left")
            
            html.should.have_only "#top_hud"
            checkSection("top_hud", null, {dl : 1})
        end
        
        it "should not duplicate either element if they don't already exist"
            html.should.have_only []
            
            makeHud()
            hud.createSection("top", "left")
            
            html.should.have_only "#top_hud"
            checkSection("top_hud", null, {dl : 1})
            
            hud.createSection("top", "left")
            
            html.should.have_only "#top_hud"
            checkSection("top_hud", "left")
            checkSection("top_hud", null, {dl : 1})
            
            hud.createSection("top", "right")
            
            html.should.have_only "#top_hud"
            checkSection("top_hud", "left")
            checkSection("top_hud", "right")
            checkSection("top_hud", null, {dl : 2})
        end
        
        it "should give the div an id of the provided id with _hud added to it"
            makeHud()
            hud.createSection("blah", "meh")
            
            checkSection("blah_hud")
            html.children().length.should.be 1
        end
        
        it "should set the class on the dl to the one provided"
            makeHud()
            hud.createSection("blah", "meh")
            hud.createSection("blah", "rah")
            
            checkSection("blah_hud", "meh")
            checkSection("blah_hud", "rah")
            checkSection("blah_hud", null, {dl : 2})
            html.children().length.should.be 1
        end
        
        it "should add elements to the HUD's canvasContainer"
            makeHud()
            hud.canvasContainer.children().length.should.be 0
            hud.createSection("blah", "meh")
            hud.createSection("blah", "rah")
            hud.canvasContainer.children().length.should.be_greater_than 0
        end
    end
    
    describe "when filling sections"
        it "should append dt and dd to the specified container for each item specified"
            makeHud()
            dl = hud.createSection("blah", "meh")
            checkSection("blah_hud", "meh", {})
            
            hud.fillSection(dl, {a : 1})
            
            checkSection("blah_hud", "meh", {dt : 1, dd : 1})
        end
        
        it "should give the dt an id of that specified prepended with hud_"
            makeHud()
            dl = hud.createSection("blah", "meh")
            $("div#blah_hud dl.meh dt#hud_b", html).length.should.be 0
            hud.fillSection(dl, {b : 2})
            $("div#blah_hud dl.meh dt#hud_b", html).length.should.be 1
        end
        
        it "should use lowercase for the id for the dt"
            makeHud()
            dl = hud.createSection("blah", "meh")
            $("div#blah_hud dl.meh dt#hud_CamelCase", html).length.should.be 0
            $("div#blah_hud dl.meh dt#hud_camelcase", html).length.should.be 0
            hud.fillSection(dl, {CamelCase : 2})
            $("div#blah_hud dl.meh dt#hud_CamelCase", html).length.should.be 0
            $("div#blah_hud dl.meh dt#hud_camelcase", html).length.should.be 1
        end
        
        it "should put a span inside the dt"
            makeHud()
            dl = hud.createSection("blah", "meh")
            hud.fillSection(dl, {CamelCase : 2})
            
            $("dt", dl).should.have_only "span"
        end
        
        it "should use the label as text inside the span inside the dt"
            makeHud()
            dl = hud.createSection("blah", "meh")
            hud.fillSection(dl, {CamelCase : 2})
            
            $("dt span", dl).text().should.eql "CamelCase"
        end
        
        it "should use the value as text inside the dd as is if not a function"
            makeHud()
            dl = hud.createSection("blah", "meh")
            hud.fillSection(dl, {CamelCase : 2})
            
            $("dt+dd", dl).text().should.eql "2"
        end
        
        it "should use the result of executing the value as text inside dd if a function"
            makeHud()
            dl = hud.createSection("blah", "meh")
            hud.fillSection(dl, {CamelCase : -{return "stuff"}})
            
            $("dt+dd", dl).text().should.eql "stuff"
        end
        
        it "should not add functions to the container if value is not a function"
            makeHud()
            dl = hud.createSection("blah", "meh")
            dl.should.not.have "functions"
            
            hud.fillSection(dl, {CamelCase : 2})
            
            dl.should.not.have "functions"
        end
        
        it "should ensure the container has a functions array if value is a function"
            makeHud()
            dl = hud.createSection("blah", "meh")
            dl.should.not.have "functions"
            
            hud.fillSection(dl, {CamelCase : -{return 2}})
            
            dl.functions.should.not.be_undefined
            _.isArray(dl.functions).should.be true
            dl.functions.length.should.be 1
        end
        
        it "should add value to functions on the dt if a function"
            makeHud()
            dl = hud.createSection("blah", "meh")
            dl.functions = [1]
            
            hud.fillSection(dl, {CamelCase : -{return 2}})
            
            dl.functions.length.should.be 2
            dl.functions[1][1]().should.be 2
        end
        
        it "should add dd to functions on the dt if a function"
            makeHud()
            dl = hud.createSection("blah", "meh")
            dl.functions = [1]
            
            hud.fillSection(dl, {CamelCase : -{return 2}})
            dd = $("dt#hud_camelcase+dd", dl)[0]
            
            dl.functions.length.should.be 2
            dl.functions[1][0][0].should.be dd
            dl.functions[1][1]().should.be 2
        end
    end
    
    describe "when resetting"
        it "should remove all items from any items in canvasContainer whose id ends with _hud"
            makeHud()
            hud.canvasContainer.children().length.should.be 0
            hud.canvasContainer.append('<div id="asdf_hud"></div>')
            hud.canvasContainer.append('<div id="blah_hud"></div>')
            hud.canvasContainer.append('<div id="asdf_h"></div>')
            hud.canvasContainer.children().length.should.be 3
            hud.reset()
            
            hud.canvasContainer.should.have_only "#asdf_h"
        end
        it "should remove sections from the HUD object"
            hud.top_left.should.be_undefined
            makeHud({
                top_left : {a : 2}
            })
            hud.top_left.should.not.be_undefined
            hud.reset()
            hud.top_left.should.be_undefined
        end
    end
    
    describe "when refreshing"
        it "should execute any functions that were stored and replace text in the respective dd"
            makeHud({
                top_left : {me : getFPS},
                bottom_right : {u : getLives, yay : getStars},
                bottom_left : {i : getStars}
            })
            
            checkOrder("top_hud", "left", ['me', "7"])
            checkOrder("bottom_hud", "left", ['i', "5"])
            checkOrder("bottom_hud", "right", [['u', "3"], ['yay', '5']])
            
            value = 2
            hud.refresh()
            
            checkOrder("top_hud", "left", ['me', "14"])
            checkOrder("bottom_hud", "left", ['i', "10"])
            checkOrder("bottom_hud", "right", [['u', "6"], ['yay', '10']])
        end
    end
    
    describe "when hiding"
        it "should be possible to hide a particular section of the HUD"
            makeHud({
                top_left : {me : getFPS},
                bottom_right : {u : getLives, yay : getStars},
                bottom_left : {i : getStars}
            })
            
            $("#top_hud", html).should.be_visible
            $("#top_hud dl.left", html).should.be_visible
            
            $("#bottom_hud", html).should.be_visible
            $("#bottom_hud dl.left", html).should.be_visible
            $("#bottom_hud dl.right", html).should.be_visible
            
            hud.hide("top_left")
            
            $("#top_hud", html).should.not.be_visible
            $("#top_hud dl.left", html).should.not.be_visible
            
            $("#bottom_hud", html).should.be_visible
            $("#bottom_hud dl.left", html).should.be_visible
            $("#bottom_hud dl.right", html).should.be_visible
            
            hud.hide("bottom_left")
            
            $("#top_hud", html).should.not.be_visible
            $("#top_hud dl.left", html).should.not.be_visible
            
            $("#bottom_hud", html).should.be_visible
            $("#bottom_hud dl.left", html).should.not.be_visible
            $("#bottom_hud dl.right", html).should.be_visible
            
            hud.hide("bottom_right")
            
            $("#top_hud", html).should.not.be_visible
            $("#top_hud dl.left", html).should.not.be_visible
            
            $("#bottom_hud", html).should.not.be_visible
            $("#bottom_hud dl.left", html).should.not.be_visible
            $("#bottom_hud dl.right", html).should.not.be_visible
        end
        
        it "should be possible to hide all elements inside canvasContainer whose id ends with _hud and any dl inside this element"
            makeHud()
            html.append('<div id="top_hud"><dl class="meh"></dl><de></de></div>')
            html.append('<div id="blah_hud"><dl class="meh"></dl></div>')
            html.append('<div id="blah_meh"><dl class="meh"></dl></div>')
            
            hud.hide()
            
            $('div#top_hud', html).should.be_hidden
            $('div#top_hud dl.meh', html).should.be_hidden
            $('div#top_hud de', html).should.not.be_hidden
            
            $('div#blah_hud', html).should.be_hidden
            $('div#blah_hud dl', html).should.be_hidden
            
            $('div#blah_meh', html).should.not.be_hidden
            $('div#blah_meh dl', html).should.not.be_hidden
        end
        
        it "should be able to hide an entire section"
            makeHud({
                top_left : {me : getFPS},
                bottom_right : {u : getLives, yay : getStars},
                bottom_left : {i : getStars}
            })
            
            $("#top_hud", html).should.be_visible
            $("#top_hud dl.left", html).should.be_visible
            
            $("#bottom_hud", html).should.be_visible
            $("#bottom_hud dl.left", html).should.be_visible
            $("#bottom_hud dl.right", html).should.be_visible
            
            hud.hide("top")
            
            $("#top_hud", html).should.not.be_visible
            $("#top_hud dl.left", html).should.not.be_visible
            
            $("#bottom_hud", html).should.be_visible
            $("#bottom_hud dl.left", html).should.be_visible
            $("#bottom_hud dl.right", html).should.be_visible
            
            hud.hide("bottom")
            
            $("#top_hud", html).should.not.be_visible
            $("#top_hud dl.left", html).should.not.be_visible
            
            $("#bottom_hud", html).should.not.be_visible
            $("#bottom_hud dl.left", html).should.not.be_visible
            $("#bottom_hud dl.right", html).should.not.be_visible
        end
    end
    
    describe "when showing itself"
        it "should be possible to show a particular section of the HUD"
            makeHud({
                top_left : {me : getFPS},
                bottom_right : {u : getLives, yay : getStars},
                bottom_left : {i : getStars}
            })
            
            hud.hide()
            
            $("#top_hud", html).should.be_hidden
            $("#top_hud dl.left", html).should.be_hidden
            
            $("#bottom_hud", html).should.be_hidden
            $("#bottom_hud dl.left", html).should.be_hidden
            $("#bottom_hud dl.right", html).should.be_hidden
            
            hud.show("top_left")
            
            $("#top_hud", html).should.not.be_hidden
            $("#top_hud dl.left", html).should.not.be_hidden
            
            $("#bottom_hud", html).should.be_hidden
            $("#bottom_hud dl.left", html).should.be_hidden
            $("#bottom_hud dl.right", html).should.be_hidden
            
            hud.show("bottom_left")
            
            $("#top_hud", html).should.not.be_hidden
            $("#top_hud dl.left", html).should.not.be_hidden
            
            $("#bottom_hud", html).should.not.be_hidden
            $("#bottom_hud dl.left", html).should.not.be_hidden
            $("#bottom_hud dl.right", html).should.be_hidden
            
            hud.show("bottom_right")
            
            $("#top_hud", html).should.not.be_hidden
            $("#top_hud dl.left", html).should.not.be_hidden
            
            $("#bottom_hud", html).should.not.be_hidden
            $("#bottom_hud dl.left", html).should.not.be_hidden
            $("#bottom_hud dl.right", html).should.not.be_hidden
        end
        
        it "should be possible to show all elements inside canvasContainer whose id ends with _hud and any dl inside this element"
            makeHud()
            html.append('<div id="top_hud" style="display:none"><dl class="meh"  style="display:none"></dl><de  style="display:none"></de></div>')
            html.append('<div id="blah_hud"  style="display:none"><dl class="meh"  style="display:none"></dl></div>')
            html.append('<div id="blah_meh"  style="display:none"><dl class="meh"  style="display:none"></dl></div>')
            
            hud.show()
            
            $('div#top_hud', html).should.be_visible
            $('div#top_hud dl.meh', html).should.be_visible
            $('div#top_hud de', html).should.not.be_visible
            
            $('div#blah_hud', html).should.be_visible
            $('div#blah_hud dl', html).should.be_visible
            
            $('div#blah_meh', html).should.not.be_visible
            $('div#blah_meh dl', html).should.not.be_visible
        end
        
        it "should be possible to show an entire section of the HUD"
            makeHud({
                top_left : {me : getFPS},
                bottom_right : {u : getLives, yay : getStars},
                bottom_left : {i : getStars}
            })
            
            hud.hide()
            
            $("#top_hud", html).should.be_hidden
            $("#top_hud dl.left", html).should.be_hidden
            
            $("#bottom_hud", html).should.be_hidden
            $("#bottom_hud dl.left", html).should.be_hidden
            $("#bottom_hud dl.right", html).should.be_hidden
            
            hud.show("top")
            
            $("#top_hud", html).should.not.be_hidden
            $("#top_hud dl.left", html).should.not.be_hidden
            
            $("#bottom_hud", html).should.be_hidden
            $("#bottom_hud dl.left", html).should.be_hidden
            $("#bottom_hud dl.right", html).should.be_hidden
            
            hud.show("bottom")
            
            $("#top_hud", html).should.not.be_hidden
            $("#top_hud dl.left", html).should.not.be_hidden
            
            $("#bottom_hud", html).should.not.be_hidden
            $("#bottom_hud dl.left", html).should.not.be_hidden
            $("#bottom_hud dl.right", html).should.not.be_hidden
        end
    end
end

describe "Messages"
    describe "when displaying"
        it "should create a div with id message if it doesn't already exist"
            makeHud()
            html.should.have_only []
            hud.displayMessage("blah")
            html.should.have_only '#message'
            html.find("div").length.should.be 1
        end
        
        it "should set the text in message div to desired message"
            makeHud()
            hud.displayMessage("blah")
            $("div#message", html).text().should.eql "blah"
        end
        
        it "should show the message div"
            makeHud()
            html.append('<div id="message" style="display:none"></div>')
            html.find("div#message").should.be_hidden
            hud.displayMessage("blah")
            html.find("div#message").should.be_visible
        end
        
        it "should hide the message after specified timeout if specified"
            makeHud()
            hud.displayMessage("blah", 20)
            html.find("div#message").should.be_visible
            tick(20)
            html.find("div#message").should.be_hidden
        end
        
        it "should call callback function immediately if defined and no wait period"
            obj = {func : -{}}
            obj.should.receive("func")
            
            makeHud()
            hud.displayMessage("blah", null, obj.func)
        end
        
        it "should call callback function after specified timeout if both callback and timer is specified"
            count = 0
            obj = {func : -{count = 1}}
            obj.should.receive("func")
            
            makeHud()
            hud.displayMessage("blah", 5, obj.func)
            tick(6)
            count.should.be 1
        end
    end
    
    describe "when hiding"
        it "should hide the div with id of 'message'"
            makeHud()
            hud.displayMessage("blah")
            html.find("div#message").should.be_visible
            
            hud.hideMessage()
            html.find("div#message").should.be_hidden
        end
    end
end

///////////////////////////////////////////////////////////////////////////////

        }
    }
)
