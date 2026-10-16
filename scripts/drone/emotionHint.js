//------------------------------------------------------------------------------
//  感情を「暗喩」で表す攻撃の試作(emotion.js の、はっきり見せる試作とは別)。
//  感情の名前・涙・赤・顔・叫びのような、ひと目でわかる記号は使わない。動き・間・音の抜け方・遊び方で表し、
//  遊ぶ人が気付くか気付かないか、言われてみればそんな感じだった、と思うくらいをねらう。
//  片割れ(悲しみ)：2つの光が寄り添って回り、かけ合いで撃つ(2つの音で1つの旋律)。ある時、片方が何も起きずに薄れて消える。
//        残った方は相方の番になると黙り(休符)、誰もいない所を中心に回り続ける。相方の弾がなくなった側が、よけられる隙間になる。
//        ときどき、相方のいた所から、遅れて1つだけ弾が出る。やがて回るのをやめ、まんなかで止まる。曲は少しずつ鈍くなる。
//  張りつめる(怒り)：撃たれるたびに余裕をなくす的。輪の弾 → 狙う弾、丸 → 角ばった弾、ゆったり → 近づいて行き過ぎる。
//        限界を超えると一気に吐き出し、そのあと少し黙って離れる。離れて撃たなければ落ち着く。曲がわずかに速くなる。
//  ついてくる(恐怖)：ドローン君の通った道を、ほとんど見えない影が遅れてたどる。止まっていると追いつかれ、そこから弾がはじける。
//        予告線が出ても撃たないことがあり、予告なしに撃つこともある。曲の低い音が少しずつ抜けていく(足もとがなくなる)。
//  かろやか(喜び)：弾が下から2つ組で回りながら昇る。かすると跳ねて離れ、ときどき「やる気」を置いていく。
//        ドローン君の動きが少し軽くなり、画面がほんの少しあたたかくなり、曲がわずかに速くなる。
//  一覧で選んだときは、SHOT_LAB_SEC で切らずに続ける(流れが長いので)。協力プレイには対応していない。
//------------------------------------------------------------------------------
//片割れ
const LOSS_LEN       = 1560;   //ひと回りの長さ(フレーム)。終わるとまた2つから
const LOSS_BEAT      = 32;     //かけ合いの拍(フレーム)
const LOSS_R         = 46;     //2つが回る半径(px)
const LOSS_SPIN      = 0.022;  //回る速さ(ラジアン/フレーム。ひとりになると LOSS_SPIN_END まで遅くなる)
const LOSS_SPIN_END  = 0.007;
const LOSS_GONE_AT   = 540;    //片方が薄れ始める時刻(フレーム)
const LOSS_FADE      = 120;    //薄れて消えるまで(フレーム)
const LOSS_ECHO      = [960, 1280];    //相方のいた所から、遅れて弾が出る間(フレーム)
const LOSS_STILL_AT  = 1300;   //回るのをやめ、まんなかへ寄って止まる時刻(フレーム)
const LOSS_FAN       = 4;      //1回に撃つ弾の数(2つ合わせて、ドローン君の前をふさぐ)
const LOSS_FAN_GAP   = 0.16;   //扇の弾の間(ラジアン)
const LOSS_SPEED     = 2.2;    //弾の速さ(danmaku() を掛ける)
const LOSS_BGM_CUT   = 3200;   //ひとりになってから、曲を少しずつ鈍くする周波数(Hz)
const LOSS_NOTES     = [[67,71], [69,72], [67,74], [64,72]];  //かけ合いの音(片方, もう片方)。2つで1つの旋律
//張りつめる
const TENSE_HIT_ADD  = 0.022;  //撃たれたコマごとに、張りつめが増える
const TENSE_COOL     = 0.0025; //張りつめが1フレームごとに引く
const TENSE_SNAP     = 0.92;   //ここを超えると一気に吐き出す
const TENSE_SNAP_N   = 14;     //吐き出す弾の数(一列につづけて)
const TENSE_AFTER    = 0.45;   //吐き出したあとの張りつめ
const TENSE_QUIET    = 80;     //吐き出したあと黙る長さ(フレーム)
const TENSE_EVERY    = [70, 14];   //撃つ間隔(落ち着いているとき, いちばん張りつめたとき)
const TENSE_SPEED    = [1.5, 4.6]; //弾の速さ(同じく。danmaku() を掛ける)
const TENSE_BPM      = 0.15;   //いちばん張りつめたとき、曲の速さを何割上げるか
const TENSE_HP       = 40;     //的の体力の倍率(試作では減らないが、当たり方の見た目に使う)
//ついてくる
const FOLLOW_DELAY   = 150;    //影がたどる遅れ(フレーム)。追いつかれると戻る
const FOLLOW_CREEP   = 0.05;   //遅れが1フレームごとに縮む(だんだん近くなる)
const FOLLOW_TOUCH   = 20;     //影が追いついたとみなす距離(px)
const FOLLOW_BURST_N = 10;     //追いつかれたときに、影からはじける弾の数
const FOLLOW_EVERY   = 55;     //砲台が撃つかどうかを決める間隔(フレーム)
const FOLLOW_WARN    = 40;     //予告線の長さ(フレーム)
const FOLLOW_FALSE   = 0.5;    //予告線のあと撃たない割合
const FOLLOW_HP_CUT  = 650;    //曲の低い音を抜く周波数(Hz。少しずつここまで)
//かろやか
const LIGHT_EVERY    = 34;     //2つ組の弾が昇ってくる間隔(フレーム)
const LIGHT_RISE     = [1.0, 1.6]; //昇る速さ(px/フレーム)
const LIGHT_PAIR_R   = 10;     //2つ組が回る半径(px)
const LIGHT_PAIR_SPIN = 0.11;  //2つ組の回る速さ(ラジアン/フレーム)
const LIGHT_HOP      = 3.2;    //かすったときに跳ねる速さ
const LIGHT_GIFT     = 0.25;   //かすったとき「やる気」を置いていく割合
const LIGHT_EASE     = 0.72;   //ドローン君の付いていく遅れに掛ける(軽くなる)
const LIGHT_WARM     = 0.07;   //画面のあたたかさ(いちばん強いとき。気付かないくらい)
const LIGHT_BPM      = 0.05;   //曲の速さを何割上げるか
const LIGHT_SCALE    = [72,74,76,79,81,84];  //昇ってくるときの小さな音(5音の音階)

