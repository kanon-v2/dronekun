//------------------------------------------------------------------------------
//  ボスの試作：傀儡師(くぐつし。種類 puppeteer)
//  捕らえた同胞(色違いのドローン君)を糸で操り、盾や武器にしてくる卑劣な敵。こちらを見下したせりふも言う。
//  ・人形(種類 puppet)：傀儡師の手の操り板から糸で吊られている。体力は「糸の強さ」で、撃ち切ると糸が切れて解放される
//    (倒れない・点もパーツも出ない)。投げつけてくる人形は、ジャスト衝撃波で弾くと糸ごと断ち切れる
//  ・人形が吊られている間は、傀儡師は人形を盾にしていて撃てない(phased)。武器は自動で人形(糸)を狙う
//  ・解放した同胞は味方になって、ドローン君のまわりで一緒に戦う(傀儡師・まだ操られている人形を撃ち、近くの弾をかばって消す)
//  流れ：第1幕(人形3体) → 全員解放すると傀儡師がよろけて隙(stun) → 第2幕(人形4体) → 隙 → 第3幕(ひとりで戦う。solo)
//        → 体力が PUP_RALLY_HP を切ると最後のあがき(last)。「衝撃波で合図！」で、味方全員と一斉反撃(rally)して倒す
//  苦しむ見せ方はしない：操られている同胞は苦しむ顔をせず、紫の糸の結び目と薄い光で「操られている」ことだけ見せる
//  傀儡師の仮面は、幕が進むたびにひびが入る(追い詰めている手応え)
//  デバッグのメニューの「傀儡師(試作)」で WAVE10 の強さで戦う(bossDebug.puppeteer)。ふつうの周には出ない。
//  協力プレイには対応していない(試作のため)。
//------------------------------------------------------------------------------
const PUP_HP_MUL      = 2.4;        //体力(ほかのボスと同じ式の値に掛ける)
const PUP_LAND_Y      = 118;        //降りてきて止まる高さ(仮面の中心)
//大きさと動き(Cuphead・カービィのボスのように、画面を支配する大きさと大げさな動き)
const PUP_SCALE       = 2.3;        //体(マント・頭巾・襟・仮面)を描く倍率
const PUP_HAND_SCALE  = 2.1;        //手と操り板を描く倍率
const PUP_HAND_REST   = [[-240,38],[240,38]];  //手のふだんの場所(仮面の中心から)
const PUP_HAND_SPRING = 0.05;       //手が目標へ引かれる強さ(ばね)
const PUP_HAND_DAMP   = 0.84;       //手の動きの減り方(小さいほど行きすぎない)
const PUP_ANTIC_T     = 34;         //攻撃の前のため(のけぞって縦に伸びる → 一気に身を乗り出す)の長さ(フレーム)
const PUP_ANTIC_SPLIT = 0.62;       //ためのうち、のけぞっている割合(残りで一気に乗り出す)
const PUP_LUNGE       = [0.3,0.22,70];      //身を乗り出したときの横・縦の大きくなる割合と、下へ出る量(px)
const PUP_STRETCH     = [0.2,0.3,55];       //のけぞったときの横に細くなる・縦に伸びる割合と、上へ引く量(px)
const PUP_BOB         = [11,0.065,0.05];    //ふだんの上下の揺れ(px)・速さ、体の振り子の揺れ(ラジアン)
const PUP_LAUGH_T     = 90;         //ドローン君が被弾したときに高笑いする長さ(フレーム)
const PUP_LAUGH       = [26,0.32,0.16];     //高笑いの跳ねる高さ(px)・速さ・体の傾き(ラジアン)
const PUP_SQUASH      = [0.03,0.32,0.16];   //撃たれたとき・糸を切られたときのつぶれる勢いと、つぶれの大きさ
const PUP_HAND_SWAY   = [70,45];    //手のふだんの揺れの幅(横・縦 px)
const PUP_HAND_THRUST = 0.35;       //身を乗り出したとき、手がドローン君のほうへ伸びる割合
const PUP_LIFT_MUL    = 3;          //糸を引いて手を持ち上げる量の倍率(大げさに)
const PUP_LOOK        = 7;          //仮面がドローン君のほうへ向く量(px)
//手の攻撃(長さはフレーム、速さは px/フレーム、r は手の当たりの半径)
const PUP_HAND_GROW = 1.4;          //攻撃に出た手は、手前へ迫るようにこの倍率まで大きくなる(当たりの大きさ r もこの大きさに合わせてある)
const PUP_SLAM  = { aim:50, lock:12, speed:24, floor:468, stay:28, r:54, shots:5 };     //叩きつけ：ドローン君の上へ来て、床まで一気に落ちる。床で漆の玉が左右と上へ跳ねる
const PUP_SWEEP = { aim:46, lock:10, speed:24, band:58, r:60 };                         //なぎ払い：画面の端からドローン君の高さを平手で払う(予告の帯)
const PUP_GRAB  = { chase:75, snap:9, hold:24, r:48, lag:0.07 };                        //つまみ取り：かぎ爪で追ってきて、ぱっとつまむ
const PUP_FLICK = { aim:30, n:5, every:7, spread:0.16 };                                //指はじき：指さして、漆の玉を続けてはじく
const PUP_RAGE_GAP = 26;            //怒っているときは、もう片方の手も少し遅れて同じ攻撃をする
const PUP_POSE  = { spread:8, claw:9, fist:10, point:11 };     //手の絵のコマ(handL/handR.png の HAND_FRAMES のあと)
const PUP_STAGES      = [3,4];      //第1幕・第2幕の人形の数
const PUP_OFFS        = [[-160,0,160],[-230,-80,80,230]];  //人形を吊る位置(傀儡師からの横のずれ。幕ごと)
const PUP_PUPPET_HP   = 0.05;       //人形の糸の強さ(傀儡師の体力に掛ける。装備「標準」で1幕10秒あまり。傀儡師の体力を2倍にしたとき、人形は変えないよう半分に)
const PUP_PUPPET_R    = 15;
const PUP_LEN         = [150,190];  //糸の長さ(この間でばらつく)
const PUP_DROP_T      = 70;         //人形が吊られて出てくる長さ(フレーム)
const PUP_STAGE_HP    = [0.72,0.45];    //隙の間に削れる下限(第1幕・第2幕のあと。体力に対する割合)
const PUP_STUN_T      = 300;        //全員解放されてよろけている長さ(フレーム)
const PUP_RALLY_HP    = 0.2;        //この割合を切ると最後のあがき(一斉反撃ができる)
const PUP_FLOOR       = 0.05;       //一斉反撃のほかでは、これより減らない(とどめは一斉反撃で)
const PUP_ACTS        = ["volley","throw","thread","slam","dance","grab","throw","volley","sweep","thread"];  //第1幕・第2幕の攻撃の順番(slam・grab・sweep・flick は手の攻撃)
const PUP_SOLO        = ["thread","slam","sweep","hands","grab","spiral","flick","slam","thread","grab"];   //第3幕の攻撃の順番
const PUP_REST        = [70,50];    //攻撃と攻撃の間(ふだん・怒り)
const PUP_VOLLEY_GAP  = 22;         //人形が順に撃つ間(フレーム)
const PUP_VOLLEY_N    = [3,5];      //人形が1回に撃つ扇の弾の数(第1幕・第2幕)
const PUP_SHOT_SPEED  = 2.7;        //人形・傀儡師の弾の速さ(danmaku() を掛ける。上限1.3倍)
const PUP_THROW_WIND  = 48;         //投げつける前の構え(引き上げられる)
const PUP_THROW_CUE   = 20;         //構えの最後のこの間は狙いが固まり、合図の光が出る
const PUP_THROW_SPEED = 10.5;       //投げつける速さ(px/フレーム)
const PUP_THROW_T     = 50;         //投げつけている長さ(フレーム。画面の外でも止まる)
const PUP_THROW_N     = [1,2];      //続けて投げつける人形の数(第1幕・第2幕)
const PUP_BACK_T      = 45;         //投げたあと、元の場所へ引き戻される長さ
const PUP_DANCE_T     = 220;        //人形の輪舞の長さ(傀儡師のまわりを回りながら弾の輪)
const PUP_DANCE_EVERY = 60;         //輪舞で1体が弾の輪を撃つ間隔
const PUP_DANCE_RING  = 8;          //輪舞の弾の輪の数
const PUP_THREAD_N    = [2,3,4];    //糸の斬撃の本数(幕ごと)
const PUP_THREAD_WARN = 52;         //糸の斬撃の予告(細い点線)
const PUP_THREAD_LIVE = 16;         //張りつめて当たる長さ
const PUP_THREAD_W    = 5;          //糸の当たりの太さ(半分。ドローン君の芯の大きさを足す)
const PUP_THREAD_GAP  = 0.3;        //糸と糸の角度の間(ラジアン)
const PUP_HANDS_T     = 140;        //第3幕：両手から交互に扇を撃つ長さ
const PUP_HANDS_EVERY = 22;
const PUP_SPIRAL_T    = 120;        //第3幕：仮面から渦巻き弾を撃つ長さ
const PUP_SPIRAL_EVERY = 7;
const PUP_LAST_EVERY  = 80;         //最後のあがき：糸の斬撃の間隔
//味方(解放した同胞)
const PUP_ALLY_SLOTS  = [[-62,34],[62,34],[-104,6],[104,6],[-34,72],[34,72],[-136,48],[136,48]];  //ドローン君からの位置
const PUP_ALLY_EVERY  = 60;         //味方が撃つ間隔(フレーム)
const PUP_ALLY_DMG    = 0.002;      //味方の弾のダメージ(傀儡師の体力に掛ける)
const PUP_ALLY_SPEED  = 9;          //味方の弾の速さ
const PUP_ALLY_GUARD  = 24;         //味方が弾をかばったあと、次にかばえるまで(フレーム)
const PUP_ALLY_COLOR  = "90,190,255";   //味方の光の色
const PUP_STRING      = "190,140,255";  //糸の色
//一斉反撃(フレーム)
const PUP_RALLY_CUT   = 60;         //「みんな、いくぞ！」の帯の長さ(この間に味方が横一列に並ぶ)
const PUP_RALLY_FIRE  = 130;        //ビームを撃っている長さ(終わりで体力が0になる)
const PUP_RALLY_END   = 60;         //倒したあと、味方がよろこんでいる長さ
//せりふ
const PUP_LINES = {
    enter: "ようこそ、わたしの人形劇へ",
    shield:"撃てるものなら撃ってみろ。この子たちごとな",
    lose:  "…糸が切れただと？",
    stage2:"代わりの人形なら、いくらでもいる",
    solo:  "よくも、わたしの人形を…！",
    last:  "なぜだ…なぜ人形が逆らう！",
    twist: "わたしも…人形だったのか…",
    die:   "糸が…ほどける…"
};
//最後のあがきで明かされる「傀儡師も操られていた」：上の闇から巨大な影の手が操り板を下ろし、傀儡師の頭と両手にも糸がついていた
const PUP_TWIST = {
    //はっきり伝わるよう、短いムービーにする：上下に黒い帯(上の表示は隠す)、弾を消して戦いを止め、
    //傀儡師は画面のまんなかへ引きずり下ろされ、その真上に影の手が画面の中に見える所まで下りてくる。せりふは下の帯に大きく
    cine:380,           //ムービーの長さ(フレーム)。このあと一斉反撃の合図ができる
    from:40, down:90,   //影の手が下り始める時刻と、下りてくる長さ
    lines:[[0,70,"boss",PUP_LINES.last],[140,80,"voice","愚かな人形よ……"],[220,80,"voice","おまえの糸も、わたしが握っている"],[300,75,"boss",PUP_LINES.twist]],   //[出す時刻, 長さ, 話す者, せりふ]
    bar:56,             //上下の黒い帯の高さ
    drop:150,           //最後のあがきの間、傀儡師がいつもより下がる量(px。上に影の手が入るように)
    above:200,          //影の手(手のひら)が傀儡師の仮面の中心からどれだけ上か
    jerk:6,             //操られている傀儡師が、ぎくしゃく動く間隔(フレーム)
    scale:4.2,          //影の手の大きさ(手の絵の倍率)
    eyes:[175,50],      //闇の奥の目(影の手からの横のずれ・高さのずれ)
    eyeW:36, eyeH:15,   //目の横の半径・縦の半径(px)
    leave:150           //糸が切れてから、影が闇へ退いて消えるまで
};
const PUP_ALLY_LINES =["ありがとう！","目がさめた！","いっしょに戦う！","もう操られない！","まかせて！","おかえしだ！","ついていく！"];
const PUP_SAY_T       = 150;        //吹き出しを出している長さ
//Blender で描いた絵(tools/blender/puppeteer.py で書き出す。images/game/puppeteer/)。読み込むまでと #pup2d のときは図形の絵
//範囲はゲームの px で[左, 上, 幅, 高さ](原点は仮面の中心・手の甲・操り板のまんなか)。絵はゲームの1px = px 画素
//px は絵の1px あたりの画素(tools/blender/puppeteer.py の PX と同じ)。ゲームではこの範囲を PUP_SCALE・PUP_HAND_SCALE 倍で描く
const PUP_ART = {
    body:{ area:[-76,-50,152,178], frames:8, cols:4, px:5 },    //マント・頭巾・襟(裾がなびく)
    mask:{ area:[-20,-24,40,48], frames:16, cols:8, px:7 },     //仮面(番号 = ひびA + ひびB*2 + ひびC*4 + 口を開く*8)
    hand:{ area:[-22,-26,44,68], frames:12, cols:6, px:5, wiggle:8 },  //手(0～7 指がうごめく、8～ 攻撃の形 PUP_POSE。左右で別の絵)
    bar:{ area:[-28,-18,56,34], frames:1, cols:1, px:5 }        //操り板
};
const PUP_ART_EYES    = [[-8.6,-6],[8.6,-6]];  //目の奥の赤い光の位置(仮面の中心から)

