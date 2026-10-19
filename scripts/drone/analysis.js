//------------------------------------------------------------------------------
//  研究所の解析(死に戻りの試作)
//  ドローン君の戦いの記録は、通信で研究所のコアへ送られている。倒れると、その周に
//  当てられた敵の記録が届いて解析が進み、次の周からその敵の攻撃が見えやすくなる。
//  ・記録：被弾のたびに、当てた敵の種類を覚える(mainScreen.updateEnemies が弾に撃った敵の種類 b.src を付ける)
//  ・送信：倒れたとき(send)。とどめを刺した敵は多く、ほかに当ててきた敵は少し進む
//  ・効き目：Lv1 その敵へのダメージが増え、薄い印が付く／Lv2 当たりそうな弾が光り、突進の通り道が見える／
//            Lv3 当たる所まで線が出て、フェイントを見破る
//  記録は localStorage の dronekun_lab(周をまたいで残る。協力プレイ・対戦・デバッグのメニューでは進まない)
//  #lab=数(0～3) で開くと、記録にかかわらず全部の敵をその段階にする(見比べ用。覚えない)
//------------------------------------------------------------------------------
const LAB_KEY        = "dronekun_lab";
const LAB_NEED       = [3, 7, 12];      //Lv1・Lv2・Lv3 になるのに要る解析の量(累計)
const LAB_KILL       = 3;               //とどめを刺した敵に足す量
const LAB_HIT        = 1;               //ほかに当ててきた敵に、1回あたり足す量
const LAB_HIT_MAX    = 2;               //とどめ以外の敵に、1周で足す量の上限
const LAB_DMG        = [1, 1.1, 1.2, 1.3];  //段階ごとの、その敵へのダメージの倍率
const LAB_LOOK       = 80;              //当たりそうな弾を探す先の長さ(フレーム)
const LAB_MARGIN     = 6;               //「当たりそう」に含める余り(px。弾の大きさ＋当たり判定に足す)
const LAB_FOCUS      = 3;               //当たりそうな弾に印を付ける数(当たるまでが短い順)
const LAB_FOCUS_LINE = 2;               //そのうち、当たる所まで線と×を出す数(Lv3)
const LAB_LINE_W     = 1.75;            //線と×の太さ(px)
const LAB_LINE_HALO  = 2;               //白いふちどりが線より太い分(px)
const LAB_CROSS      = 9;               //×の大きさ(px。中心から角まで)
const LAB_CROSS_GAP  = 0.45;            //×の中心の空き(大きさに対する割合)
const LAB_COLOR_DEEP = "0,120,200";     //予測の線・輪の色(印より濃い水色)
const LAB_DASH_LEN   = 420;             //突進の通り道を見せる長さ(px)
const LAB_COLOR      = "40,170,230";    //解析の色(研究所の通信の水色)
//段階が上がったときに出す、できるようになったこと
const LAB_UNLOCK = ["", "弱点を解析：与えるダメージ +10%", "行動を予測：当たりそうな攻撃が光る", "完全に解析：当たる所・フェイントが見える"];
//解析の名前(敵の種類 → 名前)。同じ相手のものはまとめる(分身はクロノ、砲台は天蓋母艦)
const LAB_NAMES = {
    bug:"虫", dasher:"突進", shooter:"射撃", tank:"重装", spinner:"回転砲台", bomber:"自爆",
    kin:"同胞", mdrone:"無機質なドローン", heli:"ヘリ", panzer:"戦車",
    queen:"女王蜂", fortress:"移動要塞", canopy:"天蓋母艦", kai:"ドローン君改", chrono:"クロノ", gunship:"強襲ヘリ"
};
const LAB_SAME = { chronoClone:"chrono", pod:"canopy" };

