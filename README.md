#modulebox

> `modulebox` creates a node.js like require system. It provides a
localized module environment, there allow asynchronous and synchronous require
calls from the client.

**Work In Progress**

## Installation

```sheel
npm install modulebox
```

## API documentation

The `modulebox` consists of three parts:

* A module request handler (node.js)
* A client creating a module environment (browser)
* The module environment (browser)

### Request handler (node.js)

**./server.js** file

```javascript
var http = require('http');
var path = require('path');
var filed = require('filed');
var modulebox = require('modulebox');

var box = modulebox({
  root: path.resolve(__dirname, './localized/')
});

http.createServer(function (req, res) {
    var href = url.parse(req.url, true);

    if (href.pathname === '/core.js') {
      req.pipe( filed(box.clientCore) ).pipe(res);
    } else if (req.pathname === '/module') {
      req.pipe( box.dispatch(href.query) ).pipe(req);
    } else {
      /*
       * standard request handler, should request the clientCore
       * and the some initializer.js
       */
    }
}).listen();
```

### Module client (browser)

**./initalizer.js** file

```javascript
(function () {
  var box = window.modulebox({
    url: function (acuried, source, request) {
      return window.location.origin + '/module' +
        '?acuried=' + acuried +
        '&source=' + source +
        '&request' + request;
    }
  });

  // You only need to require modules asynchronously if they are not defined
  // in a simple `require('string')` format within the `root` directory.
  box.require('/index.js', function (err, index) {
    if (err) return alert('request failure: ' + err.message);

    index();
  });
})();
```

### Module environment

**./localized/index.js**

```javascript
var another = require('another-module');

module.exports = function () {
  alert('Everybody loves alerts!');
};
```

## License

**The software is license under "MIT"**

> Copyright (c) 2013 Andreas Madsen
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
> THE SOFTWARE.
