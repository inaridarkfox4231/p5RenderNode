// ライティングシェーダの基本ということで
// テンプレート作る。さすがに面倒になってきた。
// とはいえ改造する場合も多いしmodelに関してもああやってコンポジットしないと大量に動かすのに不便だから
// modelは使うかどうか選べるように
// しますか
// いや、もうこの際それをデフォにしたいかな...たとえば512個あるとして
// 4x512のfloatのあれを作って、とか。で、indexで参照して、どうせ単純な動きしか指定しない、
// 固定なら初めからそういう風に作ったうえで単位行列でOKだし。自由に選べるように枠組み用意するとか。何でもできる。

// ディファードはそれで速くなるとは限らないということで保留で、今回は普通にやる。
// けど、もういいや。
// え、sphereをばうんしんぐ？はい。わかりました。

// タイトル：light.

// サイズに関する付加情報をフレームバッファにぶちこんでおいてデータ作る際に参照するのもありかもしれない

// --------------------------------------------- global ----------------------------------------------- //
const ex = p5wgex;
let _node;
const _timer = new ex.Timer();
let cam0;

// ----------------------------------------------- light ------------------------------------------------ //
const colorVert =
`#version 300 es
in vec3 aPosition;
in vec3 aVertexColor;
in vec3 aNormal;
in vec2 aTexCoord;
in float aIndex;

uniform sampler2D uData; // これ。
uniform float uDataNum;
uniform mat4 uViewMatrix;
uniform mat4 uProjMatrix; // ModelViewProjectionだとさすがに長すぎるので統一目的でProjに短縮

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vTexCoord;
out float vIndex;

out vec4 vNDC;

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない

  mat4 modelMatrix;
  for(int i=0; i<4; i++){
    modelMatrix[i] = texture(uData, vec2((float(i) + 0.5) / 4.0, (aIndex + 0.5) / uDataNum)); // たぶんこれでいける。
  }
  mat4 modelViewMatrix = uViewMatrix * modelMatrix;

  vec4 viewModelPosition = modelViewMatrix * vec4(aPosition, 1.0);

  // Pass varyings to fragment shader
  vViewPosition = viewModelPosition.xyz;
  vec4 NDcoord = uProjMatrix * viewModelPosition; // 正規化デバイス座標
  gl_Position = NDcoord;
  vNDC = NDcoord;

  mat3 normalMatrix; // こうしよう。[0]で列ベクトルにアクセス。
  normalMatrix[0] = modelViewMatrix[0].xyz;
  normalMatrix[1] = modelViewMatrix[1].xyz;
  normalMatrix[2] = modelViewMatrix[2].xyz;
  normalMatrix = inverse(transpose(normalMatrix)); // これでいい。

  vNormal = normalMatrix * aNormal;
  vVertexColor = aVertexColor;
  vTexCoord = aTexCoord;
  vIndex = aIndex;
}
`;

const colorFrag =
`#version 300 es
precision mediump float;

// -------------------- マテリアル関連 -------------------- //

// 描画フラグ各種
const int USE_VERTEX_COLOR = 0;
const int USE_MONO_COLOR = 1;
const int USE_UV_COLOR = 2; // そのうち。

//uniform int uUseColorFlag; // 0:vertex. 1:mono. 2:UV
uniform vec3 uMonoColor; // monoColorの場合
uniform sampler2D uTex; // uvColorの場合
uniform vec3 uTint; // texture関連でtextureに色を付与したい場合のためのオプション。掛けるだけ。

in vec3 vVertexColor;
in vec3 vNormal;
in vec3 vViewPosition;
in vec2 vTexCoord; // テクスチャ
in float vIndex;

in vec4 vNDC;

// -------------------- 出力その他 -------------------- //
layout (location = 0) out vec4 materialColor;
layout (location = 1) out vec4 viewPosition;
layout (location = 2) out vec4 normal;

// -------------------- メインコード -------------------- //

void main(void){

  // 白。デフォルト。
  vec4 col = vec4(1.0);
  int colorFlag = USE_VERTEX_COLOR; // とりあえず頂点色
  if(vIndex == 0.0){ colorFlag = USE_UV_COLOR; } // 床だけtexture.

  // マテリアルカラーの計算
  if(colorFlag == USE_VERTEX_COLOR){
    col.rgb = vVertexColor; // 頂点色
  }
  if(colorFlag == USE_MONO_COLOR) {
    col.rgb = uMonoColor;  // uMonoColor単色
  }
  if(colorFlag == USE_UV_COLOR){
    vec2 tex = vTexCoord;
    tex.y = 1.0 - tex.y;
    col = texture(uTex, tex);
    col.rgb *= uTint;
    if(col.a < 0.1){ discard; }
  }
  materialColor = col;
  float depth = 0.5 * (vNDC.z / vNDC.w) + 0.5;
  normal = vec4(vNormal, depth);
  viewPosition = vec4(vViewPosition, 1.0); // んー...んー...
}
`;

