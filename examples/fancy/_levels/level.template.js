/*global require */
require.def('examples/fancy/_levels/template', 
    [], 
    {
        entities : [
            {left:10, right:-10, top:0, height:10}
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

