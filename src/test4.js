// 点描画でハマってるので実験コード

// 大丈夫ですね。pixelDensity(1)を宣言しなくてもちゃんとcoordの位置に表示されていますね。
// あっちはどうしてそうなってないんだろうね...

// --------------------------------------------------------------------------- //
// global.

const ex = p5wgex;
let _node;

// --------------------------------------------------------------------------- //
// constants.

const SIZE = 32;

// --------------------------------------------------------------------------- //
// shaders.

// attributeはindexのみ。
const colorVert =
"precision mediump float;" +
"attribute float aIndex;" +
"uniform float uSize;" + // 32.0です。
"uniform float uPointSize;" + // 暫定8.0で。
"void main(){" +
"  vec2 coord = vec2(mod(aIndex, uSize), floor(aIndex / uSize));" + // これで0～31になった。
"  coord = (coord + 0.5) / uSize;" + // これでテクスチャ座標
"  gl_Position = vec4(coord, 0.0, 1.0);" + // data.xyに位置情報が入ってるのでそこにおく。
"  gl_PointSize = uPointSize;" +
"}";

// gl_PointCoord使って円かなんかにするのがいいと思うんだけどね。
const colorFrag =
"precision mediump float;" +
"void main(){" +
"  gl_FragColor = vec4(vec3(0.0), 1.0);" + // 終了！
"}";

// --------------------------------------------------------------------------- //
// mainCode.

function setup(){
  createCanvas(640, 640, WEBGL);
  const _gl = this._renderer;
  _node = new ex.RenderNode(_gl);

  let indices = [];
  for(let i=0; i<SIZE*SIZE; i++){ indices.push(i); }

  _node.registFigure("indices", [{name:"aIndex", size:1, data:indices}]);
  _node.registPainter("color", colorVert, colorFrag);
}

function draw(){
  _node.clear();

  _node.use("color", "indices");
  _node.setUniform("uSize", SIZE);
  _node.setUniform("uPointSize", 8.0);
  _node.drawArrays("points");
  _node.unbind();
  _node.flush();

  noLoop();
}
