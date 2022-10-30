// torus6.js
// bunny6.jsの前段階。ライト増やしたいのでドローコール減らす。

// 第一段階突破。modelMatrixの構築は合ってるみたいです。

// --------------------------------------------- global ----------------------------------------------- //
const ex = p5wgex;
let _node;
const _timer = new ex.Timer();
let cam0, cam1;
let _tf = new ex.TransformEx();

// ----------------------------------------------- light ------------------------------------------------ //
const colorVert =
`#version 300 es
in vec3 aPosition;
in vec3 aVertexColor;
in vec3 aNormal;
in vec2 aTexCoord;
in float aIndex;

uniform sampler2D uData; // これ。
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
    modelMatrix[i] = texture(uData, vec2((float(i) + 0.5) / 4.0, (aIndex + 0.5) / 7.0)); // たぶんこれでいける。
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
  int colorFlag = 0; // とりあえず頂点色
  if(vIndex == 0.0){ colorFlag = 2; } // 床だけtexture.

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

// 影作成
// 1. calcDepth. cam1のMVPでNDCを計算 → fsに渡す → depth(0~1)を計算して格納
const calcDepthVert =
`#version 300 es
in vec3 aPosition;
uniform mat4 uModelViewProjMatrix;
out vec4 vNDC;
void main(){
  vec4 NDC = uModelViewProjMatrix * vec4(aPosition, 1.0);
  gl_Position = NDC; // 送る前にwで割らないこと。
  vNDC = NDC;
}
`;

const calcDepthFrag =
`#version 300 es
precision highp float;
in vec4 vNDC;
const float bias = 0.001; // 微妙に遠ざからせて判定を助ける
out float depth;
void main(){
  depth = 0.5 * (vNDC.z / vNDC.w) + 0.5 + bias; // え、*が+に??
}
`;

// 2. generateDepthMask. さっきのdepthと計算値を比べてより大きいなら係数を格納

// MVP2種類の方が合理的...だけどいろいろめんどくさいのでmとvpにわけるわ。
const maskVert =
`#version 300 es
in vec3 aPosition;
uniform mat4 uModelMatrix;
uniform mat4 uViewProjMatrix;
uniform mat4 uLightVPMatrix;
out vec4 vNDC;
void main(){
  vec4 modelPosition = uModelMatrix * vec4(aPosition, 1.0);
  gl_Position = uViewProjMatrix * modelPosition;
  // NDCはそのまま送る。cam1のVPで計算する。
  vNDC = uLightVPMatrix * modelPosition;
}
`;

// 1を付けて区別しないとエラーになる
const maskFrag =
`#version 300 es
precision highp float;
uniform sampler2D uDepthMap; // あー、改名しないと。
in vec4 vNDC;
out float mask;
void main(){
  vec3 ndc = vNDC.xyz / vNDC.w;
  ndc = 0.5*(ndc + 1.0);
  float localDepth = ndc.z;
  float correctDepth = texture(uDepthMap, ndc.xy).r;
  if(localDepth < correctDepth){
    mask = 1.0;
  }else{
    mask = 0.75;
  }
}
`;

// 3. 乗算影計算のクライマックス
const shadowVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = 0.5 + 0.5 * aPosition;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// これを出力する
const shadowFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBase;
uniform sampler2D uShadow1;
uniform sampler2D uShadow2;
out vec4 fragColor;
void main(){
  vec4 color = texture(uBase, vUv);
  if(color.a < 0.001){ discard; }
  float shadow = texture(uShadow1, vUv).r * texture(uShadow2, vUv).r;
  fragColor = color * vec4(vec3(shadow), 1.0); // おわり。
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

// 4x7です。4x1それぞれ、縦方向に並びます。
const dataFrag =
`#version 300 es
precision highp float;
out vec4 data;
void main(){
  vec2 p = gl_FragCoord.xy;
  p = floor(p);
  vec4 result;
  float r = (p.y == 0.0 ? 0.0 : 4.0);
  float t = (p.y == 0.0 ? 0.0 : 6.28318*p.y / 6.0); // とりあえず0番動かさないで1～6を放射状に並べる
  if(p.x == 0.0){ result = vec4(1.0, 0.0, 0.0, 0.0); }
  if(p.x == 1.0){ result = vec4(0.0, 1.0, 0.0, 0.0); }
  if(p.x == 2.0){ result = vec4(0.0, 0.0, 1.0, 0.0); }
  if(p.x == 3.0){ result = vec4(r*cos(t), r*sin(t), r*0.25, 1.0); }
  data = result;
}
`;

// ------------------------------------------------------ mesh ---------------------------------------------------------------- //
// 数増やそう。

function getTorus(a = 1.0, b = 0.4, ds = 32, dt = 32, colorHue = 0){
  // 今回はトーラスで。紙の上で計算してるけどロジックは難しくないのよ。
  // a:長半径、b:短半径、ds:断面ディテール、dt:外周ディテール
  // colorIndexでカラフルに。
  const torusPositions = new Array(3*(ds+1)*(dt+1));
  const torusNormals = new Array(3*(ds+1)*(dt+1));
  const torusColors = new Array(3*(ds+1)*(dt+1));
  const torusUVs = new Array(2*(ds+1)*(dt+1));
  const torusFaces = new Array(6*ds*dt);
  const dTheta = Math.PI*2/ds;
  const dPhi = Math.PI*2/dt;
  // イメージ的にはkがx軸でlがy軸で原点左下の座標系を考えている
  // この原点はx軸aでz軸bの点で、そこから右と上にxとyをそれぞれ伸ばす感じ。
  for(let l=0; l<=dt; l++){
    for(let k=0; k<=ds; k++){
      const index = (dt+1)*l + k;
      const px = Math.cos(dPhi*l);
      const py = Math.sin(dPhi*l);
      const nx = Math.sin(dTheta*k)*px;
      const ny = Math.sin(dTheta*k)*py;
      const nz = Math.cos(dTheta*k);
      const x = a*px + b*nx;
      const y = a*py + b*ny;
      const z = b*nz;
      torusPositions[3*index] = x;
      torusPositions[3*index+1] = y;
      torusPositions[3*index+2] = z;
      torusNormals[3*index] = nx;
      torusNormals[3*index+1] = ny;
      torusNormals[3*index+2] = nz;
      const col = ex.hsv2rgb(colorHue, 0.7, 1);
      torusColors[3*index] = col.r;
      torusColors[3*index+1] = col.g;
      torusColors[3*index+2] = col.b;
      torusUVs[2*index] = (k+1)/ds;
      torusUVs[2*index+1] = (l+1)/dt;
    }
  }
  // kとlに着目すると分かりやすいかもしれない。
  for(let l=0; l<dt; l++){
    for(let k=0; k<ds; k++){
      const index = dt*l + k;
      torusFaces[6*index] = l*(ds+1) + k;
      torusFaces[6*index+1] = l*(ds+1) + k+1;
      torusFaces[6*index+2] = (l+1)*(ds+1) + k+1;
      torusFaces[6*index+3] = l*(ds+1) + k;
      torusFaces[6*index+4] = (l+1)*(ds+1) + k+1;
      torusFaces[6*index+5] = (l+1)*(ds+1) + k;
    }
  }
  return {v:torusPositions, n:torusNormals, vc:torusColors, uv:torusUVs, f:torusFaces};
}

// 雑。z軸に平行な平面。
function getPlane(left=-1, right=1, bottom=-1, top=1, height=0){
  const p0 = [left, bottom, height];
  const p1 = [right, bottom, height];
  const p2 = [left, top, height];
  const p3 = [right, top, height];
  const positions = [p0, p1, p2, p3].flat();
  const uvs = [0, 1, 1, 1, 0, 0, 1, 0];
  const faces = [0, 1, 2, 2, 1, 3];
  const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  const colors = [1,1,1, 1,1,1, 1,1,1, 1,1,1]; // 真っ白
  return {v:positions, n:normals, vc:colors, uv:uvs, f:faces};
}

function registCompositeMeshes(node, meshs, name = "scene"){
  const positions = [];
  const normals = [];
  const faces = [];
  const vertexColors = [];
  const uvs = [];
  const ids = [];
  let offset = 0;
  for(let i=0; i<meshs.length; i++){
    const mesh = meshs[i];
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

// -------------------------- mvp ------------------------------- //

function setMatrix(node, cam, flagString = ""){
  const viewMat = cam.getViewMat().m;
  const projMat = cam.getProjMat().m;
  const flags = flagString.split("_");
  for(const flag of flags){
    if(flag === "v"){ node.setUniform("uViewMatrix", viewMat); }
    if(flag === "p"){ node.setUniform("uProjMatrix", projMat); }
    if(flag === "vp"){ node.setUniform("uViewProjMatrix", ex.getMult4x4(viewMat, projMat)); }
  }
}

// 色とかは切り離すべきよね。関係ないし。
function paint(node, r, g, b){
  node.setUniform("uUseColorFlag", 1).setUniform("uMonoColor", [r, g, b]);
}

function renderTorus(node, tf, cam, flagString = ""){
  const currentTime = _timer.getDelta("slot0");
  tf.initialize()
  .translate(3*cos(currentTime * Math.PI*2 * 0.4), 3*sin(currentTime * Math.PI*2 * 0.3), 2)
  .rotateX(Math.PI*currentTime * 0.5)
  .rotateY(Math.PI*currentTime * 0.33);
  setMatrix(node, tf, cam, flagString);
  node.drawFigure("torus").bindIBO("torusIBO").drawElements("triangles");
}

function renderPlane(node, tf, cam, flagString = ""){
  tf.initialize()
    .translate(0, 0, 0)
    .scale(4, 4, 1);
  setMatrix(node, tf, cam, flagString);
  node.drawFigure("plane").bindIBO("planeIBO").drawElements("triangles");
}

// -------------------------- main ------------------------------- //

// トーラスの位置はfbで決めるので、...あとでいいか。
function setup(){
  _timer.initialize("slot0");
  createCanvas(800, 600, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // 撮影用カメラ
  cam0 = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[8, 0, 6], pers:{near:0.1, far:4}});
  // 平行光を表現するカメラ
  cam1 = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[2, 2, 6]});
  cam1.setOrtho({left:-8, right:8, bottom:-6, top:6, near:0.1, far:2});
  cam2 = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[-2, -2, 6]});
  cam2.setOrtho({left:-8, right:8, bottom:-6, top:6, near:0.1, far:2});

  _node.registPainter("data", dataVert, dataFrag); // データ登録用shader.
  _node.registFBO("data", {w:4, h:7, color:{info:{type:"float"}}}); // 小さなものですがこれでもmodelMatrixの代用品です
  _node.registPainter("color", colorVert, colorFrag);
  _node.registPainter("defer", deferVert, deferFrag);
  // 影用のシェーダは後で
  _node.registPainter("calcDepth", calcDepthVert, calcDepthFrag); // cam1から見た深度値を記録
  _node.registPainter("generateDepthMask", maskVert, maskFrag); // cam1から見た深度値と比較して係数を計算
  _node.registPainter("applyShadow", shadowVert, shadowFrag); // 係数を加味して描画

  const meshes = [];
  meshes.push(getPlane(-6, 6, -6, 6, 0));
  for(let i=0; i<6; i++){ meshes.push(getTorus(1, 0.4, 24, 24, 0.16*i)); }
  registCompositeMeshes(_node, meshes, "scene"); // いわゆる「シーン」

  const {w, h} = _node.getDrawingBufferSize(null);
  // defer用のMRT.
  _node.registFBO("defer", {w:w, h:h, color:{info:[{}, {type:"float"}, {type:"float"}]}});
  // 結果格納用
  _node.registFBO("base", {w:w, h:h, color:{info:{}}});
  // そして影...float32の単独。
  _node.registDoubleFBO("shadow1", {w:w, h:h, color:{info:{type:"float", internalFormat:"r32f", format:"red", magFilter:"nearest"}}});
  _node.registDoubleFBO("shadow2", {w:w, h:h, color:{info:{type:"float", internalFormat:"r32f", format:"red", magFilter:"nearest"}}});

  // カリング
  _node.enable("cull_face");

  // info.
  _node.registTexture("info", {src:(function(){
    const gr = createGraphics(width, height);
    gr.fill(255);
    gr.textSize(16);
    gr.textAlign(LEFT, TOP);
    return gr;
  })()});

  // checkerBoard.
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

function draw(){
  configCamera();
  createModelMatrix(); // ここで作っちゃえ

  _node.bindFBO(null).clearColor(0,0,0,1).clear();

  // とりあえずdefer.
  _node.bindFBO("defer").clearColor(0,0,0,0).clear();

  // 色などの情報を格納する。
  _node.usePainter("color");

  // sceneをdrawFigureして、vとpを入れて、dataをsetTextureするだけ。
  // あとはbindIBO.draw.
  _node.drawFigure("scene")
       .setUniform("uViewMatrix", cam0.getViewMat().m)
       .setUniform("uProjMatrix", cam0.getProjMat().m)
       .setFBOtexture2D("uData", "data") // これがmodelMatrixの代わり
       .setTexture2D("uTex", "checkerBoard").setUniform("uTint", [1, 1, 1])
       .bindIBO("sceneIBO")
       .drawElements("triangles");

  _node.unbind();

  // 次に
  _node.bindFBO("base").clearColor(0,0,0,1).clear();

  // deferをやる（板ポリ芸）
  _node.use("defer", "foxBoard");

  // 今回はライティングは平行光のみ
  // 環境光
  setLight(_node, {useSpecular:true});

  // 平行光
  const {eye:e1, center:c1} = cam1.getViewData();
  const {eye:e2, center:c2} = cam2.getViewData();
  setDirectionalLight(_node, {
    count:2,
    direction:[c1.x-e1.x, c1.y-e1.y, c1.z-e1.z, c2.x-e2.x, c2.y-e2.y, c2.z-e2.z], // eyeからcenterへ。
    diffuseColor:[1, 1, 1, 1, 1, 1],
    specularColor:[0.5,1,1, 1, 1, 0.5]
  });

  // 行列もvしか使わないよ
  //setMatrix(_node, _tf, cam0, "v");
  _node.setUniform("uViewMatrix", cam0.getViewMat().m);

  // 各種textureをsetする
  _node.setFBOtexture2D("uMaterialColor", "defer", "color", 0)
       .setFBOtexture2D("uViewPosition", "defer", "color", 1)
       .setFBOtexture2D("uNormal", "defer", "color", 2);

  _node.drawArrays("triangle_strip");
  _node.unbind();

  ex.copyPainter(_node, {src:{type:"fb", name:"base"}}); // とりあえずここまで
  // さてと。
  /*

  createShadowMap("shadow1", cam0, cam1);
  createShadowMap("shadow2", cam0, cam2);

  //ex.copyPainter(_node, {src:{type:"fb", name:"shadow"}});

  // 仕上げ。colorに落とした方がいいんかな
  updateInfo();
  showInfo();
  _node.bindFBO(null);
  _node.use("applyShadow", "foxBoard");
  _node.setFBOtexture2D("uBase", "base");
  _node.setFBOtexture2D("uShadow1", "shadow1");
  _node.setFBOtexture2D("uShadow2", "shadow2");
  _node.drawArrays("triangle_strip")
  _node.unbind();
  */

  _node.flush();
}

function configCamera(){
  cam0.spin(0.01);
  cam1.spin(0.01);
  cam2.spin(-0.01);
  const {eye} = cam0.getViewData();
	if(keyIsDown(UP_ARROW)){ cam0.arise(0.01); }
	else if(keyIsDown(DOWN_ARROW) && eye.z > 0.5){ cam0.arise(-0.01); }
}

function createModelMatrix(){
  _node.bindFBO("data").clearColor(0,0,0,0).clear();
  _node.use("data", "foxBoard");
  // setUniform. いずれね。
  _node.drawArrays("triangle_strip").unbind();
}

function createShadowMap(shadowFBOName, modelCam, lightCam){
  // まずcam1からの深度値が欲しい。
  _node.bindFBO(shadowFBOName).clearColor(0,0,0,0).clear();
  _node.usePainter("calcDepth");

  // 深度値を書き込む（ちょっと大きくする）
  renderTorus(_node, _tf, lightCam, "mvp");
  renderPlane(_node, _tf, lightCam, "mvp");
  _node.swapFBO(shadowFBOName).unbind();

  //ex.copyPainter(_node, {src:{type:"fb", name:"shadow"}});

  // 次に比較を行なう。ただしさっきの...を使う。
  _node.bindFBO(shadowFBOName);
  _node.clearColor(0,0,0,0).clear();
  _node.usePainter("generateDepthMask");
  _node.setFBOtexture2D("uDepthMap", shadowFBOName); // さっきの結果をここで読み込んで

  // 2つのmvpを入れて比較する。先にcam1のvpをlightという形で入れとく。
  const viewMat1 = lightCam.getViewMat().m;
  const projMat1 = lightCam.getProjMat().m;
  _node.setUniform("uLightVPMatrix", ex.getMult4x4(viewMat1, projMat1));

  // 比較用にレンダリング（比べるだけ）
  renderTorus(_node, _tf, modelCam, "m_vp");
  renderPlane(_node, _tf, modelCam, "m_vp");
  _node.swapFBO(shadowFBOName).unbind();
}

function updateInfo(){
  const gr = _node.getTextureSource("info");
  gr.clear();
  gr.text(frameRate().toFixed(2), 5, 5);
  _node.updateTexture("info");
}

function showInfo(){
  ex.copyPainter(_node, {src:{name:"info", gradationFlag:1, gradationStart:[0.5, 0, 0, 0, 0, 1], gradationStop:[0.5, 1, 0, 0, 1, 1]}});
}
