// depthをテクスチャとして設定して通常の計算方法と比較
// 何が入ってるのか見たい
// 急遽予定変更でlil.guiに慣れたいです
// 最終的にメソッド化して道具にする
// てか両方でいいのでは？

// 何かめんどくさくなってきたな...
// どうもdepth textureめんどくさいようなので保留。

// lil.guiに慣れよう！！というわけで。
// ライティングにlilを組み合わせてトーラスで実験するか。よし。（結局、そうなる...）

// lilってどうやって作るんだろうね...

// lil.GUIです。まあこんなもんか。
// いいね。文字列の場合は配列でやるとそのまま選択肢になるわけね。便利！
// 色関連でオブジェクトで渡すとちゃんとオブジェクトで取得できるのもいいね。

// しかも：https://openprocessing.org/sketch/1634150
// datのときの「セレクトボックスから整数を取得して===で判定するとエラーになる問題」が解消されてる！
// こりゃもうdat捨ててlil一択だわね...まあ、更新が止まるってそういうことなのよね。

const ex = p5wgex;
let _node;
const _tf = new ex.TransformEx();
let _cam;
const _timer = new ex.Timer();
let cloudImg; // シームレス雲

// 何を変える？んー...別にないけど...あー、テクスチャの種類を変えるとか？
// とりあえずスポットライトとかそこら辺使うか使わないか的なの。
const config = {
  useDirectionalLight:true,
  usePointLight:true,
  useSpotLight:true,
  specular:true,
  torusColor: {r:0.3, g:0.7, b:0.4}, // 単色トーラスの色
  xCoord:0, // トーラスの位置(-3～3)
  yCoord:0, // (-3～3)
  zCoord:1.5, // (-3～3)
  textureType: "cloud",
  text:"hello lil.gui!",
  textSize:24, // 16～48
  gradationStopColor: {r:0, g:0, b:1} // オブジェクト形式で渡すとそれに応じた形で取得できるみたいなのです
}

// lil使ってみよう。
function createGUI(){
  const gui = new lil.GUI();
  // 手始めに
  gui.add(config, "useDirectionalLight").name("directionalLight");
  gui.add(config, "usePointLight").name("pointLight");
  gui.add(config, "useSpotLight").name("spotLight");
  gui.add(config, "specular").name("specular");
  gui.addColor(config, "torusColor");
  gui.add(config, "xCoord", -4, 4, 0.01).name("x");
  gui.add(config, "yCoord", -4, 4, 0.01).name("y");
  gui.add(config, "zCoord", -4, 4, 0.01).name("z");
  gui.add(config, "textureType", ["cloud", "check", "circles"]);
  gui.add(config, "text");
  gui.add(config, "textSize", 16, 48, 1);
  gui.addColor(config, "gradationStopColor").name("bgColor");
}

const lightVert =
`#version 300 es
in vec3 aPosition;
in vec3 aVertexColor;
in vec3 aNormal;
in vec2 aTexCoord;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

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
}
`;

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
uniform vec3 uTint; // texture関連でtextureに色を付与したい場合のためのオプション。掛けるだけ。

in vec3 vVertexColor;
in vec3 vNormal;
in vec3 vViewPosition;
in vec2 vTexCoord; // テクスチャ

// -------------------- その他 -------------------- //

out vec4 finalColor; // 最終的な色

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

function preload(){
  cloudImg = loadImage("https://inaridarkfox4231.github.io/assets/texture/cloud.png");
}

function setup(){
  _timer.initialize("slot0");
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  // z軸上向きが天井、x=10, z=5が視点。中心向き。
  _cam = new ex.CameraEx({
    w:10, h:8, top:[0, 0, 1], eye:[6, 0, 4]
  });
  _node.registPainter("light", lightVert, lightFrag);
  registMesh(_node);

  // 雲画像を登録
  _node.registTexture("cloud", {src:cloudImg});

  // チェック画像を登録
  _node.registTexture("check", {src:(function(){
    const gr = createGraphics(512, 512);
    gr.noStroke();
    for(let y=0; y<16; y++){
      for(let x=0; x<16; x++){
        gr.fill(255*((x+y)%2));
        gr.rect(x*32, y*32, 32);
      }
    }
    return gr;
  })()});

  // もうちょっと
  _node.registTexture("circles", {src:(function(){
    const gr = createGraphics(512, 512);
    gr.background(0);
    gr.blendMode(ADD);
    gr.fill(32);
    for(let i=0; i<128; i++){
      const x = Math.random()*512;
      const y = Math.random()*512;
      for(let i=-1; i<2; i++){
        for(let k=-1; k<2; k++){
          gr.circle(x+512*i, y+512*k, 32);
        }
      }
    }
    return gr;
  })()});

  // あとはbgですかね
  _node.registTexture("bg", {src:(function(){
    const gr = createGraphics(width, height);
    return gr;
  })()});

  createGUI();
}

