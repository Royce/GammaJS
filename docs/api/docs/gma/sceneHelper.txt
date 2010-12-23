

.. api:: gma.sceneHelper


.. api:: sceneHelper



gma.sceneHelper
===============


    Connects the rendering library to gamma manager



    ========= ==================
    Package   gma/utils/render
    ========= ==================







Properties
----------








.. _gma.sceneHelper.bkgIds:


.. prop:: gma.sceneHelper.bkgIds


**bkgIds**
           
    Dictionairy of {id:render Helpers} for things to appear in background
        
    +------+----------------------------------+
    | Type | {{id : :api:`gma.renderHelper`}} |
    +------+----------------------------------+





.. _gma.sceneHelper.background:


.. prop:: gma.sceneHelper.background


**background**
           
    List of render Helpers for things to appear in background
        
    +------+-----------------------------+
    | Type | {[:api:`gma.renderHelper`]} |
    +------+-----------------------------+





.. _gma.sceneHelper.extras:


.. prop:: gma.sceneHelper.extras


**extras**
           
    List of extra objects to be rendered in the scene
        
    +------+--------------+
    | Type | {name : obj} |
    +------+--------------+





.. _gma.sceneHelper.attached:


.. prop:: gma.sceneHelper.attached


**attached**
           
    List associating GLGE objects to gamma objects
        
    +------+----------------------------------+
    | Type | {name : [obj, offsetX, offsetY]} |
    +------+----------------------------------+





.. _gma.sceneHelper.scene:


.. prop:: gma.sceneHelper.scene


**scene**
           
    The GLGE.Scene being rendered
        
    +------+---------------+
    | Type | :glge:`Scene` |
    +------+---------------+





.. _gma.sceneHelper.renderer:


.. prop:: gma.sceneHelper.renderer


**renderer**
           
    The GLGE.Renderer being used
        
    +------+------------------+
    | Type | :glge:`Renderer` |
    +------+------------------+





.. _gma.sceneHelper.doc:


.. prop:: gma.sceneHelper.doc


**doc**
           
    The GLGE.Document being used
        
    +------+------------------+
    | Type | :glge:`Document` |
    +------+------------------+





.. _gma.sceneHelper.grp:


.. prop:: gma.sceneHelper.grp


**grp**
           
    The GLGE.Group that holds everything
        
    +------+---------------+
    | Type | :glge:`Group` |
    +------+---------------+






Methods
-------







.. index:: pair: sceneHelper; init()

.. _gma.sceneHelper.init:


.. metho:: gma.sceneHelper.init


**init** (manager, resources, callback)
    Initialises the GLGE scene
    

    



    +-----------------------------------------------------------------------------------+
    | Parameters                                                                        |
    +===========+====================+==================================================+
    | manager   | :api:`gma.manager` |                                                  |
    +-----------+--------------------+--------------------------------------------------+
    | resources | [String]           | a list of paths to xml files                     |
    +-----------+--------------------+--------------------------------------------------+
    | callback  | function           | The callback to call when the document is loaded |
    +-----------+--------------------+--------------------------------------------------+





.. index:: pair: sceneHelper; setupScene()

.. _gma.sceneHelper.setupScene:


.. metho:: gma.sceneHelper.setupScene


**setupScene** (manager)
    Setups the scene with a camera, group and extras
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +========================+========================================================+
    | manager                | :api:`gma.manager`                                     |
    +------------------------+--------------------------------------------------------+





.. index:: pair: sceneHelper; makeRenderer()

.. _gma.sceneHelper.makeRenderer:


.. metho:: gma.sceneHelper.makeRenderer


**makeRenderer** (manager)
    | Function that creates renderer object
    | And sets the scene
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +========================+========================================================+
    | manager                | :api:`gma.manager`                                     |
    +------------------------+--------------------------------------------------------+





.. index:: pair: sceneHelper; clear()

.. _gma.sceneHelper.clear:


.. metho:: gma.sceneHelper.clear


