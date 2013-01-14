
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

  ModuleBox.prototype._request = function (from, request, callback) {
    var self = this;

    var destination = this._urlEncode(this._acquired, from, request);

    // Create a XMLHTTPRequest object
    var xhr = new XMLHttpRequest();
    xhr.open("GET", destination, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      // xhr error handling
      if (xhr.status === 0) {
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
        if (self._modules[filepath]) continue;

        self._acquired.push(filepath);
        self._modules[filepath] = new Module(
          self, filepath, resolved[filepath], textContent(file)
        );
      }

      // Done, no errors and all data saved, execute callback
      // Note that the second argument will be the filepath that the request
      // string was transformed into.
      callback(null, textContent(resolve));
    };

    xhr.send(null);
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
    this._resolved = resolved;
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

  // Will eveluate JavaScript source code
  Module.prototype._evaluate = function (content, filename) {
    var self = this;
    var script, result;

    content = 'window._moduleboxFn = ' + this._box._wrap(content);

    try {
      // Compile script by appending a script tag
      script = document.createElement('script');
      script.appendChild(document.createTextNode(content));
      document.head.appendChild(script);
    } finally {
      // Cleanup after compiling
      document.head.removeChild(script);
      result = window._moduleboxFn;
      delete window._moduleboxFn;
    }

    // Create a require function object
    function require() {
      return require.apply(self, arguments);
    }
    require.resolve = function () {
      return resolve.apply(self, arguments);
    };
    require.ensure = function () {
      return ensure.apply(self, arguments);
    };

    // order is: (exports, require, module, __filename, __dirname)
    result(this.exports, require, this, filename, dirname(filename));
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
    var list = this._box._resolved;
    var resolved = list[name];
    if (!resolved) {
      throw new Error('Sync resolve not implemented, use require.ensure');
    }

    // If resolved is an error throw it
    if (resolved instanceof Error) {
      throw resolved;
    }

    // Since we can't fetch object keys in a reliable way, the errors are
    // constructed here.
    if (typeof resolved === 'object' && resolved !== null) {
      list[name] = createError(resolved);
      throw list[name];
    }

    // All good, return module exports
    return this._box._modules[resolved]._load();
  }

  function ensure(name, callback) {
    var self = this;

    // Already ensured
    var resolved = this._box._resolved[name];
    if (resolved) {
      return callback(typeof resolved === 'string' ? null : resolved);
    }

    this._box._request(this._filename, name, function (err, resolved) {
      if (err) {
        self._box._resolved[name] = err;
        return callback(err);
      }

      self._resolved[name] = resolved;
      callback(null);
    });
  }

  function resolve(name) {
    var filepath = this._box._resolved[name];
    if (!filepath) {
      throw new Error('Sync resolve not implemented, use require.ensure');
    }

    return filepath;
  }

  //
  // Helper functions
  //
  function textContent(elem) {
    return elem.firstChild.textContent;
  }

  function createError(obj) {
    var err = new window[obj.name](obj.message);
        err.code = obj.code;
    return err;
  }

  function dirname(filepath) {
    filepath.slice(0, filepath.lastIndexOf('/')) || '/';
  }

  function extname(filepath) {
    return filepath.slice(filepath.lastIndexOf('.')) || '.js';
  }

})();