// 一度やってるから、緊張しなければいけるはず。
// データ格納時に左下のpixelが(0,0)に格納される。で、ここのvUvは(0,0)で取得した色を左下に置くので反転の必要が無いってわけ。
const deferVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = 0.5 * aPosition + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// normal, color, modelPositionよりfinalColorを計算して出力する。
const deferFrag =
`#version 300 es
precision mediump float;
// ---------------- sampler ------------------ //
uniform sampler2D uMaterialColor;  // ubyteの4
uniform sampler2D uViewPosition;   // floatの4
uniform sampler2D uNormal;         // floatの4
// -------------------- ライティング関連 -------------------- //
// ビュー行列
uniform mat4 uViewMatrix;

// 汎用色
uniform vec3 uAmbientColor;
uniform float uShininess; // specularに使う、まあこれが大きくないと見栄えが悪いのです。光が集中する。
uniform vec3 uAttenuation; // デフォルトは1,0,0. pointLightで使う

// directionalLight関連
uniform int uDirectionalLightCount; // デフォ0なのでフラグ不要
uniform vec3 uLightingDirection[5];
uniform vec3 uDirectionalDiffuseColor[5];
uniform vec3 uDirectionalSpecularColor[5]; // specular用

// pointLight関連
uniform int uPointLightCount; // これがデフォルトゼロであることによりフラグが不要となる。
uniform vec3 uPointLightLocation[5];
uniform vec3 uPointLightDiffuseColor[5];
uniform vec3 uPointLightSpecularColor[5]; // specular用

// spotLight関連
uniform int uSpotLightCount; // 0～5
uniform vec3 uSpotLightDirection[5];
uniform vec3 uSpotLightLocation[5];
uniform float uSpotLightAngle[5];
uniform float uSpotLightConc[5];
uniform vec3 uSpotLightDiffuseColor[5];
uniform vec3 uSpotLightSpecularColor[5]; // specular用

// light flag.
uniform bool uUseSpecular; // デフォルトはfalse;

// 係数
const float diffuseCoefficient = 0.73;
const float specularCoefficient = 2.0;

// -------------------- ライティング処理 -------------------- //

float lambertDiffuse(vec3 lightDirection, vec3 surfaceNormal){
  return max(0.0, dot(-lightDirection, surfaceNormal));
}

// 要は目に飛び込んでくるなら明るくなるでしょって話
float phongSpecular(vec3 lightDirection, vec3 viewDirection, vec3 surfaceNormal){
  vec3 R = reflect(lightDirection, surfaceNormal);
  return pow(max(0.0, dot(R, viewDirection)), uShininess); // shininessはuniformでいいや。
}

// DirectionalLight項の計算。
void applyDirectionalLight(vec3 direction, vec3 diffuseColor, vec3 specularColor,
                           vec3 modelPosition, vec3 normal, out vec3 diffuse, out vec3 specular){
  vec3 viewDirection = normalize(-modelPosition);
  vec3 lightVector = (uViewMatrix * vec4(direction, 0.0)).xyz;
  vec3 lightDir = normalize(lightVector);
  // 色計算
  vec3 lightColor = diffuseColor;
  float diffuseFactor = lambertDiffuse(lightDir, normal);
  diffuse += diffuseFactor * lightColor; // diffuse成分を足す。
  if(uUseSpecular){
    float specularFactor = phongSpecular(lightDir, viewDirection, normal);
    specular += specularFactor * lightColor * specularColor;
  }
}

// PointLight項の計算。attenuationも考慮。
void applyPointLight(vec3 location, vec3 diffuseColor, vec3 specularColor,
                     vec3 modelPosition, vec3 normal, out vec3 diffuse, out vec3 specular){
  vec3 viewDirection = normalize(-modelPosition);
  vec3 lightPosition = (uViewMatrix * vec4(location, 1.0)).xyz;
  vec3 lightVector = modelPosition - lightPosition;
  vec3 lightDir = normalize(lightVector);
  float lightDistance = length(lightVector);
  float d = lightDistance;
  float lightFalloff = 1.0 / dot(uAttenuation, vec3(1.0, d, d*d));
  // 色計算
  vec3 lightColor = lightFalloff * diffuseColor;
  float diffuseFactor = lambertDiffuse(lightDir, normal);
  diffuse += diffuseFactor * lightColor; // diffuse成分を足す。
  if(uUseSpecular){
    float specularFactor = phongSpecular(lightDir, viewDirection, normal);
    specular += specularFactor * lightColor * specularColor;
  }
}

// SpotLight項の計算。attenuationは共通で。
// locationとdirectionが両方入っているうえ、光源の開き(angle)と集中度合い(conc)が追加されて複雑になってる。
void applySpotLight(vec3 location, vec3 direction, float angle, float conc, vec3 diffuseColor, vec3 specularColor,
                    vec3 modelPosition, vec3 normal, out vec3 diffuse, out vec3 specular){
  vec3 viewDirection = normalize(-modelPosition);
  vec3 lightPosition = (uViewMatrix * vec4(location, 1.0)).xyz; // locationは光の射出位置
  vec3 lightVector = modelPosition - lightPosition; // 光源 → モデル位置
  vec3 lightDir = normalize(lightVector);
  float lightDistance = length(lightVector);
  float d = lightDistance;
  float lightFalloff = 1.0 / dot(uAttenuation, vec3(1.0, d, d*d));
  // falloffは光それ自身の減衰で、これに加えてspot（angleで定義されるcone状の空間）からのずれによる減衰を考慮
  float spotFalloff;
  vec3 lightDirection = (uViewMatrix * vec4(direction, 0.0)).xyz;
  // lightDirはモデルに向かうベクトル、lightDirectionはスポットライトの向きとしての光の向き。そこからのずれで減衰させる仕組み。
  float spotDot = dot(lightDir, normalize(lightDirection));
  if(spotDot < cos(angle)){
    spotFalloff = 0.0;
  }else{
    spotFalloff = pow(spotDot, conc); // cosが大きいとは角度が小さいということ
  }
  lightFalloff *= spotFalloff;
  // あとはpointLightと同じ計算を行ない最後にfalloffを考慮する
  // 色計算
  vec3 lightColor = lightFalloff * diffuseColor;
  float diffuseFactor = lambertDiffuse(lightDir, normal);
  diffuse += diffuseFactor * lightColor; // diffuse成分を足す。
  if(uUseSpecular){
    float specularFactor = phongSpecular(lightDir, viewDirection, normal);
    specular += specularFactor * lightColor * specularColor;
  }
}

// _lightはこれで。
vec3 totalLight(vec3 modelPosition, vec3 normal, vec3 materialColor){
  vec3 diffuse = vec3(0.0); // diffuse成分
  vec3 specular = vec3(0.0); // ついでに
  // directionalLightの影響を加味する
  for(int i=0; i<uDirectionalLightCount; i++){
    applyDirectionalLight(uLightingDirection[i], uDirectionalDiffuseColor[i], uDirectionalSpecularColor[i],
                          modelPosition, normal, diffuse, specular);
  }
  // pointLightの影響を加味する
  for(int i=0; i<uPointLightCount; i++){
    applyPointLight(uPointLightLocation[i], uPointLightDiffuseColor[i], uPointLightSpecularColor[i],
                    modelPosition, normal, diffuse, specular);
  }
  // spotLightの影響を加味する
  for(int i=0; i<uSpotLightCount; i++){
    applySpotLight(uSpotLightLocation[i], uSpotLightDirection[i], uSpotLightAngle[i], uSpotLightConc[i],
                   uSpotLightDiffuseColor[i], uSpotLightSpecularColor[i],
                   modelPosition, normal, diffuse, specular);
  }
  diffuse *= diffuseCoefficient;
  specular *= specularCoefficient;
  vec3 result = diffuse + uAmbientColor;
  result *= materialColor;
  result += specular;
  return result;
}

// ----- 出力その他 ----- //
in vec2 vUv; // これでアクセスする。
out vec4 finalColor;

// ----- メインコード ----- //
void main(){
  vec3 normal = normalize(texture(uNormal, vUv).xyz);
  vec3 viewPosition = texture(uViewPosition, vUv).xyz;
  vec4 color = texture(uMaterialColor, vUv);

  vec3 result = totalLight(viewPosition, normal, color.rgb);

  // ディファードの場合、この計算前のcol(rgba)と、normal, vViewPosition, 場合によってはvTexCoordが
  // MRTで送られる対象になる。もしくはついでにデプスなど。doxasさんのサイトではこれらが可視化されていましたね。

  color.rgb = result;
  finalColor = color;
}
`;

