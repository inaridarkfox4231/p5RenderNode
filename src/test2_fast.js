// 4000box.
// 元ネタ：@incre_ment さんの https://twitter.com/incre_ment/status/1574569987196350464

// 今回バーテックスステージでモデル変換するのでモデル行列要らないですね...というかそのまま渡しちゃってOKです。

// 20221005
// カリング。あと同じサイズのバッファに法線と明るさぶち込んで
// それ使ってピクセルごとにちょうど1回だけ色決めするように改良する
// それでだめならもうええわ！！

// カリングしたら速くなった...けど、なんだ、これ...
// ディレクショナルライトの計算のところがおかしい？あるいは法線計算か。なんか変だ。何だろう...
// おそらくだけど法線、もしくは、どっちかが間違ってる。

// 法線計算が時計回り前提でした。まじか～
// 直したよ、これでいいはず。速いね...こんな速くなるんだね...すげ。
// まあこれからさらに速くするんだけどね。

// スマホの方死んでた。OK. 知ってた。

// まずdrawingbufferのサイズのフレームバッファを用意する。vec4. で、法線情報と明るさを格納する。

// preLightでnormalとblightnessを計算。
// 次に板ポリ芸で、ピクセルごとに、gl_FragCoordを使ってアクセス。この際にresolutionを使って...って思ったけど
// vUvで良さそうやね。
// uniformとかはすべてfragmentの方で受け取る形。そもそもvで受け取ってfに送るの冷静に考えたら
// おかしいでしょ。vじゃ使わないのに。テクスチャ座標じゃないんだから。

// あーしまった、pointLightってモデルビューのポジション情報が要るのか...カメラからの位置。んー。
// MRT使えばできるんだろうけど今回は無視しましょう。

// 複数の...ってなるとデプスとかも使う必要が出てきそう。重なりとか考慮するとそうなるし。んー。
// 全部一つのFigureに出来るわけじゃないからねぇ。その都度深さを考慮して法線とか更新していく感じなんかね...色とか。
// でもそれはレンダーバッファに深さの情報が入ってれば勝手にやってくれるから必要ないのか。なるほど。そうやって使われる感じなのね。多分。

// 現時点での
// ...

// レンダリング自体はできてるんですけど、おかしいですね...すぐ真っ黒になってしまうのです。ん？？

// できました。あの、depthをクリアしてなかったんですね。本家の方は明示的にdepthClear(1)にしてますけどそこまではいいかなって。
// できた！frameRate130でも動く爆速のバケモノ誕生...でもまあ60でいいですとりあえず。
// MRTマスターすれば色とかついてても大丈夫になるはず。pointLightとか、viewPositionが必要なのについても、
// それ用にバッファ用意すればいけるかも。

// 当面の課題はMRTを導入して（layout修飾子っていう新しい武器が必要になるけど...）
// 色ついた状態とかでもこのディファードが出来るようにすることだわね。

// y軸逆にしました。言いたいことはそれだけ。
// なのでデータ入力のところもいじりました。問題なし。当然か。
// ていうか指定の仕方も500.0から引く、とかなってて不自然だったしな。よかったよ。

// まずはこのコードを見通し良く整理して
// それからですかね

// あのですね。canvas2Dからテクスチャを作る場合と違って、フレームバッファのテクスチャに落とす場合、左下が0,0になるんですよね。
// ただこれを正規化デバイスのvUvでアクセスして取得する場合こっちも縦方向が逆（左下が0,0）なので問題なくアクセスできるわけ。
// そこら辺ですね。だから普通にvUvを0.5*aPosition+0.5で計算して渡せばいい。そこは、本当に、うん。それでいいの。

// やることは大きく分けて3つ。
// 1. specularなどライティング関連の充実、加えてパイプラインの整備（テンプレート関数の充実）
// 2. MRTを習得して個別に色を付けられるようにする（フレームバッファを用意するところをちょっといじるだけ、実験が相当必要になるね）
// 3. transformを個別に簡単に付けられるようなフレームバッファを用意する適切な関数を構築する（脳内ではある程度できてる...書き起こすだけ）
// option: Cameraの2画面で分かりやすくするとかpointLightの可視化、などなど。これは本筋とは関係ないが...カメラの可視化ってやつ

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.

let tf;
let cam2;
let _timer = new ex.Timer();
let _time = 0;

let info, infoTex;

