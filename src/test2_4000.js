// 4000box.
// 元ネタ：@incre_ment さんの https://twitter.com/incre_ment/status/1574569987196350464

// 今回バーテックスステージでモデル変換するのでモデル行列要らないですね...というかそのまま渡しちゃってOKです。

// まず
// 1.スケール変換は一律なので先にやっておく
// 2.translate(_x,_y,_z)と色に掛けるfactorが個別なのでこれをvec4-floatのframebuffer(20x200)で計算する
// 3.結果をインデックスを元に取得してそれを使って諸々計算しよう。

// ドローコールの方を先にした方が速いのかな...そこちょっと気になってるのよ。

// 結論。駄目！

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.

let tf, cam;
let _timer = new ex.Timer();
let _time = 0;

let info, infoTex;

// ------------------------------------------------------------------------------------------------------------ //
// shaders.

// calc用のシェーダー
// vertは一緒だわね...
const calcVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// calcFragはxの方を200.0倍してfloor,yの方を20倍してfloorして、
// その整数に対して何か計算してvec4こしらえて出力する。
const calcFrag =
`#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragData;

uniform vec2 uSize;  // 今回は200x20.
uniform float uTime; // 時間。0.01ずつふやすんだとか。んー...

const float TAU = 6.28318;

void main(){
  vec2 indices = floor(vUv * uSize);
  float a = indices.x * 0.005;  // 0.005の0倍～199倍
  float i = indices.y + 1.0;    // 1～20
  float k = 20.0;
  float w = 600.0;
  float t = uTime;
  float p = (i+5.0*t)/k;
  float r = pow(1.0-p, 3.0);
  float _x = 4.0*r*w*sin(TAU*a);
  float _y = 500.0 - 2.0*w*p*p*p*p + 50.0*sin(TAU*(3.0*(p+a)+t));
  float _z = 4.0*r*w*cos(TAU*a) - 200.0;
  float blightness = p*w/255.0;
  fragData = vec4(_x, _y, _z, blightness); // 出力！
}
`;

// 現時点でのライティング。
const lightVert =
`#version 300 es
in vec3 aPosition;
in vec3 aVertexColor; // 今回は不使用
in vec3 aNormal;
in vec2 aTexCoord;

uniform vec3 uAmbientColor;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix; // あーこれまだ作ってない...な...uMVの逆転置行列だそうです。

uniform sampler2D uData;

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec3 vAmbientColor;
out vec2 vTexCoord;

const float TAU = 6.28318;

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
  vec3 pos = aPosition;
  // さていじりますか。
  // スケール変換は済ませておく。

  // 変換データをテクスチャより取得
  float id = floor(float(gl_VertexID) / 8.0);
  vec2 dataPos = vec2(mod(id, 200.0) + 0.5, floor(id / 200.0) + 0.5) / vec2(200.0, 20.0); // あっ忘れてた
  vec4 data = texture(uData, dataPos);

  // 位置調整
  pos += vec3(data.x, data.y, data.z);

  // 次に色の調整をしますね
  vec3 color = vec3(0.5, 0.75, 1.0);
  // 遠くに行くほど暗くなる変化を加えているのでそれを考慮
  color *= data.w;

  // 以上ですね。

  vec4 viewModelPosition = uModelViewMatrix * vec4(pos, 1.0);

  // Pass varyings to fragment shader
  vViewPosition = viewModelPosition.xyz;
  gl_Position = uProjectionMatrix * viewModelPosition;

  vNormal = uNormalMatrix * aNormal;
  // ここですね。
  vVertexColor = color;
  vTexCoord = aTexCoord;

  vAmbientColor = uAmbientColor;
}
`;

