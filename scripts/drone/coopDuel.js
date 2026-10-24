//------------------------------------------------------------------------------
//  協力プレイだけの最終決戦：一騎打ち(page 8)
//  WAVE20(ドローン君改)をふたりでクリアすると、ふたりのドローン君が「本物は一機しかいらない」と言い出し、P1(ホスト)とP2(ゲスト)の一騎打ちになる。
//  ・装備・能力は、それぞれがこの周で育てたもの。相手は自分の画面では「敵」として enemies に入れ、装備がいつもどおり自動で攻撃する
//    (対戦 versus.js と同じ考え方：与えたダメージは合計値で相手へ送り、受けた側が自分の耐久から引く)
//  ・先に耐久が0になった側は、再構築プロトコルが起動して、耐久が満ちた超強化の姿(光の翼・攻撃×DUEL_REBUILD_POW・速い)で復活する
//  ・そのあと、どちらかの耐久が0になったら決着(2番目に0になった側の負け)。終わるとふたりともエンディングへ
//  ・回避ダッシュは使える。時止めワープは使わない。通信は協力プレイの状態(coop.buildHost・buildGuest の du)に載せる
//------------------------------------------------------------------------------
const DUEL_HP = 300;            //ふたりの耐久(おまけなので短く。対戦 VS_HP と同じ)。装備Lv3を3つ(毎秒約15～20のダメージ)で、最初に倒れるまで約15～20秒。
                                //(装備のダメージは WAVE・難易度で変わらないので、耐久にも掛けない。前は WAVE20の敵の体力の伸びと難易度を掛けて、ノーマルで約2万5千あり、何分もかかっていた)
const DUEL_SURGE_AT = 20;       //戦い始めてこの秒数をすぎると、ふたりとも与えるダメージがだんだん上がる(装備が弱くても長引かないように)
const DUEL_SURGE_SEC = 8;       //ダメージの倍率が1上がるまでの秒数
const DUEL_INTRO = 330;         //名乗りの長さ(フレーム)。この間は動けるが攻撃しない
const DUEL_LINE = "本物は一機しかいらない";
const DUEL_LINE_AT = [50, 150]; //P1・P2 がせりふを言い出すとき(フレーム)
const DUEL_LINE_T = 150;        //せりふを出しておく長さ(フレーム)
const DUEL_START_X = 0.2;       //開始位置(画面の幅に対する割合。P1は左、P2は右)
const DUEL_REBUILD = 360;       //再構築の演出の長さ(フレーム)。この間はふたりとも攻撃しない
const DUEL_REBUILD_POW = 1.8;   //再構築したあとの攻撃の倍率
const DUEL_REBUILD_DELAY = 0.6; //再構築したあとの、ポインタへの付いていく遅れの倍率(小さいほど速い)
const DUEL_PROTO_LOG = ["致命的損傷を検知", "戦闘記録を読み込み中……", "機体構造を再定義", "出力制限を解除", "光翼を展開", "再構築完了"];
const DUEL_GOLD = "255,215,120";    //再構築の光の色
const DUEL_RESULT_WAIT = 150;   //決着のあと、ボタンを出すまで(フレーム)
const DUEL_RESULT_AUTO = 600;   //決着のあと、押さなくてもエンディングへ進むまで(フレーム)

var duelEndButton = new drawRect(CW/2, GS*14.6, GS*10, GS*1.8);

