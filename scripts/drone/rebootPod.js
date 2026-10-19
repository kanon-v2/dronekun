//------------------------------------------------------------------------------
//  再起動ムービーの研究所の場面(reboot.js の reboot.lab)
//  暗がりの研究所。記録チップが三角形のコアに入ると、コアが始動して記録を読み込み、
//  下のポッドの新しい機体へ書き戻す。固定具が外れ、蒸気を噴いて扉が開き、ドローン君が送り出される。
//  ・コア：上向きの三角形。ふちが盛り上がり(外の斜面・稜線・内の斜面)、くぼんだ中央が光る。
//          面ごとに光の当たり方を変えて立体に見せる(左上の照明と、中央の光の照り返し)
//  ・時刻は RBP_T(フレーム。reboot.f と同じ数え方。研究所に着くのは RB_T.core)
//------------------------------------------------------------------------------
const RBP_T = { hit:440, ignite:448, lights:[472, 488, 504, 520], load:528, loaded:636, write:640,
                latch:700, eject:714, wake:758, done:782, fade:860, end:892 };
const RBP_CORE    = { x:480, y:172, ro:128, rc:104, ri:62, depth:12 };   //depth：ふちの厚み(下側に見える側面 px)   //コアの中心・外のふち・稜線・内のふち(中心から角まで px)
const RBP_POD     = { x:480, top:296, w:184, h:176 };          //ポッドの中心・上・幅・高さ
const RBP_WIN     = { w:116, h:104, y:330 };                    //ポッドの窓(扉)の幅・高さ・上
const RBP_FLOOR   = 472;            //床の高さ
const RBP_LIGHT   = [-0.45, -0.89]; //照明の向き(面からの向き。左上)
const RBP_METAL   = [58, 64, 74];   //金属の色
const RBP_GLOW    = "70,200,255";   //コアの光の色
const RBP_DRONE_IN  = 2.0;          //ポッドの中のドローン君の大きさ(倍)
const RBP_OUT_Y   = 56;             //送り出されて、ポッドの前へ下りてくる量(px)
const RBP_DRONE_OUT = 3.3;          //送り出されたあとの大きさ(倍。手前へ出てくる)
const RBP_STEAM   = 46;             //噴き出す蒸気の粒の数
const RBP_PUSH    = 0.05;           //始動からカメラが寄る量(倍)

