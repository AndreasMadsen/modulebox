
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

function createResolveBuffer(resolved) {
  var strings = [];
  for (var i = 0; i < resolved.length; i++) {
    var result = resolved[i];
    if (result.error) {
      strings.push( result.error.toString() );
    } else if (result.filepath) {
      strings.push( result.filepath );
    }
  }

  // Strings are joined with a wired character in order to avoid that two
  // diffrent inputs returns the same buffer
  // ['/file.js', '/file.json'] and ['file.js/file.json']
  return new Buffer(strings.sort().join('\0'));
}

// Returns a the metadata (hash and mtime) of the resource tree given by
// the starting module filepath. Note that files there are acquired are
// filter away from the meta calculation.
// This returns null if just a single resource hasn't been read before
// meaning cache object not yet filed.
ModuleBox.prototype._getMeta = function (resolved, acquired, callback) {
  var self = this;

  // TODO: what if everything is acquired
  // TODO: error handling

  var latestmtime = 0;
  var files = [];

  function fetch(resolved) {
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
      var deeptfound = fetch(cache.resolved);
      if (!deeptfound) return false;
    }

    return true;
  }

  var allfound = true;
  for (var i = 0; i < resolved.length; i++) {
    if (resolved[i].error) continue;

    var deeptfound = fetch({'/': resolved[i].filepath});

    if (!deeptfound) {
      allfound = false;
      break;
    }
  }

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

  // Add resolved input to the beginning of the hashes array
  hashes.unshift( createResolveBuffer(resolved) );

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
  // fetch from and input data, from filepath and file content
  var from = path.dirname(filepath);
  var calls = detective(content);

  // Remove dublicates
  calls = uniqueArray(calls);

  this._resolve(from, calls, function (err, resolved) {
    if (err) return callback(err, null);

    var errors = [];
    var object = {};

    for (var i = 0; i < resolved.length; i++) {
      var result = resolved[i];

      if (resolved[i].error) {
        errors.push(result.error);
        object[result.input] = {
          code: result.error.code,
          message: result.error.message,
          name: result.error.name
        };
      } else if (resolved[i].filepath) {
        object[result.input] = result.filepath;
      }
    }

    callback(errors, sortObject(object));
  });
};

ModuleBox.prototype._resolve = function (from, request, callback) {
  var self = this;
  var resolves = [];

  var current = 0;
  var total = request.length;

  // If there are no requested modules, just execute the callback now
  if (total === 0) callback(null, resolves);

  request.forEach(function resolveMap(input) {
    self._localizer(from, input, function (err, result) {
      resolves.push({
        'input': input,
        'error': err,
        'filepath': result
      });

      current += 1;
      if (current === total) return callback(null, resolves);
    });
  });
};

ModuleBox.prototype.dispatch = function (info) {
  var from = typeof info.source === 'string' ? path.dirname(info.source) : '/';
  var acquired = Array.isArray(info.acquired) ? info.acquired : [];
  var request = info.request;

  return new Bundle(this, from, request, acquired);
};
