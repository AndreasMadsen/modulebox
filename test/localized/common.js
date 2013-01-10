/* common.js */
if (typeof global.commonLoaded === 'undefined') {
  global.commonLoaded = 0;
}

global.commonLoaded += 1;

module.exports = global.commonLoaded;
/* end */