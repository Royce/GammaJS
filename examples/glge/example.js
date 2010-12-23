var canvas = document.getElementById( 'canvas' );
var renderer = new GLGE.Renderer( canvas );

var XMLdoc = new GLGE.Document();

XMLdoc.onLoad = function(){
	var scene = XMLdoc.getElement( "mainscene" );
	renderer.setScene( scene );
	renderer.render();
	
	
	/** WHAT JAMES MUST DO 
		Create an object that matches 
		<object frame_rate="60" mesh="#SphereLevel4" material="#moon1" loc_y="0" scale="2" loc_x="0" animation="#spin" />
	
	    var object = new GLGE.Object();
	    
	    object.setMesh(XMLdoc.getElement( "SphereLevel4" ));
	    object.setMaterial(XMLdoc.getElement( "moon1" ));
	    object.setAnimation(XMLdoc.getElement( "spin" ));
		scene.addChild(object);	
		
	**/

	meshInfo = {
		positions : [ 0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , 0.5 , -0.5 , 0.5,  0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , -0.5 , 0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , 0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , -0.5 , 0.5 , 0.5],

		normals : [0 , 0 , -0.5 , 0 , 0 , -0.5 , 0 , 0 , -0.5 , 0 , 0 , -0.5 , 0 , -0 , 0.5 , 0 , -0 , 0.5 , 0 , -0 , 0.5 , 0 , -0 , 0.5 , 0.5 , -0 , 0 , 0.5 , -0 , 0 , 0.5 , -0 , 0 , 0.5 , -0 , 0 , -0 , -0.5 , -0 , -0 , -0.5 , -0 , -0 , -0.5 , -0 , -0 , -0.5 , -0 , -0.5 , 0 , -0 , -0.5 , 0 , -0 , -0.5 , 0 , -0 , -0.5 , 0 , -0 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0 , 0.5 , 0],

		UV : [0 , 0 , 1.0 , 0 , 1.0 , 1.0 , 0 , 1.0 , 0 , 0 , 1.0 , 0 , 1.0 , 1.0 , 0 , 1.0 , 0 , 0 , 1.0 , 0 , 1.0 , 1.0 , 0 , 1.0 , 0 , 0 , 1.0 , 0 , 1.0 , 1.0 , 0 , 1.0 , 0 , 0 , 1.0 , 0 , 1.0 , 1.0 , 0 , 1.0 , 0 , 0 , 1.0 , 0 , 1.0 , 1.0 , 0 , 1.0],

		faces : [0 , 1 , 2 , 0 , 2 , 3 , 4 , 5 , 6 , 4 , 6 , 7 , 8 , 9 , 10 , 8 , 10 , 11 , 12 , 13 , 14 , 12 , 14 , 15 , 16 , 17 , 18 , 16 , 18 , 19 , 20 , 21 , 22 , 20 , 22 , 23]
	}

	var mesh = new GLGE.Mesh();
	mesh.setPositions(meshInfo.positions);
	mesh.setFaces(meshInfo.faces);
	mesh.setUV(meshInfo.UV);
	mesh.setNormals(meshInfo.normals);
	
    var object = new GLGE.Object(); 
    object.setLocX(1);
    object.setLocY(0);
    object.setScaleX(3.0);
    object.setFrameRate(60);
	var material = new GLGE.Material("moon1");	 
	var texture = new GLGE.Texture("Material01"); 
	var materialLayer = new GLGE.MaterialLayer("Layer01");
	       
	object.setMesh(mesh);	

	texture.setSrc("/examples/glge/smiley.jpg");
	
	materialLayer.setMapinput(GLGE.UV1);
	materialLayer.setMapto(GLGE.M_COLOR);
	materialLayer.setTexture(texture);
	materialLayer.setDScaleX(2);
	materialLayer.setDScaleY(2);

	material.setSpecular(1);		
	material.addTexture(texture);
	material.addMaterialLayer(materialLayer);
	
    object.setMaterial(material);
    
    object.setAnimation(XMLdoc.getElement( "spin" ));
	scene.addChild(object);
	
	/**
	Now we simply set up a render loop for our scene
	**/
	setInterval(function(){
		renderer.render();
	},15);
};
/**
Finally we need to specify the xml we wish the document parser to use. This can be either a external XML file or alternativly
a string which can be embended into the main page as in this case.
**/
XMLdoc.parseScript("glge_document");
