//------------------------------------------------------------------------------
//  雑魚敵の見た目
//  ドローン君(標準)と同じ画風：平らな塗り・濃いふちどり・左上から光が当たるハイライトの線。
//  グラデーションや影のぼかしは使わない(数が多くても軽く描けるように)。
//  大きさ・当たり判定(_e.r)と、色の役割(虫の羽・突進の赤・回転砲台のオレンジなど)は元の絵と同じ。
//  協力プレイのゲストの画面でも同じに見えるよう、使う値はホストから届くもの
//  (t・vx・vy・face・timer・spin・firing・fuse・aimX/aimY・turret・flash)だけにする。
//  mainScreen.drawEnemy から、敵の位置へ translate した状態で呼ばれる。
//------------------------------------------------------------------------------
var ENEMY_COLOR = {
    ink:"#141516",      //ふちどり
    body:"#2c2e31",     //胴体
    mid:"#45484d",      //部品・装甲の内側
    light:"#6a6e74",    //ハイライトの線
    shine:"#9a9ea4",    //強いハイライト(角・ガラスの光)
    red:"#e5302b",      //目・ランプ
    redDark:"#6e1a18",  //消えているランプ
    glint:"#ffd9d6",    //目の光
    orange:"#ff8a1f",   //回転砲台の光る芯
    orangeDark:"#8c4316",
    wing:"rgba(205,212,220,0.55)",  //虫の羽(すける)
    wingLine:"rgba(55,60,66,0.65)",
    olive:"#4d5b48",    //人間の兵器
    oliveDark:"#333d30",
    oliveLight:"#73806b",
    glass:"#9fc3dc",    //ヘリの窓
    gold:"#e6b422",     //女王蜂の縞・冠
    goldDark:"#9a7410",
    rage:"#5a1d1d"      //怒った女王蜂の胴体
};

//女王蜂(ボス)：部位ごとに少しずつずれて動く(頭・胴・お尻・針・羽・脚・触角・冠)
const QUEEN_FLAP    = 0.75;     //羽ばたきの速さ(ラジアン/フレーム)
const QUEEN_BREATH  = 0.055;    //息づかい(体のゆれ)の速さ(ラジアン/フレーム)
const QUEEN_RAGE    = 1.45;     //怒ったときに動きが速くなる倍率
const QUEEN_AIM_LEN = 55;       //突進の構えの長さ(フレーム。bosses.js の aim と同じ)

//移動要塞(ボス)：装甲の板・コア・主砲・左右の砲台・噴射口を別々に動かす
const FORT_BREATH   = 0.045;    //装甲の板がふくらむ波の速さ(ラジアン/フレーム)
const FORT_RAGE     = 1.4;      //怒ったときに動きが速くなる倍率
const FORT_SPIRAL   = 90;       //渦巻き弾の長さ(フレーム。bosses.js と同じ)
const FORT_AIM_LEN  = 70;       //レーザーの予告の長さ(フレーム。bosses.js と同じ)
const FORT_SHOT_GAP = 20;       //3方向弾の間隔(フレーム。bosses.js と同じ)

//ドローン君改(ボス)：本体はスキンどおりのドローン君の絵を上下に切り分けてずらし、まわりの改造部品を別々に動かす
const KAI_SCALE     = 2;        //本体の絵の倍率(前と同じ)
const KAI_SPLIT     = -0.075;   //絵を切り分ける高さ(絵の大きさに対する割合。中心から上へ。プロペラ・棒と胴体の境目)
const KAI_SWAY      = 0.05;     //部品の揺れの速さ(ラジアン/フレーム)
const KAI_PH_TEMPO  = 0.25;     //出力が1段上がるごとに動きが速くなる割合
const KAI_LASER_AIM = 60;       //レーザーの予告の長さ(フレーム。bosses.js と同じ)
const KAI_CIRCLE_T  = 40;       //五龍の陣の長さ(フレーム。bosses.js と同じ)
const KAI_STRIKE_T  = 50;       //落雷の予告の長さ(フレーム。bosses.js と同じ)
const KAI_BEAT      = 66;       //胸の光の鼓動の間隔(フレーム。登場の鼓動 KAI_BEAT_EVERY と同じ)

