// 点描画でハマってるので実験コード

// 大丈夫ですね。pixelDensity(1)を宣言しなくてもちゃんとcoordの位置に表示されていますね。
// あっちはどうしてそうなってないんだろうね...
// 原因判明しました。drawingBufferWidthとdrawingBufferHeightを使うのですね。

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
  const gl = _gl.GL;
  _node = new ex.RenderNode(_gl);

  let indices = [];
  for(let i=0; i<SIZE*SIZE; i++){ indices.push(i); }

  _node.registFigure("indices", [{name:"aIndex", size:1, data:indices}]);
  _node.registPainter("color", colorVert, colorFrag);

  // ここでやっちゃいましょう。
  // ごめんこの数字使わないわ
  // マジックナンバーだと危険が多いので
  cl("float", gl.FLOAT); // 5126
  cl("half_float", gl.HALF_FLOAT); // 5131
  cl("ubyte", gl.UNSIGNED_BYTE); // 5121
  cl("uint", gl.UNSIGNED_INT); // 5125
  cl("rgba16f", gl.RGBA16F); // 34842
  cl("rgba32f", gl.RGBA32F); // 34836
  cl("short", gl.SHORT); // 5122
  cl("ushort", gl.UNSIGNED_SHORT); // 5123
  cl("int", gl.INT); // 5124
  console.log("-------------------------------");
  cl("linear", gl.LINEAR); // 9729
  cl("nearest", gl.NEAREST); // 9728
  cl("repeat", gl.REPEAT); // 10497
  cl("mirror", gl.MIRRORED_REPEAT); // 33648
  cl("clamp", gl.CLAMP_TO_EDGE); // 33071
  console.log("-------------------------------");
  cl("points", gl.POINTS); // 0
  cl("lines", gl.LINES); // 1
  cl("line_loop", gl.LINE_LOOP); // 2
  cl("line_strip", gl.LINE_STRIP); // 3
  cl("triangles", gl.TRIANGLES); // 4
  cl("triangle_strip", gl.TRIANGLE_STRIP); // 5
  cl("triangle_fan", gl.TRIANGLE_FAN); // 6
  console.log("-------------------------------");
  cl("one", gl.ONE); // 1
  cl("zero", gl.ZERO); // 0
  cl("src_color", gl.SRC_COLOR); // 768
  cl("dst_color", gl.DST_COLOR); // 774
  cl("one_minus_src_color", gl.ONE_MINUS_SRC_COLOR); // 769
  cl("one_minus_dst_color", gl.ONE_MINUS_DST_COLOR); // 775
  cl("src_alpha", gl.SRC_ALPHA); // 770
  cl("dst_alpha", gl.DST_ALPHA); // 772
  cl("one_minus_src_alpha", gl.ONE_MINUS_SRC_ALPHA); // 771
  cl("one_minus_dst_alpha", gl.ONE_MINUS_DST_ALPHA); // 773
  console.log("-------------------------------");
  cl("blend", gl.BLEND); // 3042
  cl("cull_face", gl.CULL_FACE); // 2884
  cl("depth_test", gl.DEPTH_TEST); // 2929
  cl("stencil_test", gl.STENCIL_TEST); // 2960
  console.log("-------------------------------");
  cl("front", gl.FRONT); // 1028
  cl("back", gl.BACK); // 1029
  cl("front_and_back", gl.FRONT_AND_BACK); // 1032
}

function cl(name, num){
  console.log(name + ":" + num);
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
