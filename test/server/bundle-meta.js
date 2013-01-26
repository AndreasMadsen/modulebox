
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
    t.equal(meta.hash, 'b17d9e570f00810ad368ab1079687cde7f0a075dc34ed2ceb95420e5a7889577');

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
    t.equal(meta.hash, 'aad7e75514192cb62c1b30b586e127c1af73d943f10bbad5e7f15d7db6070f16');

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
    t.equal(meta.hash, '13a063b63de85deea276945df28fb79921bae67e28383127c2509e8af4507629');

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
    t.equal(meta.hash, '441ffbb7c80fd0c86ddc1020552b11d87e5dfefacac35b1bb752c5c7867d86cc');

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
    t.equal(meta.hash, '579af1db9dc52014d9f64f4e0496599a89e69c7fa1889de7be86e6332de7c5e3');

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
    t.equal(meta.hash, '8c6639440c9986468f0e214f1040df096fd520a14fc4ef084674bebf1b14c0d7');

    t.end();
  }));
});
