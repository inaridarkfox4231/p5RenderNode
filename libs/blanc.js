/* なにもない */
// _gl, glを元にexを生成する。
// _glはcreateShaderしてくれるので使いたいですね
// shaderのところも_gl...割と使ってるなぁ...便利だから仕方ないね。

// RenderNodeのコンセプト
// shaderからRenderSystem作って名前で管理
// vboからTopology作って名前で管理(STATICかDYNAMICか指定)
// んで
// ノード経由で使うRenderSystemを指定
// ノード経由で使うTopologyを指定
// bind各種
// uniformなどなど
// レンダリング
// flush!

// modelも扱えるようにするよ...おいおいね...

// ていうか紐付け要らない？のか？

// 20220925
// 言葉の乱用でわけわからないことになってるよ。
// ちょっとおかしなことになりつつある。
// fboって何？iboって何？vboとは？vaoとは？きちんと定義しないと混乱する。
// 遅々として進まないのはそういうこと。
// 分けないでいいところは分けないで、拡張性が一番重要なので、そこ重視でいこう。
// 多分破綻する、これだと。なんかうまい方法を...考えないと...
// pavelさん丸パクリでもいいと思う

// ちょっとこの路線は、ないわ。

// その前に卍解やっとこう。ばん！かい！
p5.RendererGL.prototype._initContext = function() {
  try {
    this.drawingContext =
      this.canvas.getContext('webgl2', this._pInst._glAttributes) ||
      this.canvas.getContext('experimental-webgl', this._pInst._glAttributes);
    if (this.drawingContext === null) {
      throw new Error('Error creating webgl context');
    } else {
      var gl = this.drawingContext;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      this._viewport = this.drawingContext.getParameter(
        this.drawingContext.VIEWPORT
      );
    }
  } catch (er) {
    throw er;
  }
};
// これでwebglでやろうとしてたことは大体webgl2になります。よかったね。

// レンダリング関連は相当いじることになりそう...つまり指定の仕方が変わるということ。
// まずシェーダとトポロジーの紐付けは
// 行いません
// 実行時にやってなかったら1回だけやります
// それはシェーダーサイドがトポロジー観たときに「お前初見だな！」ってなった場合に1回だけやります
// それとは別にbufferSubDataを実行できます
// これについてはbufferDataがもう済んでいることが前提ですが...(最低1回は必要)
// 最初だけ。以降はsubでOK.その際引数にFloat32のなんかを取る...まあそんな感じで。
// つまりSTATICとか指定できる、指定はvboもiboも別、というかそうか
// webgl2だからvaoとiboみたいにできる...？

// vaoめっちゃ便利だね～っていうかそうか、便利だね...vboの保持が要らないっていうのは、いいね...
// しかし動的更新との相性が気になるところ。
// あとシェーダーとvaoのマッチングは先にやっとかないとだね...

// vaoは段階的に。まずはvboで諸々実装したうえでvaoにしていく感じで。vaoでも動的更新できるといいねぇ。
// てか選ばせろよ。
// framebufferもおいおい拡張していく感じで。ライブラリ化しないと始まらないので。

// ていうか....

// 根本的な問題を発見してしまった。RenderNodeを_gl,glベースで構築するって話じゃなかったっけ？？？
// これだと
// ...
// ですね...おかしいや。あれ～？
// さらに言うと_glだけ渡すことになっててそこからgl=_gl.GLでglを用意して云々
// そういう話だった
// けれど。
// まあ、いいか...（よくないか なにこれ  くコ:彡）