// --------------------------------------------------------------------------------------------

function draw(){
  // lighting周りをconfigしたい...
  _node.bindFBO(null);

  //_node.clearColor(0,0,0,1).clear();
  // カスタム背景
  bgUpdate();
  const stopColor = config.gradationStopColor;
  ex.copyPainter(_node, {src:{name:"bg",
    gradationFlag:1, gradationStart:[0.5, 0, 0,0,0,1], gradationStop:[0.5,1, stopColor.r, stopColor.g, stopColor.b,1]}});

  _node.usePainter("light");

  // 射影
  const projMat = _cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);

  // 環境光
  setLight(_node, {useSpecular:config.specular});
  const {front} = _cam.getLocalAxes(); // frontから視線方向に光を当てる。
  const {eye} = _cam.getViewData();

  // 平行光
  if(config.useDirectionalLight){
    setDirectionalLight(_node, {
      count:2,
      direction:[-front.x, -front.y, -front.z, 0, 0, -1],
      diffuseColor:[1, 1, 1, 1, 1, 1],
      specularColor:[0.5,1,1, 1, 0.5, 1]
    });
  }else{
    setDirectionalLight(_node, {count:0});
  }

  // 点光源
  if(config.usePointLight){
    setPointLight(_node, {
      count:2,
      location:[0,0,1.5, 3, 0, 1.5],
      diffuseColor:[1,1,1,1,1,1],
      specularColor:[1, 0.5, 1,1,0.5,1]
    });
  }else{
    setPointLight(_node, {count:0});
  }

  // 照射光
  if(config.useSpotLight){
    setSpotLight(_node, {
      count:1,
      location:[eye.x*2, eye.y*2, eye.z*2],
      direction:[-front.x, -front.y, -front.z],
      angle:[Math.PI/3],
      conc:[20],
      diffuseColor:[0.5, 1, 0.5],
      specularColor:[0.75, 1, 0.75]
    });
  }else{
    setSpotLight(_node, {count:0});
  }

  // 彩色方法指定（0:頂点色、1:単色、2:UV着色）UVはシームレスクラウドをpreloadで取得して使う。

  // enableAttr
  _node.drawFigure("torus").bindIBO("torusIBO");

  // あとはtfとcameraを登録していつものようにドローコール
  // renderTorus
  renderTorus0(_node, _tf, _cam, 0, -2, -1); // 頂点色用
  const torusColor = config.torusColor;
  renderTorus1(_node, _tf, _cam, 0, 2, -1, torusColor.r, torusColor.g, torusColor.b); // 単色用
  const pos = {x:config.xCoord, y:config.yCoord, z:config.zCoord};
  renderTorus2(_node, _tf, _cam, pos.x, pos.y, pos.z); // UV用
}

// ------------------------------------------------------------------------------------------------------------------------------- //
// mesh. いい加減メソッド化して隠蔽したいね。UV付けるか～色も？今回はいろいろいじるからね...

