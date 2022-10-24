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

/*
rotateY(t); translate(x,y); は
translate(x*cos(t), y, -x*sin(t)); と同じ。
*/


// 元のコード、sphereの最大半径が4なんだが...lightingもはや無関係やん。
// まあええわ。点描画しくよろ～モデル行列とかいらないです。ビューとプロジェクションだけで動かしましょう。

// 息抜きは大事
// test28でいいからチューブ状のメッシュで書き直そう。これ螺旋だ。ということはチューブ化の手法が使える。
// zもxの関数で滑らかなので
// むりやり滑らかにする...？

// もうなんかめんどくさいな
// 別にこれ作る必要ないんじゃない

// 微分可能関数にしました。C-infinityで非特異なのでフルネセレの標構が使えます。

// また今度

const ex = p5wgex;
let _node;
let _cam;
let _timer = new ex.Timer();

const DELTA = Math.PI * 2 / 64000; // 間隔

const vs =
`#version 300 es
in float aIndex;

uniform float uTime; // 事前に60.0かなんかで秒数を割っておく

uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

out vec3 vPosition; // 今回はモデルの座標をそのまま使うのでこれでいく。

void main(){
  float x = 100.0 * aIndex;
  float z = 50.0 + 50.0 * sin(uTime / 4.0 - x / 24.0);
  vec3 pos = vec3(x*cos(x+uTime), x*sin(x+uTime), z);
  vPosition = pos;
  gl_Position = uProjectionMatrix * uViewMatrix * vec4(pos, 1.0);
  gl_PointSize = max(4.0 - x/99.0, 0.0);
}
`;

const fs =
`#version 300 es
precision highp float;
in vec3 vPosition;

out vec4 fragColor;
void main(){
  vec3 col = vec3(1.0);
  float d = length(vPosition);
  col.g *= d / 100.0;
  col.b *= d / 200.0;
  fragColor = vec4(col, 1.0);
}
`;

function setup(){
  createCanvas(800, 400, WEBGL);
  _timer.initialize("slot0");
  _node = new ex.RenderNode(this._renderer.GL);
  const d = 200*Math.sqrt(3);
  _cam = new ex.CameraEx({
    w:800, h:400, eye:[d/Math.sqrt(2), 0, d/Math.sqrt(2)], top:[0, 0, 1], proj:{near:0.1, far:10}
  });

  _node.registPainter("drawPoints", vs, fs);

  // 点を64000個. index*TAU/64000を格納しとく
  const indices = new Array(64000);
  for(let i=0, N=indices.length; i<N; i++){ indices[i] = i*Math.PI*2/64000; }
  _node.registFigure("points", [{size:1, data:indices, name:"aIndex"}]);
}

function draw(){
  _node.clearColor(0, 0, 0, 1).clear();
  _node.use("drawPoints", "points")
       .setUniform("uTime", _timer.getDelta("slot0")*10); // 秒数を10倍しているので10倍速

  moveCamera(_cam);

  // projとview.
  const projMat = _cam.getProjMat().m;
  _node.setUniform("uProjectionMatrix", projMat);
  const viewMat = _cam.getViewMat().m;
  _node.setUniform("uViewMatrix", viewMat);

  _node.drawArrays("points")
       .unbind()
       .flush();
}

function moveCamera(cam){
  if(keyIsDown(RIGHT_ARROW)){ cam.spin(0.03); }
  if(keyIsDown(LEFT_ARROW)){ cam.spin(-0.03); }
  if(keyIsDown(UP_ARROW)){ cam.arise(0.04); } // 上
  if(keyIsDown(DOWN_ARROW)){ cam.arise(-0.04); } // 下
  if(keyIsDown(69)){ cam.dolly(0.05); } // Eキー
  if(keyIsDown(68)){ cam.dolly(-0.05); } // Dキー
}



/*
let f=0;
function setup(){
  createCanvas(800, 400, WEBGL);
}

function draw(){
  rotateX(-PI/4); // カメラ項は無視でOK
  pointLight(255,255,255,0,-400,400);
  pointLight(255,255,255,0,400,-400);
  pointLight(100,100,100,0,-100,100);
  for(let i=0; i<TAU; i+=TAU/64000){
    push();
    const F = (f + 99 * i) % 400 + i;
    const Y = -99 * abs(sin(f/44 - F/33));
    //rotateY(F);
    //translate(F,Y);
    translate(F*cos(F), Y, -F*sin(F)); // なるほど螺旋状になってるわけだ。そりゃ中途半端な見た目になるわけだわ。
    // fが引数だけど...まあ時間でいいか。time/60を入れるだけ。x,y,zを事前に64000個計算する。
    // まあvertexShaderで決めちゃえばいいか。簡単ね。
    // あとはCameraが...はい。しかしpointLightが浮いてしまうね。んー...まあ、無視で...
    // てか点描画でしょ？単純にその位置からの距離で明るさ求めて適当に和を取る、でいいでしょ。
    // rotateYはx軸とz軸をいじるのです
    // cosとsinで書ける
    // それのx成分とy成分でずらす感じ
    stroke(-3*Y);
    strokeWeight(4-F/99);
    point(0,0,0);
    pop();
  }
  box(3000);
  noLoop();
}
*/
