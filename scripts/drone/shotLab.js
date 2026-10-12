//------------------------------------------------------------------------------
//  敵の攻撃の試作(いろいろな動きの弾・範囲攻撃・バケツ)
//  弾：SHOT_KINDS に種類を足し、動き(step)と絵(draw)をここに持つ。mainScreen.updateShots・draw から呼ぶ。
//  弾でない攻撃(範囲攻撃 zones・バケツ buckets)もここで動かして描く(update・drawUnder・drawOver)。
//  まだ敵には持たせていない。デバッグのメニューの「攻撃の試作」で、砲台が1種類ずつ撃つのを見られる。
//  範囲攻撃・バケツはホストの画面だけで動く(協力プレイのゲストにはまだ届かない。バケツの液体は弾なので届く)。
//  協力プレイ：動きはホストだけで計算する(ゲストは届いた位置・速さのまま動かして描く)。
//  ゲストの弾は届くたびに作り直されるので、絵は弾に覚えた値がなくても描けるようにする。
//------------------------------------------------------------------------------
//分裂弾：ゆっくり進み、時間が来ると小さな弾の輪に割れる
const SPLIT_FUSE    = 55;       //割れるまで(フレーム)
const SPLIT_N       = 8;        //割れて出る弾の数
const SPLIT_SPEED   = 1.6;      //割れた弾の速さ(撃ったときの danmaku() を掛ける)
//加速弾：はじめはとても遅く、だんだん速くなる
const ACCEL_START   = 0.25;     //はじめの速さ(撃つときの速さに掛ける)
const ACCEL_RATE    = 1.035;    //1フレームごとに速さに掛ける
const ACCEL_MAX     = 2.2;      //速さの上限(撃つときの速さに掛ける)
//ため弾：飛び出して止まり、少しためてから狙い直して撃ち出される
const REAIM_BRAKE   = 0.93;     //止まるまで1フレームごとに速さに掛ける
const REAIM_WAIT    = 28;       //止まってから撃ち出されるまで(フレーム)
const REAIM_BOOST   = 1.8;      //撃ち出される速さ(撃つときの速さに掛ける)
//波打ち弾：向きを左右にくねらせながら進む
const WAVE_SWING    = 0.75;     //向きのぶれ(ラジアン)
const WAVE_FREQ     = 0.11;     //くねる速さ(ラジアン/フレーム)
//曲がり弾：曲がりながら進み、だんだんまっすぐになる
const CURVE_TURN    = 0.035;    //はじめの曲がり方(ラジアン/フレーム)
const CURVE_DECAY   = 0.985;    //曲がり方が1フレームごとに弱まる割合
//跳ね弾：画面の端で跳ね返る
const BOUNCE_TIMES  = 2;        //跳ね返る回数(使い切ったら画面の外へ出て消える)
//ブーメラン弾：減速して戻ってくる
const BOOMER_BACK   = 0.05;     //1フレームごとに引き戻される速さ(撃つときの速さに掛ける)
//針弾：細長く速い。当たり判定は小さい
const NEEDLE_LEN    = 16;       //描く長さ(px)
//ジャスト不可弾：ジャスト衝撃波にならない(はね返せない)。衝撃波では消えるだけ
//見分けやすいよう、白い芯の代わりに赤い×、まわりに回る赤白のしまの輪。近づくと赤く脈打つ
const NOJUST_WARN   = 120;      //ドローン君からこの距離(px)より近いと赤く脈打つ
const NOJUST_MSG    = 45;       //衝撃波を出したとき「ジャスト不可」を出す、当たるまでのフレーム数
//範囲攻撃：範囲を光の線がなぞり(スキャン)、少しためてから範囲全体を攻撃する。弾ではないので衝撃波では消せない
const ZONE_SCAN     = 50;       //スキャンの長さ(フレーム)
const ZONE_WAIT     = 24;       //スキャンのあと攻撃までのため(フレーム)
const ZONE_STRIKE   = 14;       //攻撃の光が消えるまで(フレーム。当たるのは最初の1フレームだけ)
const ZONE_R        = 78;       //円い範囲の半径(px)
const ZONE_BAND     = 70;       //帯の範囲の太さ(px)
//バケツ：画面の上を動き、傾けて粘りのある液体を流す。最後に口から大きなしずくが垂れて落ちる
const BUCKET_Y      = 62;       //バケツの高さ(画面の上から。px)
const BUCKET_FOLLOW = 0.03;     //ドローン君の上へ寄っていく速さ(1フレームごとに差のこの割合)
const BUCKET_TILT   = 2.0;      //注ぐときの傾き(ラジアン)
const BUCKET_TIMES  = { move:60, tilt:22, pour:54, drip:40, back:26 };  //動きの段階ごとの長さ(フレーム)
const GOO_EVERY     = 3;        //注いでいる間、液体の粒を出す間隔(フレーム)
//液体の粘り(0：水のようにさらさら ～ 1：はちみつのようにどろどろ)。これ1つで、下の落ち方・糸・しぶきがまとめて変わる
//(0.3：しぶきが出るくらい。はじめの試作は 1 だった)
const GOO_VISCOSITY = 0.3;
const GOO_GRAVITY   = 0.075 + 0.04*(1 - GOO_VISCOSITY);    //液体が下へ引かれる強さ(px/フレーム²)
const GOO_DRAG      = 1 - (0.006 + 0.029*GOO_VISCOSITY);   //1フレームごとに速さに掛ける(粘るほど落ちる速さが上がらない)
const GOO_STRING    = 8 + 22*GOO_VISCOSITY;                //同じ流れの続いた粒どうしが、この距離(px)までは糸でつながる
const GOO_NECK      = 20 + 60*GOO_VISCOSITY;               //垂れたしずくが、口とこの距離(px)まで糸を引く
const GOO_DROP_R    = [3,9];    //垂れるしずくの大きさ(はじめ, 落ちる直前)
const GOO_SPLAT     = Math.round(3 + 6*(1 - GOO_VISCOSITY));   //床に落ちた粒が飛び散る数
const GOO_SPLAT_SPEED = 1.4 + 2.4*(1 - GOO_VISCOSITY);      //飛び散る速さ
const GOO_SPRAY     = 0.6*(1 - GOO_VISCOSITY);              //注ぐとき、粒を出すたびに口から細かいしぶきが飛ぶ確率

