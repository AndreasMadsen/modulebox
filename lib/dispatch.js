
var path = require('path');
var localizer = require('localizer');
var detective = require('detective');
var async = require('async');
var Bundle = require('./bundle.js');

function ModuleBox(settings) {
  if (!(this instanceof ModuleBox)) return new ModuleBox(settings);

  this._root = settings.root;
  this._cache = {};

  this._localizer = localizer(settings);
}
module.exports = ModuleBox;

ModuleBox.prototype._realpath = function (filepath) {
  return path.resolve(this._root, '.' + filepath);
};

ModuleBox.prototype._getDependencies = function (filepath) {
  var exists = this._cache.hasOwnProperty(filepath);
  if (!exists) return null;

  return this._cache[filepath];
};

ModuleBox.prototype._setDependencies = function (filepath, dependencies) {
  this._cache[filepath] = dependencies;
};

ModuleBox.prototype._scanFile = function (filepath, content, callback) {
  var self = this;

  // fetch from and input data, from filepath and file content
  var from = path.dirname(filepath);
  var calls = detective(content);

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
        return callback(errors.length === 0 ? null : errors, resolveObject);
      }
    });
  });
};

ModuleBox.prototype.dispatch = function (info) {
  var from = typeof info.source === 'string' ? path.dirname(info.source) : '/';
  var acquired = Array.isArray(info.acquired) ? info.acquired : [];
  var request = info.request;

  return new Bundle(this, from, request, acquired);
};
