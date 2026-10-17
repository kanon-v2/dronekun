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

//---- 核弾頭 ----
//砲台が真上へ撃ち上げ、撃ったときのドローン君の位置へ、上から再突入の炎をまとって落ちてくる。落ちる所に大きな危険範囲と秒読み。
//弾頭は敵として撃てる(撃ち落とせば空中で砕けるだけ)。着くと超高温の閃光で範囲の中が真っ白に焼け(一瞬時が止まる)、範囲の中にいれば被弾。
//範囲の中の敵の弾は焼き消える。爆心はしばらく赤熱して(入ると被弾。冷えながら縮む)、まわりの空気が熱でゆらぎ、焦げ跡が残る
const NUKE_LAUNCH   = 45;       //撃ち上げて画面の上へ消えるまで(フレーム)
const NUKE_FALL     = 200;      //上から落ちてきて着くまで(フレーム)
const NUKE_R        = 170;      //爆発の範囲(半径。px)
const NUKE_HP       = 12;       //弾頭の体力(撃つ敵 shooter の何倍か)
const NUKE_STOP     = 12;       //爆発の瞬間、真っ白のまま時を止める長さ(フレーム。ヒットストップ)
const NUKE_FLASH    = 100;      //閃光(範囲の中だけ)が白 → 黄 → 橙と色を変えながら消えるまで(フレーム)
const NUKE_FIRE     = 80;       //火の玉が縮んで消えるまで(フレーム)
const NUKE_WAVE     = 50;       //衝撃波の輪が画面の外まで広がるまで(フレーム。見た目だけ)
const NUKE_HEAT     = 130;      //爆心の赤熱が冷えて消えるまで(フレーム)
const NUKE_HEAT_R   = 0.55;     //赤熱のはじめの大きさ(NUKE_R に掛ける。冷えながら縮む)
const NUKE_HAZE     = 18;       //熱で空気がゆらぐ強さ(はじめの横ずれ。px)

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

//---- 空戦(ドッグファイト)の試作：戦闘機 ----
//戦闘機は機首の向き(e.fighter.ang)を持ち、曲がれる速さに限りがある。ドローン君の後ろ(動いてきた向きの逆)へ回り込もうとする。
//ドローン君の向きは、動いた向きを覚えておく(止まっても変わらない。shotLab.head)
const FIGHT_HP          = 10;       //体力(射撃する敵の体力に掛ける)
const FIGHT_R           = 13;       //当たり判定(px)
const FIGHT_TURN        = 0.05;     //曲がる速さ(ラジアン/フレーム)
const FIGHT_SPEED       = [1,4.6];      //速さの下限・上限(px/フレーム。付きたい位置から遠いほど速い)
const FIGHT_TAIL_DIST   = 130;      //ドローン君の後ろのどこへ付こうとするか(px)
const FIGHT_RANGE       = 280;      //後ろを取る・ロックオンできる距離(px)
const FIGHT_REAR        = 0.55;     //後ろとみなす角度(真後ろから左右へ。ラジアン)
const FIGHT_NOSE        = 0.35;     //機首の前とみなす角度(左右へ。ラジアン)
const FIGHT_GUN_EVERY   = 7;        //後ろを取った戦闘機が機銃を撃つ間隔(フレーム)
const FIGHT_GUN_SPEED   = 4.2;      //機銃の弾の速さ(danmaku() を掛ける)
const FIGHT_BACK_MUL    = 3;        //後ろの取り合い：後ろを取っている間、戦闘機へのダメージに掛ける
const FIGHT_EVADE_AFTER = 45;       //後ろを取られ続けると、急旋回で振り切ろうとするまで(フレーム)
const FIGHT_EVADE_T     = 50;       //急旋回の長さ(フレーム)
const FIGHT_HEAD_TURN   = 0.15;     //ドローン君の向きが動いた向きへ寄る速さ(ラジアン/フレーム)
const FIGHT_HEAD_MIN    = 1;        //この速さ(px/フレーム)より速く動いたときだけ向きを変える
//ロックオン：機首(ドローン君は向き)の前に相手を入れ続けるとロックが完成する。外れるとロックが減っていく
const LOCK_CONE         = 0.5;      //戦闘機がロックできる角度(機首から左右へ。ラジアン)
const LOCK_CONE_PLAYER  = 0.6;      //ドローン君がロックできる角度(向きから左右へ。ラジアン。ドローン君は急に曲がれるぶん広め)
const LOCK_ENEMY_T      = 75;       //戦闘機がドローン君をロックするまで(フレーム)
const LOCK_PLAYER_T     = 50;       //ドローン君が戦闘機をロックするまで(フレーム)
const LOCK_DECAY        = 1;        //外れている間にロックが減る速さ(1フレームあたり)
const LOCK_MISSILES     = 2;        //戦闘機がロックしたときに撃つ追尾ミサイルの数
const LOCK_STRIKE       = 0.34;     //ドローン君がロックしたときの一撃(戦闘機の最大体力に対する割合)
const LOCK_COOL         = 60;       //撃ったあと、次のロックを始めるまで(フレーム)
//投げなわ：ドローン君の通った跡が交わって輪になったら、輪の中の敵・弾をまとめて攻撃する
const LASSO_STEP        = 6;        //跡の点を足す間隔(px)
const LASSO_LIFE        = 180;      //跡が残る長さ(フレーム。追従が遅くても輪を描ききれる長さ)
const LASSO_MIN_AREA    = 2500;     //輪と数えるいちばん小さい広さ(px²。小さな揺れで閉じないように)
const LASSO_DMG         = 0.5;      //輪で囲んだ敵へのダメージ(最大体力に対する割合。殻の敵は1回で倒れる)
const LASSO_FLASH       = 30;       //閉じた輪が光って消えるまで(フレーム)
const SHELL_N           = 4;        //攻撃の試作で出す殻の敵の数(殻があって、ふつうの弾では倒せない)
const SHELL_SPEED       = 0.9;      //殻の敵の速さ(px/フレーム)
//ポインタ狙い：ドローン君ではなく、ポインタ(これから行く所)を撃つ
const PTR_EVERY         = 40;       //扇を撃つ間隔(フレーム)
const PTR_SNIPE_EVERY   = 3;        //この回数に1回は、照準の線でポインタを追ってから針弾で狙い撃つ
const PTR_SNIPE_T       = 45;       //照準の線を出してから撃つまで(フレーム)
//場：風。ドローン君(と敵の弾)が流される。ポインタを風上へずらして合わせる
const WIND_PUSH         = 2.2;      //いちばん強いときにドローン君が流される速さ(px/フレーム)
const WIND_SHOT_PUSH    = 0.6;      //敵の弾が流される速さ(px/フレーム)
const WIND_TIMES        = { calm:50, warn:50, blow:170 };   //なぎ → 予告(向きの矢印) → 吹く(フレーム)
const WIND_RAMP         = 0.04;     //風の強さが変わる速さ(1フレームあたり)
//場：鏡。円の中では左右が逆に付いていく(ポインタを左へ置くと右へ進む)
const MIRROR_R          = 115;      //円の半径(px)
const MIRROR_SPEED      = 0.7;      //円が流れる速さ(px/フレーム)
//場：クモの糸。投げられた糸が開いて巣になる。巣の中では遅くなり、ポインタを激しく振るとほどける
const WEB_R             = 70;       //巣の半径(px)
const WEB_FLY           = 45;       //糸の玉が飛んで着くまで(フレーム)
const WEB_OPEN          = 12;       //巣が開くまで(フレーム)
const WEB_LIFE          = 480;      //巣が残る長さ(フレーム)
const WEB_SLOW          = 8;        //巣の中では追従の遅れがこの倍になる
const WEB_HP            = 1400;     //ほどくのに要るポインタの動き(px の合計)
const WEB_EVERY         = 100;      //糸を投げる間隔(フレーム)

