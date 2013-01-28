
var fs = require('fs');
var url = require('url');
var path = require('path');
var blow = require('blow');
var http = require('http');
var filed = require('filed');
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

  modules: 'modules'
});

http.createServer(function (req, res) {
    var href = url.parse(req.url, true);

    if (href.pathname === '/core.js') {
      req.pipe( filed(box.clientCore) ).pipe(res);
    }

    else if (href.pathname === '/module') {
      req.pipe(box.dispatch({
        acquired: JSON.parse(href.query.acquired),
        source: JSON.parse(href.query.source),
        request: JSON.parse(href.query.request)
      })).pipe(res);
    }

    else {
      blowDispatch(req, res);
    }
}).listen(11000, '0.0.0.0', function () {
  console.log('test server ready on http://localhost:11000');
});
