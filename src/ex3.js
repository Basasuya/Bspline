const Bspline = require('./Bspline.js');
const pack = require('ndarray-pack');
const unpack = require('ndarray-unpack');
var curve = new Bspline(
    pack([
      [[0, 2, 3], [4, 5, 6], [7, 8, 9]],
      [[1, 2, 2], [1, 2, 3], [4, 5, 6]],
      [[1, 2, 2], [1, 2, 3], [4, 5, 6]],
      [[1, 2, 2], [1, 2, 3], [4, 5, 6]],
    ]),
    pack([
      [2, 1, 1],
      [2, 2, 1],
      [2, 3, 1],
      [2, 2, 1]
    ]),
    [3, 2],
    ['closed', 'closed']
  );
  
  console.log(curve.evaluate([], 0.5, 0.5));