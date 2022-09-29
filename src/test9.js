// 動的更新、h_doxasさんのサイトでもやってるからいいよね。ちょこっとサクッと。
// それ終わったらあのサイトのバンプ辺りからゆっくり消化していこう。
// 自分の中に見出すのちょっと限界なので。

// Float32Arrayをこっちで用意してこっちで用意した配列から移して放り込んで
// bufferSubDataを然るべき属性名とFigureとで呼び出して。OK.

// いつものように正規化デバイスで三角形、それで実験しますね。慣れたらカメラと組み合わせたいな...

// 関係ないけどUnityでComputeShaderでboidsだって。面白そうだった。

// というわけで動的更新。ちょろいね。
// 今んとこあれが得体が知れないので、とりあえずarray_bufとelement_bufだけ用意。

// 短いコードで書けるようになったね...あんな四苦八苦してたのが嘘みたいだわね。過去のコードこれで書き直すのも
// ありかな、とりあえず正方形とかでやってみるか？多分10000個でも軽いと思う。計算次第だけど。

// -------global------- //
const ex = p5wgex;
let _node;
const NUM = 1024;
let posiData = new Array(NUM*2*3).fill(0);
let posiDataTyped = new Float32Array(NUM*2*3);
let randoms = new Array(NUM*2); // 位置計算用
let _startTime = 0;

const TRIANGLE_SIZE = 0.02;

// -------shaders------- //
const triangleVert =
`#version 300 es
precision mediump float;
in vec2 aPosition;
in vec3 aColor;
out vec3 vColor;
void main(){
  vColor = aColor;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const triangleFrag =
`#version 300 es
precision mediump float;
in vec3 vColor;
out vec4 fragColor;
void main(){
  fragColor = vec4(vColor, 1.0);
}
`;

// -------setup------- //
function setup(){
  createCanvas(640, 640, WEBGL);
  _startTime = performance.now();
  const _gl = this._renderer;
  _node = new ex.RenderNode(_gl);

  _node.registPainter("color", triangleVert, triangleFrag);

  // 位置計算用乱数
  for(let i=0, L=NUM*2; i<L; i++){ randoms[i] = Math.random()*0.999 * (Math.random() < 0.5 ? 1 : -1); }

  // 雑に色を放り込む
  const colors = new Array(NUM*3*3).fill(0);
  for(let i=0; i<NUM*3; i++){
    const col = ex.hsv2rgb(0.3 + 0.5 * Math.random(), 0.3 + 0.4 * Math.random(), 1.0);
    colors[i*3] = col.r;
    colors[i*3+1] = col.g;
    colors[i*3+2] = col.b;
  }
  _node.registFigure("triangle", [{name:"aPosition", size:2, data:posiData}, {name:"aColor", size:3, data:colors}]);

  _node.clearColor(0, 0, 0, 1);
}

// -------draw------- //
function draw(){
  _node.clear();
  _node.use("color", "triangle");

  dataUpdate();
  _node.bufferSubData("aPosition", "array_buf", posiDataTyped); // できました～

  _node.drawArrays("triangles")
       .unbind();
}

function dataUpdate(){
  const currentTime = (performance.now() - _startTime) / 1000.0; // 経過秒数

  for(let i=0; i<NUM; i++){
    const offset = i*6;
    const cx = randoms[i*2];
    const cy = randoms[i*2+1];
    const phase = currentTime * Math.PI;
    posiData[offset+0] = cx + Math.cos(phase) * TRIANGLE_SIZE;
    posiData[offset+1] = cy + Math.sin(phase) * TRIANGLE_SIZE;
    posiData[offset+2] = cx + Math.cos(phase + Math.PI*2/3) * TRIANGLE_SIZE;
    posiData[offset+3] = cy + Math.sin(phase + Math.PI*2/3) * TRIANGLE_SIZE;
    posiData[offset+4] = cx + Math.cos(phase + Math.PI*4/3) * TRIANGLE_SIZE;
    posiData[offset+5] = cy + Math.sin(phase + Math.PI*4/3) * TRIANGLE_SIZE;
  }

  for(let i=0, L=NUM*2*3; i<L; i++){ posiDataTyped[i] = posiData[i]; }
}
