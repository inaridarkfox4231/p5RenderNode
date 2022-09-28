// RenderNode. ver2.3

// やりたいこと
// うーん動的更新
// bufferSubData負荷小さいんだって（まじで？）（それもっと早く言ってよ）
// 大量に要求するから負荷が重くなるっていうだけの話だった（びっくりでしょ）
// つまり
// 工夫次第で爆速になりうる...
// どうするかね

// 20220924
// えーと、バッファとシェーダーは分離できる。概念を。
// あと動的更新は軽いのでDYNAMIC_DRAWで自由自在に使えるようにしましょう重いのはCPUだけだ！
// そんなところ。
// 備え付けのシェーダーは別のところにおいといて...

// トーラス表示できましたね。
// さてと...
// どう考えても派生ごとに違うことをした方がいいのと
// てかその前に整理しないといけない。それはここではやらないので...
// あっちでやる。

// この内容を整理して必要なだけlibsに送るのさ。
// まあ大変だけどね...
// んでできればwebgl2でやりたいのよね...

// で
// shaderについては結論はもう出てて
// 応用ですから
// 汎用性ないんで
// 切り離します
// 使い方をまとめたうえで...ね。
// 点描画とか、行列要るけどライティング要らない場合とかもあるし。
// いろいろあるので。
// boidsならおそらく完全内部的更新みたいなケースもありうるでしょう（いわゆるGPGPU）
// だからRenderNodeのやることじゃない
// 同じ理由でトポロジーリストも要らないので切り離す

// 行列はどうしようもないな...まあ、ドローコールの回数考えたら
// 当然それは減らすべきでたとえばだけど原理を知らないとさ
// たとえば100個のオブジェクトを回すのに100回行列を送り込んだりは
// しない。それぞれに位置情報を持たせたうえで同じ周期で回したり
// もしくは速度情報を与えて回したり...するわけで。ってtranslateも行列だったわ。
// 行列作る部分を独立させてそれにより生成されたそれをUniformで送り込む感じで行こう
// 行列関連もRenderNodeから切り離すということ
// ライブラリは使ってもいいけどせっかくp5jsあるんだから使わせていただきましょう

// 半分本気。半分冗談。どうでもいい。所詮お遊び。お金になるなら別だけど。
// _glは要らないです。行列以外使ってないので。行列はカメラに関係するビュープロジェクション
// それと本体に関するモデルそんだけだから
// カメラは自由に動かせるべき
// ていうかカメラって要するにただの行列だからね...

// --------------------------------------------------------------- //
// global.

let _gl, gl;

let _node; // RenderSystemSetにアクセスするためのglobal.
let ext = {};

let properFrameCount = 0;

// --------------------------------------------------------------- //
// shader.

// copy. 2D背景付けたい場合にどうぞ。
const copyVert =
"precision mediump float;" +
"attribute vec2 aPosition;" +
"varying vec2 vUv;" +
"void main () {" +
"  vUv = aPosition * 0.5 + 0.5;" +
"  vUv.y = 1.0 - vUv.y;" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

const copyFrag =
"precision mediump float;" +
"precision mediump sampler2D;" +
"varying highp vec2 vUv;" +
"uniform sampler2D uTex;" +
"void main () {" +
"  gl_FragColor = texture2D(uTex, vUv);" +
"}";

// ライティング用のシェーダ。フォンシェーディング。
// 頂点色と単色に対応（テクスチャはそのうち）。
// RenderNodeに組み込まれることを想定しているので
// 上記のcopyと合わせてデフォルトシェーダの一種となる。
// もちろん独自に用意することもできるようにするけどね（カスタム）。

// standardLightShaderとでも名付けて固定すればいいわけで
// もしくは
// 位置や回転をいじったり独自のattributeを付け加えたい場合にカスタムしやすいように
// 調整したらいいと思う
// 差分だけ記述するようにすれば柔軟性と汎用性が高まるので
let lightVert=
"precision mediump float;" +

"attribute vec3 aPosition;" +
"attribute vec4 aVertexColor;" +
"attribute vec3 aNormal;" +
"attribute vec2 aTexCoord;" +

"uniform vec3 uAmbientColor;" +

"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"uniform mat3 uNormalMatrix;" +

"varying vec4 vVertexColor;" +
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
"uniform vec4 uMonoColor;" +
"uniform int uUseColorFlag;" + // 0:vertex. 1:mono.
// 単色にしたいときtrueにして有効化する感じ。

"uniform sampler2D uTex;" +

"varying vec4 vVertexColor;" +
"varying vec3 vNormal;" +
"varying vec3 vViewPosition;" +
"varying vec3 vAmbientColor;" +
"varying vec2 vTexCoord;" + // テクスチャ
// メインコード
"void main(void){" +
"  vec3 diffuse = totalLight(vViewPosition, normalize(vNormal));" +
"  vec4 col = vec4(1.0);" +

