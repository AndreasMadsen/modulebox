
var fs = require('fs');
var util = require('util');
var stream = require('stream');
var endpoint = require('endpoint');

function BundleStream(box, startpath, acquired) {
  stream.Transform.call(this);

  this.box = box;

  this._acquired = acquired;
  this._query = [ startpath ];

  this._first = true;
  this._prepend = false;
  this._append = false;

  this._file = null;
  this._next();
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
  if (this._query.length === 0) return this.emit('finish');

  // get the next filepath
  var filepath = this._query.shift();
  var realpath = this.box._realpath(filepath);

  // create a new file read stream
  this._file = fs.createReadStream(realpath);

  // if dependencies for this file hasn't been resolved before, buffer the
  // result and resolve/save them.
  if (this.box._getDependencies(filepath) === null) {
    this._file.pipe(endpoint(function (err, content) {
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
    this._file.once('end', nextFile);
  }

  // pipe the file to this stream, thereby calling this._transform
  // since it is unknown if there are more dependencies, the end event is not
  // relayed.
  this._file.pipe(this, {end: false});

  // once the file read is done, dependencies should be added to the query
  // and the next file should be read
  function nextFile() {
    self._push(self.box._getDependencies(filepath));
    self._next();
  }
};
