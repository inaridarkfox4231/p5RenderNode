// ディファード早くやれよ
// わかってます。とりあえずMRTで遊ばせて。

// フレームバッファにテクスチャをはめてそれをcopyPainterで出す場合、
// デフォルトだとflipされないので（そっちが自然）明示的にflipしましょう、そんだけ。

const ex = p5wgex;
let _node;
const _timer = new ex.Timer();

let loadedImg;

const config = {shift:0};

function createGUI(){
  const gui = new lil.GUI();
  gui.add(config, "shift", 0, 1, 0.01);
}

// 今回は簡単なrgb分解のMRTを書いてみようかと。思いました。まる。
const rgbVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const rgbFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
layout (location = 0) out vec4 red;
layout (location = 1) out vec4 green;
layout (location = 2) out vec4 blue;
uniform sampler2D uTex;
void main(){
  vec4 texColor = texture(uTex, vUv);
  red = vec4(texColor.r, 0.0, 0.0, 1.0);
  blue = vec4(0.0, texColor.g, 0.0, 1.0);
  green = vec4(0.0, 0.0, texColor.b, 1.0);
}
`;

function preload(){
  loadedImg = loadImage("https://inaridarkfox4231.github.io/assets/season/mitsumine_small.jpg");
}

function setup(){
  createCanvas(1040, 720, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  _node.registPainter("rgb", rgbVert, rgbFrag); // foxBoard使わせてもらおう
  _node.registFBO("rgb", {w:540, h:360, color:{info:[{}, {}, {}]}});
  _node.registTexture("mitsumine", {src:loadedImg});

  _node.bindFBO("rgb");
  _node.clearColor(0,0,0,0).clear();
  _node.use("rgb", "foxBoard");
  _node.setTexture2D("uTex", "mitsumine");
  _node.drawArrays("triangle_strip");
  _node.unbind().flush();

  createGUI();
}

function draw(){
  _node.bindFBO(null);
  _node.clearColor(0,0,0,1).clear();

  const p = config.shift; // 0～1.

  ex.copyPainter(_node, {
    blendFunc:{src:"one", dst:"one"},
    src:[
    {type:"fb", name:"rgb", flip:true, index:0, view:[p*0.5, 0, 0.5, 0.5]},
    {type:"fb", name:"rgb", flip:true, index:1, view:[0, p*0.5, 0.5, 0.5]},
    {type:"fb", name:"rgb", flip:true, index:2, view:[p*0.5, p*0.5, 0.5, 0.5]}
  ]});
}
