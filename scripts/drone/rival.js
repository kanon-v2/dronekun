//------------------------------------------------------------------------------
//  中ボス：ライバル「クロノ」
//  ドローン君と同じ時止めワープ(timeStop.js)を使いこなすライバル。決まったWAVE(RIVAL_WAVES)の最後に現れ、会うたびに強くなる。
//  体が粒子にほどけて別の場所で組み上がるワープで、すばやく動き回る。
//  曲の拍に合わせて戦う(rival.beat)：撃つ・時計の針が進む・止めた弾が動き出す・分身が飛び出すのは拍の上。
//  曲は Suno の「Chronos Duel」(sunoRival。デバッグのメニューの「戦闘曲」で選ぶ)か今の曲で、どちらでも拍を読む。
//  曲が鳴っていないとき(音なし・テスト)は RIVAL_BPM の拍をフレームで数える。
//  第一形態
//    ・刻み撃ち(shoot)：動き回りながら、拍ごとに針の弾を1発、小節の頭は扇に撃つ
//    ・残響突進(aim → dash)：構えて突っ込む。少し遅れて「残響」(さっきの自分。分身 echo)が同じ道を突っ込んでくる。
//      本物も残響もジャスト衝撃波で弾ける(本物はよろけ、残響は砕ける)。ワープで回り込んで続けることもある
//    ・時止め(phantom → hold)：短いワープでまわりを跳び、止まった針を置く(跳んだ跡は線でつながる)。
//      止まっている間(hold)は隙。拍の上で時が動き出し、針がいっせいにドローン君へ飛ぶ
//    ・時計盤(clock。Lv.2から)：自分を中心に文字盤を出し、拍ごとに長針が1目盛り進んで、その向きへ針の列を撃つ。
//      次に進む所は薄く見える。撃っている間は動かない(隙)
//    ・攻撃の合間に削られすぎると、ワープでよける(RIVAL_DODGE)
//  第二形態(WAVE8から。RIVAL2_*)：分身は「過去の自分」
//    ・過去の自分(echo)：動き回って撃つクロノの通った道と撃った弾を、少しずつ遅れた分身がそのままくり返す
//    ・鏡像(mirror)：画面のまんなかを鏡にして、ドローン君の動きを映した場所に本物と分身が立ち、拍ごとに順に撃つ
//    ・分身の輪舞(waltz)：輪になって回り、まんなかへ撃つ
//    ・時戻し(rewind → rstop)：弾の輪を放って止め、拍の上で逆向きに戻す。ドローン君も、最初の輪を放ったときの場所まで
//      来た道を巻き戻される(戻ってくる弾の中へ)／時止め(跳んだ跡に分身が残る)／時計盤
//    ・十二時の決闘(twelve。本気になってから)：時が止まり、ドローン君を囲む文字盤の時刻の位置に分身が並ぶ。
//      針が1つ進むたびにその時刻の分身が突っ込み、最後に十二時の本物が突っ込む。本物を弾き返すと大きなダメージ
//  山場「時ノ奔流」(over。第一形態は本気になったとき、第二形態は体力が RIVAL2_OD_HP を切ったときに1度)：
//    カットイン(時が止まる) → 加速(時が速くなり、渦に撃つ針が拍 → 半拍 → 16分と細かく、飛んでいる針も速くなる) →
//    針の裁き(画面全体が文字盤になり、光る長針(Lv.2からは短針も)が拍ごとに1目盛りずつなぎ払う。次の範囲は赤く見える) →
//    時が巻き戻る(針が逆向きに戻る) → 疲れて長い隙
//  体力が0になっても倒れず、捨てぜりふを残してワープで去る(撃退。報酬カプセルとパーツを落とす)。
//  いる間は雑魚敵が出てこない(一騎打ち)。曲もライバルの曲になる。
//  ボスと同じく boss の印を持つ(衝撃波で飛ばされない・凍らない・上の体力ゲージ)。mid の印で中ボスと見分ける。
//  協力プレイ：ホストが動かし、ワープの出発点・長さは coop.packEnemy の b の12～14番目で届く
//  (新しい攻撃の動き(clock・echo・twelve・wait)は協力プレイへまだ取り込んでいない。ゲストの画面では正しく出なくてよい)
//------------------------------------------------------------------------------
const RIVAL_WAVES    = [3,8,13,18];     //出てくるWAVE(何番目かが強さの段階 Lv.1～4)
//登場の演出(時が止まり、光が集まって組み上がり、名乗る。この間は周りが止まる)
const RIVAL_INTRO_T  = 210;             //登場の演出の長さ(フレーム)
const RIVAL_INTRO_STOP = 24;            //はじめの「時が止まる」(色の反転した輪が広がり、色が抜ける)
const RIVAL_INTRO_GATHER = 22;          //光が集まり始める(ここから RIVAL_INTRO_ARRIVE まで)
const RIVAL_INTRO_ARRIVE = 72;          //組み上がる(ここから名乗る)
const RIVAL_INTRO_OUT = 26;             //終わりの「時が動き出す」(色が戻る)
const RIVAL_INTRO_GUARD = 40;           //時が動き出したあとのドローン君の無敵(フレーム)
const RIVAL          = { name:"クロノ", en:"CHRONO", title:"時を渡るライバル" };
const RIVAL_R        = 20;              //当たり判定の半径
const RIVAL_SCALE    = 1.3;             //絵の大きさ(ドローン君に対して)
const RIVAL_HP       = [96,174,228,288];    //体力(Lv.1～4。難易度・協力プレイの倍率を掛ける)
const RIVAL_TINT     = "35,60,115";     //体の色(紺)
const RIVAL_SCARF    = "#d8323c";       //ハチマキの色
const RIVAL_SCARF_HI = "#ff8a8c";       //ハチマキの光の当たる側
const RIVAL_BAND_Y   = -1.2;            //ハチマキの高さ(体の中心から。絵の大きさを掛ける)
const RIVAL_BAND_W   = 18;              //ハチマキの幅の半分(絵の大きさを掛ける)
const RIVAL_INK      = "#1a1420";       //ふちどり
const RIVAL_TIME     = "70,170,235";    //時の光の色(背中の文字盤・時計盤・止まった針の目盛り。明るい背景でも見える濃さ)
const RIVAL_RED      = "216,50,60";     //合図・残像の赤(ハチマキの色)
//ハチマキの端(なびく2本の帯)
const SCARF_SEGS     = [7,6];           //帯2本それぞれの節の数
const SCARF_SEG      = 4.2;             //1節の長さ(絵の大きさを掛ける)
const SCARF_W        = 2.4;             //帯の太さの半分(結び目の近く。先へ細くなる。絵の大きさを掛ける)
const SCARF_DRAG     = 0.55;            //体が動いた分のうち、帯が取り残される割合(大きいほど後ろへなびく)
const SCARF_GRAVITY  = 0.16;            //帯の重さ(px/フレーム²)
const SCARF_DAMP     = 0.84;            //帯の動きの減り方
const SCARF_FLUTTER  = 0.35;            //はためき(速く動いているほど強い)
//背中の文字盤(拍に合わせて秒針が1目盛り進み、小節の頭で脈打つ)
const DIAL_R         = 34;              //半径(px)
const DIAL_TICK      = 0.16;            //秒針が進む動きの長さ(拍に対する割合。少し行きすぎて止まる)
//拍
const RIVAL_BPM      = 168;             //曲の拍が取れないとき(音なし・テスト)の拍の速さ
const RIVAL_SONG     = "sunoRival";     //Suno の曲の名前(bgmTrial.js の recorded.list)
const RIVAL_SONG_BPM = 170;             //Suno の曲の拍の速さ(だいたい。167 から 175 へ少しずつ速くなる。長さを拍で決めるところに使う)
//Suno の曲の小節の頭(秒。拍を検出して求めた。曲は少しずつ速くなるので、小節ごとに持つ)
const RIVAL_SONG_BARS = [0.31,1.76,3.20,4.64,6.08,7.51,8.93,10.37,11.81,13.22,14.63,16.08,17.52,18.96,20.40,21.84,23.27,24.72,
    26.16,27.59,29.03,30.46,31.90,33.34,34.78,36.21,37.66,39.09,40.51,41.95,43.36,44.79,46.21,47.64,49.05,50.47,51.90,53.32,54.74,
    56.16,57.59,59.01,60.43,61.85,63.28,64.69,66.11,67.53,68.95,70.37,71.78,73.20,74.62,76.02,77.43,78.85,80.25,81.65,83.06,84.47,
    85.88,87.28,88.70,90.09,91.50,92.91,94.31,95.72,97.11,98.51,99.91,101.32,102.70,104.11,105.50,106.89,108.29,109.69,111.07,
    112.47,113.87,115.25,116.62,118.00,119.40,120.78,122.17,123.56,124.95,126.33,127.73,129.11,130.50,131.88,133.27,134.66,
    136.04,137.43,138.81,140.20,141.58,142.97,144.36,145.73,147.12,148.50,149.88,151.26,152.64,154.02,155.41,156.79,158.17,
    159.56,160.94,162.32,163.69,165.08,166.46,167.84,169.22,170.60,171.98,173.37,174.75,176.13,177.51,178.89,180.27,181.65,
    183.03,184.42,185.79,187.17,188.55,189.93,191.31,192.69,194.07,195.44,196.81];
const RIVAL2_SONG_AT = 113.87;          //第二形態の曲はここから流す(80小節目。最後のサビへ上がっていくところ)
//動き
const RIVAL_WARP_T   = [40,34,30,26];   //ワープの長さ(フレーム。ほどけてから組み上がるまで。Lv.1～4)
const RIVAL_BLINK_T  = 18;              //時止め・続けての突進の短いワープ
const RIVAL_DIST     = [170,240];       //ワープで現れるときのドローン君からの距離
const RIVAL_DASH_DIST = [250,320];      //突進の前にワープする距離
const RIVAL_REST     = [[100,75],[85,60],[70,50],[60,42]];  //攻撃のあと、次の攻撃まで(Lv.1～4。ふだん・本気)
const RIVAL_PATTERNS = [                //攻撃の順番(Lv.1～4)。shoot 刻み撃ち・dash 残響突進・phantom 時止め・clock 時計盤
    ["shoot","dash","phantom"],
    ["shoot","dash","clock","phantom"],
    ["clock","dash","phantom","shoot","dash"],
    ["phantom","clock","dash","shoot","clock","dash"]
];
const RIVAL_STRAFE   = 205;             //動き回るときのドローン君からの距離
const RIVAL_STEP_T   = [30,56];         //横へ跳ぶ間隔(フレーム)
const RIVAL_SPEED    = 7.5;             //動き回るときの最高の速さ(px/フレーム)
//刻み撃ち
const RIVAL_SHOOT_T  = 150;             //長さ(フレーム。拍ごとに撃つので、約8拍)
const RIVAL_SHOOT_N  = [3,3,5,5];       //小節の頭に扇で撃つ弾の数(Lv.1～4。ほかの拍は1発。本気なら2発)
const RIVAL_SHOT_SPEED = 3.4;           //針の弾の速さ(弾幕の倍率を掛ける)
//残響突進
const RIVAL_DASH_AIM = [28,46];         //突進の構えの長さ(最後の RIVAL_CUE で向きが固まる)
const RIVAL_CHAIN_AIM = [16,26];        //続けての突進の構えの長さ
const RIVAL_CUE      = 18;              //飛び出す直前の合図の長さ
const RIVAL_DASH_SPEED = 11;            //突進の速さ(px/フレーム)
const RIVAL_DASH_T   = 30;              //突進の長さ(フレーム。画面の端でも止まる)
const RIVAL_CHAIN    = [0,1,1,2];       //ワープで回り込んで続ける突進の回数(Lv.1～4)
const RIVAL_ECHO_N   = [0,1,2,2];       //突進のあとを追う残響の数(Lv.1～4)
const RIVAL_ECHO_GAP = 1;               //残響が飛び出すずれ(拍。1体目は本物の1拍あと、2体目は2拍あと)
const RIVAL_STAGGER  = 45;              //突進を弾かれてよろける時間
const RIVAL_PARRY_DMG = 0.08;           //突進を弾いたときのダメージ(体力に対する割合)
//時止め
const RIVAL_PHANTOM_N = [3,3,4,5];      //跳ぶ回数(Lv.1～4)
const RIVAL_PHANTOM_R = 160;            //跳ぶ場所のドローン君からの距離
const RIVAL_PHANTOM_SHOTS = 5;          //1か所に置く針の数
const RIVAL_HOLD_T   = 50;              //置いた針が止まっている長さ(この間は隙。このあと次の拍で動き出す)
const RIVAL_RELEASE_SPEED = 2.5;        //時が動き出したときの針の速さ(弾幕の倍率を掛ける)
//時計盤(Lv.2から)
const RIVAL_CLOCK_R  = 150;             //文字盤の半径(見た目。px)
const RIVAL_CLOCK_TICKS = [0,8,10,12];  //長針が進む回数(拍。Lv.1～4)
const RIVAL_CLOCK_N  = [0,5,6,7];       //長針が進むたびにその向きへ撃つ針の数(遅い針から速い針まで1列に並ぶ)
const RIVAL_CLOCK_SPEED = [2.0,4.4];    //その針の速さ(いちばん遅い・速い。弾幕の倍率を掛ける)
const RIVAL_CLOCK_RING = [0,0,12,12];   //小節の頭に撃つ遅い針の輪の数(Lv.3から)
const RIVAL_CLOCK_RING_SPEED = 1.6;     //その速さ
//よける・本気・撃退
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
//第二形態(WAVE8から)：第一形態(上の値のまま)の体力が0になると、時を止めて分身の力に目覚める
const RIVAL2          = { name:"クロノ・ミラージュ", en:"CHRONO MIRAGE", title:"時を分かつ幻影" };
const RIVAL2_FROM     = 1;          //第二形態がある段階(lv。1 = WAVE8から)
const RIVAL2_HP_MUL   = 4/3;        //第二形態の体力(第一形態の体力に掛ける。第一形態を3倍にしたとき、第二形態は前の2倍になるように)
const RIVAL2_TINT     = "70,35,125";    //第二形態と分身の体の色(紫がかった紺)
const RIVAL2_GLOW     = "200,130,255";  //第二形態のまわりの光の色
const RIVAL2_TIME     = "150,90,230";   //第二形態の時の光の色(背中の文字盤など。明るい背景でも見える濃さ)
const RIVAL2_AWAKEN_T = 300;        //目覚めの演出の長さ(この間は時が止まる)。撃破 → 鼓動 → 時間停止と力の集まり → 覚醒 → 名乗り
const RIVAL2_DOWN_T   = 64;         //目覚めの演出：撃たれて吹き飛び、火花を散らして倒れている(曲も止まる)
const RIVAL2_BEATS    = [76,100];   //目覚めの演出：鼓動(倒れた体から紫の輪が広がる)
const RIVAL2_STOP_AT  = 118;        //目覚めの演出：時が止まる(色が抜ける)。ここから体が起き上がり、光が集まる
const RIVAL2_SPLIT_AT = 178;        //目覚めの演出：覚醒(閃光・色が変わる・分身が回り出して体力が満ち始める。ここから名乗る)
const RIVAL2_FALL     = 46;         //目覚めの演出：吹き飛んで落ちる距離(px)
const RIVAL2_DOWN_LINE = "ぐっ……！";  //目覚めの演出：倒れたときのせりふ
const RIVAL2_FILL_T   = 80;         //体力が満ちる長さ
const RIVAL2_PATTERNS = [null,      //攻撃の順番(Lv.2～4)。echo 過去の自分・mirror 鏡像・waltz 分身の輪舞・rewind 時戻し・
    ["echo","mirror","rewind","waltz","phantom","echo","dash"],         //phantom 時止め(分身が残る)・clock 時計盤・dash 残響突進
    ["waltz","echo","rewind","mirror","clock","phantom","echo","dash"],
    ["echo","mirror","rewind","waltz","clock","phantom","mirror","rewind","dash"]
];
const RIVAL2_REST     = [null,[75,55],[65,48],[55,40]];     //攻撃のあと、次の攻撃まで(Lv.2～4。ふだん・本気)
const RIVAL2_CLONES   = [0,3,3,3];  //分身の数(本物のほかに。Lv.1～4。鏡像・輪舞。鏡像の映し方は4通りまで)
const RIVAL2_CLONE_HP = 0.01;       //分身の体力(第二形態の体力に対する割合。少し撃てば消える。第二形態の体力を2倍にしたので、分身の硬さは前のままになるよう半分に)
//過去の自分
const RIVAL2_ECHO_T   = 300;        //本物が動き回って撃つ長さ(フレーム。分身はこのあとも遅れた分だけくり返す)
const RIVAL2_ECHOES   = [0,2,3,3];  //分身の数(Lv.1～4)
const RIVAL2_ECHO_DELAY = 44;       //分身1体ごとの遅れ(フレーム。約2拍)
const RIVAL2_ECHO_FAN = [0,3,4,5];  //小節の頭に扇で撃つ弾の数(ほかの拍は1発)
//鏡像：画面のまんなか(RIVAL2_MIRROR_CY の高さ)を鏡にして、ドローン君を左右・上下・点対称・90度回した所へ映す
const RIVAL2_MIRROR_T = 280;        //長さ(フレーム)
const RIVAL2_MIRROR_CY = 300;       //鏡のまんなかの高さ(上の表示を除いた画面のまんなか)
const RIVAL2_MIRROR_GAP = 120;      //映した場所がドローン君にこれより近いときは離す(鏡の近くで重ならないように。px)
const RIVAL2_MIRROR_SPEED = 9;      //映した場所へついていく最高の速さ(px/フレーム)
const RIVAL2_MIRROR_N = 3;          //1回に撃つ弾の数(ドローン君へ向けた扇。拍ごとに1体ずつ順に)
//分身の輪舞
const RIVAL2_WALTZ_T  = 240;        //分身の輪舞：本物と分身がドローン君を囲む輪になって回る長さ
const RIVAL2_WALTZ_R  = [280,150];  //分身の輪舞：輪の半径(はじめ・いちばん縮んだとき。縮んでから広がる)
const RIVAL2_WALTZ_SPIN = 0.018;    //分身の輪舞：輪の回る速さ(ラジアン/フレーム)
const RIVAL2_WALTZ_N  = 3;          //分身の輪舞：1回に撃つ弾の数(輪のまんなかへ向けた扇。拍ごとに1体ずつ順に。本気なら半分ずつ)
//時戻し
const RIVAL2_REWIND_RINGS = [0,3,3,4];  //自分のまわりへ放つ弾の輪の数(Lv.1～4。拍ごとに1つ)
const RIVAL2_REWIND_N = [0,14,16,18];   //1つの輪の弾の数
const RIVAL2_REWIND_SPEED = 2.6;    //放つ弾の速さ(弾幕の倍率を掛ける)
const RIVAL2_REWIND_STOP = 45;      //弾が止まっている長さ(この間は隙)。このあと次の小節の頭で、弾が逆向きに戻ってくる
const RIVAL2_REWIND_BACK = 1.15;    //戻ってくる弾の速さ(放ったときの速さに掛ける)
const RIVAL2_REWIND_TRAIL = 40;     //戻ってくる弾が残像を引く長さ(フレーム)
const RIVAL2_REWIND_PULL = 34;      //ドローン君が来た道を巻き戻される長さ(フレーム。この間は動かせず、当たらない)
const RIVAL2_REWIND_PULL_GUARD = 10;    //巻き戻されたあとも少しだけ当たらない(フレーム)
//十二時の決闘(第二形態で本気になってから)
const RIVAL2_TWELVE_EVERY = 5;      //この数の攻撃ごとに使う(本気になって最初の攻撃でも使う)
const RIVAL2_TWELVE_RX = 300;       //文字盤の横の半径(px)
const RIVAL2_TWELVE_RY = 185;       //文字盤の縦の半径
const RIVAL2_TWELVE_STEP = [0,2,2,1];   //針が1つ進む間隔(半拍。Lv.1～4)
const RIVAL2_TWELVE_DASH_T = 50;    //分身が突っ込む長さ(フレーム。文字盤のまんなかを通り抜ける)
const RIVAL2_TWELVE_CUE = 4;        //最後の本物の構えの長さ(拍)
const RIVAL2_TWELVE_DMG = 0.12;     //本物を弾き返したときのダメージ(体力に対する割合)
const RIVAL2_TWELVE_STAGGER = 80;   //本物を弾き返したときによろける時間
//時ノ奔流(山場)
const RIVAL_OD        = { name:"時ノ奔流", en:"CHRONO OVERDRIVE" };
const RIVAL_OD_LINE   = "見せてやる…時の奔流を！";    //始めるときのせりふ
const RIVAL_OD_TIRED_LINE = "はぁ…はぁ…！";        //終えて疲れたときのせりふ
const RIVAL_OD_CUT    = 84;         //カットインの長さ(フレーム。この間は時が止まる)
const RIVAL_OD_ACCEL  = 12;         //加速の長さ(拍。拍 → 半拍 → 16分と、撃つ間が3段に細かくなる)
const RIVAL_OD_KMAX   = [1.7,1.9,2.1,2.3];  //加速の終わりの時の速さ(飛んでいる針の速さに掛ける。Lv.1～4)
const RIVAL_OD_ARMS   = [2,3,3,4];  //渦に撃つ腕の数(Lv.1～4)
const RIVAL_OD_SPIN   = 0.23;       //渦が回る角度(1回撃つごと。ラジアン。16分のときは6割)
const RIVAL_OD_SPEED  = 2.0;        //渦の針の速さ(弾幕の倍率と時の速さを掛ける)
const RIVAL_OD_JUDGE  = 12;         //針の裁きの長さ(拍。はじめの1拍は予告で、光の針は当たらない)
const RIVAL_OD_BEAM_W = 9;          //光の針の当たる太さの半分(px)
const RIVAL_OD_SWEEP  = 0.2;        //光の針が1目盛り進む動きの長さ(拍に対する割合)
const RIVAL_OD_HOUR_FROM = 1;       //短針も光る段階(lv。1 = WAVE8から。短針は2拍ごとに逆へ1目盛り)
const RIVAL_OD_FACE_R = 250;        //画面に出す大きな文字盤の半径(px)
const RIVAL_OD_BACK   = 1.6;        //巻き戻るとき、針が戻ってくる速さ(撃ったときの速さに掛ける)
const RIVAL_OD_TIRED  = 150;        //大技のあと、疲れて動けない長さ(フレーム。隙)
const RIVAL2_OD_HP    = 0.2;        //第二形態はこの割合を切ったときに使う
const RIVAL2_INTERCEPT_FROM = 2;    //第二形態でドローン君の弾を撃ち落とす(迎撃)段階(lv。2 = WAVE13から)
const RIVAL2_INTERCEPT_PER_SEC = [0,0,3,4];   //迎撃：1秒に撃ち落とせる数(Lv.1～4)
const RIVAL2_INTERCEPT_RANGE = 130; //迎撃：撃ち落とす範囲(体の中心から。px)
const RIVAL2_FADE_T   = 20;         //分身が消える長さ
const RIVAL2_FLICKER  = 90;         //分身はこの間隔でちらつく(よく見ると本物と見分けられる)
const RIVAL2_LINES    = ["まだだ…！ 時の分身を見せてやる！", "どれが本物か、見抜けるか！"];    //目覚めたとき・本気になったとき
const RIVAL2_TWELVE_LINE = "十二時の決闘だ！";       //十二時の決闘を始めるとき
const RIVAL_CELL     = 3;              //ワープの粒子1つの大きさ(ゲームの px。ドローン君の WARP_CELL より粗く、軽く)

