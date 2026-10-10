//------------------------------------------------------------------------------
//  調整用パラメータ(単位：px, フレーム)
//------------------------------------------------------------------------------
const INVINCIBLE_TIME = 75;     //被弾後の無敵時間
const SHOT_SPEED      = 10;     //ドローンの弾の速さ
//やる気ゲージ：衝撃波に使う。YARUKI_COST 以上あれば出せる(満タンでなくてよい)
//動く・かする・ジャストを決める・敵が落とす「やる気」を拾うとたまる。止まっているとたまらない
const YARUKI_MAX      = 100;    //やる気の上限
const YARUKI_COST     = 40;     //衝撃波1回で使うやる気
const YARUKI_PER_PX   = 0.02;   //移動1pxあたりにたまる量
const YARUKI_STEP     = 30;     //1フレームに数える移動の上限(px。ワープなどで一気にたまらないように)
const YARUKI_GRAZE    = 1.5;    //かすり1回でたまる量
const YARUKI_PICKUP   = 40;     //敵が落とす「やる気」1つでたまる量
const YARUKI_DROP_RATE = 0.12;  //敵が「やる気」を落とす確率
const MOVE_MIN        = 1.0;    //1フレームにこれより小さい動きは「止まっている」とみなす(狙いのぶれで漂う分を、やる気に数えない)
const BLAST_RADIUS    = 150;    //衝撃波の届く範囲(弾を消し、敵にダメージを与える範囲)
const BLAST_GUARD     = 30;     //衝撃波を出してから無敵の時間
const BLAST_SLOWMO    = 14;     //衝撃波を出した直後、周りがゆっくりになる時間
const BLAST_DMG       = 4;      //衝撃波が範囲内の敵に与えるダメージ(実弾1発は1)
const BLAST_PUSH      = 9;      //衝撃波で敵をはじき飛ばす速さ
const MAGNET_RANGE    = 75;     //アイテムを吸い寄せる距離
const PICKUP_LIFE     = 600;    //アイテムが消えるまでの時間
const HIT_CORE        = 6;      //敵の弾に対するドローンの当たり判定(中心の小さな点)
const GRAZE_RANGE     = 33;     //弾がこの距離までかすめると「かすり」
const GRAZE_FLASH_TIME = 10;    //かすった瞬間、かすりの範囲の輪が光る時間
//かすりコンボ：続けてかすると回数が積み上がり、装備・衝撃波の威力が上がる。被弾するか、しばらくかすらないと途切れる
const COMBO_TIME      = 360;    //最後のかすりから、この時間(フレーム)かすらないと途切れる
const COMBO_CD        = 12;    //コンボが1つ増えてから、次に増えるまでの待ち時間(フレーム)。弾が濃い場所で一気に増えすぎないように
                                //(待ちの間のかすりも、やる気・点数・途切れるまでの時間は戻る)。×SKILL_EVERY が SKILL_GUARD より長いこと
const COMBO_POWER     = 0.02;   //コンボ1つあたりの威力の上がり方(0.02で+2%)
const COMBO_MAX       = 25;     //威力が上がるのはこのコンボまで(25で+50%)
const COMBO_TIERS     = [5, 15, 25];    //段階が上がるコンボ数(届くと演出が出て、色が変わる)
const COMBO_COLORS    = ["80,160,255", "60,210,230", "255,190,40", "255,70,120"];   //段階ごとの色(0:段階なし)
//かすりバースト(強スキル)：かすりコンボがこの数に届くたびに、金色の星を周りに放ち、画面中の敵へ追いかけさせる
const SKILL_EVERY     = 5;      //このコンボごとに発動(5・10・15…)
const SKILL_SHOTS_BASE = 8;     //放つ星の数(賢さLv1。画面の敵に順に割りふる)
const SKILL_SHOTS_PER = 3;      //賢さが1つ上がるごとに増える星の数(Lv1から8・11・14・17・20)
const SKILL_SHOTS_MAX = 20;     //星の数の上限
const SKILL_DMG       = 1;      //星1つのダメージ(決まった値。強化弾頭・かすりコンボの倍率はかけない)
const SKILL_SPEED     = 9;      //星の速さ
const SKILL_DELAY     = 10;     //放ってから、敵へ曲がり始めるまでの時間(はじめは外へ広がる)
const SKILL_TURN      = 0.22;   //敵へ曲がる強さ(1フレームのラジアン)
const SKILL_GUARD     = 10;     //発動したあとの無敵の時間(演出のいちばん強い瞬間だけ守る。長いと無敵中のかすりで次のバーストへつながる)
const SKILL_COLOR     = "255,200,60";
//ジャスト衝撃波：弾が当たる直前に衝撃波を出すと、周りの弾を敵へはね返し、時間がゆっくりになる
const JUST_FRAMES     = 12;     //この時間(フレーム)のうちに当たる弾があれば「ジャスト」
const JUST_MARGIN     = 4;      //当たるかどうかの見込みに足す余裕(px)
const JUST_YARUKI     = 30;     //成功したときたまるやる気(衝撃波は YARUKI_COST 使う)
const JUST_DMG        = 3;      //はね返した弾1発のダメージ(実弾は1)
const JUST_PIERCE     = 1;      //はね返した弾が貫く敵の数
const JUST_MAX        = 24;     //はね返す弾の数の上限(残りは今までどおり消す)
const JUST_SPEED      = 1.2;    //はね返した弾の速さ(実弾 SHOT_SPEED の何倍か)
const JUST_TURN       = 0.18;   //はね返した弾が狙った敵へ曲がる強さ(1フレームのラジアン)
const JUST_SLOW_TIME  = 130;    //成功したあと、画面のすべてがゆっくりになる時間(実際のフレーム)
const JUST_SLOW_RATE  = 0.2;    //いちばんゆっくりのときの速さ(1で元どおり)
const JUST_SLOW_HOLD  = 0.5;    //ゆっくりの時間のうち、いちばんゆっくりのまま保つ割合(残りでだんだん元の速さへ戻る)
const JUST_SLOW_ZOOM  = 0.06;   //ゆっくりの間、ドローン君へ寄る大きさ(1割で0.1)
//ゆっくりの間の演出の濃さ。戦闘画面の方眼ありは、新しい背景(battleBg.js)の演出が見えるよう弱め、
//方眼なし(公開版と同じ背景)は元のまま。mainScreen.justFx() で選ぶ
//  echo：残像の濃さ(前のコマを重ねる)　blur：ドローン君から外へ流れるぶれの濃さ　veil：画面の周りを暗く青くする濃さ
//  wash：画面全体に重ねる水色の濃さ　tint：ジャストの瞬間に画面を水色にする時間(フレーム)
//  realTime：閃光・画面の色を実際の時間で消すか(ゆっくりの時間で数えると長く残り、画面が白っぽくかすむ)
const JUST_FX = {
    bg:     { echo:0.35, blur:0.07, veil:0.3, wash:0.03, tint:12, realTime:true },
    classic:{ echo:0.6,  blur:0.16, veil:0.6, wash:0.1,  tint:30, realTime:false }
};
const JUST_GUARD      = 50;     //成功したあとの無敵の時間(ふつうは BLAST_GUARD)
const JUST_TEXT_TIME  = 90;     //「JUST!」の文字を出しておく時間(実際のフレーム)
//ジャストの段階：ぎりぎりで合わせると PERFECT(見返りは上のとおり)、少し早いと JUST(見返りが小さい)
const JUST_PERFECT    = 6;      //弾がこの時間(フレーム)のうちに当たるなら PERFECT
const JUST_RAM_PERFECT = 9;     //突進・人間のドローンの PERFECT
const JUST_GOOD = { slow:0.45, max:8, yaruki:10, guard:36 };   //JUST の見返り(ゆっくりの長さの割合・はね返す数・たまるやる気・無敵の時間)
const JUST_COOP_SLOW  = 40;     //協力プレイで、敵と弾がゆっくりになる時間(ふたりの画面で同じ。ふつうの衝撃波は BLAST_SLOWMO)
const JUST_COLOR      = "90,220,255";
//ジャスト・カウンター：体当たりしてくる敵がぶつかる直前に衝撃波を出すとジャストになり、その敵を敵の群れへ弾き返す
const COUNTER_TYPES   = ["dasher","mdrone","queen"];    //弾き返せる敵(突進・人間のドローン・女王蜂の突進)
const COUNTER_SPEED   = 11;     //弾き返した突進の速さ(突進そのものは5)
const COUNTER_TURN    = 0.08;   //狙った敵へ曲がる強さ(1フレームのラジアン)
const COUNTER_RANGE   = 700;    //狙う敵を探す距離(いなければ来た向きへ返す)
const COUNTER_DMG     = 8;      //通り道の敵1体に与えるダメージ(実弾1発は1。強化弾頭・かすりコンボの倍率もかかる)
const COUNTER_LIFE    = 80;     //弾き返してから、突進が砕けるまでの時間(画面の端に着いても砕ける)
//突進の予備動作(パリィの試作)：構え方とテンポを突進ごとに変え、ジャストを「見て合わせる」ものにする
//弾の速さと距離だけでタイミングが決まらないよう、近くまでにじり寄ってから、ばらばらの間で飛び出す
var   JUST_SHOTS      = true;   //ふつうの弾でもジャストになるか(false で突進・人間のドローンだけ)
const JUST_RAM_FRAMES = 20;     //突進・人間のドローンは、この時間(フレーム)のうちにぶつかるならジャスト(弾は JUST_FRAMES)
const TELL_BRACE      = false;  //構えている突進は衝撃波に耐えるか(早押しの罰。試作では重すぎたので切る)
const TELL = { dash:0, aim:1, creep:2, lock:3, feint:4, brake:5 };     //突進の状態(e.tell)
const TELL_AIM        = [40,80];    //画面の端で狙う時間(フレーム。この間でばらつく)
const TELL_CREEP      = 0.35;       //にじり寄る速さ(突進の速さの何倍か)
const TELL_NEAR       = [110,190];  //ドローン君にこの距離まで近づいたら構える(px)
const TELL_LOCK       = [12,30];    //構えて(向きを固めて)から炎が伸び始めるまでの時間。ここがテンポのばらつき
const TELL_FLAME      = 20;         //飛び出す直前、噴射の炎が伸びて音が鳴る時間(本物の合図。フェイントでは伸びない)
const TELL_BURST      = 1.8;        //飛び出す速さ(突進の速さの何倍か)
const TELL_BURST_T    = 34;         //連続突進で、飛び出してから止まるまでの時間
const TELL_BRAKE_T    = 14;         //連続突進で、止まって振り向く時間
const TELL_FEINT_T    = [18,40];    //フェイントで身を引いてから、また構えるまでの時間
const TELL_CHAIN      = 3;          //連続突進の回数
const TELL_CHAIN_LOCK = [10,24];    //連続突進の2回目からの構えの時間(だんだん読みにくく)
const TELL_STAGGER    = 26;         //連続突進を途中で弾いたとき、はじかれてよろける時間
const TELL_CHAIN_DMG  = 2.5;        //連続突進を全部弾き返したときのダメージの倍率(COUNTER_DMG に掛ける)
//構え方の出やすさ(WAVEごと)。basic：今までの突進 creep：にじり寄ってため feint：フェイントあり chain：連続突進
function pickDashStyle(_w){
    var list = [["basic",3],["creep",4]];
    if(_w >= 4) list.push(["feint",2]);
    if(_w >= 7) list.push(["chain",1.5 + _w*0.05]);
    var sum = 0;
    for(var i=0; i<list.length; i++) sum += list[i][1];
    var r = Math.random()*sum;
    for(var i=0; i<list.length; i++){ r -= list[i][1]; if(r < 0) return list[i][0]; }
    return "basic";
}
function randIn(_range){ return _range[0] + Math.floor(Math.random()*(_range[1] - _range[0] + 1)); }
//敵を倒したときの爆発(killBlast)
const KILL_FX_MIN     = 0.8;    //爆発の大きさの倍率の下限(敵の半径/12 をこの範囲に収める)
const KILL_FX_MAX     = 2.2;
const KILL_FX_SHAKE   = 1.5;    //この倍率以上(戦車など大きい敵)は画面を揺らす
const KILL_FX_BUSY    = 450;    //演出の数がこれを超えていたら、軽い爆発にする
//ボスの登場
const BOSS_INTRO_TIME = 200;    //ボスの名前を出しておく時間(上下の黒い帯もこの間)
const BOSS_DESCENT_TIME = 110;  //「ゴゴゴ」：ゆっくり降りてくる時間
const BOSS_HUSH_TIME = 12;      //「ッ」：揺れも音も止まる溜め
const BOSS_SLAM_TIME = 5;       //一気に落ちる時間
const BOSS_HOVER_Y = 95;        //ゆっくり降りてきて止まる高さ(ここから着地点160へ落ちる)
const BOSS_HITSTOP = 9;         //「ドンっ」：着地の瞬間に画面ごと止める時間
const DON_TIME = 55;            //「ドンッ!!」の文字を出しておく時間
const ZOOM_TIME = 18;           //着地の瞬間のズーム
const FLASH_TIME = 12;          //着地の瞬間の白い閃光
const DRONE_IN_TIME = 24;       //ボス戦で、着地のあとドローン君が現れるまでの時間
//ドローン君改の登場(鼓動 → 影が浮かぶ → 始動 → 開幕)
const KAI_HEART_TIME = 280;     //鼓動の時間(WARNINGの代わり)
const KAI_BEAT_EVERY = 66;      //鼓動の間隔(ゆっくり)
const KAI_APPEAR_TIME = 60;     //暗闇に影が浮かび上がる時間
const KAI_BOOT_TIME = 96;       //始動音が高まる時間(sound.js の KAI_BOOT_LEN と同じ長さ)
const KAI_DARK_OUT = 30;        //開幕のあと暗闇が晴れる時間
var KAI_RELAY_FRAMES = KAI_RELAYS.map(function(s){ return Math.round(s*60); });   //リレーが入るフレーム(始動の始まりから)

//敵の種類
const ENEMY_TYPES = {
    bug:     { r:11, hp:1, speed:1.3, score:10, parts:1 },   //ふらふら近づいてくる
    dasher:  { r:10, hp:1, speed:5.0, score:15, parts:1 },   //狙いを定めて一直線に突っ込んでくる
    shooter: { r:14, hp:2, speed:1.2, score:30, parts:2 },   //離れたところから扇状に弾を撃つ
    tank:    { r:20, hp:5, speed:0.6, score:50, parts:3 },   //遅いが硬い。大きな弾の輪を撃つ
    spinner: { r:15, hp:3, speed:1.1, score:40, parts:2 },   //止まって渦巻き状に弾をばらまく
    bomber:  { r:13, hp:2, speed:1.0, score:35, parts:2 }    //近づくと自爆して弾の輪をまき散らす
};

//敵の弾の種類(r:大きさ・当たり判定)
const SHOT_KINDS = {
    normal: { r:5 },    //赤
    small:  { r:3.5 },  //オレンジ・速め
    big:    { r:8 },    //紫・遅め
    water:  { r:4 },    //水色(ドローン君改の水鉄砲)
    missile:{ r:5 },    //追尾ミサイル(ドローン君改)
    dragon: { r:9 }     //追尾する黒い龍(ドローン君改)
};

