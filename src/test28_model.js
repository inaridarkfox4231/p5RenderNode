// 立方体でtexturePaint.

// texture用に1024x1024のcreateGraphicsを用意
// 立方体は普通にtexture利用でライティングで描画
// MRT使ってUVを落とす（floatの2という形式）
// それを参照しながらUVtexture画像に点を落として着色
// いつものようにディファードで描画
// おわり...

// 本番です。

// そうか。逆にしないとダメか。んー。
// マウスも逆にしないといけないし
// uv送るときも逆にしないといけないようです
// 理由は...どうしてでしょうね...ともかくできました。
// まあ何も終わってないけど。blenderで落としたモデルについては未知数、まあ何とかするよ。

// close/farで大きさが変化しないのかって？これから...
// 色とか変えられないのかって？これから...
// 消しゴム？これから...
// clearしたい！これから...
// 点群もいいけどマウスの現在位置と前の位置を参照しつつそれらを結ぶ線分に対して点群を使って描画するようにすれば
// より滑らかに線とか引けそうね。

// alphaについてはblendをalphaだけaddにしてそれ以外をalphaで割合にすればいいと思う
// まあとりあえずロボット

// y軸topにしてz軸前方向から見るとちゃんとしてる
// このころはそれでやってたわね

const ex = p5wgex;
let _node;
const _timer = new ex.Timer();
let _cam;
const _tf = new ex.TransformEx();

let robot;

// ----------------------------------------------- light ------------------------------------------------ //
const colorVert =
`#version 300 es
in vec3 aPosition;
in vec3 aVertexColor;
in vec3 aNormal;
in vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjMatrix; // ModelViewProjectionだとさすがに長すぎるので統一目的でProjに短縮

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vTexCoord;

out vec4 vNDC;

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);

  // Pass varyings to fragment shader
  vViewPosition = viewModelPosition.xyz;
  vec4 NDcoord = uProjMatrix * viewModelPosition; // 正規化デバイス座標
  gl_Position = NDcoord;
  vNDC = NDcoord;

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

const colorFrag =
`#version 300 es
precision mediump float;

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

in vec4 vNDC;

// -------------------- 出力その他 -------------------- //
layout (location = 0) out vec4 materialColor;
layout (location = 1) out vec4 viewPosition;
layout (location = 2) out vec4 normal;
layout (location = 3) out vec4 uv;

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
  materialColor = col;
  float depth = 0.5 * (vNDC.z / vNDC.w) + 0.5;
  viewPosition = vec4(vViewPosition, 1.0); // んー...んー...
  normal = vec4(vNormal, depth);
  uv = vec4(vTexCoord, 1.0, 1.0); // vTexCoord.
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

// uv用のFBOをセットしてマウス位置周辺のポイントスプライトとその他大勢をUVに落としたやつと照合して
// texture上の位置を決めてそこに色を落とすシェーダー

