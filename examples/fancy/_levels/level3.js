/*global require */
require.def('examples/fancy/_levels/level3', 
    ['examples/fancy/_levels/common'], 
    function(cmn) {
        return function(manager) {
            
            return {
                
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
                    {type: 'door', bottom:0, left:50, level:0, spawnId:'island3'},
                    {type: 'redPlatform', depth:20, replicateWith : [
                        {left:-10, bottom:-10, width:cmn.thickness, height:cmn.height},
                        {left:-10, bottom:-10, width:cmn.width,     height:cmn.thickness},
                        {left:cmn.width-10, bottom:-10, width:cmn.thickness, height:cmn.height+cmn.thickness},
                        {left:-10, bottom:cmn.height-10, width:cmn.width, height:cmn.thickness}
                    ]}
                    
                ]
            };
        };
    }
);