//クロノの針の弾(当たり判定は芯だけ。絵は向きに沿って細長い)
SHOT_KINDS.chrono = { r:4.5 };

//------------------------------------------------------------------------------
//  効果音(sound.tone・noise で合成。音声ファイルなし)
//------------------------------------------------------------------------------
var rivalSfx = {
    ok:function(){ return sound.seOn && sound.ready(); },
    //時計の「カチッ」(_hi：高い音。小節の頭・決め所)
    tick:function(_hi){
        if(!this.ok()) return;
        var S = sound.seGain;
        sound.tone("square", _hi ? 3400 : 2600, _hi ? 2900 : 2100, 0.022, _hi ? 0.06 : 0.04, S, 0, 0.001, 7000);
        sound.noise(0.018, _hi ? 0.07 : 0.05, "highpass", 6000, 6000, S);
        if(_hi) sound.tone("sine", 1760, 1760, 0.12, 0.03, S, 0, 0.002);
    },
    //鐘(十二時の決闘・時が動き出す瞬間)
    chime:function(){
        if(!this.ok()) return;
        var S = sound.seGain;
        sound.tone("sine", 1318, 1316, 1.4, 0.07, S, 0, 0.003);
        sound.tone("sine", 1976, 1974, 0.8, 0.035, S, 0, 0.003);
        sound.tone("sine", 659, 659, 1.6, 0.05, S, 0, 0.004);
        sound.tone("triangle", 2637, 2637, 0.25, 0.02, S, 0, 0.001);
    },
    //カットイン：風を切る音と、低い鐘
    cut:function(){
        if(!this.ok()) return;
        var S = sound.seGain;
        sound.noise(0.4, 0.08, "bandpass", 700, 4500, S);
        sound.tone("square", 220, 880, 0.18, 0.03, S, 0, 0.005, 2500);
        sound.tone("sine", 98, 96, 1.6, 0.12, S, 0, 0.004);
        sound.tone("sine", 196, 195, 1.2, 0.05, S, 0, 0.004);
    },
    //加速：だんだん高くなるうなり(_sec 秒かけて)
    riser:function(_sec){
        if(!this.ok()) return;
        var S = sound.seGain;
        sound.tone("sawtooth", 110, 1760, _sec, 0.025, S, 0, _sec*0.85, 2600);
        sound.tone("sawtooth", 165, 2640, _sec, 0.015, S, 0, _sec*0.85, 2600);
    },
    //巻き戻し(テープを逆に回すような、下がっていく音)
    rewind:function(){
        if(!this.ok()) return;
        var S = sound.seGain;
        sound.tone("sawtooth", 1600, 160, 0.5, 0.045, S, 0, 0.01, 2400);
        sound.tone("square", 800, 90, 0.5, 0.02, S, 0, 0.01, 1200);
        sound.noise(0.5, 0.05, "bandpass", 4000, 500, S);
    }
};

//------------------------------------------------------------------------------
//  ワープの粒子(timeStop.js と同じ描き方：今のコマを別のキャンバスへ写し、小さな四角を道すじの上に描く)
//------------------------------------------------------------------------------
var RivalWarp = function(_k){
    this.k = _k;
    this.box = Math.ceil(WARP_BOX*_k);
    this.snap = null;
    this.glows = {};    //光の形(色ごと。写し直すと作り直す)
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
        if(!this.snap) this.snap = document.createElement("canvas");
        this.snap.width = this.snap.height = S;
        this.rs = rs;
        this.glows = {};
        var g = this.snap.getContext("2d");
        g.setTransform(rs,0,0,rs,0,0);
        //DroneLook.draw は全体の ctx に描くので、写す間だけ差し替える
        var keep = ctx;
        ctx = g;
        try{ _look.draw(this.box/2, this.box/2, this.k); }
        finally{ ctx = keep; }
    },
    //光の形：同じ絵の上だけを光の色で塗ったもの(色ごとに1度だけ作る)
    glow:function(_color){
        var c = _color || WARP_COLOR;
        if(this.glows[c]) return this.glows[c];
        var S = this.snap.width, h = document.createElement("canvas");
        h.width = h.height = S;
        var g = h.getContext("2d");
        g.drawImage(this.snap,0,0);
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = "rgb(" + c + ")";
        g.fillRect(0,0,S,S);
        this.glows[c] = h;
        return h;
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
        var rs = this.rs, c = RIVAL_CELL, cs = c*rs, list = this.parts, out = _x1 == null, G = this.glow();
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
                    ctx.drawImage(G, p.sx*rs, p.sy*rs, cs, cs, q.x - sz/2, q.y - sz/2, sz, sz);
                }
            }
        }
        ctx.restore();
    },
    //光る形だけを描く(残像・組み上がった直後の光。_color を渡すとその色)
    drawGlow:function(_x,_y,_a,_color){
        if(!this.snap || _a <= 0) return;
        var b = this.box, rs = this.rs;
        ctx.globalAlpha = _a;
        ctx.drawImage(this.glow(_color), 0, 0, b*rs, b*rs, _x - b/2, _y - b/2, b, b);
        ctx.globalAlpha = 1;
    }
};

//------------------------------------------------------------------------------
//  動き(special.update から。動かすのはホストとひとり用だけ)
//------------------------------------------------------------------------------
//分身(協力プレイのゲストが種類から大きさを知るため)
BOSS_PARTS.chronoClone = { name:"分身", r:RIVAL_R };

