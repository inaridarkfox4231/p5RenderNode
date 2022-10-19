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

// 思ったんだけどやっぱ左下(0,0)で画像作ってるんだからそのままでやるべきよね。
// texにそれが入る。(0,0)には黒が入っている。
// copyProgramFBO. これでやると...(0,0)にアクセスして色を取ると、flip無しなら取った値は左下に行くから
// 見た目そのままになるわけです。で、今flipしてるから、左上が黒になってるわけで...
// 不自然だろうと。

// FBOの方はデフォルトでflip=falseにすべきかなと。

// さて、infoはテクスチャなので(0,0)に黒が入るのでそのまま入れると(0,0)が黒になるけど
// マウス値でアクセスする場合は逆になるわけですね。上下が。
// 逆でいいと思う。描いた絵で左下が黒になってるならそれに従うべき。
// シェーダーお絵かきは左下(0,0)でやるもの、画像データは左上(0,0)でやるもの、そこの違いはどうしようもないのですよ。
// そんなところで。
// あんまflipflipだと混乱しますから。

// 0.5を足すと256から引いてもよくなるのでそれでいこう。

// linear用意して。
// 結論。wrap:"repeat"は無意味。自動的にクランプされる。
// シェーダー内のフェッチとは本質的に異なるのね。
// linearとかも全然関係ないみたい。もういいや。

// ----global
const ex = p5wgex;
let _node;
let spoit = new Uint8Array(1*1*4);
let spoitF = new Float32Array(1*1*4);
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
  _node.registFBO("texFloat", {w:256, h:256, color:{info:{type:"float"}}});
  _node.registPainter("color", colorVert, colorFrag).registFigure("board", [{size:2, data:[-1,-1,1,-1,-1,1,1,1], name:"aPosition"}]);
  _node.bindFBO("tex").use("color", "board").drawArrays("triangle_strip").unbind().bindFBO(null);
  _node.bindFBO("texFloat").use("color", "board").drawArrays("triangle_strip").unbind().bindFBO(null);
  // この時点で入ってるわけだが...どういうこと？？
  // (0,0)でアクセスできるのは左上なのか左下なのかという問題。さてと。

  const gr = createGraphics(256, 256); gr.noStroke(); gr.fill(255);
  gr.textSize(16); gr.textAlign(CENTER, CENTER); // 文字
  _node.registTexture("info", {src:gr});
}

function draw(){
  _node.clearColor(0,0,0,0).clear();
  //ex.copyProgramFBO(_node, null, "tex");
  ex.copyPainter(_node, {src:{type:"fb", name:"tex"}});
  updateInfo();
  //ex.copyProgram(_node, null, "info");
  ex.copyPainter(_node, {src:{name:"info"}});
  _node.flush();
}

// カラーピッカー

function updateInfo(){
  const gr = _node.getTextureSource("info");
  gr.clear();
  //const gl = this._renderer.GL;
  // 0.5を足せば256から引いてもよくなる。ああそうか、Nearestだからか...そこら辺かもしれない。
  const x = Math.min(255, Math.max(0, mouseX)) + 0.5;
  const y = Math.min(255, Math.max(0, mouseY)) + 0.5;
  _node.bindFBO("tex");
  //gl.readPixels(x, 256-y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, spoit); // yだけ逆で。
  _node.readPixels(x, 256-y, 1, 1, "rgba", "ubyte", spoit);
  _node.bindFBO("texFloat");
  _node.readPixels(x, 256-y, 1, 1, "rgba", "float", spoitF);
  _node.bindFBO(null);
  gr.text("(" + spoit[0] + ", " + spoit[1] + ", " + spoit[2] + ")", 128, 194);
  gr.text("(" + spoitF[0].toFixed(3) + ", " + spoitF[1].toFixed(3) + ", " + spoitF[2].toFixed(3) + ")", 128, 224);
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
