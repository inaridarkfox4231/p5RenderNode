// じゃあ次。hash1d, hash2d3d, vnoise, Exercise3.1をやります。

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

// 2_2: hash1d.
// ハッシュでランダム、ダッシュでいこうぜ！（？？）
// ちらつきが消えないのはpixelDensity(1)をしてないから。やめた方がいいと思う。
// おそらくだけどあのコード、というか環境もpixelDensity(1)でやってると思う。
// でなきゃあの見た目にはならないはず...
const frag0 =
`#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
in vec2 vUv;
uniform float uTime;
// 定数。
uint k = 0x456789abu; // 雑にuint整数。
const uint UINT_MAX = 0xffffffffu;
// uhash11. 11というのはfloat→floatという意味だろう。
uint uhash11(uint n){
  n ^= (n << 1);
  n ^= (n >> 1);
  n *= k;
  n ^= (n << 1);
  return n * k;
}
// これをfloatからのuintに適用するのがhash11というランダム関数、ということらしいです。
float hash11(float p){
  uint n = floatBitsToUint(p);
  return float(uhash11(n)) / float(UINT_MAX); // てか...え？これfloatにしちゃうの？
  // ちょっとイメージと違うが...ビット操作で小数出すとかだと思ってた。だってビットの並びで1より小さいかどうか決まるでしょ？
  // まあいいや
}
// hsv2rgb. 参考：shadertoyのiqさんのやつ：https://www.shadertoy.com/view/MsS3Wcですね。
vec3 hsv2rgb(vec3 c){
  // 分からんけどそれっぽい処理をしているのだろう...
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}
void main(){
  float time = floor(60.0*uTime);
  vec2 pos = gl_FragCoord.xy + time; // 座標値をずらす感じで
  vec3 col = vec3(hash11(pos.y)) * hsv2rgb(vec3(1.5, 1.2, 0.9));
  fragColor = vec4(col, 1.0);
}
`;

// 2_3: hash2d3d.
// わけわからんことしてんな...
// まあ結論から言うとpixelDensityが原因ですね。どうしましょうかね。
// pixelDensityの影響で各ピクセルの値の変化がどうしても同期しない、そこら辺が原因でちらついてしまうということ。
// 1にすれば何の問題も無いです。
// ...どうせpixelDensityに左右されないコード書いてるし，いいんじゃないかな...
const frag1 =
`#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
in vec2 vUv;
ivec2 channel; // ivec2初登場。
uniform float uTime; // 時間！でてきた。

const uint UINT_MAX = 0xffffffffu;
uvec3 k = uvec3(0x456789abu, 0x6789ab45u, 0x89ab4567u);
uvec3 u = uvec3(1, 2, 3); // uvec3も初登場。uintのvec3のことらしい。iを省略してuvec2.クールだね。

// 以降、ハッシュ関数が延々と続く。詳しくは原書を見てください。
uvec2 uhash22(uvec2 n){
    n ^= (n.yx << u.xy);
    n ^= (n.yx >> u.xy);
    n *= k.xy;
    n ^= (n.yx << u.xy);
    return n * k.xy;
}
uvec3 uhash33(uvec3 n){
    n ^= (n.yzx << u);
    n ^= (n.yzx >> u);
    n *= k;
    n ^= (n.yzx << u);
    return n * k;
}
vec2 hash22(vec2 p){
    uvec2 n = floatBitsToUint(p);
    return vec2(uhash22(n)) / vec2(UINT_MAX);
}
vec3 hash33(vec3 p){
    uvec3 n = floatBitsToUint(p);
    return vec3(uhash33(n)) / vec3(UINT_MAX);
}
float hash21(vec2 p){
    uvec2 n = floatBitsToUint(p);
    return float(uhash22(n).x) / float(UINT_MAX);
    //nesting approach
    //return float(uhash11(n.x+uhash11(n.y)) / float(UINT_MAX)
}
float hash31(vec3 p){
    uvec3 n = floatBitsToUint(p);
    return float(uhash33(n).x) / float(UINT_MAX);
    //nesting approach
    //return float(uhash11(n.x+uhash11(n.y+uhash11(n.z))) / float(UINT_MAX)
}
// メインコード
void main(){
  float time = floor(60.0 * uTime);
  vec2 pos = gl_FragCoord.xy + time;
  channel = ivec2(vUv * 2.0); // ここはvUvでいいと思う
  // チャンネルで画面を4分割してるわけ。if文面倒だな。
  float flag0 = (channel.x == 0 && channel.y == 0 ? 1.0 : 0.0);
  float flag1 = (channel.x == 0 && channel.y == 1 ? 1.0 : 0.0);
  float flag2 = (channel.x == 1 && channel.y == 0 ? 1.0 : 0.0);
  float flag3 = (channel.x == 1 && channel.y == 1 ? 1.0 : 0.0);
  vec3 result = vec3(0.0);
  result += flag0 * vec3(hash21(pos)); // 出力はfloat
  result += flag1 * vec3(hash22(pos), 1.0); // 出力はvec2でそれと1.0で色
  result += flag2 * vec3(hash31(vec3(pos, time))); // いわゆる砂嵐？
  result += flag3 * hash33(vec3(pos, time));
  fragColor = vec4(result, 1.0);
}
`;

