
var fs = require('fs');
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

var pointerMtime = 1357000000;
fs.utimesSync(
  path.resolve(__dirname, '..', 'localized', 'pointer.js'),
  1350000000,
  pointerMtime
);

var faultyMtime = 1357000000;
fs.utimesSync(
  path.resolve(__dirname, '..', 'localized', 'faulty_require.js'),
  1350000000,
  pointerMtime
);

test('no resources is send makes mtime null and resolved is hash', function (t) {
  var bundle = box.dispatch({
    request: ['/single.js'],
    acquired: ['/single.js']
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime, null);
    t.equal(meta.hash, '9f5ced2fe2b22a76d35e1c7b8400918308ef590e231afe6a9fb2c178a9eabe10');

    t.end();
  }));
});

test('when first resource isn\'t fetched meta is null', function (t) {
  var bundle = box.dispatch({
    request: ['/single.js']
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime, null);
    t.equal(meta.hash, null);

    t.end();
  }));
});

test('when all (one) resources is fetched meta is set', function (t) {
  var bundle = box.dispatch({
    request: ['/single.js']
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), singleMtime * 1000);
    t.equal(meta.hash, 'a5b3e7daeead13a79cfbcd435fdea1b124f355af87e662f516c8b56662f2e843');

    t.end();
  }));
});

test('when not all resources is fetched meta is null', function (t) {
  var bundle = box.dispatch({
    request: ['/pointer.js']
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime, null);
    t.equal(meta.hash, null);

    t.end();
  }));
});

test('when all resources is fetched meta is set', function (t) {
  var bundle = box.dispatch({
    request: ['/pointer.js']
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), singleMtime * 1000);
    t.equal(meta.hash, '88e39d9a9ed8fc7d7ba729eece3fb44344ff1b74550a8de2329d6a2de533b821');

    t.end();
  }));
});

test('mtime and hash depends on the acquired files', function (t) {
  var bundle = box.dispatch({
    request: ['/pointer.js'],
    acquired: ['/single.js']
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), pointerMtime * 1000);
    t.equal(meta.hash, '8afa7f1ad50f911ffc0645e4aec2238dfaa782b50c35e4debccf32e2f1cb8db7');

    t.end();
  }));
});

test('mtime and hash depends on all requested files', function (t) {
  var bundle = box.dispatch({
    request: ['/single.js', '/pointer.js']
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), singleMtime * 1000);
    t.equal(meta.hash, 'a598f2fa4b6eaf238ecadd9288001417f858661d62f44a278d216b1e153fd9a0');

    t.end();
  }));
});

test('loading faulty module for first time should send null meta data', function (t) {
  var bundle = box.dispatch({
    request: ['/faulty_require.js'],
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime, null);
    t.equal(meta.hash, null);

    t.end();
  }));
});

test('when loading faulty module that mtime and hash can be fetched', function (t) {
  var bundle = box.dispatch({
    request: ['/faulty_require.js'],
  });

  var meta;
  bundle.once('meta', function (data) {
    meta = data;
  });

  bundle.pipe(endpoint(function (err) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), faultyMtime * 1000);
    t.equal(meta.hash, '1c389857a1147603288a762c7818d0cc095acf158719b52cfd3f538bc38d39cc');

    t.end();
  }));
});
