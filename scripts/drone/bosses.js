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
    kai:      { name:"ドローン君改", r:28, en:"DRONE-KUN KAI", title:"もうひとりのドローン君" }, //最終ボス：ドローン君と同じ武器をたくさん使う
    canopy:   { name:"天蓋母艦", r:44, en:"SKY CANOPY", title:"空を覆いつくす影" }    //WAVE15：画面の上を覆って動かない。弾の雨・レーザー・弾の波・手下
};

//天蓋母艦(WAVE15のボス)：画面の上を端から端まで覆い、動かない。当たり判定はまんなかのコア(r)。
//船体の下に壊せる砲台(pod。別の敵)がぶら下がり、壊すとコアにもダメージが入る。ドローン君は船体の下までしか上がれない
const CANOPY_Y        = 110;        //コアの高さ(動かない)
const CANOPY_FLOOR    = 200;        //ドローン君の中心が上がれるいちばん上(船体の下のふちより少し下)
const CANOPY_EDGE     = [[0,66],[70,60],[130,46],[200,40],[270,30],[350,34],[430,24],[520,26]];  //船体の下のふち(コアからの横のずれ, コアからの下のずれ。左右対称)
const CANOPY_PODS     = [110,290,670,850];  //砲台のx(左から。0と3は外側)
const CANOPY_POD_DY   = 46;         //砲台の高さ(コアからの下のずれ)
const CANOPY_POD_R    = 20;
const CANOPY_HP_MUL  = 0.8;        //コアの体力(ほかのボスと同じ式の値に掛ける。砲台も壊すので少なめ)
const CANOPY_POD_HP   = 0.12;       //砲台の体力(ほかのボスと同じ式の値に掛ける)
const CANOPY_POD_DMG  = 0.06;       //砲台を壊すとコアに入るダメージ(コアの体力に掛ける)
const CANOPY_POD_EVERY = [150,105]; //砲台が撃つ間隔(フレーム。ふだん・怒り)
const CANOPY_POD_DEPLOY = 40;       //着地のあと、砲台が船体から降りてくる時間(この間は撃たない)
const CANOPY_POD_NEAR  = 110;      //ドローン君がこれより近いと撃たない(真下で撃たれるとよけようがないので)
const CANOPY_PATTERNS = ["rain","laserAim","wave","summon"];   //コアの攻撃の順番
const CANOPY_REST     = [80,50];    //攻撃と攻撃の間(ふだん・怒り)
const CANOPY_RAIN_T   = 130;        //弾の雨の長さ(フレーム)
const CANOPY_RAIN_EVERY = [9,7];    //弾の雨を落とす間隔(ふだん・怒り)
const CANOPY_VENTS    = 12;         //弾の雨を落とす口の数(船体の下に等間隔)
const CANOPY_RAIN_GAP = [95,75];    //弾の雨のすき間の半分の幅(左右へゆっくり動く。ふだん・怒り)
const CANOPY_WAVE_T   = 100;        //弾の波の長さ(フレーム。CANOPY_WAVE_GAP ごとに撃つ)
const CANOPY_WAVE_GAP = 25;
const CANOPY_AIM_T    = 70;         //レーザーの予告の長さ
const CANOPY_LASER_T  = [70,95];    //レーザーの長さ(ふだん・怒り)
const CANOPY_SWEEP    = [0.006,0.009];  //レーザーがドローン君を追う速さ(ラジアン/フレーム。ふだん・怒り)
const CANOPY_MINIONS  = [3,4];      //ハッチから出す手下の数(ふだん・怒り)
const CANOPY_HATCH    = 175;        //手下を出すハッチの位置(コアから左右へ)
const CANOPY_SUMMON_T = 60;         //ハッチが開いている長さ(まんなかで手下が出る)
const CANOPY_WRECK_T  = 150;        //倒れて船体が崩れ落ちる長さ(最後の40フレームで消える)
//船体の下のふちの高さ(コアからの横のずれ_dx → 画面のy。_cyはコアのy)
function canopyEdge(_dx,_cy){
    var x = Math.abs(_dx), E = CANOPY_EDGE;
    for(var i=1; i<E.length; i++){
        if(x <= E[i][0]){
            var k = (x - E[i-1][0])/(E[i][0] - E[i-1][0]);
            return _cy + E[i-1][1] + (E[i][1] - E[i-1][1])*k;
        }
    }
    return _cy + E[E.length-1][1];
}

//ドローン君改の攻撃の順番(体力が減るほど種類が増える)
const KAI_PATTERNS = {
    1:["missile","gunstorm","bugs"],
    2:["laser","mines","missile","bugs"],
    3:["dragon","tesla","water","laser","missile"]
};
const KAI_REST = [0,150,130,110];   //攻撃と攻撃の間(フェーズ1～3)

