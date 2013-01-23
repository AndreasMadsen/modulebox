
var assert = chai.assert;

describe('evaluation', function () {
  var box = window.modulebox({
    url: function (acquired, source, request) {
      return 'http://localhost:17000/module' +
        '?acquired=' + JSON.stringify(acquired) +
        '&source=' + JSON.stringify(source) +
        '&request=' + JSON.stringify(request);
    }
  });

  var is_chrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;

  if (is_chrome) {
    it('source map creates a meaningful stack trace', function (done) {
      box.require.ensure('/throw.js', function (err) {
        assert.equal(err, null);

        var produce = box.require('/throw.js');
        setTimeout(function() {
          var error = produce();
          console.log(error.stack);
          assert.ok((/throw\.js/).test(error.stack), 'throw.js exists in stack trace');

          done(null);
        }, 0);
      });
    });
  } else {
    it('source map is assumed to be unsupported', function (done) {
      done(null);
    });
  }

  // !!! TESTING NOTE: for this test to work the variable name `content` must
  // exists in Module.prototype._evaluate.
  it('test that scripts are evaluated in a global scope', function (done) {
    box.require.ensure('/global_scope.js', function (err) {
      assert.equal(err, null);

      var type = box.require('/global_scope.js');
      assert.notEqual(type, 'string');

      done(null);
    });
  });
});
