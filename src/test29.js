// KomaTebe Browser Clusher

// Komatebe https://twitter.com/KomaTebe/status/1581978500696657921
// pointSpriteでよくね？
/*
f=0,draw=a=>{for(f++||createCanvas(800,W=400,WEBGL,T=translate),rotateX(-.8),
[W,-W,100].map(a=>pointLight([a],0,-a,a)),i=0;i<TAU;i+=TAU/64e3)push(),
rotateY(F=(f+99*i)%W+i),T(F,Y=-99*abs(sin(f/44-F/33))),fill(3*-Y),pop(sphere(4-F/99,W));box(3e3);noLoop()};
*/

// pointでいけるっぽいです。いっちゃおう。
// 64000個でしょ？楽勝。

let f=0;
function setup(){
  createCanvas(800, 400, WEBGL);
}

function draw(){
  rotateX(-PI/4);
  pointLight(255,255,255,0,-400,400);
  pointLight(255,255,255,0,400,-400);
  pointLight(100,100,100,0,-100,100);
  for(let i=0; i<TAU; i+=TAU/64000){
    push();
    rotateY(F=(f+99*i)%400+i);
    translate(F,Y=-99*abs(sin(f/44-F/33)));
    stroke(-3*Y);
    strokeWeight(4-F/99);
    point(0,0,0);
    pop();
  }
  box(3000);
  noLoop();
}