// なんかね、lightFragはmediumpにしないといけない...？
// 富士山に雪降らせるやつでlightのやつhighpにしたらおかしくなった。
// 何でもかんでもhighpにすればいいってわけじゃないみたいです。
// って思ったけどレイマのライティングはいいんよね...んー。まあ臨機応変で...
// とりまmediumpで。
const lightFrag =
`#version 300 es
precision mediump float;
// ビュー行列
uniform mat4 uViewMatrix;
// directionalLight関連
uniform vec3 uLightingDirection;
uniform vec3 uDirectionalDiffuseColor;
uniform vec3 uPointLightLocation;
uniform vec3 uPointLightDiffuseColor;
uniform vec3 uAttenuation; // デフォルトは1,0,0.
// pointLight関連
uniform bool uUseDirectionalLight; // デフォルトはfalse.
uniform bool uUsePointLight; // デフォルトはfalse;
// 描画フラグ各種
const float diffuseFactor = 0.73;
const int USE_VERTEX_COLOR = 0;
const int USE_MONO_COLOR = 1;
const int USE_UV_COLOR = 2; // そのうち。

uniform int uUseColorFlag; // 0:vertex. 1:mono. 2:UV
uniform vec3 uMonoColor; // monoColorの場合
uniform sampler2D uTex; // uvColorの場合

in vec3 vVertexColor;
in vec3 vNormal;
in vec3 vViewPosition;
in vec3 vAmbientColor;
in vec2 vTexCoord; // テクスチャ

out vec4 fragColor; // 出力。

// DirectionalLight項の計算。
vec3 getDirectionalLightDiffuseColor(vec3 normal){
  vec3 lightVector = (uViewMatrix * vec4(uLightingDirection, 0.0)).xyz;
  vec3 lightDir = normalize(lightVector);
  vec3 lightColor = uDirectionalDiffuseColor;
  float diffuse = max(0.0, dot(-lightDir, normal));
  return diffuse * lightColor;
}
// PointLight項の計算。attenuationも考慮。
vec3 getPointLightDiffuseColor(vec3 modelPosition, vec3 normal){
  vec3 lightPosition = (uViewMatrix * vec4(uPointLightLocation, 1.0)).xyz;
  vec3 lightVector = modelPosition - lightPosition;
  vec3 lightDir = normalize(lightVector);
  float lightDistance = length(lightVector);
  float d = lightDistance;
  float lightFallOff = 1.0 / dot(uAttenuation, vec3(1.0, d, d*d));
  vec3 lightColor = lightFallOff * uPointLightDiffuseColor;
  float diffuse = max(0.0, dot(-lightDir, normal));
  return diffuse * lightColor;
}
// _lightはこれで。
vec3 totalLight(vec3 modelPosition, vec3 normal){
  vec3 result = vec3(0.0); // 0.0で初期化
// directionalLightの影響を加味する
  if(uUseDirectionalLight){
    result += getDirectionalLightDiffuseColor(normal);
  }
// pointLightの影響を加味する
  if(uUsePointLight){
    result += getPointLightDiffuseColor(modelPosition, normal);
  }
  result *= diffuseFactor;
  return result;
}
// include lighting.glsl

// メインコード
void main(void){
  vec3 diffuse = totalLight(vViewPosition, normalize(vNormal));
  vec4 col = vec4(1.0);

  if(uUseColorFlag == USE_VERTEX_COLOR){
    col.rgb = vVertexColor; // 頂点色
  }
  if(uUseColorFlag == USE_MONO_COLOR) {
    col.rgb = uMonoColor;  // uMonoColor単色
  }
  if(uUseColorFlag == USE_UV_COLOR){
    vec2 tex = vTexCoord;
    tex.y = 1.0 - tex.y;
    col = texture(uTex, tex);
    if(col.a < 0.1){ discard; }
  }
  // diffuseの分にambient成分を足してrgbに掛けて色を出してspecular成分を足して完成みたいな（？？）
  col.rgb *= (diffuse + vAmbientColor);
  fragColor = col;
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

// ------------------------------------------------------------------------------------------------------------ //
// main code.

function setup(){
  createCanvas(800, 640, WEBGL);
  frameRate(30); // 今回はframeRate=30の方がいいみたいです。重いので。

  const gl = this._renderer.GL;
  _node = new ex.RenderNode(gl);
  tf = new ex.TransformEx();
  cam = new ex.CameraEx(width, height);

  // lightingShader.
  _node.registPainter("light", lightVert, lightFrag);

  // キューブメッシュ（頂点のインデックスはbackにならって上から見て時計回り）
  // こういうの作ると便利よ。テクスチャ貼るのも楽になるし。
  //       4 --- 5
  //       │     │
  // 4 --- 0 --- 1 --- 5 --- 4
  // │     │     │     │     │
  // 7 --- 3 --- 2 --- 6 --- 7
  //       │     │
  //       7 --- 6
  meshData = [];

  let vData = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1,
               -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  // 正規化. 今回は仕様の関係で0.5サイズとさせていただきます。つまり辺の長さが1ということ。
  // 0.5って字が書くのめんどくさいのでこの方がいいですね。
  // 先に計算してしまう。
  for(let i=0; i<8; i++){
    vData[3*i] *= 0.5 * 9;
    vData[3*i+1] *= 0.5 * 600;
    vData[3*i+2] *= 0.5 * 9;
  }
  // これを4000個複製する
  let positions = [];
  for(let i=0; i<4000; i++){
    positions.push(...vData);
  }
  meshData.push({name:"aPosition", size:3, data:positions});

  // 高さで色付けしましょうか

  let fData = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  let nData = ex.getNormals(vData, fData);
  // nDataを4000個複製
  let normals = [];
  for(let i=0; i<4000; i++){
    normals.push(...nData);
  }
  meshData.push({name:"aNormal", size:3, data:normals});
  // お疲れさまでした。
  _node.registFigure("cube", meshData);

  // faceIndicesも4000個複製。ただしインデックスの値を8ずつ増やしていくので注意。
  let faceIndices = [];
  for(let i=0; i<4000; i++){
    for(let index of fData){
      faceIndices.push(i*8 + index);
    }
  }
  _node.registIBO("cubeIBO", {data:faceIndices});

  // データ計算用
  _node.registPainter("calc", calcVert, calcFrag);
  // vec4のfloatのframebuffer.
  _node.registFBO("param", {w:200, h:20, textureType:"float"})

  // こんな感じ？ですね。次。

  _node.clearColor(0, 0, 0, 1);

  // info用
  _node.registPainter("copy", copyVert, copyFrag);
  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1,-1,1,-1,-1,1,1,1]}]);

  info = createGraphics(width, height);
  info.fill(255);
  info.noStroke();
  info.textSize(16);
  info.textAlign(LEFT, TOP);
  infoTex = new p5.Texture(this._renderer, info);

	_timer.set("fps"); // 最初に1回だけ
}

// やること
// 行列ユニフォーム一通り
// ライティングユニフォーム一通り
// 彩色方法指定（単色、頂点色、UV）
// ドローコール
// おわり。サクサク行こう。
function draw(){
  _node.clear();

  const fps = _timer.getDeltaFPStext("fps", frameRate());
	_timer.set("fps"); // ここから上のあそこまで、ってやってみたわけ。うん。なるほど...んー...

  _time += 0.01;
  if(_time > 1){ _time -= 1; }

  // データ計算.
  _node.bindFBO("param")
       .use("calc", "board")
       .setUniform("uTime", _time)
       .setUniform("uSize", [200, 20])
       .drawArrays("triangle_strip")
       .unbind();
  // bindを切る
  _node.bindFBO(null);

  // ライティングシェーダ、オン！
  _node.usePainter("light");

  // 射影
  const projMat = cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);

  // ライティングユニフォーム（今回はpointLightで）
  _node.setUniform("uAmbientColor", [0.25, 0.25, 0.25]);
  _node.setUniform("uUsePointLight", true);
  _node.setUniform("uPointLightLocation", [0,100,200]);
  _node.setUniform("uPointLightDiffuseColor", [0.6,0.8,1]);
  _node.setUniform("uAttenuation", [1,0,0]);

  // 彩色方法指定（頂点色）
  _node.setUniform("uUseColorFlag", 0);
  //_node.setUniform("uTime", _time); // カスタムパラメータ

  // キューブ（動かす、属性バインド、IBOバインド、ドローコール）
  moveCube();
  _node.drawFigure("cube");
  _node.setFBOtexture2D("uData", "param"); // paramを参照
  _node.bindIBO("cubeIBO");
  _node.drawElements("triangles");
  _node.unbind();

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

// 行列関連はまとめとこうか
function setModelView(){
  const modelMat = tf.getModelMat().m;
  const viewMat = cam.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  const normalMat = ex.getNormalMat(modelViewMat);
  _node.setUniform("uViewMatrix", viewMat);
  _node.setUniform("uModelViewMatrix", modelViewMat);
  _node.setUniform("uNormalMatrix", normalMat);
}

// キューブのtf
// これも同じことで、この場合特定の場所で重心を中心に回転させたいわけだが、点集合で考えれば
// 回転してから然るべくtranslate,となるから、それを逆回ししただけ。さらにスケール変換...？これ最後なのでは...？
function moveCube(){
  tf.initialize();
  setModelView();
}
