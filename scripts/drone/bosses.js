//------------------------------------------------------------------------------
//  レア敵・ボス
//------------------------------------------------------------------------------
const RARE_RATE  = 0.06;    //敵が出るたびにレア敵になる確率(WAVE2から)
const RARE_MAX   = 2;       //1WAVEに出るレア敵の最大数
const BOSS_EVERY = 5;       //このWAVEごとにボスが出る
const MINION_MAX = 6;       //女王蜂の手下が同時にいられる数
//女王蜂の突進の予備動作(パリィの試作)：構えの長さを毎回変え、フェイント・連続突進を混ぜる
//本物の突進の前だけ、針が白く光って羽が開く「合図」(QUEEN_CUE)が出る。突進にジャスト衝撃波を合わせると弾き返せる
const QUEEN_AIM       = [35,85];    //構えの長さ(フレーム。この間でばらつく。最後の QUEEN_CUE で向きが固まる)
const QUEEN_CUE       = 20;         //飛び出す直前の合図の長さ(フェイントでは出ない)
const QUEEN_FEINT     = 0.3;        //構えがフェイントになる確率(怒ると QUEEN_FEINT_RAGE)
const QUEEN_FEINT_RAGE = 0.45;
const QUEEN_FEINT_T   = 12;         //フェイントで少し前へ出てから止まる時間
const QUEEN_REAIM     = [20,45];    //フェイントのあと構え直す長さ
const QUEEN_CHAIN     = 3;          //連続突進の回数(怒ると必ず、ふだんは QUEEN_CHAIN_RATE の確率)
const QUEEN_CHAIN_RATE = 0.35;
const QUEEN_CHAIN_AIM = [24,48];    //連続突進の2回目からの構えの長さ
const QUEEN_STAGGER   = 34;         //突進を弾かれてよろける時間
const QUEEN_PARRY_DMG = 5;          //突進を弾いたときのダメージ
const QUEEN_PERFECT_DMG = 15;       //連続突進を全部弾いたときに足すダメージ
const QUEEN_BREAK     = 150;        //連続突進を全部弾いたとき、目を回して止まる時間

const RARE_TYPES = {
    goldbug: { name:"金色虫", r:10, hp:3, speed:3.4, score:100, parts:10 },  //逃げ回る。倒すとパーツが大量
    carrier: { name:"補給機", r:18, hp:8, speed:0.9, score:150, parts:3 }    //横切るだけ。倒すと報酬カプセル
};
const BOSS_TYPES = {
    //en・title：登場のときに出す英語名と異名
    queen:    { name:"女王蜂",   r:34, en:"QUEEN BEE",       title:"群れを統べる女王" },   //弾の輪・手下を呼ぶ・突進
    fortress: { name:"移動要塞", r:40, en:"MOBILE FORTRESS", title:"動く鉄壁" },           //渦巻き弾・3方向弾・なぎ払いレーザー
    kai:      { name:"ドローン君改", r:28, en:"DRONE-KUN KAI", title:"もうひとりのドローン君" } //最終ボス：ドローン君と同じ武器をたくさん使う
};

//ドローン君改の攻撃の順番(体力が減るほど種類が増える)
const KAI_PATTERNS = {
    1:["missile","gunstorm","bugs"],
    2:["laser","mines","missile","bugs"],
    3:["dragon","tesla","water","laser","missile"]
};
const KAI_REST = [0,150,130,110];   //攻撃と攻撃の間(フェーズ1～3)

function isBossWave(_w){
    return _w % BOSS_EVERY == 0;
}
//女王蜂と移動要塞が交互に出る
function bossTypeFor(_w){
    if(_w >= FINAL_WAVE) return "kai";
    return (_w / BOSS_EVERY) % 2 == 1 ? "queen" : "fortress";
}

function makeRare(_type){
    var T = RARE_TYPES[_type];
    var hp = Math.ceil(T.hp * (1 + (game.wave-1)*ENEMY_HP_GROW)*difficulty().hp) * coop.hpMul();
    var e = {
        id:++enemySeq,
        type:_type, rare:true, name:T.name, r:T.r, hp:hp, maxHp:hp, score:T.score, parts:T.parts,
        speed:T.speed, x:0, y:0, vx:0, vy:0, flash:0, timer:0, t:0, dead:false, slow:0, bladeCd:0
    };
    if(_type == "goldbug"){
        placeAtEdge(e);
        e.life = 540;       //この時間が過ぎると逃げていく
        e.wander = Math.random()*Math.PI*2;
    }else{
        //左右どちらかの端から反対側へ横切る
        e.dir = Math.random() < 0.5 ? 1 : -1;
        e.x = e.dir > 0 ? -30 : CW + 30;
        e.y = 90 + Math.random()*(CH - 180);
    }
    return e;
}

