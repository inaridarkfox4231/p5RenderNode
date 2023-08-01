// ジオメトリインスタンシングで
// 1331個の立方体を描画する


// フォワードレンダリングテンプレート。このまま残しておいて。
// 通常のメッシュの場合

// 方針
// Terrainのジオメトリーを移植
// vertexShaderの中で位置をいじる
// 法線もいじる
// 終了！
// 余裕があったらcopyPainterで背景設定
// 余裕があったら平面上になんかアニメーションを付与する

// というわけでまずはバーテックスシェーダでnoiseを使えるようにするのと
// detailed Planeを作るのが最初ですね～
// それ専用の改変シェーダが必要ですね
// 別に用意するかどうかがネックですが、
// ノイズ入れてる時点で別立て前提なので別名で用意した方がいいかと

// 2023-04-03
// monocolorとvertexColorをalpha込みの引数4つにしたうえで
// alphaの計算を正しく実行しましょう
// その方がいいと思う
// あとscaleも設定できるようにしたいですね

// 加えてorbitControlですね（マウスとスマホ両方）
// 流体の時のコードが参考になるはず。
// 一度でも経験しておくとそのときの知見を活かせるのでよいですね
// easyCamでいい気がしてきたな...とはいえあれp5の構造に癒着してるから
// こっちのシステムと整合性取るの無理があるのよね
// 情報取得して流用する？んー。
// そうなのよ
// p5の枠組みでやるならあれ使って終わりだしたとえば例のpointSpriteのやつとかはそれでいいんだけど
// p5wgexでそれやるのは無理だから
// ...
// 仕組み理解したうえで移植するしかないわね

// col.a < 0.1でdiscardはよくないですね...blendMode使わないと。

// 2023-04-04
// uMonoColorとaVertexColorをvec4にして
// textureの.a<0.1:discardをやめましたが
// うまくいくかどうかですね。

// 半透明のテストをしないといけないか...まあカリングとかいろいろやらないとだし。難しいわね。
// ライティングは基本的にalphaあんま使わないからね。うん。難しいと思う。2次元の方...

// 2023-07-27
// 1.7.0
// ですよ

// 2023-08-01
// orbitControl()導入
// これ使ってインスタンシングの作例作りたいのでよろしくね

const ex = p5wgex;
let _node;
const _timer = new ex.Timer();
let _cam, myCam;
const _tf = new ex.TransformEx();

// ----------------------------------------------- light ------------------------------------------------ //
// 現時点でのライティング。
// 場合によっては頂点テクスチャフェッチでModelを頂点の付属idかなんかから読み込んで
// まとめて位置を変換する場合もある。その場合ModelViewは不要でViewだけ放り込み、
// Modelと掛けて法線を出し、Projectionと掛けて正規化デバイスの位置を出す。
const lightVert =
`#version 300 es
in vec3 aPosition;
in vec4 aVertexColor;
in vec3 aNormal;
in vec2 aTexCoord;
in vec3 aShiftPosition;
in vec3 aShiftColor;
in vec2 aRotationSpeedXY;

uniform float uTime;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjMatrix;

out vec4 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec2 vTexCoord;

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
  vec3 p = aPosition;
  vec2 t = 6.28318 * uTime * aRotationSpeedXY;
  p *= mat3(1.0, 0.0, 0.0, 0.0, cos(t.x), -sin(t.x), 0.0, sin(t.x), cos(t.x));
  p *= mat3(-sin(t.y), 0.0, cos(t.y), 0.0, 1.0, 0.0, cos(t.y), 0.0, sin(t.y));
  p += aShiftPosition;
  vec4 viewModelPosition = uModelViewMatrix * vec4(p, 1.0);

  // Pass varyings to fragment shader
  vViewPosition = viewModelPosition.xyz;
  gl_Position = uProjMatrix * viewModelPosition;

  mat3 normalMatrix; // こうしよう。[0]で列ベクトルにアクセス。
  normalMatrix[0] = uModelViewMatrix[0].xyz;
  normalMatrix[1] = uModelViewMatrix[1].xyz;
  normalMatrix[2] = uModelViewMatrix[2].xyz;
  normalMatrix = inverse(transpose(normalMatrix)); // これでいい。

  vNormal = normalMatrix * aNormal;
  vVertexColor = aVertexColor * vec4(aShiftColor, 1.0);
  vTexCoord = aTexCoord;
}
`;

