/* index.js */
require('./common.js');
require('/common.js');
require('./common_require.js');
require('/common_require.js');

require('missing.js');

exports.common = require('./common');
exports.simple = require('simple');
/* end */