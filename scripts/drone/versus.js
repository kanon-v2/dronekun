//------------------------------------------------------------------------------
//  ふたりで対戦(ドローン君同士の1対1)
//  通信は協力プレイと同じ部屋・招待リンク(coop.js)を使う。部屋を作った人がホスト。
//
//  ・装備を3つ選んで戦う。装備はすべてLv3、能力はふたりとも同じ(強化やセーブとは関係しない)
//  ・相手は自分の画面では「敵」として enemies に入れ、装備がいつもどおり自動で攻撃する
//  ・与えたダメージは合計値で相手へ送り、受けた側が自分の耐久から引く(途中が抜けても合計なので狂わない)
//  ・クリックの衝撃波：近くにいる相手にダメージ。出した直後は少しのあいだ無敵(受けたダメージを無視する)
//  ・耐久が0になった側の負け。1戦ごとに勝敗を数え、「もう一度」で装備を選び直す
//------------------------------------------------------------------------------
const VS_HP = 300;             //耐久(装備のダメージで数える。雑魚敵の体力は1～5)。決着まで30秒ほどになるよう調整
const VS_PICKS = 3;            //選べる装備の数
const VS_WEAPON_LV = 3;        //装備のレベル(全部同じ)
const VS_STAT_LV = 3;          //能力のレベル(全部同じ)
const VS_COUNTDOWN = 180;      //開始までの秒読み(フレーム)。この間は動けるが攻撃しない
const VS_EMP_SLOW = 90;        //相手のEMPを受けたときに遅くなる時間(フレーム)
const VS_ICE_SLOW = 60;        //相手の冷凍を受けたときに遅くなる時間(フレーム。対戦では凍って止まる代わり)
const VS_COLOR = "215,60,45";  //相手のドローン君の色
const VS_START_X = 0.18;       //開始位置(画面の幅に対する割合。ホストは左、ゲストは右)
//対戦でのダメージの倍率(装備ごと)。ふつうの戦闘は敵の群れ向けに調整してあるので、
//1対1では群れに強い装備(電撃など)が弱く、連射の装備が強くなりすぎる。自動プレイで測って差を縮めた
//(離れて戦ったときの値 毎秒：水5.5 ミサイル4.6 実弾4.2 虫1.6 レーザー1.5 電撃1.2 地雷0.8 EMP0.8。
// ブレードは触れると強い(光刃なら毎秒10ほど)ので倍率は低め)
const VS_DAMAGE_MUL = { gun:0.85, missile:0.8, water:0.65, laser:2.6, bug:2.0, tesla:3.0, emp:3.0, mine:1.8, blade:0.8,
                        fire:1.6, disc:1.3, gravity:5.0, barrier:1.0, sniper:0.5, freeze:2.6,   //追加の装備はtools/vs-dps.htmlで今の装備(約3.6/秒)にそろえた
                        blast:3.0 };    //衝撃波(範囲内にいる相手へ)