"  if(uUseColorFlag == USE_MONO_COLOR) {" +
"    col = uMonoColor;" +  // uMonoColor単色
"  }" +
"  if(uUseColorFlag == USE_VERTEX_COLOR){" +
"    col = vVertexColor;" + // 頂点色
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

// vertexColorShader. 頂点色のみでやる場合。
// ライティングは全く考慮しない。

let vertexColorVert =
"precision mediump float;" +
"attribute vec3 aPosition;" +
"attribute vec4 aVertexColor;" +
"varying vec4 vVertexColor;" +
"uniform mat4 uModelViewMatrix;" +
"uniform mat4 uProjectionMatrix;" +
"void main(){" +
"  vec4 viewModelPosition = uModelViewMatrix * vec4(aPosition, 1.0);" +
"  gl_Position = uProjectionMatrix * viewModelPosition;" +
"  vVertexColor = aVertexColor;" +
"}";

let vertexColorFrag=
"precision mediump float;" +
"varying vec4 vVertexColor;" +
"void main(){" +
"  gl_FragColor = vVertexColor;" +
"}";

// --------------------------------------------------------------- //
// setup.

function setup(){
  _gl = createCanvas(windowWidth, windowHeight, WEBGL);
  // pixelDensityは無視する方向で作っていきます。
  gl = _gl.GL; // レンダリングコンテキストの取得

  // extensionのチェック一通り
  confirmExtensions();

  // カリングを使う場合の処理。
  // 文字テキストとかの時、高速にするために多用してた。
  // こういうのも落とし込みたいところ。
  // gl.enable(gl.CULL_FACE);
  // gl.cullFace(gl.FRONT);
  // この場合背景用の頂点指定は[-1,-1,-1,1,1,-1,1,1]が正解。

	const positions = [-1,-1,-1,1,1,-1,1,1];

  // nodeを用意
  _node = new RenderNode();
  let sh; // シェーダー用の汎用エイリアス
  let _data; // トポロジーデータ用の汎用エイリアス

  // 寂しいのでポリゴンを回す
  sh = createShader(lightVert, lightFrag);
  // 同じシェーダで複数のトポロジーを描画する場合は
  // まずregistRenderSystemで使うシェーダを決めてから
  _node.registRenderSystem('light', sh);
  // registTopologyで名前を指定して始める。そのあとは一緒。

	// トーラス
	_data = getTorusData(32, 32, 80, 16);
	_node.registTopology('torus')
       .registAttributes({aPosition:{data:_data.v, stride:3}, aVertexColor:{data:_data.c, stride:4}, aNormal:{data:_data.n, stride:3}})
       .registIndexBuffer(_data.f);
}

// ---------------------------------------------------------------
// main loop.

function draw(){
  background(0);

  // ライティングのシェーダを用意
  _node.useRenderSystem('light')
       .setDirectionalLight(_RGB(1), 0, 0, -1)
       .setAmbientLight(_RGB(0.25));

  // トーラス
  _node.useTopology('torus')
       .setAttribute()
       // setMatrixの中に配列の形でオブジェクトを並べると
       // 然るべく計算してくれる。
       .setMatrix([{rotX: properFrameCount*TAU/240}])
       .setVertexColor()
       .bindIndexBuffer()
       .drawElements(gl.TRIANGLES)
       .clear()
	     .flush();

  properFrameCount++;
}

// ---------------------------------------------------------------
// BG.

function drawBackground(){
  bg.clear();
  bg.image(base, 0, 0);
  bg.image(info, 0, 0);
}

function updateInfo(ratio){
  info.clear();
  info.textAlign(CENTER, CENTER);
  info.text("background test", width*0.5, height*0.5);
  info.textAlign(LEFT, TOP);
  info.text(ratio.toFixed(3), 10, 10);
}

// --------------------------------------------------------------- //
// ここから先がテンプレート、
// 現時点でのRenderNodeの決定版。
// とはいえboxとかtorusとか取得する関数もう作ってあるけど
// カメラとか立体文字とかも
// そういうのも付け加えないと片手落ちだよね...
// GPGPUの方、create_iboが無かったので追加。
// あと思い出したけどbindFBOのとこviewport設定できるようにしたんだっけ
// 他にもfbo更新のリサイズとか
// まあそのうち...
// あとbgManagerはもう使わないかもな...いや便利だけど。
// そうだcopyShaderを備え付けにするんだっけ。

// 修正ログ20220427
// registIndexBufferでUint16かUint32かを大きさで判断するように修正
// setFBOで第二引数がない場合や該当するフレームバッファが存在しない
// 場合に警告を出すように修正（これで2時間くらいハマったので）