// fbにmodelMatrixの成分を書き込むシェーダ（実態は板ポリ芸）. vsは何もしない。gl_FragCoordのfloor値でいろいろやる。
const dataVert =
`#version 300 es
in vec2 aPosition;
void main(){
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// 4x512でやる。512=1+511.
const dataFrag =
`#version 300 es
precision highp float;
uniform float uTime;
uniform float uHeight;
out vec4 data;
const float PI = 3.14159;
const float TAU = 6.28318;
void main(){
  vec2 p = gl_FragCoord.xy;
  p = floor(p);
  vec4 result;
  float index = p.y;
  float t = fract(uTime * 0.25 + index * 31.46);
  float u = uTime*TAU;
  float z = 1.0 + 4.0*uHeight*t*(1.0-t);
  float phi = TAU*index/16.0;
  float r = sqrt(phi/2.4) * 0.8;
  float x = r * cos(phi);
  float y = r * sin(phi);
  if(index == 0.0){
    if(p.x == 0.0){ result = vec4(1.0, 0.0, 0.0, 0.0); }
    if(p.x == 1.0){ result = vec4(0.0, 1.0, 0.0, 0.0); }
    if(p.x == 2.0){ result = vec4(0.0, 0.0, 1.0, 0.0); }
    if(p.x == 3.0){ result = vec4(0.0, 0.0, 0.0, 1.0); }
  }else{
    if(p.x == 0.0){ result = vec4(cos(u), -sin(u), 0.0, 0.0); }
    if(p.x == 1.0){ result = vec4(sin(u), cos(u), 0.0, 0.0); }
    if(p.x == 2.0){ result = vec4(0.0, 0.0, 1.0, 0.0); }
    if(p.x == 3.0){ result = vec4(x, y, z, 1.0); }
  }
  data = result;
}
`;

// --------------------------------------------------- lightconfig ------------------------------------------------------------- //

// 環境光などの基本的なセッティング
function setLight(node, info = {}){
  if(info.ambient === undefined){ info.ambient = [64.0/255.0, 64.0/255.0, 64.0/255.0]; }
  if(info.shininess === undefined){ info.shininess = 40; }
  if(info.attenuation === undefined){ info.attenuation = [1, 0, 0]; }
  if(info.useSpecular === undefined){ info.useSpecular = false; }
  node.setUniform("uAmbientColor", info.ambient);
  node.setUniform("uShininess", info.shininess);
  node.setUniform("uAttenuation", info.attenuation);
  node.setUniform("uUseSpecular", info.useSpecular);
}

// 平行光
function setDirectionalLight(node, info = {}){
  if(info.count === undefined){ info.count = 1; }
  if(info.direction === undefined){ info.direction = [0, 0, -1]; } // z軸下方を想定
  if(info.diffuseColor === undefined){ info.diffuseColor = [1, 1, 1]; } // 白一色。
  if(info.specularColor === undefined){ info.specularColor = [1, 1, 1]; } // 白。
  // 2以上の場合は配列で長さを増やせばいい。
  node.setUniform("uDirectionalLightCount", info.count);
  node.setUniform("uLightingDirection", info.direction);
  node.setUniform("uDirectionalDiffuseColor", info.diffuseColor);
  node.setUniform("uDirectionalSpecularColor", info.specularColor);
}

// 点光源
function setPointLight(node, info = {}){
  if(info.count === undefined){ info.count = 1; }
  if(info.location === undefined){ info.location = [0, 0, 0]; } // デフォは中心で
  if(info.diffuseColor === undefined){ info.diffuseColor = [1, 1, 1]; } // 白一色。
  if(info.specularColor === undefined){ info.specularColor = [1, 1, 1]; } // 白。
  // 2以上の場合は配列で長さを増やせばいい。
  node.setUniform("uPointLightCount", info.count);
  node.setUniform("uPointLightLocation", info.location);
  node.setUniform("uPointLightDiffuseColor", info.diffuseColor);
  node.setUniform("uPointLightSpecularColor", info.specularColor);
}

// お待ちかねのスポットライト
// count, location, direction, 拡散色と反射色の他に範囲角度とconcentrationを決めないといけないのです
// 大変
// なんかひらひら飛ばして可視化でもしないとはっきり言ってpointLightと区別つかないです
// 影において基本となるLightなので真面目に取り組みましょう
function setSpotLight(node, info = {}){
  if(info.count === undefined){ info.count = 1; }
  if(info.location === undefined){ info.location = [0, 0, 4]; } // z軸上方向を想定
  if(info.direction === undefined){ info.direction = [0, 0, -1]; } // z軸下方へ
  if(info.angle === undefined){ info.angle = [Math.PI/4]; } // 90°が一般的かなぁ（分かんないけど）
  if(info.conc === undefined){ info.conc = [100]; } // デフォ、p5jsだと100なんだって...
  if(info.diffuseColor === undefined){ info.diffuseColor = [1, 1, 1]; } // 白一色。
  if(info.specularColor === undefined){ info.specularColor = [1, 1, 1]; } // 白。
  // 2以上の場合は配列で長さを増やせばいい。
  node.setUniform("uSpotLightCount", info.count);
  node.setUniform("uSpotLightLocation", info.location);
  node.setUniform("uSpotLightDirection", info.direction);
  node.setUniform("uSpotLightAngle", info.angle);
  node.setUniform("uSpotLightConc", info.conc);
  node.setUniform("uSpotLightDiffuseColor", info.diffuseColor);
  node.setUniform("uSpotLightSpecularColor", info.specularColor);
}

// ------------------------------------------------- primitive ----------------------------- //
// under construction.

// 立方体
function getCube(size = 1, hue = 0){
  const v=[-1,-1,-1, -1,1,-1, -1,-1,1, -1,1,1, // x-minus
           -1,-1,1, -1,1,1, 1,-1,1, 1,1,1, // z-plus
           1,-1,1, 1,1,1, 1,-1,-1, 1,1,-1, // x-plus
           1,-1,-1, 1,1,-1, -1,-1,-1, -1,1,-1, // z-minus
           -1,-1,-1, -1,-1,1, 1,-1,-1, 1,-1,1, // y-minus
           -1,1,1, -1,1,-1, 1,1,1, 1,1,-1] // y-plus.
  for(let i=0; i<v.length; i++){ v[i] *= size; }
  const f = [0,2,3, 0,3,1, 4,6,7, 4,7,5, 8,10,11, 8,11,9, 12,14,15, 12,15,13, 16,18,19, 16,19,17, 20,22,23, 20,23,21];
  const n = ex.getNormals(v, f);
  const createUV = (a,b) => { return [a, b, a+0.25, b, a, b+0.25, a+0.25, b+0.25]; }
  const uv = [];
  uv.push(...createUV(0.375, 0));
  uv.push(...createUV(0.375, 0.25));
  uv.push(...createUV(0.375, 0.5));
  uv.push(...createUV(0.375, 0.75));
  uv.push(...createUV(0.125, 0.25));
  uv.push(...createUV(0.625, 0.25));
  const vc = [];
  for(let i=0; i<24; i++){
    const x = v[3*i];
    const y = v[3*i+1];
    const z = v[3*i+2];
    const col = ex.hsv2rgb(hue, 0.4*(z+1), 1);
    vc.push(col.r, col.g, col.b);
  }
  return {v:v, f:f, n:n, uv:uv, vc:vc};
}

// z軸に平行な平面
function getPlane(left=-1, right=1, bottom=-1, top=1, height=0){
  const p0 = [left, bottom, height];
  const p1 = [right, bottom, height];
  const p2 = [left, top, height];
  const p3 = [right, top, height];
  const v = [p0, p1, p2, p3].flat();
  const f = [0, 1, 2, 2, 1, 3];
  const n = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  const uv = [0, 1, 1, 1, 0, 0, 1, 0];
  const vc = [1,1,1, 1,1,1, 1,1,1, 1,1,1]; // 真っ白
  return {v:v, f:f, n:n, uv:uv, vc:vc};
}

// メッシュ結合関数。
function registCompositeMeshes(node, meshes, name = "scene"){
  const positions = [];
  const normals = [];
  const faces = [];
  const vertexColors = [];
  const uvs = [];
  const ids = [];
  let offset = 0;
  for(let i=0; i<meshes.length; i++){
    const mesh = meshes[i];
    const size = mesh.v.length/3;
    positions.push(...mesh.v);
    normals.push(...mesh.n);
    vertexColors.push(...mesh.vc);
    uvs.push(...mesh.uv);
    for(let k=0, N=mesh.f.length; k<N; k++){
      faces.push(offset + mesh.f[k]);
    }
    offset += size;
    for(let k=0; k<size; k++){ ids.push(i); } // 識別子
  }
  node.registFigure(name, [
    {name:"aPosition", size:3, data:positions},
    {name:"aNormal", size:3, data:normals},
    {name:"aVertexColor", size:3, data:vertexColors},
    {name:"aTexCoord", size:2, data:uvs},
    {name:"aIndex", size:1, data:ids}
  ]);
  node.registIBO(name + "IBO", {data:faces, large:true}); // 一応。
}

// -------------------------- main ------------------------------- //
// テンプレートなので手順を考えようね
function setup(){
  // timer.
  _timer.initialize("slot0");

  // setup.
  createCanvas(800, 600, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // camera.
  cam0 = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[16, 8, 8], pers:{near:0.1, far:4}});

  // shaders.
  _node.registPainter("color", colorVert, colorFrag);
  _node.registPainter("defer", deferVert, deferFrag);
  _node.registPainter("data", dataVert, dataFrag);

  // defer用とdata用のfbは標準装備。
  const {w, h} = _node.getDrawingBufferSize(null);
  _node.registFBO("defer", {w:w, h:h, color:{info:[{}, {type:"float"}, {type:"float"}]}});
  _node.registFBO("base", {w:w, h:h, color:{info:{}}});
  _node.registFBO("data", {w:4, h:1024, color:{info:{type:"float"}}});

  // meshes.
  registMeshes();

  // culling.
  _node.enable("cull_face");

  registInfoBoardTexture();
  registFloorTexture();
}

// --------- draw --------- //
function draw(){
  moveCamera(cam0); // カメラ動かそう

  createModelMatrix(); // モデル行列を構築

  prepareDrawData(); // deferに各種情報を格納

  drawBase(); // 板ポリ芸としてメイン描画

  render();

  _node.flush();
}

// -------------------------- preparation ------------------------------- //
function registMeshes(){
  const meshes = [];
  meshes.push(getPlane(-10, 10, -10, 10, 0));
  for(let i=0; i<1023; i++){
    meshes.push(getCube(0.1+0.1*Math.random(), 0.5+0.1*Math.random()));
  }
  registCompositeMeshes(_node, meshes, "scene");
}

function registInfoBoardTexture(){
  const info = createGraphics(width, height);
  info.textAlign(LEFT, TOP);
  info.textSize(16);
  info.fill(255);
  info.noStroke();
  _node.registTexture("info", {src:info});
}

function registFloorTexture(){
  _node.registTexture("checkerBoard", {src:(function(){
    const gr = createGraphics(256, 256);
    gr.noStroke();
    for(let x=0; x<16; x++){
      for(let y=0; y<16; y++){
        gr.fill(255*((x+y)%2));
        gr.rect(16*x,16*y,16,16);
      }
    }
    return gr;
  })()});
}

// ------------------------------------- config -------------------------------- //
function moveCamera(cam){
  if(keyIsDown(RIGHT_ARROW)){ cam.spin(0.03); }
  if(keyIsDown(LEFT_ARROW)){ cam.spin(-0.03); }
  if(keyIsDown(UP_ARROW)){ cam.arise(0.04); } // 上
  if(keyIsDown(DOWN_ARROW)){ cam.arise(-0.04); } // 下
  if(keyIsDown(69)){ cam.dolly(0.05); } // Eキー
  if(keyIsDown(68)){ cam.dolly(-0.05); } // Dキー
}

// ------------------------- drawing --------------------------- //

function createModelMatrix(){
  _node.bindFBO("data").clearColor(0,0,0,0).clear();
  _node.use("data", "foxBoard")
       .setUniform("uTime", _timer.getDelta("slot0"))
       .setUniform("uHeight", 6.0);
  _node.drawArrays("triangle_strip").unbind();
}

function prepareDrawData(){
  // 透明部分の色ってここで決まるんだ、それはそうか。だよね...
  // だからここは透明でクリアしておいて...ってやる。
  _node.bindFBO("defer").clearColor(0,0,0,0).clear();

  _node.use("color", "scene")
       .setUniform("uViewMatrix", cam0.getViewMat().m)
       .setUniform("uProjMatrix", cam0.getProjMat().m)
       .setFBOtexture2D("uData", "data") // これがmodelMatrixの代わり
       .setUniform("uDataNum", 1024)
       .setTexture2D("uTex", "checkerBoard").setUniform("uTint", [1, 1, 1]) // 床用
       .bindIBO("sceneIBO")
       .drawElements("triangles");

  _node.unbind();
}

function updateInfo(){
  const info = _node.getTextureSource("info");
  info.clear();
  info.text(frameRate().toFixed(3), 5, 5);
  _node.updateTexture("info");
}

function drawBase(){
  // クリア
  _node.bindFBO("base").clearColor(0,0,0,0).clear();
  _node.use("defer", "foxBoard");

  // 環境光
  setLight(_node, {useSpecular:true});

  // 平行光
  const {center:c0, eye:e0} = cam0.getViewData();
  setDirectionalLight(_node, {
    count:1,
    direction:[c0.x-e0.x, c0.y-e0.y, c0.z-e0.z],
    diffuseColor:[1, 1, 1],
    specularColor:[0.5,1,1]
  });

  // 行列もvしか使わないよ
  _node.setUniform("uViewMatrix", cam0.getViewMat().m);

  // 各種textureをsetする
  _node.setFBOtexture2D("uMaterialColor", "defer", "color", 0)
       .setFBOtexture2D("uViewPosition", "defer", "color", 1)
       .setFBOtexture2D("uNormal", "defer", "color", 2);

  _node.drawArrays("triangle_strip");
  _node.unbind();
}

function render(){
  // ポスエフかけるならここ
  _node.bindFBO(null).clearColor(0,0,0,0).clear();
  updateInfo(); // info関連
  ex.copyPainter(_node, {src:{name:"info", gradationFlag:1, gradationStart:[0.5, 0, 0, 0, 0, 1], gradationStop:[0.5,1,0.8,0.4,0.2,1]}});
  ex.copyPainter(_node, {src:{type:"fb", name:"base"}});
}
