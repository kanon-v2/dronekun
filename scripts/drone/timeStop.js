//------------------------------------------------------------------------------
//  時止めワープ(ショップのバフ。クールタイム BUFF_WARP_CD 秒。デバッグのメニューで「オン」にすると、クールタイムなしで試せる)
//  ドローン君がダメージを受ける瞬間に自動で時が止まり、プレイヤーが選んだ場所へ瞬間移動する。
//  ドローン君の体は細かい粒子にほどけて飛び、移動先で組み上がる。その間、周りは止まったまま。
//  流れ：stop(時が止まる演出) → pick(移動先を選ぶ。クリック・タップで決定) → move(粒子になって移動) → end(組み上がって時が動き出す)
//  mainScreen.damage の先頭で trigger() を呼び、止まっている間は mainScreen.update から step() だけを進める。
//  粒子は、ドローン君の今のコマを別のキャンバスへ写し、その小さな四角を1つずつ描く(getImageData は使わない)
//------------------------------------------------------------------------------
const WARP_BOX = 60;            //写し取る範囲(ゲームの px。傾いたドローン君が収まる大きさ)
const WARP_CELL = 2;            //粒子1つの大きさ(ゲームの px)
const WARP_BODY_R = 27;         //この半径より外の四角は粒子にしない(ほぼ透明なので)
const WARP_STOP_TIME = 26;      //時が止まる演出の長さ(フレーム)。この間は移動先を選べない
const WARP_MOVE_TIME = 72;      //ほどけ始めてから組み上がるまで(フレーム)
const WARP_SPREAD = 0.42;       //粒子が飛び立つ時間のずれ(移動の時間に対する割合。上からほどけ、上から組み上がる)
const WARP_SCATTER = 42;        //ほどけた粒子が外へ散る距離(px)
const WARP_END_TIME = 28;       //組み上がってから時が動き出すまで(フレーム)
const WARP_GUARD = 60;          //時が動き出したあとの無敵(フレーム。点滅しない)
const WARP_COLOR = "120,220,255";   //粒子の光の色