**clear** ( )
    Function that clears everything from the scene
    

    







.. index:: pair: sceneHelper; add()

.. _gma.sceneHelper.add:


.. metho:: gma.sceneHelper.add


**add** (helper)
    Function that adds a helper to the scene
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +========================+========================================================+
    | helper                 | gma.renderHelper                                       |
    +------------------------+--------------------------------------------------------+





.. index:: pair: sceneHelper; countContained()

.. _gma.sceneHelper.countContained:


.. metho:: gma.sceneHelper.countContained


**countContained** ( )
    Returns how many things are rendered by the scene
    

    







.. index:: pair: sceneHelper; render()

.. _gma.sceneHelper.render:


.. metho:: gma.sceneHelper.render


**render** (manager)
    Function that sets locations and renders the scene
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +========================+========================================================+
    | manager                | :api:`gma.manager`                                     |
    +------------------------+--------------------------------------------------------+





.. index:: pair: sceneHelper; setRenderedLocations()

.. _gma.sceneHelper.setRenderedLocations:


.. metho:: gma.sceneHelper.setRenderedLocations


**setRenderedLocations** (manager)
    Sets locations of everything in the scene
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +========================+========================================================+
    | manager                | :api:`gma.manager`                                     |
    +------------------------+--------------------------------------------------------+





.. index:: pair: sceneHelper; addExtra()

.. _gma.sceneHelper.addExtra:


.. metho:: gma.sceneHelper.addExtra


**addExtra** (name, type, spec) -> Object just added
    Adds other objects into the scene
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +==================================+==============================================+
    | name                             | String                                       |
    +----------------------------------+----------------------------------------------+
    | type                             | String                                       |
    +----------------------------------+----------------------------------------------+
    | spec                             | Object                                       |
    +----------------------------------+----------------------------------------------+





.. index:: pair: sceneHelper; removeExtras()

.. _gma.sceneHelper.removeExtras:


.. metho:: gma.sceneHelper.removeExtras


**removeExtras** (extras)
    Removes specified extras from the scene helper
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +=============+=================+==================================================+
    | extras      | [String]        | List of extra ids to remove                      |
    +-------------+-----------------+--------------------------------------------------+





.. index:: pair: sceneHelper; removeBackground()

.. _gma.sceneHelper.removeBackground:


.. metho:: gma.sceneHelper.removeBackground


**removeBackground** (backgrounds)
    Removes specified background from the scene helper
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +==================+==============+================================================+
    | backgrounds      | [String]     | List of background ids to remove               |
    +------------------+--------------+------------------------------------------------+





.. index:: pair: sceneHelper; attach()

.. _gma.sceneHelper.attach:


.. metho:: gma.sceneHelper.attach


**attach** (name, obj, offsetX, offsetY, offsetZ)
    Records the necessary information to allow an object to follow another
    

    



    +--------------------------------------------------------------------------------------------------------------+
    | Parameters                                                                                                   |
    +=========+=============================+======================================================================+
    | name    | String                      | Name of the object in self.extras we are attaching the gma object to |
    +---------+-----------------------------+----------------------------------------------------------------------+
    | obj     | :api:`gma.shapes.rectangle` |                                                                      |
    +---------+-----------------------------+----------------------------------------------------------------------+
    | offsetX | Number                      |                                                                      |
    +---------+-----------------------------+----------------------------------------------------------------------+
    | offsetY | Number                      |                                                                      |
    +---------+-----------------------------+----------------------------------------------------------------------+
    | offsetZ | Number                      |                                                                      |
    +---------+-----------------------------+----------------------------------------------------------------------+





.. index:: pair: sceneHelper; detach()

.. _gma.sceneHelper.detach:


.. metho:: gma.sceneHelper.detach


**detach** (name)
    Dissociates a object from another to stop an object following another object
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +==================================+==============================================+
    | name                             | String                                       |
    +----------------------------------+----------------------------------------------+





