//------------------------------------------------------------------------------
//  傀儡師戦の舞台(puppeteer.js のボスの試作に合わせて、戦いの画風と質感をそろえる)
//  傀儡師のWAVEの間だけ、戦闘画面を「人形劇の舞台」にする：
//  ・背景：Blender で描いた舞台(tools/blender/puppetStage.py。奥の書き割りと町の切り抜き stage.jpg、手前の緞帳と脚光 frame.png)。
//    方眼と街の空の代わりに描く。奥はドローン君の動きと逆へ少しずらす(奥行き)
//  ・照明：ドローン君と傀儡師をそれぞれ追うスポットライト(上から光の筋と、足もとの光だまり)・漂うほこり
//  ・色調：表示(HUD)の手前で、画面のふちを暗くし、全体を舞台の明かりの色に寄せる
//  ・ドローン君：Blender で描いた、使い込まれたブリキのからくり人形のような見た目(images/game/Drone/drone_P.png)に替える。
//    操られている同胞(人形)も同じシートで描くので一緒にそろう。舞台を出ると元の見た目に戻す
//  絵が読み込めないとき・#pup2d のときは、いつもの背景と見た目のまま。
//------------------------------------------------------------------------------
const STAGE_OVER      = 1.06;       //奥の絵の大きさ(画面の何倍。tools/blender/puppetStage.py の STAGE_OVER と同じ)
const STAGE_PARALLAX  = 0.04;       //ドローン君が動いた分の何倍、奥の絵を逆へずらすか
const STAGE_SKIN      = "P";        //舞台の間のドローン君の見た目(images/game/Drone/drone_P.png)
const STAGE_SPOT_R    = 95;         //スポットライトの光だまりの半径(px)
const STAGE_SPOT_A    = [0.30,0.10];    //光だまりの濃さ(ドローン君・傀儡師。ドローン君は暗い舞台でも見失わないよう強く)
const STAGE_BEAM_A    = [0.07,0.05];    //上から差す光の筋の濃さ
const STAGE_SPOT_COL  = ["255,214,150","200,150,255"];  //スポットライトの色(ドローン君は暖かい白・傀儡師は紫)
const STAGE_SPOT_SRC  = [[300,-80],[700,-80]];          //光の出どころ(画面の上の外)
const STAGE_SPOT_LAG  = 0.08;       //スポットライトが追いつく速さ(毎フレームの割合。少し遅れて追う)
const STAGE_DUST      = 46;         //漂うほこりの数
const STAGE_VIGNETTE  = 0.42;       //画面の四すみの暗さ
const STAGE_TONE      = "rgba(70,40,20,0.10)";  //全体に重ねる舞台の明かりの色(multiply)

