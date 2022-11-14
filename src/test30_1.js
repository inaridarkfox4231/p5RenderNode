// ウサギのスキャンライン表現
// 影とかはもういいのでとりあえずスキャンライン
// 参考：https://zenn.dev/r_ngtm/books/shadergraph-cookbook/viewer/recipe-3d-scanline

// フォワードレンダリングテンプレート。
// modelを使う場合

const ex = p5wgex;
let _node;
const _timer = new ex.Timer();
let _cam;
const _tf = new ex.TransformEx();

// ----------------------------------------------- light ------------------------------------------------ //
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
uniform mat4 uProjMatrix;

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
  gl_Position = uProjMatrix * viewModelPosition;

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
function renderMesh(node, tf, cam, x, y, z, r, g, b){
  tf.initialize().translate(x, y, z);
  setModelView(node, tf, cam);
  node.setUniform("uMonoColor", [r, g, b])
      .drawElements("triangles");
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
    vc.push(col.r, col.g, col.b);
  }
  node.registFigure(name, [
    {name:"aPosition", size:3, data:v},
    {name:"aNormal", size:3, data:n},
    {name:"aVertexColor", size:3, data:vc},
    {name:"aTexCoord", size:2, data:uv}
  ]);
  node.registIBO(name + "IBO", {data:f}); // 一応。
}

// 雑。z軸に平行な平面。
function registPlane(node, name, left=-1, right=1, bottom=-1, top=1, height=0){
  const p0 = [left, bottom, height];
  const p1 = [right, bottom, height];
  const p2 = [left, top, height];
  const p3 = [right, top, height];
  const v = [p0, p1, p2, p3].flat();
  const uv = [0, 1, 1, 1, 0, 0, 1, 0];
  const f = [0, 1, 2, 2, 1, 3];
  const n = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  const vc = [1,1,1, 1,1,1, 1,1,1, 1,1,1]; // 真っ白
  node.registFigure(name, [
    {name:"aPosition", size:3, data:v},
    {name:"aNormal", size:3, data:n},
    {name:"aVertexColor", size:3, data:vc},
    {name:"aTexCoord", size:2, data:uv}
  ]);
  node.registIBO(name + "IBO", {data:f}); // 一応。
}

function registModel(node, model, name, size = 1, colorHue = 0){
  // rabbitModelからデータを取得したりする
  // verticesはベクトル3Dが入っててx,y,z成分を抜き出さないと無理
  // facesも各番号に長さ3の配列がもちろん入ってる
  // uvsは何にも入ってないけど内容的には[0,0]が延々と並んでる
  // vertexNormalsが法線でvertexColorsが色。
  // normalsは色々入ってるみたい。vertexColorsは死んでる。長さ0. 好きに使わせてもらおう。
  const N = model.vertices.length; // 4564.
  const F = model.faces.length;
  const v = new Array(N*3);
  const n = new Array(N*3);
  const vc = new Array(N*3);
  const uv = new Array(N*2);
  const f = new Array(F*3);
  // 続きは...
  for(let i=0; i<N; i++){
    const positions = model.vertices[i];
    v[3*i] = positions.x * size;
    v[3*i+1] = positions.y * size;
    v[3*i+2] = positions.z * size;
    const normals = model.vertexNormals[i];
    n[3*i] = normals.x;
    n[3*i+1] = normals.y;
    n[3*i+2] = normals.z;
    const col = ex.hsv2rgb(colorHue, 0.7, 1);
    vc[3*i] = col.r;
    vc[3*i+1] = col.g;
    vc[3*i+2] = col.b;
    uv[2*i] = 0;
    uv[2*i+1] = 0;
  }
  for(let i=0; i<F; i++){
    const faceIndices = model.faces[i];
    f[3*i] = faceIndices[0];
    f[3*i+1] = faceIndices[1];
    f[3*i+2] = faceIndices[2];
  }
  node.registFigure(name, [
    {name:"aPosition", size:3, data:v},
    {name:"aNormal", size:3, data:n},
    {name:"aVertexColor", size:3, data:vc},
    {name:"aTexCoord", size:2, data:uv}
  ]);
  node.registIBO(name + "IBO", {data:f, large:true}); // 一応。
}

// ------------------------------------- config -------------------------------- //
function moveCamera(cam, delta){
  cam.spin(delta * 0.6);
  const {eye} = cam.getViewData();
	if(keyIsDown(UP_ARROW)){ cam.arise(0.01); }
	else if(keyIsDown(DOWN_ARROW) && eye.z > 0.5){ cam.arise(-0.01); }
}

// ------------------------------------- preload -------------------------------- //

function preload(){
  rabbit = loadModel("https://inaridarkfox4231.github.io/models/bunnyYZ.obj");
}

// ------------------------------------- setup -------------------------------- //

function setup(){
  // timer.
  _timer.initialize("slot0");
  _timer.initialize("spinCam");

  // initialize.
  createCanvas(640, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // camera.
  _cam = new ex.CameraEx({w:width, h:height, top:[0, 0, 1], eye:[6, 6, 3], pers:{near:0.1, far:10}});

  // shaders. lightしか使わない。
  _node.registPainter("light", lightVert, lightFrag);

  // meshes.
  registCube(_node, "cube");
  registPlane(_node, "plane", -4, 4, -4, 4, 0);
  registModel(_node, rabbit, "rabbit", 5);

  // culling.
  _node.enable("cull_face");
}

// とりあえず描いちゃおう

function draw(){
  const _delta = _timer.getDelta("spinCam");
  _timer.set("spinCam");
  moveCamera(_cam, _delta); // カメラ動かそう

  _node.bindFBO(null).clearColor(0,0,0,1).clear();
  _node.usePainter("light");

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

  // 単色
  _node.setUniform("uUseColorFlag", 1);

  _node.drawFigure("plane").bindIBO("planeIBO");
  renderMesh(_node, _tf, _cam, 0,0,0,0,1,0);
  _node.drawFigure("rabbit").bindIBO("rabbitIBO");
  renderMesh(_node, _tf, _cam, 0,0,0,0.8,0.9,1);

  _node.unbind();

  _node.flush();
}