SHOT_KINDS.h_orb   = { r:5 };      //片割れの弾(やわらかい丸。撃った光の色)
SHOT_KINDS.h_shard = { r:5 };      //張りつめるの弾(張りつめるほど角が少なくなる)
SHOT_KINDS.h_float = { r:4.5 };    //かろやかの弾(2つ組で回りながら昇る)

var hint = {
    cur:null,       //いま出ている試作 { id:"h_loss"|"h_tense"|"h_follow"|"h_light", t, … }
    base:null,      //始めたときの曲の速さ(戻すため)
    ids:["h_loss", "h_tense", "h_follow", "h_light"],

    start:function(_id){
        this.clear();
        this.base = sound.bpm;
        var c = { id:_id, t:0 };
        if(_id == "h_loss") c.th = 0;
        if(_id == "h_tense") c.e = this.tenseEnemy();
        if(_id == "h_follow"){ c.path = []; c.delay = FOLLOW_DELAY; c.fx = drone.X; c.fy = drone.Y; c.warn = null; c.near = 0; }
        if(_id == "h_light") c.warm = 0;
        this.cur = c;
        return c;
    },
    clear:function(){
        var C = this.cur;
        if(!C) return;
        if(C.e) C.e.dead = true;
        this.cur = null;
        //曲の速さ・こもり・低い音の抜けを戻す
        if(this.base) sound.bpm = this.base;
        if(sound.bgmFilter){ sound.bgmFilter.type = "lowpass"; sound.timeWarp(false); }
    },
    //一覧で選んで見ているときは、SHOT_LAB_SEC ごとの片付け(shotLab.labStep の中の clear)で止めない
    inLab:false,
    keep:function(){
        var C = this.cur;
        return !!(C && this.inLab && bossDebug.lab && shotLab.labPick >= 0 && shotLab.list[shotLab.labPick].id == C.id);
    },
    //曲をこもらせる・低い音を抜く(_type "lowpass"|"highpass"。_f：周波数)
    filter:function(_type,_f,_sec){
        if(!sound.ctx || !sound.bgmFilter) return;
        var F = sound.bgmFilter, t = sound.ctx.currentTime;
        if(F.type != _type){ F.type = _type; F.frequency.cancelScheduledValues(t); F.frequency.setValueAtTime(_type == "highpass" ? 20 : 20000, t); }
        F.frequency.setTargetAtTime(_f, t, _sec || 2);
    },
    //やわらかい音(_vol は小さめ。気付かないくらいで鳴らす)
    tone:function(_midi,_vol,_type,_len){
        if(!emoSfx.ok()) return;
        var c = emoSfx.rig(), f = sound.freq(_midi);
        emoSfx.osc(_type || "sine", f, f, c.currentTime, _len || 0.6, _vol, true, 0);
    },

    //------------------------------------------------------------ 動き(shotLab.update から)
    update:function(){
        if(coop.isGuest() || !this.cur) return;
        var C = this.cur;
        if(C.id == "h_loss") this.lossStep(C);
        if(C.id == "h_tense") this.tenseStep(C);
        if(C.id == "h_follow") this.followStep(C);
        if(C.id == "h_light") this.lightStep(C);
        C.t++;
    },

    //片割れ：2つの光の位置(_i 0 残る方、1 去る方)
    lossPos:function(C,_i){
        var cx = CW/2 + Math.sin(C.t*0.004)*200, cy = 130 + Math.sin(C.t*0.006)*30;
        if(C.t >= LOSS_STILL_AT){
            //回るのをやめ、ふたりで回っていたまんなかへ寄って止まる
            var k = Math.min(1, (C.t - LOSS_STILL_AT)/120);
            C.sx = C.sx != null ? C.sx : cx; C.sy = C.sy != null ? C.sy : cy;
            var a = C.th + _i*Math.PI;
            return { x:C.sx + Math.cos(a)*LOSS_R*(1 - k), y:C.sy + Math.sin(a)*LOSS_R*0.6*(1 - k) };
        }
        var a = C.th + _i*Math.PI;
        return { x:cx + Math.cos(a)*LOSS_R, y:cy + Math.sin(a)*LOSS_R*0.6 };
    },
    //去る方の濃さ(1 → 0)
    lossAlpha:function(C){
        return Math.max(0, Math.min(1, 1 - (C.t - LOSS_GONE_AT)/LOSS_FADE));
    },
    lossStep:function(C){
        var t = C.t, m = danmaku();
        this.lossEcho(C);
        if(t >= LOSS_LEN){ C.t = 0; C.th = 0; C.sx = C.sy = null; this.filter("lowpass", 20000, 1); return; }
        var alone = t >= LOSS_GONE_AT;
        var spin = alone ? LOSS_SPIN + (LOSS_SPIN_END - LOSS_SPIN)*Math.min(1, (t - LOSS_GONE_AT)/600) : LOSS_SPIN;
        C.th += spin;
        if(t == LOSS_GONE_AT + LOSS_FADE) this.filter("lowpass", LOSS_BGM_CUT, 8);
        if(t >= LOSS_STILL_AT || t < 30) return;     //止まってから・現れた直後は撃たない
        if(t % LOSS_BEAT != 0) return;
        var n = Math.floor(t/LOSS_BEAT), who = n % 2, note = LOSS_NOTES[Math.floor(n/2) % LOSS_NOTES.length][who];
        //去る方の番：薄れ始めたら、もう応えない(何も鳴らない拍)
        if(who == 1 && t >= LOSS_GONE_AT){
            //ときどき、相方のいた所から、遅れて1つだけ(拍からずれて、少し低く小さく)
            if(t >= LOSS_ECHO[0] && t < LOSS_ECHO[1] && n % 8 == 3) C.echo = 14;
            return;
        }
        var p = this.lossPos(C, who), tg = nearestPlayer(p.x, p.y), aim = Math.atan2(tg.Y - p.y, tg.X - p.x);
        //2つの扇でひとつの壁：残る方は左側、去る方は右側をふさぐ
        var side = who ? 1 : -1;
        for(var i=0; i<LOSS_FAN; i++) shotLab.fire(p.x, p.y, aim + side*(i + 0.5)*LOSS_FAN_GAP, LOSS_SPEED*m, "h_orb", { who:who });
        this.tone(note, 0.07, "triangle", 0.7);
    },
    //遅れて出る1つ(lossStep の拍とは別に数える)
    lossEcho:function(C){
        if(!(C.echo > 0) || --C.echo > 0) return;
        var p = this.lossPos(C, 1), tg = nearestPlayer(p.x, p.y);
        shotLab.fire(p.x, p.y, Math.atan2(tg.Y - p.y, tg.X - p.x), LOSS_SPEED*danmaku()*0.6, "h_orb", { who:1, faint:true });
        this.tone(LOSS_NOTES[0][1] - 1, 0.025, "sine", 1.2);
    },

    //張りつめる：的(本物の敵。装備の弾が当たる。試作では体力は減らない)
    tenseEnemy:function(){
        var e = makeEnemy("spinner");
        e.x = CW/2; e.y = 110; e.vx = 0; e.vy = 0;
        e.hp = e.maxHp = e.maxHp*TENSE_HP;
        e.score = 0; e.parts = 0;
        e.harmless = true;      //体当たりはしない
        e.lab = bossDebug.lab; e.labId = "h_tense";
        e.hint = { ag:0, cd:40, quiet:0, snap:0, spin:0, tx:CW/2, ty:110, burst:0 };
        enemies.push(e);
        return e;
    },
    tenseStep:function(C){
        var e = C.e;
        if(!e || e.dead || enemies.indexOf(e) < 0){ e = C.e = this.tenseEnemy(); }
        var H = e.hint, m = danmaku();
        if(e.flash > 0) e.flash--;      //ふつうの敵の動き(mainScreen.updateEnemies)を通らないので、被弾の光はここで消す
        //撃たれたか(体力が減っていたら張りつめる。体力は戻す)
        if(e.hp < e.maxHp){ H.ag = Math.min(1, H.ag + TENSE_HIT_ADD); e.hp = e.maxHp; }
        H.ag = Math.max(0, H.ag - TENSE_COOL);
        var ag = H.ag;
        //動き：落ち着いているとゆったり漂う。張りつめるほどドローン君へ寄り、行き過ぎては戻る(ばねがゆるい)
        var tg = nearestPlayer(e.x, e.y);
        if(H.quiet > 0){
            H.quiet--;
            H.tx = e.x < CW/2 ? 120 : CW - 120; H.ty = 80;     //吐き出したあとは離れる
        }else{
            var wx = CW/2 + Math.sin(C.t*0.006)*260, wy = 110 + Math.sin(C.t*0.011)*30;
            H.tx = wx + (tg.X - wx)*ag*0.9; H.ty = wy + (Math.max(80, tg.Y - 170) - wy)*ag;
        }
        var acc = 0.0015 + 0.02*ag, damp = 0.93 - 0.1*ag;
        e.vx = e.vx*damp + (H.tx - e.x)*acc;
        e.vy = e.vy*damp + (H.ty - e.y)*acc;
        e.x += e.vx; e.y += e.vy;
        e.x = Math.max(30, Math.min(CW - 30, e.x)); e.y = Math.max(30, Math.min(CH - 120, e.y));
        H.spin += 0.01 + 0.08*ag;
        sound.bpm = this.base*(1 + TENSE_BPM*ag);
        //一気に吐き出す(一列につづけて)
        if(H.burst > 0){
            H.burst--;
            if(H.burst % 2 == 0){
                shotLab.fire(e.x, e.y, Math.atan2(tg.Y - e.y, tg.X - e.x), TENSE_SPEED[1]*1.15*m, "h_shard", { sides:3 });
                this.tone(84 + (H.burst % 4), 0.03, "square", 0.05);
            }
            return;
        }
        if(ag >= TENSE_SNAP){ H.burst = TENSE_SNAP_N*2; H.ag = TENSE_AFTER; H.quiet = TENSE_QUIET + TENSE_SNAP_N*2; return; }
        if(H.quiet > 0) return;
        if(--H.cd > 0) return;
        H.cd = Math.round(TENSE_EVERY[0] + (TENSE_EVERY[1] - TENSE_EVERY[0])*ag);
        var sides = this.tenseSides(ag), sp = (TENSE_SPEED[0] + (TENSE_SPEED[1] - TENSE_SPEED[0])*ag)*m;
        if(ag < 0.3){
            //落ち着いている：ゆっくり回る輪(狙わない)
            for(var i=0; i<10; i++) shotLab.fire(e.x, e.y, H.spin + i*Math.PI/5, sp, "h_shard", { sides:sides });
            this.tone(60, 0.05, "sine", 0.4);
        }else{
            //張りつめている：狙う扇。張りつめるほど狭く速く
            var aim = Math.atan2(tg.Y - e.y, tg.X - e.x), n = ag < 0.6 ? 5 : 3, gap = 0.45 - 0.33*ag;
            for(var i=0; i<n; i++) shotLab.fire(e.x, e.y, aim + (i - (n - 1)/2)*gap, sp, "h_shard", { sides:sides });
            this.tone(62 + Math.round(ag*10), 0.05, ag > 0.6 ? "square" : "triangle", 0.12);
        }
    },
    //張りつめるほど角が少なく(0 は丸)
    tenseSides:function(_ag){ return _ag < 0.2 ? 0 : _ag < 0.45 ? 6 : _ag < 0.7 ? 4 : 3; },

    //ついてくる
    followStep:function(C){
        var m = danmaku();
        C.path.push({ x:drone.X, y:drone.Y });
        if(C.path.length > FOLLOW_DELAY + 10) C.path.shift();
        C.delay = Math.max(30, C.delay - FOLLOW_CREEP);
        var i = Math.max(0, C.path.length - 1 - Math.round(C.delay));
        C.fx = C.path[i].x; C.fy = C.path[i].y;
        var d = Math.hypot(C.fx - drone.X, C.fy - drone.Y);
        C.near = Math.max(0, 1 - d/200);
        //追いつかれた：影からはじけて、また遅れ直す(音はほとんどしない)
        if(d < FOLLOW_TOUCH && C.path.length > 60){
            var a0 = Math.random()*Math.PI*2;
            for(var k=0; k<FOLLOW_BURST_N; k++) fireShot(C.fx + Math.cos(a0 + k*Math.PI*2/FOLLOW_BURST_N)*40, C.fy + Math.sin(a0 + k*Math.PI*2/FOLLOW_BURST_N)*40, a0 + k*Math.PI*2/FOLLOW_BURST_N + Math.PI, 1.2*m, "small");
            C.delay = FOLLOW_DELAY;
            C.path = C.path.slice(-1);
            C.bursts = (C.bursts || 0) + 1;
            if(emoSfx.ok()){ var c = emoSfx.rig(); emoSfx.osc("sine", 50, 38, c.currentTime, 0.3, 0.25, true, 0); }
        }
        //近いと、低い息のような音がかすかに
        if(C.near > 0.3 && C.t % 50 == 0 && emoSfx.ok()){ var c = emoSfx.rig(); emoSfx.noise("bandpass", 260, 200, c.currentTime, 0.6, 0.05*C.near, true); }
        //曲の低い音を少しずつ抜く
        if(C.t == 30) this.filter("highpass", FOLLOW_HP_CUT, 12);
        //砲台：予告線を出して撃つ・出しても撃たない・出さずに撃つ
        var x = shotLab.labX, y = 70;
        if(C.warn){
            if(++C.warn.t >= FOLLOW_WARN){
                if(C.warn.real){ fireFan(x, y, C.warn.ang, 3, 0.08, 3.2*m, "normal"); sound.play("enemyShot"); }
                C.warn = null;
            }
        }else if(C.t % FOLLOW_EVERY == 0 && C.t > 40){
            var tg = nearestPlayer(x, y), ang = Math.atan2(tg.Y - y, tg.X - x);
            if(Math.random() < 0.6) C.warn = { t:0, ang:ang, real:Math.random() >= FOLLOW_FALSE };
            else{ fireFan(x, y, ang, 3, 0.2, 2.4*m, "normal"); sound.play("enemyShot"); }
        }
    },

    //かろやか
    lightStep:function(C){
        C.warm = Math.min(1, C.t/900);
        sound.bpm = this.base*(1 + LIGHT_BPM*Math.min(1, C.t/600));
        if(C.t % LIGHT_EVERY == 0){
            var n = Math.random() < 0.4 ? 2 : 1;
            for(var i=0; i<n; i++){
                var x = Math.max(30, Math.min(CW - 30, drone.X + (Math.random() - 0.5)*500));
                var vy = -(LIGHT_RISE[0] + Math.random()*(LIGHT_RISE[1] - LIGHT_RISE[0])), ph = Math.random()*Math.PI*2, sway = Math.random()*6;
                for(var k=0; k<2; k++) shotLab.fire(x, CH + 14, -Math.PI/2, 0.1, "h_float", { cx:x, cy:CH + 14, rise:vy, ph:ph + k*Math.PI, sway:sway, free:false });
            }
            if(Math.random() < 0.5) this.tone(LIGHT_SCALE[Math.floor(Math.random()*LIGHT_SCALE.length)], 0.025, "sine", 0.5);
        }
    },

    //------------------------------------------------------------ 試作の弾の動き(shotLab.step から)。null ならここの弾ではない
    step:function(b){
        if(b.t == null || coop.isGuest()) return null;
        switch(b.kind){
            case "h_orb":
                b.t++;
                return false;
            case "h_shard":
                b.t++;
                return false;
            case "h_float":
                b.t++;
                if(!b.free){
                    if(b.grazed){
                        //かすった：ぴょんと跳ねて離れる(ときどき「やる気」を置いていく)
                        b.free = true;
                        var a = Math.atan2(b.y - drone.Y, b.x - drone.X);
                        b.vx = Math.cos(a)*LIGHT_HOP; b.vy = Math.sin(a)*LIGHT_HOP - 1;
                        if(Math.random() < LIGHT_GIFT) mainScreen.drop("yaruki", b.x, b.y);
                        hint.tone(LIGHT_SCALE[Math.floor(Math.random()*LIGHT_SCALE.length)] + 12, 0.04, "sine", 0.3);
                        return false;
                    }
                    //2つ組で回りながら、ゆらゆら昇る(次の位置へ向かう速さにする)
                    b.cy += b.rise;
                    b.cx += Math.sin(b.t*0.03 + b.sway)*0.5;
                    b.ph += LIGHT_PAIR_SPIN;
                    b.vx = b.cx + Math.cos(b.ph)*LIGHT_PAIR_R - b.x;
                    b.vy = b.cy + Math.sin(b.ph)*LIGHT_PAIR_R*0.7 - b.y;
                }else{
                    b.vx *= 0.96; b.vy = b.vy*0.96 - 0.04;
                }
                return false;
        }
        return null;
    },
    //------------------------------------------------------------ 絵
    draw:function(b){
        switch(b.kind){
            case "h_orb":
                //やわらかい丸(撃った光の色。遅れて出た1つは薄い)
                var r = b.r || 5, A = b.faint ? 0.55 : 1;
                ctx.fillStyle = b.who ? "rgba(200,190,235," + A + ")" : "rgba(245,215,160," + A + ")";
                ctx.strokeStyle = b.who ? "rgba(90,80,140," + A + ")" : "rgba(140,100,40," + A + ")"; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(b.x, b.y, r + 1, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = "rgba(255,255,255," + (0.85*A) + ")";
                ctx.beginPath(); ctx.arc(b.x, b.y, r*0.45, 0, Math.PI*2); ctx.fill();
                ctx.lineWidth = 1;
                return true;
            case "h_shard":
                this.poly(b.x, b.y, (b.r || 5) + 1.5, b.sides || 0, Math.atan2(b.vy, b.vx), "#c8ccd4", "#3a4050");
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI*2); ctx.fill();
                return true;
            case "h_float":
                ctx.fillStyle = "rgba(255,250,235,0.95)"; ctx.strokeStyle = "#7a5a2a"; ctx.lineWidth = 1.8;
                ctx.beginPath(); ctx.arc(b.x, b.y, (b.r || 4.5) + 0.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.lineWidth = 1;
                return true;
        }
        return false;
    },
    //角の数 _n の形(0 は丸)
    poly:function(_x,_y,_r,_n,_rot,_fill,_line){
        ctx.fillStyle = _fill; ctx.strokeStyle = _line; ctx.lineWidth = 2;
        ctx.beginPath();
        if(_n < 3) ctx.arc(_x, _y, _r, 0, Math.PI*2);
        else for(var i=0; i<_n; i++){ var a = _rot + i*Math.PI*2/_n; ctx.lineTo(_x + Math.cos(a)*_r*1.15, _y + Math.sin(a)*_r*1.15); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1;
    },
    //弾の下(光・影・予告線)
    drawUnder:function(){
        var C = this.cur;
        if(!C) return;
        if(C.id == "h_loss"){
            for(var i=0; i<2; i++){
                var A = i ? this.lossAlpha(C) : 1;
                if(C.t < 30) A *= C.t/30;
                if(A <= 0.01) continue;
                var p = this.lossPos(C, i);
                ctx.fillStyle = i ? "rgba(200,190,235," + (0.25*A) + ")" : "rgba(245,215,160," + (0.25*A) + ")";
                ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = i ? "rgba(225,218,250," + A + ")" : "rgba(255,236,200," + A + ")";
                ctx.strokeStyle = i ? "rgba(90,80,140," + A + ")" : "rgba(140,100,40," + A + ")"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.lineWidth = 1;
            }
        }
        if(C.id == "h_follow"){
            //影：ほとんど見えない、にじんだ暗がり(近いほどわずかに濃い)
            for(var k=0; k<3; k++){
                ctx.fillStyle = "rgba(20,20,30," + (0.035 + 0.05*C.near) + ")";
                ctx.beginPath(); ctx.arc(C.fx + Math.sin(C.t*0.07 + k*2)*3, C.fy + Math.cos(C.t*0.05 + k*2)*3, 16 + k*6, 0, Math.PI*2); ctx.fill();
            }
            if(C.warn){
                var x = shotLab.labX, y = 70;
                ctx.strokeStyle = "rgba(60,60,70," + (0.15 + 0.3*C.warn.t/FOLLOW_WARN) + ")"; ctx.lineWidth = 1;
                ctx.setLineDash([4, 6]);
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(C.warn.ang)*1100, y + Math.sin(C.warn.ang)*1100); ctx.stroke();
                ctx.setLineDash([]);
            }
            //砲台
            ctx.fillStyle = "#334";
            ctx.beginPath(); ctx.arc(shotLab.labX, 70, 14, 0, Math.PI*2); ctx.fill();
        }
    },
    //張りつめるの的の絵(shotLab.drawEnemy から)。描いたなら true
    drawEnemy:function(e){
        if(!e.hint) return false;
        var H = e.hint, ag = H.ag, sides = this.tenseSides(ag);
        var jx = (Math.random() - 0.5)*ag*2, jy = (Math.random() - 0.5)*ag*2;    //張りつめるとわずかに震える
        this.poly(e.x + jx, e.y + jy, 20, sides, H.spin, e.flash > 0 ? "#fff" : "#9aa0ac", "#2a2e38");
        //中の輪は、張りつめるほど小さく固くなる
        ctx.strokeStyle = "#2a2e38"; ctx.lineWidth = 1.5 + 2*ag;
        ctx.beginPath(); ctx.arc(e.x + jx, e.y + jy, 9 - 5*ag, 0, Math.PI*2); ctx.stroke();
        ctx.lineWidth = 1;
        return true;
    },
    //いちばん手前(かろやかのあたたかさ)
    drawFront:function(){
        var C = this.cur;
        if(!C || C.id != "h_light" || C.warm <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "rgba(255,0,0," + (0.15*C.warm) + ")";
        ctx.fillRect(0, 0, CW, CH);
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255,225,170," + (LIGHT_WARM*C.warm) + ")";
        ctx.fillRect(0, 0, CW, CH);
        ctx.restore();
    },
    //かろやかの間は、ドローン君が少し軽く動く
    steer:function(d,T){
        if(this.cur && this.cur.id == "h_light" && mainScreen.state != "over") T.d = T.d*LIGHT_EASE;
    },
    //デバッグの「攻撃の試作」から
    labStep:function(_id,_T){
        if(this.ids.indexOf(_id) < 0) return;
        if(_T >= 40 && (!this.cur || this.cur.id != _id)) this.start(_id);
    }
};

//shotLab を包んで足す
(function(){
    shotLab.list.push(
        { id:"h_loss",   name:"暗喩：片割れ",     note:"(悲しみ)2つのかけ合いから片方が消える。残った方は相方の番に黙り、空いた所を回る" },
        { id:"h_tense",  name:"暗喩：張りつめる", note:"(怒り)撃つほど余裕をなくし、限界で吐き出す。離れて撃たなければ落ち着く" },
        { id:"h_follow", name:"暗喩：ついてくる", note:"(恐怖)通った道を見えにくい影がたどる。止まると追いつかれる。曲の低音が抜けていく" },
        { id:"h_light",  name:"暗喩：かろやか",   note:"(喜び)2つ組で昇る弾。かすると跳ねて、ときどき贈り物。動きが少し軽くなる" }
    );
    var labStep0 = shotLab.labStep;
    shotLab.labStep = function(){
        hint.inLab = true;
        try{ var r = labStep0.apply(this, arguments); }finally{ hint.inLab = false; }
        var T = (this.labT - 1) % (SHOT_LAB_SEC*60);
        hint.labStep(this.list[this.labIndex()].id, T);
        return r;
    };
    var drawLab0 = shotLab.drawLab;
    shotLab.drawLab = function(){
        var id = this.list[this.labIndex()].id, x = this.labX;
        if(hint.ids.indexOf(id) >= 0) this.labX = -999;     //砲台は自分で描く(ついてくる)か、描かない
        var r = drawLab0.apply(this, arguments);
        this.labX = x;
        return r;
    };
    var clear0 = shotLab.clear;
    shotLab.clear = function(){ if(!hint.keep()) hint.clear(); return clear0.apply(this, arguments); };
    var update0 = shotLab.update;
    shotLab.update = function(){ var r = update0.apply(this, arguments); hint.update(); return r; };
    var steer0 = shotLab.steer;
    shotLab.steer = function(d,T){ var r = steer0.apply(this, arguments); hint.steer(d,T); return r; };
    var step0 = shotLab.step;
    shotLab.step = function(b){
        var r = hint.step(b);
        if(r !== null) return r;
        return step0.apply(this, arguments);
    };
    var draw0 = shotLab.draw;
    shotLab.draw = function(b){
        if(hint.draw(b)) return true;
        return draw0.apply(this, arguments);
    };
    var under0 = shotLab.drawUnder;
    shotLab.drawUnder = function(){ var r = under0.apply(this, arguments); hint.drawUnder(); return r; };
    var front0 = shotLab.drawFront;
    shotLab.drawFront = function(){ hint.drawFront(); return front0.apply(this, arguments); };
    var enemyStep0 = shotLab.enemyStep;
    shotLab.enemyStep = function(e){ if(e.hint) return true; return enemyStep0.apply(this, arguments); };
    var drawEnemy0 = shotLab.drawEnemy;
    shotLab.drawEnemy = function(e){ if(hint.drawEnemy(e)) return true; return drawEnemy0.apply(this, arguments); };
})();
