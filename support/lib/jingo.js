/*
 * Copyright 2008-2009 ArtisanLogic.com.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*global window document console setTimeout jingo*/
(function() {
  
  var manager, logger, paramCheck;
  
  /**
   * @namespace The jingo namespace encloses all non-local Jingo components, both public and 
   *  private, to prevent global namespace pollution.
   */
  jingo = {};
  

  //================================================================================================
  // jingo published api (init, module, exec)
  //================================================================================================
  
  /**
   * This function initializes Jingo's core configuration.
   * @param {object} config This parameter contains the object literal / hash of named parameters to 
   *  the init call.
   * @param {object} config.repos This parameter contains a hash of named, value pairs that map 
   *  from module repository prefix to module repository URL.  The default repository used for 
   *  non-prefixed modules is registered under the prefix 'main'.  The default URL for the main 
   *  repository is 'scripts'.
   * @param {string} config.verbosity This parameter contains the level of detail that the Jingo 
   *  system should log at. The possible levels in order of increasing verbosity are off, error, 
   *  warn, info, debug.  The default value is 'warn'.
   * @param {number} config.timeout This parameter contains the number of milliseconds Jingo should 
   *  wait for a script resource to load before it reports that the module may be missing.  The 
   *  default value is 30 seconds (30,000 millis).
   * @param {function} config.loader This parameter contains a custom module loading strategy 
   *  implementation.
   * @example
      <code><pre>
        jingo.init({
          repos: {
            main: '../scripts',
            other: '../other/scripts'
          },
          verbosity: 'info',
          timeout: 5000,
          loader: function(module, repos, module, logger) {
            // optional, custom loading strategy implementation
          }
        });
      </pre></code>
   */
  jingo.init = function(config) {
    if(!config) {
      logger.warn('A Jingo initialization was attempted with no configuration specified.');
      return;
    }
    if(config.verbosity) {
      var verbosity = jingo.Logger.Level.valueOf(config.verbosity);
      if(verbosity) {
        logger.debug('The Jingo logging verbosity will be set to ' + verbosity + '.');
        logger.setVerbosity(verbosity);
      } else {
        logger.warn('The provided logging level identifier, ' + config.verbosity + ' is not a valid logging level.');
      }
    }
    if(config.repos) {
      jingo.iterators.each(config.repos, function(name, url) {
        logger.info('The ' + name + ' module repository will be set to ' + url + '.');
        manager.repos[name] = /\/$/.exec(url) ? url : url + '/';
      });
    }
    if(config.timeout) {
      logger.info('The script loading timeout will be set to ' + config.timeout + '.');
      manager.timeout = config.timeout;
    }
    if(config.loader) {
      logger.info('The script loader is being set to ' + config.loader + '.');
      config.loader.dynamicLoader = manager.load;
      manager.load = config.loader;
    }
    paramCheck('jingo.init', ['verbosity', 'repos', 'timeout', 'loader'], config);
  };

  /**
   * This function declares a named module for the sake of making it available for other modules to 
   *  require.
   * @param {object} config This parameter is an object literal / hash of named parameters to
   *  the declare call.
   * @param {array[string]} config.require This optional configuration parameter lists the 
   *  qualified names of the modules depended on by the named module being declared.
   * @param {string} config.name This parameter contains the fully qualified name of the module
   *  being declared.
   * @param {function} config.as This parameter contains a function that will be called to resolve
   *  the named module being declared when all of its transitive dependencies have been resolved.
   * @param {boolean} config.dynamic This optional parameter determines whether required modules 
   *  should always be loaded dynamically, disabling static assembly loading. Defaults to false.
   * @example
    <code><pre>
     jingo.declare({
       require: [
         'baz'
       ],
       name: 'foo.bar',
       as: function() {
         foo.bar.baz = function() {
           return baz.do();
         }
       }
     });
    </pre></code>
   */
  jingo.declare = function(config) {
    paramCheck('jingo.declare', ['require', 'name', 'as', 'dynamic'], config);
    config.dependencies = config.require;
    config.body = config.as;
    manager.declare(config.name, config);
  };
  
  /**
   * This function declares an anonymous module for the sake of executing arbitrary code with
   * direct dependencies.
   * @param {object} config This parameter is an object literal / hash of named parameters to
   *  the anonymous module declaration.
   * @param {array[string]} config.require This optional configuration parameter lists the 
   *  qualified names of the modules depended on by the anonymous module being declared.
   * @param {function} config.exec This parameter contains a function that will be called to resolve
   *  the anonymous module being declared when all of its transitive dependencies have been 
   *  resolved.
   * @param {boolean} config.dynamic This optional parameter determines whether required modules 
   *  should always be loaded dynamically, disabling static assembly loading. Defaults to false.
   * @example
      <code><pre>
        jingo.anonymous({
          require: [
            'foo.bar'
          ],
          exec: function() {
            alert('result: ' + foo.bar.baz());
          }
        });
      </pre></code>
   */
  jingo.anonymous = function(config) {
    paramCheck('jingo.anonymous', ['require', 'exec', 'dynamic'], config);
    config.as = config.exec;
    delete config.exec;
    jingo.declare(config);
  };


  //================================================================================================
  // jingo module implementation (not published)
  //================================================================================================
  
  /**
   * This constructor creates a new jingo.Module instance.
   * This class is NOT part of the published Jingo API.  Direct usage of unpublished components 
   * may cause compatibility issues with future releases of Jingo.
   * @class Instances of the jingo.Module class each represent a JavaScript module that is managed 
   *  by Jingo.
   * @param {object} config The config parameter is a JavaScript object literal / hash of named 
   *  parameters that hold initial values for the constructed Module's properties.
   * @private
   */
  jingo.Module = function(counter) {
    
    return function(config) {
      
      var self = this;
      
      if(!config) {
        throw new Error('The module\'s configuration cannot be null.');
      }
      
      if(!(config.dependencies || config.body)) {
        throw new Error('The module\'s configuration must contain dependencies, a body or both.');
      }
      
      config.body = config.body || function() { 
        // a rollup module
      };
  
      if(typeof config.body != 'function') {
        throw new Error('The module\'s body must be a function.');
      }
      
      /**
       * This property identified the base script repository URL for this module.
       * @type string
       */
      this.repo = config.repo;
  
      /**
       * This property identifies the name that uniquely identifies this module within the scope of 
       * a jingo.Manager instance. There should only be one manager per page/document. This name will either 
       * be specified or generated depending if the module is declared or anonymous.
       * @type string
       */
      this.name = config.name || 'anonymous-' + counter++;
      
      /**
       * This property determines whether this module's dependencies are only determinable at runtime.
       */
      this.dynamic = !!config.dynamic; 
      
      if(config.dynamic && typeof config.dynamic !== 'boolean') {
        logger.warn('Dynamic config property should be a boolean.  Coercing value: [' +
          config.dynamic + '] of type: [' + typeof config.dynamic + '] may cause unexpected results.');
      }
      
      /**
       * This property identifies a list of module names which uniquely identify the modules it
       * directly depends on to function.
       * @type array<string>
       */
      this.dependencies = config.dependencies || [];
  
      /**
       * This property identifies the callback function to be invoked when all of this module's direct
       * and transitive dependencies have been resolved.
       * @type function
       */
      this.body = config.body;
    
      /**
       * This property identifies this module's current state within the Jingo module resolution
       * process.
       * @type jingo.Module.State
       */
      this.state = jingo.Module.State.LOADING;

      /**
       * This method provides access to the URL for the file resource containing this module's 
       * source code.  Anonymous modules do not have a URL.
       * @returns {string} This method returns the URL for the this module. This method returns 
       *  null if this is not a named module.
       */
      this.getUrl = function() {
        if(typeof self.repo === 'undefined' || self.repo === null) {
          return null;
        }
        return self.repo + self.name.replace(/\./g, '/') + '.js';
      };
    
      /**
       * This method provides a print-friendly representation of this module.
       * @returns {string} This method returns a print-friendly representation of this module.
       */
      this.toString = function() {
        return this.name;
      };
      
    };
  }(0);

  /**
   * This constructor creates a new jingo.Module.State instance.
   * This class is NOT part of the published Jingo API.  Direct usage of unpublished components 
   * may cause compatibility issues with future releases of Jingo.
   * @class Each instance of the jingo.Module.State class represents a member in the enumeration of 
   *  possible states that a Jingo module can occupy.
   * @param {string} value The value parameter is the initial value for the value property. 
   * @param {string} label The label parameter is a human-friendly textual representaion for this enum
   *  instance. 
   * @private
   */
  jingo.Module.State = function(value, label) {
    
    /**
     * The value property represents the primitive value of this enum instance.
     * @type string
     */
    this.value = value;
    
    /**
     * This method provides a human-friendly textual representation for this enum instance.
     * @returns {string} This method returns a human-friendly textual representation for this enum 
     *  instance.
     */
    this.toString = function() {
      return label;
    };
    
  };
  
  /**
   * This method provides a means to look up a jingo.Module.State by its string value.
   * @param {string} value This parameter is the value of the desired jingo.Module.State instance. 
   *  It is case insensitive.
   * @returns {jingo.Module.State} This method returns the jingo.Module.State instance corresponding to the provided
   *  value.  The value null will be returned if no such jingo.Module.State instance is found.
   * @static
   */
  jingo.Module.State.valueOf = function(value) {
    return jingo.iterators.find(jingo.Module.State, function(key, state) {
      return state.value === (value && value.toUpperCase());
    });
  };
  
  /**
   * This state represents a module that is in the process of being loaded from its URL by the
   * browser.
   * @static
   * @constant
   * @type jingo.Module.State 
   */
  jingo.Module.State.LOADING = new jingo.Module.State('LOADING', 'Loading...');
  
  /**
   * This state represents a module that has been interpreted by the browser's JavaScript 
   * engine but whose direct and transitive dependencies may not have been resolved yet.
   * @static
   * @constant
   * @type jingo.Module.State
   */
  jingo.Module.State.DECLARED = new jingo.Module.State('DECLARED', 'Declared.');
  
  /**
   * This state represents a module that has been completely resolved and is ready for use.
   * @static
   * @constant
   * @type jingo.Module.State
   */
  jingo.Module.State.RESOLVED = new jingo.Module.State('RESOLVED', 'Resolved.');
  
  
  //================================================================================================
  // jingo manager implementation (not published)
  //================================================================================================
  
  /**
   * This constructor creates a new jingo.Manager instance.
   * This class is NOT part of the published Jingo API.  Direct usage of unpublished components 
   * may cause compatibility issues with future releases of Jingo.
   * @class Instances of the jingo.Manager class are used to manage the loading, declaration and
   *  resolution of interdependent JavaScript modules.
   * @private
   */
  jingo.Manager = function() {

    var State = jingo.Module.State;
  
    var Module = jingo.Module;

    var modules = {};
    
    var self = this;
  
    /**
     * This property represents the URL identifying the root directory containing the modules 
     * managed by this manager.
     * @type string
     */
    this.repos = {
      main: 'scripts/'
    };
    
    /**
     * This property contains the global module loading timeout value in milliseconds.  It defaults 
     * to 30 seconds (30,000 millis).
     * @type number
     */
    this.timeout = 30000;
    
    /**
     * This method splits potentailly prefixed dependency declarations into their individual 
     * components and returns them encapsulated in a dependency object.
     * @param {string} dependency This parameter contains the potentially repo-prefixed dependency 
     *  declaration.
     * @param {jingo.Module} dependent This parameter holds the module that depends on the 
     *  dependency being parsed.
     * @returns {object} This method returns a dependency object repesenting the repository and 
     *  module name components of a prefixed dependency declaration.
     */
    var parseDependency = function(dependency, dependent) {
      var parts = dependency.split(':');
      if(parts.length < 2) {
        return {
          repo: dependent.repo || self.repos.main,
          name: parts[0],
          dynamic: dependent.dynamic
        };
      }
      return {
        repo: self.repos[parts[0]],
        name: parts[1],
        dynamic: dependent.dynamic
      };
    };

    /**
     * This method ensures that all of the specified module's enclosing namespaces are initialized.
     * @param {jingo.Module} module This parameter contians the named module for which we are 
     *  providing namespace assurance.
     */
    var initializeNamespace = function(module) {
      var currentNamespace = window;
      var parts = module.toString().split('.');
      delete parts[parts.length - 1];
      jingo.iterators.each(parts, function(index, part) {
        if(!currentNamespace[part]) {
          currentNamespace[part] = {};
        }
        currentNamespace = currentNamespace[part];
      });
    };

    /**
     * This method starts the loading phase of the module resolution process for the specified 
     * module if it hasn't already been loaded.
     * @param {object} name This parameter contains the dependency object identifying the module to 
     *  be conditionally loaded.
     */
    var load = function(dependency) {
      if(!modules[dependency.name]) {
        logger.info('loading module: ' + dependency.name + ' from repo ' + dependency.repo + '...');
        modules[dependency.name] = new Module({
          name: dependency.name,
          repo: dependency.repo,
          body: function() {}
        });
        var module = modules[dependency.name];
        jingo.dom.appendScript(module.getUrl());
        setTimeout(function() {
          if(module.state === State.LOADING) {
            logger.error('The module: ' + module.name + ' seems to be stuck in ' + State.LOADING + ' state.  ' +
              'You may want to verify that its resource path: ' + module.getUrl() + ' is valid.');
          }
        }, self.timeout);
      }
    };

    /**
     * This method transitions the specified module to the resolved state if the module is in an
     * appropriate state to be resolved and all of its direct and transitive dependencies have been
     * resolved.
     * @param {jingo.Module} module This parameter contains the module to be conditionally resolved.
     * @returns {boolean} The method returns true if and only if the provided module was indeed 
     *  transitioned to the resolved state as a result of the call.
     */
    var resolve = function(module) {
      if(module.state != State.DECLARED) {
        return false;
      }
      logger.debug('checking dependencies for module: ' + module + '...');
      var dependenciesResolved = jingo.iterators.every(module.dependencies, function(index, dependency) {
        dependency = modules[dependency.name];
        return dependency && dependency.state == State.RESOLVED;
      });
      if(dependenciesResolved) {
        logger.debug('resolving module: ' + module + '...');
        module.state = State.RESOLVED;
        initializeNamespace(module);
        module.body();
        logger.info('module: ' + module + ' resolved.');
      }
      return dependenciesResolved;
    };

    /**
     * This method is called when a module or modules have completed state transitions that may have
     * caused other modules to be ready for transition.
     */
    var update = function() {
      logger.debug('running update...');
      var resolutions = false;
      jingo.iterators.each(modules, function(name, module) {
        resolutions = resolve(module) || resolutions;
      });
      if(resolutions) {
        update();
      }
    };
    
    /**
     * This method implements the default module loading strategy.
     * @param {jingo.Module} module This parameter holds the module for which dependencies are to be
     *  loaded.
     * @param {object} repos This parameter contains a hash of named, value pairs that map from 
     *  module repository prefix to module repository URL.
     * @param {array} modules This parameter contains the array of modules know to the manager.
     * @param {jingo.Logger} logger This parameter is the currently configured jingo logger.
     */
    this.load = function(module, repos, modules, logger) {
      jingo.iterators.each(module.dependencies, function(index, dependency) {
        load(dependency);
      });
    };

    /**
     * This method transitions a module to the declared phase of the module resolution process if a 
     * module with the specified name hasn't already been declared.
     * @param {string} name This parameter contains the name of the module to be conditionally 
     *  declared.
     * @param {object} config This parameter contains the JavaScript object literal / hash of named 
     *  parameters to configure the module.
     */
    this.declare = function(name, config) {
      config.name = name;
      var newModule = new Module(config);
      var module = modules[newModule.name];
      if(module) {
        if(module.state !== State.LOADING) {
          return;
        }
        module.dependencies = newModule.dependencies;
        module.body = newModule.body;
      } else {
        module = newModule;
        modules[module.name] = module;
      }
      module.state = State.DECLARED;
      jingo.iterators.each(module.dependencies, function(index, dependency) {
        module.dependencies[index] = parseDependency(dependency, module);
      });
      self.load(module, this.repos, modules, logger);
      if(resolve(module)) {
        update();  
      }
    };

  };

  manager = new jingo.Manager();
  jingo.manager = manager;
  
  
  //================================================================================================
  // jingo logging implementation (not pubished)
  //================================================================================================
  
  /**
   * This constructor creates a new jingo.Logger instance.
   * This class is NOT part of the published Jingo API.  Direct usage of unpublished components 
   * may cause compatibility issues with future releases of Jingo.
   * @class Instances of the jingo.Logger class are used to output informative messages 
   *  about Jingo module management progress, errors and warnings.
   * @param {jingo.Logger.Level} level This paramerter is the initial value for this logger's 
   *  logging threshold.
   * @private
   */
  jingo.Logger = function(level) {
    
    var Level = jingo.Logger.Level;
    
    var verbosity = level || Level.WARN;
    
    /**
     * This method sets this logger's verbosity to the specified value.
     * @param {jingo.Logger.Level} level This parameter contains the new value for the verbosity 
     *  property.
     */
    this.setVerbosity = function(level) {
      verbosity = level || verbosity;
    };
    
    /**
     * This method provides a means to determine if a message passed at the specified level will
     * be logged given the current logging verbosity.
     * @param {jingo.Logger.Level} level This parameter contains level to be compared to the current 
     *  verbosity.
     * @returns {boolean} This method returns true if a message passed at the specified level
     *  would be logged at the current verbosity.
     */
    this.isEnabled = function(level) {
      return verbosity.priority && level.priority && level.priority <= verbosity.priority;
    };
    
    /**
     * This method logs the provided message if and only if the level specified is enabled under the 
     * current verbosity.
     * @param {jingo.Logger.Level} level This paramerter contains the level the message is to be 
     *  logged at.
     * @param {string} message This parameter contains the message to be logged.
     */
    this.log = function(level, message) {
      if(this.isEnabled(level) && typeof console != 'undefined') {
        if (level == Level.ERROR) {
            console.error(message);
        }
        else if (level == Level.DEBUG) {
            console.log(message);
        }
        else if (level == Level.INFO) {
            console.info(message);
        }
        else if (level == WARN) {
            console.warn(message);
        }
        else {
            console.log(message);
        }
      }
    };
    
    /**
     * This method logs the provided message if and only if the current verbosity is at or above 
     *  DEBUG.
     * @param {string} message This parameter contains the message to be logged.
     */
    this.debug = function(message) {
      this.log(Level.DEBUG, message);
    };
    
    /**
     * This method logs the provided message if and only if the current verbosity is at or above 
     *  INFO.
     * @param {string} message This parameter contains the message to be logged.
     */
    this.info = function(message) {
      this.log(Level.INFO, message);
    };
    
    /**
     * This method logs the provided message if and only if the current verbosity is at or above 
     *  WARN.
     * @param {string} message This parameter contains the message to be logged.
     */
    this.warn = function(message) {
      this.log(Level.WARN, message);
    };
    
    /**
     * This method logs the provided message if and only if the current verbosity is at or above 
     *  ERROR.
     * @param {string} message This parameter contains the message to be logged.
     */
    this.error = function(message) {
      this.log(Level.ERROR, message);
    };
    
  };
  
  /**
   * This constructor creates a new jingo.Logger.Level instance.
   * This class is NOT part of the published Jingo API.  Direct usage of unpublished components 
   * may cause compatibility issues with future releases of Jingo.
   * @class Each instance of the jingo.Logger.Level class represents a member in the enumeration 
   *  of possible logging severity levels within the Jingo logging system.
   * @param {string} value This parameter provides the initial value for the value property.
   * @param {number} priority This parameter is the initial value for the priority property.
   * @param {string} label The label parameter is a human-friendly textual representaion of this 
   *  enum instance. 
   * @private
   */
  jingo.Logger.Level = function(value, priority, label) {
    
    /**
     * The value property represents the primitive value of this enum instance.
     * @type string
     */
    this.value = value;
    
    /**
     * The priority property represents the priority of this logging level.  Levels with higher 
     *  priorities are more verbose.  Higher priority levels imply levels with lower priority.
     * @type number
     */
    this.priority = priority;

    /**
     * @returns {string} This method returns a human-friendly textual representaion for this enum 
     *  instance.
     */
    this.toString = function() {
      return label;
    };
    
  };
  
  /**
   * This method provides a means to look up a jingo.Logger.Level by its string value.
   * @param {string} value This parameter is the value of the desired jingo.Logger.Level instance. 
   *  It is case insensitive.
   * @returns {jingo.Logger.Level} This method returns the jingo.Logger.Level instance 
   *  corresponding to the provided value.  The value null will be returned if no such 
   *  jingo.Logger.Level instance is found.
   * @static
   */
  jingo.Logger.Level.valueOf = function(value) {
    return jingo.iterators.find(jingo.Logger.Level, function(key, level) {
      return level.value === (value && value.toUpperCase());
    });
  };

  /**
   * This level of logging is the most verbose. It is often used for troubleshooting issues.
   * @static
   * @constant
   * @type jingo.Logger.Level
   */
  jingo.Logger.Level.DEBUG = new jingo.Logger.Level('DEBUG', 4, 'Debug');
  
  /**
   * This level of logging is less verbose than DEBUG, but still outputs some informational 
   * messages that may help Jingo users follow the sytems progress through the module resolution 
   * process.
   * @static
   * @constant
   * @type jingo.Logger.Level 
   */
  jingo.Logger.Level.INFO = new jingo.Logger.Level('INFO', 3, 'Info');
  
  /**
   * This level of logging verbosity will only log messages that may indicate a problem with the
   * Jingo module resolution process.
   * @static
   * @constant
   * @type jingo.Logger.Level
   */
  jingo.Logger.Level.WARN = new jingo.Logger.Level('WARN', 2, 'Warn');
  
  /**
   * This level of logging verbosity will only log messages that definitely indicate a problem with
   * the Jingo module resolution process.
   * @static
   * @constant
   * @type jingo.Logger.Level
   */
  jingo.Logger.Level.ERROR = new jingo.Logger.Level('ERROR', 1, 'Error');
  
  /**
   * This level of logging verbosity will never log any message.
   * @static
   * @constant
   * @type jingo.Logger.Level
   */
  jingo.Logger.Level.OFF = new jingo.Logger.Level('OFF', 0, 'Off');
  
  logger = new jingo.Logger();
  
  
  //================================================================================================
  // jingo iteration helpers (not published)
  //================================================================================================
  
  /**
   * @namespace The iterators namespace encloses all iteration utilities used internally by Jingo.
   * @private
   */
  jingo.iterators = {
    
    /**
     * This function iterates over the given data structure and invokes the specified closure
     * for each key, value pair.
     * @param {object/array} data This parameter contains the data structure to be iterated.
     * @param {function} closure This parameter is the function to be invoked for each key, value 
     *  pair in the provided data structure.
     */
    each: function(data, closure) {
      for(var key in data) {
        if(data.hasOwnProperty(key)) {
          if(data.constructor === Array) {
            key = +key;
          }
          closure(key, data[key]);
        }
      }
    },
    
    /**
     * This function iterates over the given data structure and invokes the specified predicate
     * function for each key, value pair.
     * @param {object/array} data This parameter contains the data structure to be iterated.
     * @param {function} predicate This parameter contains the predicate function to be invoked for 
     *  each key, value pair in the provided data structure.
     * @returns {boolean} This function returns true if and only if every invocation of the provided 
     *  predicate returned true.
     */
    every: function(data, predicate) {
      for(var key in data) {
        if(data.hasOwnProperty(key)) {
          if(!predicate(key, data[key])) {
            return false;
          }
        }
      }
      return true;
    },
    
    /**
     * This function iterates over the given data structure and invokes the specified predicate
     * function for each key, value pair.
     * @param {object/array} data This parameter contains the data structure to be iterated.
     * @param {function} predicate The predicate to be invoked for each key, value pair in the 
     *  provided data structure.
     * @returns {object} This function returns the value of the first key, value pair to pass the 
     *  predicate's test.
     */
    find: function(data, predicate) {
      for(var key in data) {
        if(data.hasOwnProperty(key)) {
          if(predicate(key, data[key])) {
            return data[key];
          }
        }
      }
    }
  };


  //================================================================================================
  // jingo DOM helpers (not published)
  //================================================================================================
  
  /**
   * @namespace The dom namespace encloses all dom traveral and manipulation utilities used 
   * internally by Jingo.
   * @private
   */
  jingo.dom = {
    
    /**
     * This function creates a DOM element of the specified type with the specified attributes.
     * @param {string} type This parameter identifies the type of element to be used.
     * @param {object} attributes This parameter is a set of name, value pairs to become attributes
     *  on the created DOM element.
     * @returns {DOMElement} This function returns the created element.
     */
    create: function(type, attributes) {
      var element = document.createElement(type);
      jingo.iterators.each(attributes, function(name, value) {
        element.setAttribute(name, value);
      });
      return element;
    },
    
    /**
     * This function finds the last instance of the specified element type within the document.
     * @param {string} type This parameter identifies the type of element to be used.
     * @returns {DOMElement} This function returns the last element of the specified type, or null if no such 
     *  element exists.
     */
    last: function(type) {
      var elements = document.getElementsByTagName(type);
      if(!elements.length) {
        return null;
      }
      return elements[elements.length - 1];
    },
    
    /**
     * This function inserts the specified element into the document directly after the given target
     * element.
     * @param {DOMElement} element This paramerter is the element to be inserted into the document 
     *  directly after the given target.
     * @param {DOMElement} target This paramerter is the element within the document that the new
     *  element is to be inserted after.
     */
    insertAfter: function(element, target) {
      var parent = target.parentNode;
      if(target == parent.lastChild) {
        parent.appendChild(element);
      } else {
        parent.insertBefore(element, target.nextSibling);
      }
    },
    
    appendScript: function(url) {
      var script = jingo.dom.create('script', {
        src: url,
        type: 'text/javascript',
        charset: 'utf-8'
      });
      jingo.dom.insertAfter(script, jingo.dom.last('script'));
    }
    
  };
  
  
  //================================================================================================
  // jingo parameter checking helpers (not published)
  //================================================================================================
  
  /**
   * This function verifies a set of passed parameters against a set of expected parameters in an effort
   * to provide early warnings when potential initialization or module declaration issues are detected.
   * @param {string} method The name of the method/function that this parameter check is being run for.
   * @param {array[string]} expectedParams The list of named parameters that the method we are checking 
   *  against expects.
   * @param {object} actualParams The object literal / hash of named parameters that was actually passed
   *  to the method.
   */
  paramCheck = function(method, expectedParams, actualParams) {
    if(logger.isEnabled(jingo.Logger.Level.WARN)) {
      jingo.iterators.each(actualParams, function(actualParam) {
        var invalidParam = !jingo.iterators.find(expectedParams, function(index, expectedParam) {
          return actualParam === expectedParam;
        });
        if(invalidParam) {
          logger.warn('The unexpected named parameter: ' + actualParam + ' was passed to the ' + method + ' function.');
          delete actualParams[actualParam];
        }
      });
    }
  };
  
})();
