// メルクマール

// モデルデータをFBO経由でぶち込む練習をしています(20221024)

// ここではピッキングの練習をします。

// エラーの原因が分かりました。
// そうか...uniformってvsとfsで同じ値使えないんだ（リンクエラーになる）。
// 同じ値を使う場合はvaryingでvsからfsに渡す必要があるのね。難しいね...
// 気を付けよう。

// 頂点ごとに値がぶれてますね...なぜ...この方法だとうまくいかないんかな。
// 補間されてしまうからなのか...う～ん？？

// ああ、わかった。readPixelsやるときにpickerをbindしてないからだ。ああもう！！

// copyPainter便利なんですけど、極力明示的にbindFBOしてください。でないと可読性が落ちるし、
// こういう事故の原因になるので。

// 重なるのうざいからパッキングしようかな...

// ライティングはそのまま使う。
// マウスがヒットしたものだけライティングを行なうようにできるといいんだけど。
// MRTで通常のスクリーンとは別にindexに対して(i,i,i,1)を書き込む
// readPixelsで取得して4番目が255だったら0番目を見て0～99を設定、そうでなければ-1を設定

// s倍してz軸周りにt回転してx,y,zだけ平行移動するmodel行列は列ベクトル表示で（つまり内部表示で）
// s, 0, 0, 0, 0, s*cos(t), s*sin(t), 0, 0, -s*sin(t), s*cos(t), 0, x, y, z, 1
// です。だからmodelDataとしてx,y,z,sを渡してついでに回転角としてtを渡すようにして
// tはattributeにしてactiveなときだけ増やすようにして動的更新で渡すようにすれば望みの挙動になるわね。
// ただindexを渡してあるのでそれ使ってフェッチでもいい。

// dataの中身を書き換える？のか？...ピンポイントで...vec4だから4バイト。で...
// vec4だから16バイト。なので、i番目の情報を書き換えるには16*iをoffsetに指定したうえで
// 長さ4のFloat32Arrayを使えばいい。はず。なので
// マウスダウンされたときにactiveなそれがあればactiveなそれのx,y,zがキープされてそのあとマウスダウンされている限り
// ...？？？
// 別に実験してfeedBackしましょう。そうしましょう。
// （x,y,zにviewProjを施して深度値を割り出し新しいマウスの位置に対してその深度値と同じグローバルの座標を計算して
// そこに持っていけばいい。難しい。Threeはそこら辺をぱぱっとこなすあれを持ってるとか...でもまあ普通に実装するか。
// マウス値 → 正規化デバイス座標 → ビュー座標（不定）という流れ。(x,y,z)のビュー座標のzとzが等しくなるように
// 不定値が決まる。つまりzで割った比が等しいということ。

// カメラにメソッドを追加して、射影モードごとにデバイス座標と空間座標からその空間座標と同じビュー空間におけるz座標を持つ
// 空間内の座標を見出す関数を作ればいいんですよね。テストしないと...

// 動的更新自体は全然難しくないけどね。

// 20221025
// dataUpdate実装しました。こんなんでいいんだ...
// grabとそのときのindexを保持して...grabがtrueの場合にindexとmodelDataArrayからx,y,zを取得して
// viewに落としてzを記録して
// 一方でマウス値を正規化デバイスに落としてそれに落ちるviewの座標でzが同じものを取得して
// view逆変換で行き先のx,y,zを取得したらmodelDataArrayの方も更新したうえでdataUpdate.お疲れ様でした。

// bufferSubData間違えてたのを修正した。dstByteOffsetが先だったわね...あっちも書き換えないと。
// 全部0だから問題が起きてなかっただけだった。んー
// 計算あわない！！

// あ...subModelDataって0,1,2じゃん。ああああ！！
// 次のバグは何だろう...

// NDCの計算方法がきちんと把握できてない。

// NDCの計算間違ってる、というかもろもろ誤解してる可能性がある。出直すしかない。
// ごめんなさいViewは3x3じゃなくて4x4でした勘違い！！！直します。というか出直します。

// 本題。もう簡単です。getParallelPositionを使う。以上。（...）
// grabのときにreadingしないでマウス位置に対象を持ってくる。grabのときはgrabbing... grabbing...

