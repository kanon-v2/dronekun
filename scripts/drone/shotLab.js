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

//---- 画面の前後(奥行き)を使う攻撃 ----
//奥行き z：0 がドローン君のいる面、1 がいちばん奥、マイナスは画面の手前。奥の物は消失点へ寄って小さく見える
const DEPTH_VP      = { x:480, y:170 }; //消失点(地平線のあたり。px)
const DEPTH_K       = 7;        //奥行きの強さ(いちばん奥で 1/(1+DEPTH_K) の大きさ)
//奥からの砲撃：奥の空から弾が近づき、着いた瞬間に着く所(赤い輪)だけが当たる。着くと破片が散る
const DEEP_TIME     = 80;       //撃ってから着くまで(フレーム)
const DEEP_R        = 30;       //着いたときに当たる範囲の半径(px)
const DEEP_SHARDS   = 8;        //着いたときに散る破片の数(danmaku() を掛ける)
const DEEP_SHARD_SPEED = 2;     //破片の速さ(danmaku() を掛ける)
//奥からの突進：敵が奥から大きくなりながら突っ込む。着く直前に衝撃波を出すと弾き返せる(ジャスト)
const RAM_TIME      = 100;      //奥から着くまで(フレーム)
const RAM_LOCK      = 0.6;      //この割合までは狙いがドローン君を追い、そのあと止まる(印が赤くなる)
const RAM_R         = 34;       //着いたときに当たる範囲の半径(px)
const RAM_SCALE     = 3.2;      //着いたときの大きさ(突進の敵の何倍か)
const RAM_JUST      = 12;       //着くまでこのフレーム以内に衝撃波を出すと弾き返す(4 以内は PERFECT)
const RAM_PASS      = 16;       //当たったあと、画面の手前を通り過ぎて消えるまで(フレーム。当たらない)
//立体の輪：弾が傾いた輪になって回る。手前を通る半分だけが当たり、奥の半分は暗くドローン君の後ろをすり抜ける
const HOOP_N        = 14;       //輪の弾の数
const HOOP_R        = 150;      //輪の大きさ(半径。px。はじめは小さく、広がる)
const HOOP_GROW     = 90;       //広がりきるまで(フレーム)
const HOOP_SPIN     = 0.028;    //輪が回る速さ(ラジアン/フレーム)
const HOOP_TILT     = 1.15;     //輪の傾き(ラジアン。0 だと平らで奥行きなし)
const HOOP_DRIFT    = 0.5;      //輪のまんなかがドローン君へ寄る速さ(px/フレーム)
const HOOP_LIFE     = 340;      //輪がほどけて、弾が外へ飛んでいくまで(フレーム)
//奥へ潜る敵：表に出て撃つ → 奥へ潜る(狙えず当たらない) → 奥で別の場所へ動く → 手前へ出てきて弾の輪を撃つ
const DIVER_TIMES   = { surface:130, dive:28, deep:70, rise:28 };  //段階ごとの長さ(フレーム)
const DIVER_RING    = 12;       //出てきたときに撃つ弾の輪の数
//手前を横切る影：大きな物が画面のすぐ手前をぼやけた影絵で横切り、その後ろの弾が見えにくくなる
const VEIL_TIME     = 230;      //横切る長さ(フレーム)
const VEIL_SIZE     = 300;      //影の大きさ(横幅の半分くらい。px)
const VEIL_ALPHA    = 0.82;     //影の濃さ(まんなか)
//画面のガラスに張り付く：液体の玉が画面へ向かって飛んできて、ガラスに張り付いて垂れる(当たらない。見えにくくなる)
const GLOB_TIME     = 36;       //投げてからガラスに着くまで(フレーム)
const GLASS_LIFE    = 420;      //張り付いてから消えるまで(フレーム)
const GLASS_MAX     = 8;        //張り付いている数の上限

//---- 障害物が横切るギミック ----
//障害物は動く四角い壁。ドローン君は通り抜けられずに押され(drone.calcXY から shotLab.pushOut)、画面の端に挟まると被弾する。
//敵の弾もドローン君の飛んでいく弾も、障害物に当たると消える(隠れる盾にもなる)
const OBST_WALL_W     = 44;     //すき間の壁の幅(px)
const OBST_GAP        = 130;    //すき間の高さ(px)
const OBST_WALL_SPEED = 2.2;    //すき間の壁の速さ(px/フレーム)
const OBST_CRATE_W    = [60,140];   //流れるコンテナの幅(px。この間でばらつく)
const OBST_CRATE_H    = [40,90];    //流れるコンテナの高さ(px)
const OBST_CRATE_SPEED = [1,2.4];   //流れるコンテナの速さ(px/フレーム)
const OBST_CRUSH      = 0.6;    //押し出したあとも、ドローン君の半径のこの割合より深く重なっていたら「挟まれた」

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
SHOT_KINDS.hoop     = { r:5 };      //立体の輪の弾(手前は水色に白い芯、奥は暗く小さい。奥の間 b.behind は当たらない)

