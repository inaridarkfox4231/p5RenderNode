// MRTピッキング。やるぜ。
// コピペ。
// pickは0番に据える。でないとreadPixelsで読み出せない。

// 全部OKです。すげぇな。
// MRTすげぇ
// ていうかどんなエラーが出るかと期待してたのに凡ミス2個とかまじかよ。手ごたえ無いな～～
// ちゃんと0番にpicker据えたのでそこから読みだされていますね。
// 0～1指定は保留で。
// いや...すご...すごー...
// ほんとに1回しかレンダリングしてない...！すごい！！

// global
const ex = p5wgex;
let _node;

let spoit = new Uint8Array(4*1*1);

let cam;
const tf = new ex.TransformEx();

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

out vec3 vPickColor;

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);

  // Pass varyings to fragment shader
  vViewPosition = viewModelPosition.xyz;
  gl_Position = uProjectionMatrix * viewModelPosition;

  mat3 normalMatrix; // こうしよう。[0]で列ベクトルにアクセス。
  normalMatrix[0] = uModelViewMatrix[0].xyz;
  normalMatrix[1] = uModelViewMatrix[1].xyz;
  normalMatrix[2] = uModelViewMatrix[2].xyz;
  normalMatrix = inverse(transpose(normalMatrix)); // これでいい。

  vNormal = normalMatrix * aNormal;
  vVertexColor = aVertexColor;
  vTexCoord = aTexCoord;

  vPickColor = uPickColor;
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

in vec3 vPickColor; // これをMRTで出力する。

layout (location = 0) out vec4 pickColor; // ピッキング用出力。
layout (location = 1) out vec4 fragColor; // 色出力。

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

  pickColor = vec4(vPickColor, 1.0); // これを追加するだけ。

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
  fragColor = col;
}
`;

// setup
function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // z軸上向きが天井、x=10, z=5が視点。中心向き。
  cam = new ex.CameraEx({
    w:10, h:8, top:[0, 0, 1], eye:[10, 0, 5],
    proj:{near:0.1, far:5}, ortho:{left:-5, right:5, bottom:-4, top:4, near:0, far:5}
  });

  _node.registPainter("light", lightVert, lightFrag);
  //_node.registPainter("pick", lightVert, pickFrag);

  const cubePosition = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1, -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  const cubeFaces = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  const cubeNormals = ex.getNormals(cubePosition, cubeFaces);
  _node.registFigure("cube", [
    {name:"aPosition", size:3, data:cubePosition},
    {name:"aNormal", size:3, data:cubeNormals}
  ]);
  _node.registIBO("cubeIBO", {data:cubeFaces});

  // picking用
  //_node.registFBO("pick", {w:800, h:640}); // これでcolorのRGBAになる。
  //_node.bindFBO("pick").clearColor(0,0,0,0).clear().bindFBO(null);

  // MRT用意。どっちも普通の色でOK.
  const {w, h} = _node.getDrawingBufferSize(null);
  _node.registFBO("picker", {w:w, h:h, color:{info:[{}, {}]}});

  // じゃあいつものinfoよろしくね
  const gr = createGraphics(800, 640); gr.noStroke(); gr.fill(255);
  gr.textSize(16);
  _node.registTexture("info", {src:gr});
}

function draw(){
  _node.bindFBO(null).clearColor(0,0,0,1).clear();

  // まず普通に3つ描く感じで
  _node.bindFBO("picker").clearColor(0,0,0,0).clear();;
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

  // readPixelsでマウス位置の色を取得
  // 0.5を足せば640から引いてもOK
  const mx = (Math.max(0, Math.min(mouseX, 800)) + 0.5)/800;
  const my = 1.0 - (Math.max(0, Math.min(mouseY, 640)) + 0.5)/640;
  const {w, h} = _node.getDrawingBufferSize("picker");
  _node.readPixels(mx*w, my*h, 1, 1, "rgba", "ubyte", spoit);

  // おわったので
  _node.bindFBO(null);

  // 色表示
  const gr = _node.getTextureSource("info");
  gr.clear();
  gr.textAlign(CENTER, CENTER);
  if(spoit[3] > 0){
    gr.text("(" + spoit[0] + ", " + spoit[1] + ", " + spoit[2] + ")", width/2, height*7/8);
  }else{
    gr.text("立方体が選択されていません", width/2, height*7/8);
  }
  // attr情報も書いちゃおう
  const lightInfo = _node.getAttrInfo("light"); // パソコンでもスマホでも4つ
  //const pickInfo = _node.getAttrInfo("pick"); // パソコンだと4つ全部。スマホだとaPositionしか出てこない。1つ。
  gr.textAlign(LEFT, TOP);
  // 使いやすいtextの方で情報開示しましょう。
  gr.text(lightInfo.text, 5, 5);
  _node.updateTexture("info");

  // 最終描画。pickerの1, 次いでinfo.
  ex.copyPainter(_node, {src:{type:"fb", name:"picker", index:1}}); // 色が入ってるのは1の方。
  ex.copyPainter(_node, {src:{name:"info"}});

  _node.flush();
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
  _node.setUniform("uPickColor", [r/255.0, g/255.0, b/255.0])
       .drawElements("triangles");
}

function setCube2(x, y, z, r, g, b){
  tf.initialize().translate(x, y, z).rotateZ(0.3);
  const modelMat = tf.getModelMat().m;
  const viewMat = cam.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  _node.setUniform("uModelViewMatrix", modelViewMat);
  _node.setUniform("uPickColor", [r/255.0, g/255.0, b/255.0])
       .drawElements("triangles");
}

function moveCamera(){
  if(keyIsDown(RIGHT_ARROW)){ cam.spin(0.03); }
  if(keyIsDown(LEFT_ARROW)){ cam.spin(-0.03); }
  if(keyIsDown(UP_ARROW)){ cam.arise(0.04); } // 上
  if(keyIsDown(DOWN_ARROW)){ cam.arise(-0.04); } // 下
}
