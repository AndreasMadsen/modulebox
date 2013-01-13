
var assert = chai.assert;

describe('require.ensure method', function () {
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

  it('require.ensure returns error if module don\'t exists', function (done) {
    box.require.ensure('/missing.js', function (err) {
      assert.equal(send, 1);
      assert.deepEqual(acquired, []);
      assert.deepEqual(source, '/');
      assert.deepEqual(request, '/missing.js');

      assert.equal(err.message, 'Cannot find module \'/missing.js\'');
      assert.equal(err.name, 'Error');
      assert.equal(err.code, 'MODULE_NOT_FOUND');

      done(null);
    });
  });

  it('require.ensure don\'t send request twice after failure', function (done) {
    box.require.ensure('/missing.js', function (err) {
      assert.equal(send, 1);

      assert.equal(err.message, 'Cannot find module \'/missing.js\'');
      assert.equal(err.name, 'Error');
      assert.equal(err.code, 'MODULE_NOT_FOUND');

      done(null);
    });
  });

  it('require.ensure returns no error if module was found', function (done) {
    box.require.ensure('/self_export.js', function (err) {
      assert.equal(send, 2);
      assert.deepEqual(acquired, []);
      assert.deepEqual(source, '/');
      assert.deepEqual(request, '/self_export.js');

      assert.equal(err, null);

      done(null);
    });
  });

  it('require.ensure don\'t send request twice after sucess', function (done) {
    box.require.ensure('/self_export.js', function (err) {
      assert.equal(send, 2);

      assert.equal(err, null);

      done(null);
    });
  });

});


describe('Isolated modulebox', function () {
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

  it('require.ensure returns no error if module was found', function (done) {
    box.require.ensure('/self_export.js', function (err) {
      assert.equal(send, 1);
      assert.deepEqual(acquired, []);
      assert.deepEqual(source, '/');
      assert.deepEqual(request, '/self_export.js');

      assert.equal(err, null);

      done(null);
    });
  });

});