var analysis = {
    data:{},        //種類 → 解析の量(累計)
    hits:{},        //この周に当ててきた回数(種類 → 回数)
    cur:null,       //今動かしている敵(mainScreen.updateEnemies)
    by:null,        //当たった弾を撃った敵の種類(当たる直前に入れる)
    report:null,    //倒れたときに送った結果(ゲームオーバー画面で見せる)
    force:-1,       //#lab=数 の段階(-1 は記録どおり)
    wave:0, shown:{},   //このWAVEで「解析済み」を出した種類

    load:function(){
        var m = /lab=(\d)/.exec(location.hash);
        if(m) this.force = Math.min(3, Number(m[1]));
        try{ this.data = JSON.parse(localStorage.getItem(LAB_KEY)) || {}; }catch(e){ this.data = {}; }
    },
    write:function(){
        try{ localStorage.setItem(LAB_KEY, JSON.stringify(this.data)); }catch(e){}
    },
    //敵 → 解析の種類(名前のないものは数えない)
    keyOf:function(_e){
        if(!_e) return null;
        var k = LAB_SAME[_e.type] || _e.type;
        return LAB_NAMES[k] ? k : null;
    },
    levelOf:function(_key){
        if(!_key) return 0;
        if(this.force >= 0) return this.force;
        var p = this.data[_key] || 0, lv = 0;
        while(lv < LAB_NEED.length && p >= LAB_NEED[lv]) lv++;
        return lv;
    },
    //ふつうに遊んでいるときだけ記録し、効かせる
    active:function(){
        return !coop.active && !versus.active && !bossDebug.active;
    },
    lv:function(_e){
        if(!this.active() && this.force < 0) return 0;
        return this.levelOf(this.keyOf(_e));
    },

    //_e が動く間に増えた弾に、撃った敵の種類を付ける。はじめて見えたら「解析済み」と出す
    tag:function(_e,_from){
        var k = this.keyOf(_e);
        if(!k) return;
        for(var i=_from; i<enemyShots.length; i++) if(!enemyShots[i].src) enemyShots[i].src = k;
        if(game.wave != this.wave){ this.wave = game.wave; this.shown = {}; }
        var lv = this.lv(_e);
        if(lv > 0 && !this.shown[k] && _e.x > 0 && _e.x < CW && _e.y > 0 && _e.y < CH){
            this.shown[k] = true;
            popup(_e.x, Math.max(20, _e.y - _e.r - 14), "解析済み Lv" + lv, "rgb(" + LAB_COLOR + ")");
        }
    },
    //被弾した(mainScreen.damage で耐久が減ったとき)。当てた敵を覚える
    hit:function(_k){
        this.last = _k;
        if(_k) this.hits[_k] = (this.hits[_k] || 0) + 1;
    },
    //倒れた：この周の記録を研究所へ送る
    send:function(){
        var killer = this.last, rows = [];
        for(var k in this.hits){
            var add = k == killer ? LAB_KILL : Math.min(LAB_HIT_MAX, this.hits[k]*LAB_HIT);
            var before = this.data[k] || 0;
            var lvB = this.levelOf(k);
            this.data[k] = Math.min(LAB_NEED[LAB_NEED.length - 1], before + add);
            rows.push({ key:k, name:LAB_NAMES[k], kill:k == killer, before:before, after:this.data[k],
                        lvB:lvB, lvA:this.levelOf(k), hits:this.hits[k] });
        }
        //とどめを刺した敵を先に、あとは当てた回数の多い順
        rows.sort(function(a,b){ return (b.kill - a.kill) || (b.hits - a.hits); });
        this.report = rows.slice(0, 4);
        this.hits = {};
        this.write();
    },
    //周の始まりに、この周の記録を空にする
    newRun:function(){
        this.hits = {};
        this.report = null;
        this.last = null;
    },

    //敵の印(mainScreen.drawEnemy のあと)：薄い角の印。Lv2 から突進の通り道、Lv3 はフェイントを見破る
    drawMark:function(_e){
        var lv = this.lv(_e);
        if(lv <= 0 || _e.dead || _e.phased || _e.clone) return;
        var R = _e.r + 7, L = Math.min(9, R*0.5);
        ctx.save();
        ctx.strokeStyle = "rgba(" + LAB_COLOR + ",0.55)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for(var i=0; i<4; i++){
            var sx = i % 2 ? 1 : -1, sy = i < 2 ? -1 : 1;
            ctx.moveTo(_e.x + sx*R, _e.y + sy*(R - L));
            ctx.lineTo(_e.x + sx*R, _e.y + sy*R);
            ctx.lineTo(_e.x + sx*(R - L), _e.y + sy*R);
        }
        ctx.stroke();
        //フェイント(突進・女王蜂)を見破る
        if(lv >= 3 && _e.fake){
            ctx.fillStyle = "rgb(" + LAB_COLOR + ")";
            ctx.font = "bold 13px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText("フェイント", _e.x, _e.y - R - 2);
        }else if(lv >= 2 && _e.type == "dasher" && _e.tell == TELL.lock && !_e.countered){
            //構えて止まった突進の通り道
            ctx.setLineDash([8, 6]);
            ctx.lineDashOffset = -_e.t*0.8;
            ctx.strokeStyle = "rgba(" + LAB_COLOR + ",0.5)";
            ctx.lineWidth = _e.r*2;
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(_e.x, _e.y);
            ctx.lineTo(_e.x + _e.aimX*LAB_DASH_LEN, _e.y + _e.aimY*LAB_DASH_LEN);
            ctx.stroke();
        }
        ctx.restore();
    },
    //当たりそうな弾(弾の下に描く)：まっすぐ進むとして、LAB_LOOK フレームのうちにドローン君の芯に届くもの。
    //弾が多いと全部に付けても読めないので、当たるまでが短い順に LAB_FOCUS 発だけ(線と×は LAB_FOCUS_LINE 発)
    drawShots:function(){
        this.focus = [];
        if(mainScreen.state != "play" && mainScreen.state != "start") return;
        if(!this.active() && this.force < 0) return;
        var px = drone.X, py = drone.Y, list = [];
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(!b.src || b.behind) continue;
            var lv = this.force >= 0 ? this.force : this.levelOf(b.src);
            if(lv < 2) continue;
            var vv = b.vx*b.vx + b.vy*b.vy;
            if(vv < 0.01) continue;
            var t = ((px - b.x)*b.vx + (py - b.y)*b.vy)/vv;
            if(t < 0 || t > LAB_LOOK) continue;     //離れていく弾・まだ遠い弾
            var cx = b.x + b.vx*t, cy = b.y + b.vy*t;
            var r = b.r || 5;
            if(Math.hypot(cx - px, cy - py) > r + HIT_CORE + LAB_MARGIN) continue;
            list.push({ b:b, t:t, cx:cx, cy:cy, r:r, lv:lv });
        }
        list.sort(function(a,c){ return a.t - c.t; });
        this.focus = list.slice(0, LAB_FOCUS);
        //弾の輪(弾の下。いちばん近い弾は脈打つ)
        ctx.save();
        for(var i=this.focus.length - 1; i>=0; i--){
            var o = this.focus[i], st = this.style(o, i);
            ctx.beginPath();
            ctx.arc(o.b.x, o.b.y, o.r + 5 + (i == 0 ? this.pulse()*4 : 0), 0, Math.PI*2);
            ctx.strokeStyle = st.halo; ctx.lineWidth = 5; ctx.stroke();
            ctx.strokeStyle = st.col; ctx.lineWidth = 2.5; ctx.stroke();
        }
        ctx.restore();
    },
    pulse:function(){ return 0.5 + 0.5*Math.sin(mainScreen.stateTime*0.4); },
    //近いほど濃く、いちばん近い弾をいちばん濃く
    style:function(_o,_i){
        var a = (0.55 + (1 - _o.t/LAB_LOOK)*0.45)*(_i == 0 ? 1 : 0.7);
        return { col:"rgba(" + LAB_COLOR_DEEP + "," + a.toFixed(2) + ")", halo:"rgba(255,255,255," + (a*0.9).toFixed(2) + ")" };
    },
    //Lv3：当たる所まで線を引き、×を付ける(白いふちどりの上に濃い水色)。×はドローン君に重なるので、いちばん手前に描く
    drawLines:function(){
        var f = this.focus || [];
        ctx.save();
        ctx.lineCap = "round";
        for(var i=Math.min(LAB_FOCUS_LINE, f.length) - 1; i>=0; i--){
            var o = f[i];
            if(o.lv < 3 || enemyShots.indexOf(o.b) < 0) continue;
            var st = this.style(o, i), X = LAB_CROSS + (i == 0 ? this.pulse()*3 : 0);
            ctx.beginPath();
            ctx.moveTo(o.b.x, o.b.y); ctx.lineTo(o.cx, o.cy);
            //×は中心を空ける(ドローン君の当たり判定の点を隠さない)
            for(var q=0; q<4; q++){
                var sx = q % 2 ? 1 : -1, sy = q < 2 ? 1 : -1;
                ctx.moveTo(o.cx + sx*X*LAB_CROSS_GAP, o.cy + sy*X*LAB_CROSS_GAP); ctx.lineTo(o.cx + sx*X, o.cy + sy*X);
            }
            ctx.strokeStyle = st.halo; ctx.lineWidth = LAB_LINE_W + LAB_LINE_HALO; ctx.stroke();
            ctx.strokeStyle = st.col; ctx.lineWidth = LAB_LINE_W; ctx.stroke();
        }
        ctx.restore();
    },

    //ゲームオーバー画面の右側：研究所へ送った記録(_t はゲームオーバー画面に入ってからのフレーム数)
    drawReport:function(_t){
        var X = 560, Y = 54, W = 370, rows = this.report || [];
        ctx.save();
        ctx.fillStyle = "rgba(" + LAB_COLOR + ",0.07)";
        ctx.strokeStyle = "rgba(" + LAB_COLOR + ",0.6)";
        ctx.lineWidth = 1.5;
        roundRectPath(X, Y, W, 420, 8);
        ctx.fill(); ctx.stroke();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgb(20,90,130)";
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("研究所のコアへ交戦記録を送信", X + 16, Y + 24);
        var sent = _t > 40 + rows.length*50;
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#555";
        var dots = ".".repeat(1 + Math.floor(_t/12) % 3);
        ctx.fillText(rows.length == 0 ? "送る記録はありません" : sent ? "受信完了：次の出撃から反映されます" : "送信中" + dots, X + 16, Y + 48);
        for(var i=0; i<rows.length; i++){
            var r = rows[i], t0 = 30 + i*50;
            if(_t < t0) break;
            var y = Y + 76 + i*84;
            var k = Math.min(1, (_t - t0)/40);
            k = 1 - (1 - k)*(1 - k);
            var max = LAB_NEED[LAB_NEED.length - 1];
            var p = r.before + (r.after - r.before)*k;
            ctx.fillStyle = "#222";
            ctx.font = "bold 16px sans-serif";
            ctx.fillText(r.name, X + 16, y + 10);
            if(r.kill){
                var nw = ctx.measureText(r.name).width;
                ctx.fillStyle = "#c33";
                ctx.font = "12px sans-serif";
                ctx.fillText("撃墜した相手", X + 16 + nw + 10, y + 11);
            }
            //今の段階
            var lvNow = 0;
            while(lvNow < LAB_NEED.length && p >= LAB_NEED[lvNow] - 1e-6) lvNow++;
            ctx.textAlign = "right";
            ctx.fillStyle = lvNow > r.lvB ? "rgb(" + LAB_COLOR + ")" : "#555";
            ctx.font = "bold 15px sans-serif";
            ctx.fillText(lvNow >= LAB_NEED.length ? "解析 Lv" + lvNow + "(完了)" : "解析 Lv" + lvNow, X + W - 16, y + 10);
            ctx.textAlign = "left";
            //解析の量のバー(段階の区切りに目盛り)
            var bx = X + 16, by = y + 26, bw = W - 32, bh = 10;
            ctx.fillStyle = "rgba(0,0,0,0.08)";
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = "rgba(" + LAB_COLOR + ",0.45)";
            ctx.fillRect(bx, by, bw*r.before/max, bh);
            ctx.fillStyle = "rgb(" + LAB_COLOR + ")";
            ctx.fillRect(bx + bw*r.before/max, by, bw*(p - r.before)/max, bh);
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            for(var j=0; j<LAB_NEED.length - 1; j++){
                var mx = bx + bw*LAB_NEED[j]/max;
                ctx.moveTo(mx, by - 2); ctx.lineTo(mx, by + bh + 2);
            }
            ctx.stroke();
            ctx.strokeRect(bx, by, bw, bh);
            //段階が上がったら、できるようになったことを出す
            ctx.font = "13px sans-serif";
            if(lvNow > r.lvB){
                ctx.fillStyle = "rgb(20,110,160)";
                ctx.fillText("▲ " + LAB_UNLOCK[lvNow], bx, by + 26);
            }else if(lvNow < LAB_NEED.length){
                ctx.fillStyle = "#777";
                ctx.fillText("あと" + Math.ceil(LAB_NEED[lvNow] - p) + "で " + LAB_UNLOCK[lvNow + 1], bx, by + 26);
            }
        }
        ctx.restore();
    }
};
analysis.load();

