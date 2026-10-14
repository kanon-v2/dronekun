//------------------------------------------------------------------------------
//  BGM「本格版」(試し聞き。デバッグのメニューの「BGM」で選ぶ。bgmTrial.js の案のひとつ)
//  音色は今の音のまま(矩形波・三角波・のこぎり波・正弦波・ノイズのドラム。残響やこだまは足さない)。
//  作曲と編曲を作り込む：
//    ・曲を区切り(前奏・A・B・サビ・つなぎ)に分け、前奏は1回だけ、あとはくり返す(今の曲は4〜8小節のくり返し)
//    ・今の曲のメロディは A の区切りにそのまま使い、B・サビを新しく書いた
//    ・メロディは音の長さを持つ(長い音はのばして、少し遅れてビブラート)。サビはハモり(パルス波)と1オクターブ下の重ね
//    ・和音は7th・sus4・分数コード・借用和音などを使い、区切りごとに伴奏の形(分散和音・刻み・低音の動き)を替える
//    ・ドラムは区切りの終わりにフィル(スネアの連打・タム)、頭にシンバル、サビの前にノイズの上昇音
//  音響と重奏(軽く聞こえないように。残響・音をずらした重ねは使わない)：
//    ・低音に同じ高さの正弦波、のばす低音に1オクターブ下を重ねて芯を太く。のこぎり波の低音は、はじいた瞬間に明るく、すぐこもる
//    ・のこぎり波をこもらせた低めの和音ののばしで真ん中の音域を埋め、メロディの1オクターブ下に小さな三角波を重ねる
//    ・キック・スネアに胴鳴り。ハイハットは拍の頭を強く。キックに合わせて伴奏が少し沈む
//    ・楽器を左右に置く(低音・キック・スネア・メロディはまんなか、分散和音は1音ずつ左右に、ハモりは右、和音は広げる)
//    ・曲全体を通り道に通す：低い音域を持ち上げ、耳に痛い高さを少し下げ、軽いコンプでまとめる
//  曲の書き方：
//    chords  "C|G/B|Am7 G|..." 小節を | で区切る。1小節に2つ・4つ書くと等分する
//    lead/harm  MML。o5(オクターブ) c d e f g a b(+ でシャープ、- でフラット) 数字は長さ(4=4分、8.=付点8分)、r 休み、
//               < > でオクターブ下・上、v12 で強さ(1〜15)、| は小節線(位置がずれていたら BGM_FULL_WARN に書く)
//               配列なら今の曲(TRACKS)のメロディと同じ8分音符の並び
//    bass    16分音符16個で1小節(| で区切って何小節か書くとくり返す)。1 根音(分数コードは下の音)、3 5 7 和音の音、
//            8 1オクターブ上の根音、p 次の和音の半音下(つなぎ)、. のばす、- 休み
//    arp     16分音符ごとの和音の何番目の音か(0〜9。和音の数を超えると1オクターブ上)。. は鳴らさない
//    stab    x で和音をまとめて短く鳴らす
//    kick/snare/hat/tom  x ふつう、X 強く、g(スネア)弱く、o(ハイハット)開いた音、h m l(タム)高・中・低
//    fill    最後の小節のドラムを FULL_FILLS のものに替える。fill4 は8小節の4小節目の終わりに軽いフィル
//    riser   最後の何小節かでノイズの上昇音。crash で区切りの頭にシンバル。dbl で1オクターブ下を三角波で重ねる
//    choir   コーラスの和音(1つか配列)。{ type:"male"/"female"/"whisper", vowel:"a", to:"a"(母音を変えていく先), lo(和音を並べる下の音),
//            vol, pat(16分音符の並び。x で歌い始め . でのばす。なければ和音が変わるところで和音の長さだけのばす), attack }
//    chant   コーラスが歌う旋律。{ mml, type, vowel, to, vol, oct(重ねる音程。-12 で1オクターブ下も) }
//------------------------------------------------------------------------------
const FULL_LEAD_VOL = 0.035;    //メロディの矩形波の音量(今の曲と同じ)
const FULL_HARM_VOL = 0.022;    //ハモり・対旋律(パルス波)の音量
const FULL_DBL_VOL = 0.05;      //メロディの1オクターブ下の重ね(三角波)の音量
const FULL_STAB_VOL = 0.011;    //和音の刻み(矩形波)の1音の音量
const FULL_VIB = 18;            //長い音のビブラートの深さ(セント)
const FULL_VIB_DELAY = 0.16;    //ビブラートがかかり始めるまで(秒)
const FULL_HOLD = 4;            //この長さ(16分音符いくつ)以上の音は、のばす鳴らし方にする
//音の厚み(軽く聞こえないよう、低いところと真ん中を埋める。残響や音をずらした重ねは使わない)
const FULL_BASS_BODY = 0.75;    //低音に同じ高さで重ねる正弦波(低音の音量に掛ける)。芯を太くする
const FULL_BASS_SUB = 0.4;      //のばす低音(三角波・正弦波)に1オクターブ下で重ねる正弦波(低音の音量に掛ける)
const FULL_BODY_VOL = 0.008;    //低めの和音ののばし(のこぎり波をこもらせた音)の1音の音量。区切りの body で替えられる(0で鳴らさない)
const FULL_BODY_CUT = 900;      //低めの和音ののばしをこもらせる周波数(Hz)
const FULL_LEAD_SUB = 0.022;    //メロディ(矩形波)の1オクターブ下に重ねる三角波の音量(dbl のない区切り)
const FULL_KICK_BODY = 0.32;    //キックに重ねる低い胴鳴りの音量
const FULL_SNARE_BODY = 0.12;   //スネアに重ねる胴鳴り(中くらいの高さのノイズ)の音量
const FULL_BASS_CUT0 = 1400;    //のこぎり波の低音：はじいた瞬間の明るさ(Hz)
const FULL_BASS_CUT1 = 420;     //のこぎり波の低音：こもっていく先(Hz)
const FULL_BASS_Q = 2;          //のこぎり波の低音のフィルターの鋭さ(少しうなる)
//曲全体の通り道(音響)
const FULL_LOW_HZ = 120;        //低い音域を持ち上げる境目(Hz)
const FULL_LOW_DB = 5;          //低い音域を持ち上げる量(dB)
const FULL_HARSH_HZ = 3200;     //耳に痛い高さ(Hz。矩形波の倍音が集まるところ)
const FULL_HARSH_DB = -2.5;     //耳に痛い高さを下げる量(dB)
const FULL_GLUE_THRESHOLD = -18;//まとめるコンプが効き始める大きさ(dB)
const FULL_GLUE_RATIO = 2.5;    //まとめるコンプの強さ
const FULL_MAKEUP = 0.62;       //通り道の出口の音量(今の曲と同じくらいの大きさにそろえる。曲ごとの gain も掛ける)
const FULL_DUCK = 0.78;         //キックの瞬間に伴奏が沈む先(1で沈まない)
const FULL_DUCK_BACK = 0.16;    //沈んだ伴奏が戻るまで(秒)
//左右の配置(-1 左 〜 1 右)。低音・キック・スネア・メロディはまんなか
const FULL_PAN_ARP = 0.35;      //分散和音を1音ずつ左右に揺らす幅
const FULL_PAN_HARM = 0.3;      //ハモり・対旋律(右寄り)
const FULL_PAN_STAB = 0.45;     //和音の刻みを広げる幅
const FULL_PAN_BODY = 0.3;      //低めの和音ののばしを広げる幅
const FULL_PAN_PAD = 0.4;       //正弦波の和音を広げる幅
const FULL_PAN_HAT = 0.22;      //ハイハット(右寄り)
const FULL_PAN_CYMBAL = 0.2;    //シンバル(左寄り)
//コーラス(合成の声。のこぎり波・ノイズを、母音ごとの響きの山(フォルマント)を通すフィルターにかける)
const FULL_CHOIR_DETUNE = 7;    //1つの声を2本の発振器で鳴らすときのずれ(セント)。合唱らしく少し揺らす
const FULL_CHOIR_VIB = 10;      //声のビブラートの深さ(セント)
const FULL_CHOIR_BREATH = 0.06; //声に混ぜる息の音の量
const FULL_CHOIR_REV = 0.22;    //コーラスにだけかける響きの量(0でかけない。bgmFull.choirRev で替えられる)
const FULL_CHOIR_REV_LEN = 1.8; //コーラスの響きの長さ(秒)
const FULL_CHOIR_PAN = 0.5;     //コーラスの和音を左右に広げる幅
//母音ごとの響きの山の周波数(Hz)。男声・女声
const FULL_FORMANTS = {
    male:   { a:[700,1220,2600], o:[400,750,2400], u:[320,700,2400], e:[400,1900,2550], i:[280,2250,2900] },
    female: { a:[850,1220,2810], o:[450,850,2830], u:[370,950,2670], e:[440,2300,2900], i:[310,2790,3310] }
};
const FULL_FORMANT_GAIN = [1, 0.5, 0.2];   //響きの山ごとの強さ
const FULL_FORMANT_Q = [7, 9, 12];         //響きの山の鋭さ
const FULL_CHOIR_GAIN = 6;      //コーラス全体の音量(母音のフィルターで細くなる分を戻す)
var BGM_FULL_WARN = [];         //楽譜の書き間違い(小節線のずれ・長さの違い)

