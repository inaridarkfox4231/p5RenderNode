// とりあえず3次元の回転の前に2次元の回転で腕試し

// カメラ正面でxy平面内で。できるはず。

// だめですね...視点によっては消える。原因は、不明...
// じゃねぇよ。距離計算が不連続関数になってるから...しかも場合によっては距離になってなくて当たるのに
// すっとんでっちゃってるんだよ。間違えて当然。ちょっと待ってな。

// なるほど。隣接する点を使うのか。これならいけるかな...いけるのかな...んー。
// というわけで実験しなければなるまい。

// まあナイーブにあの3つで...

// foldA3Rotateこれでいいっぽいな...負荷が大きいけど（パソコンから変な音出た）
// 負荷が大きいのは仕方ないとして計算は合ってるっぽいです。やっぱ隣接取らないと駄目なんだな。

// 球でうまくいったのはいいけど平面の方はダメダメですね。んー。
// やっぱ連続関数になるように並べないといけないんだけどアイデアが無い。
// まずは同じことを...あっちでやってみないと、だめね。

// foldA3Rotate機能してるっぽいので、BC3とH3でもやってみて、あれを当てはめられるかどうか見る感じ...んー
// でも境界を共有してれば出来ると思うんだけどおかしいね。

// できた！
// つまり平面とかでああいうの作る場合、全部必要とは限らないということ...ああ難しいわ！
// 計算通りだけど...洗練させる必要しか感じないわ...まあ、この調子でBC3とH3のfoldRotateもよろしくね...
// てかその前にBC3とH3作ってや。その前にカメラ仕様変更。

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
uniform vec3 uTop; // 画面手前方向...マイナスで使う。
uniform vec3 uLightDirection; // 光を使う場合。光の進む向き。マイナスで使って法線と内積を取る。

uniform float uTime; // じか～ん

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

// foldA3用
vec3 ma = vec3(1.0, 0.0, 0.0);
vec3 mb = vec3(-0.5, -0.5, 0.7071);
vec3 mc = vec3(-0.5, 0.5, 0.7071);
vec3 md = vec3(0.5, -0.5, 0.7071);

// foldA3の基本領域用
vec3 q0 = vec3(0.0, -1.0, 0.7071);
vec3 q1 = vec3(0.3333, 0.0, 0.2357);
vec3 q2 = vec3(0.0, 1.0, 0.7071);

//vec3 l0 = normalize(vec3(sqrt(0.5), -sqrt(2.0)/3.0, -1.0));
//vec3 l1 = normalize(vec3(5.0*sqrt(2.0)/6.0, sqrt(2.0)/3.0, -1.0/3.0));
//vec3 l2 = normalize(vec3(-sqrt(2.0), 0.0, 2.0));
vec3 l0, l1, l2;

// 折り畳み処理。A3の場合は3回。具体的にはna, nb, ncのそれぞれについてそれと反対にあるときだけ面で鏡写しにする。
void foldA3(inout vec3 p){
  for(int i = 0; i < 3; i++){
    p -= 2.0 * min(0.0, dot(p, na)) * na;
    p -= 2.0 * min(0.0, dot(p, nb)) * nb;
    p -= 2.0 * min(0.0, dot(p, nc)) * nc;
  }
}

bool check(vec3 p){
  if(dot(p, ma) < 0.0){ return true; }
  if(dot(p, mb) < 0.0){ return true; }
  if(dot(p, mc) < 0.0){ return true; }
  return false;
}

void foldA3Rotate(inout vec3 p){
  if(p.y < 0.0){
    p -= 2.0*dot(p,na)*na; p -= 2.0*dot(p,nb)*nb;
  }
  for(int i=0; i<3; i++){
    if(dot(p, ma) < 0.0 || dot(p, md) < 0.0){
      p -= 2.0*dot(p,nc)*nc; p -= 2.0*dot(p,na)*na;
    }
  }
  for(int i=0; i<3; i++){
    if(dot(p, ma) < 0.0 || dot(p, mb) < 0.0 || dot(p, mc) < 0.0){
      p -= 2.0*dot(p,nb)*nb; p -= 2.0*dot(p,nc)*nc;
    }
  }
}

// 距離関数
// 簡単なものでいいです。qは計算済みとする。qは基本領域のどっか。
float foldA3RotateTest_0(vec3 p){

  //vec3 q = p;
  //foldA3(q);
  //float t = dot(q-qca*0.8, pbc);

  foldA3Rotate(p);
  vec3 p0 = p - 2.0*dot(p,na)*na;
  p0 -= 2.0*dot(p0,nb)*nb;
  vec3 p1 = p - 2.0*dot(p,nb)*nb;
  p1 -= 2.0*dot(p1,nc)*nc;
  vec3 p2 = p - 2.0*dot(p,nc)*nc;
  p2 -= 2.0*dot(p2,nb)*nb;


  //t = min(t, length(p - uniqueQ) - 0.05);
  // 隣接を取ってそれに対しても計算してmin取る感じで
  //t = min(t, length(p0 - uniqueQ) - 0.05);
  //t = min(t, length(p1 - uniqueQ) - 0.05);
  //t = min(t, length(p2 - uniqueQ) - 0.05);

  l0 = normalize(cross(q0-uniqueQ, q1-uniqueQ));
  l1 = normalize(cross(q1-uniqueQ, q2-uniqueQ));
  l2 = normalize(cross(q2-uniqueQ, q0-uniqueQ));

  vec3 _q = uniqueQ*0.3;

  float t = max(max(dot(p-_q, l0), dot(p-_q, l1)), dot(p-_q, l2));
  //t = min(t, max(max(dot(p0-_q, l0), dot(p0-_q, l1)), dot(p0-_q, l2))); // これ要らなかったわ、まじか...
  t = min(t, max(max(dot(p1-_q, l0), dot(p1-_q, l1)), dot(p1-_q, l2)));
  t = min(t, max(max(dot(p2-_q, l0), dot(p2-_q, l1)), dot(p2-_q, l2)));

  // これで計算通り！お疲れさまでした...
  // p0が不要だったということですね。ああ、難しい...

  return t;
}