function makeBoss(_type){
    var T = BOSS_TYPES[_type];
    var hp = Math.round((60 + (game.wave - BOSS_EVERY)*16)*difficulty().hp) * coop.hpMul();
    var b = {
        id:++enemySeq,
        type:_type, boss:true, name:T.name, r:T.r, hp:hp, maxHp:hp,
        score:1000 + game.wave*50, parts:15,
        speed:1.5, x:CW/2, y:-60, vx:0, vy:0, flash:0, timer:60, t:0, dead:false, slow:0, bladeCd:0,
        mode:"enter", pat:0, enraged:false,
        hx:CW/2, hy:130,        //女王蜂の移動先
        aimX:0, aimY:1,         //突進の向き
        angle:Math.PI/2,        //要塞の砲の向き
        spin:0,                 //要塞の渦巻き弾の角度
        count:0
    };
    if(_type == "kai"){
        //ドローン君改：赤いドローン君。見た目の動きもドローン君と同じ部品で
        //(雑魚のいない一騎打ちで、3段階の攻撃を全部見られるよう体力は少し控えめ)
        b.hp = b.maxHp = Math.round(hp*0.8);
        b.look = new DroneLook();
        b.look.tint = "190,20,30";
        b.phase = 1;
        b.orbit = -Math.PI/2;
        b.gunT = 90;
        b.bladeA = 0;
        b.cycle = 0;
        b.mines = [];       //まいた地雷
        b.strikes = [];     //落雷の予告
        b.waterT = 0;       //水鉄砲を撃っている残り時間
        b.circleT = 0;      //五芒星の陣を出している残り時間
    }
    return b;
}

