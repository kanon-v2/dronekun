//------------------------------------------------------------------------------
//  戦闘画面の背景
//  ・奥：WAVEが進むと昼→夕方→夜→戦場へ移り変わる空と街(ストーリー画面の空 storyScreen.drawSky を薄く敷く)
//  ・手前：戦いに反応する方眼。衝撃波・ボスの着地で網が波打ち、かすったマスが光る
//  背景は「WAVEの番号」と「自分の画面で起きたこと」だけで決まるので、協力プレイ・対戦でも通信は要らない
//------------------------------------------------------------------------------
//空の上に重ねる色と濃さ(敵の弾が白地と同じくらい見やすいよう、空はごく薄く見せる。夜・戦場は白だと灰色になるので、色を付けて夜らしさを残す)
const BG_PAPER = {
    day:  ["255,255,255", 0.84],
    dusk: ["255,247,242", 0.84],
    night:["238,242,252", 0.86],
    war:  ["252,242,236", 0.86]
};
const BG_GROUND = { day:"#a8d88f", dusk:"#2f2640", night:"#0b1020", war:"#110c0e" };   //地平線より手前の地面の色
const BG_HORIZON_Y = 80;        //ストーリーの空を下へずらす量(px。地平線を画面の下のほうへ)
const BG_SCALE = 1.04;          //空を少し大きく描く(ドローン君の動きと逆にずらしても端が見えないように)
const BG_PARALLAX = 0.035;      //ドローン君が動いた分の何倍、空を逆へずらすか(奥行き)
const BG_REDRAW = 6;            //空を描き直す間隔(フレーム)。空はゆっくり動くので、毎フレームは描かない
const BG_RES = 0.5;             //空を描く細かさ(ゲームの大きさの何倍。薄く敷くので粗くてよい)
//方眼の目の大きさ(px)。タイトルの設定で選ぶ(viewOpt.gridSize)。光る範囲などの「マス数」は普通の方眼(normal)で数えた値で、
//細かい方眼ではその2倍のマス数にして、画面の上で同じくらいの広さになるようにする
const BG_CELL_SIZES = { fine:GS/4, normal:GS/2, large:GS };    //large(大きい)は公開版と同じ背景・演出(classic)
const BG_WARP_STEP = GS/4;      //方眼の線を波で曲げるときの区切り(px。小さいほどなめらかで重い。細かい方眼でもこれより細かくしない)
const BG_CLASSIC_COLOR = "#f0f0f0";     //方眼なしの設定のときの、公開版と同じごく薄い方眼の色
const BG_GRID_COLOR = "rgba(40,60,90,0.08)";   //方眼の線の色(目が細かいので少し薄く)
const RIPPLE_MAX = 8;           //同時に起きる波の数の上限
const RIPPLE_W = 40;            //波の幅(px)
const RIPPLE_GLOW = 0.6;        //波の山で方眼の線が光る濃さ(0〜1)
const RIPPLE_LINE = 2.5;        //波の山で光る線の太さ(px)
const GRAZE_DIAMOND_R = 1;      //かすったときに光るひし形の大きさ(マス。コンボの段階なし)
const GRAZE_DIAMOND_STEP = 2;   //コンボの段階が1つ上がるごとに広がるマス数
const GLOW_TIME = 45;           //かすったマスが光っている時間(フレーム)
const GLOW_ALPHA = 0.45;        //かすったマスの光の濃さ
//光るマスの描き方の候補(見比べは tools/bg-glow.html。ゲームでは URL に #bgstyle=C のように付けると試せる)
//  bloom：マスからはみ出すうすい色のにじみの濃さ(bloomW：はみ出す幅px)
//  body：マスの中の濃さ　bodyLite：マスの中の色を白へ近づける割合(0：元の色 1：白)
//  core：まんなかの芯の濃さ(0でなし)　coreIn：芯をふちから内側へ寄せる幅px　coreLite：芯の白さ
//  edge：色の枠の濃さ(0でなし)　edgeW：枠の太さpx
//  (濃さはどれも、マスごとの光の強さに掛ける)
const CELL_STYLES = {
    A:{ name:"色の塗り＋白っぽい芯",   bloom:0.3,  bloomW:4, body:1,   bodyLite:0,    core:0.8, coreIn:4, coreLite:0.7,  edge:0,   edgeW:0 },
    B:{ name:"中間(色寄り)",           bloom:0.28, bloomW:4, body:1.2, bodyLite:0.35, core:0.9, coreIn:3, coreLite:0.9,  edge:0.9, edgeW:1 },
    C:{ name:"中間",                   bloom:0.27, bloomW:4, body:1.5, bodyLite:0.6,  core:1,   coreIn:3, coreLite:0.95, edge:1.2, edgeW:1.2 },
    D:{ name:"中間(白寄り)",           bloom:0.26, bloomW:4, body:1.8, bodyLite:0.78, core:0,   coreIn:0, coreLite:0,    edge:1.4, edgeW:1.5 },
    E:{ name:"白い中＋色の枠",         bloom:0.25, bloomW:4, body:2,   bodyLite:0.92, core:0,   coreIn:0, coreLite:0,    edge:0.9, edgeW:1 },
    F:{ name:"色のふち＋大きな白い芯", bloom:0.3,  bloomW:4, body:0.9, bodyLite:0.15, core:1.4, coreIn:2, coreLite:1,    edge:0,   edgeW:0 }
};
const CELL_STYLE = "E";         //ふだん使う描き方
const BG_COMBO_COLOR = "255,185,0";    //かすり・かすりコンボで光るマスの色(黄色)
const AURA_GRAY = "135,150,180"; //コンボがないときに、ドローン君の下のマスが光る色(灰色。少し青みのある銀色で光って見えるように)
const BG_JUST_COLOR = "20,175,255";    //ジャスト衝撃波で光る方眼の色(水色。JUST_COLOR より濃くして、白い芯との差で光って見えるように)
const AURA_R = 1;               //ドローン君の下で光るひし形の大きさ(マス。コンボなし)
const AURA_R_ADD = 3;           //コンボが COMBO_MAX に届くまでに、ひし形が広がるマス数
const AURA_ALPHA = 0.28;        //ドローン君の下のマスの濃さ(コンボなし)
const AURA_ALPHA_ADD = 0.35;    //コンボが COMBO_MAX に届くまでに、濃くなる分
const AURA_TRAIL = 22;          //ドローン君が離れたあと、通ったマスが光り続ける時間(フレーム。コンボで長くなる)
const GLOW_MAX = 8000;          //光っているマスの数の上限(細かい方眼では、ジャスト衝撃波の輪だけで数千マスになる)
const JUST_DIAMOND_R = 4;       //ジャスト衝撃波で、ドローン君のまわりが光るひし形の大きさ(マス)
const JUST_SPREAD_WAIT = 6;     //ひし形が光ってから、外へ伝わり始めるまで(フレーム)
const JUST_SPREAD_DELAY = 3.5;  //外へ1マス伝わるのにかかる時間(フレーム。大きいほどゆっくり)
const JUST_SPREAD_RANGE = 22;   //ひし形の輪が伝わるところまで(ドローン君からのマス数。縦横に数えた距離)
const JUST_SPREAD_JITTER = 14;  //マスごとの光り始めのずれ(フレーム。そろって進まず、少しずつ点いていくように)
const JUST_SPREAD_LIFE = 24;    //伝わっていく輪の1マスが光っている時間(フレーム。マスごとに0.7〜1.3倍)
const JUST_SPREAD_ALPHA = 0.4;  //伝わっていく輪の色の濃さ(遠いほど薄くなる)

