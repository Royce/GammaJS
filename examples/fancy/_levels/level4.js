/*global require */
require.def('_levels/level4', 
    ['_levels/common'], 
    function(cmn) {
        return function(manager) {
            
            return {      
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
                        width:500,//width,
                        height:500,//height,
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
                },
                
                entities : [                
                    {left:0, bottom:5, width:30, height:3},
                    {left:40, bottom:5, width:30, height:3},
                    {left:45, bottom:28, width:20, height:3},
                    {left:75, bottom:15, width:20, height:3},
                    {left:80, bottom:35, width:45, height:3},
                    {left:130, bottom:30, width:20, height:3},
                    {type: "deathPlatform", left:-50, right:200, top:0, height:40},
                    {type: 'door', bottom:33, left:150, level:0, spawnId:'island4'}
                ]
            };
        };
    }
);

