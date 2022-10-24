// depthの可視化
// ディファードへの応用？...待って...

// いつものように光源と立方体
// 立方体は不規則に回転し続ける
// 頂点色
// マテリアルカラーと法線とデプスをそれぞれ出力
// copyShaderで可視化
// ついでに全体の結果も可視化
// 以上。

// EとDでドリー、これはカメラを近づけたり離したりする。
// まあいいでしょう。

// MIPMAPが作成されない謎のエラーについてはまた今度考えます。
// copyPainterのグレードアップ（複数対応）の方が先
// vertex増やせば簡単にできる。ついでに簡単なレイヤー機能も実装するか。簡単なblend機能付けてもいい。

const ex = p5wgex;
let _node;
let cam;
const tf = new ex.TransformEx();
let _timer = new ex.Timer();

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

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

uniform vec3 uPickColor;

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vTexCoord;

out float vDepth;

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

  vDepth = 0.5 * (NDcoord.z + 1.0);
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

// light flag.
//uniform bool uUseDirectionalLight; // デフォルトはfalse.
//uniform bool uUsePointLight; // デフォルトはfalse;
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

in float vDepth;

layout (location = 0) out vec4 materialColor; // 今回は頂点色
layout (location = 1) out vec4 normalColor; // 法線
layout (location = 2) out vec4 depthColor; // デプス
layout (location = 3) out vec4 finalColor;

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
void applyDirectionalLightDiffuseColor(vec3 direction, vec3 diffuseColor, vec3 specularColor,
                                       vec3 modelPosition, vec3 normal, out vec3 diffuse, out vec3 specular){
  vec3 viewDirection = normalize(-modelPosition);
  vec3 lightVector = (uViewMatrix * vec4(direction, 0.0)).xyz;
  vec3 lightDir = normalize(lightVector);
  vec3 lightColor = diffuseColor;
  // 色計算
  float diffuseFactor = lambertDiffuse(lightDir, normal);
  diffuse += diffuseFactor * lightColor; // diffuse成分を足す。
  if(uUseSpecular){
    float specularFactor = phongSpecular(lightDir, viewDirection, normal);
    specular += specularFactor * lightColor * specularColor;
  }
}

