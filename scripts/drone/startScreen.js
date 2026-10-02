//------------------------------------------------------------------------------
//  フォースマップ
//------------------------------------------------------------------------------
// パーティクルクラス
// 位置(x, y)と加速度(vx, vy)を持つ
class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
    }
  
    // 毎フレームパーティクルを動かす
    // フォースマップにしたがった加速度を得る
    update(forcemap) {
      const force = forcemap.getForce(this.x, this.y);
      this.vx += force.x/100;
      this.vy += force.y/100;
      this.x += this.vx/10;
      this.y += this.vy/10;
    }
  
    // 点を描画
    render(context) {
      context.strokeStyle = '#777';
      context.strokeRect(this.x, this.y, 5, 5);
    }
  }

class Forcemap {
    constructor(width, height, meshWidth, meshHeight) {
      this._width = width;
      this._height = height;
      this._meshWidth = meshWidth;
      this._meshHeight = meshHeight;
  
      // x,yともに-0.5から0.5までの範囲で力場を作る
      this._map = (new Array(width * height))
                      .fill(null)
                      .map((f) => ({ x: -Math.random() + 0.5, y: -Math.random() + 0.5}));
    }
  
    // x,yで指定された場所の力を取得する
    getForce(x, y) {
      const force = this._map[this._width * Math.floor(y/this._meshHeight) + Math.floor(x/this._meshWidth)];
      return force || { x: 0, y: 0 };
    }
  
    // 描画する
    render(context) {
      const width = this._width * this._meshWidth;
      const height = this._height * this._meshHeight;
      
      context.strokeStyle = 'rgb(210, 210, 210)';
  
      // 各マス目について
      for(let x = 0; x < width; x += this._meshWidth) {
        for(let y = 0; y < height; y+= this._meshHeight) {
          const center = { x: x + this._meshWidth/2, y: y + this._meshHeight/2 }; // マス目の中心
          const meshForce = this.getForce(Math.floor(x), Math.floor(y)); // マス目のベクトル
          const forceSize = Math.sqrt((meshForce.x ** 2) + (meshForce.y ** 2)); // ベクトルの大きさ
          const drawRadius = forceSize * Math.min(this._meshWidth, this._meshHeight); // 描画サイズ
          const radian = Math.atan2(meshForce.y, meshForce.x); // 力の角度
  
          // 矢印を描く
          context.beginPath();
          context.moveTo(center.x - drawRadius * Math.cos(radian), center.y - drawRadius * Math.sin(radian));
          context.lineTo(center.x + drawRadius * Math.cos(radian), center.y + drawRadius * Math.sin(radian));
          context.lineTo(center.x + drawRadius * Math.cos(radian + Math.PI/2), center.y + drawRadius * Math.sin(radian + Math.PI/2));
          context.lineTo(center.x + drawRadius * Math.cos(radian - Math.PI/2), center.y + drawRadius * Math.sin(radian - Math.PI/2));
          context.lineTo(center.x + drawRadius * Math.cos(radian), center.y + drawRadius * Math.sin(radian));
          context.stroke();
  
          context.strokeRect(x, y, this._meshWidth, this._meshHeight);
        }
      }
    }
  }

const meshNum = 20;
const meshSize = Math.floor(canvas.width / meshNum);

const forcemap = new Forcemap(meshNum, meshNum, meshSize, meshSize);

const particles = (new Array(50))
    .fill(null)
    .map((n) => new Particle(Math.random()*canvas.width, Math.random()*canvas.height));



//------------------------------------------------------------------------------
//  はじめから、つづきからボタン
//------------------------------------------------------------------------------
var startButton = new drawRect(canvas.width/2,GS*6.6,GS*14,GS*2.3);
var continueButton = new drawRect(canvas.width/2,GS*9.1,GS*14,GS*2.3);
var coopButton = new drawRect(canvas.width/2 - GS*3.55,GS*11.6,GS*6.9,GS*2.3);
var versusButton = new drawRect(canvas.width/2 + GS*3.55,GS*11.6,GS*6.9,GS*2.3);

