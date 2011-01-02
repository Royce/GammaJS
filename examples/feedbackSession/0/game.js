require([
    'gma/base',
    'gma/manager',
    'gma/entities/character',
    'gma/events',
    'gma/entities/enemy',
    'gma/entities/door'
    
], function(gma) {
        var manager = gma.manager({
            width : 600,
            height : 500
        });
        
        manager.character = gma.character({
            template:'gorilla',
            left     : 0,
            bottom   : 0,
            width    : 3,
            height   : 6,
            depth    : 2
        });
        
        manager.addCustomDefinitions({
            templates : 
            {
                greencube : ['meshTemplate', {
                    mesh : gma.unitCubeInfo.mesh,
                    material : {color : "#099"}
                }],
                brickscube : ['meshTemplate', {
                    mesh : gma.unitCubeInfo.mesh,
                    material : {
                        texture : 'bricks.jpg',
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
                    
                }]
            }
        });

        var myLevel = {
            
            camera : {
            locZ : 60,
            attached : ['character',0, 6]
            },
            
            light : {
                    myLight : {
                    type : GLGE.L_POINT,
                    rotY : 1.54,
                    color    : "#ffe",
                    attached : ['character', 0,5,20]
                }
            },
            spawn : {
                main : [15, 24]
            },
            entities : [
                
                gma.door({
                 bottom:3, left:65, width:3, height:3,
                 level:1
                 }),
                {template:'brickscube',top:0, left:0, width:30, height:3},
                {template:'greencube', top:0, left:39, width:30, height:3},
                {template:'greencube', top:8, left:0, width:10, height:1},
                gma.platformEnemy({bottom:0, left:45, width:3, height:6}),
                gma.patrolEnemy({bottom:0, left:6, width:3, height:6, limitLeft: 3, limitRight:12}),
                {type:'jumpingJack', bottom:0, left:21},
                {type:'jumpingJack', bottom:3, left:24},
                {type:'jumpingJack', bottom:6, left:27}
            ]
            
        };
        
        var level2 = 
        {
            spawn : {
                main : [1, 1]
            },
            camera : {
                attached : ['character', 0, 6, 60]
            },
            light : {
                myLight : {
                     type : GLGE.L_POINT,
                     rotY : 1.54,
                     color    : "#fff",
                     attached : ['character', 0,5,20]
                }
             },
            entities : [
                gma.door({bottom:0, left:25, width:0.5, height:9, level:0}),
                {template:'brickscube', top:0, left:0, width:30, height:3}
            ]
        }
        manager.storeLevels(myLevel);
        manager.storeLevels(level2);

        gma.keyHandler.register(37, manager.character.move.curry(gma.constants.LEFT));
        gma.keyHandler.register(39, manager.character.move.curry(gma.constants.RIGHT));
        gma.keyHandler.register(32, manager.character.jump);

        manager.init();
    }
);