// --------------------------------------------------------------- //
// extension check.

// というわけでextensionsの確認メソッドにしました
// ext={}に順次追加していきます
// 引っかかったらalertを発信

// 注意1:HALF_FLOATはwebgl1ではサポートされてないのでそれ使う場合は
// いつもgl.FLOATのところをext.textureHalfFloat.HALF_FLOAT_OESを使おう。
// 注意2:gl.LINEARをHALF_FLOATのテクスチャで使いたい場合は
// ext.textureHalfFloatLinearがnullでないかどうかを確認しよう。
function confirmExtensions(){
  ext.textureFloat = gl.getExtension('OES_texture_float');
  // これのHALF_FLOAT_OESが欲しいわけですね
  ext.textureHalfFloat = gl.getExtension('OES_texture_half_float');
  // halfFloatでlinearが使える場合これが何らかのオブジェクトになる感じ
  ext.textureHalfFloatLinear = gl.getExtension('OES_texture_half_float_linear');
  ext.elementIndexUint = gl.getExtension('OES_element_index_uint');
  if(ext.textureFloat == null || ext.textureHalfFloat == null){
    alert('float texture not supported');
  }
  if(ext.elementIndexUint == null){
    alert('Your web browser does not support the WebGL Extension OES_element_index_uint.');
  }
}

// --------------------------------------------------------------- //
// global functions.

// framebuffer.
// framebufferを生成するための関数
// attribute関連はstaticメソッドに移しました。
// RenderNodeの処理にする・・？

// webgl2でフレームバッファの自由度上がってるけど使い方分からんし
// 滅多なことしない方がいいと思う
// 整数とか興味深いけどね...
// それよりテクスチャ作る関数欲しいです

// fboを作る関数
function create_fbo(name, texId, w, h, textureFormat, filterParam){
  // フォーマットチェック
  if(!textureFormat){
    textureFormat = gl.UNSIGNED_BYTE;
  }
  if(!filterParam){
    filterParam = gl.NEAREST;
  }

  // フレームバッファの生成
  let framebuffer = gl.createFramebuffer();

  // フレームバッファをWebGLにバインド
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  // 深度バッファ用レンダーバッファの生成とバインド
  let depthRenderBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);

  // レンダーバッファを深度バッファとして設定
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

  // フレームバッファにレンダーバッファを関連付ける
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);

  // フレームバッファ用テクスチャの生成
  let fTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + texId);

  // フレームバッファ用のテクスチャをバインド
  gl.bindTexture(gl.TEXTURE_2D, fTexture);

  // フレームバッファ用のテクスチャにカラー用のメモリ領域を確保
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, textureFormat, null);

  // テクスチャパラメータ
  // このNEARESTのところを可変にする
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterParam);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterParam);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // フレームバッファにテクスチャを関連付ける
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fTexture, 0);
  // 中身をクリアする(clearに相当する)
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

  // 各種オブジェクトのバインドを解除
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // オブジェクトを返して終了
  return {f:framebuffer, d:depthRenderBuffer, t:fTexture, id:texId, name:name, frameWidth:w, frameHeight:h, texelSizeX:1/w, texelSizeY:1/h};
}

// fboのペアを作る
// nameはreadやwriteの中に入ってるイメージですかね
function create_double_fbo(name, texId, w, h, textureFormat, filterParam){
  // texIdは片方について1増やす
  let fbo1 = create_fbo(name, texId, w, h, textureFormat, filterParam);
  let fbo2 = create_fbo(name, texId + 1, w, h, textureFormat, filterParam);
  let doubleFbo = {};
  doubleFbo.read = fbo1;
  doubleFbo.write = fbo2;
  doubleFbo.swap = function(){
    let tmp = this.read;
    this.read = this.write;
    this.write = tmp;
  }
  doubleFbo.frameWidth = w;
  doubleFbo.frameHeight = h;
  doubleFbo.texelSizeX = 1/w;
  doubleFbo.texelSizeY = 1/h;
  doubleFbo.name = name; // まあ直接アクセスできる方がいいよね
  return doubleFbo;
}

// ここはクリエイトというか...やってることはデータのバッファリングだから、
// 名称的には...まあいいや（めんどくさい）
// で、STATICとDYNAMICは選びたい。
// んでbufferSubData(バッファ、isVBO=T/F)でいいと思う。OK.

// vboの作成
function create_vbo(data){
  // バッファオブジェクトの生成
  let vbo = gl.createBuffer();

  // バッファをバインドする
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

  // バッファにデータをセット
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

  // バッファのバインドを無効化
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // 生成したVBOを返して終了
  return vbo;
}

