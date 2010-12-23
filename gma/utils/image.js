/*global require, Canvas2Image, $ */
require.def('gma/utils/image',
    ['gma/base', 'gma/utils/base', 'gma/support/canvas2image'],
    function(gma) {
    
        /**@for gma */

///////////////////////////////////////////////////////////////////////////////

    /**
     * Creates a png image of the canvas
     * @method makeImage
     * @param manager {:api:`gma.manager`}
     * @param width {Number} Width of the png
     * @param height {Number} Height of the png
     * @return {Base64-PNG}
    */
    gma.makeImage = function(manager, width, height) {
        var canvas = manager.canvas;
        return Canvas2Image.saveAsPNG(canvas, true, width, height);
    };
    
    /**
     * Asks the server to check an image against one it already has
     * @method checkImage
     * @param png {Base64-PNG} Png to check
     * @param checkAgainst {string} Location of image to check
     * @return {Result from the server}
    */
    gma.checkImage = function(png, checkAgainst) {
        eval("var result = " + $.ajax({
            url:'/check/image',
            async:false,
            data:{checkAgainst:checkAgainst, png:png.src}
        }).responseText);
        return result;
    };

///////////////////////////////////////////////////////////////////////////////

    }
);
