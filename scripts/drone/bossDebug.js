//------------------------------------------------------------------------------
//  デバッグのメニュー(ボス戦だけを遊ぶ・武器試用・ストーリー確認)
//  入口は専用のリンクだけ：URL に #debug を付けて開くと、タイトルに「DEBUG」ボタンが出る(キーボードの操作はない)。
//  ボス・装備の強さ・無敵を選んで、すぐボスのWAVEを始める。演出や強さの確認用
//  武器試用：好きな装備を3つまで選び、尽きずに出てくる雑魚敵を相手に試す(無敵。与えたダメージを毎秒で出す)
//  セーブ・ハイスコアは変えない(始める前の状態を覚えておき、終わったら戻す)。
//  途中でメニューへ戻るのは右下の「DEBUG：戻る」(sound.js の debugBack)
//------------------------------------------------------------------------------
const BOSS_DEBUG_WAVES = [5,10,15,20];
const BOSS_DEBUG_GEAR = ["弱い","標準","最強"];
//武器試用
const TRIAL_WAVES = [3,8,13,18];    //敵の強さ(そのWAVEの雑魚敵が出る。ボスのWAVEは選ばない)
const TRIAL_MAX_ENEMIES = 25;       //画面にいる敵の上限(これより多いときは出さずに待つ)
const TRIAL_DPS_SEC = 5;            //戦闘中に出す「毎秒ダメージ」は直近この秒数の平均
const TRIAL_COLS = 5;               //装備の一覧の列の数

//URL に #debug が付いているか(タイトルに「DEBUG」ボタンを出す)
function debugUrl(){ return /debug/.test(location.hash); }
var debugButton = new drawRect(CW - 196, 18, 104, 34);

