
var fs = require('fs');
var path = require('path');
var blow = require('blow');
var http = require('http');
var modulebox = require('../../lib/dispatch.js');

//
// Setup blow server
//
var browserDir = path.resolve(__dirname, '..', 'browser');
var files = fs.readdirSync(browserDir).map(function (basename) {
  return path.resolve(browserDir, basename);
});

var indexFile = path.resolve(__dirname, 'index.html');

var blowDispatch = blow(files, {
  address: '0.0.0.0',
  port: 11000,
  index: indexFile,
  style: 'bdd'
});

//
// Setup test server
//

var box = modulebox({
  root: path.resolve(__dirname, '..', 'localized'),

  modules: 'modules',
  special: {
    one: path.resolve(__dirname, '..', 'special', 'one.js'),
    two: path.resolve(__dirname, '..', 'special', 'two.js'),
    json: path.resolve(__dirname, '..', 'special', 'json.json'),
    relative: path.resolve(__dirname, '..', 'special', 'relative.js'),
    missing: path.resolve(__dirname, '..', 'special', 'missing.js'),
    'throw': path.resolve(__dirname, '..', 'special', 'throw.js'),
    self: path.resolve(__dirname, '..', 'special', 'self.js')
  }
});

http.createServer(function (req, res) {
    if (req.url.slice(0, 11) === '/modulebox/') {
      box.dispatch(req, res);
    } else {
      blowDispatch(req, res);
    }
}).listen(11000, '0.0.0.0', function () {
  console.log('test server ready on http://localhost:11000');
});
