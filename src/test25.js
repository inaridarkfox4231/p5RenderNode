// モチベ死んだ
// 仕方ないから普通にカメラ2つ用意して2画面。単色トーラス。おわり。

// 平面に影落としてみる？

// Float32のダブルフレームバッファで
// 一つ目に別のカメラの平行投影で深度値を書き込んで
// それをちょっと大きくしておく（奥に寄せる）
// 次にひっくり返してさっきのreadを読み込むんだけど
// 今度は本来のカメラで写すのだ
// そんで中でグローバル座標を射影変換して正規化デバイスの方でreadから読み込んだ深度値とその変換で得られる深度値を比べて
// 変換で出した方が小さければフラグ1を立てる、でなければ0を立てる。
// もしくは係数をそのまま出力してもいい。要するに小さければ例えばだけど0.5とかそういう係数、でなければ等倍の意味で1を立てる。
// あとは通常のレンダリング結果をフレームバッファに落としておいてそれと組み合わせてポストエフェクトの要領で係数を掛ける。
// こうすることでフォワードレンダリングのパイプラインと影計算を切り離すことができる
// ただし平行光と影計算用のカメラを同期させる必要はあるけどね

// 20221029
// 謎の出っ張りが...
// どうも正しい影と間違った影が混在してるっぽいね。なぜか？知らん。
// ortho→persにしても生じるので
// maskのところで致命的なミスをしている
// 具体的には平面上の点に対してNDCを計算する際に計算位置によってちょっとバラつきかなんかが発生してて
// それによりおかしなところの値がサンプリングされちゃってるみたいね
// 詳しくは不明...

// --------------------------------------------- global ----------------------------------------------- //
const ex = p5wgex;
let _node;
const _timer = new ex.Timer();
let cam0, cam1;
let _tf = new ex.TransformEx();

// ----------------------------------------------- light ------------------------------------------------ //
const lightVert =
`#version 300 es
in vec3 aPosition;
in vec3 aVertexColor;
in vec3 aNormal;
in vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vTexCoord;

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);

  // Pass varyings to fragment shader
  vViewPosition = viewModelPosition.xyz;
  vec4 NDcoord = uProjectionMatrix * viewModelPosition; // 正規化デバイス座標
  NDcoord /= NDcoord.w; // wで割る
  gl_Position = NDcoord;

  mat3 normalMatrix; // こうしよう。[0]で列ベクトルにアクセス。
  normalMatrix[0] = uModelViewMatrix[0].xyz;
  normalMatrix[1] = uModelViewMatrix[1].xyz;
  normalMatrix[2] = uModelViewMatrix[2].xyz;
  normalMatrix = inverse(transpose(normalMatrix)); // これでいい。

  vNormal = normalMatrix * aNormal;
  vVertexColor = aVertexColor;
  vTexCoord = aTexCoord;
}
`;

const lightFrag =
`#version 300 es
precision mediump float;

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

// -------------------- マテリアル関連 -------------------- //

// 描画フラグ各種
const int USE_VERTEX_COLOR = 0;
const int USE_MONO_COLOR = 1;
const int USE_UV_COLOR = 2; // そのうち。

uniform int uUseColorFlag; // 0:vertex. 1:mono. 2:UV
uniform vec3 uMonoColor; // monoColorの場合
uniform sampler2D uTex; // uvColorの場合
uniform vec3 uTint; // texture関連でtextureに色を付与したい場合のためのオプション。掛けるだけ。

in vec3 vVertexColor;
in vec3 vNormal;
in vec3 vViewPosition;
in vec2 vTexCoord; // テクスチャ

// -------------------- その他 -------------------- //

out vec4 finalColor; // 最終的な色

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

// -------------------- メインコード -------------------- //

void main(void){

  // 白。デフォルト。
  vec4 col = vec4(1.0);
  // マテリアルカラーの計算
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
    col.rgb *= uTint;
    if(col.a < 0.1){ discard; }
  }

  // ライティングの計算
  // diffuseの分にambient成分を足してrgbに掛けて色を出してspecular成分を足して完成
  // この中でrgb関連の処理を実行しrgbをそれで置き換える。
  vec3 result = totalLight(vViewPosition, normalize(vNormal), col.rgb);

  // ディファードの場合、この計算前のcol(rgba)と、normal, vViewPosition, 場合によってはvTexCoordが
  // MRTで送られる対象になる。もしくはついでにデプスなど。doxasさんのサイトではこれらが可視化されていましたね。

  col.rgb = result;
  finalColor = col;
}
`;

