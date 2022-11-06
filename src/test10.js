// ウォーミングアップ
// これをやります。
// https://qiita.com/inaba_darkfox/items/6894b4fd54a9dacacf96
// グラデーション背景に狐の絵文字のポイントスプライトを1つ。それだけ。

// おかしいね...白い輪郭...何で。あっちのが綺麗なんだろ。何で？？

// blendをone one_minus_src_alphaにしました。
// それだとsrc_alphaが0のときにsrcのrgbが影響しちゃうよ...もっとちゃんと考えて...
// というわけで正解はsrc_alpha, one_minus_src_alphaですね。
// 要するにsrcのalphaで補間を取ってるだけ。

// あとgl_PointSizeについてもはっきりさせておこう。
// これは要するに最終的にdrawingBufferに行った時の、その点を中心とする正方形の一辺の長さのようですね。
// だから400にするとこれpixelDensity(1)でしょう。だから800x800において400x400だから半分になるわけよ。
// 200なら1/4ってわけ。それを指定してる。
// じっさいは然るべくラスタライズしてると思うけれど...

// だから例えばデータ格納の時とか、ここを1にしないと、ちゃんとそのマスにダイレクトで値が格納されないわけなのね。

// 早くテストしよう。

// 20221026
// CopyPainterにGradation実装したのでちょっと書き換えました。
// 汚くなってたらごめんなさいね。

// ---global
const ex = p5wgex;
let _node;
//let bgTex, foxTex;

// ---shaders
// いつものcopy.

// 点描画
const pointVert =
`#version 300 es
in vec3 aPosition;
void main(){
  gl_Position = vec4(aPosition, 1.0);
  gl_PointSize = 400.0; // どうも直径...の、2倍...？じゃないな。直径のpixelDensity倍だ。
}
`;

const pointFrag =
`#version 300 es
precision highp float;
out vec4 color;
uniform sampler2D uTex;
void main(){
  vec2 uv = gl_PointCoord.xy;
  vec4 col = texture(uTex, uv);
  if(col.a < 1.0 / 255.0){ discard; }
  color = col;
}
`;

// ---setup
function setup(){
  createCanvas(400, 400, WEBGL);
  const _gl = this._renderer;
  _node = new ex.RenderNode(_gl.GL);

  //_node.registPainter("bg", copyVert, copyFrag);
  //_node.registFigure("board", [{name:"aPosition", size:2, data:[-1,-1,1,-1,-1,1,1,1]}]);
  _node.registPainter("point", pointVert, pointFrag);
  _node.registFigure("fox", [{name:"aPosition", size:3, data:[0,0,0]}]);

  const bg = createGraphics(400, 400);

  /*
  bg.noStroke();
  for(let i = 0; i < 400; i++){
    bg.fill(i*255/400);
    bg.rect(0, i, 400, 1);
  }
  */

  const fox = createGraphics(64, 64);
  fox.textSize(32);
  fox.textAlign(CENTER, CENTER);
  fox.text("🦊", 32, 32);

  _node.registTexture("bg", {src:bg});
  _node.registTexture("fox", {src:fox});

  // 点の最大ピクセル数をコンソールに出力
  // 調べたところ1～1024ですね。てか、何の数字？？
  const pointSizeRange = _gl.GL.getParameter(_gl.GL.ALIASED_POINT_SIZE_RANGE);
  console.log('pointSizeRange:' + pointSizeRange[0] + ' to ' + pointSizeRange[1]);

  _node.clearColor(0,0,0,0);
}

// ---draw
function draw(){
  _node.clear();

  //ex.copyProgram(_node, null, "bg");
  ex.copyPainter(_node, {src:{name:"bg", gradationFlag:1, gradationStart:[0,0,0,0,0,1], gradationStop:[0,1,1,1,1,1]}});

  _node.enable("blend")
       .blendFunc("src_alpha", "one_minus_src_alpha");

  _node.use("point", "fox")
       .setTexture2D("uTex", "fox")
       .drawArrays("points")
       .unbind()
       .flush();

  _node.disable("blend");
}
