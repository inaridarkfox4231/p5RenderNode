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

// ----global---- //
const ex = p5wgex;
let _node;
let _timer = new ex.Timer();
let info, infoTex;

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
// 総合距離関数、map. 色も返せる。今回はテストなので半径0.3の球で。
vec4 map(vec3 p){
  float t = sphere(p, 0.3);
  return vec4(vec3(1.0), t);
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
  ray -= uTop;
  ray += uSide * uAspect * tan(uFov * 0.5) * vUv.x;
  ray -= uUp * tan(uFov * 0.5) * vUv.y;
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
}

// ----draw---- //
function draw(){
  const currentTime = _timer.getDeltaSecond("cur"); // そのうち
  const fps = _timer.getDeltaFPStext("fps", frameRate());
	_timer.set("fps");
  _node.bindFBO(null)
       .clear();

  // for ray marching.

  _node.use("rayM", "board")
       .setUniform("uEye", [1.732, 0, 0])
       .setUniform("uFov", Math.PI/3)
       .setUniform("uAspect", width/height)
       .setUniform("uSide", [0, -1, 0])
       .setUniform("uUp", [0, 0, -1])
       .setUniform("uTop", [1, 0, 0])
       .setUniform("uLightDirection", [-1, -1, -1])
       .drawArrays("triangle_strip")
       .unbind();

  // for info.

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
