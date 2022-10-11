// foldシリーズはじまり～
// レイマでfoldを作る、もしくはその様子をポリゴン描画で可視化するとかそんなやつらだ。よろしくな。

// まずレイマ

// あの、普通にやろう。で、
// こんなもんですかね...
// パフォーマンス表示追加しますね

// んー。
// 座標でy軸左z軸上で構築しちゃったせいで直感的に操作しづらくなってるな...って当然か。
// まあとりあえずいいか。

// スマホだとレート半分ですね...動かすのは難しそう。まあとりあえずいいや。
// これもMRTで色と法線...で、すると、いいのかも？

// 背景はテクスチャパスを別に用意して読み込ませた方がいいと思う
// 魚眼レンズ...レイベクトルを中心からの距離に応じて後ろに若干ずらすことで
// 視界を丸くする技術。これレイキャスティングでやりたいなぁ...

// それはさておき、x軸右、y軸上、z軸手前の形式にしよう。で、z軸正方向からレイを飛ばそう。中心が原点。この場合
// あまり意味をなさないけれど...
// それと射影行列いじってy軸が上になるようにする。

// y軸上にしました。なのでもうupベクトルの符号いじる必要ないです。ご苦労さま。

// フレームバッファ使う方法一旦やめようか。パフォーマンス逆に落ちてる。撤退。

// cam2への移行完了

// ----global---- //
const ex = p5wgex;
let _node;
let _timer = new ex.Timer();
let info, infoTex;

// カメラ
//let cam;
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
uniform vec3 uUp; // 画面上方向で、マイナスでは使わなくてもよくなりました（めでたい）
uniform vec3 uFront; // 画面手前方向...マイナスで使う。
uniform vec3 uLightDirection; // 光を使う場合。光の進む向き。マイナスで使って法線と内積を取る。

in vec2 vUv;

const float MAX_DIST = 20.0;   // 限界距離。これ越えたら無いとみなす。
const float THRESHOLD = 0.001; // 閾値。これより近付いたら到達とみなす。
const int ITERATION = 64; // マーチング回数限界
const vec2 EPS = vec2(0.0001, 0.0); // 法線計算用

out vec4 fragColor;

// 簡単な距離関数
float sphere(vec3 p, float r){
  return length(p) - r;
}
float cube(vec3 p, float r){
  return max(max(abs(p.x), abs(p.y)), abs(p.z)) - r;
}
// 総合距離関数、map. 色も返せる。今回はテストなので半径0.3の球で。
vec4 map(vec3 p){
  float t = sphere(p, 0.3);
  vec3 col = vec3(1.0);
  float t1 = cube(p - vec3(0.5, 0.0, 0.0), 0.1);
  if(t1 < t){ t = t1; col = vec3(0.5, 0.75, 1.0); }
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
  // rayを計算する
  vec3 ray = vec3(0.0);
  // uFrontだけマイナス、これで近づく形。さらにuSideで右、uUpで上に。分かりやすいね。
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
    float diff = clamp((dot(n, -uLightDirection) + 0.5) * 0.7, 0.3, 1.0);
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

  // for ray marching.

  const positions = [-1,-1,1,-1,-1,1,1,1];
  _node.registPainter("rayM", rayMVert, rayMFrag);
  _node.registFigure("board", [{name:"aPosition", size:2, data:positions}]);
  _timer.set("cur");

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
  //cam.setView({eye:{x:0,y:0,z:1.732}, center:{x:0,y:0,z:0}, up:{x:0,y:1,z:0}});
  // カメラ2のテスト
  cam2 = new ex.CameraEx2({w:width, h:height, eye:[0, 0, 1.732], center:[0, 0, 0], top:[0, 1, 0]});
}

// ----draw---- //
function draw(){
  const currentTime = _timer.getDeltaSecond("cur"); // そのうち
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
  _node.setUniform("uLightDirection", [-1, -1, -1])
       .drawArrays("triangle_strip")
       .unbind();

  // for info.
  showPerformance(fps);
}

function moveCamera(currentTime){
  // 動かしてみる。マウスで動かしてもいいと思う。
  //const curTime = _timer.getDeltaSecond("cur");
  const _x = Math.sqrt(3) * Math.cos(currentTime * Math.PI*2 * 0.5);
  const _y = 0.7 * Math.sin(currentTime * Math.PI*2 * 0.4);
  const _z = Math.sqrt(3) * Math.sin(currentTime * Math.PI*2 * 0.5);
  //cam.setView({eye:{x:_x, y:_y, z:_z}});
  cam2.setView({eye:[_x, _y, _z]});
}

function setCameraParameter(){
  // 目の位置：z軸正方向√3
  // fovとaspectはいつもの。
  // uSideは(1,0,0).
  // uUpは(0,1,0), upなんだから上向かなきゃ。
  // uTopも(0,0,1)ですっきり。

  // まずgetViewData.
  //const viewData = cam.getViewData();
  //const perseData = cam.getPerseParam();
  //const {side, up, top, eye} = viewData;
  //const {fov, aspect} = perseData;
  const {side, up, front} = cam2.getLocalAxes();
  const {eye} = cam2.getViewData();
  const {fov, aspect} = cam2.getProjData(); // persモードに固定してあるので

  _node.setUniform("uEye", [eye.x, eye.y, eye.z])
       .setUniform("uFov", fov)
       .setUniform("uAspect", aspect)
       .setUniform("uSide", [side.x, side.y, side.z])
       .setUniform("uUp", [up.x, up.y, up.z])
       .setUniform("uFront", [front.x, front.y, front.z]);
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
