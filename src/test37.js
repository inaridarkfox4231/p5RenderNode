// インスタンシングのテスト
// 色々テストします
// divisorを設定したうえでArraysをやると1個だけ、indtancedだと複数、を
// 確かめないといけないのです...

// drawArraysだと1個だけですね。確認しました。
// なるほど～～～～
// drarArraysInstancedだとちゃんと複数ですね～～～
// できました。おめでとう。🎉

// divisorを4とか8にして実験してみてるけど
// 足りない分は切れてしまうようですね
// ループはしない模様です
// 了解！VAOでもいけてますね！
// VAOでもtrianglesだと1つだけ。

// たとえば普通に64個描画する場合2つの方法があってですね。
// aPositionとaColorも64個分用意するか、
// ドローコールを64回やるかどっちかですね。
// それらと比べて速いのかどうか、です。
// 10000個くらいでやってどのくらい差が出るのかという話ですね。

const ex = p5wgex;
let _node;

const vs =
`#version 300 es
in vec2 aPosition;
in vec4 aColor;
in vec2 aShiftPosition;
out vec4 vColor;
void main(){
  vColor = aColor;
  gl_Position = vec4(aPosition + aShiftPosition, 0.0, 1.0);
}
`;

const fs =
`#version 300 es
precision highp float;
in vec4 vColor;
out vec4 fragColor;
void main(){
  fragColor = vColor;
}
`;

const vsVAO =
`#version 300 es
layout (location = 0) in vec2 aPosition;
layout (location = 1) in vec4 aColor;
layout (location = 2) in vec2 aShiftPosition;
layout (location = 3) in vec3 aTintColor;
out vec4 vColor;
void main(){
  vColor = aColor * vec4(aTintColor, 1.0);
  gl_Position = vec4(aPosition + aShiftPosition, 0.0, 1.0);
}
`;

const fsVAO =
`#version 300 es
precision highp float;
in vec4 vColor;
out vec4 fragColor;
void main(){
  fragColor = vColor;
}
`;

function setup() {
  createCanvas(600, 600, WEBGL);
  pixelDensity(1);
  _node = new ex.RenderNode(this._renderer.GL);
  // インスタンス...
  _node.registPainter("draw", vs, fs);
  _node.registPainter("drawVAO", vsVAO, fsVAO);

  const shiftPositions = [];
  for (let y=0; y<2; y+=0.25) {
    for(let x=0; x<2; x+=0.25) {
      shiftPositions.push(x, -y);
    }
  }

  const shiftColors = [];
  for (let k=0; k<8; k++) {
    shiftColors.push(...ex.hsvArray(k/8, 1, 1));
  }

  _node.registFigure("triangle", [
    {name:"aPosition", size:2, data:[-1,1, -1,0.75,-0.75,0.75]},
    {name:"aColor", size:4, data:[1,1,1,1, 0,1,1,1, 0,0,1,1]},
    {name:"aShiftPosition", size:2, data:shiftPositions, divisor:1} // divisorを設定する。1に。
  ]);

  _node.registVAOFigure("triangleVAO", [
    {name:"aPosition", size:2, data:[-1,1, -0.75,0.75, -0.75,1]},
    {name:"aColor", size:4, data:[0,0,0,1, 1,1,1,1, 0,0,0,1]},
    {name:"aShiftPosition", size:2, data:shiftPositions, divisor:1},
    {name:"aTintColor", size:3, data:shiftColors, divisor:8} // 色。
  ]);

  _node.clearColor(0,0,0,1);
}

function draw() {
  _node.clear();

  _node.use("draw", "triangle")
       //.drawArrays("triangles")
       .drawArraysInstanced("triangles", 64)
       .unbind();
  _node.use("drawVAO", "triangleVAO")
       //.drawArrays("triangles")
       .drawArraysInstanced("triangles", 64)
       .unbind();

  _node.flush();
}
