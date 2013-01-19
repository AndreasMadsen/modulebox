
var fs = require('fs');
var path = require('path');
var endpoint = require('endpoint');
var modulebox = require('../../lib/dispatch.js');

var test = require('tap').test;

var box = modulebox({
  root: path.resolve(__dirname, '..', 'localized'),

  modules: 'modules'
});

// Set mtime on /single.js and /pointer.js for consistency
var singleMtime = 1358000000;
fs.utimesSync(
  path.resolve(__dirname, '..', 'localized', 'single.js'),
  1350000000,
  singleMtime
);

var pointerMtime = 1357000000;
fs.utimesSync(
  path.resolve(__dirname, '..', 'localized', 'pointer.js'),
  1350000000,
  pointerMtime
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

test('simple single module request', function (t) {
  var bundle = box.dispatch({ request: '/pointer.js' });

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
  var bundle = box.dispatch({ request: '/pointer.js' });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), singleMtime * 1000);
    t.equal(meta.hash, '948888b46487c761c981c1f36087e3e0b5059b2aef1a92d3c0e126df77cdcde5');

    t.end();
  }));
});

test('simple single module request', function (t) {
  var bundle = box.dispatch({
    request: '/pointer.js',
    acquired: ['/single.js']
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), pointerMtime * 1000);
    t.equal(meta.hash, 'a8417aa246cf8621c1fa06c6f56f3c743dab5e88d869fd3a8a3ca2858a695722');

    t.end();
  }));
});
