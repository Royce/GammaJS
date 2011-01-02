/*global require, GLGE, _ */
var deps = [
    'gma/base',
    'gma/manager',
    'gma/entities/character',
    'gma/entities/enemy',
    'gma/entities/collectable',
    'gma/utils/render',
    'gma/events',
    'gma/utils/parser',
    'gma/entities/door', 
    
    '_levels/types',
    '_levels/templates'
];

var numLevels = 7;
for (var i=1; i <= 7; i++) {
    deps.push('_levels/level' + i);
}

require(deps,
    
    function(gma) {
        var manager = gma.manager({showLoading:false});
        
        /*########################
        ###
        ###   DEFINE CHARARCTER
        ###
        ########################*/
        
        manager.character = gma.character({ 
            left     : 0,
            width    : 4,
            depth    : 4,
            height   : 7.5,
            bottom   : 0,
            template : 'gorilla',
            lastXState : gma.constants.RIGHT
        });
        
        /*########################
        ###
        ###   DEFINE LEVEL PARSER
        ###
        ########################*/
        
        var templates = require('_levels/templates');
        var types = require('_levels/types');
        
        manager.addCustomDefinitions({
            templates : templates,
            types : types
        });
        
        /*########################
        ###
        ###   GET LEVELS
        ###
        ########################*/
        
        var cmn = require('_levels/common');        
        var spawn = {
            main : [5, 10]
        };
        var extraLevels = [];
        var portals = [];
        var i = 0;
        while (i < numLevels) {
            var lvl = i + 1;
            var next = require('_levels/level' + lvl);
            if (_.isFunction(next)) {
                next = next(manager);
            }
            extraLevels.push(next);
            _.each([
                {left:0+i*25, top:0, width:25, height:5},
                {left:0+i*25, bottom:0, width:15, height:5},
                {type:'door', left:15+i*25, height:4, bottom:0, width:10, level:lvl}
            ], function(n) { portals.push(n); });
            
            var use = lvl;
            if (use == numLevels) {
                use = i;
            }
            spawn['island' + lvl] = [5+use*25, 10];
            i += 1;
        }        
        
        var level0 = {  
            spawn : spawn,
            
            background : [
                {
                    id : 'skybox2',
                    config : 'skybox', 
                    texture : {
                        src:'/gmamedia/textures/cloud_mosaic.jpg',
                        repeatX:0.03,
                        repeatY:0.03
                    },
                    width:256,
                    height:256,
                    x : 50,
                    y : 0,
                    z : -cmn.thickness
                }
            ],
            camera : { 
                locZ : 45,
                rotX : -0.3,
                attached : ['character', 0, 10]
             },
            
            light : {
                spotLight : {
                    rotY : 1.54,
                    locZ : -50,
                    type : GLGE.L_POINT,
                    
                    color    : "#fff",
                    rotOrder : GLGE.ROT_XZY,
                    
                    attenuationLinear    : 0.0,
                    attenuationConstant  : 2.0,
                    attenuationQuadratic : 0.00,
                    
                    attached : ["character", 0, 3]
                }
            },
            
            entities : [
                {type:"platform", depth:20, bottom:-5, width:20, height:50, right:0},
                {type:"platform", depth:20, replicateWith : portals },
                {type:"platform", depth:20, bottom:-5, width:20, height:50, left:numLevels*25}
            ]
        };
        
        
        /*########################
        ###
        ###   SETUP HUD AND KEY BINDINGS
        ###
        ########################*/
        
        var getStatus = function() {
            if (manager.character.alive) {
                return "You are totally alive";
            }
            else {
                return "You died... but you're still awesome!";
            }
        };
        
        manager.hud.setup({
            top_left: {
                "FPS": manager.getFPS
            },
            bottom_right: {
                "": getStatus
            },
            bottom_left:  {'': function() { 
                if (manager.levelIndex === 0) {
                    return "Press 'h' to toggle instructions";
                }
                else {
                    return '';
                }
            }},
            top_right: {
                "Gil": function() {return manager.character.score;}
            }
        });
        
        var infoToggle = gma.instructions(manager.hud,
            "<p>Jump into a pool to load a level! <br/><br/><b>h</b> to toggle this message</br><b>q</b> to return to this level<br/><b>r</b> to restart the level you are on<br/><b>Cursor keys</b> to navigate<br/><b>spacebar</b> to jump</p>",
            72,
            true,
            0
        );
        
        i = 0;
        while (i <= numLevels) {
            gma.keyHandler.register(48 + i, (function(lvl) { 
                return function() {
                    manager.loadLevel(lvl);
                };
            })(i));
            i += 1;
        }
    
        gma.keyHandler.register('d', manager.character.move.curry(gma.constants.RIGHT));
        gma.keyHandler.register(39, manager.character.move.curry(gma.constants.RIGHT));

        gma.keyHandler.register('a', manager.character.move.curry(gma.constants.LEFT));
        gma.keyHandler.register(37, manager.character.move.curry(gma.constants.LEFT));

        //spacebar's keycode is 32
        gma.keyHandler.register(32, manager.character.jump);
        gma.keyHandler.register(38, manager.character.jump);
        
        gma.keyHandler.register(82, function(e) { manager.respawn(); });
        gma.keyHandler.register(81, function(e) { manager.loadLevel(0); infoToggle(e, true);});
    
        /*########################
        ###
        ###   INITIALISE
        ###
        ########################*/
        
        manager.storeLevels([level0]);
        manager.storeLevels(extraLevels);
        manager.init();
        
    }
);