//ドローン君改の第二形態：第一形態(フェーズ1～3)を倒すと、倒れたところから復活して第二形態(フェーズ4・5)になる
const KAI2 = { name:"ドローン君改・暴走", en:"DRONE-KUN KAI  OVERDRIVE", title:"止まらない心臓" };    //登場の名前・異名
const KAI2_HP_MUL    = 1.3;         //第二形態の体力(第一形態の体力に掛ける)
const KAI2_RAGE_HP   = 0.5;         //体力がこの割合を切るとフェーズ5(出力限界)
const KAI2_DOWN_T    = 100;         //倒れてから復活が始まるまで(フレーム)
const KAI2_REVIVE_T  = 200;         //復活の長さ(体力が満ちていく。最後の KAI_BOOT_TIME は始動音)
const KAI2_BEATS     = [6,52,90];   //復活の鼓動(復活の始まりからのフレーム)
const KAI2_TINT      = "125,20,150";    //第二形態の色(第一形態は赤 "190,20,30")
const KAI2_GLOW      = "190,60,255";    //第二形態の光の色
const KAI2_GUN_T     = 40;          //いつも撃ってくる弾の間隔(第一形態は50)
const KAI2_BLADES    = [0,3,3,4,4,5];   //フェーズごとのブレードの数
const KAI2_BEAMS     = [3,4];       //回るレーザーの本数(フェーズ4・5)
const KAI2_SPIRAL_T  = 100;         //渦巻き弾を撃つ長さ(フレーム)
const KAI2_RAIN_T    = 110;         //弾の雨を降らせる長さ(フレーム)
const KAI2_DASH_AIM  = [26,50];     //突進の構えの長さ(この間でばらつく。最後の KAI2_CUE で向きが固まる)
const KAI2_CUE       = 18;          //飛び出す直前の合図の長さ
const KAI2_DASH_SPEED = 10;         //突進の速さ(px/フレーム)
const KAI2_DASH_T    = 34;          //突進の長さ(フレーム。画面の端でも止まる)
const KAI2_CHAIN     = [2,3];       //続けて突進する回数(フェーズ4・5)
const KAI2_STAGGER   = 30;          //突進を弾かれてよろける時間
const KAI2_PARRY_DMG = 6;           //突進を弾いたときのダメージ
const KAI2_PERFECT_DMG = 20;        //続けての突進を全部弾いたときに足すダメージ
const KAI2_BREAK     = 130;         //続けての突進を全部弾いたとき、止まる時間
KAI_PATTERNS[4] = ["spiral","dash","missile","cross","tesla","dragon"];
KAI_PATTERNS[5] = ["cross","dash","rain","dragon","spiral","tesla","mines","dash","missile"];
KAI_REST.push(95,75);

