// いい加減フレームバッファ
// まあ難しくないのです。全然。単純にとりあえず単純に色の方だけでもやろうぜと。
// 思います。

// やりたいこととしては32x32のvec4のfloatのあれを作って...ポイントスプライトで...的な？反射？動的更新？
// いきなり？？まあいいか...1024個の点集合、それぞれvec4のattribute持ってる、それを位置、で、はめて...
// ダブルの片方にそれをはめてswapで更新...writeをbindしてreadのテクスチャから...とかいう、あれ。
// その一方で描画に使って...というわけでプログラムは3つ要りますね。

// できるかな...やるしかないんじゃ...正規化デバイスで計算しましょう。

// エラー出なくなってようやく本番。点は未だ動かず...厳しいね。
// pixelDensity(1)を宣言しないとなぜか正規化デバイス座標系で指定した位置に表示されないバグが発生してる。

// 原因はフレームバッファを用意するときの何らかの処理と
// bindFBO(null)するときの何らかの処理のようです。詳細は調査中...ですがこれらを外したらうまくいったので
// そういうことかと。viewport関連ということですね。困ったね。何だろ...

// bindFBO(null)の方は単純にwidth,heightってやってたのをgl.drawingBufferWidth, gl.drawingBufferHeightにしたら
// pixelDensityの影響を受けなくなった。そういうことですね。

// もうひとつは...？
// データが書き込まれてないです。
// そりゃそうでしょ
// gl_PointSize = 1.0;
// 書いてないんだもん。上手く指定されるわけないわ。

// さ、次のフェイズ。サクサク行こう。
// あっさり終わってしまった...（なんじゃい）

// ただ、注意点が山ほどあった。ほんとうに山ほど。webgl2は難しいのだ。

// まず
// フレームバッファにアタッチするテクスチャを作るtexImage2Dにおいて
// InternalFormat, Format, Typeってのがあってね
// TypeにUNISIGNED_BYTE以外のFLOATやHALF_FLOATを使う場合
// 前の2つは限定される、まあそうはいってもgl.RGBA32Fとか一部ではあるんだけど。いろいろ。

// 次に
// それとbindFBO(null)する場合はp5jsの変数width, heightを使うのはまずいとのこと。
// gl.drawingBufferWidthとHeightを使う。これらはpixelDensityを考慮した値となっている。
// これ渡さないとおかしなことになるわけ。pixelDensityを1にする力技は反則なのでやめましょう。

// 最後に
// データを書き込む場合の点描画ではpointSizeを1.0にしないといけません
// これ去年もハマったよね？？

// これで位置はいいんだけど
// ポイントスプライトの大きさってdevicePixelRatioに依存するのよね
// だから使えないのよね...難しいところ。使えなくもないんだけどそれを考慮した値になるわけで。
// それもあってかpixi.jsでは全部rectにtexture貼り付けてる。まあ当然か。

// --------------------------------------------------------------------------- //
// global.

const ex = p5wgex;
let _node;

// --------------------------------------------------------------------------- //
// constants.

const SIZE = 32;

// --------------------------------------------------------------------------- //
// shaders.
// 最終的に全部ESSL300で書き直す...できれば...

// まずデータ格納用ですね
// 1024個の頂点からなるFigureを使って32x32のフレームバッファのテクスチャに書き込みします。
// 実はwebgl2では「https://wgld.org/d/webgl2/w008.html」にあるようにgl_VertexIDでindexをint型で取得して
// ivec2にしてテクセルフェッチで...とかできるんだけど今回はやりません。ナイーブにwebgl1でやります。ひとまずね。
const dataVert =
"precision mediump float;" +
"attribute vec4 aData;" +    // 位置と速度からなる4つのfloatの組
"attribute float aIndex;" +  // インデックス情報0～1023
"varying vec4 vData;" + // フラグメントシェーダで使うデータ値
"uniform float uSize;" + // 32は可変にする感じで...
"void main(){" +
"  float x = mod(aIndex, uSize);" +    // 0～31
"  float y = floor(aIndex / uSize);" + // 0～31
"  vec2 coord = (vec2(x, y) + 0.5) / uSize;" + // これで0～1に入る
"  coord = (coord - 0.5) * 2.0;" + // これで-1～1に入る。
"  coord.y = -coord.y;" +
"  vData = aData;" +
"  gl_Position = vec4(coord, 0.0, 1.0);" +
"  gl_PointSize = 1.0;" + // これ書かないとデータの書き込みできないんですよ...
"}";

const dataFrag =
"precision mediump float;" +
"varying vec4 vData;" + // バーテックスシェーダより。
"void main(){" +
"  gl_FragColor = vData;" + // おしまい！
"}";

// 次にデータ更新用ですね。
// 単純に反射でよいかと。えー、...この場合のFigureっていうのはただの板ポリなのです...主役はフレームバッファなので。
// アクセスは...んー。そうか。使えないわ。どうするかな。...
const updateVert =
"precision mediump float;" +
"attribute vec2 aPosition;" + // 板ポリの4つの頂点
"void main(){" +
"  gl_Position = vec4(aPosition, 0.0, 1.0);" +
"}";

const updateFrag =
"precision mediump float;" +
"uniform sampler2D uTex;" + // いいよuTexで。これがいわゆる「read」側
"void main(){" +
"  vec2 coord = gl_FragCoord.xy / 32.0;" +
"  vec4 data = texture2D(uTex, coord);" +
"  vec2 p = data.xy;" +
"  vec2 v = data.zw;" +
"  if(p.x + v.x < -0.999 || p.x + v.x > 0.999){ v.x *= -1.0; }" +
"  if(p.y + v.y < -0.999 || p.y + v.y > 0.999){ v.y *= -1.0; }" +
"  p += v;" +
"  gl_FragColor = vec4(p, v);" + // 更新完了
"}";

