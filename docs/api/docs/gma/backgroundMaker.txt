

.. api:: gma.backgroundMaker


.. api:: backgroundMaker



gma.backgroundMaker
===================


    Provides some functions to transform specification into background



    ========= ======================
    Package   gma/utils/background
    ========= ======================







Properties
----------








.. _gma.backgroundMaker.z:


.. prop:: gma.backgroundMaker.z


**z**
           
    The z co-ordinate given to all background items
        
    +------+--------+
    | Type | Number |
    +------+--------+






Methods
-------







.. index:: pair: backgroundMaker; process()

.. _gma.backgroundMaker.process:


.. metho:: gma.backgroundMaker.process


**process** (manager, value) -> :api:`gma.renderHelper`
    Dispatcher for determining how to treat background specifications
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +========================+========================================================+
    | manager                | :api:`gma.manager`                                     |
    +------------------------+--------------------------------------------------------+
    | value                  | specification                                          |
    +------------------------+--------------------------------------------------------+





.. index:: pair: backgroundMaker; sanitise()

.. _gma.backgroundMaker.sanitise:


.. metho:: gma.backgroundMaker.sanitise


**sanitise** (value, opts)
    Function to ensure value.entity is a rectangle
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +=========================+=======================================================+
    | value                   | specification                                         |
    +-------------------------+-------------------------------------------------------+
    | opts                    | Options                                               |
    +-------------------------+-------------------------------------------------------+





.. index:: pair: backgroundMaker; process_other()

.. _gma.backgroundMaker.process_other:


.. metho:: gma.backgroundMaker.process_other


**process_other** (manager, value, type) -> :api:`gma.renderHelper`
    Processer for specifications with no or unknown type
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +========================+========================================================+
    | manager                | :api:`gma.manager`                                     |
    +------------------------+--------------------------------------------------------+
    | value                  | specification                                          |
    +------------------------+--------------------------------------------------------+
    | type                   | String                                                 |
    +------------------------+--------------------------------------------------------+





.. index:: pair: backgroundMaker; process_skybox()

.. _gma.backgroundMaker.process_skybox:


.. metho:: gma.backgroundMaker.process_skybox


**process_skybox** (manager, value, type) -> :api:`gma.renderHelper`
    Processer for skybox
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +========================+========================================================+
    | manager                | :api:`gma.manager`                                     |
    +------------------------+--------------------------------------------------------+
    | value                  | specification                                          |
    +------------------------+--------------------------------------------------------+
    | type                   | String                                                 |
    +------------------------+--------------------------------------------------------+





