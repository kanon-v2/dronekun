//------------------------------------------------------------------------------
//  回避ダッシュ(右クリック)
//  右クリックで、ポインタの方へ一気に飛ぶ。飛んでいる間と、着いたあと少しの間は当たらない(点滅しない無敵)。
//  飛んでいる間に弾・レーザー・体当たりがドローン君の芯に重なったら「ジャスト回避」：
//  一瞬止まって(ヒットストップ)、すり抜けた場所の残像が砕け、周りが少しゆっくりになり、やる気がたまって、すぐまた飛べる。
//  ・飛んでいる間、体は進む向きへくるっと1回転する(DODGE_SPIN)。残像も回る途中の角度で残る
//  ・飛ぶ距離はポインタまでの距離(DODGE_DIST_MIN～MAX)。ポインタがすぐそばなら、動いていた向きへ飛ぶ
//  ・mainScreen.update から update()、drone.calcXY から steer()、mainScreen.canBeHit から evade() を呼ぶ
//  ・協力プレイ・対戦では使わない(敵と弾を動かす画面とずれるため)。タッチ操作にはまだない
//------------------------------------------------------------------------------
const DODGE_TIME      = 11;     //飛んでいる時間(フレーム)
const DODGE_DIST_MIN  = 90;     //飛ぶ距離のいちばん短いもの(px)
const DODGE_DIST_MAX  = 180;    //飛ぶ距離のいちばん長いもの(px)
const DODGE_NEAR      = 24;     //ポインタがこれより近いときは、動いていた向きへ飛ぶ(px)
const DODGE_GUARD     = 6;      //着いたあとも当たらない時間(フレーム)
const DODGE_CD        = 42;     //次に飛べるまで(フレーム。飛び始めから数える)
const DODGE_GHOSTS    = 14;     //残像が消えるまで(フレーム)
const DODGE_STRETCH   = 0.18;   //飛んでいる間、進む向きに伸びる割合
const DODGE_SPIN      = 1;      //飛んでいる間に体が回る回数(進む向きへ転がるように)
const DODGE_ARC       = 18;     //回るのに合わせて、道すじが横へふくらむ大きさ(px。転がる側へ弧を描く)
const DODGE_COLOR     = "90,220,255";   //光の色(ジャスト衝撃波と同じ水色)
const DODGE_GHOST_TINT = "60,200,255";  //残像の色
const DODGE_JUST_STOP = 5;      //ジャスト回避の瞬間に止まる時間(フレーム)
const DODGE_SLOW_TIME = 80;     //ジャスト回避のあと、周りがゆっくりになる時間(フレーム。ドローン君と装備はふつうの速さのまま)
const DODGE_SLOW_RATE = 0.2;    //いちばんゆっくりのときの、敵と弾の速さ(1で元どおり)
const DODGE_SLOW_HOLD = 0.4;    //ゆっくりの時間のうち、いちばんゆっくりのまま保つ割合(残りでだんだん元の速さへ)
const DODGE_SLOW_ZOOM = 0.04;   //ゆっくりの間、ドローン君へ寄る大きさ
const DODGE_JUST_GUARD = 30;    //ジャスト回避のあとの無敵(フレーム)
const DODGE_JUST_YARUKI = 20;   //ジャスト回避でたまるやる気
const DODGE_JUST_TEXT = 70;     //「ジャスト回避」の文字を出す時間(フレーム)