//デバッグの「攻撃の試作」
const SHOT_LAB_WAVE = 7;            //弾の速さ・数はこのWAVEのもの(ボス・ライバルのWAVEは選ばない)
const SHOT_LAB_SEC  = 7;            //1種類を出す秒数(自動で順番に切り替えるとき。選んだ攻撃もこの長さで繰り返す)
const LAB_LIST_Y    = 84;           //左の一覧の上の端(px)
const LAB_ROW_H     = 15;           //一覧の1行の高さ(px)
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
        { id:"deep",   name:"奥：砲撃",     note:"奥から弾が迫る。着く瞬間に赤い輪の中だけ当たる" },
        { id:"ram",    name:"奥：突進",     note:"奥から突っ込んでくる。着く直前の衝撃波で弾き返せる" },
        { id:"hoop",   name:"奥：立体の輪", note:"回る輪の手前の弾だけ当たる。暗い弾は後ろを通る" },
        { id:"diver",  name:"奥：潜る敵",   note:"奥へ潜ると狙えない。出てくる所(点線)で弾の輪" },
        { id:"veil",   name:"手前：横切る影", note:"大きな影が手前を横切り、後ろの弾が見えにくい" },
        { id:"glass",  name:"手前：ガラス", note:"液体が画面のガラスに張り付いて垂れ、見えにくくなる" },
        { id:"gate",   name:"障害物：すき間の壁", note:"壁のすき間を通る。端に挟まれると被弾。弾も壁で止まる" },
        { id:"drift",  name:"障害物：コンテナ", note:"流れるコンテナは押してくるが、弾を防ぐ盾にもなる" },
        { id:"intercept", name:"迎撃(能力)", note:"近づいた弾を撃ち落とす(1秒に" + INTERCEPT_PER_SEC + "発まで)。数で押し切る" }
    ],
    zones:[],       //範囲攻撃 { shape:"circle"|"band", x, y, r, w, h, t }
    buckets:[],     //バケツ { x, y, side, mode, t, tilt, pour, seq, drop }
    pourSeq:0,      //液体の流れの番号(同じ流れの粒を糸でつなぐ)
    storm:null,     //雨雲 { x, mode, t, wind, bolt, flash }(1つだけ)
    puddles:[],     //床に落ちた雨粒の煙(見た目だけ){ x, t }
    night:0,        //花火の間の夜の色の濃さ(0～1)
    deeps:[],       //奥からの砲撃 { tx, ty, t }
    rams:[],        //奥からの突進 { tx, ty, t, mode:"come"|"pass"|"back", k }
    hoops:[],       //立体の輪 { x, y, t, ang, roll, shots }
    veil:null,      //手前を横切る影 { t, dir, y }
    globs:[],       //ガラスへ飛んでくる液体の玉 { x0, y0, x, y, t }
    splats:[],      //ガラスに張り付いた液体 { x, y, t, blobs, drips }
    obstacles:[],   //障害物 { kind:"wall"|"crate", x, y, w, h, vx, edge, color, crushed }

    //試作の攻撃を全部消す(WAVEの始め・クリア・攻撃の試作で次の種類へ移るとき)
    clear:function(){
        this.zones = [];
        this.buckets = [];
        this.storm = null;
        this.puddles = [];
        this.night = 0;
        this.deeps = []; this.rams = []; this.hoops = []; this.veil = null; this.globs = []; this.splats = [];
        this.obstacles = [];
    },
    //すき間の壁を出す(_dir：1 は左から右へ、-1 は右から左へ。_gapY：すき間のまんなか)
    wall:function(_dir,_gapY){
        var x = _dir > 0 ? -OBST_WALL_W - 10 : CW + 10, vx = _dir*OBST_WALL_SPEED;
        var top = _gapY - OBST_GAP/2, bot = _gapY + OBST_GAP/2;
        this.obstacles.push({ kind:"wall", x:x, y:-20, w:OBST_WALL_W, h:top + 20, vx:vx, edge:"bottom", crushed:false });
        this.obstacles.push({ kind:"wall", x:x, y:bot, w:OBST_WALL_W, h:CH - bot + 20, vx:vx, edge:"top", crushed:false });
        sound.play("rumble");
    },
    //流れるコンテナを出す(_dir：流れる向き)
    crate:function(_dir,_y){
        var w = randIn(OBST_CRATE_W), h = randIn(OBST_CRATE_H);
        var colors = ["#c8692e","#2f8f8a","#6b6fb5","#b8a032"];
        this.obstacles.push({ kind:"crate", x:_dir > 0 ? -w - 10 : CW + 10, y:_y - h/2, w:w, h:h, vx:_dir*randIn(OBST_CRATE_SPEED),
                              color:colors[Math.floor(Math.random()*colors.length)], crushed:false, t:Math.floor(Math.random()*100) });
    },
    //点が障害物の中か
    inObstacle:function(_x,_y,_m){
        var m = _m || 0;
        for(var i=0; i<this.obstacles.length; i++){
            var o = this.obstacles[i];
            if(_x > o.x - m && _x < o.x + o.w + m && _y > o.y - m && _y < o.y + o.h + m) return o;
        }
        return null;
    },
    //ドローン君を障害物の外へ押し出す(drone.calcXY から。画面の端に挟まれたら被弾)
    pushOut:function(d){
        if(this.obstacles.length == 0 || mainScreen.state == "over") return;
        for(var pass=0; pass<2; pass++){
            for(var i=0; i<this.obstacles.length; i++){
                var o = this.obstacles[i];
                if(o.crushed) continue;
                var cx = Math.max(o.x, Math.min(d.X, o.x + o.w)), cy = Math.max(o.y, Math.min(d.Y, o.y + o.h));
                var dx = d.X - cx, dy = d.Y - cy, dist = Math.hypot(dx, dy);
                if(dist >= d.R) continue;
                if(dist > 0){ d.X += dx/dist*(d.R - dist); d.Y += dy/dist*(d.R - dist); continue; }
                //まんなかが中に入った：いちばん浅い向きへ出す
                var L = d.X - o.x, Rt = o.x + o.w - d.X, T = d.Y - o.y, B = o.y + o.h - d.Y, m = Math.min(L, Rt, T, B);
                if(m == L) d.X = o.x - d.R; else if(m == Rt) d.X = o.x + o.w + d.R;
                else if(m == T) d.Y = o.y - d.R; else d.Y = o.y + o.h + d.R;
            }
            d.X = Math.max(d.R, Math.min(d.X, CW - d.R));
            d.Y = Math.max(d.R, Math.min(d.Y, CH - d.R));
        }
        //画面の端で押し出しきれない：挟まれた
        for(var i=0; i<this.obstacles.length; i++){
            var o = this.obstacles[i];
            if(o.crushed) continue;
            var cx = Math.max(o.x, Math.min(d.X, o.x + o.w)), cy = Math.max(o.y, Math.min(d.Y, o.y + o.h));
            if(Math.hypot(d.X - cx, d.Y - cy) >= d.R*OBST_CRUSH) continue;
            o.crushed = true;   //この障害物はもう押さない(通り過ぎるまで重なってよい)
            popup(d.X, d.Y - 30, "はさまれた！", "#c33");
            fx.shake(6);
            if(mainScreen.canBeHit()) mainScreen.damage();
        }
    },
    //奥行き z の所にある (x,y) が、画面のどこに・何倍の大きさで見えるか
    depthAt:function(_x,_y,_z){
        var s = 1/Math.max(0.05, 1 + _z*DEPTH_K);
        return { x:DEPTH_VP.x + (_x - DEPTH_VP.x)*s, y:DEPTH_VP.y + (_y - DEPTH_VP.y)*s, s:s };
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

    //---- 画面の前後を使う攻撃 ----
    //奥からの砲撃：(_tx,_ty)へ奥から撃つ
    deep:function(_tx,_ty){
        var d = { tx:_tx, ty:_ty, t:0 };
        this.deeps.push(d);
        var P = this.depthAt(_tx, _ty, 1);
        fx.flare(P.x, P.y, 14, "255,150,90", 10);   //奥で撃った光
        sound.play("bossShot");
        return d;
    },
    //奥からの突進
    ram:function(){
        var tg = nearestPlayer(DEPTH_VP.x, DEPTH_VP.y);
        var r = { tx:tg.X, ty:tg.Y, t:0, mode:"come", k:0 };
        this.rams.push(r);
        sound.play("tell");
        return r;
    },
    //立体の輪((_x,_y)から。_roll：輪の傾く向き)
    hoop:function(_x,_y,_roll){
        var tg = nearestPlayer(_x,_y), d = Math.hypot(tg.X - _x, tg.Y - _y) || 1;
        var h = { x:_x, y:_y, vx:(tg.X - _x)/d*HOOP_DRIFT, vy:(tg.Y - _y)/d*HOOP_DRIFT, t:0, ang:Math.random()*Math.PI*2, roll:_roll, shots:[] };
        for(var i=0; i<HOOP_N; i++){
            var b = this.fire(_x, _y, 0, 0, "hoop", { ring:h, slot:i });
            h.shots.push(b);
        }
        this.hoops.push(h);
        sound.play("summon");
        return h;
    },
    //輪の i 番目の弾の位置 [x, y, 手前ほど1(奥ほど-1)]
    hoopPos:function(h,_i){
        return this.hoopAt(h, h.ang + _i*Math.PI*2/HOOP_N);
    },
    //輪の上の角度 _th の所
    hoopAt:function(h,_th){
        var R = HOOP_R*Math.min(1, 0.12 + h.t/HOOP_GROW), th = _th;
        var x = Math.cos(th)*R, y0 = Math.sin(th)*R;
        var y = y0*Math.cos(HOOP_TILT), z = Math.sin(th)*Math.sin(HOOP_TILT);     //輪を前へ傾ける
        var c = Math.cos(h.roll), s = Math.sin(h.roll);
        return [h.x + x*c - y*s, h.y + x*s + y*c, z];
    },
    //奥へ潜る敵を出す
    diver:function(_x,_y){
        var e = makeEnemy("shooter");
        e.x = _x; e.y = _y; e.vx = 0; e.vy = 0;
        e.hp = e.maxHp = e.maxHp*8;
        e.score = 0; e.parts = 0;
        e.lab = true; e.labId = "diver";
        e.dive = { mode:"surface", t:0, tx:_x, ty:_y };
        e.depth = 0;
        enemies.push(e);
        return e;
    },
    //手前を横切る影
    veilStart:function(){
        this.veil = { t:0, dir:Math.random() < 0.5 ? 1 : -1, y:CH*(0.35 + Math.random()*0.3) };
        sound.play("rumble");
    },
    //ガラスへ液体の玉を投げる((_x,_y)から、(_tx,_ty)のあたりのガラスへ)
    glob:function(_x,_y,_tx,_ty){
        this.globs.push({ x0:_x, y0:_y, x:_tx, y:_ty, t:0, seed:Math.random()*1000 });
        sound.play("water");
    },
    //液体がガラスに張り付く
    splat:function(_x,_y,_seed){
        var blobs = [], drips = [];
        //まんなかの大きなかたまりと、まわりのふくらみ、外へ飛び散った小さなしずく
        for(var i=0; i<6; i++){
            var a = _seed + i*2.4, d = i == 0 ? 0 : 9 + (i*13 % 15);
            blobs.push([Math.cos(a)*d, Math.sin(a)*d*0.75, i == 0 ? 22 : 8 + (i*7 % 8)]);
        }
        for(var i=0; i<7; i++){
            var a = _seed*1.7 + i*0.9 + Math.random()*0.5, d = 30 + Math.random()*22;
            blobs.push([Math.cos(a)*d, Math.sin(a)*d*0.85, 1.5 + Math.random()*2.5]);
        }
        //垂れる筋(細く、長さと速さが不ぞろい)
        var nd = 2 + Math.floor(Math.random()*3);
        for(var i=0; i<nd; i++) drips.push({ x:(Math.random() - 0.5)*36, len:0, v:0.2 + Math.random()*0.5, w:1.6 + Math.random()*1.8 });
        this.splats.push({ x:_x, y:_y, t:0, blobs:blobs, drips:drips });
        if(this.splats.length > GLASS_MAX) this.splats.shift();
        fx.shake(2);
        sound.play("hit");
    },
    //衝撃波を出したとき(mainScreen.blast から)：着く直前の奥からの突進を弾き返す
    onBlast:function(){
        for(var i=0; i<this.rams.length; i++){
            var r = this.rams[i], left = RAM_TIME - r.t;
            if(r.mode != "come" || left > RAM_JUST || Math.hypot(drone.X - r.tx, drone.Y - r.ty) > RAM_R + 40) continue;
            r.mode = "back"; r.k = 0;
            var perfect = left <= 4;
            popup(r.tx, r.ty - 40, perfect ? "PERFECT" : "JUST", "rgb(" + JUST_COLOR + ")", true);
            fx.flare(r.tx, r.ty, 60, JUST_COLOR, 14);
            fx.shake(5);
            sound.play("just");
        }
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
        this.depthStep();
    },
    depthStep:function(){
        var ms = mainScreen, m = danmaku(), hitOk = ms.state != "over";
        //奥からの砲撃：着いた瞬間、着く所の輪の中にいれば被弾。破片が散る
        for(var i=this.deeps.length-1; i>=0; i--){
            var d = this.deeps[i];
            if(++d.t < DEEP_TIME) continue;
            if(hitOk && Math.hypot(drone.X - d.tx, drone.Y - d.ty) < DEEP_R + HIT_CORE && ms.canBeHit()) ms.damage();
            var n = Math.round(DEEP_SHARDS*m), a0 = Math.random()*Math.PI*2;
            for(var j=0; j<n; j++) fireShot(d.tx, d.ty, a0 + j*Math.PI*2/n, DEEP_SHARD_SPEED*m, "small");
            fx.flare(d.tx, d.ty, DEEP_R*1.8, "255,140,70", 12);
            fx.ring(d.tx, d.ty, DEEP_R, "255,90,60", 12, 4);
            fx.shake(3);
            battleBg.ripple(d.tx, d.ty, 10, 6, 34, "255,110,70");
            sound.play("explode");
            this.deeps.splice(i,1);
        }
        //奥からの突進：はじめは狙いがドローン君を追い、止まってから着く。着いたら手前を通り過ぎる
        for(var i=this.rams.length-1; i>=0; i--){
            var r = this.rams[i];
            r.t++;
            if(r.mode == "come"){
                if(r.t < RAM_TIME*RAM_LOCK){
                    var tg = nearestPlayer(r.tx, r.ty);
                    r.tx += (tg.X - r.tx)*0.06; r.ty += (tg.Y - r.ty)*0.06;
                }else if(Math.abs(r.t - RAM_TIME*RAM_LOCK) < 1) sound.play("tell");
                if(r.t >= RAM_TIME){
                    if(hitOk && Math.hypot(drone.X - r.tx, drone.Y - r.ty) < RAM_R + HIT_CORE && ms.canBeHit()) ms.damage();
                    r.mode = "pass"; r.k = 0;
                    fx.shake(6);
                    battleBg.ripple(r.tx, r.ty, 12, 6, 34, "220,60,60");
                    sound.play("dash");
                }
            }else if(++r.k >= (r.mode == "pass" ? RAM_PASS : 50)) this.rams.splice(i,1);
        }
        //立体の輪：まんなかがドローン君へ寄りながら回って広がり、時間が来たらほどける
        for(var i=this.hoops.length-1; i>=0; i--){
            var h = this.hoops[i];
            h.t++;
            h.x += h.vx; h.y += h.vy;
            h.ang += HOOP_SPIN;
            h.roll += 0.004;
            if(h.t >= HOOP_LIFE){
                //ほどける：残った弾は、回っていた向きへ飛んでいく
                for(var j=0; j<h.shots.length; j++){
                    var b = h.shots[j];
                    if(enemyShots.indexOf(b) < 0) continue;
                    var p = this.hoopPos(h, b.slot), q = this.hoopPos({ x:h.x, y:h.y, t:h.t, ang:h.ang + 0.2, roll:h.roll }, b.slot);
                    var a = Math.atan2(q[1] - p[1], q[0] - p[0]);
                    b.ring = null; b.behind = false; b.z = 0;
                    b.vx = Math.cos(a)*2*m; b.vy = Math.sin(a)*2*m;
                }
                this.hoops.splice(i,1);
            }
        }
        //手前を横切る影
        if(this.veil && ++this.veil.t >= VEIL_TIME) this.veil = null;
        //ガラスへ飛んでくる玉と、張り付いた液体
        for(var i=this.globs.length-1; i>=0; i--){
            var g = this.globs[i];
            if(++g.t >= GLOB_TIME){ this.splat(g.x, g.y, g.seed); this.globs.splice(i,1); }
        }
        for(var i=this.splats.length-1; i>=0; i--){
            var S = this.splats[i];
            S.t++;
            for(var j=0; j<S.drips.length; j++){
                var D = S.drips[j];
                if(S.t > 20) D.len += D.v*Math.max(0.15, 1 - D.len/160);   //垂れるほど遅くなる
            }
            if(S.t >= GLASS_LIFE) this.splats.splice(i,1);
        }
        this.obstacleStep();
    },
    //障害物を動かし、当たった弾(敵の弾・ドローン君の飛んでいく弾)を消す
    obstacleStep:function(){
        for(var i=this.obstacles.length-1; i>=0; i--){
            var o = this.obstacles[i];
            o.x += o.vx;
            if((o.vx < 0 && o.x + o.w < -20) || (o.vx > 0 && o.x > CW + 20)) this.obstacles.splice(i,1);
        }
        if(this.obstacles.length == 0) return;
        var spark = 0, self = this;
        var hit = function(_x,_y,_color){
            if(!self.inObstacle(_x, _y)) return false;
            if(spark++ < 6) fx.sparks(_x, _y, 3, _color, 2.2, 1.6);
            return true;
        };
        for(var i=enemyShots.length-1; i>=0; i--){
            var b = enemyShots[i];
            if(!b.behind && hit(b.x, b.y, "255,170,120")) enemyShots.splice(i,1);
        }
        var lists = [arms.bullets, arms.missiles, arms.drops, arms.shards, arms.wells];
        for(var j=0; j<lists.length; j++){
            for(var i=lists[j].length-1; i>=0; i--){
                var p = lists[j][i];
                if(!p.open && hit(p.x, p.y, "200,220,255")) lists[j].splice(i,1);
            }
        }
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
        if(e.dive) return this.diveStep(e);
        if(e.lab){
            //攻撃の試作の的：砲台の位置にいて動かない。当たった数を数えて、体力は減らさない
            e.x = this.labX; e.y = 70; e.vx = 0; e.vy = 0;
            if(e.hp < e.maxHp){ this.labHits++; e.hp = e.maxHp; }
            return true;
        }
        return false;
    },
    //奥へ潜る敵：表で撃つ → 潜る → 奥で動く → 出てきて弾の輪(いつも true：ふだんの動きをしない)
    diveStep:function(e){
        var D = e.dive, T = DIVER_TIMES, m = danmaku();
        D.t++;
        e.vx = 0; e.vy = 0;
        var tg = nearestPlayer(e.x, e.y), aim = Math.atan2(tg.Y - e.y, tg.X - e.x);
        switch(D.mode){
            case "surface":
                e.y += Math.sin(e.t*0.06)*0.3;
                if(D.t % 45 == 0 && mainScreen.state == "play"){ fireFan(e.x, e.y, aim, 5, 0.22, 2.3*m, "normal"); sound.play("enemyShot"); }
                if(D.t >= T.surface){
                    D.mode = "dive"; D.t = 0;
                    e.phased = true; e.harmless = true;     //奥にいる間は狙えず、当たらない
                    sound.play("warpOut");
                }
                break;
            case "dive":
                e.depth = D.t/T.dive;
                if(D.t >= T.dive){
                    D.mode = "deep"; D.t = 0;
                    //次に出てくる所：ドローン君から離れた、画面の中のどこか
                    var a = Math.random()*Math.PI*2, d = 170 + Math.random()*90;
                    D.tx = Math.max(60, Math.min(CW - 60, tg.X + Math.cos(a)*d));
                    D.ty = Math.max(60, Math.min(CH - 80, tg.Y + Math.sin(a)*d));
                    D.x0 = e.x; D.y0 = e.y;
                }
                break;
            case "deep":
                e.depth = 1;
                var k = D.t/T.deep, k2 = k*k*(3 - 2*k);
                e.x = D.x0 + (D.tx - D.x0)*k2; e.y = D.y0 + (D.ty - D.y0)*k2;
                if(D.t >= T.deep){ D.mode = "rise"; D.t = 0; sound.play("warpIn"); }
                break;
            case "rise":
                e.depth = 1 - D.t/T.rise;
                if(D.t >= T.rise){
                    D.mode = "surface"; D.t = 0;
                    e.depth = 0; e.phased = false; e.harmless = false;
                    //出てきた瞬間に弾の輪
                    var n = Math.round(DIVER_RING*Math.min(1.5, m)), a0 = Math.random()*Math.PI*2;
                    for(var i=0; i<n; i++) fireShot(e.x, e.y, a0 + i*Math.PI*2/n, 2*m, "normal");
                    fx.ring(e.x, e.y, 40, "120,170,255", 14, 3);
                    sound.play("enemyShot");
                }
                break;
        }
        return true;
    },
    //奥にいる敵を、消失点へ寄せて小さく薄く描く(mainScreen.drawEnemy から。描いたら true)
    drawDeepEnemy:function(e){
        var P = this.depthAt(e.x, e.y, e.depth);
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.65*P.s;
        ctx.translate(P.x, P.y);
        ctx.scale(P.s, P.s);
        enemyArt.draw(e, null);
        ctx.restore();
        ctx.globalAlpha = 1;
        return true;
    },
    //迎撃：範囲に入ったドローン君の弾のうち、いちばん近いものを撃ち落とす(1秒に INTERCEPT_PER_SEC 発まで)
    //  I.range・I.per で範囲・1秒の数を変えられる。I.color は線の色、I.quiet なら範囲の輪と砲身を描かない(ライバル)
    interceptStep:function(e){
        var I = e.intercept;
        if(I.zap > 0) I.zap--;
        if(I.cd > 0){ I.cd--; return; }
        if(e.harmless) return;      //ワープ中・演出中などは撃ち落とさない
        var lists = [arms.bullets, arms.missiles, arms.drops, arms.shards, arms.wells];
        var best = I.range || INTERCEPT_RANGE, pick = null, from = null;
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
        I.cd = Math.round(60/(I.per || INTERCEPT_PER_SEC));
        I.zap = 8;
        I.ang = Math.atan2(pick.y - e.y, pick.x - e.x);
        fx.line(e.x + Math.cos(I.ang)*e.r, e.y + Math.sin(I.ang)*e.r, pick.x, pick.y, I.color || "255,70,60", 2.5, 8);
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
            case "hoop":
                //輪に乗っている間は輪の位置へ。奥を通る間(z<0)は当たらない(mainScreen.updateShots が b.behind を飛ばす)
                if(b.ring){
                    var p = this.hoopPos(b.ring, b.slot);
                    b.vx = p[0] - b.x; b.vy = p[1] - b.y;
                    b.z = p[2];
                    b.behind = p[2] < 0;
                    if(b.behind) b.grazed = false;  //手前へ出てきたら、またかすれる
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
            case "hoop":
                //手前ほど大きく明るい。奥を通る間は暗く小さく、白い芯がない(当たらない)
                var z = b.z || 0;
                if(b.behind){
                    ctx.fillStyle = "rgba(40,62,110," + (0.3 + 0.2*(1 + z)) + ")";
                    ctx.beginPath(); ctx.arc(b.x,b.y,r*(0.75 + 0.15*z),0,Math.PI*2); ctx.fill();
                    return true;
                }
                var rr = r*(1 + 0.3*z);
                ctx.fillStyle = "#13689e";
                ctx.beginPath(); ctx.arc(b.x,b.y,rr + 1.5,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#4fc3ff";
                ctx.beginPath(); ctx.arc(b.x,b.y,rr,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(b.x,b.y,rr*0.5,0,Math.PI*2); ctx.fill();
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
        this.drawDepthUnder();
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
            if(!e.intercept || e.dead || e.intercept.quiet) continue;
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
    //---- 画面の前後を使う攻撃の絵 ----
    //弾の下に描くもの：奥の物(砲撃の弾・遠い突進・潜った敵の出てくる所)と、着く所の印・輪の通り道
    drawDepthUnder:function(){
        var now = mainScreen.clock;
        for(var i=0; i<this.obstacles.length; i++) this.drawObstacle(this.obstacles[i], now);
        //立体の輪の通り道(手前は実線、奥は点線)
        for(var i=0; i<this.hoops.length; i++){
            var h = this.hoops[i];
            for(var j=0; j<48; j++){
                var p = this.hoopAt(h, j*Math.PI*2/48), q = this.hoopAt(h, (j + 1)*Math.PI*2/48);
                var front = p[2] + q[2] > 0;
                if(!front && j % 2) continue;
                ctx.strokeStyle = front ? "rgba(79,195,255,0.3)" : "rgba(60,80,130,0.22)"; ctx.lineWidth = front ? 2 : 1.5;
                ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke();
            }
            ctx.lineWidth = 1;
        }
        //奥からの砲撃：着く所の印(外の輪が縮んで当たる範囲に重なる)と、近づく弾
        for(var i=0; i<this.deeps.length; i++){
            var d = this.deeps[i], k = d.t/DEEP_TIME;
            ctx.fillStyle = "rgba(230,50,40," + (0.06 + 0.22*k*k) + ")";
            ctx.beginPath(); ctx.arc(d.tx, d.ty, DEEP_R, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(220,40,40," + (0.35 + 0.5*k) + ")"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(d.tx, d.ty, DEEP_R, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([4,5]);
            ctx.beginPath(); ctx.arc(d.tx, d.ty, DEEP_R + 46*(1 - k), 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]); ctx.lineWidth = 1;
            //近づく弾(少し前の位置から煙の筋)
            var P = this.depthAt(d.tx, d.ty, 1 - k), Q = this.depthAt(d.tx, d.ty, Math.min(1, 1 - k + 0.1));
            var R = 13*P.s;
            ctx.strokeStyle = "rgba(120,110,120," + (0.25 + 0.3*k) + ")"; ctx.lineWidth = Math.max(1, R*1.2); ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(Q.x, Q.y); ctx.lineTo(P.x, P.y); ctx.stroke();
            ctx.lineCap = "butt"; ctx.lineWidth = 1;
            ctx.fillStyle = "rgba(255,140,70," + (0.25 + 0.2*k) + ")";
            ctx.beginPath(); ctx.arc(P.x, P.y, R*1.9 + 1, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#3a3340";
            ctx.beginPath(); ctx.arc(P.x, P.y, R + 1, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#ffb070";
            ctx.beginPath(); ctx.arc(P.x, P.y, R*0.5 + 0.5, 0, Math.PI*2); ctx.fill();
        }
        //奥からの突進：着く所の印(狙いを追う間は白い点線、止まると赤、弾き返せる間は水色)と、遠い間の姿
        for(var i=0; i<this.rams.length; i++){
            var r = this.rams[i];
            if(r.mode == "come"){
                var k = r.t/RAM_TIME, left = RAM_TIME - r.t, locked = k >= RAM_LOCK;
                var col = left <= RAM_JUST ? JUST_COLOR : (locked ? "220,40,40" : "255,255,255");
                ctx.fillStyle = "rgba(" + col + "," + (0.05 + 0.2*k*k) + ")";
                ctx.beginPath(); ctx.arc(r.tx, r.ty, RAM_R, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "rgba(" + col + "," + (locked ? 0.55 + 0.35*Math.sin(now*0.5) : 0.6) + ")"; ctx.lineWidth = 2.5;
                if(!locked) ctx.setLineDash([6,6]);
                ctx.beginPath(); ctx.arc(r.tx, r.ty, RAM_R, 0, Math.PI*2); ctx.stroke();
                ctx.setLineDash([]); ctx.lineWidth = 1;
            }
            if(this.ramZ(r) > 0.25) this.drawRam(r);
        }
        //潜った敵の、次に出てくる所
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i], D = e.dive;
            if(!D || e.dead || (D.mode != "deep" && D.mode != "rise")) continue;
            var k = D.mode == "rise" ? 1 : D.t/DIVER_TIMES.deep;
            ctx.strokeStyle = "rgba(90,130,230," + (0.3 + 0.5*k) + ")"; ctx.lineWidth = 2;
            ctx.setLineDash([5,5]); ctx.lineDashOffset = -now*0.6;
            ctx.beginPath(); ctx.arc(D.tx, D.ty, 20 + 16*(1 - k), 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineWidth = 1;
        }
    },
    //障害物の絵(平らな塗り・濃いふちどり・左上からの光。雑魚敵の絵と同じ画風)
    drawObstacle:function(o,now){
        var x = Math.round(o.x), y = Math.round(o.y), w = o.w, h = o.h, ink = "#1f2328";
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        if(o.kind == "wall"){
            //鉄骨の柱：2本の柱の間に斜めの筋交い、すき間の側に黄色と黒のしま
            ctx.fillStyle = "#4a525c"; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = "#6d7783"; ctx.fillRect(x + 3, y, 7, h); ctx.fillRect(x + w - 10, y, 7, h);
            ctx.strokeStyle = "#2e343b"; ctx.lineWidth = 3;
            ctx.beginPath();
            var step = w - 20, y0 = y - ((y % (step*2)) + step*2) % (step*2);
            for(var yy=y0; yy<y + h; yy+=step*2){
                ctx.moveTo(x + 10, yy); ctx.lineTo(x + w - 10, yy + step); ctx.lineTo(x + 10, yy + step*2);
            }
            ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(x + 4, y, 2, h);     //左から当たる光
            //すき間の側のふちに、注意のしま
            var sy = o.edge == "top" ? y : y + h - 12;
            ctx.save();
            ctx.beginPath(); ctx.rect(x, sy, w, 12); ctx.clip();
            ctx.fillStyle = "#f2c230"; ctx.fillRect(x, sy, w, 12);
            ctx.fillStyle = "#1f2328";
            for(var sx=x - 12; sx<x + w + 12; sx+=12){
                ctx.beginPath(); ctx.moveTo(sx, sy + 12); ctx.lineTo(sx + 6, sy + 12); ctx.lineTo(sx + 12, sy); ctx.lineTo(sx + 6, sy); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }else{
            //浮遊コンテナ：縦の溝・上のつや・下の影・四すみの金具
            ctx.fillStyle = o.color; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = "rgba(0,0,0,0.22)";
            for(var sx=x + 10; sx<x + w - 6; sx+=12) ctx.fillRect(sx, y + 5, 3, h - 12);
            ctx.fillRect(x, y + h - 7, w, 7);
            ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillRect(x + 3, y + 3, w - 6, 2);
            ctx.fillStyle = "#2b2f36";
            ctx.fillRect(x, y, 7, 7); ctx.fillRect(x + w - 7, y, 7, 7); ctx.fillRect(x, y + h - 7, 7, 7); ctx.fillRect(x + w - 7, y + h - 7, 7, 7);
        }
        ctx.restore();
        ctx.strokeStyle = ink; ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.lineWidth = 1;
        if(o.kind == "crate"){
            //下で浮かせている噴射(ちらちらゆらぐ)
            for(var k=0; k<2; k++){
                var fx0 = x + w*(k ? 0.75 : 0.25), f = 4 + 2*Math.sin(now*0.7 + k*2 + o.t);
                ctx.fillStyle = "rgba(120,200,255,0.35)";
                ctx.beginPath(); ctx.ellipse(fx0, y + h + 4, 7, f + 2, 0, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "rgba(220,245,255,0.8)";
                ctx.beginPath(); ctx.ellipse(fx0, y + h + 2, 3, f*0.6, 0, 0, Math.PI*2); ctx.fill();
            }
        }
    },
    //突進の奥行き(来る間は1→0、通り過ぎる間はマイナス、弾き返されたら奥へ戻る)
    ramZ:function(r){
        if(r.mode == "come") return 1 - r.t/RAM_TIME;
        if(r.mode == "pass") return -0.12*r.k/RAM_PASS;
        return r.k/50;
    },
    drawRam:function(r){
        var z = this.ramZ(r), P = this.depthAt(r.tx, r.ty, z), s = P.s*RAM_SCALE;
        var a = r.mode == "come" ? 0.45 + 0.55*(1 - z) : 1 - r.k/(r.mode == "pass" ? RAM_PASS : 50);
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.translate(P.x, P.y);
        if(r.mode == "back") ctx.rotate(r.k*0.35);
        ctx.scale(s, s);
        this.drawRamArt(r);
        ctx.restore();
        ctx.globalAlpha = 1;
    },
    //奥から迫る敵の正面の姿(半径11。drawRam で RAM_SCALE 倍まで大きくする。ふちどり・左上からの光は雑魚敵の絵と同じ画風)
    //来る間はまわりに集中線、弾き返されたら水色に光る
    drawRamArt:function(r){
        var R = 11, t = r.t, back = r.mode == "back";
        var body = back ? "rgb(" + JUST_COLOR + ")" : "#c8382c", ink = "#2a1a1c";
        ctx.lineJoin = "round";
        if(r.mode == "come"){
            //迫ってくる集中線
            ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 0.6;
            ctx.beginPath();
            for(var i=0; i<10; i++){
                var a = i*Math.PI/5 + (t % 4)*0.08, L0 = R*1.55 + (t*1.7 + i*5) % 6;
                ctx.moveTo(Math.cos(a)*L0, Math.sin(a)*L0); ctx.lineTo(Math.cos(a)*(L0 + R*0.7), Math.sin(a)*(L0 + R*0.7));
            }
            ctx.stroke();
        }
        //とげの輪(ゆっくり回る)
        ctx.save(); ctx.rotate(t*0.05);
        ctx.beginPath();
        for(var i=0; i<16; i++){
            var a = i*Math.PI/8, L = i % 2 ? R*1.05 : R*1.38;
            ctx.lineTo(Math.cos(a)*L, Math.sin(a)*L);
        }
        ctx.closePath();
        ctx.fillStyle = back ? "#2a7f9a" : "#7a1f1a"; ctx.fill();
        ctx.strokeStyle = ink; ctx.lineWidth = 0.9; ctx.stroke();
        ctx.restore();
        //上のプロペラ(回ってぶれる)
        var pw = R*1.5*Math.abs(Math.cos(t*0.9)) + R*0.3;
        ctx.fillStyle = "#3a3f46";
        ctx.fillRect(-0.9, -R*1.45, 1.8, R*0.5);
        ctx.beginPath(); ctx.ellipse(0, -R*1.5, pw, R*0.13, 0, 0, Math.PI*2); ctx.fill();
        //胴体
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2);
        ctx.fillStyle = body; ctx.fill();
        ctx.strokeStyle = ink; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1;     //左上から当たる光
        ctx.beginPath(); ctx.arc(0, 0, R*0.78, Math.PI*1.05, Math.PI*1.45); ctx.stroke();
        //顔(黒い面に、つり上がった光る目)
        ctx.fillStyle = "#1b1d24";
        ctx.beginPath(); ctx.ellipse(0, R*0.12, R*0.7, R*0.42, 0, 0, Math.PI*2); ctx.fill();
        var glow = back ? "#ffffff" : "#ffcf3a";
        ctx.fillStyle = glow;
        for(var sd=-1; sd<=1; sd+=2){
            ctx.beginPath();
            ctx.moveTo(sd*R*0.12, R*0.02); ctx.lineTo(sd*R*0.52, -R*0.12); ctx.lineTo(sd*R*0.46, R*0.22); ctx.lineTo(sd*R*0.14, R*0.22);
            ctx.closePath(); ctx.fill();
        }
        ctx.lineJoin = "miter"; ctx.lineWidth = 1;
    },
    //いちばん手前に描くもの(mainScreen.draw の最後のほう)：通り過ぎる突進・横切る影・ガラスの液体
    drawFront:function(){
        for(var i=0; i<this.rams.length; i++){ if(this.ramZ(this.rams[i]) <= 0.25) this.drawRam(this.rams[i]); }
        if(this.veil) this.drawVeil();
        //ガラスへ飛んでくる玉(近づくほど大きく)
        for(var i=0; i<this.globs.length; i++){
            var g = this.globs[i], k = g.t/GLOB_TIME, e = k*k;
            var x = g.x0 + (g.x - g.x0)*e, y = g.y0 + (g.y - g.y0)*e, R = 5/(1 - 0.86*k);
            ctx.fillStyle = "#3f7a12";
            ctx.beginPath(); ctx.arc(x, y, R + 2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#7cc22e";
            ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.beginPath(); ctx.arc(x - R*0.35, y - R*0.35, R*0.25, 0, Math.PI*2); ctx.fill();
        }
        for(var i=0; i<this.splats.length; i++) this.drawSplat(this.splats[i]);
    },
    //手前を横切る影：大きなドローンの影絵(ふちは薄く重ねてぼかす)。後ろの弾は小さな光の輪だけ見える
    drawVeil:function(){
        var V = this.veil, k = V.t/VEIL_TIME, S = VEIL_SIZE;
        var cx = V.dir > 0 ? -S*1.2 + (CW + S*2.4)*k : CW + S*1.2 - (CW + S*2.4)*k;
        var cy = V.y + Math.sin(V.t*0.03)*18;
        var shape = function(_g){
            ctx.beginPath();
            var rr = function(_x,_y,_w,_h,_r){
                ctx.moveTo(_x + _r,_y);
                ctx.arcTo(_x + _w,_y,_x + _w,_y + _h,_r); ctx.arcTo(_x + _w,_y + _h,_x,_y + _h,_r);
                ctx.arcTo(_x,_y + _h,_x,_y,_r); ctx.arcTo(_x,_y,_x + _w,_y,_r); ctx.closePath();
            };
            rr(cx - S*0.8 - _g, cy - S*0.25 - _g, S*1.6 + _g*2, S*0.75 + _g*2, S*0.18 + _g);    //胴体
            rr(cx - S*0.05 - _g, cy - S*0.6 - _g, S*0.1 + _g*2, S*0.4 + _g*2, S*0.04 + _g);      //棒
            rr(cx - S*0.95 - _g, cy - S*0.68 - _g, S*1.9 + _g*2, S*0.12 + _g*2, S*0.06 + _g);    //プロペラ
            ctx.fill();
        };
        //薄い影を少しずつ小さくしながら重ね、ふちをなめらかにぼかす(shadowBlur は使わない)
        var G = [44,36,29,23,17,12,8,4,1];
        ctx.fillStyle = "rgba(18,20,38," + (VEIL_ALPHA*0.1) + ")";
        for(var i=0; i<G.length; i++) shape(G[i]);
        ctx.fillStyle = "rgba(18,20,38," + (VEIL_ALPHA*0.45) + ")"; shape(-4);
        //ぼんやり光る目
        ctx.fillStyle = "rgba(255,210,120,0.18)";
        ctx.beginPath(); ctx.arc(cx - S*0.32, cy + S*0.1, S*0.12, 0, Math.PI*2); ctx.arc(cx + S*0.32, cy + S*0.1, S*0.12, 0, Math.PI*2); ctx.fill();
        //影の後ろの弾は、うっすら光る輪だけ見える(見えにくいが、まったく見えないわけではない)
        ctx.strokeStyle = "rgba(255,130,130,0.5)"; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(Math.abs(b.x - cx) > S*1.3 || Math.abs(b.y - cy) > S) continue;
            ctx.moveTo(b.x + (b.r || 5) + 1, b.y); ctx.arc(b.x, b.y, (b.r || 5) + 1, 0, Math.PI*2);
        }
        ctx.stroke();
        //ドローン君の位置(影に隠れても見失わないように)
        ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(drone.X, drone.Y, 16, 0, Math.PI*2); ctx.stroke();
        ctx.lineWidth = 1;
    },
    //ガラスに張り付いた液体：垂れる筋・ふくらんだ先・半透明のかたまり・光るつや(消える前は薄くなる)
    drawSplat:function(S){
        var a = Math.min(1, (GLASS_LIFE - S.t)/90), pop = S.t < 8 ? 1.25 - 0.25*S.t/8 : 1;
        var fill = function(_g,_color){
            ctx.fillStyle = _color;
            ctx.beginPath();
            for(var i=0; i<S.blobs.length; i++){
                var B = S.blobs[i], R = B[2]*pop + _g;
                ctx.moveTo(S.x + B[0] + R, S.y + B[1]); ctx.arc(S.x + B[0], S.y + B[1], R, 0, Math.PI*2);
            }
            for(var i=0; i<S.drips.length; i++){
                var D = S.drips[i], w = D.w + _g;
                if(D.len < 1) continue;
                //上は太く、下へ細くなって、先にしずくがふくらむ
                var x = S.x + D.x, y0 = S.y + 6, y1 = y0 + D.len;
                ctx.moveTo(x - w*0.9, y0); ctx.lineTo(x + w*0.9, y0); ctx.lineTo(x + w*0.35, y1); ctx.lineTo(x - w*0.35, y1); ctx.closePath();
                ctx.moveTo(x + w*0.85, y1); ctx.arc(x, y1, w*0.85, 0, Math.PI*2);
            }
            ctx.fill();
        };
        fill(2, "rgba(50,95,20," + (0.45*a) + ")");
        fill(0, "rgba(124,194,46," + (0.5*a) + ")");
        ctx.fillStyle = "rgba(255,255,255," + (0.55*a) + ")";
        ctx.beginPath(); ctx.ellipse(S.x - 9, S.y - 9, 7, 3.5, -0.6, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(S.x + 8, S.y - 4, 2, 0, Math.PI*2); ctx.fill();
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
            if(enemies[i].intercept && !enemies[i].dead && !enemies[i].intercept.quiet) this.drawIntercept(enemies[i]);
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
        var curId = this.list[this.labIndex()].id;
        enemies = enemies.filter(function(e){ return !e.lab || e.labId == curId; });   //試作の的・敵(迎撃・潜る敵)は、ほかの攻撃では消す
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
            case "deep":
                //ドローン君のいる所へ。3回に1回は、まわりにも2つ
                if(T % 55 == 40){
                    this.deep(tg.X, tg.Y);
                    if(Math.floor(T/55) % 3 == 2){
                        for(var i=0; i<2; i++){ var a = Math.random()*Math.PI*2; this.deep(Math.max(30, Math.min(CW - 30, tg.X + Math.cos(a)*90)), Math.max(30, Math.min(CH - 30, tg.Y + Math.sin(a)*90))); }
                    }
                }
                break;
            case "ram":
                if(T % 130 == 40) this.ram();
                break;
            case "hoop":
                //傾きをずらした2つの輪(ジャイロのように交わる)
                if(T == 40){ this.hoop(x, y + 40, 0); this.hoop(x, y + 40, Math.PI/2); }
                break;
            case "diver":
                if(!enemies.some(function(e){ return e.labId == "diver"; }) && T % 60 == 0) this.diver(x, y + 60);
                break;
            case "veil":
                //影が横切る間も、砲台はふつうに撃ち続ける(影の後ろの弾が見えにくい)
                if(T == 60 || T == 300) this.veilStart();
                if(T % 30 == 0){ fireFan(x, y, aim, 5, 0.25, 2.2*m, "normal"); shot = true; }
                break;
            case "glass":
                if(T % 60 == 40) this.glob(x, y, Math.max(60, Math.min(CW - 60, tg.X + (Math.random() - 0.5)*160)), Math.max(60, Math.min(CH - 60, tg.Y + (Math.random() - 0.5)*120)));
                if(T % 25 == 0){ fireFan(x, y, aim, 3, 0.3, 2.4*m, "normal"); shot = true; }
                break;
            case "gate":
                //すき間の壁が左右から交互に来る(すき間はドローン君の近くの高さ)。砲台は弾を撃ち続ける(壁で止まる)
                if(T % 120 == 40){
                    var gy = Math.max(OBST_GAP/2 + 20, Math.min(CH - OBST_GAP/2 - 20, tg.Y + (Math.random() - 0.5)*240));
                    this.wall(Math.floor(T/120) % 2 ? 1 : -1, gy);
                }
                if(T % 40 == 0){ fireFan(x, y, aim, 3, 0.25, 2.4*m, "normal"); shot = true; }
                break;
            case "drift":
                //コンテナが左右から流れてくる。砲台の弾をコンテナの陰でよけられる
                if(T % 45 == 0) this.crate(Math.random() < 0.5 ? 1 : -1, 140 + Math.random()*(CH - 200));
                if(T % 32 == 0){ fireFan(x, y, aim, 5, 0.18, 2.6*m, "normal"); shot = true; }
                break;
            case "intercept":
                //砲台の代わりに、迎撃する的を置く(撃たない。ドローン君の弾を撃ち落とす)
                if(!enemies.some(function(e){ return e.labId == "intercept"; })){
                    var e = makeEnemy("spinner");
                    e.lab = true; e.labId = "intercept"; e.score = 0; e.parts = 0;
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
            ctx.font = on ? "bold 12px sans-serif" : "11px sans-serif";
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
