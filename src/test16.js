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

// 違うフォーマットいけますね。何ていうか。linearだと色として可視化する際に問題が生じるようです。
// nearest, というかデフォルトでやらないとだめっぽいね。んー？
// おそらくだけどgbaが全部黒だから影響を受けてみんな黒っぽくなってしまうのが原因かと...分かんないけど。
// rだけで補間取ってくれないんかな。難しいみたいですね。まあ別に問題ないか。そもそも、
// depthにしてもそうだけどもともと連続的な値に対してlinear適用する意味ないしな。

// 20221026
// あー...copyPainterが古い...この頃はまだマルチ出来なかったから。
// 直そう。
// 直しました。マルチ便利だねぇ。

const ex = p5wgex;
let _node;

const vs =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = (aPosition + 1.0) * 0.5;
  vUv.y = 1.0 - vUv.y;
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
layout (location = 4) out float value;
void main(){
  color0 = vec4(0.0, vUv.x, 0.5, 1.0); // navy.
  //color1 = vec4(vUv.x, 0.54, 0.34, 1.0); // sea green. // NONEを指定しましょう
  color2 = vec4(0.62, 0.32, vUv.x, 1.0); // sienna.
  color3 = vec4(1.0, 0.54, vUv.x, 1.0); // dark orange.
  value = abs(vUv.x - vUv.y);
}
`;

const fsFloat =
`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 fragColor;
void main(){
  fragColor = vec4(vec3(texture(uTex, vUv).r), 1.0); // これでいいの？
}
`;


function setup(){
  createCanvas(256, 256, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  _node.registPainter("test", vs, fs);
  _node.registPainter("testFloat", vs, fsFloat);
  _node.registFigure("board", [{size:2, data:[-1,-1,1,-1,-1,1,1,1], name:"aPosition"}]);
  // MRTのfboを作ってみる
  _node.registFBO("mrt", {w:256, h:256, color:{info:[{}, {}, {}, {},
    {wrap:"mirror", type:"float", internalFormat:"r32f", format:"red"}]}}); // filter:"linear"だとまずいっぽいね。
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

  const dummy = createGraphics(128, 128);
  dummy.noStroke();
  dummy.background(255);
  dummy.textSize(64);
  dummy.textAlign(CENTER,CENTER);
  dummy.fill(0);
  dummy.text("龍", 64, 64);
  _node.registTexture("gr2", {src:dummy});
}

function draw(){
  _node.clearColor(0,0,0,1).clear();

  _node.bindFBO("mrt");

  // 事前にこれをやることで。
  // つまり1のところだけNONEにすることで、そこには何も描き込まれないようにできるのさ。
  //　そういうことみたいです。もちろんMRTのFBOがbindされていること前提。
  _node.drawBuffers([1,0,1,1,1]);
  // BACKはやめてね。0と1で。

  _node.use("test", "board")
       .drawArrays("triangle_strip")
       .unbind();
  _node.bindFBO(null);

  ex.copyPainter(_node, {src:[
    {type:"fb", name:"mrt", index:0, view:[0,0,0.5,0.5]},
    {type:"fb", name:"mrt", index:1, view:[0.5,0,0.5,0.5]},
    {type:"fb", name:"mrt", index:2, view:[0,0.5,0.5,0.5]},
    {type:"fb", name:"mrt", index:3, view:[0.5,0.5,0.5,0.5]}
  ]});

//  ex.copyPainter(_node, {view:[0, 0, 0.5, 0.5], src:{type:"fb", name:"mrt", index:0}});
//  ex.copyPainter(_node, {view:[0.5, 0, 0.5, 0.5], src:{type:"fb", name:"mrt", index:1}});
//  ex.copyPainter(_node, {view:[0, 0.5, 0.5, 0.5], src:{type:"fb", name:"mrt", index:2}});
//  ex.copyPainter(_node, {view:[0.5, 0.5, 0.5, 0.5], src:{type:"fb", name:"mrt", index:3}});

  ex.copyPainter(_node, {src:{name:"gr"}});
  // 諸々書いたうえで可視化する。この方法ならdepthも可視化できるんだろうか。
  _node.enable("blend").blendFunc("src_alpha", "one_minus_src_alpha");
  _node.use("testFloat", "board").setViewport(0.25, 0.25, 0.5, 0.5);
  _node.setFBOtexture2D("uTex", "mrt", "color", 4).drawArrays("triangle_strip").unbind();
  _node.disable("blend");

  _node.flush();
  noLoop();
}
// いけるの？？
