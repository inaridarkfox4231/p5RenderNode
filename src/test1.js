// ドローコールテスト
// と同時にwebgl2表記のテストとかしたいわね

// ちなみにbg背景の上になんか置くには
// blendModeの	gl.enable(gl.BLEND);
// gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
// して後で解除、をしないといけないんです。
// setUniform機能してますねぇ...まあテスト内容は多岐にわたるけれど...

// えーと、つまり「cull」が「摘み取る」とかそういう意味なのです。だからgl.cullFace(gl.BACK)っていうのは
// 背面を摘み取って前面だけ描画するってことね。
// だから反時計回りが結局正の向きってことでいいみたいですね。なるほど...ん？
// じゃあFRONT_AND_BACKって？そうです。両方とも、消えます。（なんじゃい）

// p5jsのデフォルトジオメトリって全部BACKなんですよ...時計回り。知ってたけどね。だからカリングすると消える。
// もちろん背面は描画されるけれど。前面だけ消える。でもstrokeはFRONTなんです（あれポリゴンだからね）。つまり線だけ残る。
// んー...
// ぶっちゃけどうでもいい、もうあのstrokeShader使わないし、p5.Geometryももう使わないし。それにmodel関数もおいおい調べてくつもりだし。
// 今はいいよ。

// まとめ。カリングは「摘み取る」でBACKがデフォルトなのは背面をカリング、つまりカットしてるから。そしてその向きというのは
// x軸右y軸上の座標系でx軸を最短でy軸に落とす、つまり反時計回りの向き。だから、
// クワドだったら「-1,-1,1,-1,-1,1,1,1」ってやるとBACKカリングで消えない平面になるわけ（左下、右下、左上、右上）。
// まあ、基本FRONTでいきましょう。BACKカリングがデフォルトである以上そうしないといろいろと面倒ですからね。

// お待たせ。20221018 Textureできたよ。苦労したぜ。

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.

// ------------------------------------------------------------------------------------------------------------ //
// shaders.

// copy. 2D背景付けたい場合にどうぞ。
const copyVert =
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
"varying highp vec2 vUv;" +
"uniform sampler2D uTex;" +
"void main () {" +
"  gl_FragColor = texture2D(uTex, vUv);" +
"}";

// simple. 頂点の位置と色を受け取るだけ。3Dではなく、単純にいきなり正規化デバイスからスタート。
const simpleVert =
"attribute vec2 aPosition;" +
"attribute vec3 aColor;" +
"varying vec3 vColor;" +
"void main(){" +
"  vColor = aColor;" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" + // 平面なので正規化デバイスの深度値は0で一律
"  gl_PointSize = 32.0;" + // pointSize.
"}";

// 本来はこんな感じで色を出すだけの代物なのよね
const simpleFrag =
"precision highp float;" +
"varying vec3 vColor;" +
"uniform vec3 uTint;" +
"void main(){" +
"  gl_FragColor = vec4(vColor * uTint, 1.0);" +
"}";

// ------------------------------------------------------------------------------------------------------------ //
// main code.

function setup(){
  createCanvas(800, 640, WEBGL);
  //const _gl = this._renderer; // レンダラーを取得
  //const gl = _gl.GL;
  _node = new ex.RenderNode(this._renderer.GL); // レンダーノード

  let meshData = []; // 汎用メッシュ配列。今回は点のデータと色のデータを入れるつもり。
  const hsv = ex.hsv2rgb;
  // 指定について、正規化デバイスなので上、下、上、下、...の順ですね。で。カリング？
  let vData = [-0.75,0.5,-0.75,-0.5,-0.5,0.5,-0.5,-0.5,-0.25,0.5,-0.25,-0.5,0,0.5,0,-0.5,
               0.25,0.5,0.25,-0.5,0.5,0.5,0.5,-0.5,0.75,0.5,0.75,-0.5];
  let cData = [];
  for(let i=0; i<14; i++){
    const col = hsv(0.55, i/14, 1);
    cData.push(col.r, col.g, col.b);
  }
  meshData.push({name:"aPosition", size:2, data:vData}, {name:"aColor", size:3, data:cData});

  _node.registFigure("points", meshData);
  _node.registPainter("simple", simpleVert, simpleFrag);

/*
  meshData = [{name:"aPosition", size:2, data:[-1,1,-1,-1,1,1,1,-1]}]; // 指定の仕方が難しい。
  _node.registFigure("board", meshData);
  _node.registPainter("copy", copyVert, copyFrag);
*/
  _node.clearColor(0.6, 0.4, 0.2, 1);

  const bg = createGraphics(800, 640);
  bg.background(128);
  bg.noStroke();
  bg.fill(0);
  bg.textAlign(CENTER, CENTER);
  bg.textSize(32);
  bg.text("test",400,80);
  //bgTex = new p5.Texture(_gl, bg);
  _node.registTexture("bg", {src:bg}); // srcがある場合wとhは不要になったよ
}

function draw(){
  _node.clear();

  _node.enable("cull_face");
  _node.cullFace("back");
/*
  _node.use("copy", "board");
  _node.setTexture2D("uTex", "bg"); // やったぜ
  _node.drawArrays("triangle_strip");
  _node.unbind();
*/
  ex.copyProgram(_node, null, "bg"); // 簡略化

  _node.enable("blend");
  _node.blendFunc("one", "one"); // 加算合成的な

  _node.use("simple", "points");
  _node.setUniform("uTint", [1,0.5,0.25]);
  _node.drawArrays("points");
  _node.setUniform("uTint", [0.7,0.6,0,5]);
  _node.drawArrays("triangle_strip");
  _node.unbind();

  _node.disable("blend");

  _node.flush();
  // こんなところですかね。
}
