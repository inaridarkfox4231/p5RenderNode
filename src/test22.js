// 今後
// test22:複数個数でピッキング（ピックしたものの色を灰色からカラフルにする）
// test23:depthをレンダーテクスチャにして色を取り出し通常のテクスチャに落とす場合と比較
// test24:例のライティングプログラムを改造してディファード化してみる。とりあえずテストコード
// test25:例のbox4000をディファード色付けて
// test26:考え中。影の実験でもするか。あるいは息抜きにトゥーンレンダリングかステンシルアウトライン
// test27:ヘルパーの実験したいわね。さしあたり座標軸とカメラ。ていうかカメラの複数画面ってまだやってないぞ....
// lil.guiもってなるとまた番号ずらす...いや、もう宿題を片付けてしまおう。

// 例のあれ、チューブで書き直すなら自分なりに別のもの作るわ。

// というわけでここではピッキングの練習をします。OK.

// 20221030
// VSでwで割るのは辞めてください（修正）

const ex = p5wgex;
let _node;
let _cam;
let _tf = new ex.TransformEx();
let _timer = new ex.Timer();

let spoit = new Uint8Array(4*1*1); // ここに格納する。

// ライティングはそのまま使う。
// マウスがヒットしたものだけライティングを行なうようにできるといいんだけど。
// MRTで通常のスクリーンとは別にindexに対して(i,i,i,1)を書き込む
// readPixelsで取得して4番目が255だったら0番目を見て0～99を設定、そうでなければ-1を設定

// s倍してz軸周りにt回転してx,y,zだけ平行移動するmodel行列は列ベクトル表示で（つまり内部表示で）
// s, 0, 0, 0, 0, s*cos(t), s*sin(t), 0, 0, -s*sin(t), s*cos(t), 0, x, y, z, 1
// です。だからmodelDataとしてx,y,z,sを渡してついでに回転角としてtを渡すようにして
// tはattributeにしてactiveなときだけ増やすようにして動的更新で渡すようにすれば望みの挙動になるわね。
// ただindexを渡してあるのでそれ使ってフェッチでもいい。

// ------------------------------------------------------------------------------------------------------------ //
// shaders.

// 現時点でのライティング。
// 場合によっては頂点テクスチャフェッチでModelを頂点の付属idかなんかから読み込んで
// まとめて位置を変換する場合もある。その場合ModelViewは不要でViewだけ放り込み、
// Modelと掛けて法線を出し、Projectionと掛けて正規化デバイスの位置を出す。
const lightVert =
`#version 300 es
in vec3 aPosition;
in vec3 aVertexColor;
in vec3 aNormal;
in vec2 aTexCoord;

in float aIndex;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vTexCoord;

out float vIndex;

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);

  // Pass varyings to fragment shader
  vViewPosition = viewModelPosition.xyz;
  gl_Position = uProjectionMatrix * viewModelPosition; // 正規化デバイス座標

  mat3 normalMatrix; // こうしよう。[0]で列ベクトルにアクセス。
  normalMatrix[0] = uModelViewMatrix[0].xyz;
  normalMatrix[1] = uModelViewMatrix[1].xyz;
  normalMatrix[2] = uModelViewMatrix[2].xyz;
  normalMatrix = inverse(transpose(normalMatrix)); // これでいい。

  vNormal = normalMatrix * aNormal;
  vVertexColor = aVertexColor;
  vTexCoord = aTexCoord;

  vIndex = aIndex; // 整数はそのまま渡すだけ。
}
`;

// とりまmediumpで。
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

in vec3 vVertexColor;
in vec3 vNormal;
in vec3 vViewPosition;
in vec2 vTexCoord; // テクスチャ

// -------------------- その他 -------------------- //

uniform float uTargetIndex; // -1もしくは0～99.
in float vIndex; // 判別用の整数

layout (location = 0) out vec4 pickColor; // 判別用
layout (location = 1) out vec4 finalColor; // 最終的な色

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

   pickColor = vec4(vIndex, vIndex, vIndex, 1.0);

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

// y座標ひっくり返す意味無い気がする
const dataVert =
`#version 300 es
in vec4 aData;
out vec4 vData;
uniform float uSize;
void main(){
  float index = float(gl_VertexID); // 使えるようです。やったね。
  vec2 p = vec2(mod(index, uSize), floor(index / uSize)) + 0.5;
  p /= uSize;
  p = (p - 0.5) * 2.0;
  gl_Position = vec4(p, 0.0, 1.0);
  vData = aData;
  gl_PointSize = 1.0; // 必須
}
`;

const dataFrag =
`#version 300 es
precision highp float;
in vec4 vData;
out vec4 data;
void main(){
  data = vData;
}
`;

