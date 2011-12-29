

.. api:: gma.levelParser


.. api:: levelParser



gma.levelParser
===============


    Creates Gamma objects and associated render helpers from a level specification



    ========= ==================
    Package   gma/utils/parser
    ========= ==================







Properties
----------








.. _gma.levelParser.templates:


.. prop:: gma.levelParser.templates


**templates**
           
    | Holds Render template objects to be assigned to entities
    | Could say something like
    
    |      banana = ['colladaTemplate',
    |           {
    |               collada : {
    |                   document : 'banana.gae'
    |               },
    |               yRot : 1.57,
    |               yOffset : -0.5,
    |               yScale : 0.7
    |           }
    |      ],
    
    | or have entries that are already an instantiated templateHelper
        
    +---------+------------------------------+
    | Type    | Object                       |
    +---------+------------------------------+
    | Default | {} with "cube" and "redcube" |
    +---------+------------------------------+





.. _gma.levelParser.types:


.. prop:: gma.levelParser.types


**types**
           
    | Associates names to gamma objects/render helpers
    | It
        
    +---------+-----------------------------------------------+
    | Type    | Object                                        |
    +---------+-----------------------------------------------+
    | Default | {default : ['platform', {template : "cube"}]} |
    +---------+-----------------------------------------------+






Methods
-------







.. index:: pair: levelParser; processLevel()

.. _gma.levelParser.processLevel:


.. metho:: gma.levelParser.processLevel


**processLevel** (level) -> Processed specification
    Processes a level specification and replaces it's content with gamma objects
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +==============+================+==================================================+
    | level        | Object         | The level specification                          |
    +--------------+----------------+--------------------------------------------------+





.. index:: pair: levelParser; preProcess()

.. _gma.levelParser.preProcess:


.. metho:: gma.levelParser.preProcess


**preProcess** (level)
    Ensures the level has the minimum amount specified
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +==============+================+==================================================+
    | level        | Object         | The level specification                          |
    +--------------+----------------+--------------------------------------------------+





.. index:: pair: levelParser; processPosition()

.. _gma.levelParser.processPosition:


.. metho:: gma.levelParser.processPosition


**processPosition** (obj)
    Creates locX, locY and locZ keys from items in position array.
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +======+==========+================================================================+
    | obj  | Object   | Object potentially containing a position array                 |
    +------+----------+----------------------------------------------------------------+





.. index:: pair: levelParser; processAttached()

.. _gma.levelParser.processAttached:


.. metho:: gma.levelParser.processAttached


**processAttached** (key, value, level)
    Remove attached from value and given to level.following
    

    



    +----------------------------------------------------------------------------------------+
    | Parameters                                                                             |
    +=======+=====================+==========================================================+
    | key   | string              | The key that will be used to reference the attached data |
    +-------+---------------------+----------------------------------------------------------+
    | value | object              | The specification that may have an 'attached' property   |
    +-------+---------------------+----------------------------------------------------------+
    | level | Level Specification | The level that we are attaching information to           |
    +-------+---------------------+----------------------------------------------------------+





.. index:: pair: levelParser; determineTemplate()

.. _gma.levelParser.determineTemplate:


.. metho:: gma.levelParser.determineTemplate


**determineTemplate** (manager, templateSpec)
    Gets a template Helper from a spec
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +====================+============================+================================+
    | manager            | :api:`gma.manager`         |                                |
    +--------------------+----------------------------+--------------------------------+
    | templateSpec       | String                     | Name of the template           |
    +--------------------+----------------------------+--------------------------------+





.. index:: pair: levelParser; validate_other()

.. _gma.levelParser.validate_other:


.. metho:: gma.levelParser.validate_other


**validate_other** (manager, key, value, level) -> Boolean
    | Validates other stuff
    | For the moment, nothing happens
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_other()

.. _gma.levelParser.process_other:


.. metho:: gma.levelParser.process_other


**process_other** (manager, key, value, level) -> Boolean
    | Processes other stuff
    | For the moment, nothing happens
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; default_spawn()

.. _gma.levelParser.default_spawn:


.. metho:: gma.levelParser.default_spawn


**default_spawn** ( )
    Returns default value for the spawn object
    

    







.. index:: pair: levelParser; validate_spawn()

.. _gma.levelParser.validate_spawn:


.. metho:: gma.levelParser.validate_spawn


**validate_spawn** (manager, key, value, level) -> Boolean
    | Validates a spawn object
    | Spawn must be an object of {id : [x, y]}
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_spawn()

.. _gma.levelParser.process_spawn:


.. metho:: gma.levelParser.process_spawn


**process_spawn** (manager, key, value, level) -> Boolean
    | Processes a spawn object
    | Must ensure each position array has two numbers in it
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; default_camera()

.. _gma.levelParser.default_camera:


.. metho:: gma.levelParser.default_camera


**default_camera** ( )
    Returns default value for the camera object
    

    







.. index:: pair: levelParser; validate_camera()

.. _gma.levelParser.validate_camera:


.. metho:: gma.levelParser.validate_camera


**validate_camera** (manager, key, value, level) -> Boolean
    | Validates a camera specification
    | Camera must be an object
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_camera()

.. _gma.levelParser.process_camera:


.. metho:: gma.levelParser.process_camera


**process_camera** (manager, key, value, level) -> Boolean
    | Processes a camera specification
    | Turn position in locX, locY and locZ
    | Remove attached from value and given to level.following
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; default_light()

.. _gma.levelParser.default_light:


.. metho:: gma.levelParser.default_light


**default_light** ( )
    Returns default value for the light object
    

    







