//------------------------------------------------------------------------------
//  タイトル画面の見た目の案(試作)。Suno のタイトル曲「遠景の丘」(D minor・約94 BPM のゆったりした曲)に合わせる
//  タイトルの「設定」の「曲」が標準(Suno)のときは案D、クラシックのときは元のタイトル画面(viewOpt.music。titleArt.sync)
//  URL に #title=A・B・C・D を付けて開くと、曲の設定にかかわらずその案にする(見比べ用)
//    案A 夕暮れの丘：沈む日と、遠くへ重なる丘。綿毛が舞い上がる(懐かしさ)
//    案B 薄明の丘  ：日が沈んだあとの青い空。星・細い月・丘の上の村の灯り・一本の木(静けさと少しの寂しさ)
//    案C 墨の遠景  ：今の紙の画面のまま、丘を墨のにじみで重ね、赤い日を置く(今のメニューの作りとなじむ)
//    案D 崖の上の草原：夕方、崖の際の草原から、はるか下の谷(夕日を映す川・小さな町・谷の雲)と遠い山なみを見下ろす。
//                    主役は草原で、草はゆっくりうねり、2小節ごとに風の波が渡って大きく倒れては戻る(曲の哀愁に合わせた、ゆったりした間)
//  どの案も、軍の機械らしいレーダー・方眼をやめ、丘を奥ほどゆっくり左へ流す。日・灯りは曲の速さ(TART_BPM)で小節ごとにほんのり脈打つ
//  startScreen.drawBackground を包む。ロゴ・文字の色は startScreen が titleArt.col で読む
//------------------------------------------------------------------------------
const TART_SUNO = "d";          //曲が標準(Suno)のときの案
const TART_BPM = 94;            //曲の速さ(日・灯りが脈打つ間隔)
const TART_HZ = 470;            //いちばん手前の丘のふもとの高さ(px)
const TART_MOTES = 26;          //舞う綿毛(案A)・ほたる(案B)の数
const TART_STARS = 70;          //星の数(案B)

//案ごとの色。sky：空(上から地平線まで)　hills：丘(奥から手前へ { y:ふもとの高さ, a:起伏, sp:流れる速さ px/コマ, c:色 })
//col：文字の色(startScreen が読む。ないものは今の色)
const TART_PAL = {
    a:{
        name:"夕暮れの丘",
        sky:[[0,"#2a2c5a"],[0.38,"#6c4f88"],[0.72,"#d8846c"],[1,"#f5c88c"]], horizon:420,
        sun:{ x:170, y:372, r:44, c:"#ffe7b0", glow:"255,214,150" },
        hills:[
            { y:362, a:16, sp:0.04, c:"#c08ea2", mist:"245,196,160" },
            { y:392, a:20, sp:0.09, c:"#93678a", mist:"220,150,140" },
            { y:428, a:24, sp:0.18, c:"#5f426c", mist:"150,100,130" },
            { y:478, a:20, sp:0.36, c:"#302442" }
        ],
        col:{ logo:"#fff8ee", shadow:"rgba(40,20,50,0.35)", en:"rgba(255,244,230,0.85)", line:"rgba(255,244,230,0.5)",
              tag:"#fff3e6", head:"rgba(255,248,240,0.9)", hint:"rgba(240,226,240,0.85)", recInk:"#fff8ee", recLine:"rgba(255,255,255,0.5)" }
    },
    b:{
        name:"薄明の丘",
        sky:[[0,"#0c1530"],[0.45,"#22345f"],[0.8,"#4f6592"],[1,"#a8b6d0"]], horizon:420,
        moon:{ x:150, y:96, r:16 },
        hills:[
            { y:368, a:14, sp:0.04, c:"#62759a", mist:"170,186,215" },
            { y:398, a:18, sp:0.09, c:"#45567c", mist:"130,148,185", village:true },
            { y:432, a:22, sp:0.18, c:"#2c3a5c", mist:"80,96,135" },
            { y:480, a:18, sp:0.36, c:"#161f36", tree:true }
        ],
        col:{ logo:"#eef3ff", shadow:"rgba(0,0,20,0.4)", en:"rgba(220,230,255,0.8)", line:"rgba(220,230,255,0.45)",
              tag:"#dfe7fb", head:"rgba(225,233,255,0.85)", hint:"rgba(190,205,235,0.85)", recInk:"#eef3ff", recLine:"rgba(255,255,255,0.45)" }
    },
    c:{
        name:"墨の遠景",
        paper:"#f5f2eb",
        sun:{ x:172, y:366, r:40, c:"#d23a32", ink:true },
        hills:[
            { y:366, a:16, sp:0.04, c:"rgba(27,29,31,0.10)" },
            { y:396, a:20, sp:0.09, c:"rgba(27,29,31,0.16)" },
            { y:430, a:24, sp:0.18, c:"rgba(27,29,31,0.26)" },
            { y:480, a:20, sp:0.36, c:"rgba(27,29,31,0.55)" }
        ],
        col:{ hint:"rgba(255,255,255,0.85)" }
    },
    d:{
        name:"崖の上の草原",
        sky:[[0,"#2b4573"],[0.42,"#7287ad"],[0.8,"#e6b58a"],[1,"#f7dcae"]], horizon:300,
        sun:{ x:918, y:232, r:24, c:"#fff1cf", glow:"255,214,150" },
        //遠い山なみ(奥から)。止まっている(見わたす景色なので流さない)
        ranges:[
            { y:236, a:36, c:"#b3a2b8", mist:"244,210,178" },
            { y:262, a:26, c:"#9089a8", mist:"230,194,172" },
            { y:286, a:18, c:"#6d7493", mist:"204,178,170" }
        ],
        col:{ logo:"#fffaf0", shadow:"rgba(40,30,60,0.5)", en:"rgba(255,246,232,0.9)", line:"rgba(255,246,232,0.55)",
              tag:"#fff5e6", head:"rgba(255,250,242,0.95)", hint:"rgba(255,248,232,0.92)", recInk:"#fffaf0", recLine:"rgba(255,255,255,0.55)" }
    }
};
//案D 崖の上の草原
const CLIFF_EDGE_Y = 418;       //草原のふち(崖の際)の高さ(px)
const CLIFF_GUST_BARS = 2;      //風の波が草原を渡る間隔(小節。曲の速さ TART_BPM に合わせる)
const CLIFF_GUST_W = 150;       //風の波の幅(px)
//重さの対策(見た目は変えない)
//動かない所(遠い山なみと谷の床・川ぞいの町・岩の崖と霞・草原の地面)は、別のキャンバスに一度だけ描いておいて貼る。上と下の高さ(px)。
//4の倍数にして、どの細かさ(renderScale は 1/4 刻み)でも画素の境目にそろえる(貼ってもにじまない)
const CLIFF_CACHE = { far:[188,448], town:[300,372], crag:[180,448], ground:[400,540] };
const CLIFF_SKY_BOT = 312;      //空を塗る下の端(px。これより下は谷の床と草原の地面が隠す)
const CLIFF_GRASS_BIN = 64;     //草は横にこの幅(px)ずつまとめて塗る(画面の幅いっぱいを1つの形で塗ると、形の大きさの分だけとても重くなるため)
//遠くの空を横切るドローン君たち(ポインタには付いていかない)。大きさ・淡さ・数・速さは、元のタイトル画面の背景を横切る影(startScreen.js の TITLE_SHADOWS)に合わせる
//人の世界に溶け込んで暮らしている。見せるためではなく、そういう暮らしがあることがときどき見える程度に、たいていはふつうに飛ぶ(CLIFF_KINDS)
//横切りながら上下にふらふら揺れ、たまに止まって向こう(谷の先)を眺める。画面の端から出ると、しばらくして反対側から別の高さで帰ってくる
//y0〜y1：飛ぶ高さの範囲(px。草原より上)　sc：大きさ(遠目なので小さく)　speed：飛ぶ速さ(px/フレーム)　fog：かすみ(絵に重ねる空・靄の色の濃さ。いちばん小さい(遠い)もの～いちばん大きい(近い)もの。透けさせずに、遠くほど雲や靄に隠れて淡く見せる)
//fogHi・fogLo：高い所の空の色・低い所(谷)の靄の色(r,g,b。高さで混ぜる)
//bob：上下の揺れ(px。周期の違う2つの波の大きさ)　stop：次に止まるまでに進む道のり(px)　wait：止まって眺める長さ(フレーム)　away：画面の外にいる長さ(フレーム)
//cloud：これより高い所を飛ぶときは雲の間(下の雲が手前を流れる)、低いときは谷の上(山なみより手前)に描く
//elev：眺めるときに見下ろす向き(0 水平～1 真下)　sway：風の波で傾く量
const CLIFF_DRONE = { y0:50, y1:370, sc:[0.35,0.6], speed:[0.25,0.6], fog:[0.7,0.2], fogHi:[150,164,200], fogLo:[228,198,180], bob:[9,4], stop:[260,800], wait:[120,360], away:[120,600],
                      cloud:200, elev:0.25, sway:1.5 };
