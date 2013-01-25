
var assert = chai.assert;

describe('404 response from request', function () {
  var send = 0;
  var acquired = null;
  var source = null;
  var request = null;

  var notFoundBox = window.modulebox({
    url: function (arg_acquired, arg_source, arg_request) {
      send += 1;
      acquired = JSON.parse(JSON.stringify(arg_acquired));
      request = JSON.parse(JSON.stringify(arg_request));
      source = JSON.parse(JSON.stringify(arg_source));

      return 'http://localhost:17000/wrong';
    }
  });

  it('require.ensure it should return an error', function (done) {
    notFoundBox.require.ensure(['/single.js'], function (err) {
      assert.equal(send, 1);
      assert.deepEqual(acquired, []);
      assert.deepEqual(source, '/');
      assert.deepEqual(request, ['/single.js']);

      assert.equal(err.message, 'Got faulty status code 404');
      assert.equal(err.name, 'Error');

      done(null);
    });
  });

  it('require call should throw error', function () {
    var errors = [];

    try {
      notFoundBox.require('/single.js');
    } catch (err) {
      errors.push(err);
    }

    try {
      notFoundBox.require('/single.js');
    } catch (err) {
      errors.push(err);
    }

    assert.equal(send, 1);

    assert.equal(errors[0].message, 'Got faulty status code 404');
    assert.equal(errors[0].name, 'Error');

    // The error object is expected to be the same
    assert.equal(errors[0], errors[1]);
  });

  it('require.resolve call should throw error', function () {
    var errors = [];

    try {
      notFoundBox.require.resolve('/single.js');
    } catch (err) {
      errors.push(err);
    }

    try {
      notFoundBox.require.resolve('/single.js');
    } catch (err) {
      errors.push(err);
    }

    assert.equal(send, 1);

    assert.equal(errors[0].message, 'Got faulty status code 404');
    assert.equal(errors[0].name, 'Error');

    // The error object is expected to be the same
    assert.equal(errors[0], errors[1]);
  });
});

describe('broken response from request', function () {
  var send = 0;
  var acquired = null;
  var source = null;
  var request = null;

  var brokenBox = window.modulebox({
    url: function (arg_acquired, arg_source, arg_request) {
      send += 1;
      acquired = JSON.parse(JSON.stringify(arg_acquired));
      request = JSON.parse(JSON.stringify(arg_request));
      source = JSON.parse(JSON.stringify(arg_source));

      return 'http://localhost:10000';
    }
  });

  it('require.ensure it should return an error', function (done) {
    brokenBox.require.ensure(['/single.js'], function (err) {
      assert.equal(send, 1);
      assert.deepEqual(acquired, []);
      assert.deepEqual(source, '/');
      assert.deepEqual(request, ['/single.js']);

      assert.equal(err.message, 'Could not connect');
      assert.equal(err.name, 'Error');

      done(null);
    });
  });

  it('require call should throw error', function () {
    var errors = [];

    try {
      brokenBox.require('/single.js');
    } catch (err) {
      errors.push(err);
    }

    try {
      brokenBox.require('/single.js');
    } catch (err) {
      errors.push(err);
    }

    assert.equal(send, 1);

    assert.equal(errors[0].message, 'Could not connect');
    assert.equal(errors[0].name, 'Error');

    // The error object is expected to be the same
    assert.equal(errors[0], errors[1]);
  });

  it('require.resolve call should throw error', function () {
    var errors = [];

    try {
      brokenBox.require.resolve('/single.js');
    } catch (err) {
      errors.push(err);
    }

    try {
      brokenBox.require.resolve('/single.js');
    } catch (err) {
      errors.push(err);
    }

    assert.equal(send, 1);

    assert.equal(errors[0].message, 'Could not connect');
    assert.equal(errors[0].name, 'Error');

    // The error object is expected to be the same
    assert.equal(errors[0], errors[1]);
  });
});
