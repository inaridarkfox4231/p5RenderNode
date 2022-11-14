// 何でもいいよ。何でも。昔のコードの焼き直しでも。いいし。
// あー、真上からのスポットでウサギやってみるかぁ、それくらいなら...
// planeとrabbit1匹、真上からスポットライト、側面から平行光、あ、spotLight消してしまった...復元しないと。
// まあでもすぐに戻せるけど...

// ちょっと軽くなりました。
// このsceneっていうのは
// まあでも個別に扱うのは難しそうです。
// GPGPUで動かすこともできるのでいろんなやり方があるということで
// あれもmodel変換を作ったり、んー。3Dだと難しいのよね...ていうか法線とか計算しないとだし。難しいよ。

// --------------------------------------------- global ----------------------------------------------- //
const ex = p5wgex;
let _node;
const _timer = new ex.Timer();
let cam0, cam1, cam2;
let _tf = new ex.TransformEx();

let rabbit; // まだ未実装なので雰囲気だけ...

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
uniform mat4 uLightVPMatrix1;
uniform mat4 uLightVPMatrix2;

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vTexCoord;
out float vIndex;

out vec4 vNDC;
out vec4 vNDClight1;
out vec4 vNDClight2;

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

  // lightサイドのNDCを格納して送信
  vec4 globalPos = modelMatrix * vec4(aPosition, 1.0);
  vNDClight1 = uLightVPMatrix1 * globalPos;
  vNDClight2 = uLightVPMatrix2 * globalPos;
}
`;

const colorFrag =
`#version 300 es
precision highp float;

// -------------------- マテリアル関連 -------------------- //

// 描画フラグ各種
const int USE_VERTEX_COLOR = 0;
const int USE_MONO_COLOR = 1;
const int USE_UV_COLOR = 2; // そのうち。

//uniform int uUseColorFlag; // 0:vertex. 1:mono. 2:UV
uniform vec3 uMonoColor; // monoColorの場合
uniform sampler2D uTex; // uvColorの場合
uniform vec3 uTint; // texture関連でtextureに色を付与したい場合のためのオプション。掛けるだけ。

uniform sampler2D uDepthMap1; // 深度比較用
uniform sampler2D uDepthMap2;

in vec3 vVertexColor;
in vec3 vNormal;
in vec3 vViewPosition;
in vec2 vTexCoord; // テクスチャ
in float vIndex;

in vec4 vNDC;
in vec4 vNDClight1; // 深度比較用
in vec4 vNDClight2;

