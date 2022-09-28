// ドローコールテスト
// と同時にwebgl2表記のテストとかしたいわね

// ちなみにbg背景の上になんか置くには
// blendModeの	gl.enable(gl.BLEND);
// gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
// して後で解除、をしないといけないんです。
// setUniform機能してますねぇ...まあテスト内容は多岐にわたるけれど...

// カリングは「そういうもの」って考えるしかないのよ。最終的に正規化デバイスに落ちたとするだろ。
// そこでbackで描画されるのは、反時計回り。「反」時計回りだからback, という覚え方でいいかも。
// frontで描画されるのは時計回り。だからfrontにすると消滅する。
// triangle_stripはそんな事お構いなしで、[0,1,2],[2,1,3],[2,3,4],[4,3,5],...と決められた数字の列ごとに三角形を
// 作っていくので、それで描画されるかどうかは完全に配置が決める。

// 反時計周りとか時計回りで考えればy軸の向きはもはやどうでもいい。単純に反時計回りーbackー描画される、で考えればいいわけ。
// 反時計回りーbackー描画される、時計回りーfrontー描画される。
// だから立体を描く際にも表面から見てちゃんと...ただ名前の語感を考えるとfrontのがいいよねぇ、だってfrontだし...
// イメージ的に逆だからほんと混乱するよね...どうにかなんないんかね。

// それでもとりあえず立体とか作るわけだが。

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.

let bg, bgTex;

// ------------------------------------------------------------------------------------------------------------ //
// shaders.

// copy. 2D背景付けたい場合にどうぞ。
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
"precision mediump float;" +
"precision mediump sampler2D;" +
"varying highp vec2 vUv;" +
"uniform sampler2D uTex;" +
"void main () {" +
"  gl_FragColor = texture2D(uTex, vUv);" +
"}";

// simple. 頂点の位置と色を受け取るだけ。3Dではなく、単純にいきなり正規化デバイスからスタート。
const simpleVert =
"precision mediump float;" +
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
"precision mediump float;" +
"varying vec3 vColor;" +
"uniform vec3 uTint;" +
"void main(){" +
"  gl_FragColor = vec4(vColor * uTint, 1.0);" +
"}";

// ------------------------------------------------------------------------------------------------------------ //
// main code.

function setup(){
  createCanvas(800, 640, WEBGL);
  const _gl = this._renderer; // レンダラーを取得
  _node = new ex.RenderNode(_gl); // レンダーノード

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


  meshData = [{name:"aPosition", size:2, data:[-1,1,-1,-1,1,1,1,-1]}]; // 指定の仕方が難しい。
  _node.registFigure("board", meshData);
  _node.registPainter("copy", copyVert, copyFrag);

  _node.clearColor(0.6, 0.4, 0.2, 1);

  bg = createGraphics(800, 640);
  bg.background(128);
  bg.noStroke();
  bg.fill(0);
  bg.textAlign(CENTER, CENTER);
  bg.textSize(32);
  bg.text("test",400,80);
  bgTex = new p5.Texture(_gl, bg);
}

function draw(){
  _node.clear();

  _node.enable("cull_face");
  _node.cullFace("back");

  _node.use("copy", "board");
  _node.setTexture2D("uTex", bgTex.glTex);
  _node.drawArrays("triangle_strip");
  _node.unbind();

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
