
var path = require('path');
var crypto = require('crypto');
var endpoint = require('endpoint');
var localizer = require('localizer');
var detective = require('detective');
var startpoint = require('startpoint');

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

// Returns a the metadata (hash and mtime) of the resource tree given by
// the starting module filepath. Note that files there are acquired are
// filter away from the meta calculation.
// This returns null if just a single resource hasn't been read before
// meaning cache object not yet filed.
ModuleBox.prototype._getMeta = function (filepath, acquired, callback) {
  var self = this;

  var latestmtime = 0;
  var files = [];

  var allfound = (function deept(resolved) {
    for (var input in resolved) {
      if (resolved.hasOwnProperty(input) === false) {
        continue;
      }

      var filepath = resolved[input];

      // filepath must be a string (otherwice resolve error)
      if (typeof filepath !== 'string') {
        continue;
      }

      // filepath must be new (not already acquired)
      if (acquired.indexOf(filepath) !== -1 ||
          files.indexOf(filepath) !== -1) {
        continue;
      }

      // If resource hasn't been cached stop now
      var cache = self._getCache(filepath);
      if (cache === null) return false;

      // Update latestmtime and hashes array
      if (latestmtime < cache.mtime) {
        latestmtime = cache.mtime;
      }

      files.push(filepath);

      // Go one level down and stop if one resource wasn't found
      var allfound = deept(cache.resolved);
      if (!allfound) return false;
    }

    return true;
  })({'/': filepath});

  // If just one resource wasn't found nothing can be predicted
  if (!allfound) {
    return callback(null, {
      'hash': null,
      'mtime': null
    });
  }

  // Sort files to get a consistent hashsum
  var hashes = files.sort().map(function (filepath) {
    return self._getCache(filepath).hash;
  });

  // Create new hash object
  var longhash = Buffer.concat(hashes);
  startpoint(longhash).pipe(crypto.createHash('sha256')).pipe(endpoint(function (err, hash) {
    if (err) return callback(err, null);

    // Send hash and mtime meta data
    callback(null, {
      'hash': hash.toString('hex'),
      'mtime': latestmtime === 0 ? null : new Date(latestmtime)
    });
  }));
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

  return new Bundle(this, from, request, acquired);
};
