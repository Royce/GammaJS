/*global require */
require.def('examples/fancy/_levels/level2', 
    ['examples/fancy/_levels/common'], 
    function(cmn) {
        return function(manager) {
            return {  
                background : [
                    {
                        id : 'skybox2',
                        config : 'skybox', 
                        texture : {
                            src:'/gmamedia/textures/cloud_mosaic.jpg',
                            repeatX:0.03,
                            repeatY:0.03
                        },
                        width:cmn.width,
                        height:cmn.height,
                        x : 50,
                        y : 50,
                        z : -cmn.thickness
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
                
                spawn : {
                    main : [2, 25]
                },
                
                entities : [
                    {type: 'patroller', bottom:0, left:2, limitLeft:0, limitRight:25},
                    {type: 'platformer', bottom:25, left:35, tags:['reincarnate']},
                    {type: 'jumper', bottom:43, left:45},
                    {type: 'collectable', bottom:5, left:8, getRotation : cmn.rotateContinously()},
                    {type: 'collectable', bottom:15, left:15, getRotation : cmn.rotateContinously()},
                    {type: 'collectable', bottom:85, left:20, getRotation : cmn.rotateContinously()},
                    
                    {type: 'platform', depth:20, replicateWith : [
                        {left:-10, bottom:-10, width:cmn.thickness, height:cmn.height},
                        {left:-10, bottom:-10, width:cmn.width,     height:cmn.thickness},
                        {left:cmn.width-10, bottom:-10, width:cmn.thickness, height:cmn.height+cmn.thickness},
                        {left:-10, bottom:cmn.height-10, width:cmn.width, height:cmn.thickness},

                        {left:0, width:20, bottom:10, height:5},
                        {left:35, width:20, bottom:15, height:7},
                        {left:60, width:20, bottom:26, height:5},
                        {left:42, width:10, bottom:40, height:5},
                        {left:60, width:5, bottom:55, height:5},
                        {left:70, width:5, bottom:60, height:5, solid:false, template:"whitecube"},
                        {left:55, width:5, bottom:70, height:5},
                        {left:50, width:5, bottom:75, height:5},
                        {left:0, right:45, bottom:75, height:5},
                        {left:0, width:0.1, bottom:81, height:8, depth:6, type:'door', template: "greencube", level:0, spawnId:'island2'}
                    ]}
                    
                ]
            };
        };
    }
);