//空のドローン君の種類。現れるたびに w の重みで選ぶ(ふつうがいちばん多い)
//speed：飛ぶ速さの倍率　gaze：false なら止まって眺めない　out：画面の外へ出たとみなすまでの、はみ出す分(等倍の絵の px)　ext：絵の広がり(左・上・右・下。等倍の絵の px)
//plain ふつう(すれ違うときにあいさつすることがある)　carry 荷物をぶら下げて運ぶ　pair ふたりではしごを運ぶ　hurry 急いでいる(汗・速さの線)
//sleepy 寝ぼけている(目を閉じて沈み、はっと持ち直す)　family 親子(小さい子がついてくる)　parasol 日傘を差している(夕日がまぶしい)
//mail 手紙を配る(カバンを提げ、谷の家へ手紙を落としていく)　balloon 風船の束を運ぶ(浮きすぎては下りる)　birds 鳥の群れと飛ぶ(1羽は頭に乗っている)　lost 迷子(行ったり来たりして、止まるときょろきょろする)
const CLIFF_KINDS = {
    plain:   { w:8,   speed:1,    out:0,  ext:[32,32,32,32] },
    carry:   { w:2,   speed:0.7,  out:30, ext:[40,32,40,72] },
    pair:    { w:0.5, speed:0.55, out:60, ext:[66,32,66,62] },
    hurry:   { w:0.8, speed:3.4,  out:80, ext:[80,32,80,32], gaze:false },
    sleepy:  { w:0.8, speed:0.45, out:40, ext:[60,72,60,32] },
    family:  { w:0.8, speed:0.85, out:70, ext:[32,32,32,32] },
    parasol: { w:0.5, speed:0.8,  out:20, ext:[44,70,44,32] },
    mail:    { w:0.8, speed:0.9,  out:10, ext:[36,32,36,40] },
    balloon: { w:0.5, speed:0.6,  out:20, ext:[44,90,44,32] },
    birds:   { w:0.7, speed:1,    out:50, ext:[72,64,72,40] },
    lost:    { w:0.6, speed:0.7,  out:0,  ext:[32,32,32,32] }
};
const CLIFF_CARRY = ["box","bag","plant"];     //ぶら下げて運ぶ物：段ボール箱・紙袋(パンとネギ)・鉢植え
const CLIFF_HANG = { y:15, len:22 };           //糸をつける所(胴体の下。等倍の絵の px)・糸の長さ
const CLIFF_PAIR = { gap:24, len:20 };         //ふたりで運ぶ：まんなかからそれぞれの間隔・糸の長さ
//荷物の振り子(風船・日傘の傾きにも使う)　drag：進む速さで後ろへ流れる角度(rad/(px/フレーム))　wind：風の波で振れる角度　spring：戻る強さ　kick：速さが変わると振れる強さ　damp：揺れの残り方
const CLIFF_SWING = { drag:-0.35, wind:0.12, spring:0.03, kick:-0.9, damp:0.95 };
//居眠り　sink：沈む速さ(px/フレーム。飛んでいる／止まっている)　jolt：これだけ沈むとはっと目を覚ます(px)　up：持ち直す勢い　wake：目を覚ましている長さ(フレーム)　elev：うつむく向き
const CLIFF_SLEEP = { sink:[0.03,0.06], jolt:22, up:2.6, wake:110, elev:0.5 };
//親子　sc：子どもの大きさ(親の倍率)　gap：親の後ろの間(等倍の絵の px)　drop：少し下を飛ぶ　spring・damp：ついてくる遅れ
const CLIFF_FAMILY = { sc:0.6, gap:34, drop:8, spring:0.015, damp:0.86 };
//風船　rise：浮き上がる速さ(px/フレーム)　lift：これだけ浮くとプロペラで下りる(px)　down：下りる勢い
const CLIFF_BALLOON = { rise:0.035, lift:24, down:1.4 };
//手紙を配る　every：手紙を落とす間隔(進んだ道のり px)　x：落とすのは画面のこの範囲(谷の上)　fall：落ちる速さ(px/フレーム)　life：見えている長さ(フレーム。谷の靄に消える)
const CLIFF_MAIL = { every:[180,420], x:[140,820], fall:0.3, life:260 };
//鳥の群れ　fly：飛んでいる鳥の、ドローン君からの位置(進む向きを +x とした等倍の絵の px)
const CLIFF_BIRDS = { fly:[[-34,-22],[-50,-6],[24,-30]], col:"#3b3a40" };
//迷子　turns：引き返す回数　go：引き返すまでに進む道のり(px)　look：きょろきょろする向きを変える間隔(フレーム)
const CLIFF_LOST = { turns:[1,3], go:[90,220], look:36 };
//すれ違いのあいさつ(ふつうのもの同士)　near：始める間合い(px)　dy・dsc：高さ・大きさ(遠さ)がこれだけ近いとき　len：あいさつの長さ(フレーム)　roll：くるっと回る区間(len の割合)　cd：次にあいさつするまで(フレーム)
const CLIFF_GREET = { near:70, dy:50, dsc:0.1, len:150, roll:[0.35,0.7], cd:1800 };
//草の層(奥から)。緑を基調に、層ごとに3つの色の草を混ぜる
//n：本数　y0〜y1：根元の高さ(崖の際からの距離。px)　h：長さ　w：根元の太さ　flex：風でしなる量　droop：長い草の先が垂れる量
//c：草の色(3つ)　hi：日の当たる側のふちの光　head：穂の付く割合と色　broad：幅の広い葉の割合
const CLIFF_GRASS = [
    { n:560, y0:-2,  y1:14,  h:[7,15],   w:2,   flex:0.6,  droop:0,    c:["#9fb45a","#8ea84f","#aec068"], hi:"rgba(226,240,160,0.55)", head:[0,""],                  broad:0 },
    { n:460, y0:10,  y1:70,  h:[14,30],  w:2.8, flex:0.75, droop:0.2,  c:["#7f9e45","#6f8f3c","#8dac4f"], hi:"rgba(214,236,150,0.5)",  head:[0.05,"#b4c672"],       broad:0.08 },
    { n:330, y0:55,  y1:125, h:[30,54],  w:4,   flex:0.9,  droop:0.35, c:["#5d8034","#4f722d","#6a8d3a"], hi:"rgba(196,226,130,0.45)", head:[0.08,"#9cb65e"],       broad:0.12 },
    { n:170, y0:105, y1:160, h:[52,92],  w:5.6, flex:1.05, droop:0.5,  c:["#3e6125","#33541f","#47692a"], hi:"rgba(176,214,112,0.4)",  head:[0.1,"#86a24c"],        broad:0.15 },
    { n:46,  y0:150, y1:170, h:[96,150], w:8,   flex:1.2,  droop:0.7,  c:["#28451a","#223c16","#2f4f1e"], hi:"rgba(150,196,96,0.35)",  head:[0.12,"#6e8a3c"],       broad:0.2 }
];