var coopDuel = {
    active:false,
    phase:"intro",      //"intro" 名乗り / "fight" 戦い / "rebuild" 自分の再構築 / "result" 決着
    t:0,
    hp:0, mh:1,
    dealt:0,            //与えたダメージ×10(合計)
    taken:0,            //相手から受けて反映した分(合計)
    rb:0,               //再構築 0：まだ 1：している途中 2：した
    pow:1,              //攻撃の倍率(再構築で上がる)
    dead:false,
    result:"",          //"win"・"lose"・"draw"(エンディングにも出す)
    other:null,         //相手から最後に届いた状態
    foe:null,           //自分の画面での相手(敵として enemies に入れる)
    blasts:0, blastSeen:0, lastBlast:[0,0],
    hurtCd:0,
    rbSeen:0,           //相方の再構築を見た(演出の音を1回だけ)
    otherRbT:0,         //相方の再構築の演出の経過
    ft:0,               //攻撃できた時間(フレーム。ダメージの倍率 surge に使う)

    //WAVE20をクリアしたら(ホストは mainScreen、ゲストは coop.readHost から)
    begin:function(){
        this.active = true;
        this.result = "";
        page.change(8);
    },
    //ふたりの耐久
    maxHp:function(){ return DUEL_HP; },
    me:function(){ return coop.role == "guest" ? "P2" : "P1"; },
    them:function(){ return coop.role == "guest" ? "P1" : "P2"; },

    enter:function(){
        var M = mainScreen;
        enemies = []; enemyShots = []; pickups = []; effects = []; popups = [];
        shotLab.clear();
        M.down = false; M.state = "play"; M.stateTime = 0;
        M.yaruki = YARUKI_MAX;
        M.guard = 0; M.invincible = 0; M.shake = 0; M.tint = null; M.slowmo = 0; M.yarukiMsg = 0; M.clock = 0; M.hitStop = 0;
        M.combo = 0; M.justSlow = 0; M.slowPow = 0;
        battleBg.reset();
        battleBg.night = 0.55;
        coopMirror.reset();
        finaleTri.dawnK = 0; finaleTri.dawnFlash = 0;   //最終局面の夜明けの光(ドローン君の光の翼)は消す
        arms.reset();
        timeStop.reset();
        dodge.reset();
        drone.applyStats();
        drone.slow = false;
        var guest = coop.role == "guest";
        var myX = CW*(guest ? 1 - DUEL_START_X : DUEL_START_X);
        drone.X = drone.preX = myX; drone.Y = drone.preY = CH/2;
        MouseX = myX; MouseY = CH/2;
        drone.look.resetFace();
        drone.look.setMood("fierce");
        this.foe = { duel:true, id:-2, type:"duelist", x:CW - myX, y:CH/2, vx:0, vy:0, r:drone.R,
                     hp:1, maxHp:1, dead:false, flash:0, slow:0, wet:0 };
        enemies.push(this.foe);
        this.mh = this.hp = this.maxHp();
        this.dealt = 0; this.taken = 0;
        this.rb = 0; this.pow = 1; this.dead = false;
        this.result = "";
        this.blasts = 0; this.blastSeen = 0;
        this.hurtCd = 0; this.rbSeen = 0; this.otherRbT = 0;
        this.ft = 0;
        this.other = null;
        this.phase = "intro";
        this.t = 0;
        sound.music(null);
        sound.play("warning");
    },

    //攻撃できるか(名乗りが終わり、ふたりとも戦っていて、どちらも再構築の途中でない)
    live:function(){
        var o = this.other;
        return this.phase == "fight" && !this.dead && !!o && o.ph == "f" && !o.dead && o.rb != 1;
    },
    //タッチ操作でドラッグ移動にするか(common.js)
    dragging:function(){
        return this.active && (this.phase == "fight" || this.phase == "intro");
    },

    //------------------------------------------------------------ 攻撃(mainScreen.hitEnemy から)
    hit:function(_e,_dmg,_src){
        if(!this.live()) return;
        this.dealt += Math.round(_dmg*(VS_DAMAGE_MUL[_src] || 1)*this.pow*this.surge()*10);
        _e.flash = 6;
        sound.play("hit");
    },
    //ダメージの倍率：戦いが長引くと上がる(攻撃できた時間で数えるので、ふたりともほぼ同じ)
    surge:function(){
        return 1 + Math.max(0, this.ft/60 - DUEL_SURGE_AT)/DUEL_SURGE_SEC;
    },
    //クリック：円い衝撃波。範囲内にいる相手にダメージ。出した直後は無敵
    blast:function(){
        var M = mainScreen;
        if(M.yaruki < YARUKI_COST){ M.yarukiMsg = 60; sound.play("error"); return; }
        M.yaruki -= YARUKI_COST;
        M.guard = BLAST_GUARD;
        var e = this.foe;
        if(e && Math.hypot(e.x - drone.X, e.y - drone.Y) < BLAST_RADIUS + e.r) M.hitEnemy(e, BLAST_DMG, "blast");
        M.blastFx(drone.X, drone.Y);
        this.blasts++;
        this.lastBlast = [drone.X, drone.Y];
    },

    //------------------------------------------------------------ 通信
    build:function(){
        var r = Math.round;
        var v = { ph:this.phase.charAt(0), x:r(drone.X), y:r(drone.Y), d:drone.look.shown,
                  hp:Math.max(0, Math.round(this.hp)), mh:this.mh, dm:this.dealt, rb:this.rb, dead:this.dead ? 1 : 0,
                  gd:(mainScreen.guard > 0 || dodge.invuln()) ? 1 : 0, bl:[this.blasts, r(this.lastBlast[0]), r(this.lastBlast[1])] };
        if(this.phase == "fight") v.a = coop.armsSummary();
        return v;
    },
    read:function(_v){
        if(!_v || !this.active) return;
        this.other = _v;
        var bl = _v.bl || [0,0,0];
        if(bl[0] > this.blastSeen){
            if(page.number == 8 && this.phase != "intro") mainScreen.blastFx(bl[1], bl[2], true);
            this.blastSeen = bl[0];
        }
        //受けたダメージ(合計の増えた分)。衝撃波・回避の直後と、再構築の途中は受けない
        var inc = ((_v.dm || 0) - this.taken)/10;
        if(inc <= 0) return;
        this.taken = _v.dm;
        if(this.phase != "fight" || this.dead || mainScreen.guard > 0 || dodge.invuln()) return;
        this.hp -= arms.absorbVs(inc);
        this.hurt();
        if(this.hp <= 0) this.zero();
    },
    hurt:function(){
        burst(drone.X, drone.Y, 4, "#c33");
        if(this.hurtCd > 0) return;
        this.hurtCd = 10;
        sound.play("damage");
        fx.shake(6);
        drone.look.setFace("hurt", 20);
    },
    //耐久が0になった：まだ誰も再構築していなければ再構築、そうでなければ負け
    zero:function(){
        this.hp = 0;
        var o = this.other;
        if(this.rb == 0 && !(o && o.rb > 0)){ this.startRebuild(); return; }
        this.dead = true;
        this.finish(o && o.dead ? "draw" : "lose");
    },
    startRebuild:function(){
        this.rb = 1;
        this.phase = "rebuild";
        this.t = 0;
        mainScreen.guard = 0;
        dodge.reset();
        sound.play("destroyed");
        sound.play("glitch");
        burst(drone.X, drone.Y, 30, "#333");
        fx.shake(18);
        drone.look.setFace("dizzy", DUEL_REBUILD);
    },
    //再構築が終わる：耐久が満ち、光の翼をまとって強くなる
    endRebuild:function(){
        this.rb = 2;
        this.phase = "fight";
        this.t = DUEL_INTRO;
        this.hp = this.mh;
        this.pow = DUEL_REBUILD_POW;
        drone.delay *= DUEL_REBUILD_DELAY;
        mainScreen.guard = 90;
        mainScreen.yaruki = YARUKI_MAX;
        drone.look.setMood("fierce");
        fx.flare(drone.X, drone.Y, 220, DUEL_GOLD, 30);
        fx.ring(drone.X, drone.Y, 260, DUEL_GOLD, 30, 8);
        fx.ring(drone.X, drone.Y, 160, "255,255,255", 22, 4);
        fx.sparks(drone.X, drone.Y, 40, DUEL_GOLD, 10, 3.5);
        fx.shake(20);
        sound.play("kaiIgnite");
        sound.play("just");
    },
    finish:function(_result){
        if(this.phase == "result") return;
        this.phase = "result";
        this.t = 0;
        this.result = _result;
        sound.stopMusic();
        var x = _result == "win" ? this.foe.x : drone.X, y = _result == "win" ? this.foe.y : drone.Y;
        burst(x, y, 40, "#333");
        burst(x, y, 20, "#e44");
        fx.shake(25);
        sound.play("destroyed");
        if(_result == "win"){ sound.play("clear"); drone.look.setFace("happy", 400); }
    },

    //------------------------------------------------------------ 毎フレーム
    update:function(){
        var M = mainScreen, o = this.other;
        this.t++;
        M.clock++;
        if(M.tint && --M.tint.life <= 0) M.tint = null;
        if(this.hurtCd > 0) this.hurtCd--;
        if(M.guard > 0) M.guard--;
        if(M.shake > 0) M.shake--;
        if(M.yarukiMsg > 0) M.yarukiMsg--;
        if(this.live()) this.ft++;
        this.updateFoe(o);
        //相方の再構築(見ているだけ)
        if(o && o.rb == 1){ this.otherRbT++; if(!this.rbSeen){ this.rbSeen = 1; sound.play("glitch"); sound.play("kaiBoot"); } }
        else if(o && o.rb == 2 && this.rbSeen == 1){ this.rbSeen = 2; sound.play("kaiIgnite"); fx.flare(this.foe.x, this.foe.y, 220, DUEL_GOLD, 30); fx.ring(this.foe.x, this.foe.y, 260, DUEL_GOLD, 30, 8); }
        switch(this.phase){
            case "intro":
                if(this.t == DUEL_LINE_AT[0] || this.t == DUEL_LINE_AT[1]) sound.play("typing");
                if(this.t >= DUEL_INTRO){
                    this.phase = "fight";
                    sound.music("rival");
                    sound.play("waveStart");
                }
                this.move(false);
                break;
            case "fight":
                this.move(true);
                if(this.live() && Click == 1) this.blast();
                if(coop.role == "host" && !coop.partner) this.finish("win");     //相方が抜けた
                //相手の負け(ほぼ同時に倒れていたら引き分け)
                if(o && o.dead && !this.dead) this.finish("win");
                break;
            case "rebuild":
                //耐久は工程の進みに合わせて満ちる(相手の画面のゲージも)
                this.hp = this.mh*Math.min(1, this.t/DUEL_REBUILD);
                if(this.t % 50 == 1 && this.t < DUEL_REBUILD - 40) sound.play("typing");
                if(this.t == 120) sound.play("kaiBoot");
                if(o && o.dead){ this.rb = 2; this.pow = DUEL_REBUILD_POW; this.hp = this.mh; this.finish("win"); break; }   //ほぼ同時に倒れていて、相手が先に負けた
                if(this.t >= DUEL_REBUILD) this.endRebuild();
                break;
            case "result":
                if(this.result == "lose" && o && o.dead){ this.result = "draw"; }
                if((this.t >= DUEL_RESULT_WAIT && duelEndButton.clicked()) || this.t >= DUEL_RESULT_AUTO){
                    sound.play("click");
                    page.change(5);
                    return;
                }
                break;
        }
        M.updateEffects();
    },
    //自分のドローン君と装備を動かす(_fight：攻撃する)
    move:function(_fight){
        var M = mainScreen;
        M.updateYaruki();
        dodge.update();
        drone.update();
        arms.update(_fight && this.live());
    },
    //相手のドローン君：届いた位置へなめらかに寄せる(装備の狙いのため速さも求める)
    updateFoe:function(o){
        var R = this.foe;
        if(R.flash > 0) R.flash--;
        if(R.slow > 0) R.slow--;
        if(R.wet > 0) R.wet--;
        //相手が再構築している間・倒れたあとは狙わない
        R.phased = !o || o.rb == 1 || !!o.dead;
        if(!o || o.x == null) return;
        var ox = R.x, oy = R.y;
        R.x += (o.x - R.x)*0.35;
        R.y += (o.y - R.y)*0.35;
        R.vx = R.x - ox; R.vy = R.y - oy;
        coop.look.update(o.d || 0, R.vx);
    },

    //------------------------------------------------------------ 描画
    draw:function(){
        var M = mainScreen, o = this.other, R = this.foe;
        ctx.save();
        if(M.shake > 0) ctx.translate((Math.random() - 0.5)*M.shake, (Math.random() - 0.5)*M.shake);
        M.drawBackground();
        //再構築の間は暗くなる
        var dk = this.phase == "rebuild" ? Math.min(1, this.t/30, (DUEL_REBUILD - this.t)/30) : (o && o.rb == 1 ? 0.5 : 0);
        if(dk > 0){ ctx.fillStyle = "rgba(10,8,20," + (0.55*dk) + ")"; ctx.fillRect(-40, -40, CW + 80, CH + 80); }
        arms.draw(this.phase == "fight");
        if(o && o.a && this.phase == "fight") coop.drawArms(o.a, R.x, R.y);
        //相手
        var foeShown = !(this.phase == "result" && this.result != "lose") && !(o && o.dead);
        if(foeShown){
            if(o && o.rb == 2) this.drawWings(R.x, R.y, coop.look.tilt || 0, 1);
            ctx.globalAlpha = o && o.gd ? 0.5 : 1;
            if(o && o.rb == 1) this.drawGlitch(R.x, R.y, coop.look, this.otherRbT);
            else coop.look.draw(R.x, R.y);
            ctx.globalAlpha = 1;
            if(R.flash > 0){ ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.arc(R.x, R.y, R.r + 4, 0, Math.PI*2); ctx.fill(); }
            this.label(this.them(), R.x, R.y, "rgb(" + coop.partnerColor() + ")");
        }
        //自分
        if(!(this.phase == "result" && this.result != "win") && !this.dead){
            if(this.rb == 2) this.drawWings(drone.X, drone.Y, drone.look.tilt || 0, 1);
            if(this.phase == "rebuild"){
                this.drawGlitch(drone.X, drone.Y, drone.look, this.t);
            }else{
                dodge.drawUnder();
                ctx.globalAlpha = mainScreen.guard > 0 ? 0.6 : 1;
                dodge.drawDrone();
                ctx.globalAlpha = 1;
            }
            this.label(this.me() + "（あなた）", drone.X, drone.Y, coop.role == "guest" ? "rgb(" + P2_COLOR + ")" : "rgb(" + P1_COLOR + ")");
        }
        M.drawEffects();
        if(M.yarukiMsg > 0){
            ctx.font = "bold 14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#c33";
            ctx.fillText("やる気が足りない！", drone.X, drone.Y - 48);
        }
        this.drawLines();
        ctx.restore();
        dodge.drawOver();
        this.drawHud();
        if(inputMode == "touch" && this.phase == "fight"){ M.drawTouchBlast(); dodge.drawTouchButton(); }
        if(this.phase == "rebuild") this.drawProtocol(this.t, true);
        else if(o && o.rb == 1) this.drawProtocol(this.otherRbT, false);
        if(this.phase == "intro") this.drawIntro();
        if(this.phase == "result") this.drawResult();
    },
    label:function(_text,_x,_y,_color){
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.strokeText(_text, _x, _y - 34);
        ctx.lineWidth = 1;
        ctx.fillStyle = _color;
        ctx.fillText(_text, _x, _y - 34);
        ctx.fillStyle = "#000";
    },
    //ふたりのせりふ(吹き出し。1文字ずつ出る)
    drawLines:function(){
        if(this.phase != "intro") return;
        var hostX = coop.role == "host" ? drone.X : this.foe.x, hostY = coop.role == "host" ? drone.Y : this.foe.y;
        var gX = coop.role == "host" ? this.foe.x : drone.X, gY = coop.role == "host" ? this.foe.y : drone.Y;
        var P = [[hostX, hostY], [gX, gY]];
        for(var i=0; i<2; i++){
            var a = this.t - DUEL_LINE_AT[i];
            if(a < 0 || a > DUEL_LINE_T + 60) continue;
            var text = DUEL_LINE.slice(0, Math.min(DUEL_LINE.length, Math.floor(a/3) + 1));
            ctx.globalAlpha = a > DUEL_LINE_T ? Math.max(0, 1 - (a - DUEL_LINE_T)/60) : 1;
            ctx.font = "bold 16px sans-serif";
            var w = ctx.measureText(DUEL_LINE).width + 22, x = Math.max(w/2 + 8, Math.min(CW - w/2 - 8, P[i][0])), y = P[i][1] - 76;
            ctx.fillStyle = "rgba(20,20,28,0.88)";
            enemyArt.roundRect(x - w/2, y - 17, w, 34, 8); ctx.fill();
            ctx.beginPath(); ctx.moveTo(P[i][0] - 7, y + 16); ctx.lineTo(P[i][0] + 7, y + 16); ctx.lineTo(P[i][0], y + 28); ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(text, x - w/2 + 11, y);
            ctx.globalAlpha = 1;
        }
    },
    //名乗り：上下の黒い帯と題
    drawIntro:function(){
        var k = Math.min(1, this.t/30, (DUEL_INTRO - this.t)/30);
        ctx.fillStyle = "rgba(0,0,0," + (0.85*k) + ")";
        ctx.fillRect(0, 0, CW, 52*k);
        ctx.fillRect(0, CH - 52*k, CW, 52*k);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = Math.max(0, Math.min(1, (this.t - 200)/30));
        ctx.font = "900 46px serif";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#fff";
        ctx.strokeText("最終決戦　P1 vs P2", CW/2, CH/2 - 120);
        ctx.fillStyle = "#b01e28";
        ctx.fillText("最終決戦　P1 vs P2", CW/2, CH/2 - 120);
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        if(this.t > DUEL_INTRO - 70){
            ctx.font = "900 72px sans-serif";
            ctx.lineWidth = 8;
            ctx.strokeStyle = "#fff";
            ctx.strokeText("FIGHT!", CW/2, CH/2 - 40);
            ctx.fillStyle = "#d22";
            ctx.fillText("FIGHT!", CW/2, CH/2 - 40);
            ctx.lineWidth = 1;
        }
        ctx.fillStyle = "#000";
    },
    //再構築の途中のドローン君：ノイズで帯がずれ、ちらつく
    drawGlitch:function(_x,_y,_look,_t){
        var u = Math.min(1, _t/DUEL_REBUILD);
        ctx.save();
        if(Math.random() < 0.3*(1 - u)) ctx.globalAlpha *= 0.4;
        var jx = (Math.random() - 0.5)*8*(1 - u);
        _look.draw(_x + jx, _y);
        ctx.restore();
        //赤と水色のかけら
        for(var i=0; i<4; i++){
            if(Math.random() > 0.6) continue;
            ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,40,60,0.7)" : "rgba(60,220,255,0.7)";
            ctx.fillRect(_x - 24 + Math.random()*48, _y - 20 + Math.random()*40, 6 + Math.random()*16, 2 + Math.random()*3);
        }
        //組み上がっていく光の輪
        ctx.strokeStyle = "rgba(" + DUEL_GOLD + "," + (0.3 + 0.5*u) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(_x, _y, 40 - 14*u, -Math.PI/2, -Math.PI/2 + Math.PI*2*u); ctx.stroke();
        ctx.lineWidth = 1;
    },
    //光の翼(再構築したあと。左右に羽根を広げ、ゆっくりはばたく)
    drawWings:function(_x,_y,_tilt,_a){
        var f = Math.sin(mainScreen.clock*0.09)*0.12;
        ctx.save();
        ctx.translate(_x, _y);
        ctx.rotate(_tilt);
        ctx.globalCompositeOperation = "lighter";
        for(var s=-1; s<=1; s+=2){
            for(var i=0; i<6; i++){
                var a = (-0.25 - i*0.2 + f*(1 + i*0.3))*1, L = 34 + i*7 - (i > 3 ? (i - 3)*9 : 0);
                var x0 = s*10, y0 = -2, x1 = s*(10 + Math.cos(a)*L), y1 = y0 + Math.sin(a)*L*0.9;
                ctx.strokeStyle = "rgba(" + DUEL_GOLD + "," + (0.55*_a) + ")";
                ctx.lineWidth = 7 - i*0.6;
                ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(s*(14 + L*0.4), y0 - 18, x1, y1); ctx.stroke();
                ctx.strokeStyle = "rgba(255,255,255," + (0.5*_a) + ")";
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(s*(14 + L*0.4), y0 - 18, x1, y1); ctx.stroke();
            }
        }
        ctx.restore();
        enemyArt.halo(_x, _y, 34, DUEL_GOLD, 0.22*_a);
    },
    //再構築プロトコル：画面のまんなかの帯と工程の記録(_mine：自分の再構築なら大きく)
    drawProtocol:function(_t,_mine){
        var k = Math.min(1, _t/20, (DUEL_REBUILD - _t)/20);
        if(k <= 0) return;
        ctx.save();
        ctx.globalAlpha = k;
        var y = _mine ? CH/2 - 150 : 70;
        ctx.fillStyle = "rgba(10,10,18,0.82)";
        ctx.fillRect(0, y - 26, CW, 52);
        ctx.fillStyle = "rgb(" + DUEL_GOLD + ")";
        ctx.fillRect(0, y - 26, CW, 2); ctx.fillRect(0, y + 24, CW, 2);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold " + (_mine ? 26 : 18) + "px sans-serif";
        ctx.fillText((_mine ? "" : this.them() + "：") + "再構築プロトコル 始動", CW/2, y);
        if(_mine){
            //工程の記録と進み具合
            ctx.textAlign = "left";
            ctx.font = "14px monospace";
            var n = Math.min(DUEL_PROTO_LOG.length, Math.floor(_t/ (DUEL_REBUILD/(DUEL_PROTO_LOG.length + 0.5))) + 1);
            for(var i=0; i<n; i++){
                ctx.fillStyle = i == n - 1 ? "#fff" : "rgba(255,255,255,0.6)";
                ctx.fillText("> " + DUEL_PROTO_LOG[i], 40, CH/2 + 10 + i*20);
            }
            var u = Math.min(1, _t/DUEL_REBUILD);
            ctx.fillStyle = "rgba(255,255,255,0.25)";
            ctx.fillRect(40, CH - 60, CW - 80, 6);
            ctx.fillStyle = "rgb(" + DUEL_GOLD + ")";
            ctx.fillRect(40, CH - 60, (CW - 80)*u, 6);
        }
        ctx.restore();
        ctx.fillStyle = "#000";
    },
    drawHud:function(){
        var o = this.other, guest = coop.role == "guest";
        var p1 = guest ? o : this.build(), p2 = guest ? this.build() : o;
        this.bar(16, 14, "P1" + (guest ? "" : "（あなた）"), p1, "rgb(" + P1_COLOR + ")", "left");
        this.bar(CW - 16, 14, "P2" + (guest ? "（あなた）" : ""), p2, "rgb(" + P2_COLOR + ")", "right");
        //やる気
        var M = mainScreen;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText("やる気", 16, 58);
        ctx.strokeStyle = "#999";
        ctx.strokeRect(50.5, 52.5, 150, 10);
        ctx.fillStyle = M.yaruki >= YARUKI_COST ? "#e07020" : "#bbb";
        ctx.fillRect(51, 53, 149*M.yaruki/YARUKI_MAX, 9);
        //長引いてダメージが上がっているとき
        var sg = this.surge();
        if(sg > 1 && this.phase == "fight"){
            ctx.textAlign = "center";
            ctx.font = "bold 15px sans-serif";
            ctx.fillStyle = "rgba(200,40,40," + (0.75 + 0.25*Math.sin(this.ft*0.15)) + ")";
            ctx.fillText("出力上昇　ダメージ×" + sg.toFixed(1), CW/2, 34);
        }
        ctx.fillStyle = "#000";
    },
    //耐久のバー(_s：その人の状態 build の形。再構築したら金色の印)
    bar:function(_x,_y,_name,_s,_color,_align){
        var w = 300, h = 16, x = _align == "left" ? _x : _x - w;
        var hp = _s && _s.hp != null ? _s.hp : this.mh, mh = (_s && _s.mh) || this.mh;
        var k = Math.max(0, Math.min(1, hp/mh));
        ctx.fillStyle = "#eee";
        ctx.fillRect(x, _y + 10, w, h);
        ctx.fillStyle = _s && _s.rb == 2 ? "rgb(" + DUEL_GOLD + ")" : (k > 0.3 ? _color : "#d22");
        if(_align == "left") ctx.fillRect(x, _y + 10, w*k, h);
        else ctx.fillRect(x + w*(1 - k), _y + 10, w*k, h);
        ctx.strokeStyle = "#333";
        ctx.strokeRect(x + 0.5, _y + 10.5, w, h);
        ctx.font = "bold 12px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = _align;
        ctx.fillStyle = _color;
        ctx.fillText(_name + (_s && _s.rb == 2 ? "　◆再構築" : "") + "　" + Math.ceil(Math.max(0, hp)) + " / " + mh, _x, _y);
        ctx.fillStyle = "#000";
    },
    drawResult:function(){
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillRect(0, CH/2 - 110, CW, 220);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "900 56px serif";
        ctx.fillStyle = this.result == "win" ? "#c33" : "#222";
        ctx.fillText(this.result == "win" ? "勝利！" : this.result == "lose" ? "敗北……" : "引き分け", CW/2, CH/2 - 50);
        ctx.font = "18px sans-serif";
        ctx.fillStyle = "#333";
        ctx.fillText(this.resultText(), CW/2, CH/2 + 8);
        if(this.t >= DUEL_RESULT_WAIT){
            ctx.font = "bold 18px sans-serif";
            duelEndButton.button("エンディングへ");
        }
        ctx.fillStyle = "#000";
    },
    //勝ち負けの文(エンディングにも出す)
    resultText:function(){
        if(this.result == "draw") return "ふたりとも倒れた……本物は、まだ決まらない";
        var winner = this.result == "win" ? this.me() : this.them();
        return "本物として残ったのは " + winner + (this.result == "win" ? "（あなた）" : "");
    }
};

//一騎打ちの画面(page 8)
var duelScreen = {
    enter:function(){ coopDuel.enter(); },
    update:function(){ coopDuel.update(); },
    draw:function(){ coopDuel.draw(); }
};