// sliceでFloat32Arrayから切り出した結果はArray.isArrayであれ出来ない、ようです、ね。
// 仕様変更するか...

// 20221030
// vsでwで割るのやめてね。

const ex = p5wgex;
let _node;
let _cam;
let _tf = new ex.TransformEx();
let _timer = new ex.Timer();

let spoit = new Uint8Array(4*1*1); // ここに格納する。
let grab = false; // マウスダウンで発火

let modelDataArray = new Float32Array(4*100);
let subModelData = new Float32Array(3);

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

//uniform mat4 uModelViewMatrix;
uniform mat4 uViewMatrix; // 今回はviewだけ
uniform mat4 uProjectionMatrix;
uniform float uTime;

out mat4 vViewMatrix;

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vTexCoord;

out float vIndex;

uniform sampler2D uData; // モデルデータ
uniform float uSize; // 横の長さ（今回は100.0）

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
  vec3 p = aPosition;
  // pに掛けるモデル行列を構築する
  vec4 data = texture(uData, vec2(aIndex+0.5, 0.0) / uSize);
  float s = data.w;
  float t = uTime * 6.28318 * 0.5;
  mat4 modelMatrix = mat4(s*cos(t), s*sin(t), 0.0, 0.0, -s*sin(t), s*cos(t), 0.0, 0.0,
                          0.0, 0.0, s, 0.0, data.x, data.y, data.z, 1.0);
  mat4 modelViewMatrix = uViewMatrix * modelMatrix;
  vec4 viewModelPosition = modelViewMatrix * vec4(p, 1.0);

  // Pass varyings to fragment shader
  vViewPosition = viewModelPosition.xyz;
  gl_Position = uProjectionMatrix * viewModelPosition; // 正規化デバイス座標

  mat3 normalMatrix; // こうしよう。[0]で列ベクトルにアクセス。
  normalMatrix[0] = modelViewMatrix[0].xyz;
  normalMatrix[1] = modelViewMatrix[1].xyz;
  normalMatrix[2] = modelViewMatrix[2].xyz;
  normalMatrix = inverse(transpose(normalMatrix)); // これでいい。

  vNormal = normalMatrix * aNormal;
  vVertexColor = aVertexColor;
  vTexCoord = aTexCoord;

  vIndex = aIndex; // 整数はそのまま渡すだけ。

  vViewMatrix = uViewMatrix;
}
`;

// とりまmediumpで。
const lightFrag =
`#version 300 es
precision mediump float;

// -------------------- ライティング関連 -------------------- //
// ビュー行列
in mat4 vViewMatrix;

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
  vec3 lightVector = (vViewMatrix * vec4(direction, 0.0)).xyz;
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
  vec3 lightPosition = (vViewMatrix * vec4(location, 1.0)).xyz;
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
  vec3 lightPosition = (vViewMatrix * vec4(location, 1.0)).xyz; // locationは光の射出位置
  vec3 lightVector = modelPosition - lightPosition; // 光源 → モデル位置
  vec3 lightDir = normalize(lightVector);
  float lightDistance = length(lightVector);
  float d = lightDistance;
  float lightFalloff = 1.0 / dot(uAttenuation, vec3(1.0, d, d*d));
  // falloffは光それ自身の減衰で、これに加えてspot（angleで定義されるcone状の空間）からのずれによる減衰を考慮
  float spotFalloff;
  vec3 lightDirection = (vViewMatrix * vec4(direction, 0.0)).xyz;
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

  // vIndex == uTargetIndexのときだけ色が明るくなる
  if(vIndex != uTargetIndex){ result.rgb *= 0.2; }

  return result;
}

// -------------------- メインコード -------------------- //

