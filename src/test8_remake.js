// test8のリメイク。fbm計算を分離してみるなど。

// まあそういうわけでそういうことです。float単数テクスチャの作り方。
// textureInternalFormat: gl.R32Fの textureFormat: gl.RED の textureType:gl.FLOATで
// 出力のところをfloatとする形でのあれが出来るみたい。取り出すときはrgbaでgbaが0のvec4型になってるみたいだから
// .rみたいにしないと取り出せないみたいです。報告は以上。

// ノイズのランダムのところはテーブル使わなくていいようにそのうち改良しますのでいまはこれで勘弁して...
// それはともかく。fbm落とせましたね。

// つまりこれがディファードレンダリング（遅延レンダリング）ということ、らしい...
// レンダリングに必要な数値を別のバッファに蓄えて本番はそれ使って描画するだけ。
// 色々問題もあるっぽいけど...（スマホとか環境によってはオフスクリーンのレンダリングができない、
// 半透明描画と相性が悪い、etc...）ただこういうのはできる、みたいで。だったら一通りこれが利くやつをそういう風に書いてみたいよね。
// てかそれ以外にも試したい技術が山ほどあるんですけどね...

// 20221004
// fps計測方法間違ってたので修正。これ全部直さないとあかんやつや...
// とはいえ今までのやり方が間違ってたわけじゃないけどね。動的更新のとか。あれはあれで正しかった。
// きちんと評価することが大事なのです。焦ってご破算とかやめてね。

// ----global---- //
const ex = p5wgex;
let _node;
let _timer = new ex.Timer();
let info, infoTex;

// ----shaders---- //
// フレームバッファにfloat32の値を格納する
const dataVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// R32Fに出力してみたいんだけど。
const dataFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
out float fragValue; // この書き方が通ってるということでよいのか...？
void main(){
  vec2 pos = vUv;
  pos *= 16.0;
  pos = floor(pos);
  if(mod(pos.x + pos.y, 2.0) == 0.0){ fragValue = 0.0; }
  else{ fragValue = 0.5; }
}
`; // 出力にfloat使ってるの変な感じ～

// fbmFragでござい！できるかな...
const fbmFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
uniform sampler2D uRandom;
out float fragValue;
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
  fragValue = 0.5 + 0.5 * fbm(vec3(p, uTime * 0.05)); // fbm計算
}
`; // fbmの出力部分を分けました。

// データ入力はこのシェーダでuSize=512ってやれば簡単にできるよ。gl_VertexID使えば必要なのはデータだけでOK.
const rdmVert =
`#version 300 es
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

const rdmFrag =
`#version 300 es
precision highp float;
in vec4 vData;
out vec4 random4; // 乱数の4つ組
void main(){
  random4 = vData;
}
`;

// それ使って色付け
const colorVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const colorFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uValue;
out vec4 fragColor;
// getRGB(HSBをRGBに変換する関数)
vec3 getRGB(float h, float s, float b){
  vec3 c = vec3(h, s, b);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}
void main(){
  float value = texture(uValue, vUv).r; // .rってやるとOKなのか？そうなのか？？
  // 調べたら.gや.bってやると真っ黒、つまるところ0が入ってるようですね...
  // そういうわけで.rで取り出せばOKのようです！やったね！
  // さて、今回このvalueにはfbm値が入っています。
  // あとの計算はこんな感じ...ですが...
  vec2 pos = vUv;
  pos.y = 1.0 - pos.y;
  vec3 cloudColor = vec3(1.0);
  vec3 skyColor = getRGB(0.08, sqrt(pos.y * (2.0 - pos.y)), 1.0);
  vec3 finalColor = skyColor + (cloudColor - skyColor) * smoothstep(0.44, 0.56, value);
  fragColor = vec4(finalColor, 1.0);
}
`;
/*
マグマバージョンおいとくね
vec3 fireColor = getRGB((value - 0.46) * 0.78, 1.0, 1.0);
vec3 skyColor = vec3(0.0);
vec3 finalColor = skyColor + (fireColor - skyColor) * smoothstep(0.44, 0.56, value);
fragColor = vec4(finalColor, 1.0);
*/

// copy.
// webgl2なのでESSL300で書いてみる。
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
  createCanvas(640, 640, WEBGL);
  _timer.set("slot0");
  _node = new ex.RenderNode(this._renderer.GL);

  _node.registPainter("data", dataVert, dataFrag);
  _node.registPainter("fbm", dataVert, fbmFrag);
  _node.registPainter("color", colorVert, colorFrag);
  _node.registPainter("copy", copyVert, copyFrag);
  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1,-1,1,-1,-1,1,1,1]}]);

  _node.registFBO("data", {w:640, h:640, textureInternalFormat:"r32f", textureFormat:"red", textureType:"float"});
  _node.clearColor(0,0,0,1);

  prepareRandomTable(_node);

  info = createGraphics(640, 640);
  info.fill(0);
  info.textSize(16);
  info.textAlign(LEFT, TOP);
  infoTex = new p5.Texture(this._renderer, info);

	_timer.set("fps"); // 最初に1回だけ
}

// ----draw---- //
function draw(){
  const currentTime = _timer.getDeltaSecond("slot0");
  const fps = _timer.getDeltaFPStext("fps");
	_timer.set("fps"); // ここから上のあそこまで、ってやってみたわけ。うん。なるほど...んー...
	// でもよく考えたらfpsなんだからこうするのが正解よね...

  _node.bindFBO("data")
       .use("fbm", "board")
       .setFBOtexture2D("uRandom", "rdm")
       .setUniform("uTime", currentTime)
       .drawArrays("triangle_strip")
       .unbind();

  // おかしいな。nullのとこ"null"って書いてた。あれれ～
  // まあいいや...エラー処理充実したし。
  _node.bindFBO(null)
       .clear()
       .use("color", "board")
       .setFBOtexture2D("uValue", "data")
       .drawArrays("triangle_strip")
       .unbind();

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
  node.registPainter("rdm", rdmVert, rdmFrag);
  // データ入力
  node.bindFBO("rdm")
      .use("rdm", "rdms")
      .setUniform("uSize", 512)
      .drawArrays("points")
      .unbind();
}