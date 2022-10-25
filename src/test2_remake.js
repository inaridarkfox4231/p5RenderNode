// 立体とライティング

// webgl2で書き直し。ちょっとやりたいことができたのです。
// これ：https://twitter.com/incre_ment/status/1574569987196350464

// とはいえまあとりあえずこれはこれで。

// カリング理解しました。なるほど。
// そういうことみたいです。法線計算が、結局あれほぼp5jsのコピペですけど、時計回り定義に、つまり
// BACK指定に対応してて。それで法線の向きが逆になっちゃってたらしいです。それを修正しました。
// なのでちゃんと背面カリングした場合に反時計回りに指定すれば前面だけ描画されます。よかった！
// 信じられないなぁ...
// なのでこれからはちゃんと反時計回り、お願いしますね...

// normalMatrixを外で作らないことになったので修正
// timerが変わりました。scaleを1000でデフォルト指定するとgetDeltaで秒数がサクッと入手出来ます
// setで現在時刻をstump出来るのは従来通りです。

// 20221025
// はい。
// NDCの計算間違ってる。おかしい。計算これで合ってるんじゃないの...？？？
// まあ、とにかくこれを何とかしよう。でないと前に進めない。
// ばかだなぁ
// viewは4x4ですよぉ

// Camera拡張機能付けたので確認します。（完全に、とはいかないけれど。）
// NDCのテストに成功しました。次。
// frustumOK.間違えてるのはOrthoだけ。どういうこと...

// ごめんなさい
// OrthoはView座標、関係なかったですね。zが。錐体ならz=1の場合のx,yに対してzをいじるとx,yはz倍で出せるけど
// Orthoはいじる必要ないです。そのままzに変えるだけ。なんだよもう！
// Ortho慣れたいというか、lil使いたいです。あれを整備しないとめんどくさくて仕方ないわ。lilでいろいろいじれたら便利なので。
// 先に整備するかな...

// とりあえずテストは成功です。

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.

let tf, cam;
const _timer = new ex.Timer();

// ------------------------------------------------------------------------------------------------------------ //
// shaders.

// 現時点でのライティング。
const lightVert =
`#version 300 es
in vec3 aPosition;
in vec3 aVertexColor;
in vec3 aNormal;
in vec2 aTexCoord;

uniform vec3 uAmbientColor;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
//uniform mat3 uNormalMatrix; // あーこれまだ作ってない...な...uMVの逆転置行列だそうです。

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec3 vAmbientColor;
out vec2 vTexCoord;

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
  normalMatrix = inverse(transpose(normalMatrix)); // これでいい。今回は全部いじらないのであんま意味ないが...

  vNormal = normalMatrix * aNormal;
  vVertexColor = aVertexColor;
  vTexCoord = aTexCoord;

  vAmbientColor = uAmbientColor;
}
`;

