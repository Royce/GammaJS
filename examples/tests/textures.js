/*global require, GLGE */
require(['gma/base', 'gma/manager', 'gma/utils/render', 'gma/events'],
    
    function(gma) {
        var manager = gma.manager({showLoading:false});
        
        /*########################
        ###
        ###   DEFINE LEVEL PARSER
        ###
        ########################*/
        
        manager.addCustomDefinitions({
            templates : {
                
                texturecube : ['meshTemplate',
                    {
                        mesh : gma.unitCubeInfo.mesh,
                        texture : {src:'/gmamedia/textures/wood.jpg', repeatX:0.5, repeatY:0.5}
                    }
                ]
            },
            
            types : {
                platform : ['platform', {template : 'texturecube'}]
            }
        });
        
        manager.storeLevels({
            light: {
                light1 : {position : [-10, 0, 20]}
            },
            
            entities : [               
                {type: 'platform', depth:20, left:-5, bottom:-5, width:10, height:10}
            ]
        });
        
        manager.hud.setup({
            top_left:  {FPS: manager.getFPS},
            top_right:  {'': "Press 'h' to toggle instructions"}
        });
        
        gma.instructions(manager.hud,
            "Use the cursor keys to rotate the rectangle.",
            72
        )
        
        manager.loadLevel();
        
        var yRotate = 0;
        var xRotate = 0;
        
        //right key
        gma.keyHandler.register(39, function() { yRotate += 0.1; });
        
        //left key
        gma.keyHandler.register(37, function() { yRotate -= 0.1; });
        
        // up key
        gma.keyHandler.register(38, function() { xRotate -= 0.1; });
        
        // down key
        gma.keyHandler.register(40, function() { xRotate += 0.1; });
        
        
        var theCube = manager.currentLevel.entities[0];
        theCube.getRotation = function () { };
        
        var oldSetLocation = theCube.helper.setLocation;
        theCube.helper.setLocation = function() {
            oldSetLocation();
            var obj = theCube.helper.getRenderedObj();
            obj.setRotY(yRotate);
            obj.setRotX(xRotate);
        };
        
        manager.init();
    }
);


