// depthをテクスチャとして設定して通常の計算方法と比較
// 何が入ってるのか見たい
// 急遽予定変更でlil.guiに慣れたいです
// 最終的にメソッド化して道具にする
// てか両方でいいのでは？

// 何かめんどくさくなってきたな...
// どうもdepth textureめんどくさいようなので保留。

// lil.guiに慣れよう！！というわけで。
// ライティングにlilを組み合わせてトーラスで実験するか。よし。（結局、そうなる...）

let ex = p5wgex;
const _node;

const vs = "";
const fs = "";

const gui = (function(){
  const gui = new GUI();
})();

function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new RenderNode(this._renderer.GL);

}

function draw(){

}
