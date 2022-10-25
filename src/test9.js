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

// せっかく実装したんだからliquidFunと組み合わせたいわよね
// 2Dはそうでもしないと見栄えが出ない。それか3D.

// Timer実装しました。簡単です。setで名前指定して放り込む。で、getDeltaでsetしてからの経過ミリ秒、
// getDeltaSecondでその秒数指定、getDeltaFPStextでfpsがいくつ、の場合の桁数含めて指定してさらにテキストにしたやつを取得。
// 表示するのは大変だけどな。んー...

// 20221025
// 動的更新間違ってたので修正しました。部分的更新もできる凄い関数なのです。
// 動的更新の部分適用苦手なようなので整理します。
// bufferSubData(attrName, targetName, dstByteOffset, srcData, srcOffset = 0)
// attrNameはそのまま、これはbindされたFigureに対する処理です。で、targetNameはindexBufferでないときは"array_buffer"でOK.
// dstByteOffsetはバイトで何処からいじるのか決める、たとえばFloat32は4バイトでこれが4つだと16バイトなので
// Float32のvec4が延々と連なるときのi番目を変える場合は16*iのように指定する（ほんとだよ）。
// srcDataにたとえばFloat32の長さ3つとか用意すればそこにあるvec4のx,y,zだけを変えることができる。
// ほんとにそんな感じ。凄い便利なのです。srcOffsetはそのままの意味だけどまあそうね...保留で...

// OKです。まあありがたみはないわね。

// -------global------- //
const ex = p5wgex;
let _node;
const _timer = new ex.Timer(); // 使ってみる
const NUM = 1024;
let posiData = new Array(NUM*2*3).fill(0);
let posiDataTyped = new Float32Array(NUM*2*3);
let randoms = new Array(NUM*2); // 位置計算用
//let _startTime = 0;

const TRIANGLE_SIZE = 0.02;

// -------shaders------- //
const triangleVert =
`#version 300 es
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
precision highp float;
in vec3 vColor;
out vec4 fragColor;
void main(){
  fragColor = vec4(vColor, 1.0);
}
`;

// -------setup------- //
function setup(){
  createCanvas(640, 640, WEBGL);
  //_startTime = performance.now();
  //_timer = new ex.Timer();
  _timer.initialize("duration");
  const gl = this._renderer.GL;
  _node = new ex.RenderNode(gl);

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
  _node.registFigure("triangle", [{name:"aPosition", size:2, data:posiData, usage:"dynamic_draw"},
                                  {name:"aColor", size:3, data:colors}]);

  _node.clearColor(0, 0, 0, 1);
}

// -------draw------- //
function draw(){
  _node.clear();
  _node.use("color", "triangle");

  dataUpdate();
  _node.bufferSubData("aPosition", "array_buf", 0, posiDataTyped); // できました～

  _node.drawArrays("triangles")
       .unbind();
}

function dataUpdate(){
  const currentTime = _timer.getDelta("duration"); // 経過秒数

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
