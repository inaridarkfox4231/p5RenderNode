// foldやってみようか。
// とりまA3.

// na=(1.0,0.0,0.0);
// nb=(0.0,1.0,0.0);
// nc=(-0.5,-0.5,1.0/sqrt(2.0));
// qab=(0.0,0.0,1.0/sqrt(2.0));
// qbc=(1.0/3.0,0.0,1.0/(3.0*sqrt(2.0)));
// qca=(0.0,1.0,1.0/sqrt(2.0));
// これらの正規化pab,pbc,pcaは有するa,b,cのnと直交する。たとえばpabはna,nbに直交する。
// 基本領域はqab,qbc,qcaで反時計回り、それにより表現されるところの三角形。
// qbcがzx平面にべったり、正四面体の頂点をあらわしてる。

// qab,qbc,qcaの線形結合でuPを取り、uPを通りpab,pbc,pcaを法線ベクトルとする3枚の平面でMAXを取る（いわゆる凸結合）。
// これだけで相当な数の星形多面体を得ることができる。それを得るにはna,nb,nc対称を取ればいい。なぜならたとえば
// pabに直交するということはその平面はna,nbに平行だからuPを通りna,nbに平行な直線を伸ばせば鏡移しで別の頂点と
// つながるでしょ。それにより辺が形成される、辺を集めると多面体ができるわけ。そういうカラクリ。

// (1.0, 0.0, 0.0) で正八面体（ややでかい）
// (0.0, 1.0, 0.0) で小さな正四面体
// (0.0, 0.0, 1.0) で大きな正四面体
// (2.0, 3.0, 1.0) で切頂八面体（計算は面内の点を取って正六角形になるようにうまくとる。正六角形と正方形からなる。）
// (2.0, 3.0, 0.0) で切頂四面体（計算は割とめんどくさい）

// 他に、法線ベクトルと頂点の組み合わせで無限のバリエーションがある。

// ----global---- //
const ex = p5wgex;
let _node;
let _timer = new ex.Timer();
let info, infoTex;

// カメラ
let cam;

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

in vec2 vUv;

const float MAX_DIST = 20.0;   // 限界距離。これ越えたら無いとみなす。
const float THRESHOLD = 0.001; // 閾値。これより近付いたら到達とみなす。
const int ITERATION = 64; // マーチング回数限界
const vec2 EPS = vec2(0.0001, 0.0); // 法線計算用

out vec4 fragColor;

vec3 uniqueQ; // グローバル～基本領域のどっか

// fold用const.
// ミラーベクトル
vec3 na = vec3(1.0, 0.0, 0.0);
vec3 nb = vec3(0.0, 1.0, 0.0);
vec3 nc = vec3(-0.5, -0.5, 0.7071);
// 基本領域の境界点（境界線と領域の交点）で、サイズを掛けて使う。
vec3 qab = vec3(0.0, 0.0, 0.7071);
vec3 qbc = vec3(0.3333, 0.0, 0.2357);
vec3 qca = vec3(0.0, 1.0, 0.7071);
// na,nb,ncの外積でできる領域面の境界の法線ベクトル。これで平面を作り、fold立体の面を作る。
vec3 pab = vec3(0.0, 0.0, 1.0);
vec3 pbc = vec3(0.8165, 0.0, 0.5773);
vec3 pca = vec3(0.0, 0.8165, 0.5773);

// 折り畳み処理。A3の場合は3回。具体的にはna, nb, ncのそれぞれについてそれと反対にあるときだけ面で鏡写しにする。
void foldA3(inout vec3 p){
  for(int i = 0; i < 3; i++){
    p -= 2.0 * min(0.0, dot(p, na)) * na;
    p -= 2.0 * min(0.0, dot(p, nb)) * nb;
    p -= 2.0 * min(0.0, dot(p, nc)) * nc;
  }
}

// 距離関数
// 簡単なものでいいです。qは計算済みとする。qは基本領域のどっか。
float foldA3DefaultPolygon(vec3 p, vec3 q){
  foldA3(p);
  float t = dot(p - q, pab);
  t = max(t, dot(p - q, pbc));
  t = max(t, dot(p - q, pca));
  return t;
}

// 総合距離関数、map. 色も返せる。今回はテストなので半径0.3の球で。
vec4 map(vec3 p){
  vec3 col = vec3(1.0);
  float t = foldA3DefaultPolygon(p, uniqueQ);
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

  // uniqueQの計算
  vec3 co = vec3(2.0, 3.0, 0.0);
  uniqueQ = (co.x * qab + co.y * qbc + co.z * qca) * 0.6 / (co.x + co.y + co.z);

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
    vec3 baseColor = map(pos).xyz; // bodyColor取得。
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
  info.textAlign(LEFT, TOP);
  _node.registTexture("info", {src:info});

  // カメラ
  cam = new ex.CameraEx({w:width, h:height, eye:[0, 0, 1.732], center:[0, 0, 0], top:[0, 1, 0]});
}

// ----draw---- //
function draw(){
  const currentTime = _timer.getDelta("cur"); // そのうち

  _node.bindFBO(null)
       .clearColor(0,0,0,0)
       .clear();

  updateInfo();
  ex.copyPainter(_node, {src:{name:"info", gradationFlag:1, gradationStart:[0,0,0,0,0,1], gradationStop:[0,1,0,0.5,0.25,1]}});

  // レイマーチングスタート
  _node.use("rayM", "foxBoard");

  // カメラ設定
  moveCamera(currentTime);
  setCameraParameter();

  _node.enable("blend").blendFunc("src_alpha", "one_minus_src_alpha");

  // 光の設定、レンダリング
  _node.drawArrays("triangle_strip")
       .unbind();

  _node.disable("blend");

  _node.flush();
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

function updateInfo(){
  const gr = _node.getTextureSource("info");
  gr.clear();
  gr.text("fold A3.", 5, 5);
  gr.text(frameRate().toFixed(3), 5, 25);
  _node.updateTexture("info");
}