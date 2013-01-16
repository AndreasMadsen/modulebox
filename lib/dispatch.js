
var path = require('path');
var localizer = require('localizer');
var detective = require('detective');
var Bundle = require('./bundle.js');

function ModuleBox(settings) {
  if (!(this instanceof ModuleBox)) return new ModuleBox(settings);

  this._root = settings.root;
  this._cache = {};
  /*
    [filename] = {
      resolved: [<String> or <Object>],
      mtime: <Number>,
      hash: <Buffer>
    };
  */

  this._localizer = localizer(settings);
}
module.exports = ModuleBox;

ModuleBox.prototype._realpath = function (filepath) {
  return path.resolve(this._root, '.' + filepath);
};

ModuleBox.prototype.clientCore = path.resolve(__dirname, 'loader.js');

// Simple wrapper around the cache object
ModuleBox.prototype._getCache = function (filepath) {
  var exists = this._cache.hasOwnProperty(filepath);
  if (!exists) return null;

  return this._cache[filepath];
};

ModuleBox.prototype._setCache = function (filepath, cache) {
  this._cache[filepath] = cache;
};

// Returns a list of resources to send where acquired are filter away
// Its important to note that resources are send as the are read and no
// prereading is necessary. This is just a convenient for predicting ETag
// and mtime.
// This returns null if just a single resource hasn't been read before
// (cache object not filed).
// TODO: check error handling (particularly how cache is set)
ModuleBox.prototype._getResources = function (filepath, acquired) {

};

function sortObject(object) {
  var keys = Object.keys(object).sort();
  var output = {};

  for (var i = 0; i < keys.length; i++) {
    output[ keys[i] ] = object[ keys[i] ];
  }

  return output;
}

function uniqueArray(array) {
  var list = {};

  for (var i = 0; i < array.length; i++) {
    list[ array[i] ] = 0;
  }

  return Object.keys(list);
}

// Scans a content and resolve all dependencies
ModuleBox.prototype._scanFile = function (filepath, content, callback) {
  var self = this;

  // fetch from and input data, from filepath and file content
  var from = path.dirname(filepath);
  var calls = detective(content);

  // Remove dublicates
  calls = uniqueArray(calls);

  // The wanted result is a input: require.resolve(input) map
  var errors = [];
  var resolveObject = {};
  var total = calls.length;
  var current = 0;

  // If there are no required modules, just execute the callback now
  if (total === 0) {
    return callback(null, {});
  }

  calls.forEach(function resolveMap(input) {
    self._localizer(from, input, function (err, result) {
      if (err) {
        // A object will indicate an error, note that the stack trace is
        // removed for security reasons.
        resolveObject[input] = {
          code: err.code,
          message: err.message,
          name: err.name
        };

        // All errors will be outputted
        errors.push(err);
      } else {
        resolveObject[input] = result;
      }

      // Execute callback once all _localizer is executed
      current += 1;
      if (current === total) {
        errors = errors.length === 0 ? null : errors;
        return callback(errors, sortObject(resolveObject));
      }
    });
  });
};

ModuleBox.prototype.dispatch = function (info) {
  var from = typeof info.source === 'string' ? path.dirname(info.source) : '/';
  var acquired = Array.isArray(info.acquired) ? info.acquired : [];
  var request = info.request;

  console.log(info);

  return new Bundle(this, from, request, acquired);
};