var versus = {
    active:false,       //対戦中か(装備選び・戦闘・結果のどれか)
    isHost:false,
    phase:"select",     //"select" 装備選び / "fight" 戦闘 / "result" 結果
    t:0,                //今のフェーズの経過フレーム
    round:0,
    picks:[],           //選んだ装備
    ready:false,
    hp:VS_HP,
    //自分が与えた分(合計)
    dealt:0,            //ダメージ×10(整数で送る)
    emp:0,              //EMPを当てた回数
    //相手から受けて反映した分(合計)
    taken:0,
    takenEmp:0,
    empSlow:0,
    fz:0,               //冷凍を当てた回数
    takenFz:0,
    iceSlow:0,
    hurtCd:0,           //被弾の音・揺れを出しすぎないための待ち時間
    blasts:0,           //衝撃波を出した回数(相手の画面に衝撃波を描いてもらう)
    lastBlast:[0,0],
    blastSeen:0,
    other:null,         //相手から最後に届いた状態
    rival:null,         //自分の画面での相手(敵として enemies に入れる)
    look:new DroneLook(),
    result:"",
    fightTime:0,
    wins:0, losses:0, draws:0,

    //------------------------------------------------------------ 開始・ラウンド
    start:function(_isHost){
        this.active = true;
        this.isHost = _isHost;
        this.round = 0;
        this.wins = 0; this.losses = 0; this.draws = 0;
        this.blasts = 0; this.blastSeen = 0;
        this.other = null;
        if(this.picks.length == 0) this.picks = ["gun","missile","tesla"];
        this.look.tint = VS_COLOR;
        this.newRound();
        page.change(7);
    },

    newRound:function(){
        this.round++;
        this.phase = "select";
        this.t = 0;
        this.ready = false;
        sound.music("shop");
    },

    //戦闘開始：ゲームの状態を対戦用に作り直す(ひとり用のセーブには書き込まない)
    startFight:function(){
        game.reset();
        for(var i=0; i<STATS.length; i++) game.level[STATS[i].key] = VS_STAT_LV;
        game.owned = {};
        game.slots = [null,null,null];
        for(var i=0; i<this.picks.length; i++){
            game.owned[this.picks[i]] = VS_WEAPON_LV;
            game.slots[i] = this.picks[i];
        }
        game.slotCount = VS_PICKS;

        enemies = []; enemyShots = []; pickups = []; effects = []; popups = [];
        var M = mainScreen;
        M.down = false; M.state = "play";
        M.maxFuel = game.stat("fuel"); M.fuel = M.maxFuel;
        M.guard = 0; M.invincible = 0; M.shake = 0; M.tint = null; M.slowmo = 0; M.noFuelMsg = 0; M.fuelOut = false; M.clock = 0;
        arms.reset();
        drone.applyStats();
        drone.slow = false;
        var myX = CW*(this.isHost ? VS_START_X : 1 - VS_START_X), rivalX = CW - myX;
        drone.X = drone.preX = myX; drone.Y = drone.preY = CH/2;
        MouseX = myX; MouseY = CH/2;
        this.rival = { rival:true, id:-1, type:"rival", x:rivalX, y:CH/2, vx:0, vy:0, r:drone.R,
                       hp:VS_HP, maxHp:VS_HP, dead:false, flash:0, slow:0, wet:0 };
        enemies.push(this.rival);

        this.hp = VS_HP;
        this.dealt = 0; this.emp = 0; this.fz = 0;
        this.taken = 0; this.takenEmp = 0; this.takenFz = 0;
        this.empSlow = 0; this.iceSlow = 0; this.hurtCd = 0;
        this.result = "";
        this.phase = "fight";
        this.t = 0;
        sound.music(null);
        sound.music("battle");
        sound.play("waveStart");
    },

    finish:function(_result){
        this.fightTime = Math.max(0, this.t - VS_COUNTDOWN);   //決着までの時間(フレーム。結果画面に出す)
        this.phase = "result";
        this.t = 0;
        this.result = _result;
        if(_result == "win") this.wins++;
        else if(_result == "lose") this.losses++;
        else this.draws++;
        sound.stopMusic();
        var x = _result == "win" ? this.rival.x : drone.X, y = _result == "win" ? this.rival.y : drone.Y;
        burst(x,y,40,"#333");
        burst(x,y,20,"#e44");
        fx.shake(25);
        sound.play("destroyed");
        if(_result == "win") sound.play("clear");
    },

    //戦闘中に攻撃できるか(秒読みが終わっているか)
    live:function(){
        return this.phase == "fight" && this.t >= VS_COUNTDOWN && this.hp > 0;
    },

    //タッチ操作でドラッグ移動にするか(common.js)
    dragging:function(){
        return this.active && this.phase == "fight";
    },

    //------------------------------------------------------------ 攻撃(mainScreen.hitEnemy から)
    hit:function(_e,_dmg,_src){
        if(!this.live()) return;
        this.dealt += Math.round(_dmg*(VS_DAMAGE_MUL[_src] || 1)*10);
        if(_src == "emp") this.emp++;
        if(_src == "freeze") this.fz++;
        _e.flash = 6;
        sound.play("hit");
    },

    //クリック：円い衝撃波。範囲内にいる相手にダメージ。出した直後は無敵
    blast:function(){
        var M = mainScreen;
        if(M.fuel < BLAST_COST){
            M.noFuelMsg = 60;
            sound.play("error");
            return;
        }
        M.fuel -= BLAST_COST;
        M.guard = BLAST_GUARD;
        //相手の位置は相手の画面で決まるので、はじき飛ばさずダメージだけ
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.rival && Math.hypot(e.x - drone.X, e.y - drone.Y) < BLAST_RADIUS + e.r) M.hitEnemy(e,BLAST_DMG,"blast");
        }
        M.blastFx(drone.X,drone.Y);
        this.blasts++;
        this.lastBlast = [drone.X, drone.Y];
    },

    //------------------------------------------------------------ 通信
    //相手へ送る状態
    build:function(){
        var r = Math.round;
        var v = { ph:this.phase.charAt(0), r:this.round, rd:this.ready ? 1 : 0, pk:this.picks,
                  bl:[this.blasts, r(this.lastBlast[0]), r(this.lastBlast[1])] };
        if(this.active && this.phase != "select"){
            v.x = r(drone.X); v.y = r(drone.Y); v.d = drone.look.shown;
            v.hp = Math.max(0, Math.round(this.hp*10)/10);
            v.dm = this.dealt; v.em = this.emp; v.fz = this.fz;
            v.dead = this.hp <= 0 ? 1 : 0;
            v.gd = mainScreen.guard > 0 ? 1 : 0;
            if(this.phase == "fight") v.a = coop.armsSummary();
        }
        return v;
    },

    //相手から届いた状態(coop.update から毎フレーム)
    read:function(_v){
        if(!_v) return;
        this.other = _v;
        //相手の衝撃波(見た目だけ。ダメージは相手の画面で数えて届く)
        var bl = _v.bl || [0,0,0];
        if(bl[0] > this.blastSeen){
            if(this.phase == "fight" && _v.r == this.round) mainScreen.blastFx(bl[1], bl[2], true);
            this.blastSeen = bl[0];
        }
        if(_v.r != this.round || this.phase != "fight") return;
        //受けたダメージ(合計の増えた分)。衝撃波の直後の無敵中は受けない
        var inc = ((_v.dm || 0) - this.taken)/10;
        if(inc > 0){
            this.taken = _v.dm;
            if(mainScreen.guard <= 0 && this.hp > 0){
                inc = arms.absorbVs(inc);     //バリアの板があれば1枚で防ぐ(armsExtra.js)
                this.hp -= inc;
                this.hurt();
            }
        }
        if((_v.em || 0) > this.takenEmp){
            this.takenEmp = _v.em;
            this.empSlow = VS_EMP_SLOW;
        }
        if((_v.fz || 0) > this.takenFz){
            this.takenFz = _v.fz;
            this.iceSlow = VS_ICE_SLOW;
        }
    },

    hurt:function(){
        burst(drone.X,drone.Y,4,"#c33");
        if(this.hurtCd > 0) return;
        this.hurtCd = 10;
        sound.play("damage");
        fx.shake(6);
    },

    //------------------------------------------------------------ 毎フレーム
    update:function(){
        this.t++;
        var o = this.other;
        switch(this.phase){
            case "select": this.updateSelect(o); break;
            case "fight":  this.updateFight(o); break;
            case "result": this.updateResult(o); break;
        }
    },

    updateSelect:function(o){
        if(vsQuitButton.clicked()){
            sound.play("click");
            this.quit();
            return;
        }
        if(vsReadyButton.clicked() && this.picks.length == VS_PICKS){
            sound.play("click");
            this.ready = !this.ready;
            return;
        }
        if(!this.ready && Click == 1){
            for(var i=0; i<WEAPON_IDS.length; i++){
                if(!this.card(i).contains(MouseX,MouseY)) continue;
                var id = WEAPON_IDS[i], k = this.picks.indexOf(id);
                if(k >= 0) this.picks.splice(k,1);
                else if(this.picks.length < VS_PICKS) this.picks.push(id);
                else { sound.play("error"); break; }
                sound.play("click");
                break;
            }
        }
        //ふたりとも準備できたら開始(相手が同じラウンドで準備完了、またはもう始めている)
        if(this.ready && o && o.r == this.round && o.rd && (o.ph == "s" || o.ph == "f")) this.startFight();
    },

    updateFight:function(o){
        var M = mainScreen;
        M.clock++;
        if(M.tint && --M.tint.life <= 0) M.tint = null;
        if(this.empSlow > 0) this.empSlow--;
        if(this.iceSlow > 0) this.iceSlow--;
        M.updateFuel();
        if(this.empSlow > 0 || this.iceSlow > 0) drone.slow = true;   //EMP・冷凍を受けている間は遅い
        drone.update();
        if(this.live() && Click == 1) this.blast();
        this.updateRival(o);
        arms.update(this.live());
        M.updateEffects();
        if(M.guard > 0) M.guard--;
        if(M.shake > 0) M.shake--;
        if(M.noFuelMsg > 0) M.noFuelMsg--;
        if(this.hurtCd > 0) this.hurtCd--;
        if(this.t == VS_COUNTDOWN) sound.play("warning");

        //勝敗
        var rivalDead = o && o.r == this.round && o.dead;
        if(this.hp <= 0) this.finish(rivalDead ? "draw" : "lose");
        else if(rivalDead) this.finish("win");
    },

    //相手のドローン君：届いた位置へなめらかに寄せる(装備の狙いのため速さも求める)
    updateRival:function(o){
        var R = this.rival;
        if(R.flash > 0) R.flash--;
        if(R.slow > 0) R.slow--;
        if(R.wet > 0) R.wet--;
        if(!o || o.r != this.round || o.x == null) return;
        var ox = R.x, oy = R.y;
        R.x += (o.x - R.x)*0.35;
        R.y += (o.y - R.y)*0.35;
        R.vx = R.x - ox; R.vy = R.y - oy;
        R.hp = Math.max(0.1, o.hp);
        this.look.update(o.d || 0, R.vx);
    },

    updateResult:function(o){
        //ほぼ同時に倒れていたら引き分けに直す
        if(this.result == "lose" && o && o.r == this.round && o.dead){
            this.result = "draw";
            this.losses--;
            this.draws++;
        }
        mainScreen.updateEffects();
        if(mainScreen.shake > 0) mainScreen.shake--;
        if(this.t < 60) return;   //結果が出た直後の押し間違いを防ぐ
        if(vsAgainButton.clicked()){
            sound.play("click");
            this.newRound();
            return;
        }
        if(vsQuitButton.clicked()){
            sound.play("click");
            this.quit();
        }
    },

    quit:function(){
        this.active = false;
        coop.leave();
        page.change(0);
    },

    //装備選びのカード(3列×3行)
    //装備のカード(5つずつ3段)
    card:function(_i){
        var c = _i % 5, r = Math.floor(_i/5);
        return new drawRect(CW/2 + (c - 2)*GS*6.0, GS*3.2 + r*GS*2.95, GS*5.75, GS*2.7);
    },

    //------------------------------------------------------------ 描画
    draw:function(){
        if(this.phase == "select"){ this.drawSelect(); return; }
        this.drawArena();
        if(this.phase == "result") this.drawResult();
    },

    drawSelect:function(){
        var o = this.other;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";
        ctx.font = "bold 30px serif";
        ctx.fillText("ふたりで対戦　第" + this.round + "戦",CW/2,GS*1.2);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText("装備を" + VS_PICKS + "つ選んでください（すべてLv" + VS_WEAPON_LV + "）。相性の良い組み合わせでシナジーが発動します　　"
                     + this.wins + "勝 " + this.losses + "敗" + (this.draws ? " " + this.draws + "分" : ""),CW/2,GS*2.5);

        for(var i=0; i<WEAPON_IDS.length; i++){
            var id = WEAPON_IDS[i], W = WEAPONS[id], b = this.card(i);
            var on = this.picks.indexOf(id) >= 0;
            if(on){ b.fill("#fff4d6"); }
            else if(!this.ready && b.contains(MouseX,MouseY)){ b.fill("#f2f2f2"); }
            ctx.strokeStyle = on ? "#d08a00" : (this.ready ? "#ccc" : "#000");
            ctx.lineWidth = on ? 3 : 1;
            ctx.strokeRect(b.X,b.Y,b.width,b.height);
            ctx.lineWidth = 1;
            //しるし・名前・説明(3行まで)
            drawWeaponIcon(id, b.X + 7, b.Y + 8, 26);
            ctx.textAlign = "left";
            ctx.fillStyle = "#000";
            ctx.font = "bold 14px sans-serif";
            ctx.fillText(W.name + (on ? " ✔" : ""), b.X + 40, b.Y + 21);
            ctx.font = "10px sans-serif";
            ctx.fillStyle = "#555";
            this.wrap(W.desc, b.X + 8, b.Y + 46, b.width - 14, 12, 3);
        }

        //今の組み合わせのシナジー
        ctx.textAlign = "center";
        ctx.font = "bold 14px sans-serif";
        var syn = [];
        for(var i=0; i<SYNERGIES.length; i++){
            var s = SYNERGIES[i];
            if(this.picks.indexOf(s.a) >= 0 && this.picks.indexOf(s.b) >= 0) syn.push("◆" + s.name + "：" + s.desc);
        }
        ctx.fillStyle = syn.length ? "#c33" : "#999";
        ctx.fillText(syn.length ? syn.join("　") : "シナジーなし", CW/2, GS*12.5);

        //相手のようす
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "rgb(" + VS_COLOR + ")";
        var st = !o ? "相手を待っています…"
               : o.r < this.round || o.ph == "r" ? "相手は結果を見ています…"
               : o.rd ? "相手は準備OK！" : "相手は装備を選んでいます…";
        ctx.fillText(st, CW/2, GS*13.5);

        ctx.font = "bold 18px sans-serif";
        if(this.ready) vsReadyButton.button("準備OK（取り消す）");
        else vsReadyButton.button(this.picks.length == VS_PICKS ? "準備OK" : "あと" + (VS_PICKS - this.picks.length) + "つ選ぶ", this.picks.length == VS_PICKS);
        ctx.font = "14px sans-serif";
        vsQuitButton.button("やめてタイトルへ");
        ctx.fillStyle = "#000";
    },

    //文字を幅で折り返して描く(最大 _lines 行)
    wrap:function(_text,_x,_y,_w,_lh,_lines){
        var line = "", n = 0;
        for(var i=0; i<_text.length; i++){
            var t = line + _text.charAt(i);
            if(ctx.measureText(t).width > _w && line){
                ctx.fillText(line, _x, _y + n*_lh);
                if(++n >= _lines) return;
                line = _text.charAt(i);
            }else{
                line = t;
            }
        }
        if(line) ctx.fillText(line, _x, _y + n*_lh);
    },

    drawArena:function(){
        var M = mainScreen, o = this.other, R = this.rival;
        ctx.save();
        if(M.shake > 0) ctx.translate((Math.random()-0.5)*M.shake, (Math.random()-0.5)*M.shake);
        M.drawBackground();
        //自動攻撃の射程
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.beginPath(); ctx.arc(drone.X,drone.Y,game.range(),0,Math.PI*2); ctx.stroke();

        arms.draw(this.phase == "fight" && this.hp > 0);
        if(o && o.a && o.r == this.round && this.phase == "fight") coop.drawArms(o.a, R.x, R.y);

        //相手(衝撃波の無敵中はうすく)
        var rivalAlive = !(this.phase == "result" && this.result != "lose");
        if(rivalAlive){
            ctx.globalAlpha = o && o.gd ? 0.5 : 1;
            this.look.draw(R.x,R.y);
            ctx.globalAlpha = 1;
            if(R.flash > 0){
                ctx.fillStyle = "rgba(255,255,255,0.6)";
                ctx.beginPath(); ctx.arc(R.x,R.y,R.r + 4,0,Math.PI*2); ctx.fill();
            }
            this.label("相手", R.x, R.y, "rgb(" + VS_COLOR + ")");
        }
        //自分
        if(!(this.phase == "result" && this.result != "win")){
            ctx.globalAlpha = M.guard > 0 ? 0.5 : 1;
            drone.draw();
            ctx.globalAlpha = 1;
            this.label("あなた", drone.X, drone.Y, "#000");
        }
        M.drawEffects();
        //遅くなっている理由をドローン君のまわりに出す(「あなた」の名札より上)
        if(this.phase == "fight" && M.fuelOut) M.drawSlowMark("燃料切れ！止まると回復", "210,40,40", 50);
        else if(this.phase == "fight" && this.empSlow > 0) M.drawSlowMark("EMPで減速中", "134,102,204", 50);
        else if(this.phase == "fight" && this.iceSlow > 0) M.drawSlowMark("凍って減速中", "91,184,222", 50);
        else if(M.noFuelMsg > 0){
            ctx.font = "bold 14px sans-serif";
            ctx.fillStyle = "#c33";
            ctx.fillText("燃料が足りない！",drone.X,drone.Y - 48);
        }
        ctx.restore();
        if(M.tint){
            ctx.fillStyle = "rgba(" + M.tint.color + "," + (0.16*M.tint.life/M.tint.maxLife) + ")";
            ctx.fillRect(0,0,CW,CH);
        }
        this.drawHud();
        if(inputMode == "touch" && this.phase == "fight") M.drawTouchBlast();

        //秒読み
        if(this.phase == "fight" && this.t < VS_COUNTDOWN + 40){
            var left = VS_COUNTDOWN - this.t;
            var text = left > 0 ? String(Math.ceil(left/60)) : "FIGHT!";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "900 72px sans-serif";
            ctx.lineWidth = 8;
            ctx.lineJoin = "round";
            ctx.strokeStyle = "#fff";
            ctx.strokeText(text, CW/2, CH/2 - 40);
            ctx.fillStyle = left > 0 ? "#222" : "#d22";
            ctx.fillText(text, CW/2, CH/2 - 40);
            ctx.lineWidth = 1;
            ctx.lineJoin = "miter";
            ctx.fillStyle = "#000";
        }
    },

    label:function(_text,_x,_y,_color){
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = _color;
        ctx.fillText(_text, _x, _y - 32);
        ctx.fillStyle = "#000";
    },

    //上部：ふたりの耐久と自分の燃料
    drawHud:function(){
        var o = this.other, M = mainScreen;
        var rivalHp = o && o.r == this.round && o.hp != null ? o.hp : VS_HP;
        this.bar(16, 14, "あなた", this.hp, "#222", "left");
        this.bar(CW - 16, 14, "相手", rivalHp, "rgb(" + VS_COLOR + ")", "right");
        //燃料
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText("燃料", 16, 52);
        ctx.strokeStyle = "#999";
        ctx.strokeRect(50.5, 46.5, 150, 10);
        ctx.fillStyle = M.fuel >= BLAST_COST ? "#555" : "#bbb";
        ctx.fillRect(51, 47, 149*M.fuel/M.maxFuel, 9);
        ctx.fillStyle = "#c33";
        ctx.fillRect(50 + 150*BLAST_COST/M.maxFuel, 44, 2, 15);
        if(this.empSlow > 0){
            ctx.fillStyle = "#86c";
            ctx.fillText("EMPで減速中", 210, 52);
        }else if(this.iceSlow > 0){
            ctx.fillStyle = "#5bb8de";
            ctx.fillText("凍って減速中", 210, 52);
        }
        ctx.textAlign = "center";
        ctx.fillStyle = "#555";
        ctx.font = "13px sans-serif";
        ctx.fillText("第" + this.round + "戦　" + this.wins + "勝 " + this.losses + "敗" + (this.draws ? " " + this.draws + "分" : ""), CW/2, 22);
        ctx.fillStyle = "#000";
    },

    //耐久のバー。_align："left" なら _x から右へ、"right" なら _x から左へ
    bar:function(_x,_y,_name,_hp,_color,_align){
        var w = 300, h = 16;
        var x = _align == "left" ? _x : _x - w;
        var k = Math.max(0, Math.min(1, _hp/VS_HP));
        ctx.fillStyle = "#eee";
        ctx.fillRect(x, _y + 8, w, h);
        ctx.fillStyle = k > 0.3 ? _color : "#d22";
        if(_align == "left") ctx.fillRect(x, _y + 8, w*k, h);
        else ctx.fillRect(x + w*(1 - k), _y + 8, w*k, h);
        ctx.strokeStyle = "#333";
        ctx.strokeRect(x + 0.5, _y + 8.5, w, h);
        ctx.font = "bold 12px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = _align;
        ctx.fillStyle = _color;
        ctx.fillText(_name + "　" + Math.ceil(Math.max(0,_hp)) + " / " + VS_HP, _x, _y);
        ctx.fillStyle = "#000";
    },

    drawResult:function(){
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(0, CH/2 - 110, CW, 220);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 60px serif";
        var text = this.result == "win" ? "勝利！" : this.result == "lose" ? "敗北……" : "引き分け";
        ctx.fillStyle = this.result == "win" ? "#c33" : "#222";
        ctx.fillText(text, CW/2, CH/2 - 50);
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(this.wins + "勝 " + this.losses + "敗" + (this.draws ? " " + this.draws + "分" : ""), CW/2, CH/2 + 5);
        if(this.t >= 60){
            ctx.font = "bold 18px sans-serif";
            vsAgainButton.button("もう一度（装備を選び直す）");
            ctx.font = "14px sans-serif";
            vsQuitButton.button("やめてタイトルへ");
        }
        ctx.fillStyle = "#000";
    }
};

var vsReadyButton = new drawRect(CW/2 - GS*4.5, GS*14.5, GS*10, GS*1.8);
var vsAgainButton = new drawRect(CW/2 - GS*4.5, GS*14.5, GS*10, GS*1.8);
var vsQuitButton  = new drawRect(CW/2 + GS*6, GS*14.5, GS*7, GS*1.8);

//対戦の画面(page 7)。中身は versus が持つ
var versusScreen = {
    enter:function(){},
    update:function(){ versus.update(); },
    draw:function(){ versus.draw(); }
};
