//------------------------------------------------------------------------------
//  最終局面の試作(Suno)：ドローン君改の第二形態を、録音の曲「Triumph in D Major」(bgmTrial.js の triumph)に合わせて動かす
//  デバッグのメニューの「最終局面」を「Suno」にしたときだけ働く(Lyria の試作 finaleSync.js とは別。重い効果音 fsSfx は借りる)
//  曲は 160 BPM で、少しずつ速くなる(終わりで 160.6)ので、拍の時刻は測って決めた式(TR_BEAT_FIT)で出す。流れ：
//    故障(0～6.2秒)：倒れた改がノイズと火花を散らして痙攣し、エラーの記録が流れる。最後に鼓動
//    再構築(6.2～19.7秒)：「再構築プロトコル 始動」。工程の記録と進み具合を出しながら、小節ごとに光の翼を
//      設計図の線の上へ組み上げて浮かび上がる。最初の大きな一打で完全体(第二形態)
//    主題(19.7秒～)・高まり(43.6秒～)・サビ(81.1秒～)：拍で撃ち、小節の頭に攻撃
//      (翼の羽根・隙間のある光輪・光の柱・囲む光の槍と、今までの攻撃)
//    沈む(93.1秒～)：奥へ下がり、奥から拍に合わせて砲撃。迫る(100.6秒～)：奥から迫り、最高潮の頭(105.0秒)に着く。
//      ジャスト衝撃波を合わせると弾き返し、翼に火がつく(このあと翼が白く燃える)
//    最高潮(105.0秒～)：大きくなり、毎拍撃つ。息つぎ(129.0秒～)：翼をたたんで弾を吸い込み、132.0秒に一気に放つ → 嵐
//    夜明け(155.9秒～)：空が明け、ドローン君にも光の翼(改へのダメージが TR_DAWN_POW 倍)。改の翼は体力とともに欠けていく
//    最後の突進(179.8秒～)：奥へ下がってから迫り、最後の和音(184.3秒)に着く。体力が TR_FINISH 以下で
//      ジャスト衝撃波を合わせると、とどめ(曲はくり返しを抜けて最後まで鳴る：triumph.finish)。
//      決められなければ、曲は夜明け(155.9秒)へ戻ってくり返す
//  体力の関門：TR_GATES の小節までは、体力がその割合より減らない。夜明けからは、とどめでしか倒れない
//  細かい効果音は小さくする(Lyria の試作と同じ：finaleSync.js の FS_SE_QUIET・FS_SE_DUCK)
//  special の kai・kaiRevive・kaiFx・kaiAwakeFx・draw・drawBossBar、shotLab の onBlast・step・draw・drawUnder・drawFront、
//  battleBg.drawDark、dodge.drawUnder、mainScreen の hitEnemy・drawHud、sound の play・stopMusic を包む
//  協力プレイには対応していない
//------------------------------------------------------------------------------
const TR_START      = 0;        //曲をここから流し始める(秒。0 は前奏から：前奏の間に改が故障し、再構築して組み上がる)
const TR_BEAT_FIT   = [0.154343813, 0.375068674, -1.58002545e-06];  //n 拍目の時刻(秒) = a + b×n + c×n²(曲を測って決めた)
const TR_LOOP       = [155.9095, 184.3057];     //曲のくり返し(秒。music/triumph.js と同じ。104小節目と123小節目の頭。テストで曲の時刻を戻すのに使う)
//曲の区切り(bar：始まりの小節。1小節は4拍で、0小節目は曲の頭)
//every：何小節ごとに攻撃するか gun：何拍ごとに撃つか list：攻撃の並び(TR_OWN にあるものはここ、ほかは bosses.js の kaiAttack)
//giant：改が大きくなる pulse：小節の頭で強く脈打つ
const TR_SECTIONS = [
    { bar:0,   name:"rebuild" },
    { bar:13,  name:"theme",  every:2, gun:2, list:["feathers","halo","spiral","lances","feathers","cross"] },
    { bar:29,  name:"rise",   every:2, gun:2, list:["pillars","feathers","dash","halo","lances","dragon","cross","spiral"] },
    { bar:54,  name:"chorus", every:1, gun:2, list:["halo","lances","pillars","feathers"], giant:true, pulse:true },
    { bar:62,  name:"sink" },
    { bar:67,  name:"hush" },
    { bar:70,  name:"climax", every:1, gun:1, list:["halo","pillars","lances","feathers","cross","halo","dash","gunstorm"], giant:true, pulse:true },
    { bar:86,  name:"breath", giant:true },
    { bar:88,  name:"storm",  every:1, gun:2, list:["lances","pillars","spiral","halo","feathers","dash","bands","missile"], pulse:true },
    { bar:104, name:"dawn",   every:1, gun:2, list:["halo","feathers","lances","pillars","cross","spiral"], giant:true, pulse:true },
    { bar:120, name:"last" },
    { bar:123, name:"end" }
];
const TR_OWN        = ["feathers","halo","pillars","bands","lances"];    //このファイルで出す攻撃
const TR_GATES      = [[70, 0.6], [104, 0.35]];  //[この小節まで, 体力がこの割合より減らない]。夜明けからは、とどめでしか倒れない
const TR_HP_MUL     = 7;        //体力(ふだんの第二形態の何倍か。曲がふだんの第二形態よりずっと長いので。標準の装備で、とどめの前に TR_FINISH を少し切るくらい)
const TR_FINISH     = 0.2;      //最後の突進を弾いて倒せる体力(割合)。これより多ければ大きなダメージだけ(TR_LAST_DMG)
const TR_LAST_DMG   = 0.15;     //最後の突進を弾いたが、倒しきれないときのダメージ(第二形態の体力の割合)
const TR_PARRY_DMG  = [0.1, 0.16];  //最高潮の頭で弾き返したときのダメージ(JUST・PERFECT)
const TR_DAWN_POW   = 1.6;      //夜明けから、改へのダメージを何倍にするか
const TR_JUST_SEC   = 0.42;     //着く前のこの秒数の間に衝撃波を出すと弾き返す(着く所の輪が水色に光る間)
const TR_LATE_SEC   = 0.12;     //着いたあとも、この秒数のうちに衝撃波を出せば弾き返す(曲の拍に合わせて押すと少し遅れやすいので)
const TR_LATE_PERFECT = 0.06;   //着いたあとのうち、この秒数以内なら PERFECT
const TR_PERFECT_SEC = 0.2;     //そのうちこの秒数以内なら PERFECT(縮む輪が縮みきる TR_RING_LEAD 秒前を挟んで、前 0.07秒・後 0.13秒)
const TR_JUST_NEAR  = 70;       //弾き返せる、着く所からの距離(着く所の輪の半径に足す px)
const TR_RAM_R      = 40;       //着いたときに当たる範囲の半径(px)
//迫る(沈む・最後の突進のあと)：改の姿は見せない。タメ(奥で光をためる) → 予兆(狙いが止まり、拍ごとに奥から着く所へ光の脈) →
//タメ(最後の拍は静まり、奥の光が凝縮する) → 一瞬で来る(光の筋だけ) → 着いた衝撃(閃光・輪・放射の筋・揺れ・止まる)で見せる
const TR_TELL_BEATS = 4;        //着く何拍前に狙いが止まるか(そこから拍ごとに予兆の光の脈を出す)
const TR_HOLD_BEATS = 1;        //着く前のこの拍数は予兆を出さず、奥の光が凝縮する(最後のタメ)
const TR_PULSE_SEC  = 0.22;     //予兆の光の脈が、奥から着く所へ届くまで(秒)
const TR_DASH_SEC   = 0.22;     //着く何秒前に、奥から来るか(速くなりながら、手前に来るほど大きくなる光の塊と尾。集中線・揺れ・寄り)
const TR_MORPH_SEC  = 1.1;      //奥へ飛び去った改の姿が、タメの光に溶けていくまで(秒。位置もなめらかに移る)
const TR_IMPACT_T   = 30;       //着いた衝撃(閃光・輪・放射の筋)の長さ(フレーム)
const TR_MISS_STOP  = 8;        //弾き返せなかったときも、着いた瞬間に止まる(フレーム)
const TR_RETICLE    = 130;      //照準のかぎ括弧が、狙いが止まったときに着く所の輪より広い分(px。拍ごとに一段ずつ締まる)
const TR_RING_LEAD  = 0.13;     //縮む輪が着く所の輪へ重なるのを、着く瞬間よりこの秒数だけ早める(輪に合わせて押すと少し遅れるので、その分。遅れても PERFECT の間に入るように)
const TR_SNAP_SEC   = 0.08;     //照準が拍で締まる・回る動きの長さ(秒)
const TR_FLARE_W    = 520;      //奥の光の横に伸びる光の筋の長さ(片側 px。ためるほど伸びる)
const TR_CHARGE_POW = 1.5;      //ためる進み方(大きいほど、はじめはゆっくりで、動き出す前に一気に強まる)
const TR_ARCS       = 6;        //ためきったときに、奥の光のまわりに走る稲妻の数
const TR_BEAM_W     = 3;        //迫ってくる光の尾の芯の太さ(px)
const TR_INVERT_F   = 2;        //着いた瞬間、画面の色を反転させるコマ数(そのあと白い閃光)
const TR_AFTER_SCALE = 1.6;
//戦闘中の動き(羽ばたかない)：滑空。速く動くほど翼を後ろへ引いて風に乗り(TR_GLIDE_*)、止まるときは翼を前へ広げてブレーキ(TR_BRAKE_*)。
//曲がる・速さが変わるときは、ばねで行きすぎて戻りながら体を傾ける(TR_ROLL)。ゆっくり上下にうねり(TR_SOAR)、加速で体が遅れて沈む(TR_DIP)。
//速く滑ると沈み、止まると浮き上がる(TR_SWOOP)。上がる・下がるときは、翼が風を受けて先ほど遅れてしなる(TR_FLEX)。
//左右に動くときは、進む向きへ体を回す(TR_TURN)。翼は縦の軸のまわりに回して遠近をつけ、進む側の翼は奥へ、逆の翼は手前へ来る。
//顔はいつもドローン君をにらむ。撃つ・攻撃するたびに反動でのけぞる
const TR_GLIDE_SPEED = 4;       //この速さ(px/フレーム)で、翼をいちばん後ろへ引く
const TR_GLIDE_ROT  = 0.3;      //翼を後ろへ引く角度(ラジアン)
const TR_BRAKE_K    = 2.5;      //減速の強さに対するブレーキの姿勢の強さ
const TR_BRAKE_ROT  = 0.22;     //ブレーキで翼を前へ広げる角度(ラジアン)
const TR_ROLL       = [0.05, 0.6, 0.4];  //体の傾き：動く速さに対して(ラジアン/(px/フレーム))・横の加速に対して・上限
const TR_ROLL_SPRING = [0.06, 0.82];    //傾きのばね(引く強さ・勢いの残り。行きすぎて戻る)
const TR_SOAR       = [4, 0.022];   //ゆっくりした上下のうねり(px・速さ(ラジアン/フレーム))
const TR_DIP        = 10;       //縦の加速で体が遅れて沈む・浮く大きさ(px/(px/フレーム²))
const TR_SWOOP      = [3, 12];  //速さと高さのやりとり：速く滑るほど沈み、止まると浮き上がる(px/(px/フレーム)・上限 px)
const TR_SWOOP_SPRING = [0.05, 0.86];   //沈み・浮きのばね(引く強さ・勢いの残り。止まったときに少し浮きすぎて戻る)
const TR_FLEX       = [0.07, 0.28];  //翼のしなり：見た目の縦の速さに対して(ラジアン/(px/フレーム))・上限。下がるときは風で先が持ち上がり、上がるときは先が垂れる
const TR_FLEX_SPRING = [0.1, 0.8];      //しなりのばね(遅れてついて、少し行きすぎて戻る)
const TR_FLEX_TIP   = 1.6;      //ひじから先は、つけ根の何倍しなるか(先ほど大きく曲がる)
const TR_TURN       = [0.13, 1];  //左右に動くとき、進む向きへ体を回す角度：横の速さに対して(ラジアン/(px/フレーム))・上限(ラジアン)
const TR_TURN_SPRING = [0.07, 0.8];     //回るばね(遅れてついて、少し行きすぎて戻る)
const TR_TURN_BODY  = 0.7;      //体(顔)は翼の回りの何割だけ進む向きへ向くか(残りはドローン君をにらむ)
const TR_TURN_DEPTH = 360;      //翼を回したときの遠近(小さいほど、奥の翼は小さく、手前の翼は大きく見える。改の大きさで px)
const TR_GAZE       = [40, 0.6];    //ドローン君をにらむ向き：横の向きの上限(度)・見上げ／見下ろしの上限
const TR_KICK       = [7, 12];  //反動でのけぞる大きさ(px。撃ったとき・攻撃を出したとき)     //着いたあとの改の大きさ(ふだんの何倍。だんだん戻る)
const TR_SAFE       = 45;       //着いたあと、大きな改に触れても被弾しない時間(フレーム)
const TR_FLING      = 15;       //弾き返されて吹き飛ぶ速さ(px/フレーム)
const TR_STAGGER    = 70;       //弾き返されてよろける時間(フレーム)
const TR_HIT_STOP   = [14, 42]; //弾き返した瞬間に止まる時間(フレーム。最高潮の頭・とどめ)
const TR_GIANT      = 1.2;      //サビ・最高潮・夜明けの大きさ(ふだんの何倍か)
const TR_SINK_BARS  = 2;        //沈む：奥へ下がりきるまで(小節)
const TR_SINK_Y     = 200;      //奥へ下がるときに寄っていく高さ(px)
//奥へ飛び去る(沈む・最後の突進の前半)：はじめの TR_FLY_WIND の間は身を起こして翼を広げ(予備動作)、そこから外側へ弧を描いて舞い上がり、
//背中を見せて奥へ飛び去る(飛び立つ瞬間に衝撃の輪と風の音。光の尾を引く)
const TR_FLY_WIND   = 0.2;      //予備動作の割合
const TR_FLY_ARC    = [220, 300];   //弧の大きさ(外側へ・上へ。px)
const TR_FLY_RISE   = 26;       //予備動作で身を起こす高さ(px)
const TR_DARK       = [0.25, 0.6, 0.78];   //画面の暗さ(沈み始め・沈みきったとき・迫る間)
const TR_DRAIN      = 0.85;     //迫る間、周りの色をどれだけ抜くか(改だけ色が残る)
const TR_DEEP_SPREAD = 90;      //奥からの砲撃が落ちる所のばらつき(px)
//攻撃
const TR_GUN_N      = [3, 5];   //拍で撃つ扇の数(フェーズ4・5)
const TR_GUN_SPEED  = 3.3;      //拍で撃つ弾の速さ(danmaku() を掛ける)
const TR_FEATHER_N  = 4;        //翼の羽根：1拍ごと・片方の翼から撃つ数
const TR_FEATHER_SPEED = [2.2, 4.6];    //翼の羽根の速さ(撃ったとき・いちばん速く。danmaku() を掛ける)
const TR_HALO_N     = 44;       //光輪の弾の数(すき間の分も数える)
const TR_HALO_GAP   = 7;        //光輪のすき間(弾の数)
const TR_HALO_SPEED = 2.2;      //光輪の速さ(danmaku() を掛ける。1.3倍まで)
const TR_PILLAR_W   = 56;       //光の柱の幅(px)
const TR_PILLAR_HIT = 0.22;     //光の柱が当たっている長さ(秒)
const TR_PILLAR_GAP = 160;      //光の柱の間かく(px)
const TR_LANCE_N    = [8, 10];  //光の槍の数(ふだん・最高潮から)
const TR_LANCE_R    = 210;      //光の槍がドローン君を囲む半径(px)
const TR_LANCE_SPEED = 6.5;     //光の槍が飛ぶ速さ(px/フレーム)
//再構築(前奏の間)：故障 → 再構築プロトコル → 完全体
const TR_PROTO_BAR  = 4;        //再構築プロトコルが始動する小節(それまでは故障)
const TR_FAIL_LOG   = [[1,"動力系統 …… 応答なし"], [3,"姿勢制御 …… 損傷"], [5,"主翼ユニット …… 消失"],
                       [7,"装甲 …… 損傷率 87%"], [9,"コア出力 …… 0%"], [11,"致命的なエラー：全機能を停止"]];  //故障の記録([拍, 文])
const TR_FAIL_BEATS = [12,14];  //故障の終わりの鼓動(拍。止まったはずの心臓が打つ)
const TR_PROTO_LOG  = [[4,"再構築プロトコル 起動"], [5,"損傷部位を切り離し"], [6,"骨格フレームを再生成"], [7,"光翼ユニットを展開"],
                       [8,"出力制限を解除"], [9,"戦闘プログラムを書き換え"], [10,"全系統を同期"], [11,"最終確認"], [12,"再構築 完了"]];   //工程の記録([小節, 文])