var titleArt = {
    force:((location.hash.match(/title=([abcd])/i) || [])[1] || "").toLowerCase() || null,  //URL で選んだ案
    pick:null,      //今描く案(null なら元のタイトル画面)
    motes:[],
    stars:[],

    on:function(){ return !!this.pick; },
    //曲の設定から案を決める(標準 → 案D、クラシック → 元の画面)
    sync:function(){ this.pick = this.force || (viewOpt.music == "classic" ? null : TART_SUNO); },
    pal:function(){ return TART_PAL[this.pick]; },
    //文字の色(案にない・案を選んでいなければ _def)
    col:function(_key,_def){
        if(!this.pick) return _def;
        var c = this.pal().col;
        return c && c[_key] || _def;
    },
    //決まった乱数(毎回同じ景色にする)
    rnd:function(_i,_s){ var x = Math.sin(_i*127.1 + _s*311.7)*43758.5453; return x - Math.floor(x); },
    //丘の高さ(x はその層の流れた分を足した位置)。周期の違う波を重ねる
    hillY:function(_h,_x,_i){
        var s = _i*1.7;
        return _h.y - _h.a*(0.55*Math.sin(_x*0.0042 + s) + 0.3*Math.sin(_x*0.011 + s*2.3) + 0.15*Math.sin(_x*0.027 + s*0.7));
    },
    //小節の頭でふくらみ、ゆっくり戻る(0～1)
    pulse:function(_t){
        var bar = 60/TART_BPM*4*60, f = (_t % bar)/bar;
        return Math.exp(-f*5);
    },

    init:function(){
        for(var i=0; i<TART_MOTES; i++) this.motes.push({ x:this.rnd(i,1)*CW, y:this.rnd(i,2)*CH, sp:0.15 + this.rnd(i,3)*0.25, ph:this.rnd(i,4)*6.28 });
        for(var i=0; i<TART_STARS; i++) this.stars.push({ x:this.rnd(i,5)*CW, y:this.rnd(i,6)*300, r:0.5 + this.rnd(i,7)*1.1, ph:this.rnd(i,8)*6.28 });
    },

    draw:function(_t){
        var P = this.pal();
        if(P.ranges){ this.drawCliff(_t, P); return; }
        if(P.paper){ ctx.fillStyle = P.paper; ctx.fillRect(0,0,CW,CH); }
        else{
            var g = ctx.createLinearGradient(0,0,0,P.horizon);
            for(var i=0; i<P.sky.length; i++) g.addColorStop(P.sky[i][0], P.sky[i][1]);
            ctx.fillStyle = g;
            ctx.fillRect(0,0,CW,CH);
        }
        if(this.pick == "b") this.drawStars(_t, P);
        if(P.sun) this.drawSun(_t, P.sun);
        if(this.pick == "c") this.drawBirds(_t);
        //丘(奥から)。案A・B は丘のふもとに霞を敷く(奥ほど空の色に溶ける)
        for(var i=0; i<P.hills.length; i++){
            var h = P.hills[i], off = _t*h.sp + i*500;
            ctx.fillStyle = h.c;
            ctx.beginPath();
            ctx.moveTo(0, CH);
            for(var x=0; x<=CW; x+=8) ctx.lineTo(x, this.hillY(h, x + off, i));
            ctx.lineTo(CW, CH);
            ctx.closePath();
            ctx.fill();
            if(h.mist){
                var top = h.y + h.a, mg = ctx.createLinearGradient(0, top - 30, 0, top + 40);
                mg.addColorStop(0, "rgba(" + h.mist + ",0)");
                mg.addColorStop(1, "rgba(" + h.mist + ",0.45)");
                ctx.fillStyle = mg;
                ctx.fillRect(0, top - 30, CW, 70);
            }
            if(P.paper && i < P.hills.length - 1){
                //墨のにじみ：丘の下側を紙の色でぼかす(重なりが水墨画のように見える)
                var top2 = h.y + h.a*0.2, pg = ctx.createLinearGradient(0, top2, 0, top2 + 60);
                pg.addColorStop(0, "rgba(245,242,235,0)");
                pg.addColorStop(1, "rgba(245,242,235,0.85)");
                ctx.fillStyle = pg;
                ctx.fillRect(0, top2, CW, 62);
            }
            if(h.village) this.drawVillage(_t, h, i, off);
            if(h.tree) this.drawTree(h, i, off);
        }
        if(this.pick != "c") this.drawMotes(_t);
    },

    drawSun:function(_t,_s){
        var p = this.pulse(_t);
        if(_s.ink){
            //案C：赤い日(墨の画面に置く朱の丸。ロゴの赤い四角と同じ色)
            ctx.globalAlpha = 0.82 + p*0.1;
            ctx.fillStyle = _s.c;
            ctx.beginPath(); ctx.arc(_s.x, _s.y, _s.r, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
            return;
        }
        var R = _s.r*(3.2 + p*0.4), g = ctx.createRadialGradient(_s.x, _s.y, _s.r*0.6, _s.x, _s.y, R);
        g.addColorStop(0, "rgba(" + _s.glow + "," + (0.55 + p*0.15) + ")");
        g.addColorStop(1, "rgba(" + _s.glow + ",0)");
        ctx.fillStyle = g;
        ctx.fillRect(_s.x - R, _s.y - R, R*2, R*2);
        ctx.fillStyle = _s.c;
        ctx.beginPath(); ctx.arc(_s.x, _s.y, _s.r, 0, Math.PI*2); ctx.fill();
    },

    //案B：星(ゆっくりまたたく)と細い月
    drawStars:function(_t,P){
        for(var i=0; i<this.stars.length; i++){
            var s = this.stars[i], fade = 1 - s.y/300;
            ctx.globalAlpha = Math.max(0, fade*(0.45 + 0.4*Math.sin(_t*0.03 + s.ph)));
            ctx.fillStyle = "#fff";
            ctx.fillRect(s.x, s.y, s.r, s.r);
        }
        ctx.globalAlpha = 1;
        var m = P.moon;
        //細い月：月の円の中で、ずらした円の外側だけを塗る(欠けた所に空が見えるように)
        ctx.save();
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI*2); ctx.clip();
        ctx.fillStyle = "rgba(255,248,225,0.95)";
        ctx.beginPath();
        ctx.rect(m.x - m.r, m.y - m.r, m.r*2, m.r*2);
        ctx.arc(m.x + m.r*0.45, m.y - m.r*0.2, m.r*0.92, 0, Math.PI*2);
        ctx.fill("evenodd");
        ctx.restore();
    },

    //案B：丘の上の村の灯り(小節の頭でほんのり明るく)
    drawVillage:function(_t,_h,_i,_off){
        var p = this.pulse(_t);
        for(var k=0; k<14; k++){
            //流れる層の上に、決まった間隔で灯りを並べる(画面の外へ出たら反対から)
            var wx = ((k*137 - _off) % 1400 + 1400) % 1400 - 200;
            if(wx < -10 || wx > CW + 10) continue;
            var y = this.hillY(_h, wx + _off, _i) + 6 + this.rnd(k,9)*10;
            ctx.fillStyle = "rgba(255,214,140," + (0.55 + p*0.3)*(0.6 + this.rnd(k,10)*0.4) + ")";
            ctx.fillRect(wx, y, 2, 2);
        }
    },

    //案B：いちばん手前の丘の一本の木
    drawTree:function(_h,_i,_off){
        var x = ((620 - _off) % 1600 + 1600) % 1600 - 300;
        if(x < -60 || x > CW + 60) return;
        var y = this.hillY(_h, x + _off, _i) + 2;
        ctx.fillStyle = _h.c;
        ctx.fillRect(x - 2, y - 34, 4, 36);
        ctx.beginPath();
        ctx.arc(x, y - 44, 18, 0, Math.PI*2);
        ctx.arc(x - 13, y - 34, 12, 0, Math.PI*2);
        ctx.arc(x + 14, y - 36, 13, 0, Math.PI*2);
        ctx.fill();
    },

    //案C：遠くを渡る鳥(墨の線)
    drawBirds:function(_t){
        ctx.strokeStyle = "rgba(27,29,31,0.45)";
        ctx.lineWidth = 1.4;
        for(var i=0; i<5; i++){
            var x = ((i*190 + _t*(0.25 + i*0.03)) % (CW + 200)) - 100, y = 120 + i*22 + Math.sin(_t*0.01 + i)*8;
            var w = 5 + (i % 2)*2, f = Math.sin(_t*0.12 + i*1.3)*3;
            ctx.beginPath();
            ctx.moveTo(x - w, y - f); ctx.quadraticCurveTo(x - w*0.4, y - 3, x, y);
            ctx.quadraticCurveTo(x + w*0.4, y - 3, x + w, y - f);
            ctx.stroke();
        }
        ctx.lineWidth = 1;
    },

    //------------------------------------------------------------------ 案D 崖の上の草原
    //崖の際の草原から、はるか下の谷と遠い山なみを見下ろす。主役は手前の草原：
    //いつも同じ向きへ少しなびき、ゆっくりうねり、CLIFF_GUST_BARS 小節ごとに風の波が左から右へ渡って、草が大きく倒れては戻る
    grass:null,     //草の層ごとの { x, d:ふちからの距離, h:長さ, k:ゆらぎのずれ }
    edgeY:function(_x){ return CLIFF_EDGE_Y + 10*Math.sin(_x*0.005 + 0.7) + 4*Math.sin(_x*0.017); },
    //風の波の位置(画面の x)。小節に合わせて左の外から右の外へ
    gustX:function(_t){
        var P = 3600/TART_BPM*4*CLIFF_GUST_BARS, ph = (_t % P)/P;
        return -CLIFF_GUST_W*2 + ph*(CW + CLIFF_GUST_W*4);
    },
    //草の傾き(ラジアン。右へ倒れるほど大きい)
    wind:function(_x,_t,_k,_gx){
        var g = (_x - _gx)/CLIFF_GUST_W;
        return 0.16 + 0.08*Math.sin(_t*0.02 + _x*0.003) + 0.5*Math.exp(-g*g) + 0.035*Math.sin(_t*0.11 + _k);
    },
    initCliff:function(){
        this.grass = [];
        for(var L=0; L<CLIFF_GRASS.length; L++){
            var G = CLIFF_GRASS[L], list = [];
            for(var i=0; i<G.n; i++){
                var id = L*1000 + i, broad = this.rnd(id,35) < G.broad;
                list.push({ x:-30 + this.rnd(id,30)*(CW + 60), d:G.y0 + this.rnd(id,31)*(G.y1 - G.y0),
                            h:(G.h[0] + this.rnd(id,32)*(G.h[1] - G.h[0]))*(broad ? 0.55 : 1), k:this.rnd(id,33)*6.28,
                            lean:(this.rnd(id,34) - 0.35)*0.5,          //草ごとの生えた向きのばらつき(少し右寄り)
                            w:(0.7 + this.rnd(id,36)*0.6)*(broad ? 2.2 : 1),
                            c:Math.floor(this.rnd(id,37)*3), head:!broad && this.rnd(id,38) < G.head[0] });
            }
            list.sort(function(a,b){ return a.d - b.d; });
            for(var i=0; i<list.length; i++){ list[i].i = i; list[i].y = this.edgeY(list[i].x) + list[i].d; }
            this.grass.push(list);
        }
        //塗るときのまとまり：横に近い草どうし(CLIFF_GRASS_BIN ごと)。同じ色の草はどの順で塗っても同じなので、色ごとに分けて横の位置で並べる
        //ふちの光・穂も同じように横でまとめる(交わる線の多くが同じまとまりに入り、重なった所が濃くならない)
        var bins = function(_list,_ok){
            var byX = _list.filter(_ok).sort(function(a,b){ return a.x - b.x; }), out = [], key = null;
            for(var i=0; i<byX.length; i++){
                var k = Math.floor((byX[i].x + 30)/CLIFF_GRASS_BIN);
                if(k !== key){ out.push([]); key = k; }
                out[out.length - 1].push(byX[i]);
            }
            return out;
        };
        this.grassBins = [];
        for(var L=0; L<this.grass.length; L++){
            var list = this.grass[L], B = { col:[], hi:bins(list, function(){ return true; }), head:bins(list, function(b){ return b.head; }),
                                           pt:new Float64Array(list.length*7) };
            for(var c=0; c<3; c++) B.col.push(bins(list, function(b){ return b.c == c; }));
            this.grassBins.push(B);
        }
    },
    //動かない所を別のキャンバスに描いておいて貼る(CLIFF_CACHE の高さの帯。細かさが変わったら描き直す)
    cache:null,
    cached:function(_name,_fn){
        var R = CLIFF_CACHE[_name], all = this.cache || (this.cache = {}), e = all[_name];
        if(!e || e.scale != renderScale || (e.g.isContextLost && e.g.isContextLost())){
            var cv = document.createElement("canvas"), keep = ctx;
            cv.width = Math.round(CW*renderScale);
            cv.height = Math.round((R[1] - R[0])*renderScale);
            var g = cv.getContext("2d");
            g.setTransform(renderScale, 0, 0, renderScale, 0, -R[0]*renderScale);
            ctx = g;        //描く関数はいつもの ctx に描くので、少しのあいだ差し替える
            try{ _fn.call(this); }finally{ ctx = keep; }
            e = all[_name] = { cv:cv, g:g, scale:renderScale };
        }
        ctx.drawImage(e.cv, 0, R[0], CW, R[1] - R[0]);
    },
    //草1本の形(根元から先へ細くなり、しなって、長い草は先が垂れる)。ふち・穂のために芯の点も返す
    blade:function(_bx,_by,_a,_h,_w,_droop,_out){
        var s1 = Math.sin(_a*0.2), c1 = Math.cos(_a*0.2), s2 = Math.sin(_a*0.6), c2 = Math.cos(_a*0.6);
        var x1 = _bx + s1*_h*0.36, y1 = _by - c1*_h*0.36;
        var x2 = _bx + s2*_h*0.7,  y2 = _by - c2*_h*0.7;
        var dr = _droop*_h*Math.min(1, Math.abs(_a)*2.2);
        var x3 = _bx + Math.sin(_a)*_h + (_a < 0 ? -1 : 1)*dr*0.3, y3 = _by - Math.cos(_a)*_h + dr*0.35;
        ctx.moveTo(_bx - _w/2, _by);
        ctx.bezierCurveTo(x1 - _w*0.42, y1, x2 - _w*0.24, y2, x3, y3);
        ctx.bezierCurveTo(x2 + _w*0.24, y2, x1 + _w*0.42, y1, _bx + _w/2, _by);
        ctx.closePath();
        _out[0] = x1; _out[1] = y1; _out[2] = x2; _out[3] = y2; _out[4] = x3; _out[5] = y3;
    },
    drawCliff:function(_t,P){
        if(!this.grass) this.initCliff();
        var g = ctx.createLinearGradient(0,0,0,P.horizon);
        for(var i=0; i<P.sky.length; i++) g.addColorStop(P.sky[i][0], P.sky[i][1]);
        ctx.fillStyle = g;
        ctx.fillRect(0,0,CW,CLIFF_SKY_BOT);
        this.fliers(_t);
        this.drawRays(_t, P.sun);
        this.drawSun(_t, P.sun);
        this.drawStreaks(_t);
        this.cached("far", this.drawFar);
        this.drawValley(_t);
        this.drawDrones(_t, false);     //低く飛ぶものは谷の上
        this.drawMeadowCliff(_t);
    },
    //遠い山なみ(下に夕日の色の霞)と、はるか下の谷の床・畑・川(動かないので、別のキャンバスに一度だけ描く)
    drawFar:function(){
        var P = TART_PAL.d;
        for(var i=0; i<P.ranges.length; i++){
            var R = P.ranges[i];
            ctx.fillStyle = R.c;
            ctx.beginPath();
            ctx.moveTo(0, CH);
            for(var x=0; x<=CW; x+=6) ctx.lineTo(x, this.hillY(R, x + i*900, i + 5) - 6*Math.abs(Math.sin(x*0.021 + i)));
            ctx.lineTo(CW, CH);
            ctx.closePath();
            ctx.fill();
            var top = R.y + R.a*0.5, mg = ctx.createLinearGradient(0, top - 20, 0, top + 30);
            mg.addColorStop(0, "rgba(" + R.mist + ",0)");
            mg.addColorStop(1, "rgba(" + R.mist + ",0.55)");
            ctx.fillStyle = mg;
            ctx.fillRect(0, top - 20, CW, 50);
        }
        var top = 306, bot = CLIFF_EDGE_Y + 30;
        var vg = ctx.createLinearGradient(0, top, 0, bot);
        vg.addColorStop(0, "#6d7493");      //いちばん手前の山なみと同じ色から(つなぎ目を見せない)
        vg.addColorStop(1, "#4d5f55");
        ctx.fillStyle = vg;
        ctx.fillRect(0, top, CW, bot - top);
        //畑(かすんだ四角)
        for(var i=0; i<60; i++){
            var y = top + 6 + this.rnd(i,42)*(bot - top - 20), k = (y - top)/(bot - top), w = (14 + this.rnd(i,43)*30)*(0.4 + k);
            ctx.fillStyle = i % 2 ? "rgba(150,160,110,0.35)" : "rgba(90,110,80,0.35)";
            ctx.fillRect(this.rnd(i,44)*CW, y, w, (2 + k*5));
        }
        //川：地平線の近くの細い流れから、手前へ広がりながら蛇行する。夕日を映して光る
        var pts = this.river();
        ctx.fillStyle = "rgba(246,216,166,0.85)";
        ctx.beginPath();
        ctx.moveTo(pts[0][0] - pts[0][2], pts[0][1]);
        for(var s=0; s<pts.length; s++) ctx.lineTo(pts[s][0] - pts[s][2], pts[s][1]);
        for(var s=pts.length - 1; s>=0; s--) ctx.lineTo(pts[s][0] + pts[s][2], pts[s][1]);
        ctx.closePath();
        ctx.fill();
    },
    //川の芯の点 [x, y, 半分の幅](谷の上から手前へ)
    river:function(){
        if(this.riverPts) return this.riverPts;
        var top = 306, bot = CLIFF_EDGE_Y + 30, pts = [];
        for(var s=0; s<=40; s++){
            var u = s/40, y = top + 2 + u*u*(bot - top), x = 470 + Math.sin(u*4.6 + 0.6)*(30 + u*170) - u*150;
            pts.push([x, y, 1 + u*u*30]);
        }
        return this.riverPts = pts;
    },
    //日から広がる光の筋(ゆっくり回る)
    drawRays:function(_t,_s){
        var p = this.pulse(_t);
        ctx.save();
        ctx.translate(_s.x, _s.y);
        for(var i=0; i<7; i++){
            var a = -Math.PI*0.97 + i*0.12 + Math.sin(_t*0.004 + i)*0.03;     //日は右の崖の向こう。光は左上へ広がる
            ctx.fillStyle = "rgba(255,226,170," + (0.05 + p*0.025) + ")";
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(Math.cos(a - 0.05)*900, Math.sin(a - 0.05)*900);
            ctx.lineTo(Math.cos(a + 0.05)*900, Math.sin(a + 0.05)*900);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    },
    //高い空の薄い雲(夕日で下が光る)
    drawStreaks:function(_t){
        for(var i=0; i<6; i++){
            var w = 160 + this.rnd(i,40)*220, x = ((this.rnd(i,41)*CW - _t*(0.05 + i*0.01)) % (CW + w + 100) + CW + w + 100) % (CW + w + 100) - w;
            var y = 40 + i*34;
            ctx.fillStyle = "rgba(255,214,180," + (0.18 + 0.05*(i % 2)) + ")";
            ctx.beginPath(); ctx.ellipse(x + w/2, y, w/2, 4 + (i % 3), 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(255,240,220,0.22)";
            ctx.beginPath(); ctx.ellipse(x + w/2 + 10, y + 2, w*0.35, 2, 0, 0, Math.PI*2); ctx.fill();
            if(i == 1) this.drawDrones(_t, true);   //高く飛ぶものは雲の間：下の雲が手前を流れる
        }
    },
    //はるか下の谷：夕日を映す川のきらめき・川ぞいの小さな町・谷にたまる雲・下を飛ぶ鳥・左右の岩の崖(谷の床と川は drawFar)
    drawValley:function(_t){
        var pts = this.river();
        //川面のきらめき
        for(var s=4; s<pts.length; s+=3){
            var a = 0.3 + 0.3*Math.sin(_t*0.05 + s*1.7);
            ctx.fillStyle = "rgba(255,250,230," + a + ")";
            ctx.fillRect(pts[s][0] - pts[s][2]*0.5, pts[s][1], pts[s][2], 1);
        }
        this.cached("town", this.drawTown);
        //谷にたまる雲(ゆっくり流れる)
        for(var i=0; i<5; i++){
            var w = 220 + this.rnd(i,49)*200, x = ((this.rnd(i,50)*CW + _t*0.06*(1 + i*0.2)) % (CW + w)) - w*0.5;
            var y = 306 + i*10;
            ctx.fillStyle = "rgba(255,236,214,0.28)";
            ctx.beginPath(); ctx.ellipse(x, y, w/2, 6 + i, 0, 0, Math.PI*2); ctx.fill();
        }
        //下を飛ぶ鳥(谷の上をゆっくり輪を描く)
        ctx.strokeStyle = "rgba(60,60,80,0.55)";
        ctx.lineWidth = 1.2;
        for(var i=0; i<3; i++){
            var a = _t*0.004 + i*2.1, x = 520 + Math.cos(a)*(140 + i*40), y = 352 + Math.sin(a)*14 + i*10, f = Math.sin(_t*0.1 + i)*1.5;
            ctx.beginPath(); ctx.moveTo(x - 4, y - f); ctx.lineTo(x, y); ctx.lineTo(x + 4, y - f); ctx.stroke();
        }
        ctx.lineWidth = 1;
        this.cached("crag", this.drawCrag);
    },
    //川ぞいの小さな町(点の集まり。動かないので、別のキャンバスに一度だけ描く)
    drawTown:function(){
        var pts = this.river();
        for(var i=0; i<90; i++){
            var s = 6 + Math.floor(this.rnd(i,45)*20), P = pts[s], side = this.rnd(i,46) < 0.5 ? -1 : 1;
            var x = P[0] + side*(P[2] + 3 + this.rnd(i,47)*(10 + s*1.2)), y = P[1] + (this.rnd(i,48) - 0.5)*6, sz = 1 + s/16;
            ctx.fillStyle = i % 3 ? "rgba(236,222,200,0.75)" : "rgba(170,100,80,0.75)";
            ctx.fillRect(x, y, sz*1.6, sz);
        }
    },
    //左右の岩の崖と、谷全体にかかる霞(動かないので、別のキャンバスに一度だけ描く)
    drawCrag:function(){
        var top = 306, bot = CLIFF_EDGE_Y + 30;
        //左の岩の柱(谷から高くそびえ、上に草。高さを感じさせる)
        var crag = [[0,196],[18,190],[34,198],[46,214],[50,250],[58,300],[70,350],[82,410],[92,CH]];
        ctx.fillStyle = "#3a3b50";
        ctx.beginPath();
        ctx.moveTo(0, CH);
        for(var i=0; i<crag.length; i++) ctx.lineTo(crag[i][0], crag[i][1]);
        ctx.closePath(); ctx.fill();
        //夕日の当たる側のふちと、岩の割れ目
        ctx.strokeStyle = "rgba(236,170,128,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(var i=1; i<crag.length - 1; i++) ctx[i == 1 ? "moveTo" : "lineTo"](crag[i][0] - 2, crag[i][1] + 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(20,20,34,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(22, 220); ctx.lineTo(28, 280); ctx.lineTo(24, 340);
        ctx.moveTo(40, 260); ctx.lineTo(48, 330); ctx.lineTo(56, 400);
        ctx.stroke();
        //上の草
        ctx.fillStyle = "#6e7a44";
        ctx.beginPath(); ctx.moveTo(0, 192); ctx.quadraticCurveTo(22, 182, 36, 198); ctx.lineTo(0, 202); ctx.closePath(); ctx.fill();
        //右の遠い崖(メニューの向こうに少し見える)
        ctx.fillStyle = "#5a5b76";
        ctx.beginPath();
        ctx.moveTo(CW, 238); ctx.lineTo(914, 246); ctx.lineTo(892, 280); ctx.lineTo(880, 340); ctx.lineTo(868, 420); ctx.lineTo(CW, 420);
        ctx.closePath(); ctx.fill();
        //谷全体にかかる霞(高さの遠さ)
        var hz = ctx.createLinearGradient(0, top - 24, 0, bot);
        hz.addColorStop(0, "rgba(240,206,176,0)");
        hz.addColorStop(0.15, "rgba(240,206,176,0.45)");
        hz.addColorStop(1, "rgba(240,206,176,0.08)");
        ctx.fillStyle = hz;
        ctx.fillRect(0, top - 24, CW, bot - top + 24);
    },
    //草原の地面：崖の際は夕日で明るく、手前ほど暗い(動かないので、別のキャンバスに一度だけ描く)
    drawGround:function(){
        var mg = ctx.createLinearGradient(0, CLIFF_EDGE_Y - 14, 0, CH);
        mg.addColorStop(0, "#9aa756");
        mg.addColorStop(0.35, "#5f7a3a");
        mg.addColorStop(1, "#24361b");
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.moveTo(0, CH);
        for(var x=0; x<=CW; x+=6) ctx.lineTo(x, this.edgeY(x));
        ctx.lineTo(CW, CH);
        ctx.closePath();
        ctx.fill();
    },
    //崖の上の草原(主役)
    drawMeadowCliff:function(_t){
        var gx = this.gustX(_t);
        if(!this.grass) this.initCliff();
        this.cached("ground", this.drawGround);
        //風の波の通り道は、なびいた草の裏が光って明るく見える
        var sh = ctx.createLinearGradient(gx - CLIFF_GUST_W*1.4, 0, gx + CLIFF_GUST_W*1.4, 0);
        sh.addColorStop(0, "rgba(255,232,170,0)");
        sh.addColorStop(0.5, "rgba(255,232,170,0.16)");
        sh.addColorStop(1, "rgba(255,232,170,0)");
        ctx.fillStyle = sh;
        ctx.fillRect(gx - CLIFF_GUST_W*1.4, CLIFF_EDGE_Y - 20, CLIFF_GUST_W*2.8, CH - CLIFF_EDGE_Y + 20);
        //草(奥の層から)。層ごとに色ごとに、横に近い草をまとめて塗る(grassBins)。日の当たる右側のふちに光、ところどころに穂
        var pt = [0,0,0,0,0,0];
        for(var L=0; L<CLIFF_GRASS.length; L++){
            var G = CLIFF_GRASS[L], B = this.grassBins[L], P = B.pt;
            //根元の暗がり(草の重なりの奥)
            if(L > 0){
                var y0 = CLIFF_EDGE_Y + G.y0, dg = ctx.createLinearGradient(0, y0 - 10, 0, CLIFF_EDGE_Y + G.y1 + 10);
                dg.addColorStop(0, "rgba(20,40,14,0)");
                dg.addColorStop(1, "rgba(20,40,14,0.22)");
                ctx.fillStyle = dg;
                ctx.fillRect(0, y0 - 10, CW, G.y1 - G.y0 + 20);
            }
            for(var c=0; c<3; c++){
                ctx.fillStyle = G.c[c];
                for(var n=0; n<B.col[c].length; n++){
                    var bin = B.col[c][n];
                    ctx.beginPath();
                    for(var i=0; i<bin.length; i++){
                        var b = bin[i], a = this.wind(b.x, _t, b.k, gx)*G.flex + b.lean, w = G.w*b.w, o = b.i*7;
                        this.blade(b.x, b.y, a, b.h, w, G.droop, pt);
                        P[o] = pt[0]; P[o + 1] = pt[1]; P[o + 2] = pt[2]; P[o + 3] = pt[3]; P[o + 4] = pt[4]; P[o + 5] = pt[5]; P[o + 6] = w;
                    }
                    ctx.fill();
                }
            }
            //日の当たる側のふち(根元から 3 割の所から先へ)
            ctx.strokeStyle = G.hi;
            ctx.lineWidth = L < 2 ? 0.7 : 1;
            for(var n=0; n<B.hi.length; n++){
                var bin = B.hi[n];
                ctx.beginPath();
                for(var i=0; i<bin.length; i++){
                    var o = bin[i].i*7, w = P[o + 6];
                    ctx.moveTo(P[o] + w*0.25, P[o + 1]); ctx.quadraticCurveTo(P[o + 2] + w*0.14, P[o + 3], P[o + 4], P[o + 5]);
                }
                ctx.stroke();
            }
            //穂(先に付いた細長い粒の集まり。緑)
            if(B.head.length){
                ctx.fillStyle = G.head[1];
                for(var n=0; n<B.head.length; n++){
                    var bin = B.head[n];
                    ctx.beginPath();
                    for(var i=0; i<bin.length; i++){
                        var b = bin[i], o = b.i*7, hl = b.h*0.16, an = Math.atan2(P[o + 5] - P[o + 3], P[o + 4] - P[o + 2]);
                        var ex = P[o + 4] + Math.cos(an)*hl*0.45, ey = P[o + 5] + Math.sin(an)*hl*0.45;
                        ctx.moveTo(ex + Math.cos(an)*hl*0.6, ey + Math.sin(an)*hl*0.6);     //前の穂と線でつながらないように
                        ctx.ellipse(ex, ey, hl*0.6, Math.max(1, hl*0.16), an, 0, Math.PI*2);
                    }
                    ctx.fill();
                }
                ctx.strokeStyle = G.hi;
                ctx.lineWidth = 0.6;
                for(var n=0; n<B.head.length; n++){
                    var bin = B.head[n];
                    ctx.beginPath();
                    for(var i=0; i<bin.length; i++){
                        var b = bin[i], o = b.i*7, hl = b.h*0.16, an = Math.atan2(P[o + 5] - P[o + 3], P[o + 4] - P[o + 2]);
                        var hx = P[o + 4] + Math.cos(an)*hl*0.45, hy = P[o + 5] + Math.sin(an)*hl*0.45;
                        //穂の毛(短い線を並べる)
                        for(var j=-2; j<=2; j++){
                            var ox = hx + Math.cos(an)*j*hl*0.22, oy = hy + Math.sin(an)*j*hl*0.22;
                            ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(an - 0.9)*hl*0.3, oy + Math.sin(an - 0.9)*hl*0.3);
                        }
                    }
                    ctx.stroke();
                }
            }
        }
        //風に乗って舞う草の種(風の波が来ると高く舞う)
        for(var i=0; i<this.motes.length; i++){
            var m = this.motes[i];
            var x = ((m.x + _t*(0.5 + m.sp)) % (CW + 40)) - 20, gd = (x - gx)/CLIFF_GUST_W;
            var y = 360 + (m.y % 170) + Math.sin(_t*0.02 + m.ph)*10 - 26*Math.exp(-gd*gd);
            ctx.fillStyle = "rgba(255,240,205," + (0.35 + 0.3*Math.sin(_t*0.03 + m.ph)) + ")";
            ctx.fillRect(x, y, 2, 1.4);
        }
    },

    //空のドローン君の種類を選ぶ(_u：0～1。CLIFF_KINDS の w の重みで)
    pickKind:function(_u){
        var sum = 0, k;
        for(k in CLIFF_KINDS) sum += CLIFF_KINDS[k].w;
        _u *= sum;
        for(k in CLIFF_KINDS){ if((_u -= CLIFF_KINDS[k].w) < 0) return k; }
        return "plain";
    },
    //空のドローン君を1体作る(_i：番号。位置・大きさ・速さ・種類はこの番号から決まる)
    newFlier:function(_i){
        var D = CLIFF_DRONE, r = this.rnd.bind(this);
        var f = { x:r(_i,71)*CW, y:D.y0 + r(_i,72)*(D.y1 - D.y0), dir:r(_i,70) < 0.5 ? -1 : 1, vx:0, pvx:0, mode:"fly", wait:0, n:_i*100,
                  go:D.stop[0] + r(_i,73)*(D.stop[1] - D.stop[0]),
                  sc:D.sc[0] + r(_i,74)*(D.sc[1] - D.sc[0]), sp0:D.speed[0] + r(_i,75)*(D.speed[1] - D.speed[0]),
                  ph:r(_i,76)*6.28, bt:0, greetCd:0, letters:[], look:new DroneLook() };
        this.setKind(f, this.pickKind(r(_i,77)));
        return f;
    },
    //種類に合わせて、速さ・顔・運ぶ物・連れなどを整える
    setKind:function(_f,_kind){
        var K = CLIFF_KINDS[_kind], r = this.rnd.bind(this);
        _f.kind = _kind;
        _f.sp = _f.sp0*K.speed;
        _f.out = 40 + K.out*_f.sc;
        _f.item = CLIFF_CARRY[Math.floor(r(++_f.n, 64)*CLIFF_CARRY.length)];
        _f.sw = _f.swV = _f.sink = _f.sinkV = _f.wake = 0;
        _f.mailGo = CLIFF_MAIL.every[0] + r(++_f.n, 66)*(CLIFF_MAIL.every[1] - CLIFF_MAIL.every[0]);
        _f.turns = _kind == "lost" ? CLIFF_LOST.turns[0] + Math.floor(r(++_f.n, 67)*(CLIFF_LOST.turns[1] - CLIFF_LOST.turns[0] + 1)) : 0;
        _f.look.resetFace();
        _f.look.setMood(_kind == "hurry" || _kind == "lost" ? "sad" : _kind == "sleepy" ? "blink" : "normal");
        if(_kind == "pair" && !_f.look2) _f.look2 = new DroneLook();
        if(_kind == "family"){
            if(!_f.kid) _f.kid = { look:new DroneLook() };
            _f.kid.x = _f.x - _f.dir*CLIFF_FAMILY.gap*_f.sc; _f.kid.y = _f.y; _f.kid.vx = _f.kid.vy = 0;
        }
    },
    //止まるまでに進む道のり(迷子は短い道のりで引き返す)
    nextGo:function(_f){
        var D = CLIFF_DRONE, u = this.rnd(++_f.n, 63);
        if(_f.turns > 0) return CLIFF_LOST.go[0] + u*(CLIFF_LOST.go[1] - CLIFF_LOST.go[0]);
        return D.stop[0] + u*(D.stop[1] - D.stop[0]);
    },
    //空のドローン君たちを1コマ進める(同じ時刻なら進めない)。横切る(fly) → たまに止まって眺める(gaze) → 端から出ると外で待つ(away) → 反対側から別の高さで帰ってくる
    //帰ってくるたびに種類を選び直す。ふつうのもの同士がすれ違うときは、あいさつ(greet)することがある
    fliers:function(_t){
        var D = CLIFF_DRONE, r = this.rnd.bind(this);
        if(!this.fly){
            this.fly = [];
            for(var i=0; i<TITLE_SHADOWS; i++) this.fly.push(this.newFlier(i));
            this.fly.sort(function(a,b){ return a.sc - b.sc; });    //遠い(小さい)ものから描く
        }
        if(_t == this.flyT) return;
        this.flyT = _t;
        var gx = this.gustX(_t);
        this.findGreet();
        for(var i=0; i<this.fly.length; i++){
            var f = this.fly[i], want = 0, K = CLIFF_KINDS[f.kind];
            if(f.greetCd > 0) f.greetCd--;
            if(f.mode == "fly"){
                want = f.dir*f.sp;
                f.go -= Math.abs(f.vx);
                //画面の中ほどで、決めた道のりを進んだら止まる(急いでいるものは止まらない。迷子は端の近くでも止まる)
                var edge = f.turns > 0 ? 50 : 80;
                if(f.go <= 0 && K.gaze !== false && f.x > edge && f.x < CW - edge){ f.mode = "gaze"; f.wait = D.wait[0] + r(++f.n, 60)*(D.wait[1] - D.wait[0]); }
                if(f.x < -f.out || f.x > CW + f.out){ f.mode = "away"; f.wait = D.away[0] + r(++f.n, 61)*(D.away[1] - D.away[0]); }
            }else if(--f.wait <= 0){
                if(f.mode == "away"){
                    //反対側から、別の高さ・別の種類で帰ってくる
                    f.dir = -f.dir;
                    f.y = D.y0 + r(++f.n, 62)*(D.y1 - D.y0);
                    this.setKind(f, this.pickKind(r(++f.n, 65)));
                    f.x = f.dir > 0 ? 2 - f.out : CW + f.out - 2;
                    if(f.kid){ f.kid.x = f.x - f.dir*CLIFF_FAMILY.gap*f.sc; f.kid.y = f.y; }
                    f.vx = f.dir*f.sp;
                }else if(f.mode == "greet"){
                    f.greetCd = CLIFF_GREET.cd;
                }else if(f.turns > 0){
                    //迷子：きょろきょろしたあと、来た道を引き返す
                    f.dir = -f.dir; f.turns--;
                    if(f.turns == 0) f.look.setMood("normal");
                }
                f.mode = "fly";
                f.go = this.nextGo(f);
            }
            if(f.mode == "away") f.vx = 0;
            f.pvx = f.vx;
            f.vx += (want - f.vx)*(f.kind == "hurry" ? 0.08 : 0.04);       //止まる・動き出すのはなめらかに(急ぐものはきびきび)
            f.x += f.vx;
            //上下のふらふらは、飛んでいる速さの分だけ進める(止まると揺れも静まる)
            var k = Math.min(2, Math.abs(f.vx)/f.sp0);
            f.bt += 0.4 + k;
            var g = (f.x - gx)/CLIFF_GUST_W, gust = D.sway*Math.exp(-g*g), moving = Math.abs(f.vx) > 0.05;
            var side = f.vx < 0 || (!moving && f.dir < 0) ? 3 : 4, dirIdx = moving ? side : 5;
            if(f.kind == "sleepy" || f.mode == "greet") dirIdx = side;     //居眠りは横を向いたままうつむく。あいさつは相手を向く
            else if(f.kind == "lost" && f.mode == "gaze") dirIdx = [3,5,4,5][Math.floor(f.wait/CLIFF_LOST.look) % 4];   //あちこちを見回す
            f.look.update(dirIdx, f.vx*8 + gust);
            if(!moving && dirIdx == 5) f.look.elev += (D.elev - f.look.elev)*0.05;
            if(f.kind == "lost" && f.mode == "gaze") f.look.elev += (0.4*Math.sin(f.wait*0.05) - f.look.elev)*0.05;
            if(f.mode == "greet") this.greetStep(f);
            if(f.look2){
                f.look2.update(moving ? side : 5, f.vx*8 + gust*0.8);
                if(!moving) f.look2.elev += (D.elev - f.look2.elev)*0.05;
            }
            //ぶら下げた荷物は振り子：進むと後ろへ流れ、止まると前へ振れる。風の波でも揺れる(風船・日傘も同じ揺れで傾ける)
            if(f.kind == "carry" || f.kind == "pair" || f.kind == "balloon" || f.kind == "parasol"){
                var S = CLIFF_SWING;
                f.swV += (f.vx*S.drag + gust*S.wind - f.sw)*S.spring + (f.vx - f.pvx)*S.kick;
                f.swV *= S.damp;
                f.sw += f.swV;
            }
            if(f.kind == "sleepy") this.dozeStep(f, moving);
            if(f.kind == "balloon") this.floatStep(f);
            if(f.kind == "family") this.kidStep(f, moving, gust);
            if(f.kind == "mail" && f.mode == "fly") this.mailStep(f);
            this.letterStep(f, gust);
        }
    },
    //すれ違うふつうのもの同士が近づいたら、止まってあいさつを始める(高さと遠さが近いときだけ)
    findGreet:function(){
        var G = CLIFF_GREET, fl = this.fly;
        for(var i=0; i<fl.length; i++){
            var a = fl[i];
            if(a.kind != "plain" || a.mode != "fly" || a.greetCd > 0) continue;
            for(var j=i+1; j<fl.length; j++){
                var b = fl[j];
                if(b.kind != "plain" || b.mode != "fly" || b.greetCd > 0 || a.dir == b.dir) continue;
                var dx = b.x - a.x;
                if(dx*a.dir <= 0 || Math.abs(dx) > G.near || Math.abs(a.y - b.y) > G.dy || Math.abs(a.sc - b.sc) > G.dsc) continue;
                if(a.x < 40 || a.x > CW - 40) continue;
                a.mode = b.mode = "greet";
                a.wait = b.wait = G.len;
                a.mate = b; b.mate = a;
                a.look.setFace("happy", G.len); b.look.setFace("happy", G.len);
                break;
            }
        }
    },
    //あいさつ：止まって高さをそろえ、途中で相手のほうへくるっと1回転する
    greetStep:function(_f){
        var G = CLIFF_GREET, m = _f.mate, p = 1 - _f.wait/G.len;
        if(m) _f.y += ((_f.y + m.y)/2 - _f.dir*6 - _f.y)*0.02;     //すれ違うとき重ならないよう、少しずらしてそろえる
        var q = (p - G.roll[0])/(G.roll[1] - G.roll[0]);
        if(q > 0 && q < 1){
            var e = q*q*(3 - 2*q), a = e*Math.PI*2*_f.dir;
            _f.look.tilt = a - Math.round(a/(Math.PI*2))*Math.PI*2;     //回り終えると傾きが0に戻るよう、-π～πに収める
            _f.look.tiltV = 0;
        }
    },
    //居眠り：目を閉じたまま少しずつ沈み、沈みすぎるとはっと目を覚まして持ち直し、また眠る
    dozeStep:function(_f,_moving){
        var Z = CLIFF_SLEEP;
        if(_f.wake > 0){
            if(--_f.wake <= 0) _f.look.setMood("blink");
        }else{
            _f.sink += _moving ? Z.sink[0] : Z.sink[1];
            _f.look.elev += (Z.elev - _f.look.elev)*0.03;
            if(_f.sink > Z.jolt){
                _f.wake = Z.wake; _f.sinkV = -Z.up;
                _f.look.setMood("normal");
                _f.look.setFace("surprise", Math.round(Z.wake*0.6));
            }
        }
        if(_f.sinkV < 0){
            _f.sink = Math.max(0, _f.sink + _f.sinkV);
            _f.sinkV *= 0.9;
            if(_f.sink <= 0 || _f.sinkV > -0.05) _f.sinkV = 0;
        }
    },
    //風船：少しずつ浮き上がり、浮きすぎるとプロペラで下りて戻る
    floatStep:function(_f){
        var B = CLIFF_BALLOON;
        if(_f.sinkV > 0){
            _f.sink = Math.min(0, _f.sink + _f.sinkV);
            _f.sinkV *= 0.94;
            if(_f.sink >= 0 || _f.sinkV < 0.05) _f.sinkV = 0;
        }else{
            _f.sink -= B.rise;
            if(_f.sink < -B.lift){ _f.sinkV = B.down; _f.look.setFace("sad", 70); }
        }
    },
    //親子：子どもは親の後ろを遅れてついてくる(親が止まると寄ってくる)
    kidStep:function(_f,_moving,_gust){
        var F = CLIFF_FAMILY, c = _f.kid;
        var tx = _f.x - _f.dir*(_moving ? F.gap : F.gap*0.6)*_f.sc, ty = _f.y + F.drop*_f.sc;
        c.vx = (c.vx + (tx - c.x)*F.spring)*F.damp;
        c.vy = (c.vy + (ty - c.y)*F.spring)*F.damp;
        c.x += c.vx; c.y += c.vy;
        var m = Math.abs(c.vx) > 0.05;
        c.look.update(m ? (c.vx < 0 ? 3 : 4) : 5, c.vx*8 + _gust);
        if(!m) c.look.elev += (CLIFF_DRONE.elev - c.look.elev)*0.05;
    },
    //手紙を配る：谷の上を進むと、ときどきカバンから手紙を1通落とす
    mailStep:function(_f){
        var M = CLIFF_MAIL;
        _f.mailGo -= Math.abs(_f.vx);
        if(_f.mailGo > 0) return;
        _f.mailGo = M.every[0] + this.rnd(++_f.n, 68)*(M.every[1] - M.every[0]);
        if(_f.x < M.x[0] || _f.x > M.x[1]) return;
        _f.letters.push({ x:_f.x + 12*_f.sc*(_f.dir < 0 ? -1 : 1), y:_f.y + 20*_f.sc, vx:_f.vx*0.5, ph:this.rnd(_f.n, 69)*6.28, age:0 });
    },
    //落ちていく手紙(ひらひら揺れながら、風の波に流される)
    letterStep:function(_f,_gust){
        var M = CLIFF_MAIL, L = _f.letters;
        for(var i=L.length-1; i>=0; i--){
            var l = L[i];
            l.age++;
            l.vx *= 0.97;
            l.x += l.vx + Math.sin(l.age*0.06 + l.ph)*0.35 + _gust*0.1;
            l.y += M.fall*(0.7 + 0.5*Math.abs(Math.cos(l.age*0.06 + l.ph)));
            if(l.age > M.life) L.splice(i, 1);
        }
    },
    //空のドローン君たちを描く(_high：雲の間を飛ぶもの／低く飛ぶもの)
    drawDrones:function(_t,_high){
        var D = CLIFF_DRONE, self = this;
        if(!this.fly) return;
        for(var i=0; i<this.fly.length; i++){
            var f = this.fly[i];
            if((f.y < D.cloud) != _high) continue;
            if(f.letters.length) this.drawLetters(f);
            if(f.mode == "away") continue;
            var y = f.y + f.sink + D.bob[0]*Math.sin(f.bt*0.018 + f.ph) + D.bob[1]*Math.sin(f.bt*0.047 + f.ph*2);
            if(f.kind == "family") this.drawKid(f);
            this.drawFogged(f, f.x, y, f.sc, CLIFF_KINDS[f.kind].ext, function(_ox,_oy){ self.paintFlier(f, _ox, _oy); });
        }
    },
    //親子の子ども(小さく、上下に速めにぴょこぴょこ揺れる)
    drawKid:function(_f){
        var D = CLIFF_DRONE, c = _f.kid, ks = _f.sc*CLIFF_FAMILY.sc;
        var cy = c.y + D.bob[0]*0.6*Math.sin(_f.bt*0.03 + _f.ph + 1) + D.bob[1]*Math.sin(_f.bt*0.09 + _f.ph);
        this.drawFogged(_f, c.x, cy, ks, CLIFF_KINDS.plain.ext, function(_ox,_oy){ c.look.draw(_ox, _oy, ks); });
    },
    //落ちていく手紙(小さいので、かすみの色を混ぜた色でじかに塗る。下の靄に近づくほど淡く消える)
    drawLetters:function(_f){
        var M = CLIFF_MAIL, c = this.fogColor(_f), k = c[3], s = _f.sc*0.9;
        var col = "rgb(" + Math.round(250 + (c[0] - 250)*k) + "," + Math.round(246 + (c[1] - 246)*k) + "," + Math.round(236 + (c[2] - 236)*k) + ")";
        ctx.fillStyle = col;
        for(var i=0; i<_f.letters.length; i++){
            var l = _f.letters[i];
            ctx.globalAlpha = Math.min(1, l.age/10, (M.life - l.age)/60);
            ctx.save();
            ctx.translate(l.x, l.y);
            ctx.rotate(Math.sin(l.age*0.06 + l.ph)*0.6);
            ctx.scale(1, 0.45 + 0.55*Math.abs(Math.cos(l.age*0.09 + l.ph)));    //ひらひら裏返る
            ctx.fillRect(-5*s, -3.4*s, 10*s, 6.8*s);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    },
    //空のドローン君1体(と運ぶ物など)を (_ox,_oy) を中心に描く。飾りは等倍の絵(40px)の大きさで描いて、大きさを掛ける
    paintFlier:function(_f,_ox,_oy){
        var sc = _f.sc, L = _f.look, ink = FLAT_COLOR.line, t = L.t;
        var g = ctx, lw = 0.9/sc;     //細い線もかすれないよう、画面の上でおよそ0.9px
        var H = CLIFF_HANG, bob = Math.sin(t*0.08)*1.5, fwd = _f.dir < 0 ? -1 : 1;
        g.save();
        g.translate(_ox, _oy);
        g.scale(sc, sc);
        g.strokeStyle = ink; g.lineWidth = lw; g.lineJoin = "round";
        if(_f.kind == "carry"){
            //胴体の下から糸を垂らし、先に荷物(体の傾き・ふわふわにつく)
            g.save();
            g.translate(-Math.sin(L.tilt)*H.y, bob + Math.cos(L.tilt)*H.y);
            g.rotate(-_f.sw);
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0, H.len); g.stroke();
            g.translate(0, H.len);
            this.paintItem(_f.item, lw);
            g.restore();
        }else if(_f.kind == "pair"){
            //ふたりで長いはしごを吊って運ぶ(はしごも振り子で揺れる)
            var P = CLIFF_PAIR, dx = Math.sin(_f.sw)*P.len, dy = Math.cos(_f.sw)*P.len;
            var b1 = bob + H.y, b2 = Math.sin(_f.look2.t*0.08)*1.5 + H.y;
            var y1 = b1 + dy, y2 = b2 + dy, hw = P.gap + 8;
            g.beginPath(); g.moveTo(-P.gap, b1); g.lineTo(-P.gap + dx, y1); g.moveTo(P.gap, b2); g.lineTo(P.gap + dx, y2); g.stroke();
            g.save();
            g.translate(dx, (y1 + y2)/2);
            g.rotate(Math.atan2(y2 - y1, P.gap*2));
            g.fillStyle = "#a8784a"; g.lineWidth = lw*1.2;
            for(var x=-hw + 5; x<hw - 3; x+=7){ g.fillRect(x, 1, 2.2, 6); g.strokeRect(x, 1, 2.2, 6); }
            g.fillRect(-hw, -1.5, hw*2, 3); g.strokeRect(-hw, -1.5, hw*2, 3);
            g.fillRect(-hw, 6.5, hw*2, 3); g.strokeRect(-hw, 6.5, hw*2, 3);
            g.restore();
        }else if(_f.kind == "hurry"){
            //後ろへ流れる速さの線(うっすら)
            var back = _f.vx < 0 ? 1 : -1, sp = Math.min(1, Math.abs(_f.vx)/_f.sp);
            g.strokeStyle = "rgba(255,250,236,0.6)"; g.lineWidth = lw*1.4; g.lineCap = "round";
            g.beginPath();
            for(var i=0; i<3; i++){
                var ln = (14 + 18*Math.abs(Math.sin(t*0.37 + i*2.1)))*sp, x0 = back*(24 + (i % 2)*5);
                g.moveTo(x0, -6 + i*8); g.lineTo(x0 + back*ln, -6 + i*8);
            }
            g.stroke();
            g.lineCap = "butt";
        }else if(_f.kind == "balloon"){
            //プロペラの上の棒から糸を伸ばし、3つの風船(進むと後ろへなびく)
            var tops = [[-11,-58,"#e58a7c"],[1,-68,"#f0cf72"],[11,-56,"#8fb4dc"]];
            g.save();
            g.translate(0, bob - 12);
            g.rotate(_f.sw*0.8);
            for(var i=0; i<tops.length; i++){
                var bx = tops[i][0] + Math.sin(t*0.03 + i*2)*1.5, by = tops[i][1] + 12;
                g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(bx*0.3 + 2, by*0.5, bx, by + 8); g.stroke();
            }
            for(var i=0; i<tops.length; i++){
                var bx = tops[i][0] + Math.sin(t*0.03 + i*2)*1.5, by = tops[i][1] + 12;
                g.fillStyle = tops[i][2];
                g.beginPath(); g.ellipse(bx, by, 7, 8.5, 0, 0, Math.PI*2); g.fill(); g.lineWidth = lw*1.2; g.stroke();
                g.fillStyle = "rgba(255,255,255,0.6)"; g.fillRect(bx - 4, by - 4, 2, 3);
            }
            g.restore();
        }else if(_f.kind == "parasol"){
            //胴体の上から柄を立てた日傘(進むと後ろへ、風で揺れて傾く)
            g.save();
            g.translate(-fwd*4, bob - 10);
            g.rotate(_f.sw*0.9);
            g.lineWidth = lw*1.4;
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -30); g.stroke();
            g.beginPath();
            g.moveTo(-20, -27);
            g.quadraticCurveTo(-18, -46, 0, -48);
            g.quadraticCurveTo(18, -46, 20, -27);
            for(var i=0; i<4; i++) g.quadraticCurveTo(15 - i*10, -31, 10 - i*10, -27);   //ふちの波
            g.closePath();
            g.fillStyle = "#e7a6a0"; g.fill();
            g.fillStyle = "#f6e2c6";
            g.beginPath(); g.moveTo(0, -48); g.quadraticCurveTo(-5, -38, -10, -27); g.lineTo(0, -29); g.closePath(); g.fill();
            g.beginPath(); g.moveTo(0, -48); g.quadraticCurveTo(14, -40, 20, -27); g.lineTo(10, -28); g.closePath(); g.fill();
            g.lineWidth = lw*1.2;
            g.beginPath();
            g.moveTo(-20, -27); g.quadraticCurveTo(-18, -46, 0, -48); g.quadraticCurveTo(18, -46, 20, -27);
            for(var i=0; i<4; i++) g.quadraticCurveTo(15 - i*10, -31, 10 - i*10, -27);
            g.stroke();
            g.beginPath(); g.moveTo(0, -48); g.lineTo(0, -51); g.stroke();
            g.restore();
        }else if(_f.kind == "birds"){
            //いっしょに飛ぶ鳥(はばたく「へ」の字。ゆっくり位置を変える)
            var B = CLIFF_BIRDS;
            g.strokeStyle = B.col; g.lineWidth = lw*1.6; g.lineCap = "round";
            for(var i=0; i<B.fly.length; i++){
                var bx = fwd*B.fly[i][0] + Math.sin(t*0.013 + i*2.3)*6, by = B.fly[i][1] + Math.sin(t*0.017 + i)*5;
                var w = Math.sin(t*0.3 + i*1.7)*3.4;
                g.beginPath(); g.moveTo(bx - 5, by - w); g.quadraticCurveTo(bx - 2, by - 1.5, bx, by); g.quadraticCurveTo(bx + 2, by - 1.5, bx + 5, by - w); g.stroke();
            }
            g.lineCap = "butt";
        }
        g.restore();
        if(_f.kind == "pair"){
            L.draw(_ox - CLIFF_PAIR.gap*sc, _oy, sc);
            _f.look2.draw(_ox + CLIFF_PAIR.gap*sc, _oy, sc);
        }else L.draw(_ox, _oy, sc);
        if(_f.kind == "sleepy" && _f.wake <= 0) this.paintZzz(_f, _ox, _oy);
        if(_f.kind == "mail") this.paintSatchel(_f, _ox, _oy);
        if(_f.kind == "birds") this.paintPerch(_f, _ox, _oy);
    },
    //居眠りの「z」：頭の上から、向いている側の後ろへ流れながら昇っていく
    paintZzz:function(_f,_ox,_oy){
        var g = ctx, sc = _f.sc, t = _f.look.t, face = _f.dir < 0 ? -1 : 1;
        g.save();
        g.translate(_ox, _oy); g.scale(sc, sc);
        g.font = "bold 17px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.lineJoin = "round";
        for(var i=0; i<3; i++){
            var p = (t*0.011 + i/3) % 1, s = 0.6 + p*0.7;
            g.globalAlpha = Math.min(1, p*5, (1 - p)*3);
            g.save();
            g.translate(-face*(8 + p*18), -22 - p*30);
            g.scale(s, s);
            g.strokeStyle = FLAT_COLOR.line; g.lineWidth = 3.6; g.strokeText("z", 0, 0);
            g.fillStyle = "#ffffff"; g.fillText("z", 0, 0);
            g.restore();
        }
        g.restore();
    },
    //手紙を配るカバン(胴体の前の下に提げる。中から手紙の先がのぞく)
    paintSatchel:function(_f,_ox,_oy){
        var g = ctx, sc = _f.sc, L = _f.look, fwd = _f.dir < 0 ? -1 : 1, lw = 0.9/sc;
        g.save();
        g.translate(_ox, _oy + Math.sin(L.t*0.08)*1.5*sc); g.scale(sc, sc);
        g.rotate(L.tilt);
        g.scale(fwd, 1);
        g.strokeStyle = FLAT_COLOR.line; g.lineWidth = lw; g.lineJoin = "round";
        g.beginPath(); g.moveTo(-6, 12); g.lineTo(8, 19); g.stroke();
        g.fillStyle = "#f6f0e2"; g.fillRect(6, 15, 7, 4); g.strokeRect(6, 15, 7, 4);
        g.fillStyle = "#8a5a36"; g.fillRect(3, 18, 14, 10); g.lineWidth = lw*1.2; g.strokeRect(3, 18, 14, 10);
        g.fillStyle = "#6e4528"; g.fillRect(3, 18, 14, 4); g.strokeRect(3, 18, 14, 4);
        g.restore();
    },
    //頭(プロペラのあいだ)に乗っている鳥(ときどき首をかしげて、ぴょんと跳ねる)
    paintPerch:function(_f,_ox,_oy){
        var g = ctx, sc = _f.sc, L = _f.look, t = L.t, fwd = _f.dir < 0 ? -1 : 1, lw = 0.9/sc;
        var hop = Math.max(0, Math.sin(t*0.05))*(Math.sin(t*0.011) > 0.7 ? 4 : 0);
        g.save();
        g.translate(_ox, _oy + Math.sin(t*0.08)*1.5*sc); g.scale(sc, sc);
        g.rotate(L.tilt);
        g.translate(2*fwd, -9 - hop);
        g.scale(fwd, 1);
        g.rotate(Math.sin(t*0.02)*0.15);
        g.strokeStyle = FLAT_COLOR.line; g.lineWidth = lw; g.lineJoin = "round";
        g.fillStyle = "#7d6a58";
        g.beginPath(); g.ellipse(0, -4, 5.4, 4.2, 0, 0, Math.PI*2); g.fill(); g.stroke();
        g.beginPath(); g.arc(4, -8, 3, 0, Math.PI*2); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-5, -4); g.lineTo(-9, -6); g.lineTo(-8, -2); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = "#e6a64a"; g.beginPath(); g.moveTo(6.6, -8.6); g.lineTo(9.4, -7.6); g.lineTo(6.6, -6.6); g.closePath(); g.fill();
        g.fillStyle = FLAT_COLOR.line; g.fillRect(4.4, -9, 1.2, 1.2);
        g.restore();
    },
    //ぶら下げて運ぶ荷物(糸の先が (0,0)。等倍の絵の大きさで)
    paintItem:function(_item,_lw){
        var g = ctx;
        g.strokeStyle = FLAT_COLOR.line; g.lineWidth = _lw*1.2; g.lineJoin = "round";
        if(_item == "box"){
            //段ボール箱(上のふたの影とテープ)
            g.fillStyle = "#c49a62"; g.fillRect(-11, 0, 22, 15);
            g.fillStyle = "#a57c48"; g.fillRect(-11, 0, 22, 3);
            g.fillStyle = "#ead4a2"; g.fillRect(-2, 0, 4, 15);
            g.strokeRect(-11, 0, 22, 15);
        }else if(_item == "bag"){
            //紙袋(パンとネギが飛び出している)
            g.save(); g.translate(-3, 4); g.rotate(-0.35);
            g.fillStyle = "#e3a85c"; g.beginPath(); g.ellipse(0, 0, 3, 9, 0, 0, Math.PI*2); g.fill(); g.stroke();
            g.restore();
            g.fillStyle = "#6f9a3c"; g.fillRect(3, -6, 2.6, 12); g.strokeRect(3, -6, 2.6, 12);
            g.beginPath(); g.moveTo(-9, 3); g.lineTo(9, 3); g.lineTo(10.5, 20); g.lineTo(-10.5, 20); g.closePath();
            g.fillStyle = "#d6b483"; g.fill(); g.stroke();
            g.fillStyle = "#b8935e"; g.fillRect(-9.2, 6, 18.4, 1.8);
        }else{
            //鉢植え(2本の吊りひもで、鉢から葉と花がのぞく)
            g.beginPath(); g.moveTo(-7, 11); g.lineTo(0, 0); g.lineTo(7, 11); g.stroke();
            g.fillStyle = "#5f8a3a";
            g.beginPath(); g.ellipse(-4, 8, 5, 2.6, -0.6, 0, Math.PI*2); g.fill(); g.stroke();
            g.beginPath(); g.ellipse(4, 7, 5, 2.6, 0.6, 0, Math.PI*2); g.fill(); g.stroke();
            g.fillStyle = "#f19aae"; g.beginPath(); g.arc(0, 5, 3.2, 0, Math.PI*2); g.fill(); g.stroke();
            g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(0, 5, 1.2, 0, Math.PI*2); g.fill();
            g.beginPath(); g.moveTo(-8, 11); g.lineTo(8, 11); g.lineTo(6, 22); g.lineTo(-6, 22); g.closePath();
            g.fillStyle = "#b8643a"; g.fill(); g.stroke();
            g.fillStyle = "#9a4f2b"; g.fillRect(-8, 11, 16, 3); g.strokeRect(-8, 11, 16, 3);
        }
    },
    //かすみの色(r,g,b)と濃さ。遠いほど濃く、高さで空の色～谷の靄の色を混ぜる
    fogColor:function(_f){
        var D = CLIFF_DRONE;
        var k = (_f.sc - D.sc[0])/(D.sc[1] - D.sc[0]), fog = D.fog[0] + k*(D.fog[1] - D.fog[0]);
        var h = Math.max(0, Math.min(1, (_f.y - D.y0)/(D.y1 - D.y0))), c = [];
        for(var j=0; j<3; j++) c.push(Math.round(D.fogHi[j] + h*(D.fogLo[j] - D.fogHi[j])));
        c.push(Math.max(0, Math.min(1, fog)));
        return c;
    },
    //空や靄の色を重ねたドローン君(透けさせないよう、別のキャンバスに描いて絵のある所だけに色を重ねてから写す)
    //(_x,_y)：描く所　_sc：大きさ　_ext：絵の広がり(中心から左・上・右・下。等倍の絵の px)　_paint(ox,oy)：別のキャンバスの (ox,oy) を中心に描く
    //かすみの濃さと色は、その群れ(_f)の大きさと高さで決める(親子の子どもも親と同じ)
    drawFogged:function(_f,_x,_y,_sc,_ext,_paint){
        var l = _ext[0]*_sc, tp = _ext[1]*_sc;
        var pw = Math.ceil((_ext[0] + _ext[2])*_sc*renderScale), ph = Math.ceil((_ext[1] + _ext[3])*_sc*renderScale);
        var cv = this.fogCv || (this.fogCv = document.createElement("canvas"));
        if(cv.width < pw || cv.height < ph){ cv.width = Math.max(cv.width, pw); cv.height = Math.max(cv.height, ph); }
        var g = cv.getContext("2d"), keep = ctx;
        g.setTransform(1,0,0,1,0,0);
        g.clearRect(0, 0, pw, ph);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        g.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        ctx = g;        //DroneLook はいつもの ctx に描くので、少しのあいだ差し替える
        try{ _paint(l, tp); }finally{ ctx = keep; }
        //遠いほど濃く、高さで空の色～谷の靄の色を混ぜて重ねる
        var c = this.fogColor(_f);
        g.setTransform(1,0,0,1,0,0);
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = "rgba(" + c.join(",") + ")";
        g.fillRect(0, 0, pw, ph);
        g.globalCompositeOperation = "source-over";
        ctx.drawImage(cv, 0, 0, pw, ph, _x - l, _y - tp, pw/renderScale, ph/renderScale);
    },
    //草原にドローン君がいる案か(タイトルのドローン君は描かない)
    ownDrone:function(){ return this.on() && !!this.pal().ranges; },

    //案A：舞い上がる綿毛／案B：ほたる
    drawMotes:function(_t){
        var night = this.pick == "b";
        for(var i=0; i<this.motes.length; i++){
            var m = this.motes[i];
            var x = (m.x + _t*m.sp*0.8 + Math.sin(_t*0.015 + m.ph)*18) % CW;
            var y = night ? 330 + (m.y % 200) + Math.sin(_t*0.02 + m.ph)*14 : ((m.y - _t*m.sp) % CH + CH) % CH;
            var a = night ? Math.max(0, Math.sin(_t*0.025 + m.ph))*0.8 : 0.35 + 0.25*Math.sin(_t*0.03 + m.ph);
            ctx.fillStyle = night ? "rgba(220,255,170," + a + ")" : "rgba(255,246,225," + a + ")";
            ctx.beginPath(); ctx.arc(x, y, night ? 1.6 : 1.8, 0, Math.PI*2); ctx.fill();
        }
    }
};
titleArt.init();
titleArt.sync();

//案のあるときだけ、タイトルの背景を替える(設定で曲を替えるとすぐ切り替わる)
(function(){
    var orig = startScreen.drawBackground;
    startScreen.drawBackground = function(){
        titleArt.sync();
        if(titleArt.on()) titleArt.draw(this.t);
        else orig.apply(this, arguments);
    };
    //タイトルを出ていくときは、描いておいたキャンバスを手放す(大きな画面では数十MBになるため)
    var change = page.change;
    page.change = function(_i){
        if(_i != 0) titleArt.cache = null;
        return change.apply(this, arguments);
    };
})();
