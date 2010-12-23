from django import template
register = template.Library()

@register.filter('sorted')
def sort(value):
    return sorted(value)
