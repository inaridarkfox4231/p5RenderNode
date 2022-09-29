// 円で反射。もうちょっとGPGPUに慣れたい。終わったら立方体と球面でも反射やってポリゴンを動かしたいね。
// 最終的には正四面体を球面内で...単純に3次元化。まあそれでも初歩の初歩でしかないわけだけど。
// トランスフォームフィードバックが視野に入ってきた。要するにあれを使うと、
// 速度と位置をまとめたものを使って直接attributeを更新できるそうです。すごいねぇ。
// vboが2組必要になるってことだからおそらくswapに相当することを内部処理でやってるっぽいね。でなきゃ2つの値を使えるわけないし。
// tmp的な使い方をしているのでしょう。
// その前に動的更新ですかね。

// 乱数放り込めたかどうか確認しないとな～

// よくわからないが...用意した変数はそのままではだめで、使ってることをきちんとアピールしないとコンパイルエラー、
// もしくは場所分かりませんエラーが出るようです。以上！実行時エラーはきっついね...
// ともかく乱数は放り込めた。OK!
// 関数は使わなくても大丈夫ということです。
// 3つの整数に対してそれらを64でmodして0～512x512の整数に落としてから
// 該当マスのvec4を取り出し始めの3つを使えばOK

// ループプロテクトに邪魔されたので排除した
// 排除したんだけど、駄目だ。あー、...いよいよOpenProcessingと袂を分かつときが来たかな...もう限界。

// -------global------- //
const ex = p5wgex;
let gr0, gr1;
let _node0, _node1;
let _startTime;