var timeStop = {
    active:false,
    phase:"",       //stop / pick / move / end
    t:0,            //今の段階に入ってからのフレーム数
    from:null,      //ほどける場所
    to:null,        //組み上がる場所
    parts:[],       //粒子 { ox,oy:ドローン君の中での位置  d:飛び立つ時間  c1x..c2y:飛ぶ道すじの曲がり }
    snap:null,      //ドローン君の今のコマを写したキャンバス
    glow:null,      //同じ形を光の色で塗ったキャンバス(飛んでいる粒子を光らせる)
    snapScale:1,    //写したときの細かさ(renderScale)
    uses:0,         //使った回数(デバッグの表示用)
    cd:0,           //ショップで買った時止めワープが、また使えるようになるまでの残り(フレーム)
    free:false,     //今回はデバッグの「オン」で発動した(クールタイムなし)

    //デバッグのボス戦・武器試用で「オン」にしているか(クールタイムなしで何度でも)
    debugOn:function(){
        return bossDebug.active && bossDebug.warp;
    },
    //ショップで買ってあるか
    owned:function(){
        return game.buff("warp") > 0;
    },
    //今使えるか(協力プレイ・対戦では使わない。時を止めると相方の画面とずれるため)
    enabled:function(){
        if(coop.active || versus.active) return false;
        return this.debugOn() || (this.owned() && this.cd <= 0);
    },
    //時が動いている間に1コマずつクールタイムを減らす(mainScreen.update から)
    tick:function(){
        if(this.cd > 0) this.cd--;
    },
    //移動先を選んでいる間(タッチはドラッグではなく、触った場所をそのまま選ぶ。common.js の isTouchDrag)
    picking:function(){
        return this.active && this.phase == "pick";
    },
    //WAVEの始め・デバッグから戻ったとき(クールタイムも戻す)
    reset:function(){
        if(this.active) sound.timeWarp(false);
        this.active = false;
        this.phase = "";
        this.parts = [];
        this.cd = 0;
    },

    //被弾の瞬間(mainScreen.damage から)。時を止めたら true(ダメージは受けない)
    trigger:function(){
        if(this.active) return true;
        if(!this.enabled()) return false;
        this.active = true;
        this.free = this.debugOn();
        this.phase = "stop";
        this.t = 0;
        this.from = { x:drone.X, y:drone.Y };
        this.snapshot();
        mainScreen.shake = 0;   //止まっている間は揺れを進めないので、揺れたままにならないように
        sound.play("timeStop");
        sound.timeWarp(true);
        return true;
    },
    //1コマ進める。時が止まっている間は true(周りの更新はしない)
    step:function(){
        if(!this.active) return false;
        this.t++;
        switch(this.phase){
            case "stop":
                if(this.t >= WARP_STOP_TIME){ this.phase = "pick"; this.t = 0; }
                break;
            case "pick":
                if(Click == 1){
                    var p = this.target();
                    this.go(p.x, p.y);
                }
                break;
            case "move":
                if(this.t == Math.round(WARP_MOVE_TIME*WARP_SPREAD)) sound.play("warpIn");
                if(this.t >= WARP_MOVE_TIME){
                    this.phase = "end";
                    this.t = 0;
                    drone.X = drone.preX = this.to.x;
                    drone.Y = drone.preY = this.to.y;
                }
                break;
            case "end":
                if(this.t >= WARP_END_TIME) this.finish();
                break;
        }
        return true;
    },
    //移動先(画面の外には出ない)
    target:function(){
        return { x:Math.max(drone.R, Math.min(CW - drone.R, MouseX)), y:Math.max(drone.R, Math.min(CH - drone.R, MouseY)) };
    },
    //移動先が決まった：粒子の道すじを作る
    go:function(_x,_y){
        this.to = { x:_x, y:_y };
        this.phase = "move";
        this.t = 0;
        this.uses++;
        this.parts = [];
        var n = WARP_BOX/WARP_CELL;
        for(var j=0; j<n; j++){
            for(var i=0; i<n; i++){
                var ox = (i + 0.5)*WARP_CELL - WARP_BOX/2, oy = (j + 0.5)*WARP_CELL - WARP_BOX/2;
                if(Math.hypot(ox,oy) > WARP_BODY_R) continue;
                //上からほどける(少しばらつかせて、線ではなく砂のように崩れる)
                var d = ((oy + WARP_BODY_R)/(WARP_BODY_R*2)*0.75 + Math.random()*0.25)*WARP_SPREAD;
                //ほどけた粒子は外へ散り、移動先では別の向きから集まってくる
                var a1 = Math.atan2(oy,ox) + (Math.random() - 0.5)*1.2, r1 = WARP_SCATTER*(0.4 + Math.random()*0.8);
                var a2 = Math.random()*Math.PI*2, r2 = WARP_SCATTER*(0.3 + Math.random()*0.9);
                this.parts.push({ ox:ox, oy:oy, d:d, sx:i*WARP_CELL, sy:j*WARP_CELL,
                                  c1x:Math.cos(a1)*r1, c1y:Math.sin(a1)*r1, c2x:Math.cos(a2)*r2, c2y:Math.sin(a2)*r2 });
            }
        }
        sound.play("warpOut");
    },
    finish:function(){
        this.active = false;
        this.phase = "";
        this.parts = [];
        mainScreen.guard = WARP_GUARD;
        if(!this.free) this.cd = BUFF_WARP_CD*60;
        //目標も移動先へ(タッチのドラッグは目標を動かすので。マウスは次に動かしたときにマウスの位置へ戻る)
        MouseX = drone.X; MouseY = drone.Y;
        sound.timeWarp(false);
        sound.play("timeResume");
    },

    //ドローン君の今のコマを写し取る(ゲームと同じ描き方で、別のキャンバスへ)
    snapshot:function(){
        var rs = renderScale, S = Math.ceil(WARP_BOX*rs);
        if(!this.snap){
            this.snap = document.createElement("canvas");
            this.glow = document.createElement("canvas");
        }
        this.snap.width = this.snap.height = S;
        this.glow.width = this.glow.height = S;
        this.snapScale = rs;
        var g = this.snap.getContext("2d");
        g.setTransform(rs,0,0,rs,0,0);
        //DroneLook.draw は全体の ctx に描くので、写す間だけ差し替える
        var keep = ctx;
        ctx = g;
        try{ drone.look.draw(WARP_BOX/2, WARP_BOX/2); }
        finally{ ctx = keep; }
        //光の形：同じ絵の上だけを光の色で塗る
        var h = this.glow.getContext("2d");
        h.drawImage(this.snap,0,0);
        h.globalCompositeOperation = "source-atop";
        h.fillStyle = "rgb(" + WARP_COLOR + ")";
        h.fillRect(0,0,S,S);
    },

    //粒子1つの今の位置(_u：0でほどける前、1で組み上がった後)
    pos:function(_p,_u){
        var fx = this.from.x + _p.ox, fy = this.from.y + _p.oy;
        var tx = this.to.x + _p.ox, ty = this.to.y + _p.oy;
        if(_u <= 0) return { x:fx, y:fy };
        if(_u >= 1) return { x:tx, y:ty };
        var e = _u < 0.5 ? 2*_u*_u : 1 - 2*(1 - _u)*(1 - _u);    //ゆっくり出て、速く飛び、ゆっくり着く
        var k = 1 - e;
        //3次ベジェ曲線：外へ散る → 移動先のまわりから集まる
        var x = k*k*k*fx + 3*k*k*e*(fx + _p.c1x) + 3*k*e*e*(tx + _p.c2x) + e*e*e*tx;
        var y = k*k*k*fy + 3*k*k*e*(fy + _p.c1y) + 3*k*e*e*(ty + _p.c2y) + e*e*e*ty;
        return { x:x, y:y };
    },
    //粒子の進み具合(0～1)
    progress:function(_p){
        return Math.max(0, Math.min(1, (this.t/WARP_MOVE_TIME - _p.d)/(1 - WARP_SPREAD)));
    },

    //------------------------------------------------------------- 描画
    //時が止まっている強さ(0～1。始まりと終わりで変わる)
    power:function(){
        if(this.phase == "stop") return Math.min(1, this.t/(WARP_STOP_TIME*0.6));
        if(this.phase == "end") return 1 - this.t/WARP_END_TIME;
        return 1;
    },
    //戦闘画面の、ドローン君を描くところで呼ぶ(周りの色を抜いてから、ドローン君か粒子を描く)
    draw:function(){
        var p = this.power();
        ctx.save();
        //周りの色を抜いて、暗く青く(時が止まった世界。光る粒子が目立つように)
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "rgba(128,128,128," + (0.92*p) + ")";
        ctx.fillRect(-40,-40,CW + 80,CH + 80);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(15,25,55," + (0.45*p) + ")";
        ctx.fillRect(-40,-40,CW + 80,CH + 80);
        //時が止まる瞬間：ドローン君から色の反転した輪が広がる
        if(this.phase == "stop"){
            var u = this.t/WARP_STOP_TIME;
            var r = 20 + (1 - (1 - u)*(1 - u))*1100;
            ctx.globalCompositeOperation = "difference";
            ctx.fillStyle = "rgba(255,255,255," + (0.9*(1 - u)) + ")";
            ctx.beginPath(); ctx.arc(this.from.x,this.from.y,r,0,Math.PI*2); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
        }
        ctx.restore();

        if(this.phase == "move"){ this.drawParts(); return; }
        drone.draw();
        if(this.phase == "pick") this.drawPick();
        if(this.phase == "end") this.drawArrive();
    },
    //移動先を選んでいる間：ドローン君のまわりの輪・移動先の照準と、うっすらしたドローン君の影
    drawPick:function(){
        var q = this.target(), x0 = this.from.x, y0 = this.from.y;
        var pulse = 0.5 + 0.5*Math.sin(this.t*0.15);
        ctx.save();
        ctx.strokeStyle = "rgba(" + WARP_COLOR + "," + (0.5 + 0.4*pulse) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x0,y0,28 + 4*pulse,0,Math.PI*2); ctx.stroke();
        //道すじの点線
        ctx.setLineDash([6,6]);
        ctx.lineDashOffset = -this.t*0.6;
        ctx.strokeStyle = "rgba(" + WARP_COLOR + ",0.8)";
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(q.x,q.y); ctx.stroke();
        //照準(回る破線の輪と十字)
        ctx.translate(q.x,q.y);
        ctx.rotate(this.t*0.03);
        ctx.setLineDash([10,7]);
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0,0,26,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle = "rgb(" + WARP_COLOR + ")";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0,0,26,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(-34,0); ctx.lineTo(-18,0); ctx.moveTo(18,0); ctx.lineTo(34,0);
        ctx.moveTo(0,-34); ctx.lineTo(0,-18); ctx.moveTo(0,18); ctx.lineTo(0,34);
        ctx.stroke();
        ctx.restore();
        //移動先に、組み上がるドローン君の影
        var s = WARP_BOX, rs = this.snapScale;
        ctx.globalAlpha = 0.25 + 0.15*pulse;
        ctx.drawImage(this.glow, 0, 0, s*rs, s*rs, q.x - s/2, q.y - s/2, s, s);
        ctx.globalAlpha = 1;
    },
    //粒子：絵の小さな四角を、それぞれの道すじの上に描く。飛んでいる間は光る
    drawParts:function(){
        var rs = this.snapScale, c = WARP_CELL, cs = c*rs;
        var list = this.parts, flying = [];
        //ほどける前・組み上がった後の粒子は、そのままの絵として描く(すき間が出ないよう少し大きく)
        for(var i=0; i<list.length; i++){
            var p = list[i], u = this.progress(p);
            var q = this.pos(p,u);
            if(u > 0 && u < 1){ flying.push({ p:p, u:u, x:q.x, y:q.y }); continue; }
            ctx.drawImage(this.snap, p.sx*rs, p.sy*rs, cs, cs, q.x - c/2 - 0.25, q.y - c/2 - 0.25, c + 0.5, c + 0.5);
        }
        //移動先：粒子が集まってくる光の輪(だんだん縮む)
        var k = this.t/WARP_MOVE_TIME;
        ctx.save();
        ctx.strokeStyle = "rgba(" + WARP_COLOR + "," + (0.6*Math.sin(Math.PI*k)) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.to.x,this.to.y,8 + 60*(1 - k),0,Math.PI*2); ctx.stroke();
        //飛んでいる粒子の尾(まとめて1本の線として描く)
        ctx.strokeStyle = "rgba(" + WARP_COLOR + ",0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(var i=0; i<flying.length; i++){
            var f = flying[i], b = this.pos(f.p, Math.max(0, f.u - 0.06));
            ctx.moveTo(b.x,b.y); ctx.lineTo(f.x,f.y);
        }
        ctx.stroke();
        //飛んでいる粒子：絵のかけらを少し薄く、その上に光の色を重ねて光らせる
        for(var i=0; i<flying.length; i++){
            var f = flying[i], w = Math.sin(Math.PI*f.u);
            var sz = c*(1 + 0.8*w);
            ctx.globalAlpha = 1 - 0.5*w;
            ctx.drawImage(this.snap, f.p.sx*rs, f.p.sy*rs, cs, cs, f.x - sz/2, f.y - sz/2, sz, sz);
        }
        ctx.globalCompositeOperation = "lighter";
        for(var i=0; i<flying.length; i++){
            var f = flying[i], w = Math.sin(Math.PI*f.u);
            var sz = c*(1.5 + 1.5*w);
            ctx.globalAlpha = 0.9*w;
            ctx.drawImage(this.glow, f.p.sx*rs, f.p.sy*rs, cs, cs, f.x - sz/2, f.y - sz/2, sz, sz);
        }
        ctx.restore();
    },
    //組み上がった直後：ドローン君が光って、光の輪が広がる
    drawArrive:function(){
        var u = this.t/WARP_END_TIME, s = WARP_BOX, rs = this.snapScale;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.8*(1 - u);
        ctx.drawImage(this.glow, 0, 0, s*rs, s*rs, this.to.x - s/2, this.to.y - s/2, s, s);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(" + WARP_COLOR + "," + (0.8*(1 - u)) + ")";
        ctx.lineWidth = 3*(1 - u) + 1;
        ctx.beginPath(); ctx.arc(this.to.x,this.to.y,20 + 70*u,0,Math.PI*2); ctx.stroke();
        ctx.restore();
    },
    //HUD：装備のアイコンの下に、使えるか・あと何秒かを出す(ショップで買ったときだけ)
    drawHud:function(){
        if(!this.owned() || coop.active || versus.active) return;
        var ready = this.cd <= 0, x = 14, y = 104, w = 84;
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = ready ? "#1a8fb0" : "#999";
        ctx.fillText("時止め " + (ready ? "OK" : Math.ceil(this.cd/60) + "秒"), x, y);
        //たまり具合のゲージ
        ctx.fillStyle = "#ddd";
        ctx.fillRect(x, y + 9, w, 3);
        ctx.fillStyle = ready ? "rgb(" + WARP_COLOR + ")" : "#888";
        ctx.fillRect(x, y + 9, w*(1 - this.cd/(BUFF_WARP_CD*60)), 3);
        ctx.restore();
    },
    //画面の上の案内(揺れ・拡大の外で描く)
    drawUi:function(){
        if(!this.active) return;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = this.power();
        ctx.fillStyle = "rgba(10,20,40,0.6)";
        ctx.fillRect(0, CH/2 - 150, CW, 40);
        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "rgb(" + WARP_COLOR + ")";
        var msg = this.phase == "pick" ? "時間停止 ― ワープ先を" + (inputMode == "touch" ? "タップ" : "クリック")
                : this.phase == "move" ? "ワープ中……" : this.phase == "end" ? "時は動き出す" : "時間停止";
        ctx.fillText(msg, CW/2, CH/2 - 130);
        ctx.restore();
        ctx.fillStyle = "#000";
    }
};