const TR_TWITCH     = [0.035, 7, 5];    //故障の痙攣(1コマあたりの起きやすさ・長さ(コマ)・ずれ(px))
const TR_SPARK_P    = 0.06;     //故障の火花(1コマあたりの起きやすさ)
const TR_BANNER_F   = 110;      //「再構築プロトコル 始動」の帯を出す長さ(コマ)
const TR_LOG_X      = 18;       //記録の表示の左上(画面の左下に置く)
const TR_LOG_Y      = CH - 190;
const TR_MOTE_SPEED = 1.5;      //再構築の間の、ゆっくりした光の弾の速さ
//絵
//翼(右の翼の形。左は裏返す。改の大きさ1のときの px)：骨(つけ根 → ひじ → 先)に沿って、羽根が下から外へ垂れ下がる(天使の翼の形)
//a：羽根の向き(つけ根側 → 先。ラジアン。下が π/2) len：羽根の長さ(つけ根側 → 先) w：羽根の幅
//cov：骨のそばに重ねる短い羽根(雨覆い) { n:数, len:長さ, w:幅 }
const TR_WINGS = [
    { root:[14,10], elbow:[34,28],  tip:[62,40],   n:5, a:[1.7,0.75],  len:[26,44], w:9,  cov:{ n:4, len:16, w:7 } },   //下の小さな翼(奥に描く)
    { root:[16,-6], elbow:[48,-40], tip:[104,-56], n:9, a:[1.75,0.12], len:[44,80], w:12, cov:{ n:7, len:24, w:9 } }   //大きな翼
];
const TR_WING_N     = 14;       //片方の羽根の数(TR_WINGS の n の合計。雨覆いは数えない)
const TR_WING_LOSE  = [13, 12, 4, 11, 3, 10, 2, 9, 8, 1, 7];   //夜明けから欠けていく順(大きな翼の先から。番号は TR_WINGS の順に数える)
const TR_WING_COL   = ["#1c0a2c", "#4a1a80", "#8a52d8", "#e8d0ff"];  //羽根の色(ふち・外側・内側・火がついたあとの内側)
const TR_GLOW       = "200,110,255";    //改の光の色
const TR_FIRE       = "255,236,255";    //翼に火がついた光(白に近い)
const TR_DAWN_SEC   = 3;        //夜明けの空になるまで(秒)
const TR_DAWN_NIGHT = 0.3;      //夜明けのあとも残す夜の色(夜の戦場 FS_NIGHT に掛ける。敵・弾が見えるように)
const TR_SUN        = "255,214,150";    //夜明けの光の色
const TR_HERO       = "255,214,120";
const TR_FLASH      = 0.35;     //とどめの瞬間、画面を夜明けの色で照らす濃さ
const TR_SUN_A      = 0.75;     //夜明けの太陽の明るさ    //ドローン君の光の翼の色
const TR_NIGHT      = 0.84;     //第二形態の間の夜の戦場の色の濃さ
const TR_EMBERS     = 70;       //舞い上がる火の粉の数
const TR_HALO_K     = 3.2;      //弾のまわりのにじみの大きさ(弾の半径の何倍か)
//名前(登場の名前・ボスの体力ゲージ)。夜を統べる翼が、夜明けに敗れる
const TR_NAME       = { name:"ドローン君改・天翼", en:"DRONE-KUN KAI  SERAPH", title:"夜を統べる翼" };

SHOT_KINDS.tOrb     = { r:5 };      //光の玉(紫に白い芯)
SHOT_KINDS.tFeather = { r:4 };      //翼の羽根(細い刃。速くなる)
SHOT_KINDS.tLance   = { r:5 };      //光の槍(ドローン君を囲んで止まり、小節の頭にいっせいに飛ぶ)
SHOT_KINDS.tMote    = { r:4 };      //再構築の間の光の粒(ゆっくり)

