
var fs = require('fs');
var url = require('url');
var http = require('http');
var path = require('path');
var endpoint = require('endpoint');
var modulebox = require('../../lib/dispatch.js');

var test = require('tap').test;

var box = modulebox({
  root: path.resolve(__dirname, '..', 'localized'),

  modules: 'modules'
});

// Set mtime on /single.js, /pointer.js and /faulty_require.js for consistency
var singleMtime = 1358000000;
fs.utimesSync(
  path.resolve(__dirname, '..', 'localized', 'single.js'),
  1350000000,
  singleMtime
);

var server = http.createServer(function (req, res) {
  req.pipe( box.dispatch({
    request: ['/single.js'],
    acquired: [],
    source: '/'
  }) ).pipe(res);
});

function request(href, info, callback) {
  var send = url.parse(href);
      send.headers = {};
      send.method = info.method || 'GET';

  if (info.mtime) send.headers['if-modified-since'] = info.mtime.toUTCString();
  if (info.hash) send.headers['if-none-match'] = info.hash;

  var req = http.request(send, function (res) {
    res.pipe(endpoint(function (err, data) {
      callback(err, res, data);
    }));
  });

  req.end();

  return req;
}

server.listen(0, '127.0.0.1', function () {
  var hostname = 'http://127.0.0.1:' + server.address().port;

  test('no cache headers on first request', function (t) {
    request(hostname, {}, function (err, res, body) {
      t.equal(err, null);

      t.notEqual(body.toString(), '');

      t.equal(res.statusCode, 200);
      t.equal(res.headers['content-type'], 'application/xml; charset=utf-8');
      t.equal(res.headers.etag, undefined);
      t.equal(res.headers['last-modified'], undefined);

      t.end();
    });
  });

  var expectedMtime = new Date(singleMtime * 1000);
  var expectedHash = '9e7c61311c0ad858cd4001679ca48870fbaac7cdfb52abfba4ecc936233e0a05';
  test('no cache headers on first request', function (t) {
    request(hostname, {}, function (err, res, body) {
      t.equal(err, null);

      t.notEqual(body.toString(), '');

      t.equal(res.statusCode, 200);
      t.equal(res.headers['content-type'], 'application/xml; charset=utf-8');
      t.equal(res.headers.etag, 'W/"' + expectedHash + '"');
      t.equal(Date.parse(res.headers['last-modified']), expectedMtime.getTime());

      t.end();
    });
  });

  test('no cache headers on first request', function (t) {
    request(hostname, {
      hash: 'W/"' + expectedHash + '"',
      mtime: expectedMtime
    }, function (err, res, body) {
      t.equal(err, null);

      t.equal(body.toString(), '');

      t.equal(res.statusCode, 304);
      t.equal(res.headers['content-type'], 'application/xml; charset=utf-8');
      t.equal(res.headers.etag, 'W/"' + expectedHash + '"');
      t.equal(Date.parse(res.headers['last-modified']), expectedMtime.getTime());

      t.end();
    });
  });

  test('if HEAD request was send header should be send', function (t) {
    request(hostname, { method: 'HEAD' }, function (err, res, body) {
      t.equal(err, null);

      t.equal(body.toString(), '');

      t.equal(res.statusCode, 200);
      t.equal(res.headers['content-type'], 'application/xml; charset=utf-8');
      t.equal(res.headers.etag, 'W/"' + expectedHash + '"');
      t.equal(Date.parse(res.headers['last-modified']), expectedMtime.getTime());

      t.end();
    });
  });

  test('if HEAD request was send header should be send', function (t) {
    request(hostname, {
      method: 'HEAD',
      hash: 'W/"' + expectedHash + '"',
      mtime: expectedMtime
    }, function (err, res, body) {
      t.equal(err, null);

      t.equal(body.toString(), '');

      t.equal(res.statusCode, 304);
      t.equal(res.headers['content-type'], 'application/xml; charset=utf-8');
      t.equal(res.headers.etag, 'W/"' + expectedHash + '"');
      t.equal(Date.parse(res.headers['last-modified']), expectedMtime.getTime());

      t.end();
    });
  });

  test('close', function (t) {
    server.close(function () {
      t.end();
    });
  });
});
