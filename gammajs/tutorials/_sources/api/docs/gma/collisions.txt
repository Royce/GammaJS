

.. api:: gma.collisions


.. api:: collisions



gma.collisions
==============


    Provides collision detection functionality



    ====================== ======================
    Package                gma/utils/collisions
    Already Instantiated   
    ====================== ======================







Properties
----------








.. _gma.collisions.factories:


.. prop:: gma.collisions.factories


**factories**
           
    Provides factories for creating filter functions
        







Methods
-------







.. index:: pair: collisions; factories.findBlockers()

.. _gma.collisions.factories.findBlockers:


.. metho:: gma.collisions.factories.findBlockers


**factories.findBlockers** (focus, vector) -> Function(environ):Boolean
    | Factory for creating a function that filters stuff outside the enclosing box of our focus
    | The enclosing box is the box that encloses the focus where it is now and after it's intended movement
    | This works by saying what isn't outside the enclosing box
    | Outside occurs when one of the following is true
    
    * Top of the obstacle is below the bottom of the focus
    * Left of the obstacle is to the right the right of the focus
    * Right of the obstacle is to the left the left of the focus
    * Bottom of the obstacle is above the top of the focus
    

    



    +-------------------------------------------------------------------------------------------------+
    | Parameters                                                                                      |
    +========+=============================+==========================================================+
    | focus  | :api:`gma.shapes.rectangle` | Object representing the thing we are moving              |
    +--------+-----------------------------+----------------------------------------------------------+
    | vector | [x, y]                      | Vector representing movement horizontally and vertically |
    +--------+-----------------------------+----------------------------------------------------------+





.. index:: pair: collisions; factories.findGround()

.. _gma.collisions.factories.findGround:


.. metho:: gma.collisions.factories.findGround


**factories.findGround** (focus) -> Function(environ):Boolean
    | Factory for creating a function that filters everything that could be ground to our focus
    | Something is ground if it's top is at the same y position of the focus
    | And the object shares horizontal position with the focus
    

    



    +-----------------------------------------------------------------------------------+
    | Parameters                                                                        |
    +=======+=============================+=============================================+
    | focus | :api:`gma.shapes.rectangle` | Object representing the thing we are moving |
    +-------+-----------------------------+---------------------------------------------+





.. index:: pair: collisions; factories.findCollisions()

.. _gma.collisions.factories.findCollisions:


.. metho:: gma.collisions.factories.findCollisions


**factories.findCollisions** (focus, vector) -> Function(environ):[possibleX, possibleY]
    | This factory will create a filter function that determines how far focus can go before it hits a particular object in the environment
    
    | It first creates a closure containing 
    
    * the gradient of the vecotr
    * the sides of the focus facing the direction of the vector
    * the sides of the environ facing the focus
    
    | The filter works by first setting possibleX and possibleY to the vector passed in. The filter will end up either returning these values or new values possibleX and possibleY.
    
    | It will then decide if the direction is straight or diagonal.
    
    | If we're going straight, then we can only go in that direction the minium of the distance between focus and environ or the appropiatepart of the vector.
    
    | If we're going diagonal, then we determine which axis is constrained (horizontal, vertical, both or neither) and move the object accordingly. (how is explained below). Whichever is constrained will move the exact distance between the focus and the environ, whilst the other axis will be determined by the full amount of the vector
    
    | We then call collidedWith and collidedBy on the appropiate objects with the appropiate parameters and return [possibleX, possibleY]
    
    | To determine what to do when going diagonally, we first determine the following
    
    * X and y co-ordinates of the vertical and horizontal axis ofthe environ respectively
    * The equivalent of the focus
    * Where the particular sides chosen is determined by the direction of the vector
    * The horizontal and vertical distance between focus and environ (xd and yd)
    * We then determine whether horizontal or vertical axis are constrained using the following rules per axis
    
      * If the distance is zero
      * , or this axis is already past the respective axis of the environ
    
    * Then we determine whether xd or yd should be negative or positive depending on the direction and gradient of the vector
    * Then we determine a projection of xd and yd on the gradient (i.e. If we moved the character xd or yd, then what the respective amount they'd travel in the other axis according to the gradient). We call these values, yxd and xyd. These values are made absolute astheir polarity doesn't make a difference past this point
    * If at this point, both axis are still constrained, then we see if we can unconstrain one of the axis. We say that for each axis, if the amount projected is less than the distance between between focusand environ, then the other axis isn't constrained, which leaves this axis to still be constrained.
    * We then say that each axis that is constrained can only move the distance between focus and environ and each axis that is not constrained moves the full amount of the vector
    * We also determine if the focus will completely miss the environ. if both or neither axis are constrained, then it doesn't miss.
    * If only one axis is constrained, then we look at the distance between the opposite sides of focus and environ. So say for example focus is moving left, then we look at the distance between focus' left side and environ's right side. If this distance is smaller than the projected distance, then the focus must not be hitting the environ, and we've missed it
    

    



    +-------------------------------------------------------------------------------------------------+
    | Parameters                                                                                      |
    +========+=============================+==========================================================+
    | focus  | :api:`gma.shapes.rectangle` | Object representing the thing we are moving              |
    +--------+-----------------------------+----------------------------------------------------------+
    | vector | [x, y]                      | Vector representing movement horizontally and vertically |
    +--------+-----------------------------+----------------------------------------------------------+





.. index:: pair: collisions; detectCollisions()

.. _gma.collisions.detectCollisions:


.. metho:: gma.collisions.detectCollisions


**detectCollisions** (focus, vector, environment) -> [x, y]
    | Given a focus, it's movement and what's in the environment, this will determine where that focus can go.
    | It will first filter out anything that is outside the enclosing box
    | It will then determine if there are any collisions
    | If there aren't collisions, it will return the original vector
    | If there are no collisions, it will return a vector representing the smallest amount of movement it can do given the collisions
    

    



    +------------------------------------------------------------------------------------------------------------------------------+
    | Parameters                                                                                                                   |
    +=============+====================================+===========================================================================+
    | focus       | :api:`gma.shapes.rectangle`        | Object representing the thing we are moving                               |
    +-------------+------------------------------------+---------------------------------------------------------------------------+
    | vector      | [x, y]                             | Vector representing movement horizontally and vertically                  |
    +-------------+------------------------------------+---------------------------------------------------------------------------+
    | environment | [many :api:`gma.shapes.rectangle`] | List of shapes representing collidable objects in the visible environment |
    +-------------+------------------------------------+---------------------------------------------------------------------------+





