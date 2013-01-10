
var fs = require('fs');
var path = require('path');
var endpoint = require('endpoint');
var modulebox = require('../../lib/dispatch.js');

var test = require('tap').test;

var box = modulebox({
  root: path.resolve(__dirname, '..', 'localized'),

  modules: 'modules'
});

test('simple single module request', function (t) {
  box.dispatch({ request: '/single.js' }).pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    var expectedPath = path.resolve(__dirname, '..', 'fixture', 'single.xml');
    fs.readFile(expectedPath, 'utf8', function (err, expected) {
      t.equal(err, null);
      t.equal(actual.toString(), expected);
      t.end();
    });
  }));
});

test('big multi chunk file', function (t) {
  box.dispatch({ request: '/big.js' }).pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    var expectedPath = path.resolve(__dirname, '..', 'fixture', 'big.xml');
    fs.readFile(expectedPath, 'utf8', function (err, expected) {
      t.equal(err, null);
      t.equal(actual.toString(), expected);
      t.end();
    });
  }));
});

test('simple request from none root location', function (t) {
  box.dispatch({
    source: '/modules/simple/index.js',
    request: './package.json'
  }).pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    var expectedPath = path.resolve(__dirname, '..', 'fixture', 'package.xml');
    fs.readFile(expectedPath, 'utf8', function (err, expected) {
      t.equal(err, null);
      t.equal(actual.toString(), expected);
      t.end();
    });
  }));
});

test('complex dependencies tree', function (t) {
  box.dispatch({ request: '/complex.js' }).pipe(endpoint(function (err, actual) {
    t.equal(err, null);

    var expectedPath = path.resolve(__dirname, '..', 'fixture', 'complex.xml');
    fs.readFile(expectedPath, 'utf8', function (err, expected) {
      t.equal(err, null);
      t.equal(actual.toString(), expected);
      t.end();
    });
  }));
});
