
//これで遊んでみたい. fbmで炎。
// すげぇスマホでやったら速いけど上の方なんか黒いしみしみが！！

let myShader;
let vs =
`
precision mediump float;
attribute vec3 aPosition;
void main(){
  gl_Position = vec4(aPosition, 1.0);
}
`

let fs =
`
// てか#define普通に使えるのね
//#define BLUE_FLAME    // 青い炎
//#define GREEN_FLAME   // 緑の炎
precision mediump float;
uniform vec2 uResolution;
uniform float uTime; // 秒数
const vec2 rdmVector1 = vec2(127.1,311.7);
const vec2 rdmVector2 = vec2(269.5,183.3);
const float rdmConst = 43758.5453123;
// ハッシュ
vec2 hash(in vec2 p){
  p = vec2(dot(p, rdmVector1), dot(p, rdmVector2));
  return -1.0 + 2.0 * fract(sin(p) * rdmConst);
}
// ノイズ

float noise(in vec2 p)
{
  const float K1 = 0.366025404; // (sqrt(3)-1)/2;
  const float K2 = 0.211324865; // (3-sqrt(3))/6;

  vec2 i = floor(p + (p.x + p.y) * K1);

  vec2 a = p - i + (i.x + i.y) * K2;
  vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;

  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);

  vec3 n = h*h*h*h*vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c,hash(i + 1.0)));
  return dot(n, vec3(70.0));
}

// fbm.
float fbm(vec2 uv)
{
  float f;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  f  = 0.5000 * noise(uv); uv = m*uv;
  f += 0.2500 * noise(uv); uv = m*uv;
  f += 0.1250 * noise(uv); uv = m*uv;
  f += 0.0625 * noise(uv); uv = m*uv;
  f = 0.5 + 0.5 * f;
  return f;
}
// mainCode.
void main(){
  // uvは0～1×0～1なのでキャンバスのアスペクトに左右されてる感じね
  vec2 uv = gl_FragCoord.xy * 0.5 / uResolution.xy;
  vec2 q = uv;

  q.x *= 5.0; // 火の本数らしい。端数にすると切れる
  q.y *= 2.0; // 大きくすると粗くなる感じ

  float strength = floor(q.x + 1.0);

  float T3 = max(3.0, 1.25 * strength) * uTime;
  q.x = mod(q.x, 1.0) - 0.5;
  q.y -= 0.25;
  float n = fbm(strength * q - vec2(0, T3));

  float c = 1.0 - 16.0 * pow(max(0.0, length(q * vec2(1.8 + q.y * 1.5, 0.75)) - n * max(0.0, q.y + 0.25)), 1.2);

  float c1 = n * c * (1.5 - pow(2.50 * uv.y, 4.0));

// 最後に0.0～1.0でclampします
// ここを切ると外側にもいろいろ描画されるので興味深い
  c1 = clamp(c1, 0.0, 1.0);

  vec3 col = vec3(1.5 * c1, 1.5 * pow(c1, 3.0), pow(c1, 6.0));

// c1は掛けるほど小さくなるので。
#ifdef BLUE_FLAME
  col = col.zyx; // colの各成分の大きさの比率を変える感じ
#endif
#ifdef GREEN_FLAME
  col = 0.85*col.yxz;
#endif

  float a = c * (1.0 - pow(uv.y, 3.0));
  gl_FragColor = vec4(mix(vec3(0.0), col, a), 1.0);

  //gl_FragColor = vec4(1.0);
}
`

function setup(){
  createCanvas(600, 480, WEBGL);
  myShader = createShader(vs, fs);
  shader(myShader);
}

function draw(){
  clear();
  myShader.setUniform("uResolution", [width, height]);
  myShader.setUniform("uTime", millis() / 1000); // 秒数
  quad(-1, -1, -1, 1, 1, 1, 1, -1);
}

/*
元コード
xbeさんの2014年の作品
https://www.shadertoy.com/view/XsXSWS
//////////////////////
// Fire Flame shader

// procedural noise from IQ
vec2 hash( vec2 p )
{
	p = vec2( dot(p,vec2(127.1,311.7)),
			 dot(p,vec2(269.5,183.3)) );
	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

float noise( in vec2 p )
{
	const float K1 = 0.366025404; // (sqrt(3)-1)/2;
	const float K2 = 0.211324865; // (3-sqrt(3))/6;

	vec2 i = floor( p + (p.x+p.y)*K1 );

	vec2 a = p - i + (i.x+i.y)*K2;
	vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
	vec2 b = a - o + K2;
	vec2 c = a - 1.0 + 2.0*K2;

	vec3 h = max( 0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );

	vec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));

	return dot( n, vec3(70.0) );
}

float fbm(vec2 uv)
{
	float f;
	mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );
	f  = 0.5000*noise( uv ); uv = m*uv;
	f += 0.2500*noise( uv ); uv = m*uv;
	f += 0.1250*noise( uv ); uv = m*uv;
	f += 0.0625*noise( uv ); uv = m*uv;
	f = 0.5 + 0.5*f;
	return f;
}

// no defines, standard redish flames
//#define BLUE_FLAME
//#define GREEN_FLAME

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
	vec2 q = uv;
	q.x *= 5.;
	q.y *= 2.;
	float strength = floor(q.x+1.);
	float T3 = max(3.,1.25*strength)*iTime;
	q.x = mod(q.x,1.)-0.5;
	q.y -= 0.25;
	float n = fbm(strength*q - vec2(0,T3));
	float c = 1. - 16. * pow( max( 0., length(q*vec2(1.8+q.y*1.5,.75) ) - n * max( 0., q.y+.25 ) ),1.2 );
//	float c1 = n * c * (1.5-pow(1.25*uv.y,4.));
	float c1 = n * c * (1.5-pow(2.50*uv.y,4.));
	c1=clamp(c1,0.,1.);

	vec3 col = vec3(1.5*c1, 1.5*c1*c1*c1, c1*c1*c1*c1*c1*c1);

#ifdef BLUE_FLAME
	col = col.zyx;
#endif
#ifdef GREEN_FLAME
	col = 0.85*col.yxz;
#endif

	float a = c * (1.-pow(uv.y,3.));
	fragColor = vec4( mix(vec3(0.),col,a), 1.0);
}
*/
