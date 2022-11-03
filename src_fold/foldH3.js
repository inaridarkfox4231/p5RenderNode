// H3.

// phi = (1.0+sqrt(5.0))/2.0. //(黄金比)
// na=(1.0,0.0,0.0);
// nb=(0.0,1.0,0.0);
// nc=(-0.5, -phi*0.5, (phi - 1.0) * 0.5);
// qab=(0.0,0.0,phi*0.5);
// qbc=(0.5,0.0,phi*0.5);
// qca=(0,phi/6.0,(2.0*phi+1.0)/6.0);
// これらの正規化pab,pbc,pcaは有するa,b,cのnと直交する。たとえばpabはna,nbに直交する。
// 基本領域はqab,qbc,qcaで反時計回り、それにより表現されるところの三角形。
// で、qcaでやると正十二面体、qbcでやると正二十面体になりますね...

// イメージとしてはqbcでやるっていうのはqbcをna,nb,ncで複製するとあの頂点になるから正二十面体、
// qcaだと面の重心をつなぐから正十二面体。最後にqabの場合辺の中点をつなぐから正三角形と正五角形の組み合わせ。

// 面の法線ベクトルがqcaなのは確かだけど、だからこそというか。0,0,1にすると、uniqueQはqcaのサイズ倍で、
// これを移した点たちでできるあれになる。だってna,ncで動かないからね。まあそんな感じ。はい。慣れて...

// (1.0, 0.0, 0.0):二十・十二面体
// (0.0, 1.0, 0.0):正二十面体
// (0.0, 0.0, 1.0):正十二面体
// (1.0 / sqrt(5.0), 0.0, 1.0 - 1.0 / sqrt(5.0)):切頂十二面体
// (2.0 / 3.0, 1.0 / 3.0, 0.0):切頂二十面体（サッカーボール型）
// (0.0, k, 3.0)/(k + 3.0):斜方二十・十二面体（kは黄金比）
// ((t - 1.0) / 3.0, (t - 1.0) / 6.0, (3.0 - t) / 2.0):
// 斜方切頂二十・十二面体（tは√5）

// 小星型十二面体
// (0,0,1)において(-0.5, 0, k*0.5) (kは黄金比）
// 大十二面体
// (0,0,1)において(0, k*0.5, 0.5)
// 大星型十二面体
// (0,0,1)において(0, -k*0.5, 0.5)
// 小三角六辺形二十面体
// (0,0,1)において(0, -k/6, (2k+1)/6)
// 正八面体の複合多面体（正二十面体の星型3）
// (0,0,1)において((k+1)/6, (k+1)/6, (k+1)/6)
// 菱形三十面体
// (0,0,1)において(0, 0, k*0.5)（隣り合う三角形が持ち上がり同一平面）

// 大二十面体
// (0,0,1)において((2k+1)/6, 0, k/6), (-(k+1)/6, -(k+1)/6, (k+1)/6)
// を法とする平面でminを取る。

// 完全二十面体。
// kは黄金比とするとき、
// (0,0,1)において、(k/6, (2k+1)/6, 0), (-(2k+1)/6, 0, k/6)
// を法とする平面でmaxを取る。

// 十二・十二面体
// kは黄金比とするとき、
// (1,0,0)(というかpab)において(0, k/2, 1/2), (1/2, 0, k/2)
// を法とする平面でmaxを取る。

// 16種類。圧巻。
// やり方
// まず5種類に分ける
// 初めのやつはSTANDARD
// つぎのやつはCUSTOM
// 最後の3つはOTHER_0, OTHER_1, OTHER_2でいく
// STANDARDは今のやつでベクトルだけ変える
// CUSTOMはpcaに限ったうえでベクトルだけ変える
// 残りは完全に個別で制御
// 今uniqueQってやってるところをuniformにして一つ増やす感じ

// 外部のベクトルは3つ。1つはuniqueQ構成用の係数、残り2つはSTANDARD以外のパターンを記述するためのもの。
// どう使うかをインデックスで指定するだけ。ラクチン。

