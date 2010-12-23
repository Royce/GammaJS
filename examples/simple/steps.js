/*globals require */
require([
        'gma/base', 
        'gma/manager', 
        'gma/events',
        'gma/entities/character'
    ],
    
    function(gma) {
        var manager = gma.manager({showLoading:false});
        manager.character = gma.character({
            bottom:10, 
            left:0, 
            width:1, 
            height:1, 
            xState:gma.constants.RIGHT,
            template : "redcube"
        });
        
        manager.hud.setup({
            top_left:  {FPS: manager.getFPS},
            top_right:  {'': "Press 'h' to toggle instructions"}
        });
        
        gma.instructions(manager.hud,
            "Press 'r' to restart the character. Watch as he falls down the steps.",
            72
        )
        
        gma.keyHandler.register(82, function(e) { manager.respawn(); });
        
        manager.storeLevels({
            spawn : {
                main : [0, 10]
            },
            
            entities : [
                {left:0,  bottom:8, width:5, height:1, depth:1},
                {left:6,  bottom:6, width:2, height:1, depth:1},
                {left:9,  bottom:4, width:3, height:1, depth:1},
                {left:14, bottom:3, width:2, height:1, depth:1},
                {left:18, bottom:0, width:1, height:5, depth:1}
            ]
        });
        manager.init();
    }
);


