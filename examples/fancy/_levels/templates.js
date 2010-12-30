/*global require */
require.def('_levels/templates', 
    ['gma/base'], 
    function (gma) { 
        return {
                      
            coin : ['meshTemplate',
                {
                    mesh : gma.unitCubeInfo.mesh,
                    texture : {src:'/gmamedia/textures/coin.png', repeatX:0.25, repeatY:0.25}
                }
            ],
                          
            gorilla : ['colladaTemplate', 
                {
                    collada : {
                        document : '/gmamedia/collada/gorilla/gorilla.dae'
                    },
                    yRot : 1.57,
                    yOffset : -0.5,
                    yScale : 0.7
                }
            ],
            
            brickcube : ['meshTemplate',
                {
                    mesh : gma.unitCubeInfo.mesh,
                    texture : {src:'/gmamedia/textures/bricks.jpg', repeatX:0.5, repeatY:0.5}
                }
            ],
            
            rockcube : ['meshTemplate',
                {
                    mesh : gma.unitCubeInfo.mesh,
                    texture : {src:'/gmamedia/textures/dirt.jpg', repeatX:0.5, repeatY:0.5}
                }
            ],
            
            redcube : ['meshTemplate',
                {
                    mesh : gma.unitCubeInfo.mesh,
                    texture : {src:'/gmamedia/textures/shinyLava.jpg', repeatX:0.05, repeatY:0.05}
                }
            ],
            
            whitecube : ['meshTemplate',
                {
                    mesh : gma.unitCubeInfo.mesh,
                    material : {texture : '/gmamedia/textures/cloud.jpg'}
                }
            ],
            
            greencube : ['meshTemplate',
                {
                    mesh : gma.unitCubeInfo.mesh,
                    texture : {src:'/gmamedia/textures/cloud.jpg', repeatX:0.2, repeatY:0.2}
                }
            
            ]
        };
    }
);
