/*global require */
require.def('_levels/level1', 
    ['_levels/common'], 
    function(cmn) {
        return function(manager) {
            return {
                background : [
                    {
                        id : 'skybox',
                        config : 'skybox', 
                        texture : {
                            src:'/gmamedia/textures/cloud.jpg',
                            repeatX:0.03,
                            repeatY:0.03
                        },
                        attached : ['character'],
                        width:manager.width,
                        height:manager.height
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
                    {type: 'patroller', bottom:0, left:33},
                    {type: 'platformer', bottom:25, left:35, tags:['reincarnate']},
                    {type: 'jumper', bottom:45, left:45},
                    {type: 'collectable', bottom:0, left:8, getRotation:cmn.rotateContinously()},
                    {type: 'door', bottom:0, left:50, level:0, spawnId:'island1', template:"greencube"},
                    
                    {type: 'platform', depth:20, replicateWith : [
                        {left:-10, bottom:-10, width:cmn.thickness, height:cmn.height},
                        {left:-10, bottom:-10, width:cmn.width,     height:cmn.thickness},
                        {left:cmn.width-10, bottom:-10, width:cmn.thickness, height:cmn.height+cmn.thickness},
                        {left:-10, bottom:cmn.height-10, width:cmn.width, height:cmn.thickness},

                        {left:10, width:20, bottom:10, height:5},
                        {left:35, width:20, bottom:15, height:7},
                        {left:60, width:20, bottom:26, height:5},
                        {left:42, width:10, bottom:40, height:5},
                        {left:60, width:5, bottom:55, height:5},
                        {left:70, width:5, bottom:60, height:5, solid:false, template:"whitecube"},
                        {left:55, width:5, bottom:70, height:5},
                        {left:50, width:5, bottom:75, height:5},
                        {right:45, width:35, bottom:75, height:5, type: 'deathPlatform', template:"redcube"}
                    ]}
                    
                ]
            };
        };
    }
);
