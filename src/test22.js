// 今後
// test22:複数個数でピッキング（ピックしたものの色を灰色からカラフルにする）
// test23:depthをレンダーテクスチャにして色を取り出し通常のテクスチャに落とす場合と比較
// test24:例のライティングプログラムを改造してディファード化してみる。とりあえずテストコード
// test25:例のbox4000をディファード色付けて
// test26:考え中。影の実験でもするか。あるいは息抜きにトゥーンレンダリングかステンシルアウトライン
// test27:ヘルパーの実験したいわね。さしあたり座標軸とカメラ。ていうかカメラの複数画面ってまだやってないぞ....
// lil.guiもってなるとまた番号ずらす...いや、もう宿題を片付けてしまおう。

// 例のあれ、チューブで書き直すなら自分なりに別のもの作るわ。

// というわけでここではピッキングの練習をします。OK.

// 立方体を100個くらい回して（vertexShaderで）、マウスでクリックで止めたり動かしたりする。

// 動的更新使う。フラグだけね。0～1を100個用意。indexも0,1,...,99で。

const ex = p5wgex;
let _node;
let _cam;
let _tf = new ex.TransformEx();
let _timer = new ex.Timer();


function setup(){
  createCanvas(800, 640, WEBGL);
  _node = new ex.RenderNode(this._renderer.GL);
  // デフォでいいよ。
  _cam = new ex.CameraEx({
    w:800, h:640, top:[0, 0, 1], eye:[8, 0, 2]
  });

  // cubeのメッシュを100個複製（スケールは1～4でランダム）（位置は-3～3でランダム）
  const cubePositions = [-1,-1,1,  1,-1,1,  1,1,1,  -1,1,1, -1,-1,-1, 1,-1,-1, 1,1,-1, -1,1,-1];
  const cubeFaces = [0,1,2,  0,2,3,  1,5,6,  1,6,2,  5,4,7,  5,7,6,  4,0,3,  4,3,7,  3,2,6,  3,6,7,  4,5,1,  4,1,0];
  const cubeNormals = ex.getNormals(cubePositions, cubeFaces);
  let cubeV = [];
  let cubeN = [];
  let cubeF = [];
  for(let i=0; i<100; i++){
    const x = Math.random()*6-3;
    const y = Math.random()*6-3;
    const z = Math.random()*6-3;
    const s = 1+Math.random()*3;
    for(let k=0; k<8; k++){
      const x1 = cubePositions[k*3];
      const y1 = cubePositions[k*3+1];
      const z1 = cubePositions[k*3+2];
      cubeV.push(...[s*x1 + x, s*y1 + y, s*z1 + z]);
    }
    cubeN.push(...cubeNormals);
    for(let k=0; k<36; k++){
      cubeF.push(cubeFaces[8*i + k]);
    }
    // みたいな。
  }


}

function draw(){

}