function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  // デフォでいいよ。
  _cam = new ex.CameraEx({
    w:800, h:640, top:[0, 0, 1], eye:[16, 0, 6]
  });

  // MRT用にカスタマイズしたライティングシェーダ
  _node.registPainter("light", lightVert, lightFrag);

  // cubeのメッシュを100個複製（スケールは1～4でランダム）（位置は-3～3でランダム）
  const cubePositions = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1, -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  const cubeFaces = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  const cubeNormals = ex.getNormals(cubePositions, cubeFaces);
  let cubeV = [];
  let cubeN = [];
  let cubeF = [];
  let cubeC = [];
  let cubeI = [];
  for(let i=0; i<100; i++){
    const x = Math.random()*10-5;
    const y = Math.random()*10-5;
    const z = Math.random()*10-5;
    const s = 0.2+0.3*Math.random();
    const col = ex.hsv2rgb(0.45+0.2*Math.random(), 0.8+0.2*Math.random(), 0.8);
    for(let k=0; k<8; k++){
      const x1 = cubePositions[k*3];
      const y1 = cubePositions[k*3+1];
      const z1 = cubePositions[k*3+2];
      cubeV.push(...[s*x1 + x, s*y1 + y, s*z1 + z]);
      cubeC.push(col.r, col.g, col.b);
    }
    cubeN.push(...cubeNormals);
    cubeI.push(...[i,i,i,i,i,i,i,i]);
    for(let k=0; k<36; k++){
      cubeF.push(8*i + cubeFaces[k]); // indexの方で「8*i+」ってやっちゃった（おい）
    }
    // みたいな。
  }
  _node.registFigure("cube100", [
    {name:"aPosition", size:3, data:cubeV},
    {name:"aIndex", size:1, data:cubeI},
    {name:"aNormal", size:3, data:cubeN},
    {name:"aVertexColor", size:3, data:cubeC}
  ]);
  _node.registIBO("cubeIBO", {data:cubeF});

  // MRTやりたいのでMRT用のフレームバッファを作る
  const {w, h} = _node.getDrawingBufferSize(null);
  _node.registFBO("picker", {w:w, h:h, color:{info:[{}, {}]}});

  // infoがあった方が分かりやすいわね
  const gr = createGraphics(width, height); gr.noStroke(); gr.fill(255);
  gr.textSize(16);
  _node.registTexture("info", {src:gr});

  // spoitは0で初期化されている

  // x,y,z,s(translateとscaleのデータ)を100個分1x100のフレームバッファに放り込む
  _node.registFBO("modelData", {w:100, h:1, color:{info:{type:"float"}}});
  const dataArray = new Array(4*100);
  for(let i=0; i<100; i++){
    dataArray[4*i] = Math.random()*10-5;
    dataArray[4*i+1] = Math.random()*10-5;
    dataArray[4*i+2] = Math.random()*10-5;
    dataArray[4*i+3] = 0.2 + 0.3 * Math.random(); // スケール
  }
  _node.registFigure("data", [
    {size:4, name:"aModelData", data:dataArray}
  ]);
  _node.registPainter("dataInput", dataVert, dataFrag);
  _node.bindFBO("modelData").clearColor(0,0,0,0).clear()
       .use("dataInput", "data").setUniform("uSize", 100).drawArrays("points").unbind();

}

function draw(){
  // 黒でクリア
  _node.bindFBO(null).clearColor(0,0,0,1).clear();

  // 1. "picker"に描画する。このときその中の0番に整数値が入る。
  // 2. copyPainterで1番をスクリーンに描画
  // 3. 0番からreadPixelsでマウス位置を元に情報を取得する。それをfeedbackして描画時に反映させる(uTargetIndex).
  render();

  // 何も指定しない場合自動的にnullがtargetになるうえ、この処理でtargetが変更されることはない。
  ex.copyPainter(_node, {src:{type:"fb", name:"picker", index:1}});
  // とりあえずここまで。
}

function render(){
  // オフスクリーンレンダリング
  _node.bindFBO("picker");

  // カメラを動かす
  moveCamera(_cam);

  _node.clearColor(0,0,0,0).clear();
  _node.usePainter("light");

  // 射影
  const projMat = _cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);

  // 環境光
  setLight(_node, {useSpecular:true});
  const {front} = _cam.getLocalAxes(); // frontから視線方向に光を当てる。
  const {eye} = _cam.getViewData();

  // 平行光
  setDirectionalLight(_node, {
    count:2,
    direction:[-front.x, -front.y, -front.z, 0, 0, -1],
    diffuseColor:[1, 1, 1, 1, 1, 1],
    specularColor:[0.5,1,1, 1, 0.5, 1]
  });

  // 点光源
  setPointLight(_node, {
    count:2,
    location:[0,0,1.5, 3, 0, 1.5],
    diffuseColor:[1,1,1,1,1,1],
    specularColor:[1, 0.5, 1,1,0.5,1]
  });

  // 照射光
  setSpotLight(_node, {
    count:1,
    location:[eye.x*2, eye.y*2, eye.z*2],
    direction:[-front.x, -front.y, -front.z],
    angle:[Math.PI/3],
    conc:[20],
    diffuseColor:[0.5, 1, 0.5],
    specularColor:[0.75, 1, 0.75]
  });

  // 彩色方法指定（頂点色）
  _node.setUniform("uUseColorFlag", 0);

  _node.drawFigure("cube100").bindIBO("cubeIBO");

  render100cubes(_node, _tf, _cam);
}

// ------------------------------------------------------------------------------------------------------------------------------- //
// light.

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
  node.setUniform("uViewMatrix", viewMat);
  node.setUniform("uModelViewMatrix", modelViewMat);
}

// 100cubes.
function render100cubes(node, tf, cam){
  tf.initialize();
  setModelView(node, tf, cam);
  node.drawElements("triangles");
}

// ------------------------------------------------------------------------------------------------------------------------------- //
// config.

function moveCamera(cam){
  if(keyIsDown(RIGHT_ARROW)){ cam.spin(0.03); }
  if(keyIsDown(LEFT_ARROW)){ cam.spin(-0.03); }
  if(keyIsDown(UP_ARROW)){ cam.arise(0.04); } // 上
  if(keyIsDown(DOWN_ARROW)){ cam.arise(-0.04); } // 下
  if(keyIsDown(69)){ cam.dolly(0.05); } // Eキー
  if(keyIsDown(68)){ cam.dolly(-0.05); } // Dキー
}
