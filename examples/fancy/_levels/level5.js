/*global require */
require.def('examples/fancy/_levels/level5', 
    [], 
     {      
                
        entities : [                
            {left:5, top:15, width:30, height:3, template:'brickcube'},
            {left:8, bottom:15, type:'jumper'},
            {left:0, bottom:5, width:30, height:3, template:'brickcube'},
            {type:"platform", right:-5, width:20, bottom:10, height:1, template:'whitecube', solid:false},
            {right:-5, width:20, bottom:-20, height:1},
            {type:'door', right:-20, width:1, height:1, bottom:-15, level:2},
            {type:'platformer', left:-10, bottom:10},
            {left:35, width:10, height:3, bottom:5},
            {type:'door', left:55, width:2, height:3, bottom:10, level:0, spawnId:'island4'}
        ],
        
        spawn: {main: [2, 15]},
        background : [
           {
                id : 'skybox',
                config : 'skybox', 
                texture : {
                    src:'/gmamedia/textures/cloud.jpg',
                    repeatX:0.02,
                    repeatY:0.02
                },
                width:500,
                height:500,
                x : 0,
                y : 0,
                z : -50
            }
        ],
        
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
        }
    }
);

