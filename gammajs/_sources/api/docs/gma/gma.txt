

.. api:: gma




gma
===


    The gma namespace holds everything











Properties
----------








.. _gma.gma.logger:


.. prop:: gma.gma.logger


**logger**
           
    | Object for logging stuff to
    | We use this so that we don't get errors when there is no console
        
    +---------+---------+
    | Default | console |
    +---------+---------+





.. _gma.gma.unitCubeInfo:


.. prop:: gma.gma.unitCubeInfo


**unitCubeInfo**
           
    Info used to create Unit cube template
        
    +---------+------------------+
    | Type    | Object           |
    +---------+------------------+
    | Package | gma/utils/render |
    +---------+------------------+





.. _gma.gma.unitCube:


.. prop:: gma.gma.unitCube


**unitCube**
           
    An instantiated meshTemplate using unitCubeInfo
        
    +---------+-------------------------+
    | Type    | :api:`gma.meshTemplate` |
    +---------+-------------------------+
    | Package | gma/utils/render        |
    +---------+-------------------------+






Methods
-------







.. index:: pair: gma; insertScript()

.. _gma.gma.insertScript:


.. metho:: gma.gma.insertScript


**insertScript** (string)
    Inserts a javascript script tag into the document with the specified text
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +===========+===========+==========================================================+
    | string    | String    | text to put inside the new script tag                    |
    +-----------+-----------+----------------------------------------------------------+





.. index:: pair: gma; test()

.. _gma.gma.test:


.. metho:: gma.gma.test


**test** (location, jingoName)
    Inserts a javascript tag containing a preprocessed test
    

    



    +---------------------------------------------------------------------------------------------+
    | Parameters                                                                                  |
    +===========+========+========================================================================+
    | location  | String | Location of the test to run                                            |
    +-----------+--------+------------------------------------------------------------------------+
    | jingoName | String | Name to use in the jingo.declare block that is created around the test |
    +-----------+--------+------------------------------------------------------------------------+





.. index:: pair: gma; instructions()

.. _gma.gma.instructions:


.. metho:: gma.gma.instructions


**instructions** (hud, msg, key, display)
    Convenience function for examples to show some instruction text and be able to toggle it
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +==========+===================+===================================================+
    | hud      | :api:`gma.hud`    | Hud to display message with                       |
    +----------+-------------------+---------------------------------------------------+
    | msg      | String            | The message to display                            |
    +----------+-------------------+---------------------------------------------------+
    | key      | Number            | Key to use to toggle message                      |
    +----------+-------------------+---------------------------------------------------+
    | display  | Boolean           | Specify whether to display straight away          |
    +----------+-------------------+---------------------------------------------------+





.. index:: pair: gma; makeImage()

.. _gma.gma.makeImage:


.. metho:: gma.gma.makeImage


**makeImage** (manager, width, height) -> Base64-PNG
    Creates a png image of the canvas
    

    

    **Package** gma/utils/image


    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +===============+=================================+================================+
    | manager       | :api:`gma.manager`              |                                |
    +---------------+---------------------------------+--------------------------------+
    | width         | Number                          | Width of the png               |
    +---------------+---------------------------------+--------------------------------+
    | height        | Number                          | Height of the png              |
    +---------------+---------------------------------+--------------------------------+





.. index:: pair: gma; checkImage()

.. _gma.gma.checkImage:


.. metho:: gma.gma.checkImage


**checkImage** (png, checkAgainst) -> Result from the server
    Asks the server to check an image against one it already has
    

    

    **Package** gma/utils/image


    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +====================+=================+===========================================+
    | png                | Base64-PNG      | Png to check                              |
    +--------------------+-----------------+-------------------------------------------+
    | checkAgainst       | string          | Location of image to check                |
    +--------------------+-----------------+-------------------------------------------+





