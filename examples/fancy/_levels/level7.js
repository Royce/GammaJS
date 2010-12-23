/*global require */
require.def('examples/fancy/_levels/level7', 
    [], 
     {      
                
        entities : [                
            {left:0, bottom:5, width:30, height:3, template:'brickcube'},
            {left:35, width:50, height:1, bottom:15},
            {right:-5, width:50, height:1, bottom:15, template:'redcube'},
            { width:5, height:5, type:'jumper', replicateWith : [
                {right:-10, bottom:15},
                {right:-15, bottom:20},
                {right:-25, bottom:25},
                {right:-20, width:10, bottom:50}
            ]},
            {left:35, width:2, height:5, bottom:15, type:'platformer'}
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

