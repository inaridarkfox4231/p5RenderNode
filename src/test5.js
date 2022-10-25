// フレームバッファアニメの復習もかねてESSL300で描いてみる
// それとgl_VertexIDを使ってみましょう。どうせだから。

// いろいろごたごたあったけどメインシェーダは（gl_PointSize=1.0;以外）完全に合ってたし。
// 自信もっていいと思う。webgl2機能多いし、webgl1であってもやってない仕様いっぱいあるし。
// ゆっくり行こー

// だめですね。
// ただこれをコピペを繰り返して直してしまうと
// 学びが何にもないから
// だめなんですよ。

// 原因分かりました。またgl_PointSize=1.0でした、...なぜ？？？なぜ同じところで？？？
// チェックシート...いや、慣れ、だな。

// gl_VertexID使えましたね。やったぁ。

// あっさり（おい）
// あっさり。さすがにもう波乱はないか、...
// これ使って正方形の位置をいじれれば（速度は回転量とかに使う）、メッシュでもいけるね。

// 20221024
// data格納時とdataUpdate時のyFlipは要らないと思うんだ。暇があったら試してみて、ていうか頭使えば分かると思う。
// 両方外したけど問題ありませんでした。なるほど。データをそのまま使う場合は問題ないわけね。

// ----------------------------------------------------------------------------------------- //
// global.

const ex = p5wgex;
let _node;

// ----------------------------------------------------------------------------------------- //
// constants.

const SIZE = 32;

// ----------------------------------------------------------------------------------------- //
// shaders.

// データステージ。ここでは32x32個のvec4を用意された32x32のフレームバッファに放り込みます。
const dataVert =
`#version 300 es
in vec4 aData;
out vec4 vData;
uniform float uSize;
void main(){
  float index = float(gl_VertexID); // 使えるようです。やったね。
  vec2 p = vec2(mod(index, uSize), floor(index / uSize)) + 0.5;
  p /= uSize;
  p = (p - 0.5) * 2.0;
  gl_Position = vec4(p, 0.0, 1.0);
  vData = aData;
  gl_PointSize = 1.0; // おかしいな。またこいつか。何で？？
}
`;

const dataFrag =
`#version 300 es
precision highp float;
in vec4 vData;
out vec4 pv; // position/velocityなのでpvで。
void main(){
  pv = vData;
}
`;

// updateステージ。
// 板ポリ芸です。ですが、pixelDensityの問題があるので、こっちであれを渡す...ことはして、いませんね。
// 直しました。というわけでいつもの板ポリ芸です。pavelさん万歳。
const updateVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// 単純に反射処理でいいです。
const updateFrag =
`#version 300 es
precision highp float;
in vec2 vUv; // フェッチ用
uniform sampler2D uTex; // readのデータ
out vec4 pv; // 結果
void main(){
  vec4 data = texture(uTex, vUv);
  vec2 p = data.xy;  // 位置
  vec2 v = data.zw;  // 速度
  if(p.x + v.x < -0.999 || p.x + v.x > 0.999){ v.x *= -1.0; }
  if(p.y + v.y < -0.999 || p.y + v.y > 0.999){ v.y *= -1.0; }
  p += v;
  pv = vec4(p, v); // うん、色とは限らないから分かりやすくていいよね。
}
`;

// さすがに何にもないとまずいので...まあいいか。
// 使い方次第ですね。付随させる必要がなくなるのは有難いわね。
// 個人的な意見としては仕様変更とか考えると、
// aIndexありじゃないですかね。こういうのはマナーとして明示すべきじゃないでしょうか。そう思う。今回は実験なのでね。やったけどね。
const colorVert =
`#version 300 es
in float aIndex; // ダミー。全部0. ただ、attributeって1回は登場させないといけないらしくて...あんま意味ないな。
uniform float uSize;
uniform float uPointSize;
uniform sampler2D uTex;
void main(){
  float index = float(gl_VertexID) + aIndex;
  vec2 p = vec2(mod(index, uSize), floor(index / uSize)) + 0.5;
  p /= uSize;
  vec4 data = texture(uTex, p);
  gl_Position = vec4(data.xy, 0.0, 1.0);
  gl_PointSize = uPointSize;
}
`;

// こんなもんでいいか。
const colorFrag =
`#version 300 es
precision highp float;
out vec4 fragColor;
void main(){
  vec2 p = (gl_PointCoord.xy - 0.5) * 2.0;
  if(length(p) > 1.0){ discard; }
  vec3 col = vec3(0.4, 0.7, 1.0);
  col *= pow(1.0 - length(p), 2.0);
  fragColor = vec4(col, 1.0);
}
`

// ----------------------------------------------------------------------------------------- //
// main code.

function setup(){
  createCanvas(640, 640, WEBGL);
  const gl = this._renderer.GL;
  _node = new ex.RenderNode(gl);

  // Painter.
  _node.registPainter("data", dataVert, dataFrag);
  _node.registPainter("update", updateVert, updateFrag);
  _node.registPainter("color", colorVert, colorFrag);

  // Figure.
  let indexArray = [];
  let dataArray = [];
  for(let i = 0; i < SIZE*SIZE; i++){
    const x = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const y = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const _speed = 0.002 + 0.01 * Math.random();
    const _direction = Math.PI * 2.0 * Math.random();
    dataArray.push(x, y, _speed * Math.cos(_direction), _speed * Math.sin(_direction));
    indexArray.push(i);
  }
  _node.registFigure("data", [{name:"aData", size:4, data:dataArray}]);
  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1, -1, 1, -1, -1, 1, 1, 1]}]);
  _node.registFigure("indices", [{name:"aIndex", size:1, data: new Array(SIZE*SIZE).fill(0)}]); // これでOKってこと？

  //_node.registDoubleFBO("sprites", {w:SIZE, h:SIZE, textureType:"float"});
  _node.registDoubleFBO("sprites", {w:SIZE, h:SIZE, color:{info:{type:"float"}}});

  _node.clearColor(0, 0, 0, 1);

  // データ入力
  _node.bindFBO("sprites");
  _node.use("data", "data");
  _node.setUniform("uSize", SIZE);
  _node.drawArrays("points");
  _node.swapFBO("sprites");
  _node.unbind();
}

// 同じものをコピーしたいわけじゃないんです。#version 300 esを試したいだけなんです。だからコピペして終わりじゃないんです。
// たとえて言うなら模写をコンビニのコピーで済ますようなもので、無意味です。
function draw(){

  // メインディッシュの調理と行こうか
  _node.bindFBO("sprites");
  _node.use("update", "board");
  _node.setFBOtexture2D("uTex", "sprites");
  _node.drawArrays("triangle_strip");
  _node.swapFBO("sprites");
  _node.unbind();

  _node.enable("blend");
  _node.blendFunc("one", "one");

  // 点描画
  _node.bindFBO(null);
  _node.clear();
  _node.use("color", "indices");
  _node.setFBOtexture2D("uTex", "sprites");
  _node.setUniform("uSize", SIZE);
  _node.setUniform("uPointSize", 16.0 * pixelDensity());
  _node.drawArrays("points");
  _node.unbind();
  _node.flush();

  _node.disable("blend");
}
