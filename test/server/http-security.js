
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

test('no query parameters', function (t) {
  server.query({}, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('no special parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    normal: JSON.stringify([]),
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('not json special parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify(null),
    normal: JSON.stringify([]),
    request: 'bad'
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('bad special parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify(null),
    normal: JSON.stringify([]),
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('bad special array parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([null]),
    normal: JSON.stringify([]),
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('no normal parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([]),
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('not json normal parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([]),
    normal: 'bad',
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('bad normal parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([]),
    normal: null,
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('bad normal array parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([]),
    normal: JSON.stringify([null]),
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('no from parameters', function (t) {
  server.query({
    special: JSON.stringify([]),
    normal: JSON.stringify([]),
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('not json from parameters', function (t) {
  server.query({
    from: 'bad',
    special: JSON.stringify([]),
    normal: JSON.stringify([]),
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('bad from parameters', function (t) {
  server.query({
    from: JSON.stringify(null),
    special: JSON.stringify([]),
    normal: JSON.stringify([]),
    request: JSON.stringify(['/single.js'])
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('no request parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([]),
    normal: JSON.stringify([]),
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('bad request parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([]),
    normal: JSON.stringify([]),
    request: 'bad',
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('bad request parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([]),
    normal: JSON.stringify([]),
    request: JSON.stringify(null),
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('bad request array parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([]),
    normal: JSON.stringify([]),
    request: JSON.stringify([null]),
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('empty request array parameters', function (t) {
  server.query({
    from: JSON.stringify('/'),
    special: JSON.stringify([]),
    normal: JSON.stringify([]),
    request: JSON.stringify(),
  }, function (err, meta, actual) {
    t.equal(err, null);

    matchResult(t, 'paramenter_error', actual, t.end.bind(t));
  });
});

test('close test server', function (t) {
  server.close(t.end.bind(t));
});
