
var fs = require('fs');
var path = require('path');
var endpoint = require('endpoint');
var modulebox = require('../../lib/dispatch.js');

var test = require('tap').test;

var box = modulebox({
  root: path.resolve(__dirname, '..', 'localized'),

  modules: 'modules'
});

// Set mtime on /single.js for consistency
var singleMtime = 1358000000;
fs.utimesSync(
  path.resolve(__dirname, '..', 'localized', 'single.js'),
  1350000000,
  singleMtime
);

test('simple single module request', function (t) {
  var bundle = box.dispatch({
    request: '/single.js',
    acquired: ['/single.js']
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime, null);
    t.equal(meta.hash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

    t.end();
  }));
});

test('simple single module request', function (t) {
  var bundle = box.dispatch({ request: '/single.js' });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta, null);
    t.end();
  }));
});

test('simple single module request', function (t) {
  var bundle = box.dispatch({ request: '/single.js' });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), singleMtime * 1000);
    t.equal(meta.hash, '9e7c61311c0ad858cd4001679ca48870fbaac7cdfb52abfba4ecc936233e0a05');

    t.end();
  }));
});
