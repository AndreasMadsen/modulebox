
var assert = chai.assert;

describe('Isolated modulebox', function () {
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

  it('require.ensure returns no error if module was found', function (done) {
    box.require.ensure(['/self_export.js'], function (err) {
      assert.equal(send, 1);
      assert.deepEqual(normal, []);
      assert.deepEqual(special, []);
      assert.deepEqual(from, '/');
      assert.deepEqual(request, ['/self_export.js']);

      assert.equal(err, null);

      done(null);
    });
  });
});
