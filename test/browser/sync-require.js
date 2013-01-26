
var assert = chai.assert;

describe('sync require case', function () {

  var consoleError = console.error;

  it('require fetch resource and compiles content', function () {
    var send = 0;
    var acquired = null;
    var source = null;
    var request = null;
    var box = window.modulebox({
      url: function (arg_acquired, arg_source, arg_request) {
        send += 1;
        acquired = JSON.parse(JSON.stringify(arg_acquired));
        request = JSON.parse(JSON.stringify(arg_request));
        source = JSON.parse(JSON.stringify(arg_source));

        return 'http://localhost:17000/module' +
          '?acquired=' + JSON.stringify(acquired) +
          '&source=' + JSON.stringify(source) +
          '&request=' + JSON.stringify(request);
      }
    });

    var warning = null;
    console.error = function (err) {
      warning = err;
    };

    var exports = box.require('/self_export.js');

    assert.equal(send, 1);
    assert.deepEqual(acquired, []);
    assert.deepEqual(source, '/');
    assert.deepEqual(request, ['/self_export.js']);

    assert.equal(warning.message, 'Warning: /self_export.js was requested synchronously from /');
    assert.equal(warning.name, 'Error');

    assert.equal(exports.__filename, '/self_export.js');

    console.error = consoleError;
  });

  it('require fetch resource and throws in case of error', function () {
    var send = 0;
    var acquired = null;
    var source = null;
    var request = null;
    var box = window.modulebox({
      url: function (arg_acquired, arg_source, arg_request) {
        send += 1;
        acquired = JSON.parse(JSON.stringify(arg_acquired));
        request = JSON.parse(JSON.stringify(arg_request));
        source = JSON.parse(JSON.stringify(arg_source));

        return 'http://localhost:10000';
      }
    });

    var warning = null;
    console.error = function (err) {
      warning = err;
    };

    var error = null;
    try {
      box.require('/self_export.js');
    } catch (err) {
      error = err;
    }

    assert.equal(send, 1);
    assert.deepEqual(acquired, []);
    assert.deepEqual(source, '/');
    assert.deepEqual(request, ['/self_export.js']);

    assert.equal(warning.message, 'Warning: /self_export.js was requested synchronously from /');
    assert.equal(warning.name, 'Error');

    assert.equal(error.message, 'Could not connect');
    assert.equal(error.name, 'Error');

    console.error = consoleError;
  });

  it('resolve fetch resource', function () {
    var send = 0;
    var acquired = null;
    var source = null;
    var request = null;
    var box = window.modulebox({
      url: function (arg_acquired, arg_source, arg_request) {
        send += 1;
        acquired = JSON.parse(JSON.stringify(arg_acquired));
        request = JSON.parse(JSON.stringify(arg_request));
        source = JSON.parse(JSON.stringify(arg_source));

        return 'http://localhost:17000/module' +
          '?acquired=' + JSON.stringify(acquired) +
          '&source=' + JSON.stringify(source) +
          '&request=' + JSON.stringify(request);
      }
    });

    var warning = null;
    console.error = function (err) {
      warning = err;
    };

    var filepath = box.require.resolve('/self_export.js');

    assert.equal(send, 1);
    assert.deepEqual(acquired, []);
    assert.deepEqual(source, '/');
    assert.deepEqual(request, ['/self_export.js']);

    assert.equal(warning.message, 'Warning: /self_export.js was requested synchronously from /');
    assert.equal(warning.name, 'Error');

    assert.equal(filepath, '/self_export.js');

    console.error = consoleError;
  });

});