// 3_0: v_noise
// これ以降はコピペするだけじゃ勉強にならなさそう。
// コピペするだけじゃ勉強にならないのは当たり前
/*
#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
int channel;

//start hash
uvec3 k = uvec3(0x456789abu, 0x6789ab45u, 0x89ab4567u);
uvec3 u = uvec3(1, 2, 3);
const uint UINT_MAX = 0xffffffffu;

uint uhash11(uint n){
  n ^= (n << u.x);
  n ^= (n >> u.x);
  n *= k.x;
  n ^= (n << u.x);
  return n * k.x;
}

uvec2 uhash22(uvec2 n){
  n ^= (n.yx << u.xy);
  n ^= (n.yx >> u.xy);
  n *= k.xy;
  n ^= (n.yx << u.xy);
  return n * k.xy;
}

uvec3 uhash33(uvec3 n){
  n ^= (n.yzx << u);
  n ^= (n.yzx >> u);
  n *= k;
  n ^= (n.yzx << u);
  return n * k;
}

float hash11(float p){
  uint n = floatBitsToUint(p);
  return float(uhash11(n)) / float(UINT_MAX);
}

float hash21(vec2 p){
  uvec2 n = floatBitsToUint(p);
  return float(uhash22(n).x) / float(UINT_MAX);
}

float hash31(vec3 p){
  uvec3 n = floatBitsToUint(p);
  return float(uhash33(n).x) / float(UINT_MAX);
}

vec2 hash22(vec2 p){
  uvec2 n = floatBitsToUint(p);
  return vec2(uhash22(n)) / vec2(UINT_MAX);
}

vec3 hash33(vec3 p){
  uvec3 n = floatBitsToUint(p);
  return vec3(uhash33(n)) / vec3(UINT_MAX);
}
//end hash

float vnoise21(vec2 p){
  vec2 n = floor(p);
  float[4] v;
  for (int j = 0; j < 2; j ++){
    for (int i = 0; i < 2; i++){
      v[i+2*j] = hash21(n + vec2(i, j));
    }
  }
  vec2 f = fract(p);
  if (channel == 1){
    f = f * f * (3.0 -2.0 * f); // Hermite interpolation
  }
  return mix(mix(v[0], v[1], f[0]), mix(v[2], v[3], f[0]), f[1]);
}

float vnoise31(vec3 p){
  vec3 n = floor(p);
  float[8] v;
  for (int k = 0; k < 2; k++ ){
    for (int j = 0; j < 2; j++ ){
      for (int i = 0; i < 2; i++){
        v[i+2*j+4*k] = hash31(n + vec3(i, j, k));
      }

    }
  }
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // Hermite interpolation
  float[2] w;
  for (int i = 0; i < 2; i++){
    w[i] = mix(mix(v[4*i], v[4*i+1], f[0]), mix(v[4*i+2], v[4*i+3], f[0]), f[1]);
  }
  return mix(w[0], w[1], f[2]);
}

void main(){
  vec2 pos = gl_FragCoord.xy/min(u_resolution.x, u_resolution.y);
  channel = int(gl_FragCoord.x * 3.0 / u_resolution.x);
  pos = 10.0 * pos + u_time;
  if (channel < 2){
    fragColor = vec4(vnoise21(pos));  // left/center
  } else {
    fragColor = vec4(vnoise31(vec3(pos, u_time)));  // right
  }
  fragColor.a = 1.0;
}
*/
const frag2 =
`#version 300 es
precision highp float;
precision highp int; // 今回はintもhighだけどあんま意味なさそうだな
out vec4 fragColor;
in vec2 vUv;
uniform float uTime; // 今回は時間だけ
void main(){

}
`;

// OBSも有効活用の仕方きちんと考えないとね。宝の持ち腐れが過ぎる。

// 問題だそうですね。インタラクションとか作りたいわね。クリックで数作れるの。で、p5.jsで表示する...

// Exercise2.1: floatビットの仕組み。uintに変換して表示している。
// 要するにこれで負の数の仕組みとかわかると。うれしいね。
const frag3 =
`#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
void main(){
  vec2 pos = vUv;
  pos.y = 1.0 - pos.y;
  pos *= vec2(32.0, 20.0);
  uint[20] floatArray = uint[](
    floatBitsToUint(1.0),
    floatBitsToUint(2.0),
    floatBitsToUint(3.0),
    floatBitsToUint(4.0),
    floatBitsToUint(5.0),
    floatBitsToUint(6.0),
    floatBitsToUint(7.0),
    floatBitsToUint(8.0),
    floatBitsToUint(9.0),
    floatBitsToUint(10.0),
    floatBitsToUint(-1.0),
    floatBitsToUint(-2.0),
    floatBitsToUint(-3.0),
    floatBitsToUint(-4.0),
    floatBitsToUint(-5.0),
    floatBitsToUint(-6.0),
    floatBitsToUint(-7.0),
    floatBitsToUint(-8.0),
    floatBitsToUint(-9.0),
    floatBitsToUint(-10.0)
  );
  // ここから先で格子を作る
  if(fract(pos.x) < 0.1){
    if (floor(pos.x) == 1.0){
      fragColor = vec4(1.0, 0.0, 0.0, 1.0);
    } else if (floor(pos.x) == 9.0){
      fragColor = vec4(0.0, 1.0, 0.0, 1.0);
    } else {
      fragColor = vec4(vec3(0.5), 1.0);
    }
  }else if(fract(pos.y) < 0.1){
    fragColor = vec4(vec3(0.5), 1.0);
  }else{
    // ビットがあるかどうか調べてあれば色付けて表示
    uint u = floatArray[int(pos.y)];
    u = (u << int(pos.x)) >> 31;
    vec3 col = (u != 0u ? vec3(1.0, fract(pos.y), 0.5 + 0.5 * fract(pos.y)) : vec3(0.0));
    fragColor = vec4(col, 1.0);
  }
}
`;

// ----setup---- //
function setup(){
  createCanvas(640, 640);
  pixelDensity(1); // こだわってたら進めないので堂々とpixelDensityは1にします
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
  showProgram("frag1", 320, 0, {time:true});
  //showProgram("frag2", 0, 320, {time:true});
  //showProgram("frag3", 320, 320);
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
