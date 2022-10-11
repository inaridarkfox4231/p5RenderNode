// 変形立方体にとどめをさす。

// まずはfoldRotateBC3を作って...

// あきらめよう。


// というわけであきらめました。
// もしくは、法線全部出して、それらで。それしか。ないね。
// 面が38個あるんだから法線計算38回やればできるんよ。foldとか面倒なことしなくても。
// それでも立派なsdfだし、sdfであることには変わりないんだから、合格だよね。
// あっちも60個で...そうすれば...

// できた！！！レイマーチングで変形立方体！！！勝ち！！勝ったぞ！！！
// これにて終了。飽きた。もういいや。foldH3やって終わりにしよう。ばかばかしくなったわ。

// なんだかんだ言ってポリゴンしか勝たんね。ポリゴン最強。Blenderやろう。

// ----global---- //
const ex = p5wgex;
let _node;
let _timer = new ex.Timer();
let info, infoTex;

// カメラ
let cam2;

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
uniform vec3 uUp; // 画面上方向
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
vec3 nc = vec3(-0.5, -0.7071, 0.5);
// 基本領域の境界点（境界線と領域の交点）で、サイズを掛けて使う。
vec3 qab = vec3(0.0, 0.0, 1.0);
vec3 qbc = vec3(0.5, 0.0, 0.5);
vec3 qca = vec3(0.0, 0.7071, 1.0);
// na,nb,ncの外積でできる領域面の境界の法線ベクトル。これで平面を作り、fold立体の面を作る。
vec3 pab = vec3(0.0, 0.0, 1.0);
vec3 pbc = vec3(0.7071, 0.0, 0.7071);
vec3 pca = vec3(0.0, 0.5773, 0.8165);

vec3 n0 = vec3(0.0000, 1.0000, 0.0000);
vec3 n2 = vec3(0.7071, 0.0000, 0.7071);
vec3 n4 = vec3(-0.7071, 0.0000, 0.7071);
vec3 n6 = vec3(0.0000, -1.0000, 0.0000);
vec3 n8 = vec3(-0.7071, 0.0000, -0.7071);
vec3 n10 = vec3(0.7071, 0.0000, -0.7071);
vec3 n12 = vec3(-0.6853, 0.5773, -0.4439);
vec3 n13 = vec3(-0.2875, 0.7985, -0.5289);
vec3 n14 = vec3(-0.5289, 0.7985, 0.2875);
vec3 n15 = vec3(-0.4439, 0.5773, 0.6853);
vec3 n16 = vec3(0.2875, 0.7985, 0.5289);
vec3 n17 = vec3(0.6853, 0.5773, 0.4439);
vec3 n18 = vec3(0.4439, 0.5773, -0.6853);
vec3 n19 = vec3(0.5289, 0.7985, -0.2875);
vec3 n20 = vec3(0.4439, -0.5773, 0.6853);
vec3 n21 = vec3(0.5289, -0.7985, 0.2875);
vec3 n22 = vec3(-0.5289, -0.7985, -0.2875);
vec3 n23 = vec3(-0.4439, -0.5773, -0.6853);
vec3 n24 = vec3(-0.2875, -0.7985, 0.5289);
vec3 n25 = vec3(-0.6853, -0.5773, 0.4439);
vec3 n26 = vec3(0.6853, -0.5773, -0.4439);
vec3 n27 = vec3(0.2875, -0.7985, -0.5289);
vec3 n28 = vec3(0.1564, -0.1707, -0.9728);
vec3 n29 = vec3(-0.1564, 0.1707, -0.9728);
vec3 n30 = vec3(-0.9728, -0.1707, -0.1564);
vec3 n31 = vec3(-0.9728, 0.1707, 0.1564);
vec3 n32 = vec3(0.9728, 0.1707, -0.1564);
vec3 n33 = vec3(0.9728, -0.1707, 0.1564);
vec3 n34 = vec3(0.1564, 0.1707, 0.9728);
vec3 n35 = vec3(-0.1564, -0.1707, 0.9728);
vec3 n36 = vec3(0.0000, 0.5774, 0.8165);
vec3 n37 = vec3(0.8165, 0.5774, -0.0000);
vec3 n38 = vec3(-0.0000, 0.5774, -0.8165);
vec3 n39 = vec3(-0.8165, 0.5774, 0.0000);
vec3 n40 = vec3(0.8165, -0.5774, -0.0000);
vec3 n41 = vec3(-0.0000, -0.5774, -0.8165);
vec3 n42 = vec3(-0.8165, -0.5774, 0.0000);
vec3 n43 = vec3(0.0000, -0.5774, 0.8165);

