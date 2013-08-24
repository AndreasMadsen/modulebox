
var url = require('url');
var util = require('util');
var path = require('path');
var async = require('async');
var filed = require('filed');
var crypto = require('crypto');
var events = require('events');
var endpoint = require('endpoint');
var localizer = require('localizer');
var detective = require('detective');
var commondir = require('commondir');
var startpoint = require('startpoint');

var Bundle = require('./bundle.js');

function ModuleBox(settings) {
  if (!(this instanceof ModuleBox)) return new ModuleBox(settings);

  this._root = settings.root;
  this._cache = {
    special: {},
    normal: {}
  };
  /*
    [filename] = {
      resolved: [<String>],
      speical: [<String>],
      localized: [<String> or <Object>],
      mtime: <Number>,
      hash: <Buffer>
    };
  */

  // Create values for the special modules
  var specialObject = settings.special || {};
  var specialKeys = Object.keys(specialObject);
  var specialUsed = specialKeys.length !== 0;
  var specialRoot = specialUsed ? commondir(objectValue(specialObject)) : '/';

  this._specialRoot = specialRoot;
  this._specialMap = {};
  for (var i = 0; i < specialKeys.length; i++) {
    this._specialMap[specialKeys[i]] = specialObject[specialKeys[i]].slice(specialRoot.length);
  }

  // Create localizer objects for normal and special cases
  this._normalloc = localizer({
    root: settings.root,
    modules: settings.modules,
    allowed: settings.allowed
  });
  this._specialloc = localizer({
    root: specialRoot,
    modules: settings.modules,
    allowed: settings.allowed
  });
}
module.exports = ModuleBox;
util.inherits(ModuleBox, events.EventEmitter);

function objectValue(object) {
  return Object.keys(object).map(function (key) { return object[key]; });
}

ModuleBox.prototype._fullpath = function (job) {
  if (job.special) {
    return path.resolve(this._specialRoot, '.' + job.value);
  } else {
    return path.resolve(this._root, '.' + job.value);
  }
};

// Simple wrapper around the cache object
ModuleBox.prototype._getCache = function (job) {
  var cache = job.special ? this._cache.special : this._cache.normal;
  var exists = cache.hasOwnProperty(job.value);
  if (!exists) return null;

  return cache[job.value];
};

ModuleBox.prototype._setCache = function (job, dataset) {
  var cache = job.special ? this._cache.special : this._cache.normal;
  cache[job.value] = dataset;
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

// Returns a the metadata (hash and mtime) of the resource tree given by
// the starting module filepath. Note that files there are acquired are
// filter away from the meta calculation.
// This returns null if just a single resource hasn't been read before
// meaning cache object not yet filed.
ModuleBox.prototype._getMeta = function (dependencies, normal, special, callback) {
  var self = this;

  var latestmtime = 0;
  var specialValues = {};
  var normalValues = {};
  var files = [];

  var allfound = (function walk(dependencies) {
    for (var i = 0; i < dependencies.length; i++) {
      var job = dependencies[i];
      var collection = job.special ? special : normal;
      var values = job.special ? specialValues : normalValues;

      // filepath must be new (not already checked or known)
      if (collection.fetched.indexOf(job.value) !== -1 ||
          values.hasOwnProperty(job.value) === true) {
        continue;
      }

      // If resource hasn't been cached stop now
      var cache = self._getCache(job);
      if (cache === null) return false;

      // Update latestmtime and hashes array
      if (latestmtime < cache.mtime) {
        latestmtime = cache.mtime;
      }

      // Skip future jobs there are the same
      values[job.value] = true;
      // Add this job to the total job list
      files.push(job);

      // Go one level down and stop if just one resource wasn't found
      var deeptfound = walk(cache.dependencies);
      if (!deeptfound) return false;
    }

    return true;
  })(dependencies);

  // If just one resource wasn't found nothing can be predicted
  if (!allfound) {
    return callback(null, {
      'hash': null,
      'mtime': null
    });
  }

  // Sort files to get a consistent hashsum
  //  these hashes will represent the <file> tags
  var hashes = files.sort().map(function (job) {
    return self._getCache(job).hash;
  });

  // Add resolved input to the beginning of the hashes array
  //  this hashsum will represent the meta tags
  hashes.unshift( createResolveBuffer(special.resolve) );
  hashes.unshift( createResolveBuffer(normal.resolve) );

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
  this._resolve(path.dirname(job.value), job.special, calls, callback);
};

function sortObject(object) {
  var keys = Object.keys(object).sort();
  var output = {};

  for (var i = 0; i < keys.length; i++) {
    output[ keys[i] ] = object[ keys[i] ];
  }

  return output;
}

function localizerError(moduleName) {
  var err = new Error("Cannot find module '" + moduleName + "'");
      err.code = "MODULE_NOT_FOUND";
  return err;
}

ModuleBox.prototype._resolve = function (from, isSpecial, request, callback) {
  var self = this;
  var normal = {};
  var special = {};

  // Remove dublicates
  request = uniqueArray(request);

  // If there are no requested modules, just execute the callback now
  if (request.length === 0) return callback(null, normal, special);

  function resolveMap(input, done) {
    // Is the input a special public module
    if (self._specialMap.hasOwnProperty(input)) {
      // The lookup here is just to prevent missing files from creating
      //  unanticipated errors later
      self._specialloc('/', self._specialMap[input], function (err, result) {
        // In case the module cound't be found use the input name as an indentifyer
        //  and not the resolved filepath, that localizer would otherwise return
        if (err && err.code === "MODULE_NOT_FOUND") err = localizerError(input);

        special[input] = (err || result);
        done(null);
      });
    }
    // If the request was from a special file, then resolve it in the special tree
    else if (isSpecial) {
      self._specialloc(from, input, function (err, result) {
        special[input] = (err || result);
        done(null);
      });
    }
    // If the request was from a normal file, then resolve it in the normal tree
    else {
      self._normalloc(from, input, function (err, result) {
        normal[input] = (err || result);
        done(null);
      });
    }
  }

  async.forEach(request, resolveMap, function (err) {
    callback(err, sortObject(normal), sortObject(special));
  });
};

var CLIENT_CORE = path.resolve(__dirname, 'loader.js');

ModuleBox.prototype.dispatch = function (req, res) {
  var href = url.parse(req.url, true);
  if (path.basename(href.pathname) === 'core.js') {
    req.pipe(filed(CLIENT_CORE)).pipe(res);
  } else {
    new Bundle(this, req, res, href);
  }
};