//------------------------------------------------------------------------------
//  動き(mainScreen.updateEnemiesから呼ばれる)
//------------------------------------------------------------------------------
var special = {
    //レア敵・ボスならtrueを返す
    update:function(_e,_dx,_dy,_d){
        switch(_e.type){
            case "goldbug":  this.goldbug(_e,_dx,_dy,_d); return true;
            case "carrier":  this.carrier(_e); return true;
            case "queen":    this.queen(_e,_dx,_dy,_d); return true;
            case "fortress": this.fortress(_e,_dx,_dy,_d); return true;
            case "kai":      this.kai(_e,_dx,_dy,_d); return true;
        }
        return false;
    },

    //画面の外に逃げたら消える(倒した扱いにはしない)
    escape:function(_e){
        if(_e.x < -60 || _e.x > CW+60 || _e.y < -60 || _e.y > CH+60){
            _e.dead = true;
            popup(Math.max(60,Math.min(_e.x,CW-60)), Math.max(70,Math.min(_e.y,CH-30)), _e.name + "に逃げられた…", "#888");
        }
    },

    goldbug:function(_e,_dx,_dy,_d){
        _e.life--;
        var tx, ty;
        if(_e.life <= 0){
            //時間切れ：画面の外へ向かう
            tx = _e.x - CW/2; ty = _e.y - CH/2;
            var l = Math.hypot(tx,ty) || 1;
            tx /= l; ty /= l;
            if(_e.life < -20) this.escape(_e);
        }else{
            //近づくと逃げる。それ以外はふらふら飛ぶ。画面の端は避ける
            _e.wander += (Math.random() - 0.5)*0.3;
            tx = Math.cos(_e.wander)*0.6;
            ty = Math.sin(_e.wander)*0.6;
            if(_d < 260){ tx -= _dx/_d*1.2; ty -= _dy/_d*1.2; }
            if(_e.x < 60) tx += 1;
            if(_e.x > CW-60) tx -= 1;
            if(_e.y < 60) ty += 1;
            if(_e.y > CH-60) ty -= 1;
            var l = Math.hypot(tx,ty) || 1;
            tx /= l; ty /= l;
        }
        _e.vx += (tx*_e.speed - _e.vx)*0.08;
        _e.vy += (ty*_e.speed - _e.vy)*0.08;
        if(_e.t % 6 == 0){
            effects.push({ x:_e.x + (Math.random()-0.5)*14, y:_e.y + (Math.random()-0.5)*14, vx:0, vy:-0.4,
                           life:20, maxLife:20, size:3, color:"#e6b422" });
        }
    },

    carrier:function(_e){
        _e.vx = _e.dir*_e.speed;
        _e.vy = Math.sin(_e.t*0.03)*0.5;
        if(_e.t > 60) this.escape(_e);
    },

    //ボス共通：画面上から降りてくる。体力が半分を切ると怒る
    bossCommon:function(_e){
        if(_e.mode == "enter"){
            _e.vx = 0;
            _e.vy = 1.5;
            if(_e.y >= 160){ _e.mode = "idle"; _e.vy = 0; this.bossLanded(_e); }
            return false;
        }
        if(!_e.enraged && _e.hp < _e.maxHp/2 && _e.type != "kai"){
            _e.enraged = true;
            mainScreen.shake = 15;
            popup(_e.x,_e.y - _e.r - 10,_e.name + "が怒った！","#c33");
            sound.play("warning");
        }
        return true;
    },

    //ボスが降りきった：着地の衝撃(衝撃波・土煙・閃光・大きな揺れ)。協力プレイのゲストは coop.guestSync から
    bossLanded:function(_e){
        //ドローン君改は着地ではなく、始動して開幕する(mainScreen.kaiIgnite)
        if(_e.type == "kai"){ mainScreen.kaiIgnite(_e); return; }
        var x = _e.x, y = _e.y + _e.r*0.6;
        fx.ring(x,y,260,"255,210,140",28,10);
        fx.ring(x,y,170,"200,190,180",20,6);
        fx.flare(x,y,_e.r*3,"255,240,210",14);
        for(var i=0; i<18; i++){
            //土煙(左右に広がる)
            var a = Math.PI*(i % 2 ? 0.05 : 0.95) + (Math.random()-0.5)*0.6, s = 2 + Math.random()*4;
            var life = 40 + Math.random()*30;
            effects.push({ smoke:true, x:x, y:y, vx:Math.cos(a)*s, vy:Math.sin(a)*s*0.4 - 0.3,
                           R0:8, R1:26 + Math.random()*20, life:life, maxLife:life, color:"120,110,100" });
        }
        burst(x,y,24,"#555");
        fx.tint("255,255,255",14);
        fx.shake(30);
        battleBg.ripple(x, y, 48, 10, 85, "230,150,70");
        sound.play("bossImpact");
        //「ドンッ!!」：画面ごと止めて、寄って、文字を出す。ここで登場の演出は終わり(みんな動き出す)
        var M = mainScreen;
        M.hitStop = BOSS_HITSTOP;
        M.zoomT = ZOOM_TIME;
        M.zoomX = x; M.zoomY = y;
        M.donT = DON_TIME;
        M.flashT = FLASH_TIME;
        //ドローン君が現れる(光の輪と一緒に。現れてすぐは少しのあいだ無敵)
        M.droneIn = DRONE_IN_TIME;
        M.guard = Math.max(M.guard, 60);
        fx.ring(drone.X, drone.Y, 46, "80,160,255", 22, 3);
        fx.flare(drone.X, drone.Y, 40, "120,190,255", 18);
        M.donX = x;
        M.donY = Math.min(CH - 90, y + 110);
        M.bossFreeze = false;
    },

    //弾をばらまく(_n発を等間隔に)
    ring:function(_x,_y,_n,_speed,_offset,_kind){
        fireRing(_x,_y,Math.round(_n*Math.min(1.4,danmaku())),_speed*Math.min(1.3,danmaku()),_offset,_kind);
        sound.play("bossShot");
    },

    queen:function(_e,_dx,_dy,_d){
        if(!this.bossCommon(_e)) return;
        switch(_e.mode){
            case "idle":
                //画面上半分をゆらゆら移動しながら、次の攻撃を待つ
                //画面上部のHUDには重ならない高さ(y130～250)にいる
                if(_e.t % 180 == 0){
                    _e.hx = 120 + Math.random()*(CW - 240);
                    _e.hy = 130 + Math.random()*120;
                }
                _e.vx += ((_e.hx - _e.x)*0.02 - _e.vx)*0.1;
                _e.vy += ((_e.hy - _e.y)*0.02 + Math.sin(_e.t*0.05)*0.3 - _e.vy)*0.1;
                _e.timer--;
                if(_e.timer <= 0){
                    var p = _e.pat++ % 3;
                    if(p == 0){
                        //弾の輪(大小2重。怒ると3重)
                        this.ring(_e.x,_e.y,_e.enraged ? 18 : 12,2.2,_e.t*0.1,"normal");
                        this.ring(_e.x,_e.y,_e.enraged ? 10 : 6,1.4,_e.t*0.1 + 0.2,"big");
                        if(_e.enraged) this.ring(_e.x,_e.y,18,3.0,_e.t*0.1 + Math.PI/18,"small");
                        _e.timer = _e.enraged ? 70 : 110;
                    }else if(p == 1){
                        //手下の虫を呼ぶ(生きている手下は最大6匹まで)
                        var alive = enemies.filter(function(m){ return m.minion && !m.dead; }).length;
                        var n = Math.min(_e.enraged ? 4 : 3, MINION_MAX - alive);
                        for(var i=0; i<n; i++){
                            var m = makeEnemy("bug");
                            var a = i*Math.PI*2/n;
                            m.x = _e.x + Math.cos(a)*(_e.r + 16);
                            m.y = _e.y + Math.sin(a)*(_e.r + 16);
                            m.parts = 0;
                            m.score = 5;
                            m.minion = true;
                            enemies.push(m);
                        }
                        if(n > 0) sound.play("summon");
                        _e.timer = _e.enraged ? 60 : 100;
                    }else{
                        //突進の構え(連続突進になることもある)
                        _e.chain = _e.enraged || Math.random() < QUEEN_CHAIN_RATE ? QUEEN_CHAIN - 1 : 0;
                        _e.dashes = _e.chain + 1;   //この突進の回数(全部弾いたか数えるため)
                        _e.parried = 0;
                        this.queenAim(_e,QUEEN_AIM,true);
                    }
                }
                break;
            case "aim":
                //最初は狙いを合わせ、合図(最後の QUEEN_CUE)で向きを固定する
                _e.vx *= 0.8; _e.vy *= 0.8;
                if(_e.count > QUEEN_CUE){ _e.aimX = _dx/_d; _e.aimY = _dy/_d; }
                if(_e.count == QUEEN_CUE && !_e.fake) sound.play("tell");
                if(--_e.count <= 0){
                    if(_e.fake){
                        //フェイント：少し前へ出て止まり、構え直す
                        _e.fake = false;
                        _e.mode = "feint";
                        _e.count = QUEEN_FEINT_T;
                        _e.vx = _e.aimX*3; _e.vy = _e.aimY*3;
                    }else{
                        _e.mode = "dash";
                        _e.count = 32;
                        sound.play("dash");
                    }
                }
                break;
            case "feint":
                _e.vx *= 0.85; _e.vy *= 0.85;
                if(--_e.count <= 0) this.queenAim(_e,QUEEN_REAIM,false);
                break;
            case "dash":
                _e.vx = _e.aimX*8;
                _e.vy = _e.aimY*8;
                if(--_e.count <= 0 || _e.x < _e.r || _e.x > CW - _e.r || _e.y < _e.r || _e.y > CH - _e.r){
                    _e.x = Math.max(_e.r, Math.min(_e.x, CW - _e.r));
                    _e.y = Math.max(_e.r, Math.min(_e.y, CH - _e.r));
                    _e.vx = 0; _e.vy = 0;
                    if(_e.chain > 0){
                        //連続突進：すぐ振り向いて次を構える
                        _e.chain--;
                        this.queenAim(_e,QUEEN_CHAIN_AIM,false);
                        break;
                    }
                    this.queenRest(_e);
                    //怒っていると突進の終わりに弾をばらまく
                    this.ring(_e.x,_e.y,_e.enraged ? 14 : 6,2.4,Math.random(),"small");
                }
                break;
            case "stagger":
                //弾かれてよろける(連続突進を全部弾かれたときは長く目を回す)
                _e.vx *= 0.9; _e.vy *= 0.9;
                if(--_e.count <= 0){
                    if(_e.chain > 0){ _e.chain--; this.queenAim(_e,QUEEN_CHAIN_AIM,false); }
                    else this.queenRest(_e);
                }
                break;
        }
    },
    //女王蜂が突進を構える(_range：構えの長さの範囲。_mayFake：フェイントになりうるか)
    queenAim:function(_e,_range,_mayFake){
        _e.mode = "aim";
        _e.count = randIn(_range) + QUEEN_CUE;
        _e.fake = _mayFake && Math.random() < (_e.enraged ? QUEEN_FEINT_RAGE : QUEEN_FEINT);
    },
    //突進を終えて、ふだんの動きへ戻る
    queenRest:function(_e){
        _e.mode = "idle";
        _e.hy = 130 + Math.random()*120;
        _e.timer = _e.enraged ? 40 : 70;
    },
    //突進をジャスト衝撃波で弾かれた(mainScreen.counter から。動かすのはホストとひとり用だけ)
    //連続突進を全部弾くと、大きなダメージを受けて長く目を回す
    parry:function(_e){
        if(_e.type != "queen" || _e.mode != "dash") return;
        _e.parried = (_e.parried || 0) + 1;
        var perfect = _e.chain == 0 && _e.dashes > 1 && _e.parried >= _e.dashes;
        _e.mode = "stagger";
        _e.count = perfect ? QUEEN_BREAK : QUEEN_STAGGER;
        _e.vx = -_e.aimX*7; _e.vy = -_e.aimY*7;
        _e.flash = 10;
        fx.flare(_e.x, _e.y, 50, JUST_COLOR, 14);
        fx.sparks(_e.x, _e.y, 16, JUST_COLOR, 8, 3);
        popup(_e.x, _e.y - _e.r - 10, perfect ? "連続カウンター！" : _e.dashes > 1 ? _e.parried + "/" + _e.dashes : "カウンター！", "rgb(30,150,200)");
        mainScreen.hitEnemy(_e, QUEEN_PARRY_DMG + (perfect ? QUEEN_PERFECT_DMG : 0), "counter");
        if(perfect){
            fx.flare(_e.x, _e.y, 120, JUST_COLOR, 24);
            fx.ring(_e.x, _e.y, 150, JUST_COLOR, 28, 8);
            fx.shake(12);
        }
    },

    fortress:function(_e,_dx,_dy,_d){
        if(!this.bossCommon(_e)) return;
        //画面の上を左右にゆっくり往復する
        var tx = CW/2 + Math.sin(_e.t*0.006)*(CW/2 - 130);
        var ty = 170 + Math.sin(_e.t*0.013)*30;
        _e.vx = (tx - _e.x)*0.05;
        _e.vy = (ty - _e.y)*0.05;
        var toDrone = Math.atan2(_dy,_dx);

        switch(_e.mode){
            case "idle":
                _e.angle = turnTo(_e.angle,toDrone,0.05);
                _e.timer--;
                if(_e.timer <= 0){
                    var p = _e.pat++ % 3;
                    _e.mode = ["spiral","triple","laserAim"][p];
                    _e.count = [90,70,70][p];
                    if(p == 2) sound.play("beamCharge");
                }
                break;
            case "spiral":
                //渦巻き弾(怒ると3本)
                _e.spin += 0.23;
                if(_e.count % (_e.enraged ? 5 : 6) == 0){
                    //逆回りの渦も重ねる
                    var arms = _e.enraged ? 4 : 3;
                    fireRing(_e.x,_e.y,arms,2.3*Math.min(1.3,danmaku()),_e.spin,"small");
                    if(_e.count % 12 == 0) fireRing(_e.x,_e.y,arms,1.6,-_e.spin*0.7,"big");
                    sound.play("bossShot");
                }
                if(--_e.count <= 0) this.fortressRest(_e);
                break;
            case "triple":
                //ドローンを狙った3方向弾(怒ると5方向)
                _e.angle = turnTo(_e.angle,toDrone,0.08);
                if(_e.count % 20 == 0){
                    fireFan(_e.x + Math.cos(_e.angle)*_e.r, _e.y + Math.sin(_e.angle)*_e.r, _e.angle,
                            _e.enraged ? 7 : 5, 0.2, 3.1*Math.min(1.3,danmaku()), "normal");
                    sound.play("bossShot");
                }
                if(--_e.count <= 0) this.fortressRest(_e);
                break;
            case "laserAim":
                //予告線を出しながらドローンを狙う
                _e.angle = turnTo(_e.angle,toDrone,0.04);
                if(--_e.count <= 0){
                    _e.mode = "laser";
                    _e.count = _e.enraged ? 60 : 40;
                    sound.play("beam");
                }
                break;
            case "laser":
                //撃ちながらゆっくりなぎ払う
                _e.angle = turnTo(_e.angle,toDrone,_e.enraged ? 0.014 : 0.009);
                var rx = drone.X - _e.x, ry = drone.Y - _e.y;
                var cx = Math.cos(_e.angle), cy = Math.sin(_e.angle);
                if(rx*cx + ry*cy > 0 && Math.abs(rx*cy - ry*cx) < 11 + HIT_CORE && mainScreen.canBeHit()){
                    mainScreen.damage();
                }
                if(--_e.count <= 0) this.fortressRest(_e);
                break;
        }
    },
    //------------------------------------------------------------ ドローン君改
    kai:function(_e,_dx,_dy,_d){
        if(!this.bossCommon(_e)) return;
        var play = mainScreen.state == "play";
        var toDrone = Math.atan2(_dy,_dx);

        //体力でフェーズが上がる(66%・33%)
        var ph = _e.hp > _e.maxHp*0.66 ? 1 : (_e.hp > _e.maxHp*0.33 ? 2 : 3);
        if(ph != _e.phase){
            _e.phase = ph;
            _e.timer = 40;
            if(_e.mode == "laserAim" || _e.mode == "laser") _e.mode = "idle";
            popup(_e.x,_e.y - 50,"ドローン君改　出力上昇 Lv." + ph,"#c33",true);
            fx.shake(12);
            sound.play("warning");
        }

        //ドローン君から一定の距離を保って周りを回る(追いかけ方はドローン君と同じなめらかさ)
        _e.orbit += 0.006*ph;
        var tx = Math.max(60, Math.min(CW - 60, aimAt.X + Math.cos(_e.orbit)*230));
        var ty = Math.max(100, Math.min(CH - 60, aimAt.Y + Math.sin(_e.orbit)*170));
        _e.vx = (tx - _e.x)/28;
        _e.vy = (ty - _e.y)/28;
        _e.look.update(dirFromVel(_e.vx,_e.vy), _e.vx);

        //ブレード：いつも周りを回っていて、触れると被弾
        _e.bladeA += 0.05 + ph*0.015;
        var nB = ph >= 3 ? 4 : 3;
        for(var k=0; k<nB; k++){
            var a = _e.bladeA + k*Math.PI*2/nB;
            var bx = _e.x + Math.cos(a)*64, by = _e.y + Math.sin(a)*64;
            if(Math.hypot(drone.X - bx, drone.Y - by) < 12 + HIT_CORE && mainScreen.canBeHit()) mainScreen.damage();
        }

        //実弾：いつも撃ってくる(フェーズが上がるほど扇が広い)
        if(--_e.gunT <= 0 && play){
            fireFan(_e.x,_e.y,toDrone,ph == 1 ? 1 : (ph == 2 ? 3 : 5),0.18,3.1*danmaku(),"normal");
            sound.play("shot");
            _e.gunT = 50;
        }

        //水鉄砲(撃っている間は細かい水をまき続ける)
        if(_e.waterT > 0){
            _e.waterT--;
            if(_e.waterT % 2 == 0) fireShot(_e.x,_e.y,toDrone + (Math.random()-0.5)*0.5,3.4 + Math.random(),"water");
            if(_e.waterT % 6 == 0) sound.play("water");
        }
        if(_e.circleT > 0) _e.circleT--;
        this.kaiMines(_e);
        this.kaiStrikes(_e);

        //レーザー(要塞と同じく予告線→なぎ払い)
        if(_e.mode == "laserAim"){
            _e.angle = turnTo(_e.angle,toDrone,0.04);
            if(--_e.count <= 0){ _e.mode = "laser"; _e.count = 40; sound.play("beam"); }
            return;
        }
        if(_e.mode == "laser"){
            _e.angle = turnTo(_e.angle,toDrone,0.011);
            //当たり判定は自分のドローン君(相方は相方の画面で判定する)
            var cx = Math.cos(_e.angle), cy = Math.sin(_e.angle);
            var lx = drone.X - _e.x, ly = drone.Y - _e.y;
            if(lx*cx + ly*cy > 0 && Math.abs(lx*cy - ly*cx) < 11 + HIT_CORE && mainScreen.canBeHit()) mainScreen.damage();
            if(--_e.count <= 0){ _e.mode = "idle"; _e.timer = KAI_REST[ph]; }
            return;
        }

        //ほかの攻撃は順番に1つずつ
        if(--_e.timer <= 0 && play){
            var list = KAI_PATTERNS[ph];
            this.kaiAttack(_e, list[_e.cycle++ % list.length], ph, toDrone);
            _e.timer = KAI_REST[ph];
        }
    },

    kaiAttack:function(_e,_p,_ph,_toDrone){
        switch(_p){
            case "missile":
                //左右に打ち出してから追いかけてくるミサイル
                var n = _ph >= 3 ? 4 : 2;
                for(var i=0; i<n; i++){
                    var a = _toDrone + (i % 2 ? 1 : -1)*(1.3 + 0.25*Math.floor(i/2));
                    enemyShots.push({ x:_e.x, y:_e.y, vx:Math.cos(a)*2.5, vy:Math.sin(a)*2.5, r:5, kind:"missile",
                                      homing:true, turn:0.05, speed:3.3, life:170, grazed:false });
                }
                sound.play("missile");
                break;
            case "gunstorm":
                //全方位の弾の輪(大小2重)
                fireRing(_e.x,_e.y,16,2.4*Math.min(1.3,danmaku()),Math.random(),"small");
                fireRing(_e.x,_e.y,8,1.5,Math.random(),"big");
                sound.play("bossShot");
                break;
            case "bugs":
                //虫射出：手下の虫を呼ぶ
                var alive = enemies.filter(function(m){ return m.minion && !m.dead; }).length;
                for(var i=0; i<Math.min(3, MINION_MAX - alive); i++){
                    var m = makeEnemy("bug");
                    m.x = _e.x + (Math.random()-0.5)*40; m.y = _e.y + (Math.random()-0.5)*40;
                    m.parts = 0; m.score = 5; m.minion = true;
                    enemies.push(m);
                }
                sound.play("bug");
                break;
            case "laser":
                _e.mode = "laserAim";
                _e.count = 60;
                _e.angle = _toDrone + (Math.random() < 0.5 ? 0.6 : -0.6);  //少しずれたところから狙い始める
                sound.play("beamCharge");
                break;
            case "mines":
                //自分の周りに地雷をまく。近づくと弾をまき散らして爆発
                for(var i=0; i<3; i++){
                    _e.mines.push({ x:_e.x + (Math.random()-0.5)*120, y:_e.y + (Math.random()-0.5)*120, t:0 });
                }
                sound.play("mine");
                break;
            case "tesla":
                //ドローン君の周りに落雷の予告を3つ。少しして雷が落ちる
                for(var i=0; i<3; i++){
                    var ox = i == 0 ? 0 : (Math.random()-0.5)*160, oy = i == 0 ? 0 : (Math.random()-0.5)*160;
                    _e.strikes.push({ x:aimAt.X + ox, y:aimAt.Y + oy, t:50 });
                }
                sound.play("beamCharge");
                break;
            case "water":
                _e.waterT = 40;
                break;
            case "dragon":
                //黒い五龍：五芒星の陣から出て、しばらくドローン君を追いかける
                _e.circleT = 40;
                for(var i=0; i<5; i++){
                    var a = -Math.PI/2 + i*Math.PI*2/5;
                    enemyShots.push({ x:_e.x + Math.cos(a)*40, y:_e.y + Math.sin(a)*40, vx:Math.cos(a)*3, vy:Math.sin(a)*3,
                                      r:9, kind:"dragon", homing:true, turn:0.035, speed:3.8, life:200, trail:[],
                                      color:"150,20,30", grazed:false });
                }
                fx.flare(_e.x,_e.y,60,"190,20,30",20);
                sound.play("dragon");
                break;
        }
    },

    kaiMines:function(_e){
        for(var i=_e.mines.length-1; i>=0; i--){
            var m = _e.mines[i];
            m.t++;
            var np = nearestPlayer(m.x,m.y);
            var near = m.t > 30 && Math.hypot(np.X - m.x, np.Y - m.y) < 40;
            if(near || m.t > 600){
                fireRing(m.x,m.y,10,2.2,Math.random(),"small");
                burst(m.x,m.y,10,"#c33");
                sound.play("explode");
                _e.mines.splice(i,1);
            }
        }
    },

    kaiStrikes:function(_e){
        for(var i=_e.strikes.length-1; i>=0; i--){
            var s = _e.strikes[i];
            if(--s.t > 0) continue;
            //雷が落ちる：ドローン君改から予告地点まで稲妻
            arms.bolts.push({ pts:[{x:_e.x, y:_e.y},{x:s.x, y:s.y}], life:12, maxLife:12, color:"200,30,50", w:4, glow:true });
            fx.flare(s.x,s.y,40,"200,30,50",12);
            if(Math.hypot(drone.X - s.x, drone.Y - s.y) < 34 && mainScreen.canBeHit()) mainScreen.damage();
            sound.play("zap");
            _e.strikes.splice(i,1);
        }
    },

    fortressRest:function(_e){
        _e.mode = "idle";
        _e.timer = _e.enraged ? 40 : 70;
    },

    //倒したときの特別な処理(hitEnemyから呼ばれる)
    onKill:function(_e){
        if(_e.type == "carrier"){
            mainScreen.drop("capsule",_e.x,_e.y);
        }
        if(_e.boss){
            //ボス撃破：大爆発・報酬を1回追加(協力プレイの相方にも)
            game.pendingReward = (game.pendingReward || 0) + 1;
            coop.onBossKill(_e);
            mainScreen.shake = 30;
            enemyShots = [];
            for(var i=0; i<5; i++){
                burst(_e.x + (Math.random()-0.5)*_e.r*2, _e.y + (Math.random()-0.5)*_e.r*2, 16, i % 2 ? "#e84" : "#333");
            }
            //体のあちこちで爆発が重なる
            for(var i=0; i<4; i++) killBlast(_e.x + (Math.random()-0.5)*_e.r*2.4, _e.y + (Math.random()-0.5)*_e.r*2.4, _e.r);
            effects.push({ ring:true, x:_e.x, y:_e.y, life:30, maxLife:30, R:220, color:"230,120,40" });
            popup(_e.x,_e.y - _e.r - 16,_e.name + " 撃破！　報酬+1","#c33");
            sound.stopMusic();
            sound.play("bossDown");
        }
    },

    //------------------------------------------------------------------ 描画
    //レア敵・ボスならtrueを返す(mainScreen.drawEnemyの中、translate済みの状態で呼ばれる)
    draw:function(_e,_body){
        switch(_e.type){
            case "goldbug":
                var wing = 4 + Math.abs(Math.sin(_e.t*0.7))*6;
                ctx.fillStyle = "rgba(255,230,140,0.8)";
                ctx.beginPath(); ctx.ellipse(-8,-6,wing,4,-0.5,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(8,-6,wing,4,0.5,0,Math.PI*2); ctx.fill();
                //光る輪
                ctx.strokeStyle = "rgba(230,180,34," + (0.4 + 0.3*Math.sin(_e.t*0.2)) + ")";
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(0,0,_e.r + 5,0,Math.PI*2); ctx.stroke();
                ctx.lineWidth = 1;
                ctx.fillStyle = _body || "#e6b422";
                ctx.beginPath(); ctx.arc(0,0,_e.r,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#7a5a00";
                ctx.fillRect(-5,-3,3,3); ctx.fillRect(2,-3,3,3);
                return true;

            case "carrier":
                //補給機：荷物を吊るした大きめの機体
                ctx.fillStyle = "#999";
                ctx.fillRect(-_e.r - 6,-_e.r*0.5 - 3,_e.r*2 + 12,4);
                ctx.fillStyle = _body || "#4a6fa5";
                ctx.fillRect(-_e.r,-_e.r*0.5,_e.r*2,_e.r);
                ctx.fillStyle = "#fff";
                ctx.fillRect(-4,-_e.r*0.5 + 3,8,_e.r - 6);
                ctx.fillRect(-_e.r*0.5,-2,_e.r,4);
                //吊るした報酬カプセル
                ctx.strokeStyle = "#555";
                ctx.beginPath(); ctx.moveTo(0,_e.r*0.5); ctx.lineTo(0,_e.r*0.5 + 8); ctx.stroke();
                ctx.fillStyle = "#e6b422";
                ctx.fillRect(-6,_e.r*0.5 + 8,12,10);
                return true;

            case "queen":
                //女王蜂：部位ごとに動く絵(enemyArt.js)
                enemyArt.draw(_e,_body);
                return true;

            case "kai":
                //ドローン君改：赤く光る2倍の大きさのドローン君
                var g = ctx.createRadialGradient(0,0,0,0,0,60);
                g.addColorStop(0,"rgba(200,20,30," + (0.25 + 0.1*Math.sin(_e.t*0.1)) + ")");
                g.addColorStop(1,"rgba(200,20,30,0)");
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(0,0,60,0,Math.PI*2); ctx.fill();
                //本体と改造部品(enemyArt.js)
                enemyArt.draw(_e,_body);
                return true;

            case "fortress":
                //移動要塞：部位ごとに動く絵(enemyArt.js)
                enemyArt.draw(_e,_body);
                return true;
        }
        return false;
    },

    //ボスの攻撃予告・レーザー(translateしていない状態で呼ばれる)
    drawAttack:function(_e){
        if(_e.type == "queen" && _e.mode == "aim"){
            //狙っている間は薄く、本物の突進の合図(QUEEN_CUE)で濃くなる(フェイントは薄いまま)
            var cue = !_e.fake && _e.count <= QUEEN_CUE ? 1 - _e.count/QUEEN_CUE : 0;
            ctx.strokeStyle = "rgba(220,40,40," + (0.25 + 0.6*cue) + ")";
            ctx.lineWidth = _e.r*1.2;
            ctx.globalAlpha = 0.25;
            ctx.beginPath(); ctx.moveTo(_e.x,_e.y); ctx.lineTo(_e.x + _e.aimX*1200, _e.y + _e.aimY*1200); ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        }
        if(_e.type == "kai") this.drawKaiParts(_e);
        if((_e.type == "fortress" || _e.type == "kai") && (_e.mode == "laserAim" || _e.mode == "laser")){
            var ex = _e.x + Math.cos(_e.angle)*1200, ey = _e.y + Math.sin(_e.angle)*1200;
            if(_e.mode == "laserAim"){
                ctx.strokeStyle = "rgba(220,40,40,0.6)";
                ctx.setLineDash([8,6]);
                ctx.beginPath(); ctx.moveTo(_e.x,_e.y); ctx.lineTo(ex,ey); ctx.stroke();
                ctx.setLineDash([]);
            }else{
                ctx.strokeStyle = "rgba(230,40,40,0.85)";
                ctx.lineWidth = 22 + Math.sin(_e.t*0.8)*4;
                ctx.beginPath(); ctx.moveTo(_e.x,_e.y); ctx.lineTo(ex,ey); ctx.stroke();
                ctx.strokeStyle = "rgba(255,255,255,0.9)";
                ctx.lineWidth = 8;
                ctx.stroke();
                ctx.lineWidth = 1;
            }
        }
    },

    //ドローン君改の地雷・落雷の予告・五芒星の陣・ブレード
    drawKaiParts:function(_e){
        for(var i=0; i<_e.mines.length; i++){
            var m = _e.mines[i];
            ctx.fillStyle = "#5a1a1e";
            ctx.beginPath(); ctx.arc(m.x,m.y,8,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = (m.t > 30 && Math.floor(m.t/10) % 2 == 0) ? "#ff3040" : "#822";
            ctx.fillRect(m.x - 2.5,m.y - 2.5,5,5);
            if(m.t > 30){
                ctx.strokeStyle = "rgba(200,30,50,0.25)";
                ctx.beginPath(); ctx.arc(m.x,m.y,40,0,Math.PI*2); ctx.stroke();
            }
        }
        for(var i=0; i<_e.strikes.length; i++){
            var s = _e.strikes[i];
            var k = 1 - s.t/50;
            ctx.strokeStyle = "rgba(200,30,50," + (0.3 + 0.6*k) + ")";
            ctx.lineWidth = 2;
            ctx.setLineDash([5,4]);
            ctx.beginPath(); ctx.arc(s.x,s.y,34,0,Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(200,30,50," + (0.15*k) + ")";
            ctx.beginPath(); ctx.arc(s.x,s.y,34*k,0,Math.PI*2); ctx.fill();
            ctx.lineWidth = 1;
        }
        if(_e.circleT > 0){
            var a = _e.circleT/40, R = 50;
            ctx.strokeStyle = "rgba(150,20,30," + a + ")";
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(_e.x,_e.y,R,0,Math.PI*2); ctx.stroke();
            ctx.beginPath();
            for(var i=0; i<=5; i++){
                var p = -Math.PI/2 + (i*2 % 5)*Math.PI*2/5;
                if(i == 0) ctx.moveTo(_e.x + Math.cos(p)*R, _e.y + Math.sin(p)*R);
                else ctx.lineTo(_e.x + Math.cos(p)*R, _e.y + Math.sin(p)*R);
            }
            ctx.stroke();
            ctx.lineWidth = 1;
        }
        //ブレード(赤黒い刃が回る)
        var nB = _e.phase >= 3 ? 4 : 3;
        for(var k=0; k<nB; k++){
            var a = _e.bladeA + k*Math.PI*2/nB;
            ctx.save();
            ctx.translate(_e.x + Math.cos(a)*64, _e.y + Math.sin(a)*64);
            ctx.rotate(a + _e.bladeA*3);
            ctx.fillStyle = "#7a1018";
            ctx.beginPath();
            ctx.moveTo(14,0); ctx.lineTo(0,5); ctx.lineTo(-14,0); ctx.lineTo(0,-5);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    },

    //画面上部のボスの体力ゲージ
    drawBossBar:function(){
        var b = null;
        for(var i=0; i<enemies.length; i++){ if(enemies[i].boss && !enemies[i].dead) b = enemies[i]; }
        if(!b) return;
        var w = 320, x = CW/2 - w/2, y = 64;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = b.enraged ? "#c33" : "#000";
        ctx.fillText("BOSS　" + b.name + (b.enraged ? "（怒り）" : ""),CW/2,y - 12);
        ctx.fillStyle = "#ddd";
        ctx.fillRect(x,y,w,10);
        ctx.fillStyle = "#c33";
        ctx.fillRect(x,y,w*Math.max(0,b.hp)/b.maxHp,10);
        ctx.strokeStyle = "#000";
        ctx.strokeRect(x + 0.5,y + 0.5,w - 1,9);
        ctx.fillStyle = "#000";
    }
};

//角度_aを目標_toへ最大_stepだけ近づける
function turnTo(_a,_to,_step){
    var diff = _to - _a;
    while(diff > Math.PI) diff -= Math.PI*2;
    while(diff < -Math.PI) diff += Math.PI*2;
    return _a + Math.max(-_step, Math.min(_step, diff));
}
