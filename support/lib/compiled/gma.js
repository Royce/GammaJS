/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 0.15.0+ Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//laxbreak is true to allow build pragmas to change some statements.
/*jslint plusplus: false, nomen: false, laxbreak: true, regexp: false */
/*global window: false, document: false, navigator: false,
setTimeout: false, traceDeps: true, clearInterval: false, self: false,
setInterval: false, importScripts: false, jQuery: false */


var require, define;
(function () {
    //Change this version number for each release.
    var version = "0.15.0+",
            empty = {}, s,
            i, defContextName = "_", contextLoads = [],
            scripts, script, rePkg, src, m, dataMain, cfg = {}, setReadyState,
            commentRegExp = /(\/\*([\s\S]*?)\*\/|\/\/(.*)$)/mg,
            cjsRequireRegExp = /require\(["']([\w\!\-_\.\/]+)["']\)/g,
            main,
            isBrowser = !!(typeof window !== "undefined" && navigator && document),
            isWebWorker = !isBrowser && typeof importScripts !== "undefined",
            //PS3 indicates loaded and complete, but need to wait for complete
            //specifically. Sequence is "loading", "loaded", execution,
            // then "complete". The UA check is unfortunate, but not sure how
            //to feature test w/o causing perf issues.
            readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ? /^complete$/ : /^(complete|loaded)$/,
            ostring = Object.prototype.toString,
            ap = Array.prototype,
            aps = ap.slice, scrollIntervalId, req, baseElement,
            defQueue = [], useInteractive = false, currentlyAddingScript;

    function isFunction(it) {
        return ostring.call(it) === "[object Function]";
    }

    //Check for an existing version of require. If so, then exit out. Only allow
    //one version of require to be active in a page. However, allow for a require
    //config object, just exit quickly if require is an actual function.
    if (typeof require !== "undefined") {
        if (isFunction(require)) {
            return;
        } else {
            //assume it is a config object.
            cfg = require;
        }
    }
    
        /**
     * Calls a method on a plugin. The obj object should have two property,
     * name: the name of the method to call on the plugin
     * args: the arguments to pass to the plugin method.
     */
    function callPlugin(prefix, context, obj) {
        //Call the plugin, or load it.
        var plugin = s.plugins.defined[prefix], waiting;
        if (plugin) {
            plugin[obj.name].apply(null, obj.args);
        } else {
            //Put the call in the waiting call BEFORE requiring the module,
            //since the require could be synchronous in some environments,
            //like builds
            waiting = s.plugins.waiting[prefix] || (s.plugins.waiting[prefix] = []);
            waiting.push(obj);

            //Load the module
            req(["require/" + prefix], context.contextName);
        }
    }
    
    /**
     * Convenience method to call main for a require.def call that was put on
     * hold in the defQueue.
     */
    function callDefMain(args, context) {
        main.apply(req, args);
        //Mark the module loaded. Must do it here in addition
        //to doing it in require.def in case a script does
        //not call require.def
        context.loaded[args[0]] = true;
    }

    /**
     * Used to set up package paths from a packagePaths or packages config object.
     * @param {Object} packages the object to store the new package config
     * @param {Array} currentPackages an array of packages to configure
     * @param {String} [dir] a prefix dir to use.
     */
    function configurePackageDir(packages, currentPackages, dir) {
        var i, location, pkgObj;
        for (i = 0; (pkgObj = currentPackages[i]); i++) {
            pkgObj = typeof pkgObj === "string" ? { name: pkgObj } : pkgObj;
            location = pkgObj.location;

            //Add dir to the path, but avoid paths that start with a slash
            //or have a colon (indicates a protocol)
            if (dir && (!location || (location.indexOf("/") !== 0 && location.indexOf(":") === -1))) {
                pkgObj.location = dir + "/" + (pkgObj.location || pkgObj.name);
            }

            //Normalize package paths.
            pkgObj.location = pkgObj.location || pkgObj.name;
            pkgObj.lib = pkgObj.lib || "lib";
            pkgObj.main = pkgObj.main || "main";

            packages[pkgObj.name] = pkgObj;
        }
    }

    /**
     * Determine if priority loading is done. If so clear the priorityWait
     */
    function isPriorityDone(context) {
        var priorityDone = true,
            priorityWait = context.config.priorityWait,
            priorityName, i;
        if (priorityWait) {
            for (i = 0; (priorityName = priorityWait[i]); i++) {
                if (!context.loaded[priorityName]) {
                    priorityDone = false;
                    break;
                }
            }
            if (priorityDone) {
                delete context.config.priorityWait;
            }
        }
        return priorityDone;
    }

    /**
     * Resumes tracing of dependencies and then checks if everything is loaded.
     */
    function resume(context) {
        var args, i, paused = s.paused;
        if (context.scriptCount <= 0) {
            //Synchronous envs will push the number below zero with the
            //decrement above, be sure to set it back to zero for good measure.
            //require() calls that also do not end up loading scripts could
            //push the number negative too.
            context.scriptCount = 0;

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    req.onError(new Error('Mismatched anonymous require.def modules'));
                } else {
                    callDefMain(args, context);
                }
            }

            //Skip the resume if current context is in priority wait.
            if (context.config.priorityWait && !isPriorityDone(context)) {
                return;
            }

            if (paused.length) {
                //Reset paused since this loop will process current set.
                s.paused = [];

                for (i = 0; (args = paused[i]); i++) {
                    req.checkDeps.apply(req, args);
                }
            }

            if (isWebWorker) {
                //In a web worker, since importScripts is synchronous,
                //it may think all dependencies are loaded, but still
                //in the middle of a list of dependency fetches, so
                //delay the checkLoaded in a timeout for the items to complete.
                //This is really hacky though, time for a rewrite.
                setTimeout(function () {
                    req.checkLoaded(s.ctxName);
                }, 30);
            } else {
                req.checkLoaded(s.ctxName);
            }
        }
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     */
    require = function (deps, callback, contextName, relModuleName) {
        var context, config;
        if (typeof deps === "string" && !isFunction(callback)) {
            //Just return the module wanted. In this scenario, the
            //second arg (if passed) is just the contextName.
            return require.get(deps, callback, contextName, relModuleName);
        }
        // Dependencies first
        if (!require.isArray(deps)) {
            // deps is a config object
            config = deps;
            if (require.isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = contextName;
                contextName = relModuleName;
                relModuleName = arguments[4];
            } else {
                deps = [];
            }
        }

        main(null, deps, callback, config, contextName, relModuleName);

        //If the require call does not trigger anything new to load,
        //then resume the dependency processing. Context will be undefined
        //on first run of require.
        context = s.contexts[(contextName || (config && config.context) || s.ctxName)];
        if (context && context.scriptCount === 0) {
            resume(context);
        }
        //Returning undefined for Spidermonky strict checking in Komodo
        return undefined;
    };

    //Alias for caja compliance internally -
    //specifically: "Dynamically computed names should use require.async()"
    //even though this spec isn't really decided on.
    //Since it is here, use this alias to make typing shorter.
    req = require;

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * If you do override it, this method should *always* throw an error
     * to stop the execution flow correctly. Otherwise, other weird errors
     * will occur.
     * @param {Error} err the error object.
     */
    req.onError = function (err) {
        throw err;
    };

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = req.def = function (name, deps, callback, contextName) {
        var i, scripts, script, node = currentlyAddingScript;

        //Allow for anonymous functions
        if (typeof name !== 'string') {
            //Adjust args appropriately
            contextName = callback;
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!req.isArray(deps)) {
            contextName = callback;
            callback = deps;
            deps = [];
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!name && !deps.length && req.isFunction(callback)) {
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies.
            callback
                .toString()
                .replace(commentRegExp, "")
                .replace(cjsRequireRegExp, function (match, dep) {
                    deps.push(dep);
                });

            //May be a CommonJS thing even without require calls, but still
            //could use exports, and such, so always add those as dependencies.
            //This is a bit wasteful for RequireJS modules that do not need
            //an exports or module object, but erring on side of safety.
            //REQUIRES the function to expect the CommonJS variables in the
            //order listed below.
            deps = ["require", "exports", "module"].concat(deps);
        }

        //If in IE 6-8 and hit an anonymous require.def call, do the interactive/
        //currentlyAddingScript scripts stuff.
        if (!name && useInteractive) {
            scripts = document.getElementsByTagName('script');
            for (i = scripts.length - 1; i > -1 && (script = scripts[i]); i--) {
                if (script.readyState === 'interactive') {
                    node = script;
                    break;
                }
            }
            if (!node) {
                req.onError(new Error("ERROR: No matching script interactive for " + callback));
            }

            name = node.getAttribute("data-requiremodule");
        }

        if (typeof name === 'string') {
            //Do not try to auto-register a jquery later.
            //Do this work here and in main, since for IE/useInteractive, this function
            //is the earliest touch-point.
            s.contexts[s.ctxName].jQueryDef = (name === "jquery");
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs.
        defQueue.push([name, deps, callback, null, contextName]);
    };

    main = function (name, deps, callback, config, contextName, relModuleName) {
        //Grab the context, or create a new one for the given context name.
        var context, newContext, loaded, pluginPrefix,
            canSetContext, prop, newLength, outDeps, mods, paths, index, i,
            deferMods, deferModArgs, lastModArg, waitingName, packages,
            packagePaths;

        contextName = contextName ? contextName : (config && config.context ? config.context : s.ctxName);
        context = s.contexts[contextName];

        if (name) {
                        // Pull off any plugin prefix.
            index = name.indexOf("!");
            if (index !== -1) {
                pluginPrefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            } else {
                //Could be that the plugin name should be auto-applied.
                //Used by i18n plugin to enable anonymous i18n modules, but
                //still associating the auto-generated name with the i18n plugin.
                pluginPrefix = context.defPlugin[name];
            }

            
            //If module already defined for context, or already waiting to be
            //evaluated, leave.
            waitingName = context.waiting[name];
            if (context && (context.defined[name] || (waitingName && waitingName !== ap[name]))) {
                return;
            }
        }

        if (contextName !== s.ctxName) {
            //If nothing is waiting on being loaded in the current context,
            //then switch s.ctxName to current contextName.
            loaded = (s.contexts[s.ctxName] && s.contexts[s.ctxName].loaded);
            canSetContext = true;
            if (loaded) {
                for (prop in loaded) {
                    if (!(prop in empty)) {
                        if (!loaded[prop]) {
                            canSetContext = false;
                            break;
                        }
                    }
                }
            }
            if (canSetContext) {
                s.ctxName = contextName;
            }
        }

        if (!context) {
            newContext = {
                contextName: contextName,
                config: {
                    waitSeconds: 7,
                    baseUrl: s.baseUrl || "./",
                    paths: {},
                    packages: {}
                },
                waiting: [],
                specified: {
                    "require": true,
                    "exports": true,
                    "module": true
                },
                loaded: {},
                scriptCount: 0,
                urlFetched: {},
                defPlugin: {},
                defined: {},
                modifiers: {}
            };

                        if (s.plugins.newContext) {
                s.plugins.newContext(newContext);
            }
            
            context = s.contexts[contextName] = newContext;
        }

        //If have a config object, update the context's config object with
        //the config values.
        if (config) {
            //Make sure the baseUrl ends in a slash.
            if (config.baseUrl) {
                if (config.baseUrl.charAt(config.baseUrl.length - 1) !== "/") {
                    config.baseUrl += "/";
                }
            }

            //Save off the paths and packages since they require special processing,
            //they are additive.
            paths = context.config.paths;
            packages = context.config.packages;

            //Mix in the config values, favoring the new values over
            //existing ones in context.config.
            req.mixin(context.config, config, true);

            //Adjust paths if necessary.
            if (config.paths) {
                for (prop in config.paths) {
                    if (!(prop in empty)) {
                        paths[prop] = config.paths[prop];
                    }
                }
                context.config.paths = paths;
            }

            packagePaths = config.packagePaths;
            if (packagePaths || config.packages) {
                //Convert packagePaths into a packages config.
                if (packagePaths) {
                    for (prop in packagePaths) {
                        if (!(prop in empty)) {
                            configurePackageDir(packages, packagePaths[prop], prop);
                        }
                    }
                }

                //Adjust packages if necessary.
                if (config.packages) {
                    configurePackageDir(packages, config.packages);
                }

                //Done with modifications, assing packages back to context config
                context.config.packages = packages;
            }

            //If priority loading is in effect, trigger the loads now
            if (config.priority) {
                //Create a separate config property that can be
                //easily tested for config priority completion.
                //Do this instead of wiping out the config.priority
                //in case it needs to be inspected for debug purposes later.
                req(config.priority);
                context.config.priorityWait = config.priority;
            }

            //If a deps array or a config callback is specified, then call
            //require with those args. This is useful when require is defined as a
            //config object before require.js is loaded.
            if (config.deps || config.callback) {
                req(config.deps || [], config.callback);
            }

                        //Set up ready callback, if asked. Useful when require is defined as a
            //config object before require.js is loaded.
            if (config.ready) {
                req.ready(config.ready);
            }
            
            //If it is just a config block, nothing else,
            //then return.
            if (!deps) {
                return;
            }
        }

        //Normalize dependency strings: need to determine if they have
        //prefixes and to also normalize any relative paths. Replace the deps
        //array of strings with an array of objects.
        if (deps) {
            outDeps = deps;
            deps = [];
            for (i = 0; i < outDeps.length; i++) {
                deps[i] = req.splitPrefix(outDeps[i], (name || relModuleName), context);
            }
        }

        //Store the module for later evaluation
        newLength = context.waiting.push({
            name: name,
            deps: deps,
            callback: callback
        });

        if (name) {
            //Store index of insertion for quick lookup
            context.waiting[name] = newLength - 1;

            //Mark the module as specified so no need to fetch it again.
            //Important to set specified here for the
            //pause/resume case where there are multiple modules in a file.
            context.specified[name] = true;

                        //Load any modifiers for the module.
            mods = context.modifiers[name];
            if (mods) {
                req(mods, contextName);
                deferMods = mods.__deferMods;
                if (deferMods) {
                    for (i = 0; i < deferMods.length; i++) {
                        deferModArgs = deferMods[i];

                        //Add the context name to the def call.
                        lastModArg = deferModArgs[deferModArgs.length - 1];
                        if (lastModArg === undefined) {
                            deferModArgs[deferModArgs.length - 1] = contextName;
                        } else if (typeof lastModArg === "string") {
                            deferMods.push(contextName);
                        }

                        require.def.apply(require, deferModArgs);
                    }
                }
            }
                    }

        //If the callback is not an actual function, it means it already
        //has the definition of the module as a literal value.
        if (name && callback && !req.isFunction(callback)) {
            context.defined[name] = callback;
        }

        //If a pluginPrefix is available, call the plugin, or load it.
                if (pluginPrefix) {
            callPlugin(pluginPrefix, context, {
                name: "require",
                args: [name, deps, callback, context]
            });
        }
        
        //Hold on to the module until a script load or other adapter has finished
        //evaluating the whole file. This helps when a file has more than one
        //module in it -- dependencies are not traced and fetched until the whole
        //file is processed.
        s.paused.push([pluginPrefix, name, deps, context]);

        //Set loaded here for modules that are also loaded
        //as part of a layer, where onScriptLoad is not fired
        //for those cases. Do this after the inline define and
        //dependency tracing is done.
        //Also check if auto-registry of jQuery needs to be skipped.
        if (name) {
            context.loaded[name] = true;
            context.jQueryDef = (name === "jquery");
        }
    };

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    req.mixin = function (target, source, force) {
        for (var prop in source) {
            if (!(prop in empty) && (!(prop in target) || force)) {
                target[prop] = source[prop];
            }
        }
        return req;
    };

    req.version = version;

    //Set up page state.
    s = req.s = {
        ctxName: defContextName,
        contexts: {},
        paused: [],
                plugins: {
            defined: {},
            callbacks: {},
            waiting: {}
        },
                //Stores a list of URLs that should not get async script tag treatment.
        skipAsync: {},
        isBrowser: isBrowser,
        isPageLoaded: !isBrowser,
        readyCalls: [],
        doc: isBrowser ? document : null
    };

    req.isBrowser = s.isBrowser;
    if (isBrowser) {
        s.head = document.getElementsByTagName("head")[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName("base")[0];
        if (baseElement) {
            s.head = baseElement.parentNode;
        }
    }

        /**
     * Sets up a plugin callback name. Want to make it easy to test if a plugin
     * needs to be called for a certain lifecycle event by testing for
     * if (s.plugins.onLifeCyleEvent) so only define the lifecycle event
     * if there is a real plugin that registers for it.
     */
    function makePluginCallback(name, returnOnTrue) {
        var cbs = s.plugins.callbacks[name] = [];
        s.plugins[name] = function () {
            for (var i = 0, cb; (cb = cbs[i]); i++) {
                if (cb.apply(null, arguments) === true && returnOnTrue) {
                    return true;
                }
            }
            return false;
        };
    }

    /**
     * Registers a new plugin for require.
     */
    req.plugin = function (obj) {
        var i, prop, call, prefix = obj.prefix, cbs = s.plugins.callbacks,
            waiting = s.plugins.waiting[prefix], generics,
            defined = s.plugins.defined, contexts = s.contexts, context;

        //Do not allow redefinition of a plugin, there may be internal
        //state in the plugin that could be lost.
        if (defined[prefix]) {
            return req;
        }

        //Save the plugin.
        defined[prefix] = obj;

        //Set up plugin callbacks for methods that need to be generic to
        //require, for lifecycle cases where it does not care about a particular
        //plugin, but just that some plugin work needs to be done.
        generics = ["newContext", "isWaiting", "orderDeps"];
        for (i = 0; (prop = generics[i]); i++) {
            if (!s.plugins[prop]) {
                makePluginCallback(prop, prop === "isWaiting");
            }
            cbs[prop].push(obj[prop]);
        }

        //Call newContext for any contexts that were already created.
        if (obj.newContext) {
            for (prop in contexts) {
                if (!(prop in empty)) {
                    context = contexts[prop];
                    obj.newContext(context);
                }
            }
        }

        //If there are waiting requests for a plugin, execute them now.
        if (waiting) {
            for (i = 0; (call = waiting[i]); i++) {
                if (obj[call.name]) {
                    obj[call.name].apply(null, call.args);
                }
            }
            delete s.plugins.waiting[prefix];
        }

        return req;
    };
    
    /**
     * As of jQuery 1.4.3, it supports a readyWait property that will hold off
     * calling jQuery ready callbacks until all scripts are loaded. Be sure
     * to track it if readyWait is available. Also, since jQuery 1.4.3 does
     * not register as a module, need to do some global inference checking.
     * Even if it does register as a module, not guaranteed to be the precise
     * name of the global. If a jQuery is tracked for this context, then go
     * ahead and register it as a module too, if not already in process.
     */
    function jQueryCheck(context, jqCandidate) {
        if (!context.jQuery) {
            var $ = jqCandidate || (typeof jQuery !== "undefined" ? jQuery : null);
            if ($ && "readyWait" in $) {
                context.jQuery = $;

                //Manually create a "jquery" module entry if not one already
                //or in process.
                if (!context.defined.jquery && !context.jQueryDef) {
                    context.defined.jquery = $;
                }

                //Make sure 
                if (context.scriptCount) {
                    $.readyWait += 1;
                    context.jQueryIncremented = true;
                }
            }
        }
    }

    /**
     * Internal method used by environment adapters to complete a load event.
     * A load event could be a script load or just a load pass from a synchronous
     * load call.
     * @param {String} moduleName the name of the module to potentially complete.
     * @param {Object} context the context object
     */
    req.completeLoad = function (moduleName, context) {
        //If there is a waiting require.def call
        var args;
        while (defQueue.length) {
            args = defQueue.shift();
            if (args[0] === null) {
                args[0] = moduleName;
                break;
            } else if (args[0] === moduleName) {
                //Found matching require.def call for this script!
                break;
            } else {
                //Some other named require.def call, most likely the result
                //of a build layer that included many require.def calls.
                callDefMain(args, context);
            }
        }
        if (args) {
            callDefMain(args, context);
        }

        //Mark the script as loaded. Note that this can be different from a
        //moduleName that maps to a require.def call. This line is important
        //for traditional browser scripts.
        context.loaded[moduleName] = true;

        //If a global jQuery is defined, check for it. Need to do it here
        //instead of main() since stock jQuery does not register as
        //a module via define.
        jQueryCheck(context);

        context.scriptCount -= 1;
        resume(context);
    };

    /**
     * Legacy function, remove at some point
     */
    req.pause = req.resume = function () {};

    /**
     * Trace down the dependencies to see if they are loaded. If not, trigger
     * the load.
     * @param {String} pluginPrefix the plugin prefix, if any associated with the name.
     *
     * @param {String} name: the name of the module that has the dependencies.
     *
     * @param {Array} deps array of dependencies.
     *
     * @param {Object} context: the loading context.
     *
     * @private
     */
    req.checkDeps = function (pluginPrefix, name, deps, context) {
        //Figure out if all the modules are loaded. If the module is not
        //being loaded or already loaded, add it to the "to load" list,
        //and request it to be loaded.
        var i, dep;

        if (pluginPrefix) {
                        callPlugin(pluginPrefix, context, {
                name: "checkDeps",
                args: [name, deps, context]
            });
                    } else {
            for (i = 0; (dep = deps[i]); i++) {
                if (!context.specified[dep.fullName]) {
                    context.specified[dep.fullName] = true;

                    //Reset the start time to use for timeouts
                    context.startTime = (new Date()).getTime();

                    //If a plugin, call its load method.
                    if (dep.prefix) {
                                                callPlugin(dep.prefix, context, {
                            name: "load",
                            args: [dep.name, context.contextName]
                        });
                                            } else {
                        req.load(dep.name, context.contextName);
                    }
                }
            }
        }
    };

        /**
     * Register a module that modifies another module. The modifier will
     * only be called once the target module has been loaded.
     *
     * First syntax:
     *
     * require.modify({
     *     "some/target1": "my/modifier1",
     *     "some/target2": "my/modifier2",
     * });
     *
     * With this syntax, the my/modifier1 will only be loaded when
     * "some/target1" is loaded.
     *
     * Second syntax, defining a modifier.
     *
     * require.modify("some/target1", "my/modifier",
     *                        ["some/target1", "some/other"],
     *                        function (target, other) {
     *                            //Modify properties of target here.
     *                            Only properties of target can be modified, but
     *                            target cannot be replaced.
     *                        }
     * );
     */
    req.modify = function (target, name, deps, callback, contextName) {
        var prop, modifier, list,
                cName = (typeof target === "string" ? contextName : name) || s.ctxName,
                context = s.contexts[cName],
                mods = context.modifiers;

        if (typeof target === "string") {
            //A modifier module.
            //First store that it is a modifier.
            list = mods[target] || (mods[target] = []);
            if (!list[name]) {
                list.push(name);
                list[name] = true;
            }

            //Trigger the normal module definition logic if the target
            //is already in the system.
            if (context.specified[target]) {
                req.def(name, deps, callback, contextName);
            } else {
                //Hold on to the execution/dependency checks for the modifier
                //until the target is fetched.
                (list.__deferMods || (list.__deferMods = [])).push([name, deps, callback, contextName]);
            }
        } else {
            //A list of modifiers. Save them for future reference.
            for (prop in target) {
                if (!(prop in empty)) {
                    //Store the modifier for future use.
                    modifier = target[prop];
                    list = mods[prop] || (context.modifiers[prop] = []);
                    if (!list[modifier]) {
                        list.push(modifier);
                        list[modifier] = true;

                        if (context.specified[prop]) {
                            //Load the modifier right away.
                            req([modifier], cName);
                        }
                    }
                }
            }
        }
    };
    
    req.isArray = function (it) {
        return ostring.call(it) === "[object Array]";
    };

    req.isFunction = isFunction;

    /**
     * Gets one module's exported value. This method is used by require().
     * It is broken out as a separate function to allow a host environment
     * shim to overwrite this function with something appropriate for that
     * environment.
     *
     * @param {String} moduleName the name of the module.
     * @param {String} [contextName] the name of the context to use. Uses
     * default context if no contextName is provided. You should never
     * pass the contextName explicitly -- it is handled by the require() code.
     * @param {String} [relModuleName] a module name to use for relative
     * module name lookups. You should never pass this argument explicitly --
     * it is handled by the require() code.
     *
     * @returns {Object} the exported module value.
     */
    req.get = function (moduleName, contextName, relModuleName) {
        if (moduleName === "require" || moduleName === "exports" || moduleName === "module") {
            req.onError(new Error("Explicit require of " + moduleName + " is not allowed."));
        }
        contextName = contextName || s.ctxName;

        var ret, context = s.contexts[contextName], nameProps;

        //Normalize module name, if it contains . or ..
        nameProps = req.splitPrefix(moduleName, relModuleName, context);

        ret = context.defined[nameProps.name];
        if (ret === undefined) {
            req.onError(new Error("require: module name '" +
                        moduleName +
                        "' has not been loaded yet for context: " +
                        contextName));
        }
        return ret;
    };

    /**
     * Makes the request to load a module. May be an async load depending on
     * the environment and the circumstance of the load call. Override this
     * method in a host environment shim to do something specific for that
     * environment.
     *
     * @param {String} moduleName the name of the module.
     * @param {String} contextName the name of the context to use.
     */
    req.load = function (moduleName, contextName) {
        var context = s.contexts[contextName],
            urlFetched = context.urlFetched,
            loaded = context.loaded, url;
        s.isDone = false;

        //Only set loaded to false for tracking if it has not already been set.
        if (!loaded[moduleName]) {
            loaded[moduleName] = false;
        }

        if (contextName !== s.ctxName) {
            //Not in the right context now, hold on to it until
            //the current context finishes all its loading.
            contextLoads.push(arguments);
        } else {
            //First derive the path name for the module.
            url = req.nameToUrl(moduleName, null, contextName);
            if (!urlFetched[url]) {
                context.scriptCount += 1;
                req.attach(url, contextName, moduleName);
                urlFetched[url] = true;

                //If tracking a jQuery, then make sure its readyWait
                //is incremented to prevent its ready callbacks from
                //triggering too soon.
                if (context.jQuery && !context.jQueryIncremented) {
                    context.jQuery.readyWait += 1;
                    context.jQueryIncremented = true;
                }
            }
        }
    };

    req.jsExtRegExp = /^\/|:|\?|\.js$/;

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @param {Object} context
     * @returns {String} normalized name
     */
    req.normalizeName = function (name, baseName, context) {
        //Adjust any relative paths.
        var part;
        if (name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                if (context.config.packages[baseName]) {
                    //If the baseName is a package name, then just treat it as one
                    //name to concat the name with.
                    baseName = [baseName];
                } else {
                    //Convert baseName to array, and lop off the last part,
                    //so that . matches that "directory" and not name of the baseName's
                    //module. For instance, baseName of "one/two/three", maps to
                    //"one/two/three.js", but we want the directory, "one/two" for
                    //this normalization.
                    baseName = baseName.split("/");
                    baseName = baseName.slice(0, baseName.length - 1);
                }

                name = baseName.concat(name.split("/"));
                for (i = 0; (part = name[i]); i++) {
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for '..'.
                            break;
                        } else if (i > 1) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                name = name.join("/");
            }
        }
        return name;
    };

    /**
     * Splits a name into a possible plugin prefix and
     * the module name. If baseName is provided it will
     * also normalize the name via require.normalizeName()
     * 
     * @param {String} name the module name
     * @param {String} [baseName] base name that name is
     * relative to.
     * @param {Object} context
     *
     * @returns {Object} with properties, 'prefix' (which
     * may be null), 'name' and 'fullName', which is a combination
     * of the prefix (if it exists) and the name.
     */
    req.splitPrefix = function (name, baseName, context) {
        var index = name.indexOf("!"), prefix = null;
        if (index !== -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }

        //Account for relative paths if there is a base name.
        name = req.normalizeName(name, baseName, context);

        return {
            prefix: prefix,
            name: name,
            fullName: prefix ? prefix + "!" + name : name
        };
    };

    /**
     * Start of a public API replacement for nameToUrl. For now, just leverage
     * nameToUrl, but know that nameToUrl will go away in the future.
     * moduleNamePlusExt is of format "some/module/thing.html". It only works
     * for module-like names and will not work with any dependency name in the
     * future (for instance, passing "http://a.com/some/thing.html" will not
     * make any sense)
     */
    //TODO: what does requ.toUrl("packageName") resolve to? base package
    //dir or lib? Probably base package dir.
    /*
    req.toUrl = function (moduleNamePlusExt, contextName, relModuleName) {
        var index = moduleNamePlusExt.lastIndexOf('.'),
            ext = null;

        if (index !== -1) {
            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
        }

        return req.nameToUrl(moduleNamePlusExt, ext, contextName, relModuleName);
    };
    */

    /**
     * Converts a module name to a file path.
     */
    req.nameToUrl = function (moduleName, ext, contextName, relModuleName) {
        var paths, packages, pkg, pkgPath, syms, i, parentModule, url,
            context = s.contexts[contextName],
            config = context.config;

        //Normalize module name if have a base relative module name to work from.
        moduleName = req.normalizeName(moduleName, relModuleName, context);

        //If a colon is in the URL, it indicates a protocol is used and it is just
        //an URL to a file, or if it starts with a slash or ends with .js, it is just a plain file.
        //The slash is important for protocol-less URLs as well as full paths.
        if (req.jsExtRegExp.test(moduleName)) {
            //Just a plain path, not module name lookup, so just return it.
            //Add extension if it is included. This is a bit wonky, only non-.js things pass
            //an extension, this method probably needs to be reworked.
            url = moduleName + (ext ? ext : "");
        } else {
            //A module that needs to be converted to a path.
            paths = config.paths;
            packages = config.packages;

            syms = moduleName.split("/");
            //For each module name segment, see if there is a path
            //registered for it. Start with most specific name
            //and work up from it.
            for (i = syms.length; i > 0; i--) {
                parentModule = syms.slice(0, i).join("/");
                if (paths[parentModule]) {
                    syms.splice(0, i, paths[parentModule]);
                    break;
                } else if ((pkg = packages[parentModule])) {
                    //pkg can have just a string value to the path
                    //or can be an object with props:
                    //main, lib, name, location.
                    pkgPath = pkg.location + '/' + pkg.lib;
                    //If module name is just the package name, then looking
                    //for the main module.
                    if (moduleName === pkg.name) {
                        pkgPath += '/' + pkg.main;
                    }
                    syms.splice(0, i, pkgPath);
                    break;
                }
            }

            //Join the path parts together, then figure out if baseUrl is needed.
            url = syms.join("/") + (ext || ".js");
            url = (url.charAt(0) === '/' || url.match(/^\w+:/) ? "" : config.baseUrl) + url;
        }
        return config.urlArgs ? url +
                                ((url.indexOf('?') === -1 ? '?' : '&') +
                                 config.urlArgs) : url;
    };

    //In async environments, checkLoaded can get called a few times in the same
    //call stack. Allow only one to do the finishing work. Set to false
    //for sync environments.
    req.blockCheckLoaded = true;

    /**
     * Checks if all modules for a context are loaded, and if so, evaluates the
     * new ones in right dependency order.
     *
     * @private
     */
    req.checkLoaded = function (contextName) {
        var context = s.contexts[contextName || s.ctxName],
                waitInterval = context.config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                loaded, defined = context.defined,
                modifiers = context.modifiers, waiting, noLoads = "",
                hasLoadedProp = false, stillLoading = false, prop,

                                pIsWaiting = s.plugins.isWaiting, pOrderDeps = s.plugins.orderDeps,
                
                i, module, allDone, loads, loadArgs, err;

        //If already doing a checkLoaded call,
        //then do not bother checking loaded state.
        if (context.isCheckLoaded) {
            return;
        }

        //Determine if priority loading is done. If so clear the priority. If
        //not, then do not check
        if (context.config.priorityWait) {
            if (isPriorityDone(context)) {
                //Call resume, since it could have
                //some waiting dependencies to trace.
                resume(context);
            } else {
                return;
            }
        }

        //Signal that checkLoaded is being require, so other calls that could be triggered
        //by calling a waiting callback that then calls require and then this function
        //should not proceed. At the end of this function, if there are still things
        //waiting, then checkLoaded will be called again.
        context.isCheckLoaded = req.blockCheckLoaded;

        //Grab waiting and loaded lists here, since it could have changed since
        //this function was first called.
        waiting = context.waiting;
        loaded = context.loaded;

        //See if anything is still in flight.
        for (prop in loaded) {
            if (!(prop in empty)) {
                hasLoadedProp = true;
                if (!loaded[prop]) {
                    if (expired) {
                        noLoads += prop + " ";
                    } else {
                        stillLoading = true;
                        break;
                    }
                }
            }
        }

        //Check for exit conditions.
        if (!hasLoadedProp && !waiting.length
                        && (!pIsWaiting || !pIsWaiting(context))
                       ) {
            //If the loaded object had no items, then the rest of
            //the work below does not need to be done.
            context.isCheckLoaded = false;
            return;
        }
        if (expired && noLoads) {
            //If wait time expired, throw error of unloaded modules.
            err = new Error("require.js load timeout for modules: " + noLoads);
            err.requireType = "timeout";
            err.requireModules = noLoads;
            req.onError(err);
        }
        if (stillLoading) {
            //Something is still waiting to load. Wait for it.
            context.isCheckLoaded = false;
            if (isBrowser || isWebWorker) {
                setTimeout(function () {
                    req.checkLoaded(contextName);
                }, 50);
            }
            return;
        }

        //Order the dependencies. Also clean up state because the evaluation
        //of modules might create new loading tasks, so need to reset.
        //Be sure to call plugins too.
        context.waiting = [];
        context.loaded = {};

                //Call plugins to order their dependencies, do their
        //module definitions.
        if (pOrderDeps) {
            pOrderDeps(context);
        }
        
                //Before defining the modules, give priority treatment to any modifiers
        //for modules that are already defined.
        for (prop in modifiers) {
            if (!(prop in empty)) {
                if (defined[prop]) {
                    req.execModifiers(prop, {}, waiting, context);
                }
            }
        }
        
        //Define the modules, doing a depth first search.
        for (i = 0; (module = waiting[i]); i++) {
            req.exec(module, {}, waiting, context);
        }

        //Indicate checkLoaded is now done.
        context.isCheckLoaded = false;

        if (context.waiting.length
                        || (pIsWaiting && pIsWaiting(context))
                       ) {
            //More things in this context are waiting to load. They were probably
            //added while doing the work above in checkLoaded, calling module
            //callbacks that triggered other require calls.
            req.checkLoaded(contextName);
        } else if (contextLoads.length) {
            //Check for other contexts that need to load things.
            //First, make sure current context has no more things to
            //load. After defining the modules above, new require calls
            //could have been made.
            loaded = context.loaded;
            allDone = true;
            for (prop in loaded) {
                if (!(prop in empty)) {
                    if (!loaded[prop]) {
                        allDone = false;
                        break;
                    }
                }
            }

            if (allDone) {
                s.ctxName = contextLoads[0][1];
                loads = contextLoads;
                //Reset contextLoads in case some of the waiting loads
                //are for yet another context.
                contextLoads = [];
                for (i = 0; (loadArgs = loads[i]); i++) {
                    req.load.apply(req, loadArgs);
                }
            }
        } else {
            //Make sure we reset to default context.
            s.ctxName = defContextName;
            s.isDone = true;
            if (req.callReady) {
                req.callReady();
            }
        }
    };

    /**
     * Helper function that creates a setExports function for a "module"
     * CommonJS dependency. Do this here to avoid creating a closure that
     * is part of a loop in require.exec.
     */
    function makeSetExports(moduleObj) {
        return function (exports) {
            moduleObj.exports = exports;
        };
    }

    function makeContextModuleFunc(name, contextName, moduleName) {
        return function () {
            //A version of a require function that forces a contextName value
            //and also passes a moduleName value for items that may need to
            //look up paths relative to the moduleName
            var args = [].concat(aps.call(arguments, 0));
            args.push(contextName, moduleName);
            return (name ? require[name] : require).apply(null, args);
        };
    }

    /**
     * Helper function that creates a require function object to give to
     * modules that ask for it as a dependency. It needs to be specific
     * per module because of the implication of path mappings that may
     * need to be relative to the module name.
     */
    function makeRequire(context, moduleName) {
        var contextName = context.contextName,
            modRequire = makeContextModuleFunc(null, contextName, moduleName);

        req.mixin(modRequire, {
                        modify: makeContextModuleFunc("modify", contextName, moduleName),
                        def: makeContextModuleFunc("def", contextName, moduleName),
            get: makeContextModuleFunc("get", contextName, moduleName),
            nameToUrl: makeContextModuleFunc("nameToUrl", contextName, moduleName),
            toUrl: makeContextModuleFunc("toUrl", contextName, moduleName),
            ready: req.ready,
            context: context,
            config: context.config,
            isBrowser: s.isBrowser
        });
        return modRequire;
    }

    /**
     * Executes the modules in the correct order.
     * 
     * @private
     */
    req.exec = function (module, traced, waiting, context) {
        //Some modules are just plain script files, abddo not have a formal
        //module definition, 
        if (!module) {
            //Returning undefined for Spidermonky strict checking in Komodo
            return undefined;
        }

        var name = module.name, cb = module.callback, deps = module.deps, j, dep,
            defined = context.defined, ret, args = [], depModule, cjsModule,
            usingExports = false, depName;

        //If already traced or defined, do not bother a second time.
        if (name) {
            if (traced[name] || name in defined) {
                return defined[name];
            }

            //Mark this module as being traced, so that it is not retraced (as in a circular
            //dependency)
            traced[name] = true;
        }

        if (deps) {
            for (j = 0; (dep = deps[j]); j++) {
                depName = dep.name;
                if (depName === "require") {
                    depModule = makeRequire(context, name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    depModule = defined[name] = {};
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = depModule = {
                        id: name,
                        uri: name ? req.nameToUrl(name, null, context.contextName) : undefined
                    };
                    cjsModule.setExports = makeSetExports(cjsModule);
                } else {
                    //Get dependent module. It could not exist, for a circular
                    //dependency or if the loaded dependency does not actually call
                    //require. Favor not throwing an error here if undefined because
                    //we want to allow code that does not use require as a module
                    //definition framework to still work -- allow a web site to
                    //gradually update to contained modules. That is more
                    //important than forcing a throw for the circular dependency case.
                    depModule = depName in defined ? defined[depName] : (traced[depName] ? undefined : req.exec(waiting[waiting[depName]], traced, waiting, context));
                }

                args.push(depModule);
            }
        }

        //Call the callback to define the module, if necessary.
        cb = module.callback;
        if (cb && req.isFunction(cb)) {
            ret = req.execCb(name, cb, args);
            if (name) {
                //If using exports and the function did not return a value,
                //and the "module" object for this definition function did not
                //define an exported value, then use the exports object.
                if (usingExports && ret === undefined && (!cjsModule || !("exports" in cjsModule))) {
                    ret = defined[name];
                } else {
                    if (cjsModule && "exports" in cjsModule) {
                        ret = defined[name] = cjsModule.exports;
                    } else {
                        if (name in defined && !usingExports) {
                            req.onError(new Error(name + " has already been defined"));
                        }
                        defined[name] = ret;
                    }
                }
            }
        }

                //Execute modifiers, if they exist.
        req.execModifiers(name, traced, waiting, context);
        
        return ret;
    };

    /**
     * Executes a module callack function. Broken out as a separate function
     * solely to allow the build system to sequence the files in the built
     * layer in the right sequence.
     * @param {String} name the module name.
     * @param {Function} cb the module callback/definition function.
     * @param {Array} args The arguments (dependent modules) to pass to callback.
     *
     * @private
     */
    req.execCb = function (name, cb, args) {
        return cb.apply(null, args);
    };

        /**
     * Executes modifiers for the given module name.
     * @param {String} target
     * @param {Object} traced
     * @param {Object} context
     *
     * @private
     */
    req.execModifiers = function (target, traced, waiting, context) {
        var modifiers = context.modifiers, mods = modifiers[target], mod, i;
        if (mods) {
            for (i = 0; i < mods.length; i++) {
                mod = mods[i];
                //Not all modifiers define a module, they might collect other modules.
                //If it is just a collection it will not be in waiting.
                if (mod in waiting) {
                    req.exec(waiting[waiting[mod]], traced, waiting, context);
                }
            }
            delete modifiers[target];
        }
    };
    
    /**
     * callback for script loads, used to check status of loading.
     *
     * @param {Event} evt the event from the browser for the script
     * that was loaded.
     *
     * @private
     */
    req.onScriptLoad = function (evt) {
        //Using currentTarget instead of target for Firefox 2.0's sake. Not
        //all old browsers will be supported, but this one was easy enough
        //to support and still makes sense.
        var node = evt.currentTarget || evt.srcElement, contextName, moduleName,
            context;
        if (evt.type === "load" || readyRegExp.test(node.readyState)) {
            //Pull out the name of the module and the context.
            contextName = node.getAttribute("data-requirecontext");
            moduleName = node.getAttribute("data-requiremodule");
            context = s.contexts[contextName];

            req.completeLoad(moduleName, context);

            //Clean up script binding.
            if (node.removeEventListener) {
                node.removeEventListener("load", req.onScriptLoad, false);
            } else {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                node.detachEvent("onreadystatechange", req.onScriptLoad);
            }
        }
    };

    /**
     * Attaches the script represented by the URL to the current
     * environment. Right now only supports browser loading,
     * but can be redefined in other environments to do the right thing.
     * @param {String} url the url of the script to attach.
     * @param {String} contextName the name of the context that wants the script.
     * @param {moduleName} the name of the module that is associated with the script.
     * @param {Function} [callback] optional callback, defaults to require.onScriptLoad
     * @param {String} [type] optional type, defaults to text/javascript
     */
    req.attach = function (url, contextName, moduleName, callback, type) {
        var node, loaded, context;
        if (isBrowser) {
            //In the browser so use a script tag
            callback = callback || req.onScriptLoad;
            node = document.createElement("script");
            node.type = type || "text/javascript";
            node.charset = "utf-8";
            //Use async so Gecko does not block on executing the script if something
            //like a long-polling comet tag is being run first. Gecko likes
            //to evaluate scripts in DOM order, even for dynamic scripts.
            //It will fetch them async, but only evaluate the contents in DOM
            //order, so a long-polling script tag can delay execution of scripts
            //after it. But telling Gecko we expect async gets us the behavior
            //we want -- execute it whenever it is finished downloading. Only
            //Helps Firefox 3.6+
            //Allow some URLs to not be fetched async. Mostly helps the order!
            //plugin
            node.async = !s.skipAsync[url];

            node.setAttribute("data-requirecontext", contextName);
            node.setAttribute("data-requiremodule", moduleName);

            //Set up load listener.
            if (node.addEventListener) {
                node.addEventListener("load", callback, false);
            } else {
                //Probably IE. If not it will throw an error, which will be
                //useful to know. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous require.def call to a name.
                //However, IE reports the script as being in "interactive"
                //readyState at the time of the require.def call.
                useInteractive = true;
                node.attachEvent("onreadystatechange", callback);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous require.def
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                s.head.insertBefore(node, baseElement);
            } else {
                s.head.appendChild(node);
            }
            currentlyAddingScript = null;
            return node;
        } else if (isWebWorker) {
            //In a web worker, use importScripts. This is not a very
            //efficient use of importScripts, importScripts will block until
            //its script is downloaded and evaluated. However, if web workers
            //are in play, the expectation that a build has been done so that
            //only one script needs to be loaded anyway. This may need to be
            //reevaluated if other use cases become common.
            context = s.contexts[contextName];
            loaded = context.loaded;
            loaded[moduleName] = false;

            importScripts(url);

            //Account for anonymous modules
            req.completeLoad(moduleName, context);
        }
        return null;
    };

    //Determine what baseUrl should be if not already defined via a require config object
    s.baseUrl = cfg.baseUrl;
    if (isBrowser && (!s.baseUrl || !s.head)) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        scripts = document.getElementsByTagName("script");
        if (cfg.baseUrlMatch) {
            rePkg = cfg.baseUrlMatch;
        } else {
            
            
            
                        rePkg = /(allplugins-)?require\.js(\W|$)/i;
            
                    }

        for (i = scripts.length - 1; i > -1 && (script = scripts[i]); i--) {
            //Set the "head" where we can append children by
            //using the script's parent.
            if (!s.head) {
                s.head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load.
            if (!dataMain && (dataMain = script.getAttribute('data-main'))) {
                cfg.deps = cfg.deps ? cfg.deps.concat(dataMain) : [dataMain];

                //Favor using data-main tag as the base URL instead of
                //trying to pattern-match src values.
                if (!cfg.baseUrl && (src = script.src)) {
                    src = src.split('/');
                    src.pop();
                    //Make sure current config gets the value.
                    s.baseUrl = cfg.baseUrl = src.length ? src.join('/') : './';
                }
            }

            //Using .src instead of getAttribute to get an absolute URL.
            //While using a relative URL will be fine for script tags, other
            //URLs used for text! resources that use XHR calls might benefit
            //from an absolute URL.
            if (!s.baseUrl && (src = script.src)) {
                m = src.match(rePkg);
                if (m) {
                    s.baseUrl = src.substring(0, m.index);
                    break;
                }
            }
        }
    }

        //****** START page load functionality ****************
    /**
     * Sets the page as loaded and triggers check for all modules loaded.
     */
    req.pageLoaded = function () {
        if (!s.isPageLoaded) {
            s.isPageLoaded = true;
            if (scrollIntervalId) {
                clearInterval(scrollIntervalId);
            }

            //Part of a fix for FF < 3.6 where readyState was not set to
            //complete so libraries like jQuery that check for readyState
            //after page load where not getting initialized correctly.
            //Original approach suggested by Andrea Giammarchi:
            //http://webreflection.blogspot.com/2009/11/195-chars-to-help-lazy-loading.html
            //see other setReadyState reference for the rest of the fix.
            if (setReadyState) {
                document.readyState = "complete";
            }

            req.callReady();
        }
    };

    /**
     * Internal function that calls back any ready functions. If you are
     * integrating RequireJS with another library without require.ready support,
     * you can define this method to call your page ready code instead.
     */
    req.callReady = function () {
        var callbacks = s.readyCalls, i, callback, contexts, context, prop;

        if (s.isPageLoaded && s.isDone) {
            if (callbacks.length) {
                s.readyCalls = [];
                for (i = 0; (callback = callbacks[i]); i++) {
                    callback();
                }
            }

            //If jQuery with readyWait is being tracked, updated its
            //readyWait count.
            contexts = s.contexts;
            for (prop in contexts) {
                if (!(prop in empty)) {
                    context = contexts[prop];
                    if (context.jQueryIncremented) {
                        context.jQuery.readyWait -= 1;
                        context.jQueryIncremented = false;
                    }
                }
            }
        }
    };

    /**
     * Registers functions to call when the page is loaded
     */
    req.ready = function (callback) {
        if (s.isPageLoaded && s.isDone) {
            callback();
        } else {
            s.readyCalls.push(callback);
        }
        return req;
    };

    if (isBrowser) {
        if (document.addEventListener) {
            //Standards. Hooray! Assumption here that if standards based,
            //it knows about DOMContentLoaded.
            document.addEventListener("DOMContentLoaded", req.pageLoaded, false);
            window.addEventListener("load", req.pageLoaded, false);
            //Part of FF < 3.6 readystate fix (see setReadyState refs for more info)
            if (!document.readyState) {
                setReadyState = true;
                document.readyState = "loading";
            }
        } else if (window.attachEvent) {
            window.attachEvent("onload", req.pageLoaded);

            //DOMContentLoaded approximation, as found by Diego Perini:
            //http://javascript.nwbox.com/IEContentLoaded/
            if (self === self.top) {
                scrollIntervalId = setInterval(function () {
                    try {
                        //From this ticket:
                        //http://bugs.dojotoolkit.org/ticket/11106,
                        //In IE HTML Application (HTA), such as in a selenium test,
                        //javascript in the iframe can't see anything outside
                        //of it, so self===self.top is true, but the iframe is
                        //not the top window and doScroll will be available
                        //before document.body is set. Test document.body
                        //before trying the doScroll trick.
                        if (document.body) {
                            document.documentElement.doScroll("left");
                            req.pageLoaded();
                        }
                    } catch (e) {}
                }, 30);
            }
        }

        //Check if document already complete, and if so, just trigger page load
        //listeners. NOTE: does not work with Firefox before 3.6. To support
        //those browsers, manually call require.pageLoaded().
        if (document.readyState === "complete") {
            req.pageLoaded();
        }
    }
    //****** END page load functionality ****************
    
    //Set up default context. If require was a configuration object, use that as base config.
    req(cfg);

    //If modules are built into require.js, then need to make sure dependencies are
    //traced. Use a setTimeout in the browser world, to allow all the modules to register
    //themselves. In a non-browser env, assume that modules are not built into require.js,
    //which seems odd to do on the server.
    if (typeof setTimeout !== "undefined") {
        setTimeout(function () {
            var ctx = s.contexts[(cfg.context || defContextName)];
            //Allow for jQuery to be loaded/already in the page, and if jQuery 1.4.3,
            //make sure to hold onto it for readyWait triggering.
            jQueryCheck(ctx);
            resume(ctx);
        }, 0);
    }
}());

/*global require */
require.def('gma/constants',
    [],
    function() {
        
        /** @module gma */
        
        /**
         * Provides some constants
         * @instantiated
         * @class constants
        */
        return function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////
    
    /**
     * Movement -- Jumping
     * @property JUMPING
     * @type String
     * @final
    */
    self.JUMPING    = "gma_j";
    
    /**
     * Movement -- Falling
     * @property FALLING
     * @type String
     * @final
    */
    self.FALLING    = "gma_f";
    
    /**
     * Movement -- Still
     * @property STILL
     * @type String
     * @final
    */
    self.STILL    = "gma_s";

    /**
     * Direction -- Left
     * @property LEFT
     * @type String
     * @final
    */
    self.LEFT    = "gma_l";

    /**
     * Direction -- Right
     * @property RIGHT
     * @type String
     * @final
    */
    self.RIGHT    = "gma_r";

    /**
     * Direction -- Top
     * @property TOP
     * @type String
     * @final
    */
    self.TOP    = "gma_t";

    /**
     * Direction -- Bottom
     * @property BOTTOM
     * @type String
     * @final
    */
    self.BOTTOM    = "gma_b";

    /**
     * Acceleration -- Gravity
     * @property GRAVITY
     * @type String
     * @final
    */
    self.GRAVITY    = -0.5;

    
///////////////////////////////////////////////////////////////////////////////

            return self;
        
        }();
    }
);
//#JSCOVERAGE_IF 0
/*global require, $, window, _, JSpec, console */
require.def('gma/base', 
    ['gma/constants', 'gma/convenience'], 
    function(constants) {
        var self = {};
        window.gma = self;
        self.constants = constants;
        
        /**
        * The gma namespace holds everything
        * @class gma 
        */

        /**
         * Object for logging stuff to
         * We use this so that we don't get errors when there is no console
         * @property logger
         * @default console
        */
        self.logger = console;

        /**
         * Inserts a javascript script tag into the document with the specified text
         * @method insertScript
         * @param string {String} text to put inside the new script tag
        */
        self.insertScript = function(string) {
            $("head").append("<script type='text/javascript'>"+string+"</script>");
        };

        /**
         * Inserts a javascript tag containing a preprocessed test
         * @method test
         * @param location {String} Location of the test to run
         * @param jingoName {String} Name to use in the jingo.declare block that is created around the test
        */
        self.test = function(location, jingoName) {
            var raw = JSpec.load(location);
            if (jingoName) {
                raw = raw.replace("require(", 'require.def("' + jingoName + '", ');
            }

            self.insertScript(JSpec.preprocess(raw));
        };

        /**
         * Convenience function for examples to show some instruction text and be able to toggle it
         * @method instructions
         * @param hud {:api:`gma.hud`} Hud to display message with
         * @param msg {String} The message to display
         * @param key {Number} Key to use to toggle message
         * @param display {Boolean} Specify whether to display straight away
        */
        self.instructions = function(hud, msg, key, display, level) {
            if (display === undefined) {
                display = true;
            }
            
            if (display) {
                hud.displayMessage(msg)
            }
            
            if (key) {
                var infoToggle = function() {
                    var state = false;
                    return function(e, force) {
                        if (e.type==="keydown") {
                            if (force) {
                                state = true;
                            }
                            if (state) {
                                if (level === undefined || manager.levelIndex === level) {
                                    manager.hud.displayMessage(msg);
                                }
                                state = false;
                            }
                            else {
                                manager.hud.hideMessage();
                                state = true;
                            }
                        }
                    };
                }();
                
                gma.keyHandler.register(key, infoToggle);
            }
            return infoToggle;
        };
        
        
        return self;
    }
);
//#JSCOVERAGE_ENDIF
/*global require, _, JSpec */
//#JSCOVERAGE_IF 0
require.def('gma/convenience',
    [],
    function(gma) {
        
///////////////////////////////////////////////////////////////////////////////
////// PROVIDES OVERIDES ON PROTOTYPES
// Some convenience methods borrowed from "JavaScript: The Good Parts"
// A book written by Douglas Crockford and published by O'Reilly Media

if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        var F = function () {};
        F.prototype = o;
        return new F();
    };
}

Function.prototype.method = function (name, func)
{
    this.prototype[name] = func;
    return this;
};

Function.method('bind',
    function (that)
    {
        // Return a function that will call this function as
        // though it is a method of that object.
        var slice  = Array.prototype.slice;
        var args   = slice.apply(arguments, [1]);
        var method = this;
        
        return function ( )
        {
            return method.apply(that,
                args.concat(slice.apply(arguments, [0]))
            );
        };
    }
);

Function.method('curry',
    function ( )
    {
        var that  = this;
        var slice = Array.prototype.slice;
        var args  = slice.apply(arguments);
        
        return function ( )
        {
            return that.apply(null, args.concat(slice.apply(arguments)));
        };
    }
);

Object.method('superior',
    function (name)
    {
        var that = this;
        var method = that[name];
        return function()
        {
            return method.apply(that, arguments);
        };
    }
);

RegExp.method('test',
    function (string)
    {
        return this.exec(string) !== null;
    }
);

Number.method('integer',
    function ( )
    {
        return Math[this < 0 ? 'ceil' : 'floor'](this);
    }
);


String.method('charAt',
    function (pos)
    {
        return this.slice(pos, pos + 1);
    }
);

String.method('trim',
    function ( )
    {
        return this.replace(/^\s+|\s+$/g, '');
    }
);


String.method('entityify',
    function ( )
    {
        var character = {
            '<' : '&lt;',
            '>' : '&gt;',
            '&' : '&amp;',
            '"' : '&quot;'
        };
        
        return function ( )
        {
            return this.replace(/[<>&"]/g,
                function (c)
                {
                    return character[c];
                }
            );
        };
    }( )
);

String.method('deentityify',
    function ( )
    {
        var entity = {
            quot: '"',
            lt:   '<',
            gt:   '>'
        };
        
        return function ( )
        {
            return this.replace(/&([^&;]+);/g,
                function (a, b)
                {
                    var r = entity[b];
                    return typeof r === 'string' ? r : a;
                }
            );
        };
    }()
);

Array.method('pop',
    function ( )
    {
        return this.splice(this.length - 1, 1)[0];
    }
);

Array.method('push',
    function ( )
    {
        this.splice.apply(
            this,
            [this.length, 0].concat(Array.prototype.slice.apply(arguments))
        );
        return this.length;
    }
);

Array.method('shift',
    function ()
    {
        return this.splice(0, 1)[0];
    }
);

Array.method('unshift',
    function ( )
    {
        this.splice.apply(this,
            [0, 0].concat(Array.prototype.slice.apply(arguments))
        );
        return this.length;
    }
);

Array.method('splice',
    function (start, deleteCount)
    {
    
        var delta;
        var element;
        var newLen;
        var shiftCount;
        
        var k           = 0;
        var max         = Math.max;
        var min         = Math.min;
        var len         = this.length;
        var result      = [];
        var insertCount = max(arguments.length - 2, 0);
        
        start = start || 0;
        if (start < 0) {
            start += len;
        }
        start = max(min(start, len), 0);
        
        deleteCount = max(
            min(
                typeof deleteCount === 'number' ? deleteCount : len, len - start
            ), 0
        );
        
        delta = insertCount - deleteCount;
        newLen = len + delta;
        
        while (k < deleteCount)
        {
            element = this[start + k];
            if (element !== undefined)
            {
                result[k] = element;
            }
            k += 1;
        }
        
        shiftCount = len - start - deleteCount;
        
        if (delta < 0)
        {
            k = start + insertCount;
            while (shiftCount)
            {
                this[k] = this[k - delta];
                k += 1;
                shiftCount -= 1;
            }
            this.length = newLen;
        }
        else if (delta > 0)
        {
            k = 1;
            while (shiftCount)
            {
                this[newLen - k] = this[len - k];
                k += 1;
                shiftCount -= 1;
            }
        }
        
        for (k = 0; k < insertCount; k += 1)
        {
            this[start + k] = arguments[k + 2];
        }
        
        return result;
    }
);

///////////////////////////////////////////////////////////////////////////////

    }
);
//#JSCOVERAGE_ENDIF
/*global require, _, $ */
require.def('gma/events',
    ['gma/base'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides key event handling
         * @instantiated
         * @class keyHandler
        */
        gma.keyHandler = function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a dictionary of keycode : array
     * The array holds functions which are called when the corresponding keycode is triggered
     * @private
     * @property handlers
     * @type Dictionary
    */
    var handlers = {};
    
    /**
     * Determines what functions should be called when a keypress event is triggered
     * @param e {Event} The event that has been triggered
     * @method keyCheck
    */
    self.keyCheck = function(e) {
        var code = e.which || e.keyCode;
        
        if (handlers[code]) {
            _.each(handlers[code], function(func) {
                func(e);
            });
        }
    };
    
    //Make keyCheck get called whenever a key is pressed
    $(document).keydown(self.keyCheck);
    $(document).keyup(self.keyCheck);
    
    /**
     * Allows you to register a function to a keyCode
     * @param keyCode {Number or Character} The keycode that triggers this function
     * @param func {Function} Function to call when we have this event
     * @method register
    */
    self.register = function(keyCode, func) {
        if ((_.isString(keyCode) && keyCode.length > 1) || (!_.isString(keyCode) && !_.isNumber(keyCode))) {
            throw new Error("Can only register keycodes or characters");
        }
        
        if (_.isString(keyCode)) {
            keyCode = keyCode.charCodeAt(0);
        }
        
        if (!handlers[keyCode]) {
            handlers[keyCode] = [];
        }
        
        handlers[keyCode].push(func);
    };
    
    /**
     * Tells you how many functions you have registered for provided keyCode
     * If no keycode is given, then it tells you total functions you have registered
     * @param keyCode {Number or Character} The keycode you want to inspect
     * @method numEvents
    */
    self.numEvents = function(keyCode) {
        if (keyCode) {
            if (handlers[keyCode]) {
                return handlers[keyCode].length;
            }
            return 0;
        }
        else {
            return _.flatten(handlers).length;
        }
    };
    
    /**
     * Unregisters everything
     * @method reset
    */
    self.reset = function() {
        handlers = {};
    };
            
///////////////////////////////////////////////////////////////////////////////

            return self;
        
        }();
    }
);
/*globals require */
require.def('gma/entities/base', 
    ['gma/base'], 
    function(gma) { 
        gma.entities = gma.entities || {};
    }
);
/*global require */
require.def('gma/entities/platform',
    ['gma/base', 'gma/entities/base', 'gma/entities/shapes', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a base platform object
     * @class platform
     * @extends gma.shapes.rectangle
    */
    gma.platform = function(spec) {
    
        var self = gma.shapes.rectangle(spec || {x:0, y:0, width:1, height:1});
        if (!self) {throw new Error("Can't create rectangle for platform");}

        /** @tag platform */
        self.tags.platform = true;

        /** 
        * Does super.collided checks and also looks for the deathtouch tag
        * @method collided 
        */
        var oldCollided = self.collided;
        self.collided = function() {
            oldCollided.apply(this, arguments);
            if (self.tags.deathtouch) {
                self.collided__deathtouch.apply(this, arguments);
            }
        };

        return self;
    
    };
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a death platform object
     * @class deathPlatform
     * @extends gma.platform
    */
    gma.deathPlatform = function(spec) {
    
        var self = gma.platform(spec);

        /** @tag deathtouch */
        self.tags.deathtouch = true;
        
        return self;
    };
    
///////////////////////////////////////////////////////////////////////////////

    }
);
/*global require, $, _, window, setTimeout*/
require.def('gma/manager',
    [
        'gma/base', 
        'gma/entities/platform', 
        'gma/utils/hud', 
        'gma/utils/render',
        'gma/utils/parser'
    ],
    function(gma) {
    
        /** 
         * Everything resides under the gma namespace
         * @module gma 
        */
        
        /**
         * Provides basic setup functionality
         * @class manager
        */
        gma.manager = function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////
    
    /**######################
    ###
    ###   CANVAS/CONTAINER
    ###
    ######################*/
    
    /**
     * Holds the width of the canvas
     * @property width
     * @type Number
     * @default 800
    */
    self.width = self.width || 800;
    
    /**
     * Holds the height of the canvas
     * @property height
     * @type Number
     * @default 600
    */
    self.height = self.height || 600;
    
    /**
     * Id for the gamma div
     * @property containerID
     * @type String
     * @default "gamma"
    */
    self.containerID = self.containerID || "gamma";

    /**
     * The gamma div
     * @property container
     * @type Element
     * @default $("#gamma")
    */
    self.container = self.container || $("#"+self.containerID);
    self.container.css({'width': self.width, 'height': self.height});
    
    /**
     * Holds the canvas
     * @property canvas
     * @type DOM Element
    */
    self.canvas = self.canvas || function() {
        var canvas = self.container.find("canvas");
        if (canvas.length === 0) {
            self.container.html('<canvas id="theCanvas" height="'+self.height+'" width="'+self.width+'"></canvas>');
            canvas = self.container.find("canvas");
        }
        return canvas[0];
    }();    
    
    /**######################
    ###
    ###   RENDERING
    ###
    ######################*/
    
    /**
     * Helper object connecting manager to rendering library
     * @property sceneHelper
     * @type :api:`gma.sceneHelper`
    */
    self.sceneHelper = self.sceneHelper || gma.sceneHelper();
    
    /**
     * List of resources to give the renderer
     * @property resources
     * @type [String]
    */
    self.resources = self.resources || [];
    
    /**######################
    ###
    ###   OTHER
    ###
    ######################*/

    /**
     * The manager's levelParser object
     * @property levelParser
     * @type :api:`gma.levelParser`
    */
    self.levelParser = self.levelParser || gma.levelParser();

    /**
     * Holds the level specs
     * @property levels
     * @type List
     * @default []
    */
    self.levels = self.levels || [];

    /**
     * Holds the level index. (a level must be loaded first for it to be accurate)
     * @property levelIndex
     * @type Number
     * @default 0
    */
    self.levelIndex = self.levelIndex || 0;
    
    /**
     * Holds the hud
     * @property hud
     * @type :api:`gma.hud`
    */
    self.hud = self.hud || gma.hud({
        canvasContainer: self.container
    });
    
    /**
     * Specifies whether it should display a loading message
     * @property showLoading
     * @type Boolean
     * @default true
    */
    if (self.showLoading !== false) {
        self.showLoading = true;
    }
    
    if (self.showLoading) {
        self.hud.displayMessage("Loading...", 500);
    }
    
    /**
     * Holds a character object
     * This is optional
     * @property character
     * @type :api:`gma.character`
     * @default undefined
    */
    
    /**######################
    ###
    ###   PRIVATE
    ###
    ######################*/
    
    /**
     * Holds the last time scene was rendered
     * @private
     * @property time
     * @type Number
    */
    var time;
    
    /**
     * Holds an accumulation of time to be used for fps calculation
     * @private
     * @property counter
     * @type Number
     * @default 0
    */
    var counter = 0;
    
    /**
     * Holds the frames per second
     * @private
     * @property fps
     * @type Number
     * @default 0
    */
    var fps = 0;
    
    /**
     * Number of times the scene has twitched since fps last calculated
     * @private
     * @property twitchCount
     * @type Number
     * @default 0
    */
    var twitchCount = 0;
    
    /**######################
    ###
    ###   GETTERS
    ###
    ######################*/
    
    /**
     * Get the current FPS
     * @method getFPS
     * @return {Number}
    */
    self.getFPS = self.getFPS || function() {
        return fps;
    };

    /**
     * Returns a list of all background
     * @method background
     * @return {Array}
    */
    self.background = self.background || function() {
        if (self.sceneHelper && self.sceneHelper.background) {
            return self.sceneHelper.background;
        }
        else {
            return [];
        }
    };

    /**
     * Returns a list of all entities in the current level
     * @method entities
     * @return {Array}
    */
    self.entities = self.entities || function() {
        if (self.currentLevel) {
            if (self.character && self.character.alive) {
                return _.flatten([self.currentLevel.entities, self.character]);
            }
            else {
                return self.currentLevel.entities;
            }
        }
        else {
            return [];
        }
    };

    /**
     * Returns a gamma object given the type given
     * If type is a string, then we look on gma to see if it exists
     * Otherwise it is used as is
     * And any options supplied in the opts object is applied to this object
     * @method determineObject
     * @param type {Gamma Object or string} Name of a gamma object or just a gamma object
     * @param opts {Gamma Object or string} Name of a gamma object or just a gamma object
     * @return {Gamma Object}
    */
    self.determineObject = self.determineObject || function(type, opts) {
        if (_.isString(type)) {
            var obj = gma[type];
            if (obj) {
                type = gma[type](opts);
            }
            else {
                throw new Error("No such object as gma." + type);
            }
        }
        else {
            if (opts) {
                _.each(opts, function(value, key) {
                    type[key] = value;
                });
            }
        }
        return type;
    };

    /**
     * Attaches renderHelper and renderTemplate to the gamma object given
     * Also applies any extra options to this Gamma object
     * @method prepareEntity
     * @param focus {Gamma Object} Gamma object
     * @param template {renderTemplate} A renderTemplate object to be given to the gamma object
     * @param opts {{}} Options to be applied to the gamma object
     * @return {Gamma Object}
    */
    self.prepareEntity = self.prepareEntity || function(focus, template, opts) {
        if (opts) {
            _.each(opts, function(value, key) {
                focus[key] = value;
            });
        }
        
        focus.helper = gma.renderHelper({template : template || gma.unitCube});
        focus.helper.template.sceneHelper = self.sceneHelper;
        focus.helper.attachTo(focus);
        return focus;        
    };
    
    /**######################
    ###
    ###   LEVEL STUFF
    ###
    ######################*/
    
    /**
     * Gives an object othe levelParser to process, without storing the result anywhere
     * Useful for giving the levelParser type and template specifications
     * Which end up stored on the levelParser
     * @method addCustomDefinitions
     * @param opts {Object} Options that are given to the levelParser
    */
    self.addCustomDefinitions = self.addCustomDefinitions || function(opts) {
        self.levelParser.process(self, opts);
    }
    
    /**
     * Stores level specifications on the manager
     * @method storeLevels
     * @param levels {Array} A list of level objets to store
     * @param replaceAll {Boolean} Flag specifying whether to replace all current levels
    */
    self.storeLevels = self.storeLevels || function(levels, replaceAll) {
        if (replaceAll) {
            self.levels = [];
        } 
        
        if (!_.isArray(levels)) {
            levels = [levels];
        }
        
        self.levels = _.flatten([self.levels, levels]);
    };

    /**
     * Will load the specified level into the manager
     * Or the first level in self.levels if no level is specified
     * Or complain if manager has no stored levels
     * It will also remove any current levels in the manager
     * And set the position of the character according to the spawn location specified
     * @method loadLevel
     * @param level {Number} The index of the level to load
     * @param spawnId {String} Id of the spawn location for character
    */
    self.loadLevel = self.loadLevel || function(level, spawnId) {
        if (!self.levelParser) {
            throw new Error("The manager must be given a level parser object before it can load a level");
        }
        
        if (!_.isArray(self.levels) || self.levels.length === 0) {
            throw new Error("You must call storeLevels on the manager first before you can load any level");
        }
        
        if (level > self.levels.length-1) {
            throw new Error("No level at index " + level + ", manager only has " + self.levels.length + " levels");
        }
        
        // Clear the current level
        self.clearLevel();
        
        // Make sure we have somewhere to spawn
        if (!spawnId) {
            spawnId = 'main';
        }
        
        //make sure we have a level number
        level = self.levelIndex = level || 0;
        
        //Process the level
        //Put processed level back in self.levels
        //And keep a reference for the rest of this function
        level = self.levels[level] = self.levelParser.process(self, self.levels[level]);
        
        var sh = self.sceneHelper;
        if (self.character) {
            // Move the character to it's spawn point
            self.character.setBottomLeft(level.spawn[spawnId]);
            
            // Discover what template the character has
            var characterTemplate = self.character.template || "cube";
            var characterNeedsTemplate = false;
            if (_.isString(characterTemplate)) {
                characterTemplate = self.levelParser.templates[self.character.template];
                characterNeedsTemplate = true;
            }
            
            // Ensure character has a template and render helper
            if (characterNeedsTemplate || !self.character.helper) {
                if (!_.isArray(characterTemplate)) {
                    characterTemplate = [characterTemplate];
                }
                var template = self.determineObject.apply(this, characterTemplate);
                self.prepareEntity(self.character, template);
                self.character.template = template;
            }
        };
        
        // Add the camera
        level.camera = sh.addExtra("camera", "camera", level.camera);
        
        // Add the lights
        _.each(level.light, function(opts, id) {
            level.light[id] = sh.addExtra(id, "light", opts);
        });
        
        // Add the background
        _.each(level.background, function(v) {
            sh.addExtra(v.id, "background", v);
        });
        
        //TODO :: Have the capacity for other types of extras
        
        // Attach things
        _.each(level.following, function(opts, followed) {
            if (opts[0] === 'character') {
                opts[0] = self.character;
            }
            if (opts[0]) {
                sh.attach.curry(followed).apply(this, opts);
            }
        });
        
        //Make the currentLevel equal to this level
        self.currentLevel = level;
        
        // Add back any reincarnating dead entities
        // And ensure they aren't in removed anymore
        // So they can't potentially be readded later
        var focus;
        while (level.removed.length > 0) {
            focus = level.removed.pop();
            focus.alive = true;
            level.entities.push(focus);
        }
        
        //Add entities to the scene
        _.each(self.entities(), function(focus) {
            sh.add(focus.helper);
        });
        
        //Add  background to the scene
        _.each(self.background(), function(helper) {
            sh.add(helper);
        });
        
        // Setup scenehelper
        sh.setupScene(self);
    };

    /**
     * Clears the current level from the scenehelper
     * @method clearLevel
    */
    self.clearLevel = self.clearLevel || function() {
        if (self.currentLevel) {
            
            // Detach things
            _.each(self.currentLevel.following, function(opts, followed) {
                self.sceneHelper.detach(followed);
            });
            
            self.sceneHelper.removeBackground(self.currentLevel.bkgIds)
            
            //Remove any level specific extras
            if (self.currentLevel.levelExtras) {
                self.sceneHelper.removeExtras(self.currentLevel.levelExtras)
            }
           
           //Remove all entities
            _.each(self.entities(), function(focus) {
                focus.helper && focus.helper.remove();
            });
            
            self.sceneHelper.clear();
        }
    };
    
    /**######################
    ###
    ###   GAME LOOP
    ###
    ######################*/
    
    /**
     * Called when we want the game to start 
     * It creates a Scene and then starts the twitch 
     * It will also call loadLevel if no level is currently loaded
     * Or if a level has been specified
     * @method init
     * @param level {Number} The index of the level to load
     * @param spawn {String} Alternate spawn point to use
    */
    self.init = self.init || function(level, spawn) {
        self.sceneHelper.init(self, self.resources, function() {
            if (!self.currentLevel || level) {
                self.loadLevel(level, spawn);
            }
            
            time = new Date();
            window.manager = self;
            setTimeout(self.twitch.curry(self), 25);
        });
    };
    
    /**
     * The game loop function 
     * Responsible for :
     * 
     * * Calling animate
     * * Calling render
     * * Calculating fps
     * * Removing entities that are dead
     * * Calling itself again to continue the loop
     * 
     * @method twitch
     * @param self {gma.manager}
    */
    self.twitch = self.twitch || function(self) {
        if (self.currentLevel) {
            if (time === undefined) {
                time = new Date();
            }
            var nextTime = new Date();
            var delta = (nextTime - time)/1000;
            counter += delta;
            twitchCount ++;
            
            self.animate(delta);
            self.removeDead(self.currentLevel.entities, self.currentLevel.removed);
            self.checkCharacter();
            
            time = nextTime;
            self.sceneHelper.render(self);
            
            if (counter > 1) {
                fps = twitchCount / counter;
                counter = 0;
                twitchCount = 0;
            }
            self.hud.refresh();
            var refreshDelta = new Date() - time;
            setTimeout(self.twitch.curry(self), refreshDelta > 30 ? 0 : 30 - refreshDelta);
        }
    };

    /**
     * Calls the animate function on objects inside the map
     * @method animate
     * @param tick {Integer} Number representing the time since the last twitch
    */
    self.animate = self.animate || function(tick) {
        _.each(self.entities(), function(focus) {
            if (focus.animate !== undefined) {
                focus.animate(tick, self);
            }
        });
    };

    /**
     * Removes any dead entities from the map
     * @method removeDead
     * @param entities {List} List of entities to look through
     * @param cemetry {List} List to add dead entities to if they have the reincarnate tag
    */
    self.removeDead = self.removeDead || function(entities, cemetry) {
        index = 0
        var entity;
        while (index < entities.length) {
            entity = entities[index];
            if (entity.alive !== true) {
                entity.helper.remove();
                entities.splice(index, 1);
                if (entity.tags.reincarnate) {
                    cemetry.push(entity);
                }
            }
            else {
                index += 1;
            }
        }
    };

    /**
     * Determines if the character is dead and does something about it if it is
     * @method checkCharacter
    */
    self.checkCharacter = self.checkCharacter || function() {
        if (self.character && self.character.alive !== true) {
            self.character.helper.remove();
        }
    };

    /**
     * Puts character back to the beginning
     * @param spawnId {String} String specifying where to respawn the character. This defaults to "main"
     * @method respawn
    */
    self.respawn = self.respawn || function(spawnId) {
        if (self.character && self.currentLevel) {
            self.character.alive = true;
            self.character.setBottomLeft(self.currentLevel.spawn[spawnId || "main"]);
            self.sceneHelper.add(self.character.helper);
        }
    };

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);

/*global require, _ */
require.def('gma/entities/shapes',
    ['gma/base', 'gma/entities/base'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides shape factories
         * @instantiated
         * @class shapes
        */
        gma.shapes = function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////

/**
 * Provides a rectangle factory
 * Accepts an object that has enough information to specify a rectangle
 * Precedence of information is as follows :
 * 
 * * points
 * * width and height
 * * centre
 * * top, left, right, bottom
 * 
 * If there isn't enough information or it's invalid, then undefined is returned
 * @method rectangle
 * @param opts {config}
 * @return {gma.shapes.rectangle or undefined}
*/
self.rectangle = self.rectangle || function(opts) {
    if (opts.centre === undefined && (opts.x !== undefined && opts.y !== undefined)) {
        opts.centre = [opts.x, opts.y];
    }
    
    if (opts.points === null) {
        opts.points = undefined;
    }
    
    if (opts.points !== undefined) {
        //four points
        opts.top    = undefined;
        opts.left   = undefined;
        opts.right  = undefined;
        opts.bottom = undefined;
        
        if (opts.points.length >= 2) {
            _.each(opts.points, function(point) {
                var x = point[0];
                var y = point[1];
                if (opts.left === undefined || opts.left > x) {
                    if (opts.left !== undefined && (opts.right === undefined || opts.right < opts.left)) {
                        opts.right = opts.left;
                    }
                    opts.left = x;
                }
                else if (opts.right === undefined || opts.right < x) {
                    opts.right = x;
                }
                
                if (opts.top === undefined || opts.top < y) {
                    if (opts.top !== undefined && (opts.bottom === undefined || opts.top < opts.bottom)) {
                        opts.bottom = opts.top;
                    }
                    opts.top = y;
                    
                }
                else if (opts.bottom === undefined || opts.bottom > y) {
                    opts.bottom = y;
                }
                
            });
            
            if (opts.left === opts.right || opts.top === opts.bottom) {
                opts.top    = undefined;
                opts.left   = undefined;
                opts.right  = undefined;
                opts.bottom = undefined;
            }
            else {
                opts.width = opts.right - opts.left;
                opts.height = opts.top - opts.bottom;
            }
        }
        else {
            opts.points = undefined;
        }
        
    }
    
    if (opts.points === undefined) {

        if (opts.width !== undefined && opts.height !== undefined) {
            if (opts.top !== undefined && opts.bottom !== undefined) {
                if (opts.top - opts.bottom !== opts.height) {
                    opts.top = undefined;
                    opts.bottom = undefined;
                }
            }
            if (opts.left !== undefined && opts.right !== undefined) {
                if (opts.right - opts.left !== opts.width) {
                    opts.right = undefined;
                    opts.left = undefined;
                }
            }
            if (opts.width > 0 && opts.height > 0) {
                if (opts.centre) {
                    //width and height + centre
                    opts.top = opts.centre[1] + opts.height / 2;
                    opts.bottom = opts.centre[1] - opts.height / 2;
            
                    opts.left = opts.centre[0] - opts.width / 2;
                    opts.right = opts.centre[0] + opts.width / 2;
            
                }
                else {
                    //width and height + top or bottom + left or right
                    if (opts.top !== undefined) {
                        opts.bottom = opts.top - opts.height;
                    }
                    else if (opts.bottom !== undefined) {
                        opts.top = opts.bottom + opts.height;
                    }
                    else if (opts.y !== undefined) {
                        opts.bottom = opts.y - opts.height/2;
                        opts.top = opts.y + opts.height/2;
                    }
            
                    if (opts.left !== undefined) {
                        opts.right = opts.left + opts.width;
                    }
                    else if (opts.right !== undefined) {
                        opts.left = opts.right - opts.width;
                    }
                    else if (opts.x !== undefined) {
                        opts.left = opts.x - opts.width/2;
                        opts.right = opts.x + opts.width/2;
                    }
                }
            }
            //otherwise shape is invalid
        
        } else if (opts.width !== undefined && opts.width > 0) {
            //top and bottom + left or right + width
            if (opts.left !== undefined && opts.right !== undefined) {
                if (opts.right - opts.left !== opts.width) {
                    opts.right = undefined;
                    opts.left = undefined;
                }
            }
            else if (opts.top !== undefined && opts.bottom !== undefined) {
                //Either left or right is undefined at this point
                if (opts.left !== undefined) {
                    opts.right = opts.left + opts.width;
                }
                else if (opts.right !== undefined) {
                    opts.left = opts.right - opts.width;
                }
                else if (opts.x !== undefined) {
                    opts.left = opts.x - opts.width/2;
                    opts.right = opts.x + opts.width/2;
                }
            }
            opts.height = opts.top - opts.bottom;
        }
        else if (opts.height !== undefined && opts.height > 0) {
            //left and right + top or bottom + height
            if (opts.top !== undefined && opts.bottom !== undefined) {
                if (opts.top - opts.bottom !== opts.height) {
                    opts.top = undefined;
                    opts.bottom = undefined;
                }
            }
            else if (opts.right !== undefined && opts.left !== undefined) {
                //Either top or bottom is undefined at this point
                if (opts.top !== undefined) {
                    opts.bottom = opts.top - opts.height;
                }
                else if (opts.bottom !== undefined) {
                    opts.top = opts.bottom + opts.height;
                }
                else if (opts.y !== undefined) {
                    opts.top = opts.y + opts.height/2;
                    opts.bottom = opts.y - opts.height/2;
                }
            }
            opts.width = opts.right - opts.left;
        }
        else {
            opts.width = opts.right - opts.left;
            opts.height = opts.top - opts.bottom;
        }
    }
    
    if (
            opts.top    !== undefined &&
            opts.left   !== undefined &&
            opts.right  !== undefined &&
            opts.bottom !== undefined
        ) {

/**
 * Represents a rectangle
 * @class shapes.rectangle
*/

/**
 * List of points that makes up the rectangle
 * @property points
 * @type [many [x, y]]
*/

/**
 * List of edges that makes up the rectangle
 * @property edges
 * @type [many [x1, y1, x2, y2]]
*/

/**
 * The width of the rectangle
 * @property width
 * @type Number
*/

/**
 * The height of the rectangle
 * @property height
 * @type Number
*/

/**
 * The depth of the rectangle
 * @property depth
 * @type Number
*/

/**
 * The z co-ordinate of the rectangle's centre
 * @property z
 * @type Number
*/

/**
 * The x co-ordinate of the rectangle's centre
 * @property x
 * @type Number
*/

/**
 * The y co-ordinate of the rectangle's centre
 * @property y
 * @type Number
*/

/**
 * List representing the rectangle's centre
 * @property centre
 * @type [self.x, self.y]
*/

/**
 * The x co-ordinate of the left of the rectangle
 * @property left
 * @type Number
*/

/**
 * The x co-ordinate of the right of the rectangle
 * @property right
 * @type Number
*/

/**
 * The y co-ordinate of the top of the rectangle
 * @property top
 * @type Number
*/

/**
 * The bottom co-ordinate of the bottom of the rectangle
 * @property bottom
 * @type Number
*/

/**
 * Amount to offset model in y axis when rendering it
 * @property yOffset
 * @type Number
*/

/**
 * Amount to offset model in x axis when rendering it
 * @property xOffset
 * @type Number
*/

/**
 * Dictionary containing keys for each type the object is
 * @property type
 * @type Dictionary
*/

/**
 * Flag representing the alive/dead status
 * @property alive
 * @type Boolean
 * @default true
*/

/**
 * Flag representing the solid-ness
 * @property solid
 * @type Boolean
 * @default true
*/

/**
 * Hash containing tags
 * This should be specified as an array of strings, if at all.
 * Then each string in the list will be set to true in the resulting hash
 * @property tags
 * @type Object
 * @default {shapes : true}
*/

        opts.alive = opts.alive || true;
        
        opts.z = opts.z || 0;
        opts.depth = opts.depth || 1;
    
        //Can't use usual = thing || default because it could be false :(
        if (opts.solid === undefined) {
            opts.solid = true;
        }
        
        var tags = {};
        if (_.isArray(opts.tags)) {
            _.each(opts.tags, function(tag) {
                tags[tag] = true;
            });
        }
        opts.tags = tags;
        /** @tag shape */
        opts.tags.shape = true;
        
        if (opts.x === undefined || opts.y === undefined ) {
            opts.x = opts.left + opts.width / 2;
            opts.y = opts.bottom + opts.height / 2;
        }
        
        opts.xOffset = opts.xOffset || 0;
        opts.yOffset = opts.yOffset || 0;
        
        /**
         * Function to reset the rectangle's points and edges
         * @method setPointsAndEdges
        */
        opts.setPointsAndEdges = opts.setPointsAndEdges || function() {

            opts.points = [
                [opts.left,  opts.bottom],  // bottom left  -- 0
                [opts.right, opts.bottom],  // bottom right -- 1
                [opts.right, opts.top],     // top right    -- 2
                [opts.left,  opts.top]      // top left     -- 3
            ];
            
            opts.edges = {};
            opts.edges[gma.constants.BOTTOM] =  [opts.points[0], opts.points[1]];
            opts.edges[gma.constants.RIGHT]  =  [opts.points[1], opts.points[2]];
            opts.edges[gma.constants.TOP]    =  [opts.points[2], opts.points[3]];
            opts.edges[gma.constants.LEFT]   =  [opts.points[3], opts.points[0]];
        };
        
        /**
         * Function to reset the rectangle's points and edges
         * @param centre {[x, y]}
         * @method setCentre
        */
        opts.setCentre = opts.setCentre || function(centre) {
            opts.centre = centre;
            
            opts.x = centre[0];
            opts.left = opts.x - opts.width/2;
            opts.right = opts.x + opts.width/2;
            
            opts.y = centre[1];
            opts.top = opts.y + opts.height/2;
            opts.bottom = opts.y - opts.height/2;
            
            opts.setPointsAndEdges();
        };
        
        /**
         * Function to reset the rectangle's points and edges
         * @param bl {[x, y]} Co-ordinates you want to move the bottom left corner of the entity to
         * @method setBottomLeft
        */
        opts.setBottomLeft = opts.setBottomLeft || function(bl) {
            opts.left = bl[0];
            opts.bottom = bl[1];
            
            opts.right = opts.left + opts.width;
            opts.top = opts.bottom + opts.height;
            
            opts.x = opts.left + (opts.width / 2);
            opts.y = opts.bottom + (opts.height/2);
            
            opts.setPointsAndEdges();
        };
        
        /**
         * Determines the x coordinate of the side specified
         * @method xOf
         * @param side {:constant:`LEFT` or :constant:`RIGHT` or null}
         * @return {Number}
        */
        opts.xOf = function(side) {
            if (side === gma.constants.LEFT) {
                return opts.left;
            }
            else if (side === gma.constants.RIGHT) {
                return opts.right;
            }
            else {
                return null;
            }
        };
        
        /**
         * Determines the y coordinate of the side specified
         * @method yOf
         * @param side {:constant:`TOP` or :constant:`BOTTOM` or null}
         * @return {Number}
        */
        opts.yOf = function(side) {
            if (side === gma.constants.TOP) {
                return opts.top;
            }
            else if (side === gma.constants.BOTTOM) {
                return opts.bottom;
            }
            else {
                return null;
            }
        };
        
        /**
         * Returns information about rectangle as a string
         * @method toString
         * @return {String}
        */
        opts.toString = function() {
            return "y:" + opts.y +
            " x:" + opts.x +
            " t:" + opts.top +
            " b:" + opts.bottom +
            " l:" + opts.left +
            " r:" + opts.right +
            " w:" + opts.width +
            " h:" + opts.height;
        };
        
        /**
         * Hook for when a collision with something occurs
         * @method collided
         * @param where       {:api:`gma.constant`} Side of this object that was collided with 
         * @param focus       {object} Thing we collided with
         * @param focusSide   {:api:`gma.constant`} Side of the focus object that was collided with
         * @param focusVector {[x,y]} Amount focus is trying to move
        */
        opts.collided = self.collided || function(where, focus, focusSide, focusVector) {
            // No default behaviour
        };
        

        /**
         * Hook for when a collision with something occurs when we have deathtouch
         * @method collided__deathtouch
         * @copy collided
        */
        opts.collided__deathtouch = self.collided__deathtouch || function(w, focus, fs, fv) {
            if (focus.tags.character) {
                focus.kill();
            }
        };
        
        opts.setPointsAndEdges();
        
        return opts;
    }
    

    //else return nothing cause it ain't valid
};

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        }();
    }
);
/*globals require */

/** @class utils */
require.def('gma/utils/base', 
    ['gma/base'], 
    function(gma) { 
        gma.utils = gma.utils || {};
    }
);
/*global require, _ */
require.def('gma/utils/collisions',
    ['gma/base', 'gma/utils/base' ],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides collision detection functionality
         * @instantiated
         * @class collisions
        */
        gma.collisions = function(spec) {
        
            var self = spec || {};

///////////////////////////////////////////////////////////////////////////////

/**
 * Provides factories for creating filter functions
 * @property factories
*/
self.factories = {
    /**
     * Factory for creating a function that filters stuff outside the enclosing box of our focus
     * The enclosing box is the box that encloses the focus where it is now and after it's intended movement
     * This works by saying what isn't outside the enclosing box
     * Outside occurs when one of the following is true
     * 
     * * Top of the obstacle is below the bottom of the focus
     * * Left of the obstacle is to the right the right of the focus
     * * Right of the obstacle is to the left the left of the focus
     * * Bottom of the obstacle is above the top of the focus
     * @method factories.findBlockers
     * @param focus {:api:`gma.shapes.rectangle`} Object representing the thing we are moving
     * @param vector {[x, y]} Vector representing movement horizontally and vertically
     * @return {Function(environ):Boolean}
    */
    findBlockers : function(focus, vector) {
        var enclosingTop    = _.max([focus.top,    focus.top    + vector[1]]);
        var enclosingLeft   = _.min([focus.left,   focus.left   + vector[0]]);
        var enclosingRight  = _.max([focus.right,  focus.right  + vector[0]]);
        var enclosingBottom = _.min([focus.bottom, focus.bottom + vector[1]]);
        
        return function(environ) {
            return environ !== focus && !_.any([
                environ.top    <= enclosingBottom,
                environ.left   >= enclosingRight,
                environ.right  <= enclosingLeft,
                environ.bottom >= enclosingTop
            ]);
        };
    },
    
    /**
     * Factory for creating a function that filters everything that could be ground to our focus
     * Something is ground if it's top is at the same y position of the focus
     * And the object shares horizontal position with the focus
     * @method factories.findGround
     * @param focus {:api:`gma.shapes.rectangle`} Object representing the thing we are moving
     * @return {Function(environ):Boolean}
    */
    findGround : function(focus) {
        var focusBottom = focus.bottom;
        var focusLeft   = focus.left;
        var focusRight  = focus.right;
        
        return function(environ) {
            if (environ.solid === false) {
                return false;
            }
            
            var distanceToFocus = focusBottom - environ.top;
            var topIsGround     = distanceToFocus >= 0 && distanceToFocus < 0.1;
                
            var leftBetween   = environ.left  > focusLeft && environ.left   < focusRight;
            var rightBetween  = environ.right > focusLeft && environ.right  < focusRight;
            var horizontallyGreater = environ.left <= focusLeft && environ.right  >= focusRight;
            
            var onGround = topIsGround && _.any([
                leftBetween,
                rightBetween,
                horizontallyGreater
            ]);
            
            if (onGround) {
                focus.collided  (gma.constants.BOTTOM, environ, gma.constants.TOP,  null);
                environ.collided(gma.constants.TOP,  focus,   gma.constants.BOTTOM, null);
            }
            
            return onGround;
        };
    },
    
    /**
     * This factory will create a filter function that determines how far focus can go before it hits a particular object in the environment
     * 
     * It first creates a closure containing 
     * 
     * * the gradient of the vecotr
     * * the sides of the focus facing the direction of the vector
     * * the sides of the environ facing the focus
     * 
     * The filter works by first setting possibleX and possibleY to the vector passed in. The filter will end up either returning these values or new values possibleX and possibleY.
     * 
     * It will then decide if the direction is straight or diagonal.
     * 
     * If we're going straight, then we can only go in that direction the minium of the distance between focus and environ or the appropiatepart of the vector.
     * 
     * If we're going diagonal, then we determine which axis is constrained (horizontal, vertical, both or neither) and move the object accordingly. (how is explained below). Whichever is constrained will move the exact distance between the focus and the environ, whilst the other axis will be determined by the full amount of the vector
     * 
     * We then call collidedWith and collidedBy on the appropiate objects with the appropiate parameters and return [possibleX, possibleY]
     * 
     * To determine what to do when going diagonally, we first determine the following
     * 
     * * X and y co-ordinates of the vertical and horizontal axis ofthe environ respectively
     * * The equivalent of the focus
     * * Where the particular sides chosen is determined by the direction of the vector
     * * The horizontal and vertical distance between focus and environ (xd and yd)
     * * We then determine whether horizontal or vertical axis are constrained using the following rules per axis
     * 
     *   * If the distance is zero
     *   * , or this axis is already past the respective axis of the environ
     * 
     * * Then we determine whether xd or yd should be negative or positive depending on the direction and gradient of the vector
     * * Then we determine a projection of xd and yd on the gradient (i.e. If we moved the character xd or yd, then what the respective amount they'd travel in the other axis according to the gradient). We call these values, yxd and xyd. These values are made absolute astheir polarity doesn't make a difference past this point
     * * If at this point, both axis are still constrained, then we see if we can unconstrain one of the axis. We say that for each axis, if the amount projected is less than the distance between between focusand environ, then the other axis isn't constrained, which leaves this axis to still be constrained.
     * * We then say that each axis that is constrained can only move the distance between focus and environ and each axis that is not constrained moves the full amount of the vector
     * * We also determine if the focus will completely miss the environ. if both or neither axis are constrained, then it doesn't miss.
     * * If only one axis is constrained, then we look at the distance between the opposite sides of focus and environ. So say for example focus is moving left, then we look at the distance between focus' left side and environ's right side. If this distance is smaller than the projected distance, then the focus must not be hitting the environ, and we've missed it
     * 
     * @method factories.findCollisions
     * @param focus {:api:`gma.shapes.rectangle`} Object representing the thing we are moving
     * @param vector {[x, y]} Vector representing movement horizontally and vertically
     * @return {Function(environ):[possibleX, possibleY]}
    */
    findCollisions : function(focus, vector) {

		// Determine environSides
        var environSides = [];
        var focusSides = [];
        
        if (vector[0] > 0) {
            environSides.push(gma.constants.LEFT);
            focusSides.push(gma.constants.RIGHT);
        }
        else if (vector[0] < 0) {
            environSides.push(gma.constants.RIGHT);
            focusSides.push(gma.constants.LEFT);
        }
        
        if (vector[1] > 0) {
            environSides.push(gma.constants.BOTTOM);
            focusSides.push(gma.constants.TOP);
        }
        else if (vector[1] < 0) {
            environSides.push(gma.constants.TOP);
            focusSides.push(gma.constants.BOTTOM);
        } 
        
        //determine gradient
        var gradient = 0;
        if (vector[1] !== 0) {
            gradient = vector[1]/vector[0];
        }
        
        var diff;
        var miss;
        var collidedFocusSide;
        var collidedEnvironSide;
        
        var possibleX;
        var possibleY;
        var xMovement;
        var yMovement;
        
        var environX;
        var focusX;
        var environY;
        var focusY;
        
        var xd;
        var yd;
        var yxd;
        var xyd;
        
        var newDirection;
        var yConstrained;
        var xConstrained;
        
        return function(environ) {
            
            possibleX = vector[0];
            possibleY = vector[1];
            if (environSides.length === 1) {
                if (environSides[0] === gma.constants.RIGHT || environSides[0] === gma.constants.LEFT) {
                    // Going horizontally
                    environX = environ.xOf(environSides[0]);
                    focusX   = focus.xOf(focusSides[0]);
                    
                    possibleX    = _.min([environX - focusX, vector[0]], Math.abs);
                    collidedEnvironSide = environSides[0];
                    collidedFocusSide   = focusSides[0]; 
                }
                else {
                    // Going vertically
                    environY = environ.yOf(environSides[0]);
                    focusY   = focus.yOf(focusSides[0]);
                    
                    possibleY    = _.min([environY - focusY, vector[1]], Math.abs);
                    collidedEnvironSide = environSides[0];
                    collidedFocusSide   = focusSides[0];
                }
            }
            
            else {
                // Going diagonally
        
                //Determine environ edges
                environX = environ.xOf(environSides[0]);
                environY = environ.yOf(environSides[1]);
                
                //Determine focus edges 
                focusX = focus.xOf(focusSides[0]);
                focusY = focus.yOf(focusSides[1]);
                
                // Determine distances
                xd = environX - focusX;
                yd = environY - focusY;
                
                // Determine which axis is constrained
                yConstrained = false;
                xConstrained = false;
                
                if (xd === 0 || (environSides[0] === gma.constants.RIGHT && xd < 0) || (environSides[0] === gma.constants.LEFT && xd > 0)) {
                    xConstrained = true;
                }
                
                if (yd === 0 || (environSides[1] === gma.constants.BOTTOM && yd > 0) || (environSides[1] === gma.constants.TOP && yd < 0)) {
                    yConstrained = true;
                }

                // Gradient is never zero, because we're going diagonally
                yd = Math.abs(yd);
                xd = Math.abs(xd);
                if (focusSides[0] === gma.constants.RIGHT) {
                    if (focusSides[1] === gma.constants.TOP) {
                        //Going Diagonally up-right
                        //Both yd and xd should be positive
                    }
                    else {
                        //Going Diagonally down-right
                        //y should be negative
                        yd = -yd;
                    }
                }
                if (focusSides[0] === gma.constants.LEFT) {
                    if (focusSides[1] === gma.constants.TOP) {
                        //Going Diagonally up-left
                        //x should be negative
                        xd = -xd;
                    }
                    else {
                        //Going Diagonally down-left
                        //both should be negative
                        xd = -xd;
                        yd = -yd;
                    }
                }
                
                xyd = Math.abs(yd / gradient);
                yxd = Math.abs(gradient * xd);
                
                if (xConstrained && yConstrained) {
                    // Both are constrained, do more tests to determine which to constrain
                    if (yxd < Math.abs(yd)) {
                        xConstrained = false;
                    }
                    
                    if (xyd < Math.abs(xd)) {
                        yConstrained = false;
                    }
                }
                
                miss = true;
                if (xConstrained && yConstrained) {
                    yMovement = yd;
                    xMovement = xd;
                    collidedEnvironSide = environSides[1];
                    collidedFocusSide   = focusSides[1];
                    miss = false;
                }
                else if (xConstrained) {
                    xMovement = xd;
                    yMovement = possibleY;
                    collidedEnvironSide = environSides[0];
                    collidedFocusSide   = focusSides[0];
                    
                    //Determine if we actually miss the environ
                    diff = Math.abs(environ.yOf(focusSides[1]) - focus.yOf(environSides[1]));
                    miss = yxd >= diff;
                    
                }
                else if (yConstrained) {
                    yMovement = yd;
                    xMovement = possibleX;
                    collidedEnvironSide = environSides[1];
                    collidedFocusSide   = focusSides[1];
                    
                    //Determine if we actually miss the environ
                    diff = Math.abs(environ.xOf(focusSides[0]) - focus.xOf(environSides[0]));
                    miss = xyd >= diff;
                    
                }
                
                if (miss === false) {
                    possibleX = xMovement;
                    possibleY = yMovement;
                }
                
            }
            
            // If vector is different than possibleX and possibleY then we assume collision has occured
            // Because for this function to be called, focus must already have tried to move
            
            if (possibleX !== vector[0] || possibleY !== vector[1]) {
                focus.collided  (collidedFocusSide,   environ, collidedEnvironSide, null);
                environ.collided(collidedEnvironSide, focus,   collidedFocusSide,   vector);
            }
            
            if (environ.solid === true) {
                newDirection = [possibleX, possibleY];
            }
            else {
                newDirection = vector;
            }
            
            return newDirection;
        };
    }
};

/**
 * Given a focus, it's movement and what's in the environment, this will determine where that focus can go. 
 * It will first filter out anything that is outside the enclosing box
 * It will then determine if there are any collisions
 * If there aren't collisions, it will return the original vector
 * If there are no collisions, it will return a vector representing the smallest amount of movement it can do given the collisions
 * @method detectCollisions
 * @param focus {:api:`gma.shapes.rectangle`} Object representing the thing we are moving
 * @param vector {[x, y]} Vector representing movement horizontally and vertically
 * @param environment {[many :api:`gma.shapes.rectangle`]} List of shapes representing collidable objects in the visible environment
 * @return {[x, y]}
*/
self.detectCollisions = self.detectCollisions || function(focus, vector, environment) {
    //At this point, focus has to be moving
    //Environment is a list of objects in the environment
    var findBlockers = self.factories.findBlockers(focus, vector);
    var findCollisions = self.factories.findCollisions(focus, vector);
    
    // Blocking is any object within the enclosing space created from originial and target position
    //console.log("Environment: "+environment.length);
    var blocking  = _.filter(environment, findBlockers);
    //console.log("Blocking: "+blocking.length);

    // The findCollisions filter changes collidingLines
    //console.log("Vector: "+vector);
    var collisions = _.map(blocking, findCollisions);
    //_.each(collisions, function(o) { console.log("Results: "+o); });
    
    var x;
    var y;
    if (collisions.length > 0) {
        x = _.min(_.map(collisions, function(v) { return v[0]; }), Math.abs);
        y = _.min(_.map(collisions, function(v) { return v[1]; }), Math.abs);
    }
    else {
        x = vector[0];
        y = vector[1];
    }
    
    return [x, y];
};

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        }();
    }
);
/*global require, $, _ */
require.def('gma/utils/hud',
    ['gma/base', 'gma/utils/base'],
    function(gma) {
    
        /** @module gma */
        
        /**
         * Provides HUD functionality
         * @class hud
        */
        gma.hud = function(spec) {
        
            var self = spec || {};
            
///////////////////////////////////////////////////////////////////////////////

    //Holds the information that specifies what goes in the HUD
    var positions = [];
    
    /**
    * Creates the necessary HTML elements that form the hud
    * It will also store this on self and inside positions
    * @param spec {Object} Specifies what displays where on the HUD
    * @method setup
    */
    self.setup = self.setup || function(spec) {        
        if (!self.canvasContainer) {
            throw new Error("HUD needs a canvas container");
        }
        
        self.reset();
        if (spec) {
            _.each(spec, function(list, position) {
                var arr = position.split('_');
                self[position] = self.createSection.apply(this, arr);
                var $container = self[position];
                $container.functions = [];
                self.fillSection($container, list);
                
                positions.push(position);
            });
        }
    };
    
    /**
    * Return a dl element inside a div element
    * Both of these elements are created if they don't already exist
    * The div element will have a particular id
    * The dl element will have a particular class
    * Both id/class are found with (and created on) using those passed into the function
    * @param divID {String} The id of the div element
    * @param dlClass {String} The class of the dl element
    * @method createSection
    * @return {The created/found dl element}
    */
    self.createSection = self.createSection || function(divID, dlClass) {
        var $div = $(self.canvasContainer).find("#" + divID + '_hud');        
        if ($div.length === 0) {
            // Div doesn't exist, so let's create one
            $div = $('<div id="' + divID + '_hud"></div>');
            $div.appendTo($(self.canvasContainer));
        }
        
        var $dl = $div.find("." + dlClass).first();
        if ($dl.length === 0) {
            //dl doesn't exist, so let's create one and add it to the div
            $dl = $('<dl class="' + dlClass + '"></dl>');
            $dl.appendTo($div);
        }
        
        return $dl;
    };
    
    /**
    * Fills some element (suggested to be a dl) with dt and dd elements
    * It will prepend each element's label with "hud\_" and convert to lowercase to form the id for each dt
    * And insert the lable inside a span element inside the dt
    * It will then use the the value for the label as the value for the dd,
    * or if the value is a function, then using the result of calling that function as the value inside the dd
    * This function will then register this function to this particular dt for updating at a later stage
    * @param $container {HTML Element} The container to add the dt and dd elements to
    * @param items {Dictionary} Dictionary of label:value to put into the $container
    * @method fillSection
    */
    self.fillSection = self.fillSection || function($container, items) {
        _.each(items, function(value, label) {
            var dtId = "hud_" + label.toLowerCase();
            var dt = $container.find("dt#" + dtId);
            if (dt.length === 0) {
                $container.append('<dt id="' + dtId + '"></dt>');
            }
            
            dt = $container.find("dt#" + dtId);
            if (dt.find("span").length === 0) {
                dt.append("<span>" + label + "</span");
            }
            
            var $temp;
            if (_.isFunction(value)) {
                $temp = $('<dd>' + value() + '</dd>');
                if (!_.isArray($container.functions)) {
                    $container.functions = [];
                }
                $container.functions.push([$temp, value]);
            }
            else {
                $temp = $('<dd>' + value + '</dd>');
            }
            $temp.appendTo($container);
        });
    };
    
    /**
    * Ensures the canvasContainer is empty
    * @method reset
    */
    self.reset = self.reset || function() {
        $(self.canvasContainer).find("div[id$='_hud']").remove();
        _.each(positions, function(position) {
            self[position] = undefined;
        });
        positions = [];
    };
    
    /**
    * Fills out HUD information using the functions provided to setup
    * @method refresh
    */
    self.refresh = self.refresh || function() {
        _.each(positions, function(position) {
            _.each(self[position].functions, function(arr) {
                arr[0].text(arr[1]());
            });
        });
    };

    /**
    * Hides the HTML elements that makes up the HUD
    * Optionally, you can hide just a particular part of the HUD
    * @param position {String} Particular part of the HUD you want to hide
    * @method hide
    */
    self.hide = self.hide || function(position) {
        if (position !== undefined) {
            if (position.indexOf('_') === -1) {
                $(self.canvasContainer).find("#" + position + '_hud').first().hide();
                $(self.canvasContainer).find("#" + position + '_hud').find('dl').hide();
            }
            else {
                self[position].hide();
                var parent = self[position].parent()
                var hideParent = _.all(parent.children(), function(child) {
                    return $(child).css('display') === 'none'
                });
                
                if (hideParent) {
                    parent.hide();
                }
            }
        }
        else {
            // No position specified, hide them all
            $(self.canvasContainer).find("div[id$='_hud']").hide();
            $(self.canvasContainer).find("div[id$='_hud'] dl").hide();
        }
    };
    
    /**
    * Shows the HTML elements that makes up the HUD
    * Optionally, you can show just a particular part of the HUD
    * @param position {String} Particular part of the HUD you want to show
    * @method show
    */
    self.show = self.show || function(position) {
        if (position !== undefined) {
            if (position.indexOf('_') === -1) {
                $(self.canvasContainer).find("#" + position + '_hud').first().show();
                $(self.canvasContainer).find("#" + position + '_hud').find('dl').show();
            }
            else {
                self[position].show();
                self[position].parent().show();
            }
        }
        else {
            $(self.canvasContainer).find("div[id$='_hud']").show();
            $(self.canvasContainer).find("div[id$='_hud'] dl").show();
        }
    };
    
    
    /**######################
    ###
    ###   MESSAGES
    ###
    ######################*/
    
    
    /**
    * Hides the HTML elements that makes up the HUD
    * Optionally, you can hide just a particular part of the HUD
    * It will use a div with id of "message" to display the message in
    * @param msg {String} The message to display
    * @param wait {Number} The amount to wait before automatically hiding the message
    * @param callBack {Function} Optional function that is executed either immediately or when the timeout has finished
    * @method displayMessage
    */
    self.displayMessage = self.displayMessage || function(msg, wait, callBack) {
        var $messageDiv = $(self.canvasContainer).find("div#message");
        if ($messageDiv.length === 0) {
            $messageDiv = $("<div id='message'></div>");
            $(self.canvasContainer).append($messageDiv);
        }
        else {
            $messageDiv = $messageDiv.first();
        }
        
        $messageDiv.html(msg);
        $messageDiv.show();
        
        if (_.isNumber(wait)) {
            //Apparently, have to do this for callBack to be in the closure
            var cb = callBack;
            var afterTimeout = function() {
                self.hideMessage();
                if (_.isFunction(cb)) {
                    cb();
                }
            };
            setTimeout(afterTimeout, wait);
        }
        else if (_.isFunction(callBack)) {
            // No timeout, just call the callback
            callBack();
        }
    };
    
    /**
    * Hides the message div (div with id "message")
    * @method hideMessage
    */
    self.hideMessage = self.hideMessage || function() {
        var $messageDiv = $(self.canvasContainer).find("div#message");
        if ($messageDiv.length !== 0) {
            $messageDiv = $messageDiv.first().hide();
        }
    };
    
///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
/*global require, _, GLGE, window */
require.def('gma/utils/render',
    ['gma/base', 'gma/utils/base'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Sets options on a GLGE object
         * @param obj {object} The object we are setting options on
         * @param opts {Object} The options to set on the object
         * @param avoid {[String]} List of options not to set on object
         * @method setProperties
         * @private
        */
        var setProperties = function(obj, opts, avoid) {
            var func;
            _.each(opts, function(value, key) {
                if (!avoid || !_.any(_.map(avoid, function(k) {return k === key;}))) {
                    func = obj["set" + key[0].toUpperCase() + key.substr(1)];
                    if (_.isFunction(func)) {
                        func.apply(obj, [value]);
                    }
                }
            });
        };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Connects the rendering library to gamma manager
     * @class sceneHelper
    */
    gma.sceneHelper = function(spec) {
    
        var self = spec || {};
        
        /**
         * Dictionairy of {id:render Helpers} for things to appear in background
         * @property bkgIds
         * @type {{id : :api:`gma.renderHelper`}}
        */
        self.bkgIds = self.bkgIds || {};
        
        /**
         * List of render Helpers for things to appear in background
         * @property background
         * @type {[:api:`gma.renderHelper`]}
        */
        self.background = self.background || [];
        
        /**
         * List of extra objects to be rendered in the scene
         * @property extras
         * @type {name : obj}
        */
        self.extras = self.extras || {};
        
        /**
         * List associating GLGE objects to gamma objects
         * @property attached
         * @type {name : [obj, offsetX, offsetY]}
        */
        self.attached = self.attached || {};
        
        /**
         * The GLGE.Scene being rendered
         * @property scene
         * @type :glge:`Scene`
        */
        self.scene = self.scene || (function() {
            self.scene = new GLGE.Scene();
            self.scene.setAmbientColor("#999");
            self.scene.setBackgroundColor("#999");
            return self.scene;
        })();
        
        /**
         * The GLGE.Renderer being used
         * @property renderer
         * @type :glge:`Renderer`
        */
        
        /**
         * The GLGE.Document being used
         * @property doc
         * @type :glge:`Document`
        */
        
        /**
         * The GLGE.Group that holds everything
         * @property grp
         * @type :glge:`Group`
        */
        self.grp = new GLGE.Group();
          
        /**
         * Initialises the GLGE scene
         * @param manager {:api:`gma.manager`}
         * @param resources {[String]} a list of paths to xml files
         * @param callback {function} The callback to call when the document is loaded
         * @method init
        */
        self.init = self.init || function (manager, resources, callback) {
            self.doc = self.doc || new GLGE.Document();
            self.doc.onLoad = function() {
                callback();
            };
            
            if (resources && resources.length > 0) {
                _.each(resources, function(resource) {
                    self.doc.loadDocument(resource);
                });
            }
            else {
                self.doc.onLoad();
            }
            
        };
        
        /**
         * Setups the scene with a camera, group and extras
         * @method setupScene
         * @param manager {:api:`gma.manager`}
        */
        self.setupScene = self.setupScene || function(manager) {
            if (!self.extras.camera) {
                self.extras.camera = new GLGE.Camera();
            }
            
            self.scene.camera = self.extras.camera;
            _.each(self.extras, function(extra) {
                self.grp.addObject(extra);
            });
            
            self.scene.addChild(self.grp);
            
            // Need to attach scene to renderer even if renderer already exists
            // Otherwise lights don't work properly
            // If we have no renderer, then this is done inside the render method
            // For the purpose of making sure tests pass in non-webgl browsers,
            // We make sure a renderer exists before doing this
            self.renderer && self.makeRenderer(manager);
        };
        
        /**
         * Function that creates renderer object
         * And sets the scene
         * @method makeRenderer
         * @param manager {:api:`gma.manager`}
        */
        self.makeRenderer = self.makeRenderer || function(manager) {
            self.renderer = self.renderer || new GLGE.Renderer(manager.canvas);
            self.renderer.setScene(self.scene);
        };
        
        /**
         * Function that clears everything from the scene
         * @method clear
        */
        self.clear = self.clear || function () {
            self.scene.removeChild(self.grp);
        }; 
        
        /**
         * Function that adds a helper to the scene
         * @method add
         * @param helper {gma.renderHelper}
        */
        self.add = self.add || function (helper) {
            helper.addTo(self.grp);
        };
        
        /**
         * Returns how many things are rendered by the scene
         * @method countContained
        */
        self.countContained = self.countContained || function () {
            return self.grp.children.length;
        };
        
        /**
         * Function that sets locations and renders the scene
         * @method render
         * @param manager {:api:`gma.manager`}
        */
        self.render = self.render || function (manager) {
            // Create renderer at last possible moment
            // Purely so that tests run in non-webgl browsers without failing
            self.renderer || self.makeRenderer(manager);
            
            // Set location of all rendered objects
            self.setRenderedLocations(manager);
            
            // Render !
            self.renderer.render();
        };
        
        /**
         * Sets locations of everything in the scene
         * @method setRenderedLocations
         * @param manager {:api:`gma.manager`}
        */
        self.setRenderedLocations = self.setRenderedLocations || function (manager) {
            _.each(manager.entities(), function(focus) {
                if (focus.helper) {
                    focus.helper.setLocation();
                }
            });
            
            _.each(self.attached, function(value, key) {
                var obj = value[0];
                var ofx = value[1];
                var ofy = value[2];
                var ofz = value[3];
                var extra = self.extras[key];
                if (!extra) {
                    extra = self.bkgIds[key].getRenderedObj();
                }
                if (extra) {
                    extra.setLocX(obj.x + ofx);
                    extra.setLocY(obj.y + ofy);
                    if (ofz) {
                    	extra.setLocZ(obj.z + ofz);
                    }
                }
            });
        };
        
        /**
         * Adds other objects into the scene
         * @method addExtra
         * @param name {String}
         * @param type {String}
         * @param spec {Object}
         * @return {Object just added}
        */
        self.addExtra = self.addExtra || function (name, type, spec) {
            var obj = spec || {};
            var isNew = false;
            
            if (type === 'background') {
                if (spec) {
                    self.background.push(spec);
                    if (spec.id) {
                        self.bkgIds[spec.id] = spec;
                    }
                }
                return spec;
            }
            
            if (type === 'light') {
                if (obj.className != 'Light') {
                    obj = new GLGE.Light();
                    isNew = true;
                }
            }
            
            if (type === 'camera') {
                if (obj.className != "Camera") {
                    obj = new GLGE.Camera();
                    isNew = true;
                }
            }
            
            if (spec && isNew) {
                setProperties(obj, spec);
            }
            
            obj.setId(name);
            self.extras[name] = obj;
            return obj;
        };
        
        /**
         * Removes specified extras from the scene helper
         * @method removeExtras
         * @param extras {[String]} List of extra ids to remove
        */
        self.removeExtras = self.removeExtras || function(extras) {
            if (extras) {
                _.each(extras, function(extra) {
                    var next = self.extras[extra];
                    if (next) {
                        self.grp.removeChild(next);
                        self.extras[extra] = undefined;
                        delete self.extras[extra];
                    }
                });
            }
        };
        
        /**
         * Removes specified background from the scene helper
         * @method removeBackground
         * @param backgrounds {[String]} List of background ids to remove
        */
        self.removeBackground = self.removeBackground || function(backgrounds) {
            if (backgrounds) {
                _.each(backgrounds, function(id) {
                    var next = self.bkgIds[id];
                    if (next) {
                        next.remove && next.remove();
                        self.bkgIds[id] = undefined;
                        delete self.bkgIds[id];
                    }
                });
            }
            
            if (self.background) {
                temp = [];
                _.each(self.background, function(b) {
                    if (b.id && self.bkgIds[b.id]) {
                        temp.push(b);
                    }
                    else {
                        b.remove && b.remove();
                    }
                });
                
                self.background = temp;
            }
        };
        
        /**
         * Records the necessary information to allow an object to follow another
         * @method attach
         * @param name {String} Name of the object in self.extras we are attaching the gma object to
         * @param obj {:api:`gma.shapes.rectangle`}
         * @param offsetX {Number}
         * @param offsetY {Number}
         * @param offsetZ {Number}
        */
        self.attach = self.attach || function (name, obj, offsetX, offsetY, offsetZ) {
            self.attached[name] = [obj, offsetX || 0, offsetY || 0, offsetZ];
        };
        
        /**
         * Dissociates a object from another to stop an object following another object
         * @method detach
         * @param name {String}
        */
        self.detach = self.detach || function (name) {
            if (self.attached[name]) {
                delete self.attached[name];
            }
        };
        
        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Connects rendered object to gamma object
     * @class renderHelper
    */
    gma.renderHelper = function(spec) {
 
        var self = spec || {};
        var previousInstance;
 
        /**
         * The entity that is attached to this helper (and vice verca)
         * @property entity
         * @type Gamma object
        */
 
        /**
         * The template object
         * <strong> must be passed in or set after creation</strong>
         * @property template
         * @type :api:`gma.baseTemplate`
        */
        
        /**
         * The parent object that the rendered object belongs to
         * @property parent
         * @type :glge:`Group`
        */
        
        /**
         * Attaches an object to this helper
         * @method attachTo
         * @param obj {object} The object which we wish to attach to the helper
        */
        self.attachTo = self.attachTo || function (obj) {
            self.entity = obj;
            self._instance = undefined;
        };
        
        /**
         * Attaches the object to the group
         * @method addTo
         * @param grp {:glge:`Group`} The group that we will add the object to
        */
        self.addTo = self.addTo || function (grp) {
            self.parent = grp;
            
            var obj = self.getRenderedObj();
            obj.setScale(self.entity.width, self.entity.height, self.entity.depth);
            obj.notifyOfScale && obj.notifyOfScale(self.entity.width, self.entity.height, self.entity.depth);
            obj.setLoc(self.entity.x, self.entity.y, self.entity.z);
            
            grp.addObject(obj);
        };
        
        /**
         * Sets the location of the rendered object using self.entity
         * @method setLocation
        */
        self.setLocation = self.setLocation || function () {
            var obj = self.getRenderedObj();
            obj.setLocX(self.entity.x);
            obj.setLocY(self.entity.y);
            if (self.entity.getRotation) {
                obj.setRotY(self.entity.getRotation());
            }
        };
        
        /**
         * Gets the object that we are rendering
         * @method getRenderedObj
         * @return {:glge:`Object`}
        */
        self.getRenderedObj = self.getRenderedObj || function () {
            if (!self._instance) {
                self._instance = self.template.getInstance();
            }
            return self._instance;
        };
        
        /**
         * Removes the objects from the parent group and sets the parent to undefined
         * @method remove
        */
        self.remove = self.remove || function () {
            if (self.parent) {
                self.parent.removeChild(self.getRenderedObj());
                self.parent = undefined;
            }
        };
        
        /**
         * Toggles from rendering the desired object to rendering a unit cube (this shows the bounding box)
         * @method toggleBounding
        */
        self.toggleBounding = self.toggleBounding || function () {
            var currentInstance = self.getRenderedObj();
            var parent = self.parent;
            self.remove();
            self._instance = previousInstance || gma.unitCube.getInstance();
            previousInstance = currentInstance;
            self.addTo(parent);
        };
        
        

        return self;
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Allows the specification of a rendered object
     * @class baseTemplate
    */
    gma.baseTemplate = function(spec) {
        
        var self = spec || {};
          
        /**
         * The helper object for the scene 
         * <strong> must be passed in </strong>
         * @property sceneHelper
         * @type :api:`gma.sceneHelper`
        */
        
        /**
         * The object that we are instancing 
         * @property _blueprint
         * @type :glge:`Object`
        */
        
        /**
         * The ammount to rotate the object in the x axis 
         * @property xRot
         * @type Number
         * @default 0
        */
        self.xRot = self.xRot || 0;
        
        /**
         * The ammount to rotate the object in the y axis 
         * @property yRot
         * @type Number
         * @default 0
        */
        self.yRot = self.yRot || 0;
        
        /**
         * The ammount to rotate the object in the z axis 
         * @property zRot
         * @type Number
         * @default 0
        */
        self.zRot = self.zRot || 0;
        
        /**
         * The ammount to scale the object in the x axis 
         * @property xScale
         * @type Number
         * @default 0
        */
        self.xScale = self.xScale || 1;
        
        /**
         * The ammount to scale the object in the y axis 
         * @property yScale
         * @type Number
         * @default 0
        */
        self.yScale = self.yScale || 1;
        
        /**
         * The ammount to scale the object in the z axis 
         * @property zScale
         * @type Number
         * @default 0
        */
        self.zScale = self.zScale || 1;
        
        /**
         * The ammount to shift the object in the x axis 
         * @property xOffset
         * @type Number
         * @default 0
        */
        self.xOffset = self.xOffset || 0;
        
        /**
         * The ammount to shift the object in the y axis 
         * @property yOffset
         * @type :glge:`Object`
         * @default 0
        */
        self.yOffset = self.yOffset || 0;
        
        /**
         * The ammount to shift the object in the z axis 
         * @property zOffset
         * @type :glge:`Object`
         * @default 0
        */
        self.zOffset = self.zOffset || 0;
        
        /**
         * Determines object that will be instanced
         * @method defineInstance
         * @return {:glge:`Object`}
        */
        self.defineInstance = self.defineInstance || function () {
            return new GLGE.Object();
        };
        
        /**
         * Puts the object into a GLGE group and offsets its position appropriately
         * It then returns a new instance of the group
         * @method getInstance
         * @return {:glge:`Group`}
        */
        self.getInstance = self.getInstance || function () {
            var raw = self.defineInstance();
            var grp = new GLGE.Group();
            raw.setLoc(self.xOffset, self.yOffset, self.zOffset);
            raw.setScale(self.xScale, self.yScale, self.zScale);
            raw.setRot(self.xRot, self.yRot, self.zRot);
            grp.addChild(raw);
            grp.notifyOfScale = raw.notifyOfScale || function() {};
            return grp;
        };

        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides the specification of a collada object
     * @extends gma.baseTemplate
     * @class colladaTemplate
    */
    gma.colladaTemplate = function(spec) {
    
        var self = gma.baseTemplate(spec || {});

        /** @method defineInstance */
        self.defineInstance = function() {
            var obj = new GLGE.Collada();
            if (self.collada.document) {
                obj.setDocument(self.collada.document, obj.getAbsolutePath(window.location.toString(), null));
            }
            if (self.collada) {
                setProperties(obj, self.collada, ['document']);
            }
            return obj;
        };
        
        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Allows the specification of an object that exists within the xml
     * @extends gma.baseTemplate
     * @class glgeIDTemplate
    */
    gma.glgeIDTemplate = function(spec) {
    
        var self = gma.baseTemplate(spec || {});

        /** @method defineInstance */
        self.defineInstance = function() {
            return self.sceneHelper.doc.getElement(self.id);
        };
        
        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides the specification of an object which is using a mesh
     * @extends gma.baseTemplate
     * @class meshTemplate
    */
    gma.meshTemplate = function(spec) {
    
        var self = gma.baseTemplate(spec || {});

        /** 
        * Meshtemplate will look for mesh and material options
        * It will create mesh and material objects from these options
        * That are then attached a GLGE Object, which is returned
        * @method defineInstance 
        */
        self.defineInstance = function() {
            var obj = new GLGE.Object();
            var material;
            
            if (self.mesh) {
                var mesh = new GLGE.Mesh();
                setProperties(mesh, self.mesh);
                obj.setMesh(mesh);
            }
            
            if (self.material) {
                material = new GLGE.Material();
                setProperties(material, self.material);
                obj.setMaterial(material);
            }
            else if (self.texture) {
                var materialLayer = new GLGE.MaterialLayer();
                var texture = new GLGE.Texture()
                
                texture.setSrc(self.texture.src);
                
                materialLayer.setMapinput(GLGE.UV1);
                materialLayer.setMapto(GLGE.M_COLOR);
                materialLayer.setTexture(texture);
                
                obj.notifyOfScale = function(_width, _height, _depth) {
                    materialLayer.setDScaleX(self.texture.repeatX * _width);
                    materialLayer.setDScaleY(self.texture.repeatY * _height);
                };
                
                material = new GLGE.Material();
                obj.setMaterial(material);
                material.addTexture(texture);
                material.addMaterialLayer(materialLayer);
            }
            return obj;
        };
        
        return self;
    
    };

///////////////////////////////////////////////////////////////////////////////

    /** @for gma */
    
    /**
     * Info used to create Unit cube template
     * @property unitCubeInfo
     * @type Object
    */
    gma.unitCubeInfo = {
        mesh : {
            positions : [0.5 , 0.5 , -0.5 , 0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , -0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , -0.5 , 0.5 , -0.5 , 0.5 , 0.5 , -0.5 , 0.5 , -0.5 , 0.5 , 0.5 , 0.5 , 0.5 , 0.5 , -0.5 , -0.5 , 0.5 , -0.5 , -0.5 , 0.5 , 0.5],
		
            normals : [0 , 0 , -0.5 , 0 , 0 , -0.5 , 0 , 0 , -0.5 , 0 , 0 , -0.5 , 0 , -0 , 0.5 , 0 , -0 , 0.5 , 0 , -0 , 0.5 , 0 , -0 , 0.5 , 0.5 , -0 , 0 , 0.5 , -0 , 0 , 0.5 , -0 , 0 , 0.5 , -0 , 0 , -0 , -0.5 , -0 , -0 , -0.5 , -0 , -0 , -0.5 , -0 , -0 , -0.5 , -0 , -0.5 , 0 , -0 , -0.5 , 0 , -0 , -0.5 , 0 , -0 , -0.5 , 0 , -0 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0 , 0.5 , 0],

            UV : [0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5 , 0 , 0 , 0.5 , 0 , 0.5 , 0.5 , 0 , 0.5],

            faces : [0 , 1 , 2 , 0 , 2 , 3 , 4 , 5 , 6 , 4 , 6 , 7 , 8 , 9 , 10 , 8 , 10 , 11 , 12 , 13 , 14 , 12 , 14 , 15 , 16 , 17 , 18 , 16 , 18 , 19 , 20 , 21 , 22 , 20 , 22 , 23]
        },
        
        material : {
            color:"#009"
        }
    };
    
    /**
     * An instantiated meshTemplate using unitCubeInfo
     * @property unitCube
     * @type :api:`gma.meshTemplate`
    */
    gma.unitCube = gma.meshTemplate(gma.unitCubeInfo);

///////////////////////////////////////////////////////////////////////////////

    }
);
/*global require, _ */
require.def('gma/utils/background',
    ['gma/base', 'gma/utils/render', 'gma/entities/shapes'],
    function(gma) {
        
        /** @module gma */

        /**
         * Provides some functions to transform specification into background
         * @class backgroundMaker
        */
        gma.backgroundMaker = function(spec) {
        
            var self = spec || {};

///////////////////////////////////////////////////////////////////////////////

/**
 * The z co-ordinate given to all background items
 * @property z
 * @type Number
*/
self.z = self.z || 0;

/**
 * Dispatcher for determining how to treat background specifications
 * @method process
 * @param manager {:api:`gma.manager`}
 * @param value {specification}
 * @return {:api:`gma.renderHelper`}
*/
self.process = self.process || function(manager, value) {
    if (value) {
        if (_.isString(value.config)) {
            func = self['process_' + value.config];
            if (_.isFunction(func)) {
                return func(manager, value, value.config);
            }
        }
        else if (_.isFunction(value.config)) {
            return value.config(manager, value);
        }
        
        //If we've made it this far, config is either unknown or undefined
        return self.process_other(manager, value, value.config);
    }
};

/**
 * Function to ensure value.entity is a rectangle
 * @method sanitise
 * @param value {specification}
 * @param opts {Options}
*/
self.sanitise = self.sanitise || function(value, opts) {
    opts = opts || {x:0, y:0, width:1, height:1};
    opts = _.extend(opts, value, value.entity)
    value.entity = gma.shapes.rectangle(opts)
};

/**
 * Processer for specifications with no or unknown type
 * @method process_other
 * @param manager {:api:`gma.manager`}
 * @param value {specification}
 * @param type {String}
 * @return {:api:`gma.renderHelper`}
*/
self.process_other = self.process_other || function(manager, value, type) {
    self.sanitise(value);
    var templateHelper = value.template || gma.unitCube;
    var box = templateHelper.getInstance();
    value._instance = box;
    return gma.renderHelper(value);
};

/**
 * Processer for skybox
 * @method process_skybox
 * @copy process_other
*/
self.process_skybox = self.process_skybox || function(manager, value, type) {
    if (!value.mesh) {
        value.mesh = gma.unitCubeInfo.mesh;
    }
    
    if (!value.texture && !value.material) {
        value.material = gma.unitCubeInfo.material;
    }
    
    if (value.texture && value.material) {
        delete value.material;
    }
    
    self.sanitise(value, {width:50, height:50, depth:1, x:0, y:0, z:-50})
    var box = gma.meshTemplate(value).getInstance();
    value._instance = box;
    return gma.renderHelper(value);
};

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
/*global require, _ */
require.def('gma/utils/parser',
    ['gma/base', 'gma/utils/base', 'gma/utils/background'],
    function(gma) {
        
        /** @module gma */
        /** @for utils */
        

///////////////////////////////////////////////////////////////////////////////

/**
 * Expands objects with "replicateWith" keys
 * @method expandReplicateWith
 * @param spec {Object} the object that we are expanding
 * @return {Expanded Spec}
*/
gma.utils.expandReplicateWith = function(spec) {
    var oldSpec = spec;
    
    // Apply replicate
    if (spec.replicateWith !== undefined) {
        spec = spec.replicateWith;
        delete oldSpec.replicateWith;
        spec = _.map(spec, function(item) {
            // Copy parent values into each new item
            var next = {};
            _.each(oldSpec, function(v, k) {
                next[k] = v;
            });
            
            _.each(item, function(v, k) {
                next[k] = v;
            });
            return next;
        });
        if (spec.length === 1) {
            spec = spec[0];
        }
    }
    oldSpec = spec;
    
    // Recurse
    if (_.isArray(spec)) {
        spec = [];
        _.each(oldSpec, function(item, index) {
            var flatten = (item.replicateWith !== undefined);
            var expanded = gma.utils.expandReplicateWith(item);
            if (flatten) {
                _.each(expanded, function(newItem) {
                    spec.push(newItem);
                });
            }
            else {
                spec.push(item);
            }
        });
    }
    else {
        if (!_.isString(spec) &&
            !_.isFunction(spec) &&
            !_.isNumber(spec) &&
            !_.isDate(spec) &&
            !_.isBoolean(spec)
        ) {
            // We assume a complex object has atleast one function in it
            if (!_.any(spec, function(s) { return _.isFunction(s); })) {
                _.each(spec, function(value, key) {
                    spec[key] = gma.utils.expandReplicateWith(value);
                });
            }
        }
    }
    return spec;
};


///////////////////////////////////////////////////////////////////////////////

/**
 * Creates Gamma objects and associated render helpers from a level specification
 * @class levelParser
*/
gma.levelParser = function(spec) {
    var self = spec || {};
    
    /**
     * Holds Render template objects to be assigned to entities
     * Could say something like
     *      
     *      banana = ['colladaTemplate',
     *           {
     *               collada : {
     *                   document : 'banana.gae'
     *               },
     *               yRot : 1.57,
     *               yOffset : -0.5,
     *               yScale : 0.7
     *           }
     *      ],
     * 
     * or have entries that are already an instantiated templateHelper
     * @property templates
     * @type Object
     * @default {} with "cube" and "redcube"
    */
    self.templates = self.templates || {
        cube : gma.unitCube,
        
        redcube : ['meshTemplate', {
            mesh : gma.unitCubeInfo.mesh,
            material : {color : "#900"}
        }]
    };
    
    /**
     * Associates names to gamma objects/render helpers
     * It 
     * @property types
     * @type Object
     * @default {default : ['platform', {template : "cube"}]}
    */
    self.types = self.types || {
        'default' : ['platform', {template : "cube"}]
    };
    
    /**
     * Processes a level specification and replaces it's content with gamma objects
     * @method processLevel
     * @param level {Object} The level specification
     * @return {Processed specification}
    */
    self.process = self.process || function(manager, level) {
        if (level.processed === true) {
            //Already processed, nothing to do
            return level;
        }
        
        // Create some variables        
        var validateOther = self.validate_other;
        var processOther  = self.process_other;
        
        level = self.preProcess(manager, level);

        // Handle all the parts of the specification
        _.each(level, function(value, key) {
            var func = self['validate_' + key] || validateOther;
            var valid = func(manager, key, value, level);
            
            if (!valid) {
                value = undefined;
                func = self['default_' + key];
                if (func) {
                    value = func();
                }
                else {
                    // Not valid and no default, remove it
                    delete level[key];
                }
            }
            
            if (value) {
                func = self['process_' + key] || processOther;
                func(manager, key, value, level);
            }
        });
        
        // Set the processed flag and return
        level.processed = true;
        return level;
    };
    
    /**
     * Ensures the level has the minimum amount specified
     * @method preProcess
     * @param level {Object} The level specification
    */
    self.preProcess = self.preProcess || function(manager, level) {
    
        level = gma.utils.expandReplicateWith(level);
        
        level.spawn = level.spawn || self.default_spawn();
        if (!level.spawn.main) {
            level.spawn.main = [0, 0];
        }
        
        level.light     = level.light     || self.default_light();
        level.camera    = level.camera    || self.default_camera();
        level.entities  = level.entities  || self.default_entities();
        
        level.bkgIds      = level.bkgIds      || [];
        level.removed     = level.removed     || [];
        level.following   = level.following   || {};
        level.background  = level.background  || [];
        level.levelExtras = level.levelExtras || ['camera'];
        
        return level;
    };
    
    /**######################
    ###
    ###   UTILITY
    ###
    ######################*/
    
    /**
     * Creates locX, locY and locZ keys from items in position array.
     * @method processPosition
     * @param obj {Object} Object potentially containing a position array
    */
    self.processPosition = self.processPosition || function(obj) {
        var locX = obj.locX || 0;
        var locY = obj.locY || 0;
        var locZ = obj.locZ || 0;
        
        if (obj.position) {
            var position = obj.position;
            var l = position.length;
            if (l > 0) {
                locX = position[0];
            }
            if (l > 1) {
                locY = position[1];
            }
            if (l > 2) {
                locZ = position[2];
            }
            
            obj.locX = locX;
            obj.locY = locY;
            obj.locZ = locZ;
            
            delete obj.position;
        }
    };
    
    
    /**
     * Remove attached from value and given to level.following
     * @param key {string} The key that will be used to reference the attached data
     * @param value {object} The specification that may have an 'attached' property
     * @param level {Level Specification} The level that we are attaching information to
     * @method processAttached
    */
    self.processAttached = self.processAttached || function(key, value, level) {
        if (value.attached) {
            if (key) {
                level.following[key] = value.attached;
            }
            delete value.attached;
        }
    };
    
    /**
     * Gets a template Helper from a spec
     * @param manager {:api:`gma.manager`}
     * @param templateSpec {String} Name of the template
     * @method determineTemplate
    */
    self.determineTemplate = self.determineTemplate || function(manager, templateSpec) {
        templateSpec = templateSpec || "cube";
        if (_.isString(templateSpec)) {
            var temp = templateSpec;
            templateSpec = self.templates[templateSpec];
            if (!templateSpec) {
                throw new Error("No such template as " + temp);
            }
        }
        
        if (!_.isArray(templateSpec)) {
            templateSpec = [templateSpec];
        }
        return manager.determineObject.apply(this, templateSpec);
    }
    
    /**######################
    ###
    ###   OTHER
    ###
    ######################*/
    
    /**
     * Validates other stuff
     * For the moment, nothing happens
     * @method validate_other
     * @param manager {:api:`gma.manager`}
     * @param key {String} The key of the parent object this value belongs to
     * @param value {Object} The value object being validated
     * @param level {Level Specification} The level currently being parsed
     * @return {Boolean}
    */
    self.validate_other = self.validate_other || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes other stuff
     * For the moment, nothing happens
     * @method process_other
     * @param manager {:api:`gma.manager`}
     * @param key {String} The key of the parent object this value belongs to
     * @param value {Object} The value object being processed
     * @param level {Level Specification} The level currently being parsed
     * @return {Boolean}
    */
    self.process_other = self.process_other || function(manager, key, value, level) {
    };
    
    /**######################
    ###
    ###   SPAWN
    ###
    ######################*/
    
    /**
     * Returns default value for the spawn object
     * @method default_spawn
    */
    self.default_spawn = self.default_spawn || function() {
        return {};
    };
    
    /**
     * Validates a spawn object
     * Spawn must be an object of {id : [x, y]}
     * @method validate_spawn
     * @copy validate_other
    */
    self.validate_spawn = self.validate_spawn || function(manager, key, value, level) {
        var valid = true;
        if (_.isArray(value) || _.isNumber(value) || _.isString(value) || _.isBoolean(value)) {
            valid = false;
            throw new Error("Spawn must be an object of {id : [x, y]}, not " + value);
        }
        
        _.each(value, function(v, k) {
            if (!_.isArray(v)) {
                valid = false;
                throw new Error("Each spawn location must be an array of [x, y], not " + v);
            }
            else {
                if (v.length > 2) {
                    valid = false;
                    throw new Error("Spawn location " + k + " should be [x, y], not " + v);
                }
            }
        });
        return valid;
    };
    
    /**
     * Processes a spawn object
     * Must ensure each position array has two numbers in it
     * @method process_spawn
     * @copy process_other
    */
    self.process_spawn = self.process_spawn || function(manager, key, value, level) {
        _.each(value, function(v, k) {
            if (v.length === 0) {
                // Don't have an x co-ordinate, so give it one
                v.push(0);
            }
            
            if (v.length === 1) {
                // Only have x co-ordinate, so we're giving it a y co-ordinate
                v.push(0);
            }
        });
    };

    /**######################
    ###
    ###   CAMERA
    ###
    ######################*/
    
    /**
     * Returns default value for the camera object
     * @method default_camera
    */
    self.default_camera = self.default_camera || function() {
        return {position : [0, 0, 50], attached : ['character']};
    };
    
    /**
     * Validates a camera specification
     * Camera must be an object
     * @method validate_camera
     * @copy validate_other
    */
    self.validate_camera = self.validate_camera || function(manager, key, value, level) {
        var valid = true;
        if (_.isArray(value) || _.isNumber(value) || _.isString(value) || _.isBoolean(value)) {
            valid = false;
            throw new Error("Camera must be an object, not " + value);
        }
        
        return valid;
    };
    
    /**
     * Processes a camera specification
     * Turn position in locX, locY and locZ
     * Remove attached from value and given to level.following
     * @method process_camera
     * @copy process_other
    */
    self.process_camera = self.process_camera || function(manager, key, value, level) {
        self.processPosition(value);
        self.processAttached(key, value, level);
    };
    
    /**######################
    ###
    ###   LIGHT
    ###
    ######################*/
    
    /**
     * Returns default value for the light object
     * @method default_light
    */
    self.default_light = self.default_light || function() {
        return {};
    };
    
    /**
     * Validates a light object
     * Light must be an array
     * @method validate_light
     * @copy validate_other
    */
    self.validate_light = self.validate_light || function(manager, key, value, level) {
        var valid = true;
        if (_.isArray(value) || _.isString(value) || _.isBoolean(value) || _.isNumber(value)) {
            valid = false;
            throw new Error("Light must be an object, not " + value);
        }
        
        return valid;
    };
    
    /**
     * Processes a light object
     * Turn position in locX, locY and locZ
     * Remove attached from level and given to level.following
     * @method process_light
     * @copy process_other
    */
    self.process_light = self.process_light || function(manager, key, value, level) {
        _.each(value, function(v, k) {
            level.levelExtras.push(k);
            self.processPosition(v);
            self.processAttached(k, v, level);
        });
    };
    
    /**######################
    ###
    ###   ENTITIES
    ###
    ######################*/
    
    /**
     * Returns default value for the entities list
     * @method default_entities
    */
    self.default_entities = self.default_entities || function() {
        return [];
    };
    
    /**
     * Validates an entities list
     * Entities must be an array
     * @method validate_entities
     * @copy validate_other
    */
    self.validate_entities = self.validate_entities || function(manager, key, value, level) {
        var valid = true;
        if (!_.isArray(value)) {
            valid = false;
            throw new Error("Entities must be a list, not " + value);
        }
        
        return valid;
    };
    
    /**
     * Processes a entities list
     * Turns them into gamma objects
     * @method process_entities
     * @copy process_other
    */
    
    self.process_entities = self.process_entities || function(manager, key, value, level) {
        _.each(value, function(obj, index) {
            if (obj.type === undefined) {
                obj.type = "default";
            }
            var templateSpec = obj.template;
            if (!_.any(obj, function(v, k) { return _.isFunction(v) && k !== 'getRotation'; })) {
                var typeInfo = self.types[obj.type];
                if (!typeInfo) {
                    throw new Error("No such type as " + obj.type);
                }
                
                // Don't need type on the object anymore
                delete obj.type;
                
                var typeName = typeInfo[0];
                var typeOpts = {};
                if (typeInfo[1]) {
                    _.each(typeInfo[1], function(v, k) {
                        typeOpts[k] = v;
                    });
                }
                
                if (obj) {
                    _.each(obj, function(v, k) {
                        typeOpts[k] = v;
                    });
                }
            
                templateSpec = templateSpec || typeOpts.template;
                delete typeOpts.template;
                
                obj = manager.determineObject(typeName, typeOpts);
            }
            
            var templateHelper = self.determineTemplate(manager, templateSpec);
            var focus = manager.prepareEntity(obj, templateHelper);
            value[index] = focus;
        });  
    };
    
    /**######################
    ###
    ###   BACKGROUND
    ###
    ######################*/
    
    /**
     * Validates a background list
     * @method validate_background
     * @copy validate_other
    */
    self.validate_background = self.validate_background || function(manager, key, value, level) {
        var valid = true;
        if (!_.isArray(value)) {
            valid = false;
            throw new Error("Background must be a list, not " + value);
        }
        
        return valid;
    };
    
    /**
     * Processes a background list
     * Just adds to self.background
     * @method process_background
     * @copy process_other
    */
    self.process_background = self.process_background || function(manager, key, value, level) {
        if (self.backgroundMaker === undefined) {
            self.backgroundMaker = gma.backgroundMaker({z:level.backgroundZ || -20})
        }
        
        var items = _.map(value, function(v) {
            if (v !== null && v !== undefined) {
                v.template = self.determineTemplate(manager, v.template);
            }
            return self.backgroundMaker.process(manager, v);
        });
        
        level.background = [];
        _.each(items, function(item) {
            if (item !== null && item !== undefined) {
                self.processAttached(item.id, item, level);
                if (item.id) {
                    level.bkgIds.push(item.id);
                }
                level.background.push(item);
            }
        });
    };
    
    /**######################
    ###
    ###   TYPES
    ###
    ######################*/
    
    /**
     * Validates a types object
     * @method validate_types
     * @copy validate_other
    */
    self.validate_types = self.validate_types || function(manager, key, value, level) {
        var valid = true;
        
        _.each(value, function(v, k) {
            if (!_.isArray(v)) {
                valid = false;
                throw new Error("Types must be arrays of [type, opts] Where type is a string name of the type, or the type itself");
            }
        });
        
        return valid;
    };
    
    /**
     * Processes a types object
     * Just adds to self.types
     * @method process_types
     * @copy process_other
    */
    self.process_types = self.process_types || function(manager, key, value, level) {
        _.each(value, function(v, k) {
            self.types[k] = v;
        });
    };
    
    /**######################
    ###
    ###   TEMPLATES
    ###
    ######################*/
    
    /**
     * Validates a templates object
     * @method validate_templates
     * @copy validate_other
    */
    self.validate_templates = self.validate_templates || function(manager, key, value, level) {
        var valid = true;
        
        _.each(value, function(v, k) {
            if (!_.isArray(v) && !_.any(v, function(v2, k2) { return _.isFunction(v[k2]);})) {
                valid = false;
                throw new Error("Templates must be arrays of [template, opts] Where template is a string name of the template, or the template itself");
            }
        });
        
        return valid;
    };
    
    /**
     * Processes a templates object
     * Just adds to self.templates
     * @method process_templates
     * @copy process_other
    */
    self.process_templates = self.process_templates || function(manager, key, value, level) {
        _.each(value, function(v, k) {
            self.templates[k] = v;
        });
    };        
    /**######################
    ###
    ###   BKGIDS
    ###
    ######################*/
    
    /**
     * Validates bkgIds
     * This is populated by process_background
     * @method validate_bkgIds
     * @copy validate_other
    */
    self.validate_bkgIds = self.validate_bkgIds || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes bkgIds
     * This is populated by process_background
     * @method process_bkgIds
     * @copy process_other
    */
    self.process_bkgIds = self.process_bkgIds || function(manager, key, value, level) {
    };
    
    /**######################
    ###
    ###   LEVEL EXTRAS
    ###
    ######################*/
    
    /**
     * Validates level extras specification
     * This is generated at run time and should be ignored
     * @method validate_levelExtras
     * @copy validate_other
    */
    self.validate_levelExtras = self.validate_levelExtras || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes level extras stuff
     * This is generated at run time and should be ignored
     * @method process_levelExtras
     * @copy process_other
    */
    self.process_levelExtras = self.process_levelExtras || function(manager, key, value, level) {
    };
    
    /**######################
    ###
    ###   FOLLOWING
    ###
    ######################*/
    
    /**
     * Validates following specification
     * This is generated at run time and should be ignored
     * @method validate_following
     * @copy validate_other
    */
    self.validate_following = self.validate_following || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes following stuff
     * This is generated at run time and should be ignored
     * @method process_following
     * @copy process_other
    */
    self.process_following = self.process_following || function(manager, key, value, level) {
    };
    
    /**######################
    ###
    ###   REMOVED
    ###
    ######################*/
    
    /**
     * Validates removed stuff
     * This is generated at run time and should be ignored
     * @method validate_removed
     * @copy validate_other
    */
    self.validate_removed = self.validate_removed || function(manager, key, value, level) {
        return true;
    };
    
    /**
     * Processes removed stuff
     * This is generated at run time and should be ignored
     * @method process_removed
     * @copy process_other
    */
    self.process_removed = self.process_removed || function(manager, key, value, level) {
    };
    
    
    return self;
};


///////////////////////////////////////////////////////////////////////////////

    }
);
/*global require */
require.def('gma/entities/collectable',
    ['gma/base', 'gma/entities/base', 'gma/entities/shapes', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a base platform object
     * @class collectable
     * @extends gma.shapes.rectangle
    */
    gma.collectable = function(spec) {
    
        var self = gma.shapes.rectangle(spec || {x:0, y:0, width:1, height:1});
        if (!self) {throw new Error("Can't create rectangle for platform");}

        /** @tag collectable */
        self.tags.collectable = true;
        
        /**
         * Remove the collectable. Should be overwritten to do something useful.
         * @method pickup
        */
        self.pickup = self.pickup || function() {
            self.alive = false;
        };

        return self;
    
    };
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a collectible object htat increases score
     * @class scoreCollectable
     * @extends gma.collectable
    */
    gma.scoreCollectable = function(spec) {
    
        var self = gma.collectable(spec);

        /** @tag scoreCollectable */
        self.tags.scoreCollectable = true;
        
        return self;
    };
    
///////////////////////////////////////////////////////////////////////////////

    }
);
/*global require, _ */
require.def('gma/entities/moveable',
    ['gma/base', 'gma/entities/base', 'gma/entities/shapes', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides functionality for a moveable shape
         * @class moveable
         * @extends gma.shapes.rectangle
        */
        gma.moveable = function(spec) {
        
            var self = gma.shapes.rectangle(spec || {x:0, y:0, width:1, height:1});
            if (!self) {throw new Error("Can't create rectangle for moveable");}
            
///////////////////////////////////////////////////////////////////////////////

    /** @tag moveable */
    self.tags.moveable = true;
    
    /**
     * Flag saying whether character is jumping, falling or neither
     * @property yState
     * @type :api:`gma.constant`
     * @default :constant:`FALLING`
    */
    self.yState      = self.yState || gma.constants.FALLING;
    
    /**
     * Flag saying whether character is going left, right or neither
     * @property xState
     * @type :api:`gma.constant`
     * @default :constant:`STILL`
    */
    self.xState     = self.xState || gma.constants.STILL;
    
    
    /**
     * Flag saying what direction character was going last before becoming horizontally still
     * @property lastXState
     * @type :api:`gma.constant`
     * @default self.xState
    */
    self.lastXState = self.lastXState || self.xState;
    
    /**
     * Number representing how fast the character is moving vertically
     * @property velocity
     * @type Number
     * @default 0
    */
    self.velocity = self.velocity || 0;

    /**
     * Number representing the initial velocity of a jump
     * @property jumpVelocity
     * @type Number
     * @default 4
    */
    self.jumpVelocity = self.jumpVelocity || 4;
    
    /**
     * Looks at the character's state and determines how far it should move
     * This result will then be checked for collisions and may be modified
     * If the character is jumping :
     * 
     * * Keep going up if haven't reached targetY
     * * else set vertical state to FALLING
     * 
     * If we're falling, then we go down
     * If horizontal state is not STILL, then we add horizontal movement.
     * @method getMovement
     * @param moveAmount {Number} The amount the character should move
     * @return {Amount to move as [x, y]}
    */
    self.getMovement = self.getMovement || function(moveAmount, manager) {
        var xMovement = 0;
        var yMovement = 0;
        var newVelocity = 0;
        
        // Vertical
        if (self.yState === gma.constants.JUMPING || self.yState === gma.constants.FALLING) {
            newVelocity = self.velocity + gma.constants.GRAVITY * moveAmount;
            yMovement = (newVelocity+self.velocity)/2*moveAmount;
            self.velocity = newVelocity;
            if (self.velocity <= 0) {
                self.yState = gma.constants.FALLING;
            }
        }
        
        // Horizontal
        if (self.xState === gma.constants.RIGHT) {
            xMovement += moveAmount;
        }
        
        if (self.xState === gma.constants.LEFT) {
            xMovement -= moveAmount;
        }
        
        return [xMovement, yMovement];
    };
    
    /**
     * Changes character's position according to it's state
     * First it asks getMovement how much we should move
     * Then it determines how far we can move given the environment
     * It will then change the state of the character accordingly
     * It will then determine if the character is on top of ground
     * and set vertical state to FALLING or STILL accordingly
     * @method animate
     * @param delta {Number} Time since last animation
     * @param manager {:api:`gma.manager`}
    */
    self.animate = self.animate || function(delta, manager) {
        if (delta < 0.05) { delta = 0.05; }
        var moveAmount = 10*delta;
        var movement = self.getMovement(moveAmount, manager);
        var xMovement = movement[0];
        var yMovement = movement[1];
        
        var vector = [0, 0];
        if (self.xState !== gma.constants.STILL || self.yState !== gma.constants.STILL) {
            vector = gma.collisions.detectCollisions(self, [xMovement, yMovement], manager.entities());
        }
        
        if (vector[1] === 0 && self.yState === gma.constants.JUMPING){
            self.yState = gma.constants.FALLING;
            self.velocity = 0;
        }
        self.updatePositions(vector);
        self.findGround(manager);
    };
    
    /**
     * Finds any ground the character is on and changes state accordingly
     * @param manager {:api:`gma.manager`}
     * @method findGround
    */
    self.findGround = self.findGround || function(manager) {
        var findGround = gma.collisions.factories.findGround(self);
        
        if (self.yState !== gma.constants.JUMPING) {
            if (_.filter(manager.entities(), findGround).length > 0) {
                self.yState = gma.constants.STILL;
                self.velocity = 0;
            }
            else {
                self.yState = gma.constants.FALLING;
            }
        }
    };
    
    /**
     * Changes it's position, centre, points and edges.
     * @method updatePositions
     * @param vector {[x, y]} Vector representing the amount character can move
    */
    self.updatePositions = self.updatePositions || function(vector) {
        var xMovement = vector[0];
        var yMovement = vector[1];
        
        if (_.isNumber(xMovement) && !isNaN(xMovement) && _.isNumber(yMovement) && !isNaN(yMovement)) {
        
            self.x += xMovement;
            self.left += xMovement;
            self.right += xMovement;
            
            self.y += yMovement;
            self.top += yMovement;
            self.bottom += yMovement;
            
            self.centre = [self.x, self.y];
            
            self.setPointsAndEdges();
        }
    };
    
    var angle = 0;
    
    /**
     * Gets rotation in radians
     * @method getRotation
     * @return {Number}
    */
    self.getRotation = self.getRotation || function () {
        var characterDirection = self.xState;
        if (characterDirection === gma.constants.STILL) {
            characterDirection = self.lastXState;
        }
        
        if (characterDirection === gma.constants.LEFT) {
            if (angle < 0.1) {
                angle += 0.5;
            }
            if (angle > 0.1) {
                angle = 0;
            }
        }
        else {
            if (angle > -3.15) {
                angle -= 0.5;
           }
            if (angle < -3.15) {
                angle = -3.14;
            }
        }
        return -angle;
    };
    
    /**
     * Kills the entity. Should be overwritten to do something useful.
     * @method kill
    */
    self.kill = self.kill || function() {
        self.xState = gma.constants.STILL;
        // Leave yState as it may be mid-jump
        self.alive = false;
    };

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
/*global require, window */
require.def('gma/entities/door',
    ['gma/base', 'gma/entities/base', 'gma/entities/moveable', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides a character object
         * @class door
         * @extends gma.shapes.rectangle
        */
        gma.door = function(spec) {
        
            var self = gma.shapes.rectangle(spec || {x:0, y:0, width:1, height:1});
            if (!self) {throw new Error("Can't create rectangle for door");}
            
///////////////////////////////////////////////////////////////////////////////
    
    /** @tag door */
    self.tags.door = true;
    
    /** 
    * Looks for door tag along with what super.collided does
    * @method collided 
    */
    var oldCollided = self.collided;
    self.collided = function() {
        oldCollided.apply(this, arguments);
        if (self.tags.door) {
            self.collided__door.apply(this, arguments);
        }
    };
    
    /**
     * Collision function for hitting a door
     * @method collided__door
     * @copy collided
    */
    self.collided__door = self.collided__door || function(w, focus) {
        if (focus.tags.character) {
            window.manager.loadLevel(self.level, self.spawnId);
        }
    };
///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
/*global require, _ */
require.def('gma/entities/enemy',
    ['gma/base', 'gma/entities/base', 'gma/entities/moveable', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides a base enemy object
     * @class enemy
     * @extends gma.moveable
    */
    gma.enemy = function(spec) {
    
        var self = gma.moveable(spec || {x:0, y:0, width:1, height:1});

        /** @tag enemy */
        self.tags.enemy = true;
        
        if (self.tags.platformer) {
            // Platformer's determineState does the same thing as moveable's findGround function
            self.findGround = function() {};
        }

        /** 
        * Enemy getMovement will first call determineState before doing super.getMovement
        * The enemy is the same as the character, except it
        * determines it's own next state, rather than the player
        * @method getMovement 
        */
        var oldGetMovement = self.getMovement;
        self.getMovement = function(moveAmount, manager) {
            self.determineState(moveAmount, manager);
            return oldGetMovement(moveAmount, manager);
        };
        
        /**
         * Determine the state of the enemy for the next movement
         * - Calls behaviour__jumping if it has jumping tag
         * - Calls behaviour__patrolling if it has patrolling tag
         * - Calls behaviour__platformer if it has platformer tag
         * @method determineState
         * @param moveAmount {Number} amount to move; based on delta from twitch
         * @param manager {:api:`gma.manager`}
        */
        self.determineState = self.determineState || function() {
            if (self.tags.jumping) {
                self.behaviour__jumping.apply(this, arguments);
            }
            
            if (self.tags.patrolling) {
                self.behaviour__patrolling.apply(this, arguments);
            }
            
            if (self.tags.platformer) {
                self.behaviour__platformer.apply(this, arguments);
            }
        };

        /** 
        * Enemy looks for rebound and weakhead tags as well as what super.collided looks for
        * It will also look for deathtouch, if enemy is still alive after all other checks
        * @method collided 
        */
        var oldCollided = self.collided;
        self.collided = function() {
            oldCollided.apply(this, arguments);
            if (self.tags.rebound) {
                self.collided__rebound.apply(this, arguments);
            }
            if (self.tags.weakhead) {
                self.collided__weakhead.apply(this, arguments);
            }
            
            if (self.alive && self.tags.deathtouch) {
                self.collided__deathtouch.apply(this, arguments);
            }
        };
        
        /**
         * Makes enemy jump when touching ground
         * @method behaviour__jumping
         * @copy determineState
        */
        self.behaviour__jumping = function(moveAmount, manager) {
            if (self.yState === gma.constants.STILL) {
                self.yState = gma.constants.JUMPING;
                self.velocity = self.jumpVelocity;
            }
        };
        
        /**
         * Makes enemy turn around when reaching the edge of the platform it is currently on
         * @method behaviour__platformer
         * @copy determineState
        */
        self.behaviour__platformer = function(moveAmount, manager) {
            var findGround = gma.collisions.factories.findGround(self);
            
            if (self.yState !== gma.constants.JUMPING) {
                var grounds = _.filter(manager.entities(), findGround);
                if (grounds.length > 0) {
                    if (self.yState === gma.constants.FALLING) {
                        self.yState = gma.constants.STILL;
                    }
                    var ground = grounds[0];
                    if (self.x <= ground.left) {
                        self.xState = gma.constants.RIGHT;
                    }
                    
                    if (self.x >= ground.right) {
                        self.xState = gma.constants.LEFT;
                    }
                    
                    if (self.xState === gma.constants.STILL) {
                        if (self.x < ground.x) {
                            self.xState = gma.constants.RIGHT;
                        }
                        else {
                            self.xState = gma.constants.LEFT;
                        }
                    }
                }
                else {
                    self.yState = gma.constants.FALLING;
                }
            }
        };
        
        /**
         * Makes enemy patrol a range 
         * Requires self.limitLeft and/or self.limitRight properties
         * @method behaviour__patrolling
         * @copy determineState
        */
        self.behaviour__patrolling = function(moveAmount, manager) {
            if(self.limitLeft && self.x <= self.limitLeft) {
                self.xState = gma.constants.RIGHT;
            }

            if (self.limitRight && self.x >= self.limitRight) {
                self.xState = gma.constants.LEFT;
            }

            if (self.xState === gma.constants.STILL) {
                self.xState = gma.constants.LEFT;
            }
        };
        
        /**
         * Makes enemy turn around if it hits something
         * @method collided__rebound
         * @copy collided
        */
        self.collided__rebound = function(where) {
            if (where === gma.constants.LEFT) {
                self.xState = gma.constants.RIGHT;
            }
            else if (where === gma.constants.RIGHT) {
                self.xState = gma.constants.LEFT;
            }
        };
        
        /**
         * Makes enemy die when character hit it's top
         * @method collided__weakhead
         * @copy collided
        */
        self.collided__weakhead = function(where, focus) {
            if (where === gma.constants.TOP && focus.tags.character) {
                self.kill();
            }
        };

        return self;
    
    };
        
///////////////////////////////////////////////////////////////////////////////

    /**
     * Provides an enemy that stays on a platform
     * @class platformEnemy
     * @extends gma.enemy
    */
    gma.platformEnemy = function(spec) {
    
        var self = gma.enemy(spec);
        
        /** @tag rebound */
        self.tags.rebound = true;
        /** @tag deathtouch */
        self.tags.deathtouch = true;
        /** @tag weakhead */
        self.tags.weakhead = true;
        /** @tag platformer */
        self.tags.platformer = true;

        // platformer tag makes determineState does the same thing as the findGround function
        self.findGround = function() {};
        
        return self;
    
    };

    /**
     * Provides an enemy that jumps on a platform
     * @class jumpingEnemy
     * @extends gma.enemy
    */
    gma.jumpingEnemy = function(spec) {
    
        var self = gma.enemy(spec);

        /** @tag deathtouch */
        self.tags.deathtouch = true;
        /** @tag weakhead */
        self.tags.weakhead = true;
        /** @tag jumping */
        self.tags.jumping = true;
        
        return self;
    
    };

    /**
     * Provides an enemy that patrols a particular range
     * @class patrolEnemy
     * @extends gma.enemy
    */
    gma.patrolEnemy = function(spec) {

        var self = gma.enemy(spec);

        /** @tag rebound */
        self.tags.rebound = true;
        /** @tag deathtouch */
        self.tags.deathtouch = true;
        /** @tag weakhead */
        self.tags.weakhead = true;
        /** @tag patrolling */
        self.tags.patrolling = true;

        return self;

    };
    
///////////////////////////////////////////////////////////////////////////////

    }
);
/*global require */
require.def('gma/entities/character',
    ['gma/base', 'gma/entities/moveable', 'gma/utils/collisions'],
    function(gma) {
        
        /** @module gma */
        
        /**
         * Provides a character object
         * @class character
         * @extends gma.moveable
        */
        gma.character = function(spec) {
        
            var self = gma.moveable(spec || {x:0, y:0, width:1, height:1});
            if (!self) {throw new Error("Can't create rectangle for character");}
            
///////////////////////////////////////////////////////////////////////////////
    
    /** @tag character */
    self.tags.character = true;
     
    /**
     * Holds a score counter
     * @property score
     * @type Number
    */
    self.score = self.score || 0;
    
    /**
     * Makes character ready for jumping
     * It will only set character to jumping if it's in the STILL state
     * It will also set self.targetY to it's current y plus it's jumpHeigt
     * @method jump
     * @param e {Event} Keyboard event object
    */
    self.jump = self.jump || function(e) {
        if (self.alive) {
            if (self.yState === gma.constants.STILL) {
                self.yState = gma.constants.JUMPING;
                self.velocity = self.jumpVelocity;
            }
        }
    };
    
    /**
     * Changes character's horizontal state
     * @method move
     * @param direction {:api:`gma.constant`} gma.constant representing whether character is going left or right
     * @param e {Event} Keyboard event object
    */
    self.move = self.move || function(direction, e) {
        if (self.alive) {
            if (e.type==="keyup") {
                if (self.xState === direction) {
                    self.lastXState = self.xState;
                    self.xState = gma.constants.STILL;
                }
            }
            else {
                if (direction) {
                    if (direction === gma.constants.LEFT || direction === gma.constants.RIGHT) {
                        self.xState = direction;
                    }
                    else {
                        throw new Error("You can only call move() with constants.LEFT or constants.RIGHT");
                    }
                }
                else {
                    throw new Error("You need to supply a direction to move()");
                }
            }
        }
    };
    
    /**
     * Collided function for character
     * Determines if we hit a collectable and what to do with it
     * @method collided
    */
    var oldCollided = self.collided;
    self.collided = function(w, focus) {
        oldCollided.apply(this, arguments);
        if (focus.tags.collectable) {
            self.collided__pickupCollectable.apply(this, arguments);
        }
    };
    
    
    /**
     * Collision function for hitting a collectable
     * @method collided__pickupCollectable
     * @copy collided
    */
    self.collided__pickupCollectable = self.collided__pickupCollectable || function(w, focus) {
        focus.pickup();
        if (focus.tags.scoreCollectable) {
            self.score = self.score + 1;
        }
    };

///////////////////////////////////////////////////////////////////////////////

            return self;
        
        };
    }
);
/*global require, window */
require.def('gma/support/base64',
    [],
    function() {
            
///////////////////////////////////////////////////////////////////////////////
    
    /* Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
     * Version: 1.0
     * LastModified: Dec 25 1999
     * This library is free.  You can redistribute it and/or modify it.
     */

    /*
     * Interfaces:
     * b64 = base64encode(data);
     * data = base64decode(b64);
     */

    (function() {

    var base64EncodeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var base64DecodeChars = new Array(
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
        -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63,
        52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1,
        -1,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14,
        15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1,
        -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1);

    function base64encode(str) {
        var out, i, len;
        var c1, c2, c3;

        len = str.length;
        i = 0;
        out = "";
        while(i < len) {
            c1 = str.charCodeAt(i++) & 0xff;
            if(i == len) {
                out += base64EncodeChars.charAt(c1 >> 2);
                out += base64EncodeChars.charAt((c1 & 0x3) << 4);
                out += "==";
                break;
            }
            c2 = str.charCodeAt(i++);
            if(i == len) {
                out += base64EncodeChars.charAt(c1 >> 2);
                out += base64EncodeChars.charAt(((c1 & 0x3)<< 4) | ((c2 & 0xF0) >> 4));
                out += base64EncodeChars.charAt((c2 & 0xF) << 2);
                out += "=";
                break;
            }
            c3 = str.charCodeAt(i++);
            out += base64EncodeChars.charAt(c1 >> 2);
            out += base64EncodeChars.charAt(((c1 & 0x3)<< 4) | ((c2 & 0xF0) >> 4));
            out += base64EncodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >>6));
            out += base64EncodeChars.charAt(c3 & 0x3F);
        }
        return out;
    }

    function base64decode(str) {
        var c1, c2, c3, c4;
        var i, len, out;

        len = str.length;
        i = 0;
        out = "";
        while(i < len) {
            /* c1 */
            do {
                c1 = base64DecodeChars[str.charCodeAt(i++) & 0xff];
            } while(i < len && c1 === -1);
            if(c1 === -1) {
                break;
            }

            /* c2 */
            do {
                c2 = base64DecodeChars[str.charCodeAt(i++) & 0xff];
            } while(i < len && c2 == -1);
            if(c2 == -1) {
                break;
            }

            out += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4));

            /* c3 */
            do {
                c3 = str.charCodeAt(i++) & 0xff;
                if(c3 == 61) {
                    return out;
                }
                c3 = base64DecodeChars[c3];
            } while(i < len && c3 == -1);
            if(c3 == -1) {
                break;
            }

            out += String.fromCharCode(((c2 & 0XF) << 4) | ((c3 & 0x3C) >> 2));

            /* c4 */
            do {
                c4 = str.charCodeAt(i++) & 0xff;
                if(c4 == 61) {
                    return out;
                }
                c4 = base64DecodeChars[c4];
            } while(i < len && c4 == -1);
            if(c4 == -1) {
                break;
            }
            out += String.fromCharCode(((c3 & 0x03) << 6) | c4);
        }
        return out;
    }

    if (!window.btoa) {window.btoa = base64encode;}
    if (!window.atob) {window.atob = base64decode;}

    })();

///////////////////////////////////////////////////////////////////////////////

    }
);
/*global require, window, Canvas2Image */
require.def('gma/support/canvas2image',
    ['gma/support/base64'],
    function() {
            
///////////////////////////////////////////////////////////////////////////////
    
    /*
     * Canvas2Image v0.1
     * Copyright (c) 2008 Jacob Seidelin, jseidelin@nihilogic.dk
     * MIT License [http://www.opensource.org/licenses/mit-license.php]
     */

    Canvas2Image = (function() {

        // check if we have canvas support
        var bHasCanvas = false;
        var oCanvas = document.createElement("canvas");
        if (oCanvas.getContext("2d")) {
            bHasCanvas = true;
        }

        // no canvas, bail out.
        if (!bHasCanvas) {
            return {
                saveAsBMP : function(){},
                saveAsPNG : function(){},
                saveAsJPEG : function(){}
            };
        }

        var bHasImageData = !!(oCanvas.getContext("2d").getImageData);
        var bHasDataURL = !!(oCanvas.toDataURL);
        var bHasBase64 = !!(window.btoa);

        var strDownloadMime = "image/octet-stream";

        // ok, we're good
        var readCanvasData = function(oCanvas) {
            var iWidth = parseInt(oCanvas.width, 10);
            var iHeight = parseInt(oCanvas.height, 10);
            return oCanvas.getContext("2d").getImageData(0,0,iWidth,iHeight);
        };

        // base64 encodes either a string or an array of charcodes
        var encodeData = function(data) {
            var strData = "";
            if (typeof data == "string") {
                strData = data;
            } else {
                var aData = data;
                for (var i=0;i<aData.length;i++) {
                    strData += String.fromCharCode(aData[i]);
                }
            }
            return window.btoa(strData);
        };

        // creates a base64 encoded string containing BMP data
        // takes an imagedata object as argument
        var createBMP = function(oData) {
            var aHeader = [];
    
            var iWidth = oData.width;
            var iHeight = oData.height;

            aHeader.push(0x42); // magic 1
            aHeader.push(0x4D);
    
            var iFileSize = iWidth*iHeight*3 + 54; // total header size = 54 bytes
            aHeader.push(iFileSize % 256); iFileSize = Math.floor(iFileSize / 256);
            aHeader.push(iFileSize % 256); iFileSize = Math.floor(iFileSize / 256);
            aHeader.push(iFileSize % 256); iFileSize = Math.floor(iFileSize / 256);
            aHeader.push(iFileSize % 256);

            aHeader.push(0); // reserved
            aHeader.push(0);
            aHeader.push(0); // reserved
            aHeader.push(0);

            aHeader.push(54); // dataoffset
            aHeader.push(0);
            aHeader.push(0);
            aHeader.push(0);

            var aInfoHeader = [];
            aInfoHeader.push(40); // info header size
            aInfoHeader.push(0);
            aInfoHeader.push(0);
            aInfoHeader.push(0);

            var iImageWidth = iWidth;
            aInfoHeader.push(iImageWidth % 256); iImageWidth = Math.floor(iImageWidth / 256);
            aInfoHeader.push(iImageWidth % 256); iImageWidth = Math.floor(iImageWidth / 256);
            aInfoHeader.push(iImageWidth % 256); iImageWidth = Math.floor(iImageWidth / 256);
            aInfoHeader.push(iImageWidth % 256);
    
            var iImageHeight = iHeight;
            aInfoHeader.push(iImageHeight % 256); iImageHeight = Math.floor(iImageHeight / 256);
            aInfoHeader.push(iImageHeight % 256); iImageHeight = Math.floor(iImageHeight / 256);
            aInfoHeader.push(iImageHeight % 256); iImageHeight = Math.floor(iImageHeight / 256);
            aInfoHeader.push(iImageHeight % 256);
    
            aInfoHeader.push(1); // num of planes
            aInfoHeader.push(0);
    
            aInfoHeader.push(24); // num of bits per pixel
            aInfoHeader.push(0);
    
            aInfoHeader.push(0); // compression = none
            aInfoHeader.push(0);
            aInfoHeader.push(0);
            aInfoHeader.push(0);
    
            var iDataSize = iWidth*iHeight*3;
            aInfoHeader.push(iDataSize % 256); iDataSize = Math.floor(iDataSize / 256);
            aInfoHeader.push(iDataSize % 256); iDataSize = Math.floor(iDataSize / 256);
            aInfoHeader.push(iDataSize % 256); iDataSize = Math.floor(iDataSize / 256);
            aInfoHeader.push(iDataSize % 256);
    
            for (var i=0;i<16;i++) {
                aInfoHeader.push(0);    // these bytes not used
            }
    
            var iPadding = (4 - ((iWidth * 3) % 4)) % 4;

            var aImgData = oData.data;

            var strPixelData = "";
            var y = iHeight;
            do {
                var iOffsetY = iWidth*(y-1)*4;
                var strPixelRow = "";
                for (var x=0;x<iWidth;x++) {
                    var iOffsetX = 4*x;

                    strPixelRow += String.fromCharCode(aImgData[iOffsetY+iOffsetX+2]);
                    strPixelRow += String.fromCharCode(aImgData[iOffsetY+iOffsetX+1]);
                    strPixelRow += String.fromCharCode(aImgData[iOffsetY+iOffsetX]);
                }
                for (var c=0;c<iPadding;c++) {
                    strPixelRow += String.fromCharCode(0);
                }
                strPixelData += strPixelRow;
            } while (--y);

            var strEncoded = encodeData(aHeader.concat(aInfoHeader)) + encodeData(strPixelData);

            return strEncoded;
        };


        // sends the generated file to the client
        var saveFile = function(strData) {
            document.location.href = strData;
        };

        var makeDataURI = function(strData, strMime) {
            return "data:" + strMime + ";base64," + strData;
        };

        // generates a <img> object containing the imagedata
        var makeImageObject = function(strSource) {
            var oImgElement = document.createElement("img");
            oImgElement.src = strSource;
            return oImgElement;
        };

        var scaleCanvas = function(oCanvas, iWidth, iHeight) {
            if (iWidth && iHeight) {
                var oSaveCanvas = document.createElement("canvas");
                oSaveCanvas.width = iWidth;
                oSaveCanvas.height = iHeight;
                oSaveCanvas.style.width = iWidth+"px";
                oSaveCanvas.style.height = iHeight+"px";

                var oSaveCtx = oSaveCanvas.getContext("2d");

                oSaveCtx.drawImage(oCanvas, 0, 0, oCanvas.width, oCanvas.height, 0, 0, iWidth, iHeight);
                return oSaveCanvas;
            }
            return oCanvas;
        };

        return {

            saveAsPNG : function(oCanvas, bReturnImg, iWidth, iHeight) {
                if (!bHasDataURL) {
                    return false;
                }
                var oScaledCanvas = scaleCanvas(oCanvas, iWidth, iHeight);
                var strData = oScaledCanvas.toDataURL("image/png");
                if (bReturnImg) {
                    return makeImageObject(strData);
                } else {
                    saveFile(strData.replace("image/png", strDownloadMime));
                }
                return true;
            },

            saveAsJPEG : function(oCanvas, bReturnImg, iWidth, iHeight) {
                if (!bHasDataURL) {
                    return false;
                }

                var oScaledCanvas = scaleCanvas(oCanvas, iWidth, iHeight);
                var strMime = "image/jpeg";
                var strData = oScaledCanvas.toDataURL(strMime);
    
                // check if browser actually supports jpeg by looking for the mime type in the data uri.
                // if not, return false
                if (strData.indexOf(strMime) != 5) {
                    return false;
                }

                if (bReturnImg) {
                    return makeImageObject(strData);
                } else {
                    saveFile(strData.replace(strMime, strDownloadMime));
                }
                return true;
            },

            saveAsBMP : function(oCanvas, bReturnImg, iWidth, iHeight) {
                if (!(bHasImageData && bHasBase64)) {
                    return false;
                }

                var oScaledCanvas = scaleCanvas(oCanvas, iWidth, iHeight);

                var oData = readCanvasData(oScaledCanvas);
                var strImgData = createBMP(oData);
                if (bReturnImg) {
                    return makeImageObject(makeDataURI(strImgData, "image/bmp"));
                } else {
                    saveFile(makeDataURI(strImgData, strDownloadMime));
                }
                return true;
            }
        };

    })();
            
///////////////////////////////////////////////////////////////////////////////

    }
);
/*global require, Canvas2Image, $ */
require.def('gma/utils/image',
    ['gma/base', 'gma/utils/base', 'gma/support/canvas2image'],
    function(gma) {
    
        /**@for gma */

///////////////////////////////////////////////////////////////////////////////

    /**
     * Creates a png image of the canvas
     * @method makeImage
     * @param manager {:api:`gma.manager`}
     * @param width {Number} Width of the png
     * @param height {Number} Height of the png
     * @return {Base64-PNG}
    */
    gma.makeImage = function(manager, width, height) {
        var canvas = manager.canvas;
        return Canvas2Image.saveAsPNG(canvas, true, width, height);
    };
    
    /**
     * Asks the server to check an image against one it already has
     * @method checkImage
     * @param png {Base64-PNG} Png to check
     * @param checkAgainst {string} Location of image to check
     * @return {Result from the server}
    */
    gma.checkImage = function(png, checkAgainst) {
        eval("var result = " + $.ajax({
            url:'/check/image',
            async:false,
            data:{checkAgainst:checkAgainst, png:png.src}
        }).responseText);
        return result;
    };

///////////////////////////////////////////////////////////////////////////////

    }
);
define("compiled/gma", function(){});
define("compiled/libs", function(){});
/*!
 * jQuery JavaScript Library v1.4.2
 * http://jquery.com/
 *
 * Copyright 2010, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * Includes Sizzle.js
 * http://sizzlejs.com/
 * Copyright 2010, The Dojo Foundation
 * Released under the MIT, BSD, and GPL Licenses.
 *
 * Date: Sat Feb 13 22:33:48 2010 -0500
 */
(function( window, undefined ) {

// Define a local copy of jQuery
var jQuery = function( selector, context ) {
		// The jQuery object is actually just the init constructor 'enhanced'
		return new jQuery.fn.init( selector, context );
	},

	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$,

	// Use the correct document accordingly with window argument (sandbox)
	document = window.document,

	// A central reference to the root jQuery(document)
	rootjQuery,

	// A simple way to check for HTML strings or ID strings
	// (both of which we optimize for)
	quickExpr = /^[^<]*(<[\w\W]+>)[^>]*$|^#([\w-]+)$/,

	// Is it a simple selector
	isSimple = /^.[^:#\[\.,]*$/,

	// Check if a string has a non-whitespace character in it
	rnotwhite = /\S/,

	// Used for trimming whitespace
	rtrim = /^(\s|\u00A0)+|(\s|\u00A0)+$/g,

	// Match a standalone tag
	rsingleTag = /^<(\w+)\s*\/?>(?:<\/\1>)?$/,

	// Keep a UserAgent string for use with jQuery.browser
	userAgent = navigator.userAgent,

	// For matching the engine and version of the browser
	browserMatch,
	
	// Has the ready events already been bound?
	readyBound = false,
	
	// The functions to execute on DOM ready
	readyList = [],

	// The ready event handler
	DOMContentLoaded,

	// Save a reference to some core methods
	toString = Object.prototype.toString,
	hasOwnProperty = Object.prototype.hasOwnProperty,
	push = Array.prototype.push,
	slice = Array.prototype.slice,
	indexOf = Array.prototype.indexOf;

jQuery.fn = jQuery.prototype = {
	init: function( selector, context ) {
		var match, elem, ret, doc;

		// Handle $(""), $(null), or $(undefined)
		if ( !selector ) {
			return this;
		}

		// Handle $(DOMElement)
		if ( selector.nodeType ) {
			this.context = this[0] = selector;
			this.length = 1;
			return this;
		}
		
		// The body element only exists once, optimize finding it
		if ( selector === "body" && !context ) {
			this.context = document;
			this[0] = document.body;
			this.selector = "body";
			this.length = 1;
			return this;
		}

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			// Are we dealing with HTML string or an ID?
			match = quickExpr.exec( selector );

			// Verify a match, and that no context was specified for #id
			if ( match && (match[1] || !context) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[1] ) {
					doc = (context ? context.ownerDocument || context : document);

					// If a single string is passed in and it's a single tag
					// just do a createElement and skip the rest
					ret = rsingleTag.exec( selector );

					if ( ret ) {
						if ( jQuery.isPlainObject( context ) ) {
							selector = [ document.createElement( ret[1] ) ];
							jQuery.fn.attr.call( selector, context, true );

						} else {
							selector = [ doc.createElement( ret[1] ) ];
						}

					} else {
						ret = buildFragment( [ match[1] ], [ doc ] );
						selector = (ret.cacheable ? ret.fragment.cloneNode(true) : ret.fragment).childNodes;
					}
					
					return jQuery.merge( this, selector );
					
				// HANDLE: $("#id")
				} else {
					elem = document.getElementById( match[2] );

					if ( elem ) {
						// Handle the case where IE and Opera return items
						// by name instead of ID
						if ( elem.id !== match[2] ) {
							return rootjQuery.find( selector );
						}

						// Otherwise, we inject the element directly into the jQuery object
						this.length = 1;
						this[0] = elem;
					}

					this.context = document;
					this.selector = selector;
					return this;
				}

			// HANDLE: $("TAG")
			} else if ( !context && /^\w+$/.test( selector ) ) {
				this.selector = selector;
				this.context = document;
				selector = document.getElementsByTagName( selector );
				return jQuery.merge( this, selector );

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return (context || rootjQuery).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return jQuery( context ).find( selector );
			}

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( jQuery.isFunction( selector ) ) {
			return rootjQuery.ready( selector );
		}

		if (selector.selector !== undefined) {
			this.selector = selector.selector;
			this.context = selector.context;
		}

		return jQuery.makeArray( selector, this );
	},

	// Start with an empty selector
	selector: "",

	// The current version of jQuery being used
	jquery: "1.4.2",

	// The default length of a jQuery object is 0
	length: 0,

	// The number of elements contained in the matched element set
	size: function() {
		return this.length;
	},

	toArray: function() {
		return slice.call( this, 0 );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {
		return num == null ?

			// Return a 'clean' array
			this.toArray() :

			// Return just the object
			( num < 0 ? this.slice(num)[ 0 ] : this[ num ] );
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems, name, selector ) {
		// Build a new jQuery matched element set
		var ret = jQuery();

		if ( jQuery.isArray( elems ) ) {
			push.apply( ret, elems );
		
		} else {
			jQuery.merge( ret, elems );
		}

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		ret.context = this.context;

		if ( name === "find" ) {
			ret.selector = this.selector + (this.selector ? " " : "") + selector;
		} else if ( name ) {
			ret.selector = this.selector + "." + name + "(" + selector + ")";
		}

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	// (You can seed the arguments with an array of args, but this is
	// only used internally.)
	each: function( callback, args ) {
		return jQuery.each( this, callback, args );
	},
	
	ready: function( fn ) {
		// Attach the listeners
		jQuery.bindReady();

		// If the DOM is already ready
		if ( jQuery.isReady ) {
			// Execute the function immediately
			fn.call( document, jQuery );

		// Otherwise, remember the function for later
		} else if ( readyList ) {
			// Add the function to the wait list
			readyList.push( fn );
		}

		return this;
	},
	
	eq: function( i ) {
		return i === -1 ?
			this.slice( i ) :
			this.slice( i, +i + 1 );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ),
			"slice", slice.call(arguments).join(",") );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map(this, function( elem, i ) {
			return callback.call( elem, i, elem );
		}));
	},
	
	end: function() {
		return this.prevObject || jQuery(null);
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: [].sort,
	splice: [].splice
};

// Give the init function the jQuery prototype for later instantiation
jQuery.fn.init.prototype = jQuery.fn;

jQuery.extend = jQuery.fn.extend = function() {
	// copy reference to target object
	var target = arguments[0] || {}, i = 1, length = arguments.length, deep = false, options, name, src, copy;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !jQuery.isFunction(target) ) {
		target = {};
	}

	// extend jQuery itself if only one argument is passed
	if ( length === i ) {
		target = this;
		--i;
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( (options = arguments[ i ]) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging object literal values or arrays
				if ( deep && copy && ( jQuery.isPlainObject(copy) || jQuery.isArray(copy) ) ) {
					var clone = src && ( jQuery.isPlainObject(src) || jQuery.isArray(src) ) ? src
						: jQuery.isArray(copy) ? [] : {};

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend({
	noConflict: function( deep ) {
		window.$ = _$;

		if ( deep ) {
			window.jQuery = _jQuery;
		}

		return jQuery;
	},
	
	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,
	
	// Handle when the DOM is ready
	ready: function() {
		// Make sure that the DOM is not already loaded
		if ( !jQuery.isReady ) {
			// Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
			if ( !document.body ) {
				return setTimeout( jQuery.ready, 13 );
			}

			// Remember that the DOM is ready
			jQuery.isReady = true;

			// If there are functions bound, to execute
			if ( readyList ) {
				// Execute all of them
				var fn, i = 0;
				while ( (fn = readyList[ i++ ]) ) {
					fn.call( document, jQuery );
				}

				// Reset the list of functions
				readyList = null;
			}

			// Trigger any bound ready events
			if ( jQuery.fn.triggerHandler ) {
				jQuery( document ).triggerHandler( "ready" );
			}
		}
	},
	
	bindReady: function() {
		if ( readyBound ) {
			return;
		}

		readyBound = true;

		// Catch cases where $(document).ready() is called after the
		// browser event has already occurred.
		if ( document.readyState === "complete" ) {
			return jQuery.ready();
		}

		// Mozilla, Opera and webkit nightlies currently support this event
		if ( document.addEventListener ) {
			// Use the handy event callback
			document.addEventListener( "DOMContentLoaded", DOMContentLoaded, false );
			
			// A fallback to window.onload, that will always work
			window.addEventListener( "load", jQuery.ready, false );

		// If IE event model is used
		} else if ( document.attachEvent ) {
			// ensure firing before onload,
			// maybe late but safe also for iframes
			document.attachEvent("onreadystatechange", DOMContentLoaded);
			
			// A fallback to window.onload, that will always work
			window.attachEvent( "onload", jQuery.ready );

			// If IE and not a frame
			// continually check to see if the document is ready
			var toplevel = false;

			try {
				toplevel = window.frameElement == null;
			} catch(e) {}

			if ( document.documentElement.doScroll && toplevel ) {
				doScrollCheck();
			}
		}
	},

	// See test/unit/core.js for details concerning isFunction.
	// Since version 1.3, DOM methods and functions like alert
	// aren't supported. They return false on IE (#2968).
	isFunction: function( obj ) {
		return toString.call(obj) === "[object Function]";
	},

	isArray: function( obj ) {
		return toString.call(obj) === "[object Array]";
	},

	isPlainObject: function( obj ) {
		// Must be an Object.
		// Because of IE, we also have to check the presence of the constructor property.
		// Make sure that DOM nodes and window objects don't pass through, as well
		if ( !obj || toString.call(obj) !== "[object Object]" || obj.nodeType || obj.setInterval ) {
			return false;
		}
		
		// Not own constructor property must be Object
		if ( obj.constructor
			&& !hasOwnProperty.call(obj, "constructor")
			&& !hasOwnProperty.call(obj.constructor.prototype, "isPrototypeOf") ) {
			return false;
		}
		
		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
	
		var key;
		for ( key in obj ) {}
		
		return key === undefined || hasOwnProperty.call( obj, key );
	},

	isEmptyObject: function( obj ) {
		for ( var name in obj ) {
			return false;
		}
		return true;
	},
	
	error: function( msg ) {
		throw msg;
	},
	
	parseJSON: function( data ) {
		if ( typeof data !== "string" || !data ) {
			return null;
		}

		// Make sure leading/trailing whitespace is removed (IE can't handle it)
		data = jQuery.trim( data );
		
		// Make sure the incoming data is actual JSON
		// Logic borrowed from http://json.org/json2.js
		if ( /^[\],:{}\s]*$/.test(data.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
			.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
			.replace(/(?:^|:|,)(?:\s*\[)+/g, "")) ) {

			// Try to use the native JSON parser first
			return window.JSON && window.JSON.parse ?
				window.JSON.parse( data ) :
				(new Function("return " + data))();

		} else {
			jQuery.error( "Invalid JSON: " + data );
		}
	},

	noop: function() {},

	// Evalulates a script in a global context
	globalEval: function( data ) {
		if ( data && rnotwhite.test(data) ) {
			// Inspired by code by Andrea Giammarchi
			// http://webreflection.blogspot.com/2007/08/global-scope-evaluation-and-dom.html
			var head = document.getElementsByTagName("head")[0] || document.documentElement,
				script = document.createElement("script");

			script.type = "text/javascript";

			if ( jQuery.support.scriptEval ) {
				script.appendChild( document.createTextNode( data ) );
			} else {
				script.text = data;
			}

			// Use insertBefore instead of appendChild to circumvent an IE6 bug.
			// This arises when a base node is used (#2709).
			head.insertBefore( script, head.firstChild );
			head.removeChild( script );
		}
	},

	nodeName: function( elem, name ) {
		return elem.nodeName && elem.nodeName.toUpperCase() === name.toUpperCase();
	},

	// args is for internal usage only
	each: function( object, callback, args ) {
		var name, i = 0,
			length = object.length,
			isObj = length === undefined || jQuery.isFunction(object);

		if ( args ) {
			if ( isObj ) {
				for ( name in object ) {
					if ( callback.apply( object[ name ], args ) === false ) {
						break;
					}
				}
			} else {
				for ( ; i < length; ) {
					if ( callback.apply( object[ i++ ], args ) === false ) {
						break;
					}
				}
			}

		// A special, fast, case for the most common use of each
		} else {
			if ( isObj ) {
				for ( name in object ) {
					if ( callback.call( object[ name ], name, object[ name ] ) === false ) {
						break;
					}
				}
			} else {
				for ( var value = object[0];
					i < length && callback.call( value, i, value ) !== false; value = object[++i] ) {}
			}
		}

		return object;
	},

	trim: function( text ) {
		return (text || "").replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( array, results ) {
		var ret = results || [];

		if ( array != null ) {
			// The window, strings (and functions) also have 'length'
			// The extra typeof function check is to prevent crashes
			// in Safari 2 (See: #3039)
			if ( array.length == null || typeof array === "string" || jQuery.isFunction(array) || (typeof array !== "function" && array.setInterval) ) {
				push.call( ret, array );
			} else {
				jQuery.merge( ret, array );
			}
		}

		return ret;
	},

	inArray: function( elem, array ) {
		if ( array.indexOf ) {
			return array.indexOf( elem );
		}

		for ( var i = 0, length = array.length; i < length; i++ ) {
			if ( array[ i ] === elem ) {
				return i;
			}
		}

		return -1;
	},

	merge: function( first, second ) {
		var i = first.length, j = 0;

		if ( typeof second.length === "number" ) {
			for ( var l = second.length; j < l; j++ ) {
				first[ i++ ] = second[ j ];
			}
		
		} else {
			while ( second[j] !== undefined ) {
				first[ i++ ] = second[ j++ ];
			}
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, inv ) {
		var ret = [];

		// Go through the array, only saving the items
		// that pass the validator function
		for ( var i = 0, length = elems.length; i < length; i++ ) {
			if ( !inv !== !callback( elems[ i ], i ) ) {
				ret.push( elems[ i ] );
			}
		}

		return ret;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var ret = [], value;

		// Go through the array, translating each of the items to their
		// new value (or values).
		for ( var i = 0, length = elems.length; i < length; i++ ) {
			value = callback( elems[ i ], i, arg );

			if ( value != null ) {
				ret[ ret.length ] = value;
			}
		}

		return ret.concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	proxy: function( fn, proxy, thisObject ) {
		if ( arguments.length === 2 ) {
			if ( typeof proxy === "string" ) {
				thisObject = fn;
				fn = thisObject[ proxy ];
				proxy = undefined;

			} else if ( proxy && !jQuery.isFunction( proxy ) ) {
				thisObject = proxy;
				proxy = undefined;
			}
		}

		if ( !proxy && fn ) {
			proxy = function() {
				return fn.apply( thisObject || this, arguments );
			};
		}

		// Set the guid of unique handler to the same of original handler, so it can be removed
		if ( fn ) {
			proxy.guid = fn.guid = fn.guid || proxy.guid || jQuery.guid++;
		}

		// So proxy can be declared as an argument
		return proxy;
	},

	// Use of jQuery.browser is frowned upon.
	// More details: http://docs.jquery.com/Utilities/jQuery.browser
	uaMatch: function( ua ) {
		ua = ua.toLowerCase();

		var match = /(webkit)[ \/]([\w.]+)/.exec( ua ) ||
			/(opera)(?:.*version)?[ \/]([\w.]+)/.exec( ua ) ||
			/(msie) ([\w.]+)/.exec( ua ) ||
			!/compatible/.test( ua ) && /(mozilla)(?:.*? rv:([\w.]+))?/.exec( ua ) ||
		  	[];

		return { browser: match[1] || "", version: match[2] || "0" };
	},

	browser: {}
});

browserMatch = jQuery.uaMatch( userAgent );
if ( browserMatch.browser ) {
	jQuery.browser[ browserMatch.browser ] = true;
	jQuery.browser.version = browserMatch.version;
}

// Deprecated, use jQuery.browser.webkit instead
if ( jQuery.browser.webkit ) {
	jQuery.browser.safari = true;
}

if ( indexOf ) {
	jQuery.inArray = function( elem, array ) {
		return indexOf.call( array, elem );
	};
}

// All jQuery objects should point back to these
rootjQuery = jQuery(document);

// Cleanup functions for the document ready method
if ( document.addEventListener ) {
	DOMContentLoaded = function() {
		document.removeEventListener( "DOMContentLoaded", DOMContentLoaded, false );
		jQuery.ready();
	};

} else if ( document.attachEvent ) {
	DOMContentLoaded = function() {
		// Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
		if ( document.readyState === "complete" ) {
			document.detachEvent( "onreadystatechange", DOMContentLoaded );
			jQuery.ready();
		}
	};
}

// The DOM ready check for Internet Explorer
function doScrollCheck() {
	if ( jQuery.isReady ) {
		return;
	}

	try {
		// If IE is used, use the trick by Diego Perini
		// http://javascript.nwbox.com/IEContentLoaded/
		document.documentElement.doScroll("left");
	} catch( error ) {
		setTimeout( doScrollCheck, 1 );
		return;
	}

	// and execute any waiting functions
	jQuery.ready();
}

function evalScript( i, elem ) {
	if ( elem.src ) {
		jQuery.ajax({
			url: elem.src,
			async: false,
			dataType: "script"
		});
	} else {
		jQuery.globalEval( elem.text || elem.textContent || elem.innerHTML || "" );
	}

	if ( elem.parentNode ) {
		elem.parentNode.removeChild( elem );
	}
}

// Mutifunctional method to get and set values to a collection
// The value/s can be optionally by executed if its a function
function access( elems, key, value, exec, fn, pass ) {
	var length = elems.length;
	
	// Setting many attributes
	if ( typeof key === "object" ) {
		for ( var k in key ) {
			access( elems, k, key[k], exec, fn, value );
		}
		return elems;
	}
	
	// Setting one attribute
	if ( value !== undefined ) {
		// Optionally, function values get executed if exec is true
		exec = !pass && exec && jQuery.isFunction(value);
		
		for ( var i = 0; i < length; i++ ) {
			fn( elems[i], key, exec ? value.call( elems[i], i, fn( elems[i], key ) ) : value, pass );
		}
		
		return elems;
	}
	
	// Getting an attribute
	return length ? fn( elems[0], key ) : undefined;
}

function now() {
	return (new Date).getTime();
}
(function() {

	jQuery.support = {};

	var root = document.documentElement,
		script = document.createElement("script"),
		div = document.createElement("div"),
		id = "script" + now();

	div.style.display = "none";
	div.innerHTML = "   <link/><table></table><a href='/a' style='color:red;float:left;opacity:.55;'>a</a><input type='checkbox'/>";

	var all = div.getElementsByTagName("*"),
		a = div.getElementsByTagName("a")[0];

	// Can't get basic test support
	if ( !all || !all.length || !a ) {
		return;
	}

	jQuery.support = {
		// IE strips leading whitespace when .innerHTML is used
		leadingWhitespace: div.firstChild.nodeType === 3,

		// Make sure that tbody elements aren't automatically inserted
		// IE will insert them into empty tables
		tbody: !div.getElementsByTagName("tbody").length,

		// Make sure that link elements get serialized correctly by innerHTML
		// This requires a wrapper element in IE
		htmlSerialize: !!div.getElementsByTagName("link").length,

		// Get the style information from getAttribute
		// (IE uses .cssText insted)
		style: /red/.test( a.getAttribute("style") ),

		// Make sure that URLs aren't manipulated
		// (IE normalizes it by default)
		hrefNormalized: a.getAttribute("href") === "/a",

		// Make sure that element opacity exists
		// (IE uses filter instead)
		// Use a regex to work around a WebKit issue. See #5145
		opacity: /^0.55$/.test( a.style.opacity ),

		// Verify style float existence
		// (IE uses styleFloat instead of cssFloat)
		cssFloat: !!a.style.cssFloat,

		// Make sure that if no value is specified for a checkbox
		// that it defaults to "on".
		// (WebKit defaults to "" instead)
		checkOn: div.getElementsByTagName("input")[0].value === "on",

		// Make sure that a selected-by-default option has a working selected property.
		// (WebKit defaults to false instead of true, IE too, if it's in an optgroup)
		optSelected: document.createElement("select").appendChild( document.createElement("option") ).selected,

		parentNode: div.removeChild( div.appendChild( document.createElement("div") ) ).parentNode === null,

		// Will be defined later
		deleteExpando: true,
		checkClone: false,
		scriptEval: false,
		noCloneEvent: true,
		boxModel: null
	};

	script.type = "text/javascript";
	try {
		script.appendChild( document.createTextNode( "window." + id + "=1;" ) );
	} catch(e) {}

	root.insertBefore( script, root.firstChild );

	// Make sure that the execution of code works by injecting a script
	// tag with appendChild/createTextNode
	// (IE doesn't support this, fails, and uses .text instead)
	if ( window[ id ] ) {
		jQuery.support.scriptEval = true;
		delete window[ id ];
	}

	// Test to see if it's possible to delete an expando from an element
	// Fails in Internet Explorer
	try {
		delete script.test;
	
	} catch(e) {
		jQuery.support.deleteExpando = false;
	}

	root.removeChild( script );

	if ( div.attachEvent && div.fireEvent ) {
		div.attachEvent("onclick", function click() {
			// Cloning a node shouldn't copy over any
			// bound event handlers (IE does this)
			jQuery.support.noCloneEvent = false;
			div.detachEvent("onclick", click);
		});
		div.cloneNode(true).fireEvent("onclick");
	}

	div = document.createElement("div");
	div.innerHTML = "<input type='radio' name='radiotest' checked='checked'/>";

	var fragment = document.createDocumentFragment();
	fragment.appendChild( div.firstChild );

	// WebKit doesn't clone checked state correctly in fragments
	jQuery.support.checkClone = fragment.cloneNode(true).cloneNode(true).lastChild.checked;

	// Figure out if the W3C box model works as expected
	// document.body must exist before we can do this
	jQuery(function() {
		var div = document.createElement("div");
		div.style.width = div.style.paddingLeft = "1px";

		document.body.appendChild( div );
		jQuery.boxModel = jQuery.support.boxModel = div.offsetWidth === 2;
		document.body.removeChild( div ).style.display = 'none';

		div = null;
	});

	// Technique from Juriy Zaytsev
	// http://thinkweb2.com/projects/prototype/detecting-event-support-without-browser-sniffing/
	var eventSupported = function( eventName ) { 
		var el = document.createElement("div"); 
		eventName = "on" + eventName; 

		var isSupported = (eventName in el); 
		if ( !isSupported ) { 
			el.setAttribute(eventName, "return;"); 
			isSupported = typeof el[eventName] === "function"; 
		} 
		el = null; 

		return isSupported; 
	};
	
	jQuery.support.submitBubbles = eventSupported("submit");
	jQuery.support.changeBubbles = eventSupported("change");

	// release memory in IE
	root = script = div = all = a = null;
})();

jQuery.props = {
	"for": "htmlFor",
	"class": "className",
	readonly: "readOnly",
	maxlength: "maxLength",
	cellspacing: "cellSpacing",
	rowspan: "rowSpan",
	colspan: "colSpan",
	tabindex: "tabIndex",
	usemap: "useMap",
	frameborder: "frameBorder"
};
var expando = "jQuery" + now(), uuid = 0, windowData = {};

jQuery.extend({
	cache: {},
	
	expando:expando,

	// The following elements throw uncatchable exceptions if you
	// attempt to add expando properties to them.
	noData: {
		"embed": true,
		"object": true,
		"applet": true
	},

	data: function( elem, name, data ) {
		if ( elem.nodeName && jQuery.noData[elem.nodeName.toLowerCase()] ) {
			return;
		}

		elem = elem == window ?
			windowData :
			elem;

		var id = elem[ expando ], cache = jQuery.cache, thisCache;

		if ( !id && typeof name === "string" && data === undefined ) {
			return null;
		}

		// Compute a unique ID for the element
		if ( !id ) { 
			id = ++uuid;
		}

		// Avoid generating a new cache unless none exists and we
		// want to manipulate it.
		if ( typeof name === "object" ) {
			elem[ expando ] = id;
			thisCache = cache[ id ] = jQuery.extend(true, {}, name);

		} else if ( !cache[ id ] ) {
			elem[ expando ] = id;
			cache[ id ] = {};
		}

		thisCache = cache[ id ];

		// Prevent overriding the named cache with undefined values
		if ( data !== undefined ) {
			thisCache[ name ] = data;
		}

		return typeof name === "string" ? thisCache[ name ] : thisCache;
	},

	removeData: function( elem, name ) {
		if ( elem.nodeName && jQuery.noData[elem.nodeName.toLowerCase()] ) {
			return;
		}

		elem = elem == window ?
			windowData :
			elem;

		var id = elem[ expando ], cache = jQuery.cache, thisCache = cache[ id ];

		// If we want to remove a specific section of the element's data
		if ( name ) {
			if ( thisCache ) {
				// Remove the section of cache data
				delete thisCache[ name ];

				// If we've removed all the data, remove the element's cache
				if ( jQuery.isEmptyObject(thisCache) ) {
					jQuery.removeData( elem );
				}
			}

		// Otherwise, we want to remove all of the element's data
		} else {
			if ( jQuery.support.deleteExpando ) {
				delete elem[ jQuery.expando ];

			} else if ( elem.removeAttribute ) {
				elem.removeAttribute( jQuery.expando );
			}

			// Completely remove the data cache
			delete cache[ id ];
		}
	}
});

jQuery.fn.extend({
	data: function( key, value ) {
		if ( typeof key === "undefined" && this.length ) {
			return jQuery.data( this[0] );

		} else if ( typeof key === "object" ) {
			return this.each(function() {
				jQuery.data( this, key );
			});
		}

		var parts = key.split(".");
		parts[1] = parts[1] ? "." + parts[1] : "";

		if ( value === undefined ) {
			var data = this.triggerHandler("getData" + parts[1] + "!", [parts[0]]);

			if ( data === undefined && this.length ) {
				data = jQuery.data( this[0], key );
			}
			return data === undefined && parts[1] ?
				this.data( parts[0] ) :
				data;
		} else {
			return this.trigger("setData" + parts[1] + "!", [parts[0], value]).each(function() {
				jQuery.data( this, key, value );
			});
		}
	},

	removeData: function( key ) {
		return this.each(function() {
			jQuery.removeData( this, key );
		});
	}
});
jQuery.extend({
	queue: function( elem, type, data ) {
		if ( !elem ) {
			return;
		}

		type = (type || "fx") + "queue";
		var q = jQuery.data( elem, type );

		// Speed up dequeue by getting out quickly if this is just a lookup
		if ( !data ) {
			return q || [];
		}

		if ( !q || jQuery.isArray(data) ) {
			q = jQuery.data( elem, type, jQuery.makeArray(data) );

		} else {
			q.push( data );
		}

		return q;
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ), fn = queue.shift();

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
		}

		if ( fn ) {
			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift("inprogress");
			}

			fn.call(elem, function() {
				jQuery.dequeue(elem, type);
			});
		}
	}
});

jQuery.fn.extend({
	queue: function( type, data ) {
		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
		}

		if ( data === undefined ) {
			return jQuery.queue( this[0], type );
		}
		return this.each(function( i, elem ) {
			var queue = jQuery.queue( this, type, data );

			if ( type === "fx" && queue[0] !== "inprogress" ) {
				jQuery.dequeue( this, type );
			}
		});
	},
	dequeue: function( type ) {
		return this.each(function() {
			jQuery.dequeue( this, type );
		});
	},

	// Based off of the plugin by Clint Helfers, with permission.
	// http://blindsignals.com/index.php/2009/07/jquery-delay/
	delay: function( time, type ) {
		time = jQuery.fx ? jQuery.fx.speeds[time] || time : time;
		type = type || "fx";

		return this.queue( type, function() {
			var elem = this;
			setTimeout(function() {
				jQuery.dequeue( elem, type );
			}, time );
		});
	},

	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	}
});
var rclass = /[\n\t]/g,
	rspace = /\s+/,
	rreturn = /\r/g,
	rspecialurl = /href|src|style/,
	rtype = /(button|input)/i,
	rfocusable = /(button|input|object|select|textarea)/i,
	rclickable = /^(a|area)$/i,
	rradiocheck = /radio|checkbox/;

jQuery.fn.extend({
	attr: function( name, value ) {
		return access( this, name, value, true, jQuery.attr );
	},

	removeAttr: function( name, fn ) {
		return this.each(function(){
			jQuery.attr( this, name, "" );
			if ( this.nodeType === 1 ) {
				this.removeAttribute( name );
			}
		});
	},

	addClass: function( value ) {
		if ( jQuery.isFunction(value) ) {
			return this.each(function(i) {
				var self = jQuery(this);
				self.addClass( value.call(this, i, self.attr("class")) );
			});
		}

		if ( value && typeof value === "string" ) {
			var classNames = (value || "").split( rspace );

			for ( var i = 0, l = this.length; i < l; i++ ) {
				var elem = this[i];

				if ( elem.nodeType === 1 ) {
					if ( !elem.className ) {
						elem.className = value;

					} else {
						var className = " " + elem.className + " ", setClass = elem.className;
						for ( var c = 0, cl = classNames.length; c < cl; c++ ) {
							if ( className.indexOf( " " + classNames[c] + " " ) < 0 ) {
								setClass += " " + classNames[c];
							}
						}
						elem.className = jQuery.trim( setClass );
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		if ( jQuery.isFunction(value) ) {
			return this.each(function(i) {
				var self = jQuery(this);
				self.removeClass( value.call(this, i, self.attr("class")) );
			});
		}

		if ( (value && typeof value === "string") || value === undefined ) {
			var classNames = (value || "").split(rspace);

			for ( var i = 0, l = this.length; i < l; i++ ) {
				var elem = this[i];

				if ( elem.nodeType === 1 && elem.className ) {
					if ( value ) {
						var className = (" " + elem.className + " ").replace(rclass, " ");
						for ( var c = 0, cl = classNames.length; c < cl; c++ ) {
							className = className.replace(" " + classNames[c] + " ", " ");
						}
						elem.className = jQuery.trim( className );

					} else {
						elem.className = "";
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value, isBool = typeof stateVal === "boolean";

		if ( jQuery.isFunction( value ) ) {
			return this.each(function(i) {
				var self = jQuery(this);
				self.toggleClass( value.call(this, i, self.attr("class"), stateVal), stateVal );
			});
		}

		return this.each(function() {
			if ( type === "string" ) {
				// toggle individual class names
				var className, i = 0, self = jQuery(this),
					state = stateVal,
					classNames = value.split( rspace );

				while ( (className = classNames[ i++ ]) ) {
					// check each className given, space seperated list
					state = isBool ? state : !self.hasClass( className );
					self[ state ? "addClass" : "removeClass" ]( className );
				}

			} else if ( type === "undefined" || type === "boolean" ) {
				if ( this.className ) {
					// store className if set
					jQuery.data( this, "__className__", this.className );
				}

				// toggle whole className
				this.className = this.className || value === false ? "" : jQuery.data( this, "__className__" ) || "";
			}
		});
	},

	hasClass: function( selector ) {
		var className = " " + selector + " ";
		for ( var i = 0, l = this.length; i < l; i++ ) {
			if ( (" " + this[i].className + " ").replace(rclass, " ").indexOf( className ) > -1 ) {
				return true;
			}
		}

		return false;
	},

	val: function( value ) {
		if ( value === undefined ) {
			var elem = this[0];

			if ( elem ) {
				if ( jQuery.nodeName( elem, "option" ) ) {
					return (elem.attributes.value || {}).specified ? elem.value : elem.text;
				}

				// We need to handle select boxes special
				if ( jQuery.nodeName( elem, "select" ) ) {
					var index = elem.selectedIndex,
						values = [],
						options = elem.options,
						one = elem.type === "select-one";

					// Nothing was selected
					if ( index < 0 ) {
						return null;
					}

					// Loop through all the selected options
					for ( var i = one ? index : 0, max = one ? index + 1 : options.length; i < max; i++ ) {
						var option = options[ i ];

						if ( option.selected ) {
							// Get the specifc value for the option
							value = jQuery(option).val();

							// We don't need an array for one selects
							if ( one ) {
								return value;
							}

							// Multi-Selects return an array
							values.push( value );
						}
					}

					return values;
				}

				// Handle the case where in Webkit "" is returned instead of "on" if a value isn't specified
				if ( rradiocheck.test( elem.type ) && !jQuery.support.checkOn ) {
					return elem.getAttribute("value") === null ? "on" : elem.value;
				}
				

				// Everything else, we just grab the value
				return (elem.value || "").replace(rreturn, "");

			}

			return undefined;
		}

		var isFunction = jQuery.isFunction(value);

		return this.each(function(i) {
			var self = jQuery(this), val = value;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( isFunction ) {
				val = value.call(this, i, self.val());
			}

			// Typecast each time if the value is a Function and the appended
			// value is therefore different each time.
			if ( typeof val === "number" ) {
				val += "";
			}

			if ( jQuery.isArray(val) && rradiocheck.test( this.type ) ) {
				this.checked = jQuery.inArray( self.val(), val ) >= 0;

			} else if ( jQuery.nodeName( this, "select" ) ) {
				var values = jQuery.makeArray(val);

				jQuery( "option", this ).each(function() {
					this.selected = jQuery.inArray( jQuery(this).val(), values ) >= 0;
				});

				if ( !values.length ) {
					this.selectedIndex = -1;
				}

			} else {
				this.value = val;
			}
		});
	}
});

jQuery.extend({
	attrFn: {
		val: true,
		css: true,
		html: true,
		text: true,
		data: true,
		width: true,
		height: true,
		offset: true
	},
		
	attr: function( elem, name, value, pass ) {
		// don't set attributes on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 ) {
			return undefined;
		}

		if ( pass && name in jQuery.attrFn ) {
			return jQuery(elem)[name](value);
		}

		var notxml = elem.nodeType !== 1 || !jQuery.isXMLDoc( elem ),
			// Whether we are setting (or getting)
			set = value !== undefined;

		// Try to normalize/fix the name
		name = notxml && jQuery.props[ name ] || name;

		// Only do all the following if this is a node (faster for style)
		if ( elem.nodeType === 1 ) {
			// These attributes require special treatment
			var special = rspecialurl.test( name );

			// Safari mis-reports the default selected property of an option
			// Accessing the parent's selectedIndex property fixes it
			if ( name === "selected" && !jQuery.support.optSelected ) {
				var parent = elem.parentNode;
				if ( parent ) {
					parent.selectedIndex;
	
					// Make sure that it also works with optgroups, see #5701
					if ( parent.parentNode ) {
						parent.parentNode.selectedIndex;
					}
				}
			}

			// If applicable, access the attribute via the DOM 0 way
			if ( name in elem && notxml && !special ) {
				if ( set ) {
					// We can't allow the type property to be changed (since it causes problems in IE)
					if ( name === "type" && rtype.test( elem.nodeName ) && elem.parentNode ) {
						jQuery.error( "type property can't be changed" );
					}

					elem[ name ] = value;
				}

				// browsers index elements by id/name on forms, give priority to attributes.
				if ( jQuery.nodeName( elem, "form" ) && elem.getAttributeNode(name) ) {
					return elem.getAttributeNode( name ).nodeValue;
				}

				// elem.tabIndex doesn't always return the correct value when it hasn't been explicitly set
				// http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
				if ( name === "tabIndex" ) {
					var attributeNode = elem.getAttributeNode( "tabIndex" );

					return attributeNode && attributeNode.specified ?
						attributeNode.value :
						rfocusable.test( elem.nodeName ) || rclickable.test( elem.nodeName ) && elem.href ?
							0 :
							undefined;
				}

				return elem[ name ];
			}

			if ( !jQuery.support.style && notxml && name === "style" ) {
				if ( set ) {
					elem.style.cssText = "" + value;
				}

				return elem.style.cssText;
			}

			if ( set ) {
				// convert the value to a string (all browsers do this but IE) see #1070
				elem.setAttribute( name, "" + value );
			}

			var attr = !jQuery.support.hrefNormalized && notxml && special ?
					// Some attributes require a special call on IE
					elem.getAttribute( name, 2 ) :
					elem.getAttribute( name );

			// Non-existent attributes return null, we normalize to undefined
			return attr === null ? undefined : attr;
		}

		// elem is actually elem.style ... set the style
		// Using attr for specific style information is now deprecated. Use style instead.
		return jQuery.style( elem, name, value );
	}
});
var rnamespaces = /\.(.*)$/,
	fcleanup = function( nm ) {
		return nm.replace(/[^\w\s\.\|`]/g, function( ch ) {
			return "\\" + ch;
		});
	};

/*
 * A number of helper functions used for managing events.
 * Many of the ideas behind this code originated from
 * Dean Edwards' addEvent library.
 */
jQuery.event = {

	// Bind an event to an element
	// Original by Dean Edwards
	add: function( elem, types, handler, data ) {
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// For whatever reason, IE has trouble passing the window object
		// around, causing it to be cloned in the process
		if ( elem.setInterval && ( elem !== window && !elem.frameElement ) ) {
			elem = window;
		}

		var handleObjIn, handleObj;

		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
		}

		// Make sure that the function being executed has a unique ID
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure
		var elemData = jQuery.data( elem );

		// If no elemData is found then we must be trying to bind to one of the
		// banned noData elements
		if ( !elemData ) {
			return;
		}

		var events = elemData.events = elemData.events || {},
			eventHandle = elemData.handle, eventHandle;

		if ( !eventHandle ) {
			elemData.handle = eventHandle = function() {
				// Handle the second event of a trigger and when
				// an event is called after a page has unloaded
				return typeof jQuery !== "undefined" && !jQuery.event.triggered ?
					jQuery.event.handle.apply( eventHandle.elem, arguments ) :
					undefined;
			};
		}

		// Add elem as a property of the handle function
		// This is to prevent a memory leak with non-native events in IE.
		eventHandle.elem = elem;

		// Handle multiple events separated by a space
		// jQuery(...).bind("mouseover mouseout", fn);
		types = types.split(" ");

		var type, i = 0, namespaces;

		while ( (type = types[ i++ ]) ) {
			handleObj = handleObjIn ?
				jQuery.extend({}, handleObjIn) :
				{ handler: handler, data: data };

			// Namespaced event handlers
			if ( type.indexOf(".") > -1 ) {
				namespaces = type.split(".");
				type = namespaces.shift();
				handleObj.namespace = namespaces.slice(0).sort().join(".");

			} else {
				namespaces = [];
				handleObj.namespace = "";
			}

			handleObj.type = type;
			handleObj.guid = handler.guid;

			// Get the current list of functions bound to this event
			var handlers = events[ type ],
				special = jQuery.event.special[ type ] || {};

			// Init the event handler queue
			if ( !handlers ) {
				handlers = events[ type ] = [];

				// Check for a special event handler
				// Only use addEventListener/attachEvent if the special
				// events handler returns false
				if ( !special.setup || special.setup.call( elem, data, namespaces, eventHandle ) === false ) {
					// Bind the global event handler to the element
					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle, false );

					} else if ( elem.attachEvent ) {
						elem.attachEvent( "on" + type, eventHandle );
					}
				}
			}
			
			if ( special.add ) { 
				special.add.call( elem, handleObj ); 

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add the function to the element's handler list
			handlers.push( handleObj );

			// Keep track of which events have been used, for global triggering
			jQuery.event.global[ type ] = true;
		}

		// Nullify elem to prevent memory leaks in IE
		elem = null;
	},

	global: {},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, pos ) {
		// don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		var ret, type, fn, i = 0, all, namespaces, namespace, special, eventType, handleObj, origType,
			elemData = jQuery.data( elem ),
			events = elemData && elemData.events;

		if ( !elemData || !events ) {
			return;
		}

		// types is actually an event object here
		if ( types && types.type ) {
			handler = types.handler;
			types = types.type;
		}

		// Unbind all events for the element
		if ( !types || typeof types === "string" && types.charAt(0) === "." ) {
			types = types || "";

			for ( type in events ) {
				jQuery.event.remove( elem, type + types );
			}

			return;
		}

		// Handle multiple events separated by a space
		// jQuery(...).unbind("mouseover mouseout", fn);
		types = types.split(" ");

		while ( (type = types[ i++ ]) ) {
			origType = type;
			handleObj = null;
			all = type.indexOf(".") < 0;
			namespaces = [];

			if ( !all ) {
				// Namespaced event handlers
				namespaces = type.split(".");
				type = namespaces.shift();

				namespace = new RegExp("(^|\\.)" + 
					jQuery.map( namespaces.slice(0).sort(), fcleanup ).join("\\.(?:.*\\.)?") + "(\\.|$)")
			}

			eventType = events[ type ];

			if ( !eventType ) {
				continue;
			}

			if ( !handler ) {
				for ( var j = 0; j < eventType.length; j++ ) {
					handleObj = eventType[ j ];

					if ( all || namespace.test( handleObj.namespace ) ) {
						jQuery.event.remove( elem, origType, handleObj.handler, j );
						eventType.splice( j--, 1 );
					}
				}

				continue;
			}

			special = jQuery.event.special[ type ] || {};

			for ( var j = pos || 0; j < eventType.length; j++ ) {
				handleObj = eventType[ j ];

				if ( handler.guid === handleObj.guid ) {
					// remove the given handler for the given type
					if ( all || namespace.test( handleObj.namespace ) ) {
						if ( pos == null ) {
							eventType.splice( j--, 1 );
						}

						if ( special.remove ) {
							special.remove.call( elem, handleObj );
						}
					}

					if ( pos != null ) {
						break;
					}
				}
			}

			// remove generic event handler if no more handlers exist
			if ( eventType.length === 0 || pos != null && eventType.length === 1 ) {
				if ( !special.teardown || special.teardown.call( elem, namespaces ) === false ) {
					removeEvent( elem, type, elemData.handle );
				}

				ret = null;
				delete events[ type ];
			}
		}

		// Remove the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			var handle = elemData.handle;
			if ( handle ) {
				handle.elem = null;
			}

			delete elemData.events;
			delete elemData.handle;

			if ( jQuery.isEmptyObject( elemData ) ) {
				jQuery.removeData( elem );
			}
		}
	},

	// bubbling is internal
	trigger: function( event, data, elem /*, bubbling */ ) {
		// Event object or event type
		var type = event.type || event,
			bubbling = arguments[3];

		if ( !bubbling ) {
			event = typeof event === "object" ?
				// jQuery.Event object
				event[expando] ? event :
				// Object literal
				jQuery.extend( jQuery.Event(type), event ) :
				// Just the event type (string)
				jQuery.Event(type);

			if ( type.indexOf("!") >= 0 ) {
				event.type = type = type.slice(0, -1);
				event.exclusive = true;
			}

			// Handle a global trigger
			if ( !elem ) {
				// Don't bubble custom events when global (to avoid too much overhead)
				event.stopPropagation();

				// Only trigger if we've ever bound an event for it
				if ( jQuery.event.global[ type ] ) {
					jQuery.each( jQuery.cache, function() {
						if ( this.events && this.events[type] ) {
							jQuery.event.trigger( event, data, this.handle.elem );
						}
					});
				}
			}

			// Handle triggering a single element

			// don't do events on text and comment nodes
			if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 ) {
				return undefined;
			}

			// Clean up in case it is reused
			event.result = undefined;
			event.target = elem;

			// Clone the incoming data, if any
			data = jQuery.makeArray( data );
			data.unshift( event );
		}

		event.currentTarget = elem;

		// Trigger the event, it is assumed that "handle" is a function
		var handle = jQuery.data( elem, "handle" );
		if ( handle ) {
			handle.apply( elem, data );
		}

		var parent = elem.parentNode || elem.ownerDocument;

		// Trigger an inline bound script
		try {
			if ( !(elem && elem.nodeName && jQuery.noData[elem.nodeName.toLowerCase()]) ) {
				if ( elem[ "on" + type ] && elem[ "on" + type ].apply( elem, data ) === false ) {
					event.result = false;
				}
			}

		// prevent IE from throwing an error for some elements with some event types, see #3533
		} catch (e) {}

		if ( !event.isPropagationStopped() && parent ) {
			jQuery.event.trigger( event, data, parent, true );

		} else if ( !event.isDefaultPrevented() ) {
			var target = event.target, old,
				isClick = jQuery.nodeName(target, "a") && type === "click",
				special = jQuery.event.special[ type ] || {};

			if ( (!special._default || special._default.call( elem, event ) === false) && 
				!isClick && !(target && target.nodeName && jQuery.noData[target.nodeName.toLowerCase()]) ) {

				try {
					if ( target[ type ] ) {
						// Make sure that we don't accidentally re-trigger the onFOO events
						old = target[ "on" + type ];

						if ( old ) {
							target[ "on" + type ] = null;
						}

						jQuery.event.triggered = true;
						target[ type ]();
					}

				// prevent IE from throwing an error for some elements with some event types, see #3533
				} catch (e) {}

				if ( old ) {
					target[ "on" + type ] = old;
				}

				jQuery.event.triggered = false;
			}
		}
	},

	handle: function( event ) {
		var all, handlers, namespaces, namespace, events;

		event = arguments[0] = jQuery.event.fix( event || window.event );
		event.currentTarget = this;

		// Namespaced event handlers
		all = event.type.indexOf(".") < 0 && !event.exclusive;

		if ( !all ) {
			namespaces = event.type.split(".");
			event.type = namespaces.shift();
			namespace = new RegExp("(^|\\.)" + namespaces.slice(0).sort().join("\\.(?:.*\\.)?") + "(\\.|$)");
		}

		var events = jQuery.data(this, "events"), handlers = events[ event.type ];

		if ( events && handlers ) {
			// Clone the handlers to prevent manipulation
			handlers = handlers.slice(0);

			for ( var j = 0, l = handlers.length; j < l; j++ ) {
				var handleObj = handlers[ j ];

				// Filter the functions by class
				if ( all || namespace.test( handleObj.namespace ) ) {
					// Pass in a reference to the handler function itself
					// So that we can later remove it
					event.handler = handleObj.handler;
					event.data = handleObj.data;
					event.handleObj = handleObj;
	
					var ret = handleObj.handler.apply( this, arguments );

					if ( ret !== undefined ) {
						event.result = ret;
						if ( ret === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}

					if ( event.isImmediatePropagationStopped() ) {
						break;
					}
				}
			}
		}

		return event.result;
	},

	props: "altKey attrChange attrName bubbles button cancelable charCode clientX clientY ctrlKey currentTarget data detail eventPhase fromElement handler keyCode layerX layerY metaKey newValue offsetX offsetY originalTarget pageX pageY prevValue relatedNode relatedTarget screenX screenY shiftKey srcElement target toElement view wheelDelta which".split(" "),

	fix: function( event ) {
		if ( event[ expando ] ) {
			return event;
		}

		// store a copy of the original event object
		// and "clone" to set read-only properties
		var originalEvent = event;
		event = jQuery.Event( originalEvent );

		for ( var i = this.props.length, prop; i; ) {
			prop = this.props[ --i ];
			event[ prop ] = originalEvent[ prop ];
		}

		// Fix target property, if necessary
		if ( !event.target ) {
			event.target = event.srcElement || document; // Fixes #1925 where srcElement might not be defined either
		}

		// check if target is a textnode (safari)
		if ( event.target.nodeType === 3 ) {
			event.target = event.target.parentNode;
		}

		// Add relatedTarget, if necessary
		if ( !event.relatedTarget && event.fromElement ) {
			event.relatedTarget = event.fromElement === event.target ? event.toElement : event.fromElement;
		}

		// Calculate pageX/Y if missing and clientX/Y available
		if ( event.pageX == null && event.clientX != null ) {
			var doc = document.documentElement, body = document.body;
			event.pageX = event.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
			event.pageY = event.clientY + (doc && doc.scrollTop  || body && body.scrollTop  || 0) - (doc && doc.clientTop  || body && body.clientTop  || 0);
		}

		// Add which for key events
		if ( !event.which && ((event.charCode || event.charCode === 0) ? event.charCode : event.keyCode) ) {
			event.which = event.charCode || event.keyCode;
		}

		// Add metaKey to non-Mac browsers (use ctrl for PC's and Meta for Macs)
		if ( !event.metaKey && event.ctrlKey ) {
			event.metaKey = event.ctrlKey;
		}

		// Add which for click: 1 === left; 2 === middle; 3 === right
		// Note: button is not normalized, so don't use it
		if ( !event.which && event.button !== undefined ) {
			event.which = (event.button & 1 ? 1 : ( event.button & 2 ? 3 : ( event.button & 4 ? 2 : 0 ) ));
		}

		return event;
	},

	// Deprecated, use jQuery.guid instead
	guid: 1E8,

	// Deprecated, use jQuery.proxy instead
	proxy: jQuery.proxy,

	special: {
		ready: {
			// Make sure the ready event is setup
			setup: jQuery.bindReady,
			teardown: jQuery.noop
		},

		live: {
			add: function( handleObj ) {
				jQuery.event.add( this, handleObj.origType, jQuery.extend({}, handleObj, {handler: liveHandler}) ); 
			},

			remove: function( handleObj ) {
				var remove = true,
					type = handleObj.origType.replace(rnamespaces, "");
				
				jQuery.each( jQuery.data(this, "events").live || [], function() {
					if ( type === this.origType.replace(rnamespaces, "") ) {
						remove = false;
						return false;
					}
				});

				if ( remove ) {
					jQuery.event.remove( this, handleObj.origType, liveHandler );
				}
			}

		},

		beforeunload: {
			setup: function( data, namespaces, eventHandle ) {
				// We only want to do this special case on windows
				if ( this.setInterval ) {
					this.onbeforeunload = eventHandle;
				}

				return false;
			},
			teardown: function( namespaces, eventHandle ) {
				if ( this.onbeforeunload === eventHandle ) {
					this.onbeforeunload = null;
				}
			}
		}
	}
};

var removeEvent = document.removeEventListener ?
	function( elem, type, handle ) {
		elem.removeEventListener( type, handle, false );
	} : 
	function( elem, type, handle ) {
		elem.detachEvent( "on" + type, handle );
	};

jQuery.Event = function( src ) {
	// Allow instantiation without the 'new' keyword
	if ( !this.preventDefault ) {
		return new jQuery.Event( src );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;
	// Event type
	} else {
		this.type = src;
	}

	// timeStamp is buggy for some events on Firefox(#3843)
	// So we won't rely on the native value
	this.timeStamp = now();

	// Mark it as fixed
	this[ expando ] = true;
};

function returnFalse() {
	return false;
}
function returnTrue() {
	return true;
}

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// http://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	preventDefault: function() {
		this.isDefaultPrevented = returnTrue;

		var e = this.originalEvent;
		if ( !e ) {
			return;
		}
		
		// if preventDefault exists run it on the original event
		if ( e.preventDefault ) {
			e.preventDefault();
		}
		// otherwise set the returnValue property of the original event to false (IE)
		e.returnValue = false;
	},
	stopPropagation: function() {
		this.isPropagationStopped = returnTrue;

		var e = this.originalEvent;
		if ( !e ) {
			return;
		}
		// if stopPropagation exists run it on the original event
		if ( e.stopPropagation ) {
			e.stopPropagation();
		}
		// otherwise set the cancelBubble property of the original event to true (IE)
		e.cancelBubble = true;
	},
	stopImmediatePropagation: function() {
		this.isImmediatePropagationStopped = returnTrue;
		this.stopPropagation();
	},
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse
};

// Checks if an event happened on an element within another element
// Used in jQuery.event.special.mouseenter and mouseleave handlers
var withinElement = function( event ) {
	// Check if mouse(over|out) are still within the same parent element
	var parent = event.relatedTarget;

	// Firefox sometimes assigns relatedTarget a XUL element
	// which we cannot access the parentNode property of
	try {
		// Traverse up the tree
		while ( parent && parent !== this ) {
			parent = parent.parentNode;
		}

		if ( parent !== this ) {
			// set the correct event type
			event.type = event.data;

			// handle event if we actually just moused on to a non sub-element
			jQuery.event.handle.apply( this, arguments );
		}

	// assuming we've left the element since we most likely mousedover a xul element
	} catch(e) { }
},

// In case of event delegation, we only need to rename the event.type,
// liveHandler will take care of the rest.
delegate = function( event ) {
	event.type = event.data;
	jQuery.event.handle.apply( this, arguments );
};

// Create mouseenter and mouseleave events
jQuery.each({
	mouseenter: "mouseover",
	mouseleave: "mouseout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		setup: function( data ) {
			jQuery.event.add( this, fix, data && data.selector ? delegate : withinElement, orig );
		},
		teardown: function( data ) {
			jQuery.event.remove( this, fix, data && data.selector ? delegate : withinElement );
		}
	};
});

// submit delegation
if ( !jQuery.support.submitBubbles ) {

	jQuery.event.special.submit = {
		setup: function( data, namespaces ) {
			if ( this.nodeName.toLowerCase() !== "form" ) {
				jQuery.event.add(this, "click.specialSubmit", function( e ) {
					var elem = e.target, type = elem.type;

					if ( (type === "submit" || type === "image") && jQuery( elem ).closest("form").length ) {
						return trigger( "submit", this, arguments );
					}
				});
	 
				jQuery.event.add(this, "keypress.specialSubmit", function( e ) {
					var elem = e.target, type = elem.type;

					if ( (type === "text" || type === "password") && jQuery( elem ).closest("form").length && e.keyCode === 13 ) {
						return trigger( "submit", this, arguments );
					}
				});

			} else {
				return false;
			}
		},

		teardown: function( namespaces ) {
			jQuery.event.remove( this, ".specialSubmit" );
		}
	};

}

// change delegation, happens here so we have bind.
if ( !jQuery.support.changeBubbles ) {

	var formElems = /textarea|input|select/i,

	changeFilters,

	getVal = function( elem ) {
		var type = elem.type, val = elem.value;

		if ( type === "radio" || type === "checkbox" ) {
			val = elem.checked;

		} else if ( type === "select-multiple" ) {
			val = elem.selectedIndex > -1 ?
				jQuery.map( elem.options, function( elem ) {
					return elem.selected;
				}).join("-") :
				"";

		} else if ( elem.nodeName.toLowerCase() === "select" ) {
			val = elem.selectedIndex;
		}

		return val;
	},

	testChange = function testChange( e ) {
		var elem = e.target, data, val;

		if ( !formElems.test( elem.nodeName ) || elem.readOnly ) {
			return;
		}

		data = jQuery.data( elem, "_change_data" );
		val = getVal(elem);

		// the current data will be also retrieved by beforeactivate
		if ( e.type !== "focusout" || elem.type !== "radio" ) {
			jQuery.data( elem, "_change_data", val );
		}
		
		if ( data === undefined || val === data ) {
			return;
		}

		if ( data != null || val ) {
			e.type = "change";
			return jQuery.event.trigger( e, arguments[1], elem );
		}
	};

	jQuery.event.special.change = {
		filters: {
			focusout: testChange, 

			click: function( e ) {
				var elem = e.target, type = elem.type;

				if ( type === "radio" || type === "checkbox" || elem.nodeName.toLowerCase() === "select" ) {
					return testChange.call( this, e );
				}
			},

			// Change has to be called before submit
			// Keydown will be called before keypress, which is used in submit-event delegation
			keydown: function( e ) {
				var elem = e.target, type = elem.type;

				if ( (e.keyCode === 13 && elem.nodeName.toLowerCase() !== "textarea") ||
					(e.keyCode === 32 && (type === "checkbox" || type === "radio")) ||
					type === "select-multiple" ) {
					return testChange.call( this, e );
				}
			},

			// Beforeactivate happens also before the previous element is blurred
			// with this event you can't trigger a change event, but you can store
			// information/focus[in] is not needed anymore
			beforeactivate: function( e ) {
				var elem = e.target;
				jQuery.data( elem, "_change_data", getVal(elem) );
			}
		},

		setup: function( data, namespaces ) {
			if ( this.type === "file" ) {
				return false;
			}

			for ( var type in changeFilters ) {
				jQuery.event.add( this, type + ".specialChange", changeFilters[type] );
			}

			return formElems.test( this.nodeName );
		},

		teardown: function( namespaces ) {
			jQuery.event.remove( this, ".specialChange" );

			return formElems.test( this.nodeName );
		}
	};

	changeFilters = jQuery.event.special.change.filters;
}

function trigger( type, elem, args ) {
	args[0].type = type;
	return jQuery.event.handle.apply( elem, args );
}

// Create "bubbling" focus and blur events
if ( document.addEventListener ) {
	jQuery.each({ focus: "focusin", blur: "focusout" }, function( orig, fix ) {
		jQuery.event.special[ fix ] = {
			setup: function() {
				this.addEventListener( orig, handler, true );
			}, 
			teardown: function() { 
				this.removeEventListener( orig, handler, true );
			}
		};

		function handler( e ) { 
			e = jQuery.event.fix( e );
			e.type = fix;
			return jQuery.event.handle.call( this, e );
		}
	});
}

jQuery.each(["bind", "one"], function( i, name ) {
	jQuery.fn[ name ] = function( type, data, fn ) {
		// Handle object literals
		if ( typeof type === "object" ) {
			for ( var key in type ) {
				this[ name ](key, data, type[key], fn);
			}
			return this;
		}
		
		if ( jQuery.isFunction( data ) ) {
			fn = data;
			data = undefined;
		}

		var handler = name === "one" ? jQuery.proxy( fn, function( event ) {
			jQuery( this ).unbind( event, handler );
			return fn.apply( this, arguments );
		}) : fn;

		if ( type === "unload" && name !== "one" ) {
			this.one( type, data, fn );

		} else {
			for ( var i = 0, l = this.length; i < l; i++ ) {
				jQuery.event.add( this[i], type, handler, data );
			}
		}

		return this;
	};
});

jQuery.fn.extend({
	unbind: function( type, fn ) {
		// Handle object literals
		if ( typeof type === "object" && !type.preventDefault ) {
			for ( var key in type ) {
				this.unbind(key, type[key]);
			}

		} else {
			for ( var i = 0, l = this.length; i < l; i++ ) {
				jQuery.event.remove( this[i], type, fn );
			}
		}

		return this;
	},
	
	delegate: function( selector, types, data, fn ) {
		return this.live( types, data, fn, selector );
	},
	
	undelegate: function( selector, types, fn ) {
		if ( arguments.length === 0 ) {
				return this.unbind( "live" );
		
		} else {
			return this.die( types, null, fn, selector );
		}
	},
	
	trigger: function( type, data ) {
		return this.each(function() {
			jQuery.event.trigger( type, data, this );
		});
	},

	triggerHandler: function( type, data ) {
		if ( this[0] ) {
			var event = jQuery.Event( type );
			event.preventDefault();
			event.stopPropagation();
			jQuery.event.trigger( event, data, this[0] );
			return event.result;
		}
	},

	toggle: function( fn ) {
		// Save reference to arguments for access in closure
		var args = arguments, i = 1;

		// link all the functions, so any of them can unbind this click handler
		while ( i < args.length ) {
			jQuery.proxy( fn, args[ i++ ] );
		}

		return this.click( jQuery.proxy( fn, function( event ) {
			// Figure out which function to execute
			var lastToggle = ( jQuery.data( this, "lastToggle" + fn.guid ) || 0 ) % i;
			jQuery.data( this, "lastToggle" + fn.guid, lastToggle + 1 );

			// Make sure that clicks stop
			event.preventDefault();

			// and execute the function
			return args[ lastToggle ].apply( this, arguments ) || false;
		}));
	},

	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	}
});

var liveMap = {
	focus: "focusin",
	blur: "focusout",
	mouseenter: "mouseover",
	mouseleave: "mouseout"
};

jQuery.each(["live", "die"], function( i, name ) {
	jQuery.fn[ name ] = function( types, data, fn, origSelector /* Internal Use Only */ ) {
		var type, i = 0, match, namespaces, preType,
			selector = origSelector || this.selector,
			context = origSelector ? this : jQuery( this.context );

		if ( jQuery.isFunction( data ) ) {
			fn = data;
			data = undefined;
		}

		types = (types || "").split(" ");

		while ( (type = types[ i++ ]) != null ) {
			match = rnamespaces.exec( type );
			namespaces = "";

			if ( match )  {
				namespaces = match[0];
				type = type.replace( rnamespaces, "" );
			}

			if ( type === "hover" ) {
				types.push( "mouseenter" + namespaces, "mouseleave" + namespaces );
				continue;
			}

			preType = type;

			if ( type === "focus" || type === "blur" ) {
				types.push( liveMap[ type ] + namespaces );
				type = type + namespaces;

			} else {
				type = (liveMap[ type ] || type) + namespaces;
			}

			if ( name === "live" ) {
				// bind live handler
				context.each(function(){
					jQuery.event.add( this, liveConvert( type, selector ),
						{ data: data, selector: selector, handler: fn, origType: type, origHandler: fn, preType: preType } );
				});

			} else {
				// unbind live handler
				context.unbind( liveConvert( type, selector ), fn );
			}
		}
		
		return this;
	}
});

function liveHandler( event ) {
	var stop, elems = [], selectors = [], args = arguments,
		related, match, handleObj, elem, j, i, l, data,
		events = jQuery.data( this, "events" );

	// Make sure we avoid non-left-click bubbling in Firefox (#3861)
	if ( event.liveFired === this || !events || !events.live || event.button && event.type === "click" ) {
		return;
	}

	event.liveFired = this;

	var live = events.live.slice(0);

	for ( j = 0; j < live.length; j++ ) {
		handleObj = live[j];

		if ( handleObj.origType.replace( rnamespaces, "" ) === event.type ) {
			selectors.push( handleObj.selector );

		} else {
			live.splice( j--, 1 );
		}
	}

	match = jQuery( event.target ).closest( selectors, event.currentTarget );

	for ( i = 0, l = match.length; i < l; i++ ) {
		for ( j = 0; j < live.length; j++ ) {
			handleObj = live[j];

			if ( match[i].selector === handleObj.selector ) {
				elem = match[i].elem;
				related = null;

				// Those two events require additional checking
				if ( handleObj.preType === "mouseenter" || handleObj.preType === "mouseleave" ) {
					related = jQuery( event.relatedTarget ).closest( handleObj.selector )[0];
				}

				if ( !related || related !== elem ) {
					elems.push({ elem: elem, handleObj: handleObj });
				}
			}
		}
	}

	for ( i = 0, l = elems.length; i < l; i++ ) {
		match = elems[i];
		event.currentTarget = match.elem;
		event.data = match.handleObj.data;
		event.handleObj = match.handleObj;

		if ( match.handleObj.origHandler.apply( match.elem, args ) === false ) {
			stop = false;
			break;
		}
	}

	return stop;
}

function liveConvert( type, selector ) {
	return "live." + (type && type !== "*" ? type + "." : "") + selector.replace(/\./g, "`").replace(/ /g, "&");
}

jQuery.each( ("blur focus focusin focusout load resize scroll unload click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup error").split(" "), function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( fn ) {
		return fn ? this.bind( name, fn ) : this.trigger( name );
	};

	if ( jQuery.attrFn ) {
		jQuery.attrFn[ name ] = true;
	}
});

// Prevent memory leaks in IE
// Window isn't included so as not to unbind existing unload events
// More info:
//  - http://isaacschlueter.com/2006/10/msie-memory-leaks/
if ( window.attachEvent && !window.addEventListener ) {
	window.attachEvent("onunload", function() {
		for ( var id in jQuery.cache ) {
			if ( jQuery.cache[ id ].handle ) {
				// Try/Catch is to handle iframes being unloaded, see #4280
				try {
					jQuery.event.remove( jQuery.cache[ id ].handle.elem );
				} catch(e) {}
			}
		}
	});
}
/*!
 * Sizzle CSS Selector Engine - v1.0
 *  Copyright 2009, The Dojo Foundation
 *  Released under the MIT, BSD, and GPL Licenses.
 *  More information: http://sizzlejs.com/
 */
(function(){

var chunker = /((?:\((?:\([^()]+\)|[^()]+)+\)|\[(?:\[[^[\]]*\]|['"][^'"]*['"]|[^[\]'"]+)+\]|\\.|[^ >+~,(\[\\]+)+|[>+~])(\s*,\s*)?((?:.|\r|\n)*)/g,
	done = 0,
	toString = Object.prototype.toString,
	hasDuplicate = false,
	baseHasDuplicate = true;

// Here we check if the JavaScript engine is using some sort of
// optimization where it does not always call our comparision
// function. If that is the case, discard the hasDuplicate value.
//   Thus far that includes Google Chrome.
[0, 0].sort(function(){
	baseHasDuplicate = false;
	return 0;
});

var Sizzle = function(selector, context, results, seed) {
	results = results || [];
	var origContext = context = context || document;

	if ( context.nodeType !== 1 && context.nodeType !== 9 ) {
		return [];
	}
	
	if ( !selector || typeof selector !== "string" ) {
		return results;
	}

	var parts = [], m, set, checkSet, extra, prune = true, contextXML = isXML(context),
		soFar = selector;
	
	// Reset the position of the chunker regexp (start from head)
	while ( (chunker.exec(""), m = chunker.exec(soFar)) !== null ) {
		soFar = m[3];
		
		parts.push( m[1] );
		
		if ( m[2] ) {
			extra = m[3];
			break;
		}
	}

	if ( parts.length > 1 && origPOS.exec( selector ) ) {
		if ( parts.length === 2 && Expr.relative[ parts[0] ] ) {
			set = posProcess( parts[0] + parts[1], context );
		} else {
			set = Expr.relative[ parts[0] ] ?
				[ context ] :
				Sizzle( parts.shift(), context );

			while ( parts.length ) {
				selector = parts.shift();

				if ( Expr.relative[ selector ] ) {
					selector += parts.shift();
				}
				
				set = posProcess( selector, set );
			}
		}
	} else {
		// Take a shortcut and set the context if the root selector is an ID
		// (but not if it'll be faster if the inner selector is an ID)
		if ( !seed && parts.length > 1 && context.nodeType === 9 && !contextXML &&
				Expr.match.ID.test(parts[0]) && !Expr.match.ID.test(parts[parts.length - 1]) ) {
			var ret = Sizzle.find( parts.shift(), context, contextXML );
			context = ret.expr ? Sizzle.filter( ret.expr, ret.set )[0] : ret.set[0];
		}

		if ( context ) {
			var ret = seed ?
				{ expr: parts.pop(), set: makeArray(seed) } :
				Sizzle.find( parts.pop(), parts.length === 1 && (parts[0] === "~" || parts[0] === "+") && context.parentNode ? context.parentNode : context, contextXML );
			set = ret.expr ? Sizzle.filter( ret.expr, ret.set ) : ret.set;

			if ( parts.length > 0 ) {
				checkSet = makeArray(set);
			} else {
				prune = false;
			}

			while ( parts.length ) {
				var cur = parts.pop(), pop = cur;

				if ( !Expr.relative[ cur ] ) {
					cur = "";
				} else {
					pop = parts.pop();
				}

				if ( pop == null ) {
					pop = context;
				}

				Expr.relative[ cur ]( checkSet, pop, contextXML );
			}
		} else {
			checkSet = parts = [];
		}
	}

	if ( !checkSet ) {
		checkSet = set;
	}

	if ( !checkSet ) {
		Sizzle.error( cur || selector );
	}

	if ( toString.call(checkSet) === "[object Array]" ) {
		if ( !prune ) {
			results.push.apply( results, checkSet );
		} else if ( context && context.nodeType === 1 ) {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && (checkSet[i] === true || checkSet[i].nodeType === 1 && contains(context, checkSet[i])) ) {
					results.push( set[i] );
				}
			}
		} else {
			for ( var i = 0; checkSet[i] != null; i++ ) {
				if ( checkSet[i] && checkSet[i].nodeType === 1 ) {
					results.push( set[i] );
				}
			}
		}
	} else {
		makeArray( checkSet, results );
	}

	if ( extra ) {
		Sizzle( extra, origContext, results, seed );
		Sizzle.uniqueSort( results );
	}

	return results;
};

Sizzle.uniqueSort = function(results){
	if ( sortOrder ) {
		hasDuplicate = baseHasDuplicate;
		results.sort(sortOrder);

		if ( hasDuplicate ) {
			for ( var i = 1; i < results.length; i++ ) {
				if ( results[i] === results[i-1] ) {
					results.splice(i--, 1);
				}
			}
		}
	}

	return results;
};

Sizzle.matches = function(expr, set){
	return Sizzle(expr, null, null, set);
};

Sizzle.find = function(expr, context, isXML){
	var set, match;

	if ( !expr ) {
		return [];
	}

	for ( var i = 0, l = Expr.order.length; i < l; i++ ) {
		var type = Expr.order[i], match;
		
		if ( (match = Expr.leftMatch[ type ].exec( expr )) ) {
			var left = match[1];
			match.splice(1,1);

			if ( left.substr( left.length - 1 ) !== "\\" ) {
				match[1] = (match[1] || "").replace(/\\/g, "");
				set = Expr.find[ type ]( match, context, isXML );
				if ( set != null ) {
					expr = expr.replace( Expr.match[ type ], "" );
					break;
				}
			}
		}
	}

	if ( !set ) {
		set = context.getElementsByTagName("*");
	}

	return {set: set, expr: expr};
};

Sizzle.filter = function(expr, set, inplace, not){
	var old = expr, result = [], curLoop = set, match, anyFound,
		isXMLFilter = set && set[0] && isXML(set[0]);

	while ( expr && set.length ) {
		for ( var type in Expr.filter ) {
			if ( (match = Expr.leftMatch[ type ].exec( expr )) != null && match[2] ) {
				var filter = Expr.filter[ type ], found, item, left = match[1];
				anyFound = false;

				match.splice(1,1);

				if ( left.substr( left.length - 1 ) === "\\" ) {
					continue;
				}

				if ( curLoop === result ) {
					result = [];
				}

				if ( Expr.preFilter[ type ] ) {
					match = Expr.preFilter[ type ]( match, curLoop, inplace, result, not, isXMLFilter );

					if ( !match ) {
						anyFound = found = true;
					} else if ( match === true ) {
						continue;
					}
				}

				if ( match ) {
					for ( var i = 0; (item = curLoop[i]) != null; i++ ) {
						if ( item ) {
							found = filter( item, match, i, curLoop );
							var pass = not ^ !!found;

							if ( inplace && found != null ) {
								if ( pass ) {
									anyFound = true;
								} else {
									curLoop[i] = false;
								}
							} else if ( pass ) {
								result.push( item );
								anyFound = true;
							}
						}
					}
				}

				if ( found !== undefined ) {
					if ( !inplace ) {
						curLoop = result;
					}

					expr = expr.replace( Expr.match[ type ], "" );

					if ( !anyFound ) {
						return [];
					}

					break;
				}
			}
		}

		// Improper expression
		if ( expr === old ) {
			if ( anyFound == null ) {
				Sizzle.error( expr );
			} else {
				break;
			}
		}

		old = expr;
	}

	return curLoop;
};

Sizzle.error = function( msg ) {
	throw "Syntax error, unrecognized expression: " + msg;
};

var Expr = Sizzle.selectors = {
	order: [ "ID", "NAME", "TAG" ],
	match: {
		ID: /#((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		CLASS: /\.((?:[\w\u00c0-\uFFFF-]|\\.)+)/,
		NAME: /\[name=['"]*((?:[\w\u00c0-\uFFFF-]|\\.)+)['"]*\]/,
		ATTR: /\[\s*((?:[\w\u00c0-\uFFFF-]|\\.)+)\s*(?:(\S?=)\s*(['"]*)(.*?)\3|)\s*\]/,
		TAG: /^((?:[\w\u00c0-\uFFFF\*-]|\\.)+)/,
		CHILD: /:(only|nth|last|first)-child(?:\((even|odd|[\dn+-]*)\))?/,
		POS: /:(nth|eq|gt|lt|first|last|even|odd)(?:\((\d*)\))?(?=[^-]|$)/,
		PSEUDO: /:((?:[\w\u00c0-\uFFFF-]|\\.)+)(?:\((['"]?)((?:\([^\)]+\)|[^\(\)]*)+)\2\))?/
	},
	leftMatch: {},
	attrMap: {
		"class": "className",
		"for": "htmlFor"
	},
	attrHandle: {
		href: function(elem){
			return elem.getAttribute("href");
		}
	},
	relative: {
		"+": function(checkSet, part){
			var isPartStr = typeof part === "string",
				isTag = isPartStr && !/\W/.test(part),
				isPartStrNotTag = isPartStr && !isTag;

			if ( isTag ) {
				part = part.toLowerCase();
			}

			for ( var i = 0, l = checkSet.length, elem; i < l; i++ ) {
				if ( (elem = checkSet[i]) ) {
					while ( (elem = elem.previousSibling) && elem.nodeType !== 1 ) {}

					checkSet[i] = isPartStrNotTag || elem && elem.nodeName.toLowerCase() === part ?
						elem || false :
						elem === part;
				}
			}

			if ( isPartStrNotTag ) {
				Sizzle.filter( part, checkSet, true );
			}
		},
		">": function(checkSet, part){
			var isPartStr = typeof part === "string";

			if ( isPartStr && !/\W/.test(part) ) {
				part = part.toLowerCase();

				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						var parent = elem.parentNode;
						checkSet[i] = parent.nodeName.toLowerCase() === part ? parent : false;
					}
				}
			} else {
				for ( var i = 0, l = checkSet.length; i < l; i++ ) {
					var elem = checkSet[i];
					if ( elem ) {
						checkSet[i] = isPartStr ?
							elem.parentNode :
							elem.parentNode === part;
					}
				}

				if ( isPartStr ) {
					Sizzle.filter( part, checkSet, true );
				}
			}
		},
		"": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( typeof part === "string" && !/\W/.test(part) ) {
				var nodeCheck = part = part.toLowerCase();
				checkFn = dirNodeCheck;
			}

			checkFn("parentNode", part, doneName, checkSet, nodeCheck, isXML);
		},
		"~": function(checkSet, part, isXML){
			var doneName = done++, checkFn = dirCheck;

			if ( typeof part === "string" && !/\W/.test(part) ) {
				var nodeCheck = part = part.toLowerCase();
				checkFn = dirNodeCheck;
			}

			checkFn("previousSibling", part, doneName, checkSet, nodeCheck, isXML);
		}
	},
	find: {
		ID: function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? [m] : [];
			}
		},
		NAME: function(match, context){
			if ( typeof context.getElementsByName !== "undefined" ) {
				var ret = [], results = context.getElementsByName(match[1]);

				for ( var i = 0, l = results.length; i < l; i++ ) {
					if ( results[i].getAttribute("name") === match[1] ) {
						ret.push( results[i] );
					}
				}

				return ret.length === 0 ? null : ret;
			}
		},
		TAG: function(match, context){
			return context.getElementsByTagName(match[1]);
		}
	},
	preFilter: {
		CLASS: function(match, curLoop, inplace, result, not, isXML){
			match = " " + match[1].replace(/\\/g, "") + " ";

			if ( isXML ) {
				return match;
			}

			for ( var i = 0, elem; (elem = curLoop[i]) != null; i++ ) {
				if ( elem ) {
					if ( not ^ (elem.className && (" " + elem.className + " ").replace(/[\t\n]/g, " ").indexOf(match) >= 0) ) {
						if ( !inplace ) {
							result.push( elem );
						}
					} else if ( inplace ) {
						curLoop[i] = false;
					}
				}
			}

			return false;
		},
		ID: function(match){
			return match[1].replace(/\\/g, "");
		},
		TAG: function(match, curLoop){
			return match[1].toLowerCase();
		},
		CHILD: function(match){
			if ( match[1] === "nth" ) {
				// parse equations like 'even', 'odd', '5', '2n', '3n+2', '4n-1', '-n+6'
				var test = /(-?)(\d*)n((?:\+|-)?\d*)/.exec(
					match[2] === "even" && "2n" || match[2] === "odd" && "2n+1" ||
					!/\D/.test( match[2] ) && "0n+" + match[2] || match[2]);

				// calculate the numbers (first)n+(last) including if they are negative
				match[2] = (test[1] + (test[2] || 1)) - 0;
				match[3] = test[3] - 0;
			}

			// TODO: Move to normal caching system
			match[0] = done++;

			return match;
		},
		ATTR: function(match, curLoop, inplace, result, not, isXML){
			var name = match[1].replace(/\\/g, "");
			
			if ( !isXML && Expr.attrMap[name] ) {
				match[1] = Expr.attrMap[name];
			}

			if ( match[2] === "~=" ) {
				match[4] = " " + match[4] + " ";
			}

			return match;
		},
		PSEUDO: function(match, curLoop, inplace, result, not){
			if ( match[1] === "not" ) {
				// If we're dealing with a complex expression, or a simple one
				if ( ( chunker.exec(match[3]) || "" ).length > 1 || /^\w/.test(match[3]) ) {
					match[3] = Sizzle(match[3], null, null, curLoop);
				} else {
					var ret = Sizzle.filter(match[3], curLoop, inplace, true ^ not);
					if ( !inplace ) {
						result.push.apply( result, ret );
					}
					return false;
				}
			} else if ( Expr.match.POS.test( match[0] ) || Expr.match.CHILD.test( match[0] ) ) {
				return true;
			}
			
			return match;
		},
		POS: function(match){
			match.unshift( true );
			return match;
		}
	},
	filters: {
		enabled: function(elem){
			return elem.disabled === false && elem.type !== "hidden";
		},
		disabled: function(elem){
			return elem.disabled === true;
		},
		checked: function(elem){
			return elem.checked === true;
		},
		selected: function(elem){
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			elem.parentNode.selectedIndex;
			return elem.selected === true;
		},
		parent: function(elem){
			return !!elem.firstChild;
		},
		empty: function(elem){
			return !elem.firstChild;
		},
		has: function(elem, i, match){
			return !!Sizzle( match[3], elem ).length;
		},
		header: function(elem){
			return /h\d/i.test( elem.nodeName );
		},
		text: function(elem){
			return "text" === elem.type;
		},
		radio: function(elem){
			return "radio" === elem.type;
		},
		checkbox: function(elem){
			return "checkbox" === elem.type;
		},
		file: function(elem){
			return "file" === elem.type;
		},
		password: function(elem){
			return "password" === elem.type;
		},
		submit: function(elem){
			return "submit" === elem.type;
		},
		image: function(elem){
			return "image" === elem.type;
		},
		reset: function(elem){
			return "reset" === elem.type;
		},
		button: function(elem){
			return "button" === elem.type || elem.nodeName.toLowerCase() === "button";
		},
		input: function(elem){
			return /input|select|textarea|button/i.test(elem.nodeName);
		}
	},
	setFilters: {
		first: function(elem, i){
			return i === 0;
		},
		last: function(elem, i, match, array){
			return i === array.length - 1;
		},
		even: function(elem, i){
			return i % 2 === 0;
		},
		odd: function(elem, i){
			return i % 2 === 1;
		},
		lt: function(elem, i, match){
			return i < match[3] - 0;
		},
		gt: function(elem, i, match){
			return i > match[3] - 0;
		},
		nth: function(elem, i, match){
			return match[3] - 0 === i;
		},
		eq: function(elem, i, match){
			return match[3] - 0 === i;
		}
	},
	filter: {
		PSEUDO: function(elem, match, i, array){
			var name = match[1], filter = Expr.filters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			} else if ( name === "contains" ) {
				return (elem.textContent || elem.innerText || getText([ elem ]) || "").indexOf(match[3]) >= 0;
			} else if ( name === "not" ) {
				var not = match[3];

				for ( var i = 0, l = not.length; i < l; i++ ) {
					if ( not[i] === elem ) {
						return false;
					}
				}

				return true;
			} else {
				Sizzle.error( "Syntax error, unrecognized expression: " + name );
			}
		},
		CHILD: function(elem, match){
			var type = match[1], node = elem;
			switch (type) {
				case 'only':
				case 'first':
					while ( (node = node.previousSibling) )	 {
						if ( node.nodeType === 1 ) { 
							return false; 
						}
					}
					if ( type === "first" ) { 
						return true; 
					}
					node = elem;
				case 'last':
					while ( (node = node.nextSibling) )	 {
						if ( node.nodeType === 1 ) { 
							return false; 
						}
					}
					return true;
				case 'nth':
					var first = match[2], last = match[3];

					if ( first === 1 && last === 0 ) {
						return true;
					}
					
					var doneName = match[0],
						parent = elem.parentNode;
	
					if ( parent && (parent.sizcache !== doneName || !elem.nodeIndex) ) {
						var count = 0;
						for ( node = parent.firstChild; node; node = node.nextSibling ) {
							if ( node.nodeType === 1 ) {
								node.nodeIndex = ++count;
							}
						} 
						parent.sizcache = doneName;
					}
					
					var diff = elem.nodeIndex - last;
					if ( first === 0 ) {
						return diff === 0;
					} else {
						return ( diff % first === 0 && diff / first >= 0 );
					}
			}
		},
		ID: function(elem, match){
			return elem.nodeType === 1 && elem.getAttribute("id") === match;
		},
		TAG: function(elem, match){
			return (match === "*" && elem.nodeType === 1) || elem.nodeName.toLowerCase() === match;
		},
		CLASS: function(elem, match){
			return (" " + (elem.className || elem.getAttribute("class")) + " ")
				.indexOf( match ) > -1;
		},
		ATTR: function(elem, match){
			var name = match[1],
				result = Expr.attrHandle[ name ] ?
					Expr.attrHandle[ name ]( elem ) :
					elem[ name ] != null ?
						elem[ name ] :
						elem.getAttribute( name ),
				value = result + "",
				type = match[2],
				check = match[4];

			return result == null ?
				type === "!=" :
				type === "=" ?
				value === check :
				type === "*=" ?
				value.indexOf(check) >= 0 :
				type === "~=" ?
				(" " + value + " ").indexOf(check) >= 0 :
				!check ?
				value && result !== false :
				type === "!=" ?
				value !== check :
				type === "^=" ?
				value.indexOf(check) === 0 :
				type === "$=" ?
				value.substr(value.length - check.length) === check :
				type === "|=" ?
				value === check || value.substr(0, check.length + 1) === check + "-" :
				false;
		},
		POS: function(elem, match, i, array){
			var name = match[2], filter = Expr.setFilters[ name ];

			if ( filter ) {
				return filter( elem, i, match, array );
			}
		}
	}
};

var origPOS = Expr.match.POS;

for ( var type in Expr.match ) {
	Expr.match[ type ] = new RegExp( Expr.match[ type ].source + /(?![^\[]*\])(?![^\(]*\))/.source );
	Expr.leftMatch[ type ] = new RegExp( /(^(?:.|\r|\n)*?)/.source + Expr.match[ type ].source.replace(/\\(\d+)/g, function(all, num){
		return "\\" + (num - 0 + 1);
	}));
}

var makeArray = function(array, results) {
	array = Array.prototype.slice.call( array, 0 );

	if ( results ) {
		results.push.apply( results, array );
		return results;
	}
	
	return array;
};

// Perform a simple check to determine if the browser is capable of
// converting a NodeList to an array using builtin methods.
// Also verifies that the returned array holds DOM nodes
// (which is not the case in the Blackberry browser)
try {
	Array.prototype.slice.call( document.documentElement.childNodes, 0 )[0].nodeType;

// Provide a fallback method if it does not work
} catch(e){
	makeArray = function(array, results) {
		var ret = results || [];

		if ( toString.call(array) === "[object Array]" ) {
			Array.prototype.push.apply( ret, array );
		} else {
			if ( typeof array.length === "number" ) {
				for ( var i = 0, l = array.length; i < l; i++ ) {
					ret.push( array[i] );
				}
			} else {
				for ( var i = 0; array[i]; i++ ) {
					ret.push( array[i] );
				}
			}
		}

		return ret;
	};
}

var sortOrder;

if ( document.documentElement.compareDocumentPosition ) {
	sortOrder = function( a, b ) {
		if ( !a.compareDocumentPosition || !b.compareDocumentPosition ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return a.compareDocumentPosition ? -1 : 1;
		}

		var ret = a.compareDocumentPosition(b) & 4 ? -1 : a === b ? 0 : 1;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( "sourceIndex" in document.documentElement ) {
	sortOrder = function( a, b ) {
		if ( !a.sourceIndex || !b.sourceIndex ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return a.sourceIndex ? -1 : 1;
		}

		var ret = a.sourceIndex - b.sourceIndex;
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
} else if ( document.createRange ) {
	sortOrder = function( a, b ) {
		if ( !a.ownerDocument || !b.ownerDocument ) {
			if ( a == b ) {
				hasDuplicate = true;
			}
			return a.ownerDocument ? -1 : 1;
		}

		var aRange = a.ownerDocument.createRange(), bRange = b.ownerDocument.createRange();
		aRange.setStart(a, 0);
		aRange.setEnd(a, 0);
		bRange.setStart(b, 0);
		bRange.setEnd(b, 0);
		var ret = aRange.compareBoundaryPoints(Range.START_TO_END, bRange);
		if ( ret === 0 ) {
			hasDuplicate = true;
		}
		return ret;
	};
}

// Utility function for retreiving the text value of an array of DOM nodes
function getText( elems ) {
	var ret = "", elem;

	for ( var i = 0; elems[i]; i++ ) {
		elem = elems[i];

		// Get the text from text nodes and CDATA nodes
		if ( elem.nodeType === 3 || elem.nodeType === 4 ) {
			ret += elem.nodeValue;

		// Traverse everything else, except comment nodes
		} else if ( elem.nodeType !== 8 ) {
			ret += getText( elem.childNodes );
		}
	}

	return ret;
}

// Check to see if the browser returns elements by name when
// querying by getElementById (and provide a workaround)
(function(){
	// We're going to inject a fake input element with a specified name
	var form = document.createElement("div"),
		id = "script" + (new Date).getTime();
	form.innerHTML = "<a name='" + id + "'/>";

	// Inject it into the root element, check its status, and remove it quickly
	var root = document.documentElement;
	root.insertBefore( form, root.firstChild );

	// The workaround has to do additional checks after a getElementById
	// Which slows things down for other browsers (hence the branching)
	if ( document.getElementById( id ) ) {
		Expr.find.ID = function(match, context, isXML){
			if ( typeof context.getElementById !== "undefined" && !isXML ) {
				var m = context.getElementById(match[1]);
				return m ? m.id === match[1] || typeof m.getAttributeNode !== "undefined" && m.getAttributeNode("id").nodeValue === match[1] ? [m] : undefined : [];
			}
		};

		Expr.filter.ID = function(elem, match){
			var node = typeof elem.getAttributeNode !== "undefined" && elem.getAttributeNode("id");
			return elem.nodeType === 1 && node && node.nodeValue === match;
		};
	}

	root.removeChild( form );
	root = form = null; // release memory in IE
})();

(function(){
	// Check to see if the browser returns only elements
	// when doing getElementsByTagName("*")

	// Create a fake element
	var div = document.createElement("div");
	div.appendChild( document.createComment("") );

	// Make sure no comments are found
	if ( div.getElementsByTagName("*").length > 0 ) {
		Expr.find.TAG = function(match, context){
			var results = context.getElementsByTagName(match[1]);

			// Filter out possible comments
			if ( match[1] === "*" ) {
				var tmp = [];

				for ( var i = 0; results[i]; i++ ) {
					if ( results[i].nodeType === 1 ) {
						tmp.push( results[i] );
					}
				}

				results = tmp;
			}

			return results;
		};
	}

	// Check to see if an attribute returns normalized href attributes
	div.innerHTML = "<a href='#'></a>";
	if ( div.firstChild && typeof div.firstChild.getAttribute !== "undefined" &&
			div.firstChild.getAttribute("href") !== "#" ) {
		Expr.attrHandle.href = function(elem){
			return elem.getAttribute("href", 2);
		};
	}

	div = null; // release memory in IE
})();

if ( document.querySelectorAll ) {
	(function(){
		var oldSizzle = Sizzle, div = document.createElement("div");
		div.innerHTML = "<p class='TEST'></p>";

		// Safari can't handle uppercase or unicode characters when
		// in quirks mode.
		if ( div.querySelectorAll && div.querySelectorAll(".TEST").length === 0 ) {
			return;
		}
	
		Sizzle = function(query, context, extra, seed){
			context = context || document;

			// Only use querySelectorAll on non-XML documents
			// (ID selectors don't work in non-HTML documents)
			if ( !seed && context.nodeType === 9 && !isXML(context) ) {
				try {
					return makeArray( context.querySelectorAll(query), extra );
				} catch(e){}
			}
		
			return oldSizzle(query, context, extra, seed);
		};

		for ( var prop in oldSizzle ) {
			Sizzle[ prop ] = oldSizzle[ prop ];
		}

		div = null; // release memory in IE
	})();
}

(function(){
	var div = document.createElement("div");

	div.innerHTML = "<div class='test e'></div><div class='test'></div>";

	// Opera can't find a second classname (in 9.6)
	// Also, make sure that getElementsByClassName actually exists
	if ( !div.getElementsByClassName || div.getElementsByClassName("e").length === 0 ) {
		return;
	}

	// Safari caches class attributes, doesn't catch changes (in 3.2)
	div.lastChild.className = "e";

	if ( div.getElementsByClassName("e").length === 1 ) {
		return;
	}
	
	Expr.order.splice(1, 0, "CLASS");
	Expr.find.CLASS = function(match, context, isXML) {
		if ( typeof context.getElementsByClassName !== "undefined" && !isXML ) {
			return context.getElementsByClassName(match[1]);
		}
	};

	div = null; // release memory in IE
})();

function dirNodeCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 && !isXML ){
					elem.sizcache = doneName;
					elem.sizset = i;
				}

				if ( elem.nodeName.toLowerCase() === cur ) {
					match = elem;
					break;
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

function dirCheck( dir, cur, doneName, checkSet, nodeCheck, isXML ) {
	for ( var i = 0, l = checkSet.length; i < l; i++ ) {
		var elem = checkSet[i];
		if ( elem ) {
			elem = elem[dir];
			var match = false;

			while ( elem ) {
				if ( elem.sizcache === doneName ) {
					match = checkSet[elem.sizset];
					break;
				}

				if ( elem.nodeType === 1 ) {
					if ( !isXML ) {
						elem.sizcache = doneName;
						elem.sizset = i;
					}
					if ( typeof cur !== "string" ) {
						if ( elem === cur ) {
							match = true;
							break;
						}

					} else if ( Sizzle.filter( cur, [elem] ).length > 0 ) {
						match = elem;
						break;
					}
				}

				elem = elem[dir];
			}

			checkSet[i] = match;
		}
	}
}

var contains = document.compareDocumentPosition ? function(a, b){
	return !!(a.compareDocumentPosition(b) & 16);
} : function(a, b){
	return a !== b && (a.contains ? a.contains(b) : true);
};

var isXML = function(elem){
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833) 
	var documentElement = (elem ? elem.ownerDocument || elem : 0).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

var posProcess = function(selector, context){
	var tmpSet = [], later = "", match,
		root = context.nodeType ? [context] : context;

	// Position selectors must be done after the filter
	// And so must :not(positional) so we move all PSEUDOs to the end
	while ( (match = Expr.match.PSEUDO.exec( selector )) ) {
		later += match[0];
		selector = selector.replace( Expr.match.PSEUDO, "" );
	}

	selector = Expr.relative[selector] ? selector + "*" : selector;

	for ( var i = 0, l = root.length; i < l; i++ ) {
		Sizzle( selector, root[i], tmpSet );
	}

	return Sizzle.filter( later, tmpSet );
};

// EXPOSE
jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;
jQuery.expr[":"] = jQuery.expr.filters;
jQuery.unique = Sizzle.uniqueSort;
jQuery.text = getText;
jQuery.isXMLDoc = isXML;
jQuery.contains = contains;

return;

window.Sizzle = Sizzle;

})();
var runtil = /Until$/,
	rparentsprev = /^(?:parents|prevUntil|prevAll)/,
	// Note: This RegExp should be improved, or likely pulled from Sizzle
	rmultiselector = /,/,
	slice = Array.prototype.slice;

// Implement the identical functionality for filter and not
var winnow = function( elements, qualifier, keep ) {
	if ( jQuery.isFunction( qualifier ) ) {
		return jQuery.grep(elements, function( elem, i ) {
			return !!qualifier.call( elem, i, elem ) === keep;
		});

	} else if ( qualifier.nodeType ) {
		return jQuery.grep(elements, function( elem, i ) {
			return (elem === qualifier) === keep;
		});

	} else if ( typeof qualifier === "string" ) {
		var filtered = jQuery.grep(elements, function( elem ) {
			return elem.nodeType === 1;
		});

		if ( isSimple.test( qualifier ) ) {
			return jQuery.filter(qualifier, filtered, !keep);
		} else {
			qualifier = jQuery.filter( qualifier, filtered );
		}
	}

	return jQuery.grep(elements, function( elem, i ) {
		return (jQuery.inArray( elem, qualifier ) >= 0) === keep;
	});
};

jQuery.fn.extend({
	find: function( selector ) {
		var ret = this.pushStack( "", "find", selector ), length = 0;

		for ( var i = 0, l = this.length; i < l; i++ ) {
			length = ret.length;
			jQuery.find( selector, this[i], ret );

			if ( i > 0 ) {
				// Make sure that the results are unique
				for ( var n = length; n < ret.length; n++ ) {
					for ( var r = 0; r < length; r++ ) {
						if ( ret[r] === ret[n] ) {
							ret.splice(n--, 1);
							break;
						}
					}
				}
			}
		}

		return ret;
	},

	has: function( target ) {
		var targets = jQuery( target );
		return this.filter(function() {
			for ( var i = 0, l = targets.length; i < l; i++ ) {
				if ( jQuery.contains( this, targets[i] ) ) {
					return true;
				}
			}
		});
	},

	not: function( selector ) {
		return this.pushStack( winnow(this, selector, false), "not", selector);
	},

	filter: function( selector ) {
		return this.pushStack( winnow(this, selector, true), "filter", selector );
	},
	
	is: function( selector ) {
		return !!selector && jQuery.filter( selector, this ).length > 0;
	},

	closest: function( selectors, context ) {
		if ( jQuery.isArray( selectors ) ) {
			var ret = [], cur = this[0], match, matches = {}, selector;

			if ( cur && selectors.length ) {
				for ( var i = 0, l = selectors.length; i < l; i++ ) {
					selector = selectors[i];

					if ( !matches[selector] ) {
						matches[selector] = jQuery.expr.match.POS.test( selector ) ? 
							jQuery( selector, context || this.context ) :
							selector;
					}
				}

				while ( cur && cur.ownerDocument && cur !== context ) {
					for ( selector in matches ) {
						match = matches[selector];

						if ( match.jquery ? match.index(cur) > -1 : jQuery(cur).is(match) ) {
							ret.push({ selector: selector, elem: cur });
							delete matches[selector];
						}
					}
					cur = cur.parentNode;
				}
			}

			return ret;
		}

		var pos = jQuery.expr.match.POS.test( selectors ) ? 
			jQuery( selectors, context || this.context ) : null;

		return this.map(function( i, cur ) {
			while ( cur && cur.ownerDocument && cur !== context ) {
				if ( pos ? pos.index(cur) > -1 : jQuery(cur).is(selectors) ) {
					return cur;
				}
				cur = cur.parentNode;
			}
			return null;
		});
	},
	
	// Determine the position of an element within
	// the matched set of elements
	index: function( elem ) {
		if ( !elem || typeof elem === "string" ) {
			return jQuery.inArray( this[0],
				// If it receives a string, the selector is used
				// If it receives nothing, the siblings are used
				elem ? jQuery( elem ) : this.parent().children() );
		}
		// Locate the position of the desired element
		return jQuery.inArray(
			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[0] : elem, this );
	},

	add: function( selector, context ) {
		var set = typeof selector === "string" ?
				jQuery( selector, context || this.context ) :
				jQuery.makeArray( selector ),
			all = jQuery.merge( this.get(), set );

		return this.pushStack( isDisconnected( set[0] ) || isDisconnected( all[0] ) ?
			all :
			jQuery.unique( all ) );
	},

	andSelf: function() {
		return this.add( this.prevObject );
	}
});

// A painfully simple check to see if an element is disconnected
// from a document (should be improved, where feasible).
function isDisconnected( node ) {
	return !node || !node.parentNode || node.parentNode.nodeType === 11;
}

jQuery.each({
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return jQuery.dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return jQuery.nth( elem, 2, "nextSibling" );
	},
	prev: function( elem ) {
		return jQuery.nth( elem, 2, "previousSibling" );
	},
	nextAll: function( elem ) {
		return jQuery.dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return jQuery.dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return jQuery.dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return jQuery.sibling( elem.parentNode.firstChild, elem );
	},
	children: function( elem ) {
		return jQuery.sibling( elem.firstChild );
	},
	contents: function( elem ) {
		return jQuery.nodeName( elem, "iframe" ) ?
			elem.contentDocument || elem.contentWindow.document :
			jQuery.makeArray( elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var ret = jQuery.map( this, fn, until );
		
		if ( !runtil.test( name ) ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			ret = jQuery.filter( selector, ret );
		}

		ret = this.length > 1 ? jQuery.unique( ret ) : ret;

		if ( (this.length > 1 || rmultiselector.test( selector )) && rparentsprev.test( name ) ) {
			ret = ret.reverse();
		}

		return this.pushStack( ret, name, slice.call(arguments).join(",") );
	};
});

jQuery.extend({
	filter: function( expr, elems, not ) {
		if ( not ) {
			expr = ":not(" + expr + ")";
		}

		return jQuery.find.matches(expr, elems);
	},
	
	dir: function( elem, dir, until ) {
		var matched = [], cur = elem[dir];
		while ( cur && cur.nodeType !== 9 && (until === undefined || cur.nodeType !== 1 || !jQuery( cur ).is( until )) ) {
			if ( cur.nodeType === 1 ) {
				matched.push( cur );
			}
			cur = cur[dir];
		}
		return matched;
	},

	nth: function( cur, result, dir, elem ) {
		result = result || 1;
		var num = 0;

		for ( ; cur; cur = cur[dir] ) {
			if ( cur.nodeType === 1 && ++num === result ) {
				break;
			}
		}

		return cur;
	},

	sibling: function( n, elem ) {
		var r = [];

		for ( ; n; n = n.nextSibling ) {
			if ( n.nodeType === 1 && n !== elem ) {
				r.push( n );
			}
		}

		return r;
	}
});
var rinlinejQuery = / jQuery\d+="(?:\d+|null)"/g,
	rleadingWhitespace = /^\s+/,
	rxhtmlTag = /(<([\w:]+)[^>]*?)\/>/g,
	rselfClosing = /^(?:area|br|col|embed|hr|img|input|link|meta|param)$/i,
	rtagName = /<([\w:]+)/,
	rtbody = /<tbody/i,
	rhtml = /<|&#?\w+;/,
	rnocache = /<script|<object|<embed|<option|<style/i,
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,  // checked="checked" or checked (html5)
	fcloseTag = function( all, front, tag ) {
		return rselfClosing.test( tag ) ?
			all :
			front + "></" + tag + ">";
	},
	wrapMap = {
		option: [ 1, "<select multiple='multiple'>", "</select>" ],
		legend: [ 1, "<fieldset>", "</fieldset>" ],
		thead: [ 1, "<table>", "</table>" ],
		tr: [ 2, "<table><tbody>", "</tbody></table>" ],
		td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
		col: [ 2, "<table><tbody></tbody><colgroup>", "</colgroup></table>" ],
		area: [ 1, "<map>", "</map>" ],
		_default: [ 0, "", "" ]
	};

wrapMap.optgroup = wrapMap.option;
wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;

// IE can't serialize <link> and <script> tags normally
if ( !jQuery.support.htmlSerialize ) {
	wrapMap._default = [ 1, "div<div>", "</div>" ];
}

jQuery.fn.extend({
	text: function( text ) {
		if ( jQuery.isFunction(text) ) {
			return this.each(function(i) {
				var self = jQuery(this);
				self.text( text.call(this, i, self.text()) );
			});
		}

		if ( typeof text !== "object" && text !== undefined ) {
			return this.empty().append( (this[0] && this[0].ownerDocument || document).createTextNode( text ) );
		}

		return jQuery.text( this );
	},

	wrapAll: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each(function(i) {
				jQuery(this).wrapAll( html.call(this, i) );
			});
		}

		if ( this[0] ) {
			// The elements to wrap the target around
			var wrap = jQuery( html, this[0].ownerDocument ).eq(0).clone(true);

			if ( this[0].parentNode ) {
				wrap.insertBefore( this[0] );
			}

			wrap.map(function() {
				var elem = this;

				while ( elem.firstChild && elem.firstChild.nodeType === 1 ) {
					elem = elem.firstChild;
				}

				return elem;
			}).append(this);
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( jQuery.isFunction( html ) ) {
			return this.each(function(i) {
				jQuery(this).wrapInner( html.call(this, i) );
			});
		}

		return this.each(function() {
			var self = jQuery( this ), contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		});
	},

	wrap: function( html ) {
		return this.each(function() {
			jQuery( this ).wrapAll( html );
		});
	},

	unwrap: function() {
		return this.parent().each(function() {
			if ( !jQuery.nodeName( this, "body" ) ) {
				jQuery( this ).replaceWith( this.childNodes );
			}
		}).end();
	},

	append: function() {
		return this.domManip(arguments, true, function( elem ) {
			if ( this.nodeType === 1 ) {
				this.appendChild( elem );
			}
		});
	},

	prepend: function() {
		return this.domManip(arguments, true, function( elem ) {
			if ( this.nodeType === 1 ) {
				this.insertBefore( elem, this.firstChild );
			}
		});
	},

	before: function() {
		if ( this[0] && this[0].parentNode ) {
			return this.domManip(arguments, false, function( elem ) {
				this.parentNode.insertBefore( elem, this );
			});
		} else if ( arguments.length ) {
			var set = jQuery(arguments[0]);
			set.push.apply( set, this.toArray() );
			return this.pushStack( set, "before", arguments );
		}
	},

	after: function() {
		if ( this[0] && this[0].parentNode ) {
			return this.domManip(arguments, false, function( elem ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			});
		} else if ( arguments.length ) {
			var set = this.pushStack( this, "after", arguments );
			set.push.apply( set, jQuery(arguments[0]).toArray() );
			return set;
		}
	},
	
	// keepData is for internal use only--do not document
	remove: function( selector, keepData ) {
		for ( var i = 0, elem; (elem = this[i]) != null; i++ ) {
			if ( !selector || jQuery.filter( selector, [ elem ] ).length ) {
				if ( !keepData && elem.nodeType === 1 ) {
					jQuery.cleanData( elem.getElementsByTagName("*") );
					jQuery.cleanData( [ elem ] );
				}

				if ( elem.parentNode ) {
					 elem.parentNode.removeChild( elem );
				}
			}
		}
		
		return this;
	},

	empty: function() {
		for ( var i = 0, elem; (elem = this[i]) != null; i++ ) {
			// Remove element nodes and prevent memory leaks
			if ( elem.nodeType === 1 ) {
				jQuery.cleanData( elem.getElementsByTagName("*") );
			}

			// Remove any remaining nodes
			while ( elem.firstChild ) {
				elem.removeChild( elem.firstChild );
			}
		}
		
		return this;
	},

	clone: function( events ) {
		// Do the clone
		var ret = this.map(function() {
			if ( !jQuery.support.noCloneEvent && !jQuery.isXMLDoc(this) ) {
				// IE copies events bound via attachEvent when
				// using cloneNode. Calling detachEvent on the
				// clone will also remove the events from the orignal
				// In order to get around this, we use innerHTML.
				// Unfortunately, this means some modifications to
				// attributes in IE that are actually only stored
				// as properties will not be copied (such as the
				// the name attribute on an input).
				var html = this.outerHTML, ownerDocument = this.ownerDocument;
				if ( !html ) {
					var div = ownerDocument.createElement("div");
					div.appendChild( this.cloneNode(true) );
					html = div.innerHTML;
				}

				return jQuery.clean([html.replace(rinlinejQuery, "")
					// Handle the case in IE 8 where action=/test/> self-closes a tag
					.replace(/=([^="'>\s]+\/)>/g, '="$1">')
					.replace(rleadingWhitespace, "")], ownerDocument)[0];
			} else {
				return this.cloneNode(true);
			}
		});

		// Copy the events from the original to the clone
		if ( events === true ) {
			cloneCopyEvent( this, ret );
			cloneCopyEvent( this.find("*"), ret.find("*") );
		}

		// Return the cloned set
		return ret;
	},

	html: function( value ) {
		if ( value === undefined ) {
			return this[0] && this[0].nodeType === 1 ?
				this[0].innerHTML.replace(rinlinejQuery, "") :
				null;

		// See if we can take a shortcut and just use innerHTML
		} else if ( typeof value === "string" && !rnocache.test( value ) &&
			(jQuery.support.leadingWhitespace || !rleadingWhitespace.test( value )) &&
			!wrapMap[ (rtagName.exec( value ) || ["", ""])[1].toLowerCase() ] ) {

			value = value.replace(rxhtmlTag, fcloseTag);

			try {
				for ( var i = 0, l = this.length; i < l; i++ ) {
					// Remove element nodes and prevent memory leaks
					if ( this[i].nodeType === 1 ) {
						jQuery.cleanData( this[i].getElementsByTagName("*") );
						this[i].innerHTML = value;
					}
				}

			// If using innerHTML throws an exception, use the fallback method
			} catch(e) {
				this.empty().append( value );
			}

		} else if ( jQuery.isFunction( value ) ) {
			this.each(function(i){
				var self = jQuery(this), old = self.html();
				self.empty().append(function(){
					return value.call( this, i, old );
				});
			});

		} else {
			this.empty().append( value );
		}

		return this;
	},

	replaceWith: function( value ) {
		if ( this[0] && this[0].parentNode ) {
			// Make sure that the elements are removed from the DOM before they are inserted
			// this can help fix replacing a parent with child elements
			if ( jQuery.isFunction( value ) ) {
				return this.each(function(i) {
					var self = jQuery(this), old = self.html();
					self.replaceWith( value.call( this, i, old ) );
				});
			}

			if ( typeof value !== "string" ) {
				value = jQuery(value).detach();
			}

			return this.each(function() {
				var next = this.nextSibling, parent = this.parentNode;

				jQuery(this).remove();

				if ( next ) {
					jQuery(next).before( value );
				} else {
					jQuery(parent).append( value );
				}
			});
		} else {
			return this.pushStack( jQuery(jQuery.isFunction(value) ? value() : value), "replaceWith", value );
		}
	},

	detach: function( selector ) {
		return this.remove( selector, true );
	},

	domManip: function( args, table, callback ) {
		var results, first, value = args[0], scripts = [], fragment, parent;

		// We can't cloneNode fragments that contain checked, in WebKit
		if ( !jQuery.support.checkClone && arguments.length === 3 && typeof value === "string" && rchecked.test( value ) ) {
			return this.each(function() {
				jQuery(this).domManip( args, table, callback, true );
			});
		}

		if ( jQuery.isFunction(value) ) {
			return this.each(function(i) {
				var self = jQuery(this);
				args[0] = value.call(this, i, table ? self.html() : undefined);
				self.domManip( args, table, callback );
			});
		}

		if ( this[0] ) {
			parent = value && value.parentNode;

			// If we're in a fragment, just use that instead of building a new one
			if ( jQuery.support.parentNode && parent && parent.nodeType === 11 && parent.childNodes.length === this.length ) {
				results = { fragment: parent };

			} else {
				results = buildFragment( args, this, scripts );
			}
			
			fragment = results.fragment;
			
			if ( fragment.childNodes.length === 1 ) {
				first = fragment = fragment.firstChild;
			} else {
				first = fragment.firstChild;
			}

			if ( first ) {
				table = table && jQuery.nodeName( first, "tr" );

				for ( var i = 0, l = this.length; i < l; i++ ) {
					callback.call(
						table ?
							root(this[i], first) :
							this[i],
						i > 0 || results.cacheable || this.length > 1  ?
							fragment.cloneNode(true) :
							fragment
					);
				}
			}

			if ( scripts.length ) {
				jQuery.each( scripts, evalScript );
			}
		}

		return this;

		function root( elem, cur ) {
			return jQuery.nodeName(elem, "table") ?
				(elem.getElementsByTagName("tbody")[0] ||
				elem.appendChild(elem.ownerDocument.createElement("tbody"))) :
				elem;
		}
	}
});

function cloneCopyEvent(orig, ret) {
	var i = 0;

	ret.each(function() {
		if ( this.nodeName !== (orig[i] && orig[i].nodeName) ) {
			return;
		}

		var oldData = jQuery.data( orig[i++] ), curData = jQuery.data( this, oldData ), events = oldData && oldData.events;

		if ( events ) {
			delete curData.handle;
			curData.events = {};

			for ( var type in events ) {
				for ( var handler in events[ type ] ) {
					jQuery.event.add( this, type, events[ type ][ handler ], events[ type ][ handler ].data );
				}
			}
		}
	});
}

function buildFragment( args, nodes, scripts ) {
	var fragment, cacheable, cacheresults,
		doc = (nodes && nodes[0] ? nodes[0].ownerDocument || nodes[0] : document);

	// Only cache "small" (1/2 KB) strings that are associated with the main document
	// Cloning options loses the selected state, so don't cache them
	// IE 6 doesn't like it when you put <object> or <embed> elements in a fragment
	// Also, WebKit does not clone 'checked' attributes on cloneNode, so don't cache
	if ( args.length === 1 && typeof args[0] === "string" && args[0].length < 512 && doc === document &&
		!rnocache.test( args[0] ) && (jQuery.support.checkClone || !rchecked.test( args[0] )) ) {

		cacheable = true;
		cacheresults = jQuery.fragments[ args[0] ];
		if ( cacheresults ) {
			if ( cacheresults !== 1 ) {
				fragment = cacheresults;
			}
		}
	}

	if ( !fragment ) {
		fragment = doc.createDocumentFragment();
		jQuery.clean( args, doc, fragment, scripts );
	}

	if ( cacheable ) {
		jQuery.fragments[ args[0] ] = cacheresults ? fragment : 1;
	}

	return { fragment: fragment, cacheable: cacheable };
}

jQuery.fragments = {};

jQuery.each({
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var ret = [], insert = jQuery( selector ),
			parent = this.length === 1 && this[0].parentNode;
		
		if ( parent && parent.nodeType === 11 && parent.childNodes.length === 1 && insert.length === 1 ) {
			insert[ original ]( this[0] );
			return this;
			
		} else {
			for ( var i = 0, l = insert.length; i < l; i++ ) {
				var elems = (i > 0 ? this.clone(true) : this).get();
				jQuery.fn[ original ].apply( jQuery(insert[i]), elems );
				ret = ret.concat( elems );
			}
		
			return this.pushStack( ret, name, insert.selector );
		}
	};
});

jQuery.extend({
	clean: function( elems, context, fragment, scripts ) {
		context = context || document;

		// !context.createElement fails in IE with an error but returns typeof 'object'
		if ( typeof context.createElement === "undefined" ) {
			context = context.ownerDocument || context[0] && context[0].ownerDocument || document;
		}

		var ret = [];

		for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
			if ( typeof elem === "number" ) {
				elem += "";
			}

			if ( !elem ) {
				continue;
			}

			// Convert html string into DOM nodes
			if ( typeof elem === "string" && !rhtml.test( elem ) ) {
				elem = context.createTextNode( elem );

			} else if ( typeof elem === "string" ) {
				// Fix "XHTML"-style tags in all browsers
				elem = elem.replace(rxhtmlTag, fcloseTag);

				// Trim whitespace, otherwise indexOf won't work as expected
				var tag = (rtagName.exec( elem ) || ["", ""])[1].toLowerCase(),
					wrap = wrapMap[ tag ] || wrapMap._default,
					depth = wrap[0],
					div = context.createElement("div");

				// Go to html and back, then peel off extra wrappers
				div.innerHTML = wrap[1] + elem + wrap[2];

				// Move to the right depth
				while ( depth-- ) {
					div = div.lastChild;
				}

				// Remove IE's autoinserted <tbody> from table fragments
				if ( !jQuery.support.tbody ) {

					// String was a <table>, *may* have spurious <tbody>
					var hasBody = rtbody.test(elem),
						tbody = tag === "table" && !hasBody ?
							div.firstChild && div.firstChild.childNodes :

							// String was a bare <thead> or <tfoot>
							wrap[1] === "<table>" && !hasBody ?
								div.childNodes :
								[];

					for ( var j = tbody.length - 1; j >= 0 ; --j ) {
						if ( jQuery.nodeName( tbody[ j ], "tbody" ) && !tbody[ j ].childNodes.length ) {
							tbody[ j ].parentNode.removeChild( tbody[ j ] );
						}
					}

				}

				// IE completely kills leading whitespace when innerHTML is used
				if ( !jQuery.support.leadingWhitespace && rleadingWhitespace.test( elem ) ) {
					div.insertBefore( context.createTextNode( rleadingWhitespace.exec(elem)[0] ), div.firstChild );
				}

				elem = div.childNodes;
			}

			if ( elem.nodeType ) {
				ret.push( elem );
			} else {
				ret = jQuery.merge( ret, elem );
			}
		}

		if ( fragment ) {
			for ( var i = 0; ret[i]; i++ ) {
				if ( scripts && jQuery.nodeName( ret[i], "script" ) && (!ret[i].type || ret[i].type.toLowerCase() === "text/javascript") ) {
					scripts.push( ret[i].parentNode ? ret[i].parentNode.removeChild( ret[i] ) : ret[i] );
				
				} else {
					if ( ret[i].nodeType === 1 ) {
						ret.splice.apply( ret, [i + 1, 0].concat(jQuery.makeArray(ret[i].getElementsByTagName("script"))) );
					}
					fragment.appendChild( ret[i] );
				}
			}
		}

		return ret;
	},
	
	cleanData: function( elems ) {
		var data, id, cache = jQuery.cache,
			special = jQuery.event.special,
			deleteExpando = jQuery.support.deleteExpando;
		
		for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
			id = elem[ jQuery.expando ];
			
			if ( id ) {
				data = cache[ id ];
				
				if ( data.events ) {
					for ( var type in data.events ) {
						if ( special[ type ] ) {
							jQuery.event.remove( elem, type );

						} else {
							removeEvent( elem, type, data.handle );
						}
					}
				}
				
				if ( deleteExpando ) {
					delete elem[ jQuery.expando ];

				} else if ( elem.removeAttribute ) {
					elem.removeAttribute( jQuery.expando );
				}
				
				delete cache[ id ];
			}
		}
	}
});
// exclude the following css properties to add px
var rexclude = /z-?index|font-?weight|opacity|zoom|line-?height/i,
	ralpha = /alpha\([^)]*\)/,
	ropacity = /opacity=([^)]*)/,
	rfloat = /float/i,
	rdashAlpha = /-([a-z])/ig,
	rupper = /([A-Z])/g,
	rnumpx = /^-?\d+(?:px)?$/i,
	rnum = /^-?\d/,

	cssShow = { position: "absolute", visibility: "hidden", display:"block" },
	cssWidth = [ "Left", "Right" ],
	cssHeight = [ "Top", "Bottom" ],

	// cache check for defaultView.getComputedStyle
	getComputedStyle = document.defaultView && document.defaultView.getComputedStyle,
	// normalize float css property
	styleFloat = jQuery.support.cssFloat ? "cssFloat" : "styleFloat",
	fcamelCase = function( all, letter ) {
		return letter.toUpperCase();
	};

jQuery.fn.css = function( name, value ) {
	return access( this, name, value, true, function( elem, name, value ) {
		if ( value === undefined ) {
			return jQuery.curCSS( elem, name );
		}
		
		if ( typeof value === "number" && !rexclude.test(name) ) {
			value += "px";
		}

		jQuery.style( elem, name, value );
	});
};

jQuery.extend({
	style: function( elem, name, value ) {
		// don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 ) {
			return undefined;
		}

		// ignore negative width and height values #1599
		if ( (name === "width" || name === "height") && parseFloat(value) < 0 ) {
			value = undefined;
		}

		var style = elem.style || elem, set = value !== undefined;

		// IE uses filters for opacity
		if ( !jQuery.support.opacity && name === "opacity" ) {
			if ( set ) {
				// IE has trouble with opacity if it does not have layout
				// Force it by setting the zoom level
				style.zoom = 1;

				// Set the alpha filter to set the opacity
				var opacity = parseInt( value, 10 ) + "" === "NaN" ? "" : "alpha(opacity=" + value * 100 + ")";
				var filter = style.filter || jQuery.curCSS( elem, "filter" ) || "";
				style.filter = ralpha.test(filter) ? filter.replace(ralpha, opacity) : opacity;
			}

			return style.filter && style.filter.indexOf("opacity=") >= 0 ?
				(parseFloat( ropacity.exec(style.filter)[1] ) / 100) + "":
				"";
		}

		// Make sure we're using the right name for getting the float value
		if ( rfloat.test( name ) ) {
			name = styleFloat;
		}

		name = name.replace(rdashAlpha, fcamelCase);

		if ( set ) {
			style[ name ] = value;
		}

		return style[ name ];
	},

	css: function( elem, name, force, extra ) {
		if ( name === "width" || name === "height" ) {
			var val, props = cssShow, which = name === "width" ? cssWidth : cssHeight;

			function getWH() {
				val = name === "width" ? elem.offsetWidth : elem.offsetHeight;

				if ( extra === "border" ) {
					return;
				}

				jQuery.each( which, function() {
					if ( !extra ) {
						val -= parseFloat(jQuery.curCSS( elem, "padding" + this, true)) || 0;
					}

					if ( extra === "margin" ) {
						val += parseFloat(jQuery.curCSS( elem, "margin" + this, true)) || 0;
					} else {
						val -= parseFloat(jQuery.curCSS( elem, "border" + this + "Width", true)) || 0;
					}
				});
			}

			if ( elem.offsetWidth !== 0 ) {
				getWH();
			} else {
				jQuery.swap( elem, props, getWH );
			}

			return Math.max(0, Math.round(val));
		}

		return jQuery.curCSS( elem, name, force );
	},

	curCSS: function( elem, name, force ) {
		var ret, style = elem.style, filter;

		// IE uses filters for opacity
		if ( !jQuery.support.opacity && name === "opacity" && elem.currentStyle ) {
			ret = ropacity.test(elem.currentStyle.filter || "") ?
				(parseFloat(RegExp.$1) / 100) + "" :
				"";

			return ret === "" ?
				"1" :
				ret;
		}

		// Make sure we're using the right name for getting the float value
		if ( rfloat.test( name ) ) {
			name = styleFloat;
		}

		if ( !force && style && style[ name ] ) {
			ret = style[ name ];

		} else if ( getComputedStyle ) {

			// Only "float" is needed here
			if ( rfloat.test( name ) ) {
				name = "float";
			}

			name = name.replace( rupper, "-$1" ).toLowerCase();

			var defaultView = elem.ownerDocument.defaultView;

			if ( !defaultView ) {
				return null;
			}

			var computedStyle = defaultView.getComputedStyle( elem, null );

			if ( computedStyle ) {
				ret = computedStyle.getPropertyValue( name );
			}

			// We should always get a number back from opacity
			if ( name === "opacity" && ret === "" ) {
				ret = "1";
			}

		} else if ( elem.currentStyle ) {
			var camelCase = name.replace(rdashAlpha, fcamelCase);

			ret = elem.currentStyle[ name ] || elem.currentStyle[ camelCase ];

			// From the awesome hack by Dean Edwards
			// http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291

			// If we're not dealing with a regular pixel number
			// but a number that has a weird ending, we need to convert it to pixels
			if ( !rnumpx.test( ret ) && rnum.test( ret ) ) {
				// Remember the original values
				var left = style.left, rsLeft = elem.runtimeStyle.left;

				// Put in the new values to get a computed value out
				elem.runtimeStyle.left = elem.currentStyle.left;
				style.left = camelCase === "fontSize" ? "1em" : (ret || 0);
				ret = style.pixelLeft + "px";

				// Revert the changed values
				style.left = left;
				elem.runtimeStyle.left = rsLeft;
			}
		}

		return ret;
	},

	// A method for quickly swapping in/out CSS properties to get correct calculations
	swap: function( elem, options, callback ) {
		var old = {};

		// Remember the old values, and insert the new ones
		for ( var name in options ) {
			old[ name ] = elem.style[ name ];
			elem.style[ name ] = options[ name ];
		}

		callback.call( elem );

		// Revert the old values
		for ( var name in options ) {
			elem.style[ name ] = old[ name ];
		}
	}
});

if ( jQuery.expr && jQuery.expr.filters ) {
	jQuery.expr.filters.hidden = function( elem ) {
		var width = elem.offsetWidth, height = elem.offsetHeight,
			skip = elem.nodeName.toLowerCase() === "tr";

		return width === 0 && height === 0 && !skip ?
			true :
			width > 0 && height > 0 && !skip ?
				false :
				jQuery.curCSS(elem, "display") === "none";
	};

	jQuery.expr.filters.visible = function( elem ) {
		return !jQuery.expr.filters.hidden( elem );
	};
}
var jsc = now(),
	rscript = /<script(.|\s)*?\/script>/gi,
	rselectTextarea = /select|textarea/i,
	rinput = /color|date|datetime|email|hidden|month|number|password|range|search|tel|text|time|url|week/i,
	jsre = /=\?(&|$)/,
	rquery = /\?/,
	rts = /(\?|&)_=.*?(&|$)/,
	rurl = /^(\w+:)?\/\/([^\/?#]+)/,
	r20 = /%20/g,

	// Keep a copy of the old load method
	_load = jQuery.fn.load;

jQuery.fn.extend({
	load: function( url, params, callback ) {
		if ( typeof url !== "string" ) {
			return _load.call( this, url );

		// Don't do a request if no elements are being requested
		} else if ( !this.length ) {
			return this;
		}

		var off = url.indexOf(" ");
		if ( off >= 0 ) {
			var selector = url.slice(off, url.length);
			url = url.slice(0, off);
		}

		// Default to a GET request
		var type = "GET";

		// If the second parameter was provided
		if ( params ) {
			// If it's a function
			if ( jQuery.isFunction( params ) ) {
				// We assume that it's the callback
				callback = params;
				params = null;

			// Otherwise, build a param string
			} else if ( typeof params === "object" ) {
				params = jQuery.param( params, jQuery.ajaxSettings.traditional );
				type = "POST";
			}
		}

		var self = this;

		// Request the remote document
		jQuery.ajax({
			url: url,
			type: type,
			dataType: "html",
			data: params,
			complete: function( res, status ) {
				// If successful, inject the HTML into all the matched elements
				if ( status === "success" || status === "notmodified" ) {
					// See if a selector was specified
					self.html( selector ?
						// Create a dummy div to hold the results
						jQuery("<div />")
							// inject the contents of the document in, removing the scripts
							// to avoid any 'Permission Denied' errors in IE
							.append(res.responseText.replace(rscript, ""))

							// Locate the specified elements
							.find(selector) :

						// If not, just inject the full result
						res.responseText );
				}

				if ( callback ) {
					self.each( callback, [res.responseText, status, res] );
				}
			}
		});

		return this;
	},

	serialize: function() {
		return jQuery.param(this.serializeArray());
	},
	serializeArray: function() {
		return this.map(function() {
			return this.elements ? jQuery.makeArray(this.elements) : this;
		})
		.filter(function() {
			return this.name && !this.disabled &&
				(this.checked || rselectTextarea.test(this.nodeName) ||
					rinput.test(this.type));
		})
		.map(function( i, elem ) {
			var val = jQuery(this).val();

			return val == null ?
				null :
				jQuery.isArray(val) ?
					jQuery.map( val, function( val, i ) {
						return { name: elem.name, value: val };
					}) :
					{ name: elem.name, value: val };
		}).get();
	}
});

// Attach a bunch of functions for handling common AJAX events
jQuery.each( "ajaxStart ajaxStop ajaxComplete ajaxError ajaxSuccess ajaxSend".split(" "), function( i, o ) {
	jQuery.fn[o] = function( f ) {
		return this.bind(o, f);
	};
});

jQuery.extend({

	get: function( url, data, callback, type ) {
		// shift arguments if data argument was omited
		if ( jQuery.isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = null;
		}

		return jQuery.ajax({
			type: "GET",
			url: url,
			data: data,
			success: callback,
			dataType: type
		});
	},

	getScript: function( url, callback ) {
		return jQuery.get(url, null, callback, "script");
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get(url, data, callback, "json");
	},

	post: function( url, data, callback, type ) {
		// shift arguments if data argument was omited
		if ( jQuery.isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = {};
		}

		return jQuery.ajax({
			type: "POST",
			url: url,
			data: data,
			success: callback,
			dataType: type
		});
	},

	ajaxSetup: function( settings ) {
		jQuery.extend( jQuery.ajaxSettings, settings );
	},

	ajaxSettings: {
		url: location.href,
		global: true,
		type: "GET",
		contentType: "application/x-www-form-urlencoded",
		processData: true,
		async: true,
		/*
		timeout: 0,
		data: null,
		username: null,
		password: null,
		traditional: false,
		*/
		// Create the request object; Microsoft failed to properly
		// implement the XMLHttpRequest in IE7 (can't request local files),
		// so we use the ActiveXObject when it is available
		// This function can be overriden by calling jQuery.ajaxSetup
		xhr: window.XMLHttpRequest && (window.location.protocol !== "file:" || !window.ActiveXObject) ?
			function() {
				return new window.XMLHttpRequest();
			} :
			function() {
				try {
					return new window.ActiveXObject("Microsoft.XMLHTTP");
				} catch(e) {}
			},
		accepts: {
			xml: "application/xml, text/xml",
			html: "text/html",
			script: "text/javascript, application/javascript",
			json: "application/json, text/javascript",
			text: "text/plain",
			_default: "*/*"
		}
	},

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajax: function( origSettings ) {
		var s = jQuery.extend(true, {}, jQuery.ajaxSettings, origSettings);
		
		var jsonp, status, data,
			callbackContext = origSettings && origSettings.context || s,
			type = s.type.toUpperCase();

		// convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Handle JSONP Parameter Callbacks
		if ( s.dataType === "jsonp" ) {
			if ( type === "GET" ) {
				if ( !jsre.test( s.url ) ) {
					s.url += (rquery.test( s.url ) ? "&" : "?") + (s.jsonp || "callback") + "=?";
				}
			} else if ( !s.data || !jsre.test(s.data) ) {
				s.data = (s.data ? s.data + "&" : "") + (s.jsonp || "callback") + "=?";
			}
			s.dataType = "json";
		}

		// Build temporary JSONP function
		if ( s.dataType === "json" && (s.data && jsre.test(s.data) || jsre.test(s.url)) ) {
			jsonp = s.jsonpCallback || ("jsonp" + jsc++);

			// Replace the =? sequence both in the query string and the data
			if ( s.data ) {
				s.data = (s.data + "").replace(jsre, "=" + jsonp + "$1");
			}

			s.url = s.url.replace(jsre, "=" + jsonp + "$1");

			// We need to make sure
			// that a JSONP style response is executed properly
			s.dataType = "script";

			// Handle JSONP-style loading
			window[ jsonp ] = window[ jsonp ] || function( tmp ) {
				data = tmp;
				success();
				complete();
				// Garbage collect
				window[ jsonp ] = undefined;

				try {
					delete window[ jsonp ];
				} catch(e) {}

				if ( head ) {
					head.removeChild( script );
				}
			};
		}

		if ( s.dataType === "script" && s.cache === null ) {
			s.cache = false;
		}

		if ( s.cache === false && type === "GET" ) {
			var ts = now();

			// try replacing _= if it is there
			var ret = s.url.replace(rts, "$1_=" + ts + "$2");

			// if nothing was replaced, add timestamp to the end
			s.url = ret + ((ret === s.url) ? (rquery.test(s.url) ? "&" : "?") + "_=" + ts : "");
		}

		// If data is available, append data to url for get requests
		if ( s.data && type === "GET" ) {
			s.url += (rquery.test(s.url) ? "&" : "?") + s.data;
		}

		// Watch for a new set of requests
		if ( s.global && ! jQuery.active++ ) {
			jQuery.event.trigger( "ajaxStart" );
		}

		// Matches an absolute URL, and saves the domain
		var parts = rurl.exec( s.url ),
			remote = parts && (parts[1] && parts[1] !== location.protocol || parts[2] !== location.host);

		// If we're requesting a remote document
		// and trying to load JSON or Script with a GET
		if ( s.dataType === "script" && type === "GET" && remote ) {
			var head = document.getElementsByTagName("head")[0] || document.documentElement;
			var script = document.createElement("script");
			script.src = s.url;
			if ( s.scriptCharset ) {
				script.charset = s.scriptCharset;
			}

			// Handle Script loading
			if ( !jsonp ) {
				var done = false;

				// Attach handlers for all browsers
				script.onload = script.onreadystatechange = function() {
					if ( !done && (!this.readyState ||
							this.readyState === "loaded" || this.readyState === "complete") ) {
						done = true;
						success();
						complete();

						// Handle memory leak in IE
						script.onload = script.onreadystatechange = null;
						if ( head && script.parentNode ) {
							head.removeChild( script );
						}
					}
				};
			}

			// Use insertBefore instead of appendChild  to circumvent an IE6 bug.
			// This arises when a base node is used (#2709 and #4378).
			head.insertBefore( script, head.firstChild );

			// We handle everything using the script element injection
			return undefined;
		}

		var requestDone = false;

		// Create the request object
		var xhr = s.xhr();

		if ( !xhr ) {
			return;
		}

		// Open the socket
		// Passing null username, generates a login popup on Opera (#2865)
		if ( s.username ) {
			xhr.open(type, s.url, s.async, s.username, s.password);
		} else {
			xhr.open(type, s.url, s.async);
		}

		// Need an extra try/catch for cross domain requests in Firefox 3
		try {
			// Set the correct header, if data is being sent
			if ( s.data || origSettings && origSettings.contentType ) {
				xhr.setRequestHeader("Content-Type", s.contentType);
			}

			// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
			if ( s.ifModified ) {
				if ( jQuery.lastModified[s.url] ) {
					xhr.setRequestHeader("If-Modified-Since", jQuery.lastModified[s.url]);
				}

				if ( jQuery.etag[s.url] ) {
					xhr.setRequestHeader("If-None-Match", jQuery.etag[s.url]);
				}
			}

			// Set header so the called script knows that it's an XMLHttpRequest
			// Only send the header if it's not a remote XHR
			if ( !remote ) {
				xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
			}

			// Set the Accepts header for the server, depending on the dataType
			xhr.setRequestHeader("Accept", s.dataType && s.accepts[ s.dataType ] ?
				s.accepts[ s.dataType ] + ", */*" :
				s.accepts._default );
		} catch(e) {}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend && s.beforeSend.call(callbackContext, xhr, s) === false ) {
			// Handle the global AJAX counter
			if ( s.global && ! --jQuery.active ) {
				jQuery.event.trigger( "ajaxStop" );
			}

			// close opended socket
			xhr.abort();
			return false;
		}

		if ( s.global ) {
			trigger("ajaxSend", [xhr, s]);
		}

		// Wait for a response to come back
		var onreadystatechange = xhr.onreadystatechange = function( isTimeout ) {
			// The request was aborted
			if ( !xhr || xhr.readyState === 0 || isTimeout === "abort" ) {
				// Opera doesn't call onreadystatechange before this point
				// so we simulate the call
				if ( !requestDone ) {
					complete();
				}

				requestDone = true;
				if ( xhr ) {
					xhr.onreadystatechange = jQuery.noop;
				}

			// The transfer is complete and the data is available, or the request timed out
			} else if ( !requestDone && xhr && (xhr.readyState === 4 || isTimeout === "timeout") ) {
				requestDone = true;
				xhr.onreadystatechange = jQuery.noop;

				status = isTimeout === "timeout" ?
					"timeout" :
					!jQuery.httpSuccess( xhr ) ?
						"error" :
						s.ifModified && jQuery.httpNotModified( xhr, s.url ) ?
							"notmodified" :
							"success";

				var errMsg;

				if ( status === "success" ) {
					// Watch for, and catch, XML document parse errors
					try {
						// process the data (runs the xml through httpData regardless of callback)
						data = jQuery.httpData( xhr, s.dataType, s );
					} catch(err) {
						status = "parsererror";
						errMsg = err;
					}
				}

				// Make sure that the request was successful or notmodified
				if ( status === "success" || status === "notmodified" ) {
					// JSONP handles its own success callback
					if ( !jsonp ) {
						success();
					}
				} else {
					jQuery.handleError(s, xhr, status, errMsg);
				}

				// Fire the complete handlers
				complete();

				if ( isTimeout === "timeout" ) {
					xhr.abort();
				}

				// Stop memory leaks
				if ( s.async ) {
					xhr = null;
				}
			}
		};

		// Override the abort handler, if we can (IE doesn't allow it, but that's OK)
		// Opera doesn't fire onreadystatechange at all on abort
		try {
			var oldAbort = xhr.abort;
			xhr.abort = function() {
				if ( xhr ) {
					oldAbort.call( xhr );
				}

				onreadystatechange( "abort" );
			};
		} catch(e) { }

		// Timeout checker
		if ( s.async && s.timeout > 0 ) {
			setTimeout(function() {
				// Check to see if the request is still happening
				if ( xhr && !requestDone ) {
					onreadystatechange( "timeout" );
				}
			}, s.timeout);
		}

		// Send the data
		try {
			xhr.send( type === "POST" || type === "PUT" || type === "DELETE" ? s.data : null );
		} catch(e) {
			jQuery.handleError(s, xhr, null, e);
			// Fire the complete handlers
			complete();
		}

		// firefox 1.5 doesn't fire statechange for sync requests
		if ( !s.async ) {
			onreadystatechange();
		}

		function success() {
			// If a local callback was specified, fire it and pass it the data
			if ( s.success ) {
				s.success.call( callbackContext, data, status, xhr );
			}

			// Fire the global callback
			if ( s.global ) {
				trigger( "ajaxSuccess", [xhr, s] );
			}
		}

		function complete() {
			// Process result
			if ( s.complete ) {
				s.complete.call( callbackContext, xhr, status);
			}

			// The request was completed
			if ( s.global ) {
				trigger( "ajaxComplete", [xhr, s] );
			}

			// Handle the global AJAX counter
			if ( s.global && ! --jQuery.active ) {
				jQuery.event.trigger( "ajaxStop" );
			}
		}
		
		function trigger(type, args) {
			(s.context ? jQuery(s.context) : jQuery.event).trigger(type, args);
		}

		// return XMLHttpRequest to allow aborting the request etc.
		return xhr;
	},

	handleError: function( s, xhr, status, e ) {
		// If a local callback was specified, fire it
		if ( s.error ) {
			s.error.call( s.context || s, xhr, status, e );
		}

		// Fire the global callback
		if ( s.global ) {
			(s.context ? jQuery(s.context) : jQuery.event).trigger( "ajaxError", [xhr, s, e] );
		}
	},

	// Counter for holding the number of active queries
	active: 0,

	// Determines if an XMLHttpRequest was successful or not
	httpSuccess: function( xhr ) {
		try {
			// IE error sometimes returns 1223 when it should be 204 so treat it as success, see #1450
			return !xhr.status && location.protocol === "file:" ||
				// Opera returns 0 when status is 304
				( xhr.status >= 200 && xhr.status < 300 ) ||
				xhr.status === 304 || xhr.status === 1223 || xhr.status === 0;
		} catch(e) {}

		return false;
	},

	// Determines if an XMLHttpRequest returns NotModified
	httpNotModified: function( xhr, url ) {
		var lastModified = xhr.getResponseHeader("Last-Modified"),
			etag = xhr.getResponseHeader("Etag");

		if ( lastModified ) {
			jQuery.lastModified[url] = lastModified;
		}

		if ( etag ) {
			jQuery.etag[url] = etag;
		}

		// Opera returns 0 when status is 304
		return xhr.status === 304 || xhr.status === 0;
	},

	httpData: function( xhr, type, s ) {
		var ct = xhr.getResponseHeader("content-type") || "",
			xml = type === "xml" || !type && ct.indexOf("xml") >= 0,
			data = xml ? xhr.responseXML : xhr.responseText;

		if ( xml && data.documentElement.nodeName === "parsererror" ) {
			jQuery.error( "parsererror" );
		}

		// Allow a pre-filtering function to sanitize the response
		// s is checked to keep backwards compatibility
		if ( s && s.dataFilter ) {
			data = s.dataFilter( data, type );
		}

		// The filter can actually parse the response
		if ( typeof data === "string" ) {
			// Get the JavaScript object, if JSON is used.
			if ( type === "json" || !type && ct.indexOf("json") >= 0 ) {
				data = jQuery.parseJSON( data );

			// If the type is "script", eval it in global context
			} else if ( type === "script" || !type && ct.indexOf("javascript") >= 0 ) {
				jQuery.globalEval( data );
			}
		}

		return data;
	},

	// Serialize an array of form elements or a set of
	// key/values into a query string
	param: function( a, traditional ) {
		var s = [];
		
		// Set traditional to true for jQuery <= 1.3.2 behavior.
		if ( traditional === undefined ) {
			traditional = jQuery.ajaxSettings.traditional;
		}
		
		// If an array was passed in, assume that it is an array of form elements.
		if ( jQuery.isArray(a) || a.jquery ) {
			// Serialize the form elements
			jQuery.each( a, function() {
				add( this.name, this.value );
			});
			
		} else {
			// If traditional, encode the "old" way (the way 1.3.2 or older
			// did it), otherwise encode params recursively.
			for ( var prefix in a ) {
				buildParams( prefix, a[prefix] );
			}
		}

		// Return the resulting serialization
		return s.join("&").replace(r20, "+");

		function buildParams( prefix, obj ) {
			if ( jQuery.isArray(obj) ) {
				// Serialize array item.
				jQuery.each( obj, function( i, v ) {
					if ( traditional || /\[\]$/.test( prefix ) ) {
						// Treat each array item as a scalar.
						add( prefix, v );
					} else {
						// If array item is non-scalar (array or object), encode its
						// numeric index to resolve deserialization ambiguity issues.
						// Note that rack (as of 1.0.0) can't currently deserialize
						// nested arrays properly, and attempting to do so may cause
						// a server error. Possible fixes are to modify rack's
						// deserialization algorithm or to provide an option or flag
						// to force array serialization to be shallow.
						buildParams( prefix + "[" + ( typeof v === "object" || jQuery.isArray(v) ? i : "" ) + "]", v );
					}
				});
					
			} else if ( !traditional && obj != null && typeof obj === "object" ) {
				// Serialize object item.
				jQuery.each( obj, function( k, v ) {
					buildParams( prefix + "[" + k + "]", v );
				});
					
			} else {
				// Serialize scalar item.
				add( prefix, obj );
			}
		}

		function add( key, value ) {
			// If value is a function, invoke it and return its value
			value = jQuery.isFunction(value) ? value() : value;
			s[ s.length ] = encodeURIComponent(key) + "=" + encodeURIComponent(value);
		}
	}
});
var elemdisplay = {},
	rfxtypes = /toggle|show|hide/,
	rfxnum = /^([+-]=)?([\d+-.]+)(.*)$/,
	timerId,
	fxAttrs = [
		// height animations
		[ "height", "marginTop", "marginBottom", "paddingTop", "paddingBottom" ],
		// width animations
		[ "width", "marginLeft", "marginRight", "paddingLeft", "paddingRight" ],
		// opacity animations
		[ "opacity" ]
	];

jQuery.fn.extend({
	show: function( speed, callback ) {
		if ( speed || speed === 0) {
			return this.animate( genFx("show", 3), speed, callback);

		} else {
			for ( var i = 0, l = this.length; i < l; i++ ) {
				var old = jQuery.data(this[i], "olddisplay");

				this[i].style.display = old || "";

				if ( jQuery.css(this[i], "display") === "none" ) {
					var nodeName = this[i].nodeName, display;

					if ( elemdisplay[ nodeName ] ) {
						display = elemdisplay[ nodeName ];

					} else {
						var elem = jQuery("<" + nodeName + " />").appendTo("body");

						display = elem.css("display");

						if ( display === "none" ) {
							display = "block";
						}

						elem.remove();

						elemdisplay[ nodeName ] = display;
					}

					jQuery.data(this[i], "olddisplay", display);
				}
			}

			// Set the display of the elements in a second loop
			// to avoid the constant reflow
			for ( var j = 0, k = this.length; j < k; j++ ) {
				this[j].style.display = jQuery.data(this[j], "olddisplay") || "";
			}

			return this;
		}
	},

	hide: function( speed, callback ) {
		if ( speed || speed === 0 ) {
			return this.animate( genFx("hide", 3), speed, callback);

		} else {
			for ( var i = 0, l = this.length; i < l; i++ ) {
				var old = jQuery.data(this[i], "olddisplay");
				if ( !old && old !== "none" ) {
					jQuery.data(this[i], "olddisplay", jQuery.css(this[i], "display"));
				}
			}

			// Set the display of the elements in a second loop
			// to avoid the constant reflow
			for ( var j = 0, k = this.length; j < k; j++ ) {
				this[j].style.display = "none";
			}

			return this;
		}
	},

	// Save the old toggle function
	_toggle: jQuery.fn.toggle,

	toggle: function( fn, fn2 ) {
		var bool = typeof fn === "boolean";

		if ( jQuery.isFunction(fn) && jQuery.isFunction(fn2) ) {
			this._toggle.apply( this, arguments );

		} else if ( fn == null || bool ) {
			this.each(function() {
				var state = bool ? fn : jQuery(this).is(":hidden");
				jQuery(this)[ state ? "show" : "hide" ]();
			});

		} else {
			this.animate(genFx("toggle", 3), fn, fn2);
		}

		return this;
	},

	fadeTo: function( speed, to, callback ) {
		return this.filter(":hidden").css("opacity", 0).show().end()
					.animate({opacity: to}, speed, callback);
	},

	animate: function( prop, speed, easing, callback ) {
		var optall = jQuery.speed(speed, easing, callback);

		if ( jQuery.isEmptyObject( prop ) ) {
			return this.each( optall.complete );
		}

		return this[ optall.queue === false ? "each" : "queue" ](function() {
			var opt = jQuery.extend({}, optall), p,
				hidden = this.nodeType === 1 && jQuery(this).is(":hidden"),
				self = this;

			for ( p in prop ) {
				var name = p.replace(rdashAlpha, fcamelCase);

				if ( p !== name ) {
					prop[ name ] = prop[ p ];
					delete prop[ p ];
					p = name;
				}

				if ( prop[p] === "hide" && hidden || prop[p] === "show" && !hidden ) {
					return opt.complete.call(this);
				}

				if ( ( p === "height" || p === "width" ) && this.style ) {
					// Store display property
					opt.display = jQuery.css(this, "display");

					// Make sure that nothing sneaks out
					opt.overflow = this.style.overflow;
				}

				if ( jQuery.isArray( prop[p] ) ) {
					// Create (if needed) and add to specialEasing
					(opt.specialEasing = opt.specialEasing || {})[p] = prop[p][1];
					prop[p] = prop[p][0];
				}
			}

			if ( opt.overflow != null ) {
				this.style.overflow = "hidden";
			}

			opt.curAnim = jQuery.extend({}, prop);

			jQuery.each( prop, function( name, val ) {
				var e = new jQuery.fx( self, opt, name );

				if ( rfxtypes.test(val) ) {
					e[ val === "toggle" ? hidden ? "show" : "hide" : val ]( prop );

				} else {
					var parts = rfxnum.exec(val),
						start = e.cur(true) || 0;

					if ( parts ) {
						var end = parseFloat( parts[2] ),
							unit = parts[3] || "px";

						// We need to compute starting value
						if ( unit !== "px" ) {
							self.style[ name ] = (end || 1) + unit;
							start = ((end || 1) / e.cur(true)) * start;
							self.style[ name ] = start + unit;
						}

						// If a +=/-= token was provided, we're doing a relative animation
						if ( parts[1] ) {
							end = ((parts[1] === "-=" ? -1 : 1) * end) + start;
						}

						e.custom( start, end, unit );

					} else {
						e.custom( start, val, "" );
					}
				}
			});

			// For JS strict compliance
			return true;
		});
	},

	stop: function( clearQueue, gotoEnd ) {
		var timers = jQuery.timers;

		if ( clearQueue ) {
			this.queue([]);
		}

		this.each(function() {
			// go in reverse order so anything added to the queue during the loop is ignored
			for ( var i = timers.length - 1; i >= 0; i-- ) {
				if ( timers[i].elem === this ) {
					if (gotoEnd) {
						// force the next step to be the last
						timers[i](true);
					}

					timers.splice(i, 1);
				}
			}
		});

		// start the next in the queue if the last step wasn't forced
		if ( !gotoEnd ) {
			this.dequeue();
		}

		return this;
	}

});

// Generate shortcuts for custom animations
jQuery.each({
	slideDown: genFx("show", 1),
	slideUp: genFx("hide", 1),
	slideToggle: genFx("toggle", 1),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, callback ) {
		return this.animate( props, speed, callback );
	};
});

jQuery.extend({
	speed: function( speed, easing, fn ) {
		var opt = speed && typeof speed === "object" ? speed : {
			complete: fn || !fn && easing ||
				jQuery.isFunction( speed ) && speed,
			duration: speed,
			easing: fn && easing || easing && !jQuery.isFunction(easing) && easing
		};

		opt.duration = jQuery.fx.off ? 0 : typeof opt.duration === "number" ? opt.duration :
			jQuery.fx.speeds[opt.duration] || jQuery.fx.speeds._default;

		// Queueing
		opt.old = opt.complete;
		opt.complete = function() {
			if ( opt.queue !== false ) {
				jQuery(this).dequeue();
			}
			if ( jQuery.isFunction( opt.old ) ) {
				opt.old.call( this );
			}
		};

		return opt;
	},

	easing: {
		linear: function( p, n, firstNum, diff ) {
			return firstNum + diff * p;
		},
		swing: function( p, n, firstNum, diff ) {
			return ((-Math.cos(p*Math.PI)/2) + 0.5) * diff + firstNum;
		}
	},

	timers: [],

	fx: function( elem, options, prop ) {
		this.options = options;
		this.elem = elem;
		this.prop = prop;

		if ( !options.orig ) {
			options.orig = {};
		}
	}

});

jQuery.fx.prototype = {
	// Simple function for setting a style value
	update: function() {
		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		(jQuery.fx.step[this.prop] || jQuery.fx.step._default)( this );

		// Set display property to block for height/width animations
		if ( ( this.prop === "height" || this.prop === "width" ) && this.elem.style ) {
			this.elem.style.display = "block";
		}
	},

	// Get the current size
	cur: function( force ) {
		if ( this.elem[this.prop] != null && (!this.elem.style || this.elem.style[this.prop] == null) ) {
			return this.elem[ this.prop ];
		}

		var r = parseFloat(jQuery.css(this.elem, this.prop, force));
		return r && r > -10000 ? r : parseFloat(jQuery.curCSS(this.elem, this.prop)) || 0;
	},

	// Start an animation from one number to another
	custom: function( from, to, unit ) {
		this.startTime = now();
		this.start = from;
		this.end = to;
		this.unit = unit || this.unit || "px";
		this.now = this.start;
		this.pos = this.state = 0;

		var self = this;
		function t( gotoEnd ) {
			return self.step(gotoEnd);
		}

		t.elem = this.elem;

		if ( t() && jQuery.timers.push(t) && !timerId ) {
			timerId = setInterval(jQuery.fx.tick, 13);
		}
	},

	// Simple 'show' function
	show: function() {
		// Remember where we started, so that we can go back to it later
		this.options.orig[this.prop] = jQuery.style( this.elem, this.prop );
		this.options.show = true;

		// Begin the animation
		// Make sure that we start at a small width/height to avoid any
		// flash of content
		this.custom(this.prop === "width" || this.prop === "height" ? 1 : 0, this.cur());

		// Start by showing the element
		jQuery( this.elem ).show();
	},

	// Simple 'hide' function
	hide: function() {
		// Remember where we started, so that we can go back to it later
		this.options.orig[this.prop] = jQuery.style( this.elem, this.prop );
		this.options.hide = true;

		// Begin the animation
		this.custom(this.cur(), 0);
	},

	// Each step of an animation
	step: function( gotoEnd ) {
		var t = now(), done = true;

		if ( gotoEnd || t >= this.options.duration + this.startTime ) {
			this.now = this.end;
			this.pos = this.state = 1;
			this.update();

			this.options.curAnim[ this.prop ] = true;

			for ( var i in this.options.curAnim ) {
				if ( this.options.curAnim[i] !== true ) {
					done = false;
				}
			}

			if ( done ) {
				if ( this.options.display != null ) {
					// Reset the overflow
					this.elem.style.overflow = this.options.overflow;

					// Reset the display
					var old = jQuery.data(this.elem, "olddisplay");
					this.elem.style.display = old ? old : this.options.display;

					if ( jQuery.css(this.elem, "display") === "none" ) {
						this.elem.style.display = "block";
					}
				}

				// Hide the element if the "hide" operation was done
				if ( this.options.hide ) {
					jQuery(this.elem).hide();
				}

				// Reset the properties, if the item has been hidden or shown
				if ( this.options.hide || this.options.show ) {
					for ( var p in this.options.curAnim ) {
						jQuery.style(this.elem, p, this.options.orig[p]);
					}
				}

				// Execute the complete function
				this.options.complete.call( this.elem );
			}

			return false;

		} else {
			var n = t - this.startTime;
			this.state = n / this.options.duration;

			// Perform the easing function, defaults to swing
			var specialEasing = this.options.specialEasing && this.options.specialEasing[this.prop];
			var defaultEasing = this.options.easing || (jQuery.easing.swing ? "swing" : "linear");
			this.pos = jQuery.easing[specialEasing || defaultEasing](this.state, n, 0, 1, this.options.duration);
			this.now = this.start + ((this.end - this.start) * this.pos);

			// Perform the next step of the animation
			this.update();
		}

		return true;
	}
};

jQuery.extend( jQuery.fx, {
	tick: function() {
		var timers = jQuery.timers;

		for ( var i = 0; i < timers.length; i++ ) {
			if ( !timers[i]() ) {
				timers.splice(i--, 1);
			}
		}

		if ( !timers.length ) {
			jQuery.fx.stop();
		}
	},
		
	stop: function() {
		clearInterval( timerId );
		timerId = null;
	},
	
	speeds: {
		slow: 600,
 		fast: 200,
 		// Default speed
 		_default: 400
	},

	step: {
		opacity: function( fx ) {
			jQuery.style(fx.elem, "opacity", fx.now);
		},

		_default: function( fx ) {
			if ( fx.elem.style && fx.elem.style[ fx.prop ] != null ) {
				fx.elem.style[ fx.prop ] = (fx.prop === "width" || fx.prop === "height" ? Math.max(0, fx.now) : fx.now) + fx.unit;
			} else {
				fx.elem[ fx.prop ] = fx.now;
			}
		}
	}
});

if ( jQuery.expr && jQuery.expr.filters ) {
	jQuery.expr.filters.animated = function( elem ) {
		return jQuery.grep(jQuery.timers, function( fn ) {
			return elem === fn.elem;
		}).length;
	};
}

function genFx( type, num ) {
	var obj = {};

	jQuery.each( fxAttrs.concat.apply([], fxAttrs.slice(0,num)), function() {
		obj[ this ] = type;
	});

	return obj;
}
if ( "getBoundingClientRect" in document.documentElement ) {
	jQuery.fn.offset = function( options ) {
		var elem = this[0];

		if ( options ) { 
			return this.each(function( i ) {
				jQuery.offset.setOffset( this, options, i );
			});
		}

		if ( !elem || !elem.ownerDocument ) {
			return null;
		}

		if ( elem === elem.ownerDocument.body ) {
			return jQuery.offset.bodyOffset( elem );
		}

		var box = elem.getBoundingClientRect(), doc = elem.ownerDocument, body = doc.body, docElem = doc.documentElement,
			clientTop = docElem.clientTop || body.clientTop || 0, clientLeft = docElem.clientLeft || body.clientLeft || 0,
			top  = box.top  + (self.pageYOffset || jQuery.support.boxModel && docElem.scrollTop  || body.scrollTop ) - clientTop,
			left = box.left + (self.pageXOffset || jQuery.support.boxModel && docElem.scrollLeft || body.scrollLeft) - clientLeft;

		return { top: top, left: left };
	};

} else {
	jQuery.fn.offset = function( options ) {
		var elem = this[0];

		if ( options ) { 
			return this.each(function( i ) {
				jQuery.offset.setOffset( this, options, i );
			});
		}

		if ( !elem || !elem.ownerDocument ) {
			return null;
		}

		if ( elem === elem.ownerDocument.body ) {
			return jQuery.offset.bodyOffset( elem );
		}

		jQuery.offset.initialize();

		var offsetParent = elem.offsetParent, prevOffsetParent = elem,
			doc = elem.ownerDocument, computedStyle, docElem = doc.documentElement,
			body = doc.body, defaultView = doc.defaultView,
			prevComputedStyle = defaultView ? defaultView.getComputedStyle( elem, null ) : elem.currentStyle,
			top = elem.offsetTop, left = elem.offsetLeft;

		while ( (elem = elem.parentNode) && elem !== body && elem !== docElem ) {
			if ( jQuery.offset.supportsFixedPosition && prevComputedStyle.position === "fixed" ) {
				break;
			}

			computedStyle = defaultView ? defaultView.getComputedStyle(elem, null) : elem.currentStyle;
			top  -= elem.scrollTop;
			left -= elem.scrollLeft;

			if ( elem === offsetParent ) {
				top  += elem.offsetTop;
				left += elem.offsetLeft;

				if ( jQuery.offset.doesNotAddBorder && !(jQuery.offset.doesAddBorderForTableAndCells && /^t(able|d|h)$/i.test(elem.nodeName)) ) {
					top  += parseFloat( computedStyle.borderTopWidth  ) || 0;
					left += parseFloat( computedStyle.borderLeftWidth ) || 0;
				}

				prevOffsetParent = offsetParent, offsetParent = elem.offsetParent;
			}

			if ( jQuery.offset.subtractsBorderForOverflowNotVisible && computedStyle.overflow !== "visible" ) {
				top  += parseFloat( computedStyle.borderTopWidth  ) || 0;
				left += parseFloat( computedStyle.borderLeftWidth ) || 0;
			}

			prevComputedStyle = computedStyle;
		}

		if ( prevComputedStyle.position === "relative" || prevComputedStyle.position === "static" ) {
			top  += body.offsetTop;
			left += body.offsetLeft;
		}

		if ( jQuery.offset.supportsFixedPosition && prevComputedStyle.position === "fixed" ) {
			top  += Math.max( docElem.scrollTop, body.scrollTop );
			left += Math.max( docElem.scrollLeft, body.scrollLeft );
		}

		return { top: top, left: left };
	};
}

jQuery.offset = {
	initialize: function() {
		var body = document.body, container = document.createElement("div"), innerDiv, checkDiv, table, td, bodyMarginTop = parseFloat( jQuery.curCSS(body, "marginTop", true) ) || 0,
			html = "<div style='position:absolute;top:0;left:0;margin:0;border:5px solid #000;padding:0;width:1px;height:1px;'><div></div></div><table style='position:absolute;top:0;left:0;margin:0;border:5px solid #000;padding:0;width:1px;height:1px;' cellpadding='0' cellspacing='0'><tr><td></td></tr></table>";

		jQuery.extend( container.style, { position: "absolute", top: 0, left: 0, margin: 0, border: 0, width: "1px", height: "1px", visibility: "hidden" } );

		container.innerHTML = html;
		body.insertBefore( container, body.firstChild );
		innerDiv = container.firstChild;
		checkDiv = innerDiv.firstChild;
		td = innerDiv.nextSibling.firstChild.firstChild;

		this.doesNotAddBorder = (checkDiv.offsetTop !== 5);
		this.doesAddBorderForTableAndCells = (td.offsetTop === 5);

		checkDiv.style.position = "fixed", checkDiv.style.top = "20px";
		// safari subtracts parent border width here which is 5px
		this.supportsFixedPosition = (checkDiv.offsetTop === 20 || checkDiv.offsetTop === 15);
		checkDiv.style.position = checkDiv.style.top = "";

		innerDiv.style.overflow = "hidden", innerDiv.style.position = "relative";
		this.subtractsBorderForOverflowNotVisible = (checkDiv.offsetTop === -5);

		this.doesNotIncludeMarginInBodyOffset = (body.offsetTop !== bodyMarginTop);

		body.removeChild( container );
		body = container = innerDiv = checkDiv = table = td = null;
		jQuery.offset.initialize = jQuery.noop;
	},

	bodyOffset: function( body ) {
		var top = body.offsetTop, left = body.offsetLeft;

		jQuery.offset.initialize();

		if ( jQuery.offset.doesNotIncludeMarginInBodyOffset ) {
			top  += parseFloat( jQuery.curCSS(body, "marginTop",  true) ) || 0;
			left += parseFloat( jQuery.curCSS(body, "marginLeft", true) ) || 0;
		}

		return { top: top, left: left };
	},
	
	setOffset: function( elem, options, i ) {
		// set position first, in-case top/left are set even on static elem
		if ( /static/.test( jQuery.curCSS( elem, "position" ) ) ) {
			elem.style.position = "relative";
		}
		var curElem   = jQuery( elem ),
			curOffset = curElem.offset(),
			curTop    = parseInt( jQuery.curCSS( elem, "top",  true ), 10 ) || 0,
			curLeft   = parseInt( jQuery.curCSS( elem, "left", true ), 10 ) || 0;

		if ( jQuery.isFunction( options ) ) {
			options = options.call( elem, i, curOffset );
		}

		var props = {
			top:  (options.top  - curOffset.top)  + curTop,
			left: (options.left - curOffset.left) + curLeft
		};
		
		if ( "using" in options ) {
			options.using.call( elem, props );
		} else {
			curElem.css( props );
		}
	}
};


jQuery.fn.extend({
	position: function() {
		if ( !this[0] ) {
			return null;
		}

		var elem = this[0],

		// Get *real* offsetParent
		offsetParent = this.offsetParent(),

		// Get correct offsets
		offset       = this.offset(),
		parentOffset = /^body|html$/i.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset();

		// Subtract element margins
		// note: when an element has margin: auto the offsetLeft and marginLeft
		// are the same in Safari causing offset.left to incorrectly be 0
		offset.top  -= parseFloat( jQuery.curCSS(elem, "marginTop",  true) ) || 0;
		offset.left -= parseFloat( jQuery.curCSS(elem, "marginLeft", true) ) || 0;

		// Add offsetParent borders
		parentOffset.top  += parseFloat( jQuery.curCSS(offsetParent[0], "borderTopWidth",  true) ) || 0;
		parentOffset.left += parseFloat( jQuery.curCSS(offsetParent[0], "borderLeftWidth", true) ) || 0;

		// Subtract the two offsets
		return {
			top:  offset.top  - parentOffset.top,
			left: offset.left - parentOffset.left
		};
	},

	offsetParent: function() {
		return this.map(function() {
			var offsetParent = this.offsetParent || document.body;
			while ( offsetParent && (!/^body|html$/i.test(offsetParent.nodeName) && jQuery.css(offsetParent, "position") === "static") ) {
				offsetParent = offsetParent.offsetParent;
			}
			return offsetParent;
		});
	}
});


// Create scrollLeft and scrollTop methods
jQuery.each( ["Left", "Top"], function( i, name ) {
	var method = "scroll" + name;

	jQuery.fn[ method ] = function(val) {
		var elem = this[0], win;
		
		if ( !elem ) {
			return null;
		}

		if ( val !== undefined ) {
			// Set the scroll offset
			return this.each(function() {
				win = getWindow( this );

				if ( win ) {
					win.scrollTo(
						!i ? val : jQuery(win).scrollLeft(),
						 i ? val : jQuery(win).scrollTop()
					);

				} else {
					this[ method ] = val;
				}
			});
		} else {
			win = getWindow( elem );

			// Return the scroll offset
			return win ? ("pageXOffset" in win) ? win[ i ? "pageYOffset" : "pageXOffset" ] :
				jQuery.support.boxModel && win.document.documentElement[ method ] ||
					win.document.body[ method ] :
				elem[ method ];
		}
	};
});

function getWindow( elem ) {
	return ("scrollTo" in elem && elem.document) ?
		elem :
		elem.nodeType === 9 ?
			elem.defaultView || elem.parentWindow :
			false;
}
// Create innerHeight, innerWidth, outerHeight and outerWidth methods
jQuery.each([ "Height", "Width" ], function( i, name ) {

	var type = name.toLowerCase();

	// innerHeight and innerWidth
	jQuery.fn["inner" + name] = function() {
		return this[0] ?
			jQuery.css( this[0], type, false, "padding" ) :
			null;
	};

	// outerHeight and outerWidth
	jQuery.fn["outer" + name] = function( margin ) {
		return this[0] ?
			jQuery.css( this[0], type, false, margin ? "margin" : "border" ) :
			null;
	};

	jQuery.fn[ type ] = function( size ) {
		// Get window width or height
		var elem = this[0];
		if ( !elem ) {
			return size == null ? null : this;
		}
		
		if ( jQuery.isFunction( size ) ) {
			return this.each(function( i ) {
				var self = jQuery( this );
				self[ type ]( size.call( this, i, self[ type ]() ) );
			});
		}

		return ("scrollTo" in elem && elem.document) ? // does it walk and quack like a window?
			// Everyone else use document.documentElement or document.body depending on Quirks vs Standards mode
			elem.document.compatMode === "CSS1Compat" && elem.document.documentElement[ "client" + name ] ||
			elem.document.body[ "client" + name ] :

			// Get document width or height
			(elem.nodeType === 9) ? // is it a document
				// Either scroll[Width/Height] or offset[Width/Height], whichever is greater
				Math.max(
					elem.documentElement["client" + name],
					elem.body["scroll" + name], elem.documentElement["scroll" + name],
					elem.body["offset" + name], elem.documentElement["offset" + name]
				) :

				// Get or set width or height on the element
				size === undefined ?
					// Get width or height on the element
					jQuery.css( elem, type ) :

					// Set the width or height on the element (default to pixels if value is unitless)
					this.css( type, typeof size === "string" ? size : size + "px" );
	};

});
// Expose jQuery to the global object
window.jQuery = window.$ = jQuery;

})(window);
define("lib/jquery-1.4.2", function(){});
// Underscore.js
// (c) 2010 Jeremy Ashkenas, DocumentCloud Inc.
// Underscore is freely distributable under the terms of the MIT license.
// Portions of Underscore are inspired by or borrowed from Prototype.js,
// Oliver Steele's Functional, and John Resig's Micro-Templating.
// For all details and documentation:
// http://documentcloud.github.com/underscore

(function() {
  // ------------------------- Baseline setup ---------------------------------

  // Establish the root object, "window" in the browser, or "global" on the server.
  var root = this;

  // Save the previous value of the "_" variable.
  var previousUnderscore = root._;

  // Establish the object that gets thrown to break out of a loop iteration.
  var breaker = typeof StopIteration !== 'undefined' ? StopIteration : '__break__';

  // Quick regexp-escaping function, because JS doesn't have RegExp.escape().
  var escapeRegExp = function(s) { return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1'); };

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var slice                 = ArrayProto.slice,
      unshift               = ArrayProto.unshift,
      toString              = ObjProto.toString,
      hasOwnProperty        = ObjProto.hasOwnProperty,
      propertyIsEnumerable  = ObjProto.propertyIsEnumerable;

  // All ECMA5 native implementations we hope to use are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) { return new wrapper(obj); };

  // Export the Underscore object for CommonJS.
  if (typeof exports !== 'undefined') exports._ = _;

  // Export underscore to global scope.
  root._ = _;

  // Current version.
  _.VERSION = '1.0.2';

  // ------------------------ Collection Functions: ---------------------------

  // The cornerstone, an each implementation.
  // Handles objects implementing forEach, arrays, and raw objects.
  // Delegates to JavaScript 1.6's native forEach if available.
  var each = _.forEach = function(obj, iterator, context) {
    try {
      if (nativeForEach && obj.forEach === nativeForEach) {
        obj.forEach(iterator, context);
      } else if (_.isNumber(obj.length)) {
        for (var i = 0, l = obj.length; i < l; i++) iterator.call(context, obj[i], i, obj);
      } else {
        for (var key in obj) {
          if (hasOwnProperty.call(obj, key)) iterator.call(context, obj[key], key, obj);
        }
      }
    } catch(e) {
      if (e != breaker) throw e;
    }
    return obj;
  };

  // Return the results of applying the iterator to each element.
  // Delegates to JavaScript 1.6's native map if available.
  _.map = function(obj, iterator, context) {
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    var results = [];
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  // Reduce builds up a single result from a list of values, aka inject, or foldl.
  // Delegates to JavaScript 1.8's native reduce if available.
  _.reduce = function(obj, memo, iterator, context) {
    if (nativeReduce && obj.reduce === nativeReduce) return obj.reduce(_.bind(iterator, context), memo);
    each(obj, function(value, index, list) {
      memo = iterator.call(context, memo, value, index, list);
    });
    return memo;
  };

  // The right-associative version of reduce, also known as foldr. Uses
  // Delegates to JavaScript 1.8's native reduceRight if available.
  _.reduceRight = function(obj, memo, iterator, context) {
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) return obj.reduceRight(_.bind(iterator, context), memo);
    var reversed = _.clone(_.toArray(obj)).reverse();
    return _.reduce(reversed, memo, iterator, context);
  };

  // Return the first value which passes a truth test.
  _.detect = function(obj, iterator, context) {
    var result;
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        _.breakLoop();
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to JavaScript 1.6's native filter if available.
  _.filter = function(obj, iterator, context) {
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    var results = [];
    each(obj, function(value, index, list) {
      iterator.call(context, value, index, list) && results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    var results = [];
    each(obj, function(value, index, list) {
      !iterator.call(context, value, index, list) && results.push(value);
    });
    return results;
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to JavaScript 1.6's native every if available.
  _.every = function(obj, iterator, context) {
    iterator = iterator || _.identity;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    var result = true;
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) _.breakLoop();
    });
    return result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to JavaScript 1.6's native some if available.
  _.some = function(obj, iterator, context) {
    iterator = iterator || _.identity;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    var result = false;
    each(obj, function(value, index, list) {
      if (result = iterator.call(context, value, index, list)) _.breakLoop();
    });
    return result;
  };

  // Determine if a given value is included in the array or object using '==='.
  _.include = function(obj, target) {
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    var found = false;
    each(obj, function(value) {
      if (found = value === target) _.breakLoop();
    });
    return found;
  };

  // Invoke a method with arguments on every item in a collection.
  _.invoke = function(obj, method) {
    var args = _.rest(arguments, 2);
    return _.map(obj, function(value) {
      return (method ? value[method] : value).apply(value, args);
    });
  };

  // Convenience version of a common use case of map: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Return the maximum item or (item-based computation).
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.max.apply(Math, obj);
    var result = {computed : -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.min.apply(Math, obj);
    var result = {computed : Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
  };

  // Use a comparator function to figure out at what index an object should
  // be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator) {
    iterator = iterator || _.identity;
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >> 1;
      iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Convert anything iterable into a real, live array.
  _.toArray = function(iterable) {
    if (!iterable)                return [];
    if (iterable.toArray)         return iterable.toArray();
    if (_.isArray(iterable))      return iterable;
    if (_.isArguments(iterable))  return slice.call(iterable);
    return _.values(iterable);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    return _.toArray(obj).length;
  };

  // -------------------------- Array Functions: ------------------------------

  // Get the first element of an array. Passing "n" will return the first N
  // values in the array. Aliased as "head". The "guard" check allows it to work
  // with _.map.
  _.first = function(array, n, guard) {
    return n && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the first entry of the array. Aliased as "tail".
  // Especially useful on the arguments object. Passing an "index" will return
  // the rest of the values in the array from that index onward. The "guard"
   //check allows it to work with _.map.
  _.rest = function(array, index, guard) {
    return slice.call(array, _.isUndefined(index) || guard ? 1 : index);
  };

  // Get the last element of an array.
  _.last = function(array) {
    return array[array.length - 1];
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, function(value){ return !!value; });
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array) {
    return _.reduce(array, [], function(memo, value) {
      if (_.isArray(value)) return memo.concat(_.flatten(value));
      memo.push(value);
      return memo;
    });
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    var values = _.rest(arguments);
    return _.filter(array, function(value){ return !_.include(values, value); });
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  _.uniq = function(array, isSorted) {
    return _.reduce(array, [], function(memo, el, i) {
      if (0 == i || (isSorted === true ? _.last(memo) != el : !_.include(memo, el))) memo.push(el);
      return memo;
    });
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersect = function(array) {
    var rest = _.rest(arguments);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = _.toArray(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) results[i] = _.pluck(args, String(i));
    return results;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, MSIE),
  // we need this function. Return the position of the first occurence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to JavaScript 1.8's native indexOf if available.
  _.indexOf = function(array, item) {
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item);
    for (var i = 0, l = array.length; i < l; i++) if (array[i] === item) return i;
    return -1;
  };


  // Delegates to JavaScript 1.6's native lastIndexOf if available.
  _.lastIndexOf = function(array, item) {
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) return array.lastIndexOf(item);
    var i = array.length;
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python range() function. See:
  // http://docs.python.org/library/functions.html#range
  _.range = function(start, stop, step) {
    var a     = _.toArray(arguments);
    var solo  = a.length <= 1;
    var start = solo ? 0 : a[0], stop = solo ? a[0] : a[1], step = a[2] || 1;
    var len   = Math.ceil((stop - start) / step);
    if (len <= 0) return [];
    var range = new Array(len);
    for (var i = start, idx = 0; true; i += step) {
      if ((step > 0 ? i - stop : stop - i) >= 0) return range;
      range[idx++] = i;
    }
  };

  // ----------------------- Function Functions: ------------------------------

  // Create a function bound to a given object (assigning 'this', and arguments,
  // optionally). Binding with arguments is also known as 'curry'.
  _.bind = function(func, obj) {
    var args = _.rest(arguments, 2);
    return function() {
      return func.apply(obj || {}, args.concat(_.toArray(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = _.rest(arguments);
    if (funcs.length == 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = _.rest(arguments, 2);
    return setTimeout(function(){ return func.apply(func, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(_.rest(arguments)));
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func].concat(_.toArray(arguments));
      return wrapper.apply(wrapper, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = _.toArray(arguments);
    return function() {
      var args = _.toArray(arguments);
      for (var i=funcs.length-1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // ------------------------- Object Functions: ------------------------------

  // Retrieve the names of an object's properties.
  // Delegates to ECMA5's native Object.keys
  _.keys = nativeKeys || function(obj) {
    if (_.isArray(obj)) return _.range(0, obj.length);
    var keys = [];
    for (var key in obj) if (hasOwnProperty.call(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    return _.map(obj, _.identity);
  };

  // Return a sorted list of the function names available on the object.
  _.functions = function(obj) {
    return _.filter(_.keys(obj), function(key){ return _.isFunction(obj[key]); }).sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(_.rest(arguments), function(source) {
      for (var prop in source) obj[prop] = source[prop];
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (_.isArray(obj)) return obj.slice(0);
    return _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    // Check object identity.
    if (a === b) return true;
    // Different types?
    var atype = typeof(a), btype = typeof(b);
    if (atype != btype) return false;
    // Basic equality test (watch out for coercions).
    if (a == b) return true;
    // One is falsy and the other truthy.
    if ((!a && b) || (a && !b)) return false;
    // One of them implements an isEqual()?
    if (a.isEqual) return a.isEqual(b);
    // Check dates' integer values.
    if (_.isDate(a) && _.isDate(b)) return a.getTime() === b.getTime();
    // Both are NaN?
    if (_.isNaN(a) && _.isNaN(b)) return true;
    // Compare regular expressions.
    if (_.isRegExp(a) && _.isRegExp(b))
      return a.source     === b.source &&
             a.global     === b.global &&
             a.ignoreCase === b.ignoreCase &&
             a.multiline  === b.multiline;
    // If a is not an object by this point, we can't handle it.
    if (atype !== 'object') return false;
    // Check for different array lengths before comparing contents.
    if (a.length && (a.length !== b.length)) return false;
    // Nothing else worked, deep compare the contents.
    var aKeys = _.keys(a), bKeys = _.keys(b);
    // Different object sizes?
    if (aKeys.length != bKeys.length) return false;
    // Recursive comparison of contents.
    for (var key in a) if (!(key in b) || !_.isEqual(a[key], b[key])) return false;
    return true;
  };

  // Is a given array or object empty?
  _.isEmpty = function(obj) {
    if (_.isArray(obj)) return obj.length === 0;
    for (var key in obj) if (hasOwnProperty.call(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType == 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return !!(obj && obj.concat && obj.unshift && !obj.callee);
  };

  // Is a given variable an arguments object?
  _.isArguments = function(obj) {
    return obj && obj.callee;
  };

  // Is a given value a function?
  _.isFunction = function(obj) {
    return !!(obj && obj.constructor && obj.call && obj.apply);
  };

  // Is a given value a string?
  _.isString = function(obj) {
    return !!(obj === '' || (obj && obj.charCodeAt && obj.substr));
  };

  // Is a given value a number?
  _.isNumber = function(obj) {
    return (obj === +obj) || (toString.call(obj) === '[object Number]');
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false;
  };

  // Is a given value a date?
  _.isDate = function(obj) {
    return !!(obj && obj.getTimezoneOffset && obj.setUTCFullYear);
  };

  // Is the given value a regular expression?
  _.isRegExp = function(obj) {
    return !!(obj && obj.test && obj.exec && (obj.ignoreCase || obj.ignoreCase === false));
  };

  // Is the given value NaN -- this one is interesting. NaN != NaN, and
  // isNaN(undefined) == true, so we make sure it's a number first.
  _.isNaN = function(obj) {
    return _.isNumber(obj) && isNaN(obj);
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return typeof obj == 'undefined';
  };

  // -------------------------- Utility Functions: ----------------------------

  // Run Underscore.js in noConflict mode, returning the '_' variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function n times.
  _.times = function (n, iterator, context) {
    for (var i = 0; i < n; i++) iterator.call(context, i);
  };

  // Break out of the middle of an iteration.
  _.breakLoop = function() {
    throw breaker;
  };

  // Add your own custom functions to the Underscore object, ensuring that
  // they're correctly added to the OOP wrapper as well.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      addToWrapper(name, _[name] = obj[name]);
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    start       : '<%',
    end         : '%>',
    interpolate : /<%=(.+?)%>/g
  };

  // JavaScript templating a-la ERB, pilfered from John Resig's
  // "Secrets of the JavaScript Ninja", page 83.
  // Single-quote fix from Rick Strahl's version.
  // With alterations for arbitrary delimiters.
  _.template = function(str, data) {
    var c  = _.templateSettings;
    var endMatch = new RegExp("'(?=[^"+c.end.substr(0, 1)+"]*"+escapeRegExp(c.end)+")","g");
    var fn = new Function('obj',
      'var p=[],print=function(){p.push.apply(p,arguments);};' +
      'with(obj){p.push(\'' +
      str.replace(/[\r\t\n]/g, " ")
         .replace(endMatch,"\t")
         .split("'").join("\\'")
         .split("\t").join("'")
         .replace(c.interpolate, "',$1,'")
         .split(c.start).join("');")
         .split(c.end).join("p.push('")
         + "');}return p.join('');");
    return data ? fn(data) : fn;
  };

  // ------------------------------- Aliases ----------------------------------

  _.each     = _.forEach;
  _.foldl    = _.inject       = _.reduce;
  _.foldr    = _.reduceRight;
  _.select   = _.filter;
  _.all      = _.every;
  _.any      = _.some;
  _.head     = _.first;
  _.tail     = _.rest;
  _.methods  = _.functions;

  // ------------------------ Setup the OOP Wrapper: --------------------------

  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.
  var wrapper = function(obj) { this._wrapped = obj; };

  // Helper function to continue chaining intermediate results.
  var result = function(obj, chain) {
    return chain ? _(obj).chain() : obj;
  };

  // A method to easily add functions to the OOP wrapper.
  var addToWrapper = function(name, func) {
    wrapper.prototype[name] = function() {
      var args = _.toArray(arguments);
      unshift.call(args, this._wrapped);
      return result(func.apply(_, args), this._chain);
    };
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      method.apply(this._wrapped, arguments);
      return result(this._wrapped, this._chain);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      return result(method.apply(this._wrapped, arguments), this._chain);
    };
  });

  // Start chaining a wrapped Underscore object.
  wrapper.prototype.chain = function() {
    this._chain = true;
    return this;
  };

  // Extracts the result from a wrapped and chained object.
  wrapper.prototype.value = function() {
    return this._wrapped;
  };

})();
define("lib/underscore", function(){});
/*
GLGE WebGL Graphics Engine
Copyright (c) 2010, Paul Brunt
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of GLGE nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL PAUL BRUNT BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * @fileOverview
 * @name GLGE_math.js
 */

 if(!window["GLGE"]){
	/**
	* @namespace Holds the functionality of the library
	*/
	window["GLGE"]={};
}

(function(GLGE){

GLGE.Vec=function(array) {
    return array.slice(0);
}

/**
* The Vec3 Class creates a vector 
* @param {Array} array An array of 3 floats
*/
GLGE.Vec3=function(x,y,z){
    return [x,y,z];
}

/**
* The Vec4 Class creates a vector 
* @param {Array} array An array of 4 floats
*/
GLGE.Vec4=function(x,y,z,w){
    return [x,y,z,w];
}

/**
* Gets the nth element (1 indexed) from the array
* @param {Array} v A vector with 4 elements
* @param {number} i The index from one 
*/
GLGE.get1basedVec4=function(v,i){
	return v[i-1];
};
/**
* Gets the nth element (1 indexed) from the array
* @param {Array} v A vector with 3 elements
* @param {number} i The index from one 
*/
GLGE.get1basedVec3=function(v,i){
	return v[i-1];
};

/**
* Gets the nth element (1 indexed) from the array
* @param {Array} v A vector with 4 elements
* @param {number} i The index from one 
*/
GLGE.getVec4=function(v,i){
	return v[i];
};
/**
* Gets the nth element (1 indexed) from the array
* @param {Array} v A vector with 3 elements
* @param {number} i The index from one 
*/
GLGE.getVec3=function(v,i){
	return v[i];
};



/**
* Adds a GLGE.Vec4 to this Vec4
* @param {Array} a The first value to add
* * @param {Array} b The second value to add
*/
GLGE.addVec4=function(a,b) {
    return [a[0]+b[0],a[1]+b[1],a[2]+b[2],a[3]+b[3]];
}
/**
* Adds a GLGE.Vec3 to this GLGE.Vec3
* @param {Array} a The first value to add
* @param {Array} b The second value to add
*/
GLGE.addVec3=function(a,b) {
    return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
}


/**
* Adds a GLGE.Vec4 to this Vec4
* @param {Array} a The first value
* * @param {Array} b The second value to subtract from the first
*/
GLGE.subVec4=function(a,b) {
    return [a[0]-b[0],a[1]-b[1],a[2]-b[2],a[3]-b[3]];
}
/**
* Adds a GLGE.Vec3 to this GLGE.Vec3
* @param {Array} a The first value
* @param {Array} b The second value to subtract from the first
*/
GLGE.subVec3=function(a,b) {
    return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
}


/**
* Gets the dot product between this and the input vector
* @param {Array} a the first value to dot
* @param {Array} b the second value to dot
*/
GLGE.dotVec3=function(a,b) {
    return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
}


/**
* Gets the dot product between this and the input vector
* @param {Array} a the first value to dot
* @param {Array} b the second value to dot
*/
GLGE.dotVec4=function(a,b) {
    return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
}

/**
* Gets the dot product between this and the input vector
* @param {Array} a the vector to scale
* @param {Number} b the scalar
*/
GLGE.scaleVec4=function(a,b) {
    return [a[0]*b,a[1]*b,a[2]*b,a[3]*b];
}

/**
* Gets the dot product between this and the input vector
* @param {Array} a the vector to scale
* @param {Number} b the scalar
*/
GLGE.scaleVec3=function(a,b) {
    return [a[0]*b,a[1]*b,a[2]*b];
}


/**
* Gets the cross product between this and the input vector
* @param {Array} a the first value to dot
* @param {Array} b the second value to dot
*/
GLGE.crossVec3=function(a,b) {
  return [a[1]*b[2]-a[2]*b[1],
          a[2]*b[0]-a[0]*b[2],
          a[0]*b[1]-a[1]*b[0]];
}

/**
* Returns a unitized version of the input vector3
* @param {Array} a the vector3 to be unitized
*/
GLGE.toUnitVec3=function(a) {
    var sq=a[0]*a[0]+a[1]*a[1]+a[2]*a[2];
    var f=1.0;
    if (sq>0) {
        f=Math.pow(sq,0.5);
    }
    return [a[0]/f,a[1]/f,a[2]/f];
};

/**
* Returns a unitized version of the input vector4
* @param {Array} a the vector4 to be unitized
*/
GLGE.toUnitVec4=function(a) {
    var sq=a[0]*a[0]+a[1]*a[1]+a[2]*a[2]+a[3]*a[3];
    var f=1.0;
    if (sq>0) {
        f=Math.pow(sq,0.5);
    }
    return [a[0]/f,a[1]/f,a[2]/f,a[3]/f];
};


/**
* Returns the length of a vector3
* @param {Array} a the vector to be measured
*/
GLGE.lengthVec3=function(a) {
    return Math.pow(a[0]*a[0]+a[1]*a[1]+a[2]*a[2],0.5);
};

/**
* Returns the distance between 2 vector3s
* @param {Array} a the first vector
* @param {Array} b the second vector
*/
GLGE.distanceVec3=function(a,b){
    return GLGE.lengthVec3(GLGE.subVec3(a,b));
};

/**
* Returns the length of a vector3
* @param {Array} a the vector to be measured
*/
GLGE.lengthVec4=function(a,b) {
    return Math.pow(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]+a[3]*a[3],0.5);
};

/**
* Returns the distance between 2 vector4s
* @param {Array} a the first vector
* @param {Array} b the second vector
*/
GLGE.distanceVec4=function(a,b){
    return GLGE.lengthVec4(GLGE.subVec4(a,b));
};


/**
* Returns the angle between 2 vector3s in radians
* @param {Array} a the first vector
* @param {Array} b the second vector
*/
GLGE.angleVec3=function(a,b){
    a=GLGE.toUnitVec3(a);
    b=GLGE.toUnitVec3(b);
    d=GLGE.dotVec3(a,b);
    if (d<-1)
        d=-1;
    if (d>1)
        d=1;
    return Math.acos(d);
};

/**
* Returns the angle between 2 vector4s in radians
* @param {Array} a the first vector
* @param {Array} b the second vector
*/
GLGE.angleVec4=function(a,b){
    a=GLGE.toUnitVec4(a);
    b=GLGE.toUnitVec4(b);
    d=GLGE.dotVec4(a,b);
    if (d<-1)
        d=-1;
    if (d>1)
        d=1;
    return Math.acos(d);
};

GLGE_math_use_webgl_float=false;

/**
* The Mat class creates a matrix from an array
* @param {Array} array An array of 9 or 16 floats
*/
GLGE.Mat3=GLGE_math_use_webgl_float?function(array) {
    if (array.length==9) {
        return new Float32Array(array);
    }else if (array.length==16) {
        return new Float32Array([array[0],array[1],array[2],array[4],array[5],array[6],array[8],array[9],array[10]]);        
    }else {
		throw "invalid matrix length";
    }
}:function(array) {
    var retval;
    if (array.length==9) {
        retval=array.slice(0);
    }else if (array.length==16) {
        retval=[array[0],array[1],array[2],array[4],array[5],array[6],array[8],array[9],array[10]];
    }else {
		throw "invalid matrix length";
    }    
    retval.get=function(i){return this[i];};
    return retval;
};
GLGE.Mat=GLGE_math_use_webgl_float?function(array) {
    return new Float32Array(array);
}:function(array){
    var retval=array.slice(0);
    retval.get=function(i){return this[i];};
    return retval;
};
GLGE.Mat4=function(array) {
    var retval;
    if (array.length==9) {
        retval=[array[0],array[1],array[2],0,array[3],array[4],array[5],0,array[6],array[7],array[8],0,0,0,0,1];
    }else if (array.length==16) {
        retval=array.slice(0);
    }else {
        throw "invalid matrix length";
    }
    retval.get=function(i){return this[i];};
    return retval;
};
/**
* Finds the determinate of the matrix
* @returns {number} the determinate
*/
GLGE.determinantMat4=function(m) {
    return m[12] * m[9] * m[6] * m[3] - m[8] * m[13] * m[6] * m[3] - m[12] * m[5] * m[10] * m[3] + m[4] * m[13] * m[10] * m[3] + m[8] * m[5] * m[14] * m[3] - m[4] * m[9] * m[14] * m[3] - m[12] * m[9] * m[2] * m[7] + m[8] * m[13] * m[2] * m[7] + m[12] * m[1] * m[10] * m[7] - m[0] * m[13] * m[10] * m[7] - m[8] * m[1] * m[14] * m[7] + m[0] * m[9] * m[14] * m[7] + m[12] * m[5] * m[2] * m[11] - m[4] * m[13] * m[2] * m[11] - m[12] * m[1] * m[6] * m[11] + m[0] * m[13] * m[6] * m[11] + m[4] * m[1] * m[14] * m[11] - m[0] * m[5] * m[14] * m[11] - m[8] * m[5] * m[2] * m[15] + m[4] * m[9] * m[2] * m[15] + m[8] * m[1] * m[6] * m[15] - m[0] * m[9] * m[6] * m[15] - m[4] * m[1] * m[10] * m[15] + m[0] * m[5] * m[10] * m[15];
};

/**
* Finds the inverse of the matrix
* @returns {GLGE.Mat} the inverse
*/
GLGE.inverseMat4=function(mat){
	// Cache the matrix values (makes for huge speed increases!)
	var a00 = mat[0], a01 = mat[1], a02 = mat[2], a03 = mat[3];
	var a10 = mat[4], a11 = mat[5], a12 = mat[6], a13 = mat[7];
	var a20 = mat[8], a21 = mat[9], a22 = mat[10], a23 = mat[11];
	var a30 = mat[12], a31 = mat[13], a32 = mat[14], a33 = mat[15];
	
	var d = a30*a21*a12*a03 - a20*a31*a12*a03 - a30*a11*a22*a03 + a10*a31*a22*a03 +
			a20*a11*a32*a03 - a10*a21*a32*a03 - a30*a21*a02*a13 + a20*a31*a02*a13 +
			a30*a01*a22*a13 - a00*a31*a22*a13 - a20*a01*a32*a13 + a00*a21*a32*a13 +
			a30*a11*a02*a23 - a10*a31*a02*a23 - a30*a01*a12*a23 + a00*a31*a12*a23 +
			a10*a01*a32*a23 - a00*a11*a32*a23 - a20*a11*a02*a33 + a10*a21*a02*a33 +
			a20*a01*a12*a33 - a00*a21*a12*a33 - a10*a01*a22*a33 + a00*a11*a22*a33;
	
	return [ (a21*a32*a13 - a31*a22*a13 + a31*a12*a23 - a11*a32*a23 - a21*a12*a33 + a11*a22*a33)/d,
	(a31*a22*a03 - a21*a32*a03 - a31*a02*a23 + a01*a32*a23 + a21*a02*a33 - a01*a22*a33)/d,
	(a11*a32*a03 - a31*a12*a03 + a31*a02*a13 - a01*a32*a13 - a11*a02*a33 + a01*a12*a33)/d,
	(a21*a12*a03 - a11*a22*a03 - a21*a02*a13 + a01*a22*a13 + a11*a02*a23 - a01*a12*a23)/d,
	(a30*a22*a13 - a20*a32*a13 - a30*a12*a23 + a10*a32*a23 + a20*a12*a33 - a10*a22*a33)/d,
	(a20*a32*a03 - a30*a22*a03 + a30*a02*a23 - a00*a32*a23 - a20*a02*a33 + a00*a22*a33)/d,
	(a30*a12*a03 - a10*a32*a03 - a30*a02*a13 + a00*a32*a13 + a10*a02*a33 - a00*a12*a33)/d,
	(a10*a22*a03 - a20*a12*a03 + a20*a02*a13 - a00*a22*a13 - a10*a02*a23 + a00*a12*a23)/d,
	(a20*a31*a13 - a30*a21*a13 + a30*a11*a23 - a10*a31*a23 - a20*a11*a33 + a10*a21*a33)/d,
	(a30*a21*a03 - a20*a31*a03 - a30*a01*a23 + a00*a31*a23 + a20*a01*a33 - a00*a21*a33)/d,
	(a10*a31*a03 - a30*a11*a03 + a30*a01*a13 - a00*a31*a13 - a10*a01*a33 + a00*a11*a33)/d,
	(a20*a11*a03 - a10*a21*a03 - a20*a01*a13 + a00*a21*a13 + a10*a01*a23 - a00*a11*a23)/d,
	(a30*a21*a12 - a20*a31*a12 - a30*a11*a22 + a10*a31*a22 + a20*a11*a32 - a10*a21*a32)/d,
	(a20*a31*a02 - a30*a21*a02 + a30*a01*a22 - a00*a31*a22 - a20*a01*a32 + a00*a21*a32)/d,
	(a30*a11*a02 - a10*a31*a02 - a30*a01*a12 + a00*a31*a12 + a10*a01*a32 - a00*a11*a32)/d,
	(a10*a21*a02 - a20*a11*a02 + a20*a01*a12 - a00*a21*a12 - a10*a01*a22 + a00*a11*a22)/d]
};

/**
* multiplies two mat4's
* @returns {GLGE.Mat} the matrix multiplication of the matrices
*/
GLGE.mulMat4Vec4=function(mat1,vec2){
	return GLGE.Vec4(mat1[0]*vec2[0]+mat1[1]*vec2[1]+mat1[2]*vec2[2]+mat1[3]*vec2[3],
			          mat1[4]*vec2[0]+mat1[5]*vec2[1]+mat1[6]*vec2[2]+mat1[7]*vec2[3],
			          mat1[8]*vec2[0]+mat1[9]*vec2[1]+mat1[10]*vec2[2]+mat1[11]*vec2[3],
			          mat1[12]*vec2[0]+mat1[13]*vec2[1]+mat1[14]*vec2[2]+mat1[15]*vec2[3]);
};
     
/**
* multiplies a Mat4 by a scalar value
* @returns {GLGE.Mat} the matrix multiplication of the matrices
*/
GLGE.scaleMat4=function(m,value) {
    return GLGE.Mat([m[0]*value,m[1]*value,m[2]*value,m[3]*value,
                                m[4]*value,m[5]*value,m[6]*value,m[7]*value,
                                m[8]*value,m[9]*value,m[10]*value,m[11]*value,
                                m[12]*value,m[13]*value,m[14]*value,m[15]*value]);
};
/**
* multiplies a Mat4 by a scalar value in place without allocation
* @returns {GLGE.Mat} the input matrix, modified
*/
GLGE.scaleInPlaceMat4=function(m,value) {
    m.set(0,m[0]*value);
    m.set(1,m[1]*value);
    m.set(2,m[2]*value);
    m.set(3,m[3]*value);
    m.set(4,m[4]*value);
    m.set(5,m[5]*value);
    m.set(6,m[6]*value);
    m.set(7,m[7]*value);
    m.set(8,m[8]*value);
    m.set(9,m[9]*value);
    m.set(10,m[10]*value);
    m.set(11,m[11]*value);
    m.set(12,m[12]*value);
    m.set(13,m[13]*value);
    m.set(14,m[14]*value);
    m.set(15,m[15]*value);
    return m;
};

/**
* adds a Mat4 to another Mat4 in place without allocation
* @returns {GLGE.Mat} the first input matrix, modified to be added
*/
GLGE.addInPlaceMat4=function(m,value) {
    m.set(0,m[0]+value[0]);
    m.set(1,m[1]+value[1]);
    m.set(2,m[2]+value[2]);
    m.set(3,m[3]+value[3]);
    m.set(4,m[4]+value[4]);
    m.set(5,m[5]+value[5]);
    m.set(6,m[6]+value[6]);
    m.set(7,m[7]+value[7]);
    m.set(8,m[8]+value[8]);
    m.set(9,m[9]+value[9]);
    m.set(10,m[10]+value[10]);
    m.set(11,m[11]+value[11]);
    m.set(12,m[12]+value[12]);
    m.set(13,m[13]+value[13]);
    m.set(14,m[14]+value[14]);
    m.set(15,m[15]+value[15]);
    return m;
};



/**
* adds two Mat4 together
* @returns {GLGE.Mat} a new, added Mat4
*/
GLGE.addMat4=function(m,value) {
return GLGE.Mat([m[0]+value[0],
                 m[1]+value[1],
                 m[2]+value[2],
                 m[3]+value[3],
                 m[4]+value[4],
                 m[5]+value[5],
                 m[6]+value[6],
                 m[7]+value[7],
                 m[8]+value[8],
                 m[9]+value[9],
                 m[10]+value[10],
                 m[11]+value[11],
                 m[12]+value[12],
                 m[13]+value[13],
                 m[14]+value[14],
                 m[15]+value[15]]);
    return m;
};



/**
* subs a Mat4 from another Mat4 in place without allocation
* @returns {GLGE.Mat} the first input matrix, modified to have the second subtacted
*/
GLGE.subInPlaceMat4=function(m,value) {
    m.set(0,m[0]-value[0]);
    m.set(1,m[1]-value[1]);
    m.set(2,m[2]-value[2]);
    m.set(3,m[3]-value[3]);
    m.set(4,m[4]-value[4]);
    m.set(5,m[5]-value[5]);
    m.set(6,m[6]-value[6]);
    m.set(7,m[7]-value[7]);
    m.set(8,m[8]-value[8]);
    m.set(9,m[9]-value[9]);
    m.set(10,m[10]-value[10]);
    m.set(11,m[11]-value[11]);
    m.set(12,m[12]-value[12]);
    m.set(13,m[13]-value[13]);
    m.set(14,m[14]-value[14]);
    m.set(15,m[15]-value[15]);
    return m;
};



/**
* subtracts the second matrix from the first
* @returns {GLGE.Mat} a new, subed Mat4
*/
GLGE.subMat4=function(m,value) {
return GLGE.Mat([m[0]-value[0],
                 m[1]-value[1],
                 m[2]-value[2],
                 m[3]-value[3],
                 m[4]-value[4],
                 m[5]-value[5],
                 m[6]-value[6],
                 m[7]-value[7],
                 m[8]-value[8],
                 m[9]-value[9],
                 m[10]-value[10],
                 m[11]-value[11],
                 m[12]-value[12],
                 m[13]-value[13],
                 m[14]-value[14],
                 m[15]-value[15]]);
    return m;
};


/**
* Finds the matrix multiplication with another GLGE.Mat or GLGE.vec or an Array of length 3-4
* @param {object} value An GLGE.Mat, GLGE.vec or Array
* @returns {GLGE.Mat|GLGE.Vec}
*/
GLGE.mulMat4=function(mat2,mat1){

	var a00 = mat1[0], a01 = mat1[1], a02 = mat1[2], a03 = mat1[3];
	var a10 = mat1[4], a11 = mat1[5], a12 = mat1[6], a13 = mat1[7];
	var a20 = mat1[8], a21 = mat1[9], a22 = mat1[10], a23 = mat1[11];
	var a30 = mat1[12], a31 = mat1[13], a32 = mat1[14], a33 = mat1[15];
	
	var b00 = mat2[0], b01 = mat2[1], b02 = mat2[2], b03 = mat2[3];
	var b10 = mat2[4], b11 = mat2[5], b12 = mat2[6], b13 = mat2[7];
	var b20 = mat2[8], b21 = mat2[9], b22 = mat2[10], b23 = mat2[11];
	var b30 = mat2[12], b31 = mat2[13], b32 = mat2[14], b33 = mat2[15];
	return [b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
		b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
		b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
		b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,
		
		b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
		b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
		b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
		b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,
		
		b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
		b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
		b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
		b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,
		
		b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
		b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
		b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
		b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33];
};

GLGE.transposeInPlaceMat4=function(m) {
    var v=m[1];
    m.set(1,m[4]);
    m.set(4,v);


    v=m[8];
    m.set(8,m[2]);
    m.set(2,v);
    

    v=m[3];
    m.set(3,m[12]);
    m.set(12,v);

    v=m[9];
    m.set(9,m[6]);
    m.set(6,v);

    v=m[13];
    m.set(13,m[7]);
    m.set(7,v);

    v=m[14];
    m.set(14,m[11]);
    m.set(11,v);
    
};

/**
* Builds the transpose of the matrix
* @returns {GLGE.Mat} the transposed matrix
*/
GLGE.transposeMat4=function(m) {
    return GLGE.Mat4([m[0],m[4],m[8],m[12],
		              m[1],m[5],m[9],m[13],
		              m[2],m[6],m[10],m[14],
		              m[3],m[7],m[11],m[15]]);
};

/**
* copys a js array into a webglarray
* @param {array} mat the source array
* @param {webglarray} glarray the destination array
*/
GLGE.mat4gl=function(mat,glarray){
	glarray[0]=mat[0];
	glarray[1]=mat[1];
	glarray[2]=mat[2];
	glarray[3]=mat[3];
	glarray[4]=mat[4];
	glarray[5]=mat[5];
	glarray[6]=mat[6];
	glarray[7]=mat[7];
	glarray[8]=mat[8];
	glarray[9]=mat[9];
	glarray[10]=mat[10];
	glarray[11]=mat[11];
	glarray[12]=mat[12];
	glarray[13]=mat[13];
	glarray[14]=mat[14];
	glarray[15]=mat[15];
};

/**
* Sets the value at the specified index
* @param {number} i the first index 1 offset
* @param {number} j the second index 1 offset
* @param {number} value the value to set
*/
GLGE.set1basedMat4=function(m,i,j,value){
	m[(i-1)*4+(j-1)]=value;
    if(m.glData!==undefined){
        delete m.glData;
    }
};

/**
* Sets the value at the specified index
* @param {number} i the first index from zero
* @param {number} j the second index from zero
* @param {number} value the value to set
*/
GLGE.setMat4=function(m,i,j,value){
	m[i*4+j]=value;
    if(m.glData!==undefined){
        delete m.glData;
    }
};

/**
* Gets the value at the specified index
* @param {number} i the first index from one
* @param {number} j the second index from one
* @returns {number} the value at the given index
*/
GLGE.get1basedMat4=function(m,i,j){
	return m.get((i-1)*4+(j-1));
};

/**
* Gets the value at the specified index
* @param {number} i the first index from zero
* @param {number} j the second index from zero
* @returns {number} the value at the given index
*/
GLGE.getMat4=function(m,i,j){
	return m[i*4+j];
};
/**
* gets the a webgl float array for this Matrix, once generated it will cache it so it doesn't need to recreate everytime
* @returns {Float32Array} the webgl array for this Matrix
* @private
*/
GLGE.glDataMat4=function(m) {
    m.glArray=new Float32Array(m);
    return m.glArray;
};
/**
 * Creates an identity matrix
 * @returns {GLGE.Mat} the identity matrix
 */
GLGE.identMatrix=function(){
	return GLGE.Mat([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
};
/**
 * Creates a translation matrix
 * @returns {Array} value an array GLGE.Vec or 3 paramters
 * @returns {GLGE.Mat} the translation matrix
 */
GLGE.translateMatrix=function(value){
	var x;
	var y;
	var z;
	if(arguments.length==3){
		x=arguments[0];
		y=arguments[1];
		z=arguments[2];
	}
	else if(value.data){
		x=value.data[0];
		y=value.data[1];
		z=value.data[2];
	}
	else if(value instanceof Array){
		x=value[0];
		y=value[1];
		z=value[2];
	}
	return GLGE.Mat([
		1,0,0,x,
		0,1,0,y,
		0,0,1,z,
		0,0,0,1
		]);
};
/**
 * Creates a scale matrix
 * @returns {Array} value an array GLGE.Vec or 3 paramters
 * @returns {GLGE.Mat} the scale matrix
 */
GLGE.scaleMatrix=function(value){
    var x;
    var y;
    var z;
	if(arguments.length==3){
		x=arguments[0];
		y=arguments[1];
		z=arguments[2];
	}
	else if(value.data){
		x=value.data[0];
		y=value.data[1];
		z=value.data[2];
	}
	else if(value instanceof Array){
		x=value[0];
		y=value[1];
		z=value[2];
	}
	return GLGE.Mat([
		x,0,0,0,
		0,y,0,0,
		0,0,z,0,
		0,0,0,1
		]);
}
/**
* @constant 
* @description Enum for XYZ rotation order
*/
GLGE.ROT_XYZ=1;
/**
* @constant 
* @description Enum for XZY rotation order
*/
GLGE.ROT_XZY=2;
/**
* @constant 
* @description Enum for YXZ rotation order
*/
GLGE.ROT_YXZ=3;
/**
* @constant 
* @description Enum for YZX rotation order
*/
GLGE.ROT_YZX=4;
/**
* @constant 
* @description Enum for ZXY rotation order
*/
GLGE.ROT_ZXY=5;
/**
* @constant 
* @description Enum for ZYX rotation order
*/
GLGE.ROT_ZYX=6;
/**
 * Creates a rotation matrix
 * @returns {Array} value an array GLGE.Vec or 3 paramters
 * @returns {GLGE.Mat} the rotation matrix
 */
GLGE.rotateMatrix=function(value,type) {
    var x;
    var y;
    var z;
	if(arguments.length>2){
		x=arguments[0];
		y=arguments[1];
		z=arguments[2];
		type=arguments[3];
	}
	else if(value.data){
		x=value.data[0];
		y=value.data[1];
		z=value.data[2];
	}
	else if(value instanceof Array){
		x=value[0];
		y=value[1];
		z=value[2];
	}
	if(!type) type=GLGE.ROT_XYZ;
	var cosx=Math.cos(x);
	var sinx=Math.sin(x);
	var cosy=Math.cos(y);
	var siny=Math.sin(y);
	var cosz=Math.cos(z);
	var sinz=Math.sin(z);
	var rotx=GLGE.Mat([1,0,0,0,0,cosx,-sinx,0,0,sinx,cosx,0,0,0,0,1]);
	var roty=GLGE.Mat([cosy,0,siny,0,0,1,0,0,-siny,0,cosy,0,0,0,0,1]);
	var rotz=GLGE.Mat([cosz,-sinz,0,0,sinz,cosz,0,0,0,0,1,0,0,0,0,1]);
	switch(type){
		case GLGE.ROT_XYZ:
			return GLGE.mulMat4(rotx,GLGE.mulMat4(roty,rotz));
			break;
		case GLGE.ROT_XZY:
			return GLGE.mulMat4(rotx,GLGE.mulMat4(rotz,roty));
			break;
		case GLGE.ROT_YXZ:
			return GLGE.mulMat4(roty,GLGE.mulMat4(rotx,rotz));
			break;
		case GLGE.ROT_YZX:
			return GLGE.mulMat4(roty,GLGE.mulMat4(rotz,rotx));
			break;
		case GLGE.ROT_ZXY:
			return GLGE.mulMat4(rotz,GLGE.mulMat4(rotx,roty));
			break;
		case GLGE.ROT_ZYX:
			return GLGE.mulMat4(rotz,GLGE.mulMat4(roty,rotx));
			break;
	}
}


GLGE.angleAxis=function(angle, axis) {
    var xmx,ymy,zmz,xmy,ymz,zmx,xms,yms,zms;
	axis=[axis[0],axis[1],axis[2],0];

        var x = axis[0];
        var y = axis[1];
        var z = axis[2];
	
	        
        var cos = Math.cos(angle);
        var cosi = 1.0 - cos;
	var sin = Math.sin(angle);
 
	xms = x * sin;yms = y * sin;zms = z * sin;
        xmx = x * x;ymy = y * y;zmz = z * z;
        xmy = x * y;ymz = y * z;zmx = z * x;
	
	var matrix = [(cosi * xmx) + cos,(cosi * xmy) - zms,(cosi * zmx) + yms,0,
			(cosi * xmy) + zms,(cosi * ymy) + cos,(cosi * ymz) - xms,0,
			(cosi * zmx) - yms,(cosi * ymz) + xms,(cosi * zmz) + cos,0,
			0,0,0,1];

        return GLGE.Mat(matrix);
};

GLGE.quatRotation=function(qx,qy,qz,qw){
	return GLGE.Mat([
	                    1 - 2*qy*qy - 2*qz*qz,2*qx*qy - 2*qz*qw,2*qx*qz + 2*qy*qw,0,
	                    2*qx*qy + 2*qz*qw,1 - 2*qx*qx - 2*qz*qz,2*qy*qz - 2*qx*qw,0,
	                    2*qx*qz - 2*qy*qw,2*qy*qz + 2*qx*qw,1 - 2*qx*qx - 2*qy*qy,0,
	                    0,0,0,1
	                ]);
};

GLGE.makeOrtho=function(left,right,bottom,top,near,far){
	var x = -(right+left)/(right-left);
	var y = -(top+bottom)/(top-bottom);
	var z = -(far+near)/(far-near);
    
        return GLGE.Mat([2/(right-left), 0, 0, x,
               0, 2/(top-bottom), 0, y,
               0, 0, -2/(far-near), z,
               0, 0, 0, 1]);
};

GLGE.makeFrustum=function(left,right,bottom,top,near,far){
	var x = 2*near/(right-left);
	var y = 2*near/(top-bottom);
	var a = (right+left)/(right-left);
	var b = (top+bottom)/(top-bottom);
	var c = -(far+near)/(far-near);
	var d = -2*far*near/(far-near);
	return GLGE.Mat([x, 0, a, 0,
		       0, y, b, 0,
		       0, 0, c, d,
		       0, 0, -1, 0]);
};

GLGE.makePerspective=function(fovy, aspect, near, far){
	var ymax = near * Math.tan(fovy * 0.00872664625972);
	var ymin = -ymax;
	var xmin = ymin * aspect;
	var xmax = ymax * aspect;
	return GLGE.makeFrustum(xmin, xmax, ymin, ymax, near, far);
};

GLGE.matrix2Scale=function(m){
	var m1=m[0];
	var m2=m[1];
	var m3=m[2];
	var m4=m[4];
	var m5=m[5];
	var m6=m[6];
	var m7=m[8];
	var m8=m[9];
	var m9=m[10];
	var scaleX=Math.sqrt(m1*m1+m2*m2+m3*m3);
	var scaleY=Math.sqrt(m4*m4+m5*m5+m6*m6);
	var scaleZ=Math.sqrt(m7*m7+m8*m8+m9*m9);
	return [scaleX,scaleY,scaleZ]
}


GLGE.rotationMatrix2Quat=function(m){
	var tr = m[0] + m[5] + m[10]+1.0;
	var S,x,y,z,w;

	if (tr > 0) { 
		S = 0.5/Math.sqrt(tr); 
		w = 0.25 / S;
		x = (m[9] - m[6]) * S;
		y = (m[2] - m[8]) * S; 
		z = (m[4] - m[1]) * S; 
	} else if ((m[0] > m[5])&&(m[0] > m[10])) { 
		S = Math.sqrt(1.0 + m[0] - m[5] - m[10]) * 2; 
		w = (m[9] - m[6]) / S;
		x = 0.25 / S;
		y = (m[1] + m[4]) / S; 
		z = (m[2] + m[8]) / S; 
	} else if (m[5] > m[10]) { 
		S = Math.sqrt(1.0 + m[5] - m[0] - m[10]) * 2;
		w = (m[2] - m[8]) / S;
		x = (m[1] + m[4]) / S; 
		y = 0.25 / S;
		z = (m[6] + m[9]) / S; 
	} else { 
		S = Math.sqrt(1.0 + m[10] - m[0] - m[5]) * 2; 
		w = (m[4] - m[1]) / S;
		x = (m[2] + m[8]) / S;
		y = (m[6] + m[9]) / S;
		z = 0.25 / S;
	}
	var N=Math.sqrt(x*x+y*y+z*z+w*w)
	
	return [x/N,y/N,z/N,w/N];
}



//returns plane as array [X,Y,Z,D]
GLGE.rayToPlane=function(origin,dir){
	var dirnorm=GLGE.toUnitVec3(dir);
	return [dirnorm[0],dirnorm[1],dirnorm[2],GLGE.dotVec3(origin,dirnorm)];
}

GLGE.rayIntersectPlane=function(origin,dir,plane){
	var planeN=[plane[0],plane[1],plane[2]];
	var planeD=plane[3];
	var vdir=GLGE.dotVec3(planeN,dir);
	if(vdir<=0){
		//ray in wrong direction
		return false;
	}
	var vo=-(GLGE.dotVec3(planeN,origin)+planeD);
	var t=vo/vdir;
	if(t<=0){
		return false;
	}
	return GLGE.addVec3(origin,GLGE.scaleVec3(dir,t));
}
//assumes perspective projection
GLGE.screenToDirection=function(x,y,width,height,proj){
	xcoord =  -( ( ( 2 * x ) / width ) - 1 ) / proj[0];
	ycoord =( ( ( 2 * y ) / height ) - 1 ) / proj[5];
	zcoord =  1;
	return GLGE.toUnitVec3([xcoord,ycoord,zcoord]);
}

GLGE.BoundingVolume=function(minX,maxX,minY,maxY,minZ,maxZ){
	var dims=[maxX-minX,maxY-minY,maxZ-minZ];
	this.dims=dims;
	this.center=[dims[0]/2+minX,dims[1]/2+minY,dims[2]/2+minZ];
}

//returns the center of the bounding area
GLGE.BoundingVolume.prototype.getCenter=function(matrix){
	return GLGE.mulMat4Vec4(matrix,this.center);
}

//returns box point
GLGE.BoundingVolume.prototype.getBoxPoint=function(matrix,point){
	var coord=[this.dims[0]/2*point[0]+this.center[0],this.dims[1]/2*point[1]+this.center[1],this.dims[2]/2*point[2]+this.center[2]];
	return GLGE.mulMat4Vec4(matrix,coord);
}

//returns the radius of a bounding sphere
GLGE.BoundingVolume.prototype.getSphereRadius=function(){
	return Math.pow((this.dims[0]*this.dims[0]+this.dims[1]*this.dims[1]+this.dims[2]*this.dims[2])/4,0.5);
}

//adds an additional bounding volume to resize the current and returns the result
GLGE.BoundingVolume.prototype.addBoundingVolume=function(vol){
	var minX=Math.min(this.center[0]-this.dims[0]/2,vol.center[0]-vol.dims[0]/2);
	var maxX=Math.max(this.center[0]+this.dims[0]/2,vol.center[0]+vol.dims[0]/2);
	var minY=Math.min(this.center[1]-this.dims[1]/2,vol.center[1]-vol.dims[1]/2);
	var maxY=Math.max(this.center[1]+this.dims[1]/2,vol.center[1]+vol.dims[1]/2);
	var minZ=Math.min(this.center[2]-this.dims[2]/2,vol.center[2]-vol.dims[2]/2);
	var maxZ=Math.max(this.center[2]+this.dims[2]/2,vol.center[2]+vol.dims[2]/2);
	var dims=[maxX-minX,maxY-minY,maxZ-minZ];
	this.dims=dims;
	this.center=[dims[0]/2+minX,dims[1]/2+minY,dims[2]/2+minZ];
}

//scales a volume based on a transform matrix
GLGE.BoundingVolume.prototype.applyMatrixScale=function(matrix){
	var scaleX=GLGE.lengthVec3([matrix[0],matrix[4],matrix[8]]);
	var scaleY=GLGE.lengthVec3([matrix[1],matrix[5],matrix[9]]);
	var scaleZ=GLGE.lengthVec3([matrix[2],matrix[6],matrix[10]]);
	var minX=(this.center[0]-this.dims[0]/2)*scaleX;
	var maxX=(this.center[0]+this.dims[0]/2)*scaleX;
	var minY=(this.center[1]-this.dims[1]/2)*scaleY;
	var maxY=(this.center[1]+this.dims[1]/2)*scaleY;
	var minZ=(this.center[2]-this.dims[2]/2)*scaleZ;
	var maxZ=(this.center[2]+this.dims[2]/2)*scaleZ;
	var dims=[maxX-minX,maxY-minY,maxZ-minZ];
	this.dims=dims;
	this.center=[dims[0]/2+minX,dims[1]/2+minY,dims[2]/2+minZ];
}

GLGE.BoundingVolume.prototype.clone=function(){
	var minX=this.center[0]-this.dims[0]/2;
	var maxX=this.center[0]+this.dims[0]/2;
	var minY=this.center[1]-this.dims[1]/2;
	var maxY=this.center[1]+this.dims[1]/2;
	var minZ=this.center[2]-this.dims[2]/2;
	var maxZ=this.center[2]+this.dims[2]/2;
	return new GLGE.BoundingVolume(minX,maxX,minY,maxY,minZ,maxZ);
}

GLGE.BoundingVolume.prototype.toString=function(){
	var minX=this.center[0]-this.dims[0]/2;
	var maxX=this.center[0]+this.dims[0]/2;
	var minY=this.center[1]-this.dims[1]/2;
	var maxY=this.center[1]+this.dims[1]/2;
	var minZ=this.center[2]-this.dims[2]/2;
	var maxZ=this.center[2]+this.dims[2]/2;
	return [minX,maxX,minY,maxY,minZ,maxZ].toString();
}


function GLGE_mathUnitTest() {
    var a=GLGE.Vec([1,2,3,4]);
    var b=GLGE.Vec4(GLGE.getVec4(a,3),
                    GLGE.get1basedVec4(a,3),
                    GLGE.getVec4(a,1),
                    GLGE.getVec4(a,0));
    var c=GLGE.identMatrix();
    var d=GLGE.mulMat4Vec4(c,b);
    if (GLGE.getVec4(d,0)!=4||
        GLGE.getVec4(d,1)!=3||
        GLGE.getVec4(d,2)!=2||
        GLGE.getVec4(d,3)!=1) {
        throw "Unit Test 1 failed MatVecMul "+d;
    }
    var m=GLGE.Mat4([3,4,5,0,.5,.75,0,0,.75,.5,0,0,.25,.25,1,1]);
    var m1=GLGE.Mat4([2,1,8,2,1,4,3,2,1,.5,6.5,2,8,3,1,.25]);
    var mm1=GLGE.mulMat4(m,m1);
    var am1=GLGE.Mat4([15,21.5,68.5,24,
                       1.75,3.5,6.25,2.5,
                       2,2.75,7.5,2.5,
                       9.75,4.75,10.25,3.25]);
    for (var i=0;i<4;++i) {
        for (var j=0;j<4;++j) {      
            var diff=GLGE.getMat4(mm1,i,j)-GLGE.getMat4(am1,i,j);
            if (diff<.000001&&diff>-.000001) {                

            }else {
                throw "Unit Test 1 failed Multiplication "+GLGE.getMat4(mm1,i,j)+" != "+GLGE.getMat4(am1,i,j);      
            }
        }
    }
    var inv = GLGE.inverseMat4(m);
    var k = GLGE.mulMat4(m,inv);
    var l = GLGE.mulMat4(inv,m);
    for (var i=0;i<4;++i) {
        for (var j=0;j<4;++j) {      
            var diff=GLGE.getMat4(k,i,j)-GLGE.getMat4(c,i,j);
            if (diff<.0001&&diff>-.0001) {                
            }else {
                throw "Unit Test 1 failed Inverse "+GLGE.getMat4(k,i,j)+" != "+GLGE.getMat4(c,i,j);   
            }
        }
    }
}
GLGE_mathUnitTest() ;


//Closure Export
GLGE["Vec3"]=GLGE.Vec3;
GLGE["Vec4"]=GLGE.Vec4;
GLGE["get1basedVec4"]=GLGE.get1basedVec4;
GLGE["get1basedVec3"]=GLGE.get1basedVec3;
GLGE["getVec4"]=GLGE.getVec4;
GLGE["getVec3"]=GLGE.getVec3;
GLGE["addVec4"]=GLGE.addVec4;
GLGE["addVec3"]=GLGE.addVec3;
GLGE["subVec4"]=GLGE.subVec4;
GLGE["subVec3"]=GLGE.subVec3;
GLGE["dotVec3"]=GLGE.dotVec3;
GLGE["dotVec4"]=GLGE.dotVec4;
GLGE["scaleVec4"]=GLGE.scaleVec4;
GLGE["scaleVec3"]=GLGE.scaleVec3;
GLGE["crossVec3"]=GLGE.crossVec3;
GLGE["toUnitVec3"]=GLGE.toUnitVec3;
GLGE["toUnitVec4"]=GLGE.toUnitVec4;
GLGE["lengthVec3"]=GLGE.lengthVec3;
GLGE["distanceVec3"]=GLGE.distanceVec3;
GLGE["lengthVec4"]=GLGE.lengthVec4;
GLGE["distanceVec4"]=GLGE.distanceVec4;
GLGE["angleVec3"]=GLGE.angleVec3;
GLGE["angleVec4"]=GLGE.angleVec4;
GLGE["Mat3"]=GLGE.Mat3;
GLGE["Mat"]=GLGE.Mat;
GLGE["Mat4"]=GLGE.Mat4;
GLGE["determinantMat4"]=GLGE.determinantMat4;
GLGE["inverseMat4"]=GLGE.inverseMat4;
GLGE["mulMat4Vec4"]=GLGE.mulMat4Vec4;
GLGE["scaleMat4"]=GLGE.scaleMat4;
GLGE["scaleInPlaceMat4"]=GLGE.scaleInPlaceMat4;
GLGE["addInPlaceMat4"]=GLGE.addInPlaceMat4;
GLGE["addMat4"]=GLGE.addMat4;
GLGE["subInPlaceMat4"]=GLGE.subInPlaceMat4;
GLGE["subMat4"]=GLGE.subMat4;
GLGE["mulMat4"]=GLGE.mulMat4;
GLGE["transposeInPlaceMat4"]=GLGE.transposeInPlaceMat4;
GLGE["transposeMat4"]=GLGE.transposeMat4;
GLGE["set1basedMat4"]=GLGE.set1basedMat4;
GLGE["setMat4"]=GLGE.setMat4;
GLGE["get1basedMat4"]=GLGE.get1basedMat4;
GLGE["getMat4"]=GLGE.getMat4;
GLGE["glDataMat4"]=GLGE.glDataMat4;
GLGE["identMatrix"]=GLGE.identMatrix;
GLGE["translateMatrix"]=GLGE.translateMatrix;
GLGE["scaleMatrix"]=GLGE.scaleMatrix;
GLGE["ROT_XYZ"]=GLGE.ROT_XYZ;
GLGE["ROT_XZY"]=GLGE.ROT_XZY;
GLGE["ROT_YXZ"]=GLGE.ROT_YXZ;
GLGE["ROT_YZX"]=GLGE.ROT_YZX;
GLGE["ROT_ZXY"]=GLGE.ROT_ZXY;
GLGE["ROT_ZYX"]=GLGE.ROT_ZYX;
GLGE["rotateMatrix"]=GLGE.rotateMatrix;
GLGE["angleAxis"]=GLGE.angleAxis;
GLGE["quatRotation"]=GLGE.quatRotation;
GLGE["makeOrtho"]=GLGE.makeOrtho;
GLGE["makeFrustum"]=GLGE.makeFrustum;
GLGE["makePerspective"]=GLGE.makePerspective;
GLGE["matrix2Scale"]=GLGE.matrix2Scale;
GLGE["rotationMatrix2Quat"]=GLGE.rotationMatrix2Quat;
GLGE["mat4gl"]=GLGE.mat4gl;


})(window["GLGE"]);
define("glge/glge_math", function(){});
/*
GLGE WebGL Graphics Engine
Copyright (c) 2010, Paul Brunt
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of GLGE nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL PAUL BRUNT BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * @fileOverview
 * @name glge.js
 * @author me@paulbrunt.co.uk
 */



 if(!window["GLGE"]){
	/**
	* @namespace Holds the functionality of the library
	*/
	window["GLGE"]={};
}

(function(GLGE){


/**
* Function to augment one object with another
* @param {object} obj1 Source Object
* @param {object} obj2 Destination Object
*/
GLGE.augment=function(obj1,obj2){
	for(proto in obj1.prototype){
		obj2.prototype[proto]=obj1.prototype[proto];
	}
}


/**
* Moves all GLGE function to global
**/
GLGE.makeGlobal=function(){
	for(var key in GLGE){
		window[key]=GLGE[key];
	}
}

GLGE.New=function(createclass){
	if(GLGE[createclass].prototype.className!=""){
		return new GLGE[createclass]();
	}else{
		return false;
	}
}

/**
* @constant 
* @description Enumeration for TRUE
*/
GLGE.TRUE=1;
/**
* @constant 
* @description Enumeration for FALSE
*/
GLGE.FALSE=0;


/**
* @constant 
* @description Enumeration for tri rendering
*/
GLGE.DRAW_TRIS=1;
/**
* @constant 
* @description Enumeration for line rendering
*/
GLGE.DRAW_LINES=2;

/**
* @constant 
* @description Enumeration for line loop rendering
*/
GLGE.DRAW_LINELOOPS=3;
/**
* @constant 
* @description Enumeration for line loop rendering
*/
GLGE.DRAW_LINESTRIPS=4;
/**
* @constant 
* @description Enumeration for point rendering
*/
GLGE.DRAW_POINTS=5;


/**
* @constant 
* @description Enumeration for rendering using default shader
*/
GLGE.RENDER_DEFAULT=0;

/**
* @constant 
* @description Enumeration for rendering using shadow shader
*/
GLGE.RENDER_SHADOW=1;

/**
* @constant 
* @description Enumeration for rendering using pick shader
*/
GLGE.RENDER_PICK=2;

/**
* @constant 
* @description Enumeration for rendering using normal shader
*/
GLGE.RENDER_NORMAL=3;

/**
* @constant 
* @description Enumeration for no rendering
*/
GLGE.RENDER_NULL=4;

/**
* @constant 
* @description Enumeration for box bound text picking
*/
GLGE.TEXT_BOXPICK=1;
/**
* @constant 
* @description Enumeration for text bound text picking
*/
GLGE.TEXT_TEXTPICK=1;

/**
* @constant 
* @description Enumeration for euler rotaions mode
*/
GLGE.P_EULER=1;

/**
* @constant 
* @description Enumeration for quaternions mode
*/
GLGE.P_QUAT=2;

/**
* @constant 
* @description Enumeration for matrix rotation mode
*/
GLGE.P_MATRIX=3;

/**
* @constant 
* @description Enumeration for no value
*/
GLGE.NONE=0;

/**
* @constant 
* @description Enumeration for X-Axis
*/
GLGE.XAXIS=1;
/**
* @constant 
* @description Enumeration for Y-Axis
*/
GLGE.YAXIS=2;
/**
* @constant 
* @description Enumeration for Z-Axis
*/
GLGE.ZAXIS=3;

/**
* @constant 
* @description Enumeration for +X-Axis
*/
GLGE.POS_XAXIS=1;
/**
* @constant 
* @description Enumeration for -X-Axis
*/
GLGE.NEG_XAXIS=2;
/**
* @constant 
* @description Enumeration for +Y-Axis
*/
GLGE.POS_YAXIS=3;
/**
* @constant 
* @description Enumeration for -Y-Axis
*/
GLGE.NEG_YAXIS=4;
/**
* @constant 
* @description Enumeration for +Z-Axis
*/
GLGE.POS_ZAXIS=5;
/**
* @constant 
* @description Enumeration for -Z-Axis
*/
GLGE.NEG_ZAXIS=6;

/**
* @constant 
* @description Linear blending function
*/
GLGE.LINEAR_BLEND=function(value){
	return value;
}
/**
* @constant 
* @description Quadratic blending function
*/
GLGE.QUAD_BLEND=function(value){
	return value*value;
}
/**
* @constant 
* @description Special blending function
*/
GLGE.SPECIAL_BLEND=function(value){
	value=value*(2-value);
	return value*value;
}


GLGE.error=function(error){
	alert(error);
}

/**
* @namespace Holds the global asset store
*/
GLGE.Assets={};
GLGE.Assets.assets={};
 
GLGE.Assets.createUUID=function(){
	var data=["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F"];
	var data2=["8","9","A","B"];
	uuid="";
	for(var i=0;i<38;i++){
		switch(i){
			case 8:uuid=uuid+"-";break;
			case 13:uuid=uuid+"-";break;
			case 18:uuid=uuid+"-";break;
			case 14:uuid=uuid+"4";break;
			case 19:uuid=uuid+data2[Math.round(Math.random()*3)];break;
			default:uuid=uuid+data[Math.round(Math.random()*15)];break;
		}
	}
	return uuid;
}
/**
* @function registers a new asset
*/
GLGE.Assets.registerAsset=function(obj,uid){
	if(!uid){
		uid=GLGE.Assets.createUUID();
	};
	obj.uid=uid;
	GLGE.Assets.assets[uid]=obj;
}
/**
* @function removes an asset
*/
GLGE.Assets.unregisterAsset=function(uid){
	delete GLGE.Assets.assets[uid];
}
/**
* @function finds an asset by uid
*/
GLGE.Assets.get=function(uid){
	var value=GLGE.Assets.assets[uid];
	if(value){
		return value;
	}else{
		return false;
	}
}

/**
* @function hashing function
* @private
*/
GLGE.fastHash=function(str){
	var s1=0;var s2=0;var s3=0;var s4=0;var s5=0;var s6=0;
	var c1=0;var c2=0;var c3=0;var c4=0;var c5=0;var c6=0;
	var i=0;
	var length=str.length;
	str+="000000";
	while(i<length){
		c1=str.charCodeAt(i++);c2=str.charCodeAt(i++);c3=str.charCodeAt(i++);
		c4=str.charCodeAt(i++);c5=str.charCodeAt(i++);c6=str.charCodeAt(i++);
		s1=(s5+c1+c2)%255;s2=(s6+c2+c3)%255;s3=(s1+c3+c4)%255;
		s4=(s2+c4+c5)%255;s5=(s3+c5+c6)%255;s6=(s4+c6+c1)%255;
	}
	var r=[String.fromCharCode(s1),String.fromCharCode(s2),String.fromCharCode(s3),
		String.fromCharCode(s4),String.fromCharCode(s5),String.fromCharCode(s6)];
	return r.join('');
}
/**
* @function check if shader is already created if not then create it
* @private
*/
GLGE.getGLShader=function(gl,type,str){
	var hash=GLGE.fastHash(str);
	if(!gl.shaderCache) gl.shaderCache={};
	if(!gl.shaderCache[hash]){
		var shader=gl.createShader(type);
		gl.shaderSource(shader, str);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		      alert(gl.getShaderInfoLog(shader));
		      return;
		}
		gl.shaderCache[hash]=shader;
	}
	return gl.shaderCache[hash];
}

/**
* @function tries to re use programs
* @private
*/
GLGE.getGLProgram=function(gl,vShader,fShader){
	if(!gl.programCache) gl.programCache=[];
	var programCache=gl.programCache;
	for(var i=0; i<programCache.length;i++){
		if(programCache[i].fShader==fShader && programCache[i].vShader==vShader){
			return programCache[i].program;
		}
	}
	var program=gl.createProgram();
	gl.attachShader(program, vShader);
	gl.attachShader(program, fShader);
	gl.linkProgram(program);
	programCache.push({vShader:vShader,fShader:fShader,program:program});
	if(!program.uniformDetails){
		program.uniformDetails={};
		var uniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
		for (var i=0;i<uniforms;++i) {
			var info=gl.getActiveUniform(program, i);
			program.uniformDetails[info.name]={loc:GLGE.getUniformLocation(gl,program,info.name),info:info};
		}
	}
	return program;
}


/**
* function to cache the uniform locations
* @param {glcontext} the gl context of the program
* @param {program} the shader program
* @param {string} the uniform name
* @private
*/
GLGE.getUniformLocation=function(gl,program, uniform){
	/*if(program.uniformDetails[uniform]){
		return program.uniformDetails[uniform].loc;
	}else{
		return gl.getUniformLocation(program, uniform);
	}*/
	if(!program.uniformCache) program.uniformCache={};
	if(!program.uniformChecked) program.uniformChecked={};
	if(!program.uniformChecked[uniform]){
		program.uniformCache[uniform]=gl.getUniformLocation(program, uniform);
		program.uniformChecked[uniform]=true;
	}
	return program.uniformCache[uniform];
};
/**
* function to cache the attribute locations
* @param {glcontext} the gl context of the program
* @param {program} the shader program
* @param {string} the attribe name
* @private
*/
GLGE.getAttribLocation=function(gl,program, attrib){
	if(!program.attribCache) program.attribCache={};
	if(!program.attribCache[attrib]){
		program.attribCache[attrib]=gl.getAttribLocation(program, attrib);
	}
	return program.attribCache[attrib];
}

/**
* @class class to implelemnt quick notation
*/
GLGE.QuickNotation=function(){
}
/**
* Call to set properties and add children to an object
* @example myObject._({LocX:10,LocY:20},child1,child2,.....);
*/
GLGE.QuickNotation.prototype._=function(){
	var argument;
	for(var i=0; i<arguments.length;i++){
		argument=arguments[i];
		if(typeof argument=="object"){
			if(argument.className && this["add"+argument.className]){
				this["add"+argument.className](argument);
			}else{
				for(var key in argument){
					if(this["set"+key]){
						this["set"+key](argument[key]);
					}
				}
			}
		}
	}
	return this;
}

/**
* @namespace GLGE Messaging System
*/
GLGE.Message={};
/**
* @function parses messages and updates the scene graph
*/
GLGE.Message.parseMessage=function(msg){
	switch(msg.command){
		case "create":
			var obj=new GLGE[msg.type](msg.uid);
			this.setAttributes(obj,msg.attributes);
			if(msg.children) GLGE.Message.addChildren(obj,msg.children);
			return obj;
			break;
		case "update":
			var obj=GLGE.Assets.get(msg.uid);
			this.setAttributes(obj,msg.attributes);
			if(msg.add) GLGE.Message.addChildren(obj,msg.add);
			if(msg.remove) GLGE.Message.removeChildren(obj,msg.remove);
			return obj;
			break;
	}
	return null;
}
/**
* @function parses the attributes from a message
* @private
*/
GLGE.Message.setAttributes=function(obj,attribs){
	if(attribs){
		for(var attrib in attribs){
			if(obj["set"+attrib]){
				//check to see if the attribute has to be parsed as a message
				if(attribs[attrib].command){
					attribs[attrib]=GLGE.Message.parseMessage(attribs[attrib]);
				}
				obj["set"+attrib](attribs[attrib]);
			}
		}
	}
	return this;
}
/**
* @function parses the children to add
* @private
*/
GLGE.Message.addChildren=function(obj,children){
	if(!(children instanceof Array)) children=[children];
	for(var i=0;i<children.length;i++){
		if(children[i].command){
			var asset=GLGE.Message.parseMessage(children[i]);
		}else{
			var asset=GLGE.Assets.get(children[i]);
		}
		obj["add"+asset.className](asset);
	}
}
/**
* @function parses the children to remove
* @private
*/
GLGE.Message.removeChildren=function(obj,children){
	if(!(children instanceof Array)) children=[children];
	for(var i=0;i<children.length;i++){
		var asset=GLGE.Assets.get(children[i]);
		obj["add"+asset.className](asset);
	}
}

GLGE.Message.toLoad=[];
GLGE.Message.messageLoader=function(url,callback,priority){
	GLGE.Message.toLoad.push([url,callback,priority]);
	if(GLGE.Message.toLoad.length==1) GLGE.Message.loadMessages();
}
GLGE.Message.loadMessages=function(){
	//TODO: use priority
	var nextDoc=GLGE.Message.toLoad.pop();
	var req=new XMLHttpRequest();
	req.onreadystatechange = function() {
		if(this.readyState  == 4){
			if(this.status  == 200 || this.status==0){
				nextDoc[1](this.responseText);
			}else{ 
				GLGE.error("Error loading Document: "+nextDoc[0]+" status "+this.status);
			}
		}
	}
	req.open("GET", nextDoc[0], true);
	req.send("");
	if(GLGE.Message.toLoad.length>0) GLGE.Message.loadMessages();
}



/**
* function to parse a colour input into RGB eg #ff00ff, red, rgb(100,100,100)
* @param {string} color the color to parse
*/
GLGE.colorParse=function(color){
	var red,green,blue,alpha;
	//defines the color names
	var color_names = {
		aliceblue: 'f0f8ff',		antiquewhite: 'faebd7',	aqua: '00ffff',
		aquamarine: '7fffd4',	azure: 'f0ffff',		beige: 'f5f5dc',
		bisque: 'ffe4c4',		black: '000000',		blanchedalmond: 'ffebcd',
		blue: '0000ff',			blueviolet: '8a2be2',	brown: 'a52a2a',
		burlywood: 'deb887',	cadetblue: '5f9ea0',		chartreuse: '7fff00',
		chocolate: 'd2691e',		coral: 'ff7f50',		cornflowerblue: '6495ed',
		cornsilk: 'fff8dc',		crimson: 'dc143c',		cyan: '00ffff',
		darkblue: '00008b',		darkcyan: '008b8b',		darkgoldenrod: 'b8860b',
		darkgray: 'a9a9a9',		darkgreen: '006400',	darkkhaki: 'bdb76b',
		darkmagenta: '8b008b',	darkolivegreen: '556b2f',	darkorange: 'ff8c00',
		darkorchid: '9932cc',	darkred: '8b0000',		darksalmon: 'e9967a',
		darkseagreen: '8fbc8f',	darkslateblue: '483d8b',	darkslategray: '2f4f4f',
		darkturquoise: '00ced1',	darkviolet: '9400d3',	deeppink: 'ff1493',
		deepskyblue: '00bfff',	dimgray: '696969',		dodgerblue: '1e90ff',
		feldspar: 'd19275',		firebrick: 'b22222',		floralwhite: 'fffaf0',
		forestgreen: '228b22',	fuchsia: 'ff00ff',		gainsboro: 'dcdcdc',
		ghostwhite: 'f8f8ff',		gold: 'ffd700',			goldenrod: 'daa520',
		gray: '808080',		green: '008000',		greenyellow: 'adff2f',
		honeydew: 'f0fff0',		hotpink: 'ff69b4',		indianred : 'cd5c5c',
		indigo : '4b0082',		ivory: 'fffff0',		khaki: 'f0e68c',
		lavender: 'e6e6fa',		lavenderblush: 'fff0f5',	lawngreen: '7cfc00',
		lemonchiffon: 'fffacd',	lightblue: 'add8e6',		lightcoral: 'f08080',
		lightcyan: 'e0ffff',		lightgoldenrodyellow: 'fafad2',	lightgrey: 'd3d3d3',
		lightgreen: '90ee90',	lightpink: 'ffb6c1',		lightsalmon: 'ffa07a',
		lightseagreen: '20b2aa',	lightskyblue: '87cefa',	lightslateblue: '8470ff',
		lightslategray: '778899',	lightsteelblue: 'b0c4de',	lightyellow: 'ffffe0',
		lime: '00ff00',			limegreen: '32cd32',	linen: 'faf0e6',
		magenta: 'ff00ff',		maroon: '800000',		mediumaquamarine: '66cdaa',
		mediumblue: '0000cd',	mediumorchid: 'ba55d3',	mediumpurple: '9370d8',
		mediumseagreen: '3cb371',	mediumslateblue: '7b68ee',	mediumspringgreen: '00fa9a',
		mediumturquoise: '48d1cc',	mediumvioletred: 'c71585',	midnightblue: '191970',
		mintcream: 'f5fffa',	mistyrose: 'ffe4e1',		moccasin: 'ffe4b5',
		navajowhite: 'ffdead',	navy: '000080',		oldlace: 'fdf5e6',
		olive: '808000',		olivedrab: '6b8e23',		orange: 'ffa500',
		orangered: 'ff4500',	orchid: 'da70d6',		palegoldenrod: 'eee8aa',
		palegreen: '98fb98',		paleturquoise: 'afeeee',	palevioletred: 'd87093',
		papayawhip: 'ffefd5',	peachpuff: 'ffdab9',		peru: 'cd853f',
		pink: 'ffc0cb',		plum: 'dda0dd',		powderblue: 'b0e0e6',
		purple: '800080',		red: 'ff0000',		rosybrown: 'bc8f8f',
		royalblue: '4169e1',		saddlebrown: '8b4513',	salmon: 'fa8072',
		sandybrown: 'f4a460',	seagreen: '2e8b57',		seashell: 'fff5ee',
		sienna: 'a0522d',		silver: 'c0c0c0',		skyblue: '87ceeb',
		slateblue: '6a5acd',		slategray: '708090',	snow: 'fffafa',
		springgreen: '00ff7f',	steelblue: '4682b4',		tan: 'd2b48c',
		teal: '008080',		thistle: 'd8bfd8',		tomato: 'ff6347',
		turquoise: '40e0d0',		violet: 'ee82ee',		violetred: 'd02090',
		wheat: 'f5deb3',		white: 'ffffff',		whitesmoke: 'f5f5f5',
		yellow: 'ffff00',		yellowgreen: '9acd32'
	};
	if(color_names[color]) color="#"+color_names[color];
	if(color.substr && color.substr(0,1)=="#"){
		color=color.substr(1);
		if(color.length==8){
			red=parseInt("0x"+color.substr(0,2))/255;
			green=parseInt("0x"+color.substr(2,2))/255;
			blue=parseInt("0x"+color.substr(4,2))/255;
			alpha=parseInt("0x"+color.substr(6,2))/255;
		}else if(color.length==4){
			red=parseInt("0x"+color.substr(0,1))/15;
			green=parseInt("0x"+color.substr(1,1))/15;
			blue=parseInt("0x"+color.substr(2,1))/15;
			alpha=parseInt("0x"+color.substr(3,1))/15;
		}else if(color.length==6){
			red=parseInt("0x"+color.substr(0,2))/255;
			green=parseInt("0x"+color.substr(2,2))/255;
			blue=parseInt("0x"+color.substr(4,2))/255;
			alpha=1;
		}else if(color.length==3){
			red=parseInt("0x"+color.substr(0,1))/15;
			green=parseInt("0x"+color.substr(1,1))/15;
			blue=parseInt("0x"+color.substr(2,1))/15;
			alpha=1;
		}
	}else if(color.substr && color.substr(0,4)=="rgb("){
		var colors=color.substr(4).split(",");
		red=parseInt(colors[0])/255;
		green=parseInt(colors[1])/255;
		blue=parseInt(colors[2])/255;
		alpha=1;
	}else if(color.substr && color.substr(0,5)=="rgba("){
		var colors=color.substr(4).split(",");
		red=parseInt(colors[0])/255;
		green=parseInt(colors[1])/255;
		blue=parseInt(colors[2])/255;
		alpha=parseInt(colors[3])/255;
	}else{
		red=0;
		green=0;
		blue=0;
		alpha=0;
	}
	return {r:red,g:green,b:blue,a:alpha};
}


/**
* @class A class to load json fragments from remote location or string
**/
GLGE.JSONLoader=function(){
}
GLGE.JSONLoader.prototype.downloadPriority=0;
/**
* Loads a json fragment from a url
* @param {string} url The URL to load
**/
GLGE.JSONLoader.prototype.setJSONSrc=function(url){
	var GLGEObj=this;
	GLGE.Message.messageLoader(url,function(text){
		GLGEObj.setJSONString(text);
	},this.downloadPriority);
}
/**
* Loads a json fragment from a string
* @param {string} string The URL to load
**/
GLGE.JSONLoader.prototype.setJSONString=function(string){
	var message = JSON.parse(string);
	//check to make sure this is the correct class type
	if(message.type==this.className){
		message.uid=this.uid;
		//we don't want to create a new one we want to update this one
		message.command="update";
		GLGE.Message.parseMessage(message);
	}
}
/**
* Sets the download priority
* @param {number} value The download priority
**/
GLGE.JSONLoader.prototype.setDownloadPriority=function(value){
	this.downloadPriority=value;
}
/**
* Gets the download priority
* @returns {number} The download priority
**/
GLGE.JSONLoader.prototype.getDownloadPriority=function(){
	return this.downloadPriority;
}


/**
* @class A events class
**/
GLGE.Events=function(){
}
/**
* Fires an event
* @param {string} event The name of the event to fire
* @param {object} data the events data
**/
GLGE.Events.prototype.fireEvent=function(event,data){
	if(this.events && this.events[event]){
		var events=this.events[event];
		for(var i=0;i<events.length;i++){
			events[i].call(this,data);
		}
	}
}
/**
* Adds an event listener
* @param {string} event The name of the event to listen for
* @param {function} fn the event callback
**/
GLGE.Events.prototype.addEventListener=function(event,fn){
	if(!this.events) this.events={};
	if(!this.events[event]) this.events[event]=[];
	this.events[event].push(fn);
}
/**
* Removes an event listener
* @param {function} fn the event callback to remove
**/
GLGE.Events.prototype.removeEventListener=function(event,fn){
	var idx=this.events[event].indexOf(fn);
	if(idx!=-1) this.events[event].splice(idx,1);
}

/**
* @class Document class to load scene, object, mesh etc from an external XML file 
* @param {string} url URL of the resource to load
*/
GLGE.Document=function(){
	this.listeners=[];
	this.documents=[];
}
GLGE.Document.prototype.listeners=null;
GLGE.Document.prototype.documents=null;
GLGE.Document.prototype.rootURL=null;
GLGE.Document.prototype.loadCount=0;
/**
* This is just a fix for a bug in webkit
* @param {string} id the id name to get
* @returns {object} node with teh specified id
* @private
*/
GLGE.Document.prototype.getElementById=function(id){
	var tags=this.getElementsByTagName("*");
	for(var i=0; i<tags.length;i++){
		if(tags[i].getAttribute("id")==id){
			return tags[i];
			break;
		}
	}
	return null;
}
/**
* Gets the absolute path given an import path and the path it's relative to
* @param {string} path the path to get the absolute path for
* @param {string} relativeto the path the supplied path is relativeto
* @returns {string} absolute path
* @private
*/
GLGE.Document.prototype.getAbsolutePath=function(path,relativeto){
	if(path.substr(0,7)=="http://" || path.substr(0,7)=="file://"  || path.substr(0,7)=="https://"){
		return path;
	}
	else
	{
		if(!relativeto){
			relativeto=window.location.href;
		}
		//find the path compoents
		var bits=relativeto.split("/");
		var domain=bits[2];
		var proto=bits[0];
		var initpath=[];
		for(var i=3;i<bits.length-1;i++){
			initpath.push(bits[i]);
		}
		//relative to domain
		if(path.substr(0,1)=="/"){
			initpath=[];
		}
		var locpath=path.split("/");
		for(i=0;i<locpath.length;i++){
			if(locpath[i]=="..") initpath.pop();
				else if(locpath[i]!="") initpath.push(locpath[i]);
		}
		return proto+"//"+domain+"/"+initpath.join("/");
	}
}
/**
* Loads the root document
* @param {string} url URL of the resource to load
*/
GLGE.Document.prototype.load=function(url){
	this.documents=[];
	this.rootURL=url;
	this.loadDocument(url,null);
}
/**
* Loads an additional documents into the collection
* @param {string} url URL of the resource to load
* @param {string} relativeto the path the URL is relative to, null for default
*/
GLGE.Document.prototype.loadDocument=function(url,relativeto){
	this.loadCount++;
	url=this.getAbsolutePath(url,relativeto);
	var req = new XMLHttpRequest();
	if(req) {
		req.docurl=url;
		req.docObj=this;
		req.overrideMimeType("text/xml");
		req.onreadystatechange = function() {
			if(this.readyState  == 4)
			{
				if(this.status  == 200 || this.status==0){
					this.responseXML.getElementById=this.docObj.getElementById;
					this.docObj.loaded(this.docurl,this.responseXML);
				}else{ 
					GLGE.error("Error loading Document: "+this.docurl+" status "+this.status);
				}
			}
		};
		req.open("GET", url, true);
		req.send("");
	}	
}
/**
* Trigered when a document has finished loading
* @param {string} url the absolute url of the document that has loaded
* @param {XMLDoc} responceXML the xml document that has finished loading
* @private
*/
GLGE.Document.prototype.loaded=function(url,responceXML){
	this.loadCount--;
	this.documents[url]={xml:responceXML};
	var imports=responceXML.getElementsByTagName("import");
	for(var i=0; i<imports.length;i++){
		if(!this.documents[this.getAbsolutePath(imports[i].getAttribute("url"),url)]){
			this.documents[this.getAbsolutePath(imports[i].getAttribute("url"),url)]={};
			this.loadDocument(imports[i].getAttribute("url"),url);
		}
	}
	if(this.loadCount==0){
		this.finishedLoading();
	}
}
/**
* Called when all documents have finished loading
* @private
*/
GLGE.Document.prototype.finishedLoading=function(){
	for(var i=0; i<this.listeners.length;i++){
		this.listeners[i](this.listeners.rootURL);
	}
	this["onLoad"]();
}
/**
* Called when all documents have finished loading
* @event
*/
GLGE.Document.prototype["onLoad"]=function(){};
/**
* Converts and attribute name into a class name
* @param {string} name attribute name to convert
* @private
*/
GLGE.Document.prototype.classString=function(name){
	if(!name) return false;
	var names=name.split("_");
	var converted="";
	for(var i=0;i<names.length;i++){
		converted=converted+names[i][0].toUpperCase()+names[i].substr(1);
	}
	return converted;
}
/**
* Sets the properties of an object based on the attributes of the corresponding dom element
* @param {object} Obj the DOM element to apply the attributes of
* @private
*/
GLGE.Document.prototype.setProperties=function(Obj){
	var set_method;
	var attribute_name;
	var value;
	for(var i=0; i<Obj.attributes.length; i++){
		value=false;
		set_method="set"+this.classString(Obj.attributes[i].nodeName);

		if(Obj.attributes[i].value[0]=="#"){
			value=this.getElement(Obj.attributes[i].value.substr(1),true);
		}
		if(!value){
			//if this is a GLGE contsant then set the constant value otherwise just literal
			if(typeof(GLGE[Obj.attributes[i].value]) != "undefined"){
				value=GLGE[Obj.attributes[i].value];
			}
			else
			{
				value=Obj.attributes[i].value;
			}
		}
		
		if(Obj.object[set_method]) Obj.object[set_method](value);
		//if a uid is set in the xml doc then make sure it's registered correctly in the assets
		if(Obj.attributes[i].nodeName=="uid"){
			GLGE.Assets.unregisterAsset(Obj.object.uid);
			Obj.object.uid=Obj.attributes[i].value;
			GLGE.Assets.registerAsset(Obj.object,Obj.attributes[i].value);
		}
	}
}
/**
* Adds child objects 
* @param {object} Obj the DOM element to apply the children of
* @private
*/
GLGE.Document.prototype.addChildren=function(Obj){
	//loop though and add the children
	var add_method;
	var child=Obj.firstChild;
	while(child){
		add_method="add"+this.classString(child.tagName);
		if(Obj.object[add_method]) Obj.object[add_method](this.getElement(child));
		child=child.nextSibling;
	}
}
/**
* Gets an object from the XML document based on the dom element 
* @param {string|domelement} ele the id of the element to get or the dom node
*/
GLGE.Document.prototype.getElement=function(ele,noerrors){
	var docele,doc;
	if(typeof(ele)=="string"){
		for(doc in this.documents){
			if(this.documents[doc].xml){
				docele=this.documents[doc].xml.getElementById(ele);
				if(docele){
					ele=docele;
					break;
				}
			}
		}
	}
	if(typeof(ele)=="string"){
		//if element is still a string at this point there there is an issue
		if(!noerrors) GLGE.error("Element "+ele+" not found in document");
		return false;
	}
	else
	{
		if(this["get"+this.classString(ele.tagName)]){
			return this["get"+this.classString(ele.tagName)](ele);
		}
		else
		{
			return this.getDefault(ele);
		}
	}
}
/**
* Parses the dom element and creates any objects that are required
* @param {domelement} ele the element to create the objects from
* @private
*/
GLGE.Document.prototype.getDefault=function(ele){
	if(!ele.object){
		if(GLGE[this.classString(ele.tagName)]){
			ele.object=new GLGE[this.classString(ele.tagName)]();
			this.setProperties(ele);
			this.addChildren(ele);
		}
		else
		{
			GLGE.error("XML Parse Error: GLGE Object not found"); 
		}
	}
	return ele.object;
}
/**
* Parses the dom element and creates a texture
* @param {domelement} ele the element to create the objects from
* @private
*/
GLGE.Document.prototype.getTexture=function(ele){
	if(!ele.object){
		var rel=this.getAbsolutePath(this.rootURL,null);
		ele.object=new GLGE[this.classString(ele.tagName)];
		ele.object.setSrc(this.getAbsolutePath(ele.getAttribute("src"),rel));
		ele.removeAttribute("src");
		this.setProperties(ele);
	}
	return ele.object;
}
GLGE.Document.prototype.getTextureVideo=GLGE.Document.prototype.getTexture;

/**
* Parses a document node into an array
* @param {node} the node to parse
* @private
*/
GLGE.Document.prototype.parseArray=function(node){
	var child=node.firstChild;
	var prev="";
	var output=[];
	var currentArray;
	var i;
	while(child){
		currentArray=(prev+child.nodeValue).split(",");
		child=child.nextSibling;
		if(currentArray[0]=="") currentArray.unshift();
		if(child) prev=currentArray.pop();
		for(i=0;i<currentArray.length;i++) output.push(currentArray[i]);
	}
	return output;
}

/**
* Parses the mesh dom to create the mesh object
* @param {domelement} ele the element to create the mesh from
* @private
*/
GLGE.Document.prototype.getMesh=function(ele){
	if(!ele.object){
		ele.object=new GLGE.Mesh();
		this.setProperties(ele);
		var child=ele.firstChild;
		while(child){
			switch(child.tagName){
				case "positions":
					ele.object.setPositions(this.parseArray(child));
					break;
				case "normals":
					ele.object.setNormals(this.parseArray(child));
					break;				
				case "uv1":
					ele.object.setUV(this.parseArray(child));
					break;				
				case "uv2":
					ele.object.setUV2(this.parseArray(child));
					break;
				case "faces":
					ele.object.setFaces(this.parseArray(child));
					break;
				case "joint_names":
					var names=this.parseArray(child);
					var jointObjects=[];
					for(var i=0;i<names.length;i++){
						if(names[i].substr(0,1)=="#"){
							jointObjects.push(this.getElement(names[i].substr(1)));
						}else{
							jointObjects.push(names[i]);
						}
					}
					ele.object.setJoints(jointObjects);
					break;
				case "bind_matrix":
					var mats=this.parseArray(child);
					var invBind=[];
					for(var i=0;i<mats.length;i++){
						invBind.push(GLGE.Mat4(mats[i].split(" ")));
					}
					ele.object.setInvBindMatrix(invBind);
					break;
				case "joints":
					ele.object.setVertexJoints(this.parseArray(child),child.getAttribute("count"));
					break;
				case "weights":
					ele.object.setVertexWeights(this.parseArray(child),child.getAttribute("count"));
					break;
			}
			child=child.nextSibling;
		}
	}
	return ele.object;
}

/**
* Adds a listener to be called when all documents have finished loading
* @param {function} listener the function to call when all loading in complete
*/
GLGE.Document.prototype.addLoadListener=function(listener){
	this.listeners.append(listener);
}
/**
* Removes a load listener
* @param {function} listener Listener to remove
*/
GLGE.Document.prototype.removeLoadListener=function(listener){
	for(var i=0; i<this.listeners.length; i++){
		if(this.listeners[i]===listener) this.listeners.splice(i,1);
	}
}

/**
* loads xml from a script tag
* @param {string} id the id of the element to load
*/
GLGE.Document.prototype.parseScript=function(id){
	this.rootURL=window.location.toString();
	var xmlScript = document.getElementById(id);
	if (!xmlScript) {
		return null;
	}
 
	var str = "";
	var k = xmlScript.firstChild;
	while (k) {
		if (k.nodeType == 3) {
			str += k.textContent;
		}
		k = k.nextSibling;
	}
	
	var parser=new DOMParser();
	var xmlDoc=parser.parseFromString(str,"text/xml");
	xmlDoc.getElementById=this.getElementById;
	
	this.documents["#"+id]={xml:xmlDoc};

	var imports=xmlDoc.getElementsByTagName("import");
	for(var i=0; i<imports.length;i++){
		if(!this.documents[this.getAbsolutePath(imports[i].getAttribute("url"),url)]){
			this.documents[this.getAbsolutePath(imports[i].getAttribute("url"),url)]={};
			this.loadDocument(imports[i].getAttribute("url"));
		}
	}
	if(this.loadCount==0){
		this.finishedLoading();
	}
}



/**
* @class Abstract class to agument objects that requires position, rotation and scale.
*/
GLGE.Placeable=function(){
}
GLGE.Placeable.prototype.locX=0;
GLGE.Placeable.prototype.locY=0;
GLGE.Placeable.prototype.locZ=0;
GLGE.Placeable.prototype.dLocX=0;
GLGE.Placeable.prototype.dLocY=0;
GLGE.Placeable.prototype.dLocZ=0;
GLGE.Placeable.prototype.quatX=0;
GLGE.Placeable.prototype.quatY=0;
GLGE.Placeable.prototype.quatZ=0;
GLGE.Placeable.prototype.quatW=0;
GLGE.Placeable.prototype.rotX=0;
GLGE.Placeable.prototype.rotY=0;
GLGE.Placeable.prototype.rotZ=0;
GLGE.Placeable.prototype.dRotX=0;
GLGE.Placeable.prototype.dRotY=0;
GLGE.Placeable.prototype.dRotZ=0;
GLGE.Placeable.prototype.scaleX=1;
GLGE.Placeable.prototype.scaleY=1;
GLGE.Placeable.prototype.scaleZ=1;
GLGE.Placeable.prototype.dScaleX=0;
GLGE.Placeable.prototype.dScaleY=0;
GLGE.Placeable.prototype.dScaleZ=0;
GLGE.Placeable.prototype.matrix=null;
GLGE.Placeable.prototype.rotOrder=GLGE.ROT_XYZ;
GLGE.Placeable.prototype.lookAt=null;
GLGE.Placeable.prototype.mode=GLGE.P_EULER;



/**
* Gets the root node object
* @returns {object}
*/
GLGE.Placeable.prototype.getRoot=function(){
	if(this.type==GLGE.G_ROOT){
		return this;
	}else if(this.parent){
		var value=this.parent.getRoot();
		if(!value) return this;
			else return value;
	}else{
		return this;
	}
}
/**
* Gets the id string of this text
* @returns {string}
*/
GLGE.Placeable.prototype.getRef=function(){
	if(this.id){
		return this.id;
	}else if(this.parent){
		return this.parent.getRef();
	}else{
		return null;
	}
}
/**
* Sets the id string
* @param {string} id The id string 
*/
GLGE.Placeable.prototype.setId=function(id){
    this.id=id;
    return this;
}
/**
* Gets the id string of this text
* @returns {string}
*/
GLGE.Placeable.prototype.getId=function(){
	return this.id
}
/**
* gets the object or poisition being looking at
* @param {array|object} value the location/object
*/
GLGE.Placeable.prototype.getLookat=function(){
	return this.lookAt;
}
/**
* sets the look at for this object, will be updated every frame
* @param {array|object} value the location/objec to look at
*/
GLGE.Placeable.prototype.setLookat=function(value){
	this.lookAt=value;
	return this;
}
/**
* Points the object in the direction of the coords or placeable value
* @param {array|object} value the location/objec to look at
*/
GLGE.Placeable.prototype.Lookat=function(value){
	var objpos;
	var pos=this.getPosition();
	if(value.getPosition){
		objpos=value.getPosition();
	}else{
		objpos={x:value[0],y:value[1],z:value[2]};
	}
	
	var coord=[pos.x-objpos.x,pos.y-objpos.y,pos.z-objpos.z];
	var zvec=GLGE.toUnitVec3(coord);
	var xvec=GLGE.toUnitVec3(GLGE.crossVec3([0,0,1],zvec));
	var yvec=GLGE.toUnitVec3(GLGE.crossVec3(zvec,xvec));		
	this.setRotMatrix(GLGE.Mat4([xvec[0], yvec[0], zvec[0], 0,
					xvec[1], yvec[1], zvec[1], 0,
					xvec[2], yvec[2], zvec[2], 0,
					0, 0, 0, 1]));
}
/**
* Gets the euler rotation order
* @returns {number} the objects rotation matrix
*/
GLGE.Placeable.prototype.getRotOrder=function(){
	return this.rotOrder;
}
/**
* Sets the euler rotation order
* @param {number} value the order to rotate GLGE.ROT_XYZ,GLGE.ROT_XZY,etc..
*/
GLGE.Placeable.prototype.setRotOrder=function(value){
	this.rotOrder=value;
	this.matrix=null;
	this.rotmatrix=null;
	return this;
}
/**
* Gets the rotaion matrix 
* @returns {matrix} the objects rotation matrix
*/
GLGE.Placeable.prototype.getRotMatrix=function(){
	if(!this.rotmatrix){
		var rotation=this.getRotation();
		if(this.mode==GLGE.P_EULER) this.rotmatrix=GLGE.rotateMatrix(rotation.x,rotation.y,rotation.z,this.rotOrder);
		if(this.mode==GLGE.P_QUAT)	this.rotmatrix=GLGE.quatRotation(rotation.x,rotation.y,rotation.z,rotation.w);
	}
	return this.rotmatrix;
}
/**
* Sets the rotation matrix 
* @param {matrix} the objects rotation matrix
*/
GLGE.Placeable.prototype.setRotMatrix=function(matrix){
	this.mode=GLGE.P_MATRIX;
	this.rotmatrix=matrix;
	this.updateMatrix();
	return this;
}
/**
* Sets the x location of the object
* @param {number} value The value to assign to the x position
*/
GLGE.Placeable.prototype.setLocX=function(value){this.locX=value; this.updateMatrix();return this;}
/**
* Sets the y location of the object
* @param {number} value The value to assign to the y position
*/
GLGE.Placeable.prototype.setLocY=function(value){this.locY=value;this.updateMatrix();return this;}
/**
* Sets the z location of the object
* @param {number} value The value to assign to the z position
*/
GLGE.Placeable.prototype.setLocZ=function(value){this.locZ=value;this.updateMatrix();return this;}
/**
* Sets the location of the object
* @param {number} x The value to assign to the x position
* @param {number} y The value to assign to the y position
* @param {number} z The value to assign to the z position
*/
GLGE.Placeable.prototype.setLoc=function(x,y,z){this.locX=x;this.locY=y;this.locZ=z;this.updateMatrix();return this;}
/**
* Sets the x location displacement of the object, usefull for animation
* @param {number} value The value to assign to the x displacement
*/
GLGE.Placeable.prototype.setDLocX=function(value){this.dLocX=value;this.updateMatrix();return this;}
/**
* Sets the y location displacement of the object, usefull for animation
* @param {number} value The value to assign to the y displacement
*/
GLGE.Placeable.prototype.setDLocY=function(value){this.dLocY=value;this.updateMatrix();return this;}
/**
* Sets the z location displacement of the object, usefull for animation
* @param {number} value The value to assign to the z displacement
*/
GLGE.Placeable.prototype.setDLocZ=function(value){this.dLocZ=value;this.updateMatrix();return this;}
/**
* Sets the location displacement of the object, useful for animation
* @param {number} x The value to assign to the x position
* @param {number} y The value to assign to the y position
* @param {number} z The value to assign to the z position
*/
GLGE.Placeable.prototype.setDLoc=function(x,y,z){this.dLocX=x;this.dLocY=y;this.dLocZ=z;this.updateMatrix();return this;}
/**
* Sets the x quat value
* @param {number} value the x quat value
*/
GLGE.Placeable.prototype.setQuatX=function(value){this.mode=GLGE.P_QUAT;this.quatX=parseFloat(value);this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the y quat value
* @param {number} value the y quat value
*/
GLGE.Placeable.prototype.setQuatY=function(value){this.mode=GLGE.P_QUAT;this.quatY=parseFloat(value);this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the z quat value
* @param {number} value the z quat value
*/
GLGE.Placeable.prototype.setQuatZ=function(value){this.mode=GLGE.P_QUAT;this.quatZ=parseFloat(value);this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the w quat value
* @param {number} value the w quat value
*/
GLGE.Placeable.prototype.setQuatW=function(value){this.mode=GLGE.P_QUAT;this.quatW=parseFloat(value);this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the quaternions
* @param {number} x The value to assign to the x 
* @param {number} y The value to assign to the y 
* @param {number} z The value to assign to the z 
* @param {number} w The value to assign to the w
*/
GLGE.Placeable.prototype.setQuat=function(x,y,z,w){this.mode=GLGE.P_QUAT;this.quatX=x;this.quatY=y;this.quatZ=z;this.quatW=w;this.updateMatrix();this.rotmatrix=null;return this;}

/**
* Sets the x rotation of the object
* @param {number} value The value to assign to the x rotation
*/
GLGE.Placeable.prototype.setRotX=function(value){this.mode=GLGE.P_EULER;this.rotX=value;this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the y rotation of the object
* @param {number} value The value to assign to the y rotation
*/
GLGE.Placeable.prototype.setRotY=function(value){this.mode=GLGE.P_EULER;this.rotY=value;this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the z rotation of the object
* @param {number} value The value to assign to the z rotation
*/
GLGE.Placeable.prototype.setRotZ=function(value){this.mode=GLGE.P_EULER;this.rotZ=value;this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the rotation of the object
* @param {number} x The value to assign to the x rotation
* @param {number} y The value to assign to the y rotation
* @param {number} z The value to assign to the z rotation
*/
GLGE.Placeable.prototype.setRot=function(x,y,z){this.mode=GLGE.P_EULER;this.rotX=x;this.rotY=y;this.rotZ=z;this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the x rotation displacement of the object, usefull for animation
* @param {number} value The value to assign to the x displacement
*/
GLGE.Placeable.prototype.setDRotX=function(value){this.mode=GLGE.P_EULER;this.dRotX=value;this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the y rotation displacement of the object, usefull for animation
* @param {number} value The value to assign to the y displacement
*/
GLGE.Placeable.prototype.setDRotY=function(value){this.mode=GLGE.P_EULER;this.dRotY=value;this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the z rotation displacement of the object, usefull for animation
* @param {number} value The value to assign to the z displacement
*/
GLGE.Placeable.prototype.setDRotZ=function(value){this.mode=GLGE.P_EULER;this.dRotZ=value;this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the rotation displacement of the object, useful for animation
* @param {number} x The value to assign to the x rotation
* @param {number} y The value to assign to the y rotation
* @param {number} z The value to assign to the z rotation
*/
GLGE.Placeable.prototype.setDRot=function(x,y,z){this.mode=GLGE.P_EULER;this.dRotX=x;this.dRotY=y;this.dRotZ=z;this.updateMatrix();this.rotmatrix=null;return this;}
/**
* Sets the x scale of the object
* @param {number} value The value to assign to the x scale
*/
GLGE.Placeable.prototype.setScaleX=function(value){this.scaleX=value;this.updateMatrix();return this;}
/**
* Sets the y scale of the object
* @param {number} value The value to assign to the y scale
*/
GLGE.Placeable.prototype.setScaleY=function(value){this.scaleY=value;this.updateMatrix();return this;}
/**
* Sets the z scale of the object
* @param {number} value The value to assign to the z scale
*/
GLGE.Placeable.prototype.setScaleZ=function(value){this.scaleZ=value;this.updateMatrix();return this;}
/**
* Sets the scale of the object
* @param {number} x The value to assign to the x scale
* @param {number} y The value to assign to the y scale
* @param {number} z The value to assign to the z scale
*/
GLGE.Placeable.prototype.setScale=function(x,y,z){if(!y){y=x;z=x}; this.scaleX=x;this.scaleY=y;this.scaleZ=z;this.updateMatrix();return this;}
/**
* Sets the x scale displacement of the object, usefull for animation
* @param {number} value The value to assign to the x displacement
*/
GLGE.Placeable.prototype.setDScaleX=function(value){this.dScaleX=value;this.updateMatrix();return this;}
/**
* Sets the y scale displacement of the object, usefull for animation
* @param {number} value The value to assign to the y displacement
*/
GLGE.Placeable.prototype.setDScaleY=function(value){this.dScaleY=value;this.updateMatrix();return this;}
/**
* Sets the z scale displacement of the object, usefull for animation
* @param {number} value The value to assign to the z displacement
*/
GLGE.Placeable.prototype.setDScaleZ=function(value){this.dScaleZ=value;this.updateMatrix();return this;}
/**
* Sets the scale displacement of the object, useful for animation
* @param {number} x The value to assign to the x scale
* @param {number} y The value to assign to the y scale
* @param {number} z The value to assign to the z scale
*/
GLGE.Placeable.prototype.setDScale=function(x,y,z){this.dScaleX=x;this.dScaleY=y;this.dScaleZ=z;this.updateMatrix();return this;}
/**
* Gets the x location of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getLocX=function(){return this.locX;}
/**
* Gets the y location of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getLocY=function(){return this.locY;}
/**
* Gets the z location of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getLocZ=function(){return this.locZ;}
/**
* Gets the x location displacement of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getDLocX=function(){return this.dLocX;}
/**
* Gets the y location displacement of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getDLocY=function(){return this.dLocY;}
/**
* Gets the z location displacement of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getDLocZ=function(){return this.dLocZ;}
/**
* Gets the x quat of the rotation
* @returns {number}
*/
GLGE.Placeable.prototype.getQuatX=function(){return this.quatX;}
/**
* Gets the y quat of the rotation
* @returns {number}
*/
GLGE.Placeable.prototype.getQuatY=function(){return this.quatY;}
/**
* Gets the z quat of the rotation
* @returns {number}
*/
GLGE.Placeable.prototype.getQuatZ=function(){return this.quatZ;}
/**
* Gets the w quat of the rotation
* @returns {number}
*/
GLGE.Placeable.prototype.getQuatW=function(){return this.quatW;}
/**
* Gets the x rotation of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getRotX=function(){return this.rotX;}
/**
* Gets the y rotation of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getRotY=function(){return this.rotY;}
/**
* Gets the z rotation of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getRotZ=function(){return this.rotZ;}
/**
* Gets the x rotaional displacement of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getDRotX=function(){return this.dRotX;}
/**
* Gets the y rotaional displacement of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getDRotY=function(){return this.dRotY;}
/**
* Gets the z rotaional displacement of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getDRotZ=function(){return this.dRotZ;}
/**
* Gets the x scale of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getScaleX=function(){return this.scaleX;}
/**
* Gets the y scale of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getScaleY=function(){return this.scaleY;}
/**
* Gets the z scale of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getScaleZ=function(){return this.scaleZ;}
/**
* Gets the x scale displacement of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getDScaleX=function(){return this.dScaleX;}
/**
* Gets the y scale displacement of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getDScaleY=function(){return this.dScaleY;}
/**
* Gets the z scale displacement of the object
* @returns {number}
*/
GLGE.Placeable.prototype.getDScaleZ=function(){return this.dScaleZ;}
/**
* Gets the position of the object
* @returns {array}
*/
GLGE.Placeable.prototype.getPosition=function(){
	var position={};
	position.x=parseFloat(this.locX)+parseFloat(this.dLocX);
	position.y=parseFloat(this.locY)+parseFloat(this.dLocY);
	position.z=parseFloat(this.locZ)+parseFloat(this.dLocZ);
	return position;
}
/**
* Gets the rotation of the object
* @returns {object}
*/
GLGE.Placeable.prototype.getRotation=function(){
	var rotation={};
	if(this.mode==GLGE.P_EULER){
		rotation.x=parseFloat(this.rotX)+parseFloat(this.dRotX);
		rotation.y=parseFloat(this.rotY)+parseFloat(this.dRotY);
		rotation.z=parseFloat(this.rotZ)+parseFloat(this.dRotZ);
	}
	if(this.mode==GLGE.P_QUAT){
		rotation.x=parseFloat(this.quatX);
		rotation.y=parseFloat(this.quatY);
		rotation.z=parseFloat(this.quatZ);
		rotation.w=parseFloat(this.quatW);
	}
	return rotation;
}
/**
* Gets the scale of the object
* @returns {object}
*/
GLGE.Placeable.prototype.getScale=function(){
	var scale={};
	scale.x=parseFloat(this.scaleX)+parseFloat(this.dScaleX);
	scale.y=parseFloat(this.scaleY)+parseFloat(this.dScaleY);
	scale.z=parseFloat(this.scaleZ)+parseFloat(this.dScaleZ);
	return scale;
}
/**
* Updates the model matrix
* @private
*/
GLGE.Placeable.prototype.updateMatrix=function(){
	this.matrix=null;
	if(this.children){
		for(var i=0;i<this.children.length;i++){
			this.children[i].updateMatrix();
		}
	}
}
/**
* Gets the model matrix to transform the model within the world
*/
GLGE.Placeable.prototype.getModelMatrix=function(){
	if(!this.matrix){
		this.invmatrix=null;
		this.transmatrix=null;
		this.transinvmatrix=null;
		var position=this.getPosition();
		var scale=this.getScale();
		var matrix=GLGE.mulMat4(GLGE.translateMatrix(position.x,position.y,position.z),GLGE.mulMat4(this.getRotMatrix(),GLGE.scaleMatrix(scale.x,scale.y,scale.z)));
		if(this.parent) matrix=GLGE.mulMat4(this.parent.getModelMatrix(),matrix);
		this.matrix=matrix;
	}
	return this.matrix;
}
/**
* Gets the model inverse matrix to transform the model within the world
*/
GLGE.Placeable.prototype.getInverseModelMatrix=function(){
	if(!this.matrix){
		this.getModelMatrix();
	}
	if(!this.invmatrix){
		this.invmatrix=GLGE.transposeMat4(this.matrix);
	}
	return this.invmatrix;
}
/**
* Gets the model transposed matrix to transform the model within the world
*/
GLGE.Placeable.prototype.getTransposeModelMatrix=function(){
	if(!this.matrix){
		this.getModelMatrix();
	}
	if(!this.transmatrix){
		this.transmatrix=GLGE.transposeMat4(this.matrix);
	}
	return this.transmatrix;
}
/**
* Gets the model inverse transposed matrix to transform the model within the world
*/
GLGE.Placeable.prototype.getTransposeInverseModelMatrix=function(){
	if(!this.matrix){
		this.getModelMatrix();
	}
	if(!this.transinvmatrix){
		this.invtransmatrix=GLGE.transposeMat4(this.getInverseModelMatrix());
	}
	return this.transinvmatrix;
}

/**
* @class Animation class to agument animatiable objects 
* @augments GLGE.Events
*/
GLGE.Animatable=function(){
}
/**
 * @name GLGE.Animatable#animFinished
 * @event
 * @param {object} data
 */
GLGE.augment(GLGE.Events,GLGE.Animatable);

GLGE.Animatable.prototype.animationStart=null;
GLGE.Animatable.prototype.animation=null;
GLGE.Animatable.prototype.blendStart=0;
GLGE.Animatable.prototype.blendTime=0;
GLGE.Animatable.prototype.lastFrame=null;
GLGE.Animatable.prototype.frameRate=25;
GLGE.Animatable.prototype.loop=GLGE.TRUE;
GLGE.Animatable.prototype.paused=GLGE.FALSE;
GLGE.Animatable.prototype.pausedTime=null;
GLGE.Animatable.prototype.blendFunction=GLGE.LINEAR_BLEND;

/**
* Creates and sets an animation to blend to the properties. Useful for blending to a specific location for example:
* blendto({LocX:10,LocY:5,LocZ:10},2000);
* @param {object} properties The properties to blend
* @param {number} duration the duration of the blend
* @param {function} blendFunction[optional] the function used for blending defaults to GLGE.LINEAR_BLEND
*/
GLGE.Animatable.prototype.blendTo=function(properties,duration,blendFunction){
	if(!blendFunction) blendFunction=GLGE.LINEAR_BLEND;
	var animation=new GLGE.AnimationVector();
	var curve;
	var point;
	for(prop in properties){
		curve=new GLGE.AnimationCurve();
		curve.setChannel(prop);
		point=new GLGE.LinearPoint();
		point.setX(1);
		point.setY(properties[prop]);
		curve.addPoint(point);
		animation.addAnimationCurve(curve);
	}
	this.setBlendFunction(blendFunction);
	this.setAnimation(animation,duration);
	return this;
}
/**
* Sets the animation blending function
* @param {function} value The blending function
*/
GLGE.Animatable.prototype.setBlendFunction=function(value){
	this.blendFunction=value;
	return this;
}
/**
* Gets the animation blending function
* @returns {function} the blending function
*/
GLGE.Animatable.prototype.getBlendFunction=function(){
	return this.blendFunction;
}

/**
* Sets the name of this object used for skinning
* @param {String} value The name to set
*/
GLGE.Animatable.prototype.setName=function(value){
	this.name=value;
	return this;
}
/**
* Gets the name of this object used for skinning
* @returns {String} the name
*/
GLGE.Animatable.prototype.getName=function(){
	return this.name;
}
/**
* gets the frame at the specified time
* @param {number} now the current time
*/
 GLGE.Animatable.prototype.getFrameNumber=function(now){
	var frame;
	if(!now) now=parseInt(new Date().getTime());
	if(this.animation.frames>1){
		if(this.loop){
			frame=((parseFloat(now)-parseFloat(this.animationStart))/1000*this.frameRate)%(this.animation.frames-1)+1; 
		}else{
			frame=((parseFloat(now)-parseFloat(this.animationStart))/1000*this.frameRate)+1; 
			if(frame>=this.animation.frames){
				frame=this.animation.frames;
			}
		}
	}else{
		frame=1;
	}

	return Math.round(frame);
}
 
 /**
* gets the initial values for the animation vector for blending
* @param {GLGE.AnimationVector} animation The animation
* @private
*/
 GLGE.Animatable.prototype.getInitialValues=function(animation,time){
	var initValues={};
	
	if(this.animation){
		this.lastFrame=null;
		this.animate(time,true);
	}
	
	for(var property in animation.curves){
		if(this["get"+property]){
			initValues[property]=this["get"+property]();
		}
	}
	
	return initValues;
}
 
/**
* update animated properties on this object
*/
GLGE.Animatable.prototype.animate=function(now,nocache){
	if(!this.paused && this.animation){
		if(!now) now=parseInt(new Date().getTime());
		var frame=this.getFrameNumber(now);
		
		if(!this.animation.animationCache) this.animation.animationCache={};
		if(frame!=this.lastFrame || this.blendTime!=0){
			this.lastFrame=frame;
			if(this.blendTime==0){
				if(!this.animation.animationCache[frame] || nocache){
					this.animation.animationCache[frame]=[];
					for(property in this.animation.curves){
						if(this["set"+property]){
							var value=this.animation.curves[property].getValue(parseFloat(frame));
							switch(property){
								case "QuatX":
								case "QuatY":
								case "QuatZ":
								case "QuatW":
								case "RotX":
								case "RotY":
								case "RotZ":
										var rot=true;
									break;
								default:
									this.animation.animationCache[frame].push({property:property,value:value});
									break;
							}
							this["set"+property](value);
						}	
					}
					if(rot){
						value=this.getRotMatrix();
						this.animation.animationCache[frame].push({property:"RotMatrix",value:value});
					}
				}else{
					var cache=this.animation.animationCache[frame];
					for(var i=0;i<cache.length;i++){
						if(this["set"+cache[i].property]) this["set"+cache[i].property](cache[i].value);
					}
				}
			}else{
				var time=now-this.animationStart;
				if(time<this.blendTime){
					var blendfactor=time/this.blendTime;
					blendfactor=this.blendFunction(blendfactor);
					for(property in this.animation.curves){
						if(this["set"+property]){
							var value=this.animation.curves[property].getValue(parseFloat(frame));
							value=value*blendfactor+this.blendInitValues[property]*(1-blendfactor);
							this["set"+property](value);
						}	
					}
				}else{
					this.blendTime=0;
				}
			}
		}
	}
	if(this.children){
		for(var i=0; i<this.children.length;i++){
			if(this.children[i].animate){
				this.children[i].animate(now,nocache);
			}
		}
	}
	if(this.animation && !this.animFinished && this.blendTime==0 && this.animation.frames==frame && !nocache){
		this.animFinished=true;
		this.fireEvent("animFinished",{});
	}
}
/**
* Sets the animation vector of this object
* @param {GLGE.AnimationVector} animationVector the animation to apply to this object
* @param {number} blendDuration [Optional] the time in milliseconds to blend into this animation
* @param {number} starttime [Optional] the starting time of the animation
*/
GLGE.Animatable.prototype.setAnimation=function(animationVector,blendDuration,starttime){
	if(starttime==null) starttime=parseInt(new Date().getTime());
	if(!blendDuration) blendDuration=0;
	if(blendDuration>0){
		this.blendInitValues=this.getInitialValues(animationVector,starttime);
		this.blendTime=blendDuration;
	}
	this.animationStart=starttime;
	this.lastFrame=null;
	this.animation=animationVector;
	this.animFinished=false;
	return this;
}
/**
* Gets the animation vector of this object
* @returns {AnimationVector}
*/
GLGE.Animatable.prototype.getAnimation=function(){
	return this.animation;
}
/**
* Sets the frame rate of the animation
* @param  {number} value the frame rate to set
*/
GLGE.Animatable.prototype.setFrameRate=function(value){
	this.frameRate=value;
	return this;
}
/**
* Gets the frame rate of the animation
* @return {number} the current frame rate
*/
GLGE.Animatable.prototype.getFrameRate=function(){
	return this.frameRate;
}
/**
* Sets the loop flag to GLGE.TRUE or GLGE.FALSE
* @param  {boolean} value 
*/
GLGE.Animatable.prototype.setLoop=function(value){
	this.loop=value;
	return this;
}
/**
* Gets the loop flag
* @return {boolean}
*/
GLGE.Animatable.prototype.getLoop=function(){
	return this.loop;
}
/**
* @function is looping? @see GLGE.Animatable#getLoop
*/
GLGE.Animatable.prototype.isLooping=GLGE.Animatable.prototype.getLoop;
 
/**
* Sets the paused flag to GLGE.TRUE or GLGE.FALSE
* @param  {boolean} value 
*/
GLGE.Animatable.prototype.setPaused=function(value){
	if(value) this.pauseTime=parseInt(new Date().getTime());
		else this.animationStart=this.animationStart+(parseInt(new Date().getTime())-this.pauseTime);
	this.paused=value;
	return this;
}
/**
* Gets the paused flag
* @return {boolean}
*/
GLGE.Animatable.prototype.getPaused=function(){
	return this.paused;
}
/**
* Toggles the paused flag
* @return {boolean} returns the resulting flag state
*/
GLGE.Animatable.prototype.togglePaused=function(){
	this.setPaused(!this.getPaused());
	return this.paused;
}
closure_export();


/**
* @class A bezier class to add points to the Animation Curve 
* @param {string} uid a unique string to identify this object
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.BezTriple=function(uid){
	GLGE.Assets.registerAsset(this,uid);
};
GLGE.augment(GLGE.QuickNotation,GLGE.BezTriple);
GLGE.augment(GLGE.JSONLoader,GLGE.BezTriple);

GLGE.BezTriple.prototype.className="BezTriple";
/**
* set the x1-coord
* @param {number} x x1-coord control point
*/
GLGE.BezTriple.prototype.setX1=function(x){
	this.x1=parseFloat(x);
	return this;
};
/**
* set the y1-coord
* @param {number} y y1-coord control point
*/
GLGE.BezTriple.prototype.setY1=function(y){
	this.y1=parseFloat(y);
	return this;
};
/**
* set the x2-coord
* @param {number} x x2-coord control point
*/
GLGE.BezTriple.prototype.setX2=function(x){
	this.x=parseFloat(x);
	return this;
};
/**
* set the y2-coord
* @param {number} y y2-coord control point
*/
GLGE.BezTriple.prototype.setY2=function(y){
	this.y=parseFloat(y);
	return this;
};
/**
* set the x3-coord
* @param {number} x x3-coord control point
*/
GLGE.BezTriple.prototype.setX3=function(x){
	this.x3=parseFloat(x);
	return this;
};
/**
* set the y3-coord
* @param {number} y y3-coord control point
*/
GLGE.BezTriple.prototype.setY3=function(y){
	this.y3=parseFloat(y);
	return this;
};


/**
* @class A LinearPoint class to add points to the Animation Curve 
* @param {string} uid unique string for this class
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.LinearPoint=function(uid){
	GLGE.Assets.registerAsset(this,uid);
};
GLGE.augment(GLGE.QuickNotation,GLGE.LinearPoint);
GLGE.augment(GLGE.JSONLoader,GLGE.LinearPoint);
GLGE.LinearPoint.prototype.className="LinearPoint";
/**
* set the x-coord
* @param {number} x x-coord control point
*/
GLGE.LinearPoint.prototype.setX=function(x){
	this.x=parseFloat(x);
	return this;
};
/**
* set the y-coord
* @param {number} y y-coord control point
*/
GLGE.LinearPoint.prototype.setY=function(y){
	this.y=parseFloat(y);
	return this;
};


/**
* @class A StepPoint class to add points to the Animation Curve 
* @param {number} x x-coord control point
* @param {object} value value of control point
*/
GLGE.StepPoint=function(x,value){
	this.x=parseFloat(x);
	this.y=value;
};

/**
* @class A curve which interpolates between control points
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.AnimationCurve=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.keyFrames=[];
	this.solutions={};
};
GLGE.augment(GLGE.QuickNotation,GLGE.AnimationCurve);
GLGE.augment(GLGE.JSONLoader,GLGE.AnimationCurve);
GLGE.AnimationCurve.prototype.className="AnimationCurve";
GLGE.AnimationCurve.prototype.keyFrames=null;
/**
* Adds a point to the curve
* @param {object} point The point to add
* @returns {Number} Index of the newly added point
*/
GLGE.AnimationCurve.prototype.addPoint=function(point){
	this.keyFrames.push(point);
	return this.keyFrames.length-1;
};
GLGE.AnimationCurve.prototype.addStepPoint=GLGE.AnimationCurve.prototype.addPoint;
GLGE.AnimationCurve.prototype.addLinearPoint=GLGE.AnimationCurve.prototype.addPoint;
GLGE.AnimationCurve.prototype.addBezTriple=GLGE.AnimationCurve.prototype.addPoint;
/**
* Get the value of the curve at any point
* @param {Number} frame The frame(x-coord) to return the value for
* @returns {Number} The value of the curve at the given point
*/
GLGE.AnimationCurve.prototype.coord=function(x,y){
	return {x:x,y:y}
}
/**
* Sets the animation channel this curve animates
* @param {string} channel The property to animate
*/
GLGE.AnimationCurve.prototype.setChannel=function(channel){
	this.channel=channel
}
GLGE.AnimationCurve.prototype.getValue=function(frame){
	var startKey;
	var endKey;
	var preStartKey;
	var preEndKey;
	if(frame<this.keyFrames[0].x) return this.keyFrames[0].y;
	for(var i=0; i<this.keyFrames.length;i++){
		if(this.keyFrames[i].x==frame){
			return this.keyFrames[i].y;
		}
		if(this.keyFrames[i].x<=frame && (startKey==undefined || this.keyFrames[i].x>this.keyFrames[startKey].x)){
			preStartKey=startKey;
			startKey=i;
		}else if(this.keyFrames[i].x<=frame && (preStartKey==undefined || this.keyFrames[i].x>this.keyFrames[preStartKey].x)){
			preStartKey=i;
		}
		if(this.keyFrames[i].x>frame && (endKey==undefined || this.keyFrames[i].x<=this.keyFrames[endKey].x)){
			preEndKey=endKey;
			endKey=i;
		}else if(this.keyFrames[i].x>frame && (preEndKey==undefined || this.keyFrames[i].x<=this.keyFrames[preEndKey].x)){
			preEndKey=i;
		}
	}
	if(startKey==undefined){
		startKey=endKey;
		endKey=preEndKey;
	}
	if(endKey==undefined){
		endKey=startKey;
		startKey=preStartKey;
	}
	if(this.keyFrames[startKey] instanceof GLGE.BezTriple && this.keyFrames[endKey] instanceof GLGE.BezTriple){
		var C1=this.coord(this.keyFrames[startKey].x,this.keyFrames[startKey].y);
		var C2=this.coord(this.keyFrames[startKey].x3,this.keyFrames[startKey].y3);
		var C3=this.coord(this.keyFrames[endKey].x1,this.keyFrames[endKey].y1);
		var C4=this.coord(this.keyFrames[endKey].x,this.keyFrames[endKey].y);
		return this.atX(frame,C1,C2,C3,C4).y;
	}
	if(this.keyFrames[startKey] instanceof GLGE.LinearPoint && this.keyFrames[endKey] instanceof GLGE.BezTriple){
		var C1=this.coord(this.keyFrames[startKey].x,this.keyFrames[startKey].y);
		var C2=this.coord(this.keyFrames[endKey].x1,this.keyFrames[endKey].y1);
		var C3=this.coord(this.keyFrames[endKey].x1,this.keyFrames[endKey].y1);
		var C4=this.coord(this.keyFrames[endKey].x,this.keyFrames[endKey].y);
		return this.atX(frame,C1,C2,C3,C4).y;
	}
	if(this.keyFrames[startKey] instanceof GLGE.BezTriple && this.keyFrames[endKey] instanceof GLGE.LinearPoint){
		var C1=this.coord(this.keyFrames[startKey].x,this.keyFrames[startKey].y);
		var C2=this.coord(this.keyFrames[startKey].x3,this.keyFrames[startKey].y3);
		var C3=this.coord(this.keyFrames[startKey].x3,this.keyFrames[startKey].y3);
		var C4=this.coord(this.keyFrames[endKey].x,this.keyFrames[endKey].y);
		return this.atX(frame,C1,C2,C3,C4).y;
	}
	if(this.keyFrames[startKey] instanceof GLGE.LinearPoint && this.keyFrames[endKey] instanceof GLGE.LinearPoint){
		var value=(frame-this.keyFrames[startKey].x)*(this.keyFrames[endKey].y-this.keyFrames[startKey].y)/(this.keyFrames[endKey].x-this.keyFrames[startKey].x)+this.keyFrames[startKey].y;
		return value;
	}
	if(this.keyFrames[startKey] instanceof GLGE.StepPoint){
		return this.keyFrames[startKey].y
	}
	if(!this.keyFrames.preStartKey) this.keyFrames.preStartKey=this.keyFrames[0].y;
	return this.keyFrames.preStartKey;
};
/**
* Function used to calculate bezier curve
* @private
*/
GLGE.AnimationCurve.prototype.B1=function(t) { return t*t*t };
/**
* Function used to calculate bezier curve
* @private
*/
GLGE.AnimationCurve.prototype.B2=function(t) { return 3*t*t*(1-t) };
/**
* Function used to calculate bezier curve
* @private
*/
GLGE.AnimationCurve.prototype.B3=function(t) { return 3*t*(1-t)*(1-t) };
/**
* Function used to calculate bezier curve
* @private
*/
GLGE.AnimationCurve.prototype.B4=function(t) { return (1-t)*(1-t)*(1-t) };
/**
* Gets the value of a bezier curve at a given point
* @private
*/
GLGE.AnimationCurve.prototype.getBezier=function(t,C1,C2,C3,C4) {
	var pos = {};
	pos.x = C1.x*this.B1(t) + C2.x*this.B2(t) + C3.x*this.B3(t) + C4.x*this.B4(t);
	pos.y = C1.y*this.B1(t) + C2.y*this.B2(t) + C3.y*this.B3(t) + C4.y*this.B4(t);
	return pos;
};
/**
* Solves cubic equation to get the parametic value of the curve at a specified point
* @private
*/
GLGE.AnimationCurve.prototype.Quad3Solve=function(a,b,c,d){
	ref=a+"-"+b+"-"+"-"+c+"-"+d;
	if(this.solutions[ref]){
		return this.solutions[ref];
	}
	else
	{
		b /= a;c /= a;d /= a;
		var q, r, d1, s, t, t1, r13;
		q = (3.0*c - (b*b))/9.0;
		r = -(27.0*d) + b*(9.0*c - 2.0*(b*b));
		r /= 54.0;
		t1 = (b/3.0);
		discrim = q*q*q + r*r;
		result=[];
				
		if (discrim > 0) { 
		// one real, two complex
		 s = r + Math.sqrt(discrim);
		 s = ((s < 0) ? -Math.pow(-s, (1.0/3.0)) : Math.pow(s, (1.0/3.0)));
		 t = r - Math.sqrt(discrim);
		 t = ((t < 0) ? -Math.pow(-t, (1.0/3.0)) : Math.pow(t, (1.0/3.0)));
		 result[0] = -t1 + s + t;
		 t1 = t1 + (s + t)/2.0;
		 result[1] = result[2] = -t1;
		 t1 = Math.sqrt(3.0)*(-t + s)/2;
		} 
		else if (discrim == 0){ 
		// All roots real
		 r13 = ((r < 0) ? -Math.pow(-r,(1.0/3.0)) : Math.pow(r,(1.0/3.0)));
		 result[1] = -t1 + 2.0*r13;
		 result[1] = result[2]  = -(r13 + t1);
		} 
		else
		{
			q = -q;
			d1 = q*q*q;
			d1 = Math.acos(r/Math.sqrt(1));
			r13 = 2.0*Math.sqrt(q);


			result[0] = -t1 + r13*Math.cos(d1/3.0);
			result[1] = -t1 + r13*Math.cos((d1 + 2.0*Math.PI)/3.0);
			result[2] = -t1 + r13*Math.cos((d1 + 4.0*Math.PI)/3.0);
		}
		var toreturn=false;
		//determine which is the correct result
		if(result[0]>=0 && result[0]<=1) toreturn=result[0];
		if(!toreturn && result[1]>=0 && result[1]<=1) toreturn=result[1];
		if(!toreturn && result[2]>=0 && result[2]<=1) toreturn=result[2];
		//cache result for next time
		this.solutions[ref]=toreturn;
		
		return toreturn;
	}
};
/**
* Get the value of the a single bezier curve 
* @param {Number} x xcoord of point to get
* @param {Number} C1 First bezier control point
* @param {Number} C2 Second bezier control point
* @param {Number} C3 Third bezier control point
* @param {Number} C4 Forth bezier control point
* @returns {Number} The value of the curve at the given x
*/
GLGE.AnimationCurve.prototype.atX=function(x,C1,C2,C3,C4){
	a=C1.x-C2.x*3+C3.x*3-C4.x;
	b=C2.x*3-C3.x*6+C4.x*3;
	c=C3.x*3-C4.x*3;
	d=C4.x-x;
	return this.getBezier(this.Quad3Solve(a,b,c,d),C1,C2,C3,C4);
};

/**
* @class The AnimationVectors class allows you to specify the 2D Animation curves that define specific channels of animation within the engine. 
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.AnimationVector=function(uid){
    GLGE.Assets.registerAsset(this,uid);
    this.curves=[];
}
GLGE.augment(GLGE.QuickNotation,GLGE.AnimationVector);
GLGE.augment(GLGE.JSONLoader,GLGE.AnimationVector);
GLGE.AnimationVector.prototype.curves=[];
GLGE.AnimationVector.prototype.frames=250;

/**
* Adds an Animation Curve to a channel 
* @param {String} channel The name of the curve to be added
* @param {GLGE.AnimationCurve} curve The animation curve to add
*/
GLGE.AnimationVector.prototype.addAnimationCurve=function(curve){
	this.curves[curve.channel]=curve;
	return this;
}
/**
* Removes an Animation Curve form a channel
* @param {String} channel The name of the curve to be removed
*/
GLGE.AnimationVector.prototype.removeAnimationCurve=function(name){
	delete(this.curves[name]);
}
/**
* Sets the number of frames in the animation
* @param {number} value The number of frames in the animation
*/
GLGE.AnimationVector.prototype.setFrames=function(value){
	this.frames=value;
	return this;
}
/**
* Sets the number of frames in the animation
* @returns {number} The number of frames in the animation
*/
GLGE.AnimationVector.prototype.getFrames=function(){
	return this.frames;
}


/**
* @constant 
* @description Enumeration for node group type
*/
GLGE.G_NODE=1;
/**
* @constant 
* @description Enumeration for root group type
*/
GLGE.G_ROOT=2;
/**
* @class Group class to allow object transform hierarchies 
* @augments GLGE.Animatable
* @augments GLGE.Placeable
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.Group=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.children=[];
}
GLGE.augment(GLGE.Placeable,GLGE.Group);
GLGE.augment(GLGE.Animatable,GLGE.Group);
GLGE.augment(GLGE.QuickNotation,GLGE.Group);
GLGE.augment(GLGE.JSONLoader,GLGE.Group);
GLGE.Group.prototype.children=null;
GLGE.Group.prototype.className="Group";
GLGE.Group.prototype.type=GLGE.G_NODE;
/**
* Sets the action for this Group
* @param {GLGE.Action} action the action to apply
*/
GLGE.Group.prototype.setAction=function(action,blendTime,loop){
	action.start(blendTime,loop,this.getNames());
	return this;
}
/**
* Gets the name of the object and names of any sub objects
* @returns an object of name
*/
GLGE.Group.prototype.getNames=function(names){
	if(!names) names={};
	var thisname=this.getName();
	if(thisname!="") names[thisname]=this;
	for(var i=0;i<this.children.length;i++){
		if(this.children[i].getNames){
			this.children[i].getNames(names);
		}
	}
	return names;
}
/**
* Gets the bounding volume for this group
* @returns {GLGE.BoundingVolume} 
*/
GLGE.Group.prototype.getBoundingVolume=function(){
	this.boundingVolume=new GLGE.BoundingVolume(0,0,0,0,0,0);
	for(var i=0; i<this.children.length;i++){
		if(this.children[i].getBoundingVolume){
			this.boundingVolume.addBoundingVolume(this.children[i].getBoundingVolume());
		}else if(this.children[i].getLocX){
			//if now bounding rec for this child but has a position then assume a point such as a light
			var x=parseFloat(this.children[i].getLocX());
			var y=parseFloat(this.children[i].getLocY());
			var z=parseFloat(this.children[i].getLocZ());
			this.boundingVolume.addBoundingVolume(new GLGE.BoundingVolume(x,x,y,y,z,z));
		}
	}
	this.boundingVolume.applyMatrixScale(this.getModelMatrix());
	
	return this.boundingVolume;
}
/**
* Gets a list of all objects in this group
* @param {array} pointer to an array [optional]
* @returns {GLGE.Object[]} an array of GLGE.Objects
*/
GLGE.Group.prototype.getObjects=function(objects){
	if(!objects) objects=[];
	for(var i=0; i<this.children.length;i++){
		if(this.children[i].className=="Object" || this.children[i].className=="Text" || this.children[i].toRender){
		if(this.children[i].renderFirst) objects.unshift(this.children[i]);
			else	objects.push(this.children[i]);
		}else if(this.children[i].getObjects){
			this.children[i].getObjects(objects);
		}
	}
	return objects;
}
/**
* Gets a list of all lights in this group
* @param {array} pointer to an array [optional]
* @returns {GLGE.Lights[]} an array of GLGE.Lights
*/
GLGE.Group.prototype.getLights=function(lights){
	if(!lights) lights=[];
	for(var i=0; i<this.children.length;i++){
		if(this.children[i].className=="Light"){
			lights.push(this.children[i]);
		}else if(this.children[i].getLights){
			this.children[i].getLights(lights);
		}
	}
	return lights;
}


/**
* Adds a new object to this group
* @param {object} object the object to add to this group
*/
GLGE.Group.prototype.addChild=function(object){
	if(object.parent) object.parent.removeChild(object);
	object.matrix=null; //clear any cache
	object.parent=this;
	this.children.push(object);
	return this;
}
GLGE.Group.prototype.addObject=GLGE.Group.prototype.addChild;
GLGE.Group.prototype.addObjectInstance=GLGE.Group.prototype.addChild;
GLGE.Group.prototype.addGroup=GLGE.Group.prototype.addChild;
GLGE.Group.prototype.addText=GLGE.Group.prototype.addChild;
GLGE.Group.prototype.addSkeleton=GLGE.Group.prototype.addChild;
GLGE.Group.prototype.addLight=GLGE.Group.prototype.addChild;
GLGE.Group.prototype.addCamera=GLGE.Group.prototype.addChild;
GLGE.Group.prototype.addWavefront=GLGE.Group.prototype.addChild;
/**
* Removes an object or sub group from this group
* @param {object} object the item to remove
*/
GLGE.Group.prototype.removeChild=function(object){
	for(var i=0;i<this.children.length;i++){
		if(this.children[i]==object){
			this.children.splice(i, 1);
			if(this.scene && this.scene["remove"+object.className]){
				this.scene["remove"+object.className](object);
			}
			break;
		}
	}
}
/**
* Gets an array of all children in this group
*/
GLGE.Group.prototype.getChildren=function(){
	return this.children;
}
/**
* Initiallize all the GL stuff needed to render to screen
* @private
*/
GLGE.Group.prototype.GLInit=function(gl){
	this.gl=gl;
	for(var i=0;i<this.children.length;i++){
		if(this.children[i].GLInit){
			this.children[i].GLInit(gl);
		}
	}
}
/**
* Renders the group to the render buffer
* @private
*/
GLGE.Group.prototype.GLRender=function(gl,renderType){
	//animate this object
	if(renderType==GLGE.RENDER_DEFAULT){
		if(this.animation) this.animate();
	}
	if(!this.gl){
		this.GLInit(gl);
	}
	for(var i=0;i<this.children.length;i++){
		if(this.children[i].GLRender){
			this.children[i].GLRender(gl,renderType);
		}
	}
}


closure_export();
 
/**
* @class Class defining a channel of animation for an action
* @param {string} uid a unique reference string for this object
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.ActionChannel=function(uid){
	GLGE.Assets.registerAsset(this,uid);
}
GLGE.augment(GLGE.QuickNotation,GLGE.ActionChannel);
GLGE.augment(GLGE.JSONLoader,GLGE.ActionChannel);
/**
* Sets the name/object of the bone channel
* @param {string} name the name of the bone channel
*/
GLGE.ActionChannel.prototype.setTarget=function(object){
	this.target=object;
};
/**
* Sets the animation for this channel
* @param {GLGE.AnimationVector} animation the animation vector for this channel
*/
GLGE.ActionChannel.prototype.setAnimation=function(animation){
	this.animation=animation;
};
/**
* Gets the name/object of the bone channel
* @returns {string} the name of the bone channel
*/
GLGE.ActionChannel.prototype.getTarget=function(){
	return this.target;
};
/**
* Gets the animation vector for this channel
* @returns {GLGE.AnimationVector} the animation vector for this channel
*/
GLGE.ActionChannel.prototype.getAnimation=function(){
	return this.animation;
};

/**
* @class Class to describe and action on a skeleton
* @param {string} uid a unique reference string for this object
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.Action=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.channels=[];
};
GLGE.augment(GLGE.QuickNotation,GLGE.Action);
GLGE.augment(GLGE.JSONLoader,GLGE.Action);
/**
 * @name Action#animFinished
 * @event
 * @param {object} data
 */
GLGE.augment(GLGE.Events,GLGE.Action);

/**
* Starts playing the action
*/
GLGE.Action.prototype.start=function(blendTime,loop,names){
	if(!loop) loop=false;
	if(!blendTime) blendTime=0;
	var channels=this.channels;
	var start=(new Date()).getTime();
	this.animFinished=false;
	
	for(var i=0;i<channels.length;i++){
		var animation=channels[i].getAnimation();
		var action=this;
		var channel=channels[i];
		var target=channel.getTarget();
		if(typeof target=="string"){
			if(names && names[target]){
				target=names[target];
			}
		}
		var closure={};
		closure.finishEvent=function(data){
			target.removeEventListener("animFinished",closure.finishEvent);
			if(!action.animFinished && target.animation==animation){
				action.fireEvent("animFinished",{});
				action.animFinished=true;
			}
		}
		target.addEventListener("animFinished",closure.finishEvent);
		
		target.setAnimation(animation,blendTime,start);
		target.setLoop(loop);

	}
};
/**
* Adds and action channel to this action
* @param {GLGE.ActionChannel} channel the channel to be added
*/
GLGE.Action.prototype.addActionChannel=function(channel){
	this.channels.push(channel);
	return this;
};
/**
* Removes and action channel to this action
* @param {GLGE.ActionChannel} channel the channel to be removed
*/
GLGE.Action.prototype.removeActionChannel=function(channel){
	for(var i=0;i<this.channels.length;i++){
		if(this.channels[i]==channels){
			this.channels.splice(i,1);
			break;
		}
	}
};



/**
* @class Text that can be rendered in a scene
* @augments GLGE.Animatable
* @augments GLGE.Placeable
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.Text=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.canvas=document.createElement("canvas");
	this.color={r:1.0,g:1.0,b:1.0};
}
GLGE.augment(GLGE.Placeable,GLGE.Text);
GLGE.augment(GLGE.Animatable,GLGE.Text);
GLGE.augment(GLGE.QuickNotation,GLGE.Text);
GLGE.augment(GLGE.JSONLoader,GLGE.Text);
GLGE.Text.prototype.className="Text";
GLGE.Text.prototype.zTrans=true;
GLGE.Text.prototype.canvas=null;
GLGE.Text.prototype.aspect=1.0;
GLGE.Text.prototype.color=null;
GLGE.Text.prototype.text="";
GLGE.Text.prototype.font="Times";
GLGE.Text.prototype.size=100;
GLGE.Text.prototype.pickType=GLGE.TEXT_TEXTPICK;

/**
* Gets the pick type for this text
* @returns {string} the pick type
*/
GLGE.Text.prototype.getPickType=function(){
	return this.pickType;
};
/**
* Sets the pick type GLGE.TEXT_BOXPICK for picking based on bound box or GLGE.TEXT_TEXTPICK for pixel perfect text picking
* @param {Number} value the picking type
*/
GLGE.Text.prototype.setPickType=function(value){
	this.pickType=value;
	return this;
};
/**
* Gets the font of the text
* @returns {string} the font of the text
*/
GLGE.Text.prototype.getFont=function(){
	return this.size;
};
/**
* Sets the font of the text
* @param {Number} value the font of the text
*/
GLGE.Text.prototype.setFont=function(value){
	this.font=value;
	if(this.gl) this.updateCanvas(this.gl);
	return this;
};
/**
* Gets the size of the text
* @returns {string} the size of the text
*/
GLGE.Text.prototype.getSize=function(){
	return this.size;
};
/**
* Sets the size of the text
* @param {Number} value the size of the text
*/
GLGE.Text.prototype.setSize=function(value){
	this.size=value;
	if(this.gl) this.updateCanvas(this.gl);
	return this;
};
/**
* Gets the rendered text
* @returns {string} the text rendered
*/
GLGE.Text.prototype.getText=function(){
	return this.text;
};
/**
* Sets the text to be rendered
* @param {Number} value the text to render
*/
GLGE.Text.prototype.setText=function(value){
	this.text=value;
	if(this.gl) this.updateCanvas(this.gl);
	return this;
};
/**
* Sets the base colour of the text
* @param {string} color The colour of the material
*/
GLGE.Text.prototype.setColor=function(color){
	color=GLGE.colorParse(color);
	this.color={r:color.r,g:color.g,b:color.b};
	return this;
};
/**
* Sets the red base colour of the text
* @param {Number} r The new red level 0-1
*/
GLGE.Text.prototype.setColorR=function(value){
	this.color.r=value;
	return this;
};
/**
* Sets the green base colour of the text
* @param {Number} g The new green level 0-1
*/
GLGE.Text.prototype.setColorG=function(value){
	this.color.g=value;
	return this;
};
/**
* Sets the blue base colour of the text
* @param {Number} b The new blue level 0-1
*/
GLGE.Text.prototype.setColorB=function(value){
	this.color.b=value;
	return this;
};
/**
* Gets the current base color of the text
* @return {[r,g,b]} The current base color
*/
GLGE.Text.prototype.getColor=function(){
	return this.color;
	return this;
};

/**
* Sets the Z Transparency of this text
* @param {boolean} value Does this object need blending?
*/
GLGE.Text.prototype.setZtransparent=function(value){
	this.zTrans=value;
	return this;
}
/**
* Gets the z transparency
* @returns boolean
*/
GLGE.Text.prototype.isZtransparent=function(){
	return this.zTrans;
}
/**
* Creates the shader program for the object
* @private
*/
GLGE.Text.prototype.GLGenerateShader=function(gl){
	if(this.GLShaderProgram) gl.deleteProgram(this.GLShaderProgram);

	//Vertex Shader
	var vertexStr="";
	vertexStr+="attribute vec3 position;\n";
	vertexStr+="attribute vec2 uvcoord;\n";
	vertexStr+="varying vec2 texcoord;\n";
	vertexStr+="uniform mat4 Matrix;\n";
	vertexStr+="uniform mat4 PMatrix;\n";
	vertexStr+="varying vec4 pos;\n";
	
	vertexStr+="void main(void){\n";
	vertexStr+="texcoord=uvcoord;\n";    
	vertexStr+="pos = Matrix * vec4(position,1.0);\n";
	vertexStr+="gl_Position = PMatrix * pos;\n";
	vertexStr+="}\n";
	
	//Fragment Shader
	var fragStr="#ifdef GL_ES\nprecision highp float;\n#endif\n";
	fragStr=fragStr+"uniform sampler2D TEXTURE;\n";
	fragStr=fragStr+"varying vec2 texcoord;\n";
	fragStr=fragStr+"varying vec4 pos;\n";
	fragStr=fragStr+"uniform float far;\n";
	fragStr=fragStr+"uniform int picktype;\n";
	fragStr=fragStr+"uniform vec3 pickcolor;\n";
	fragStr=fragStr+"uniform vec3 color;\n";
	fragStr=fragStr+"void main(void){\n";
	fragStr=fragStr+"float alpha=texture2D(TEXTURE,texcoord).a;\n";
	fragStr=fragStr+"if(picktype=="+GLGE.TEXT_BOXPICK+"){gl_FragColor = vec4(pickcolor,1.0);}"
	fragStr=fragStr+"else if(picktype=="+GLGE.TEXT_TEXTPICK+"){gl_FragColor = vec4(pickcolor,alpha);}"
	fragStr=fragStr+"else{gl_FragColor = vec4(color.rgb*alpha,alpha);};\n";
	fragStr=fragStr+"}\n";
	
	this.GLFragmentShader=gl.createShader(gl.FRAGMENT_SHADER);
	this.GLVertexShader=gl.createShader(gl.VERTEX_SHADER);


	gl.shaderSource(this.GLFragmentShader, fragStr);
	gl.compileShader(this.GLFragmentShader);
	if (!gl.getShaderParameter(this.GLFragmentShader, gl.COMPILE_STATUS)) {
	      GLGE.error(gl.getShaderInfoLog(this.GLFragmentShader));
	      return;
	}
	
	//set and compile the vertex shader
	//need to set str
	gl.shaderSource(this.GLVertexShader, vertexStr);
	gl.compileShader(this.GLVertexShader);
	if (!gl.getShaderParameter(this.GLVertexShader, gl.COMPILE_STATUS)) {
		GLGE.error(gl.getShaderInfoLog(this.GLVertexShader));
		return;
	}
	
	this.GLShaderProgram = gl.createProgram();
	gl.attachShader(this.GLShaderProgram, this.GLVertexShader);
	gl.attachShader(this.GLShaderProgram, this.GLFragmentShader);
	gl.linkProgram(this.GLShaderProgram);	
}
/**
* Initiallize all the GL stuff needed to render to screen
* @private
*/
GLGE.Text.prototype.GLInit=function(gl){
	this.gl=gl;
	this.createPlane(gl);
	this.GLGenerateShader(gl);
	
	this.glTexture=gl.createTexture();
	this.updateCanvas(gl);
}
/**
* Updates the canvas texture
* @private
*/
GLGE.Text.prototype.updateCanvas=function(gl){
	var canvas = this.canvas;
	canvas.width=1;
	canvas.height=this.size*1.2;
	var ctx = canvas.getContext("2d");
	ctx.font = this.size+"px "+this.font;
	canvas.width=ctx.measureText(this.text).width;
	canvas.height=this.size*1.2;
	 ctx = canvas.getContext("2d");
	ctx.textBaseline="top";
	ctx.font = this.size+"px "+this.font;
	this.aspect=canvas.width/canvas.height;
	ctx.fillText(this.text, 0, 0);   
	
	gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
	//TODO: fix this when minefield is upto spec
	try{gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);}
	catch(e){gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas,null);}
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.generateMipmap(gl.TEXTURE_2D);
	gl.bindTexture(gl.TEXTURE_2D, null);
}

/**
* Renders the text to the render buffer
* @private
*/
GLGE.Text.prototype.GLRender=function(gl,renderType,pickindex){
	if(!this.gl){
		this.GLInit(gl);
	}
	if(renderType==GLGE.RENDER_DEFAULT || renderType==GLGE.RENDER_PICK){	
		//if look at is set then look
		if(this.lookAt) this.Lookat(this.lookAt);
		
		gl.useProgram(this.GLShaderProgram);

		var attribslot;
		//disable all the attribute initially arrays - do I really need this?
		for(var i=0; i<8; i++) gl.disableVertexAttribArray(i);
		attribslot=GLGE.getAttribLocation(gl,this.GLShaderProgram, "position");

		gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
		gl.enableVertexAttribArray(attribslot);
		gl.vertexAttribPointer(attribslot, this.posBuffer.itemSize, gl.FLOAT, false, 0, 0);
		
		attribslot=GLGE.getAttribLocation(gl,this.GLShaderProgram, "uvcoord");
		gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
		gl.enableVertexAttribArray(attribslot);
		gl.vertexAttribPointer(attribslot, this.uvBuffer.itemSize, gl.FLOAT, false, 0, 0);
		
		gl.activeTexture(gl["TEXTURE0"]);
		gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
		gl.uniform1i(GLGE.getUniformLocation(gl,this.GLShaderProgram, "TEXTURE"), 0);	
		
		if(!pickindex) pickindex=0;
		var b = pickindex >> 16 & 0xFF; 
		var g = pickindex >> 8 & 0xFF; 
		var r = pickindex & 0xFF;
		gl.uniform3f(GLGE.getUniformLocation(gl,this.GLShaderProgram, "pickcolor"), r/255,g/255,b/255);
			
		if(renderType==GLGE.RENDER_PICK){
			gl.uniform1i(GLGE.getUniformLocation(gl,this.GLShaderProgram, "picktype"), this.pickType);	
		}else{
			gl.uniform1i(GLGE.getUniformLocation(gl,this.GLShaderProgram, "picktype"), 0);	
		}
		
		if(!this.GLShaderProgram.glarrays) this.GLShaderProgram.glarrays={};

		
		//generate and set the modelView matrix
		var scalefactor=this.size/100;
		var mMatrix=GLGE.mulMat4(gl.scene.camera.getViewMatrix(),GLGE.mulMat4(this.getModelMatrix(),GLGE.scaleMatrix(this.aspect*scalefactor,scalefactor,scalefactor)));
		var mUniform = GLGE.getUniformLocation(gl,this.GLShaderProgram, "Matrix");
		if(!this.GLShaderProgram.glarrays.mMatrix) this.GLShaderProgram.glarrays.mMatrix=new Float32Array(mMatrix);
			else GLGE.mat4gl(mMatrix,this.GLShaderProgram.glarrays.mMatrix);
		gl.uniformMatrix4fv(mUniform, true, this.GLShaderProgram.glarrays.mMatrix);
		
		var mUniform = GLGE.getUniformLocation(gl,this.GLShaderProgram, "PMatrix");

		if(!this.GLShaderProgram.glarrays.pMatrix) this.GLShaderProgram.glarrays.pMatrix=new Float32Array(gl.scene.camera.getProjectionMatrix());
			else GLGE.mat4gl(gl.scene.camera.getProjectionMatrix(),this.GLShaderProgram.glarrays.pMatrix);
		gl.uniformMatrix4fv(mUniform, true, this.GLShaderProgram.glarrays.pMatrix);

		
		var farUniform = GLGE.getUniformLocation(gl,this.GLShaderProgram, "far");
		gl.uniform1f(farUniform, gl.scene.camera.getFar());
		//set the color
		gl.uniform3f(GLGE.getUniformLocation(gl,this.GLShaderProgram, "color"), this.color.r,this.color.g,this.color.b);
		
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.GLfaces);
		gl.drawElements(gl.TRIANGLES, this.GLfaces.numItems, gl.UNSIGNED_SHORT, 0);
	}
}
/**
* creates the plane mesh to draw
* @private
*/
GLGE.Text.prototype.createPlane=function(gl){
	//create the vertex positions
	if(!this.posBuffer) this.posBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([1,1,0,-1,1,0,-1,-1,0,1,-1,0]), gl.STATIC_DRAW);
	this.posBuffer.itemSize = 3;
	this.posBuffer.numItems = 4;
	//create the vertex uv coords
	if(!this.uvBuffer) this.uvBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0,1,0,1,1,0,1]), gl.STATIC_DRAW);
	this.uvBuffer.itemSize = 2;
	this.uvBuffer.numItems = 4;
	//create the faces
	if(!this.GLfaces) this.GLfaces = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.GLfaces);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,2,3,0]), gl.STATIC_DRAW);
	this.GLfaces.itemSize = 1;
	this.GLfaces.numItems = 6;
}



/**
* @class Creates a new load for a multimaterial
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.ObjectLod=function(uid){
	GLGE.Assets.registerAsset(this,uid);
}
GLGE.augment(GLGE.QuickNotation,GLGE.ObjectLod);
GLGE.augment(GLGE.JSONLoader,GLGE.ObjectLod);
GLGE.ObjectLod.prototype.mesh=null;
GLGE.ObjectLod.prototype.className="ObjectLod";
GLGE.ObjectLod.prototype.material=null;
GLGE.ObjectLod.prototype.program=null;
GLGE.ObjectLod.prototype.GLShaderProgramPick=null;
GLGE.ObjectLod.prototype.GLShaderProgramShadow=null;
GLGE.ObjectLod.prototype.GLShaderProgram=null;
GLGE.ObjectLod.prototype.pixelSize=0;

/**
* sets the mesh
* @param {GLGE.Mesh} mesh 
*/
GLGE.ObjectLod.prototype.setMesh=function(mesh){
	if(typeof mesh=="string")  mesh=GLGE.Assets.get(mesh);
	
	//remove event listener from current material
	if(this.mesh){
		this.mesh.removeEventListener("shaderupdate",this.meshupdated);
	}
	var multiMaterial=this;
	this.meshupdated=function(event){
		multiMaterial.GLShaderProgram=null;
	};
	//set event listener for new material
	mesh.addEventListener("shaderupdate",this.meshupdated);
	
	this.GLShaderProgram=null;
	this.mesh=mesh;
	return this;
}
/**
* gets the mesh
* @returns {GLGE.Mesh}
*/
GLGE.ObjectLod.prototype.getMesh=function(){
	return this.mesh;
}
/**
* sets the material
* @param {GLGE.Material} material 
*/
GLGE.ObjectLod.prototype.setMaterial=function(material){
	if(typeof material=="string")  material=GLGE.Assets.get(material);
	
	//remove event listener from current material
	if(this.material){
		this.material.removeEventListener("shaderupdate",this.materialupdated);
	}
	var ObjectLOD=this;
	this.materialupdated=function(event){
		ObjectLOD.GLShaderProgram=null;
	};
	//set event listener for new material
	material.addEventListener("shaderupdate",this.materialupdated);
	
	this.GLShaderProgram=null;
	this.material=material;
	return this;
}
/**
* gets the material
* @returns {GLGE.Material}
*/
GLGE.ObjectLod.prototype.getMaterial=function(){
	return this.material;
}

/**
* gets the pixelsize limit for this lod
* @returns {number}
*/
GLGE.ObjectLod.prototype.getPixelSize=function(){
	return this.pixelSize;
}
/**
* sets the pixelsize limit for this lod
* @returns {number}
*/
GLGE.ObjectLod.prototype.setPixelSize=function(value){
	this.pixelSize=parseFloat(value);
}


/**
* @class Creates a new mesh/material to add to an object
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.MultiMaterial=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.lods=[new GLGE.ObjectLod]
}
GLGE.augment(GLGE.QuickNotation,GLGE.MultiMaterial);
GLGE.augment(GLGE.JSONLoader,GLGE.MultiMaterial);
GLGE.MultiMaterial.prototype.className="MultiMaterial";
/**
* sets the mesh
* @param {GLGE.Mesh} mesh 
*/
GLGE.MultiMaterial.prototype.setMesh=function(mesh){
	this.lods[0].setMesh(mesh);
	return this;
}
/**
* gets the mesh
* @returns {GLGE.Mesh}
*/
GLGE.MultiMaterial.prototype.getMesh=function(){
	return this.lods[0].getMesh();
}
/**
* sets the material
* @param {GLGE.Material} material 
*/
GLGE.MultiMaterial.prototype.setMaterial=function(material){
	this.lods[0].setMaterial(material);
	return this;
}
/**
* gets the material
* @returns {GLGE.Material}
*/
GLGE.MultiMaterial.prototype.getMaterial=function(){
	return this.lods[0].getMaterial();
}

/**
* returns the load for a given pixel size
* @param {number} pixelsize the current pixel size of the object
* @returns {GLGE.ObjectLod}
*/
GLGE.MultiMaterial.prototype.getLOD=function(pixelsize){
	var currentSize=0;
	var currentLOD=this.lods[0];
	if(this.lods.length>1){
		for(var i=1; i<this.lods.length;i++){
			var size=this.lods[i].pixelSize;
			if(size>currentSize && size<pixelsize && this.lods[i].mesh && this.lods[i].mesh.loaded){
				currentSize=size;
				currentLOD=this.lods[i];
			}
		}
	}
	return currentLOD;
}

/**
* adds a lod to this multimaterial
* @param {GLGE.ObjectLod} lod the lod to add
*/
GLGE.MultiMaterial.prototype.addObjectLod=function(lod){
	this.lods.push(lod);
	return this;
}

/**
* removes a lod to this multimaterial
* @param {GLGE.ObjectLod} lod the lod to remove
*/
GLGE.MultiMaterial.prototype.removeObjectLod=function(lod){
	var idx=this.lods.indexOf(lod);
	if(idx) this.lods.splice(idx,1);
	return this;
}



/**
* @class An additional instance of an object that can be rendered in a scene
* @augments GLGE.Animatable
* @augments GLGE.Placeable
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.ObjectInstance=function(uid){
	GLGE.Assets.registerAsset(this,uid);
}
GLGE.augment(GLGE.Placeable,GLGE.ObjectInstance);
GLGE.augment(GLGE.Animatable,GLGE.ObjectInstance);
GLGE.augment(GLGE.QuickNotation,GLGE.ObjectInstance);
GLGE.augment(GLGE.JSONLoader,GLGE.ObjectInstance);
GLGE.ObjectInstance.prototype.parentObject=null;
GLGE.ObjectInstance.prototype.className="ObjectInstance";
/**
* Sets the parent object to instance
* @param {GLGE.Object} value the object to instance
*/
GLGE.ObjectInstance.prototype.setObject=function(value){
	if(this.parentObject) this.parentObject.removeInstance(this);
	this.parentObject=value;
	value.addInstance(this);
	return this;
}
/**
* Gets the Object being instanced
* @returns boolean
*/
GLGE.ObjectInstance.prototype.getObject=function(){
	return this.parentObject;
}




/**
* @class An object that can be rendered in a scene
* @augments GLGE.Animatable
* @augments GLGE.Placeable
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.Object=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.multimaterials=[];
	this.instances=[];
}
GLGE.augment(GLGE.Placeable,GLGE.Object);
GLGE.augment(GLGE.Animatable,GLGE.Object);
GLGE.augment(GLGE.QuickNotation,GLGE.Object);
GLGE.augment(GLGE.JSONLoader,GLGE.Object);
GLGE.Object.prototype.className="Object";
GLGE.Object.prototype.mesh=null;
GLGE.Object.prototype.skeleton=null;
GLGE.Object.prototype.scene=null;
GLGE.Object.prototype.transformMatrix=GLGE.identMatrix();
GLGE.Object.prototype.material=null;
GLGE.Object.prototype.gl=null;
GLGE.Object.prototype.multimaterials=null;
GLGE.Object.prototype.instances=null;
GLGE.Object.prototype.zTrans=false;
GLGE.Object.prototype.id="";
GLGE.Object.prototype.pickable=true;
GLGE.Object.prototype.drawType=GLGE.DRAW_TRIS;
GLGE.Object.prototype.pointSize=1;

//shadow fragment
var shfragStr=[];
shfragStr.push("#ifdef GL_ES\nprecision highp float;\n#endif\n");
shfragStr.push("void main(void)\n");
shfragStr.push("{\n");
shfragStr.push("vec4 rgba=fract((gl_FragCoord.z/gl_FragCoord.w)/10000.0 * vec4(16777216.0, 65536.0, 256.0, 1.0));\n");
shfragStr.push("gl_FragColor=rgba-rgba.rrgb*vec4(0.0,0.00390625,0.00390625,0.00390625);\n");
shfragStr.push("}\n");
GLGE.Object.prototype.shfragStr=shfragStr.join("");

//normal fragment
var nfragStr=[];
nfragStr.push("#ifdef GL_ES\nprecision highp float;\n#endif\n");
nfragStr.push("varying vec3 n;\n");
nfragStr.push("void main(void)\n");
nfragStr.push("{\n");
nfragStr.push("gl_FragColor=vec4(n,1.0);\n");
nfragStr.push("}\n");
GLGE.Object.prototype.nfragStr=nfragStr.join("");

//picking fragment
var pkfragStr=[];
pkfragStr.push("#ifdef GL_ES\nprecision highp float;\n#endif\n");
pkfragStr.push("uniform float far;\n");
pkfragStr.push("uniform vec3 pickcolor;\n");
pkfragStr.push("varying vec3 n;\n");
pkfragStr.push("varying vec4 UVCoord;\n");
pkfragStr.push("void main(void)\n");
pkfragStr.push("{\n");
pkfragStr.push("float Xcoord = gl_FragCoord.x+0.5;\n");
pkfragStr.push("if(Xcoord>0.0) gl_FragColor = vec4(pickcolor,1.0);\n");
pkfragStr.push("if(Xcoord>1.0) gl_FragColor = vec4(n,1.0);\n");
pkfragStr.push("if(Xcoord>2.0){");	
pkfragStr.push("vec3 rgb=fract((gl_FragCoord.z/gl_FragCoord.w) * vec3(65536.0, 256.0, 1.0));\n");
pkfragStr.push("gl_FragColor=vec4(rgb-rgb.rrg*vec3(0.0,0.00390625,0.00390625),1.0);\n");
pkfragStr.push("}");
//x tex coord
pkfragStr.push("if(Xcoord>3.0){");	
pkfragStr.push("vec3 rgb=fract(UVCoord.x * vec3(65536.0, 256.0, 1.0));\n");
pkfragStr.push("gl_FragColor=vec4(rgb-rgb.rrg*vec3(0.0,0.00390625,0.00390625),1.0);\n");
pkfragStr.push("}");
//y tex coord
pkfragStr.push("if(Xcoord>4.0){");	
pkfragStr.push("vec3 rgb=fract(UVCoord.y * vec3(65536.0, 256.0, 1.0));\n");
pkfragStr.push("gl_FragColor=vec4(rgb-rgb.rrg*vec3(0.0,0.00390625,0.00390625),1.0);\n");
pkfragStr.push("}");
pkfragStr.push("}\n");
GLGE.Object.prototype.pkfragStr=pkfragStr.join("");


/**
* Gets the objects draw type
*/
GLGE.Object.prototype.getDrawType=function(){
	return this.drawType;
}
/**
* Sets the objects draw type
* @param {GLGE.number} value the draw type of this object
*/
GLGE.Object.prototype.setDrawType=function(value){
	this.drawType=value;
	return this;
}

/**
* Gets the objects draw point size
*/
GLGE.Object.prototype.getPointSize=function(){
	return this.pointSize;
}
/**
* Sets the objects draw points size
* @param {GLGE.number} value the point size to render
*/
GLGE.Object.prototype.setPointSize=function(value){
	this.pointSize=parseFloat(value);
	return this;
}


/**
* Gets the objects skeleton
* @returns GLGE.Group
*/
GLGE.Object.prototype.getSkeleton=function(){
	return this.skeleton;
}
/**
* Sets the objects skeleton
* @param {GLGE.Group} value the skeleton group to set
*/
GLGE.Object.prototype.setSkeleton=function(value){
	this.skeleton=value;
	this.bones=value.getNames();
	return this;
}

GLGE.Object.prototype.getBoundingVolume=function(){
	var multimaterials=this.multimaterials;
	this.boundingVolume=new GLGE.BoundingVolume(0,0,0,0,0,0);
	for(var i=0;i<multimaterials.length;i++){
		this.boundingVolume.addBoundingVolume(multimaterials[i].lods[0].mesh.getBoundingVolume());
	}
	this.boundingVolume.applyMatrixScale(this.getModelMatrix());

	return this.boundingVolume;
}

/**
* Sets the Z Transparency of this object
* @param {boolean} value Does this object need blending?
*/
GLGE.Object.prototype.setZtransparent=function(value){
	this.zTrans=value;
	return this;
}
/**
* Gets the z transparency
* @returns boolean
*/
GLGE.Object.prototype.isZtransparent=function(){
	return this.zTrans;
}

/**
* Adds a new instance of this object
* @param {GLGE.ObjectInstance} value the instance to add
*/
GLGE.Object.prototype.addInstance=function(value){
	this.instances.push(value);
	return this;
}

/**
* Removes an instance of this object
* @param {GLGE.ObjectInstance} value the instance to remove
*/
GLGE.Object.prototype.removeInstance=function(value){
	for(var i=0; i<this.instances;i++){
		if(this.instance==value) this.instances.splice(i);
	}
}

/**
* Sets the material associated with the object
* @param GLGE.Material
*/
GLGE.Object.prototype.setMaterial=function(material,idx){
	if(typeof material=="string")  material=GLGE.Assets.get(material);
	if(!idx) idx=0;
	if(!this.multimaterials[idx]) this.multimaterials[idx]=new GLGE.MultiMaterial();
	if(this.multimaterials[idx].getMaterial()!=material){
		this.multimaterials[idx].setMaterial(material);
		this.updateProgram();
	}
	return this;
}
/**
* Gets the material associated with the object
* @returns GLGE.Material
*/
GLGE.Object.prototype.getMaterial=function(idx){
	if(!idx) idx=0;
	if(this.multimaterials[idx]) {
		return this.multimaterials[idx].getMaterial();
	}else{
		return false;
	}
}
/**
* Sets the mesh associated with the object
* @param GLGE.Mesh
*/
GLGE.Object.prototype.setMesh=function(mesh,idx){
	if(typeof mesh=="string")  mesh=GLGE.Assets.get(mesh);
	if(!idx) idx=0;
	if(!this.multimaterials[idx]) this.multimaterials.push(new GLGE.MultiMaterial());
	this.multimaterials[idx].setMesh(mesh);
	return this;
}
/**
* Gets the mesh associated with the object
* @returns GLGE.Mesh
*/
GLGE.Object.prototype.getMesh=function(idx){
	if(!idx) idx=0;
	if(this.multimaterials[idx]) {
		this.multimaterials[idx].getMesh();
	}else{
		return false;
	}
}
/**
* Initiallize all the GL stuff needed to render to screen
* @private
*/
GLGE.Object.prototype.GLInit=function(gl){
	this.gl=gl;
}
/**
* Cleans up all the GL stuff we sets
* @private
*/
GLGE.Object.prototype.GLDestory=function(gl){
}
/**
* Updates the GL shader program for the object
* @private
*/
GLGE.Object.prototype.updateProgram=function(){
	for(var i=0; i<this.multimaterials.length;i++){
		this.multimaterials[i].GLShaderProgram=null;
	}
}
/**
* Adds another material to this object
* @returns GLGE.Material
*/
GLGE.Object.prototype.addMultiMaterial=function(multimaterial){
	if(typeof multimaterial=="string")  multimaterial=GLGE.Assets.get(multimaterial);
	this.multimaterials.push(multimaterial);
}
/**
* gets all of the objects materials and meshes
* @returns array of GLGE.MultiMaterial objects
*/
GLGE.Object.prototype.getMultiMaterials=function(){
	return this.multimaterials;
}
/**
* Creates the shader program for the object
* @private
*/
GLGE.Object.prototype.GLGenerateShader=function(gl){
	//create the programs strings
	//Vertex Shader
	var UV=joints1=joints2=false;
	var lights=gl.lights;
	var vertexStr=[];
	var tangent=false;
	if(!this.mesh.normals) this.mesh.calcNormals();
	for(var i=0;i<this.mesh.buffers.length;i++){
		if(this.mesh.buffers[i].name=="tangent") tangent=true;
		if(this.mesh.buffers[i].size>1){
			vertexStr.push("attribute vec"+this.mesh.buffers[i].size+" "+this.mesh.buffers[i].name+";\n");
		}else{
			vertexStr.push("attribute float "+this.mesh.buffers[i].name+";\n");
		}
		if(this.mesh.buffers[i].name=="UV") UV=true;
		if(this.mesh.buffers[i].name=="joints1") joints1=this.mesh.buffers[i];
		if(this.mesh.buffers[i].name=="joints2") joints2=this.mesh.buffers[i];
	}
	vertexStr.push("uniform mat4 worldView;\n");
	vertexStr.push("uniform mat4 projection;\n");  
	vertexStr.push("uniform mat4 view;\n");  
	vertexStr.push("uniform mat4 worldInverseTranspose;\n");
	vertexStr.push("uniform mat4 envMat;\n");

	for(var i=0; i<lights.length;i++){
			vertexStr.push("uniform vec3 lightpos"+i+";\n");
			vertexStr.push("uniform vec3 lightdir"+i+";\n");
			vertexStr.push("uniform mat4 lightmat"+i+";\n");
			vertexStr.push("varying vec4 spotcoord"+i+";\n");
	}
	
	vertexStr.push("varying vec3 eyevec;\n"); 
	for(var i=0; i<lights.length;i++){
			vertexStr.push("varying vec3 lightvec"+i+";\n"); 
			vertexStr.push("varying vec3 tlightvec"+i+";\n"); 
			vertexStr.push("varying float lightdist"+i+";\n"); 
	}
	
	if(this.mesh.joints && this.mesh.joints.length>0){
		vertexStr.push("uniform mat4 jointMat["+(this.mesh.joints.length)+"];\n"); 
		vertexStr.push("uniform mat4 jointNMat["+(this.mesh.joints.length)+"];\n"); 
	}
	
	if(this.material) vertexStr.push(this.material.getVertexVarying(vertexStr));
    
	vertexStr.push("varying vec3 n;\n");  
	vertexStr.push("varying vec3 b;\n");  
	vertexStr.push("varying vec3 t;\n");  
	
	vertexStr.push("varying vec4 UVCoord;\n");
	vertexStr.push("varying vec3 OBJCoord;\n");
	vertexStr.push("varying vec3 tang;\n");
	vertexStr.push("varying vec3 teyevec;\n");
	
	vertexStr.push("void main(void)\n");
	vertexStr.push("{\n");
	if(UV) vertexStr.push("UVCoord=UV;\n");
	vertexStr.push("OBJCoord = position;\n");
	vertexStr.push("vec4 pos = vec4(0.0, 0.0, 0.0, 1.0);\n");
	vertexStr.push("vec4 norm = vec4(0.0, 0.0, 0.0, 1.0);\n");
	vertexStr.push("vec4 tang4 = vec4(0.0, 0.0, 0.0, 1.0);\n");
	
	if(joints1){
		if(joints1.size==1){
			vertexStr.push("pos += jointMat[int(joints1)]*vec4(position,1.0)*weights1;\n");
			vertexStr.push("norm += jointNMat[int(joints1)]*vec4(normal,1.0)*weights1;\n");  
			if(tangent) vertexStr.push("tang4 +=  jointNMat[int(joints1)]*vec4(tangent,1.0)*weights1;\n");
		}else{
			for(var i=0;i<joints1.size;i++){
				vertexStr.push("pos += jointMat[int(joints1["+i+"])]*vec4(position,1.0)*weights1["+i+"];\n");
				vertexStr.push("norm += jointNMat[int(joints1["+i+"])]*vec4(normal,1.0)*weights1["+i+"];\n");  
				if(tangent) vertexStr.push("tang4 +=  jointNMat[int(joints1["+i+"])]*vec4(tangent,1.0)*weights1["+i+"];\n");
			}
		}
		if(joints2){
			if(joints2.size==1){
				vertexStr.push("pos += jointMat[int(joints2)]*vec4(position,1.0)*weights2;\n");
				vertexStr.push("norm += jointNMat[int(joints2)]*vec4(normal,1.0)*weights2;\n");  
				if(tangent) vertexStr.push("tang4 +=  jointNMat[int(joints2)]*vec4(tangent,1.0)*weights2;\n");
			}else{
				for(var i=0;i<joints2.size;i++){
					vertexStr.push("pos += jointMat[int(joints2["+i+"])]*vec4(position,1.0)*weights2["+i+"];\n");
					vertexStr.push("norm += jointNMat[int(joints2["+i+"])]*vec4(normal,1.0)*weights2["+i+"];\n");  
					if(tangent) vertexStr.push("tang4 +=  jointNMat[int(joints2["+i+"])]*vec4(tangent,1.0)*weights2["+i+"];\n");
				}
			}
		}
		
		for(var i=0; i<lights.length;i++){
			vertexStr.push("spotcoord"+i+"=lightmat"+i+"*vec4(pos.xyz,1.0);\n");
		}
		vertexStr.push("pos = worldView * vec4(pos.xyz, 1.0);\n");
		vertexStr.push("norm = worldInverseTranspose * vec4(norm.xyz, 1.0);\n");
		if(tangent) vertexStr.push("tang = (worldInverseTranspose*vec4(tang4.xyz,1.0)).xyz;\n");
	}else{	
		for(var i=0; i<lights.length;i++){
			vertexStr.push("spotcoord"+i+"=lightmat"+i+"*vec4(position,1.0);\n");
		}
		vertexStr.push("pos = worldView * vec4(position, 1.0);\n");
		vertexStr.push("norm = worldInverseTranspose * vec4(normal, 1.0);\n");  
		if(tangent) vertexStr.push("tang = (worldInverseTranspose*vec4(tangent,1.0)).xyz;\n");
	}
    
	vertexStr.push("gl_Position = projection * pos;\n");
	vertexStr.push("gl_PointSize="+(this.pointSize.toFixed(5))+";\n");
	
	vertexStr.push("eyevec = -pos.xyz;\n");
	
	vertexStr.push("t = normalize(tang);");
	vertexStr.push("n = normalize(norm.rgb);");
	vertexStr.push("b = normalize(cross(n,t));");
	if(tangent){
		vertexStr.push("teyevec.x = dot(eyevec, t);");
		vertexStr.push("teyevec.y = dot(eyevec, b);");
		vertexStr.push("teyevec.z = dot(eyevec, n);");
	}else{
		vertexStr.push("teyevec = eyevec;");
	}
	
	for(var i=0; i<lights.length;i++){			
			if(lights[i].getType()==GLGE.L_DIR){
				vertexStr.push("vec3 tmplightvec"+i+" = -lightdir"+i+";\n");
			}else{
				vertexStr.push("vec3 tmplightvec"+i+" = -(lightpos"+i+"-pos.xyz);\n");
			}
			//tan space stuff
			if(tangent){
				vertexStr.push("tlightvec"+i+".x = dot(tmplightvec"+i+", t);");
				vertexStr.push("tlightvec"+i+".y = dot(tmplightvec"+i+", b);");
				vertexStr.push("tlightvec"+i+".z = dot(tmplightvec"+i+", n);");
				
			}else{
				vertexStr.push("tlightvec"+i+" = tmplightvec"+i+";");
			}
			vertexStr.push("lightvec"+i+" = tmplightvec"+i+";");

			
			vertexStr.push("lightdist"+i+" = length(lightpos"+i+".xyz-pos.xyz);\n");
	}
	if(this.material) vertexStr.push(this.material.getLayerCoords(vertexStr));
	vertexStr.push("}\n");
	
	vertexStr=vertexStr.join("");

	//Fragment Shader
	if(!this.material){
		var fragStr=[];
		fragStr.push("void main(void)\n");
		fragStr.push("{\n");
		fragStr.push("gl_FragColor = vec4(1.0,1.0,1.0,1.0);\n");
		fragStr.push("}\n");
		fragStr=fragStr.join("");
	}
	else
	{
		fragStr=this.material.getFragmentShader(lights);
	}
	
	this.GLFragmentShaderNormal=GLGE.getGLShader(gl,gl.FRAGMENT_SHADER,this.nfragStr);
	this.GLFragmentShaderShadow=GLGE.getGLShader(gl,gl.FRAGMENT_SHADER,this.shfragStr);
	this.GLFragmentShaderPick=GLGE.getGLShader(gl,gl.FRAGMENT_SHADER,this.pkfragStr);
	this.GLFragmentShader=GLGE.getGLShader(gl,gl.FRAGMENT_SHADER,fragStr);
	this.GLVertexShader=GLGE.getGLShader(gl,gl.VERTEX_SHADER,vertexStr);

	this.GLShaderProgramPick=GLGE.getGLProgram(gl,this.GLVertexShader,this.GLFragmentShaderPick);
	this.GLShaderProgramShadow=GLGE.getGLProgram(gl,this.GLVertexShader,this.GLFragmentShaderShadow);
	this.GLShaderProgramNormal=GLGE.getGLProgram(gl,this.GLVertexShader,this.GLFragmentShaderNormal);
	this.GLShaderProgram=GLGE.getGLProgram(gl,this.GLVertexShader,this.GLFragmentShader);
}
/**
* creates shader programs;
* @param multimaterial the multimaterial object to create the shader programs for
* @private
*/
GLGE.Object.prototype.createShaders=function(multimaterial){
	if(this.gl){
		this.mesh=multimaterial.mesh;
		this.material=multimaterial.material;
		this.GLGenerateShader(this.gl);
		multimaterial.GLShaderProgramPick=this.GLShaderProgramPick;
		multimaterial.GLShaderProgramShadow=this.GLShaderProgramShadow;
		multimaterial.GLShaderProgram=this.GLShaderProgram;
	}
}
/**
* Sets the shader program uniforms ready for rendering
* @private
*/
GLGE.Object.prototype.GLUniforms=function(gl,renderType,pickindex){
	var program;
	switch(renderType){
		case GLGE.RENDER_DEFAULT:
			program=this.GLShaderProgram;
			break;
		case GLGE.RENDER_SHADOW:
			program=this.GLShaderProgramShadow;
			break;
		case GLGE.RENDER_NORMAL:
			program=this.GLShaderProgramNormal;
			break;
		case GLGE.RENDER_PICK:
			program=this.GLShaderProgramPick;
			var b = pickindex >> 16 & 0xFF; 
			var g = pickindex >> 8 & 0xFF; 
			var r = pickindex & 0xFF;
			gl.uniform3f(GLGE.getUniformLocation(gl,program, "pickcolor"), r/255,g/255,b/255);
			break;
	}
	
	
	if(!program.caches) program.caches={};
	if(!program.glarrays) program.glarrays={};

	if(program.caches.far!=gl.scene.camera.far){
		gl.uniform1f(GLGE.getUniformLocation(gl,program, "far"), gl.scene.camera.far);
		program.caches.far=gl.scene.camera.far;
	}
	if(renderType==GLGE.RENDER_DEFAULT){
		if(program.caches.ambientColor!=gl.scene.ambientColor){
			gl.uniform3f(GLGE.getUniformLocation(gl,program, "amb"), gl.scene.ambientColor.r,gl.scene.ambientColor.g,gl.scene.ambientColor.b);
			program.caches.ambientColor=gl.scene.ambientColor;
		}
		if(program.caches.fogFar!=gl.scene.fogFar){
			gl.uniform1f(GLGE.getUniformLocation(gl,program, "fogfar"), gl.scene.fogFar);
			program.caches.fogFar=gl.scene.fogFar;
		}
		if(program.caches.fogNear!=gl.scene.fogNear){
			gl.uniform1f(GLGE.getUniformLocation(gl,program, "fognear"), gl.scene.fogNear);
			program.caches.fogNear=gl.scene.fogNear;
		}
		if(program.caches.fogType!=gl.scene.fogType){
			gl.uniform1i(GLGE.getUniformLocation(gl,program, "fogtype"), gl.scene.fogType);
			program.caches.fogType=gl.scene.fogType;
		}
		if(program.caches.fogType!=gl.scene.fogcolor){
			gl.uniform3f(GLGE.getUniformLocation(gl,program, "fogcolor"), gl.scene.fogColor.r,gl.scene.fogColor.g,gl.scene.fogColor.b);
			program.caches.fogcolor=gl.scene.fogcolor;
		}
	}

			
	
	var cameraMatrix=gl.scene.camera.getViewMatrix();
	var modelMatrix=this.getModelMatrix();
	if(!program.caches.mvMatrix) program.caches.mvMatrix={cameraMatrix:null,modelMatrix:null};
	var mvCache=program.caches.mvMatrix;
	
	if(mvCache.camerMatrix!=cameraMatrix || mvCache.modelMatrix!=modelMatrix){
		try{
		//generate and set the modelView matrix
		if(!this.caches.mvMatrix) this.caches.mvMatrix=GLGE.mulMat4(cameraMatrix,modelMatrix);
		mvMatrix=this.caches.mvMatrix;
					
		var mvUniform = GLGE.getUniformLocation(gl,program, "worldView");
		if(!program.glarrays.mvMatrix) program.glarrays.mvMatrix=new Float32Array(mvMatrix);
			else GLGE.mat4gl(mvMatrix,program.glarrays.mvMatrix);
		gl.uniformMatrix4fv(mvUniform, true, program.glarrays.mvMatrix);

	    
		//invCamera matrix
		if(!this.caches.envMat){
			var envMat = GLGE.inverseMat4(mvMatrix);
			envMat[3]=0;
			envMat[7]=0;
			envMat[11]=0;
			this.caches.envMat = envMat;
		}
		envMat=this.caches.envMat;
		var icUniform = GLGE.getUniformLocation(gl,program, "envMat");
		
		if(!program.glarrays.envMat) program.glarrays.envMat=new Float32Array(envMat);
			else GLGE.mat4gl(envMat,program.glarrays.envMat);	
		gl.uniformMatrix4fv(icUniform, true, program.glarrays.envMat);
	    
		//normalising matrix
		if(!this.caches.normalMatrix){
			var normalMatrix = GLGE.inverseMat4(mvMatrix);
			this.caches.normalMatrix = normalMatrix;
		}
		normalMatrix=this.caches.normalMatrix;
		var nUniform = GLGE.getUniformLocation(gl,program, "worldInverseTranspose");
		
		if(!program.glarrays.normalMatrix) program.glarrays.normalMatrix=new Float32Array(normalMatrix);
			else GLGE.mat4gl(normalMatrix,program.glarrays.normalMatrix);	
		gl.uniformMatrix4fv(nUniform, false, program.glarrays.normalMatrix);
		
		var cUniform = GLGE.getUniformLocation(gl,program, "view");
		if(!program.glarrays.cameraMatrix) program.glarrays.cameraMatrix=new Float32Array(cameraMatrix);
			else GLGE.mat4gl(cameraMatrix,program.glarrays.cameraMatrix);	
		gl.uniformMatrix4fv(cUniform, true, program.glarrays.cameraMatrix);
		
		mvCache.camerMatrix=cameraMatrix;
		mvCache.modelMatrix!=modelMatrix;
		}catch(e){}
	}
	
	try{
	var pUniform = GLGE.getUniformLocation(gl,program, "projection");
	if(!program.glarrays.pMatrix) program.glarrays.pMatrix=new Float32Array(gl.scene.camera.getProjectionMatrix());
			else GLGE.mat4gl(gl.scene.camera.getProjectionMatrix(),program.glarrays.pMatrix);	
	gl.uniformMatrix4fv(pUniform, true, program.glarrays.pMatrix);
	}catch(e){}
	
	//light
	//dont' need lighting for picking
	if(renderType==GLGE.RENDER_DEFAULT){
		var pos,lpos;
		var lights=gl.lights
		if(!program.caches.lights) program.caches.lights=[];
		if(!program.glarrays.lights) program.glarrays.lights=[];
		if(!this.caches.lights) this.caches.lights=[];
		var lightCache=program.caches.lights;
		for(var i=0; i<lights.length;i++){
			if(!lightCache[i]) lightCache[i]={modelMatrix:null,cameraMatrix:null};
			if(lightCache[i].modelMatrix!=modelMatrix || lightCache[i].cameraMatrix!=cameraMatrix){
				if(!this.caches.lights[i])this.caches.lights[i]={};
				
				if(!this.caches.lights[i].pos) this.caches.lights[i].pos=GLGE.mulMat4Vec4(GLGE.mulMat4(cameraMatrix,lights[i].getModelMatrix()),[0,0,0,1]);
				pos=this.caches.lights[i].pos;
				gl.uniform3f(GLGE.getUniformLocation(gl,program, "lightpos"+i), pos[0],pos[1],pos[2]);		
				
				
				if(!this.caches.lights[i].lpos) this.caches.lights[i].lpos=GLGE.mulMat4Vec4(GLGE.mulMat4(cameraMatrix,lights[i].getModelMatrix()),[0,0,1,1]);
				lpos=this.caches.lights[i].lpos;
				gl.uniform3f(GLGE.getUniformLocation(gl,program, "lightdir"+i),lpos[0]-pos[0],lpos[1]-pos[1],lpos[2]-pos[2]);
				
				if(lights[i].s_cache){
					try{
					var lightmat=GLGE.mulMat4(lights[i].s_cache.smatrix,modelMatrix);
					if(!program.glarrays.lights[i]) program.glarrays.lights[i]=new Float32Array(lightmat);
						else GLGE.mat4gl(lightmat,program.glarrays.lights[i]);
					gl.uniformMatrix4fv(GLGE.getUniformLocation(gl,program, "lightmat"+i), true,program.glarrays.lights[i]);
					lightCache[i].modelMatrix=modelMatrix;
					lightCache[i].cameraMatrix=cameraMatrix;
					}catch(e){}
				}else{
					lightCache[i].modelMatrix=modelMatrix;
					lightCache[i].cameraMatrix=cameraMatrix;
				}
			}
		}
	}
	
	if(this.mesh.joints){
		if(!program.caches.joints) program.caches.joints=[];
		if(!program.glarrays.joints) program.glarrays.joints=[];
		if(!program.glarrays.jointsinv) program.glarrays.jointsinv=[];
		var jointCache=program.caches.joints;
			var ident=GLGE.identMatrix();
			for(i=0;i<this.mesh.joints.length;i++){
			if(!jointCache[i]) jointCache[i]={modelMatrix:null,invBind:null};
			if(typeof this.mesh.joints[i]=="string"){
				if(this.bones){
					var modelMatrix=this.bones[this.mesh.joints[i]].getModelMatrix();
				}
			}else{
				var modelMatrix=this.mesh.joints[i].getModelMatrix();
			}
			var invBind=this.mesh.invBind[i];
			if(jointCache[i].modelMatrix!=modelMatrix || jointCache[i].invBind!=invBind){
				try{
						var jointmat=GLGE.mulMat4(modelMatrix,invBind);
						if(!program.glarrays.joints[i]) program.glarrays.joints[i]=new Float32Array(jointmat);
							else GLGE.mat4gl(jointmat,program.glarrays.joints[i]);		
						if(!program.glarrays.jointsinv[i]) program.glarrays.jointsinv[i]=new Float32Array(GLGE.inverseMat4(jointmat));
							else GLGE.mat4gl(GLGE.inverseMat4(jointmat),program.glarrays.jointsinv[i]);						
						gl.uniformMatrix4fv(GLGE.getUniformLocation(gl,program, "jointMat["+i+"]"), true,program.glarrays.joints[i]);
						gl.uniformMatrix4fv(GLGE.getUniformLocation(gl,program, "jointNMat["+i+"]"), false,program.glarrays.jointsinv[i]);
						jointCache[i].modelMatrix=modelMatrix;
						jointCache[i].invBind=invBind;
				}catch(e){}
			}
		}
	}

    
	if(this.material && renderType==GLGE.RENDER_DEFAULT) this.material.textureUniforms(gl,program,lights,this);
}
/**
* Renders the object to the screen
* @private
*/
GLGE.Object.prototype.GLRender=function(gl,renderType,pickindex){
	if(!this.gl) this.GLInit(gl);
	
	//if look at is set then look
	if(this.lookAt) this.Lookat(this.lookAt);
 
	//animate this object
	if(renderType==GLGE.RENDER_DEFAULT){
		if(this.animation) this.animate();
	}
	this.caches={};
	for(var n=0;n<this.instances.length;n++){
		this.instances[n].caches={};
	}
	
	//get pixel size of object
	var pixelsize;

	for(var i=0; i<this.multimaterials.length;i++){
		if(this.multimaterials[i].lods.length>1 && !pixelsize){
			var camerapos=gl.scene.camera.getPosition();
			var modelpos=this.getPosition();
			var dist=GLGE.lengthVec3([camerapos.x-modelpos.x,camerapos.y-modelpos.y,camerapos.z-modelpos.z]);
			dist=GLGE.mulMat4Vec4(gl.scene.camera.getProjectionMatrix(),[this.getBoundingVolume().getSphereRadius(),0,-dist,1]);
			pixelsize=dist[0]/dist[3]*gl.scene.renderer.canvas.width;
		}
	
		var lod=this.multimaterials[i].getLOD(pixelsize);

		if(lod.mesh && lod.mesh.loaded){
			if(renderType==GLGE.RENDER_NULL){
				if(lod.material) lod.material.registerPasses(gl,this);
				break;
			}
			if(!this.multimaterials[i].GLShaderProgram){
				this.createShaders(lod);
			}else{
				this.GLShaderProgramPick=lod.GLShaderProgramPick;
				this.GLShaderProgramShadow=lod.GLShaderProgramShadow;
				this.GLShaderProgram=lod.GLShaderProgram;
			}
			this.mesh=lod.mesh;
			this.material=lod.material;
			
			var drawType;
			switch(this.drawType){
				case GLGE.DRAW_LINES:
					drawType=gl.LINES;
					break;
				case GLGE.DRAW_POINTS:
					drawType=gl.POINTS;
					break;
				case GLGE.DRAW_LINELOOPS:
					drawType=gl.LINE_LOOP;
					break;
				case GLGE.DRAW_LINESTRIPS:
					drawType=gl.LINE_STRIP;
					break;
				default:
					drawType=gl.TRIANGLES;
					break;
			}
 
			switch(renderType){
				case  GLGE.RENDER_DEFAULT:
					gl.useProgram(this.GLShaderProgram);
					this.mesh.GLAttributes(gl,this.GLShaderProgram);
					break;
				case  GLGE.RENDER_SHADOW:
					gl.useProgram(this.GLShaderProgramShadow);
					this.mesh.GLAttributes(gl,this.GLShaderProgramShadow);
					break;
				case  GLGE.RENDER_NORMAL:
					gl.useProgram(this.GLShaderProgramNormal);
					this.mesh.GLAttributes(gl,this.GLShaderProgramNormal);
					break;
				case  GLGE.RENDER_PICK:
					gl.useProgram(this.GLShaderProgramPick);
					this.mesh.GLAttributes(gl,this.GLShaderProgramPick);
					drawType=gl.TRIANGLES;
					break;
			}
			//render the object
			this.GLUniforms(gl,renderType,pickindex);
			if(this.mesh.GLfaces){
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mesh.GLfaces);
				gl.drawElements(drawType, this.mesh.GLfaces.numItems, gl.UNSIGNED_SHORT, 0);
			}else{
				gl.drawArrays(drawType, 0, this.mesh.positions.length/3);
			}
				
			var matrix=this.matrix;
			var caches=this.caches;
			for(var n=0;n<this.instances.length;n++){
				this.matrix=this.instances[n].getModelMatrix();
				this.caches=this.instances[n].caches;
				this.GLUniforms(gl,renderType,pickindex);
				if(this.mesh.GLfaces){
					gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.mesh.GLfaces);
					gl.drawElements(drawType, this.mesh.GLfaces.numItems, gl.UNSIGNED_SHORT, 0);
				}else{
					gl.drawArrays(drawType, 0, this.mesh.positions.length/3);
				}
			}

			this.matrix=matrix;
			this.caches=caches;
		}
	}
}



/**
* @class Creates a new mesh
* @see GLGE.Object
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
* @augments GLGE.Events
*/
GLGE.Mesh=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.GLbuffers=[];
	this.buffers=[];
	this.UV=[];
	this.boneWeights=[];
	this.setBuffers=[];
	this.faces={};
}
GLGE.augment(GLGE.QuickNotation,GLGE.Mesh);
GLGE.augment(GLGE.JSONLoader,GLGE.Mesh);
GLGE.augment(GLGE.Events,GLGE.Mesh);
GLGE.Mesh.prototype.gl=null;
GLGE.Mesh.prototype.className="Mesh";
GLGE.Mesh.prototype.GLbuffers=null;
GLGE.Mesh.prototype.buffers=null;
GLGE.Mesh.prototype.setBuffers=null;
GLGE.Mesh.prototype.GLfaces=null;
GLGE.Mesh.prototype.faces=null;
GLGE.Mesh.prototype.UV=null;
GLGE.Mesh.prototype.joints=null;
GLGE.Mesh.prototype.invBind=null;
GLGE.Mesh.prototype.loaded=false;
/**
 * @name GLGE.Mesh#shaderupdate
 * @event fired when the shader needs updating
 * @param {object} data
 */

/**
* Gets the bounding volume for the mesh
* @returns {GLGE.BoundingVolume} 
*/
GLGE.Mesh.prototype.getBoundingVolume=function(){
	if(!this.boundingVolume){
		var minX,maxX,minY,maxY,minZ,maxZ;
		for(var i=0;i<this.buffers.length;i++){
			if(this.buffers[i].name=="position") var positions=this.buffers[i].data;
		}
		for(var i=0;i<positions.length;i=i+3){
			if(i==0){
				minX=maxX=positions[i];
				minY=maxY=positions[i+1];
				minZ=maxZ=positions[i+2];
			}else{
				minX=Math.min(minX,positions[i]);
				maxX=Math.max(maxX,positions[i]);
				minY=Math.min(minY,positions[i+1]);
				maxY=Math.max(maxY,positions[i+1]);
				minZ=Math.min(minZ,positions[i+2]);
				maxZ=Math.max(maxZ,positions[i+2]);
			}
		}
		this.boundingVolume=new GLGE.BoundingVolume(minX,maxX,minY,maxY,minZ,maxZ);
	}
	return this.boundingVolume;
}
/**
* Sets the joints
* @param {string[]} jsArray set joint objects
*/
GLGE.Mesh.prototype.setJoints=function(jsArray){
	this.joints=jsArray;
	this.fireEvent("shaderupdate",{});
	return this;
}
/**
* Sets the inverse bind matrix for each joint
* @param {GLGE.Matrix[]} jsArray set joint names
*/
GLGE.Mesh.prototype.setInvBindMatrix=function(jsArray){
	this.invBind=jsArray;
	this.fireEvent("shaderupdate",{});
	return this;
}
/**
* Sets the joint channels for each vertex 
* @param {Number[]} jsArray The 1 dimentional array of bones
* @param {Number} num the number of chanels in this mesh
*/
GLGE.Mesh.prototype.setVertexJoints=function(jsArray,num){
	if(num<4){
		this.setBuffer("joints1",jsArray,num);
	}else{
		var jsArray1=[];
		var jsArray2=[];
		for(var i=0;i<jsArray.length;i++){
			if(i%num<4){
				jsArray1.push(jsArray[i]);
			}else{
				jsArray2.push(jsArray[i]);
			}
		}
		this.setBuffer("joints1",jsArray1,4);
		this.setBuffer("joints2",jsArray2,num%4);
	}
	this.fireEvent("shaderupdate",{});
	return this;
}
/**
* Sets the joint weights on each vertex
* @param {Number[]} jsArray The 1 dimentional array of weights
* @param {Number} num the number of chanels in this mesh
*/
GLGE.Mesh.prototype.setVertexWeights=function(jsArray,num){
	//normalize the weights!
	for(var i=0;i<jsArray.length;i=i+parseInt(num)){
		var total=0;
		for(var n=0;n<num;n++){
			total+=parseFloat(jsArray[i+n]);
		}
		for(var n=0;n<num;n++){
			jsArray[i+n]=jsArray[i+n]/total;
		}
	}

	if(num<4){
		this.setBuffer("weights1",jsArray,num);
	}else{
		var jsArray1=[];
		var jsArray2=[];
		for(var i=0;i<jsArray.length;i++){
			if(i%num<4){
				jsArray1.push(jsArray[i]);
			}else{
				jsArray2.push(jsArray[i]);
			}
		}
		this.setBuffer("weights1",jsArray1,4);
		this.setBuffer("weights2",jsArray2,num%4);
	}
	this.fireEvent("shaderupdate",{});
	return this;
}
/**
* Set the UV coord for the first UV layer
* @param {Number[]} jsArray the UV coords in a 1 dimentional array
*/
GLGE.Mesh.prototype.setUV=function(jsArray){
	var idx=0;
	for(var i=0; i<jsArray.length;i=i+2){
		this.UV[idx]=jsArray[i];
		this.UV[idx+1]=jsArray[i+1];
		if(!this.UV[idx+2]) this.UV[idx+2]=0;
		if(!this.UV[idx+3]) this.UV[idx+3]=0;
		idx=idx+4;
	}
	this.setBuffer("UV",this.UV,4);
	return this;
}
/**
* Set the UV coord for the second UV layer
* @param {Number[]} jsArray the UV coords in a 1 dimentional array
*/
GLGE.Mesh.prototype.setUV2=function(jsArray){
	var idx=0;
	for(var i=0; i<jsArray.length;i=i+2){
		if(!this.UV[idx]) this.UV[idx]=0;
		if(!this.UV[idx+1]) this.UV[idx+1]=0;
		this.UV[idx+2]=jsArray[i];
		this.UV[idx+3]=jsArray[i+1];
		idx=idx+4;
	}
	this.setBuffer("UV",this.UV,4);
	return this;
}
/**
* Sets the positions of the verticies
* @param {Number[]} jsArray The 1 dimentional array of positions
*/
GLGE.Mesh.prototype.setPositions=function(jsArray){
	this.loaded=true;
	this.positions=jsArray;
	this.setBuffer("position",jsArray,3);
	return this;
}
/**
* Sets the normals of the verticies
* @param {Number[]} jsArray The 1 dimentional array of normals
*/
GLGE.Mesh.prototype.setNormals=function(jsArray){
	this.normals=jsArray;
	this.setBuffer("normal",jsArray,3);
	return this;
}
/**
* Sets a buffer for the
* @param {String} boneName The name of the bone
* @param {Number[]} jsArray The 1 dimentional array of weights
* @private
*/
GLGE.Mesh.prototype.setBuffer=function(bufferName,jsArray,size){
	//make sure all jsarray items are floats
	for(var i=0;i<jsArray.length;i++) jsArray[i]=parseFloat(jsArray[i]);
	var buffer;
	for(var i=0;i<this.buffers.length;i++){
		if(this.buffers[i].name==bufferName) buffer=i;
	}
	if(!buffer){
		this.buffers.push({name:bufferName,data:jsArray,size:size,GL:false});
	}
        else 
	{
		this.buffers[buffer]={name:bufferName,data:jsArray,size:size,GL:false};
	}
	return this;
}
/**
* Sets the faces for this mesh
* @param {Number[]} jsArray The 1 dimentional array of normals
*/
GLGE.Mesh.prototype.setFaces=function(jsArray){
	this.faces={data:jsArray,GL:false};	
	//if at this point calculate normals if we haven't got them yet
	if(!this.normals) this.calcNormals();
	
	//add a tangent buffer
	for(var i=0;i<this.buffers.length;i++){
		if(this.buffers[i].name=="position") var position=this.buffers[i].data;
		if(this.buffers[i].name=="UV") var uv=this.buffers[i].data;
		if(this.buffers[i].name=="normal") var normal=this.buffers[i].data;
	}
	

	if(position && uv){
		var tangentArray=[];
		var data={};
		var ref;
		for(var i=0;i<this.faces.data.length;i=i+3){
			var p1=[position[(parseInt(this.faces.data[i]))*3],position[(parseInt(this.faces.data[i]))*3+1],position[(parseInt(this.faces.data[i]))*3+2]];
			var p2=[position[(parseInt(this.faces.data[i+1]))*3],position[(parseInt(this.faces.data[i+1]))*3+1],position[(parseInt(this.faces.data[i+1]))*3+2]];
			var p3=[position[(parseInt(this.faces.data[i+2]))*3],position[(parseInt(this.faces.data[i+2]))*3+1],position[(parseInt(this.faces.data[i+2]))*3+2]];
			
			var n1=[normal[(parseInt(this.faces.data[i]))*3],normal[(parseInt(this.faces.data[i]))*3+1],normal[(parseInt(this.faces.data[i]))*3+2]];
			var n2=[normal[(parseInt(this.faces.data[i+1]))*3],normal[(parseInt(this.faces.data[i+1]))*3+1],normal[(parseInt(this.faces.data[i+1]))*3+2]];
			var n3=[normal[(parseInt(this.faces.data[i+2]))*3],normal[(parseInt(this.faces.data[i+2]))*3+1],normal[(parseInt(this.faces.data[i+2]))*3+2]];
			
			var p21=[p2[0]-p1[0],p2[1]-p1[1],p2[2]-p1[2]];
			var p31=[p3[0]-p1[0],p3[1]-p1[1],p3[2]-p1[2]];
			var uv21=[uv[(parseInt(this.faces.data[i+1]))*4]-uv[(parseInt(this.faces.data[i]))*4],uv[(parseInt(this.faces.data[i+1]))*4+1]-uv[(parseInt(this.faces.data[i]))*4+1]];
			var uv31=[uv[(parseInt(this.faces.data[i+2]))*4]-uv[(parseInt(this.faces.data[i]))*4],uv[(parseInt(this.faces.data[i+2]))*4+1]-uv[(parseInt(this.faces.data[i]))*4+1]];
			

   
			var tangent=GLGE.toUnitVec3([p21[0]*uv31[1]-p31[0]*uv21[01],
								p21[1]*uv31[1]-p31[1]*uv21[1],
								p21[2]*uv31[1]-p31[2]*uv21[1]]);		
								
			var cp = uv21[1] * uv31[0] - uv21[0] * uv31[1];
			if ( cp != 0.0 ) tangent=GLGE.toUnitVec3(GLGE.scaleVec3(tangent,1/cp));

			if(data[[p1[0],p1[1],p1[2],n1[0],n1[1],n1[2]].join(",")]){
				tang=data[[p1[0],p1[1],p1[2],n1[0],n1[1],n1[2]].join(",")];
				tang.vec=GLGE.scaleVec3(GLGE.addVec3(GLGE.scaleVec3(tang.vec,tang.weight),tangent),1/(tang.weight));
				tang.weight++;
			}else{
				data[[p1[0],p1[1],p1[2],n1[0],n1[1],n1[2]].join(",")]={vec:tangent,weight:1};
			}
			if(data[[p2[0],p2[1],p2[2],n2[0],n2[1],n2[2]].join(",")]){
				tang=data[[p2[0],p2[1],p2[2],n2[0],n2[1],n2[2]].join(",")];
				tang.vec=GLGE.scaleVec3(GLGE.addVec3(GLGE.scaleVec3(tang.vec,tang.weight),tangent),1/(tang.weight+1));
				tang.weight++;
			}else{
				data[[p2[0],p2[1],p2[2],n2[0],n2[1],n2[2]].join(",")]={vec:tangent,weight:1};
			}
			if(data[[p3[0],p3[1],p3[2],n3[0],n3[1],n3[2]].join(",")]){
				tang=data[[p3[0],p3[1],p3[2],n3[0],n3[1],n3[2]].join(",")];
				tang.vec=GLGE.scaleVec3(GLGE.addVec3(GLGE.scaleVec3(tang.vec,tang.weight),tangent),1/(tang.weight+1));
				tang.weight++;
			}else{
				data[[p3[0],p3[1],p3[2],n3[0],n3[1],n3[2]].join(",")]={vec:tangent,weight:1};
			}
		}
		for(var i=0;i<position.length/3;i++){
			var p1=[position[i*3],position[i*3+1],position[i*3+2]];
			var n1=[normal[i*3],normal[i*3+1],normal[i*3+2]];
			t=data[[p1[0],p1[1],p1[2],n1[0],n1[1],n1[2]].join(",")].vec;
			if(t){
				tangentArray[i*3]=t[0];
				tangentArray[i*3+1]=t[1];
				tangentArray[i*3+2]=t[2];
			}
		}
		this.setBuffer("tangent",tangentArray,3);
	}
	return this;
}
/**
* Sets the faces for this mesh
* @param {Number[]} jsArray The 1 dimentional array of normals
* @private
*/
GLGE.Mesh.prototype.GLSetFaceBuffer=function(gl){
	if(!this.GLfaces) this.GLfaces = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.GLfaces);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.faces.data), gl.STATIC_DRAW);
	this.GLfaces.itemSize = 1;
	this.GLfaces.numItems = this.faces.data.length;
}
/**
* Sets up a GL Buffer
* @param {WebGLContext} gl The context being drawn on
* @param {String} bufferName The name of the buffer to create
* @param {Number[]}  jsArray The data to add to the buffer
* @param {Number}  size Size of a single element within the array
* @private
*/
GLGE.Mesh.prototype.GLSetBuffer=function(gl,bufferName,jsArray,size){
	if(!this.GLbuffers[bufferName]) this.GLbuffers[bufferName] = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.GLbuffers[bufferName]);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(jsArray), gl.STATIC_DRAW);
	this.GLbuffers[bufferName].itemSize = size;
	this.GLbuffers[bufferName].numItems = jsArray.length/size;
};
/**
* Calculates the normals for this mesh
* @private
*/
GLGE.Mesh.prototype.calcNormals=function(){
	var normals=[];
	var positions=this.positions;
	var faces=this.faces.data;
	if(!faces){
		faces=[];
		for(var i=0;i<positions.length/3;i++) faces[i]=i;
	}
	for(var i=0;i<faces.length;i=i+3){
		var v1=[positions[faces[i]*3],positions[faces[i]*3+1],positions[faces[i]*3+2]];
		var v2=[positions[faces[i+1]*3],positions[faces[i+1]*3+1],positions[faces[i+1]*3+2]];
		var v3=[positions[faces[i+2]*3],positions[faces[i+2]*3+1],positions[faces[i+2]*3+2]];
		var vec1=GLGE.subVec3(v2,v1);
		var vec2=GLGE.subVec3(v3,v1);
		var norm=GLGE.toUnitVec3(GLGE.crossVec3(vec1,vec2));
		if(normals[faces[i]]==undefined) normals[faces[i]]=[];
		normals[faces[i]].push(norm);
		if(normals[faces[i+1]]==undefined) normals[faces[i+1]]=[];
		normals[faces[i+1]].push(norm);
		if(normals[faces[i+2]]==undefined) normals[faces[i+2]]=[];
		normals[faces[i+2]].push(norm);
	}
	var norms=[];
	for(i=0;i<normals.length;i++){
		var x=0,y=0,z=0;
		if(normals[i]!=undefined){
			for(var j=0;j<normals[i].length;j++){
				x+=normals[i][j][0];
				y+=normals[i][j][1];
				z+=normals[i][j][2];
			}
			x/=normals[i].length;
			y/=normals[i].length;
			z/=normals[i].length;
			norms[i*3]=x;
			norms[i*3+1]=y;
			norms[i*3+2]=z;
		}
	}
	this.setNormals(norms);
}
/**
* Sets the Attributes for this mesh
* @param {WebGLContext} gl The context being drawn on
* @private
*/
GLGE.Mesh.prototype.GLAttributes=function(gl,shaderProgram){
	//if at this point we have no normals set then calculate them
	if(!this.normals) this.calcNormals();

	//disable all the attribute initially arrays - do I really need this?
	for(var i=0; i<8; i++) gl.disableVertexAttribArray(i);
	//check if the faces have been updated
	if(!this.faces.GL && this.faces.data && this.faces.data.length>0){
		this.GLSetFaceBuffer(gl);
		this.faces.GL=true;
	}
	//loop though the buffers
	for(i=0; i<this.buffers.length;i++){
		if(!this.buffers[i].GL){
			this.GLSetBuffer(gl,this.buffers[i].name,this.buffers[i].data,this.buffers[i].size);
			this.buffers[i].GL=true;
		}
		attribslot=GLGE.getAttribLocation(gl,shaderProgram, this.buffers[i].name);
		if(attribslot>-1){
			gl.bindBuffer(gl.ARRAY_BUFFER, this.GLbuffers[this.buffers[i].name]);
			gl.enableVertexAttribArray(attribslot);
			gl.vertexAttribPointer(attribslot, this.GLbuffers[this.buffers[i].name].itemSize, gl.FLOAT, false, 0, 0);
		}
	}
}



/**
* @class Creates a new light source to be added to a scene
* @property {Boolean} diffuse Dose this light source effect diffuse shading
* @property {Boolean} specular Dose this light source effect specular shading
* @augments GLGE.Animatable
* @augments GLGE.Placeable
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.Light=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.color={r:1,g:1,b:1};
}
GLGE.augment(GLGE.Placeable,GLGE.Light);
GLGE.augment(GLGE.Animatable,GLGE.Light);
GLGE.augment(GLGE.QuickNotation,GLGE.Light);
GLGE.augment(GLGE.JSONLoader,GLGE.Light);
GLGE.Light.prototype.className="Light";
/**
* @constant 
* @description Enumeration for an point light source
*/
GLGE.L_POINT=1;
/**
* @constant 
* @description Enumeration for an directional light source
*/
GLGE.L_DIR=2;
/**
* @constant 
* @description Enumeration for an spot light source
*/
GLGE.L_SPOT=3;

GLGE.Light.prototype.constantAttenuation=1;
GLGE.Light.prototype.linearAttenuation=0.002;
GLGE.Light.prototype.quadraticAttenuation=0.0008;
GLGE.Light.prototype.spotCosCutOff=0.95;
GLGE.Light.prototype.spotPMatrix=null;
GLGE.Light.prototype.spotExponent=10;
GLGE.Light.prototype.color=null; 
GLGE.Light.prototype.diffuse=true; 
GLGE.Light.prototype.specular=true; 
GLGE.Light.prototype.samples=0; 
GLGE.Light.prototype.softness=0.01; 
GLGE.Light.prototype.type=GLGE.L_POINT;
GLGE.Light.prototype.frameBuffer=null;
GLGE.Light.prototype.renderBuffer=null;
GLGE.Light.prototype.texture=null;
GLGE.Light.prototype.bufferHeight=256;
GLGE.Light.prototype.bufferWidth=256;
GLGE.Light.prototype.shadowBias=2.0;
GLGE.Light.prototype.castShadows=false;
/**
* Gets the spot lights projection matrix
* @returns the lights spot projection matrix
* @private
*/
GLGE.Light.prototype.getPMatrix=function(){
	if(!this.spotPMatrix){
		var far;
		if(this.scene && this.scene.camera) far=this.scene.camera.far;
			else far=1000;
		this.spotPMatrix=GLGE.makePerspective(Math.acos(this.spotCosCutOff)/3.14159*360, 1.0, 0.1, far);
	}
	return this.spotPMatrix;
}
/**
* Sets the shadow casting flag
* @param {number} value should cast shadows?
*/
GLGE.Light.prototype.setCastShadows=function(value){
	this.castShadows=value;
	return this;
}
/**
* Gets the shadow casting flag
* @returns {number} true if casts shadows
*/
GLGE.Light.prototype.getCastShadows=function(){
	return this.castShadows;
	return this;
}
/**
* Sets the shadow bias
* @param {number} value The shadow bias
*/
GLGE.Light.prototype.setShadowBias=function(value){
	this.shadowBias=value;
	return this;
}
/**
* Gets the shadow bias
* @returns {number} The shadow buffer bias
*/
GLGE.Light.prototype.getShadowBias=function(){
	return this.shadowBias;
}

/**
* Sets the number of samples for this shadow
* @param {number} value The number of samples to perform
*/
GLGE.Light.prototype.setShadowSamples=function(value){
	this.samples=value;
	return this;
}
/**
* Gets the number of samples for this shadow
* @returns {number} The number of samples
*/
GLGE.Light.prototype.getShadowSamples=function(){
	return this.samples;
}
/**
* Sets the shadow softness
* @param {number} value The number of samples to perform
*/
GLGE.Light.prototype.setShadowSoftness=function(value){
	this.softness=value;
	return this;
}
/**
* Gets the shadow softness
* @returns {number} The softness of the shadows
*/
GLGE.Light.prototype.getShadowSamples=function(){
	return this.softness;
}
/**
* Sets the shadow buffer width
* @param {number} value The shadow buffer width
*/
GLGE.Light.prototype.setBufferWidth=function(value){
	this.bufferWidth=value;
	return this;
}
/**
* Gets the shadow buffer width
* @returns {number} The shadow buffer width
*/
GLGE.Light.prototype.getBufferHeight=function(){
	return this.bufferHeight;
}
/**
* Sets the shadow buffer width
* @param {number} value The shadow buffer width
*/
GLGE.Light.prototype.setBufferHeight=function(value){
	this.bufferHeight=value;
	return this;
}
/**
* Gets the shadow buffer width
* @returns {number} The shadow buffer width
*/
GLGE.Light.prototype.getBufferWidth=function(){
	return this.bufferWidth;
}
/**
* Sets the spot light cut off
* @param {number} value The cos of the angle to limit
*/
GLGE.Light.prototype.setSpotCosCutOff=function(value){
	this.spotPMatrix=null;
	this.spotCosCutOff=value;
	return this;
}
/**
* Gets the spot light cut off
* @returns {number} The cos of the limiting angle 
*/
GLGE.Light.prototype.getSpotCosCutOff=function(){
	return this.spotCosCutOff;
}
/**
* Sets the spot light exponent
* @param {number} value The spot lights exponent
*/
GLGE.Light.prototype.setSpotExponent=function(value){
	this.spotExponent=value;
	return this;
}
/**
* Gets the spot light exponent
* @returns {number} The exponent of the spot light
*/
GLGE.Light.prototype.getSpotExponent=function(){
	return this.spotExponent;
}
/**
* Sets the light sources Attenuation
* @returns {Object} The components of the light sources attenuation
*/
GLGE.Light.prototype.getAttenuation=function(constant,linear,quadratic){
	var attenuation={};
	attenuation.constant=this.constantAttenuation;
	attenuation.linear=this.linearAttenuation;
	attenuation.quadratic=this.quadraticAttenuation;
	return attenuation;
}
/**
* Sets the light sources Attenuation
* @param {Number} constant The constant part of the attenuation
* @param {Number} linear The linear part of the attenuation
* @param {Number} quadratic The quadratic part of the attenuation
*/
GLGE.Light.prototype.setAttenuation=function(constant,linear,quadratic){
	this.constantAttenuation=constant;
	this.linearAttenuation=linear;
	this.quadraticAttenuation=quadratic;
	return this;
}
/**
* Sets the light sources constant attenuation
* @param {Number} value The constant part of the attenuation
*/
GLGE.Light.prototype.setAttenuationConstant=function(value){
	this.constantAttenuation=value;
	return this;
}
/**
* Sets the light sources linear attenuation
* @param {Number} value The linear part of the attenuation
*/
GLGE.Light.prototype.setAttenuationLinear=function(value){
	this.linearAttenuation=value;
	return this;
}
/**
* Sets the light sources quadratic attenuation
* @param {Number} value The quadratic part of the attenuation
*/
GLGE.Light.prototype.setAttenuationQuadratic=function(value){
	this.quadraticAttenuation=value;
	return this;
}

/**
* Sets the color of the light source
* @param {string} color The color of the light
*/
GLGE.Light.prototype.setColor=function(color){
	color=GLGE.colorParse(color);
	this.color={r:color.r,g:color.g,b:color.b};
	return this;
}
/**
* Sets the red color of the light source
* @param {Number} value The new red level 0-1
*/
GLGE.Light.prototype.setColorR=function(value){
	this.color.r=value;
	return this;
}
/**
* Sets the green color of the light source
* @param {Number} value The new green level 0-1
*/
GLGE.Light.prototype.setColorG=function(value){
	this.color.g=value;
	return this;
}
/**
* Sets the blue color of the light source
* @param {Number} value The new blue level 0-1
*/
GLGE.Light.prototype.setColorB=function(value){
	this.color.b=value;
	return this;
}
/**
* Gets the current color of the light source
* @return {[r,g,b]} The current position
*/
GLGE.Light.prototype.getColor=function(){
	return this.color;
}
/**
* Gets the type of the light
* @return {Number} The type of the light source eg GLGE.L_POINT
*/
GLGE.Light.prototype.getType=function(){
	return this.type;
}
/**
* Sets the type of the light
* @param {Number} type The type of the light source eg GLGE.L_POINT
*/
GLGE.Light.prototype.setType=function(type){
	this.type=type;
	return this;
}
/**
* init for the rendering
* @private
*/
GLGE.Light.prototype.GLInit=function(gl){	
	this.gl=gl;
	if(this.type==GLGE.L_SPOT && !this.texture){
		this.createSpotBuffer(gl);
	}
}
/**
* Sets up the WebGL needed to render the depth map for this light source. Only used for spot lights which produce shadows
* @private
*/
GLGE.Light.prototype.createSpotBuffer=function(gl){
    this.frameBuffer = gl.createFramebuffer();
    this.renderBuffer = gl.createRenderbuffer();
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    } catch (e) {
        var tex = new Uint8Array(this.bufferWidth * this.bufferHeight * 4);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.bufferWidth, this.bufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex);
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.bufferWidth, this.bufferHeight);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderBuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

/**
* @constant 
* @description Enumeration for a perspective camera
*/
GLGE.C_PERSPECTIVE=1;
/**
* @constant 
* @description Enumeration for a orthographic camera
*/
GLGE.C_ORTHO=2;

/**
* @class Creates a new camera object
* @augments GLGE.Animatable
* @augments GLGE.Placeable
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.Camera=function(uid){
	GLGE.Assets.registerAsset(this,uid);
};
GLGE.augment(GLGE.Placeable,GLGE.Camera);
GLGE.augment(GLGE.Animatable,GLGE.Camera);
GLGE.augment(GLGE.QuickNotation,GLGE.Camera);
GLGE.augment(GLGE.JSONLoader,GLGE.Camera);
GLGE.Camera.prototype.className="Camera";
GLGE.Camera.prototype.fovy=35;
GLGE.Camera.prototype.aspect=1.0;
GLGE.Camera.prototype.near=0.1;
GLGE.Camera.prototype.far=1000.0;
GLGE.Camera.prototype.orthoscale=5;
GLGE.Camera.prototype.type=GLGE.C_PERSPECTIVE;
GLGE.Camera.prototype.pMatrix=null;

/**
* Method gets the orthographic scale for the camers
* @return {Matrix} Returns the orthographic scale
*/
GLGE.Camera.prototype.getOrthoScale=function(){
	if(this.type==GLGE.C_ORTHO) {
		return this.orthoscale
	}else{
		GLGE.error("You may only get a scale for a orthographic camera");
		return 1;
	}
};
/**
* Method sets the orthographic scale for the camers
* @param {number} scale The new orthographic scale
*/
GLGE.Camera.prototype.setOrthoScale=function(scale){
	if(this.type==GLGE.C_ORTHO) {
		this.orthoscale=scale;
		this.pMatrix=null;
	}
	else
	{
		GLGE.error("You may only set a scale for a orthographic camera");
	}
	return this;
};

/**
* Method gets the far drawing distance
* @return {Matrix} Returns the cameras far draw distance
*/
GLGE.Camera.prototype.getFar=function(){
	return this.far;
};
/**
* Method sets the far draw distance of the camera
* @param {number} distance The far draw distance
*/
GLGE.Camera.prototype.setFar=function(distance){
	this.far=distance;
	return this;
};

/**
* Method gets the near drawing distance
* @return {Matrix} Returns the cameras near draw distance
*/
GLGE.Camera.prototype.getNear=function(){
	return this.near;
};
/**
* Method sets the near draw distance of the camera
* @param {number} distance The near draw distance
*/
GLGE.Camera.prototype.setNear=function(distance){
	this.near=distance;
	return this;
};

/**
* Method gets the current camera type
* @return {Matrix} Returns the camera type
*/
GLGE.Camera.prototype.getType=function(){
	return this.type
};
/**
* Method sets the type of camera GLGE.C_PERSPECTIVE or GLGE.C_ORTHO
* @param {number} type The type of this camera
*/
GLGE.Camera.prototype.setType=function(type){
	if(type==GLGE.C_PERSPECTIVE || type==GLGE.C_ORTHO){
		this.type=type;
		this.pMatrix=null;
	}else{
		GLGE.error("unsuported camera type");
	}
	return this;
};

/**
* Method gets the current yfov if the camera type is GLGE.C_PERSPECTIVE
* @return {Matrix} Returns the yfov
*/
GLGE.Camera.prototype.getFovY=function(){
	if(this.type==GLGE.C_PERSPECTIVE) {
		return this.fovy
	}else{
		GLGE.error("You may only get a yfov for a perspective camera");
		return 1;
	}
};
/**
* Method sets the yfov of the camera
* @param {number} yfov The new yfov of the camera
*/
GLGE.Camera.prototype.setFovY=function(fovy){
	if(this.type==GLGE.C_PERSPECTIVE) {
		this.fovy=fovy;
		this.ymax=null;
		this.pMatrix=null;
	}
	else
	{
		GLGE.error("You may only set a yfov for a perspective camera");
	}
	return this;
};

/**
* Method gets the current aspect if the camera type is GLGE.C_PERSPECTIVE
* @return {Matrix} Returns the yfov
*/
GLGE.Camera.prototype.getAspect=function(){
	if(this.type==GLGE.C_PERSPECTIVE || this.type==GLGE.C_ORTHO) {
		return this.aspect
	}
	else
	{
		GLGE.error("You may only set a aspect for a perspective or orthographic camera");
		return 1;
	}
};
/**
* Method sets the aspect of the camera
* @param {number} aspect The new projection matrix
*/
GLGE.Camera.prototype.setAspect=function(aspect){
	if(this.type==GLGE.C_PERSPECTIVE || this.type==GLGE.C_ORTHO) {
		this.aspect=aspect;
		this.pMatrix=null;
	}
	else
	{
		GLGE.error("You may only set a aspect for a perspective or orthographic camera");
	}
	return this;
};


/**
* Method gets the current projection matrix of this camera
* @return {Matrix} Returns the camera projection matrix
*/
GLGE.Camera.prototype.getProjectionMatrix=function(){
	if(!this.pMatrix){
		switch(this.type){
			case GLGE.C_PERSPECTIVE:
				this.pMatrix=GLGE.makePerspective(this.fovy, this.aspect, this.near, this.far);
				break;
			case GLGE.C_ORTHO:
				this.pMatrix=GLGE.makeOrtho(-this.orthoscale*this.aspect,this.orthoscale*this.aspect,-this.orthoscale,this.orthoscale, this.near, this.far);
				break;
		}
	}
	return this.pMatrix;
};
/**
* Method generates the projection matrix based on the 
* camera paramaters
* @param {Matrix} projection The new projection matrix
*/
GLGE.Camera.prototype.setProjectionMatrix=function(projection){
	this.pMatrix=projection;
	return this;
};
/**
* Method generates the cameras view matrix
* @return Returns the view matrix based on this camera
* @type Matrix
*/
GLGE.Camera.prototype.updateMatrix=function(){
	var position=this.getPosition();
	var vMatrix=GLGE.translateMatrix(position.x,position.y,position.z);
	vMatrix=GLGE.mulMat4(vMatrix,this.getRotMatrix());
	if(this.parent) vMatrix=GLGE.mulMat4(this.parent.getModelMatrix(),vMatrix);
	this.matrix=GLGE.inverseMat4(vMatrix);
};
/**
* Method generates the cameras view matrix
* @return Returns the view matrix based on this camera
* @type Matrix
*/
GLGE.Camera.prototype.getViewMatrix=function(){
	if(!this.matrix || !this.rotmatrix) this.updateMatrix();
	return this.matrix;
};



/**
* @constant 
* @description Enumeration for no fog
*/
GLGE.FOG_NONE=1;
/**
* @constant 
* @description Enumeration for linear fall off fog
*/
GLGE.FOG_LINEAR=2;
/**
* @constant 
* @description Enumeration for exponential fall off fog
*/
GLGE.FOG_QUADRATIC=3;

/**
* @class Scene class containing the camera, lights and objects
* @augments GLGE.Group
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.Scene=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.children=[];
	this.camera=new GLGE.Camera();
	this.backgroundColor={r:1,g:1,b:1,a:1};
	this.ambientColor={r:0,g:0,b:0};
	this.fogColor={r:0.5,g:0.5,b:0.5};
	this.passes=[];
}
GLGE.augment(GLGE.Group,GLGE.Scene);
GLGE.augment(GLGE.QuickNotation,GLGE.Scene);
GLGE.augment(GLGE.JSONLoader,GLGE.Scene);
GLGE.Scene.prototype.camera=null;
GLGE.Scene.prototype.className="Scene";
GLGE.Scene.prototype.renderer=null;
GLGE.Scene.prototype.backgroundColor=null;
GLGE.Scene.prototype.filter=null;
GLGE.Scene.prototype.fogColor=null;
GLGE.Scene.prototype.ambientColor=null;
GLGE.Scene.prototype.fogNear=10;
GLGE.Scene.prototype.fogFar=80;
GLGE.Scene.prototype.fogType=GLGE.FOG_NONE;
GLGE.Scene.prototype.passes=null;

/**
* Gets the fog falloff type
* @returns {number} the far falloff type
*/
GLGE.Scene.prototype.getFogType=function(){	
	return this.fogType;
}
/**
* Sets the scenes fog falloff type
* @param {number} type The fog falloff type FOG_NONE,FOG_LINEAR,FOG_QUADRATIC
*/
GLGE.Scene.prototype.setFogType=function(type){	
	this.fogType=type;
	return this;
}

/**
* Gets the far fog distance
* @returns {number} the far distance of the fog
*/
GLGE.Scene.prototype.getFogFar=function(){	
	return this.fogFar;
}
/**
* Sets the scenes fog far distance
* @param {number} dist The fog far distance
*/
GLGE.Scene.prototype.setFogFar=function(dist){	
	this.fogFar=dist;
	return this;
}

/**
* Gets the near fog distance
* @returns {number} the near distance of the fog
*/
GLGE.Scene.prototype.getFogNear=function(){	
	return this.fogNear;
}
/**
* Sets the scenes fog near distance
* @param {number} dist The fog near distance
*/
GLGE.Scene.prototype.setFogNear=function(dist){	
	this.fogNear=dist;
	return this;
}

/**
* Gets the fog color
* @returns {object} An assoiative array r,g,b
*/
GLGE.Scene.prototype.getFogColor=function(){	
	return this.fogColor;
}
/**
* Sets the scenes fog color
* @param {string} color The fog color
*/
GLGE.Scene.prototype.setFogColor=function(color){	
	color=GLGE.colorParse(color);
	this.fogColor={r:color.r,g:color.g,b:color.b};
	return this;
}

/**
* Gets the scenes background color
* @returns {object} An assoiative array r,g,b
*/
GLGE.Scene.prototype.getBackgroundColor=function(){	
	return this.backgroundColor;
}
/**
* Sets the scenes background color
* @param {string} color The backgorund color
*/
GLGE.Scene.prototype.setBackgroundColor=function(color){	
	color=GLGE.colorParse(color);
	this.backgroundColor={r:color.r,g:color.g,b:color.b,a:color.a};
	return this;
}
/**
* Gets the scenes ambient light
* @returns {object} An assoiative array r,g,b
*/
GLGE.Scene.prototype.getAmbientColor=function(){	
	return this.ambientColor;
}

/**
* Sets the scenes ambient light
* @param {string} color The ambient light color
*/
GLGE.Scene.prototype.setAmbientColor=function(color){	
	color=GLGE.colorParse(color);
	this.ambientColor={r:color.r,g:color.g,b:color.b};
	if(this.renderer){
		this.renderer.gl.clearColor(this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b, 1.0);
	}
	return this;
}
/**
* Sets the scenes ambient light
* @param {number} value the red componenent of the ambient light 0-1
*/
GLGE.Scene.prototype.setAmbientColorR=function(value){	
	this.ambientColor.r=value;
	return this;
}
/**
* Sets the scenes ambient light
* @param {number} value the green componenent of the ambient light 0-1
*/
GLGE.Scene.prototype.setAmbientColorG=function(value){	
	this.ambientColor.g=value;
	return this;
}
/**
* Sets the scenes ambient light
* @param {number} value the blue componenent of the ambient light 0-1
*/
GLGE.Scene.prototype.setAmbientColorB=function(value){	
	this.ambientColor.b=value;
	return this;
}

/**
* Sets the active camera for this scene
* @property {GLGE.Camera} object The object to be added
*/
GLGE.Scene.prototype.setCamera=function(camera){	
	if(typeof camera=="string")  camera=GLGE.Assets.get(camera);
	this.camera=camera;
	return this;
}
/**
* Gets the scenes active camera
* @returns {GLGE.Camera} The current camera
*/
GLGE.Scene.prototype.getCamera=function(){	
	return this.camera;
}
/**
* used to initialize all the WebGL buffers etc need for this scene
* @private
*/
GLGE.Scene.prototype.GLInit=function(gl){
	this.gl=gl;
	gl.lights=this.getLights();
	//sets the camera aspect to same aspect as the canvas
	this.camera.setAspect(this.renderer.canvas.width/this.renderer.canvas.height);

	//this.createPickBuffer(gl);
	this.renderer.gl.clearColor(this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b, 1.0);
	
	for(var i=0;i<this.children;i++){
		if(this.children[i].GLInit) children[i].GLInit(gl);
	}
}
/**
* used to clean up all the WebGL buffers etc need for this scene
* @private
*/
GLGE.Scene.prototype.GLDestroy=function(gl){
}
/**
* sort function
*/
GLGE.Scene.sortFunc=function(a,b){
	return a.zdepth-b.zdepth;
}
/**
* z sorts the objects
* @private
*/
GLGE.Scene.prototype.zSort=function(gl,objects){
	var cameraMatrix=gl.scene.camera.getViewMatrix();
	var transMatrix;
	for(var i=0;i<objects.length;i++){
		transMatrix=GLGE.mulMat4(cameraMatrix,objects[i].getModelMatrix());
		objects[i].zdepth=transMatrix[11];
	}
	objects.sort(GLGE.Scene.sortFunc);
	return objects;
}
/**
* sets the 2d filter to apply
* @param {GLGE.Filter2d} filter the filter to apply when rendering the scene
*/
GLGE.Scene.prototype.setFilter2d=function(value){
	this.filter=value;
	return this;
}
/**
* gets the 2d filter being applied apply
* @returns {GLGE.Filter2d}
*/
GLGE.Scene.prototype.getFilter2d=function(filter){
	return this.filter;
}
/**
* gets the scenes frame buffer
* @private
*/
GLGE.Scene.prototype.getFrameBuffer=function(gl){
	if(this.filter) return this.filter.getFrameBuffer(gl);
	return null;
}
/**
* culls objects from the scene
* @private
*/
GLGE.Scene.prototype.cull=function(renderobjects,camera,projection){
	return renderobjects;
}

/**
* renders the scene
* @private
*/
GLGE.Scene.prototype.render=function(gl){
	//if look at is set then look
	if(this.camera.lookAt) this.camera.Lookat(this.camera.lookAt);	
	
	this.animate();
	
	var lights=gl.lights;
	gl.scene=this;
	
	gl.disable(gl.BLEND);
	
	this.framebuffer=this.getFrameBuffer(gl);
	
	var renderObjects=this.getObjects();
	//shadow stuff
	for(var i=0; i<lights.length;i++){
		if(lights[i].castShadows){
			if(!lights[i].gl) lights[i].GLInit(gl);
			gl.bindFramebuffer(gl.FRAMEBUFFER, lights[i].frameBuffer);
			

			gl.viewport(0,0,lights[i].bufferWidth,lights[i].bufferHeight);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			var cameraMatrix=this.camera.matrix;
			var cameraPMatrix=this.camera.getProjectionMatrix();
			if(!lights[i].s_cache) lights[i].s_cache={};
			if(lights[i].s_cache.pmatrix!=lights[i].getPMatrix() || lights[i].s_cache.mvmatrix!=lights[i].getModelMatrix()){
				lights[i].s_cache.pmatrix=lights[i].getPMatrix();
				lights[i].s_cache.mvmatrix=lights[i].getModelMatrix();
				lights[i].s_cache.imvmatrix=GLGE.inverseMat4(lights[i].getModelMatrix());
				lights[i].s_cache.smatrix=GLGE.mulMat4(lights[i].getPMatrix(),lights[i].s_cache.imvmatrix);
			}
			this.camera.setProjectionMatrix(lights[i].s_cache.pmatrix);
			this.camera.matrix=lights[i].s_cache.imvmatrix;
			//draw shadows
			for(var n=0; n<renderObjects.length;n++){
				renderObjects[n].GLRender(gl, GLGE.RENDER_SHADOW,n);
			}
			gl.flush();
			this.camera.matrix=cameraMatrix;
			this.camera.setProjectionMatrix(cameraPMatrix);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		}
	}
	if(this.camera.animation) this.camera.animate();
	
	//null render pass to findout what else needs rendering
	this.getPasses(gl,renderObjects);	
	
	//first off render the passes
	var cameraMatrix=this.camera.matrix;
	var cameraPMatrix=this.camera.getProjectionMatrix();
	this.allowPasses=false;
	while(this.passes.length>0){
		var pass=this.passes.pop();
		gl.bindFramebuffer(gl.FRAMEBUFFER, pass.frameBuffer);
		this.camera.matrix=pass.cameraMatrix;
		this.camera.setProjectionMatrix(pass.projectionMatrix);
		this.renderPass(gl,renderObjects,pass.width,pass.height);
	}
	
	this.camera.matrix=cameraMatrix;
	this.camera.setProjectionMatrix(cameraPMatrix);
	

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
	this.renderPass(gl,renderObjects,this.renderer.canvas.width,this.renderer.canvas.height);	
	
	this.applyFilter(gl,renderObjects,null);
	
	this.allowPasses=true;

}
/**
* gets the passes needed to render this scene
* @private
*/
GLGE.Scene.prototype.getPasses=function(gl,renderObjects){
	for(var i=0; i<renderObjects.length;i++){
		renderObjects[i].GLRender(gl,GLGE.RENDER_NULL);
	}
}

/**
* renders the scene
* @private
*/
GLGE.Scene.prototype.renderPass=function(gl,renderObjects,width,height,type){
	if(!type) type=GLGE.RENDER_DEFAULT;
	
	gl.clearDepth(1.0);
	gl.depthFunc(gl.LEQUAL);
	gl.viewport(0,0,width,height);
	
	gl.clearColor(this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b, this.backgroundColor.a);
	
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
	var transObjects=[];
	gl.disable(gl.BLEND);
	for(var i=0; i<renderObjects.length;i++){
		if(!renderObjects[i].zTrans) renderObjects[i].GLRender(gl,type);
			else transObjects.push(renderObjects[i])
	}

	gl.enable(gl.BLEND);
	transObjects=this.zSort(gl,transObjects);
	for(var i=0; i<transObjects.length;i++){
		transObjects[i].GLRender(gl, type);
	}
}

GLGE.Scene.prototype.applyFilter=function(gl,renderObject,framebuffer){
	if(this.filter && this.filter.renderDepth){	
		gl.clearDepth(1.0);
		gl.depthFunc(gl.LEQUAL);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.filter.getDepthBuffer(gl));
		this.renderPass(gl,renderObject,this.filter.getDepthBufferWidth(), this.filter.getDepthBufferHeight(),GLGE.RENDER_SHADOW);	
	}
	
	if(this.filter && this.filter.renderNormal){	
		gl.clearDepth(1.0);
		gl.depthFunc(gl.LEQUAL);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.filter.getNormalBuffer(gl));
		this.renderPass(gl,renderObject,this.filter.getNormalBufferWidth(),this.filter.getNormalBufferHeight(),GLGE.RENDER_NORMAL);	
	}
	
	if(this.filter) this.filter.GLRender(gl,framebuffer);
}

/**
* Adds and additional render pass to the scene for RTT, reflections and refractions
* @private
*/
GLGE.Scene.prototype.addRenderPass=function(frameBuffer,cameraMatrix,projectionMatrix,width,height){
	if(this.allowPasses)	this.passes.push({frameBuffer:frameBuffer, cameraMatrix:cameraMatrix, projectionMatrix:projectionMatrix, height:height, width:width});
	return this;
}
/**
* Sets up the WebGL needed create a picking frame and render buffer
* @private
*/
/*GLGE.Scene.prototype.createPickBuffer=function(gl){
    this.framePickBuffer = gl.createFramebuffer();
    this.renderPickBufferD = gl.createRenderbuffer();
    this.renderPickBufferC = gl.createRenderbuffer();
    //this.pickTexture = gl.createTexture();
    //gl.bindTexture(gl.TEXTURE_2D, this.pickTexture);

    //TODO update when null is accepted
   /* try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    } catch (e) {
        var tex = new WebGLUnsignedByteArray(4*1*4);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4,1, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex);
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framePickBuffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderPickBufferD);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,4, 1);
    //gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderPickBufferD);
    
    
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderPickBufferC);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA,4, 1);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, this.renderPickBufferC);
    
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
}*/

/**
* ray query from origin in the given direction
* @param origin the source of the ray
* @param direction the direction of the ray
*/
GLGE.Scene.prototype.ray=function(origin,direction){

		var gl=this.renderer.gl;
		var origmatrix=this.camera.matrix;	
		var origpmatrix=this.camera.pMatrix;
		
		this.camera.matrix=GLGE.inverseMat4(GLGE.Mat4([direction[2], direction[1], direction[0], origin[0],
									direction[0], direction[2], direction[1], origin[1],
									direction[1], direction[0], direction[2], origin[2],
									0, 0, 0, 1]));

		if(!this.pickPMatrix)	this.pickPMatrix=GLGE.makeOrtho(-0.0001,0.0001,-0.0001,0.0001,this.camera.near,this.camera.far);
		this.camera.pMatrix=this.pickPMatrix;
		gl.viewport(0,0,8,1);
		gl.clear(gl.DEPTH_BUFFER_BIT);
		gl.disable(gl.BLEND);
		gl.scene=this;
		var objects=this.getObjects();
		for(var i=0; i<objects.length;i++){
			if(objects[i].pickable) objects[i].GLRender(gl,GLGE.RENDER_PICK,i+1);
		}
		gl.flush();

		var data = new Uint8Array(8 * 1 * 4);
		gl.readPixels(0, 0, 8, 1, gl.RGBA,gl.UNSIGNED_BYTE, data);
		
		
		var norm=[data[4]/255,data[5]/255,data[6]/255];
		var normalsize=Math.sqrt(norm[0]*norm[0]+norm[1]*norm[1]+norm[2]*norm[2])*0.5;
		norm=[norm[0]/normalsize-1,norm[1]/normalsize-1,norm[2]/normalsize-1];
		var obj=objects[data[0]+data[1]*256+data[2]*65536-1];
		
		var dist=(data[10]/255+0.00390625*data[9]/255+0.0000152587890625*data[8]/255)*this.camera.far;
		var tex=[];
		tex[0]=(data[14]/255+0.00390625*data[13]/255+0.0000152587890625*data[12]/255);
		tex[1]=(data[18]/255+0.00390625*data[17]/255+0.0000152587890625*data[16]/255);
		
				
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0,0,this.renderer.canvas.width,this.renderer.canvas.height);
		
		//revert the view matrix
		this.camera.matrix=origmatrix;	
		this.camera.pMatrix=origpmatrix;
		return {object:obj,distance:dist,coord:[origin[0]-direction[0]*dist,origin[1]-direction[1]*dist,origin[2]-direction[2]*dist],normal:norm,texture:tex};
}

/**
* Picks and object from canvas coords
* @param x the canvas x coord to pick
* @param y the canvas y coord to pick
*/
GLGE.Scene.prototype.pick=function(x,y){
	if(!this.camera){
		GLGE.error("No camera set for picking");
		return false;
	}else if(this.camera.matrix && this.camera.pMatrix){
		xcoord =  -( ( ( 2 * x ) / this.renderer.canvas.width ) - 1 ) / this.camera.pMatrix[0];
		ycoord =( ( ( 2 * y ) / this.renderer.canvas.height ) - 1 ) / this.camera.pMatrix[5];
		zcoord =  1;
		var coord=[xcoord,ycoord,zcoord,0];
		coord=GLGE.mulMat4Vec4(GLGE.inverseMat4(this.camera.matrix),coord);
		var cameraPos=this.camera.getPosition();
		var origin=[cameraPos.x,cameraPos.y,cameraPos.z];
		return this.ray(origin,coord);
		
	}else{
		return false;
	}
	
}

/**
* @class Sets the scene to render
* @param {GLGE.Scene} scene The scene to be rendered
*/
GLGE.Renderer=function(canvas,error){
	this.canvas=canvas;
	try {
		this.gl = canvas.getContext("experimental-webgl",{alpha:true,depth:true,stencil:true,antialias:true,premultipliedAlpha:true});
	} catch(e) {}
	if(!this.gl) {
		if(!error){
			var div=document.createElement("div");
			div.setAttribute("style","position: absolute; top: 10px; left: 10px; font-family: sans-serif; font-size: 14px; padding: 10px;background-color: #fcffcb;color: #800; width: 200px; border:2px solid #f00");
			div.innerHTML="Cannot detect webgl please download a compatible browser";
			document.getElementsByTagName("body")[0].appendChild(div);
			throw "cannot create webgl context";
		}else{
			error();
			throw "cannot create webgl context";
		}
	}
	//firefox is doing something here?
	try{
	this.gl.canvas=canvas;
	}catch(e){};
	//this.gl = WebGLDebugUtils.makeDebugContext(this.gl);
	//this.gl.setTracing(true);

	//chome compatibility
	//TODO: Remove this when chome is right
	if (!this.gl.getProgramParameter)
	{
		this.gl.getProgramParameter = this.gl.getProgrami
	}
	if (!this.gl.getShaderParameter)
	{
		this.gl.getShaderParameter = this.gl.getShaderi
	}
	// End of Chrome compatibility code
	
	this.gl.uniformMatrix4fvX=this.gl.uniformMatrix4fv
	this.gl.uniformMatrix4fv=function(uniform,transpose,array){
		if(!transpose){
			this.uniformMatrix4fvX(uniform,false,array);
		}else{
			GLGE.mat4gl(GLGE.transposeMat4(array),array);
			this.uniformMatrix4fvX(uniform,false,array);
		}
	}
	var gl=this.gl;
	
	/*this.gl.texImage2Dx=this.gl.texImage2D;
	this.gl.texImage2D=function(){
		if(arguments.length==9){
			gl.texImage2Dx(arguments[0], arguments[1], arguments[2],arguments[3],arguments[4],arguments[5],arguments[6],arguments[7],arguments[8]);
		}else{
			gl.texImage2Dx(arguments[0], arguments[1], arguments[5],false,false);
		}
	}*/

	
	//set up defaults
	this.gl.clearDepth(1.0);
	this.gl.clearStencil(0);
	this.gl.enable(this.gl.DEPTH_TEST);
    
	//this.gl.enable(this.gl.CULL_FACE);
    
	this.gl.depthFunc(this.gl.LEQUAL);
	this.gl.blendFuncSeparate(this.gl.SRC_ALPHA,this.gl.ONE_MINUS_SRC_ALPHA,this.gl.ZERO,this.gl.ONE);	
};
GLGE.Renderer.prototype.gl=null;
GLGE.Renderer.prototype.scene=null;
/**
* Gets the scene which is set to be rendered
* @returns the current render scene
*/
GLGE.Renderer.prototype.getScene=function(){
	return this.scene;
};
/**
* Sets the scene to render
* @param {GLGE.Scene} scene The scene to be rendered
*/
GLGE.Renderer.prototype.setScene=function(scene){
	scene.renderer=this;
	this.scene=scene;
	scene.GLInit(this.gl);
	return this;
};
/**
* Renders the current scene to the canvas
*/
GLGE.Renderer.prototype.render=function(){
	this.scene.render(this.gl);
	//if this is the first ever pass then render twice to fill shadow buffers
	if(!this.rendered){
		this.scene.render(this.gl);
		this.rendered=true;
	}
};


/**
* @class A texture to be included in a material
* @param {string} uid the unique id for this texture
* @see GLGE.Material
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.Texture=function(uid){
	GLGE.Assets.registerAsset(this,uid);
}
GLGE.augment(GLGE.QuickNotation,GLGE.Texture);
GLGE.augment(GLGE.JSONLoader,GLGE.Texture);
GLGE.Texture.prototype.className="Texture";
GLGE.Texture.prototype.image=null;
GLGE.Texture.prototype.glTexture=null;
GLGE.Texture.prototype.url=null;
/**
* Gets the textures used by the layer
* @return {string} The textures image url
*/
GLGE.Texture.prototype.getSrc=function(){
	return this.url;
};

/**
* Sets the textures image location
* @param {string} url the texture image url
*/
GLGE.Texture.prototype.setSrc=function(url){
	this.url=url;
	this.state=0;
	this.image=new Image();
	var texture=this;
	this.image.onload = function(){
		texture.state=1;
	}	
	this.image.src=url;	
	if(this.glTexture && this.gl){
		this.gl.deleteTexture(this.glTexture);
		this.glTexture=null;
	}
	return this;
};

/**
* Sets the textures image location
* @private
**/
GLGE.Texture.prototype.doTexture=function(gl){
	this.gl=gl;
	//create the texture if it's not already created
	if(!this.glTexture) this.glTexture=gl.createTexture();
	//if the image is loaded then set in the texture data
	if(this.state==1){
		gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,this.image);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.bindTexture(gl.TEXTURE_2D, null);
		this.state=2;
	}
	gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	
	if(this.state==2) return true;
		else return false;
}

/**
* @class A canvase texture to be included in a material
* @param {string} uid the unique id for this texture
* @see GLGE.Material
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.TextureCanvas=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.canvas=document.createElement("canvas");
}
GLGE.augment(GLGE.QuickNotation,GLGE.TextureCanvas);
GLGE.augment(GLGE.JSONLoader,GLGE.TextureCanvas);
GLGE.TextureCanvas.prototype.className="TextureCanvas";
GLGE.TextureCanvas.prototype.glTexture=null;
/**
* Gets the canvas used by the texture
* @return {canvas} The textures image url
*/
GLGE.TextureCanvas.prototype.getCanvas=function(){
	return this.canvas;
};
/**
* Sets the canvas used by the texture
* @param {canvas} canvas The canvas to use
*/
GLGE.TextureCanvas.prototype.setCanvas=function(canvas){
	this.canvas=canvas;
	return this;
};
/**
* Sets the canvas height
* @param {number} value The canvas height
*/
GLGE.TextureCanvas.prototype.setHeight=function(value){
	this.canvas.height=value;
	return this;
};
/**
* Sets the canvas width
* @param {number} value The canvas width
*/
GLGE.TextureCanvas.prototype.setWidth=function(value){
	this.canvas.width=value;
	return this;
};

/**
* gets the canvas height
* @returns {number} The canvas height
*/
GLGE.TextureCanvas.prototype.getHeight=function(){
	return this.canvas.height;
};
/**
* gets the canvas width
* @returns {number} The canvas width
*/
GLGE.TextureCanvas.prototype.getWidth=function(){
	return this.canvas.width;
};

/**
* does the canvas texture GL stuff
* @private
**/
GLGE.TextureCanvas.prototype.doTexture=function(gl){
	this.gl=gl;
	//create the texture if it's not already created
	if(!this.glTexture){
		this.glTexture=gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
		this.updateCanvas(gl);
	}else{
		gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
		this.updateCanvas(gl);
	}

	
	return true;
}
/**
* Updates the canvas texture
* @private
*/
GLGE.TextureCanvas.prototype.updateCanvas=function(gl){
	var canvas = this.canvas;
	
	gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
	//TODO: fix this when minefield is upto spec
	try{gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);}
	catch(e){gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas,null);}
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.generateMipmap(gl.TEXTURE_2D);
}


/**
* @class A video texture to be included in a material
* @param {string} uid the unique id for this texture
* @see GLGE.Material
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.TextureVideo=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.video=document.createElement("video");
	this.video.style.display="none";
	this.video.setAttribute("loop","loop");
	this.video.autoplay=true;
	//looping isn't working in firefox so quick fix!
	this.video.addEventListener("ended", function() { this.play(); }, true); 
	//video needs to be part of page to work for some reason :-s
	document.getElementsByTagName("body")[0].appendChild(this.video);
	//used to get webkit working
	this.canvas=document.createElement("canvas");
	this.ctx=this.canvas.getContext("2d");
	
}
GLGE.augment(GLGE.QuickNotation,GLGE.TextureVideo);
GLGE.augment(GLGE.JSONLoader,GLGE.TextureVideo);
GLGE.TextureVideo.prototype.className="TextureVideo";
GLGE.TextureVideo.prototype.glTexture=null;
/**
* Gets the canvas used by the texture
* @return {video} The textures image url
*/
GLGE.TextureVideo.prototype.getVideo=function(){
	return this.video;
};
/**
* Sets the video used by the texture
* @param {video} canvas The canvas to use
*/
GLGE.TextureVideo.prototype.setVideo=function(video){
	this.video=video;
	return this;
};

/**
* Sets the source used for the video
* @param {string} src The URL of the video
*/
GLGE.TextureVideo.prototype.setSrc=function(src){
	this.video.src=src;
	return this;
};
/**
* gets the source used for the video
* @returns {string} The URL of the video
*/
GLGE.TextureVideo.prototype.getSrc=function(src){
	return this.video.src;
};

/**
* does the canvas texture GL stuff
* @private
**/
GLGE.TextureVideo.prototype.doTexture=function(gl){
	this.gl=gl;
	//create the texture if it's not already created
	if(!this.glTexture){
		this.glTexture=gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
		this.updateTexture(gl);
	}else{
		gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
		this.updateTexture(gl);
	}

	
	return true;
}
/**
* Updates the canvas texture
* @private
*/
GLGE.TextureVideo.prototype.updateTexture=function(gl){
	var video = this.video;
	gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
	//TODO: fix this when minefield is upto spec
	if(video.readyState>0){
	if(video.height<=0){
		video.style.display="";
		video.height=video.offsetHeight;
		video.width=video.offsetWidth;
		video.style.display="none";
	}
	this.canvas.height=video.height;
	this.canvas.width=video.width;
	this.ctx.drawImage(video, 0, 0);
	try{gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);}
	catch(e){gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas,null);}
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.generateMipmap(gl.TEXTURE_2D);
	
	/*
	use when video is working in webkit
	try{gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);}
	catch(e){gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video,null);}
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.generateMipmap(gl.TEXTURE_2D);
	*/
	}
}



/**
* @class A reflection texture will reflect in a plane for a specified transform
* @param {string} uid the unique id for this texture
* @see GLGE.Material
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.TextureCamera=function(uid){
	GLGE.Assets.registerAsset(this,uid);
}
GLGE.augment(GLGE.QuickNotation,GLGE.TextureCamera);
GLGE.augment(GLGE.JSONLoader,GLGE.TextureCamera);
GLGE.TextureCamera.prototype.className="Texture";
GLGE.TextureCamera.prototype.texture=null;
GLGE.TextureCamera.prototype.glTexture=null;
GLGE.TextureCamera.prototype.object=null;
GLGE.TextureCamera.prototype.camera=null;
GLGE.TextureCamera.prototype.bufferHeight=0;
GLGE.TextureCamera.prototype.bufferWidth=0;
GLGE.TextureCamera.prototype.mirrorAxis=GLGE.NONE;
GLGE.TextureCamera.prototype.clipAxis=GLGE.NONE;

/**
* sets the RTT  render buffer width
* @param {number} buffer width
**/
GLGE.TextureCamera.prototype.setBufferWidth=function(width){
	this.bufferWidth=width;
	this.update=true;
	return this;
}
/**
* gets the RTT  render buffer width
* @returns the width
**/
GLGE.TextureCamera.prototype.getBufferWidth=function(){
	return this.bufferWidth;
}

/**
* sets the RTT  render buffer height
* @param {number} buffer height
**/
GLGE.TextureCamera.prototype.setBufferHeight=function(height){
	this.bufferHeight=height;
	this.update=true;
	return this;
}
/**
* gets the RTT  render buffer height
* @returns the height
**/
GLGE.TextureCamera.prototype.getBufferHeight=function(){
	return this.bufferHeight;
}

/**
* sets the RTT  clip axis
* @param {number} the axis
**/
GLGE.TextureCamera.prototype.setClipAxis=function(camera){
	this.clipAxis=camera;
	return this;
}
/**
* gets the RTT clip axis
* @returns the axis
**/
GLGE.TextureCamera.prototype.getClipAxis=function(){
	return this.clipAxis;
}

/**
* sets the RTT  mirror axis
* @param {number} the axis
**/
GLGE.TextureCamera.prototype.setMirrorAxis=function(camera){
	this.mirrorAxis=camera;
	return this;
}
/**
* gets the RTT mirror axis
* @returns the axis
**/
GLGE.TextureCamera.prototype.getMirrorAxis=function(){
	return this.mirrorAxis;
}

/**
* sets the RTT camera to use
* @param {GLGE.Camera} the source camera
**/
GLGE.TextureCamera.prototype.setCamera=function(camera){
	this.camera=camera;
	return this;
}
/**
* gets the RTT source camera
* @returns {GLGE.Camera} the source camera
**/
GLGE.TextureCamera.prototype.getCamera=function(){
	return this.camera;
}

/**
* does what is needed to get the texture
* @private
**/
GLGE.TextureCamera.prototype.doTexture=function(gl,object){
	if(this.camera){
		this.gl=gl;
		var modelmatrix=object.getModelMatrix();
		var pmatrix=gl.scene.camera.getProjectionMatrix();
		var cameramatrix=this.camera.getViewMatrix();
		var matrix;
		
		if(this.mirrorAxis){
			switch(this.mirrorAxis){
				case GLGE.XAXIS:
					matrix=GLGE.mulMat4(GLGE.mulMat4(GLGE.mulMat4(cameramatrix,modelmatrix),GLGE.scaleMatrix(-1,1,1)),GLGE.inverseMat4(modelmatrix));
				break;
				case GLGE.YAXIS:
					matrix=GLGE.mulMat4(GLGE.mulMat4(GLGE.mulMat4(cameramatrix,modelmatrix),GLGE.scaleMatrix(1,-1,1)),GLGE.inverseMat4(modelmatrix));
				break;
				case GLGE.ZAXIS:
					matrix=GLGE.mulMat4(GLGE.mulMat4(GLGE.mulMat4(cameramatrix,modelmatrix),GLGE.scaleMatrix(1,1,-1)),GLGE.inverseMat4(modelmatrix));
				break;
			}
		}else{
			matrix=cameramatrix;
		}
		
		if(this.clipAxis){
			var clipplane
			switch(this.clipAxis){
				case GLGE.NEG_XAXIS:
					var dirnorm=GLGE.toUnitVec3([-modelmatrix[0],-modelmatrix[4],-modelmatrix[8]]);
					clipplane=[dirnorm[0],dirnorm[1],dirnorm[2],-GLGE.dotVec3([modelmatrix[3],modelmatrix[7],modelmatrix[11]],dirnorm)];
					break;
				case GLGE.POS_XAXIS:
					var dirnorm=GLGE.toUnitVec3([modelmatrix[0],modelmatrix[4],modelmatrix[8]]);
					clipplane=[dirnorm[0],dirnorm[1],dirnorm[2],-GLGE.dotVec3([modelmatrix[3],modelmatrix[7],modelmatrix[11]],dirnorm)];
					break;
				case GLGE.NEG_YAXIS:
					var dirnorm=GLGE.toUnitVec3([-modelmatrix[1],-modelmatrix[5],-modelmatrix[9]]);
					clipplane=[dirnorm[0],dirnorm[1],dirnorm[2],-GLGE.dotVec3([modelmatrix[3],modelmatrix[7],modelmatrix[11]],dirnorm)];
					break;
				case GLGE.POS_YAXIS:
					var dirnorm=GLGE.toUnitVec3([modelmatrix[1],modelmatrix[5],modelmatrix[9]]);
					clipplane=[dirnorm[0],dirnorm[1],dirnorm[2],-GLGE.dotVec3([modelmatrix[3],modelmatrix[7],modelmatrix[11]],dirnorm)];
					break;
				case GLGE.NEG_ZAXIS:
					var dirnorm=GLGE.toUnitVec3([-modelmatrix[2],-modelmatrix[6],-modelmatrix[10]]);
					clipplane=[dirnorm[0],dirnorm[1],dirnorm[2],-GLGE.dotVec3([modelmatrix[3],modelmatrix[7],modelmatrix[11]],dirnorm)+0.001];
					break;
				case GLGE.POS_ZAXIS:
					var dirnorm=GLGE.toUnitVec3([modelmatrix[2],modelmatrix[6],modelmatrix[10]]);
					clipplane=[dirnorm[0],dirnorm[1],dirnorm[2],-GLGE.dotVec3([modelmatrix[3],modelmatrix[7],modelmatrix[11]],dirnorm)+0.001];
					break;
			}
			
			var itmvp=GLGE.transposeMat4(GLGE.inverseMat4(GLGE.mulMat4(pmatrix,matrix)));

			clipplane=GLGE.mulMat4Vec4(itmvp,clipplane);
			clipplane=GLGE.scaleVec4(clipplane,pmatrix[10]);
			clipplane[3] -= 1;
			if(clipplane[2]<0) GLGE.scaleVec4(clipplane,-1);
			var suffix=[ 1,0,0,0,
					0,1,0,0,
					clipplane[0],clipplane[1],clipplane[2],clipplane[3],
					0,0,0,1];
			pmatrix=GLGE.mulMat4(suffix,pmatrix);
		}
		var height=(!this.bufferHeight ? gl.scene.renderer.canvas.height : this.bufferHeight);
		var width=(!this.bufferWidth ? gl.scene.renderer.canvas.width : this.bufferWidth);
	
		//create the texture if it's not already created
		if(!this.glTexture || this.update){
			this.createFrameBuffer(gl);
			gl.scene.addRenderPass(this.frameBuffer,matrix, gl.scene.camera.getProjectionMatrix(),width,height);
			gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
			this.update=false;
			return false;
		}else{	
			gl.bindTexture(gl.TEXTURE_2D, this.glTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.scene.addRenderPass(this.frameBuffer,matrix, pmatrix,width,height);
			return true;
		}
	}else{
		return false;
	}
}
GLGE.TextureCamera.prototype.registerPasses=GLGE.TextureCamera.prototype.doTexture;
/**
* Creates the frame buffer for our texture
* @private
*/
GLGE.TextureCamera.prototype.createFrameBuffer=function(gl){
	var height=(!this.bufferHeight ? gl.scene.renderer.canvas.height : this.bufferHeight);
	var width=(!this.bufferWidth ? gl.scene.renderer.canvas.width : this.bufferWidth);
	
	if(!this.frameBuffer) this.frameBuffer = gl.createFramebuffer();
	if(!this.renderBuffer) this.renderBuffer = gl.createRenderbuffer();
	if(!this.glTexture) this.glTexture=gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, this.glTexture);

	var tex = new Uint8Array(width*height*4);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width,height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex);
    
	gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
    
	gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBuffer);
	//dpeth stencil doesn't seem to work in either webkit or mozilla so don't use for now - reflected particles will be messed up!
	//gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL,width, height);
	//gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, this.renderBuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,width, height);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderBuffer);
    
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.glTexture, 0);	
    
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindTexture(gl.TEXTURE_2D, null);
}




/**
* @class A texture to be included in a material
* @param {string} uid the unique id for this texture
* @see GLGE.Material
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
*/
GLGE.TextureCube=function(uid){
	GLGE.Assets.registerAsset(this,uid);
}
GLGE.augment(GLGE.QuickNotation,GLGE.TextureCube);
GLGE.augment(GLGE.JSONLoader,GLGE.TextureCube);
GLGE.TextureCube.prototype.className="TextureCube";
GLGE.TextureCube.prototype.posX=null;
GLGE.TextureCube.prototype.negX=null;
GLGE.TextureCube.prototype.posY=null;
GLGE.TextureCube.prototype.negY=null;
GLGE.TextureCube.prototype.posZ=null;
GLGE.TextureCube.prototype.negZ=null;
GLGE.TextureCube.prototype.texture=null;
GLGE.TextureCube.prototype.glTexture=null;
GLGE.TextureCube.prototype.loadState=0;
/**
* Sets the url for a given image
* @param {string} url the texture image url
* @param {string} image the image element to load
*/
GLGE.TextureCube.prototype.setSrc=function(url,image,mask){
	this.url=url;
	this.state=0;
	this[image]=new Image();
	var texture=this;
	this[image].onload = function(){
		texture.loadState+=mask;
	}	
	this[image].src=url;	
	if(this.glTexture && this.gl) {
		this.gl.deleteTexture(this.glTexture);
		this.glTexture=null;
	}
	return this;
}

/**
* Sets the positive X cube image
* @param {string} url the texture image url
*/
GLGE.TextureCube.prototype.setSrcPosX=function(url){
	this.setSrc(url,"posX",1);
	return this;
};
/**
* Sets the negative X cube image
* @param {string} url the texture image url
*/
GLGE.TextureCube.prototype.setSrcNegX=function(url){
	this.setSrc(url,"negX",2);
	return this;
};
/**
* Sets the positive Y cube image
* @param {string} url the texture image url
*/
GLGE.TextureCube.prototype.setSrcPosY=function(url){
	this.setSrc(url,"posY",4);
	return this;
};
/**
* Sets the negative Y cube image
* @param {string} url the texture image url
*/
GLGE.TextureCube.prototype.setSrcNegY=function(url){
	this.setSrc(url,"negY",8);
	return this;
};
/**
* Sets the positive Z cube image
* @param {string} url the texture image url
*/
GLGE.TextureCube.prototype.setSrcPosZ=function(url){
	this.setSrc(url,"posZ",16);
	return this;
};
/**
* Sets the negative Z cube image
* @param {string} url the texture image url
*/
GLGE.TextureCube.prototype.setSrcNegZ=function(url){
	this.setSrc(url,"negZ",32);
	return this;
};

/**
* Sets the textures image location
* @private
**/
GLGE.TextureCube.prototype.doTexture=function(gl){
	this.gl=gl;
	//create the texture if it's not already created
	if(!this.glTexture) this.glTexture=gl.createTexture();
	//if the image is loaded then set in the texture data
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.glTexture);
	if(this.loadState==63 && this.state==0){
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.posX);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.negX);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.posY);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.negY);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.posZ);
		gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.negZ);
		gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
		gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
		this.state=1;
	}
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.glTexture);
	if(this.state==1) return true;
		else return false;
}


/**
* @class The material layer describes how to apply this layer to the material
* @see GLGE.Material
* @augments GLGE.Animatable
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
* @augments GLGE.Events
*/
GLGE.MaterialLayer=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.blendMode=GLGE.BL_MIX;
};
GLGE.augment(GLGE.Animatable,GLGE.MaterialLayer);
GLGE.augment(GLGE.QuickNotation,GLGE.MaterialLayer);
GLGE.augment(GLGE.JSONLoader,GLGE.MaterialLayer);
GLGE.augment(GLGE.Events,GLGE.MaterialLayer);
/**
 * @name GLGE.MaterialLayer#shaderupdated
 * @event Fires when a change will result in a change to the GLSL shader
 * @param {object} data
 */
 
GLGE.MaterialLayer.prototype.className="MaterialLayer";
GLGE.MaterialLayer.prototype.texture=null;
GLGE.MaterialLayer.prototype.blendMode=null;
GLGE.MaterialLayer.prototype.mapto=GLGE.M_COLOR;
GLGE.MaterialLayer.prototype.mapinput=GLGE.UV1;
GLGE.MaterialLayer.prototype.scaleX=1;
GLGE.MaterialLayer.prototype.offsetX=0;
GLGE.MaterialLayer.prototype.rotX=0;
GLGE.MaterialLayer.prototype.scaleY=1;
GLGE.MaterialLayer.prototype.offsetY=0;
GLGE.MaterialLayer.prototype.rotY=0;
GLGE.MaterialLayer.prototype.scaleZ=1;
GLGE.MaterialLayer.prototype.offsetZ=0;
GLGE.MaterialLayer.prototype.rotZ=0;
GLGE.MaterialLayer.prototype.dScaleX=0;
GLGE.MaterialLayer.prototype.dOffsetX=0;
GLGE.MaterialLayer.prototype.dRotX=0;
GLGE.MaterialLayer.prototype.dScaleY=0;
GLGE.MaterialLayer.prototype.dOffsetY=0;
GLGE.MaterialLayer.prototype.dRotY=0;
GLGE.MaterialLayer.prototype.dScaleZ=0;
GLGE.MaterialLayer.prototype.dOffsetZ=0;
GLGE.MaterialLayer.prototype.dRotZ=0;
GLGE.MaterialLayer.prototype.alpha=1;
GLGE.MaterialLayer.prototype.height=0.05;
GLGE.MaterialLayer.prototype.matrix=null;

/**
* Gets the textures used by the layer
* @return {GLGE.Texture} The current shininess of the material
*/
GLGE.MaterialLayer.prototype.getMatrix=function(){
	if(!this.matrix){
		var offset=this.getOffset();
		var scale=this.getScale();
		var rotation=this.getRotation();
		this.matrix=GLGE.mulMat4(GLGE.mulMat4(GLGE.translateMatrix(offset.x,offset.y,offset.z),GLGE.scaleMatrix(scale.x,scale.y,scale.z)),GLGE.rotateMatrix(rotation.x,rotation.y,rotation.z));
	}
	return this.matrix;
};
/**
* Sets the height for this layer, currently only used for parallax mapping
* @param {number} the height of this layer
*/
GLGE.MaterialLayer.prototype.setHeight=function(value){
	this.height=value;
	return this;
};
/**
* Gets the height for this layer, currently only used for parallax mapping
* @return {number} the height of this layer
*/
GLGE.MaterialLayer.prototype.getHeight=function(){
	return this.height;
};

/**
* Sets the textures alpha blending value
* @param {number} the alpha for this layer
*/
GLGE.MaterialLayer.prototype.setAlpha=function(value){
	this.alpha=value;
	return this;
};
/**
* Gets the textures alpha blending value
* @return {number} the alpha for this layer
*/
GLGE.MaterialLayer.prototype.getAlpha=function(){
	return this.alpha;
};

/**
* Sets the textures used by the layer
* @param {GLGE.Texture} value the teture to associate with this layer
*/
GLGE.MaterialLayer.prototype.setTexture=function(value){
	if(typeof value=="string")  value=GLGE.Assets.get(value);
	this.texture=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the textures used by the layer
* @return {GLGE.Texture} The current shininess of the material
*/
GLGE.MaterialLayer.prototype.getTexture=function(){
	return this.texture;
};
/**
* Sets the flag for how this layer maps to the material
* @param {Number} value the flags to set for this layer
*/
GLGE.MaterialLayer.prototype.setMapto=function(value){
	this.mapto=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the flag representing the way the layer maps to the material
* @return {Number} The flags currently set for this layer
*/
GLGE.MaterialLayer.prototype.getMapto=function(){
	return this.mapto;
};
/**
* Sets the texture coordinate system
* @param {Number} value the mapping to use
*/
GLGE.MaterialLayer.prototype.setMapinput=function(value){
	this.mapinput=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the texture coordinate system
* @return {Number} The current mapping
*/
GLGE.MaterialLayer.prototype.getMapinput=function(){
	return this.mapinput;
};

/**
* Gets the layers texture offset
* @return {object} the current offset
*/
GLGE.MaterialLayer.prototype.getOffset=function(){
	var offset={};
	offset.x=parseFloat(this.getOffsetX())+parseFloat(this.getDOffsetX());
	offset.y=parseFloat(this.getOffsetY())+parseFloat(this.getDOffsetY());
	offset.z=parseFloat(this.getOffsetZ())+parseFloat(this.getDOffsetZ());
	return offset;
};

/**
* Gets the layers texture rotation
* @return {object} the current rotation
*/
GLGE.MaterialLayer.prototype.getRotation=function(){
	var rotation={};
	rotation.x=parseFloat(this.getRotX())+parseFloat(this.getDRotX());
	rotation.y=parseFloat(this.getRotY())+parseFloat(this.getDRotY());
	rotation.z=parseFloat(this.getRotZ())+parseFloat(this.getDRotZ());
	return rotation;
};

/**
* Gets the layers texture scale
* @return {object} the current scale
*/
GLGE.MaterialLayer.prototype.getScale=function(){
	var scale={};
	scale.x=parseFloat(this.getScaleX())+parseFloat(this.getDScaleX());
	scale.y=parseFloat(this.getScaleY())+parseFloat(this.getDScaleY());
	scale.z=parseFloat(this.getScaleZ())+parseFloat(this.getDScaleZ());
	return scale;
};

/**
* Sets the layers texture X offset
* @param {Number} value the amount to offset the texture
*/
GLGE.MaterialLayer.prototype.setOffsetX=function(value){
	this.matrix=null;
	this.offsetX=value;
	return this;
};
/**
* Gets the layers texture X offset
* @return {Number} the current offset
*/
GLGE.MaterialLayer.prototype.getOffsetX=function(){
	return this.offsetX;
};
/**
* Sets the layers texture Y offset
* @param {Number} value the amount to offset the texture
*/
GLGE.MaterialLayer.prototype.setOffsetY=function(value){
	this.matrix=null;
	this.offsetY=value;
	return this;
};
/**
* Gets the layers texture Y offset
* @return {Number} the current offset
*/
GLGE.MaterialLayer.prototype.getOffsetY=function(){
	return this.offsetY;
};
/**
* Sets the layers texture Z offset
* @param {Number} value the amount to offset the texture
*/
GLGE.MaterialLayer.prototype.setOffsetZ=function(value){
	this.matrix=null;
	this.offsetZ=value;
	return this;
};
/**
* Gets the layers texture Z offset
* @return {Number} the current offset
*/
GLGE.MaterialLayer.prototype.getOffsetZ=function(){
	return this.offsetZ;
};
/**
* Sets the layers texture X displacment offset, useful for animation
* @param {Number} value the amount to offset the texture
*/
GLGE.MaterialLayer.prototype.setDOffsetX=function(value){
	this.matrix=null;
	this.dOffsetX=value;
	return this;
};
/**
* Gets the layers texture X displacment offset, useful for animation
* @return {Number} the current offset
*/
GLGE.MaterialLayer.prototype.getDOffsetX=function(){
	return this.dOffsetX;
};
/**
* Sets the layers texture Y displacment offset, useful for animation
* @param {Number} value the amount to offset the texture
*/
GLGE.MaterialLayer.prototype.setDOffsetY=function(value){
	this.matrix=null;
	this.dOffsetY=value;
	return this;
};
/**
* Gets the layers texture Y displacment offset, useful for animation
* @return {Number} the current offset
*/
GLGE.MaterialLayer.prototype.getDOffsetY=function(){
	return this.dOffsetY;
};
/**
* Sets the layers texture Z displacment offset, useful for animation
* @param {Number} value the amount to offset the texture
*/
GLGE.MaterialLayer.prototype.setDOffsetZ=function(value){
	this.matrix=null;
	this.dOffsetZ=value;
	return this;
};
/**
* Gets the layers texture X displacment offset, useful for animation
* @return {Number} the current offset
*/
GLGE.MaterialLayer.prototype.getDOffsetZ=function(){
	return this.dOffsetZ;
};
/**
* Sets the layers texture X scale
* @param {Number} value the amount to scale the texture
*/
GLGE.MaterialLayer.prototype.setScaleX=function(value){
	this.matrix=null;
	this.scaleX=value;
	return this;
};
/**
* Gets the layers texture X scale
* @return {Number} the current scale
*/
GLGE.MaterialLayer.prototype.getScaleX=function(){
	return this.scaleX;
};
/**
* Sets the layers texture Y scale
* @param {Number} value the amount to scale the texture
*/
GLGE.MaterialLayer.prototype.setScaleY=function(value){
	this.matrix=null;
	this.scaleY=value;
	return this;
};
/**
* Gets the layers texture Y scale
* @return {Number} the current scale
*/
GLGE.MaterialLayer.prototype.getScaleY=function(){
	return this.scaleY;
};
/**
* Sets the layers texture Z scale
* @param {Number} value the amount to scale the texture
*/
GLGE.MaterialLayer.prototype.setScaleZ=function(value){
	this.matrix=null;
	this.scaleZ=value;
	return this;
};
/**
* Gets the layers texture Z offset
* @return {Number} the current offset
*/
GLGE.MaterialLayer.prototype.getScaleZ=function(){
	return this.scaleZ;
};
/**
* Sets the layers texture X displacment scale, useful for animation
* @param {Number} value the amount to scale the texture
*/
GLGE.MaterialLayer.prototype.setDScaleX=function(value){
	this.matrix=null;
	this.dScaleX=value;
	return this;
};
/**
* Gets the layers texture X displacment scale, useful for animation
* @return {Number} the current scale
*/
GLGE.MaterialLayer.prototype.getDScaleX=function(){
	return this.dScaleX;
};
/**
* Sets the layers texture Y displacment scale, useful for animation
* @param {Number} value the amount to scale the texture
*/
GLGE.MaterialLayer.prototype.setDScaleY=function(value){
	this.matrix=null;
	this.dScaleY=value;
	return this;
};
/**
* Gets the layers texture Y displacment scale, useful for animation
* @return {Number} the current scale
*/
GLGE.MaterialLayer.prototype.getDScaleY=function(){
	return this.dScaleY;
};
/**
* Sets the layers texture Z displacment scale, useful for animation
* @param {Number} value the amount to scale the texture
*/
GLGE.MaterialLayer.prototype.setDScaleZ=function(value){
	this.matrix=null;
	this.dScaleZ=value;
	return this;
};
/**
* Gets the layers texture X displacment scale, useful for animation
* @return {Number} the current scale
*/
GLGE.MaterialLayer.prototype.getDScaleZ=function(){
	return this.dScaleZ;
};


/**
* Sets the layers texture X Rotation
* @param {Number} value the amount to roate the texture
*/
GLGE.MaterialLayer.prototype.setRotX=function(value){
	this.matrix=null;
	this.rotX=value;
	return this;
};
/**
* Gets the layers texture X rotate
* @return {Number} the current rotate
*/
GLGE.MaterialLayer.prototype.getRotX=function(){
	return this.rotX;
};
/**
* Sets the layers texture Y rotate
* @param {Number} value the amount to rotate the texture
*/
GLGE.MaterialLayer.prototype.setRotY=function(value){
	this.matrix=null;
	this.rotY=value;
	return this;
};
/**
* Gets the layers texture Y rotate
* @return {Number} the current rotate
*/
GLGE.MaterialLayer.prototype.getRotY=function(){
	return this.rotY;
};
/**
* Sets the layers texture Z rotate
* @param {Number} value the amount to rotate the texture
*/
GLGE.MaterialLayer.prototype.setRotZ=function(value){
	this.matrix=null;
	this.rotZ=value;
	return this;
};
/**
* Gets the layers texture Z rotate
* @return {Number} the current rotate
*/
GLGE.MaterialLayer.prototype.getRotZ=function(){
	return this.rotZ;
};
/**
* Sets the layers texture X displacment rotation, useful for animation
* @param {Number} value the amount to rotation the texture
*/
GLGE.MaterialLayer.prototype.setDRotX=function(value){
	this.matrix=null;
	this.dRotX=value;
	return this;
};
/**
* Gets the layers texture X displacment rotation, useful for animation
* @return {Number} the current rotation
*/
GLGE.MaterialLayer.prototype.getDRotX=function(){
	return this.dRotX;
};
/**
* Sets the layers texture Y displacment rotation, useful for animation
* @param {Number} value the amount to rotaion the texture
*/
GLGE.MaterialLayer.prototype.setDRotY=function(value){
	this.matrix=null;
	this.dRotY=value;
	return this;
};
/**
* Gets the layers texture Y displacment rotation, useful for animation
* @return {Number} the current rotation
*/
GLGE.MaterialLayer.prototype.getDRotY=function(){
	return this.dRotY;
};
/**
* Sets the layers texture Z displacment rotation, useful for animation
* @param {Number} value the amount to rotation the texture
*/
GLGE.MaterialLayer.prototype.setDRotZ=function(value){
	this.matrix=null;
	this.dRotZ=value;
	return this;
};
/**
* Gets the layers texture X displacment rotation, useful for animation
* @return {Number} the current rotation
*/
GLGE.MaterialLayer.prototype.getDRotZ=function(){
	return this.dRotZ;
};

/**
* Sets the layers blending mode
* @param {Number} value the blend mode for the layer
*/
GLGE.MaterialLayer.prototype.setBlendMode=function(value){
	this.blendMode=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the layers tblending mode
* @return {Number} the blend mode for the layer
*/
GLGE.MaterialLayer.prototype.getBlendMode=function(){
	return this.blendMode;
};




/**
* @class The Material class creates materials to be applied to objects in the graphics engine
* @see GLGE.Object
* @augments GLGE.Animatable
* @augments GLGE.QuickNotation
* @augments GLGE.JSONLoader
* @augments GLGE.Events
*/
GLGE.Material=function(uid){
	GLGE.Assets.registerAsset(this,uid);
	this.layers=[];
	this.layerlisteners=[];
	this.textures=[];
	this.lights=[];
	this.color={r:1,g:1,b:1,a:1};
	this.specColor={r:1,g:1,b:1};
	this.reflect=0.8;
	this.shine=10;
	this.specular=1;
	this.emit=0;
	this.alpha=1;
};
GLGE.augment(GLGE.Animatable,GLGE.Material);
GLGE.augment(GLGE.QuickNotation,GLGE.Material);
GLGE.augment(GLGE.JSONLoader,GLGE.Material);
GLGE.augment(GLGE.Events,GLGE.Material);


/**
 * @name GLGE.Material#shaderupdate
 * @event fires when the shader for this material needs updating
 * @param {object} data
 */

/**
* @constant 
* @description Flag for material colour
*/
GLGE.M_COLOR=1; 
/**
* @constant 
* @description Flag for material normal
*/
GLGE.M_NOR=2;
/**
* @constant 
* @description Flag for material alpha
*/
GLGE.M_ALPHA=4; 
/**
* @constant 
* @description Flag for material specular color
*/
GLGE.M_SPECCOLOR=8; 
/**
* @constant 
* @description Flag for material specular cvalue
*/
GLGE.M_SPECULAR=16;
/**
* @constant 
* @description Flag for material shineiness
*/
GLGE.M_SHINE=32; 
/**
* @constant 
* @description Flag for material reflectivity
*/
GLGE.M_REFLECT=64;
/**
* @constant 
* @description Flag for material emision
*/
GLGE.M_EMIT=128;
/**
* @constant 
* @description Flag for material alpha
*/
GLGE.M_ALPHA=256;
/**
* @constant 
* @description Flag for masking with textures red value
*/
GLGE.M_MSKR=512;
/**
* @constant 
* @description Flag for masking with textures green value
*/
GLGE.M_MSKG=1024;
/**
* @constant 
* @description Flag for masking with textures blue value
*/
GLGE.M_MSKB=2048;
/**
* @constant 
* @description Flag for masking with textures alpha value
*/
GLGE.M_MSKA=4096;
/**
* @constant 
* @description Flag for mapping of the height in parallax mapping
*/
GLGE.M_HEIGHT=8192;

/**
* @constant 
* @description Enumeration for first UV layer
*/
GLGE.UV1=0;
/**
* @constant 
* @description Enumeration for second UV layer
*/
GLGE.UV2=1;
/**
* @constant 
* @description Enumeration for normal texture coords
*/
GLGE.MAP_NORM=3;

/**
* @constant 
* @description Enumeration for object texture coords
*/
GLGE.MAP_OBJ=4;

/**
* @constant 
* @description Enumeration for reflection coords
*/
GLGE.MAP_REF=5;

/**
* @constant 
* @description Enumeration for environment coords
*/
GLGE.MAP_ENV=6;

/**
* @constant 
* @description Enumeration for view coords
*/
GLGE.MAP_VIEW=7;

/**
* @constant 
* @description Enumeration for mix blending mode
*/
GLGE.BL_MIX=0;

/**
* @constant 
* @description Enumeration for mix blending mode
*/
GLGE.BL_MUL=1;
	
GLGE.Material.prototype.layers=null;
GLGE.Material.prototype.className="Material";
GLGE.Material.prototype.textures=null;
GLGE.Material.prototype.color=null;
GLGE.Material.prototype.specColor=null;
GLGE.Material.prototype.specular=null;
GLGE.Material.prototype.emit=null;
GLGE.Material.prototype.shine=null;
GLGE.Material.prototype.reflect=null;
GLGE.Material.prototype.lights=null;
GLGE.Material.prototype.alpha=null;
GLGE.Material.prototype.shadow=true;
/**
* Sets the flag indicateing the material should or shouldn't recieve shadows
* @param {boolean} value The recieving shadow flag
*/
GLGE.Material.prototype.setShadow=function(value){
	this.shadow=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* gets the show flag
* @returns {boolean} The shadow flag
*/
GLGE.Material.prototype.getShadow=function(value){
	return this.shadow;
};
/**
* Sets the base colour of the material
* @param {string} color The colour of the material
*/
GLGE.Material.prototype.setColor=function(color){
	if(!color.r){
		color=GLGE.colorParse(color);
	}
	this.color={r:color.r,g:color.g,b:color.b};
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Sets the red base colour of the material
* @param {Number} r The new red level 0-1
*/
GLGE.Material.prototype.setColorR=function(value){
	this.color.r=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Sets the green base colour of the material
* @param {Number} g The new green level 0-1
*/
GLGE.Material.prototype.setColorG=function(value){
	this.color.g=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Sets the blue base colour of the material
* @param {Number} b The new blue level 0-1
*/
GLGE.Material.prototype.setColorB=function(value){
	this.color.b=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the current base color of the material
* @return {[r,g,b]} The current base color
*/
GLGE.Material.prototype.getColor=function(){
	return this.color;
};
/**
* Sets the base specular colour of the material
* @param {string} color The new specular colour
*/
GLGE.Material.prototype.setSpecularColor=function(color){
	if(!color.r){
		color=GLGE.colorParse(color);
	}
	this.specColor={r:color.r,g:color.g,b:color.b};
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the current base specular color of the material
* @return {[r,g,b]} The current base specular color
*/
GLGE.Material.prototype.getSpecularColor=function(){
	return this.specColor;
};
/**
* Sets the alpha of the material
* @param {Number} value how much alpha
*/
GLGE.Material.prototype.setAlpha=function(value){
	this.alpha=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the alpha of the material
* @return {Number} The current alpha of the material
*/
GLGE.Material.prototype.getAlpha=function(){
	return this.alpha;
};
/**
* Sets the specular of the material
* @param {Number} value how much specular
*/
GLGE.Material.prototype.setSpecular=function(value){
	this.specular=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the specular of the material
* @return {Number} The current specular of the material
*/
GLGE.Material.prototype.getSpecular=function(){
	return this.specular;
};
/**
* Sets the shininess of the material
* @param {Number} value how much shine
*/
GLGE.Material.prototype.setShininess=function(value){
	this.shine=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the shininess of the material
* @return {Number} The current shininess of the material
*/
GLGE.Material.prototype.getShininess=function(){
	return this.shine;
};
/**
* Sets how much the material should emit
* @param {Number} value how much to emit (0-1)
*/
GLGE.Material.prototype.setEmit=function(value){
	this.emit=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the amount this material emits
* @return {Number} The emit value for the material
*/
GLGE.Material.prototype.getEmit=function(){
	return this.emit;
};
/**
* Sets reflectivity of the material
* @param {Number} value how much to reflect (0-1)
*/
GLGE.Material.prototype.setReflectivity=function(value){
	this.reflect=value;
	this.fireEvent("shaderupdate",{});
	return this;
};
/**
* Gets the materials reflectivity
* @return {Number} The reflectivity of the material
*/
GLGE.Material.prototype.getReflectivity=function(){
	return this.reflect;
};

/**
* Add a new layer to the material
* @param {MaterialLayer} layer The material layer to add to the material
*/
GLGE.Material.prototype.addMaterialLayer=function(layer){
	if(typeof layer=="string")  layer=GLGE.Assets.get(layer);
	this.layers.push(layer);
	var material=this;
	var listener=function(event){
		material.fireEvent("shaderupdate",{});
	};
	this.layerlisteners.push(listener);
	layer.addEventListener("shaderupdate",listener);
	this.fireEvent("shaderupdate",{});
	return this;
};

/**
* Removes a layer from the material
* @param {MaterialLayer} layer The material layer to remove
*/
GLGE.Material.prototype.removeMaterialLayer=function(layer){
	var idx=this.layers.indexOf(layer);
	if(idx>=0){
		this.layers.splice(idx,1);
		layer.removeEventListener("shaderupdate",this.layerlisteners[idx]);
		this.layerlisteners.splice(idx,1);
		this.fireEvent("shaderupdate",{});
	}
	return this;
};

/**
* Gets all the materials layers
* @returns {GLGE.MaterialLayer[]} all of the layers contained within this material
*/
GLGE.Material.prototype.getLayers=function(){
	return this.layers;
};
/**
* Generate the code required to calculate the texture coords for each layer
* @private
*/
GLGE.Material.prototype.getLayerCoords=function(){
		var shader=[];
		shader.push("vec4 texturePos;\n"); 
		for(i=0; i<this.layers.length;i++){
			shader.push("textureCoords"+i+"=vec3(0.0,0.0,0.0);\n"); 
			
			if(this.layers[i].mapinput==GLGE.UV1 || this.layers[i].mapinput==GLGE.UV2){
				shader.push("texturePos=vec4(vec2(UVCoord["+(this.layers[i].mapinput*2)+"],(1.0-UVCoord["+(this.layers[i].mapinput*2+1)+"])),1.0,1.0);\n");
			}
			
			if(this.layers[i].mapinput==GLGE.MAP_NORM){
				shader.push("texturePos=vec4(normalize(n.xyz),1.0);\n");
			}
			if(this.layers[i].mapinput==GLGE.MAP_OBJ){
				shader.push("texturePos=vec4(normalize(OBJCoord.xyz),1.0);\n");
			}
			
			if(this.layers[i].mapinput==GLGE.MAP_REF){
				//will need to do in fragment to take the normal maps into account!
				shader.push("texturePos=vec4(reflect(normalize(eyevec.xyz),normalize(n.xyz)),1.0);\n");
			}
			

			
			if(this.layers[i].mapinput==GLGE.MAP_ENV){
				//will need to do in fragment to take the normal maps into account!
				shader.push("texturePos=envMat * vec4(reflect(normalize(eyevec.xyz),normalize(n.xyz)),1.0);\n");
			}
			
			shader.push("textureCoords"+i+"=(layer"+i+"Matrix * texturePos).xyz;\n");			
			
		}
		
		return shader.join("");
}
/**
* Generate the fragment shader program for this material
* @private
*/
GLGE.Material.prototype.getVertexVarying=function(){
	var shader=[];
	for(i=0; i<this.layers.length;i++){
		shader.push("uniform mat4 layer"+i+"Matrix;\n");  
		shader.push("varying vec3 textureCoords"+i+";\n"); 
	}
	return shader.join("");
}

GLGE.Material.prototype.registerPasses=function(gl,object){
	for(var i=0; i<this.textures.length;i++){
		if(this.textures[i].registerPasses) this.textures[i].registerPasses(gl,object);
	}
}

/**
* Generate the fragment shader program for this material
* @private
*/
GLGE.Material.prototype.getFragmentShader=function(lights){
	var shader="#ifdef GL_ES\nprecision mediump float;\n#endif\n";
	var tangent=false;
	for(var i=0; i<lights.length;i++){
		if(lights[i].type==GLGE.L_POINT || lights[i].type==GLGE.L_SPOT || lights[i].type==GLGE.L_DIR){
			shader=shader+"varying vec3 lightvec"+i+";\n"; 
			shader=shader+"varying vec3 tlightvec"+i+";\n"; 
			shader=shader+"varying vec3 lightpos"+i+";\n"; 
			shader=shader+"varying vec3 tlightdir"+i+";\n"; 
			shader=shader+"varying float lightdist"+i+";\n";  
			shader=shader+"varying vec2 spotCoords"+i+";\n"; 
		}
	}
	shader=shader+"varying vec3 n;\n";  
	shader=shader+"varying vec3 b;\n";  
	shader=shader+"varying vec3 t;\n";  
	shader=shader+"varying vec4 UVCoord;\n";
	shader=shader+"varying vec3 eyevec;\n"; 
	shader=shader+"varying vec3 OBJCoord;\n";
	shader=shader+"varying vec3 teyevec;\n";

	//texture uniforms
	for(var i=0; i<this.textures.length;i++){
		if(this.textures[i].className=="Texture") shader=shader+"uniform sampler2D TEXTURE"+i+";\n";
		if(this.textures[i].className=="TextureCanvas") shader=shader+"uniform sampler2D TEXTURE"+i+";\n";
		if(this.textures[i].className=="TextureVideo") shader=shader+"uniform sampler2D TEXTURE"+i+";\n";
		if(this.textures[i].className=="TextureCube") shader=shader+"uniform samplerCube TEXTURE"+i+";\n";
	}
	
	var cnt=0;
	var shadowlights=[];
	var num;
	for(var i=0; i<lights.length;i++){
			shader=shader+"uniform vec3 lightcolor"+i+";\n";  
			shader=shader+"uniform vec3 lightAttenuation"+i+";\n";  
			shader=shader+"uniform float spotCosCutOff"+i+";\n";  
			shader=shader+"uniform float spotExp"+i+";\n";  
			shader=shader+"uniform vec3 lightdir"+i+";\n";  
			shader=shader+"uniform mat4 lightmat"+i+";\n";
			shader=shader+"uniform float shadowbias"+i+";\n"; 
			shader=shader+"uniform int shadowsamples"+i+";\n";  
			shader=shader+"uniform float shadowsoftness"+i+";\n";  
			shader=shader+"uniform bool castshadows"+i+";\n";  
			shader=shader+"varying vec4 spotcoord"+i+";\n";  
			if(lights[i].getCastShadows() && this.shadow){
				num=this.textures.length+(cnt++);
				shader=shader+"uniform sampler2D TEXTURE"+num+";\n";
				shadowlights[i]=num;
			}
	}
	for(i=0; i<this.layers.length;i++){		
		shader=shader+"varying vec3 textureCoords"+i+";\n";
		shader=shader+"uniform float layeralpha"+i+";\n";
		if((this.layers[i].mapto & GLGE.M_HEIGHT) == GLGE.M_HEIGHT){
			shader=shader+"uniform float layerheight"+i+";\n";
		}
	}
	
	shader=shader+"uniform vec4 baseColor;\n";
	shader=shader+"uniform vec3 specColor;\n";
	shader=shader+"uniform float shine;\n";
	shader=shader+"uniform float specular;\n";
	shader=shader+"uniform float reflective;\n";
	shader=shader+"uniform float emit;\n";
	shader=shader+"uniform float alpha;\n";
	shader=shader+"uniform vec3 amb;\n";
	shader=shader+"uniform float fognear;\n";
	shader=shader+"uniform float fogfar;\n";
	shader=shader+"uniform int fogtype;\n";
	shader=shader+"uniform vec3 fogcolor;\n";
	shader=shader+"uniform float far;\n";
	shader=shader+"uniform mat4 worldInverseTranspose;\n"; 
	shader=shader+"uniform mat4 projection;\n"; 
    
	shader=shader+"void main(void)\n";
	shader=shader+"{\n";
	shader=shader+"float att;\n"; 
	shader=shader+"int texture;\n"; 
	shader=shader+"float mask=1.0;\n";
	shader=shader+"float spec=specular;\n"; 
	shader=shader+"vec3 specC=specColor;\n"; 
	shader=shader+"vec4 view;\n"; 
	shader=shader+"vec3 textureCoords=vec3(0.0,0.0,0.0);\n"; 
	shader=shader+"float ref=reflective;\n";
	shader=shader+"float sh=shine;\n"; 
	shader=shader+"float em=emit;\n"; 
	shader=shader+"float al=alpha;\n"; 
	shader=shader+"vec4 normalmap= vec4(n,0.0);\n"
	shader=shader+"vec4 color = baseColor;"; //set the initial color
	shader=shader+"float pheight=0.0;\n"
	shader=shader+"vec3 textureHeight=vec3(0.0,0.0,0.0);\n";
	for(i=0; i<this.layers.length;i++){
		shader=shader+"textureCoords=textureCoords"+i+"+textureHeight;\n";
		shader=shader+"mask=layeralpha"+i+"*mask;\n";
		
		if(this.layers[i].mapinput==GLGE.MAP_VIEW){
			//will need to do in fragment to take the normal maps into account!
			shader=shader+"view=projection * vec4(-eyevec,1.0);\n";
			shader=shader+"textureCoords=view.xyz/view.w*0.5+0.5;\n";
			shader=shader+"textureCoords=textureCoords+textureHeight;\n";
		}
			
		if(this.layers[i].getTexture().className=="Texture" || this.layers[i].getTexture().className=="TextureCanvas"  || this.layers[i].getTexture().className=="TextureVideo" ){
			var txcoord="xy";
			var sampletype="2D";
		}else{
			var txcoord="xyz";
			var sampletype="Cube";
		}
		
		if((this.layers[i].mapto & GLGE.M_COLOR) == GLGE.M_COLOR){			
			if(this.layers[i].blendMode==GLGE.BL_MUL){
				shader=shader+"color = color*(1.0-mask) + color*texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+")*mask;\n";
			}
			else 
			{
				shader=shader+"color = color*(1.0-mask) + texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+")*mask;\n";
			}
		}        
		
		if((this.layers[i].mapto & GLGE.M_HEIGHT) == GLGE.M_HEIGHT){
			//do paralax stuff
			shader=shader+"pheight = texture2D(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").x;\n";
			shader=shader+"textureHeight =vec3((layerheight"+i+"* (pheight-0.5)  * normalize(teyevec).xy*vec2(1.0,-1.0)),0.0);\n";
		}
		if((this.layers[i].mapto & GLGE.M_SPECCOLOR) == GLGE.M_SPECCOLOR){
			shader=shader+"specC = specC*(1.0-mask) + texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").rgb*mask;\n";
		}
		if((this.layers[i].mapto & GLGE.M_MSKR) == GLGE.M_MSKR){
			shader=shader+"mask = texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").r;\n";
		}
		if((this.layers[i].mapto & GLGE.M_MSKG) == GLGE.M_MSKG){
			shader=shader+"mask = texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").g;\n";
		}
		if((this.layers[i].mapto & GLGE.M_MSKB) == GLGE.M_MSKB){
			shader=shader+"mask = texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").b;\n";
		}
		if((this.layers[i].mapto & GLGE.M_MSKA) == GLGE.M_MSKA){
			shader=shader+"mask = texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").a;\n";
		}
		if((this.layers[i].mapto & GLGE.M_SPECULAR) == GLGE.M_SPECULAR){
			shader=shader+"spec = spec*(1.0-mask) + texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").r*mask;\n";
		}
		if((this.layers[i].mapto & GLGE.M_REFLECT) == GLGE.M_REFLECT){
			shader=shader+"ref = ref*(1.0-mask) + texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").g*mask;\n";
		}
		if((this.layers[i].mapto & GLGE.M_SHINE) == GLGE.M_SHINE){
			shader=shader+"sh = sh*(1.0-mask) + texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").b*mask*255.0;\n";
		}
		if((this.layers[i].mapto & GLGE.M_EMIT) == GLGE.M_EMIT){
			shader=shader+"em = em*(1.0-mask) + texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").r*mask;\n";
		}
		if((this.layers[i].mapto & GLGE.M_NOR) == GLGE.M_NOR){
			shader=shader+"normalmap = normalmap*(1.0-mask) + texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+")*mask;\n";
			tangent=true;
		}
		if((this.layers[i].mapto & GLGE.M_ALPHA) == GLGE.M_ALPHA){
			shader=shader+"al = al*(1.0-mask) + texture"+sampletype+"(TEXTURE"+this.layers[i].texture.idx+", textureCoords."+txcoord+").a*mask;\n";
		}
	}		
	if(tangent){
		shader=shader+"vec3 normal = normalize(normalmap.rgb)*2.0-1.0;\n";
	}else{
		shader=shader+"vec3 normal = normalize(n);\n";
	}

	shader=shader+"vec3 lightvalue=amb;\n"; 
	shader=shader+"vec3 specvalue=vec3(0.0,0.0,0.0);\n"; 
	shader=shader+"float dotN,spotEffect;";
	shader=shader+"vec3 lightvec=vec3(0.0,0.0,0.0);";
	shader=shader+"vec3 viewvec=vec3(0.0,0.0,0.0);";
	shader=shader+"float spotmul=0.0;";
	shader=shader+"float spotsampleX=0.0;";
	shader=shader+"float spotsampleY=0.0;";
	shader=shader+"float totalweight=0.0;";
	shader=shader+"int cnt=0;";
	shader=shader+"vec2 spotoffset=vec2(0.0,0.0);";
	for(var i=0; i<lights.length;i++){
	
		if(tangent){
			shader=shader+"lightvec=tlightvec"+i+"*vec3(-1.0,-1.0,1.0);\n";  
			shader=shader+"normal.z=(normal.z+1.0)/2.0;\n";  
			shader=shader+"viewvec=teyevec*vec3(-1.0,-1.0,1.0);\n";  
		}else{
			shader=shader+"lightvec=lightvec"+i+";\n";  
			shader=shader+"viewvec=eyevec;\n"; 
		}
		
		if(lights[i].type==GLGE.L_POINT){ 
			shader=shader+"dotN=max(dot(normal,normalize(-lightvec)),0.0);\n";       
			shader=shader+"if(dotN>0.0){\n";
			shader=shader+"att = 1.0 / (lightAttenuation"+i+"[0] + lightAttenuation"+i+"[1] * lightdist"+i+" + lightAttenuation"+i+"[2] * lightdist"+i+" * lightdist"+i+");\n";
			if(lights[i].diffuse){
				shader=shader+"lightvalue += att * dotN * lightcolor"+i+";\n";
			}
			if(lights[i].specular){
				shader=shader+"specvalue += att * specC * lightcolor"+i+" * spec  * pow(max(dot(reflect(normalize(lightvec), normal),normalize(viewvec)),0.0), sh);\n";
			}
			
			shader=shader+"}\n";
			
			
		}
		shader=shader+"spotEffect = 0.0;\n";
		if(lights[i].type==GLGE.L_SPOT){
			shader=shader+"spotEffect = dot(normalize(lightdir"+i+"), normalize(-lightvec"+i+"));";	
			shader=shader+"if (spotEffect > spotCosCutOff"+i+") {\n";		
			shader=shader+"spotEffect = pow(spotEffect, spotExp"+i+");";
			//spot shadow stuff
			if(lights[i].getCastShadows() && this.shadow){
				shader=shader+"if(castshadows"+i+"){\n";
				shader=shader+"vec4 dist=texture2D(TEXTURE"+shadowlights[i]+", (((spotcoord"+i+".xy)/spotcoord"+i+".w)+1.0)/2.0);\n";
				shader=shader+"float depth = dot(dist, vec4(0.000000059604644775390625,0.0000152587890625,0.00390625,1.0))*10000.0;\n";
				shader=shader+"spotmul=0.0;\n";
				shader=shader+"totalweight=0.0;\n";
				shader=shader+"if((depth+shadowbias"+i+"-length(lightvec"+i+"))<0.0) {spotmul=1.0; totalweight=1.0;}\n";
				shader=shader+"if(shadowsamples"+i+">0){\n";
					shader=shader+"for(cnt=0; cnt<4; cnt++){;\n";
						shader=shader+"spotsampleX=-0.707106781;spotsampleY=-0.707106781;\n"; 
						shader=shader+"if(cnt==0 || cnt==3) spotsampleX=0.707106781;\n"; 
						shader=shader+"if(cnt==1 || cnt==3) spotsampleY=0.707106781;\n"; 
						shader=shader+"spotoffset=vec2(spotsampleX,spotsampleY)*0.5;\n";
						shader=shader+"dist=texture2D(TEXTURE"+shadowlights[i]+", (((spotcoord"+i+".xy)/spotcoord"+i+".w)+1.0)/2.0+spotoffset*shadowsoftness"+i+");\n";
						shader=shader+"depth = dot(dist, vec4(0.000000059604644775390625,0.0000152587890625,0.00390625,1.0))*100.0;\n";
						shader=shader+"if((depth+shadowbias"+i+"-length(lightvec"+i+"))<0.0){\n";
						shader=shader+"spotmul+=length(spotoffset);\n";
						shader=shader+"}\n";
						shader=shader+"totalweight+=length(spotoffset);\n";
					shader=shader+"};\n";
				shader=shader+"};\n";
				shader=shader+"if(totalweight!=spotmul){\n";
					shader=shader+"spotmul=0.0;\n";
					shader=shader+"totalweight=0.0;\n";
					shader=shader+"for(cnt=0; cnt<shadowsamples"+i+"*2; cnt++){;\n";
						shader=shader+"spotsampleX=(fract(sin(dot(spotcoord"+i+".xy + vec2(float(cnt)),vec2(12.9898,78.233))) * 43758.5453)-0.5)*2.0;\n"; //generate random number
						shader=shader+"spotsampleY=(fract(sin(dot(spotcoord"+i+".yz + vec2(float(cnt)),vec2(12.9898,78.233))) * 43758.5453)-0.5)*2.0;\n"; //generate random number
						shader=shader+"spotoffset=vec2(spotsampleX,spotsampleY);\n";
						shader=shader+"dist=texture2D(TEXTURE"+shadowlights[i]+", (((spotcoord"+i+".xy)/spotcoord"+i+".w)+1.0)/2.0+spotoffset*shadowsoftness"+i+");\n";
						shader=shader+"depth = dot(dist, vec4(0.000000059604644775390625,0.0000152587890625,0.00390625,1.0))*100.0;\n";
						shader=shader+"if((depth+shadowbias"+i+"-length(lightvec"+i+"))<0.0){\n";
						shader=shader+"spotmul+=length(spotoffset);\n";
						shader=shader+"}\n";
						shader=shader+"totalweight+=length(spotoffset);\n";
					shader=shader+"};\n";
				shader=shader+"}\n";
				
				shader=shader+"if(totalweight>0.0) spotEffect=spotEffect*pow(1.0-spotmul/totalweight,3.0);\n";
				shader=shader+"}";
			}

			
			shader=shader+"dotN=max(dot(normal,normalize(-lightvec)),0.0);\n";       
			shader=shader+"if(dotN>0.0){\n";
			shader=shader+"att = spotEffect / (lightAttenuation"+i+"[0] + lightAttenuation"+i+"[1] * lightdist"+i+" + lightAttenuation"+i+"[2] * lightdist"+i+" * lightdist"+i+");\n";
			if(lights[i].diffuse){
				shader=shader+"lightvalue += att * dotN * lightcolor"+i+";\n";
			}
			if(lights[i].specular){
				shader=shader+"specvalue += att * specC * lightcolor"+i+" * spec  * pow(max(dot(reflect(normalize(lightvec), normal),normalize(viewvec)),0.0), sh);\n";
			}
			shader=shader+"}\n}\n";
		}
		if(lights[i].type==GLGE.L_DIR){
			shader=shader+"dotN=max(dot(normal,-normalize(lightvec)),0.0);\n";    
			shader=shader+"if(dotN>0.0){\n";			
			if(lights[i].diffuse){
				shader=shader+"lightvalue += dotN * lightcolor"+i+";\n";
			}
			if(lights[i].specular){
				shader=shader+"specvalue += specC * lightcolor"+i+" * spec  * pow(max(dot(reflect(normalize(lightvec), normal),normalize(viewvec)),0.0), sh);\n";
			}
			shader=shader+"}\n";
		}
	}
	shader=shader+"float fogfact=1.0;";
	shader=shader+"if(fogtype=="+GLGE.FOG_QUADRATIC+") fogfact=clamp(pow(max((fogfar - length(eyevec)) / (fogfar - fognear),0.0),2.0),0.0,1.0);\n";
	shader=shader+"if(fogtype=="+GLGE.FOG_LINEAR+") fogfact=clamp((fogfar - length(eyevec)) / (fogfar - fognear),0.0,1.0);\n";
	
	shader=shader+"lightvalue = (lightvalue)*ref;\n";
	shader=shader+"if(em>0.0){lightvalue=vec3(1.0,1.0,1.0);  fogfact=1.0;}\n";
	shader=shader+"gl_FragColor =vec4(specvalue.rgb+color.rgb*(em+1.0)*lightvalue.rgb,al)*fogfact+vec4(fogcolor,al)*(1.0-fogfact);\n";
	//shader=shader+"gl_FragColor =texture2D(TEXTURE"+shadowlights[0]+", (((spotcoord0.xy)/spotcoord"+i+".w)+1.0)/2.0+textureHeight);\n";

	shader=shader+"}\n";
	return shader;
};
/**
* Set the uniforms needed to render this material
* @private
*/
GLGE.Material.prototype.textureUniforms=function(gl,shaderProgram,lights,object){
	if(this.animation) this.animate();
	if(shaderProgram.caches.baseColor!=this.color){
		gl.uniform4f(GLGE.getUniformLocation(gl,shaderProgram, "baseColor"), this.color.r,this.color.g,this.color.b,this.color.a);
		shaderProgram.caches.baseColor=this.color;
	}
	if(shaderProgram.caches.specColor!=this.specColor){
		gl.uniform3f(GLGE.getUniformLocation(gl,shaderProgram, "specColor"), this.specColor.r,this.specColor.g,this.specColor.b);
		shaderProgram.caches.specColor=this.specColor;
	}
	if(shaderProgram.caches.specular!=this.specular){
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "specular"), this.specular);
		shaderProgram.caches.specular=this.specular;
	}
	if(shaderProgram.caches.shine!=this.shine){
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "shine"), this.shine);
		shaderProgram.caches.shine=this.shine;
	}
	if(shaderProgram.caches.reflect!=this.reflect){
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "reflective"), this.reflect);
		shaderProgram.caches.reflect=this.reflect;
	}
	if(shaderProgram.caches.emit!=this.emit){
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "emit"), this.emit);
		shaderProgram.caches.emit=this.emit;
	}
	if(shaderProgram.caches.alpha!=this.alpha){
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "alpha"), this.alpha);
		shaderProgram.caches.alpha=this.alpha;
	}
	
	var cnt=0;
	var num=0;
	for(var i=0; i<lights.length;i++){
		gl.uniform3f(GLGE.getUniformLocation(gl,shaderProgram, "lightcolor"+i), lights[i].color.r,lights[i].color.g,lights[i].color.b);
		gl.uniform3f(GLGE.getUniformLocation(gl,shaderProgram, "lightAttenuation"+i), lights[i].constantAttenuation,lights[i].linearAttenuation,lights[i].quadraticAttenuation);
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "spotCosCutOff"+i), lights[i].spotCosCutOff);
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "spotExp"+i), lights[i].spotExponent);
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "shadowbias"+i), lights[i].shadowBias);
		gl.uniform1i(GLGE.getUniformLocation(gl,shaderProgram, "castshadows"+i), lights[i].castShadows);
		gl.uniform1i(GLGE.getUniformLocation(gl,shaderProgram, "shadowsamples"+i), lights[i].samples);
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "shadowsoftness"+i), lights[i].softness);
		    
		//shadow code
		if(lights[i].getCastShadows() && this.shadow && this.emit==0) {
			num=this.textures.length+(cnt++);
			gl.activeTexture(gl["TEXTURE"+num]);
			gl.bindTexture(gl.TEXTURE_2D, lights[i].texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.generateMipmap(gl.TEXTURE_2D);
		    
			gl.uniform1i(GLGE.getUniformLocation(gl,shaderProgram, "TEXTURE"+num), num);
		}
	
			
	}
	
	if(!shaderProgram.glarrays.layermat) shaderProgram.glarrays.layermat=[];
	

			
	var scale,offset;
	for(i=0; i<this.layers.length;i++){
		if(this.layers[i].animation) this.layers[i].animate();
		scale=this.layers[i].getScale();
		offset=this.layers[i].getOffset();		
		if(!shaderProgram.glarrays.layermat[i]) shaderProgram.glarrays.layermat[i]=new Float32Array(this.layers[i].getMatrix());
			else GLGE.mat4gl(this.layers[i].getMatrix(),shaderProgram.glarrays.layermat[i]);	
		
		try{gl.uniformMatrix4fv(GLGE.getUniformLocation(gl,shaderProgram, "layer"+i+"Matrix"), true, shaderProgram.glarrays.layermat[i]);}catch(e){}
		
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "layeralpha"+i), this.layers[i].getAlpha());
		gl.uniform1f(GLGE.getUniformLocation(gl,shaderProgram, "layerheight"+i), this.layers[i].getHeight());
	}
    
	for(var i=0; i<this.textures.length;i++){
		
			gl.activeTexture(gl["TEXTURE"+i]);
			if(this.textures[i].doTexture(gl,object)){
			}
			gl.uniform1i(GLGE.getUniformLocation(gl,shaderProgram, "TEXTURE"+i), i);
	}	
	
};
/**
* Adds a new texture to this material
* @param {String} image URL of the image to be used by the texture
* @return {Number} index of the new texture
*/
GLGE.Material.prototype.addTexture=function(texture){	
	if(typeof texture=="string")  texture=GLGE.Assets.get(texture);
	this.textures.push(texture);
	texture.idx=this.textures.length-1;
	this.fireEvent("shaderupdate",{});
	return this;
};
GLGE.Material.prototype.addTextureCube=GLGE.Material.prototype.addTexture;
GLGE.Material.prototype.addTextureCamera=GLGE.Material.prototype.addTexture;
GLGE.Material.prototype.addTextureCanvas=GLGE.Material.prototype.addTexture;
GLGE.Material.prototype.addTextureVideo=GLGE.Material.prototype.addTexture;




/**
* Closure Export
*/
function closure_export(){
if(GLGE.Message){
	GLGE["Message"]=GLGE.Message;
	GLGE.Message["parseMessage"]=GLGE.Message.parseMessage;
}

if(GLGE.Document){
	GLGE["Document"]=GLGE.Document
	GLGE.Document.prototype["getElementById"]=GLGE.Document.prototype.getElementById;
	GLGE.Document.prototype["getElement"]=GLGE.Document.prototype.getElement;
	GLGE.Document.prototype["load"]=GLGE.Document.prototype.load;
	GLGE.Document.prototype["loadDocument"]=GLGE.Document.prototype.loadDocument;
	GLGE.Document.prototype["onLoad"]=GLGE.Document.prototype.onLoad;
	GLGE.Document.prototype["addLoadListener"]=GLGE.Document.prototype.addLoadListener;
	GLGE.Document.prototype["removeLoadListener"]=GLGE.Document.prototype.removeLoadListener;
}


if(GLGE.Placeable){
	GLGE["Placeable"]=GLGE.Placeable;
	GLGE.Placeable.prototype["getRoot"]=GLGE.Placeable.prototype.getRoot;
	GLGE.Placeable.prototype["getRef"]=GLGE.Placeable.prototype.getRef;
	GLGE.Placeable.prototype["setId"]=GLGE.Placeable.prototype.setId;
	GLGE.Placeable.prototype["getId"]=GLGE.Placeable.prototype.getId;
	GLGE.Placeable.prototype["getLookat"]=GLGE.Placeable.prototype.getLookat;
	GLGE.Placeable.prototype["setLookat"]=GLGE.Placeable.prototype.setLookat;
	GLGE.Placeable.prototype["Lookat"]=GLGE.Placeable.prototype.Lookat;
	GLGE.Placeable.prototype["getRotOrder"]=GLGE.Placeable.prototype.getRotOrder;
	GLGE.Placeable.prototype["setRotOrder"]=GLGE.Placeable.prototype.setRotOrder;
	GLGE.Placeable.prototype["getRotMatrix"]=GLGE.Placeable.prototype.getRotMatrix;
	GLGE.Placeable.prototype["setRotMatrix"]=GLGE.Placeable.prototype.setRotMatrix;
	GLGE.Placeable.prototype["setLocX"]=GLGE.Placeable.prototype.setLocX;
	GLGE.Placeable.prototype["setLocY"]=GLGE.Placeable.prototype.setLocY;
	GLGE.Placeable.prototype["setLocZ"]=GLGE.Placeable.prototype.setLocZ;
	GLGE.Placeable.prototype["setLoc"]=GLGE.Placeable.prototype.setLoc;
	GLGE.Placeable.prototype["setDLocX"]=GLGE.Placeable.prototype.setDLocX;
	GLGE.Placeable.prototype["setDLocY"]=GLGE.Placeable.prototype.setDLocY;
	GLGE.Placeable.prototype["setDLocZ"]=GLGE.Placeable.prototype.setDLocZ;
	GLGE.Placeable.prototype["setDLoc"]=GLGE.Placeable.prototype.setDLoc;
	GLGE.Placeable.prototype["setQuatX"]=GLGE.Placeable.prototype.setQuatX;
	GLGE.Placeable.prototype["setQuatY"]=GLGE.Placeable.prototype.setQuatY;
	GLGE.Placeable.prototype["setQuatZ"]=GLGE.Placeable.prototype.setQuatZ;
	GLGE.Placeable.prototype["setQuatW"]=GLGE.Placeable.prototype.setQuatW;
	GLGE.Placeable.prototype["setQuat"]=GLGE.Placeable.prototype.setQuat;
	GLGE.Placeable.prototype["setRotX"]=GLGE.Placeable.prototype.setRotX;
	GLGE.Placeable.prototype["setRotY"]=GLGE.Placeable.prototype.setRotY;
	GLGE.Placeable.prototype["setRotZ"]=GLGE.Placeable.prototype.setRotZ;
	GLGE.Placeable.prototype["setRot"]=GLGE.Placeable.prototype.setRot;
	GLGE.Placeable.prototype["setDRotX"]=GLGE.Placeable.prototype.setDRotX;
	GLGE.Placeable.prototype["setDRotY"]=GLGE.Placeable.prototype.setDRotY;
	GLGE.Placeable.prototype["setDRotZ"]=GLGE.Placeable.prototype.setDRotZ;
	GLGE.Placeable.prototype["setDRot"]=GLGE.Placeable.prototype.setDRot;
	GLGE.Placeable.prototype["setScaleX"]=GLGE.Placeable.prototype.setScaleX;
	GLGE.Placeable.prototype["setScaleY"]=GLGE.Placeable.prototype.setScaleY;
	GLGE.Placeable.prototype["setScaleZ"]=GLGE.Placeable.prototype.setScaleZ;
	GLGE.Placeable.prototype["setScale"]=GLGE.Placeable.prototype.setScale;
	GLGE.Placeable.prototype["setDScaleX"]=GLGE.Placeable.prototype.setDScaleX;
	GLGE.Placeable.prototype["setDScaleY"]=GLGE.Placeable.prototype.setDScaleY;
	GLGE.Placeable.prototype["setDScaleZ"]=GLGE.Placeable.prototype.setDScaleZ;
	GLGE.Placeable.prototype["setDScale"]=GLGE.Placeable.prototype.setDScale;
	GLGE.Placeable.prototype["getLocX"]=GLGE.Placeable.prototype.getLocX;
	GLGE.Placeable.prototype["getLocY"]=GLGE.Placeable.prototype.getLocY;
	GLGE.Placeable.prototype["getLocZ"]=GLGE.Placeable.prototype.getLocZ;
	GLGE.Placeable.prototype["getDLocX"]=GLGE.Placeable.prototype.getDLocX;
	GLGE.Placeable.prototype["getDLocY"]=GLGE.Placeable.prototype.getDLocY;
	GLGE.Placeable.prototype["getDLocZ"]=GLGE.Placeable.prototype.getDLocZ;
	GLGE.Placeable.prototype["getQuatX"]=GLGE.Placeable.prototype.getQuatX;
	GLGE.Placeable.prototype["getQuatY"]=GLGE.Placeable.prototype.getQuatY;
	GLGE.Placeable.prototype["getQuatZ"]=GLGE.Placeable.prototype.getQuatZ;
	GLGE.Placeable.prototype["getQuatW"]=GLGE.Placeable.prototype.getQuatW;
	GLGE.Placeable.prototype["getRotX"]=GLGE.Placeable.prototype.getRotX;
	GLGE.Placeable.prototype["getRotY"]=GLGE.Placeable.prototype.getRotY;
	GLGE.Placeable.prototype["getRotZ"]=GLGE.Placeable.prototype.getRotZ;
	GLGE.Placeable.prototype["getDRotX"]=GLGE.Placeable.prototype.getDRotX;
	GLGE.Placeable.prototype["getDRotY"]=GLGE.Placeable.prototype.getDRotY;
	GLGE.Placeable.prototype["getDRotZ"]=GLGE.Placeable.prototype.getDRotZ;
	GLGE.Placeable.prototype["getScaleX"]=GLGE.Placeable.prototype.getScaleX;
	GLGE.Placeable.prototype["getScaleY"]=GLGE.Placeable.prototype.getScaleY;
	GLGE.Placeable.prototype["getScaleZ"]=GLGE.Placeable.prototype.getScaleZ;
	GLGE.Placeable.prototype["getDScaleX"]=GLGE.Placeable.prototype.getDScaleX;
	GLGE.Placeable.prototype["getDScaleY"]=GLGE.Placeable.prototype.getDScaleY;
	GLGE.Placeable.prototype["getDScaleZ"]=GLGE.Placeable.prototype.getDScaleZ;
	GLGE.Placeable.prototype["getPosition"]=GLGE.Placeable.prototype.getPosition;
	GLGE.Placeable.prototype["getRotation"]=GLGE.Placeable.prototype.getRotation;
	GLGE.Placeable.prototype["getScale"]=GLGE.Placeable.prototype.getScale;
	GLGE.Placeable.prototype["getModelMatrix"]=GLGE.Placeable.prototype.getModelMatrix;
}

if(GLGE.Animatable){
	GLGE["Animatable"]=GLGE.Animatable;
	GLGE.Animatable.prototype["animationStart"]=GLGE.Animatable.prototype.animationStart;
	GLGE.Animatable.prototype["animate"]=GLGE.Animatable.prototype.animate;
	GLGE.Animatable.prototype["setAnimation"]=GLGE.Animatable.prototype.setAnimation;
	GLGE.Animatable.prototype["getAnimation"]=GLGE.Animatable.prototype.getAnimation;
	GLGE.Animatable.prototype["setFrameRate"]=GLGE.Animatable.prototype.setFrameRate;
	GLGE.Animatable.prototype["getFrameRate"]=GLGE.Animatable.prototype.getFrameRate;
	GLGE.Animatable.prototype["setLoop"]=GLGE.Animatable.prototype.setLoop;
	GLGE.Animatable.prototype["getLoop"]=GLGE.Animatable.prototype.getLoop;
	GLGE.Animatable.prototype["isLooping"]=GLGE.Animatable.prototype.isLooping;
	GLGE.Animatable.prototype["setPaused"]=GLGE.Animatable.prototype.setPaused;
	GLGE.Animatable.prototype["getPaused"]=GLGE.Animatable.prototype.getPaused;
	GLGE.Animatable.prototype["togglePaused"]=GLGE.Animatable.prototype.togglePaused;
}

if(GLGE.BezTriple){
	GLGE["BezTriple"]=GLGE.BezTriple;
	GLGE.BezTriple.prototype["className"]=GLGE.BezTriple.prototype.className;
	GLGE.BezTriple.prototype["setX1"]=GLGE.BezTriple.prototype.setX1;
	GLGE.BezTriple.prototype["setY1"]=GLGE.BezTriple.prototype.setY1;
	GLGE.BezTriple.prototype["setX2"]=GLGE.BezTriple.prototype.setX2;
	GLGE.BezTriple.prototype["setY2"]=GLGE.BezTriple.prototype.setY2;
	GLGE.BezTriple.prototype["setX3"]=GLGE.BezTriple.prototype.setX3;
	GLGE.BezTriple.prototype["setY4"]=GLGE.BezTriple.prototype.setY4;
}

if(GLGE.LinearPoint){
	GLGE["LinearPoint"]=GLGE.LinearPoint;
	GLGE.LinearPoint.prototype["className"]=GLGE.LinearPoint.prototype.className;
	GLGE.LinearPoint.prototype["setX"]=GLGE.LinearPoint.prototype.setX;
	GLGE.LinearPoint.prototype["setY"]=GLGE.LinearPoint.prototype.setY;
}

if(GLGE.StepPoint){
	GLGE["StepPoint"]=GLGE.StepPoint;
	//missing here?
}

if(GLGE.AnimationCurve){
	GLGE["AnimationCurve"]=GLGE.AnimationCurve;
	GLGE.AnimationCurve.prototype["className"]=GLGE.AnimationCurve.prototype.className;
	GLGE.AnimationCurve.prototype["addPoint"]=GLGE.AnimationCurve.prototype.addPoint;
	GLGE.AnimationCurve.prototype["getValue"]=GLGE.AnimationCurve.prototype.getValue;
}

if(GLGE.AnimationVector){
	GLGE["AnimationVector"]=GLGE.AnimationVector;
	GLGE.AnimationVector.prototype["addCurve"]=GLGE.AnimationVector.prototype.addCurve;
	GLGE.AnimationVector.prototype["removeCurve"]=GLGE.AnimationVector.prototype.removeCurve;
	GLGE.AnimationVector.prototype["setFrames"]=GLGE.AnimationVector.prototype.setFrames;
	GLGE.AnimationVector.prototype["getFrames"]=GLGE.AnimationVector.prototype.getFrames;
}
if(GLGE.augment){
	GLGE["augment"]=GLGE.augment;
}

GLGE["G_NODE"]=GLGE.G_NODE;
GLGE["G_ROOT"]=GLGE.G_ROOT;

if(GLGE.Group){
	GLGE["Group"]=GLGE.Group;
	GLGE.Group.prototype["children"]=GLGE.Group.prototype.children;
	GLGE.Group.prototype["className"]=GLGE.Group.prototype.className;
	GLGE.Group.prototype["type"]=GLGE.Group.prototype.type;
	GLGE.Group.prototype["getObjects"]=GLGE.Group.prototype.getObjects;
	GLGE.Group.prototype["getLights"]=GLGE.Group.prototype.getLights;
	GLGE.Group.prototype["addChild"]=GLGE.Group.prototype.addChild;
	GLGE.Group.prototype["addObject"]=GLGE.Group.prototype.addObject;
	GLGE.Group.prototype["addGroup"]=GLGE.Group.prototype.addGroup;
	GLGE.Group.prototype["addText"]=GLGE.Group.prototype.addText;
	GLGE.Group.prototype["addSkeleton"]=GLGE.Group.prototype.addSkeleton;
	GLGE.Group.prototype["addLight"]=GLGE.Group.prototype.addLight;
	GLGE.Group.prototype["addCamera"]=GLGE.Group.prototype.addCamera;
	GLGE.Group.prototype["removeChild"]=GLGE.Group.prototype.removeChild;
	GLGE.Group.prototype["getChildren"]=GLGE.Group.prototype.getChildren;
}

if(GLGE.Text){
	GLGE["Text"]=GLGE.Text;
	GLGE.Text.prototype["className"]=GLGE.Text.prototype.className;
	GLGE.Text.prototype["getPickType"]=GLGE.Text.prototype.getPickType;
	GLGE.Text.prototype["setPickType"]=GLGE.Text.prototype.setPickType;
	GLGE.Text.prototype["getFont"]=GLGE.Text.prototype.getFont;
	GLGE.Text.prototype["setFont"]=GLGE.Text.prototype.setFont;
	GLGE.Text.prototype["getSize"]=GLGE.Text.prototype.getSize;
	GLGE.Text.prototype["setSize"]=GLGE.Text.prototype.setSize;
	GLGE.Text.prototype["getText"]=GLGE.Text.prototype.getText;
	GLGE.Text.prototype["setText"]=GLGE.Text.prototype.setText;
	GLGE.Text.prototype["setColor"]=GLGE.Text.prototype.setColor;
	GLGE.Text.prototype["setColorR"]=GLGE.Text.prototype.setColorR;
	GLGE.Text.prototype["setColorG"]=GLGE.Text.prototype.setColorG;
	GLGE.Text.prototype["setColorB"]=GLGE.Text.prototype.setColorB;
	GLGE.Text.prototype["getColor"]=GLGE.Text.prototype.getColor;
	GLGE.Text.prototype["setZtransparent"]=GLGE.Text.prototype.setZtransparent;
	GLGE.Text.prototype["isZtransparent"]=GLGE.Text.prototype.isZtransparent;
}

if(GLGE.MultiMaterial){
	GLGE["MultiMaterial"]=GLGE.MultiMaterial;
	GLGE.MultiMaterial.prototype["className"]=GLGE.MultiMaterial.prototype.className;
	GLGE.MultiMaterial.prototype["setMesh"]=GLGE.MultiMaterial.prototype.setMesh;
	GLGE.MultiMaterial.prototype["getMesh"]=GLGE.MultiMaterial.prototype.getMesh;
	GLGE.MultiMaterial.prototype["setMaterial"]=GLGE.MultiMaterial.prototype.setMaterial;
	GLGE.MultiMaterial.prototype["getMaterial"]=GLGE.MultiMaterial.prototype.getMaterial;
}

if(GLGE.Object instanceof Object){
	GLGE["Object"]=GLGE.Object;
	GLGE.Object.prototype["className"]=GLGE.Object.prototype.className;
	GLGE.Object.prototype["setZtransparent"]=GLGE.Object.prototype.setZtransparent;
	GLGE.Object.prototype["isZtransparent"]=GLGE.Object.prototype.isZtransparent;
	GLGE.Object.prototype["setSkeleton"]=GLGE.Object.prototype.setSkeleton;
	GLGE.Object.prototype["getSkeleton"]=GLGE.Object.prototype.getSkeleton;
	GLGE.Object.prototype["setMaterial"]=GLGE.Object.prototype.setMaterial;
	GLGE.Object.prototype["getMaterial"]=GLGE.Object.prototype.getMaterial;
	GLGE.Object.prototype["setMesh"]=GLGE.Object.prototype.setMesh;
	GLGE.Object.prototype["getMesh"]=GLGE.Object.prototype.getMesh;
	GLGE.Object.prototype["addMultiMaterial"]=GLGE.Object.prototype.addMultiMaterial;
	GLGE.Object.prototype["getMultiMaterials"]=GLGE.Object.prototype.getMultiMaterials;
}

if(GLGE.Mesh){
	GLGE["Mesh"]=GLGE.Mesh;
	GLGE.Mesh.prototype["className"]=GLGE.Mesh.prototype.className;
	GLGE.Mesh.prototype["setJoints"]=GLGE.Mesh.prototype.setJoints;
	GLGE.Mesh.prototype["setInvBindMatrix"]=GLGE.Mesh.prototype.setInvBindMatrix;
	GLGE.Mesh.prototype["setVertexJoints"]=GLGE.Mesh.prototype.setVertexJoints;
	GLGE.Mesh.prototype["setVertexWeights"]=GLGE.Mesh.prototype.setVertexWeights;
	GLGE.Mesh.prototype["setUV"]=GLGE.Mesh.prototype.setUV;
	GLGE.Mesh.prototype["setUV2"]=GLGE.Mesh.prototype.setUV2;
	GLGE.Mesh.prototype["setPositions"]=GLGE.Mesh.prototype.setPositions;
	GLGE.Mesh.prototype["setNormals"]=GLGE.Mesh.prototype.setNormals;
	GLGE.Mesh.prototype["setBuffer"]=GLGE.Mesh.prototype.setBuffer;
	GLGE.Mesh.prototype["setFaces"]=GLGE.Mesh.prototype.setFaces;
	GLGE.Mesh.prototype["addObject"]=GLGE.Mesh.prototype.addObject;
	GLGE.Mesh.prototype["removeObject"]=GLGE.Mesh.prototype.removeObject;
}

GLGE["L_POINT"]=GLGE.L_POINT;
GLGE["L_DIR"]=GLGE.L_DIR;
GLGE["L_SPOT"]=GLGE.L_SPOT;

if(GLGE.Light){
	GLGE["Light"]=GLGE.Light;
	GLGE.Light.prototype["className"]=GLGE.Light.prototype.className;
	GLGE.Light.prototype["getPMatrix"]=GLGE.Light.prototype.getPMatrix;
	GLGE.Light.prototype["setCastShadows"]=GLGE.Light.prototype.setCastShadows;
	GLGE.Light.prototype["getCastShadows"]=GLGE.Light.prototype.getCastShadows;
	GLGE.Light.prototype["setShadowBias"]=GLGE.Light.prototype.setShadowBias;
	GLGE.Light.prototype["getShadowBias"]=GLGE.Light.prototype.getShadowBias;
	GLGE.Light.prototype["setBufferWidth"]=GLGE.Light.prototype.setBufferWidth;
	GLGE.Light.prototype["getBufferHeight"]=GLGE.Light.prototype.getBufferHeight;
	GLGE.Light.prototype["setBufferHeight"]=GLGE.Light.prototype.setBufferHeight;
	GLGE.Light.prototype["getBufferWidth"]=GLGE.Light.prototype.getBufferWidth;
	GLGE.Light.prototype["setSpotCosCutOff"]=GLGE.Light.prototype.setSpotCosCutOff;
	GLGE.Light.prototype["getSpotCosCutOff"]=GLGE.Light.prototype.getSpotCosCutOff;
	GLGE.Light.prototype["setSpotExponent"]=GLGE.Light.prototype.setSpotExponent;
	GLGE.Light.prototype["getSpotExponent"]=GLGE.Light.prototype.getSpotExponent;
	GLGE.Light.prototype["getAttenuation"]=GLGE.Light.prototype.getAttenuation;
	GLGE.Light.prototype["setAttenuation"]=GLGE.Light.prototype.setAttenuation;
	GLGE.Light.prototype["setAttenuationConstant"]=GLGE.Light.prototype.setAttenuationConstant;
	GLGE.Light.prototype["setAttenuationLinear"]=GLGE.Light.prototype.setAttenuationLinear;
	GLGE.Light.prototype["setAttenuationQuadratic"]=GLGE.Light.prototype.setAttenuationQuadratic;
	GLGE.Light.prototype["setColor"]=GLGE.Light.prototype.setColor;
	GLGE.Light.prototype["setColorR"]=GLGE.Light.prototype.setColorR;
	GLGE.Light.prototype["setColorG"]=GLGE.Light.prototype.setColorG;
	GLGE.Light.prototype["setColorB"]=GLGE.Light.prototype.setColorB;
	GLGE.Light.prototype["getColor"]=GLGE.Light.prototype.getColor;
	GLGE.Light.prototype["getType"]=GLGE.Light.prototype.getType;
	GLGE.Light.prototype["setType"]=GLGE.Light.prototype.setType;
}

GLGE["C_PERSPECTIVE"]=GLGE.C_PERSPECTIVE;
GLGE["C_ORTHO"]=GLGE.C_ORTHO;

if(GLGE.Camera){
	GLGE["Camera"]=GLGE.Camera;
	GLGE.Camera.prototype["className"]=GLGE.Camera.prototype.className;
	GLGE.Camera.prototype["getOrthoScale"]=GLGE.Camera.prototype.getOrthoScale;
	GLGE.Camera.prototype["setOrthoScale"]=GLGE.Camera.prototype.setOrthoScale;
	GLGE.Camera.prototype["getFar"]=GLGE.Camera.prototype.getFar;
	GLGE.Camera.prototype["setFar"]=GLGE.Camera.prototype.setFar;
	GLGE.Camera.prototype["getNear"]=GLGE.Camera.prototype.getNear;
	GLGE.Camera.prototype["setNear"]=GLGE.Camera.prototype.setNear;
	GLGE.Camera.prototype["getType"]=GLGE.Camera.prototype.getType;
	GLGE.Camera.prototype["setType"]=GLGE.Camera.prototype.setType;
	GLGE.Camera.prototype["getFovY"]=GLGE.Camera.prototype.getFovY;
	GLGE.Camera.prototype["setFovY"]=GLGE.Camera.prototype.setFovY;
	GLGE.Camera.prototype["getAspect"]=GLGE.Camera.prototype.getAspect;
	GLGE.Camera.prototype["setAspect"]=GLGE.Camera.prototype.setAspect;
	GLGE.Camera.prototype["getProjectionMatrix"]=GLGE.Camera.prototype.getProjectionMatrix;
	GLGE.Camera.prototype["setProjectionMatrix"]=GLGE.Camera.prototype.setProjectionMatrix;
	GLGE.Camera.prototype["getViewMatrix"]=GLGE.Camera.prototype.getViewMatrix;
}

GLGE["FOG_NONE"]=GLGE.FOG_NONE;
GLGE["FOG_LINEAR"]=GLGE.FOG_LINEAR
GLGE["FOG_QUADRATIC"]=GLGE.FOG_QUADRATIC;

if(GLGE.Scene){
	GLGE["Scene"]=GLGE.Scene;
	GLGE.Scene.prototype["className"]=GLGE.Scene.prototype.className;
	GLGE.Scene.prototype["getFogType"]=GLGE.Scene.prototype.getFogType;
	GLGE.Scene.prototype["setFogType"]=GLGE.Scene.prototype.setFogType;
	GLGE.Scene.prototype["getFogFar"]=GLGE.Scene.prototype.getFogFar;
	GLGE.Scene.prototype["setFogFar"]=GLGE.Scene.prototype.setFogFar;
	GLGE.Scene.prototype["getFogNear"]=GLGE.Scene.prototype.getFogNear;
	GLGE.Scene.prototype["setFogNear"]=GLGE.Scene.prototype.setFogNear;
	GLGE.Scene.prototype["getFogColor"]=GLGE.Scene.prototype.getFogColor;
	GLGE.Scene.prototype["setFogColor"]=GLGE.Scene.prototype.setFogColor;
	GLGE.Scene.prototype["getBackgroundColor"]=GLGE.Scene.prototype.getBackgroundColor;
	GLGE.Scene.prototype["setBackgroundColor"]=GLGE.Scene.prototype.setBackgroundColor;
	GLGE.Scene.prototype["getAmbientColor"]=GLGE.Scene.prototype.getAmbientColor;
	GLGE.Scene.prototype["setAmbientColor"]=GLGE.Scene.prototype.setAmbientColor;
	GLGE.Scene.prototype["setAmbientColorR"]=GLGE.Scene.prototype.setAmbientColorR;
	GLGE.Scene.prototype["setAmbientColorG"]=GLGE.Scene.prototype.setAmbientColorG;
	GLGE.Scene.prototype["setAmbientColorB"]=GLGE.Scene.prototype.setAmbientColorB;
	GLGE.Scene.prototype["setCamera"]=GLGE.Scene.prototype.setCamera;
	GLGE.Scene.prototype["getCamera"]=GLGE.Scene.prototype.getCamera;
	GLGE.Scene.prototype["render"]=GLGE.Scene.prototype.render;
	GLGE.Scene.prototype["ray"]=GLGE.Scene.prototype.ray;
	GLGE.Scene.prototype["pick"]=GLGE.Scene.prototype.pick;
}

if(GLGE.Renderer){
	GLGE["Renderer"]=GLGE.Renderer;
	GLGE.Renderer.prototype["getScene"]=GLGE.Renderer.prototype.getScene;
	GLGE.Renderer.prototype["setScene"]=GLGE.Renderer.prototype.setScene;
	GLGE.Renderer.prototype["render"]=GLGE.Renderer.prototype.render;
}

if(GLGE.Texture){
	GLGE["Texture"]=GLGE.Texture;
	GLGE.Texture.prototype["className"]=GLGE.Texture.prototype.className;
	GLGE.Texture.prototype["getSrc"]=GLGE.Texture.prototype.getSrc;
	GLGE.Texture.prototype["setSrc"]=GLGE.Texture.prototype.setSrc;
}

if(GLGE.MaterialLayer){
	GLGE["MaterialLayer"]=GLGE.MaterialLayer;
	GLGE.MaterialLayer.prototype["className"]=GLGE.MaterialLayer.prototype.className;
	GLGE.MaterialLayer.prototype["getMatrix"]=GLGE.MaterialLayer.prototype.getMatrix;
	GLGE.MaterialLayer.prototype["setTexture"]=GLGE.MaterialLayer.prototype.setTexture;
	GLGE.MaterialLayer.prototype["getTexture"]=GLGE.MaterialLayer.prototype.getTexture;
	GLGE.MaterialLayer.prototype["setMapto"]=GLGE.MaterialLayer.prototype.setMapto;
	GLGE.MaterialLayer.prototype["getMapto"]=GLGE.MaterialLayer.prototype.getMapto;
	GLGE.MaterialLayer.prototype["setMapinput"]=GLGE.MaterialLayer.prototype.setMapinput;
	GLGE.MaterialLayer.prototype["getMapinput"]=GLGE.MaterialLayer.prototype.getMapinput;
	GLGE.MaterialLayer.prototype["getOffset"]=GLGE.MaterialLayer.prototype.getOffset;
	GLGE.MaterialLayer.prototype["getRotation"]=GLGE.MaterialLayer.prototype.getRotation;
	GLGE.MaterialLayer.prototype["getScale"]=GLGE.MaterialLayer.prototype.getScale;
	GLGE.MaterialLayer.prototype["setOffsetX"]=GLGE.MaterialLayer.prototype.setOffsetX;
	GLGE.MaterialLayer.prototype["getOffsetX"]=GLGE.MaterialLayer.prototype.getOffsetX;
	GLGE.MaterialLayer.prototype["setOffsetY"]=GLGE.MaterialLayer.prototype.setOffsetY;
	GLGE.MaterialLayer.prototype["getOffsetY"]=GLGE.MaterialLayer.prototype.getOffsetY;
	GLGE.MaterialLayer.prototype["setOffsetZ"]=GLGE.MaterialLayer.prototype.setOffsetZ;
	GLGE.MaterialLayer.prototype["getOffsetZ"]=GLGE.MaterialLayer.prototype.getOffsetZ;
	GLGE.MaterialLayer.prototype["setDOffsetX"]=GLGE.MaterialLayer.prototype.setDOffsetX;
	GLGE.MaterialLayer.prototype["getDOffsetX"]=GLGE.MaterialLayer.prototype.getDOffsetX;
	GLGE.MaterialLayer.prototype["setDOffsetY"]=GLGE.MaterialLayer.prototype.setDOffsetY;
	GLGE.MaterialLayer.prototype["getDOffsetY"]=GLGE.MaterialLayer.prototype.getDOffsetY;
	GLGE.MaterialLayer.prototype["setDOffsetZ"]=GLGE.MaterialLayer.prototype.setDOffsetZ;
	GLGE.MaterialLayer.prototype["getDOffsetZ"]=GLGE.MaterialLayer.prototype.getDOffsetZ;
	GLGE.MaterialLayer.prototype["setScaleX"]=GLGE.MaterialLayer.prototype.setScaleX;
	GLGE.MaterialLayer.prototype["getScaleX"]=GLGE.MaterialLayer.prototype.getScaleX;
	GLGE.MaterialLayer.prototype["setScaleY"]=GLGE.MaterialLayer.prototype.setScaleY;
	GLGE.MaterialLayer.prototype["getScaleY"]=GLGE.MaterialLayer.prototype.getScaleY;
	GLGE.MaterialLayer.prototype["setScaleZ"]=GLGE.MaterialLayer.prototype.setScaleZ;
	GLGE.MaterialLayer.prototype["getScaleZ"]=GLGE.MaterialLayer.prototype.getScaleZ;
	GLGE.MaterialLayer.prototype["setDScaleX"]=GLGE.MaterialLayer.prototype.setDScaleX;
	GLGE.MaterialLayer.prototype["getDScaleX"]=GLGE.MaterialLayer.prototype.getDScaleX;
	GLGE.MaterialLayer.prototype["setDScaleY"]=GLGE.MaterialLayer.prototype.setDScaleY;
	GLGE.MaterialLayer.prototype["getDScaleY"]=GLGE.MaterialLayer.prototype.getDScaleY;
	GLGE.MaterialLayer.prototype["setDScaleZ"]=GLGE.MaterialLayer.prototype.setDScaleZ;
	GLGE.MaterialLayer.prototype["getDScaleZ"]=GLGE.MaterialLayer.prototype.getDScaleZ;
	GLGE.MaterialLayer.prototype["setRotX"]=GLGE.MaterialLayer.prototype.setRotX;
	GLGE.MaterialLayer.prototype["getRotX"]=GLGE.MaterialLayer.prototype.getRotX;
	GLGE.MaterialLayer.prototype["setRotY"]=GLGE.MaterialLayer.prototype.setRotY;
	GLGE.MaterialLayer.prototype["getRotY"]=GLGE.MaterialLayer.prototype.getRotY;
	GLGE.MaterialLayer.prototype["setRotZ"]=GLGE.MaterialLayer.prototype.setRotZ;
	GLGE.MaterialLayer.prototype["getRotZ"]=GLGE.MaterialLayer.prototype.getRotZ;
	GLGE.MaterialLayer.prototype["setDRotX"]=GLGE.MaterialLayer.prototype.setDRotX;
	GLGE.MaterialLayer.prototype["getDRotX"]=GLGE.MaterialLayer.prototype.getDRotX;
	GLGE.MaterialLayer.prototype["setDRotY"]=GLGE.MaterialLayer.prototype.setDRotY;
	GLGE.MaterialLayer.prototype["getDRotY"]=GLGE.MaterialLayer.prototype.getDRotY;
	GLGE.MaterialLayer.prototype["setDRotZ"]=GLGE.MaterialLayer.prototype.setDRotZ;
	GLGE.MaterialLayer.prototype["getDRotZ"]=GLGE.MaterialLayer.prototype.getDRotZ;
	GLGE.MaterialLayer.prototype["setBlendMode"]=GLGE.MaterialLayer.prototype.setBlendMode;
	GLGE.MaterialLayer.prototype["getBlendMode"]=GLGE.MaterialLayer.prototype.getBlendMode;
}

GLGE["M_COLOR"]=GLGE.M_COLOR;
GLGE["M_NOR"]=GLGE.M_NOR;
GLGE["M_ALPHA"]=GLGE.M_ALPHA;
GLGE["M_SPECCOLOR"]=GLGE.M_SPECCOLOR;
GLGE["M_SPECULAR"]=GLGE.M_SPECULAR;
GLGE["M_SHINE"]=GLGE.M_SHINE;
GLGE["M_REFLECT"]=GLGE.M_REFLECT;
GLGE["M_EMIT"]=GLGE.M_EMIT;
GLGE["M_ALPHA"]=GLGE.M_ALPHA;
GLGE["M_MSKR"]=GLGE.M_MSKR;
GLGE["M_MSKG"]=GLGE.M_MSKG;
GLGE["M_MSKB"]=GLGE.M_MSKB;
GLGE["M_MSKA"]=GLGE.M_MSKA;
GLGE["M_HEIGHT"]=GLGE.M_HEIGHT;
GLGE["UV1"]=GLGE.UV1;
GLGE["UV2"]=GLGE.UV2;
GLGE["MAP_NORM"]=GLGE.MAP_NORM;
GLGE["MAP_OBJ"]=GLGE.MAP_OBJ;
GLGE["BL_MIX"]=GLGE.BL_MIX;
GLGE["BL_MUL"]=GLGE.BL_MUL;

if(GLGE.Material){
	GLGE["Material"]=GLGE.Material;
	GLGE.Material.prototype["className"]=GLGE.Material.prototype.className;
	GLGE.Material.prototype["setShadow"]=GLGE.Material.prototype.setShadow;
	GLGE.Material.prototype["getShadow"]=GLGE.Material.prototype.getShadow;
	GLGE.Material.prototype["setColor"]=GLGE.Material.prototype.setColor;
	GLGE.Material.prototype["setColorR"]=GLGE.Material.prototype.setColorR;
	GLGE.Material.prototype["setColorG"]=GLGE.Material.prototype.setColorG;
	GLGE.Material.prototype["setColorB"]=GLGE.Material.prototype.setColorB;
	GLGE.Material.prototype["getColor"]=GLGE.Material.prototype.getColor;
	GLGE.Material.prototype["setSpecularColor"]=GLGE.Material.prototype.setSpecularColor;
	GLGE.Material.prototype["getSpecularColor"]=GLGE.Material.prototype.getSpecularColor;
	GLGE.Material.prototype["setAlpha"]=GLGE.Material.prototype.setAlpha;
	GLGE.Material.prototype["getAlpha"]=GLGE.Material.prototype.getAlpha;
	GLGE.Material.prototype["setSpecular"]=GLGE.Material.prototype.setSpecular;
	GLGE.Material.prototype["getSpecular"]=GLGE.Material.prototype.getSpecular;
	GLGE.Material.prototype["setShininess"]=GLGE.Material.prototype.setShininess;
	GLGE.Material.prototype["getShininess"]=GLGE.Material.prototype.getShininess;
	GLGE.Material.prototype["setEmit"]=GLGE.Material.prototype.setEmit;
	GLGE.Material.prototype["getEmit"]=GLGE.Material.prototype.getEmit;
	GLGE.Material.prototype["setReflectivity"]=GLGE.Material.prototype.setReflectivity;
	GLGE.Material.prototype["getReflectivity"]=GLGE.Material.prototype.getReflectivity;
	GLGE.Material.prototype["addMaterialLayer"]=GLGE.Material.prototype.addMaterialLayer;
	GLGE.Material.prototype["getLayers"]=GLGE.Material.prototype.getLayers;
	GLGE.Material.prototype["addTexture"]=GLGE.Material.prototype.addTexture;
}
}
closure_export();


})(window["GLGE"]);


define("glge/glge", function(){});
/*
GLGE WebGL Graphics Engine
Copyright (c) 2010, Paul Brunt
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of GLGE nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL PAUL BRUNT BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * @fileOverview
 * @name glge_input.js
 * @author me@paulbrunt.co.uk
 */


 if(!GLGE){
	/**
	* @namespace Holds the functionality of the library
	*/
	var GLGE={};
}

(function(GLGE){
	/**
	* @class Creates a heightmap for a region of the world based on an image. Originally created as a quick and easy collision detection. At least until we have a better physics implementation.
	* @deprecated not intended as a permanent addition
	* @param {string} imageURL The url of the image to generate the hightmap for
	* @param {number} imageWidth The width of the image
	* @param {number} imageHeight The height of the image
	* @param {number} x1 The lower X bound of the height map in world coords
	* @param {number} x2 The upper X bound of the height map in world coords
	* @param {number} y1 The lower Y bound of the height map in world coords
	* @param {number} y2 The upper Y bound of the height map in world coords
	* @param {number} z1 The lower Z bound of the height map in world coords
	* @param {number} z2 The upper Z bound of the height map in world coords
	*/
	GLGE.HeightMap=function(imageURL,imageWidth,imageHeight,x1,x2,y1,y2,z1,z2){
		this.canvas=document.createElement("canvas");
		this.context = this.canvas.getContext('2d');
		this.canvas.width=imageWidth;
		this.canvas.height=imageHeight;
		this.minX=x1;
		this.maxX=x2;
		this.minY=y1;
		this.maxY=y2;
		this.minZ=z1;
		this.maxZ=z2;
		var image=new Image();
		image.heightmap=this;
		image.onload=function(e){
			this.heightmap.context.drawImage(this, 0, 0);
			this.heightmap.data=this.heightmap.context.getImageData(0,0,this.heightmap.canvas.width,this.heightmap.canvas.height).data;
		};
		image.src=imageURL;
	}
	GLGE.HeightMap.prototype.canvas=null;
	GLGE.HeightMap.prototype.context=null;
	GLGE.HeightMap.prototype.minZ=null;
	GLGE.HeightMap.prototype.maxZ=null;
	GLGE.HeightMap.prototype.minY=null;
	GLGE.HeightMap.prototype.maxY=null;
	GLGE.HeightMap.prototype.minX=null;
	GLGE.HeightMap.prototype.maxX=null;
	GLGE.HeightMap.prototype.data=null;
	/**
	* Gets the pixel height at the specified image coords
	* @param {number} x the x image coord 
	* @param {number} y the y image coord 
	* @private
	*/
	GLGE.HeightMap.prototype.getPixelAt=function(x,y){
		if(this.data){
			return (this.data[(this.canvas.width*y+x)*4])/255*(this.maxZ-this.minZ);
		}
		else
		{
			return 0;
		}
	}
	/**
	* Function to get he height as specified x, y world coords
	* @param {number} x the x world coord 
	* @param {number} y the y world coord 
	* @returns {number} the height of the level in world units 
	*/
	GLGE.HeightMap.prototype.getHeightAt=function(x,y){
		var retValue;
		if(this.lastx!=undefined && x==this.lastx && y==this.lasty){
			retValue=this.lastValue;
		}
		else
		{
			var imgX=Math.round((x-this.minX)/(this.maxX-this.minX)*this.canvas.width);
			var imgY=Math.round((y-this.minY)/(this.maxY-this.minY)*this.canvas.height);
			retValue=this.getPixelAt(imgX,imgY);
			this.lastValue=retValue;
		}
		this.lastx=x;
		this.lasty=y;
		return retValue;
	}
	/**
	* @class Monitors keyboard input for use in render loops
	*/
	GLGE.KeyInput=function(){
		if(!document.keyStates) document.keyStates=[];
		document.addEventListener("keydown",this.onKeyDown,false);
		document.addEventListener("keyup",this.onKeyUp,false);
	}
	/**
	* Tests if a key is pressed
	* @param {number} the keycode to check
	* @returns {boolean} key returns true if the key is being pressed
	*/
	GLGE.KeyInput.prototype.isKeyPressed=function(key){
		if(document.keyStates[key]) return true;
			else return false;
	};
	var skiptimmer=null;
	/**
	* document keydown event used to monitor the key states
	* @param {event} e the event being fired
	* @private
	*/
	GLGE.KeyInput.prototype.onKeyDown=function(e){
		document.keyStates[e.keyCode]=true;
	};
	/**
	* Document keyup event used to monitor the key states
	* @param {event} e the event being fired
	* @private
	*/
	GLGE.KeyInput.prototype.onKeyUp=function(e){
		document.keyStates[e.keyCode]=false;
	};
	/**
	* @class Monitors mouse input for use in render loops
	*/
	GLGE.MouseInput=function(element){
		this.element=element;
		this.element.mouseX=0;
		this.element.mouseY=0;
		if(!this.element.buttonState) this.element.buttonState=[];
		element.addEventListener("mousemove",this.onMouseMove,false);
		element.addEventListener("mousedown",this.onMouseDown,false);
		element.addEventListener("mouseup",this.onMouseUp,false);
	}
	GLGE.MouseInput.prototype.element=null;
	/**
	* Elements mousemove event used to monitor the mouse states
	* @param {event} e the event being fired
	* @private
	*/
	GLGE.MouseInput.prototype.onMouseMove=function(e){
		this.mouseX=e.clientX;
		this.mouseY=e.clientY;
	}
	/**
	* Elements mousedown event used to monitor the mouse states
	* @param {event} e the event being fired
	* @private
	*/
	GLGE.MouseInput.prototype.onMouseDown=function(e){
		this.buttonState[e.button]=true;
	}
	/**
	* Elements mouseup event used to monitor the mouse states
	* @param {event} e the event being fired
	* @private
	*/
	GLGE.MouseInput.prototype.onMouseUp=function(e){
		this.buttonState[e.button]=false;
	}
	/**
	* Tests if a mouse button is pressed
	* @param {number} button the button to check
	* @returns {boolean} returns true if the button is being pressed
	*/
	GLGE.MouseInput.prototype.isButtonDown=function(button){
		if(this.element.buttonState[button]) return true;
			else return false;
	}
	/**
	* Gets the mouse coords
	* @returns {object} the current mouse coors
	*/
	GLGE.MouseInput.prototype.getMousePosition=function(){
		return {x:this.element.mouseX,y:this.element.mouseY}
	}

	/**
	* @constant 
	* @description Enumeration for the left mouse button
	*/
	GLGE.MI_LEFT=0;
	/**
	* @constant 
	* @description Enumeration for the middle mouse button
	*/
	GLGE.MI_MIDDLE=1;
	/**
	* @constant 
	* @description Enumeration for the right mouse button
	*/
	GLGE.MI_RIGHT=2;

	/**
	* @constant 
	* @description Enumeration for the backspace key
	*/
	GLGE.KI_BACKSPACE=8;
	/**
	* @constant 
	* @description Enumeration for the tab key
	*/
	GLGE.KI_TAB=9;
	/**
	* @constant 
	* @description Enumeration for the enter key
	*/
	GLGE.KI_ENTER=13;
	/**
	* @constant 
	* @description Enumeration for the shift key
	*/
	GLGE.KI_SHIFT=16;
	/**
	* @constant 
	* @description Enumeration for the ctrl key
	*/
	GLGE.KI_CTRL=17;
	/**
	* @constant 
	* @description Enumeration for the alt key
	*/
	GLGE.KI_ALT=18;
	/**
	* @constant 
	* @description Enumeration for the pause/break key
	*/
	GLGE.KI_PAUSE_BREAK=19;
	/**
	* @constant 
	* @description Enumeration for the caps lock key
	*/
	GLGE.KI_CAPS_LOCK=20;
	/**
	* @constant 
	* @description Enumeration for the escape key
	*/
	GLGE.KI_ESCAPE=27;
	/**
	* @constant 
	* @description Enumeration for the page up key
	*/
	GLGE.KI_PAGE_UP=33;
	/**
	* @constant 
	* @description Enumeration for the page down key
	*/
	GLGE.KI_PAGE_DOWN=34;
	/**
	* @constant 
	* @description Enumeration for the end key
	*/
	GLGE.KI_END=35;
	/**
	* @constant 
	* @description Enumeration for the home key
	*/
	GLGE.KI_HOME=36;
	/**
	* @constant 
	* @description Enumeration for the left arrow key
	*/
	GLGE.KI_LEFT_ARROW=37;
	/**
	* @constant 
	* @description Enumeration for the up arrow key
	*/
	GLGE.KI_UP_ARROW=38;
	/**
	* @constant 
	* @description Enumeration for the right arrow key
	*/
	GLGE.KI_RIGHT_ARROW=39;
	/**
	* @constant 
	* @description Enumeration for the down arrow key
	*/
	GLGE.KI_DOWN_ARROW=40;
	/**
	* @constant 
	* @description Enumeration for the insert key
	*/
	GLGE.KI_INSERT=45;
	/**
	* @constant 
	* @description Enumeration for the delete key
	*/
	GLGE.KI_DELETE=46;
	/**
	* @constant 
	* @description Enumeration for the 0 key
	*/
	GLGE.KI_0=48;
	/**
	* @constant 
	* @description Enumeration for the 1 key
	*/
	GLGE.KI_1=49;
	/**
	* @constant 
	* @description Enumeration for the 2 key
	*/
	GLGE.KI_2=50;
	/**
	* @constant 
	* @description Enumeration for the 3 key
	*/
	GLGE.KI_3=51;
	/**
	* @constant 
	* @description Enumeration for the 4 key
	*/
	GLGE.KI_4=52;
	/**
	* @constant 
	* @description Enumeration for the 5 key
	*/
	GLGE.KI_5=53;
	/**
	* @constant 
	* @description Enumeration for the 6 key
	*/
	GLGE.KI_6=54;
	/**
	* @constant 
	* @description Enumeration for the 7 key
	*/
	GLGE.KI_7=55;
	/**
	* @constant 
	* @description Enumeration for the 8 key
	*/
	GLGE.KI_8=56;
	/**
	* @constant 
	* @description Enumeration for the 9 key
	*/
	GLGE.KI_9=57;
	/**
	* @constant 
	* @description Enumeration for the a key
	*/
	GLGE.KI_A=65;
	/**
	* @constant 
	* @description Enumeration for the b key
	*/
	GLGE.KI_B=66;
	/**
	* @constant 
	* @description Enumeration for the c key
	*/
	GLGE.KI_C=67;
	/**
	* @constant 
	* @description Enumeration for the d key
	*/
	GLGE.KI_D=68;
	/**
	* @constant 
	* @description Enumeration for the e key
	*/
	GLGE.KI_E=69;
	/**
	* @constant 
	* @description Enumeration for the f key
	*/
	GLGE.KI_F=70;
	/**
	* @constant 
	* @description Enumeration for the g key
	*/
	GLGE.KI_G=71;
	/**
	* @constant 
	* @description Enumeration for the h key
	*/
	GLGE.KI_H=72;
	/**
	* @constant 
	* @description Enumeration for the i key
	*/
	GLGE.KI_I=73;
	/**
	* @constant 
	* @description Enumeration for the j key
	*/
	GLGE.KI_J=74;
	/**
	* @constant 
	* @description Enumeration for the k key
	*/
	GLGE.KI_K=75;
	/**
	* @constant 
	* @description Enumeration for the l key
	*/
	GLGE.KI_L=76;
	/**
	* @constant 
	* @description Enumeration for the m key
	*/
	GLGE.KI_M=77;
	/**
	* @constant 
	* @description Enumeration for the n key
	*/
	GLGE.KI_N=78;
	/**
	* @constant 
	* @description Enumeration for the o key
	*/
	GLGE.KI_O=79;
	/**
	* @constant 
	* @description Enumeration for the p key
	*/
	GLGE.KI_P=80;
	/**
	* @constant 
	* @description Enumeration for the q key
	*/
	GLGE.KI_Q=81;
	/**
	* @constant 
	* @description Enumeration for the r key
	*/
	GLGE.KI_R=82;
	/**
	* @constant 
	* @description Enumeration for the s key
	*/
	GLGE.KI_S=83;
	/**
	* @constant 
	* @description Enumeration for the t key
	*/
	GLGE.KI_T=84;
	/**
	* @constant 
	* @description Enumeration for the u key
	*/
	GLGE.KI_U=85;
	/**
	* @constant 
	* @description Enumeration for the v key
	*/
	GLGE.KI_V=86;
	/**
	* @constant 
	* @description Enumeration for the w key
	*/
	GLGE.KI_W=87;
	/**
	* @constant 
	* @description Enumeration for the x key
	*/
	GLGE.KI_X=88;
	/**
	* @constant 
	* @description Enumeration for the y key
	*/
	GLGE.KI_Y=89;
	/**
	* @constant 
	* @description Enumeration for the z key
	*/
	GLGE.KI_Z=90;
	/**
	* @constant 
	* @description Enumeration for the left window key key
	*/
	GLGE.KI_LEFT_WINDOW_KEY=91;
	/**
	* @constant 
	* @description Enumeration for the right window key key
	*/
	GLGE.KI_RIGHT_WINDOW_KEY=92;
	/**
	* @constant 
	* @description Enumeration for the select key key
	*/
	GLGE.KI_SELECT_KEY=93;
	/**
	* @constant 
	* @description Enumeration for the numpad 0 key
	*/
	GLGE.KI_NUMPAD_0=96;
	/**
	* @constant 
	* @description Enumeration for the numpad 1 key
	*/
	GLGE.KI_NUMPAD_1=97;
	/**
	* @constant 
	* @description Enumeration for the numpad 2 key
	*/
	GLGE.KI_NUMPAD_2=98;
	/**
	* @constant 
	* @description Enumeration for the numpad 3 key
	*/
	GLGE.KI_NUMPAD_3=99;
	/**
	* @constant 
	* @description Enumeration for the numpad 4 key
	*/
	GLGE.KI_NUMPAD_4=100;
	/**
	* @constant 
	* @description Enumeration for the numpad 5 key
	*/
	GLGE.KI_NUMPAD_5=101;
	/**
	* @constant 
	* @description Enumeration for the numpad 6 key
	*/
	GLGE.KI_NUMPAD_6=102;
	/**
	* @constant 
	* @description Enumeration for the numpad 7 key
	*/
	GLGE.KI_NUMPAD_7=103;
	/**
	* @constant 
	* @description Enumeration for the numpad 8 key
	*/
	GLGE.KI_NUMPAD_8=104;
	/**
	* @constant 
	* @description Enumeration for the numpad 9 key
	*/
	GLGE.KI_NUMPAD_9=105;
	/**
	* @constant 
	* @description Enumeration for the multiply key
	*/
	GLGE.KI_MULTIPLY=106;
	/**
	* @constant 
	* @description Enumeration for the add key
	*/
	GLGE.KI_ADD=107;
	/**
	* @constant 
	* @description Enumeration for the subtract key
	*/
	GLGE.KI_SUBTRACT=109;
	/**
	* @constant 
	* @description Enumeration for the decimal point key
	*/
	GLGE.KI_DECIMAL_POINT=110;
	/**
	* @constant 
	* @description Enumeration for the divide key
	*/
	GLGE.KI_DIVIDE=111;
	/**
	* @constant 
	* @description Enumeration for the f1 key
	*/
	GLGE.KI_F1=112;
	/**
	* @constant 
	* @description Enumeration for the f2 key
	*/
	GLGE.KI_F2=113;
	/**
	* @constant 
	* @description Enumeration for the f3 key
	*/
	GLGE.KI_F3=114;
	/**
	* @constant 
	* @description Enumeration for the f4 key
	*/
	GLGE.KI_F4=115;
	/**
	* @constant 
	* @description Enumeration for the f5 key
	*/
	GLGE.KI_F5=116;
	/**
	* @constant 
	* @description Enumeration for the f6 key
	*/
	GLGE.KI_F6=117;
	/**
	* @constant 
	* @description Enumeration for the f7 key
	*/
	GLGE.KI_F7=118;
	/**
	* @constant 
	* @description Enumeration for the f8 key
	*/
	GLGE.KI_F8=119;
	/**
	* @constant 
	* @description Enumeration for the f9 key
	*/
	GLGE.KI_F9=120;
	/**
	* @constant 
	* @description Enumeration for the f10 key
	*/
	GLGE.KI_F10=121;
	/**
	* @constant 
	* @description Enumeration for the f11 key
	*/
	GLGE.KI_F11=122;
	/**
	* @constant 
	* @description Enumeration for the f12 key
	*/
	GLGE.KI_F12=123;
	/**
	* @constant 
	* @description Enumeration for the num lock key
	*/
	GLGE.KI_NUM_LOCK=144;
	/**
	* @constant 
	* @description Enumeration for the scroll lock key
	*/
	GLGE.KI_SCROLL_LOCK=145;
	/**
	* @constant 
	* @description Enumeration for the semi-colon key
	*/
	GLGE.KI_SEMI_COLON=186;
	/**
	* @constant 
	* @description Enumeration for the equal sign key
	*/
	GLGE.KI_EQUAL_SIGN=187;
	/**
	* @constant 
	* @description Enumeration for the comma key
	*/
	GLGE.KI_COMMA=188;
	/**
	* @constant 
	* @description Enumeration for the dash key
	*/
	GLGE.KI_DASH=189;
	/**
	* @constant 
	* @description Enumeration for the period key
	*/
	GLGE.KI_PERIOD=190;
	/**
	* @constant 
	* @description Enumeration for the forward slash key
	*/
	GLGE.KI_FORWARD_SLASH=191;
	/**
	* @constant 
	* @description Enumeration for the grave accent key
	*/
	GLGE.KI_GRAVE_ACCENT=192;
	/**
	* @constant 
	* @description Enumeration for the open bracket key
	*/
	GLGE.KI_OPEN_BRACKET=219;
	/**
	* @constant 
	* @description Enumeration for the back slash key
	*/
	GLGE.KI_BACK_SLASH=220;
	/**
	* @constant 
	* @description Enumeration for the close braket key
	*/
	GLGE.KI_CLOSE_BRAKET=221;
	/**
	* @constant 
	* @description Enumeration for the single quote key
	*/
	GLGE.KI_SINGLE_QUOTE=222;
	/**
	* @constant 
	* @description Enumeration for the space key
	*/
	GLGE.KI_SPACE=32;
})(GLGE);



define("glge/glge_input", function(){});
/*
GLGE WebGL Graphics Engine
Copyright (c) 2010, Paul Brunt
All rights reserved.
 
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of GLGE nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.
 
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL PAUL BRUNT BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
 
 /**
 * @fileOverview
 * @name glge_collada.js
 * @author me@paulbrunt.co.uk
 */
 
if(!GLGE){
	var GLGE={};
}
 
(function(GLGE){
 GLGE.ColladaDocuments=[];
/**
* @class Class to represent a collada object
* @augments GLGE.Group
*/
GLGE.Collada=function(){
	this.children=[];
};
GLGE.augment(GLGE.Group,GLGE.Collada);
GLGE.Collada.prototype.type=GLGE.G_NODE;
/**
* Gets the absolute path given an import path and the path it's relative to
* @param {string} path the path to get the absolute path for
* @param {string} relativeto the path the supplied path is relativeto
* @returns {string} absolute path
* @private
*/
GLGE.Collada.prototype.getAbsolutePath=function(path,relativeto){
	if(path.substr(0,7)=="http://" || path.substr(0,7)=="file://"  || path.substr(0,7)=="https://"){
		return path;
	}
	else
	{
		if(!relativeto){
			relativeto=window.location.href;
		}
		//find the path compoents
		var bits=relativeto.split("/");
		var domain=bits[2];
		var proto=bits[0];
		var initpath=[];
		for(var i=3;i<bits.length-1;i++){
			initpath.push(bits[i]);
		}
		//relative to domain
		if(path.substr(0,1)=="/"){
			initpath=[];
		}
		var locpath=path.split("/");
		for(i=0;i<locpath.length;i++){
			if(locpath[i]=="..") initpath.pop();
				else if(locpath[i]!="") initpath.push(locpath[i]);
		}
		return proto+"//"+domain+"/"+initpath.join("/");
	}
}
/**
* function to get the element with a specified id
* @param {string} id the id of the element
* @private
*/
GLGE.Collada.prototype.getElementById=function(id){
	if(!this.idcache){
		var tags=this.getElementsByTagName("*");
		var attribid;
		this.idcache={};
		for(var i=0; i<tags.length;i++){
			attribid=tags[i].getAttribute("id");
			if(attribid!="") this.idcache[attribid]=tags[i];
		}
	}
	return this.idcache[id];
}
/**
* function extracts a javascript array from the document
* @param {DOM Element} node the value to parse
* @private
*/
GLGE.Collada.prototype.parseArray=function(node){
	var child=node.firstChild;
	var prev="";
	var output=[];
	var currentArray;
	var i;
	while(child){
		currentArray=(prev+child.nodeValue).replace(/\s+/g," ").replace(/^\s+/g,"").split(" ");
		child=child.nextSibling;
		if(currentArray[0]=="") currentArray.unshift();
		if(child) prev=currentArray.pop();
		for(i=0;i<currentArray.length;i++) if(currentArray[i]!="") output.push(currentArray[i]);
	}
	return output;
};
/**
* loads an collada file from a given url
* @param {DOM Element} node the value to parse
* @param {string} relativeTo optional the path the url is relative to
*/
GLGE.Collada.prototype.setDocument=function(url,relativeTo){
	this.url=url;
	//use # to determine the is of the asset to extract
	if(url.indexOf("#")!=-1){
		this.rootId=url.substr(url.indexOf("#")+1);
		url=url.substr(0,url.indexOf("#"));
	}
	if(relativeTo) url=this.getAbsolutePath(url,relativeTo);
	this.docURL=url;
	if(GLGE.ColladaDocuments[url]){
		this.xml=GLGE.ColladaDocuments[url];
	}else{
		var req = new XMLHttpRequest();
		if(req) {
			req.overrideMimeType("text/xml")
			var docurl=url;
			var docObj=this;
			req.onreadystatechange = function() {
				if(this.readyState  == 4)
				{
					if(this.status  == 200 || this.status==0){
						this.responseXML.getElementById=docObj.getElementById;
						docObj.loaded(docurl,this.responseXML);
					}else{ 
						GLGE.error("Error loading Document: "+docurl+" status "+this.status);
					}
				}
			};
			req.open("GET", url, true);
			req.send("");
		}	
	}
};

/**
* gets data for a given source element
* @param {string} id the id of the source element
* @private
*/
GLGE.Collada.prototype.getSource=function(id){
	var element=this.xml.getElementById(id);
	if(!element.jsArray){
		var value;
		if(element.tagName=="vertices"){
			value=[];
			var inputs=element.getElementsByTagName("input");
			for(var i=0;i<inputs.length;i++){
				value[i]=this.getSource(inputs[i].getAttribute("source").substr(1));
				value[i].block=inputs[i].getAttribute("semantic");
			}
		}else{
			var accessor=element.getElementsByTagName("technique_common")[0].getElementsByTagName("accessor")[0];
			var sourceArray=this.xml.getElementById(accessor.getAttribute("source").substr(1));
			var type=sourceArray.tagName;
			value=this.parseArray(sourceArray);
			stride=parseInt(accessor.getAttribute("stride"));
			offset=parseInt(accessor.getAttribute("offset"));
			if(!offset) offset=0;
			if(!stride) stride=1;
			count=parseInt(accessor.getAttribute("count"));
			var params=accessor.getElementsByTagName("param");
			var pmask=[];
			for(var i=0;i<params.length;i++){if(params[i].hasAttribute("name")) pmask.push({type:params[i].getAttribute("type"),name:params[i].getAttribute("name")}); else pmask.push(false);}
			value={array:value,stride:stride,offset:offset,count:count,pmask:pmask,type:type};
		}	

		element.jsArray=value;
	}
	
	
	return element.jsArray;
};
/**
* Creates a new object and added the meshes parse in the geomertry
* @param {string} id id of the geomerty to parse
* @private
*/
GLGE.Collada.prototype.getMeshes=function(id,skeletonData){
	var i,n;
	var mesh;
	var inputs;
	var inputArray;		
	var vertexJoints;
	var vertexWeights;
	var faces;
	var outputData;
	var block;
	var set;
	var rootNode=this.xml.getElementById(id);
	var meshNode=rootNode.getElementsByTagName("mesh")[0];
	var meshes=[];
	
	//convert polylists to triangles my head hurts now :-(
	var polylists=meshNode.getElementsByTagName("polylist");
	for(i=0;i<polylists.length;i++){
		faces=this.parseArray(polylists[i].getElementsByTagName("p")[0]);
		vcount=this.parseArray(polylists[i].getElementsByTagName("vcount")[0]);
		var inputcount=polylists[i].getElementsByTagName("input");
		var maxoffset=0;
		for(n=0;n<inputcount.length;n++) maxoffset=Math.max(maxoffset,inputcount[n].getAttribute("offset"));
		var tris=[];
		var cnt=0;
		for(n=0;n<vcount.length;n++){
		
			for(j=0; j<vcount[n]-2;j++){
				for(k=0;k<=maxoffset;k++){
					tris.push(faces[cnt+k]);
				}
				for(k=0;k<=maxoffset;k++){
					tris.push(faces[cnt+(maxoffset+1)*(j+1)+k]);
				}
				for(k=0;k<=maxoffset;k++){
					tris.push(faces[cnt+(maxoffset+1)*(j+2)+k]);
				}
			}
			cnt=cnt+(maxoffset+1)*vcount[n];
		}
		polylists[i].getElementsByTagName("p")[0].data=tris;
	}
	
	//convert polygons to tris
	var polygons=meshNode.getElementsByTagName("polygons");
	for(i=0;i<polygons.length;i++){
		var polys=polygons[i].getElementsByTagName("p");
		var tris=[];
		for(var l=0;l<polys.length;l++){
			var faces=this.parseArray(polys[l]);
			var inputcount=polygons[i].getElementsByTagName("input");
			var maxoffset=0;
			for(n=0;n<inputcount.length;n++) maxoffset=Math.max(maxoffset,inputcount[n].getAttribute("offset"));
			var cnt=0;
			for(j=0; j<(faces.length/(maxoffset+1))-2;j++){
				for(k=0;k<=maxoffset;k++){
					tris.push(faces[cnt+k]);
				}
				for(k=0;k<=maxoffset;k++){
					tris.push(faces[cnt+(maxoffset+1)*(j+1)+k]);
				}
				for(k=0;k<=maxoffset;k++){
					tris.push(faces[cnt+(maxoffset+1)*(j+2)+k]);
				}
			}
			cnt=cnt+(maxoffset+1)*(faces.length/(maxoffset+1));
		}
		if(polys.length>0) polygons[i].getElementsByTagName("p")[0].data=tris;
	}
	
	
	//create a mesh for each set of faces
	var triangles=[];
	var tris=meshNode.getElementsByTagName("triangles");
	for(i=0;i<polylists.length;i++){triangles.push(polylists[i])};
	for(i=0;i<polygons.length;i++){if(polygons[i].getElementsByTagName("p").length>0) triangles.push(polygons[i])};
	for(i=0;i<tris.length;i++){triangles.push(tris[i])};
	
	for(i=0;i<triangles.length;i++){
		//go though the inputs to get the data layout
		inputs=triangles[i].getElementsByTagName("input");
		vertexJoints=[];
		vertexWeights=[];
		inputArray=[];
		outputData={};
		for(n=0;n<inputs.length;n++){
			inputs[n].data=this.getSource(inputs[n].getAttribute("source").substr(1));
			block=inputs[n].getAttribute("semantic");
			if(block=="TEXCOORD"){
					set=inputs[n].getAttribute("set");
					if(!set) set=0;
					block=block+set;
			}
			if(block=="VERTEX"){
				for(var l=0;l<inputs[n].data.length;l++){
					outputData[inputs[n].data[l].block]=[];
				}
			}
			inputs[n].block=block;
			outputData[block]=[];
			inputArray[inputs[n].getAttribute("offset")]=inputs[n];
		}
		//get the face data and push the data into the mesh
		if(triangles[i].getElementsByTagName("p")[0].data) faces=triangles[i].getElementsByTagName("p")[0].data;
			else faces=this.parseArray(triangles[i].getElementsByTagName("p")[0]);

		var pcnt;
		for(var n=0;n<inputArray.length;n++){
			if(inputArray[n].block!="VERTEX"){
				inputArray[n].data=[inputArray[n].data];
				inputArray[n].data[0].block=inputArray[n].block;
			}
		}
		
		for(j=0;j<faces.length;j=j+inputArray.length){
			for(n=0;n<inputArray.length;n++){
				for(var l=0;l<inputArray[n].data.length;l++){
					var block=inputArray[n].data[l].block;
					pcnt=0;
					for(k=0;k<inputArray[n].data[l].stride;k++){
						if(inputArray[n].data[l].pmask[k]){
							outputData[block].push(inputArray[n].data[l].array[faces[j+n]*inputArray[n].data[l].stride+k+inputArray[n].data[l].offset]);
							pcnt++;
						}
					}
					if(skeletonData && block=="POSITION"){
						for(k=0;k<skeletonData.count;k++){
							vertexJoints.push(skeletonData.vertexJoints[faces[j+n]*skeletonData.count+k]);
							vertexWeights.push(skeletonData.vertexWeight[faces[j+n]*skeletonData.count+k]);
						}
					}
					//account for 1D and 2D
					if(block=="POSITION" && pcnt==1) outputData[block].push(0);
					if(block=="POSITION" && pcnt==2) outputData[block].push(0);
					//we can't handle 3d texcoords at the moment so try two
					if(block=="TEXCOORD0" && pcnt==3) outputData[block].pop();
					if(block=="TEXCOORD1" && pcnt==3) outputData[block].pop();
				}
			}
		}
		
		//create faces array
		faces=[];
		for(n=0;n<outputData.POSITION.length/3;n++) faces.push(n);
		//create mesh
		var trimesh=new GLGE.Mesh();
		if(!outputData.NORMAL){
			outputData.NORMAL=[];
			for(n=0;n<outputData.POSITION.length;n=n+9){
				var vec1=GLGE.subVec3([outputData.POSITION[n],outputData.POSITION[n+1],outputData.POSITION[n+2]],[outputData.POSITION[n+3],outputData.POSITION[n+4],outputData.POSITION[n+5]]);
				var vec2=GLGE.subVec3([outputData.POSITION[n+6],outputData.POSITION[n+7],outputData.POSITION[n+8]],[outputData.POSITION[n],outputData.POSITION[n+1],outputData.POSITION[n+2]]);
				var vec3=GLGE.toUnitVec3(GLGE.crossVec3(GLGE.toUnitVec3(vec2),GLGE.toUnitVec3(vec1)));
				outputData.NORMAL.push(vec3[0]);
				outputData.NORMAL.push(vec3[1]);
				outputData.NORMAL.push(vec3[2]);
				outputData.NORMAL.push(vec3[0]);
				outputData.NORMAL.push(vec3[1]);
				outputData.NORMAL.push(vec3[2]);
				outputData.NORMAL.push(vec3[0]);
				outputData.NORMAL.push(vec3[1]);
				outputData.NORMAL.push(vec3[2]);
			}
		}
		
		trimesh.setPositions(outputData.POSITION);
		trimesh.setNormals(outputData.NORMAL);
		if(outputData.TEXCOORD0) trimesh.setUV(outputData.TEXCOORD0);
		if(outputData.TEXCOORD1) trimesh.setUV2(outputData.TEXCOORD1);
		if(skeletonData){
			trimesh.setJoints(skeletonData.joints);
			trimesh.setInvBindMatrix(skeletonData.inverseBindMatrix);
			trimesh.setVertexJoints(vertexJoints,skeletonData.count);
			trimesh.setVertexWeights(vertexWeights,skeletonData.count);
		}
		
		trimesh.setFaces(faces);
		trimesh.matName=triangles[i].getAttribute("material");
						
		meshes.push(trimesh);
	}
	
	return meshes;
};

/**
* Gets the float4 parameter for a shader
* @private
*/
GLGE.Collada.prototype.getFloat4=function(profile,sid){
    // MCB: it's possible for newparam to be in effect scope
	var params=profile.getElementsByTagName("newparam");
	for(var i=0;i<params.length;i++){
		if(params[i].getAttribute("sid")==sid){
			return params[i].getElementsByTagName("float4")[0].firstChild.nodeValue;
			break;
		}
	}
	return null;
}

/**
* Gets the float parameter for a shader
* @private
*/
GLGE.Collada.prototype.getFloat=function(profile,sid){
    // MCB: it's possible for newparam to be in effect scope
	var params=profile.getElementsByTagName("newparam");
	for(var i=0;i<params.length;i++){
		if(params[i].getAttribute("sid")==sid){
			return params[i].getElementsByTagName("float")[0].firstChild.nodeValue;
			break;
		}
	}
	return null;
}

/**
* Gets the sampler for a texture
* @private
*/
GLGE.Collada.prototype.getSampler=function(profile,sid){
    // MCB: it's possible for newparam to be in effect scope
	var params=profile.getElementsByTagName("newparam");
	for(var i=0;i<params.length;i++){
		if(params[i].getAttribute("sid")==sid){
			//only do 2d atm.
			return params[i].getElementsByTagName("sampler2D")[0].getElementsByTagName("source")[0].firstChild.nodeValue;
			break;
		}
	}
	return null;
}
/**
* Gets the surface for a texture
* @private
*/
GLGE.Collada.prototype.getSurface=function(profile,sid){
    // MCB: it's possible for newparam to be in effect scope
	var params=profile.getElementsByTagName("newparam");
	for(var i=0;i<params.length;i++){
		if(params[i].getAttribute("sid")==sid){
			return params[i].getElementsByTagName("surface")[0].getElementsByTagName("init_from")[0].firstChild.nodeValue;
			break;
		}
	}
	return null;
}

/**
* Gets the the collada image location
* @private
*/
GLGE.Collada.prototype.getImage=function(id){
	var image=this.xml.getElementById(id);
	return this.getAbsolutePath(image.getElementsByTagName("init_from")[0].firstChild.nodeValue,this.docURL);

}

/**
* creates a material layer
* @private
*/
GLGE.Collada.prototype.createMaterialLayer=function(node,material,common,mapto){
	var textureImage;
	var imageid=this.getSurface(common,this.getSampler(common,node.getAttribute("texture")));
	if(!imageid) imageid=node.getAttribute("texture"); //assume converter bug  - workround
	textureImage=this.getImage(imageid);
	var texture=new GLGE.Texture();
	texture.setSrc(textureImage);
	material.addTexture(texture);
	var layer=new GLGE.MaterialLayer();
	layer.setTexture(texture);
	layer.setMapto(mapto);
	layer.setMapinput(GLGE.UV1);
	if(node.getElementsByTagName("blend_mode")[0]) var blend=node.getElementsByTagName("blend_mode")[0].firstChild.nodeValue;
	if(blend=="MULTIPLY")  layer.setBlendMode(GLGE.BL_MUL);
	material.addMaterialLayer(layer);
}

/**
* Gets the sampler for a texture
* @param {string} id the id or the material element
* @private
*/
GLGE.Collada.prototype.getMaterial=function(id){	
	var materialNode=this.xml.getElementById(id);
	var effectid=materialNode.getElementsByTagName("instance_effect")[0].getAttribute("url").substr(1);
	var effect=this.xml.getElementById(effectid);
	var common=effect.getElementsByTagName("profile_COMMON")[0];
	//glge only supports one technique currently so try and match as best we can
	var technique=common.getElementsByTagName("technique")[0];
	
	var returnMaterial=new GLGE.Material();
	returnMaterial.setSpecular(0);
	
	var child;
	var color;
	
	//do diffuse color
	var diffuse=technique.getElementsByTagName("diffuse");
	if(diffuse.length>0){
		child=diffuse[0].firstChild;
		do{
			switch(child.tagName){
				case "color":
					color=child.firstChild.nodeValue.split(" ");
					returnMaterial.setColor({r:color[0],g:color[1],b:color[2]});
					break;
				case "param":
					color=this.getFloat4(common,child.getAttribute("ref")).split(" ");
					returnMaterial.setColor({r:color[0],g:color[1],b:color[2]});
					break;
				case "texture":
					this.createMaterialLayer(child,returnMaterial,common,GLGE.M_COLOR);
					break;
			}
		}while(child=child.nextSibling);
	}
	
	
	var bump=technique.getElementsByTagName("bump");
	if(bump.length>0){
		child=bump[0].firstChild;
		do{
			switch(child.tagName){
				case "texture":
					this.createMaterialLayer(child,returnMaterial,common,GLGE.M_NOR);
					break;
			}
		}while(child=child.nextSibling);
	}
	
	//do shininess
	var shininess=technique.getElementsByTagName("shininess");
	if(shininess.length>0){
		returnMaterial.setSpecular(1);
		child=technique.getElementsByTagName("shininess")[0].firstChild;
		do{
			switch(child.tagName){
				case "float":
					if(parseFloat(child.firstChild.nodeValue)>1) returnMaterial.setShininess(parseFloat(child.firstChild.nodeValue));
						else  returnMaterial.setShininess(parseFloat(child.firstChild.nodeValue)*128);
					break;
				case "param":
					var value=parseFloat(this.getFloat(common,child.getAttribute("ref")));
					if(value>1) returnMaterial.setShininess(value);
						else    returnMaterial.setShininess(value*128);
					break;
                // MCB: texture is invalid here. should remove this case.
				case "texture":
					this.createMaterialLayer(child,returnMaterial,common,GLGE.M_SHINE);
					break;
			}
		}while(child=child.nextSibling);
	}
	
	//do specular color
	var specular=technique.getElementsByTagName("specular");
	if(specular.length>0){
		returnMaterial.setSpecular(1);
		child=specular[0].firstChild;
		do{
			switch(child.tagName){
				case "color":
					color=child.firstChild.nodeValue.split(" ");
					returnMaterial.setSpecularColor({r:color[0],g:color[1],b:color[2]});
					break;
				case "param":
					color=this.getFloat4(common,child.getAttribute("ref")).split(" ");
					returnMaterial.setSpecularColor({r:color[0],g:color[1],b:color[2]});
					break;
				case "texture":
					this.createMaterialLayer(child,returnMaterial,common,GLGE.M_SPECCOLOR);
					break;
			}
		}while(child=child.nextSibling);
	}

	//do reflectivity
	/*
	var reflectivity=technique.getElementsByTagName("reflectivity");
	if(reflectivity.length>0){
		child=reflectivity[0].firstChild;
		do{
			switch(child.tagName){
				case "float":
					//returnMaterial.setReflectivity(parseFloat(child.firstChild.nodeValue))
					break;
				case "param":
					//returnMaterial.setReflectivity(parseFloat(this.getFloat(common,child.getAttribute("ref"))));
					break;
                // MCB: texture is invalid here. should remove this case.
				case "texture":
					var imageid=this.getSurface(common,this.getSampler(common,child.getAttribute("texture")));
					textureImage=this.getImage(imageid);
					var texture=new GLGE.Texture(textureImage);
					returnMaterial.addTexture(texture);
					returnMaterial.addMaterialLayer(new GLGE.MaterialLayer(texture,GLGE.M_REFLECT,GLGE.UV1));
					break;
			}
		}while(child=child.nextSibling);
	}*/
	
	//do emission color
	/*var emission=technique.getElementsByTagName("emission");
	if(emission.length>0){
		child=emission[0].firstChild;
		do{
			switch(child.tagName){
				case "color":
					color=child.firstChild.nodeValue.split(" ");
					returnMaterial.setEmit(color[0]);
					break;
				case "param":
					color=this.getFloat4(common,child.getAttribute("ref")).split(" ");
					returnMaterial.setEmit(color[0]);
					break;
				case "texture":
					this.createMaterialLayer(child,returnMaterial,common,GLGE.M_EMIT);
					break;
			}
		}while(child=child.nextSibling);
	}*/

	//do reflective color
	var reflective=technique.getElementsByTagName("reflective");
	if(reflective.length>0){
		child=reflective[0].firstChild;
		do{
			switch(child.tagName){
				case "color":
					color=child.firstChild.nodeValue.split(" ");
//TODO				returnMaterial.setReflectiveColor({r:color[0],g:color[1],b:color[2]});
					break;
				case "param":
					color=this.getFloat4(common,child.getAttribute("ref")).split(" ");
//TODO				returnMaterial.setReflectiveColor({r:color[0],g:color[1],b:color[2]});
					break;
				case "texture":
					this.createMaterialLayer(child,returnMaterial,common,GLGE.M_REFLECT);
					break;
			}
		}while(child=child.nextSibling);
	}

	//do transparency
	var transparency=technique.getElementsByTagName("transparency");
	if(transparency.length>0){
		child=transparency[0].firstChild;
		do{
			switch(child.tagName){
				case "float":
//TODO				returnMaterial.setTransparency(parseFloat(child.firstChild.nodeValue))
					break;
				case "param":
//TODO                    	returnMaterial.setTransparency(parseFloat(this.getFloat(common,child.getAttribute("ref"))));
					break;
			}
		}while(child=child.nextSibling);
	}
	
	//do transparent color
	var transparent=technique.getElementsByTagName("transparent");
	if(transparent.length>0){
        var opaque=transparent[0].getAttribute("opaque");
        if(!opaque) opaque="A_ONE"; // schema default
        
		child=transparent[0].firstChild;
		do{
			switch(child.tagName){
                // MCB: float is invalid here. should remove this case.
				case "float":
					var alpha=parseFloat(child.firstChild.nodeValue);
					if(alpha<1){
						returnMaterial.setAlpha(parseFloat(child.firstChild.nodeValue));
						returnMaterial.trans=true;
					}
					break;
				case "color":
					color=child.firstChild.nodeValue.split(" ");
					var alpha=this.getMaterialAlpha(color,opaque,1);
//TODO                    	var alpha=this.getMaterialAlpha(color,opaque,returnMaterial.getTransparency());
					if(alpha<1){
						returnMaterial.setAlpha(alpha);
						returnMaterial.trans=true;
					}
					break;
				case "param":
					color=this.getFloat4(common,child.getAttribute("ref")).split(" ");
					var alpha=this.getMaterialAlpha(color,opaque,1);
//TODO                    	var alpha=this.getMaterialAlpha(color,opaque,returnMaterial.getTransparency());
					if(alpha<1){
						returnMaterial.setAlpha(alpha);
						returnMaterial.trans=true;
					}
					break;
                // MCB: this case assumes opaque="A_ONE" and transparency="1.0"
				case "texture":
					this.createMaterialLayer(child,returnMaterial,common,GLGE.M_ALPHA);
					returnMaterial.trans=true;
					break;
			}
		}while(child=child.nextSibling);
	}

	return returnMaterial;
};

/**
* gets the material alpha from the transparent color
* @param {color} the transparent color
* @param {opaque} the transparent color opaque attribute value
* @param {transparency} the transparency value
* @private
*/
GLGE.Collada.prototype.getMaterialAlpha=function(color,opaque,transparency){
    var returnAlpha;

    switch(opaque){
        case "A_ONE":
            returnAlpha=parseFloat(color[3])*transparency;
            break;
        case "A_ZERO":
            returnAlpha=1-parseFloat(color[3])*transparency;
            break;
        case "RGB_ONE":
            var luminance=parseFloat(color[0])*0.212671
                         +parseFloat(color[1])*0.715160
                         +parseFloat(color[2])*0.072169;
            returnAlpha=luminance*transparency;
            break;
        case "RGB_ZERO":
            var luminance=parseFloat(color[0])*0.212671
                         +parseFloat(color[1])*0.715160
                         +parseFloat(color[2])*0.072169;
            returnAlpha=1-luminance*transparency;
            break;
    }
    return returnAlpha;
};

/**
* creates a GLGE Object from a given instance Geomertry
* @param {node} node the element to parse
* @private
*/
GLGE.Collada.prototype.getInstanceGeometry=function(node){
	if(node.GLGEObj){
		var obj=new GLGE.ObjectInstance();
		obj.setObject(node.GLGEObj);
		return obj;
	}else{
		var meshes=this.getMeshes(node.getAttribute("url").substr(1));
		var materials=node.getElementsByTagName("instance_material");
		var objMaterials={};
		for(var i=0; i<materials.length;i++){
			mat=this.getMaterial(materials[i].getAttribute("target").substr(1));
			objMaterials[materials[i].getAttribute("symbol")]=mat;
		}
		//create GLGE object
		var obj=new GLGE.Object();
		for(i=0; i<meshes.length;i++){
			if(objMaterials[meshes[i].matName] && objMaterials[meshes[i].matName].trans){
				obj.setZtransparent(true);
			}
			var multimat=new GLGE.MultiMaterial();
			multimat.setMesh(meshes[i]);
			if(!objMaterials[meshes[i].matName]){
				objMaterials[meshes[i].matName]=new GLGE.Material();
				objMaterials[meshes[i].matName].setColor("lightgrey");
			}
			multimat.setMaterial(objMaterials[meshes[i].matName]);
			obj.addMultiMaterial(multimat);
		}
		node.GLGEObj=obj;
		return obj;
	}
}


/**
* creates an array of animation curves
* @param {string} id the id of the sampler
* @private
*/
GLGE.Collada.prototype.getAnimationSampler=function(id){
	var frameRate=30;
	var inputs=this.xml.getElementById(id).getElementsByTagName("input");
	var outputData={};
	var inputsArray=[];
	var data,block;
	for(var i=0;i<inputs.length;i++){
		//modify get source to return the array and element length
		data=this.getSource(inputs[i].getAttribute("source").substr(1));
		block=inputs[i].getAttribute("semantic");
		inputsArray.push({block:block,data:data});
	}
	for(n=0;n<inputsArray.length;n++){
		block=inputsArray[n].block;
		outputData[block]={};
		outputData[block].data=[];
		outputData[block].names=[];
		for(k=0;k<inputsArray[n].data.array.length;k=k+inputsArray[n].data.stride){
			pcnt=0;
			for(i=0;i<inputsArray[n].data.pmask.length;i++){
				if(inputsArray[n].data.pmask[i]){
					outputData[block].names.push(inputsArray[n].data.pmask[i].name);
					if(inputsArray[n].data.pmask[i].type=="float4x4"){
						outputData[block].stride=16;
						for(j=0;j<16;j++){
							outputData[block].data.push(inputsArray[n].data.array[j+k+inputsArray[n].data.offset+i]);
						}
					}else{
						pcnt++;
						outputData[block].stride=pcnt;
						outputData[block].data.push(inputsArray[n].data.array[k+inputsArray[n].data.offset+i]);
					}
				}
			}
		}
	}
	//this should return an array of curves
	var point;
	var anim=[];
	for(var i=0; i<outputData["OUTPUT"].stride;i++){
		anim.push(new GLGE.AnimationCurve());
	}
	for(var i=0;i<outputData["INPUT"].data.length;i++){
		for(var j=0;j<outputData["OUTPUT"].stride;j++){
			anim[j].name=outputData["OUTPUT"].names[j];
			if(outputData["INTERPOLATION"].data[i]=="LINEAR"){
				point=new GLGE.LinearPoint();
				point.setX(outputData["INPUT"].data[i]*frameRate);
				point.setY(outputData["OUTPUT"].data[i*outputData["OUTPUT"].stride+j]);
				anim[j].addPoint(point);
			}
			
			if(outputData["INTERPOLATION"].data[i]=="BEZIER"){
				point=new GLGE.BezTriple();
				point.setX1(outputData["IN_TANGENT"].data[(i*outputData["OUTPUT"].stride+j)*2]*frameRate);
				point.setY1(outputData["IN_TANGENT"].data[(i*outputData["OUTPUT"].stride+j)*2+1]);
				point.setX2(Math.round(outputData["INPUT"].data[i]*frameRate));
				point.setY2(outputData["OUTPUT"].data[i*outputData["OUTPUT"].stride+j]);
				point.setX3(outputData["OUT_TANGENT"].data[(i*outputData["OUTPUT"].stride+j)*2]*frameRate);
				point.setY3(outputData["OUT_TANGENT"].data[(i*outputData["OUTPUT"].stride+j)*2+1]);
				anim[j].addPoint(point);			
			}
		}
	}
	return anim;
}

/**
* Gets the animation vector for a node
* @param {object} channels the animation channels effecting this node
* @private
*/
GLGE.Collada.prototype.getAnimationVector=function(channels){
	//I can see no nice way to map a seuqnce of animated transforms onto a single transform 
	//so instead calc transform for each frame then use quat and trans then linear between them
	var maxFrame=0;
	//get the initial state of the target
	var targetNode=this.xml.getElementById(channels[0].target[0]);
	//get the initial transforms for the target node
	var child=targetNode.firstChild;
	var transforms=[];
	var sids={};
	do{
		switch(child.tagName){
			case "matrix":
			case "translate":
			case "rotate":
			case "scale":
				def={type:child.tagName,data:this.parseArray(child),animations:[]};
				if(child.hasAttribute("sid")) sids[child.getAttribute("sid")]=def;
				transforms.push(def);
				break;
		}
		child=child.nextSibling
	}while(child);
	//loop though the animation channels effecting this node
	var anim={};
	for(var i=0;i<channels.length;i++){
		var animcurves=this.getAnimationSampler(channels[i].source);
		for(j=0;j<animcurves.length;j++){
			maxFrame=Math.max(maxFrame,animcurves[j].keyFrames[animcurves[j].keyFrames.length-1].x);
		}
		var target=channels[i].target;
		if(target[1].indexOf(".")!=-1){
			var splittarget=target[1].split(".");
			switch(splittarget[1]){
				case "X":
					sids[splittarget[0]].animations[0]=animcurves[0];
					break;
				case "Y":
					sids[splittarget[0]].animations[1]=animcurves[0];
					break;
				case "Z":
					sids[splittarget[0]].animations[2]=animcurves[0];
					break;
				case "ANGLE":
					sids[splittarget[0]].animations[3]=animcurves[0];
					break;
			}
		}else if(target[1].indexOf("(")!=-1){
			//do bracket type
			var idx=target[1].split("(");
			sidtarget=idx.shift();
			if(idx.length>1) idx=parseInt(idx[0])+4*parseInt(idx[1]);
				else idx=parseInt(idx[0]);
			sids[sidtarget].animations[idx]=animcurves[0];
		}else{
			//do all
			for(var j=0;j<animcurves.length;j++){
				switch(animcurves[j].name){
					case "X":
						sids[target[1]].animations[0]=animcurves[j];
						break;
					case "Y":
						sids[target[1]].animations[1]=animcurves[j];
						break;
					case "Z":
						sids[target[1]].animations[2]=animcurves[j];
						break;
					case "ANGLE":
						sids[target[1]].animations[3]=animcurves[j];
						break;
					default:
						sids[target[1]].animations[j]=animcurves[j];
						break;
				}
			}
		}
	
	}
	var animVector=new GLGE.AnimationVector();
	animVector.setFrames(maxFrame);
	var quatxcurve=new GLGE.AnimationCurve(); quatxcurve.setChannel("QuatX");
	var quatycurve=new GLGE.AnimationCurve(); quatycurve.setChannel("QuatY");
	var quatzcurve=new GLGE.AnimationCurve(); quatzcurve.setChannel("QuatZ");
	var quatwcurve=new GLGE.AnimationCurve(); quatwcurve.setChannel("QuatW");
	var locxcurve=new GLGE.AnimationCurve(); locxcurve.setChannel("LocX");
	var locycurve=new GLGE.AnimationCurve(); locycurve.setChannel("LocY");
	var loczcurve=new GLGE.AnimationCurve(); loczcurve.setChannel("LocZ");
	var scalexcurve=new GLGE.AnimationCurve(); scalexcurve.setChannel("ScaleX");
	var scaleycurve=new GLGE.AnimationCurve(); scaleycurve.setChannel("ScaleY");
	var scalezcurve=new GLGE.AnimationCurve(); scalezcurve.setChannel("ScaleZ");
	animVector.addAnimationCurve(quatxcurve);
	animVector.addAnimationCurve(quatycurve);
	animVector.addAnimationCurve(quatzcurve);
	animVector.addAnimationCurve(quatwcurve);
	animVector.addAnimationCurve(locxcurve);
	animVector.addAnimationCurve(locycurve);
	animVector.addAnimationCurve(loczcurve);
	animVector.addAnimationCurve(scalexcurve);
	animVector.addAnimationCurve(scaleycurve);
	animVector.addAnimationCurve(scalezcurve);
	var lastQuat=null;
	for(var frame=0; frame<maxFrame;frame++){
		var matrix=GLGE.identMatrix();
		for(var i=0;i<transforms.length;i++){
			//get full transform for this frame
			switch(transforms[i].type){
				case "matrix":
					var matrix_array=[
						(transforms[i].animations[0] ? transforms[i].animations[0].getValue(frame) : transforms[i].data[0]),
						(transforms[i].animations[1] ? transforms[i].animations[1].getValue(frame) : transforms[i].data[1]),
						(transforms[i].animations[2] ? transforms[i].animations[2].getValue(frame) : transforms[i].data[2]),
						(transforms[i].animations[3] ? transforms[i].animations[3].getValue(frame) : transforms[i].data[3]),
						(transforms[i].animations[4] ? transforms[i].animations[4].getValue(frame) : transforms[i].data[4]),
						(transforms[i].animations[5] ? transforms[i].animations[5].getValue(frame) : transforms[i].data[5]),
						(transforms[i].animations[6] ? transforms[i].animations[6].getValue(frame) : transforms[i].data[6]),
						(transforms[i].animations[7] ? transforms[i].animations[7].getValue(frame) : transforms[i].data[7]),
						(transforms[i].animations[8] ? transforms[i].animations[8].getValue(frame) : transforms[i].data[8]),
						(transforms[i].animations[9] ? transforms[i].animations[9].getValue(frame) : transforms[i].data[9]),
						(transforms[i].animations[10] ? transforms[i].animations[10].getValue(frame) : transforms[i].data[10]),
						(transforms[i].animations[11] ? transforms[i].animations[11].getValue(frame) : transforms[i].data[11]),
						(transforms[i].animations[12] ? transforms[i].animations[12].getValue(frame) : transforms[i].data[12]),
						(transforms[i].animations[13] ? transforms[i].animations[13].getValue(frame) : transforms[i].data[13]),
						(transforms[i].animations[14] ? transforms[i].animations[14].getValue(frame) : transforms[i].data[14]),
						(transforms[i].animations[15] ? transforms[i].animations[15].getValue(frame) : transforms[i].data[15])
					];
					matrix=GLGE.mulMat4(matrix,GLGE.Mat4(matrix_array));
					break;
				case "rotate":
					var rotate_array=[
						(transforms[i].animations[0] ? transforms[i].animations[0].getValue(frame) : transforms[i].data[0]),
						(transforms[i].animations[1] ? transforms[i].animations[1].getValue(frame) : transforms[i].data[1]),
						(transforms[i].animations[2] ? transforms[i].animations[2].getValue(frame) : transforms[i].data[2]),
						(transforms[i].animations[3] ? transforms[i].animations[3].getValue(frame) : transforms[i].data[3])
					];
					matrix=GLGE.mulMat4(matrix,GLGE.angleAxis(rotate_array[3]*0.017453278,[ rotate_array[0], rotate_array[1], rotate_array[2]]));
					break;
				case "translate":
					var translate_array=[
						(transforms[i].animations[0] ? transforms[i].animations[0].getValue(frame) : transforms[i].data[0]),
						(transforms[i].animations[1] ? transforms[i].animations[1].getValue(frame) : transforms[i].data[1]),
						(transforms[i].animations[2] ? transforms[i].animations[2].getValue(frame) : transforms[i].data[2])
					];
					matrix=GLGE.mulMat4(matrix,GLGE.translateMatrix(translate_array[0],translate_array[1],translate_array[2]));
					break;
				case "scale":
					var scale_array=[
						(transforms[i].animations[0] ? transforms[i].animations[0].getValue(frame) : transforms[i].data[0]),
						(transforms[i].animations[1] ? transforms[i].animations[1].getValue(frame) : transforms[i].data[1]),
						(transforms[i].animations[2] ? transforms[i].animations[2].getValue(frame) : transforms[i].data[2])
					];
					matrix=GLGE.mulMat4(matrix,GLGE.scaleMatrix(scale_array[0],scale_array[1],scale_array[2]));
					break;
			}
		}
		scale=GLGE.matrix2Scale(matrix);
		matrix=GLGE.mulMat4(matrix,GLGE.scaleMatrix(1/scale[0],1/scale[1],1/scale[2]));
		//convert to quat and trans and add to the curve
		quat=GLGE.rotationMatrix2Quat(matrix);
		if(lastQuat){
			//make sure we are in the same range as previous!
			if((lastQuat[0]*quat[0]+lastQuat[1]*quat[1]+lastQuat[2]*quat[2]+lastQuat[3]*quat[3])<0){
				quat[0]=quat[0]*-1;
				quat[1]=quat[1]*-1;
				quat[2]=quat[2]*-1;
				quat[3]=quat[3]*-1;
			}
		}
		lastQuat=quat;
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(quat[0]);
		quatxcurve.addPoint(point);
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(quat[1]);
		quatycurve.addPoint(point);
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(quat[2]);
		quatzcurve.addPoint(point);
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(quat[3]);
		quatwcurve.addPoint(point);
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(matrix[3]);
		locxcurve.addPoint(point);
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(matrix[7]);
		locycurve.addPoint(point);
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(matrix[11]);
		loczcurve.addPoint(point);
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(scale[0]);
		scalexcurve.addPoint(point);
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(scale[1]);
		scaleycurve.addPoint(point);
		point=new GLGE.LinearPoint();
		point.setX(frame);
		point.setY(scale[2]);
		scalezcurve.addPoint(point);
		/*
		DEBUG CODE
		if(targetNode.getAttribute("id")=="Armature_bracciosu_R"){
			document.getElementById("debug2").value=document.getElementById("debug2").value+quat[0]+","+quat[1]+","+quat[2]+","+quat[3]+","+matrix.toString()+"\n";
		}*/
	}
	//return the animation vector
	for(var i=0; i<targetNode.GLGEObjects.length;i++){
		targetNode.GLGEObjects[i].setAnimation(animVector);
		targetNode.GLGEObjects[i].animationStart=0;
		targetNode.GLGEObjects[i].setFrameRate(30);
	}
	return animVector;
}
/**
* creates an action form the intially animation within the document
* @private
*/
GLGE.Collada.prototype.getAnimations=function(){
	var action=new GLGE.Action();
	var animations=this.xml.getElementsByTagName("animation");
	var channels,target,source;
	var channelGroups={};
	for(var i=0;i<animations.length;i++){
		channels=animations[i].getElementsByTagName("channel");
		for(var j=0;j<channels.length;j++){
			var target=channels[j].getAttribute("target").split("/");
			source=channels[j].getAttribute("source").substr(1);
			if(!channelGroups[target[0]]) channelGroups[target[0]]=[];
			channelGroups[target[0]].push({source:source,target:target});
		}
	}
	for(target in channelGroups){
		//create an animation vector for this target
		this.getAnimationVector(channelGroups[target]);
	}
}
/**
* creates a GLGE Object from a given instance controler
* @param {node} node the element to parse
* @private
*/
GLGE.Collada.prototype.getInstanceController=function(node){
	var obj=new GLGE.Object();
	var controller=this.xml.getElementById(node.getAttribute("url").substr(1));
	var skeletons=node.getElementsByTagName("skeleton");
	var joints=controller.getElementsByTagName("joints")[0];
	var inputs=joints.getElementsByTagName("input");
	var bindShapeMatrix;
	if(controller.getElementsByTagName("bind_shape_matrix").length>0){
		bindShapeMatrix=this.parseArray(controller.getElementsByTagName("bind_shape_matrix")[0]);
	}else{
		//assume identity
		bindShapeMatrix=GLGE.identMatrix();
	}

	var inverseBindMatrix=[bindShapeMatrix];
	var joints=[new GLGE.Group()];
	var mat;
	for(var i=0; i<inputs.length;i++){
		//TODO: sort out correct use of accessors for these source
		if(inputs[i].getAttribute("semantic")=="INV_BIND_MATRIX"){
			var matrixdata=this.getSource(inputs[i].getAttribute("source").substr(1));
			for(var k=0;k<matrixdata.array.length;k=k+matrixdata.stride){
				mat=matrixdata.array.slice(k,k+16);
				inverseBindMatrix.push(GLGE.mulMat4(GLGE.Mat4(mat),GLGE.Mat4(bindShapeMatrix.slice(0,16))));
			}
		}
		if(inputs[i].getAttribute("semantic")=="JOINT"){
			var jointdata=this.getSource(inputs[i].getAttribute("source").substr(1));
			if(jointdata.type=="IDREF_array"){
				for(var k=0;k<jointdata.array.length;k=k+jointdata.stride){
					joints.push(this.getNode(this.xml.getElementById(jointdata.array[k]),true));
					//joints.push(this.xml.getElementById(jointdata.array[k]).GLGEObjects[0]);
				}
			}else if(jointdata.type=="Name_array"){
				var sidArray={};
				var sid;
				//is this right controller with no skeleton set, export bug??
				if(skeletons.length==0){
					var elements=this.xml.getElementsByTagName("node");
					for(k=0; k<elements.length;k++){
						sid=elements[k].getAttribute("sid");
						if(sid){
							sidArray[sid]=elements[k];
						}
					}
				}else{
					for(var n=0; n<skeletons.length;n++){
						var skeletonElement=this.xml.getElementById(skeletons[n].firstChild.nodeValue.substr(1));
						sid=skeletonElement.getAttribute("sid");
						if(sid) sidArray[sid]=skeletonElement;
						var elements=skeletonElement.getElementsByTagName("*");
						for(k=0; k<elements.length;k++){
							sid=elements[k].getAttribute("sid");
							if(sid){
								sidArray[sid]=elements[k];
							}
						}
					}
				}
				for(var k=0;k<jointdata.array.length;k=k+jointdata.stride){
					if(jointdata.array[k]!="") joints.push(this.getNode(sidArray[jointdata.array[k]],true));
				}
			}

		}
	}
	
	//go though the inputs to get the data layout
	var vertexWeight=controller.getElementsByTagName("vertex_weights")[0]
	inputs=vertexWeight.getElementsByTagName("input");
	inputArray=[];
	outputData={};
	for(n=0;n<inputs.length;n++){
		block=inputs[n].getAttribute("semantic");
		inputs[n].data=this.getSource(inputs[n].getAttribute("source").substr(1));
		inputs[n].block=block;
		outputData[block]=[];
		inputArray[inputs[n].getAttribute("offset")]=inputs[n];
	}
	
	var vcounts=this.parseArray(vertexWeight.getElementsByTagName("vcount")[0]);

	var vs=this.parseArray(vertexWeight.getElementsByTagName("v")[0]);
	//find the maximum vcount
	var maxJoints=0;
	for(var i=0; i<vcounts.length;i++) if(vcounts[i]) maxJoints=Math.max(maxJoints,parseInt(vcounts[i]));
	vPointer=0;
	var block;
	for(var i=0; i<vcounts.length;i++){
		for(var j=0; j<vcounts[i];j++){
			for(var k=0; k<inputArray.length;k++){
				block=inputArray[k].block;
				for(n=0;n<inputArray[k].data.stride;n++){
					if(inputArray[k].data.pmask[n]){
						if(block!="JOINT") outputData[block].push(inputArray[k].data.array[parseInt(vs[vPointer])+parseInt(inputArray[k].data.offset)]);
							else outputData[block].push(parseInt(vs[vPointer]));						
						vPointer++;
						
					}
				}
			}
		}
		//pad out the remaining data
		for(j=j; j<maxJoints;j++){
			for(var k=0; k<inputArray.length;k++){
				block=inputArray[k].block;
				outputData[block].push(0);
			}
		}
	}	

	for(var i=0;i<outputData["JOINT"].length;i++){
			outputData["JOINT"][i]++;
	}
	
	var skeletonData={vertexJoints:outputData["JOINT"],vertexWeight:outputData["WEIGHT"],joints:joints,inverseBindMatrix:inverseBindMatrix,count:maxJoints}
	

		
	var meshes=this.getMeshes(controller.getElementsByTagName("skin")[0].getAttribute("source").substr(1),skeletonData);
	//var meshes=this.getMeshes(controller.getElementsByTagName("skin")[0].getAttribute("source").substr(1));
	var materials=node.getElementsByTagName("instance_material");
	var objMaterials={};
	for(var i=0; i<materials.length;i++){
		mat=this.getMaterial(materials[i].getAttribute("target").substr(1));
		objMaterials[materials[i].getAttribute("symbol")]=mat;
	}
	//create GLGE object
	for(i=0; i<meshes.length;i++){
		var multimat=new GLGE.MultiMaterial();
		multimat.setMesh(meshes[i]);
		if(objMaterials[meshes[i].matName]){
			if(objMaterials[meshes[i].matName].trans){
				obj.setZtransparent(true);
			}
			multimat.setMaterial(objMaterials[meshes[i].matName]);
		}else{
			var material=new GLGE.Material();
			multimat.setMaterial(material);
		}
		obj.addMultiMaterial(multimat);
	}
	return obj;
}

/**
* Creates a new group and parses it's children
* @param {DOM Element} node the element to parse
* @param {boolean} ref should this just get a reference for later addition
* @private
*/
GLGE.Collada.prototype.getNode=function(node,ref){

	//if a reference has previously been created then add it now
	if(!ref && node.GLGEObject){
		newGroup=node.GLGEObject;
		delete(this.GLGEObject);
		return newGroup;
	}
	
	//if a reference is requested a the node previously created then return here
	if(ref && node.GLGEObjects){
		return node.GLGEObjects[0];
	}
	
	var newGroup=new GLGE.Group();
	if(!node.GLGEObjects) node.GLGEObjects=[];
	node.GLGEObjects.push(newGroup); //map Collada DOM to GLGE
	var child=node.firstChild;
	var matrix=GLGE.identMatrix();
	var data;
	do{
		switch(child.tagName){
			case "node":
				newGroup.addGroup(this.getNode(child));
				break;
			case "instance_node":
				newGroup.addGroup(this.getNode(this.xml.getElementById(child.getAttribute("url").substr(1))));
				break;
			case "instance_visual_scene":
				newGroup.addGroup(this.getNode(this.xml.getElementById(child.getAttribute("url").substr(1))));
				break;
			case "instance_geometry":
				newGroup.addObject(this.getInstanceGeometry(child));
				break;
			case "instance_controller":
				newGroup.addObject(this.getInstanceController(child));
				break;
			case "matrix":
				matrix=this.parseArray(child);
				break;
			case "translate":
				data=this.parseArray(child);
				matrix=GLGE.mulMat4(matrix,GLGE.translateMatrix(data[0],data[1],data[2]));
				break;
			case "rotate":
				data=this.parseArray(child);
				matrix=GLGE.mulMat4(matrix,GLGE.angleAxis(data[3]*0.017453278,[data[0],data[1],data[2]]));
				break;
			case "scale":
				data=this.parseArray(child);
				matrix=GLGE.mulMat4(matrix,GLGE.scaleMatrix(data[0],data[1],data[2]));
				break;
		}
	}while(child=child.nextSibling);
	
	newGroup.setLoc(matrix[3],matrix[7],matrix[11]);
	var mat=GLGE.Mat4([matrix[0], matrix[1], matrix[2], 0,
								matrix[4], matrix[5], matrix[6], 0,
								matrix[8], matrix[9], matrix[10], 0,
								0, 0, 0, 1]);
			
	newGroup.setRotMatrix(mat);
	
	if(ref) node.GLGEObject=newGroup;
	
	return newGroup;
};
/**
* Initializes the Object/Scene when the collada document has been loaded
* @private
*/
GLGE.Collada.prototype.initVisualScene=function(){
	if(!this.rootId){
		var scene=this.xml.getElementsByTagName("scene");
		if(scene.length>0){
			this.addGroup(this.getNode(scene[0]));
		}else{
			GLGE.error("Please indicate the asset to render in Collada Document"+this.url);
		}
	}else{
		var root=this.xml.getElementById(this.rootId);
		if(root){
			this.addGroup(this.getNode(root));
		}else{
			GLGE.error("Asset "+this.rootId+" not found in document"+this.url);
		}
	}
};
/**
* Called when a collada document has is loaded
* @param {string} url the url of the loaded document
* @param {DOM Document} xml the xml document
* @private
*/
GLGE.Collada.prototype.loaded=function(url,xml){
	//GLGE.ColladaDocuments[url]=xml; //cache the document --- prevents multiple objects remove for now
	this.xml=xml;
	this.initVisualScene();
	this.getAnimations();
};

GLGE.Scene.prototype.addCollada=GLGE.Scene.prototype.addGroup;
GLGE.Group.prototype.addCollada=GLGE.Group.prototype.addGroup;


if(GLGE.Document){
	/**
	* Parses the dom element and creates a collada object
	* @param {domelement} ele the element to create the objects from
	* @private
	*/
	GLGE.Document.prototype.getCollada=function(ele){
		if(!ele.object){
			ele.object=new GLGE[this.classString(ele.tagName)]();
			ele.object.setDocument(ele.getAttribute("document"),this.getAbsolutePath(this.rootURL,null));
			ele.removeAttribute("document");
			this.setProperties(ele);
		}
		return ele.object;
	}
}

})(GLGE);
define("glge/glge_collada", function(){});
define("compiled/libs", function(){});
