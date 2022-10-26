// activeTextureの仕様が分かったのでいろいろ実験してみようと思います。
// フレームバッファにテクスチャを入れられるようになったのでそのテスト。

// bloomのコードをちらっと見て
// textureの理解が稚拙すぎて引いた
// わぁ...って感じ。わぁ...

// framebufferOKです。

// 20221027
// copyPainter機能強化したので...
// あ、そうか、この頃まだ無かったっけ。
// uvShift便利でしょう。

// ----global
const ex = p5wgex;
let _node;
const _timer = new ex.Timer();

let gr2;

let gr1 = new Image();
gr1.onload = function(){
  this.crossOrigin = "Anonymous"; // crossOrigin大事ね
}
gr1.src = "https://inaridarkfox4231.github.io/assets/texture/cloud.png";


// ----preload
function preload(){
  gr2 = loadImage("https://inaridarkfox4231.github.io/assets/texture/rdm.png");
}

// ----setup
function setup(){
  _timer.initialize("slot0");
  createCanvas(512, 512, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // 今回はframebufferのinfoでsrcを指定してみます
  const gr0 = createGraphics(256, 256);
  gr0.background(0,128,255);
  gr0.noStroke();
  gr0.fill(255);
  gr0.circle(128,128,128);
  _node.registFBO("test0", {w:gr0.elt.width, h:gr0.elt.height, color:{info:{src:gr0}}}); // createGraphicsで作ったやつ
  _node.registFBO("test1", {w:gr1.width, h:gr1.height, color:{info:{src:gr1, sWrap:"repeat", tWrap:"repeat"}}}); // ロードした画像1
  _node.registFBO("test2", {w:gr2.width, h:gr2.height, color:{info:{src:gr2}}}); // ロードした画像2

  // 最後に...
  const data = new Uint8Array(256*256*4);
  for(let y=0; y<256; y++){
    for(let x=0; x<256; x++){
      const i = 4*(y*256+x);
      data[i] = x;
      data[i + 1] = y;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  _node.registFBO("test3", {w:256, h:256, color:{info:{src:data}}}); // Uint8Array.
}

// ----draw
function draw(){
  const currentTime = _timer.getDelta("slot0");
  _node.clearColor(0, 0, 0, 0).clear();

  ex.copyPainter(_node, {src:[
    {type:"fb", name:"test0", view:[0,0,0.5,0.5]},
    {type:"fb", name:"test1", view:[0.5,0,0.5,0.5], uvShift:[currentTime*0.25, -currentTime*0.25]},
    {type:"fb", name:"test2", view:[0,0.5,0.5,0.5]},
    {type:"fb", name:"test3", view:[0.5,0.5,0.5,0.5]}
  ]});

  _node.unbind().flush();
}

// ----shaders
// 同じでいい
/*
// ----shaders

const showVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = (aPosition + 1.0) * 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// 4つのテクスチャを放り込んでチャンネルごとに描画
const showFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;
uniform sampler2D uTex0;
uniform sampler2D uTex1;
uniform sampler2D uTex2;
uniform sampler2D uTex3;
uniform float uTime;
void main(){
  vec2 p = vUv;
  p *= 2.0;
  vec2 q = fract(p);
  vec2 ch = floor(p);
  float c0 = (ch == vec2(0.0) ? 1.0 : 0.0);
  float c1 = (ch == vec2(1.0, 0.0) ? 1.0 : 0.0);
  float c2 = (ch == vec2(0.0, 1.0) ? 1.0 : 0.0);
  float c3 = (ch == vec2(1.0) ? 1.0 : 0.0);
  vec4 col;
  col += c0 * texture(uTex0, q);
  col += c1 * texture(uTex1, q);
  col += c2 * texture(uTex2, q);
  col += c3 * texture(uTex3, q);
  color = col;
}
`;
*/

/*
_node.use("show", "board")
     .setFBOtexture2D("uTex0", "test0")
     .setFBOtexture2D("uTex1", "test1")
     .setFBOtexture2D("uTex2", "test2")
     .setFBOtexture2D("uTex3", "test3")
     .drawArrays("triangle_strip")
     .unbind()
     .flush();

*/

//_node.registPainter("show", showVert, showFrag);
//_node.registFigure("board", [{size:2, data:[-1,-1,1,-1,-1,1,1,1], name:"aPosition"}]);
