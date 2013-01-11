
var fs = require('fs');
var util = require('util');
var stream = require('stream');
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
  this._filepath = null;
  this._resolved = {};

  // resolve startpath
  this.box._localizer(from, request, function (err, resolved) {
    if (err && err.code !== 'MODULE_NOT_FOUND') return self.emit('error', err);

    // create a map between request and resolved filepath and add it
    // to the query list
    if (self._acquired.indexOf(resolved) === -1) {
      self._query.push(resolved);
    }

    // start file streaming
    self._next();
  });
}
util.inherits(BundleStream, stream.Transform);
module.exports = BundleStream;

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
  map: {
    start: new Buffer('<map>'),
    end: '</map>\n'
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
    if (resolved === null) continue;

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
  if (this.box._getDependencies(filepath) === null) {
    file.pipe(endpoint(function (err, content) {
      // this error will be emitted by the other pipe, so just ignore
      if (err) return;

      // construct resolve map from filepath and file content
      self.box._scanFile(filepath, content, function (err, resolveMap) {
        if (err) return self.emit('error', err);

        // save resolved dependencies in cache
        self.box._setDependencies(filepath, resolveMap);

        nextFile();
      });
    }));
  } else {
    file.once('end', nextFile);
  }

  // pipe the file to this stream, thereby calling this._transform
  // since it is unknown if there are more dependencies, the end event is not
  // relayed.
  file.pipe(this, {end: false});

  // once the file read is done, dependencies should be added to the query
  // and the next file should be read
  function nextFile() {
    self._push(filepath, self.box._getDependencies(filepath));
    self._next();
  }
};