// ------------------------------------------------------------------------------------------------------------ //
// shaders.

// calc用のシェーダー
// vertは一緒だわね...
const calcVert =
`#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// calcFragはxの方を200.0倍してfloor,yの方を20倍してfloorして、
// その整数に対して何か計算してvec4こしらえて出力する。
const calcFrag =
`#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragData;

uniform vec2 uSize;  // 今回は200x20.
uniform float uTime; // 時間。0.01ずつふやすんだとか。んー...

const float TAU = 6.28318;

void main(){
  vec2 indices = floor(vUv * uSize);
  float a = indices.x * 0.005;  // 0.005の0倍～199倍
  float i = indices.y + 1.0;    // 1～20
  float k = 20.0;
  float w = 600.0;
  float t = uTime;
  float p = (i+5.0*t)/k;
  float r = pow(1.0-p, 3.0);
  float _x = 4.0*r*w*sin(TAU*a);
  float _y = 2.0*w*p*p*p*p - 50.0*sin(TAU*(3.0*(p+a)+t)) - 500.0; // y軸逆にした関係でここもマイナス。
  float _z = 4.0*r*w*cos(TAU*a) - 200.0;
  float brightness = p*w/255.0;
  fragData = vec4(_x, _y, _z, brightness); // 出力！
}
`;

// MRTで色とか扱えるようになればテクスチャとか単色とか普通に頂点色とかでも
// できるようになるはず。それを記録すればいいだけなので。
// さらにビューポジションも記録できるようになればpointLightの計算も出来るようになる。
// バッファの数が増えるが...恩恵は大きいよ。

// 本来はここでfb使ってtfするならそれに応じて法線とかも再計算しないといけないんだわ
// まとめてできれば速いからいいね...
const preLightVert =
`#version 300 es
in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

uniform sampler2D uData;

out vec3 vNormal;
out float vBrightness;

void main(void){
  // 場合によってはaPositionをいじる（頂点位置）
  // 場合によってはaNormalもここで計算するかもしれない
  vec3 pos = aPosition;
  // さていじりますか。
  // スケール変換は済ませておく。

  // 変換データをテクスチャより取得
  float id = floor(float(gl_VertexID) / 8.0);
  vec2 dataPos = vec2(mod(id, 200.0) + 0.5, floor(id / 200.0) + 0.5) / vec2(200.0, 20.0); // あっ忘れてた
  vec4 data = texture(uData, dataPos);

  // 位置調整
  pos += vec3(data.x, data.y, data.z);

  // 次に色の調整をしますね
  vec3 color = vec3(0.5, 0.75, 1.0);
  // 遠くに行くほど暗くなる変化を加えているのでそれを考慮
  vBrightness = data.w;

  // 以上ですね。

  vec4 viewModelPosition = uModelViewMatrix * vec4(pos, 1.0);

  gl_Position = uProjectionMatrix * viewModelPosition;

  mat3 normalMatrix; // こうしよう。[0]で列ベクトルにアクセス。
  normalMatrix[0] = uModelViewMatrix[0].xyz;
  normalMatrix[1] = uModelViewMatrix[1].xyz;
  normalMatrix[2] = uModelViewMatrix[2].xyz;
  normalMatrix = inverse(transpose(normalMatrix)); // これでいい。今回は全部いじらないのであんま意味ないが...

  vNormal = normalMatrix * aNormal;
}
`;

// normalと、色に掛けるfactorだけ。放り込む。
// 色が必要な場合はここで決めるのでフラグとかはこっちで...って感じになるな。まあそもそも
// これが本来のあるべき姿なんだろうね
// ってわけでもない、か、半透明とかできないし...まあとりあえず。

// MRTやろうって話になるならこれの他にRGBへの出力と、
// あとpointのポジション渡してpointLightが適用できるようにする。合計3つだわね。
const preLightFrag =
`#version 300 es
precision mediump float;

in vec3 vNormal;
in float vBrightness;

out vec4 normalData; // 出力。

// メインコード
void main(void){
  normalData = vec4(vNormal, vBrightness); // こんだけ...
}
`;

// ここはただの板ポリアクセスになる...？まあそうなるわな。となると要らないな...copyVertでいい。
// uniform受け取るのとかも全部fragmentShaderがやってくれる。

// vUvとuNormalDataから法線と明るさの情報を取得

// directionalLight前提の限定的なシェーダでとりあえず実験

// そのうちpointもできるように...specularとかshininessも面白そう
const lightFrag =
`#version 300 es
precision mediump float;
// ビュー行列
uniform mat4 uViewMatrix;
// directionalLight関連
uniform vec3 uAmbientColor; // AmbientColorはuniformで取得。
uniform vec3 uLightingDirection;
uniform vec3 uDirectionalDiffuseColor;

