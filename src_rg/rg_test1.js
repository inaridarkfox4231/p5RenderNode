// リアルタイムグラフィックスの数学の写経してみる（4つずつ）
// 1_2～1_5をやってみます。

// ----global---- //
const ex = p5wgex;
let _node;
let _Timer = new ex.Timer();
let gr;

// ----shaders---- //
const basicVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// 1_2: bilerp. いわゆるLINEAR補間？テクスチャサンプリングのリニアみたいな。そんな感じ。
const frag0 =
`#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;
void main(){
  // 赤、青、緑、黄色。
  vec3[4] col4 = vec3[](
    vec3(1.0, 0.0, 0.0),
    vec3(0.0, 0.0, 1.0),
    vec3(0.0, 1.0, 0.0),
    vec3(1.0, 1.0, 0.0)
  );
  vec2 pos = vUv;
  // 下側は左から右へ赤から青、上側は左から右へ緑から黄色、中間はそれらの補間。です。
  vec3 col = mix(mix(col4[0], col4[1], pos.x), mix(col4[2], col4[3], pos.x), pos.y);
  fragColor = vec4(col, 1.0);
}
`;

// 1_3: posterization.
// ポスタライゼーション。なんだろ...急に難しく...
// おおー（って感じ）。作例がもさっとしてたので4秒周期で書き換えました（ごめんなさい）
const frag1 =
`#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;
int channel; // いきなりグローバル？
uniform float uTime; // 時間！でてきた。
const float TAU = 6.28318; // じゃあTAU欲しいです
void main(){
  vec2 pos = vUv;
  // おお赤、黄色、ピンク、白ですか（カラフルっ）
  vec3[4] col4 = vec3[](
    vec3(1.0, 0.0, 0.0),
    vec3(1.0, 1.0, 0.0),
    vec3(1.0, 0.0, 1.0),
    vec3(1.0, 1.0, 1.0)
  );
  float n = 4.0;
  pos *= n; // (0.0, 0.0)～(4.0, 4.0)ですね～
  channel = int(2.0 * vUv.x); // チャンネルか。テレビのチャンネルみたいな？左が0で右が1のようです。
  // つまり画面の左側と右側で描画内容を変えるようですね。
  if(channel == 0){
    // left: step. これは0.5より小さいとき0で0.5より大きいとき1とかだったはず。
    pos = floor(pos) + step(0.5, fract(pos));
  }else{
    // right: smoothstep. これは閾値a, bについてaより小さいとき0でbより大きいとき1で間では滑らかに補間するのよ～
    // それで(0.0, 1.0)～(0.5, 0.5)の間で時間経過で変化するのでああなると。途中左と一緒になるわね。
    float thr = 0.25 * sin(uTime * TAU * 0.25);
    pos = floor(pos) + smoothstep(0.25 + thr, 0.75 - thr, fract(pos));
  }
  pos /= n; // 計算結果を(0.0, 0.0)～(1.0, 1.0)に落として最後はさっきと同じように色補間
  // この色補間のところを画像とかにすると。多分そういう処理...なのか？
  vec3 col = mix(mix(col4[0], col4[1], pos.x), mix(col4[2], col4[3], pos.x), pos.y);
  fragColor = vec4(col, 1.0);
}
`;

// 1_4: polar.
// おおatanあるんだ...あー、そうか。xが0のところ...？これ要るの？んー...
// 調べたらglslのatanはxが0のとき挙動を規定してないとか。使えないな...てわけでこんなふうに書いてるのね。signは0が返る模様。
// あーなる。偏角が-PI～0で（反時計回り）青から赤、そのあと赤から青、で、それを中心から外に向かって白と補間してるのか。
// ああ知らなかったです。「%」使えるんですね...webgl2いいですね...
const frag2 =
`#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;
const float PI = 3.14159;
// 改良版atan2.ゼロ割に対応、とのこと。割と、ポンコツなのね...
float atan2(float y, float x){
  if(x == 0.0){
    return sign(y) * PI / 2.0;
  }else{
    return atan(y, x);
  }
  // 3項演算子は分かりづらいのでいいです
}
// デカルト → ポーラー
vec2 xy2pol(vec2 xy){
  return vec2(atan2(xy.y, xy.x), length(xy));
}
// ポーラー → デカルト（y座標が原点との距離）
vec2 pol2xy(vec2 pol){
  return pol.y * vec2(cos(pol.x), sin(pol.x));
}
// テクスチャ、要するに色ですね。入力のpolは極座標表示であることが前提です。PIとか使ってるしいいよね。
vec3 tex(vec2 pol){
  // 青から赤へ、赤から青へ。
  vec3[3] col3 = vec3[](
    vec3(0.0, 0.0, 1.0),
    vec3(1.0, 0.0, 0.0),
    vec3(1.0)
  );
  // 極座標の成分
  float angle = pol.x;
  float r = pol.y;
  angle = angle / PI + 1.0; // -PI～PIを0～2に変換。このとき2未満になるらしい（atanの仕様）
  int ind = int(angle);
  // 調べたら「%」もwebgl2から使えるそうな...まじかよ。便利だな～ていうかmod要らねーじゃん！ああ%でいいんだ！くそ
  // やられた！
  vec3 col = mix(col3[ind % 2], col3[(ind + 1) % 2], fract(angle)); // 小数部分で補間
  // 最後に中心白、外に向かって本来の色、で、補間
  return mix(col3[2], col, r);
}
void main(){
  vec2 pos = vUv * 2.0 - 1.0; // 今回は(0.5, 0.5)中心で-1～1でやります。
  pos = xy2pol(pos); // 極座標に変換
  vec3 col = tex(pos);
  fragColor = vec4(col, 1.0);
}
`;

