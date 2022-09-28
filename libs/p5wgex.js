// やり直し！

// 行列って要するに特定のライティング用のシェーダ使うときのカメラ操作とか
// オブジェクトに回転や平行移動をさせたい場合の簡易オプションみたいな位置づけだから
// それ専用のモジュール用意したらいいわね。どうするかな～そのままパクってもいいんだけど...

// というわけで一通りやったよ～疲れた
// てか視錐台見えないっての。何かしらの方法で可視化しないと厳しいわね。
// いつかね。
// テストするにあたり、パイプラインを...ていうかシェーダーを用意しないと。まあそれは
// グローバルで自前で用意するんだけど。
// だって備え付けても仕方ないでしょいじってなんぼなんだから。中身見えてないと色々めんどくさいし。

// カリングについても突っ込まないといけないんだよなぁ...仕方ないんだけど。あれ苦手。でもやらねばね。

// 20220927
// 一応動いたわ...寝るわ...
// Painter側のsizeとtypeは意図した挙動しないということで廃止
// Figureサイドでsizeを2とか3とか指定したうえでcountで割って...って感じで。よろしくで。
// Figureのtypeが今んとこgl.FLOAT固定だけどそのうち色々使う機会が来る...かもしれない。
// 動的更新は今んとこ実行する方法...まあそのうち用意するつもり。Float32の配列を渡してそれ使って...
// グローバルで...とかいう感じで。
// 行列も含めて検証することが山積み。大変だ～。
// webgl2表記でシェーダー書いたりとか。色々ね。

// 手始めに「createShader」と「shader」、これを移してしまう。
// _glでアクセスできないので...（意外だった）まあ仕方ないわね。setUniformもおいおい移していくけど...（未定）

// setUniform、中でuseProgramしてるのか...分けたいんだよな～
// ていうかこの方法でshader作っちゃうとsetUniformが付与されないわけね。まずいわな。

// キャッシュデータのは多分、同じ内容を毎フレームsetUniformするのが無駄が多いんだと思う。でもなぁ...
// テクスチャとか考えるとそれ別に要らないんじゃ...って思ってしまう（いいけど）
// あとこれで網羅したわけじゃないってのはちょっと気になるかも。

// 中でしか使わない関数(private)は_で始めた方がいいと思う。ちょっと修正が必要かも。

// background(~~~)だっけ
// 単色で塗りつぶすのとか欲しいかも

// 20220927
// clearをunbindに改称（clearは別の意味で使いたいので）
// こっちでしか使わない関数に_を付ける（エクスポートしない関数）

// 20220928
// webgl2ではtexImage2Dでの指定の仕方について、typeがgl.FLOATの場合、ちょっとややこしいようで...
// 具体的には「https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texImage2D」のInternalFormatのとこに
// リンクが：「https://registry.khronos.org/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE」
// 張ってあってこの組み合わせじゃないといけない。つまりgl.RGBAーgl.RGBAの場合UNSIGNED_BYTE(0～255)を含む3通りで
// gl.FLOATは対象外！
// webgl1のようにやりたかったら下から2番目の「gl.RGBA32Fーgl.RGBAーgl.FLOAT」にしないといけないのだ。
// ...適宜修正しないとね...

// それ以前に
// https://stackoverflow.com/questions/69016956/webgl2-incomplete-framebuffer
// RGBA32Fは書き込み不可能？？「https://registry.khronos.org/OpenGL/specs/es/3.0/es_spec_3.0.pdf#page=143&zoom=100,168,666」
// renderableではない、ということ。つまり書き込めるテクスチャとして使えないと...で、調べたらtexStorage2Dというのが
// でてきました。こっちを使え...？というかwebgl2においてそもそもtexImage2Dが非推奨なんだそうです。
// 参考：https://ics.media/web3d-maniacs/webgl2_texture2darray/
// でもpavelさんの流体のは普通にtexImage2Dで取得してたし、書き込んでたし。つじつま合わないんですよね...

// pavelさんこれ使ってた：
// https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float
// 拡張機能です。gl.getExtension('EXT_color_buffer_float');
// これで使えるようになるとのこと。はぁ...なるほどね...これでcolor-renderableになるわけだ...
// webgl2だから拡張無しでOKかと思ったらそういうわけにはいかないわけだ。

// gl定数の辞書は...リスト作っておいて文字列でアクセスできるようにしましょうね...汎用性考えるとね。
// 辞書作らないとキリがないので。

// --------------------------- //
// まず、...
// うまくいくんかいな。まあ別に死ぬわけじゃないし。死にかけたし。気楽にやろ。死ぬことが無いなら何でもできる。

// まるごと移してしまえ。えいっ
// でもってalphaをtrueで上書き。えいっ（どうなっても知らないよ...）
p5.RendererGL.prototype._setAttributeDefaults = function(pInst) {
  // See issue #3850, safer to enable AA in Safari
  var applyAA = navigator.userAgent.toLowerCase().includes('safari');
  var defaults = {
    alpha: true, // ここ。いいのかなあ...
    depth: true,
    stencil: true,
    antialias: applyAA,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    perPixelLighting: true
  };

  if (pInst._glAttributes === null) {
    pInst._glAttributes = defaults;
  } else {
    pInst._glAttributes = Object.assign(defaults, pInst._glAttributes);
  }
  return;
};

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