vec3 g0 = vec3(-0.1241, 0.7071, 0.4197);
vec3 g2 = vec3(0.3522, 0.3845, 0.6478);
vec3 g4 = vec3(-0.2281, 0.2090, 0.7719);
vec3 g6 = vec3(0.1241, -0.7071, 0.4197);
vec3 g8 = vec3(-0.3522, 0.3845, -0.6478);
vec3 g10 = vec3(0.2281, 0.2090, -0.7719);
vec3 g12 = vec3(-0.7719, 0.2090, -0.2281);
vec3 g13 = vec3(-0.3522, 0.3845, -0.6478);
vec3 g14 = vec3(-0.4197, 0.7071, -0.1241);
vec3 g15 = vec3(-0.1241, 0.7071, 0.4197);
vec3 g16 = vec3(-0.1241, 0.7071, 0.4197);
vec3 g17 = vec3(0.4197, 0.7071, 0.1241);
vec3 g18 = vec3(0.2281, 0.2090, -0.7719);
vec3 g19 = vec3(0.6478, 0.3845, -0.3522);
vec3 g20 = vec3(0.2281, -0.2090, 0.7719);
vec3 g21 = vec3(0.6478, -0.3845, 0.3522);
vec3 g22 = vec3(-0.4197, -0.7071, 0.1241);
vec3 g23 = vec3(-0.1241, -0.7071, -0.4197);
vec3 g24 = vec3(0.1241, -0.7071, 0.4197);
vec3 g25 = vec3(-0.4197, -0.7071, 0.1241);
vec3 g26 = vec3(0.7719, -0.2090, -0.2281);
vec3 g27 = vec3(0.3522, -0.3845, -0.6478);
vec3 g28 = vec3(0.3522, -0.3845, -0.6478);
vec3 g29 = vec3(0.2281, 0.2090, -0.7719);
vec3 g30 = vec3(-0.6478, -0.3845, -0.3522);
vec3 g31 = vec3(-0.7719, 0.2090, -0.2281);
vec3 g32 = vec3(0.6478, 0.3845, -0.3522);
vec3 g33 = vec3(0.7719, -0.2090, -0.2281);
vec3 g34 = vec3(0.3522, 0.3845, 0.6478);
vec3 g35 = vec3(0.2281, -0.2090, 0.7719);
vec3 g36 = vec3(-0.1241, 0.7071, 0.4197);
vec3 g37 = vec3(0.4197, 0.7071, 0.1241);
vec3 g38 = vec3(0.1241, 0.7071, -0.4197);
vec3 g39 = vec3(-0.4197, 0.7071, -0.1241);
vec3 g40 = vec3(0.6478, -0.3845, 0.3522);
vec3 g41 = vec3(-0.1241, -0.7071, -0.4197);
vec3 g42 = vec3(-0.4197, -0.7071, 0.1241);
vec3 g43 = vec3(0.2281, -0.2090, 0.7719);

// 折り畳み処理。BC3の場合は4回。具体的にはna, nb, ncのそれぞれについてそれと反対にあるときだけ面で鏡写しにする。
void foldBC3(inout vec3 p){
  for(int i = 0; i < 4; i++){
    p -= 2.0 * min(0.0, dot(p, na)) * na;
    p -= 2.0 * min(0.0, dot(p, nb)) * nb;
    p -= 2.0 * min(0.0, dot(p, nc)) * nc;
  }
}

// 距離関数
// 簡単なものでいいです。qは計算済みとする。qは基本領域のどっか。
float foldBC3DefaultPolygon(vec3 p, vec3 q){
  foldBC3(p);
  float t = dot(p - q, pab);
  t = max(t, dot(p - q, pbc));
  t = max(t, dot(p - q, pca));
  return t;
}

