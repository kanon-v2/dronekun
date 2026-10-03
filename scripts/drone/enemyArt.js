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
    glass:"#9fc3dc"     //ヘリの窓
};

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
        var aiming = _e.timer > 0;
        //突進の予告線(だんだん濃く)
        if(aiming){
            ctx.strokeStyle = "rgba(220,40,40," + (0.15 + 0.25*(1 - _e.timer/60)) + ")";
            ctx.setLineDash([6,6]);
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(_e.aimX*1200,_e.aimY*1200); ctx.stroke();
            ctx.setLineDash([]);
        }
        var a = Math.atan2(aiming ? _e.aimY : _e.vy, aiming ? _e.aimX : _e.vx);
        ctx.rotate(a);
        //噴射：突進中は長い炎、予告中は力をためて小さく明滅
        var moving = !aiming && (_e.vx || _e.vy);
        if(moving || aiming){
            var fl = moving ? 9 + Math.random()*6 : (Math.floor(_e.t/3) % 2 ? 4 : 2);
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
