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
  //color1 = vec4(0.18, 0.54, 0.34, 1.0); // sea green. // 下にあるように...
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
  const gl = this._renderer.GL;
  gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE, gl.COLOR_ATTACHMENT2, gl.COLOR_ATTACHMENT3]);

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
}
// いけるの？？
