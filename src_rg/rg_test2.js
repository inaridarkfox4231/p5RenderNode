// リアルタイムグラフィックスの数学の写経してみる（4つずつ）
// 1_6と2_0～2_2をやってみます。できるかな～

// ----global---- //
const ex = p5wgex;
let _node;
let _Timer = new ex.Timer();
let gr;

// ----shaders---- //
const basicVert =
`#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// 1_6: hsv2rgb. hsvをrgbにする関数。
const frag0 =
`#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;
const float PI = 3.14159;
const float TAU = 6.28318; // ちょっとアレンジ
uniform float uTime;
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
// hsv2rgb. 参考：shadertoyのiqさんのやつ：https://www.shadertoy.com/view/MsS3Wcですね。
vec3 hsv2rgb(vec3 c){
  // 分からんけどそれっぽい処理をしているのだろう...
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}
void main(){
  vec2 pos = vUv * 2.0 - 1.0; // 今回も原点が画面の中心で-1～1です
  pos = xy2pol(pos); // 極座標。
  pos.x = fract(0.5 * pos.x / PI + uTime * TAU * 0.025); // fractにしてみた。ついでにくるくる回してみた。
  //pos.x = mod(0.5 * pos.x / PI, 1.0); // え？fractと違うのかな...modで1.0を使う意味って...？
  vec3 col = hsv2rgb(vec3(pos, 1.0)); // 半径で明度を指定。
  fragColor = vec4(col, 1.0);
}
`;

// 2_0: legacy.
// ここからランダムですね～スマホの挙動はおそらく死...ななかった。
// なるほど？これはちょっと意外。まあ、サクサク行こうか。
const frag1 =
`#version 300 es
precision highp float;
out vec4 fragColor;
in vec2 vUv;
int channel; // いきなりグローバル？
uniform float uTime; // 時間！でてきた。
uniform vec2 uResolution; // 仕方ないか。通常のwidth,heightだとまずいのよね。
const float TAU = 6.28318; // じゃあTAU欲しいです
// sin(x)に1000を掛けてfract.
float fractSin11(float x){
  return fract(1000.0 * sin(x));
}
// よくあるやつですね...スマホだと... あれ。普通に見れるの...ね？
float fractSin21(vec2 xy){
  return fract(sin(dot(xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
// どうしようかな。まあ仕方ないな。gl_FragCoord使うかー
void main(){
  vec2 coord = gl_FragCoord.xy; // どうもこれvec3らしいのでxyってしないとエラーを吐く。
  // おそらく深度値です。まだやってない内容です。
  channel = int(vUv.x * 2.0); // 左で0で右で1になるやつ。
  coord += floor(60.0 * uTime);
  vec3 col;
  if(channel == 0){
    col = vec3(fractSin11(coord.x));
  }else{
    // uResolutionで割りました。これでいいね。
    col = vec3(fractSin21(coord / uResolution));
  }
  fragColor = vec4(col, 1.0);
}
`;

// 2_1: binary. ちょっとビットの話を...ということらしい。
// https://blog.oimo.io/2022/03/27/glsl-types/
// uintは32bit符号なし整数型ですね。jsでも(1<<31)ってやると負のめちゃでかい数になるからそこら辺。
// 32bit符号なし整数なので整数しか扱えないみたいです。さて...
// そういうわけで、((1<<n)<<(31-n)) >> 31が-1になるかどうかでnの桁があるかどうかわかるということですね。
// 足して31にすることで左右が逆になるのと相殺させているということで。
// 34個とか35個ずらすとループして2とか3と同じ挙動になると。<<3と<<35は同じ挙動なのです。それで大体わかるかと。
// でvec3(-1)これはclampされて0扱いです。uintで-1だとなんかばかでかい数字になって1にクランプされるようですね。
// 分ける必要あるんかな。uintでしょ？floatで使う...あ、そうか。
// マウスのインタラクションで数いじったりとかしたら面白そうじゃない？
// では参りましょう。
const frag2 =
`#version 300 es
precision highp float;
precision highp int; // 今回はintもhighだけどあんま意味なさそうだな
out vec4 fragColor;
in vec2 vUv;
uniform float uTime; // 今回は時間だけ
void main(){
  vec2 pos = vUv;
  pos.y = 1.0 - pos.y; // 今回は上から下へ。これで大丈夫です。
  pos *= vec2(32.0, 9.0); // 横32分割、縦9分割
  uint[9] uintArray = uint[](
    // わかりにくいので上からこの順に並べましょうかね。分かりにくい。何でそうしてないの...
    uint(uTime), // 時間のuint表現、uint取ってるので実質floor取った整数値をuintにしている。
    0xbu, // 0xbが要するに11でそのuint表現
    9u, // 9のuint表現
    0xbu ^ 9u, // 11と9のuint表現のビット排他的論理和。1011と1001だから10、つまり2.
    0xffffffffu, // uintの最大値。
    0xffffffffu + uint(uTime), // uintの最大値はこの場合-1のようにふるまう。足し算の理屈。で、後は同じ。
    floatBitsToUint(floor(uTime)), // uTimeの整数切り詰めはfloatなわけだがそのfloat表示のままにuintの値として扱うということ
    floatBitsToUint(-floor(uTime)), // するとどうなるかというとfloatで用いられているビット表記をuintの手法で取り出して可視化できる
    floatBitsToUint(11.5625)
    // 11.5625 = 2^3 + 2^1 + 2^0 + 2^(-1) + 2^(-4)
    //         = 2^3(1 + 2^(-2) + 2^(-3) + 2^(-4) + 2^(-7))
    // 2^3=2^(130-127)で130 = 2^7 + 2^1 だから7,6,5,4,3,2,1,0のうち7と2が点灯する
    // うしろの-2,-3,-4,-7に該当する...-1,-2,-3,...と並んでるから、2,3,4,7番が点灯する。そういうことです。
  );
  if(fract(pos.x) < 0.1){ // 縦線を引いているところ。
    if(floor(pos.x) == 1.0){
      fragColor = vec4(1, 0, 0, 1); // 符号部（赤）
    }else if(floor(pos.x) == 9.0){
      fragColor = vec4(0, 1, 0, 1); // 指数部（緑）
    }else{
      fragColor = vec4(vec3(0.5), 1); // 通常の敷居。あ、そうそう、1とか普通に1.0にキャストされるっぽいよ。webgl2すげぇ。
    }
  }else if(fract(pos.y) < 0.1){ // 横線を引いているところ
    fragColor = vec4(vec3(0.5), 1);
  }else{
    // ここでビットごとの値を決めてるんだけどサンプルが逆順なので逆にした。うまくいくはず...できましたね。
    uint u = uintArray[int(pos.y)];
    // ここは何をしてるかというとたとえばuint(pos.x)が7だった場合に下から24番目のビットが1であれば7だけビットをずらして
    // 桁あふれで一番先頭が1になってそれを...-2^31ですね。これになるので、>>31で-1になると。で、uintだから0xffffffffuになると。
    // それを最終的に色にぶちこんでる。ちなみに6以下でも8以上でも最後の>>31で0になります。理由はビットずらしの周期性。
    // 32は0と同じ、戻るということ...上手くできてる。個人的には2のべきとの&の方が分かりやすいかと...
    u = (u << uint(pos.x)) >> 31;
    vec3 col = (u != 0u ? vec3(fract(pos.y), 0.5 + 0.5 * fract(pos.y), 1.0) : vec3(0.0));
    fragColor = vec4(col, 1.0);
  }
}
`;

// OBSも有効活用の仕方きちんと考えないとね。宝の持ち腐れが過ぎる。

// 問題だそうですね。インタラクションとか作りたいわね。クリックで数作れるの。で、p5.jsで表示する...

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
  showProgram("frag0", 0, 0, {time:true});
  showProgram("frag1", 320, 0, {time:true, resolution:true});
  showProgram("frag2", 0, 320, {time:true});
  _node.unbind().flush();
}

// 時間とか解像度使えるようにちょっと修正
function showProgram(programName, x, y, settings = {}){
	if(settings.time === undefined){ settings.time = false; }
	if(settings.resolution === undefined){ settings.resolution = false; }
	const gl = gr._renderer.GL; // glからdrawingBufferWidthとdrawingBufferHeight取り出せばいいんだわ
  _node.use(programName, "board");
  if(settings.time){
    const currentTime = _Timer.getDeltaSecond("uTime");
    _node.setUniform("uTime", currentTime);
  }
  if(settings.resolution){
    _node.setUniform("uResolution", [gl.drawingBufferWidth, gl.drawingBufferHeight]);
  }
  _node.drawArrays("triangle_strip");
  image(gr, x, y);
}