uniform sampler2D uNormalData; // 法線と明るさの入ったテクスチャ

const float diffuseFactor = 0.73;

in vec2 vUv; // テクスチャアクセス用

out vec4 fragColor; // 出力。

// DirectionalLight項の計算。
vec3 getDirectionalLightDiffuseColor(vec3 normal){
  vec3 lightVector = (uViewMatrix * vec4(uLightingDirection, 0.0)).xyz;
  vec3 lightDir = normalize(lightVector);
  vec3 lightColor = uDirectionalDiffuseColor;
  float diffuse = max(0.0, dot(-lightDir, normal));
  return diffuse * lightColor;
}

// _lightはこれで。
vec3 totalLight(vec3 normal){
  vec3 result = vec3(0.0); // 0.0で初期化
  // directionalLightの影響を加味する
  result += getDirectionalLightDiffuseColor(normal);

  result *= diffuseFactor;
  return result;
}
// include lighting.glsl

// メインコード
void main(void){
  // 法線と明るさの情報を取得
  vec2 texCoord = vUv;
  // どうも上下が逆になってるっぽい...yを戻さないとアクセスできない。
  texCoord.y = 1.0 - texCoord.y;
  vec4 data = texture(uNormalData, texCoord);
  vec3 normal = data.xyz;
  float brightness = data.w;
  // data.wには描画しないところは0が入ってるから大丈夫ぽいね。discardの方が安全だけど...

  vec3 diffuse = totalLight(normalize(normal)); // normalを使って陰影計算
  vec4 col = vec4(0.5, 0.75, 1.0, 1.0); // 原色
  col.rgb *= brightness; // 明るさ考慮

  // diffuseの分にambient成分を足してrgbに掛けて色を出してspecular成分を足して完成みたいな（？？）
  col.rgb *= (diffuse + uAmbientColor);
  fragColor = col;
}
`;

// info用
let copyVert =
`#version 300 es

in vec2 aPosition;
out vec2 vUv; // vertexStageのvaryingはoutで、

void main(void){
  vUv = aPosition * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

let copyFrag =
`#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv; // fragmentStageのinと呼応するシステム。vertexStageのinはattributeなので
uniform sampler2D uTex;
out vec4 fragColor;

void main(void){
  fragColor = texture(uTex, vUv); // なんとtextureでいいらしい...！
}
`;

// ------------------------------------------------------------------------------------------------------------ //
// main code.

function setup(){
  createCanvas(800, 640, WEBGL);
  // frameRate==30をなくしました。ちょっと速くなったかも...？
  // 1秒周期なのでこれで！
  _timer.set("cur");

  const gl = this._renderer.GL;
  _node = new ex.RenderNode(gl);
  tf = new ex.TransformEx();
  cam2  = new ex.CameraEx2({w:width, h:height}); // これ以上やること無いな...
  // んー。小さい数でやるべきなんだろうな、とか思ったり

  // lightingShader.
  _node.registPainter("preLight", preLightVert, preLightFrag);
  _node.registPainter("light", copyVert, lightFrag);

  // キューブメッシュ（頂点のインデックスは反時計回りだよ！間違えてるよ！）
  // あとテクスチャは個別じゃないと使えないよ！
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
  // サイズ
  for(let i=0; i<8; i++){
    vData[3*i] *= 0.5 * 9;
    vData[3*i+1] *= 0.5 * 600;
    vData[3*i+2] *= 0.5 * 9;
  }
  // これを4000個複製する
  let positions = [];
  for(let i=0; i<4000; i++){
    positions.push(...vData);
  }
  meshData.push({name:"aPosition", size:3, data:positions});

  // 修業が足りないので色は無しで
  let fData = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  // デフォルト法線
  let nData = ex.getNormals(vData, fData);
  // nDataを4000個複製
  let normals = [];
  for(let i=0; i<4000; i++){
    normals.push(...nData);
  }
  meshData.push({name:"aNormal", size:3, data:normals});
  // お疲れさまでした。
  _node.registFigure("cube", meshData);

  // faceIndicesも4000個複製。ただしインデックスの値を8ずつ増やしていくので注意。
  let faceIndices = [];
  for(let i=0; i<4000; i++){
    for(let index of fData){
      faceIndices.push(i*8 + index);
    }
  }
  _node.registIBO("cubeIBO", {data:faceIndices});

  // データ計算用
  _node.registPainter("calc", calcVert, calcFrag);
  // vec4のfloatのframebuffer.
  _node.registFBO("param", {w:200, h:20, textureType:"float"})

  // こんな感じ？ですね。次。

  // info用
  _node.registPainter("copy", copyVert, copyFrag);
  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1,-1,1,-1,-1,1,1,1]}]);

  info = createGraphics(width, height);
  info.fill(255);
  info.noStroke();
  info.textSize(16);
  info.textAlign(LEFT, TOP);
  infoTex = new p5.Texture(this._renderer, info);

	_timer.set("fps"); // 最初に1回だけ

  // カリング有効化
  _node.enable("cull_face");
  _node.cullFace("back"); // backを摘み取る

  // 同じサイズのフレームバッファを用意
  // MRT見てみたけど難しくなさそう。近いうちに挑戦してみる。
  const _size = _node.getDrawingBufferSize();
  _node.registFBO("pre", {w:_size.w, h:_size.h, textureType:"float"}); // ここに法線と明るさを落とす...
  // そのうちmodelPositionとmodelColorも落とす（追加で2枚）
}