// 影関連のシェーダの仕事
// 1. 別のカメラで深度値を調べてちょっと大きくしてFloat32に格納（0～1）
// 2. 元のカメラで深度値を調べてさっきのと比べて大きかったら0～1の影係数を格納、小さかったら1を格納
// 3. こうしてできる影マスクを上記のライティングの結果に乗算。おわり。

// cam1のモデルビューと射影から深さを計算して格納
const calcDepthVert =
`#version 300 es
in vec3 aPosition;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
out float vDepth;
void main(){
  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);

  vec4 NDcoord = uProjectionMatrix * viewModelPosition; // 正規化デバイス座標
  NDcoord /= NDcoord.w; // wで割る
  gl_Position = NDcoord;

  vDepth = 0.5 + 0.5 * NDcoord.z; // 深度値
}
`;

// シャドウマッピングの記事：http://www.opengl-tutorial.org/jp/intermediate-tutorials/tutorial-16-shadow-mapping/
// にbiasって書いてあったので名前を借用した。
const calcDepthFrag =
`#version 300 es
precision highp float;
const float bias = 0.001;
in float vDepth;
out float fragDepth;
void main(){
  fragDepth = vDepth + bias; // ちょっと大きくすることで判定を助ける
}
`;

// cam0のMVP変換でラスタライズするところまでは同じ、そのあとfragでcam1のMVP変換を行い
// 読み込んだ先程のdepthMapに正規化デバイス座標でアクセスしてdepthを取得、
// 一方でMVP変換の結果も用意して両者を比較する、MVP変換の方が小さければ係数1.
// MVP変換の方が大きければ係数は0.5とか0.6にする。

// Modelまでは共通で、View以降が異なるので、Viewだけ渡す感じ。
const maskVert =
`#version 300 es
in vec3 aPosition;
uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uLightVPMatrix;
out vec3 vNDC;
void main(){
  vec4 modelPosition = uModelMatrix * vec4(aPosition, 1.0);
  //vModelPosition = modelPosition;
  vec4 viewModelPosition = uViewMatrix * modelPosition;

  vec4 NDcoord = uProjectionMatrix * viewModelPosition; // 正規化デバイス座標
  NDcoord /= NDcoord.w; // wで割る
  gl_Position = NDcoord;

  vec4 NDC = uLightVPMatrix * modelPosition;
  NDC /= NDC.w;
  vNDC = 0.5 + 0.5 * NDC.xyz;
}
`;

// 1を付けて区別しないとエラーになる
const maskFrag =
`#version 300 es
precision highp float;
//uniform mat4 uLightVPMatrix; // まとめちゃえ。
uniform sampler2D uDepthMap; // あー、改名しないと。
//in vec4 vModelPosition;
in vec3 vNDC;
out float mask;
void main(){
  //vec4 NDcoord = uLightVPMatrix * vModelPosition;
  //NDcoord /= NDcoord.w;
  // このときの...
  //float localDepth = 0.5 + 0.5 * NDcoord.z;
  float localDepth = vNDC.z;
  vec2 p = vNDC.xy;
  float correctDepth = texture(uDepthMap, p).r;
  if(localDepth < correctDepth){
    mask = 1.0;
  }else{
    mask = 0.65;
  }
}
`;

// fragにdepthの結果を乗算するだけ
const shadowVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = 0.5 + 0.5 * aPosition;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const shadowFrag =
`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBase;
uniform sampler2D uShadow;
out vec4 fragColor;
void main(){
  vec4 color = texture(uBase, vUv);
  float shadow = texture(uShadow, vUv).r;
  fragColor = color * vec4(vec3(shadow), 1.0); // おわり。
}
`;

// ------------------------------------------------------ mesh ---------------------------------------------------------------- //
// いい加減メソッド化して隠蔽したいね。UV付けるか～色も？今回はいろいろいじるからね...