//試作の弾の種類(r：大きさ・当たり判定)
SHOT_KINDS.split    = { r:6 };      //緑
SHOT_KINDS.accel    = { r:4 };      //青緑のしずく
SHOT_KINDS.reaim    = { r:5 };      //ピンクのひし形
SHOT_KINDS.wave     = { r:4.5 };    //青
SHOT_KINDS.curve    = { r:4.5 };    //金色のほうき星
SHOT_KINDS.bounce   = { r:5.5 };    //灰色のゴムまり
SHOT_KINDS.boomer   = { r:6 };      //赤い手裏剣
SHOT_KINDS.needle   = { r:3 };      //白い針
SHOT_KINDS.nojust   = { r:6.5, noJust:true };   //黒地に赤い×(ジャスト衝撃波にならない)
SHOT_KINDS.goo      = { r:5 };      //バケツの液体(黄緑。大きさは粒ごとに変わる)

//デバッグの「攻撃の試作」
const SHOT_LAB_WAVE = 7;            //弾の速さ・数はこのWAVEのもの(ボス・ライバルのWAVEは選ばない)
const SHOT_LAB_SEC  = 7;            //1種類を出す秒数(自動で順番に切り替えるとき。選んだ攻撃もこの長さで繰り返す)
const LAB_LIST_Y    = 96;           //左の一覧の上の端(px)
const LAB_ROW_H     = 20;           //一覧の1行の高さ(px)
const LAB_LIST_W    = 190;          //一覧の幅(px)