void main(void){

   pickColor = vec4(vec3(vIndex) / 255.0, 1.0);

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
  _timer.initialize("slot0");
  _timer.initialize("forDots");
  createCanvas(800, 640, WEBGL);

  _node = new ex.RenderNode(this._renderer.GL);
  // デフォでいいよ。
  _cam = new ex.CameraEx({
    w:800, h:640, top:[0, 0, 1], eye:[16, 0, 6]
  });

  // MRT用にカスタマイズしたライティングシェーダ
  _node.registPainter("light", lightVert, lightFrag);

  // cubeのメッシュを100個複製
  const cubePositions = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1, -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  const cubeFaces = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  const cubeNormals = ex.getNormals(cubePositions, cubeFaces);
  let cubeV = [];
  let cubeN = [];
  let cubeF = [];
  let cubeC = [];
  let cubeI = [];
  for(let i=0; i<100; i++){
    const col = ex.hsv2rgb(0.45+0.2*Math.random(), 0.8+0.2*Math.random(), 0.8);
    for(let k=0; k<8; k++){
      const x1 = cubePositions[k*3];
      const y1 = cubePositions[k*3+1];
      const z1 = cubePositions[k*3+2];
      cubeV.push(x1, y1, z1);
      cubeC.push(col.r, col.g, col.b);
    }
    cubeN.push(...cubeNormals);
    cubeI.push(i,i,i,i,i,i,i,i);
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
  const gr = createGraphics(width, height);
  gr.noStroke();
  gr.fill(255);
  gr.textSize(16);
  gr.textAlign(CENTER, CENTER);
  _node.registTexture("info", {src:gr});

  // spoitは0で初期化されている

  // x,y,z,s(translateとscaleのデータ)を100個分1x100のフレームバッファに放り込む
  _node.registFBO("modelData", {w:100, h:1, color:{info:{type:"float"}}});
  //const dataArray = new Array(4*100);
  for(let i=0; i<100; i++){
    const radius = Math.pow(Math.random(), 0.33)*8;
    const theta = Math.random()*Math.PI;
    const phi = Math.random()*Math.PI*2;
    modelDataArray[4*i] = radius * cos(phi) * sin(theta);
    modelDataArray[4*i+1] = radius * sin(phi) * sin(theta);
    modelDataArray[4*i+2] = radius * cos(theta);
    modelDataArray[4*i+3] = 0.2 + 0.3 * Math.random(); // スケール
  }
  _node.registFigure("data", [
    {size:4, name:"aData", data:modelDataArray, usage:"stream_draw"}
  ]);
  dataInput();
}

function dataInput(){
  // データインプット。やってることがテンプレなのでいずれメソッドにするつもり...
  _node.registPainter("dataInput", dataVert, dataFrag);
  _node.bindFBO("modelData").clearColor(0,0,0,0).clear()
       .use("dataInput", "data").setUniform("uSize", 100).drawArrays("points").unbind();
}

function dataUpdate(i, x, y, z){
  // i番目のx,y,zをいじって再設定
  subModelData[0] = x;
  subModelData[1] = y;
  subModelData[2] = z;
  _node.bindFBO("modelData").clearColor(0,0,0,0).clear()
       .use("dataInput", "data");
  // targetFigureがbindされてないといけない...というか目当てのvboにアクセス出来ればいいということ。
  // Figure経由でなくてもvboにアクセス出来れば問題ない。bindされてないと更新できない。
  _node.bufferSubData("aData", "array_buf", 16*i, subModelData); // 4バイト x 4 x i.
  _node.setUniform("uSize", 100).drawArrays("points").unbind();
}

// ----------

function draw(){
  // 黒でクリア
  _node.bindFBO(null).clearColor(0,0,0,1).clear();

  // カーソルはspoit[3]が0ならノーマル、0でなくgrabでないならgrab,grabならgrabbing.
  setCursor();

  // 1. "picker"に描画する。このときその中の0番に整数値が入る。
  // 2. copyPainterで1番をスクリーンに描画
  // 3. 0番からreadPixelsでマウス位置を元に情報を取得する。それをfeedbackして描画時に反映させる(uTargetIndex).
  render();

  // 何も指定しない場合自動的にnullがtargetになるうえ、この処理でtargetが変更されることはない。
  _node.bindFBO(null);
  ex.copyPainter(_node, {src:{type:"fb", name:"picker", index:1}});

  // grabでない場合はreadIndexでspoitを更新、grabの場合はdragAndDropでマウス位置にターゲットを落とす。
  if(!grab){
    readIndex();
  }else{
    dragAndDrop();
  }

  // きちんと明示した方が...といってもcopyPainterもどこのfboに落とすかは一応明示してるのよね。難しいところ。
  _node.bindFBO(null);
  showInfo();

  _node.flush();
}

// ------------------------------------------------------------------------------------------------ //

function setCursor(){
  const _style = this.canvas.style;
  if(spoit[3] > 0){
    if(grab){
      _style.cursor = "grabbing";
    }else{
      _style.cursor = "grab";
    }
  }else{
    _style.cursor = "";
  }
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

  // モデルデータは今回fbo経由
  _node.setFBOtexture2D("uData", "modelData");
  _node.setUniform("uSize", 100);
  _node.setUniform("uTime", _timer.getDelta("slot0"));

  // targetIndexはspoit[3]===0の場合-1. >0の場合spoit[0]を放り込む。
  _node.setUniform("uTargetIndex", (spoit[3] > 0 ? spoit[0] : -1));

  _node.drawFigure("cube100").bindIBO("cubeIBO");

  render100cubes(_node, _tf, _cam);
}

function readIndex(){
  // readPixelsでマウス位置の色を取得
  // 0.5を足せば640から引いてもOK
  const mx = (Math.max(0, Math.min(mouseX, 800)) + 0.5)/800;
  const my = 1.0 - (Math.max(0, Math.min(mouseY, 640)) + 0.5)/640;
  const {w, h} = _node.getDrawingBufferSize("picker");
  _node.bindFBO("picker");
  _node.readPixels(mx*w, my*h, 1, 1, "rgba", "ubyte", spoit);
}

function showInfo(){
  // 色表示
  const gr = _node.getTextureSource("info");
  gr.clear();
  if(spoit[3] > 0){
    const activeIndex = spoit[0];
    gr.text("activeIndex: " + activeIndex, width/2, height*7/8);
    // dots.
    const dots = ["  ", ".  ", ".. ", "..."];
    const n = _timer.getDeltaDiscrete("forDots", 250, 4);
    if(grab){ gr.text("grabbing now" + dots[n], width/2, height*15/16); }
  }else{
    gr.text("立方体が選択されていません", width/2, height*7/8);
  }
  _node.updateTexture("info");

  ex.copyPainter(_node, {src:{name:"info"}});
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
// 今回はview行列だけを使います
function setModelView(node, tf, cam){
  //const modelMat = tf.getModelMat().m;
  const viewMat = cam.getViewMat().m;
  //const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  node.setUniform("uViewMatrix", viewMat);
  //node.setUniform("uModelViewMatrix", modelViewMat);
}

// 100cubes.
function render100cubes(node, tf, cam){
  //tf.initialize();
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

// --------------------------- //
// drag and drop
function mousePressed(){
  if(!grab && spoit[3] > 0){
    grab = true;
    _timer.set("forDots");
  }
}
function mouseReleased(){
  grab = false;
}

function dragAndDrop(){
  // grabしてるときに対象のcubeの位置を取得しマウス位置も取得しマウス位置が正規化デバイスになってビューのzが
  // 対象と同じになるような位置のグローバルに対象を置くとかそういう関数（伝われ）
  const activeIndex = spoit[0];
  const x = modelDataArray[4*activeIndex];
  const y = modelDataArray[4*activeIndex+1];
  const z = modelDataArray[4*activeIndex+2];
  const p = new ex.Vec3(x, y, z); // 知ってるかもだけどFloat32Arrayは特殊な配列なのでsliceした結果はArray.isArrayで
  // trueにならないんです。注意してください。露骨にやるのが吉です。とはいえまあ、お疲れさまでした...
  const mx = 2*(mouseX/width)-1;
  const my = -(2*(mouseY/height)-1);
  const q = _cam.getParallelPosition(p, mx, my);
  modelDataArray[4*activeIndex] = q.x;
  modelDataArray[4*activeIndex+1] = q.y;
  modelDataArray[4*activeIndex+2] = q.z;
  dataUpdate(activeIndex, q.x, q.y, q.z);
}