// -------------------- 深度マスク適用 ----------------- //
float depthMask(vec4 ndcLight, sampler2D depthMap){
  vec3 ndc = ndcLight.xyz / ndcLight.w;
  ndc = 0.5*(ndc + 1.0);
  float localDepth = ndc.z;
  float correctDepth = texture(depthMap, ndc.xy).r;
  if(ndc.x < 0.0 || ndc.x > 1.0 || ndc.y < 0.0 || ndc.y > 1.0){ return 1.0; } // 画面外
  if(localDepth < correctDepth){ return 1.0; }
  return 0.5;
}

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

  // 深度比較計算
  float mask = 1.0;
  mask *= depthMask(vNDClight1, uDepthMap1);
  mask *= depthMask(vNDClight2, uDepthMap2);
  viewPosition = vec4(vViewPosition, mask); // maskでも入れておこう

  normal = vec4(vNormal, depth);
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
  vec4 viewData = texture(uViewPosition, vUv);
  vec3 viewPosition = viewData.xyz;
  float depthMask = viewData.w;
  vec4 color = texture(uMaterialColor, vUv);

  vec3 result = totalLight(viewPosition, normal, color.rgb);

  // ディファードの場合、この計算前のcol(rgba)と、normal, vViewPosition, 場合によってはvTexCoordが
  // MRTで送られる対象になる。もしくはついでにデプスなど。doxasさんのサイトではこれらが可視化されていましたね。

  color.rgb = result * depthMask; // これでいける？
  finalColor = color;
}
`;

// 影作成
// 1. calcDepth. cam1のMVPでNDCを計算 → fsに渡す → depth(0~1)を計算して格納
const calcDepthVert =
`#version 300 es
in vec3 aPosition;
in float aIndex;
uniform sampler2D uData;
uniform mat4 uViewProjMatrix;
out vec4 vNDC;
void main(){
  mat4 modelMatrix;
  for(int i=0; i<4; i++){
    modelMatrix[i] = texture(uData, vec2((float(i) + 0.5) / 4.0, (aIndex + 0.5) / 7.0)); // たぶんこれでいける。
  }
  vec4 globalPos = modelMatrix * vec4(aPosition, 1.0);
  vec4 NDC = uViewProjMatrix * globalPos;
  gl_Position = NDC; // 送る前にwで割らないこと。
  vNDC = NDC;
}
`;

const calcDepthFrag =
`#version 300 es
precision highp float;
in vec4 vNDC;
const float bias = 0.01; // 微妙に遠ざからせて判定を助ける
out float depth;
void main(){
  depth = 0.5 * (vNDC.z / vNDC.w) + 0.5 + bias; // え、*が+に??
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
uniform float uTime;
uniform float uRadius;
uniform float uHeight;
out vec4 data;
const float PI = 3.14159;
void main(){
  vec2 p = gl_FragCoord.xy;
  p = floor(p);
  vec4 result;
  float index = p.y;
  float theta = PI*uTime*2.0;
  float phi = PI*index + (PI/3.0)*uTime;
  float c = cos(theta+phi);
  float s = sin(theta+phi);
  float t = fract(uTime);
  float z = 1.0 + 4.0*uHeight*t*(1.0-t);
  float r = uRadius * (0.8 + 0.2 * sin(PI*uTime*0.5));
  if(index > 0.0){
    if(p.x == 0.0){ result = vec4(c, s, 0.0, 0.0); }
    if(p.x == 1.0){ result = vec4(-s, c, 0.0, 0.0); }
    if(p.x == 2.0){ result = vec4(0.0, 0.0, 1.0, 0.0); }
    if(p.x == 3.0){ result = vec4(r*cos(phi), r*sin(phi), z, 1.0); }
  }else{
    if(p.x == 0.0){ result = vec4(1.0, 0.0, 0.0, 0.0); }
    if(p.x == 1.0){ result = vec4(0.0, 1.0, 0.0, 0.0); }
    if(p.x == 2.0){ result = vec4(0.0, 0.0, 1.0, 0.0); }
    if(p.x == 3.0){ result = vec4(0.0, 0.0, 0.0, 1.0); }
  }
  data = result;
}
`;

// ------------------------------------------------------ mesh ---------------------------------------------------------------- //
// 数増やそう。

function getRabbit(size, colorHue){
  // rabbitModelからデータを取得したりする
  // verticesはベクトル3Dが入っててx,y,z成分を抜き出さないと無理
  // facesも各番号に長さ3の配列がもちろん入ってる
  // uvsは何にも入ってないけど内容的には[0,0]が延々と並んでる
  // vertexNormalsが法線でvertexColorsが色。
  // normalsは色々入ってるみたい。vertexColorsは死んでる。長さ0. 好きに使わせてもらおう。
  const N = rabbit.vertices.length; // 4564.
  const F = rabbit.faces.length;
  const positions = new Array(N*3);
  const normals = new Array(N*3);
  const colors = new Array(N*3);
  const uvs = new Array(N*2);
  const faces = new Array(F*3);
  // 続きは...
  for(let i=0; i<N; i++){
    const v = rabbit.vertices[i];
    positions[3*i] = v.x * size;
    positions[3*i+1] = v.y * size;
    positions[3*i+2] = v.z * size;
    const n = rabbit.vertexNormals[i];
    normals[3*i] = n.x;
    normals[3*i+1] = n.y;
    normals[3*i+2] = n.z;
    const col = ex.hsv2rgb(colorHue, 0.7, 1);
    colors[3*i] = col.r;
    colors[3*i+1] = col.g;
    colors[3*i+2] = col.b;
    uvs[2*i] = 0;
    uvs[2*i+1] = 0;
  }
  for(let i=0; i<F; i++){
    const f = rabbit.faces[i];
    faces[3*i] = f[0];
    faces[3*i+1] = f[1];
    faces[3*i+2] = f[2];
  }
  return {v:positions, n:normals, vc:colors, uv:uvs, f:faces};
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

// -------------------------- main ------------------------------- //

function preload(){
  rabbit = loadModel("https://inaridarkfox4231.github.io/models/bunnyYZ.obj");
}

// トーラスの位置はfbで決めるので、...あとでいいか。
function setup(){
  _timer.initialize("slot0");    // モーション用
  _timer.initialize("moveCam");  // カメラ用
  createCanvas(800, 600, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  //frameRate(30); // 妥協。それでもモーションが時間制御なのでレート落ちてもそれなりの見た目にはなります。ああ、時間制御で書いてきて良かった。

  // 撮影用カメラ
  cam0 = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[12, 0, 9], pers:{near:0.1, far:4}});
  // 平行光を表現するカメラ
  cam1 = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[4, 4, 12]});
  //cam1.setOrtho({left:-16, right:16, bottom:-12, top:12, near:0.1, far:2});
  cam2 = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[-4, -4, 12]});
  //cam2.setOrtho({left:-16, right:16, bottom:-12, top:12, near:0.1, far:2});

  _node.registPainter("data", dataVert, dataFrag); // データ登録用shader.
  _node.registFBO("data", {w:4, h:7, color:{info:{type:"float"}}}); // 小さなものですがこれでもmodelMatrixの代用品です
  _node.registPainter("color", colorVert, colorFrag);
  _node.registPainter("defer", deferVert, deferFrag);
  // 影用のシェーダは後で
  _node.registPainter("calcDepth", calcDepthVert, calcDepthFrag); // cam1から見た深度値を記録

  const meshes = [];
  meshes.push(getPlane(-6, 6, -6, 6, 0));
  meshes.push(getRabbit(3, 0.55));
  meshes.push(getRabbit(3, 0.65));
  //for(let i=0; i<6; i++){ meshes.push(getTorus(1, 0.4, 24, 24, 0.16*i)); }
  registCompositeMeshes(_node, meshes, "scene"); // いわゆる「シーン」

  const {w, h} = _node.getDrawingBufferSize(null);
  // defer用のMRT.
  _node.registFBO("defer", {w:w, h:h, color:{info:[{}, {type:"float"}, {type:"float"}]}});
  // 結果格納用
  _node.registFBO("base", {w:w, h:h, color:{info:{}}});
  // そして影...float32の単独。doubleをやめて、代わりに先に計算する。
  _node.registFBO("shadow1", {w:w, h:h, color:{info:{type:"float", internalFormat:"r32f", format:"red", magFilter:"nearest"}}});
  _node.registFBO("shadow2", {w:w, h:h, color:{info:{type:"float", internalFormat:"r32f", format:"red", magFilter:"nearest"}}});

  // カリング（ミラーの際に反転させる？）
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
        gr.fill(64+64*((x+y)%2));
        gr.rect(16*x,16*y,16,16);
      }
    }
    return gr;
  })()});
}

function draw(){
  configCamera();
  createModelMatrix(); // ここで作っちゃえ

  //_node.bindFBO(null).clearColor(0,0,0,1).clear();

  // さきにshadow.
  createShadowMap("shadow1", cam1); // あ、引数減らしたの忘れてたわ...
  createShadowMap("shadow2", cam2);

  // とりあえずdefer.
  _node.bindFBO("defer").clearColor(0,0,0,0).clear();

  // 色などの情報を格納する。
  _node.usePainter("color");

  // defer本番前にこれをやってしまう
  const vpLight1 = ex.getMult4x4(cam1.getViewMat().m, cam1.getProjMat().m);
  const vpLight2 = ex.getMult4x4(cam2.getViewMat().m, cam2.getProjMat().m);
  _node.setUniform("uLightVPMatrix1", vpLight1)
       .setUniform("uLightVPMatrix2", vpLight2)
       .setFBOtexture2D("uDepthMap1", "shadow1")
       .setFBOtexture2D("uDepthMap2", "shadow2");

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
  _node.bindFBO("base").clear();

  // deferをやる（板ポリ芸）
  _node.use("defer", "foxBoard");

  // 今回はライティングは平行光のみ
  // 環境光
  setLight(_node, {useSpecular:true});

  // 平行光はおやすみで。

  // 照射光
  const {eye:e1, center:c1} = cam1.getViewData();
  const {eye:e2, center:c2} = cam2.getViewData();
  setSpotLight(_node, {
    count:2,
    location:[e2.x, e2.y, e2.z, e1.x, e1.y, e1.z],
    direction:[c2.x-e2.x, c2.y-e2.y, c2.z-e2.z, c1.x-e1.x, c1.y-e1.y, c1.z-e1.z],
    angle:[Math.PI/3, Math.PI/3],
    conc:[20, 20],
    diffuseColor:[0.5, 0.75, 1, 0.5, 1, 0.75],
    specularColor:[0.75, 1, 0.75, 0.5, 0.75, 1]
  });

  // 行列もvしか使わないよ
  _node.setUniform("uViewMatrix", cam0.getViewMat().m);

  // 各種textureをsetする
  _node.setFBOtexture2D("uMaterialColor", "defer", "color", 0)
       .setFBOtexture2D("uViewPosition", "defer", "color", 1)
       .setFBOtexture2D("uNormal", "defer", "color", 2);

  _node.drawArrays("triangle_strip");
  _node.unbind();

  updateInfo();
  showInfo();
  ex.copyPainter(_node, {src:{type:"fb", name:"base"}}); // とりあえずここまで

  _node.flush();
}

function configCamera(){
  // const _delta = (config.pause ? 0 : _timer.getDelta("moveCam")); // 今のところこうするしかない。
  // もしくは毎フレーム計測し続ける何らかの、別の何かが必要、それはpauseの時は0を返す、0を返すが計測は続ける、と。
  const _delta = _timer.getDelta("moveCam");
  _timer.set("moveCam");
  cam0.spin(_delta * 0.6);
  cam1.spin(_delta * 0.6);
  cam2.spin(-_delta * 0.6);
  const {eye} = cam0.getViewData();
	if(keyIsDown(UP_ARROW)){ cam0.arise(0.01); }
	else if(keyIsDown(DOWN_ARROW) && eye.z > 0.5){ cam0.arise(-0.01); }
}

function createModelMatrix(){
  _node.bindFBO("data").clearColor(0,0,0,0).clear();
  _node.use("data", "foxBoard")
       .setUniform("uTime", _timer.getDelta("slot0"))
       .setUniform("uRadius", 3.0)
       .setUniform("uHeight", 2.0);
  // setUniform. いずれね。
  _node.drawArrays("triangle_strip").unbind();
}

// lightCamだけ使う感じで
function createShadowMap(shadowFBOName, lightCam){
  //const vpModel = ex.getMult4x4(modelCam.getViewMat().m, modelCam.getProjMat().m);
  const vpLight = ex.getMult4x4(lightCam.getViewMat().m, lightCam.getProjMat().m);

  // lightCamからの深度値を記録
  _node.bindFBO(shadowFBOName).clearColor(0,0,0,0).clear();

  _node.use("calcDepth", "scene")
       .setFBOtexture2D("uData", "data")
       .setUniform("uViewProjMatrix", vpLight)
       .bindIBO("sceneIBO")
       .drawElements("triangles")
       .unbind();
  // ここまで。
}

function updateInfo(){
  const gr = _node.getTextureSource("info");
  gr.clear();
  gr.text(frameRate().toFixed(2), 5, 5);
  _node.updateTexture("info");
}

function showInfo(){
  ex.copyPainter(_node, {src:{name:"info", gradationFlag:1, gradationStart:[0.5, 0, 0, 0, 0, 1], gradationStop:[0.5, 1, 0, 0.5, 0.75, 1]}});
}
