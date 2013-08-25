
var assert = chai.assert;

describe('module ensure on a working destination', function () {
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

  it('require.ensure returns error if normal modulepath don\'t exists', function (done) {
    box.require.ensure(['/missing.js'], function (err) {
      assert.equal(send, 1);
      assert.deepEqual(normal, []);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
      assert.deepEqual(request, ['/missing.js']);

      assert.equal(err, null);

      try {
        box.require('/missing.js');
      } catch (err) {
        assert.equal(err.message, 'Cannot find module \'/missing.js\'');
        assert.equal(err.name, 'Error');
        assert.equal(err.code, 'MODULE_NOT_FOUND');
      }

      done(null);
    });
  });

  it('require.ensure don\'t send request twice after failure', function (done) {
    box.require.ensure(['/missing.js'], function (err) {
      assert.equal(send, 1);

      assert.equal(err, null);

      try {
        box.require('/missing.js');
      } catch (err) {
        assert.equal(err.message, 'Cannot find module \'/missing.js\'');
        assert.equal(err.name, 'Error');
        assert.equal(err.code, 'MODULE_NOT_FOUND');
      }

      done(null);
    });
  });

  it('require.ensure returns error if special module don\'t exists', function (done) {
    box.require.ensure(['missing'], function (err) {
      assert.equal(send, 2);
      assert.deepEqual(normal, []);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
      assert.deepEqual(request, ['missing']);

      assert.equal(err, null);

      try {
        box.require('missing');
      } catch (err) {
        assert.equal(err.message, 'Cannot find module \'missing\'');
        assert.equal(err.name, 'Error');
        assert.equal(err.code, 'MODULE_NOT_FOUND');
      }

      done(null);
    });
  });

  it('require.ensure don\'t send request twice after special failure', function (done) {
    box.require.ensure(['missing'], function (err) {
      assert.equal(send, 2);

      assert.equal(err, null);

      try {
        box.require('missing');
      } catch (err) {
        assert.equal(err.message, 'Cannot find module \'missing\'');
        assert.equal(err.name, 'Error');
        assert.equal(err.code, 'MODULE_NOT_FOUND');
      }

      done(null);
    });
  });

  it('require.ensure returns error if normal module don\'t exists', function (done) {
    box.require.ensure(['unkown'], function (err) {
      assert.equal(send, 3);
      assert.deepEqual(normal, []);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
      assert.deepEqual(request, ['unkown']);

      assert.equal(err, null);

      try {
        box.require('unkown');
      } catch (err) {
        assert.equal(err.message, 'Cannot find module \'unkown\'');
        assert.equal(err.name, 'Error');
        assert.equal(err.code, 'MODULE_NOT_FOUND');
      }

      done(null);
    });
  });

  it('require call should throw error same error', function () {
    var errors = [];

    try {
      box.require('/missing.js');
    } catch (err) {
      errors.push(err);
    }

    try {
      box.require('/missing.js');
    } catch (err) {
      errors.push(err);
    }

    assert.equal(send, 3);

    assert.equal(errors[0].message, 'Cannot find module \'/missing.js\'');
    assert.equal(errors[0].name, 'Error');
    assert.equal(errors[0].code, 'MODULE_NOT_FOUND');

    // The error object is expected to be the same
    assert.strictEqual(errors[0], errors[1]);
  });

  it('require.resolve call should throw error', function () {
    var errors = [];

    try {
      box.require.resolve('/missing.js');
    } catch (err) {
      errors.push(err);
    }

    try {
      box.require.resolve('/missing.js');
    } catch (err) {
      errors.push(err);
    }

    assert.equal(send, 3);

    assert.equal(errors[0].message, 'Cannot find module \'/missing.js\'');
    assert.equal(errors[0].name, 'Error');
    assert.equal(errors[0].code, 'MODULE_NOT_FOUND');

    // The error object is expected to be the same
    assert.strictEqual(errors[0], errors[1]);
  });

  it('require.ensure returns no error if module was found', function (done) {
    box.require.ensure(['/self_export.js'], function (err) {
      assert.equal(send, 4);

      assert.deepEqual(normal, []);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
      assert.deepEqual(request, ['/self_export.js']);

      assert.equal(err, null);

      done(null);
    });
  });

  it('require.ensure don\'t send request twice after sucess', function (done) {
    box.require.ensure(['/self_export.js'], function (err) {
      assert.equal(send, 4);

      assert.equal(err, null);

      done(null);
    });
  });

  it('require.resolve return filepath on normal', function () {
    assert.equal(box.require.resolve('/self_export.js'), '/self_export.js');
  });

  it('require.ensure returns no error if special module was found', function (done) {
    box.require.ensure(['two'], function (err) {
      assert.equal(send, 5);

      assert.deepEqual(normal, ['/self_export.js']);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
      assert.deepEqual(request, ['two']);

      assert.equal(err, null);

      done(null);
    });
  });

  it('require.ensure don\'t send request twice after special sucess', function (done) {
    box.require.ensure(['two'], function (err) {
      assert.equal(send, 5);

      assert.equal(err, null);

      done(null);
    });
  });

  it('require.resolve return modulename on normal', function () {
    assert.equal(box.require.resolve('two'), 'two');
  });

});
