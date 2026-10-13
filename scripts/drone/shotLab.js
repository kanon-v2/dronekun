//------------------------------------------------------------------------------
//  敵の攻撃の試作(いろいろな動きの弾・範囲攻撃・バケツ・雨・岩投げ)と、敵の能力の試作(迎撃)
//  弾：SHOT_KINDS に種類を足し、動き(step)と絵(draw)をここに持つ。mainScreen.updateShots・draw から呼ぶ。
//  弾でない攻撃(範囲攻撃 zones・バケツ buckets・雨雲 storm)もここで動かして描く(update・drawUnder・drawOver)。
//  迎撃：e.intercept を持つ敵は、近くへ飛んできたドローン君の弾を撃ち落とす(enemyStep。mainScreen.updateEnemies から)。
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
//雨攻撃：天候を操り、雨雲を呼んで硫酸の雨を降らせる。雲はドローン君の上へゆっくりついてくるので、雲の下から逃げる
const RAIN_TIMES    = { gather:80, rain:240, clear:50 };   //雲が集まる・雨が降る・晴れる長さ(フレーム)
const RAIN_Y        = 44;       //雲のまんなかの高さ(px)
const RAIN_W        = 300;      //雲の幅(この幅に雨が降る。px)
const RAIN_DRIFT    = 1.1;      //雲がついてくる速さの上限(px/フレーム)
const RAIN_RATE     = 0.8;      //1フレームに降る雨粒の数(danmaku() を掛ける。端数は確率)
const RAIN_SPEED    = 3.4;      //雨粒の落ちる速さ(danmaku() を掛ける)
const RAIN_WIND     = 0.8;      //風で雨粒が横へ流れる速さの最大(px/フレーム。ゆっくり向きが変わる)
const RAIN_DARK     = 0.3;      //雨の間、画面を暗くする濃さ(0～1)
const RAIN_BOLT     = [60,120]; //稲光の間隔(フレーム。見た目だけ)
const PUDDLE_LIFE   = 40;       //床に落ちた雨粒が、じゅっと煙を上げて消えるまで(フレーム。見た目だけ)
//岩投げ：大きな岩を山なりに投げ、投げたときのドローン君の位置を通って落とす。床で砕けて破片が飛び散る
const ROCK_GRAVITY  = 0.11;     //岩・破片が下へ引かれる強さ(px/フレーム²。danmaku() を掛ける)
const ROCK_RISE     = 55;       //投げた岩が投げた所より上がる高さ(px。画面の上から出ないように)
const ROCK_SPIN     = 0.08;     //岩の回る速さ(ラジアン/フレーム)
const ROCK_PIECES   = 6;        //床で砕けたときの破片の数
const ROCK_PIECE_SPEED = 2.8;   //破片の飛び散る速さ(danmaku() を掛ける)
//打ち上げ花火：玉(弾 shell)を打ち上げ、ドローン君の近くで開いて星(弾 star)を散らす。打ち上げる向きは下からに限らない
//玉は減速しながら開く所へ向かう(開く所には薄い印)。開いた星の動きは種類ごとに違う
//見た目：星は球の表面に並べて画面へ映す(平らな輪でなく、立体の菊に見える。手前の星ほど明るい)。
//光は重ねるほど明るくなる描き方(lighter)でにじませ、花火が上がっている間は画面を少し夜の色にして映えさせる
const FW_RISE       = 48;       //玉が開くまで(フレーム)
const FW_BURST_DIST = [80,140]; //開く所の、ドローン君からの距離(px。玉の来た側にずらす)
//種類ごと：n 星の数(danmaku() で最大1.5倍)・speed 広がる速さ・drag 1フレームごとに速さに掛ける・g 重さ・life 消えるまで(フレーム)
//colors 色(牡丹は 開いたとき→変わったあと、柳は 開いたとき→消える前)・tail 尾に覚える位置の数・tstep 尾の位置を覚える間隔(px。0 は毎フレーム)
const FW_TYPES = {
    //牡丹(芯入り)：外の球は途中で色が変わり、内側に別の色の小さな芯の球
    botan:   { n:34, speed:2.7, drag:0.972, g:0.012, life:105, colors:["255,95,150","185,140,255"], tail:5, tstep:0,
               core:{ n:14, speed:0.42, color:"110,230,255" } },
    //柳：金色の長い尾を引き、すぐ勢いが落ちて、しだれるように垂れ下がる。色は金から琥珀へ
    yanagi:  { n:26, speed:2.8, drag:0.955, g:0.03, life:180, colors:["255,214,130","215,120,40"], tail:14, tstep:4 },
    //花雷：銀の小玉を散らし、それぞれが少しあとに「ぱちっ」とはじける(はじけた所は少しのあいだ当たる)
    hanarai: { n:22, speed:2.6, drag:0.95, g:0.01, life:200, fuse:[22,60], colors:["225,232,255"], tail:3, tstep:0 },
    //型物：星がドローン君の形に並び、少し止まってから落ちていく
    kata:    { n:0, speed:0, drag:0.9, g:0, life:120, hold:50, colors:["120,220,255","255,230,90","255,120,190"], tail:4, tstep:0 }
};
const FW_POP_R      = 11;       //花雷のはじけた大きさ(当たり判定。px)
const FW_POP_T      = 8;        //花雷のはじけている長さ(フレーム)
const FW_NIGHT      = 0.42;     //花火の間、画面を夜の色にする濃さ(0～1)
const FW_FADE       = 28;       //星が消える前に瞬きながら薄くなる長さ(フレーム)
const FW_KATA_SCALE = 5.5;      //型物の大きさ(形の1目盛りのpx)
const FW_KATA_FALL  = 0.03;     //型物が止まったあと、落ちていく重さ(px/フレーム²)
//型物の形：ドローン君(目盛り。0が開く所。[x, y, 色の番号])
const FW_KATA_SHAPE = (function(){
    var p = [];
    //胴体(角の丸い箱)のふち
    for(var x=-9; x<=9; x+=2.25){ p.push([x,-3,0]); p.push([x,9,0]); }
    for(var y=-0.6; y<=6.6; y+=2.4){ p.push([-10.5,y,0]); p.push([10.5,y,0]); }
    //目
    p.push([-4,2.5,1]); p.push([4,2.5,1]); p.push([-4,4.2,1]); p.push([4,4.2,1]);
    //プロペラの棒と羽
    p.push([0,-5,2]); p.push([0,-7,2]);
    for(var x=-9; x<=9; x+=3) p.push([x,-9,2]);
    return p;
})();
//2つの色("r,g,b")を _k(0～1)の割合で混ぜる
function fwMix(_c1,_c2,_k){
    var a = _c1.split(","), b = _c2.split(","), k = Math.max(0, Math.min(1, _k));
    return Math.round(+a[0] + (b[0] - a[0])*k) + "," + Math.round(+a[1] + (b[1] - a[1])*k) + "," + Math.round(+a[2] + (b[2] - a[2])*k);
}
//球の表面に _n 個を均等に並べた _i 番目の向き(ひまわりの種の並べ方)を、画面へ映して _rot 回したもの [x, y, 手前ほど1]
function fwSphere(_i,_n,_rot){
    var y = 1 - 2*(_i + 0.5)/_n, r = Math.sqrt(1 - y*y), th = _i*2.39996 + _rot;
    var x = Math.cos(th)*r, z = Math.sin(th)*r, c = Math.cos(_rot), s = Math.sin(_rot);
    return [x*c - y*s, x*s + y*c, z];
}