// PointLight項の計算。attenuationも考慮。
void applyPointLightDiffuseColor(vec3 location, vec3 diffuseColor, vec3 specularColor,
                                 vec3 modelPosition, vec3 normal, out vec3 diffuse, out vec3 specular){
  vec3 viewDirection = normalize(-modelPosition);
  vec3 lightPosition = (uViewMatrix * vec4(location, 1.0)).xyz;
  vec3 lightVector = modelPosition - lightPosition;
  vec3 lightDir = normalize(lightVector);
  float lightDistance = length(lightVector);
  float d = lightDistance;
  float lightFallOff = 1.0 / dot(uAttenuation, vec3(1.0, d, d*d));
  // 色計算
  vec3 lightColor = lightFallOff * diffuseColor;
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
    applyDirectionalLightDiffuseColor(uLightingDirection[i], uDirectionalDiffuseColor[i], uDirectionalSpecularColor[i],
                                      modelPosition, normal, diffuse, specular);
  }
  // pointLightの影響を加味する
  for(int i=0; i<uPointLightCount; i++){
    applyPointLightDiffuseColor(uPointLightLocation[i], uPointLightDiffuseColor[i], uPointLightSpecularColor[i],
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

  normalColor = vec4(vNormal, 1.0);
  depthColor = vec4(vDepth);

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

  materialColor = col;

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


function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  _timer.initialize("slot0");

  // z軸上向きが天井、x=10, z=5が視点。中心向き。
  cam = new ex.CameraEx({
    w:10, h:8, top:[0, 0, 1], eye:[4, 0, 5]
  });
  _node.registPainter("light", lightVert, lightFrag);

  const cubePosition = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1, -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  const cubeFaces = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  const cubeNormals = ex.getNormals(cubePosition, cubeFaces);
  _node.registFigure("cube", [
    {name:"aPosition", size:3, data:cubePosition},
    {name:"aNormal", size:3, data:cubeNormals}
  ]);
  _node.registIBO("cubeIBO", {data:cubeFaces});

  _node.registFBO("quad", {w:800, h:640, color:{info:[{}, {}, {}, {}]}});
}

function draw(){
  _node.bindFBO(null).clearColor(0,0,0,1).clear();

  render();

  // まとめて描画するとエラーになる
  // しかし解決しました（ログは末尾に記載）。PainterがすべてのtextureUnitをnullにできていなかったのが原因でした。
  // 申し訳なかったです。
  ex.copyPainter(_node, {src:[
    {type:"fb", name:"quad", index:0, view:{x:0, y:0, w:0.5, h:0.5}},
    {type:"fb", name:"quad", index:1, view:{x:0.5, y:0, w:0.5, h:0.5}},
    {type:"fb", name:"quad", index:2, view:{x:0, y:0.5, w:0.5, h:0.5}},
    {type:"fb", name:"quad", index:3, view:{x:0.5, y:0.5, w:0.5, h:0.5}}
  ]});

  _node.flush();
}

function render(){

  // まず普通に3つ描く感じで
  _node.bindFBO("quad");

  _node.clearColor(0,0,0,0).clear();
  _node.usePainter("light");

  moveCamera(); // カメラをいじってみよう

  // 射影（モードをいじらないならtfやcamとは区別されるため共通の処理となる）
  const projMat = cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);

  // ライティング整理した。すっきり！てかp5jsもこのくらいすっきりしてたらいいのにねぇ。
  setLight(_node, {useSpecular:true});
  const {front} = cam.getLocalAxes(); // frontから視線方向に光を当てる。
  setDirectionalLight(_node, {
    count:2,
    direction:[-front.x, -front.y, -front.z, 0, 0, -1],
    diffuseColor:[1, 1, 1, 1, 1, 1],
    specularColor:[0.5,1,1, 1, 0.5, 1]
  });
  setPointLight(_node, {
    count:2,
    location:[0,0,1.5, 3, 0, 1.5],
    diffuseColor:[1,1,1,1,1,1],
    specularColor:[1, 0.5, 1,1,0.5,1]
  });

  // 彩色方法指定（単色）
  _node.setUniform("uUseColorFlag", 1);
  _node.drawFigure("cube")
       .bindIBO("cubeIBO");
  // あとはtfと色を変えて何回もレンダリングするだけ
  setCube(1, -3, 3, 64, 64, 192);
  setCube(0, 0, 0, 64, 192, 64);
  setCube(-1, 3, -3, 192, 64, 64);

  _node.unbind();
}

// ライティング関連. これでいいと思う。nodeを引数に取らないと汎用性が死ぬ。
// diffuseは一応デフォfalseで。
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

function setDirectionalLight(node, info = {}){
  if(info.count === undefined){ info.count = 1; } // 使わないならそもそも呼び出すな
  if(info.direction === undefined){ info.direction = [0, 0, -1]; } // まあ、指定しようよ。
  if(info.diffuseColor === undefined){ info.diffuseColor = [1, 1, 1]; } // 白一色。
  if(info.specularColor === undefined){ info.specularColor = [1, 1, 1]; } // 白。
  // 2以上の場合は配列で長さを増やせばいい。
  node.setUniform("uDirectionalLightCount", info.count);
  node.setUniform("uLightingDirection", info.direction);
  node.setUniform("uDirectionalDiffuseColor", info.diffuseColor);
  node.setUniform("uDirectionalSpecularColor", info.specularColor);
}

function setPointLight(node, info = {}){
  if(info.count === undefined){ info.count = 1; } // 使わないならそもそも呼び出すな
  if(info.location === undefined){ info.location = [0, 0, 0]; } // これが未定義ならそもそもどうして利用するのか
  if(info.diffuseColor === undefined){ info.diffuseColor = [1, 1, 1]; } // 白一色。
  if(info.specularColor === undefined){ info.specularColor = [1, 1, 1]; } // 白。
  // 2以上の場合は配列で長さを増やせばいい。
  node.setUniform("uPointLightCount", info.count);
  node.setUniform("uPointLightLocation", info.location);
  node.setUniform("uPointLightDiffuseColor", info.diffuseColor);
  node.setUniform("uPointLightSpecularColor", info.specularColor);
}