function registTorus(node){
  // 今回はトーラスで。紙の上で計算してるけどロジックは難しくないのよ。
  const a = 1.0;
  const b = 0.4;
  const ds = 32;
  const dt = 32;
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
      const col = ex.hsv2rgb(0.5+0.1*Math.sin(Math.PI*2*k/(ds+1)), 0.8+0.2*Math.cos(Math.PI*2*l/(dt+1)), 1);
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
  node.registFigure("torus", [
    {name:"aPosition", size:3, data:torusPositions},
    {name:"aNormal", size:3, data:torusNormals},
    {name:"aVertexColor", size:3, data:torusColors},
    {name:"aTexCoord", size:2, data:torusUVs}
  ]);
  node.registIBO("torusIBO", {data:torusFaces});
}

// 雑。
function registPlane(node){
  const p0 = [-1, -1, 0];
  const p1 = [1, -1, 0];
  const p2 = [-1, 1, 0];
  const p3 = [1, 1, 0];
  const positions = [p0, p1, p2, p3].flat();
  const uvs = [0, 1, 1, 1, 0, 0, 1, 0];
  const faces = [0, 1, 2, 2, 1, 3];
  const normals = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  node.registFigure("plane", [
    {name:"aPosition", size:3, data:positions},
    {name:"aNormal", size:3, data:normals},
    {name:"aTexCoord", size:2, data:uvs}
  ]);
  node.registIBO("planeIBO", {data:faces});
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

// ------------------------------------------------- set View ------------------------------------------- //
// 行列関連はまとめとこうか
function setModelView(node, tf, cam, flags = {}){
  if(flags.m === undefined){ flags.mo = false; }
  if(flags.v === undefined){ flags.v = true; }
  if(flags.mv === undefined){ flags.mv = true; }
  const modelMat = tf.getModelMat().m;
  const viewMat = cam.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  if(flags.m){ node.setUniform("uModelMatrix", modelMat); }
  if(flags.v){ node.setUniform("uViewMatrix", viewMat); }
  if(flags.mv){ node.setUniform("uModelViewMatrix", modelViewMat); }
}

// 色とかは切り離すべきよね。関係ないし。
function paint(node, r, g, b){
  node.setUniform("uUseColorFlag", 1).setUniform("uMonoColor", [r, g, b]);
}

function renderTorus(node, tf, cam, flags = {}){
  tf.initialize()
    .translate(0, 3*sin(frameCount*TAU/360), 2);
  setModelView(node, tf, cam, flags);
  node.drawElements("triangles");
}

function renderPlane(node, tf, cam, flags = {}){
  tf.initialize()
    .translate(0, 0, 0)
    .scale(4, 4, 1);
  setModelView(node, tf, cam, flags);
  node.drawElements("triangles");
}

// ---main--- //

// 白い面と青いトーラス
function setup(){
  _timer.initialize("slot0");
  createCanvas(800, 600, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // 透視
  cam0 = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[8, 0, 6], pers:{near:0.1, far:4}});
  // 平行
  cam1 = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[2, 2, 8]});
  cam1.setOrtho({left:-8, right:8, bottom:-6, top:6, near:0.1, far:2});

  // shader. lightはいつもの。それとデプス格納、マスク生成、マスク適用、の3つ。最後のはただの乗算...Float32なのでそのままでは無理。
  _node.registPainter("light", lightVert, lightFrag);
  _node.registPainter("calcDepth", calcDepthVert, calcDepthFrag);
  _node.registPainter("generateDepthMask", maskVert, maskFrag);
  _node.registPainter("applyShadow", shadowVert, shadowFrag);

  registPlane(_node);
  registTorus(_node);

  // ここにcam1で深度値を...加えてそのあと比較して乗算値を...
  const {w, h} = _node.getDrawingBufferSize(null);
  _node.registFBO("base", {w:w, h:h, color:{info:{}}}); // ここに描き込む。
  _node.registDoubleFBO("shadow", {w:w, h:h, color:{info:{type:"float", internalFormat:"r32f", format:"red", magFilter:"nearest"}}});

  // ちょっとテスト
  const v0 = cam0.getNDC(new ex.Vec3(-4, -4, 0)).mult(0.5).add(0.5);
  console.log(v0.x.toFixed(3), v0.y.toFixed(3), v0.z.toFixed(3));
  const v1 = cam0.getNDC(new ex.Vec3(4, -4, 0)).mult(0.5).add(0.5);
  console.log(v1.x.toFixed(3), v1.y.toFixed(3), v1.z.toFixed(3));
  const v2 = cam0.getNDC(new ex.Vec3(-4, 4, 0)).mult(0.5).add(0.5);
  console.log(v2.x.toFixed(3), v2.y.toFixed(3), v2.z.toFixed(3));
  const v3 = cam0.getNDC(new ex.Vec3(4, 4, 0)).mult(0.5).add(0.5);
  console.log(v3.x.toFixed(3), v3.y.toFixed(3), v3.z.toFixed(3));

  // 線引いて分けてみた。つまるところ、あの三角形の双方で違う計算がされているようです。
  const gr = createGraphics(width, height);
  gr.stroke(0);
  gr.line(v1.x*width, (1-v1.y)*height, v2.x*width, (1-v2.y)*height);
  _node.registTexture("info", {src:gr});
}

