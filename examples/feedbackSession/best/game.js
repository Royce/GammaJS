require([
    'gma/base',
    'gma/manager',
    'gma/entities/character',
    'gma/events',
    'gma/entities/enemy',
    'gma/entities/door'
], function(gma) {
        var manager = gma.manager({
            width : 800,
            height : 500
        });
        manager.character = gma.character({
            left     : 0,
            bottom   : 0,
            width    : 3,
            height   : 6,
            depth    : 3,
            template : 'gorilla'
        });
        manager.hud.setup({
            top_left: {
                "Score": function() {
                    return manager.character.score;
                }
            },
            bottom_right: {
                fps : manager.getFPS
            }
        });
        manager.addCustomDefinitions({
            templates : {
                greencube : ['meshTemplate', {
                    mesh : gma.unitCubeInfo.mesh,
                    material : {color : "#090"}
                }],
                brickscube : ['meshTemplate', {
                    mesh : gma.unitCubeInfo.mesh,
                    texture : {
                        src : 'dirt.jpg',
                        repeatX : 0.5,
                        repeatY : 0.5
                    }
                }],
                gorilla : ['colladaTemplate',
                    {
                        collada : {
                            document : '/gmamedia/collada/gorilla/gorilla.dae'
                        },
                        yRot : 1.57,
                        yOffset : -0.5,
                        yScale : 0.7
                    }
                ]                                
            },
            types : {
                jumpingJack: ['jumpingEnemy', {
                    width    : 1,
                    height   : 2,
                    template : 'greencube'
                }],
                lava : ['deathPlatform', {
                        //mesh : gma.unitCubeInfo.mesh,
                        template : 'redcube',
                        depth:20,
                        texture : {
                            src : 'dirt.jpg',
                            repeatX : 0.5,
                            repeatY : 0.5
                        }
                    }
                ]
            }
        });
        
        var template = manager.determineObject.apply(this, manager.levelParser.templates.redcube);
        var enemy = ['character', {
                width    : 1,
                height   : 2,
                bottom:6, 
                left:29
            }
        ];
        enemy = manager.determineObject.apply(this, enemy);
        enemy = manager.prepareEntity(enemy, template);
        
        var myLevel = {
            spawn : {
                main : [15, 24]
            },
             camera : {
                locY : 20,
                rotX: -0.2,
                locZ : 100//,
                //attached : ['character',0, 6]
            },
            light : {
                myLight1 : {
                    type : GLGE.L_POINT,
                    rotY : 1.54,
                    locY: 10,
                    color    : "#fff"//,
                    //attached : ['character', 0,5,0]
                },
                myLight2 : {
                    type : GLGE.L_POINT,
                    rotY : 1.54,
                    color    : "#0ff",
                    attached : ['character', 20,15,0]
                },
                myLight3 : {
                    type : GLGE.L_POINT,
                    rotY : 1.54,
                    color    : "#00f",
                    attached : ['character', -20,15,10]
                },
                myLight4 : {
                    type : GLGE.L_POINT,
                    rotY : 14.54,
                    color    : "#f00",
                    attached : ['character', 0,-5,10]
                }
            },            
            entities : [
                {template:'brickscube', top:0, left:0, width:30, height:3, depth:50},
                {template:'brickscube', top:0, left:39, width:30, height:3, depth:30},            
                {top:-10, left:-55, width:60, height:1, depth:20},
                {top:10, left:-39, width:30, height:3},
                {type:'lava', top:-20, left:-50, width:100, height:50, depth:50},
                gma.platformEnemy({bottom:20, left:-45, width:3, height:6, depth:20}),
                gma.platformEnemy({bottom:0, left:45, width:3, height:6, depth:10}),
                gma.patrolEnemy({bottom:0, left:6, width:3, height:6, limitLeft: 3, limitRight:12}),
                {type:'jumpingJack', bottom:10, left:-21},
                {type:'jumpingJack', bottom:3, left:24},
                {type:'jumpingJack', bottom:6, left:-27},
                enemy,
                gma.door({
                    bottom:-10, left:-15, width:3, height:3,
                    level:1
                })
            ]
        };
        manager.storeLevels([myLevel, myLevel, myLevel]);

        gma.keyHandler.register(37, manager.character.move.curry(gma.constants.LEFT));
        gma.keyHandler.register(39, manager.character.move.curry(gma.constants.RIGHT));
        gma.keyHandler.register(32, manager.character.jump);
        gma.keyHandler.register(37, enemy.move.curry(gma.constants.LEFT));
        gma.keyHandler.register(32, enemy.jump);
        gma.keyHandler.register(82, function(e) { manager.respawn("main"); });
        
        manager.init();
    }
);



