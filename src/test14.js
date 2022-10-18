// というわけでカラーピッカー3Dバージョンです（おい）

// アウトライン
// 3つの立方体を描画（横一列）
// それぞれに別々のRGB値を付与
// 同じ描画を同じサイズのオフスクリーンに描画（別シェーダ）
// readPixelsを用いて色を取得することでピッキングとする
// （余裕があれば）選んでる間正方形の色を灰色にする
// 正方形はMonoColor単色
// 選んでるの情報はいつものinfo

// バカ。寄り道してたら3連休終わるぞ。しっかりしろよ。ブラクラに振り回されて自分を見失うなよ。
// あんな馬鹿げたの無視しろよ。無視！！！！！

// OK!

// MRT無いとめんどくさいね...Uniformいちいち付けたり外したり。これMRTしないと事実上不可能だわマジで。
// MRT素晴らしいね。早く実装したい。

// やっぱ上下逆で格納されてますね...ひっくり返さないとダメね...

// 露骨に640から引きました。いぇい！マウス値なら640でいいと思う。
// どうせMRTで書き直すんだからいいんだよ...

// 大量、でやるならまあ、個別に...ってなるでしょうね。で、まあ、id持たせるか、あるいはVertexID使って割り算で、
// uniformと照合して、色を落とす...のがいいと思う。

// global
const ex = p5wgex;
let _node;

let spoit = new Uint8Array(4*1*1);

let cam;
const tf = new ex.TransformEx();

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

uniform vec3 uPickColor;

out vec3 vVertexColor;
out vec3 vNormal;
out vec3 vViewPosition;
out vec3 vAmbientColor;
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

  vAmbientColor = uAmbientColor;

  vPickColor = uPickColor;
}
`;

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

in vec3 vPickColor;

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

// 色指定用。attributeを使う。
const pickFrag =
`#version 300 es
precision mediump float;
in vec3 vVertexColor;
in vec3 vNormal;
in vec3 vViewPosition;
in vec3 vAmbientColor;
in vec2 vTexCoord; // テクスチャ

in vec3 vPickColor; // これを落とす

out vec4 fragColor;
void main(){
  fragColor = vec4(vPickColor, 1.0); // こんだけ！
}
`;

// setup
function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  cam = new ex.CameraEx({
    w:10, h:8, top:[0, 0, 1], eye:[10, 0, 5],
    proj:{near:0.1, far:5}, ortho:{left:-5, right:5, bottom:-4, top:4, near:0, far:5}
  });

  _node.registPainter("light", lightVert, lightFrag);
  _node.registPainter("pick", lightVert, pickFrag);    // Good luck!!

  const cubePosition = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1, -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  const cubeFaces = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  const cubeNormals = ex.getNormals(cubePosition, cubeFaces);
  _node.registFigure("cube", [
    {name:"aPosition", size:3, data:cubePosition},
    {name:"aNormal", size:3, data:cubeNormals}
  ]);
  _node.registIBO("cubeIBO", {data:cubeFaces});

  // picking用
  _node.registFBO("pick", {w:800, h:640}); // これでcolorのRGBAになる。
  _node.bindFBO("pick").clearColor(0,0,0,0).clear().bindFBO(null);

  // じゃあいつものinfoよろしくね
  const gr = createGraphics(800, 640); gr.noStroke(); gr.fill(255);
  gr.textSize(16); gr.textAlign(CENTER, CENTER);
  _node.registTexture("info", {src:gr});

}

function draw(){
  // まず普通に3つ描く感じで

  _node.bindFBO(null).clearColor(0,0,0,1).clear()
       .usePainter("light");

  // 射影
  const projMat = cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);
  // ライティングユニフォーム
  const {front} = cam.getLocalAxes(); // frontから視線方向に光を当てる。
  _node.setUniform("uAmbientColor", [64.0/255.0, 64.0/255.0, 64.0/255.0]);
  _node.setUniform("uUseDirectionalLight", true);
  _node.setUniform("uLightingDirection", [-front.x, -front.y, -front.z]);
  _node.setUniform("uDirectionalDiffuseColor", [1, 1, 1]);
  // 彩色方法指定（単色）
  _node.setUniform("uUseColorFlag", 1);

  _node.drawFigure("cube")
       .bindIBO("cubeIBO");

  // あとはtfと色を変えて何回もレンダリングするだけ
  setCube(1, -3, 3, 64, 64, 192);
  setCube(0, 0, 0, 64, 192, 64);
  setCube(-1, 3, -3, 192, 64, 64);

  _node.bindFBO("pick").clearColor(0,0,0,0).clear()
       .usePainter("pick");

  // 射影
  _node.setUniform("uProjectionMatrix", projMat);
  // ライティングユニフォーム
  _node.setUniform("uAmbientColor", [64.0/255.0, 64.0/255.0, 64.0/255.0]); // 使わないが仕方なく放り込む...

  _node.drawFigure("cube")
       .bindIBO("cubeIBO");

  // あとはtfと色を変えて何回もレンダリングするだけ
  setCube2(1, -3, 3, 64, 64, 192);
  setCube2(0, 0, 0, 64, 192, 64);
  setCube2(-1, 3, -3, 192, 64, 64);

  // じゃあメインイベント
  const gl = this._renderer.GL;
  const mx = Math.max(0, Math.min(mouseX, 800));
  const my = Math.max(0, Math.min(mouseY, 640));
  gl.readPixels(mx, 640-my, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, spoit); // 露骨！！！！
  //if(frameCount%30==0){console.log(spoit[0], spoit[1], spoit[2], spoit[3]);}

  // じゃあ表示するか
  const gr = _node.getTextureSource("info");
  gr.clear();
  if(spoit[3] > 0){
    gr.text("(" + spoit[0] + ", " + spoit[1] + ", " + spoit[2] + ")", width/2, height*7/8);
  }else{
    gr.text("立方体が選択されていません", width/2, height*7/8);
  }
  _node.updateTexture("info");
  ex.copyProgram(_node, null, "info");

  _node.unbind().flush();
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