float foldBC3Test(vec3 p){
  p *= 0.8;
  float t = dot(p - g0, n0);
  t = max(t, dot(p - g2, n2));
  t = max(t, dot(p - g4, n4));
  t = max(t, dot(p - g6, n6));
  t = max(t, dot(p - g8, n8));
  t = max(t, dot(p - g10, n10));
  t = max(t, dot(p - g12, n12));
  t = max(t, dot(p - g13, n13));
  t = max(t, dot(p - g14, n14));
  t = max(t, dot(p - g15, n15));
  t = max(t, dot(p - g16, n16));
  t = max(t, dot(p - g17, n17));
  t = max(t, dot(p - g18, n18));
  t = max(t, dot(p - g19, n19));
  t = max(t, dot(p - g20, n20));
  t = max(t, dot(p - g21, n21));
  t = max(t, dot(p - g22, n22));
  t = max(t, dot(p - g23, n23));
  t = max(t, dot(p - g24, n24));
  t = max(t, dot(p - g25, n25));
  t = max(t, dot(p - g26, n26));
  t = max(t, dot(p - g27, n27));
  t = max(t, dot(p - g28, n28));
  t = max(t, dot(p - g29, n29));
  t = max(t, dot(p - g30, n30));
  t = max(t, dot(p - g31, n31));
  t = max(t, dot(p - g32, n32));
  t = max(t, dot(p - g33, n33));
  t = max(t, dot(p - g34, n34));
  t = max(t, dot(p - g35, n35));
  t = max(t, dot(p - g36, n36));
  t = max(t, dot(p - g37, n37));
  t = max(t, dot(p - g38, n38));
  t = max(t, dot(p - g39, n39));
  t = max(t, dot(p - g40, n40));
  t = max(t, dot(p - g41, n41));
  t = max(t, dot(p - g42, n42));
  t = max(t, dot(p - g43, n43));
  return t;
}

// 総合距離関数、map. 色も返せる。今回はテストなので半径0.3の球で。
vec4 map(vec3 p){
  vec3 col = vec3(1.0);
  //float t = foldBC3DefaultPolygon(p, uniqueQ);
  float t = foldBC3Test(p);
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

// getRGB(HSBをRGBに変換する関数)
vec3 getRGB(float h, float s, float b){
  vec3 c = vec3(h, s, b);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

// メイン
void main(){

  // uniqueQの計算
  vec3 co = vec3(0.0, 2.0-sqrt(2.0), sqrt(2.0)-1.0);
  uniqueQ = (co.x * qab + co.y * qbc + co.z * qca) * 1.2 / (co.x + co.y + co.z);

  // 背景色
  vec3 color = vec3(0.0);
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
    vec3 baseColor = getRGB(0.66, pos.x*0.5+0.5, 1.0);
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
  //cam = new ex.CameraEx(width, height);
  cam2 = new ex.CameraEx2({w:width, h:height});
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
  //cam.setView({eye:{x:_x, y:_y, z:_z}});
  cam2.setView({eye:[_x, _y, _z]});
  // あ、これレイマーチングだから要らないのか...
  //cam.setPerspective({near:r*0.1, far:r*10});
}

function setCameraParameter(){
  // 目の位置：z軸正方向√3
  // fovとaspectはいつもの。
  // uSideは(1,0,0).
  // uUpは(0,1,0), upなんだから上向かなきゃ。
  // uTopも(0,0,1)ですっきり。

  // まずgetViewData.
  const {side, up, front} = cam2.getLocalAxes();
  const {eye} = cam2.getViewData();
  const {fov, aspect} = cam2.getProjData(); // persモードに固定してあるので
  _node.setUniform("uEye", [eye.x, eye.y, eye.z])
       .setUniform("uFov", fov)
       .setUniform("uAspect", aspect)
       .setUniform("uSide", [side.x, side.y, side.z])
       .setUniform("uUp", [up.x, up.y, up.z])
       .setUniform("uFront", [front.x, front.y, front.z])
       .setUniform("uLightDirection", [-front.x, -front.y, -front.z]);
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