// 1_5: polarRot.
// おおなんかよくわからないことを...ほぼ一緒なんだけれどね。んー。
const frag3 =
`#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;
uniform float uTime; // 今回は時間を使うとのこと。
const float PI = 3.14159;
const float TAU = 6.28318;
// 改良版atan2.ゼロ割に対応、とのこと。
float atan2(float y, float x){
  if(x == 0.0){
    return sign(y) * PI / 2.0;
  }else{
    return atan(y, x);
  }
}
// デカルト → ポーラー
vec2 xy2pol(vec2 xy){
  return vec2(atan2(xy.y, xy.x), length(xy));
}
// ポーラー → デカルト（y座標が原点との距離）
vec2 pol2xy(vec2 pol){
  return pol.y * vec2(cos(pol.x), sin(pol.x));
}
// テクスチャ、要するに色ですね。入力のpolは極座標表示であることが前提です。PIとか使ってるしいいよね。
// 今回は、なんというか...
vec3 tex(vec2 pol){
  // 3つの色を決めている。赤、青、緑のどれかが1で、残り2つは中心(0.5, 0.5)で半径0.5の円周上をくるくる回る感じ。
  float time = uTime * TAU * 0.25;
  vec3 circ = vec3(pol2xy(vec2(time, 0.5)) + 0.5, 1.0);
  vec3[3] col3 = vec3[](circ.rgb, circ.gbr, circ.brg);  // それらを循環させて3つの色とする。
  // あとは同じ。
  // 極座標の成分
  float angle = pol.x;
  float r = pol.y;
  angle = angle / PI + 1.0; // -PI～PIを0～2に変換。このとき2未満になるらしい（atanの仕様）
  int ind = int(angle);
  vec3 col = mix(col3[ind % 2], col3[(ind + 1) % 2], fract(angle)); // 小数部分で補間
  return mix(col3[2], col, r);
}
void main(){
  vec2 pos = vUv * 2.0 - 1.0; // 今回は(0.5, 0.5)中心で-1～1でやります。
  pos = xy2pol(pos); // 極座標に変換
  vec3 col = tex(pos);
  fragColor = vec4(col, 1.0);
}
`;

// ----setup---- //
function setup(){
  createCanvas(640, 640);
  gr = createGraphics(320, 320, WEBGL);
  _node = new ex.RenderNode(gr._renderer.GL);
  _Timer.set("uTime"); // 時間使うみたいですので
  const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
  _node.registPainter("frag0", basicVert, frag0);
  _node.registPainter("frag1", basicVert, frag1);
  _node.registPainter("frag2", basicVert, frag2);
  _node.registPainter("frag3", basicVert, frag3);

  _node.registFigure("board", [{name:"aPosition", size:2, data:positions}]);
}

function draw(){
  background(0);
  showProgram("frag0", 0, 0);
  showProgram("frag1", 320, 0, true);
  showProgram("frag2", 0, 320);
  showProgram("frag3", 320, 320, true);
  _node.unbind().flush();
}

// 時間使えるようにちょっと修正
function showProgram(programName, x, y, useTime = false){
  _node.use(programName, "board");
  if(useTime){
    const currentTime = _Timer.getDeltaSecond("uTime");
    _node.setUniform("uTime", currentTime);
  }
  _node.drawArrays("triangle_strip");
  image(gr, x, y);
}
