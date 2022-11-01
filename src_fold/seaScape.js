// 20221101
// 今読んでも多分理解できないけどな
// 後学のために
// うぬぼれって怖いねぇ
// 20221101
// 元ネタ：https://www.shadertoy.com/view/Ms2SD1
// ただこれ激重なので普通に動かないです(10fpsくらい)
// これをいじって動くようにした経緯があるようです

// 謙虚にならなければいけない
// ちなみにきっかけをくれたのはこちらのQiitaになります：https://qiita.com/edo_m18/items/a575606a60b21f0d2c57
// @edo_m18 さんのレイマーチングによる波表現を読み解く、っていう記事です。
// 上記shaderToyのリンクはそっちにも貼ってあります...
// ただ重いですね...すごく。
// それの確か軽い亜種みたいのがあってそれを参考にしてこれを作った気がする
// んでもってノイズがバリューでなんか汚かったから自作の（もちろん勉強して）作ったグラディエントノイズで書き直した
// そういう経緯ですね

// frameRate(30)で安定するので30でいいです。
// まあこのパソコンのスペックで60fpsなんて無理なのよ。60が限界。

// https://www.shadertoy.com/view/lt3GWj
// CaliCoastReplayさんのこれ
// これを写経したのがこれなのよね
// NightModeが実装されてるんだけどそこまでは行けなかった
// ああー思い出したわー
// 懐かしいよ...
// いろいろやることで処理が重くなる...はず？
// ていうか本家120fps出てるんですけど
// やっぱ生webglのが速いのか...いやおかしいだろ？？
// 悔しいなぁ
// よく見ると見た目も全然違うしめちゃ悔しい
// リベンジする！！！ぞ！！！
// 生webglなら...速いのかな...p5jsじゃなければ...

// lilでモードいじれるようにしよう。
// fpsは...頑張ってみる。

// valueノイズだから軽いんじゃないかな...gradientにしたから重い、そんな気が、する。ただそれだけの話なのでは。
// だからgradientにこだわる限りfpsの向上は望めない？まあ、いいじゃん、別に。
// ていうか微妙に本家と変えててよくわかんないところがあるからもう一度本家をきちんと写経して
// 上げ直そう

// なおSeascape--Sailingは2016/08/28です。その後...↓

// https://www.shadertoy.com/view/MdXyzX by afl_ext 2017/03/09
// Very fast procedural ocean
// まあ速いです。んで太陽きらきら～
// その改良版...？
// https://www.shadertoy.com/view/3scfD7 by jarble 2020/11/12 (あ、Seascapeやったのと同年...あのあとか。知るわけないわな...)
// Even faster procedural ocean
// よくわかんないけどカメラからの距離によりprecisionをさげることで高速化を実現した
// みたいなことが書いてある（いわゆるLOD処理？）
// レイマ高速化の話題をまさぐるとよく出てくるやつだ
// まじか...てか何で競ってるのww

// てかどっちも速いからよくわからん
// よく見るとレイマーチングのところですが(318回ってなんじゃい)
// カメラとの距離をepsに掛けてるんですよ
// それにより遠いところほど処理が雑になるわけです
// なるほど...
// そこ以外ほぼほぼ同じですね（微妙な違いはある）
// どっちもfps120前後だからよくわからん

// ちなみにその仕事をこれ投稿日が2022/08/13だから3ヶ月前？か？
// jarbleさんをafl_extさんが「great stuff!」（素晴らしい）ってほめてますね（ほっこり）
// んー...

// raymarchwaterんとこ
// 50にすると前者は崩れるけど後者はびくともしない、つまり50以内に抑えられてるわけだ。すごい。
// まあどっちも読んでもよくわかんないわけだが。

let myShader;

let vs =
"precision mediump float;" +
"attribute vec3 aPosition;" +
"void main(void){" +
"  gl_Position = vec4(aPosition, 1.0);" +
"}";

