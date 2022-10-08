// foldじゃないけど。
// 変形立方体作ろう。

// N=(0,1/sqrt(2),1);  V=(1,1/sqrt(2),0);  V'=(-1,1/sqrt(2),0);  V''=(0,-1/sqrt(2),1);
// NV', NV, NV''で右手系。
// (a,b,c) = N + a*NV' + b*NV + c*NV''と書くとき、
// J(u, v, 0), K(v, 1-u, 0), L(0, u, v)となる、ただし、
// u=0.3522011287, v=0.2281554937.
// 立方体の表面の傾いた正方形の各座標はこれですべて得られる、はず。

// サイズ小さいのいいね...これで自由だ。
// レイマーチングと同期させたいのでそこら辺いじってきた。
// 今現在原点の位置が3*sqrt(3)ですね。あっちもいじってこよう。

// いじるのおわったです。さて頂点を用意するか。

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.

let tf, cam;
let _timer = new ex.Timer();

// ------------------------------------------------------------------------------------------------------------ //
// shaders.

// 現時点でのライティング。
const lightVert =
`#version 300 es
in vec3 aPosition;
in vec3 aVertexColor;
in vec3 aNormal;
in vec2 aTexCoord;

uniform vec3 uAmbientColor;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat3 uNormalMatrix; // あーこれまだ作ってない...な...uMVの逆転置行列だそうです。

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec3 vAmbientColor;
out vec2 vTexCoord;

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);

  // Pass varyings to fragment shader
  vViewPosition = viewModelPosition.xyz;
  gl_Position = uProjectionMatrix * viewModelPosition;

  vNormal = uNormalMatrix * aNormal;
  vVertexColor = aVertexColor;
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

// ------------------------------------------------------------------------------------------------------------ //
// main code.

function setup(){
  createCanvas(800, 640, WEBGL);
  _timer.set("currentTime");
  const gl = this._renderer.GL;
  _node = new ex.RenderNode(gl);
  tf = new ex.TransformEx();
  cam = new ex.CameraEx(width, height);

  // lightingShader.
  _node.registPainter("light", lightVert, lightFrag);

  // Mesh.
  registMesh();

  _node.clearColor(0, 0, 0, 1);

  // ちょっとカリング有効にしますね
  _node.enable("cull_face");
  // 理解しました。
}

// ここで。メッシュを作る。
function registMesh(){
  //       4 --- 5
  //       │     │
  // 4 --- 0 --- 1 --- 5 --- 4
  // │     │     │     │     │
  // 7 --- 3 --- 2 --- 6 --- 7
  //       │     │
  //       7 --- 6
  let meshData = [];
  let vData = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1, -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  meshData.push({name:"aPosition", size:3, data:vData});
  let cData = [];
  for(let i=0; i<8; i++){
    if(i<4){ cData.push(1, 1, 1); }else{ cData.push(0, 0.5, 1); }
  }
  meshData.push({name:"aVertexColor", size:3, data:cData});
  let fData = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  let nData = ex.getNormals(vData, fData);
  meshData.push({name:"aNormal", size:3, data:nData});

  _node.registFigure("test", meshData);
  _node.registIBO("testIBO", {data:fData});
}

function draw(){
  // まずクリア
  _node.clear();

  // 時間取得
  const currentTime = _timer.getDeltaSecond("currentTime");

  // ライティング
  _node.usePainter("light");

  // カメラの移動
  moveCamera(currentTime);

  // 視点方向から光が当たるようにしたいのでtopを取得
  const cameraData = cam.getViewData();
  const top = cameraData.top;

  // ライティングユニフォーム
  _node.setUniform("uAmbientColor", [0.25, 0.25, 0.25]);
  _node.setUniform("uUseDirectionalLight", true);
  _node.setUniform("uLightingDirection", [-top.x, -top.y, -top.z]); // ここは、合ってるんですよ。
  _node.setUniform("uDirectionalDiffuseColor", [1, 1, 1]);

  // 彩色方法指定（頂点色）
  _node.setUniform("uUseColorFlag", 0);

  // 射影
  const projMat = cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);

  // レンダリング
  moveMesh();
  _node.drawFigure("test");
  _node.bindIBO("testIBO");
  _node.drawElements("triangles");

  _node.unbind();
  _node.flush();
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

// 特に動かさない...
function moveMesh(){
  const curTime = _timer.getDeltaSecond("currentTime");
  tf.initialize();
  setModelView();
}

// カメラ. 対象物の周囲を周回するイメージ。
// 周回してくれないです...というか中心いじってないのに中心から逸れてしまうバグが発生してる、なぜ...？？？
// カメラの方修正しました。ごめんなさい。でもこれで自由だ。よっしゃ！
function moveCamera(currentTime){
  const r = Math.sqrt(3)*3; // カメラと中心との距離
  const theta = Math.PI*0.3 * Math.sin(currentTime * Math.PI*2 * 0.2); // 縦方向の振れ幅
  const phi = Math.PI*2 * currentTime * 0.2; // 周回
  const _x = r * sin(phi) * cos(theta);
  const _y = r * sin(theta);
  const _z = r * cos(phi) * cos(theta);
  cam.setView({eye:{x:_x, y:_y, z:_z}});
  cam.setPerspective({near:r*0.1, far:r*10});
}
