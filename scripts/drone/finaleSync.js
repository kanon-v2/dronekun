//------------------------------------------------------------------------------
//  最終局面の試作：ドローン君改の第二形態を、録音の曲(Lyria。bgmTrial.js の monarch)に合わせて動かす
//  デバッグのメニューの「最終局面」を「Lyria」にしたときだけ働く(ふだんの戦いは bosses.js のまま)
//  - 攻撃はタイマーではなく曲の時刻で出す。曲の区切り(FS_SECTIONS)ごとに攻撃の並び・間隔を変え、拍で撃ち、小節の頭で画面が脈打つ
//  - ため(72秒～)：改は画面の奥へ下がり、奥から拍に合わせて撃ってくる。画面がだんだん暗くなる
//  - 無音(82.5秒～)：弾が消え、改が奥から迫る。サビの頭(84秒)に着くので、そこへジャスト衝撃波を合わせると弾き返せる
//  - サビ(84秒～)：改が大きくなり、1小節ごとに攻撃。息つぎ(106.5秒)で光を吸い込み、108秒で一気に放つ
//  - サビの前に倒しきれないよう、最初のサビまでは体力が FS_GATE より減らない
//  special.kai・special.draw・shotLab.onBlast・shotLab.drawFront を包んで差し替える
//------------------------------------------------------------------------------
const FS_START    = 36;       //曲をここから流し始める(秒。盛り上がりの区切りの頭。0 にすると前奏から。ためまで 72 - FS_START 秒)
const FS_BAR      = 1.5;      //1小節の長さ(秒。160 BPM の4拍)
const FS_BEAT     = 0.375;    //1拍の長さ(秒)
//曲の区切り(from は曲の秒数。FS_START より前の区切りは、FS_START を小さくしたときだけ使う)。every：何小節ごとに攻撃するか gun：何拍ごとに撃つか list：攻撃の並び(bosses.js の kaiAttack)
//giant：改が大きくなる pulse：小節の頭で強く脈打つ
const FS_SECTIONS = [
    { from:0,     name:"prelude", every:2, gun:4, list:["tesla","cross"] },
    { from:24,    name:"rise",    every:2, gun:2, list:["spiral","missile","dash","tesla"] },
    { from:36,    name:"storm",   every:2, gun:2, list:["cross","dash","rain","dragon","spiral","missile"] },
    { from:60,    name:"bass",    every:2, gun:2, list:["rain","mines","spiral","tesla"] },
    { from:72,    name:"sink" },
    { from:82.5,  name:"hush" },
    { from:84,    name:"drop",    every:1, gun:2, list:["cross","spiral","dash","gunstorm","dragon","rain"], giant:true, pulse:true },
    { from:106.5, name:"breath",  giant:true },
    { from:108,   name:"drop2",   every:1, gun:1, list:["spiral","cross","gunstorm","dash","rain","missile"], giant:true, pulse:true }
];
const FS_SINK_SEC   = 4;        //ため：奥へ下がりきるまで(秒)
const FS_SINK_Y     = 200;      //ため：奥へ下がるときに寄っていく高さ(px。奥行きで消失点へ寄る前の位置)
const FS_DEEP_FROM  = [75, 78]; //ため：奥から撃ち始める秒(2拍ごと)・毎拍になる秒
const FS_DEEP_SPREAD = 90;      //奥からの弾が落ちる所のばらつき(px)
const FS_DARK       = [0.25, 0.6, 0.82];    //画面の暗さ(ためを始めたとき・ためのいちばん暗いとき・無音)
const FS_HIT_T      = 84;       //奥からの突進が着く秒(サビの頭)
const FS_LOCK       = 0.6;      //無音の長さのこの割合までは狙いがドローン君を追い、そのあと止まる
const FS_RAM_R      = 40;       //着いたときに当たる範囲の半径(px)
const FS_RAM_SCALE  = 6;        //着いたときの大きさ(ふだんの何倍か。画面からはみ出すほど)
const FS_FAR        = 0.12;     //ため・無音の間、奥の空と街がどれだけ遠ざかる(小さくなる)か
const FS_FAR_DIM    = 0.65;     //ため・無音の間、奥の空と街をどれだけ暗くするか
const FS_DRAIN      = 0.9;      //無音の間、周りの色をどれだけ抜くか(改だけ色が残る)
const FS_HIT_STOP   = 14;       //弾き返した瞬間に止まる時間(フレーム)
const FS_FLING      = 15;       //弾き返されて吹き飛ぶ速さ(px/フレーム)
//画面の色と光(第二形態の間)
const FS_NIGHT      = 0.84;     //夜の戦場の色をどれだけ重ねるか(方眼紙の白を隠す)
const FS_LIGHT      = 0.32;     //改が足もとを照らす光の濃さ
const FS_EMBERS     = 70;       //舞い上がる火の粉の数
const FS_HALO       = 3.2;      //弾のまわりのにじみの大きさ(弾の半径の何倍か)
//効果音
const FS_SE_DUCK    = 0.3;      //細かい効果音の大きさ(曲を主役にするため小さくする。ふだんの何倍か)
const FS_SE_QUIET   = ["shot","missile","laser","bug","zap","mine","blade","water","steam","fire","disc","gravity","snipe","freeze",
                       "hit","enemyShot","bossShot","graze","part","yaruki","comboUp"];
