

.. api:: gma.renderHelper


.. api:: renderHelper



gma.renderHelper
================


    Connects rendered object to gamma object



    ========= ==================
    Package   gma/utils/render
    ========= ==================







Properties
----------








.. _gma.renderHelper.entity:


.. prop:: gma.renderHelper.entity


**entity**
           
    The entity that is attached to this helper (and vice verca)
        
    +------+--------------+
    | Type | Gamma object |
    +------+--------------+





.. _gma.renderHelper.template:


.. prop:: gma.renderHelper.template


**template**
           
    | The template object
    | <strong> must be passed in or set after creation</strong>
        
    +------+-------------------------+
    | Type | :api:`gma.baseTemplate` |
    +------+-------------------------+





.. _gma.renderHelper.parent:


.. prop:: gma.renderHelper.parent


**parent**
           
    The parent object that the rendered object belongs to
        
    +------+---------------+
    | Type | :glge:`Group` |
    +------+---------------+






Methods
-------







.. index:: pair: renderHelper; attachTo()

.. _gma.renderHelper.attachTo:


.. metho:: gma.renderHelper.attachTo


**attachTo** (obj)
    Attaches an object to this helper
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +======+==========+================================================================+
    | obj  | object   | The object which we wish to attach to the helper               |
    +------+----------+----------------------------------------------------------------+





.. index:: pair: renderHelper; addTo()

.. _gma.renderHelper.addTo:


.. metho:: gma.renderHelper.addTo


**addTo** (grp)
    Attaches the object to the group
    

    



    +----------------------------------------------------------------------------------+
    | Parameters                                                                       |
    +======+===================+=======================================================+
    | grp  | :glge:`Group`     | The group that we will add the object to              |
    +------+-------------------+-------------------------------------------------------+





.. index:: pair: renderHelper; setLocation()

.. _gma.renderHelper.setLocation:


.. metho:: gma.renderHelper.setLocation


**setLocation** ( )
    Sets the location of the rendered object using self.entity
    

    







.. index:: pair: renderHelper; getRenderedObj()

.. _gma.renderHelper.getRenderedObj:


.. metho:: gma.renderHelper.getRenderedObj


**getRenderedObj** ( ) -> :glge:`Object`
    Gets the object that we are rendering
    

    







.. index:: pair: renderHelper; remove()

.. _gma.renderHelper.remove:


.. metho:: gma.renderHelper.remove


**remove** ( )
    Removes the objects from the parent group and sets the parent to undefined
    

    







.. index:: pair: renderHelper; toggleBounding()

.. _gma.renderHelper.toggleBounding:


.. metho:: gma.renderHelper.toggleBounding


**toggleBounding** ( )
    Toggles from rendering the desired object to rendering a unit cube (this shows the bounding box)
    

    







