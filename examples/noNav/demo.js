require([
        'gma/base', 
        'gma/manager', 
        'gma/entities/character', 
        'gma/events',
        'gma/utils/render'
    ],
    
    function(gma) {
        var manager = gma.manager({
            height : 700,
            width : 900
        });
        
        manager.character = gma.character(
            { bottom:0
            , left:0
            , width:1
            , height:1
            , lastXState:gma.constants.RIGHT
            , template : "redcube"
            }
        );
        
        var width     = 100;
        var height    = 120;
        var thickness = 10;
        
        var level1 = {            
            entities : [
                {depth : 20, replicateWith : [
                    {left:-10, bottom:-10, width:thickness, height:height},
                    {left:-10, bottom:-10, width:width,     height:thickness},
                    {left:width-10, bottom:-10, width:thickness, height:height+thickness},
                    {left:-10, bottom:height-10, width:width, height:thickness},
                    
                    {left:10, width:20, bottom:10, height:5},
                    {left:35, width:16, bottom:15, height:7},
                    {left:60, width:20, bottom:26, height:5},
                    {left:35, width:16, bottom:40, height:5},
                    {left:60, width:5, bottom:55, height:5},
                    {left:55, width:5, bottom:70, height:5},
                    {left:50, width:5, bottom:75, height:5},
                    {right:45, width:35, bottom:75, height:5}
                ]}
            ]
        };
    
        gma.keyHandler.register('d', manager.character.move.curry(gma.constants.RIGHT));
        gma.keyHandler.register(39, manager.character.move.curry(gma.constants.RIGHT));

        gma.keyHandler.register('a', manager.character.move.curry(gma.constants.LEFT));
        gma.keyHandler.register(37, manager.character.move.curry(gma.constants.LEFT));

        //spacebar's keycode is 32
        gma.keyHandler.register(32, manager.character.jump);
        gma.keyHandler.register(38, manager.character.jump);
        
        manager.storeLevels(level1);
        manager.init();
        
    }
);


