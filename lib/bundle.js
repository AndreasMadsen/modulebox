
var fs = require('fs');
var http = require('http');
var util = require('util');
var async = require('async');
var stream = require('stream');
var crypto = require('crypto');
var endpoint = require('endpoint');
var notmodified = require('notmodified');

function BundleStream(box, from, request, normal, special) {
  stream.Transform.call(this);

  var self = this;

  // parent ref
  this.box = box;

  // Tracking objects for normal and special cases
  this._normal = {
    fetched: normal,
    values: {},
    resolve: {},
    map: {}
  };
  this._special = {
    fetched: special,
    values: {},
    resolve: {},
    map: {}
  };
  this._query = [];

  // write wrap flags and states
  this._writeWrapper = false;
  this._writeHead = true;
  this._previous = null;
  this._current = null;

  // Special propery for initial errors
  this._initError = null;

  // HTTP cache headers
  this._sendData = true;
  this._meta = null;
  this._pipes = {
    req: null,
    res: null
  };

  // Get request object and stop pipes
  this.on('pipe', function (stream) {
    // Incoming data don't make sence and isn't supported
    if (self._file !== stream) {
      stream.unpipe(self);
    }

    if (stream instanceof http.IncomingMessage) {
      self._pipes.req = stream;
    }
  });

  this.box._resolve(from, false, request, function (err, normal, special) {
    // NOTE: the current implementation of _resolve do not return an error
    // in the first argument. However having a consistent error flow is still
    // a good code style.
    if (err) {
      self.emit('warning', err);
      self._initError = err;
      return self._next();
    }

    // Merge the resolved objects
    self._mergeResolveObject(normal, false);
    self._mergeResolveObject(special, true);

    // start file streaming
    self._getMeta(function (err, meta) {
      if (err) {
        self.emit('warning', err);
        self._initError = err;
        return self._next();
      }

      // Emit the meta event
      self.emit('meta', meta);

      // Set HTTP headers is possible and check for head request in order to
      // set the this._sendData flag.
      self._handleHTTP(meta);

      // end response if client cache is valid
      if (self._sendData === false) return self.end();

      self._next();
    });
  });
}
util.inherits(BundleStream, stream.Transform);
module.exports = BundleStream;

function packError(err) {
  return {
    name: err.name,
    message: err.message,
    code: err.code
  };
}

BundleStream.prototype._mergeResolveObject = function (resolve, isSpecial) {
  var container = isSpecial ? this._special : this._normal;

  var keys = Object.keys(resolve);
  for (var i = 0; i < keys.length; i++) {
    var input = keys[i];
    var result = resolve[input];

    if (typeof result === 'string') {
      // create a map between request and resolved filepath and add it
      // to the query list
      if (container.fetched.indexOf(result) === -1 &&
          container.values.hasOwnProperty(result) === false) {
        container.values[result] = true;
        this._query.push({'special': isSpecial, 'value': result});
      }
      container.resolve[input] = result;
    } else {
      this.emit('warning', result);
      container.resolve[input] = packError(result);
    }
  }
};

BundleStream.prototype._getMeta = function (callback) {
  this.box._getMeta(this._query, this._normal, this._special, callback);
};

// set HTTP header (called after meta is found) and check for head requests
BundleStream.prototype._handleHTTP = function (meta) {
  if (!(this._pipes.res && this._pipes.req)) return;

  // Set Content-Type header
  this._pipes.res.setHeader('Content-Type', 'application/xml; charset=utf-8');

  // Set and check cache headers
  var cacheValid = notmodified(this._pipes.req, this._pipes.res, {
    hash: meta.hash,
    mtime: meta.mtime,
    weak: true
  });

  // Check for HEAD request
  var isHead = this._pipes.req.method === 'HEAD';

  // Cleanup http object references
  this._pipes.res = null;
  this._pipes.req = null;

  // If send data flag is true, data will be send when transform stream is
  // ended (this._flush)
  this._sendData = (!cacheValid && !isHead);
};

// Get response object
BundleStream.prototype.pipe = function (res) {
  if (res instanceof http.OutgoingMessage) {
    this._pipes.res = res;
  }

  return stream.Transform.prototype.pipe.apply(this, arguments);
};

// Outgoing data pipe handler
BundleStream.prototype._transform = function (chunk, encodeing, callback) {
  this._writeHeader();

  if (this._writeWrapper) {
    this._writeWrapper = false;
    this._writeWrapperEnd();
    this._writeWrapperStart();
  }

  callback(null, chunk);
};

