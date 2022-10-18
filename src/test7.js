// 2Dで、createGraphicsでWEBGL作ってそれに対して_nodeこしらえて...とかするテスト。
// 内容切り替えて色んなとこにimageで落とせば複数カメラとか楽にできる、ただ応用は効かないのよね。
// フレームバッファのやり方でないと。鏡面反射とか、そっちに行けない気がして。行けるのかな...まあ、いいや。

// 板ポリ芸かなぁ。2つ用意して...

// まあいいんですけど、そのうち動的更新もやるのでちょっとそこら辺ね...そのうちね...
// 仕様変更による過去作の改変とか大変そう...極力辺か少なくいきたいところ。
// あれやりたい。ランダムテーブル使ってスマホでも動くノイズ雲。出来る...はず...

// まあ、いいや。よくできました。

// -------global------- //
const ex = p5wgex;
let gr0, gr1;
let _node0, _node1;
//let _startTime;
const _timer = new ex.Timer();

// -------shaders------- //
// webgl2なのでESSL300で書いてみる。
// 今回は中心原点でいくか
// 板ポリだし上下も関係ないわね
const copyVert =
`#version 300 es

in vec2 aPosition;
out vec2 vUv; // vertexStageのvaryingはoutで、

void main(void){
  vUv = aPosition;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// デモなので板ポリ芸2つほどこしらえる方向で。
// そうね...
const testFrag0 =
`#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
out vec4 fragColor;
// getRGB(HSBをRGBに変換する関数)
vec3 getRGB(float h, float s, float b){
  vec3 c = vec3(h, s, b);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}
void main(){
  vec2 p = vUv * 4.0;
  vec2 ip = floor(p + uTime);
  vec3 col = getRGB(0.66, mod(ip.x + ip.y, 2.0), 1.0);
  fragColor = vec4(col, 1.0);
}
`;

// チェック模様を反転でいじるとかでどう？
const testFrag1 =
`#version 300 es
precision highp float;
in vec2 vUv;
uniform float uTime;
out vec4 fragColor;
// 反転関数。大きさの2乗で割る
vec2 inv(in vec2 q){
  float L = q.x*q.x + q.y*q.y;
  return q/L;
}
// getRGB(HSBをRGBに変換する関数)
vec3 getRGB(float h, float s, float b){
  vec3 c = vec3(h, s, b);
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}
void main(){
  vec2 p = inv(vUv);
  p *= 4.0;
  vec2 ip = floor(p + uTime);
  vec3 col = getRGB(0.66, mod(ip.x + ip.y, 2.0), 1.0);
  fragColor = vec4(col, 1.0);
}
`;

// 複数のレンダーノード使うの初めてだから緊張するわね

// -------setup------- //
function setup(){
  createCanvas(800, 640);
  //_startTime = performance.now();
  _timer.initialize("slot0");
  gr0 = createGraphics(400, 320, WEBGL);
  gr1 = createGraphics(400, 320, WEBGL);
  _node0 = new ex.RenderNode(gr0._renderer.GL);
  _node1 = new ex.RenderNode(gr1._renderer.GL); // これでよいはず

  // まあ難しくなく、板ポリで。
  const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
  _node0.registPainter("test0", copyVert, testFrag0);
  _node1.registPainter("test1", copyVert, testFrag1);

  _node0.registFigure("board", [{name:"aPosition", size:2, data:positions}]);
  _node1.registFigure("board", [{name:"aPosition", size:2, data:positions}]);

  textSize(16);
  noStroke();
  fill(255);
}

// -------draw------- //
function draw(){
  //const _time = (performance.now() - _startTime) / 1000;
  const currentTime = _timer.getDelta("slot0");

  background(0);
  _node0.use("test0", "board")
        .setUniform("uTime", currentTime)
        .drawArrays("triangle_strip")
        .unbind().flush();
  _node1.use("test1", "board")
        .setUniform("uTime", currentTime)
        .drawArrays("triangle_strip")
        .unbind().flush();

  image(gr0, 0, 0);
  image(gr1, 400, 320);
  textAlign(LEFT,TOP);
  text("↑これを斜めにスクロールすることで、", 10, 330);
  text("By scrolling diagonally,", 25, 350);
  textAlign(LEFT, BOTTOM);
  text("↓反転がこのようになります", 410, 310);
  text("the inversion looks like this.", 425, 290);
}
