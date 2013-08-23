
var fs = require('fs');
var http = require('http');
var util = require('util');
var async = require('async');
var stream = require('stream');
var crypto = require('crypto');
var endpoint = require('endpoint');
var notmodified = require('notmodified');

function BundleStream(box, from, request, acquired, special) {
  this.name = 'Bundle';
  stream.Transform.call(this);

  var self = this;

  // parent ref
  this.box = box;

  // track query and acquired files
  this._acquired = acquired;
  this._special = special;
  this._queryValues = {};
  this._query = [];

  // write wrap flags
  this._writeWrapper = false;
  this._writeHead = true;

  // state write content
  // some writes methods require some extra data, that is stored here
  this._previous = null;
  this._current = null;
  this._initError = null;
  this._map = {};
  this._resolve = {};

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

  this.box._resolve(from, request, function (err, resolved, special) {
    // NOTE: the current implementation of _resolve do not return an error
    // in the first argument. However having a consistent error flow is still
    // a good code style.
    if (err) {
      self.emit('warning', err);
      self._initError = err;
      return self._next();
    }

    var keys, input, result, i;

    keys = Object.keys(resolved);
    for (i = 0; i < keys.length; i++) {
      input = keys[i];
      result = resolved[input];

      if (typeof result === 'string') {
        // create a map between request and resolved filepath and add it
        // to the query list
        if (self._acquired.indexOf(result) === -1 &&
            self._queryValues.hasOwnProperty(result) === false) {
          self._queryValues[result] = true;
          self._query.push({'special': false, 'value': result});
        }

        // Add result to resolved
        self._resolve[input] = result;
      } else {

        self.emit('warning', result);

        // Add result object and remove the error property
        self._resolve[input] = packError(result);
      }
    }

    // Add special files to the queue
    for (i = 0; i < special.length; i++) {
      input = special[i];

      if (self._special.indexOf(input) === -1 &&
          self._queryValues.hasOwnProperty(input) === false) {
        self._queryValues[input] = true;
        self._query.push({'special': true, 'value': input});
      }
    }

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

BundleStream.prototype._getMeta = function (callback) {
  this.box._getMeta(Object.keys(this._queryValues), this._acquired, this._special, callback);
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
  file: {
    startLeft: new Buffer('<file path="'),
    startRight: new Buffer('"><![CDATA['),
    end: new Buffer(']]></file>\n')
  },
  special: {
    startLeft: new Buffer('<special name="'),
    startRight: new Buffer('"><![CDATA['),
    end: new Buffer(']]></special>\n')
  },
  resolve: {
    start: new Buffer('<resolve>'),
    end: new Buffer('</resolve>\n')
  },
  map: {
    start: new Buffer('<map>'),
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

  // write resolved path for input
  this.push(DATA_CHUNK.resolve.start);
  this.push(new Buffer( JSON.stringify(this._resolve) ));
  this.push(DATA_CHUNK.resolve.end);
};

BundleStream.prototype._writeFooter = function () {
  // writes: <map>{{resolved}}</map>
  this.push(DATA_CHUNK.map.start);
  this.push(new Buffer( JSON.stringify(this._map) ));
  this.push(DATA_CHUNK.map.end);

  // writes: </modules>
  this.push(DATA_CHUNK.modules.end);
};

BundleStream.prototype._writeWrapperStart = function () {
  // In case that a file was never included in this bundle, don't write
  // the end wrapper
  if (this._current === null) return;

  var chunkCollection = this._current.special ?
        DATA_CHUNK.special : DATA_CHUNK.file;

  // writes: <file path="{{filepath}}"><![CDATA[
  //  - or -
  // writes: <special path="{{filepath}}"><![CDATA[
  this.push(chunkCollection.startLeft);
  this.push(new Buffer( this._current.value ));
  this.push(chunkCollection.startRight);
};

BundleStream.prototype._writeWrapperEnd = function () {
  // In case that a file was never included in this bundle, don't write
  // the end wrapper
  if (this._previous === null) return;

  var chunkCollection = this._previous.special ?
        DATA_CHUNK.special : DATA_CHUNK.file;
  // writes: ]]></special>
  //  - or -
  // writes: ]]></file>
  this.push(chunkCollection.end);
};

// add dependencies to query
BundleStream.prototype._push = function (job, localized, special) {
  // The dependencies format is `input:require.resolve(input)`
  var keys = Object.keys(localized), i;

  // Don't do anything, if there are no dependencies. This also prevents
  // superfluous data from being send. Otherwice `"/longfilename.ext": {}`
  // would be stored in the resolved map object.
  // Note that only the localized object is set, as special don't require
  // resolveing.
  // Also in case `job` is special, the localized object will empty.
  if (keys.length !== 0) this._map[job.value] = localized;

  // Add localized dependencies to query.
  for (i = 0; i < keys.length; i++) {
    var resolved = localized[ keys[i] ];

    // Input could not be translated to a filepath
    if (typeof resolved !== 'string') continue;

    if (this._acquired.indexOf(resolved) === -1 &&
        this._queryValues.hasOwnProperty(resolved) === false) {
      this._queryValues[resolved] = true;
      this._query.push({'special': false, 'value': resolved});
    }
  }

  // Add special dependencies to query.
  for (i = 0; i < special.length; i++) {
    var name = special[name];

    if (this._special.indexOf(name) === -1 &&
        this._queryValues.hasOwnProperty(name) === false) {
      this._queryValues[name] = true;
      this._query.push({'special': true, 'value': name});
    }
  }
};

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
      file.name = 'fs';

  // if dependencies for this file hasn't been resolved before, buffer the
  // result and resolve/save them.
  if (this.box._getCache(job.value) === null) {
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
          self.box._scanFile(job, content, function (err, resolved, special) {
            if (err) {
              self.emit('error', err);
              return callback(null);
            }

            // Maintain a special values array for recursive dependencies walking
            var values = special.slice(0);

            var localized = {};
            var keys = Object.keys(resolved);

            // Note that scan errors don't stop the module bundle to be build and
            // are therefor emitted as a warning
            for (var i = 0; i < keys.length; i++) {
              var input = keys[i];
              var result = resolved[input];

              if (typeof result === 'string') {
                localized[input] = result;
                values.push(result);
              } else {
                self.emit('warning', result);
                localized[input] = packError(result);
              }
            }

            // save resolved dependencies in cache
            callback(null, {
              'localized': localized,
              'special': special,
              'resolved': values
            });
          });
        }));
      }
    }, function (err, data) {
      // Error is handled in each parallel method, so they are ignored here

      // Check that all types of cache data could be fetched
      if (data.stat && data.hash && data.resolved) {

        var cacheObject = {
          localized: data.resolved.localized,
          resolved: data.resolved.resolved,
          special: data.resolved.special,
          hash: data.hash,
          mtime: data.stat.mtime.getTime()
        };
        self.box._setCache(job.value, cacheObject);
      }

      nextFile(data.resolved);
    });
  } else {
    file.once('end', nextFile.bind(file, self.box._getCache(job.value)));
  }

  // pipe the file to this stream, thereby calling this._transform
  // since it is unknown if there are more dependencies, the end event is not
  // relayed.
  file.pipe(this, {end: false}); // BUG: THIS DO NOTHING, WTF?

  // once the file read is done, dependencies should be added to the query
  // and the next file should be read
  function nextFile(cache) {
    self._push(job, cache.localized, cache.special);
    self._next();
  }
};
