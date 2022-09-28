// doubleをやめて、単純に入れるだけにして実験する。
// SIZEも小さくする。

// bindFBO(null)の方は単純にwidth,heightってやってたのをgl.drawingBufferWidth, gl.drawingBufferHeightにしたら
// pixelDensityの影響を受けなくなった。そういうことですね。

// もうひとつは...？
// データが書き込まれてないです。

// データの書き込みの際に
// gl_PointSize = 1.0;
// これを指定しないときちんと書き込まれないのです。
// 去年と同じとこでハマりましたね。馬鹿ですか？（うっさい）

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
"  gl_PointSize = 1.0;" + // これですね。これ書かないといけないんですよ。ほんとに...馬鹿
"}";

const dataFrag =
"precision mediump float;" +
"varying vec4 vData;" + // バーテックスシェーダより。
"void main(){" +
"  gl_FragColor = vData;" + // おしまい！
"}";

// 最後に描画用。色はどうでもいいですとりあえず。全部白で。
// attributeはindexのみ。
const colorVert =
"precision mediump float;" +
"attribute float aIndex;" +
"uniform float uSize;" + // 32.0です。
"uniform float uPointSize;" + // 暫定8.0で。
"uniform sampler2D uTex;" + // readサイドです。
"void main(){" +
"  vec2 coord = vec2(mod(aIndex, uSize), floor(aIndex / uSize));" + // これで0～31になった。
"  coord = (coord + 0.5) / uSize;" + // これでテクスチャ座標
"  vec4 data = texture2D(uTex, coord);" + // pとvの組。
"  gl_Position = vec4(data.xy, 0.0, 1.0);" + // data.xyに位置情報が入ってるのでそこにおく。
"  gl_PointSize = uPointSize;" +
"}";

// gl_PointCoord使って円かなんかにするのがいいと思うんだけどね。
const colorFrag =
"precision mediump float;" +
"void main(){" +
"  gl_FragColor = vec4(1.0);" + // 終了！
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
  _node.registPainter("color", colorVert, colorFrag);

  // Figureはデータ格納用の点集合、板ポリ用の4つの頂点、最後に点描画用のインデックス集合。
  let _data = []; // エイリアス
  let dataArray = [];
  let indexArray = [];
  for(let i = 0; i < SIZE * SIZE; i++){
    const x = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const y = (Math.random()<0.5 ? 1 : -1) * 0.999 * Math.random();
    const _speed = 0.005 + 0.02 * Math.random();
    const _direction = Math.PI * 2.0 * Math.random();
    dataArray.push(x, y, _speed * Math.cos(_direction), _speed * Math.sin(_direction));
    indexArray.push(i);
  }
  _data = [{name:"aData", data:dataArray, size:4}, {name:"aIndex", data:indexArray, size:1}];
  _node.registFigure("data", _data);
  _node.registFigure("indices", [{name:"aIndex", data:indexArray, size:1}]);

  // 準備完了！！じゃないや。フレームバッファ
  _node.registFBO("sprites", {w:SIZE, h:SIZE, textureType:"float"});

  _node.clearColor(0, 0, 0, 1); // スクリーンを黒で初期化

  _node.bindFBO("sprites");
  _node.use("data", "data");
  _node.setUniform("uSize", SIZE);
  _node.drawArrays("points");
  _node.unbind();

}

function draw(){
  // 最後にスクリーンに描画
  _node.bindFBO(null);
  _node.clear(); // スクリーンを黒で初期化
  _node.use("color", "indices");
  _node.setUniform("uSize", SIZE);
  _node.setUniform("uPointSize", 8.0);
  _node.setFBOtexture2D("uTex", "sprites");
  _node.drawArrays("points");
  _node.unbind();
  _node.flush();

  noLoop();
}
