
var url = require('url');
var util = require('util');
var http = require('http');
var events = require('events');
var endpoint = require('endpoint');
var modulebox = require('../lib/dispatch.js');

function Test(settings) {
  if (!(this instanceof Test)) return new Test(settings);
  var self = this;

  this.box = modulebox(settings);
  this.box.on('error', this.emit.bind(this, 'error'));
  this.box.on('warning', this.emit.bind(this, 'warning'));

  this.server = http.createServer();
  this.server.on('request', function (req, res) {
    self.box.dispatch(req, res);
  });

  this.remote = null;
}
module.exports = Test;
util.inherits(Test, events.EventEmitter);

Test.prototype.open = function (callback) {
  var self = this;
  this.server.listen(0, '127.0.0.1', function () {
    var addr = self.server.address();
    self.remote = 'http://' + addr.address + ':' + addr.port;
    callback();
  });
};

Test.prototype.query = function (query, callback) {
  var href = url.parse(this.remote);
  delete href.search;
  href.query = query;

  http.get(url.format(href), function (res) {
    var mtime = null;
    var hash = null;
    if (res.headers['last-modified']) mtime = new Date(res.headers['last-modified']);
    if (res.headers.etag) hash = res.headers.etag.slice(3, -1);

    res.pipe(endpoint(function (err, content) {
      callback(err, { 'mtime': mtime, 'hash': hash }, content);
    }));
  });
};

Test.prototype.request = function(what, callback) {
  this.query({
    'normal': JSON.stringify(what.normal ? what.normal : []),
    'special': JSON.stringify(what.special ? what.special : []),
    'from': JSON.stringify(what.from ? what.from : '/'),
    'request': JSON.stringify(what.request ? what.request : [])
  }, callback);
};

Test.prototype.close = function (callback) {
  this.server.close(callback);
};
