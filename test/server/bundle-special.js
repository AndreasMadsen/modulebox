
var fs = require('fs');
var path = require('path');
var endpoint = require('endpoint');
var modulebox = require('../../lib/dispatch.js');

var test = require('tap').test;

var box = modulebox({
  root: path.resolve(__dirname, '..', 'localized'),

  modules: 'modules',
  special: {
    one: path.resolve(__dirname, '..', 'special', 'one.js'),
    two: path.resolve(__dirname, '..', 'special', 'two.js'),
    json: path.resolve(__dirname, '..', 'special', 'json.json')
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

test('requiring special JSON file', function (t) {
  var bundle = box.dispatch({
    request: ['json']
  });

  bundle.pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    matchResult(t, 'special_json', actual, t.end.bind(t));
  }));
});

test('simple single module request', function (t) {
  var bundle = box.dispatch({
    request: ['two']
  });

  bundle.pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_single', actual, t.end.bind(t));
  }));
});

test('double simple module request', function (t) {
  var bundle = box.dispatch({
    request: ['two', 'two']
  });

  bundle.pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    matchResult(t, 'special_double_single', actual, t.end.bind(t));
  }));
});

test('two request diffrent module request', function (t) {
  var bundle = box.dispatch({
    request: ['two', 'one']
  });

  bundle.pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    matchResult(t, 'special_multi_pointer', actual, t.end.bind(t));
  }));
});

test('two request diffrent and same module request', function (t) {
  var bundle = box.dispatch({
    request: ['two', 'two', 'one']
  });

  bundle.pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    matchResult(t, 'special_same_multi_pointer', actual, t.end.bind(t));
  }));
});

test('simple request from none root location', function (t) {
  var bundle = box.dispatch({
    source: '/modules/simple/index.js',
    request: ['two']
  });

  bundle.pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_none_root', actual, t.end.bind(t));
  }));
});

test('simple special request with dependency', function (t) {
  var bundle = box.dispatch({
    request: ['one']
  });

  bundle.pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    matchResult(t, 'speical_dependency', actual, t.end.bind(t));
  }));
});

