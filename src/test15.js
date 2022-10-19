// ここでは簡単なMRTのテストをやります。
// 次のtestでいよいよピッキングをMRTで実行します。
// デプスの可視化、あのdoxasさんのコードの再現も余裕があればやります。（トーラスで...！）

// その前にattributeで遊ぼうか。

// Androidで開くとtest0, test1どっちもattributeは3つだけがACTIVEになっていますね。
// しかしvsだけ同じものを使い回す場合もあるから複雑だわね。難しい。
// パソコンは全部利用する態度でいます。それもなんかな...

// attr4は採用されます。まあそういうことです。

// ---global
const ex = p5wgex;
let _node;

// ---shaders
const vs =
`#version 300 es
in vec2 attr0; // fs0だけ利用
in vec2 attr1; // fs0だけ利用
in vec2 attr2; // fs1だけ利用
in vec2 attr3; // fs1だけ利用
in vec2 aPosition;
in vec2 attr4; // ダミー0. vsの中で無意味な使われ方をする。
in vec2 attr5; // ダミー1. vsには出てこない。
out vec2 v0;
out vec2 v1;
out vec2 v2;
out vec2 v3;
out vec2 vUv;
void main(){
  v0 = attr0;
  v1 = attr1;
  v2 = attr2;
  v3 = attr3;
  vUv = (aPosition + 1.0) * 0.5 + attr4 * 0.0; // とにかくシェーダー内に顔を出せば採用されるということ。
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const fs0 =
`#version 300 es
precision highp float;
in vec2 v0;
in vec2 v1;
in vec2 v2;
in vec2 v3;
in vec2 vUv;
out vec4 fragColor;
void main(){
  if(vUv.y < 0.5){ fragColor = vec4(v0, 1.0, 1.0); } // 下側
  else if(vUv.y > 0.5){ fragColor = vec4(v1, 1.0, 1.0); } // 上側
  else{
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
}
`;

const fs1 =
`#version 300 es
precision highp float;
in vec2 v0;
in vec2 v1;
in vec2 v2;
in vec2 v3;
in vec2 vUv;
out vec4 fragColor;
void main(){
  if(vUv.y < 0.5){ fragColor = vec4(v2, 1.0, 1.0); } // 下側
  else if(vUv.y > 0.5){ fragColor = vec4(v3, 1.0, 1.0); } // 上側
  else{
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
}
`;


// ---setup
function setup(){
  createCanvas(768, 256, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  _node.registPainter("test0", vs, fs0);
  _node.registPainter("test1", vs, fs1);
  _node.registFigure("bd", [
    {size:2, data:[-1,-1,1,-1,-1,1,1,1], name:"aPosition"},
    {size:2, data:[0,0,0,0,0,0,0,0], name:"attr0"},
    {size:2, data:[1,0,1,0,1,0,1,0], name:"attr1"},
    {size:2, data:[0,1,0,1,0,1,0,1], name:"attr2"},
    {size:2, data:[1,1,1,1,1,1,1,1], name:"attr3"},
    {size:2, data:[0,1,2,3,4,5,6,7], name:"attr4"}
  ]);
  const gr = createGraphics(768, 256);
  gr.fill(0);
  gr.textAlign(LEFT, TOP);
  gr.textSize(16);
  const info0 = _node.getAttrInfo("test0");
  const info1 = _node.getAttrInfo("test1");
  gr.text(info0.text, 5, 5);
  gr.text(info1.text, 5, 25);
  _node.registTexture("gr", {src:gr});
}

// ---draw
function draw(){
  _node.clearColor(0,0,0,1).clear();
  _node.use("test0", "bd").drawArrays("triangle_strip").unbind();
  ex.copyPainter(_node, {src:{name:"gr"}});
  _node.flush();
}