const p5wgex = function(_gl, gl){

  // RGBをRGBのまま返す関数. 指定は自由。
  function _RGB(r, g, b){
    if(arguments.length === 1){
      g = r;
      b = r;
    }
    return {r:r, g:g, b:b};
  }

  // HSVをRGBにしてくれる関数. ただし0～1で指定してね
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

  // 直接配列の形で返したい場合はこちら
  function _HSVArray(h, s, v){
    const obj = _HSV(h, s, v);
    return [obj.r, obj.g, obj.b];
  }

  // colがconfig経由の値の場合、それを正しく解釈できるようにするための関数.
  // 戻り値は0～255指定。なのでお手数ですが255で割ってください。
  function getProperColor(col){
    if(typeof(col) === "object"){
      return {r:col.r, g:col.g, b:col.b};
    }else if(typeof(col) === "string"){
      col = color(col);
      return {r:red(col), g:green(col), b:blue(col)};
    }
    return {r:255, g:255, b:255};
  }

  // loadAttributes.
  function loadAttributes(pg){
    // 属性の総数を取得
    const numAttributes = gl.getProgramParameter(pg, gl.ACTIVE_ATTRIBUTES);
    const attributes = {};
    // 属性を格納していく
    for(let i = 0; i < numAttributes; i++){
      const attr = {};
      const attrInfo = gl.getActiveAttrib(pg, i); // 情報を取得
      const name = attrInfo.name;
      attr.name = name; // 名前
      attr.location = gl.getAttribLocation(pg, name); // bindに使うlocation情報
      attr.type = attrInfo.type; // bindに使うgl.FLOATなどの型情報
      attr.size = attrInfo.size; // bindに使う3,4等のサイズ情報。たとえばfloat4なら32bitFloatが4つで16バイトみたいな。
      attributes[name] = attr; // 登録！
    }
    return attributes;
  }

  // loadUniforms.
  function loadUniforms(pg){
    // ユニフォームの総数を取得
    const numUniforms = gl.getProgramParameter(pg, gl.ACTIVE_UNIFORMS);
    const uniforms = {};
    // ユニフォームを格納していく
    let samplerIndex = 0; // サンプラのインデックスはシェーダー内で0ベースで異なってればOK, を検証してみる。
    for(let i = 0; i < numUniforms; i++){
      const uniform = {};
      const uniformInfo = gl.getActiveUniform(pg, i); // ほぼ一緒ですね
      const name = uniformInfo.name;
      uniform.name = name;
      uniform.location = gl.getUniformLocation(pg, name);
      uniform.type = uniformInfo.type; // gl.FLOATなどの型情報
      if(uniform.type === gl.SAMPLER_2D){
        uniform.samplerIndex = samplerIndex++; // 名前からアクセスして...setTextureで使う
      }
      uniforms[name] = uniform;
    }
    return uniforms;
  }

  // create_vbo.
  function createVBO(info){
    const vbo = gl.createBuffer();
    // bindする. bindされているものだけが有効になる。
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    // bufferにデータをセット。DYNAMICの場合でもbufferDataでスペースを確保することが必須。
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(info.data), info.usage);
    // 解除
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return vbo;
  }

  // vbaもついでに作り方確認しておこうかと

  // ibo作ろう.
  function createIBO(info){
    const ibo = gl.createBuffer();
    // bindする。
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    // データをセットする
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new (info.type)(info.data), info.usage);
    // 解除
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return ibo;
  }

  // fboですね
  // infoオブジェクトで指定
  // name, texId, w, h, textureFormat, filterParam
  // texIdは廃止...ですね。で、w,h,textureFormat,textureFilter,textureWrapの3つを指定できるように
  // デフォルトはまずUNSIGNED_BYTE(時にFLOAT,HALF_FLOAT)
  // filterParamはNEARESTが基本だけど流体とかならLINEARを使うかも
  // wrapはまあCLAMP_TO_EDGEが基本だけど他のを使うこともあるかも？って感じ。
  function createFBO(info){
    // framebufferを生成
    let framebuffer = gl.createFramebuffer();

    // bindする。その間対象はこのframebufferとなる。
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    // 深度バッファ用レンダーバッファの生成とバインド
    let depthRenderbuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderbuffer);
    // レンダーバッファを深度バッファとして設定
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, info.w, info.h);
    // フレームバッファにレンダーバッファを関連付ける
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderbuffer);

    // 次にtextureを生成する
    let fTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    // フレームバッファ用のテクスチャをバインド
    gl.bindTexture(gl.TEXTURE_2D, fTexture);
    // フレームバッファ用のテクスチャにカラー用のメモリ領域を確保
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, info.w, info.h, 0, gl.RGBA, info.textureFormat, null);

    // テクスチャパラメータ
    // このNEARESTのところを可変にする
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, info.textureFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, info.textureFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, info.textureWrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, info.textureWrap);
    // フレームバッファにテクスチャを関連付ける
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fTexture, 0);

    // 中身をクリアする(clearに相当する)
    gl.viewport(0, 0, info.w, info.h);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    // 各種オブジェクトのバインドを解除
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // オブジェクトを返して終了。texelSizeって何だっけ...まあいいや。とりあえずカット。
    return {
      f: framebuffer, d: depthRenderbuffer, t: texture,
      name: info.name, w: w, h: h
    }
  }

  // double.やることとしては同じように2枚作ってswap関数で入れ替えできるようにする。
  function createDoubleFBO(name, info){
    let fbo0 = createFBO(name, info);
    let fbo1 = createFBO(name, info);
    return {
      read: fbo0,
      write: fbo1,
      swap: function(){
        let tmp = this.read;
        this.read = this.write;
        this.write = tmp;
      },
      name: info.name, w: info.w, h: info.h
    }
  }

  // Pinselです. 絵筆
  // 命名法に問題が...
  // 本家の方でshaderからattrの情報を取り出すやり方が紹介されてるので使っちゃおう
  // uniformの方も同じようにやろう（後学のために）
  // uniformはindexさえ違ってればいいみたいなので
  // あっちのように番号管理するのを実験的にやめてみるか...うまくいくかわからんけど。
  // uniformに持たせてtextureのactivateで使う。
  // ゆくゆくはキューブマップとかも扱いたいのよ. それでsetTexture2D.
  // このメソッドグローバル化して分離するか...
  // Pinsel.
  // 作るのに必要なもの：vsとfs. RenderNodeがshaderを作り、それにより生成される。
  class Pinsel{
    constructor(name, _shader){
      this.name = name;
      this.shader = _shader;
      _gl.shader(_shader);
      this.program = _shader._glProgram;
      this.attributes = loadAttributes(this.program); // 属性に関するshader情報
      this.uniforms = loadUniforms(this.program); // ユニフォームに関するshader情報
      this.textureBinded = false;
    }
    setTexture2D(name, _texture){
      const uniform = this.uniforms[name];
      // activateする番号とuniform1iで登録する番号は一致しており、かつsamplerごとに異なる必要があるということ
      gl.activeTexture(gl.TEXTURE0 + uniform.samplerIndex);
      gl.bindTexture(gl.TEXTURE_2D, _texture);
      gl.uniform1i(uniform.location, uniform.samplerIndex);
      this.textureBinded = true;
    }
    getShader(){
      return this.shader;
    }
    getAttributes(){
      return this.attributes;
    }
    getUniforms(){
      return this.uniforms;
    }
    clear(){
      if(!this.textureBinded){ return; }
      // 2Dや3Dのテクスチャがbindされていたら解除(今は2D only.)
      if(gl.getParameter(gl.TEXTURE_BINDING_2D) !== null){
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      this.textureBinded = false;
    }
  }

  // geometryです. 図形
  // infoArrayについて。各成分は順不同OK.
  // 必須：name(shader内で使われるもの), data(長さはタイプに応じた整合性が無いとダメ)
  // たとえばvec3で100個とかならfloatが300個、それとは別にvec2あるならそっちは200個。
  // 任意：usage(defaultはgl.STATIC_DRAWだが動的更新するならgl.DYNAMIC_DRAWにする)
  // 例：[{name:aPosition, data:[-1,-1,-1,1,1,-1,1,1]}, {name:aColor, data:[1,0,0,0,1,0,0,0,1,1,1,1]}] (vec2 / vec3)
  class Geometry{
    constructor(name, infoArray){
      this.name = name;
      this.vbos = this.createAttrs(infoArray); // 名前とvboの組でusageも追加で
    }
    createVBOs(infoArray){
      const vbos = {};
      for(let info of infoArray){
        const result = {};
        const name = info.name;
        if(info.usage === undefined){ info.usage = gl.STATIC_DRAW; }
        result.name = name;
        result.vbo = createVBO(info);
        result.usage = info.usage;
        vbos[name] = result;
      }
    }
    getVBOs(){
      return this.vbos;
    }
  }

  // iboです. モディファイア（インデックスの取り扱い方を変えるだけ）
  // infoについて
  // 必須：name(何でもいいけどかぶらないで), data(インデックスの配列)
  // 任意：large(デフォルトはfalseでこの場合通常ルート、頂点の個数が65536以上ならこれをtrueにする)
  // usage(よほどのことが無ければ未指定でgl.STATIC_DRAWでOK)
  // 例：{name:"board", data:[0,1,2,2,1,3]}
  class IndexBufferObject{
    constructor(name, info){
      this.name = name;
      this.validateInfo(info);
      this.ibo = createIBO(info); // indicesはinfo.dataに入ってる
      this.usage = info.usage; // 動的更新で使う可能性
      this.count = info.data.length; // drawElementsで使う
      this.drawType = info.drawType; // drawElementsで使う
    }
    validateInfo(info){
      if(info.usage === undefined){ info.usage = gl.STATIC_DRAW; } // これも基本STATICですね...
      if(info.large === undefined){ info.large = false; } // largeでT/F指定しよう. 指定が無ければUint16.
      if(info.large){
        info.type = Uint32Array; info.drawType = gl.UNSIGNED_INT;
      }else{
        info.type = Uint16Array; info.drawType = gl.UNSIGNED_SHORT;
      }
    }
  }

  // framebufferのクラスも作るか...
  // infoについて
  // 必須：name, w, h. 絵に使うならこんだけでOK.
  // 任意：double: 基本はシングルでその場合は省略していい。
  // textureFormat: 基本は色情報のUNSIGNED_INTだけど、流体とかではFLOATやHALF_FLOATを使うわけ。
  // textureFilter. 基本はNEARESTだけどLINEARにするとサンプリングしやすい、色ならNEARESTだけどどっちもありか。
  // textureWrap. 基本は端っこで切るgl.CLAMP_TO_EDGEだけどシームレスとかならREPEATを使う場合もありそう。モザイクとか？
  class FramebufferObject{
    constructor(name, info, double = false){
      this.name = name;
      this.validateInfo(info);
      this.double = info.double; // T/Fで管理
      if(double){
        this.fbo = createDoubleFBO(name, info);
      }else{
        this.fbo = createFBO(name, info);
      }
    }
    validateInfo(info){
      // double.
      if(info.double === undefined){ info.double = false; }
      // textureFormat.
      if(info.textureFormat === undefined){ info.textureFormat = gl.UNSIGNED_INT; }
      // textureFilter.
      if(info.textureFilter === undefined){ info.textureFilter = gl.NEAREST; }
      // textureWrap.
      if(info.textureWrap === undefined){ info.textureWrap = gl.CLAMP_TO_EDGE; }
    }
  }

  // RenderNode.
  class RenderNode{
    constructor(){
      this.pinsels = {}; // shaderProgramです
      this.geometries = {}; // vboをまとめたもの、あるいはvao
      this.ibos = {}; // iboたちの概念も切り離す。
      this.fbos = {}; // おいおいね
      // doubleと切り離す必要はないと思うよ
      this.currentPinsel = undefined; // そのとき使っているプログラム、というか絵筆
      this.currentShader = undefined; // その時使ってるシェーダー。
      this.currentGeometry = undefined; // そのとき使っているジオメトリ、というか図形
      this.currentIndexbuffer = undefined; // そのとき使ってるIBOですね
      this.currentFramebuffer = undefined; // そのときbindしてるFBO.
    }
    registPinsel(name, vs, fs){
      // vsとfsからshaderを作成
      const _shader = _gl.createShader(vs, fs);
      // シェーダーの作成に失敗した場合
      if(!_shader){ console.log("shader is inValid. shaderName:" + name); return this; }
      const newPinsel = new Pinsel(name, _shader);
      // 登録（名前重複の場合は上書き）
      this.pinsels[name] = newPinsel;
      return this;
    }
    registGeometry(name, infoArray){
      // attrDataの内容はname,size,dataでいいと思う。
      const newGeometry = new Geometry(name, infoArray);
      this.geometries[name] = newGeometry;
      return this;
    }
    registIBO(name, info){
      // typeは65536頂点以上であればUint32Arrayにしないとやばいんだよって. でなければメモリもったいないからこれで。以上。
      const newIBO = new IndexBufferObject(name, info);
      this.ibos[name] = newIBO;
      return this;
    }
    registFBO(name, info){
      const newFBO = new FramebufferObject(name, info);
      this.fbos[name] = newFBO;
      return this;
    }
    registDoubleFBO(name, info){
      // double情報を付与して渡すだけ
      info.double = true;
      return this.registFBO(name, info);
    }
    usePinsel(name){
      this.currentPinsel = this.pinsels[name];
      this.currentShader = this.currentPinsel.getShader();
      this.currentShader.useProgram();
      return this;
    }
    useGeometry(name){
      this.currentGeometry = this.geometries[name];
      return this;
    }
    use(pinselName, geometryName){
      this.usePinsel(pinselName);
      this.useGeometry(geometryName);
      return this;
    }
    setAttributes(){
      const attributes = this.currentPinsel.getAttributes();
      const vbos = this.currentGeometry.getVBOs();
      // どっちかっていうとvbosの方に従うべきかな...
      // 使わないattributeがあってもいいので
      for(let attrName of Object.keys(vbos)){
        const vbo = vbos[attrName].vbo;
        const attr = attributes[attrName];
        // vboをbindする
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        // attributeLocationを有効にする
        gl.enableVertexAttribArray(attr.location);
        // attributeLocationを通知し登録する
        gl.vertexAttribPointer(attr.location, attr.size, attr.type, false, 0, 0);
      }
      return this;
    }
    bindIBO(name){
      this.currentIndexbuffer = this.ibos[name];
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.currentIndexbuffer.ibo);
      return this;
    }
    bindFBO(name){
      this.currentFramebuffer = this.fbos[name];
      const fbo = this.currentFramebuffer.fbo;
      if(typeof(name) === 'string'){
        if(fbo.write !== undefined){
          // doubleの場合はwriteをセット。ここに書き込む。
          gl.bindFramebuffer(gl.FRAME_BUFFER, fbo.write.f);
          gl.viewport(0, 0, fbo.w, fbo.h);
        }else{
          // 通常の場合はそのままセット
          gl.bindFramebuffer(gl.FRAME_BUFFER, fbo.f);
          gl.viewport(0, 0, fbo.w, fbo.h);
        }
      }else if(name === null){
        // nullの場合は全体
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.vierport(0, 0, width, height);
      }
      return this;
    }
    clearFBO(){
      // そのときにbindしているframebufferのクリア操作
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      return this;
    }
    setFBOTexture2D(uniformName, fboName){
      if(fboName === undefined || (typeof(fboName) !== 'string')){
        alert("Inappropriate name setting.");
        noLoop();
        return this;
      }
      const fbo = this.fbos[fboName];
      if(fbo.read !== undefined){
        this.currentPinsel.setTexture2D(uniformName, fbo.read.t);
      }else{
        this.currentPinsel.setTexture2D(uniformName, fbo.t);
      }
      return this;
    }
    swapFBO(fboName){
      const fbo = this.fbos[fboName].fbo;
      if(fbo.read !== undefined){ return this; }
      fbo.
    }
    clear(){
      // 各種bind解除
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindBuffer(gl.ELEMENT_BUFFER, null);
      this.currentPinsel.clear();
      this.currentIndexbuffer = undefined;
    }
    flush(){
      // flush.
      gl.flush();
    }
  }

  // 行列2x2
  class Matrix2x2{
    constructor(){

    }
  }

  // 行列3x3
  class Matrix3x3{
    constructor(){

    }
  }

  // 行列4x4
  class Matrix4x4{
    constructor(){

    }
  }

  const ex = {};
  ex.createShader = createShader;

  return ex;
}
