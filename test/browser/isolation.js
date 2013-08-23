
var assert = chai.assert;

describe('Isolated modulebox', function () {
  var send = 0;
  var acquired = null;
  var source = null;
  var request = null;

  var box = window.modulebox({
    url: function (arg_acquired, arg_special, arg_source, arg_request) {
      send += 1;
      acquired = JSON.parse(JSON.stringify(arg_acquired));
      request = JSON.parse(JSON.stringify(arg_request));
      source = JSON.parse(JSON.stringify(arg_source));

      return 'http://' + window.location.host + '/module' +
        '?acquired=' + encodeURIComponent(JSON.stringify(acquired)) +
        '&source=' + encodeURIComponent(JSON.stringify(source)) +
        '&request=' + encodeURIComponent(JSON.stringify(request));
    }
  });

  it('require.ensure returns no error if module was found', function (done) {
    box.require.ensure(['/self_export.js'], function (err) {
      assert.equal(send, 1);
      assert.deepEqual(acquired, []);
      assert.deepEqual(source, '/');
      assert.deepEqual(request, ['/self_export.js']);

      assert.equal(err, null);

      done(null);
    });
  });
});
