/*global require */
require.def('_levels/types', 
    ['gma/base'], 
    function (gma) {
        return {
            platform : ['platform', {template : 'rockcube'}],
            
            redPlatform : ['platform', {template : 'redcube'}],
            
            deathPlatform : ['deathPlatform', {template : 'redcube'}],
            
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
                width:4,
                depth: 4,
                height:7.5,
                lastXState:gma.constants.RIGHT,
                template : 'gorilla'
            }],
                
            collectable : ['scoreCollectable', {
                width:4,
                depth: 1,
                height:4,
                template : 'coin'
            }]
        };
    }
);
