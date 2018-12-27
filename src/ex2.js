const glsl = require('glslify');
const ndarray = require('ndarray');
const pack = require('ndarray-pack');
const unpack = require('ndarray-unpack');
const Bspline = require('./Bspline.js');
const wireframe = require('screen-projected-lines');
const controlPanel = require('control-panel');
const sample = require('./sample');
const hull = require('./hull');

const codeDiv = document.createElement('div');
document.body.appendChild(codeDiv);

codeDiv.style.maxHeight = '60%';
codeDiv.style.position = 'absolute';
codeDiv.style.right = 0;
codeDiv.style.bottom = 0;
codeDiv.style.zIndex = 10;
codeDiv.style.backgroundColor = 'white';
codeDiv.style.padding = '10px';
codeDiv.style.overflow = 'auto';
codeDiv.style.fontSize = '9px';


var error = document.createElement('span');
error.style.color = '#cc3333';
error.style.fontFamily = 'sans-serif';
error.style.fontStyle = 'italic';
error.style.position = 'absolute';
error.style.left = '10px';
error.style.bottom = '10px';
error.style.zIndex = '1';

const showError = str => (error.textContent = str);
const clearError = () => (error.textContent = '');
document.body.appendChild(error);

require('regl')({
  onDone: require('fail-nicely')(run),
  pixelRatio: Math.min(window.devicePixelRatio, 1.5),
  attributes: {
    antialias: true,
    alpha: false
  }
});

function run (regl) {
  var i, j;

  const camera = require('./regl-camera')(regl, {
    phi: 0.5,
    theta: 0.2,
    damping: 0,
    distance: 15,
    noScroll: true
  });
  const model = {
    points: pack([ 	[ [0, 0, -1], 	[1, 0, 0], 	[2, 0, 0], 	[3, 0, 0] , 	[4, 0, 0], [5, 0, 0] ],
						[ [0, -1, 0], 	[1, -1, 1], 	[2, -1, 1], 	[3, -1, 0] , [4, -1, 0], [5, -1, 0]	],
						[ [0, -2, 0], 	[1, -2, 1], 	[2, -2, 1], 	[3, -2, 0] , [4, -2, -0.2], [5, -2, -1.2] 	],
						[ [0, -3, 0], 	[1, -3, 0], 	[2, -3, -2.3], 	[3, -3, 0] , [4, -3, 0], [5, -3, 0] ],
						[ [0, -4, 0], 	[1, -4, 0], 	[2, -4, 0], 	[3, -4, 4] , [4, -4, -2], [5, -4, 0]  ],
						[ [0, -5, 1.2], [1, -5, 0], 	[2, -5, 2], 	[3, -5, 0] , [5, -5, -1], [5, -5, -1.5]]]),
    weights: pack([
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
    ]),
    boundary: ['closed', 'closed'],
    degree: [5, 5],
  };

  var controlPositionBuffer, flatPositions, surface;
  var normalBuffer, positionBuffer, cellBuffer;
  var wireframePositionBuffer, wireframeNextBuffer;
  var wireframeDirectionBuffer, wireframeCellBuffer;

  const state = {
    hull: true,
  };
  var mesh = {};
  var hullMesh = {};

  function remesh () {
    var i;

    var ndControlPoints = model.points;
    flatPositions = unpack(ndarray(ndControlPoints.data, [ndControlPoints.shape[0] * ndControlPoints.shape[1], ndControlPoints.shape[2]]));
    controlPositionBuffer = (controlPositionBuffer || regl.buffer)(flatPositions);

    surface = new Bspline(model.points, model.weights, model.degree, model.boundary);


    sample(mesh, surface);
    normalBuffer = (normalBuffer || regl.buffer)(mesh.normals);
    positionBuffer = (positionBuffer || regl.buffer)(mesh.positions);
    cellBuffer = (cellBuffer || regl.elements)(mesh.cells);

    var hullWireframe = wireframe(hull(hullMesh, surface));

    wireframePositionBuffer = (wireframePositionBuffer || regl.buffer)(hullWireframe.positions);
    wireframeNextBuffer = (wireframeNextBuffer || regl.buffer)(hullWireframe.nextPositions);
    wireframeDirectionBuffer = (wireframeDirectionBuffer || regl.buffer)(hullWireframe.directions);
    wireframeCellBuffer = (wireframeCellBuffer || regl.elements)(hullWireframe.cells);
  }

  remesh();

  var drawHull = regl({
    vert: glsl`
      #pragma glslify: linevoffset = require('screen-projected-lines')
      precision mediump float;
      uniform mat4 projection, view;
      uniform float aspect, pixelRatio;
      attribute vec3 position, nextpos;
      attribute float direction;
      void main () {
        mat4 proj = projection * view;
        vec4 p = proj * vec4(position,1);
        vec4 n = proj * vec4(nextpos,1);
        vec4 offset = linevoffset(p, n, direction, aspect);
        gl_Position = p + offset * 0.002 * pixelRatio * p.z;
      }
    `,
    frag: `
      precision mediump float;
      void main () {
        gl_FragColor = vec4(0, 0.3, 0.3, 0.3);
      }
    `,
    attributes: {
      position: wireframePositionBuffer,
      nextpos: wireframeNextBuffer,
      direction: wireframeDirectionBuffer
    },
    blend: {
      enable: true,
      equation: {
        rgb: 'add',
        alpha: 'add'
      },
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 'src alpha',
        dstRGB: 'one minus src alpha',
        dstAlpha: 'one minus src alpha'
      }
    },
    elements: wireframeCellBuffer,
    uniforms: {
      aspect: ctx => ctx.viewportWidth / ctx.viewportHeight,
      pixelRatio: regl.context('pixelRatio')
    }
  });

  var drawPoints = regl({
    vert: `
      precision mediump float;
      uniform mat4 projection, view;
      uniform float pixelRatio;
      attribute vec3 position;
      void main () {
        gl_Position = projection * view * vec4(position, 1);
        gl_PointSize = 9.0 * pixelRatio;
      }
    `,
    frag: `
      precision mediump float;
      void main () {
        vec2 uv = gl_PointCoord.xy - 0.5;
        if (dot(uv, uv) > 0.25) discard;
        gl_FragColor = vec4(0, 0.5, 1, 1);
      }
    `,
    attributes: {position: controlPositionBuffer},
    uniforms: {pixelRatio: regl.context('pixelRatio')},
    primitive: 'points',
    count: () => state.uPoints * state.vPoints
  });

  var drawSurface = regl({
    vert: `
      precision mediump float;
      uniform mat4 projection, view;
      attribute vec3 position, normal;
      varying vec3 n;
      void main () {
        n = normal;
        gl_Position = projection * view * vec4(position, 1);
      }
    `,
    frag: `
      precision mediump float;
      varying vec3 n;
      void main () {
        gl_FragColor = vec4(0.5 + 0.5 * normalize(n), 1);
      }
    `,
    attributes: {
      position: positionBuffer,
      normal: normalBuffer
    },
    elements: cellBuffer
  });

  regl.frame(() => {
    camera(({dirty}) => {
      if (!dirty) return;
      regl.clear({color: [1, 1, 1, 0]});
      drawSurface();
      if (state.hull) {
        drawHull();
        drawPoints();
      }
    });
  });

  window.addEventListener('resize', camera.taint, false);
}