// 行列関連はまとめとこうか
function setModelView(){
  const modelMat = tf.getModelMat().m;
  const viewMat = cam.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  _node.setUniform("uViewMatrix", viewMat);
  _node.setUniform("uModelViewMatrix", modelViewMat);
}

// cube~~~
function setCube(x, y, z, r, g, b){
  tf.initialize().translate(x, y, z).rotateZ(0.3);
  setModelView();
  _node.setUniform("uMonoColor", [r/255.0, g/255.0, b/255.0]);
  _node.drawElements("triangles");
}

function moveCamera(){
  if(keyIsDown(RIGHT_ARROW)){ cam.spin(0.03); }
  if(keyIsDown(LEFT_ARROW)){ cam.spin(-0.03); }
  if(keyIsDown(UP_ARROW)){ cam.arise(0.04); } // 上
  if(keyIsDown(DOWN_ARROW)){ cam.arise(-0.04); } // 下
  if(keyIsDown(69)){ cam.dolly(0.05); } // Eキー
  if(keyIsDown(68)){ cam.dolly(-0.05); } // Dキー
}

// エラーログ

// 個別に描画するとエラーにならない
// しかしなぜかひとつだけ実行するとエラーが発生しない（下の1回だけ）
// そして同じ見た目、ということは残り3つの描画には成功しているということ。どういうことだ...？？
// indexはいくつにしても一緒（3でもいい）
// だからここでしている何らかの処理が影響しているのだ。多分。
// 描画命令をスキップしても描画されるので描画云々は関係ないと思う
// 何らかの処理が原因でエラーが出ないようになっているのだ
// おそらく特定した...setTextureだ。これを「やらない」とエラーが発生する。
// 厳密には0番のtextureに
// だめだ
// これだけ実行してもだめだ。
// え？？unbindだけ？？だってこれ実行してるよ...？？なんで？？
// unbindの前でreturn → うざいエラー（formed loop active 云々）
// unbindの直後でreturn（何もしてない）→ エラーなし

// 0番テクスチャをセットしてunbind処理を行なったらエラーが出なくなった
// ということはMRTの場合に0番を最後にセットしてあれすればいい？
// いけました...つまりMRTの場合には、MRTかどうかはフラグを取得できるんだけど、
// MRTの場合には最後にbindしないといけないみたい。0番を。0番をセットしたうえで...
// ていうか0番がactiveである必要がある？0番をactiveTextureしたうえで0番テクスチャをbindしてそのあと
// unbindで...
// じゃああれか。unbindの方に「0番をactiveTextureしてください」ってお願いすれば足りる？
//ex.copyPainter(_node, {src:{view:{x:0, y:0, w:0.1, h:0.1}, type:"fb", name:"quad", index:0}});

// コメントアウトしてももうエラーは出ない
// スパゲティにならないようにきちんと見極めよう
// 変更は小さく、運用上の面倒が生じないようにしないといけない
// エラー全文：Feedback loop formed between Framebuffer and active Texture.
// あれをしない場合0番になんかtextureが入ったままになるのよね
// こないだ仕組み見たでしょ
// 0番でactiveTextureしてbindTextureでnull
// あれが無修正の場合最後にactiveになっている番号は（activeTextureIndexならわかりやすいのに！！！！）
// 3番
// しかしあれをやることで0番がactiveTextureされるのでこれで0番がからっぽに
// ていうか全部からっぽに出来ればいいのに

// ていうかtextureのunbindはPainterの仕事でしょ。で、PainterはいくつまでtextureIndexを使うのかの情報を持ってる。
// 職務怠慢！！！
// 全部からっぽにしろよ！

// activeTextureはgl.TEXTURE0が33984でそこから33984,33985,33986,33987,...
// gl.getParameter(gl.ACTIVE_TEXTURE)でそのときactiveになってるtextureIndexを取得できる
// 調べたら3番だった
// じゃあまあえーと...
// samplerIndexが存在するすべての（以下略）
// そういうことです
// 3番がactiveされた状態でbind-nullしても3番しかからっぽにならない
// 0番をactiveしないと0番をからっぽにできないということ
