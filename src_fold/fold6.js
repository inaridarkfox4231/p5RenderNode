// H3の前にorbitControlのテストをしようかな。

// わからん！！！！
// おかしい...nearが小さいときも大きいときも消えるうえに、0.8付近だけしか描画させてもらえない
// 謎のバグが発生してる。謎すぎる。ああーーー！！

// うまくいってるfold4.jsにplane移植したらバグが発生しなかった。イミフ...

// ごめんなさい。背景のせいでした。馬鹿か...
// そんなことで何時間も使うなよ...馬鹿か...
// 何とかするには、何だっけ...まあ、普通に合わせたいなら2Dでやるしかないんだわな。

// はい。
// まず先に背景を2Dで描画する場合、この場合はdepth_testをdisableしてからenableする。OK?
// 次に、もうやってますがあとからなんか画像をかぶせる場合。この場合はblendをONにして、
// one, one_minus_src_alphaってやればOK. これと3D描画は両立しない...というか3Dはdepthがないと
// 話にならないし基本blendとは両立しえないのです。blendは基本的にいわゆる2D-webglのお話ですからね。以上！！
// カメラ動かすのは明日にしよう...

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.

let tf, cam;
// 手動で動かすのでタイマーは無しで。とりあえずズームとスライド。余裕があったらアライズ、
// あとヨーイングローリングピッチング（おいおいおいおーーーい）
let _timer = new ex.Timer();
let bg, bgTex; // ていうかテクスチャ実装はよ（3Dテクスチャ実装はよ）
let img;

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

// ----- HEY!!

function setup(){
  createCanvas(800, 640, WEBGL);
  _timer.set("currentTime");
  _node = new ex.RenderNode(this._renderer.GL);
  tf = new ex.TransformEx();
  cam = new ex.CameraEx(width, height);

  // bg.
  bg = createGraphics(width, height);
  bg.background(0);
  bg.fill(255);
  bg.textSize(16);
  bg.textAlign(LEFT, TOP);
  bgTex = new p5.Texture(this._renderer, bg);
  _node.registPainter("bg", copyVert, copyFrag);
  _node.registFigure("bg", [{name:"aPosition", size:2, data:[-1, -1, 1, -1, -1, 1, 1, 1]}]);
  img = createGraphics(width, height);
  img.noStroke();
  for(i=0;i<img.height;i++){
    img.fill(i*255/img.height);
    img.rect(0,i,img.width,1);
  }

  // ライティングシェーダー
  _node.registPainter("light", lightVert, lightFrag);

  // 平面と立方体
  _node.registFigure("plane", [
    {name:"aPosition", size:3, data:[-2, -2, 0, 2, -2, 0, -2, 2, 0, 2, 2, 0]},
    {name:"aVertexColor", size:3, data:[0, 0.5, 1, 0, 0.5, 1, 1, 1, 1, 1, 1, 1]},
    {name:"aNormal", size:3, data:[0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]}
  ]);
  const cubePosition = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1,
                        -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  const cubeColor = [];
  for(let i=0; i<8; i++){
    if(cubePosition[3*i+2] > 0){
      cubeColor.push(0,0.5,1);
    }else{
      cubeColor.push(1,1,1);
    }
    cubePosition[3*i] *= 0.5;
    cubePosition[3*i+1] *= 0.5;
    cubePosition[3*i+2] *= 0.5;
    cubePosition[3*i+2] += 0.501; // z軸上にしよ～
  }
  const cubeFaces = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  const cubeNormals = ex.getNormals(cubePosition, cubeFaces);
  _node.registFigure("cube", [
    {name:"aPosition", size:3, data:cubePosition},
    {name:"aVertexColor", size:3, data:cubeColor},
    {name:"aNormal", size:3, data:cubeNormals}
  ]);
  _node.registIBO("cubeIBO", {data:cubeFaces});

  // まあめんどくさいわな。何とかしたいところ。メッシュ用意するところはいつか簡略化したいんですけどね。
  // さっさと済ませないとめんどくさいわ...静止でいいから大量に配置とかささっとできるといいわね。
  // モデルの読み込みのテストとかしたい。

  // 真っ黒クリア。カリングは無しで。
  _node.clearColor(0, 0, 0, 1);

  // 最初の一手
  moveCamera(0);
}

function draw(){
  // 時間取得
  const currentTime = _timer.getDeltaSecond("currentTime");

  _node.bindFBO(null).clear(); // これ癖にするといいかも。

  // 背景...
  // デプステストで挟む。これを使うと、板ポリを描画する際に
  // 深度が記録されないので、ああいった問題が起こらなくなる...ようです。そうね。
  _node.disable("depth_test");
  drawBG();
  _node.enable("depth_test");

  /*
    おおまかな手順
    0.カメラを動かすなら事前に動かしておく。
    1.シェーダーON
    2.射影行列入れちゃう
    3.ライティングユニフォーム一通り用意
    4.彩色方法をユニフォームで指定
    5.モデルごとにトランスフォーム指定、モデルビューノーマルの行列用意、ドローコール。
    一緒でいいなら要らないけれど。おわり。それもめんどくさいのよね...どうにかするか。
  */

  //moveCamera(currentTime);
  controlCamera();
  _node.usePainter("light");

  // 射影
  const projMat = cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);

  // ライティングユニフォーム
  const {top} = cam.getViewData(); // 見る方向から光を当てたいならこうする
  _node.setUniform("uAmbientColor", [0.25, 0.5, 0.25]);
  _node.setUniform("uUseDirectionalLight", true);
  _node.setUniform("uLightingDirection", [-top.x, -top.y, -top.z]);
  _node.setUniform("uDirectionalDiffuseColor", [1, 1, 1]);

  // 彩色方法指定（頂点色）
  _node.setUniform("uUseColorFlag", 0);

  tf.initialize();
  setModelView();

  _node.drawFigure("plane").drawArrays("triangle_strip")
       .drawFigure("cube")
       .bindIBO("cubeIBO")
       .drawElements("triangles")
       .unbind();

  // 最後にflush.
  _node.flush();
}

function drawBG(){
  bg.image(img, 0, 0);
  bg.text("Camera test!", 5, 5);
  bgTex.update();

  _node.use("bg", "bg")
       .setTexture2D("uTex", bgTex.glTex)
       .drawArrays("triangle_strip")
       .unbind();
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

// カメラ. 対象物の周囲を周回するイメージ。
// nearとfarおかしくなかったです。背景...
function moveCamera(currentTime){
  const r = Math.sqrt(3)*3; // カメラと中心との距離
  const phi = Math.PI*2 * currentTime * 0.2; // 周回
  const _x = r * cos(phi);
  const _y = r * sin(phi);
  const _z = r * 0.5;
  cam.setView({eye:{x:_x, y:_y, z:_z}, up:{x:0, y:0, z:1}});
  cam.setPerspective({near:0.1, far:10});
}

function controlCamera(){
  // カメラをコントロール。
  // 上下キーでズーム、左右キーでスライド、Wキーで上昇、Sキーで下降。できたね！！
  if(keyIsDown(UP_ARROW)){ cam.zoom(0.1); }
  if(keyIsDown(DOWN_ARROW)){ cam.zoom(-0.1); }
  if(keyIsDown(RIGHT_ARROW)){ cam.slide(0.03); }
  if(keyIsDown(LEFT_ARROW)){ cam.slide(-0.03); }
  if(keyIsDown(87)){ cam.arise(0.031); }
  if(keyIsDown(83)){ cam.arise(-0.031); }
}