// 13と14がクソ重いです。
// ただもはやどうでもいいな。おしまい。
// shadertoyだとそれなりに速かったんで
// ただパソコンは悲鳴上げてたけど
// ここら辺が限界かな...さ、やめるか。

// ----global---- //
const ex = p5wgex;
let _node;
let _timer = new ex.Timer();
let info, infoTex;

const uniqueQ = new ex.Vec3(0);
const _qab = new ex.Vec3(0, 0, 0.8090);
const _qbc = new ex.Vec3(0.5, 0, 0.8090);
const _qca = new ex.Vec3(0, 0.2697, 0.7060);

const defaultPolygonArray = (function(){
  const result = [];
  const k = 1.618;
  const t = 2.236;
  result.push([1, 0, 0], [0, 1, 0], [0, 0, 1],
              [1/t, 0, 1-1/t], [2/3, 1/3, 0], [0, k/(3+k), 3/(3+k)], [(t-1)/3, (t-1)/6,(3-t)/2]);
  return result;
})();
const customPolygonArray = (function(){
  const result = [];
  const k = 1.618;

  result.push([-1/2, 0, k/2], [0, k/2, 1/2], [0, -k/2, 1/2],
              [0, -k/6, (2*k+1)/6], [(k+1)/6, (k+1)/6, (k+1)/6], [0, 0, k/2]);
  return result;
})();
// 0:0.6, 1:0.6, 2:0.6, 3:0.6, 4:0.6, 5:0.6, 6:0.6, 7:0.4, 8:0.4, 9:0.7, 10:0.7,
// 11:0.55, 12:0.6, 13:0.4, 14:0.25, 15:0.6
const sizeArray = [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.4, 0.4, 0.7, 0.7, 0.55, 0.6, 0.4, 0.25, 0.6];

const polygonNames_jp = ["二十・十二面体", "正二十面体", "正十二面体", "切頂十二面体", "切頂二十面体", "斜方二十・十二面体",
							           "斜方切頂二十・十二面体", "小星型十二面体", "大十二面体", "大星型十二面体", "小三角六辺形二十面体",
							           "正八面体の複合多面体", "菱形三十面体", "大二十面体", "完全二十面体", "十二・十二面体"];
const polygonNames_en = ["icosidodecahedron", "icosahedron", "dodecahedron", "truncated dodecahedron",
                         "truncated icosahedron", "rhombicosidodecahedron", "rhombitruncated icosidodecahedron",
                         "Small stellated dodecahedron", "Great dodecahedron", "Great stellated dodecahedron",
                         "small triambic icosahedron", "Polyhedral compound of octahedrons", "rhombic triacontahedron",
                         "Great icosahedron", "Final stellation of the icosahedron", "dodecadodecahedron"];

// カメラ
let cam;

// -------config------- //

const config = {
  patternId:0,
  pause:false,
}

function createGUI(){
  const gui = new lil.GUI();
  // 手始めに
  gui.add(config, "patternId", {"二十・十二面体":0, "正二十面体":1, "正十二面体":2, "切頂十二面体":3, "切頂二十面体":4,
                                "斜方二十・十二面体":5, "斜方切頂二十・十二面体":6, "小星型十二面体":7, "大十二面体":8,
                                "大星型十二面体":9, "小三角六辺形二十面体":10, "正八面体の複合多面体":11, "菱形三十面体":12,
                                "大二十面体":13, "完全二十面体":14, "十二・十二面体":15});
  gui.add(config, "pause").onChange(value => {
    if(value){ _timer.pause("cur"); }else{ _timer.reStart("cur"); }
  });
}