var battleBg = {
    t:0,                //背景の時間(フレーム)
    last:0,             //前に描いた時刻(ミリ秒)
    sky:null,           //空を描いておくキャンバス
    skyCtx:null,
    skyName:"",         //描いてある空の種類
    skyAge:0,           //描いてからのフレーム数
    ripples:[],         //方眼の波 { x, y, age, amp:押し広げる大きさ(px), spd:広がる速さ(px/フレーム), w:波の幅(px), life:消えるまで(フレーム), color:光る色"r,g,b" }
    //光るマスの描き方(CELL_STYLES の名前)。URL に #bgstyle=C のように付けると、その描き方で試せる
    style:(function(){ var m = /bgstyle=([A-Z])/i.exec(location.hash); return m ? m[1].toUpperCase() : CELL_STYLE; })(),
    cells:[],           //このコマで光らせるマス { x, y, color, a }(fillCell で集め、flushCells で描く)
    auraI:null, auraJ:null,     //ドローン君がいたマス(通ったマスに光を残すため)
    glows:[],           //光っているマス { i, j, life:残り(フレーム), max:光る長さ, a:濃さ, color:"r,g,b" }

    //WAVEに合わせた空の種類(ストーリーの流れと同じ順：昼→夕方→夜→真実のあとは戦場)
    skyFor:function(){
        if(versus.active) return "dusk";
        var w = game.wave;
        if(w > REVEAL_WAVE) return "war";
        if(w > 10) return "night";
        if(w > 5) return "dusk";
        return "day";
    },

    //------------------------------------------------------------------ 出来事を受け取る
    //方眼を波打たせる(_amp：押し広げる大きさpx　_spd：広がる速さ　_life：消えるまでのフレーム　_color：波の山で線が光る色"r,g,b")
    ripple:function(_x,_y,_amp,_spd,_life,_color){
        if(this.ripples.length >= RIPPLE_MAX) this.ripples.shift();
        this.ripples.push({ x:_x, y:_y, age:0, amp:_amp, spd:_spd, w:RIPPLE_W, life:_life, color:_color || "255,170,80" });
    },
    //かすった場所のマスを黄色に光らせる。コンボが続くほど広く(_tier：コンボの段階 0〜3)
    graze:function(_x,_y,_tier){
        this.diamond(_x, _y, GRAZE_DIAMOND_R + _tier*GRAZE_DIAMOND_STEP, BG_COMBO_COLOR, GLOW_TIME, GLOW_ALPHA);
    },
    //ジャスト衝撃波：ドローン君のまわりのマスがひし形に光り、そのあと外へひし形の輪になって、ゆっくり伝わっていく
    //輪がそろって進むと光が駆け抜けたようにしか見えないので、マスごとに光り始めを少しずらし(決まった並びのばらつき)、
    //マスが少しずつ点いていくデジタルな感じにする
    justSpread:function(_x,_y,_color){
        this.diamond(_x, _y, JUST_DIAMOND_R, _color, GLOW_TIME, GLOW_ALPHA*1.3);
        var C = this.cell(), k = BG_CELL_SIZES.normal/C;   //k：普通の方眼の1マスが、今の方眼の何マスか
        var ci = Math.floor(_x/C), cj = Math.floor(_y/C), r0 = this.cellsOf(JUST_DIAMOND_R), R = this.cellsOf(JUST_SPREAD_RANGE);
        var nx = Math.ceil(CW/C), ny = Math.ceil(CH/C);
        for(var i=Math.max(0, ci - R); i<=Math.min(nx - 1, ci + R); i++){
            for(var j=Math.max(0, cj - R); j<=Math.min(ny - 1, cj + R); j++){
                var d = Math.abs(i - ci) + Math.abs(j - cj);
                if(d <= r0 || d > R) continue;
                //ひし形が光ってから JUST_SPREAD_WAIT 後に、1マスごとに JUST_SPREAD_DELAY ずつ遅れて光る(遠いほど薄く)
                var s = storyScreen.hash(i - ci, j - cj);   //マスごとに決まった0〜1の値
                var wait = JUST_SPREAD_WAIT + (d - r0)*JUST_SPREAD_DELAY/k + s*JUST_SPREAD_JITTER;   //マスが大きいと1マス進むのに長くかかる(画面の上で同じ速さ)
                var life = JUST_SPREAD_LIFE*(0.7 + 0.6*s);
                var a = JUST_SPREAD_ALPHA*(1 - 0.75*(d - r0)/(R - r0));
                this.glows.push({ i:i, j:j, life:life + wait, max:life, a:a, color:_color });
            }
        }
        this.trimGlows();
    },
    //(_x,_y)のマスを中心に、まわり _r マス(普通の方眼で数えた数)までのひし形を光らせる(まんなかほど長く光る)
    diamond:function(_x,_y,_r,_color,_life,_alpha){
        var C = this.cell(), k = BG_CELL_SIZES.normal/C, r = this.cellsOf(_r);
        var ci = Math.floor(_x/C), cj = Math.floor(_y/C);
        for(var i=ci-r; i<=ci+r; i++){
            for(var j=cj-r; j<=cj+r; j++){
                var d = Math.abs(i - ci) + Math.abs(j - cj);
                if(d > r) continue;
                this.glows.push({ i:i, j:j, life:_life - d*2/k, max:_life, a:_alpha, color:_color });
            }
        }
        this.trimGlows();
    },
    //今の方眼の目の大きさ(px)
    cell:function(){ return BG_CELL_SIZES[viewOpt.gridSize] || BG_CELL_SIZES.normal; },
    //普通の方眼で数えたマス数 _n を、今の方眼のマス数にする
    cellsOf:function(_n){ return Math.round(_n*BG_CELL_SIZES.normal/this.cell()); },
    trimGlows:function(){
        if(this.glows.length > GLOW_MAX) this.glows.splice(0, this.glows.length - GLOW_MAX);
    },
    //WAVEの始め・画面に入ったとき(前の戦いの波を持ち越さない)
    reset:function(){
        this.ripples = [];
        this.glows = [];
        this.auraI = null;
    },

    //------------------------------------------------------------------ 描く
    draw:function(){
        //時間は描いた間隔で進める(戦闘画面・対戦画面のどちらから呼ばれても同じ速さで動くように)
        var now = performance.now();
        var dt = this.last ? Math.min(3, (now - this.last)/STEP) : 1;
        this.last = now;
        this.t += dt;
        this.step(dt);
        //方眼が大きい・なしの設定では、公開版と同じ背景だけを描く(大きい：白地にごく薄い方眼　なし：白地だけ)。空・光るマス・波は出さない
        if(this.classic()){ if(viewOpt.grid) this.drawClassic(); return; }
        this.render(dt);
    },
    //公開版と同じ背景・演出にするか(方眼が大きい・なし。ジャストの演出も公開版のまま：mainScreen.justFx)
    classic:function(){ return !viewOpt.grid || viewOpt.gridSize == "large"; },
    //公開版と同じ背景：白地(draw.js が塗る)に、GS ごとのごく薄い方眼
    drawClassic:function(){
        ctx.strokeStyle = BG_CLASSIC_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(var x=0; x<=CW; x+=GS){ ctx.moveTo(x + 0.5,0); ctx.lineTo(x + 0.5,CH); }
        for(var y=0; y<=CH; y+=GS){ ctx.moveTo(0,y + 0.5); ctx.lineTo(CW,y + 0.5); }
        ctx.stroke();
    },
    //今の状態を描く(時間は進めない)。_noTrail：通ったマスの光を足さない(同じコマを何度も描く見比べページ用)
    render:function(dt,_noTrail){
        this.drawSky(dt);
        this.cells = [];
        this.drawAura(dt,_noTrail);
        this.drawGlows();
        this.flushCells();
        this.drawGrid();
    },
    step:function(dt){
        for(var i=this.ripples.length-1; i>=0; i--){
            if((this.ripples[i].age += dt) >= this.ripples[i].life) this.ripples.splice(i,1);
        }
        for(var i=this.glows.length-1; i>=0; i--){
            if((this.glows[i].life -= dt) <= 0) this.glows.splice(i,1);
        }
    },

    //奥の空：別のキャンバスに粗く描いておき、ドローン君と逆へ少しずらして貼る
    drawSky:function(dt){
        var name = this.skyFor();
        if(!this.sky){
            this.sky = document.createElement("canvas");
            this.sky.width = Math.round(CW*BG_RES);
            this.sky.height = Math.round(CH*BG_RES);
            this.skyCtx = this.sky.getContext("2d");
        }
        this.skyAge += dt;
        if(name != this.skyName || this.skyAge >= BG_REDRAW){
            this.skyName = name;
            this.skyAge = 0;
            this.paintSky(name);
        }
        var w = CW*BG_SCALE, h = CH*BG_SCALE;
        var ox = (CW - w)/2 - (drone.X - CW/2)*BG_PARALLAX;
        var oy = (CH - h)/2 - (drone.Y - CH/2)*BG_PARALLAX*0.5;
        ctx.drawImage(this.sky, ox, oy, w, h);
    },
    //ストーリー画面の空を描く関数は、いつもの ctx に描くので、描く先を一時的に入れかえる
    paintSky:function(_name){
        var main = ctx, c = SKY_COLORS[_name];
        ctx = this.skyCtx;
        ctx.save();
        ctx.setTransform(BG_RES,0,0,BG_RES,0,0);
        ctx.fillStyle = c[0];
        ctx.fillRect(0,0,CW,CH);
        ctx.translate(0,BG_HORIZON_Y);
        storyScreen.drawSky(_name, this.t, true);
        //地平線より手前の地面
        ctx.fillStyle = BG_GROUND[_name];
        ctx.fillRect(0,380,CW,CH);
        ctx.setTransform(BG_RES,0,0,BG_RES,0,0);
        //白を重ねて薄くする(方眼紙ごしに見える遠くの景色)
        ctx.fillStyle = "rgba(" + BG_PAPER[_name][0] + "," + BG_PAPER[_name][1] + ")";
        ctx.fillRect(0,0,CW,CH);
        ctx.restore();
        ctx = main;
    },

    //マス(_i,_j)を色 _color・濃さ _a で光らせる(描くのは flushCells でまとめて)。
    //方眼が波で曲がっていても線からずれないよう、マスの中心を波で動かした位置に塗る
    fillCell:function(_i,_j,_p,_color,_a){
        var C = this.cell();
        if(_a < 0.01) return;
        var cx = (_i + 0.5)*C, cy = (_j + 0.5)*C;
        if(this.ripples.length > 0){ this.warp(cx, cy, _p); cx = _p.x; cy = _p.y; }
        this.cells.push({ x:cx, y:cy, color:_color, a:_a });
    },
    //光っているマスを描く(描き方は CELL_STYLES)。にじみ → マスの中 → 芯 → 色の枠 の順に、それぞれ全部のマスをまとめて描く
    //(となりのマスのにじみが中にかぶらないように)
    flushCells:function(){
        var C = this.cell();
        var s = CELL_STYLES[this.style] || CELL_STYLES[CELL_STYLE];
        var h = C/2, list = this.cells;
        if(s.bloom > 0){
            for(var k=0; k<list.length; k++){
                var c = list[k], b = h + s.bloomW;
                ctx.fillStyle = "rgba(" + c.color + "," + (c.a*s.bloom) + ")";
                ctx.fillRect(c.x - b, c.y - b, b*2, b*2);
            }
        }
        for(var k=0; k<list.length; k++){
            var c = list[k];
            ctx.fillStyle = "rgba(" + this.lite(c.color, s.bodyLite) + "," + Math.min(1, c.a*s.body) + ")";
            ctx.fillRect(c.x - h + 1, c.y - h + 1, C - 1, C - 1);
        }
        if(s.core > 0){
            var r = h - s.coreIn;
            for(var k=0; k<list.length; k++){
                var c = list[k];
                ctx.fillStyle = "rgba(" + this.lite(c.color, s.coreLite) + "," + Math.min(1, c.a*s.core) + ")";
                ctx.fillRect(c.x - r, c.y - r, r*2, r*2);
            }
        }
        if(s.edge > 0){
            ctx.lineWidth = s.edgeW;
            for(var k=0; k<list.length; k++){
                var c = list[k];
                ctx.strokeStyle = "rgba(" + c.color + "," + Math.min(1, c.a*s.edge) + ")";
                ctx.strokeRect(c.x - h + 0.5, c.y - h + 0.5, C, C);
            }
            ctx.lineWidth = 1;
        }
    },
    //色を白へ _t の割合だけ近づけた色(作った色は覚えておく)
    liteCache:{},
    lite:function(_color,_t){
        if(_t <= 0) return _color;
        var key = _color + "/" + _t, v = this.liteCache[key];
        if(!v){
            v = _color.split(",").map(function(n){ return Math.round(+n + (255 - n)*_t); }).join(",");
            this.liteCache[key] = v;
        }
        return v;
    },
    //ドローン君の下のマス：いつも灰色にうっすら光り、通ったマスも少し光が残る(後ろに尾を引く)。
    //かすりコンボが続いている間は黄色になり、コンボが増えるほど広く・濃く・脈打ち・チカチカ瞬く
    drawAura:function(dt,_noTrail){
        var C = this.cell();
        var show = versus.active ? true : (mainScreen.state != "over" && !mainScreen.down && !mainScreen.cinematic());
        if(!show){ this.auraI = null; return; }
        var combo = versus.active ? 0 : mainScreen.combo, on = combo > 0;
        var k = Math.min(1, combo/COMBO_MAX);
        var color = on ? BG_COMBO_COLOR : AURA_GRAY;
        var r = this.cellsOf(AURA_R + (on ? 1 + Math.round(k*AURA_R_ADD) : 0));
        var base = AURA_ALPHA + (on ? 0.1 + AURA_ALPHA_ADD*k : 0);
        var pulse = on ? 1 + (0.15 + 0.35*k)*Math.sin(this.t*(0.12 + 0.15*k)) : 1;
        var ci = Math.floor(drone.X/C), cj = Math.floor(drone.Y/C);
        //通ったマス：ドローン君が別のマスへ移ったら、前のマスに光を残す(コンボが多いと太く長く)
        if(!_noTrail && this.auraI != null && (ci != this.auraI || cj != this.auraJ)){
            var tr = on && k > 0.5 ? 1 : 0, life = AURA_TRAIL*(1 + 2*k);
            for(var i=this.auraI-tr; i<=this.auraI+tr; i++){
                for(var j=this.auraJ-tr; j<=this.auraJ+tr; j++){
                    if(Math.abs(i - this.auraI) + Math.abs(j - this.auraJ) > tr) continue;
                    this.glows.push({ i:i, j:j, life:life, max:life, a:base*0.9, color:color });
                }
            }
            this.trimGlows();
        }
        this.auraI = ci; this.auraJ = cj;
        var p = { x:0, y:0 }, blink = Math.floor(this.t/5);
        for(var i=ci-r; i<=ci+r; i++){
            for(var j=cj-r; j<=cj+r; j++){
                var d = Math.abs(i - ci) + Math.abs(j - cj);
                if(d > r) continue;
                var a = base*(1 - d/(r + 1))*pulse;
                //コンボが多いと、ところどころのマスが明るく瞬く
                if(on && k > 0.2 && storyScreen.hash(i*31 + j, blink) > 1 - 0.45*k) a *= 1.9;
                this.fillCell(i, j, p, color, Math.min(0.9, a));
            }
        }
    },
    //光っているマス(かすり・ジャスト衝撃波)。life が max より大きい間は、まだ光る前(遅れて光る)
    drawGlows:function(){
        var p = { x:0, y:0 };
        for(var k=0; k<this.glows.length; k++){
            var g = this.glows[k];
            if(g.life > g.max) continue;
            this.fillCell(g.i, g.j, p, g.color, g.a*Math.max(0, g.life/g.max));
        }
    },

    //手前の方眼(目の大きさはタイトルの設定。viewOpt)：波があるときだけ、線を細かく区切って曲げる。波の山にかかる区切りは、色付きの太い線で重ねて光らせる
    drawGrid:function(){
        var C = this.cell();
        ctx.strokeStyle = BG_GRID_COLOR;
        ctx.lineWidth = 1;
        if(this.ripples.length == 0){
            ctx.beginPath();
            for(var x=0; x<=CW; x+=C){ ctx.moveTo(x + 0.5,0); ctx.lineTo(x + 0.5,CH); }
            for(var y=0; y<=CH; y+=C){ ctx.moveTo(0,y + 0.5); ctx.lineTo(CW,y + 0.5); }
            ctx.stroke();
            return;
        }
        //光る線は波ごとに2段(山のまんなかは濃く、すそはうすく)。波の山にかかる区切りだけを入れるので軽い
        var glow = [];
        for(var i=0; i<this.ripples.length; i++) glow.push([new Path2D(), new Path2D()]);
        var path = new Path2D();
        for(var x=0; x<=CW; x+=C) this.gridLine(path, glow, x + 0.5, 0, 0, BG_WARP_STEP, Math.round(CH/BG_WARP_STEP));
        for(var y=0; y<=CH; y+=C) this.gridLine(path, glow, 0, y + 0.5, BG_WARP_STEP, 0, Math.round(CW/BG_WARP_STEP));
        ctx.stroke(path);
        //発光して見えるよう、太くうすいにじみ → 色の線 → 白に近い細い芯 の順に重ねる
        for(var i=0; i<this.ripples.length; i++){
            var r = this.ripples[i], fade = 1 - r.age/r.life;
            ctx.lineWidth = RIPPLE_LINE*3;
            ctx.strokeStyle = "rgba(" + r.color + "," + (RIPPLE_GLOW*0.18*fade) + ")";
            ctx.stroke(glow[i][1]);
            ctx.lineWidth = RIPPLE_LINE;
            ctx.strokeStyle = "rgba(" + r.color + "," + (RIPPLE_GLOW*0.35*fade) + ")";
            ctx.stroke(glow[i][0]);
            ctx.strokeStyle = "rgba(" + r.color + "," + (RIPPLE_GLOW*fade) + ")";
            ctx.stroke(glow[i][1]);
            ctx.lineWidth = 1;
            var s = CELL_STYLES[this.style] || CELL_STYLES[CELL_STYLE];
            ctx.strokeStyle = "rgba(" + this.lite(r.color, Math.max(0.7, s.coreLite, s.bodyLite)) + "," + (0.9*fade) + ")";
            ctx.stroke(glow[i][1]);
        }
        ctx.lineWidth = 1;
    },
    //方眼の線1本：(_x,_y)から(_dx,_dy)ずつ _n 区切り。波で動いた点のまわりだけ細かく区切り、動かないところは長い直線のまま(線が軽く描ける)
    gridLine:function(_path,_glow,_x,_y,_dx,_dy,_n){
        var p = { x:0, y:0 }, q = { x:0, y:0 }, skip = null, prevMoved = false;
        for(var i=0; i<=_n; i++){
            var x = _x + _dx*i, y = _y + _dy*i;
            var moved = this.warp(x, y, p);
            if(i == 0) _path.moveTo(p.x,p.y);
            else if(moved || prevMoved || i == _n){
                if(skip){ _path.lineTo(skip.x,skip.y); skip = null; }   //飛ばしてきた直線の終わり
                _path.lineTo(p.x,p.y);
                this.addGlow(_glow, x - _dx/2, y - _dy/2, q, p);
            }else skip = { x:p.x, y:p.y };
            prevMoved = moved;
            q.x = p.x; q.y = p.y;
        }
    },
    //区切り(_a→_b。曲げる前のまんなかが(_mx,_my))が波の山にかかっていれば、その波の光る線に足す
    addGlow:function(_glow,_mx,_my,_a,_b){
        for(var i=0; i<this.ripples.length; i++){
            var r = this.ripples[i];
            var k = Math.abs(Math.hypot(_mx - r.x, _my - r.y) - r.spd*r.age)/r.w;
            if(k > 1.6) continue;
            var g = _glow[i][k < 0.6 ? 1 : 0];
            g.moveTo(_a.x,_a.y); g.lineTo(_b.x,_b.y);
        }
    },
    //(_x,_y)の点が波で押されたあとの位置を _p に入れる。波の山(中心から spd*age の輪)の近くほど外へ押される。波がかかっていれば true
    warp:function(_x,_y,_p){
        var px = _x, py = _y, moved = false;
        for(var i=0; i<this.ripples.length; i++){
            var r = this.ripples[i];
            var dx = _x - r.x, dy = _y - r.y, d = Math.hypot(dx,dy);
            if(d < 1) continue;
            var k = (d - r.spd*r.age)/r.w;
            if(k > 3 || k < -3) continue;
            var f = r.amp*Math.exp(-k*k)*(1 - r.age/r.life);
            px += dx/d*f; py += dy/d*f; moved = true;
        }
        _p.x = px; _p.y = py;
        return moved;
    }
};