const FS_SE_VOL     = 0.9;      //重い効果音(衝撃・高まる音・風を切る音)の大きさ
const FS_REVERB_SEC = 2.6;      //重い効果音の残響の長さ(秒)
const FS_SAFE       = 45;       //着いたあと、大きな改に触れても被弾しない時間(フレーム。小さくなっていく間)
const FS_JUST_SEC   = 0.3;      //着く前のこの秒数の間に衝撃波を出すと弾き返す
const FS_PERFECT_SEC = 0.1;     //そのうちこの秒数以内なら PERFECT
const FS_PARRY_DMG  = [0.1, 0.16];  //弾き返したときのダメージ(第二形態の体力の割合。JUST・PERFECT)
const FS_STAGGER    = 70;       //弾き返されてよろける時間(フレーム)
const FS_GIANT      = 1.5;      //サビの間の大きさ(ふだんの何倍か)
const FS_GATE       = 0.45;     //最初のサビまでは、体力がこの割合より減らない

var finaleSync = {
    fakeT:null,     //テスト用：曲の時刻をこの値にする(音を鳴らさずに確かめる)
    drawing:false,  //drawFront の中で、奥にいる改を描いている

    //Lyria を選んでいるか
    on:function(){ return bgmTrial.finales[bgmTrial.finale].v == "monarch"; },
    //曲の時刻(秒。まだ流れていなければ -1)
    pos:function(){ return this.fakeT != null ? this.fakeT : monarch.pos(); },
    section:function(_p){
        var s = FS_SECTIONS[0];
        for(var i=0; i<FS_SECTIONS.length; i++) if(_p >= FS_SECTIONS[i].from) s = FS_SECTIONS[i];
        return s;
    },
    //曲に合わせて動かしているなら true(bosses.js の改の動きはそのあとで動く。ため・無音・息つぎは自分だけで動かして true を返す)
    step:function(_e,_dx,_dy,_d){
        this.debugSkip(_e);
        if(!this.on() || _e.form != 2 || _e.mode == "down" || _e.mode == "revive") return false;
        var p = this.pos();
        if(p < 0) return false;
        if(_e.fsR0 == null){ _e.fsR0 = _e.r; _e.fsScale = 1; _e.fsPulse = 0; _e.fsCycle = 0; }
        var sec = this.section(p);
        var beat = Math.floor(p/FS_BEAT), bar = Math.floor(p/FS_BAR);
        var newBeat = beat != _e.fsBeat, newBar = bar != _e.fsBar;
        _e.fsBeat = beat; _e.fsBar = bar;
        if(sec != _e.fsSec){
            var from = _e.fsSec;
            _e.fsSec = sec;
            _e.fsCycle = 0;
            this.enter(_e, sec, from);
        }
        //大きさ：サビの間は大きく、ほかはふだんの大きさへ戻る
        _e.fsScale += ((sec.giant ? FS_GIANT : 1) - _e.fsScale)*0.05;
        _e.r = _e.fsR0*_e.fsScale;
        if(_e.fsPulse > 0) _e.fsPulse = Math.max(0, _e.fsPulse - 0.06);
        if(newBeat) _e.fsPulse = Math.max(_e.fsPulse, sec.pulse ? 0.6 : 0.3);
        //最初のサビまでは倒れない
        if(!_e.fsDropped) _e.hp = Math.max(_e.hp, Math.ceil(_e.maxHp*FS_GATE));

        //奥の空と街：ため・無音の間は遠ざかって暗くなり、ほかは戻る
        var far = sec.name == "sink" ? Math.min(1, (p - FS_SECTIONS[4].from)/FS_SINK_SEC) : sec.name == "hush" ? 1 : 0;
        battleBg.far += (far - battleBg.far)*(far > battleBg.far ? 0.05 : 0.08);
        //第二形態の間は夜の戦場。改が足もとを照らす(奥にいる間は小さく)
        battleBg.night += (FS_NIGHT - battleBg.night)*0.02;
        battleBg.light = { x:_e.x, y:_e.y, a:FS_LIGHT*(1 + 0.8*(_e.fsPulse || 0)), r:220*(_e.fsMode == "sink" || _e.fsMode == "hush" ? 0.6 : _e.fsScale) };
        this.liveT = 2;
        //着いたあと：大きいまま触れても被弾しない間・吹き飛ぶ光の尾
        if(_e.fsSafe > 0){
            _e.harmless = --_e.fsSafe > 0;
            if(_e.fsSafe % 2 == 0) effects.push({ x:_e.x, y:_e.y, vx:-_e.vx*0.1, vy:-_e.vy*0.1, life:20, maxLife:20, size:6, glow:JUST_COLOR });
        }

        if(sec.name == "sink"){ this.sink(_e, p, newBeat, beat); return true; }
        if(sec.name == "hush"){ this.hush(_e, p, newBeat, beat); return true; }
        if(sec.name == "breath"){ this.breath(_e, p); return true; }

        //ふだんの区切り：bosses.js のタイマーでは攻撃させず、拍・小節で出す
        _e.timer = 999; _e.gunT = 999;
        var play = mainScreen.state == "play";
        if(newBeat && play && beat % sec.gun == 0 && _e.mode != "stagger"){
            var ph = _e.phase || 4;
            fireFan(_e.x, _e.y, Math.atan2(_dy,_dx), [0,1,3,5,3,5][ph], 0.18, 3.4*danmaku(), "normal");
            sound.play("shot");
        }
        if(newBar && play){
            if(sec.pulse){
                battleBg.ripple(_e.x, _e.y, 16, 7, 40, KAI2_GLOW);
                fx.ring(_e.x, _e.y, 90*_e.fsScale, KAI2_GLOW, 14, 3);
                fx.shake(2);
            }else battleBg.ripple(_e.x, _e.y, 7, 6, 30, KAI2_GLOW);
            if(bar % sec.every == 0 && _e.mode == "idle"){
                special.kaiAttack(_e, sec.list[_e.fsCycle++ % sec.list.length], _e.phase || 4, Math.atan2(_dy,_dx));
            }
        }
        return false;
    },
    //区切りに入ったとき
    enter:function(_e,_sec,_from){
        var M = mainScreen;
        switch(_sec.name){
            case "sink":
                //攻撃をやめて、奥へ下がり始める
                this.calm(_e);
                _e.fsMode = "sink";
                _e.fsWx = _e.x; _e.fsWy = _e.y;
                popup(_e.x, _e.y - 60, "ドローン君改　出力集束…", "#a3c", true);
                fsSfx.rumble(FS_SECTIONS[5].from - Math.max(this.pos(), FS_SECTIONS[4].from));
                break;
            case "hush":
                //無音：弾が消え、奥から迫り始める。狙いはドローン君から。うなりを止め、着く瞬間へ向けて音が高まる
                this.calm(_e);
                fsSfx.stopRumble();
                fsSfx.riser(FS_HIT_T - this.pos());
                for(var i=0; i<enemyShots.length; i++) fx.sparks(enemyShots[i].x, enemyShots[i].y, 2, KAI2_GLOW, 2, 2);
                enemyShots = [];
                shotLab.deeps = [];
                _e.fsMode = "hush";
                _e.fsTx = drone.X; _e.fsTy = drone.Y;
                _e.fsBlastP = null;
                _e.fsLocked = false;
                M.yaruki = Math.max(M.yaruki, YARUKI_COST);     //迎え撃てるよう、衝撃波1回分のやる気は残す
                break;
            case "drop":
                if(_from && _from.name == "hush") this.resolve(_e);
                break;
            case "drop2":
                if(_from && _from.name == "breath") this.release(_e);
                break;
            case "breath":
                //息つぎ：弾が光になって改へ吸い込まれる
                this.calm(_e);
                _e.fsMode = "breath";
                for(var i=0; i<enemyShots.length; i++){
                    var b = enemyShots[i];
                    effects.push({ x:b.x, y:b.y, vx:(_e.x - b.x)*0.06, vy:(_e.y - b.y)*0.06, life:16, maxLife:16, size:3, glow:KAI2_GLOW });
                }
                enemyShots = [];
                sound.play("kaiBoot");
                break;
        }
        //ため・無音・息つぎでなくなったら、ふだんの動きへ
        if(_sec.name != "sink" && _sec.name != "hush" && _sec.name != "breath" && _e.fsMode){
            _e.fsMode = null;
            _e.harmless = false; _e.phased = false;
            if(_e.mode == "fs") _e.mode = "idle";
        }
    },
    //攻撃を全部やめる(ため・無音・息つぎの前)
    calm:function(_e){
        _e.mode = "fs";
        _e.beams = 1;
        _e.waterT = _e.spiralT = _e.rainT = _e.circleT = 0;
        _e.mines = []; _e.strikes = [];
        _e.chain = 0;
        _e.vx = 0; _e.vy = 0;
        for(var i=0; i<enemies.length; i++) if(enemies[i].minion) enemies[i].dead = true;
    },
    //ため：奥へ下がり、奥から拍に合わせて撃つ。当たらない
    sink:function(_e,_p,_newBeat,_beat){
        _e.harmless = true; _e.phased = true;
        _e.look.update(0,0);
        var k = Math.min(1, (_p - FS_SECTIONS[4].from)/FS_SINK_SEC);
        var q = k*k*(3 - 2*k);
        var wx = _e.fsWx + (CW/2 - _e.fsWx)*q, wy = _e.fsWy + (FS_SINK_Y - _e.fsWy)*q;
        var P = shotLab.depthAt(wx, wy, q);
        _e.x = P.x; _e.y = P.y; _e.vx = 0; _e.vy = 0;
        _e.fsDraw = P.s;
        var dk = (_p - FS_SECTIONS[4].from)/(FS_SECTIONS[5].from - FS_SECTIONS[4].from);
        _e.fsDark = FS_DARK[0] + (FS_DARK[1] - FS_DARK[0])*Math.min(1, dk);
        if(_newBeat && mainScreen.state == "play" && _p >= FS_DEEP_FROM[0] && (_p >= FS_DEEP_FROM[1] || _beat % 2 == 0)){
            shotLab.deep(aimAt.X + (Math.random() - 0.5)*FS_DEEP_SPREAD*2, aimAt.Y + (Math.random() - 0.5)*FS_DEEP_SPREAD*2);
        }
    },
    //無音：奥から迫る。はじめはドローン君を追い、途中で狙いが止まる
    hush:function(_e,_p,_newBeat,_beat){
        _e.harmless = true; _e.phased = true;
        //拍ごとに鼓動。奥の改から方眼へ波が来る
        if(_newBeat){
            mainScreen.beat(_p > FS_HIT_T - FS_BEAT*1.5);
            battleBg.ripple(DEPTH_VP.x, DEPTH_VP.y, 12, 7, 60, KAI2_GLOW);
        }
        _e.look.update(0,0);
        var A = FS_SECTIONS[5].from, k = Math.max(0, Math.min(1, (_p - A)/(FS_HIT_T - A)));
        if(k < FS_LOCK){
            _e.fsTx += (aimAt.X - _e.fsTx)*0.08; _e.fsTy += (aimAt.Y - _e.fsTy)*0.08;
        }else if(!_e.fsLocked){
            _e.fsLocked = true;
            sound.play("tell");
        }
        var z = 1 - k*k;    //だんだん速く迫る
        var P = shotLab.depthAt(_e.fsTx, _e.fsTy, z);
        _e.x = P.x; _e.y = P.y; _e.vx = 0; _e.vy = 0;
        _e.fsDraw = P.s*(1 + (FS_RAM_SCALE - 1)*k*k*k);
        _e.fsDark = FS_DARK[2];
    },
    //衝撃波を出した(shotLab.onBlast から)：無音の間なら時刻を覚える(着いたときに弾き返せたか決める)
    onBlast:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type == "kai" && e.fsMode == "hush" && e.fsBlastP == null) e.fsBlastP = this.pos();
        }
    },
    //サビの頭：迫ってきた改が着く。合わせて衝撃波を出していれば弾き返す
    resolve:function(_e){
        var M = mainScreen;
        var left = _e.fsBlastP == null ? -1 : FS_HIT_T - _e.fsBlastP;
        var near = Math.hypot(drone.X - _e.fsTx, drone.Y - _e.fsTy);
        _e.x = _e.fsTx; _e.y = _e.fsTy;
        _e.harmless = false; _e.phased = false;
        _e.fsDropped = true;
        M.flashT = FLASH_TIME;
        battleBg.ripple(_e.x, _e.y, 50, 10, 90, KAI2_GLOW);
        fx.ring(_e.x, _e.y, 320, KAI2_GLOW, 30, 10);
        if(left >= 0 && left <= FS_JUST_SEC && near < FS_RAM_R + 40){
            var perfect = left <= FS_PERFECT_SEC;
            popup(_e.x, _e.y - 70, perfect ? "PERFECT" : "JUST", "rgb(" + JUST_COLOR + ")", true);
            fx.flare(_e.x, _e.y, 260, JUST_COLOR, 28);
            fx.ring(_e.x, _e.y, 220, JUST_COLOR, 26, 8);
            fx.sparks(_e.x, _e.y, 50, JUST_COLOR, 12, 4);
            fx.shake(26);
            M.hitStop = Math.max(M.hitStop, FS_HIT_STOP);
            M.zoomT = ZOOM_TIME; M.zoomX = _e.x; M.zoomY = _e.y;
            sound.play("just");
            fsSfx.impact(true);
            fsSfx.whoosh(0.08);
            //上へはじき飛ばされてよろける
            var dx = _e.x - CW/2, dy = _e.y - 120, d = Math.hypot(dx,dy) || 1;
            _e.vx = -dx/d*FS_FLING; _e.vy = -dy/d*FS_FLING;
            _e.mode = "stagger"; _e.count = FS_STAGGER; _e.chain = 0;
            _e.flash = 12;
            M.hitEnemy(_e, Math.round(_e.maxHp*FS_PARRY_DMG[perfect ? 1 : 0]), "counter");
            this.result = perfect ? "perfect" : "just";
        }else{
            if(near < FS_RAM_R + HIT_CORE && M.canBeHit()) M.damage();
            fx.shake(16);
            sound.play("dash");
            fsSfx.impact(false);
            _e.vx = 0; _e.vy = -6;
            _e.mode = "idle";
            this.result = near < FS_RAM_R + HIT_CORE ? "hit" : "dodge";
        }
        _e.fsMode = null;
        //迫ってきた大きさから、だんだんふだんの大きさへ戻る(その間は触れても被弾しない)
        _e.fsScale = FS_RAM_SCALE*0.7;
        _e.r = _e.fsR0*_e.fsScale;
        _e.fsSafe = FS_SAFE;
        _e.harmless = true;
    },
    //息つぎ：その場で止まって光を吸い込む(撃てば当たる)
    breath:function(_e,_p){
        _e.harmless = false; _e.phased = false;
        _e.vx *= 0.85; _e.vy *= 0.85;
        _e.look.update(0,0);
        _e.fsDark = 0;
        if(_e.t % 3 == 0){
            var a = Math.random()*Math.PI*2, R = 160 + Math.random()*80, sp = 8;
            effects.push({ x:_e.x + Math.cos(a)*R, y:_e.y + Math.sin(a)*R, vx:-Math.cos(a)*sp, vy:-Math.sin(a)*sp,
                           life:20, maxLife:20, size:3, glow:KAI2_GLOW });
        }
        mainScreen.shake = Math.max(mainScreen.shake, 2);
    },
    //息つぎのあと：ためた光を一気に放つ
    release:function(_e){
        var M = mainScreen;
        fireRing(_e.x, _e.y, 24, 2.6*Math.min(1.3,danmaku()), Math.random(), "small");
        fireRing(_e.x, _e.y, 12, 1.7, Math.random(), "big");
        fx.flare(_e.x, _e.y, 240, KAI2_GLOW, 24);
        fx.ring(_e.x, _e.y, 300, KAI2_GLOW, 28, 10);
        battleBg.ripple(_e.x, _e.y, 50, 10, 90, KAI2_GLOW);
        fx.shake(20);
        M.flashT = FLASH_TIME;
        sound.play("kaiIgnite");
        fsSfx.impact(true);
    },

    //デバッグのメニューの「改・第二形態から」：第一形態が戦い始めたら、すぐ復活に入る
    debugSkip:function(_e){
        if(!bossDebug.kai2 || _e.form != 1 || _e.mode != "idle" || mainScreen.state != "play") return;
        bossDebug.kai2 = false;
        _e.form = 1.5;
        _e.baseHp = _e.maxHp;
        _e.maxHp = Math.round(_e.baseHp*KAI2_HP_MUL);
        _e.hp = 1;
        _e.mode = "revive";
        _e.count = KAI2_REVIVE_T;
        _e.harmless = true;
        enemyShots = [];
        sound.stopMusic();
    },

    //改の絵：大きさ(奥行き・サビ)を掛け、拍で紫の光が脈打つ。奥にいる間はここでは描かず、drawFront で暗闇の上に描く
    draw:function(_e,_body,_orig){
        if(_e.fsMode && _e.fsMode != "breath" && !this.drawing) return true;
        var s = _e.fsMode && _e.fsMode != "breath" ? _e.fsDraw : (_e.fsScale || 1);
        if(!_body){
            var a = _e.fsMode == "breath" ? 0.5 + 0.2*Math.sin(_e.t*0.5) : Math.max(0.3, _e.fsPulse || 0);
            if(_e.fsMode == "sink" || _e.fsMode == "hush") a = Math.max(a, 0.5);    //奥にいても見失わないよう、光は小さくしすぎない
            var R = Math.max(80*s, _e.fsMode ? 45 : 0)*(1 + 0.15*a);
            var g = ctx.createRadialGradient(0,0,R*0.2,0,0,R);
            g.addColorStop(0, "rgba(" + KAI2_GLOW + "," + (0.45*a) + ")");
            g.addColorStop(1, "rgba(" + KAI2_GLOW + ",0)");
            ctx.fillStyle = g;
            ctx.globalCompositeOperation = "lighter";      //夜の色の上で光があふれるように
            ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
        }
        ctx.save();
        ctx.scale(s,s);
        _orig();
        ctx.restore();
        return true;
    },
    //第二形態の間か(曲に合わせて動いている改がいる)
    live:function(){ return this.liveT > 0 && page.number == 1; },
    //弾の下(敵の上)：舞い上がる火の粉・弾のにじみ・ドローン君の灯り(光は lighter で重ねてにじませる)
    drawUnder:function(){
        if(this.liveT > 0) this.liveT--;     //改が動かなくなったら(倒した・画面を出た)止める
        if(!this.live()) return;
        var k = battleBg.night/FS_NIGHT;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        //火の粉：下から舞い上がり、揺れながら消える
        if(!this.embers){
            this.embers = [];
            for(var i=0; i<FS_EMBERS; i++) this.embers.push(this.ember(Math.random()*CH));
        }
        for(var i=0; i<this.embers.length; i++){
            var m = this.embers[i];
            m.y -= m.v; m.x += Math.sin(m.y*0.02 + m.ph)*0.4;
            if(m.y < -10) this.embers[i] = m = this.ember(CH + 10);
            var a = k*m.a*Math.min(1, Math.max(0, m.y)/120);
            ctx.fillStyle = "rgba(" + m.c + "," + a + ")";
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI*2); ctx.fill();
        }
        //弾のにじみ(絵を1枚作っておいて貼る)
        var h = this.haloImg();
        ctx.globalAlpha = 0.75*k;
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.behind) continue;
            var R = (b.r || 5)*FS_HALO;
            ctx.drawImage(h, b.x - R, b.y - R, R*2, R*2);
        }
        ctx.globalAlpha = 1;
        //ドローン君の灯り(夜でも見失わないように)
        var g = ctx.createRadialGradient(drone.X, drone.Y, 4, drone.X, drone.Y, 46);
        g.addColorStop(0, "rgba(150,200,255," + (0.35*k) + ")");
        g.addColorStop(1, "rgba(150,200,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(drone.X, drone.Y, 46, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    },
    ember:function(_y){
        return { x:Math.random()*CW, y:_y, v:0.3 + Math.random()*0.9, r:0.8 + Math.random()*1.8, ph:Math.random()*6,
                 a:0.3 + Math.random()*0.5, c:Math.random() < 0.6 ? "255,140,70" : KAI2_GLOW };
    },
    haloImg:function(){
        if(this.halo) return this.halo;
        var c = document.createElement("canvas"), x = c.getContext("2d");
        c.width = c.height = 64;
        var g = x.createRadialGradient(32,32,2,32,32,32);
        g.addColorStop(0, "rgba(255,120,190,0.9)");
        g.addColorStop(0.35, "rgba(200,60,220,0.35)");
        g.addColorStop(1, "rgba(150,40,220,0)");
        x.fillStyle = g; x.fillRect(0,0,64,64);
        return this.halo = c;
    },
    //いちばん手前：ため・無音の暗闇と、奥にいる改・着く所の印

    drawFront:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type != "kai" || !e.fsMode || e.fsMode == "breath") continue;
            if(e.fsMode == "hush"){
                //時が止まったように周りの色が抜ける(改だけ色が残る)
                var u = Math.min(1, (this.pos() - FS_SECTIONS[5].from)/0.4);
                ctx.globalCompositeOperation = "saturation";
                ctx.fillStyle = "rgba(128,128,128," + (FS_DRAIN*u) + ")";
                ctx.fillRect(-20,-20,CW + 40,CH + 40);
                ctx.globalCompositeOperation = "source-over";
            }
            ctx.fillStyle = "rgba(6,3,12," + (e.fsDark || 0) + ")";
            ctx.fillRect(-20,-20,CW + 40,CH + 40);
            if(e.fsMode == "hush"){
                var p = this.pos(), left = FS_HIT_T - p;
                var col = left <= FS_JUST_SEC ? JUST_COLOR : (e.fsLocked ? "220,40,40" : "255,255,255");
                var k = Math.max(0, Math.min(1, 1 - left/(FS_HIT_T - FS_SECTIONS[5].from)));
                ctx.strokeStyle = "rgba(" + col + "," + (0.4 + 0.5*k) + ")";
                ctx.lineWidth = 2 + 2*k;
                ctx.beginPath(); ctx.arc(e.fsTx, e.fsTy, FS_RAM_R, 0, Math.PI*2); ctx.stroke();
                //縮んでくる輪：重なったときが着く瞬間
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(e.fsTx, e.fsTy, FS_RAM_R + 140*(1 - k), 0, Math.PI*2); ctx.stroke();
                ctx.lineWidth = 1;
            }
            this.drawing = true;
            mainScreen.drawEnemy(e);
            this.drawing = false;
        }
    }
};

