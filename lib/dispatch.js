
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
  var resolveObject = {};
  for (var i = 0; i < calls.length; i++) {
    resolveObject[calls[i]] = resolveMap.bind(this, calls[i]);
  }

  function resolveMap(input, callback) {
    self._localizer(from, input, function (err, result) {
      if (err && err.code === 'MODULE_NOT_FOUND') return callback(null, null);

      callback(err, result);
    });
  }

  // resolve all dependencies to fullpaths
  async.parallel(resolveObject, callback);
};

ModuleBox.prototype.dispatch = function (info) {
  // FIXME: blocking
  var startpath = this._localizer(path.dirname(info.source), info.request);

  return new Bundle(this, startpath, info.acquired);
};

