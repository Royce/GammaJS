/*

jingo.declare({
	name: '<class>',
	require:
	[
		<dependencies>
	],
	as: function()
	{
		<class> = function(spec)
		{
			var self = spec || {};
			
///////////////////////////////////////////////////////////////////////////////
	
	var _privateVar = 0;
	
	self.publicFunction = function()
	{
		<do stuff>;
	}
	
	self.publicFunction2 = function()
	{
		<do better stuff>;
	}
	
	self.publicVar = 2;
	
///////////////////////////////////////////////////////////////////////////////

			return self;
		
		}
	}
});

*/
