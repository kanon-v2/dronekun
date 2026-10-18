//------------------------------------------------------------------------------
//  強化画面の見た目の案(試作)。戦いの合間にひと息つく場所として、眺めて世界を感じる画面にする
//    案A 丘の野営   ：タイトルの案D「崖の上の草原」の夕方の中で休む。操作は暗いすりガラスの板に明るい文字で載せる
//    案B 設計図     ：ハカセの設計図。紺地に方眼と白い線。ドローン君に寸法線と注記、ハカセの赤鉛筆のひとこと
//    案C スケッチブック：紙・水彩・鉛筆。手書きの字体(Klee One)と少し揺れた手描きの枠。窓の外の時刻は水彩の絵で見せる
//    案D 格納庫     ：ハカセの格納庫。窓の外・作業台・子どもの絵(下の hangar)
//    案E ホログラム ：Dead Space のメニューを参考に、ドローン君が暗い部屋に映し出すホログラム(はじめはこの案)
//  操作の部分(upgradeScreen の draw*)は書き直さず、描くあいだだけ ctx の色・字体の指定を案ごとに置き換える(uart.install)。
//  黒の文字は明るい文字に、白の地は暗い地に、というように対で置き換えるので、選んだタブなどの白黒の反転もそのまま保たれる
//  案は画面の上の「見た目」ボタンか URL の #ui=a～e で選ぶ。#ui=0 で前の白い画面
//
//  案D 格納庫：
//  ・大きな窓の外はタイトルの案D「崖の上の草原」と同じ世界(夕方の谷と遠い山なみ、谷の町の灯り)。WAVEが進むと窓の外の時刻が移る
//    (昼下がり → 夕方 → WAVE16からは夜。地平線が赤く燃え、町の灯りが減る)
//  ・窓から差す光の筋と、その中を舞うほこり。作業台のスタンドの灯り・湯気の立つマグカップ・丸めた設計図(ハカセの気配。姿は描かない)
//  ・窓ガラスに子どもの絵が貼ってある。先へ進むほど(出撃できるいちばん先のWAVE)枚数が増える
//  ・操作(能力強化・装備・ショップ)は右の紙に載せる
//------------------------------------------------------------------------------
const HANGAR_WIN = { x:36, y:66, w:230, h:236 };    //窓(ドローン君がうろうろする枠のあたり)
const HANGAR_PAPER = { x:286, y:58, w:660, h:460 }; //操作を載せる紙(右)
const HANGAR_REWARD_PAPER = { x:24, y:12, w:912, h:494 };  //報酬を選ぶときの紙
const HANGAR_BENCH_Y = 330;     //作業台の天板の高さ(px)
const HANGAR_DUST = 34;         //光の中を舞うほこりの数
const HANGAR_DRAWINGS_MAX = 4;  //窓に貼る子どもの絵の数の上限(WAVE5つ進むごとに1枚増える)
//窓の外の時刻(WAVEで移る)。sky：空(上から下)　sun：日(y は窓の中の割合)　ranges：山なみの色　town：町の灯りの割合　fire：地平線の火
const HANGAR_SKIES = [
    { from:1,  sky:["#5d86bd","#9db6d4","#efd7b0","#f8e6c4"], sun:{ x:0.74, y:0.52, c:"#fff6dc", glow:"255,236,190" },
      ranges:["#b9b3c4","#9a9cb6","#7b86a2"], mist:"248,228,200", town:0.15, light:"255,232,186", lightA:0.13, room:"#463d4a" },
    { from:8,  sky:["#2b4573","#7287ad","#e6b58a","#f7dcae"], sun:{ x:0.8, y:0.7, c:"#fff1cf", glow:"255,214,150" },
      ranges:["#b3a2b8","#9089a8","#6d7493"], mist:"244,210,178", town:0.7, light:"255,206,150", lightA:0.11, room:"#3b3342" },
    { from:16, sky:["#090c1c","#1a1e36","#3a2634","#6a3428"], sun:null,
      ranges:["#3a3446","#2c2a3c","#201f30"], mist:"150,70,50", town:0.25, fire:true, light:"255,150,100", lightA:0.06, room:"#28232e" }
];
//谷の町の灯り(窓の中の割合 x、高さのずれ)。決まった並びにして、毎回同じ町に見せる
const HANGAR_TOWN = [0.08,0.13,0.17,0.22,0.3,0.34,0.41,0.47,0.52,0.55,0.61,0.66,0.72,0.77,0.83,0.88,0.93];

