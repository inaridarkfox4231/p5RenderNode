// foldじゃないけど。
// 変形立方体作ろう。

// 参考：PDF:http://www.math.tohoku.ac.jp/~akama/SendaisugakuSeminarTakakukeiToKyumen.pdf
// 出典は明記しないと。

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

// できたけどエッジがわかりにくいな...どうするかな。

// まあできたし、いいか。で、法線？

// くっきりさせるには...例えば三角形をばらばらにしてテクスチャ貼り付ける。
// あるいは線描画で線で区切る。線が見えないと分かりづらい。その場合のシェーダーは単に色を出すだけ。
// 一応できたよ...
// 一番手っ取り早いのは正方形、辺三角形A, 辺三角形B, 頂点三角形をそれぞれ別メッシュにして...って一緒か

// 法線ベクトルとしては、4,5,6,7の正方形と、
// 1,7,21,  1,4,7,  1,0,4,  0,8,4,  4,8,5の三角形の法線ベクトル5本
// 凸なのでこれらでMAX取ればいいと思う。BC3のrotateFoldでそれをやるとできる、はず。
// 具体的には中でこれらに相当するベクトルを持ち出して差を取って外積取ってconsoleに上げればいい、はず。

// その一方でBC3のfoldRotateを実行する。
// やり方はまずxzの符号をいじって両方>=0となるようにし
// そのうえで上と下の内積で然るべき領域に落とす。
// 落とした後は複製したうえで然るべき平面で評価する。と、うまくいく、はず。

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
  _node = new ex.RenderNode(this._renderer.GL);
  tf = new ex.TransformEx();
  cam = new ex.CameraEx(width, height);

  // lightingShader.
  _node.registPainter("light", lightVert, lightFrag);

  // Mesh.
  registMesh();
  registMesh1();

  _node.clearColor(0, 0, 0, 1);

  // ちょっとカリング有効にしますね
  //_node.enable("cull_face");
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

  _node.registFigure("plane", [
    {name:"aPosition", size:3, data:[-2, 0, -2, -2, 0, 2, 2, 0, -2, 2, 0, 2]},
    {name:"aVertexColor", size:3, data:[0, 0.5, 1, 0, 0.5, 1, 1, 1, 1, 1, 1, 1]},
    {name:"aNormal", size:3, data:[0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]}
  ]);
}