// ばんかいしたので本題
// これがp5webglのexです、RenderNodeは_glから生成します。
const p5wgex = (function(){

  // ---------------------------------------------------------------------------------------------- //
  // utility.

  // HSVをRGBにしてくれる関数. ただし0～1で指定してね
  function hsv2rgb(h, s, v){
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
  function hsvArray(h, s, v){
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

  // ---------------------------------------------------------------------------------------------- //
  // utility for RenderNode.

  // シェーダーを作る
  function _getShader(name, gl, source, type){
    if(type !== "vs" && type !== "fs"){
      console.log("invalid type");
      return null;
    }

    // シェーダーを代入
    let _shader;
    if(type === "vs"){ _shader = gl.createShader(gl.VERTEX_SHADER); }
    if(type === "fs"){ _shader = gl.createShader(gl.FRAGMENT_SHADER); }

    // コンパイル
    gl.shaderSource(_shader, source);
    gl.compileShader(_shader);

    // 結果のチェック
    if(!gl.getShaderParameter(_shader, gl.COMPILE_STATUS)){
      console.error(gl.getShaderInfoLog(_shader));
      console.log("name: " + name + ", " + type + ", compile failure.");
      return null;
    }

    return _shader;
  }

  // プログラムを作る
  function _getProgram(name, gl, sourceV, sourceF){
    const vShader = _getShader(name, gl, sourceV, "vs");
    const fShader = _getShader(name, gl, sourceF, "fs");

    // プログラムの作成
    let _program = gl.createProgram();
    // シェーダーにアタッチ → リンク
    gl.attachShader(_program, vShader);
    gl.attachShader(_program, fShader);
    gl.linkProgram(_program);

    // 結果のチェック
    if(!gl.getProgramParameter(_program, gl.LINK_STATUS)){
      console.error('Could not initialize shaders');
      console.log("name: " + name + ", program link failure.");
      return null;
    }
    return _program;
  }

  // _loadAttributes. glを引数として。最初からそうしろよ...って今更。
  // sizeとtypeは意図した挙動をしなかったので廃止。
  // sizeはなぜかvec2なのに1とか出してくるし
  // typeはgl.FLOATとかじゃなくてFLOAT_VEC2とかだしでbindに使えない
  // まあそういうわけでどっちも廃止。
  function _loadAttributes(gl, pg){
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
      attributes[name] = attr; // 登録！
    }
    return attributes;
  }

  // _loadUniforms. glを引数に。
  function _loadUniforms(gl, pg){
    // ユニフォームの総数を取得
    const numUniforms = gl.getProgramParameter(pg, gl.ACTIVE_UNIFORMS);
    const uniforms = {};
    // ユニフォームを格納していく
    let samplerIndex = 0; // サンプラのインデックスはシェーダー内で0ベースで異なってればOK, を検証してみる。
    for(let i = 0; i < numUniforms; i++){
      const uniform = {};
      const uniformInfo = gl.getActiveUniform(pg, i); // ほぼ一緒ですね
      let name = uniformInfo.name;
      // このnameはuniform変数が配列の場合"uColor[0]"のようにおしりに[0]が付くという（そうなんだ）
      // p5jsはこれをトリミングでカットしているのでそれに倣う（sizeで保持するので情報は失われない）
      if(uniformInfo.size > 1){
        name = name.substring(0, name.indexOf('[0]'));
      }
      uniform.name = name; // 改めて名前を設定
      uniform.size = uniformInfo.size; // 配列の場合はこれが2とか3とか10になる感じ
      uniform.location = gl.getUniformLocation(pg, name);
      uniform.type = uniformInfo.type; // gl.FLOATなどの型情報
      if(uniform.type === gl.SAMPLER_2D){
        uniform.samplerIndex = samplerIndex++; // 名前からアクセスして...setTextureで使う
      }
      // isArrayの情報...は、いいや。普通に書く。それで問題が生じないか見る。
      uniforms[name] = uniform;
    }
    return uniforms;
  }

  // setUniformの移植。size>1の場合にvを使うのとか注意。uniform[1234][fi][v]もしくはuniformMatrix[234]fv.
  // 引数のuniformは名前とcurrentPainterから取得して渡す
  // この流れで行くと最終的にcurrentShaderの概念無くなる可能性あるな...あれsetUniformしやすいからって残してただけだし
  // あとサンプラは扱う予定無いのでそれ以外ですね。まとめて扱うなんて無理。
  // あとwebgl2はuiっていってunsignedのintも扱えるらしいですね...
  function _setUniform(gl, uniform, data){
    const location = uniform.location;

    switch(uniform.type){
      case gl.BOOL:
        if(data === true){ gl.uniform1i(location, 1); }else{ gl.uniform1i(location, 0); } break;
      case gl.INT:
        if(uniform.size > 1){
          gl.uniform1iv(location, data);
        }else{
          gl.uniform1i(location, data);
        }
        break;
      case gl.FLOAT:
        if(uniform.size > 1){
          gl.uniform1fv(location, data);
        }else{
          gl.uniform1f(location, data);
        }
        break;
      case gl.UNSIGNED_INT:
        if(uniform.size > 1){
          gl.uniform1uiv(location, data);
        }else{
          gl.uniform1ui(location, data);
        }
      case gl.FLOAT_MAT2:
        gl.uniformMatrix2fv(location, false, data); // 2次元で使い道ないかな～（ないか）
        break;
      case gl.FLOAT_MAT3:
        gl.uniformMatrix3fv(location, false, data); // falseは転置オプションなので常にfalseだそうです
        break;
      case gl.FLOAT_MAT4:
        gl.uniformMatrix4fv(location, false, data); // しかしなんで常にfalseなのに用意したのか...
        break;
      case gl.FLOAT_VEC2:
        if (uniform.size > 1) {
          gl.uniform2fv(location, data);
        } else {
          gl.uniform2f(location, data[0], data[1]);
        }
        break;
      // floatです。
      case gl.FLOAT_VEC3:
        if (uniform.size > 1) {
          gl.uniform3fv(location, data);
        } else {
          gl.uniform3f(location, data[0], data[1], data[2]);
        }
        break;
      case gl.FLOAT_VEC4:
        if (uniform.size > 1) {
          gl.uniform4fv(location, data);
        } else {
          gl.uniform4f(location, data[0], data[1], data[2], data[3]);
        }
        break;
      // intです。
      case gl.INT_VEC2:
        if (uniform.size > 1) {
          gl.uniform2iv(location, data);
        } else {
          gl.uniform2i(location, data[0], data[1]);
        }
        break;
      case gl.INT_VEC3:
        if (uniform.size > 1) {
          gl.uniform3iv(location, data);
        } else {
          gl.uniform3i(location, data[0], data[1], data[2]);
        }
        break;
      case gl.INT_VEC4:
        if (uniform.size > 1) {
          gl.uniform4iv(location, data);
        } else {
          gl.uniform4i(location, data[0], data[1], data[2], data[3]);
        }
        break;
      // 使う日は来るのだろうか
      case gl.UNSIGNED_INT_VEC2:
        if (uniform.size > 1) {
          gl.uniform2uiv(location, data);
        } else {
          gl.uniform2ui(location, data[0], data[1]);
        }
        break;
      case gl.UNSIGNED_INT_VEC3:
        if (uniform.size > 1) {
          gl.uniform3uiv(location, data);
        } else {
          gl.uniform3ui(location, data[0], data[1], data[2]);
        }
        break;
      case gl.UNSIGNED_INT_VEC4:
        if (uniform.size > 1) {
          gl.uniform4uiv(location, data);
        } else {
          gl.uniform4ui(location, data[0], data[1], data[2], data[3]);
        }
        break;
    }
  }

  // attrの構成例：{name:"aPosition", size:2, data:[-1,-1,-1,1,1,-1,1,1], usage:"static"}
  // ああそうか隠蔽するからこうしないとまずいわ...修正しないと。"static"とか。
  // 今staticとdynamicしかないからstatic意外はdynamicってやっておきますか。
  function _createVBO(gl, attr){
    const _usage = (attr.usage === "static" ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(attr.data), _usage);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return {
      name: attr.name,
      buf: vbo,
      data: attr.data,
      count: attr.data.length, // countに名前を変更
      size: attr.size, // vec2なら2ですし、vec4なら4です。作るときに指定。
      type: attr.type,  // いつの日か整数属性を使う時が来たら考える。今は未定義でgl.FLOATになるくらいで。
      usage: attr.usage,
    };
  }

  // attrsはattrの配列
  function _createVBOs(gl, attrs){
    const vbos = {};
    for(let attr of attrs){
      vbos[attr.name] = _createVBO(gl, attr);
    }
    return vbos;
  }

  function _validateForIBO(gl, info){
    if(info.usage === undefined){ info.usage = "static"; } // これも基本STATICですね...
    if(info.large === undefined){ info.large = false; } // largeでT/F指定しよう. 指定が無ければUint16.
    if(info.large){
      info.type = Uint32Array;
      info.intType = gl.UNSIGNED_INT; // drawElementsで使う
    }else{
      info.type = Uint16Array;
      info.intType = gl.UNSIGNED_SHORT; // drawElementsで使う
    }
  }

  // infoの指定の仕方
  // 必須: dataにインデックス配列を入れる。nameは渡すときに付与されるので要らない。
  // 任意：usageは"static"か"dynamic"を指定
  function _createIBO(gl, info){
    _validateForIBO(gl, info);
    const _usage = (info.usage === "static" ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new (info.type)(info.data), _usage);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return {
      name: info.name,
      buf: ibo,
      type: info.type,
      intType: info.intType,
      data: info.data,
      count: info.data.length, // countに変更
      usage: info.usage,
    };
  }

  // ubyte: gl.UNSIGNED_BYTE, float: gl.FLOAT, half_float: gl.HALF_FLOAT
  // nearest: gl.NEAREST, linear: gl.LINEAR
  // clamp: gl.CLAMP_TO_EDGE, repeat: gl.REPEAT, mirror: gl.MIRRORED_REPEAT. ミラーもいいよね。使ってみたい。
  // テクスチャ作る関数も作るつもり。そのうち...
  // r32fとか使ってみたいわね。効率性よさそう
  function _validateForFBO(gl, info){
    // textureType. "ubyte", "half_float", "float"で指定
    if(info.textureType === undefined){ info.textureType = "ubyte"; }
    // textureInternalFormatとtextureFormatについて
    if(info.textureInternalFormat === undefined){
      switch(info.textureType){
        case "ubyte":
          info.textureInternalFormat = "rgba"; break;
        case "float":
          info.textureInternalFormat = "rgba32f"; break;
        case "half_float":
          info.textureInternalFormat = "rgba16f"; break;
      }
    }
    if(info.textureFormat === undefined){ info.textureFormat = "rgba"; } // とりあえずこれで。あの3種類みんなこれ。
    // textureFilter. "nearest", "linear"で指定
    if(info.textureFilter === undefined){ info.textureFilter = "nearest"; }
    // textureWrap. "clamp", "repeat", "mirror"で指定
    if(info.textureWrap === undefined){ info.textureWrap = "clamp"; }
  }

  // gl定数は文字列から変換する辞書を作ってそれ使った方が速いわね、おそらく。というかこれただの数字だから、
  // 極端な話...全部数字でいいのよね。それも記録する必要はなくて、グローバルで...あれすればいい。

  // 文字列をgl定数に変換
  function _parseTextureParam(gl, info){
    switch(info.textureType){
      case "float":
        info.textureType = gl.FLOAT; break;
      case "half_float":
        info.textureType = gl.HALF_FLOAT; break;
      default:
        info.textureType = gl.UNSIGNED_BYTE; // 色はUNSIGNED_BYTEですね...
    }

    switch(info.textureInternalFormat){
      case "rgba16f":
        info.textureInternalFormat = gl.RGBA16F; break;
      case "rgba32f":
        info.textureInternalFormat = gl.RGBA32F; break;
      default:
        info.textureInternalFormat = gl.RGBA;
    }

    info.textureFormat = gl.RGBA; // 単純に。

    switch(info.textureFilter){
      case "linear":
        info.textureFilter = gl.LINEAR; break;
      default:
        info.textureFilter = gl.NEAREST;
    }

    switch(info.textureWrap){
      case "repeat":
        info.textureWrap = gl.REPEAT; break;
      case "mirror":
        info.textureWrap = gl.MIRRORED_REPEAT; break;
      default:
        info.textureWrap = gl.CLAMP_TO_EDGE;
    }
  }

  // というわけでややこしいんですが、
  // 「gl.RGBAーgl.RGBAーgl.UNSIGNED_BYTE」「gl.RGBA32Fーgl.RGBAーgl.FLOAT」「gl.RGBA16Fーgl.RGBAーgl.HALF_FLOAT」
  // という感じなので、Typeの種類にInternalFormatとFormatが左右されるのですね。
  // ていうかFormatだと思ってた引数の正式名称はTypeでしたね。色々間違ってる！！textureTypeに改名しないと...

  // infoの指定の仕方
  // 必須：name, w, h. ？あ、name要らないわ。あっちで付けるわ。
  // 任意：textureType: テクスチャの種類。色なら"ubyte"(デフォルト), 浮動小数点数なら"float"や"half_float"
  // 他のパラメータとか若干ややこしいのでそのうち何とかしましょう...webgl2はややこしいのだ...
  // pavelさんのあれは対応してたと思うよ。きちんと見なきゃね...
  // textureFilter: テクスチャのフェッチの仕方。通常は"nearest"（点集合など正確にフェッチする場合など）、
  // 学術計算とかなら"linear"使うかも
  // textureWrap: 境界処理。デフォルトは"clamp"だが"repeat"や"mirror"を指定する場合もあるかも。
  // 色として普通に使うなら全部指定しなくてOK. 点情報の格納庫として使うなら"float"だけ要ると思う。
  function _createFBO(gl, info){
    _validateForFBO(gl, info);
    _parseTextureParam(gl, info);

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
    // こっちがInvalid Internal Formatで...
    // わかりました。webgl2ならではの事情だそうです。上記：↑
    // ちなみに3つの引数の正式名称はInternalFormat, Format, Typeです。「textureType」の方が正しいようで。
    // textureInternalFormatとtextureFormatはundefinedなら自動決定、という方向で。
    // 手動でも決定できるようにするか。最終的にgl変数は辞書使って何でも指定可能にするつもり...
    gl.texImage2D(gl.TEXTURE_2D, 0, info.textureInternalFormat, info.w, info.h, 0, info.textureFormat, info.textureType, null);

    // テクスチャパラメータ
    // このNEARESTのところを可変にする
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, info.textureFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, info.textureFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, info.textureWrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, info.textureWrap);

    // フレームバッファにテクスチャを関連付ける
    // こっちがFramebuffer is incompleteか。
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fTexture, 0);

    // 中身をクリアする(clearに相当する)
    gl.viewport(0, 0, info.w, info.h);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

    // 各種オブジェクトのバインドを解除
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // オブジェクトを返して終了。
    return {
      f: framebuffer, d: depthRenderbuffer, t: fTexture,
      name: info.name, w: info.w, h: info.h,
      texelSizeX: 1/info.w, texelSizeY: 1/info.h, double: false,
    }
    // infoの役割終了
  }

  function _createDoubleFBO(gl, info){
    // assignでコピーしないと多分infoの内容が正しく伝わらないので
    const info0 = Object.assign({}, info);
    let fbo0 = _createFBO(gl, info0);
    const info1 = Object.assign({}, info);
    let fbo1 = _createFBO(gl, info1);
    // 各種情報は生成にしか使わないのでこれでいい。
    return {
      read: {f:fbo0.f, d:fbo0.d, t:fbo0.t},  // f,d,tしか要らないので。
      write: {f:fbo1.f, d:fbo1.d, t:fbo1.t},
      swap: function(){
        let tmp = this.read;
        this.read = this.write;
        this.write = tmp;
      },
      name: info.name, w: info.w, h: info.h,
      texelSizeX: 1/info.w, texelSizeY: 1/info.h, double: true,
    }
    // infoの役割終了
  }

  // drawModeを文字列から生成する
  function _parseDrawMode(gl, mode){
    switch(mode){
      case "points": // [0], [1], [2], ... 点描画。点ごと。ドット打ち。
        return gl.POINTS;
      case "lines": // [0,1], [2,3], [4,5], ... 2つずつ線分を作る。余ったものは無視される。
        return gl.LINES;
      case "line_strip": // [0,1], [1,2], [2,3], ...次の点とつないで線分を並べていく。
        return gl.LINE_STRIP;
      case "line_loop": // [0,1], [1,2], [2,3], ..., [n-1,0] 基本line_stripだが、最後の点と最初の点をつなぐ。
        return gl.LINE_LOOP;
      case "triangle_strip": // [0,1,2], [2,1,3], [2,3,4], [4,3,5], ... ジグザグに並んだ頂点に対し3つずつつながるように三角形。
        return gl.TRIANGLE_STRIP;
      case "triangle_fan": // [0,1,2],[0,2,3],[0,3,4],...,[0,n-2,n-1] だと思う。扇形。
        return gl.TRIANGLE_FAN;
      default:
        return gl.TRIANGLES;
    }
    // triangles. もしくは未指定。"triangles"ってちゃんと書こうね。
    // [0,1,2], [3,4,5], [6,7,8], ...3つずつ三角形。一番オーソドックスな指定の仕方。
    return gl.TRIANGLES;
  }

  // blendFactorを文字列で指定するためのパーサー...配列でいい気がしてきた。
  // とりあえず必要なものだけ。
  function _parseBlendFactor(gl, name){
    switch(name){
      case "one": return gl.ONE;
      case "src_color": return gl.SRC_COLOR;
      case "dst_color": return gl.DST_COLOR;
      case "one_minus_src_color": return gl.ONE_MINUS_SRC_COLOR;
      case "one_minus_dst_color": return gl.ONE_MINUS_DST_COLOR;
      case "src_alpha": return gl.SRC_ALPHA;
      case "dst_alpha": return gl.DST_ALPHA;
      case "one_minus_src_alpha": return gl.ONE_MINUS_SRC_ALPHA;
      case "one_minus_dst_alpha": return gl.ONE_MINUS_DST_ALPHA;
      default: return gl.ZERO;
    }
    return gl.ZERO;
  }

  // あとはp5の2D,webgl画像からテクスチャを作るのとか用意したいね.
  // 登録しておいてそこから取り出して編集とか。そうね。それでもいいかも。bgManagerの後継機みたいな。さすがにクラスにしないと...

  // _glだけ汎用的にしてglが必要なときは適宜取り出す感じで（p5.jsに倣う）

  // ---------------------------------------------------------------------------------------------- //
  // Painter.

  // shaderは廃止。いいのかどうかは知らない。
  // getProgramで名前を渡す。理由は原因追及をしやすくするため。
  class Painter{
    constructor(_gl, name, vs, fs){
      this._gl = _gl;
      this.gl = _gl.GL;
      this.name = name;
      this.program = _getProgram(name, this.gl, vs, fs); // プログラムだけでいいのよね
      this.attributes = _loadAttributes(this.gl, this.program); // 属性に関するshader情報
      this.uniforms = _loadUniforms(this.gl, this.program); // ユニフォームに関するshader情報
    }
    use(){
      // これでいいはず。ただ以前GPUパーティクルでこれやったとき変なちらつきが起きたのよね。
      // それが気になったのでやめたんですよね。今回はどうかな...
      this.gl.useProgram(this.program);
    }
    getProgram(){
      return this.program;
    }
    getAttributes(){
      return this.attributes;
    }
    getAttribute(name){
      return this.attributes[name];
    }
    getUniforms(){
      return this.uniforms;
    }
    getUniform(name){
      // ピンポイントでuniformを取得する個別の関数。あると便利かもしれない。
      return this.uniforms[name];
    }
    setUniform(name, data){
      // ていうかsetUniformこいつの仕事だろ。
      // texture以外です。
      _setUniform(this.gl, this.uniforms[name], data);
    }
    setTexture2D(name, _texture){
      const gl = this.gl;
      const uniform = this.uniforms[name];
      // activateする番号とuniform1iで登録する番号は一致しており、かつsamplerごとに異なる必要があるということ
      gl.activeTexture(gl.TEXTURE0 + uniform.samplerIndex);
      gl.bindTexture(gl.TEXTURE_2D, _texture);
      gl.uniform1i(uniform.location, uniform.samplerIndex);
    }
    unbind(){
      // 2Dや3Dのテクスチャがbindされていたら解除(今は2D only.)
      if(this.gl.getParameter(this.gl.TEXTURE_BINDING_2D) !== null){
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
      }
    }
  }

  // ---------------------------------------------------------------------------------------------- //
  // Figure.

  class Figure{
    constructor(_gl, name, attrs){
      this._gl = _gl;
      this.gl = _gl.GL;
      this.name = name;
      const gl = this._gl.GL;
      this.validate(attrs);
      this.vbos = _createVBOs(gl, attrs);
    }
    validate(attrs){
      // attrsは配列です。各成分の形：{name:"aPosition",data:[-1,-1,-1,1,1,-1,1,1]}とか。場合によってはusage:gl.DYNAMIC_DRAWなど
      // sizeも追加で。1とか2とか。これも追加でよろしく。
      for(let attr of attrs){
        if(attr.usage === undefined){ attr.usage = "static"; }
        if(attr.type === undefined){ attr.type = this.gl.FLOAT; } // おいおいなんとかしていくつもり
      }
    }
    getVBOs(){
      return this.vbos;
    }
  }

  // ---------------------------------------------------------------------------------------------- //
  // utility for Figure.

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

  // ---------------------------------------------------------------------------------------------- //
  // Meshes.
  // まあ、メッシュいろいろテンプレート、あると便利だし。難しいけどね。
  // 簡単なテスト用に用意しておくのは無駄じゃないと思う。難しいけどね。

  // 何が難しいかっていうとたとえば頂点に色付けたいな～ってなったら構築部分直接いじる必要は当然出てくるし
  // そんな感じであれしたいこれしたいでどんどんいろいろ、ね、まあそういうこと。複雑なものは扱えない。
  // ある程度は、やるけどね。それ以上は難しいかも。

  // 長方形（z軸正方向に垂直なもの、横と縦の幅だけ指定）
  // info:
  // 必須：横幅wと縦幅hです。
  function getPlane(info){
    let {w, h} = info;
    if(w === undefined){ w = 100; }
    if(h === undefined){ h = w; } // 正方形
    const v = [-w/2, -h/2, 0, w/2, -h/2, 0, -w/2, h/2, 0, w/2, h/2, 0];
    const f = [0, 1, 2, 2, 1, 3];
    const n = getNormals(v, f);
    const uv = [0, 1, 1, 1, 0, 0, 1, 0];
    return {v:v, f:f, n:n, uv:uv};
  }

  // 直方体（a,b,cで横、縦、高さの指定を行う。原点中心）
  // info:
  // 必須：a,b,cでよこ、たて、高さ。bが未指定の場合a=b=cで、cが未指定の場合b=cとする。
  function getBox(info){
    let {a, b, c} = info;
    if(a === undefined){ a = 100; }
    if(b === undefined){ b = a; } // 立方体
    if(c === undefined){ c = b; } // 正方形角柱。
    // under construction. テスト優先。はい。
  }

  // fboとiboはクラス化しない方向で。iboはMAXを取るのがコストなのでlargeかどうか事前に指定しようね。
  // ていうかそれだけだと判断できない場合もあるからね。

  // ---------------------------------------------------------------------------------------------- //
  // RenderNode.

  class RenderNode{
    constructor(_gl){
      this._gl = _gl;
      this.gl = _gl.GL;
      this.painters = {};
      this.figures = {};
      this.fbos = {};
      this.ibos = {};
      this.currentPainter = undefined;
      //this.currentShader = undefined;
      this.currentFigure = undefined;
      this.currentIBO = undefined; // このくらいはいいか。
      this.enableExtensions(); // 拡張機能
    }
    enableExtensions(){
      // color_buffer_floatのEXT処理。pavelさんはこれ使ってwebgl2でもfloatへの書き込みが出来るようにしてた。
      // これによりframebufferはFRAMEBUFFER_COMPLETEを獲得する：https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float
      // 書き込み可能になるInternalFormatは「gl.R16F, gl.RG16F, gl.RGBA16F, gl.R32F, gl.RG32F, gl.RGBA32F, gl.R11FG11FB10F」？
      // 最後のはなんじゃい...
      this.gl.getExtension('EXT_color_buffer_float');
    }
    clearColor(r, g, b, a){
      // clearに使う色を決めるところ
      this.gl.clearColor(r, g, b, a);
      return this;
    }
    clear(){
      // 通常のクリア。対象はスクリーンバッファ、もしくはその時のフレームバッファ
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      return this;
    }
    enable(name){
      const gl = this.gl;
      // 文字列で有効化指定（ドローコールに合わせてスネークで）
      switch(name){
        case "blend": gl.enable(gl.BLEND); break;
        case "cull_face": gl.enable(gl.CULL_FACE); break;
        case "depth_test": gl.enable(gl.DEPTH_TEST); break;
      }
      return this;
    }
    cullFace(mode){
      const gl = this.gl;
      // カルフェイスのデフォはbackなんだそうです。
      switch(mode){
        case "front": gl.cullFace(gl.FRONT); break;
        case "back": gl.cullFace(gl.BACK); break;
        case "front_and_back": gl.cullFace(gl.FRONT_AND_BACK); break;
      }
      return this;
    }
    blendFunc(sFactor, dFactor){
      // blend関数について...
      // 描画色＝描画元の色 * sFactor + 描画先の色 * dFactor
      // ですね。なのでたとえば、ONEとONE_MINUS_SRC_ALPHAにすると、ソースアルファが1のところはソースが維持されるため、
      // すでに塗った色への上書きができるというわけ。そんな感じ。ONEーONEで通常のADDになったりする。
      sFactor = _parseBlendFactor(this.gl, sFactor);
      dFactor = _parseBlendFactor(this.gl, dFactor);
      this.gl.blendFunc(sFactor, dFactor);
      return this;
    }
    disable(name){
      const gl = this.gl;
      // 非有効化
      switch(name){
        case "blend": gl.disable(gl.BLEND); break;
        case "cull_face": gl.disable(gl.CULL_FACE); break;
        case "depth_test": gl.disable(gl.DEPTH_TEST); break;
      }
      return this;
    }
    registPainter(name, vs, fs){
      const newPainter = new Painter(this._gl, name, vs, fs);
      this.painters[name] = newPainter;
      return this;
    }
    registFigure(name, attrs){
      // attrsは配列です。
      const newFigure = new Figure(this._gl, name, attrs);
      this.figures[name] = newFigure;
      return this;
    }
    registIBO(name, info){
      info.name = name; // infoは{data:[0,1,2,2,1,3]}みたいなので問題ないです。配列渡すのでもいいんだけど...柔軟性考えるとね...
      const newIBO = _createIBO(this.gl, info);
      this.ibos[name] = newIBO;
      return this;
    }
    registFBO(name, info){
      // nameはここで付けるので要らないね。doubleは生成時に付与するので要らんわな。
      info.name = name;
      const newFBO = _createFBO(this.gl, info);
      this.fbos[name] = newFBO;
      return this;
    }
    registDoubleFBO(name, info){
      // nameは以下略
      info.name = name;
      const newFBO = _createDoubleFBO(this.gl, info);
      this.fbos[name] = newFBO;
      return this;
    }
    usePainter(name){
      this.currentPainter = this.painters[name];
      this.currentPainter.use();
      return this;
    }
    drawFigure(name){
      // よく考えたら切り離す必要ないか。同じ板ポリ使い回す場合、板ポリはそのままで、
      // 使うペインター（色塗り機）だけ差し替えるわけで。差し替えるたびに有効化すると。
      // まとめてやるような処理でもないし切り離す必要性あんまないな。
      this.currentFigure = this.figures[name];
      // 属性の有効化
      this.enableAttributes();
      return this;
    }
    use(painterName, figureName){
      // painter, figureの順に...さすがにめんどくさい。
      this.usePainter(painterName);
      // Painterが定義されていないと属性の有効化が出来ないのでこの順番でないといけない
      this.drawFigure(figureName);
      return this;
    }
    enableAttributes(){
      // 属性の有効化
      const attributes = this.currentPainter.getAttributes();
      const vbos = this.currentFigure.getVBOs();
      // どっちかっていうとvbosの方に従うべきかな...
      // 使わないattributeがあってもいいので
      for(let attrName of Object.keys(vbos)){
        const vbo = vbos[attrName];
        const attr = attributes[attrName];
        // vboをbindする
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo.buf);
        // attributeLocationを有効にする
        this.gl.enableVertexAttribArray(attr.location);
        // attributeLocationを通知し登録する
        this.gl.vertexAttribPointer(attr.location, vbo.size, vbo.type, false, 0, 0);
      }
    }
    setTexture2D(name, _texture){
      // 有効になっているPainterにテクスチャを付与
      this.currentPainter.setTexture2D(name, _texture);
      return this;
    }
    setUniform(name, data){
      // 有効になってるシェーダにuniformをセット（テクスチャ以外）
      //this.currentShader.setUniform(name, data);
      this.currentPainter.setUniform(name, data);
      return this;
    }
    setViewport(x, y, w, h){
      // フレームバッファ扱うにしても何するにしても必須
      this.gl.viewport(x, y, w, h);
      return this;
    }
    bindIBO(name){
      // iboをbindする。
      const ibo = this.ibos[name];
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo.buf);
      this.currentIBO = ibo;
      return this;
    }
    bindFBO(target){
      const gl = this.gl;
      // targetは名前、もしくはnull.
      if(typeof(target) == 'string'){
        let fbo = this.fbos[target];
        if(!fbo){
          // fboが無い場合の警告
          alert("The corresponding framebuffer does not exist.");
          noLoop();
          return this;
        }
        if(fbo.double){
          // doubleの場合はwriteをbind
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.write.f);
          gl.viewport(0, 0, fbo.w, fbo.h);
          return this;
        }
        // 通常時
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.f);
        gl.viewport(0, 0, fbo.w, fbo.h);
        return this;
      }
      if(target == null){
        // nullの場合はスクリーンに直接
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        // drawingBufferWidthとdrawingBufferHeightってやらないとpixelDensityに邪魔されて
        // 全画面になってくれないようです...気を付けないと。これも確かpavelさんやってたな...
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        return this;
      }
      // targetがfboそのものの場合。
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.f);
      gl.viewport(0, 0, target.w, target.h);
      return this;
    }
    clearFBO(){
      // そのときにbindしているframebufferのクリア操作
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      return this;
    }
    setFBOtexture2D(uniformName, fboName){
      // FBOを名前経由でセット。ダブルの場合はreadをセット。
      if(fboName === undefined || (typeof fboName !== 'string')){
        // 指定の仕方に問題がある場合
        alert("Inappropriate name setting.");
        noLoop();
        return this;
      }
      let fbo = this.fbos[fboName];
      if(!fbo){
        // fboが無い場合の警告
        alert("The corresponding framebuffer does not exist.");
        noLoop();
        return this;
      }
      if(fbo.double){
        // doubleの場合はreadをセットする
        this.setTexture2D(uniformName, fbo.read.t);
        return this;
      }
      // 通常時
      this.setTexture2D(uniformName, fbo.t);
      return this;
    }
    swapFBO(fboName){
      // ダブル前提。ダブルの場合にswapする
      if(fboName == null){ return this; }
      let fbo = this.fbos[fboName];
      if(!fbo){
        // fboが無い場合の警告
        alert("The corresponding framebuffer does not exist.");
        noLoop();
        return this;
      }
      if(fbo.read && fbo.write){ fbo.swap(); }
      return this;
    }
    drawArrays(mode, first, count){
      // modeは文字列指定でドローの仕方を指定する(7種類)。
      // 残りの引数は0とMAXでいいです。
      if(arguments.length === 1){
        first = 0;
        // countの計算は...vboで。
        const vbos = this.currentFigure.getVBOs();
        const name = Object.keys(vbos)[0];
        count = vbos[name].count / vbos[name].size;
      }
      // modeの文字列からgl定数を取得
      mode = _parseDrawMode(this.gl, mode);
      // 実行
      this.gl.drawArrays(mode, first, count);
      return this;
    }
    drawElements(mode, count){
      // typeとsizeがそのまま使えると思う
      const ibo = this.currentIBO;
      mode = _parseDrawMode(this.gl, mode);
      this.gl.drawElements(mode, ibo.count, ibo.intType, 0);
      return this;
    }
    unbind(){
      // 各種bind解除
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
      this.currentIBO = undefined;
      this.currentPainter.unbind();
    }
    flush(){
      this.gl.flush();
    }
  }

  // ---------------------------------------------------------------------------------------------- //
  // Matrix4x4.
  // 自前で用意しなくてもいいんだろうけど、
  // 正規化デバイス座標系の出し方とかそこら辺の知識が無いと影とか出来ないですから。

  // 4x4正方行列
  // イメージ的には行指定で0,1,2,3で最上段、以下下の段4,5,6,7,と続く。
  class Mat4{
    constructor(data){
      this.m = new Array(16).fill(0);
      if(data === undefined){
        this.initialize();
      }else{
        for(let i=0; i<16; i++){
          this.m[i] = (data[i] !== undefined ? data[i] : 0);
        }
      }
    }
    initialize(){
      this.m = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    }
    copy(){
      return new Mat4(this.m);
    }
    set(data){
      // 値をセットする
      for(let i=0; i<16; i++){
        this.m[i] = data[i];
      }
    }
    getMat4(){
      return this.m;
    }
    mult(s){
      // sは長さ16の配列で、4x4行列とみなす。
      // sを左からmに掛けることでthis.mを変化させる
      const data = getMult4x4(s, this.m);
      this.set(data);
    }
    transpose(){
      // 転置。
      const data = getTranspose4x4(this.m);
      this.set(data);
    }
  }

  /*
    // 一番上の行
    this.m[0] = s.m[0]*_m[0] + _s.m[1]*_m[4] + _s.m[2]*_m[8] + _s.m[3]*_m[12];
    this.m[1] = s.m[0]*_m[1] + _s.m[1]*_m[5] + _s.m[2]*_m[9] + _s.m[3]*_m[13];
    this.m[2] = s.m[0]*_m[2] + _s.m[1]*_m[6] + _s.m[2]*_m[10] + _s.m[3]*_m[14];
    this.m[3] = s.m[0]*_m[3] + _s.m[1]*_m[7] + _s.m[2]*_m[11] + _s.m[3]*_m[15];
    // 以下これを繰り返す、のだがめんどくさいので...でもまあそのまま書くか。
    this.m[4] = s.m[4]*_m[0] + _s.m[5]*_m[4] + _s.m[6]*_m[8] + _s.m[7]*_m[12];
    this.m[5] = s.m[4]*_m[1] + _s.m[5]*_m[5] + _s.m[6]*_m[9] + _s.m[7]*_m[13];
    this.m[6] = s.m[4]*_m[2] + _s.m[5]*_m[6] + _s.m[6]*_m[10] + _s.m[7]*_m[14];
    this.m[7] = s.m[4]*_m[3] + _s.m[5]*_m[7] + _s.m[6]*_m[11] + _s.m[7]*_m[15];
    // そのうち楽に書く...けどね...
    this.m[8] = s.m[8]*_m[0] + _s.m[9]*_m[4] + _s.m[10]*_m[8] + _s.m[11]*_m[12];
    this.m[9] = s.m[8]*_m[1] + _s.m[9]*_m[5] + _s.m[10]*_m[9] + _s.m[11]*_m[13];
    this.m[10] = s.m[8]*_m[2] + _s.m[9]*_m[6] + _s.m[10]*_m[10] + _s.m[11]*_m[14];
    this.m[11] = s.m[8]*_m[3] + _s.m[9]*_m[7] + _s.m[10]*_m[11] + _s.m[11*_m[15];
    // 見栄え悪いけどパフォーマンスには問題ないと思うよ
    this.m[12] = s.m[12]*_m[0] + _s.m[13]*_m[4] + _s.m[14]*_m[8] + _s.m[15]*_m[12];
    this.m[13] = s.m[12]*_m[1] + _s.m[13]*_m[5] + _s.m[14]*_m[9] + _s.m[15]*_m[13];
    this.m[14] = s.m[12]*_m[2] + _s.m[13]*_m[6] + _s.m[14]*_m[10] + _s.m[15]*_m[14];
    this.m[15] = s.m[12]*_m[3] + _s.m[13]*_m[7] + _s.m[14]*_m[11] + _s.m[15]*_m[15];
  */


  // ---------------------------------------------------------------------------------------------- //
  // utility for Matrix4x4.

  // この関数で必要ならモデルとビューを（モデル、ビュー）で掛け算して
  // モデルビューにしてsetUniformで渡す。他にも...まあ色々。
  // いっそ（（モデル、ビュー）、プロジェ）で全部掛けてしまってもいいし。なのでexportします。
  // 切り離すのはまあ、使い回しとか色々考えるとね...
  function getMult4x4(s, m){
    // sとmは長さ16の配列であることが前提。掛け算の結果を返す。
    const result = new Array(16).fill(0);
    // 文字列で整理。これも泥臭い計算結果があれば一瞬で、高い知能とか要らない
    // というか知能高くないので無理です
    for(let k=0; k<16; k++){
      const a = 4*Math.floor(k/4);
      const b = k % 4; // kのとこaって...間違えた！
      result[k] += s[a] * m[b];
      result[k] += s[a+1] * m[b+4];
      result[k] += s[a+2] * m[b+8];
      result[k] += s[a+3] * m[b+12];
    }
    return result;
  }

  // 3x3バージョン
  function getMult3x3(s, m){
    const result = new Array(9).fill(0);
    for(let k=0; k<9; k++){
      const a = 3*Math.floor(k/3);
      const b = k % 3;
      result[k] += s[a] * m[b];
      result[k] += s[a+1] * m[b+3];
      result[k] += s[a+2] * m[b+6];
    }
    return result;
  }

  function getTranspose4x4(m){
    // mは長さ16の配列でこれを行列とみなしたうえでその転置であるような配列を返す感じ（わかる？）
    const result = new Array(16).fill(0);
    for(let i=0; i<4; i++){
      for(let k=0; k<4; k++){
        result[4*i+k] = m[i+4*k];
      }
    }
    return result;
  }

  // 3x3バージョン
  function getTranspose3x3(m){
    const result = new Array(9).fill(0);
    for(let i=0; i<3; i++){
      for(let k=0; k<3; k++){
        result[3*i+k] = m[i+3*k];
      }
    }
    return result;
  }

  function getRotX(t){
    // x軸の周りにtラジアン回転の行列
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  }

  function getRotY(t){
    // y軸の周りにtラジアン回転の行列
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  }

  function getRotZ(t){
    // z軸の周りにtラジアン回転の行列
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  function getRot(t, a, b, c){
    // 単位軸ベクトル(a, b, c)の周りにtラジアン回転の行列
    if(a === undefined){
      a=0; b=0; c=1;
    }
    let L = Math.sqrt(a*a + b*b + c*c);
    // 0,0,0を設定してしまった場合はz軸正方向とします
    // ていうか単位ベクトルとか長さがきちんとしてるのを使ってくださいねお願いだから
    if(L < 1e-6){ a=0; b=0; c=1; L=1; }
    a /= L;
    b /= L;
    c /= L;
    const u = Math.cos(t);
    const v = Math.sin(t);
    const w = 1 - u;
    const m0 = w*a*a + u;
    const m1 = w*a*b + v*c;
    const m2 = w*a*c - v*b;
    const m4 = w*a*b - v*c;
    const m5 = w*b*b + u;
    const m6 = w*b*c + v*a;
    const m8 = w*a*c + v*b;
    const m9 = w*b*c - v*a;
    const m10 = w*c*c + u;
    return [m0, m1, m2, 0, m4, m5, m6, 0, m8, m9, m10, 0, 0, 0, 0, 1];
  }

  function getTranslate(a, b, c){
    // a, b, cの平行移動の行列
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, a, b, c, 1];
  }

  function getScale(sx, sy, sz){
    // sx, sy, sz倍の拡大を行う行列
    return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
  }

  // 最後に、Transformとビュー行列を（モデル、ビュー）で掛けたやつ(4x4)から
  // その左上の3x3の逆転置を取り出してuNmatrixとして使うっていうのをやるのでそれをやります
  // 対象は3x3で（テストのため）
  // テスト成功しました。OKです。これでノーマルを取れるね。
  function getInverseTranspose3x3(m){
    // mは長さ9の配列で3x3とみなされている
    const n = new Array(9).fill(0);
    n[0] = m[0]; n[3] = m[1]; n[6] = m[2];
    n[1] = m[3]; n[4] = m[4]; n[7] = m[5];
    n[2] = m[6]; n[5] = m[7]; n[8] = m[8];
    // nを転置するのは終わってるので逆行列を取って終わり。
    // n[0] n[1] n[2]  48-57  27-18  15-24
    // n[3] n[4] n[5]  56-38  08-26  23-05
    // n[6] n[7] n[8]  37-46  16-07  04-13
    const result = new Array(9).fill(0);
    const det = n[0]*n[4]*n[8] + n[1]*n[5]*n[6] + n[2]*n[3]*n[7] - n[2]*n[4]*n[6] - n[1]*n[3]*n[8] - n[0]*n[5]*n[7];
    const indices = [4,8,5,7, 2,7,1,8, 1,5,2,4,
                     5,6,3,8, 0,8,2,6, 2,3,0,5,
                     3,7,4,6, 1,6,0,7, 0,4,1,3];
    for(let i=0; i<9; i++){
      const offset = i*4;
      const a0 = indices[offset];
      const a1 = indices[offset+1];
      const a2 = indices[offset+2];
      const a3 = indices[offset+3];
      result[i] = (n[a0] * n[a1] - n[a2] * n[a3]) / det;
    }
    return result;
  }

  // ベースにあるのが射影のPでそこにビューのVを掛けてさらにモデルのMを掛けていく
  // 例えば離れたところで回転させる場合は単純に平行移動→回転、と考えてOK
  // それが内部ではまず回転、次いで平行移動、のように作用する。
  // 点に対する作用なのでそれでOK.
  // というか点の移動がメインで行列を掛けるのはそれを実現するための単なる手段、だから難しいことは何もない。ですよね。

  // （2Dは知らんけど...2Dは原点の位置と軸をいじってるんだよなぁ...しかもスケールも影響される、
  // webglと違って点の位置を動かすとかそういう考え方じゃないからたとえば線の太さが変わったりするんだよなぁ。）

  // ---------------------------------------------------------------------------------------------- //
  // CameraEx.
  // ビューとプロジェクションはここが担う。
  // モデルはまた別のモジュールを用意しないとねぇ
  // ものによってはカメラ要らないですからそこら辺。p5js常にカメラが備わってるので柔軟性が低いんですよね。
  // うそですよ

  class CameraEx{
    constructor(w, h){
      if(w === undefined){ w = window.innerWidth; }
      if(h === undefined){ h = window.innerHeight; }
      this.viewMat = new Mat4();
      this.projMat = new Mat4();
      this.initialize(w, h);
    }
    initialize(w, h){
      this.projType = "perse";
      // デフォルトはこんな感じで。カメラの位置は真上、パースで、原点注視。
      this.fov = Math.PI/3;
      this.aspect = w/h;
      this.eyeX = 0;
      this.eyeY = 0;
      this.eyeZ = (h/2)/Math.tan(this.fov/2);
      this.centerX = 0;
      this.centerY = 0;
      this.centerZ = 0;
      this.upX = 0;
      this.upY = 1;
      this.upZ = 0;
      this.near = this.eyeZ * 0.1;
      this.far = this.eyeZ * 10;
      // ortho用。画面内においてはtopの方が下になるので注意する。bottom側が上に来る。
      this.left = 0;
      this.right = 0;
      this.top = 0;
      this.bottom = 0;

      this.setViewMat();
      this.setPerspectiveMat();
    }
    getViewMat(){
      return this.viewMat;
    }
    getProjMat(){
      return this.projMat;
    }
    setView(info){
      // 定義されてるところだけ更新する。p5.Vectorでもなんでもx,y,zが使えるなら何でもOK
      if(info.eye !== undefined){
        this.eyeX = info.eye.x;
        this.eyeY = info.eye.y;
        this.eyeZ = info.eye.z;
      }
      if(info.center !== undefined){
        this.centerX = info.center.x;
        this.centerY = info.center.y;
        this.centerZ = info.center.z;
      }
      if(info.up !== undefined){
        this.upX = info.up.x;
        this.upY = info.up.y;
        this.upZ = info.up.z;
      }
      this.setViewMat();
    }
    setViewMat(){
      // ちょっと長くなるが...
      // まずcenterからeyeに向かうtopベクトルを用意する。正規化する。新しいz軸になる。
      let z0 = this.eyeX - this.centerX;
      let z1 = this.eyeY - this.centerY;
      let z2 = this.eyeZ - this.centerZ;
      const zLen = Math.sqrt(z0*z0 + z1*z1 + z2*z2);
      z0 /= zLen;
      z1 /= zLen;
      z2 /= zLen;
      // upベクトルとtopベクトルで外積を取って正規化するとsideベクトルが出来る。新しいx軸になる。
      let x0 = this.upY * z2 - this.upZ * z1;
      let x1 = this.upZ * z0 - this.upX * z2;
      let x2 = this.upX * z1 - this.upY * z0;
      const xLen = Math.sqrt(x0*x0 + x1*x1 + x2*x2);
      x0 /= xLen;
      x1 /= xLen;
      x2 /= xLen;
      // topベクトルとsideベクトルで外積を取って正規化する。念のため正規化する。これが新しいy軸。
      let y0 = z1 * x2 - z2 * x1;
      let y1 = z2 * x0 - z0 * x2;
      let y2 = z0 * x1 - z1 * x0;
      const yLen = Math.sqrt(y0*y0 + y1*y1 + y2*y2);
      y0 /= yLen;
      y1 /= yLen;
      y2 /= yLen;
      // これらを縦に並べる。そこら辺の理屈を説明するのはまあ、大変です...
      // そしてeyeの分だけ平行移動しないといけないんですね...なるほど。eyeの位置が原点に来るように。
      const data = [x0, y0, z0, 0, x1, y1, z1, 0, x2, y2, z2, 0, -this.eyeX, -this.eyeY, -this.eyeZ, 1];
      this.viewMat.set(data);
    }
    setPersepective(info){
      if(info.fov !== undefined){ this.fov = info.fov; }
      if(info.aspect !== undefined){ this.aspect = info.aspect; }
      if(info.near !== undefined){ this.near = info.near; }
      if(info.far !== undefined){ this.far = info.far; }
      this.projType = "perse";
      this.setPerspectiveMat();
    }
    setPerspectiveMat(){
      // fov, aspect, near, farから行列を計算してセットする。
      // 理屈はめんどくさいので結果だけ。
      const factor = 1.0 / Math.tan(this.fov/2);
      const c0 = factor / this.aspect;
      const c5 = -factor;
      const c10 = (this.near + this.far) / (this.near - this.far);
      const c11 = -1;
      const c14 = 2 * this.near * this.far / (this.near - this.far);
      const data = [c0, 0, 0, 0, 0, c5, 0, 0, 0, 0, c10, c11, 0, 0, c14, 0];
      this.projMat.set(data);
    }
    setOrtho(info){
      if(info.right !== undefined){ this.right = info.right; }
      if(info.left !== undefined){ this.left = info.left; }
      if(info.top !== undefined){ this.top = info.top; }
      if(info.bottom !== undefined){ this.bottom = info.bottom; }
      if(info.near !== undefined){ this.near = info.near; }
      if(info.far !== undefined){ this.far = info.far; }
      this.projType = "ortho";
      this.setOrthoMat();
    }
    setOrthoMat(){
      // left, right, top, bottom, near, farから行列を計算してセットする。
      // 理屈は簡単で、要はleftとrightを-1～1に、top～bottom（ただしupベクトルが示す正方向がtopという形）
      // を-1～1に、near～farを-1～1にマッピングするわけ。行列の掛け算も2次の逆行列でちょちょいっと。
      // でもまあ結果だけ。
      const c0 = 2 / (this.right - this.left);
      const c3 = -(this.right + this.left) / (this.right - this.left);
      const c5 = -2 / (this.top - this.bottom);
      const c7 = -(this.top + this.bottom) / (this.top - this.bottom);
      const c10 = -2 / (this.far - this.near);
      const c11 = -(this.far + this.near) / (this.far - this.near);
      const c15 = 1;
      const data = [c0, 0, 0, c3, 0, c5, 0, c7, 0, 0, c10, c11, 0, 0, 0, c15];
      this.projMat.set(data);
    }
  }

  // ---------------------------------------------------------------------------------------------- //
  // TransformEx.
  // 単位行列。初期化。要するにモデル行列。
  // rotとかいろいろこっちに移すかな...あっちに持たせても仕方ないわな。

  class TransformEx{
    constructor(data){
      this.mat = new Mat4(data);
    }
    initialize(){
      this.mat.initialize();
      return this;
    }
    getModelMat(){
      // モデル行列を取り出す。これを...渡す。
      return this.mat;
    }
    rotateX(t){
      // x軸の周りにtラジアン回転の行列を掛ける
      const data = getRotX(t);
      this.mat.mult(data);
      return this;
    }
    rotateY(t){
      // y軸の周りにtラジアン回転の行列を掛ける
      const data = getRotY(t);
      this.mat.mult(data);
      return this;
    }
    rotateZ(t){
      // z軸の周りにtラジアン回転の行列を掛ける
      const data = getRotZ(t);
      this.mat.mult(data);
      return this;
    }
    rotate(t, a, b, c){
      // 単位軸ベクトル(a, b, c)の周りにtラジアン回転の行列
      const data = getRot(t, a, b, c);
      this.mat.mult(data);
      return this;
    }
    translate(a, b, c){
      // a, b, cの平行移動の行列を掛ける
      const data = getTranslate(a, b, c);
      this.mat.mult(data);
      return this;
    }
    scale(sx, sy, sz){
      // sx, sy, sz倍の行列を掛ける
      const data = getScale(sx, sy, sz);
      this.mat.mult(data);
      return this;
    }
  }

  // getNormalMatrix.
  // モデルビューは既に4x4の配列として計算済み。それに対し左上の3x3から逆転置を作って返す。
  // この中で掛け算するのはいろいろと二度手間になりそうだったので却下。
  function getNormalMat(modelView){
    const result = new Array(9).fill(0);
    result[0] = modelView[0]; result[1] = modelView[1]; result[2] = modelView[2];
    result[3] = modelView[4]; result[4] = modelView[5]; result[5] = modelView[6];
    result[6] = modelView[8]; result[7] = modelView[9]; result[8] = modelView[10];
    return getInverseTranspose3x3(result);
  }

  // 順番としては
  // TransformExとCameraExを用意 → モデルとビューでモデルビュー作って法線も作って
  // プロジェも作ってモデルビューとプロジェと法線を送り込んで計算。
  // 現時点でTransformExの便利な書き方がないので困ったね～...（後回し）

  const ex = {};

  // utility.
  ex.getNormals = getNormals;
  ex.getMult4x4 = getMult4x4;
  ex.hsv2rgb = hsv2rgb;
  ex.hsvArray = hsvArray;
  ex.getNormalMat = getNormalMat;

  // class.
  ex.Painter = Painter;
  ex.Figure = Figure;
  ex.RenderNode = RenderNode;
  ex.Mat4 = Mat4;
  ex.CameraEx = CameraEx;
  ex.TransformEx = TransformEx;

  return ex;
})();
