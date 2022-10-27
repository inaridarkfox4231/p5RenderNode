// タイマーのテストコード。今回は_nodeはおやすみ。

const ex = p5wgex; // エイリアスを取得
let _timer = new ex.Timer();

let count3 = 0;
let count4 = 0;
let count5 = 0;

function setup(){
	createCanvas(400, 400);
	_timer.initialize("slot0");
	_timer.initialize("slot1", {scale:2000});
	_timer.initialize("slot2", {scale:4000});
	_timer.initialize("slot3", {duration:500});
	_timer.initialize("slot4", {duration:1500});
	_timer.initialize("slot5", {duration:800});
	_timer.initialize("slot6");
  _timer.initialize("slot7", {duration:5000}); // これを止めてみる。
	noStroke();
	colorMode(HSB,100);
	textAlign(LEFT, TOP);
	textSize(18);
}

function draw(){
	background(0);

	const elapsed0 = _timer.getDelta("slot0"); // セットしたタイミングからの秒数
	fill(0,100,100);
	rect(5, 5, fract(elapsed0) * 390, 20);

	const elapsed1 = _timer.getDelta("slot1"); // 2000で割るのでスケールが2秒
	fill(10,100,100);
	rect(5, 30, fract(elapsed1) * 390, 20);

	const elapsed2 = _timer.getDelta("slot2"); // 4000で割るのでスケールが4秒
	fill(20,100,100);
	rect(5, 55, fract(elapsed2) * 390, 20);

	if(_timer.check("slot3")){ count3++; } // 0.5秒ごとにtrueを返すので0.5秒ごとに数が増えていく
	fill(30, 80, 100);
	text("count3: " + count3, 5, 80);

	if(_timer.check("slot4")){ count4++; } // 1.5秒ごとに数が増えていく
	fill(40, 80, 100);
	text("count4: " + count4, 5, 105);

	// 次の発火タイミングまでのdurationは任意に指定できる
	if(_timer.check("slot5", 400+400*Math.random())){ count5++; }
	fill(50, 80, 100);
	text("count5: " + count5, 5, 130);
	// 次のdurationまでのProgressも容易に取得できる
	rect(5, 155, _timer.getProgress("slot5")*390, 20);

	// discreteを使うとそのミリ秒の何倍経過したかの整数を取得できる
	// たとえばこの場合0.5秒ごとに増えていく感じ、まあ要するにグローバルで数を用意して
	// それを増やさなくてもいいということ。
  fill(60, 60, 100);
	text("count6_1:" + _timer.getDeltaDiscrete("slot6", 500), 5, 180);

	// 第三引数はmoduloになっていてこれで割った余りを取得できる。
	fill(70, 50, 100);
	text("count6_2: " + _timer.getDeltaDiscrete("slot6", 500, 7), 5, 205);

	// ちなみに生の経過ミリ秒はgetDeltaMillis()で取得できる。これはscaleを1にするのと同じ。
	// scaleはデフォルトが1000となっている。これは秒数として使うケースが多いからである。

  // pauseを実装したので試してみる。
  fill(80, 90, 100);
  _timer.check("slot7"); // 特に何もしない場合はこれでリセットされる
  rect(5, 250, _timer.getProgress("slot7")*390, 20);
}

function mousePressed(){
  _timer.pause("slot7");
}

function mouseReleased(){
  _timer.reStart("slot7");
}
