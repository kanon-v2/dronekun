//------------------------------------------------------------------------------
//  描画実行
//------------------------------------------------------------------------------
//page.numberの番号順
//0:スタート 1:戦闘 2:強化 3:ゲームオーバー 4:ストーリー 5:エンディング 6:協力プレイ・対戦の部屋選び 7:対戦
var screens = [startScreen, mainScreen, upgradeScreen, gameoverScreen, storyScreen, endingScreen, coopScreen, versusScreen];

//画面の更新間隔(60Hz/144Hzなど)に関わらず同じ速さで動くよう、1/60秒刻みで更新する
const STEP = 1000/60;
var lastTime = 0;
var acc = 0;

//フレームレート(1秒あたりの描画回数)。1秒ごとに数え直して、画面の上の中央に小さく出す
const FPS_WARN = 50;    //これを下回るとオレンジ
const FPS_BAD  = 30;    //これを下回ると赤
var fps = {
    count:0,
    low:0,          //フレームレートが低い秒が続いている数
    last:0,
    value:0,
    tick:function(_now){
        this.count++;
        if(this.last == 0) this.last = _now;
        if(_now - this.last >= 1000){
            //タブを裏に回していた間などは数えない(描いていないだけで、重いわけではない)
            var gap = _now - this.last > 2000;
            this.value = Math.round(this.count*1000/(_now - this.last));
            this.count = 0;
            this.last = _now;
            //細かく描きすぎて重いときは、細かさを1段下げる(common.js の fitCanvas)
            if(!gap && this.value < RENDER_FPS_LOW && renderScale > 1){
                if(++this.low >= RENDER_DROP_SEC){ this.low = 0; lowerRender(); }
            }else this.low = 0;
        }
    },
    draw:function(){
        if(this.value == 0) return;   //最初の1秒は数えている途中
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = this.value < FPS_BAD ? "#d22" : (this.value < FPS_WARN ? "#e08000" : "#999");
        //細かく描いているときは倍率も出す(重くて下げたときにわかるように)
        ctx.fillText("FPS " + this.value + (renderScale > 1 ? "  ×" + renderScale : ""), CW/2, 8);
        ctx.fillStyle = "#000";
    }
};

function draw(now){
    fps.tick(now);
    if(lastTime == 0) lastTime = now;
    acc += Math.min(now - lastTime, 100);
    lastTime = now;
    while(acc >= STEP){
        //右下のBGM/SEボタンを押したクリックはゲームに渡さない
        if(Click == 1 && sound.handleClick()) Click = 0;
        //協力プレイ：相方の状態を読んで進行を合わせる
        coop.update();
        screens[page.number].update();
        coop.send();
        Click = 0;
        time++;
        if(time >= MAXTIME){time=0;}
        acc -= STEP;
    }

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, CW, CH);
    screens[page.number].draw();
    sound.draw();
    fps.draw();

    //ポインタは一番手前
    pointer.calcXY();
    pointer.draw();

    if(DEBUG) test.mousePositionDisplay();
    window.requestAnimationFrame(draw);
}

page.change(0);
window.requestAnimationFrame(draw);
