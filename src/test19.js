// テスト

// viewはx,y,w,hで指定する、複数の場合は配列を使う、最大で8個。
// なるほど、整数属性は禁止...まあそうか。で、intのvaryingは可能だけどflatを付ける、と。
// OKです。

// 20221027
// 今ならflat付けられると思うけどどうしようね。
// とりあえず直すか。

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
layout (location = 1) out vec4 color1;  // たとえばここに書いてほしくない場合は
layout (location = 2) out vec4 color2;
layout (location = 3) out vec4 color3;
void main(){
  color0 = vec4(vUv.y, 0.0, 0.0, 1.0); // navy.
  color1 = vec4(0.0, vUv.y, 0.0, 1.0); // sea green. // NONEを指定しましょう
  color2 = vec4(0.0, 0.0, vUv.y, 1.0); // sienna.
  color3 = vec4(vec3(vUv.y), 1.0); // dark orange.
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
  _node.registFigure("board", [{size:2, data:[-1,-1,1,-1,-1,1,1,1], name:"aPosition"}]);
  // MRTのfboを作ってみる
  _node.registFBO("mrt", {w:256, h:256, color:{info:[{}, {}, {}, {}]}});

  const dummy = createGraphics(128, 128);
  dummy.noStroke();
  dummy.background(128);
  dummy.textSize(64);
  dummy.textAlign(CENTER,CENTER);
  dummy.fill(0);
  dummy.text("龍", 64, 64);
  _node.registTexture("gr2", {src:dummy});
}

function draw(){
  _node.clearColor(0,0,0,1).clear();

  _node.bindFBO("mrt");

  _node.drawBuffers([1,1,1,1]);

  // MRTで描画
  _node.use("test", "board")
       .drawArrays("triangle_strip")
       .unbind();
  _node.bindFBO(null);

  // 表出
  ex.copyPainter(_node, {src:[
    {type:"fb", name:"mrt", index:0, view:[0, 0, 0.5, 0.5]},
    {type:"fb", name:"mrt", index:1, view:[0.5, 0, 0.5, 0.5]},
    {name:"gr2",view:[0, 0.5, 0.5, 0.5]},
    {type:"fb", name:"mrt", index:2, view:[0.5, 0.5, 0.5, 0.25]},
    {type:"fb", name:"mrt", index:3, view:[0.5, 0.75, 0.5, 0.25]}
  ]});

  _node.flush();
}
// いけるの？？
