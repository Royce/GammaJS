

.. api:: gma.manager


.. api:: manager



gma.manager
===========


    Provides basic setup functionality



    ========= =============
    Package   gma/manager
    ========= =============







Properties
----------








.. _gma.manager.width:


.. prop:: gma.manager.width


**width**
           
    Holds the width of the canvas
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 800    |
    +---------+--------+





.. _gma.manager.height:


.. prop:: gma.manager.height


**height**
           
    Holds the height of the canvas
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 600    |
    +---------+--------+





.. _gma.manager.containerID:


.. prop:: gma.manager.containerID


**containerID**
           
    Id for the gamma div
        
    +---------+---------+
    | Type    | String  |
    +---------+---------+
    | Default | "gamma" |
    +---------+---------+





.. _gma.manager.container:


.. prop:: gma.manager.container


**container**
           
    The gamma div
        
    +---------+-------------+
    | Type    | Element     |
    +---------+-------------+
    | Default | $("#gamma") |
    +---------+-------------+





.. _gma.manager.canvas:


.. prop:: gma.manager.canvas


**canvas**
           
    Holds the canvas
        
    +------+-------------+
    | Type | DOM Element |
    +------+-------------+





.. _gma.manager.sceneHelper:


.. prop:: gma.manager.sceneHelper


**sceneHelper**
           
    Helper object connecting manager to rendering library
        
    +------+------------------------+
    | Type | :api:`gma.sceneHelper` |
    +------+------------------------+





.. _gma.manager.resources:


.. prop:: gma.manager.resources


**resources**
           
    List of resources to give the renderer
        
    +------+----------+
    | Type | [String] |
    +------+----------+





.. _gma.manager.levelParser:


.. prop:: gma.manager.levelParser


**levelParser**
           
    The manager's levelParser object
        
    +------+------------------------+
    | Type | :api:`gma.levelParser` |
    +------+------------------------+





.. _gma.manager.levels:


.. prop:: gma.manager.levels


**levels**
           
    Holds the level specs
        
    +---------+------+
    | Type    | List |
    +---------+------+
    | Default | []   |
    +---------+------+





.. _gma.manager.levelIndex:


.. prop:: gma.manager.levelIndex


**levelIndex**
           
    Holds the level index. (a level must be loaded first for it to be accurate)
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.manager.hud:


.. prop:: gma.manager.hud


**hud**
           
    Holds the hud
        
    +------+----------------+
    | Type | :api:`gma.hud` |
    +------+----------------+





.. _gma.manager.showLoading:


.. prop:: gma.manager.showLoading


**showLoading**
           
    Specifies whether it should display a loading message
        
    +---------+---------+
    | Type    | Boolean |
    +---------+---------+
    | Default | true    |
    +---------+---------+





.. _gma.manager.character:


.. prop:: gma.manager.character


**character**
           
    | Holds a character object
    | This is optional
        
    +---------+----------------------+
    | Type    | :api:`gma.character` |
    +---------+----------------------+
    | Default | undefined            |
    +---------+----------------------+





.. _gma.manager.time:


.. prop:: gma.manager.time


**time**
           
    Holds the last time scene was rendered
        
    +------+--------+
    | Type | Number |
    +------+--------+





.. _gma.manager.counter:


.. prop:: gma.manager.counter


**counter**
           
    Holds an accumulation of time to be used for fps calculation
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.manager.fps:


.. prop:: gma.manager.fps


**fps**
           
    Holds the frames per second
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.manager.twitchCount:


.. prop:: gma.manager.twitchCount


**twitchCount**
           
    Number of times the scene has twitched since fps last calculated
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+






Methods
-------







.. index:: pair: manager; getFPS()

.. _gma.manager.getFPS:


.. metho:: gma.manager.getFPS


**getFPS** ( ) -> Number
    Get the current FPS
    

    







.. index:: pair: manager; background()

.. _gma.manager.background:


.. metho:: gma.manager.background


**background** ( ) -> Array
    Returns a list of all background
    

    







.. index:: pair: manager; entities()

.. _gma.manager.entities:


.. metho:: gma.manager.entities


**entities** ( ) -> Array
    Returns a list of all entities in the current level
    

    







.. index:: pair: manager; determineObject()

.. _gma.manager.determineObject:


.. metho:: gma.manager.determineObject


**determineObject** (type, opts) -> Gamma Object
    | Returns a gamma object given the type given
    | If type is a string, then we look on gma to see if it exists
    | Otherwise it is used as is
    | And any options supplied in the opts object is applied to this object
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +======+========================+==================================================+
    | type | Gamma Object or string | Name of a gamma object or just a gamma object    |
    +------+------------------------+--------------------------------------------------+
    | opts | Gamma Object or string | Name of a gamma object or just a gamma object    |
    +------+------------------------+--------------------------------------------------+





.. index:: pair: manager; prepareEntity()

.. _gma.manager.prepareEntity:


.. metho:: gma.manager.prepareEntity


