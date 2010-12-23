{% load gma %}
{% load edit %}

{% block top %}{% endblock %}

{% edit information %}

    {% edit current %}
    {% block editCurrent %}
    {% endblock %}
    {% endedit %}
    
    {% block editInformation %}
    {% endblock %}
    
{% endedit %}

{% edit_change %}

{% underline %}{{current.name}}{% endunderline %}

{{current.description|description}}

.. toctree::
   :hidden:
   :titlesonly:

{% for kls in current.classlist %}
   {% block klsIndexTitle %}{{current.name}}/{{kls.name}}{% endblock %}
   {% endfor %}

{% underline "-" %}Available classes{% endunderline %}

{% block links %}
{% for kls in current.classlist %}
   {% block klsDocLink %}* :doc:`{{kls.name}} <{{current.name}}/{{kls.name}}>`{% endblock %}{% endfor %}
{% edit_revert %}
{% endblock %}
