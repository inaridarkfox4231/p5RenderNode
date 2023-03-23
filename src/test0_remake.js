// 20230317
// 新しくしました
// 最新版に揃えてあります
// なんていうか...
// 3つ目のgradationのとこ、
// gradationFlagを明示的にtrueにしないとgradationが適用されない仕組みで
// めんどくさいので
// StartとStopがあれば適用されるようにしたいところ
// ですね...

// ------------------------------------------------------------------------------------------------------------ //
// global.

const ex = p5wgex; // alias.
let _node; // RenderNode.
const _timer = new ex.Timer();

// ------------------------------------------------------------------------------------------------------------ //
// main code.

function setup(){
  _timer.initialize("slot0");
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);

  // defaultPainter...

  // テスト用背景
  const bg = createGraphics(width, height);
  bg.noStroke();
  for(let i=0; i<height; i++){
    bg.fill(0, 0, i*255/height);
    bg.rect(0, i, width, 1);
  }
  bg.fill(255);
  bg.textAlign(CENTER, CENTER);
  bg.textSize(min(width,height)*0.05);
  bg.text("welcome to webgl2", width*0.5, height*0.5);
  //bgTex = new p5.Texture(_gl, bg);
  _node.registTexture("bg", {src:bg}); // 簡単でしょ？wとhすら不要。

  // uvShiftのtest
  const bg2 = createGraphics(width, height);
  bg2.noStroke();
  for(let i=0; i<8; i++){
    for(let k=0; k<8; k++){
      if((i+k)%2==0){
        bg2.fill(0);
      }else{
        bg2.fill(255);
      }
      bg2.rect(width*i/8, height*k/8, width/8, height/8);
    }
  }
  _node.registTexture("bg2", {src:bg2, sWrap:"repeat", tWrap:"repeat"});

  // gradationのtest.
	// gradationFlagを明示的にtrueにしないと適用されないんですが、
	// めんどうだな...仕様変更でなんとかするか...
  const bg3 = createGraphics(width, height);
  bg3.noStroke();
  bg3.fill(0);
  bg3.textAlign(CENTER, CENTER);
  bg3.textSize(min(width,height)*0.05);
  bg3.text("TEST FOR GRADATION.", width/2, height/2);
  _node.registTexture("bg3", {src:bg3});

  // opacityのtest.
  const bg4 = createGraphics(width, height);
  bg4.background(255,0,0);
  bg4.noStroke();
  bg4.fill(255);
  bg4.textAlign(CENTER, CENTER);
  bg4.textSize(min(width,height)*0.05);
  bg4.text("TEST FOR OPACITY.", width/2, height/2);
  _node.registTexture("bg4", {src:bg4});

  _node.clearColor(0, 0, 0, 0);
}

function draw(){
  // ごくごく普通の板ポリ芸
  _node.clear();
  const t = _timer.getDelta("slot0");
  ex.copyPainter(_node, {src:[
    {name:"bg", view:[0,0,0.5,0.5]},
    {name:"bg2", view:[0.5,0,0.5,0.5], uvShift:[t*0.25, t*0.25]},
    {name:"bg3", view:[0,0.5,0.5,0.5], gradationFlag:true, gradationStart:[0,0,1,1,0,1], gradationStop:[1,1,0,1,1,1]},
    {name:"bg4", view:[0.5,0.5,0.5,0.5], opacity:0.75},
  ]});
  _node.flush();
}