var rebootPod = {
    end:RBP_T.end,
    fade:RBP_T.fade,
    //研究所に着いてからの通信の記録
    log:[
        [RBP_T.hit + 4,   "記録チップを受信"],
        [RBP_T.ignite + 6, "コア 始動"],
        [RBP_T.lights[3] - 4, "電源 安定"],
        [RBP_T.load + 2,  "交戦記録を読み込み"],
        [RBP_T.write + 4, "新しい機体へ書き戻し"],
        [RBP_T.latch,     "固定具を解除"],
        [RBP_T.eject,     "射出"],
        [RBP_T.wake - 6,  "起動"]
    ],
    //効果音(下の sound で鳴らす)
    sfx:[[RBP_T.hit,"spark"], [RBP_T.ignite,"ignite"], [RBP_T.lights[0],"clunk"], [RBP_T.lights[1],"clunk"], [RBP_T.lights[2],"clunk"],
         [RBP_T.lights[3],"clunk"], [RBP_T.write,"flow"], [RBP_T.latch,"latch"], [RBP_T.eject,"hiss"], [RBP_T.done,"reward"]],

    //合成の効果音(機械の音)。ゲームの効果音と同じ音量のつまみ(seGain)を通す
    sound:function(_name){
        if(_name == "reward"){ sound.play("reward"); return; }
        if(!sound.seOn || !sound.ready()) return;
        var S = sound.seGain, now = sound.ctx.currentTime;
        switch(_name){
            case "spark":   //火花
                for(var i=0; i<5; i++) sound.noise(0.05, 0.25, "highpass", 3000 + i*900, 6000, S, now + i*0.04);
                break;
            case "ignite":  //始動のうなり(低い音が持ち上がる)と、ずっと続く低いうなり
                sound.tone("sawtooth", 38, 110, 1.4, 0.12, S, now, 0.3, 700);
                sound.tone("sine", 55, 58, 6.5, 0.05, S, now + 0.4, 0.8);
                sound.noise(1.2, 0.08, "lowpass", 200, 900, S);
                break;
            case "clunk":   //照明の継電器(ガコン)
                sound.noise(0.18, 0.5, "lowpass", 500, 80, S);
                sound.tone("square", 95, 48, 0.12, 0.08, S, now, 0.002, 600);
                sound.tone("triangle", 2400, 2300, 0.05, 0.02, S, now + 0.05);
                break;
            case "flow":    //書き戻し(流れる高い音)
                sound.tone("sine", 600, 1800, 1.0, 0.03, S, now, 0.2);
                break;
            case "latch":   //固定具が外れる(ガチャン)
                sound.noise(0.06, 0.4, "bandpass", 2500, 1800, S);
                sound.tone("square", 1600, 900, 0.04, 0.05, S, now, 0.002, 4000);
                sound.noise(0.25, 0.45, "lowpass", 700, 90, S, now + 0.08);
                sound.tone("square", 140, 70, 0.15, 0.07, S, now + 0.08, 0.002, 800);
                break;
            case "hiss":    //プシュー(勢いよく噴いて、細く消える)と、送り出す音
                sound.noise(1.5, 0.42, "highpass", 2400, 900, S, now, 0);
                sound.noise(0.6, 0.25, "bandpass", 6500, 3000, S, now);
                sound.noise(0.3, 0.4, "lowpass", 400, 60, S, now + 0.15);
                sound.tone("sine", 240, 90, 0.35, 0.08, S, now + 0.15);
                break;
        }
    },

    update:function(_f){
        var look = reboot.look;
        if(_f == RBP_T.eject + 1){
            //蒸気の粒(見た目だけなので、ゲームの乱数を使わずに決まった並びで散らす)
            var seed = 11;
            function rnd(){ seed = (seed*16807) % 2147483647; return seed/2147483647; }
            this.steam = [];
            for(var i=0; i<RBP_STEAM; i++){
                var side = i % 2 ? 1 : -1, low = i % 3 == 0;
                this.steam.push({ x:RBP_POD.x + side*(low ? 70 : RBP_WIN.w/2 - 4), y:low ? RBP_FLOOR - 8 : RBP_WIN.y + 10 + rnd()*RBP_WIN.h*0.8,
                                  vx:side*(2 + rnd()*5), vy:-0.5 - rnd()*1.8, r:8 + rnd()*10, grow:0.6 + rnd()*0.8,
                                  t0:Math.floor(rnd()*14), life:50 + rnd()*40 });
            }
        }
        if(_f >= RBP_T.write) look.update(0);
        //目を覚ます：送り出されて少しして目を開け、喜ぶ
        if(_f == RBP_T.wake){ look.faceT = 0; look.mood = "normal"; }
        if(_f == RBP_T.wake + 18) look.setFace("happy", 120);
    },

    //始動の明るさ(0～1)。点くときは明滅する
    power:function(_f){
        if(_f < RBP_T.ignite) return 0;
        var t = _f - RBP_T.ignite;
        if(t < 30){
            var fl = [0.5, 0, 0.7, 0.1, 0, 0.8, 0.3, 0.9, 0.2, 1, 0.6, 1, 0.8, 1, 1];
            return 0.6*fl[Math.floor(t/2)] ;
        }
        return Math.min(1, 0.6 + (t - 30)/60);
    },
    //天井の照明(1本ずつガコンと点く)
    roomLight:function(_f){
        var n = 0;
        for(var i=0; i<RBP_T.lights.length; i++) if(_f >= RBP_T.lights[i]) n++;
        return n/RBP_T.lights.length;
    },

    draw:function(_f){
        var on = this.power(_f), room = this.roomLight(_f);
        ctx.save();
        //カメラ：始動からゆっくり寄り、射出の瞬間に揺れる
        var push = 1 + RBP_PUSH*Math.min(1, Math.max(0, (_f - RBP_T.ignite)/300));
        var sh = _f >= RBP_T.eject && _f < RBP_T.eject + 24 ? (1 - (_f - RBP_T.eject)/24)*5 : 0;
        ctx.translate(CW/2 + Math.sin(_f*2.3)*sh, CH*0.45 + Math.cos(_f*3.1)*sh);
        ctx.scale(push, push);
        ctx.translate(-CW/2, -CH*0.45);
        this.drawRoom(_f, on, room);
        this.drawHoses(_f, on);
        this.drawCore(_f, on);
        this.drawPod(_f, on, room);
        ctx.restore();
        this.drawHud(_f);
    },

    //部屋：暗い壁と床。天井の照明が点くと、光の筋が降りて壁が見えてくる。コアの光が壁と床を照らす
    drawRoom:function(_f, _on, _room){
        var C = RBP_CORE;
        ctx.fillStyle = "#030508";
        ctx.fillRect(-40, -40, CW + 80, CH + 80);
        //壁の板(照明で見えてくる)
        var wall = 0.08 + _room*0.25;
        var g = ctx.createLinearGradient(0, 0, 0, RBP_FLOOR);
        g.addColorStop(0, "rgba(40,48,60," + wall.toFixed(3) + ")");
        g.addColorStop(1, "rgba(22,28,38," + wall.toFixed(3) + ")");
        ctx.fillStyle = g;
        ctx.fillRect(-40, -40, CW + 80, RBP_FLOOR + 40);
        ctx.strokeStyle = "rgba(0,0,0," + (0.5*_room + 0.2).toFixed(3) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(var i=-1; i<11; i++){ var x = 40 + i*96; ctx.moveTo(x, -40); ctx.lineTo(x, RBP_FLOOR); }
        ctx.moveTo(-40, 300); ctx.lineTo(CW + 40, 300);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255," + (0.04*_room).toFixed(3) + ")";
        ctx.beginPath();
        for(var i=-1; i<11; i++){ var x = 42 + i*96; ctx.moveTo(x, -40); ctx.lineTo(x, RBP_FLOOR); }
        ctx.stroke();
        //床(奥へ伸びる継ぎ目)
        var fg = ctx.createLinearGradient(0, RBP_FLOOR, 0, CH + 40);
        fg.addColorStop(0, "rgba(30,36,46," + (0.4 + _room*0.4).toFixed(3) + ")");
        fg.addColorStop(1, "rgba(6,8,12,1)");
        ctx.fillStyle = fg;
        ctx.fillRect(-40, RBP_FLOOR, CW + 80, CH - RBP_FLOOR + 40);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(var i=-6; i<=6; i++){ ctx.moveTo(CW/2 + i*60, RBP_FLOOR); ctx.lineTo(CW/2 + i*190, CH + 40); }
        ctx.moveTo(-40, RBP_FLOOR + 22); ctx.lineTo(CW + 40, RBP_FLOOR + 22);
        ctx.stroke();
        ctx.strokeStyle = "rgba(160,190,220," + (0.12 + _room*0.15).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(-40, RBP_FLOOR + 0.5); ctx.lineTo(CW + 40, RBP_FLOOR + 0.5); ctx.stroke();
        //天井の照明と光の筋
        for(var i=0; i<RBP_T.lights.length; i++){
            if(_f < RBP_T.lights[i]) continue;
            var d = _f - RBP_T.lights[i];
            var k = d < 8 ? [1, 0.3, 0.9, 0.2, 1, 0.7, 1, 1][d] : 1;     //点くときに一瞬ちらつく
            var x = [150, 340, 620, 810][i];
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            var cg = ctx.createLinearGradient(0, 0, 0, RBP_FLOOR);
            cg.addColorStop(0, "rgba(170,200,230," + (0.16*k).toFixed(3) + ")");
            cg.addColorStop(1, "rgba(170,200,230,0)");
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.moveTo(x - 26, -6); ctx.lineTo(x + 26, -6); ctx.lineTo(x + 110, RBP_FLOOR); ctx.lineTo(x - 110, RBP_FLOOR);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = "rgba(170,200,230," + (0.12*k).toFixed(3) + ")";
            ctx.beginPath(); ctx.ellipse(x, RBP_FLOOR + 14, 120, 12, 0, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            ctx.fillStyle = "rgba(230,242,255," + k.toFixed(3) + ")";
            ctx.fillRect(x - 30, -6, 60, 8);
        }
        //コアの光が壁と床を照らす
        if(_on > 0){
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            var wg = ctx.createRadialGradient(C.x, C.y, 20, C.x, C.y, 420);
            wg.addColorStop(0, "rgba(" + RBP_GLOW + "," + (0.22*_on).toFixed(3) + ")");
            wg.addColorStop(1, "rgba(" + RBP_GLOW + ",0)");
            ctx.fillStyle = wg;
            ctx.fillRect(-40, -40, CW + 80, RBP_FLOOR + 40);
            var rg = ctx.createRadialGradient(C.x, RBP_FLOOR + 30, 10, C.x, RBP_FLOOR + 30, 360);
            rg.addColorStop(0, "rgba(" + RBP_GLOW + "," + (0.18*_on).toFixed(3) + ")");
            rg.addColorStop(1, "rgba(" + RBP_GLOW + ",0)");
            ctx.fillStyle = rg;
            ctx.fillRect(-40, RBP_FLOOR, CW + 80, CH - RBP_FLOOR + 40);
            ctx.restore();
        }
    },

    //三角形の頂点(中心から _r。上向き)
    tri:function(_r){
        var C = RBP_CORE, v = [];
        for(var i=0; i<3; i++){
            var a = -Math.PI/2 + i*Math.PI*2/3;
            v.push([C.x + Math.cos(a)*_r, C.y + Math.sin(a)*_r]);
        }
        return v;
    },
    path:function(_v){
        ctx.beginPath();
        ctx.moveTo(_v[0][0], _v[0][1]);
        for(var i=1; i<_v.length; i++) ctx.lineTo(_v[i][0], _v[i][1]);
        ctx.closePath();
    },
    //金属の色(_b：明るさ 0～1 くらい)
    metal:function(_b, _a){
        var k = 0.35 + _b*1.1;
        return "rgba(" + Math.round(RBP_METAL[0]*k) + "," + Math.round(RBP_METAL[1]*k) + "," + Math.round(RBP_METAL[2]*k) + "," + (_a == null ? 1 : _a) + ")";
    },

    //コア：取り付けの板と腕 → 外の斜面 → 内の斜面 → 光る中央 → 稜線の照り返し → 角の金具と表示灯
    drawCore:function(_f, _on){
        var C = RBP_CORE, O = this.tri(C.ro), R = this.tri(C.rc), I = this.tri(C.ri);
        var L = RBP_LIGHT;
        //壁に取り付ける腕と板(後ろ)
        ctx.fillStyle = this.metal(0.15);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        for(var i=0; i<3; i++){
            var a = -Math.PI/2 + i*Math.PI*2/3;
            ctx.save();
            ctx.translate(C.x, C.y); ctx.rotate(a);
            var ag = ctx.createLinearGradient(0, -14, 0, 14);
            ag.addColorStop(0, this.metal(0.35)); ag.addColorStop(0.5, this.metal(0.12)); ag.addColorStop(1, this.metal(0.03));
            ctx.fillStyle = ag;
            ctx.fillRect(C.ro - 20, -10, 40, 20);
            ctx.strokeRect(C.ro - 20, -10, 40, 20);
            ctx.restore();
        }
        //影(壁に落ちる)
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.save(); ctx.translate(14, 22); this.path(this.tri(C.ro + 6)); ctx.fill(); ctx.restore();
        //ふちの厚み(板が手前へ盛り上がっているので、下側に側面が見える)
        for(var i=0; i<3; i++){
            var j = (i + 1) % 3;
            if(O[i][1] + O[j][1] < C.y*2) continue;      //下を向いた辺だけ
            var sg = ctx.createLinearGradient(0, O[i][1], 0, O[i][1] + C.depth);
            sg.addColorStop(0, this.metal(0.18)); sg.addColorStop(1, this.metal(0.02));
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.moveTo(O[i][0], O[i][1]); ctx.lineTo(O[j][0], O[j][1]);
            ctx.lineTo(O[j][0] + 2, O[j][1] + C.depth); ctx.lineTo(O[i][0] - 2, O[i][1] + C.depth);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.stroke();
        }
        //外の斜面(稜線から外へ下る面)：照明の向きで明るさを変え、稜線ほど明るく
        for(var i=0; i<3; i++){
            var j = (i + 1) % 3;
            var mx = (O[i][0] + O[j][0])/2 - C.x, my = (O[i][1] + O[j][1])/2 - C.y, ml = Math.hypot(mx, my);
            var nx = mx/ml, ny = my/ml;
            var lit = Math.max(0, nx*L[0] + ny*L[1]);
            var cmx = (R[i][0] + R[j][0])/2, cmy = (R[i][1] + R[j][1])/2;
            var g = ctx.createLinearGradient(cmx, cmy, C.x + mx, C.y + my);
            g.addColorStop(0, this.metal(0.25 + lit*0.6 + _on*0.08));
            g.addColorStop(1, this.metal(0.05 + lit*0.25));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(O[i][0], O[i][1]); ctx.lineTo(O[j][0], O[j][1]); ctx.lineTo(R[j][0], R[j][1]); ctx.lineTo(R[i][0], R[i][1]);
            ctx.closePath(); ctx.fill();
            //継ぎ目のくぼみとボルト
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.lineWidth = 1;
            for(var b=1; b<4; b++){
                var u = b/4;
                var bx = O[i][0] + (O[j][0] - O[i][0])*u, by = O[i][1] + (O[j][1] - O[i][1])*u;
                var rx = R[i][0] + (R[j][0] - R[i][0])*u, ry = R[i][1] + (R[j][1] - R[i][1])*u;
                ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(rx, ry); ctx.stroke();
            }
        }
        //内の斜面(稜線から中央へ下る面)：照明の当たり方と、中央の光の照り返し
        for(var i=0; i<3; i++){
            var j = (i + 1) % 3;
            var mx = (O[i][0] + O[j][0])/2 - C.x, my = (O[i][1] + O[j][1])/2 - C.y, ml = Math.hypot(mx, my);
            var nx = -mx/ml, ny = -my/ml;
            var lit = Math.max(0, nx*L[0] + ny*L[1]);
            var cmx = (R[i][0] + R[j][0])/2, cmy = (R[i][1] + R[j][1])/2;
            var imx = (I[i][0] + I[j][0])/2, imy = (I[i][1] + I[j][1])/2;
            var g = ctx.createLinearGradient(cmx, cmy, imx, imy);
            g.addColorStop(0, this.metal(0.2 + lit*0.55));
            g.addColorStop(1, this.metal(0.08 + lit*0.2));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(R[i][0], R[i][1]); ctx.lineTo(R[j][0], R[j][1]); ctx.lineTo(I[j][0], I[j][1]); ctx.lineTo(I[i][0], I[i][1]);
            ctx.closePath(); ctx.fill();
            if(_on > 0){
                //中央の光が内の斜面に映る(内のふちほど強い)
                var rg = ctx.createLinearGradient(imx, imy, cmx, cmy);
                rg.addColorStop(0, "rgba(" + RBP_GLOW + "," + (0.5*_on).toFixed(3) + ")");
                rg.addColorStop(0.35, "rgba(" + RBP_GLOW + "," + (0.08*_on).toFixed(3) + ")");
                rg.addColorStop(1, "rgba(" + RBP_GLOW + ",0)");
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.fillStyle = rg;
                ctx.fill();
                ctx.restore();
            }
        }
        //光る中央
        this.drawHeart(_f, _on, I);
        //稜線：左上を向いた辺ほど強く照り返す
        for(var i=0; i<3; i++){
            var j = (i + 1) % 3;
            var mx = (R[i][0] + R[j][0])/2 - C.x, my = (R[i][1] + R[j][1])/2 - C.y, ml = Math.hypot(mx, my);
            var lit = Math.max(0, (mx*L[0] + my*L[1])/ml);
            ctx.strokeStyle = "rgba(235,244,255," + (0.15 + lit*0.75).toFixed(3) + ")";
            ctx.lineWidth = 1.5 + lit*1.5;
            ctx.beginPath(); ctx.moveTo(R[i][0], R[i][1]); ctx.lineTo(R[j][0], R[j][1]); ctx.stroke();
            //内のふちの細い光(中央が光っているとき)
            ctx.strokeStyle = "rgba(200,240,255," + (0.15 + 0.6*_on).toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(I[i][0], I[i][1]); ctx.lineTo(I[j][0], I[j][1]); ctx.stroke();
        }
        //外のふちの輪郭
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = 2;
        this.path(O); ctx.stroke();
        //角の金具と表示灯(始動すると順に灯る)
        for(var i=0; i<3; i++){
            var x = O[i][0] + (C.x - O[i][0])*0.04, y = O[i][1] + (C.y - O[i][1])*0.04;
            var mg = ctx.createRadialGradient(x - 4, y - 5, 1, x, y, 15);
            mg.addColorStop(0, this.metal(1.0)); mg.addColorStop(0.5, this.metal(0.35)); mg.addColorStop(1, this.metal(0.05));
            ctx.fillStyle = mg;
            ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.stroke();
            var lamp = _f >= RBP_T.ignite + 20 + i*10;
            ctx.fillStyle = lamp ? "rgb(150,235,255)" : "#3a1416";
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
            if(lamp) rebootPod.bloom(x, y, 14, 0.7);
            else if(Math.floor(_f/20) % 2 == 0){ ctx.fillStyle = "rgba(255,40,40,0.8)"; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fill(); }   //待機の赤い点滅
        }
        //外の斜面の表示灯(読み込みの進み具合で辺に沿って灯る)
        var prog = this.loadProg(_f);
        for(var i=0; i<3; i++){
            var j = (i + 1) % 3;
            for(var b=0; b<6; b++){
                var u = 0.2 + b*0.12;
                var x = (O[i][0] + R[i][0])/2 + ((O[j][0] + R[j][0])/2 - (O[i][0] + R[i][0])/2)*u;
                var y = (O[i][1] + R[i][1])/2 + ((O[j][1] + R[j][1])/2 - (O[i][1] + R[i][1])/2)*u;
                var lit = _f >= RBP_T.ignite + 30 && (b + 0.5)/6 <= Math.max(prog, _f >= RBP_T.loaded ? 1 : 0.0001);
                ctx.fillStyle = lit ? "rgb(140,225,255)" : "rgba(10,14,20,0.9)";
                ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
                if(lit) this.bloom(x, y, 8, 0.35);
            }
        }
        //記録チップが暗がりを降りてきて、中央へ入る
        if(_f < RBP_T.hit){
            var p = Math.max(0, (_f - RB_T.core)/(RBP_T.hit - RB_T.core));
            var py = -30 + (C.y + 30)*(1 - Math.pow(1 - p, 2));
            ctx.strokeStyle = "rgba(" + RB_COLOR + ",0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(C.x, py - 70); ctx.lineTo(C.x, py); ctx.stroke();
            reboot.drawPacket(C.x, py, 1.2, _f*0.1);
        }else if(_f < RBP_T.hit + 16){
            //入った瞬間の火花
            var d = _f - RBP_T.hit;
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = "rgba(200,240,255," + (1 - d/16).toFixed(3) + ")";
            ctx.lineWidth = 2;
            ctx.beginPath();
            for(var k=0; k<14; k++){
                var a = k*2.4 + 0.3, r0 = 6 + d*2, r1 = r0 + 10 + (k % 3)*8;
                ctx.moveTo(C.x + Math.cos(a)*r0, C.y + Math.sin(a)*r0);
                ctx.lineTo(C.x + Math.cos(a)*r1, C.y + Math.sin(a)*r1);
            }
            ctx.stroke();
            ctx.restore();
        }
        //読み込み：記録が3つの角から内の斜面をつたって中央へ流れ込む
        if(_f >= RBP_T.load && _f < RBP_T.loaded + 10){
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            for(var i=0; i<3; i++){
                for(var k=0; k<7; k++){
                    var u = ((_f - RBP_T.load)*0.025 + k/7 + i*0.13) % 1;
                    var x = R[i][0] + (C.x - R[i][0])*u, y = R[i][1] + (C.y - R[i][1])*u;
                    ctx.fillStyle = "rgba(190,240,255," + (Math.sin(u*Math.PI)*0.9).toFixed(3) + ")";
                    ctx.fillRect(x - 1.5, y - 1.5, 3 + (k % 2)*2, 3);
                }
            }
            ctx.restore();
        }
    },
    //中央：くぼみの奥が光る。ゆっくり動く光の塊と、始動の明滅
    drawHeart:function(_f, _on, _I){
        var C = RBP_CORE;
        ctx.save();
        this.path(_I);
        ctx.fillStyle = "#020306";
        ctx.fill();
        ctx.clip();
        if(_on > 0){
            var g = ctx.createRadialGradient(C.x, C.y + 4, 2, C.x, C.y + 4, C.ri*0.9);
            g.addColorStop(0, "rgba(255,255,255," + _on.toFixed(3) + ")");
            g.addColorStop(0.25, "rgba(160,235,255," + (0.95*_on).toFixed(3) + ")");
            g.addColorStop(0.7, "rgba(" + RBP_GLOW + "," + (0.6*_on).toFixed(3) + ")");
            g.addColorStop(1, "rgba(10,60,120," + (0.5*_on).toFixed(3) + ")");
            ctx.fillStyle = g;
            ctx.fillRect(C.x - C.ri, C.y - C.ri, C.ri*2, C.ri*2);
            //渦巻く光の塊(重ねると明るい)
            ctx.globalCompositeOperation = "lighter";
            for(var k=0; k<5; k++){
                var a = _f*0.03*(k % 2 ? 1 : -1.3) + k*1.3, r = 12 + k*5;
                var x = C.x + Math.cos(a)*r, y = C.y + 6 + Math.sin(a)*r*0.8;
                var bg = ctx.createRadialGradient(x, y, 1, x, y, 22);
                bg.addColorStop(0, "rgba(200,250,255," + (0.35*_on).toFixed(3) + ")");
                bg.addColorStop(1, "rgba(" + RBP_GLOW + ",0)");
                ctx.fillStyle = bg;
                ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI*2); ctx.fill();
            }
            //奥の小さな三角形の紋(ゆっくり回る)
            ctx.strokeStyle = "rgba(255,255,255," + (0.35*_on).toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            for(var k=0; k<3; k++){
                var a = -Math.PI/2 + k*Math.PI*2/3 + _f*0.01;
                var x = C.x + Math.cos(a)*20, y = C.y + 6 + Math.sin(a)*20;
                if(k == 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath(); ctx.stroke();
        }
        ctx.restore();
        if(_on > 0) this.bloom(C.x, C.y + 6, 90, 0.28*_on);
    },
    //にじむ光(重ねると明るい)
    bloom:function(_x, _y, _r, _a){
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var g = ctx.createRadialGradient(_x, _y, 0, _x, _y, _r);
        g.addColorStop(0, "rgba(" + RBP_GLOW + "," + _a.toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + RBP_GLOW + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(_x, _y, _r, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    },
    loadProg:function(_f){
        return Math.max(0, Math.min(1, (_f - RBP_T.load)/(RBP_T.loaded - RBP_T.load)));
    },

    //コアからポッドへのホース(書き戻しのとき、光が流れる)
    drawHoses:function(_f, _on){
        var C = RBP_CORE, P = RBP_POD;
        for(var s=-1; s<=1; s+=2){
            var x0 = C.x + s*62, y0 = C.y + C.ro*0.5 + C.depth - 2, x1 = P.x + s*60, y1 = P.top + 8;
            var c0x = x0 + s*6, c0y = y0 + 26, c1x = x1 + s*10, c1y = y1 - 24;
            ctx.strokeStyle = "#07090d";
            ctx.lineWidth = 13;
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(c0x, c0y, c1x, c1y, x1, y1); ctx.stroke();
            ctx.strokeStyle = this.metal(0.25);
            ctx.lineWidth = 9;
            ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.lineWidth = 2;
            ctx.stroke();
            if(_f >= RBP_T.write && _f < RBP_T.latch){
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                for(var k=0; k<4; k++){
                    var u = ((_f - RBP_T.write)*0.03 + k/4) % 1;
                    var bx = Math.pow(1-u,3)*x0 + 3*Math.pow(1-u,2)*u*c0x + 3*(1-u)*u*u*c1x + u*u*u*x1;
                    var by = Math.pow(1-u,3)*y0 + 3*Math.pow(1-u,2)*u*c0y + 3*(1-u)*u*u*c1y + u*u*u*y1;
                    this.bloom(bx, by, 10, 0.8);
                }
                ctx.restore();
            }
        }
    },

    //ポッド：金属の筒。窓(左右に開く扉)の奥に新しい機体。射出で蒸気を噴いて扉が開き、ドローン君が手前へ送り出される
    drawPod:function(_f, _on, _room){
        var P = RBP_POD, W = RBP_WIN, look = reboot.look;
        var left = P.x - P.w/2, bot = P.top + P.h;
        //床の影
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath(); ctx.ellipse(P.x, bot + 2, P.w*0.62, 12, 0, 0, Math.PI*2); ctx.fill();
        //胴(筒なので、左右のふちが暗く、左寄りに照り返し)
        var bg = ctx.createLinearGradient(left, 0, left + P.w, 0);
        bg.addColorStop(0, this.metal(0.02 + _room*0.05));
        bg.addColorStop(0.28, this.metal(0.45 + _room*0.3));
        bg.addColorStop(0.42, this.metal(0.25 + _room*0.15));
        bg.addColorStop(0.85, this.metal(0.08));
        bg.addColorStop(1, this.metal(0.02));
        ctx.fillStyle = bg;
        roundRectPath(left, P.top, P.w, P.h, 26);
        ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.stroke();
        //上下の帯
        for(var k=0; k<2; k++){
            var y = k ? bot - 22 : P.top + 4;
            var hg = ctx.createLinearGradient(0, y, 0, y + 18);
            hg.addColorStop(0, this.metal(0.5 + _room*0.3)); hg.addColorStop(1, this.metal(0.05));
            ctx.fillStyle = hg;
            ctx.fillRect(left + 6, y, P.w - 12, 18);
            ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 1; ctx.strokeRect(left + 6, y, P.w - 12, 18);
        }
        //状態の灯り(固定具が外れると赤 → 緑)
        var ready = _f >= RBP_T.latch;
        ctx.fillStyle = ready ? "rgb(90,255,150)" : (Math.floor(_f/15) % 2 ? "rgb(255,60,60)" : "rgb(120,20,20)");
        ctx.beginPath(); ctx.arc(P.x + P.w/2 - 22, P.top + 13, 3.5, 0, Math.PI*2); ctx.fill();
        //窓の奥(機体の入る室。書き戻しで光る)
        var wl = P.x - W.w/2;
        var cav = _f >= RBP_T.write ? Math.min(1, (_f - RBP_T.write)/30) : 0.08;
        var cg = ctx.createRadialGradient(P.x, W.y + W.h*0.55, 4, P.x, W.y + W.h*0.55, W.w*0.75);
        cg.addColorStop(0, "rgba(" + RBP_GLOW + "," + (0.7*cav).toFixed(3) + ")");
        cg.addColorStop(1, "rgba(4,10,20,1)");
        ctx.fillStyle = cg;
        roundRectPath(wl, W.y, W.w, W.h, 12); ctx.fill();
        //ドローン君(室の中にいる間は窓で切り抜く。送り出されると手前へ出る)
        var u = _f < RBP_T.eject + 6 ? 0 : Math.min(1, (_f - RBP_T.eject - 6)/40);
        var e = 1 - Math.pow(1 - u, 3);
        var k = RBP_DRONE_IN + (RBP_DRONE_OUT - RBP_DRONE_IN)*e;
        var hover = u >= 1 ? Math.sin((_f - RBP_T.eject - 46)*0.07)*3 : 0;
        var dx = P.x, dy = W.y + W.h*0.5 + e*RBP_OUT_Y + hover - (u > 0 && u < 1 ? Math.sin(u*Math.PI)*16 : 0);
        var showDrone = _f >= RBP_T.write;
        if(showDrone && u == 0){
            ctx.save();
            roundRectPath(wl, W.y, W.w, W.h, 12); ctx.clip();
            this.drawDrone(dx, dy, k, cav);
            ctx.restore();
        }
        //扉(ガラス入り。射出で左右に開く)
        var open = _f < RBP_T.eject ? 0 : Math.min(1, (_f - RBP_T.eject)/16);
        open = 1 - Math.pow(1 - open, 2);
        ctx.save();
        roundRectPath(left + 4, P.top + 24, P.w - 8, P.h - 48, 18); ctx.clip();
        for(var s=-1; s<=1; s+=2){
            var off = s*open*(W.w/2 + 6);
            var x = s < 0 ? wl - 6 + off : P.x + off;
            var dg = ctx.createLinearGradient(x, 0, x + W.w/2 + 6, 0);
            dg.addColorStop(0, this.metal(0.3 + _room*0.2)); dg.addColorStop(1, this.metal(0.1));
            ctx.fillStyle = dg;
            ctx.fillRect(x, W.y - 8, W.w/2 + 6, W.h + 16);
            ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
            ctx.strokeRect(x, W.y - 8, W.w/2 + 6, W.h + 16);
            //ガラス(青く透け、斜めの照り返し)
            var gx = s < 0 ? x + 8 : x + 4, gw = W.w/2 - 6;
            ctx.fillStyle = "rgba(120,200,255,0.16)";
            ctx.fillRect(gx, W.y + 4, gw, W.h - 8);
            ctx.strokeStyle = "rgba(220,240,255,0.25)";
            ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(gx + 6, W.y + W.h - 10); ctx.lineTo(gx + gw - 8, W.y + 12); ctx.stroke();
        }
        ctx.restore();
        //蒸気(プシュー)
        if(this.steam && _f > RBP_T.eject){
            for(var i=0; i<this.steam.length; i++){
                var p = this.steam[i], t = _f - RBP_T.eject - p.t0;
                if(t < 0 || t > p.life) continue;
                var q = t/p.life;
                var x = p.x + p.vx*t*(1 - q*0.6), y = p.y + p.vy*t - q*q*20;
                var r = p.r*(1 + q*3*p.grow);
                var a = (1 - q)*(q < 0.1 ? q*10 : 1)*0.55;
                var sg = ctx.createRadialGradient(x, y, 0, x, y, r);
                sg.addColorStop(0, "rgba(225,235,245," + a.toFixed(3) + ")");
                sg.addColorStop(1, "rgba(225,235,245,0)");
                ctx.fillStyle = sg;
                ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
            }
        }
        //送り出されたドローン君(手前に出る)
        if(showDrone && u > 0) this.drawDrone(dx, dy, k, 1);
        //目を覚ましたら名乗る
        if(_f >= RBP_T.done){
            ctx.globalAlpha = Math.min(1, (_f - RBP_T.done)/16);
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillStyle = "#eaf8ff";
            ctx.font = "bold 28px sans-serif";
            ctx.fillText("再起動 完了", P.x, 522);
            ctx.globalAlpha = 1;
        }
    },
    //ドローン君(暗い色なので、後ろから光を当てて輪郭を浮かび上がらせる)
    drawDrone:function(_x, _y, _k, _lit){
        var S = DRONE_SIZE*_k;
        this.bloom(_x, _y, S*0.85, 0.55*_lit);
        reboot.look.draw(_x, _y, _k);
    },

    //画面の上に重ねる表示：読み込みの進み具合と、解析の結果
    drawHud:function(_f){
        if(_f < RBP_T.load) return;
        var a = Math.min(1, (_f - RBP_T.load)/20)*(_f > RBP_T.latch ? Math.max(0, 1 - (_f - RBP_T.latch)/30) : 1);
        if(a <= 0) return;
        var p = this.loadProg(_f);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.font = "13px monospace";
        ctx.fillStyle = "rgb(" + RB_COLOR + ")";
        var x = CW - 250, y = CH - 70;
        ctx.fillText(p < 1 ? "交戦記録 読み込み中  " + Math.floor(p*100) + "%" : "交戦記録 読み込み完了", x, y);
        ctx.strokeStyle = "rgba(" + RB_COLOR + ",0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y + 12, 230, 8);
        ctx.fillStyle = "rgba(" + RB_COLOR + ",0.9)";
        ctx.fillRect(x + 1, y + 13, 228*p, 6);
        //解析の結果(読み込みにつれて、コアの左右に浮かぶ)
        var rows = analysis.report || [];
        for(var i=0; i<rows.length; i++){
            var ra = Math.min(1, Math.max(0, (p - 0.2 - i*0.18)/0.15));
            if(ra <= 0) continue;
            var r = rows[i], lft = i % 2 == 0;
            var rx = RBP_CORE.x + (lft ? -175 : 175), ry = RBP_CORE.y - 50 + Math.floor(i/2)*52;
            ctx.globalAlpha = a*ra;
            ctx.textAlign = lft ? "right" : "left";
            ctx.fillStyle = "#e4f6ff";
            ctx.font = "bold 16px sans-serif";
            ctx.fillText(r.name, rx, ry - 9);
            ctx.font = "bold 13px sans-serif";
            ctx.fillStyle = r.lvA > r.lvB ? "rgb(" + RB_COLOR + ")" : "rgba(200,230,255,0.7)";
            ctx.fillText(r.lvA > r.lvB ? "解析 Lv" + r.lvB + " → Lv" + r.lvA : "解析 Lv" + r.lvA + "  +" + Math.round(r.after - r.before), rx, ry + 10);
            ctx.strokeStyle = "rgba(" + RB_COLOR + ",0.4)";
            ctx.beginPath(); ctx.moveTo(rx + (lft ? 8 : -8), ry); ctx.lineTo(RBP_CORE.x + (lft ? -110 : 110), RBP_CORE.y - 10); ctx.stroke();
        }
        ctx.restore();
    }
};
reboot.lab = rebootPod;