//迎撃(攻撃ではなく敵の能力)：まわりへ飛んできたドローン君の弾を撃ち落とす。撃ち落とせる数には限りがある
//撃ち落とせるのは、飛んでいく弾(機関銃・ミサイル・水鉄砲・冷凍・重力弾)。レーザー・電撃・狙撃はすぐ届くので落とせない
const INTERCEPT_PER_SEC = 3;    //1秒に撃ち落とせる数(処理能力)
const INTERCEPT_RANGE   = 150;  //撃ち落とす範囲(敵の中心から。px)

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
SHOT_KINDS.acid     = { r:2.5 };    //硫酸の雨粒(明るい黄緑の筋)
SHOT_KINDS.rock     = { r:13 };     //投げた岩(茶色がかった灰色)
SHOT_KINDS.pebble   = { r:4 };      //岩の破片
SHOT_KINDS.shell    = { r:5 };      //花火の玉(光る頭と火の粉の尾)
SHOT_KINDS.star     = { r:3.5 };    //花火の星(色は種類ごと。花雷ははじけると大きくなる)

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
        { id:"bucket", name:"バケツ",       note:"液体を注ぎ、しずくが垂れる。床でしぶきが飛ぶ" },
        { id:"rain",   name:"雨攻撃",       note:"雨雲を呼んで硫酸の雨。雲はついてくるので下から逃げる" },
        { id:"rock",   name:"岩投げ",       note:"山なりに岩が落ちてくる(赤い印)。床で砕けて破片が飛ぶ" },
        { id:"botan",  name:"花火：牡丹",   note:"まんまるに開き、途中で色が変わる" },
        { id:"yanagi", name:"花火：柳",     note:"金色の尾を引いて、しだれ落ちる" },
        { id:"hanarai", name:"花火：花雷",  note:"散った玉が、少しあとにぱちっとはじける" },
        { id:"kata",   name:"花火：型物",   note:"ドローン君の形に開き、止まってから落ちる" },
        { id:"intercept", name:"迎撃(能力)", note:"近づいた弾を撃ち落とす(1秒に" + INTERCEPT_PER_SEC + "発まで)。数で押し切る" }
    ],
    zones:[],       //範囲攻撃 { shape:"circle"|"band", x, y, r, w, h, t }
    buckets:[],     //バケツ { x, y, side, mode, t, tilt, pour, seq, drop }
    pourSeq:0,      //液体の流れの番号(同じ流れの粒を糸でつなぐ)
    storm:null,     //雨雲 { x, mode, t, wind, bolt, flash }(1つだけ)
    puddles:[],     //床に落ちた雨粒の煙(見た目だけ){ x, t }
    night:0,        //花火の間の夜の色の濃さ(0～1)

    //試作の攻撃を全部消す(WAVEの始め・クリア・攻撃の試作で次の種類へ移るとき)
    clear:function(){
        this.zones = [];
        this.buckets = [];
        this.storm = null;
        this.puddles = [];
        this.night = 0;
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
    //雨雲を呼ぶ(_x：雲が集まり始める所)
    rain:function(_x){
        this.storm = { x:_x, mode:"gather", t:0, wind:Math.random()*Math.PI*2, bolt:randIn(RAIN_BOLT), flash:0 };
        sound.play("rumble");
    },
    //雲の濃さ(0：晴れ ～ 1：雨)
    stormK:function(){
        var S = this.storm;
        if(!S) return 0;
        if(S.mode == "gather") return Math.min(1, S.t/RAIN_TIMES.gather);
        if(S.mode == "clear") return Math.max(0, 1 - S.t/RAIN_TIMES.clear);
        return 1;
    },
    //岩を投げる：(_x,_y)から、(_tx,_ty)を通る山なりで投げる(上がる高さは ROCK_RISE まで)
    throwRock:function(_x,_y,_tx,_ty){
        var g = ROCK_GRAVITY*danmaku();
        var vy0 = -Math.sqrt(2*g*ROCK_RISE);
        var dy = Math.max(_ty - _y, -ROCK_RISE*0.9);
        var T = (-vy0 + Math.sqrt(vy0*vy0 + 2*g*dy))/g;      //着くまでのフレーム数
        //動きは「速さに重力を足してから進む」順なので、はじめの速さを g/2 だけ上へずらすと、ちょうど (_tx,_ty) を通る
        var b = this.fire(_x, _y, 0, 0, "rock", { g:g, eta:Math.round(T), tx:_tx, ty:_ty, seed:Math.floor(Math.random()*1000) });
        b.vx = (_tx - _x)/T;
        b.vy = vy0 - g/2;
        return b;
    },
    //花火を打ち上げる(_type：FW_TYPES の名前。(_x,_y)から、ドローン君の近くの玉の来た側へ)
    firework:function(_type,_x,_y){
        var tg = nearestPlayer(_x,_y);
        var a = Math.atan2(_y - tg.Y, _x - tg.X) + (Math.random() - 0.5)*1.4;
        var d = randIn(FW_BURST_DIST);
        var tx = Math.max(40, Math.min(CW - 40, tg.X + Math.cos(a)*d));
        var ty = Math.max(40, Math.min(CH - 60, tg.Y + Math.sin(a)*d));
        //速さが一定の割合で落ちて、FW_RISE フレームでちょうど開く所に着く(距離 = はじめの速さ×FW_RISE/2)
        var dist = Math.hypot(tx - _x, ty - _y);
        var b = this.fire(_x, _y, Math.atan2(ty - _y, tx - _x), 2*dist/FW_RISE, "shell", { fw:_type, tx:tx, ty:ty, eta:FW_RISE });
        b.v0 = b.base;
        b.ux = (tx - _x)/(dist || 1); b.uy = (ty - _y)/(dist || 1);
        sound.play("fwLaunch");
        return b;
    },
    //玉が開く：種類ごとの星を散らす
    fwBurst:function(b){
        var F = FW_TYPES[b.fw] || FW_TYPES.botan, m = danmaku(), x = b.x, y = b.y;
        var col = F.colors[0];
        var self = this;
        //星を1つ出す(_ox,_oy：広がる向きと速さ、_z：手前ほど1・奥ほど-1)
        var star = function(_ox,_oy,_z,_ex){
            var ex = { fw:b.fw, life:F.life, drag:F.drag, g:F.g, col:col, z:_z, trail:[], tail:F.tail, tstep:F.tstep };
            for(var k in _ex) ex[k] = _ex[k];
            var s = self.fire(x, y, 0, 0, "star", ex);
            s.vx = _ox; s.vy = _oy;
            return s;
        };
        if(b.fw == "kata"){
            //型物：形の点へ向かって飛び、ちょうどそこで止まるように(進む前に抵抗 drag が掛かるので、進む距離の合計 = はじめの速さ×drag/(1-drag))
            for(var i=0; i<FW_KATA_SHAPE.length; i++){
                var P = FW_KATA_SHAPE[i], k = (1 - F.drag)/F.drag;
                star(P[0]*FW_KATA_SCALE*k, P[1]*FW_KATA_SCALE*k, 1, { life:F.life + F.hold, hold:F.hold, col:F.colors[P[2]] });
            }
        }else{
            var n = Math.round(F.n*Math.min(1.5, m)), rot = Math.random()*Math.PI*2;
            var sphere = function(_n,_speed,_ex){
                for(var i=0; i<_n; i++){
                    var p = fwSphere(i, _n, rot);
                    var sp = _speed*(b.fw == "hanarai" ? 0.6 + Math.random()*0.5 : 0.96 + Math.random()*0.08);
                    var ex = {};
                    for(var k in _ex) ex[k] = _ex[k];
                    if(b.fw == "hanarai") ex.fuse = randIn(F.fuse);
                    star(p[0]*sp, p[1]*sp, p[2], ex);
                }
            };
            sphere(n, F.speed*m, {});
            //牡丹の芯：内側に別の色の小さな球(色は変わらない)
            if(F.core) sphere(Math.round(F.core.n*Math.min(1.5, m)), F.speed*m*F.core.speed, { col:F.core.color, core:true });
        }
        //開いた瞬間の白い光と、まんなかの火花
        fx.flare(x, y, 70, "255,245,225", 9);
        fx.flare(x, y, 42, col, 16);
        fx.sparks(x, y, 12, "255,240,200", 2.2, 1.5);
        battleBg.ripple(x, y, 8, 5, 30, col);
        sound.play("fwBurst");
    },
    //尾にする位置を覚える(b.tail 個まで。b.tstep px 動くごと、0 なら毎フレーム)
    fwTrail:function(b){
        var T = b.trail;
        if(!T || !b.tail) return;
        if(T.length >= 2 && b.tstep && Math.hypot(b.x - T[0], b.y - T[1]) < b.tstep) return;
        T.unshift(b.x, b.y);
        if(T.length > b.tail*2) T.length = b.tail*2;
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
        if(this.storm) this.stormStep(this.storm);
        //花火が上がっている間は、だんだん夜の色に(なくなったらゆっくり戻る)
        var fw = enemyShots.some(function(b){ return b.kind == "shell" || b.kind == "star"; });
        this.night = Math.max(0, Math.min(1, this.night + (fw ? 0.04 : -0.012)));
        for(var i=this.puddles.length-1; i>=0; i--){ if(++this.puddles[i].t >= PUDDLE_LIFE) this.puddles.splice(i,1); }
    },
    stormStep:function(S){
        S.t++;
        if(S.flash > 0) S.flash--;
        //雲はドローン君の上へゆっくりついてくる(逃げれば振り切れる速さ)
        var tg = nearestPlayer(S.x, RAIN_Y);
        S.x += Math.max(-RAIN_DRIFT, Math.min(RAIN_DRIFT, (tg.X - S.x)*0.02));
        S.x = Math.max(RAIN_W*0.3, Math.min(CW - RAIN_W*0.3, S.x));
        S.wind += 0.01;
        var T = RAIN_TIMES;
        switch(S.mode){
            case "gather":
                if(S.t >= T.gather){ S.mode = "rain"; S.t = 0; S.flash = 8; sound.play("shatter"); }
                break;
            case "rain":
                //雲の下から硫酸の雨(風で少し斜めに)
                var m = danmaku(), n = RAIN_RATE*m;
                n = Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0);
                var wind = Math.sin(S.wind)*RAIN_WIND;
                for(var i=0; i<n; i++){
                    var x = S.x + (Math.random() - 0.5)*RAIN_W;
                    var sp = RAIN_SPEED*m*(0.85 + Math.random()*0.3);
                    this.fire(x, RAIN_Y + 18 + Math.random()*10, Math.atan2(sp, wind), Math.hypot(sp, wind), "acid");
                }
                //ときどき稲光(見た目と音だけ)
                if(--S.bolt <= 0){ S.bolt = randIn(RAIN_BOLT); S.flash = 8; sound.play("shatter"); }
                if(S.t >= T.rain){ S.mode = "clear"; S.t = 0; }
                break;
            case "clear":
                if(S.t >= T.clear) this.storm = null;
                break;
        }
    },

    //敵ごとの試作の能力(mainScreen.updateEnemies から)。true ならその敵のふだんの動きをしない
    enemyStep:function(e){
        if(e.intercept) this.interceptStep(e);
        if(e.lab){
            //攻撃の試作の的：砲台の位置にいて動かない。当たった数を数えて、体力は減らさない
            e.x = this.labX; e.y = 70; e.vx = 0; e.vy = 0;
            if(e.hp < e.maxHp){ this.labHits++; e.hp = e.maxHp; }
            return true;
        }
        return false;
    },
    //迎撃：範囲に入ったドローン君の弾のうち、いちばん近いものを撃ち落とす(1秒に INTERCEPT_PER_SEC 発まで)
    interceptStep:function(e){
        var I = e.intercept;
        if(I.zap > 0) I.zap--;
        if(I.cd > 0){ I.cd--; return; }
        var lists = [arms.bullets, arms.missiles, arms.drops, arms.shards, arms.wells];
        var best = INTERCEPT_RANGE, pick = null, from = null;
        for(var j=0; j<lists.length; j++){
            for(var i=0; i<lists[j].length; i++){
                var p = lists[j][i];
                if(p.just || p.open) continue;      //ジャストではね返した弾・かすりバーストの星・開いた渦は落とせない
                var d = Math.hypot(p.x - e.x, p.y - e.y);
                if(d < best){ best = d; pick = p; from = lists[j]; }
            }
        }
        if(!pick) return;
        from.splice(from.indexOf(pick), 1);
        I.cd = Math.round(60/INTERCEPT_PER_SEC);
        I.zap = 8;
        I.ang = Math.atan2(pick.y - e.y, pick.x - e.x);
        fx.line(e.x + Math.cos(I.ang)*e.r, e.y + Math.sin(I.ang)*e.r, pick.x, pick.y, "255,70,60", 2.5, 8);
        fx.sparks(pick.x, pick.y, 5, "255,170,60", 3, 2);
        sound.play("block");
        if(bossDebug.lab) this.labShot++;
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
            case "acid":
                //床に落ちたら、じゅっと煙を上げて消える
                if(b.y > CH - 3){
                    if(this.puddles.length < 60) this.puddles.push({ x:b.x, t:0 });
                    return true;
                }
                break;
            case "shell":
                //減速しながら開く所へ。着いたら開く
                var s = b.v0*Math.max(0, 1 - (b.t - 0.5)/FW_RISE);
                b.vx = b.ux*s; b.vy = b.uy*s;
                //昇る間：細い光の尾と、ときどきこぼれる火の粉
                if(!b.trail){ b.trail = []; b.tail = 10; b.tstep = 0; }
                this.fwTrail(b);
                if(b.t % 3 == 0) effects.push({ x:b.x, y:b.y, vx:(Math.random() - 0.5)*0.5, vy:(Math.random() - 0.5)*0.5 + 0.3,
                                                life:16, maxLife:16, size:1.4, glow:"255,200,130" });
                if(b.t >= FW_RISE){ this.fwBurst(b); return true; }
                break;
            case "star":
                if(b.pop > 0){
                    //花雷：はじけている間はその場で大きくなり、終わったら消える
                    b.vx = 0; b.vy = 0;
                    b.r = FW_POP_R*(1 - 0.3*(1 - b.pop/FW_POP_T));
                    if(--b.pop <= 0) return true;
                    break;
                }
                this.fwTrail(b);
                b.vx *= b.drag || 1; b.vy *= b.drag || 1;
                if(b.hold > 0) b.hold--;
                else b.vy += b.fw == "kata" ? FW_KATA_FALL : (b.g || 0);
                if(b.fuse > 0 && --b.fuse <= 0){
                    b.pop = FW_POP_T;
                    b.trail = null;
                    fx.flare(b.x, b.y, 26, "255,250,225", 7);
                    fx.sparks(b.x, b.y, 4, "255,235,180", 2.5, 1.2);
                    sound.play("fwPop");
                    break;
                }
                if(--b.life <= 0){
                    //消えぎわに小さな火の粉を残す(余韻)
                    if(Math.random() < 0.5) effects.push({ x:b.x, y:b.y, vx:b.vx*0.3, vy:b.vy*0.3 + 0.2, life:18, maxLife:18, size:1.3, glow:b.col || "255,230,200" });
                    return true;
                }
                break;
            case "rock":
            case "pebble":
                b.vy += b.g || ROCK_GRAVITY;
                if(b.y <= CH - b.r) break;
                if(b.kind == "pebble"){ burst(b.x, CH - 3, 2, "#8a7f74"); return true; }
                //岩は床で砕け、破片が上へ飛び散る
                var m = danmaku();
                for(var i=0; i<ROCK_PIECES; i++){
                    var a = -Math.PI/2 + (i/(ROCK_PIECES - 1) - 0.5)*2.2 + (Math.random() - 0.5)*0.3;
                    this.fire(b.x, CH - 6, a, ROCK_PIECE_SPEED*m*(0.7 + Math.random()*0.5), "pebble",
                              { g:b.g, seed:Math.floor(Math.random()*1000) });
                }
                burst(b.x, CH - 4, 8, "#7a6e64");
                fx.shake(4);
                battleBg.ripple(b.x, CH - 4, 10, 5, 30, "160,140,120");
                sound.play("explode");
                return true;
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
            case "acid":
                //落ちる向きに伸びる、明るい黄緑の筋(ふちは濃い緑)
                var L = Math.min(12, 3 + sp*2);
                var tx = b.x - b.vx/(sp || 1)*L, ty = b.y - b.vy/(sp || 1)*L;
                ctx.lineCap = "round";
                ctx.strokeStyle = "#3c5a10"; ctx.lineWidth = r*2 + 1.5;
                ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(b.x,b.y); ctx.stroke();
                ctx.strokeStyle = "#c8f03c"; ctx.lineWidth = r*2 - 0.5;
                ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(b.x,b.y); ctx.stroke();
                ctx.lineCap = "butt"; ctx.lineWidth = 1;
                ctx.fillStyle = "#f4ffc8";
                ctx.beginPath(); ctx.arc(b.x,b.y,r*0.6,0,Math.PI*2); ctx.fill();
                return true;
            case "shell":
                //細い光の尾を引いて昇る、にじむ頭(火の粉は effects で出す)
                ctx.globalCompositeOperation = "lighter";
                if(b.trail && b.trail.length >= 2) this.fwTail(b, "255,190,110", 0.7, 2.6);
                ctx.fillStyle = "rgba(255,190,110,0.22)";
                ctx.beginPath(); ctx.arc(b.x,b.y,r*2.6,0,Math.PI*2); ctx.fill();
                ctx.globalCompositeOperation = "source-over";
                ctx.fillStyle = "#ffb45a";
                ctx.beginPath(); ctx.arc(b.x,b.y,r,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#fffbe8";
                ctx.beginPath(); ctx.arc(b.x,b.y,r*0.55,0,Math.PI*2); ctx.fill();
                return true;
            case "star":
                this.drawStar(b, r, now);
                return true;
            case "rock":
            case "pebble":
                this.drawRock(b.x, b.y, r, now*ROCK_SPIN*(b.kind == "rock" ? 1 : 3) + (b.seed || 0), b.seed || 0, b.kind == "rock");
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
        //雨雲の間は画面が暗くなる。集まっている間は、これから降る所に細い雨の筋(当たらない)
        var K = this.stormK();
        if(K > 0){
            var S = this.storm;
            ctx.fillStyle = "rgba(28,38,24," + (RAIN_DARK*K) + ")";
            ctx.fillRect(0,0,CW,CH);
            if(S.mode == "gather"){
                ctx.strokeStyle = "rgba(200,240,60," + (0.35*K) + ")"; ctx.lineWidth = 1;
                ctx.beginPath();
                for(var i=0; i<14; i++){
                    var x = S.x - RAIN_W/2 + (i + 0.5)*RAIN_W/14, y = RAIN_Y + 20 + ((S.t*6 + i*97) % (CH - RAIN_Y));
                    ctx.moveTo(x,y); ctx.lineTo(x + Math.sin(S.wind)*3, y + 14);
                }
                ctx.stroke();
            }
        }
        //花火の間は夜の色(光が映えるように)
        if(this.night > 0){
            ctx.fillStyle = "rgba(14,16,44," + (FW_NIGHT*this.night) + ")";
            ctx.fillRect(0,0,CW,CH);
        }
        //床に落ちた雨粒：じゅっと泡立って煙が上がる
        for(var i=0; i<this.puddles.length; i++){
            var P = this.puddles[i], k = P.t/PUDDLE_LIFE;
            ctx.fillStyle = "rgba(160,210,40," + (0.6*(1 - k)) + ")";
            ctx.beginPath(); ctx.ellipse(P.x, CH - 1, 4 + k*5, 2, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(220,235,190," + (0.5*(1 - k)) + ")";
            ctx.beginPath(); ctx.arc(P.x + Math.sin(P.t*0.3 + P.x)*2, CH - 4 - k*16, 1.5 + k*3, 0, Math.PI*2); ctx.fill();
        }
        //岩の落ちる所の印(着くまでの間、縮んでいく赤い輪と十字)
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.kind != "rock" || b.eta == null || b.t >= b.eta) continue;
            var left = 1 - b.t/b.eta, R = 12 + 26*left;
            ctx.strokeStyle = "rgba(220,40,40," + (0.35 + 0.4*(1 - left)) + ")"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(b.tx, b.ty, R, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(b.tx - 8, b.ty); ctx.lineTo(b.tx + 8, b.ty);
            ctx.moveTo(b.tx, b.ty - 8); ctx.lineTo(b.tx, b.ty + 8);
            ctx.stroke(); ctx.lineWidth = 1;
        }
        //花火の玉が開く所の印(薄い点線の輪。開く直前ほど濃い)
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.kind != "shell" || b.tx == null) continue;
            var k = Math.min(1, (b.t || 0)/FW_RISE);
            ctx.strokeStyle = "rgba(230,120,40," + (0.2 + 0.45*k) + ")"; ctx.lineWidth = 1.5;
            ctx.setLineDash([3,5]);
            ctx.beginPath(); ctx.arc(b.tx, b.ty, 24 - 10*k, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]); ctx.lineWidth = 1;
        }
        //迎撃する敵の範囲(点線の輪)と、次に撃ち落とせるかのランプ
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(!e.intercept || e.dead) continue;
            var ready = !(e.intercept.cd > 0);
            ctx.strokeStyle = ready ? "rgba(220,60,50,0.45)" : "rgba(120,120,130,0.35)"; ctx.lineWidth = 1.5;
            ctx.setLineDash([5,6]); ctx.lineDashOffset = -mainScreen.clock*0.5;
            ctx.beginPath(); ctx.arc(e.x, e.y, INTERCEPT_RANGE, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineWidth = 1;
        }
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
    //花火の星：重ねるほど明るくなる光のにじみ・色の玉・白く熱い芯と、動いた跡の尾(手前の星ほど明るい)
    //消える前は瞬きながら薄くなる。花雷ははじけると、細い光の筋が放射状に走る
    drawStar:function(b,r,now){
        var F = FW_TYPES[b.fw] || FW_TYPES.botan;
        var col = b.col || F.colors[0], tailCol = col;
        var life = b.life != null ? b.life : F.life;
        if(b.fw == "botan" && !b.core){
            //牡丹：半分で色が変わる(変わる瞬間は白くひらめく)
            var h = life - F.life/2;
            col = tailCol = Math.abs(h) < 3 ? "255,255,255" : (h < 0 ? F.colors[1] : F.colors[0]);
        }
        if(b.fw == "yanagi"){
            //柳：金から琥珀へ。尾は先に琥珀になる
            col = fwMix(F.colors[0], F.colors[1], 1 - life/F.life);
            tailCol = fwMix(F.colors[0], F.colors[1], Math.min(1, 1.4 - life/F.life));
        }
        var a = life < FW_FADE ? (life/FW_FADE)*(0.6 + 0.4*Math.sin(now*0.9 + b.x*0.7)) : 1;
        var lit = b.z != null ? 0.65 + 0.35*b.z : 1;
        ctx.globalCompositeOperation = "lighter";
        if(b.trail && b.trail.length >= 2) this.fwTail(b, tailCol, 0.55*a*lit, r*1.3);
        if(b.pop > 0){
            //花雷のはじけた光：にじむ白い光と、放射状の細い光の筋(当たり判定 r の大きさ)
            var k = b.pop/FW_POP_T, rot = b.x*0.37;
            ctx.fillStyle = "rgba(255,240,200," + (0.3*k) + ")";
            ctx.beginPath(); ctx.arc(b.x,b.y,r*1.6,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(255,255,240," + (0.5 + 0.5*k) + ")"; ctx.lineWidth = 1.4; ctx.lineCap = "round";
            ctx.beginPath();
            for(var i=0; i<8; i++){
                var ang = rot + i*Math.PI/4, R = r*(i % 2 ? 0.9 : 1.5);
                ctx.moveTo(b.x + Math.cos(ang)*r*0.3, b.y + Math.sin(ang)*r*0.3);
                ctx.lineTo(b.x + Math.cos(ang)*R, b.y + Math.sin(ang)*R);
            }
            ctx.stroke(); ctx.lineCap = "butt"; ctx.lineWidth = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = "rgba(255,255,255," + (0.7 + 0.3*k) + ")";
            ctx.beginPath(); ctx.arc(b.x,b.y,r*0.45,0,Math.PI*2); ctx.fill();
            return;
        }
        if(b.fw == "hanarai") lit = 0.55;     //花雷の玉は小さな銀の粒(はじけた光を目立たせる)
        //花雷の玉は、はじける前にちかちか瞬く
        if(b.fw == "hanarai" && b.fuse != null && b.fuse < 14 && Math.floor(now/2) % 2 == 0){ col = "255,255,255"; lit = 1.3; }
        ctx.fillStyle = "rgba(" + col + "," + (0.14*a*lit) + ")";
        ctx.beginPath(); ctx.arc(b.x,b.y,r*3.4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(" + col + "," + (0.3*a*lit) + ")";
        ctx.beginPath(); ctx.arc(b.x,b.y,r*1.9,0,Math.PI*2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(" + col + "," + a + ")";
        ctx.beginPath(); ctx.arc(b.x,b.y,r + 0.3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255," + a + ")";
        ctx.beginPath(); ctx.arc(b.x,b.y,r*0.55,0,Math.PI*2); ctx.fill();
    },
    //尾：新しい所ほど太く明るく(重ねるほど明るくなる描き方の中で呼ぶ)
    fwTail:function(b,_col,_a,_w){
        var T = b.trail;
        ctx.lineCap = "round";
        for(var i=0; i<T.length; i+=2){
            var k = 1 - i/T.length, px = i ? T[i-2] : b.x, py = i ? T[i-1] : b.y;
            ctx.strokeStyle = "rgba(" + _col + "," + (_a*k) + ")"; ctx.lineWidth = 0.5 + _w*k;
            ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(T[i],T[i+1]); ctx.stroke();
        }
        ctx.lineCap = "butt"; ctx.lineWidth = 1;
    },
    //ごつごつした岩(_seed で形が決まる。_big なら割れ目も描く)
    drawRock:function(_x,_y,_r,_ang,_seed,_big){
        var N = 8, pts = [];
        for(var i=0; i<N; i++){
            var h = Math.sin(_seed*12.9898 + i*78.233)*43758.5453;
            pts.push(_r*(0.78 + 0.22*(h - Math.floor(h))));
        }
        var poly = function(_k,_ox,_oy){
            ctx.beginPath();
            for(var i=0; i<N; i++){
                var a = _ang + i*Math.PI*2/N;
                ctx.lineTo(_ox + Math.cos(a)*pts[i]*_k, _oy + Math.sin(a)*pts[i]*_k);
            }
            ctx.closePath();
        };
        ctx.fillStyle = "#3b3430"; poly(1.12,_x,_y); ctx.fill();
        ctx.fillStyle = "#7a6e64"; poly(1,_x,_y); ctx.fill();
        //左上から光が当たる面
        ctx.fillStyle = "#a89c8e"; poly(0.55,_x - _r*0.22,_y - _r*0.22); ctx.fill();
        if(_big){
            ctx.strokeStyle = "#4a413b"; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(_x + Math.cos(_ang + 0.4)*_r*0.8, _y + Math.sin(_ang + 0.4)*_r*0.8);
            ctx.lineTo(_x + Math.cos(_ang + 1.6)*_r*0.15, _y + Math.sin(_ang + 1.6)*_r*0.15);
            ctx.lineTo(_x + Math.cos(_ang + 3.3)*_r*0.6, _y + Math.sin(_ang + 3.3)*_r*0.6);
            ctx.stroke(); ctx.lineWidth = 1;
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
    //雨雲：もくもくした暗い雲(集まる間は小さく薄い)。稲光で画面が白く光る
    drawStorm:function(){
        var K = this.stormK(), S = this.storm;
        if(K <= 0) return;
        var puffs = [[-0.42,6,30],[-0.24,-4,38],[-0.04,-10,44],[0.17,-3,40],[0.36,4,32],[-0.3,14,26],[0.05,14,30],[0.28,14,26]];
        var w = RAIN_W*(0.4 + 0.6*K), bob = Math.sin(S.t*0.05)*2;
        ctx.save();
        ctx.globalAlpha = Math.min(1, K*1.3);
        var layer = function(_grow,_dy,_color){
            ctx.fillStyle = _color;
            ctx.beginPath();
            for(var i=0; i<puffs.length; i++){
                var p = puffs[i], x = S.x + p[0]*w, y = RAIN_Y + p[1] + bob + _dy;
                var R = Math.max(1, p[2]*(0.5 + 0.5*K) + _grow);
                ctx.moveTo(x + R, y);
                ctx.arc(x, y, R, 0, Math.PI*2);
            }
            ctx.fill();
        };
        layer(2.5, 0, "#22281e");       //ふちどり
        layer(0, 0, "#4c5640");         //雲
        layer(-9, -6, "#6a7658");       //上から光が当たる所
        //雲の中で稲光がちらつく
        if(S.flash > 0){
            ctx.strokeStyle = "rgba(240,255,170,0.9)"; ctx.lineWidth = 2;
            var x = S.x + Math.sin(S.t*7.3)*w*0.3;
            ctx.beginPath(); ctx.moveTo(x, RAIN_Y - 8); ctx.lineTo(x + 8, RAIN_Y + 4); ctx.lineTo(x - 2, RAIN_Y + 8); ctx.lineTo(x + 6, RAIN_Y + 22); ctx.stroke();
            ctx.lineWidth = 1;
        }
        ctx.restore();
        if(S.flash > 0){
            ctx.fillStyle = "rgba(235,255,210," + (S.flash/8*0.25) + ")";
            ctx.fillRect(0,0,CW,CH);
        }
    },
    //迎撃する敵の砲身(撃ち落とした向きへ向き、撃った直後は光る)
    drawIntercept:function(e){
        var I = e.intercept, a = I.ang != null ? I.ang : Math.PI/2;
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
        ctx.fillStyle = "#2b2f36";
        ctx.fillRect(e.r - 4, -3.5, 14, 7);
        ctx.fillStyle = "#8d98a5";
        ctx.fillRect(e.r - 3, -2, 12, 4);
        if(I.zap > 0){
            ctx.fillStyle = "rgba(255,200,90," + (I.zap/8) + ")";
            ctx.beginPath(); ctx.arc(e.r + 12, 0, 4 + I.zap*0.6, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
        //次に撃ち落とせるまでのランプ(赤：撃てる)
        var ready = !(I.cd > 0);
        ctx.fillStyle = ready ? "#ff3a3a" : "#555";
        ctx.beginPath(); ctx.arc(e.x, e.y - e.r - 7, 3.5, 0, Math.PI*2); ctx.fill();
    },
    //弾の上に描くもの：バケツ・雨雲・迎撃の砲身
    drawOver:function(){
        this.drawStorm();
        for(var i=0; i<enemies.length; i++){
            if(enemies[i].intercept && !enemies[i].dead) this.drawIntercept(enemies[i]);
        }
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
        if(this.list[this.labIndex()].id != "intercept") enemies = enemies.filter(function(e){ return !e.lab; });   //迎撃の試作の的は、ほかの攻撃では消す
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
            case "rain":
                if(T == 40) this.rain(x);
                break;
            case "rock":
                //ドローン君のいる所へ1つ、3回に1回は左右にずらして3つ
                if(T % 70 == 40){
                    var three = Math.floor(T/70) % 3 == 2;
                    for(var i=(three ? -1 : 0); i<=(three ? 1 : 0); i++) this.throwRock(x, y, Math.max(20, Math.min(CW - 20, tg.X + i*110)), tg.Y);
                    sound.play("dash");
                }
                break;
            case "botan":
            case "yanagi":
            case "hanarai":
            case "kata":
                //打ち上げる所を 下 → 左 → 右 → 砲台(上) の順に変える
                var every = id == "kata" || id == "yanagi" ? 100 : 75;
                if(T % every == 40){
                    var n = Math.floor(T/every) % 4;
                    var from = [[CW*(0.2 + 0.6*Math.random()), CH + 10], [-10, CH*(0.3 + 0.5*Math.random())],
                                [CW + 10, CH*(0.3 + 0.5*Math.random())], [x, y]][n];
                    this.firework(id, from[0], from[1]);
                }
                break;
            case "intercept":
                //砲台の代わりに、迎撃する的を置く(撃たない。ドローン君の弾を撃ち落とす)
                if(!enemies.some(function(e){ return e.lab; })){
                    var e = makeEnemy("spinner");
                    e.lab = true; e.score = 0; e.parts = 0;
                    e.hp = e.maxHp = 1e9;
                    e.x = x; e.y = y;
                    e.intercept = { cd:0, zap:0 };
                    enemies.push(e);
                    this.labHits = 0; this.labShot = 0;
                }
                break;
        }
        if(shot) sound.play("enemyShot");
    },
    labHits:0,      //迎撃の試作：的に当たった数
    labShot:0,      //迎撃の試作：撃ち落とした数
    //砲台と、弾の名前の一覧(bossDebug.drawTag から)
    drawLab:function(){
        var x = this.labX, y = 70;
        var cur = this.labIndex();
        if(this.list[cur].id == "intercept"){
            //迎撃：砲台の代わりに的がいる。撃ち落とした数と当たった数
            ctx.textAlign = "center";
            ctx.font = "bold 13px sans-serif";
            ctx.fillStyle = "#c33";
            ctx.fillText("撃ち落とした " + this.labShot + "　当たった " + this.labHits, CW/2, 42);
        }else{
            ctx.fillStyle = "#334";
            ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "#c33";
            ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
        }
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
