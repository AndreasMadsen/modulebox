
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

blow(files, {
  address: 'localhost',
  port: 11000,
  index: indexFile,
  style: 'bdd'
});

//
// Setup moduel server
//

var box = modulebox({
  root: path.resolve(__dirname, '..', 'localized'),

  modules: 'modules'
});

http.createServer(function (req, res) {
    var href = url.parse(req.url, true);

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (href.pathname === '/core.js') {
      req.pipe( filed(box.clientCore) ).pipe(res);
    } else if (href.pathname === '/module') {
      box.dispatch({
        acquired: JSON.parse(href.query.acquired),
        source: JSON.parse(href.query.source),
        request: JSON.parse(href.query.request)
      }).pipe(res);
    } else {
      res.statusCode = 404;
      res.end();
    }
}).listen(17000, 'localhost', function () {
  console.log('module server ready on http://localhost:17000');
});
