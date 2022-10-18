// 次は
// depthとstencilの内容を可視化するのとか出来たら面白いよね
// とかいって...
// てかステンシルピッキングやりたいかも（？？）

// readPixelsの練習（色から）

// というかcopyProgramFBOのテスト
// サクサク行こう。ライティングでやろうよ。その前に。

// カラーピッカー出来た。
// はじめにvUvはそのまま渡す（反転無し）
// これで左下が(0,0)に相当する、テクスチャに入る。ここには(0,0)が入ってる。
// テクスチャでは(0,0)が左上なのでテクスチャの(0,0)は黒だがこれは左上。
// それをcopyShaderで表現すると左上が黒で描画される（内部で反転してる）
// んでマウス位置も左上が(0,0)なので合致する、そのピクセルの色が取得される。OK.

// しかしwebglの通常の描画の場合...これをCopyで表現すると上下が反転してしまうね。
// 3D描画ではもちろん反転とかしないから...

// イメージとしてはまず普通に立方体3つを描画しつつ
// オフスクリーンにも描画してそっちでは整数をおいてく（色）
// マウス位置とそれを使ってreadPixelsで...

// ----global
const ex = p5wgex;
let _node;
let spoit = new Uint8Array(1*1*4);
// ----shaders
const colorVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = (aPosition + 1.0) * 0.5; // そのまま渡せば左下が(0,0)になる
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const colorFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;
void main(){
  vec2 p = vUv;
  color = vec4(p, 0.0, 1.0); // そして(0,0)が黒になるから(0,0)でアクセスすると黒が得られる。
  // そしてビューポートの(0,0)に相当する位置は左下なので左下は黒になる。
  //color = vec4(33.0/255.0, 73.0/255.0, 116.0/255.0, 1.0); // こうするとほんとうに33,73,116が返ってくるからすごい。
}
`;

// ----setup
function setup(){
  createCanvas(256, 256, WEBGL);
  const gl = this._renderer.GL;
  _node = new ex.RenderNode(gl);
  _node.registFBO("tex", {w:256, h:256});
  _node.registPainter("color", colorVert, colorFrag).registFigure("board", [{size:2, data:[-1,-1,1,-1,-1,1,1,1], name:"aPosition"}]);
  _node.bindFBO("tex").use("color", "board").drawArrays("triangle_strip").unbind().bindFBO(null);
  // この時点で入ってるわけだが...どういうこと？？
  // (0,0)でアクセスできるのは左上なのか左下なのかという問題。さてと。

  const gr = createGraphics(256, 256); gr.noStroke(); gr.fill(0);
  gr.textSize(24); gr.textAlign(CENTER, CENTER); // 文字
  _node.registTexture("info", {src:gr});
}

function draw(){
  _node.clearColor(0,0,0,0).clear();
  ex.copyProgramFBO(_node, null, "tex");
  updateInfo();
  ex.copyProgram(_node, null, "info");
  _node.flush();
}

// カラーピッカー

function updateInfo(){
  const gr = _node.getTextureSource("info");
  gr.clear();
  const gl = this._renderer.GL;
  const x = Math.min(255, Math.max(0, mouseX));
  const y = Math.min(255, Math.max(0, mouseY));
  _node.bindFBO("tex");
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, spoit);
  _node.bindFBO(null);
  gr.text("(" + spoit[0] + ", " + spoit[1] + ", " + spoit[2] + ")", 128, 224);
  _node.updateTexture("info");
}
/*
const gl = this._renderer.GL;
// あ、なるほど、あれか。bindしてないからだ...bindFBO(null)だとスクリーンから取得しちゃうからさ、それだよ。
_node.bindFBO("tex");
gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, spoit); // (0,0,0,255); // 画面左上
console.log(spoit);
gl.readPixels(255, 128, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, spoit); // (255,128,0,255); // 画面右端列中央
console.log(spoit);
gl.readPixels(0, 255, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, spoit); // (0,255,0,255); // 左下
console.log(spoit);
gl.readPixels(255, 255, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, spoit); // (255,255,0,255); // 右下
console.log(spoit);
noLoop();
*/