// なんかね、lightFragはmediumpにしないといけない...？
// 富士山に雪降らせるやつでlightのやつhighpにしたらおかしくなった。
// 何でもかんでもhighpにすればいいってわけじゃないみたいです。
// って思ったけどレイマのライティングはいいんよね...んー。まあ臨機応変で...
// とりまmediumpで。
const lightFrag =
`#version 300 es
precision mediump float;
// ビュー行列
uniform mat4 uViewMatrix;
// directionalLight関連
uniform vec3 uLightingDirection;
uniform vec3 uDirectionalDiffuseColor;
uniform vec3 uPointLightLocation;
uniform vec3 uPointLightDiffuseColor;
uniform vec3 uAttenuation; // デフォルトは1,0,0.
// pointLight関連
uniform bool uUseDirectionalLight; // デフォルトはfalse.
uniform bool uUsePointLight; // デフォルトはfalse;
// 描画フラグ各種
const float diffuseFactor = 0.73;
const int USE_VERTEX_COLOR = 0;
const int USE_MONO_COLOR = 1;
const int USE_UV_COLOR = 2; // そのうち。

uniform int uUseColorFlag; // 0:vertex. 1:mono. 2:UV
uniform vec3 uMonoColor; // monoColorの場合
uniform sampler2D uTex; // uvColorの場合

in vec3 vVertexColor;
in vec3 vNormal;
in vec3 vViewPosition;
in vec3 vAmbientColor;
in vec2 vTexCoord; // テクスチャ

out vec4 fragColor; // 出力。

// DirectionalLight項の計算。
vec3 getDirectionalLightDiffuseColor(vec3 normal){
  vec3 lightVector = (uViewMatrix * vec4(uLightingDirection, 0.0)).xyz;
  vec3 lightDir = normalize(lightVector);
  vec3 lightColor = uDirectionalDiffuseColor;
  float diffuse = max(0.0, dot(-lightDir, normal));
  return diffuse * lightColor;
}
// PointLight項の計算。attenuationも考慮。
vec3 getPointLightDiffuseColor(vec3 modelPosition, vec3 normal){
  vec3 lightPosition = (uViewMatrix * vec4(uPointLightLocation, 1.0)).xyz;
  vec3 lightVector = modelPosition - lightPosition;
  vec3 lightDir = normalize(lightVector);
  float lightDistance = length(lightVector);
  float d = lightDistance;
  float lightFallOff = 1.0 / dot(uAttenuation, vec3(1.0, d, d*d));
  vec3 lightColor = lightFallOff * uPointLightDiffuseColor;
  float diffuse = max(0.0, dot(-lightDir, normal));
  return diffuse * lightColor;
}
// _lightはこれで。
vec3 totalLight(vec3 modelPosition, vec3 normal){
  vec3 result = vec3(0.0); // 0.0で初期化
// directionalLightの影響を加味する
  if(uUseDirectionalLight){
    result += getDirectionalLightDiffuseColor(normal);
  }
// pointLightの影響を加味する
  if(uUsePointLight){
    result += getPointLightDiffuseColor(modelPosition, normal);
  }
  result *= diffuseFactor;
  return result;
}
// include lighting.glsl

// メインコード
void main(void){
  vec3 diffuse = totalLight(vViewPosition, normalize(vNormal));
  vec4 col = vec4(1.0);

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
  // diffuseの分にambient成分を足してrgbに掛けて色を出してspecular成分を足して完成みたいな（？？）
  col.rgb *= (diffuse + vAmbientColor);
  fragColor = col;
}
`;

// ------------------------------------------------------------------------------------------------------------ //
// main code.

function setup(){
  createCanvas(800, 640, WEBGL);
  _timer.initialize("slot0"); // 秒数を用いる
  const gl = this._renderer.GL;
  _node = new ex.RenderNode(gl);
  tf = new ex.TransformEx();
  //cam = new ex.CameraEx(width, height);
  cam = new ex.CameraEx({w:width, h:height});

  // lightingShader.
  _node.registPainter("light", lightVert, lightFrag);


  // キューブメッシュ（頂点のインデックスはbackにならって上から見て時計回り）
  // こういうの作ると便利よ。テクスチャ貼るのも楽になるし。
  //       4 --- 5
  //       │     │
  // 4 --- 0 --- 1 --- 5 --- 4
  // │     │     │     │     │
  // 7 --- 3 --- 2 --- 6 --- 7
  //       │     │
  //       7 --- 6
  meshData = [];
  let vData = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1,
               -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  meshData.push({name:"aPosition", size:3, data:vData});
  let cData = [];
  for(let i=0; i<8; i++){
    if(i<4){ cData.push(1, 1, 1); }else{ cData.push(0, 0.5, 1); }
  }
  meshData.push({name:"aVertexColor", size:3, data:cData});
  let fData = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  let nData = ex.getNormals(vData, fData);
  meshData.push({name:"aNormal", size:3, data:nData});

  _node.registFigure("cube", meshData);
  _node.registIBO("cubeIBO", {data:fData});

  // こんな感じ？

  _node.clearColor(0, 0, 0, 1);

  // ちょっとカリング有効にしますね
  _node.enable("cull_face");
  // 理解しました。

  // NDCのテストをします
  _node.registTexture("NDCtest", {src:(function(){
    const gr = createGraphics(width, height);
    gr.textSize(16);
    gr.textAlign(LEFT, TOP);
    gr.noStroke();
    return gr;
  })()});

  cam.setOrtho();
  //cam.setFrustum();
  //cam.setOrtho({left:-400, right:400, bottom:-320, top:320, near:0.01, far:4});
}

