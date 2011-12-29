

.. api:: gma.shapes.rectangle


.. api:: shapes.rectangle



gma.shapes.rectangle
====================


    Represents a rectangle



    ============= =============================================================================================================================================================================================================================================================
    Package       gma/entities/shapes
    Descendants   :api:`gma.collectable`, :api:`gma.scoreCollectable`, :api:`gma.door`, :api:`gma.moveable`, :api:`gma.character`, :api:`gma.enemy`, :api:`gma.platformEnemy`, :api:`gma.jumpingEnemy`, :api:`gma.patrolEnemy`, :api:`gma.platform`, :api:`gma.deathPlatform`
    ============= =============================================================================================================================================================================================================================================================




Tags
----


*shape*





Properties
----------








.. _gma.shapes.rectangle.points:


.. prop:: gma.shapes.rectangle.points


**points**
           
    List of points that makes up the rectangle
        
    +------+---------------+
    | Type | [many [x, y]] |
    +------+---------------+





.. _gma.shapes.rectangle.edges:


.. prop:: gma.shapes.rectangle.edges


**edges**
           
    List of edges that makes up the rectangle
        
    +------+-------------------------+
    | Type | [many [x1, y1, x2, y2]] |
    +------+-------------------------+





.. _gma.shapes.rectangle.width:


.. prop:: gma.shapes.rectangle.width


**width**
           
    The width of the rectangle
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.height:


.. prop:: gma.shapes.rectangle.height


**height**
           
    The height of the rectangle
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.depth:


.. prop:: gma.shapes.rectangle.depth


**depth**
           
    The depth of the rectangle
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.z:


.. prop:: gma.shapes.rectangle.z


**z**
           
    The z co-ordinate of the rectangle's centre
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.x:


.. prop:: gma.shapes.rectangle.x


**x**
           
    The x co-ordinate of the rectangle's centre
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.y:


.. prop:: gma.shapes.rectangle.y


**y**
           
    The y co-ordinate of the rectangle's centre
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.centre:


.. prop:: gma.shapes.rectangle.centre


**centre**
           
    List representing the rectangle's centre
        
    +------+------------------+
    | Type | [self.x, self.y] |
    +------+------------------+





.. _gma.shapes.rectangle.left:


.. prop:: gma.shapes.rectangle.left


**left**
           
    The x co-ordinate of the left of the rectangle
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.right:


.. prop:: gma.shapes.rectangle.right


**right**
           
    The x co-ordinate of the right of the rectangle
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.top:


.. prop:: gma.shapes.rectangle.top


**top**
           
    The y co-ordinate of the top of the rectangle
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.bottom:


.. prop:: gma.shapes.rectangle.bottom


**bottom**
           
    The bottom co-ordinate of the bottom of the rectangle
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.yOffset:


.. prop:: gma.shapes.rectangle.yOffset


**yOffset**
           
    Amount to offset model in y axis when rendering it
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.xOffset:


.. prop:: gma.shapes.rectangle.xOffset


**xOffset**
           
    Amount to offset model in x axis when rendering it
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.shapes.rectangle.type:


.. prop:: gma.shapes.rectangle.type


**type**
           
    Dictionary containing keys for each type the object is
        
    +------+------------+
    | Type | Dictionary |
    +------+------------+





.. _gma.shapes.rectangle.alive:


.. prop:: gma.shapes.rectangle.alive


**alive**
           
    Flag representing the alive/dead status
        
    +---------+---------+
    | Type    | Boolean |
    +---------+---------+
    | Default | true    |
    +---------+---------+





.. _gma.shapes.rectangle.solid:


.. prop:: gma.shapes.rectangle.solid


**solid**
           
    Flag representing the solid-ness
        
    +---------+---------+
    | Type    | Boolean |
    +---------+---------+
    | Default | true    |
    +---------+---------+





.. _gma.shapes.rectangle.tags:


.. prop:: gma.shapes.rectangle.tags


**tags**
           
    | Hash containing tags
    | This should be specified as an array of strings, if at all.
    | Then each string in the list will be set to true in the resulting hash
        
    +---------+-----------------+
    | Type    | Object          |
    +---------+-----------------+
    | Default | {shapes : true} |
    +---------+-----------------+