// IBOを生成する関数
// たとえばLINESを想定しているなら
// 0,32,64,...でつなぎたいなら
// [0,32,32,64,64,96,....,1,33,33,65,65,97,....]とかして作る。
// typeは「UInt16Array」または「UInt32Array」.
function create_ibo(data, type){
  // バッファオブジェクトの生成
  var ibo = gl.createBuffer();

  // バッファをバインドする
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

  // バッファにデータをセット
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new (type)(data), gl.STATIC_DRAW);

  // バッファのバインドを無効化
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // 生成したIBOを返して終了
  return ibo;
}

// attributeの登録
// これlocationとstrideはshaderの情報だけど
// vboはトポロジーの情報よね...
// んでトポロジーだけ差し替えられるのよね...だから両方ともトポロジーから情報を
// 得ているのは不自然だわね。

// だから分離して
// その時有効になってるシェーダープログラムがlocationとstrideを提供して
// そのとき使いたいトポロジーがvboを渡してっていう流れですかね。どっちもattrが提供するっていうのは、ないよね。

function set_attribute(attributes){
  // 引数として受け取った配列を処理する
  for(let name of Object.keys(attributes)){
    const attr = attributes[name];
    // バッファをバインドする
    gl.bindBuffer(gl.ARRAY_BUFFER, attr.vbo);

    // attributeLocationを有効にする
    gl.enableVertexAttribArray(attr.location);

    // attributeLocationを通知し登録する
    gl.vertexAttribPointer(attr.location, attr.stride, gl.FLOAT, false, 0, 0);
  }
}

// --------------------------------------------------------------- //
// utility.

function _RGB(r, g, b){
  if(arguments.length === 1){
    g = r;
    b = r;
  }
  return {r:r, g:g, b:b};
}

function _HSV(h, s, v){
  h = constrain(h, 0, 1);
  s = constrain(s, 0, 1);
  v = constrain(v, 0, 1);
  let _r = constrain(abs(((6 * h) % 6) - 3) - 1, 0, 1);
  let _g = constrain(abs(((6 * h + 4) % 6) - 3) - 1, 0, 1);
  let _b = constrain(abs(((6 * h + 2) % 6) - 3) - 1, 0, 1);
  _r = _r * _r * (3 - 2 * _r);
  _g = _g * _g * (3 - 2 * _g);
  _b = _b * _b * (3 - 2 * _b);
  let result = {};
  result.r = v * (1 - s + s * _r);
  result.g = v * (1 - s + s * _g);
  result.b = v * (1 - s + s * _b);
  return result;
}

// 配列の形で返すやつもあった方がいいと思う
// でないとsetUniformにぶち込むのがめんどくさすぎる
function _HSVArray(h, s, v){
  const obj = _HSV(h, s, v);
  return [obj.r, obj.g, obj.b];
}

// dat.GUIで色情報を放り込むところで#ee4400みたいに入力した場合
// 直接rgbが取り出せずエラーになるので
// p5の関数をかませてオブジェクトが取得できるようにするそのための関数。
// ちなみにpavelさんのあれを含めほとんどのdatはそうなってないですね。
// まあ普通しないので...スライダー動かした方が楽なので。
// ただそれだとピッキングで取得した特定の色を指定したい場合とかに、
// その特定の色が16進数指定だったりしたら困るわけです。そゆことです。

// ...code sandboxで===にしなさいって言われたので修正
function getProperColor(col){
  if(typeof(col) === "object"){
    return {r:col.r, g:col.g, b:col.b};
  }else if(typeof(col) === "string"){
    col = color(col);
    return {r:red(col), g:green(col), b:blue(col)};
  }
  return {r:255, g:255, b:255};
}


// --------------------------------------------------------------- //
// RenderSystem class.
// shaderとprogramとtopologyのsetとあとテクスチャのロケーション
// その組です
// topologyはattribute群ですね
// たとえば立方体やトーラスを登録するわけ（もちろん板ポリも）

class RenderSystem{
  constructor(name, _shader){
    this.name = name;
    this.shader = _shader;
    shader(_shader);
    this.program = _shader._glProgram;
    this.topologies = {};
    this.uniformLocations = {};
  }
  getName(){
    return this.name;
  }
  registTopology(topologyName){
    if(this.topologies[topologyName] !== undefined){ return; }
    this.topologies[topologyName] = new Topology(topologyName);
  }
  getProgram(){
    return this.program;
  }
  getShader(){
    return this.shader;
  }
  getTopology(topologyName){
    return this.topologies[topologyName];
  }
  registUniformLocation(uniformName){
    if(this.uniformLocations[uniformName] !== undefined){ return; }
    this.uniformLocations[uniformName] = gl.getUniformLocation(this.program, uniformName);
  }
  setTexture(uniformName, _texture, locationID){
    gl.activeTexture(gl.TEXTURE0 + locationID);
    gl.bindTexture(gl.TEXTURE_2D, _texture);
    gl.uniform1i(this.uniformLocations[uniformName], locationID);
  }
}

