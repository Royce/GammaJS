

.. api:: gma.shapes


.. api:: shapes



gma.shapes
==========


    Provides shape factories



    ====================== =====================
    Package                gma/entities/shapes
    Already Instantiated   
    ====================== =====================









Methods
-------







.. index:: pair: shapes; rectangle()

.. _gma.shapes.rectangle:


.. metho:: gma.shapes.rectangle


**rectangle** (opts) -> gma.shapes.rectangle or undefined
    | Provides a rectangle factory
    | Accepts an object that has enough information to specify a rectangle
    | Precedence of information is as follows :
    
    * points
    * width and height
    * centre
    * top, left, right, bottom
    
    | If there isn't enough information or it's invalid, then undefined is returned
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +==================================+==============================================+
    | opts                             | config                                       |
    +----------------------------------+----------------------------------------------+





