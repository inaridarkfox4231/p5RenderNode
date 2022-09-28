// 立体とライティング

// aVertexColorとuMonoColorがvec4だったのでvec3に修正。何でvec4にしたのやら...

// ああー－－－致命的なミス！view行列の計算で視点(eye)が原点に来るような平行移動するの忘れてたよ。これはどうするかというと、
// 結局直交変換と平行移動の組み合わせなんだけど、点の移動を考えると分かるように、
// 最初の変換だけだと軸を取り換えただけなのです。要するに軸の取り換えなんですけど。そのあとeyeが原点に来るように平行移動する。
// これを逆にすると回転の行列に左から平行移動の転置を掛ける形になる。計算するとあんな風に-eyeが12,13,14に並ぶというわけ。
// これで合ってると思う...！

// モデルビューでいじるのはあくまでも頂点情報なのよね。だから、0,0,0,100,0,0,100,100,0,0,100,0の正方形を、
// その重心で回すみたいなことはできないわけ。それは頂点情報自体をいじらないと無理。それか最初から-50とか50とかで
// 重心が中心に来るようにするしかないのよね。仕組みを考えれば明らか。

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.

let tf, cam;

// ------------------------------------------------------------------------------------------------------------ //
// shaders.

// 現時点でのライティング。
let lightVert=
"precision mediump float;" +

"attribute vec3 aPosition;" +
"attribute vec3 aVertexColor;" +
"attribute vec3 aNormal;" +
"attribute vec2 aTexCoord;" +

"uniform vec3 uAmbientColor;" +

"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"uniform mat3 uNormalMatrix;" + // あーこれまだ作ってない...な...uMVの逆転置行列だそうです。スケール変換無いならもっと楽。まんま。

"varying vec3 vVertexColor;" +
"varying vec3 vNormal;" +
"varying vec3 vViewPosition;" +
"varying vec3 vAmbientColor;" +
"varying vec2 vTexCoord;" +

"void main(void){" +
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
"  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);" +

  // Pass varyings to fragment shader
"  vViewPosition = viewModelPosition.xyz;" +
"  gl_Position = uProjectionMatrix * viewModelPosition;" +

"  vNormal = uNormalMatrix * aNormal;" +
"  vVertexColor = aVertexColor;" +
"  vTexCoord = aTexCoord;" +

"  vAmbientColor = uAmbientColor;" +
"}";

let lightFrag =
"precision mediump float;" +

"uniform mat4 uViewMatrix;" +
// directionalLight関連
"uniform vec3 uLightingDirection;" +
"uniform vec3 uDirectionalDiffuseColor;" +
"uniform vec3 uPointLightLocation;" +
"uniform vec3 uPointLightDiffuseColor;" +
"uniform vec3 uAttenuation;" + // デフォルトは1,0,0.
// pointLight関連
"uniform bool uUseDirectionalLight;" + // デフォルトはfalse.
"uniform bool uUsePointLight;" + // デフォルトはfalse;

"const float diffuseFactor = 0.73;" +
"const int USE_VERTEX_COLOR = 0;" +
"const int USE_MONO_COLOR = 1;" +
"const int USE_UV_COLOR = 2;" + // そのうち。

"uniform int uUseColorFlag;" + // 0:vertex. 1:mono. 2:UV
"uniform vec3 uMonoColor;" + // monoColorの場合
"uniform sampler2D uTex;" + // uvColorの場合

"varying vec3 vVertexColor;" +
"varying vec3 vNormal;" +
"varying vec3 vViewPosition;" +
"varying vec3 vAmbientColor;" +
"varying vec2 vTexCoord;" + // テクスチャ

// DirectionalLight項の計算。
"vec3 getDirectionalLightDiffuseColor(vec3 normal){" +
"  vec3 lightVector = (uViewMatrix * vec4(uLightingDirection, 0.0)).xyz;" +
"  vec3 lightDir = normalize(lightVector);" +
"  vec3 lightColor = uDirectionalDiffuseColor;" +
"  float diffuse = max(0.0, dot(-lightDir, normal));" +
"  return diffuse * lightColor;" +
"}" +
// PointLight項の計算。attenuationも考慮。
"vec3 getPointLightDiffuseColor(vec3 modelPosition, vec3 normal){" +
"  vec3 lightPosition = (uViewMatrix * vec4(uPointLightLocation, 1.0)).xyz;" +
"  vec3 lightVector = modelPosition - lightPosition;" +
"  vec3 lightDir = normalize(lightVector);" +
"  float lightDistance = length(lightVector); " +
"  float d = lightDistance;" +
"  float lightFallOff = 1.0 / dot(uAttenuation, vec3(1.0, d, d*d));" +
"  vec3 lightColor = lightFallOff * uPointLightDiffuseColor;" +
"  float diffuse = max(0.0, dot(-lightDir, normal));" +
"  return diffuse * lightColor;" +
"}" +
// _lightはこれで。
"vec3 totalLight(vec3 modelPosition, vec3 normal){" +
"  vec3 result = vec3(0.0);" + // 0.0で初期化
// directionalLightの影響を加味する
"  if(uUseDirectionalLight){" +
"    result += getDirectionalLightDiffuseColor(normal);" +
"  }" +
// pointLightの影響を加味する
"  if(uUsePointLight){" +
"    result += getPointLightDiffuseColor(modelPosition, normal);" +
"  }" +
"  result *= diffuseFactor;" +
"  return result;" +
"}" +
// include lighting.glsl

