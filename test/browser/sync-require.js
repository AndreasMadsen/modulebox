
var assert = chai.assert;

describe('sync require case', function () {

  var consoleWarn = console.warn;

  it('require fetch resource and compiles content', function () {
    var send = 0;
    var normal = null;
    var special = null;
    var from = null;
    var request = null;

    var box = window.modulebox();
    box._requestNotify = function (arg_normal, arg_special, arg_from, arg_request) {
      send += 1;
      normal = JSON.parse(JSON.stringify(arg_normal));
      special = JSON.parse(JSON.stringify(arg_special));
      from = JSON.parse(JSON.stringify(arg_from));
      request = JSON.parse(JSON.stringify(arg_request));
    };

    var warning = null;
    console.warn = function (err) {
      warning = err;
    };

    var exports = box.require('/self_export.js');

    assert.equal(send, 1);
    assert.deepEqual(normal, []);
    assert.deepEqual(special, []);
    assert.deepEqual(from, '/');
    assert.deepEqual(request, ['/self_export.js']);

    assert.equal(warning, 'Warning: /self_export.js was requested synchronously from /');

    assert.equal(exports.__filename, '/self_export.js');

    console.error = consoleWarn;
  });

  it('require fetch resource and throws in case of error', function () {
    var send = 0;
    var normal = null;
    var special = null;
    var from = null;
    var request = null;

    var box = window.modulebox({
      baseUrl: 'http://' + window.location.hostname + ':10000'
    });
    box._requestNotify = function (arg_normal, arg_special, arg_from, arg_request) {
      send += 1;
      normal = JSON.parse(JSON.stringify(arg_normal));
      special = JSON.parse(JSON.stringify(arg_special));
      from = JSON.parse(JSON.stringify(arg_from));
      request = JSON.parse(JSON.stringify(arg_request));
    };

    var warning = null;
    console.warn = function (err) {
      warning = err;
    };

    var error = null;
    try {
      box.require('/self_export.js');
    } catch (err) {
      error = err;
    }

    assert.equal(send, 1);
    assert.deepEqual(normal, []);
    assert.deepEqual(special, []);
    assert.deepEqual(from, '/');
    assert.deepEqual(request, ['/self_export.js']);

    assert.equal(warning, 'Warning: /self_export.js was requested synchronously from /');

    assert.equal(error.message, 'Could not connect');
    assert.equal(error.name, 'Error');

    console.error = consoleWarn;
  });

  it('resolve fetch resource', function () {
    var send = 0;
    var normal = null;
    var special = null;
    var from = null;
    var request = null;

    var box = window.modulebox();
    box._requestNotify = function (arg_normal, arg_special, arg_from, arg_request) {
      send += 1;
      normal = JSON.parse(JSON.stringify(arg_normal));
      special = JSON.parse(JSON.stringify(arg_special));
      from = JSON.parse(JSON.stringify(arg_from));
      request = JSON.parse(JSON.stringify(arg_request));
    };

    var warning = null;
    console.warn = function (err) {
      warning = err;
    };

    var filepath = box.require.resolve('/self_export.js');

    assert.equal(send, 1);
    assert.deepEqual(normal, []);
    assert.deepEqual(special, []);
    assert.deepEqual(from, '/');
    assert.deepEqual(request, ['/self_export.js']);

    assert.equal(warning, 'Warning: /self_export.js was requested synchronously from /');

    assert.equal(filepath, '/self_export.js');

    console.warn = consoleWarn;
  });

});
