
var assert = chai.assert;

describe('module environment', function () {
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

  it('modules are compiled on first require and then reused', function () {
    // This file contains `module.exports = module`;
    var moduleObj = box.require('/self_export.js');

    assert.ok(typeof moduleObj === 'object' && moduleObj !== null, 'is object');
    assert.equal(moduleObj, box.require('/self_export.js'));
  });

  it('module.exports is the exported property', function () {
    var moduleObj = box.require('/self_export.js');

    assert.equal(moduleObj, moduleObj.exports);
  });

  it('module.filename matches resolved', function () {
    var moduleObj = box.require('/self_export.js');

    assert.equal(moduleObj.filename, box.require.resolve('/self_export.js'));
  });

});