// ----shaders---- //
const rayMVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition; // 今回はそのまま渡す。y軸が上...これで。
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const rayMFrag =
`#version 300 es
precision highp float;

uniform vec3 uEye; // 目線の位置
uniform float uFov; // fov, 視野角（上下開き、デフォルト60°）
uniform float uAspect; // アスペクト比、横長さ/縦長さ（W/H）
uniform vec3 uSide; // 画面右方向
uniform vec3 uUp; // 画面下方向で、マイナスで使う
uniform vec3 uFront; // 画面手前方向...マイナスで使う。
uniform vec3 uLightDirection; // 光を使う場合。光の進む向き。マイナスで使って法線と内積を取る。

// 計算用外部入力変数
uniform int uId;
uniform vec3 uVector0; // coeffとqab, qbc, qcaから事前に計算して渡す
uniform vec3 uVector1;
uniform vec3 uVector2;

in vec2 vUv;

const float MAX_DIST = 20.0;   // 限界距離。これ越えたら無いとみなす。
const float THRESHOLD = 0.001; // 閾値。これより近付いたら到達とみなす。
const int ITERATION = 80; // マーチング回数限界
const vec2 EPS = vec2(0.0001, 0.0); // 法線計算用

out vec4 fragColor;

//vec3 uniqueQ; // グローバル～基本領域のどっか

// fold用const.
const float phi = (1.0+sqrt(5.0))/2.0; //(黄金比)
// ミラーベクトル
vec3 na = vec3(1.0, 0.0, 0.0);
vec3 nb = vec3(0.0, 1.0, 0.0);
vec3 nc = vec3(-0.5, -0.8090, 0.3090);
// na,nb,ncの外積でできる領域面の境界の法線ベクトル。これで平面を作り、fold立体の面を作る。
vec3 pab = vec3(0.0, 0.0, 0.8090);
vec3 pbc = vec3(0.5, 0.0, 0.8090);
vec3 pca = vec3(0.0, 0.2697, 0.7060);

// 折り畳み処理。H3の場合は5回。具体的にはna, nb, ncのそれぞれについてそれと反対にあるときだけ面で鏡写しにする。
void foldH3(inout vec3 p){
  for(int i = 0; i < 5; i++){
    p -= 2.0 * min(0.0, dot(p, na)) * na;
    p -= 2.0 * min(0.0, dot(p, nb)) * nb;
    p -= 2.0 * min(0.0, dot(p, nc)) * nc;
  }
}

// まずSTANDARD, これはpab,pbc,pcaでそれぞれ平面取るもの
float foldH3DefaultPolygon(vec3 p, vec3 q){
  foldH3(p);
  float t = dot(p - q, pab);
  t = max(t, dot(p - q, pbc));
  t = max(t, dot(p - q, pca));
  return t;
}

// pca限定で、特別なベクトルで平面を取るもの
float foldH3CustomPolygon(vec3 p, vec3 q1, vec3 q2){
  foldH3(p);
  float t = dot(p - q1, q2);
  return t;
}

float foldH3OtherMinPolygon(vec3 p, vec3 q1, vec3 q2, vec3 q3){
  foldH3(p);
  float t = min(dot(p - q1, q2), dot(p - q1, q3));
  return t;
}

float foldH3OtherMaxPolygon(vec3 p, vec3 q1, vec3 q2, vec3 q3){
  foldH3(p);
  float t = max(dot(p - q1, q2), dot(p - q1, q3));
  return t;
}

// 総合距離関数、map.
vec4 map(vec3 p){
  vec3 col = vec3(1.0);
  float t = 0.0;
  if(uId == 0){ t = foldH3DefaultPolygon(p, uVector0); }
  if(uId == 1){ t = foldH3CustomPolygon(p, uVector0, uVector1); }
  if(uId == 2){ t = foldH3OtherMinPolygon(p, uVector0, uVector1, uVector2); }
  if(uId == 3){ t = foldH3OtherMaxPolygon(p, uVector0, uVector1, uVector2); }
  return vec4(col, t);
}
// 法線ベクトルの取得
vec3 calcNormal(vec3 p){
  // F(x, y, z) = 0があらわす曲面の、F(x, y, z)が正になる側の
  // 法線を取得するための数学的処理。具体的には偏微分、分母はカット。
  vec3 n;
  n.x = map(p + EPS.xyy).w - map(p - EPS.xyy).w;
  n.y = map(p + EPS.yxy).w - map(p - EPS.yxy).w;
  n.z = map(p + EPS.yyx).w - map(p - EPS.yyx).w;
  return normalize(n);
}
// マーチング
float march(vec3 ray, vec3 eye){
  float h = THRESHOLD * 2.0; // 毎フレームの見積もり関数の値。
  // 初期値は0.0で初期化されてほしくないのでそうでない値を与えてる。
  // これがTHRESHOLDを下回れば到達とみなす
  float t = 0.0;
  // tはcameraからray方向に進んだ距離の累計。
  // 到達ならこれが返る。失敗なら-1.0が返る。つまりresultが返る。
  float result = -1.0;
  for(int i = 0; i < ITERATION; i++){
    if(h < THRESHOLD || t > MAX_DIST){ break; }
    // tだけ進んだ位置で見積もり関数の値hを取得し、tに足す。
    h = map(eye + t * ray).w;
    t += h;
  }
  // t < MAX_DISTなら、h < THRESHOLDで返ったということなのでマーチング成功。
  if(t < MAX_DIST){ result = t; }
  return result;
}
// メイン
void main(){

  // 背景色
  vec3 color = vec3(0.0);
  float alpha = 0.0;
  // rayを計算する
  vec3 ray = vec3(0.0);
  // uTopだけマイナス、これで近づく形。さらにuSideで右、uUpで上に。分かりやすいね。
  ray -= uFront;
  ray += uSide * uAspect * tan(uFov * 0.5) * vUv.x;
  ray += uUp * tan(uFov * 0.5) * vUv.y;
  ray = normalize(ray);
  // レイマーチング
  float t = march(ray, uEye);
  // tはマーチングに失敗すると-1.0が返る。
  if(t > -THRESHOLD){
    vec3 pos = uEye + t * ray; // 到達位置
    vec3 n = calcNormal(pos); // 法線
    // 明るさ。内積の値に応じて0.3を最小とし1.0まで動かす。
    float diff = clamp((dot(n, -uLightDirection) + 0.5) * 0.75, 0.3, 1.0);
    //vec3 baseColor = map(pos).xyz; // bodyColor取得。
    vec3 baseColor = 0.5+0.5*n; // 面倒なのでnormalMap. 負荷もかからないし。
    baseColor *= diff;
    // 遠くでフェードアウトするように調整する
    color = mix(baseColor, color, tanh(t * 0.02));
    alpha = 1.0;
  }
  fragColor = vec4(color, alpha); // これでOK?
}
`;

