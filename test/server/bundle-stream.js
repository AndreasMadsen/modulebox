
var fs = require('fs');
var path = require('path');

var test = require('tap').test;

var TestServer = require('../test-server.js');
var server = new TestServer({
  root: path.resolve(__dirname, '..', 'localized'),
  modules: 'modules'
});

function fixture(name) {
  return path.resolve(__dirname, '..', 'fixture', name + '.xml');
}

function matchResult(t, name, actual, callback) {
  fs.readFile(fixture(name), 'utf8', function (err, expected) {
    t.equal(err, null);
    t.equal(actual.toString(), expected);
    callback();
  });
}

test('open test server', function (t) {
  server.open(t.end.bind(t));
});

test('requiring JSON file', function (t) {
  server.request({
    request: ['/file.json']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'json', actual, t.end.bind(t));
  });
});

test('simple single module request', function (t) {
  server.request({
    request: ['/single.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'single', actual, t.end.bind(t));
  });
});

test('double simple module request', function (t) {
  server.request({
    request: ['/single.js', '/single.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'double_single', actual, t.end.bind(t));
  });
});

test('two request diffrent module request', function (t) {
  server.request({
    request: ['/single.js', '/pointer.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'multi_pointer', actual, t.end.bind(t));
  });
});

test('two request diffrent and same module request', function (t) {
  server.request({
    request: ['/single.js', '/single.js', '/pointer.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'same_multi_pointer', actual, t.end.bind(t));
  });
});

test('big multi chunk file', function (t) {
  server.request({
    request: ['/big.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'big', actual, t.end.bind(t));
  });
});

test('simple request from none root location', function (t) {
  server.request({
    from: '/modules/simple/index.js',
    request: ['./package.json']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'package', actual, t.end.bind(t));
  });
});

test('complex dependencies tree', function (t) {
  server.request({
    request: ['/complex.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'complex', actual, t.end.bind(t));
  });
});

test('complex dependencies tree with acquired files', function (t) {
  server.request({
    request: ['/complex.js'],
    normal: ['/modules/simple/index.js', '/modules/simple/package.json']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'acquired', actual, t.end.bind(t));
  });
});

test('request acquired file', function (t) {
  server.request({
    request: ['/single.js'],
    normal: ['/single.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'all_acquired', actual, t.end.bind(t));
  });
});

test('request dependency do not exists', function (t) {
  var warning = null;
  server.once('warning', function (err) {
    warning = err;
  });

  server.request({
    request: ['/missing_require.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    t.equal(warning.message, 'Cannot find module \'/missing.js\'');
    t.equal(warning.code, 'MODULE_NOT_FOUND');
    t.equal(warning.name, 'Error');

    matchResult(t, 'dependency_missing', actual, t.end.bind(t));
  });
});

test('request could not be resolved', function (t) {
  var warning = null;
  server.once('warning', function (err) {
    warning = err;
  });

  server.request({
    request: ['/missing.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'file_missing', actual, function () {
      t.equal(warning.message, 'Cannot find module \'/missing.js\'');
      t.equal(warning.code, 'MODULE_NOT_FOUND');
      t.equal(warning.name, 'Error');

      t.end();
    });
  });
});

test('request faulty sub package.json', function (t) {
  var warning = null;
  server.once('warning', function (err) {
    warning = err;
  });

  server.request({
    request: ['/faulty_require.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'faulty_package', actual, function () {
      t.equal(warning.message, 'Unexpected token s');
      t.equal(warning.name, 'SyntaxError');

      t.end();
    });
  });
});

test('request file containing syntax error', function (t) {
  var warning = null;
  server.once('warning', function (err) {
    warning = err;
  });

  server.request({
    request: ['/syntax_error.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'syntax_error', actual, function () {
      t.equal(warning, null);

      t.end();
    });
  });
});

test('close test server', function (t) {
  server.close(t.end.bind(t));
});