//撃ち返し：虫・突進は倒れるときにプレイヤーへ弾を撃ち返す(止まったままでは勝てないように。序盤から)
const REVENGE_FROM    = 1;      //撃ち返しが始まるWAVE
const REVENGE_RATE    = 0.45;   //撃ち返す確率(REVENGE_FROM のWAVE)
const REVENGE_RATE_UP = 0.08;   //WAVEが1つ進むごとに増える確率
//敵が出てくる間隔(フレーム)：SPAWN_FIRST - WAVE×SPAWN_STEP。SPAWN_MIN より短くはしない(実際はこの0.6～1.4倍でばらつく)
//虫も、ときどきプレイヤーを狙って1発撃つ(序盤の敵のほとんどが虫なので、止まっていると当たるように)
const BUG_SHOT_FIRST  = [45,100];   //画面に入ってから最初に撃つまで(フレーム。この間でばらつく)
const BUG_SHOT_EVERY  = [150,230];  //2発目からの間隔
const BUG_SHOT_SPEED  = 2.3;        //弾の速さ(danmaku() を掛ける)
const SPAWN_FIRST     = 62;
const SPAWN_STEP      = 4;
const SPAWN_MIN       = 22;
//敵の強さの伸び方(WAVEごと)。何周もして強くなる前提なので、伸びは大きめ
const DANMAKU_GROW    = 0.09;   //弾の速さ・数がWAVE1つごとに増える割合
const DANMAKU_MAX     = 2.1;    //弾の速さ・数の倍率の上限(難易度の倍率を掛ける前)
const ENEMY_HP_GROW   = 0.25;   //敵の体力がWAVE1つごとに増える割合
//パーツ：敵が落とす数(ENEMY_TYPES の parts)にこれと難易度の倍率を掛ける(端数は確率で1つ)
const PARTS_DROP_MUL  = 0.5;
const PARTS_REWARD    = 5;      //報酬カードの「パーツ」でもらえる数(難易度の倍率を掛ける)
//落とすパーツの数(_n：もとの数)
function partsDrop(_n){
    var x = _n*PARTS_DROP_MUL*difficulty().parts;
    return Math.floor(x) + (Math.random() < x - Math.floor(x) ? 1 : 0);
}
//WAVEが進むほど弾が速く、多くなる(1.0～DANMAKU_MAX 倍。難易度の倍率も掛ける)
function danmaku(){
    return Math.min(DANMAKU_MAX, 1 + (game.wave - 1)*DANMAKU_GROW)*difficulty().shot;
}

//敵の弾を撃つ
function fireShot(_x,_y,_angle,_speed,_kind){
    var k = _kind || "normal";
    enemyShots.push({ x:_x, y:_y, vx:Math.cos(_angle)*_speed, vy:Math.sin(_angle)*_speed,
                      r:SHOT_KINDS[k].r, kind:k, grazed:false });
}
//_n発を等間隔の輪にして撃つ
function fireRing(_x,_y,_n,_speed,_offset,_kind){
    for(var i=0; i<_n; i++) fireShot(_x,_y,_offset + i*Math.PI*2/_n,_speed,_kind);
}
//_angleを中心に_n発を扇状に撃つ
function fireFan(_x,_y,_angle,_n,_spread,_speed,_kind){
    for(var i=0; i<_n; i++) fireShot(_x,_y,_angle + (i - (_n-1)/2)*_spread,_speed,_kind);
}

var enemies = [];
var enemyShots = [];    //敵の弾(ドローンの攻撃はequipment.jsのarms)
var pickups = [];       //パーツ・やる気・報酬カプセル
var effects = [];       //破片・衝撃波の輪
var popups = [];        //「+10」などの文字

//------------------------------------------------------------------------------
//  敵の生成
//------------------------------------------------------------------------------
//WAVEが進むほど強い敵が混ざる
function pickEnemyType(){
    var w = game.wave;
    //真実に気付いたあとは人間との戦い
    if(w > REVEAL_WAVE) return forces.pickHuman(w);
    var list = [["bug",10]];
    list.push(["dasher",2 + w]);         //WAVE1から(止まっていると突っ込まれる)
    list.push(["shooter",1.5 + w*0.8]);  //WAVE1から(狙って撃つ)
    if(w >= 3) list.push(["spinner",1 + w*0.5]);
    if(w >= 4) list.push(["tank",1 + w*0.5]);
    if(w >= 5) list.push(["bomber",1 + w*0.4]);
    var sum = 0;
    for(var i=0; i<list.length; i++) sum += list[i][1];
    var r = Math.random() * sum;
    for(var i=0; i<list.length; i++){
        r -= list[i][1];
        if(r < 0) return list[i][0];
    }
    return "bug";
}

function makeEnemy(_type){
    var T = ENEMY_TYPES[_type];
    //WAVEが進むほど硬くなる
    //(協力プレイでは2倍)
    var hp = Math.ceil(T.hp * (1 + (game.wave-1)*ENEMY_HP_GROW)*difficulty().hp) * coop.hpMul();
    var e = {
        id:++enemySeq,  //通し番号(協力プレイで同じ敵を指すため)
        type:_type, r:T.r, hp:hp, maxHp:hp, score:T.score, parts:T.parts,
        speed:T.speed * (1 + (game.wave-1)*0.06),
        x:0, y:0, vx:0, vy:0, flash:0, timer:0, t:Math.floor(Math.random()*100), dead:false,
        slow:0,         //EMPで遅くなっている時間
        wet:0,          //水鉄砲で濡れている時間
        bladeCd:0       //ブレードが再び当たるまでの時間
    };
    placeAtEdge(e);

    if(_type == "dasher"){
        //突進前に画面の端で狙いを定める(予告)
        e.x = Math.max(e.r+4, Math.min(e.x, CW-e.r-4));
        e.y = Math.max(e.r+4, Math.min(e.y, CH-e.r-4));
        e.style = pickDashStyle(game.wave);
        e.tell = TELL.aim;
        e.timer = randIn(TELL_AIM);
        e.near = randIn(TELL_NEAR);
        e.fake = e.style == "feint";            //次の構えがフェイントか
        e.chain = e.style == "chain" ? TELL_CHAIN - 1 : 0;   //連続突進の残りの回数
        e.parried = 0;                          //連続突進を弾いた回数
        e.aimX = 0; e.aimY = 1;
    }else if(_type == "shooter" || _type == "spinner"){
        setShooterTarget(e);
        e.timer = 60;
        e.spin = Math.random()*Math.PI*2;
        e.firing = 0;       //回転砲台が撃ち続ける残り時間
    }else if(_type == "bug"){
        e.shotT = randIn(BUG_SHOT_FIRST);
    }else if(_type == "tank"){
        e.timer = 120 + Math.floor(Math.random()*60);
    }else if(_type == "bomber"){
        e.timer = 300;      //この時間が過ぎると近くなくても自爆
        e.fuse = 0;         //自爆までの点滅時間
    }
    forces.init(e);         //同胞・人間の兵器の初期設定(forces.js)
    return e;
}

//画面の外周のどこかに置く
function placeAtEdge(_e){
    var side = Math.floor(Math.random()*4);
    var out = _e.r + 10;
    if(side == 0){ _e.x = Math.random()*CW; _e.y = -out; }
    else if(side == 1){ _e.x = CW + out; _e.y = Math.random()*CH; }
    else if(side == 2){ _e.x = Math.random()*CW; _e.y = CH + out; }
    else { _e.x = -out; _e.y = Math.random()*CH; }
}

//撃つ敵の次の移動先
function setShooterTarget(_e){
    _e.tx = 100 + Math.random()*(CW-200);
    _e.ty = 80 + Math.random()*(CH-160);
}

//------------------------------------------------------------------------------
//  演出
//------------------------------------------------------------------------------
//敵を倒したときの爆発。閃光・火の玉・衝撃波・火花・破片・煙を重ねる
//_r：敵の大きさ(大きいほど派手に)　_glow：火花の色("r,g,b"。省略時はオレンジ)
function killBlast(_x,_y,_r,_glow){
    var k = Math.max(KILL_FX_MIN, Math.min(KILL_FX_MAX, _r/12));   //大きさの倍率
    var glow = _glow || "255,170,60";
    //演出が多すぎるときは軽くする(連鎖で一度にたくさん倒したとき)
    var lite = effects.length > KILL_FX_BUSY;
    //煙(火の玉より先に入れて、奥に描く)
    if(!lite){
        for(var i=0; i<Math.round(2 + k*2); i++){
            var a = Math.random()*Math.PI*2, d = Math.random()*_r*0.6;
            var life = 40 + Math.random()*25;
            effects.push({ smoke:true, x:_x + Math.cos(a)*d, y:_y + Math.sin(a)*d,
                           vx:Math.cos(a)*0.6, vy:Math.sin(a)*0.6 - 0.5,
                           R0:5*k, R1:(16 + Math.random()*10)*k, life:life, maxLife:life, color:"80,78,76" });
        }
    }
    fx.flare(_x,_y,54*k,"255,120,30",lite ? 12 : 22);   //火の玉
    fx.flare(_x,_y,30*k,"255,248,225",10);             //中心の白い閃光
    fx.ring(_x,_y,60*k,"255,175,70",14,5);             //衝撃波
    if(!lite) fx.ring(_x,_y,88*k,"255,220,150",22,2);  //外側の薄い衝撃波
    fx.sparks(_x,_y,lite ? 4 : Math.round(10 + k*6),glow,7*k,3.5);
    burst(_x,_y,lite ? 4 : Math.round(5 + _r*0.6),"#333");   //破片
    //大きい敵は少し揺らし、低い爆発音も重ねる
    if(k >= KILL_FX_SHAKE){
        fx.shake(4);
        sound.play("explode");
    }
}

function burst(_x,_y,_n,_color){
    for(var i=0; i<_n; i++){
        var a = Math.random()*Math.PI*2, s = 1 + Math.random()*4;
        effects.push({ x:_x, y:_y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:20+Math.random()*20, maxLife:40,
                       size:2+Math.random()*3, color:_color });
    }
}

function popup(_x,_y,_text,_color,_big){
    var life = _big ? 60 : 45;
    popups.push({ x:_x, y:_y, text:_text, life:life, maxLife:life, color:_color || "#000", big:!!_big });
}