// やること
// 行列ユニフォーム一通り
// ライティングユニフォーム一通り
// 彩色方法指定（単色、頂点色、UV）
// ドローコール
// おわり。サクサク行こう。
function draw(){
  _node.clearColor(0, 0, 0, 1).clear();

  const fps = _timer.getDeltaFPStext("fps", frameRate());
	_timer.set("fps"); // ここから上のあそこまで、ってやってみたわけ。うん。なるほど...んー...

  // 時間のとこいじろうかなって
  // ロジック見たら1秒周期だった
  const currentTime = _timer.getDeltaSecond("cur") * 0.6;

  // データ計算.
  _node.bindFBO("param")
       .use("calc", "board")
       .setUniform("uTime", currentTime - Math.floor(currentTime))
       .setUniform("uSize", [200, 20])
       .drawArrays("triangle_strip")
       .unbind();

  // 先に...法線の情報を書き込む。
  _node.bindFBO("pre");
  _node.clearColor(0, 0, 0, 0).clear(); // 0にしてるんだけど...
  // ああそうか。なるほど。デプスが残っちゃってるのか。...出来た！爆速！！
  _node.use("preLight", "cube");
  // 各種行列
  const modelMat = tf.getModelMat().m;
  const viewMat = cam2.getViewMat().m;
  const modelViewMat = ex.getMult4x4(modelMat, viewMat);
  _node.setUniform("uModelViewMatrix", modelViewMat);
  // 射影
  const projMat = cam2.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);
  // param
  _node.setFBOtexture2D("uData", "param");
  _node.bindIBO("cubeIBO");
  _node.drawElements("triangles");
  _node.unbind();

  // 本番（板ポリ）
  _node.bindFBO(null);

  // ライティングシェーダ、オン！
  _node.use("light", "board");

  // ライティングユニフォーム（directionalLightで）
  _node.setUniform("uAmbientColor", [0.25, 0.25, 0.25]);
  //_node.setUniform("uUseDirectionalLight", true);
  _node.setUniform("uLightingDirection", [0, 0, -1]); // -1でOKです！
  _node.setUniform("uDirectionalDiffuseColor", [1, 1, 1]);
  // ビュー行列
  _node.setUniform("uViewMatrix", viewMat);
  // テクスチャでデータを送り込む
  _node.setFBOtexture2D("uNormalData", "pre");
  _node.drawArrays("triangle_strip");
  _node.unbind();

  _node.enable("blend")
       .blendFunc("one", "one_minus_src_alpha");

  _node.use("copy", "board")
       .setTexture2D("uTex", infoTex.glTex)
       .drawArrays("triangle_strip")
       .unbind()
       .flush()
       .disable("blend");

  info.clear();
  info.text("fpsRate:" + fps, 5, 5);
  info.text("frameRate:" + frameRate().toFixed(2), 5, 25);
  infoTex.update();
}
