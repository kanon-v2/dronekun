//------------------------------------------------------------------------------
//  中ボス：ライバル「クロノ」
//  ドローン君と同じ時止めワープ(timeStop.js)を使いこなすライバル。決まったWAVE(RIVAL_WAVES)の途中で現れ、会うたびに強くなる。
//  体が粒子にほどけて別の場所で組み上がるワープで、すばやく動き回る。
//  流れ：ワープで現れる → 横へ跳ねながら動き回る(idle) → ワープして攻撃 → …
//    ・狙い撃ち(shoot)：回り込んで、動き回りながら扇に撃つ
//    ・突進(aim → dash)：離れた場所へワープして構え、突っ込んでくる。ワープで回り込んで続けることもある。
//      女王蜂と同じく、ジャスト衝撃波で弾き返せる(special.parry → rival.parry)
//    ・幻影包囲(phantom)：短いワープでドローン君のまわりを跳び、止まった弾を置いていく。
//      時が止まったように見えるあいだ(hold)は隙。時が動き出すと、置いた弾がドローン君へ一斉に飛ぶ
//    ・攻撃の合間に削られすぎると、ワープでよける(RIVAL_DODGE)
//  体力が0になっても倒れず、捨てぜりふを残してワープで去る(撃退。報酬カプセルとパーツを落とす)。
//  いる間は雑魚敵が出てこない(一騎打ち)。曲もライバルの曲になる。
//  ボスと同じく boss の印を持つ(衝撃波で飛ばされない・凍らない・上の体力ゲージ)。mid の印で中ボスと見分ける。
//  協力プレイ：ホストが動かし、ワープの出発点・長さは coop.packEnemy の b の12～14番目で届く
//------------------------------------------------------------------------------
const RIVAL_WAVES    = [3,8,13,18];     //出てくるWAVE(何番目かが強さの段階 Lv.1～4)
const RIVAL_AT       = 0.35;            //WAVEの雑魚敵がこの割合だけ出たところで現れる
const RIVAL          = { name:"クロノ", en:"CHRONO", title:"時を渡るライバル" };
const RIVAL_R        = 20;              //当たり判定の半径
const RIVAL_SCALE    = 1.3;             //絵の大きさ(ドローン君に対して)
const RIVAL_HP       = [32,58,76,96];    //体力(Lv.1～4。難易度・協力プレイの倍率を掛ける)
const RIVAL_TINT     = "35,60,115";     //体の色(紺)
const RIVAL_SCARF    = "#d8323c";       //ハチマキの色
const RIVAL_BAND_Y   = -1.2;            //ハチマキの高さ(体の中心から。絵の大きさを掛ける)
const RIVAL_BAND_W   = 18;              //ハチマキの幅の半分(絵の大きさを掛ける)
const RIVAL_INK      = "#1a1420";       //ふちどり
const RIVAL_WARP_T   = [40,34,30,26];   //ワープの長さ(フレーム。ほどけてから組み上がるまで。Lv.1～4)
const RIVAL_BLINK_T  = 18;              //幻影包囲・続けての突進の短いワープ
const RIVAL_DIST     = [170,240];       //ワープで現れるときのドローン君からの距離
const RIVAL_DASH_DIST = [250,320];      //突進の前にワープする距離
const RIVAL_REST     = [[100,75],[85,60],[70,50],[60,42]];  //攻撃のあと、次の攻撃まで(Lv.1～4。ふだん・本気)
const RIVAL_PATTERNS = [                //攻撃の順番(Lv.1～4)
    ["shoot","dash"],
    ["shoot","dash","phantom"],
    ["dash","phantom","shoot","dash"],
    ["phantom","dash","shoot","phantom","dash"]
];
const RIVAL_STRAFE   = 205;             //動き回るときのドローン君からの距離
const RIVAL_STEP_T   = [30,56];         //横へ跳ぶ間隔(フレーム)
const RIVAL_SPEED    = 7.5;             //動き回るときの最高の速さ(px/フレーム)
const RIVAL_SHOOT_T  = 80;              //狙い撃ちの長さ
const RIVAL_SHOOT_EVERY = [26,19];      //狙い撃ちの間隔(ふだん・本気)
const RIVAL_SHOOT_N  = [3,3,5,5];       //1回に撃つ弾の数(Lv.1～4)
const RIVAL_SHOT_SPEED = 3.4;           //狙い撃ちの弾の速さ(弾幕の倍率を掛ける)
const RIVAL_DASH_AIM = [28,46];         //突進の構えの長さ(最後の RIVAL_CUE で向きが固まる)
const RIVAL_CHAIN_AIM = [16,26];        //続けての突進の構えの長さ
const RIVAL_CUE      = 18;              //飛び出す直前の合図の長さ
const RIVAL_DASH_SPEED = 11;            //突進の速さ(px/フレーム)
const RIVAL_DASH_T   = 30;              //突進の長さ(フレーム。画面の端でも止まる)
const RIVAL_CHAIN    = [0,1,1,2];       //ワープで回り込んで続ける突進の回数(Lv.1～4)
const RIVAL_STAGGER  = 45;              //突進を弾かれてよろける時間
const RIVAL_PARRY_DMG = 0.08;           //突進を弾いたときのダメージ(体力に対する割合)
const RIVAL_PHANTOM_N = [3,3,4,5];      //幻影包囲で跳ぶ回数(Lv.1～4)
const RIVAL_PHANTOM_R = 160;            //幻影包囲で跳ぶ場所のドローン君からの距離
const RIVAL_PHANTOM_SHOTS = 5;          //1か所に置く弾の数
const RIVAL_HOLD_T   = 50;              //置いた弾が止まっている長さ(この間は隙)
const RIVAL_RELEASE_SPEED = 2.5;        //時が動き出したときの弾の速さ(弾幕の倍率を掛ける)
const RIVAL_DODGE    = 0.08;            //攻撃の合間にこの割合の体力を削られると、ワープでよける
const RIVAL_DODGE_CD = 180;             //よけたあと、次によけられるまで
const RIVAL_RAGE_HP  = 0.5;             //体力がこの割合を切ると本気になる(攻撃の合間が短い)
const RIVAL_FLEE_T   = 80;              //撃退されてから去るまで(最後の RIVAL_FLEE_OUT でほどけて消える)
const RIVAL_FLEE_OUT = 36;
const RIVAL_PARTS    = [8,10,12,14];    //撃退したときに落とすパーツ(難易度の倍率を掛ける。PARTS_DROP_MUL は掛けない)
const RIVAL_SCORE    = 500;             //撃退したときのスコア(Lv を掛ける)
const RIVAL_SAY_T    = 150;             //せりふを出している長さ
const RIVAL_LINES = [                   //せりふ(現れたとき・本気になったとき・去るとき)
    ["見つけたぞ、ドローン君！ 勝負だ！", "まだまだ！", "くっ…今日はここまでだ！"],
    ["また会ったな。今度は本気だ！", "やるじゃないか！", "まだ…追いつけないのか…！"],
    ["時の速さに、ついてこられるか？", "おもしろくなってきた！", "次こそは…必ず！"],
    ["これが最後の勝負だ、ドローン君！", "全力でいくぞ！", "…強くなったな、ドローン君"]
];
const RIVAL_CELL     = 3;               //ワープの粒子1つの大きさ(ゲームの px。ドローン君の WARP_CELL より粗く、軽く)

