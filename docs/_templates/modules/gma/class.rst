{% extends 'class.rst' %}
{% load gma %}

{% block ref %}
.. api:: {{fullname}}

{% if fullname != current.name %}
.. api:: {{current.name}}
{% endif %}
{% endblock %}


{% block afterInfo %}
{% if current.hasTags %}
{% underline "-" %}Tags{% endunderline %}

{% block tags %}
{{current.tagString}}
{% endblock %}
{% endif %}
{% endblock %}

{% block propertyRef %}
{{ block.super }}

.. prop:: {{module.name}}.{{current.name}}.{{property.getName}}
{% endblock %}

{% block methodRef %}
{{ block.super }}

.. metho:: {{module.name}}.{{current.name}}.{{method.name}}
{% endblock %}