**prepareEntity** (focus, template, opts) -> Gamma Object
    | Attaches renderHelper and renderTemplate to the gamma object given
    | Also applies any extra options to this Gamma object
    

    



    +-------------------------------------------------------------------------------------+
    | Parameters                                                                          |
    +==========+================+=========================================================+
    | focus    | Gamma Object   | Gamma object                                            |
    +----------+----------------+---------------------------------------------------------+
    | template | renderTemplate | A renderTemplate object to be given to the gamma object |
    +----------+----------------+---------------------------------------------------------+
    | opts     | {}             | Options to be applied to the gamma object               |
    +----------+----------------+---------------------------------------------------------+





.. index:: pair: manager; addCustomDefinitions()

.. _gma.manager.addCustomDefinitions:


.. metho:: gma.manager.addCustomDefinitions


**addCustomDefinitions** (opts)
    | Gives an object othe levelParser to process, without storing the result anywhere
    | Useful for giving the levelParser type and template specifications
    | Which end up stored on the levelParser
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +========+===========+=============================================================+
    | opts   | Object    | Options that are given to the levelParser                   |
    +--------+-----------+-------------------------------------------------------------+





.. index:: pair: manager; storeLevels()

.. _gma.manager.storeLevels:


.. metho:: gma.manager.storeLevels


**storeLevels** (levels, replaceAll)
    Stores level specifications on the manager
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +============+=========+===========================================================+
    | levels     | Array   | A list of level objets to store                           |
    +------------+---------+-----------------------------------------------------------+
    | replaceAll | Boolean | Flag specifying whether to replace all current levels     |
    +------------+---------+-----------------------------------------------------------+





.. index:: pair: manager; loadLevel()

.. _gma.manager.loadLevel:


.. metho:: gma.manager.loadLevel


**loadLevel** (level, spawnId)
    | Will load the specified level into the manager
    | Or the first level in self.levels if no level is specified
    | Or complain if manager has no stored levels
    | It will also remove any current levels in the manager
    | And set the position of the character according to the spawn location specified
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +============+===========+=========================================================+
    | level      | Number    | The index of the level to load                          |
    +------------+-----------+---------------------------------------------------------+
    | spawnId    | String    | Id of the spawn location for character                  |
    +------------+-----------+---------------------------------------------------------+





.. index:: pair: manager; clearLevel()

.. _gma.manager.clearLevel:


.. metho:: gma.manager.clearLevel


**clearLevel** ( )
    Clears the current level from the scenehelper
    

    







.. index:: pair: manager; init()

.. _gma.manager.init:


.. metho:: gma.manager.init


**init** (level, spawn)
    | Called when we want the game to start
    | It creates a Scene and then starts the twitch 
    | It will also call loadLevel if no level is currently loaded
    | Or if a level has been specified
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +===========+=============+========================================================+
    | level     | Number      | The index of the level to load                         |
    +-----------+-------------+--------------------------------------------------------+
    | spawn     | String      | Alternate spawn point to use                           |
    +-----------+-------------+--------------------------------------------------------+





.. index:: pair: manager; twitch()

.. _gma.manager.twitch:


.. metho:: gma.manager.twitch


**twitch** (self)
    | The game loop function
    | Responsible for :
    
    * Calling animate
    * Calling render
    * Calculating fps
    * Removing entities that are dead
    * Calling itself again to continue the loop
    

    



    +---------------------------------------------------------------------------------+
    | Parameters                                                                      |
    +=========================+=======================================================+
    | self                    | gma.manager                                           |
    +-------------------------+-------------------------------------------------------+





.. index:: pair: manager; animate()

.. _gma.manager.animate:


.. metho:: gma.manager.animate


**animate** (tick)
    Calls the animate function on objects inside the map
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +=======+==========+===============================================================+
    | tick  | Integer  | Number representing the time since the last twitch            |
    +-------+----------+---------------------------------------------------------------+





.. index:: pair: manager; removeDead()

.. _gma.manager.removeDead:


.. metho:: gma.manager.removeDead


**removeDead** (entities, cemetry)
    Removes any dead entities from the map
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +==========+======+================================================================+
    | entities | List | List of entities to look through                               |
    +----------+------+----------------------------------------------------------------+
    | cemetry  | List | List to add dead entities to if they have the reincarnate tag  |
    +----------+------+----------------------------------------------------------------+





.. index:: pair: manager; checkCharacter()

.. _gma.manager.checkCharacter:


.. metho:: gma.manager.checkCharacter


**checkCharacter** ( )
    Determines if the character is dead and does something about it if it is
    

    







.. index:: pair: manager; respawn()

.. _gma.manager.respawn:


.. metho:: gma.manager.respawn


**respawn** (spawnId)
    Puts character back to the beginning
    

    



    +----------------------------------------------------------------------------------------------+
    | Parameters                                                                                   |
    +=========+========+===========================================================================+
    | spawnId | String | String specifying where to respawn the character. This defaults to "main" |
    +---------+--------+---------------------------------------------------------------------------+