// やること
// 行列ユニフォーム一通り
// ライティングユニフォーム一通り
// 彩色方法指定（単色、頂点色、UV）
// ドローコール
// おわり。サクサク行こう。
function draw(){
  const currentTime = _timer.getDelta("slot0");

  _node.clear();

  // ライティングシェーダ、オン！
  _node.usePainter("light");

  // 射影
  //const projMat = cam.getProjMat().m;
  const projMat = cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);

  // ライティングユニフォーム
  _node.setUniform("uAmbientColor", [0.25, 0.25, 0.25]);
  _node.setUniform("uUseDirectionalLight", true);
  _node.setUniform("uLightingDirection", [0, 0, -1]); // ここは、合ってるんですよ。
  _node.setUniform("uDirectionalDiffuseColor", [1, 1, 1]);

  // 彩色方法指定（頂点色）
  _node.setUniform("uUseColorFlag", 0);

  // キューブ（動かす、属性バインド、IBOバインド、ドローコール）
  _node.drawFigure("cube");
  _node.bindIBO("cubeIBO");

  moveCube(currentTime);
  _node.drawElements("triangles");
  const t = currentTime * 0.5;
  const p = new ex.Vec3(100*sin(3*t), 100*sin(5*t), 100*sin(7*t));
  // このpに対してマウス位置から出したNDCと合わせてマウス位置にNDCが来るグローバルの位置を出して
  // x,y,zを抽出してCubeを配置。
  const mx = 2.0 * mouseX/width - 1.0;
  const my = -(2.0 * mouseY/height - 1.0);
  const q = cam.getParallelPosition(p, mx, my);
  staticCube(q.x, q.y, q.z);
  _node.drawElements("triangles");

  _node.unbind();

  showInfo(currentTime);

  _node.flush();
}

// 行列関連はまとめとこうか
function setModelView(){
  const modelMat = tf.getModelMat().m;
  //const viewMat = cam.getViewMat().m;
  const viewMat = cam.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  //const normalMat = ex.getNormalMat(modelViewMat);
  _node.setUniform("uViewMatrix", viewMat);
  _node.setUniform("uModelViewMatrix", modelViewMat);
  //_node.setUniform("uNormalMatrix", normalMat);
}

// キューブのtf
// これも同じことで、この場合特定の場所で重心を中心に回転させたいわけだが、点集合で考えれば
// 回転してから然るべくtranslate,となるから、それを逆回ししただけ。さらにスケール変換...？これ最後なのでは...？
function moveCube(currentTime){
  const t = currentTime * 0.5;
  tf.initialize()
    .translate(100*sin(3*t), 100*sin(5*t), 100*sin(7*t))
    .rotateZ(Math.PI*currentTime)
    .rotateX(Math.PI*currentTime)
    .scale(25, 25, 25); // うん。最後だわ。ごめーん。
  setModelView();
}

function staticCube(x, y, z){
  tf.initialize()
    .translate(x, y, z)
    .scale(25, 25, 25); // うん。最後だわ。ごめーん。
  setModelView();
}

function showInfo(currentTime){
  const gr = _node.getTextureSource("NDCtest");
  gr.fill(255);
  gr.clear();
  gr.text("hello!", 5, 5);
  // じゃあまず...
  const t = currentTime * 0.5;
  const p = new ex.Vec3(100*sin(3*t), 100*sin(5*t), 100*sin(7*t));
  // このpに対してNDCを出してそこにcircleをおいてみよう
  const ndc = cam.getNDC(p);
  gr.fill(255, 128, 0);
  gr.circle(width * (ndc.x*0.5 + 0.5), height * (0.5 - 0.5*ndc.y), 16);
  _node.updateTexture("NDCtest");
  ex.copyPainter(_node, {src:{name:"NDCtest"}});
}