//------------------------------------------------------------------------------
//  ワープの粒子(timeStop.js と同じ描き方：今のコマを別のキャンバスへ写し、小さな四角を道すじの上に描く)
//------------------------------------------------------------------------------
var RivalWarp = function(_k){
    this.k = _k;
    this.box = Math.ceil(WARP_BOX*_k);
    this.snap = null;
    this.glow = null;
    this.rs = 1;
    this.parts = [];
    var n = Math.floor(this.box/RIVAL_CELL), R = WARP_BODY_R*_k;
    for(var j=0; j<n; j++){
        for(var i=0; i<n; i++){
            var ox = (i + 0.5)*RIVAL_CELL - this.box/2, oy = (j + 0.5)*RIVAL_CELL - this.box/2;
            if(Math.hypot(ox,oy) > R) continue;
            //上からほどけて、上から組み上がる(少しばらつかせる)
            var d = ((oy + R)/(R*2)*0.75 + Math.random()*0.25)*WARP_SPREAD;
            var a1 = Math.atan2(oy,ox) + (Math.random() - 0.5)*1.2, r1 = WARP_SCATTER*(0.4 + Math.random()*0.8);
            var a2 = Math.random()*Math.PI*2, r2 = WARP_SCATTER*(0.3 + Math.random()*0.9);
            this.parts.push({ ox:ox, oy:oy, d:d, sx:i*RIVAL_CELL, sy:j*RIVAL_CELL,
                              c1x:Math.cos(a1)*r1, c1y:Math.sin(a1)*r1, c2x:Math.cos(a2)*r2, c2y:Math.sin(a2)*r2 });
        }
    }
};
RivalWarp.prototype = {
    //今のコマを写し取る(ゲームと同じ描き方で、別のキャンバスへ)
    shoot:function(_look){
        var rs = renderScale, S = Math.ceil(this.box*rs);
        if(!this.snap){
            this.snap = document.createElement("canvas");
            this.glow = document.createElement("canvas");
        }
        this.snap.width = this.snap.height = S;
        this.glow.width = this.glow.height = S;
        this.rs = rs;
        var g = this.snap.getContext("2d");
        g.setTransform(rs,0,0,rs,0,0);
        //DroneLook.draw は全体の ctx に描くので、写す間だけ差し替える
        var keep = ctx;
        ctx = g;
        try{ _look.draw(this.box/2, this.box/2, this.k); }
        finally{ ctx = keep; }
        //光の形：同じ絵の上だけを光の色で塗る
        var h = this.glow.getContext("2d");
        h.drawImage(this.snap,0,0);
        h.globalCompositeOperation = "source-atop";
        h.fillStyle = "rgb(" + WARP_COLOR + ")";
        h.fillRect(0,0,S,S);
    },
    //粒子1つの位置(_u：0でほどける前、1で組み上がった後。_x1 が null のときは散って消える)
    pos:function(_p,_u,_x0,_y0,_x1,_y1){
        var fx = _x0 + _p.ox, fy = _y0 + _p.oy;
        if(_x1 == null){
            //散って消える：外へ広がりながら上へ流れる
            var s = 1 - (1 - _u)*(1 - _u);
            return { x:fx + _p.c1x*2.4*s, y:fy + _p.c1y*2.4*s - 30*s };
        }
        var tx = _x1 + _p.ox, ty = _y1 + _p.oy;
        if(_u <= 0) return { x:fx, y:fy };
        if(_u >= 1) return { x:tx, y:ty };
        var e = _u < 0.5 ? 2*_u*_u : 1 - 2*(1 - _u)*(1 - _u);
        var k = 1 - e;
        var x = k*k*k*fx + 3*k*k*e*(fx + _p.c1x) + 3*k*e*e*(tx + _p.c2x) + e*e*e*tx;
        var y = k*k*k*fy + 3*k*k*e*(fy + _p.c1y) + 3*k*e*e*(ty + _p.c2y) + e*e*e*ty;
        return { x:x, y:y };
    },
    //ほどけて飛び、組み上がる(_t：0～1 の進み具合)
    draw:function(_x0,_y0,_x1,_y1,_t){
        if(!this.snap) return;
        var rs = this.rs, c = RIVAL_CELL, cs = c*rs, list = this.parts, out = _x1 == null;
        ctx.save();
        for(var pass=0; pass<2; pass++){
            for(var i=0; i<list.length; i++){
                var p = list[i];
                var u = Math.max(0, Math.min(1, (_t - p.d)/(1 - WARP_SPREAD)));
                var q = this.pos(p,u,_x0,_y0,_x1,_y1);
                var w = out ? u : Math.sin(Math.PI*u);  //飛んでいる強さ
                if(pass == 0){
                    if(out && u >= 1) continue;
                    var sz = (u > 0 && u < 1) ? c*(1 + 0.8*w) : c + 0.5;
                    ctx.globalAlpha = out ? 1 - u : 1 - 0.5*w;
                    ctx.drawImage(this.snap, p.sx*rs, p.sy*rs, cs, cs, q.x - sz/2, q.y - sz/2, sz, sz);
                }else{
                    if(w <= 0 || (out && u >= 1)) continue;
                    var sz = c*(1.5 + 1.5*w);
                    ctx.globalAlpha = 0.9*(out ? w*(1 - u)*3 : w);
                    ctx.drawImage(this.glow, p.sx*rs, p.sy*rs, cs, cs, q.x - sz/2, q.y - sz/2, sz, sz);
                }
            }
        }
        ctx.restore();
    },
    //光る形だけを描く(残像・組み上がった直後の光)
    drawGlow:function(_x,_y,_a){
        if(!this.snap) return;
        var b = this.box, rs = this.rs;
        ctx.globalAlpha = _a;
        ctx.drawImage(this.glow, 0, 0, b*rs, b*rs, _x - b/2, _y - b/2, b, b);
        ctx.globalAlpha = 1;
    }
};