// とりまmediumpで。
const lightFrag =
`#version 300 es
precision highp float;

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
uniform vec4 uMonoColor; // monoColorの場合
uniform sampler2D uTex; // uvColorの場合

in vec4 vVertexColor;
in vec3 vNormal;
in vec3 vViewPosition;
in vec2 vTexCoord; // テクスチャ

// -------------------- その他 -------------------- //

out vec4 fragColor; // 出力。

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
  // 白。デフォルト。
  vec4 col = vec4(1.0);
  // マテリアルカラーの計算
  if(uUseColorFlag == USE_VERTEX_COLOR){
    col = vVertexColor; // 頂点色
  }
  if(uUseColorFlag == USE_MONO_COLOR) {
    col = uMonoColor;  // uMonoColor単色
  }
  if(uUseColorFlag == USE_UV_COLOR){
    vec2 tex = vTexCoord;
    tex.y = 1.0 - tex.y;
    col = texture(uTex, tex);
    //if(col.a < 0.1){ discard; }
  }
  // ライティングの計算
  // diffuseの分にambient成分を足してrgbに掛けて色を出してspecular成分を足して完成
  // この中でrgb関連の処理を実行しrgbをそれで置き換える。
  vec3 result = totalLight(vViewPosition, normalize(vNormal), col.rgb);

  // ディファードの場合、この計算前のcol(rgba)と、normal, vViewPosition, 場合によってはvTexCoordが
  // MRTで送られる対象になる。もしくはついでにデプスなど。doxasさんのサイトではこれらが可視化されていましたね。

  col.rgb = result;
  fragColor = col * vec4(vec3(col.a), 1.0); // alpha考慮...となるとblendModeも変えないとまずいわけだが。
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

// ----------------------------- rendering -------------------------------- //

// 行列関連はまとめとこうか
function setModelView(node, tf, cam){
  const modelMat = tf.getModelMat().m;
  const viewMat = cam.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  node.setUniform("uViewMatrix", viewMat)
      .setUniform("uModelViewMatrix", modelViewMat);
}

// render.
function renderMesh(node, tf, cam, x, y, z, r, g, b, sx = 1, sy = 1, sz = 1){
  tf.initialize().translate(x, y, z).scale(sx, sy, sz);
  setModelView(node, tf, cam);
  node.setUniform("uMonoColor", [r, g, b, 1])
      .drawElements("triangles");
}

function renderMeshInstanced(node, tf, cam, x, y, z, r, g, b, sx = 1, sy = 1, sz = 1){
  tf.initialize().translate(x, y, z).scale(sx, sy, sz);
  setModelView(node, tf, cam);
  node.setUniform("uMonoColor", [r, g, b, 1])
      .drawElementsInstanced("triangles", 1331);
}

// --------------------------- meshes ---------------------------------- //

// 立方体
function registCube(node, name, size = 1, hue = 0){
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
    vc.push(col.r, col.g, col.b, 1);
  }
  node.registFigure(name, [
    {name:"aPosition", size:3, data:v},
    {name:"aNormal", size:3, data:n},
    {name:"aVertexColor", size:4, data:vc},
    {name:"aTexCoord", size:2, data:uv}
  ]);
  node.registIBO(name + "IBO", {data:f}); // 一応。
}

function registCubes(node, name){
  const v=[-1,-1,-1, -1,1,-1, -1,-1,1, -1,1,1, // x-minus
           -1,-1,1, -1,1,1, 1,-1,1, 1,1,1, // z-plus
           1,-1,1, 1,1,1, 1,-1,-1, 1,1,-1, // x-plus
           1,-1,-1, 1,1,-1, -1,-1,-1, -1,1,-1, // z-minus
           -1,-1,-1, -1,-1,1, 1,-1,-1, 1,-1,1, // y-minus
           -1,1,1, -1,1,-1, 1,1,1, 1,1,-1] // y-plus.
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
    vc.push(1,1,1,1);
  }
  const shiftPositions = [];
  const shiftColors = [];
  const rotationSpeeds = [];
  for (let k=-5; k<5; k++){
    for(let l=-5; l<5; l++) {
      for(let m=-5; m<5; m++) {
        const x = m*5;
        const y = l*5;
        const z = k*5;
        shiftPositions.push(x, y, z);
        shiftColors.push(...ex.hsvArray((m+5)/11, (l+5)/11, 0.5 + (k+5)/22));
        rotationSpeeds.push((Math.random()<0.5?1:-1) * (0.1+0.5*Math.random()));
        rotationSpeeds.push((Math.random()<0.5?1:-1) * (0.1+0.5*Math.random()));
      }
    }
  }
  node.registFigure(name, [
    {name:"aPosition", size:3, data:v},
    {name:"aNormal", size:3, data:n},
    {name:"aVertexColor", size:4, data:vc},
    {name:"aTexCoord", size:2, data:uv},
    {name:"aShiftPosition", size:3, data:shiftPositions, divisor:1},
    {name:"aShiftColor", size:3, data:shiftColors, divisor:1},
    {name:"aRotationSpeedXY", size:2, data:rotationSpeeds, divisor:1}
  ]);
  node.registIBO(name + "IBO", {data:f}); // 一応。
}

// ------------------------------------- setup -------------------------------- //

function setup(){
  // timer.
  _timer.initialize("slot0");
  //_timer.initialize("spinCam");

  // initialize.
  createCanvas(640, 640, WEBGL);
  pixelDensity(1);
  _node = new ex.RenderNode(this._renderer.GL);

  // camera.
  _cam = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[4, 4, 2], pers:{near:0.1, far:1000}});
  myCam = createCamera();
  myCam.camera(4,4,2,0,0,0,0,0,1);
  myCam.perspective(Math.PI/3,width/height,0.1,1000);

  // shaders. lightしか使わない。
  _node.registPainter("light", lightVert, lightFrag);

  // meshes.
  //registCube(_node, "cube");
  registCubes(_node, "cubeInstanced");

  // info. フレームレート表示用
  _node.registTexture("info", {src:(function(){
    const gr = createGraphics(60, 25);
    gr.fill(255);
    gr.textStyle(ITALIC);
    gr.textSize(16);
    gr.textAlign(LEFT, TOP);
    return gr;
  })()});

  // culling.
  _node.enable("cull_face");
}

// とりあえず描いちゃおう

function draw(){
  //moveCamera(_cam, _delta); // カメラ動かそう
  orbitControl(1,1,1,{freeRotation:true});
  _cam.initialize({
    eye:[myCam.eyeX, myCam.eyeY, myCam.eyeZ],
    center:[myCam.centerX, myCam.centerY, myCam.centerZ],
    top:[myCam.upX, myCam.upY, myCam.upZ],
    pers:{fov:Math.PI/3, aspect:width/height, near:0.1, far:1000}
  });

  _node.bindFBO(null).clearColor(0,0,0,1).clear();
  _node.usePainter("light");
  _node.setUniform("uTime", _timer.getDelta("slot0"));

  // ブレンド処理はrgbにシェーダ内でalphaを掛けるやつで
  _node.enable("blend");
  _node.blendFunc("one", "one_minus_src_alpha");

  // 射影
  const projMat = _cam.getProjMat().m;
  _node.setUniform("uProjMatrix", projMat);

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

  // 頂点色
  _node.setUniform("uUseColorFlag", 0);

  _node.drawFigure("cubeInstanced").bindIBO("cubeInstancedIBO");
  //renderMesh(_node, _tf, _cam, 0,0,0, 0.8,0.8,0.8,       0.1, 0.1, 0.1);
  renderMeshInstanced(_node, _tf, _cam, 0,0,0,1,1,1,0.1,0.1,0.1);

  _node.unbind();

  // パフォーマンスを描画
  drawInfo();

  _node.flush();

  _node.disable("blend");
}

// ------------------------------------------------------------- //
// frameRate info.

// viewを制限することで小さいキャンバスも自由に表示できるようにする実験
function drawInfo(){
  const gr = _node.getTextureSource("info");
  gr.background(0);
  gr.text(frameRate().toFixed(2), 5, 5);
  _node.updateTexture("info");
  ex.copyPainter(_node, {src:{name:"info"}, view:[0, 0, gr.width/width, gr.height/height]});
}
