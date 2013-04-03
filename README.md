#modulebox

> `modulebox` creates a node.js like require system in the browser. It provides
a localized secure module environment, there allow pseudo-synchronous require
calls there don't block by resolving the dependencies tree on the fly.

> Its diffrent from most other `node.js in the browser` systems, by being backed
by a server which enables you to load modules as they become needed, instead of
loading the entire website or application at once.

**Be aware that this module do currently only works on node version `0.9` and higher.**

## Installation

```sheel
npm install modulebox
```

## Features

* Pseudo-synchronous require calls
* Customizable `require.resolve` algoritme
* Source mapping, produces accurate stack traces
* Blocking `require` fallback, if module source isn't prefetched
* Automaticly http headers and handles cache control
* Limits `require.resolve` to a designated directory
* No pre-analyzing required

## Browser support

* Chrome
* Firefox
* Opera
* Safari
* Internet Explore 9

## API documentation

The `modulebox` consists of three parts:

* A modulebox server (node.js)
* A client, creating a module environment (browser)
* The module environment (browser)

### modulebox server

The module exports a `modulebox` constructor.

```javascript
var modulebox = require('modulebox');
```

The constructor takes an settings object, with the following properties:

* `root`<sup>1</sup>: designated localized directory (default: '/'
* `modules`<sup>1</sup>: directory names of modules (default: 'node_modules')
* `allowed`<sup>1</sup>: specify basename search pattern

`[1]`: see [localizer](https://github.com/AndreasMadsen/localizer#documentation) for more details.

```javascript
var box = modulebox({
  root: path.resolve(__dirname, 'localized')
});
```

#### box.clientCore

Filepath to the uncompressed client javascript file, there will expose the
modulebox client.

```javascript
http.createServer(function (req, res) {
  var href = url.parse(req.url, true);

  if (href.pathname === '/modulebox.js') {
    req.pipe( filed(box.clientCore) ).pipe(res);
  }
});
```

#### box.dispatch(parameters)

`box.dispatch` is a `ReadStream` constructor there creates a `bundle` of module
source and `require.resolve` results. The `bundle` can be piped to any
`WriteStream`. However if piped to a HTTP stream it it will add HTTP headers,
according to the `req` stream there must also be piped intro the `bundle`.

The `parameters` object takes the following properties:

* `acquired`: an array of filepaths there contain all the already feteched modules
* `request`: an array of `require` inputs.
* `source`: filepath that the modules was requested from.

```javascript
http.createServer(function (req, res) {
  var href = url.parse(req.url, true);

  if (req.pathname === '/module') {
    var bundle = box.dispatch({
      acquired: JSON.parse(href.query.acquired),
      request: JSON.parse(href.query.request),
      source: JSON.parse(href.query.source)
    });

    req.pipe(bundle).pipe(req);
  }
});
```

### modulebox client (browser)

After the `box.clientCore` script has been loaded by the browser, the
`window.modulebox` will be available. This method is a `modulebox` constructor
there after creation exposes a way to fetch and require modules.

The `window.modulebox` constructor takes the following properties:

* `url`: (required) a function there takes three arguments (acquired, source, request)
  and return a url, there when requested will call `box.dispatch` on the server.
* `source`: This is a function there takes a filepath as an argument and return
  a modified filepath. The transformed filepath will the be used in the source mapping.
  By default this prefixes filepaths with `/modulebox/`.

```javascript
var box = window.modulebox({
  url: function (acquired, source, request) {
    return window.location.origin + '/module' +
      '?acquired=' + JSON.stringify(acquired) +
      '&source=' + JSON.stringify(source) +
      '&request' + JSON.stringify(request);
  }
});
```

#### box.require(module)

This is just like the `require` function in node.js, it returns the
`module.exports` value.

However unlike the `require` function it is not
called from a specific module but from the root as defined by the `root`
property on the server-side.

Also note that if the module wasn't prefetched by `box.require.ensure` it
will be loaded synchronously, wich will block the javascript execution in the
browser. If this is the case you will be warned by a `console.warn` call if
supported by the browser.

```javascript
var index = require('/index.js');
```

#### box.require.ensure(modules, callback)

This method will ensure that all the modules listed in the `modules` array will
be fetched.

This also includes all the deep dependencies of the `modules` as long as they
are required in the a simple string form:

```javascript
require('string');
```

This means that in the following case `string` won't be prefetched:

```javascript
var name = 'string';
require(name);
```

When done fetching the `callback` will be executed. If an error occurred the
first argument in the `callback` will become an error.

```javascript
box.require.ensure(['/index.js'], function (err) {
  if (err) return console.error(err.message);

  var index = require('/index.js');
});
```

It is important to note that resolve errors do not appear in the `error` argument,
but are throwen when `require` or `require.resolve` is called.

#### box.require.resolve(module)

This returns the filepath relative to the `root` specified on the server-side.
Note that also this method will synchronous if the module isn't already fetched.

```javascript
console.log(require.resolve('async') === '/node_modules/async/index.js');
```

### Module environment

Except for the `require.ensure` the module environment is exactly as you known
it from node.js. The following is exposed:

* `__dirname` the directory name (a unix path)
* `__filename` the filename (a unix path)
* `module` the module object, contains `exports`
* `exports` the object there is returned unless `module.exports` is used.
* `require` returns the `exports` value of another module
* `require.resolve` returns the filepath of the module.
* `require.ensure` prefetch modules.

```javascript
var dialog = require('big-box');

module.exports = function () {
  dialog('Hallo World');
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
