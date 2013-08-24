
var assert = chai.assert;

describe('404 response from request', function () {
  var send = 0;
  var normal = null;
  var special = null;
  var from = null;
  var request = null;

  var notFoundBox = window.modulebox({
    baseUrl: 'http://' + window.location.host + '/wrong/'
  });
  notFoundBox._requestNotify = function (arg_normal, arg_special, arg_from, arg_request) {
    send += 1;
    normal = JSON.parse(JSON.stringify(arg_normal));
    special = JSON.parse(JSON.stringify(arg_special));
    from = JSON.parse(JSON.stringify(arg_from));
    request = JSON.parse(JSON.stringify(arg_request));
  };

  it('require.ensure it should return an error', function (done) {
    notFoundBox.require.ensure(['/single.js'], function (err) {
      assert.equal(send, 1);
      assert.deepEqual(normal, []);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
      assert.deepEqual(request, ['/single.js']);

      assert.equal(err.message, 'Got faulty status code 404');
      assert.equal(err.name, 'Error');

      done(null);
    });
  });

  it('require.ensure should not cache a connection error', function (done) {
    notFoundBox.require.ensure(['/single.js'], function (err) {
      assert.equal(send, 2);
      assert.deepEqual(normal, []);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
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
  var normal = null;
  var special = null;
  var from = null;
  var request = null;

  var brokenBox = window.modulebox({
    baseUrl: 'http://' + window.location.hostname + ':10000'
  });
  brokenBox._requestNotify = function (arg_normal, arg_special, arg_from, arg_request) {
    send += 1;
    normal = JSON.parse(JSON.stringify(arg_normal));
    special = JSON.parse(JSON.stringify(arg_special));
    from = JSON.parse(JSON.stringify(arg_from));
    request = JSON.parse(JSON.stringify(arg_request));
  };

  it('require.ensure it should return an error', function (done) {
    this.timeout();

    brokenBox.require.ensure(['/single.js'], function (err) {
      assert.equal(send, 1);
      assert.deepEqual(normal, []);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
      assert.deepEqual(request, ['/single.js']);

      assert.equal(err.message, 'Could not connect');
      assert.equal(err.name, 'Error');

      done(null);
    });
  });


  it('require.ensure should not cache a connection error', function (done) {
    this.timeout();

    brokenBox.require.ensure(['/single.js'], function (err) {
      assert.equal(send, 2);
      assert.deepEqual(normal, []);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
      assert.deepEqual(request, ['/single.js']);

      assert.equal(err.message, 'Could not connect');
      assert.equal(err.name, 'Error');

      done(null);
    });
  });

  it('require call should throw error', function () {
    this.timeout();

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
    this.timeout();

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
