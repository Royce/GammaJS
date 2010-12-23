/*global require, GLGE */
require([
        'gma/base',
        'gma/manager',
        'gma/entities/character',
        'gma/entities/enemy',
        'gma/entities/collectable',
        'gma/utils/render',
        'gma/events',
        'gma/utils/parser',
        'gma/entities/door',
        'gma/utils/hud'
    ],
    
    function(gma) {
        var manager = gma.manager();
        
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
        
        manager.addCustomDefinitions({
            templates : {
                gorilla : ['colladaTemplate', 
                    {
                        collada : {
                            document : '/gmamedia/collada/gorilla/gorilla.dae'
                        },
                        yRot : 1.57,
                        yOffset : -0.5,
                        yScale : 0.7
                    }
                ],
                
                redcube : ['meshTemplate',
                    {
                        mesh : gma.unitCubeInfo.mesh,
                        material : {color : "#900"}
                    }
                ],
                
                whitecube : ['meshTemplate',
                    {
                        mesh : gma.unitCubeInfo.mesh,
                        material : {texture : '/gmamedia/textures/cloud.jpg'}
                    }
                ],
                
                greencube : ['meshTemplate',
                    {
                        mesh : gma.unitCubeInfo.mesh,
                        material : {color : "#0F0"}
                    }
                ]
            },
            
            types : {
                platform : ['platform', {template : 'cube'}],
                
                redPlatform : ['platform', {template : 'redcube'}],
                
                deathPlatform : ['deathPlatform', {template : 'cube'}],
                
                door : ['door', {
                    width    : 4,
                    depth    : 4,
                    height   : 4,
                    template : 'cube'
                }],
                
                patroller : ['patrolEnemy', {
                    width:4,
                    depth: 4,
                    height:7.5,
                    limitLeft:20,
                    limitRight:40,
                    lastXState:gma.constants.RIGHT,
                    template : 'gorilla'
                }],
                    
                platformer : ['platformEnemy', {
                    width:4,
                    depth: 4,
                    height:7.5,
                    lastXState:gma.constants.RIGHT,
                    template : 'gorilla'
                }],
                    
                jumper : ['jumpingEnemy', {
                    width: 4,
                    depth: 4,
                    height:7.5,
                    lastXState:gma.constants.RIGHT,
                    template : 'gorilla'
                }],
                    
                collectable : ['scoreCollectable', {
                    width:4,
                    depth: 4,
                    height:7.5,
                    template : 'gorilla'
                }]
            }
        });
        
        /*########################
        ###
        ###   DEFINE LEVEL ONE
        ###
        ########################*/
        
        var width = 100;
        var height = 100;
        var thickness = 10;
        
        var level1 = {
            
            camera : { 
                locZ : 50,
                attached : ['character']
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
                {type: 'patroller', bottom:0, left:33},
                {type: 'platformer', bottom:25, left:35, tags:['reincarnate']},
                {type: 'jumper', bottom:43, left:45},
                {type: 'collectable', bottom:0, left:8},
                {type: 'door', bottom:0, left:50, level:1, template:"greencube"},
                
                {type: 'platform', depth:20, replicateWith : [
                    {left:-10, bottom:-10, width:thickness, height:height},
                    {left:-10, bottom:-10, width:width,     height:thickness},
                    {left:width-10, bottom:-10, width:thickness, height:height+thickness},
                    {left:-10, bottom:height-10, width:width, height:thickness},

                    {left:10, width:20, bottom:10, height:5},
                    {left:35, width:20, bottom:15, height:7},
                    {left:60, width:20, bottom:26, height:5},
                    {left:42, width:10, bottom:40, height:5},
                    {left:60, width:5, bottom:55, height:5},
                    {left:70, width:5, bottom:60, height:5, solid:false, template:"whitecube"},
                    {left:55, width:5, bottom:70, height:5},
                    {left:50, width:5, bottom:75, height:5},
                    {right:45, width:35, bottom:75, height:5, type: 'deathPlatform', template:"redcube"}
                ]}
                
            ]
        };
        
        /*########################
        ###
        ###   DEFINE LEVEL TWO
        ###
        ########################*/
        
        var level2 = {
                    
            camera : { 
                locZ : 50,
                attached : ['character']
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
                {type: 'door', bottom:0, left:50, level:0},
                {type: 'redPlatform', depth:20, replicateWith : [
                    {left:-10, bottom:-10, width:thickness, height:height},
                    {left:-10, bottom:-10, width:width,     height:thickness},
                    {left:width-10, bottom:-10, width:thickness, height:height+thickness},
                    {left:-10, bottom:height-10, width:width, height:thickness}
                ]}
                
            ]
        };
        
        manager.hud.setup({
            top_left:  {Lives: function() {return Math.ceil(Math.random()*9);}},
            top_right: {Stars: function() {return Math.ceil(Math.random()*9);}}
        });
        
        setTimeout(function() {
            manager.hud.displayMessage("Watch out, its jumping time!", 1000, function() {
                manager.character.jump();
            });
        }, 9000);
        
        var hudToggle = function() {
            var state = true;
            return function(e) {
                if (e.type==="keydown") {
                    if (state) {
                        manager.hud.hide();
                    }
                    else {
                        manager.hud.show();
                    }
                    state = !state;
                }
            };
        }();
        gma.keyHandler.register(72, hudToggle);
        
        gma.keyHandler.register('d', manager.character.move.curry(gma.constants.RIGHT));
        gma.keyHandler.register(39, manager.character.move.curry(gma.constants.RIGHT));

        gma.keyHandler.register('a', manager.character.move.curry(gma.constants.LEFT));
        gma.keyHandler.register(37, manager.character.move.curry(gma.constants.LEFT));

        //spacebar's keycode is 32
        gma.keyHandler.register(32, manager.character.jump);
        gma.keyHandler.register(38, manager.character.jump);
        
        gma.keyHandler.register(82, function(e) { manager.respawn(); });
        
        /*########################
        ###
        ###   INITIALISE
        ###
        ########################*/
        
        manager.storeLevels([level1, level2]);
        manager.init();
    }
);