(function(){
    monarch.startAt = FS_START;
    var kai = special.kai, draw = special.draw, onBlast = shotLab.onBlast, drawFront = shotLab.drawFront, drawUnder = shotLab.drawUnder;
    var play = sound.play, drawHud = mainScreen.drawHud, drawBossBar = special.drawBossBar;
    //夜の色の上でも上の表示が読めるよう、天蓋母艦のときと同じ明るい板を敷く
    mainScreen.drawHud = function(){
        if(finaleSync.live() && !special.canopyOf()){
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            enemyArt.roundRect(4, 4, 236, 90, 8); ctx.fill();
            enemyArt.roundRect(CW - 324, 4, 320, 88, 8); ctx.fill();
        }
        drawHud.call(this);
    };
    special.drawBossBar = function(){
        if(finaleSync.live()){
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            enemyArt.roundRect(CW/2 - 174, 38, 348, 44, 8); ctx.fill();
        }
        drawBossBar.call(this);
    };
    shotLab.drawUnder = function(){
        drawUnder.call(this);
        finaleSync.drawUnder();
    };
    //第二形態の間は、細かい効果音を小さくする(曲を主役に)
    sound.play = function(_name){
        if(!finaleSync.live() || FS_SE_QUIET.indexOf(_name) < 0 || !this.ready()) return play.call(this,_name);
        var S = this.seGain;
        this.seGain = fsSfx.quiet();
        play.call(this,_name);
        this.seGain = S;
    };
    special.kai = function(_e,_dx,_dy,_d){
        if(finaleSync.step(_e,_dx,_dy,_d)) return;
        kai.call(this,_e,_dx,_dy,_d);
    };
    special.draw = function(_e,_body){
        var self = this;
        if(_e.type == "kai" && _e.fsR0 != null) return finaleSync.draw(_e, _body, function(){ draw.call(self,_e,_body); });
        return draw.call(this,_e,_body);
    };
    shotLab.onBlast = function(){
        onBlast.call(this);
        finaleSync.onBlast();
    };
    shotLab.drawFront = function(){
        drawFront.call(this);
        finaleSync.drawFront();
    };
})();


