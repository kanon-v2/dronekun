//------------------------------------------------------------------------------
//  五龍の衝撃波(クリック／タップの大技)
//  1.五芒星の陣が浮かび、周りの時間が一瞬ゆっくりになる
//  2.陣の5つの頂点から5色の龍が飛び出し、うねりながら近くの敵に食らいつく
//  3.龍はドローン君のもとへ渦を巻いて戻り、大爆発で締める
//------------------------------------------------------------------------------
const DRAGON_COLORS = ["220,50,40","40,120,230","30,160,90","230,170,20","140,70,210"];  //赤・青・緑・金・紫
const DRAGON_TRAIL   = 28;   //胴体の長さ(頭が通った位置をいくつ覚えておくか)
const DRAGON_SPEED   = 9;
const DRAGON_BITE    = 2;    //食らいついた敵へのダメージ
const DRAGON_GRAZE   = 1;    //通り道の敵へのダメージ(龍1体につき敵1体に1回)
const DRAGON_REACH   = 320;  //狙う敵を探す範囲
const DRAGON_OUT_MAX = 36;   //この時間がたっても噛みつけなければ戻り始める

var dragonBlast = {
    casts:[],   //発動中の技(連打すると複数同時に出る)

    reset:function(){
        this.casts = [];
    },

    //_visual：協力プレイの相方の技を自分の画面に描くだけ(ダメージや弾消しはしない)
    cast:function(_x,_y,_visual){
        var c = { x:_x, y:_y, t:0, dragons:[], finished:false, visual:!!_visual };
        //近い敵から順に5体まで狙う。足りない分は五芒星の方向へ飛ぶ
        var taken = [];
        for(var i=0; i<5; i++){
            var a = -Math.PI/2 + i*Math.PI*2/5;
            var target = arms.nearest(_x,_y,DRAGON_REACH,taken);
            if(target) taken.push(target);
            c.dragons.push({
                x:_x + Math.cos(a)*50, y:_y + Math.sin(a)*50,  //陣の頂点から出る
                ang:a, target:target,
                px:_x + Math.cos(a)*190, py:_y + Math.sin(a)*190,  //敵がいないときの行き先
                color:DRAGON_COLORS[i], phase:"out", t:0, trail:[], hit:[], wiggle:i*1.3, done:false
            });
        }
        this.casts.push(c);
        sound.play("dragon");
    },

    update:function(){
        for(var k=this.casts.length-1; k>=0; k--){
            var c = this.casts[k];
            c.t++;
            var alive = 0;
            for(var i=0; i<c.dragons.length; i++){
                var d = c.dragons[i];
                if(d.done) continue;
                alive++;
                this.moveDragon(c,d);
            }
            //全部戻ったら(または時間切れで)大爆発
            if(!c.finished && (alive == 0 || c.t > 80)){
                c.finished = true;
                c.endT = c.t;
                this.finale(c);
            }
            if(c.finished && c.t - c.endT > 40) this.casts.splice(k,1);
        }
    },

    moveDragon:function(_c,_d){
        _d.t++;
        //行き先：出るときは敵(いなければ陣の方向)、戻るときはドローン君
        var tx, ty;
        if(_d.phase == "out"){
            if(_d.target && _d.target.dead) _d.target = null;
            tx = _d.target ? _d.target.x : _d.px;
            ty = _d.target ? _d.target.y : _d.py;
        }else{
            //戻りは少し外側を回り込むように(渦を巻いて集まる)
            //(相方の技は、技を出した場所へ戻る)
            var hx = _c.visual ? _c.x : drone.X, hy = _c.visual ? _c.y : drone.Y;
            var ra = Math.atan2(_d.y - hy, _d.x - hx) + 0.9;
            var rr = Math.max(0, Math.hypot(_d.x - hx, _d.y - hy) - 40);
            tx = hx + Math.cos(ra)*rr*0.6;
            ty = hy + Math.sin(ra)*rr*0.6;
        }
        //うねり：目標の方向に曲がりつつ、左右に揺れる
        var want = Math.atan2(ty - _d.y, tx - _d.x) + Math.sin(_d.t*0.35 + _d.wiggle)*0.55;
        _d.ang = turnTo(_d.ang, want, _d.phase == "out" ? 0.22 : 0.3);
        var sp = _d.phase == "out" ? DRAGON_SPEED : DRAGON_SPEED*1.15;
        _d.x += Math.cos(_d.ang)*sp;
        _d.y += Math.sin(_d.ang)*sp;
        _d.trail.unshift({ x:_d.x, y:_d.y });
        if(_d.trail.length > DRAGON_TRAIL) _d.trail.pop();

        //通り道の敵にダメージ(同じ敵には1回だけ)
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead || _d.hit.indexOf(e) >= 0) continue;
            if(Math.hypot(e.x - _d.x, e.y - _d.y) < e.r + 12){
                _d.hit.push(e);
                if(e == _d.target) continue;  //狙った敵は噛みつきで
                if(!_c.visual) mainScreen.hitEnemy(e,DRAGON_GRAZE,"dragon");
                fx.sparks(e.x,e.y,4,_d.color,4,2.5);
            }
        }

        if(_d.phase == "out"){
            var reached = _d.target
                ? Math.hypot(_d.target.x - _d.x, _d.target.y - _d.y) < _d.target.r + 14
                : Math.hypot(_d.px - _d.x, _d.py - _d.y) < 20;
            if(reached && _d.target){
                //食らいつく
                if(!_c.visual) mainScreen.hitEnemy(_d.target,DRAGON_BITE,"dragon");
                fx.flare(_d.x,_d.y,42,_d.color,14);
                fx.sparks(_d.x,_d.y,12,_d.color,7,3.5);
                fx.ring(_d.x,_d.y,40,_d.color,12,5);
                fx.shake(4);
                sound.play("dragonBite");
            }
            if(reached || _d.t > DRAGON_OUT_MAX){
                _d.phase = "back";
                _d.t = 0;
            }
        }else if(Math.hypot((_c.visual ? _c.x : drone.X) - _d.x, (_c.visual ? _c.y : drone.Y) - _d.y) < 26 || _d.t > 45){
            //ドローン君のもとへ戻った
            _d.done = true;
            fx.flare(_d.x,_d.y,30,_d.color,10);
        }
    },

    //締めの大爆発：ドローン君の周りに2ダメージ・弾を消す・敵を吹き飛ばす
    finale:function(_c){
        var x = _c.visual ? _c.x : drone.X, y = _c.visual ? _c.y : drone.Y, R = BLAST_RADIUS;
        if(_c.visual){
            //相方の技：見た目と音だけ
            fx.flare(x,y,R*1.2,"255,230,160",24);
            for(var i=0; i<5; i++) fx.ring(x,y,R*(0.8 + i*0.18),DRAGON_COLORS[i],24 + i*4,10 - i);
            sound.play("dragonFinale");
            return;
        }
        coop.onBlast(x,y,false);   //ゲストの大爆発はホストに弾を消してもらう
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            var dx = e.x - x, dy = e.y - y, d = Math.hypot(dx,dy) || 1;
            if(d < R + e.r){
                mainScreen.hitEnemy(e,2,"dragon");
                if(!e.boss){ e.vx = dx/d*6; e.vy = dy/d*6; }
                if(e.type == "dasher") e.timer = 0;
            }
        }
        for(var i=enemyShots.length-1; i>=0; i--){
            if(Math.hypot(enemyShots[i].x - x, enemyShots[i].y - y) < R) enemyShots.splice(i,1);
        }
        fx.flare(x,y,R*1.2,"255,230,160",24);
        //5色の衝撃波の輪が少しずつずれて広がる
        for(var i=0; i<5; i++) fx.ring(x,y,R*(0.8 + i*0.18),DRAGON_COLORS[i],24 + i*4,10 - i);
        //中心から放射状に伸びる5色の光の筋
        for(var i=0; i<15; i++){
            var a = i*Math.PI*2/15 + Math.random()*0.2;
            var len = R*(1.0 + Math.random()*0.5);
            fx.line(x + Math.cos(a)*20, y + Math.sin(a)*20, x + Math.cos(a)*len, y + Math.sin(a)*len,
                    DRAGON_COLORS[i % 5], 7, 18 + Math.floor(Math.random()*8));
        }
        fx.sparks(x,y,36,"255,200,80",10,4);
        fx.tint("255,236,190",24);
        fx.shake(16);
        sound.play("dragonFinale");
    },

    //------------------------------------------------------------------ 描画
    draw:function(){
        for(var k=0; k<this.casts.length; k++){
            var c = this.casts[k];
            this.drawCircle(c);
            for(var i=0; i<c.dragons.length; i++){
                if(!c.dragons[i].done) this.drawDragon(c.dragons[i]);
            }
        }
    },

    //五芒星の陣(出てすぐ回りながら薄れていく)
    drawCircle:function(_c){
        if(_c.t > 40) return;
        var a = 1 - _c.t/40;
        var R = 44 + Math.min(1,_c.t/6)*16;
        var rot = _c.t*0.05;
        ctx.save();
        ctx.translate(_c.x,_c.y);
        ctx.strokeStyle = "rgba(200,40,40," + a + ")";
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0,0,R + 7,0,Math.PI*2); ctx.stroke();
        //五芒星(頂点を1つ飛ばしでつなぐ)
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(var i=0; i<=5; i++){
            var p = -Math.PI/2 + rot + (i*2 % 5)*Math.PI*2/5;
            if(i == 0) ctx.moveTo(Math.cos(p)*R, Math.sin(p)*R);
            else ctx.lineTo(Math.cos(p)*R, Math.sin(p)*R);
        }
        ctx.stroke();
        //頂点に龍の色の光
        for(var i=0; i<5; i++){
            var p = -Math.PI/2 + rot + i*Math.PI*2/5;
            ctx.fillStyle = "rgba(" + DRAGON_COLORS[i] + "," + a + ")";
            ctx.beginPath(); ctx.arc(Math.cos(p)*R, Math.sin(p)*R, 5,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },

    drawDragon:function(_d){
        var tr = _d.trail;
        if(tr.length < 2) return;
        var n = tr.length;
        //胴体：首は太く尾は細い。縁取り→本体→うろこの順に重ねる
        for(var pass=0; pass<3; pass++){
            for(var i=n-1; i>=0; i--){
                var k = 1 - i/DRAGON_TRAIL;
                var r = 2 + k*8;
                if(pass == 0){
                    ctx.fillStyle = "rgba(20,20,24,0.85)";
                    ctx.beginPath(); ctx.arc(tr[i].x,tr[i].y,r + 1.8,0,Math.PI*2); ctx.fill();
                }else if(pass == 1){
                    ctx.fillStyle = "rgb(" + _d.color + ")";
                    ctx.beginPath(); ctx.arc(tr[i].x,tr[i].y,r,0,Math.PI*2); ctx.fill();
                }else if(i % 3 == 1){
                    ctx.fillStyle = "rgba(255,255,255,0.55)";
                    ctx.beginPath(); ctx.arc(tr[i].x,tr[i].y,r*0.35,0,Math.PI*2); ctx.fill();
                }
            }
        }
        //頭のまわりの光
        var hx = _d.x, hy = _d.y;
        var g = ctx.createRadialGradient(hx,hy,0,hx,hy,30);
        g.addColorStop(0,"rgba(" + _d.color + ",0.4)");
        g.addColorStop(1,"rgba(" + _d.color + ",0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(hx,hy,30,0,Math.PI*2); ctx.fill();

        //頭：進む向きに回して描く
        ctx.save();
        ctx.translate(hx,hy);
        ctx.rotate(_d.ang);
        //たてがみ(後ろになびく炎)
        var flick = Math.sin(_d.t*0.8)*2;
        ctx.fillStyle = "rgba(" + _d.color + ",0.7)";
        ctx.beginPath();
        ctx.moveTo(-4,-7); ctx.lineTo(-20,-14 + flick); ctx.lineTo(-12,-4);
        ctx.lineTo(-22,0 - flick); ctx.lineTo(-12,4); ctx.lineTo(-20,14 + flick); ctx.lineTo(-4,7);
        ctx.closePath(); ctx.fill();
        //角
        ctx.strokeStyle = "#1a1a1e";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-2,-6); ctx.lineTo(-14,-15); ctx.moveTo(-2,6); ctx.lineTo(-14,15); ctx.stroke();
        //頭(縁取りつき)とあご
        ctx.fillStyle = "#1a1a1e";
        ctx.beginPath(); ctx.ellipse(3,0,14,10,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgb(" + _d.color + ")";
        ctx.beginPath(); ctx.ellipse(3,0,12,8,0,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(8,-5); ctx.lineTo(20,-2); ctx.lineTo(20,2); ctx.lineTo(8,5); ctx.closePath(); ctx.fill();
        //ひげ
        ctx.strokeStyle = "rgba(" + _d.color + ",0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(16,-3); ctx.quadraticCurveTo(24,-10 - flick*2,32,-6 + flick);
        ctx.moveTo(16,3); ctx.quadraticCurveTo(24,10 + flick*2,32,6 - flick);
        ctx.stroke();
        ctx.lineCap = "butt";
        //目
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(7,-4,3.2,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(7,4,3.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "#e11";
        ctx.beginPath(); ctx.arc(8,-4,1.6,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(8,4,1.6,0,Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.lineWidth = 1;
    }
};
