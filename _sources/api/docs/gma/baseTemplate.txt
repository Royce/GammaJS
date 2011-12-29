

.. api:: gma.baseTemplate


.. api:: baseTemplate



gma.baseTemplate
================


    Allows the specification of a rendered object



    ============= ================================================================================
    Package       gma/utils/render
    Descendants   :api:`gma.colladaTemplate`, :api:`gma.glgeIDTemplate`, :api:`gma.meshTemplate`
    ============= ================================================================================







Properties
----------








.. _gma.baseTemplate.sceneHelper:


.. prop:: gma.baseTemplate.sceneHelper


**sceneHelper**
           
    | The helper object for the scene
    | <strong> must be passed in </strong>
        
    +------+------------------------+
    | Type | :api:`gma.sceneHelper` |
    +------+------------------------+





.. _gma.baseTemplate._blueprint:


.. prop:: gma.baseTemplate._blueprint


**_blueprint**
           
    The object that we are instancing
        
    +------+----------------+
    | Type | :glge:`Object` |
    +------+----------------+





.. _gma.baseTemplate.xRot:


.. prop:: gma.baseTemplate.xRot


**xRot**
           
    The ammount to rotate the object in the x axis
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.baseTemplate.yRot:


.. prop:: gma.baseTemplate.yRot


**yRot**
           
    The ammount to rotate the object in the y axis
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.baseTemplate.zRot:


.. prop:: gma.baseTemplate.zRot


**zRot**
           
    The ammount to rotate the object in the z axis
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.baseTemplate.xScale:


.. prop:: gma.baseTemplate.xScale


**xScale**
           
    The ammount to scale the object in the x axis
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.baseTemplate.yScale:


.. prop:: gma.baseTemplate.yScale


**yScale**
           
    The ammount to scale the object in the y axis
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.baseTemplate.zScale:


.. prop:: gma.baseTemplate.zScale


**zScale**
           
    The ammount to scale the object in the z axis
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.baseTemplate.xOffset:


.. prop:: gma.baseTemplate.xOffset


**xOffset**
           
    The ammount to shift the object in the x axis
        
    +---------+--------+
    | Type    | Number |
    +---------+--------+
    | Default | 0      |
    +---------+--------+





.. _gma.baseTemplate.yOffset:


.. prop:: gma.baseTemplate.yOffset


**yOffset**
           
    The ammount to shift the object in the y axis
        
    +---------+----------------+
    | Type    | :glge:`Object` |
    +---------+----------------+
    | Default | 0              |
    +---------+----------------+





.. _gma.baseTemplate.zOffset:


.. prop:: gma.baseTemplate.zOffset


**zOffset**
           
    The ammount to shift the object in the z axis
        
    +---------+----------------+
    | Type    | :glge:`Object` |
    +---------+----------------+
    | Default | 0              |
    +---------+----------------+






Methods
-------







.. index:: pair: baseTemplate; defineInstance()

.. _gma.baseTemplate.defineInstance:


.. metho:: gma.baseTemplate.defineInstance


**defineInstance** ( ) -> :glge:`Object`
    Determines object that will be instanced
    

    







.. index:: pair: baseTemplate; getInstance()

.. _gma.baseTemplate.getInstance:


.. metho:: gma.baseTemplate.getInstance


**getInstance** ( ) -> :glge:`Group`
    | Puts the object into a GLGE group and offsets its position appropriately
    | It then returns a new instance of the group
    

    