// -------shaders------- //
// webgl2なのでESSL300で書いてみる。
// 今回は中心原点でいくか
// 板ポリだし上下も関係ないわね
const copyVert =
`#version 300 es
precision mediump float;

in vec2 aPosition;
out vec2 vUv; // vertexStageのvaryingはoutで、

void main(void){
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// デモなので板ポリ芸2つほどこしらえる方向で。
// そうね...雲やってみるか。ノイズ作ってみよう。出来るの？？
// フレームバッファに乱数ぶちこむ。256x256x4のちょっとしたもの。
const testFrag0 =
`#version 300 es
precision mediump float;
in vec2 vUv;
uniform float uTime;
uniform sampler2D uRandom;
out vec4 fragColor;
// 単位ベクトル群
const vec3 u_100 = vec3(1.0, 0.0, 0.0);
const vec3 u_010 = vec3(0.0, 1.0, 0.0);
const vec3 u_001 = vec3(0.0, 0.0, 1.0);
const vec3 u_110 = vec3(1.0, 1.0, 0.0);
const vec3 u_101 = vec3(1.0, 0.0, 1.0);
const vec3 u_011 = vec3(0.0, 1.0, 1.0);
const vec3 u_111 = vec3(1.0, 1.0, 1.0);
// オクターブ
const int octaves = 6;
// random3. 周期性ありで。-1～1の値を返す。
vec3 random3(vec3 v){
  // vは整数3つなのでこれを...
  float serial = mod(64.0 * 64.0 * v.x + 64.0 * v.y + v.z, 512.0 * 512.0);
  vec2 p = vec2(mod(serial, 512.0), floor(serial / 512.0)) / 512.0;
  vec4 data = texture(uRandom, p);
  return data.xyz * 2.0 - 1.0; // -1～1.
}
// ノイズ。
float snoise3(vec3 st){
  vec3 p = st + (st.x + st.y + st.z) / 3.0;
  vec3 f = fract(p);
  vec3 i = floor(p);
  vec3 g0, g1, g2, g3;
  vec4 wt;
  g0 = i;
  g3 = i + u_111;
  if(f.x >= f.y && f.x >= f.z){
    g1 = i + u_100;
    g2 = i + (f.y >= f.z ? u_110 : u_101);
    wt = (f.y >= f.z ? vec4(1.0 - f.x, f.x - f.y, f.y - f.z, f.z) : vec4(1.0 - f.x, f.x - f.z, f.z - f.y, f.y));
  }else if(f.y >= f.x && f.y >= f.z){
    g1 = i + u_010;
    g2 = i + (f.x >= f.z ? u_110 : u_011);
    wt = (f.x >= f.z ? vec4(1.0 - f.y, f.y - f.x, f.x - f.z, f.z) : vec4(1.0 - f.y, f.y - f.z, f.z - f.x, f.x));
  }else{
    g1 = i + u_001;
    g2 = i + (f.x >= f.y ? u_101 : u_011);
    wt = (f.x >= f.y ? vec4(1.0 - f.z, f.z - f.x, f.x - f.y, f.y) : vec4(1.0 - f.z, f.z - f.y, f.y - f.x, f.x));
  }
  float value = 0.0;
  wt = wt * wt * wt * (wt * (wt * 6.0 - 15.0) + 10.0);
  value += wt.x * dot(p - g0, random3(g0));
  value += wt.y * dot(p - g1, random3(g1));
  value += wt.z * dot(p - g2, random3(g2));
  value += wt.w * dot(p - g3, random3(g3));
  return value;
}
// いわゆるfbm
float fbm(vec3 st){
  float value = 0.0;
  float amplitude = 0.5;
  for(int i = 0; i < octaves; i++){
    value += amplitude * snoise3(st);
    st *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}
// getRGB(HSBをRGBに変換する関数)
vec3 getRGB(float h, float s, float b){
  vec3 c = vec3(h, s, b);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}
// ようやくメインコード
void main(){
  vec2 p = (vUv + vec2(0.05, 0.09) * uTime) * 3.0; // 平行移動ずらし
  float n = 0.5 + 0.5 * fbm(vec3(p, uTime * 0.05)); // ノイズ計算
  vec3 cloudColor = vec3(1.0);
  vec3 skyColor = getRGB(0.08, sqrt(vUv.y * (2.0 - vUv.y)), 1.0);
  vec3 finalColor = skyColor + (cloudColor - skyColor) * smoothstep(0.44, 0.56, n);
  fragColor = vec4(finalColor, 1.0);
}
`;

// ノイズの前に...
const testFrag1 =
`#version 300 es
precision mediump float;
in vec2 vUv;
uniform float uTime;
uniform sampler2D uRandom;
out vec4 fragColor;
// getRGB(HSBをRGBに変換する関数)
vec3 getRGB(float h, float s, float b){
  vec3 c = vec3(h, s, b);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}
void main(){
  float t = uTime;
  vec4 dummy = texture(uRandom, t * 0.0 + vUv);
  fragColor = dummy;
}
`;

// データ入力はこのシェーダでuSize=512ってやれば簡単にできるよ。gl_VertexID使えば必要なのはデータだけでOK.
const dataVert =
`#version 300 es
precision mediump float;
in vec4 aData;
out vec4 vData;
uniform float uSize;
void main(){
  float index = float(gl_VertexID); // 使えるようです。やったね。
  vec2 p = vec2(mod(index, uSize), floor(index / uSize)) + 0.5;
  p /= uSize;
  p = (p - 0.5) * 2.0;
  p.y = -p.y;
  gl_Position = vec4(p, 0.0, 1.0);
  vData = aData;
  gl_PointSize = 1.0; // おかしいな。またこいつか。何で？？
}
`;

const dataFrag =
`#version 300 es
precision mediump float;
in vec4 vData;
out vec4 random4; // 乱数の4つ組
void main(){
  random4 = vData;
}
`;

// -------setup------- //
function setup(){
  createCanvas(800, 640);
  _startTime = performance.now();
  gr0 = createGraphics(400, 320, WEBGL);
  gr1 = createGraphics(400, 320, WEBGL);
  _node0 = new ex.RenderNode(gr0._renderer);
  _node1 = new ex.RenderNode(gr1._renderer); // これでよいはず

  // まあ難しくなく、板ポリで。
  const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
  _node0.registPainter("test0", copyVert, testFrag0);
  _node1.registPainter("test1", copyVert, testFrag1);

  _node0.registFigure("board", [{name:"aPosition", size:2, data:positions}]);
  _node1.registFigure("board", [{name:"aPosition", size:2, data:positions}]);

  // うまくいくんかな～
  prepareRandomTable(_node0);
  prepareRandomTable(_node1);
}

// -------draw------- //
function draw(){
  const _time = (performance.now() - _startTime) / 1000;

  background(0);
  _node0.bindFBO(null)
        .use("test0", "board")
        .setUniform("uTime", _time)
        .setFBOtexture2D("uRandom", "rdm")
        .drawArrays("triangle_strip")
        .unbind().flush();
  _node1.bindFBO(null)
        .use("test1", "board")
        .setUniform("uTime", _time)
        .setFBOtexture2D("uRandom", "rdm")
        .drawArrays("triangle_strip")
        .unbind().flush();

  image(gr0, 0, 0);
  image(gr1, 400, 320);
}

// nodeに対して512x512x4の乱数テーブルを用意させる感じ
function prepareRandomTable(node){
  // 512x512の乱数テーブル
  node.registFBO("rdm", {w:512, h:512, textureType:"float"});
  // 乱数入力用vbo
  let rdms = new Array(512*512*4);
  for(let i=0, L=512*512*4; i<L; i++){
    rdms[i] = Math.random();
  }
  node.registFigure("rdms", [{name:"aData", size:4, data:rdms}]);
  // 乱数入力用シェーダ
  node.registPainter("data", dataVert, dataFrag);
  // データ入力
  node.bindFBO("rdm")
      .use("data", "rdms")
      .setUniform("uSize", 512)
      .drawArrays("points")
      .unbind();
}

/*
"float snoise3(vec3 st){" +
"  vec3 p = st + (st.x + st.y + st.z) / 3.0;" +
"  vec3 f = fract(p);" +
"  vec3 i = floor(p);" +
"  vec3 g0, g1, g2, g3;" +
"  vec4 wt;" +
"  g0 = i;" +
"  g3 = i + u_111;" +
"  if(f.x >= f.y && f.x >= f.z){" +
"    g1 = i + u_100;" +
"    g2 = i + (f.y >= f.z ? u_110 : u_101);" +
"    wt = (f.y >= f.z ? vec4(1.0 - f.x, f.x - f.y, f.y - f.z, f.z) : vec4(1.0 - f.x, f.x - f.z, f.z - f.y, f.y));" +
"  }else if(f.y >= f.x && f.y >= f.z){" +
"    g1 = i + u_010;" +
"    g2 = i + (f.x >= f.z ? u_110 : u_011);" +
"    wt = (f.x >= f.z ? vec4(1.0 - f.y, f.y - f.x, f.x - f.z, f.z) : vec4(1.0 - f.y, f.y - f.z, f.z - f.x, f.x));" +
"  }else{" +
"    g1 = i + u_001;" +
"    g2 = i + (f.x >= f.y ? u_101 : u_011);" +
"    wt = (f.x >= f.y ? vec4(1.0 - f.z, f.z - f.x, f.x - f.y, f.y) : vec4(1.0 - f.z, f.z - f.y, f.y - f.x, f.x));" +
"  }" +
"  float value = 0.0;" +
"  wt = wt * wt * wt * (wt * (wt * 6.0 - 15.0) + 10.0);" +
"  value += wt.x * dot(p - g0, random3(g0));" +
"  value += wt.y * dot(p - g1, random3(g1));" +
"  value += wt.z * dot(p - g2, random3(g2));" +
"  value += wt.w * dot(p - g3, random3(g3));" +
"  return value;" +
"}" +
// fbm
"float fbm(vec3 st){" +
"  float value = 0.0;" +
"  float amplitude = 0.5;" +
"  for(int i = 0; i < octaves; i++){" +
"    value += amplitude * snoise3(st);" +
"    st *= 2.0;" +
"    amplitude *= 0.5;" +
"  }" +
"  return value;" +
"}" +
// hsbで書かれた(0.0～1.0)の数値vec3をrgbに変換する魔法のコード
"vec3 getHSB(float r, float g, float b){" +
"    vec3 c = vec3(r, g, b);" +
"    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);" +
"    rgb = rgb * rgb * (3.0 - 2.0 * rgb);" +
"    return c.z * mix(vec3(1.0), rgb, c.y);" +
"}" +
"void main(void){" +
"  vec2 st = gl_FragCoord.xy * 0.5 / min(u_resolution.x, u_resolution.y);" +
"  vec2 p = (st + vec2(0.05, 0.09) * u_time) * 3.0;" +
"  float n = 0.5 + 0.5 * fbm(vec3(p, u_time * 0.05));" + // ノイズ計算
"  vec3 cloudColor = vec3(1.0);" +
"  vec3 skyColor = getHSB(0.08, sqrt(st.y * (2.0 - st.y)), 1.0);" +
"  vec3 finalColor = skyColor + (cloudColor - skyColor) * smoothstep(0.44, 0.56, n);" +
"  gl_FragColor = vec4(finalColor, 1.0);" +
"}";
*/
