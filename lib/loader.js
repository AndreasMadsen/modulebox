
// README:
// This is meant to have no footprint on the page where it is used.
// * Do not use any ES5 method in here.
// * Do not use any DOM event methods, use on{name} = function () {}
// * Do not use XHR features higher than level 1
(function (undefined) {

  function ModuleBox(settings) {
    if (!(this instanceof ModuleBox)) return new ModuleBox(settings);

    var self = this;

    // Validate settings
    if (typeof settings !== 'object' || settings === null) {
      throw TypeError('The settings object must be specified');
    }

    // Save url encoder
    if (typeof settings.url !== 'function') {
      throw TypeError('A url method must be provided');
    }
    this._urlEncode = settings.url;
    this._sourceUrl = settings.source || function (filepath) {
      return '/modulebox' + filepath;
    };

    // Stores the fetched and compiled data
    this._acquired = [];
    this._modules = {};

    // Abstraction properties, for require, ensure and resolve
    this._box = this;
    this._resolved = {};
    this._filename = '/';

    // require, require.ensure and require.resolve binding
    this.require = function() {
      return require.apply(self, arguments);
    };
    this.require.resolve = function() {
      return resolve.apply(self, arguments);
    };
    this.require.ensure = function() {
      return ensure.apply(self, arguments);
    };
  }
  window.modulebox = ModuleBox;

  ModuleBox.prototype._wrap = function (content) {
    return '(function (exports, require, module, __filename, __dirname) {' +
      content +
    '\n});';
  };

  ModuleBox.prototype._request = function (from, requests, callback) {
    var self = this;

    var destination = this._urlEncode(this._acquired, from, requests);
    var syncReturn;
    var async = !!callback;

    // If callback is not defined this is a sync request
    if (!callback) {
      callback = function (err, resolved) {
        syncReturn = err ? err : resolved;
      };
    }

    // Create a XMLHTTPRequest object
    var xhr = new XMLHttpRequest();
    xhr.open("GET", destination, async);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      // xhr error handling
      // NOTE: 12029 is IE statuscode for could not connect
      if (xhr.status === 0 || xhr.status === 12029) {
        return callback(new Error('Could not connect'), null);
      } else if (xhr.status !== 200 && xhr.status !== 304) {
        return callback(
          new Error('Got faulty status code ' + xhr.status), null
        );
      }

      // Document loaded, get XML document
      var xml = xhr.responseXML;
      var resolve = xml.getElementsByTagName('resolve')[0];
      var files = xml.getElementsByTagName('file');
      var error = xml.getElementsByTagName('error')[0];
      var map = xml.getElementsByTagName('map')[0];

      // Check for init error
      if (error) {
        return callback(createError(JSON.parse(textContent(error))), null);
      }

      // Merge resolved map object and source code
      var resolved = JSON.parse(textContent(map));
      for (var i = 0, l = files.length; i < l; i++) {
        var file = files[i];

        var filepath = file.getAttribute('path');
        // The module may already be fetched, e.q. dude to parallel requests
        // if so just skip the last one (this one)
        if (self._modules[filepath]) continue;

        // Store the module in the modulebox
        self._acquired.push(filepath);
        self._modules[filepath] = new Module(
          self, filepath, resolved[filepath], textContent(file)
        );
      }

      // The requested querys needs to be transformed intro either a absolute
      // filepath or an Error object.
      var result = JSON.parse(textContent(resolve));
      for (var j = 0; j < requests.length; j++) {
        var input = requests[j];
        if (typeof result[input] === 'string') continue;
        result[input] = createError(result[input]);
      }

      // Done, no fatal errors and all data is saved, execute callback
      // Note that the second argument will be the filepaths that the request
      // string was transformed into.
      callback(null, result);
    };

    // try-catch xhr.send and let onreadystatechange handle the error
    try {
      xhr.send(null);
    } catch (err) {}

    // While callback is actually called synchronously some browser have trouble
    // catching errors (in a try/catch) there are throwen from the callback
    if (syncReturn instanceof Error) {
      throw syncReturn;
    }

    // The returned value is the requests array transformed intro a resolve map
    return syncReturn;
  };

  //
  // Module constructor
  //
  function Module(box, filename, resolved, source) {
    // Reference to main modulebox object
    this._box = box;

    // filename is a public property
    this._filename = this.filename = filename;

    // Module data, note that _source will be set to null
    // once the module is compiled
    this._resolved = resolved || {};
    this._source = source;

    // compile state
    this._compiled = false;
    this.exports = {};
  }

  // Compiles source code hasn't been compiled, otherwice just use `exports`
  // object.
  Module.prototype._load = function () {
    if (!this._compiled) this._compile();

    return this.exports;
  };

  // Will set the exports property of this module object by compiling it with
  // the Module._extension methods.
  Module.prototype._compile = function () {
    var filename = this.filename;
    var ext = extname(filename);

    // Get compiler and default to .js
    var compiler = Module._extensions[ext];
    if (!compiler) compiler = Module._extensions['.js'];

    // Start compiler
    compiler(this, filename, this._source);

    // Remove source code (memory cleanup)
    this._source = null;

    // Set compiled flag
    this._compiled = true;
  };

  // See: http://perfectionkills.com/global-eval-what-are-the-options/
  // for detail
  var globalEval = (function () {

    // Feature detection for ES5 global eval
    var isIndirectEvalGlobal = (function(globalObject, Object) {
      try {
        return (1,eval)('Object') === globalObject;
      } catch(err) {
        return false;
      }
    })(Object, 0);

    // !!! TESTING NOTE: the variable name `content` is important in the
    // evaluation.js test.

    // indirect eval calls, execute javascript globally
    if (isIndirectEvalGlobal) {
      return function(content) {
        return (1,eval)(content);
      };
    }

    // Use script injection as a global eval method, note that
    // the sourceMaps feature `sourceURL` isn't yet supported.
    return function(content) {
      var script, result;

      try {
        // Compile script by appending a script tag
        script = document.createElement('script');
        script.appendChild(
          document.createTextNode('window._moduleboxFn = ' + content)
        );
        document.head.appendChild(script);
      } finally {
        // Cleanup after compiling
        document.head.removeChild(script);
        result = window._moduleboxFn;
        delete window._moduleboxFn;
      }

      return result;
    };
  })();

  // Will eveluate JavaScript source code
  Module.prototype._evaluate = function (content, filename) {
    var self = this;

    // This allow browser there supports source maps to use a meaningfull
    // script source url.
    var sourceMap = '//@ sourceURL=' + this._box._sourceUrl(filename);

    // Construct a string there wraps the input content in a function and
    // saves it in a global variable there will be deleted later
    content = this._box._wrap(content) + '\n' + sourceMap;

    // Evaluate script globally
    var result = globalEval(content);

    // Create a require function object
    function localRequire() {
      return require.apply(self, arguments);
    }
    localRequire.resolve = function () {
      return resolve.apply(self, arguments);
    };
    localRequire.ensure = function () {
      return ensure.apply(self, arguments);
    };

    // order is: (exports, require, module, __filename, __dirname)
    result(this.exports, localRequire, this, filename, dirname(filename));
  };

  // The Node.js core has require binded to the module prototype
  Module.prototype.require = require;

  // Native source compilers
  Module._extensions = {
    '.js':  function(module, filename, content) {
      module._evaluate(content, filename);
    },

    '.json': function(module, filename, content) {
      try {
        module.exports = JSON.parse(content);
      } catch (err) {
        err.message = filename + ': ' + err.message;
        throw err;
      }
    }
  };

  //
  // require, ensure and resolve abstractions
  //
  function require(name) {
    var resolved = resolve.call(this, name);

    // All good, return module exports
    return this._box._modules[resolved]._load();
  }

  function ensure(names, callback) {
    var self = this;

    // Create request list be filtering already ensured querys
    var requests = [];
    for (var i = 0; i < names.length; i++) {
      if (this._resolved[names[i]] === undefined) {
        requests.push(names[i]);
      }
    }

    // Don't do anything if request is empty
    if (requests.length === 0) return callback(null);

    this._box._request(this._filename, requests, function (err, resolved) {
      if (err) return callback(err);

      // Merge resolved object intro this._resolved
      for (var i = 0; i< requests.length; i++) {
        self._resolved[requests[i]] = resolved[requests[i]];
      }

      callback(null);
    });
  }

  function resolve(name) {
    var list = this._resolved;
    var resolved = list[name];

    // The resource hasn't been fetched, do a sync require
    if (!resolved) {
      if (console && console.warn) {
        // TODO: change this to console.warn
        console.warn(
          'Warning: ' + name + ' was requested synchronously from ' + this._filename
        );
      }

      // box._request returns a object where the items in the `name` array
      // becomes property names. In this case there is only one item, so it
      // will just be fetched by [name].
      resolved = list[name] = this._box._request(this._filename, [name])[name];
    }

    // If resolved is an error throw it
    if (resolved instanceof Error) {
      throw resolved;
    }

    return resolved;
  }

  //
  // Helper functions
  //
  function textContent(elem) {
    return elem.firstChild.textContent || elem.firstChild.data;
  }

  function createError(obj) {
    var err = new window[obj.name](obj.message);
        err.code = obj.code;
    return err;
  }

  function dirname(filepath) {
    return filepath.slice(0, filepath.lastIndexOf('/')) || '/';
  }

  function extname(filepath) {
    return filepath.slice(filepath.lastIndexOf('.')) || '.js';
  }

})();
