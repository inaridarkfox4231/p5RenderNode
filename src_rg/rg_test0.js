// リアルタイムグラフィックスの数学の写経してみる（4つずつ）
// そうだっけ、shader何かしら有効化しないといけないんだっけ...

// ----global---- //
const ex = p5wgex;
let _node;
let _Timer = new ex.Timer();
let gr;

// ----shaders---- //
const basicVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// 作例が全部highpなので合わせます。
// 0_0: helloWorld.
const frag0 =
`#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;
void main(){
  fragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`;

// 0_1: helloWorld.
// 左下が(0,0)で右上が(1,1)の位置変数を使って色を付ける
// 見てわかるように左下が赤で、左上は101でピンク、右下は110で黄色。右上は111で白、以下、補間。
const frag1 =
`#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;
void main(){
  fragColor = vec4(1.0, vUv, 1.0);
}
`;

// 1_0: lerp.
// mix(v0, v1, ratio)で、v0*(1-ratio)+v1*ratioを返す仕組み。基本的な補間。lerp関数。
const frag2 =
`#version 300 es
precision highp float; // 作例がhighなので...
out vec4 fragColor; // フレームバッファによってはここが違ったりするのかしら？ out float ~~~ とかだったら面白いよね。
in vec2 vUv;
const vec3 RED = vec3(1.0, 0.0, 0.0);
const vec3 BLUE = vec3(0.0, 0.0, 1.0);
void main(){
  vec3 col = mix(RED, BLUE, vUv.x);
  fragColor = vec4(col, 1.0);
}
`;

// 1_1: lerpTriple.
// 3つの色の補間
// ほんとはmediumpしたいんだけど作例がhighpなので仕方なく...
const frag3 =
`#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;
void main(){
  // 赤、青、緑からなる配列。てか配列宣言ってこうするんだ。括弧におしこめると。これは知らないんだよな...覚えないと。
  vec3[3] col3 = vec3[](
    vec3(1.0, 0.0, 0.0),
    vec3(0.0, 0.0, 1.0),
    vec3(0.0, 1.0, 0.0)
  );
  vec2 p = vUv * 2.0; // (0.0, 0.0)～(2.0, 2.0)で考える
  int ind = int(p.x); // ふ～ん。これで0か1になるんだ。2にはならないわけね。
  vec3 col = mix(col3[ind], col3[ind + 1], fract(p.x)); // 小数部分で補間。あーそうか。配列に変数入れるのwebgl1は出来ないんよ。
  // webgl2ならではだわね...いやー、これできると便利なのよ...
  fragColor = vec4(col, 1.0);
}
`;
// おあ！すげ！ほんとに配列内に変数入れられるんだ...すげ...webgl2すげー。すげー。（小並感）

// ----setup---- //
function setup(){
  createCanvas(640, 640);
  gr = createGraphics(320, 320, WEBGL);
  _node = new ex.RenderNode(gr._renderer.GL);
  const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
  _node.registPainter("frag0", basicVert, frag0);
  _node.registPainter("frag1", basicVert, frag1);
  _node.registPainter("frag2", basicVert, frag2);
  _node.registPainter("frag3", basicVert, frag3);

  _node.registFigure("board", [{name:"aPosition", size:2, data:positions}]);
}

function draw(){
  background(0);
  showProgram("frag0", 0, 0);
  showProgram("frag1", 320, 0);
  showProgram("frag2", 0, 320);
  showProgram("frag3", 320, 320);
  _node.unbind().flush();
}

function showProgram(programName, x, y){
  _node.use(programName, "board")
       .drawArrays("triangle_strip");
  image(gr, x, y);
}