function registMesh1(){
  // さてと。
  const k = 0.7071;
  const n = createVector(0, k, 1);
  const v0 = createVector(1, k, 0);
  const v1 = createVector(-1, k, 0);
  const v2 = createVector(0, -k, 1);
  const nx = createVector(-1, 0, -1);
  const ny = createVector(1, 0, -1);
  const nz = createVector(0, -2*k, 0); // 3本は直交する
  const u = 0.3522;
  const v = 0.2281;
  const getPos = (a, b, c) => {
    return createVector(
      n.x + a * nx.x + b * ny.x + c * nz.x,
      n.y + a * nx.y + b * ny.y + c * nz.y,
      n.z + a * nx.z + b * ny.z + c * nz.z,
    );
  }
  // これらの位置をもとに構築する。pjとpkは上面の正方形内の小正方形の4つの頂点のうちの手前の2つ。なのでまず、
  // 24個の頂点で6枚の傾いた正方形を作ってしまいましょう。それにはまずpjとpkを原点で対蹠点取ればもう2つは出ますし、
  // あとはそれを回していくだけ...難しくないはず...
  // というかuとvだけで手前3面の正方形内の座標はすべて出るからあとはそれを原点で対象移動するだけなんですよね。
  // だからまず手前の12個をuとvで記述して...って感じですかね...
  let posArray = [];
  posArray.push(getPos(u,v,0), getPos(v,1-u,0), getPos(1-u,1-v,0), getPos(1-v,u,0),
                getPos(0,u,v), getPos(0,v,1-u), getPos(0,1-u,1-v), getPos(0,1-v,u),
                getPos(v,0,u), getPos(1-u,0,v), getPos(1-v,0,1-u), getPos(u,0,1-v));
  let meshData = [];
  let vData = [];
  // 基本の12個
  for(let pos of posArray){ vData.push(pos.x, pos.y, pos.z); }
  // 始めの4つをxy反転、それ以降の8つをxz反転
  for(let i=0; i<4; i++){
    const pos = posArray[i];
    vData.push(-pos.x, -pos.y, pos.z);
  }
  for(let i=4; i<12; i++){
    const pos = posArray[i];
    vData.push(-pos.x, pos.y, -pos.z);
  }
  //meshData.push({name:"aPosition", size:3, data:vData});
  /*
  let cData = [];
  for(let i=0; i<24; i++){
    cData.push(1,1,1);
  }
  meshData.push({name:"aVertexColor", size:3, data:cData});
  */

  // まず正方形6つの分
  let fData = [0,1,2, 0,2,3, 4,5,6, 4,6,7, 8,9,10, 8,10,11, 12,13,14, 12,14,15, 16,17,18, 16,18,19, 20,21,22, 20,22,23];
  // 次につなぎの三角形の分(32個)
  fData.push(19,3,16, 16,3,2, 3,9,0, 0,9,8, 0,4,1, 1,4,7, 20,2,21, 21,2,1, // 上面周り8つ
             5,12,6, 6,12,15, 13,18,14, 14,18,17, 12,11,13, 13,11,10, 22,15,23, 23,15,14, // 下面周り8つ
             23,17,20, 20,17,16, 18,10,19, 19,10,9, 21,7,22, 22,7,6, 4,8,5, 5,8,11, // 側面8つ
             0,8,4, 1,7,21, 2,20,16, 3,19,9, 6,15,22, 14,17,23, 13,10,18, 5,11,12); // 頂点の三角形8つ

   // foldに必要なデータの出力
   const getNormal = (i, j, k) => {
     let v0 = createVector(vData[3*i], vData[3*i+1], vData[3*i+2]);
     let v1 = createVector(vData[3*j], vData[3*j+1], vData[3*j+2]);
     let v2 = createVector(vData[3*k], vData[3*k+1], vData[3*k+2]);
     v1.sub(v0); v2.sub(v0);
     const v012 = p5.Vector.cross(v1, v2).normalize();
     return v012;
   }

  let newVData = [];
  let newCData = [];
  for(let i=0; i<fData.length/3; i++){
    const f0 = fData[3*i];
    const f1 = fData[3*i+1];
    const f2 = fData[3*i+2];
    const n = getNormal(f0, f1, f2);
    // ついでに頂点も
    //console.log("vec3 n" + i + " = vec3(" + (n.x).toFixed(4) + ", " + (n.y).toFixed(4) + ", " + (n.z).toFixed(4) + ");" );
    console.log("vec3 g" + i + " = vec3(" + vData[3*f0].toFixed(4) + ", " + vData[3*f0+1].toFixed(4) + ", " + vData[3*f0+2].toFixed(4) + ");" );
    newVData.push(vData[3*f0], vData[3*f0+1], vData[3*f0+2],
                  vData[3*f1], vData[3*f1+1], vData[3*f1+2],
                  vData[3*f2], vData[3*f2+1], vData[3*f2+2]);
    let col;
    if(i < 12){
      col = ex.hsv2rgb(0.55, 0.2, 1);
      newCData.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
    }else if(i < 20){
      col = ex.hsv2rgb(0.55, 0.4, 1);
      newCData.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
    }else if(i < 28){
      col = ex.hsv2rgb(0.55, 0.6, 1);
      newCData.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
    }else if(i < 36){
      col = ex.hsv2rgb(0.55, 0.8, 1);
      newCData.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
    }else{
      col = ex.hsv2rgb(0.55, 1, 1);
      newCData.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
    }
  }
  // 初めの36個が正方形、以下24個、24個、24個、24個。

  meshData.push({name:"aPosition", size:3, data:newVData});
  meshData.push({name:"aVertexColor", size:3, data:newCData});

  let newFData = [];
  for(let i=0; i<newVData.length/3; i++){
    newFData.push(i);
  }
  let nData = ex.getNormals(newVData, newFData);
  meshData.push({name:"aNormal", size:3, data:nData});

  _node.registFigure("test1", meshData);

  // foldに必要なデータの出力
  const showNormal = (i, j, k) => {
    let v0 = createVector(vData[3*i], vData[3*i+1], vData[3*i+2]);
    let v1 = createVector(vData[3*j], vData[3*j+1], vData[3*j+2]);
    let v2 = createVector(vData[3*k], vData[3*k+1], vData[3*k+2]);
    v1.sub(v0); v2.sub(v0);
    const v012 = p5.Vector.cross(v1, v2).normalize();
    console.log(v012.x, v012.y, v012.z);
  }
  const showNormals = indexArray => {
    for(let i=0; i<indexArray.length/3; i++){
      showNormal(indexArray[i*3], indexArray[i*3+1], indexArray[i*3+2]);
    }
  }
  //showNormals([8,4,0, 8,5,4, 11,5,8, 11,12,5, 12,6,5, 5,6,7]);
  // 0.0, 0.5773, 0.8165
  // 0.1564, 0.1707, 0.9728
  // -0.1564, -0.1707, 0.9728
  // 0.0, -0.5773, 0.8165
  // 0.4439, -0.5773, 0.6853
  // 0.7071, 0.0, 0.7071
  // この6本で...
  // 1と4の座標ほしいです。
  const showPoint = i => {
    console.log(vData[3*i], vData[3*i+1], vData[3*i+2]);
  }
  //showPoint(4); // 0.3522, 0.3845, 0.6478
  //showPoint(5); // 0.2281, -0.2090, 0.7719
  // 4に対して8,4,0の法線を使い、5に対して残り5本を使う。
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
  _node.drawFigure("test1")
       .drawArrays("triangles")
       .drawFigure("plane")
       .drawArrays("triangle_strip");

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
  cam.setPerspective({near:0.1, far:10});
}
