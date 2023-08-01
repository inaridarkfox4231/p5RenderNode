/*
VAOいい感じですね。
VAOいいようですね。
VAO...
恩恵が感じられない...まあいいか。
bufferSubDataのテストは別に用意します。

VAOの場合、通し番号でattributeの番号が決まってしまうので、
layout修飾子はほぼ必須であることに注意しましょう。デザインありきということです。

だってVAOを内部で使ってるだけで見た目的には一切変化なしだもの
そりゃあねぇ...
*/

const ex = p5wgex;
let _node;

const vs =
`#version 300 es
layout (location = 0) in vec2 aPosition;
layout (location = 1) in vec4 aColor;
out vec4 vColor;
void main(){
  vColor = aColor;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const fs =
`#version 300 es
precision highp float;
in vec4 vColor;
out vec4 fragColor;
void main(){
  fragColor = vColor * vec4(vec3(vColor.a), 1.0);
}
`;

function setup() {
  createCanvas(600, 600, WEBGL);
  pixelDensity(1);
  _node = new ex.RenderNode(this._renderer.GL);

  _node.registPainter("draw", vs, fs);
  _node.registFigure("square", [
    {name:"aPosition", size:2, data:[-1,1, -1,0, 0,0, 0,1]},
    {name:"aColor", size:4, data:[1,1,1,1, 1,0,0,1, 0,1,0,1, 0,0,1,1]}
  ]);
  _node.registIBO("squareIndices", {data:[0,1,2,0,2,3]});

  _node.registVAOFigure("squareVAO", [
    {name:"aPosition", size:2, data:[0,0, 0,-1, 1,-1, 1,0]},
    {name:"aColor", size:4, data:[1,1,0,1, 1,0,1,1, 0,1,1,1, 0,0,0,1]}
  ]);

  _node.registVAOFigure("triangleVAO", [
    {name:"aPosition", size:2, data:[0,0, 1,0, 0.5,1]},
    {name:"aColor", size:4, data:[0,0,0,1, 1,1,1,1, 0,1,0,1]}
  ]);

  const positions = [];
  const colors = [];
  const indices = [];
  positions.push(-0.5, -0.5);
  colors.push(1,1,1,1);
  for(let i=1; i<=200; i++){
    const t = Math.PI*2*i/200;
    positions.push(-0.5 + 0.4*cos(t), -0.5 + 0.4*sin(t));
    colors.push(...ex.hsvArray(i/200, 1, 1), 1);
    const i1 = i;
    const i2 = (i<200 ? i+1 : 1);
    indices.push(0, i1, i2);
  }
  _node.registVAOFigure("circleVAO", [
    {name:"aPosition", size:2, data:positions},
    {name:"aColor", size:4, data:colors}
  ]);
  _node.registIBO("circleIndices", {data:indices});
}

function draw(){
  _node.clearColor(0,0,0,1).clear();
  _node.enable("blend").blendFunc("one", "one_minus_src_alpha");

  _node.usePainter("draw");

  _node.drawFigure("square")
       .bindIBO("squareIndices")
       .drawElements("triangles")
       .unbind();
  _node.drawFigure("squareVAO")
       .bindIBO("squareIndices")
       .drawElements("triangles")
       .unbind();
  _node.drawFigure("triangleVAO")
       .drawArrays("triangles")
       .unbind();
  _node.drawFigure("circleVAO")
       .bindIBO("circleIndices")
       .drawElements("triangles")
       .unbind();

  _node.disable("blend");
}
