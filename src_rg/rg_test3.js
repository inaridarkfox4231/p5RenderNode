// じゃあ次。hash1d, hash2d3d, vnoise, Exercise3.1をやります。

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
/*
#version 300 es
precision highp float;
precision highp int;
out vec4 fragColor;
uniform float u_time;
uniform vec2 u_resolution;
ivec2 channel;

const uint UINT_MAX = 0xffffffffu;
uvec3 k = uvec3(0x456789abu, 0x6789ab45u, 0x89ab4567u);
uvec3 u = uvec3(1, 2, 3);
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

void main()
{
    float time = floor(60.* u_time);
    vec2 pos = gl_FragCoord.xy + time;
    channel = ivec2(gl_FragCoord.xy * 2.0 / u_resolution.xy);
    if (channel[0] == 0){ //left
        if (channel[1] == 0){
            fragColor.rgb = vec3(hash21(pos));
        } else {
            fragColor.rgb = vec3(hash22(pos), 1.0);
        }
    } else {    //right
        if (channel[1] == 0){
            fragColor.rgb = vec3(hash31(vec3(pos, time)));
        } else {
            fragColor.rgb = hash33(vec3(pos, time));
        }
    }
    fragColor.a = 1.0;
}
*/
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
  //showProgram("frag1", 320, 0, {time:true, resolution:true});
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
