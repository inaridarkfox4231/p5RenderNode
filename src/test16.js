// MRTやろっか（雑）
// MRT実験中～ NとかくべきところがN-1になってました。ばか。
// しかしlayoutの記述って普通に有効なのね...

// めんどうだからcopyPainterにviewport指定機能追加しました。
// しかしこれいちいち同じバリデーション使うの冗長だな...まあ仕方ないんだけど。
// MRT成功おめでとう。

// そうですね。一部のバッファにだけ描き込むには、
// 必要に応じてdrawBuffersで指示するといいみたい。
// shaderによっては一部のバッファにしか描き込みたくないかも、そういう使い方もできるみたい。
// そうしないでやろうとするとエラーになるようですね...

// MRTのやり方まとめ。
// fb作るときにcolorのinfoを配列にする。
// プログラムによっては一部のバッファに描画しないかも？その場合はdrawBuffersの01指定で。
// ただしプログラム内で描画可否を選ぶことはできないので注意。
// layoutで描画する対象を指定してそれぞれのoutに放り込めばOK!
// サイズ異なるように出来るのかは知らんけど。どうだろう。できるんかね。一枚だから無理じゃないかな...
// ------ 実験中 ------ //
// はい！
// 無理でした。そりゃそうか。fb内のtextureもrenderbufferもすべて同じサイズじゃないとだめですね。当たり前だ。
// あそこ書き換えないとなぁ...
// つまりMRTでピッキングする場合、同じサイズに放り込む必要があると。んー。
// MRTでなければ通常サイズに落とせる。んー。んーー。
// ディファードなら普通に、まあ、そう。

// いいよ。
// drawingBufferSize取得して掛け算して横幅縦幅で割ってってやればいいよ。どうせ厳密な指定は必要ないのだ。

const ex = p5wgex;
let _node;

const vs =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const fs =
`#version 300 es
precision highp float;
in vec2 vUv;
layout (location = 0) out vec4 color0;
//layout (location = 1) out vec4 color1;  // たとえばここに書いてほしくない場合は
layout (location = 2) out vec4 color2;
layout (location = 3) out vec4 color3;
void main(){
  color0 = vec4(0.0, 0.0, 0.5, 1.0); // navy.
  //color1 = vec4(0.18, 0.54, 0.34, 1.0); // sea green. // NONEを指定しましょう
  color2 = vec4(0.62, 0.32, 0.18, 1.0); // sienna.
  color3 = vec4(1.0, 0.54, 0.0, 1.0); // dark orange.
}
`;

function setup(){
  createCanvas(256, 256, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  _node.registPainter("test", vs, fs);
  _node.registFigure("board", [{size:2, data:[-1,-1,1,-1,-1,1,1,1], name:"aPosition"}]);
  // MRTのfboを作ってみる
  _node.registFBO("mrt", {w:256, h:256, color:{info:[{}, {}, {}, {}]}});
  const gr = createGraphics(256, 256);
  gr.textAlign(CENTER, CENTER);
  gr.textSize(16);
  gr.fill(255);
  gr.noStroke();
  gr.text("color0", 64, 48);
  gr.text("color1", 192, 48);
  gr.text("color2", 64, 176);
  gr.text("color3", 192, 176);
  gr.text("navy", 64, 80);
  gr.text("sea green", 192, 80);
  gr.text("sienna", 64, 208);
  gr.text("dark orange", 192, 208);
  _node.registTexture("gr", {src:gr});
}

function draw(){
  _node.clearColor(0,0,0,1).clear();

  _node.bindFBO("mrt");

  // 事前にこれをやることで。
  // つまり1のところだけNONEにすることで、そこには何も描き込まれないようにできるのさ。
  //　そういうことみたいです。もちろんMRTのFBOがbindされていること前提。
  _node.drawBuffers([1,0,1,1]);
  // BACKはやめてね。0と1で。

  _node.use("test", "board")
       .drawArrays("triangle_strip")
       .unbind();
  _node.bindFBO(null);
  const {w, h} = _node.getDrawingBufferSize();
  ex.copyPainter(_node, {view:[0, 0.5, 0.5, 0.5], src:{type:"fb", name:"mrt", index:0}});
  ex.copyPainter(_node, {view:[0.5, 0.5, 0.5, 0.5], src:{type:"fb", name:"mrt", index:1}});
  ex.copyPainter(_node, {view:[0, 0, 0.5, 0.5], src:{type:"fb", name:"mrt", index:2}});
  ex.copyPainter(_node, {view:[0.5, 0, 0.5, 0.5], src:{type:"fb", name:"mrt", index:3}});
  ex.copyPainter(_node, {src:{name:"gr"}});
  _node.flush();
  noLoop();
}
// いけるの？？
