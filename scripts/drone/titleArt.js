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
//遠くの空を横切るドローン君たち(ポインタには付いていかない)。大きさ・淡さ・数・速さは、元のタイトル画面の背景を横切る影(startScreen.js の TITLE_SHADOWS)に合わせる
//横切りながら上下にふらふら揺れ、たまに止まって向こう(谷の先)を眺める。画面の端から出ると、しばらくして反対側から別の高さで帰ってくる
//y0〜y1：飛ぶ高さの範囲(px。草原より上)　sc：大きさ(遠目なので小さく)　speed：飛ぶ速さ(px/フレーム)　fog：かすみ(絵に重ねる空・靄の色の濃さ。いちばん小さい(遠い)もの～いちばん大きい(近い)もの。透けさせずに、遠くほど雲や靄に隠れて淡く見せる)
//fogHi・fogLo：高い所の空の色・低い所(谷)の靄の色(r,g,b。高さで混ぜる)
//bob：上下の揺れ(px。周期の違う2つの波の大きさ)　stop：次に止まるまでに進む道のり(px)　wait：止まって眺める長さ(フレーム)　away：画面の外にいる長さ(フレーム)
//cloud：これより高い所を飛ぶときは雲の間(下の雲が手前を流れる)、低いときは谷の上(山なみより手前)に描く
//elev：眺めるときに見下ろす向き(0 水平～1 真下)　sway：風の波で傾く量
const CLIFF_DRONE = { y0:50, y1:370, sc:[0.35,0.6], speed:[0.25,0.6], fog:[0.7,0.2], fogHi:[150,164,200], fogLo:[228,198,180], bob:[9,4], stop:[260,800], wait:[120,360], away:[120,600],
                      cloud:200, elev:0.25, sway:1.5 };
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
            this.grass.push(list);
        }
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
        ctx.fillRect(0,0,CW,CH);
        this.fliers(_t);
        this.drawRays(_t, P.sun);
        this.drawSun(_t, P.sun);
        this.drawStreaks(_t);
        //遠い山なみ。下に夕日の色の霞
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
        this.drawValley(_t);
        this.drawDrones(_t, false);     //低く飛ぶものは谷の上
        this.drawMeadowCliff(_t);
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
    //はるか下の谷：かすんだ谷の床・夕日を映す川・川ぞいの小さな町・谷にたまる雲・下を飛ぶ鳥・左右の岩の崖
    drawValley:function(_t){
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
        ctx.fillStyle = "rgba(246,216,166,0.85)";
        ctx.beginPath();
        var pts = [];
        for(var s=0; s<=40; s++){
            var u = s/40, y = top + 2 + u*u*(bot - top), x = 470 + Math.sin(u*4.6 + 0.6)*(30 + u*170) - u*150;
            pts.push([x, y, 1 + u*u*30]);
        }
        ctx.moveTo(pts[0][0] - pts[0][2], pts[0][1]);
        for(var s=0; s<pts.length; s++) ctx.lineTo(pts[s][0] - pts[s][2], pts[s][1]);
        for(var s=pts.length - 1; s>=0; s--) ctx.lineTo(pts[s][0] + pts[s][2], pts[s][1]);
        ctx.closePath();
        ctx.fill();
        //川面のきらめき
        for(var s=4; s<pts.length; s+=3){
            var a = 0.3 + 0.3*Math.sin(_t*0.05 + s*1.7);
            ctx.fillStyle = "rgba(255,250,230," + a + ")";
            ctx.fillRect(pts[s][0] - pts[s][2]*0.5, pts[s][1], pts[s][2], 1);
        }
        //川ぞいの小さな町(点の集まり)
        for(var i=0; i<90; i++){
            var s = 6 + Math.floor(this.rnd(i,45)*20), P = pts[s], side = this.rnd(i,46) < 0.5 ? -1 : 1;
            var x = P[0] + side*(P[2] + 3 + this.rnd(i,47)*(10 + s*1.2)), y = P[1] + (this.rnd(i,48) - 0.5)*6, sz = 1 + s/16;
            ctx.fillStyle = i % 3 ? "rgba(236,222,200,0.75)" : "rgba(170,100,80,0.75)";
            ctx.fillRect(x, y, sz*1.6, sz);
        }
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
    //崖の上の草原(主役)
    drawMeadowCliff:function(_t){
        var gx = this.gustX(_t);
        //草原の地面：崖の際は夕日で明るく、手前ほど暗い
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
        //風の波の通り道は、なびいた草の裏が光って明るく見える
        var sh = ctx.createLinearGradient(gx - CLIFF_GUST_W*1.4, 0, gx + CLIFF_GUST_W*1.4, 0);
        sh.addColorStop(0, "rgba(255,232,170,0)");
        sh.addColorStop(0.5, "rgba(255,232,170,0.16)");
        sh.addColorStop(1, "rgba(255,232,170,0)");
        ctx.fillStyle = sh;
        ctx.fillRect(gx - CLIFF_GUST_W*1.4, CLIFF_EDGE_Y - 20, CLIFF_GUST_W*2.8, CH - CLIFF_EDGE_Y + 20);
        //草(奥の層から)。層ごとに、色ごとに1つの形にまとめて塗る。日の当たる右側のふちに光、ところどころに穂
        var pt = [0,0,0,0,0,0];
        for(var L=0; L<CLIFF_GRASS.length; L++){
            var G = CLIFF_GRASS[L], list = this.grass[L], his = [], heads = [];
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
                ctx.beginPath();
                for(var i=0; i<list.length; i++){
                    var b = list[i];
                    if(b.c != c) continue;
                    var bx = b.x, by = this.edgeY(bx) + b.d;
                    var a = this.wind(bx, _t, b.k, gx)*G.flex + b.lean, w = G.w*b.w;
                    this.blade(bx, by, a, b.h, w, G.droop, pt);
                    //日の当たる側のふち(根元から 3 割の所から先へ)
                    his.push(pt[0] + w*0.25, pt[1], pt[2] + w*0.14, pt[3], pt[4], pt[5]);
                    if(b.head) heads.push(pt[4], pt[5], Math.atan2(pt[5] - pt[3], pt[4] - pt[2]), b.h);
                }
                ctx.fill();
            }
            ctx.strokeStyle = G.hi;
            ctx.lineWidth = L < 2 ? 0.7 : 1;
            ctx.beginPath();
            for(var i=0; i<his.length; i+=6){ ctx.moveTo(his[i], his[i + 1]); ctx.quadraticCurveTo(his[i + 2], his[i + 3], his[i + 4], his[i + 5]); }
            ctx.stroke();
            //穂(先に付いた細長い粒の集まり。緑)
            if(heads.length){
                ctx.fillStyle = G.head[1];
                ctx.beginPath();
                for(var i=0; i<heads.length; i+=4){
                    var hl = heads[i + 3]*0.16, an = heads[i + 2];
                    var ex = heads[i] + Math.cos(an)*hl*0.45, ey = heads[i + 1] + Math.sin(an)*hl*0.45;
                    ctx.moveTo(ex + Math.cos(an)*hl*0.6, ey + Math.sin(an)*hl*0.6);     //前の穂と線でつながらないように
                    ctx.ellipse(ex, ey, hl*0.6, Math.max(1, hl*0.16), an, 0, Math.PI*2);
                }
                ctx.fill();
                ctx.strokeStyle = G.hi;
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                for(var i=0; i<heads.length; i+=4){
                    var hl = heads[i + 3]*0.16, an = heads[i + 2], hx = heads[i] + Math.cos(an)*hl*0.45, hy = heads[i + 1] + Math.sin(an)*hl*0.45;
                    //穂の毛(短い線を並べる)
                    for(var j=-2; j<=2; j++){
                        var ox = hx + Math.cos(an)*j*hl*0.22, oy = hy + Math.sin(an)*j*hl*0.22;
                        ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(an - 0.9)*hl*0.3, oy + Math.sin(an - 0.9)*hl*0.3);
                    }
                }
                ctx.stroke();
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

    //空のドローン君たちを1コマ進める(同じ時刻なら進めない)。横切る(fly) → たまに止まって眺める(gaze) → 端から出ると外で待つ(away) → 反対側から別の高さで帰ってくる
    fliers:function(_t){
        var D = CLIFF_DRONE, r = this.rnd.bind(this);
        if(!this.fly){
            this.fly = [];
            for(var i=0; i<TITLE_SHADOWS; i++){
                var dir = r(i,70) < 0.5 ? -1 : 1;
                this.fly.push({ x:r(i,71)*CW, y:D.y0 + r(i,72)*(D.y1 - D.y0), dir:dir, vx:0, mode:"fly", wait:0, n:i*100,
                                go:D.stop[0] + r(i,73)*(D.stop[1] - D.stop[0]),
                                sc:D.sc[0] + r(i,74)*(D.sc[1] - D.sc[0]), sp:D.speed[0] + r(i,75)*(D.speed[1] - D.speed[0]),
                                ph:r(i,76)*6.28, bt:0, look:new DroneLook() });
            }
            this.fly.sort(function(a,b){ return a.sc - b.sc; });    //遠い(小さい)ものから描く
        }
        if(_t == this.flyT) return;
        this.flyT = _t;
        var gx = this.gustX(_t);
        for(var i=0; i<this.fly.length; i++){
            var f = this.fly[i], want = 0;
            if(f.mode == "fly"){
                want = f.dir*f.sp;
                f.go -= Math.abs(f.vx);
                //画面の中ほどで、決めた道のりを進んだら止まる
                if(f.go <= 0 && f.x > 80 && f.x < CW - 80){ f.mode = "gaze"; f.wait = D.wait[0] + r(++f.n, 60)*(D.wait[1] - D.wait[0]); }
                if(f.x < -40 || f.x > CW + 40){ f.mode = "away"; f.wait = D.away[0] + r(++f.n, 61)*(D.away[1] - D.away[0]); }
            }else if(--f.wait <= 0){
                if(f.mode == "away"){
                    //反対側から、別の高さで帰ってくる
                    f.dir = -f.dir;
                    f.x = f.dir > 0 ? -38 : CW + 38;
                    f.y = D.y0 + r(++f.n, 62)*(D.y1 - D.y0);
                    f.vx = f.dir*f.sp;
                }
                f.mode = "fly";
                f.go = D.stop[0] + r(++f.n, 63)*(D.stop[1] - D.stop[0]);
            }
            if(f.mode == "away") f.vx = 0;
            f.vx += (want - f.vx)*0.04;       //止まる・動き出すのはなめらかに
            f.x += f.vx;
            //上下のふらふらは、飛んでいる速さの分だけ進める(止まると揺れも静まる)
            var k = Math.abs(f.vx)/f.sp;
            f.bt += 0.4 + k;
            var g = (f.x - gx)/CLIFF_GUST_W, moving = Math.abs(f.vx) > 0.05;
            f.look.update(moving ? (f.vx < 0 ? 3 : 4) : 5, f.vx*8 + D.sway*Math.exp(-g*g));
            if(!moving) f.look.elev += (D.elev - f.look.elev)*0.05;
        }
    },
    //空のドローン君たちを描く(_high：雲の間を飛ぶもの／低く飛ぶもの)
    drawDrones:function(_t,_high){
        var D = CLIFF_DRONE;
        if(!this.fly) return;
        for(var i=0; i<this.fly.length; i++){
            var f = this.fly[i];
            if(f.mode == "away" || (f.y < D.cloud) != _high) continue;
            var y = f.y + D.bob[0]*Math.sin(f.bt*0.018 + f.ph) + D.bob[1]*Math.sin(f.bt*0.047 + f.ph*2);
            this.drawFogged(f, y);
        }
    },
    //空や靄の色を重ねたドローン君(透けさせないよう、別のキャンバスに描いて絵のある所だけに色を重ねてから写す)
    drawFogged:function(_f,_y){
        var D = CLIFF_DRONE, half = DRONE_SIZE*_f.sc*0.8, px = Math.ceil(half*2*renderScale);
        var cv = this.fogCv || (this.fogCv = document.createElement("canvas"));
        if(cv.width < px){ cv.width = cv.height = px; }
        var g = cv.getContext("2d"), keep = ctx;
        g.setTransform(1,0,0,1,0,0);
        g.clearRect(0, 0, px, px);
        g.globalCompositeOperation = "source-over";
        g.setTransform(renderScale, 0, 0, renderScale, 0, 0);
        ctx = g;        //DroneLook はいつもの ctx に描くので、少しのあいだ差し替える
        try{ _f.look.draw(half, half, _f.sc); }finally{ ctx = keep; }
        //遠いほど濃く、高さで空の色～谷の靄の色を混ぜて重ねる
        var k = (_f.sc - D.sc[0])/(D.sc[1] - D.sc[0]), fog = D.fog[0] + k*(D.fog[1] - D.fog[0]);
        var h = Math.max(0, Math.min(1, (_f.y - D.y0)/(D.y1 - D.y0))), c = [];
        for(var j=0; j<3; j++) c.push(Math.round(D.fogHi[j] + h*(D.fogLo[j] - D.fogHi[j])));
        g.setTransform(1,0,0,1,0,0);
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = "rgba(" + c.join(",") + "," + fog + ")";
        g.fillRect(0, 0, px, px);
        g.globalCompositeOperation = "source-over";
        ctx.drawImage(cv, 0, 0, px, px, _f.x - half, _y - half, half*2, half*2);
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
})();
