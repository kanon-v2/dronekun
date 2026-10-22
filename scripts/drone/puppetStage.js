//------------------------------------------------------------------------------
//  傀儡師戦の舞台(puppeteer.js のボスの試作に合わせて、戦いの画風と質感をそろえる)
//  傀儡師のWAVEの間だけ、戦闘画面を「人形劇の舞台」にする：
//  ・背景：Blender で描いた舞台(tools/blender/puppetStage.py。奥の書き割りと町の切り抜き stage.jpg、手前の緞帳と脚光 frame.png)。
//    方眼と街の空の代わりに描く。奥はドローン君の動きと逆へ少しずらす(奥行き)
//  ・照明：ドローン君と傀儡師をそれぞれ追うスポットライト(上から光の筋と、足もとの光だまり)・漂うほこり
//  ・色調：表示(HUD)の手前で、画面のふちを暗くし、全体を舞台の明かりの色に寄せる
//  ・ドローン君：Blender で描いた、使い込まれたブリキのからくり人形のような見た目(images/game/Drone/drone_P.png)に替える。
//    操られている同胞(人形)も同じシートで描くので一緒にそろう。舞台を出ると元の見た目に戻す
//  絵が読み込めないとき・#pup2d のときは、いつもの背景と見た目のまま。
//------------------------------------------------------------------------------
const STAGE_OVER      = 1.06;       //奥の絵の大きさ(画面の何倍。tools/blender/puppetStage.py の STAGE_OVER と同じ)
const STAGE_PARALLAX  = 0.04;       //ドローン君が動いた分の何倍、奥の絵を逆へずらすか
const STAGE_SKIN      = "P";        //舞台の間のドローン君の見た目(images/game/Drone/drone_P.png)
const STAGE_SPOT_R    = 95;         //スポットライトの光だまりの半径(px)
const STAGE_SPOT_A    = [0.30,0.10];    //光だまりの濃さ(ドローン君・傀儡師。ドローン君は暗い舞台でも見失わないよう強く)
const STAGE_BEAM_A    = [0.07,0.05];    //上から差す光の筋の濃さ
const STAGE_SPOT_COL  = ["255,214,150","200,150,255"];  //スポットライトの色(ドローン君は暖かい白・傀儡師は紫)
const STAGE_SPOT_SRC  = [[300,-80],[700,-80]];          //光の出どころ(画面の上の外)
const STAGE_SPOT_LAG  = 0.08;       //スポットライトが追いつく速さ(毎フレームの割合。少し遅れて追う)
const STAGE_DUST      = 46;         //漂うほこりの数
const STAGE_VIGNETTE  = 0.42;       //画面の四すみの暗さ
const STAGE_TONE      = "rgba(70,40,20,0.10)";  //全体に重ねる舞台の明かりの色(multiply)
//敵の弾：Blender で描いた絵(tools/blender/puppetShots.py。shots.png)。赤は漆塗りの木の玉、オレンジは真ちゅうの鈴
const STAGE_SHOTS     = { normal:0, small:1 };  //弾の種類 → shots.png のコマ
const STAGE_SHOT_SIZE = 64;         //shots.png の1コマの大きさ(px)
const STAGE_SHOT_FILL = 0.4;        //コマの幅に対する玉の半径(puppetShots.py の RADIUS と同じ)
const STAGE_SHOT_RIM  = "rgba(255,236,210,0.6)";   //弾の外の細い明るいふち(暗い幕・町の前でも見失わないように)
const STAGE_SHOT_TAIL = 4;          //弾が引く操り糸の長さ(弾の半径の何倍)
const STAGE_SHOT_TAIL_COL = "rgba(190,140,255,0.5)";
//表示(HUD)：芝居の番付のような古い紙の札と明朝の文字
//幕間：幕が進むと緞帳が下りて、上がると舞台が変わっている(第2幕「血の月」stage2.jpg・第3幕「悪夢」stage3.jpg)
const STAGE_CURTAIN   = [26,40,34];   //緞帳が下りる・下りている・上がる長さ(フレーム)。下りている間に舞台を替える
const STAGE_ACT_NAMES = ["","","第二幕　血の月","第三幕　悪夢"];    //下りた緞帳に出す幕の名前
const STAGE_FONT      = '"Shippori Mincho","Yu Mincho","YuMincho","Hiragino Mincho ProN","Noto Serif JP",serif';
const STAGE_INK       = "#3b2414";  //文字の墨の色(こげ茶)
const STAGE_CRIMSON   = "#8a1a1a";  //目立たせる文字の色(えんじ)
const STAGE_GOLD      = "#b8862a";

