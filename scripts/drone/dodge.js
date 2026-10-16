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
const DODGE_GUARD     = 10;     //着いたあとも当たらない時間(フレーム)
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
//ジャスト回避のあとに動き回って被弾しないように
const DODGE_SLOW_CORE = 0.4;    //見切りの間の、弾に対する当たり判定の大きさ(ふだんの HIT_CORE に掛ける。見切っているので当たりにくい)
const DODGE_CLEAR_R   = 80;     //見切りが解けるとき、まわりの弾を消す範囲(px。元の速さに戻った弾に囲まれていないように)
//切り返し：見切りの間にもう一度右クリックすると、通り道の敵を切り裂くダッシュになる(見切り1回につき1度)
//通り抜けたあと少しして、切った敵にまとめてダメージが入る。切り返しで敵を倒すと、もう一度切り返せる(見切りは短くなる)
const DODGE_SLASH_TIME   = 9;       //切り返しで飛んでいる時間(フレーム)
const DODGE_SLASH_DIST_MIN = 120;   //切り返しの距離のいちばん短いもの(px)
const DODGE_SLASH_DIST_MAX = 300;   //切り返しの距離のいちばん長いもの(px)
const DODGE_SLASH_W      = 28;      //切れる幅(通り道からこの距離＋敵の大きさまで。px)
const DODGE_SLASH_DMG    = 4;       //ダメージ(WAVE1の値。敵の体力と同じ割合で伸びる：ENEMY_HP_GROW)
const DODGE_SLASH_DELAY  = 10;      //着いてから、切った敵にダメージが入るまで(フレーム)
const DODGE_SLASH_TRAIL  = 22;      //刃の跡が消えるまで(フレーム)
const DODGE_SLASH_CHAIN  = 0.6;     //続けて切り返すたびに、見切りの長さに掛ける割合
const DODGE_SLASH_MIN_SLOW = 24;    //見切りがこれより短くなるなら、もう続けられない(フレーム)
const DODGE_SLASH_COLOR  = "200,250,255";   //刃の光の色
const DODGE_SLASH_GUARD  = 20;      //切った敵にダメージが入ってからも当たらない時間(フレーム。着いてからは DODGE_SLASH_DELAY ＋これ)
const DODGE_SLASH_CLEAR_R = 70;     //切り返しで着いたとき、まわりの弾を吹き飛ばす範囲(px。敵の群れの奥に着いても囲まれないように)

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
    slowMax:DODGE_SLOW_TIME,    //今の見切りの長さ(続けて切り返すと短くなる)
    dur:DODGE_TIME, //今のダッシュの長さ(フレーム)
    slash:false,    //今のダッシュが切り返しか
    slashOk:false,  //この見切りの間に切り返せるか
    slashHit:[],    //切り返しで切った敵(着いてからダメージ)
    slashT:-1,      //着いてからダメージが入るまでの残り(-1 は待っていない)
    trail:[],       //刃の跡 { x1,y1,x2,y2,life }
    chain:0,        //この見切りで続けて切り返した回数
    slashCount:0,   //このWAVEで切り返した回数(テスト用)
    label:"",       //大きく出す文字

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
        this.slowMax = DODGE_SLOW_TIME;
        this.dur = DODGE_TIME;
        this.slash = false;
        this.slashOk = false;
        this.slashHit = [];
        this.slashT = -1;
        this.trail = [];
        this.chain = 0;
        this.slashCount = 0;
    },
    //見切りのゆっくり：この1コマは敵・弾を止めておくか(mainScreen.update から。ドローン君と装備は止めない)
    //はじめはいちばんゆっくりのまま保ち、そのあと元の速さへ戻していく
    slowStep:function(){
        if(this.slowT <= 0){ this.slowPow = 0; this.slashOk = false; return false; }
        this.slowT--;
        if(this.slowT == 0){
            this.slashOk = false;     //見切りが終わったら、もう切り返せない
            this.clearAround(DODGE_CLEAR_R);
        }
        var k = 1 - this.slowT/this.slowMax;
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
    //弾に対する当たり判定の大きさ(見切りの間は小さい。mainScreen.updateShots と当たり判定の表示から)
    core:function(){ return this.slowT > 0 ? HIT_CORE*DODGE_SLOW_CORE : HIT_CORE; },
    //まわりの弾を消す(見切りが解けるとき・切り返しで着いたとき)。外へ散る光で消えたのがわかるように
    clearAround:function(_R){
        var n = 0;
        for(var i=enemyShots.length-1; i>=0; i--){
            var b = enemyShots[i];
            if(b.behind) continue;     //奥を通っている弾には届かない(shotLab.js)
            if(Math.hypot(b.x - drone.X, b.y - drone.Y) > _R + (b.r || 5)) continue;
            fx.sparks(b.x, b.y, 2, DODGE_COLOR, 3, 1.5);
            enemyShots.splice(i,1);
            n++;
        }
        fx.ring(drone.X, drone.Y, _R, DODGE_COLOR, 14, 3);
        return n;
    },
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
        for(var i=this.trail.length-1; i>=0; i--) if(--this.trail[i].life <= 0) this.trail.splice(i,1);
        if(this.slashT > 0 && --this.slashT == 0) this.cutDown();
        if(this.t >= 0){
            this.t++;
            if(this.t >= this.dur) this.land();
        }
        if(this.req){
            this.req = false;
            if(this.cd <= 0 && !M.down && (M.state == "play" || M.state == "start")) this.start();
        }
    },
    //今飛ぶと、どの向きへどれだけ飛ぶか(切り返しのときは長い)
    aim:function(_slash){
        var vx = MouseX - drone.X, vy = MouseY - drone.Y, d = Math.hypot(vx, vy);
        if(d < DODGE_NEAR){ vx = this.lastX; vy = this.lastY; d = 1; }
        var lo = _slash ? DODGE_SLASH_DIST_MIN : DODGE_DIST_MIN, hi = _slash ? DODGE_SLASH_DIST_MAX : DODGE_DIST_MAX;
        return { dx:vx/d, dy:vy/d, dist:Math.max(lo, Math.min(hi, d < DODGE_NEAR ? lo : d)) };
    },
    start:function(){
        if(this.slashOk && this.slowT > 0){ this.startSlash(); return; }
        var a = this.aim(false);
        this.dx = a.dx; this.dy = a.dy; this.dist = a.dist;
        this.from = { x:drone.X, y:drone.Y };
        this.t = 0;
        this.dur = DODGE_TIME;
        this.slash = false;
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
        if(this.slash){
            this.slash = false;
            //刀を納めるように、少しの間をおいてから切った敵にダメージが入る
            if(this.slashHit.length > 0) this.slashT = DODGE_SLASH_DELAY;
            //敵の群れの奥に着いても囲まれないよう、まわりの弾を吹き飛ばし、ダメージが入るまで＋少し当たらない
            this.guard = DODGE_SLASH_DELAY + DODGE_SLASH_GUARD;
            this.clearAround(DODGE_SLASH_CLEAR_R);
            fx.flare(drone.X, drone.Y, 30, DODGE_SLASH_COLOR, 8);
        }
    },
    //切り返し：見切りの間の右クリック。ポインタの方へ長く鋭く飛び、通り道の敵を切る
    startSlash:function(){
        var M = mainScreen, a = this.aim(true);
        this.dx = a.dx; this.dy = a.dy; this.dist = a.dist;
        this.from = { x:drone.X, y:drone.Y };
        this.t = 0;
        this.dur = DODGE_SLASH_TIME;
        this.slash = true;
        this.slashOk = false;
        this.slashHit = [];
        this.cd = DODGE_CD;
        this.justDone = true;   //切り返しの間はジャスト回避にしない(見切りが伸び続けないように)
        this.slashCount++;
        //踏み込む：一瞬ためて、進む向きへ光の筋
        M.hitStop = Math.max(M.hitStop, 2);
        fx.flare(drone.X, drone.Y, 44, DODGE_SLASH_COLOR, 10);
        fx.ring(drone.X, drone.Y, 60, DODGE_COLOR, 12, 4);
        fx.line(drone.X, drone.Y, drone.X + this.dx*this.dist, drone.Y + this.dy*this.dist, "255,255,255", 1.5, 6);
        battleBg.ripple(drone.X, drone.Y, 12, 9, 34, DODGE_COLOR);
        fx.shake(4);
        sound.play("dodgeSlash");
    },
    //切り返しの通り道(1コマ分の線)にいる敵を切る。弾は切り落とす
    cut:function(_x1,_y1,_x2,_y2){
        var M = mainScreen, sx = _x2 - _x1, sy = _y2 - _y1, L2 = sx*sx + sy*sy || 1;
        var dist = function(_x,_y){
            var u = Math.max(0, Math.min(1, ((_x - _x1)*sx + (_y - _y1)*sy)/L2));
            return Math.hypot(_x - (_x1 + sx*u), _y - (_y1 + sy*u));
        };
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead || e.harmless || e.phased || this.slashHit.indexOf(e) >= 0) continue;
            if(dist(e.x, e.y) > e.r + DODGE_SLASH_W) continue;
            this.slashHit.push(e);
            e.flash = 6;
            M.hitStop = Math.max(M.hitStop, 2);     //切った手ごたえ
            fx.sparks(e.x, e.y, 8, DODGE_SLASH_COLOR, 6, 2.5);
            fx.line(e.x - this.dx*e.r*2, e.y - this.dy*e.r*2, e.x + this.dx*e.r*2, e.y + this.dy*e.r*2, "255,255,255", 3, 10);
            fx.shake(2);
            sound.play("hit");
        }
        for(var i=enemyShots.length-1; i>=0; i--){
            var b = enemyShots[i];
            if(b.behind) continue;     //奥を通っている弾には届かない(shotLab.js)
            if(dist(b.x, b.y) > (b.r || 5) + DODGE_SLASH_W) continue;
            fx.sparks(b.x, b.y, 3, DODGE_SLASH_COLOR, 3, 1.5);
            enemyShots.splice(i,1);
        }
        this.trail.push({ x1:_x1, y1:_y1, x2:_x2, y2:_y2, life:DODGE_SLASH_TRAIL });
    },
    //着いて少ししてから：切った敵にまとめてダメージ。倒せたら見切りが続き、もう一度切り返せる
    cutDown:function(){
        var M = mainScreen, hit = this.slashHit, kills = 0;
        var dmg = DODGE_SLASH_DMG * (1 + (game.wave - 1)*ENEMY_HP_GROW);
        this.slashHit = [];
        for(var i=0; i<hit.length; i++){
            var e = hit[i];
            if(e.dead) continue;
            //切り口が光って裂ける
            var a = Math.atan2(this.dy, this.dx) + 0.5, R = e.r*2.6;
            fx.line(e.x - Math.cos(a)*R, e.y - Math.sin(a)*R, e.x + Math.cos(a)*R, e.y + Math.sin(a)*R, "255,255,255", 4, 12);
            fx.flare(e.x, e.y, e.r*3, DODGE_SLASH_COLOR, 12);
            M.hitEnemy(e, dmg, "slash");
            if(e.dead) kills++;
        }
        fx.shake(kills > 0 ? 8 : 4);
        sound.play("dodgeCut");
        if(kills == 0) return;
        M.addYaruki(5*kills);
        game.score += 30*kills*(this.chain + 1);
        //続けて切り返せる：見切りを短くして、もう一度
        var len = Math.round(DODGE_SLOW_TIME*Math.pow(DODGE_SLASH_CHAIN, this.chain + 1));
        var label = ["一閃！","二連斬！","三連斬！","四連斬！","五連斬！"][Math.min(this.chain, 4)];
        if(len >= DODGE_SLASH_MIN_SLOW){
            this.chain++;
            this.slowT = this.slowMax = len;
            this.slowAcc = 0;
            if(this.slowBack) sound.timeWarp(true);     //戻りかけた曲を、またこもらせる
            this.slowBack = false;
            this.slashOk = true;
            this.cd = 0;
            this.readyT = 12;
        }
        this.label = label;
        this.justT = DODGE_JUST_TEXT;
        battleBg.ripple(drone.X, drone.Y, 16, 8, 44, DODGE_COLOR);
    },
    //体の回る角度(ラジアン)。動きと同じく、はじめに速く回って着く前にゆるむ。右へ飛ぶときは右回り(切り返しは回らない)
    spinAt:function(_t){
        if(this.slash) return 0;
        var u = Math.min(1, Math.max(0, _t/this.dur)), k = 1 - Math.pow(1 - u, 3);
        return (this.dx >= 0 ? 1 : -1) * Math.PI*2*DODGE_SPIN*k;
    },
    //飛んでいる間のドローン君の位置(drone.calcXY から。動かしたら true)
    steer:function(_d){
        if(this.t < 0) return false;
        //はじめが速く、着く前にゆるむ。前のコマからの差だけ動かす(壁や障害物で止められたら、そこから先へ)
        //回るのに合わせて、転がる側(右へ飛ぶときは上)へ少し弧を描く
        //切り返しはまっすぐ切り込む(弧を描かない)
        var T = this.dur, A = this.slash ? 0 : DODGE_ARC;
        var ease = function(_t){ var u = Math.min(1, _t/T); return 1 - Math.pow(1 - u, 3); };
        var arc = function(_t){ return Math.sin(Math.PI*ease(_t))*A; };
        var k = ease(this.t + 1) - ease(this.t), o = arc(this.t + 1) - arc(this.t);
        var sg = this.dx >= 0 ? 1 : -1, px = sg*this.dy, py = -sg*this.dx;
        var ox = _d.X, oy = _d.Y;
        _d.X += this.dx*this.dist*k + px*o;
        _d.Y += this.dy*this.dist*k + py*o;
        if(this.slash) this.cut(ox, oy, _d.X, _d.Y);
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
        this.slowT = this.slowMax = DODGE_SLOW_TIME;
        this.slowAcc = 0;
        this.slowBack = false;
        sound.timeWarp(true);
        this.slashOk = true;    //見切りの間にもう一度右クリックで切り返し
        this.chain = 0;
        this.label = "ジャスト回避！";
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
        //切り返しの刃の跡：白い芯と水色の光。細くなって消える
        for(var i=0; i<this.trail.length; i++){
            var s = this.trail[i], a = s.life/DODGE_SLASH_TRAIL;
            ctx.lineCap = "round";
            ctx.strokeStyle = "rgba(" + DODGE_COLOR + "," + (0.35*a) + ")";
            ctx.lineWidth = 18*a;
            ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255," + (0.9*a) + ")";
            ctx.lineWidth = 5*a*a + 1;
            ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
            ctx.lineCap = "butt";
        }
        ctx.lineWidth = 1;
        //切り返せる間：ポインタの方へ、切り込む先を細い線で示す
        if(this.slashOk && this.slowT > 0 && this.t < 0){
            var g = this.aim(true), ex = drone.X + g.dx*g.dist, ey = drone.Y + g.dy*g.dist;
            //明るい空でも見えるよう、暗いふちの上に白い破線。点滅して誘う
            var p = 0.75 + 0.25*Math.sin(Date.now()/80);
            var sx = drone.X + g.dx*24, sy = drone.Y + g.dy*24;
            ctx.setLineDash([12, 7]);
            ctx.lineDashOffset = -Date.now()/20;    //先へ流れる
            ctx.strokeStyle = "rgba(10,40,60," + (0.45*p) + ")";
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.strokeStyle = "rgba(" + DODGE_SLASH_COLOR + "," + p + ")";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
            //先に小さなひし形
            ctx.fillStyle = "rgba(255,255,255," + p + ")";
            ctx.strokeStyle = "rgba(10,40,60," + (0.6*p) + ")";
            ctx.beginPath(); ctx.moveTo(ex, ey - 9); ctx.lineTo(ex + 6, ey); ctx.lineTo(ex, ey + 9); ctx.lineTo(ex - 6, ey); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.lineWidth = 1;
        }
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
        var s = Math.sin(Math.PI*Math.min(1, this.t/this.dur)) * DODGE_STRETCH * (this.slash ? 1.8 : 1);
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
        ctx.strokeText(this.label, x, y);
        ctx.fillStyle = "rgb(150,235,255)";
        ctx.fillText(this.label, x, y);
        ctx.restore();
    }
};