function draw(){
  // さてと。とりあえず普通にいつものライティング。とりあえず今回は平行光オンリーでいく。
  _node.bindFBO("base")
       .clearColor(0,0,0,1).clear();
  _node.usePainter("light");

  // 射影の用意
  const projMat0 = cam0.getProjMat().m;
  const projMat1 = cam1.getProjMat().m;

  // 射影(cam0)
  _node.setUniform("uProjectionMatrix", projMat0);

  // 環境光
  setLight(_node, {useSpecular:true});

  // 平行光
  setDirectionalLight(_node, {
    count:1,
    direction:[-2, -2, -8], // cam1に合わせる
    diffuseColor:[1, 1, 1],
    specularColor:[0.5,1,1]
  });

  _node.drawFigure("torus").bindIBO("torusIBO");
  paint(_node, 0.2, 0.5, 0.8);
  renderTorus(_node, _tf, cam0);
  _node.drawFigure("plane").bindIBO("planeIBO");
  paint(_node, 1, 1, 1);
  renderPlane(_node, _tf, cam0);

  _node.unbind();

  ex.copyPainter(_node, {src:{type:"fb", name:"base", view:[0,0,0.5,0.5]}});


  // さてお待ちかね。
  _node.bindFBO("shadow");
  _node.clearColor(0,0,0,0).clear();
  _node.usePainter("calcDepth");

  // 射影(cam1)
  _node.setUniform("uProjectionMatrix", projMat1);
  // 深度値を書き込む（ちょっと大きくする）
  _node.drawFigure("torus").bindIBO("torusIBO");
  renderTorus(_node, _tf, cam1, {v:false});
  _node.drawFigure("plane").bindIBO("planeIBO");
  renderPlane(_node, _tf, cam1, {v:false});
  _node.swapFBO("shadow").unbind();

  ex.copyPainter(_node, {src:{type:"fb", name:"shadow", view:[0.5,0,0.5,0.5]}});

  // 次にcam0でレンダリング、ただしさっきの...を使う。
  _node.bindFBO("shadow");
  _node.clearColor(0,0,0,0).clear();
  _node.usePainter("generateDepthMask");
  _node.setFBOtexture2D("uDepthMap", "shadow"); // さっきの結果をここで読み込んで

  // 射影(cam0)
  _node.setUniform("uProjectionMatrix", projMat0);
  const viewMat1 = cam1.getViewMat().m;
  const lightVPMat = ex.getMult4x4(viewMat1, projMat1); // ビュープロジェだけ違うのを使う、フラグで。
  _node.setUniform("uLightVPMatrix", lightVPMat);

  // fragでViewProjectionして正規化デバイス取ってuTexから結果を取って
  // それと深度値も得られるからそれと比較してマスクを作る
  _node.drawFigure("torus").bindIBO("torusIBO");
  renderTorus(_node, _tf, cam0, {m:true, mv:false});
  _node.drawFigure("plane").bindIBO("planeIBO");
  renderPlane(_node, _tf, cam0, {m:true, mv:false});
  _node.swapFBO("shadow").unbind();

  // ここ間違ってる？
  ex.copyPainter(_node, {src:{type:"fb", name:"shadow", view:[0,0.5,0.5,0.5]}});

  // 最後に結果をまとめる
  _node.bindFBO(null);
  _node.setViewport(0.5, 0.5, 0.5, 0.5);
  _node.usePainter("applyShadow");
  _node.setFBOtexture2D("uBase", "base");
  _node.setFBOtexture2D("uShadow", "shadow");
  _node.drawFigure("foxBoard");
  _node.drawArrays("triangle_strip")
  _node.unbind();

  ex.copyPainter(_node, {src:{name:"info", view:[0.5, 0.5, 0.5, 0.5]}});

  _node.unbind().flush();
}