.. index:: pair: levelParser; validate_light()

.. _gma.levelParser.validate_light:


.. metho:: gma.levelParser.validate_light


**validate_light** (manager, key, value, level) -> Boolean
    | Validates a light object
    | Light must be an array
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_light()

.. _gma.levelParser.process_light:


.. metho:: gma.levelParser.process_light


**process_light** (manager, key, value, level) -> Boolean
    | Processes a light object
    | Turn position in locX, locY and locZ
    | Remove attached from level and given to level.following
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; default_entities()

.. _gma.levelParser.default_entities:


.. metho:: gma.levelParser.default_entities


**default_entities** ( )
    Returns default value for the entities list
    

    







.. index:: pair: levelParser; validate_entities()

.. _gma.levelParser.validate_entities:


.. metho:: gma.levelParser.validate_entities


**validate_entities** (manager, key, value, level) -> Boolean
    | Validates an entities list
    | Entities must be an array
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_entities()

.. _gma.levelParser.process_entities:


.. metho:: gma.levelParser.process_entities


**process_entities** (manager, key, value, level) -> Boolean
    | Processes a entities list
    | Turns them into gamma objects
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; validate_background()

.. _gma.levelParser.validate_background:


.. metho:: gma.levelParser.validate_background


**validate_background** (manager, key, value, level) -> Boolean
    Validates a background list
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_background()

.. _gma.levelParser.process_background:


.. metho:: gma.levelParser.process_background


**process_background** (manager, key, value, level) -> Boolean
    | Processes a background list
    | Just adds to self.background
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; validate_types()

.. _gma.levelParser.validate_types:


.. metho:: gma.levelParser.validate_types


**validate_types** (manager, key, value, level) -> Boolean
    Validates a types object
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_types()

.. _gma.levelParser.process_types:


.. metho:: gma.levelParser.process_types


**process_types** (manager, key, value, level) -> Boolean
    | Processes a types object
    | Just adds to self.types
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; validate_templates()

.. _gma.levelParser.validate_templates:


.. metho:: gma.levelParser.validate_templates


**validate_templates** (manager, key, value, level) -> Boolean
    Validates a templates object
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_templates()

.. _gma.levelParser.process_templates:


.. metho:: gma.levelParser.process_templates


**process_templates** (manager, key, value, level) -> Boolean
    | Processes a templates object
    | Just adds to self.templates
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; validate_bkgIds()

.. _gma.levelParser.validate_bkgIds:


.. metho:: gma.levelParser.validate_bkgIds


**validate_bkgIds** (manager, key, value, level) -> Boolean
    | Validates bkgIds
    | This is populated by process_background
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_bkgIds()

.. _gma.levelParser.process_bkgIds:


.. metho:: gma.levelParser.process_bkgIds


**process_bkgIds** (manager, key, value, level) -> Boolean
    | Processes bkgIds
    | This is populated by process_background
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; validate_levelExtras()

.. _gma.levelParser.validate_levelExtras:


.. metho:: gma.levelParser.validate_levelExtras


**validate_levelExtras** (manager, key, value, level) -> Boolean
    | Validates level extras specification
    | This is generated at run time and should be ignored
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_levelExtras()

.. _gma.levelParser.process_levelExtras:


.. metho:: gma.levelParser.process_levelExtras


**process_levelExtras** (manager, key, value, level) -> Boolean
    | Processes level extras stuff
    | This is generated at run time and should be ignored
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; validate_following()

.. _gma.levelParser.validate_following:


.. metho:: gma.levelParser.validate_following


**validate_following** (manager, key, value, level) -> Boolean
    | Validates following specification
    | This is generated at run time and should be ignored
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_following()

.. _gma.levelParser.process_following:


.. metho:: gma.levelParser.process_following


**process_following** (manager, key, value, level) -> Boolean
    | Processes following stuff
    | This is generated at run time and should be ignored
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; validate_removed()

.. _gma.levelParser.validate_removed:


.. metho:: gma.levelParser.validate_removed


**validate_removed** (manager, key, value, level) -> Boolean
    | Validates removed stuff
    | This is generated at run time and should be ignored
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being validated                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; process_removed()

.. _gma.levelParser.process_removed:


.. metho:: gma.levelParser.process_removed


**process_removed** (manager, key, value, level) -> Boolean
    | Processes removed stuff
    | This is generated at run time and should be ignored
    

    



    +------------------------------------------------------------------------------------+
    | Parameters                                                                         |
    +=========+=====================+====================================================+
    | manager | :api:`gma.manager`  |                                                    |
    +---------+---------------------+----------------------------------------------------+
    | key     | String              | The key of the parent object this value belongs to |
    +---------+---------------------+----------------------------------------------------+
    | value   | Object              | The value object being processed                   |
    +---------+---------------------+----------------------------------------------------+
    | level   | Level Specification | The level currently being parsed                   |
    +---------+---------------------+----------------------------------------------------+





.. index:: pair: levelParser; setProperties()

.. _gma.levelParser.setProperties:


.. metho:: gma.levelParser.setProperties


**setProperties** (obj, opts, avoid)
    Sets options on a GLGE object
    

    

    **Package** gma/utils/render


    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +==========+==============+========================================================+
    | obj      | object       | The object we are setting options on                   |
    +----------+--------------+--------------------------------------------------------+
    | opts     | Object       | The options to set on the object                       |
    +----------+--------------+--------------------------------------------------------+
    | avoid    | [String]     | List of options not to set on object                   |
    +----------+--------------+--------------------------------------------------------+