//------------------------------------------------------------------------------
//  最終局面の重い効果音(合成)。低い音・ノイズ・残響を重ねて、曲の大きさに負けない音にする
//------------------------------------------------------------------------------
var fsSfx = {
    ctx:null,       //配線を作ったときの sound.ctx
    out:null,       //重い効果音の出口(→ sound.seGain)
    wet:null,       //残響への入口
    duck:null,      //細かい効果音の出口(小さくして sound.seGain へ)
    rum:null,       //鳴っているうなり
    //配線(はじめて使うとき・音の仕組みが作り直されたときに作る)
    rig:function(){
        var c = sound.ctx;
        if(this.ctx == c) return c;
        this.ctx = c;
        this.out = c.createGain();
        this.out.gain.value = FS_SE_VOL;
        this.out.connect(sound.seGain);
        //残響の元(減衰するノイズ。左右で別のノイズにして広がりを出す)
        var rv = c.createConvolver(), n = Math.floor(c.sampleRate*FS_REVERB_SEC), b = c.createBuffer(2, n, c.sampleRate);
        for(var ch=0; ch<2; ch++){
            var d = b.getChannelData(ch);
            for(var i=0; i<n; i++) d[i] = (Math.random()*2 - 1)*Math.pow(1 - i/n, 3);
        }
        rv.buffer = b;
        this.wet = c.createGain();
        this.wet.gain.value = 0.35;
        this.wet.connect(rv); rv.connect(this.out);
        this.duck = c.createGain();
        this.duck.gain.value = FS_SE_DUCK;
        this.duck.connect(sound.seGain);
        //長いノイズ(高まる音・うなりに使う)
        this.noise = c.createBuffer(1, c.sampleRate*4, c.sampleRate);
        var d = this.noise.getChannelData(0);
        for(var i=0; i<d.length; i++) d[i] = Math.random()*2 - 1;
        return c;
    },
    ok:function(){ return sound.seOn && sound.ready(); },
    quiet:function(){ this.rig(); return this.duck; },
    //音を出口(そのままと残響)へつなぐ
    send:function(_node,_wet){
        _node.connect(this.out);
        if(_wet) _node.connect(this.wet);
    },
    //音量の形：_a 秒で立ち上がり、_hold 秒保って、_decay 秒で消える
    env:function(_t,_v,_a,_hold,_decay){
        var g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, _t);
        g.gain.exponentialRampToValueAtTime(_v, _t + _a);
        g.gain.setValueAtTime(_v, _t + _a + _hold);
        g.gain.exponentialRampToValueAtTime(0.0001, _t + _a + _hold + _decay);
        return g;
    },
    //音の高さを _f0 から _f1 へ動かす(_cut：こもらせる周波数)
    osc:function(_type,_f0,_f1,_t,_dur,_gain,_wet,_cut){
        var c = this.ctx, o = c.createOscillator(), n = o;
        o.type = _type;
        o.frequency.setValueAtTime(_f0, _t);
        if(_f1 != _f0) o.frequency.exponentialRampToValueAtTime(_f1, _t + _dur);
        if(_cut){ var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = _cut; o.connect(f); n = f; }
        n.connect(_gain);
        this.send(_gain, _wet);
        o.start(_t); o.stop(_t + _dur + 0.1);
    },
    //ノイズ(_type のフィルターを _f0 から _f1 へ動かす)
    hiss:function(_type,_f0,_f1,_t,_dur,_gain,_wet,_q){
        var c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter();
        s.buffer = this.noise; s.loop = true;
        f.type = _type; f.Q.value = _q || 1;
        f.frequency.setValueAtTime(_f0, _t);
        f.frequency.exponentialRampToValueAtTime(_f1, _t + _dur);
        s.connect(f); f.connect(_gain);
        this.send(_gain, _wet);
        s.start(_t, Math.random()*2); s.stop(_t + _dur + 0.1);
    },
    //ため：低いうなりが _sec 秒かけてふくらみ、だんだん明るくなる
    rumble:function(_sec){
        if(!this.ok() || _sec <= 0.2) return;
        var c = this.rig(), t = c.currentTime, end = t + _sec;
        this.stopRumble();
        var g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, end);
        var f = c.createBiquadFilter();
        f.type = "lowpass"; f.Q.value = 4;
        f.frequency.setValueAtTime(120, t);
        f.frequency.exponentialRampToValueAtTime(900, end);
        f.connect(g);
        this.send(g, true);
        var list = [41, 41.6, 61.7].map(function(_hz){
            var o = c.createOscillator();
            o.type = "sawtooth"; o.frequency.value = _hz;
            o.connect(f); o.start(t); o.stop(end + 0.2);
            return o;
        });
        this.rum = { g:g, list:list };
    },
    //うなりを止める(曲が無音になるのと一緒に、すっと消える)
    stopRumble:function(){
        if(!this.rum) return;
        var t = this.ctx.currentTime, g = this.rum.g.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(Math.max(0.0001, g.value), t);
        g.exponentialRampToValueAtTime(0.0001, t + 0.08);
        this.rum.list.forEach(function(o){ try{ o.stop(t + 0.15); }catch(e){} });
        this.rum = null;
    },
    //無音：着く瞬間(_sec 秒後)へ向けて、風の音と音の高さが上がっていき、着く直前に途切れる
    riser:function(_sec){
        if(!this.ok() || _sec <= 0.1) return;
        var c = this.rig(), t = c.currentTime, end = t + _sec - 0.04;
        var g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, end);
        g.gain.linearRampToValueAtTime(0, end + 0.03);
        this.hiss("bandpass", 250, 7000, t, _sec, g, true, 3);
        var g2 = c.createGain();
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.exponentialRampToValueAtTime(0.12, end);
        g2.gain.linearRampToValueAtTime(0, end + 0.03);
        this.osc("sawtooth", 110, 880, t, _sec, g2, true, 2400);
    },
    //衝突：重い衝撃音に、低く沈む音を重ねる。_big(弾き返した・放つ)のときは低い和音のうなりも
    impact:function(_big){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        sound.heavyBoom(this.out);
        this.osc("sine", 90, 26, t, 2.2, this.env(t, 0.9, 0.01, 0.25, 2), false);
        this.hiss("lowpass", 3000, 120, t, 1.6, this.env(t, 0.5, 0.005, 0.05, 1.5), true);
        if(!_big) return;
        //ぶおーん：少しずつずらした のこぎり波を重ね、こもらせる
        var self = this;
        [55, 55.4, 82.4, 110.3, 164.8].forEach(function(_hz, _i){
            self.osc("sawtooth", _hz, _hz*0.985, t, 3, self.env(t, _i < 2 ? 0.12 : 0.07, 0.04, 0.6, 2.4), true, 700);
        });
    },
    //風を切る音(吹き飛ぶ)
    whoosh:function(_delay){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime + (_delay || 0);
        this.hiss("bandpass", 2600, 260, t, 0.7, this.env(t, 0.45, 0.05, 0.05, 0.6), true, 2);
    }
};