// 最後に描画用。色はどうでもいいですとりあえず。全部白で。
// attributeはindexのみ。
const colorVert =
"precision mediump float;" +
"attribute float aIndex;" +
"uniform float uSize;" + // 32.0です。
"uniform float uPointSize;" + // 暫定8.0で。
"uniform sampler2D uTex;" + // readサイドです。
"varying vec2 vVelocity;" +
"void main(){" +
"  vec2 coord = vec2(mod(aIndex, uSize), floor(aIndex / uSize));" + // これで0～31になった。
"  coord = (coord + 0.5) / uSize;" + // これでテクスチャ座標
"  vec4 data = texture2D(uTex, coord);" + // pとvの組。
"  gl_Position = vec4(data.xy, 0.0, 1.0);" + // data.xyに位置情報が入ってるのでそこにおく。
"  gl_PointSize = uPointSize;" +
"  vVelocity = data.zw;" +
"}";

// gl_PointCoord使って円かなんかにするのがいいと思うんだけどね。
const colorFrag =
"precision mediump float;" +
"varying vec2 vVelocity;" +
// getRGB(HSBをRGBに変換する関数)
"vec3 getRGB(float h, float s, float b){" +
"  vec3 c = vec3(h, s, b);" +
"  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);" +
"  rgb = rgb * rgb * (3.0 - 2.0 * rgb);" +
"  return c.z * mix(vec3(1.0), rgb, c.y);" +
"}" +
// メインコード
"void main(){" +
"  vec2 p = (gl_PointCoord.xy - 0.5) * 2.0;" +
"  if(length(p) > 1.0){ discard; }" +
"  vec3 col = getRGB(0.55, length(vVelocity) * 64.0, 1.0);" +
"  col *= pow(1.0 - length(p), 2.0);" +
"  gl_FragColor = vec4(col, 1.0);" + // 終了！
"}";

// --------------------------------------------------------------------------- //
// mainCode.
// どきどき

// そもそもpixelDensityの問題で正規化デバイスをこっちで決めてその通りに描画されないっていうんだったら
// test1.jsの内容は...あれは大丈夫な理由が説明できないでしょ。いいやもう。ちょっと実験しよう。

function setup(){
  createCanvas(640, 640, WEBGL);
  const _gl = this._renderer;
  _node = new ex.RenderNode(_gl);

  // まずシェーダー一通り用意しちゃうか。
  _node.registPainter("data", dataVert, dataFrag);
  _node.registPainter("update", updateVert, updateFrag);
  _node.registPainter("color", colorVert, colorFrag);

  // Figureはデータ格納用の点集合、板ポリ用の4つの頂点、最後に点描画用のインデックス集合。
  let _data = []; // エイリアス
  let dataArray = [];
  let indexArray = [];
  for(let i = 0; i < SIZE * SIZE; i++){
    const x = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const y = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const _speed = 0.002 + 0.01 * Math.random();
    const _direction = Math.PI * 2.0 * Math.random();
    dataArray.push(x, y, _speed * Math.cos(_direction), _speed * Math.sin(_direction));
    indexArray.push(i);
  }
  _data = [{name:"aData", data:dataArray, size:4}, {name:"aIndex", data:indexArray, size:1}];
  _node.registFigure("data", _data);
  _node.registFigure("board", [{name:"aPosition", size:2, data:[-1,-1,1,-1,-1,1,1,1]}]);
  _node.registFigure("indices", [{name:"aIndex", data:indexArray, size:1}]);

  // 準備完了！！じゃないや。フレームバッファかもーん。щ(ﾟДﾟщ)ｶﾓｰﾝ   ...なにこれ
  _node.registDoubleFBO("sprites", {w:SIZE, h:SIZE, textureType:"float"});

  _node.clearColor(0, 0, 0, 1); // スクリーンを黒で初期化

  // そうか。データの格納1回だけだったわ。

  // 最初にデータの格納. FBOをバインド。

  _node.bindFBO("sprites");
  _node.use("data", "data");
  _node.setUniform("uSize", SIZE);
  _node.drawArrays("points");
  _node.swapFBO("sprites"); // writeに書いた内容は常にreadに浮上させる
  _node.unbind();
}

function draw(){

  // 次にデータの更新。FBOをバインド。同時に同じFBOのテクスチャをセット。

  _node.bindFBO("sprites");
  _node.use("update", "board");
  _node.setFBOtexture2D("uTex", "sprites");
  _node.drawArrays("triangle_strip"); // 板ポリ芸なので
  _node.swapFBO("sprites"); // writeに書いた内容をreadに浮上させる
  _node.unbind();

  _node.enable("blend");
  _node.blendFunc("one", "one");

  // 最後にスクリーンに描画
  _node.bindFBO(null);
  _node.clear(); // スクリーンを黒で初期化
  _node.use("color", "indices");
  _node.setUniform("uSize", SIZE);
  _node.setUniform("uPointSize", 32.0);
  _node.setFBOtexture2D("uTex", "sprites");
  _node.drawArrays("points");
  _node.unbind();
  _node.flush();

  _node.disable("blend");

  // 問題なければいいね。まずありえないが...（もう怖くない！！）
  // お騒がせしました...
}
