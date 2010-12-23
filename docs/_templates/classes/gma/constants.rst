{% extends "modules/gma/class.rst" %}

{% block ref %}
{{block.super}}
 
.. api:: gma.constant
{% endblock %}

{% block propertyRef %}
{{block.super}}

.. constant:: {{property.getName}}
{% endblock %}
