{% load gma %}
{% block ref %}{% endblock %}

{% block title %}{% underline "=" %}{{fullname}}{% endunderline %}{% endblock %}

{% block description %}
{% indent "|" %}
    {{current.description|description}}
{% endindent  %}
{% endblock %}

{% block info %}
{% indent %}
    {{current.table|safe}}
    {% endindent %}
{% endblock %}

{% block afterInfo %}{% endblock %}

{% if current.hasProperties %}
{% underline "-" %}Properties{% endunderline %}

{% block properties %}
{{current.getInheritedProperties|safe}}

{% for property in current.iterProperties %}

{% block propertyRef %}
.. _{{module.name}}.{{current.name}}.{{property.getName}}:
{% endblock %}

**{{property.getName}}**
           
{% indent "|" %}
    {{property.description|description}}
    {% endindent %}
        
{% indent %}
    {{property.table|safe}}
    {% endindent %}

{% endfor %}
{% endblock %}
{% endif %}

{% if current.hasMethods %}
{% underline "-" %}Methods{% endunderline %}

{% block methods %}
{{current.getInheritedMethods|safe}}

{% for method in current.iterMethods %}
{% block methodRef %}
.. index:: pair: {{current.className}}; {{method.getName}}()

.. _{{module.name}}.{{current.name}}.{{method.name}}:
{% endblock %}

{{method.signature|safe}}
{% indent "|" %}
    {{method.description|description}}
    {% endindent %}
    
{% if method.override %}
    **Overrides** {{method.override|safe}}{% endif %}
    
{% if method.package != method.class.package %}
    **Package** {{method.package|safe}}{% endif %}

{% if method.hasParams %}
{% indent %}
    {{method.paramTable|safe}}
    {% endindent %}
{% endif %}

{% endfor %}
{% endblock %}
{% endif %}