var puppetStage = {
    imgs:null, left:0,
    spots:[{ x:CW/2, y:CH*0.7 },{ x:CW/2, y:120 }],
    skinBefore:null,        //舞台に入る前のドローン君の見た目(戻すため)
    //今が傀儡師の舞台か(戦闘画面で、傀儡師のボスWAVE)
    on:function(){
        if(/pup2d/.test(location.hash) || versus.active || coop.active) return false;
        return page.number == 1 && isBossWave(game.wave) && bossTypeFor(game.wave) == "puppeteer";
    },
    //絵を読み込む(はじめて使うとき)。そろったら true
    ready:function(){
        if(!this.imgs){
            var self = this, names = { stage:"stage.jpg", frame:"frame.png" };
            this.imgs = {}; this.left = 2;
            for(var k in names){
                var im = new Image();
                im.onload = function(){ self.left--; };
                im.onerror = function(){ self.left = -1; };
                im.src = "images/game/puppeteer/" + names[k];
                this.imgs[k] = im;
            }
        }
        return this.left == 0;
    },
    //舞台に入る・出るときに、ドローン君の見た目を替える
    sync:function(){
        var on = this.on();
        if(on && this.skinBefore == null){
            this.skinBefore = droneSkin.current;
            droneSkin.use(STAGE_SKIN);      //絵が見つからなければ droneSkin が標準に戻す
        }else if(!on && this.skinBefore != null){
            droneSkin.use(this.skinBefore);
            this.skinBefore = null;
        }
    },

    //------------------------------------------------------------------ 描く
    //背景(battleBg.draw の代わり)：奥の舞台・スポットライト・ほこり・手前の緞帳
    drawBg:function(){
        var t = battleBg.t, I = this.imgs;
        var w = CW*STAGE_OVER, h = CH*STAGE_OVER;
        var ox = (CW - w)/2 - (drone.X - CW/2)*STAGE_PARALLAX;
        var oy = (CH - h)/2 - (drone.Y - CH/2)*STAGE_PARALLAX*0.5;
        ctx.drawImage(I.stage, ox, oy, w, h);
        this.drawSpots(t);
        this.drawDust(t);
        ctx.drawImage(I.frame, 0, 0, CW, CH);
    },
    //スポットライト：上の外から光の筋が差し、追う相手の足もとに光だまり。ゆっくりまたたく(古い灯り)
    drawSpots:function(t){
        var b = puppeteer.alive();
        var tg = [{ x:drone.X, y:drone.Y }, b ? { x:b.x, y:b.y + 30 } : null];
        ctx.globalCompositeOperation = "lighter";
        for(var k=0; k<2; k++){
            var S = this.spots[k];
            if(!tg[k]) continue;
            S.x += (tg[k].x - S.x)*STAGE_SPOT_LAG;
            S.y += (tg[k].y - S.y)*STAGE_SPOT_LAG;
            var fl = 0.9 + 0.1*Math.sin(t*0.23 + k*2) * Math.sin(t*0.051 + k);     //またたき
            var src = STAGE_SPOT_SRC[k], col = STAGE_SPOT_COL[k], R = STAGE_SPOT_R*(k ? 1.3 : 1);
            //光の筋：出どころから光だまりの左右のふちへ広がる三角
            var dx = S.x - src[0], dy = S.y - src[1], L = Math.hypot(dx, dy) || 1, nx = -dy/L, ny = dx/L;
            var lg = ctx.createLinearGradient(src[0], src[1], S.x, S.y);
            lg.addColorStop(0, "rgba(" + col + ",0)");
            lg.addColorStop(1, "rgba(" + col + "," + (STAGE_BEAM_A[k]*fl) + ")");
            ctx.fillStyle = lg;
            ctx.beginPath();
            ctx.moveTo(src[0] - nx*8, src[1] - ny*8); ctx.lineTo(src[0] + nx*8, src[1] + ny*8);
            ctx.lineTo(S.x + nx*R*0.8, S.y + ny*R*0.8); ctx.lineTo(S.x - nx*R*0.8, S.y - ny*R*0.8);
            ctx.closePath(); ctx.fill();
            //光だまり
            var rg = ctx.createRadialGradient(S.x, S.y, 0, S.x, S.y, R);
            rg.addColorStop(0, "rgba(" + col + "," + (STAGE_SPOT_A[k]*fl) + ")");
            rg.addColorStop(0.7, "rgba(" + col + "," + (STAGE_SPOT_A[k]*fl*0.5) + ")");
            rg.addColorStop(1, "rgba(" + col + ",0)");
            ctx.fillStyle = rg;
            ctx.fillRect(S.x - R, S.y - R, R*2, R*2);
        }
        ctx.globalCompositeOperation = "source-over";
    },
    //漂うほこり：位置は時間だけで決める(乱数を使わない)。スポットライトの中ほど明るい
    drawDust:function(t){
        for(var i=0; i<STAGE_DUST; i++){
            var a = storyScreen.hash(i, 3), c = storyScreen.hash(i, 7);
            var x = (a*CW + t*(0.15 + c*0.25) + Math.sin(t*0.01 + i)*20) % CW;
            var y = (c*CH - t*(0.05 + a*0.1) % CH + CH) % CH;
            var lit = 0;
            for(var k=0; k<2; k++){
                var S = this.spots[k], d = Math.hypot(x - S.x, y - S.y);
                lit = Math.max(lit, 1 - d/(STAGE_SPOT_R*1.6));
            }
            var al = 0.12 + 0.5*Math.max(0, lit);
            ctx.fillStyle = "rgba(255,235,200," + (al*(0.5 + 0.5*Math.sin(t*0.05 + i))) + ")";
            ctx.fillRect(x, y, 1.6, 1.6);
        }
    },
    //色調：表示(HUD)の手前で、全体を舞台の明かりの色に寄せ、四すみを暗くする
    drawTone:function(){
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = STAGE_TONE;
        ctx.fillRect(0, 0, CW, CH);
        ctx.globalCompositeOperation = "source-over";
        var g = ctx.createRadialGradient(CW/2, CH*0.55, CH*0.35, CW/2, CH*0.55, CW*0.62);
        g.addColorStop(0, "rgba(10,4,8,0)");
        g.addColorStop(1, "rgba(10,4,8," + STAGE_VIGNETTE + ")");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CW, CH);
        //表示が暗い幕の上でも読めるよう、左上・右上・ボスの体力の下に古い紙の札を敷く
        this.plate(4, 4, 236, 90);
        this.plate(CW - 324, 4, 320, 88);
        this.plate(CW/2 - 170, 38, 340, 40);
    },
    //古い紙の札(黄ばんだ紙に、金の細いふち)
    plate:function(_x,_y,_w,_h){
        var g = ctx.createLinearGradient(0, _y, 0, _y + _h);
        g.addColorStop(0, "rgba(246,236,214,0.86)");
        g.addColorStop(1, "rgba(226,208,176,0.86)");
        ctx.fillStyle = g;
        enemyArt.roundRect(_x, _y, _w, _h, 6); ctx.fill();
        ctx.strokeStyle = "rgba(150,110,40,0.8)"; ctx.lineWidth = 1.5;
        enemyArt.roundRect(_x + 2.5, _y + 2.5, _w - 5, _h - 5, 4); ctx.stroke();
        ctx.lineWidth = 1;
    }
};

//------------------------------------------------------------------------------
//  ほかのファイルの処理を包んで、舞台を足す
//------------------------------------------------------------------------------
(function(){
    var bg0 = battleBg.draw;
    battleBg.draw = function(){
        if(puppetStage.on() && puppetStage.ready()){
            //時間は battleBg と同じに進める(波・光るマスは出さない)
            var now = performance.now();
            var dt = this.last ? Math.min(3, (now - this.last)/STEP) : 1;
            this.last = now; this.t += dt;
            this.step(dt);
            puppetStage.drawBg();
            return;
        }
        return bg0.apply(this, arguments);
    };
    var hud0 = mainScreen.drawHud;
    mainScreen.drawHud = function(){
        if(puppetStage.on() && puppetStage.ready()) puppetStage.drawTone();
        return hud0.apply(this, arguments);
    };
    var enter0 = mainScreen.enter;
    mainScreen.enter = function(){
        var r = enter0.apply(this, arguments);
        puppetStage.sync();
        return r;
    };
    var change0 = page.change;
    page.change = function(i){
        var r = change0.apply(this, arguments);
        puppetStage.sync();
        return r;
    };
})();