function isBossWave(_w){
    return _w % BOSS_EVERY == 0;
}
//女王蜂と移動要塞が交互に出る
function bossTypeFor(_w){
    if(_w >= FINAL_WAVE) return "kai";
    if(_w == REVEAL_WAVE) return "canopy";
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
        b.form = 1;         //1：第一形態 2：第二形態(倒れると復活して2になる)
        b.beams = 1;        //レーザーの本数(第二形態の回るレーザーで増える)
        b.spiralT = 0;      //渦巻き弾を撃っている残り時間(第二形態)
        b.rainT = 0;        //弾の雨を降らせている残り時間(第二形態)
    }
    if(_type == "canopy"){
        //天蓋母艦：画面の上の外から降りてくる(登場の演出は mainScreen.bossEntrance)
        b.y = CANOPY_Y - 260;
        b.broken = 0;       //壊された砲台の印(1<<番号。協力プレイのゲストの絵にも使う)
        b.hp = b.maxHp = Math.round(hp*CANOPY_HP_MUL);
        b.podHp = Math.max(1, Math.round(hp*CANOPY_POD_HP));
    }
    return b;
}
//天蓋母艦の砲台(船体の下にぶら下がる。動かない)
function makeCanopyPod(_boss,_slot){
    var hp = _boss.podHp;
    return {
        id:++enemySeq,
        type:"pod", pod:true, slot:_slot, owner:_boss.id, name:"砲台", r:CANOPY_POD_R, hp:hp, maxHp:hp,
        score:300, parts:3, x:CANOPY_PODS[_slot], y:_boss.y + CANOPY_POD_DY, vx:0, vy:0, flash:0, t:0, dead:false,
        slow:0, bladeCd:0, face:Math.PI/2,
        timer:CANOPY_POD_DEPLOY + 30 + _slot*Math.round(CANOPY_POD_EVERY[0]/4)    //撃つ時期を砲台ごとにずらす
    };
}
//ボスの部品(協力プレイのゲストが種類から大きさを知るため)
const BOSS_PARTS = { pod:{ name:"砲台", r:CANOPY_POD_R } };

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
            case "canopy":   this.canopy(_e,_dx,_dy,_d); return true;
            case "pod":      this.pod(_e,_dx,_dy,_d); return true;
            case "chrono":   rival.update(_e,_dx,_dy,_d); return true;     //中ボス：ライバル(rival.js)
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
            if(_e.y >= this.landY(_e)){ _e.mode = "idle"; _e.vy = 0; this.bossLanded(_e); }
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

    //ボスが降りてきて止まる高さ(天蓋母艦はコアの高さ)
    landY:function(_e){
        return _e.type == "canopy" ? CANOPY_Y : 160;
    },
    //ドローン君が上がれるいちばん上(天蓋母艦が降りきってからは船体の下まで。いなければ0)
    ceiling:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type == "canopy" && !e.dead && e.mode != "enter") return CANOPY_FLOOR;
        }
        return 0;
    },

    //ボスが降りきった：着地の衝撃(衝撃波・土煙・閃光・大きな揺れ)。協力プレイのゲストは coop.guestSync から
    bossLanded:function(_e){
        //ドローン君改は着地ではなく、始動して開幕する(mainScreen.kaiIgnite)
        if(_e.type == "kai"){ mainScreen.kaiIgnite(_e); return; }
        var x = _e.x, y = _e.y + _e.r*0.6;
        //天蓋母艦：船体の下のふち全体で土煙が上がり、砲台が降りてくる
        if(_e.type == "canopy"){ y = canopyEdge(0,_e.y); this.canopyLanded(_e); }
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
    //ドローン君改(第二形態)の突進も同じように弾ける(値は KAI2_*)
    parry:function(_e){
        if(_e.type == "chrono"){ rival.parry(_e); return; }     //ライバルの突進(rival.js)
        if((_e.type != "queen" && _e.type != "kai") || _e.mode != "dash") return;
        var kai = _e.type == "kai";
        _e.parried = (_e.parried || 0) + 1;
        var perfect = _e.chain == 0 && _e.dashes > 1 && _e.parried >= _e.dashes;
        _e.mode = "stagger";
        _e.count = perfect ? (kai ? KAI2_BREAK : QUEEN_BREAK) : (kai ? KAI2_STAGGER : QUEEN_STAGGER);
        _e.vx = -_e.aimX*7; _e.vy = -_e.aimY*7;
        _e.flash = 10;
        fx.flare(_e.x, _e.y, 50, JUST_COLOR, 14);
        fx.sparks(_e.x, _e.y, 16, JUST_COLOR, 8, 3);
        popup(_e.x, _e.y - _e.r - 10, perfect ? "連続カウンター！" : _e.dashes > 1 ? _e.parried + "/" + _e.dashes : "カウンター！", "rgb(30,150,200)");
        mainScreen.hitEnemy(_e, kai ? KAI2_PARRY_DMG + (perfect ? KAI2_PERFECT_DMG : 0)
                                    : QUEEN_PARRY_DMG + (perfect ? QUEEN_PERFECT_DMG : 0), "counter");
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
        this.kaiFx(_e);
        //倒れている・復活している間は攻撃しない(第二形態へ)
        if(_e.mode == "down" || _e.mode == "revive"){ this.kaiRevive(_e); return; }
        var play = mainScreen.state == "play";
        var toDrone = Math.atan2(_dy,_dx);
        var f2 = _e.form == 2;

        //体力でフェーズが上がる(第一形態は66%・33%で1→3、第二形態は KAI2_RAGE_HP で4→5)
        var ph = f2 ? (_e.hp > _e.maxHp*KAI2_RAGE_HP ? 4 : 5)
                    : (_e.hp > _e.maxHp*0.66 ? 1 : (_e.hp > _e.maxHp*0.33 ? 2 : 3));
        if(ph != _e.phase){
            _e.phase = ph;
            _e.timer = 40;
            if(_e.mode == "laserAim" || _e.mode == "laser") _e.mode = "idle";
            popup(_e.x,_e.y - 50,ph >= 5 ? "ドローン君改　出力限界突破" : "ドローン君改　出力上昇 Lv." + ph,f2 ? "#a3c" : "#c33",true);
            fx.shake(12);
            sound.play("warning");
        }

        //突進(第二形態)：構え → 突進 → (弾かれると)よろける。その間は回らない
        if(_e.mode == "aim" || _e.mode == "dash" || _e.mode == "stagger"){
            this.kaiDash(_e,_dx,_dy,_d);
        }else{
            //ドローン君から一定の距離を保って周りを回る(追いかけ方はドローン君と同じなめらかさ)
            _e.orbit += 0.006*Math.min(ph,4);
            var tx = Math.max(60, Math.min(CW - 60, aimAt.X + Math.cos(_e.orbit)*(f2 ? 210 : 230)));
            var ty = Math.max(100, Math.min(CH - 60, aimAt.Y + Math.sin(_e.orbit)*(f2 ? 155 : 170)));
            _e.vx = (tx - _e.x)/28;
            _e.vy = (ty - _e.y)/28;
        }
        _e.look.update(dirFromVel(_e.vx,_e.vy), _e.vx);

        //ブレード：いつも周りを回っていて、触れると被弾
        _e.bladeA += 0.05 + Math.min(ph,4)*0.015;
        var nB = this.kaiBlades(_e);
        for(var k=0; k<nB; k++){
            var a = _e.bladeA + k*Math.PI*2/nB;
            var bx = _e.x + Math.cos(a)*64, by = _e.y + Math.sin(a)*64;
            if(Math.hypot(drone.X - bx, drone.Y - by) < 12 + HIT_CORE && mainScreen.canBeHit()) mainScreen.damage();
        }

        //実弾：いつも撃ってくる(フェーズが上がるほど扇が広い)
        if(--_e.gunT <= 0 && play){
            fireFan(_e.x,_e.y,toDrone,[0,1,3,5,3,5][ph],0.18,(f2 ? 3.4 : 3.1)*danmaku(),"normal");
            sound.play("shot");
            _e.gunT = f2 ? KAI2_GUN_T : 50;
        }

        //水鉄砲(撃っている間は細かい水をまき続ける)
        if(_e.waterT > 0){
            _e.waterT--;
            if(_e.waterT % 2 == 0) fireShot(_e.x,_e.y,toDrone + (Math.random()-0.5)*0.5,3.4 + Math.random(),"water");
            if(_e.waterT % 6 == 0) sound.play("water");
        }
        //渦巻き弾(第二形態)：回りながら2方向へ渦を出す
        if(_e.spiralT > 0){
            _e.spiralT--;
            _e.spin += 0.19;
            if(_e.spiralT % 5 == 0){
                fireRing(_e.x,_e.y,ph >= 5 ? 4 : 3,2.4*Math.min(1.3,danmaku()),_e.spin,"small");
                if(_e.spiralT % 15 == 0) fireRing(_e.x,_e.y,ph >= 5 ? 4 : 3,1.6,-_e.spin*0.8,"big");
                sound.play("bossShot");
            }
        }
        //弾の雨(第二形態)：画面の上から弾が降る。通り道がわかるよう、ゆっくりめ
        if(_e.rainT > 0){
            _e.rainT--;
            if(_e.rainT % 7 == 0){
                for(var i=0; i<2; i++){
                    fireShot(30 + Math.random()*(CW - 60), -6, Math.PI/2 + (Math.random() - 0.5)*0.3, 2 + Math.random()*0.8, i ? "small" : "normal");
                }
            }
        }
        if(_e.circleT > 0) _e.circleT--;
        this.kaiMines(_e);
        this.kaiStrikes(_e);

        if(_e.mode == "aim" || _e.mode == "dash" || _e.mode == "stagger") return;
        //レーザー(要塞と同じく予告線→なぎ払い。第二形態は何本も出して回す)
        if(_e.mode == "laserAim"){
            _e.angle = turnTo(_e.angle,toDrone,0.04);
            if(--_e.count <= 0){ _e.mode = "laser"; _e.count = _e.beams > 1 ? 70 : 40; sound.play("beam"); }
            return;
        }
        if(_e.mode == "laser"){
            //1本のときは狙いを追い、何本もあるときは一方へ回り続ける
            if(_e.beams > 1) _e.angle += _e.spinDir*(ph >= 5 ? 0.017 : 0.013);
            else _e.angle = turnTo(_e.angle,toDrone,0.011);
            //当たり判定は自分のドローン君(相方は相方の画面で判定する)
            if(this.laserHit(_e,drone.X,drone.Y) && mainScreen.canBeHit()) mainScreen.damage();
            if(--_e.count <= 0){ _e.mode = "idle"; _e.beams = 1; _e.timer = KAI_REST[ph]; }
            return;
        }

        //ほかの攻撃は順番に1つずつ
        if(--_e.timer <= 0 && play){
            var list = KAI_PATTERNS[ph];
            this.kaiAttack(_e, list[_e.cycle++ % list.length], ph, toDrone);
            _e.timer = KAI_REST[ph];
        }
    },
    //ブレードの数(協力プレイのゲストも同じ数え方)
    kaiBlades:function(_e){
        return KAI2_BLADES[_e.phase || 1] || 3;
    },
    //(_x,_y)がレーザーに当たっているか(第二形態は何本も等間隔に出る)
    laserHit:function(_e,_x,_y){
        var n = _e.beams || 1, rx = _x - _e.x, ry = _y - _e.y;
        for(var i=0; i<n; i++){
            var a = _e.angle + i*Math.PI*2/n, cx = Math.cos(a), cy = Math.sin(a);
            if(rx*cx + ry*cy > 0 && Math.abs(rx*cy - ry*cx) < 11 + HIT_CORE) return true;
        }
        return false;
    },

    //第二形態の突進：狙う → 合図(KAI2_CUE)で向きが固まる → 突進。何回か続ける。ジャスト衝撃波で弾き返せる(special.parry)
    kaiDash:function(_e,_dx,_dy,_d){
        switch(_e.mode){
            case "aim":
                _e.vx *= 0.8; _e.vy *= 0.8;
                if(_e.count > KAI2_CUE){ _e.aimX = _dx/_d; _e.aimY = _dy/_d; }
                if(_e.count == KAI2_CUE) sound.play("tell");
                if(--_e.count <= 0){ _e.mode = "dash"; _e.count = KAI2_DASH_T; sound.play("dash"); }
                break;
            case "dash":
                _e.vx = _e.aimX*KAI2_DASH_SPEED;
                _e.vy = _e.aimY*KAI2_DASH_SPEED;
                //通った跡に赤紫の火花
                if(_e.t % 2 == 0) effects.push({ x:_e.x, y:_e.y, vx:-_e.vx*0.1, vy:-_e.vy*0.1, life:16, maxLife:16, size:4, glow:KAI2_GLOW });
                if(--_e.count <= 0 || _e.x < _e.r || _e.x > CW - _e.r || _e.y < 90 || _e.y > CH - _e.r){
                    _e.x = Math.max(_e.r, Math.min(_e.x, CW - _e.r));
                    _e.y = Math.max(90, Math.min(_e.y, CH - _e.r));
                    _e.vx = 0; _e.vy = 0;
                    //止まるたびに弾をばらまく
                    this.ring(_e.x,_e.y,_e.phase >= 5 ? 12 : 8,2.2,Math.random(),"small");
                    this.kaiDashNext(_e);
                }
                break;
            case "stagger":
                _e.vx *= 0.9; _e.vy *= 0.9;
                if(--_e.count <= 0) this.kaiDashNext(_e);
                break;
        }
    },
    kaiDashNext:function(_e){
        if(_e.chain > 0){
            _e.chain--;
            _e.mode = "aim";
            _e.count = randIn(KAI2_DASH_AIM) + KAI2_CUE;
            return;
        }
        _e.mode = "idle";
        _e.timer = KAI_REST[_e.phase];
    },

    //倒されたボスが復活するならtrue(mainScreen.hitEnemy から。体力が0になったときに呼ばれる。動かすのはホストとひとり用だけ)
    //ドローン君改の第一形態は、倒れたところで止まり(down)、体力が満ちて(revive)第二形態になる
    revive:function(_e){
        if(_e.type == "chrono") return rival.retreat(_e);      //ライバルは倒れずに去る(rival.js)
        if(_e.type != "kai" || _e.form != 1) return false;
        _e.form = 1.5;          //復活の途中(もう一度は倒れない)
        _e.hp = 0;
        _e.mode = "down";
        _e.count = KAI2_DOWN_T;
        _e.harmless = true;     //倒れている間は体当たりされない
        _e.baseHp = _e.maxHp;
        _e.vx *= 0.3; _e.vy = 1.5;
        _e.waterT = _e.spiralT = _e.rainT = _e.circleT = 0;
        _e.mines = []; _e.strikes = [];
        _e.beams = 1;
        enemyShots = [];
        //手下の虫は一緒に止まる(報酬なし)
        for(var i=0; i<enemies.length; i++) if(enemies[i].minion) enemies[i].dead = true;
        return true;
    },
    //ドローン君改が倒れて第二形態へ復活している間・ライバルの登場の間か(ドローン君の装備と衝撃波を止める。協力プレイのゲストも届いた mode で決まる)
    holdFire:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type == "kai" && (e.mode == "down" || e.mode == "revive")) return true;
            if(e.type == "chrono" && e.mode == "intro") return true;     //ライバルの登場の間(rival.js)
        }
        return false;
    },
    //倒れている → 復活する(ホストとひとり用)
    kaiRevive:function(_e){
        _e.look.update(0, 0);
        if(_e.mode == "down"){
            //倒れたところから少し落ちて止まる
            _e.vx *= 0.92;
            _e.vy = Math.max(0, _e.vy - 0.03);
            if(_e.y > CH - 70) _e.vy = 0;
            if(--_e.count <= 0){
                _e.mode = "revive";
                _e.count = KAI2_REVIVE_T;
                _e.maxHp = Math.round(_e.baseHp*KAI2_HP_MUL);
            }
            return;
        }
        //体力が満ちていき、少し浮き上がる
        _e.vx = 0;
        _e.vy = _e.y > 140 ? -0.35 : 0;
        var k = 1 - _e.count/KAI2_REVIVE_T;
        _e.hp = Math.max(1, Math.round(_e.maxHp*k*k));
        if(--_e.count <= 0){
            _e.form = 2;
            _e.hp = _e.maxHp;
            _e.phase = 4;
            _e.mode = "idle";
            _e.harmless = false;
            _e.timer = 70;
            _e.gunT = 60;
            _e.cycle = 0;
        }
    },
    //倒れる・復活の見た目と音(ホストは kai、協力プレイのゲストは guestCollide から毎フレーム呼ぶ。届いた mode だけで決まる)
    kaiFx:function(_e){
        var M = mainScreen;
        if(_e.mode != _e.fxMode){
            var from = _e.fxMode;
            _e.fxMode = _e.mode;
            _e.fxT = 0;
            if(_e.mode == "down") this.kaiDownFx(_e);
            if(from == "revive") this.kaiAwakeFx(_e);
        }
        _e.fxT++;
        var t = _e.fxT;
        if(_e.mode == "down"){
            //火花と煙が上がる。後ろは少し暗くなっていく
            if(t % 5 == 0) fx.sparks(_e.x + (Math.random()-0.5)*30, _e.y + (Math.random()-0.5)*30, 4, "255,150,90", 4, 2);
            if(t % 9 == 0){
                effects.push({ smoke:true, x:_e.x + (Math.random()-0.5)*20, y:_e.y, vx:(Math.random()-0.5)*0.6, vy:-0.8,
                               R0:6, R1:22, life:40, maxLife:40, color:"60,50,55" });
            }
            M.kaiDark = Math.max(M.kaiDark, Math.min(1, t/60)*KAI_DARK_OUT*0.75);
            return;
        }
        if(_e.mode == "revive"){
            M.kaiDark = Math.max(M.kaiDark, KAI_DARK_OUT*0.75);
            if(KAI2_BEATS.indexOf(t) >= 0) M.beat(t > KAI2_BEATS[0]);
            //最後は始動音とリレー。光が吸い込まれるように集まり、色が赤から紫へ変わる
            var A = KAI2_REVIVE_T - KAI_BOOT_TIME;
            if(t == A) sound.play("kaiBoot");
            var k = t <= A ? 0 : Math.min(1, (t - A)/KAI_BOOT_TIME);
            var q = Math.round(k*8)/8;
            _e.look.tint = mixRgb("190,20,30", KAI2_TINT, q);
            if(k > 0){
                M.shake = Math.max(M.shake, 1 + 3*k);
                if(t % 3 == 0){
                    var a = Math.random()*Math.PI*2, R = 150 + Math.random()*60, sp = 6 + 8*k;
                    effects.push({ x:_e.x + Math.cos(a)*R, y:_e.y + Math.sin(a)*R, vx:-Math.cos(a)*sp, vy:-Math.sin(a)*sp,
                                   life:22, maxLife:22, size:2.5 + 2*k, glow:Math.random() < 0.5 ? KAI2_GLOW : "255,60,60" });
                }
                if(KAI_RELAY_FRAMES.indexOf(t - A) >= 0){
                    fx.flare(_e.x, _e.y, 50 + 40*k, KAI2_GLOW, 8);
                    fx.ring(_e.x, _e.y, 55 + 30*k, KAI2_GLOW, 9, 2);
                    M.shake = Math.max(M.shake, 3 + 5*k);
                }
            }
            return;
        }
        if(_e.form == 2) _e.look.tint = KAI2_TINT;
    },
    //第一形態が倒れた瞬間：撃破のような大爆発。曲が止まり「停止」の文字
    kaiDownFx:function(_e){
        var M = mainScreen;
        for(var i=0; i<4; i++){
            burst(_e.x + (Math.random()-0.5)*_e.r*2, _e.y + (Math.random()-0.5)*_e.r*2, 14, i % 2 ? "#e84" : "#333");
        }
        for(var i=0; i<3; i++) killBlast(_e.x + (Math.random()-0.5)*_e.r*2, _e.y + (Math.random()-0.5)*_e.r*2, _e.r);
        fx.ring(_e.x, _e.y, 220, "230,120,40", 30, 8);
        fx.shake(26);
        M.hitStop = Math.max(M.hitStop, 10);
        popup(_e.x, _e.y - _e.r - 16, "ドローン君改　機能停止…", "#c33");
        sound.stopMusic();
        sound.play("bossDown");
    },
    //復活した瞬間：紫の閃光と衝撃波。暗闇が晴れ、第二形態の名前を出す(曲も変わる)
    kaiAwakeFx:function(_e){
        var M = mainScreen;
        sound.play("kaiIgnite");
        sound.music(null);
        sound.music("kai2");
        _e.look.tint = KAI2_TINT;
        battleBg.ripple(_e.x, _e.y, 50, 10, 90, KAI2_GLOW);
        fx.flare(_e.x, _e.y, 240, KAI2_GLOW, 26);
        fx.ring(_e.x, _e.y, 320, KAI2_GLOW, 30, 10);
        fx.ring(_e.x, _e.y, 200, "255,90,80", 24, 6);
        fx.sparks(_e.x, _e.y, 44, KAI2_GLOW, 11, 4);
        fx.shake(26);
        M.flashT = FLASH_TIME;
        M.hitStop = 6;
        M.zoomT = ZOOM_TIME; M.zoomX = _e.x; M.zoomY = _e.y;
        M.kaiDark = KAI_DARK_OUT;
        M.bossIntro = BOSS_INTRO_TIME;
        M.guard = Math.max(M.guard, 60);
    },

    kaiAttack:function(_e,_p,_ph,_toDrone){
        switch(_p){
            case "missile":
                //左右に打ち出してから追いかけてくるミサイル
                var n = _ph >= 5 ? 6 : (_ph >= 3 ? 4 : 2);
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
                for(var i=0; i<(_ph >= 5 ? 5 : 3); i++){
                    _e.mines.push({ x:_e.x + (Math.random()-0.5)*120, y:_e.y + (Math.random()-0.5)*120, t:0 });
                }
                sound.play("mine");
                break;
            case "tesla":
                //ドローン君の周りに落雷の予告を3つ(第二形態は5つを広く)。少しして雷が落ちる
                var n = _ph >= 4 ? 5 : 3, sp = _ph >= 4 ? 240 : 160;
                for(var i=0; i<n; i++){
                    var ox = i == 0 ? 0 : (Math.random()-0.5)*sp, oy = i == 0 ? 0 : (Math.random()-0.5)*sp;
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
                var n = _ph >= 5 ? 6 : 5;
                for(var i=0; i<n; i++){
                    var a = -Math.PI/2 + i*Math.PI*2/n;
                    enemyShots.push({ x:_e.x + Math.cos(a)*40, y:_e.y + Math.sin(a)*40, vx:Math.cos(a)*3, vy:Math.sin(a)*3,
                                      r:9, kind:"dragon", homing:true, turn:0.035, speed:3.8, life:200, trail:[],
                                      color:"150,20,30", grazed:false });
                }
                fx.flare(_e.x,_e.y,60,"190,20,30",20);
                sound.play("dragon");
                break;
            //---- ここから第二形態だけ
            case "cross":
                //回るレーザー：何本も等間隔に出して、予告のあと一方へ回す
                _e.mode = "laserAim";
                _e.count = 60;
                _e.beams = KAI2_BEAMS[_ph >= 5 ? 1 : 0];
                _e.spinDir = Math.random() < 0.5 ? 1 : -1;
                _e.angle = _toDrone + Math.PI/_e.beams;     //狙いの間から始める(すぐには当たらない)
                sound.play("beamCharge");
                break;
            case "spiral":
                _e.spiralT = KAI2_SPIRAL_T;
                break;
            case "rain":
                _e.rainT = KAI2_RAIN_T;
                sound.play("warning");
                break;
            case "dash":
                _e.chain = KAI2_CHAIN[_ph >= 5 ? 1 : 0] - 1;
                _e.dashes = _e.chain + 1;   //この突進の回数(全部弾いたか数えるため)
                _e.parried = 0;
                _e.mode = "aim";
                _e.count = randIn(KAI2_DASH_AIM) + KAI2_CUE;
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

    //------------------------------------------------------------ 天蓋母艦
    //動かない。コアは 弾の雨 → レーザー → 弾の波 → 手下 の順に攻撃し、砲台はそれぞれ狙って撃つ
    canopy:function(_e,_dx,_dy,_d){
        if(!this.bossCommon(_e)) return;
        _e.vx = 0; _e.vy = 0;
        _e.x = CW/2; _e.y = CANOPY_Y;
        var rage = _e.enraged ? 1 : 0;
        var play = mainScreen.state == "play";
        var down = this.downward(Math.atan2(_dy,_dx), 0.12);
        switch(_e.mode){
            case "idle":
                _e.angle = turnTo(_e.angle,down,0.05);
                if(--_e.timer <= 0 && play){
                    _e.mode = CANOPY_PATTERNS[_e.pat++ % CANOPY_PATTERNS.length];
                    _e.count = { rain:CANOPY_RAIN_T, laserAim:CANOPY_AIM_T, wave:CANOPY_WAVE_T, summon:CANOPY_SUMMON_T }[_e.mode];
                    if(_e.mode == "laserAim") sound.play("beamCharge");
                    if(_e.mode == "rain") sound.play("rumble");
                }
                break;
            case "rain":
                //弾の雨：船体の下の口から、すき間を残して降らせる。すき間は左右へゆっくり動く
                _e.angle = turnTo(_e.angle,Math.PI/2,0.05);
                var every = CANOPY_RAIN_EVERY[rage];
                if(_e.count % every == 0 && _e.count < CANOPY_RAIN_T - 20){
                    var gapX = this.rainGap(_e);
                    var row = Math.floor(_e.count/every) % 2;
                    for(var v=0; v<CANOPY_VENTS; v++){
                        if(v % 2 != row) continue;
                        var vx = this.canopyVent(v);
                        if(Math.abs(vx - gapX) < CANOPY_RAIN_GAP[rage]) continue;
                        fireShot(vx, canopyEdge(vx - _e.x,_e.y), Math.PI/2 + (Math.random() - 0.5)*0.16, 2.1*Math.min(1.3,danmaku()), "small");
                    }
                    if(row == 0) sound.play("enemyShot");
                }
                if(--_e.count <= 0) this.canopyRest(_e);
                break;
            case "laserAim":
                //予告線を出しながらドローン君を狙う
                _e.angle = turnTo(_e.angle,down,0.04);
                if(--_e.count <= 0){
                    _e.mode = "laser";
                    _e.count = CANOPY_LASER_T[rage];
                    sound.play("beam");
                }
                break;
            case "laser":
                //撃ちながらゆっくりなぎ払う
                _e.angle = turnTo(_e.angle,down,CANOPY_SWEEP[rage]);
                if(this.laserHit(_e,drone.X,drone.Y) && mainScreen.canBeHit()) mainScreen.damage();
                if(--_e.count <= 0) this.canopyRest(_e);
                break;
            case "wave":
                //弾の波：コアから下へ、大きな弾を扇に広げて何度も(1回ごとに少しずらす)
                _e.angle = turnTo(_e.angle,Math.PI/2,0.05);
                if(_e.count % CANOPY_WAVE_GAP == 0){
                    var odd = (_e.count/CANOPY_WAVE_GAP) % 2;
                    fireFan(_e.x, _e.y + _e.r, Math.PI/2 + (odd ? 0.07 : -0.07), _e.enraged ? 15 : 11, 0.16,
                            1.7*Math.min(1.3,danmaku()), "big");
                    sound.play("bossShot");
                }
                if(--_e.count <= 0) this.canopyRest(_e);
                break;
            case "summon":
                //ハッチが開いて、手下の虫を落とす(生きている手下は MINION_MAX まで)
                if(_e.count == Math.round(CANOPY_SUMMON_T/2)){
                    var alive = enemies.filter(function(m){ return m.minion && !m.dead; }).length;
                    var n = Math.min(CANOPY_MINIONS[rage], MINION_MAX - alive);
                    for(var i=0; i<n; i++){
                        var s = i % 2 ? 1 : -1;
                        var m = makeEnemy("bug");
                        m.x = _e.x + s*(CANOPY_HATCH + (Math.random() - 0.5)*30);
                        m.y = canopyEdge(s*CANOPY_HATCH,_e.y) - 6 - Math.floor(i/2)*14;     //船体の中から出てくる
                        m.vx = s*0.8; m.vy = 2;
                        m.parts = 0;
                        m.score = 5;
                        m.minion = true;
                        enemies.push(m);
                    }
                    if(n > 0) sound.play("summon");
                }
                if(--_e.count <= 0) this.canopyRest(_e);
                break;
        }
    },
    canopyRest:function(_e){
        _e.mode = "idle";
        _e.timer = CANOPY_REST[_e.enraged ? 1 : 0];
    },
    //向き_aを、下向きの半分(真横から_marginだけ下)に収める(船体の中へは撃たない)
    downward:function(_a,_margin){
        if(_a < -Math.PI/2) _a = Math.PI;
        else if(_a < 0) _a = 0;
        return Math.max(Math.PI*_margin, Math.min(Math.PI*(1 - _margin), _a));
    },
    //弾の雨を落とす口のx(_i番目)
    canopyVent:function(_i){
        return (_i + 0.5)*CW/CANOPY_VENTS;
    },
    //弾の雨のすき間のまんなかのx(攻撃ごとに始まりの位置が変わる)
    rainGap:function(_e){
        return CW/2 + Math.sin((CANOPY_RAIN_T - _e.count)*0.022 + _e.pat)*(CW/2 - 140);
    },
    //降りきった：船体の下のふちに沿って土煙。砲台を出す(動かすのはホストとひとり用だけ。ゲストには敵として届く)
    canopyLanded:function(_e){
        for(var i=0; i<16; i++){
            var x = (i + 0.5)*CW/16, y = canopyEdge(x - _e.x,_e.y);
            var life = 40 + Math.random()*30;
            effects.push({ smoke:true, x:x, y:y, vx:(Math.random() - 0.5)*3, vy:1 + Math.random()*1.5,
                           R0:10, R1:30 + Math.random()*20, life:life, maxLife:life, color:"120,110,100" });
        }
        if(drone.Y < CANOPY_FLOOR) drone.Y = drone.preY = CANOPY_FLOOR;
        if(coop.isGuest()) return;
        for(var i=0; i<CANOPY_PODS.length; i++) enemies.push(makeCanopyPod(_e,i));
    },
    //砲台：ドローン君を狙い、決まった間隔で扇に撃つ。体のまわりの装備で押されても元の場所へ戻る
    pod:function(_e,_dx,_dy,_d){
        _e.x = CANOPY_PODS[_e.slot];
        _e.y = CANOPY_Y + CANOPY_POD_DY;
        _e.vx = 0; _e.vy = 0;
        var boss = this.canopyOf();
        var rage = boss && boss.enraged ? 1 : 0;
        _e.enraged = !!rage;     //怒ると速く撃つ(絵の反動の長さにも使う)
        _e.face = this.downward(Math.atan2(_dy,_dx), 0.1);
        if(--_e.timer <= 0){
            //目の前では撃たない(よけようがないので。離れるまで待つ)
            if(mainScreen.state == "play" && _d > CANOPY_POD_NEAR){
                _e.timer = CANOPY_POD_EVERY[rage];
                fireFan(_e.x + Math.cos(_e.face)*(_e.r + 6), _e.y + Math.sin(_e.face)*(_e.r + 6), _e.face,
                        rage ? 5 : 3, 0.22, 2.7*Math.min(1.3,danmaku()), "normal");
                sound.play("enemyShot");
            }else _e.timer = 20;
        }
    },
    //画面にいる天蓋母艦
    canopyOf:function(){
        for(var i=0; i<enemies.length; i++){
            if(enemies[i].type == "canopy" && !enemies[i].dead) return enemies[i];
        }
        return null;
    },
    //天蓋母艦が倒れた：船体が崩れ落ちる(協力プレイのゲストは coop.guestSync から)
    canopyWreck:function(_e){
        mainScreen.wreck = { type:"canopy", x:_e.x, y:_e.y, vy:-1.2, t:_e.t, age:0, life:CANOPY_WRECK_T, mode:"wreck", broken:15, r:_e.r, enraged:true };
        //船体のあちこちで爆発する
        for(var i=0; i<14; i++){
            var x = 40 + Math.random()*(CW - 80);
            killBlast(x, canopyEdge(x - _e.x,_e.y) - Math.random()*60, 30 + Math.random()*20);
        }
        fx.shake(36);
        battleBg.ripple(_e.x, _e.y + 60, 60, 12, 100, "230,150,70");
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
        if(_e.pod){
            //天蓋母艦の砲台：壊すとコアにもダメージ。付け根が壊れた跡になる
            var boss = this.canopyOf();
            if(boss){
                boss.broken |= 1 << _e.slot;
                fx.flare(_e.x, _e.y, 70, "255,170,80", 18);
                fx.shake(10);
                popup(_e.x, _e.y + 34, "砲台破壊！", "#c33");
                mainScreen.hitEnemy(boss, boss.maxHp*CANOPY_POD_DMG, "pod");
            }
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
            if(_e.type == "canopy"){
                //残った砲台も一緒に壊れ、船体が崩れ落ちる
                for(var i=0; i<enemies.length; i++){
                    var p = enemies[i];
                    if(!p.pod || p.dead) continue;
                    p.dead = true;
                    killBlast(p.x, p.y, p.r);
                }
                this.canopyWreck(_e);
            }
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
                //ドローン君改：赤く光る2倍の大きさのドローン君(第二形態は紫に光る)
                var down = _e.mode == "down";
                var glow = _e.form == 2 ? "150,40,220" : "200,20,30";
                if(!down){
                    var gR = _e.form == 2 ? 75 : 60;
                    var g = ctx.createRadialGradient(0,0,0,0,0,gR);
                    g.addColorStop(0,"rgba(" + glow + "," + (0.25 + 0.1*Math.sin(_e.t*0.1)) + ")");
                    g.addColorStop(1,"rgba(" + glow + ",0)");
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(0,0,gR,0,Math.PI*2); ctx.fill();
                }
                //倒れている間は傾いて、ときどき明滅する
                ctx.save();
                if(down){
                    ctx.rotate(Math.min(1, (_e.fxT || 0)/30)*0.45);
                    if(Math.random() < 0.15) ctx.globalAlpha = 0.6;
                }
                //本体と改造部品(enemyArt.js)
                enemyArt.draw(_e,_body);
                ctx.restore();
                return true;

            case "fortress":
                //移動要塞：部位ごとに動く絵(enemyArt.js)
                enemyArt.draw(_e,_body);
                return true;

            case "canopy":
            case "pod":
                //天蓋母艦と砲台(enemyArt.js)
                enemyArt.draw(_e,_body);
                return true;

            case "chrono":
                //ライバル(rival.js)
                rival.draw(_e,_body);
                return true;
        }
        return false;
    },

    //ボスの攻撃予告・レーザー(translateしていない状態で呼ばれる)
    drawAttack:function(_e){
        if(_e.type == "chrono"){ rival.drawAttack(_e); return; }    //ライバル(rival.js)
        if((_e.type == "queen" || _e.type == "kai") && _e.mode == "aim"){
            //狙っている間は薄く、本物の突進の合図(QUEEN_CUE。ドローン君改は KAI2_CUE)で濃くなる(フェイントは薄いまま)
            var C = _e.type == "kai" ? KAI2_CUE : QUEEN_CUE;
            var cue = !_e.fake && _e.count <= C ? 1 - _e.count/C : 0;
            ctx.strokeStyle = "rgba(220,40,40," + (0.25 + 0.6*cue) + ")";
            ctx.lineWidth = _e.r*1.2;
            ctx.globalAlpha = 0.25;
            ctx.beginPath(); ctx.moveTo(_e.x,_e.y); ctx.lineTo(_e.x + _e.aimX*1200, _e.y + _e.aimY*1200); ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
        }
        if(_e.type == "kai") this.drawKaiParts(_e);
        if((_e.type == "fortress" || _e.type == "kai" || _e.type == "canopy") && (_e.mode == "laserAim" || _e.mode == "laser")){
            //ドローン君改の第二形態は何本も等間隔に出る(_e.beams)
            var n = _e.beams || 1, purple = _e.form == 2;
            for(var i=0; i<n; i++){
                var a = _e.angle + i*Math.PI*2/n;
                var ex = _e.x + Math.cos(a)*1200, ey = _e.y + Math.sin(a)*1200;
                if(_e.mode == "laserAim"){
                    ctx.strokeStyle = purple ? "rgba(170,50,230,0.6)" : "rgba(220,40,40,0.6)";
                    ctx.setLineDash([8,6]);
                    ctx.beginPath(); ctx.moveTo(_e.x,_e.y); ctx.lineTo(ex,ey); ctx.stroke();
                    ctx.setLineDash([]);
                }else{
                    ctx.strokeStyle = purple ? "rgba(160,40,230,0.85)" : "rgba(230,40,40,0.85)";
                    ctx.lineWidth = 22 + Math.sin(_e.t*0.8)*4;
                    ctx.beginPath(); ctx.moveTo(_e.x,_e.y); ctx.lineTo(ex,ey); ctx.stroke();
                    ctx.strokeStyle = "rgba(255,255,255,0.9)";
                    ctx.lineWidth = 8;
                    ctx.stroke();
                    ctx.lineWidth = 1;
                }
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
        //ブレード(赤黒い刃が回る。倒れている間は出さない)
        if(_e.mode == "down" || _e.mode == "revive") return;
        var nB = this.kaiBlades(_e);
        for(var k=0; k<nB; k++){
            var a = _e.bladeA + k*Math.PI*2/nB;
            ctx.save();
            ctx.translate(_e.x + Math.cos(a)*64, _e.y + Math.sin(a)*64);
            ctx.rotate(a + _e.bladeA*3);
            ctx.fillStyle = _e.form == 2 ? "#5a1478" : "#7a1018";
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
        //天蓋母艦は船体が後ろにあるので、コアにかからないよう上へ寄せ、明るい板を敷いて読めるようにする
        if(b.type == "canopy"){
            y = 30; w = 260; x = CW/2 - w/2;
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            enemyArt.roundRect(x - 14, y - 26, w + 28, 44, 8);
            ctx.fill();
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 14px sans-serif";
        //ドローン君改は、倒れて復活するところから第二形態の名前になる
        var f2 = b.type == "kai" && b.form > 1 && b.mode != "down";
        if(b.mid){
            //中ボス(ライバル)：名前の前に RIVAL と段階、ゲージはワープの光の色
            ctx.fillStyle = "rgb(" + RIVAL_TINT + ")";
            ctx.fillText("RIVAL　" + b.name + "　Lv." + ((b.lv || 0) + 1) + (b.enraged ? "（本気）" : ""),CW/2,y - 12);
        }else{
            ctx.fillStyle = b.enraged ? "#c33" : (f2 ? "#62138a" : "#000");
            ctx.fillText("BOSS　" + (f2 ? KAI2.name : b.name) + (b.enraged ? "（怒り）" : ""),CW/2,y - 12);
        }
        ctx.fillStyle = "#ddd";
        ctx.fillRect(x,y,w,10);
        ctx.fillStyle = b.mid ? "#2a8fd0" : f2 ? "#8a2ac0" : "#c33";
        ctx.fillRect(x,y,w*Math.max(0,b.hp)/b.maxHp,10);
        ctx.strokeStyle = "#000";
        ctx.strokeRect(x + 0.5,y + 0.5,w - 1,9);
        ctx.fillStyle = "#000";
    }
};

//"r,g,b" の色_aから_bへ_kだけ近づけた色("r,g,b")
function mixRgb(_a,_b,_k){
    var a = _a.split(","), b = _b.split(","), o = [];
    for(var i=0; i<3; i++) o.push(Math.round(+a[i] + (b[i] - a[i])*_k));
    return o.join(",");
}

//角度_aを目標_toへ最大_stepだけ近づける
function turnTo(_a,_to,_step){
    var diff = _to - _a;
    while(diff > Math.PI) diff -= Math.PI*2;
    while(diff < -Math.PI) diff += Math.PI*2;
    return _a + Math.max(-_step, Math.min(_step, diff));
}
