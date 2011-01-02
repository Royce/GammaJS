/*global require */
require.def('_levels/level6', 
    ['_levels/common'], 
     function(cmn) { return {
                
        entities : [                
            {left:0, bottom:5, width:30, height:3, template:'brickcube'},
            {left:35, bottom:0, width:45, height:8, template:'whitecube'},
            {left:14, bottom:18, width:1, height:4, template:'brickcube'},
            {left:18, bottom:23, width:6, height:2, template:'brickcube'},
            {left:38, bottom:27, width:23, height: 2, template:'whitecube'},
            {left:14,bottom:35, width:5, height:4, type: 'collectable', getRotation:cmn.rotateContinously() }
            
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
    }}
);

