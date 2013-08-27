
var fs = require('fs');
var path = require('path');

var test = require('tap').test;

var TestServer = require('../test-server.js');
var server = new TestServer({
  root: path.resolve(__dirname, '..', 'localized'),

  modules: 'modules',
  special: {
    one: path.resolve(__dirname, '..', 'special', 'one.js'),
    two: path.resolve(__dirname, '..', 'special', 'two.js'),
    json: path.resolve(__dirname, '..', 'special', 'json.json'),
    relative: path.resolve(__dirname, '..', 'special', 'relative.js'),
    missing: path.resolve(__dirname, '..', 'special', 'missing.js')
  }
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

test('requiring special JSON file', function (t) {
  server.request({
    request: ['json']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'special_json', actual, t.end.bind(t));
  });
});

test('simple single module request', function (t) {
  server.request({
    request: ['two']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_single', actual, t.end.bind(t));
  });
});

test('double simple module request', function (t) {
  server.request({
    request: ['two', 'two']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'special_double_single', actual, t.end.bind(t));
  });
});

test('two request diffrent module request', function (t) {
  server.request({
    request: ['two', 'one']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'special_multi_pointer', actual, t.end.bind(t));
  });
});

test('two request diffrent and same module request', function (t) {
  server.request({
    request: ['two', 'two', 'one']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'special_same_multi_pointer', actual, t.end.bind(t));
  });
});

test('request special there is acquired', function (t) {
  server.request({
    request: ['two'],
    special: ['/two.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'special_acquired', actual, t.end.bind(t));
  });
});

test('request special there has a dependency there is acquired', function (t) {
  server.request({
    request: ['one'],
    special: ['/one.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'special_dependency_acquired', actual, t.end.bind(t));
  });
});

test('simple request from none root location', function (t) {
  server.request({
    from: '/modules/simple/index.js',
    request: ['two']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_none_root', actual, t.end.bind(t));
  });
});

test('simple special request with dependency', function (t) {
  server.request({
    request: ['one']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_dependency', actual, t.end.bind(t));
  });
});

test('special request with relative dependency', function (t) {
  server.request({
    request: ['relative']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_relative', actual, t.end.bind(t));
  });
});

test('special missing request', function (t) {
  server.request({
    request: ['_internal']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_internal_missing', actual, t.end.bind(t));
  });
});

test('request modules from both special and complex', function (t) {
  server.request({
    request: ['one', '/complex.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_complex', actual, t.end.bind(t));
  });
});

test('request special module there is missing', function (t) {
  server.request({
    request: ['missing']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_file_missing', actual, t.end.bind(t));
  });
});

test('request normal there then requires special', function (t) {
  server.request({
    request: ['/special_require.js']
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'special_from_normal', actual, t.end.bind(t));
  });
});

test('close test server', function (t) {
  server.close(t.end.bind(t));
});
