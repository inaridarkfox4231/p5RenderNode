// めっちゃ簡単な使い方としては...
// https://qiita.com/cheez921/items/41b744e4e002b966391a Promise簡単に

const wait = (milliSecond) => new Promise((resolve) => setTimeout(resolve, milliSecond));

// Promiseの引数は関数で、一つだけ引数の場合それはresolve扱い。

// onloadの中でフラグを発火させた方がいいんじゃない、ああいうの書くのなら。
// こっちはもっとその...複雑なことしたいってなった時に考えないと多分頭に入らないよね。

let completeFlag = false;
let progress = 0;
let gr;

// これが終了したらグローバルに指示したうえでflagを立てればいい。
async function prepareCircles(){
  for(let k=0; k<10000; k++){
    gr.circle(Math.random()*400, Math.random()*400, 20);
    if(k%100==0){ await wait(60); }
    progress = k/10000;
  }
  completeFlag = true;
}

function setup(){
  createCanvas(400, 400);

  gr = createGraphics(400, 400);
  gr.background(0);
  gr.blendMode(ADD);
  gr.noStroke();
  gr.fill(4,8,16);
  prepareCircles();
  textAlign(CENTER, CENTER);
  textSize(16);
  noStroke();
  rectMode(CENTER);
}

function draw(){
  if(!completeFlag){
    const n = Math.floor(performance.now()/240);
    let dots = "   ";
    if(n%4==1){dots = ".  "}
    if(n%4==2){dots = ".. "}
		if(n%4==3){dots = "..."}
    background(64,96,128);
    fill(255);
    text("now loading" + dots, 200, 200);
    fill(0);
    rect(200, 240, 200, 20);
    fill(255);
    rect(100 + progress*100, 240, progress*200, 20);
    return;
  }
  clear();
  image(gr, 0, 0);
}

/*
// rejectは今回使わないため、引数から削除
const promise = new Promise((resolve) => {
  resolve();
}).then(() => {
  console.log("resolveしたよ");
});

const promise2 = new Promise((resolve) => {
  // 引数に文字列を渡す
  resolve("resolveしたよ");
}).then((val) => {
  // 第一引数にて、resolve関数で渡した文字列を受け取ることができる
  console.log(val);
});
*/
