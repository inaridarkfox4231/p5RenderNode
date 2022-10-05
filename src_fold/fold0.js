// foldシリーズはじまり～
// レイマでfoldを作る、もしくはその様子をポリゴン描画で可視化するとかそんなやつらだ。よろしくな。

// まずレイマ

// 右手系は右がx軸上がy軸で奥がz軸だそうです。逆だったか...いいよ通常で。どっちにしろ同じことよ。
// リアルと一緒じゃないと色々と不便そう。で、原点注視でfovとaspectでやりたい、そうすると視点動かすだけで大きさとか
// 変えられるしぐるぐる周りから見たりできるし。あと上とか下とかから、も。

// ----global---- //
const ex = p5wgex;
let _node;
let _timer = new ex.Timer();

// ----shaders---- //
const rayMVert =
`#version 300 es
`;

const rayMFrag =
`#version 300 es
precision highp float;
`;

// ----setup---- //
function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  // ああテクスチャ実装しないとだ...
  const positions = [-1,-1,1,-1,-1,1,1,1];
  _node.registPainter("rayM", rayMVert, rayMFrag);
  _node.registFigure("board", [{name:"aPosition", size:2, data:positions}]);
  _timer.set("cur");

  _node.clearColor(0,0,0,1);
}

// ----draw---- //
function draw(){
  const currentTime = _timer.getDeltaSecond("cur");
  _node.clear()
       .use("rayM", "board")
       .setUniform("uTime", currentTime)
       .drawArrays("triangle_strip")
       .unbind()
       .flush();
}