// --------------------------------------------------------------- //
// RenderNode class.
// RenderSystemを登録して名前で切り替える感じ
// こっちで統一しよう。で、トポロジー。
// 一つのプログラムに複数のトポロジーを登録できる
// そして同じプログラムを使い回すことができる
// 立方体やトーラスを切り替えて描画したりできるというわけ

class RenderNode{
  constructor(){
    this.renderSystems = {};
    this.framebufferObjects = {}; // 追加！！
    this.currentRenderSystem = undefined;
    this.currentShader = undefined;
    this.currentTopology = undefined;
    this.useTextureFlag = false;
    this.uMV = new p5.Matrix(); // デフォルト4x4行列
    // uMVをここにコピーして使い回す感じ
  }
  registRenderSystem(renderSystemName, _shader){
    if(this.renderSystems[renderSystemName] !== undefined){ return this; }
    this.renderSystems[renderSystemName] = new RenderSystem(renderSystemName, _shader);
    // regist時に自動的にuseされるイメージ
    this.useRenderSystem(renderSystemName);
    return this;
  }
  useRenderSystem(renderSystemName){
    // 使うプログラムを決める
    this.currentRenderSystem = this.renderSystems[renderSystemName];
    this.currentShader = this.currentRenderSystem.getShader();
    this.currentShader.useProgram();
    return this;
  }
  registTopology(topologyName){
    // currentProgramに登録するので事前にuseが必要ですね
    this.currentRenderSystem.registTopology(topologyName);
    // regist時に自動的にuseされる
    this.useTopology(topologyName);
    return this;
  }
  useTopology(topologyName){
    // たとえば複数のトポロジーを使い回す場合ここだけ切り替える感じ
    this.currentTopology = this.currentRenderSystem.getTopology(topologyName);
    return this;
  }
  regist(renderSystemName, _shader, topologyName){
    // registでまとめてやる処理とする
    this.registRenderSystem(renderSystemName, _shader);
    this.registTopology(topologyName);
    return this;
  }
  use(renderSystemName, topologyName){
    // まとめてやれた方がいい場合もあるので
    //if(this.renderSystems[renderSystemName] == undefined){ return this; }
    this.useRenderSystem(renderSystemName);
    //this.registTopology(topologyName); // 登録済みなら何もしない
    this.useTopology(topologyName);
    return this;
  }
  existFBO(target){
    // あるかどうかチェックする関数. targetがfboの場合はそれが持つnameで見る。
    if(typeof(target) == 'string'){
      return this.framebufferObjects[target] !== undefined;
    }
    return this.framebufferObjects[target.name] !== undefined;
  }
  registFBO(target, texId, w, h, textureFormat, filterParam){
    // fboをセット(同じ名前の場合は新しく作って上書き)
    // targetがstringの場合はcreate_fboするけど
    // fbo自身の場合にはそれをはめこんで終了って感じにする
    if(typeof(target) == 'string'){
      let fbo = create_fbo(target, texId, w, h, textureFormat, filterParam);
      this.framebufferObjects[target] = fbo;
      return this;
    }
    // targetがfboの場合。名前はtargetが持ってるはず。直接放り込む。
    this.framebufferObjects[target.name] = target;
    return this;
  }
  registDoubleFBO(targetName, texId, w, h, textureFormat, filterParam){
    //doubleFBOをセット(同じ名前の場合は新しく作って上書き)
    let fbo = create_double_fbo(targetName, texId, w, h, textureFormat, filterParam);
    this.framebufferObjects[targetName] = fbo;
    return this;
  }
  // resizeは一旦廃止でお願いします
  bindFBO(target){
    // FBOをbindもしくはnullで初期化。ダブルの場合はwriteをセット。viewport設定機能を追加。
    if(typeof(target) == 'string'){
      let fbo = this.framebufferObjects[target];
      if(!fbo){ return this; }
      if(fbo.write){
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.write.f);
        gl.viewport(0, 0, fbo.frameWidth, fbo.frameHeight);
        return this;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.f);
      gl.viewport(0, 0, fbo.frameWidth, fbo.frameHeight);
      return this;
    }
    if(target == null){
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height); // nullの場合は全体
      return this;
    }
    // targetがfboそのものの場合。
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.f);
    gl.viewport(0, 0, target.frameWidth, target.frameHeight);
    return this;
  }
  clearFBO(){
    // そのときにbindしているframebufferのクリア操作
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    return this; // ←これが欲しいだけ。
  }
  setFBO(uniformName, FBOName){
    // FBOを名前経由でセット。ダブルの場合はreadをセット。
    // FBONameがundefinedの状態で運用されることはないうえ、
    // ここはstringであることが要求される。
    // fbo.readのところは!!fbo.readってやると
    // undefinedではありませんって表現できるみたい。その方がいいかも？
    if(FBOName === undefined || (typeof FBOName !== 'string')){
      alert("Inappropriate name setting.");
      noLoop();
      return this;
    }
    let fbo = this.framebufferObjects[FBOName];
    if(!fbo){
      alert("The corresponding framebuffer does not exist.");
      noLoop();
      return this;
    }
    if(!!fbo.read){
      this.setTexture(uniformName, fbo.read.t, fbo.read.id);
      return this;
    }
    this.setTexture(uniformName, fbo.t, fbo.id);
    return this;
  }
  swapFBO(FBOName){
    // ダブル前提。ダブルの場合にswapする
    if(FBOName == null){ return this; }
    let fbo = this.framebufferObjects[FBOName];
    if(fbo.read && fbo.write){ fbo.swap(); }
    return this;
  }
  registAttribute(attributeName, data, stride){
    this.currentTopology.registAttribute(this.currentRenderSystem.getProgram(), attributeName, data, stride);
    return this;
  }
  registAttributes(attrData){
    for(let attrName of Object.keys(attrData)){
      const attr = attrData[attrName];
      this.registAttribute(attrName, attr.data, attr.stride);
    }
    return this;
  }
  setAttribute(){
    // その時のtopologyについて準備する感じ
    this.currentTopology.setAttribute();
    return this;
  }
  registIndexBuffer(data){
    // 65535より大きい場合にUint32Arrayを指定する。って思ったけど...
    // 65536を越えちゃいけないのってインデックスの中身の数字であってインデックス配列の長さじゃないでしょ...
    // だからこの書き方はいけないわけ。だってUnit32Arrayってそういうことでしょ？メモリ考えたら基本Unit16がいいよね。
    let type = Uint16Array;
    if(data.length > 65535){ type = Uint32Array; }
    this.currentTopology.registIndexBuffer(data, type);
    return this;
  }
  bindIndexBuffer(){
    this.currentTopology.bindIndexBuffer();
    return this;
  }
  registUniformLocation(uniformName){
    this.currentRenderSystem.registUniformLocation(uniformName);
    return this;
  }
  setTexture(uniformName, _texture, locationID){
    this.currentRenderSystem.setTexture(uniformName, _texture, locationID);
    this.useTextureFlag = true; // 1回でも使った場合にtrue
    return this;
  }
  setUniform(uniformName, data){
    this.currentShader.setUniform(uniformName, data);
    return this;
  }
  clear(){
    // 描画の後処理
    // topologyを切り替える場合にも描画後にこれを行なったりする感じ
    // 同じプログラム、トポロジーで点描画や線描画を行う場合などは
    // その限りではない（レアケースだけどね）
    this.currentTopology.clear();
    // textureを使っている場合はbindを解除する
    if(this.useTextureFlag){
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.useTextureFlag = false;
    }
    return this;
  }
  setViewport(x, y, w, h){
    gl.viewport(x, y, w, h);
    return this;
  }
  setMatrixStandard(){
    // uMVをuMVMatrixとして一通り通知する関数
    const sh = this.currentShader;
    sh.setUniform('uProjectionMatrix', _gl.uPMatrix.mat4);
    sh.setUniform('uModelViewMatrix', this.uMV.mat4);
    sh.setUniform('uViewMatrix', _gl._curCamera.cameraMatrix.mat4);
    _gl.uNMatrix.inverseTranspose(this.uMV);
    sh.setUniform('uNormalMatrix', _gl.uNMatrix.mat3);
  }
  setMatrix(tf){
    // uMVとuPとuViewとuNormalを登録(uNormalは使われないこともあるけど)
    //let uMV = _gl.uMVMatrix.copy();
    // this.uMVにuMVMatrixの内容をコピー
    for(let i = 0; i < 16; i++){
      this.uMV.mat4[i] = _gl.uMVMatrix.mat4[i];
    }
    if(tf !== undefined){
      this.transform(tf); // tfは配列。tr, rotX, rotY, rotZ, scale.
      // rotAxisも一応残しといて。
    }
    this.setMatrixStandard();
    return this;
  }
  transform(tf){
    // tfのコマンドに従っていろいろ。
    for(let command of tf){
      const name = Object.keys(command)[0];
      const value = command[name];
      switch(name){
        case "tr":
          // 長さ1の配列の場合は同じ値にする感じで
          if(value.length === 1){ value.push(value[0], value[0]); }
          this.uMV.translate(value);
          break;
        // rotX～rotZはすべてスカラー値
        case "rotX":
          this.uMV.rotateX(value); break;
        case "rotY":
          this.uMV.rotateY(value); break;
        case "rotZ":
          this.uMV.rotateZ(value); break;
        case "rotAxis":
          // 角度と、軸方向からなる長さ4の配列
          this.uMV.rotate(...value); break;
        case "scale":
          // 長さ1の場合は同じ値にする。
          if(value.length === 1){ value.push(value[0], value[0]); }
          this.uMV.scale(...value); break;
      }
    }
  }
  setVertexColor(){
    const sh = this.currentShader;
    sh.setUniform('uUseColorFlag', 0);
    return this;
  }
  setMonoColor(col, a = 1){
    const sh = this.currentShader;
    sh.setUniform('uUseColorFlag', 1);
    sh.setUniform('uMonoColor', [col.r, col.g, col.b, a]);
    return this;
  }
  setUVColor(){
    const sh = this.currentShader;
    sh.setUniform("uUseColorFlag", 2);
    return this;
  }
  setDirectionalLight(col, x, y, z){
    const sh = this.currentShader;
    sh.setUniform('uUseDirectionalLight', true);
    sh.setUniform('uDirectionalDiffuseColor', [col.r, col.g, col.b]);
    sh.setUniform('uLightingDirection', [x, y, z]);
    return this;
  }
  setAmbientLight(col){
    const sh = this.currentShader;
    sh.setUniform('uAmbientColor', [col.r, col.g, col.b]);
    return this;
  }
  setPointLight(col, x, y, z, att0 = 1, att1 = 0, att2 = 0){
    // att0,att1,att2はattenuation（減衰）
    // たとえば0,0,1だと逆2乗の減衰になるわけ
    const sh = this.currentShader;
    sh.setUniform('uUsePointLight', true);
    sh.setUniform('uPointLightDiffuseColor', [col.r, col.g, col.b]);
    sh.setUniform('uPointLightLocation', [x, y, z]);
    sh.setUniform('uAttenuation', [att0, att1, att2]);
    return this;
  }
  drawArrays(mode, first, count){
    // 引数はドローコール、スタートと終わりなんだけどね。んー。
    // トポロジーがサイズ持ってるからそれ使って描画？
    if(arguments.length == 1){
      first = 0;
      count = this.currentTopology.getAttrSize();
    }
    gl.drawArrays(mode, first, count);
    return this;
  }
  drawElements(mode, count){
    // 大きい場合はgl.UNSIGNED_INTを指定
    const _type = this.currentTopology.getIBOType();
    const type = (_type === Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT);
    // 基本的にサイズをそのまま使うので
    if(count === undefined){ count = this.currentTopology.getIBOSize(); }
    gl.drawElements(mode, count, type, 0);
    return this;
  }
  flush(){
    gl.flush();
    return this;
  }
}