// ----setup---- //
function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // for ray marching.

  const positions = [-1,-1,1,-1,-1,1,1,1];
  _node.registPainter("rayM", rayMVert, rayMFrag);
  _timer.initialize("cur");

  // info texture.
  info = createGraphics(width, height);
  info.fill(255);
  info.noStroke();
  info.textSize(16);
  _node.registTexture("info", {src:info});

  // カメラ
  cam = new ex.CameraEx({w:width, h:height, eye:[0, 0, 1.732], center:[0, 0, 0], top:[0, 1, 0]});

  // GUI
  createGUI();
}

// ----draw---- //
function draw(){
  const currentTime = _timer.getDelta("cur"); // そのうち

  _node.bindFBO(null)
       .clearColor(0,0,0,0)
       .clear();

  updateInfo();
  ex.copyPainter(_node, {src:{name:"info", gradationFlag:1, gradationStart:[0,0,0,0,0,1], gradationStop:[0,1,0.5,0.5,0.5,1]}});

  // レイマーチングスタート
  _node.use("rayM", "foxBoard");

  // カメラ設定
  moveCamera(currentTime * 0.5);
  setCameraParameter();

  _node.enable("blend").blendFunc("src_alpha", "one_minus_src_alpha");

  // パラメータ設定
  setPolygonParameter(config.patternId);
  // 光の設定、レンダリング
  _node.drawArrays("triangle_strip")
       .unbind();

  _node.disable("blend");

  _node.flush();
}

function updateInfo(){
  const gr = _node.getTextureSource("info");
  gr.clear();
  gr.textAlign(LEFT, TOP);
  gr.text("fold H3.", 5, 5);
  gr.text(frameRate().toFixed(3), 5, 25);
  gr.textAlign(CENTER, CENTER);
  gr.text(polygonNames_jp[config.patternId], width/2, height*13/16);
  gr.text(polygonNames_en[config.patternId], width/2, height*14/16);
  _node.updateTexture("info");
}

