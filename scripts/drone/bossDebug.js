//------------------------------------------------------------------------------
//  デバッグのメニュー(ボス戦だけを遊ぶ・ストーリー確認)
//  入口は専用のリンクだけ：URL に #debug を付けて開くと、タイトルに「DEBUG」ボタンが出る(キーボードの操作はない)。
//  ボス・装備の強さ・無敵を選んで、すぐボスのWAVEを始める。演出や強さの確認用
//  セーブ・ハイスコアは変えない(始める前の状態を覚えておき、終わったら戻す)。
//  途中でメニューへ戻るのは右下の「DEBUG：戻る」(sound.js の debugBack)
//------------------------------------------------------------------------------
const BOSS_DEBUG_WAVES = [5,10,15,20];
const BOSS_DEBUG_GEAR = ["弱い","標準","最強"];

//URL に #debug が付いているか(タイトルに「DEBUG」ボタンを出す)
function debugUrl(){ return /debug/.test(location.hash); }
var debugButton = new drawRect(CW - 196, 18, 104, 34);

var bossDebug = {
    menu:false,     //タイトル画面にメニューを出している
    active:false,   //デバッグのボス戦中
    gear:1,         //装備の強さ(BOSS_DEBUG_GEAR の番号)
    god:false,      //無敵
    wave:5,
    keep:null,      //始める前の進行状況(終わったら戻す)
    msg:"",
    startTime:0,

    open:function(){
        this.menu = true;
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
        if(this.gear == 0){ lv = 1; wl = 1; game.owned = { gun:1 }; game.slots = ["gun",null,null]; game.slotCount = 1; }
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

    //終わった(_result："clear" 撃破 / "over" 撃墜 / "quit" 中断)
    finish:function(_result){
        var sec = Math.round(this.startTime/60);
        this.active = false;
        save.restore(this.keep);
        this.msg = _result == "clear" ? "WAVE " + this.wave + " 撃破！（" + sec + "秒）"
                 : _result == "over" ? "WAVE " + this.wave + " 撃墜されました（" + sec + "秒）" : "中断しました";
        this.menu = true;
        page.change(0);
    },

    //戦闘中の時間を数える(mainScreen.update から)
    tick:function(){
        if(this.active && mainScreen.state == "play") this.startTime++;
    },

    //メニュー：ボスの行を押す
    rows:function(){
        var out = [];
        for(var i=0; i<BOSS_DEBUG_WAVES.length; i++) out.push(new drawRect(CW/2, GS*5.4 + i*GS*1.7, GS*16, GS*1.4));
        return out;
    },
    //メニューの下のボタン：ストーリー確認・装備・無敵・閉じる
    tools:function(){
        var out = [];
        for(var i=0; i<4; i++) out.push(new drawRect(CW/2 + (i - 1.5)*145, GS*12.5, 135, 36));
        return out;
    },
    toggleGear:function(){ this.gear = (this.gear + 1) % BOSS_DEBUG_GEAR.length; sound.play("click"); },
    toggleGod:function(){ this.god = !this.god; sound.play("click"); },
    //メニューは開いたままにする(ストーリー確認が終わるとメニューに戻る)
    startStory:function(){ storyDebug.start(); },
    updateMenu:function(){
        var r = this.rows();
        for(var i=0; i<r.length; i++){
            if(r[i].clicked()){ this.start(BOSS_DEBUG_WAVES[i]); return; }
        }
        var t = this.tools();
        if(t[0].clicked()){ this.startStory(); return; }
        if(t[1].clicked()){ this.toggleGear(); return; }
        if(t[2].clicked()){ this.toggleGod(); return; }
        if(t[3].clicked()){ this.close(); return; }
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
        ctx.fillText("DEBUG", CW/2, GS*2.7);
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText("セーブ・ハイスコアは変わりません。途中で右下の「DEBUG：戻る」を押すと、ここへ戻ります", CW/2, GS*3.8);
        var r = this.rows();
        for(var i=0; i<r.length; i++){
            var w = BOSS_DEBUG_WAVES[i];
            ctx.font = "bold 17px sans-serif";
            r[i].button("ボス戦 WAVE " + w + "　" + BOSS_TYPES[bossTypeFor(w)].name);
        }
        var t = this.tools();
        var labels = ["ストーリー確認", "装備「" + BOSS_DEBUG_GEAR[this.gear] + "」", "無敵「" + (this.god ? "オン" : "オフ") + "」", "閉じる"];
        ctx.font = "bold 14px sans-serif";
        for(var i=0; i<t.length; i++) t[i].button(labels[i]);
        if(this.msg){
            ctx.textAlign = "center";
            ctx.font = "bold 15px sans-serif";
            ctx.fillStyle = "#c33";
            ctx.fillText(this.msg, CW/2, GS*14.2);
        }
        ctx.fillStyle = "#000";
    },

    //戦闘中の表示(画面上の中央、FPSの下)
    drawTag:function(){
        if(!this.active) return;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#c33";
        ctx.fillText("DEBUG ボス戦　装備「" + BOSS_DEBUG_GEAR[this.gear] + "」" + (this.god ? "　無敵" : "") + "　右下の「DEBUG：戻る」で戻る", CW/2, 24);
        ctx.fillStyle = "#000";
    }
};
