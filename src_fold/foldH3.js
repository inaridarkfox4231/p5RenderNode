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

// 16s種類。圧巻。

// まあこれでもスマホだと重いんですよね
// 知ってた
// lilでバリエーション変えられるようにするよ
// それでおわり
// 3Typeあるでしょ
// それで分けられるからね

// マルチレンダーターゲットで分解してみました
// んー...どゆこと？
// まず距離の方
// t/MAX_DISTでやると黒いところはまあその
// 黒？？
// まずここに関しては画面外のところについては真っ赤になるのが理想的で
// いくらまで下げても真っ赤なままかっていうのを見るんだと思う。
// iterの方は...
// これが赤っていうのは越えちゃってるので
// 輪郭が赤く光ってるのよねこれは
// 限界までレイマすると赤くなるわけだけど
// ぎりぎりだからってことだと思う

// MAX_DISTですが6.0まで下げてもまっかっかです
// 大きく見積りすぎたようだ...

// 判断保留といこう。まあいいやね。

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

const float MAX_DIST = 6.0;   // 限界距離。これ越えたら無いとみなす。
const float THRESHOLD = 0.001; // 閾値。これより近付いたら到達とみなす。
const int ITERATION = 48; // マーチング回数限界
const vec2 EPS = vec2(0.0001, 0.0); // 法線計算用

layout (location = 0) out vec4 fragColor;
layout (location = 1) out float reach;
layout (location = 2) out float iterNum;

vec3 uniqueQ; // グローバル～基本領域のどっか

// fold用const.
const float phi = (1.0+sqrt(5.0))/2.0; //(黄金比)
// ミラーベクトル
vec3 na = vec3(1.0, 0.0, 0.0);
vec3 nb = vec3(0.0, 1.0, 0.0);
vec3 nc = vec3(-0.5, -phi*0.5, (phi - 1.0) * 0.5);
// 基本領域の境界点（境界線と領域の交点）で、サイズを掛けて使う。
vec3 qab = vec3(0.0, 0.0, phi*0.5);
vec3 qbc = vec3(0.5, 0.0, phi*0.5);
vec3 qca = vec3(0.0, phi/6.0, (2.0*phi+1.0)/6.0);
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

// 距離関数
// 簡単なものでいいです。qは計算済みとする。qは基本領域のどっか。
float foldH3DefaultPolygon(vec3 p, vec3 q){
  foldH3(p);
  float t = dot(p - q, pab);
  t = max(t, dot(p - q, pbc));
  t = max(t, dot(p - q, pca));
  return t;
}

// 総合距離関数、map. 色も返せる。今回はテストなので半径0.3の球で。
vec4 map(vec3 p){
  vec3 col = vec3(1.0);
  float t = foldH3DefaultPolygon(p, uniqueQ);
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
vec2 march(vec3 ray, vec3 eye){
  float h = THRESHOLD * 2.0; // 毎フレームの見積もり関数の値。
  // 初期値は0.0で初期化されてほしくないのでそうでない値を与えてる。
  // これがTHRESHOLDを下回れば到達とみなす
  float t = 0.0;
  // tはcameraからray方向に進んだ距離の累計。
  // 到達ならこれが返る。失敗なら-1.0が返る。つまりresultが返る。
  //float result = -1.0;
  float iter = 0.0;
  for(int i = 0; i < ITERATION; i++){
    if(h < THRESHOLD || t > MAX_DIST){ break; }
    // tだけ進んだ位置で見積もり関数の値hを取得し、tに足す。
    h = map(eye + t * ray).w;
    t += h;
    iter += 1.0; // いてれ...いってんれい...（とか言って）(samuiyo)
  }
  // t < MAX_DISTなら、h < THRESHOLDで返ったということなのでマーチング成功。
  //if(t < MAX_DIST){ result = t; }
  //return result;
  return vec2(t, iter); // 要はt < MAX_DISTならいいんでしょ？
}
// メイン
void main(){

  // uniqueQの計算
  vec3 co = vec3(0.0, 1.0, 0.0);
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
  vec2 result = march(ray, uEye);
  float t = result.x;
  float iter = result.y;
  // tはマーチングに失敗すると-1.0が返る。やめようよ。
  if(t < MAX_DIST){
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
  reach = t / MAX_DIST;
  iterNum = iter / float(ITERATION);
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

  // フレームバッファは今回3つ用意する。サイズはwidthとheight使います
  _node.registFBO("rayM_H3", {w:width, h:height, color:{info:[
        {}, // 通常のRGBA
        {type:"float", internalFormat:"r32f", format:"red", magFilter:"nearest"},
        {type:"half_float", internalFormat:"r16f", format:"red", magFilter:"nearest"}
  ]}});
  // 後者2つにはそれぞれ...そうね...レイマ回数の方は0～255でいいか。距離の方はfloatで。
  // 黒と白で...上限用意して...
}

// ----draw---- //
function draw(){
  const currentTime = _timer.getDelta("cur"); // そのうち

  _node.bindFBO("rayM_H3")
       .clearColor(0,0,0,0)
       .clear();

  updateInfo();
  ex.copyPainter(_node, {src:{name:"info", gradationFlag:1, gradationStart:[0,0,0,0,0,1], gradationStop:[0,1,0.75,0.75,0.25,1]}});

  // レイマーチングスタート
  _node.use("rayM", "foxBoard");

  // カメラ設定
  moveCamera(currentTime);
  setCameraParameter();

  //_node.enable("blend").blendFunc("src_alpha", "one_minus_src_alpha");

  // 光の設定、レンダリング
  _node.drawArrays("triangle_strip")
       .unbind();

  //_node.disable("blend");

  ex.copyPainter(_node, {src:[
    {type:"fb", name:"rayM_H3", index:0, view:[0, 0, 0.5, 0.5]},
    {type:"fb", name:"rayM_H3", index:1, view:[0.5, 0, 0.5, 0.5]},
    {type:"fb", name:"rayM_H3", index:2, view:[0, 0.5, 0.5, 0.5]}
  ]});

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
  gr.text("fold H3.", 5, 5);
  gr.text(frameRate().toFixed(3), 5, 25);
  _node.updateTexture("info");
}
