

.. api:: gma.hud


.. api:: hud



gma.hud
=======


    Provides HUD functionality



    ========= ===============
    Package   gma/utils/hud
    ========= ===============









Methods
-------







.. index:: pair: hud; setup()

.. _gma.hud.setup:


.. metho:: gma.hud.setup


**setup** (spec)
    | Creates the necessary HTML elements that form the hud
    | It will also store this on self and inside positions
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +========+===========+=============================================================+
    | spec   | Object    | Specifies what displays where on the HUD                    |
    +--------+-----------+-------------------------------------------------------------+





.. index:: pair: hud; createSection()

.. _gma.hud.createSection:


.. metho:: gma.hud.createSection


**createSection** (divID, dlClass) -> The created/found dl element
    | Return a dl element inside a div element
    | Both of these elements are created if they don't already exist
    | The div element will have a particular id
    | The dl element will have a particular class
    | Both id/class are found with (and created on) using those passed into the function
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +===============+=============+====================================================+
    | divID         | String      | The id of the div element                          |
    +---------------+-------------+----------------------------------------------------+
    | dlClass       | String      | The class of the dl element                        |
    +---------------+-------------+----------------------------------------------------+





.. index:: pair: hud; fillSection()

.. _gma.hud.fillSection:


.. metho:: gma.hud.fillSection


**fillSection** ($container, items)
    | Fills some element (suggested to be a dl) with dt and dd elements
    | It will prepend each element's label with "hud\_" and convert to lowercase to form the id for each dt
    | And insert the lable inside a span element inside the dt
    | It will then use the the value for the label as the value for the dd,
    | or if the value is a function, then using the result of calling that function as the value inside the dd
    | This function will then register this function to this particular dt for updating at a later stage
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +============+==============+======================================================+
    | $container | HTML Element | The container to add the dt and dd elements to       |
    +------------+--------------+------------------------------------------------------+
    | items      | Dictionary   | Dictionary of label:value to put into the $container |
    +------------+--------------+------------------------------------------------------+





.. index:: pair: hud; reset()

.. _gma.hud.reset:


.. metho:: gma.hud.reset


**reset** ( )
    Ensures the canvasContainer is empty
    

    







.. index:: pair: hud; refresh()

.. _gma.hud.refresh:


.. metho:: gma.hud.refresh


**refresh** ( )
    Fills out HUD information using the functions provided to setup
    

    







.. index:: pair: hud; hide()

.. _gma.hud.hide:


.. metho:: gma.hud.hide


**hide** (position)
    | Hides the HTML elements that makes up the HUD
    | Optionally, you can hide just a particular part of the HUD
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +============+==========+==========================================================+
    | position   | String   | Particular part of the HUD you want to hide              |
    +------------+----------+----------------------------------------------------------+





.. index:: pair: hud; show()

.. _gma.hud.show:


.. metho:: gma.hud.show


**show** (position)
    | Shows the HTML elements that makes up the HUD
    | Optionally, you can show just a particular part of the HUD
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +============+==========+==========================================================+
    | position   | String   | Particular part of the HUD you want to show              |
    +------------+----------+----------------------------------------------------------+





.. index:: pair: hud; displayMessage()

.. _gma.hud.displayMessage:


.. metho:: gma.hud.displayMessage


**displayMessage** (msg, wait, callBack)
    | Hides the HTML elements that makes up the HUD
    | Optionally, you can hide just a particular part of the HUD
    | It will use a div with id of "message" to display the message in
    

    



    +--------------------------------------------------------------------------------------------------------------+
    | Parameters                                                                                                   |
    +==========+==========+========================================================================================+
    | msg      | String   | The message to display                                                                 |
    +----------+----------+----------------------------------------------------------------------------------------+
    | wait     | Number   | The amount to wait before automatically hiding the message                             |
    +----------+----------+----------------------------------------------------------------------------------------+
    | callBack | Function | Optional function that is executed either immediately or when the timeout has finished |
    +----------+----------+----------------------------------------------------------------------------------------+





.. index:: pair: hud; hideMessage()

.. _gma.hud.hideMessage:


.. metho:: gma.hud.hideMessage


**hideMessage** ( )
    Hides the message div (div with id "message")
    

    