//------------------------------------------------------------------------------
//  メイン画面処理
//------------------------------------------------------------------------------
var mainScreen = {
    state:"start",      //start:WAVE開始演出  play:戦闘中  clear:WAVEクリア  over:撃墜
    stateTime:0,
    paused:false,
    toSpawn:0,          //これから出てくる敵の数
    spawnTimer:0,
    hp:0,
    maxHp:0,
    yaruki:0,           //やる気(衝撃波に使う)
    invincible:0,
    reload:0,
    shake:0,
    yarukiMsg:0,        //「やる気が足りない！」を出している残り時間
    bonus:0,
    bossWave:false,     //このWAVEにボスが出るか
    rares:0,            //このWAVEに出たレア敵の数
    rareMsg:"",
    rareMsgTime:0,
    clock:0,            //このWAVEが始まってからのフレーム数(演出の間隔に使う)
    graze:0,            //このWAVEのかすり回数
    combo:0,            //今のかすりコンボ
    comboT:0,           //コンボが途切れるまでの残り時間
    comboCd:0,          //次にコンボが増えられるまでの残り時間(COMBO_CD)
    comboBest:0,        //このWAVEのいちばん長いコンボ
    comboPop:0,         //コンボの数字がぽんと大きくなる残り時間
    comboEnd:null,      //途切れたときの表示 { n:コンボ数, t:残り時間, broke:被弾で途切れたか }
    grazeFlash:0,       //かすりの範囲の輪が光っている残り時間
    just:0,             //このWAVEのジャスト衝撃波の回数
    justT:0,            //「JUST!」の文字を出している残り時間
    justSlow:0,         //ジャスト衝撃波のあと、画面のすべてがゆっくりになっている残り時間
    slowAcc:0,          //ゆっくりの間、次の1コマを進めるまでのたまり具合
    slowPow:0,          //ゆっくりの演出の強さ(1がいちばんゆっくり、0でふつう)
    slowBack:false,     //元の速さへ戻り始めたか
    echo:null,          //ゆっくりの間の残像に使う、前のコマの絵
    justHits:0,         //最後のジャスト衝撃波ではね返した弾が当たった数
    justN:0,            //最後のジャスト衝撃波ではね返した弾の数
    justRams:[],        //ジャストになった突進(isJust が集める)
    justRamN:0,         //最後のジャスト衝撃波で弾き返した突進の数
    guard:0,            //衝撃波のあとの無敵時間(点滅しない無敵)
    slowmo:0,           //周りがゆっくりになっている残り時間
    tint:null,          //画面全体の色づけ(連鎖爆破など)

    enter:function(){
        enemies = []; enemyShots = []; pickups = []; effects = []; popups = [];
        this.down = false;      //協力プレイで倒れている(次のWAVEで復帰)
        if(coop.active){
            //WAVEごとにダメージの合計をリセット(敵の番号は通しなので混ざらない)
            coop.dmg = {}; coop.applied = {};
        }
        arms.reset();
        timeStop.reset();
        drone.applyStats();
        drone.slow = false;
        drone.X = CW/2; drone.Y = CH/2;
        //タッチはドラッグで動かすので、目標をドローン君の位置に戻しておく
        if(inputMode == "touch"){ MouseX = drone.X; MouseY = drone.Y; }
        this.maxHp = game.stat("armor");
        this.hp = this.maxHp;
        this.yaruki = YARUKI_MAX;
        this.toSpawn = 6 + game.wave*3;
        this.bossWave = isBossWave(game.wave);
        if(this.bossWave){
            //ボスWAVEは雑魚が3分の1。最終WAVEはドローン君改との一騎打ち(雑魚なし)
            this.toSpawn = game.wave >= FINAL_WAVE ? 0 : Math.floor(this.toSpawn/3);
            if(!this.isKaiWave()) sound.play("warning");   //ドローン君改は静かな鼓動から始まる
        }
        this.rares = 0;
        this.rareMsgTime = 0;
        this.spawned = 0;
        this.kinForced = false;
        this.clock = 0;
        this.graze = 0;
        this.combo = 0; this.comboT = 0; this.comboCd = 0; this.comboBest = 0; this.comboPop = 0; this.comboEnd = null; this.grazeFlash = 0;
        this.just = 0;
        this.justT = 0;
        this.justSlow = 0;
        this.slowPow = 0;
        sound.timeWarp(false);
        this.guard = 0;
        this.slowmo = 0;
        this.bossIntro = 0;
        this.bossFreeze = false;
        this.introT = 0;
        this.hitStop = 0;
        this.donT = 0;
        this.zoomT = 0;
        this.flashT = 0;
        this.droneIn = 0;
        this.beatT = 0;
        this.kaiDark = 0;
        this.tint = null;
        this.spawnTimer = 0;
        this.invincible = 0;
        this.reload = 30;
        this.shake = 0;
        this.yarukiMsg = 0;
        this.state = "start";
        this.stateTime = 0;
        battleBg.reset();
    },

    //----------------------------------------------------------------- 更新
    update:function(){
        //マウスがキャンバスの外にある間は一時停止
        //ゲストの画面はホストから届いた状態で動かす(coop.js)
        if(coop.isGuest()){ coop.guestStep(); return; }
        //協力プレイ中は一時停止しない(相方の画面は止まらないので)
        this.paused = coop.active ? false : !MouseIn;
        sound.duck(this.paused);
        if(this.paused) return;
        //ボスの着地の瞬間は、画面ごと少し止める(ヒットストップ)
        if(this.hitStop > 0){ this.hitStop--; return; }
        //時止めワープ(試作。timeStop.js)：時が止まっている間は、ワープの演出だけを進める
        if(timeStop.step()) return;
        //ジャスト衝撃波のあとは、画面のすべてをゆっくりにする(何フレームかに1回だけ進め、だんだん元の速さへ)
        if(this.justSlow > 0){
            this.justSlow--;
            if(this.justT > 0) this.justT--;    //文字は実際の時間で消す
            //閃光・画面の色も実際の時間で消す(方眼なしは公開版と同じく、ゆっくりの時間で数える。JUST_FX)
            if(this.justFx().realTime){
                if(this.flashT > 0) this.flashT--;
                if(this.tint && --this.tint.life <= 0) this.tint = null;
            }
            //はじめはいちばんゆっくりのまま保ち、そのあと元の速さへ戻していく
            var k = 1 - this.justSlow/JUST_SLOW_TIME;
            var u = Math.max(0, (k - JUST_SLOW_HOLD)/(1 - JUST_SLOW_HOLD));
            if(u > 0 && !this.slowBack){
                this.slowBack = true;
                sound.timeWarp(false);
                sound.play("slowOut");
            }
            var rate = JUST_SLOW_RATE + (1 - JUST_SLOW_RATE)*u*u;
            this.slowPow = (1 - rate)/(1 - JUST_SLOW_RATE);     //演出の強さ(1がいちばんゆっくり)
            this.slowAcc += rate;
            if(this.slowAcc < 1) return;
            this.slowAcc -= 1;
        }else{
            this.slowPow = 0;
        }
        this.stateTime++;
        this.clock++;
        if(this.tint && --this.tint.life <= 0) this.tint = null;

        //ボスの登場の演出中(WARNINGから着地まで)は、ボスと演出以外は動かない
        if(this.state != "over" && !this.cinematic()){
            drone.update();
            this.updateYaruki();
        }

        switch(this.state){
            case "start":
                //ボスWAVEはWARNINGを長めに見せてからボス登場
                if(this.bossWave) this.warningStep();
                if(this.stateTime >= (this.bossWave ? (this.isKaiWave() ? KAI_HEART_TIME : 150) : 60)){
                    this.state = "play";
                    this.stateTime = 0;
                    if(this.bossWave){
                        enemies.push(makeBoss(bossTypeFor(game.wave)));
                        this.bossArrive();
                    }
                }
                break;
            case "play":
                if(this.bossFreeze) break;   //ボスの登場の演出中は敵を出さない・衝撃波も出せない
                this.spawn();
                if(Click == 1) this.blast();
                //全部倒したらWAVEクリア
                if(this.toSpawn == 0 && enemies.length == 0){
                    this.state = "clear";
                    this.stateTime = 0;
                    this.bonus = Math.max(1, Math.round(Math.ceil(game.wave/2)*difficulty().parts));     //WAVEクリアのパーツ(難易度の倍率を掛ける)
                    game.gainParts(this.bonus);
                    sound.stopMusic();
                    sound.play("clear");
                    enemyShots = [];
                }
                break;
            case "clear":
                if(this.stateTime >= 150){
                    if(bossDebug.active){ bossDebug.finish("clear"); return; }
                    var cleared = game.wave;
                    game.wave++;
                    //報酬を選ぶ回数(補給機のカプセル・ボス撃破の分が上乗せされている)
                    game.pendingReward = (game.pendingReward || 0) + 1;
                    //最終WAVEならエンディング、それ以外はストーリーがあれば見てから強化画面へ
                    if(cleared >= FINAL_WAVE){
                        storyScreen.start("ending",function(){ page.change(5); });
                    }else{
                        goUpgrade();
                    }
                    return;
                }
                break;
            case "over":
                if(this.stateTime >= 100){
                    if(bossDebug.active){ bossDebug.finish("over"); return; }
                    page.change(3);
                    return;
                }
                break;
        }

        if(this.bossFreeze){
            this.bossEntrance();
            this.updateEffects();
            this.tickTimers();
            return;
        }

        //衝撃波の直後は、ドローン君以外が1フレームおきにしか動かない(スローモーション)
        var frozen = false;
        if(this.slowmo > 0){
            this.slowmo--;
            frozen = this.slowmo % 2 == 0;
        }
        if(!frozen){
            arms.update(this.state == "play" && !this.down);
            this.updateEnemies();
            this.updateShots();
            this.updatePickups();
        }
        this.updateEffects();
        if(this.invincible > 0) this.invincible--;
        if(this.guard > 0) this.guard--;
        timeStop.tick();    //時止めワープのクールタイム
        if(this.yarukiMsg > 0) this.yarukiMsg--;
        bossDebug.tick();
        if(this.rareMsgTime > 0) this.rareMsgTime--;
        this.tickTimers();
    },
    //演出の時間を進める(登場の演出中も止めない分)
    tickTimers:function(){
        if(this.shake > 0) this.shake--;
        this.comboStep();
        if(this.justT > 0 && !this.justSlow) this.justT--;
        if(this.bossIntro > 0) this.bossIntro--;
        if(this.donT > 0) this.donT--;
        if(this.zoomT > 0) this.zoomT--;
        if(this.flashT > 0) this.flashT--;
        if(this.droneIn > 0) this.droneIn--;
        if(this.beatT > 0) this.beatT--;
        if(this.kaiDark > 0) this.kaiDark--;
    },
    //ボスの登場の演出中か(ドローン君を動かさない)
    cinematic:function(){
        return this.bossWave && (this.state == "start" || this.bossFreeze);
    },

    //動くとやる気がたまる(止まっていると、たまりも減りもしない。その場で待つより動き回るほうが得をするように)
    updateYaruki:function(){
        if(drone.Speed >= MOVE_MIN) this.addYaruki(Math.min(drone.Speed, YARUKI_STEP)*YARUKI_PER_PX);
    },
    addYaruki:function(_n){
        this.yaruki = Math.min(YARUKI_MAX, this.yaruki + _n);
    },

    spawn:function(){
        //デバッグの武器試用：敵は尽きずに出続ける(多すぎるときは待つ。bossDebug.js)
        if(bossDebug.trial){
            this.toSpawn = 1;
            if(enemies.length >= TRIAL_MAX_ENEMIES) return;
        }
        if(this.toSpawn <= 0) return;
        this.spawnTimer--;
        if(this.spawnTimer > 0) return;
        this.spawnTimer = Math.max(SPAWN_MIN, SPAWN_FIRST - game.wave*SPAWN_STEP) * difficulty().spawn * (0.6 + Math.random()*0.8);
        this.toSpawn--;
        this.spawned++;
        //同胞が紛れ込む(WAVE3では必ず1体は出る)
        var forceKin = game.wave == 3 && !this.kinForced && this.spawned >= 4;
        if(forceKin || Math.random() < kinRate(game.wave)){
            this.kinForced = true;
            enemies.push(makeEnemy("kin"));
            return;
        }
        //まれにレア敵が出る(人間との戦いでは補給機だけ)
        if(game.wave >= 2 && this.rares < RARE_MAX && Math.random() < RARE_RATE){
            var r = makeRare(game.wave <= REVEAL_WAVE && Math.random() < 0.6 ? "goldbug" : "carrier");
            enemies.push(r);
            this.rares++;
            this.rareMsg = "レア敵「" + r.name + "」出現！" + (r.type == "goldbug" ? "　逃げる前に倒せ" : "　撃ち落とすと報酬カプセル");
            this.rareMsgTime = 150;
            sound.play("rare");
            return;
        }
        enemies.push(makeEnemy(pickEnemyType()));
    },

    //クリック：やる気を使って周りの敵をまとめて攻撃し、敵の弾を消す
    blast:function(){
        if(this.yaruki < YARUKI_COST){
            this.yarukiMsg = 60;
            sound.play("error");
            return;
        }
        this.yaruki -= YARUKI_COST;
        var just = this.isJust();
        //ピンチを切り抜けられるよう、周りの弾はすぐ消して少しのあいだ無敵に
        //ジャストのときは、消す代わりに近い順に敵へはね返す
        var near = [];
        for(var i=enemyShots.length-1; i>=0; i--){
            var d = Math.hypot(enemyShots[i].x - drone.X, enemyShots[i].y - drone.Y);
            if(d < BLAST_RADIUS){
                if(just) near.push({ s:enemyShots[i], d:d });
                enemyShots.splice(i,1);
            }
        }
        this.guard = BLAST_GUARD;
        this.slowmo = BLAST_SLOWMO;
        if(just){
            //ジャスト：はね返した弾で攻撃する(どの弾が当たったか見えるように)
            this.justBlast(near,this.justRams,this.justTier);
            coop.onBlast(drone.X,drone.Y,false);
            return;
        }
        //ふつうの衝撃波：周りの敵にまとめてダメージを与え、外へはじき飛ばす
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead || e.harmless) continue;
            var dx = e.x - drone.X, dy = e.y - drone.Y, d = Math.hypot(dx,dy) || 1;
            if(d > BLAST_RADIUS + e.r) continue;
            //構えている突進は身を固めて耐える(早押しはやる気を使うだけ。飛び出したところを合わせる)
            if(this.bracing(e)){
                if(!coop.isGuest()){ e.vx = dx/d*BLAST_PUSH*0.3; e.vy = dy/d*BLAST_PUSH*0.3; }
                fx.sparks(e.x, e.y, 6, "200,200,210", 4, 2);
                popup(e.x, e.y - e.r - 6, "ガード", "rgb(120,120,130)");
                continue;
            }
            //敵を動かしているのはホストなので、ゲストの画面でははじき飛ばさない
            if(!e.boss && !coop.isGuest()){ e.vx = dx/d*BLAST_PUSH; e.vy = dy/d*BLAST_PUSH; }
            fx.sparks(e.x, e.y, 5, "255,200,120", 5, 2.5);
            this.hitEnemy(e,BLAST_DMG,"blast");
        }
        this.blastFx(drone.X,drone.Y);
        coop.onBlast(drone.X,drone.Y,true);
    },
    //衝撃波の見た目(相方の衝撃波も同じ見た目で描く。coop.readEvents)
    blastFx:function(_x,_y,_partner){
        fx.flare(_x, _y, 60, "255,235,200", 12);
        fx.ring(_x, _y, BLAST_RADIUS, "255,170,80", 18, 8);
        fx.ring(_x, _y, BLAST_RADIUS*0.7, "255,255,255", 12, 4);
        fx.sparks(_x, _y, 18, "255,190,110", 8, 3);
        if(!_partner) fx.shake(6);    //相方の衝撃波では自分の画面を揺らさない
        battleBg.ripple(_x, _y, _partner ? 14 : 22, 7, 55, "255,150,60");
        sound.play("blast");
    },
    //ジャストのゆっくりの間の演出の濃さ(新しい背景のときは弱め、方眼が大きい・なしは公開版のまま。JUST_FX)
    justFx:function(){ return battleBg.classic() ? JUST_FX.classic : JUST_FX.bg; },
    //今出せばジャストか：このまま進むと JUST_FRAMES のうちに当たる弾か、体当たりしてくる敵(COUNTER_TYPES)があるか
    //(ドローン君は止まっているとみなし、弾と敵はまっすぐ進むとみなす)。ジャストになった敵は justRams に集める
    //段階は justTier に入れる(0：なし 1：JUST 2：PERFECT。いちばん早く当たるものがぎりぎりなら PERFECT)
    isJust:function(){
        this.justRams = [];
        this.justTier = 0;
        if(this.down) return false;
        var tier = 0;
        for(var i=0; i<enemyShots.length && JUST_SHOTS; i++){
            var b = enemyShots[i];
            var t = this.hitTime(b.x,b.y,b.vx,b.vy,(b.r || 5) + HIT_CORE);
            if(t >= 0) tier = Math.max(tier, t <= JUST_PERFECT ? 2 : 1);
        }
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(!this.canCounter(e)) continue;
            var t = this.hitTime(e.x,e.y,e.vx,e.vy,e.r + drone.R,JUST_RAM_FRAMES);
            if(t < 0) continue;
            this.justRams.push(e);
            tier = Math.max(tier, t <= JUST_RAM_PERFECT ? 2 : 1);
        }
        this.justTier = tier;
        return tier > 0;
    },
    //ジャスト・カウンターで弾き返せる敵か(突進は飛び出している間だけ。女王蜂も突進している間だけ)
    canCounter:function(_e){
        if(_e.dead || _e.countered || _e.rival || COUNTER_TYPES.indexOf(_e.type) < 0) return false;
        if(_e.type == "queen") return _e.mode == "dash";
        return !(_e.type == "dasher" && _e.tell != TELL.dash);
    },
    //構えている(衝撃波に耐える)突進か
    bracing:function(_e){
        return TELL_BRACE && _e.type == "dasher" && !_e.countered && _e.tell != TELL.dash && _e.tell != TELL.brake;
    },
    //(_x,_y)から速さ(_vx,_vy)でまっすぐ進むものが、_frames(省くと JUST_FRAMES)のうちにドローン君から _r 以内に入るか
    willHit:function(_x,_y,_vx,_vy,_r,_frames){
        return this.hitTime(_x,_y,_vx,_vy,_r,_frames) >= 0;
    },
    //同じく、当たるならあと何フレームで入るか(当たらなければ -1)
    hitTime:function(_x,_y,_vx,_vy,_r,_frames){
        var f = _frames || JUST_FRAMES, R = _r + JUST_MARGIN;
        var px = _x - drone.X, py = _y - drone.Y;
        for(var t=0; t<=f; t++){
            if(Math.hypot(px + _vx*t, py + _vy*t) < R) return t;
        }
        //1フレームの間にすり抜ける速いもの：いちばん近づく時刻で確かめる
        var vv = _vx*_vx + _vy*_vy;
        var tc = vv > 0 ? Math.max(0, Math.min(f, -(px*_vx + py*_vy)/vv)) : 0;
        return Math.hypot(px + _vx*tc, py + _vy*tc) < R ? Math.ceil(tc) : -1;
    },
    //ジャスト・カウンター：突進を弾き返す。いちばん近いほかの敵へ向かって飛び、通り道の敵にぶつかってダメージを与える
    //(敵を動かしているのはホストなので、ゲストは相方に知らせてホストの画面で弾き返す。coop.readEvents)
    counter:function(_e){
        if(coop.isGuest()){ coop.onCounter(_e); return; }
        if(_e.dead || _e.countered) return;
        if(_e.boss){ special.parry(_e); return; }     //ボス(女王蜂)は飛ばさず、弾いてよろけさせる(bosses.js)
        //連続突進の途中なら、はじいてよろけさせるだけ(次の突進が来る)。全部弾くと最後に強く弾き返す
        if(_e.type == "dasher" && _e.chain > 0){
            _e.parried++;
            _e.tell = TELL.brake; _e.timer = TELL_STAGGER;
            _e.vx = -_e.vx*0.5; _e.vy = -_e.vy*0.5;
            _e.flash = 8;
            fx.flare(_e.x, _e.y, 24, JUST_COLOR, 10);
            fx.sparks(_e.x, _e.y, 10, JUST_COLOR, 6, 3);
            popup(_e.x, _e.y - _e.r - 6, _e.parried + "/" + TELL_CHAIN, "rgb(30,150,200)");
            return;
        }
        _e.cMul = (_e.type == "dasher" && _e.style == "chain" && _e.parried >= TELL_CHAIN - 1) ? TELL_CHAIN_DMG : 1;
        if(_e.cMul > 1){
            fx.flare(_e.x, _e.y, 70, JUST_COLOR, 20);
            fx.ring(_e.x, _e.y, 90, JUST_COLOR, 24, 6);
            fx.shake(8);
            popup(_e.x, _e.y - _e.r - 14, "連続カウンター！", "rgb(30,150,200)");
        }
        var t = arms.nearest(_e.x,_e.y,COUNTER_RANGE,[_e]);
        var a = t ? Math.atan2(t.y - _e.y, t.x - _e.x) : Math.atan2(-_e.vy,-_e.vx);
        _e.countered = COUNTER_LIFE;
        _e.cTarget = t;
        _e.cHit = [];
        _e.frozen = 0;
        _e.vx = Math.cos(a)*COUNTER_SPEED; _e.vy = Math.sin(a)*COUNTER_SPEED;
        _e.aimX = Math.cos(a); _e.aimY = Math.sin(a);
        fx.flare(_e.x, _e.y, 30, JUST_COLOR, 14);
        fx.sparks(_e.x, _e.y, 12, JUST_COLOR, 8, 3);
        if(t){
            fx.line(_e.x, _e.y, t.x, t.y, JUST_COLOR, 2.5, 16);
            fx.ring(t.x, t.y, t.r + 18, JUST_COLOR, 26, 3);
        }
    },
    //突進の1フレーム(予備動作。動かすのはホストとひとり用だけ)
    //狙う → (にじり寄る) → 構えて止まる → 炎が伸びて飛び出す。フェイントは構えたあと身を引き、また構える
    updateDasher:function(_e,_dx,_dy,_d){
        var T = TELL;
        switch(_e.tell){
            case T.aim:     //画面の端で止まってドローン君の方を向く
                _e.aimX = _dx/_d; _e.aimY = _dy/_d;
                _e.vx *= 0.8; _e.vy *= 0.8;
                if(--_e.timer > 0) break;
                if(_e.style == "basic") this.dashGo(_e,1);
                else _e.tell = T.creep;
                break;
            case T.creep:   //向きを合わせながら、にじり寄る
                _e.aimX = _dx/_d; _e.aimY = _dy/_d;
                _e.vx += (_e.aimX*_e.speed*TELL_CREEP - _e.vx)*0.1;
                _e.vy += (_e.aimY*_e.speed*TELL_CREEP - _e.vy)*0.1;
                if(_d < _e.near) this.dashLock(_e,TELL_LOCK);
                break;
            case T.lock:    //向きを固めて止まる。最後の TELL_FLAME の間は炎が伸びる(フェイントは伸びずに身を引く)
                _e.vx *= 0.75; _e.vy *= 0.75;
                if(_e.timer == TELL_FLAME && !_e.fake) sound.play("tell");
                if(--_e.timer > 0) break;
                if(_e.fake){
                    _e.fake = false;
                    _e.tell = T.feint; _e.timer = randIn(TELL_FEINT_T);
                    _e.vx = -_e.aimX*_e.speed*0.7; _e.vy = -_e.aimY*_e.speed*0.7;
                }else this.dashGo(_e,TELL_BURST);
                break;
            case T.feint:   //身を引いて間をおき、また構える
                _e.aimX = _dx/_d; _e.aimY = _dy/_d;
                _e.vx *= 0.9; _e.vy *= 0.9;
                if(--_e.timer <= 0) this.dashLock(_e,TELL_LOCK);
                break;
            case T.dash:    //連続突進は少し進んだら止まる(最後の1回はそのまま画面の外へ)
                if(_e.chain > 0 && --_e.timer <= 0){ _e.tell = T.brake; _e.timer = TELL_BRAKE_T; }
                break;
            case T.brake:   //止まって振り向き、次の突進を構える(弾かれてよろけているときもここ)
                _e.aimX = _dx/_d; _e.aimY = _dy/_d;
                _e.vx *= 0.85; _e.vy *= 0.85;
                if(--_e.timer <= 0){ _e.chain--; this.dashLock(_e,TELL_CHAIN_LOCK); }
                break;
        }
    },
    dashLock:function(_e,_range){
        _e.tell = TELL.lock;
        _e.timer = randIn(_range) + TELL_FLAME;
    },
    dashGo:function(_e,_mul){
        _e.tell = TELL.dash;
        _e.timer = TELL_BURST_T;
        _e.vx = _e.aimX*_e.speed*_mul; _e.vy = _e.aimY*_e.speed*_mul;
        sound.play("dash");
    },
    //弾き返した突進の1フレーム(updateEnemies から。動かすのはホストとひとり用だけ)
    updateCounter:function(_e){
        //狙った敵へ少しずつ曲がる(倒れていたら、そのまままっすぐ)
        var t = _e.cTarget;
        if(t && !t.dead){
            var a = turnTo(Math.atan2(_e.vy,_e.vx), Math.atan2(t.y - _e.y, t.x - _e.x), COUNTER_TURN);
            _e.vx = Math.cos(a)*COUNTER_SPEED; _e.vy = Math.sin(a)*COUNTER_SPEED;
        }
        //通り道の敵に1体1回ずつぶつかる
        for(var i=0; i<enemies.length; i++){
            var o = enemies[i];
            if(o == _e || o.dead || _e.cHit.indexOf(o) >= 0) continue;
            if(Math.hypot(o.x - _e.x, o.y - _e.y) > o.r + _e.r) continue;
            _e.cHit.push(o);
            this.justHits++;
            fx.flare(o.x, o.y, 34, JUST_COLOR, 12);
            fx.flare(o.x, o.y, 12, "255,255,255", 8);
            fx.sparks(o.x, o.y, 10, JUST_COLOR, 7, 3);
            fx.shake(4);
            var cd = COUNTER_DMG*(_e.cMul || 1);
            popup(o.x, o.y - o.r - 6, "-" + Math.round(cd*this.comboMul()), "rgb(30,150,200)");
            sound.play("justHit");
            battleBg.ripple(o.x, o.y, 12, 6, 35, BG_JUST_COLOR);
            //ぶつかった雑魚敵は進む向きへ押しのける
            if(!o.boss){ o.vx += _e.vx*0.5; o.vy += _e.vy*0.5; }
            this.hitEnemy(o,cd,"counter");
        }
        //時間切れか画面の端で砕ける(倒した扱い。スコアとパーツを落とす)
        if(--_e.countered <= 0 || _e.x < _e.r || _e.x > CW - _e.r || _e.y < _e.r || _e.y > CH - _e.r){
            _e.x = Math.max(_e.r, Math.min(CW - _e.r, _e.x));
            _e.y = Math.max(_e.r, Math.min(CH - _e.r, _e.y));
            _e.countered = 1;   //倒しきれなかったときのため、砕けるまで弾き返したままにする
            this.hitEnemy(_e, Math.max(_e.hp, 1), "counter");
        }
    },
    //ジャスト成功：弾をはね返し、突進を弾き返し、やる気をため、スローモーション・閃光・音で手ごたえを出す
    //_tier：1 は JUST(見返りが小さい)、2 か省くと PERFECT
    justBlast:function(_near,_rams,_tier){
        var good = _tier == 1;
        this.justPerfect = !good;
        this.justYaruki = good ? JUST_GOOD.yaruki : JUST_YARUKI;
        _rams = _rams || [];
        this.justHits = 0;
        battleBg.ripple(drone.X, drone.Y, 36, 9, 75, BG_JUST_COLOR);
        battleBg.justSpread(drone.X, drone.Y, BG_JUST_COLOR);
        for(var i=0; i<_rams.length; i++) this.counter(_rams[i]);
        this.justRamN = _rams.length;
        _near.sort(function(a,b){ return a.d - b.d; });
        var n = Math.min(good ? JUST_GOOD.max : JUST_MAX, _near.length);
        var marked = [];
        for(var i=0; i<n; i++){
            var s = _near[i].s;
            //いちばん近い敵を追いかける。敵がいなければ来た向きへ返す
            var t = arms.nearest(s.x,s.y,600);
            var a = t ? Math.atan2(t.y - s.y, t.x - s.x) : Math.atan2(-s.vy,-s.vx);
            var sp = SHOT_SPEED*JUST_SPEED;
            arms.bullets.push({ x:s.x, y:s.y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:90,
                                pierce:JUST_PIERCE, hit:[], just:true, dmg:JUST_DMG, target:t });
            fx.flare(s.x, s.y, 14, JUST_COLOR, 12);
            //狙う敵へ光の線を引き、照準の輪を付ける(はね返った弾の行き先が分かるように)
            if(t){
                fx.line(s.x, s.y, t.x, t.y, JUST_COLOR, 1.5, 14);
                if(marked.indexOf(t) < 0){
                    marked.push(t);
                    fx.ring(t.x, t.y, t.r + 16, JUST_COLOR, 26, 3);
                }
            }
        }
        this.just++;
        this.addYaruki(this.justYaruki);
        this.guard = good ? JUST_GOOD.guard : JUST_GUARD;
        //ひとり用は画面のすべてをゆっくりにする。協力プレイは画面のずれを防ぐため、敵と弾だけをゆっくりにする
        //(敵と弾を動かしているのはホスト。ゲストのジャストは相方に知らせ、ホストがゆっくりにする。coop.readEvents)
        if(coop.active){
            this.slowmo = JUST_COOP_SLOW;
            coop.onJust(drone.X,drone.Y);
        }else{
            this.slowmo = 0;
            this.justSlow = good ? Math.round(JUST_SLOW_TIME*JUST_GOOD.slow) : JUST_SLOW_TIME;
            this.slowPow = 1;
            this.slowBack = false;
            this.echoFresh = true;
            //「ブゥゥン」：低くうなる音とともに、BGMがこもる(元の速さへ戻り始めると晴れる)
            sound.timeWarp(true);
            sound.play("slowIn");
            this.slowAcc = 0;
        }
        this.justT = JUST_TEXT_TIME;
        this.zoomT = Math.round(ZOOM_TIME*0.7); this.zoomX = drone.X; this.zoomY = drone.Y;
        this.flashT = 4;
        fx.tint(JUST_COLOR, this.justFx().tint);
        fx.flare(drone.X, drone.Y, 70, "255,255,255", 14);
        fx.ring(drone.X, drone.Y, BLAST_RADIUS*1.15, JUST_COLOR, 22, 6);
        fx.ring(drone.X, drone.Y, 60, "255,255,255", 12, 3);
        fx.sparks(drone.X, drone.Y, 26, JUST_COLOR, 9, 3);
        fx.shake(10);
        //文字はドローン君に重ならないよう上に離して出す(画面の上の端では下に)
        this.justX = Math.max(110,Math.min(drone.X,CW-110));
        this.justY = drone.Y > 150 ? drone.Y - 95 : drone.Y + 95;
        this.justN = n;
        sound.play("just");
    },
    //はね返した弾・かすりバーストの星が敵に当たった(equipment.js の updateBullets から)
    justHit:function(_b,_e){
        var col = _b.skill ? SKILL_COLOR : JUST_COLOR;
        if(!_b.skill) this.justHits++;
        fx.flare(_b.x, _b.y, 26, col, 12);
        fx.flare(_b.x, _b.y, 10, "255,255,255", 8);
        fx.sparks(_b.x, _b.y, 7, col, 6, 2.5);
        popup(_e.x + (Math.random() - 0.5)*16, _e.y - _e.r - 6, "-" + Math.round(_b.skill ? _b.dmg : _b.dmg*this.comboMul()), _b.skill ? "rgb(210,140,0)" : "rgb(30,150,200)");
        //同じフレームにいくつ当たっても音は1回
        if(this.justHitClock != this.clock){
            this.justHitClock = this.clock;
            sound.play("justHit");
        }
    },

    //タッチ操作用の衝撃波ボタン(右下)
    touchBlast:{ x:CW - 66, y:CH - 104, r:42 },
    touchBlastHit:function(_x,_y){
        var b = this.touchBlast;
        return Math.hypot(_x - b.x, _y - b.y) < b.r + 8;
    },
    drawTouchBlast:function(){
        var b = this.touchBlast;
        var ok = this.yaruki >= YARUKI_COST;
        ctx.fillStyle = ok ? "rgba(220,40,40,0.85)" : "rgba(160,160,160,0.6)";
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r - 6,0,Math.PI*2); ctx.stroke();
        //やる気がたまっていく様子
        ctx.strokeStyle = ok ? "#fff" : "#555";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r + 3,-Math.PI/2,-Math.PI/2 + Math.PI*2*Math.min(1,this.yaruki/YARUKI_COST)); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 15px sans-serif";
        ctx.fillText("衝撃波",b.x,b.y);
        ctx.fillStyle = "#000";
    },

    //------------------------------------------------------------ かすりコンボ
    //今のコンボの段階(0:段階なし。COMBO_TIERS のいくつに届いたか)
    comboTier:function(_n){
        var n = _n == null ? this.combo : _n, t = 0;
        while(t < COMBO_TIERS.length && n >= COMBO_TIERS[t]) t++;
        return t;
    },
    //今のコンボでの威力の倍率
    comboMul:function(){
        return 1 + Math.min(this.combo, COMBO_MAX)*COMBO_POWER;
    },
    //かすった：コンボを1つ増やし、途切れるまでの時間を戻す
    addCombo:function(_b){
        var before = this.comboTier();
        this.combo++;
        this.comboT = COMBO_TIME;
        this.comboPop = 8;
        this.comboEnd = null;
        if(this.combo > this.comboBest) this.comboBest = this.combo;
        //かするたびに、コンボが長いほど音が高くなる
        sound.grazeCombo = this.combo;
        var tier = this.comboTier();
        if(tier > before){
            //段階が上がった：ドローン君のまわりに光の輪、文字、音
            var c = COMBO_COLORS[tier];
            fx.ring(drone.X, drone.Y, 70 + tier*16, c, 22, 4 + tier);
            fx.flare(drone.X, drone.Y, 40 + tier*10, c, 14);
            fx.sparks(drone.X, drone.Y, 10 + tier*6, c, 6, 2.5);
            popup(Math.max(90,Math.min(drone.X,CW-90)), Math.max(40, drone.Y - 48),
                  (this.combo >= COMBO_MAX ? "MAX " : "") + this.combo + " COMBO！ 威力+" + Math.round((this.comboMul() - 1)*100) + "%",
                  "rgb(" + c + ")", true);
            sound.play("comboUp");
        }
        //かすりバースト：SKILL_EVERY コンボごとに発動
        if(this.combo % SKILL_EVERY == 0) this.comboSkill();
    },
    //かすりバーストで放つ星の数(賢さで増える)
    skillShots:function(){
        return Math.min(SKILL_SHOTS_MAX, SKILL_SHOTS_BASE + (game.level.brain - 1)*SKILL_SHOTS_PER);
    },
    //かすりバースト(強スキル)：金色の星を周りへ放ち、画面中の敵へ順に割りふって追いかけさせる
    comboSkill:function(){
        var list = enemies.filter(function(e){ return !e.dead && !e.harmless && e.x > 0 && e.x < CW && e.y > 0 && e.y < CH; });
        list.sort(function(a,b){ return Math.hypot(a.x - drone.X, a.y - drone.Y) - Math.hypot(b.x - drone.X, b.y - drone.Y); });
        var n = this.skillShots();
        for(var i=0; i<n; i++){
            var a = i/n*Math.PI*2 + this.clock*0.1;
            arms.bullets.push({ x:drone.X, y:drone.Y, vx:Math.cos(a)*SKILL_SPEED, vy:Math.sin(a)*SKILL_SPEED, life:150,
                                pierce:0, hit:[], just:true, skill:true, dmg:SKILL_DMG,
                                target:list.length ? list[i % list.length] : null, delay:SKILL_DELAY, turn:SKILL_TURN });
        }
        this.guard = Math.max(this.guard, SKILL_GUARD);
        //発動の手ごたえ：白い閃光・金色の大きな輪・止め・文字・音
        this.hitStop = 4;
        this.flashT = 5;
        fx.tint(SKILL_COLOR, 36);
        fx.flare(drone.X, drone.Y, 90, "255,255,255", 16);
        fx.ring(drone.X, drone.Y, 180, SKILL_COLOR, 26, 8);
        fx.ring(drone.X, drone.Y, 110, "255,255,255", 16, 4);
        fx.sparks(drone.X, drone.Y, 36, SKILL_COLOR, 10, 3.5);
        fx.shake(12);
        popup(Math.max(100,Math.min(drone.X,CW-100)), Math.max(30, drone.Y - 80), "かすりバースト！", "rgb(" + SKILL_COLOR + ")", true);
        sound.play("skill");
    },
    //コンボが途切れた(被弾・時間切れ)。2つ以上続いていたら、いくつ続いたかを出す
    breakCombo:function(_hit){
        if(this.combo >= 2) this.comboEnd = { n:this.combo, t:70, broke:!!_hit };
        if(this.combo >= COMBO_TIERS[0]) sound.play(_hit ? "comboBreak" : "comboEnd");
        this.combo = 0;
        this.comboT = 0;
    },
    comboStep:function(){
        if(this.comboPop > 0) this.comboPop--;
        if(this.grazeFlash > 0) this.grazeFlash--;
        if(this.comboCd > 0) this.comboCd--;
        if(this.comboEnd && --this.comboEnd.t <= 0) this.comboEnd = null;
        if(this.combo > 0 && --this.comboT <= 0) this.breakCombo(false);
    },

    canBeHit:function(){
        return (this.state == "play" || this.state == "start") && this.invincible == 0 && this.guard == 0 && !this.down && !timeStop.active;
    },

    damage:function(){
        //時止めワープ(試作。デバッグでオンにしたときだけ)：ダメージを受けずに時を止め、選んだ場所へ移る
        if(timeStop.trigger()) return;
        this.breakCombo(true);     //被弾するとかすりコンボは途切れる
        //デバッグのボス戦で無敵にしているとき・武器試用は減らない(当たった音と点滅だけ)
        if(bossDebug.active && (bossDebug.god || bossDebug.trial)){
            this.invincible = 30;
            sound.play("damage");
            return;
        }
        this.hp--;
        this.invincible = INVINCIBLE_TIME;
        sound.play("damage");
        this.shake = 12;
        burst(drone.X,drone.Y,10,"#c33");
        if(this.hp <= 0 && coop.active){
            //協力プレイ：倒れて次のWAVEまで休む。ふたりとも倒れたらゲームオーバー(coop.update)
            this.hp = 0;
            this.down = true;
            sound.play("destroyed");
            this.shake = 25;
            burst(drone.X,drone.Y,40,"#333");
            burst(drone.X,drone.Y,20,"#e44");
            if(coop.isHost() && (!coop.partner || coop.partner.down || coop.partner.page != 1)){
                this.state = "over";
                this.stateTime = 0;
                sound.stopMusic();
            }
            return;
        }
        if(this.hp <= 0){
            this.hp = 0;
            this.state = "over";
            sound.stopMusic();
            sound.play("destroyed");
            this.stateTime = 0;
            this.shake = 25;
            burst(drone.X,drone.Y,40,"#333");
            burst(drone.X,drone.Y,20,"#e44");
        }
    },

    //_src：何で攻撃したか("gun","missile"など。シナジーの判定に使う)
    hitEnemy:function(_e,_dmg,_src){
        //ショップのバフ(強化弾頭)とかすりコンボ。相方の攻撃は相方の画面でもうかけてある。かすりバーストの星は決まったダメージ
        if(_src != "partner" && _src != "skill") _dmg *= (1 + BUFF_POWER*game.buff("power")) * this.comboMul();
        //凍った敵：次の一撃が2倍で、氷が砕ける(冷凍。armsExtra.js。ゲストの攻撃はホストに届いてから数える)
        if(_e.frozen > 0 && _src != "freeze" && !coop.isGuest()){
            _dmg *= 2;
            _e.frozen = 0;
            _e.wasFrozen = true;
            arms.shatterFx(_e);
        }
        //対戦の相手：ダメージを数えて相手へ送るだけ(相手の耐久は相手の画面で減らす。versus.js)
        if(_e.rival){ versus.hit(_e,_dmg,_src); return; }
        //ゲストの攻撃はダメージをホストへ送るだけ(敵を動かしているのはホスト)
        if(coop.isGuest()){ coop.guestHit(_e,_dmg,_src); return; }
        if(_e.dead) return;
        bossDebug.dealt(_e,_dmg);
        _e.hp -= _dmg;
        _e.flash = 6;
        if(_e.hp > 0){
            sound.play("hit");
            return;
        }
        sound.play("kill");
        //撃破：スコアとパーツを落とす
        _e.dead = true;
        arms.onKill(_e,_src);
        game.score += _e.score;
        popup(_e.x,_e.y - _e.r,"+" + _e.score);
        killBlast(_e.x,_e.y,_e.r,_e.type == "goldbug" ? "255,215,0" : null);
        for(var i=partsDrop(_e.parts); i>0; i--) this.drop("part",_e.x,_e.y);
        if(Math.random() < YARUKI_DROP_RATE) this.drop("yaruki",_e.x,_e.y);
        special.onKill(_e);
        this.revenge(_e);
    },

    //撃ち返し：WAVE4から、小さな敵が倒れぎわにドローンを狙って弾を撃つ
    revenge:function(_e){
        if(game.wave < REVENGE_FROM || this.state != "play") return;
        if(_e.type != "bug" && _e.type != "dasher") return;
        if(_e.countered) return;    //弾き返した突進は撃ち返さない
        if(Math.random() > Math.min(1, (REVENGE_RATE + (game.wave - REVENGE_FROM)*REVENGE_RATE_UP)*difficulty().revenge)) return;
        var tgt = nearestPlayer(_e.x,_e.y);
        var dx = tgt.X - _e.x, dy = tgt.Y - _e.y;
        if(Math.hypot(dx,dy) < 90) return;  //目の前で撃たれるのは避けようがないので撃たない
        fireFan(_e.x,_e.y,Math.atan2(dy,dx),game.wave >= 9 ? 3 : 1,0.3,2.4*danmaku(),"small");
    },

    drop:function(_kind,_x,_y){
        var a = Math.random()*Math.PI*2, s = 1 + Math.random()*2.5;
        //報酬カプセルは長めに残る
        pickups.push({ id:++pickupSeq, kind:_kind, x:_x, y:_y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
                       life:_kind == "capsule" ? PICKUP_LIFE*2 : PICKUP_LIFE, t:0 });
    },

    updateEnemies:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead) continue;
            e.t++;
            if(e.flash > 0) e.flash--;
            //狙うのは近い方のプレイヤー(ひとりのときは自分)
            var tgt = nearestPlayer(e.x,e.y);
            aimAt = tgt;
            var dx = tgt.X - e.x, dy = tgt.Y - e.y, d = Math.hypot(dx,dy) || 1;
            //凍った敵は動かず、攻撃もしない(冷凍。armsExtra.js。ボス・レア敵は凍らず遅くなるだけ)
            if(e.frozen > 0 && !e.boss && !e.rare && !e.countered) continue;
            e.face = Math.atan2(dy,dx);

            //レア敵・ボスの動きはbosses.js
            if(!special.update(e,dx,dy,d) && !forces.update(e,dx,dy,d)) switch(e.type){
                case "bug":
                    //ふらつきながらドローンに寄ってくる
                    var wig = Math.sin(e.t*0.1) * 0.8;
                    e.vx += ((dx/d - dy/d*wig) * e.speed - e.vx) * 0.04;
                    e.vy += ((dy/d + dx/d*wig) * e.speed - e.vy) * 0.04;
                    //画面の中にいる間、ときどき狙って1発撃つ(目の前では撃たない。避けようがないので)
                    if(e.shotT != null && e.x > 0 && e.x < CW && e.y > 0 && e.y < CH && --e.shotT <= 0){
                        e.shotT = randIn(BUG_SHOT_EVERY);
                        if(this.state == "play" && d > 90){
                            fireShot(e.x,e.y,Math.atan2(dy,dx),BUG_SHOT_SPEED*danmaku(),"small");
                            sound.play("enemyShot");
                        }
                    }
                    break;
                case "tank":
                    e.vx += (dx/d*e.speed - e.vx) * 0.03;
                    e.vy += (dy/d*e.speed - e.vy) * 0.03;
                    //ときどき大きな弾の輪を撃つ
                    if(--e.timer <= 0 && this.state == "play" && e.x > 0 && e.x < CW && e.y > 0 && e.y < CH){
                        fireRing(e.x,e.y,game.wave >= 8 ? 12 : 8,1.5*danmaku(),e.t*0.1,"big");
                        sound.play("bossShot");
                        e.timer = 170;
                    }
                    break;
                case "spinner":
                    var mx = e.tx - e.x, my = e.ty - e.y, md = Math.hypot(mx,my);
                    if(e.firing > 0){
                        //止まって回りながら渦巻き状に撃つ
                        e.vx = 0; e.vy = 0;
                        e.firing--;
                        e.spin += 0.28;
                        if(e.firing % 6 == 0 && this.state == "play"){
                            var arms = game.wave >= 7 ? 3 : 2;
                            fireRing(e.x,e.y,arms,2.1*danmaku(),e.spin,"small");
                            sound.play("enemyShot");
                        }
                        if(e.firing == 0){ e.timer = 100; setShooterTarget(e); }
                    }else if(md > 3){
                        e.vx = mx/md*e.speed; e.vy = my/md*e.speed;
                    }else{
                        e.vx = 0; e.vy = 0;
                        if(--e.timer <= 0) e.firing = 60;
                    }
                    break;
                case "bomber":
                    if(e.fuse > 0){
                        //点滅しながら止まり、最後に弾の輪をまき散らして消える
                        e.vx *= 0.85; e.vy *= 0.85;
                        if(--e.fuse == 0){
                            var n = Math.min(24, Math.round(12*danmaku()));
                            fireRing(e.x,e.y,n,2.3*danmaku(),Math.random(),"normal");
                            fireRing(e.x,e.y,Math.round(n/2),1.5*danmaku(),Math.random(),"big");
                            burst(e.x,e.y,20,"#c33");
                            effects.push({ ring:true, x:e.x, y:e.y, life:14, maxLife:14, R:60, color:"220,40,40" });
                            sound.play("explode");
                            e.dead = true;  //自爆なので報酬は無し
                        }
                    }else{
                        e.vx += (dx/d*e.speed - e.vx) * 0.04;
                        e.vy += (dy/d*e.speed - e.vy) * 0.04;
                        if((d < 130 || --e.timer <= 0) && this.state == "play"){
                            e.fuse = 45;
                            sound.play("error");
                        }
                    }
                    break;
                case "dasher":
                    if(e.countered){
                        //ジャスト・カウンターで弾き返された(動きは移動のあとで updateCounter)
                    }else this.updateDasher(e,dx,dy,d);
                    break;
                case "shooter":
                    var mx = e.tx - e.x, my = e.ty - e.y, md = Math.hypot(mx,my);
                    if(md > 3){
                        e.vx = mx/md*e.speed; e.vy = my/md*e.speed;
                    }else{
                        e.vx = 0; e.vy = 0;
                        e.timer--;
                        if(e.timer <= 0 && this.state == "play"){
                            //ドローンを狙って扇状に撃ったら、次の場所へ移動
                            fireFan(e.x,e.y,Math.atan2(dy,dx),game.wave >= 6 ? 5 : 3,0.26,2.8*danmaku(),"normal");
                            e.timer = 55;
                            sound.play("enemyShot");
                            setShooterTarget(e);
                        }
                    }
                    break;
            }
            //EMPを受けた敵は遅くなる
            var sp = 1;
            if(e.slow > 0){ e.slow--; sp = e.boss ? 0.7 : 0.4; }
            //水鉄砲で濡れた敵も少し遅くなる
            if(e.wet > 0){ e.wet--; sp *= 0.85; }
            e.x += e.vx*sp;
            e.y += e.vy*sp;
            if(e.dead) continue;  //逃げていったレア敵

            //弾き返した突進：ほかの敵にぶつかり、時間切れか画面の端で砕ける。ドローン君には当たらない
            if(e.countered){
                this.updateCounter(e);
                continue;
            }

            //突進した敵は画面の外に出たら消える(倒した扱いにはしない。連続突進の途中なら止まって戻ってくる)
            if(e.type == "dasher" && e.tell == TELL.dash &&
               (e.x < -60 || e.x > CW+60 || e.y < -60 || e.y > CH+60)){
                if(e.chain > 0){ e.tell = TELL.brake; e.timer = TELL_BRAKE_T; }
                else{ e.dead = true; continue; }
            }

            //体当たり：ドローンは被弾、敵もダメージを受けて弾き返される
            //体当たりの判定は自分のドローン君だけ(相方は相方の画面で判定する)
            var ld = Math.hypot(drone.X - e.x, drone.Y - e.y);
            if(ld < e.r + drone.R && this.canBeHit() && !e.harmless){
                this.damage();
                this.hitEnemy(e,1);
                if(!e.boss){ e.vx = -dx/d*5; e.vy = -dy/d*5; }
                if(e.type == "dasher"){ e.tell = TELL.dash; e.chain = 0; }     //ぶつかったら画面の外へ去る
            }
        }
        enemies = enemies.filter(function(e){ return !e.dead; });
    },

    //敵の弾
    //当たり判定はドローン中心の小さな点だけ。すれすれでよけると「かすり」でやる気がたまる
    updateShots:function(){
        for(var i=enemyShots.length-1; i>=0; i--){
            var b = enemyShots[i];
            if(b.homing){
                //追尾弾(ドローン君改のミサイル・龍)：少しずつドローン君の方へ曲がり、時間で消える
                var cur = Math.atan2(b.vy,b.vx);
                var ht = nearestPlayer(b.x,b.y);
                cur = turnTo(cur, Math.atan2(ht.Y - b.y, ht.X - b.x), b.turn);
                b.vx = Math.cos(cur)*b.speed;
                b.vy = Math.sin(cur)*b.speed;
                if(b.trail){
                    b.trail.unshift({ x:b.x, y:b.y });
                    if(b.trail.length > 16) b.trail.pop();
                }
                if(--b.life <= 0){
                    burst(b.x,b.y,6,"#a33");
                    enemyShots.splice(i,1);
                    continue;
                }
            }
            b.x += b.vx; b.y += b.vy;
            if(!b.homing && (b.x < -20 || b.x > CW+20 || b.y < -20 || b.y > CH+20)){
                enemyShots.splice(i,1);
                continue;
            }
            if(this.state == "over") continue;
            var d = Math.hypot(b.x - drone.X, b.y - drone.Y);
            var r = b.r || 5;
            if(d < r + HIT_CORE && this.canBeHit()){
                enemyShots.splice(i,1);
                this.damage();
            }else if(!b.grazed && d < r + GRAZE_RANGE && !this.down && (!coop.isGuest() || coop.grazeCd <= 0)){
                b.grazed = true;
                if(coop.isGuest()) coop.grazeCd = 6;   //ゲストの弾は届くたびに作り直すので、続けてかすらないように
                this.graze++;
                //コンボは待ち時間(COMBO_CD)ごとに1つだけ増える。待ちの間は途切れないようにするだけ
                if(this.comboCd > 0) this.comboT = COMBO_TIME;
                else{ this.comboCd = COMBO_CD; this.addCombo(b); }
                battleBg.graze(b.x, b.y, this.comboTier());
                this.grazeFlash = GRAZE_FLASH_TIME;
                this.addYaruki(YARUKI_GRAZE);
                game.score += 2;
                effects.push({ x:drone.X + (b.x - drone.X)*0.6, y:drone.Y + (b.y - drone.Y)*0.6,
                               vx:(Math.random()-0.5)*2, vy:(Math.random()-0.5)*2,
                               life:12, maxLife:12, size:2.5, glow:"80,160,255" });
                sound.play("graze");
            }
        }
    },

    updatePickups:function(){
        for(var i=pickups.length-1; i>=0; i--){
            var p = pickups[i];
            p.t++;
            p.life--;
            p.vx *= 0.9; p.vy *= 0.9;
            p.x += p.vx; p.y += p.vy;
            if(this.state == "over"){
                if(p.life <= 0) pickups.splice(i,1);
                continue;
            }
            //近くのアイテムは近い方のプレイヤーへ吸い寄せる(WAVEクリア時は全部)
            var mt = nearestPlayer(p.x,p.y);
            var mx = mt.X - p.x, my = mt.Y - p.y, md = Math.hypot(mx,my) || 1;
            if(this.state == "clear" || md < MAGNET_RANGE){
                var s = Math.min(this.state == "clear" ? 12 : 6, md);
                p.x += mx/md*s; p.y += my/md*s;
            }
            //拾えるのは自分のドローン君だけ(相方が拾ったものは相方の画面から知らせが来る)
            var dx = drone.X - p.x, dy = drone.Y - p.y, d = Math.hypot(dx,dy) || 1;
            if(d < drone.R + 6 && !this.down){
                coop.onCollect(p);
                if(p.kind == "part"){
                    game.gainParts(1);
                    sound.play("part");
                }else if(p.kind == "capsule"){
                    //WAVEクリア後に選べる報酬が1回増える
                    game.pendingReward = (game.pendingReward || 0) + 1;
                    popup(p.x,p.y - 10,"報酬カプセル！ 報酬+1","#b8860b");
                    sound.play("reward");
                }else{
                    this.addYaruki(YARUKI_PICKUP);
                    popup(p.x,p.y - 10,"やる気+" + YARUKI_PICKUP,"#e07020");
                    sound.play("yaruki");
                }
                pickups.splice(i,1);
            }else if(p.life <= 0){
                pickups.splice(i,1);
            }
        }
    },

    updateEffects:function(){
        //演出が増えすぎたら古いものから消す(重くならないように)
        if(effects.length > 700) effects.splice(0, effects.length - 700);
        for(var i=effects.length-1; i>=0; i--){
            var f = effects[i];
            f.life--;
            if(f.smoke) f.vy -= 0.02;   //煙はゆっくり上へ昇る
            if(f.fall){ f.vy += 0.12; f.x += f.vx; f.y += f.vy; }   //砂ぼこりは落ちていく
            else if(!f.ring && !f.line && !f.flare){ f.x += f.vx; f.y += f.vy; f.vx *= 0.92; f.vy *= 0.92; }
            if(f.life <= 0) effects.splice(i,1);
        }
        for(var i=popups.length-1; i>=0; i--){
            popups[i].y -= 0.6;
            popups[i].life--;
            if(popups[i].life <= 0) popups.splice(i,1);
        }
    },

    //----------------------------------------------------------------- 描画
    draw:function(){
        ctx.save();
        if(this.shake > 0){
            ctx.translate((Math.random()-0.5)*this.shake, (Math.random()-0.5)*this.shake);
        }
        //ボスの着地の瞬間は、着地点に向かってぐっと寄る
        if(this.zoomT > 0){
            var z = 1 + 0.08*this.zoomT/ZOOM_TIME;
            ctx.translate(this.zoomX, this.zoomY);
            ctx.scale(z, z);
            ctx.translate(-this.zoomX, -this.zoomY);
        }
        //ジャスト衝撃波のゆっくりの間は、ドローン君へ寄る
        if(this.slowPow > 0){
            var z = 1 + JUST_SLOW_ZOOM*this.slowPow;
            ctx.translate(drone.X, drone.Y);
            ctx.scale(z, z);
            ctx.translate(-drone.X, -drone.Y);
        }
        this.drawBackground();

        //ボスの登場の演出中はドローン君を出さない(着地のあとに現れる)
        var showMe = this.state != "over" && !this.cinematic();
        //自動攻撃の射程
        if(showMe){
            ctx.strokeStyle = "rgba(0,0,0,0.06)";
            ctx.beginPath();
            ctx.arc(drone.X,drone.Y,game.range(),0,Math.PI*2);
            ctx.stroke();
        }

        for(var i=0; i<pickups.length; i++) this.drawPickup(pickups[i]);
        //ボスの攻撃予告・レーザーは敵より奥に描く
        for(var i=0; i<enemies.length; i++) if(enemies[i].boss) special.drawAttack(enemies[i]);
        for(var i=0; i<enemies.length; i++) this.drawEnemy(enemies[i]);

        //ドローンの装備(弾・ミサイル・虫など)
        arms.draw(this.state != "over");

        //敵の弾(種類ごとに色と大きさが違う。白い芯で見やすく)
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            var r = b.r || 5;
            if(b.kind == "missile"){
                //ドローン君改のミサイル(黒い弾頭の赤い筒)
                ctx.save();
                ctx.translate(b.x,b.y);
                ctx.rotate(Math.atan2(b.vy,b.vx));
                ctx.fillStyle = "rgba(255,120,40,0.6)";
                ctx.beginPath(); ctx.arc(-9,0,4 + Math.random()*2,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#b01e28";
                ctx.fillRect(-8,-3.5,13,7);
                ctx.fillStyle = "#111";
                ctx.beginPath(); ctx.moveTo(5,-3.5); ctx.lineTo(10,0); ctx.lineTo(5,3.5); ctx.fill();
                ctx.restore();
                continue;
            }
            if(b.kind == "dragon"){
                //ドローン君改の黒い龍(胴体は通った跡)
                var tr = b.trail || [];
                for(var j=tr.length-1; j>=0; j--){
                    var k = 1 - j/16, rr = 2 + k*7;
                    ctx.fillStyle = "rgba(20,10,12,0.9)";
                    ctx.beginPath(); ctx.arc(tr[j].x,tr[j].y,rr + 1.5,0,Math.PI*2); ctx.fill();
                    ctx.fillStyle = "rgb(" + b.color + ")";
                    ctx.beginPath(); ctx.arc(tr[j].x,tr[j].y,rr,0,Math.PI*2); ctx.fill();
                }
                ctx.save();
                ctx.translate(b.x,b.y);
                ctx.rotate(Math.atan2(b.vy,b.vx));
                ctx.fillStyle = "#140a0c";
                ctx.beginPath(); ctx.ellipse(2,0,12,8,0,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle = "#140a0c"; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(-2,-5); ctx.lineTo(-13,-13); ctx.moveTo(-2,5); ctx.lineTo(-13,13); ctx.stroke();
                ctx.lineWidth = 1;
                ctx.fillStyle = "#ff2030";
                ctx.beginPath(); ctx.arc(6,-3.5,2.2,0,Math.PI*2); ctx.arc(6,3.5,2.2,0,Math.PI*2); ctx.fill();
                ctx.restore();
                continue;
            }
            ctx.fillStyle = b.kind == "small" ? "#e8700a" : (b.kind == "big" ? "#8a3fd1" : (b.kind == "water" ? "#1f8fc4" : "#d22"));
            ctx.beginPath(); ctx.arc(b.x,b.y,r + 1,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(b.x,b.y,r*0.45,0,Math.PI*2); ctx.fill();
        }

        //かすりコンボ：ドローン君のまわりに、途切れるまでの時間を表す輪
        if(showMe && !this.down && this.combo >= 2) this.drawComboAura();
        //ドローン(被弾後の無敵中は点滅、撃墜されたら消える)
        //協力プレイの相方
        if(!this.cinematic()) coop.drawPartner();
        if(timeStop.active) timeStop.draw();     //時止めワープの間は、周りの色を抜いて、ドローン君か粒子を描く
        else if(showMe && !this.down && Math.floor(this.invincible/4) % 2 == 0){
            //着地のあとは、ふわっと現れる
            ctx.globalAlpha = 1 - this.droneIn/DRONE_IN_TIME;
            drone.draw();
            ctx.globalAlpha = 1;
        }
        //かすりの範囲(弾のふちがこの輪に入るとかすり。かすった瞬間は明るく光る。右下のボタンで隠せる)
        if(showMe && !this.down && viewOpt.graze && !timeStop.active) this.drawGrazeRange();
        //敵の弾に対する当たり判定(中心の点。右下のボタンで隠せる)
        if(showMe && viewOpt.hitbox && !timeStop.active){
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(drone.X,drone.Y,HIT_CORE*0.75 + 1.5,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "#e22";
            ctx.beginPath(); ctx.arc(drone.X,drone.Y,HIT_CORE*0.75,0,Math.PI*2); ctx.fill();
        }

        this.drawEffects();
        this.drawKaiIntro();
        ctx.font = "bold 14px sans-serif";
        if(this.yarukiMsg > 0){
            ctx.fillStyle = "#c60";
            ctx.fillText("やる気が足りない！",drone.X,drone.Y - 34);
        }
        ctx.restore();
        if(this.slowPow > 0) this.drawSlowFx();

        //連鎖爆破などで画面全体がうっすら色づく
        if(this.tint){
            ctx.fillStyle = "rgba(" + this.tint.color + "," + (0.16*this.tint.life/this.tint.maxLife) + ")";
            ctx.fillRect(0,0,CW,CH);
        }
        //ボスの着地の瞬間の白い閃光(ヒットストップの間は真っ白に近いまま)
        if(this.flashT > 0){
            ctx.fillStyle = "rgba(255,255,255," + (0.85*this.flashT/FLASH_TIME) + ")";
            ctx.fillRect(0,0,CW,CH);
        }
        this.drawDon();     //閃光の上に出す
        this.drawJust();

        this.drawHud();
        coop.drawHud();
        if(this.down && this.state != "over"){
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 22px sans-serif";
            ctx.fillStyle = "rgba(200,40,40,0.9)";
            ctx.fillText("ダウン中……次のWAVEで復帰します。相方をたのむ！",CW/2,CH/2 + 80);
            ctx.fillStyle = "#000";
        }
        special.drawBossBar();
        //レア敵の出現案内
        if(this.rareMsgTime > 0){
            ctx.globalAlpha = Math.min(1, this.rareMsgTime/30);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 16px sans-serif";
            ctx.fillStyle = "#b8860b";
            ctx.fillText("★ " + this.rareMsg,CW/2,this.bossWave ? 100 : 70);
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#000";
        }
        this.drawGogogo();
        this.drawBanner();
        this.drawBossIntro();
        bossDebug.drawTag();
        timeStop.drawUi();

        if(this.paused){
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            ctx.fillRect(0,0,CW,CH);
            ctx.fillStyle = "#000";
            ctx.textAlign = "center";
            ctx.font = "bold 40px serif";
            ctx.fillText("一時停止中",CW/2,CH/2 - 20);
            ctx.font = "18px sans-serif";
            ctx.fillText(inputMode == "touch" ? "画面をタッチすると再開します" : "キャンバスにマウスを戻すと再開します",CW/2,CH/2 + 25);
        }
        ctx.fillStyle = "#000";
    },

    //追従が遅くなっていることを、ドローン君のまわりで知らせる(気づかないまま鈍くなるのを防ぐ)
    //_color："r,g,b"　_dy：文字をドローン君の中心から何px上に出すか
    drawSlowMark:function(_text,_color,_dy){
        var a = 0.65 + 0.3*Math.sin(this.clock*0.25);    //点滅
        ctx.strokeStyle = "rgba(" + _color + "," + a + ")";
        ctx.lineWidth = 4;
        ctx.setLineDash([6,5]);
        ctx.beginPath(); ctx.arc(drone.X,drone.Y,drone.R + 16,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.strokeText(_text,drone.X,drone.Y - _dy);
        ctx.lineJoin = "miter";
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgb(" + _color + ")";
        ctx.fillText(_text,drone.X,drone.Y - _dy);
        ctx.fillStyle = "#000";
    },

    //破片・衝撃波・文字(対戦画面からも使う)
    drawEffects:function(){
        //破片・衝撃波
        for(var i=0; i<effects.length; i++){
            var f = effects[i];
            var k = 1 - f.life/f.maxLife;   //0→1へ進む
            if(f.smoke){
                //煙：ふくらみながら薄くなる
                var R = f.R0 + (f.R1 - f.R0)*(1 - (1-k)*(1-k));
                ctx.fillStyle = "rgba(" + f.color + "," + (0.32*(1-k)) + ")";
                ctx.beginPath(); ctx.arc(f.x,f.y,R,0,Math.PI*2); ctx.fill();
                continue;
            }
            if(f.ring){
                //R・colorが無ければクリックの衝撃波。wで太さ
                ctx.strokeStyle = "rgba(" + (f.color || "220,40,40") + "," + (1-k) + ")";
                ctx.lineWidth = (f.w || 4)*(1 - k*0.5);
                ctx.beginPath(); ctx.arc(f.x,f.y,Math.max(1,(f.R || BLAST_RADIUS)*k),0,Math.PI*2); ctx.stroke();
                ctx.lineWidth = 1;
            }else if(f.flare){
                //光の玉(中心が濃く、外に向かって透明)
                var R = f.R*(0.5 + 0.5*Math.min(1,k*3));
                var g = ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,R);
                g.addColorStop(0,"rgba(" + f.color + "," + (0.9*(1-k)) + ")");
                g.addColorStop(0.4,"rgba(" + f.color + "," + (0.5*(1-k)) + ")");
                g.addColorStop(1,"rgba(" + f.color + ",0)");
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(f.x,f.y,R,0,Math.PI*2); ctx.fill();
            }else if(f.line){
                //導火線・残像などの線
                ctx.strokeStyle = "rgba(" + f.color + "," + (1-k) + ")";
                ctx.lineWidth = f.w*(1-k*0.6);
                ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x2,f.y2); ctx.stroke();
                ctx.lineCap = "butt";
                ctx.lineWidth = 1;
            }else if(f.glow){
                //光る火花(色付きのにじみ＋芯)
                var a = Math.min(1, f.life/f.maxLife*2);
                ctx.fillStyle = "rgba(" + f.glow + "," + (0.3*a) + ")";
                ctx.beginPath(); ctx.arc(f.x,f.y,f.size*1.8,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "rgba(" + f.glow + "," + a + ")";
                ctx.beginPath(); ctx.arc(f.x,f.y,f.size*0.7,0,Math.PI*2); ctx.fill();
            }else{
                ctx.globalAlpha = Math.min(1, f.life/f.maxLife*2);
                ctx.fillStyle = f.color;
                ctx.fillRect(f.x - f.size/2, f.y - f.size/2, f.size, f.size);
                ctx.globalAlpha = 1;
            }
        }

        //文字(bigはシナジー名など。白いふちどりで目立たせ、ぽんと大きく出る)
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for(var i=0; i<popups.length; i++){
            var p = popups[i];
            ctx.globalAlpha = Math.min(1, p.life/20);
            if(p.big){
                var age = p.maxLife - p.life;
                var sc = age < 6 ? 1.6 - age*0.1 : 1;
                ctx.font = "900 " + Math.round(20*sc) + "px sans-serif";
                ctx.lineJoin = "round";
                ctx.lineWidth = 6;
                ctx.strokeStyle = "rgba(20,20,24,0.9)";
                ctx.strokeText(p.text,p.x,p.y);
                ctx.lineJoin = "miter";
                ctx.lineWidth = 1;
            }else{
                ctx.font = "bold 14px sans-serif";
            }
            ctx.fillStyle = p.color;
            ctx.fillText(p.text,p.x,p.y);
        }
        ctx.globalAlpha = 1;
    },

    //空と街・戦いに反応する方眼(battleBg.js)
    drawBackground:function(){
        battleBg.draw();
    },

    drawEnemy:function(_e){
        var body = _e.flash > 0 ? "#fff" : null;
        //弾き返した突進(ジャスト・カウンター)：水色の光の尾を引く
        if(_e.countered){
            var sp = Math.hypot(_e.vx,_e.vy) || 1;
            var ux = _e.vx/sp, uy = _e.vy/sp;
            ctx.lineCap = "round";
            ctx.strokeStyle = "rgba(" + JUST_COLOR + ",0.35)"; ctx.lineWidth = _e.r*1.8;
            ctx.beginPath(); ctx.moveTo(_e.x,_e.y); ctx.lineTo(_e.x - ux*48,_e.y - uy*48); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(_e.x,_e.y); ctx.lineTo(_e.x - ux*30,_e.y - uy*30); ctx.stroke();
            ctx.lineCap = "butt"; ctx.lineWidth = 1;
            body = body || "rgb(" + JUST_COLOR + ")";
        }
        ctx.save();
        ctx.translate(_e.x,_e.y);
        //レア敵・ボスの見た目はbosses.js、雑魚敵はenemyArt.js、同胞はforces.js
        if(!special.draw(_e,body) && !enemyArt.draw(_e,body)) forces.draw(_e,body);
        ctx.restore();

        //燃えている・凍っている敵(armsExtra.js)
        arms.drawStatus(_e);

        //濡れている敵：水色のしずくがしたたる
        if(_e.wet > 0){
            ctx.fillStyle = "rgba(41,163,214," + Math.min(1,_e.wet/40) + ")";
            for(var i=0; i<2; i++){
                var ph = ((_e.t*0.04 + i*0.5) % 1);
                var dx = (i == 0 ? -0.45 : 0.4)*_e.r;
                ctx.beginPath(); ctx.arc(_e.x + dx, _e.y + _e.r*0.6 + ph*12, 2.2*(1 - ph*0.5),0,Math.PI*2); ctx.fill();
            }
            ctx.strokeStyle = "rgba(41,163,214,0.45)";
            ctx.beginPath(); ctx.arc(_e.x,_e.y,_e.r + 2,Math.PI*0.15,Math.PI*0.85); ctx.stroke();
        }

        //EMPで遅くなっている敵
        if(_e.slow > 0){
            ctx.strokeStyle = "rgba(130,90,200,0.8)";
            ctx.setLineDash([3,3]);
            ctx.beginPath(); ctx.arc(_e.x,_e.y,_e.r + 5,0,Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
        }

        //体力ゲージ(硬い敵が傷ついたとき)
        if(_e.maxHp > 1 && _e.hp < _e.maxHp && !_e.boss){
            var w = _e.r*2;
            ctx.fillStyle = "#ddd";
            ctx.fillRect(_e.x - w/2, _e.y - _e.r - 10, w, 4);
            ctx.fillStyle = "#c33";
            ctx.fillRect(_e.x - w/2, _e.y - _e.r - 10, w*_e.hp/_e.maxHp, 4);
        }
    },

    drawPickup:function(_p){
        //消える直前は点滅
        if(_p.life < 120 && Math.floor(_p.life/6) % 2 == 0) return;
        ctx.save();
        ctx.translate(_p.x,_p.y);
        if(_p.kind == "capsule"){
            //報酬カプセル：金色の箱が上下に揺れる
            ctx.translate(0,Math.sin(_p.t*0.1)*3);
            ctx.strokeStyle = "rgba(230,180,34,0.5)";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0,0,15 + Math.sin(_p.t*0.15)*2,0,Math.PI*2); ctx.stroke();
            ctx.lineWidth = 1;
            ctx.fillStyle = "#e6b422";
            ctx.fillRect(-9,-8,18,16);
            ctx.strokeStyle = "#7a5a00";
            ctx.strokeRect(-9.5,-8.5,19,17);
            ctx.fillStyle = "#7a5a00";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("!",0,1);
        }else if(_p.kind == "part"){
            ctx.rotate(_p.t*0.05);
            ctx.fillStyle = "#777";
            ctx.fillRect(-5,-5,10,10);
            ctx.strokeStyle = "#222";
            ctx.strokeRect(-5.5,-5.5,11,11);
            ctx.fillStyle = "#fff";
            ctx.fillRect(-1.5,-1.5,3,3);
        }else{
            //やる気：オレンジの玉が脈打つ
            var s = 1 + Math.sin(_p.t*0.2)*0.08;
            ctx.scale(s,s);
            ctx.fillStyle = "#e07020";
            ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#7a3000";
            ctx.stroke();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("気",0,1);
        }
        ctx.restore();
    },

    drawHud:function(){
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = "#000";

        //耐久
        ctx.fillText("耐久",14,20);
        for(var i=0; i<this.maxHp; i++){
            if(i < this.hp){
                ctx.fillStyle = "#d33";
                ctx.fillRect(56 + i*18,13,14,14);
            }else{
                ctx.strokeStyle = "#999";
                ctx.strokeRect(56.5 + i*18,13.5,13,13);
            }
        }

        //やる気
        ctx.fillStyle = "#000";
        var f0 = ctx.font;
        ctx.font = f0.replace(/[0-9]+px/,"12px");     //3文字なのでゲージにかからないよう小さめに
        ctx.fillText("やる気",13,44);
        ctx.font = f0;
        var bw = 160;
        ctx.strokeStyle = "#000";
        ctx.strokeRect(56.5,37.5,bw,13);
        ctx.fillStyle = this.yaruki >= YARUKI_COST ? "#e07020" : "#aaa";
        ctx.fillRect(58,39,(bw-3)*this.yaruki/YARUKI_MAX,10);
        //衝撃波に必要な量の目盛り
        ctx.fillStyle = "#d33";
        ctx.fillRect(57 + bw*YARUKI_COST/YARUKI_MAX,34,2,20);

        //装備(下のゲージは次の攻撃までの溜まり具合)と発動中のシナジー
        var eq = arms.equipped();
        for(var i=0; i<eq.length; i++){
            var ix = 14 + i*30;
            drawWeaponIcon(eq[i],ix,60,24);
            ctx.fillStyle = "#ddd";
            ctx.fillRect(ix,86,24,3);
            ctx.fillStyle = "#333";
            ctx.fillRect(ix,86,24*Math.max(0,Math.min(1,arms.charge(eq[i]))),3);
        }
        var syn = activeSynergies();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#c33";
        for(var i=0; i<syn.length; i++){
            ctx.fillText("◆" + syn[i].name,24 + eq.length*30,66 + i*16);
        }

        //右上：WAVE・残り・スコア・パーツ
        ctx.textAlign = "right";
        ctx.fillStyle = "#000";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("WAVE " + game.wave + " / " + FINAL_WAVE,CW - 14,20);
        //難易度(WAVEの左に小さく)
        var dw = ctx.measureText("WAVE " + game.wave + " / " + FINAL_WAVE).width;
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = difficulty().color;
        ctx.fillText(difficulty().name,CW - 24 - dw,21);
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText((bossDebug.trial ? "敵 " + enemies.length : "残りの敵 " + (this.toSpawn + enemies.length)) + "　SCORE " + game.score + "　パーツ " + game.parts,CW - 14,44);
        if(this.graze > 0){
            ctx.font = "bold 12px sans-serif";
            ctx.fillStyle = "#3a7bd5";
            ctx.fillText("かすり " + this.graze,CW - 14,64);
        }
        if(this.just > 0){
            ctx.font = "bold 12px sans-serif";
            ctx.fillStyle = "#1a8fb0";
            ctx.fillText("ジャスト " + this.just,CW - 14,80);
        }
        this.drawComboHud();
        timeStop.drawHud();

        //操作のヒント(最初の2WAVEだけ)
        var touch = inputMode == "touch";
        if(game.wave <= 2){
            ctx.textAlign = "left";
            ctx.font = "13px sans-serif";
            ctx.fillStyle = "#777";
            if(touch){
                ctx.fillText("画面のどこでもドラッグで移動（指の動いた分だけ）　／　右下のボタン：衝撃波（やる気" + YARUKI_COST + "・弾を消して近くの敵を攻撃）",14,CH - 36);
            }else{
                ctx.fillText("敵には自動で攻撃します　／　クリック：衝撃波（やる気" + YARUKI_COST + "・弾を消して近くの敵を攻撃）　／　動くと、やる気がたまる",14,CH - 36);
            }
            ctx.fillText("弾は中心の赤い点に当たらなければ大丈夫。すれすれでかすると、やる気がたまる",14,CH - 16);
        }else if(game.wave <= 4 && this.just == 0){
            //操作に慣れたころに、ジャスト衝撃波を教える(一度成功したら消す)
            ctx.textAlign = "left";
            ctx.font = "13px sans-serif";
            ctx.fillStyle = "#777";
            ctx.fillText("弾や突進が当たる直前に衝撃波を出すと「ジャスト」(ぎりぎりほど強い)",14,CH - 16);
        }
        if(touch && this.state != "over") this.drawTouchBlast();
        ctx.fillStyle = "#000";
    },

    //----------------------------------------------------------------- ボスの登場
    //接近中(WARNINGの間)：サイレンをもう一度・地鳴り・小刻みな揺れ
    warningStep:function(){
        var t = this.stateTime;
        if(this.isKaiWave()){ this.kaiHeartStep(t); return; }
        if(t == 1) sound.play("rumble");
        if(t == 75) sound.play("warning");
        if(t < 140) this.shake = Math.max(this.shake, 2 + t/50);
    },
    //ボスが現れた：上の閃光・うなり声・名前の表示を始める(協力プレイのゲストは coop.guestStep から)
    bossArrive:function(){
        if(this.isKaiWave()){ this.kaiArrive(); return; }
        sound.music(null);
        sound.music("boss");
        sound.play("bossAppear");
        fx.flare(CW/2, 0, 260, "255,90,60", 30);
        fx.shake(12);
        this.bossIntro = BOSS_INTRO_TIME;
        this.bossFreeze = true;     //着地するまで、ボスと演出以外は止める
        this.introT = 0;
    },

    //登場：ゴゴゴ(ゆっくり降りる・揺れが強まる・砂ぼこり) → ッ(静止) → ドンっ(一気に落ちて着地)
    //_visual：協力プレイのゲスト。揺れ・砂ぼこり・音だけ(ボスはホストから届いた位置で動き、着地もホストに合わせる)
    bossEntrance:function(_visual){
        var b = null;
        for(var i=0; i<enemies.length; i++) if(enemies[i].boss) b = enemies[i];
        if(this.isKaiWave()){ this.kaiEntrance(b,_visual); return; }
        if(!b && !_visual){ this.bossFreeze = false; return; }
        if(_visual) b = { x:0, y:0 };   //動かさない仮のボス
        var t = ++this.introT;
        var A = BOSS_DESCENT_TIME, H = A + BOSS_HUSH_TIME, S = H + BOSS_SLAM_TIME;
        b.vx = 0; b.vy = 0;
        if(t <= A){
            var k = t/A, e = k*k*(3 - 2*k);
            b.y = -60 + (BOSS_HOVER_Y + 60)*e;
            b.x = CW/2 + (Math.random() - 0.5)*5*k;
            this.shake = Math.max(this.shake, 2 + 8*k);
            //天井から砂ぼこりが落ちる
            if(Math.random() < 0.3 + 0.6*k){
                effects.push({ fall:true, x:Math.random()*CW, y:-4, vx:(Math.random() - 0.5)*0.6, vy:1 + Math.random()*2,
                               life:50, maxLife:50, size:2 + Math.random()*3, color:"#8a8070" });
            }
            if(t == 1) sound.play("rumble");
            if(t == 38) sound.play("rumble");
            if(t == 74) sound.play("rumbleHard");
        }else if(t <= H){
            //ッ：ぴたりと止まる
            b.x = CW/2;
            b.y = BOSS_HOVER_Y - 6*(t - A)/BOSS_HUSH_TIME;   //少し浮き上がって溜める
            this.shake = 0;
        }else if(t < S){
            b.y += (160 - b.y)/(S - t);
        }else if(!_visual){
            b.y = 160;
            b.mode = "idle";
            special.bossLanded(b);
        }
    },

    //------------------------------------------------------------ ドローン君改の登場
    //鼓動(暗闇・ゆっくりなドクン) → 影が浮かぶ → 始動(リレーがカチカチ入る・色づく・光が集まる) → 開幕(点火・閃光・暗闇が晴れる)
    isKaiWave:function(){
        return this.bossWave && bossTypeFor(game.wave) == "kai";
    },
    beat:function(_strong){
        sound.play("heartbeat");
        this.beatT = 24;
        this.shake = Math.max(this.shake, _strong ? 6 : 3);
    },
    //鼓動(WARNINGの代わり)
    kaiHeartStep:function(_t){
        if(_t == 1) sound.stopMusic();
        if(_t >= 20 && _t < KAI_HEART_TIME - 10 && (_t - 20) % KAI_BEAT_EVERY == 0) this.beat(false);
    },
    //ボスが現れた：まだ動かさず、暗闇の中に影を置く
    kaiArrive:function(){
        this.bossFreeze = true;
        this.introT = 0;
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.boss){ e.x = CW/2; e.y = 160; }
        }
    },
    kaiEntrance:function(_b,_visual){
        var t = ++this.introT, A = KAI_APPEAR_TIME, B = A + KAI_BOOT_TIME;
        if(_b && !_visual){ _b.x = CW/2; _b.y = 160; _b.vx = 0; _b.vy = 0; }
        var cx = _b ? _b.x : CW/2, cy = _b ? _b.y : 160;
        if(t == 20) this.beat(true);    //影が浮かぶ途中で、最後の強い鼓動
        if(t == A) sound.play("kaiBoot");
        if(t > A && t < B){
            //始動：揺れが強まり、光が吸い込まれるように集まる
            var k = (t - A)/KAI_BOOT_TIME;
            this.shake = Math.max(this.shake, 1 + 3*k);
            if(t % 3 == 0){
                var a = Math.random()*Math.PI*2, R = 150 + Math.random()*60, sp = 6 + 8*k;
                effects.push({ x:cx + Math.cos(a)*R, y:cy + Math.sin(a)*R, vx:-Math.cos(a)*sp, vy:-Math.sin(a)*sp,
                               life:22, maxLife:22, size:2.5 + 2*k, glow:Math.random() < 0.5 ? "255,60,60" : "120,180,255" });
            }
        }
        //リレーが入る瞬間(音と同じ時刻)：小さく光って揺れる
        if(t >= A && KAI_RELAY_FRAMES.indexOf(t - A) >= 0){
            var kk = Math.min(1, (t - A)/KAI_BOOT_TIME);
            fx.flare(cx, cy, 50 + 40*kk, "255,70,60", 8);
            fx.ring(cx, cy, 55 + 30*kk, "255,110,90", 9, 2);
            this.shake = Math.max(this.shake, 3 + 5*kk);
        }
        if(t >= B && _b && !_visual){
            _b.mode = "idle";
            special.bossLanded(_b);     //ドローン君改は kaiIgnite へ
        }
    },
    //開幕：点火の閃光・衝撃波。暗闇が晴れ、名前を出して戦いが始まる(special.bossLanded から)
    kaiIgnite:function(_e){
        sound.play("kaiIgnite");
        sound.music(null);
        sound.music("boss");
        if(_e.look) _e.look.tint = "190,20,30";
        battleBg.ripple(_e.x, _e.y, 50, 10, 90, "255,70,60");
        fx.flare(_e.x, _e.y, 220, "255,80,70", 26);
        fx.ring(_e.x, _e.y, 300, "255,90,80", 30, 10);
        fx.ring(_e.x, _e.y, 200, "130,190,255", 24, 6);
        fx.sparks(_e.x, _e.y, 40, "255,120,90", 11, 4);
        fx.shake(24);
        this.flashT = FLASH_TIME;
        this.hitStop = 6;
        this.zoomT = ZOOM_TIME; this.zoomX = _e.x; this.zoomY = _e.y;
        this.kaiDark = KAI_DARK_OUT;
        this.bossIntro = BOSS_INTRO_TIME;
        this.bossFreeze = false;
        this.droneIn = DRONE_IN_TIME;
        this.guard = Math.max(this.guard, 60);
        fx.ring(drone.X, drone.Y, 46, "80,160,255", 22, 3);
    },
    //暗闇・鼓動の赤い脈・浮かび上がって色づく影(ゲームの層の一番上に描く)
    drawKaiIntro:function(){
        if(!this.isKaiWave()) return;
        var dark;
        if(this.state == "start") dark = Math.min(1, this.stateTime/60);
        else if(this.bossFreeze) dark = 1;
        else if(this.kaiDark > 0) dark = this.kaiDark/KAI_DARK_OUT;
        else return;
        ctx.fillStyle = "rgba(6,3,10," + (0.9*dark) + ")";
        ctx.fillRect(-20,-20,CW + 40,CH + 40);
        //鼓動：画面のふちが赤く脈打つ
        if(this.beatT > 0){
            var p = this.beatT/24;
            var g = ctx.createRadialGradient(CW/2,CH/2,CH*0.25,CW/2,CH/2,CW*0.65);
            g.addColorStop(0,"rgba(200,10,20,0)");
            g.addColorStop(1,"rgba(200,10,20," + (0.55*p) + ")");
            ctx.fillStyle = g;
            ctx.fillRect(-20,-20,CW + 40,CH + 40);
        }
        if(!this.bossFreeze) return;
        var b = null;
        for(var i=0; i<enemies.length; i++) if(enemies[i].boss) b = enemies[i];
        if(!b || !b.look) return;
        //影：黒から少しずつ赤く(色は8段階。色ごとに絵を作って覚えておくので、細かくしすぎない)
        var t = this.introT, A = KAI_APPEAR_TIME;
        var k = t <= A ? 0 : Math.min(1, (t - A)/KAI_BOOT_TIME);
        var q = Math.round(k*8)/8;
        b.look.tint = Math.round(12 + 178*q) + "," + Math.round(12 + 8*q) + "," + Math.round(16 + 14*q);
        ctx.save();
        ctx.globalAlpha = Math.min(1, t/A);
        //始動中は後ろが赤く光る
        if(k > 0){
            var gl = ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,90 + 60*k);
            gl.addColorStop(0,"rgba(255,60,50," + (0.5*k) + ")");
            gl.addColorStop(1,"rgba(255,60,50,0)");
            ctx.fillStyle = gl;
            ctx.beginPath(); ctx.arc(b.x,b.y,150,0,Math.PI*2); ctx.fill();
        }
        this.drawEnemy(b);
        ctx.restore();
    },

    //「ゴゴゴ」の文字(画面の左右に増えていく。ッの瞬間に消える)
    drawGogogo:function(){
        if(!this.bossFreeze || this.introT > BOSS_DESCENT_TIME || this.isKaiWave()) return;
        var k = this.introT/BOSS_DESCENT_TIME;
        var n = Math.min(6, 1 + Math.floor(k*7));
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        for(var side=0; side<2; side++){
            for(var i=0; i<n; i++){
                var x = side == 0 ? 90 + (i % 2)*38 : CW - 90 - (i % 2)*38;
                var y = 120 + i*62;
                var s = 46 + 10*k + Math.sin(this.clock*0.5 + i)*3;
                ctx.save();
                ctx.translate(x + (Math.random() - 0.5)*3*k, y + (Math.random() - 0.5)*3*k);
                ctx.rotate((side == 0 ? -0.18 : 0.18) + Math.sin(i*1.7)*0.08);
                ctx.font = "900 " + Math.round(s) + "px sans-serif";
                ctx.globalAlpha = 0.55 + 0.4*k;
                ctx.lineWidth = 7;
                ctx.strokeStyle = "#fff";
                ctx.strokeText("ゴ", 0, 0);
                ctx.fillStyle = "#3b1352";
                ctx.fillText("ゴ", 0, 0);
                ctx.restore();
            }
        }
        ctx.restore();
    },
    //かすりの範囲の輪：ふだんは細い点線。かすった瞬間は太く明るく光り、コンボの段階の色になる
    drawGrazeRange:function(){
        var c = COMBO_COLORS[this.comboTier()], k = this.grazeFlash/GRAZE_FLASH_TIME;
        ctx.save();
        if(k > 0){
            ctx.fillStyle = "rgba(" + c + "," + (0.18*k) + ")";
            ctx.beginPath(); ctx.arc(drone.X,drone.Y,GRAZE_RANGE,0,Math.PI*2); ctx.fill();
        }
        ctx.strokeStyle = "rgba(" + c + "," + (0.7 + 0.3*k) + ")";
        ctx.lineWidth = 1.6 + 2*k;
        if(k <= 0) ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.arc(drone.X,drone.Y,GRAZE_RANGE,0,Math.PI*2); ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //かすりコンボの輪：段階の色で回り、途切れるまでの残り時間だけ弧が残る(残りわずかで点滅)
    drawComboAura:function(){
        var tier = this.comboTier(), c = COMBO_COLORS[tier];
        var R = GRAZE_RANGE + 8 + tier*4, k = this.comboT/COMBO_TIME;     //かすりの範囲の輪(GRAZE_RANGE)より外に
        if(k < 0.25 && Math.floor(this.clock/4) % 2 == 0) return;
        ctx.save();
        ctx.lineCap = "round";
        //段階に届いていれば、うっすら光る
        if(tier > 0){
            ctx.fillStyle = "rgba(" + c + "," + (0.08 + tier*0.04) + ")";
            ctx.beginPath(); ctx.arc(drone.X,drone.Y,R + 6,0,Math.PI*2); ctx.fill();
        }
        ctx.strokeStyle = "rgba(" + c + ",0.25)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(drone.X,drone.Y,R,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle = "rgb(" + c + ")";
        ctx.lineWidth = 3 + tier;
        var a0 = -Math.PI/2 + this.clock*0.05*(1 + tier*0.5);
        ctx.beginPath(); ctx.arc(drone.X,drone.Y,R,a0,a0 + Math.PI*2*k); ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //かすりコンボの数字(右上)：数字・威力の上がり分・途切れるまでの残り時間の帯。途切れたらいくつ続いたかを出す
    drawComboHud:function(){
        var x = CW - 14, y = 118;
        ctx.save();
        ctx.textAlign = "right";
        ctx.textBaseline = "alphabetic";
        ctx.lineJoin = "round";
        if(this.combo >= 2){
            var tier = this.comboTier(), c = COMBO_COLORS[tier];
            var sc = 1 + this.comboPop*0.04;
            ctx.save();
            ctx.translate(x - 70, y);
            ctx.scale(sc, sc);
            ctx.font = "italic 900 " + (28 + tier*3) + "px sans-serif";
            ctx.lineWidth = 6;
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.strokeText(this.combo,0,0);
            ctx.fillStyle = "rgb(" + c + ")";
            ctx.fillText(this.combo,0,0);
            ctx.restore();
            ctx.font = "italic 900 15px sans-serif";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.strokeText("COMBO",x,y);
            ctx.fillStyle = "rgb(" + c + ")";
            ctx.fillText("COMBO",x,y);
            ctx.font = "bold 12px sans-serif";
            ctx.fillStyle = "#555";
            ctx.fillText("威力+" + Math.round((this.comboMul() - 1)*100) + "%" + (this.combo >= COMBO_MAX ? "(MAX)" : ""),x,y + 18);
            //次のかすりバーストまで(あと少しなら金色で目立たせる)
            var left = SKILL_EVERY - this.combo % SKILL_EVERY;
            ctx.fillStyle = left <= Math.ceil(SKILL_EVERY/3) ? "rgb(210,140,0)" : "#777";
            ctx.fillText("バーストまで " + left,x,y + 46);
            //途切れるまでの残り時間
            var w = 120, k = this.comboT/COMBO_TIME;
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            ctx.fillRect(x - w, y + 24, w, 4);
            ctx.fillStyle = "rgb(" + c + ")";
            ctx.fillRect(x - w*k, y + 24, w*k, 4);
        }else if(this.comboEnd){
            var e = this.comboEnd;
            ctx.globalAlpha = Math.min(1, e.t/20);
            ctx.font = "italic 900 15px sans-serif";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            var s = e.n + " COMBO" + (e.broke ? "　BREAK" : "");
            ctx.strokeText(s,x,y);
            ctx.fillStyle = e.broke ? "#c33" : "#777";
            ctx.fillText(s,x,y);
        }
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.lineJoin = "miter";
        ctx.fillStyle = "#000";
    },
    //ジャスト衝撃波のゆっくりの間の演出：残像・外へ流れるぶれ・周りが暗く青く・時間の波紋・上下の黒い帯
    //(キャンバスの絵を写し取るので、位置には renderScale を掛ける)
    drawSlowFx:function(){
        var p = this.slowPow, W = canvas.width, H = canvas.height, rs = renderScale;
        if(!this.echo){ this.echo = document.createElement("canvas"); this.echoCtx = this.echo.getContext("2d"); }
        if(this.echo.width != W || this.echo.height != H){ this.echo.width = W; this.echo.height = H; this.echoFresh = true; }
        ctx.save();
        ctx.setTransform(1,0,0,1,0,0);
        //残像：前のコマ(それ自体も残像を含む)を重ねて、動きが尾を引くように
        if(!this.echoFresh){
            ctx.globalAlpha = this.justFx().echo*p;
            ctx.drawImage(this.echo,0,0);
        }
        //ドローン君から外へ流れるぶれ：少し大きくした今のコマを薄く重ねる
        var cx = drone.X*rs, cy = drone.Y*rs;
        ctx.globalAlpha = this.justFx().blur*p;
        for(var i=1; i<=2; i++){
            var s = 1 + 0.025*i*p;
            ctx.setTransform(s,0,0,s,cx*(1 - s),cy*(1 - s));
            ctx.drawImage(canvas,0,0);
        }
        ctx.setTransform(1,0,0,1,0,0);
        this.echoCtx.clearRect(0,0,W,H);
        this.echoCtx.drawImage(canvas,0,0);
        this.echoFresh = false;
        ctx.restore();

        //周りを暗く青く(まんなかのドローン君だけがはっきり見える)
        var g = ctx.createRadialGradient(drone.X,drone.Y,90,drone.X,drone.Y,620);
        g.addColorStop(0,"rgba(20,60,110,0)");
        g.addColorStop(1,"rgba(10,30,60," + (this.justFx().veil*p) + ")");
        ctx.fillStyle = g;
        ctx.fillRect(0,0,CW,CH);
        ctx.fillStyle = "rgba(" + JUST_COLOR + "," + (this.justFx().wash*p) + ")";
        ctx.fillRect(0,0,CW,CH);
        //時間の波紋：ドローン君からゆっくり広がる輪(実際の時間で広がる)
        var t = JUST_SLOW_TIME - this.justSlow;
        ctx.lineWidth = 2;
        for(var i=0; i<3; i++){
            var ph = (t*2.2 + i*110) % 330;
            ctx.strokeStyle = "rgba(255,255,255," + ((1 - ph/330)*0.5*p) + ")";
            ctx.beginPath(); ctx.arc(drone.X,drone.Y,30 + ph,0,Math.PI*2); ctx.stroke();
        }
        ctx.lineWidth = 1;
        //上下の黒い帯(映画のように)
        var bh = 34*p;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(0,0,CW,bh);
        ctx.fillRect(0,CH - bh,CW,bh);
        ctx.fillStyle = "#000";
    },
    //ジャスト衝撃波の「JUST!」(大きく出てぎゅっと縮み、光の線が横に走る)
    drawJust:function(){
        if(this.justT <= 0) return;
        var age = JUST_TEXT_TIME - this.justT;
        var sc = age < 5 ? 2.2 - age*0.24 : 1;
        var a = Math.min(1, this.justT/12);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(this.justX, this.justY - Math.max(0, age - 20)*0.4);
        //横に走る光の線(出た瞬間に広がる)
        var w = 40 + Math.min(1, age/8)*110;
        ctx.fillStyle = "rgba(" + JUST_COLOR + "," + (0.5*a) + ")";
        ctx.fillRect(-w, -2, w*2, 4);
        ctx.scale(sc, sc);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "italic 900 34px sans-serif";
        ctx.lineJoin = "round";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(10,30,50,0.9)";
        var word = this.justPerfect === false ? "JUST" : "PERFECT!";      //少し早いと小さく「JUST」
        if(this.justPerfect === false) ctx.scale(0.8,0.8);
        ctx.strokeText(word,0,0);
        ctx.fillStyle = age < 3 ? "#fff" : "rgb(" + JUST_COLOR + ")";
        ctx.fillText(word,0,0);
        //下に小さく、得たもの(やる気・はね返した数・そのうち当たった数。当たるたびに数が増える)
        if(age >= 4){
            var sub = "やる気+" + this.justYaruki + (this.justRamN > 0 ? "　カウンター" + (this.justRamN > 1 ? "×" + this.justRamN : "") : "")
                    + (this.justN > 0 ? "　反射×" + this.justN : "")
                    + (this.justN + this.justRamN > 0 ? "　命中 " + this.justHits : "");
            ctx.font = "bold 14px sans-serif";
            ctx.lineWidth = 5;
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.strokeText(sub,0,28);
            ctx.fillStyle = "#1a7fa0";
            ctx.fillText(sub,0,28);
        }
        ctx.restore();
        ctx.lineJoin = "miter";
        ctx.lineWidth = 1;
        ctx.fillStyle = "#000";
    },
    //着地の「ドンッ!!」(ぽんと大きく出て、少し縮んで、消える)
    drawDon:function(){
        if(this.donT <= 0) return;
        var age = DON_TIME - this.donT;
        var sc = age < 6 ? 1.4 - age*0.07 : 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.donT/12);
        ctx.translate(this.donX, this.donY);
        ctx.rotate(-0.08);
        ctx.scale(sc, sc);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 110px sans-serif";
        ctx.lineJoin = "round";
        ctx.lineWidth = 16;
        ctx.strokeStyle = "#c22";
        ctx.strokeText("ドンッ!!", 0, 0);
        ctx.lineWidth = 7;
        ctx.strokeStyle = "#fff";
        ctx.strokeText("ドンッ!!", 0, 0);
        ctx.fillStyle = "#111";
        ctx.fillText("ドンッ!!", 0, 0);
        ctx.restore();
    },

    //接近の警告：暗くなる画面・赤く脈打つ四隅・流れる危険表示の帯・ぶれる WARNING
    drawBossWarning:function(){
        var t = this.stateTime, fade = Math.min(1, (150 - t)/20, t/10);
        var pulse = 0.5 + 0.5*Math.sin(t*0.25);
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.fillStyle = "rgba(0,0,0," + 0.28*Math.min(1, t/40) + ")";
        ctx.fillRect(0,0,CW,CH);
        var g = ctx.createRadialGradient(CW/2,CH/2,CH*0.35,CW/2,CH/2,CW*0.62);
        g.addColorStop(0,"rgba(220,20,20,0)");
        g.addColorStop(1,"rgba(220,20,20," + (0.25 + 0.3*pulse) + ")");
        ctx.fillStyle = g;
        ctx.fillRect(0,0,CW,CH);
        //帯
        var top = CH/2 - 118, h = 112;
        ctx.fillStyle = "rgba(150,10,15," + (0.75 + 0.15*pulse) + ")";
        ctx.fillRect(0,top,CW,h);
        this.hazard(top - 14, t);
        this.hazard(top + h, -t);
        //WARNING(赤い残像が横にぶれる)
        var jx = (Math.random() - 0.5)*(t % 20 < 3 ? 10 : 2);
        var sc = 1 + 0.05*pulse;
        ctx.translate(CW/2, top + 44);
        ctx.scale(sc, sc);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 64px serif";
        ctx.fillStyle = "rgba(255,60,60,0.7)";
        ctx.fillText("WARNING", jx - 5, 0);
        ctx.fillStyle = "rgba(255,200,60,0.5)";
        ctx.fillText("WARNING", jx + 5, 0);
        ctx.fillStyle = "#fff";
        ctx.fillText("WARNING", jx, 0);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 18px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.fillText("WAVE " + game.wave + "　ボス「" + BOSS_TYPES[bossTypeFor(game.wave)].name + "」接近中",CW/2,top + 92);
        ctx.restore();
    },
    //黄色と黒の斜めじまの帯(_shift で流れる)
    hazard:function(_y,_shift){
        ctx.save();
        ctx.beginPath(); ctx.rect(0,_y,CW,14); ctx.clip();
        ctx.fillStyle = "#f2c200";
        ctx.fillRect(0,_y,CW,14);
        ctx.fillStyle = "#111";
        var off = ((_shift*2) % 28 + 28) % 28;
        for(var x=-28; x<CW + 28; x+=28){
            ctx.beginPath();
            ctx.moveTo(x + off,_y + 14); ctx.lineTo(x + off + 14,_y); ctx.lineTo(x + off + 28,_y); ctx.lineTo(x + off + 14,_y + 14);
            ctx.fill();
        }
        ctx.restore();
    },

    //登場：上下の黒い帯と、左から滑り込む名前(英語名・異名)
    drawBossIntro:function(){
        if(this.bossIntro <= 0) return;
        var T = BOSS_TYPES[bossTypeFor(game.wave)];
        var age = BOSS_INTRO_TIME - this.bossIntro;
        var inK = Math.min(1, age/18), outK = Math.min(1, this.bossIntro/24);
        var k = Math.min(inK, outK);
        var bar = 40*k;
        ctx.fillStyle = "#000";
        ctx.fillRect(0,0,CW,bar);
        ctx.fillRect(0,CH - bar,CW,bar);
        //名前
        var e = 1 - Math.pow(1 - Math.min(1, age/28), 3);  //すっと止まる
        var x = -320 + (GS*2 + 320)*e;
        var y = CH - 150;
        ctx.save();
        ctx.globalAlpha = outK;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "#c22";
        ctx.fillText(T.en || "", x + 4, y - 44);
        ctx.font = "900 54px serif";
        ctx.lineJoin = "round";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.strokeText(T.name, x, y);
        ctx.fillStyle = "#111";
        ctx.fillText(T.name, x, y);
        ctx.lineJoin = "miter";
        //名前の下に伸びる赤い線と異名
        var w = 380*Math.min(1, Math.max(0, (age - 12)/24));
        ctx.fillStyle = "#c22";
        ctx.fillRect(x, y + 34, w, 4);
        ctx.font = "bold 17px sans-serif";
        ctx.fillStyle = "#333";
        ctx.globalAlpha = outK*Math.min(1, Math.max(0, (age - 24)/16));
        ctx.fillText("―― " + (T.title || ""), x + 6, y + 58);
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#000";
    },

    drawBanner:function(){
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if(this.state == "start" && this.bossWave){
            if(!this.isKaiWave()) this.drawBossWarning();   //ドローン君改は暗闇と鼓動(drawKaiIntro)
        }else if(this.state == "start"){
            ctx.globalAlpha = Math.min(1, (60 - this.stateTime)/20);
            ctx.font = "bold 56px serif";
            ctx.fillStyle = "#000";
            ctx.fillText("WAVE " + game.wave,CW/2,CH/2 - 60);
            ctx.globalAlpha = 1;
        }else if(this.state == "clear"){
            ctx.font = "bold 56px serif";
            ctx.fillStyle = "#000";
            ctx.fillText("WAVE CLEAR！",CW/2,CH/2 - 60);
            ctx.font = "bold 20px sans-serif";
            ctx.fillText("クリアボーナス　パーツ+" + this.bonus,CW/2,CH/2 - 10);
        }
    }
};