var puppetStage = {
    imgs:null, left:0,
    spots:[{ x:CW/2, y:CH*0.7 },{ x:CW/2, y:120 }],
    skinBefore:null,        //舞台に入る前のドローン君の見た目(戻すため)
    act:1,                  //今の舞台(1 ふつう 2 血の月 3 悪夢)
    curtain:null,           //幕間 { t：経過 to：次の舞台 }
    //今が傀儡師の舞台か(戦闘画面で、傀儡師のボスWAVE)
    on:function(){
        if(/pup2d/.test(location.hash) || versus.active || coop.active) return false;
        return page.number == 1 && isBossWave(game.wave) && bossTypeFor(game.wave) == "puppeteer";
    },
    //絵を読み込む(はじめて使うとき)。そろったら true
    ready:function(){
        if(!this.imgs){
            var self = this, names = { stage:"stage.jpg", stage2:"stage2.jpg", stage3:"stage3.jpg", frame:"frame.png", shots:"shots.png", curtain:"curtain.png" };
            this.imgs = {}; this.left = 6;
            //明朝の文字(Google Fonts)は、キャンバスで使うだけでは読み込まれないので、先に頼んでおく
            try{ if(document.fonts) document.fonts.load(this.font(16), "耐久やる気"); }catch(e){}
            for(var k in names){
                var im = new Image();
                im.onload = function(){ self.left--; };
                im.onerror = function(){ self.left = -1; };
                im.src = "images/game/puppeteer/" + names[k];
                this.imgs[k] = im;
            }
        }
        return this.left == 0;
    },
    //舞台に入る・出るときに、ドローン君の見た目を替える
    sync:function(){
        var on = this.on();
        if(on && this.skinBefore == null){
            this.skinBefore = droneSkin.current;
            droneSkin.use(STAGE_SKIN);      //絵が見つからなければ droneSkin が標準に戻す
        }else if(!on && this.skinBefore != null){
            droneSkin.use(this.skinBefore);
            this.skinBefore = null;
        }
        if(!on){ this.act = 1; this.curtain = null; }
    },
    //幕が進んだら緞帳を下ろす。下りている間は弾を消し、傀儡師と人形を止め、ドローン君は撃たない
    stepCurtain:function(){
        var b = puppeteer.alive(), C = this.curtain;
        if(!C && b){
            var want = b.stage >= 3 ? 3 : b.stage == 2 ? 2 : 1;
            if(want != this.act){ C = this.curtain = { t:0, to:want }; enemyShots.length = 0; sound.play("summon"); }
        }
        if(!C){ puppeteer.hold = 0; return; }
        var T = STAGE_CURTAIN, all = T[0] + T[1] + T[2];
        C.t++;
        puppeteer.hold = all - C.t;
        if(C.t == T[0]){ fx.shake(14); sound.play("bossDown"); }           //どすんと下りきる
        if(C.t == T[0] + Math.floor(T[1]/2)){ this.act = C.to; enemyShots.length = 0; }
        if(C.t >= all){ this.curtain = null; puppeteer.hold = 0; }
    },
    //緞帳(表示の手前)：下りるときは少し跳ね、下りている間は幕の名前
    drawCurtain:function(){
        var C = this.curtain;
        if(!C) return;
        var T = STAGE_CURTAIN, y;
        if(C.t < T[0]){ var k = C.t/T[0]; y = -CH*(1 - k*k); }
        else if(C.t < T[0] + T[1]){ var k = (C.t - T[0])/T[1]; y = -Math.abs(Math.sin(k*Math.PI*3))*18*(1 - k); }
        else{ var k = (C.t - T[0] - T[1])/T[2]; y = -CH*(k*k*(3 - 2*k)); }
        ctx.drawImage(this.imgs.curtain, 0, y, CW, CH);
        if(C.t >= T[0] && C.t < T[0] + T[1]){
            var a = Math.min(1, (C.t - T[0])/8, (T[0] + T[1] - C.t)/8);
            ctx.globalAlpha = a;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.font = this.font(34);
            ctx.lineWidth = 6; ctx.strokeStyle = "rgba(30,6,6,0.9)";
            ctx.strokeText(STAGE_ACT_NAMES[C.to], CW/2, CH/2 + y);
            ctx.fillStyle = "#e8c070"; ctx.fillText(STAGE_ACT_NAMES[C.to], CW/2, CH/2 + y);
            ctx.globalAlpha = 1; ctx.lineWidth = 1;
        }
    },

    //------------------------------------------------------------------ 描く
    //背景(battleBg.draw の代わり)：奥の舞台・スポットライト・ほこり・手前の緞帳
    drawBg:function(){
        var t = battleBg.t, I = this.imgs;
        var w = CW*STAGE_OVER, h = CH*STAGE_OVER;
        var ox = (CW - w)/2 - (drone.X - CW/2)*STAGE_PARALLAX;
        var oy = (CH - h)/2 - (drone.Y - CH/2)*STAGE_PARALLAX*0.5;
        ctx.drawImage(I[this.act > 1 ? "stage" + this.act : "stage"], ox, oy, w, h);
        this.drawSpots(t);
        this.drawDust(t);
        ctx.drawImage(I.frame, 0, 0, CW, CH);
    },
    //スポットライト：上の外から光の筋が差し、追う相手の足もとに光だまり。ゆっくりまたたく(古い灯り)
    drawSpots:function(t){
        var b = puppeteer.alive();
        var tg = [{ x:drone.X, y:drone.Y }, b ? { x:b.x, y:b.y + 60 } : null];
        ctx.globalCompositeOperation = "lighter";
        for(var k=0; k<2; k++){
            var S = this.spots[k];
            if(!tg[k]) continue;
            S.x += (tg[k].x - S.x)*STAGE_SPOT_LAG;
            S.y += (tg[k].y - S.y)*STAGE_SPOT_LAG;
            var fl = 0.9 + 0.1*Math.sin(t*0.23 + k*2) * Math.sin(t*0.051 + k);     //またたき
            var src = STAGE_SPOT_SRC[k], col = STAGE_SPOT_COL[k], R = STAGE_SPOT_R*(k ? PUP_SCALE*1.1 : 1);   //傀儡師は大きいので広く照らす
            //光の筋：出どころから光だまりの左右のふちへ広がる三角
            var dx = S.x - src[0], dy = S.y - src[1], L = Math.hypot(dx, dy) || 1, nx = -dy/L, ny = dx/L;
            var lg = ctx.createLinearGradient(src[0], src[1], S.x, S.y);
            lg.addColorStop(0, "rgba(" + col + ",0)");
            lg.addColorStop(1, "rgba(" + col + "," + (STAGE_BEAM_A[k]*fl) + ")");
            ctx.fillStyle = lg;
            ctx.beginPath();
            ctx.moveTo(src[0] - nx*8, src[1] - ny*8); ctx.lineTo(src[0] + nx*8, src[1] + ny*8);
            ctx.lineTo(S.x + nx*R*0.8, S.y + ny*R*0.8); ctx.lineTo(S.x - nx*R*0.8, S.y - ny*R*0.8);
            ctx.closePath(); ctx.fill();
            //光だまり
            var rg = ctx.createRadialGradient(S.x, S.y, 0, S.x, S.y, R);
            rg.addColorStop(0, "rgba(" + col + "," + (STAGE_SPOT_A[k]*fl) + ")");
            rg.addColorStop(0.7, "rgba(" + col + "," + (STAGE_SPOT_A[k]*fl*0.5) + ")");
            rg.addColorStop(1, "rgba(" + col + ",0)");
            ctx.fillStyle = rg;
            ctx.fillRect(S.x - R, S.y - R, R*2, R*2);
        }
        ctx.globalCompositeOperation = "source-over";
    },
    //漂うほこり：位置は時間だけで決める(乱数を使わない)。スポットライトの中ほど明るい
    drawDust:function(t){
        for(var i=0; i<STAGE_DUST; i++){
            var a = storyScreen.hash(i, 3), c = storyScreen.hash(i, 7);
            var x = (a*CW + t*(0.15 + c*0.25) + Math.sin(t*0.01 + i)*20) % CW;
            var y = (c*CH - t*(0.05 + a*0.1) % CH + CH) % CH;
            var lit = 0;
            for(var k=0; k<2; k++){
                var S = this.spots[k], d = Math.hypot(x - S.x, y - S.y);
                lit = Math.max(lit, 1 - d/(STAGE_SPOT_R*1.6));
            }
            var al = 0.12 + 0.5*Math.max(0, lit);
            ctx.fillStyle = "rgba(255,235,200," + (al*(0.5 + 0.5*Math.sin(t*0.05 + i))) + ")";
            ctx.fillRect(x, y, 1.6, 1.6);
        }
    },
    //敵の弾(shotLab.draw の頭から)。この絵の種類なら描いて true
    //後ろに細い操り糸を引き、外に細い明るいふち・内に濃いふち(どの背景の上でも、敵の弾をいちばん目立たせる決まりのまま)
    drawShot:function(_b){
        var f = STAGE_SHOTS[_b.kind];
        if(f === undefined) return false;
        var r = _b.r || 5, x = _b.x, y = _b.y;
        var sp = Math.hypot(_b.vx || 0, _b.vy || 0);
        if(sp > 0.1){
            var ux = -_b.vx/sp, uy = -_b.vy/sp, L = r*STAGE_SHOT_TAIL;
            var sway = Math.sin(battleBg.t*0.2 + x*0.05)*r*0.7;
            ctx.strokeStyle = STAGE_SHOT_TAIL_COL; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x + ux*r, y + uy*r);
            ctx.quadraticCurveTo(x + ux*L*0.6 - uy*sway, y + uy*L*0.6 + ux*sway, x + ux*L, y + uy*L);
            ctx.stroke();
        }
        ctx.fillStyle = STAGE_SHOT_RIM;
        ctx.beginPath(); ctx.arc(x, y, r + 1.8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = TIER_SHOT_EDGE;
        ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI*2); ctx.fill();
        var W = (r + 0.4)/STAGE_SHOT_FILL;
        ctx.drawImage(this.imgs.shots, f*STAGE_SHOT_SIZE, 0, STAGE_SHOT_SIZE, STAGE_SHOT_SIZE, x - W/2, y - W/2, W, W);
        return true;
    },
    //------------------------------------------------------------------ 自分の装備(形のある物だけ。光の物はそのまま)
    //実弾は真ちゅうの弾、ミサイルは紙の羽根の木のおもちゃのロケット、地雷は真ちゅうの缶にえんじの灯り、虫はぜんまいのブリキの甲虫
    drawArms:function(_a,_bullets,_missiles,_mines,_bugs){
        //地雷
        for(var i=0; i<_mines.length; i++){
            var m = _mines[i];
            var rg = ctx.createRadialGradient(m.x - 2, m.y - 2, 1, m.x, m.y, 7.5);
            rg.addColorStop(0, "#f2d38a"); rg.addColorStop(0.6, "#a87a2a"); rg.addColorStop(1, "#4a3010");
            ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(m.x, m.y, 7.5, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(60,36,10,0.8)"; ctx.beginPath(); ctx.arc(m.x, m.y, 5, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = (m.arm <= 0 && Math.floor(m.t/15) % 2 == 0) ? "#ff4a3a" : "#5a1010";
            ctx.beginPath(); ctx.arc(m.x, m.y, 2.4, 0, Math.PI*2); ctx.fill();
        }
        //虫：緑の七宝の背に、真ちゅうの脚と背中のぜんまいの鍵(羽の代わりに鍵が回る)
        for(var i=0; i<_bugs.length; i++){
            var b = _bugs[i];
            if(b.life < 90 && Math.floor(b.life/5) % 2 == 0) continue;
            ctx.strokeStyle = "#8a6a2a"; ctx.lineWidth = 1;
            for(var s=-1; s<=1; s+=2) for(var k=-1; k<=1; k++){
                var wig = Math.sin(b.t*0.8 + k)*1.5;
                ctx.beginPath(); ctx.moveTo(b.x + s*3, b.y + k*2.5); ctx.lineTo(b.x + s*7, b.y + k*3.5 + wig); ctx.stroke();
            }
            ctx.fillStyle = "#1f6a3a"; ctx.beginPath(); ctx.ellipse(b.x, b.y, 4.5, 5.5, 0, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#d8b048"; ctx.beginPath(); ctx.moveTo(b.x, b.y - 5); ctx.lineTo(b.x, b.y + 5); ctx.stroke();
            ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.ellipse(b.x - 1.5, b.y - 2, 1.5, 2.5, 0, 0, Math.PI*2); ctx.fill();
            var ka = b.t*0.3;
            ctx.strokeStyle = "#d8b048"; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(b.x - Math.cos(ka)*4, b.y - 7 - Math.sin(ka)*0.8); ctx.lineTo(b.x + Math.cos(ka)*4, b.y - 7 + Math.sin(ka)*0.8); ctx.stroke();
            ctx.lineWidth = 1;
        }
        //ミサイル：白い胴にえんじの帯・赤い先・紙の羽根。後ろに小さな煙
        for(var i=0; i<_missiles.length; i++){
            var m = _missiles[i];
            ctx.save();
            ctx.translate(m.x, m.y); ctx.rotate(m.ang);
            ctx.fillStyle = "rgba(200,190,175,0.35)";
            ctx.beginPath(); ctx.arc(-11, Math.sin(battleBg.t*0.5 + i)*1.2, 3, 0, Math.PI*2); ctx.arc(-16, 0, 2.2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#c9b48a";
            ctx.beginPath(); ctx.moveTo(-7, -2.5); ctx.lineTo(-10, -5.5); ctx.lineTo(-4, -2.5); ctx.moveTo(-7, 2.5); ctx.lineTo(-10, 5.5); ctx.lineTo(-4, 2.5); ctx.fill();
            ctx.fillStyle = "#efe4cc"; ctx.fillRect(-7, -2.5, 11, 5);
            ctx.fillStyle = STAGE_CRIMSON; ctx.fillRect(-3, -2.5, 2, 5);
            ctx.fillStyle = "#c22a1a"; ctx.beginPath(); ctx.moveTo(4, -2.5); ctx.lineTo(8.5, 0); ctx.lineTo(4, 2.5); ctx.fill();
            ctx.strokeStyle = "rgba(60,36,20,0.7)"; ctx.strokeRect(-7, -2.5, 11, 5);
            ctx.restore();
        }
        //実弾：真ちゅうの弾が筋を引く(ふちは濃い茶、芯は明るい金)
        ctx.lineCap = "round";
        for(var pass=0; pass<2; pass++){
            ctx.strokeStyle = pass == 0 ? "#4a3210" : "#f0c860";
            ctx.lineWidth = pass == 0 ? 3.4 : 1.6;
            ctx.beginPath();
            for(var i=0; i<_bullets.length; i++){
                var s = _bullets[i];
                ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx*0.8, s.y - s.vy*0.8);
            }
            ctx.stroke();
        }
        ctx.lineCap = "butt"; ctx.lineWidth = 1;
    },
    //色調：表示(HUD)の手前で、全体を舞台の明かりの色に寄せ、四すみを暗くする
    drawTone:function(){
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = STAGE_TONE;
        ctx.fillRect(0, 0, CW, CH);
        ctx.globalCompositeOperation = "source-over";
        var g = ctx.createRadialGradient(CW/2, CH*0.55, CH*0.35, CW/2, CH*0.55, CW*0.62);
        g.addColorStop(0, "rgba(10,4,8,0)");
        g.addColorStop(1, "rgba(10,4,8," + STAGE_VIGNETTE + ")");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CW, CH);
    },

    //------------------------------------------------------------------ 表示(HUD)
    font:function(_px){ return "700 " + _px + "px " + STAGE_FONT; },
    cards:{},
    //古い紙の札：黄ばんだ紙のしみ・こげ茶と金の二重のふち・四すみの菱の飾り。大きさごとに一度だけ描いて覚える
    card:function(_x,_y,_w,_h){
        var key = _w + "x" + _h, c = this.cards[key];
        if(!c){
            var S = 2;
            c = document.createElement("canvas"); c.width = _w*S; c.height = _h*S;
            var g = c.getContext("2d"); g.scale(S, S);
            var lg = g.createLinearGradient(0, 0, 0, _h);
            lg.addColorStop(0, "rgba(244,232,206,0.93)"); lg.addColorStop(1, "rgba(222,200,160,0.93)");
            g.fillStyle = lg;
            g.beginPath(); g.moveTo(5,0); g.arcTo(_w,0,_w,_h,5); g.arcTo(_w,_h,0,_h,5); g.arcTo(0,_h,0,0,5); g.arcTo(0,0,_w,0,5); g.fill();
            g.globalCompositeOperation = "source-atop";
            //しみ(決まった並び)と、ふちほど焼けた色
            for(var i=0; i<14; i++){
                var sx = storyScreen.hash(i, _w)*_w, sy = storyScreen.hash(i, _h + 3)*_h, sr = 6 + storyScreen.hash(i, 9)*18;
                var rg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
                rg.addColorStop(0, "rgba(150,100,50,0.10)"); rg.addColorStop(1, "rgba(150,100,50,0)");
                g.fillStyle = rg; g.fillRect(sx - sr, sy - sr, sr*2, sr*2);
            }
            var eg = g.createRadialGradient(_w/2, _h/2, Math.min(_w,_h)*0.3, _w/2, _h/2, Math.max(_w,_h)*0.7);
            eg.addColorStop(0, "rgba(120,70,30,0)"); eg.addColorStop(1, "rgba(120,70,30,0.28)");
            g.fillStyle = eg; g.fillRect(0, 0, _w, _h);
            g.globalCompositeOperation = "source-over";
            g.strokeStyle = "rgba(70,40,20,0.85)"; g.lineWidth = 1.2; g.strokeRect(2.5, 2.5, _w - 5, _h - 5);
            g.strokeStyle = STAGE_GOLD; g.lineWidth = 1; g.strokeRect(5, 5, _w - 10, _h - 10);
            g.fillStyle = STAGE_GOLD;
            [[5,5],[_w - 5,5],[5,_h - 5],[_w - 5,_h - 5]].forEach(function(p){
                g.beginPath(); g.moveTo(p[0], p[1] - 3.5); g.lineTo(p[0] + 3.5, p[1]); g.lineTo(p[0], p[1] + 3.5); g.lineTo(p[0] - 3.5, p[1]); g.fill();
            });
            this.cards[key] = c;
        }
        ctx.drawImage(c, _x, _y, _w, _h);
    },
    //漆の玉(弾と同じ絵)を半径 _r で
    bead:function(_x,_y,_r){
        var W = (_r + 0.4)/STAGE_SHOT_FILL;
        ctx.drawImage(this.imgs.shots, 0, 0, STAGE_SHOT_SIZE, STAGE_SHOT_SIZE, _x - W/2, _y - W/2, W, W);
    },
    //表示(mainScreen.drawHud の代わり。書いてあることは同じ)
    drawHud:function(_m){
        this.card(4, 4, 236, 90);
        this.card(CW - 324, 4, 320, 88);
        ctx.textBaseline = "middle"; ctx.textAlign = "left";
        ctx.fillStyle = STAGE_INK; ctx.font = this.font(14);
        //耐久：操り糸に通した漆の玉(なくした所は空の輪)
        ctx.fillText("耐久", 14, 20);
        ctx.strokeStyle = "rgba(110,70,150,0.7)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(52, 20); ctx.quadraticCurveTo(56 + _m.maxHp*9, 23, 60 + _m.maxHp*18, 20); ctx.stroke();
        for(var i=0; i<_m.maxHp; i++){
            var cx = 63 + i*18;
            if(i < _m.hp) this.bead(cx, 20, 6.2);
            else{
                ctx.strokeStyle = "rgba(70,40,20,0.45)"; ctx.lineWidth = 1.3;
                ctx.beginPath(); ctx.arc(cx, 20, 5.2, 0, Math.PI*2); ctx.stroke();
            }
        }
        //やる気：真ちゅうの枠の中の、こはく色のゲージ。衝撃波に要る量にえんじの刻み
        ctx.fillStyle = STAGE_INK; ctx.font = this.font(12);
        ctx.fillText("やる気", 13, 44);
        var bw = 160, gx = 56, gy = 37;
        ctx.fillStyle = "#2a1a10"; enemyArt.roundRect(gx, gy, bw, 13, 3); ctx.fill();
        var full = _m.yaruki >= YARUKI_COST, fw = (bw - 4)*_m.yaruki/YARUKI_MAX;
        var fg = ctx.createLinearGradient(0, gy + 2, 0, gy + 11);
        fg.addColorStop(0, full ? "#ffd27a" : "#a89880"); fg.addColorStop(1, full ? "#c8701a" : "#6a5a48");
        ctx.fillStyle = fg; ctx.fillRect(gx + 2, gy + 2, fw, 9);
        ctx.strokeStyle = STAGE_GOLD; ctx.lineWidth = 1.5; enemyArt.roundRect(gx, gy, bw, 13, 3); ctx.stroke();
        var tx = gx + 1 + bw*YARUKI_COST/YARUKI_MAX;
        ctx.fillStyle = STAGE_CRIMSON; ctx.fillRect(tx - 1, gy - 2, 2, 17);
        ctx.beginPath(); ctx.moveTo(tx - 4, gy - 5); ctx.lineTo(tx + 4, gy - 5); ctx.lineTo(tx, gy - 1); ctx.fill();
        //装備：真ちゅうの縁の七宝のメダル。下の細い金の線は次の攻撃までの溜まり具合
        var eq = arms.equipped();
        for(var i=0; i<eq.length; i++){
            var ix = 14 + i*30, mx = ix + 12, my = 72, w = WEAPONS[eq[i]];
            var rg = ctx.createRadialGradient(mx - 4, my - 4, 1, mx, my, 12);
            rg.addColorStop(0, "#f5d58a"); rg.addColorStop(0.6, "#b8862a"); rg.addColorStop(1, "#5a3a10");
            ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(mx, my, 12, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = w.color; ctx.beginPath(); ctx.arc(mx, my, 9.3, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.beginPath(); ctx.ellipse(mx - 3, my - 4, 5, 3, -0.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#fff"; ctx.font = this.font(12); ctx.textAlign = "center";
            ctx.fillText(w.mark, mx, my + 1);
            ctx.textAlign = "left";
            ctx.fillStyle = "rgba(70,40,20,0.25)"; ctx.fillRect(ix, 87, 24, 2);
            ctx.fillStyle = STAGE_GOLD; ctx.fillRect(ix, 87, 24*Math.max(0,Math.min(1,arms.charge(eq[i]))), 2);
        }
        var syn = activeSynergies();
        ctx.font = this.font(12); ctx.fillStyle = STAGE_CRIMSON;
        for(var i=0; i<syn.length; i++) ctx.fillText("◆" + syn[i].name, 24 + eq.length*30, 66 + i*16);
        //右上：WAVE・難易度・残り・スコア・パーツ・かすり・ジャスト
        ctx.textAlign = "right"; ctx.fillStyle = STAGE_INK; ctx.font = this.font(20);
        var wt = "WAVE " + game.wave + " / " + FINAL_WAVE;
        ctx.fillText(wt, CW - 16, 21);
        var dw = ctx.measureText(wt).width;
        ctx.font = this.font(13); ctx.fillStyle = difficulty().color;
        ctx.fillText(difficulty().name, CW - 26 - dw, 22);
        ctx.fillStyle = STAGE_INK; ctx.font = this.font(14);
        ctx.fillText((bossDebug.trial ? "敵 " + enemies.length : "残りの敵 " + (_m.toSpawn + enemies.length)) + "　SCORE " + game.score + "　パーツ " + game.parts, CW - 16, 45);
        ctx.font = this.font(12);
        if(_m.graze > 0){ ctx.fillStyle = "#2a5a9a"; ctx.fillText("かすり " + _m.graze, CW - 16, 64); }
        if(_m.just > 0){ ctx.fillStyle = "#1a6a80"; ctx.fillText("ジャスト " + _m.just, CW - 16, 80); }
        ctx.fillStyle = "#000"; ctx.textAlign = "left";
        _m.drawComboHud();
        timeStop.drawHud();
    },
    //ボスの体力(傀儡師)：札の上に、えんじの名前と、木の溝に赤いビロードのゲージ。幕の区切りに金の刻み
    //傀儡師は画面の上を大きく占めるので、画面の下(舞台のふち)に出す
    drawBossBar:function(_b){
        var w = 320, x = CW/2 - w/2, y = CH - 22;
        this.card(CW/2 - 172, y - 28, 344, 42);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = this.font(15); ctx.fillStyle = STAGE_CRIMSON;
        ctx.fillText("❖ " + _b.name + (_b.enraged ? "（怒り）" : "") + " ❖", CW/2, y - 13);
        ctx.fillStyle = "#24140a"; enemyArt.roundRect(x, y - 1, w, 11, 4); ctx.fill();
        var k = Math.max(0, _b.hp)/_b.maxHp;
        var vg = ctx.createLinearGradient(0, y, 0, y + 9);
        vg.addColorStop(0, "#d23a3a"); vg.addColorStop(0.5, "#8a1010"); vg.addColorStop(1, "#4a0606");
        ctx.fillStyle = vg; ctx.fillRect(x + 2, y + 1, (w - 4)*k, 7);
        ctx.fillStyle = STAGE_GOLD;
        PUP_STAGE_HP.concat([PUP_RALLY_HP]).forEach(function(h){ ctx.fillRect(x + 2 + (w - 4)*h - 0.5, y - 3, 1.5, 15); });
        ctx.strokeStyle = STAGE_GOLD; ctx.lineWidth = 1.2; enemyArt.roundRect(x, y - 1, w, 11, 4); ctx.stroke();
        for(var s=0; s<2; s++){
            var ex = s ? x + w + 3 : x - 3;
            ctx.fillStyle = STAGE_GOLD; ctx.beginPath(); ctx.arc(ex, y + 4.5, 4.5, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#5a3a10"; ctx.beginPath(); ctx.arc(ex, y + 4.5, 1.8, 0, Math.PI*2); ctx.fill();
        }
        ctx.lineWidth = 1; ctx.fillStyle = "#000";
    },
    //吹き出し(傀儡師・味方のせりふ)：古い紙の札に明朝の文字
    bubble:function(_x,_y,_text,_t,_ink,_dy){
        ctx.save();
        ctx.font = this.font(15);
        var w = ctx.measureText(_text).width + 26, h = 30;
        var bx = Math.max(w/2 + 6, Math.min(CW - w/2 - 6, _x)), by = _y + _dy;
        ctx.globalAlpha = Math.min(1, _t/15, (PUP_SAY_T - _t + 1)/6);
        this.card(bx - w/2, by - h/2, Math.round(w), h);
        ctx.fillStyle = _ink;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(_text, bx, by + 1);
        ctx.restore();
    }
};

//------------------------------------------------------------------------------
//  ほかのファイルの処理を包んで、舞台を足す
//------------------------------------------------------------------------------
(function(){
    var bg0 = battleBg.draw;
    battleBg.draw = function(){
        if(puppetStage.on() && puppetStage.ready()){
            //時間は battleBg と同じに進める(波・光るマスは出さない)
            var now = performance.now();
            var dt = this.last ? Math.min(3, (now - this.last)/STEP) : 1;
            this.last = now; this.t += dt;
            this.step(dt);
            puppetStage.drawBg();
            return;
        }
        return bg0.apply(this, arguments);
    };
    var hud0 = mainScreen.drawHud;
    mainScreen.drawHud = function(){
        if(puppetStage.on() && puppetStage.ready()){
            puppetStage.drawCurtain();
            puppetStage.drawTone();
            if(!puppeteer.cine()) puppetStage.drawHud(this);     //明かすムービーの間は表示を隠す
            return;
        }
        return hud0.apply(this, arguments);
    };
    var bar0 = special.drawBossBar;
    special.drawBossBar = function(){
        var b = puppeteer.alive();
        if(b && puppetStage.on() && puppetStage.ready()){ if(!puppeteer.cine()) puppetStage.drawBossBar(b); return; }
        return bar0.apply(this, arguments);
    };
    //人形の糸の強さ：木の溝に紫の糸の色、金のふち
    var gauge0 = puppeteer.gauge;
    puppeteer.gauge = function(_p){
        if(!(puppetStage.on() && puppetStage.ready())) return gauge0.apply(this, arguments);
        ctx.fillStyle = "#24140a"; enemyArt.roundRect(-15, 19, 30, 6, 2.5); ctx.fill();
        ctx.fillStyle = "rgb(" + PUP_STRING + ")"; ctx.fillRect(-14, 20, 28*Math.max(0,_p.hp)/_p.maxHp, 4);
        ctx.strokeStyle = STAGE_GOLD; ctx.lineWidth = 1; enemyArt.roundRect(-15, 19, 30, 6, 2.5); ctx.stroke();
    };
    var bubble0 = puppeteer.bubble;
    puppeteer.bubble = function(){
        if(puppetStage.on() && puppetStage.ready()) return puppetStage.bubble.apply(puppetStage, arguments);
        return bubble0.apply(this, arguments);
    };
    //自分の装備：形のある物(ふつうの実弾・ミサイル・地雷・虫)は、いつもの絵の代わりに舞台の小道具風に描く。
    //ほかの物(はね返した弾・徹甲弾・レーザー・電撃・刃・追加の装備)は、いつもの描き方のまま
    var arms0 = arms.draw;
    arms.draw = function(){
        if(!(puppetStage.on() && puppetStage.ready())) return arms0.apply(this, arguments);
        var B = this.bullets, M = this.missiles, N = this.mines, G = this.bugs;
        var plain = this.syn.pierce ? [] : B.filter(function(s){ return !s.just; });
        this.bullets = this.syn.pierce ? B : B.filter(function(s){ return s.just; });
        this.missiles = []; this.mines = this.syn.magnet ? N : []; this.bugs = [];
        try{ var r = arms0.apply(this, arguments); }
        finally{ this.bullets = B; this.missiles = M; this.mines = N; this.bugs = G; }
        puppetStage.drawArms(this, plain, M, this.syn.magnet ? [] : N, G);
        return r;
    };
    var shot0 = shotLab.draw;
    shotLab.draw = function(_b){
        if(puppetStage.on() && puppetStage.ready() && puppetStage.drawShot(_b)) return true;
        return shot0.apply(this, arguments);
    };
    var update0 = mainScreen.update;
    mainScreen.update = function(){
        if(puppetStage.on() && puppetStage.ready() && this.state == "play") puppetStage.stepCurtain();
        return update0.apply(this, arguments);
    };
    var hold0 = special.holdFire;
    special.holdFire = function(){
        if(puppetStage.curtain) return true;
        return hold0.apply(this, arguments);
    };
    var enter0 = mainScreen.enter;
    mainScreen.enter = function(){
        puppetStage.act = 1; puppetStage.curtain = null;     //戦いの始めは、いつもの舞台から
        var r = enter0.apply(this, arguments);
        puppetStage.sync();
        return r;
    };
    var change0 = page.change;
    page.change = function(i){
        var r = change0.apply(this, arguments);
        puppetStage.sync();
        return r;
    };
})();
