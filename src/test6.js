// 息切れとか言われたらあほみたいなので、あれしたいとかこれしたいとか
// まとめとこ
// h_doxasさんのサイトのバンプマッピング以降色々
// webgl2ならではの機能一通り（インスタンシングとらふぃーまるちれんだーetc etc etc...）
// あとGPUパーティクルもとりあえずやっとこうか。メッシュでも書こう。
// もちろんブルームも移すつもりだし...
// クォータニオンを使ったカメラの移動、よくわかんないけど・・なんか使い方間違ってそう。
// クォータニオンってロボットの腕の制御とかに使うんじゃないの？知らんけど。こう、手をくるっくるって回すのとか。

// 時間がいくらあっても足りないからちょっとずつ消化してくつもり

// 手始めに三角形に落とす。正三角形。さっきのを。GPGPUで三角形をまわす。反射そのままでいい。

// ああー、3次元か、3次元でやりたいわね。その前に円でやりたい。そのあと立方体、出来れば球でも...やりたいね...
// んでカメラでいろんな方向から見る
// あああと、複数の画面でカメラ複数用意して、とかやりたいのよね。4画面くらいで。
// あああとあれ、レイマーチングの可視化。あれも出来ると思う。

// 影も...ああ、キューブマッピング！

// こんなもんでしょ。とりあえず。

// -------global------- //
const ex = p5wgex;
let _node;
let _startTime;

// -------constants------- //
const SIZE = 32;

// -------shaders------- //
// dataステージ。
// ここでは32x32個のvec4を用意された32x32のフレームバッファに放り込みます。
const dataVert =
`#version 300 es
precision mediump float;
in vec4 aData;
out vec4 vData;
uniform float uSize;
void main(){
  float index = float(gl_VertexID); // 使えるようです。やったね。
  vec2 p = vec2(mod(index, uSize), floor(index / uSize)) + 0.5;
  p /= uSize;
  p = (p - 0.5) * 2.0;
  p.y = -p.y;
  gl_Position = vec4(p, 0.0, 1.0);
  vData = aData;
  gl_PointSize = 1.0; // おかしいな。またこいつか。何で？？
}
`;

const dataFrag =
`#version 300 es
precision mediump float;
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
precision mediump float;
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// 単純に反射処理でいいです。
const updateFrag =
`#version 300 es
precision mediump float;
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

// 今回はcolorステージの代わりに、ここまでで作られる位置情報と速度情報に基づき、
// 三角形をくるくる飛ばして回します。
// イメージとしては32x32x3個の頂点を用意して位置をバーテックスで決める、インデックスを3で割った商で、あれして、
// 余りで位置、位相のずれは渡した時間変数と速度の大きさを掛け算してラジアン、大体そんな感じ。
const triangleVert =
`#version 300 es
precision mediump float;
in float aIndex; // 32x32x3個
in vec3 aColor; // 申し訳程度に、色
uniform float uSize; // 一応32
uniform float uRadius; // 三角形の外接円の半径。0.03でいいか。
uniform float uTime; // 回転制御用の時間変数(秒)
uniform sampler2D uTex;
out vec3 vColor; // 出力色
const float TAU = 6.28318;
void main(){
  float serial = floor(aIndex / 3.0); // シリアルナンバー
  float posId = mod(aIndex, 3.0); // 位置を決めるインデックス(0,1,2)
  vec2 coord = (vec2(mod(serial, uSize), floor(serial / uSize)) + 0.5) / uSize;
  vec4 data = texture(uTex, coord);
  vec2 p = data.xy;
  vec2 v = data.zw;
  float phase = TAU * posId / 3.0 + length(v) * TAU * uTime * 100.0; // 速度で回転角
  vec2 position = p + uRadius * vec2(cos(phase), sin(phase));
  gl_Position = vec4(position, 0.0, 1.0);
  vColor = aColor;
}
`;

// 色塗るだけ
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
  const _gl = this._renderer;
  _node = new ex.RenderNode(_gl);

  _startTime = performance.now();

  // Painter用意する
  _node.registPainter("data", dataVert, dataFrag)
       .registPainter("update", updateVert, updateFrag)
       .registPainter("triangle", triangleVert, triangleFrag);

  // Figure用意する。
  let dataArray = [];
  for(let i = 0; i < SIZE*SIZE; i++){
    const x = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const y = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const _speed = 0.002 + 0.01 * Math.random();
    const _direction = Math.PI * 2.0 * Math.random();
    dataArray.push(x, y, _speed * Math.cos(_direction), _speed * Math.sin(_direction));
  }
  _node.registFigure("data", [{name:"aData", size:4, data:dataArray}]); // gl_VertexID使うので。
  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1, -1, 1, -1, -1, 1, 1, 1]}]);

  // 三角形について。今回カメラは無し。正規化デバイス使う。位置は都度決めるのでからっぽでOK.
  // というかインデックスだけでいいや。32x32x3個。それとIBOをこしらえましょう。
  let indexArray = [];
  let colorArray = []; // ちょっと色付けを...
  for(let i = 0; i < SIZE*SIZE*3; i++){
    indexArray.push(i);
    const col = ex.hsv2rgb(0.4 + 0.25 * Math.random(), 0.7 + 0.3 * Math.random(), 0.3+0.6*Math.random());
    colorArray.push(col.r, col.g, col.b);
  }
  _node.registFigure("triangles", [{name:"aIndex", size:1, data:indexArray}, {name:"aColor", size:3, data:colorArray}]);
  _node.registIBO("triangleIBO", {data:indexArray}); // そのまま使える

  // フレームバッファ
  _node.registDoubleFBO("sprites", {w:SIZE, h:SIZE, textureType:"float"});

  _node.clearColor(0, 0, 0, 1);

  // データの格納
  _node.bindFBO("sprites")
       .use("data", "data")
       .setUniform("uSize", SIZE)
       .drawArrays("points")
       .swapFBO("sprites")
       .unbind();
  // ほんとにこんなのでいいのか...不安になる（おい）
}

// -------draw------- //
function draw(){
  // データのアップデート
  _node.bindFBO("sprites")
       .use("update", "board")
       .setFBOtexture2D("uTex", "sprites")
       .drawArrays("triangle_strip")
       .swapFBO("sprites")
       .unbind();
  // いやほんとにこんなので...？

  _node.enable("blend")
       .blendFunc("one", "one");

  // メインコード。データを元に三角形を大量に描画する。
  _node.bindFBO(null)
       .clear()
       .use("triangle", "triangles")
       .setFBOtexture2D("uTex", "sprites")
       .bindIBO("triangleIBO")
       .setUniform("uSize", SIZE)
       .setUniform("uRadius", 0.03)
       .setUniform("uTime", (performance.now() - _startTime) / 1000)
       .drawElements("triangles")
       .unbind()
       .flush();

  _node.disable("blend");

  //noLoop();
}