var hangar = {
    t: 0,
    dust: [],

    //窓の外の時刻
    sky: function(){
        var w = upgradeScreen.sortieWave(), s = HANGAR_SKIES[0];
        for(var i=0; i<HANGAR_SKIES.length; i++) if(w >= HANGAR_SKIES[i].from) s = HANGAR_SKIES[i];
        return s;
    },
    //窓に貼る子どもの絵の数(どの難易度でも、いちばん先まで進んだWAVEで決める)
    drawings: function(){
        var r = 1;
        for(var d in game.reach) r = Math.max(r, game.reach[d] || 1);
        return Math.min(HANGAR_DRAWINGS_MAX, 1 + Math.floor((r - 1)/5));
    },

    //----------------------------------------------------------------- 全体
    draw: function(_reward){
        this.t++;
        var s = this.sky();
        this.drawRoom(s);
        this.drawWindow(s);
        this.drawBeam(s);
        this.drawBench(s);
        this.drawDust(s);
        this.drawPaper(_reward ? HANGAR_REWARD_PAPER : HANGAR_PAPER);
        if(!_reward) this.drawTag(30, 446, 240, 56);   //「タイトルへ」のボタンの下に敷く札
    },

    //壁・天井・床
    drawRoom: function(_s){
        ctx.fillStyle = _s.room;
        ctx.fillRect(0, 0, CW, CH);
        //壁の板の継ぎ目(縦)
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = 2;
        for(var x=18; x<CW; x+=64){
            ctx.beginPath(); ctx.moveTo(x, 58); ctx.lineTo(x, 436); ctx.stroke();
        }
        //天井の梁
        ctx.fillStyle = "rgba(0,0,0,0.32)";
        ctx.fillRect(0, 0, CW, 58);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, 56, CW, 2);
        //床(コンクリート)
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(0, 436, CW, CH - 436);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(0, 436, CW, 2);
    },

    //窓と外の景色
    drawWindow: function(_s){
        var W = HANGAR_WIN, x = W.x, y = W.y, w = W.w, h = W.h, t = this.t;
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        //空
        var g = ctx.createLinearGradient(0, y, 0, y + h);
        for(var i=0; i<4; i++) g.addColorStop(i/3, _s.sky[i]);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, w, h);
        //夜は星
        if(_s.fire){
            for(var i=0; i<26; i++){
                var sx = x + ((i*97) % w), sy = y + ((i*53) % (h*0.5));
                ctx.fillStyle = "rgba(230,230,255," + (0.3 + 0.3*Math.sin(t/40 + i)) + ")";
                ctx.fillRect(sx, sy, 1.5, 1.5);
            }
        }
        //日
        if(_s.sun){
            var sx = x + w*_s.sun.x, sy = y + h*_s.sun.y;
            var pulse = 1 + 0.03*Math.sin(t/38);
            var gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, 70*pulse);
            gl.addColorStop(0, "rgba(" + _s.sun.glow + ",0.55)");
            gl.addColorStop(1, "rgba(" + _s.sun.glow + ",0)");
            ctx.fillStyle = gl;
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = _s.sun.c;
            ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI*2); ctx.fill();
        }
        //雲(ゆっくり流れる)
        ctx.fillStyle = _s.fire ? "rgba(40,30,40,0.5)" : "rgba(255,244,230,0.35)";
        for(var i=0; i<3; i++){
            var cx = x + ((i*90 + t*0.06*(i + 1)) % (w + 120)) - 60, cy = y + 30 + i*26;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 34 + i*6, 6, 0, 0, Math.PI*2);
            ctx.ellipse(cx + 18, cy - 4, 18, 5, 0, 0, Math.PI*2);
            ctx.fill();
        }
        //遠い山なみ(奥から)
        for(var k=0; k<3; k++){
            var base = y + h*(0.62 + k*0.08), amp = 16 - k*4;
            ctx.fillStyle = _s.ranges[k];
            ctx.beginPath();
            ctx.moveTo(x, y + h);
            for(var px=0; px<=w; px+=6){
                var v = Math.sin(px*0.031 + k*1.7)*amp + Math.sin(px*0.083 + k*3.1)*amp*0.4;
                ctx.lineTo(x + px, base - Math.abs(v));
            }
            ctx.lineTo(x + w, y + h);
            ctx.closePath(); ctx.fill();
            //山のふもとの靄
            var mg = ctx.createLinearGradient(0, base - 6, 0, base + 18);
            mg.addColorStop(0, "rgba(" + _s.mist + ",0)");
            mg.addColorStop(1, "rgba(" + _s.mist + ",0.35)");
            ctx.fillStyle = mg;
            ctx.fillRect(x, base - 6, w, 24);
        }
        //地平線の火(夜)
        if(_s.fire){
            for(var i=0; i<4; i++){
                var fx = x + w*(0.15 + i*0.24), fy = y + h*0.84;
                var fr = 22 + 6*Math.sin(t/17 + i*2);
                var fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
                fg.addColorStop(0, "rgba(255,170,90,0.7)");
                fg.addColorStop(1, "rgba(255,90,40,0)");
                ctx.fillStyle = fg;
                ctx.fillRect(fx - fr, fy - fr, fr*2, fr*2);
                //立ちのぼる煙(火に照らされて、上ほど薄く消える)
                ctx.fillStyle = "rgba(90,60,64,0.16)";
                for(var j=0; j<3; j++){
                    var u = ((t*0.25 + j*30 + i*11) % 90)/90;
                    ctx.beginPath();
                    ctx.arc(fx + Math.sin(u*4 + i)*6 + u*14, fy - 10 - u*70, 5 + u*12, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
        //谷の町と灯り
        var ty = y + h*0.9;
        ctx.fillStyle = _s.fire ? "#140f18" : "#4a4660";
        for(var i=0; i<HANGAR_TOWN.length; i++){
            var bx = x + w*HANGAR_TOWN[i], bh = 6 + (i*7 % 9);
            ctx.fillRect(bx - 5, ty - bh, 10, bh + 30);
        }
        for(var i=0; i<HANGAR_TOWN.length; i++){
            if((i*0.37 % 1) > _s.town) continue;    //灯りのついている家だけ
            var bx = x + w*HANGAR_TOWN[i], bh = 6 + (i*7 % 9);
            var a = 0.7 + 0.3*Math.sin(t/30 + i*1.9);
            ctx.fillStyle = "rgba(255,214,140," + a + ")";
            ctx.fillRect(bx - 1.5, ty - bh + 3, 3, 3);
        }
        ctx.restore();

        //窓枠(十字の桟)
        ctx.strokeStyle = "#1e1a22";
        ctx.lineWidth = 8;
        ctx.strokeRect(x, y, w, h);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + w/2, y); ctx.lineTo(x + w/2, y + h);
        ctx.moveTo(x, y + h*0.45); ctx.lineTo(x + w, y + h*0.45);
        ctx.stroke();
        //窓枠に当たる光
        ctx.strokeStyle = "rgba(" + _s.light + ",0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
        //ガラスの映り込み(斜めの薄い筋)
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.moveTo(x + 30, y); ctx.lineTo(x + 70, y); ctx.lineTo(x - 10, y + 120); ctx.lineTo(x - 50, y + 120);
        ctx.fill();
        ctx.restore();
        //窓に貼った子どもの絵
        var n = this.drawings();
        //右下は作業台のスタンドと重なるので空ける
        var spots = [ { x:x + 10, y:y + h - 52, r:-0.08 }, { x:x + w - 54, y:y + 12, r:0.07 },
                      { x:x + 12, y:y + 10, r:0.05 }, { x:x + 62, y:y + h - 46, r:0.1 } ];
        for(var i=0; i<n; i++) this.drawKidArt(spots[i].x, spots[i].y, spots[i].r, i);
        //窓台
        ctx.fillStyle = "#1e1a22";
        ctx.fillRect(x - 10, y + h + 2, w + 20, 7);
    },

    //子どもがクレヨンで描いたドローン君の絵(窓にテープで貼ってある)
    drawKidArt: function(_x,_y,_rot,_i){
        var w = 44, h = 36;
        ctx.save();
        ctx.translate(_x + w/2, _y + h/2);
        ctx.rotate(_rot);
        ctx.fillStyle = "#fbf6ea";
        ctx.fillRect(-w/2, -h/2, w, h);
        //テープ
        ctx.fillStyle = "rgba(240,226,180,0.8)";
        ctx.fillRect(-7, -h/2 - 3, 14, 6);
        ctx.lineCap = "round";
        ctx.lineWidth = 2;
        if(_i % 2 == 0){
            //太陽と、空を飛ぶドローン君
            ctx.strokeStyle = "#e8a23a";
            ctx.beginPath(); ctx.arc(-13, -8, 5, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "#3a6fb0";
            ctx.strokeRect(0, -4, 12, 9);
            ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(14, -8); ctx.moveTo(6, -8); ctx.lineTo(6, -4); ctx.stroke();
            ctx.fillStyle = "#222";
            ctx.fillRect(3, -1, 2, 2); ctx.fillRect(8, -1, 2, 2);
            ctx.strokeStyle = "#5aa04a";
            ctx.beginPath(); ctx.moveTo(-20, 13); ctx.quadraticCurveTo(0, 8, 20, 13); ctx.stroke();
        }else{
            //ドローン君と手をつなぐ子ども
            ctx.strokeStyle = "#c0504a";
            ctx.beginPath(); ctx.arc(-9, -6, 4, 0, Math.PI*2);
            ctx.moveTo(-9, -2); ctx.lineTo(-9, 8); ctx.moveTo(-9, 8); ctx.lineTo(-13, 14); ctx.moveTo(-9, 8); ctx.lineTo(-5, 14);
            ctx.moveTo(-9, 1); ctx.lineTo(2, 0);
            ctx.stroke();
            ctx.strokeStyle = "#3a6fb0";
            ctx.strokeRect(3, -5, 11, 9);
            ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(15, -9); ctx.stroke();
            //ハート
            ctx.fillStyle = "#e0607a";
            ctx.beginPath(); ctx.arc(0, -13, 2, 0, Math.PI*2); ctx.arc(3, -13, 2, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-2, -12.5); ctx.lineTo(1.5, -8.5); ctx.lineTo(5, -12.5); ctx.fill();
        }
        ctx.restore();
    },

    //窓から差しこむ光の筋(床と作業台へ)
    drawBeam: function(_s){
        var W = HANGAR_WIN;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var g = ctx.createLinearGradient(W.x, W.y, W.x + 260, CH);
        g.addColorStop(0, "rgba(" + _s.light + "," + _s.lightA + ")");
        g.addColorStop(1, "rgba(" + _s.light + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(W.x + W.w, W.y);
        ctx.lineTo(W.x + W.w, W.y + W.h);
        ctx.lineTo(W.x + W.w + 200, CH);
        ctx.lineTo(W.x + 140, CH);
        ctx.lineTo(W.x, W.y + W.h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    },

    //光の中を舞うほこり
    drawDust: function(_s){
        if(this.dust.length == 0){
            for(var i=0; i<HANGAR_DUST; i++){
                this.dust.push({ x:(i*73) % 300 + 20, y:(i*131) % 420 + 80, p:i*0.7, s:0.08 + (i % 5)*0.03 });
            }
        }
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for(var i=0; i<this.dust.length; i++){
            var d = this.dust[i];
            d.y -= d.s;
            d.x += Math.sin(this.t/90 + d.p)*0.12;
            if(d.y < 70){ d.y = 520; d.x = (d.x*1.7 + 60) % 300 + 20; }
            var a = (0.18 + 0.18*Math.sin(this.t/50 + d.p))*(_s.lightA/0.11);
            ctx.fillStyle = "rgba(" + _s.light + "," + Math.max(0, a) + ")";
            ctx.beginPath(); ctx.arc(d.x, d.y, 1.2, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    },

    //作業台(スタンドの灯り・マグカップ・設計図)
    drawBench: function(_s){
        var y = HANGAR_BENCH_Y, t = this.t;
        //天板と脚
        ctx.fillStyle = "#5a4436";
        ctx.fillRect(0, y, 284, 10);
        ctx.fillStyle = "#3a2c26";
        ctx.fillRect(0, y + 10, 284, 6);
        ctx.fillRect(14, y + 16, 10, 120);
        ctx.fillRect(256, y + 16, 10, 120);
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        ctx.fillRect(0, y, 284, 1.5);
        //スタンドの灯り(作業台を照らす)
        var lx = 248, ly = y - 66;
        var lg = ctx.createRadialGradient(lx - 14, y, 0, lx - 14, y, 110);
        lg.addColorStop(0, "rgba(255,210,140,0.35)");
        lg.addColorStop(1, "rgba(255,210,140,0)");
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = lg;
        ctx.fillRect(lx - 130, y - 110, 260, 220);
        ctx.restore();
        ctx.strokeStyle = "#1e1a22";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lx + 8, y); ctx.lineTo(lx + 14, y - 40); ctx.lineTo(lx, ly);
        ctx.stroke();
        ctx.fillStyle = "#1e1a22";
        ctx.fillRect(lx - 4, y - 4, 24, 4);
        ctx.beginPath();
        ctx.moveTo(lx + 4, ly - 6); ctx.lineTo(lx - 26, ly + 2); ctx.lineTo(lx - 14, ly + 16); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,226,170,0.9)";
        ctx.beginPath(); ctx.ellipse(lx - 20, ly + 9, 6, 2.5, -0.6, 0, Math.PI*2); ctx.fill();
        //マグカップと湯気
        var mx = 212;
        ctx.fillStyle = "#c9b8a2";
        ctx.fillRect(mx - 8, y - 16, 16, 16);
        ctx.strokeStyle = "#c9b8a2";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(mx + 9, y - 9, 4, -Math.PI/2, Math.PI/2); ctx.stroke();
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fillRect(mx - 8, y - 16, 4, 16);
        ctx.strokeStyle = "rgba(255,250,240,0.22)";
        ctx.lineWidth = 2;
        for(var i=0; i<2; i++){
            var ph = t/40 + i*2.2;
            ctx.beginPath();
            for(var k=0; k<=10; k++){
                var u = k/10;
                var sx = mx - 3 + i*6 + Math.sin(ph + u*4)*4*u, sy = y - 20 - u*34;
                if(k == 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
            }
            ctx.stroke();
        }
        //丸めた設計図とめがね
        ctx.fillStyle = "#8fa9c8";
        ctx.save();
        ctx.translate(160, y - 5);
        ctx.rotate(-0.08);
        ctx.fillRect(-26, -5, 52, 10);
        ctx.fillStyle = "#6f8aac";
        ctx.beginPath(); ctx.ellipse(26, 0, 3, 5, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "#1e1a22";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(116, y - 4, 4, 0, Math.PI*2); ctx.moveTo(130, y - 4); ctx.arc(126, y - 4, 4, 0, Math.PI*2);
        ctx.moveTo(120, y - 4); ctx.lineTo(122, y - 4);
        ctx.stroke();
        //今の性能を書いた札(作業台の前に下げる)
        this.drawTag(26, y + 8, 176, 80);
    },

    //紙の札(文字・ボタンを黒のまま読めるように敷く)
    drawTag: function(_x,_y,_w,_h){
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(_x + 3, _y + 4, _w, _h);
        ctx.fillStyle = "#efe6d4";
        ctx.fillRect(_x, _y, _w, _h);
    },

    //操作を載せる紙(角をテープで留める)
    drawPaper: function(_p){
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(_p.x + 5, _p.y + 6, _p.w, _p.h);
        ctx.fillStyle = "#f6f0e2";
        ctx.fillRect(_p.x, _p.y, _p.w, _p.h);
        ctx.strokeStyle = "rgba(120,100,70,0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(_p.x + 0.5, _p.y + 0.5, _p.w - 1, _p.h - 1);
        ctx.fillStyle = "rgba(236,222,178,0.85)";
        var tapes = [[_p.x + 6, _p.y - 6, -0.6], [_p.x + _p.w - 6, _p.y - 6, 0.6]];
        for(var i=0; i<tapes.length; i++){
            ctx.save();
            ctx.translate(tapes[i][0], tapes[i][1] + 8);
            ctx.rotate(tapes[i][2]);
            ctx.fillRect(-18, -6, 36, 12);
            ctx.restore();
        }
    }
};


//------------------------------------------------------------------------------
//  案の切り替えと、色・字体の置き換え
//------------------------------------------------------------------------------
const UART_PANEL = { x:290, y:60, w:656, h:456 };   //操作を載せる板(右)
const UART_REWARD = { x:24, y:12, w:912, h:494 };   //報酬を選ぶときの板
const UART_SWITCH = { x:390, y:3, w:180, h:20 };    //見た目を切り替えるボタン(上のまんなか。試作のあいだだけ)
const UART_CX = 150, UART_CY = 210;                 //ドローン君がうろうろする中心(upgradeScreen.js の Icon のまんなか)
const UART_HOLO_OPEN = 16;                          //案Eのホログラムが開ききるまで(フレーム)

var uart = {
    list:["e","a","b","c","d",null],    //null は前の白い画面
    pick:(function(){ var m = /ui=([a-e0])/.exec(location.hash); return m ? (m[1] == "0" ? null : m[1]) : "e"; })(),
    openT:0,        //画面に入ってからのフレーム(案Eのホログラムが開く)
    active:null,    //色・字体を置き換えている案(描いているあいだだけ)
    t:0,
    cur:function(){ return this.pick ? UART_CASES[this.pick] : null; },

    //ctx の色・字体の指定を、置き換えている案があるあいだだけ読み替える(操作のコードはそのまま)
    install:function(){
        var P = CanvasRenderingContext2D.prototype, self = this;
        ["fillStyle","strokeStyle"].forEach(function(k){
            var d = Object.getOwnPropertyDescriptor(P, k), mk = k == "fillStyle" ? "fill" : "stroke";
            Object.defineProperty(ctx, k, { configurable:true,
                get:function(){ return d.get.call(this); },
                set:function(v){
                    var a = self.active;
                    if(a && typeof v == "string"){ var m = a[mk][v.toLowerCase()]; if(m) v = m; }
                    d.set.call(this, v);
                } });
        });
        var df = Object.getOwnPropertyDescriptor(P, "font");
        Object.defineProperty(ctx, "font", { configurable:true,
            get:function(){ return df.get.call(this); },
            set:function(v){ if(self.active && typeof v == "string") v = self.mapFont(self.active, v); df.set.call(this, v); } });
        //手描きの案では、四角い枠を少し揺れた鉛筆の線にする
        var sr = ctx.strokeRect;
        ctx.strokeRect = function(x,y,w,h){
            if(self.active && self.active.sketch && w > 8 && h > 8) self.wobbleRect(x,y,w,h);
            else sr.call(ctx,x,y,w,h);
        };
        try{
            document.fonts.load('16px "Klee One"'); document.fonts.load('600 16px "Klee One"');
            document.fonts.load('bold 16px "Shippori Mincho"'); document.fonts.load('600 16px "Rajdhani"'); document.fonts.load('bold 16px "Rajdhani"'); document.fonts.load('16px "Zen Kaku Gothic New"');
        }catch(e){}
    },
    mapFont:function(_a,_v){
        if(/sans-serif\s*$/.test(_v)) return _v.replace(/sans-serif\s*$/, _a.sans);
        if(/serif\s*$/.test(_v)) return _v.replace(/serif\s*$/, _a.serif);
        return _v;
    },
    //置き換えをやめて描く(装備の印・ドローン君の絵は元の色のまま)
    quiet:function(_f,_self,_args){
        var a = this.active, sb = ctx.shadowBlur;
        this.active = null;
        ctx.shadowBlur = 0;     //光のにじみ(案E)もかけない
        try{ return _f.apply(_self, _args); } finally{ this.active = a; ctx.shadowBlur = sb; }
    },
    //鉛筆で描いた四角(2回なぞる。形は位置で決まり、毎フレーム同じ)
    wobbleRect:function(x,y,w,h){
        var s = x*0.37 + y*0.73 + w*0.11 + h*0.29;
        var pts = [[x,y],[x + w,y],[x + w,y + h],[x,y + h]];
        var a0 = ctx.globalAlpha;
        for(var pass=0; pass<2; pass++){
            ctx.globalAlpha = a0*(pass ? 0.45 : 0.9);
            ctx.beginPath();
            for(var i=0; i<4; i++){
                var a = pts[i], b = pts[(i + 1) % 4];
                var j1 = Math.sin(s + i*1.3 + pass*2.1)*1.1, j2 = Math.sin(s*1.7 + i*2.9 + pass)*1.1;
                var mx = (a[0] + b[0])/2 + Math.sin(s*2.3 + i + pass)*1.0, my = (a[1] + b[1])/2 + Math.cos(s*1.9 + i + pass)*1.0;
                var ox = (b[0] - a[0])*0.012, oy = (b[1] - a[1])*0.012;
                ctx.moveTo(a[0] + j1 - ox, a[1] + j2 - oy);
                ctx.quadraticCurveTo(mx, my, b[0] + j2 + ox, b[1] + j1 + oy);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = a0;
    },

    //見た目を切り替えるボタン(試作のあいだだけ)
    switchHit:function(_x,_y){ var r = UART_SWITCH; return _x > r.x && _x < r.x + r.w && _y > r.y && _y < r.y + r.h; },
    drawSwitch:function(){
        var r = UART_SWITCH, C = this.cur();
        ctx.fillStyle = this.switchHit(MouseX, MouseY) ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.45)";
        roundRectPath(r.x, r.y, r.w, r.h, 10);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("見た目：" + (C ? "案" + this.pick.toUpperCase() + " " + C.name : "前の画面") + "　▶", r.x + r.w/2, r.y + r.h/2 + 1);
        ctx.fillStyle = "#000";
    },
    next:function(){
        var i = this.list.indexOf(this.pick);
        this.pick = this.list[(i + 1) % this.list.length];
        this.openT = 0;
    },

    //すりガラスの板(案A)
    glass:function(_r,_rad){
        var rad = _rad || 14;
        roundRectPath(_r.x, _r.y, _r.w, _r.h, rad);
        ctx.fillStyle = "rgba(16,18,36,0.64)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,236,210,0.26)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,240,220,0.08)";
        ctx.fillRect(_r.x + rad, _r.y + 1, _r.w - rad*2, 1);
    }
};

//案ごとの置き換え。fill・stroke：元の色 → 案の色　sans・serif：字体　head：見出しの色　bg：操作より奥に描く　front：操作より手前に描く
const UART_CASES = {
    //---------------------------------------------------------------- 案A 丘の野営
    a:{
        name:"丘の野営",
        sans:'"Zen Kaku Gothic New", sans-serif', serif:'"Shippori Mincho", serif',
        head:"#fff6e6",
        fill:{ "#000":"#f6ecda", "black":"#f6ecda", "#333":"#e9dcc6", "#444":"#d9ccb8", "#555":"#cbbda9", "#777":"#aaa0a0", "#999":"#958f9c",
               "#bbb":"rgba(246,236,218,0.3)", "#ccc":"rgba(246,236,218,0.25)", "#fff":"#1c1f36", "white":"#1c1f36",
               "#eee":"rgba(255,240,220,0.12)", "#f4f4f4":"rgba(255,240,220,0.12)", "#f2f2f2":"rgba(255,240,220,0.1)",
               "#c33":"#ff9b7a", "#246":"#a9c8ff" },
        stroke:{ "#000":"rgba(246,236,218,0.5)", "black":"rgba(246,236,218,0.5)", "#bbb":"rgba(246,236,218,0.22)", "#ccc":"rgba(246,236,218,0.2)",
                 "#999":"rgba(246,236,218,0.35)", "#c33":"#ff9b7a" },
        bg:function(_t,_reward){
            //タイトルと同じ崖の上の草原(遠くの空を横切るドローン君たちも)
            var pk = titleArt.pick;
            titleArt.pick = "d";
            titleArt.draw(_t);
            titleArt.pick = pk;
            //見出しが読めるよう、上を少し暗く
            var g = ctx.createLinearGradient(0, 0, 0, 110);
            g.addColorStop(0, "rgba(12,14,32,0.6)");
            g.addColorStop(1, "rgba(12,14,32,0)");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, CW, 110);
            if(_reward){ uart.glass(UART_REWARD, 16); return; }
            uart.glass(UART_PANEL, 16);
            uart.glass({ x:24, y:336, w:184, h:78 }, 10);
            uart.glass({ x:30, y:450, w:240, h:48 }, 10);
        }
    },
    //---------------------------------------------------------------- 案B 設計図
    b:{
        name:"設計図",
        sans:'"Zen Kaku Gothic New", sans-serif', serif:'"Zen Kaku Gothic New", sans-serif',
        head:"#eaf3ff",
        fill:{ "#000":"#eaf3ff", "black":"#eaf3ff", "#333":"#d6e6fb", "#444":"#bcd2f0", "#555":"#b0c8ea", "#777":"#8eaad3", "#999":"#7f9cc8",
               "#bbb":"rgba(234,243,255,0.3)", "#ccc":"rgba(234,243,255,0.25)", "#fff":"#173f72", "white":"#173f72",
               "#eee":"rgba(255,255,255,0.09)", "#f4f4f4":"rgba(255,255,255,0.09)", "#f2f2f2":"rgba(255,255,255,0.07)",
               "#c33":"#ffc069", "#246":"#9fe0ff" },
        stroke:{ "#000":"rgba(234,243,255,0.75)", "black":"rgba(234,243,255,0.75)", "#bbb":"rgba(234,243,255,0.25)", "#ccc":"rgba(234,243,255,0.22)",
                 "#999":"rgba(234,243,255,0.4)", "#c33":"#ffc069" },
        bg:function(_t,_reward){
            var g = ctx.createLinearGradient(0, 0, CW, CH);
            g.addColorStop(0, "#1d4a82");
            g.addColorStop(1, "#11335f");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, CW, CH);
            //方眼(細かい目と、5目ごとの太い目)
            ctx.lineWidth = 1;
            for(var x=0; x<CW; x+=15){
                ctx.strokeStyle = (x % 75 == 0) ? "rgba(200,225,255,0.13)" : "rgba(200,225,255,0.05)";
                ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, CH); ctx.stroke();
            }
            for(var y=0; y<CH; y+=15){
                ctx.strokeStyle = (y % 75 == 0) ? "rgba(200,225,255,0.13)" : "rgba(200,225,255,0.05)";
                ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(CW, y + 0.5); ctx.stroke();
            }
            //紙のふちを暗く
            var v = ctx.createRadialGradient(CW/2, CH/2, CH*0.4, CW/2, CH/2, CW*0.65);
            v.addColorStop(0, "rgba(5,15,35,0)");
            v.addColorStop(1, "rgba(5,15,35,0.45)");
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, CW, CH);
            if(_reward){ this.frame(UART_REWARD); return; }
            this.frame(UART_PANEL);
            this.drawing(_t);
            //性能の表・タイトルへの枠
            ctx.strokeStyle = "rgba(234,243,255,0.6)";
            ctx.strokeRect(24.5, 336.5, 184, 76);
            ctx.strokeStyle = "rgba(234,243,255,0.25)";
            ctx.beginPath(); ctx.moveTo(25, 363.5); ctx.lineTo(208, 363.5); ctx.moveTo(25, 385.5); ctx.lineTo(208, 385.5); ctx.stroke();
            this.frame({ x:30, y:450, w:240, h:48 });
        },
        //二重線の枠(角に目印)
        frame:function(_r){
            ctx.fillStyle = "rgba(8,28,58,0.4)";
            ctx.fillRect(_r.x, _r.y, _r.w, _r.h);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = "rgba(234,243,255,0.7)";
            ctx.strokeRect(_r.x + 0.5, _r.y + 0.5, _r.w - 1, _r.h - 1);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "rgba(234,243,255,0.3)";
            ctx.strokeRect(_r.x + 4.5, _r.y + 4.5, _r.w - 9, _r.h - 9);
            ctx.fillStyle = "rgba(234,243,255,0.8)";
            var cs = [[_r.x, _r.y], [_r.x + _r.w, _r.y], [_r.x, _r.y + _r.h], [_r.x + _r.w, _r.y + _r.h]];
            for(var i=0; i<4; i++) ctx.fillRect(cs[i][0] - 3, cs[i][1] - 3, 6, 6);
        },
        //ドローン君の図面：円・中心線・目盛り・寸法線・注記・ハカセの赤鉛筆
        drawing:function(_t){
            var cx = UART_CX, cy = UART_CY, R = 96;
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(220,236,255,0.55)";
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 5]);
            ctx.lineDashOffset = -_t*0.2;
            ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.stroke();
            //中心線(一点鎖線)
            ctx.setLineDash([16, 4, 2, 4]);
            ctx.lineDashOffset = 0;
            ctx.strokeStyle = "rgba(220,236,255,0.3)";
            ctx.beginPath();
            ctx.moveTo(cx - R - 22, cy); ctx.lineTo(cx + R + 22, cy);
            ctx.moveTo(cx, cy - R - 22); ctx.lineTo(cx, cy + R + 10);
            ctx.stroke();
            ctx.setLineDash([]);
            //目盛り
            ctx.strokeStyle = "rgba(220,236,255,0.6)";
            for(var i=0; i<24; i++){
                var a = i*Math.PI/12, l = i % 6 == 0 ? 9 : 4;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a)*R, cy + Math.sin(a)*R);
                ctx.lineTo(cx + Math.cos(a)*(R + l), cy + Math.sin(a)*(R + l));
                ctx.stroke();
            }
            //寸法線
            var dy = 322;
            ctx.beginPath();
            ctx.moveTo(cx - R, dy - 8); ctx.lineTo(cx - R, dy + 4);
            ctx.moveTo(cx + R, dy - 8); ctx.lineTo(cx + R, dy + 4);
            ctx.moveTo(cx - R, dy); ctx.lineTo(cx - 22, dy);
            ctx.moveTo(cx + 22, dy); ctx.lineTo(cx + R, dy);
            ctx.stroke();
            ctx.fillStyle = "rgba(220,236,255,0.8)";
            ctx.beginPath();
            ctx.moveTo(cx - R, dy); ctx.lineTo(cx - R + 7, dy - 3); ctx.lineTo(cx - R + 7, dy + 3);
            ctx.moveTo(cx + R, dy); ctx.lineTo(cx + R - 7, dy - 3); ctx.lineTo(cx + R - 7, dy + 3);
            ctx.fill();
            ctx.font = '11px "Zen Kaku Gothic New", sans-serif';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("φ192", cx, dy);
            //注記
            ctx.textAlign = "left";
            ctx.fillStyle = "rgba(234,243,255,0.85)";
            ctx.font = 'bold 13px "Zen Kaku Gothic New", sans-serif';
            ctx.fillText("DK-01  ドローン君", 24, 82);
            ctx.font = '10px "Zen Kaku Gothic New", sans-serif';
            ctx.fillStyle = "rgba(234,243,255,0.55)";
            ctx.fillText("正面図　S=1:4　改訂 WAVE " + upgradeScreen.sortieWave(), 24, 98);
            //ハカセの赤鉛筆
            ctx.save();
            ctx.translate(30, 128);
            ctx.rotate(-0.08);
            ctx.fillStyle = "#ff8a78";
            ctx.font = '600 15px "Klee One", sans-serif';
            ctx.fillText("ムリしないこと！", 0, 0);
            ctx.font = '12px "Klee One", sans-serif';
            ctx.fillText("― H", 70, 18);
            ctx.restore();
            ctx.strokeStyle = "rgba(255,138,120,0.85)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(96, 146); ctx.quadraticCurveTo(104, 172, 126, 186);
            ctx.moveTo(126, 186); ctx.lineTo(118, 185); ctx.moveTo(126, 186); ctx.lineTo(122, 179);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    },
    //---------------------------------------------------------------- 案C スケッチブック
    c:{
        name:"スケッチブック",
        sketch:true,
        sans:'"Klee One", sans-serif', serif:'"Klee One", serif',
        head:"#3a332d",
        fill:{ "#000":"#3a332d", "black":"#3a332d", "#333":"#4a423a", "#444":"#5e544a", "#555":"#6a5f55", "#777":"#968a7d", "#999":"#a49888",
               "#bbb":"#c9bcaa", "#ccc":"#d3c7b5", "#fff":"#f7f1e3", "white":"#f7f1e3",
               "#eee":"rgba(222,186,120,0.22)", "#f4f4f4":"rgba(222,186,120,0.22)", "#f2f2f2":"rgba(222,186,120,0.16)",
               "#c33":"#cf5a45", "#246":"#3d6ea0" },
        stroke:{ "#000":"#4a423a", "black":"#4a423a", "#bbb":"#c9bcaa", "#ccc":"#d3c7b5", "#999":"#a49888", "#c33":"#cf5a45" },
        bg:function(_t,_reward){
            ctx.fillStyle = "#f6f0e2";
            ctx.fillRect(0, 0, CW, CH);
            //紙のざらつき
            ctx.fillStyle = "rgba(120,100,70,0.07)";
            for(var i=0; i<500; i++){
                ctx.fillRect(titleArt.rnd(i, 11)*CW, titleArt.rnd(i, 12)*CH, 1.5, 1.5);
            }
            //スケッチブックのとじ(上のリング)
            for(var x=36; x<CW; x+=36){
                ctx.fillStyle = "rgba(60,50,40,0.25)";
                ctx.beginPath(); ctx.arc(x, 12, 3.5, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "#8a8078";
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(x, 6, 6, Math.PI*0.15, Math.PI*0.95, true); ctx.stroke();
            }
            ctx.lineWidth = 1;
            if(_reward) return;
            //余白の線
            ctx.strokeStyle = "rgba(207,90,69,0.22)";
            ctx.beginPath(); ctx.moveTo(288.5, 60); ctx.lineTo(288.5, CH - 20); ctx.stroke();
            this.painting(_t);
            //性能の欄(ノートの罫線)
            ctx.strokeStyle = "rgba(80,120,170,0.25)";
            for(var k=0; k<3; k++){ ctx.beginPath(); ctx.moveTo(28, 362.5 + k*22); ctx.lineTo(206, 362.5 + k*22); ctx.stroke(); }
        },
        //窓の外の時刻を水彩で(格納庫と同じ時刻の色を使う)
        painting:function(_t){
            var s = hangar.sky(), x = 30, y = 70, w = 240, h = 246;
            //にじんだふちの形
            var path = function(_k){
                ctx.beginPath();
                for(var i=0; i<=48; i++){
                    var a = i/48*Math.PI*2, ca = Math.cos(a), sa = Math.sin(a);
                    //角の丸い四角に近い形を、ふちだけ揺らす
                    var px = Math.sign(ca)*Math.pow(Math.abs(ca), 0.35), py = Math.sign(sa)*Math.pow(Math.abs(sa), 0.35);
                    var j = 1 + 0.025*Math.sin(i*2.7 + _k) + 0.015*Math.sin(i*5.3 + _k*2);
                    var X = x + w/2 + px*w/2*j, Y = y + h/2 + py*h/2*j;
                    if(i == 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
                }
                ctx.closePath();
            };
            ctx.save();
            path(0);
            ctx.clip();
            var g = ctx.createLinearGradient(0, y, 0, y + h);
            for(var i=0; i<4; i++) g.addColorStop(i/3, s.sky[i]);
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = g;
            ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
            //水彩のむら(色を薄く重ねる)
            for(var i=0; i<14; i++){
                ctx.fillStyle = s.sky[i % 4];
                ctx.globalAlpha = 0.12;
                ctx.beginPath();
                ctx.ellipse(x + titleArt.rnd(i, 21)*w, y + titleArt.rnd(i, 22)*h*0.7, 30 + titleArt.rnd(i, 23)*40, 14 + titleArt.rnd(i, 24)*16, 0, 0, Math.PI*2);
                ctx.fill();
            }
            //日
            if(s.sun){
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = s.sun.c;
                ctx.beginPath(); ctx.arc(x + w*s.sun.x, y + h*s.sun.y, 18, 0, Math.PI*2); ctx.fill();
            }
            //山なみ(水彩を重ねる)
            for(var k=0; k<3; k++){
                var base = y + h*(0.66 + k*0.09);
                ctx.globalAlpha = 0.55;
                ctx.fillStyle = s.ranges[k];
                ctx.beginPath();
                ctx.moveTo(x - 10, y + h + 10);
                for(var px=-10; px<=w + 10; px+=8){
                    ctx.lineTo(x + px, base - Math.abs(Math.sin(px*0.03 + k*1.9)*(16 - k*4)) - Math.sin(px*0.09 + k)*3);
                }
                ctx.lineTo(x + w + 10, y + h + 10);
                ctx.closePath(); ctx.fill();
            }
            //地平線の火(夜)
            if(s.fire){
                //地平線ににじむ赤い光(にじみを何度か薄く重ねる)
                for(var i=0; i<4; i++){
                    for(var k=0; k<4; k++){
                        ctx.globalAlpha = (0.07 + 0.02*Math.sin(_t/24 + i*1.7))*(4 - k)/2;
                        ctx.fillStyle = k < 2 ? "#e0603c" : "#f4a35c";
                        ctx.beginPath();
                        ctx.ellipse(x + w*(0.14 + i*0.25) + titleArt.rnd(i, 40 + k)*10 - 5, y + h*0.8 + k*2, 34 - k*6, 18 - k*3, 0, 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
            //絵の具のふち(にじみの縁が少し濃くなる)
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = s.ranges[2];
            ctx.lineWidth = 1.5;
            path(0.6);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 1;
            //しぶき
            ctx.fillStyle = s.ranges[1];
            for(var i=0; i<10; i++){
                ctx.globalAlpha = 0.3;
                ctx.beginPath(); ctx.arc(x + w - 10 + titleArt.rnd(i, 31)*30, y + h - 30 + titleArt.rnd(i, 32)*40, 0.8 + titleArt.rnd(i, 33)*1.8, 0, Math.PI*2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            //マスキングテープ
            var tapes = [[x + 6, y + 4, -0.7], [x + w - 6, y + 4, 0.7]];
            ctx.fillStyle = "rgba(226,200,150,0.65)";
            for(var i=0; i<2; i++){
                ctx.save(); ctx.translate(tapes[i][0], tapes[i][1]); ctx.rotate(tapes[i][2]);
                ctx.fillRect(-20, -7, 40, 14);
                ctx.restore();
            }
            //ハカセのふせん
            ctx.save();
            ctx.translate(226, 296);
            ctx.rotate(0.07);
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            ctx.fillRect(-38, -30, 80, 66);
            ctx.fillStyle = "#fbe7a0";
            ctx.fillRect(-40, -32, 80, 66);
            ctx.fillStyle = "#5a4c3c";
            ctx.font = '13px "Klee One", sans-serif';
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("おかえり。", -32, -16);
            ctx.fillText("ゆっくり", -32, 2);
            ctx.fillText("やすんでね", -32, 18);
            ctx.restore();
            //絵の下の書き込み
            ctx.fillStyle = "rgba(58,51,45,0.6)";
            ctx.font = '12px "Klee One", sans-serif';
            ctx.textAlign = "left";
            ctx.fillText("WAVE " + upgradeScreen.sortieWave() + " のまえの空", 32, 326);
        }
    },
    //---------------------------------------------------------------- 案E ホログラム(Dead Space のメニューを参考に)
    //画面の外の板ではなく、ドローン君が暗い部屋に映し出すホログラム。光の筋の先にパネルが浮かび、ホログラムが部屋のいちばんの明かりになる。
    //開くときはドローン君の側からちらつきながら広がる。走査線・ときどき走るノイズ・角のかぎ括弧・警告はオレンジ。耐久はドローン君の下の光る目盛りで見せる
    e:{
        name:"ホログラム",
        sans:'"Rajdhani", "Zen Kaku Gothic New", sans-serif', serif:'"Rajdhani", "Zen Kaku Gothic New", sans-serif',
        head:"#c8f4ff",
        fill:{ "#000":"#aeefff", "black":"#aeefff", "#333":"#9adff2", "#444":"#86cde2", "#555":"#7ab9cf", "#777":"#5f97ab", "#999":"#557f92",
               "#bbb":"rgba(120,220,255,0.28)", "#ccc":"rgba(120,220,255,0.22)", "#fff":"#04131c", "white":"#04131c",
               "#eee":"rgba(120,220,255,0.14)", "#f4f4f4":"rgba(120,220,255,0.14)", "#f2f2f2":"rgba(120,220,255,0.1)",
               "#c33":"#ffa040", "#246":"#ffd27a" },
        stroke:{ "#000":"rgba(120,220,255,0.7)", "black":"rgba(120,220,255,0.7)", "#bbb":"rgba(120,220,255,0.25)", "#ccc":"rgba(120,220,255,0.22)",
                 "#999":"rgba(120,220,255,0.4)", "#c33":"#ffa040" },
        holo:"120,220,255",
        //ホログラムの開き具合(0～1。開いてからのフレームで決める)
        open:function(){ var k = Math.min(1, uart.openT/UART_HOLO_OPEN); return 1 - Math.pow(1 - k, 3); },
        //映し出しているドローン君の位置(うろうろする絵の中心)
        src:function(){ return { x:drone_around.X + 20, y:drone_around.Y + 20 }; },
        bg:function(_t,_reward){
            var H = this.holo;
            ctx.fillStyle = "#04070b";
            ctx.fillRect(0, 0, CW, CH);
            //暗い部屋：奥の柱と、遠くで点る小さな灯り
            ctx.fillStyle = "rgba(120,160,190,0.04)";
            for(var i=0; i<6; i++) ctx.fillRect(40 + i*170, 0, 18, 470);
            for(var i=0; i<5; i++){
                var on = Math.sin(_t/50 + i*2.3) > 0.2;
                ctx.fillStyle = on ? "rgba(255,150,60,0.55)" : "rgba(255,150,60,0.15)";
                ctx.fillRect(70 + i*190 + (i % 2)*40, 120 + (i*67 % 150), 3, 3);
            }
            //ホログラムが部屋を照らす
            var k = this.open();
            var P = _reward ? UART_REWARD : UART_PANEL;
            var lg = ctx.createRadialGradient(P.x + P.w/2, P.y + P.h/2, 40, P.x + P.w/2, P.y + P.h/2, 520);
            lg.addColorStop(0, "rgba(" + H + "," + (0.13*k) + ")");
            lg.addColorStop(1, "rgba(" + H + ",0)");
            ctx.fillStyle = lg;
            ctx.fillRect(0, 0, CW, CH);
            //床と、床に映るホログラム
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.fillRect(0, 470, CW, CH - 470);
            var fg = ctx.createLinearGradient(0, 470, 0, CH);
            fg.addColorStop(0, "rgba(" + H + "," + (0.1*k) + ")");
            fg.addColorStop(1, "rgba(" + H + ",0)");
            ctx.fillStyle = fg;
            ctx.fillRect(P.x, 470, P.w, CH - 470);
            if(_reward){ this.panel(UART_REWARD, _t, "REWARD // SELECT ONE"); return; }
            //ドローン君から伸びる光の筋(映写の光)
            var s = this.src();
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            var bx = P.x + (1 - k)*0;
            var bg = ctx.createLinearGradient(s.x, 0, P.x, 0);
            bg.addColorStop(0, "rgba(" + H + "," + (0.2*k) + ")");
            bg.addColorStop(1, "rgba(" + H + "," + (0.05*k) + ")");
            ctx.fillStyle = bg;
            ctx.beginPath();
            ctx.moveTo(s.x + 10, s.y - 2); ctx.lineTo(bx, P.y); ctx.lineTo(bx, P.y + P.h); ctx.lineTo(s.x + 10, s.y + 4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(" + H + "," + (0.25*k) + ")";
            ctx.beginPath();
            ctx.moveTo(s.x + 10, s.y - 2); ctx.lineTo(bx, P.y);
            ctx.moveTo(s.x + 10, s.y + 4); ctx.lineTo(bx, P.y + P.h);
            ctx.stroke();
            //映写口の光
            var eg = ctx.createRadialGradient(s.x + 10, s.y + 1, 0, s.x + 10, s.y + 1, 16);
            eg.addColorStop(0, "rgba(" + H + "," + (0.7*k) + ")");
            eg.addColorStop(1, "rgba(" + H + ",0)");
            ctx.fillStyle = eg;
            ctx.fillRect(s.x - 6, s.y - 15, 32, 32);
            ctx.restore();
            this.panel(UART_PANEL, _t, "DK-01 // MAINTENANCE BENCH", true);   //札は見出しと重ならないよう下に
            this.panel({ x:24, y:336, w:184, h:78 }, _t, "STATUS");
            this.panel({ x:30, y:450, w:240, h:48 }, _t);
        },
        //ホログラムの板：薄い地・ふちの線・角のかぎ括弧・上の札(_below なら下の札)
        panel:function(_r,_t,_label,_below){
            var H = this.holo, k = this.open();
            var a = k*(0.92 + 0.08*Math.sin(_t/7)*Math.sin(_t/13));     //かすかなちらつき
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = "rgba(20,90,120,0.2)";
            ctx.fillRect(_r.x, _r.y, _r.w, _r.h);
            ctx.strokeStyle = "rgba(" + H + ",0.35)";
            ctx.lineWidth = 1;
            ctx.strokeRect(_r.x + 0.5, _r.y + 0.5, _r.w - 1, _r.h - 1);
            ctx.strokeStyle = "rgba(" + H + ",0.95)";
            ctx.lineWidth = 2;
            var c = 12, xs = [_r.x, _r.x + _r.w], ys = [_r.y, _r.y + _r.h];
            for(var i=0; i<2; i++) for(var j=0; j<2; j++){
                var sx = i ? -1 : 1, sy = j ? -1 : 1;
                ctx.beginPath();
                ctx.moveTo(xs[i] + sx*c, ys[j]); ctx.lineTo(xs[i], ys[j]); ctx.lineTo(xs[i], ys[j] + sy*c);
                ctx.stroke();
            }
            if(_label){
                ctx.font = '600 11px "Rajdhani", "Zen Kaku Gothic New", sans-serif';
                ctx.textAlign = "left";
                ctx.textBaseline = "bottom";
                ctx.fillStyle = "rgba(" + H + ",0.8)";
                var ly = _below ? _r.y + _r.h + 15 : _r.y - 3;
                ctx.fillText(_label, _r.x + 2, ly);
                //札の横の細い線と、点る印
                var lw = ctx.measureText(_label).width;
                ctx.fillRect(_r.x + lw + 8, ly - 5, 40, 1);
                if(Math.sin(_t/12) > 0) ctx.fillRect(_r.x + lw + 52, ly - 7, 4, 4);
            }
            ctx.restore();
        },
        //操作を描く前：開くときはドローン君の側(左)から広がり、文字・線はにじんで光る
        pre:function(_t,_reward){
            var k = this.open();
            var P = _reward ? UART_REWARD : UART_PANEL;
            ctx.save();
            if(k < 1){
                ctx.translate(P.x, 0); ctx.scale(Math.max(0.02, k), 1); ctx.translate(-P.x, 0);
                ctx.globalAlpha = (uart.openT % 4 < 2) ? 0.5 + 0.5*k : 0.3 + 0.5*k;   //開くあいだはちらつく
            }
            ctx.shadowColor = "rgba(" + this.holo + ",0.55)";
            ctx.shadowBlur = 6;
        },
        post:function(){ ctx.restore(); },
        //操作の上：走査線・ときどき走るノイズ・耐久の目盛り
        front:function(_t,_reward){
            var H = this.holo, P = _reward ? UART_REWARD : UART_PANEL, k = this.open();
            //走査線(ゆっくり下へ流れる)
            ctx.fillStyle = "rgba(" + H + "," + (0.035*k) + ")";
            for(var y=P.y + (_t*0.4 % 4); y<P.y + P.h; y+=4) ctx.fillRect(P.x, y, P.w, 1);
            //明るい帯がときどき上から下へ通る
            var band = (_t % 240)/240;
            if(band < 0.5){
                var by = P.y + band*2*P.h;
                var g = ctx.createLinearGradient(0, by - 30, 0, by);
                g.addColorStop(0, "rgba(" + H + ",0)");
                g.addColorStop(1, "rgba(" + H + "," + (0.06*k) + ")");
                ctx.fillStyle = g;
                ctx.fillRect(P.x, by - 30, P.w, 30);
            }
            //ノイズ：ときどき細い帯が横にずれる(キャンバスを写して少しずらす)
            if(_t % 170 < 5 && k >= 1){
                for(var i=0; i<3; i++){
                    var gy = P.y + titleArt.rnd(Math.floor(_t/170)*3 + i, 51)*(P.h - 12), gh = 3 + titleArt.rnd(i, 52)*8, off = (titleArt.rnd(_t, 53) - 0.5)*14;
                    ctx.drawImage(canvas, P.x*renderScale, gy*renderScale, P.w*renderScale, gh*renderScale, P.x + off, gy, P.w, gh);
                }
            }
            if(_reward) return;
            //耐久の目盛り(ドローン君の下に弧で並べる。Dead Space の背中の体力のように、画面の飾りでなく本人に付ける)
            var s = this.src(), n = game.stat("armor");
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.lineWidth = 4;
            ctx.lineCap = "butt";
            for(var i=0; i<n; i++){
                var a0 = Math.PI*(0.78 - 0.56*i/n), a1 = Math.PI*(0.78 - 0.56*(i + 1)/n) + 0.04;
                ctx.strokeStyle = "rgba(" + H + "," + (0.75*k) + ")";
                ctx.beginPath(); ctx.arc(s.x, s.y + 4, 32, a1, a0); ctx.stroke();
            }
            ctx.restore();
        }
    },
    //---------------------------------------------------------------- 案D 格納庫
    d:{
        name:"格納庫",
        sans:'"Zen Kaku Gothic New", sans-serif', serif:'"Shippori Mincho", serif',
        head:"#fff3e0",
        fill:{}, stroke:{},
        bg:function(_t,_reward){ hangar.draw(_reward); }
    }
};

uart.install();
//装備の印・ドローン君の絵は、置き換えずに元の色で描く
(function(){
    var icon0 = drawWeaponIcon;
    drawWeaponIcon = function(){ return uart.quiet(icon0, this, arguments); };
    var look = drone_around.look, look0 = look.draw;
    look.draw = function(){ return uart.quiet(look0, this, arguments); };
})();
//強化画面を包む：案の奥の絵 → 操作(色・字体を置き換えて) → 手前の絵 → 見た目の切り替えボタン
(function(){
    var draw0 = upgradeScreen.draw, update0 = upgradeScreen.update, enter0 = upgradeScreen.enter;
    upgradeScreen.enter = function(){ uart.openT = 0; return enter0.apply(this, arguments); };
    upgradeScreen.draw = function(){
        var C = uart.cur(), reward = this.state == "reward";
        uart.t++;
        uart.openT++;
        if(C){
            C.bg(uart.t, reward);
            if(C.pre) C.pre(uart.t, reward);
            uart.active = C;
            try{ draw0.apply(this, arguments); } finally{ uart.active = null; if(C.post) C.post(); }
            if(C.front) C.front(uart.t, reward);
        }else{
            draw0.apply(this, arguments);
        }
        uart.drawSwitch();
    };
    upgradeScreen.update = function(){
        if(Click == 1 && uart.switchHit(MouseX, MouseY)){ uart.next(); Click = 0; }
        return update0.apply(this, arguments);
    };
})();