// いいやとりあえず、うん。

// 総合距離関数、map. 色も返せる。今回はテストなので半径0.3の球で。
vec4 map(vec3 p){
  vec3 col = vec3(1.0);
  float t = foldA3RotateTest_0(p);
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
  vec3 coeff = vec3(2.0 + 1.5 * sin(uTime * 6.28 * 0.25), 2.0 + 1.5 * cos(uTime * 6.28 * 0.25), 1.0);
  uniqueQ = (coeff.x * q0 + coeff.y * q1 + coeff.z * q2) / (coeff.x + coeff.y + coeff.z);

  uniqueQ = vec3(1.0, -1.0, 1.414) * 2.0;

  // 背景色
  vec3 color = vec3(0.0);
  // rayを計算する
  vec3 ray = vec3(0.0);
  // uTopだけマイナス、これで近づく形。さらにuSideで右、uUpで上に。分かりやすいね。
  ray -= uTop;
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
  }
  fragColor = vec4(color, 1.0); // これでOK?
}
`;

// info用
let copyVert =
`#version 300 es

in vec2 aPosition;
out vec2 vUv; // vertexStageのvaryingはoutで、

void main(void){
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

let copyFrag =
`#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv; // fragmentStageのinと呼応するシステム。vertexStageのinはattributeなので
uniform sampler2D uTex;
out vec4 fragColor;

void main(void){
  fragColor = texture(uTex, vUv); // なんとtextureでいいらしい...！
}
`;

// ----setup---- //
function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  _timer.set("currentTime");

  // for ray marching.

  const positions = [-1,-1,1,-1,-1,1,1,1];
  _node.registPainter("rayM", rayMVert, rayMFrag);
  _node.registFigure("board", [{name:"aPosition", size:2, data:positions}]);

  // for info.
  _node.registPainter("copy", copyVert, copyFrag);
  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1,-1,1,-1,-1,1,1,1]}]);

  info = createGraphics(width, height);
  info.fill(255);
  info.noStroke();
  info.textSize(16);
  info.textAlign(LEFT, TOP);
  infoTex = new p5.Texture(this._renderer, info);

	_timer.set("fps"); // 最初に1回だけ

  // clearColor.
  _node.clearColor(0,0,0,1);

  // カメラ
  cam = new ex.CameraEx(width, height);
}

// ----draw---- //
function draw(){
  const currentTime = _timer.getDeltaSecond("currentTime"); // そのうち
  const fps = _timer.getDeltaFPStext("fps", frameRate());
	_timer.set("fps");

  _node.bindFBO(null)
       .clear();

  // レイマーチングスタート
  _node.use("rayM", "board")

  // カメラ設定
  moveCamera(currentTime);
  setCameraParameter();

  // 光の設定、レンダリング
  //_node.setUniform("uLightDirection", [-1, -1, -1]);
  _node.drawArrays("triangle_strip")
       .unbind();

  // for info.
  showPerformance(fps);
}

function moveCamera(currentTime){
  // 動かしてみる。マウスで動かしてもいいと思う。
  const curTime = _timer.getDeltaSecond("currentTime");
  const r = Math.sqrt(3)*2; // カメラと中心との距離
  const theta = Math.PI*0.3 * Math.sin(currentTime * Math.PI*2 * 0.2); // 縦方向の振れ幅
  const phi = Math.PI*2 * currentTime * 0.2; // 周回
  const _x = r * sin(phi) * cos(theta);
  const _y = r * sin(theta);
  const _z = r * cos(phi) * cos(theta);
  cam.setView({eye:{x:_x, y:_y, z:_z}});
}
function setCameraParameter(){
  // 目の位置：z軸正方向√3
  // fovとaspectはいつもの。
  // uSideは(1,0,0).
  // uUpは(0,1,0), upなんだから上向かなきゃ。
  // uTopも(0,0,1)ですっきり。

  // まずgetViewData.
  const viewData = cam.getViewData();
  const perseData = cam.getPerseParam();
  const {side, up, top, eye} = viewData;
  const {fov, aspect} = perseData;
  _node.setUniform("uEye", [eye.x, eye.y, eye.z])
       .setUniform("uFov", fov)
       .setUniform("uAspect", aspect)
       .setUniform("uSide", [side.x, side.y, side.z])
       .setUniform("uUp", [up.x, up.y, up.z])
       .setUniform("uTop", [top.x, top.y, top.z])
       .setUniform("uLightDirection", [-top.x, -top.y, -top.z]); // 面倒なので見る方向の後方から光を当てよう
}

function showPerformance(fps){
  _node.enable("blend")
       .blendFunc("one", "one_minus_src_alpha");

  _node.use("copy", "board")
       .setTexture2D("uTex", infoTex.glTex)
       .drawArrays("triangle_strip")
       .unbind()
       .flush()
       .disable("blend");

  info.clear();
  info.text("fpsRate:" + fps, 5, 5);
  info.text("frameRate:" + frameRate().toFixed(2), 5, 25);
  infoTex.update();
}
