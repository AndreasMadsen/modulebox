
var assert = chai.assert;

describe('window.modulebox client constructor', function () {

  it('should be a function', function () {
    assert.equal(typeof window.modulebox, 'function');
  });

  it('should default baseUrl and sourcePath', function () {
    var box = window.modulebox();
    assert.equal(box._baseUrl, 'http://' + window.location.host + '/modulebox/');
    assert.equal(box._hostUrl, 'http://' + window.location.host);
    assert.equal(box._sourcePath, '/modulebox/files/');
  });

  it('should define baseUrl and sourcePath if set', function () {
    var box = window.modulebox({
      baseUrl: 'http://' + window.location.host + '/custom/',
      sourcePath: '/custom/module/'
    });
    assert.equal(box._baseUrl, 'http://' + window.location.host + '/custom/');
    assert.equal(box._hostUrl, 'http://' + window.location.host);
    assert.equal(box._sourcePath, '/custom/module/');
  });

});