//------------------------------------------------------------------------------
//  スタート画面処理
//------------------------------------------------------------------------------
var startScreen = {
    hasSave:false,
    best:0,
    enter:function(){
        this.hasSave = save.exists();
        this.best = save.getBest();
        try{ this.cleared = localStorage.getItem("dronekun_cleared") == "1"; }catch(e){ this.cleared = false; }
        drone.resetStats();
    },
    update:function(){
        //デバッグのボス戦メニューを出している間は、タイトルのボタンを押せない(bossDebug.js)
        if(bossDebug.menu){
            bossDebug.updateMenu();
            return;
        }
        //はじめから：セーブを消してWAVE1へ
        if(startButton.clicked()){
            sound.play("click");
            save.clear();
            game.reset();
            //プロローグを見てからWAVE1へ
            storyScreen.start("prologue",function(){ page.change(1); });
            return;
        }
        //つづきから：セーブを読み込んで強化画面へ(見ていないストーリーがあれば先に)
        if(continueButton.clicked() && this.hasSave && save.load()){
            sound.play("click");
            goUpgrade();
            return;
        }
        //ふたりで協力プレイ：部屋選びへ(coop.js)
        if(coopButton.clicked()){
            sound.play("click");
            this.notice = "";
            if(!coop.inRoom) coop.mode = "coop";
            page.change(6);
            return;
        }
        //ふたりで対戦：同じ部屋選びの画面を対戦用に使う(versus.js)
        if(versusButton.clicked()){
            sound.play("click");
            this.notice = "";
            if(!coop.inRoom) coop.mode = "vs";
            page.change(6);
            return;
        }

        //ドローン
        drone.update();

        // パーティクルの更新
        for(const p of particles) {
            // フォースマップを与えてアップデート
            p.update(forcemap);

            // 外にはみ出したら適当に中に戻してやる
            if(p.x < 0 || p.x > canvas.width) {
            //p.x = Math.random() * canvas.width;
            p.vx = -p.vx/10;
            }

            if(p.y < 0 || p.y > canvas.height) {
            //p.y = Math.random() * canvas.height;
            p.vy = -p.vy/10;
            }
        }
    },
    draw:function(){
        // フォースマップの描画
        forcemap.render(ctx);
        // パーティクルを描画
        for(const p of particles) p.render(ctx);

        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.font = "bold 60px serif";
        ctx.fillStyle = "#000"

        //ゲームタイトル
        ctx.fillText( "ドローン君(仮)", canvas.width/2 , GS*4 );

        ctx.font = "bold 28px serif";
        startButton.button("はじめから");
        continueButton.button(this.hasSave ? "つづきから" : "つづきから（データなし）", this.hasSave);
        ctx.font = "bold 22px serif";
        coopButton.button("ふたりで協力プレイ");
        versusButton.button("ふたりで対戦");
        //協力プレイから戻ったときのお知らせ
        if(this.notice){
            ctx.font = "bold 14px sans-serif";
            ctx.fillStyle = "#c33";
            ctx.fillText(this.notice, canvas.width/2, GS*14.25);
            ctx.fillStyle = "#000";
        }

        //遊び方
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#333";
        if(inputMode == "touch"){
            ctx.fillText("ドラッグでドローン君を誘導　／　敵には自動で攻撃　／　右下のボタンで衝撃波", canvas.width/2, GS*15.8);
        }else{
            ctx.fillText("マウスでドローン君を誘導　／　敵には自動で攻撃　／　クリックで衝撃波（燃料を消費）", canvas.width/2, GS*15.8);
        }
        ctx.fillText("WAVEクリアで装備を獲得。相性の良い装備を組み合わせるとシナジーが発動！", canvas.width/2, GS*16.8);
        if(this.best > 0){
            ctx.fillText((this.cleared ? "★全" + FINAL_WAVE + "WAVEクリア済み　" : "") + "ハイスコア " + this.best, canvas.width/2, GS*14.8);
        }
        ctx.fillStyle = "#000";

        //ドローン表示
        drone.draw();
        if(bossDebug.menu) bossDebug.drawMenu();
    }
};