function registMesh(node){
  // 今回はトーラスで。紙の上で計算してるけどロジックは難しくないのよ。
  const a = 1.0;
  const b = 0.4;
  const ds = 32;
  const dt = 32;
  const torusPositions = new Array(3*(ds+1)*(dt+1));
  const torusNormals = new Array(3*(ds+1)*(dt+1));
  const torusColors = new Array(3*(ds+1)*(dt+1));
  const torusUVs = new Array(2*(ds+1)*(dt+1));
  const torusFaces = new Array(6*ds*dt);
  const dTheta = Math.PI*2/ds;
  const dPhi = Math.PI*2/dt;
  // イメージ的にはkがx軸でlがy軸で原点左下の座標系を考えている
  // この原点はx軸aでz軸bの点で、そこから右と上にxとyをそれぞれ伸ばす感じ。
  for(let l=0; l<=dt; l++){
    for(let k=0; k<=ds; k++){
      const index = (dt+1)*l + k;
      const px = Math.cos(dPhi*l);
      const py = Math.sin(dPhi*l);
      const nx = Math.sin(dTheta*k)*px;
      const ny = Math.sin(dTheta*k)*py;
      const nz = Math.cos(dTheta*k);
      const x = a*px + b*nx;
      const y = a*py + b*ny;
      const z = b*nz;
      torusPositions[3*index] = x;
      torusPositions[3*index+1] = y;
      torusPositions[3*index+2] = z;
      torusNormals[3*index] = nx;
      torusNormals[3*index+1] = ny;
      torusNormals[3*index+2] = nz;
      const col = ex.hsv2rgb(0.5+0.1*Math.sin(Math.PI*2*k/(ds+1)), 0.8+0.2*Math.cos(Math.PI*2*l/(dt+1)), 1);
      torusColors[3*index] = col.r;
      torusColors[3*index+1] = col.g;
      torusColors[3*index+2] = col.b;
      torusUVs[2*index] = (k+1)/ds;
      torusUVs[2*index+1] = (l+1)/dt;
    }
  }
  // kとlに着目すると分かりやすいかもしれない。
  for(let l=0; l<dt; l++){
    for(let k=0; k<ds; k++){
      const index = dt*l + k;
      torusFaces[6*index] = l*(ds+1) + k;
      torusFaces[6*index+1] = l*(ds+1) + k+1;
      torusFaces[6*index+2] = (l+1)*(ds+1) + k+1;
      torusFaces[6*index+3] = l*(ds+1) + k;
      torusFaces[6*index+4] = (l+1)*(ds+1) + k+1;
      torusFaces[6*index+5] = (l+1)*(ds+1) + k;
    }
  }
  node.registFigure("torus", [
    {name:"aPosition", size:3, data:torusPositions},
    {name:"aNormal", size:3, data:torusNormals},
    {name:"aVertexColor", size:3, data:torusColors},
    {name:"aTexCoord", size:2, data:torusUVs}
  ]);
  node.registIBO("torusIBO", {data:torusFaces});
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

// ------------------------------------------------------------------------------------------------------------------- //
// renderModel.

// 行列関連はまとめとこうか
function setModelView(node, tf, cam){
  const modelMat = tf.getModelMat().m;
  const viewMat = cam.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  node.setUniform("uViewMatrix", viewMat);
  node.setUniform("uModelViewMatrix", modelViewMat);
}

// 0は頂点色という意味...単色とUVも作るつもり。
function renderTorus0(node, tf, cam, x, y, z){
  const currentTime = _timer.getDelta("slot0");
  tf.initialize().translate(x, y, z)
    .rotateZ(0.3)
    .rotateY(currentTime*Math.PI*0.5)
    .rotateX(currentTime*Math.PI);
  setModelView(node, tf, cam);
  node.setUniform("uUseColorFlag", 0);
  node.drawElements("triangles");
}

// 1は単色
function renderTorus1(node, tf, cam, x, y, z, r, g, b){
  const currentTime = _timer.getDelta("slot0");
  tf.initialize().translate(x, y, z)
    .rotateZ(0.3)
    .rotateY(currentTime*Math.PI*0.5)
    .rotateX(currentTime*Math.PI);
  setModelView(node, tf, cam);
  node.setUniform("uMonoColor", [r, g, b]);
  node.setUniform("uUseColorFlag", 1);
  node.drawElements("triangles");
}

// 2はUV
function renderTorus2(node, tf, cam, x, y, z){
  const currentTime = _timer.getDelta("slot0");
  tf.initialize().translate(x, y, z)
    .rotateZ(0.3)
    .rotateY(currentTime*Math.PI*0.5)
    .rotateX(currentTime*Math.PI);
  setModelView(node, tf, cam);
  node.setUniform("uUseColorFlag", 2);
  node.setTexture2D("uTex", config.textureType);
  node.setUniform("uTint", [1.3, 1.0, 0.7]);
  node.drawElements("triangles");
}

function bgUpdate(){
  const gr = _node.getTextureSource("bg");
  gr.clear();
  gr.fill(255);
  gr.noStroke();
  gr.textSize(config.textSize);
  gr.textAlign(CENTER, CENTER);
  gr.text(config.text, width/2, height*7/8);
  _node.updateTexture("bg");
}
