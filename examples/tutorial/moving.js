/*global require */
require(['gma/base', 'gma/manager', 'gma/entities/character', 'gma/events'],
    
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
        
        var myLevel = {
            spawn : {
                main : [15, 24]
            },
            entities : [
                {top:0, left:0, width:30, height:3},
                {top:0, left:36, width:30, height:3}
            ]
        };
        manager.storeLevels(myLevel);

        gma.keyHandler.register(37, manager.character.move.curry(gma.constants.LEFT));
        gma.keyHandler.register(39, manager.character.move.curry(gma.constants.RIGHT));
        gma.keyHandler.register(32, manager.character.jump);
        manager.init();
    }
);
