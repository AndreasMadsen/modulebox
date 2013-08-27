
// At this point module.exports hasn't been set, so the default `exports` object
// is returned
var a = require('./circle_a.js');

module.exports = function b() {
  return a.toString();
};