//デバッグの「攻撃の試作」
const SHOT_LAB_WAVE = 7;           //弾の速さ・数はこのWAVEのもの(ボス・ライバルのWAVEは選ばない)
const SHOT_LAB_SEC  = 7;            //1種類を出す秒数(自動で順番に切り替えるとき。選んだ攻撃もこの長さで繰り返す)
const LAB_LIST_Y    = 84;           //左の一覧の上の端(px)
const LAB_ROW_H     = 14;          //一覧の1行の高さ(px)
const LAB_LIST_W    = 150;          //一覧の1列の幅(px)
const LAB_COL_ROWS  = 18;           //一覧の1列の行の数(あふれたら右の列へ)

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
        { id:"nuke",   name:"核弾頭",       note:"落ちる所の範囲から逃げる。弾頭を撃ち落とせば爆発しない" },
        { id:"intercept", name:"迎撃(能力)", note:"近づいた弾を撃ち落とす(1秒に" + INTERCEPT_PER_SEC + "発まで)。数で押し切る" },
        { id:"tail",   name:"空戦：後ろの取り合い", note:"後ろを取るとダメージ" + FIGHT_BACK_MUL + "倍。取られると機銃を撃たれる" },
        { id:"lock",   name:"空戦：ロックオン", note:"向きを合わせ続けるとロックして一撃。ロックされたら振り切る" },
        { id:"lasso",  name:"投げなわ",     note:"通った跡で輪を作ると、中の敵・弾をまとめて攻撃。殻の敵は輪でしか倒せない" },
        { id:"ptraim", name:"ポインタ狙い", note:"ポインタ(これから行く所)を撃つ。ポインタを逆へ振ってだます" },
        { id:"wind",   name:"場：風",       note:"風に流される。ポインタを風上へずらして合わせる" },
        { id:"mirror", name:"場：鏡",       note:"紫の円の中では、左右が逆に付いていく" },
        { id:"web",    name:"場：クモの糸", note:"巣に掛かると遅くなる。ポインタを激しく振るとほどける" }
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
    nukes:[],       //核弾頭 { e:弾頭の敵, x0, y0, tx, ty, t, mode:"launch"|"fall" }
    booms:[],       //核の爆発のあと { x, y, t }(衝撃波の輪・火の玉・きのこ雲・放射能の残り)
    head:-Math.PI/2,    //空戦：ドローン君の向き(動いた向きを覚える。ラジアン)
    lasso:null,     //投げなわ { pts:[{x,y,t}], flashes:[{poly,t}] }(攻撃の試作で使う間だけ)
    ptr:null,       //ポインタ狙い { n:撃った回数, snipe:照準の線の残り(0 なら出ていない), ax, ay:照準の先 }
    field:null,     //付いていく動きを邪魔する場 { kind:"wind"|"mirror"|"web", t, … }
    mouse:null,     //前のフレームのポインタの位置(クモの糸をほどく動きを数える)

    //試作の攻撃を全部消す(WAVEの始め・クリア・攻撃の試作で次の種類へ移るとき)
    clear:function(){
        this.zones = [];
        this.buckets = [];
        this.storm = null;
        this.puddles = [];
        this.night = 0;
        this.deeps = []; this.rams = []; this.hoops = []; this.veil = null; this.globs = []; this.splats = [];
        this.obstacles = [];
        for(var i=0; i<this.nukes.length; i++) this.nukes[i].e.dead = true;     //落ちている途中の弾頭(敵)も消す
        this.nukes = []; this.booms = [];
        this.lasso = null; this.ptr = null; this.field = null;
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
    //空戦の戦闘機を出す(_kind："tail" 後ろの取り合い・"lock" ロックオン)
    fighter:function(_kind,_x,_y){
        var e = makeEnemy("shooter");
        e.x = _x; e.y = _y; e.vx = 0; e.vy = 0;
        e.r = FIGHT_R;
        e.hp = e.maxHp = e.maxHp*FIGHT_HP;
        e.score = 0; e.parts = 0;
        e.lab = bossDebug.lab; e.labId = _kind;
        e.fighter = { kind:_kind, ang:Math.atan2(CH/2 - _y, CW/2 - _x), spd:FIGHT_SPEED[1], trail:[],
                      six:false, sixT:0, onSix:false, evade:0, evDir:1, gun:0,
                      lock:0, beep:0, cool:0, pLock:0, pCool:0 };
        enemies.push(e);
        return e;
    },
    //2つの向きの差(0～π)
    angGap:function(_a,_b){
        return Math.abs(Math.atan2(Math.sin(_a - _b), Math.cos(_a - _b)));
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
    //核弾頭を(_x,_y)から撃ち上げる。落ちる所は撃ったときのドローン君の位置
    nuke:function(_x,_y){
        var tg = nearestPlayer(_x,_y);
        var e = makeEnemy("shooter");
        e.x = _x; e.y = _y; e.vx = 0; e.vy = 0;
        e.r = 13;
        e.hp = e.maxHp = e.maxHp*NUKE_HP;
        e.score = 0; e.parts = 0;
        e.nuke = true;
        e.lab = bossDebug.lab; e.labId = "nuke";
        e.phased = true; e.harmless = true;     //撃ち上げている間は狙えない。体当たりもしない
        enemies.push(e);
        var n = { e:e, x0:_x, y0:_y, tx:tg.X, ty:tg.Y, t:0, mode:"launch" };
        this.nukes.push(n);
        fx.flare(_x, _y, 26, "255,190,90", 14);
        fx.shake(3);
        sound.play("nukeLaunch");
        return n;
    },
    //核弾頭が着いて爆発する：超高温の閃光で範囲の中が真っ白に焼け、一瞬時が止まる。範囲の中は被弾、敵の弾は焼き消える
    nukeBlast:function(n){
        var ms = mainScreen;
        if(ms.state != "over" && Math.hypot(drone.X - n.tx, drone.Y - n.ty) < NUKE_R + HIT_CORE && ms.canBeHit()) ms.damage();
        for(var i=enemyShots.length-1; i>=0; i--){
            var b = enemyShots[i];
            if(Math.hypot(b.x - n.tx, b.y - n.ty) < NUKE_R){ fx.flare(b.x, b.y, 10, "255,200,120", 18); enemyShots.splice(i,1); }
        }
        this.booms.push({ x:n.tx, y:n.ty, t:0 });
        ms.hitStop = Math.max(ms.hitStop, NUKE_STOP);
        fx.shake(18);
        battleBg.ripple(n.tx, n.ty, 30, 10, 80, "255,210,140");
        sound.play("nuke");
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
        this.nukeStep();
        this.lassoStep();
        this.fieldStep();
        if(drone.Speed > FIGHT_HEAD_MIN) this.head = turnTo(this.head, Math.atan2(drone.SpeedY, drone.SpeedX), FIGHT_HEAD_TURN);
    },
    //核弾頭：撃ち上げ → 上から落ちてくる → 着いたら爆発。撃ち落とされたら空中で砕ける
    nukeStep:function(){
        for(var i=this.nukes.length-1; i>=0; i--){
            var n = this.nukes[i], e = n.e;
            if(e.dead){
                //撃ち落とした(爆発しない)
                popup(e.x, e.y - 30, "撃墜！", "#c33", true);
                fx.flare(e.x, e.y, 40, "255,220,120", 16);
                fx.sparks(e.x, e.y, 14, "255,200,90", 3.5, 3);
                this.nukes.splice(i,1);
                continue;
            }
            n.t++;
            if(n.mode == "launch"){
                //真上へ加速して画面の上へ
                var k = n.t/NUKE_LAUNCH;
                e.x = n.x0; e.y = n.y0 - (n.y0 + 60)*k*k;
                if(n.t >= NUKE_LAUNCH){
                    n.mode = "fall"; n.t = 0;
                    e.phased = false;
                    sound.play("warning");
                }
            }else{
                //再突入の炎をまとってまっすぐ落ちる(だんだん速く。空気にもまれて細かく震える)。燃えかすを散らす
                var k = n.t/NUKE_FALL, y0 = -50;
                e.x = n.tx + (Math.random() - 0.5)*1.2;
                e.y = y0 + (n.ty - y0)*(0.6*k + 0.4*k*k);
                if(n.t % 3 == 0) fx.sparks(e.x + (Math.random() - 0.5)*14, e.y - 6, 1, "255,170,80", 1.2, 2.2);
                if(n.t >= NUKE_FALL){
                    e.dead = true;
                    this.nukes.splice(i,1);
                    this.nukeBlast(n);
                }
            }
        }
        //爆発のあと：赤熱した爆心の中にいれば被弾。熱で火の粉が立ちのぼる
        var ms = mainScreen;
        for(var i=this.booms.length-1; i>=0; i--){
            var B = this.booms[i];
            B.t++;
            var hr = this.heatR(B);
            if(hr > 0 && B.t > 10 && ms.state != "over" && Math.hypot(drone.X - B.x, drone.Y - B.y) < hr + HIT_CORE && ms.canBeHit()) ms.damage();
            if(hr > 0 && B.t % 2 == 0){
                var a = Math.random()*Math.PI*2, d = Math.random()*hr;
                effects.push({ x:B.x + Math.cos(a)*d, y:B.y + Math.sin(a)*d, vx:(Math.random() - 0.5)*0.6, vy:-0.8 - Math.random()*1.4,
                               life:30 + Math.random()*20, maxLife:50, size:1.5 + Math.random()*1.5, glow:"255,150,60" });
            }
            if(B.t >= Math.max(NUKE_HEAT, NUKE_FLASH)) this.booms.splice(i,1);
        }
    },
    //爆心の赤熱の大きさ(半径。0 ならもう冷えた)
    heatR:function(B){
        if(B.t >= NUKE_HEAT) return 0;
        return NUKE_R*NUKE_HEAT_R*(1 - Math.pow(B.t/NUKE_HEAT, 1.5));
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
        if(e.nuke) return true;     //核弾頭の動きは nukeStep
        if(e.fighter) return this.fighterStep(e);
        if(e.shell) return this.shellStep(e);
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
    //空戦の戦闘機：ドローン君の後ろへ回り込む。後ろを取られ続けると急旋回で振り切る(いつも true：ふだんの動きをしない)
    fighterStep:function(e){
        var F = e.fighter, ms = mainScreen, m = danmaku(), play = ms.state == "play";
        var tg = nearestPlayer(e.x, e.y), h = this.head;
        var toD = Math.atan2(tg.Y - e.y, tg.X - e.x), d = Math.hypot(tg.X - e.x, tg.Y - e.y);
        //位置関係：戦闘機がドローン君の後ろで機首を向けている(onSix)／ドローン君が戦闘機の後ろにいる(six)
        var onSix = d < FIGHT_RANGE && this.angGap(toD + Math.PI, h + Math.PI) < FIGHT_REAR && this.angGap(F.ang, toD) < FIGHT_NOSE;
        var dd = Math.hypot(drone.X - e.x, drone.Y - e.y), fromE = Math.atan2(drone.Y - e.y, drone.X - e.x);
        var six = dd < FIGHT_RANGE && this.angGap(fromE, F.ang + Math.PI) < FIGHT_REAR;
        var tail = F.kind == "tail";
        if(tail && six && !F.six){ popup(e.x, e.y - 26, "後ろを取った！", "#e0a800"); sound.play("comboUp"); this.labCount.six++; }
        if(tail && onSix && !F.onSix && play){ popup(tg.X, tg.Y - 30, "後ろを取られた！", "#d33"); sound.play("error"); this.labCount.tailed++; }
        F.six = six; F.onSix = onSix;
        //後ろを取られ続けたら、左右どちらかへ急旋回して振り切る
        F.sixT = six ? F.sixT + 1 : 0;
        if(F.sixT >= FIGHT_EVADE_AFTER && F.evade <= 0){ F.evade = FIGHT_EVADE_T; F.evDir = Math.random() < 0.5 ? 1 : -1; F.sixT = 0; }
        //行きたい向き：ドローン君の後ろ(FIGHT_TAIL_DIST)。着いたらドローン君へ機首を向ける
        var goal, spd;
        if(F.evade > 0){
            F.evade--;
            goal = F.ang + F.evDir*1.2;
            spd = FIGHT_SPEED[1];
        }else{
            var px = tg.X - Math.cos(h)*FIGHT_TAIL_DIST, py = tg.Y - Math.sin(h)*FIGHT_TAIL_DIST;
            var pd = Math.hypot(px - e.x, py - e.y);
            goal = pd > 50 ? Math.atan2(py - e.y, px - e.x) : toD;
            spd = Math.max(FIGHT_SPEED[0], Math.min(FIGHT_SPEED[1], pd*0.025 + drone.Speed));
        }
        //画面の端に近いと内側へ向き直る
        var M = 50;
        if(e.x < M || e.x > CW - M || e.y < M || e.y > CH - M) goal = turnTo(goal, Math.atan2(CH/2 - e.y, CW/2 - e.x), 0.9);
        F.ang = turnTo(F.ang, goal, FIGHT_TURN*(F.evade > 0 ? 1.6 : 1));
        F.spd += (spd - F.spd)*0.05;
        var sp = 1;
        if(e.slow > 0){ e.slow--; sp = 0.4; }       //EMP
        e.vx = Math.cos(F.ang)*F.spd; e.vy = Math.sin(F.ang)*F.spd;
        e.x += e.vx*sp; e.y += e.vy*sp;
        e.face = F.ang;
        F.trail.unshift({ x:e.x, y:e.y });
        if(F.trail.length > 18) F.trail.pop();
        var nx = e.x + Math.cos(F.ang)*e.r, ny = e.y + Math.sin(F.ang)*e.r;
        if(tail){
            //後ろの取り合い：後ろを取ったら機首の向きへ機銃
            if(onSix && play && ++F.gun % FIGHT_GUN_EVERY == 0){
                fireShot(nx, ny, F.ang + (Math.random() - 0.5)*0.08, FIGHT_GUN_SPEED*m, "small");
                sound.play("enemyShot");
            }
            return true;
        }
        //ロックオン：戦闘機 → ドローン君(機首の前に入れ続ける)
        if(F.cool > 0) F.cool--;
        else if(d < FIGHT_RANGE && this.angGap(F.ang, toD) < LOCK_CONE && play){
            F.lock++;
            //警告音はロックが進むほど速くなる
            if(--F.beep <= 0){ sound.play("mine"); F.beep = Math.round(18 - 13*F.lock/LOCK_ENEMY_T); }
            if(F.lock >= LOCK_ENEMY_T){
                for(var i=0; i<LOCK_MISSILES; i++){
                    var a = F.ang + (i % 2 ? 1 : -1)*(0.5 + 0.2*Math.floor(i/2));
                    enemyShots.push({ x:nx, y:ny, vx:Math.cos(a)*2.5, vy:Math.sin(a)*2.5, r:5, kind:"missile",
                                      homing:true, turn:0.045, speed:3.6, life:170, grazed:false });
                }
                popup(tg.X, tg.Y - 30, "ミサイル！", "#d33", true);
                sound.play("missile");
                F.lock = 0; F.cool = LOCK_COOL;
                this.labCount.locked++;
            }
        }else F.lock = Math.max(0, F.lock - LOCK_DECAY);
        //ロックオン：ドローン君 → 戦闘機(向きの前に入れ続ける)。できたら一撃
        if(F.pCool > 0) F.pCool--;
        else if(dd < FIGHT_RANGE && this.angGap(h, fromE + Math.PI) < LOCK_CONE_PLAYER){
            if(++F.pLock >= LOCK_PLAYER_T){
                F.pLock = 0; F.pCool = LOCK_COOL;
                this.labCount.lock++;
                fx.line(drone.X, drone.Y, e.x, e.y, "110,210,255", 3, 12);
                fx.flare(e.x, e.y, 40, "110,210,255", 14);
                fx.shake(4);
                popup(e.x, e.y - 28, "LOCK！", "#1a8fd0", true);
                sound.play("snipe");
                ms.hitEnemy(e, e.maxHp*LOCK_STRIKE, "skill");
            }
        }else F.pLock = Math.max(0, F.pLock - LOCK_DECAY);
        return true;
    },
    //戦闘機へのダメージ(mainScreen.hitEnemy から)：後ろの取り合いで後ろを取っている間は FIGHT_BACK_MUL 倍
    fighterHit:function(e,_dmg){
        if(e.fighter.kind != "tail" || !e.fighter.six) return _dmg;
        if(Math.random() < 0.3) fx.sparks(e.x, e.y, 3, "255,210,60", 2, 2);
        return _dmg*FIGHT_BACK_MUL;
    },
    //奥にいる敵を、消失点へ寄せて小さく薄く描く(mainScreen.drawEnemy から。描いたら true)
    //試作の敵の絵(mainScreen.drawEnemy から。描いたら true)
    drawEnemy:function(e){
        if(e.nuke){ this.drawWarhead(e); return true; }
        if(e.fighter){ this.drawFighter(e); return true; }
        if(e.depth > 0) return this.drawDeepEnemy(e);
        return false;
    },
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
    //空戦の戦闘機：三角の翼の機体。飛行機雲と、後ろ(弱いところ)か機首の前(ロックされる範囲)を薄く出す
    drawFighter:function(e){
        var F = e.fighter, tail = F.kind == "tail";
        //飛行機雲
        ctx.lineCap = "round";
        for(var i=1; i<F.trail.length; i++){
            var A = F.trail[i - 1], B = F.trail[i], k = i/F.trail.length;
            ctx.strokeStyle = "rgba(90,100,115," + (0.4*(1 - k)).toFixed(3) + ")";
            ctx.lineWidth = 4 - 3*k;
            ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        }
        ctx.save();
        ctx.translate(e.x, e.y);
        var cone = tail ? [F.ang + Math.PI, FIGHT_REAR, 110, "240,180,0", F.six ? 0.24 : 0.08]
                        : [F.ang, LOCK_CONE, FIGHT_RANGE, "230,50,40", 0.05 + 0.15*F.lock/LOCK_ENEMY_T];
        ctx.fillStyle = "rgba(" + cone[3] + "," + cone[4].toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, cone[2], cone[0] - cone[1], cone[0] + cone[1]); ctx.closePath(); ctx.fill();
        ctx.rotate(F.ang);
        //噴射の炎(速いほど長い)。後ろを取られている間は噴射口が黄色く光る(弱いところ)
        var fl = 6 + Math.sin(e.t*0.9)*2 + F.spd*1.3;
        if(tail && F.six){
            ctx.fillStyle = "rgba(255,215,50,0.35)";
            ctx.beginPath(); ctx.arc(-13, 0, 10 + Math.sin(e.t*0.4)*2, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = "rgba(255,140,40,0.9)";
        ctx.beginPath(); ctx.moveTo(-12,-3.5); ctx.lineTo(-12 - fl,0); ctx.lineTo(-12,3.5); ctx.fill();
        ctx.fillStyle = "rgba(255,240,170,0.95)";
        ctx.beginPath(); ctx.moveTo(-12,-1.8); ctx.lineTo(-12 - fl*0.55,0); ctx.lineTo(-12,1.8); ctx.fill();
        //機体(上半分の点を、下へ折り返してつなぐ)
        var P = [[18,0],[5,-4],[-3,-15],[-10,-15],[-7,-5],[-11,-5],[-14,-10],[-17,-10],[-14,0]];
        ctx.beginPath();
        for(var i=0; i<P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
        for(var i=P.length - 2; i>0; i--) ctx.lineTo(P[i][0], -P[i][1]);
        ctx.closePath();
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#1d2128"; ctx.lineWidth = 3.5; ctx.stroke();
        ctx.fillStyle = e.flash > 0 ? "#fff" : "#56606d"; ctx.fill();
        //翼の先の赤いしるし
        ctx.fillStyle = "#c8322a";
        ctx.fillRect(-9.5,-14.5,5,2.5); ctx.fillRect(-9.5,12,5,2.5);
        //操縦席
        ctx.fillStyle = "#1d2128";
        ctx.beginPath(); ctx.ellipse(6, 0, 5, 2.8, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#e05a3a";
        ctx.beginPath(); ctx.ellipse(6, 0, 3.6, 1.7, 0, 0, Math.PI*2); ctx.fill();
        //ハイライトの線(機首から翼の前のふち)
        ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(15,-1); ctx.lineTo(5,-3); ctx.lineTo(-2,-12); ctx.stroke();
        ctx.restore();
        ctx.lineWidth = 1; ctx.lineCap = "butt";
    },
    //ロックオンの表示(弾の上に描く)：ドローン君の向きの矢印・自分のロック(水色の輪)・戦闘機のロック(赤いかぎ括弧)
    drawLockUi:function(e){
        var F = e.fighter, now = e.t;
        if(F.kind != "lock") return;
        ctx.lineJoin = "round";
        var h = this.head;
        ctx.save();
        ctx.translate(drone.X + Math.cos(h)*32, drone.Y + Math.sin(h)*32);
        ctx.rotate(h);
        ctx.strokeStyle = "rgba(30,140,210,0.8)"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-4,-6); ctx.lineTo(3,0); ctx.lineTo(-4,6); ctx.stroke();
        ctx.restore();
        if(F.pLock > 0){
            var k = F.pLock/LOCK_PLAYER_T, R = 30 - 8*k;
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(30,150,220,0.3)";
            ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "#1a8fd0";
            ctx.beginPath(); ctx.arc(e.x, e.y, R, -Math.PI/2, -Math.PI/2 + Math.PI*2*k); ctx.stroke();
            ctx.lineWidth = 2;
            for(var i=0; i<4; i++){
                var a = i*Math.PI/2 + now*0.05;
                ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a)*(R + 3), e.y + Math.sin(a)*(R + 3));
                ctx.lineTo(e.x + Math.cos(a)*(R + 9), e.y + Math.sin(a)*(R + 9)); ctx.stroke();
            }
        }
        if(F.lock > 0){
            var k = F.lock/LOCK_ENEMY_T, s = 40 - 22*k;
            //どこからロックされているか(戦闘機からの点線)
            ctx.setLineDash([4,6]);
            ctx.strokeStyle = "rgba(224,48,42,0.5)"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(drone.X, drone.Y); ctx.stroke();
            ctx.setLineDash([]);
            //かぎ括弧は縮みながら近づき、もうすぐのときは点滅する
            if(k < 0.7 || Math.floor(now/4) % 2 == 0){
                ctx.strokeStyle = "#e0302a"; ctx.lineWidth = 2.5;
                for(var sx=-1; sx<=1; sx+=2) for(var sy=-1; sy<=1; sy+=2){
                    var cx = drone.X + sx*s, cy = drone.Y + sy*s;
                    ctx.beginPath(); ctx.moveTo(cx - sx*9, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy*9); ctx.stroke();
                }
            }
            if(k > 0.25){
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.font = "bold 12px sans-serif";
                ctx.fillStyle = "#e0302a";
                ctx.fillText("ロックされている！", drone.X, drone.Y - s - 12);
            }
        }
        ctx.lineWidth = 1;
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
        if(rival.stepShot(b)) return true;                  //ライバルの針の弾(rival.js)
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
        if(rival.drawShot(b)) return true;                  //ライバルの針の弾(rival.js)
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
        this.drawNukeUnder();
        this.drawMouseUnder();
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
    //---- 核弾頭の絵 ----
    //放射能の印(三つ葉)
    trefoil:function(_x,_y,_r,_col){
        ctx.fillStyle = _col;
        for(var k=0; k<3; k++){
            var a = -Math.PI/2 + k*Math.PI*2/3 - Math.PI/6;
            ctx.beginPath(); ctx.moveTo(_x,_y); ctx.arc(_x, _y, _r, a, a + Math.PI/3); ctx.closePath(); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(_x, _y, _r*0.22, 0, Math.PI*2); ctx.fill();
    },
    //弾頭の胴体の形(先が下の円錐。_d だけ太らせる)
    warheadShape:function(_d){
        ctx.beginPath();
        ctx.moveTo(-9 - _d, -21 - _d); ctx.lineTo(9 + _d, -21 - _d);
        ctx.lineTo(10 + _d, -15); ctx.lineTo(12.5 + _d, -12);
        ctx.lineTo(5 + _d, 19);
        ctx.quadraticCurveTo(0, 25 + _d*1.2, -5 - _d, 19);
        ctx.lineTo(-12.5 - _d, -12); ctx.lineTo(-10 - _d, -15);
        ctx.closePath();
    },
    //弾頭：つや消しの黒い円錐(先が下)。落ちる間は先が白熱し、炎の膜をまとって炎と煙の尾を引く。撃ち上げは噴射の炎で上る
    drawWarhead:function(e){
        var n = this.nukeOf(e), up = e.phased, now = mainScreen.clock;
        var k = n && !up ? n.t/NUKE_FALL : 0, heat = up ? 0 : 0.45 + 0.55*k;
        ctx.save();
        ctx.translate(e.x, e.y);
        if(up) ctx.rotate(Math.PI);
        //煙の尾(しっぽ側へ伸びるひと続きの帯。遠いほど太く薄く、ゆらぐ)
        var SN = 24, SL = 8, left = [], right = [];
        for(var j=0; j<=SN; j++){
            var sy = -18 - j*SL, sx = Math.sin(j*0.45 - now*0.06)*j*0.35, sw = 7 + j*0.9;
            left.push([sx - sw, sy]); right.push([sx + sw, sy]);
        }
        var SG = ctx.createLinearGradient(0, -18, 0, -18 - SN*SL);
        SG.addColorStop(0, "rgba(" + (up ? "215,215,220" : "70,62,64") + ",0.55)");
        SG.addColorStop(1, "rgba(" + (up ? "215,215,220" : "70,62,64") + ",0)");
        ctx.fillStyle = SG;
        ctx.beginPath(); ctx.moveTo(left[0][0], left[0][1]);
        for(var j=1; j<=SN; j++) ctx.lineTo(left[j][0], left[j][1]);
        for(var j=SN; j>=0; j--) ctx.lineTo(right[j][0], right[j][1]);
        ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        if(up){
            //噴射の炎
            var f = 26 + Math.random()*12;
            ctx.fillStyle = "rgba(255,120,40,0.75)";
            ctx.beginPath(); ctx.moveTo(-8,-21); ctx.quadraticCurveTo(-5,-21 - f*0.6, 0,-21 - f*1.4); ctx.quadraticCurveTo(5,-21 - f*0.6, 8,-21); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "rgba(255,240,200,0.95)";
            ctx.beginPath(); ctx.moveTo(-4,-21); ctx.quadraticCurveTo(-2,-21 - f*0.4, 0,-21 - f*0.8); ctx.quadraticCurveTo(2,-21 - f*0.4, 4,-21); ctx.closePath(); ctx.fill();
        }else{
            //再突入の炎：胴体のふちからしっぽ側へ流れる炎の舌
            for(var j=0; j<5; j++){
                var bx = -11 + j*5.5, L = (34 + 26*heat)*(0.65 + 0.35*Math.sin(now*0.6 + j*2.1)) + Math.random()*8;
                var col = j == 2 ? "255,235,170" : "255,120,40";
                ctx.fillStyle = "rgba(" + col + "," + (0.35 + 0.35*heat) + ")";
                ctx.beginPath(); ctx.moveTo(bx - 4, -10); ctx.quadraticCurveTo(bx*1.2, -10 - L*0.5, bx*0.6 + Math.sin(now*0.3 + j)*3, -10 - L); ctx.quadraticCurveTo(bx*1.2 + 2, -10 - L*0.5, bx + 4, -10); ctx.closePath(); ctx.fill();
            }
            //先の前にできる衝撃波の光(白熱した空気の膜)
            var G = ctx.createRadialGradient(0, 22, 2, 0, 18, 30 + 14*heat);
            G.addColorStop(0, "rgba(255,255,240," + (0.9*heat) + ")");
            G.addColorStop(0.35, "rgba(255,200,120," + (0.6*heat) + ")");
            G.addColorStop(1, "rgba(255,90,30,0)");
            ctx.fillStyle = G;
            ctx.beginPath(); ctx.arc(0, 18, 30 + 14*heat, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(255,220,170," + (0.5*heat) + ")"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-22,-14); ctx.quadraticCurveTo(0, 50, 22,-14); ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
        //胴体：濃いふちどり → 暗い面 → 光の当たる左の面
        ctx.fillStyle = "#121418"; this.warheadShape(2); ctx.fill();
        ctx.fillStyle = "#2a2e35"; this.warheadShape(0); ctx.fill();
        ctx.save();
        this.warheadShape(0); ctx.clip();
        ctx.fillStyle = "#454b56";
        ctx.beginPath(); ctx.moveTo(-14,-22); ctx.lineTo(-3,-22); ctx.lineTo(-1,26); ctx.lineTo(-8,26); ctx.closePath(); ctx.fill();
        //継ぎ目と、しっぽの黄と黒のしま
        ctx.fillStyle = "#121418";
        ctx.fillRect(-14, -3, 28, 1.2);
        for(var j=0; j<6; j++){
            ctx.fillStyle = j % 2 ? "#121418" : "#e9b815";
            ctx.beginPath(); ctx.moveTo(-12 + j*4.5, -21); ctx.lineTo(-7.5 + j*4.5, -21); ctx.lineTo(-10.5 + j*4.5, -15); ctx.lineTo(-15 + j*4.5, -15); ctx.closePath(); ctx.fill();
        }
        //印(黄色い丸に黒い三つ葉)
        ctx.fillStyle = "#e9b815";
        ctx.beginPath(); ctx.arc(-0.5, 5, 5.2, 0, Math.PI*2); ctx.fill();
        this.trefoil(-0.5, 5, 4.4, "#121418");
        //先が熱で赤く → 白く焼ける
        if(heat > 0){
            var H = ctx.createRadialGradient(0, 24, 1, 0, 22, 14 + 18*heat);
            H.addColorStop(0, "rgba(255,250,225," + heat + ")");
            H.addColorStop(0.4, "rgba(255,160,60," + (0.85*heat) + ")");
            H.addColorStop(1, "rgba(200,40,10,0)");
            ctx.fillStyle = H;
            ctx.fillRect(-15, -22, 30, 50);
        }
        ctx.restore();
        //左上からの光
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-9.5,-11); ctx.lineTo(-4.5, 10); ctx.stroke();
        //撃たれた瞬間は白っぽく光る(形と印は見えたまま)
        if(e.flash > 0){
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            this.warheadShape(0); ctx.fill();
        }
        ctx.restore();
        ctx.lineWidth = 1;
        //体力ゲージ(落ちている間はいつも出す。撃ち落とせるとわかるように)
        if(!up){
            var w = 40, y = e.y + 34;
            ctx.fillStyle = "rgba(18,20,24,0.85)";
            ctx.fillRect(e.x - w/2 - 1, y - 1, w + 2, 5);
            ctx.fillStyle = "#ff4a2e";
            ctx.fillRect(e.x - w/2, y, w*Math.max(0, e.hp)/e.maxHp, 3);
        }
    },
    nukeOf:function(e){
        for(var i=0; i<this.nukes.length; i++){ if(this.nukes[i].e == e) return this.nukes[i]; }
        return null;
    },
    //0～1 の決まった乱数(_i 番目。爆発ごとの形を毎フレーム同じにするため)
    nukeRnd:function(_i){
        var v = Math.sin(_i*12.9898 + 78.233)*43758.5453;
        return v - Math.floor(v);
    },
    //弾の下に描くもの：落ちる所の照準と秒読み・爆心の焦げ跡と赤熱
    drawNukeUnder:function(){
        var now = mainScreen.clock;
        for(var i=0; i<this.booms.length; i++){
            var B = this.booms[i], life = Math.max(NUKE_HEAT, NUKE_FLASH);
            //焦げ跡(ふちがぎざぎざの黒い円。ゆっくり薄くなる)
            var sa = 0.5*Math.min(1, B.t/6)*Math.pow(1 - B.t/life, 0.6);
            ctx.fillStyle = "rgba(34,24,20," + sa + ")";
            ctx.beginPath();
            for(var j=0; j<=40; j++){
                var a = j*Math.PI*2/40, rr = NUKE_R*(0.82 + 0.1*this.nukeRnd(j % 40 + i*50));
                if(j == 0) ctx.moveTo(B.x + Math.cos(a)*rr, B.y + Math.sin(a)*rr); else ctx.lineTo(B.x + Math.cos(a)*rr, B.y + Math.sin(a)*rr);
            }
            ctx.fill();
            //赤熱(冷えるほど 白 → 黄 → 赤 → 暗い赤。縮んでいく)
            var hr = this.heatR(B);
            if(hr <= 0) continue;
            var temp = 1 - B.t/NUKE_HEAT;
            ctx.fillStyle = "rgba(" + fwMix("60,10,6", "150,30,10", temp) + ",0.85)";
            ctx.beginPath();
            for(var j=0; j<=24; j++){
                var a = j*Math.PI*2/24, rr = hr*(0.9 + 0.12*this.nukeRnd(j % 24 + i*50 + 7) + 0.03*Math.sin(now*0.2 + j));
                if(j == 0) ctx.moveTo(B.x + Math.cos(a)*rr, B.y + Math.sin(a)*rr); else ctx.lineTo(B.x + Math.cos(a)*rr, B.y + Math.sin(a)*rr);
            }
            ctx.fill();
            ctx.globalCompositeOperation = "lighter";
            var G = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, hr*1.25);
            G.addColorStop(0, "rgba(" + fwMix("255,90,20", "255,250,220", temp) + "," + (0.95*temp + 0.05) + ")");
            G.addColorStop(0.5, "rgba(255,110,30," + (0.6*temp) + ")");
            G.addColorStop(1, "rgba(255,60,10,0)");
            ctx.fillStyle = G;
            ctx.beginPath(); ctx.arc(B.x, B.y, hr*1.25, 0, Math.PI*2); ctx.fill();
            //地面のひび(光る割れ目)
            ctx.strokeStyle = "rgba(255,190,90," + (0.8*temp) + ")"; ctx.lineWidth = 1.5 + temp*1.5; ctx.lineCap = "round";
            ctx.beginPath();
            for(var j=0; j<9; j++){
                var a = j*Math.PI*2/9 + this.nukeRnd(j + i*50 + 20), L = hr*(1.1 + 0.4*this.nukeRnd(j + i*50 + 30));
                ctx.moveTo(B.x, B.y);
                for(var s=1; s<=4; s++){
                    var aa = a + (this.nukeRnd(j*7 + s + i*50) - 0.5)*0.5;
                    ctx.lineTo(B.x + Math.cos(aa)*L*s/4, B.y + Math.sin(aa)*L*s/4);
                }
            }
            ctx.stroke();
            ctx.lineCap = "butt"; ctx.lineWidth = 1;
            ctx.globalCompositeOperation = "source-over";
        }
        for(var i=0; i<this.nukes.length; i++){
            var n = this.nukes[i], cx = n.tx, cy = n.ty, R = NUKE_R;
            var left = n.mode == "launch" ? NUKE_LAUNCH - n.t + NUKE_FALL : NUKE_FALL - n.t;
            var k = 1 - left/(NUKE_LAUNCH + NUKE_FALL), pulse = 0.5 + 0.5*Math.sin(now*(0.1 + 0.3*k));
            //範囲(着くのが近いほど濃く、速く脈打つ)
            ctx.fillStyle = "rgba(255,40,30," + (0.05 + 0.1*k + 0.07*pulse*k) + ")";
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
            //内側の目安の輪
            ctx.strokeStyle = "rgba(220,30,30,0.22)"; ctx.lineWidth = 1;
            ctx.setLineDash([3,6]);
            ctx.beginPath(); ctx.arc(cx, cy, R/3, 0, Math.PI*2); ctx.moveTo(cx + R*2/3, cy); ctx.arc(cx, cy, R*2/3, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
            //ふち：二重の線と、ゆっくり回る目盛り
            ctx.strokeStyle = "rgba(220,25,25,0.85)"; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "rgba(220,25,25,0.4)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "rgba(220,25,25,0.6)";
            ctx.beginPath();
            for(var j=0; j<72; j++){
                var a = j*Math.PI*2/72 + now*0.003, L = j % 6 == 0 ? 10 : 4;
                ctx.moveTo(cx + Math.cos(a)*(R - 2), cy + Math.sin(a)*(R - 2));
                ctx.lineTo(cx + Math.cos(a)*(R - 2 - L), cy + Math.sin(a)*(R - 2 - L));
            }
            ctx.stroke();
            //外の4つのかぎ(逆に回る)
            ctx.strokeStyle = "rgba(220,25,25," + (0.55 + 0.35*pulse) + ")"; ctx.lineWidth = 3.5;
            for(var j=0; j<4; j++){
                var a = j*Math.PI/2 - now*0.008;
                ctx.beginPath(); ctx.arc(cx, cy, R + 14, a - 0.22, a + 0.22); ctx.stroke();
            }
            //縮んでくる輪(着く瞬間に範囲に重なる)
            ctx.strokeStyle = "rgba(220,25,25," + (0.15 + 0.6*k) + ")"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(cx, cy, R + 14 + 150*(1 - k), 0, Math.PI*2); ctx.stroke();
            //落ちてくる道筋(画面の上から範囲まで)
            if(n.mode == "fall"){
                ctx.strokeStyle = "rgba(220,25,25,0.3)"; ctx.lineWidth = 1;
                ctx.setLineDash([2,6]); ctx.lineDashOffset = -now*0.8;
                ctx.beginPath(); ctx.moveTo(cx, Math.max(0, n.e.y + 40)); ctx.lineTo(cx, cy - 34); ctx.stroke();
                ctx.setLineDash([]); ctx.lineDashOffset = 0;
            }
            //まんなかの照準(すき間のある十字と小さな輪)
            ctx.strokeStyle = "rgba(220,25,25,0.85)"; ctx.lineWidth = 2;
            ctx.beginPath();
            for(var j=0; j<4; j++){
                var a = j*Math.PI/2;
                ctx.moveTo(cx + Math.cos(a)*10, cy + Math.sin(a)*10); ctx.lineTo(cx + Math.cos(a)*30, cy + Math.sin(a)*30);
            }
            ctx.stroke();
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.stroke();
            //秒読み(小数2けた)
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.font = "bold 11px sans-serif";
            ctx.fillStyle = "rgba(200,20,20,0.9)";
            ctx.fillText("着弾まで", cx, cy + 46);
            ctx.font = "bold 26px Consolas, 'Courier New', monospace";
            var sec = (Math.max(0, left)/60).toFixed(2);
            ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,0.85)";
            ctx.strokeText(sec, cx, cy + 66);
            ctx.fillStyle = "#d01818";
            ctx.fillText(sec, cx, cy + 66);
            ctx.lineWidth = 1; ctx.textBaseline = "alphabetic";
        }
    },
    //弾の上に描くもの：熱による空気のゆらぎ・火の玉・光の筋・横に伸びる光・衝撃波の輪
    drawNukeOver:function(){
        for(var i=0; i<this.booms.length; i++){
            var B = this.booms[i];
            //熱で空気がゆらぐ：爆心のまわりを細い帯に分けて、横へずらして描き直す(キャンバスを写す。getImageData は使わない)
            if(B.t < NUKE_HEAT){
                var amp = NUKE_HAZE*Math.pow(1 - B.t/NUKE_HEAT, 2), HR = NUKE_R*1.1, m = ctx.getTransform();
                for(var dy=-HR; dy<HR; dy+=4){
                    var y = B.y + dy, half = Math.sqrt(HR*HR - dy*dy), x = B.x - half, w = half*2;
                    var off = Math.sin(y*0.09 + B.t*0.35)*amp*(1 - (dy*dy)/(HR*HR));
                    if(Math.abs(off) < 0.3 || y < 0 || y + 4 > CH) continue;
                    x = Math.max(0, x); w = Math.min(CW, B.x + half) - x;
                    if(w <= 0) continue;
                    ctx.drawImage(canvas, m.a*x + m.e, m.d*y + m.f, m.a*w, m.d*4, x + off, y, w, 4);
                }
            }
            ctx.globalCompositeOperation = "lighter";
            //火の玉(はじめは範囲いっぱいの白い光。縮みながら黄 → 橙へ)
            if(B.t < NUKE_FIRE){
                var k = B.t/NUKE_FIRE, R = NUKE_R*(1.05 - 0.6*k);
                var G = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, R);
                G.addColorStop(0, "rgba(255,255,255," + (1 - 0.5*k) + ")");
                G.addColorStop(0.3, "rgba(255,245,200," + (0.95*(1 - k)) + ")");
                G.addColorStop(0.65, "rgba(255,160,60," + (0.7*(1 - k)) + ")");
                G.addColorStop(1, "rgba(255,70,20,0)");
                ctx.fillStyle = G;
                ctx.beginPath(); ctx.arc(B.x, B.y, R, 0, Math.PI*2); ctx.fill();
            }
            //光の筋(放射状。少しずつ回りながら消える)
            if(B.t < 50){
                var k = B.t/50;
                for(var j=0; j<16; j++){
                    var a = j*Math.PI*2/16 + this.nukeRnd(j + i*50)*0.3 + B.t*0.004, L = NUKE_R*(0.9 + 0.3*this.nukeRnd(j + i*50 + 5))*(1 - 0.3*k), W = 0.06;
                    ctx.fillStyle = "rgba(255,240,210," + (0.35*(1 - k)) + ")";
                    ctx.beginPath(); ctx.moveTo(B.x, B.y);
                    ctx.lineTo(B.x + Math.cos(a - W)*L, B.y + Math.sin(a - W)*L); ctx.lineTo(B.x + Math.cos(a + W)*L, B.y + Math.sin(a + W)*L);
                    ctx.closePath(); ctx.fill();
                }
            }
            //横一文字に伸びる光(まぶしさ)
            if(B.t < 60){
                var k = B.t/60, h = 10*(1 - k) + 2;
                var w = NUKE_R*1.15, L = ctx.createLinearGradient(B.x - w, 0, B.x + w, 0);
                L.addColorStop(0, "rgba(255,230,200,0)");
                L.addColorStop(0.5, "rgba(255,250,235," + (0.9*(1 - k)) + ")");
                L.addColorStop(1, "rgba(255,230,200,0)");
                ctx.fillStyle = L;
                ctx.fillRect(B.x - w, B.y - h/2, w*2, h);
            }
            ctx.globalCompositeOperation = "source-over";
            //衝撃波の輪
            if(B.t < NUKE_WAVE){
                var k = B.t/NUKE_WAVE, R = NUKE_R*0.9 + 1000*Math.pow(k, 0.7);
                ctx.strokeStyle = "rgba(255,255,255," + (0.8*(1 - k)) + ")"; ctx.lineWidth = 14*(1 - k) + 2;
                ctx.beginPath(); ctx.arc(B.x, B.y, R, 0, Math.PI*2); ctx.stroke();
                ctx.strokeStyle = "rgba(255,170,90," + (0.5*(1 - k)) + ")"; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(B.x, B.y, R*0.88, 0, Math.PI*2); ctx.stroke();
                ctx.lineWidth = 1;
            }
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
        //核の閃光(爆発の範囲の中だけ)：はじめ(時が止まっている間も)は真っ白。そのあと焼けたように明るく飛ばしたまま、白 → 黄 → 橙と冷めて消える
        for(var i=0; i<this.booms.length; i++){
            var B = this.booms[i];
            if(B.t >= NUKE_FLASH) continue;
            var f = 1 - B.t/NUKE_FLASH, R = NUKE_R*1.12;
            var col = f > 0.5 ? fwMix("255,236,170", "255,255,255", (f - 0.5)/0.35) : fwMix("255,140,60", "255,236,170", f/0.5);
            var A = f > 0.85 ? 1 : 0.95*Math.pow(f/0.85, 1.4);
            ctx.globalCompositeOperation = "lighter";
            var G = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, R);
            G.addColorStop(0, "rgba(255,190,120," + (0.55*f) + ")");
            G.addColorStop(0.88, "rgba(255,190,120," + (0.55*f) + ")");
            G.addColorStop(1, "rgba(255,190,120,0)");
            ctx.fillStyle = G;
            ctx.beginPath(); ctx.arc(B.x, B.y, R, 0, Math.PI*2); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
            G = ctx.createRadialGradient(B.x, B.y, 0, B.x, B.y, R);
            G.addColorStop(0, "rgba(" + col + "," + A + ")");
            G.addColorStop(0.88, "rgba(" + col + "," + A + ")");
            G.addColorStop(1, "rgba(" + col + ",0)");
            ctx.fillStyle = G;
            ctx.beginPath(); ctx.arc(B.x, B.y, R, 0, Math.PI*2); ctx.fill();
        }
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
        this.drawNukeOver();
        this.drawMouseOver();
        for(var i=0; i<enemies.length; i++){
            if(enemies[i].fighter && !enemies[i].dead) this.drawLockUi(enemies[i]);
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

    //---- マウスに付いていく動きを使う試作(投げなわ・ポインタ狙い・付いていく動きを邪魔する場) ----
    //場に合わせて、ドローン君の目標(T.x, T.y)と追従の遅れ(T.d)を変える(drone.calcXY から)
    steer:function(d,T){
        var F = this.field;
        if(!F || mainScreen.state == "over") return;
        if(F.kind == "wind"){
            //流される(ポインタとのずれが広がる)
            d.X += Math.cos(F.ang)*F.k*WIND_PUSH;
            d.Y += Math.sin(F.ang)*F.k*WIND_PUSH;
        }else if(F.kind == "mirror"){
            //円の中では、目標をドローン君をはさんだ左右反対へ置く(ポインタと逆へ進む)
            F.inside = this.mirrorAt(d.X, d.Y);
            if(F.inside) T.x = 2*d.X - T.x;
            F.gx = T.x; F.gy = T.y;
        }else if(F.kind == "web"){
            var w = this.webAt(d.X, d.Y);
            if(w && !F.stuck){ popup(d.X, d.Y - 30, "糸に掛かった！", "#666"); sound.play("block"); }
            F.stuck = w;
            if(w) T.d = T.d*WEB_SLOW;
        }
    },
    mirrorAt:function(_x,_y){
        var C = this.field.circles;
        for(var i=0; i<C.length; i++){ if(Math.hypot(_x - C[i].x, _y - C[i].y) < MIRROR_R) return C[i]; }
        return null;
    },
    webAt:function(_x,_y){
        var W = this.field.webs;
        for(var i=0; i<W.length; i++){
            var w = W[i];
            if(w.t >= WEB_FLY && Math.hypot(_x - w.x, _y - w.y) < WEB_R*this.webOpen(w)) return w;
        }
        return null;
    },
    //巣の開き具合(0～1)
    webOpen:function(w){
        return Math.max(0, Math.min(1, (w.t - WEB_FLY)/WEB_OPEN));
    },
    //場を動かす(update から)
    fieldStep:function(){
        var F = this.field;
        var mv = this.mouse ? Math.hypot(MouseX - this.mouse.x, MouseY - this.mouse.y) : 0;
        this.mouse = { x:MouseX, y:MouseY };
        if(!F) return;
        F.t++;
        if(F.kind == "wind"){
            //なぎ → 予告(向きの矢印) → 吹く、をくり返す
            var W = WIND_TIMES, p = F.t % (W.calm + W.warn + W.blow);
            if(p == W.calm){
                var dirs = [0, Math.PI, Math.PI/2, -Math.PI/2, Math.PI*0.25, Math.PI*0.75];
                F.ang = dirs[Math.floor(Math.random()*dirs.length)];
                F.warn = true;
            }
            if(p == W.calm + W.warn){ F.warn = false; sound.play("steam"); }
            var blowing = p >= W.calm + W.warn;
            F.k = Math.max(0, Math.min(1, F.k + (blowing ? WIND_RAMP : -WIND_RAMP)));
            F.ph += F.k*9;
            //敵の弾も流される
            var px = Math.cos(F.ang)*F.k*WIND_SHOT_PUSH, py = Math.sin(F.ang)*F.k*WIND_SHOT_PUSH;
            for(var i=0; i<enemyShots.length; i++){ enemyShots[i].x += px; enemyShots[i].y += py; }
        }else if(F.kind == "mirror"){
            //円は左右へゆっくり流れ、画面の端で折り返す
            for(var i=0; i<F.circles.length; i++){
                var c = F.circles[i];
                c.x += c.vx;
                if((c.x < MIRROR_R + 20 && c.vx < 0) || (c.x > CW - MIRROR_R - 20 && c.vx > 0)) c.vx = -c.vx;
            }
        }else if(F.kind == "web"){
            for(var i=F.webs.length-1; i>=0; i--){
                var w = F.webs[i];
                w.t++;
                if(w.t == WEB_FLY){ fx.ring(w.x, w.y, WEB_R, "235,235,245", 14, 2); sound.play("water"); }
                if(w.t >= WEB_FLY + WEB_LIFE){ F.webs.splice(i,1); continue; }
                //掛かっている巣は、ポインタを動かした分だけほどける
                if(F.stuck == w){
                    w.hp -= mv;
                    w.shake = Math.min(6, mv*0.15);
                    if(w.hp <= 0){
                        fx.sparks(w.x, w.y, 18, "235,235,245", 6, 2.5);
                        popup(drone.X, drone.Y - 30, "ほどけた！", "#4a8");
                        sound.play("shatter");
                        F.webs.splice(i,1);
                        F.stuck = null;
                        this.labCount.torn++;
                    }
                }else w.shake = 0;
            }
        }
    },
    //クモの糸を投げる(_x,_y から、_tx,_ty へ)
    web:function(_x,_y,_tx,_ty){
        var w = { x0:_x, y0:_y, x:Math.max(40, Math.min(CW - 40, _tx)), y:Math.max(40, Math.min(CH - 40, _ty)), t:0, hp:WEB_HP, shake:0 };
        this.field.webs.push(w);
        return w;
    },

    //投げなわ：ドローン君の跡を覚え、交わって輪になったら閉じる(update から)
    lassoStep:function(){
        var L = this.lasso;
        if(!L) return;
        L.t++;
        for(var i=L.flashes.length-1; i>=0; i--){ if(++L.flashes[i].t >= LASSO_FLASH) L.flashes.splice(i,1); }
        var P = L.pts;
        while(P.length && L.t - P[0].t > LASSO_LIFE) P.shift();
        var last = P[P.length - 1];
        if(last && Math.hypot(drone.X - last.x, drone.Y - last.y) < LASSO_STEP) return;
        var np = { x:drone.X, y:drone.Y, t:L.t };
        if(last){
            //新しい線が古い線と交わったら輪ができた。新しいほうから調べ、小さすぎる輪は飛ばす
            for(var i=P.length-3; i>=0; i--){
                var I = this.segCross(P[i], P[i+1], last, np);
                if(!I) continue;
                var poly = [I].concat(P.slice(i+1));
                if(Math.abs(this.polyArea(poly)) < LASSO_MIN_AREA) continue;
                this.lassoClose(poly);
                L.pts = [np];
                return;
            }
        }
        P.push(np);
    },
    //2つの線分(a-b と c-d)の交わる点(交わらなければ null)
    segCross:function(a,b,c,d){
        var rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
        var den = rx*sy - ry*sx;
        if(Math.abs(den) < 1e-9) return null;
        var u = ((c.x - a.x)*sy - (c.y - a.y)*sx)/den, v = ((c.x - a.x)*ry - (c.y - a.y)*rx)/den;
        if(u < 0 || u > 1 || v < 0 || v > 1) return null;
        return { x:a.x + rx*u, y:a.y + ry*u };
    },
    polyArea:function(poly){
        var s = 0;
        for(var i=0; i<poly.length; i++){ var a = poly[i], b = poly[(i + 1) % poly.length]; s += a.x*b.y - b.x*a.y; }
        return s/2;
    },
    inPoly:function(poly,_x,_y){
        var inside = false;
        for(var i=0, j=poly.length-1; i<poly.length; j=i++){
            var a = poly[i], b = poly[j];
            if((a.y > _y) != (b.y > _y) && _x < (b.x - a.x)*(_y - a.y)/(b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    },
    //輪を閉じた：中の敵にダメージ(殻の敵は倒れる)、中の弾は消える
    lassoClose:function(poly){
        var nE = 0, nB = 0, cx = 0, cy = 0;
        for(var i=0; i<poly.length; i++){ cx += poly[i].x/poly.length; cy += poly[i].y/poly.length; }
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead || e.phased || !this.inPoly(poly, e.x, e.y)) continue;
            fx.sparks(e.x, e.y, 12, "255,214,90", 6, 2.5);
            mainScreen.hitEnemy(e, e.shell ? e.maxHp : e.maxHp*LASSO_DMG, "lasso");
            nE++;
        }
        for(var i=enemyShots.length-1; i>=0; i--){
            var b = enemyShots[i];
            if(b.behind || !this.inPoly(poly, b.x, b.y)) continue;
            fx.sparks(b.x, b.y, 3, "255,214,90", 3, 1.5);
            enemyShots.splice(i,1);
            nB++;
        }
        this.lasso.flashes.push({ poly:poly, t:0 });
        if(nE + nB > 0) popup(cx, cy, nE ? "囲んだ！×" + nE : "弾を消した ×" + nB, "#c90", nE > 0);
        sound.play(nE ? "synergy" : "graze");
        this.labCount.caught += nE; this.labCount.erased += nB;
    },
    //殻の敵：投げなわでしか倒せない(mainScreen.hitEnemy から。防いだら true)
    shellHit:function(e,_src){
        if(_src == "lasso") return false;
        e.shell.ping = 8;
        return true;
    },
    //殻の敵を出す(画面の上から入ってきて、ゆっくりうろうろする)
    shellEnemy:function(_x){
        var e = makeEnemy("bug");
        var a = Math.PI/2 + (Math.random() - 0.5)*1.2;
        e.x = _x; e.y = -20;
        e.hp = e.maxHp = 10;
        e.score = 0; e.parts = 0;
        e.lab = bossDebug.lab; e.labId = "lasso";
        e.shell = { vx:Math.cos(a)*SHELL_SPEED, vy:Math.sin(a)*SHELL_SPEED, ping:0 };
        enemies.push(e);
        return e;
    },
    shellStep:function(e){
        var S = e.shell;
        if(S.ping > 0) S.ping--;
        //ときどき向きを少し変える
        if(Math.random() < 0.02){
            var a = Math.atan2(S.vy, S.vx) + (Math.random() - 0.5)*1.2;
            S.vx = Math.cos(a)*SHELL_SPEED; S.vy = Math.sin(a)*SHELL_SPEED;
        }
        e.x += S.vx; e.y += S.vy;
        if((e.x < 40 && S.vx < 0) || (e.x > CW - 40 && S.vx > 0)) S.vx = -S.vx;
        if((e.y < 140 && S.vy < 0) || (e.y > CH - 40 && S.vy > 0)) S.vy = -S.vy;
        e.vx = S.vx; e.vy = S.vy;
        return true;
    },

    //弾の下に描く：投げなわの跡・閉じた輪・場(風の筋・鏡の円・クモの巣)
    drawMouseUnder:function(){
        var F = this.field;
        if(F && F.kind == "wind" && F.k > 0){
            var ca = Math.cos(F.ang), sa = Math.sin(F.ang), len = 18 + 40*F.k;
            ctx.strokeStyle = "rgba(70,95,130," + (0.45*F.k) + ")"; ctx.lineWidth = 1.5;
            ctx.beginPath();
            for(var i=0; i<46; i++){
                var bx = (i*173) % CW, by = (i*97 + i*i*7) % CH, s = F.ph*(1 + (i % 3)*0.3);
                var x = ((bx + ca*s) % CW + CW) % CW, y = ((by + sa*s) % CH + CH) % CH;
                ctx.moveTo(x, y); ctx.lineTo(x - ca*len, y - sa*len);
            }
            ctx.stroke();
        }
        if(F && F.kind == "mirror"){
            for(var i=0; i<F.circles.length; i++){
                var c = F.circles[i], on = F.inside == c;
                ctx.fillStyle = on ? "rgba(170,110,235,0.24)" : "rgba(170,110,235,0.13)";
                ctx.beginPath(); ctx.arc(c.x, c.y, MIRROR_R, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "rgba(140,80,210," + (on ? 0.9 : 0.6) + ")"; ctx.lineWidth = 2;
                ctx.setLineDash([8,6]); ctx.lineDashOffset = -F.t*0.5;
                ctx.stroke();
                //まんなかの鏡の線と、左右が入れ替わる矢印
                ctx.setLineDash([4,6]);
                ctx.beginPath(); ctx.moveTo(c.x, c.y - MIRROR_R + 8); ctx.lineTo(c.x, c.y + MIRROR_R - 8); ctx.stroke();
                ctx.setLineDash([]); ctx.lineDashOffset = 0;
                ctx.fillStyle = "rgba(140,80,210,0.75)"; ctx.font = "bold 22px sans-serif";
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("⇄", c.x, c.y - MIRROR_R*0.55);
            }
            ctx.lineWidth = 1;
        }
        if(F && F.kind == "web"){
            for(var i=0; i<F.webs.length; i++) this.drawWeb(F.webs[i], F.t);
        }
        var L = this.lasso;
        if(L){
            //閉じた輪：光って消える
            for(var i=0; i<L.flashes.length; i++){
                var Fl = L.flashes[i], k = Fl.t/LASSO_FLASH, poly = Fl.poly;
                ctx.beginPath(); ctx.moveTo(poly[0].x, poly[0].y);
                for(var j=1; j<poly.length; j++) ctx.lineTo(poly[j].x, poly[j].y);
                ctx.closePath();
                ctx.fillStyle = "rgba(255,220,90," + (0.4*(1 - k)) + ")"; ctx.fill();
                ctx.strokeStyle = "rgba(255,190,40," + (1 - k) + ")"; ctx.lineWidth = 3 + 4*k; ctx.stroke();
            }
            //跡：古いほど薄い金色のなわ
            var P = L.pts;
            ctx.lineCap = "round";
            for(var i=1; i<P.length; i++){
                var a = 1 - (L.t - P[i].t)/LASSO_LIFE;
                ctx.strokeStyle = "rgba(225,165,30," + (0.85*a) + ")"; ctx.lineWidth = 2 + 2*a;
                ctx.beginPath(); ctx.moveTo(P[i-1].x, P[i-1].y); ctx.lineTo(P[i].x, P[i].y); ctx.stroke();
            }
            if(P.length) {
                var e0 = P[P.length - 1];
                ctx.strokeStyle = "rgba(225,165,30,0.85)"; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(e0.x, e0.y); ctx.lineTo(drone.X, drone.Y); ctx.stroke();
            }
            ctx.lineCap = "butt"; ctx.lineWidth = 1;
        }
    },
    //クモの巣(飛んでいる間は糸の玉と、落ちる所の印)
    drawWeb:function(w,now){
        if(w.t < WEB_FLY){
            var k = w.t/WEB_FLY;
            var x = w.x0 + (w.x - w.x0)*k, y = w.y0 + (w.y - w.y0)*k - Math.sin(k*Math.PI)*80;
            ctx.strokeStyle = "rgba(90,90,100,0.5)"; ctx.lineWidth = 1;
            ctx.setLineDash([3,5]);
            ctx.beginPath(); ctx.arc(w.x, w.y, WEB_R*0.8, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "#e8e8f0"; ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.lineWidth = 1;
            return;
        }
        var open = this.webOpen(w), R = WEB_R*open, left = WEB_FLY + WEB_LIFE - w.t;
        var a = Math.min(1, left/40)*(0.35 + 0.65*Math.max(0.15, w.hp/WEB_HP));
        var sx = (Math.random() - 0.5)*w.shake, sy = (Math.random() - 0.5)*w.shake;
        ctx.save(); ctx.translate(w.x + sx, w.y + sy);
        var N = 10;
        //濃いふちどり → 白い糸の順に重ねる(どんな背景でも見えるように)
        for(var pass=0; pass<2; pass++){
            ctx.strokeStyle = pass == 0 ? "rgba(50,50,60," + (0.55*a) + ")" : "rgba(250,250,255," + (0.9*a) + ")";
            ctx.lineWidth = pass == 0 ? 3 : 1.3;
            ctx.beginPath();
            for(var i=0; i<N; i++){
                var t = i/N*Math.PI*2;
                ctx.moveTo(0, 0); ctx.lineTo(Math.cos(t)*R, Math.sin(t)*R);
            }
            for(var r=1; r<=4; r++){
                var rr = R*r/4;
                for(var i=0; i<=N; i++){
                    var t = i/N*Math.PI*2, sag = rr*0.88;    //糸はスポークの間で少したるむ
                    var x1 = Math.cos(t)*rr, y1 = Math.sin(t)*rr;
                    if(i == 0) ctx.moveTo(x1, y1);
                    else{
                        var tm = (i - 0.5)/N*Math.PI*2;
                        ctx.quadraticCurveTo(Math.cos(tm)*sag, Math.sin(tm)*sag, x1, y1);
                    }
                }
            }
            ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //弾の上に描く：殻・ポインタを狙う照準・鏡の中の目標・風の予告・もがく残り
    drawMouseOver:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(!e.shell || e.dead) continue;
            //殻(六角形の板。撃たれると白く光る)
            var ping = e.shell.ping/8, R = e.r + 8;
            ctx.strokeStyle = ping > 0 ? "rgba(255,255,255," + (0.6 + 0.4*ping) + ")" : "rgba(90,170,235,0.85)";
            ctx.fillStyle = "rgba(120,200,255," + (0.15 + 0.3*ping) + ")";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for(var j=0; j<6; j++){
                var t = j/6*Math.PI*2 + e.t*0.01;
                if(j == 0) ctx.moveTo(e.x + Math.cos(t)*R, e.y + Math.sin(t)*R); else ctx.lineTo(e.x + Math.cos(t)*R, e.y + Math.sin(t)*R);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.lineWidth = 1;
        }
        var P = this.ptr;
        if(P){
            //照準の線：撃つ直前ほど速く点滅する
            if(P.snipe > 0){
                var blink = P.snipe < 15 ? (P.snipe % 4 < 2) : true;
                if(blink){
                    ctx.strokeStyle = "rgba(230,30,30,0.7)"; ctx.lineWidth = 1.5;
                    ctx.setLineDash([10,6]);
                    ctx.beginPath(); ctx.moveTo(this.labX, 70); ctx.lineTo(P.ax, P.ay); ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
            //ポインタに重なる赤い照準(ポインタを隠していても出す)
            var rot = this.labT*0.05, rr = 16 + (P.snipe > 0 ? 6*Math.sin(this.labT*0.4) : 0);
            ctx.save(); ctx.translate(MouseX, MouseY); ctx.rotate(rot);
            ctx.strokeStyle = "rgba(230,30,30,0.9)"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath();
            for(var j=0; j<4; j++){ var t = j*Math.PI/2; ctx.moveTo(Math.cos(t)*(rr - 6), Math.sin(t)*(rr - 6)); ctx.lineTo(Math.cos(t)*(rr + 6), Math.sin(t)*(rr + 6)); }
            ctx.stroke();
            ctx.restore();
            ctx.lineWidth = 1;
        }
        var F = this.field;
        if(F && F.kind == "mirror" && F.inside){
            //鏡の中：ほんとうに向かっている先(ポインタの左右反対)を薄く出す
            ctx.strokeStyle = "rgba(140,80,210,0.8)"; ctx.lineWidth = 1.5;
            ctx.setLineDash([4,4]);
            ctx.beginPath(); ctx.moveTo(drone.X, drone.Y); ctx.lineTo(F.gx, F.gy); ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(F.gx, F.gy, 9, 0, Math.PI*2); ctx.stroke();
            ctx.lineWidth = 1;
        }
        if(F && F.kind == "wind" && F.warn && F.t % 16 < 11){
            //風の予告：画面のまんなかに大きな矢印
            ctx.save(); ctx.translate(CW/2, CH/2); ctx.rotate(F.ang);
            ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.strokeStyle = "rgba(60,80,110,0.6)"; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-90,-16); ctx.lineTo(30,-16); ctx.lineTo(30,-40); ctx.lineTo(90,0); ctx.lineTo(30,40); ctx.lineTo(30,16); ctx.lineTo(-90,16);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
            ctx.lineWidth = 1;
        }
        if(F && F.kind == "web" && F.stuck){
            //ほどけるまでの残り(ドローン君のまわりの弧)
            var k = 1 - Math.max(0, F.stuck.hp)/WEB_HP;
            ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(drone.X, drone.Y, 26, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "#4a8"; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(drone.X, drone.Y, 26, -Math.PI/2, -Math.PI/2 + k*Math.PI*2); ctx.stroke();
            ctx.lineWidth = 1;
            ctx.fillStyle = "#555"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("ポインタを振ってほどく", drone.X, drone.Y + 40);
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
        this.labCount = this.newCount();
    },
    //一覧の行(0番目は「自動で順番に」、そのあとに攻撃が並ぶ)
    labRows:function(){
        var out = [];
        for(var i=-1; i<this.list.length; i++){
            var n = i + 1, col = Math.floor(n/LAB_COL_ROWS);
            out.push({ i:i, x:8 + col*(LAB_LIST_W + 8), y:LAB_LIST_Y + (n % LAB_COL_ROWS)*LAB_ROW_H, w:LAB_LIST_W, h:LAB_ROW_H });
        }
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
        this.labCount = this.newCount();
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
            case "nuke":
                //核弾頭を1発。落ちてくる間も、砲台は弾を撃って逃げ道をじゃまする
                if(T == 40) this.nuke(x, y);
                if(T > 90 && T < 280 && T % 45 == 0){ fireFan(x, y, aim, 3, 0.3, 2.2*m, "normal"); shot = true; }
                break;
            case "tail":
            case "lock":
                //砲台の代わりに戦闘機が1機。撃ち落とされたら、少しして画面の左右の端から次が来る
                if(!enemies.some(function(e){ return e.labId == id; }) && T % 60 == 0){
                    this.fighter(id, Math.random() < 0.5 ? -20 : CW + 20, 80 + Math.random()*(CH - 180));
                }
                break;
            case "lasso":
                //殻の敵がうろうろする(輪で囲むと倒れる)。砲台はゆっくりの弾を撃つ(輪で消せる)
                if(!this.lasso) this.lasso = { pts:[], flashes:[], t:0 };
                if(T % 50 == 0 && enemies.filter(function(e){ return e.labId == "lasso" && !e.dead; }).length < SHELL_N) this.shellEnemy(80 + Math.random()*(CW - 160));
                if(T % 45 == 0){ fireFan(x, y, aim, 5, 0.3, 1.6*m, "normal"); shot = true; }
                break;
            case "ptraim":
                //ポインタ(これから行く所)を狙う。何回かに1回は、照準の線でポインタを追ってから針弾で狙い撃つ
                if(!this.ptr) this.ptr = { n:0, snipe:0, ax:MouseX, ay:MouseY };
                var P = this.ptr, pa = Math.atan2(MouseY - y, MouseX - x);
                P.ax = MouseX; P.ay = MouseY;
                if(P.snipe > 0){
                    if(--P.snipe == 0){ for(var i=-1; i<=1; i++) this.fire(x, y, pa + i*0.05, 6*m, "needle"); shot = true; }
                }else if(T % PTR_EVERY == 0){
                    if(++P.n % PTR_SNIPE_EVERY == 0){ P.snipe = PTR_SNIPE_T; sound.play("tell"); }
                    else{ fireFan(x, y, pa, 3, 0.2, 2.6*m, "normal"); shot = true; }
                }
                break;
            case "wind":
                if(!this.field) this.field = { kind:"wind", t:0, k:0, ang:0, warn:false, ph:0 };
                if(T % 32 == 0){ fireFan(x, y, aim, 5, 0.22, 2.2*m, "normal"); shot = true; }
                break;
            case "mirror":
                if(!this.field) this.field = { kind:"mirror", t:0, inside:null, gx:0, gy:0,
                                               circles:[{ x:CW*0.3, y:CH*0.58, vx:MIRROR_SPEED }, { x:CW*0.7, y:CH*0.62, vx:-MIRROR_SPEED }] };
                if(T % 28 == 0){ fireFan(x, y, aim, 5, 0.2, 2.2*m, "normal"); shot = true; }
                break;
            case "web":
                if(!this.field) this.field = { kind:"web", t:0, webs:[], stuck:null };
                if(T % WEB_EVERY == 50) this.web(x, y, tg.X, tg.Y);
                if(T % 36 == 0){ fireFan(x, y, aim, 3, 0.3, 2.2*m, "normal"); shot = true; }
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
    //試作の回数。空戦：後ろを取った・取られた・ロックした・ロックされた　投げなわ：囲んだ敵・消した弾　クモの糸：ほどいた巣
    newCount:function(){ return { six:0, tailed:0, lock:0, locked:0, caught:0, erased:0, torn:0 }; },
    labCount:{ six:0, tailed:0, lock:0, locked:0, caught:0, erased:0, torn:0 },
    //砲台と、弾の名前の一覧(bossDebug.drawTag から)
    drawLab:function(){
        var x = this.labX, y = 70;
        var cur = this.labIndex();
        var curId = this.list[cur].id, C = this.labCount;
        //迎撃：撃ち落とした数と当たった数。空戦：取った・取られた回数。投げなわ：囲んだ数。クモの糸：ほどいた数
        var head = curId == "intercept" ? "撃ち落とした " + this.labShot + "　当たった " + this.labHits :
                   curId == "tail" ? "後ろを取った " + C.six + "　取られた " + C.tailed :
                   curId == "lock" ? "ロックした " + C.lock + "　ロックされた " + C.locked :
                   curId == "lasso" ? "囲んだ敵 " + C.caught + "　消した弾 " + C.erased :
                   curId == "web" ? "ほどいた巣 " + C.torn : "";
        if(head){
            ctx.textAlign = "center";
            ctx.font = "bold 13px sans-serif";
            ctx.fillStyle = "#c33";
            ctx.fillText(head, CW/2, 42);
        }
        //迎撃・空戦は砲台の代わりに的・戦闘機がいる
        if(curId != "intercept" && curId != "tail" && curId != "lock"){
            ctx.fillStyle = "#334";
            ctx.beginPath(); ctx.arc(x,y,14,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "#c33";
            ctx.beginPath(); ctx.arc(x,y,6,0,Math.PI*2); ctx.fill();
        }
        var rows = this.labRows(), hover = inputMode == "mouse" ? this.labRowAt(MouseX,MouseY) : null;
        //一覧の板(押せるとわかるように)
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        for(var c=0; c*LAB_COL_ROWS < rows.length; c++){
            var n = Math.min(LAB_COL_ROWS, rows.length - c*LAB_COL_ROWS);
            ctx.fillRect(4 + c*(LAB_LIST_W + 8), LAB_LIST_Y - 4, LAB_LIST_W + 8, n*LAB_ROW_H + 8);
        }
        var listH = Math.min(LAB_COL_ROWS, rows.length)*LAB_ROW_H;
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
        ctx.fillText(this.list[cur].note, 10, LAB_LIST_Y + listH + 14);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#666";
        ctx.fillText("一覧を押すと、その攻撃を繰り返します", 10, LAB_LIST_Y + listH + 32);
    }
};