//------------------------------------------------------------------------------
//  動き(special.update から。動かすのはホストとひとり用だけ)
//------------------------------------------------------------------------------
var rival = {
    at:0,           //このWAVEで、雑魚敵がこの数だけ出たら現れる
    done:true,      //このWAVEではもう現れた(現れないWAVEも true)
    musicOn:false,  //ライバルの曲にしている

    //このWAVEの段階(0～3。出てこないWAVEは -1)
    level:function(_w){
        return RIVAL_WAVES.indexOf(_w == null ? game.wave : _w);
    },
    //WAVEの始め(mainScreen.enter から。雑魚敵の数が決まったあと)
    reset:function(){
        this.done = this.level() < 0 || bossDebug.trial;
        this.at = bossDebug.rival ? 0 : Math.max(1, Math.floor(mainScreen.toSpawn*RIVAL_AT));
        this.musicOn = false;
    },
    //戦っているライバル(撃退されて去っていくところは含まない)
    alive:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type == "chrono" && !e.dead && e.mode != "flee") return e;
        }
        return null;
    },
    //WAVEの途中で現れる(mainScreen.spawn から)。いる間は true(雑魚敵を出さない)
    check:function(){
        if(this.alive()) return true;
        if(this.done || mainScreen.spawned < this.at) return false;
        this.done = true;
        enemies.push(this.make());
        return true;
    },
    make:function(){
        var lv = Math.max(0, this.level());
        var hp = Math.round(RIVAL_HP[lv]*difficulty().hp)*coop.hpMul();
        var e = {
            id:++enemySeq,
            type:"chrono", boss:true, mid:true, lv:lv, name:RIVAL.name, r:RIVAL_R, hp:hp, maxHp:hp,
            score:RIVAL_SCORE*(lv + 1), parts:RIVAL_PARTS[lv],
            x:CW/2, y:-40, vx:0, vy:0, flash:0, timer:0, t:0, dead:false, slow:0, bladeCd:0,
            mode:"idle", count:0, enraged:false, aimX:0, aimY:1, angle:0,
            cycle:0,            //次の攻撃(RIVAL_PATTERNS の番号)
            chain:0,            //残りの続けての突進
            blinks:0,           //幻影包囲の残りの跳ぶ回数
            orbit:Math.random()*Math.PI*2, stepT:20,
            dodgeCd:RIVAL_DODGE_CD, hpMark:hp
        };
        e.look = new DroneLook();
        e.look.tint = RIVAL_TINT;
        //画面の上から、ほどけた光が集まって現れる
        aimAt = nearestPlayer(e.x, e.y);
        var p = this.spot(e, RIVAL_DIST);
        this.warp(e, p.x, p.y, RIVAL_WARP_T[0] + 20, "enter");
        e.wx0 = p.x; e.wy0 = -60;
        this.announce(lv);
        sound.play("timeStop");
        return e;
    },
    //現れたことを画面の上に出す
    announce:function(_lv){
        mainScreen.rareMsg = "ライバル「" + RIVAL.name + "」" + (_lv > 0 ? "が再び現れた！" : "出現！") + "　ワープで動き回る";
        mainScreen.rareMsgTime = 180;
    },
    //協力プレイのゲスト：届いた種類からライバルを作る(coop.guestSync から)
    guestInit:function(_e){
        _e.r = RIVAL_R;
        _e.boss = true;
        _e.mid = true;
        _e.name = RIVAL.name;
        _e.lv = Math.max(0, this.level());
        _e.look = new DroneLook();
        _e.look.tint = RIVAL_TINT;
        this.announce(_e.lv);
    },
    //ワープ中・去るところは当たらず、狙われない
    flags:function(_e){
        _e.harmless = _e.mode == "warp" || _e.mode == "flee";
        _e.phased = _e.harmless;
    },

    update:function(_e,_dx,_dy,_d){
        var rage = _e.enraged ? 1 : 0, lv = _e.lv;
        var play = mainScreen.state == "play";
        var toMe = Math.atan2(_dy,_dx);
        if(_e.dodgeCd > 0) _e.dodgeCd--;
        //体力が減ると本気になる
        if(!_e.enraged && _e.mode != "flee" && _e.hp < _e.maxHp*RIVAL_RAGE_HP){
            _e.enraged = true;
            fx.shake(8);
            sound.play("warning");
        }
        switch(_e.mode){
            case "warp":
                _e.vx = 0; _e.vy = 0;
                if(--_e.count <= 0) this.arrive(_e);
                break;
            case "idle":
                this.strafe(_e);
                if(--_e.timer <= 0 && play) this.nextAttack(_e);
                break;
            case "shoot":
                this.strafe(_e);
                if(_e.count % RIVAL_SHOOT_EVERY[rage] == 0 && play){
                    fireFan(_e.x, _e.y, toMe, RIVAL_SHOOT_N[lv], 0.2, RIVAL_SHOT_SPEED*Math.min(1.3,danmaku()), "normal");
                    sound.play("shot");
                }
                if(--_e.count <= 0) this.rest(_e);
                break;
            case "aim":
                //狙いを合わせ、合図(最後の RIVAL_CUE)で向きを固める
                _e.vx *= 0.8; _e.vy *= 0.8;
                if(_e.count > RIVAL_CUE){ _e.aimX = _dx/_d; _e.aimY = _dy/_d; }
                if(_e.count == RIVAL_CUE) sound.play("tell");
                if(--_e.count <= 0){ _e.mode = "dash"; _e.count = RIVAL_DASH_T; sound.play("dash"); }
                break;
            case "dash":
                _e.vx = _e.aimX*RIVAL_DASH_SPEED;
                _e.vy = _e.aimY*RIVAL_DASH_SPEED;
                if(_e.t % 2 == 0) effects.push({ x:_e.x, y:_e.y, vx:-_e.vx*0.1, vy:-_e.vy*0.1, life:14, maxLife:14, size:4, glow:WARP_COLOR });
                if(--_e.count <= 0 || _e.x < _e.r || _e.x > CW - _e.r || _e.y < 80 || _e.y > CH - _e.r){
                    _e.x = Math.max(_e.r, Math.min(_e.x, CW - _e.r));
                    _e.y = Math.max(80, Math.min(_e.y, CH - _e.r));
                    _e.vx = 0; _e.vy = 0;
                    if(_e.chain > 0){
                        //ワープで回り込んで、もう一度
                        _e.chain--;
                        var s = this.spot(_e, RIVAL_DASH_DIST);
                        this.warp(_e, s.x, s.y, RIVAL_BLINK_T, "chain");
                    }else{
                        this.rest(_e);
                    }
                }
                break;
            case "stagger":
                //弾かれてよろける(この間は隙)。終わるとワープで離れる
                _e.vx *= 0.88; _e.vy *= 0.88;
                if(--_e.count <= 0) this.escape(_e);
                break;
            case "hold":
                //時が止まったように、置いた弾が止まっている(この間は隙)。終わると一斉に飛ぶ
                _e.vx *= 0.85; _e.vy *= 0.85;
                if(--_e.count <= 0){
                    this.release(_e);
                    this.rest(_e);
                }
                break;
            case "flee":
                _e.vx *= 0.9; _e.vy *= 0.9;
                if(_e.count == RIVAL_FLEE_OUT) sound.play("warpOut");
                if(--_e.count <= 0) _e.dead = true;
                break;
        }
        //攻撃の合間に削られすぎると、ワープでよける
        if((_e.mode == "idle" || _e.mode == "shoot") && play && _e.dodgeCd <= 0 && _e.hpMark - _e.hp >= _e.maxHp*RIVAL_DODGE){
            _e.dodgeCd = RIVAL_DODGE_CD;
            popup(_e.x, _e.y - 40, "遅い！", "rgb(30,120,190)");
            this.escape(_e);
        }
        _e.look.update(dirFromVel(_e.vx,_e.vy), _e.vx, _e.vy);
        this.flags(_e);
    },
    //ドローン君のまわりを、横へ跳ねながら動き回る(ときどき向きを急に変える)
    strafe:function(_e){
        if(--_e.stepT <= 0){
            _e.stepT = randIn(RIVAL_STEP_T);
            _e.orbit += (Math.random() < 0.5 ? -1 : 1)*(0.6 + Math.random()*0.7);
        }
        var p = this.clamp(aimAt.X + Math.cos(_e.orbit)*RIVAL_STRAFE, aimAt.Y + Math.sin(_e.orbit)*RIVAL_STRAFE*0.75);
        var tx = (p.x - _e.x)*0.08, ty = (p.y - _e.y)*0.08, s = Math.hypot(tx,ty);
        if(s > RIVAL_SPEED){ tx *= RIVAL_SPEED/s; ty *= RIVAL_SPEED/s; }
        _e.vx += (tx - _e.vx)*0.18;
        _e.vy += (ty - _e.vy)*0.18;
    },
    //画面の中(上のHUDにはかからない)
    clamp:function(_x,_y){
        return { x:Math.max(60, Math.min(CW - 60, _x)), y:Math.max(100, Math.min(CH - 50, _y)) };
    },
    //ワープ先：ドローン君から _range の距離で、今いる場所から離れたところ
    spot:function(_e,_range){
        var best = null, bestScore = -1;
        for(var i=0; i<12; i++){
            var a = Math.random()*Math.PI*2, r = _range[0] + Math.random()*(_range[1] - _range[0]);
            var p = this.clamp(aimAt.X + Math.cos(a)*r, aimAt.Y + Math.sin(a)*r);
            var dm = Math.hypot(p.x - aimAt.X, p.y - aimAt.Y), dc = Math.hypot(p.x - _e.x, p.y - _e.y);
            //ドローン君からの距離が近いほど、今の場所から遠いほどよい
            var score = Math.min(1, dm/_range[0]) + Math.min(1, dc/200)*0.5;
            if(score > bestScore){ bestScore = score; best = p; }
        }
        return best;
    },
    //(_x,_y)へワープする(_t：長さ。_next：組み上がったあとにすること)
    warp:function(_e,_x,_y,_t,_next){
        _e.wx0 = _e.x; _e.wy0 = _e.y;
        _e.x = _x; _e.y = _y;
        _e.vx = 0; _e.vy = 0;
        _e.mode = "warp";
        _e.count = _e.wt = _t;
        _e.next = _next;
        _e.slow = 0; _e.wet = 0; _e.burn = 0; _e.frozen = 0;     //ワープで状態を振りほどく
        _e.hpMark = _e.hp;
        this.flags(_e);
        sound.play(_t > RIVAL_BLINK_T ? "warpOut" : "blink");
    },
    //よける・弾かれたあと：離れた場所へワープし、少し動き回ってから次の攻撃
    escape:function(_e){
        var s = this.spot(_e, RIVAL_DIST);
        this.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "idle");
    },
    //組み上がった
    arrive:function(_e){
        fx.ring(_e.x, _e.y, 56, WARP_COLOR, 16, 3);
        if(_e.wt > RIVAL_BLINK_T) sound.play("warpIn");
        switch(_e.next){
            case "enter":
                _e.mode = "idle";
                _e.timer = 70;
                break;
            case "idle":
                _e.mode = "idle";
                _e.timer = RIVAL_REST[_e.lv][_e.enraged ? 1 : 0];
                break;
            case "shoot":
                _e.mode = "shoot";
                _e.count = RIVAL_SHOOT_T;
                break;
            case "aim":
            case "chain":
                _e.mode = "aim";
                _e.count = randIn(_e.next == "chain" ? RIVAL_CHAIN_AIM : RIVAL_DASH_AIM) + RIVAL_CUE;
                var a = Math.atan2(aimAt.Y - _e.y, aimAt.X - _e.x);
                _e.aimX = Math.cos(a); _e.aimY = Math.sin(a);
                break;
            case "blink":
                //幻影包囲：止まった弾を置いていく。跳び終えたら、時が止まったまま隙を見せる
                this.plant(_e);
                if(--_e.blinks > 0) this.blink(_e);
                else{
                    _e.mode = "hold";
                    _e.count = RIVAL_HOLD_T;
                    sound.play("timeStop");
                }
                break;
        }
    },
    //攻撃を終えて動き回る
    rest:function(_e){
        _e.mode = "idle";
        _e.timer = RIVAL_REST[_e.lv][_e.enraged ? 1 : 0];
        _e.hpMark = _e.hp;
    },
    nextAttack:function(_e){
        var list = RIVAL_PATTERNS[_e.lv], p = list[_e.cycle++ % list.length];
        if(p == "shoot"){
            var s = this.spot(_e, RIVAL_DIST);
            this.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "shoot");
        }else if(p == "dash"){
            _e.chain = RIVAL_CHAIN[_e.lv];
            var s = this.spot(_e, RIVAL_DASH_DIST);
            this.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "aim");
        }else{
            //幻影包囲：今のドローン君の位置を囲むように跳ぶ
            _e.blinks = RIVAL_PHANTOM_N[_e.lv];
            _e.pa = Math.random()*Math.PI*2;
            _e.pcx = aimAt.X; _e.pcy = aimAt.Y;
            _e.pi = 0;
            this.blink(_e);
        }
    },
    //幻影包囲の次の場所へ短くワープ(囲む円の上を、ドローン君の向こう側へ飛び越えるように跳ぶ)
    blink:function(_e){
        var n = RIVAL_PHANTOM_N[_e.lv], k = _e.pi++;
        var idx = n == 4 ? [0,2,1,3][k] : (k*2) % n;
        var a = _e.pa + idx*Math.PI*2/n;
        var p = this.clamp(_e.pcx + Math.cos(a)*RIVAL_PHANTOM_R, _e.pcy + Math.sin(a)*RIVAL_PHANTOM_R*0.85);
        this.warp(_e, p.x, p.y, RIVAL_BLINK_T, "blink");
    },
    //止まった弾を、自分のまわりに輪にして置く
    plant:function(_e){
        for(var i=0; i<RIVAL_PHANTOM_SHOTS; i++){
            var a = _e.t*0.1 + i*Math.PI*2/RIVAL_PHANTOM_SHOTS;
            fireShot(_e.x + Math.cos(a)*22, _e.y + Math.sin(a)*22, 0, 0, "normal");
            enemyShots[enemyShots.length - 1].held = _e.id;
        }
    },
    //時が動き出す：置いた弾が、それぞれドローン君へ飛ぶ
    release:function(_e){
        var sp = RIVAL_RELEASE_SPEED*Math.min(1.3,danmaku());
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.held != _e.id) continue;
            var t = nearestPlayer(b.x,b.y), a = Math.atan2(t.Y - b.y, t.X - b.x);
            b.vx = Math.cos(a)*sp; b.vy = Math.sin(a)*sp;
            b.held = 0;
        }
        _e.relT = 24;
        fx.ring(_e.x, _e.y, 120, WARP_COLOR, 20, 4);
        sound.play("timeResume");
    },
    //突進をジャスト衝撃波で弾かれた(special.parry から)
    parry:function(_e){
        if(_e.mode != "dash") return;
        _e.mode = "stagger";
        _e.count = RIVAL_STAGGER;
        _e.chain = 0;
        this.flags(_e);
        _e.vx = -_e.aimX*7; _e.vy = -_e.aimY*7;
        _e.flash = 10;
        fx.flare(_e.x, _e.y, 50, JUST_COLOR, 14);
        fx.sparks(_e.x, _e.y, 16, JUST_COLOR, 8, 3);
        popup(_e.x, _e.y - _e.r - 10, "カウンター！", "rgb(30,150,200)");
        mainScreen.hitEnemy(_e, _e.maxHp*RIVAL_PARRY_DMG, "counter");
        _e.hpMark = _e.hp;
    },
    //体力が0になった：倒れずに、捨てぜりふを残して去る(special.revive から。true で倒さない)
    retreat:function(_e){
        _e.hp = 0;
        _e.mode = "flee";
        _e.count = RIVAL_FLEE_T;
        _e.chain = 0;
        this.flags(_e);
        //置いたままの弾は消える
        enemyShots = enemyShots.filter(function(b){ return b.held != _e.id; });
        game.score += _e.score;
        popup(_e.x, _e.y + _e.r + 50, "ライバル撃退！　+" + _e.score, "rgb(30,120,190)", true);     //せりふの吹き出しと重ならないよう下に
        mainScreen.drop("capsule", _e.x, _e.y);
        var n = Math.round(_e.parts*difficulty().parts);
        for(var i=0; i<n; i++) mainScreen.drop("part", _e.x, _e.y);
        mainScreen.rareMsg = "ライバル「" + RIVAL.name + "」を撃退！　報酬カプセルを落とした";
        mainScreen.rareMsgTime = 150;
        fx.flare(_e.x, _e.y, 80, WARP_COLOR, 18);
        fx.shake(12);
        sound.play("bossDown");
        return true;
    },

    //曲：ライバルがいる間はライバルの曲(mainScreen.tickTimers から。協力プレイのゲストも)
    music:function(){
        if(mainScreen.state != "play") return;
        var on = !!this.alive();
        if(on == this.musicOn) return;
        this.musicOn = on;
        if(on){ sound.music("rival"); return; }
        //まだ雑魚敵が残っていれば元の曲へ(いなければすぐにWAVEクリアになる)
        var rest = mainScreen.toSpawn > 0 || enemies.some(function(e){ return !e.dead && e.type != "chrono"; });
        if(rest) sound.battleMusic();
        else sound.stopMusic();
    },

    //------------------------------------------------------------------ 描画
    //見た目だけの変化を見張る(ワープの始まりで今のコマを写す・せりふ)。ホストもゲストも描画のたびに呼ぶ
    watch:function(_e){
        if(!_e.wfx) _e.wfx = new RivalWarp(RIVAL_SCALE);
        var lv = _e.lv || 0;
        var start = (_e.mode == "warp" && (_e._pm != "warp" || _e.count > _e._pc)) || (_e.mode == "flee" && _e._pm != "flee");
        if(start || !_e.wfx.snap) _e.wfx.shoot(_e.look);
        if(_e.mode == "warp" && _e._pm != "warp") _e.arrT = 0;
        if(_e._pm == "warp" && _e.mode != "warp") _e.arrT = 18;     //組み上がった直後の光
        _e._pm = _e.mode; _e._pc = _e.count;
        //せりふ：現れたとき・本気になったとき・去るとき
        if(!_e.said0 && _e.mode != "warp"){ _e.said0 = true; this.say(_e, RIVAL_LINES[lv][0]); }
        if(!_e.said1 && _e.enraged && _e.mode != "flee"){ _e.said1 = true; this.say(_e, RIVAL_LINES[lv][1]); }
        if(!_e.said2 && _e.mode == "flee"){ _e.said2 = true; this.say(_e, RIVAL_LINES[lv][2]); }
        if(_e.sayT > 0) _e.sayT--;
        if(_e.arrT > 0) _e.arrT--;
        if(_e.relT > 0) _e.relT--;
        //残像(速く動いている間)
        if(!_e.trail) _e.trail = [];
        _e.trail.unshift({ x:_e.x, y:_e.y });
        if(_e.trail.length > 10) _e.trail.pop();
    },
    say:function(_e,_text){
        _e.sayText = _text;
        _e.sayT = RIVAL_SAY_T;
    },
    //体を出すか(ワープ中・ほどけて消えるところは出さない)
    shown:function(_e){
        return _e.mode != "warp" && !(_e.mode == "flee" && _e.count <= RIVAL_FLEE_OUT);
    },

    //体(translate済み。special.draw から)
    draw:function(_e,_body){
        if(this.shown(_e)){
            var k = RIVAL_SCALE;
            ctx.save();
            //撃退されたあとは傾いて震える
            if(_e.mode == "flee"){
                ctx.rotate(0.35*Math.min(1, (RIVAL_FLEE_T - _e.count)/20));
                ctx.translate((Math.random() - 0.5)*2, 0);
            }
            //よろけている間は回る
            if(_e.mode == "stagger") ctx.rotate(Math.sin(_e.count*0.5)*0.4);
            //まわりのワープの光
            enemyArt.halo(0, 0, 34 + Math.sin(_e.t*0.12)*3, WARP_COLOR, _e.mode == "hold" ? 0.6 : 0.25);
            this.drawBand(_e, k, false);
            if(_body) ctx.globalAlpha = 0.6;
            _e.look.draw(0, 0, k);
            ctx.globalAlpha = 1;
            this.drawBand(_e, k, true);
            ctx.restore();
        }
        if(_e.sayT > 0) this.drawSay(_e);
    },
    //ハチマキ：体の上のほうに巻いた帯(_front)と、結び目からなびく2本の端(体の後ろ)。
    //体と同じように弾んで傾く(DroneLook.draw と同じ動き)。端は動きと逆へ、止まっているときは後ろへ垂れる
    drawBand:function(_e,_k,_front){
        var L = _e.look, y = RIVAL_BAND_Y*_k;
        if(!_front){
            var sp = Math.hypot(_e.vx,_e.vy);
            var want = sp > 0.8 ? Math.atan2(-_e.vy,-_e.vx) : (L.yaw > 0 ? 0.5 : Math.PI - 0.5);
            _e.scarfA = _e.scarfA == null ? want : turnTo(_e.scarfA, want, 0.12);
        }
        var side = Math.cos(_e.scarfA) >= 0 ? 1 : -1, kx = side*(RIVAL_BAND_W - 1)*_k;
        ctx.save();
        ctx.translate(0, Math.sin(L.t*0.08)*1.5*_k);
        ctx.rotate(L.tilt);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if(_front){
            ctx.beginPath(); ctx.moveTo(-RIVAL_BAND_W*_k, y); ctx.lineTo(RIVAL_BAND_W*_k, y);
            ctx.strokeStyle = RIVAL_INK; ctx.lineWidth = 4.4*_k; ctx.stroke();
            ctx.strokeStyle = RIVAL_SCARF; ctx.lineWidth = 2.6*_k; ctx.stroke();
            ctx.beginPath(); ctx.arc(kx, y, 2.6*_k, 0, Math.PI*2);
            ctx.fillStyle = RIVAL_SCARF; ctx.fill();
            ctx.strokeStyle = RIVAL_INK; ctx.lineWidth = 1.4; ctx.stroke();
        }else{
            var len = 4.4*_k*(1 + Math.min(1, Math.hypot(_e.vx,_e.vy)/6)*0.5);
            for(var s=0; s<2; s++){
                var a = _e.scarfA - L.tilt + (s ? 0.3 : -0.1);
                var x = kx, yy = y, pts = [[x,yy]];
                for(var i=1; i<=5; i++){
                    var wave = Math.sin(_e.t*0.32 - i*0.9 + s*1.7)*0.25*i/5;
                    x += Math.cos(a + wave)*len; yy += Math.sin(a + wave)*len + i*0.4;
                    pts.push([x,yy]);
                }
                ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
                for(var i=1; i<pts.length; i++) ctx.lineTo(pts[i][0],pts[i][1]);
                ctx.strokeStyle = RIVAL_INK; ctx.lineWidth = (s ? 3.6 : 4.2)*_k; ctx.stroke();
                ctx.strokeStyle = RIVAL_SCARF; ctx.lineWidth = (s ? 2 : 2.6)*_k; ctx.stroke();
            }
        }
        ctx.restore();
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
        ctx.lineWidth = 1;
    },
    //せりふの吹き出し(translate済み。画面の外に出ないようにずらす)
    drawSay:function(_e){
        ctx.save();
        ctx.font = "bold 14px sans-serif";
        var w = ctx.measureText(_e.sayText).width + 20, h = 26;
        var bx = Math.max(w/2 + 6, Math.min(CW - w/2 - 6, _e.x)) - _e.x;
        var by = _e.y < 190 ? 52 : -62;     //上のほうでは下に出す(画面の上の文字と重ならないように)
        ctx.globalAlpha = Math.min(1, _e.sayT/15, (RIVAL_SAY_T - _e.sayT + 1)/6);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.strokeStyle = RIVAL_INK;
        ctx.lineWidth = 2;
        enemyArt.roundRect(bx - w/2, by - h/2, w, h, 8);
        ctx.fill(); ctx.stroke();
        //しっぽ
        var ty = by < 0 ? by + h/2 : by - h/2, dy = by < 0 ? 10 : -10;
        ctx.beginPath(); ctx.moveTo(-6, ty); ctx.lineTo(0, ty + dy); ctx.lineTo(6, ty);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillRect(-5, ty - (by < 0 ? 2 : 0), 10, 2);
        ctx.fillStyle = "rgb(" + RIVAL_TINT + ")";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(_e.sayText, bx, by + 1);
        ctx.restore();
        ctx.lineWidth = 1;
    },

    //ワープの粒子・突進の予告・時が止まった世界(translateしていない状態。special.drawAttack から。敵より奥に描く)
    drawAttack:function(_e){
        this.watch(_e);
        var W = _e.wfx;
        //時が止まっている(幻影包囲の hold)：周りの色を抜き、置いた弾を光らせる
        if(_e.mode == "hold" || _e.relT > 0){
            var p = _e.mode == "hold" ? Math.min(1, (RIVAL_HOLD_T - _e.count)/8) : _e.relT/24;
            ctx.save();
            ctx.globalCompositeOperation = "saturation";
            ctx.fillStyle = "rgba(128,128,128," + (0.85*p) + ")";
            ctx.fillRect(-40,-40,CW + 80,CH + 80);
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "rgba(15,25,55," + (0.2*p) + ")";
            ctx.fillRect(-40,-40,CW + 80,CH + 80);
            //止まった瞬間：色の反転した輪が広がる
            if(_e.mode == "hold" && _e.count > RIVAL_HOLD_T - 20){
                var u = (RIVAL_HOLD_T - _e.count)/20, r = 20 + (1 - (1 - u)*(1 - u))*700;
                ctx.globalCompositeOperation = "difference";
                ctx.fillStyle = "rgba(255,255,255," + (0.8*(1 - u)) + ")";
                ctx.beginPath(); ctx.arc(_e.x,_e.y,r,0,Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }
        //置いた弾：光の輪(どこから飛んでくるかわかるように)
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(!b.held) continue;
            ctx.strokeStyle = "rgba(" + WARP_COLOR + "," + (0.5 + 0.3*Math.sin(_e.t*0.3 + i)) + ")";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, Math.PI*2); ctx.stroke();
            ctx.lineWidth = 1;
        }
        //残像：速く動いている間、光る影を残す
        var sp = Math.hypot(_e.vx,_e.vy);
        if(this.shown(_e) && sp > 3.5 && _e.trail){
            ctx.save();
            //明るい背景でも見えるよう、加算ではなくふつうに重ねる
            for(var i=3; i<_e.trail.length; i+=3) W.drawGlow(_e.trail[i].x, _e.trail[i].y, 0.22*(1 - i/_e.trail.length)*Math.min(1, sp/8));
            ctx.restore();
        }
        //突進の構え：狙っている間は薄く、合図で濃くなる
        if(_e.mode == "aim"){
            var cue = _e.count <= RIVAL_CUE ? 1 - _e.count/RIVAL_CUE : 0;
            ctx.strokeStyle = "rgba(" + WARP_COLOR + "," + (0.3 + 0.6*cue) + ")";
            ctx.lineWidth = _e.r*1.4;
            ctx.globalAlpha = 0.3;
            ctx.beginPath(); ctx.moveTo(_e.x,_e.y); ctx.lineTo(_e.x + _e.aimX*1200, _e.y + _e.aimY*1200); ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        }
        //ワープ：出発点でほどけ、行き先で組み上がる。行き先には光の輪が縮んでいく
        if(_e.mode == "warp" && _e.wt > 0){
            var t = 1 - _e.count/_e.wt;
            ctx.strokeStyle = "rgba(" + WARP_COLOR + "," + (0.6*Math.sin(Math.PI*t)) + ")";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(_e.x,_e.y,8 + 50*(1 - t),0,Math.PI*2); ctx.stroke();
            ctx.lineWidth = 1;
            W.draw(_e.wx0, _e.wy0, _e.x, _e.y, t);
        }
        //撃退されて去る：その場でほどけて消える
        if(_e.mode == "flee" && _e.count <= RIVAL_FLEE_OUT){
            W.draw(_e.x, _e.y, null, null, 1 - _e.count/RIVAL_FLEE_OUT);
        }
        //組み上がった直後：光る
        if(_e.arrT > 0 && this.shown(_e)){
            ctx.save();
            //明るい背景でも見えるよう、加算ではなくふつうに重ねる
            W.drawGlow(_e.x, _e.y, 0.8*_e.arrT/18);
            ctx.restore();
        }
    }
};
