//------------------------------------------------------------------------------
//  倒れてから再起動するまでのムービー(死に戻りの試作)
//  倒れると、ドローン君の記録が光になって研究所のコアへ帰り、新しい体で目を覚ます。
//  ゲームオーバー画面に入ったとき(ひとり用だけ)に流し、終わるとゲームオーバー画面(研究所の解析の結果)を出す。
//  クリック・タップでとばせる。壊れた姿は見せず、記録が光として帰る見せ方にする。
//  場面：記録の回収(戦場が止まり、光の粒が集まって記録チップになる) → 転送(光の通信路を研究所へ)
//        → 研究所(rebootPod.js：三角形のコアが暗がりで始動して記録を読み込み、ポッドから新しい機体が送り出される)
//  #reboot=off で流さない(見比べ用)
//------------------------------------------------------------------------------
const RB_T = { chip:0, launch:120, fly:150, core:390 };   //場面の始まり(フレーム。研究所に着いてからは rebootPod.js の RBP_T)
const RB_COLOR    = "60,190,240";   //記録の光の色
const RB_MOTES    = 48;             //集まる光の粒の数
const RB_RELAYS   = [215, 270, 325];    //中継局を通るフレーム
const RB_DIST     = 48.2;           //研究所までの距離(km。転送の間に0まで減る)
//通信の記録(左下に1行ずつ打ち出す)：[フレーム, 文]。研究所に着いてからは rebootPod.log
const RB_LOG = [
    [8,   "機体の信号が途絶"],
    [40,  "記録チップの生存を確認"],
    [78,  "交戦記録を圧縮… 100%"],
    [108, "研究所への回線を確立"],
    [160, "転送を開始"],
    [RB_RELAYS[0], "中継局 1/3 を通過"],
    [RB_RELAYS[1], "中継局 2/3 を通過"],
    [RB_RELAYS[2], "中継局 3/3 を通過"],
    [372, "研究所のコアに接続"]
];
//効果音：[フレーム, 名前]。研究所に着いてからは rebootPod.sfx
const RB_SFX = [[2,"glitch"], [RB_T.launch,"warpOut"], [RB_RELAYS[0],"blink"], [RB_RELAYS[1],"blink"], [RB_RELAYS[2],"blink"]];