//被弾を記録し、倒れたら送る(mainScreen.damage を包む)
(function(){
    var damage = mainScreen.damage;
    mainScreen.damage = function(){
        var k = analysis.by || analysis.keyOf(analysis.cur);
        analysis.by = null;
        var hp = this.hp, over = this.state == "over";
        damage.apply(this, arguments);
        if(!analysis.active() || this.hp >= hp) return;     //時止めワープでよけた・無敵のときは数えない
        analysis.hit(k);
        if(!over && this.state == "over") analysis.send();
    };
    //解析した敵へのダメージ(ショップのバフなどの前に掛ける)
    var hitEnemy = mainScreen.hitEnemy;
    mainScreen.hitEnemy = function(_e,_dmg,_src){
        if(_e && !_e.rival) _dmg *= LAB_DMG[analysis.lv(_e)];
        return hitEnemy.call(this, _e, _dmg, _src);
    };
    var drawEnemy = mainScreen.drawEnemy;
    mainScreen.drawEnemy = function(_e){
        drawEnemy.apply(this, arguments);
        analysis.drawMark(_e);
    };
    var drawUnder = shotLab.drawUnder;
    shotLab.drawUnder = function(){
        drawUnder.apply(this, arguments);
        analysis.drawShots();
    };
    //全部消す(テスト用)ときは解析の記録も消す
    var clearAll = save.clearAll;
    save.clearAll = function(){
        clearAll.apply(this, arguments);
        try{ localStorage.removeItem(LAB_KEY); }catch(e){}
        analysis.data = {};
        analysis.newRun();
    };
    var drawFront = shotLab.drawFront;
    shotLab.drawFront = function(){
        drawFront.apply(this, arguments);
        analysis.drawLines();
    };
    var newRun = game.newRun;
    game.newRun = function(){
        analysis.newRun();
        return newRun.apply(this, arguments);
    };
})();