var bossDebug = {
    menu:false,     //タイトル画面にメニューを出している
    active:false,   //デバッグのボス戦・武器試用の戦闘中
    gear:1,         //装備の強さ(BOSS_DEBUG_GEAR の番号)
    god:false,      //無敵
    wave:5,
    keep:null,      //始める前の進行状況(終わったら戻す)
    msg:"",
    startTime:0,
    //武器試用
    picking:false,              //メニューで装備を選んでいる
    trial:false,                //武器試用の戦闘中
    trialArms:["gun","missile","tesla"],    //選んだ装備(並びがそのまま装備枠の順)
    trialLv:MAX_WEAPON_LEVEL,   //装備のレベル
    trialStat:3,                //能力のレベル(全部この値)
    trialWave:1,                //敵の強さ(TRIAL_WAVES の番号)
    dmg:0,                      //与えたダメージの合計
    kills:0,
    secs:[],                    //1秒ごとのダメージ(直近 TRIAL_DPS_SEC 秒分)
    secDmg:0,                   //今の1秒のダメージ

    open:function(){
        this.menu = true;
        this.picking = false;
        this.msg = "";
        sound.play("click");
    },
    close:function(){
        this.menu = false;
    },

    //装備・能力を用意する(標準は、そのWAVEまで遊んだときのだいたいの強さ)
    prepare:function(_w){
        game.reset();
        game.wave = _w;
        //ストーリーは見たことにして、ボスまで流れないように
        for(var i=0; i<STORY_ORDER.length; i++) game.seen[STORY_ORDER[i]] = true;
        var lv, wl;
        if(this.trial){
            lv = this.trialStat;
            game.owned = {};
            game.slots = [null,null,null];
            for(var i=0; i<this.trialArms.length; i++){
                game.owned[this.trialArms[i]] = this.trialLv;
                game.slots[i] = this.trialArms[i];
            }
            game.slotCount = 3;
        }else if(this.gear == 0){ lv = 1; wl = 1; game.owned = { gun:1 }; game.slots = ["gun",null,null]; game.slotCount = 1; }
        else{
            lv = this.gear == 2 ? MAX_LEVEL : Math.min(MAX_LEVEL, 1 + Math.floor(_w/6));
            wl = this.gear == 2 ? MAX_WEAPON_LEVEL : Math.min(MAX_WEAPON_LEVEL, 1 + Math.floor(_w/7));
            game.owned = { gun:wl, missile:wl, tesla:wl };
            game.slots = ["gun","missile","tesla"];
            game.slotCount = 3;
        }
        for(var k in game.level) game.level[k] = lv;
    },

    start:function(_w){
        this.keep = save.data();
        this.wave = _w;
        this.prepare(_w);
        this.menu = false;
        this.active = true;
        this.startTime = 0;
        page.change(1);
    },
    //武器試用を始める
    startTrial:function(){
        if(this.trialArms.length == 0) return;
        this.trial = true;
        this.dmg = 0; this.kills = 0; this.secs = []; this.secDmg = 0;
        this.start(TRIAL_WAVES[this.trialWave]);
    },

    //終わった(_result："clear" 撃破 / "over" 撃墜 / "quit" 中断)
    finish:function(_result){
        var sec = Math.round(this.startTime/60);
        this.active = false;
        save.restore(this.keep);
        if(this.trial){
            this.trial = false;
            this.picking = true;
            this.msg = "前回：" + this.armsText() + "　毎秒ダメージ " + this.dps(false).toFixed(1) + "・撃破 " + this.kills + "（" + sec + "秒）";
        }else{
            this.msg = _result == "clear" ? "WAVE " + this.wave + " 撃破！（" + sec + "秒）"
                     : _result == "over" ? "WAVE " + this.wave + " 撃墜されました（" + sec + "秒）" : "中断しました";
        }
        this.menu = true;
        page.change(0);
    },

    //戦闘中の時間を数える(mainScreen.update から)
    tick:function(){
        if(!this.active || mainScreen.state != "play") return;
        this.startTime++;
        if(this.trial && this.startTime % 60 == 0){
            this.secs.push(this.secDmg);
            if(this.secs.length > TRIAL_DPS_SEC) this.secs.shift();
            this.secDmg = 0;
        }
    },
    //武器試用：敵に与えたダメージを数える(mainScreen.hitEnemy から。倒すのに要らなかった分も入れる)
    dealt:function(_e,_dmg){
        if(!this.trial) return;
        this.dmg += _dmg;
        this.secDmg += _dmg;
        if(_e.hp - _dmg <= 0) this.kills++;
    },
    //毎秒ダメージ(_recent：直近 TRIAL_DPS_SEC 秒の平均 / そうでなければ始めからの平均)
    dps:function(_recent){
        if(!_recent) return this.startTime > 0 ? this.dmg/(this.startTime/60) : 0;
        if(this.secs.length == 0) return 0;
        var sum = 0;
        for(var i=0; i<this.secs.length; i++) sum += this.secs[i];
        return sum/this.secs.length;
    },
    //選んだ装備の名前(「実弾+ミサイル Lv.3」)
    armsText:function(){
        return this.trialArms.map(function(id){ return WEAPONS[id].name; }).join("+") + " Lv." + this.trialLv;
    },

    //メニュー：ボスの行を押す
    rows:function(){
        var out = [];
        for(var i=0; i<BOSS_DEBUG_WAVES.length; i++) out.push(new drawRect(CW/2, GS*5.4 + i*GS*1.7, GS*16, GS*1.4));
        return out;
    },
    //メニューの下のボタン：ストーリー確認・武器試用・装備・無敵・閉じる
    tools:function(){
        var out = [];
        for(var i=0; i<5; i++) out.push(new drawRect(CW/2 + (i - 2)*116, GS*12.5, 110, 36));
        return out;
    },
    //武器試用：装備の一覧(WEAPON_IDS の順)
    armButtons:function(){
        var out = [];
        for(var i=0; i<WEAPON_IDS.length; i++){
            var c = i % TRIAL_COLS, r = Math.floor(i/TRIAL_COLS);
            out.push(new drawRect(CW/2 + (c - (TRIAL_COLS-1)/2)*116, GS*4.6 + r*42, 110, 34));
        }
        return out;
    },
    //武器試用：設定のボタン(装備のレベル・能力・敵の強さ・選び直す)と、開始・戻る
    trialOpts:function(){
        var out = [];
        for(var i=0; i<4; i++) out.push(new drawRect(CW/2 + (i - 1.5)*145, GS*10.3, 135, 34));
        return out;
    },
    trialGo:function(){
        return [new drawRect(CW/2 - 80, GS*12.3, 145, 38), new drawRect(CW/2 + 80, GS*12.3, 145, 38)];
    },
    toggleGear:function(){ this.gear = (this.gear + 1) % BOSS_DEBUG_GEAR.length; sound.play("click"); },
    toggleGod:function(){ this.god = !this.god; sound.play("click"); },
    //メニューは開いたままにする(ストーリー確認が終わるとメニューに戻る)
    startStory:function(){ storyDebug.start(); },
    openTrial:function(){ this.picking = true; this.msg = ""; sound.play("click"); },
    //装備を押す：選んでいれば外す、3つ未満なら足す
    pickArm:function(_id){
        var i = this.trialArms.indexOf(_id);
        if(i >= 0) this.trialArms.splice(i,1);
        else if(this.trialArms.length < 3) this.trialArms.push(_id);
        else{ sound.play("error"); return; }
        sound.play("click");
    },
    updateMenu:function(){
        if(this.picking){ this.updateTrial(); return; }
        var r = this.rows();
        for(var i=0; i<r.length; i++){
            if(r[i].clicked()){ this.start(BOSS_DEBUG_WAVES[i]); return; }
        }
        var t = this.tools();
        if(t[0].clicked()){ this.startStory(); return; }
        if(t[1].clicked()){ this.openTrial(); return; }
        if(t[2].clicked()){ this.toggleGear(); return; }
        if(t[3].clicked()){ this.toggleGod(); return; }
        if(t[4].clicked()){ this.close(); return; }
    },
    updateTrial:function(){
        var a = this.armButtons();
        for(var i=0; i<a.length; i++){
            if(a[i].clicked()){ this.pickArm(WEAPON_IDS[i]); return; }
        }
        var o = this.trialOpts();
        if(o[0].clicked()){ this.trialLv = this.trialLv % MAX_WEAPON_LEVEL + 1; sound.play("click"); return; }
        if(o[1].clicked()){ this.trialStat = this.trialStat % MAX_LEVEL + 1; sound.play("click"); return; }
        if(o[2].clicked()){ this.trialWave = (this.trialWave + 1) % TRIAL_WAVES.length; sound.play("click"); return; }
        if(o[3].clicked()){ this.trialArms = []; sound.play("click"); return; }
        var g = this.trialGo();
        if(g[0].clicked() && this.trialArms.length > 0){ this.startTrial(); return; }
        if(g[1].clicked()){ this.picking = false; this.msg = ""; sound.play("click"); return; }
    },
    drawMenu:function(){
        ctx.fillStyle = "rgba(255,255,255,0.75)";   //後ろのタイトル画面を薄く隠す
        ctx.fillRect(0,0,CW,CH);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.fillRect(GS*6, GS*1.5, CW - GS*12, CH - GS*3);
        ctx.strokeStyle = "#c33";
        ctx.lineWidth = 2;
        ctx.strokeRect(GS*6, GS*1.5, CW - GS*12, CH - GS*3);
        ctx.lineWidth = 1;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#c33";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText(this.picking ? "DEBUG　武器試用" : "DEBUG", CW/2, GS*2.7);
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#555";
        if(this.picking) this.drawTrial();
        else{
            ctx.fillText("セーブ・ハイスコアは変わりません。途中で右下の「DEBUG：戻る」を押すと、ここへ戻ります", CW/2, GS*3.8);
            var r = this.rows();
            for(var i=0; i<r.length; i++){
                var w = BOSS_DEBUG_WAVES[i];
                ctx.font = "bold 17px sans-serif";
                r[i].button("ボス戦 WAVE " + w + "　" + BOSS_TYPES[bossTypeFor(w)].name);
            }
            var t = this.tools();
            var labels = ["ストーリー確認", "武器試用", "装備「" + BOSS_DEBUG_GEAR[this.gear] + "」", "無敵「" + (this.god ? "オン" : "オフ") + "」", "閉じる"];
            ctx.font = "bold 14px sans-serif";
            for(var i=0; i<t.length; i++) t[i].button(labels[i]);
        }
        if(this.msg){
            ctx.textAlign = "center";
            ctx.font = "bold 15px sans-serif";
            ctx.fillStyle = "#c33";
            ctx.fillText(this.msg, CW/2, GS*14.2);
        }
        ctx.fillStyle = "#000";
    },
    //武器試用の画面：装備の一覧・シナジー・設定
    drawTrial:function(){
        ctx.fillText("装備を3つまで選びます(押した順に装備枠へ)。敵は尽きずに出てきます。無敵", CW/2, GS*3.8);
        var a = this.armButtons();
        for(var i=0; i<a.length; i++){
            var id = WEAPON_IDS[i], W = WEAPONS[id];
            var n = this.trialArms.indexOf(id);
            ctx.font = "bold 14px sans-serif";
            if(n >= 0){
                //選んだ装備は装備の色で塗り、枠の番号を出す
                a[i].fill(W.color);
                ctx.fillStyle = "#fff";
                a[i].text((n+1) + ". " + W.name);
            }else{
                a[i].button(W.name, this.trialArms.length < 3);
            }
        }
        //選んだ組み合わせで発動するシナジー
        var syn = SYNERGIES.filter(function(s){
            return bossDebug.trialArms.indexOf(s.a) >= 0 && bossDebug.trialArms.indexOf(s.b) >= 0;
        }).map(function(s){ return s.name; });
        ctx.textAlign = "center";
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = syn.length ? "#a60" : "#888";
        ctx.fillText("シナジー：" + (syn.length ? syn.join("・") : "なし"), CW/2, GS*9.5);
        var o = this.trialOpts();
        var labels = ["装備 Lv." + this.trialLv, "能力 Lv." + this.trialStat, "敵 WAVE " + TRIAL_WAVES[this.trialWave], "選び直す"];
        for(var i=0; i<o.length; i++) o[i].button(labels[i]);
        var g = this.trialGo();
        ctx.font = "bold 16px sans-serif";
        g[0].button("開始", this.trialArms.length > 0);
        g[1].button("戻る");
    },

    //戦闘中の表示(画面上の中央、FPSの下)
    drawTag:function(){
        if(!this.active) return;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#c33";
        if(this.trial){
            ctx.fillText("DEBUG 武器試用　" + this.armsText() + "　右下の「DEBUG：戻る」で戻る", CW/2, 24);
            ctx.font = "bold 14px sans-serif";
            ctx.fillText("毎秒ダメージ " + this.dps(true).toFixed(1) + "（直近" + TRIAL_DPS_SEC + "秒）　撃破 " + this.kills, CW/2, 42);
        }else{
            ctx.fillText("DEBUG ボス戦　装備「" + BOSS_DEBUG_GEAR[this.gear] + "」" + (this.god ? "　無敵" : "") + "　右下の「DEBUG：戻る」で戻る", CW/2, 24);
        }
        ctx.fillStyle = "#000";
    }
};