function moveCamera(currentTime){
  // 動かしてみる。マウスで動かしてもいいと思う。
  const _x = Math.sqrt(3) * Math.cos(currentTime * Math.PI*2 * 0.5);
  const _y = 0.7 * Math.sin(currentTime * Math.PI*2 * 0.4);
  const _z = Math.sqrt(3) * Math.sin(currentTime * Math.PI*2 * 0.5);
  cam.setView({eye:{x:_x, y:_y, z:_z}});
}

function setCameraParameter(){
  // 目の位置：z軸正方向√3
  // fovとaspectはいつもの。
  // uSideは(1,0,0).
  // uUpは(0,1,0), upなんだから上向かなきゃ。
  // uTopも(0,0,1)ですっきり。

  // まずgetViewData.
  const {side, up, front} = cam.getLocalAxes();
  const {eye} = cam.getViewData();
  const {fov, aspect} = cam.getProjData(); // persモードに固定してあるので

  _node.setUniform("uEye", [eye.x, eye.y, eye.z])
       .setUniform("uFov", fov)
       .setUniform("uAspect", aspect)
       .setUniform("uSide", [side.x, side.y, side.z])
       .setUniform("uUp", [up.x, up.y, up.z])
       .setUniform("uFront", [front.x, front.y, front.z])
       .setUniform("uLightDirection", [-front.x, -front.y, -front.z]); // 面倒なので見る方向の後方から光を当てよう
}

function setPolygonParameter(polygonId){
  const _size = sizeArray[polygonId];
  if(polygonId < 7){
    setParamForDefaultPolygon(polygonId, _size); return; // 0,1,2,3,4,5,6
  }
  if(polygonId < 13){
    setParamForCustomPolygon(polygonId, _size); return; // 7,8,9,10,11,12
  }
  if(polygonId < 14){
    setParamForOtherMinPolygon(polygonId, _size); return; // 13
  }
  setParamForOtherMaxPolygon(polygonId, _size); return; // 14, 15
}

function getUniqueQ(v, _size = 1){
  uniqueQ.set(0)
         .addScalar(_qab, v[0])
         .addScalar(_qbc, v[1])
         .addScalar(_qca, v[2])
         .mult(_size)
         .divide(v[0] + v[1] + v[2]);
  return uniqueQ.toArray();
}

function setParamForDefaultPolygon(polygonId, _size){
  _node.setUniform("uId", 0)
       .setUniform("uVector0", getUniqueQ(defaultPolygonArray[polygonId], _size));
}

function setParamForCustomPolygon(polygonId, _size){
  _node.setUniform("uId", 1)
       .setUniform("uVector0", getUniqueQ([0, 0, 1], _size))
       .setUniform("uVector1", customPolygonArray[polygonId - 7]);
}

function setParamForOtherMinPolygon(polygonId, _size){
  // 13限定
  const k = 1.618;
  _node.setUniform("uId", 2)
       .setUniform("uVector0", getUniqueQ([0, 0, 1], _size))
       .setUniform("uVector1", [(2*k+1)/6, 0, k/6])
       .setUniform("uVector2", [-(k+1)/6, -(k+1)/6, (k+1)/6]);
}

function setParamForOtherMaxPolygon(polygonId, _size){
  // 14と15でuCoeffが異なる
  const k = 1.618;
  _node.setUniform("uId", 3);
  if(polygonId === 14){
    _node.setUniform("uVector0", getUniqueQ([0, 0, 1], _size))
    .setUniform("uVector1", [k/6, (2*k+1)/6, 0])
    .setUniform("uVector2", [-(2*k+1)/6, 0, k/6]);
  }
  if(polygonId === 15){
    _node.setUniform("uVector0", getUniqueQ([1, 0, 0], _size))
    .setUniform("uVector1", [0, k/2, 1/2])
    .setUniform("uVector2", [1/2, 0, k/2]);
  }
}