var reboot = {
    active:false,
    f:0,
    off:/reboot=off/.test(location.hash),
    lab:null,       //研究所の場面({ end, fade, log, sfx, sound(名前), update(f), draw(f) }。rebootPod.js が入れる)

    start:function(){
        this.active = true;
        this.f = 0;
        this.x = Math.max(40, Math.min(CW - 40, drone.X));
        this.y = Math.max(60, Math.min(CH - 40, drone.Y));
        //倒れた瞬間の戦場を写しておく(キャンバスを写すだけなので getImageData は使わない)
        this.snap = document.createElement("canvas");
        this.snap.width = canvas.width;
        this.snap.height = canvas.height;
        try{ this.snap.getContext("2d").drawImage(canvas, 0, 0); }catch(e){}
        //集まる光の粒(見た目だけなので、ゲームの乱数を使わずに決まった並びで散らす)
        var seed = 7;
        function rnd(){ seed = (seed*16807) % 2147483647; return seed/2147483647; }
        this.motes = [];
        for(var i=0; i<RB_MOTES; i++){
            var a = rnd()*Math.PI*2, d = 50 + rnd()*160;
            this.motes.push({ a:a, d:d, t0:6 + rnd()*50, spin:(rnd() < 0.5 ? -1 : 1)*(1 + rnd()*2), s:1.5 + rnd()*2.5 });
        }
        //転送で一緒に流れる記録の札(研究所の解析で送ったもの。なければ交戦記録だけ)
        var rows = analysis.report || [];
        this.cards = rows.map(function(r){ return r.name; });
        if(this.cards.length == 0) this.cards = ["交戦記録"];
        this.look = new DroneLook();
        this.look.face = "blink"; this.look.faceT = 9999;
        this.logs = [];
        this.end = this.lab.end;
        this.fade = this.lab.fade;
    },
    finish:function(){
        this.active = false;
        this.snap = null;
    },
    update:function(){
        this.f++;
        var f = this.f;
        var lab = this.lab;
        for(var i=0; i<RB_SFX.length; i++) if(RB_SFX[i][0] == f) sound.play(RB_SFX[i][1]);
        for(var i=0; i<lab.sfx.length; i++) if(lab.sfx[i][0] == f) lab.sound(lab.sfx[i][1]);
        var log = RB_LOG.concat(lab.log);
        for(var i=0; i<log.length; i++) if(log[i][0] == f){ this.logs.push({ t:f, s:log[i][1] }); sound.play("typing"); }
        lab.update(f);
        if((Click == 1 && f > 20) || f >= this.end) this.finish();
    },

    draw:function(){
        var f = this.f;
        ctx.save();
        if(f < RB_T.fly) this.drawChip(f);
        else if(f < RB_T.core) this.drawFly(f);
        else this.lab.draw(f);
        //場面のつなぎ(暗転)
        var dark = 0;
        if(f >= RB_T.fly - 6 && f < RB_T.fly + 18) dark = f < RB_T.fly ? (f - RB_T.fly + 6)/6 : 1 - (f - RB_T.fly)/18;
        if(f >= RB_T.core - 14 && f < RB_T.core + 20) dark = f < RB_T.core ? (f - RB_T.core + 14)/14 : 1 - (f - RB_T.core)/20;
        if(dark > 0){ ctx.fillStyle = "rgba(4,8,18," + Math.min(1, dark).toFixed(3) + ")"; ctx.fillRect(0, 0, CW, CH); }
        this.drawLog(f);
        //最後は白く抜けて、ゲームオーバー画面へ
        if(f >= this.fade){
            ctx.fillStyle = "rgba(255,255,255," + Math.min(1, (f - this.fade)/(this.end - this.fade - 4)).toFixed(3) + ")";
            ctx.fillRect(0, 0, CW, CH);
        }
        ctx.fillStyle = "rgba(200,230,255,0.55)";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(inputMode == "mouse" ? "クリックでとばす" : "タップでとばす", CW - 14, CH - 10);
        ctx.restore();
    },

    //光るもの(重ねると明るくなる)
    glow:function(_x,_y,_r,_a){
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for(var i=3; i>=1; i--){
            ctx.fillStyle = "rgba(" + RB_COLOR + "," + (_a*0.18*(4 - i)).toFixed(3) + ")";
            ctx.beginPath(); ctx.arc(_x, _y, _r*i, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = "rgba(235,250,255," + Math.min(1, _a).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(_x, _y, _r*0.55, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    },
    //記録チップ(小さなひし形の光)
    drawPacket:function(_x,_y,_k,_spin){
        this.glow(_x, _y, 9*_k, 1);
        ctx.save();
        ctx.translate(_x, _y);
        ctx.rotate(_spin);
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "rgb(" + RB_COLOR + ")";
        ctx.lineWidth = 2;
        var s = 6*_k;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
    },

    //1. 記録の回収：止まった戦場の上で光の粒が集まり、チップになって空へ飛び立つ
    drawChip:function(_f){
        var up = _f > RB_T.launch ? Math.pow((_f - RB_T.launch)/(RB_T.fly - RB_T.launch), 2) : 0;
        var cam = up*CH*0.6;    //飛び立つチップを追って、戦場が下へ流れる
        //止まった戦場：色が抜けて、少し暗く沈む
        ctx.fillStyle = "#0a1424";      //戦場が下へ流れたあとの空
        ctx.fillRect(0, 0, CW, CH);
        if(this.snap) ctx.drawImage(this.snap, 0, 0, this.snap.width, this.snap.height, 0, cam, CW, CH);
        var k = Math.min(1, _f/30);
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "rgba(128,128,128," + k.toFixed(3) + ")";
        ctx.fillRect(0, 0, CW, CH);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(8,16,34," + (k*0.55 + up*0.4).toFixed(3) + ")";
        ctx.fillRect(0, 0, CW, CH);
        //集まる光の粒(ドローン君のいた所へ、渦を巻いて)
        var cx = this.x, cy = this.y + cam - up*(this.y + cam + 40);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for(var i=0; i<this.motes.length; i++){
            var m = this.motes[i], p = Math.max(0, Math.min(1, (_f - m.t0)/60));
            if(p <= 0 || p >= 1) continue;
            var e = 1 - Math.pow(1 - p, 3);
            var a = m.a + m.spin*e, d = m.d*(1 - e);
            var mx = this.x + Math.cos(a)*d, my = this.y + cam + Math.sin(a)*d;
            ctx.fillStyle = "rgba(" + RB_COLOR + "," + (Math.sin(p*Math.PI)*0.9).toFixed(3) + ")";
            ctx.fillRect(mx - m.s/2, my - m.s/2, m.s, m.s);
        }
        ctx.restore();
        //チップ：粒が集まるにつれて育ち、拍のように明滅し、最後に尾を引いて飛び立つ
        var grow = Math.min(1, Math.max(0, (_f - 20)/60));
        if(grow > 0){
            if(up > 0){
                ctx.strokeStyle = "rgba(" + RB_COLOR + ",0.6)";
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, Math.min(CH, cy + 40 + up*300)); ctx.stroke();
            }
            var beat = _f < RB_T.launch ? 0.15*Math.max(0, Math.sin(_f*0.25)) : 0.3;
            this.drawPacket(cx, cy, grow*(1 + beat), _f*0.05);
        }
    },

    //2. 転送：光の通信路を研究所へ。記録の札が一緒に流れ、中継局を通る
    drawFly:function(_f){
        var t = _f - RB_T.fly, T = RB_T.core - RB_T.fly;
        var vx = CW/2, vy = CH*0.46;     //通信路の奥(消失点)
        var g = ctx.createRadialGradient(vx, vy, 10, vx, vy, CW*0.7);
        g.addColorStop(0, "#16345a"); g.addColorStop(1, "#050a16");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CW, CH);
        //奥から手前へ流れる光の筋(放射状)
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for(var i=0; i<36; i++){
            var a = i/36*Math.PI*2 + t*0.004;
            var z = ((i*0.137 + t*0.025) % 1);
            var r0 = 30 + z*z*700, r1 = r0 + 20 + z*120;
            ctx.strokeStyle = "rgba(" + RB_COLOR + "," + (z*0.5).toFixed(3) + ")";
            ctx.lineWidth = 1 + z*2;
            ctx.beginPath();
            ctx.moveTo(vx + Math.cos(a)*r0, vy + Math.sin(a)*r0);
            ctx.lineTo(vx + Math.cos(a)*r1, vy + Math.sin(a)*r1);
            ctx.stroke();
        }
        //通信路の輪(奥から近づいてくる)
        for(var i=0; i<7; i++){
            var z = ((i/7 + t*0.012) % 1);
            ctx.strokeStyle = "rgba(" + RB_COLOR + "," + (z*0.35).toFixed(3) + ")";
            ctx.lineWidth = 1 + z*3;
            ctx.beginPath(); ctx.ellipse(vx, vy, 20 + z*z*620, 12 + z*z*380, 0, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
        //記録の札：チップのまわりを、少し遅れながら一緒に飛ぶ
        var px = vx + Math.sin(t*0.05)*14, py = vy + 70 + Math.cos(t*0.037)*8;
        for(var i=0; i<this.cards.length; i++){
            var a = i/this.cards.length*Math.PI*2 + t*0.02;
            var cxx = px + Math.cos(a)*120, cyy = py + Math.sin(a)*46;
            var come = Math.min(1, Math.max(0, (t - 10 - i*12)/30));
            if(come <= 0) continue;
            ctx.globalAlpha = come*0.95;
            ctx.font = "bold 14px sans-serif";
            var w = ctx.measureText(this.cards[i]).width + 22;
            ctx.fillStyle = "rgba(10,30,60,0.85)";
            ctx.strokeStyle = "rgba(" + RB_COLOR + ",0.9)";
            ctx.lineWidth = 1.5;
            roundRectPath(cxx - w/2, cyy - 12, w, 24, 4);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = "#dff4ff";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(this.cards[i], cxx, cyy + 1);
            ctx.globalAlpha = 1;
        }
        this.drawPacket(px, py, 1.6, _f*0.08);
        //中継局：通るたびに光の輪がはじける
        for(var i=0; i<RB_RELAYS.length; i++){
            var d = _f - RB_RELAYS[i];
            if(d < 0 || d > 30) continue;
            ctx.strokeStyle = "rgba(220,245,255," + (1 - d/30).toFixed(3) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(px, py, 20 + d*8, 0, Math.PI*2); ctx.stroke();
        }
        //研究所までの距離
        var left = RB_DIST*Math.pow(1 - Math.min(1, t/(T - 20)), 1.6);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(200,235,255,0.9)";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("研究所へ転送中", CW/2, 40);
        ctx.font = "bold 30px monospace";
        ctx.fillText(left.toFixed(1) + " km", CW/2, 74);
    },

    //通信の記録(左下に1行ずつ打ち出す)
    drawLog:function(_f){
        var list = this.logs.slice(-6);
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.font = "13px monospace";
        for(var i=0; i<list.length; i++){
            var L = list[i], n = Math.min(L.s.length, Math.floor((_f - L.t)*0.8) + 1);
            var y = CH - 24 - (list.length - 1 - i)*18;
            ctx.fillStyle = i == list.length - 1 ? "rgba(" + RB_COLOR + ",1)" : "rgba(" + RB_COLOR + ",0.55)";
            ctx.fillText("> " + L.s.slice(0, n) + (i == list.length - 1 && n < L.s.length ? "_" : ""), 16, y);
        }
    }
};

//ゲームオーバー画面に入ったら、先にムービーを流す(ひとり用だけ)。終わったら送信の結果を始めから見せる
(function(){
    var enter = gameoverScreen.enter, update = gameoverScreen.update, draw = gameoverScreen.draw;
    gameoverScreen.enter = function(){
        enter.apply(this, arguments);
        if(!coop.active && !reboot.off) reboot.start();
    };
    gameoverScreen.update = function(){
        if(reboot.active){
            reboot.update();
            if(!reboot.active) this.t = 0;
            return;
        }
        return update.apply(this, arguments);
    };
    gameoverScreen.draw = function(){
        if(reboot.active){ reboot.draw(); return; }
        return draw.apply(this, arguments);
    };
})();
