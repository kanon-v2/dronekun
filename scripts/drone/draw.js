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

function draw(now){
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
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    screens[page.number].draw();
    sound.draw();

    //ポインタは一番手前
    pointer.calcXY();
    pointer.draw();

    if(DEBUG) test.mousePositionDisplay();
    window.requestAnimationFrame(draw);
}

page.change(0);
window.requestAnimationFrame(draw);
