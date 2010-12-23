/*global require */
require.def('examples/fancy/_levels/common', 
    [], 
    {
        width : 100,
        depth : 100,
        height : 100, 
        thickness : 10,
        
        rotateContinously : function () {
            var angle = 0;
            return function() {
                if (angle > 3.14) {
                    angle = angle - 3.14;
                }
                angle += 0.2;
                return angle;
            }
        }
    }
);
