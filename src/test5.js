// フレームバッファアニメの復習もかねてESSL300で描いてみる
// それとgl_VertexIDを使ってみましょう。どうせだから。

// いろいろごたごたあったけどメインシェーダは（gl_PointSize=1.0;以外）完全に合ってたし。
// 自信もっていいと思う。webgl2機能多いし、webgl1であってもやってない仕様いっぱいあるし。
// ゆっくり行こー

// だめですね。
// ただこれをコピペを繰り返して直してしまうと
// 学びが何にもないから
// だめなんですよ。

// ----------------------------------------------------------------------------------------- //
// global.

const ex = p5wgex;
let _node;

// ----------------------------------------------------------------------------------------- //
// constants.

const SIZE = 32;

// ----------------------------------------------------------------------------------------- //
// shaders.

// データステージ。ここでは32x32個のvec4を用意された32x32のフレームバッファに放り込みます。
const dataVert =
`#version 300 es
precision mediump float;
in vec4 aData;
in float aIndex;
out vec4 vData;
uniform float uSize;
void main(){
  vec2 p = vec2(mod(aIndex, uSize), floor(aIndex / uSize)) + 0.5;
  p /= uSize;
  p = (p - 0.5) * 2.0;
  gl_Position = vec4(p, 0.0, 1.0);
  vData = aData;
}
`;

const dataFrag =
`#version 300 es
precision mediump float;
in vec4 vData;
out vec4 pv;
void main(){
  pv = vData;
}
`;

const colorVert =
`#version 300 es
precision mediump float;
in float aIndex;
uniform float uSize;
uniform float uPointSize;
uniform sampler2D uTex;
void main(){
  vec2 p = vec2(mod(aIndex, uSize), floor(aIndex / uSize)) + 0.5;
  p /= uSize;
  vec4 data = texture(uTex, p);
  gl_Position = vec4(data.xy, 0.0, 1.0);
  gl_PointSize = uPointSize;
}
`;

const colorFrag =
`#version 300 es
precision mediump float;
out vec4 color;
void main(){
  color = vec4(1.0);
}
`

// ----------------------------------------------------------------------------------------- //
// main code.

function setup(){
  createCanvas(640, 640, WEBGL);
  const _gl = this._renderer;
  _node = new ex.RenderNode(_gl);

  // Painter.
  _node.registPainter("data", dataVert, dataFrag);
  //_node.registPainter("update", updateVert, updateFrag);
  _node.registPainter("color", colorVert, colorFrag);

  // Figure.
  let indexArray = [];
  let dataArray = [];
  for(let i = 0; i < SIZE*SIZE; i++){
    const x = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const y = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const _speed = 0.002 + 0.01 * Math.random();
    const _direction = Math.PI * 2.0 * Math.random();
    dataArray.push(x, y, _speed * Math.cos(_direction), _speed * Math.sin(_direction));
    indexArray.push(i);
  }
  _node.registFigure("data", [{name:"aData", size:4, data:dataArray}, {name:"aIndex", size:1, data:indexArray}]);
  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1, -1, 1, -1, -1, 1, 1, 1]}]);
  _node.registFigure("indices", [{name:"aIndex", size:1, data:indexArray}]);

  _node.registDoubleFBO("sprites", {w:SIZE, h:SIZE, textureType:"float"});

  _node.clearColor(0, 0, 0, 1);

  // データ入力
  _node.bindFBO("sprites");
  _node.use("data", "data");
  _node.setUniform("uSize", SIZE);
  _node.drawArrays("points");
  _node.swapFBO("sprites");
  _node.unbind();
}

// 同じものをコピーしたいわけじゃないんです。300esを試したいだけなんです。だからコピペして終わりじゃないんです。
// たとえて言うなら模写をコンビニのコピーで済ますようなもので、無意味です。
function draw(){
  // 点描画
  _node.bindFBO(null);
  _node.clear();
  _node.use("color", "indices");
  _node.setFBOtexture2D("uTex", "sprites");
  _node.setUniform("uSize", SIZE);
  _node.setUniform("uPointSize", 16.0);
  _node.drawArrays("points");
  _node.unbind();
  _node.flush();
}