var dodge = {
    req:false,      //右クリックされた(次の更新で飛ぶ)
    t:0,            //飛び始めてからのフレーム数(飛んでいないときは -1)
    from:null,      //飛び始めた場所
    dx:0, dy:0,     //飛ぶ向き(長さ1)
    dist:0,         //飛ぶ距離
    cd:0,           //次に飛べるまでの残り
    guard:0,        //着いたあとの無敵の残り
    justDone:false, //この回避でジャストになったか(1回の回避で1度だけ)
    justT:0,        //「ジャスト回避」の文字の残り
    ghosts:[],      //残像 { x,y,life }
    lastX:0, lastY:-1,  //最後に動いていた向き(ポインタがそばのとき使う)
    readyT:0,       //また飛べるようになった合図の光の残り
    count:0,        //このWAVEで飛んだ回数(テスト用)
    justCount:0,    //このWAVEのジャスト回避の回数
    slowT:0,        //見切りのゆっくりの残り
    slowAcc:0,      //ゆっくりの間、次の1コマを進めるまでのたまり具合
    slowPow:0,      //ゆっくりの強さ(1がいちばんゆっくり、0でふつう)

    //WAVEの始め
    reset:function(){
        this.req = false;
        this.t = -1;
        this.cd = 0;
        this.guard = 0;
        this.justDone = false;
        this.justT = 0;
        this.ghosts = [];
        this.readyT = 0;
        this.count = 0;
        this.justCount = 0;
        if(this.slowT > 0) sound.timeWarp(false);
        this.slowT = 0;
        this.slowAcc = 0;
        this.slowPow = 0;
    },
    //見切りのゆっくり：この1コマは敵・弾を止めておくか(mainScreen.update から。ドローン君と装備は止めない)
    //はじめはいちばんゆっくりのまま保ち、そのあと元の速さへ戻していく
    slowStep:function(){
        if(this.slowT <= 0){ this.slowPow = 0; return false; }
        this.slowT--;
        var k = 1 - this.slowT/DODGE_SLOW_TIME;
        var u = Math.max(0, (k - DODGE_SLOW_HOLD)/(1 - DODGE_SLOW_HOLD));
        var rate = DODGE_SLOW_RATE + (1 - DODGE_SLOW_RATE)*u*u;
        this.slowPow = (1 - rate)/(1 - DODGE_SLOW_RATE);
        if(this.slowT == 0 || (u > 0.5 && this.slowPow < 0.6 && !this.slowBack)){
            this.slowBack = true;
            sound.timeWarp(false);      //こもった曲が元へ戻る
        }
        this.slowAcc += rate;
        if(this.slowAcc < 1) return true;
        this.slowAcc -= 1;
        return false;
    },
    enabled:function(){
        return !coop.active && !versus.active && page.number == 1;
    },
    //右クリック(common.js)
    press:function(){
        if(this.enabled()) this.req = true;
    },
    active:function(){ return this.t >= 0; },
    //当たらない間か(飛んでいる間と、着いたあとの少しの間)
    invuln:function(){ return this.t >= 0 || this.guard > 0; },

    //1コマ(mainScreen.update から。ドローン君を動かす前に呼ぶ)
    update:function(){
        var M = mainScreen;
        if(drone.Speed > 0.8){ this.lastX = drone.SpeedX/drone.Speed; this.lastY = drone.SpeedY/drone.Speed; }
        if(this.cd > 0 && --this.cd == 0) this.readyT = 12;
        if(this.readyT > 0) this.readyT--;
        if(this.guard > 0) this.guard--;
        if(this.justT > 0) this.justT--;
        for(var i=this.ghosts.length-1; i>=0; i--) if(--this.ghosts[i].life <= 0) this.ghosts.splice(i,1);
        if(this.t >= 0){
            this.t++;
            if(this.t >= DODGE_TIME) this.land();
        }
        if(this.req){
            this.req = false;
            if(this.cd <= 0 && !M.down && (M.state == "play" || M.state == "start")) this.start();
        }
    },
    start:function(){
        var vx = MouseX - drone.X, vy = MouseY - drone.Y, d = Math.hypot(vx, vy);
        if(d < DODGE_NEAR){ vx = this.lastX; vy = this.lastY; d = 1; }
        this.dx = vx/d; this.dy = vy/d;
        this.dist = Math.max(DODGE_DIST_MIN, Math.min(DODGE_DIST_MAX, d < DODGE_NEAR ? DODGE_DIST_MIN : d));
        this.from = { x:drone.X, y:drone.Y };
        this.t = 0;
        this.cd = DODGE_CD;
        this.justDone = false;
        this.count++;
        //飛び出す：足もとに輪、後ろへ火花、方眼が小さく波打つ
        fx.ring(drone.X, drone.Y, 46, DODGE_COLOR, 14, 5);
        fx.flare(drone.X, drone.Y, 34, "220,250,255", 10);
        for(var i=0; i<10; i++){
            var a = Math.atan2(-this.dy, -this.dx) + (Math.random() - 0.5)*1.4, s = 3 + Math.random()*5;
            effects.push({ x:drone.X, y:drone.Y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:10 + Math.random()*10, maxLife:20,
                           size:1.5 + Math.random()*2, glow:DODGE_COLOR });
        }
        battleBg.ripple(drone.X, drone.Y, 10, 9, 30, DODGE_COLOR);
        fx.shake(3);
        sound.play("dodge");
    },
    land:function(){
        this.t = -1;
        this.guard = DODGE_GUARD;
        fx.ring(drone.X, drone.Y, 28, DODGE_COLOR, 10, 3);
        fx.sparks(drone.X, drone.Y, 6, "200,245,255", 3, 2);
    },
    //体の回る角度(ラジアン)。動きと同じく、はじめに速く回って着く前にゆるむ。右へ飛ぶときは右回り
    spinAt:function(_t){
        var u = Math.min(1, Math.max(0, _t/DODGE_TIME)), k = 1 - Math.pow(1 - u, 3);
        return (this.dx >= 0 ? 1 : -1) * Math.PI*2*DODGE_SPIN*k;
    },
    //飛んでいる間のドローン君の位置(drone.calcXY から。動かしたら true)
    steer:function(_d){
        if(this.t < 0) return false;
        //はじめが速く、着く前にゆるむ。前のコマからの差だけ動かす(壁や障害物で止められたら、そこから先へ)
        //回るのに合わせて、転がる側(右へ飛ぶときは上)へ少し弧を描く
        var ease = function(_t){ var u = Math.min(1, _t/DODGE_TIME); return 1 - Math.pow(1 - u, 3); };
        var arc = function(_t){ return Math.sin(Math.PI*ease(_t))*DODGE_ARC; };
        var k = ease(this.t + 1) - ease(this.t), o = arc(this.t + 1) - arc(this.t);
        var sg = this.dx >= 0 ? 1 : -1, px = sg*this.dy, py = -sg*this.dx;
        _d.X += this.dx*this.dist*k + px*o;
        _d.Y += this.dy*this.dist*k + py*o;
        //残像と、進む向きに流れる光の筋
        this.ghosts.push({ x:_d.X, y:_d.Y, a:this.spinAt(this.t + 1), life:DODGE_GHOSTS });
        if(this.t % 2 == 0){
            var px = -this.dy, py = this.dx, o = (Math.random() - 0.5)*36, L = 26 + Math.random()*30;
            var sx = _d.X + px*o - this.dx*10, sy = _d.Y + py*o - this.dy*10;
            fx.line(sx, sy, sx - this.dx*L, sy - this.dy*L, DODGE_COLOR, 2, 10);
        }
        return true;
    },
    //当たるはずのものを、飛んでいる間にすり抜けた(mainScreen.canBeHit から)。当たらないなら true
    evade:function(){
        if(!this.invuln()) return false;
        if(this.t >= 0 && !this.justDone) this.just();
        return true;
    },
    //ジャスト回避
    just:function(){
        var M = mainScreen;
        this.justDone = true;
        this.justCount++;
        this.justT = DODGE_JUST_TEXT;
        this.cd = 0;
        this.readyT = 12;
        this.guard = Math.max(this.guard, DODGE_JUST_GUARD);
        M.hitStop = Math.max(M.hitStop, DODGE_JUST_STOP);
        //見切り：周りがゆっくりになり、曲がこもる
        this.slowT = DODGE_SLOW_TIME;
        this.slowAcc = 0;
        this.slowBack = false;
        sound.timeWarp(true);
        M.addYaruki(DODGE_JUST_YARUKI);
        game.score += 20;
        //すり抜けた場所(いちばん古い残像)が砕け散る
        var g = this.ghosts[0] || { x:drone.X, y:drone.Y };
        var gx = (g.x + drone.X)/2, gy = (g.y + drone.Y)/2;
        for(var i=0; i<14; i++){
            var a = Math.random()*Math.PI*2, s = 2 + Math.random()*6;
            effects.push({ x:gx, y:gy, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:18 + Math.random()*16, maxLife:34,
                           size:2 + Math.random()*3, color:i % 2 ? "rgba(140,230,255,0.9)" : "#fff" });
        }
        for(var i=0; i<8; i++){
            var a = i/8*Math.PI*2 + Math.random()*0.3;
            fx.line(gx + Math.cos(a)*14, gy + Math.sin(a)*14, gx + Math.cos(a)*(46 + Math.random()*30), gy + Math.sin(a)*(46 + Math.random()*30), "220,250,255", 2.5, 14);
        }
        fx.flare(gx, gy, 70, DODGE_COLOR, 18);
        fx.ring(gx, gy, 130, DODGE_COLOR, 24, 6);
        fx.ring(gx, gy, 80, "255,255,255", 16, 3);
        battleBg.ripple(gx, gy, 18, 8, 50, DODGE_COLOR);
        battleBg.diamond(gx, gy, JUST_DIAMOND_R, JUST_COLOR, GLOW_TIME, GLOW_ALPHA*1.2);
        fx.shake(7);
        if(drone.look.setFace) drone.look.setFace("happy", 50);     //表情(DRONE_FACES)のある作りでは喜ぶ
        sound.play("dodgeJust");
    },

    //---------------------------------------------------------------- 描画
    //ドローン君の下：残像・次に飛べるまでの輪
    drawUnder:function(){
        var gs = this.ghosts, keep = drone.look.tint;
        drone.look.tint = DODGE_GHOST_TINT;     //残像は水色に染める(色違いの絵は覚えておくので軽い)
        for(var i=0; i<gs.length; i++){
            var g = gs[i], a = g.life/DODGE_GHOSTS;
            ctx.fillStyle = "rgba(" + DODGE_COLOR + "," + (0.22*a) + ")";
            ctx.beginPath(); ctx.arc(g.x, g.y, 14 + 10*(1 - a), 0, Math.PI*2); ctx.fill();
            if(i % 2) continue;     //絵は1つおき(重ねすぎるとにじんで見えない)
            //残像は、そのときの回る途中の角度のまま残す
            ctx.save();
            ctx.globalAlpha = 0.55*a*a;
            ctx.translate(g.x, g.y); ctx.rotate(g.a); ctx.translate(-g.x, -g.y);
            drone.look.draw(g.x, g.y);
            ctx.restore();
        }
        drone.look.tint = keep;
        //次に飛べるまで：足もとの小さな弧が満ちていく。満ちたら一瞬光る
        if(this.cd > 0 && this.t < 0){
            var k = 1 - this.cd/DODGE_CD;
            ctx.strokeStyle = "rgba(" + DODGE_COLOR + ",0.75)";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(drone.X, drone.Y + 2, 26, Math.PI*0.5 - k*Math.PI*0.5, Math.PI*0.5 + k*Math.PI*0.5); ctx.stroke();
            ctx.lineWidth = 1;
        }else if(this.readyT > 0){
            ctx.strokeStyle = "rgba(255,255,255," + (this.readyT/12) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(drone.X, drone.Y + 2, 26 + (12 - this.readyT)*0.8, 0, Math.PI*2); ctx.stroke();
            ctx.lineWidth = 1;
        }
    },
    //ドローン君：飛んでいる間は進む向きに伸びて、薄く光る
    drawDrone:function(){
        if(this.t < 0){ drone.draw(); return; }
        var s = Math.sin(Math.PI*Math.min(1, this.t/DODGE_TIME)) * DODGE_STRETCH;
        var a = Math.atan2(this.dy, this.dx);
        ctx.save();
        ctx.translate(drone.X, drone.Y);
        ctx.rotate(a);
        ctx.scale(1 + s, 1 - s*0.5);
        ctx.rotate(-a);
        ctx.rotate(this.spinAt(this.t));    //体がくるっと回る
        ctx.translate(-drone.X, -drone.Y);
        ctx.fillStyle = "rgba(" + DODGE_COLOR + ",0.35)";
        ctx.beginPath(); ctx.arc(drone.X, drone.Y, 24, 0, Math.PI*2); ctx.fill();
        drone.draw();
        ctx.restore();
    },
    //見切りのゆっくりの間、ドローン君へ少し寄る(mainScreen.draw の、ほかの寄りと同じところから)
    zoom:function(){
        if(this.slowPow <= 0) return;
        var z = 1 + DODGE_SLOW_ZOOM*this.slowPow;
        ctx.translate(drone.X, drone.Y);
        ctx.scale(z, z);
        ctx.translate(-drone.X, -drone.Y);
    },
    //いちばん上：見切りの色・ジャスト回避の文字と、画面のふちの光
    drawOver:function(){
        //見切りのゆっくりの間は、画面が青く沈み、ふちが暗くなる
        if(this.slowPow > 0){
            var p = this.slowPow;
            ctx.fillStyle = "rgba(20,50,90," + (0.14*p) + ")";
            ctx.fillRect(0, 0, CW, CH);
            var v = ctx.createRadialGradient(drone.X, drone.Y, 90, drone.X, drone.Y, CW*0.75);
            v.addColorStop(0, "rgba(10,20,40,0)");
            v.addColorStop(1, "rgba(10,20,40," + (0.32*p) + ")");
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, CW, CH);
        }
        if(this.justT <= 0) return;
        var age = DODGE_JUST_TEXT - this.justT, a = Math.min(1, this.justT/20);
        //画面のふちが水色に光る
        var e = 0.35*Math.max(0, 1 - age/30);
        if(e > 0){
            var g = ctx.createRadialGradient(CW/2, CH/2, CH*0.35, CW/2, CH/2, CW*0.62);
            g.addColorStop(0, "rgba(" + DODGE_COLOR + ",0)");
            g.addColorStop(1, "rgba(" + DODGE_COLOR + "," + e + ")");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, CW, CH);
        }
        //文字：大きく出て、ぽんと縮む。少し上へ流れる
        var sc = age < 6 ? 1.8 - age*0.13 : 1;
        var x = drone.X, y = drone.Y - 46 - age*0.25;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "italic 900 " + Math.round(22*sc) + "px sans-serif";
        ctx.lineJoin = "round";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(10,40,60,0.9)";
        ctx.strokeText("ジャスト回避！", x, y);
        ctx.fillStyle = "rgb(150,235,255)";
        ctx.fillText("ジャスト回避！", x, y);
        ctx.restore();
    }
};
