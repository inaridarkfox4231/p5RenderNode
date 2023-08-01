// stencilとclipの習作

// webglのclipですね
// んー。めんどくさいなぁ。
// ステンシルまだよく理解してなくって。

// 一応成功ですね。おめでとう。
// 境界部分がギザギザなのはwebglだから仕方ないね
// 使い方を間違えてるんだと思う

// 多分このやり方ならカスタムシェーダであっても型抜きできるんじゃない？
// 2Dのようにクリッピング領域のintersectionがしたい場合は、
// たとえば2つであるならINCRで2にして2だけ通過させればいいと思うよ。
// 具体的には
// 最初のステージでこれと同じように0を1にしたうえで
// 次のステージで1だけ2で更新して0と2は据え置き
// 次のステージで2だけ3に更新して0,1,3は据え置き、ってやるわけ
// 逆クリップ？逆でいいと思う
// これも重ね掛け可能なはず
// まあオプションで追加するんじゃない、知らんけど。知らんけど～

// あとクリッピング領域に何にも描かないかどうかっていうのも選択肢なのよね
// いつだってすっからかんにしたいわけじゃないでしょう
// たとえば灰色べったりにしておきたい場合もあるでしょう
// それに関してはdavePagurek-clipでそれをやりたかったら
// 同じ描画を2回やればいいんじゃない？

// 別にclipを否定するわけじゃないです。
// 充分な柔軟性は獲得できるでしょう。おめでとうございます。以上。

// EVENODDは難しいと思うけれど...たとえば0と1を反転させるルールとか無いので。増やすか減らすかしかないので...
// 別のバッファに描いてかぶせるくらいしかないんじゃないかな。
// webglのclipは2Dと違ってEVENODDができない、っていうのはまあ、なんとなく残念な気もするけどね。

let gl;

function setup() {
  createCanvas(400, 400, WEBGL);
  gl = this._renderer.GL;
}

function draw() {
  background(255);

  gl.enable(gl.STENCIL_TEST);
  // ステンシルをクリアする
  gl.clear(gl.STENCIL_BUFFER_BIT);
  // ステンシルを0埋め
  gl.clearStencil(0);

  // 型抜きの際に色やデプスへの書き込みがされないようにする（これは選択肢ですが）
  gl.colorMask(false, false, false, false);
  //fill(128); // たとえばこうすると灰色のバックになるでしょう
  gl.depthMask(false);

  // ステンシルテストはすべて通過させる。
  gl.stencilFunc(gl.ALWAYS, 1, ~0);
  // デプスとステンシル両方通過したら1をおく感じで。1とはref.
  // つまりALWAYSであってもrefの値は使うので、でたらめでいいわけではない。
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

  // 描画
  sphere(40);
  rect(-100, -100, 100, 100);
  rect(0, 0, 100, 100);

  // 書き込みを復活させる
  gl.colorMask(true, true, true, true);
  gl.depthMask(true);

  // refと同じ値のところだけ描画されるようにする
  // ステンシルバッファはいじらない
  gl.stencilFunc(gl.EQUAL, 1, ~0);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);

  lights();
  fill("blue");
  specularMaterial(64);
  noStroke();
  rotateX(frameCount*TAU/240);
  rotateY(frameCount*TAU/360);
  box(100);

  gl.disable(gl.STENCIL_TEST);
}
