
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
