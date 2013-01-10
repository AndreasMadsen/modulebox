
var fs = require('fs');
var path = require('path');
var endpoint = require('endpoint');
var modulebox = require('../../lib/dispatch.js');

var test = require('tap').test;

var box = modulebox({
  root: path.resolve(__dirname, '..', 'localized')
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
