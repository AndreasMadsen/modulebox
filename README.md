#modulebox

> `modulebox` creates a node.js like require system in the browser. It provides
a localized secure module environment, there allow pseudo-synchronous require
calls there don't block by resolving the dependencies tree on the fly.

> It is diffrent from most other `node.js in the browser` systems, by being backed
by a server which enables you to load modules as they become needed, instead of
loading the entire website or application at once.

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

## Example

**server.js**

```javascript
var http = require('http');
var modulebox = require('modulebox');

// You should have a directory where all your client modules are, in this case
//  it is `__dirname + '/secure'`. This directory will serve as a fake root
//  from which filepaths are calculate.
var box = modulebox({
  root: __dirname + '/secure'
});

// Next you create a simple server
var server = http.createServer(function (req, res) {
  // Usually you would have a router where you check for /modulebox/
  if (req.url.slice(0, 11) === '/modulebox/') {
    box.dispatch(req, res);
  } else {
    // Do your usual stuff, such as serving `index.html?
  }
});
```

**index.html**

```html
<html>
  <!-- this script sets window.modulebox -->
  <script src="/modulebox/core.js"></script>
  <script>(function () {
    // you should then create a box object
    var box = window.modulebox();

    // `box` provides you with `require`, `require.resolve` and `requre.ensure`
    //  the last is important since it loads modules asynchronously
    box.require.ensure(['/module_1.js', '/module_2.js'], function (err) {
      if (err) throw err;

      // Now that the `module_1.js` and `module_1.js` and all their dependencies
      //  are loaded you can use `box.require` without doing a synchronously XHR.
      box.require('/module_1.js');
      box.require('/module_2.js');
    });
  })();</script>
</html>
```

**__dirname + '/secure/module_1.js'**

```javascript
// within your modules `require`, `module`, `exports`, __dirname, __filename
//  are defined and `require` calles will already be loaded.
var realmodule = require('realmodule');

// You can also loadd modules asynchronously with `require.ensure`
require.ensure(['anothermodule'], function (err) {
  if (err) throw err;
});
```

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

* `root`: designated secure directory (default: '/')
* `modules`: directory name of modules (default: 'node_modules')
* `allowed`: specify basename search pattern
* `special`: an object mapping module names to files, only required if you want core modules

See [localizer](https://github.com/AndreasMadsen/localizer#documentation) for more details
on `root`, `modules` and `allowed`.

```javascript
var builtins = require('browser-builtins');
var box = modulebox({
  root: path.resolve(__dirname, 'secure'),
  special: builtins
});
```

#### box.dispatch(req, res)

`box.dispatch` is a method there will read the query parameters of `req.url`
defined by the client and send the requested module or send the `core.js` file.
It will also take care of cache control headers such as `etag` and `last-modified`.

```javascript
http.createServer(function (req, res) {
  if (req.url.slice(0, 11) === '/modulebox/') {
    box.dispatch(req, res);
  }
});
```

### modulebox client (browser)

After the `core.js` script has been loaded by the browser, the `window.modulebox`
will be available. This method is a `modulebox` constructor there after initializing
exposes a way to fetch and require modules.

The `window.modulebox` constructor takes the following properties:

* `baseUrl`: the url to send module requests (default: 'http(s)://{host}/modulebox/')
* `sourcePath`: the pathname modules will be in the source map (default '/modulebox/files/');

```javascript
var box = window.modulebox({
  baseUrl: window.location.protocol + '//' + window.location.host + '/base/',
  sourcePath: '/modules/'
});
```

#### box.require(module)

This is just like the `require` function in node.js, it returns the
`module.exports` value.

However unlike the `require` function it is not called from a specific module
but from the root as defined by the `root` property on the server-side.

Also note that if the module wasn't prefetched with `box.require.ensure` it
will be loaded synchronously, which will block the javascript execution in the
browser. If this is the case you will be warned by a `console.warn` call (if
supported by the browser).

```javascript
var index = require('/index.js');
```

#### box.require.ensure(modules, callback)

This method will ensure that all the modules listed in the `modules` array and
their dependencies will be fetched.

It is worth noteing that dependencies must be defined reasonably clearly, like:

```javascript
require('string');
```

_You can check the [detective](https://github.com/substack/node-detective) module
for more information on the allowed syntaxes._

When done fetching the `callback` will be executed. If an error occurred the
first argument in the `callback` will become an `Error` otherwise its `null`.

```javascript
box.require.ensure(['/index.js'], function (err) {
  if (err) return console.error(err.message);

  var index = require('/index.js');
});
```

It is important to note that resolve errors do not appear in the `error` argument,
but are throwen when `require` or `require.resolve` is called just like in node.js.

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
