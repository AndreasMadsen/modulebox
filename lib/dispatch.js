
var path = require('path');
var async = require('async');
var crypto = require('crypto');
var endpoint = require('endpoint');
var localizer = require('localizer');
var detective = require('detective');
var startpoint = require('startpoint');

var Bundle = require('./bundle.js');

function ModuleBox(settings) {
  if (!(this instanceof ModuleBox)) return new ModuleBox(settings);

  this._root = settings.root;
  this._special = settings.special || {};
  this._cache = {};
  /*
    [filename] = {
      resolved: [<String>],
      speical: [<String>],
      localized: [<String> or <Object>],
      mtime: <Number>,
      hash: <Buffer>
    };
  */

  this._localizer = localizer(settings);
}
module.exports = ModuleBox;

ModuleBox.prototype._fullpath = function (job) {
  if (job.special) {
    return this._special[job.value];
  } else {
    return path.resolve(this._root, '.' + job.value);
  }
};

ModuleBox.prototype.clientCore = path.resolve(__dirname, 'loader.js');

// Simple wrapper around the cache object
ModuleBox.prototype._getCache = function (value) {
  var exists = this._cache.hasOwnProperty(value);
  if (!exists) return null;

  return this._cache[value];
};

ModuleBox.prototype._setCache = function (value, cache) {
  this._cache[value] = cache;
};

// Takes a resolved object and generates a consistent buffer, in order
//  to use it as an input for a hashsum.
function createResolveBuffer(resolved) {
  var info = {};

  var keys = Object.keys(resolved).sort();
  for (var i = 0; i < keys.length; i++) {
    info[keys[i]] = resolved[keys[i]].toString();
  }

  return new Buffer(JSON.stringify(info));
}

function uniqueArray(array) {
  var list = {};

  for (var i = 0; i < array.length; i++) {
    list[ array[i] ] = 0;
  }

  return Object.keys(list);
}

ModuleBox.prototype._concatKnown = function (acquired, special) {
  var filepaths = acquired.slice(0);
  for (var i = 0; i < special.length; i++) {
    filepaths.push(this._special[special[i]]);
  }
  return filepaths;
};

// Returns a the metadata (hash and mtime) of the resource tree given by
// the starting module filepath. Note that files there are acquired are
// filter away from the meta calculation.
// This returns null if just a single resource hasn't been read before
// meaning cache object not yet filed.
//
// resolved: represent the <resolve> tag content
// includes: represent the minimum amount of files there will be send
// acquired, special: used to filter out dependencies there is already fetched
ModuleBox.prototype._getMeta = function (resolved, includes, acquired, special, callback) {
  var self = this;

  var latestmtime = 0;
  var files = [];

  var allfound = (function fetch(includes) {
    for (var i = 0; i < includes.length; i++) {
      var value = includes[i];

      // filepath must be new (not already checked or known)
      if (acquired.indexOf(value) !== -1 ||
          special.indexOf(value) !== -1 ||
          files.indexOf(value) !== -1) {
        continue;
      }

      // If resource hasn't been cached stop now
      var cache = self._getCache(value);
      if (cache === null) return false;

      // Update latestmtime and hashes array
      if (latestmtime < cache.mtime) {
        latestmtime = cache.mtime;
      }

      files.push(value);

      // Go one level down and stop if one resource wasn't found
      var deeptfound = fetch(cache.resolved);
      if (!deeptfound) return false;
    }

    return true;
  })(includes);

  // If just one resource wasn't found nothing can be predicted
  if (!allfound) {
    return callback(null, {
      'hash': null,
      'mtime': null
    });
  }

  // Sort files to get a consistent hashsum
  //  these hashes will represent the <file> tags
  var hashes = files.sort().map(function (value) {
    return self._getCache(value).hash;
  });

  // Add resolved input to the beginning of the hashes array
  //  this hashsum will represent the meta tags
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

// Scans a content and resolve all dependencies
ModuleBox.prototype._scanFile = function (job, content, callback) {
  var fullpath = this._fullpath(job);

  // Do only analyze javascript file
  var ext = path.extname(fullpath);
  if (ext !== '.js') return callback(null, {}, []);

  // fetch from and input data, from filepath and file content
  var calls = detective(content);

  // Special files can only contain require calls to other special files
  if (job.special) {
    callback(null, {}, calls);
  } else {
    this._resolve(path.dirname(job.value), calls, callback);
  }
};

function sortObject(object) {
  var keys = Object.keys(object).sort();
  var output = {};

  for (var i = 0; i < keys.length; i++) {
    output[ keys[i] ] = object[ keys[i] ];
  }

  return output;
}

ModuleBox.prototype._resolve = function (from, request, callback) {
  var self = this;
  var resolves = {};
  var special = [];

  // Remove dublicates
  request = uniqueArray(request);

  // If there are no requested modules, just execute the callback now
  if (request.length === 0) return callback(null, resolves, special);

  function resolveMap(input, done) {
    if (self._special.hasOwnProperty(input)) {
      special.push(input);
      done(null);
    } else {
      self._localizer(from, input, function (err, result) {
        resolves[input] = (err || result);
        done(null);
      });
    }
  }

  async.forEach(request, resolveMap, function (err) {
    callback(err, sortObject(resolves), special.sort());
  });
};

ModuleBox.prototype.dispatch = function (info) {
  var from = typeof info.source === 'string' ? path.dirname(info.source) : '/';
  var files = Array.isArray(info.acquired) ? info.acquired : [];
  var special = Array.isArray(info.special) ? info.special : [];
  var request = info.request;

  return new Bundle(this, from, request, files, special);
};
