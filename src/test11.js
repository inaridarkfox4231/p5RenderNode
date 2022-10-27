/*
  ここでやること
  画面を4分割してひとつはp5.Imageでtexture取って表示、ひとつはnew Image()で取って表示、
  ひとつはp5.Graphicsで取って表示、さらにupdateのテスト、ひとつはUint8Arrayで作ったものを表示。
  すべてひとつのcreateGraphics(256, 256, WEBGL)でやる。
  次の11で同じことをframebufferでできないか確かめる...
*/

// 面倒。全部放り込んじゃえ。
// 全種類試しました。お疲れ...

// 20221026
// ちょっと書き換えるか。
// copyPainterいろいろ実装したので書き換えました。
// ついでにblendのテスト。
// blendは全部に適用されるのでsrcに書いちゃだめですよ（当たり前）。
// 足し算どうしようね

// ----global
const ex = p5wgex;
let _node;
let _timer = new ex.Timer();

let img = new Image();
img.onload = function(){
  this.crossOrigin = "Anonymous"; // crossOrigin大事ね
}
img.src = "https://inaridarkfox4231.github.io/assets/texture/cloud.png";

let loadedImg;

// ----preload
function preload(){
  loadedImg = loadImage("https://inaridarkfox4231.github.io/assets/texture/rdm.png");
}

// ----setup
function setup(){
  createCanvas(512, 512, WEBGL);
  _timer.initialize("slot0");
  _node = new ex.RenderNode(this._renderer.GL);
//  _node.registPainter("show", showVert, showFrag);
//  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1,-1,1,-1,-1,1,1,1]}]);

  // じゃあ本番行ってみよう。できるか...？
  // srcに設定するの忘れてたっ
  // シームレスなのでrepeatを設定するとこのように、はい。
  _node.registTexture("cloud", {w:img.width, h:img.height, src:img, sWrap:"repeat",
                      magFilter:"linear", mipmap:true, minFilter:"linear_linear"}); // エラー出ない。よかった～
  _node.registTexture("rdm", {w:loadedImg.width, h:loadedImg.height, src:loadedImg, sWrap:"repeat"}); // これで。

  const gr = createGraphics(256, 256);
  gr.noStroke();
  gr.background(0);
  // ここ注意ね。eltのwidthとheightじゃないと...ちなみにキャンバス要素の、です。
  _node.registTexture("p5gr", {w:gr.elt.width, h:gr.elt.height, src:gr});

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
  // 完璧ですね。お疲れさまでした。
  _node.registTexture("uint8", {w:256, h:256, src:data});

  _node.registTexture("cover", {src:(function(){
    const gr = createGraphics(width, height);
    gr.background(128, 192, 255);
    return gr;
  })()})
}

// ----draw
function draw(){
  const currentTime = _timer.getDelta("slot0");

  p5grUpdate(currentTime); // これもやらないとね。

  ex.copyPainter(_node, {src:[
    {name:"cloud", view:[0,0,0.5,0.5], uvShift:[currentTime/4, currentTime/4], ambient:[1.0, 0.5, 0.75]},
    {name:"rdm", view:[0.5,0,0.5,0.5], uvShift:[currentTime/4, -currentTime/4], tint:[1.0, 0.5, 0.2]},
    //{name:"p5gr", view:[0,0.5,0.5,0.5], gradationFlag:1, gradationStart:[0,0,0,0,0,1], gradationStop:[1,0,0,0,1,1]},
    {name:"p5gr", view:[0,0.5,0.5,0.5], gradationFlag:2, gradationStart:[0.5,0.5,1,1,1,1], gradationStop:[0.5,1,0,0,0,1]},
    {name:"uint8", view:[0.5,0.5,0.5,0.5]},
  ]});
  //ex.copyPainter(_node, {blendFunc:{src:"one", dst:"one"}, src:[{name:"cover", view:[0,0,0.5,0.5]}]})
  _node.unbind().flush();
}

function p5grUpdate(currentTime){
  const gr = _node.getTextureSource("p5gr");
  gr.clear();
  gr.circle(128 + 128 * Math.sin(currentTime * Math.PI * 0.5), 128, 20);
  _node.updateTexture("p5gr");
}

/*
// ----shaders
// 4つのテクスチャを放り込んでチャンネルごとに描画
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

const showFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;
uniform sampler2D uCloud;
uniform sampler2D uRdm;
uniform sampler2D uP5gr;
uniform sampler2D uUint8;
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
  col += c0 * (texture(uCloud, q + vec2(uTime) * 0.25) + vec4(0.5, 0.75, 1.0, 1.0));
  col += c1 * texture(uRdm, q);
  col += c2 * texture(uP5gr, q);
  col += c3 * texture(uUint8, q);
  color = col;
}
`;
*/

/*
  _node.clearColor(0,0,0,0).clear();
  _node.use("show", "board")
       .setTexture2D("uCloud", "cloud")
       .setTexture2D("uRdm", "rdm")
       .setTexture2D("uP5gr", "p5gr")
       .setTexture2D("uUint8", "uint8")
       .setUniform("uTime", currentTime)
       .drawArrays("triangle_strip")
       .unbind().flush();
*/
