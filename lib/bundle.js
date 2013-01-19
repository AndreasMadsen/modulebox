
var fs = require('fs');
var util = require('util');
var async = require('async');
var stream = require('stream');
var crypto = require('crypto');
var endpoint = require('endpoint');

function BundleStream(box, from, request, acquired) {
  stream.Transform.call(this);

  var self = this;

  // parent ref
  this.box = box;

  // track query and acquired files
  this._acquired = acquired;
  this._query = [];

  // write wrap flags
  this._first = true;
  this._prepend = false;
  this._append = false;

  // state write content
  // some writes methods require some extra data, that is stored here
  this._initError = null;
  this._startpath = null;
  this._filepath = null;
  this._resolved = {};

  // resolve startpath
  this.box._localizer(from, request, function (err, resolved) {
    // A localizer errors is treaded as a warning, since the client
    // will be able to deal with it. Note that an init error is a special
    // case, since it can't be asociated with a filepath
    if (err) {
      self.emit('warning', err);
      self._initError = err;
      return self._next();
    }

    // Store resolved filepath
    self._startpath = resolved;

    // create a map between request and resolved filepath and add it
    // to the query list
    if (self._acquired.indexOf(resolved) === -1) {
      self._query.push(resolved);
    }

    // start file streaming
    self._getMeta(function (err, meta) {
      if (err) {
        self.emit('warning', err);
        self._initError = err;
        return self._next();
      }

      self.emit('meta', meta);
      self._next();
    });
  });
}
util.inherits(BundleStream, stream.Transform);
module.exports = BundleStream;

BundleStream.prototype._getMeta = function (callback) {
  this.box._getMeta(this._startpath, this._acquired, callback);
};

BundleStream.prototype._transform = function (chunk, send, callback) {
  this._writeHeader(send);
  this._writeFileEnd(send);
  this._writeFileStart(send);

  callback(null, chunk);
};


BundleStream.prototype._flush = function (send, callback) {
  // In rare cases, nothing has been writen and the header will need to be
  // send in the flush
  this._writeHeader(send);

  this._writeFileEnd(send);
  this._writeFooter(send);

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
  resolve: {
    start: new Buffer('<resolve>'),
    end: '</resolve>\n'
  },
  map: {
    start: new Buffer('<map>'),
    end: '</map>\n'
  },
  error: {
    start: new Buffer('<error>'),
    end: '</error>\n'
  }
};

BundleStream.prototype._writeHeader = function (send) {
  if (!this._first) return;
  this._first = false;

  // writes:
  // <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  // <modules>
  send(DATA_CHUNK.xml);
  send(DATA_CHUNK.modules.start);

  // writes init error as an <error> element, if such init error exists
  if (this._initError) {
    var errorObject = {
      message: this._initError.message,
      code: this._initError.code,
      name: this._initError.name
    };

    send(DATA_CHUNK.error.start);
    send(new Buffer(JSON.stringify(errorObject)));
    send(DATA_CHUNK.error.end);

    return;
  }

  // write resolved path for input
  send(DATA_CHUNK.resolve.start);
  send(new Buffer(this._startpath));
  send(DATA_CHUNK.resolve.end);
};

BundleStream.prototype._writeFooter = function (send) {
  // writes: <map>{{resolved}}</map>
  send(DATA_CHUNK.map.start);
  send(new Buffer( JSON.stringify(this._resolved) ));
  send(DATA_CHUNK.map.end);

  // writes: </modules>
  send(DATA_CHUNK.modules.end);
};

BundleStream.prototype._writeFileStart = function (send) {
  if (!this._prepend) return;
  this._prepend = false;

  // writes: <file path="{{filepath}}"><![CDATA[
  send(DATA_CHUNK.file.startLeft);
  send(new Buffer( this._filepath ));
  send(DATA_CHUNK.file.startRight);
};

BundleStream.prototype._writeFileEnd = function (send) {
  if (!this._append) return;
  this._append = false;

  // writes: ]]></file>
  send(DATA_CHUNK.file.end);
};

// add dependencies to query
BundleStream.prototype._push = function (filepath, dependencies) {
  // The dependencies format is `input:require.resolve(input)`
  var keys = Object.keys(dependencies);

  // Don't do anything, if there are no dependencies. This also prevents
  // superfluous data from being send. Otherwice `"/longfilename.ext": {}`
  // would be stored in the resolved map object.
  if (keys.length === 0) return;

  // Add dependencies map to the bottom of the stream, by adding them
  // to a temporary object here.
  this._resolved[filepath] = dependencies;

  // Add dependencies to query.
  for (var i = 0; i < keys.length; i++) {
    var resolved = dependencies[ keys[i] ];

    // Input could not be translated to a filepath
    if (typeof resolved !== 'string') continue;

    if (this._acquired.indexOf(resolved) === -1 &&
        this._query.indexOf(resolved) === -1) {
      this._query.push(resolved);
    }
  }
};

// start next file stream
BundleStream.prototype._next = function () {
  var self = this;

  // first flag, set to false when the first chunk is writen
  var first = this._first;

  // prepear for read, by setting flags
  if (!first) this._append = true;
  this._prepend = true;

  // this._flush will be called if there are no more files in the query
  if (this._query.length === 0) return this.end();

  // get the next filepath
  var filepath = this._query.shift();
  var realpath = this.box._realpath(filepath);

  // update stored filepath and make sure it won't be send again
  this._filepath = filepath;
  this._acquired.push(filepath);

  // create a new file read stream
  var file = fs.createReadStream(realpath);

  // if dependencies for this file hasn't been resolved before, buffer the
  // result and resolve/save them.
  if (this.box._getCache(filepath) === null) {
    async.parallel({
      stat: function (callback) {
        fs.stat(realpath, function (err, stat) {
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
          self.box._scanFile(filepath, content, function (errors, resolveMap) {
            // Error is either null or an array of errors
            // Note that scan errors don't stop the module bundle to be build and
            // are therefor emitted as a warning
            if (errors) errors.forEach(self.emit.bind(self, 'warning'));

            // save resolved dependencies in cache
            callback(null, resolveMap);
          });
        }));
      }
    }, function (err, data) {
      // Error is handled in each parallel method, so they are ignored here

      // Check that all types of cache data could be fetched
      if (data.stat && data.hash && data.resolved) {
        self.box._setCache(filepath, {
          resolved: data.resolved,
          hash: data.hash,
          mtime: data.stat.mtime.getTime()
        });
      }

      nextFile(data.resolved);
    });
  } else {
    file.once('end', nextFile.bind(file, self.box._getCache(filepath).resolved));
  }

  // pipe the file to this stream, thereby calling this._transform
  // since it is unknown if there are more dependencies, the end event is not
  // relayed.
  file.pipe(this, {end: false});

  // once the file read is done, dependencies should be added to the query
  // and the next file should be read
  function nextFile(resolved) {
    self._push(filepath, resolved);
    self._next();
  }
};