// Outgoing data end handler
BundleStream.prototype._flush = function (callback) {
  // The client has a valid cached, no data should be send
  if (!this._sendData) return callback(null);

  // In rare cases, nothing has been writen and the header will need to be
  // send in the flush
  this._writeHeader();

  this._writeWrapperEnd();
  this._writeFooter();

  callback(null);
};

// Predefine some XML datachunks
var DATA_CHUNK = {
  xml: new Buffer('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'),
  modules: {
    start: new Buffer('<modules>\n'),
    end: new Buffer('</modules>')
  },
  fileNormal: {
    startLeft: new Buffer('<file special="false" path="'),
    startRight: new Buffer('"><![CDATA['),
    end: new Buffer(']]></file-normal>\n')
  },
  fileSpecial: {
    startLeft: new Buffer('<file special="true" path="'),
    startRight: new Buffer('"><![CDATA['),
    end: new Buffer(']]></file-special>\n')
  },
  resolveNormal: {
    start: new Buffer('<resolve special="false">'),
    end: new Buffer('</resolve>\n')
  },
  resolveSpecial: {
    start: new Buffer('<resolve special="true">'),
    end: new Buffer('</resolve>\n')
  },
  mapNormal: {
    start: new Buffer('<map special="false">'),
    end: new Buffer('</map>\n')
  },
  mapSpecial: {
    start: new Buffer('<map special="true">'),
    end: new Buffer('</map>\n')
  },
  error: {
    start: new Buffer('<error>'),
    end: new Buffer('</error>\n')
  }
};

BundleStream.prototype._writeHeader = function () {
  if (this._writeHead === false) return;
  this._writeHead = false;

  // writes:
  // <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  // <modules>
  this.push(DATA_CHUNK.xml);
  this.push(DATA_CHUNK.modules.start);

  // writes init error as an <error> element, if such init error exists
  if (this._initError) {
    var errorObject = {
      message: this._initError.message,
      code: this._initError.code,
      name: this._initError.name
    };

    this.push(DATA_CHUNK.error.start);
    this.push(new Buffer( JSON.stringify(errorObject) ));
    this.push(DATA_CHUNK.error.end);

    return;
  }

  // writes: <resolve>{{resolved}}</resolve>
  this.push(DATA_CHUNK.resolveNormal.start);
  this.push(new Buffer( JSON.stringify(this._normal.resolve) ));
  this.push(DATA_CHUNK.resolveNormal.end);

  this.push(DATA_CHUNK.resolveSpecial.start);
  this.push(new Buffer( JSON.stringify(this._special.resolve) ));
  this.push(DATA_CHUNK.resolveSpecial.end);
};

BundleStream.prototype._writeFooter = function () {
  // writes: <map>{{resolved}}</map>
  this.push(DATA_CHUNK.mapNormal.start);
  this.push(new Buffer( JSON.stringify(this._normal.map) ));
  this.push(DATA_CHUNK.mapNormal.end);

  this.push(DATA_CHUNK.mapSpecial.start);
  this.push(new Buffer( JSON.stringify(this._special.map) ));
  this.push(DATA_CHUNK.mapSpecial.end);

  // writes: </modules>
  this.push(DATA_CHUNK.modules.end);
};

BundleStream.prototype._writeWrapperStart = function () {
  // In case that a file was never included in this bundle, don't write
  // the end wrapper
  if (this._current === null) return;

  var chunkCollection = this._current.special ?
        DATA_CHUNK.fileSpecial : DATA_CHUNK.fileNormal;

  // writes: <file path="{{filepath}}"><![CDATA[
  this.push(chunkCollection.startLeft);
  this.push(new Buffer( this._current.value ));
  this.push(chunkCollection.startRight);
};

BundleStream.prototype._writeWrapperEnd = function () {
  // In case that a file was never included in this bundle, don't write
  // the end wrapper
  if (this._previous === null) return;

  var chunkCollection = this._previous.special ?
        DATA_CHUNK.fileSpecial : DATA_CHUNK.fileNormal;
  // writes: ]]></file>
  this.push(chunkCollection.end);
};