let fs =
"precision mediump float;" +
"uniform vec2 u_resolution;" +
"uniform vec2 u_mouse;" +
"uniform float u_time;" +
// 円周率
"const float pi = 3.14159;" +
// ランダム定数
"const float r_coeff = 43758.5453123;" +
// レイマーチングの回数
"const int NUM_STEPS = 6;" +
// 海面の高さを計算する際の繰り返し回数（ラフ、ディテール）・・名前変えちゃおうか。
"const int ITER_ROUGH = 2;" +
"const int ITER_DETAILED = 5;" +
// 海関連の定数（SEA_TIME = u_time * SEA_SPEED は別に定義する）
"const float SEA_HEIGHT = 0.5;" + // 海全体の高さ。小さいとベタ凪。
"const float SEA_CHOPPY = 3.0;" + // 波の複雑さ。大きいと複雑になる。
"const float SEA_SPEED = 1.9;" + // 波の移動速度。大きいとぎゅーーん。
"const float SEA_FREQ = 0.24;" + // 基本波の山の数。大きいと細かい。
"const vec3 SEA_BASE = vec3(0.11, 0.19, 0.22);" + // 海のベースカラー
"const vec3 SEA_WATER_COLOR = vec3(0.55, 0.9, 0.7);" + // 海水のベースカラー
// 海面の高さを計算するための繰り返しに使う行列
"mat2 octave_m = mat2(1.7, -1.2, 1.2, 1.4);" +
// hsbで書かれた(0.0～1.0)の数値vec3をrgbに変換する魔法のコード
"vec3 getHSB(float r, float g, float b){" +
"  vec3 c = vec3(r, g, b);" +
"  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);" +
"  rgb = rgb * rgb * (3.0 - 2.0 * rgb);" +
"  return c.z * mix(vec3(1.0), rgb, c.y);" +
"}" +
// fromEulerの独自修正版。(roll, pitch, yaw)で取得する。ベクトルの変換行列。
// 1箇所でしか使ってないからわかりやすいように成分表記にした。
// rollで横揺れしたあとpitchで上下動、最後にyawでぐるぐる水平回転
"mat3 fromEuler(float roll, float pitch, float yaw){" +
"	 vec2 a = vec2(cos(roll), sin(roll));" +
"  vec2 b = vec2(cos(pitch), sin(pitch));" +
"  vec2 c = vec2(cos(yaw), sin(yaw));" +
// 画面の横揺れ（roll）
"  mat3 m_roll;" +
"  m_roll[0] = vec3(a.x, a.y, 0.0);" +
"	 m_roll[1] = vec3(-a.y, a.x, 0.0);" +
"	 m_roll[2] = vec3(0.0, 0.0, 1.0);" +
// 縦揺れ（pitch）
"  mat3 m_pitch;" +
"  m_pitch[0] = vec3(1.0, 0.0, 0.0);" +
"	 m_pitch[1] = vec3(0.0, b.x, b.y);" +
"	 m_pitch[2] = vec3(0.0, -b.y, b.x);" +
// 水平回転（yaw）
"  mat3 m_yaw;" +
"  m_yaw[0] = vec3(c.x, 0.0, c.y);" +
"	 m_yaw[1] = vec3(0.0, 1.0, 0.0);" +
"	 m_yaw[2] = vec3(-c.y, 0.0, c.x);" +
// m_roll, m_pitch, m_yawの順に適用される
"	 return m_yaw * m_pitch * m_roll;" +
"}" +
// バリューノイズの準備、ハッシュ関数
"float hash(vec2 p){" +
"  float h = sin(dot(p, vec2(127.1, 311.7)));" +
"  return fract(h * 43758.5453123);" +
"}" +
// 2Dランダムベクトル(-1.0～1.0)
"vec2 random2(vec2 st){" +
"  vec2 v = vec2(0.0);" +
"  v.x = sin(dot(st, vec2(127.1, 311.7))) * r_coeff;" +
"  v.y = sin(dot(st, vec2(269.5, 183.3))) * r_coeff;" +
"  return -1.0 + 2.0 * fract(v);" + // -1.0～1.0に正規化
"}" +
// グラディエントノイズ
"float gnoise2(vec2 p){" +
"  vec2 i = floor(p);" +
"  vec2 f = fract(p);" +
"  vec2 u = f * f * (3.0 - 2.0 * f);" +
"  vec2 p_00 = vec2(0.0, 0.0);" +
"  vec2 p_01 = vec2(0.0, 1.0);" +
"  vec2 p_10 = vec2(1.0, 0.0);" +
"  vec2 p_11 = vec2(1.0, 1.0);" +
"  float value_00 = dot(random2(i + p_00), f - p_00);" +
"  float value_01 = dot(random2(i + p_01), f - p_01);" +
"  float value_10 = dot(random2(i + p_10), f - p_10);" +
"  float value_11 = dot(random2(i + p_11), f - p_11);" +
"  return mix(mix(value_00, value_10, u.x), mix(value_01, value_11, u.x), u.y);" +
"}" +
// 拡散の所はおいおい理解します（海の色の計算）
// nは海面の法線ベクトル、lは入射光の逆ベクトル、pは・・80.0？？
// nとlの方向が近いほど大きい（maxで1.0）
"float diffuse(vec3 n, vec3 l, float p){" +
"  return pow(dot(n, l) * 0.4 + 0.6, p);" +
"}" +
// 鏡面反射？？
// nとlは上と同じ、eはeye（目の位置から該当位置への単位ベクトル）、sには90.0が入ってるっぽい。
"float specular(vec3 n, vec3 l, vec3 eye, float s){" +
"  float nrm = (s + 8.0) / (pi + 8.0);" +
"  return pow(max(dot(reflect(eye, n), l), 0.0), s) * nrm;" +
"}" +
// 上の二つってpowがpowなら80乗とか90乗になっちゃうんだけどおかしいなぁ。。ほんとに？？
// 空の色
// eyeは目線のベクトル。y座標しか使わない。上の方だと空、下の方は考えない感じ（0.0になっちゃう、適用されることを想定してない）
// ちなみに真っ白になる。上の方ほど濃い青になっている。
"vec3 getSkyColor(vec3 e){" +
"  e.y = max(e.y, 0.0);" +
"  vec3 skyColor;" +
"  skyColor.x = pow(1.0 - e.y, 2.0);" +
"  skyColor.y = 1.0 - e.y;" +
"  skyColor.z = 0.6 + (1.0 - e.y) * 0.4;" +
"  return skyColor;" +
"}" +
// 海の表面を作る
// 最初に基本波（オクターブ）を作る
"float sea_octave(vec2 uv, float choppy){" +
// まずノイズによる横方向の変動を加える
//"  uv += vnoise2(uv);" +
"  uv += gnoise2(uv);" +
// 0.0と±1.0で挙動が異なる二つの波を片方の割合でmixする
"  vec2 wv = 1.0 - abs(sin(uv));" +
"  vec2 swv = abs(cos(uv));" +
"  wv = mix(wv, swv, wv);" +
// x, y成分を掛けて0.65乗でなだらかにしてさらに・・なんかする（（
"  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);" +
"}" +
// 次にmap（粗い方）を作る感じ。ラフなので繰り返しは2回だけ。
// ラフの方はレイマーチングで海面との交点を出すのに使われる感じですね。
"float map_rough(vec3 p){" +
"  float freq = SEA_FREQ;" +  // 振動数、基本波を作るときに適用する。
"  float amp = SEA_HEIGHT;" +  // 振幅（波の高さ的な？）
"  float choppy = SEA_CHOPPY;" +  // 波の形らしいんだけどね。
"  float seatime = u_time * SEA_SPEED;" +  // あっちでSEA_TIMEとなってるやつ。
"  vec2 uv = p.xz;" + // xz平面への射影ですね
"  uv.x *= 0.75;" + // なんで水平方向で縮めているのかは知らない。実験してみるか。
// dは各段階での基本波、hは最終的な海面の水平からの高さ。
// returnでp.y - hを取ることで海面からの高さが出る計算ですね。
"  float d, h = 0.0;" +
"  for(int i = 0; i < ITER_ROUGH; i++){" +
"    d = sea_octave((uv + seatime) * freq, choppy);" +
"    h += d * amp;" +
"    uv = octave_m * uv;" +
"    freq *= 1.9;" +  // 振動数を大きく
"    amp *= 0.22;" +  // 振幅を小さく
"    choppy = mix(choppy, 1.0, 0.2);" +  // 0.2に近づくように小さくしている
"  }" +
"  return p.y - h;" +
"}" +
// 次に、map（詳しい方）を作る。繰り返し回数は5回になる。係数もちょっと変えてる。
// ディテールの方は法線を作る為に3回呼び出される感じですね。
"float map_detailed(vec3 p){" +
"  float freq = SEA_FREQ;" +  // 振動数。
"  float amp = SEA_HEIGHT;" +  // 振幅。
"  float choppy = SEA_CHOPPY;" +  // 波の形。
"  float seatime = u_time * SEA_SPEED;" +  // SEA_TIME
"  vec2 uv = p.xz;" + // xz平面への射影。
"  uv.x *= 0.75;" +
"  float d, h = 0.0;" +
"  for(int i = 0; i < ITER_DETAILED; i++){" +
"    d = sea_octave((uv + seatime) * freq, choppy) + sea_octave((uv - seatime) * freq, choppy);" + // 波にバリエーションを持たせる
"    h += d * amp;" +
"    uv = (octave_m / 1.2) * uv;" + // やや小さく
"    freq *= 1.9;" +  // 振動数を大きく
"    amp *= 0.22;" +  // 振幅を小さく
"    choppy = mix(choppy, 1.0, 0.2);" +  // 0.2に近づくように小さくしている
"  }" +
"  return p.y - h;" +
"}" +
// 海の色
// pは海面上のある地点、nはそこにおける突き出し法線ベクトル、lはそこに刺さる入射光の逆ベクトル、
// eyeはそこに刺さる目線の方向単位ベクトル、distは目の位置からpに向かうベクトル。
"vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist){" +
// フレネルの法則使って反射光と屈折光の割合を決めているらしいパート
"  float fresnel = 1.0 - max(dot(n, -eye), 0.0);" +
"  fresnel = pow(fresnel, 3.0) * 0.45;" +
// 反射光。色は空の色。
"  vec3 reflected = getSkyColor(reflect(eye, n)) * 0.99;" +
// 屈折光。海本来の色は光がまっすぐ差し込んでいるほど大きく反映される（横に近い角度から見るとほぼ反射光ってなるでしょそういうの）
"  vec3 refracted = SEA_BASE + diffuse(n, l, 80.0) * SEA_WATER_COLOR * 0.27;" +
// fresnelの割合で混ぜる
"  vec3 color = mix(refracted, reflected, fresnel);" +
// 減衰効果、海面が近いほど、ピークに近いほど海の色が反映される、？
"  float atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);" +
"  color += SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.15 * atten;" +
// 反射光が直接目に飛び込んでくる場合の明るくなる効果を表現しているみたいです
"  color += vec3(specular(n, l, eye, 90.0)) * 0.5;" +
"  return color;" +
"}" +
// 海面上の地点pにおける法線ベクトルの取得
"vec3 getNormal(vec3 p, float eps){" +
"  vec3 n;" +
"  n.y = map_detailed(p);" + // より詳しい海面の高さをまずは計算する
"  n.x = map_detailed(vec3(p.x + eps, p.y, p.z)) - n.y;" +
"  n.z = map_detailed(vec3(p.x, p.y, p.z + eps)) - n.y;" +
"  n.y = eps;" + // どうもmap_detailedの呼び出し回数を減らすために修正したらしいです
"  return normalize(n);" +
"}" +
// 海面の高さを見つけ出すメソッド。ラフの方を使う。
// 海面上の地点をあらわすベクトルpを返すように修正しちゃう。
"vec3 heightMapTracing(vec3 ori, vec3 dir){" +
"  vec3 p;" + // vec3(0.0)で初期化される
// tmとtxはoriからdirに従ってどれだけ伸ばしたら海面に達するかという、その小さい方と大きい方の初期値
// で、徐々に範囲を狭めていくわけ。
"  float tm = 0.0;" +
"  float tx = 500.0;" +
// 最初の一手でぎゅーんして、海面より上に達するならそれはもう空ということなので0.0を返す。
"  float hx = map_rough(ori + dir * tx);" +
"  if(hx > 0.0){ return p; }" +
// hx < 0の場合は-hxを取ってこれで割合にしていろいろやる
// 初期値はoriの場所の海面からの高さ
"  float hm = map_rough(ori + dir * tm);" +
"  float tmid = 0.0;" +
"  for(int i = 0; i < NUM_STEPS; i++){" +
// 難しいことやってない。下限のtmと上限のtxの間にあるhmと-hxの比に対応するポイントを探し当ててるだけ。
"    tmid = mix(tm, tx, hm / (hm + (-hx)));" +
"    p = ori + dir * tmid;" +
"    float hmid = map_rough(p);" + // 当たりをつけたうえで改めて海面との変位を取る。
// そして正ならhxの方は変えないでhmの方を更新する。tx, tmも同様。
// 負ならhmの方は変えないでhxを更新する感じ
"    if(hmid >= 0.0){" +
"      tm = tmid; hm = hmid;" +
"    }else{" +
"      tx = tmid; hx = hmid;" +
"    }" +
"  }" +
"  return p;" +
"}" +
// ようやくメインコード
"void main(void){" +
"  vec2 st = (gl_FragCoord.xy - u_resolution.xy) / min(u_resolution.x, u_resolution.y);" +
"  float time = u_time * 2.7;" + // 実際に使うtime.
// roll（横揺れ）、pitch（縦揺れ）、yaw（視線方向）を作る
"  float phase = time * pi * 0.5;" +
"  float roll = (sin(phase) + cos(phase * 0.5)) / 14.0;" +
"  float pitch = pi * 0.02 + (sin(phase * 0.5) + cos(phase)) / 40.0 + (u_mouse.y / u_resolution.y - 0.8) * pi / 3.0;" +
"  float yaw = u_mouse.x / u_resolution.x * pi * 4.0;" +
// oriはカメラ位置、dirはピクセルに向かうベクトルの正規化（デフォは目の前1.6の所に-1.0～1.0）
"  vec3 ori = vec3(0.0, 3.5, time * 3.0);" +
"  vec3 dir = normalize(vec3(st.xy, -1.6));" +
// これを適用すると魚眼レンズ効果が発生して視界が丸くなる（元ネタで使ってるやつ）
"  dir.z += length(st) * 0.15;" +
// 変換行列で視界をいじってdirに補正を掛ける
"  dir = fromEuler(roll, pitch, yaw) * normalize(dir);" +
// oriからdir方向にレイをぎゅんっと飛ばした先の海面上の地点のベクトルを取得する（グローバルの）
"  vec3 p = heightMapTracing(ori, dir);" +
"  vec3 dist = p - ori;" +
// 法線ベクトルをpにおいて取るんだけど、その際の微小数が海面からの距離に左右されるように調節してるみたい。
// 海面が遠い時は解像度を意図的に下げている。
"  vec3 n = getNormal(p, dot(dist, dist) * 0.5 / u_resolution.x);" +
// 平行光の逆ベクトル。yz平面にに平行で前方下方くらい。
"  vec3 light = normalize(vec3(0.0, 1.0, 0.8));" +
// 海の色と空の色
"  vec3 skyColor = getSkyColor(dir);" +
"  vec3 seaColor = getSeaColor(p, n, light, dir, dist);" +
// このあといろいろやってるけどとりあえず無視する（オリジナルではやってない処理なので）
"  vec3 color = mix(skyColor, seaColor, pow(smoothstep(0.0, 0.05, -dir.y), 0.3));" +
"  gl_FragColor = vec4(color, 1.0);" +
"}";