// --------------------------------------------------------------- //
// Topology class.
// topologyのsetを用意して、それで・・・うん。
// 同じ内容でもプログラムが違えば違うトポロジーになるので
// 使い回しはできないですね・・・（ロケーション）

class Topology{
  constructor(name){
    this.name = name;
    this.attributes = {}; // Object.keysでフェッチ。delete a[name]で削除。
    this.attrSize = 0; // 使ってないから廃止でいいよね...？
    this.ibo = undefined;
    this.iboType = undefined;
    this.iboSize = 0;
  }
  getName(){
    return this.name;
  }
  getAttrSize(){
    return this.attrSize;
  }
  getIBOType(){
    return this.iboType;
  }
  getIBOSize(){
    return this.iboSize;
  }
  registAttribute(program, attributeName, data, stride){
    let attr = {};
    attr.vbo = create_vbo(data);
    attr.location = gl.getAttribLocation(program, attributeName);
    attr.stride = stride;
    this.attrSize = Math.floor(data.length / stride); // attrの個数
    this.attributes[attributeName] = attr;
  }
  setAttribute(){
    set_attribute(this.attributes);
  }
  registIndexBuffer(data, type){
    this.ibo = create_ibo(data, type);
    this.iboType = type;
    this.iboSize = data.length; // iboのサイズ
  }
  bindIndexBuffer(){
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
  }
  clear(){
    // 描画が終わったらbindを解除する
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    if(this.ibo !== undefined){ gl.bindBuffer(gl.ELEMENT_BUFFER, null); }
    return this;
  }
}

