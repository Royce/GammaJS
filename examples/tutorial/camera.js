/*global require */
require(['gma/base', 'gma/manager', 'gma/entities/character', 'gma/events', 'gma/entities/enemy'],
    
    function(gma) {
        var manager = gma.manager({
            width : 600,
            height : 500
        });
        manager.character = gma.character({ 
            left     : 0,
            bottom   : 0,
            width    : 3,
            height   : 6,
            depth    : 3
        });
        manager.addCustomDefinitions({
            templates : {
                greencube : ['meshTemplate', {
                    mesh : gma.unitCubeInfo.mesh,
                    material : {color : "#090"}
                }]
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
            spawn : {
                main : [15, 24]
            },
            camera : {
                attached : ['character', 0, 6, 60]
            },            
            entities : [
                {top:0, left:0, width:30, height:3},
                {top:0, left:39, width:30, height:3},
                gma.platformEnemy({bottom:0, left:45, width:3, height:6}),
                gma.patrolEnemy({bottom:0, left:6, width:3, height:6, limitLeft: 3, limitRight:12}),
                {type:'jumpingJack', bottom:0, left:21},
                {type:'jumpingJack', bottom:3, left:24},
                {type:'jumpingJack', bottom:6, left:27}
            ]
        };
        manager.storeLevels(myLevel);

        gma.keyHandler.register(37, manager.character.move.curry(gma.constants.LEFT));
        gma.keyHandler.register(39, manager.character.move.curry(gma.constants.RIGHT));
        gma.keyHandler.register(32, manager.character.jump);
        manager.init();
    }
);