var rival = {
    done:true,      //このWAVEではもう現れた(現れないWAVEも true)
    musicOn:false,  //ライバルの曲にしている
    muffled:false,  //時が止まっている間、曲をこもらせている(sound.timeWarp)
    timeK:1,        //時の速さ(時ノ奔流の加速の間。クロノの針の弾の速さに掛ける)
    pull:null,      //時戻しでドローン君を巻き戻している間 { path:今いる所 → 戻る先, t, T }

    //このWAVEの段階(0～3。出てこないWAVEは -1)
    level:function(_w){
        return RIVAL_WAVES.indexOf(_w == null ? game.wave : _w);
    },
    //WAVEの始め(mainScreen.enter から。雑魚敵の数が決まったあと)
    reset:function(){
        this.done = this.level() < 0 || bossDebug.trial || bossDebug.lab;
        this.musicOn = false;
        this.muffle(false);
        this.timeK = 1;
        this.pull = null;
    },
    //戦っているライバル(撃退されて去っていくところは含まない)
    alive:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type == "chrono" && !e.dead && e.mode != "flee") return e;
        }
        return null;
    },
    //WAVEの最後(雑魚敵が出尽くして、全部倒したところ)で現れる(mainScreen.spawn から)。いる間は true
    //撃退して去るとWAVEクリア
    check:function(){
        if(this.alive()) return true;
        if(this.done || mainScreen.toSpawn > 0 || enemies.length > 0) return false;
        this.done = true;
        enemies.push(this.make());
        drone.look.setFace("surprise", 110);    //ドローン君はライバルの登場に驚く(時が止まっている間も驚いた顔)
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
            blinks:0,           //時止めの残りの跳ぶ回数
            orbit:Math.random()*Math.PI*2, stepT:20,
            dodgeCd:RIVAL_DODGE_CD, hpMark:hp,
            bf:0, bi:null, bt:0, onBeat:false,      //拍(rival.tickBeat)
            since12:0           //十二時の決闘からの攻撃の数
        };
        e.look = new DroneLook();
        e.look.tint = RIVAL_TINT;
        e.look.setMood("fierce");
        //登場：時が止まり、画面の上から光が集まって組み上がり、名乗る(rival.introStep)
        aimAt = nearestPlayer(e.x, e.y);
        var p = this.spot(e, RIVAL_DIST);
        e.x = p.x; e.y = p.y;
        e.wx0 = p.x; e.wy0 = -60;
        e.mode = "intro";
        e.count = RIVAL_INTRO_T;
        this.flags(e);
        mainScreen.shake = 0;
        sound.play("timeStop");
        sound.timeWarp(true);
        return e;
    },
    //登場の演出の経過(フレーム)
    introAge:function(_e){
        return RIVAL_INTRO_T - _e.count;
    },
    //登場の間は時が止まる：ライバルの演出だけを進める(mainScreen.update から。止めている間は true)
    //協力プレイのゲストは、届いた mode・count で同じ演出を描く(自分のドローン君は動けるが撃たない：special.holdFire)
    introStep:function(){
        //時ノ奔流のカットインの間も時が止まる
        var c = this.cutOf();
        if(c){
            c.t++;
            c.look.update(0, 0, 0);
            this.cutStep(c);
            mainScreen.updateEffects();
            return true;
        }
        var e = this.introOf();
        if(!e) return false;
        e.t++;
        e.look.update(0, 0, 0);
        if(e.mode == "awaken"){ this.awakenStep(e); mainScreen.updateEffects(); return true; }
        var age = this.introAge(e);
        if(age == RIVAL_INTRO_ARRIVE){
            fx.ring(e.x, e.y, 90, WARP_COLOR, 24, 4);
            sound.play("warpIn");
        }
        if(age == RIVAL_INTRO_T - RIVAL_INTRO_OUT) sound.play("timeResume");
        if(--e.count <= 0){
            //時が動き出す：少しのあいだ、ドローン君は無敵(止まっていた弾がすぐ当たらないように)
            e.mode = "idle";
            e.timer = 50;
            e.hpMark = e.hp;
            this.flags(e);
            sound.timeWarp(false);
            mainScreen.guard = Math.max(mainScreen.guard, RIVAL_INTRO_GUARD);
        }
        mainScreen.updateEffects();
        return true;
    },
    //第二形態に目覚める(rival.retreat から。第一形態の体力が0になったとき)：時が止まり、分身が回りながら体力が満ちる
    awaken:function(_e){
        _e.form = 1.5;          //目覚めの途中(協力プレイでは b の9番目で届く)
        _e.sayT = 0;            //前のせりふは消す(目覚めのせりふを出す)
        _e.mode = "awaken";
        _e.count = RIVAL2_AWAKEN_T;
        _e.maxHp = Math.max(1, Math.round(_e.maxHp*RIVAL2_HP_MUL));
        _e.hp = 0;
        _e.enraged = false;
        _e.chain = 0;
        _e.final = false;
        _e.ov = null;
        _e.vx = 0; _e.vy = 0;
        this.timeK = 1;
        this.pull = null;
        this.flags(_e);
        //置いたままの弾は消える
        enemyShots = enemyShots.filter(function(b){ return b.held != _e.id; });
        mainScreen.shake = 0;
        this.muffle(false);
        //見た目と音は rival.awakenFx(協力プレイのゲストも、届いた mode・count から同じものを出す)
        return true;
    },
    awakenAge:function(_e){
        return RIVAL2_AWAKEN_T - _e.count;
    },
    //目覚めの1コマ(introStep から。時が止まっている)
    awakenStep:function(_e){
        var age = this.awakenAge(_e);
        //体力が満ちていく(上の体力ゲージで見える)
        if(age >= RIVAL2_SPLIT_AT) _e.hp = _e.maxHp*Math.min(1, (age - RIVAL2_SPLIT_AT)/RIVAL2_FILL_T);
        if(--_e.count <= 0){
            _e.form = 2;
            //WAVE13からは、近づいたドローン君の弾を撃ち落とす(迎撃。shotLab.js。本物だけで、分身はしない)
            if(_e.lv >= RIVAL2_INTERCEPT_FROM)
                _e.intercept = { cd:0, zap:0, per:RIVAL2_INTERCEPT_PER_SEC[_e.lv], range:RIVAL2_INTERCEPT_RANGE, color:RIVAL2_GLOW, quiet:true };
            _e.hp = _e.maxHp;
            _e.hpMark = _e.hp;
            _e.mode = "idle";
            _e.timer = 50;
            _e.cycle = 0;
            _e.since12 = 0;
            this.flags(_e);
            mainScreen.guard = Math.max(mainScreen.guard, RIVAL_INTRO_GUARD);
        }
    },
    //第二形態の見た目か(目覚めの途中で、分かれたところから)
    second:function(_e){
        return _e.form == 2 || (_e.mode == "awaken" && this.awakenAge(_e) >= RIVAL2_SPLIT_AT);
    },
    //目覚めの演出の体のずれ・傾き(撃たれて吹き飛んで倒れ、時が止まってから起き上がる)
    awakenPose:function(_e){
        var age = this.awakenAge(_e), D = Math.max(0, Math.min(RIVAL2_FALL, CH - 40 - _e.y));     //画面の下から落ちないように
        if(age >= RIVAL2_SPLIT_AT) return { dx:0, dy:0, rot:0 };
        if(age < RIVAL2_STOP_AT){
            //跳ね上がってから落ち、そのあとは倒れたまま
            var u = Math.min(1, age/28);
            return { dx:-14*u, dy:D*u - 34*Math.sin(Math.PI*u), rot:-1.2*Math.min(1, age/18) };
        }
        //起き上がる(終わりに近づくほど震える)
        var v = (age - RIVAL2_STOP_AT)/(RIVAL2_SPLIT_AT - RIVAL2_STOP_AT), e = v*v*(3 - 2*v), j = 4*v*v;
        return { dx:-14*(1 - e) + (Math.random() - 0.5)*j, dy:D*(1 - e) + (Math.random() - 0.5)*j, rot:-1.2*(1 - e) };
    },
    //目覚めの演出の見た目と音(watch から描画のたびに。ホストもゲストも、届いた mode・count から同じものを出す。過ぎた時を1度ずつ)
    awakenFx:function(_e){
        if(_e.mode != "awaken"){
            //時が動き出した：曲を少し速く(Suno の曲は、最後のサビへ上がっていくところから)
            if(_e.awLast != null && _e.form == 2){
                sound.music(null);
                this.songFrom(RIVAL2_SONG_AT);
                sound.music("rival", TRACKS.rival.bpm + 16);
            }
            _e.awLast = null;
            return;
        }
        var age = this.awakenAge(_e), last = _e.awLast == null ? -1 : _e.awLast;
        _e.awLast = age;
        var at = function(_t){ return last < _t && age >= _t; };
        var P = this.awakenPose(_e), x = _e.x + P.dx, y = _e.y + P.dy;
        //撃破：閃光・大きな揺れ・爆発。曲が止まる
        if(at(0)){
            sound.stopMusic();
            sound.play("explode");
            sound.play("destroyed");
            fx.flare(_e.x, _e.y, 110, "255,255,255", 16);
            fx.ring(_e.x, _e.y, 80, "255,230,200", 18, 5);
            fx.sparks(_e.x, _e.y, 26, "255,200,120", 9, 3);
            fx.shake(16);
            _e.look.setFace("hurt", 60);
        }
        //倒れている間：火花と煙
        if(age > last && age > 20 && age < RIVAL2_STOP_AT && age % 6 == 0){
            fx.sparks(x + (Math.random() - 0.5)*24, y + (Math.random() - 0.5)*16, 3, "255,170,100", 3, 2);
            if(age % 12 == 0) effects.push({ smoke:true, x:x + (Math.random() - 0.5)*16, y:y, vx:(Math.random() - 0.5)*0.5, vy:-0.7,
                                             R0:5, R1:20, life:40, maxLife:40, color:"55,50,70" });
        }
        if(at(RIVAL2_DOWN_T - 24)) this.say(_e, RIVAL2_DOWN_LINE);
        //鼓動：倒れた体から紫の輪が広がる
        for(var i=0; i<RIVAL2_BEATS.length; i++){
            if(!at(RIVAL2_BEATS[i])) continue;
            sound.play("heartbeat");
            fx.ring(x, y, 60 + 30*i, RIVAL2_GLOW, 22, 3);
            fx.flare(x, y, 40 + 20*i, RIVAL2_GLOW, 12);
            fx.shake(3 + 3*i);
        }
        //時が止まる：起き上がり、光が吸い込まれるように集まる
        if(at(RIVAL2_STOP_AT)){
            _e.sayT = Math.min(_e.sayT, 8);       //倒れたときのせりふは消す
            sound.play("timeStop");
            sound.play("beamCharge");
        }
        if(age >= RIVAL2_STOP_AT && age < RIVAL2_SPLIT_AT){
            var k = (age - RIVAL2_STOP_AT)/(RIVAL2_SPLIT_AT - RIVAL2_STOP_AT);
            mainScreen.shake = Math.max(mainScreen.shake, 1 + 4*k);
            //進んだコマの数だけ(画面のリフレッシュレートによらない)
            for(var n=Math.min(4, age - Math.max(last, RIVAL2_STOP_AT - 1)); n>0; n--){
                var a = Math.random()*Math.PI*2, R = 160 + Math.random()*80, sp = 6 + 8*k, L = Math.round(R/sp);
                effects.push({ x:x + Math.cos(a)*R, y:y + Math.sin(a)*R, vx:-Math.cos(a)*sp, vy:-Math.sin(a)*sp,
                               life:L, maxLife:L, size:2 + 2*k, glow:Math.random() < 0.6 ? RIVAL2_GLOW : WARP_COLOR });
            }
        }
        //覚醒：閃光・二重の輪・分身が飛び出す
        if(at(RIVAL2_SPLIT_AT)){
            sound.play("bossImpact");
            sound.play("warpOut");
            rivalSfx.chime();
            fx.flare(_e.x, _e.y, 140, RIVAL2_GLOW, 22);
            fx.ring(_e.x, _e.y, 130, RIVAL2_GLOW, 26, 6);
            fx.ring(_e.x, _e.y, 220, "255,255,255", 34, 3);
            fx.sparks(_e.x, _e.y, 30, RIVAL2_GLOW, 10, 3);
            fx.shake(14);
        }
        if(at(RIVAL2_AWAKEN_T - RIVAL_INTRO_OUT)) sound.play("timeResume");
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
        _e.look.setMood("fierce");
    },
    //協力プレイのゲスト：届いた種類から分身を作る
    guestInitClone:function(_e){
        _e.r = RIVAL_R;
        _e.clone = true;
        _e.mid = true;
        _e.name = "分身";
        _e.glow = WARP_COLOR;
        _e.lv = Math.max(0, this.level());
        _e.look = new DroneLook();
        _e.look.tint = RIVAL2_TINT;
        _e.look.setMood("fierce");
    },
    //登場・目覚めの演出・ワープ中・去るところは当たらず、狙われない
    //分身は、現れる・出番を待つ(wait)・消えるところは当たらず、置き去りの分身(stay)は体当たりしてこない
    flags:function(_e){
        if(_e.clone){
            _e.phased = _e.mode == "warp" || _e.mode == "fade" || _e.mode == "wait";
            _e.harmless = _e.phased || _e.mode == "stay";
            return;
        }
        _e.harmless = _e.mode == "intro" || _e.mode == "awaken" || _e.mode == "warp" || _e.mode == "flee";
        _e.phased = _e.harmless;
    },

    //------------------------------------------------------------ 拍
    //曲の今の拍(小節の頭が4の倍数)。曲が鳴っていなければ null
    musicBeat:function(){
        if(!sound.ctx || !sound.track) return null;
        if(sound.trackName == RIVAL_SONG && typeof sunoRival != "undefined"){
            var p = sunoRival.pos();
            return p < 0 ? null : this.songBeat(p);
        }
        if(sound.trackName == "rival"){
            //今の曲：次に鳴らす16分音符(sound.nextTime)から逆算する。スピーカーから出るまでの遅れを引いて、耳とそろえる
            var ac = sound.ctx, lat = ac.outputLatency || ac.baseLatency || 0;
            return sound.bar*4 + sound.step/4 - (sound.nextTime - (ac.currentTime - lat))*sound.bpm/60;
        }
        return null;
    },
    //Suno の曲の時刻 _p(秒)の拍(小節の頭の表 RIVAL_SONG_BARS から。小節の中は等しく分ける)
    songBeat:function(_p){
        var B = RIVAL_SONG_BARS, i = B.length - 2;
        while(i > 0 && B[i] > _p) i--;
        return 4*(i + (_p - B[i])/(B[i + 1] - B[i]));
    },
    //今の拍の速さ(拍で長さを決めるところに使う)
    bpm:function(){
        if(sound.trackName == RIVAL_SONG) return RIVAL_SONG_BPM;
        if(sound.trackName == "rival" && sound.bpm) return sound.bpm;
        return RIVAL_BPM;
    },
    //1拍のフレーム数
    beatF:function(){ return 3600/this.bpm(); },
    //拍(曲が鳴っていなければ、戦い始めてからのフレームで数える)
    beat:function(_e){
        var m = this.musicBeat();
        return m != null ? m : (_e.bf || 0)*RIVAL_BPM/3600;
    },
    //1コマごとに拍を進める(update から)。拍の頭を越えたコマは onBeat、小節の頭は bi が4の倍数
    tickBeat:function(_e){
        _e.bf = (_e.bf || 0) + 1;
        var b = this.beat(_e), bi = Math.floor(b), hb = Math.floor(b*2);
        _e.onBeat = _e.bi != null && bi != _e.bi;
        _e.onHalf = _e.hb != null && hb != _e.hb;
        _e.bi = bi; _e.hb = hb; _e.bt = b;
    },
    //小節の頭か
    downbeat:function(_e){ return ((_e.bi % 4) + 4) % 4 == 0; },
    //Suno の曲をどこから流すか(第二形態は RIVAL2_SONG_AT から)
    songFrom:function(_t){
        if(typeof sunoRival != "undefined") sunoRival.startAt = _t;
    },
    //時が止まっている間は曲をこもらせる(時止めの hold・時戻しの rstop)
    muffle:function(_on){
        if(_on == this.muffled) return;
        this.muffled = _on;
        sound.timeWarp(_on);
    },

    update:function(_e,_dx,_dy,_d){
        if(_e.mode == "intro" || _e.mode == "awaken") return;     //登場・目覚めの演出は rival.introStep
        this.tickBeat(_e);
        var rage = _e.enraged ? 1 : 0, lv = _e.lv;
        var play = mainScreen.state == "play";
        var toMe = Math.atan2(_dy,_dx);
        if(_e.dodgeCd > 0) _e.dodgeCd--;
        //体力が減ると本気になる(第二形態では、次の攻撃で十二時の決闘)
        if(!_e.enraged && _e.mode != "flee" && _e.hp < _e.maxHp*RIVAL_RAGE_HP){
            _e.enraged = true;
            if(_e.form == 2) _e.since12 = RIVAL2_TWELVE_EVERY;
            else if(!(_e.odDone & 1)) _e.odDue = true;      //第一形態：次の攻撃で時ノ奔流
            fx.shake(8);
            sound.play("warning");
        }
        //第二形態：体力が少なくなったら、次の攻撃で時ノ奔流(1度だけ)
        if(_e.form == 2 && !(_e.odDone & 2) && !_e.odDue && _e.hp < _e.maxHp*RIVAL2_OD_HP) _e.odDue = true;
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
                //刻み撃ち：拍ごとに1発(本気なら2発)、小節の頭は扇
                this.strafe(_e);
                if(_e.onBeat && play) this.beatShot(_e, toMe, RIVAL_SHOOT_N[lv]);
                if(--_e.count <= 0) this.rest(_e);
                break;
            case "echo":
                //過去の自分(第二形態)：動き回って撃つ。通った道と撃った弾を、遅れた分身がくり返す(rival.echoReplay)
                this.strafe(_e);
                _e.hist.push({ x:_e.x + _e.vx, y:_e.y + _e.vy, f:null });
                if(_e.onBeat && play) this.beatShot(_e, toMe, RIVAL2_ECHO_FAN[lv]);
                if(--_e.count <= 0){ _e.hist.done = true; this.rest(_e); }
                break;
            case "clock":
                //時計盤：動かず、拍ごとに長針を進めて撃つ
                _e.vx *= 0.8; _e.vy *= 0.8;
                _e.grow = Math.min(1, (_e.grow || 0) + 1/this.beatF());
                if(_e.onBeat && play && _e.grow >= 1) this.clockTick(_e);
                if(_e.ticks <= 0 || --_e.count <= 0) this.rest(_e);
                break;
            case "waltz":
                //分身の輪舞(第二形態)：分身と輪になって回り、輪のまんなかへ撃つ
                if(this.waltzStep(_e, _e, play)) this.rest(_e);
                break;
            case "mirror":
                //鏡像(第二形態)：ドローン君を映した場所へついていき、拍ごとに順に撃つ
                if(this.mirrorStep(_e, _e, play)) this.rest(_e);
                break;
            case "over":
                //時ノ奔流(山場)：加速 → 針の裁き(カットインは rival.introStep)
                this.overStep(_e, play);
                break;
            case "rewind":
                //時戻し(第二形態)：拍ごとに自分のまわりへ弾の輪を放ち、1拍あとに時を止める
                _e.vx *= 0.85; _e.vy *= 0.85;
                if(_e.rings < RIVAL2_REWIND_RINGS[lv]) this.recordDrone(_e);
                if(_e.onBeat && play){
                    if(_e.rings > 0){ this.rewindRing(_e, RIVAL2_REWIND_RINGS[lv] - _e.rings); _e.rings--; }
                    else this.rewindStop(_e);
                }
                if(--_e.count <= 0) this.rewindStop(_e);
                break;
            case "rstop":
                //時が止まり、放った弾が止まっている(この間は隙)。終わると次の小節の頭で、弾が逆向きに戻ってくる
                _e.vx *= 0.85; _e.vy *= 0.85;
                this.recordDrone(_e);
                if(--_e.count <= 0 && (this.downbeat(_e) && _e.onBeat || _e.count < -this.beatF()*4.5)){
                    this.rewindBack(_e);
                    this.rest(_e);
                }
                break;
            case "twelve":
                //十二時の決闘(第二形態)：時刻の位置に分身を並べ、針を進めて1体ずつ突っ込ませる
                _e.vx *= 0.8; _e.vy *= 0.8;
                this.twelveStep(_e, play);
                break;
            case "aim":
                this.aimStep(_e,_dx,_dy,_d);
                break;
            case "dash":
                if(this.dashStep(_e)){
                    if(_e.final){
                        //十二時の決闘を弾かれずに抜けた：時が動き出す
                        _e.final = false;
                        this.rest(_e);
                    }else if(_e.chain > 0){
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
                //時が止まり、置いた針が止まっている(この間は隙)。終わると次の拍でいっせいに飛ぶ
                _e.vx *= 0.85; _e.vy *= 0.85;
                if(--_e.count <= 0 && (_e.onBeat || _e.count < -this.beatF()*1.5)){
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
        this.muffle(_e.mode == "hold" || _e.mode == "rstop");
        //攻撃の合間に削られすぎると、ワープでよける
        if((_e.mode == "idle" || _e.mode == "shoot" || _e.mode == "echo") && play && _e.dodgeCd <= 0 && _e.hpMark - _e.hp >= _e.maxHp*RIVAL_DODGE){
            _e.dodgeCd = RIVAL_DODGE_CD;
            popup(_e.x, _e.y - 40, "遅い！", "rgb(30,120,190)");
            if(_e.mode == "echo") _e.hist.done = true;
            this.escape(_e);
        }
        _e.look.update(dirFromVel(_e.vx,_e.vy), _e.vx, _e.vy);
        this.flags(_e);
    },
    //針の弾を扇に撃つ(_o：撃った敵。止める・戻すため、本物の番号を印にする)
    needles:function(_o,_x,_y,_a,_n,_spread,_sp){
        var from = enemyShots.length;
        fireFan(_x, _y, _a, _n, _spread, _sp, "chrono");
        for(var i=from; i<enemyShots.length; i++) enemyShots[i].cr = _o.owner || _o.id;
        return from;
    },
    shotSpeed:function(){ return RIVAL_SHOT_SPEED*Math.min(1.3,danmaku()); },
    //拍の上で撃つ(刻み撃ち・過去の自分)：ふだんの拍は1発(本気なら2発)、小節の頭は _fan 発の扇。
    //過去の自分の間は、撃った向きを通った道に書いておく(分身がくり返す)
    beatShot:function(_e,_a,_fan){
        var down = this.downbeat(_e), n = down ? _fan : (_e.enraged ? 2 : 1), sp = down ? 0.2 : 0.14;
        this.needles(_e, _e.x, _e.y, _a, n, sp, this.shotSpeed());
        if(_e.mode == "echo" && _e.hist.length) _e.hist[_e.hist.length - 1].f = [_a, n, sp];
        sound.play("shot");
        if(down) rivalSfx.tick(true);
    },
    //突進の構え：狙いを合わせ、合図(最後の RIVAL_CUE)で向きを固める(本物も分身も)
    aimStep:function(_e,_dx,_dy,_d){
        _e.vx *= 0.8; _e.vy *= 0.8;
        if(_e.count > RIVAL_CUE){ _e.aimX = _dx/_d; _e.aimY = _dy/_d; }
        if(_e.count == RIVAL_CUE) sound.play("tell");
        if(--_e.count <= 0){
            _e.mode = "dash";
            _e.count = _e.dashT || RIVAL_DASH_T;
            sound.play("dash");
            //残響突進：本物の突進のあとを、残響(さっきの自分)が同じ道で追ってくる
            if(!_e.clone && !_e.final) this.echoDash(_e);
        }
    },
    //突進の1コマ。終わったら(時間切れか画面の端) true
    dashStep:function(_e){
        _e.vx = _e.aimX*RIVAL_DASH_SPEED;
        _e.vy = _e.aimY*RIVAL_DASH_SPEED;
        if(_e.t % 2 == 0) effects.push({ x:_e.x, y:_e.y, vx:-_e.vx*0.1, vy:-_e.vy*0.1, life:14, maxLife:14, size:4, glow:_e.clone ? RIVAL2_GLOW : WARP_COLOR });
        //画面のまんなかを通り抜ける突進(十二時の決闘)は、画面の外へ出てから終わる
        var m = _e.dashT ? -40 : 0;
        if(--_e.count <= 0 || _e.x < _e.r + m || _e.x > CW - _e.r - m || _e.y < 80 + m || _e.y > CH - _e.r - m){
            _e.x = Math.max(_e.r + m, Math.min(_e.x, CW - _e.r - m));
            _e.y = Math.max(80 + m, Math.min(_e.y, CH - _e.r - m));
            _e.vx = 0; _e.vy = 0;
            return true;
        }
        return false;
    },
    //------------------------------------------------------------ 残響突進
    //本物が飛び出した場所に残響を置く。拍ずつ遅れて、同じ向きへ突っ込む
    echoDash:function(_e){
        var n = RIVAL_ECHO_N[_e.lv], gap = Math.round(this.beatF()*RIVAL_ECHO_GAP);
        for(var k=1; k<=n; k++){
            this.spawnClone(_e, _e.x, _e.y, "wait", { echo:true, wait:k*gap, waitT:k*gap, next:"dash", aimX:_e.aimX, aimY:_e.aimY, n:k });
        }
    },
    //------------------------------------------------------------ 時計盤
    //時計盤を始める(ワープで着いたところから)：長針はドローン君と逆の向きから、どちらかへ回る
    clockStart:function(_e){
        var toMe = Math.atan2(aimAt.Y - _e.y, aimAt.X - _e.x);
        _e.mode = "clock";
        _e.grow = 0;
        _e.ticks = RIVAL_CLOCK_TICKS[_e.lv] || RIVAL_CLOCK_TICKS[1];
        _e.count = Math.round((_e.ticks + 3)*this.beatF()*1.6);    //曲が止まっても終わるように
        _e.hand = Math.round((toMe + Math.PI)/(Math.PI/6))*Math.PI/6;
        _e.hdir = Math.random() < 0.5 ? 1 : -1;
        _e.tickT = 0;
        sound.play("timeStop");
    },
    //長針が1目盛り進み、その向きへ針の列を撃つ(本気・Lv.4は反対の向きにも)。小節の頭は遅い針の輪(Lv.3から)
    clockTick:function(_e){
        var lv = _e.lv, N = RIVAL_CLOCK_N[lv] || RIVAL_CLOCK_N[1], mul = Math.min(1.3,danmaku());
        _e.hand += _e.hdir*Math.PI/6;
        _e.ticks--;
        _e.tickT = 1;       //撃った瞬間の光(描画で減らす)
        var hands = (_e.enraged || lv >= 3) ? [_e.hand, _e.hand + Math.PI] : [_e.hand];
        for(var h=0; h<hands.length; h++){
            for(var i=0; i<N; i++){
                var v = (RIVAL_CLOCK_SPEED[0] + (RIVAL_CLOCK_SPEED[1] - RIVAL_CLOCK_SPEED[0])*i/(N - 1))*mul;
                this.needles(_e, _e.x + Math.cos(hands[h])*24, _e.y + Math.sin(hands[h])*24, hands[h], 1, 0, v);
            }
        }
        var down = this.downbeat(_e);
        if(down && RIVAL_CLOCK_RING[lv]){
            var from = enemyShots.length;
            fireRing(_e.x, _e.y, RIVAL_CLOCK_RING[lv], RIVAL_CLOCK_RING_SPEED*mul, _e.hand + Math.PI/12, "chrono");
            for(var i=from; i<enemyShots.length; i++) enemyShots[i].cr = _e.id;
        }
        rivalSfx.tick(down);
        sound.play("shot");
    },
    //------------------------------------------------------------ 過去の自分(第二形態)
    //始める：本物の通った道(hist)を、遅れた分身が1コマずつたどる
    echoStart:function(_e){
        _e.mode = "echo";
        _e.count = RIVAL2_ECHO_T;
        _e.hist = [];
        for(var k=1; k<=RIVAL2_ECHOES[_e.lv]; k++){
            this.spawnClone(_e, _e.x, _e.y, "wait", { echo:true, past:true, hist:_e.hist, hi:-k*RIVAL2_ECHO_DELAY, n:k, next:"echo" });
        }
    },
    //分身のくり返し(1コマ)：通った道の hi 番目へ動き、そのとき撃っていたら同じ向きへ撃つ。くり返し終えたら true
    echoReplay:function(_c,_play){
        var H = _c.hist, h = H[_c.hi];
        if(!h) return !!H.done;     //まだたまっていない(待つ)・くり返し終えた
        _c.hi++;
        //通った道へそのまま置く(EMP・水鉄砲で遅れないように、速さではなく位置で動かす)
        _c.mvx = h.x - _c.x; _c.mvy = h.y - _c.y;
        _c.x = h.x; _c.y = h.y;
        _c.vx = 0; _c.vy = 0;
        if(h.f && _play){
            this.needles(_c, _c.x, _c.y, h.f[0], h.f[1], h.f[2], this.shotSpeed());
            sound.play("shot");
        }
        return false;
    },
    //------------------------------------------------------------ 分身の輪舞(第二形態)
    //1コマ(本物も分身も。_o は本物)：輪のまんなか(始めたときのドローン君の位置)のまわりを回り、輪が縮んでから広がる。
    //拍ごとに1体ずつ順に(本気なら半分ずつ)、輪のまんなかへ扇に撃つ(弾は輪の中で交わる)。終わったら true
    waltzStep:function(_e,_o,_play){
        var T = RIVAL2_WALTZ_T, age = T - _e.count, u = age/T;
        var R = RIVAL2_WALTZ_R[0] - (RIVAL2_WALTZ_R[0] - RIVAL2_WALTZ_R[1])*Math.sin(Math.PI*u);
        var a = _e.orbit + RIVAL2_WALTZ_SPIN*age;
        var p = this.clamp(_e.wcx + Math.cos(a)*R, _e.wcy + Math.sin(a)*R*0.8);
        var tx = (p.x - _e.x)*0.25, ty = (p.y - _e.y)*0.25, s = Math.hypot(tx,ty), mx = RIVAL_SPEED*1.5;
        if(s > mx){ tx *= mx/s; ty *= mx/s; }
        _e.vx += (tx - _e.vx)*0.3;
        _e.vy += (ty - _e.vy)*0.3;
        var n = RIVAL2_CLONES[_e.lv] + 1, slot = _e.slot || 0;
        var turn = _o.enraged ? (slot % 2) == (((_o.bi % 2) + 2) % 2) : slot == ((_o.bi % n) + n) % n;
        if(_play && _o.onBeat && turn && age > 20 && _e.count > 20){
            this.needles(_e, _e.x, _e.y, Math.atan2(_e.wcy - _e.y, _e.wcx - _e.x), RIVAL2_WALTZ_N, 0.16, this.shotSpeed());
            sound.play("shot");
        }
        return --_e.count <= 0;
    },
    //------------------------------------------------------------ 時戻し(第二形態)
    //自分のまわりへ弾の輪を放つ(輪ごとに少し回す。あとで止めて戻すため印を付ける)
    rewindRing:function(_e,_k){
        var n = RIVAL2_REWIND_N[_e.lv], from = enemyShots.length;
        fireRing(_e.x, _e.y, n, RIVAL2_REWIND_SPEED*Math.min(1.3,danmaku()), _k*(0.3 + Math.PI/n), "chrono");
        for(var i=from; i<enemyShots.length; i++){ enemyShots[i].rew = _e.id; enemyShots[i].cr = _e.id; }
        fx.ring(_e.x, _e.y, 40, RIVAL2_GLOW, 12, 3);
        sound.play("shot");
        rivalSfx.tick(_k == 0);
    },
    //時が止まり、放った弾が止まる(時止めと同じく、止まった針として目盛りを出す)
    rewindStop:function(_e){
        if(_e.mode != "rewind") return;
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.rew != _e.id) continue;
            b.rvx = b.vx; b.rvy = b.vy;
            b.ang = Math.atan2(b.vy,b.vx) + Math.PI;    //止まった針は、戻っていく向きを指す
            b.vx = 0; b.vy = 0;
            b.held = _e.id;
        }
        _e.mode = "rstop";
        _e.count = RIVAL2_REWIND_STOP;
        _e.stopT = RIVAL2_REWIND_STOP;
        popup(_e.x, _e.y - 44, "時よ、戻れ！", "rgb(150,80,220)");
        sound.play("timeStop");
    },
    //止まった弾が、来た道を逆向きに戻ってくる(よけた先の後ろから来る。もう一度かすれる)
    rewindBack:function(_e){
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.rew != _e.id || b.held != _e.id) continue;
            b.vx = -b.rvx*RIVAL2_REWIND_BACK; b.vy = -b.rvy*RIVAL2_REWIND_BACK;
            b.held = 0; b.rew = 0;
            b.grazed = false;
            b.rewT = RIVAL2_REWIND_TRAIL;
            b.popT = 12;
        }
        _e.relT = 24;
        _e.rewFx = 30;
        //ドローン君も、最初の輪を放ったときの場所まで来た道を巻き戻される(戻ってくる弾の中へ。巻き戻される間は当たらない)
        if(_e.dh && _e.dh.length > 2){
            this.pull = { path:_e.dh.slice().reverse(), t:0, T:RIVAL2_REWIND_PULL };
            mainScreen.guard = Math.max(mainScreen.guard, RIVAL2_REWIND_PULL + RIVAL2_REWIND_PULL_GUARD);
            popup(drone.X, drone.Y - 34, "巻き戻される！", "rgb(150,80,220)");
        }
        _e.dh = null;
        fx.ring(_e.x, _e.y, 120, RIVAL2_GLOW, 20, 4);
        sound.play("timeResume");
        rivalSfx.rewind();
    },
    //時戻しの間、ドローン君(自分)の通った道を書いておく(巻き戻す先は、最初の輪を放ったときの場所)
    recordDrone:function(_e){
        if(_e.dh && _e.dh.length < 900) _e.dh.push({ x:drone.X, y:drone.Y });
    },
    //巻き戻されている間のドローン君の位置(drone.calcXY から。動かしたら true)：来た道を逆にたどる(はじめと終わりはゆっくり)
    steer:function(_d){
        var P = this.pull;
        if(!P) return false;
        P.t++;
        var u = Math.min(1, P.t/P.T), e = u*u*(3 - 2*u), f = e*(P.path.length - 1), i = Math.floor(f), k = f - i;
        var a = P.path[i], b = P.path[Math.min(P.path.length - 1, i + 1)];
        _d.X = a.x + (b.x - a.x)*k;
        _d.Y = a.y + (b.y - a.y)*k;
        if(u >= 1){
            this.lastPull = { x:_d.X, y:_d.Y, to:P.path[P.path.length - 1] };
            this.pull = null;
        }
        return true;
    },
    //------------------------------------------------------------ 十二時の決闘(第二形態)
    //始める：文字盤のまんなか(今のドローン君の位置。文字盤が画面に収まるよう寄せる)を決め、十二時の位置へワープする
    twelve:function(_e){
        var RX = RIVAL2_TWELVE_RX, RY = RIVAL2_TWELVE_RY;
        var cx = Math.max(RX + 30, Math.min(CW - RX - 30, aimAt.X)), cy = Math.max(100 + RY, Math.min(CH - RY - 15, aimAt.Y));
        _e.tw = { cx:cx, cy:cy, hour:0, gather:1, fill:0 };
        _e.since12 = 0;
        _e.chain = 0;
        this.say(_e, RIVAL2_TWELVE_LINE);
        this.warp(_e, cx, cy - RY, RIVAL_WARP_T[_e.lv], "twelve");
    },
    //時刻 _h(0 が十二時)の位置
    hourAt:function(_e,_h){
        var a = -Math.PI/2 + _h*Math.PI/6;
        return { x:_e.tw.cx + Math.cos(a)*RIVAL2_TWELVE_RX, y:_e.tw.cy + Math.sin(a)*RIVAL2_TWELVE_RY };
    },
    //1コマ：はじめは半拍ごとに分身を1つずつ時刻の位置へ出し(一時～十一時)、並んだら針を進めて1体ずつ突っ込ませる
    twelveStep:function(_e,_play){
        var T = _e.tw, step = RIVAL2_TWELVE_STEP[_e.lv] || 2;
        T.fill = Math.min(1, T.fill + 1/(this.beatF()*2));
        if(!_e.onHalf || !_play) return;
        if(T.gather <= 11){
            var p = this.hourAt(_e, T.gather);
            this.spawnClone(_e, p.x, p.y, "stay", { hour:T.gather, wx0:_e.x, wy0:_e.y, next:"stay", warpIn:true });
            fx.line(_e.x, _e.y, p.x, p.y, RIVAL2_GLOW, 2, 14);     //本物のところから光が飛ぶ
            rivalSfx.tick(false);
            T.gather++;
            T.wait = step*2;
            return;
        }
        //並び終えてから少し待つ
        if(T.wait > 0){ T.wait--; return; }
        if(((_e.hb % step) + step) % step != 0) return;
        T.hour++;
        if(T.hour <= 11){
            //その時刻の分身が構えて、1拍あとに突っ込む(撃たれて消えていれば針だけ進む)
            for(var i=0; i<enemies.length; i++){
                var c = enemies[i];
                if(!c.clone || c.owner != _e.id || c.hour != T.hour || c.dead || c.mode != "stay") continue;
                var a = Math.atan2(aimAt.Y - c.y, aimAt.X - c.x);
                c.mode = "aim";
                c.aimX = Math.cos(a); c.aimY = Math.sin(a);
                c.count = Math.min(RIVAL_CUE, Math.round(this.beatF()));
                c.dashT = RIVAL2_TWELVE_DASH_T;
                this.flags(c);
            }
            rivalSfx.tick(T.hour % 3 == 0);
            return;
        }
        //十二時：本物が長く構えて突っ込む(弾き返せば大きなダメージ)
        var a = Math.atan2(aimAt.Y - _e.y, aimAt.X - _e.x);
        _e.mode = "aim";
        _e.final = true;
        _e.aimX = Math.cos(a); _e.aimY = Math.sin(a);
        _e.count = Math.round(this.beatF()*RIVAL2_TWELVE_CUE);
        _e.dashT = RIVAL2_TWELVE_DASH_T;
        rivalSfx.chime();
        fx.ring(_e.x, _e.y, 70, RIVAL2_GLOW, 22, 4);
    },
    //十二時の決闘の時が止まっている間か(本物が並べて突っ込み終えるまで)
    inTwelve:function(_e){
        return _e.mode == "twelve" || (_e.final && (_e.mode == "aim" || _e.mode == "dash")) || (_e.mode == "warp" && _e.next == "twelve");
    },
    //------------------------------------------------------------ 鏡像(第二形態)
    //_slot 番目の映した場所：画面のまんなか(鏡)について、0 左右・1 上下・2 点対称・3 90度回した所(画面の縦横の比に合わせる)
    mirrorAt:function(_slot){
        var cx = CW/2, cy = RIVAL2_MIRROR_CY, hw = CW/2 - 60, hh = CH - 50 - cy;
        var nx = (aimAt.X - cx)/hw, ny = (aimAt.Y - cy)/hh, x, y;
        switch(_slot % 4){
            case 0: x = cx - nx*hw; y = cy + ny*hh; break;
            case 1: x = cx + nx*hw; y = cy - ny*hh; break;
            case 2: x = cx - nx*hw; y = cy - ny*hh; break;
            default: x = cx - ny*hw; y = cy + nx*hh; break;
        }
        //ドローン君に近すぎるときは離す(鏡の近くにいると重なるため)
        var ex = x - aimAt.X, ey = y - aimAt.Y, d = Math.hypot(ex,ey);
        if(d < RIVAL2_MIRROR_GAP){
            var a = d > 1 ? Math.atan2(ey,ex) : -Math.PI/2 + _slot*Math.PI/2;
            x = aimAt.X + Math.cos(a)*RIVAL2_MIRROR_GAP; y = aimAt.Y + Math.sin(a)*RIVAL2_MIRROR_GAP;
        }
        return this.clamp(x,y);
    },
    //1コマ(本物も分身も。_o は本物)：映した場所へついていき、拍ごとに1体ずつ順に、ドローン君へ扇に撃つ。終わったら true
    mirrorStep:function(_e,_o,_play){
        var p = this.mirrorAt(_e.slot || 0);
        var tx = (p.x - _e.x)*0.3, ty = (p.y - _e.y)*0.3, s = Math.hypot(tx,ty), mx = RIVAL2_MIRROR_SPEED;
        if(s > mx){ tx *= mx/s; ty *= mx/s; }
        _e.vx += (tx - _e.vx)*0.4;
        _e.vy += (ty - _e.vy)*0.4;
        var n = RIVAL2_CLONES[_e.lv] + 1, age = RIVAL2_MIRROR_T - _e.count;
        if(_play && _o.onBeat && (_e.slot || 0) == ((_o.bi % n) + n) % n && age > 20 && _e.count > 15){
            this.needles(_e, _e.x, _e.y, Math.atan2(aimAt.Y - _e.y, aimAt.X - _e.x), RIVAL2_MIRROR_N, 0.2, this.shotSpeed());
            sound.play("shot");
        }
        return --_e.count <= 0;
    },
    //------------------------------------------------------------ 時ノ奔流(山場)
    //始める：画面のまんなかへワープする(着いたらカットイン)
    over:function(_e){
        _e.odDue = false;
        _e.chain = 0;
        this.warp(_e, CW/2, RIVAL2_MIRROR_CY, RIVAL_WARP_T[_e.lv], "over");
    },
    //着いた：分身・置いた針を消し、時を止めてカットイン(rival.introStep で進める)
    overStart:function(_e){
        _e.mode = "over";
        _e.count = RIVAL_OD_CUT;
        _e.odDone = (_e.odDone || 0) | (_e.form == 2 ? 2 : 1);
        _e.ov = { ph:"cut", t:0, spin:Math.random()*Math.PI*2, dir:Math.random() < 0.5 ? 1 : -1, sub:null, whirl:0, u:0, fired:[] };
        for(var i=0; i<enemies.length; i++){
            var c = enemies[i];
            if(c.clone && c.owner == _e.id && c.mode != "fade") this.fade(c);
        }
        enemyShots = enemyShots.filter(function(b){ return b.held != _e.id; });
        this.say(_e, RIVAL_OD_LINE);
        this.flags(_e);
        sound.play("timeStop");
        rivalSfx.cut();
    },
    //カットイン中のライバル(この間は時が止まる)
    cutOf:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type == "chrono" && e.mode == "over" && e.ov && e.ov.ph == "cut") return e;
        }
        return null;
    },
    //カットインの1コマ(introStep から)。終わると加速が始まる
    cutStep:function(_e){
        if(--_e.count > 0) return;
        _e.ov.ph = "accel";
        _e.ov.t = 0;
        _e.ov.b0 = null;
        mainScreen.guard = Math.max(mainScreen.guard, 30);
        rivalSfx.riser(RIVAL_OD_ACCEL*60/this.bpm());
        sound.play("timeResume");
    },
    //加速・針の裁きの1コマ(update から)
    overStep:function(_e,_play){
        var O = _e.ov, lv = _e.lv, bf = this.beatF();
        _e.vx *= 0.8; _e.vy *= 0.8;
        if(!O || O.ph == "cut") return;
        O.t++;
        if(O.b0 == null) O.b0 = _e.bt;
        if(O.ph == "accel"){
            //時が速くなる：飛んでいる針が速くなり(rival.timeK)、渦に撃つ間が拍 → 半拍 → 16分と細かくなる
            var u = Math.min(1, Math.max((_e.bt - O.b0)/RIVAL_OD_ACCEL, O.t/(RIVAL_OD_ACCEL*bf*1.6)));
            O.u = u;
            this.timeK = 1 + (RIVAL_OD_KMAX[lv] - 1)*Math.pow(u, 1.5);
            O.whirl += 0.03 + 0.45*u*u;
            var div = u < 1/3 ? 1 : u < 2/3 ? 2 : 4, sub = Math.floor(_e.bt*div);
            if(_play && O.sub != null && sub != O.sub && u < 1) this.overFire(_e, div, sub);
            O.sub = sub;
            if(u >= 1) this.judgeStart(_e);
            return;
        }
        //針の裁き：拍ごとに長針が1目盛り(短針は2拍ごとに逆へ1目盛り)進み、通り道をなぎ払う
        if(_e.onBeat && O.t > 1){
            O.mFrom = O.mTo; O.mTo += O.dir*Math.PI/6; O.msw = 0;
            if(lv >= RIVAL_OD_HOUR_FROM && ((_e.bi % 2) + 2) % 2 == 0){ O.hFrom = O.hTo; O.hTo -= O.dir*Math.PI/6; O.hsw = 0; }
            rivalSfx.tick(this.downbeat(_e));
            if(O.armed) fx.shake(3);
        }
        O.msw++; O.hsw++;
        var m = this.handAngle(O.mFrom, O.mTo, O.msw, bf), h = this.handAngle(O.hFrom, O.hTo, O.hsw, bf);
        if(_play && O.armed){
            this.beamHit(_e, O.m, m);
            if(lv >= RIVAL_OD_HOUR_FROM) this.beamHit(_e, O.h, h);
        }
        O.m = m; O.h = h;
        if(!O.armed && O.t >= Math.round(bf)){ O.armed = true; sound.play("beam"); }
        if(_e.bt - O.b0 >= RIVAL_OD_JUDGE || O.t > RIVAL_OD_JUDGE*bf*1.6) this.snap(_e);
    },
    //渦に針を撃つ(_div：1拍に撃つ回数)
    overFire:function(_e,_div,_sub){
        var O = _e.ov, n = RIVAL_OD_ARMS[_e.lv], sp = RIVAL_OD_SPEED*Math.min(1.3,danmaku());
        for(var i=0; i<n; i++){
            var a = O.spin + i*Math.PI*2/n;
            this.needles(_e, _e.x, _e.y, a, 1, 0, sp);
            O.fired.push({ x:_e.x, y:_e.y, a:a, sp:sp });     //巻き戻すときに、出ていった所から戻す
        }
        O.spin += O.dir*RIVAL_OD_SPIN*(_div == 4 ? 0.6 : 1);
        rivalSfx.tick(((_sub % _div) + _div) % _div == 0);
    },
    //針の裁きを始める：時の速さが戻り、光の針が現れる(はじめの1拍は予告で当たらない)
    judgeStart:function(_e){
        var O = _e.ov, toMe = Math.atan2(aimAt.Y - _e.y, aimAt.X - _e.x);
        O.ph = "judge";
        O.t = 0;
        O.b0 = _e.bt;
        O.armed = false;
        //長針はドローン君の向きから4目盛り離れた所から、短針はその反対から
        O.mTo = O.mFrom = Math.round((toMe - O.dir*Math.PI*2/3)/(Math.PI/6))*Math.PI/6;
        O.hTo = O.hFrom = O.mTo + Math.PI;
        O.msw = O.hsw = 999;
        O.m = O.mTo; O.h = O.hTo;
        this.timeK = 1;
        fx.flare(_e.x, _e.y, 160, "255,255,255", 18);
        fx.ring(_e.x, _e.y, RIVAL_OD_FACE_R, RIVAL_TIME, 24, 5);
        fx.shake(12);
        sound.play("bossImpact");
        rivalSfx.chime();
    },
    //針の角度(_sw：進み始めてからのフレーム。少し行きすぎずに、すっと止まる)
    handAngle:function(_from,_to,_sw,_bf){
        var u = Math.min(1, _sw/(RIVAL_OD_SWEEP*_bf)), e = 1 - Math.pow(1 - u, 3);
        return _from + (_to - _from)*e;
    },
    //光の針の当たり：前のコマの角度 _a0 から今の角度 _a1 までになぎ払った所に、ドローン君(自分)がいれば被弾
    beamHit:function(_e,_a0,_a1){
        var dx = drone.X - _e.x, dy = drone.Y - _e.y, r = Math.hypot(dx,dy);
        if(r < 24) return;
        var w = Math.atan2(RIVAL_OD_BEAM_W + dodge.core(), r), rel = Math.atan2(dy,dx) - _a0, span = _a1 - _a0;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        var hit = span >= 0 ? rel >= -w && rel <= span + w : rel <= w && rel >= span - w;
        if(hit && mainScreen.canBeHit()) mainScreen.damage();
    },
    //時が巻き戻る：加速の間に撃った針が、画面から出ていった所に現れて、来た道を逆にまんなかへ戻る(四方から渦を巻いて集まる)。
    //戻りきった針は消える。クロノは疲れて長い隙(よろける)
    snap:function(_e){
        var F = _e.ov.fired, k = RIVAL_OD_BACK;
        enemyShots = enemyShots.filter(function(b){ return b.kind != "chrono" || b.held; });
        for(var i=0; i<F.length; i++){
            var f = F[i], cx = Math.cos(f.a), cy = Math.sin(f.a);
            var tx = cx > 0 ? (CW + 8 - f.x)/cx : cx < 0 ? (-8 - f.x)/cx : 1e9;
            var ty = cy > 0 ? (CH + 8 - f.y)/cy : cy < 0 ? (-8 - f.y)/cy : 1e9;
            var t = Math.min(tx, ty), sp = f.sp*k;
            fireShot(f.x + cx*t, f.y + cy*t, f.a + Math.PI, sp, "chrono");
            var b = enemyShots[enemyShots.length - 1];
            b.cr = _e.id;
            b.rewT = RIVAL2_REWIND_TRAIL;
            b.die = Math.max(1, Math.round((t - 20)/sp));      //まんなかの手前で消える
        }
        _e.ov = null;
        this.timeK = 1;
        _e.rewFx = 30;
        _e.mode = "stagger";
        _e.count = RIVAL_OD_TIRED;
        _e.chain = 0;
        _e.look.setFace("dizzy", RIVAL_OD_TIRED);
        this.say(_e, RIVAL_OD_TIRED_LINE);
        this.flags(_e);
        fx.flare(_e.x, _e.y, 120, RIVAL2_GLOW, 16);
        sound.play("timeResume");
        rivalSfx.rewind();
    },
    //------------------------------------------------------------ 動き回る・ワープ
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
        _e.dashT = 0;
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
            case "idle":
                _e.mode = "idle";
                _e.timer = this.restTime(_e);
                break;
            case "shoot":
                _e.mode = "shoot";
                _e.count = RIVAL_SHOOT_T;
                break;
            case "echo":
                this.echoStart(_e);
                break;
            case "clock":
                this.clockStart(_e);
                break;
            case "twelve":
                _e.mode = "twelve";
                sound.play("timeStop");
                break;
            case "mirror":
                _e.mode = "mirror";
                _e.count = RIVAL2_MIRROR_T;
                break;
            case "over":
                this.overStart(_e);
                break;
            case "waltz":
                _e.mode = "waltz";
                _e.count = RIVAL2_WALTZ_T;
                break;
            case "rewind":
                _e.mode = "rewind";
                _e.rings = RIVAL2_REWIND_RINGS[_e.lv];
                _e.dh = [];
                _e.count = Math.round((_e.rings + 3)*this.beatF()*1.6);     //曲が止まっても終わるように
                break;
            case "aim":
            case "chain":
                _e.mode = "aim";
                _e.count = randIn(_e.next == "chain" ? RIVAL_CHAIN_AIM : RIVAL_DASH_AIM) + RIVAL_CUE;
                var a = Math.atan2(aimAt.Y - _e.y, aimAt.X - _e.x);
                _e.aimX = Math.cos(a); _e.aimY = Math.sin(a);
                break;
            case "blink":
                //時止め：止まった針を置いていく。跳び終えたら、時が止まったまま隙を見せる
                this.plant(_e);
                if(--_e.blinks > 0) this.blink(_e);
                else{
                    _e.mode = "hold";
                    _e.count = RIVAL_HOLD_T;
                    _e.stopT = RIVAL_HOLD_T;
                    sound.play("timeStop");
                }
                break;
            default:
                //知らない攻撃(取りやめた攻撃の名前など)は、動き回るに戻る
                _e.mode = "idle";
                _e.timer = this.restTime(_e);
                break;
        }
    },
    //攻撃を終えて動き回る
    rest:function(_e){
        _e.mode = "idle";
        _e.timer = this.restTime(_e);
        _e.hpMark = _e.hp;
        _e.dashT = 0;
        _e.since12++;
    },
    //攻撃のあと、次の攻撃まで(第二形態は RIVAL2_REST)
    restTime:function(_e){
        return (_e.form == 2 ? RIVAL2_REST : RIVAL_REST)[_e.lv][_e.enraged ? 1 : 0];
    },
    nextAttack:function(_e){
        //十二時の決闘：第二形態で本気になってから、決まった数の攻撃ごとに
        if(_e.odDue){ this.over(_e); return; }
        if(_e.form == 2 && _e.enraged && _e.since12 >= RIVAL2_TWELVE_EVERY){ this.twelve(_e); return; }
        var list = (_e.form == 2 ? RIVAL2_PATTERNS : RIVAL_PATTERNS)[_e.lv], p = list[_e.cycle++ % list.length];
        if(p == "mirror" || p == "waltz"){
            this.surround(_e, p);
        }else if(p == "rewind"){
            //時戻し：弾が画面の外へ出て戻らなくならないよう、画面のまんなか寄りで使う(ドローン君に近すぎなければ)
            var s = this.spot(_e, RIVAL_DIST), c = { x:(s.x + CW/2)/2, y:(s.y + CH/2 + 30)/2 };
            if(Math.hypot(c.x - aimAt.X, c.y - aimAt.Y) >= RIVAL_DIST[0]*0.7) s = c;
            this.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "rewind");
        }else if(p == "clock"){
            //時計盤：文字盤が画面に収まるよう、まんなか寄りで
            var s = this.spot(_e, RIVAL_DIST);
            s = { x:Math.max(RIVAL_CLOCK_R + 20, Math.min(CW - RIVAL_CLOCK_R - 20, s.x)), y:Math.max(RIVAL_CLOCK_R + 10, Math.min(CH - RIVAL_CLOCK_R - 10, s.y)) };
            this.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "clock");
        }else if(p == "shoot" || p == "echo"){
            var s = this.spot(_e, RIVAL_DIST);
            this.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], p);
        }else if(p == "dash"){
            _e.chain = RIVAL_CHAIN[_e.lv];
            var s = this.spot(_e, RIVAL_DASH_DIST);
            this.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "aim");
        }else{
            //時止め：今のドローン君の位置を囲むように跳ぶ
            _e.blinks = RIVAL_PHANTOM_N[_e.lv];
            _e.pa = Math.random()*Math.PI*2;
            _e.pcx = aimAt.X; _e.pcy = aimAt.Y;
            _e.pi = 0;
            _e.marks = [];
            this.blink(_e);
        }
    },
    //------------------------------------------------------------ 分身(第二形態)
    //鏡像(mirror)・分身の輪舞(waltz)：本物と分身がひとつの場所から散って現れる(鏡像はドローン君を映した場所、輪舞はドローン君を囲む輪)。
    //どれが本物かは毎回変わる(本物を当てて撃つ。分身は少し撃てば消える)
    surround:function(_e,_kind){
        var n = RIVAL2_CLONES[_e.lv] + 1, real = Math.floor(Math.random()*n), a0 = Math.random()*Math.PI*2;
        var R = RIVAL2_WALTZ_R[0], gap = Math.round(this.beatF());
        _e.chain = 0;
        var me = { x:_e.x, y:_e.y };
        for(var i=0; i<n; i++){
            var a = a0 + i*Math.PI*2/n;
            var p = _kind == "mirror" ? this.mirrorAt(i) : this.clamp(aimAt.X + Math.cos(a)*R, aimAt.Y + Math.sin(a)*R*0.8);
            //wcx・wcy：分身の輪舞の輪のまんなか(始めたときのドローン君の位置)
            var o = { orbit:a, slot:i, delay:i*gap, wcx:aimAt.X, wcy:aimAt.Y };
            if(i == real){
                this.warp(_e, p.x, p.y, RIVAL_WARP_T[_e.lv], _kind);
                for(var k in o) _e[k] = o[k];
            }else{
                o.wx0 = me.x; o.wy0 = me.y;
                this.spawnClone(_e, p.x, p.y, _kind, o);
            }
        }
    },
    //分身を出す(_next：現れたあとにすること。"stay" はその場に置き去り、"wait" は出番を待つ残響)
    spawnClone:function(_o,_x,_y,_next,_opt){
        var hp = Math.max(1, Math.round(_o.maxHp*RIVAL2_CLONE_HP));
        var first = _next == "stay" || _next == "wait" ? _next : "warp";
        var c = {
            id:++enemySeq,
            type:"chronoClone", clone:true, mid:true, owner:_o.id, lv:_o.lv, name:"分身", glow:WARP_COLOR,
            r:RIVAL_R, hp:hp, maxHp:hp, score:0, parts:0,
            x:_x, y:_y, vx:0, vy:0, flash:0, timer:0, t:_o.t, dead:false, slow:0, bladeCd:0,
            aimX:0, aimY:1, orbit:0, stepT:randIn(RIVAL_STEP_T), slot:0, delay:0,
            mode:first, count:first == "warp" ? RIVAL_WARP_T[_o.lv] : 0, next:_next
        };
        for(var k in _opt) c[k] = _opt[k];
        //十二時の決闘の分身は、本物のところから光になって飛んでくる
        if(c.warpIn){ c.mode = "warp"; c.count = c.wt = RIVAL_BLINK_T; }
        c.look = new DroneLook();
        c.look.tint = c.echo ? RIVAL_TINT : RIVAL2_TINT;
        c.look.setMood("fierce");
        this.flags(c);
        enemies.push(c);
        return c;
    },
    fade:function(_c){
        _c.mode = "fade";
        _c.count = RIVAL2_FADE_T;
        this.flags(_c);
    },
    //分身の動き(special.update から。動かすのはホストとひとり用だけ)
    cloneUpdate:function(_c,_dx,_dy,_d){
        var o = null;
        for(var i=0; i<enemies.length; i++) if(enemies[i].id == _c.owner) o = enemies[i];
        //本物が去る・いない・目覚め直す間は消える
        if(_c.mode != "fade" && (!o || o.dead || o.mode == "flee" || o.mode == "awaken")) this.fade(_c);
        _c.enraged = !!(o && o.enraged);     //本物が本気なら分身も(撃つ間隔)
        var play = mainScreen.state == "play";
        _c.mvx = 0; _c.mvy = 0;
        switch(_c.mode){
            case "warp":
                _c.vx = 0; _c.vy = 0;
                if(--_c.count <= 0){
                    fx.ring(_c.x, _c.y, 56, _c.hour ? RIVAL2_GLOW : WARP_COLOR, 16, 3);
                    if(_c.next == "waltz"){ _c.mode = "waltz"; _c.count = RIVAL2_WALTZ_T; }
                    else if(_c.next == "mirror"){ _c.mode = "mirror"; _c.count = RIVAL2_MIRROR_T; }
                    else if(_c.next == "stay") _c.mode = "stay";
                    else this.fade(_c);     //知らない攻撃(取りやめた攻撃の名前など)は消える
                }
                break;
            case "wait":
                //出番を待つ残響：突進の残響は決まった時間、過去の自分は通った道がたまるまで
                _c.vx = 0; _c.vy = 0;
                if(_c.next == "dash"){
                    if(--_c.wait <= 0){
                        _c.mode = "dash";
                        _c.count = RIVAL_DASH_T;
                        sound.play("dash");
                    }
                }else if(++_c.hi >= 0){
                    _c.mode = "echo";
                }
                break;
            case "echo":
                if(this.echoReplay(_c, play)) this.fade(_c);
                break;
            case "waltz":
                if(this.waltzStep(_c, o || _c, play)) this.fade(_c);
                break;
            case "mirror":
                if(this.mirrorStep(_c, o || _c, play)) this.fade(_c);
                break;
            case "aim":
                this.aimStep(_c,_dx,_dy,_d);
                break;
            case "dash":
                if(this.dashStep(_c)) this.fade(_c);
                break;
            case "stay":
                _c.vx *= 0.85; _c.vy *= 0.85;
                //十二時の決闘の分身は、本物が決闘をやめたら消える
                if(_c.hour && o && !this.inTwelve(o)) this.fade(_c);
                break;
            case "fade":
                _c.vx *= 0.9; _c.vy *= 0.9;
                if(--_c.count <= 0) _c.dead = true;
                break;
        }
        _c.look.update(dirFromVel(_c.vx + _c.mvx, _c.vy + _c.mvy), _c.vx + _c.mvx, _c.vy + _c.mvy);
        this.flags(_c);
    },
    //分身の突進をジャスト衝撃波で弾いた：分身は砕ける(mainScreen.counter から)
    parryClone:function(_c){
        if(_c.mode != "dash") return;
        fx.flare(_c.x, _c.y, 40, JUST_COLOR, 12);
        this.shatter(_c, JUST_COLOR);
        popup(_c.x, _c.y - _c.r - 10, "カウンター！", "rgb(30,150,200)");
        mainScreen.hitEnemy(_c, _c.maxHp*10, "counter");
    },
    //分身が倒された(special.onKill から)
    cloneKilled:function(_c){
        fx.flare(_c.x, _c.y, 50, _c.echo ? WARP_COLOR : RIVAL2_GLOW, 14);
        this.shatter(_c, _c.echo ? WARP_COLOR : RIVAL2_GLOW);
        if(!_c.echo) popup(_c.x, _c.y - _c.r - 6, "分身だ！", "rgb(110,70,190)");
        sound.play("blink");
    },
    //分身が砕ける：ガラスのかけら(細長い三角)が飛び散る
    shatter:function(_c,_color){
        for(var i=0; i<10; i++){
            var a = Math.random()*Math.PI*2, s = 2 + Math.random()*5;
            effects.push({ x:_c.x, y:_c.y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:18 + Math.random()*12, maxLife:30,
                           size:2 + Math.random()*2.5, glow:_color });
        }
        fx.ring(_c.x, _c.y, 46, _color, 12, 2);
    },
    //------------------------------------------------------------ 時止め
    //次の場所へ短くワープ(囲む円の上を、ドローン君の向こう側へ飛び越えるように跳ぶ)
    blink:function(_e){
        var n = RIVAL_PHANTOM_N[_e.lv], k = _e.pi++;
        var idx = n == 4 ? [0,2,1,3][k] : (k*2) % n;
        var a = _e.pa + idx*Math.PI*2/n;
        var p = this.clamp(_e.pcx + Math.cos(a)*RIVAL_PHANTOM_R, _e.pcy + Math.sin(a)*RIVAL_PHANTOM_R*0.85);
        this.warp(_e, p.x, p.y, RIVAL_BLINK_T, "blink");
    },
    //止まった針を、自分のまわりに輪にして置く(跳んだ場所を覚えて、線でつなぐ)
    plant:function(_e){
        for(var i=0; i<RIVAL_PHANTOM_SHOTS; i++){
            var a = _e.t*0.1 + i*Math.PI*2/RIVAL_PHANTOM_SHOTS;
            fireShot(_e.x + Math.cos(a)*22, _e.y + Math.sin(a)*22, 0, 0, "chrono");
            var b = enemyShots[enemyShots.length - 1];
            b.held = _e.id; b.cr = _e.id; b.ang = a;
        }
        if(_e.marks) _e.marks.push({ x:_e.x, y:_e.y });
        rivalSfx.tick(false);
        //第二形態：跳んだ跡に分身が残る(時が動き出すと消える)
        if(_e.form == 2 && _e.blinks > 1) this.spawnClone(_e, _e.x, _e.y, "stay", {});
    },
    //時が動き出す：置いた針が、それぞれドローン君へ飛ぶ
    release:function(_e){
        var sp = RIVAL_RELEASE_SPEED*Math.min(1.3,danmaku());
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.held != _e.id) continue;
            var t = nearestPlayer(b.x,b.y), a = Math.atan2(t.Y - b.y, t.X - b.x);
            b.vx = Math.cos(a)*sp; b.vy = Math.sin(a)*sp;
            b.held = 0;
            b.popT = 12;
        }
        //跳んだ跡に残った分身は消える
        for(var i=0; i<enemies.length; i++){
            var c = enemies[i];
            if(c.clone && c.owner == _e.id && c.mode == "stay" && !c.hour) this.fade(c);
        }
        _e.relT = 24;
        _e.marks = null;
        fx.ring(_e.x, _e.y, 120, WARP_COLOR, 20, 4);
        sound.play("timeResume");
        rivalSfx.tick(true);
    },
    //------------------------------------------------------------ 弾かれる・撃退
    //突進をジャスト衝撃波で弾かれた(special.parry から)。十二時の決闘の本物は大きなダメージ
    parry:function(_e){
        if(_e.mode != "dash") return;
        var big = _e.final;
        _e.mode = "stagger";
        _e.count = big ? RIVAL2_TWELVE_STAGGER : RIVAL_STAGGER;
        _e.chain = 0;
        _e.final = false;
        _e.dashT = 0;
        this.flags(_e);
        _e.vx = -_e.aimX*(big ? 10 : 7); _e.vy = -_e.aimY*(big ? 10 : 7);
        _e.flash = 10;
        _e.look.setFace(big ? "dizzy" : "hurt", big ? 90 : 40);
        fx.flare(_e.x, _e.y, big ? 90 : 50, JUST_COLOR, big ? 20 : 14);
        fx.sparks(_e.x, _e.y, big ? 28 : 16, JUST_COLOR, 8, 3);
        if(big){
            fx.ring(_e.x, _e.y, 160, "255,255,255", 26, 4);
            fx.shake(14);
            rivalSfx.chime();
            popup(_e.x, _e.y - _e.r - 10, "決闘を制した！", "rgb(30,150,200)", true);
        }else{
            popup(_e.x, _e.y - _e.r - 10, "カウンター！", "rgb(30,150,200)");
        }
        mainScreen.hitEnemy(_e, _e.maxHp*(big ? RIVAL2_TWELVE_DMG : RIVAL_PARRY_DMG), "counter");
        _e.hpMark = _e.hp;
    },
    //体力が0になった：倒れずに、捨てぜりふを残して去る(special.revive から。true で倒さない)
    retreat:function(_e){
        //WAVE8から：第一形態は倒れず、第二形態に目覚める
        if(_e.lv >= RIVAL2_FROM && (_e.form || 1) == 1) return this.awaken(_e);
        if(_e.mode == "awaken") return true;
        _e.hp = 0;
        _e.mode = "flee";
        _e.count = RIVAL_FLEE_T;
        _e.chain = 0;
        _e.final = false;
        _e.ov = null;
        this.timeK = 1;
        this.pull = null;
        this.flags(_e);
        this.muffle(false);
        _e.look.setFace("dizzy", RIVAL_FLEE_T);
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
        if(on){ this.songFrom(0); sound.music("rival"); return; }
        this.muffle(false);
        //まだ雑魚敵が残っていれば元の曲へ(いなければすぐにWAVEクリアになる)
        var rest = mainScreen.toSpawn > 0 || enemies.some(function(e){ return !e.dead && e.type != "chrono"; });
        if(rest) sound.battleMusic();
        else sound.stopMusic();
    },

    //------------------------------------------------------------------ 弾(shotLab.step・draw から)
    //クロノの針の1コマ(ホストとひとり用)：止まっている針はドローン君の方を指し、戻ってくる針の残像を減らす。
    //時ノ奔流で巻き戻った針は、戻りきったら消える(true)
    stepShot:function(b){
        if(b.kind != "chrono") return false;
        //時ノ奔流の加速：飛んでいる針が速くなる(mainScreen.updateShots が1倍分を動かすので、残りを足す)
        if(this.timeK != 1 && !b.held && !coop.isGuest()){ b.x += b.vx*(this.timeK - 1); b.y += b.vy*(this.timeK - 1); }
        if(b.popT > 0) b.popT--;
        if(b.rewT > 0) b.rewT = Math.max(b.die ? 12 : 0, b.rewT - 1);    //戻ってくる針は、消えるまで残像を引く
        if(b.die != null && !coop.isGuest() && --b.die <= 0){ fx.flare(b.x, b.y, 14, RIVAL_TIME, 8); return true; }
        if(b.held && !coop.isGuest() && !b.rew){
            var t = nearestPlayer(b.x,b.y);
            b.ang = turnTo(b.ang || 0, Math.atan2(t.Y - b.y, t.X - b.x), 0.15);
        }
        return false;
    },
    //クロノの針の絵：細長いひし形(赤・黒いふち・白い芯)。止まっている針は時計の目盛りの輪を付け、動き出す瞬間に輪がはじける。
    //戻ってくる針は、来た道に水色の残像を引く
    drawShot:function(b){
        if(b.kind != "chrono") return false;
        var moving = b.vx || b.vy, a = moving ? Math.atan2(b.vy,b.vx) : (b.ang || 0);
        ctx.save();
        if(b.rewT > 0){
            var k = b.rewT/RIVAL2_REWIND_TRAIL;
            for(var i=3; i>=1; i--){
                ctx.globalAlpha = 0.28*k*(1 - i/4);
                this.needle(b.x - b.vx*i*3.2, b.y - b.vy*i*3.2, a, "rgb(" + RIVAL2_TIME + ")", 1);
            }
            ctx.globalAlpha = 1;
        }
        if(b.held){
            //止まった針：目盛りの輪(時が止まっている印)
            ctx.translate(b.x, b.y);
            ctx.strokeStyle = "rgba(26,20,32,0.35)";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "rgb(" + RIVAL_TIME + ")";
            ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.stroke();
            for(var i=0; i<4; i++){
                var t = i*Math.PI/2;
                ctx.beginPath(); ctx.moveTo(Math.cos(t)*10, Math.sin(t)*10); ctx.lineTo(Math.cos(t)*13, Math.sin(t)*13); ctx.stroke();
            }
            ctx.translate(-b.x, -b.y);
        }
        if(b.popT > 0){
            //動き出した瞬間：目盛りの輪がはじける
            var u = 1 - b.popT/12;
            ctx.strokeStyle = "rgba(" + RIVAL_TIME + "," + (0.8*(1 - u)) + ")";
            ctx.lineWidth = 2*(1 - u) + 0.5;
            ctx.beginPath(); ctx.arc(b.x, b.y, 10 + 14*u, 0, Math.PI*2); ctx.stroke();
        }
        this.needle(b.x, b.y, a, RIVAL_SCARF, 1);
        ctx.restore();
        ctx.lineWidth = 1;
        return true;
    },
    //針の形(_color の塗り・黒いふち・白い芯)
    needle:function(_x,_y,_a,_color,_k){
        ctx.save();
        ctx.translate(_x,_y);
        ctx.rotate(_a);
        ctx.scale(_k,_k);
        ctx.beginPath();
        ctx.moveTo(9.5,0); ctx.lineTo(0,-3.8); ctx.lineTo(-7,0); ctx.lineTo(0,3.8); ctx.closePath();
        ctx.fillStyle = _color; ctx.fill();
        ctx.lineJoin = "round";
        ctx.lineWidth = 1.6; ctx.strokeStyle = RIVAL_INK; ctx.stroke();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(5.5,0); ctx.lineTo(-3,0); ctx.stroke();
        ctx.restore();
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
        this.awakenFx(_e);
        //せりふ：現れたとき・本気になったとき・去るとき
        if(!_e.said0 && _e.mode != "warp" && !(_e.mode == "intro" && this.introAge(_e) < RIVAL_INTRO_ARRIVE + 10)){ _e.said0 = true; this.say(_e, RIVAL_LINES[lv][0]); }
        if(!_e.said1 && _e.enraged && _e.mode != "flee" && _e.form != 2){ _e.said1 = true; this.say(_e, RIVAL_LINES[lv][1]); }
        //第二形態：目覚めたとき・本気になったとき
        if(!_e.saidA && _e.mode == "awaken" && this.awakenAge(_e) >= RIVAL2_SPLIT_AT + 10){ _e.saidA = true; this.say(_e, RIVAL2_LINES[0]); }
        if(!_e.said3 && _e.enraged && _e.form == 2 && _e.mode != "flee" && !this.inTwelve(_e)){ _e.said3 = true; this.say(_e, RIVAL2_LINES[1]); }
        if(!_e.said2 && _e.mode == "flee"){ _e.said2 = true; this.say(_e, RIVAL_LINES[lv][2]); }
        if(_e.sayT > 0) _e.sayT--;
        if(_e.arrT > 0) _e.arrT--;
        if(_e.relT > 0) _e.relT--;
        if(_e.rewFx > 0) _e.rewFx--;
        if(_e.tickT > 0) _e.tickT = Math.max(0, _e.tickT - 0.08);
        //残像(速く動いている間)。速さは位置の変化から(過去の自分は位置で動くため)
        if(!_e.trail) _e.trail = [];
        var p = _e.trail[0];
        _e.spd = p ? Math.hypot(_e.x - p.x, _e.y - p.y) : 0;
        _e.trail.unshift({ x:_e.x, y:_e.y });
        if(_e.trail.length > 10) _e.trail.pop();
    },
    say:function(_e,_text){
        _e.sayText = _text;
        _e.sayT = RIVAL_SAY_T;
    },
    //体を出すか(ワープ中・ほどけて消えるところは出さない)
    shown:function(_e){
        return _e.mode != "warp" && !(_e.mode == "flee" && _e.count <= RIVAL_FLEE_OUT)
            && !(_e.mode == "intro" && this.introAge(_e) < RIVAL_INTRO_ARRIVE);
    },
    //見た目の拍(描画用。曲が鳴っていなければ敵の時刻から。協力プレイのゲストも同じに見える)
    viewBeat:function(_e){
        var m = this.musicBeat();
        return m != null ? m : (_e.bf || _e.t || 0)*RIVAL_BPM/3600;
    },

    //体(translate済み。special.draw から)
    draw:function(_e,_body){
        if((_e.mode == "intro" || _e.mode == "awaken") && !this.onTop) return;    //登場・目覚めの演出の間は、止まった世界の上に描く(rival.drawIntro)
        if(this.shown(_e)){
            ctx.save();
            //撃退されたあとは傾いて震える
            if(_e.mode == "flee"){
                ctx.rotate(0.35*Math.min(1, (RIVAL_FLEE_T - _e.count)/20));
                ctx.translate((Math.random() - 0.5)*2, 0);
            }
            //目覚める前：撃たれて吹き飛んで倒れ、明滅する → 時が止まってから起き上がる
            if(_e.mode == "awaken" && !this.second(_e)){
                var P = this.awakenPose(_e);
                ctx.translate(P.dx, P.dy);
                ctx.rotate(P.rot);
                if(this.awakenAge(_e) < RIVAL2_STOP_AT && Math.random() < 0.2) ctx.globalAlpha = 0.5;
            }
            //よろけている間は回る
            if(_e.mode == "stagger") ctx.rotate(Math.sin(_e.count*0.5)*0.4);
            this.drawBody(_e, _body, ctx.globalAlpha);
            ctx.restore();
        }
        if(_e.sayT > 0) this.drawSay(_e);
    },
    //体：背中の文字盤・ハチマキの端・ドローン君の絵・ハチマキ・合図の光(translate済み。第二形態と分身は紫がかった色)
    drawBody:function(_e,_body,_alpha){
        var k = RIVAL_SCALE, f2 = (_e.clone && !_e.echo) || this.second(_e);
        _e.look.tint = _e.echo ? RIVAL_TINT : f2 ? RIVAL2_TINT : RIVAL_TINT;
        ctx.globalAlpha = _alpha;
        enemyArt.halo(0, 0, 30 + Math.sin(_e.t*0.12)*2, f2 ? RIVAL2_GLOW : WARP_COLOR, (_e.mode == "hold" || _e.mode == "rstop") ? 0.5 : 0.18);
        if(!_e.clone || _e.mode != "fade") this.drawDial(_e, f2, _alpha);
        this.drawBand(_e, k, false);
        if(_body) ctx.globalAlpha = _alpha*0.6;
        _e.look.draw(0, 0, k);
        ctx.globalAlpha = _alpha;
        this.drawBand(_e, k, true);
        this.drawGlint(_e, k, _alpha);
        ctx.globalAlpha = 1;
    },
    //背中の文字盤：細い輪と12の目盛り。拍ごとに秒針が1目盛り進み(少し行きすぎて止まる)、その目盛りが光る。
    //小節の頭で輪が脈打つ。第二形態は外にもう1つ点線の輪が逆へ回り、秒針は逆向きに進む(時を戻す力)
    drawDial:function(_e,_f2,_alpha){
        var b = this.viewBeat(_e), bi = Math.floor(b), fr = b - bi, down = ((bi % 4) + 4) % 4 == 0;
        var pulse = Math.exp(-fr*7)*(down ? 1 : 0.4), R = DIAL_R*(1 + 0.07*pulse);
        var col = _f2 ? RIVAL2_TIME : RIVAL_TIME, dir = _f2 ? -1 : 1;
        var u = Math.min(1, fr/DIAL_TICK), ease = 1 - Math.pow(1 - u, 3) + 0.18*Math.sin(Math.PI*u)*(1 - u);
        var hand = -Math.PI/2 + dir*(bi - 1 + ease)*Math.PI/6, lit = (((bi*dir) % 12) + 12) % 12;
        ctx.save();
        ctx.lineCap = "round";
        //暗い下地の上に色の線(明るい背景でも見える)
        var A = 0.4 + 0.5*pulse;
        for(var pass=0; pass<2; pass++){
            ctx.strokeStyle = pass ? "rgba(" + col + "," + A + ")" : "rgba(26,20,32,0.18)";
            ctx.lineWidth = pass ? 1.2 : 3;
            ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.stroke();
            //目盛り：三時・六時・九時・十二時は外へ短い線、ほかは輪の上の点
            for(var i=0; i<12; i += 3){
                var t = -Math.PI/2 + i*Math.PI/6;
                ctx.beginPath(); ctx.moveTo(Math.cos(t)*(R + 1.5), Math.sin(t)*(R + 1.5)); ctx.lineTo(Math.cos(t)*(R + 7), Math.sin(t)*(R + 7)); ctx.stroke();
            }
            //秒針(体の外の輪の上を回る短い針と、反対の小さな重り)
            ctx.beginPath();
            ctx.moveTo(Math.cos(hand)*(R - 7), Math.sin(hand)*(R - 7));
            ctx.lineTo(Math.cos(hand)*(R + 11), Math.sin(hand)*(R + 11));
            ctx.stroke();
        }
        ctx.fillStyle = "rgba(" + col + "," + A + ")";
        for(var i=0; i<12; i++){
            if(i % 3 == 0 && i != lit) continue;
            var t = -Math.PI/2 + i*Math.PI/6, lt = i == lit;
            ctx.fillStyle = lt ? "rgba(255,255,255," + (0.7 + 0.3*pulse) + ")" : "rgba(" + col + "," + A + ")";
            ctx.beginPath(); ctx.arc(Math.cos(t)*R, Math.sin(t)*R, lt ? 2.4 : 1.3, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = "rgb(" + col + ")";
        ctx.beginPath(); ctx.arc(Math.cos(hand)*(R + 11), Math.sin(hand)*(R + 11), 2.2, 0, Math.PI*2); ctx.fill();
        if(_f2){
            //外の点線の輪(逆へ回る)
            ctx.setLineDash([3,7]);
            ctx.lineDashOffset = -b*6;
            ctx.strokeStyle = "rgba(" + col + ",0.45)";
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(0,0,R + 16 + 2*pulse,0,Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
        ctx.globalAlpha = _alpha;
        ctx.lineWidth = 1;
    },
    //突進の合図の光：ハチマキの結び目に星のきらめき(十二時の決闘の本物は大きく白く)
    drawGlint:function(_e,_k,_alpha){
        if(_e.mode != "aim" || _e.count > RIVAL_CUE) return;
        var u = 1 - _e.count/RIVAL_CUE, s = (_e.final ? 16 : 10)*(0.4 + 0.6*Math.sin(Math.PI*Math.min(1, u*1.4)));
        var side = Math.cos(_e.scarfA || 0) >= 0 ? 1 : -1;
        ctx.save();
        ctx.translate(side*(RIVAL_BAND_W - 1)*_k, RIVAL_BAND_Y*_k);
        ctx.rotate(u*1.2);
        ctx.globalAlpha = _alpha;
        ctx.fillStyle = _e.final ? "#fff" : "rgb(255,235,235)";
        ctx.strokeStyle = RIVAL_SCARF;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for(var i=0; i<8; i++){
            var r = i % 2 ? s*0.18 : s, t = i*Math.PI/4;
            ctx.lineTo(Math.cos(t)*r, Math.sin(t)*r);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
    },
    //分身(translate済み。special.draw から)：
    //  ミラージュの分身は本物と同じ姿(ときどきちらつく)。残響(echo)は時のずれた影：赤と水色にずれた光の形を重ね、体は薄い
    drawClone:function(_c,_body){
        var a = 1;
        if(_c.mode == "warp") a = 1 - _c.count/(_c.wt || RIVAL_WARP_T[_c.lv || 0]);
        if(_c.mode == "fade") a = _c.count/RIVAL2_FADE_T;
        if(_c.mode == "stay") a = _c.hour ? 0.85 : 0.7;
        if(_c.mode == "wait") a = 0.35;
        if(!_c.echo && (_c.t + _c.id*13) % RIVAL2_FLICKER < 4) a *= 0.45;
        //突進の構え：本物と同じ予告
        if(_c.mode == "aim") this.drawLane(0, 0, _c.aimX, _c.aimY, _c.count <= RIVAL_CUE ? 1 - _c.count/RIVAL_CUE : 0, _c.t, _c.hour ? RIVAL2_TIME : RIVAL_TIME);
        //残響突進の出番待ち：これから通る道を薄く
        if(_c.mode == "wait" && _c.next == "dash") this.drawLane(0, 0, _c.aimX, _c.aimY, 0, _c.t, RIVAL_TIME, 0.5);
        if(_c.echo){
            this.drawEcho(_c, _body, Math.max(0, a));
        }else{
            this.drawBody(_c, _body, Math.max(0, a));
        }
        //十二時の決闘：時刻の数字
        if(_c.hour && _c.mode != "fade") this.drawNumeral(_c.hour, 0, -36, a);
    },
    //残響(さっきの自分)：体は薄く、赤と水色の光の形を左右へずらして重ねる。出番待ちは時計の針が回って出番を数える
    drawEcho:function(_c,_body,_a){
        if(!_c.wfx){ _c.wfx = new RivalWarp(RIVAL_SCALE); }
        if(!_c.wfx.snap || _c.t % 20 == 0) _c.wfx.shoot(_c.look);
        var W = _c.wfx, j = 2.5 + (_c.mode == "dash" ? 2 : 0) + Math.sin(_c.t*0.7)*0.8;
        W.drawGlow(-j, 0, 0.35*_a, RIVAL_RED);
        W.drawGlow(j, 0, 0.45*_a, RIVAL_TIME);
        ctx.globalAlpha = 0.55*_a;
        _c.look.draw(0, 0, RIVAL_SCALE);
        ctx.globalAlpha = _a;
        this.drawBand(_c, RIVAL_SCALE, true);
        ctx.globalAlpha = 1;
        //横の走査線(時のずれ)：ところどころ細く抜く
        if(_c.t % 6 < 3){
            ctx.fillStyle = "rgba(255,255,255," + (0.35*_a) + ")";
            var y0 = ((_c.t*3) % 50) - 25;
            ctx.fillRect(-26, y0, 52, 2);
        }
        //出番待ち：何拍あとに出てくるかを、針がひと回りして知らせる
        if(_c.mode == "wait"){
            var u = _c.next == "dash" ? 1 - _c.wait/_c.waitT : 1 + _c.hi/(_c.n*RIVAL2_ECHO_DELAY);
            ctx.save();
            ctx.strokeStyle = "rgba(" + RIVAL_TIME + ",0.8)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, 14, -Math.PI/2, -Math.PI/2 + Math.PI*2*u); ctx.stroke();
            ctx.restore();
        }
        ctx.lineWidth = 1;
    },
    //ローマ数字の時刻(十二時の決闘の分身)
    drawNumeral:function(_h,_x,_y,_a){
        var N = ["XII","I","II","III","IV","V","VI","VII","VIII","IX","X","XI"][_h % 12];
        ctx.save();
        ctx.globalAlpha = _a;
        ctx.font = "bold 13px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.strokeText(N, _x, _y);
        ctx.fillStyle = "rgb(" + RIVAL2_TINT + ")";
        ctx.fillText(N, _x, _y);
        ctx.restore();
    },
    //ハチマキ：体の上のほうに巻いた帯(_front)と、結び目からなびく2本の端(体の後ろ)。
    //体と同じように弾んで傾く(DroneLook.draw と同じ動き)。端は点の列を体の動きの慣性・重さ・はためきで動かす(rival.scarfStep)
    drawBand:function(_e,_k,_front){
        var L = _e.look, y = RIVAL_BAND_Y*_k;
        if(!_front){
            var sp = Math.hypot(_e.vx + (_e.mvx || 0),_e.vy + (_e.mvy || 0));
            var want = sp > 0.8 ? Math.atan2(-(_e.vy + (_e.mvy || 0)),-(_e.vx + (_e.mvx || 0))) : (L.yaw > 0 ? 0.5 : Math.PI - 0.5);
            _e.scarfA = _e.scarfA == null ? want : turnTo(_e.scarfA, want, 0.12);
        }
        var side = Math.cos(_e.scarfA || 0) >= 0 ? 1 : -1, kx = side*(RIVAL_BAND_W - 1)*_k;
        ctx.save();
        ctx.translate(0, Math.sin(L.t*0.08)*1.5*_k);
        ctx.rotate(L.tilt);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if(_front){
            //帯：黒いふち・赤・上側に光
            ctx.beginPath(); ctx.moveTo(-RIVAL_BAND_W*_k, y); ctx.lineTo(RIVAL_BAND_W*_k, y);
            ctx.strokeStyle = RIVAL_INK; ctx.lineWidth = 4.6*_k; ctx.stroke();
            ctx.strokeStyle = RIVAL_SCARF; ctx.lineWidth = 2.8*_k; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-RIVAL_BAND_W*_k*0.8, y - 0.7*_k); ctx.lineTo(RIVAL_BAND_W*_k*0.8, y - 0.7*_k);
            ctx.strokeStyle = RIVAL_SCARF_HI; ctx.lineWidth = 0.8*_k; ctx.stroke();
            //結び目：小さな2つの輪と、まんなかの結び
            for(var s=-1; s<=1; s+=2){
                ctx.beginPath(); ctx.ellipse(kx + s*2.2*_k*side, y - 0.4*_k, 2.2*_k, 1.5*_k, s*0.5, 0, Math.PI*2);
                ctx.fillStyle = RIVAL_SCARF; ctx.fill();
                ctx.strokeStyle = RIVAL_INK; ctx.lineWidth = 1.2; ctx.stroke();
            }
            ctx.beginPath(); ctx.arc(kx, y, 1.8*_k, 0, Math.PI*2);
            ctx.fillStyle = RIVAL_SCARF; ctx.fill();
            ctx.strokeStyle = RIVAL_INK; ctx.lineWidth = 1.4; ctx.stroke();
        }else{
            this.scarfStep(_e, _k, kx, y, side);
            var S = _e.scarf;
            for(var s=S.tails.length - 1; s>=0; s--) this.drawRibbon(S.tails[s], _k*(s ? 0.82 : 1));
        }
        ctx.restore();
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
        ctx.lineWidth = 1;
    },
    //ハチマキの端の動き(描画のたびに。1コマに1度だけ進める)。点は結び目からの位置(体の向きの傾きの中)で持つ。
    //体が動いた分の一部だけ取り残されて後ろへなびき、重さで垂れ、速いほどはためく
    scarfStep:function(_e,_k,_ax,_ay,_side){
        var S = _e.scarf, seg = SCARF_SEG*_k;
        if(!S || S.side != _side){
            S = _e.scarf = { side:_side, tails:[], px:_e.x, py:_e.y, f:-1 };
            for(var s=0; s<SCARF_SEGS.length; s++){
                var pts = [];
                for(var i=0; i<=SCARF_SEGS[s]; i++){
                    var x = _ax + _side*i*seg*0.8, y = _ay + i*seg*(0.45 + s*0.25);
                    pts.push({ x:x, y:y, ox:x, oy:y });
                }
                S.tails.push(pts);
            }
        }
        if(S.f == _e.t){ S.tails.forEach(function(p){ p[0].x = _ax; p[0].y = _ay; }); return; }
        S.f = _e.t;
        var mx = _e.x - S.px, my = _e.y - S.py;
        S.px = _e.x; S.py = _e.y;
        //ワープなどで大きく跳んだときは、取り残さない
        if(Math.hypot(mx,my) > 40){ mx = 0; my = 0; }
        var sp = Math.min(1, Math.hypot(mx,my)/8);
        for(var s=0; s<S.tails.length; s++){
            var P = S.tails[s];
            for(var i=1; i<P.length; i++){
                var p = P[i], vx = (p.x - p.ox)*SCARF_DAMP, vy = (p.y - p.oy)*SCARF_DAMP;
                p.ox = p.x; p.oy = p.y;
                var fl = Math.sin(_e.t*0.45 - i*0.9 + s*1.9)*SCARF_FLUTTER*(0.3 + sp)*i/P.length;
                p.x += vx - mx*SCARF_DRAG + fl*my*0.2;
                p.y += vy - my*SCARF_DRAG + SCARF_GRAVITY + fl*(2 + Math.abs(mx)*0.3);
            }
            //節の長さをそろえる(結び目は固定)
            P[0].x = _ax; P[0].y = _ay;
            for(var it=0; it<3; it++){
                for(var i=1; i<P.length; i++){
                    var a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx,dy) || 1, f = (d - seg)/d;
                    if(i == 1){ b.x -= dx*f; b.y -= dy*f; }
                    else{ a.x += dx*f*0.5; a.y += dy*f*0.5; b.x -= dx*f*0.5; b.y -= dy*f*0.5; }
                }
            }
            //最後に根元から順に、節が伸びないよう引き戻す(突進のように速く動いても、帯が線のように伸びないように)
            for(var i=1; i<P.length; i++){
                var a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx,dy);
                if(d > seg){ b.x = a.x + dx*seg/d; b.y = a.y + dy*seg/d; }
            }
        }
    },
    //帯の端1本：先へ細くなる帯を、黒いふち・赤・光の当たる側の線で描く。先は燕の尾のように切れ込む
    drawRibbon:function(_P,_k){
        var n = _P.length, L = [], Rr = [];
        for(var i=0; i<n; i++){
            var a = _P[Math.max(0, i - 1)], b = _P[Math.min(n - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx,dy) || 1;
            var w = SCARF_W*_k*(1 - 0.45*i/(n - 1)), nx = -dy/d*w, ny = dx/d*w;
            L.push([_P[i].x + nx, _P[i].y + ny]);
            Rr.push([_P[i].x - nx, _P[i].y - ny]);
        }
        var tip = _P[n - 1], pre = _P[n - 2], cx = tip.x + (pre.x - tip.x)*0.45, cy = tip.y + (pre.y - tip.y)*0.45;
        ctx.beginPath();
        ctx.moveTo(L[0][0], L[0][1]);
        for(var i=1; i<n; i++) ctx.lineTo(L[i][0], L[i][1]);
        ctx.lineTo(cx, cy);
        for(var i=n - 1; i>=0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
        ctx.closePath();
        ctx.strokeStyle = RIVAL_INK; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.fillStyle = RIVAL_SCARF; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(L[0][0], L[0][1]);
        for(var i=1; i<n - 1; i++) ctx.lineTo(L[i][0]*0.7 + _P[i].x*0.3, L[i][1]*0.7 + _P[i].y*0.3);
        ctx.strokeStyle = RIVAL_SCARF_HI; ctx.lineWidth = 0.9; ctx.stroke();
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
        //左に赤い印(ハチマキの色)
        ctx.fillStyle = RIVAL_SCARF;
        ctx.fillRect(bx - w/2 + 5, by - h/2 + 6, 3, h - 12);
        ctx.fillStyle = "rgb(" + RIVAL_TINT + ")";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(_e.sayText, bx + 2, by + 1);
        ctx.restore();
        ctx.lineWidth = 1;
    },

    //ワープの粒子・突進の予告・時が止まった世界(translateしていない状態。special.drawAttack から。敵より奥に描く)
    //登場の演出中のライバル
    introOf:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type == "chrono" && (e.mode == "intro" || e.mode == "awaken")) return e;
        }
        return null;
    },
    //演出の経過と、名乗り始める時(登場：組み上がったとき 目覚め：分身が回り出したとき)
    stage:function(_e){
        return _e.mode == "awaken" ? { age:this.awakenAge(_e), at:RIVAL2_SPLIT_AT, T:RIVAL2_AWAKEN_T }
                                   : { age:this.introAge(_e), at:RIVAL_INTRO_ARRIVE, T:RIVAL_INTRO_T };
    },
    //時が止まった世界：周りの色を抜いて暗くする(_p：0～1 の強さ。_violet：第二形態の色)
    drawStopped:function(_p,_violet){
        if(_p <= 0) return;
        ctx.save();
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "rgba(128,128,128," + (0.92*_p) + ")";
        ctx.fillRect(-40,-40,CW + 80,CH + 80);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = _violet ? "rgba(25,10,50," + (0.32*_p) + ")" : "rgba(15,25,55," + (0.28*_p) + ")";
        ctx.fillRect(-40,-40,CW + 80,CH + 80);
        ctx.restore();
    },
    //時が止まる瞬間：(_x,_y)から、色の反転した輪が広がる(_u：0～1)
    drawStopWave:function(_x,_y,_u,_R){
        if(_u < 0 || _u >= 1) return;
        var r = 20 + (1 - (1 - _u)*(1 - _u))*_R;
        ctx.save();
        ctx.globalCompositeOperation = "difference";
        ctx.fillStyle = "rgba(255,255,255," + (0.85*(1 - _u)) + ")";
        ctx.beginPath(); ctx.arc(_x,_y,r,0,Math.PI*2); ctx.fill();
        ctx.restore();
    },
    //登場・目覚めの演出：時が止まった世界(周りの色を抜いて暗くする)の上に、ライバルを描く
    //登場は画面の上から光が集まって組み上がり、目覚めは分身がまわりを回って体に重なる
    //(mainScreen.draw から。ドローン君を描いたあと、揺れ・拡大の中で)
    drawIntro:function(){
        var e = this.introOf();
        if(!e || !e.wfx) return;
        var aw = e.mode == "awaken", S = this.stage(e), age = S.age;
        //目覚めは、撃破と鼓動のあとで時が止まる(それまでは少し暗くなるだけ)
        var t0 = aw ? RIVAL2_STOP_AT : 0, st = age - t0;
        var p = Math.max(0, Math.min(1, st/(RIVAL_INTRO_STOP*0.6), e.count/RIVAL_INTRO_OUT));
        if(aw && st < 0){
            ctx.fillStyle = "rgba(10,5,25," + (0.35*Math.min(1, age/30)) + ")";
            ctx.fillRect(-40,-40,CW + 80,CH + 80);
        }
        this.drawStopped(p, aw);
        if(aw){
            ctx.fillStyle = "rgba(25,10,50," + (0.2*p) + ")";
            ctx.fillRect(-40,-40,CW + 80,CH + 80);
        }else{
            ctx.fillStyle = "rgba(15,25,55," + (0.12*p) + ")";
            ctx.fillRect(-40,-40,CW + 80,CH + 80);
        }
        //時が止まる瞬間：ライバルのところから、色の反転した輪が広がる
        if(st >= 0) this.drawStopWave(e.x, e.y, st/RIVAL_INTRO_STOP, 1100);
        //登場：光が画面の上から集まって組み上がる(現れる場所には文字盤が縮んでいく)
        if(!aw && age >= RIVAL_INTRO_GATHER && age < RIVAL_INTRO_ARRIVE){
            var t = (age - RIVAL_INTRO_GATHER)/(RIVAL_INTRO_ARRIVE - RIVAL_INTRO_GATHER);
            this.drawFace(e.x, e.y, 30 + 120*(1 - t)*(1 - t), 0.8*Math.sin(Math.PI*t), RIVAL_TIME, -Math.PI/2 + t*Math.PI*4, null, false);
            e.wfx.draw(e.wx0, e.wy0, e.x, e.y, t);
        }
        //目覚め：時が止まってから、体の後ろに逆回りの時計の紋が浮かび、覚醒で広がって消える
        if(aw && st >= 0) this.drawClock(e, age);
        //目覚め：分身が体から分かれて回り、広がってから体に重なる
        if(aw && age >= S.at){
            var n = RIVAL2_CLONES[e.lv || 0] + 1, u = (age - S.at)/(S.T - S.at);
            var R = 90*Math.sin(Math.PI*Math.min(1, u*1.15));
            this.onTop = true;
            for(var i=0; i<n; i++){
                var a = age*0.09 + i*Math.PI*2/n;
                ctx.save();
                ctx.translate(e.x + Math.cos(a)*R, e.y + Math.sin(a)*R*0.8);
                this.drawBody(e, null, 0.45);
                ctx.restore();
            }
            this.onTop = false;
        }
        if(age >= (aw ? 0 : S.at)){
            this.onTop = true;
            ctx.save();
            ctx.translate(e.x, e.y);
            this.draw(e, null);
            ctx.restore();
            this.onTop = false;
            //組み上がった・目覚めた直後：光る
            var g = 1 - (age - S.at)/20;
            if(g > 0 && g <= 1) e.wfx.drawGlow(e.x, e.y, 0.9*g);
        }
    },
    //目覚めの時計の紋(translateしていない状態)：目盛りの輪と、逆回りに速くなっていく2本の針。覚醒で広がって消える
    drawClock:function(_e,_age){
        var g = (_age - RIVAL2_STOP_AT)/(RIVAL2_SPLIT_AT - RIVAL2_STOP_AT), R = 78, a = Math.min(1, g*2);
        if(g > 1){
            var o = (_age - RIVAL2_SPLIT_AT)/24;
            if(o >= 1) return;
            R = 78 + 170*(1 - (1 - o)*(1 - o));
            a = 1 - o;
        }
        var spin = -Math.min(1, g)*Math.min(1, g)*30;     //逆回り(時を戻す)。だんだん速く
        this.drawFace(_e.x, _e.y, R, 0.85*a, RIVAL2_GLOW, spin - Math.PI/2, g <= 1 ? spin/12 - Math.PI/2 : null, true, spin*0.05);
    },
    //文字盤(translateしていない状態)：二重の輪・60の小さな目盛りと12の目盛り・長針(_hand)・短針(_short。null なら描かない)
    //_num：ローマ数字を出す　_rot：目盛りの回り
    drawFace:function(_x,_y,_R,_a,_col,_hand,_short,_num,_rot){
        if(_a <= 0) return;
        var rot = _rot || 0;
        ctx.save();
        ctx.translate(_x,_y);
        ctx.lineCap = "round";
        //うっすらした盤
        ctx.globalAlpha = _a*0.10;
        ctx.fillStyle = "rgb(" + _col + ")";
        ctx.beginPath(); ctx.arc(0,0,_R,0,Math.PI*2); ctx.fill();
        for(var pass=0; pass<2; pass++){
            ctx.globalAlpha = _a*(pass ? 0.85 : 0.25);
            ctx.strokeStyle = pass ? "rgb(" + _col + ")" : RIVAL_INK;
            ctx.lineWidth = pass ? 2 : 4.5;
            ctx.beginPath(); ctx.arc(0,0,_R,0,Math.PI*2); ctx.stroke();
            ctx.lineWidth = pass ? 1 : 3;
            ctx.beginPath(); ctx.arc(0,0,_R*0.86,0,Math.PI*2); ctx.stroke();
            for(var i=0; i<60; i++){
                var t = rot + i*Math.PI/30, big = i % 5 == 0, l = big ? (i % 15 == 0 ? 13 : 9) : 3.5;
                ctx.lineWidth = (big ? 2.2 : 1) + (pass ? 0 : 2);
                ctx.beginPath(); ctx.moveTo(Math.cos(t)*(_R - l), Math.sin(t)*(_R - l)); ctx.lineTo(Math.cos(t)*_R, Math.sin(t)*_R); ctx.stroke();
            }
            if(_hand != null){
                ctx.lineWidth = pass ? 2.6 : 5.5;
                ctx.beginPath(); ctx.moveTo(-Math.cos(_hand)*_R*0.12, -Math.sin(_hand)*_R*0.12); ctx.lineTo(Math.cos(_hand)*_R*0.8, Math.sin(_hand)*_R*0.8); ctx.stroke();
            }
            if(_short != null){
                ctx.lineWidth = pass ? 4.5 : 7.5;
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(_short)*_R*0.48, Math.sin(_short)*_R*0.48); ctx.stroke();
            }
        }
        if(_num && _R > 60){
            ctx.globalAlpha = _a*0.8;
            ctx.font = "bold " + Math.round(Math.min(18, _R*0.12)) + "px serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "rgb(" + _col + ")";
            var N = ["XII","I","II","III","IV","V","VI","VII","VIII","IX","X","XI"];
            for(var i=0; i<12; i++){
                var t = -Math.PI/2 + rot + i*Math.PI/6;
                ctx.fillText(N[i], Math.cos(t)*_R*0.72, Math.sin(t)*_R*0.72);
            }
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //突進の予告(translateしていない状態。_cue：0～1 合図の強さ　_t：流れる印の時刻　_col：ふだんの色　_k：濃さ)：
    //細い2本のレールと、進む向きへ流れる山形の印。合図で赤く濃くなり、印が速く流れる
    drawLane:function(_x,_y,_ax,_ay,_cue,_t,_col,_k){
        var k = _k == null ? 1 : _k, w = 13, L = 1100;
        ctx.save();
        ctx.translate(_x,_y);
        ctx.rotate(Math.atan2(_ay,_ax));
        var col = _cue > 0 ? RIVAL_RED : (_col || RIVAL_TIME);
        ctx.globalAlpha = k*(0.10 + 0.18*_cue);
        ctx.fillStyle = "rgb(" + col + ")";
        ctx.fillRect(24, -w, L, w*2);
        ctx.globalAlpha = k*(0.45 + 0.5*_cue);
        ctx.strokeStyle = "rgb(" + col + ")";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(24,-w); ctx.lineTo(L,-w); ctx.moveTo(24,w); ctx.lineTo(L,w); ctx.stroke();
        //山形の印
        var gap = 46, off = (_t*(3 + 6*_cue)) % gap;
        ctx.lineWidth = 2.2;
        ctx.lineJoin = "round";
        for(var x=30 + off; x<L; x+=gap){
            ctx.globalAlpha = k*(0.5 + 0.5*_cue)*Math.max(0, 1 - x/700);
            ctx.beginPath(); ctx.moveTo(x - 6, -w*0.55); ctx.lineTo(x + 2, 0); ctx.lineTo(x - 6, w*0.55); ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //時計の針(translateしていない状態でもよい)：(_x0,_y0)の軸から(_x1,_y1)へ。根元の少し先がいちばん太い、先のとがった形。
    //反対側に短い尾と、軸の丸(黒いふち・_fill の塗り・まんなかに時の色)
    drawHand:function(_x0,_y0,_x1,_y1,_w,_fill){
        var a = Math.atan2(_y1 - _y0, _x1 - _x0), L = Math.hypot(_x1 - _x0, _y1 - _y0);
        ctx.save();
        ctx.translate(_x0,_y0);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-L*0.12, 0);
        ctx.lineTo(-L*0.06, -_w*0.45);
        ctx.lineTo(L*0.18, -_w*0.5);
        ctx.lineTo(L, 0);
        ctx.lineTo(L*0.18, _w*0.5);
        ctx.lineTo(-L*0.06, _w*0.45);
        ctx.closePath();
        ctx.lineJoin = "round";
        ctx.strokeStyle = RIVAL_INK; ctx.lineWidth = 2.4; ctx.stroke();
        ctx.fillStyle = _fill; ctx.fill();
        //光の当たる側の細い線
        ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L*0.2, -_w*0.22); ctx.lineTo(L*0.85, -_w*0.04); ctx.stroke();
        //軸
        ctx.fillStyle = RIVAL_INK;
        ctx.beginPath(); ctx.arc(0, 0, _w*0.95, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = _fill;
        ctx.beginPath(); ctx.arc(0, 0, _w*0.55, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    },
    //登場・目覚めの演出の文字(揺れ・拡大の外。mainScreen.draw から)：上下の黒い帯・名前と異名・時が止まった案内
    drawUi:function(){
        var c = this.cutOf();
        if(c) this.drawCut(c);
        var e = this.introOf();
        if(!e) return;
        var aw = e.mode == "awaken", S = this.stage(e), age = S.age, lv = e.lv || 0, N = aw ? RIVAL2 : RIVAL;
        ctx.save();
        ctx.textBaseline = "middle";
        //目覚め：撃破の瞬間と覚醒の瞬間に、画面が白く光る
        if(aw){
            var w = age < 14 ? 0.75*(1 - age/14) : age >= S.at && age < S.at + 22 ? 0.95*(1 - (age - S.at)/22) : 0;
            if(w > 0){
                ctx.fillStyle = age < 14 ? "rgba(255,255,255," + w + ")" : "rgba(235,215,255," + w + ")";
                ctx.fillRect(0, 0, CW, CH);
            }
        }
        //画面のまんなかの案内(時が止まる・動き出す)。目覚めは、時が止まってから
        var st = age - (aw ? RIVAL2_STOP_AT : 0);
        var msg = st >= 0 && age < S.at ? (aw ? "時間停止 ―― まだ終わっていない！？" : "時間停止 ―― 何かが来る！") : e.count <= RIVAL_INTRO_OUT ? "時は動き出す" : "";
        if(msg){
            ctx.globalAlpha = Math.min(1, Math.max(0, st)/10, e.count/8);
            ctx.fillStyle = "rgba(10,20,40,0.6)";
            ctx.fillRect(0, CH/2 - 150, CW, 40);
            ctx.textAlign = "center";
            ctx.font = "bold 20px sans-serif";
            ctx.fillStyle = "rgb(" + (aw ? RIVAL2_GLOW : WARP_COLOR) + ")";
            ctx.fillText(msg, CW/2, CH/2 - 130);
            ctx.globalAlpha = 1;
        }
        //組み上がって・目覚めてから：上下の黒い帯と、右から名前(ボスの名乗りと同じ形で、ライバルの色)
        var a = age - S.at;
        if(a >= 0){
            var k = Math.min(1, a/18, e.count/20);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, CW, 40*k);
            ctx.fillRect(0, CH - 40*k, CW, 40*k);
            var ease = 1 - Math.pow(1 - Math.min(1, a/28), 3);
            var x = CW + 320 - (320 + GS*2)*ease, y = e.y > CH*0.55 ? 235 : CH - 150;     //ライバルが下のほうにいるときは、重ならないよう上に
            ctx.globalAlpha = Math.min(1, e.count/20);
            ctx.textAlign = "right";
            ctx.font = "bold 16px sans-serif";
            ctx.fillStyle = aw ? "rgb(150,80,220)" : "rgb(30,120,190)";
            ctx.fillText("RIVAL　" + N.en + (aw ? "　SECOND FORM" : lv > 0 ? "　再戦 Lv." + (lv + 1) : ""), x - 4, y - 44);
            ctx.font = "900 54px serif";
            ctx.lineJoin = "round";
            ctx.lineWidth = 8;
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.strokeText(N.name, x, y);
            ctx.fillStyle = "rgb(" + (aw ? RIVAL2_TINT : RIVAL_TINT) + ")";
            ctx.fillText(N.name, x, y);
            ctx.lineJoin = "miter";
            //名前の下に伸びる線(ハチマキの赤)と異名
            var w = 380*Math.min(1, Math.max(0, (a - 12)/24));
            ctx.fillStyle = RIVAL_SCARF;
            ctx.fillRect(x - w, y + 34, w, 4);
            ctx.font = "bold 17px sans-serif";
            ctx.fillStyle = "#eee";
            ctx.globalAlpha *= Math.min(1, Math.max(0, (a - 24)/16));
            ctx.fillText(N.title + " ――", x - 6, y + 58);
        }
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#000";
    },

    //時ノ奔流のカットイン(揺れ・拡大の外)：画面を暗くし、斜めの帯が右から入って左へ抜ける。帯の中にクロノを大きく、右に技の名前
    drawCut:function(_e){
        var T = RIVAL_OD_CUT, age = T - _e.count, f2 = this.second(_e);
        var inK = Math.min(1, age/10), outK = Math.min(1, _e.count/10), k = Math.min(inK, outK);
        var off = (1 - (1 - Math.pow(1 - inK, 3)))*CW - (1 - outK)*(1 - outK)*CW;
        var cy = CH/2 - 10, H = 170, sk = 40;
        ctx.save();
        ctx.fillStyle = "rgba(5,8,20," + (0.5*k) + ")";
        ctx.fillRect(0, 0, CW, CH);
        ctx.translate(off, 0);
        var band = function(){
            ctx.beginPath();
            ctx.moveTo(-40, cy - H/2 + sk); ctx.lineTo(CW + 40, cy - H/2 - sk);
            ctx.lineTo(CW + 40, cy + H/2 - sk); ctx.lineTo(-40, cy + H/2 + sk);
            ctx.closePath();
        };
        band();
        ctx.fillStyle = f2 ? "rgba(32,16,58,0.95)" : "rgba(14,22,48,0.95)";
        ctx.fill();
        ctx.save();
        band();
        ctx.clip();
        //流れる光の筋(左へ)
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 2;
        for(var i=0; i<16; i++){
            var y = cy - H/2 - sk + ((i*53) % (H + sk*2)), x = CW + 100 - ((age*38 + i*211) % (CW + 300));
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 90 + (i % 3)*40, y - 6); ctx.stroke();
        }
        //大きな文字盤とクロノ
        this.drawFace(250, cy, 150, 0.6, f2 ? RIVAL2_TIME : RIVAL_TIME, -Math.PI/2 + age*0.09, -Math.PI/2 + age*0.0075, true, 0);
        ctx.save();
        ctx.translate(250, cy + 8);
        ctx.scale(3.4, 3.4);
        this.drawBody(_e, null, 1);
        ctx.restore();
        //目が光る：帯を横切る白い筋
        if(age >= 16 && age < 30){
            var g = 1 - (age - 16)/14;
            ctx.fillStyle = "rgba(255,255,255," + (0.85*g) + ")";
            ctx.fillRect(0, cy - 4 - 2*g, CW, 4 + 4*g);
        }
        ctx.restore();
        //帯のふち(ハチマキの赤と白)
        ctx.lineWidth = 5;
        ctx.strokeStyle = RIVAL_SCARF;
        ctx.beginPath(); ctx.moveTo(-40, cy - H/2 + sk); ctx.lineTo(CW + 40, cy - H/2 - sk); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-40, cy + H/2 + sk); ctx.lineTo(CW + 40, cy + H/2 - sk); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath(); ctx.moveTo(-40, cy - H/2 + sk + 6); ctx.lineTo(CW + 40, cy - H/2 - sk + 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-40, cy + H/2 + sk - 6); ctx.lineTo(CW + 40, cy + H/2 - sk - 6); ctx.stroke();
        //技の名前(少し遅れて現れる)
        var tk = Math.min(1, Math.max(0, (age - 8)/12));
        ctx.globalAlpha = tk;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 18px sans-serif";
        ctx.fillStyle = RIVAL_SCARF;
        ctx.fillText((f2 ? RIVAL2.name : RIVAL.name) + "　" + RIVAL_OD.en, 470 + 30*(1 - tk), cy - 52);
        ctx.font = "900 76px serif";
        ctx.lineJoin = "round";
        ctx.lineWidth = 10;
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.strokeText(RIVAL_OD.name, 466 + 30*(1 - tk), cy + 18);
        ctx.fillStyle = "#fff";
        ctx.fillText(RIVAL_OD.name, 466 + 30*(1 - tk), cy + 18);
        ctx.lineJoin = "miter";
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //時ノ奔流の絵(translateしていない状態)：
    //  カットイン中は時が止まった世界。加速は大きな文字盤の針が速く回り、まわりを光の筋が回り、昼と夜が入れかわるようにちらつく。
    //  針の裁きは、次になぎ払う所を赤く(短針は紫に)見せ、光の針を描く
    drawOver:function(_e){
        var O = _e.ov, x = _e.x, y = _e.y;
        if(O.ph == "cut"){ this.drawStopped(0.8, this.second(_e)); return; }
        if(O.ph == "accel"){
            var u = O.u || 0;
            //昼と夜が入れかわる(時が速く流れる)
            var day = Math.floor(O.whirl*0.6) % 2 == 0;
            ctx.fillStyle = day ? "rgba(255,190,120," + (0.08*u) + ")" : "rgba(30,40,110," + (0.12*u) + ")";
            ctx.fillRect(-40, -40, CW + 80, CH + 80);
            //まわりを回る光の筋
            ctx.save();
            ctx.lineCap = "round";
            for(var i=0; i<4; i++){
                var R = 300 + i*70, a = O.whirl*(0.5 - i*0.08)*(i % 2 ? -1 : 1) + i;
                ctx.strokeStyle = "rgba(" + RIVAL_TIME + "," + (0.12 + 0.3*u) + ")";
                ctx.lineWidth = 2 + 2*u;
                ctx.beginPath(); ctx.arc(x, y, R, a, a + 0.6 + 1.4*u); ctx.stroke();
            }
            ctx.restore();
            this.drawFace(x, y, RIVAL_OD_FACE_R, 0.3 + 0.4*u, this.second(_e) ? RIVAL2_TIME : RIVAL_TIME, null, null, true, 0);
            this.drawHand(x, y, x + Math.cos(O.whirl)*RIVAL_OD_FACE_R*0.85, y + Math.sin(O.whirl)*RIVAL_OD_FACE_R*0.85, 8, RIVAL_SCARF);
            this.drawHand(x, y, x + Math.cos(O.whirl/12)*RIVAL_OD_FACE_R*0.5, y + Math.sin(O.whirl/12)*RIVAL_OD_FACE_R*0.5, 12, "rgb(" + RIVAL2_TIME + ")");
            return;
        }
        //針の裁き
        var b = this.viewBeat(_e), fr = b - Math.floor(b), hour = _e.lv >= RIVAL_OD_HOUR_FROM;
        this.drawFace(x, y, RIVAL_OD_FACE_R, 0.55, this.second(_e) ? RIVAL2_TIME : RIVAL_TIME, null, null, true, 0);
        //次になぎ払う所(拍が進むほど濃く)
        var wedge = function(_a,_to,_col,_k){
            ctx.fillStyle = "rgba(" + _col + "," + _k + ")";
            ctx.beginPath(); ctx.moveTo(x, y);
            ctx.arc(x, y, 1200, Math.min(_a,_to), Math.max(_a,_to));
            ctx.closePath(); ctx.fill();
        };
        if(O.msw > RIVAL_OD_SWEEP*this.beatF()) wedge(O.mTo, O.mTo + O.dir*Math.PI/6, RIVAL_RED, 0.06 + 0.22*fr);
        var hNext = ((_e.bi % 2) + 2) % 2 == 1;
        if(hour && hNext && O.hsw > RIVAL_OD_SWEEP*this.beatF()) wedge(O.hTo, O.hTo - O.dir*Math.PI/6, RIVAL2_TIME, 0.05 + 0.2*fr);
        if(hour) this.drawBeam(x, y, O.h, RIVAL2_TIME, O.armed);
        this.drawBeam(x, y, O.m, RIVAL_RED, O.armed);
    },
    //光の針(translateしていない状態。_on：光っている(当たる)。光る前は細い点線)
    drawBeam:function(_x,_y,_a,_col,_on){
        var L = 1200;
        ctx.save();
        ctx.translate(_x, _y);
        ctx.rotate(_a);
        ctx.lineCap = "round";
        if(!_on){
            ctx.setLineDash([10,8]);
            ctx.strokeStyle = "rgba(" + _col + ",0.8)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(L, 0); ctx.stroke();
            ctx.restore();
            return;
        }
        var fl = 0.85 + 0.15*Math.sin(performance.now()*0.05);
        ctx.strokeStyle = "rgba(" + _col + "," + (0.25*fl) + ")";
        ctx.lineWidth = RIVAL_OD_BEAM_W*4;
        ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(L, 0); ctx.stroke();
        ctx.strokeStyle = RIVAL_INK;
        ctx.lineWidth = RIVAL_OD_BEAM_W*2 + 3;
        ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(L, 0); ctx.stroke();
        ctx.strokeStyle = "rgb(" + _col + ")";
        ctx.lineWidth = RIVAL_OD_BEAM_W*2;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255," + (0.9*fl) + ")";
        ctx.lineWidth = RIVAL_OD_BEAM_W*0.7;
        ctx.stroke();
        ctx.restore();
    },
    //鏡像：画面のまんなかの鏡(縦と横のガラスの線)と、ドローン君から映した分身への細い線
    drawMirror:function(_e){
        var cx = CW/2, cy = RIVAL2_MIRROR_CY, u = 1 - _e.count/RIVAL2_MIRROR_T, a = Math.min(1, u*10, (1 - u)*10);
        ctx.save();
        ctx.globalAlpha = a;
        for(var pass=0; pass<2; pass++){
            ctx.strokeStyle = pass ? "rgba(" + RIVAL2_TIME + ",0.55)" : "rgba(255,255,255,0.55)";
            ctx.lineWidth = pass ? 1.5 : 4;
            ctx.beginPath(); ctx.moveTo(cx, 90); ctx.lineTo(cx, CH); ctx.moveTo(0, cy); ctx.lineTo(CW, cy); ctx.stroke();
        }
        //ガラスの光(鏡の線の上をゆっくり流れる)
        var g = (_e.t*4) % 600;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(cx - 1.5, 90 + (g % (CH - 90)), 3, 40);
        ctx.fillRect((g*1.6) % CW, cy - 1.5, 60, 3);
        //ドローン君と、映した分身(本物も)を結ぶ点線
        ctx.setLineDash([3,7]);
        ctx.strokeStyle = "rgba(" + RIVAL2_TIME + ",0.45)";
        ctx.lineWidth = 1.2;
        for(var i=0; i<enemies.length; i++){
            var c = enemies[i];
            if(c.mode != "mirror" || (c != _e && c.owner != _e.id)) continue;
            ctx.beginPath(); ctx.moveTo(drone.X, drone.Y); ctx.lineTo(c.x, c.y); ctx.stroke();
        }
        ctx.restore();
    },
    //時戻し：止まっている間は、ドローン君が巻き戻される先(薄い影)と道すじを見せる。巻き戻される間は、逆に回る文字盤と残像
    drawRewindPath:function(_e){
        var P = this.pull, path = P ? P.path : _e.dh;
        if(!path || path.length < 2) return;
        var to = P ? path[path.length - 1] : path[0];
        ctx.save();
        if(!P){
            var a = Math.min(1, (RIVAL2_REWIND_STOP - _e.count)/10);
            ctx.globalAlpha = 0.6*a;
            ctx.setLineDash([2,6]);
            ctx.strokeStyle = "rgb(" + RIVAL2_TIME + ")";
            ctx.lineWidth = 2;
            ctx.beginPath();
            for(var i=0; i<path.length; i+=3) ctx[i ? "lineTo" : "moveTo"](path[i].x, path[i].y);
            ctx.lineTo(drone.X, drone.Y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        //戻る先：ドローン君の薄い影と、逆回りの小さな文字盤
        ctx.globalAlpha = P ? 0.5 : 0.45;
        drone.look.draw(to.x, to.y);
        ctx.globalAlpha = 1;
        this.drawFace(to.x, to.y, 26, 0.8, RIVAL2_TIME, -Math.PI/2 - _e.t*0.2, null, false);
        if(P){
            //巻き戻されている：ドローン君のまわりに逆回りの文字盤
            this.drawFace(drone.X, drone.Y, 34, 0.8, RIVAL2_TIME, -Math.PI/2 - P.t*0.4, -Math.PI/2 - P.t*0.033, false);
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },
    drawAttack:function(_e){
        this.watch(_e);
        var W = _e.wfx, f2 = this.second(_e), col = f2 ? RIVAL2_TIME : RIVAL_TIME;
        //時が止まっている(時止めの hold・時戻しの rstop・十二時の決闘)：周りの色を抜く
        var stopped = _e.mode == "hold" || _e.mode == "rstop", tw = this.inTwelve(_e) && _e.tw;
        if(stopped || _e.relT > 0 || tw){
            var sT = _e.stopT || RIVAL_HOLD_T;
            var p = stopped ? Math.min(1, (sT - _e.count)/8) : tw ? 0.75*Math.min(1, _e.tw.fill*3) : _e.relT/24;
            this.drawStopped(p*0.92, f2);
            if(stopped) this.drawStopWave(_e.x, _e.y, (sT - _e.count)/20, 700);
        }
        //時戻し：逆回りの矢印の輪と、上へ流れる横の走査線(テープを巻き戻すように)
        if(_e.rewFx > 0){
            var u = 1 - _e.rewFx/30;
            ctx.save();
            ctx.globalAlpha = 0.5*(1 - u);
            ctx.fillStyle = "#fff";
            for(var i=0; i<5; i++){
                var y = (CH + 40) - ((u*900 + i*137) % (CH + 80));
                ctx.fillRect(0, y, CW, 2 + (i % 2)*2);
            }
            ctx.restore();
            this.drawFace(_e.x, _e.y, 60 + 40*u, 0.8*(1 - u), RIVAL2_TIME, -Math.PI/2 - u*Math.PI*4, -Math.PI/2 - u*Math.PI/3, false, -u*2);
        }
        //十二時の決闘：ドローン君を囲む大きな文字盤(楕円)と、進んでいく針
        if(tw) this.drawTwelve(_e);
        //時ノ奔流
        if(_e.mode == "over" && _e.ov) this.drawOver(_e);
        //鏡像
        if(_e.mode == "mirror") this.drawMirror(_e);
        //時戻し：巻き戻される先と道すじ
        if(_e.mode == "rstop" || this.pull) this.drawRewindPath(_e);
        //時計盤：自分を中心に文字盤。長針は拍ごとに1目盛り進み、次に進む所が薄く見える
        if(_e.mode == "clock") this.drawClockAttack(_e, col);
        //時止め：跳んだ跡を線でつなぐ(星座のように)
        if(_e.marks && _e.marks.length && (_e.mode == "warp" || _e.mode == "hold")){
            ctx.save();
            ctx.strokeStyle = "rgba(" + col + ",0.55)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([2,6]);
            ctx.beginPath();
            for(var i=0; i<_e.marks.length; i++) ctx[i ? "lineTo" : "moveTo"](_e.marks[i].x, _e.marks[i].y);
            if(_e.mode == "hold") ctx.lineTo(_e.x, _e.y);
            ctx.stroke();
            ctx.setLineDash([]);
            for(var i=0; i<_e.marks.length; i++){
                ctx.fillStyle = "rgb(" + col + ")";
                ctx.beginPath(); ctx.arc(_e.marks[i].x, _e.marks[i].y, 3, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }
        //残像：速く動いている間、時のずれた影(赤・水色)を残す
        var sp = _e.spd || 0;
        if(this.shown(_e) && sp > 3.5 && _e.trail){
            ctx.save();
            //明るい背景でも見えるよう、加算ではなくふつうに重ねる
            var k = Math.min(1, sp/8);
            if(_e.trail[3]) W.drawGlow(_e.trail[3].x, _e.trail[3].y, 0.32*k, f2 ? RIVAL2_GLOW : WARP_COLOR);
            if(_e.trail[6]) W.drawGlow(_e.trail[6].x, _e.trail[6].y, 0.22*k, RIVAL_RED);
            if(_e.trail[9]) W.drawGlow(_e.trail[9].x, _e.trail[9].y, 0.12*k, f2 ? RIVAL2_GLOW : WARP_COLOR);
            ctx.restore();
        }
        //分身の輪舞：回っている輪を、文字盤の縁のように描く(協力プレイのゲストには輪のまんなかが届かないので描かない)
        if(_e.mode == "waltz" && _e.wcx != null){
            var u = 1 - _e.count/RIVAL2_WALTZ_T, R = RIVAL2_WALTZ_R[0] - (RIVAL2_WALTZ_R[0] - RIVAL2_WALTZ_R[1])*Math.sin(Math.PI*u);
            var a = 0.5*Math.min(1, u*8, (1 - u)*8), rot = (_e.orbit || 0) + RIVAL2_WALTZ_SPIN*(RIVAL2_WALTZ_T - _e.count);
            ctx.save();
            ctx.translate(_e.wcx, _e.wcy);
            ctx.scale(1, 0.8);
            ctx.strokeStyle = "rgba(" + RIVAL2_TIME + "," + a + ")";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.stroke();
            for(var i=0; i<24; i++){
                var t = rot + i*Math.PI/12, l = i % 2 ? 5 : 10;
                ctx.beginPath(); ctx.moveTo(Math.cos(t)*R, Math.sin(t)*R); ctx.lineTo(Math.cos(t)*(R - l), Math.sin(t)*(R - l)); ctx.stroke();
            }
            ctx.restore();
        }
        //突進の構え：狙っている間は薄く、合図で赤く濃くなる
        if(_e.mode == "aim") this.drawLane(_e.x, _e.y, _e.aimX, _e.aimY, _e.count <= RIVAL_CUE ? 1 - _e.count/RIVAL_CUE : 0, _e.t, _e.final ? RIVAL2_TIME : col, _e.final ? 1.4 : 1);
        //ワープ：出発点でほどけ、行き先で組み上がる。行き先には小さな文字盤が縮みながら回る
        if(_e.mode == "warp" && _e.wt > 0){
            var t = 1 - _e.count/_e.wt;
            this.drawFace(_e.x, _e.y, 10 + 46*(1 - t), 0.7*Math.sin(Math.PI*t), WARP_COLOR, -Math.PI/2 + t*Math.PI*2, null, false);
            W.draw(_e.wx0, _e.wy0, _e.x, _e.y, t);
        }
        //撃退されて去る：その場でほどけて消える
        if(_e.mode == "flee" && _e.count <= RIVAL_FLEE_OUT){
            W.draw(_e.x, _e.y, null, null, 1 - _e.count/RIVAL_FLEE_OUT);
        }
        //組み上がった直後：光る
        if(_e.arrT > 0 && this.shown(_e)){
            ctx.save();
            W.drawGlow(_e.x, _e.y, 0.8*_e.arrT/18, f2 ? RIVAL2_GLOW : WARP_COLOR);
            ctx.restore();
        }
    },
    //時計盤の攻撃の絵：文字盤・今の長針・次に進む所(薄く、拍が進むほど濃く)・撃った瞬間に針が光る
    drawClockAttack:function(_e,_col){
        var g = Math.min(1, _e.grow || 0), e3 = 1 - Math.pow(1 - g, 3), R = RIVAL_CLOCK_R*e3;
        var b = this.viewBeat(_e), fr = b - Math.floor(b);
        var hands = (_e.enraged || _e.lv >= 3) ? [0, Math.PI] : [0];
        this.drawFace(_e.x, _e.y, R, 0.9*g, _col, null, null, true, 0);
        ctx.save();
        ctx.translate(_e.x, _e.y);
        ctx.lineCap = "round";
        for(var i=0; i<hands.length; i++){
            var h = _e.hand + hands[i], nx = h + _e.hdir*Math.PI/6;
            //次に進む所
            ctx.globalAlpha = g*(0.15 + 0.5*fr);
            ctx.strokeStyle = "rgb(" + RIVAL_RED + ")";
            ctx.lineWidth = 2;
            ctx.setLineDash([6,6]);
            ctx.beginPath(); ctx.moveTo(Math.cos(nx)*26, Math.sin(nx)*26); ctx.lineTo(Math.cos(nx)*R*1.6, Math.sin(nx)*R*1.6); ctx.stroke();
            ctx.setLineDash([]);
            //今の長針(黒いふちの赤い針。撃った瞬間に白く光って伸びる)
            var L = R*(0.9 + 0.35*(_e.tickT || 0));
            ctx.globalAlpha = g;
            this.drawHand(0, 0, Math.cos(h)*L, Math.sin(h)*L, 6, RIVAL_SCARF);
            if(_e.tickT > 0){
                ctx.globalAlpha = g*_e.tickT;
                this.drawHand(0, 0, Math.cos(h)*L, Math.sin(h)*L, 6, "#fff");
            }
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //十二時の決闘の絵：ドローン君を囲む楕円の文字盤(時刻の位置に目盛り)と、まんなかから今の時刻へ伸びる針
    drawTwelve:function(_e){
        var T = _e.tw, RX = RIVAL2_TWELVE_RX, RY = RIVAL2_TWELVE_RY, g = Math.min(1, T.fill), e3 = 1 - Math.pow(1 - g, 3);
        var b = this.viewBeat(_e), fr = b*2 - Math.floor(b*2);
        ctx.save();
        ctx.translate(T.cx, T.cy);
        ctx.scale(1, RY/RX);
        var R = RX*(0.6 + 0.4*e3);
        for(var pass=0; pass<2; pass++){
            ctx.globalAlpha = g*(pass ? 0.7 : 0.25);
            ctx.strokeStyle = pass ? "rgb(" + RIVAL2_TIME + ")" : RIVAL_INK;
            ctx.lineWidth = pass ? 2 : 5;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.stroke();
            ctx.lineWidth = pass ? 1 : 3;
            ctx.beginPath(); ctx.arc(0, 0, R*0.93, 0, Math.PI*2); ctx.stroke();
            for(var i=0; i<60; i++){
                var t = -Math.PI/2 + i*Math.PI/30, l = i % 5 == 0 ? 16 : 5;
                ctx.lineWidth = (i % 5 == 0 ? 2.5 : 1) + (pass ? 0 : 2);
                ctx.beginPath(); ctx.moveTo(Math.cos(t)*R, Math.sin(t)*R); ctx.lineTo(Math.cos(t)*(R - l), Math.sin(t)*(R - l)); ctx.stroke();
            }
        }
        ctx.restore();
        //針：まんなかから今の時刻へ(楕円の縁の手前まで。次の時刻へ進む前に少し震える)
        var a = -Math.PI/2 + T.hour*Math.PI/6 + (fr > 0.8 ? Math.sin(fr*60)*0.012 : 0);
        var ex = T.cx + Math.cos(a)*R*0.84, ey = T.cy + Math.sin(a)*R*0.84*RY/RX;
        ctx.globalAlpha = g;
        this.drawHand(T.cx, T.cy, ex, ey, 7, _e.final ? "#fff" : RIVAL_SCARF);
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        //十二時(本物)の数字
        if(_e.mode != "warp") this.drawNumeral(0, _e.x, _e.y - 40, g);
    }
};
