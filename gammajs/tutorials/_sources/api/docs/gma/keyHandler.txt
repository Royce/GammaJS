

.. api:: gma.keyHandler


.. api:: keyHandler



gma.keyHandler
==============


    Provides key event handling



    ====================== ============
    Package                gma/events
    Already Instantiated   
    ====================== ============







Properties
----------








.. _gma.keyHandler.handlers:


.. prop:: gma.keyHandler.handlers


**handlers**
           
    | Provides a dictionary of keycode : array
    | The array holds functions which are called when the corresponding keycode is triggered
        
    +------+------------+
    | Type | Dictionary |
    +------+------------+






Methods
-------







.. index:: pair: keyHandler; keyCheck()

.. _gma.keyHandler.keyCheck:


.. metho:: gma.keyHandler.keyCheck


**keyCheck** (e)
    Determines what functions should be called when a keypress event is triggered
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +=====+============+===============================================================+
    | e   | Event      | The event that has been triggered                             |
    +-----+------------+---------------------------------------------------------------+





.. index:: pair: keyHandler; register()

.. _gma.keyHandler.register:


.. metho:: gma.keyHandler.register


**register** (keyCode, func)
    Allows you to register a function to a keyCode
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +==========+=======================+===============================================+
    | keyCode  | Number or Character   | The keycode that triggers this function       |
    +----------+-----------------------+-----------------------------------------------+
    | func     | Function              | Function to call when we have this event      |
    +----------+-----------------------+-----------------------------------------------+





.. index:: pair: keyHandler; numEvents()

.. _gma.keyHandler.numEvents:


.. metho:: gma.keyHandler.numEvents


**numEvents** (keyCode)
    | Tells you how many functions you have registered for provided keyCode
    | If no keycode is given, then it tells you total functions you have registered
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +===========+==========================+===========================================+
    | keyCode   | Number or Character      | The keycode you want to inspect           |
    +-----------+--------------------------+-------------------------------------------+





.. index:: pair: keyHandler; reset()

.. _gma.keyHandler.reset:


.. metho:: gma.keyHandler.reset


**reset** ( )
    Unregisters everything
    

    