var enemyArt = {
    //描いたらtrue(この種類の絵がなければfalse)
    //_body：被弾したときの白など、胴体を塗りつぶす色(なければnull)
    draw:function(_e,_body){
        var f = this[_e.type];
        if(!f) return false;
        f.call(this,_e,_body);
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        return true;
    },

    //------------------------------------------------------------ 共通の部品
    //ふちどり付きで塗る(今のパスを使う)
    fillInk:function(_color,_w){
        ctx.fillStyle = _color;
        ctx.fill();
        ctx.strokeStyle = ENEMY_COLOR.ink;
        ctx.lineWidth = _w || 1.4;
        ctx.stroke();
    },
    circle:function(_x,_y,_r){
        ctx.beginPath(); ctx.arc(_x,_y,_r,0,Math.PI*2);
    },
    roundRect:function(_x,_y,_w,_h,_r){
        ctx.beginPath();
        ctx.moveTo(_x + _r,_y);
        ctx.arcTo(_x + _w,_y,_x + _w,_y + _h,_r); ctx.arcTo(_x + _w,_y + _h,_x,_y + _h,_r);
        ctx.arcTo(_x,_y + _h,_x,_y,_r); ctx.arcTo(_x,_y,_x + _w,_y,_r);
        ctx.closePath();
    },
    //丸い部品の左上に光の弧
    shineArc:function(_x,_y,_r,_w){
        ctx.strokeStyle = ENEMY_COLOR.light;
        ctx.lineWidth = _w || 1.2;
        ctx.beginPath(); ctx.arc(_x,_y,_r,Math.PI*1.05,Math.PI*1.55); ctx.stroke();
    },
    //光る目(赤い丸と小さな光)
    eye:function(_x,_y,_r,_on){
        ctx.fillStyle = _on === false ? ENEMY_COLOR.redDark : ENEMY_COLOR.red;
        this.circle(_x,_y,_r); ctx.fill();
        ctx.fillStyle = ENEMY_COLOR.glint;
        this.circle(_x - _r*0.35,_y - _r*0.35,_r*0.38); ctx.fill();
    },
    //ランプのまわりのにじみ(ぼかしの代わりに薄い円を重ねる)
    halo:function(_x,_y,_r,_rgb,_a){
        ctx.fillStyle = "rgba(" + _rgb + "," + (_a*0.35) + ")";
        this.circle(_x,_y,_r); ctx.fill();
        ctx.fillStyle = "rgba(" + _rgb + "," + (_a*0.35) + ")";
        this.circle(_x,_y,_r*0.65); ctx.fill();
    },
    //回転翼：うっすらした円盤と、回る羽根
    //_disc：円盤の濃さ(大きな回転翼は薄く)
    rotor:function(_x,_y,_r,_a,_blades,_color,_disc){
        ctx.fillStyle = "rgba(40,44,48," + (_disc === undefined ? 0.12 : _disc) + ")";
        this.circle(_x,_y,_r); ctx.fill();
        ctx.strokeStyle = _color || "rgba(25,27,30,0.8)";
        ctx.lineWidth = Math.max(1.2,_r*0.12);
        ctx.lineCap = "round";
        ctx.beginPath();
        for(var i=0; i<_blades; i++){
            var a = _a + i*Math.PI*2/_blades;
            ctx.moveTo(_x,_y); ctx.lineTo(_x + Math.cos(a)*_r, _y + Math.sin(a)*_r);
        }
        ctx.stroke();
        ctx.lineCap = "butt";
    },

    //------------------------------------------------------------ 女王蜂(ボス)
    //各部位をつけ根を軸に回し、周期とタイミングを少しずつずらして生き物らしく見せる。
    //体の動きに対して、頭は先に、お尻・針・冠・触角は遅れてついてくる。
    //使う値は t・vx・mode・count・aimX・enraged(協力プレイのゲストにも届く)だけ。
    queen:function(_e,_body){
        var C = ENEMY_COLOR, self = this;
        var tempo = _e.enraged ? QUEEN_RAGE : 1;
        var t = _e.t*tempo;
        var b = t*QUEEN_BREATH;     //息づかいの位相(部位ごとにここからずらす)
        //突進の構え：だんだん縮こまって震える(0～1)
        var charge = _e.mode == "aim" ? 1 - Math.max(0,_e.count)/QUEEN_AIM_LEN : 0;
        var dash = _e.mode == "dash";
        //動く向きへ体を傾ける(突進中は大きく)
        var lean = Math.max(-0.32, Math.min(0.32, (_e.vx || 0)*0.04));
        //被弾：部位ごとにばらばらに揺れる
        var hit = _body ? 1 : 0;
        var jit = function(_i){ return hit*Math.sin(_e.t*2.7 + _i*1.9)*2.2 + charge*Math.sin(_e.t*1.9 + _i*2.3)*1.4; };
        var bodyCol = _body || (_e.enraged ? C.rage : C.body);
        var gold = _body || C.gold;

        ctx.save();
        //全体：息で縦に伸び縮み・構えで縮こまる・突進で前へ傾く
        var sy = 1 + Math.sin(b)*0.035 - charge*0.12 + (dash ? 0.05 : 0);
        var sx = 1 - Math.sin(b)*0.025 + charge*0.08 - (dash ? 0.04 : 0);
        ctx.translate(0, Math.sin(b + 0.6)*2.5 + charge*4);
        ctx.rotate(lean);
        ctx.scale(sx,sy);

        //---- 羽(後ろの羽 → 前の羽)。肩を軸に回す。前後の羽で羽ばたきをずらす
        var buzz = t*QUEEN_FLAP*(charge > 0 ? 1.5 : 1);
        for(var k=0; k<2; k++){
            var f = Math.sin(buzz - k*0.9);                 //-1～1
            var len = k ? 30 : 23;
            var spread = dash ? (k ? 1.9 : 2.2) + f*0.12      //突進中は後ろへたたむ
                              : (k ? 1.05 : 1.55) + f*(0.32 + charge*0.15);
            for(var s=-1; s<=1; s+=2){
                ctx.save();
                ctx.translate(s*9, -15 + k*2 + jit(k + s));
                ctx.rotate(s*spread);
                ctx.beginPath(); ctx.ellipse(0,-len,len*0.4,len,0,0,Math.PI*2);
                ctx.fillStyle = C.wing; ctx.fill();
                ctx.strokeStyle = C.wingLine; ctx.lineWidth = 1; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-len*1.75);
                ctx.moveTo(0,-len*0.9); ctx.lineTo(s*len*0.3,-len*1.45); ctx.stroke();   //羽の筋
                ctx.restore();
            }
        }

        //---- お尻(縞の大きな腹)：胸の下を軸に振り子のように揺れ、体の傾きに遅れてついてくる
        var abd = Math.sin(b - 0.9)*0.09 - lean*1.1 + (dash ? -lean*0.8 : 0);
        ctx.save();
        ctx.translate(jit(5), 2 + jit(6));
        ctx.rotate(abd);
        var swell = 1 + Math.sin(b - 0.4)*0.05;     //息で少しふくらむ
        //針：お尻よりさらに遅れて揺れる。構えると光って伸びる
        ctx.save();
        ctx.translate(0, 38*swell);
        ctx.rotate(Math.sin(b - 1.8)*0.28 - abd*0.8);
        var sting = 9 + charge*5;
        ctx.beginPath(); ctx.moveTo(-3.5,-2); ctx.lineTo(0,sting); ctx.lineTo(3.5,-2); ctx.closePath();
        self.fillInk(_body || C.mid, 1.2);
        if(charge > 0) self.halo(0,sting - 2,6 + charge*4,"255,60,50",charge);
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(0,19*swell,19,21*swell,0,0,Math.PI*2);
        self.fillInk(bodyCol, 1.6);
        //縞(お尻の形で切り抜く)
        ctx.save();
        ctx.clip();
        ctx.fillStyle = gold;
        for(var i=0; i<3; i++) ctx.fillRect(-24,(8 + i*10)*swell,48,5);
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(0,19*swell,19,21*swell,0,0,Math.PI*2);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.strokeStyle = C.light; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(0,19*swell,15,17*swell,0,Math.PI*1.1,Math.PI*1.45); ctx.stroke();
        ctx.restore();

        //---- 脚(3対)。胸の下からぶら下がり、1本ずつ遅れて揺れる。構えると縮める
        ctx.lineCap = "round";
        for(var i=0; i<3; i++){
            for(var s=-1; s<=1; s+=2){
                var sw = Math.sin(b*1.6 - i*0.8 + (s > 0 ? 0.5 : 0))*0.22;
                var a1 = s*(0.35 + i*0.38) + sw - charge*s*0.35 - lean*0.8;     //下向きからの角度
                var a2 = a1 + s*(0.6 + Math.sin(b*1.6 - i*0.8 - 0.7)*0.2 + charge*0.6);
                var x0 = s*(5 + i*2), y0 = -6 + i*4;
                var x1 = x0 + Math.sin(a1)*10, y1 = y0 + Math.cos(a1)*10;
                var x2 = x1 + Math.sin(a2)*9,  y2 = y1 + Math.cos(a2)*9;
                ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
                ctx.strokeStyle = _body || C.mid; ctx.lineWidth = 1.2;
                ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
            }
        }
        ctx.lineCap = "butt";

        //---- 胸：首まわりの金のえり
        ctx.save();
        ctx.translate(jit(7), jit(8));
        ctx.beginPath(); ctx.ellipse(0,-8,16,13,0,0,Math.PI*2);
        self.fillInk(bodyCol, 1.6);
        ctx.beginPath(); ctx.ellipse(0,-17,12,4.5,0,0,Math.PI*2);
        self.fillInk(gold, 1.2);
        self.shineArc(0,-8,11);
        ctx.restore();

        //---- 頭：体より先に動く(傾きを先取り)。息より早いタイミングで上下する
        var headA = Math.sin(b + 0.9)*0.09 + lean*0.6 + charge*Math.sin(_e.t*0.9)*0.05;
        ctx.save();
        ctx.translate(jit(9), -21 + Math.sin(b + 0.5)*1.6 + charge*3 + jit(10));
        ctx.rotate(headA);
        //触角：頭の動きに遅れてしなる
        var ant = Math.sin(b - 0.6)*0.25 - headA*1.5;
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
        for(var s=-1; s<=1; s+=2){
            var tipA = s*0.55 + ant + Math.sin(b*1.3 - 1.2 + s)*0.15;
            var ex = s*6 + Math.sin(tipA)*20, ey = -10 - Math.cos(tipA)*20;
            ctx.beginPath(); ctx.moveTo(s*4,-9);
            ctx.quadraticCurveTo(s*7 + Math.sin(tipA*0.5)*6,-22,ex,ey); ctx.stroke();
            ctx.fillStyle = C.ink; self.circle(ex,ey,2); ctx.fill();
        }
        self.circle(0,-6,13);
        self.fillInk(bodyCol, 1.6);
        self.shineArc(0,-6,10);
        //目：ときどきまばたき(上からまぶたが下りる)。構えると赤く光る
        var cyc = (_e.t + 37) % 190;
        var lid = cyc < 8 ? 1 - Math.abs(cyc - 4)/4 : 0;
        if(charge > 0) self.halo(0,-5,14 + charge*6,"255,60,50",charge);
        for(var s=-1; s<=1; s+=2){
            ctx.save();
            ctx.translate(s*5.5,-5);
            ctx.scale(1, 1 - lid*0.85);
            ctx.beginPath(); ctx.ellipse(0,0,4,5,s*0.3,0,Math.PI*2);
            ctx.fillStyle = C.red; ctx.fill();
            ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillStyle = C.glint;
            self.circle(-1.3,-1.8,1.4); ctx.fill();
            ctx.restore();
        }
        //冠：頭の上で、頭よりさらに遅れて揺れる
        ctx.save();
        ctx.translate(0,-17 + Math.max(0,Math.sin(b - 1.2))*-1.5);
        ctx.rotate(-headA*0.6 + Math.sin(b - 1.4)*0.07);
        ctx.beginPath();
        ctx.moveTo(-10,2); ctx.lineTo(-11,-9); ctx.lineTo(-5,-3); ctx.lineTo(0,-12);
        ctx.lineTo(5,-3); ctx.lineTo(11,-9); ctx.lineTo(10,2); ctx.closePath();
        self.fillInk(gold, 1.3);
        ctx.strokeStyle = _body ? C.light : "#fff0a8"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(-9,-5); ctx.stroke();
        self.eye(0,-2,2);
        ctx.restore();
        ctx.restore();

        ctx.restore();
    },

    //------------------------------------------------------------ 移動要塞(ボス)
    //機械だが、装甲の板が順にふくらむ・コアが目のように相手を見る・左右の砲台が遅れてついてくることで生き物らしく見せる。
    //使う値は t・vx・mode・count・angle・enraged(協力プレイのゲストにも届く)だけ。
    fortress:function(_e,_body){
        var C = ENEMY_COLOR, self = this, r = _e.r;
        var tempo = _e.enraged ? FORT_RAGE : 1;
        var b = _e.t*tempo*FORT_BREATH;
        var ang = _e.angle || 0;
        var mode = _e.mode, cnt = Math.max(0, _e.count || 0);
        //渦巻き弾：板が開き、輪が半周まわる(板は8回対称なので、終わったときに形がつながる)
        var spiralK = mode == "spiral" ? 1 - cnt/FORT_SPIRAL : 0;
        var open = mode == "spiral" ? Math.min(1, Math.min(spiralK, 1 - spiralK)*6) : 0;
        var turn = spiralK*spiralK*(3 - 2*spiralK)*Math.PI;
        //レーザー：予告でためて(0～1)、撃っている間は震える
        var aimK = mode == "laserAim" ? 1 - cnt/FORT_AIM_LEN : 0;
        var firing = mode == "laser";
        //3方向弾の反動(撃った瞬間が1)。_late フレーム遅れて撃つ砲台用
        var recoil = function(_late){
            if(mode != "triple") return 0;
            var since = ((FORT_SHOT_GAP - (cnt + _late) % FORT_SHOT_GAP) % FORT_SHOT_GAP);
            return Math.max(0, 1 - since/7);
        };
        var lean = Math.max(-0.18, Math.min(0.18, (_e.vx || 0)*0.06));
        var hit = _body ? 1 : 0;
        var shake = aimK*0.8 + (firing ? 1.2 : 0);
        var jit = function(_i){ return hit*Math.sin(_e.t*2.7 + _i*1.9)*2.5 + shake*Math.sin(_e.t*2.1 + _i*2.3)*1.2; };
        var hull = _body || (_e.enraged ? "#5a2a2a" : C.body);
        var glowRgb = _e.enraged ? "255,70,40" : "255,140,40";

        ctx.save();
        ctx.translate(0, Math.sin(b*1.3)*2);
        ctx.rotate(lean);

        //---- 噴射口(下に3つ)：炎の長さがばらばらにゆらぐ。傾いた側へ少し向く
        for(var i=-1; i<=1; i++){
            ctx.save();
            ctx.translate(i*20 + jit(i + 2), r + 3 - Math.abs(i)*7);
            ctx.rotate(-lean*1.5 + i*0.15);
            var fl = 7 + Math.sin(_e.t*0.7 + i*2.1)*3 + Math.sin(_e.t*1.9 + i)*1.5 + (firing ? 4 : 0);
            ctx.fillStyle = "#ffb02e";
            ctx.beginPath(); ctx.moveTo(-4,4); ctx.lineTo(0,6 + fl); ctx.lineTo(4,4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#fff3c4";
            ctx.beginPath(); ctx.moveTo(-2,4); ctx.lineTo(0,5 + fl*0.55); ctx.lineTo(2,4); ctx.closePath(); ctx.fill();
            self.roundRect(-6,-4,12,9,2);
            self.fillInk(_body || C.mid, 1.2);
            ctx.restore();
        }

        //---- 左右の砲台：腕で吊るし、主砲の向きに遅れてついてくる。主砲から少し遅れて撃つ
        for(var s=-1; s<=1; s+=2){
            var sx = s*(r + 8) + jit(s + 5), sy = -4 + Math.sin(b*1.5 + s*1.2)*3 + jit(s + 6);
            ctx.strokeStyle = C.ink; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(s*r*0.6,-2); ctx.lineTo(sx,sy); ctx.stroke();
            ctx.strokeStyle = _body || C.mid; ctx.lineWidth = 2.4; ctx.stroke();
            var rc = recoil(s < 0 ? 4 : 8);
            var pa = ang + Math.sin(b*1.1 - 1.3 + s)*0.3;
            ctx.save();
            ctx.translate(sx,sy);
            ctx.rotate(pa);
            ctx.fillStyle = C.ink;
            ctx.fillRect(4 - rc*4,-2.5,15,5);
            ctx.fillStyle = _body || C.light;
            ctx.fillRect(5 - rc*4,-1,13,2);
            if(rc > 0.5) self.halo(20,0,6,glowRgb,rc);
            self.circle(0,0,8);
            self.fillInk(hull, 1.4);
            self.shineArc(0,0,5.5);
            ctx.restore();
        }

        //---- 装甲の内側：板が開くと、すき間から熱い光が見える
        if(open > 0 || _e.enraged){
            self.halo(0,0,r + 4,glowRgb,Math.max(open, _e.enraged ? 0.35 + Math.sin(b*3)*0.15 : 0));
        }
        self.circle(0,0,r*0.82);
        ctx.fillStyle = C.ink; ctx.fill();

        //---- 装甲の板(8枚)：まわりを波がめぐるように1枚ずつ外へふくらむ
        ctx.save();
        ctx.rotate(_e.t*0.01 + turn);
        for(var i=0; i<8; i++){
            var a = i*Math.PI/4;
            var out = (Math.sin(b*2 - i*Math.PI/4) + 1)*1.2 + open*7 + hit*Math.sin(_e.t*2.3 + i*1.7)*2;
            var half = Math.PI/8 - 0.04;
            var r0 = r*0.55 + out*0.4, r1 = r + out;
            ctx.save();
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(Math.cos(-half)*r0, Math.sin(-half)*r0);
            ctx.lineTo(Math.cos(-half)*r1, Math.sin(-half)*r1);
            ctx.lineTo(Math.cos(half)*r1, Math.sin(half)*r1);
            ctx.lineTo(Math.cos(half)*r0, Math.sin(half)*r0);
            ctx.closePath();
            self.fillInk(hull, 1.6);
            //外側のふちのハイライト(左上から光が当たる板だけ明るく)
            var lit = Math.cos(a + _e.t*0.01 + turn + Math.PI*0.75);
            ctx.strokeStyle = lit > 0.2 ? C.shine : C.light; ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(-half + 0.05)*(r1 - 2.5), Math.sin(-half + 0.05)*(r1 - 2.5));
            ctx.lineTo(Math.cos(half - 0.05)*(r1 - 2.5), Math.sin(half - 0.05)*(r1 - 2.5));
            ctx.stroke();
            //板のびょう
            ctx.fillStyle = _body || C.mid;
            ctx.fillRect(r*0.78 + out - 2.5,-2.5,5,5);
            ctx.restore();
        }
        ctx.restore();

        //---- 主砲：撃つと反動で引っこみ、レーザーでは前へ伸びる
        var rc0 = recoil(0);
        var ext = firing ? 8 : aimK*5;
        ctx.save();
        ctx.translate(jit(9), jit(10));
        ctx.rotate(ang);
        self.roundRect(-4 - rc0*7, -8, r + 22 + ext, 16, 3);
        self.fillInk(_body || "#232527", 1.6);
        ctx.strokeStyle = C.light; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(6 - rc0*7,-4.5); ctx.lineTo(r + 13 + ext - rc0*7,-4.5); ctx.stroke();
        //砲口のリング
        self.roundRect(r + 12 + ext - rc0*7, -10, 8, 20, 2);
        self.fillInk(_body || C.mid, 1.4);
        if(rc0 > 0.4) self.halo(r + 25 + ext - rc0*7, 0, 11, glowRgb, rc0);
        if(aimK > 0 || firing) self.halo(r + 21 + ext, 0, 6 + aimK*8 + (firing ? 6 : 0), "255,60,60", firing ? 1 : aimK);
        ctx.restore();

        //---- コア：目のように相手を見る。ときどきシャッターが閉じる。レーザーの予告で大きく開いて光る
        ctx.save();
        ctx.translate(jit(11), jit(12));
        self.circle(0,0,r*0.5);
        self.fillInk(hull, 1.8);
        self.shineArc(0,0,r*0.5 - 3,1.4);
        var eyeR = 11 + aimK*3 + (firing ? 3 : 0);
        self.circle(0,0,eyeR + 2);
        ctx.fillStyle = C.ink; ctx.fill();
        var cyc = (_e.t + 71) % 230;
        var lid = (mode == "idle" && cyc < 10) ? 1 - Math.abs(cyc - 5)/5 : 0;
        ctx.save();
        ctx.rotate(ang);
        ctx.scale(1, 1 - lid*0.9);
        if(aimK > 0 || firing) self.halo(0,0,eyeR + 10,"255,60,60",firing ? 1 : aimK);
        self.circle(0,0,eyeR);
        ctx.fillStyle = _body || C.red; ctx.fill();
        //瞳：狙う向きへ寄る
        var look = 3 + Math.sin(b*2.2)*1;
        self.circle(look,0,eyeR*0.42);
        ctx.fillStyle = _body ? C.light : C.redDark; ctx.fill();
        ctx.restore();
        //目の光はいつも左上(向きと一緒に回さない)
        if(lid < 0.5){
            ctx.fillStyle = C.glint;
            self.circle(Math.cos(ang)*look - eyeR*0.32, Math.sin(ang)*look - eyeR*0.38, eyeR*0.22); ctx.fill();
        }
        ctx.restore();

        ctx.restore();
    },

    //------------------------------------------------------------ ドローン君改(ボス)
    //本体は選んだスキンのドローン君の絵のまま、上(プロペラ・棒)と下(胴体)に切り分けて、上を遅れてしならせる。
    //まわりに改造部品(左右の副砲・背中の装甲の輪・胴体の下のケーブル・胸の鼓動の光)を足し、別々に動かす。
    //使う値は t・vx・mode・count・angle・phase・circleT・strikes(協力プレイのゲストにも届く)と、狙う相手(nearestPlayer)だけ。
    kai:function(_e,_body){
        var look = _e.look;
        if(!look) return;
        var C = ENEMY_COLOR, self = this;
        var k = KAI_SCALE, S = DRONE_SIZE*k;
        var ph = _e.phase || 1;
        var t = _e.t*(1 + (ph - 1)*KAI_PH_TEMPO);
        var b = t*KAI_SWAY;
        var cnt = Math.max(0, _e.count || 0);
        var aimK = _e.mode == "laserAim" ? 1 - cnt/KAI_LASER_AIM : 0;
        var firing = _e.mode == "laser";
        var laserK = firing ? 1 : aimK;
        var dragon = Math.max(0, _e.circleT || 0)/KAI_CIRCLE_T;
        var zap = 0;
        var st = _e.strikes || [];
        for(var i=0; i<st.length; i++) zap = Math.max(zap, 1 - st[i].t/KAI_STRIKE_T);
        var vx = _e.vx || 0;
        //狙う向き：レーザーのときはレーザーの向き、ふだんは近いほうのドローン君(どちらの画面でも同じ相手)
        var tgt = typeof nearestPlayer == "function" ? nearestPlayer(_e.x,_e.y) : drone;
        var ta = (aimK > 0 || firing) ? (_e.angle || 0) : Math.atan2(tgt.Y - _e.y, tgt.X - _e.x);
        var hit = _body ? 1 : 0;
        var shake = aimK*0.6 + (firing ? 1.3 : 0) + zap*0.5;
        var jit = function(_i){ return hit*Math.sin(_e.t*2.7 + _i*1.9)*2.5 + shake*Math.sin(_e.t*2.1 + _i*2.3)*1.3; };
        var hull = _body || "#2a1517";
        var redRgb = "255,50,50";

        //---- 背中の装甲の輪：出力が上がるほど板が増え、速く回る。板は波のように1枚ずつ外へふくらむ
        var nSeg = 2 + ph*2;
        ctx.save();
        ctx.translate(jit(1), 8 + jit(2));
        ctx.rotate(_e.t*(0.008 + ph*0.006) + laserK*_e.t*0.05);
        ctx.lineCap = "round";
        for(var i=0; i<nSeg; i++){
            var a0 = i*Math.PI*2/nSeg, w = Math.PI*2/nSeg*0.62;
            var R = 46 + Math.sin(b*2 - i*Math.PI*2/nSeg)*2.5 + dragon*8 + laserK*3;
            ctx.strokeStyle = C.ink; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.arc(0,0,R,a0,a0 + w); ctx.stroke();
            ctx.strokeStyle = _body || "#7a1018"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(0,0,R,a0,a0 + w); ctx.stroke();
            ctx.strokeStyle = _body ? C.light : "#c0303a"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(0,0,R - 1.2,a0 + 0.05,a0 + w*0.6); ctx.stroke();
        }
        ctx.restore();

        //---- 胴体の下のケーブル：本体の動きに遅れてしなる。五龍の陣で外へ広がり、落雷の予告で先が光る
        var nCab = 1 + ph;
        ctx.lineCap = "round";
        for(var i=0; i<nCab; i++){
            var u = nCab == 1 ? 0 : i/(nCab - 1)*2 - 1;    //-1(左)～1(右)
            var x = u*20 + jit(i + 3), y = 34;
            var a = u*(0.35 + dragon*0.9);
            var pts = [[x,y]];
            for(var j=0; j<3; j++){
                a += Math.sin(b*1.4 - i*0.9 - j*0.7)*0.22 - vx*0.035 + u*dragon*0.25;
                x += Math.sin(a)*9; y += Math.cos(a)*9;
                pts.push([x,y]);
            }
            ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
            for(var j=1; j<pts.length; j++) ctx.lineTo(pts[j][0],pts[j][1]);
            ctx.strokeStyle = C.ink; ctx.lineWidth = 3.6; ctx.stroke();
            ctx.strokeStyle = _body || "#5a1a1e"; ctx.lineWidth = 1.6; ctx.stroke();
            var tip = pts[pts.length - 1];
            if(zap > 0 || dragon > 0) self.halo(tip[0],tip[1],5 + zap*5,redRgb,Math.max(zap,dragon));
            self.circle(tip[0],tip[1],2.6);
            self.fillInk(_body || C.red, 1);
        }
        ctx.lineCap = "butt";

        //---- 本体：下(胴体)と上(プロペラ・棒)に切り分ける。上は胴体より遅れて弾み、傾きにも遅れてしなる
        var split = S*KAI_SPLIT;
        if(_body) ctx.globalAlpha = 0.6;
        ctx.save();
        ctx.beginPath(); ctx.rect(-S,split,S*2,S); ctx.clip();
        ctx.translate(jit(5), Math.sin(b)*0.6 + jit(6));
        look.draw(0,0,k);
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.rect(-S,-S,S*2,S + split + 4); ctx.clip();
        ctx.translate(jit(7), Math.sin(b - 0.9)*1.8 - laserK*1.5 + jit(8));
        ctx.translate(0,split);
        ctx.rotate(-(look.tiltV || 0)*3 + Math.sin(b*1.3 - 0.5)*0.035);
        ctx.translate(0,-split);
        look.draw(0,0,k);
        ctx.restore();
        ctx.globalAlpha = 1;

        //---- 胸の鼓動の光：ドクン、ドクンと2回ずつ。出力が上がるほど強い
        var bt = _e.t % Math.round(KAI_BEAT/(1 + (ph - 1)*KAI_PH_TEMPO));
        var pulse = Math.max(0, 1 - bt/10) + Math.max(0, 1 - Math.abs(bt - 14)/8)*0.6;
        self.halo(0,14,10 + pulse*8 + laserK*6,redRgb,Math.min(1,0.25 + ph*0.12 + pulse*0.5 + laserK*0.5));

        //---- 左右の副砲：エネルギーの線でつながって浮かび、相手を狙う。少し遅れてついてくる。
        //レーザーの予告では本体の前へ出て一緒に光をため、撃っている間は震える
        var px = [], py = [];
        for(var s=-1; s<=1; s+=2){
            var bx = s*54 - vx*2.5 + Math.sin(b*1.1 + s)*3 + dragon*s*14;
            var by = 4 + Math.sin(b*1.5 + (s > 0 ? 1.3 : 0))*5 - dragon*6;
            //レーザーのとき：狙う向きの前、左右に並ぶ
            var fx0 = Math.cos(ta)*34 - Math.sin(ta)*s*24, fy0 = Math.sin(ta)*34 + Math.cos(ta)*s*24;
            var x = bx + (fx0 - bx)*laserK + jit(s + 9), y = by + (fy0 - by)*laserK + jit(s + 10);
            px.push(x); py.push(y);
            //つなぐ線(点線が流れる)
            ctx.strokeStyle = "rgba(" + redRgb + "," + (0.25 + laserK*0.4) + ")";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3,4]);
            ctx.lineDashOffset = -_e.t*0.6;
            ctx.beginPath(); ctx.moveTo(s*18,12); ctx.quadraticCurveTo((s*18 + x)/2, (12 + y)/2 + 10, x, y); ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
            //小さな噴射
            var fl = 4 + Math.sin(_e.t*0.8 + s*2)*2;
            ctx.fillStyle = "#ff6a4a";
            ctx.beginPath(); ctx.moveTo(x - 3,y + 6); ctx.lineTo(x,y + 8 + fl); ctx.lineTo(x + 3,y + 6); ctx.closePath(); ctx.fill();
            //砲身：狙う向きへ、本体より少し遅れて向く
            var pa = ta + Math.sin(b*1.2 - 1.4 + s)*0.18*(1 - laserK);
            ctx.save();
            ctx.translate(x,y);
            ctx.rotate(pa);
            var rc = firing ? Math.max(0, Math.sin(_e.t*0.9 + s))*2.5 : 0;
            self.roundRect(2 - rc,-3,17,6,1.5);
            self.fillInk(_body || "#3a1d20", 1.2);
            if(laserK > 0) self.halo(20,0,4 + laserK*6,redRgb,laserK);
            ctx.restore();
            //胴体
            self.roundRect(x - 9,y - 7,18,14,4);
            self.fillInk(hull, 1.5);
            ctx.strokeStyle = _body ? C.light : "#6e3036"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x - 6,y - 4.5); ctx.lineTo(x + 3,y - 4.5); ctx.stroke();
            self.eye(x,y + 1,2.6);
        }
        //落雷の予告：副砲から本体へ小さな稲妻が走る
        if(zap > 0){
            ctx.strokeStyle = "rgba(255,90,90," + (0.4 + zap*0.6) + ")";
            ctx.lineWidth = 1.5;
            for(var i=0; i<2; i++){
                if(Math.floor(_e.t/2 + i) % 3 == 0) continue;   //ちらつく
                ctx.beginPath(); ctx.moveTo(px[i],py[i]);
                for(var j=1; j<=4; j++){
                    var q = j/5;
                    ctx.lineTo(px[i]*(1 - q) + Math.sin(_e.t*1.7 + j*2.1 + i)*4, py[i]*(1 - q) + 10*q + Math.cos(_e.t*2.3 + j)*4);
                }
                ctx.lineTo(0,12);
                ctx.stroke();
            }
        }
    },

    //------------------------------------------------------------ 虫：羽ばたく機械の虫
    bug:function(_e,_body){
        var C = ENEMY_COLOR, r = _e.r;
        var flap = Math.abs(Math.sin(_e.t*0.5));    //0：閉じる ～ 1：開く
        //羽(後ろの羽 → 前の羽)。開くほど大きく、外へ倒れる
        for(var k=0; k<2; k++){
            //k=0：後ろの羽(横に大きく開く) k=1：前の羽
            var len = (k ? 7 : 5.5) + flap*(k ? 5 : 4), spread = (k ? 0.45 : 1.0) + flap*0.45;
            for(var s=-1; s<=1; s+=2){
                ctx.save();
                ctx.translate(s*4, -3 + k*2);
                ctx.rotate(s*spread);   //上向きの羽を、左右それぞれ外へ倒す
                ctx.beginPath(); ctx.ellipse(0,-len,len*0.42,len,0,0,Math.PI*2);
                ctx.fillStyle = C.wing; ctx.fill();
                ctx.strokeStyle = C.wingLine; ctx.lineWidth = 0.8; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-len*1.7); ctx.stroke();   //羽の筋
                ctx.restore();
            }
        }
        //触角(少しゆれる)
        var sw = Math.sin(_e.t*0.15)*1.5;
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-2,-r*0.75); ctx.quadraticCurveTo(-5,-r - 2,-7 + sw,-r - 3);
        ctx.moveTo(2,-r*0.75); ctx.quadraticCurveTo(5,-r - 2,7 + sw,-r - 3);
        ctx.stroke();
        ctx.fillStyle = C.ink;
        this.circle(-7 + sw,-r - 3,1.3); ctx.fill();
        this.circle(7 + sw,-r - 3,1.3); ctx.fill();
        //胴(お尻)と頭
        ctx.beginPath(); ctx.ellipse(0,3,r*0.72,r*0.8,0,0,Math.PI*2);
        this.fillInk(_body || C.body);
        ctx.strokeStyle = C.mid; ctx.lineWidth = 1.2;     //胴の節
        ctx.beginPath(); ctx.ellipse(0,5,r*0.6,2.2,0,0,Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0,9,r*0.42,1.6,0,0,Math.PI); ctx.stroke();
        this.circle(0,-4,r*0.62);
        this.fillInk(_body || C.mid);
        this.shineArc(0,-4,r*0.62 - 1.5);
        this.eye(-3,-5,2.2);
        this.eye(3,-5,2.2);
    },

    //------------------------------------------------------------ 突進：狙いを定めて突っ込む矢じり
    dasher:function(_e,_body){
        var C = ENEMY_COLOR, r = _e.r;
        var tell = _e.tell || 0;
        var aiming = tell != TELL.dash;
        var lock = tell == TELL.lock;
        //飛び出す合図：構えの最後に炎が伸びる(フェイントでは伸びない)
        var flame = lock && !_e.fake && _e.timer <= TELL_FLAME ? 1 - _e.timer/TELL_FLAME : 0;
        //突進の予告線：狙っている間は薄い点線、構えると濃い線(向きが固まった)
        if(aiming && tell != TELL.brake){
            ctx.strokeStyle = lock ? "rgba(235,40,40," + (0.4 + 0.4*flame) + ")" : "rgba(220,40,40,0.18)";
            ctx.lineWidth = lock ? 1.5 + flame*1.5 : 1;
            ctx.setLineDash(lock ? [] : [6,6]);
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(_e.aimX*1200,_e.aimY*1200); ctx.stroke();
            ctx.setLineDash([]);
        }
        var a = Math.atan2(aiming ? _e.aimY : _e.vy, aiming ? _e.aimX : _e.vx);
        ctx.rotate(a);
        //構えているときは身を縮めて小刻みに震える(フェイントで身を引くときは震えない)
        if(lock) ctx.translate(-2 - flame*2 + (Math.floor(_e.t/2) % 2 ? 0.8 : -0.8), 0);
        //噴射：突進中は長い炎、予告中は力をためて小さく明滅、飛び出す直前は長く伸びる
        var moving = !aiming && (_e.vx || _e.vy);
        if(moving || aiming){
            var fl = moving ? 9 + Math.random()*6 : flame > 0 ? 6 + flame*14 : (Math.floor(_e.t/3) % 2 ? 4 : 2);
            ctx.fillStyle = "#ffb02e";
            ctx.beginPath(); ctx.moveTo(-r + 1,-3); ctx.lineTo(-r - fl,0); ctx.lineTo(-r + 1,3); ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#fff3c4";
            ctx.beginPath(); ctx.moveTo(-r + 1,-1.4); ctx.lineTo(-r - fl*0.55,0); ctx.lineTo(-r + 1,1.4); ctx.closePath(); ctx.fill();
        }
        //機体(とがった先・左右の翼)
        ctx.beginPath();
        ctx.moveTo(r + 5,0); ctx.lineTo(r*0.2,-r*0.45); ctx.lineTo(-r*0.85,-r); ctx.lineTo(-r*0.6,-r*0.35);
        ctx.lineTo(-r,-r*0.3); ctx.lineTo(-r,r*0.3); ctx.lineTo(-r*0.6,r*0.35); ctx.lineTo(-r*0.85,r);
        ctx.lineTo(r*0.2,r*0.45); ctx.closePath();
        this.fillInk(_body || C.body);
        //背の筋のハイライトと、赤いすじ(予告中は点滅)
        var blink = aiming && Math.floor(_e.t/5) % 2 == 0;
        ctx.strokeStyle = C.light; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(r + 2,-0.6); ctx.lineTo(-r*0.4,-0.6); ctx.stroke();
        ctx.strokeStyle = blink ? "#ff5a4f" : C.red; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-r*0.75,-r*0.72); ctx.lineTo(-r*0.15,-r*0.32); ctx.moveTo(-r*0.75,r*0.72); ctx.lineTo(-r*0.15,r*0.32); ctx.stroke();
        //目
        if(blink) this.halo(r*0.35,0,5,"255,60,50",1);
        if(flame > 0) this.halo(r*0.35,0,6 + flame*6,"255,240,200",1);
        this.eye(r*0.35,0,2.1);
    },

    //------------------------------------------------------------ 砲台：狙った相手に砲身を向ける
    shooter:function(_e,_body){
        var C = ENEMY_COLOR, r = _e.r;
        var ready = _e.vx == 0 && _e.vy == 0 && _e.timer < 20;     //撃つ直前
        ctx.rotate(_e.face || 0);
        //砲身(根元・筒・先の太い輪)
        ctx.beginPath(); ctx.rect(4,-3.2,r + 5,6.4); this.fillInk(C.mid,1.2);
        ctx.beginPath(); ctx.rect(r + 6,-4.4,5,8.8); this.fillInk(C.body,1.2);
        ctx.strokeStyle = C.light; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(5,-1.8); ctx.lineTo(r + 5,-1.8); ctx.stroke();
        //胴体：角の丸い箱と、内側の板
        this.roundRect(-r,-r,r*2,r*2,5);
        this.fillInk(_body || C.body,1.5);
        this.roundRect(-r + 4,-r + 4,r*2 - 8,r*2 - 8,3);
        ctx.fillStyle = _body ? "#e8e8e8" : C.mid; ctx.fill();
        //上と左のふちの光・四隅のねじ・後ろの通気口
        ctx.strokeStyle = C.light; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-r + 5,-r + 1.5); ctx.lineTo(r - 5,-r + 1.5); ctx.moveTo(-r + 1.5,-r + 5); ctx.lineTo(-r + 1.5,r - 5); ctx.stroke();
        ctx.fillStyle = C.ink;
        for(var i=0; i<4; i++) { this.circle((i % 2 ? 1 : -1)*(r - 3.2),(i < 2 ? -1 : 1)*(r - 3.2),1.1); ctx.fill(); }
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
        ctx.beginPath();
        for(var i=-1; i<=1; i++){ ctx.moveTo(-r + 6,i*3.5); ctx.lineTo(-r + 10,i*3.5); }
        ctx.stroke();
        //芯：撃つ直前は明るく光る
        if(ready) this.halo(0,0,10,"255,60,50",1);
        this.circle(0,0,5.2); this.fillInk(ready ? "#ff3b30" : C.redDark,1.2);
        if(ready){ ctx.fillStyle = C.glint; this.circle(-1.6,-1.6,1.6); ctx.fill(); }
    },

    //------------------------------------------------------------ 装甲：ゆっくり回る六角形の厚い装甲
    tank:function(_e,_body){
        var C = ENEMY_COLOR, r = _e.r, rot = _e.t*0.01;
        var pts = [], inner = [];
        for(var i=0; i<6; i++){
            var a = Math.PI/3*i + rot;
            pts.push([Math.cos(a)*r, Math.sin(a)*r]);
            inner.push([Math.cos(a)*r*0.68, Math.sin(a)*r*0.68]);
        }
        var poly = function(_p){ ctx.beginPath(); for(var i=0; i<_p.length; i++) ctx.lineTo(_p[i][0],_p[i][1]); ctx.closePath(); };
        poly(pts); this.fillInk(_body || C.body,1.8);
        //左上を向いた辺だけ光らせる(光は回っても左上から)
        ctx.strokeStyle = C.light; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for(var i=0; i<6; i++){
            var p = pts[i], q = pts[(i + 1) % 6];
            var mx = (p[0] + q[0])/2, my = (p[1] + q[1])/2, d = Math.hypot(mx,my);
            if((-0.6*mx - 0.8*my)/d > 0.35){ ctx.moveTo(p[0]*0.9,p[1]*0.9); ctx.lineTo(q[0]*0.9,q[1]*0.9); }
        }
        ctx.stroke();
        //内側の板と、装甲をつなぐ筋・角のびょう
        poly(inner);
        ctx.fillStyle = _body ? "#e8e8e8" : C.mid; ctx.fill();
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath();
        for(var i=0; i<6; i++){ ctx.moveTo(inner[i][0],inner[i][1]); ctx.lineTo(pts[i][0]*0.92,pts[i][1]*0.92); }
        ctx.stroke();
        ctx.fillStyle = C.shine;
        for(var i=0; i<6; i++){ var m = (i + 0.5); var a = Math.PI/3*m + rot; this.circle(Math.cos(a)*r*0.8,Math.sin(a)*r*0.8,1.1); ctx.fill(); }
        //目(回らない)：黒いのぞき窓に赤い目
        this.roundRect(-9,-6.5,18,9,3);
        ctx.fillStyle = C.ink; ctx.fill();
        this.eye(-4,-2,2.4);
        this.eye(4,-2,2.4);
    },

    //------------------------------------------------------------ 回転砲台：回る砲身から弾をばらまく
    spinner:function(_e,_body){
        var C = ENEMY_COLOR, r = _e.r;
        var firing = _e.firing > 0;
        var arms = game.wave >= 7 ? 3 : 2;
        //砲身(本体の下に描く)
        ctx.save();
        ctx.rotate(_e.spin || 0);
        for(var i=0; i<arms; i++){
            ctx.rotate(Math.PI*2/arms);
            ctx.beginPath(); ctx.rect(0,-3,r + 6,6); this.fillInk(C.mid,1.2);
            ctx.beginPath(); ctx.rect(r + 4,-4,4,8); this.fillInk(C.body,1.2);
            ctx.strokeStyle = C.light; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(r*0.5,-1.6); ctx.lineTo(r + 3,-1.6); ctx.stroke();
        }
        ctx.restore();
        //本体：丸い台と、回る目盛りの輪
        this.circle(0,0,r);
        this.fillInk(_body || C.body,1.5);
        this.shineArc(0,0,r - 2,1.4);
        ctx.save();
        ctx.rotate(-(_e.spin || 0)*0.5);
        ctx.strokeStyle = C.mid; ctx.lineWidth = 2.2;
        ctx.setLineDash([3,3.3]);
        this.circle(0,0,r*0.68); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        //芯：撃っている間はオレンジに光る
        if(firing) this.halo(0,0,11,"255,138,31",1);
        this.circle(0,0,5.5); this.fillInk(firing ? C.orange : C.orangeDark,1.2);
        ctx.fillStyle = firing ? "#fff0d8" : "#c27a45";
        this.circle(-1.7,-1.7,1.5); ctx.fill();
    },

    //------------------------------------------------------------ 自爆機：とげのある機雷。自爆直前は赤く点滅してふくらむ
    bomber:function(_e,_body){
        var C = ENEMY_COLOR, r = _e.r;
        var blink = _e.fuse > 0 && Math.floor(_e.fuse/4) % 2 == 0;
        var sc = _e.fuse > 0 ? 1 + (45 - _e.fuse)/90 : 1;
        //自爆直前は、まわりに危険の輪
        if(_e.fuse > 0){
            ctx.strokeStyle = "rgba(230,40,40," + (blink ? 0.6 : 0.25) + ")";
            ctx.lineWidth = 2;
            this.circle(0,0,r*sc + 6); ctx.stroke();
        }
        ctx.scale(sc,sc);
        //とげ(8本。少しずつ回る)
        var rot = _e.t*0.02;
        for(var i=0; i<8; i++){
            var a = i*Math.PI/4 + rot, ca = Math.cos(a), sa = Math.sin(a);
            ctx.beginPath();
            ctx.moveTo(ca*r*0.6 - sa*2.6, sa*r*0.6 + ca*2.6);
            ctx.lineTo(ca*r*1.2, sa*r*1.2);
            ctx.lineTo(ca*r*0.6 + sa*2.6, sa*r*0.6 - ca*2.6);
            ctx.closePath();
            this.fillInk(_body || C.mid,1.1);
        }
        //本体と、まんなかの帯
        this.circle(0,0,r*0.8);
        this.fillInk(_body || (blink ? "#c92420" : C.body),1.5);
        ctx.fillStyle = _body ? "#e8e8e8" : (blink ? "#8c1714" : C.mid);
        ctx.fillRect(-r*0.78,-1.6,r*1.56,3.2);
        this.shineArc(0,0,r*0.8 - 1.8,1.3);
        //ランプ
        if(blink) this.halo(0,0,8,"255,80,60",1);
        this.circle(0,0,3.6); this.fillInk(blink ? "#fff" : C.red,1);
    },

    //------------------------------------------------------------ 人間のドローン：X字の骨組みと4つの回転翼
    mdrone:function(_e,_body){
        var C = ENEMY_COLOR;
        var spin = _e.t*0.6;
        //腕
        ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-9,-9); ctx.lineTo(9,9); ctx.moveTo(9,-9); ctx.lineTo(-9,9); ctx.stroke();
        ctx.strokeStyle = C.mid; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8,-8); ctx.lineTo(8,8); ctx.moveTo(8,-8); ctx.lineTo(-8,8); ctx.stroke();
        //回転翼(となり同士で逆に回る)
        for(var i=0; i<4; i++){
            var rx = (i % 2 ? 9 : -9), ry = (i < 2 ? -9 : 9);
            this.rotor(rx,ry,5.5,(i == 0 || i == 3) ? spin : -spin,2);
            ctx.fillStyle = C.ink; this.circle(rx,ry,1.6); ctx.fill();
        }
        //本体：角の丸い板とカメラ
        this.roundRect(-5.5,-5.5,11,11,2);
        this.fillInk(_body || C.body,1.2);
        ctx.strokeStyle = C.light; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-3.5,-4.2); ctx.lineTo(3.5,-4.2); ctx.stroke();
        this.eye(0,0,2.1,Math.floor(_e.t/8) % 2 == 1);
    },

    //------------------------------------------------------------ ヘリ：機体は相手を向く。長い回転翼と尾翼
    heli:function(_e,_body){
        var C = ENEMY_COLOR, r = _e.r;
        ctx.save();
        ctx.rotate(_e.face || 0);
        //尾(細くなる)と尾翼、尾の回転翼
        ctx.beginPath(); ctx.moveTo(-r*0.6,-3); ctx.lineTo(-r - 15,-1.5); ctx.lineTo(-r - 15,1.5); ctx.lineTo(-r*0.6,3); ctx.closePath();
        this.fillInk(_body || C.oliveDark,1.1);
        ctx.beginPath(); ctx.rect(-r - 19,-6,5,12); this.fillInk(_body || C.oliveDark,1.1);
        this.rotor(-r - 16.5,-7,4,_e.t*0.9,2,"rgba(25,27,30,0.7)");
        //脚(そり)
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-r*0.6,-r*0.72); ctx.lineTo(r*0.6,-r*0.72); ctx.moveTo(-r*0.6,r*0.72); ctx.lineTo(r*0.6,r*0.72); ctx.stroke();
        //機体
        ctx.beginPath(); ctx.ellipse(0,0,r,r*0.6,0,0,Math.PI*2);
        this.fillInk(_body || C.olive,1.5);
        ctx.strokeStyle = C.oliveLight; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.ellipse(0,0,r - 2.5,r*0.6 - 2.5,0,Math.PI*1.1,Math.PI*1.6); ctx.stroke();
        ctx.strokeStyle = C.oliveDark; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-r*0.35,-r*0.5); ctx.lineTo(-r*0.35,r*0.5); ctx.stroke();    //継ぎ目
        //窓(光の筋)
        ctx.beginPath(); ctx.ellipse(r*0.45,0,r*0.36,r*0.32,0,0,Math.PI*2);
        this.fillInk(_body ? "#f4f4f4" : C.glass,1.1);
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(r*0.3,-r*0.18); ctx.lineTo(r*0.55,-r*0.24); ctx.stroke();
        ctx.restore();
        //主回転翼(機体の向きとは関係なく回る)
        this.rotor(0,0,30,_e.t*0.5,4,"rgba(22,24,27,0.72)",0);   //大きいので円盤は描かない(灰色の丸が目立つ)
        ctx.fillStyle = C.ink; this.circle(0,0,3.2); ctx.fill();
        ctx.fillStyle = C.light; this.circle(-0.9,-0.9,1); ctx.fill();
    },

    //------------------------------------------------------------ 戦車：車体は進む向き、砲塔は相手の向き
    panzer:function(_e,_body){
        var C = ENEMY_COLOR, r = _e.r;
        ctx.save();
        ctx.rotate(Math.atan2(_e.vy,_e.vx));
        //キャタピラ(進むと動く履帯の筋)
        var tw = 6.5, run = (_e.t*0.6) % 4;
        for(var s=-1; s<=1; s+=2){
            var ty = s < 0 ? -r*0.82 : r*0.82 - tw;
            ctx.beginPath(); ctx.rect(-r,ty,r*2,tw); this.fillInk(C.ink,1);
            ctx.strokeStyle = C.mid; ctx.lineWidth = 1;
            ctx.beginPath();
            for(var x=-r + run; x<r; x+=4){ ctx.moveTo(x,ty + 1); ctx.lineTo(x,ty + tw - 1); }
            ctx.stroke();
        }
        //車体：箱と、上の板・後ろの通気口
        ctx.beginPath(); ctx.rect(-r*0.9,-r*0.62,r*1.8,r*1.24);
        this.fillInk(_body || C.olive,1.5);
        ctx.fillStyle = _body ? "#e8e8e8" : C.oliveDark;
        ctx.fillRect(-r*0.8,-r*0.5,r*0.45,r);
        ctx.strokeStyle = C.olive; ctx.lineWidth = 1;
        ctx.beginPath();
        for(var i=0; i<4; i++){ ctx.moveTo(-r*0.74 + i*2.6,-r*0.42); ctx.lineTo(-r*0.74 + i*2.6,r*0.42); }
        ctx.stroke();
        ctx.strokeStyle = C.oliveLight; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-r*0.85,-r*0.55); ctx.lineTo(r*0.85,-r*0.55); ctx.stroke();
        ctx.restore();
        //砲塔と砲身(先に太い輪)
        ctx.save();
        ctx.rotate(_e.turret || 0);
        ctx.beginPath(); ctx.rect(0,-3,r + 10,6); this.fillInk(C.oliveDark,1.2);
        ctx.beginPath(); ctx.rect(r + 8,-4.2,5,8.4); this.fillInk(C.oliveDark,1.2);
        ctx.strokeStyle = C.oliveLight; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(r*0.4,-1.6); ctx.lineTo(r + 8,-1.6); ctx.stroke();
        this.roundRect(-r*0.55,-r*0.5,r*1.1,r,r*0.25);
        this.fillInk(_body || "#59674f",1.4);
        this.circle(-r*0.18,-r*0.12,r*0.18);
        this.fillInk(_body || C.oliveDark,1);
        ctx.strokeStyle = C.oliveLight; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-r*0.42,-r*0.4); ctx.lineTo(r*0.4,-r*0.4); ctx.stroke();
        ctx.restore();
    }
};