BOSS_TYPES.puppeteer = { name:"傀儡師", r:48, en:"THE PUPPETEER", title:"糸を操る支配者" };
COUNTER_TYPES.push("puppet");       //投げつけてくる人形を、ジャスト衝撃波で弾く(糸ごと断ち切る)

var puppeteer = {
    allies:[],      //解放した同胞(味方。enemies には入れない)
    shots:[],       //味方の弾
    threads:[],     //糸の斬撃({ x, y：張る手 a：向き t：経過 })
    rally:null,     //一斉反撃({ t：経過 boss })
    ready:false,    //一斉反撃ができる(衝撃波で合図)
    finishing:false,    //一斉反撃でとどめを刺している(体力の下限を外す)
    mask:null,      //倒したときに落ちていく仮面
    freed:0,        //解放した数

    reset:function(){
        this.allies = []; this.shots = []; this.threads = [];
        this.rally = null; this.ready = false; this.finishing = false; this.mask = null; this.freed = 0;
        this.twist = null; this.hold = 0;
    },
    alive:function(){
        for(var i=0; i<enemies.length; i++) if(enemies[i].type == "puppeteer" && !enemies[i].dead) return enemies[i];
        return null;
    },
    //操られている人形(_boss の。省くと全部)
    bound:function(){
        return enemies.filter(function(e){ return e.type == "puppet" && !e.dead; });
    },
    init:function(_b){
        _b.hp = _b.maxHp = Math.round(_b.hp*PUP_HP_MUL);
        _b.stage = 0;       //0：登場 1・2：人形の幕 3：ひとり
        _b.sub = "";        //今の攻撃
        _b.flinch = 0;      //のけぞり(糸を切られた・被弾)
        _b.maskA = 0;       //仮面の傾き
        //手(仮面の中心からの位置。ばねで目標へ動く)。lift は糸を引いて持ち上げる量(絵の px。描くときは PUP_HAND_SCALE 倍)
        _b.hands = PUP_HAND_REST.map(function(r){ return { x:r[0], y:r[1], vx:0, vy:0, lift:0, atk:null }; });
        _b.bars = PUP_HAND_REST.map(function(r){ return { x:r[0], y:r[1] + 20*PUP_HAND_SCALE, vx:0, vy:0 }; });   //操り板(仮面の中心から)
        _b.lean = 0; _b.leanV = 0;  //身を乗り出す量(マイナスはのけぞる)とその速さ
        _b.laugh = 0;               //高笑いの残り
        _b.squash = 0; _b.squashV = 0;  //被弾でつぶれて戻る(ばね)
        _b.antic = 0;               //攻撃の前のための残り
        _b.lastSub = "";
        _b.sayText = ""; _b.sayT = 0;
        _b.said = {};
        this.reset();
    },
    say:function(_e,_key){
        if(_e.said[_key]) return;
        _e.said[_key] = true;
        _e.sayText = PUP_LINES[_key];
        _e.sayT = PUP_SAY_T;
    },

    //------------------------------------------------------------------ 傀儡師の動き
    update:function(_e){
        if(_e.sayT > 0) _e.sayT--;
        if(_e.flinch > 0) _e.flinch--;
        this.stepThreads(_e);
        if(mainScreen.state == "play") this.stepHands(_e);
        if(!special.bossCommon(_e)){ this.pose(_e); return; }
        var rage = _e.enraged ? 1 : 0, play = mainScreen.state == "play";
        var nb = this.bound().length;
        //人形を吊っている間は、人形を盾にしていて撃てない
        _e.phased = (_e.mode == "summon" || _e.mode == "act") && nb > 0;
        _e.harmless = false;
        switch(_e.mode){
            case "idle":
                this.say(_e,"enter");
                this.summon(_e,1);
                break;
            case "summon":
                this.drift(_e, CW/2, 0.02);
                if(--_e.count <= 0){ _e.mode = "act"; _e.sub = "rest"; _e.count = 40; this.say(_e,"shield"); }
                break;
            case "act":
                this.drift(_e, CW/2 + Math.sin(_e.t*0.006)*170, 0.015);
                if(nb == 0){ this.stun(_e); break; }
                if(play) this.act(_e,rage);
                break;
            case "stun":
                //よろけて下がる。隙(撃てる)
                _e.vx = Math.sin(_e.t*0.21)*1.2; _e.vy = (PUP_LAND_Y + 20 - _e.y)*0.05;
                var floor = _e.maxHp*PUP_STAGE_HP[_e.stage - 1];
                if(_e.hp < floor) _e.hp = floor;
                if(--_e.count <= 0 || _e.hp <= floor){
                    if(_e.stage == 1) this.summon(_e,2);
                    else{ _e.stage = 3; _e.mode = "solo"; _e.sub = "rest"; _e.count = 50; _e.pat = 0; this.say(_e,"solo"); sound.play("warning"); fx.shake(14); }
                }
                break;
            case "solo":
                this.drift(_e, CW/2 + Math.sin(_e.t*0.011)*230, 0.03);
                if(_e.hp <= _e.maxHp*PUP_RALLY_HP && this.allies.length > 0){
                    _e.mode = "last"; _e.count = 30;
                    _e.sayT = 0; _e.said.last = true;      //せりふはムービーの帯に出す
                    enemyShots.length = 0; this.threads = []; this.stopHands(_e);
                    fx.shake(18); fx.tint("150,80,220",30);
                    sound.play("warning");
                    for(var i=0; i<this.allies.length; i++) this.allies[i].look.setFace("fierce",120);
                    this.twist = { t:0, x:_e.x, cut:-1 };      //上の闇から、傀儡師を操る影が下りてくる
                    break;
                }
                if(play) this.solo(_e,rage);
                break;
            case "last":
                //最後のあがき：糸の斬撃をしつこく
                var cine = this.cine();
                this.drift(_e, cine ? CW/2 : CW/2 + Math.sin(_e.t*0.02)*120, 0.04, PUP_LAND_Y + PUP_TWIST.drop);
                if(cine){
                    _e.count = 30; mainScreen.guard = Math.max(mainScreen.guard, 5);     //ムービーの間は撃たない・当たらない
                    if(this.twist.t == PUP_TWIST.cine - 1){ this.ready = true; sound.play("warning"); }
                    break;
                }
                if(play && --_e.count <= 0){
                    _e.count = PUP_LAST_EVERY;
                    //糸の斬撃と、両手の叩きつけをかわるがわる
                    _e.lastAlt = !_e.lastAlt;
                    if(_e.lastAlt || this.handBusy(_e)) this.thread(_e, 3, true);
                    else this.handAttack(_e, "slam", true);
                }
                break;
            case "rallied":
                //一斉反撃を受けている(動けない)
                _e.vx = (Math.random() - 0.5)*2; _e.vy = (PUP_LAND_Y + (this.twist ? PUP_TWIST.drop : 0) - _e.y)*0.1;
                break;
        }
        this.pose(_e);
    },
    //ゆっくり目標の横の位置へ(高さはいつもの所)
    drift:function(_e,_x,_k,_y){
        _e.vx += ((_x - _e.x)*_k - _e.vx)*0.1;
        _e.vy += (((_y || PUP_LAND_Y) + Math.sin(_e.t*0.05)*6 - _e.y)*0.06 - _e.vy)*0.2;
    },
    //人形を吊って出す(_stage：1 上から降りてくる 2 左右から引き寄せる)
    summon:function(_e,_stage){
        _e.stage = _stage;
        _e.mode = "summon";
        _e.count = PUP_DROP_T + 20;
        _e.pat = 0;
        var offs = PUP_OFFS[_stage - 1];
        for(var i=0; i<offs.length; i++){
            var c = (this.freed + i) % KIN_COLORS.length;
            var p = {
                id:++enemySeq, type:"puppet", owner:_e.id, name:"人形", r:PUP_PUPPET_R,
                hp:Math.max(2, Math.round(_e.maxHp*PUP_PUPPET_HP)), score:0, parts:0,
                x:0, y:0, vx:0, vy:0, flash:0, timer:0, t:0, dead:false, slow:0, bladeCd:0,
                harmless:true, off:offs[i], hand:offs[i] < 0 ? 0 : 1,
                len:PUP_LEN[0] + Math.random()*(PUP_LEN[1] - PUP_LEN[0]),
                th:(Math.random() - 0.5)*0.4, thV:0, jerk:0, mode:"drop", count:PUP_DROP_T
            };
            p.maxHp = p.hp;
            if(_stage == 1){ p.sx = _e.x + p.off; p.sy = -40; }
            else{ p.sx = p.off < 0 ? -60 : CW + 60; p.sy = 220 + Math.random()*120; }
            p.x = p.sx; p.y = p.sy;
            p.look = new DroneLook();
            p.look.tint = KIN_COLORS[c];
            enemies.push(p);
        }
        if(_stage == 2){
            this.say(_e,"stage2");
            fx.shake(10);
        }
        sound.play("summon");
    },
    //全員解放された：よろけて隙
    stun:function(_e){
        _e.mode = "stun";
        _e.count = PUP_STUN_T;
        _e.flinch = 40;
        _e.sayT = 0; this.say(_e,"lose");
        this.threads = [];
        this.stopHands(_e);
        fx.shake(16);
        fx.flare(_e.x, _e.y, 90, "255,255,255", 16);
        fx.ring(_e.x, _e.y, 150, PUP_STRING, 24, 6);
        sound.play("bossDown");
        popup(_e.x, _e.y + 70, "今だ！ 傀儡師を撃て！", "#c33", true);
    },

    //第1幕・第2幕：人形を使った攻撃
    act:function(_e,_rage){
        var B = this.bound(), st = _e.stage - 1;
        switch(_e.sub){
            case "rest":
                if(--_e.count <= 0) this.nextAct(_e);
                break;
            case "volley":
                //人形が順に、手を引かれるように跳ねてドローン君へ扇を撃つ
                if(_e.count % PUP_VOLLEY_GAP == 0 && B.length){
                    var p = B[(_e.count/PUP_VOLLEY_GAP) % B.length];
                    if(p && p.mode == "hang"){
                        p.jerk = 14;
                        _e.hands[p.hand].lift = 10;
                        var tgt = aimAt || drone;
                        fireFan(p.x, p.y, Math.atan2(tgt.Y - p.y, tgt.X - p.x), PUP_VOLLEY_N[st], 0.24, PUP_SHOT_SPEED*Math.min(1.3,danmaku()), "normal");
                        sound.play("enemyShot");
                    }
                }
                if(--_e.count <= 0) this.rest(_e,_rage);
                break;
            case "throw":
                //構え → 投げつけ → 引き戻し。全員戻ったら次の人形(決まった数だけ)
                var busy = B.some(function(p){ return p.mode == "wind" || p.mode == "throw" || p.mode == "back"; });
                if(busy) break;
                if(_e.throws > 0){
                    var hang = B.filter(function(p){ return p.mode == "hang"; });
                    if(hang.length){
                        var p = hang[Math.floor(Math.random()*hang.length)];
                        p.mode = "wind"; p.count = PUP_THROW_WIND;
                        _e.throws--;
                        break;
                    }
                }
                this.rest(_e,_rage);
                break;
            case "dance":
                if(_e.count == PUP_DANCE_T){
                    for(var i=0; i<B.length; i++){ if(B[i].mode == "hang"){ B[i].mode = "dance"; B[i].da = Math.PI/2 + i*Math.PI*2/B.length; } }
                }
                for(var i=0; i<B.length; i++){
                    var p = B[i];
                    if(p.mode == "dance" && (_e.count + i*Math.round(PUP_DANCE_EVERY/B.length)) % PUP_DANCE_EVERY == 0 && _e.count < PUP_DANCE_T - 30){
                        special.ring(p.x, p.y, PUP_DANCE_RING, 1.9, Math.random(), "small");
                        p.jerk = 10;
                    }
                }
                if(--_e.count <= 0){
                    for(var i=0; i<B.length; i++) if(B[i].mode == "dance"){ B[i].mode = "back"; B[i].count = PUP_BACK_T; }
                    this.rest(_e,_rage);
                }
                break;
            case "thread":
                if(--_e.count <= 0) this.rest(_e,_rage);
                break;
            case "slam": case "sweep": case "grab": case "flick":
                if(!this.handBusy(_e)) this.rest(_e,_rage);     //手の攻撃が終わるまで
                break;
        }
    },
    nextAct:function(_e){
        var p = PUP_ACTS[_e.pat++ % PUP_ACTS.length];
        _e.sub = p;
        if(p == "volley") _e.count = PUP_VOLLEY_GAP*Math.max(1,this.bound().length)*2;
        else if(p == "throw") _e.throws = PUP_THROW_N[_e.stage - 1];
        else if(p == "dance") _e.count = PUP_DANCE_T;
        else if(p == "thread"){ this.thread(_e, PUP_THREAD_N[_e.stage - 1]); _e.count = PUP_THREAD_WARN + PUP_THREAD_LIVE + 10; }
        else this.handAttack(_e, p, _e.enraged);
    },
    rest:function(_e,_rage){ _e.sub = "rest"; _e.count = PUP_REST[_rage]; },

    //第3幕：ひとりで戦う
    solo:function(_e,_rage){
        switch(_e.sub){
            case "rest":
                if(--_e.count <= 0){
                    var p = PUP_SOLO[_e.pat++ % PUP_SOLO.length];
                    _e.sub = p;
                    if(p == "thread"){ this.thread(_e, PUP_THREAD_N[2]); _e.count = PUP_THREAD_WARN + PUP_THREAD_LIVE + 10; }
                    else if(p == "hands") _e.count = PUP_HANDS_T;
                    else if(p == "spiral") _e.count = PUP_SPIRAL_T;
                    else this.handAttack(_e, p, _rage);
                }
                break;
            case "thread":
                if(--_e.count <= 0) this.rest(_e,_rage);
                break;
            case "slam": case "sweep": case "grab": case "flick":
                if(!this.handBusy(_e)) this.rest(_e,_rage);
                break;
            case "hands":
                //両手の操り板から交互に扇
                if(_e.count % PUP_HANDS_EVERY == 0){
                    var k = (_e.count/PUP_HANDS_EVERY) % 2, h = this.handAt(_e,k), tgt = aimAt || drone;
                    _e.hands[k].lift = 12;
                    fireFan(h.x, h.y + 20*PUP_HAND_SCALE, Math.atan2(tgt.Y - h.y, tgt.X - h.x), 5 + _rage*2, 0.2, PUP_SHOT_SPEED*Math.min(1.3,danmaku()), "normal");
                    sound.play("bossShot");
                }
                if(--_e.count <= 0) this.rest(_e,_rage);
                break;
            case "spiral":
                //仮面から2本の渦巻き(糸車のように回る)
                if(_e.count % PUP_SPIRAL_EVERY == 0){
                    var a = _e.t*0.09;
                    for(var s=0; s<2 + _rage; s++) fireShot(_e.x, _e.y, a + s*Math.PI*2/(2 + _rage), 2.2*Math.min(1.3,danmaku()), "small");
                    sound.play("enemyShot");
                }
                if(--_e.count <= 0) this.rest(_e,_rage);
                break;
        }
    },

    //------------------------------------------------------------------ 糸の斬撃
    //手から、ドローン君のあたりへ糸を張る(予告の点線 → 張りつめて当たる)。1本はドローン君を通る
    thread:function(_e,_n,_wide){
        var tgt = aimAt || drone;
        for(var i=0; i<_n; i++){
            var h = this.handAt(_e, i % 2);
            var a = Math.atan2(tgt.Y - h.y, tgt.X - h.x) + (i - (_n - 1)/2)*PUP_THREAD_GAP*(_wide ? 1.4 : 1);
            this.threads.push({ x:h.x, y:h.y + 20*PUP_HAND_SCALE, a:a, t:0, hand:i % 2 });
        }
        _e.hands[0].lift = _e.hands[1].lift = 16;
        sound.play("tell");
    },
    stepThreads:function(_e){
        var ms = mainScreen;
        for(var i=this.threads.length-1; i>=0; i--){
            var T = this.threads[i];
            T.t++;
            if(T.t == PUP_THREAD_WARN){ sound.play("blade"); fx.shake(3); }
            if(T.t >= PUP_THREAD_WARN && T.t < PUP_THREAD_WARN + PUP_THREAD_LIVE && ms.state == "play"){
                //糸(半直線)とドローン君の芯の近さ
                var dx = drone.X - T.x, dy = drone.Y - T.y;
                var along = dx*Math.cos(T.a) + dy*Math.sin(T.a);
                var side = Math.abs(-dx*Math.sin(T.a) + dy*Math.cos(T.a));
                if(along > 0 && side < PUP_THREAD_W + HIT_CORE && ms.canBeHit()) ms.damage();
            }
            if(T.t >= PUP_THREAD_WARN + PUP_THREAD_LIVE) this.threads.splice(i,1);
        }
    },

    //------------------------------------------------------------------ 手の攻撃
    //片手で(怒っていると、もう片方の手も少し遅れて)。手の位置は画面の座標で動かし、pose が手の位置にうつす
    handAttack:function(_e,_kind,_rage){
        var k = drone.X < _e.x ? 0 : 1;
        this.startHand(_e, k, _kind, 0);
        if(_rage) this.startHand(_e, 1 - k, _kind, PUP_RAGE_GAP);
    },
    startHand:function(_e,_k,_kind,_delay){
        var h = _e.hands[_k];
        h.atk = { kind:_kind, ph:_kind == "grab" ? "chase" : "aim", t:0, delay:_delay, started:false, pose:null, rot:0 };
    },
    handBusy:function(_e){ return !!(_e.hands[0].atk || _e.hands[1].atk); },
    stopHands:function(_e){ _e.hands[0].atk = _e.hands[1].atk = null; },
    //手の当たり：手の(_x,_y)の半径 _r にドローン君が入ると被弾
    handHit:function(_x,_y,_r){
        var ms = mainScreen;
        if(ms.state == "play" && Math.hypot(drone.X - _x, drone.Y - _y) < _r + HIT_CORE && ms.canBeHit()) ms.damage();
    },
    stepHands:function(_e){
        var HS = PUP_HAND_SCALE*PUP_HAND_GROW, spd = PUP_SHOT_SPEED*Math.min(1.3, danmaku());
        for(var k=0; k<2; k++){
            var h = _e.hands[k], A = h.atk;
            if(!A) continue;
            if(A.delay > 0){ A.delay--; continue; }
            if(!A.started){ A.started = true; A.x = _e.x + h.x; A.y = _e.y + h.y; }
            A.t++;
            var to = function(_x,_y,_k){ A.x += (_x - A.x)*_k; A.y += (_y - A.y)*_k; };
            switch(A.kind){
                case "slam":
                    A.pose = PUP_POSE.spread; A.rot = 0;
                    var stop = PUP_SLAM.floor - 34*HS;     //指先が床に着く高さ
                    if(A.ph == "aim"){
                        to(drone.X, 120, 0.12);
                        if(A.t >= PUP_SLAM.aim){ A.ph = "lock"; A.t = 0; sound.play("tell"); }
                    }else if(A.ph == "lock"){
                        A.y -= 2; A.x += (Math.random() - 0.5)*4;      //ためて震える
                        if(A.t >= PUP_SLAM.lock){ A.ph = "drop"; A.t = 0; sound.play("dash"); }
                    }else if(A.ph == "drop"){
                        A.y = Math.min(stop, A.y + PUP_SLAM.speed);
                        this.handHit(A.x, A.y + 18*HS, PUP_SLAM.r);
                        if(A.y >= stop){
                            A.ph = "stay"; A.t = 0;
                            fx.shake(16); mainScreen.hitStop = Math.max(mainScreen.hitStop, 4);
                            fx.ring(A.x, PUP_SLAM.floor, 160, "200,160,120", 18, 6);
                            fx.sparks(A.x, PUP_SLAM.floor, 18, "220,190,140", 6, 2.5);
                            sound.play("bossDown");
                            battleBg.ripple(A.x, PUP_SLAM.floor, 30, 8, 40);
                            fireFan(A.x, PUP_SLAM.floor - 16, -Math.PI/2, PUP_SLAM.shots, 0.42, spd*0.85, "small");
                            fireShot(A.x - 30, PUP_SLAM.floor - 8, Math.PI, spd*1.1, "normal");
                            fireShot(A.x + 30, PUP_SLAM.floor - 8, 0, spd*1.1, "normal");
                        }
                    }else if(A.t >= PUP_SLAM.stay) h.atk = null;
                    break;
                case "sweep":
                    A.pose = PUP_POSE.spread;
                    if(A.ph == "aim"){
                        if(A.t == 1){ A.dir = drone.X < CW/2 ? -1 : 1; }      //ドローン君から遠い端から払ってくる
                        var sx = A.dir < 0 ? CW + 70 : -70;
                        A.x += (sx - A.x)*0.1; A.y += (Math.max(170, Math.min(CH - 70, drone.Y)) - A.y)*0.12;
                        A.rot = A.dir > 0 ? -Math.PI/2 : Math.PI/2;     //指先を払う向きへ
                        if(A.t >= PUP_SWEEP.aim){ A.ph = "lock"; A.t = 0; sound.play("tell"); }
                    }else if(A.ph == "lock"){
                        if(A.t >= PUP_SWEEP.lock){ A.ph = "go"; A.t = 0; sound.play("dash"); fx.shake(6); }
                    }else{
                        A.x += A.dir*PUP_SWEEP.speed;
                        this.handHit(A.x + A.dir*18*HS, A.y, PUP_SWEEP.r);
                        if(A.x < -90 || A.x > CW + 90) h.atk = null;
                    }
                    break;
                case "grab":
                    if(A.ph == "chase"){
                        A.pose = PUP_POSE.claw; A.rot = 0;
                        to(drone.X, drone.Y - 12*HS, PUP_GRAB.lag);
                        if(A.t >= PUP_GRAB.chase){ A.ph = "snap"; A.t = 0; A.gx = drone.X; A.gy = drone.Y - 12*HS; sound.play("tell"); }
                    }else if(A.ph == "snap"){
                        to(A.gx, A.gy, 0.45);
                        if(A.t >= PUP_GRAB.snap){
                            A.ph = "hold"; A.t = 0; A.pose = PUP_POSE.fist;
                            this.handHit(A.x, A.y + 12*HS, PUP_GRAB.r);
                            fx.shake(6); sound.play("blade");
                        }
                    }else if(A.t >= PUP_GRAB.hold) h.atk = null;
                    break;
                case "flick":
                    A.pose = PUP_POSE.point;
                    if(A.ph == "aim") to(Math.max(140, Math.min(CW - 140, drone.X + (drone.X < _e.x ? 160 : -160))), 200, 0.1);
                    A.rot = Math.atan2(drone.Y - A.y, drone.X - A.x) - Math.PI/2;
                    if(A.ph == "aim" && A.t >= PUP_FLICK.aim){ A.ph = "fire"; A.t = 0; A.n = 0; }
                    if(A.ph == "fire" && A.t % PUP_FLICK.every == 1){
                        if(A.n >= PUP_FLICK.n){ h.atk = null; break; }
                        var tx = A.x - Math.sin(A.rot)*34*HS, ty = A.y + Math.cos(A.rot)*34*HS;
                        fireFan(tx, ty, Math.atan2(drone.Y - ty, drone.X - tx), 1 + (A.n % 2)*2, PUP_FLICK.spread, spd*1.15, "normal");
                        A.x += Math.sin(A.rot)*10; A.y -= Math.cos(A.rot)*10;      //はじいた反動
                        A.n++;
                        sound.play("enemyShot");
                    }
                    break;
            }
        }
    },

    //------------------------------------------------------------------ 人形の動き
    //吊っている場所(手の高さから糸の長さだけ下)
    anchor:function(_b,_p){ return { x:_b.x + _p.off, y:_b.y + 20 }; },
    puppet:function(_p){
        var b = null;
        for(var i=0; i<enemies.length; i++) if(enemies[i].id == _p.owner && !enemies[i].dead) b = enemies[i];
        if(!b){ this.free(_p,false); return; }
        if(_p.jerk > 0) _p.jerk--;
        var A = this.anchor(b,_p), tx = _p.x, ty = _p.y;
        var hangX = A.x + Math.sin(_p.th)*(_p.len - _p.jerk*2), hangY = A.y + Math.cos(_p.th)*(_p.len - _p.jerk*2);
        _p.harmless = _p.mode != "throw";
        switch(_p.mode){
            case "drop":
                var k = 1 - --_p.count/PUP_DROP_T, e = 1 - Math.pow(1 - k, 3);
                tx = _p.sx + (hangX - _p.sx)*e; ty = _p.sy + (hangY - _p.sy)*e;
                if(_p.count <= 0){ _p.mode = "hang"; _p.thV = (Math.random() - 0.5)*0.03; }
                break;
            case "hang":
                //振り子：傀儡師が動くと揺れる。ときどき糸を引かれてぴくっとする
                _p.thV += -0.0035*Math.sin(_p.th) - b.vx*0.0009;
                if(Math.random() < 0.01) _p.thV += (Math.random() - 0.5)*0.03;
                _p.thV *= 0.985;
                _p.th += _p.thV;
                tx = hangX; ty = hangY;
                break;
            case "dance":
                //傀儡師のまわりを回る
                _p.da += 0.022;
                tx = _p.x + (b.x + Math.cos(_p.da)*270 - _p.x)*0.12;
                ty = _p.y + (b.y + 120 + Math.sin(_p.da)*100 - _p.y)*0.12;
                break;
            case "wind":
                //引き上げられて構える(最後に狙いが固まる)
                var side = _p.off < 0 ? -1 : 1;
                tx = _p.x + (A.x + side*50 - _p.x)*0.12;
                ty = _p.y + (A.y + 70 - _p.y)*0.12;
                b.hands[_p.hand].lift = 14;
                var tgt = aimAt || drone;
                if(_p.count > PUP_THROW_CUE){ _p.aimX = tgt.X; _p.aimY = tgt.Y; }
                if(_p.count == PUP_THROW_CUE) sound.play("tell");
                if(--_p.count <= 0){
                    var a = Math.atan2(_p.aimY - _p.y, _p.aimX - _p.x);
                    _p.mode = "throw"; _p.count = PUP_THROW_T;
                    _p.vx = Math.cos(a)*PUP_THROW_SPEED; _p.vy = Math.sin(a)*PUP_THROW_SPEED;
                    sound.play("dash");
                    return;
                }
                break;
            case "throw":
                //vx,vy のまま飛ぶ(ジャストの判定もこの速さで見る)
                if(--_p.count <= 0 || _p.x < -40 || _p.x > CW + 40 || _p.y > CH + 40){ _p.mode = "back"; _p.count = PUP_BACK_T; }
                return;
            case "back":
                var k = 0.1;
                tx = _p.x + (hangX - _p.x)*k; ty = _p.y + (hangY - _p.y)*k;
                if(--_p.count <= 0){
                    _p.mode = "hang";
                    _p.th = Math.atan2(_p.x - A.x, _p.y - A.y);
                    _p.thV = 0;
                }
                break;
        }
        _p.vx = tx - _p.x; _p.vy = ty - _p.y;
        _p.look.update(dirFromVel(_p.vx, _p.vy), _p.vx);
    },

    //人形の糸が切れて解放される(_cut：ジャスト衝撃波で断ち切った)
    free:function(_p,_cut){
        if(_p.dead) return;
        _p.dead = true;
        this.freed++;
        var a = {
            x:_p.x, y:_p.y, vx:0, vy:-4, look:_p.look, t:0,
            slot:this.allies.length, fireT:30 + this.allies.length*9, guard:0, joyT:80,
            sayText:PUP_ALLY_LINES[(this.freed - 1) % PUP_ALLY_LINES.length], sayT:PUP_SAY_T - 30
        };
        a.look.setFace("happy", 90);
        a.look.setMood("fierce");
        this.allies.push(a);
        //糸が切れて飛び散る
        fx.flare(_p.x, _p.y, _cut ? 70 : 46, "255,255,255", 14);
        fx.ring(_p.x, _p.y, _cut ? 110 : 70, PUP_ALLY_COLOR, 20, 4);
        fx.sparks(_p.x, _p.y, _cut ? 24 : 14, PUP_STRING, 6, 2.5);
        for(var i=0; i<5; i++){
            var an = -Math.PI/2 + (Math.random() - 0.5)*1.4, s = 3 + Math.random()*4;
            effects.push({ line:true, x:_p.x, y:_p.y - 10, x2:_p.x + Math.cos(an)*30, y2:_p.y - 10 + Math.sin(an)*30,
                           color:PUP_STRING, w:1.5, life:20, maxLife:20 });
        }
        popup(_p.x, _p.y - 26, _cut ? "糸を断ち切った！" : "解放！", "rgb(30,140,220)", _cut);
        sound.play(_cut ? "justHit" : "shatter");
        if(_cut){ fx.shake(8); mainScreen.hitStop = Math.max(mainScreen.hitStop, 6); }
        var b = this.alive();
        if(b){ b.flinch = 24; }
    },

    //------------------------------------------------------------------ 味方(解放した同胞)
    stepAllies:function(){
        var b = this.alive(), R = this.rally;
        for(var i=0; i<this.allies.length; i++){
            var a = this.allies[i];
            a.t++;
            if(a.sayT > 0) a.sayT--;
            if(a.guard > 0) a.guard--;
            if(a.joyT > 0) a.joyT--;
            //並ぶ場所：ふだんはドローン君のまわり、一斉反撃では横一列
            var tx, ty;
            if(R && R.t < PUP_RALLY_CUT + PUP_RALLY_FIRE){
                var n = this.allies.length, k = i - (n - 1)/2;
                tx = drone.X + (k + (k >= 0 ? 0.5 : -0.5))*44; ty = drone.Y + Math.abs(k)*10;
            }else{
                var S = PUP_ALLY_SLOTS[a.slot % PUP_ALLY_SLOTS.length];
                tx = drone.X + S[0] + Math.sin(a.t*0.03 + a.slot)*8;
                ty = drone.Y + S[1] + Math.cos(a.t*0.04 + a.slot)*6;
            }
            if(a.joyT > 0 || (R && R.t >= PUP_RALLY_CUT + PUP_RALLY_FIRE)) ty -= Math.abs(Math.sin(a.t*0.25))*16;     //よろこんで跳ねる
            tx = Math.max(20, Math.min(CW - 20, tx)); ty = Math.max(40, Math.min(CH - 20, ty));
            a.vx += ((tx - a.x)*0.08 - a.vx)*0.25;
            a.vy += ((ty - a.y)*0.08 - a.vy)*0.25;
            a.x += a.vx; a.y += a.vy;
            a.look.update(dirFromVel(a.vx, a.vy), a.vx);
            //撃つ：傀儡師(盾にされている間は、まだ操られている人形の糸)
            if(!R && mainScreen.state == "play" && --a.fireT <= 0){
                a.fireT = PUP_ALLY_EVERY;
                var t = null;
                if(b && !b.phased && b.mode != "enter") t = b;
                else{
                    var B = this.bound(), best = 1e9;
                    for(var j=0; j<B.length; j++){ var d = Math.hypot(B[j].x - a.x, B[j].y - a.y); if(d < best){ best = d; t = B[j]; } }
                }
                if(t){
                    var an = Math.atan2(t.y - a.y, t.x - a.x);
                    this.shots.push({ x:a.x, y:a.y, vx:Math.cos(an)*PUP_ALLY_SPEED, vy:Math.sin(an)*PUP_ALLY_SPEED, life:90 });
                }
            }
            //近くの敵の弾をかばって消す
            if(a.guard <= 0){
                for(var j=enemyShots.length-1; j>=0; j--){
                    var s = enemyShots[j];
                    if(s.behind) continue;
                    if(Math.hypot(s.x - a.x, s.y - a.y) < 13 + (s.r || 4)){
                        enemyShots.splice(j,1);
                        a.guard = PUP_ALLY_GUARD;
                        fx.sparks(a.x, a.y, 5, PUP_ALLY_COLOR, 3, 2);
                        break;
                    }
                }
            }
        }
        //味方の弾
        for(var i=this.shots.length-1; i>=0; i--){
            var s = this.shots[i];
            s.x += s.vx; s.y += s.vy;
            var hit = false;
            for(var j=0; j<enemies.length && !hit; j++){
                var e = enemies[j];
                if(e.dead || e.phased || (e.type != "puppeteer" && e.type != "puppet")) continue;
                if(Math.hypot(e.x - s.x, e.y - s.y) < e.r + 4){
                    hit = true;
                    var dmg = Math.max(0.2, (b ? b.maxHp : 100)*PUP_ALLY_DMG);
                    mainScreen.hitEnemy(e, e.type == "puppet" ? dmg*2 : dmg, "ally");
                    fx.sparks(s.x, s.y, 3, PUP_ALLY_COLOR, 3, 1.6);
                }
            }
            if(hit || --s.life <= 0 || s.x < -20 || s.x > CW + 20 || s.y < -20 || s.y > CH + 20) this.shots.splice(i,1);
        }
        this.stepRally(b);
        this.stepMask();
        this.stepTwist(b);
    },

    //------------------------------------------------------------------ 一斉反撃
    startRally:function(){
        var b = this.alive();
        if(!b) return;
        this.ready = false;
        this.rally = { t:0, boss:b };
        b.mode = "rallied"; b.phased = false; b.harmless = false;
        this.threads = [];
        this.stopHands(b);
        enemyShots = [];
        mainScreen.guard = Math.max(mainScreen.guard, PUP_RALLY_CUT + PUP_RALLY_FIRE + 40);
        fx.flare(drone.X, drone.Y, 120, PUP_ALLY_COLOR, 24);
        fx.ring(drone.X, drone.Y, 200, PUP_ALLY_COLOR, 30, 6);
        fx.shake(10);
        sound.play("beamCharge");
        drone.look.setFace("fierce", 300);
        for(var i=0; i<this.allies.length; i++) this.allies[i].look.setFace("fierce", 300);
    },
    stepRally:function(_b){
        var R = this.rally;
        if(!R) return;
        R.t++;
        var b = R.boss, f = R.t - PUP_RALLY_CUT;
        if(f == 0){ sound.play("beam"); fx.shake(20); fx.tint("120,200,255",30); }
        if(f >= 0 && f < PUP_RALLY_FIRE && !b.dead){
            //体力が、撃ち終わりでちょうど0になるように削る
            this.finishing = true;
            if(f == PUP_RALLY_FIRE - 1){
                //とどめ：傀儡師を操っていた糸も切れる
                if(this.twist && this.twist.cut < 0){ this.twist.cut = 0; sound.play("shatter"); fx.flare(this.twist.x, 40, 160, "255,80,90", 20); }
                mainScreen.hitEnemy(b, b.hp + 1, "ally");
            }
            else{
                b.hp -= b.hp/(PUP_RALLY_FIRE - f)*0.9;
                b.flash = 3;
                b.flinch = 6;
                if(f % 8 == 0){ sound.play("hit"); fx.sparks(b.x, b.y, 6, "255,255,255", 6, 2.5); }
                mainScreen.shake = Math.max(mainScreen.shake, 4 + f*0.05);
            }
            this.finishing = false;
        }
        if(f >= PUP_RALLY_FIRE && f == PUP_RALLY_FIRE + 1){
            drone.look.setFace("happy", 120);
            for(var i=0; i<this.allies.length; i++){ var a = this.allies[i]; a.look.setFace("happy", 150); a.sayText = i == 0 ? "やったー！" : ""; a.sayT = i == 0 ? PUP_SAY_T : 0; }
        }
        if(f >= PUP_RALLY_FIRE + PUP_RALLY_END) this.rally = null;
    },
    //倒した：仮面が割れて落ち、糸がほどけて飛び散る
    onKill:function(_e){
        this.ready = false;
        this.stopHands(_e);
        this.threads = [];
        this.mask = { x:_e.x, y:_e.y, vx:(Math.random() - 0.5)*2, vy:-5, a:0, va:(Math.random() < 0.5 ? -1 : 1)*0.08, life:150 };
        fx.flare(_e.x, _e.y, 200, "255,255,255", 30);
        fx.ring(_e.x, _e.y, 300, PUP_STRING, 36, 8);
        fx.ring(_e.x, _e.y, 200, PUP_ALLY_COLOR, 28, 5);
        fx.sparks(_e.x, _e.y, 40, PUP_STRING, 9, 3);
        for(var i=0; i<16; i++){
            var an = Math.random()*Math.PI*2, L = 40 + Math.random()*90;
            effects.push({ line:true, x:_e.x, y:_e.y, x2:_e.x + Math.cos(an)*L, y2:_e.y + Math.sin(an)*L, color:PUP_STRING, w:1.5, life:40, maxLife:40 });
        }
        popup(_e.x, _e.y + 60, PUP_LINES.die, "rgb(110,60,160)", true);
        fx.shake(30);
        mainScreen.hitStop = Math.max(mainScreen.hitStop, 20);
    },
    stepMask:function(){
        var M = this.mask;
        if(!M) return;
        M.vy += 0.2; M.x += M.vx; M.y += M.vy; M.a += M.va;
        if(--M.life <= 0 || M.y > CH + 60) this.mask = null;
    },

    //------------------------------------------------------------------ 見た目
    //手の位置(画面の座標)
    handAt:function(_b,_k){ var h = _b.hands[_k]; return { x:_b.x + h.x, y:_b.y + h.y - h.lift*PUP_LIFT_MUL*PUP_HAND_SCALE }; },
    //体と手の動き(Cuphead のように大げさに)：
    //攻撃の前はのけぞって縦に伸び(ため)、一気に大きくなって身を乗り出し、ばねで行きすぎて戻る。
    //撃たれるとつぶれて戻り、ドローン君が被弾すると跳ねながら高笑い。手はばねで大きく動き、身を乗り出すとドローン君へ伸びる
    pose:function(_e){
        var t = _e.t;
        if(_e.laugh > 0) _e.laugh--;
        var laugh = _e.laugh > 0 ? Math.min(1, _e.laugh/15) : 0;
        if(_e.sub != _e.lastSub){
            if(_e.sub && _e.sub != "rest") _e.antic = PUP_ANTIC_T;
            _e.lastSub = _e.sub;
        }
        if(_e.flinch > (_e.lastFlinch || 0)) _e.squashV += PUP_SQUASH[1];
        _e.lastFlinch = _e.flinch;
        if(_e.antic > 0){
            //ため：のけぞる(マイナス) → 一気に乗り出す(1 まで)。そのあとはばねで戻る
            var k = 1 - --_e.antic/PUP_ANTIC_T, prev = _e.lean;
            if(k < PUP_ANTIC_SPLIT) _e.lean = -0.5*Math.sin(k/PUP_ANTIC_SPLIT*Math.PI/2);
            else _e.lean = -0.5 + 1.5*Math.pow((k - PUP_ANTIC_SPLIT)/(1 - PUP_ANTIC_SPLIT), 0.6);
            _e.leanV = _e.lean - prev;
            if(_e.antic == 0) _e.squashV -= 0.12;      //乗り出しきった瞬間に縦へつぶれる
        }else{
            _e.leanV += -_e.lean*0.05; _e.leanV *= 0.9; _e.lean += _e.leanV;
        }
        _e.squashV += -_e.squash*0.22; _e.squashV *= 0.82; _e.squash += _e.squashV;
        var lu = Math.max(0, _e.lean);
        for(var k=0; k<2; k++){
            var h = _e.hands[k], s = k == 0 ? -1 : 1, R = PUP_HAND_REST[k], bar = _e.bars[k], A = h.atk;
            h.grow = (h.grow || 1) + ((A && A.started ? PUP_HAND_GROW : 1) - (h.grow || 1))*0.15;    //攻撃に出ると手前へ迫って大きく
            //操り板：ふだんは手に持っている。手が攻撃に出ている間は、その場に残ってぶらぶら揺れる
            if(A && A.started){
                bar.vx += (R[0] - bar.x)*0.02 + Math.sin(t*0.07 + k)*0.15; bar.vy += (R[1] + 20*PUP_HAND_SCALE - bar.y)*0.02;
                bar.vx *= 0.92; bar.vy *= 0.92; bar.x += bar.vx; bar.y += bar.vy;
                var nx = A.x - _e.x, ny = A.y - _e.y;
                h.vx = nx - h.x; h.vy = ny - h.y; h.x = nx; h.y = ny;
                continue;
            }
            //ふだんは大きな8の字。身を乗り出すとドローン君へ伸び、のけぞると上へ引く。よろけると垂れ下がる
            var tx = R[0] + Math.sin(t*0.021 + k*2)*PUP_HAND_SWAY[0], ty = R[1] + Math.sin(t*0.042 + k)*PUP_HAND_SWAY[1];
            tx += (drone.X - _e.x - tx)*PUP_HAND_THRUST*lu; ty += (drone.Y - _e.y - ty)*PUP_HAND_THRUST*lu;
            ty += Math.min(0, _e.lean)*120;
            if(_e.mode == "stun"){ tx += s*40; ty += 130; }
            var pp = this.puppeted();       //上の糸に、手もかくかく引かれる
            if(pp){ var jk = Math.floor(t/PUP_TWIST.jerk) + k*7; tx += pp*(storyScreen.hash(jk, 3) - 0.5)*120; ty += pp*(storyScreen.hash(jk, 4) - 0.6)*90; }
            if(_e.mode == "rallied"){ tx += Math.sin(t*0.5 + k)*60; ty += Math.cos(t*0.43 + k)*50; }
            if(laugh){ tx -= s*90*laugh*(0.5 + 0.5*Math.sin(t*PUP_LAUGH[1]*2)); ty += 30*laugh + Math.sin(t*PUP_LAUGH[1]*2 + k)*20*laugh; }    //手をたたいて笑う
            h.vx += (tx - h.x)*PUP_HAND_SPRING; h.vy += (ty - h.y)*PUP_HAND_SPRING;
            h.vx *= PUP_HAND_DAMP; h.vy *= PUP_HAND_DAMP;
            h.x += h.vx; h.y += h.vy;
            if(h.lift > 0) h.lift *= 0.9;
            //手に戻ってきた操り板は、手に吸いつく
            var bx = h.x, by = h.y - h.lift*PUP_LIFT_MUL*PUP_HAND_SCALE + 20*PUP_HAND_SCALE;
            bar.x += (bx - bar.x)*0.35; bar.y += (by - bar.y)*0.35; bar.vx = bar.vy = 0;
        }
        var target = Math.sin(t*0.025)*0.12 + (_e.flinch > 0 ? Math.sin(_e.flinch*0.6)*0.4 : 0) + (_e.mode == "stun" ? 0.45 : 0)
                   - laugh*(0.22 + Math.sin(t*PUP_LAUGH[1])*0.12);
        _e.maskA += (target - _e.maskA)*0.2;
    },
    //体の変形(描くときに使う)：位置のずれ・横と縦の倍率・傾き
    bodyXf:function(_e){
        var t = _e.t, lean = _e.lean || 0, lu = Math.max(0, lean), st = Math.max(0, -lean), sq = _e.squash || 0;
        var laugh = _e.laugh > 0 ? Math.min(1, _e.laugh/15) : 0;
        var bounce = laugh*Math.abs(Math.sin(t*PUP_LAUGH[1]))*PUP_LAUGH[0];
        var breath = 0.035*Math.sin(t*0.04);
        //上の糸に引かれて、ぎくしゃくと動かされる(一定の間隔でかくっと向きが変わる)
        var pp = this.puppeted(), jk = Math.floor(t/PUP_TWIST.jerk);
        var jr = pp*(storyScreen.hash(jk, 1) - 0.5)*0.3, jy = pp*(storyScreen.hash(jk, 2) - 0.5)*30;
        return {
            dy:Math.sin(t*PUP_BOB[1])*PUP_BOB[0] + lu*PUP_LUNGE[2] - st*2*PUP_STRETCH[2] - bounce + jy,
            sx:PUP_SCALE*(1 + PUP_LUNGE[0]*lu - PUP_STRETCH[0]*2*st + PUP_SQUASH[2]*sq - breath*0.5),
            sy:PUP_SCALE*(1 + PUP_LUNGE[1]*lu + PUP_STRETCH[1]*2*st - PUP_SQUASH[2]*sq + breath),
            rot:Math.sin(t*0.03)*PUP_BOB[2] + laugh*Math.sin(t*PUP_LAUGH[1])*PUP_LAUGH[2] + jr
        };
    },

    //手の攻撃の予告(敵より奥)
    drawHandTells:function(_e){
        var t = _e.t, HS = PUP_HAND_SCALE*PUP_HAND_GROW;
        for(var k=0; k<2; k++){
            var A = _e.hands[k].atk;
            if(!A || !A.started) continue;
            var pulse = 0.5 + 0.5*Math.sin(t*0.4);
            if(A.kind == "slam" && A.ph != "stay"){
                //叩きつけ：床に落ちる手の影(近づくほど濃く小さく)と、まっすぐ下への点線
                var fl = PUP_SLAM.floor, near = Math.max(0, Math.min(1, 1 - (fl - A.y - 34*HS)/320));
                ctx.fillStyle = "rgba(20,8,12," + (0.25 + 0.45*near) + ")";
                ctx.beginPath(); ctx.ellipse(A.x, fl, 70 - 25*near, 12 - 4*near, 0, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "rgba(200,40,40," + (A.ph == "lock" ? 0.8 : 0.35 + 0.2*pulse) + ")"; ctx.lineWidth = A.ph == "lock" ? 2.5 : 1.5;
                ctx.setLineDash([8,7]); ctx.lineDashOffset = -t;
                ctx.beginPath(); ctx.moveTo(A.x, A.y + 40*HS); ctx.lineTo(A.x, fl); ctx.stroke();
                ctx.setLineDash([]); ctx.lineDashOffset = 0;
            }else if(A.kind == "sweep" && A.ph != "go"){
                //なぎ払い：払われる高さの帯と、来る向きの山形
                var B = PUP_SWEEP.band, lock = A.ph == "lock";
                ctx.fillStyle = "rgba(200,40,40," + (lock ? 0.28 : 0.1 + 0.08*pulse) + ")";
                ctx.fillRect(0, A.y - B, CW, B*2);
                ctx.strokeStyle = "rgba(200,40,40," + (lock ? 0.9 : 0.5) + ")"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(0, A.y - B); ctx.lineTo(CW, A.y - B); ctx.moveTo(0, A.y + B); ctx.lineTo(CW, A.y + B); ctx.stroke();
                for(var i=0; i<6; i++){
                    var cx = ((i*170 + t*4*A.dir) % CW + CW) % CW;
                    ctx.beginPath(); ctx.moveTo(cx - A.dir*10, A.y - 14); ctx.lineTo(cx + A.dir*6, A.y); ctx.lineTo(cx - A.dir*10, A.y + 14); ctx.stroke();
                }
            }else if(A.kind == "grab" && A.ph == "chase" && A.t > PUP_GRAB.chase - 30){
                //つまみ取り：ドローン君を囲む輪が縮む(つままれる合図)
                var k2 = (A.t - (PUP_GRAB.chase - 30))/30, R = 70 - 40*k2;
                ctx.strokeStyle = "rgba(" + PUP_STRING + "," + (0.4 + 0.5*k2) + ")"; ctx.lineWidth = 2;
                for(var q=0; q<4; q++){
                    var a = q*Math.PI/2 + t*0.08;
                    ctx.beginPath(); ctx.arc(drone.X, drone.Y, R, a, a + 0.9); ctx.stroke();
                }
            }else if(A.kind == "flick" && A.ph == "aim"){
                var tx = A.x - Math.sin(A.rot)*34*HS, ty = A.y + Math.cos(A.rot)*34*HS;
                ctx.strokeStyle = "rgba(200,40,40," + (0.25 + 0.25*pulse) + ")"; ctx.lineWidth = 1.5;
                ctx.setLineDash([3,6]);
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(drone.X, drone.Y); ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        ctx.lineWidth = 1;
    },
    //糸の斬撃・人形を吊る糸(敵より奥。special.drawAttack から)
    drawAttack:function(_e){
        this.drawTwistBack();
        this.drawHandTells(_e);
        //糸の斬撃
        for(var i=0; i<this.threads.length; i++){
            var T = this.threads[i], L = 1400, x2 = T.x + Math.cos(T.a)*L, y2 = T.y + Math.sin(T.a)*L;
            if(T.t < PUP_THREAD_WARN){
                var k = T.t/PUP_THREAD_WARN;
                ctx.strokeStyle = "rgba(" + PUP_STRING + "," + (0.25 + 0.5*k) + ")";
                ctx.lineWidth = 1 + k*1.5;
                ctx.setLineDash([6,6]);
                ctx.lineDashOffset = -T.t*0.8;
                ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(x2, y2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.lineDashOffset = 0;
            }else{
                var k = 1 - (T.t - PUP_THREAD_WARN)/PUP_THREAD_LIVE;
                ctx.strokeStyle = "rgba(" + PUP_STRING + "," + (0.5*k) + ")";
                ctx.lineWidth = PUP_THREAD_W*2 + 4;
                ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(x2, y2); ctx.stroke();
                ctx.strokeStyle = "rgba(255,255,255," + k + ")";
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(x2, y2); ctx.stroke();
            }
        }
        ctx.lineWidth = 1;
        //人形を吊る糸：操り板の3点から人形の頭へ。糸の強さ(体力)が減ると本数が減る
        var B = this.bound();
        for(var i=0; i<B.length; i++){
            var p = B[i];
            if(p.owner != _e.id) continue;
            var bar = _e.bars[p.hand], bx = _e.x + bar.x, by = _e.y + bar.y, n = Math.max(1, Math.ceil(p.hp/p.maxHp*3));
            var HS = PUP_HAND_SCALE, ends = [[bx - 22*HS, by],[bx + 22*HS, by],[bx, by + 12*HS]];
            var tips = [[p.x - 8, p.y - 8],[p.x + 8, p.y - 8],[p.x, p.y - 14]];
            var taut = p.mode == "throw" ? 1 : 0;
            for(var s=0; s<3; s++){
                var cut = s >= n;
                ctx.strokeStyle = cut ? "rgba(" + PUP_STRING + ",0.18)" : "rgba(" + PUP_STRING + "," + (0.7 + taut*0.3) + ")";
                ctx.lineWidth = cut ? 1 : 1.3 + taut;
                ctx.beginPath();
                if(cut){
                    //切れた糸は手から短く垂れる
                    ctx.moveTo(ends[s][0], ends[s][1]);
                    ctx.quadraticCurveTo(ends[s][0] + 6, ends[s][1] + 30, ends[s][0] + 2, ends[s][1] + 46);
                }else{
                    var mx = (ends[s][0] + tips[s][0])/2, my = (ends[s][1] + tips[s][1])/2 + (taut ? 0 : 10);
                    ctx.moveTo(ends[s][0], ends[s][1]);
                    ctx.quadraticCurveTo(mx, my, tips[s][0], tips[s][1]);
                }
                ctx.stroke();
            }
        }
        ctx.lineWidth = 1;
    },

    //Blender の絵：はじめて描くときに読み込む。そろうまでは図形の絵
    baked:{
        imgs:null, left:0,
        ready:function(){
            if(/pup2d/.test(location.hash)) return false;
            if(!this.imgs){
                var self = this, names = ["body","mask","handL","handR","bar"];
                this.imgs = {}; this.left = names.length;
                names.forEach(function(n){
                    var im = new Image();
                    im.onload = function(){ self.left--; };
                    im.onerror = function(){ self.left = -1; };     //見つからなければ図形の絵のまま
                    im.src = "images/game/puppeteer/" + n + ".png";
                    self.imgs[n] = im;
                });
            }
            return this.left == 0;
        },
        //コマ _f を、原点に合わせて描く。_white は被弾で白く光らせる
        draw:function(_name,_spec,_f,_white){
            var im = this.imgs[_name], a = _spec.area, P = _spec.px;
            if(_white) im = tintedImage(im, "255,255,255");
            var f = ((_f % _spec.frames) + _spec.frames) % _spec.frames;
            ctx.drawImage(im, (f % _spec.cols)*a[2]*P, Math.floor(f/_spec.cols)*a[3]*P, a[2]*P, a[3]*P, a[0], a[1], a[2], a[3]);
        }
    },
    //傀儡師(Blender の絵。translate済み。仮面の中心が原点)
    //体は PUP_SCALE 倍で、息づかい・身を乗り出す(大きくなって迫る)・被弾でつぶれる・高笑いで揺れる。手は離れて大きく動く
    artBaked:function(_e,_body){
        var A = enemyArt, t = _e.t, K = this.baked, white = !!_body;
        var laugh = _e.laugh > 0 ? Math.min(1, _e.laugh/15) : 0, X = this.bodyXf(_e);
        //体は頭の上(糸で吊られている所)を支点に振り子のように傾け、伸び縮みは仮面の中心で
        ctx.save();
        ctx.translate(0, -60); ctx.rotate(X.rot); ctx.translate(0, 60 + X.dy);
        ctx.scale(X.sx, X.sy);
        //盾にしている間：まわりに糸の繭(薄い糸が回る)
        if(_e.phased){
            ctx.strokeStyle = "rgba(" + PUP_STRING + ",0.35)"; ctx.lineWidth = 0.6;
            for(var i=0; i<5; i++){
                ctx.beginPath();
                ctx.ellipse(0, 30, 66, 84, t*0.01 + i*Math.PI/5, 0, Math.PI*2);
                ctx.stroke();
            }
            ctx.lineWidth = 1;
        }
        //マントの裾からこぼれる紫のもや
        for(var i=0; i<3; i++){
            var ph = ((t*0.012 + i/3) % 1);
            ctx.fillStyle = "rgba(120,70,170," + (0.2*(1 - ph)) + ")";
            A.circle(Math.sin(i*2.1 + t*0.02)*30, 96 + ph*30, 8 + ph*10); ctx.fill();
        }
        //マント・頭巾・襟：裾のなびきは図形の絵と同じ速さ。コマが少ないので、となりのコマを重ねてなじませる
        var fb = t*0.08/(Math.PI*2)*PUP_ART.body.frames, f0 = Math.floor(fb);
        K.draw("body", PUP_ART.body, f0, white);
        ctx.globalAlpha = fb - f0;
        K.draw("body", PUP_ART.body, f0 + 1, white);
        ctx.globalAlpha = 1;
        //仮面：ひびは幕が進むたびに増え、よろけると・高笑いで口が開く。ドローン君のほうを少し見る
        var open = _e.mode == "stun" || _e.mode == "rallied" || laugh > 0.3;
        var m = (_e.stage >= 2 || _e.mode == "stun" ? 1 : 0) + (_e.stage >= 3 ? 2 : 0)
              + (_e.mode == "last" || _e.mode == "rallied" ? 4 : 0) + (open ? 8 : 0);
        var lx = Math.max(-1, Math.min(1, (drone.X - _e.x)/300)), ly = Math.max(-1, Math.min(1, (drone.Y - _e.y)/400));
        ctx.save();
        ctx.translate(lx*PUP_LOOK/PUP_SCALE, ly*PUP_LOOK*0.6/PUP_SCALE);
        ctx.rotate(_e.maskA - laugh*0.1);
        K.draw("mask", PUP_ART.mask, m, white);
        //目の奥の赤い光(本気のときは強く、ゆっくり脈打つ)
        var glow = (_e.mode == "last" || _e.mode == "solo" ? 0.9 : 0.55) + 0.1*Math.sin(t*0.09);
        for(var s=0; s<2; s++) A.halo(PUP_ART_EYES[s][0], PUP_ART_EYES[s][1], 6, "229,48,43", glow);
        ctx.restore();
        ctx.restore();
        //操り板と手(体とは別に大きく動く。動く向きへ傾く)
        var hf = Math.floor(t*0.07/(Math.PI*2)*PUP_ART.hand.wiggle) % PUP_ART.hand.wiggle, HS = PUP_HAND_SCALE;
        for(var k=0; k<2; k++){
            var h = _e.hands[k], hx = h.x, hy = h.y - h.lift*PUP_LIFT_MUL*HS, s = k == 0 ? -1 : 1, bar = _e.bars[k];
            var A = h.atk && h.atk.started ? h.atk : null;
            ctx.save();
            ctx.translate(bar.x, bar.y);
            ctx.rotate(Math.sin(t*0.05 + k)*0.12 - s*h.lift*0.01 + (A ? bar.vx*0.03 : h.vx*0.012));
            ctx.scale(HS, HS);
            K.draw("bar", PUP_ART.bar, 0, white);
            ctx.restore();
            ctx.save();
            ctx.translate(hx, hy);
            //攻撃中は攻撃の形と向き。速く動くと動く向きへ伸びる
            var sp = Math.min(1, Math.hypot(h.vx, h.vy)/30);
            ctx.rotate(A ? A.rot : s*0.08 + h.vx*0.02);
            ctx.scale(HS*(h.grow || 1)*(1 - 0.12*sp), HS*(h.grow || 1)*(1 + 0.2*sp));
            K.draw(k == 0 ? "handL" : "handR", PUP_ART.hand, A && A.pose != null ? A.pose : hf, white);
            ctx.restore();
        }
    },

    //傀儡師(translate済み。仮面の中心が原点)
    art:function(_e,_body){
        if(this.baked.ready()){ this.artBaked(_e,_body); return; }
        //図形の絵：全体を PUP_SCALE 倍で描く(手の位置は倍率で割って渡す)
        var e2 = Object.create(_e);
        e2.hands = _e.hands.map(function(h){ return { x:h.x/PUP_SCALE, y:h.y/PUP_SCALE, lift:h.lift }; });
        ctx.save();
        ctx.scale(PUP_SCALE, PUP_SCALE);
        this.art2d(e2,_body);
        ctx.restore();
    },
    art2d:function(_e,_body){
        var C = ENEMY_COLOR, A = enemyArt, t = _e.t;
        var cloak = _body || (_e.mode == "rallied" ? "#3a2440" : "#2a2236");
        //盾にしている間：まわりに糸の繭(薄い糸が回る)
        if(_e.phased){
            ctx.strokeStyle = "rgba(" + PUP_STRING + ",0.35)";
            for(var i=0; i<5; i++){
                ctx.beginPath();
                ctx.ellipse(0, 30, 66, 84, t*0.01 + i*Math.PI/5, 0, Math.PI*2);
                ctx.stroke();
            }
        }
        //マントの裾からこぼれる紫のもや
        for(var i=0; i<3; i++){
            var ph = ((t*0.012 + i/3) % 1);
            ctx.fillStyle = "rgba(120,70,170," + (0.25*(1 - ph)) + ")";
            A.circle(Math.sin(i*2.1 + t*0.02)*30, 96 + ph*30, 8 + ph*10); ctx.fill();
        }
        //マント(裾がなびく)
        ctx.beginPath();
        ctx.moveTo(-20, 10);
        ctx.quadraticCurveTo(-46, 50, -52, 92);
        for(var i=0; i<=8; i++){
            var x = -52 + i*13, y = 92 + (i % 2 ? -12 : 0) + Math.sin(t*0.08 + i)*4;
            ctx.lineTo(x, y);
        }
        ctx.quadraticCurveTo(46, 50, 20, 10);
        ctx.closePath();
        A.fillInk(cloak, 1.8);
        ctx.strokeStyle = "#4a3d5c"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-8, 22); ctx.lineTo(-20, 84); ctx.moveTo(8, 22); ctx.lineTo(18, 86); ctx.moveTo(0, 26); ctx.lineTo(-1, 80); ctx.stroke();
        //襟(とがった高い襟)
        ctx.beginPath();
        ctx.moveTo(-34, 14); ctx.lineTo(-42, -22); ctx.lineTo(-26, -10); ctx.lineTo(-16, -34); ctx.lineTo(0, -18);
        ctx.lineTo(16, -34); ctx.lineTo(26, -10); ctx.lineTo(42, -22); ctx.lineTo(34, 14); ctx.closePath();
        A.fillInk(_body || "#3a2e4a", 1.6);
        ctx.strokeStyle = "#5c4a73"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-38, -16); ctx.lineTo(-30, 10); ctx.moveTo(38, -16); ctx.lineTo(30, 10); ctx.stroke();
        //頭巾
        A.circle(0, 0, 23); A.fillInk(_body || "#1d1726", 1.6);
        //仮面
        ctx.save();
        ctx.rotate(_e.maskA);
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 19, 0, 0, Math.PI*2);
        A.fillInk(_body || "#efe9dc", 1.6);
        ctx.strokeStyle = "#fffaf0"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 16, 0, Math.PI*1.1, Math.PI*1.45); ctx.stroke();
        //目：つり上がった細い切れ目が赤く光る
        var glow = _e.mode == "last" || _e.mode == "solo" ? 1 : 0.7;
        for(var s=-1; s<=1; s+=2){
            A.halo(s*7, -4, 8, "229,48,43", glow);
            ctx.beginPath();
            ctx.moveTo(s*2.5, -2.5);
            ctx.quadraticCurveTo(s*8, -9, s*12.5, -7);
            ctx.quadraticCurveTo(s*8, -4, s*2.5, -2.5);
            ctx.fillStyle = C.red; ctx.fill();
            //目の下の紫の線
            ctx.strokeStyle = "#7b4ab5"; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(s*7, 1); ctx.lineTo(s*8, 7); ctx.stroke();
        }
        //笑った口(見下したような笑み。よろけている間は口が開く)
        ctx.strokeStyle = "#7a1020"; ctx.lineWidth = 1.6;
        ctx.beginPath();
        if(_e.mode == "stun" || _e.mode == "rallied"){ A.circle(0, 10, 3.2); ctx.fillStyle = "#3a0a12"; ctx.fill(); }
        else{ ctx.moveTo(-7, 8); ctx.quadraticCurveTo(0, 14, 7, 8); ctx.stroke(); }
        //額のしるし
        ctx.fillStyle = "#7b4ab5";
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(2.5, -12.5); ctx.lineTo(0, -9); ctx.lineTo(-2.5, -12.5); ctx.closePath(); ctx.fill();
        //ひび：幕が進むたびに増える
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
        ctx.beginPath();
        if(_e.stage >= 2 || _e.mode == "stun"){ ctx.moveTo(5, -18); ctx.lineTo(2, -10); ctx.lineTo(6, -5); ctx.lineTo(4, 1); }
        if(_e.stage >= 3){ ctx.moveTo(-13, 4); ctx.lineTo(-7, 9); ctx.lineTo(-9, 15); ctx.moveTo(-7, 9); ctx.lineTo(-2, 12); }
        if(_e.mode == "last" || _e.mode == "rallied"){ ctx.moveTo(0, -19); ctx.lineTo(-3, -9); ctx.lineTo(1, 0); ctx.lineTo(-2, 9); ctx.lineTo(1, 18); }
        ctx.stroke();
        ctx.restore();
        //手と操り板
        for(var k=0; k<2; k++){
            var h = _e.hands[k], hx = h.x, hy = h.y - h.lift, s = k == 0 ? -1 : 1;
            //操り板(十字)
            ctx.save();
            ctx.translate(hx, hy + 20);
            ctx.rotate(Math.sin(t*0.05 + k)*0.12 - s*h.lift*0.01);
            A.roundRect(-24, -2.5, 48, 5, 2); A.fillInk(_body || "#4a3a2c", 1.2);
            A.roundRect(-2.5, -14, 5, 26, 2); A.fillInk(_body || "#4a3a2c", 1.2);
            A.halo(0, 0, 7, "170,110,230", 0.8);
            A.circle(0, 0, 3); A.fillInk("#b98ae8", 1);
            ctx.restore();
            //手のひらと長い指(板をつまむ)
            ctx.beginPath(); ctx.ellipse(hx, hy, 11, 8, s*0.2, 0, Math.PI*2);
            A.fillInk(_body || "#3a2e4a", 1.4);
            ctx.lineCap = "round";
            for(var f=0; f<4; f++){
                var fx0 = hx + (f - 1.5)*5, cur = Math.sin(t*0.07 + f + k)*2;
                ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(fx0, hy + 4); ctx.quadraticCurveTo(fx0 + (f - 1.5)*3 + cur, hy + 12, fx0 + (f - 1.5)*4, hy + 17); ctx.stroke();
                ctx.strokeStyle = _body || "#4a3d5c"; ctx.lineWidth = 2.2;
                ctx.beginPath(); ctx.moveTo(fx0, hy + 4); ctx.quadraticCurveTo(fx0 + (f - 1.5)*3 + cur, hy + 12, fx0 + (f - 1.5)*4, hy + 17); ctx.stroke();
            }
            ctx.lineCap = "butt";
        }
        ctx.lineWidth = 1;
    },

    //人形(translate済み)：糸で吊られて少し傾く。苦しむ顔はさせず、紫の結び目と薄い光で操られているのを見せる
    drawPuppet:function(_p,_body){
        ctx.save();
        var tilt = _p.mode == "hang" ? -_p.th*0.6 : _p.mode == "throw" ? Math.atan2(_p.vy,_p.vx)*0.15 : 0;
        ctx.rotate(tilt);
        enemyArt.halo(0, 0, 24, "150,90,220", 0.5 + 0.2*Math.sin(_p.t*0.1));
        if(_body){ ctx.globalAlpha = 0.6; }
        _p.look.draw(0, 0);
        ctx.globalAlpha = 1;
        //頭の上の糸の結び目
        ctx.strokeStyle = "rgb(" + PUP_STRING + ")"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-4, -18); ctx.lineTo(4, -12); ctx.moveTo(4, -18); ctx.lineTo(-4, -12); ctx.stroke();
        //投げつける合図：体に星のきらめき
        if(_p.mode == "wind" && _p.count <= PUP_THROW_CUE){
            var k = 1 - _p.count/PUP_THROW_CUE, R = 6 + 10*Math.sin(k*Math.PI);
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.beginPath();
            ctx.moveTo(0, -R); ctx.lineTo(R*0.2, -R*0.2); ctx.lineTo(R, 0); ctx.lineTo(R*0.2, R*0.2);
            ctx.lineTo(0, R); ctx.lineTo(-R*0.2, R*0.2); ctx.lineTo(-R, 0); ctx.lineTo(-R*0.2, -R*0.2); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        ctx.lineWidth = 1;
        if(_p.hp < _p.maxHp) this.gauge(_p);
    },
    //糸の強さ(小さなゲージ。translate済み)
    gauge:function(_p){
        ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fillRect(-14, 20, 28, 4);
        ctx.fillStyle = "rgb(" + PUP_STRING + ")"; ctx.fillRect(-14, 20, 28*Math.max(0,_p.hp)/_p.maxHp, 4);
    },

    //味方・味方の弾・一斉反撃のビーム・吹き出し・落ちる仮面(敵より手前。rival.drawIntro の前から)
    drawOver:function(){
        var b = this.alive(), R = this.rally;
        //一斉反撃のビーム
        if(R && b && R.t >= PUP_RALLY_CUT && R.t < PUP_RALLY_CUT + PUP_RALLY_FIRE){
            var f = R.t - PUP_RALLY_CUT, k = Math.min(1, f/12), wob = Math.sin(f*0.6)*1.5;
            var src = this.allies.map(function(a){ return [a.x, a.y]; });
            src.push([drone.X, drone.Y]);
            ctx.lineCap = "round";
            for(var i=0; i<src.length; i++){
                var me = i == src.length - 1;
                ctx.strokeStyle = "rgba(" + (me ? "255,200,120" : PUP_ALLY_COLOR) + "," + (0.35*k) + ")";
                ctx.lineWidth = (me ? 22 : 14)*k + wob;
                ctx.beginPath(); ctx.moveTo(src[i][0], src[i][1]); ctx.lineTo(b.x, b.y); ctx.stroke();
                ctx.strokeStyle = "rgba(255,255,255," + (0.9*k) + ")";
                ctx.lineWidth = (me ? 7 : 4)*k;
                ctx.beginPath(); ctx.moveTo(src[i][0], src[i][1]); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
            ctx.lineCap = "butt";
            enemyArt.halo(b.x, b.y, 50 + f*0.4, "255,255,255", 0.8);
        }
        //味方の弾
        for(var i=0; i<this.shots.length; i++){
            var s = this.shots[i];
            ctx.strokeStyle = "rgba(" + PUP_ALLY_COLOR + ",0.5)"; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx*1.4, s.y - s.vy*1.4); ctx.stroke();
            ctx.fillStyle = "#fff";
            enemyArt.circle(s.x, s.y, 2.6); ctx.fill();
        }
        ctx.lineWidth = 1;
        //味方
        for(var i=0; i<this.allies.length; i++){
            var a = this.allies[i];
            //味方の印：水色の光と輪(まだ操られている人形の紫と見分ける)
            enemyArt.halo(a.x, a.y, 22, PUP_ALLY_COLOR, a.guard > 0 ? 0.9 : 0.4);
            ctx.strokeStyle = "rgba(" + PUP_ALLY_COLOR + ",0.85)"; ctx.lineWidth = 2;
            enemyArt.circle(a.x, a.y, 21); ctx.stroke();
            ctx.lineWidth = 1;
            a.look.draw(a.x, a.y);
        }
        //一斉反撃の合図
        if(this.ready){
            var p = 0.6 + 0.4*Math.sin(mainScreen.clock*0.2);
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.font = "bold 20px sans-serif";
            ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.strokeText("衝撃波で合図！ みんなで一斉反撃", drone.X, drone.Y - 52);
            ctx.fillStyle = "rgba(20,120,210," + p + ")";
            ctx.fillText("衝撃波で合図！ みんなで一斉反撃", drone.X, drone.Y - 52);
            ctx.strokeStyle = "rgba(" + PUP_ALLY_COLOR + "," + p + ")"; ctx.lineWidth = 2;
            enemyArt.circle(drone.X, drone.Y, 30 + 6*Math.sin(mainScreen.clock*0.2)); ctx.stroke();
            ctx.lineWidth = 1;
        }
        //吹き出し
        if(b && b.sayT > 0 && !this.cine()) this.bubble(b.x, b.y, b.sayText, b.sayT, "rgb(110,60,160)", b.y < 200 ? 64*PUP_SCALE : -70);
        for(var i=0; i<this.allies.length; i++){
            var a = this.allies[i];
            if(a.sayT > 0 && a.sayText) this.bubble(a.x, a.y, a.sayText, a.sayT, "rgb(20,110,190)", -36);
        }
        this.drawTwistFront();
        if(!this.alive()) this.drawTwistBack();      //倒したあとも、影が闇へ退くところを見せる
        //落ちていく仮面
        var M = this.mask;
        if(M){
            ctx.save();
            ctx.globalAlpha = Math.min(1, M.life/40);
            ctx.translate(M.x, M.y); ctx.rotate(M.a); ctx.scale(PUP_SCALE, PUP_SCALE);
            if(this.baked.ready()){
                this.baked.draw("mask", PUP_ART.mask, 15);     //ひびだらけで口の開いた仮面
                ctx.restore();
                return;
            }
            ctx.beginPath(); ctx.ellipse(0, 0, 15, 19, 0, 0, Math.PI*2);
            enemyArt.fillInk("#efe9dc", 1.6);
            ctx.strokeStyle = ENEMY_COLOR.ink; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(-3, -9); ctx.lineTo(1, 0); ctx.lineTo(-2, 9); ctx.lineTo(1, 19); ctx.stroke();
            ctx.fillStyle = "#3a0a12";
            for(var s=-1; s<=1; s+=2){ ctx.beginPath(); ctx.ellipse(s*7, -5, 4, 1.6, s*-0.4, 0, Math.PI*2); ctx.fill(); }
            ctx.restore();
            ctx.lineWidth = 1;
        }
    },
    bubble:function(_x,_y,_text,_t,_ink,_dy){
        ctx.save();
        ctx.font = "bold 14px sans-serif";
        var w = ctx.measureText(_text).width + 20, h = 26;
        var bx = Math.max(w/2 + 6, Math.min(CW - w/2 - 6, _x)), by = _y + _dy;
        ctx.globalAlpha = Math.min(1, _t/15, (PUP_SAY_T - _t + 1)/6);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.strokeStyle = _ink;
        ctx.lineWidth = 2;
        enemyArt.roundRect(bx - w/2, by - h/2, w, h, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = _ink;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(_text, bx, by + 1);
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //------------------------------------------------------------------ 傀儡師を操る影
    stepTwist:function(_b){
        var T = this.twist;
        if(!T) return;
        T.t++;
        if(_b){ T.x += (_b.x - T.x)*0.05; T.by = _b.y; }
        if(T.cut >= 0 && ++T.cut > PUP_TWIST.leave){ this.twist = null; return; }
        if(T.t == PUP_TWIST.from) sound.play("summon");
        if(T.t == PUP_TWIST.from + PUP_TWIST.down){ fx.shake(18); sound.play("bossDown"); }     //操り板が下りきって、糸が張る
    },
    //明かすムービーの最中か
    cine:function(){ var T = this.twist; return !!(T && T.cut < 0 && T.t < PUP_TWIST.cine); },
    //影の手が下りてきた割合(0～1)
    twistK:function(){ var T = this.twist; return Math.max(0, Math.min(1, (T.t - PUP_TWIST.from)/PUP_TWIST.down)); },
    //操られている傀儡師のぎくしゃく(0 なし ～ 1)。糸が張っている間だけ
    puppeted:function(){
        var T = this.twist;
        return T && T.cut < 0 ? this.twistK() : 0;
    },
    //影の手の高さ・糸の張る所(画面の座標)。傀儡師の真上に、画面の中で見える高さまで下りてくる
    twistPose:function(){
        var T = this.twist, k = this.twistK(), e = 1 - Math.pow(1 - k, 3);
        var up = T.cut >= 0 ? Math.pow(T.cut/PUP_TWIST.leave, 2)*320 : 0;     //糸が切れると闇へ退く
        var goal = (T.by || PUP_LAND_Y + PUP_TWIST.drop) - PUP_TWIST.above;
        var y = -320 + (goal + 320)*e - up + Math.sin(T.t*0.03)*6;
        var S = PUP_TWIST.scale;
        return { x:T.x + Math.sin(T.t*0.017)*20, y:y, barY:y + 20*S, S:S, a:T.cut >= 0 ? Math.max(0, 1 - T.cut/PUP_TWIST.leave) : Math.min(1, k*1.5) };
    },
    //絵のコマを黒い影にしたもの(覚えておく)
    shade:function(_name,_spec,_f,_col){
        var key = _name + _f + (_col || "");
        this.shades = this.shades || {};
        if(!this.shades[key]){
            var a = _spec.area, P = _spec.px, c = document.createElement("canvas");
            c.width = a[2]*P; c.height = a[3]*P;
            var g = c.getContext("2d");
            g.drawImage(this.baked.imgs[_name], (_f % _spec.cols)*a[2]*P, Math.floor(_f/_spec.cols)*a[3]*P, a[2]*P, a[3]*P, 0, 0, c.width, c.height);
            g.globalCompositeOperation = "source-in";
            g.fillStyle = _col || "#0c0508"; g.fillRect(0, 0, c.width, c.height);
            this.shades[key] = c;
        }
        return this.shades[key];
    },
    //影(傀儡師より奥)：上からの暗がりと、闇に光る赤い目
    drawTwistBack:function(){
        var T = this.twist;
        if(!T) return;
        var P = this.twistPose(), t = T.t;
        ctx.save();
        ctx.globalAlpha = P.a;
        var g = ctx.createLinearGradient(0, 0, 0, 260);
        g.addColorStop(0, "rgba(8,2,6,0.85)"); g.addColorStop(1, "rgba(8,2,6,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, CW, 260);
        //闇の奥の目(下りてきた影の手の左右。開いていき、ときどきまばたきし、瞳はドローン君を追う)
        var open = Math.min(1, this.twistK()*1.4)*(Math.abs(Math.sin(t*0.013)) < 0.05 ? 0.1 : 1), ey = P.y + PUP_TWIST.eyes[1];
        for(var s=-1; s<=1; s+=2) this.drawShadowEye(P.x + s*PUP_TWIST.eyes[0], ey, s, open);
        ctx.restore();
    },
    //影の目：つり上がったアーモンド形。黄ばんで血走った白目に、光る赤い虹彩と縦長の瞳
    drawShadowEye:function(_x,_y,_s,_open){
        var W = PUP_TWIST.eyeW, H = PUP_TWIST.eyeH*_open;
        enemyArt.halo(_x, _y, W*1.4, "230,30,40", 0.55*_open + 0.15);
        if(H < 0.8){
            //閉じている：まぶたの線だけ
            ctx.strokeStyle = "rgba(255,80,80,0.8)"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(_x - W, _y); ctx.quadraticCurveTo(_x, _y + 4, _x + W, _y); ctx.stroke();
            return;
        }
        ctx.save();
        ctx.translate(_x, _y); ctx.rotate(_s*0.22);      //目じりがつり上がる(内側が下がる)
        var eye = function(){
            ctx.beginPath(); ctx.moveTo(-W, 0);
            ctx.bezierCurveTo(-W*0.4, -H*1.5, W*0.5, -H*1.4, W, -H*0.1);
            ctx.bezierCurveTo(W*0.4, H*1.2, -W*0.5, H*1.2, -W, 0);
            ctx.closePath();
        };
        //白目
        var g = ctx.createRadialGradient(0, 0, 1, 0, 0, W);
        g.addColorStop(0, "#f2e2b0"); g.addColorStop(0.6, "#d8a070"); g.addColorStop(1, "#7a1a14");
        eye(); ctx.fillStyle = g; ctx.fill();
        ctx.save(); eye(); ctx.clip();
        //血の筋
        ctx.strokeStyle = "rgba(170,20,20,0.6)"; ctx.lineWidth = 0.8;
        for(var i=0; i<5; i++){
            var a = i*1.3 + 0.4;
            ctx.beginPath(); ctx.moveTo(Math.cos(a)*W, Math.sin(a)*H); ctx.quadraticCurveTo(Math.cos(a + 0.3)*W*0.6, Math.sin(a + 0.3)*H*0.5, Math.cos(a)*W*0.35, Math.sin(a)*H*0.3); ctx.stroke();
        }
        //虹彩と瞳(ドローン君のほうを見る)
        var dx = drone.X - _x, dy = drone.Y - _y, d = Math.hypot(dx, dy) || 1;
        var ix = dx/d*W*0.3, iy = dy/d*H*0.3, R = PUP_TWIST.eyeH*0.95;
        var ig = ctx.createRadialGradient(ix, iy, 1, ix, iy, R);
        ig.addColorStop(0, "#ff6a3a"); ig.addColorStop(0.55, "#d01818"); ig.addColorStop(1, "#3a0206");
        ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(ix, iy, R, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#050002"; ctx.beginPath(); ctx.ellipse(ix, iy, R*0.22, R*0.85, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.arc(ix - R*0.35, iy - R*0.4, R*0.16, 0, Math.PI*2); ctx.fill();
        //上まぶたの影
        var lg = ctx.createLinearGradient(0, -H*1.2, 0, 0);
        lg.addColorStop(0, "rgba(20,0,4,0.75)"); lg.addColorStop(1, "rgba(20,0,4,0)");
        ctx.fillStyle = lg; ctx.fillRect(-W, -H*1.5, W*2, H*1.5);
        ctx.restore();
        //ふち(まぶた)
        eye(); ctx.strokeStyle = "#1a0306"; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.restore();
    },
    //影の手と操り板(傀儡師の頭の上に、手前から覆いかぶさる。赤い光のふち)
    drawTwistHand:function(){
        var T = this.twist;
        if(!T) return;
        var P = this.twistPose(), t = T.t;
        ctx.save();
        ctx.globalAlpha = P.a;
        if(this.baked.ready()){
            //赤いふち(少しずらして重ねた赤い影)の上に、黒い影
            var S = P.S, ha = PUP_ART.hand.area, ba = PUP_ART.bar.area, self = this;
            var layer = function(_col){
                var hs = self.shade("handR", PUP_ART.hand, PUP_POSE.fist, _col), bs = self.shade("bar", PUP_ART.bar, 0, _col);
                var o = _col ? [[-0.7,0],[0.7,0],[0,-0.7],[0,0.7]] : [[0,0]];
                for(var i=0; i<o.length; i++){
                    ctx.save(); ctx.translate(P.x, P.barY); ctx.rotate(Math.sin(t*0.02)*0.05); ctx.scale(S, S); ctx.translate(o[i][0], o[i][1]);
                    ctx.drawImage(bs, ba[0], ba[1], ba[2], ba[3]);
                    ctx.restore();
                    ctx.save(); ctx.translate(P.x, P.y); ctx.scale(S, S); ctx.translate(o[i][0], o[i][1]);
                    ctx.drawImage(hs, ha[0], ha[1], ha[2], ha[3]);
                    ctx.restore();
                }
            };
            layer("#b0182a");
            layer(null);
        }else{
            ctx.fillStyle = "#0c0508"; ctx.fillRect(P.x - 120, P.barY - 8, 240, 16);
        }
        ctx.restore();
    },
    //糸(傀儡師より手前)：影の操り板から傀儡師の頭と両手へ。切れると上へ跳ね上がる。上からの声
    drawTwistFront:function(){
        var T = this.twist, b = this.alive();
        if(!T) return;
        this.drawTwistHand();
        var P = this.twistPose(), S = P.S, ends = [[P.x - 22*S, P.barY], [P.x, P.barY + 12*S], [P.x + 22*S, P.barY]];
        ctx.save();
        ctx.lineCap = "round";
        for(var i=0; i<3; i++){
            var e = ends[i], tx, ty;
            if(T.cut < 0 && b){
                if(i == 1){ tx = b.x; ty = b.y - 22*PUP_SCALE; }
                else{ var h = this.handAt(b, i == 0 ? 0 : 1); tx = h.x; ty = h.y; }
                var k = this.twistK();
                tx = e[0] + (tx - e[0])*k; ty = e[1] + (ty - e[1])*k;
            }else{
                //切れた糸：上の端から短く垂れて、跳ね上がる
                var c = Math.max(0, T.cut);
                tx = e[0] + Math.sin(c*0.2 + i)*20; ty = e[1] + Math.max(10, 120 - c*3);
            }
            ctx.strokeStyle = "rgba(255,60,70," + (0.25*P.a) + ")"; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(tx, ty); ctx.stroke();
            ctx.strokeStyle = "rgba(255,200,200," + (0.9*P.a) + ")"; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(tx, ty); ctx.stroke();
        }
        ctx.restore();
    },
    //明かすムービー(いちばん手前。表示より上)：上下の黒い帯と、下の帯に大きなせりふ(上の闇の声は赤、傀儡師は紫)
    drawCine:function(){
        var T = this.twist;
        if(!T || T.cut >= 0 || T.t >= PUP_TWIST.cine + 20) return;
        var C = PUP_TWIST.cine, k = Math.min(1, T.t/12, (C + 20 - T.t)/20), H = PUP_TWIST.bar*k;
        ctx.save();
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, CW, H); ctx.fillRect(0, CH - H, CW, H);
        var L = PUP_TWIST.lines;
        for(var i=0; i<L.length; i++){
            var dt = T.t - L[i][0];
            if(dt < 0 || dt > L[i][1]) continue;
            var voice = L[i][2] == "voice";
            ctx.globalAlpha = Math.min(1, dt/10, (L[i][1] - dt)/10);
            ctx.font = "700 26px " + (typeof STAGE_FONT == "string" ? STAGE_FONT : "serif");
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            //上の闇の声は、ふるえる赤い文字
            var jx = voice ? Math.sin(T.t*1.7)*1.2 : 0;
            ctx.fillStyle = voice ? "rgb(255,70,80)" : "rgb(205,170,255)";
            ctx.fillText(L[i][3], CW/2 + jx, CH - PUP_TWIST.bar/2);
            ctx.font = "700 13px " + (typeof STAGE_FONT == "string" ? STAGE_FONT : "serif");
            ctx.fillStyle = voice ? "rgba(255,120,120,0.8)" : "rgba(205,170,255,0.8)";
            ctx.fillText(voice ? "──上の闇から" : "傀儡師", CW/2, PUP_TWIST.bar/2);
        }
        ctx.restore();
    },

    //一斉反撃の始まり：上下の黒い帯と「みんな、いくぞ！」(画面の座標。いちばん手前)
    drawFront:function(){
        this.drawCine();
        var R = this.rally;
        if(!R || R.t > PUP_RALLY_CUT + 20) return;
        var k = R.t < 10 ? R.t/10 : R.t > PUP_RALLY_CUT ? 1 - (R.t - PUP_RALLY_CUT)/20 : 1;
        var bar = 60*k;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(0, 0, CW, bar); ctx.fillRect(0, CH - bar, CW, bar);
        ctx.globalAlpha = k;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "bold 34px sans-serif";
        var x = CW/2 + (1 - Math.min(1, R.t/14))*-200;
        ctx.lineWidth = 6; ctx.strokeStyle = "rgba(10,40,80,0.9)";
        ctx.strokeText("みんな、いくぞ！", x, CH - 30);
        ctx.fillStyle = "rgb(140,215,255)";
        ctx.fillText("みんな、いくぞ！", x, CH - 30);
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.fillText("一斉反撃", CW/2, 30);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    }
};

//------------------------------------------------------------------------------
//  ほかのファイルの処理を包んで、傀儡師を足す
//------------------------------------------------------------------------------
(function(){
    var btf0 = bossTypeFor;
    bossTypeFor = function(_w){
        if(bossDebug.puppeteer) return "puppeteer";     //ボスの試作：傀儡師(デバッグのメニューから)
        return btf0.apply(this, arguments);
    };
    var makeBoss0 = makeBoss;
    makeBoss = function(_type){
        var b = makeBoss0(_type);
        if(_type == "puppeteer") puppeteer.init(b);
        return b;
    };
    var landY0 = special.landY;
    special.landY = function(_e){
        if(_e.type == "puppeteer") return PUP_LAND_Y;
        return landY0.apply(this, arguments);
    };
    var update0 = special.update;
    special.update = function(_e,_dx,_dy,_d){
        //幕間(緞帳が下りている間。puppetStage.js が hold を決める)は、傀儡師も人形も止まる
        if(puppeteer.hold > 0 && (_e.type == "puppeteer" || _e.type == "puppet")){
            if(_e.type == "puppeteer"){ _e.vx = _e.vy = 0; puppeteer.pose(_e); }
            else _e.vx = _e.vy = 0;
            return true;
        }
        if(_e.type == "puppeteer"){ puppeteer.update(_e); return true; }
        if(_e.type == "puppet"){ puppeteer.puppet(_e); return true; }
        return update0.apply(this, arguments);
    };
    var draw0 = special.draw;
    special.draw = function(_e,_body){
        if(_e.type == "puppeteer"){ puppeteer.art(_e,_body); return true; }
        if(_e.type == "puppet"){ puppeteer.drawPuppet(_e,_body); return true; }
        return draw0.apply(this, arguments);
    };
    var attack0 = special.drawAttack;
    special.drawAttack = function(_e){
        if(_e.type == "puppeteer"){ puppeteer.drawAttack(_e); return; }
        return attack0.apply(this, arguments);
    };
    //人形の糸が切れたら倒れずに解放される。傀儡師は一斉反撃のほかでは倒れない
    var revive0 = special.revive;
    special.revive = function(_e){
        if(_e.type == "puppet"){ puppeteer.free(_e,false); return true; }
        if(_e.type == "puppeteer" && !puppeteer.finishing){ _e.hp = Math.max(1, _e.maxHp*PUP_FLOOR); return true; }
        return revive0.apply(this, arguments);
    };
    var hit0 = mainScreen.hitEnemy;
    mainScreen.hitEnemy = function(_e,_dmg,_src){
        var r = hit0.apply(this, arguments);
        if(_e.type == "puppeteer" && !_e.dead && !puppeteer.finishing && _e.hp < _e.maxHp*PUP_FLOOR) _e.hp = _e.maxHp*PUP_FLOOR;
        if(_e.type == "puppeteer" && !_e.phased && _e.squashV < 0.1) _e.squashV += PUP_SQUASH[0];     //撃たれるとつぶれる
        return r;
    };
    //ドローン君が被弾したら、傀儡師が高笑いする
    var damage0 = mainScreen.damage;
    mainScreen.damage = function(){
        var hp0 = this.hp, r = damage0.apply(this, arguments);
        var b = puppeteer.alive();
        if(b && this.hp < hp0 && b.mode != "rallied"){ b.laugh = PUP_LAUGH_T; }
        return r;
    };
    //一斉反撃の間は、ドローン君の装備はビームに任せて撃たない
    var hold0 = special.holdFire;
    special.holdFire = function(){
        if(puppeteer.rally && puppeteer.rally.t < PUP_RALLY_CUT + PUP_RALLY_FIRE) return true;
        if(puppeteer.cine()) return true;       //明かすムービーの間も撃たない
        return hold0.apply(this, arguments);
    };
    //明かすムービーの間は、上の表示とボスの体力を隠す(黒い帯とせりふだけ)
    var hud0 = mainScreen.drawHud;
    mainScreen.drawHud = function(){
        if(puppeteer.cine()) return;
        return hud0.apply(this, arguments);
    };
    var bar0 = special.drawBossBar;
    special.drawBossBar = function(){
        if(puppeteer.cine()) return;
        return bar0.apply(this, arguments);
    };
    //最後のあがきの間の衝撃波は、一斉反撃の合図(やる気を使わない)
    var blast0 = mainScreen.blast;
    mainScreen.blast = function(){
        if(puppeteer.ready){ puppeteer.startRally(); return; }
        return blast0.apply(this, arguments);
    };
    //投げつけてくる人形は、ジャスト衝撃波で糸ごと断ち切る
    var canCounter0 = mainScreen.canCounter;
    mainScreen.canCounter = function(_e){
        if(_e.type == "puppet") return !_e.dead && _e.mode == "throw";
        return canCounter0.apply(this, arguments);
    };
    var counter0 = mainScreen.counter;
    mainScreen.counter = function(_e){
        if(_e.type == "puppet"){ puppeteer.free(_e,true); return; }
        return counter0.apply(this, arguments);
    };
    var kill0 = special.onKill;
    special.onKill = function(_e){
        var r = kill0.apply(this, arguments);
        if(_e.type == "puppeteer") puppeteer.onKill(_e);
        return r;
    };
    //味方は敵と同じ時の流れで動く(衝撃波のスローモーション・ジャストの見切りで一緒にゆっくりになる)
    var enemies0 = mainScreen.updateEnemies;
    mainScreen.updateEnemies = function(){
        var r = enemies0.apply(this, arguments);
        puppeteer.stepAllies();
        return r;
    };
    var enter0 = mainScreen.enter;
    mainScreen.enter = function(){
        puppeteer.reset();
        var r = enter0.apply(this, arguments);
        if(isBossWave(game.wave) && bossTypeFor(game.wave) == "puppeteer") this.toSpawn = 0;    //雑魚敵は出さない(人形と傀儡師だけ)
        return r;
    };
    //味方は敵・装備より手前、ライバルの登場の演出(このボスでは出ない)の前に描く
    var intro0 = rival.drawIntro;
    rival.drawIntro = function(){
        puppeteer.drawOver();
        return intro0.apply(this, arguments);
    };
    var front0 = shotLab.drawFront;
    shotLab.drawFront = function(){
        var r = front0.apply(this, arguments);
        puppeteer.drawFront();
        return r;
    };
})();