function mutateResolveMap(job, resolved, isSpecial, collection, query) {
  var keys = Object.keys(resolved);
  if (keys.length !== 0) collection.map[job.value] = resolved;

  // Add localized dependencies to query.
  for (var i = 0; i < keys.length; i++) {
    var result = resolved[ keys[i] ];

    // Input could not be translated to a filepath, cause is an error
    if (typeof result !== 'string') continue;

    if (collection.fetched.indexOf(result) === -1 &&
        collection.values.hasOwnProperty(result) === false) {
      collection.values[result] = true;
      query.push({'special': isSpecial, 'value': result});
    }
  }
}

// add dependencies to query
BundleStream.prototype._push = function (job, normal, special) {
  mutateResolveMap(job, normal, false, this._normal, this._query);
  mutateResolveMap(job, special, true, this._special, this._query);
};

function mutateResolveList(self, resolve, isSpecial, transform, list) {
  var values = {};

  var keys = Object.keys(resolve);
  for (var i = 0; i < keys.length; i++) {
    var input = keys[i];
    var result = resolve[input];

    if (typeof result === 'string') {
      // create a map between request and resolved filepath and add it
      // to the query list
      if (values.hasOwnProperty(result) === false) {
        values[result] = true;
        list.push({'special': isSpecial, 'value': result});
      }
      transform[input] = result;
    } else {
      self.emit('warning', result);
      transform[input] = packError(result);
    }
  }
}

// start next file stream
BundleStream.prototype._next = function () {
  var self = this;

  // Indicate that a new file is about to be written and that wrappers should
  // be applied
  this._writeWrapper = true;

  // There might be a new job, in any case indicate that this job is dieing
  // by moveing it to the previous property.
  this._previous = this._current;

  // this._flush will be called if there are no more files in the query
  if (this._query.length === 0) return this.end();

  // get the next filepath
  var job = this._query.shift();
  var fullpath = this.box._fullpath(job);

  // set the current job
  this._current = job;

  // create a new file read stream
  // Note, that this._file is used in in this.on('pipe') handler, to validate
  //  incomming streams
  var file = this._file = fs.createReadStream(fullpath);

  // if dependencies for this file hasn't been resolved before, buffer the
  // result and resolve/save them.
  if (this.box._getCache(job) === null) {
    async.parallel({
      stat: function (callback) {
        fs.stat(fullpath, function (err, stat) {
          if (err) {
            self.emit('error', err);
            return callback(null);
          }

          callback(null, stat);
        });
      },

      hash: function (callback) {
        file.pipe(crypto.createHash('md5')).pipe(endpoint(function (err, hash) {
          // this error will be emitted by the other pipe, so just ignore here.
          // Note, this is a real error not a warning, since it is completly
          // unknown what the error is.
          // However the next file will be opended, in case the user decides to
          // continue.
          callback(null, hash);
        }));
      },

      resolved: function (callback) {
        file.pipe(endpoint(function (err, content) {
          // Again error is ignored here too to prevent double emit
          if (err) return callback(null);

          // construct resolve map from filepath and file content
          self.box._scanFile(job, content, function (err, normal, special) {
            if (err) {
              self.emit('error', err);
              return callback(null);
            }

            // Build objects just the initial resolve object, but this time
            //  there are now fetched values, as this is for a cache
            var values = [];
            var normalContainer = {};
            var specialContainer = {};

            mutateResolveList(self, normal, false, normalContainer, values);
            mutateResolveList(self, special, true, specialContainer, values);

            // save resolved dependencies in cache
            callback(null, {
              'normal': normalContainer,
              'special':  specialContainer,
              'dependencies': values
            });
          });
        }));
      }
    }, function (err, data) {
      // Error is handled in each parallel method, so they are ignored here

      // Check that all types of cache data could be fetched
      if (data.stat && data.hash && data.resolved) {

        var cacheObject = {
          special: data.resolved.special,
          normal: data.resolved.normal,
          dependencies: data.resolved.dependencies,
          hash: data.hash,
          mtime: data.stat.mtime.getTime()
        };
        self.box._setCache(job, cacheObject);
      }

      nextFile(data.resolved);
    });
  } else {
    file.once('end', nextFile.bind(file, self.box._getCache(job)));
  }

  // pipe the file to this stream, thereby calling this._transform
  // since it is unknown if there are more dependencies, the end event is not
  // relayed.
  file.pipe(this, {end: false});

  // once the file read is done, dependencies should be added to the query
  // and the next file should be read
  function nextFile(cache) {
    self._push(job, cache.normal, cache.special);
    self._next();
  }
};
