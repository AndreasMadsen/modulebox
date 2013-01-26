
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

  it('require.ensure should not cache a connection error', function (done) {
    notFoundBox.require.ensure(['/single.js'], function (err) {
      assert.equal(send, 2);
      assert.deepEqual(acquired, []);
      assert.deepEqual(source, '/');
      assert.deepEqual(request, ['/single.js']);

      assert.equal(err.message, 'Got faulty status code 404');
      assert.equal(err.name, 'Error');

      done(null);
    });
  });

  it('require call should throw error', function () {
    var err = null;

    try {
      notFoundBox.require('/single.js');
    } catch (error) {
      err = error;
    }

    assert.equal(send, 3);

    assert.equal(err.message, 'Got faulty status code 404');
    assert.equal(err.name, 'Error');
  });

  it('require.resolve call should throw error', function () {
    var err = null;

    try {
      notFoundBox.require.resolve('/single.js');
    } catch (error) {
      err = error;
    }

    assert.equal(send, 4);

    assert.equal(err.message, 'Got faulty status code 404');
    assert.equal(err.name, 'Error');
  });
});

describe('broken connection in request', function () {
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


  it('require.ensure should not cache a connection error', function (done) {
    brokenBox.require.ensure(['/single.js'], function (err) {
      assert.equal(send, 2);
      assert.deepEqual(acquired, []);
      assert.deepEqual(source, '/');
      assert.deepEqual(request, ['/single.js']);

      assert.equal(err.message, 'Could not connect');
      assert.equal(err.name, 'Error');

      done(null);
    });
  });

  it('require call should throw error', function () {
    var err = null;

    try {
      brokenBox.require('/single.js');
    } catch (error) {
      err = error;
    }

    assert.equal(send, 3);

    assert.equal(err.message, 'Could not connect');
    assert.equal(err.name, 'Error');
  });

  it('require.resolve call should throw error', function () {
    var err = null;

    try {
      brokenBox.require.resolve('/single.js');
    } catch (error) {
      err = error;
    }

    assert.equal(send, 4);

    assert.equal(err.message, 'Could not connect');
    assert.equal(err.name, 'Error');
  });
});