// ------------------------------------------------------------ //
// getNormals
// verticesは3つずつ頂点座標が入ってて
// indicesは3つずつ三角形の頂点のインデックスが入ってるわけね

// indicesの3*i,3*i+1,3*i+2それぞれに対して
// たとえばk=indices[3*i]に対して
// verticesの3*k,3*k+1,3*k+2番目の成分を取り出してベクトルを作る
// それを3つやる
// 次にv0,v1,v2で作る三角形のそれぞれの内角の大きさを出す
// なお外積とarcsinで出すのでそのまま正規化されてる
// 向きについてはv0,v1,v2の順に時計回りであることが想定されてる
// 得られた角度を法線ベクトル（大きさ1）にかけて
// それぞれk番目のnormalsに加える
// 終わったらnormalsをすべて正規化
// あとは成分ごとにばらして終了
function getNormals(vertices, indices){
  let normals = [];
  for(let i = 0; i < Math.floor(vertices.length / 3); i++){
    normals.push(createVector(0, 0, 0));
  }
  let v0 = createVector();
  let v1 = createVector();
  let v2 = createVector();
  for(let i = 0; i < Math.floor(indices.length / 3); i++){
    const id = [indices[3*i], indices[3*i+1], indices[3*i+2]];
    v0.set(vertices[3*id[0]], vertices[3*id[0]+1], vertices[3*id[0]+2]);
    v1.set(vertices[3*id[1]], vertices[3*id[1]+1], vertices[3*id[1]+2]);
    v2.set(vertices[3*id[2]], vertices[3*id[2]+1], vertices[3*id[2]+2]);
    const w0 = p5.Vector.sub(v1, v0);
    const w1 = p5.Vector.sub(v2, v0);
    const w2 = p5.Vector.sub(v2, v1);
    const u0 = p5.Vector.cross(w0, w1);
    const u1 = p5.Vector.cross(w0, w2);
    const u2 = p5.Vector.cross(w1, w2);
    const m0 = w0.mag();
    const m1 = w1.mag();
    const m2 = w2.mag();
    const sin0 = u0.mag() / (m0 * m1);
    const sin1 = u1.mag() / (m0 * m2);
    const sin2 = u2.mag() / (m1 * m2);
    const angle0 = asin(sin0);
    const angle1 = asin(sin1);
    const angle2 = asin(sin2);
    const n = p5.Vector.normalize(u0);
    normals[id[0]].add(createVector(n.x*angle0, n.y*angle0, n.z*angle0));
    normals[id[1]].add(createVector(n.x*angle1, n.y*angle1, n.z*angle1));
    normals[id[2]].add(createVector(n.x*angle2, n.y*angle2, n.z*angle2));
  }
  let result = [];
  for(let n of normals){
    n.normalize();
    result.push(...n.array());
  }
  return result;
}

