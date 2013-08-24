
var fs = require('fs');
var path = require('path');

var test = require('tap').test;

var TestServer = require('../test-server.js');
var server = new TestServer({
  root: path.resolve(__dirname, '..', 'localized'),
  modules: 'modules',
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

test('open test server', function (t) {
  server.open(t.end.bind(t));
});

test('no resources is send makes mtime null and resolved is hash', function (t) {
  server.request({
    request: ['/single.js'],
    normal: ['/single.js']
  }, function (err, meta, actual) {
    t.equal(err, null);
    t.equal(meta.mtime, null);
    t.equal(meta.hash, '26609e163aa2f0d03aa444d2af5a550d4b1d114e12743ca799afa7df52ea05ed');

    t.end();
  });
});

test('when first resource isn\'t fetched meta is null', function (t) {
  server.request({
    request: ['/single.js']
  }, function (err, meta, actual) {
    t.equal(err, null);
    t.equal(meta.mtime, null);
    t.equal(meta.hash, null);

    t.end();
  });
});

test('when all (one) resources is fetched meta is set', function (t) {
  server.request({
    request: ['/single.js']
  }, function (err, meta, actual) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), singleMtime * 1000);
    t.equal(meta.hash, '42ae6b4b1bb78879cad97ee0092acc77ba788e8b2e1577240b012e76d15c8377');

    t.end();
  });
});

test('when not all resources is fetched meta is null', function (t) {
  server.request({
    request: ['/pointer.js']
  }, function (err, meta, actual) {
    t.equal(err, null);
    t.equal(meta.mtime, null);
    t.equal(meta.hash, null);

    t.end();
  });
});

test('when all resources is fetched meta is set', function (t) {
  server.request({
    request: ['/pointer.js']
  }, function (err, meta, actual) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), singleMtime * 1000);
    t.equal(meta.hash, '76d89e851dd53b85399857a056a9b1b6852753df88906c589e55d212de5ac6ac');

    t.end();
  });
});

test('mtime and hash depends on the acquired files', function (t) {
  server.request({
    request: ['/pointer.js'],
    normal: ['/single.js']
  }, function (err, meta, actual) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), pointerMtime * 1000);
    t.equal(meta.hash, '40c869dd3723b08beb0d01bf76ef7932adc3e5881d9f4d8ccd2633ebe93d4327');

    t.end();
  });
});

test('mtime and hash depends on all requested files', function (t) {
  server.request({
    request: ['/single.js', '/pointer.js']
  }, function (err, meta, actual) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), singleMtime * 1000);
    t.equal(meta.hash, '717c04125e3e3651cdaa2a37d17173eaf3f3d6541ab1c3974d2c687a7150501f');

    t.end();
  });
});

test('loading faulty module for first time should send null meta data', function (t) {
  server.request({
    request: ['/faulty_require.js'],
  }, function (err, meta, actual) {
    t.equal(err, null);
    t.equal(meta.mtime, null);
    t.equal(meta.hash, null);

    t.end();
  });
});

test('when loading faulty module that mtime and hash can be fetched', function (t) {
  server.request({
    request: ['/faulty_require.js'],
  }, function (err, meta, actual) {
    t.equal(err, null);
    t.equal(meta.mtime.getTime(), faultyMtime * 1000);
    t.equal(meta.hash, '476e7ee446e4d93516b5dc96ed7681412ba056bf387695c7aa76fa812c8fd838');

    t.end();
  });
});

test('close test server', function (t) {
  server.close(t.end.bind(t));
});
