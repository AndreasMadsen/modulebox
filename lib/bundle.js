
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

  // resolve startpath
  this.box._localizer(from, request, function (err, resolved) {
    if (err && err.code !== 'MODULE_NOT_FOUND') return self.emit('error', err);

    // create a map between request and resolved filepath and add it
    // to the query list
    var startDependencies = {};
        startDependencies[request] = resolved;

    self._push(startDependencies);

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
  this._writeFileEnd(send);
  this._writeFooter(send);

  callback(null);
};

BundleStream.prototype._writeHeader = function (send) {
  if (!this._first) return;
  this._first = false;

  send(new Buffer('<module>'));
};

BundleStream.prototype._writeFooter = function (send) {
  send(new Buffer('</module>'));
};

BundleStream.prototype._writeFileStart = function (send) {
  if (!this._prepend) return;
  this._prepend = false;

  send(new Buffer('<file>\n'));
};

BundleStream.prototype._writeFileEnd = function (send) {
  if (!this._append) return;
  this._append = false;

  send(new Buffer('</file>\n'));
};

// add dependencies to query
BundleStream.prototype._push = function (dependencies) {
  var keys = Object.keys(dependencies);
  var filepath;

  for (var i = 0; i < keys.length; i++) {
    filepath = dependencies[ keys[i] ];

    // TODO: improve support for missing files
    if (filepath === null) continue;

    if (this._acquired.indexOf(filepath) === -1) {
      this._query.push(filepath);
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
  // TODO: should this be unpiped?
  file.pipe(this, {end: false});

  // once the file read is done, dependencies should be added to the query
  // and the next file should be read
  function nextFile() {
    self._push(self.box._getDependencies(filepath));
    self._next();
  }
};