// メインコード
"void main(void){" +
"  vec3 diffuse = totalLight(vViewPosition, normalize(vNormal));" +
"  vec4 col = vec4(1.0);" +

"  if(uUseColorFlag == USE_VERTEX_COLOR){" +
"    col.rgb = vVertexColor;" + // 頂点色
"  }" +
"  if(uUseColorFlag == USE_MONO_COLOR) {" +
"    col.rgb = uMonoColor;" +  // uMonoColor単色
"  }" +
"  if(uUseColorFlag == USE_UV_COLOR){" +
"    vec2 tex = vTexCoord;" +
"    tex.y = 1.0 - tex.y;" +
"    col = texture2D(uTex, tex);" +
"    if(col.a < 0.1){ discard; }" +
"  }" +
  // diffuseの分にambient成分を足してrgbに掛けて色を出してspecular成分を足して完成みたいな（？？）
"  col.rgb *= (diffuse + vAmbientColor);" +
"  gl_FragColor = col;" +
"}";

// ------------------------------------------------------------------------------------------------------------ //
// main code.

function setup(){
  createCanvas(800, 640, WEBGL);
  const _gl = this._renderer;
  _node = new ex.RenderNode(_gl);
  tf = new ex.TransformEx();
  cam = new ex.CameraEx(width, height);

  // んで...
  let meshData = [];
  let vData = [0,0,0, 100,0,0, 100,100,0, 0,100,0];
  meshData.push({name:"aPosition", size:3, data:vData});
  let cData = [1,1,1, 1,0,0, 0,1,0, 0,0,1];
  meshData.push({name:"aVertexColor", size:3, data:cData});
  let nData = [0,0,1, 0,0,1, 0,0,1, 0,0,1];
  meshData.push({name:"aNormal", size:3, data:nData});
  let fData = [0,1,2, 0,2,3];

  _node.registFigure("plane", meshData);
  _node.registPainter("light", lightVert, lightFrag);
  _node.registIBO("planeIBO", {data:fData});

  // さらに...
  meshData = [];
  vData = [-100,-100,100,  100,-100,100,  100,100,100,  -100,100,100,
           -100,-100,-100, 100,-100,-100, 100,100,-100, -100,100,-100];
  meshData.push({name:"aPosition", size:3, data:vData});
  cData = [1,1,1, 1,0,0, 0,1,0, 0,0,1, 1,1,1, 1,0,0, 0,1,0, 0,0,1];
  meshData.push({name:"aVertexColor", size:3, data:cData});
  fData = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  nData = ex.getNormals(vData, fData);
  meshData.push({name:"aNormal", size:3, data:nData});

  _node.registFigure("cube", meshData);
  _node.registIBO("cubeIBO", {data:fData});

  // こんな感じ？

  _node.clearColor(0, 0, 0, 1);
}

// やること
// 行列ユニフォーム一通り
// ライティングユニフォーム一通り
// 彩色方法指定（単色、頂点色、UV）
// ドローコール
// おわり。サクサク行こう。
function draw(){
  _node.clear();

  // ライティングシェーダ、オン！
  _node.usePainter("light");

  // 射影
  const projMat = cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);

  // ライティングユニフォーム
  _node.setUniform("uAmbientColor", [0.25, 0.25, 0.25]);
  _node.setUniform("uUseDirectionalLight", true);
  _node.setUniform("uLightingDirection", [0, 0, -1]);
  _node.setUniform("uDirectionalDiffuseColor", [1, 1, 1]);

  // 彩色方法指定（頂点色）
  _node.setUniform("uUseColorFlag", 0);

  // 平面（動かす、属性バインド、IBOバインド、ドローコール）
  movePlane();
  _node.drawFigure("plane");
  _node.bindIBO("planeIBO");
  _node.drawElements("triangles");

  // キューブ（動かす、属性バインド、IBOバインド、ドローコール）
  moveCube();
  _node.drawFigure("cube");
  _node.bindIBO("cubeIBO");
  _node.drawElements("triangles");

  _node.unbind();
  _node.flush();
}

// 行列関連はまとめとこうか
function setModelView(){
  const modelMat = tf.getModelMat().m;
  const viewMat = cam.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  const normalMat = ex.getNormalMat(modelViewMat);
  _node.setUniform("uViewMatrix", viewMat);
  _node.setUniform("uModelViewMatrix", modelViewMat);
  _node.setUniform("uNormalMatrix", normalMat);
}

// 平面のtf
function movePlane(){
  tf.initialize()
    .translate(100, 100, 0)
    .rotateZ(frameCount*TAU/120);
  setModelView();
}

// キューブのtf
function moveCube(){
  tf.initialize()
    .scale(0.5, 0.5, 0.5)
    .translate(-100,-100,0)
    .rotateX(frameCount*TAU/240)
    .rotateY(frameCount*TAU/240);
  setModelView();
}
