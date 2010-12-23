def iterSects(activeOnly=True):
    for sect in sections:
        options = {}
        if type(sect) is tuple:
            sect, options = sect
        
        try:
            active = options['active']
        except KeyError:
            active = True
        
        if active or not activeOnly:
            yield sect, options
