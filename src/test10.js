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

// ---global
const ex = p5wgex;
let _node;
let bgTex, foxTex;

// ---shaders
// いつものcopy.
const copyVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = (aPosition + 1.0) * 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const copyFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 color;
void main(){
  color = texture(uTex, vUv);
}
`;

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

  _node.registPainter("bg", copyVert, copyFrag);
  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1,-1,1,-1,-1,1,1,1]}]);
  _node.registPainter("point", pointVert, pointFrag);
  _node.registFigure("fox", [{name:"aPosition", size:3, data:[0,0,0]}]);

  bg = createGraphics(400, 400);
  bg.noStroke();
  for(let i = 0; i < 400; i++){
    bg.fill(i*255/400);
    bg.rect(0, i, 400, 1);
  }

  fox = createGraphics(100, 100);
  fox.textSize(50);
  fox.textAlign(CENTER, CENTER);
  fox.text("🦊", 50, 50);

  bgTex = new p5.Texture(_gl, bg);
  foxTex = new p5.Texture(_gl, fox);

  // 点の最大ピクセル数をコンソールに出力
  // 調べたところ1～1024ですね。てか、何の数字？？
  const pointSizeRange = _gl.GL.getParameter(_gl.GL.ALIASED_POINT_SIZE_RANGE);
  console.log('pointSizeRange:' + pointSizeRange[0] + ' to ' + pointSizeRange[1]);

  _node.clearColor(0,0,0,0);
}

// ---draw
function draw(){
  _node.clear();

  _node.use("bg", "board")
       .setTexture2D("uTex", bgTex.glTex)
       .drawArrays("triangle_strip")
       .unbind();

  _node.enable("blend")
       .blendFunc("src_alpha", "one_minus_src_alpha");

  _node.use("point", "fox")
       .setTexture2D("uTex", foxTex.glTex)
       .drawArrays("points")
       .unbind()
       .flush();

  _node.disable("blend");
}