function setup(){
  createCanvas(640, 360, WEBGL);
	frameRate(30);
  myShader = createShader(vs, fs);
  shader(myShader);
}

function draw(){
  myShader.setUniform("u_resolution", [width, height]);
  myShader.setUniform("u_mouse", [constrain(mouseX, 0, width), height - constrain(mouseY, 0, height)]);
  myShader.setUniform("u_time", millis() / 1000);
  quad(-1, -1, -1, 1, 1, 1, 1, -1);
}
/*
// 気を取り直してocean2の写経
// というかSailingっていうらしいけどねこれ

// イメージとしてはx軸が水平右方向、y軸がそれに垂直に上方向、z軸が手前に向かう方向って感じ。
// rollはxy平面内で反時計回りに回転、pitchはそのあとでyz平面内でyをzに移すように回転、yawは最後に円錐の周を描くように
// xz平面内でその頂点がxをzに移すように回転する感じね。
// カメラはz軸正方向にぎゅーん。だから遠ざかっていくイメージなんかな・・
// 色が描画されるのはz軸負の方向に1.6だけ離れたところにある、640x360を上下幅を-1.0～1.0とした感じのスクリーン。
// これが回転行列でぐるぐるされて、されたうえで、目線がとんで、空の色や海の色が貼り付けられるようですね。

// グラディエントノイズにしたら見た目が劇的に変わった
// 劇的過ぎて困惑してる
// やべぇぇぇぇぇぇぇぇ

*/
