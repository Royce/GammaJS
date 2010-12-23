/*globals require */
require([
        'gma/base', 
        'gma/manager', 
        'gma/entities/character', 
        'gma/events'
    ],
    
    function(gma) {
        var manager = gma.manager({showLoading:false});
        
        manager.character = gma.character({
            bottom:8, 
            left:5, 
            width:3, 
            height:4,
            template : "redcube"
        });
        
        var level1 = {
            spawn : {
                main : [5, 8]
            },
            
            entities : [
                {left:0, bottom:0,  width:20, height:5, depth:1},
                {left:0, bottom:13, width:40, height:5, depth:1}
            ]
        }
        
        manager.hud.setup({
            top_left:  {FPS: manager.getFPS},
            top_right:  {'': "Press 'h' to toggle instructions"}
        });
        
        gma.instructions(manager.hud,
            "There used to be a bug where the character wouldn't stop jumping when it jumped into something.",
            72
        )
    
        gma.keyHandler.register('d', manager.character.move.curry(gma.constants.RIGHT));
        gma.keyHandler.register(39, manager.character.move.curry(gma.constants.RIGHT));

        gma.keyHandler.register('a', manager.character.move.curry(gma.constants.LEFT));
        gma.keyHandler.register(37, manager.character.move.curry(gma.constants.LEFT));

        //spacebar's keycode is 32
        gma.keyHandler.register(32, manager.character.jump);
        
        manager.storeLevels(level1);
        manager.init();
    }
);


