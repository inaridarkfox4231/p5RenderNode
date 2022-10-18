// テストコード。とりあえずシェーダー用意してね。

// はぁーどこまでいけるのやら。

// 何から実験しよう。ドローコール？か。とりあえず。

// 20220927
// ESSL300で書いてみました。いい感じですね。
// 1行目に#version 300 esを持ってくればOKのようです。
// attributeは廃止で、inでいいみたい。vertexShaderでしか使わないので後述の問題は発生しない。
// というのは、varyingが廃止、というか使用は任意で、vertexShaderでinで宣言し、
// fragmentShaderでoutで宣言すると呼応してつながる仕組みになったのです。分かりやすいですね。
// さらにgl_FragColorも廃止で、fragmentShaderでout vec4で宣言したものに放り込めばいいみたいです。
// またtexture2Dとかは不要でtextureとだけ書けば勝手に判断してくれると。

// 他にもいろいろあるんですけどね...試してる時間が...まあぼちぼち、って感じで。texelFetchとか気になるのよ。
// あとはビット演算ができるのとか勾配関数とかも。ブレンドのMINとMAXも気になる...あ、shader関係ないわ。

// 20221003
// バーテックスシェーダは精度修飾子要らないとのこと...
// そしてフラグメント側はもうhighpで統一して良さそうな感じです。

// 20221018
// Hello! もう2週間か。
// Texture整備できたので帰ってきました。
// copyProgram作りました。これで...まあ、自由です。色々と。

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.

// ------------------------------------------------------------------------------------------------------------ //
// main code.

function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // defaultPainter...

  // テスト用背景
  const bg = createGraphics(width, height);
  bg.noStroke();
  for(let i=0; i<height; i++){
    bg.fill(0, 0, i*255/height);
    bg.rect(0, i, width, 1);
  }
  bg.fill(255);
  bg.textAlign(CENTER, CENTER);
  bg.textSize(min(width,height)*0.05);
  bg.text("welcome to webgl2", width*0.5, height*0.5);
  //bgTex = new p5.Texture(_gl, bg);
  _node.registTexture("bg", {src:bg}); // 簡単でしょ？wとhすら不要。

  _node.clearColor(0, 0, 0, 0);
}

function draw(){
  // ごくごく普通の板ポリ芸
  _node.clear();
  ex.copyProgram(_node, null, "bg");
  _node.flush();
}

/*
// ------------------------------------------------------------------------------------------------------------ //
// shader.

// copy. 2D背景付けたい場合にどうぞ。
// 内容的には板ポリ使って画面全体を覆う感じ。
const copyVert =
"precision mediump float;" +
"attribute vec2 aPosition;" +
"varying vec2 vUv;" +
"void main () {" +
"  vUv = aPosition * 0.5 + 0.5;" +
"  vUv.y = 1.0 - vUv.y;" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

const copyFrag =
"precision highp float;" +
"precision highp sampler2D;" +
"varying vec2 vUv;" +
"uniform sampler2D uTex;" +
"void main () {" +
"  gl_FragColor = texture2D(uTex, vUv);" +
"}";

// webgl2なのでESSL300で書いてみる。
// 見ての通り、バージョン指定は1行目なら問題ないみたいです。
let copyVertw2 =
`#version 300 es

in vec2 aPosition;
out vec2 vUv; // vertexStageのvaryingはoutで、

void main(void){
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// texture関数はtexture2Dとか不要で、textureとだけ書けば勝手に判断してくれるようですね...
let copyFragw2 =
`#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv; // fragmentStageのinと呼応するシステム。vertexStageのinはattributeなので
uniform sampler2D uTex;
out vec4 fragColor;

void main(void){
  fragColor = texture(uTex, vUv); // なんとtextureでいいらしい...！
}
`;
*/

// んー...ドローコールの実験とかしないとなぁ...