var shotLab = {
    //種類ごとの名前・撃ち方(デバッグの「攻撃の試作」の砲台が使う。敵に持たせるときの見本にもなる)
    list:[
        { id:"split",  name:"分裂弾",       note:"時間で小さな弾の輪に割れる" },
        { id:"accel",  name:"加速弾",       note:"遅く出て、だんだん速くなる" },
        { id:"reaim",  name:"ため弾",       note:"止まってから狙い直して飛ぶ" },
        { id:"wave",   name:"波打ち弾",     note:"くねくね進む" },
        { id:"curve",  name:"曲がり弾",     note:"曲がりながら広がる" },
        { id:"bounce", name:"跳ね弾",       note:"画面の端で跳ね返る" },
        { id:"boomer", name:"ブーメラン弾", note:"減速して戻ってくる" },
        { id:"needle", name:"針弾",         note:"細く速い。当たり判定は小さい" },
        { id:"nojust", name:"ジャスト不可弾", note:"黒地に赤い×。はね返せない(白い芯の赤い弾はジャストできる)" },
        { id:"zone",   name:"範囲攻撃",     note:"なぞられた範囲が、少しあとにまとめて攻撃される" },
        { id:"bucket", name:"バケツ",       note:"液体を注ぎ、しずくが垂れる。床でしぶきが飛ぶ" }
    ],
    zones:[],       //範囲攻撃 { shape:"circle"|"band", x, y, r, w, h, t }
    buckets:[],     //バケツ { x, y, side, mode, t, tilt, pour, seq, drop }
    pourSeq:0,      //液体の流れの番号(同じ流れの粒を糸でつなぐ)

    //試作の攻撃を全部消す(WAVEの始め・クリア・攻撃の試作で次の種類へ移るとき)
    clear:function(){
        this.zones = [];
        this.buckets = [];
    },
    //範囲攻撃を出す(_shape："circle" は (_x,_y) を中心に半径 ZONE_R、"band" は横の帯(_y が中心)・"col" は縦の帯(_x が中心))
    zone:function(_shape,_x,_y){
        var z = { shape:_shape, x:_x, y:_y, r:ZONE_R, t:0 };
        if(_shape == "band"){ z.x = 0; z.y = _y - ZONE_BAND/2; z.w = CW; z.h = ZONE_BAND; }
        if(_shape == "col"){ z.x = _x - ZONE_BAND/2; z.y = 0; z.w = ZONE_BAND; z.h = CH; }
        this.zones.push(z);
        sound.play("error");    //スキャンの始まりの合図(仮の音)
        return z;
    },
    inZone:function(z,_x,_y){
        if(z.shape == "circle") return Math.hypot(_x - z.x, _y - z.y) < z.r;
        return _x > z.x && _x < z.x + z.w && _y > z.y && _y < z.y + z.h;
    },
    //バケツを出す
    bucket:function(_x){
        var k = { x:_x, y:BUCKET_Y, side:1, mode:"move", t:0, tilt:0, pour:0, seq:0, drop:null };
        this.buckets.push(k);
        return k;
    },
    //バケツの口の位置と、口の向き(液体が出ていく向き)
    lip:function(k){
        var c = Math.cos(k.tilt*k.side), s = Math.sin(k.tilt*k.side);
        var lx = 18*k.side, ly = -16;   //傾ける側の、ふちの角
        return { x:k.x + lx*c - ly*s, y:k.y + lx*s + ly*c, dx:s, dy:-c };   //口の向きは、上向き(0,-1)を傾けたもの
    },

    //範囲攻撃・バケツを動かす(mainScreen.updateShots から。ホストの画面だけ)
    update:function(){
        if(coop.isGuest()) return;
        var ms = mainScreen;
        for(var i=this.zones.length-1; i>=0; i--){
            var z = this.zones[i];
            z.t++;
            if(z.t == ZONE_SCAN + ZONE_WAIT){
                //範囲全体を攻撃(中にいれば被弾)
                if(ms.state != "over" && this.inZone(z,drone.X,drone.Y) && ms.canBeHit()) ms.damage();
                if(z.shape == "circle") fx.ring(z.x, z.y, z.r, "255,80,60", 14, 6);
                fx.shake(4);
                battleBg.ripple(z.shape == "circle" ? z.x : z.x + z.w/2, z.shape == "circle" ? z.y : z.y + z.h/2, 14, 6, 40, "255,90,60");
                sound.play("explode");
            }
            if(z.t >= ZONE_SCAN + ZONE_WAIT + ZONE_STRIKE) this.zones.splice(i,1);
        }
        for(var i=0; i<this.buckets.length; i++) this.bucketStep(this.buckets[i]);
    },
    bucketStep:function(k){
        k.t++;
        var tg = nearestPlayer(k.x,k.y);
        var T = BUCKET_TIMES;
        switch(k.mode){
            case "move":
                //ドローン君の少し手前の上へ寄る(注ぐ側はドローン君のいる側)
                k.side = tg.X >= k.x ? 1 : -1;
                k.x += (tg.X - k.side*30 - k.x)*BUCKET_FOLLOW;
                if(k.t >= T.move){ k.mode = "tilt"; k.t = 0; }
                break;
            case "tilt":
                k.tilt = BUCKET_TILT*Math.min(1, k.t/T.tilt);
                if(k.t >= T.tilt){ k.mode = "pour"; k.t = 0; k.pour = ++this.pourSeq; k.seq = 0; }
                break;
            case "pour":
                //口から粘る液体を流す(続いた粒は糸でつながる)
                if(k.t % GOO_EVERY == 0){
                    var L = this.lip(k), m = danmaku();
                    var b = this.fire(L.x, L.y, Math.atan2(L.dy,L.dx), (0.9 + Math.random()*0.5)*m, "goo",
                                      { pour:k.pour, seq:k.seq++, r:4 + Math.random()*2 });
                    //さらさらなほど、口から細かいしぶきが飛ぶ
                    if(Math.random() < GOO_SPRAY){
                        this.fire(L.x, L.y, Math.atan2(L.dy,L.dx) + (Math.random() - 0.5)*1.6, (1.5 + Math.random()*1.5)*m, "goo",
                                  { small:true, r:1.6 + Math.random()*1.2 });
                    }
                }
                if(k.t >= T.pour){
                    k.mode = "drip"; k.t = 0;
                    var L = this.lip(k);
                    k.drop = this.fire(L.x, L.y, 0, 0, "goo", { hang:T.drip, owner:k, r:GOO_DROP_R[0], big:true });
                }
                break;
            case "drip":
                //口に大きなしずくがたまり、ふくらんでから落ちる
                if(k.t >= T.drip){ k.mode = "back"; k.t = 0; k.drop = null; }
                break;
            case "back":
                k.tilt = BUCKET_TILT*Math.max(0, 1 - k.t/T.back);
                if(k.t >= T.back){ k.mode = "move"; k.t = 0; }
                break;
        }
    },

    //ジャスト衝撃波にならない弾か(mainScreen.isJust・blast から)
    noJust:function(b){
        var K = SHOT_KINDS[b.kind];
        return !!(K && K.noJust);
    },
    //衝撃波で消えたジャスト不可弾：当たりそうだったなら「ジャスト不可」と出す(なぜジャストにならなかったかわかるように)
    denied:function(b){
        if(mainScreen.hitTime(b.x,b.y,b.vx,b.vy,(b.r || 5) + HIT_CORE,NOJUST_MSG) < 0) return;
        popup(b.x, b.y - 14, "ジャスト不可", "rgb(210,30,40)");
        fx.sparks(b.x, b.y, 6, "40,40,48", 4, 2);
    },

    //試作の弾を撃つ(_extra：弾に足す値)
    fire:function(_x,_y,_angle,_speed,_kind,_extra){
        fireShot(_x,_y,_angle,_speed,_kind);
        var b = enemyShots[enemyShots.length - 1];
        b.t = 0;
        b.base = _speed;
        switch(_kind){
            case "split":  b.fuse = SPLIT_FUSE; b.mul = danmaku(); break;
            case "accel":  b.vx *= ACCEL_START; b.vy *= ACCEL_START; break;
            case "reaim":  b.wait = REAIM_WAIT; break;
            case "wave":   b.dir = _angle; b.ph = 0; break;
            case "curve":  b.turn = CURVE_TURN; break;
            case "bounce": b.left = BOUNCE_TIMES; break;
            case "boomer": b.bx = Math.cos(_angle); b.by = Math.sin(_angle); break;
        }
        if(_extra) for(var k in _extra) b[k] = _extra[k];
        return b;
    },

    //動き(mainScreen.updateShots から、位置を進める前に呼ぶ)。true なら弾を消す
    step:function(b){
        if(b.t == null || coop.isGuest()) return false;     //ふつうの弾・ゲストの画面
        b.t++;
        var sp = Math.hypot(b.vx,b.vy);
        switch(b.kind){
            case "split":
                b.vx *= 0.99; b.vy *= 0.99;
                if(--b.fuse <= 0){
                    var a0 = Math.random()*Math.PI*2;
                    for(var i=0; i<SPLIT_N; i++) fireShot(b.x,b.y,a0 + i*Math.PI*2/SPLIT_N,SPLIT_SPEED*b.mul,"small");
                    burst(b.x,b.y,6,"#2a9d3a");
                    sound.play("enemyShot");
                    return true;
                }
                break;
            case "accel":
                if(sp < b.base*ACCEL_MAX){ b.vx *= ACCEL_RATE; b.vy *= ACCEL_RATE; }
                break;
            case "reaim":
                if(b.wait > 0 && sp > 0.15){
                    b.vx *= REAIM_BRAKE; b.vy *= REAIM_BRAKE;
                }else if(b.wait > 0){
                    //止まって、狙う相手を見ながらためる(狙いは撃ち出す瞬間に決める)
                    b.vx = 0; b.vy = 0;
                    var tg = nearestPlayer(b.x,b.y);
                    b.aim = Math.atan2(tg.Y - b.y, tg.X - b.x);
                    if(--b.wait <= 0){
                        b.vx = Math.cos(b.aim)*b.base*REAIM_BOOST;
                        b.vy = Math.sin(b.aim)*b.base*REAIM_BOOST;
                        b.grazed = false;   //撃ち出されたらもう一度かすれる
                    }
                }
                break;
            case "wave":
                b.ph += WAVE_FREQ;
                var a = b.dir + Math.sin(b.ph)*WAVE_SWING;
                b.vx = Math.cos(a)*b.base; b.vy = Math.sin(a)*b.base;
                break;
            case "curve":
                var a = Math.atan2(b.vy,b.vx) + b.turn;
                b.turn *= CURVE_DECAY;
                b.vx = Math.cos(a)*sp; b.vy = Math.sin(a)*sp;
                break;
            case "bounce":
                if(b.left > 0){
                    var nx = b.x + b.vx, ny = b.y + b.vy, hit = false;
                    if((nx < b.r && b.vx < 0) || (nx > CW - b.r && b.vx > 0)){ b.vx = -b.vx; hit = true; }
                    if((ny < b.r && b.vy < 0) || (ny > CH - b.r && b.vy > 0)){ b.vy = -b.vy; hit = true; }
                    if(hit){ b.left--; b.grazed = false; }
                }
                break;
            case "boomer":
                b.vx -= b.bx*b.base*BOOMER_BACK;
                b.vy -= b.by*b.base*BOOMER_BACK;
                break;
            case "goo":
                if(b.hang > 0){
                    //バケツの口にぶら下がって、ふくらむ
                    var o = b.owner;
                    b.vx = 0; b.vy = 0;
                    b.r = GOO_DROP_R[0] + (GOO_DROP_R[1] - GOO_DROP_R[0])*(1 - b.hang/BUCKET_TIMES.drip);
                    if(o){ var L = this.lip(o); b.x = L.x + L.dx*b.r*0.4; b.y = L.y + b.r*0.9; }
                    if(--b.hang <= 0) b.vy = 0.3;   //ちぎれて落ちる(糸はしばらく口とつながる)
                    break;
                }
                //下へ引かれるが、粘るほど速くなりきらない(大きなしずくは少し速い)
                var drag = b.big ? Math.max(GOO_DRAG, 0.98) : GOO_DRAG;
                b.vy += GOO_GRAVITY;
                b.vx *= drag; b.vy *= drag;
                //床に落ちた粒は、小さなしぶきになって飛び散る(流れの粒は数を半分に。しぶきは飛び散らない)
                if(!b.small && b.y > CH - b.r){
                    var n = b.big ? GOO_SPLAT + 3 : Math.ceil(GOO_SPLAT/2);
                    for(var i=0; i<n; i++){
                        this.fire(b.x, CH - 4, -Math.PI/2 + (Math.random() - 0.5)*1.8, GOO_SPLAT_SPEED*(0.6 + Math.random()*0.7), "goo",
                                  { small:true, r:1.6 + Math.random()*1.5 });
                    }
                    burst(b.x, CH - 4, 5, "#7cc22e");
                    return true;
                }
                break;
        }
        return false;
    },

    //絵(mainScreen.draw から)。true なら描いた
    draw:function(b){
        var r = b.r || 5, ang = Math.atan2(b.vy,b.vx), sp = Math.hypot(b.vx,b.vy);
        var now = b.t != null ? b.t : Math.floor(performance.now()/16);
        switch(b.kind){
            case "split":
                //割れる前ほど速く明滅し、ふくらむ
                var f = b.fuse != null ? b.fuse : SPLIT_FUSE;
                var pulse = f < 20 && Math.floor(f/3) % 2 == 0;
                var rr = r + 1 + (f < 20 ? (20 - f)*0.08 : 0);
                ctx.fillStyle = pulse ? "#8fe39b" : "#2a9d3a";
                ctx.beginPath(); ctx.arc(b.x,b.y,rr,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(b.x - rr*0.6,b.y); ctx.lineTo(b.x + rr*0.6,b.y);
                ctx.moveTo(b.x,b.y - rr*0.6); ctx.lineTo(b.x,b.y + rr*0.6);
                ctx.stroke(); ctx.lineWidth = 1;
                return true;
            case "accel":
                //速いほど後ろへ伸びるしずく
                var tail = r + 2 + Math.min(14, sp*2.2);
                ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ang);
                ctx.fillStyle = "#0e9a9a";
                ctx.beginPath(); ctx.arc(0,0,r + 1,-Math.PI/2,Math.PI/2); ctx.lineTo(-tail,0); ctx.closePath(); ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(0,0,r*0.45,0,Math.PI*2); ctx.fill();
                ctx.restore();
                return true;
            case "reaim":
                //止まってためている間は、狙う向きに点線を出す
                var a = b.aim != null && sp < 0.2 ? b.aim : ang;
                if(b.aim != null && sp < 0.2){
                    ctx.strokeStyle = "rgba(224,56,138,0.45)"; ctx.lineWidth = 1.5;
                    ctx.setLineDash([4,5]);
                    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x + Math.cos(a)*70, b.y + Math.sin(a)*70); ctx.stroke();
                    ctx.setLineDash([]); ctx.lineWidth = 1;
                }
                ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(a);
                ctx.fillStyle = "#e0388a";
                var s = r + 2;
                ctx.beginPath(); ctx.moveTo(s*1.3,0); ctx.lineTo(0,-s*0.8); ctx.lineTo(-s,0); ctx.lineTo(0,s*0.8); ctx.closePath(); ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(0,0,r*0.4,0,Math.PI*2); ctx.fill();
                ctx.restore();
                return true;
            case "wave":
                //進む向きに左右のひれ
                ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ang);
                ctx.fillStyle = "#3a5ad8";
                ctx.beginPath(); ctx.moveTo(-2,-r - 3); ctx.lineTo(-r - 3,0); ctx.lineTo(-2,r + 3); ctx.closePath(); ctx.fill();
                ctx.beginPath(); ctx.arc(0,0,r + 1,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(0,0,r*0.45,0,Math.PI*2); ctx.fill();
                ctx.restore();
                return true;
            case "curve":
                //ほうき星(尾は進む向きの反対へ)
                ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ang);
                ctx.fillStyle = "rgba(196,144,0,0.45)";
                ctx.beginPath(); ctx.moveTo(0,-r); ctx.quadraticCurveTo(-r*2,-r*0.6,-r*3.2,0); ctx.quadraticCurveTo(-r*2,r*0.6,0,r); ctx.fill();
                ctx.fillStyle = "#c49000";
                ctx.beginPath(); ctx.arc(0,0,r + 1,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(0,0,r*0.45,0,Math.PI*2); ctx.fill();
                ctx.restore();
                return true;
            case "bounce":
                //ゴムまり(跳ね返れる回数だけ白い点)
                ctx.fillStyle = "#3d4b5c";
                ctx.beginPath(); ctx.arc(b.x,b.y,r + 1,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle = "#9fb3c8"; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(b.x,b.y,r - 1,0,Math.PI*2); ctx.stroke(); ctx.lineWidth = 1;
                var n = b.left != null ? b.left : 0;
                ctx.fillStyle = "#fff";
                if(n >= 2){
                    ctx.beginPath(); ctx.arc(b.x - 1.8,b.y,1.4,0,Math.PI*2); ctx.arc(b.x + 1.8,b.y,1.4,0,Math.PI*2); ctx.fill();
                }else{
                    ctx.beginPath(); ctx.arc(b.x,b.y,n == 1 ? 1.6 : r*0.45,0,Math.PI*2); ctx.fill();
                }
                return true;
            case "boomer":
                //回る三枚刃
                ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(now*0.35);
                ctx.fillStyle = "#c0392b";
                for(var i=0; i<3; i++){
                    ctx.rotate(Math.PI*2/3);
                    ctx.beginPath(); ctx.moveTo(0,-2.5); ctx.quadraticCurveTo(r*1.4,-r*0.9,r + 4,0); ctx.lineTo(0,2.5); ctx.fill();
                }
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(0,0,2.5,0,Math.PI*2); ctx.fill();
                ctx.restore();
                return true;
            case "nojust":
                //近づくと外側に赤い輪が脈打つ
                if(Math.hypot(b.x - drone.X, b.y - drone.Y) < NOJUST_WARN){
                    var w = 0.5 + 0.5*Math.sin(now*0.4);
                    ctx.strokeStyle = "rgba(230,30,40," + (0.35 + w*0.45) + ")"; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(b.x,b.y,r + 6 + w*3,0,Math.PI*2); ctx.stroke();
                }
                //回る赤白のしまの輪
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#fff";
                ctx.beginPath(); ctx.arc(b.x,b.y,r + 2.5,0,Math.PI*2); ctx.stroke();
                ctx.strokeStyle = "#d81e28";
                ctx.setLineDash([3.5,3.5]); ctx.lineDashOffset = -now*0.6;
                ctx.beginPath(); ctx.arc(b.x,b.y,r + 2.5,0,Math.PI*2); ctx.stroke();
                ctx.setLineDash([]); ctx.lineDashOffset = 0;
                //黒い玉に赤い×(白い芯がない)
                ctx.fillStyle = "#18181d";
                ctx.beginPath(); ctx.arc(b.x,b.y,r + 1,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle = "#ff3a44"; ctx.lineWidth = 2.2; ctx.lineCap = "round";
                var k = r*0.5;
                ctx.beginPath();
                ctx.moveTo(b.x - k,b.y - k); ctx.lineTo(b.x + k,b.y + k);
                ctx.moveTo(b.x + k,b.y - k); ctx.lineTo(b.x - k,b.y + k);
                ctx.stroke();
                ctx.lineCap = "butt"; ctx.lineWidth = 1;
                return true;
            case "goo":
                //落ちる速さで縦に伸びる粒(ぶら下がっている間は下がふくらんだしずく)
                var st = b.hang > 0 ? 1.25 : 1 + Math.min(0.9, sp*0.3);
                ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(sp > 0.05 ? ang - Math.PI/2 : 0);
                ctx.fillStyle = "#3f7a12";
                ctx.beginPath(); ctx.ellipse(0,0,r/Math.sqrt(st) + 1.2,r*st + 1.2,0,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#7cc22e";
                ctx.beginPath(); ctx.ellipse(0,0,r/Math.sqrt(st),r*st,0,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,0.85)";
                ctx.beginPath(); ctx.arc(-r*0.3,-r*0.3*st,Math.max(1,r*0.3),0,Math.PI*2); ctx.fill();
                ctx.restore();
                return true;
            case "needle":
                //進む向きに細長い針(当たるのは先の点だけ)
                ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ang);
                ctx.fillStyle = "#d22";
                ctx.beginPath(); ctx.moveTo(r + 2,0); ctx.lineTo(-NEEDLE_LEN,-r*0.9); ctx.lineTo(-NEEDLE_LEN,r*0.9); ctx.closePath(); ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.fillRect(-NEEDLE_LEN + 3,-0.8,NEEDLE_LEN,1.6);
                ctx.restore();
                return true;
        }
        return false;
    },

    //弾の下に描くもの：範囲攻撃の範囲と、液体の糸(mainScreen.draw から)
    drawUnder:function(){
        for(var i=0; i<this.zones.length; i++) this.drawZone(this.zones[i]);
        //液体の糸：同じ流れで続いた粒どうしをつなぐ(離れるほど細くなり、離れすぎるとちぎれる)
        var flows = {};
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.kind != "goo") continue;
            if(b.pour){ (flows[b.pour] = flows[b.pour] || {})[b.seq] = b; }
            //垂れたしずくは口と糸でつながる
            if(b.owner){
                var L = this.lip(b.owner), d = Math.hypot(b.x - L.x, b.y - L.y);
                if(d < GOO_NECK) this.gooString(L.x, L.y, b.x, b.y - b.r*0.5, b.hang > 0 ? b.r*0.9 : b.r*0.7*(1 - d/GOO_NECK));
            }
        }
        for(var p in flows){
            var f = flows[p];
            for(var s in f){
                var a = f[s], c = f[+s + 1];
                if(!c) continue;
                var d = Math.hypot(a.x - c.x, a.y - c.y);
                if(d < GOO_STRING) this.gooString(a.x, a.y, c.x, c.y, Math.min(a.r, c.r)*1.1*(1 - d/GOO_STRING));
            }
        }
    },
    gooString:function(_x1,_y1,_x2,_y2,_w){
        if(_w < 0.6) return;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#3f7a12"; ctx.lineWidth = _w*2 + 2.4;
        ctx.beginPath(); ctx.moveTo(_x1,_y1); ctx.lineTo(_x2,_y2); ctx.stroke();
        ctx.strokeStyle = "#7cc22e"; ctx.lineWidth = _w*2;
        ctx.beginPath(); ctx.moveTo(_x1,_y1); ctx.lineTo(_x2,_y2); ctx.stroke();
        ctx.lineCap = "butt"; ctx.lineWidth = 1;
    },
    //範囲攻撃：スキャンの間は光の線が範囲をなぞり、なぞった所が薄く赤くなる → ためで赤く点滅 → 攻撃で白く光る
    drawZone:function(z){
        var circle = z.shape == "circle";
        var path = function(){
            ctx.beginPath();
            if(circle) ctx.arc(z.x,z.y,z.r,0,Math.PI*2);
            else ctx.rect(z.x,z.y,z.w,z.h);
        };
        ctx.save();
        if(z.t < ZONE_SCAN + ZONE_WAIT){
            var k = Math.min(1, z.t/ZONE_SCAN);
            //範囲のふち(点線)
            ctx.strokeStyle = "rgba(220,40,40,0.75)"; ctx.lineWidth = 2;
            ctx.setLineDash([6,5]); ctx.lineDashOffset = -z.t*0.8;
            path(); ctx.stroke();
            ctx.setLineDash([]);
            //なぞった所(上から下へ。帯は進む向きへ)
            path(); ctx.clip();
            var top, len, vert = !circle && z.shape == "col";
            if(circle){ top = z.y - z.r; len = z.r*2; }
            else if(vert){ top = z.y; len = z.h; }
            else{ top = z.x; len = z.w; }
            var edge = top + len*k;
            var wait = z.t >= ZONE_SCAN;
            var a = wait ? 0.22 + 0.18*(Math.floor(z.t/4) % 2) : 0.16;
            ctx.fillStyle = "rgba(230,40,40," + a + ")";
            if(circle) ctx.fillRect(z.x - z.r, top, z.r*2, edge - top);
            else if(vert) ctx.fillRect(z.x, top, z.w, edge - top);
            else ctx.fillRect(top, z.y, edge - top, z.h);
            //スキャンの光の線
            if(!wait){
                ctx.fillStyle = "rgba(255,90,90,0.9)";
                if(circle) ctx.fillRect(z.x - z.r, edge - 2, z.r*2, 4);
                else if(vert) ctx.fillRect(z.x, edge - 2, z.w, 4);
                else ctx.fillRect(edge - 2, z.y, 4, z.h);
                ctx.fillStyle = "rgba(255,200,200,0.5)";
                if(circle) ctx.fillRect(z.x - z.r, edge - 7, z.r*2, 5);
                else if(vert) ctx.fillRect(z.x, edge - 7, z.w, 5);
                else ctx.fillRect(edge - 7, z.y, 5, z.h);
            }
        }else{
            //攻撃：範囲全体が白く光ってから赤く消える
            var f = 1 - (z.t - ZONE_SCAN - ZONE_WAIT)/ZONE_STRIKE;
            ctx.fillStyle = "rgba(255," + Math.round(120 + 135*f) + "," + Math.round(100 + 155*f) + "," + (0.85*f) + ")";
            path(); ctx.fill();
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //弾の上に描くもの：バケツ
    drawOver:function(){
        for(var i=0; i<this.buckets.length; i++){
            var k = this.buckets[i];
            ctx.save(); ctx.translate(k.x,k.y); ctx.rotate(k.tilt*k.side);
            //取っ手
            ctx.strokeStyle = "#3a3f46"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(0,-16,17,Math.PI*1.05,Math.PI*1.95); ctx.stroke();
            //胴(下がすぼまった筒)
            ctx.fillStyle = "#3a3f46";
            ctx.beginPath(); ctx.moveTo(-20,-17); ctx.lineTo(20,-17); ctx.lineTo(15,18); ctx.lineTo(-15,18); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#8d98a5";
            ctx.beginPath(); ctx.moveTo(-18,-15); ctx.lineTo(18,-15); ctx.lineTo(13.5,16); ctx.lineTo(-13.5,16); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.fillRect(-12,-12,3,24);
            ctx.fillStyle = "#6c7783";
            ctx.fillRect(-16,2,32,3);
            //口(中の液体が見える)
            ctx.fillStyle = "#3a3f46";
            ctx.beginPath(); ctx.ellipse(0,-17,21,5,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "#7cc22e";
            ctx.beginPath(); ctx.ellipse(0,-17,17.5,3.4,0,0,Math.PI*2); ctx.fill();
            ctx.restore();
            ctx.lineWidth = 1;
        }
    },

    //---- デバッグの「攻撃の試作」：画面の上の砲台が、1種類ずつ順番に撃つ ----
    //左の一覧で見たい攻撃を選べる(押すとその攻撃だけを繰り返す。「自動で順番に」で SHOT_LAB_SEC 秒ずつ切り替わる)
    labT:0,
    labX:CW/2,
    labPick:-1,     //選んだ攻撃の番号(-1：自動で順番に)。メニューへ戻っても覚えておく
    labIndex:function(){
        if(this.labPick >= 0) return this.labPick;
        return Math.floor(this.labT/(SHOT_LAB_SEC*60)) % this.list.length;
    },
    labStart:function(){
        this.labT = Math.max(0, this.labPick)*SHOT_LAB_SEC*60;
        this.labX = CW/2;
    },
    //一覧の行(0番目は「自動で順番に」、そのあとに攻撃が並ぶ)
    labRows:function(){
        var out = [];
        for(var i=-1; i<this.list.length; i++) out.push({ i:i, x:8, y:LAB_LIST_Y + (i + 1)*LAB_ROW_H, w:LAB_LIST_W, h:LAB_ROW_H });
        return out;
    },
    labRowAt:function(_x,_y){
        if(!bossDebug.lab) return null;
        var r = this.labRows();
        for(var i=0; i<r.length; i++){
            if(_x >= r[i].x && _x < r[i].x + r[i].w && _y >= r[i].y && _y < r[i].y + r[i].h) return r[i];
        }
        return null;
    },
    //一覧を押したら攻撃を選ぶ(mainScreen.update・common.js のタッチから)。押したなら true(衝撃波は出さない)
    labPickAt:function(_x,_y){
        var r = this.labRowAt(_x,_y);
        if(!r) return false;
        var cur = this.labIndex();
        this.labPick = r.i;
        //選んだ攻撃(自動なら今の攻撃)をはじめから出し直す。前の攻撃の弾・範囲攻撃・バケツは消す
        this.labT = (r.i >= 0 ? r.i : cur)*SHOT_LAB_SEC*60;
        enemyShots = [];
        this.clear();
        sound.play("click");
        return true;
    },
    //mainScreen.spawn から(雑魚敵の代わりに)
    labStep:function(){
        var t = this.labT++;
        var T = t % (SHOT_LAB_SEC*60);
        this.labX = CW/2 + Math.sin(t*0.012)*CW*0.3;
        if(T == 0) this.clear();    //次の種類へ移ったら、前の範囲攻撃・バケツを消す
        if(T < 40) return;      //切り替わった直後は少し待つ
        var x = this.labX, y = 70, m = danmaku();
        var tg = nearestPlayer(x,y), aim = Math.atan2(tg.Y - y, tg.X - x);
        var id = this.list[this.labIndex()].id, shot = false;
        switch(id){
            case "split":  if(T % 70 == 0){ for(var i=-1; i<=1; i++) this.fire(x,y,aim + i*0.5,1.6*m,id); shot = true; } break;
            case "accel":  if(T % 60 == 0){ for(var i=0; i<14; i++) this.fire(x,y,t*0.05 + i*Math.PI*2/14,2.2*m,id); shot = true; } break;
            case "reaim":  if(T % 80 == 0){ for(var i=0; i<10; i++) this.fire(x,y,i*Math.PI*2/10 + 0.3,3.2*m,id); shot = true; } break;
            case "wave":   if(T % 24 == 0){ for(var i=-1; i<=1; i++) this.fire(x,y,aim + i*0.35,2.2*m,id,{ ph:i*1.2 }); shot = true; } break;
            case "curve":  if(T % 40 == 0){ for(var i=0; i<10; i++) this.fire(x,y,i*Math.PI*2/10,2*m,id,{ turn:(Math.floor(T/40) % 2 ? 1 : -1)*CURVE_TURN }); shot = true; } break;
            case "bounce": if(T % 55 == 0){ for(var i=-2; i<=2; i++) this.fire(x,y,aim + i*0.4,2.6*m,id); shot = true; } break;
            case "boomer": if(T % 50 == 0){ for(var i=-1; i<=1; i++) this.fire(x,y,aim + i*0.3,4.5*m,id); shot = true; } break;
            case "needle": if(T % 90 < 30 && T % 5 == 0){ this.fire(x,y,aim + (Math.random() - 0.5)*0.15,5.5*m,id); shot = true; } break;
            case "nojust":
                //ジャスト不可弾の扇の合間に、ジャストできるふつうの赤い弾を撃つ(見比べられるように)
                if(T % 60 == 0){ for(var i=-1; i<=1; i++) this.fire(x,y,aim + i*0.3,2.4*m,id); shot = true; }
                if(T % 60 == 30){ fireFan(x,y,aim,2,0.15,2.4*m,"normal"); shot = true; }
                break;
            case "zone":
                //ドローン君のいる所を、円・横の帯・縦の帯の順に狙う
                if(T % 70 == 40){
                    var n = Math.floor(T/70) % 3;
                    this.zone(["circle","band","col"][n], tg.X, tg.Y);
                }
                break;
            case "bucket":
                if(T == 40) this.bucket(x);
                break;
        }
        if(shot) sound.play("enemyShot");
    },
    //砲台と、弾の名前の一覧(bossDebug.drawTag から)
    drawLab:function(){
        var x = this.labX, y = 70;
        ctx.fillStyle = "#334";
        ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "#c33";
        ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
        var cur = this.labIndex();
        var rows = this.labRows(), hover = inputMode == "mouse" ? this.labRowAt(MouseX,MouseY) : null;
        //一覧の板(押せるとわかるように)
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(4, LAB_LIST_Y - 4, LAB_LIST_W + 8, rows.length*LAB_ROW_H + 8);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        for(var j=0; j<rows.length; j++){
            var R = rows[j], i = R.i, cy = R.y + R.h/2;
            var on = i < 0 ? this.labPick < 0 : i == cur;
            if(hover && hover.i == i){
                ctx.fillStyle = "rgba(204,51,51,0.12)";
                ctx.fillRect(R.x, R.y, R.w, R.h);
            }
            if(i < 0){
                ctx.font = "bold 12px sans-serif";
                ctx.fillStyle = on ? "#c33" : "#555";
                ctx.fillText((on ? "☑ " : "☐ ") + "自動で順番に(" + SHOT_LAB_SEC + "秒ずつ)", R.x + 6, cy);
                continue;
            }
            var L = this.list[i];
            ctx.font = on ? "bold 13px sans-serif" : "12px sans-serif";
            ctx.fillStyle = on ? "#c33" : "rgba(0,0,0,0.6)";
            ctx.fillText((on ? "▶ " : "　") + L.name, R.x + 6, cy);
        }
        //選んでいる攻撃の説明は一覧の下に
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#c33";
        ctx.fillText(this.list[cur].note, 10, LAB_LIST_Y + rows.length*LAB_ROW_H + 14);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#666";
        ctx.fillText("一覧を押すと、その攻撃を繰り返します", 10, LAB_LIST_Y + rows.length*LAB_ROW_H + 32);
    }
};