// どうでもいいけど透明度指定してblendを適切に設定して...ってやらないとブラシとかできないねぇ
const paintVert =
`#version 300 es
uniform sampler2D uUvMap;
in vec2 aPosition;
in vec3 aColor;
uniform vec2 uMouse;
out vec3 vColor;
void main(){
  vec2 p = uMouse + aPosition;
  vec3 texCoord = texture(uUvMap, p).xyz;
  vColor = aColor;
  vec2 pos = texCoord.xy * 2.0 - 1.0;
  pos.y *= -1.0; // え？？？これが答え？？？？？？？？？？え？？？？？？
  // そういうこと？？？？なんで？？？？？？？なんで？？？？？？？？？？？？？
  // はぁ？？？？？？？？？
  if(texCoord.z == 0.0){ pos = vec2(-1.1, -1.1); } // 範囲外の場合
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;
const paintFrag =
`#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;
void main(){
  fragColor = vec4(vColor, 1.0);
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

// 行列関連はまとめとこうか
function setModelView(node, tf, cam){
  const modelMat = tf.getModelMat().m;
  const viewMat = cam.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  node.setUniform("uModelViewMatrix", modelViewMat);
}

// 今回はtexture彩色
function render(node, tf, cam, x, y, z){
  tf.initialize();
  setModelView(node, tf, cam);
  node.setUniform("uUseColorFlag", 2);
  node.setFBOtexture2D("uTex", "customTexture");
  node.setUniform("uTint", [1, 1, 1]);
  node.drawElements("triangles");
}

// robot.
function registRobot(node, size){
  // rabbitModelからデータを取得したりする
  // verticesはベクトル3Dが入っててx,y,z成分を抜き出さないと無理
  // facesも各番号に長さ3の配列がもちろん入ってる
  // uvsは何にも入ってないけど内容的には[0,0]が延々と並んでる
  // vertexNormalsが法線でvertexColorsが色。
  // normalsは色々入ってるみたい。vertexColorsは死んでる。長さ0. 好きに使わせてもらおう。
  const N = robot.vertices.length; // 4564.
  const F = robot.faces.length;
  const positions = new Array(N*3);
  const normals = new Array(N*3);
  const uvs = new Array(N*2);
  const faces = new Array(F*3);
  // 続きは...
  for(let i=0; i<N; i++){
    const v = robot.vertices[i];
    positions[3*i] = v.x * size;
    positions[3*i+1] = v.y * size;
    positions[3*i+2] = v.z * size;
    const n = robot.vertices[i];
    normals[3*i] = n.x;
    normals[3*i+1] = n.y;
    normals[3*i+2] = n.z;
    const uv = robot.uvs[i];
    uvs[2*i] = uv[0];
    uvs[2*i+1] = uv[1];
  }
  for(let i=0; i<F; i++){
    const f = robot.faces[i];
    faces[3*i] = f[0];
    faces[3*i+1] = f[1];
    faces[3*i+2] = f[2];
  }
  node.registFigure("robot", [
    {name:"aPosition", size:3, data:positions},
    {name:"aNormal", size:3, data:normals},
    {name:"aTexCoord", size:2, data:uvs}
  ]);
  node.registIBO("robotIBO", {data:faces, large:true}); // 一応。
}

// 立方体
function registCube(node, size = 1, hue = 0){
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
  node.registFigure("cube", [
    {name:"aPosition", size:3, data:v},
    {name:"aNormal", size:3, data:n},
    {name:"aVertexColor", size:3, data:vc},
    {name:"aTexCoord", size:2, data:uv}
  ]);
  node.registIBO("cubeIBO", {data:f, large:true}); // 一応。
}

// 点群
function registPoints(node, r, w, h){
  const v = [];
  const vc = [];
  for(let x=-r; x<r; x++){
    for(let y=-r; y<r; y++){
      const d = Math.sqrt(x*x+y*y);
      if(d<r){
        v.push((x+0.5)/w, (y+0.5)/h);
        vc.push(1, 1, 1);
      }
    }
  }
  node.registFigure("points", [{name:"aPosition", size:2, data:v}, {name:"aColor", size:3, data:vc}]);
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

// ----------

function showInfo(){
  const gr = _node.getTextureSource("info");
  gr.background(0);
  gr.text("RIGHT/LEFT_ARROW: camera spin", 5, 5);
  gr.text("UP/DOWN_ARROW: camera arise", 5, 25);
  gr.text("KEY_E: close", 5, 45);
  gr.text("KEY_D: far", 5, 65);
  gr.text("mousePress", 5, 105);
  _node.updateTexture("info");
  ex.copyPainter(_node, {src:{name:"info"}});
}

// ----------

function texturePaint(){
  const mx = mouseX/width;
  const my = 1-mouseY/height;
  _node.bindFBO("customTexture")
       .use("paint", "points")
       .setFBOtexture2D("uUvMap", "defer", "color", 3)
       .setUniform("uMouse", [mx, my])
       .drawArrays("points")
       .unbind();
}

// ----------------------------------------------------------------------------------- //

function preload(){
  robot = loadModel("https://inaridarkfox4231.github.io/models/robot.obj");
}

function setup(){
  // timer.
  _timer.initialize("slot0");

  // initialize.
  createCanvas(640, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // camera.
  _cam = new ex.CameraEx({w:width, h:height, top:[0, 1, 0], eye:[0, 0, 4], pers:{near:0.1, far:10}});

  // shaders.
  _node.registPainter("color", colorVert, colorFrag);
  _node.registPainter("defer", deferVert, deferFrag);
  _node.registPainter("paint", paintVert, paintFrag);

  // FBO.
  const {w, h} = _node.getDrawingBufferSize(null);
  _node.registFBO("defer", {w:w, h:h, color:{info:[{}, {type:"float"}, {type:"float"},
                  {type:"float"}]}});
  _node.registFBO("customTexture", {w:1024, h:1024, color:{info:{}}}); // ここになんか描き込む

  // UV用のあれを初期化
  _node.bindFBO("customTexture").clearColor(0, 0.5, 0.75, 1).clear().bindFBO(null);

  // meshes.
  registCube(_node);
  registRobot(_node, 1);
  registPoints(_node, 12, w, h); // 上記のwとhをそのまま使う

  // culling.
  _node.enable("cull_face");

  // information.
  _node.registTexture("info", {src:(function(){
    const gr = createGraphics(width, height);
    gr.fill(255);
    gr.textSize(16);
    gr.textAlign(LEFT, TOP);
    return gr;
  })()});
}

// とりあえず描いちゃおう

function draw(){
  moveCamera(_cam); // カメラ動かそう

  _node.bindFBO("defer");
  _node.clearColor(0,0,0,0).clear();
  //_node.use("color", "cube").bindIBO("cubeIBO");
  _node.use("color", "robot").bindIBO("robotIBO");

  // 射影
  const projMat = _cam.getProjMat().m;
  _node.setUniform("uProjMatrix", projMat);
  // deferに各種情報を格納
  render(_node, _tf, _cam, 0, 0, 0);

  // uv情報を使って...
  if(mouseIsPressed){ texturePaint(); }

  // 本描画
  _node.bindFBO(null);
  _node.clearColor(0,0,0,0).clear();

  //ex.copyPainter(_node, {src:{type:"fb", name:"defer", index:3}});
  showInfo();

  // いちいちこれやるのどうにかなんないかな...デフォルトだと透明度0で上書きされちゃうのよね。
  _node.enable("blend").blendFunc("src_alpha", "one_minus_src_alpha");

  _node.use("defer", "foxBoard");

  // 環境光
  setLight(_node, {useSpecular:true});

  // 平行光
  const {center:c0, eye:e0} = _cam.getViewData();
  setDirectionalLight(_node, {
    count:1,
    direction:[c0.x-e0.x, c0.y-e0.y, c0.z-e0.z],
    diffuseColor:[1, 1, 1],
    specularColor:[0.5,0.75,1]
  });

  // 行列もvしか使わないよ
  _node.setUniform("uViewMatrix", _cam.getViewMat().m);

  // 各種textureをsetする
  _node.setFBOtexture2D("uMaterialColor", "defer", "color", 0)
       .setFBOtexture2D("uViewPosition", "defer", "color", 1)
       .setFBOtexture2D("uNormal", "defer", "color", 2);

  _node.drawArrays("triangle_strip");
  _node.unbind();

  // 基本的にblendは元に戻しましょう
  _node.disable("blend");

  _node.flush();
}