// -----------------------------------------------------------------------------------------------------
// もう堂々とgeometriesって書きたいね...
// topologies.

// シンプルにトーラス
// aが長半径でbが短半径
function getTorusData(dtX, dtY, a=5, b=1){
	let v=[];
	let c=[];
	for(let phi = 0; phi < 2 * PI; phi += 2 * PI / dtY){
		for(let theta = 0; theta < 2 * PI; theta += 2 * PI / dtX){
			let x = a * sin(theta) + b * cos(phi) * sin(theta);
			let y = a * cos(theta) + b * cos(phi) * cos(theta);
			let z = b * sin(phi);
			v.push(x, y, z);
			const col = _HSV(0.55, 0.5+0.5*cos(theta), 1);
			c.push(col.r, col.g, col.b, 1);
		}
	}

	let f=[];

	for(let k = 0; k < dtX * (dtY - 1); k += dtX){
		for(let i = k; i < k + dtX - 1; i++){
			f.push(i, i + 1 + dtX, i + 1, i, i + dtX, i + 1 + dtX);
			//f.push(i, i + 1, i + 1 + dtX, i, i + 1 + dtX, i + dtX);
		}
		f.push(k + dtX - 1, k + dtX, k, k + dtX - 1, k + 2 * dtX - 1, k + dtX);
		//f.push(k + dtX - 1, k, k + dtX, k + dtX - 1, k + dtX, k + 2 * dtX - 1);
	}
	let k = dtX * (dtY - 1);
	for(let i = 0; i < dtX - 1; i++){
		f.push(i + k, i + 1, i + k + 1, i + k, i, i + 1);
		//f.push(i + k, i + k + 1, i + 1, i + k, i + 1, i);
	}
	f.push(dtX * dtY - 1, 0, k, dtX * dtY - 1, dtX - 1, 0);
	//f.push(dtX * dtY - 1, k, 0, dtX * dtY - 1, 0, dtX - 1);

  // fに面情報を入れる
  // vとfから法線を作る。
  let n = getNormals(v, f);
  // 返す。
  return {v:v, f:f, c:c, n:n};
}