//ドラムのフィル(1小節。lite は fill4 で最後の4つだけ替える)
var FULL_FILLS = {
    lite:  { kick:"....", snare:"x.xx", hat:"....", tom:"", from:12 },
    snare: { kick:"x...x...x.......", snare:"........x.x.xxxx", hat:"x.x.x.x.........", tom:"", cresc:true },
    toms:  { kick:"x.......x.......", snare:"....x...........", hat:"x.x.x.x.........", tom:"........h.hm.ml." },
    build: { kick:"x...x...x...x...", snare:"x...x...x.x.xxxx", hat:"", tom:"", cresc:true },
    soft:  { kick:"x...............", snare:"", hat:"x.x.x.x.x.x.....", tom:"............h.m." }
};

//------------------------------------------------------------ 曲
var BGM_FULL = (function(){
    //区切りを写して一部を替える(派生した曲・2回目の区切りに使う)
    function ext(_a,_b){
        var o = {}, k;
        for(k in _a) if(k.charAt(0) != "_") o[k] = _a[k];
        for(k in _b) o[k] = _b[k];
        return o;
    }
    var SONGS = {};

    //---------------- タイトル・序盤のストーリー(ハ長調 88)
    //  前奏(分散和音だけ) → A 三角波のやさしいメロディ → B 矩形波で高くのびる → A' 対旋律つき → つなぎ
    var tA = {
        bars:8, chords:"Cmaj7|Fmaj7|Am7|G|Fmaj7|Em7|Dm7|Gsus4 G",
        lead:"o5 e4. d8 c4 o4 g4 | o5 a2 g4 f8 e8 | e4. d8 c4 e4 | d2. r4 | c4. d8 e4 f4 | g2 b8 a8 g4 | f4. e8 d4 c4 | d2 r4 o4 b4 |",
        leadType:"triangle", leadVol:0.058,
        bass:"1.......5.......", bassType:"triangle", bassVol:0.2,
        arp:"0.1.2.3.4.3.2.1.", arpType:"triangle", arpVol:0.045, arpLen:1.8,
        pad:0.02,
        kick:"x.......x.......", hat:"....x.......x..."
    };
    SONGS.title = {
        bpm:88, gain:0.75, intro:["I"], loop:["A","B","A2","T"],
        sec:{
            I:{ bars:4, chords:"Cmaj7|Fmaj7|Am7|G",
                bass:"1.......5.......", bassType:"triangle", bassVol:0.2,
                arp:"0.1.2.3.4.3.2.1.", arpType:"triangle", arpVol:0.05, arpLen:1.8, pad:0.025,
                kick:"x...............", hat:"................" },
            A:tA,
            B:{ bars:8, chords:"Am7|Em7|Fmaj7|C/E|Dm7|Em7|Fmaj7|G",
                lead:"o5 r8 e8 a8 b8 o6 c4 o5 b8 a8 | g4. a8 b4 g4 | a4. g8 a4 o6 c4 | o5 g2 e4 g4 | f4. e8 f4 a4 | g4. a8 b4 o6 d4 | c4 o5 a4 o6 c4 e4 | d1 |",
                leadType:"square", leadVol:0.025, leadCut:2000,
                harm:"o4 a1 | b1 | a1 | g1 | a1 | b1 | a1 | b2 o5 d2 |", harmVol:0.018,
                bass:"1.......5.......|1.......5...8...", bassType:"triangle", bassVol:0.2,
                arp:"0.1.2.3.4.3.2.1.", arpType:"triangle", arpVol:0.045, arpLen:1.8, pad:0.02,
                kick:"x.......x.......", snare:"....g.......g...", hat:"..x...x...x...x.", fill:"soft" },
            A2:ext(tA, { leadType:"square", leadVol:0.025, leadCut:2000,
                harm:"o4 g1 | a1 | g1 | g1 | a1 | b1 | a1 | a2 b2 |", harmVol:0.018,
                arp:"0123432101234321", arpVol:0.035, arpLen:1.2, hat:"..x...x...x...x." }),
            T:{ bars:4, chords:"Fmaj7|G/F|Em7 Am7|Dm7 G7",
                lead:"o5 a4 g4 f4 e4 | d2 o4 b4 o5 d4 | e2 c2 | d2 o4 b2 |", leadType:"triangle", leadVol:0.058,
                bass:"1.......1.......|1.......1.......|1.......1.......|1.......1...p...", bassType:"triangle", bassVol:0.2,
                arp:"0.1.2.3.4.3.2.1.", arpType:"triangle", arpVol:0.045, arpLen:1.8, pad:0.02,
                kick:"x...............", hat:"....x.......x..." }
        }
    };

    //---------------- 中盤のストーリー・エンディング(イ短調 84)
    SONGS.unease = {
        bpm:84, gain:0.75, intro:["I"], loop:["A","B"],
        sec:{
            I:{ bars:2, chords:"Am7|Am7", bass:"1...............", bassType:"triangle", bassVol:0.2,
                arp:"0...1...2...1...", arpType:"triangle", arpVol:0.05, arpLen:2.5, pad:0.025 },
            A:{ bars:8, chords:"Am7|Fmaj7|C|G|Am7|Fmaj7|Dm7|E7sus4 E7",
                lead:"o5 r4 e4 a4 g4 | e2. r4 | r4 g4 o6 c4 o5 b4 | b2. r4 | r4 e4 a4 b4 | o6 c2. o5 a4 | f2 e4 d4 | e2 g+2 |",
                leadType:"triangle", leadVol:0.05,
                bass:"1.......1.......", bassType:"triangle", bassVol:0.2,
                arp:"0.1.2.1.0.1.2.1.", arpType:"triangle", arpVol:0.045, arpLen:1.8, pad:0.025,
                kick:"x...............", hat:"....x.......x..." },
            B:{ bars:8, chords:"Fmaj7|G|Em7|Am7|Dm7|Em7|Fmaj7|E7",
                lead:"o5 a2 o6 c2 | o5 b2 o6 d2 | e1 | c2 o5 a2 | f2 a2 | g2 b2 | o6 c2 o5 a4 f4 | g+2 b2 |",
                leadType:"square", leadVol:0.023, leadCut:1800,
                harm:"o4 f1 | g1 | g1 | a1 | a1 | b1 | a1 | g+1 |", harmVol:0.016,
                bass:"1.......5.......", bassType:"triangle", bassVol:0.2,
                arp:"0.1.2.3.2.1.2.3.", arpType:"triangle", arpVol:0.045, arpLen:1.8, pad:0.025,
                kick:"x.......x.......", hat:"....x.......x...", fill:"soft" }
        }
    };

    //---------------- 序盤の戦闘(ハ長調 150。WAVE1〜7)
    //  前奏(ファンファーレ) → A 今のメロディ → B 短調へ寄って畳みかける → サビ 高くのびるメロディとハモり → A' 対旋律つき → 落として盛り上げ直す
    var hA = {
        bars:8, chords:"C|G|Am|F|C|G|F|G", lead:TRACKS.heroic.lead,
        bass:"1-8-1-811-8-1-81", bassType:"sawtooth", bassVol:0.12,
        arp:"0123450123450123", arpType:"square", arpVol:0.016,
        kick:"x...x...x...x...", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.",
        crash:true, fill4:true, fill:"snare"
    };
    SONGS.heroic = {
        bpm:150, intro:["I"], loop:["A","B","C","A2","D"],
        sec:{
            I:{ bars:4, chords:"C|C|F|G",
                lead:"o5 g8 g8 g8 o6 c4 o5 g8 o6 c4 | e2. r4 | o5 a8 a8 a8 o6 c4 o5 a8 o6 c4 | d2 r8 o4 g8 a8 b8 |",
                harm:"o5 e8 e8 e8 g4 e8 g4 | o6 c2. r4 | o5 f8 f8 f8 a4 f8 a4 | b2 r2 |",
                bass:"1-8-1-811-8-1-81", bassType:"sawtooth", bassVol:0.12,
                stab:"x.....x.....x...",
                kick:"x...x...x...x...", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.", crash:true, fill:"toms" },
            A:hA,
            B:{ bars:8, chords:"Am|Em|F|C|Dm|G|Bb|G",
                lead:"o5 r8 a8 o6 c8 d8 e4 d8 c8 | o5 b4 g8 e8 g4 b4 | r8 a8 o6 c8 f8 e4 d8 c8 | o5 g4. e8 g4 o6 c4 | o5 r8 d8 f8 g8 a4 g8 f8 | b4 g8 d8 g4 b4 | b-4 o6 d4 f4 d4 | o5 g2 r8 g8 a8 b8 |",
                bass:"1-8-1-811-8-1-81", bassType:"sawtooth", bassVol:0.12,
                arp:"0123432101234321", arpType:"square", arpVol:0.015,
                kick:"x.....x.x.....x.", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.",
                crash:true, fill:"snare", riser:1 },
            C:{ bars:8, chords:"F|G|Em|Am|Dm7|Em7|F|G",
                lead:"o6 c2 o5 a4 o6 c4 | d2 o5 b4 o6 d4 | e4. d8 e4 g4 | e2 c2 | f4. e8 d4 c4 | o5 b4. o6 c8 d4 e4 | f2. e4 | d2. r4 |",
                harm:"o5 a2 f4 a4 | b2 g4 b4 | g4. g8 g4 b4 | o6 c2 o5 a2 | a4. a8 a4 a4 | g4. a8 b4 b4 | a2. g4 | b2. r4 |",
                dbl:-12,
                bass:"1-8-1-8-1-8-1-8-", bassType:"sawtooth", bassVol:0.12,
                stab:"--x---x---x---x-",
                kick:"x...x...x...x...", snare:"....x.......x...", hat:"x.o.x.o.x.o.x.o.",
                crash:true, fill4:true, fill:"toms" },
            A2:ext(hA, { harm:"o4 g2 e2 | g2 d2 | e2 c2 | f2 a2 | g2 e2 | d2 g2 | a2 f2 | g2 b2 |" , fill:null }),
            D:{ bars:4, chords:"Am|F|G|G",
                lead:"o5 a4 o6 c4 e4 c4 | o5 a4 o6 c4 f4 c4 | o5 b2 o6 d2 | r1 |", leadType:"triangle", leadVol:0.05,
                bass:"1...............", bassType:"sawtooth", bassVol:0.11,
                arp:"0.1.2.3.0.1.2.3.", arpType:"square", arpVol:0.016,
                kick:"x.......x.......", fill:"build", riser:2 }
        }
    };

    //---------------- 中盤の戦闘(イ短調 138。WAVE8〜15)
    var bA = {
        bars:8, chords:"Am|Am|F|G|Dm|Dm|E|E", lead:TRACKS.battle.lead,
        bass:"1-811-811-811-81", bassType:"sawtooth", bassVol:0.13,
        arp:"0123450123450123", arpType:"square", arpVol:0.018,
        kick:"x...x...x...x...", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.",
        crash:true, fill4:true, fill:"snare"
    };
    SONGS.battle = {
        bpm:138, intro:["I"], loop:["A","B","C","A2","D"],
        sec:{
            I:{ bars:4, chords:"Am|Am|F|E",
                lead:"r1 | r1 | o5 a8 b8 o6 c8 d8 e8 f8 e8 d8 | o5 b2 g+2 |",
                bass:"1181118111811181", bassType:"sawtooth", bassVol:0.12,
                stab:"x..x..x.x..x..x.",
                kick:"x...x...x...x...", hat:"x.x.x.x.x.x.x.x.", crash:true, fill:"snare", riser:2 },
            A:bA,
            B:{ bars:8, chords:"F|G|C|Am|Dm|G7|E7|E",
                lead:"o5 a8 a16 a16 o6 c8 o5 a8 g8 f8 g8 a8 | b8 b16 b16 o6 d8 o5 b8 a8 g8 a8 b8 | o6 c4 o5 g4 o6 e4 d8 c8 | o5 a2. r4 | f8 f16 f16 a8 f8 e8 d8 e8 f8 | g8 g16 g16 b8 g8 f8 e8 f8 g8 | g+4 b4 o6 e4 d4 | o5 b2 g+4 e4 |",
                bass:"1-811-811-811-81", bassType:"sawtooth", bassVol:0.13,
                arp:"0.1.2.3.4.3.2.1.", arpType:"square", arpVol:0.018,
                kick:"x.....x.x.....x.", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.",
                crash:true, fill:"build", riser:1 },
            C:{ bars:8, chords:"Am|F|C|G|F|G|E|E",
                lead:"o6 e2 o5 a4 o6 c4 | c4. d8 c4 o5 a4 | g2 o6 c4 e4 | d2. r4 | c4. d8 e4 f4 | g4. f8 e4 d4 | e2 o5 b4 g+4 | o6 e2. r4 |",
                harm:"o6 c2 o5 e4 a4 | a4. b8 a4 f4 | e2 g4 o6 c4 | o5 b2. r4 | a4. b8 o6 c4 d4 | e4. d8 o5 b4 g4 | g+2 g+4 e4 | b2. r4 |",
                dbl:-12,
                bass:"1-811-811-811-81", bassType:"sawtooth", bassVol:0.13,
                stab:"--x---x---x---x-",
                kick:"x...x...x...x...", snare:"....x.......x...", hat:"x.o.x.o.x.o.x.o.",
                crash:true, fill4:true, fill:"toms" },
            A2:ext(bA, { harm:"o4 e1 | e1 | a1 | b1 | a1 | a1 | g+1 | g+1 |", harmVol:0.018 }),
            D:{ bars:4, chords:"Dm|Dm|E7|E",
                lead:"o5 d4 f4 a4 f4 | d4 f4 a4 o6 d4 | o5 b2 o6 d2 | e2 r2 |", leadType:"triangle", leadVol:0.05,
                bass:"1...............", bassType:"sawtooth", bassVol:0.12,
                arp:"0.1.2.3.0.1.2.3.", arpType:"square", arpVol:0.018,
                kick:"x.......x.......", fill:"build", riser:2 }
        }
    };

    //---------------- ボス戦(ニ短調 152)
    var xA = {
        bars:8, chords:"Dm|Dm|Bb|C|Dm|Dm|A|A", lead:TRACKS.boss.lead,
        bass:"1181118111811181", bassType:"sawtooth", bassVol:0.12,
        arp:"0.12.34.5.01.23.", arpType:"square", arpVol:0.02,
        kick:"x..x..x.x..x..x.", snare:"....x.......x..x", hat:"x.x.x.x.x.x.x.x.",
        crash:true, fill4:true, fill:"snare"
    };
    SONGS.boss = {
        bpm:152, intro:["I"], loop:["A","B","C","A2"],
        sec:{
            I:{ bars:4, chords:"Dm|Dm|Bb|A",
                lead:"r1 | r1 | o5 f8 r8 f8 r8 f8 g8 a8 b-8 | o6 c+2 o5 a2 |",
                bass:"1181118111811181", bassType:"sawtooth", bassVol:0.12,
                stab:"x..x..x.........",
                kick:"x..x..x.x..x..x.", hat:"x.x.x.x.x.x.x.x.", crash:true, fill:"toms", riser:2 },
            A:xA,
            B:{ bars:8, chords:"Gm|Gm|Dm|Dm|Bb|C|A|A",
                lead:"o5 g8 g8 b-8 g8 o6 d4 c8 o5 b-8 | a8 g8 f8 g8 d4 r4 | f8 f8 a8 f8 o6 d4 c8 o5 a8 | g8 f8 e8 f8 d4 r4 | b-4 o6 d4 f4 d4 | o5 c4 e4 g4 o6 c4 | o5 c+4 e4 a4 e4 | a8 g8 f8 e8 d8 c+8 o4 b-8 a8 |",
                bass:"1181118111811181", bassType:"sawtooth", bassVol:0.12,
                arp:"0.12.34.5.01.23.", arpType:"square", arpVol:0.02,
                kick:"x..x..x.x..x..x.", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.",
                crash:true, fill:"build", riser:1 },
            C:{ bars:8, chords:"Dm7|Bb|F|C|Gm|Bb|A|A",
                lead:"o5 a2 o6 d4 e4 | f2 d4 o5 b-4 | o6 c2 o5 a4 o6 c4 | e2 d4 c4 | d2 o5 b-4 o6 d4 | f2 d4 f4 | e2 c+4 o5 a4 | o6 c+2 e2 |",
                harm:"o5 f2 a4 o6 c4 | d2 o5 b-4 f4 | a2 f4 a4 | o6 c2 o5 b4 a4 | b-2 g4 b-4 | o6 d2 o5 b-4 o6 d4 | c+2 o5 a4 e4 | a2 o6 c+2 |",
                dbl:-12,
                bass:"1181118111811181", bassType:"sawtooth", bassVol:0.12,
                stab:"x--x--x---x--x--",
                kick:"x.x.x.x.x.x.x.x.", snare:"....x.......x...", hat:"x.o.x.o.x.o.x.o.",
                crash:true, fill4:true, fill:"toms" },
            A2:ext(xA, { dbl:-12, stab:"x--x--x---x--x--", arp:null })
        }
    };

    //---------------- ドローン君改の第二形態(ハ短調 168)：ボス戦の曲を全音下げ、ドラムを細かく。最後に大きな橋渡し(E)
    var B = SONGS.boss.sec, KAI_DRUM = { kick:"x.xx..x.x.xx..x.", snare:"....x.......x.xx", hat:"xxxxxxxxxxxxxxxx" };
    SONGS.kai2 = {
        bpm:168, intro:["I"], loop:["A","B","C","A2","E"],
        sec:{
            I:{ bars:2, chords:"Cm|Cm",
                bass:"1111111111111111", bassType:"sawtooth", bassVol:0.14,
                stab:"x..x..x.x..x..x.",
                kick:KAI_DRUM.kick, hat:KAI_DRUM.hat, crash:true, fill:"toms", riser:2 },
            A:ext(B.A, ext(KAI_DRUM, { tr:-2, arp:"0123450123450123", pad:0.012, bassVol:0.14 })),
            B:ext(B.B, ext(KAI_DRUM, { tr:-2, pad:0.012, bassVol:0.14 })),
            C:ext(B.C, { tr:-2, hat:KAI_DRUM.hat, bassVol:0.14 }),
            A2:ext(B.A2, ext(KAI_DRUM, { tr:-2, bassVol:0.14 })),
            E:{ bars:8, chords:"Ab|Bb|Gm|Cm|Ab|Bb|G|G",
                lead:"o5 c2 e-4 a-4 | d2 f4 b-4 | o6 d2 o5 b-4 g4 | o6 c1 | e-2 c4 e-4 | f2 d4 f4 | g2 d4 o5 b4 | b2 o6 d2 |",
                harm:"o4 a-1 | b-1 | b-1 | g1 | o5 c1 | d1 | d1 | g1 |",
                dbl:-12,
                bass:"1.......1.......", bassType:"sawtooth", bassVol:0.14,
                arp:"0123450123450123", arpType:"square", arpVol:0.018, pad:0.02,
                kick:"x.......x.......", snare:"........x.......", hat:"x.x.x.x.x.x.x.x.",
                crash:true, fill:"build", riser:2 }
        }
    };

    //---------------- ライバル(ホ短調 164)：B はメロディとパルス波が追いかけ合う(せり合い)
    var rA = {
        bars:8, chords:"Em|C|D|B|Em|C|D|B", lead:TRACKS.rival.lead,
        bass:"1-811-811-811-81", bassType:"sawtooth", bassVol:0.12,
        arp:"0.123.450.123.45", arpType:"square", arpVol:0.017,
        kick:"x..x..x.x..x..x.", snare:"....x.......x...", hat:"xxx.xxx.xxx.xxx.",
        crash:true, fill4:true, fill:"snare"
    };
    SONGS.rival = {
        bpm:164, intro:["I"], loop:["A","B","C","A2"],
        sec:{
            I:{ bars:4, chords:"Em|C|D|B",
                lead:"o5 e16 f+16 g16 a16 b16 o6 c16 d16 e16 r2 | o5 e16 g16 o6 c16 e16 r2. | o5 f+16 a16 o6 d16 f+16 r2. | d+4 o5 b4 f+4 d+4 |",
                harm:"r2 o5 e16 f+16 g16 a16 b16 o6 c16 d16 e16 | r4 o5 e16 g16 o6 c16 e16 r2 | r4 o5 f+16 a16 o6 d16 f+16 r2 | o5 b4 f+4 d+4 o4 b4 |",
                bass:"1-811-811-811-81", bassType:"sawtooth", bassVol:0.12,
                kick:"x..x..x.x..x..x.", snare:"....x.......x...", hat:"xxx.xxx.xxx.xxx.", crash:true, fill:"toms" },
            A:rA,
            B:{ bars:8, chords:"Am|B|Em|G|C|D|B7|B7",
                lead:"o5 e8 a8 o6 c8 e8 r2 | o5 d+8 f+8 b8 o6 d+8 r2 | o5 e8 g8 b8 o6 e8 r2 | o5 d8 g8 b8 o6 d8 r2 | e4. d8 c4 e4 | f+4. e8 d4 f+4 | d+2 o5 b4 a4 | b2. r4 |",
                harm:"r2 o5 a8 e8 c8 o4 a8 | r2 o5 b8 f+8 d+8 o4 b8 | r2 o5 b8 g8 e8 o4 b8 | r2 o5 b8 g8 d8 o4 b8 | o5 g4. g8 g4 o6 c4 | o5 a4. a8 a4 o6 d4 | o5 b2 f+4 d+4 | d+2. r4 |",
                harmVol:0.026,
                bass:"1-811-811-811-81", bassType:"sawtooth", bassVol:0.12,
                kick:"x.....x.x.....x.", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.",
                crash:true, fill:"build", riser:1 },
            C:{ bars:8, chords:"C|D7|Bm|Em|C|D|B|B",
                lead:"o5 g4 o6 c4 e4. d8 | f+2 e4 d4 | d2 o5 b4 o6 d4 | e2 o5 b4 g4 | o6 e2 g4 e4 | f+2 d4 f+4 | f+2 d+4 o5 b4 | o6 d+2. r4 |",
                harm:"o5 e4 g4 o6 c4. o5 b8 | o6 d2 c4 o5 b4 | b2 f+4 b4 | b2 g4 e4 | o6 c2 e4 c4 | d2 o5 a4 o6 d4 | d+2 o5 b4 f+4 | b2. r4 |",
                dbl:-12,
                bass:"1-811-811-811-81", bassType:"sawtooth", bassVol:0.12,
                stab:"--x---x---x---x-",
                kick:"x...x...x...x...", snare:"....x.......x...", hat:"x.o.x.o.x.o.x.o.",
                crash:true, fill4:true, fill:"toms" },
            A2:ext(rA, { harm:"o4 b1 | o5 e1 | d1 | d+1 | o4 b1 | o5 e1 | d1 | d+1 |", harmVol:0.018, dbl:-12, arp:null })
        }
    };

    //---------------- 人間との戦い(ホ短調 146。WAVE16〜)：A は今の曲、ほかは中盤の戦闘の区切りを5つ下げて、重いドラムで
    var W = SONGS.battle.sec, REV_DRUM = { kick:"x..x..x.x..x..x.", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.", pad:0.012, bassVol:0.14 };
    SONGS.revolt = {
        bpm:146, intro:["I"], loop:["A","B","C","A2","D"],
        sec:{
            I:ext(W.I, { tr:-5, kick:REV_DRUM.kick, bassVol:0.14 }),
            A:ext(bA, ext(REV_DRUM, { chords:"Em|Em|C|D|Am|Am|B|B", lead:TRACKS.revolt.lead, arp:"0.12.34.5.01.23." })),
            B:ext(W.B, ext(REV_DRUM, { tr:-5 })),
            C:ext(W.C, { tr:-5, kick:REV_DRUM.kick, pad:0.012, bassVol:0.14 }),
            A2:ext(bA, ext(REV_DRUM, { chords:"Em|Em|C|D|Am|Am|B|B", lead:TRACKS.revolt.lead, arp:null, dbl:-12,
                harm:"o4 b1 | b1 | g1 | a1 | a1 | a1 | f+1 | f+1 |", harmVol:0.018 })),
            D:ext(W.D, { tr:-5 })
        }
    };

    //---------------- 強化画面(ハ長調 96。8分音符を跳ねさせる)
    SONGS.shop = {
        bpm:96, gain:0.8, swing:0.45, intro:["I"], loop:["A","B"],
        sec:{
            I:{ bars:2, chords:"Dm7|G7",
                bass:"1.....5...8.....", bassType:"sine", bassVol:0.3,
                arp:"0..1..2.3..2..1.", arpType:"triangle", arpVol:0.05, pad:0.02,
                kick:"x.........x.....", hat:"..x...x...x...x." },
            A:{ bars:8, chords:"Fmaj7|Em7|Dm7|Cmaj7|Fmaj7|Em7|Dm7 G7|Cmaj7",
                lead:"o5 r8 a8 o6 c8 e8 d4 c8 o5 a8 | b4 g8 e8 g4 r4 | r8 f8 a8 o6 c8 d4 c8 o5 a8 | e2. r4 | r8 a8 o6 c8 e8 f4 e8 c8 | o5 b4 o6 d8 c8 o5 b4 g4 | a4 f4 g4 b4 | o6 c2. r4 |",
                leadType:"square", leadVol:0.023, leadCut:1800,
                bass:"1.....5...8.....", bassType:"sine", bassVol:0.3,
                arp:"0..1..2.3..2..1.", arpType:"triangle", arpVol:0.045, pad:0.02,
                kick:"x.........x.....", snare:"....g.......g...", hat:"..x...x...x...x." },
            B:{ bars:8, chords:"Am7|Dm7|G7|Cmaj7|Fmaj7|Bm7b5 E7|Am7 D7|Dm7 G7",
                lead:"o5 e4. g8 a4 o6 c4 | o5 f4. a8 o6 c4 o5 a4 | g4 b4 o6 d4 f4 | e2. r4 | e4. c8 o5 a4 f4 | d4 f4 e4 g+4 | a4 o6 c4 o5 a4 f+4 | f4 a4 g2 |",
                leadType:"square", leadVol:0.023, leadCut:1800,
                harm:"o4 g1 | a1 | b1 | b1 | a1 | a2 g+2 | g2 f+2 | f2 f2 |", harmVol:0.016,
                bass:"1.....5...8.....", bassType:"sine", bassVol:0.3,
                arp:"0..1..2.3..2..1.", arpType:"triangle", arpVol:0.045, pad:0.02,
                kick:"x.........x.....", snare:"....g.......g...", hat:"..x...x...x...x.", fill:"soft" }
        }
    };
    return SONGS;
})();

//------------------------------------------------------------ 楽譜を読む
var bgmFull = (function(){
    var NOTE = { c:0, d:2, e:4, f:5, g:7, a:9, b:11 };
    //和音の種類 → 根音からの音程
    var QUAL = {
        "":[0,4,7], "m":[0,3,7], "7":[0,4,7,10], "maj7":[0,4,7,11], "m7":[0,3,7,10], "sus4":[0,5,7], "sus2":[0,2,7],
        "7sus4":[0,5,7,10], "add9":[0,4,7,2], "madd9":[0,3,7,2], "dim":[0,3,6], "dim7":[0,3,6,9], "m7b5":[0,3,6,10],
        "aug":[0,4,8], "6":[0,4,7,9], "m6":[0,3,7,9], "9":[0,4,7,10,2], "m9":[0,3,7,10,2], "maj9":[0,4,7,11,2]
    };
    function warn(_s){ if(BGM_FULL_WARN.indexOf(_s) < 0) BGM_FULL_WARN.push(_s); }
    function pc(_s){ return NOTE[_s.charAt(0).toLowerCase()] + (_s.charAt(1) == "#" ? 1 : _s.charAt(1) == "b" ? -1 : 0); }

    //"G7/B" → { root(36〜47), iv:[音程], bass }
    function parseChord(_s,_tr,_where){
        var m = /^([A-G][#b]?)([^\/]*)(?:\/([A-G][#b]?))?$/.exec(_s);
        if(!m || !QUAL[m[2]]){ warn(_where + " 和音 " + _s); return { root:36, iv:[0,4,7], bass:36 }; }
        var r = ((pc(m[1]) + _tr) % 12 + 12) % 12 + 36;
        var b = m[3] ? ((pc(m[3]) + _tr) % 12 + 12) % 12 + 36 : r;
        return { root:r, iv:QUAL[m[2]], bass:b, name:_s };
    }
    function parseChords(_str,_bars,_tr,_where){
        var bars = _str.split("|"), out = [];
        if(bars.length != _bars) warn(_where + " 和音の小節の数 " + bars.length);
        for(var i=0; i<_bars; i++){
            var cs = (bars[i % bars.length] || "C").trim().split(/\s+/), len = 16 / cs.length;
            for(var j=0; j<cs.length; j++){
                var c = parseChord(cs[j], _tr, _where);
                for(var k=0; k<len; k++) out.push(c);
            }
        }
        return out;
    }

    //MML → [{ pos(16分音符いくつ目), n, len, vel }]
    function parseMml(_s,_tr,_where){
        var ev = [], pos = 0, oct = 4, vel = 12, i = 0, tie = false, last = null;
        function num(){ var m = /^\d+/.exec(_s.slice(i)); if(!m) return null; i += m[0].length; return parseInt(m[0], 10); }
        function len(){
            var d = num(), l = 16 / (d || 8), add = l;
            while(_s.charAt(i) == "."){ add /= 2; l += add; i++; }
            return l;
        }
        while(i < _s.length){
            var ch = _s.charAt(i).toLowerCase();
            if(" \t\n\r".indexOf(ch) >= 0){ i++; continue; }
            if(ch == "|"){ if(Math.abs(pos - Math.round(pos/16)*16) > 0.001) warn(_where + " 小節線のずれ " + pos.toFixed(2)); i++; continue; }
            if(ch == ">"){ oct++; i++; continue; }
            if(ch == "<"){ oct--; i++; continue; }
            if(ch == "o"){ i++; oct = num(); continue; }
            if(ch == "v"){ i++; vel = num(); continue; }
            if(ch == "&"){ tie = true; i++; continue; }
            if(ch == "r"){ i++; pos += len(); last = null; continue; }
            if(NOTE[ch] !== undefined){
                i++;
                var n = (oct + 1)*12 + NOTE[ch];
                while(_s.charAt(i) == "+" || _s.charAt(i) == "#" || _s.charAt(i) == "-"){ n += _s.charAt(i) == "-" ? -1 : 1; i++; }
                var l = len();
                if(tie && last && last.n == n + _tr) last.len += l;
                else{ last = { pos:pos, n:n + _tr, len:l, vel:vel/12 }; ev.push(last); }
                tie = false;
                pos += l;
                continue;
            }
            warn(_where + " 読めない文字 " + ch);
            i++;
        }
        return { ev:ev, len:pos };
    }
    //今の曲の8分音符の並び → 音符
    function fromGrid(_a,_tr){
        var ev = [];
        for(var i=0; i<_a.length; i++) if(_a[i]) ev.push({ pos:i*2, n:_a[i] + _tr, len:2, vel:1 });
        return { ev:ev, len:_a.length*2 };
    }
    //16分音符ごとの入れ物に分ける(3連符などの半端な位置は off に持つ)
    function bucket(_r,_steps){
        var b = [];
        for(var i=0; i<_steps; i++) b.push(null);
        for(var i=0; i<_r.ev.length; i++){
            var e = _r.ev[i], k = Math.floor(e.pos + 0.0001);
            e.off = e.pos - k;
            if(k >= _steps) continue;
            (b[k] = b[k] || []).push(e);
        }
        return b;
    }
    function melody(_src,_sec,_where){
        if(!_src) return null;
        var steps = _sec.bars*16, tr = _sec.tr || 0;
        var r = typeof _src == "string" ? parseMml(_src, tr, _where) : fromGrid(_src, tr);
        if(Math.abs(r.len - steps) > 0.001) warn(_where + " 長さ " + r.len + "(" + steps + " のはず)");
        return bucket(r, steps);
    }

    function prepSong(_id){
        var S = BGM_FULL[_id];
        if(S._ready) return S;
        for(var k in S.sec){
            var c = S.sec[k], w = _id + "." + k;
            c._ch = parseChords(c.chords, c.bars, c.tr || 0, w);
            c._lead = melody(c.lead, c, w + ".lead");
            c._harm = melody(c.harm, c, w + ".harm");
            c._chant = c.chant ? melody(c.chant.mml, c, w + ".chant") : null;
        }
        S._introBars = 0;
        S.intro.forEach(function(k){ S._introBars += S.sec[k].bars; });
        S._loopBars = 0;
        S.loop.forEach(function(k){ S._loopBars += S.sec[k].bars; });
        S._ready = true;
        return S;
    }
    //曲の頭から _bar 小節目は、どの区切りの何小節目か
    function locate(_S,_bar){
        var list = _S.intro, b = _bar;
        if(b >= _S._introBars){ list = _S.loop; b = (b - _S._introBars) % _S._loopBars; }
        for(var i=0; i<list.length; i++){
            var c = _S.sec[list[i]];
            if(b < c.bars) return { sec:c, bar:b, id:list[i] };
            b -= c.bars;
        }
        return { sec:_S.sec[_S.loop[0]], bar:0, id:_S.loop[0] };
    }

    //------------------------------------------------------------ 音を鳴らす
    //  音色は今の音と同じ発振器・ノイズ。全部の音を、曲全体の通り道(bus)に通してから sound.bgmGain へ送る
    //    通り道：低い音域を持ち上げる → 耳に痛い高さを少し下げる → 軽いコンプでまとめる
    //    伴奏(分散和音・刻み・和音ののばし)は、キックに合わせて少し沈む通り道(duck)を通る
    var pulseWave = null, busNodes = null;
    function pulse(_ac){
        if(pulseWave && pulseWave.ac == _ac) return pulseWave.w;
        var n = 48, re = new Float32Array(n), im = new Float32Array(n);
        for(var i=1; i<n; i++) re[i] = 2 / (i*Math.PI) * Math.sin(i*Math.PI*0.25);    //幅25%のパルス波
        pulseWave = { ac:_ac, w:_ac.createPeriodicWave(re, im) };
        return pulseWave.w;
    }
    function bus(){
        var ac = sound.ctx;
        if(busNodes && busNodes.ac === ac && busNodes.to === sound.bgmGain) return busNodes;
        var low = ac.createBiquadFilter();
        low.type = "lowshelf"; low.frequency.value = FULL_LOW_HZ; low.gain.value = FULL_LOW_DB;
        var mid = ac.createBiquadFilter();
        mid.type = "peaking"; mid.frequency.value = FULL_HARSH_HZ; mid.Q.value = 0.9; mid.gain.value = FULL_HARSH_DB;
        var comp = ac.createDynamicsCompressor();
        comp.threshold.value = FULL_GLUE_THRESHOLD; comp.knee.value = 8; comp.ratio.value = FULL_GLUE_RATIO;
        comp.attack.value = 0.008; comp.release.value = 0.18;
        var make = ac.createGain();
        make.gain.value = FULL_MAKEUP;
        low.connect(mid); mid.connect(comp); comp.connect(make); make.connect(sound.bgmGain);
        var duck = ac.createGain();
        duck.connect(low);
        //コーラスにだけかける響き(減衰するノイズを左右で別に作る)
        var conv = ac.createConvolver(), rate = ac.sampleRate, n = Math.floor(rate*FULL_CHOIR_REV_LEN), ib = ac.createBuffer(2, n, rate);
        for(var chn=0; chn<2; chn++){
            var dd = ib.getChannelData(chn);
            for(var i=0; i<n; i++) dd[i] = (Math.random()*2 - 1)*Math.pow(1 - i/n, 3);
        }
        conv.buffer = ib;
        var rev = ac.createGain();
        rev.gain.value = 0;
        conv.connect(rev); rev.connect(low);
        busNodes = { ac:ac, to:sound.bgmGain, main:low, duck:duck, make:make, revIn:conv, rev:rev };
        return busNodes;
    }
    //左右に置いてから通り道へ
    function out(_node,_pan,_duck){
        var B = bus(), n = _node;
        if(_pan){
            var p = sound.ctx.createStereoPanner();
            p.pan.value = _pan;
            n.connect(p); n = p;
        }
        n.connect(_duck ? B.duck : B.main);
    }
    //発振器の1音。_o：type f f1 vol t len(秒) attack cut cut1(こもっていく先) q hold(のばす) vib pan duck
    function voice(_o){
        var ac = sound.ctx, t = _o.t, a = _o.attack || 0.008, end;
        var o = ac.createOscillator();
        if(_o.type == "pulse") o.setPeriodicWave(pulse(ac)); else o.type = _o.type;
        o.frequency.setValueAtTime(_o.f, t);
        if(_o.f1 && _o.f1 != _o.f) o.frequency.exponentialRampToValueAtTime(_o.f1, t + _o.len);
        var g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(_o.vol, t + a);
        if(_o.hold){
            //のばす音：ゆっくり弱まってから離す
            g.gain.exponentialRampToValueAtTime(_o.vol*0.45, t + a + _o.len);
            g.gain.exponentialRampToValueAtTime(0.0001, t + a + _o.len + 0.08);
            end = t + a + _o.len + 0.1;
        }else{
            g.gain.exponentialRampToValueAtTime(0.0001, t + a + _o.len);
            end = t + a + _o.len + 0.05;
        }
        if(_o.vib && _o.len > FULL_VIB_DELAY){
            var lfo = ac.createOscillator(), d = ac.createGain();
            lfo.frequency.value = 5.5;
            d.gain.setValueAtTime(0, t);
            d.gain.setValueAtTime(0, t + FULL_VIB_DELAY);
            d.gain.linearRampToValueAtTime(_o.vib, t + FULL_VIB_DELAY + 0.25);
            lfo.connect(d); d.connect(o.detune);
            lfo.start(t); lfo.stop(end);
        }
        if(_o.cut){
            var f = ac.createBiquadFilter();
            f.type = "lowpass";
            f.frequency.setValueAtTime(_o.cut, t);
            if(_o.cut1) f.frequency.exponentialRampToValueAtTime(_o.cut1, t + a + _o.len);
            if(_o.q) f.Q.value = _o.q;
            o.connect(f); f.connect(g);
        }else o.connect(g);
        out(g, _o.pan, _o.duck);
        o.start(t); o.stop(end);
    }
    //ノイズ。_o：len vol filter f0 f1 q t pan
    function hiss(_o){
        var ac = sound.ctx, t = _o.t;
        var s = ac.createBufferSource(); s.buffer = sound.noiseBuf;
        var f = ac.createBiquadFilter(); f.type = _o.filter;
        f.frequency.setValueAtTime(_o.f0, t);
        if(_o.f1 && _o.f1 != _o.f0) f.frequency.exponentialRampToValueAtTime(_o.f1, t + _o.len);
        if(_o.q) f.Q.value = _o.q;
        var g = ac.createGain();
        g.gain.setValueAtTime(_o.vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + _o.len);
        s.connect(f); f.connect(g);
        out(g, _o.pan, false);
        s.start(t, Math.random()*0.5); s.stop(t + _o.len + 0.05);
    }
    //メロディの音符を鳴らす
    function note(_e,_t,_st,_type,_vol,_cut,_vib,_pan){
        var len = _e.len*_st;
        var hold = _e.len >= FULL_HOLD;
        voice({ type:_type, f:sound.freq(_e.n), vol:_vol*_e.vel, t:_t + _e.off*_st,
                len:hold ? len*0.92 : _e.len*0.85*_st, cut:_cut, hold:hold, vib:hold && _vib ? FULL_VIB : 0, pan:_pan });
    }
    //ノイズの上昇音(サビの前)
    function riser(_t,_dur){
        var ac = sound.ctx, s = ac.createBufferSource();
        s.buffer = sound.noiseBuf; s.loop = true;
        var f = ac.createBiquadFilter();
        f.type = "bandpass"; f.Q.value = 1.2;
        f.frequency.setValueAtTime(500, _t);
        f.frequency.exponentialRampToValueAtTime(7000, _t + _dur);
        var g = ac.createGain();
        g.gain.setValueAtTime(0.0001, _t);
        g.gain.exponentialRampToValueAtTime(0.05, _t + _dur);
        g.gain.exponentialRampToValueAtTime(0.0001, _t + _dur + 0.05);
        s.connect(f); f.connect(g);
        out(g, 0, false);
        s.start(_t); s.stop(_t + _dur + 0.1);
    }
    //コーラスの1声：_L(choir・chant の設定) _f 周波数 _t 始まり _dur 長さ(秒) _pan
    function choirVoice(_L,_f,_t,_dur,_pan,_vol){
        var ac = sound.ctx, type = _L.type || "female", F = FULL_FORMANTS[type == "male" ? "male" : "female"];
        var v0 = F[_L.vowel || "a"], v1 = _L.to ? F[_L.to] : null;
        var atk = _L.attack || 0.25, rel = 0.3, hold = Math.max(_t + atk, _t + _dur), end = hold + rel;
        var g = ac.createGain();
        g.gain.setValueAtTime(0.0001, _t);
        g.gain.exponentialRampToValueAtTime(_vol, _t + atk);
        g.gain.setValueAtTime(_vol, hold);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        var src = ac.createGain();
        //声の元：のこぎり波2本(少しずらす)に、遅れてかかるビブラート。ささやきはノイズが主
        var whisper = type == "whisper";
        var lfo = ac.createOscillator(), vd = ac.createGain();
        lfo.frequency.value = 4.8 + Math.random()*0.8;
        vd.gain.setValueAtTime(0, _t);
        vd.gain.linearRampToValueAtTime(FULL_CHOIR_VIB, _t + 0.5);
        lfo.connect(vd); lfo.start(_t); lfo.stop(end);
        var dets = [-FULL_CHOIR_DETUNE, FULL_CHOIR_DETUNE];
        for(var i=0; i<2; i++){
            var o = ac.createOscillator();
            o.type = "sawtooth";
            o.frequency.value = _f;
            o.detune.value = dets[i];
            vd.connect(o.detune);
            var og = ac.createGain();
            og.gain.value = whisper ? 0.08 : 0.5;
            o.connect(og); og.connect(src);
            o.start(_t); o.stop(end);
        }
        var ns = ac.createBufferSource();
        ns.buffer = sound.noiseBuf; ns.loop = true;
        var ng = ac.createGain();
        ng.gain.value = whisper ? 0.9 : FULL_CHOIR_BREATH;
        ns.connect(ng); ng.connect(src);
        ns.start(_t, Math.random()*0.5); ns.stop(end);
        //母音の響きの山(3つ)。to があれば、のばす間に母音を変えていく
        for(var i=0; i<3; i++){
            var f = ac.createBiquadFilter();
            f.type = "bandpass";
            f.frequency.setValueAtTime(v0[i], _t);
            if(v1) f.frequency.linearRampToValueAtTime(v1[i], hold);
            f.Q.value = FULL_FORMANT_Q[i];
            var fg = ac.createGain();
            fg.gain.value = FULL_FORMANT_GAIN[i]*FULL_CHOIR_GAIN;
            src.connect(f); f.connect(fg); fg.connect(g);
        }
        out(g, _pan, true);
        //コーラスにだけ響き
        var rv = bgmFull.choirRev;
        if(rv > 0){
            var B = bus();
            B.rev.gain.value = rv;
            g.connect(B.revIn);
        }
    }
    //コーラスの和音・旋律を鳴らす
    function sing(_L,_notes,_t,_dur){
        if(!bgmFull.choirOn) return;
        for(var i=0; i<_notes.length; i++){
            choirVoice(_L, sound.freq(_notes[i]), _t, _dur, spread(i, _notes.length, FULL_CHOIR_PAN), (_L.vol || 0.05)*(_L.velScale || 1));
        }
    }
    //キックに合わせて伴奏を少し沈める
    function duckAt(_t){
        var g = bus().duck.gain;
        g.cancelScheduledValues(_t);
        g.setValueAtTime(1, _t);
        g.linearRampToValueAtTime(FULL_DUCK, _t + 0.012);
        g.linearRampToValueAtTime(1, _t + FULL_DUCK_BACK);
    }
    //和音を lo からの1オクターブに並べる
    function voicing(_c,_lo){
        var v = [];
        for(var i=0; i<_c.iv.length; i++) v.push(_lo + (((_c.root + _c.iv[i] - _lo) % 12) + 12) % 12);
        v.sort(function(a,b){ return a - b; });
        return v;
    }
    //和音の音を左右に広げる位置(低い音を左、高い音を右へ)
    function spread(_i,_n,_w){ return _n > 1 ? (_i/(_n - 1)*2 - 1)*_w : 0; }
    function find(_iv,_cands,_def){
        for(var i=0; i<_cands.length; i++) if(_iv.indexOf(_cands[i]) >= 0) return _cands[i];
        return _def;
    }
    //低音の記号 → 音の高さ
    function bassNote(_ch,_c,_next){
        var r = _c.root, iv = _c.iv;
        switch(_ch){
            case "1": return _c.bass;
            case "8": return _c.bass + 12;
            case "3": return r + find(iv, [4,3,5,2], 4);
            case "5": return r + find(iv, [7,6,8], 7);
            case "7": return r + find(iv, [10,11,9], 10);
            case "p": return (_next ? _next.bass : _c.bass) - 1;
        }
        return null;
    }
    //パターンの _k 番目の文字(何小節分でもくり返す。| は小節の区切り)
    function patAt(_p,_bar,_s){
        if(!_p) return "";
        if(_p.indexOf("|") >= 0){ var bs = _p.split("|"); _p = bs[_bar % bs.length]; return _p.charAt(_s); }
        return _p.charAt((_bar*16 + _s) % _p.length);
    }

    //1コマ(16分音符1つ)分を鳴らす
    function step(_t,_st){
        var S = prepSong(sound.trackName), s = sound.step, L = locate(S, sound.bar), C = L.sec, bi = L.bar, k = bi*16 + s;
        if(S.swing && s % 4 == 2) _t += S.swing*_st;
        bus().make.gain.value = FULL_MAKEUP*(S.gain || 1);
        var ch = C._ch[k];
        var nextCh = k + 1 < C._ch.length ? C._ch[k + 1] : locate(S, sound.bar + 1).sec._ch[0];
        var change = k == 0 || C._ch[k - 1] !== ch, d = 1;
        while(k + d < C._ch.length && C._ch[k + d] === ch) d++;
        //和音(のばした正弦波。和音が変わるところで)
        if(C.pad && change){
            var pv = voicing(ch, 60);
            for(var i=0; i<pv.length; i++){
                voice({ type:"sine", f:sound.freq(pv[i]), vol:C.pad, t:_t, len:_st*Math.max(d - 1, 1), attack:0.25, pan:spread(i, pv.length, FULL_PAN_PAD), duck:true });
            }
        }
        //低めの和音ののばし(真ん中の音域を埋める)
        var bodyVol = C.body === undefined ? FULL_BODY_VOL : C.body;
        if(bodyVol && change){
            var bv = voicing(ch, 48);
            for(var i=0; i<bv.length && i<4; i++){
                voice({ type:"sawtooth", f:sound.freq(bv[i]), vol:bodyVol, t:_t, len:d*_st*0.95, cut:FULL_BODY_CUT, hold:true, attack:0.04,
                        pan:spread(i, Math.min(bv.length, 4), FULL_PAN_BODY), duck:true });
            }
        }
        //低音(まんなか。のこぎり波は、はじいた瞬間に明るく、すぐこもる)
        var bc = patAt(C.bass, bi, s), bn = bassNote(bc, ch, nextCh);
        if(bn !== null){
            var bl = 1;
            while(s + bl < 16 && patAt(C.bass, bi, s + bl) == ".") bl++;
            var bType = C.bassType || "sawtooth", bVol = C.bassVol || 0.12, bDur = bl == 1 ? _st*1.6 : bl*_st*0.95;
            if(bType == "sawtooth"){
                voice({ type:bType, f:sound.freq(bn), vol:bVol, t:_t, len:bDur, attack:0.005, cut:FULL_BASS_CUT0, cut1:FULL_BASS_CUT1, q:FULL_BASS_Q });
                voice({ type:"sine", f:sound.freq(bn), vol:bVol*FULL_BASS_BODY, t:_t, len:bDur, attack:0.005 });
            }else{
                voice({ type:bType, f:sound.freq(bn), vol:bVol, t:_t, len:bDur, attack:0.005, cut:700 });
                voice({ type:"sine", f:sound.freq(bn - 12), vol:bVol*FULL_BASS_SUB, t:_t, len:bDur, attack:0.01 });
            }
        }
        //分散和音(1音ずつ左右に揺らす)
        var ac = patAt(C.arp, bi, s);
        if(ac && ac != "." && ac != "-"){
            var av = voicing(ch, 60 + (C.arpOct || 0)), ai = parseInt(ac, 10);
            var an = av[ai % av.length] + 12*Math.floor(ai / av.length);
            voice({ type:C.arpType || "square", f:sound.freq(an), vol:C.arpVol || 0.016, t:_t, len:_st*(C.arpLen || 0.9), attack:0.005, cut:2400,
                    pan:(s % 2 ? 1 : -1)*FULL_PAN_ARP*(s % 4 < 2 ? 1 : 0.6), duck:true });
        }
        //和音の刻み(左右に広げ、はじいた瞬間に明るく)
        if(patAt(C.stab, bi, s) == "x"){
            var sv = voicing(ch, 64), sn = Math.min(sv.length, 4);
            for(var i=0; i<sn; i++){
                voice({ type:"square", f:sound.freq(sv[i]), vol:FULL_STAB_VOL, t:_t, len:_st*1.2, attack:0.004, cut:2800, cut1:900, pan:spread(i, sn, FULL_PAN_STAB), duck:true });
            }
        }
        //コーラスの和音
        var chs = C.choir ? (C.choir.length ? C.choir : [C.choir]) : [];
        for(var ci=0; ci<chs.length; ci++){
            var L = chs[ci], cv = voicing(ch, L.lo || 60).slice(0, 4);
            if(L.pat){
                if(patAt(L.pat, bi, s) == "x"){
                    var cl = 1;
                    while(s + cl < 16 && patAt(L.pat, bi, s + cl) == ".") cl++;
                    sing(L, cv, _t, cl*_st*0.9);
                }
            }else if(change) sing(L, cv, _t, d*_st*0.98);
        }
        //コーラスの旋律
        var cn = C._chant && C._chant[k];
        if(cn){
            for(var i=0; i<cn.length; i++){
                var ns2 = [cn[i].n];
                if(C.chant.oct) ns2.push(cn[i].n + C.chant.oct);
                sing(C.chant, ns2, _t + cn[i].off*_st, cn[i].len*_st*0.95);
            }
        }
        drums(C, bi, s, _t, _st);
        //区切りの頭でシンバル、最後の何小節かで上昇音
        if(k == 0 && C.crash) hiss({ len:1.4, vol:0.12, filter:"highpass", f0:6000, f1:3000, t:_t, pan:-FULL_PAN_CYMBAL });
        if(C.riser && s == 0 && bi == C.bars - C.riser) riser(_t, C.riser*16*_st);
        //メロディ(まんなか)・1オクターブ下・ハモり(右)
        var le = C._lead && C._lead[k];
        if(le){
            for(var i=0; i<le.length; i++){
                note(le[i], _t, _st, C.leadType || "square", C.leadVol || FULL_LEAD_VOL, C.leadCut || 2600, true, 0);
                if(C.dbl) note({ n:le[i].n + C.dbl, len:le[i].len, off:le[i].off, vel:le[i].vel }, _t, _st, "triangle", FULL_DBL_VOL, 0, false, 0);
                else if((C.leadType || "square") == "square") note({ n:le[i].n - 12, len:le[i].len, off:le[i].off, vel:le[i].vel }, _t, _st, "triangle", FULL_LEAD_SUB, 0, false, 0);
            }
        }
        var he = C._harm && C._harm[k];
        if(he) for(var i=0; i<he.length; i++) note(he[i], _t, _st, C.harmType || "pulse", C.harmVol || FULL_HARM_VOL, 2400, true, FULL_PAN_HARM);
    }
    //ドラム(音は今の曲と同じ作りに胴鳴りを足す)。区切りの最後の小節はフィルに替える
    function drums(_C,_bi,_s,_t,_st){
        var F = null;
        if(_C.fill && _bi == _C.bars - 1) F = FULL_FILLS[_C.fill];
        else if(_C.fill4 && _bi == 3 && _C.bars == 8) F = FULL_FILLS.lite;
        var useF = F && _s >= (F.from || 0);
        var kick = useF ? F.kick.charAt(_s - (F.from || 0)) : patAt(_C.kick, _bi, _s);
        var snare = useF ? F.snare.charAt(_s - (F.from || 0)) : patAt(_C.snare, _bi, _s);
        var hat = useF ? F.hat.charAt(_s - (F.from || 0)) : patAt(_C.hat, _bi, _s);
        var tom = useF ? F.tom.charAt(_s - (F.from || 0)) : patAt(_C.tom, _bi, _s);
        var cres = useF && F.cresc ? 0.45 + 0.75*_s/15 : 1;
        if(kick == "x" || kick == "X"){
            voice({ type:"sine", f:150, f1:40, vol:kick == "X" ? 0.6 : 0.5, t:_t, len:0.14, attack:0.005 });
            voice({ type:"sine", f:95, f1:42, vol:FULL_KICK_BODY, t:_t, len:0.26, attack:0.003 });
            duckAt(_t);
        }
        if(snare == "x" || snare == "X" || snare == "g"){
            var sv = (snare == "X" ? 0.28 : snare == "g" ? 0.07 : 0.22)*cres;
            hiss({ len:snare == "g" ? 0.08 : 0.14, vol:sv, filter:"highpass", f0:1200, t:_t, pan:snare == "g" ? 0.1 : 0 });
            voice({ type:"triangle", f:190, f1:150, vol:sv*0.55, t:_t, len:0.06, attack:0.005 });
            if(snare != "g") hiss({ len:0.16, vol:FULL_SNARE_BODY*cres, filter:"bandpass", f0:900, f1:700, t:_t });
        }
        //ハイハット：拍の頭を強く、裏を弱く(少しばらつかせる)
        if(hat == "x" || hat == "X"){
            var hv = (hat == "X" ? 0.1 : 0.07)*(_s % 4 == 0 ? 1 : _s % 2 == 0 ? 0.8 : 0.6)*(0.9 + Math.random()*0.2);
            hiss({ len:0.035, vol:hv, filter:"highpass", f0:7000, t:_t, pan:FULL_PAN_HAT });
        }
        if(hat == "o") hiss({ len:0.16, vol:0.06, filter:"highpass", f0:7000, t:_t, pan:FULL_PAN_HAT });
        //タム：高い音を右、低い音を左へ
        if(tom == "h" || tom == "m" || tom == "l"){
            var tf = tom == "h" ? 230 : tom == "m" ? 170 : 125, tp = tom == "h" ? 0.35 : tom == "m" ? 0 : -0.35;
            voice({ type:"sine", f:tf, f1:tf*0.55, vol:0.38, t:_t, len:0.18, attack:0.005, pan:tp });
            hiss({ len:0.05, vol:0.05, filter:"lowpass", f0:2500, t:_t, pan:tp });
        }
    }

    //楽譜を全部読んで、書き間違いを BGM_FULL_WARN に集める(テスト用)
    function checkAll(){
        for(var id in BGM_FULL) prepSong(id);
        return BGM_FULL_WARN;
    }

    return { choirOn:true, choirRev:FULL_CHOIR_REV, step:step, checkAll:checkAll, locate:function(_id,_bar){ return locate(prepSong(_id), _bar); },
             voicing:voicing, prepSong:prepSong };
})();

//試し聞きの案に「本格版」を足し、選ばれているときは sound.playStep を差し替える
(function(){
    bgmTrial.list.splice(1, 0, { v:"full", name:"本格版(今の音で作り込んだ曲)", short:"本格版" });
    var playStep = sound.playStep;
    sound.playStep = function(_t,_st){
        if(bgmTrial.v() == "full" && BGM_FULL[this.trackName]){ bgmFull.step(_t, _st); return; }
        playStep.call(this, _t, _st);
    };
})();
