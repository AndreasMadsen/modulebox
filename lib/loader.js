
// README:
// This is meant to have no footprint on the page where it is used.
// * Do not use any ES5 method in here.
// * Do not use any DOM event methods, use on{name} = function () {}
// * Do not use XHR features higher than level 1
(function (undefined) {

  function ModuleBox(settings) {
    if (!(this instanceof ModuleBox)) return new ModuleBox(settings);
    var self = this;

    // Save url encoder
    settings = settings || {};
    this._baseUrl = settings.baseUrl || hostUrl(window.location) + '/modulebox/';
    this._hostUrl = hostUrl(this._baseUrl);
    this._sourcePath = settings.sourcePath || '/modulebox/files/';

    // Stores the fetched and compiled data
    this._normal = { fetched: [], modules: {} };
    this._special = { fetched: [], modules: {} };
    this._specialMap = {};

    // Abstraction properties, for require, ensure and resolve
    this._box = this;
    this._resolved = {};
    this._filename = '/';
    this._isSpecial = false;

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

  function encodeObject(obj) {
    return encodeURIComponent(JSON.stringify(obj));
  }

  ModuleBox.prototype._generateUrl = function (from, requests) {
    return this._baseUrl +
      '?normal=' + encodeObject(this._normal.fetched) +
      '&special=' + encodeObject(this._special.fetched) +
      '&from=' + encodeObject(from) +
      '&request=' + encodeObject(requests);
  };

  ModuleBox.prototype._generateSourcePath = function (filepath, special) {
    var dir = (special ? this._baseUrl + '_special_/' : this._hostUrl + this._sourcePath);
    return dir + filepath.slice(1);
  };

  // Request can not happen form a special, so it is always from a normal module
  ModuleBox.prototype._request = function (from, requests, callback) {
    var self = this;

    // Internal debugging method, for knowning what requests are made
    if (this._requestNotify) {
      this._requestNotify(this._normal.fetched, this._special.fetched, from, requests);
    }

    var destination = this._generateUrl(from, requests);
    var syncReturn;
    var async = !!callback;
    var onreadystatechangeFired = false;

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
      onreadystatechangeFired = true;
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
      var files = xml.getElementsByTagName('file');
      var error = xml.getElementsByTagName('error')[0];

      // Check for init error
      if (error) {
        return callback(createError(JSON.parse(textContent(error))), null);
      }

      // Unpack the map elements
      var specialMap = unpack(xml, "map[special='true']");
      var normalMap = unpack(xml, "map[special='false']");

      // Unpack the resolve elements
      var specialResolve = unpack(xml, "resolve[special='true']");
      var normalResolve = unpack(xml, "resolve[special='false']");

      // The requested querys needs to be transformed intro either a absolute
      // filepath or an packed error object.
      var transform = {};
      for (var j = 0; j < requests.length; j++) {
        var input = requests[j];
        var special = specialResolve.hasOwnProperty(input);
        var value = special ? specialResolve[input] : normalResolve[input];

        transform[input] = { 'special': special, 'value': value };
      }

      // Merge resolved map object and source code
      for (var i = 0, l = files.length; i < l; i++) {
        var file = files[i];

        var filepath = file.getAttribute('path');
        var special = (file.getAttribute('special') === 'true');
        var container = special ? self._special : self._normal;
        var mapObject = special ? specialMap : normalMap;

        // The module may already be fetched, e.q. dude to parallel requests
        // if so just skip the last one (this one)
        if (container.modules[filepath]) continue;

        // Store the module in the modulebox
        container.fetched.push(filepath);

        var mapTransform = mapObject[filepath] || {};
        container.modules[filepath] = new Module(
          self, filepath, special, mapTransform, textContent(file)
        );
      }

      // Done, no fatal errors and all data is saved, execute callback
      // Note that the second argument will be the filepaths that the request
      // string was transformed into.
      callback(null, transform);
    };

    // try-catch xhr.send and let onreadystatechange handle the error
    try {
      xhr.send(null);
    } catch (err) {}

    // Some browser don't emit the onreadystatechange event in sync mode
    if (!async && !onreadystatechangeFired && xhr.readyState === 4) {
      xhr.onreadystatechange();
    }

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
  function Module(box, filename, isSpecial, resolved, source) {
    // Reference to main modulebox object
    this._box = box;

    // filename is a public property
    this._filename = this.filename = filename;

    // Module data, note that _source will be set to null
    // once the module is compiled
    this._isSpecial = isSpecial;
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

    // Set compiled flag before it is actually fully compiled in order to avoid
    // "maximum recursion depth" errors in case of circular requires.
    this._compiled = true;


    // Remove source code (memory cleanup)
    var soucecode = this._source;
    this._source = null;

    // Start compiler
    compiler(this, filename, soucecode);
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
    var sourceMap = '//@ sourceURL=' + this._box._generateSourcePath(filename, this._isSpecial);

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
    resolve.call(this, name);

    // At this point resolve either throwed or made sure that this._resolved[name]
    // is set.
    var special = this._resolved[name].special;
    var resolved = this._resolved[name].value;
    var container = special ? this._box._special : this._box._normal;

    // All good, return module exports
    return container.modules[resolved]._load();
  }

  function ensure(names, callback) {
    var self = this;

    if (this._isSpecial) {
      throw new Error('special modules can not make remove requests');
    }

    // Create request list be filtering already ensured querys
    var requests = [];
    for (var i = 0; i < names.length; i++) {
      if (this._resolved[names[i]] === undefined &&
          this._box._specialMap.hasOwnProperty(name) === false) {
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
    var item = list[name];

    // The resource hasn't been fetched, do a sync require
    if (!item) {
      if (this._isSpecial) {
        throw new Error('special modules can not make remove requests');
      }

      if (console && console.warn) {
        // TODO: change this to console.warn
        console.warn(
          'Warning: ' + name + ' was requested synchronously from ' + this._filename
        );
      }

      // box._request returns a object where the items in the `name` array
      // becomes property names. In this case there is only one item, so it
      // will just be fetched by [name].
      item = list[name] = this._box._request(this._filename, [name])[name];
    }

    var resolved = item.value;

    // If resolved failed create an error throw it
    // Note that the error object is create here and not at the XHR callback
    // in order to get a better stack trace
    if (typeof resolved !== 'string') {
      throw createError(resolved);
    }

    // Special requests just return their name if they come from a normal module
    return (item.special && !this._isSpecial) ? name : resolved;
  }

  //
  // Helper functions
  //
  function textContent(elem) {
    return elem.firstChild.textContent || elem.firstChild.data;
  }

  function unpack(xml, query) {
    return JSON.parse(textContent(xml.querySelector(query)));
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

  function hostUrl(href) {
    var a = document.createElement('a');
        a.href = href;
    return a.protocol + '//' + a.host;
  }
})();