var finaleTri = {
    fakeT:null,     //テスト用：曲の時刻をこの値にする(音を鳴らさずに確かめる)
    drawing:false,  //drawFront の中で、奥にいる改を描いている
    pillars:[],     //光の柱 { dir:"v"/"h", x(または y), warn:予告を始めた曲の時刻, hit:当たる時刻 }
    queue:[],       //あとの拍で出すもの { beat:拍の番号, f:関数 }
    shards:[],      //散る羽根・かけら
    dawnK:0,        //夜明け(0～1)
    dawnFlash:0,    //とどめの光(1 → 0)
    keepMusic:false,    //とどめのあと、曲を止めない(最後の和音まで鳴らす)
    result:null,    //テスト用：最後に弾き返したか("perfect"・"just"・"hit"・"dodge")
    finished:false, //とどめを決めた(曲はくり返しを抜けた)

    on:function(){ return bgmTrial.finales[bgmTrial.finale].v == "triumph"; },
    pos:function(){ return this.fakeT != null ? this.fakeT : triumph.pos(); },
    //n 拍目の時刻(秒)と、時刻 _p が何拍目か(小数)
    beatTime:function(_n){ var F = TR_BEAT_FIT; return F[0] + F[1]*_n + F[2]*_n*_n; },
    beatAt:function(_p){
        var F = TR_BEAT_FIT, n = (_p - F[0])/F[1];
        for(var i=0; i<2; i++) n -= (this.beatTime(n) - _p)/(F[1] + 2*F[2]*n);
        return n;
    },
    barTime:function(_bar){ return this.beatTime(_bar*4); },
    section:function(_p){
        var s = TR_SECTIONS[0];
        for(var i=0; i<TR_SECTIONS.length; i++) if(_p >= TR_SECTIONS[i].from) s = TR_SECTIONS[i];
        return s;
    },
    sec:function(_name){
        for(var i=0; i<TR_SECTIONS.length; i++) if(TR_SECTIONS[i].name == _name) return TR_SECTIONS[i];
    },
    //第二形態の改(曲に合わせて動いているもの)
    boss:function(){
        if(page.number != 1) return null;
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type == "kai" && !e.dead && e.trSong) return e;
        }
        return null;
    },
    live:function(){ var e = this.boss(); return !!(e && e.form == 2 && e.trSec); },
    //名前を入れかえる(Suno のときだけ。ほかのときは元に戻す)
    names:function(){
        if(!this.orig) this.orig = { name:KAI2.name, en:KAI2.en, title:KAI2.title };
        var n = this.on() ? TR_NAME : this.orig;
        KAI2.name = n.name; KAI2.en = n.en; KAI2.title = n.title;
    },

    //------------------------------------------------------------ 再構築(第一形態が倒れたあと：曲の頭から最初の大きな一打まで)
    //倒れた改が復活を始めたら、曲を流し始める(special.kaiRevive から)。曲の時刻で組み上がり、TR_SECTIONS[1] の頭で完全体になる
    rebuild:function(_e){
        this.names();
        if(!_e.trSong){
            _e.trSong = true;
            _e.trWait = 0;
            _e.maxHp = Math.round(_e.maxHp*TR_HP_MUL);
            this.reset();
            triumph.startAt = TR_START;
            sound.music(null);
            sound.music("kai2");
        }
        _e.look.update(0,0);
        _e.harmless = true;
        var p = this.pos();
        if(p < 0){
            //曲の読み込みを待つ(読み込めなければ、ふつうの復活と第二形態へ)
            if(++_e.trWait > 600){
                _e.trSong = false;
                _e.maxHp = Math.round(_e.maxHp/TR_HP_MUL);
                return false;
            }
            _e.count = Math.max(_e.count, 2);
            return true;
        }
        var A = TR_SECTIONS[1].from, k = this.rebuildK(p), q = k*k*(3 - 2*k);
        //故障の間は倒れた所で止まり、プロトコルが始まると画面の上のまんなかへ浮かび上がる
        if(_e.trY0 == null){ _e.trX0 = _e.x; _e.trY0 = _e.y; }
        _e.x = _e.trX0 + (CW/2 - _e.trX0)*q;
        _e.y = _e.trY0 + (150 - _e.trY0)*q + Math.sin(p*2)*3*k;
        _e.vx = 0; _e.vy = 0;
        //体力のゲージは、故障の間は空のまま、プロトコルの進みに合わせて満ちる
        _e.hp = Math.max(1, Math.round(_e.maxHp*k*k));
        if(p >= A){
            //完全体：bosses.js の kaiRevive の終わりと同じにする(kaiFx が mode の変わり目で kaiAwakeFx を呼ぶ)
            _e.form = 2;
            _e.hp = _e.maxHp;
            _e.phase = 4;
            _e.mode = "idle";
            _e.harmless = false;
            _e.timer = 999; _e.gunT = 999;
            _e.cycle = 0;
            _e.trNoise = 0; _e.trTwitch = 0;
        }
        return true;
    },
    //再構築の見た目(special.kaiFx から。mode が revive の間)
    //故障：ノイズ・痙攣・火花・エラーの記録・鼓動 → プロトコル始動の帯 → 小節ごとに工程の記録と翼の羽根が増え、暗闇が晴れる
    rebuildFx:function(_e){
        var M = mainScreen, p = this.pos();
        if(p < 0){ M.kaiDark = Math.max(M.kaiDark, KAI_DARK_OUT*0.75); return; }
        var k = this.rebuildK(p), proto = k > 0;
        this.logF++;
        if(this.bannerT != null) this.bannerT++;
        M.kaiDark = Math.max(M.kaiDark, KAI_DARK_OUT*0.75*(1 - 0.55*k));
        var beat = Math.floor(this.beatAt(p));
        if(beat != _e.trBeat){
            var from = _e.trBeat == null ? beat : _e.trBeat + 1;
            _e.trBeat = beat;
            //飛ばした拍も順に(重いコマで拍を取りこぼさないように)
            for(var b=from; b<=beat; b++) this.rebuildBeat(_e, b);
        }
        if(_e.trFlap > 0) _e.trFlap = Math.max(0, _e.trFlap - 0.04);
        if(!proto){
            //故障：体の帯がずれ、ときどき痙攣し、火花が散る。目の光が消えかけてちらつく
            _e.trNoise = 0.55 + 0.3*Math.random();
            if(_e.trTwitch > 0) _e.trTwitch--;
            else if(Math.random() < TR_TWITCH[0]){
                _e.trTwitch = TR_TWITCH[1];
                _e.trJx = (Math.random() - 0.5)*2*TR_TWITCH[2]; _e.trJr = (Math.random() - 0.5)*0.25;
                if(Math.random() < 0.5) sound.play("glitch");
            }
            if(Math.random() < TR_SPARK_P){
                var a = Math.random()*Math.PI*2;
                fx.sparks(_e.x + Math.cos(a)*24, _e.y + Math.sin(a)*20, 5 + Math.floor(Math.random()*6), Math.random() < 0.6 ? "255,170,90" : "150,200,255", 5, 2);
                if(Math.random() < 0.35) sound.play("zap");
            }
            if(_e.t % 9 == 0){
                effects.push({ smoke:true, x:_e.x + (Math.random()-0.5)*20, y:_e.y, vx:(Math.random()-0.5)*0.6, vy:-0.8,
                               R0:6, R1:22, life:40, maxLife:40, color:"60,50,55" });
            }
            if(!_e.trHeart) _e.look.tint = Math.random() < 0.15 ? "40,12,18" : "150,18,28";
            else _e.trHeart--;
        }else{
            //再構築：ノイズは工程が進むと消え、色が赤から紫へ。光が吸い込まれるように集まる
            _e.trNoise = Math.max(0, 0.5*(1 - k*2.2));
            _e.trTwitch = 0;
            _e.look.tint = mixRgb("190,20,30", KAI2_TINT, Math.round(Math.min(1, k*1.3)*8)/8);
            if(_e.t % 3 == 0){
                var a = Math.random()*Math.PI*2, R = 150 + Math.random()*80, sp = 4 + 8*k;
                effects.push({ x:_e.x + Math.cos(a)*R, y:_e.y + Math.sin(a)*R, vx:-Math.cos(a)*sp, vy:-Math.sin(a)*sp,
                               life:22, maxLife:22, size:2 + 2*k, glow:Math.random() < 0.6 ? TR_GLOW : "255,90,90" });
            }
        }
        M.shake = Math.max(M.shake, k > 0.85 ? 3 : 0);
        //組み上がるにつれて、夜の戦場の色へ(改の光が浮かぶように)
        battleBg.night += (TR_NIGHT*k - battleBg.night)*0.05;
        battleBg.light = { x:_e.x, y:_e.y, a:0.3*k, r:200 };
    },
    //再構築の間の拍ごとの出来事
    rebuildBeat:function(_e,_beat){
        var M = mainScreen, bar = Math.floor(_beat/4);
        if(bar < TR_PROTO_BAR){
            //故障の記録と、終わりの鼓動(鼓動の間は目が赤く灯る)
            for(var i=0; i<TR_FAIL_LOG.length; i++) if(TR_FAIL_LOG[i][0] == _beat){
                var last = i == TR_FAIL_LOG.length - 1;
                this.addLog(TR_FAIL_LOG[i][1], "fail");
                sound.play(last ? "error" : "typing");
                if(last){ fx.sparks(_e.x, _e.y, 30, "255,150,90", 8, 3); M.shake = Math.max(M.shake, 8); }
            }
            if(TR_FAIL_BEATS.indexOf(_beat) >= 0){
                M.beat(_beat == TR_FAIL_BEATS[TR_FAIL_BEATS.length - 1]);
                fx.ring(_e.x, _e.y, 70, "255,60,60", 16, 2);
                _e.look.tint = "190,20,30";
                _e.trHeart = 14;
            }
            return;
        }
        if(_beat % 4 != 0 || bar >= TR_SECTIONS[1].bar) return;
        //小節の頭：工程の記録。胸が光り、方眼に波。羽根が組み上がる
        for(var i=0; i<TR_PROTO_LOG.length; i++){
            if(TR_PROTO_LOG[i][0] != bar) continue;
            this.addLog(TR_PROTO_LOG[i][1], bar == TR_PROTO_BAR ? "start" : i == TR_PROTO_LOG.length - 1 ? "done" : "step");
            sound.play("typing");
        }
        M.beatT = 24;
        M.shake = Math.max(M.shake, bar >= 8 ? 4 : 2);
        battleBg.ripple(_e.x, _e.y, 6 + bar, 6, 40, TR_GLOW);
        fx.ring(_e.x, _e.y, 40 + bar*6, TR_GLOW, 14, 2);
        _e.trFlap = 1;
        fx.flare(_e.x, _e.y, 50 + bar*4, TR_GLOW, 10);
        sound.play("kaiBoot");
        if(bar == TR_PROTO_BAR){
            //プロトコル始動：閃光と帯。故障のノイズが晴れていく
            this.bannerT = 0;
            fsSfx.impact(false);
            fx.flare(_e.x, _e.y, 180, TR_GLOW, 20);
            fx.ring(_e.x, _e.y, 260, TR_GLOW, 24, 6);
            battleBg.ripple(_e.x, _e.y, 30, 8, 70, TR_GLOW);
            M.flashT = Math.max(M.flashT || 0, 8);
            M.shake = Math.max(M.shake, 10);
        }
        //8小節目からは、ゆっくりした光の粒の輪(よけるだけ)
        if(bar >= 8 && M.state == "play") fireRing(_e.x, _e.y, 12 + (bar - 8)*2, TR_MOTE_SPEED, bar*0.37, "tMote");
    },
    //記録に1行足す(kind：fail 故障 / start 始動 / step 工程 / done 完了)。古い行は流れて消える
    addLog:function(_text,_kind){
        if(_kind == "start") this.log = [];
        this.log.push({ text:_text, kind:_kind, f:this.logF });
        if(this.log.length > 7) this.log.shift();
    },
    //再構築の間に見えている羽根の数(片方の翼。プロトコルが始まってから、組み上がるまで少しずつ増える。小数の分は伸びている途中)
    rebuildN:function(_e){
        if(this.forceN != null) return this.forceN;
        if(_e.form == 2) return TR_WING_N;
        var p = this.pos();
        if(p < 0) return 0;
        var n = TR_SECTIONS[1].bar - 1.5 - TR_PROTO_BAR;     //最後の1小節半は組み上がったまま、一打を待つ
        return Math.max(0, Math.min(TR_WING_N, (this.beatAt(p)/4 - TR_PROTO_BAR)/n*TR_WING_N));
    },
    //再構築の進み(0：プロトコル始動 ～ 1：完全体。故障の間は0)
    rebuildK:function(_p){
        var a = this.barTime(TR_PROTO_BAR), b = TR_SECTIONS[1].from;
        return Math.max(0, Math.min(1, (_p - a)/(b - a)));
    },
    //再構築の間の改の絵(draw から)：痙攣・設計図の線・組み上がった羽根・本体・ノイズ・走査線
    drawRebuild:function(_e,_body,_orig){
        var p = this.pos(), k = p < 0 ? 0 : this.rebuildK(p), pulse = _e.trFlap || 0;
        if(k > 0){
            var R = 110*(0.5 + 0.5*k)*(1 + 0.15*pulse);
            var g = ctx.createRadialGradient(0,0,R*0.15,0,0,R);
            g.addColorStop(0, "rgba(" + TR_GLOW + "," + (0.3*k + 0.3*pulse) + ")");
            g.addColorStop(1, "rgba(" + TR_GLOW + ",0)");
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
        }
        ctx.save();
        if(_e.trTwitch > 0){ ctx.translate(_e.trJx || 0, 0); ctx.rotate(_e.trJr || 0); }
        else if(k == 0) ctx.rotate(0.12);       //倒れて傾いたまま
        if(k > 0 && !_body) this.drawBlueprint(_e, k);
        this.drawWings(_e, _body);
        _orig();
        if(!_body && _e.trNoise > 0.02){
            _e.fsNoise = _e.trNoise;
            finaleSync.drawNoise(_e, _orig);
            _e.fsNoise = 0;
        }
        if(k > 0 && k < 1 && !_body){
            //走査線：体を上下になぞる
            var y = Math.sin(p*5)*44;
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = "rgba(" + TR_GLOW + ",0.18)";
            ctx.fillRect(-60, y - 6, 120, 12);
            ctx.fillStyle = "rgba(235,215,255,0.8)";
            ctx.fillRect(-64, y - 0.75, 128, 1.5);
            ctx.globalCompositeOperation = "source-over";
            //体を囲むかぎ括弧(小節の頭で締まる)
            var b = 52 + 6*(1 - pulse), c = 12;
            ctx.strokeStyle = "rgba(" + TR_GLOW + ",0.8)"; ctx.lineWidth = 2;
            ctx.beginPath();
            for(var sx=-1; sx<=1; sx+=2) for(var sy=-1; sy<=1; sy+=2){
                ctx.moveTo(sx*b, sy*b - sy*c); ctx.lineTo(sx*b, sy*b); ctx.lineTo(sx*b - sx*c, sy*b);
            }
            ctx.stroke();
        }
        ctx.restore();
        return true;
    },
    //設計図の線：これから組み上がる羽根のりんかくを、点線で先に引いておく
    drawBlueprint:function(_e,_k){
        var vis = this.rebuildN(_e);
        this.forceN = TR_WING_N;
        var G = this.wingGeom(_e);
        this.forceN = null;
        ctx.save();
        ctx.setLineDash([4,4]);
        ctx.lineDashOffset = -(_e.t || 0)*0.5;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(220,190,255," + (0.25 + 0.35*Math.min(1, _k*4)) + ")";
        for(var i=0; i<G.f.length; i++){
            var f = G.f[i];
            if(f.gi + 1 <= vis) continue;
            var L = f.len, w = f.w;
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.a);
            ctx.beginPath();
            ctx.moveTo(0,0); ctx.quadraticCurveTo(L*0.35,-w, L,0); ctx.quadraticCurveTo(L*0.4,w*0.85, 0,0);
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    },
    //再構築の間の画面の上(drawFront から)：記録と進み具合、プロトコル始動の帯
    drawProtocol:function(_e){
        var p = this.pos();
        if(p < 0) return;
        var k = this.rebuildK(p), F = this.logF;
        //記録(故障の間は赤くちらつき、プロトコルが始まると紫になる)
        if(this.log.length){
            var x = TR_LOG_X, y = TR_LOG_Y, w = 300, h = 176, proto = k > 0;
            ctx.save();
            if(!proto && Math.random() < 0.08) ctx.translate((Math.random() - 0.5)*8, 0);
            ctx.fillStyle = proto ? "rgba(18,8,32,0.78)" : "rgba(28,6,8,0.78)";
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = proto ? "rgba(" + TR_GLOW + ",0.9)" : "rgba(255,70,70,0.9)";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            ctx.font = "bold 12px monospace";
            ctx.textAlign = "left"; ctx.textBaseline = "top";
            ctx.fillStyle = proto ? "rgb(" + TR_GLOW + ")" : "#f55";
            ctx.fillText(proto ? "REBUILD PROTOCOL" : "SYSTEM FAILURE", x + 10, y + 8);
            ctx.font = "13px sans-serif";
            for(var i=0; i<this.log.length; i++){
                var L = this.log[i], n = Math.min(L.text.length, Math.floor((F - L.f)/2));
                var col = L.kind == "fail" ? "#ff8070" : L.kind == "done" ? "#fff" : L.kind == "start" ? "#e8c8ff" : "#c9a8f0";
                var head = L.kind == "fail" ? "ERR " : "> ";
                var ok = L.kind == "step" && i < this.log.length - 1 ? "  OK" : "";
                ctx.fillStyle = col;
                ctx.fillText(head + L.text.slice(0, n) + (n >= L.text.length ? ok : ((F >> 3) % 2 ? "_" : "")), x + 10, y + 30 + i*17);
            }
            if(proto){
                //進み具合
                var bx = x + 10, by = y + h - 18, bw = w - 70;
                ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(bx, by, bw, 8);
                ctx.fillStyle = "rgb(" + TR_GLOW + ")"; ctx.fillRect(bx, by, bw*k, 8);
                ctx.fillStyle = "#fff"; ctx.font = "bold 12px monospace"; ctx.textBaseline = "middle";
                ctx.fillText(Math.floor(k*100) + "%", bx + bw + 8, by + 4);
            }
            ctx.restore();
        }
        //プロトコル始動の帯(開いて、文字が打ち込まれ、閉じる)
        var t = this.bannerT;
        if(t != null && t < TR_BANNER_F){
            var open = Math.min(1, t/8, (TR_BANNER_F - t)/12), cy = CH*0.45, hh = 46*open;
            ctx.save();
            ctx.fillStyle = "rgba(14,4,26,0.82)";
            ctx.fillRect(0, cy - hh, CW, hh*2);
            ctx.fillStyle = "rgb(" + TR_GLOW + ")";
            ctx.fillRect(0, cy - hh, CW, 2); ctx.fillRect(0, cy + hh - 2, CW, 2);
            //流れる斜めの縞
            ctx.beginPath(); ctx.rect(0, cy - hh, CW, hh*2); ctx.clip();
            ctx.fillStyle = "rgba(" + TR_GLOW + ",0.12)";
            for(var sx=-60 + (t*3) % 40; sx<CW; sx+=40){
                ctx.beginPath(); ctx.moveTo(sx, cy + hh); ctx.lineTo(sx + 20, cy + hh); ctx.lineTo(sx + 60, cy - hh); ctx.lineTo(sx + 40, cy - hh); ctx.fill();
            }
            var txt = "再構築プロトコル　始動", n = Math.min(txt.length, Math.floor((t - 6)/3));
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.font = "bold 13px monospace";
            ctx.fillStyle = "rgba(230,210,255," + open + ")";
            ctx.fillText("REBUILD PROTOCOL  //  INITIATE", CW/2, cy - 24);
            if(n > 0){
                ctx.font = "bold 30px sans-serif";
                ctx.fillStyle = "#fff";
                ctx.fillText(txt.slice(0, n), CW/2, cy + 8);
            }
            ctx.restore();
        }
    },
    //完全体になった瞬間(special.kaiAwakeFx の代わりに、曲を流し直さずに同じ演出)
    awake:function(_e){
        var M = mainScreen;
        sound.play("kaiIgnite");
        fsSfx.impact(true);
        _e.look.tint = KAI2_TINT;
        _e.look.setMood("fierce");
        _e.trFlap = 1;
        battleBg.ripple(_e.x, _e.y, 50, 10, 90, TR_GLOW);
        fx.flare(_e.x, _e.y, 300, TR_GLOW, 28);
        fx.ring(_e.x, _e.y, 360, TR_GLOW, 30, 10);
        fx.ring(_e.x, _e.y, 220, TR_FIRE, 24, 6);
        fx.sparks(_e.x, _e.y, 60, TR_GLOW, 12, 4);
        fx.shake(26);
        M.flashT = FLASH_TIME;
        M.hitStop = 6;
        M.zoomT = ZOOM_TIME; M.zoomX = _e.x; M.zoomY = _e.y;
        M.kaiDark = KAI_DARK_OUT;
        M.bossIntro = BOSS_INTRO_TIME;
        M.guard = Math.max(M.guard, 60);
        enemyShots = [];
        //翼から羽根が舞い散る
        this.feathersBurst(_e, 30, false);
    },
    //とどめのあと、曲の終わりを鳴らしている間(戦闘画面の中だけ)
    holdMusic:function(){
        return this.keepMusic && page.number == 1 && (this.fakeT != null || triumph.ended != null);
    },
    reset:function(){
        this.pillars = []; this.queue = []; this.shards = [];
        this.log = []; this.logF = 0; this.bannerT = null; this.forceN = null;
        this.dawnK = 0; this.dawnFlash = 0; this.finished = false; this.keepMusic = false; this.result = null;
        battleBg.far = 0;
    },

    //------------------------------------------------------------ 第二形態
    //曲に合わせて動かしているなら true(bosses.js の改の動きはそのあとで動く。沈む・迫る・息つぎ・最後の突進は自分だけで動かして true)
    step:function(_e,_dx,_dy,_d){
        if(!this.on() || !_e.trSong || _e.form != 2 || _e.mode == "down" || _e.mode == "revive") return false;
        this.names();
        var p = this.pos();
        if(p < 0) return false;
        if(_e.trR0 == null){ _e.trR0 = _e.r; _e.trScale = 1; _e.trPulse = 0; _e.trCycle = 0; _e.trFlap = _e.trFlap || 0; _e.trFold = 0; _e.trFire = 0; }
        //着いた瞬間までに衝撃波が出ていなければ、TR_LATE_SEC だけ待つ(その間は区切りを進めず、改は着く所で止まったまま)。
        //最後の突進では、着いた瞬間に曲が頭へ戻ることがあるので、戻ったときも待つ
        if(_e.trApproach && _e.trBlastP == null && !this.finished){
            if(_e.trLate == null && (p >= _e.trHit || p < _e.trHit - 5)) _e.trLate = 0;
            if(_e.trLate != null && ++_e.trLate <= TR_LATE_SEC*60) return true;
        }
        var sec = this.section(p);
        var bf = this.beatAt(p), beat = Math.floor(bf + 1e-6), bar = Math.floor(beat/4);
        //曲がくり返して戻った：あとで出す予定のものは捨てる
        if(_e.trBeatN != null && beat < _e.trBeatN - 1){ this.queue = []; this.pillars = []; }
        var newBeat = beat != _e.trBeatN, newBar = newBeat && beat % 4 == 0;
        _e.trBeatN = beat;
        if(sec != _e.trSec){
            var from = _e.trSec;
            _e.trSec = sec;
            _e.trCycle = 0;
            this.enter(_e, sec, from, p);
        }
        //あとの拍で出す予定のもの
        if(newBeat){
            for(var i=this.queue.length-1; i>=0; i--){
                if(this.queue[i].beat <= beat){ var q = this.queue[i]; this.queue.splice(i,1); q.f(); }
            }
        }
        this.pillarStep(p);
        //大きさ・翼の動き
        _e.trScale += ((sec.giant ? TR_GIANT : 1) - _e.trScale)*0.05;
        _e.fsScale = _e.trScale;    //ブレードの回る半径(bosses.js の bladeR)
        _e.r = _e.trR0*_e.trScale;
        if(_e.trPulse > 0) _e.trPulse = Math.max(0, _e.trPulse - 0.06);
        if(_e.trFlap > 0) _e.trFlap = Math.max(0, _e.trFlap - 0.035);
        _e.trFold += ((sec.name == "breath" ? 1 : 0) - _e.trFold)*(sec.name == "breath" ? 0.06 : 0.25);
        this.loseFeathers(_e, sec);
        this.gate(_e, p);

        //奥の空と街：沈む・迫る・最後の突進は遠ざかって暗くなる
        var far = 0;
        if(sec.name == "sink") far = Math.min(1, (p - sec.from)/(this.barTime(sec.bar + TR_SINK_BARS) - sec.from));
        if(sec.name == "hush") far = 1;
        if(sec.name == "last") far = this.lastZ(p) > 0.02 ? Math.min(1, this.lastZ(p) + 0.3) : 0;
        battleBg.far += (far - battleBg.far)*(far > battleBg.far ? 0.05 : 0.08);
        //夜の戦場(夜明けからは明ける)。改が足もとを照らす
        this.dawnStep(p);
        var night = TR_NIGHT*(1 - (1 - TR_DAWN_NIGHT)*this.dawnK);
        battleBg.night += (night - battleBg.night)*0.03;
        var deep = _e.trMode == "sink" || _e.trMode == "hush" || _e.trMode == "last";
        battleBg.light = { x:_e.x, y:_e.y, a:0.32*(1 + 0.8*_e.trPulse), r:240*(deep ? 0.6 : _e.trScale) };
        //着いたあと：大きいまま触れても被弾しない間・光の尾
        if(_e.trSafe > 0){
            _e.harmless = --_e.trSafe > 0;
            if(_e.trSafe % 2 == 0) effects.push({ x:_e.x, y:_e.y, vx:-_e.vx*0.1, vy:-_e.vy*0.1, life:20, maxLife:20, size:6, glow:JUST_COLOR });
        }

        if(sec.name == "sink"){ this.sink(_e, p, newBeat, beat); return true; }
        if(sec.name == "hush"){ this.approach(_e, p, newBeat, sec.from, this.sec("climax").from); return true; }
        if(sec.name == "breath"){ this.breath(_e, p); return true; }
        if(sec.name == "last"){ this.last(_e, p, newBeat); return true; }
        if(sec.name == "end") return true;

        //ふだんの区切り：bosses.js のタイマーでは攻撃させず、拍・小節で出す
        _e.timer = 999; _e.gunT = 999;
        var play = mainScreen.state == "play";
        if(newBeat && play && sec.gun && beat % sec.gun == 0 && _e.mode != "stagger"){
            var ph = _e.phase || 4;
            fireFan(_e.x, _e.y, Math.atan2(_dy,_dx), TR_GUN_N[ph >= 5 ? 1 : 0], 0.2, TR_GUN_SPEED*danmaku(), "tOrb");
            this.kick(_e, Math.atan2(_dy,_dx), TR_KICK[0]/TR_KICK[1]);
            sound.play("shot");
        }
        if(newBar && play){
            if(sec.pulse){
                battleBg.ripple(_e.x, _e.y, 16, 7, 40, TR_GLOW);
                fx.ring(_e.x, _e.y, 100*_e.trScale, TR_GLOW, 14, 3);
                fx.shake(2);
                _e.trPulse = 1;
            }else battleBg.ripple(_e.x, _e.y, 7, 6, 30, TR_GLOW);
            if((bar - sec.bar) % sec.every == 0 && _e.mode == "idle"){
                this.attack(_e, sec.list[_e.trCycle++ % sec.list.length], beat, Math.atan2(_dy,_dx));
                this.kick(_e, Math.atan2(_dy,_dx), 1);
            }
        }
        return false;
    },
    //体力の関門(割合。夜明けからは1だけ残す)
    floor:function(_e){
        var bar = this.beatAt(Math.max(0, this.pos()))/4;
        for(var i=0; i<TR_GATES.length; i++) if(bar < TR_GATES[i][0]) return Math.ceil(_e.maxHp*TR_GATES[i][1]);
        return 1;
    },
    gate:function(_e){ _e.hp = Math.max(_e.hp, Math.min(_e.maxHp, this.floor(_e))); },
    //夜明けから：体力が減るほど、大きな翼の先の羽根から欠けて舞い落ちる
    loseFeathers:function(_e,_sec){
        if(this.dawnK <= 0) return;
        var hurt = 1 - _e.hp/_e.maxHp;      //0.65(夜明けの関門) → 1
        var lost = Math.max(0, Math.min(TR_WING_LOSE.length - 2, Math.floor((hurt - 0.62)/0.38*TR_WING_LOSE.length)));
        while((_e.trLost || 0) < lost){
            var gi = TR_WING_LOSE[_e.trLost || 0];
            _e.trLost = (_e.trLost || 0) + 1;
            var G = this.wingGeom(_e);
            for(var i=0; i<G.f.length; i++){
                var f = G.f[i];
                if(f.gi != gi) continue;
                var P = this.toWorld(_e, f.x + Math.cos(f.a)*f.len*0.5, f.y + Math.sin(f.a)*f.len*0.5);
                this.shardsAt(P.x, P.y, 8, true);
            }
            fx.flare(_e.x, _e.y, 60, TR_FIRE, 10);
            sound.play("glitch");
        }
    },
    //区切りに入ったとき
    enter:function(_e,_sec,_from,_p){
        var M = mainScreen;
        switch(_sec.name){
            case "sink":
                this.calm(_e);
                _e.trMode = "sink";
                _e.trWx = _e.x; _e.trWy = _e.y;
                popup(_e.x, _e.y - 70, "ドローン君改　天翼、夜空へ…", "#a3c", true);
                fsSfx.rumble(this.sec("hush").from - _p);
                break;
            case "hush":
                //迫る：弾が消え、奥から迫り始める。狙いはドローン君から。うなりを止め、着く瞬間へ向けて音が高まる
                this.calm(_e);
                fsSfx.stopRumble();
                fsSfx.riser(this.sec("climax").from - _p);
                this.clearShots();
                _e.trMode = "hush";
                this.aimStart(_e);
                break;
            case "climax":
                if(_from && _from.name == "hush") this.resolve(_e, false);
                break;
            case "breath":
                //息つぎ：翼をたたみ、弾が光になって改へ吸い込まれる
                this.calm(_e);
                _e.trMode = "breath";
                for(var i=0; i<enemyShots.length; i++){
                    var b = enemyShots[i];
                    effects.push({ x:b.x, y:b.y, vx:(_e.x - b.x)*0.06, vy:(_e.y - b.y)*0.06, life:16, maxLife:16, size:3, glow:TR_GLOW });
                }
                enemyShots = []; this.pillars = []; this.queue = [];
                sound.play("kaiBoot");
                fsSfx.rumble(this.sec("storm").from - _p);
                break;
            case "storm":
                if(_from && _from.name == "breath") this.release(_e);
                break;
            case "dawn":
                if(_from && (_from.name == "last" || _from.name == "end")){
                    //とどめを決められなかった：曲が夜明けへ戻る(着いたところで弾き返せたかを決めてから)。もう一度
                    if(_from.name == "last") this.resolve(_e, true);
                    this.backFromLast(_e);
                    popup(CW/2, 150, "まだだ！　もう一度", "rgb(" + JUST_COLOR + ")", true);
                }else this.dawn(_e);
                break;
            case "last":
                //最後の突進：奥へ下がってから迫ってくる
                this.calm(_e);
                this.clearShots();
                _e.trMode = "last";
                _e.trWx = _e.x; _e.trWy = _e.y;
                _e.trBlastP = null; _e.trLocked = false; _e.trTold = false;
                fsSfx.whoosh(0);
                popup(_e.x, _e.y - 70, "ドローン君改　最後の突進", "#a3c", true);
                break;
            case "end":
                if(_from && _from.name == "last") this.resolve(_e, true);
                break;
        }
        //沈む・迫る・息つぎ・最後の突進でなくなったら、ふだんの動きへ
        if(_sec.name != "sink" && _sec.name != "hush" && _sec.name != "breath" && _sec.name != "last" && _sec.name != "end" && _e.trMode){
            _e.trMode = null;
            _e.harmless = _e.trSafe > 0; _e.phased = false;
            if(_e.mode == "fs") _e.mode = "idle";
        }
    },
    //攻撃を全部やめる
    calm:function(_e){
        _e.mode = "fs";
        _e.beams = 1;
        _e.waterT = _e.spiralT = _e.rainT = _e.circleT = 0;
        _e.mines = []; _e.strikes = [];
        _e.chain = 0;
        _e.vx = 0; _e.vy = 0;
        for(var i=0; i<enemies.length; i++) if(enemies[i].minion) enemies[i].dead = true;
    },
    clearShots:function(){
        for(var i=0; i<enemyShots.length; i++) fx.sparks(enemyShots[i].x, enemyShots[i].y, 2, TR_GLOW, 2, 2);
        enemyShots = []; this.pillars = []; this.queue = [];
        shotLab.deeps = [];
    },
    //奥から迫り始める(狙いはドローン君から)
    aimStart:function(_e){
        _e.trTx = drone.X; _e.trTy = drone.Y;
        _e.trMorph0 = null;
        _e.trBlastP = null;
        _e.trLocked = false;
        _e.trApproach = false;
        _e.trPulses = []; _e.trDash = false;
        mainScreen.yaruki = Math.max(mainScreen.yaruki, YARUKI_COST);     //迎え撃てるよう、衝撃波1回分のやる気は残す
    },
    //沈む：奥へ下がり、奥から拍に合わせて撃つ。当たらない
    sink:function(_e,_p,_newBeat,_beat){
        _e.harmless = true; _e.phased = true;
        _e.look.update(0,0);
        var S = this.sec("sink"), k = Math.min(1, (_p - S.from)/(this.barTime(S.bar + TR_SINK_BARS) - S.from));
        this.flyAway(_e, k);
        var dk = (_p - S.from)/(this.sec("hush").from - S.from);
        _e.trDark = TR_DARK[0] + (TR_DARK[1] - TR_DARK[0])*Math.min(1, dk);
        if(!_newBeat || mainScreen.state != "play") return;
        var bar = Math.floor(_beat/4);
        //1小節目は2拍ごと、そのあとは毎拍。3拍あとの拍ちょうどに着くよう撃つ
        if(bar >= S.bar + 1 && (bar >= S.bar + 2 || _beat % 2 == 0)){
            this.deepOnBeat(aimAt.X + (Math.random() - 0.5)*TR_DEEP_SPREAD*2, aimAt.Y + (Math.random() - 0.5)*TR_DEEP_SPREAD*2, _beat + 3);
        }
        //低音が戻る一打(66小節目の頭)：奥の改が光り、ドローン君を囲んで6発が同時に落ちる
        if(_beat == (S.bar + 4)*4){
            fx.flare(_e.x, _e.y, 80, TR_GLOW, 16);
            battleBg.ripple(DEPTH_VP.x, DEPTH_VP.y, 20, 8, 70, TR_GLOW);
            for(var i=0; i<6; i++){
                var a = i*Math.PI/3 + Math.random()*0.5;
                this.deepOnBeat(aimAt.X + Math.cos(a)*110, aimAt.Y + Math.sin(a)*110, _beat + 3);
            }
        }
    },
    //奥へ飛び去る(_k：0～1)：身を起こして翼を広げ → 外側へ弧を描いて舞い上がり、背中を見せて奥へ
    flyAway:function(_e,_k){
        var side = _e.trWx < CW/2 ? -1 : 1, L = _e.look, k = Math.max(0, Math.min(1, _k));
        L.update(0,0);
        var wx, wy, z, x0 = _e.trWx, y0 = _e.trWy - TR_FLY_RISE;
        if(k < TR_FLY_WIND){
            var q = k/TR_FLY_WIND, u = 1 - (1 - q)*(1 - q);
            wx = _e.trWx; wy = _e.trWy - TR_FLY_RISE*u; z = -0.06*Math.sin(q*Math.PI);
            _e.trFlap = Math.max(_e.trFlap || 0, u);
            _e.trRoll = (_e.trRoll || 0) + (-side*0.2*u - (_e.trRoll || 0))*0.2;
            _e.trGlide = (_e.trGlide || 0)*0.9; _e.trBrake = u;
            _e.trLaunched = false;
        }else{
            if(!_e.trLaunched){
                //飛び立つ：衝撃の輪と風の音
                _e.trLaunched = true;
                fx.ring(_e.x, _e.y, 180*_e.trScale, TR_FIRE, 16, 6);
                fx.ring(_e.x, _e.y, 110*_e.trScale, TR_GLOW, 12, 3);
                battleBg.ripple(_e.x, _e.y, 26, 9, 60, TR_GLOW);
                fx.shake(8);
                fsSfx.whoosh(0);
            }
            var q = (k - TR_FLY_WIND)/(1 - TR_FLY_WIND), u = 1 - Math.pow(1 - q, 2.2);    //勢いよく飛び出して、奥へ行くほどゆっくり
            var cx = x0 - side*TR_FLY_ARC[0], cy = y0 - TR_FLY_ARC[1], x1 = CW/2, y1 = TR_SINK_Y, m = 1 - u;
            wx = m*m*x0 + 2*m*u*cx + u*u*x1; wy = m*m*y0 + 2*m*u*cy + u*u*y1; z = u;
            //弧の向きへ傾き、背中を見せる(振り返る)。翼は後ろへ引く
            _e.trRoll = (_e.trRoll || 0) + (side*0.7*Math.sin(Math.PI*Math.min(1, u*1.3)) - (_e.trRoll || 0))*0.15;
            var by = side*170*Math.min(1, u*2);
            L.yaw += (by - L.yaw)*0.15; L.yawV = 0;
            L.elev += (-0.5 - L.elev)*0.1; L.elevV = 0;
            _e.trGlide = (_e.trGlide || 0) + (1 - (_e.trGlide || 0))*0.2; _e.trBrake = 0;
            //光の尾
            effects.push({ x:_e.x, y:_e.y, vx:0, vy:0, life:22, maxLife:22, size:3 + 8*_e.trDraw, glow:Math.random() < 0.5 ? TR_FIRE : TR_GLOW });
        }
        var P = shotLab.depthAt(wx, wy, z);
        _e.x = P.x; _e.y = P.y; _e.vx = 0; _e.vy = 0;
        _e.trDraw = P.s*_e.trScale;
    },
    //奥からの砲撃を、_beat 拍目ちょうどに着くよう撃つ(shotLab.deep は DEEP_TIME フレームで着くので、残りに合わせて進めておく)
    deepOnBeat:function(_x,_y,_beat){
        var d = shotLab.deep(Math.max(20, Math.min(CW - 20, _x)), Math.max(60, Math.min(CH - 20, _y)));
        d.t = Math.max(0, Math.round(DEEP_TIME - (this.beatTime(_beat) - this.pos())*60));
    },
    //迫る：奥(_from 秒)から、_hit 秒に着く。改は奥にいたまま光をため(姿は見せない)、着く TR_TELL_BEATS 拍前に狙いが止まって
    //拍ごとに予兆の光の脈を出し、最後の TR_HOLD_BEATS 拍は静まって光が凝縮し、着く瞬間に一瞬で来る
    approach:function(_e,_p,_newBeat,_from,_hit){
        _e.harmless = true; _e.phased = true;
        _e.look.update(0,0);
        var k = Math.max(0, Math.min(1, (_p - _from)/(_hit - _from)));
        var hb = Math.round(this.beatAt(_hit)), b = Math.floor(this.beatAt(_p) + 1e-6), toGo = hb - b;
        if(toGo > TR_TELL_BEATS){
            _e.trTx += (aimAt.X - _e.trTx)*0.08; _e.trTy += (aimAt.Y - _e.trTy)*0.08;
        }else if(!_e.trLocked){
            _e.trLocked = true;     //合図の音は鳴らさない(拍を数える音がうるさいので。合図は見た目だけ)
        }
        //奥(着く所の向こう)で光をためる。はじめは、飛び去った改の姿が光に溶けながら、その位置へなめらかに移る
        var P = shotLab.depthAt(_e.trTx, _e.trTy, 1);
        if(_e.trMorph0 == null){ _e.trMorph0 = _p; _e.trMx = _e.x; _e.trMy = _e.y; _e.trMs = _e.trDraw || P.s; }
        var m = Math.max(0, Math.min(1, (_p - _e.trMorph0)/TR_MORPH_SEC)), em = m*m*(3 - 2*m);
        _e.trMorph = m;
        _e.x = _e.trMx + (P.x - _e.trMx)*em; _e.y = _e.trMy + (P.y - _e.trMy)*em; _e.vx = 0; _e.vy = 0;
        _e.trDraw = _e.trMs + (P.s - _e.trMs)*em;
        if(!_e.trPulses) _e.trPulses = [];
        //予兆：狙いが止まってから、最後のタメの前まで、拍ごとに光の脈が奥から着く所へ走る
        if(_newBeat && _e.trLocked && toGo > TR_HOLD_BEATS){
            _e.trPulses.push({ t0:_p, n:TR_TELL_BEATS - toGo + 1 });
            fx.flare(_e.x, _e.y, 40, TR_FIRE, 8);
        }
        //ため：動き出す(最後のタメ)まで、だんだん強くなる(はじめはゆっくり、動き出す前に一気に)
        var hold = toGo <= TR_HOLD_BEATS;
        var hs = this.beatTime(hb - TR_HOLD_BEATS), c = Math.pow(Math.max(0, Math.min(1, (_p - _from)/(hs - _from))), TR_CHARGE_POW);
        _e.trCharge = c;
        if(_newBeat) battleBg.ripple(_e.x, _e.y, 6 + 16*c, 7, 50, TR_GLOW);
        mainScreen.shake = Math.max(mainScreen.shake, hold ? 2.5 : 0.3 + 1.6*c);
        //まわりから光が吸い込まれる(ためるほど多く速く)
        var every = Math.max(1, Math.round(4 - 3*c));
        if(_e.t % (hold ? 1 : every) == 0){
            var a = Math.random()*Math.PI*2, R = 60 + Math.random()*80 + 60*c, sp = hold ? 8 : 2 + 6*c;
            effects.push({ x:_e.x + Math.cos(a)*R, y:_e.y + Math.sin(a)*R, vx:-Math.cos(a)*sp, vy:-Math.sin(a)*sp,
                           life:Math.round(R/sp), maxLife:Math.round(R/sp), size:1.5 + 1.5*k, glow:Math.random() < 0.5 ? TR_GLOW : TR_FIRE });
        }
        //一瞬で来る(光の筋)
        if(_hit - _p < TR_DASH_SEC){
            if(!_e.trDash){ _e.trDash = true; fsSfx.whoosh(0); sound.play("dash"); }
            //迫ってくる：揺れが強まり、着く所へぐっと寄る
            var du = 1 - Math.max(0, _hit - _p)/TR_DASH_SEC, M = mainScreen;
            M.shake = Math.max(M.shake, 2 + 10*du);
            M.zoomT = Math.max(M.zoomT, Math.round(ZOOM_TIME*0.7*du)); M.zoomX = _e.trTx; M.zoomY = _e.trTy;
        }
        _e.trDark = TR_DARK[2] + (hold ? 0.1 : 0);
        _e.trHit = _hit;
        _e.trK = k;
        _e.trHold = hold;
        _e.trApproach = true;
        //早く出してしまっても迎え撃てるよう、狙いが止まったらもう一度やる気を戻す
        if(_e.trLocked) mainScreen.yaruki = Math.max(mainScreen.yaruki, YARUKI_COST);
    },
    //最後の突進：1小節で奥へ下がり、残りの2小節で迫る
    lastZ:function(_p){
        var L = this.sec("last"), mid = this.barTime(L.bar + 1);
        if(_p < mid){ var k = (_p - L.from)/(mid - L.from); return k*k*(3 - 2*k); }
        var E = this.sec("end").from, k2 = Math.max(0, Math.min(1, (_p - mid)/(E - mid)));
        return 1 - k2*k2;
    },
    last:function(_e,_p,_newBeat){
        var L = this.sec("last"), mid = this.barTime(L.bar + 1);
        if(_p < mid){
            _e.harmless = true; _e.phased = true;
            _e.look.update(0,0);
            var q = this.lastZ(_p);
            this.flyAway(_e, (_p - L.from)/(mid - L.from));
            _e.trDark = TR_DARK[1]*q;
            this.aimStart(_e);
            return;
        }
        if(!_e.trTold){
            //奥で振り返る一打(121小節目の頭)
            _e.trTold = true;
            fx.flare(_e.x, _e.y, 90, TR_FIRE, 16);
            battleBg.ripple(DEPTH_VP.x, DEPTH_VP.y, 30, 9, 80, TR_GLOW);
            fsSfx.riser(this.sec("end").from - _p);
        }
        this.approach(_e, _p, _newBeat, mid, this.sec("end").from);
    },
    //衝撃波を出した(shotLab.onBlast から)：迫っている間なら時刻を覚える。最後の突進で決まれば、曲をくり返しから抜く
    //早すぎる衝撃波は数えない(やる気は迫る間に戻す：approach)
    onBlast:function(){
        var e = this.boss();
        if(!e || !e.trApproach || e.trBlastP != null) return;
        var p = this.pos(), left = e.trHit - p;
        //着いたあとに待っている間(step の trLate)：遅れた分を、待ったコマ数から決める(曲が頭へ戻っていても数えられるように)
        if(e.trLate != null){ left = -e.trLate/60; p = e.trHit - left; }
        if(left < -TR_LATE_SEC || left > TR_JUST_SEC) return;
        e.trBlastP = p;
        var near = Math.hypot(drone.X - e.trTx, drone.Y - e.trTy);
        if(e.trMode == "last" && near < TR_RAM_R + TR_JUST_NEAR && e.hp <= e.maxHp*TR_FINISH + 1){
            //とどめが決まる：曲はくり返しを抜けて、最後の和音へ
            this.finished = true;
            triumph.finish();
        }
    },
    //着いた(最高潮の頭・最後の和音)。合わせて衝撃波を出していれば弾き返す
    resolve:function(_e,_last){
        var M = mainScreen;
        var left = _e.trBlastP == null ? -1 : (_e.trHit || 0) - _e.trBlastP;
        var near = Math.hypot(drone.X - _e.trTx, drone.Y - _e.trTy);
        _e.x = _e.trTx; _e.y = _e.trTy;
        _e.harmless = false; _e.phased = false;
        this.impact = { x:_e.x, y:_e.y, p0:this.pos() };
        M.zoomT = ZOOM_TIME; M.zoomX = _e.x; M.zoomY = _e.y;
        this.shardsAt(_e.x, _e.y, 36, false);   //衝撃は曲の時刻で進める(止まっている間・画面の細かさにかかわらず同じ長さ)。白い閃光もここで出す(画面全体の閃光 flashT は、止まっている間も消えないので使わない)
        M.hitStop = Math.max(M.hitStop, TR_MISS_STOP);
        battleBg.ripple(_e.x, _e.y, 70, 12, 110, TR_FIRE);
        battleBg.ripple(_e.x, _e.y, 50, 10, 90, TR_GLOW);
        fx.ring(_e.x, _e.y, 320, TR_GLOW, 30, 10);
        var ok = (_e.trBlastP != null && left >= -TR_LATE_SEC && left <= TR_JUST_SEC && near < TR_RAM_R + TR_JUST_NEAR) || (_last && this.finished);
        _e.trApproach = false;
        _e.trLate = null;
        if(ok){
            var perfect = left <= TR_PERFECT_SEC && left >= -TR_LATE_PERFECT;
            this.result = perfect ? "perfect" : "just";
            _e.look.setFace("hurt", 50);
            popup(_e.x, _e.y - 70, perfect ? "PERFECT" : "JUST", "rgb(" + JUST_COLOR + ")", true);
            fx.ring(_e.x, _e.y, 220, JUST_COLOR, 26, 8);
            fx.sparks(_e.x, _e.y, 50, JUST_COLOR, 12, 4);
            fx.shake(26);
            M.zoomT = ZOOM_TIME; M.zoomX = _e.x; M.zoomY = _e.y;
            sound.play("just");
            fsSfx.impact(true);
            fsSfx.whoosh(0.08);
            if(_last && this.finished){ this.finish(_e, perfect); return; }
            M.hitStop = Math.max(M.hitStop, TR_HIT_STOP[0]);
            //上へはじき飛ばされてよろける。最高潮の頭なら、翼に火がつく
            var dx = _e.x - CW/2, dy = _e.y - 120, d = Math.hypot(dx,dy) || 1;
            _e.vx = -dx/d*TR_FLING; _e.vy = -dy/d*TR_FLING;
            _e.mode = "stagger"; _e.count = TR_STAGGER; _e.chain = 0;
            _e.flash = 12;
            if(!_last) _e.trFire = 1;
            this.shardsAt(_e.x, _e.y, 40, false);
            sound.play("glitch");
            fsSfx.shatter();
            this.hurt(_e, _last ? _e.maxHp*TR_LAST_DMG : _e.maxHp*TR_PARRY_DMG[perfect ? 1 : 0]);
        }else{
            if(near < TR_RAM_R + HIT_CORE && M.canBeHit()) M.damage();
            fx.shake(26);
            sound.play("dash");
            fsSfx.impact(false);
            _e.vx = 0; _e.vy = -6;
            _e.mode = "idle";
            if(!_last) _e.trFire = 1;      //止められなくても、最高潮では翼が燃える
            this.result = near < TR_RAM_R + HIT_CORE ? "hit" : "dodge";
        }
        _e.trMode = null;
        _e.trPulses = []; _e.trDash = false;
        //迫ってきた大きさから、だんだんふだんの大きさへ戻る(その間は触れても被弾しない)
        _e.trScale = TR_AFTER_SCALE;
        _e.r = _e.trR0*_e.trScale;
        _e.trSafe = TR_SAFE;
        _e.harmless = true;
    },
    //関門を越えてダメージを与える(弾き返したときの一撃)
    hurt:function(_e,_dmg){
        _e.hp = Math.max(1, Math.round(_e.hp - _dmg));
        _e.flash = 10;
        bossDebug.dealt(_e, _dmg);
    },
    //とどめ：止まって、翼が砕け散り、夜が明けきる。曲は最後の和音を鳴らし続ける
    finish:function(_e,_perfect){
        var M = mainScreen;
        M.hitStop = Math.max(M.hitStop, TR_HIT_STOP[1]);
        this.keepMusic = true;
        this.dawnFlash = 1;
        popup(_e.x, _e.y - 110, "とどめ！", "rgb(" + TR_SUN + ")", true);
        fx.flare(_e.x, _e.y, 420, TR_FIRE, 40);
        fx.ring(_e.x, _e.y, 520, TR_SUN, 40, 14);
        fx.ring(_e.x, _e.y, 300, JUST_COLOR, 30, 8);
        battleBg.ripple(_e.x, _e.y, 70, 12, 120, TR_SUN);
        this.feathersBurst(_e, 70, true);
        _e.trLost = TR_WING_LOSE.length;
        enemyShots = []; this.pillars = []; this.queue = [];
        _e.harmless = false; _e.phased = false; _e.trMode = null;
        mainScreen.hitEnemy(_e, _e.hp + 1, "trFinish");
    },
    //最後の突進で決められず、夜明けへ戻った
    backFromLast:function(_e){
        _e.trMode = null;
        _e.harmless = _e.trSafe > 0; _e.phased = false;
        if(_e.mode == "fs") _e.mode = "idle";
        this.finished = false;
    },
    //息つぎ：その場で止まって光を吸い込む(撃てば当たる)
    breath:function(_e,_p){
        _e.harmless = false; _e.phased = false;
        _e.vx *= 0.85; _e.vy *= 0.85;
        _e.look.update(0,0);
        _e.trDark = 0;
        if(_e.t % 3 == 0){
            var a = Math.random()*Math.PI*2, R = 170 + Math.random()*90, sp = 8;
            effects.push({ x:_e.x + Math.cos(a)*R, y:_e.y + Math.sin(a)*R, vx:-Math.cos(a)*sp, vy:-Math.sin(a)*sp,
                           life:20, maxLife:20, size:3, glow:TR_GLOW });
        }
        mainScreen.shake = Math.max(mainScreen.shake, 2);
    },
    //息つぎのあと：ためた光を一気に放つ(翼が開く)
    release:function(_e){
        var M = mainScreen;
        fsSfx.stopRumble();
        _e.trFold = 0; _e.trFlap = 1;
        fireRing(_e.x, _e.y, 28, 2.6*Math.min(1.3,danmaku()), Math.random(), "tFeather");
        fireRing(_e.x, _e.y, 14, 1.7, Math.random(), "tOrb");
        fx.flare(_e.x, _e.y, 280, TR_FIRE, 26);
        fx.ring(_e.x, _e.y, 340, TR_GLOW, 28, 10);
        battleBg.ripple(_e.x, _e.y, 50, 10, 90, TR_GLOW);
        fx.shake(20);
        M.flashT = FLASH_TIME;
        sound.play("kaiIgnite");
        fsSfx.impact(true);
        this.feathersBurst(_e, 24, false);
    },
    //夜明け：空が明け、ドローン君にも光の翼
    dawn:function(_e){
        var M = mainScreen;
        if(this.dawnK > 0) return;
        this.dawnK = 0.001;
        this.dawnT0 = this.pos();
        M.flashT = FLASH_TIME;
        fx.flare(drone.X, drone.Y, 200, TR_SUN, 30);
        fx.ring(drone.X, drone.Y, 260, TR_SUN, 30, 8);
        fx.ring(drone.X, drone.Y, 140, JUST_COLOR, 22, 4);
        fx.sparks(drone.X, drone.Y, 40, TR_SUN, 9, 3);
        battleBg.ripple(drone.X, drone.Y, 40, 9, 90, TR_SUN);
        popup(drone.X, drone.Y - 60, "夜明け ― 反撃のとき！", "rgb(" + TR_SUN + ")", true);
        M.addYaruki(YARUKI_COST*2);
        fsSfx.impact(true);
        sound.play("just");
    },
    dawnStep:function(_p){
        if(this.dawnK > 0) this.dawnK = Math.min(1, Math.max(this.dawnK, (_p - this.dawnT0)/TR_DAWN_SEC));     //曲がくり返しても戻らない
        if(this.dawnFlash > 0) this.dawnFlash = Math.max(0, this.dawnFlash - 0.012);
    },

    //------------------------------------------------------------ 攻撃(小節の頭に出す)
    attack:function(_e,_name,_beat,_toDrone){
        if(TR_OWN.indexOf(_name) < 0){ special.kaiAttack(_e, _name, _e.phase || 4, _toDrone); return; }
        var self = this, climax = this.beatAt(this.pos())/4 >= this.sec("climax").bar;
        switch(_name){
            case "feathers":
                //翼の羽根：この小節の4拍、両方の翼の先から扇に撃つ(扇の向きはドローン君をはさんで振れる)
                for(var i=0; i<4; i++){
                    (function(_i){ self.later(_beat + _i, function(){ self.feathers(_e, _i); }); })(i);
                }
                break;
            case "halo":
                //光輪：すき間のある輪を2つ(2つ目はすき間がずれる)
                this.halo(_e, 0);
                this.later(_beat + 2, function(){ self.halo(_e, Math.random() < 0.5 ? 0.6 : -0.6); });
                break;
            case "pillars":
            case "bands":
                //光の柱：次の小節の4拍に1本ずつ落ちる(最後の1本は2拍前に狙い直す)
                var v = _name == "pillars", c = v ? aimAt.X : aimAt.Y, side = Math.random() < 0.5 ? -1 : 1;
                var G = v ? TR_PILLAR_GAP : TR_PILLAR_GAP*0.7;
                var at = [c, c + side*G, c - side*G, null];
                for(var i=0; i<4; i++){
                    (function(_i){
                        var hit = _beat + 4 + _i;
                        if(at[_i] == null) self.later(hit - 2, function(){ self.pillar(v, v ? aimAt.X : aimAt.Y, hit); });
                        else self.pillar(v, at[_i], hit);
                    })(i);
                }
                sound.play("beamCharge");
                break;
            case "lances":
                //光の槍：翼から飛び出してドローン君を囲み、3拍目に狙いが止まり、次の小節の頭にいっせいに飛ぶ
                var n = TR_LANCE_N[climax ? 1 : 0], cx = aimAt.X, cy = aimAt.Y, a0 = Math.random()*Math.PI*2;
                var t0 = this.pos(), t1 = this.beatTime(_beat + 2), t2 = this.beatTime(_beat + 3), t3 = this.beatTime(_beat + 4);
                for(var i=0; i<n; i++){
                    var a = a0 + i*Math.PI*2/n;
                    var w = this.wingPoint(_e, i % 2 ? 1 : -1, Math.floor(i/2), 1);
                    var hx = Math.max(20, Math.min(CW - 20, cx + Math.cos(a)*TR_LANCE_R)), hy = Math.max(20, Math.min(CH - 20, cy + Math.sin(a)*TR_LANCE_R));
                    enemyShots.push({ x:w.x, y:w.y, vx:0, vy:0, r:SHOT_KINDS.tLance.r, kind:"tLance", grazed:false, behind:true,
                                      sx:w.x, sy:w.y, hx:hx, hy:hy, t0:t0, t1:t1, t2:t2, t3:t3, ax:cx, ay:cy, ph:"fly" });
                }
                sound.play("summon");
                break;
        }
    },
    later:function(_beat,_f){ this.queue.push({ beat:_beat, f:_f }); },
    feathers:function(_e,_i){
        if(mainScreen.state != "play" || _e.trMode) return;
        var tg = nearestPlayer(_e.x, _e.y), base = Math.atan2(tg.Y - _e.y, tg.X - _e.x);
        var sweep = [-0.5, -0.17, 0.17, 0.5][_i]*(_e.trCycle % 2 ? 1 : -1);
        for(var s=-1; s<=1; s+=2){
            var w = this.wingPoint(_e, s, 1 + (_i % 3), 1);
            for(var j=0; j<TR_FEATHER_N; j++){
                var a = base + sweep*s + (j - (TR_FEATHER_N - 1)/2)*0.16;
                var b = { x:w.x, y:w.y, vx:Math.cos(a)*TR_FEATHER_SPEED[0]*danmaku(), vy:Math.sin(a)*TR_FEATHER_SPEED[0]*danmaku(),
                          r:SHOT_KINDS.tFeather.r, kind:"tFeather", grazed:false, max:TR_FEATHER_SPEED[1]*Math.min(1.3, danmaku()) };
                enemyShots.push(b);
            }
        }
        sound.play("bossShot");
    },
    halo:function(_e,_shift){
        if(mainScreen.state != "play" || _e.trMode) return;
        var tg = nearestPlayer(_e.x, _e.y), a0 = Math.atan2(tg.Y - _e.y, tg.X - _e.x) + _shift;
        var sp = TR_HALO_SPEED*Math.min(1.3, danmaku());
        for(var i=0; i<TR_HALO_N; i++){
            var a = a0 + (i - TR_HALO_N/2 + 0.5)*Math.PI*2/TR_HALO_N;
            if(Math.abs(i - TR_HALO_N/2 + 0.5) < TR_HALO_GAP/2) continue;     //狙いの向きにすき間
            fireShot(_e.x, _e.y, a, sp, "tOrb");
        }
        fx.ring(_e.x, _e.y, 80*_e.trScale, TR_FIRE, 12, 3);
        sound.play("bossShot");
    },
    pillar:function(_v,_c,_hitBeat){
        var lim = _v ? CW : CH;
        this.pillars.push({ dir:_v ? "v" : "h", c:Math.max(20, Math.min(lim - 20, _c)), warn:this.pos(), hit:this.beatTime(_hitBeat), done:false });
    },
    pillarStep:function(_p){
        var M = mainScreen;
        for(var i=this.pillars.length-1; i>=0; i--){
            var P = this.pillars[i];
            if(_p >= P.hit && !P.done){
                P.done = true;
                fx.shake(3);
                if(P.dir == "v") battleBg.ripple(P.c, CH*0.7, 14, 7, 40, TR_GLOW);
                else battleBg.ripple(CW/2, P.c, 14, 7, 40, TR_GLOW);
                sound.play("zap");
            }
            if(_p >= P.hit && _p < P.hit + TR_PILLAR_HIT && M.state == "play"){
                var d = P.dir == "v" ? Math.abs(drone.X - P.c) : Math.abs(drone.Y - P.c);
                if(d < TR_PILLAR_W/2 + HIT_CORE*0.5 && M.canBeHit()) M.damage();
            }
            if(_p >= P.hit + 0.5 || _p < P.warn - 1) this.pillars.splice(i,1);
        }
    },

    //------------------------------------------------------------ 弾の動き・絵(shotLab.step・draw から)
    shotStep:function(b){
        switch(b.kind){
            case "tFeather":
                //速くなっていく
                var sp = Math.hypot(b.vx,b.vy);
                if(sp < b.max){ b.vx *= 1.025; b.vy *= 1.025; }
                return false;
            case "tLance":
                var p = this.pos();
                if(b.ph == "fly"){
                    //翼からドローン君のまわりへ(当たらない)
                    var k = Math.max(0, Math.min(1, (p - b.t0)/(b.t1 - b.t0))), q = 1 - Math.pow(1 - k, 3);
                    b.x = b.sx + (b.hx - b.sx)*q; b.y = b.sy + (b.hy - b.sy)*q;
                    b.vx = 0; b.vy = 0;
                    if(k >= 1){ b.ph = "hold"; b.behind = false; }
                    return false;
                }
                if(b.ph == "hold"){
                    b.x = b.hx; b.y = b.hy; b.vx = 0; b.vy = 0;
                    if(p < b.t2){ var tg = nearestPlayer(b.x, b.y); b.ax = tg.X; b.ay = tg.Y; }
                    if(p >= b.t3){
                        var a = Math.atan2(b.ay - b.y, b.ax - b.x);
                        b.vx = Math.cos(a)*TR_LANCE_SPEED; b.vy = Math.sin(a)*TR_LANCE_SPEED;
                        b.ph = "go";
                        if(!this.lanceSe || this.lanceSe != b.t3){ this.lanceSe = b.t3; sound.play("dash"); }
                    }
                    //止まっている間は位置を進めない(このあと vx だけ足される)
                    return false;
                }
                return false;
        }
        return null;
    },
    shotDraw:function(b){
        var r = b.r || 5, ang = Math.atan2(b.vy,b.vx);
        //今までの攻撃の弾も、第二形態の間は同じ光の玉の色にそろえる(大きさはそのまま)
        if((b.kind == "normal" || b.kind == "small" || b.kind == "big") && this.live()){
            ctx.fillStyle = b.kind == "big" ? "#b0309a" : (b.kind == "small" ? "#9a4ae0" : "#7a2cc4");
            ctx.beginPath(); ctx.arc(b.x,b.y,r + 1,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(255,230,255,0.9)"; ctx.lineWidth = 1.2;
            ctx.stroke(); ctx.lineWidth = 1;
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(b.x,b.y,r*0.5,0,Math.PI*2); ctx.fill();
            return true;
        }
        switch(b.kind){
            case "tOrb":
            case "tMote":
                ctx.fillStyle = b.kind == "tMote" ? "#b58ae6" : "#7a2cc4";
                ctx.beginPath(); ctx.arc(b.x,b.y,r + 1,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle = "rgba(255,230,255,0.9)"; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.arc(b.x,b.y,r + 1,0,Math.PI*2); ctx.stroke();
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(b.x,b.y,r*0.5,0,Math.PI*2); ctx.fill();
                ctx.lineWidth = 1;
                return true;
            case "tFeather":
                //細い刃(進む向きに長い。白い背骨)
                ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(ang);
                ctx.fillStyle = "#5a1c94";
                ctx.beginPath(); ctx.moveTo(11,0); ctx.lineTo(0,-r - 0.5); ctx.lineTo(-12,0); ctx.lineTo(0,r + 0.5); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-9,0); ctx.stroke();
                ctx.restore(); ctx.lineWidth = 1;
                return true;
            case "tLance":
                //光の槍：止まっている間は狙う先へ向き、狙いの線を引く(飛ぶ直前ほど濃い)
                var p = this.pos();
                var a = b.ph == "go" ? ang : Math.atan2(b.ay - b.y, b.ax - b.x);
                if(b.ph == "hold"){
                    var k = Math.max(0, Math.min(1, (p - b.t1)/(b.t3 - b.t1)));
                    ctx.strokeStyle = p >= b.t2 ? "rgba(255,90,140," + (0.25 + 0.5*k) + ")" : "rgba(200,140,255," + (0.15 + 0.2*k) + ")";
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([6,5]);
                    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(b.x + Math.cos(a)*TR_LANCE_R*1.1, b.y + Math.sin(a)*TR_LANCE_R*1.1); ctx.stroke();
                    ctx.setLineDash([]);
                }
                ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(a);
                if(b.ph == "fly") ctx.globalAlpha = 0.6;
                ctx.fillStyle = "#3a1258";
                ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(4,-5); ctx.lineTo(-16,-2.5); ctx.lineTo(-16,2.5); ctx.lineTo(4,5); ctx.closePath(); ctx.fill();
                ctx.fillStyle = "#c48af5";
                ctx.beginPath(); ctx.moveTo(15,0); ctx.lineTo(4,-3); ctx.lineTo(-13,-1); ctx.lineTo(-13,1); ctx.lineTo(4,3); ctx.closePath(); ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.fillRect(-2,-1,15,2);
                ctx.restore();
                return true;
        }
        return false;
    },

    //------------------------------------------------------------ 改の絵
    //翼の形(改の中心からの位置。大きさは掛けていない)。f：羽根 { s:左右, gi:番号, x, y:つけ根, a:向き, len, w, grow:伸び(0～1) }
    //bone：骨 { s, w, pts:[つけ根, ひじ, 先] }。拍で持ち上がって羽根が開き(trFlap)、息つぎでたたむ(trFold)
    wingGeom:function(_e){
        var flap = _e.trFlap || 0, fold = _e.trFold || 0, t = _e.t || 0;
        var vis = this.rebuildN(_e), lost = {};
        for(var i=0; i<(_e.trLost || 0); i++) lost[TR_WING_LOSE[i]] = true;
        var out = { f:[], bone:[], cov:[] };
        for(var s=-1; s<=1; s+=2){
            var gi = 0;
            for(var w=0; w<TR_WINGS.length; w++){
                var W = TR_WINGS[w];
                //骨をつけ根のまわりに回す(右の翼でマイナスが持ち上がる向き)
                var glide = _e.trGlide || 0, brake = _e.trBrake || 0, flex = (_e.trFlex || 0)*(1 - fold)*(w == 0 ? 0.6 : 1);
                var rot = (-0.28*flap + 0.95*fold + Math.sin(t*0.045 + w)*0.05)*(w == 0 ? 0.6 : 1) + (-TR_GLIDE_ROT*glide + TR_BRAKE_ROT*brake)*(1 - fold) + flex, sc = 1 - 0.25*fold;
                var c = Math.cos(rot), n = Math.sin(rot);
                var turn = function(_p){
                    var dx = (_p[0] - W.root[0])*sc, dy = (_p[1] - W.root[1])*sc;
                    return [W.root[0] + dx*c - dy*n, W.root[1] + dx*n + dy*c];
                };
                var r = W.root, e2 = turn(W.elbow), tp = turn(W.tip);
                //ひじから先はさらにしなる(風を受けて先ほど曲がる)
                var fb = flex*(TR_FLEX_TIP - 1), fc = Math.cos(fb), fn = Math.sin(fb), tx = tp[0] - e2[0], ty = tp[1] - e2[1];
                tp = [e2[0] + tx*fc - ty*fn, e2[1] + tx*fn + ty*fc];
                out.bone.push({ s:s, w:w, pts:[[s*r[0], r[1]], [s*e2[0], e2[1]], [s*tp[0], tp[1]]] });
                //骨の上の位置(つけ根 0 → 先 1。ひじで折れる線をなめらかに)
                var on = function(_u){
                    var q = 1 - _u;
                    return [q*q*r[0] + 2*q*_u*e2[0] + _u*_u*tp[0], q*q*r[1] + 2*q*_u*e2[1] + _u*_u*tp[1]];
                };
                var first = out.f.length;
                for(var j=0; j<W.n; j++, gi++){
                    if(lost[gi] || gi >= vis) continue;
                    var u = W.n == 1 ? 1 : j/(W.n - 1);
                    var P = on(0.08 + u*0.92);
                    //滑空では羽根を骨へ寄せて細く、ブレーキでは扇に開く
                    var a = W.a[0] + (W.a[1] - W.a[0])*u + rot + (u - 0.5)*0.35*flap + Math.sin(t*0.07 + gi*0.8)*0.025 - 0.18*glide*(1 - u) + 0.25*brake*(u - 0.5);
                    var len = (W.len[0] + (W.len[1] - W.len[0])*u)*(1 + 0.06*flap)*sc;
                    out.f.splice(first, 0, { s:s, gi:gi, x:s*P[0], y:P[1], a:s < 0 ? Math.PI - a : a, len:len, w:W.w, grow:Math.min(1, vis - gi) });  //先の羽根ほど奥
                }
                //雨覆い：骨に沿った短い羽根(骨が見えてから)
                var cv = Math.min(1, vis/2);
                for(var j=0; j<W.cov.n && cv > 0; j++){
                    var u = (j + 0.5)/W.cov.n, P = on(u);
                    var a = W.a[0] + (W.a[1] - W.a[0])*u + rot - 0.25;
                    out.cov.push({ s:s, x:s*P[0], y:P[1], a:s < 0 ? Math.PI - a : a, len:W.cov.len*(1 - 0.3*u)*sc, w:W.cov.w, grow:cv });
                }
            }
        }
        this.turnWings(out, _e.trTurn || 0);
        return out;
    },
    //翼を縦の軸のまわりに _th(ラジアン。正で進む向きが右)だけ回し、遠近をつける。右へ回ると右の翼が奥へ(短く小さく)、左の翼が手前へ
    turnWings:function(_G,_th){
        if(Math.abs(_th) < 0.002) return;
        var c = Math.cos(_th), n = Math.sin(_th);
        var proj = function(_x,_y){ var f = TR_TURN_DEPTH/(TR_TURN_DEPTH + _x*n); return [_x*c*f, _y*f, f]; };
        var feather = function(_f){
            var b = proj(_f.x, _f.y), t = proj(_f.x + Math.cos(_f.a)*_f.len, _f.y + Math.sin(_f.a)*_f.len);
            _f.x = b[0]; _f.y = b[1];
            _f.a = Math.atan2(t[1] - b[1], t[0] - b[0]);
            _f.len = Math.hypot(t[0] - b[0], t[1] - b[1]);
            _f.w *= b[2];
        };
        for(var i=0; i<_G.f.length; i++) feather(_G.f[i]);
        for(var i=0; i<_G.cov.length; i++) feather(_G.cov[i]);
        for(var i=0; i<_G.bone.length; i++){
            var B = _G.bone[i].pts;
            for(var j=0; j<B.length; j++){ var q = proj(B[j][0], B[j][1]); B[j] = [q[0], q[1]]; }
        }
    },
    //改の中心からの位置(大きさを掛ける前)を、画面の位置へ
    toWorld:function(_e,_x,_y){
        var sc = _e.trScale || 1;
        return { x:_e.x + _x*sc, y:_e.y + _y*sc };
    },
    //大きな翼の羽根 _i の先(または途中 _k)の、画面の上の位置(_s：-1 左・1 右。弾を撃ち出す所)
    wingPoint:function(_e,_s,_i,_k){
        var G = this.wingGeom(_e), n = TR_WINGS[1].n, want = TR_WINGS[0].n + (_i % n), best = null;
        for(var i=0; i<G.f.length; i++){
            var f = G.f[i];
            if(f.s != _s) continue;
            if(f.gi == want){ best = f; break; }
            if(!best || Math.abs(f.gi - want) < Math.abs(best.gi - want)) best = f;
        }
        if(!best) return { x:_e.x, y:_e.y };
        var L = best.len*(_k == null ? 1 : _k);
        return this.toWorld(_e, best.x + Math.cos(best.a)*L, best.y + Math.sin(best.a)*L);
    },
    //改の絵：翼・光の冠を足し、大きさ(奥行き・サビ)を掛ける。奥にいる間はここでは描かず、drawFront で暗闇の上に描く
    draw:function(_e,_body,_orig){
        if(_e.mode == "revive") return this.drawRebuild(_e, _body, _orig);
        var deep = _e.trMode == "sink" || _e.trMode == "hush" || (_e.trMode == "last");
        if(deep && !this.drawing) return true;
        var s = deep ? _e.trDraw : (_e.form == 2 ? (_e.trScale || 1) : 1);
        var pulse = Math.max(_e.trPulse || 0, _e.trFlap || 0);
        //光のにじみ(夜の色の上であふれるように)
        var R = Math.max(110*s, 50)*(1 + 0.15*pulse);
        var g = ctx.createRadialGradient(0,0,R*0.15,0,0,R);
        g.addColorStop(0, "rgba(" + TR_GLOW + "," + (0.3 + 0.3*pulse) + ")");
        g.addColorStop(1, "rgba(" + TR_GLOW + ",0)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.save();
        if(!deep && _e.form == 2){
            var kick = _e.trKick || 0, soar = Math.sin((_e.t || 0)*TR_SOAR[1])*TR_SOAR[0];
            ctx.translate(-Math.cos(_e.trKickA || 0)*kick*TR_KICK[1], -Math.sin(_e.trKickA || 0)*kick*TR_KICK[1] + (soar + (_e.trDip || 0) + (_e.trLift || 0))*s);
        }
        if(_e.form == 2) ctx.rotate(_e.trRoll || 0);
        ctx.scale(s,s);
        this.drawWings(_e, _body);
        ctx.save();
        ctx.scale(Math.cos(_e.trTurn || 0), 1);     //冠(光の輪)も回った分だけ細く見せる
        this.drawCrown(_e, _body, pulse);
        ctx.restore();
        _orig();
        ctx.restore();
        return true;
    },
    //戦闘中の姿勢(bosses.js の改の動きのあとで。special.kai から)：滑空・ブレーキ・傾き・沈み・にらむ向き・のけぞりの戻り
    pose:function(_e){
        var vx = _e.vx || 0, vy = _e.vy || 0, sp = Math.hypot(vx, vy);
        var ax = vx - (_e.trPvx || 0), ay = vy - (_e.trPvy || 0);
        _e.trPvx = vx; _e.trPvy = vy;
        _e.trAx = (_e.trAx || 0) + (ax - (_e.trAx || 0))*0.2;
        _e.trAy = (_e.trAy || 0) + (ay - (_e.trAy || 0))*0.2;
        //滑空：速いほど翼を後ろへ。ブレーキ：進む向きと逆へ加速している(減速している)ほど翼を前へ
        _e.trGlide = (_e.trGlide || 0) + (Math.min(1, sp/TR_GLIDE_SPEED) - (_e.trGlide || 0))*0.08;
        var decel = sp > 0.2 ? -(_e.trAx*vx + _e.trAy*vy)/sp : 0;
        _e.trBrake = (_e.trBrake || 0) + (Math.max(0, Math.min(1, decel*TR_BRAKE_K)) - (_e.trBrake || 0))*0.15;
        //傾き：ばねで行きすぎて戻る
        var roll = Math.max(-TR_ROLL[2], Math.min(TR_ROLL[2], vx*TR_ROLL[0] + _e.trAx*TR_ROLL[1]*10));
        _e.trRollV = ((_e.trRollV || 0) + (roll - (_e.trRoll || 0))*TR_ROLL_SPRING[0])*TR_ROLL_SPRING[1];
        _e.trRoll = (_e.trRoll || 0) + _e.trRollV;
        //縦の加速で体が遅れる
        var dip0 = _e.trDip || 0;
        _e.trDip = dip0 + (-_e.trAy*TR_DIP*10 - dip0)*0.1;
        //速さと高さのやりとり：速く滑るほど沈み、止まると浮き上がる(ばねで少し行きすぎる)
        var sw = Math.min(TR_SWOOP[1], sp*TR_SWOOP[0]);
        _e.trLiftV = ((_e.trLiftV || 0) + (sw - (_e.trLift || 0))*TR_SWOOP_SPRING[0])*TR_SWOOP_SPRING[1];
        _e.trLift = (_e.trLift || 0) + _e.trLiftV;
        //翼のしなり：見た目の縦の速さ(動き・沈み浮き・うねり・遅れ)で、下がるときは先が持ち上がり(マイナス)、上がるときは垂れる
        var t = _e.t || 0, vyApp = vy + _e.trLiftV + (_e.trDip - dip0) + TR_SOAR[0]*TR_SOAR[1]*Math.cos(t*TR_SOAR[1]);
        var flex = Math.max(-TR_FLEX[1], Math.min(TR_FLEX[1], -vyApp*TR_FLEX[0]));
        _e.trFlexV = ((_e.trFlexV || 0) + (flex - (_e.trFlex || 0))*TR_FLEX_SPRING[0])*TR_FLEX_SPRING[1];
        _e.trFlex = (_e.trFlex || 0) + _e.trFlexV;
        //左右に動くとき、進む向きへ体を回す(ばねで少し行きすぎる)
        var turn = Math.max(-TR_TURN[1], Math.min(TR_TURN[1], vx*TR_TURN[0]));
        _e.trTurnV = ((_e.trTurnV || 0) + (turn - (_e.trTurn || 0))*TR_TURN_SPRING[0])*TR_TURN_SPRING[1];
        _e.trTurn = (_e.trTurn || 0) + _e.trTurnV;
        if(_e.trKick > 0) _e.trKick = Math.max(0, _e.trKick - 0.08);
        //顔：ドローン君をにらむ(横の向きと、見上げ・見下ろし)。bosses.js が動く向きへ向けたのを上書きする
        var tg = nearestPlayer(_e.x, _e.y), dx = tg.X - _e.x, dy = tg.Y - _e.y, L = _e.look;
        var ty = -Math.max(-1, Math.min(1, dx/260))*TR_GAZE[0]*(1 - TR_TURN_BODY) - _e.trTurn*180/Math.PI*TR_TURN_BODY, te = Math.max(-TR_GAZE[1], Math.min(TR_GAZE[1], dy/260));
        L.yaw += (ty - L.yaw)*0.12; L.yawV = 0;
        L.elev += (te - L.elev)*0.12; L.elevV = 0;
    },
    //反動でのけぞる(_a：撃った向き)
    kick:function(_e,_a,_k){
        _e.trKick = Math.max(_e.trKick || 0, _k);
        _e.trKickA = _a;
    },
    //翼：骨から垂れる羽根(外側は濃い紫、内側に明るい筋、白い背骨)。最高潮の頭で弾き返されてからは内側が白く燃える
    drawWings:function(_e,_body){
        var G = this.wingGeom(_e), fire = _e.trFire || 0, flap = _e.trFlap || 0;
        var inner = _body || (fire > 0 ? TR_WING_COL[3] : TR_WING_COL[2]);
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        //羽根(下の小さな翼が先：奥)
        for(var i=0; i<G.f.length; i++){
            var f = G.f[i], L = f.len*f.grow, w = f.w*(0.6 + 0.4*f.grow);
            if(L < 2) continue;
            ctx.save();
            ctx.translate(f.x, f.y);
            ctx.rotate(f.a);
            ctx.beginPath();
            ctx.moveTo(0,0); ctx.quadraticCurveTo(L*0.35,-w, L,0); ctx.quadraticCurveTo(L*0.4,w*0.85, 0,0);
            ctx.fillStyle = _body || TR_WING_COL[1]; ctx.fill();
            ctx.strokeStyle = TR_WING_COL[0]; ctx.lineWidth = 1.8; ctx.stroke();
            //内側の明るい筋
            ctx.beginPath();
            ctx.moveTo(L*0.12,-w*0.15); ctx.quadraticCurveTo(L*0.4,-w*0.7, L*0.9,-w*0.05); ctx.quadraticCurveTo(L*0.45,-w*0.05, L*0.12,-w*0.15);
            ctx.fillStyle = inner; ctx.fill();
            //背骨
            ctx.strokeStyle = "rgba(255,245,255,0.75)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(L*0.1,0); ctx.lineTo(L*0.86,0); ctx.stroke();
            //光(拍で強まる。火がついたあとは白く)
            var g = (0.12 + 0.25*flap + 0.3*fire)*f.grow;
            if(g > 0.02){
                ctx.globalCompositeOperation = "lighter";
                ctx.strokeStyle = "rgba(" + (fire > 0 ? TR_FIRE : TR_GLOW) + "," + g + ")"; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(L*0.2,0); ctx.lineTo(L*0.95,0); ctx.stroke();
                ctx.globalCompositeOperation = "source-over";
            }
            ctx.restore();
        }
        //雨覆い(骨のそばの短い羽根。明るめの紫)
        for(var i=0; i<G.cov.length; i++){
            var c = G.cov[i], L = c.len*c.grow, w = c.w;
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.a);
            ctx.beginPath();
            ctx.moveTo(-2,0); ctx.quadraticCurveTo(L*0.3,-w, L,0); ctx.quadraticCurveTo(L*0.35,w*0.9, -2,0);
            ctx.fillStyle = _body || "#6a2fb4"; ctx.fill();
            ctx.strokeStyle = TR_WING_COL[0]; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.strokeStyle = "rgba(230,200,255,0.7)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(L*0.15,-w*0.45); ctx.quadraticCurveTo(L*0.45,-w*0.55, L*0.8,-w*0.1); ctx.stroke();
            ctx.restore();
        }
        //骨(濃いふちに、上側だけ明るい線。関節は光る)
        var shown = _e.form == 2 ? 1 : Math.min(1, this.rebuildN(_e)*2);
        if(shown > 0){
            ctx.globalAlpha = shown;
            for(var i=0; i<G.bone.length; i++){
                var B = G.bone[i].pts, thick = G.bone[i].w == 1 ? 5 : 3.5;
                ctx.beginPath(); ctx.moveTo(B[0][0],B[0][1]); ctx.quadraticCurveTo(B[1][0],B[1][1], B[2][0],B[2][1]);
                ctx.strokeStyle = TR_WING_COL[0]; ctx.lineWidth = thick + 2; ctx.stroke();
                ctx.strokeStyle = _body || "#6c34b0"; ctx.lineWidth = thick; ctx.stroke();
                ctx.strokeStyle = "rgba(240,215,255,0.85)"; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(B[0][0],B[0][1] - thick*0.3); ctx.quadraticCurveTo(B[1][0],B[1][1] - thick*0.35, B[2][0],B[2][1] - thick*0.3); ctx.stroke();
                ctx.globalCompositeOperation = "lighter";
                ctx.fillStyle = "rgba(" + TR_GLOW + "," + (0.35 + 0.4*flap) + ")";
                ctx.beginPath(); ctx.arc(B[1][0], B[1][1], 3 + 2*flap, 0, Math.PI*2); ctx.arc(B[2][0], B[2][1], 2.5 + 2*flap, 0, Math.PI*2); ctx.fill();
                ctx.globalCompositeOperation = "source-over";
            }
            ctx.globalAlpha = 1;
        }
        ctx.lineWidth = 1; ctx.lineCap = "butt";
    },
    //光の冠：頭の後ろの輪。拍で明るくなり、目盛りが回る
    drawCrown:function(_e,_body,_pulse){
        if(this.rebuildN(_e) < TR_WING_N) return;
        var cy = -46, rx = 30, ry = 8, t = _e.t;
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(" + TR_FIRE + "," + (0.45 + 0.4*_pulse) + ")"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = "rgba(" + TR_GLOW + "," + (0.25 + 0.3*_pulse) + ")"; ctx.lineWidth = 7;
        ctx.stroke();
        //目盛り(輪に沿って回る。手前の半分だけ明るく)
        for(var i=0; i<10; i++){
            var a = t*0.03 + i*Math.PI*2/10, x = Math.cos(a)*rx, y = cy + Math.sin(a)*ry, front = Math.sin(a) > 0;
            ctx.fillStyle = "rgba(255,240,255," + (front ? 0.9 : 0.3) + ")";
            ctx.fillRect(x - 1, y - 4, 2, 8);
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = 1;
    },
    //羽根が舞い散る(_gold：とどめのときは金色も混ぜる)
    feathersBurst:function(_e,_n,_gold){
        for(var i=0; i<_n; i++){
            var s = i % 2 ? 1 : -1, w = this.wingPoint(_e, s, i, Math.random());
            var a = Math.random()*Math.PI*2, v = 2 + Math.random()*(_gold ? 9 : 5);
            this.shards.push({ x:w.x, y:w.y, vx:Math.cos(a)*v + s*2, vy:Math.sin(a)*v - 2, rot:Math.random()*6, vr:(Math.random() - 0.5)*0.3,
                               len:10 + Math.random()*16, c:_gold && i % 3 == 0 ? TR_SUN : (i % 2 ? TR_FIRE : TR_GLOW), feather:true,
                               life:60 + Math.random()*60, t:0 });
        }
    },
    shardsAt:function(_x,_y,_n,_feather){
        for(var i=0; i<_n; i++){
            var a = Math.random()*Math.PI*2, v = 2 + Math.random()*8;
            this.shards.push({ x:_x, y:_y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, rot:a, vr:(Math.random() - 0.5)*0.3,
                               len:_feather ? 10 + Math.random()*10 : 4 + Math.random()*10, c:i % 3 ? TR_GLOW : TR_FIRE, feather:_feather,
                               life:30 + Math.random()*40, t:0 });
        }
    },

    //------------------------------------------------------------ 画面
    //弾の下(敵の上)：火の粉・弾のにじみ・光の柱・ドローン君の灯り
    drawUnder:function(){
        if(!this.live()) return;
        var k = battleBg.night/TR_NIGHT;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        if(!this.embers){
            this.embers = [];
            for(var i=0; i<TR_EMBERS; i++) this.embers.push(this.ember(Math.random()*CH));
        }
        var dawn = this.dawnK;
        for(var i=0; i<this.embers.length; i++){
            var m = this.embers[i];
            m.y -= m.v; m.x += Math.sin(m.y*0.02 + m.ph)*0.4;
            if(m.y < -10) this.embers[i] = m = this.ember(CH + 10);
            var a = Math.max(k, dawn)*m.a*Math.min(1, Math.max(0, m.y)/120);
            ctx.fillStyle = "rgba(" + (dawn > 0.5 && m.c == TR_GLOW ? TR_SUN : m.c) + "," + a + ")";
            ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI*2); ctx.fill();
        }
        //弾のにじみ(絵を1枚作っておいて貼る)
        var h = finaleSync.haloImg();
        ctx.globalAlpha = 0.7*Math.max(0.5, k);
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.behind && b.kind != "tLance") continue;
            var R = (b.r || 5)*TR_HALO_K;
            ctx.drawImage(h, b.x - R, b.y - R, R*2, R*2);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        this.drawPillars();
        //ドローン君の灯り(夜でも見失わないように)
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var col = dawn > 0 ? TR_HERO : "150,200,255";
        var g = ctx.createRadialGradient(drone.X, drone.Y, 4, drone.X, drone.Y, 46 + 30*dawn);
        g.addColorStop(0, "rgba(" + col + "," + (0.35*Math.max(k, dawn)) + ")");
        g.addColorStop(1, "rgba(" + col + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(drone.X, drone.Y, 76, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    },
    ember:function(_y){
        return { x:Math.random()*CW, y:_y, v:0.3 + Math.random()*0.9, r:0.8 + Math.random()*1.8, ph:Math.random()*6,
                 a:0.3 + Math.random()*0.5, c:Math.random() < 0.6 ? "255,140,70" : TR_GLOW };
    },
    //光の柱：予告は細い線と薄い帯(落ちる拍が近いほど濃く、縁が内へ寄る)、落ちた瞬間は白い光の柱
    drawPillars:function(){
        var p = this.pos();
        for(var i=0; i<this.pillars.length; i++){
            var P = this.pillars[i], v = P.dir == "v", W = TR_PILLAR_W;
            var x = v ? P.c - W/2 : 0, y = v ? 0 : P.c - W/2, w = v ? W : CW, h = v ? CH : W;
            if(p < P.hit){
                var k = Math.max(0, Math.min(1, (p - P.warn)/(P.hit - P.warn)));
                var inset = (1 - k)*W*0.5;
                ctx.fillStyle = "rgba(" + TR_GLOW + "," + (0.06 + 0.16*k) + ")";
                ctx.fillRect(x, y, w, h);
                ctx.strokeStyle = "rgba(220,160,255," + (0.35 + 0.5*k) + ")";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([10,6]);
                ctx.lineDashOffset = -p*60;
                ctx.beginPath();
                if(v){ ctx.moveTo(x + inset, 0); ctx.lineTo(x + inset, CH); ctx.moveTo(x + w - inset, 0); ctx.lineTo(x + w - inset, CH); }
                else{ ctx.moveTo(0, y + inset); ctx.lineTo(CW, y + inset); ctx.moveTo(0, y + h - inset); ctx.lineTo(CW, y + h - inset); }
                ctx.stroke();
                ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineWidth = 1;
            }else{
                var u = (p - P.hit)/0.5, a = Math.max(0, 1 - u);
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                var sp = W*(0.7 + 0.6*Math.min(1, u*4));
                var gx = v ? ctx.createLinearGradient(P.c - sp, 0, P.c + sp, 0) : ctx.createLinearGradient(0, P.c - sp, 0, P.c + sp);
                gx.addColorStop(0, "rgba(" + TR_GLOW + ",0)");
                gx.addColorStop(0.5, "rgba(" + TR_FIRE + "," + (0.9*a) + ")");
                gx.addColorStop(1, "rgba(" + TR_GLOW + ",0)");
                ctx.fillStyle = gx;
                if(v) ctx.fillRect(P.c - sp, 0, sp*2, CH); else ctx.fillRect(0, P.c - sp, CW, sp*2);
                ctx.fillStyle = "rgba(255,255,255," + a + ")";
                if(v) ctx.fillRect(P.c - 4, 0, 8, CH); else ctx.fillRect(0, P.c - 4, CW, 8);
                ctx.restore();
            }
        }
    },
    //いちばん手前：沈む・迫るの暗闇と、奥にいる改・着く所の印。散る羽根。とどめの光。最後の突進の言葉
    drawFront:function(){
        var e = this.boss();
        if(e && e.mode == "revive"){ this.drawProtocol(e); return; }
        if(e && e.form == 2 && (e.trMode == "sink" || e.trMode == "hush" || e.trMode == "last")){
            var p = this.pos(), approaching = e.trMode == "hush" || (e.trMode == "last" && p >= this.barTime(this.sec("last").bar + 1));
            if(approaching){
                //時が止まったように周りの色が抜ける(改だけ色が残る)
                var u = Math.min(1, (e.trK || 0)*4);
                ctx.globalCompositeOperation = "saturation";
                ctx.fillStyle = "rgba(128,128,128," + (TR_DRAIN*u*(1 - 0.5*this.dawnK)) + ")";
                ctx.fillRect(-20,-20,CW + 40,CH + 40);
                ctx.globalCompositeOperation = "source-over";
            }
            ctx.fillStyle = "rgba(6,3,12," + ((e.trDark || 0)*(1 - 0.4*this.dawnK)) + ")";
            ctx.fillRect(-20,-20,CW + 40,CH + 40);
            if(approaching){
                var left = (e.trHit || 0) - p, span = e.trMode == "hush" ? e.trHit - this.sec("hush").from : e.trHit - this.barTime(this.sec("last").bar + 1);
                var col = left <= TR_JUST_SEC ? JUST_COLOR : (e.trLocked ? "220,40,40" : "255,255,255");
                var tellSec = this.beatTime(this.beatAt(e.trHit)) - this.beatTime(this.beatAt(e.trHit) - TR_TELL_BEATS);
                var k = e.trLocked ? Math.max(0, Math.min(1, 1 - left/tellSec)) : 0;
                ctx.strokeStyle = "rgba(" + col + "," + (0.4 + 0.5*k) + ")";
                ctx.lineWidth = 2 + 2*k;
                ctx.beginPath(); ctx.arc(e.trTx, e.trTy, TR_RAM_R, 0, Math.PI*2); ctx.stroke();
                if(e.trLocked){
                    this.drawReticle(e, p, col);
                }
                ctx.lineWidth = 1;
            }
            if(approaching){
                var mo = e.trMorph == null ? 1 : e.trMorph;
                if(mo < 1){
                    //飛び去った姿が光に溶けていく
                    ctx.globalAlpha = 1 - mo;
                    this.drawing = true;
                    mainScreen.drawEnemy(e);
                    this.drawing = false;
                    ctx.globalAlpha = 1;
                }
                this.drawCharge(e, p, mo);
                if(e.trLocked) this.drawTiming(e, p);
            }else{
                this.drawing = true;
                mainScreen.drawEnemy(e);
                this.drawing = false;
            }
            if(e.trMode == "last") this.drawLastWord(e, p);
        }
        this.drawShards();
        this.drawImpact();
        if(this.dawnFlash > 0){
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = "rgba(" + TR_SUN + "," + (TR_FLASH*this.dawnFlash) + ")";
            ctx.fillRect(-20,-20,CW + 40,CH + 40);
            ctx.restore();
        }
    },
    //着く所の照準：4つのかぎ括弧が、拍ごとにカチッと45度回りながら一段ずつ締まり、着く瞬間に輪へ重なる
    drawReticle:function(_e,_p,_col){
        var hb = this.beatAt(_e.trHit), lb = hb - TR_TELL_BEATS, bf = this.beatAt(_p) - lb;    //狙いが止まってからの拍(小数)
        var step = Math.max(0, Math.min(TR_TELL_BEATS, Math.floor(bf))), since = this.beatTime(lb + step), snap = Math.min(1, (_p - since)/TR_SNAP_SEC);
        var e1 = 1 - Math.pow(1 - snap, 3), st = Math.max(0, step - 1) + e1;     //なめらかに次の段へ
        var R = TR_RAM_R + TR_RETICLE*(1 - st/TR_TELL_BEATS), ang = st*Math.PI/4;
        ctx.save();
        ctx.translate(_e.trTx, _e.trTy); ctx.rotate(ang);
        ctx.strokeStyle = "rgba(" + _col + "," + (0.3 + 0.25*st/TR_TELL_BEATS) + ")";
        ctx.lineWidth = 1.5 + 1*(1 - snap); ctx.lineCap = "square";
        for(var i=0; i<4; i++){
            ctx.rotate(Math.PI/2);
            var L = 10 + R*0.18;
            ctx.beginPath(); ctx.moveTo(R - L, -R); ctx.lineTo(R, -R); ctx.lineTo(R, -R + L); ctx.stroke();
        }
        //拍で締まった瞬間の光
        if(snap < 1 && step > 0){
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = "rgba(" + _col + "," + (0.6*(1 - snap)) + ")"; ctx.lineWidth = 6*(1 - snap);
            ctx.beginPath(); ctx.arc(0, 0, R*1.15, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
    },
    //迫るタイミングの合図(いちばん手前)：狙いが止まった瞬間から、太い輪が一定の速さで縮み、着く TR_RING_LEAD 秒前に着く所の輪へ重なる(拍ごとに光る)。
    //ジャスト衝撃波を出してよい間(TR_JUST_SEC)は、着く所の輪が水色に光る
    drawTiming:function(_e,_p){
        var hb = Math.round(this.beatAt(_e.trHit)), lt = this.beatTime(hb - TR_TELL_BEATS), left = _e.trHit - _p;
        if(left < -0.03) return;
        var u = Math.max(0, Math.min(1, (_p - lt)/(_e.trHit - TR_RING_LEAD - lt)));
        var bf = this.beatAt(_p), b = Math.floor(bf + 1e-6), since = _p - this.beatTime(b), flash = Math.max(0, 1 - since/0.12);
        var just = left <= TR_JUST_SEC, col = just ? JUST_COLOR : "255,255,255";
        var x = _e.trTx, y = _e.trTy;
        ctx.save();
        //着く所の輪：ジャストの間は塗りつぶして光る
        if(just){
            var jk = 1 - Math.max(0, left)/TR_JUST_SEC;
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = "rgba(" + JUST_COLOR + "," + (0.25 + 0.35*jk) + ")";
            ctx.beginPath(); ctx.arc(x, y, TR_RAM_R, 0, Math.PI*2); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
        }
        ctx.strokeStyle = "rgba(" + col + ",0.95)"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, TR_RAM_R, 0, Math.PI*2); ctx.stroke();
        //縮む輪(太く、黒いふちで背景から浮かせる)
        var R = TR_RAM_R + (TR_RAM_R + TR_RETICLE*1.4 - TR_RAM_R)*(1 - u);
        ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 9 + 4*flash;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.stroke();
        ctx.strokeStyle = "rgba(" + col + "," + (0.85 + 0.15*flash) + ")"; ctx.lineWidth = 5 + 4*flash;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
    },
    //迫る間：奥でためる光(改の姿は見せず、光の中に目だけが光る)。横へ伸びる光の筋と、逆へ回る2重の紋様の輪。
    //狙いが止まると奥から着く所へ照準線が引かれ、予兆の光の脈はその線を走る。最後のタメで照準線は細くなって消え、輪は光へ吸い込まれる。
    //着く瞬間は奥から着く所へ光の筋が走る
    drawCharge:function(_e,_p,_a){
        var A = _a == null ? 1 : _a;
        var k = _e.trCharge || 0, left = (_e.trHit || 0) - _p, x = _e.x, y = _e.y;
        var beat = this.beatTime(this.beatAt(_e.trHit)) - this.beatTime(this.beatAt(_e.trHit) - 1);
        var hold = _e.trHold ? Math.max(0, Math.min(1, 1 - left/(beat*TR_HOLD_BEATS))) : 0;
        //最後のタメ：画面のふちが暗く沈む
        if(hold > 0){
            var vg = ctx.createRadialGradient(_e.trTx, _e.trTy, 80, _e.trTx, _e.trTy, CW*0.7);
            vg.addColorStop(0, "rgba(0,0,0,0)");
            vg.addColorStop(1, "rgba(0,0,0," + (0.55*hold) + ")");
            ctx.fillStyle = vg; ctx.fillRect(-20,-20,CW + 40,CH + 40);
        }
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        //照準線(狙いが止まってから。最後のタメで細くなり、着く少し前に消える)
        if(_e.trLocked && left > TR_DASH_SEC*2){
            var la = (0.35 - 0.3*hold)*(0.75 + 0.25*Math.sin(_p*60));
            ctx.strokeStyle = "rgba(255,120,170," + la + ")"; ctx.lineWidth = 1.5*(1 - hold) + 0.4;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(_e.trTx, _e.trTy); ctx.stroke();
        }
        //動き出した：奥の光は消え、一直線の光の線だけ
        var gone = left < TR_DASH_SEC;
        if(gone){ ctx.restore(); this.drawRushIn(_e, _p); return; }
        //ちらつき(ためるほど速く)
        var fl = 0.8 + 0.2*Math.sin(_p*(8 + 40*k));
        ctx.globalAlpha = fl*A;
        //横へ伸びる光の筋(と短い縦の筋)
        var fw = TR_FLARE_W*(0.1 + 0.9*k)*(1 + 0.5*hold);
        var fg = ctx.createLinearGradient(x - fw, y, x + fw, y);
        fg.addColorStop(0, "rgba(" + TR_GLOW + ",0)");
        fg.addColorStop(0.5, "rgba(255,235,255," + (0.5 + 0.4*hold) + ")");
        fg.addColorStop(1, "rgba(" + TR_GLOW + ",0)");
        ctx.fillStyle = fg;
        ctx.fillRect(x - fw, y - 1.5 - hold, fw*2, 3 + 2*hold);
        ctx.fillStyle = "rgba(" + TR_GLOW + "," + (0.15 + 0.15*hold) + ")";
        ctx.fillRect(x - fw*0.6, y - 6, fw*1.2, 12);
        //奥の光(ためるほど大きく、最後のタメで小さく強く凝縮する)
        var R = (6 + 34*k)*(1 - 0.5*hold);
        var g = ctx.createRadialGradient(x, y, 0, x, y, R*3);
        g.addColorStop(0, "rgba(255,255,255," + (0.85 + 0.15*hold) + ")");
        g.addColorStop(0.18, "rgba(" + mixRgb(TR_GLOW, TR_FIRE, k) + "," + (0.55 + 0.3*hold) + ")");
        g.addColorStop(1, "rgba(" + TR_GLOW + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, R*3, 0, Math.PI*2); ctx.fill();
        //紋様の輪(ためるほど増えて(3重まで)速く回る。逆へ回り、目盛りを持つ。最後のタメで光へ吸い込まれる)
        var rings = 1 + Math.floor(k*2.99);
        for(var r=0; r<rings; r++){
            var rr = Math.max(R, 14)*(2.4 + r*1.2)*(1 - 0.85*hold), dir = r % 2 ? -1 : 1, a0 = _p*(0.6 + 3*k + r*0.4)*dir;
            if(rr < 2) continue;
            ctx.strokeStyle = "rgba(" + (r ? TR_GLOW : TR_FIRE) + "," + (0.45 + 0.3*k) + ")"; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.ellipse(x, y, rr, rr*0.55, 0, 0, Math.PI*2); ctx.stroke();
            for(var i=0; i<12; i++){
                var a = a0 + i*Math.PI/6, tx = x + Math.cos(a)*rr, ty = y + Math.sin(a)*rr*0.55;
                ctx.fillStyle = "rgba(255,240,255," + (i % 3 ? 0.4 : 0.9) + ")";
                ctx.fillRect(tx - 1, ty - (i % 3 ? 1 : 2.5), 2, i % 3 ? 2 : 5);
            }
        }
        //光の中の目(姿は見せず、目だけが赤く光る。最後のタメで強く)
        var ex = 6 + 6*k, ea = 0.5 + 0.5*Math.max(hold, _e.trLocked ? 0.5 : 0);
        for(var i=-1; i<=1; i+=2){
            ctx.fillStyle = "rgba(255,60,120," + ea + ")";
            ctx.beginPath(); ctx.ellipse(x + i*ex, y + 1, 3 + 2*hold, 1.6 + hold, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(255,220,235," + ea + ")";
            ctx.fillRect(x + i*ex - 1, y, 2, 2);
        }
        //まわりに走る稲妻(ためるほど多い。毎コマ形が変わる)
        var nArc = Math.floor(k*TR_ARCS + hold*2);
        ctx.lineWidth = 1.2;
        for(var i=0; i<nArc; i++){
            var a = Math.random()*Math.PI*2, r0 = R*0.6, r1 = R*(2 + Math.random()*1.5);
            ctx.strokeStyle = "rgba(" + (i % 2 ? "255,240,255" : TR_FIRE) + ",0.8)";
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a)*r0, y + Math.sin(a)*r0);
            for(var j=1; j<=4; j++){
                var rj = r0 + (r1 - r0)*j/4, aj = a + (Math.random() - 0.5)*0.5;
                ctx.lineTo(x + Math.cos(aj)*rj, y + Math.sin(aj)*rj);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = A;
        //光の十字(凝縮するほど長く鋭い)
        ctx.translate(x, y); ctx.rotate(_p*0.6 + hold*1.2);
        var L = R*(2.2 + 4*hold);
        ctx.fillStyle = "rgba(255,240,255," + (0.45 + 0.5*hold) + ")";
        for(var i=0; i<4; i++){
            ctx.rotate(Math.PI/2);
            ctx.beginPath(); ctx.moveTo(0,-L); ctx.lineTo(R*0.1,0); ctx.lineTo(0,R*0.1); ctx.lineTo(-R*0.1,0); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        //予兆の光の脈：照準線を走り、届くと着く所で輪が光る
        var P = _e.trPulses || [];
        for(var i=0; i<P.length; i++){
            var u = (_p - P[i].t0)/TR_PULSE_SEC;
            if(u < 0) continue;
            if(u < 1){
                var q = u*u, hx = x + (_e.trTx - x)*q, hy = y + (_e.trTy - y)*q, tx = x + (_e.trTx - x)*Math.max(0, q - 0.3), ty = y + (_e.trTy - y)*Math.max(0, q - 0.3);
                ctx.strokeStyle = "rgba(" + TR_FIRE + ",0.85)"; ctx.lineWidth = 3; ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
                ctx.fillStyle = "rgba(255,255,255,0.95)";
                ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI*2); ctx.fill();
            }else if(u < 3){
                var v = (u - 1)/2;
                ctx.strokeStyle = "rgba(" + TR_FIRE + "," + (0.8*(1 - v)) + ")"; ctx.lineWidth = 3*(1 - v) + 1;
                ctx.beginPath(); ctx.arc(_e.trTx, _e.trTy, TR_RAM_R*(0.6 + 0.8*v), 0, Math.PI*2); ctx.stroke();
            }
        }
        ctx.restore();
    },
    //迫ってくる：奥の光は消え、光の塊が速くなりながら(手前に来るほど大きく)着く所へ突っ込み、後ろへ光の尾を引く。
    //画面のふちから着く所へ集まる集中線(揺れ・寄りは approach)
    drawRushIn:function(_e,_p){
        var x = _e.x, y = _e.y, left = (_e.trHit || 0) - _p, u = Math.max(0, Math.min(1, 1 - left/TR_DASH_SEC)), q = u*u;
        var tx = _e.trTx, ty = _e.trTy, hx = x + (tx - x)*q, hy = y + (ty - y)*q;
        var dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1, nx = -dy/d, ny = dx/d;
        var r = 6 + 64*q*q;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        //集中線：画面のふちから着く所へ
        for(var i=0; i<40; i++){
            var a = i*2.399, v = ((i*0.137 + _p*6) % 1), r0 = 720 - v*420, r1 = r0 - (90 + 120*u);
            ctx.strokeStyle = "rgba(255,240,255," + (0.15 + 0.5*u)*(1 - v*0.5) + ")"; ctx.lineWidth = 1 + 2*u;
            ctx.beginPath(); ctx.moveTo(tx + Math.cos(a)*r0, ty + Math.sin(a)*r0); ctx.lineTo(tx + Math.cos(a)*Math.max(60, r1), ty + Math.sin(a)*Math.max(60, r1)); ctx.stroke();
        }
        //尾：奥から光の塊まで(塊に近いほど太い)
        var t0 = Math.max(0, q - 0.45), sx = x + dx*t0, sy = y + dy*t0;
        var g = ctx.createLinearGradient(sx, sy, hx, hy);
        g.addColorStop(0, "rgba(" + TR_GLOW + ",0)");
        g.addColorStop(1, "rgba(" + TR_FIRE + ",0.85)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx + nx*r*0.8, hy + ny*r*0.8); ctx.lineTo(hx - nx*r*0.8, hy - ny*r*0.8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = TR_BEAM_W; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x + dx*Math.max(0, q - 0.25), y + dy*Math.max(0, q - 0.25)); ctx.lineTo(hx, hy); ctx.stroke();
        //光の塊(白い芯・にじみ・回る十字)
        var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, r*1.6);
        hg.addColorStop(0, "rgba(255,255,255,1)");
        hg.addColorStop(0.35, "rgba(" + TR_FIRE + ",0.8)");
        hg.addColorStop(1, "rgba(" + TR_GLOW + ",0)");
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(hx, hy, r*1.6, 0, Math.PI*2); ctx.fill();
        ctx.translate(hx, hy); ctx.rotate(_p*4);
        ctx.fillStyle = "rgba(255,245,255,0.9)";
        for(var i=0; i<4; i++){
            ctx.rotate(Math.PI/2);
            ctx.beginPath(); ctx.moveTo(0, -r*2.4); ctx.lineTo(r*0.12, 0); ctx.lineTo(-r*0.12, 0); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    },
    //着いた衝撃：はじめの TR_INVERT_F コマは画面の色を反転し、そのあと白い閃光。赤と水色にずれた衝撃の輪(2重)と放射の筋
    drawImpact:function(){
        var I = this.impact;
        if(!I) return;
        var f = (this.pos() - I.p0)*60, u = f/TR_IMPACT_T;
        if(u >= 1 || f < 0){ this.impact = null; return; }
        ctx.save();
        if(f < TR_INVERT_F){
            ctx.globalCompositeOperation = "difference";
            ctx.fillStyle = "#fff";
            ctx.fillRect(-20,-20,CW + 40,CH + 40);
            ctx.globalCompositeOperation = "source-over";
        }else if(f < TR_INVERT_F + 4){
            ctx.fillStyle = "rgba(255,255,255," + (0.85*(1 - (f - TR_INVERT_F)/4)) + ")";
            ctx.fillRect(-20,-20,CW + 40,CH + 40);
        }
        ctx.globalCompositeOperation = "lighter";
        var e1 = 1 - Math.pow(1 - u, 3), split = 6*(1 - u);
        //赤と水色にずれた輪(色のにじみ)
        var rings = [[640, 28, "255,60,90", -split], [640, 28, "60,220,255", split], [640, 22, "255,255,255", 0], [360, 14, TR_GLOW, 0]];
        for(var i=0; i<rings.length; i++){
            var Rg = rings[i];
            ctx.strokeStyle = "rgba(" + Rg[2] + "," + ((i < 2 ? 0.6 : 1)*(1 - u)) + ")"; ctx.lineWidth = Rg[1]*(1 - u) + 1.5;
            ctx.beginPath(); ctx.arc(I.x + Rg[3], I.y, 24 + e1*Rg[0], 0, Math.PI*2); ctx.stroke();
        }
        //放射の筋
        for(var i=0; i<44; i++){
            var a = i*2.399, r0 = 40 + e1*(250 + (i % 5)*40), r1 = r0 + (180 + (i % 3)*70)*(1 - u);
            ctx.strokeStyle = "rgba(" + (i % 3 ? TR_FIRE : "255,255,255") + "," + (0.9*(1 - u)) + ")"; ctx.lineWidth = (3 + (i % 4))*(1 - u) + 0.5;
            ctx.beginPath(); ctx.moveTo(I.x + Math.cos(a)*r0, I.y + Math.sin(a)*r0); ctx.lineTo(I.x + Math.cos(a)*r1, I.y + Math.sin(a)*r1); ctx.stroke();
        }
        ctx.restore();
    },
    //最後の突進の言葉(体力が足りていればとどめの合図、足りなければ削る合図)
    drawLastWord:function(_e,_p){
        var ok = _e.hp <= _e.maxHp*TR_FINISH + 1;
        var msg = ok ? "最後の和音に合わせて ― ジャスト衝撃波でとどめ！" : "まだ倒しきれない ― 弾き返して削れ！";
        ctx.save();
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "bold 22px sans-serif";
        ctx.lineJoin = "round"; ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.strokeText(msg, CW/2, CH - 60);
        ctx.fillStyle = ok ? "rgb(" + TR_SUN + ")" : "#fff";
        ctx.fillText(msg, CW/2, CH - 60);
        ctx.restore();
    },
    //散る羽根・かけら(羽根はひらひら舞い落ちる)
    drawShards:function(){
        var sh = this.shards;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for(var i=sh.length-1; i>=0; i--){
            var d = sh[i];
            d.t++; d.x += d.vx; d.y += d.vy;
            d.vx *= 0.95; d.vy = d.vy*0.95 + (d.feather ? 0.04 : 0.08);
            if(d.feather) d.x += Math.sin(d.t*0.12 + d.rot)*0.8;
            d.rot += d.vr;
            if(d.t >= d.life){ sh.splice(i,1); continue; }
            var a = 1 - d.t/d.life;
            ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
            ctx.fillStyle = "rgba(" + d.c + "," + a + ")";
            if(d.feather){
                ctx.beginPath(); ctx.moveTo(d.len/2,0); ctx.lineTo(0,-2.5); ctx.lineTo(-d.len/2,0); ctx.lineTo(0,2.5); ctx.closePath(); ctx.fill();
            }else ctx.fillRect(-d.len/2, -1.5, d.len, 3);
            ctx.restore();
        }
        ctx.restore();
    },
    //夜明けの空(battleBg.drawDark のあとで。敵より奥)：地平線から光が昇り、太陽と光の筋
    drawDawn:function(){
        var k = this.dawnK;
        if(k <= 0 || !this.boss()) return;
        var t = battleBg.t, hx = DEPTH_VP.x, hy = DEPTH_VP.y + 40;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        //地平線のあたりの暖かい光
        var g = ctx.createRadialGradient(hx, hy, 10, hx, hy, 560);
        g.addColorStop(0, "rgba(" + TR_SUN + "," + (0.45*k) + ")");
        g.addColorStop(0.4, "rgba(255,140,90," + (0.22*k) + ")");
        g.addColorStop(1, "rgba(255,120,90,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0,0,CW,CH);
        //上の空は明るい青へ
        var sky = ctx.createLinearGradient(0,0,0,CH*0.5);
        sky.addColorStop(0, "rgba(90,140,230," + (0.22*k) + ")");
        sky.addColorStop(1, "rgba(90,140,230,0)");
        ctx.fillStyle = sky;
        ctx.fillRect(0,0,CW,CH*0.5);
        //光の筋(ゆっくり回る)
        var sy = hy + 26 - 30*k;
        for(var i=0; i<14; i++){
            var a = -Math.PI + i*Math.PI/13 + Math.sin(t*0.004 + i)*0.03;
            var w = 0.035 + 0.02*Math.sin(t*0.01 + i*1.7);
            ctx.fillStyle = "rgba(" + TR_SUN + "," + (0.07*k*(0.6 + 0.4*Math.sin(t*0.02 + i*2.3))) + ")";
            ctx.beginPath(); ctx.moveTo(hx, sy);
            ctx.lineTo(hx + Math.cos(a - w)*900, sy + Math.sin(a - w)*900);
            ctx.lineTo(hx + Math.cos(a + w)*900, sy + Math.sin(a + w)*900);
            ctx.closePath(); ctx.fill();
        }
        //太陽(地平線から少し昇る)
        var sr = 30;
        var sg = ctx.createRadialGradient(hx, sy, 0, hx, sy, sr*4);
        sg.addColorStop(0, "rgba(255,250,235," + (TR_SUN_A*k) + ")");
        sg.addColorStop(0.25, "rgba(" + TR_SUN + "," + (0.5*TR_SUN_A*k) + ")");
        sg.addColorStop(1, "rgba(" + TR_SUN + ",0)");
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(hx, sy, sr*4, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    },
    //ドローン君の光の翼(夜明けから。ドローン君の絵の後ろに描く)。動く向きと逆へ少しなびく
    drawHeroWings:function(){
        var k = this.dawnK;
        if(k <= 0 || !this.boss() || mainScreen.down) return;
        var t = mainScreen.clock || 0, X = drone.X, Y = drone.Y;
        var lean = Math.max(-0.4, Math.min(0.4, (drone.X - (this.lastX == null ? X : this.lastX))*0.05));
        this.lastX = X;
        ctx.save();
        ctx.translate(X, Y);
        ctx.globalCompositeOperation = "lighter";
        for(var s=-1; s<=1; s+=2){
            for(var i=0; i<3; i++){
                var a = -1.05 + i*0.42 + Math.sin(t*0.08 + i)*0.06 - lean*s*0.6, L = (34 + 8*(1 - Math.abs(i - 1)))*Math.min(1, k*1.5);
                if(s < 0) a = Math.PI - a;
                ctx.save();
                ctx.translate(s*9, -3);
                ctx.rotate(a);
                ctx.fillStyle = "rgba(" + TR_HERO + "," + (0.35*k) + ")";
                ctx.beginPath(); ctx.moveTo(3,0); ctx.lineTo(10,-4); ctx.lineTo(L,0); ctx.lineTo(10,3.5); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = "rgba(255,250,230," + (0.8*k) + ")"; ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(L*0.9,0); ctx.stroke();
                ctx.restore();
            }
        }
        ctx.restore();
        //金色の光の粒を落としていく
        if(Math.random() < 0.5) effects.push({ x:X + (Math.random() - 0.5)*30, y:Y + 6, vx:(Math.random() - 0.5)*0.6, vy:0.6 + Math.random(),
                                              life:24, maxLife:24, size:1.8, glow:TR_HERO });
    },
    //ボスの体力ゲージの、とどめを刺せる所の印(夜明けから)
    drawFinishMark:function(){
        var e = this.boss();
        if(!e || e.form != 2 || this.dawnK <= 0) return;
        var w = 320, x = CW/2 - w/2 + w*TR_FINISH, y = 64;
        var ok = e.hp <= e.maxHp*TR_FINISH + 1;
        ctx.fillStyle = ok ? "rgb(" + TR_SUN + ")" : "#fff";
        ctx.fillRect(x - 1, y - 3, 2, 16);
        ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
        ctx.strokeRect(x - 1.5, y - 3.5, 3, 17);
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillStyle = ok ? "#b06a10" : "#333";
        ctx.fillText(ok ? "とどめ OK" : "とどめ", x, y + 15);
    }
};

(function(){
    var kai = special.kai, kaiRevive = special.kaiRevive, kaiFx = special.kaiFx, kaiAwakeFx = special.kaiAwakeFx;
    var draw = special.draw, drawBossBar = special.drawBossBar;
    var onBlast = shotLab.onBlast, step = shotLab.step, sdraw = shotLab.draw, drawUnder = shotLab.drawUnder, drawFront = shotLab.drawFront;
    var drawDark = battleBg.drawDark, droneUnder = dodge.drawUnder;
    var hitEnemy = mainScreen.hitEnemy, drawHud = mainScreen.drawHud;
    var play = sound.play, stopMusic = sound.stopMusic;
    var T = finaleTri;
    //区切りの始まりの時刻
    for(var i=0; i<TR_SECTIONS.length; i++) TR_SECTIONS[i].from = T.barTime(TR_SECTIONS[i].bar);

    special.kai = function(_e,_dx,_dy,_d){
        if(T.step(_e,_dx,_dy,_d)) return;
        kai.call(this,_e,_dx,_dy,_d);
        if(T.on() && _e.trSong && _e.form == 2 && _e.mode != "down") T.pose(_e);
    };
    //第一形態が倒れたあとの復活：Suno のときは曲を流し始め、曲の時刻で組み上がる
    special.kaiRevive = function(_e){
        if(T.on() && _e.mode == "revive" && T.rebuild(_e)) return;
        kaiRevive.call(this,_e);
    };
    special.kaiFx = function(_e){
        if(T.on() && _e.trSong && _e.mode == "revive" && _e.fxMode == "revive"){ _e.fxT++; T.rebuildFx(_e); return; }
        kaiFx.call(this,_e);
    };
    special.kaiAwakeFx = function(_e){
        if(T.on() && _e.trSong){ T.awake(_e); return; }
        kaiAwakeFx.call(this,_e);
    };
    special.draw = function(_e,_body){
        var self = this;
        if(_e.type == "kai" && _e.trSong && T.on() && _e.mode != "down") return T.draw(_e, _body, function(){ draw.call(self,_e,_body); });
        return draw.call(this,_e,_body);
    };
    //とどめのあとは曲を止めない(最後の和音まで)。WAVEクリアの音も鳴らさない
    sound.stopMusic = function(){
        if(T.holdMusic()) return;
        T.keepMusic = false;
        stopMusic.call(this);
    };
    sound.play = function(_name){
        if(_name == "clear" && T.holdMusic()) return;
        if(!T.live() || FS_SE_QUIET.indexOf(_name) < 0 || !this.ready()) return play.call(this,_name);
        var S = this.seGain;
        this.seGain = fsSfx.quiet();
        play.call(this,_name);
        this.seGain = S;
    };
    special.drawBossBar = function(){
        if(T.live()){
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            enemyArt.roundRect(CW/2 - 174, 38, 348, 50, 8); ctx.fill();
        }
        drawBossBar.call(this);
        if(T.live()) T.drawFinishMark();
    };
    mainScreen.drawHud = function(){
        if(T.live() && !special.canopyOf()){
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            enemyArt.roundRect(4, 4, 236, 90, 8); ctx.fill();
            enemyArt.roundRect(CW - 324, 4, 320, 88, 8); ctx.fill();
        }
        drawHud.call(this);
    };
    //改へのダメージ：夜明けからは強く。関門より下へは減らない(関門の下で倒れないよう、いったん体力を足して計算する)
    mainScreen.hitEnemy = function(_e,_dmg,_src){
        if(_e.type != "kai" || !_e.trSong || _e.form != 2 || _src == "trFinish" || !T.on() || _e.dead) return hitEnemy.call(this,_e,_dmg,_src);
        if(T.dawnK > 0) _dmg *= TR_DAWN_POW;
        var floor = T.floor(_e), lift = _e.maxHp*10;
        _e.hp += lift;
        hitEnemy.call(this,_e,_dmg,_src);
        _e.hp = Math.max(floor, _e.hp - lift);
    };
    shotLab.onBlast = function(){
        onBlast.call(this);
        if(T.on()) T.onBlast();
    };
    shotLab.step = function(b){
        var r = T.shotStep(b);
        if(r != null) return r;
        return step.call(this,b);
    };
    shotLab.draw = function(b){
        if(T.shotDraw(b)) return true;
        return sdraw.call(this,b);
    };
    shotLab.drawUnder = function(){
        var r = drawUnder.apply(this, arguments);
        T.drawUnder();
        return r;
    };
    shotLab.drawFront = function(){
        drawFront.call(this);
        if(T.on()) T.drawFront();
    };
    battleBg.drawDark = function(){
        drawDark.call(this);
        if(T.on()) T.drawDawn();
    };
    dodge.drawUnder = function(){
        if(T.on()) T.drawHeroWings();
        return droneUnder.apply(this, arguments);
    };
})();