Methods
-------







.. index:: pair: shapes.rectangle; setPointsAndEdges()

.. _gma.shapes.rectangle.setPointsAndEdges:


.. metho:: gma.shapes.rectangle.setPointsAndEdges


**setPointsAndEdges** ( )
    Function to reset the rectangle's points and edges
    

    







.. index:: pair: shapes.rectangle; setCentre()

.. _gma.shapes.rectangle.setCentre:


.. metho:: gma.shapes.rectangle.setCentre


**setCentre** (centre)
    Function to reset the rectangle's points and edges
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +========================================+========================================+
    | centre                                 | [x, y]                                 |
    +----------------------------------------+----------------------------------------+





.. index:: pair: shapes.rectangle; setBottomLeft()

.. _gma.shapes.rectangle.setBottomLeft:


.. metho:: gma.shapes.rectangle.setBottomLeft


**setBottomLeft** (bl)
    Function to reset the rectangle's points and edges
    

    



    +-------------------------------------------------------------------------------------+
    | Parameters                                                                          |
    +====+========+=======================================================================+
    | bl | [x, y] | Co-ordinates you want to move the bottom left corner of the entity to |
    +----+--------+-----------------------------------------------------------------------+





.. index:: pair: shapes.rectangle; xOf()

.. _gma.shapes.rectangle.xOf:


.. metho:: gma.shapes.rectangle.xOf


**xOf** (side) -> Number
    Determines the x coordinate of the side specified
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +=========+=======================================================================+
    | side    | :constant:`LEFT` or :constant:`RIGHT` or null                         |
    +---------+-----------------------------------------------------------------------+





.. index:: pair: shapes.rectangle; yOf()

.. _gma.shapes.rectangle.yOf:


.. metho:: gma.shapes.rectangle.yOf


**yOf** (side) -> Number
    Determines the y coordinate of the side specified
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +=========+=======================================================================+
    | side    | :constant:`TOP` or :constant:`BOTTOM` or null                         |
    +---------+-----------------------------------------------------------------------+





.. index:: pair: shapes.rectangle; toString()

.. _gma.shapes.rectangle.toString:


.. metho:: gma.shapes.rectangle.toString


**toString** ( ) -> String
    Returns information about rectangle as a string
    

    







.. index:: pair: shapes.rectangle; collided()

.. _gma.shapes.rectangle.collided:


.. metho:: gma.shapes.rectangle.collided


**collided** (where, focus, focusSide, focusVector)
    Hook for when a collision with something occurs
    

    



    +-------------------------------------------------------------------------------------+
    | Parameters                                                                          |
    +=============+=====================+=================================================+
    | where       | :api:`gma.constant` | Side of this object that was collided with      |
    +-------------+---------------------+-------------------------------------------------+
    | focus       | object              | Thing we collided with                          |
    +-------------+---------------------+-------------------------------------------------+
    | focusSide   | :api:`gma.constant` | Side of the focus object that was collided with |
    +-------------+---------------------+-------------------------------------------------+
    | focusVector | [x,y]               | Amount focus is trying to move                  |
    +-------------+---------------------+-------------------------------------------------+





.. index:: pair: shapes.rectangle; collided__deathtouch()

.. _gma.shapes.rectangle.collided__deathtouch:


.. metho:: gma.shapes.rectangle.collided__deathtouch


**collided__deathtouch** (where, focus, focusSide, focusVector)
    Hook for when a collision with something occurs when we have deathtouch
    

    



    +-------------------------------------------------------------------------------------+
    | Parameters                                                                          |
    +=============+=====================+=================================================+
    | where       | :api:`gma.constant` | Side of this object that was collided with      |
    +-------------+---------------------+-------------------------------------------------+
    | focus       | object              | Thing we collided with                          |
    +-------------+---------------------+-------------------------------------------------+
    | focusSide   | :api:`gma.constant` | Side of the focus object that was collided with |
    +-------------+---------------------+-------------------------------------------------+
    | focusVector | [x,y]               | Amount focus is trying to move                  |
    +-------------+---------------------+-------------------------------------------------+





