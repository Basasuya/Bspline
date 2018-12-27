const ndarray = require('ndarray');
let pool = require('typedarray-pool');

class Bspline{
    constructor(points, weights, degree, boundary) {
        this.points = points;
        this.weights = weights;
        this.degree = degree;
        this.boundary = boundary;
        this.splineDimension = this.points.shape.length - 1;
        this.dimension = this.points.shape[this.points.shape.length - 1];
    }
    domain(){
        var sizeArray;
        var ret = [];

        // If the reference to size is hard-coded, then the size cannot change, or
        // if you change points manually (like by appending a point) without re-running
        // the constructor, then it'll be incorrect. This aims for middle-ground
        // by querying the size directly, based on the point data type
        //
        // A pointer to the point array-of-arrays:
        var ptr = this.points;

        sizeArray = ptr.shape;


        for (var d = 0; d < this.splineDimension; d++) {
          var size = sizeArray ? sizeArray[d] : ptr.length;
          var p = this.degree[d];
          var isClosed = this.boundary[d] === 'closed';

          if (this.knots && this.knots[d]) {
            var k = this.knots[d];
            ret[d] = [k[isClosed ? 0 : p], k[size]];
          } else {
            ret[d] = [isClosed ? 0 : p, size];
          }

          // Otherwise if it's an array of arrays, we get the size of the next
          // dimension by recursing into the points
          if (ptr) ptr = ptr[0];
        }
        return ret;
      }

    evaluate (out, t0, t1, derivative) {
        var h, m, a, b;
        var size0 = this.points.shape[0];
        var size1 = this.points.shape[1];
        var xData = this.points.data;
        var xOffset = this.points.offset;
        var xStride0 = this.points.stride[0];
        var xStride1 = this.points.stride[1];
        var xStride2 = this.points.stride[2];
        var wData = this.weights.data;
        var wOffset = this.weights.offset;
        var wStride0 = this.weights.stride[0];
        var wStride1 = this.weights.stride[1];
        var degree = this.degree;

        var knotIndex = new Array();
        knotIndex[0] = (t0 | 0) % size0;
        knotIndex[1] = (t1 | 0) % size1;
        var t = [t0, t1];
        var size = [size0, size1];


		    var k = new Array();
        for(var i = 0; i < 2; ++i) {
            k[i] = new Array();
            for(var j = 0; j < degree[i] * 2; ++j) {
                k[i][j] = knotIndex[i] + j + 1 - degree[i]
            }
        }

        t[0] %= size[0];
        t[1] %= size[1];

        var w = new Array();
        for(var i = 0; i <= degree[0]; ++i) {
            w[i] = new Array();
            for(var j = 0; j <= degree[1]; ++j) {
              w[i][j] = wData[wOffset + wStride0 * ((knotIndex[0] + i - degree[0] + size[0]) % size[0]) +
                wStride1 * ((knotIndex[1] + j - degree[1] + size[1]) % size[1])];
            }
        }

        var x = new Array();

        for(var i = 0; i <= degree[0]; ++i) {
            x[i] = new Array();
            for(var j = 0; j <= degree[1]; ++j) {
              x[i][j] = new Array();
              for(var z = 0; z <= 2; ++z) {
                  x[i][j][z] = xData[xOffset + xStride0 * ((knotIndex[0] + i - degree[0] + size[0]) % size[0]) + xStride1 *
                  ((knotIndex[1] + j - degree[1] + size[1]) % size[1]) + xStride2 * z] * w[i][j];
              }
            }
        }


        for(var i = 0; i < degree[1]; ++i) {
            for(var j = i + 1; j <= degree[1]; ++j) {
                var isDerivative = derivative !== undefined && derivative !== null && (degree[1] - j - derivative[1] < 0)
                if(isDerivative) {
                    var m = 1 / (k[1][j + degree[1] - 1] - k[1][j - 1])
                    var a = (t[1] - k[1][j - 1]) * m;
                    var b = 1 - a;
                    var h = w[degree[0]][j];
                    for(var l = 0; l <= degree[0]; ++l) {
                        w[l][j] = b * w[l][j - 1] + a * w[l][j];
                        for(var z = 0; z <= 2; ++z) {
                            x[l][j][z] = degree[1] * h * w[l][j - 1] / w[l][j] * (x[l][j][z] / h - x[l][j - 1][z] / w[l][j-1]) * m;
                        }
                    }
                } else {
                    var a = (t[1] - k[1][j - 1]) / (k[1][j + degree[1] - 1] - k[1][j - 1]);
                    var b = 1 - a;
                    for(var l = 0; l <= degree[0]; ++l) {
                        w[l][j] = b * w[l][j - 1] + a * w[l][j];
                        for(var z = 0; z <= 2; ++z) {
                            x[l][j][z] = b * x[l][j - 1][z] + a * x[l][j][z];
                        }
                    }
                }
            }
        }


        for(var i = 0; i < degree[0]; ++i) {
            for(var j = i + 1; j <= degree[0]; ++j) {
                var isDerivative = derivative !== undefined && derivative !== null && (degree[0] - j - derivative[0] < 0)
                if(isDerivative) {
                    var m = 1 / (k[0][j + degree[0] - 1] - k[0][j - 1]);
                    var a = (t[0] - k[0][j - 1]) * m;
                    var b = 1 - a;
                    var s = degree[1];
                    var h = w[j][degree[1]];
                    w[j][s] = b * w[j - 1][s] + a * w[j][s];
                    for(var z = 0; z <= 2; ++z) {
                        x[j][s][z] = degree[0] * h * w[j - 1][s] / w[j][s] * (x[j][s][z] / h - x[j - 1][s][z] / w[j-1][s]) * m;
                    }
                } else {
                    var a = (t[0] - k[0][j - 1]) / (k[0][j + degree[0] - 1] - k[0][j - 1]);
                    var b = 1 - a;
                    var s = degree[1];
                    w[j][s] = b * w[j - 1][s] + a * w[j][s];
                    for(var z = 0; z <= 2; ++z) {
                        x[j][s][z] = b * x[j - 1][s][z] + a * x[j][s][z];
                    }
                }
            }
        }

        for(var i = 0; i < 3; ++i) {
            out[i] = x[degree[0]][degree[1]][i] / w[degree[0]][degree[1]]
        }
        return out;
    }

};

module.exports = Bspline;
