
var assert = chai.assert;

describe('window.modulebox client constructor', function () {

  it('should be a function', function () {
    assert.equal(typeof window.modulebox, 'function');
  });

  it('should throw if no settings was defined', function () {
    try {
      var box = window.modulebox();
    } catch (err) {
       assert.equal(err.message, 'The settings object must be specified');
       assert.equal(err.name, 'TypeError');
    }
  });

  it('should throw if no url encoder was defined', function () {
    try {
      window.modulebox({});
    } catch (err) {
       assert.equal(err.message, 'A url method must be provided');
       assert.equal(err.name, 'TypeError');
    }
  });

});

describe('require.ensure method', function () {
  var box = window.modulebox({
    url: function (acquired, source, request) {
      return 'http://localhost:17000/module' +
        '?acquired=' + JSON.stringify(acquired) +
        '&source=' + JSON.stringify(source) +
        '&request=' + JSON.stringify(request);
    }
  });

  it('require.ensure returns error if module don\'t exists', function (done) {
    box.require.ensure('/missing.js', function (err) {
      assert.equal(err.message, 'Cannot find module \'/missing.js\'');
      assert.equal(err.name, 'Error');
      assert.equal(err.code, 'MODULE_NOT_FOUND');

      done(null);
    });
  });

});
