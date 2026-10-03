//------------------------------------------------------------------------------
//  タイトル画面
//  左：ロゴ(ドット文字の「ドローン君」＋赤い四角)と記録。後ろでレーダーがゆっくり回る
//  右：メニュー(ひとりで／ふたりで)。マウスを乗せると黒く反転して「▶」が出る
//  開いたときに、ロゴがふわっと出て、メニューが右から順に滑り込む
//------------------------------------------------------------------------------
const TITLE_FONT = '"DotGothic16","Zen Kaku Gothic New",monospace';   //ロゴの文字(ページの見出しと同じ)
const TITLE_UI_FONT = '"Zen Kaku Gothic New","Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif';
const TITLE_INK = "#1b1d1f";
const TITLE_ACCENT = "#d23a32";
const TITLE_PAPER = "#f7f7f4";
const TITLE_LOGO_X = 300;       //ロゴ・レーダーの中心
const TITLE_LOGO_Y = 215;
const TITLE_MENU_X = 690;       //メニューの中心
const TITLE_IN_TIME = 40;       //ロゴ・メニューが出そろうまでの時間(フレーム)
const TITLE_SHADOWS = 5;        //遠くを横切る小さなドローン君の影の数

//------------------------------------------------------------------------------
//  メニューのボタン(右側に縦に並べる)
//------------------------------------------------------------------------------
var startButton    = new drawRect(TITLE_MENU_X, 160, 300, 46);
var continueButton = new drawRect(TITLE_MENU_X, 214, 300, 46);
var coopButton     = new drawRect(TITLE_MENU_X, 300, 300, 46);
var versusButton   = new drawRect(TITLE_MENU_X, 354, 300, 46);

//右上の設定ボタンと、設定の窓(ドローン君の見た目を選ぶ)
var settingsButton = new drawRect(CW - 78, 18, 104, 34);
const SETTINGS_W = 520;     //設定の窓の大きさ
const SETTINGS_H = 310;
const SETTINGS_Y = 115;
var settingsClose = new drawRect(CW/2, SETTINGS_Y + SETTINGS_H - 62, 160, 40);
var skinCards = [new drawRect(CW/2 - 118, SETTINGS_Y + 70, 210, 160), new drawRect(CW/2 + 118, SETTINGS_Y + 70, 210, 160)];

//遠くを横切るドローン君の影(背景の飾り)
var titleShadows = [];
for(var i=0; i<TITLE_SHADOWS; i++){
    titleShadows.push({ x:Math.random()*CW, y:60 + i*(CH - 140)/TITLE_SHADOWS + Math.random()*30,
                        sp:0.25 + Math.random()*0.35, sc:0.35 + Math.random()*0.25, look:new DroneLook() });
}

//------------------------------------------------------------------------------
//  スタート画面処理
//------------------------------------------------------------------------------
var startScreen = {
    hasSave:false,
    best:0,
    t:0,            //開いてからのフレーム数(登場の動き・レーダーの回転)
    hover:-1,       //マウスが乗っているメニューの番号
    blips:[],       //レーダーに映る点
    settings:false, //設定の窓を開いているか
    setHover:-1,    //設定の窓でマウスが乗っているもの(0,1:見た目 2:閉じる)
    enter:function(){
        this.hasSave = save.exists();
        this.best = save.getBest();
        try{ this.cleared = localStorage.getItem("dronekun_cleared") == "1"; }catch(e){ this.cleared = false; }
        drone.resetStats();
        this.t = 0;
        this.hover = -1;
        this.settings = false;
    },
    //メニューの一覧([ボタン, 文字, 押せるか])
    items:function(){
        return [
            [startButton, "はじめから", true],
            [continueButton, "つづきから", this.hasSave],
            [coopButton, "協力プレイ", true],
            [versusButton, "対戦", true]
        ];
    },
    update:function(){
        this.t++;
        this.updateBackground();
        //デバッグのボス戦メニューを出している間は、タイトルのボタンを押せない(bossDebug.js)
        if(bossDebug.menu){
            bossDebug.updateMenu();
            return;
        }
        if(this.settings){
            this.updateSettings();
            return;
        }
        //デバッグのメニューを開く(URL に #debug を付けたときだけボタンが出る。スマホ用。bossDebug.js)
        if(debugUrl() && debugButton.clicked()){
            bossDebug.open();
            return;
        }
        //設定の窓を開く(見た目をすべて用意しておく。並べて見せるため)
        if(settingsButton.clicked()){
            sound.play("click");
            this.settings = true;
            this.setHover = -1;
            for(var i=0; i<droneSkin.list.length; i++) droneSkin.prepare(droneSkin.list[i].id);
            return;
        }
        //マウスが乗ったメニューが変わったら、小さく音を鳴らす
        var list = this.items(), h = -1;
        for(var i=0; i<list.length; i++) if(list[i][2] && list[i][0].contains(MouseX,MouseY)) h = i;
        if(settingsButton.contains(MouseX,MouseY)) h = list.length;
        if(h != this.hover && h >= 0) sound.play("hover");
        this.hover = h;

        //はじめから：セーブを消してWAVE1へ
        if(startButton.clicked()){
            sound.play("click");
            save.clear();
            game.reset();
            //プロローグを見てからWAVE1へ
            storyScreen.start("prologue",function(){ page.change(1); });
            return;
        }
        //つづきから：セーブを読み込んで強化画面へ(見ていないストーリーがあれば先に)
        if(continueButton.clicked() && this.hasSave && save.load()){
            sound.play("click");
            goUpgrade();
            return;
        }
        //ふたりで協力プレイ：部屋選びへ(coop.js)
        if(coopButton.clicked()){
            sound.play("click");
            this.notice = "";
            if(!coop.inRoom) coop.mode = "coop";
            page.change(6);
            return;
        }
        //ふたりで対戦：同じ部屋選びの画面を対戦用に使う(versus.js)
        if(versusButton.clicked()){
            sound.play("click");
            this.notice = "";
            if(!coop.inRoom) coop.mode = "vs";
            page.change(6);
            return;
        }

        //ドローン
        drone.update();
    },

    //背景：影のドローン君が横切り、レーダーに点が映っては消える
    updateBackground:function(){
        for(var i=0; i<titleShadows.length; i++){
            var s = titleShadows[i];
            s.x += s.sp;
            if(s.x > CW + 40){ s.x = -40; s.y = 60 + Math.random()*(CH - 140); }
            s.look.update(4, s.sp);
        }
        //レーダーの線が通ったところに、ときどき点が映る
        if(this.t % 40 == 0){
            var a = this.sweepAngle() - 0.15, r = 60 + Math.random()*150;
            this.blips.push({ x:TITLE_LOGO_X + Math.cos(a)*r, y:TITLE_LOGO_Y + Math.sin(a)*r, life:120 });
        }
        for(var i=this.blips.length-1; i>=0; i--) if(--this.blips[i].life <= 0) this.blips.splice(i,1);
    },
    sweepAngle:function(){ return this.t*0.018; },

    //------------------------------------------------------------------ 描画
    draw:function(){
        this.drawBackground();
        this.drawLogo();
        this.drawMenu();

        //協力プレイなどから戻ったときのお知らせ
        if(this.notice){
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 13px " + TITLE_UI_FONT;
            ctx.fillStyle = TITLE_ACCENT;
            ctx.fillText(this.notice, TITLE_MENU_X, 422);
        }

        //遊び方(左下に小さく)
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "12px " + TITLE_UI_FONT;
        ctx.fillStyle = "#6a6f6c";
        ctx.fillText(inputMode == "touch"
            ? "ドラッグでドローン君を誘導　／　敵には自動で攻撃　／　右下のボタンで衝撃波"
            : "マウスでドローン君を誘導　／　敵には自動で攻撃　／　クリックで衝撃波（燃料を消費）", GS, CH - 44);
        ctx.fillText("WAVEクリアで装備を獲得。相性の良い装備を組み合わせるとシナジーが発動", GS, CH - 24);
        ctx.fillStyle = "#000";

        //ドローン表示
        drone.draw();
        if(bossDebug.menu) bossDebug.drawMenu();
        if(this.settings) this.drawSettings();
    },

    drawBackground:function(){
        ctx.fillStyle = TITLE_PAPER;
        ctx.fillRect(0,0,CW,CH);
        //方眼(本編の戦闘画面と同じ大きさ)
        ctx.strokeStyle = "rgba(0,0,0,0.045)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(var x=0; x<=CW; x+=GS){ ctx.moveTo(x + 0.5,0); ctx.lineTo(x + 0.5,CH); }
        for(var y=0; y<=CH; y+=GS){ ctx.moveTo(0,y + 0.5); ctx.lineTo(CW,y + 0.5); }
        ctx.stroke();
        //遠くを横切るドローン君の影
        ctx.globalAlpha = 0.12;
        for(var i=0; i<titleShadows.length; i++){
            var s = titleShadows[i];
            s.look.draw(s.x, s.y, s.sc);
        }
        ctx.globalAlpha = 1;
        //レーダー：輪・十字・回る扇・映った点
        var cx = TITLE_LOGO_X, cy = TITLE_LOGO_Y;
        ctx.strokeStyle = "rgba(0,0,0,0.07)";
        for(var r=70; r<=230; r+=80){ ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke(); }
        ctx.beginPath();
        ctx.moveTo(cx - 240,cy); ctx.lineTo(cx + 240,cy);
        ctx.moveTo(cx,cy - 240); ctx.lineTo(cx,cy + 240);
        ctx.stroke();
        var a = this.sweepAngle();
        for(var i=0; i<14; i++){
            ctx.fillStyle = "rgba(210,58,50," + (0.08*(1 - i/14)) + ")";
            ctx.beginPath();
            ctx.moveTo(cx,cy);
            ctx.arc(cx,cy,230,a - (i + 1)*0.04,a - i*0.04);
            ctx.closePath();
            ctx.fill();
        }
        for(var i=0; i<this.blips.length; i++){
            var b = this.blips[i];
            ctx.fillStyle = "rgba(210,58,50," + (0.5*b.life/120) + ")";
            ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
        }
    },

    //ロゴと記録(ふわっと出る)
    drawLogo:function(){
        var k = Math.min(1, this.t/TITLE_IN_TIME), e = 1 - Math.pow(1 - k, 3);
        var cx = TITLE_LOGO_X, cy = TITLE_LOGO_Y + (1 - e)*12;
        ctx.save();
        ctx.globalAlpha = e;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        //英語の小見出し(左右に細い線)
        ctx.font = "bold 13px " + TITLE_UI_FONT;
        ctx.fillStyle = "#6a6f6c";
        var en = "D R O N E - K U N";
        ctx.fillText(en, cx, cy - 62);
        var w = ctx.measureText(en).width/2 + 14;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(cx - w - 40, cy - 62, 40, 1);
        ctx.fillRect(cx + w, cy - 62, 40, 1);
        //ロゴ：少しずらした影＋本体＋赤い四角
        ctx.font = "78px " + TITLE_FONT;
        var lw = ctx.measureText("ドローン君").width;
        var lx = cx - 12;
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillText("ドローン君", lx + 4, cy + 4);
        ctx.fillStyle = TITLE_INK;
        ctx.fillText("ドローン君", lx, cy);
        ctx.fillStyle = TITLE_ACCENT;
        ctx.fillRect(lx + lw/2 + 6, cy + 18, 14, 14);
        //ひとこと
        ctx.font = "14px " + TITLE_UI_FONT;
        ctx.fillStyle = "#444";
        ctx.fillText("全" + FINAL_WAVE + "WAVEのストーリー付きシューティング", cx, cy + 62);
        //記録
        if(this.best > 0 || this.cleared){
            ctx.font = "bold 13px " + TITLE_UI_FONT;
            var rec = "HIGH SCORE  " + this.best;
            var rw = ctx.measureText(rec).width + 28;
            var bx = cx - rw/2 - (this.cleared ? 46 : 0);
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
            ctx.lineWidth = 1;
            ctx.strokeRect(bx + 0.5, cy + 92.5, rw, 26);
            ctx.fillStyle = TITLE_INK;
            ctx.fillText(rec, bx + rw/2, cy + 106);
            if(this.cleared){
                ctx.fillStyle = TITLE_ACCENT;
                ctx.fillRect(bx + rw + 8, cy + 92, 84, 27);
                ctx.fillStyle = "#fff";
                ctx.fillText("★ CLEAR", bx + rw + 50, cy + 106);
            }
        }
        ctx.restore();
    },

    //メニュー(右から順に滑り込む。乗せると黒く反転)
    drawMenu:function(){
        var list = this.items();
        ctx.textBaseline = "middle";
        //見出し
        var hk = Math.min(1, this.t/TITLE_IN_TIME);
        ctx.globalAlpha = hk;
        ctx.textAlign = "left";
        ctx.font = "bold 12px " + TITLE_UI_FONT;
        ctx.fillStyle = "#6a6f6c";
        ctx.fillText("ひとりで", startButton.X, startButton.Y - 14);
        ctx.fillText("ふたりで（インターネット）", coopButton.X, coopButton.Y - 14);
        ctx.globalAlpha = 1;
        for(var i=0; i<list.length; i++){
            var b = list[i][0], label = list[i][1], ok = list[i][2];
            //登場：少しずつ遅れて右から
            var k = Math.min(1, Math.max(0, (this.t - 6 - i*5)/(TITLE_IN_TIME - 10)));
            var e = 1 - Math.pow(1 - k, 3);
            var dx = (1 - e)*60;
            var on = ok && this.hover == i && !bossDebug.menu;
            ctx.save();
            ctx.globalAlpha = e;
            ctx.translate(dx + (on ? 6 : 0), 0);
            //影
            if(ok){
                ctx.fillStyle = "rgba(0,0,0,0.12)";
                ctx.fillRect(b.X + 4, b.Y + 4, b.width, b.height);
            }
            ctx.fillStyle = on ? TITLE_INK : (ok ? "#fff" : "rgba(255,255,255,0.6)");
            ctx.fillRect(b.X, b.Y, b.width, b.height);
            ctx.strokeStyle = ok ? TITLE_INK : "#c9ccc7";
            ctx.lineWidth = 2;
            ctx.strokeRect(b.X + 1, b.Y + 1, b.width - 2, b.height - 2);
            ctx.lineWidth = 1;
            //左の赤い印(はじめからだけ)・乗せたときの▶
            if(i == 0 && !on){
                ctx.fillStyle = TITLE_ACCENT;
                ctx.fillRect(b.X + 2, b.Y + 2, 5, b.height - 4);
            }
            ctx.textAlign = "left";
            ctx.font = "bold 18px " + TITLE_UI_FONT;
            ctx.fillStyle = on ? "#fff" : (ok ? TITLE_INK : "#b5b8b3");
            ctx.fillText(label, b.X + 40, b.Y + b.height/2 + 1);
            if(on){
                ctx.fillStyle = TITLE_ACCENT;
                ctx.fillText("▶", b.X + 14, b.Y + b.height/2 + 1);
            }
            //右の小さな説明
            ctx.textAlign = "right";
            ctx.font = "11px " + TITLE_UI_FONT;
            ctx.fillStyle = on ? "rgba(255,255,255,0.7)" : "#8a8f8b";
            var sub = ["プロローグから", ok ? "セーブから再開" : "セーブなし", "ストーリーをふたりで", "1対1"][i];
            ctx.fillText(sub, b.X + b.width - 14, b.Y + b.height/2 + 1);
            ctx.restore();
            ctx.restore();
        }
        this.drawSettingsButton();
        if(debugUrl()) this.drawDebugButton();
        ctx.fillStyle = "#000";
    },

    //------------------------------------------------------------------ 設定
    //右上の設定ボタン(乗せると黒く反転)
    drawSettingsButton:function(){
        var b = settingsButton;
        var on = this.hover == this.items().length && !this.settings && !bossDebug.menu;
        ctx.globalAlpha = Math.min(1, this.t/TITLE_IN_TIME);
        ctx.fillStyle = on ? TITLE_INK : "#fff";
        ctx.fillRect(b.X, b.Y, b.width, b.height);
        ctx.strokeStyle = TITLE_INK;
        ctx.lineWidth = 2;
        ctx.strokeRect(b.X + 1, b.Y + 1, b.width - 2, b.height - 2);
        ctx.lineWidth = 1;
        //歯車の印(丸と8本の歯)
        var gx = b.X + 22, gy = b.Y + b.height/2;
        ctx.strokeStyle = on ? "#fff" : TITLE_INK;
        ctx.lineWidth = 2.5;
        for(var i=0; i<8; i++){
            var a = i*Math.PI/4;
            ctx.beginPath();
            ctx.moveTo(gx + Math.cos(a)*5, gy + Math.sin(a)*5);
            ctx.lineTo(gx + Math.cos(a)*8, gy + Math.sin(a)*8);
            ctx.stroke();
        }
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(gx, gy, 4.5, 0, Math.PI*2); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 15px " + TITLE_UI_FONT;
        ctx.fillStyle = on ? "#fff" : TITLE_INK;
        ctx.fillText("設定", b.X + 42, gy + 1);
        ctx.globalAlpha = 1;
    },

    //デバッグのメニューを開くボタン(赤い枠。乗せると赤く反転)
    drawDebugButton:function(){
        var b = debugButton;
        var on = b.contains(MouseX,MouseY) && !this.settings && !bossDebug.menu;
        ctx.fillStyle = on ? TITLE_ACCENT : "#fff";
        ctx.fillRect(b.X, b.Y, b.width, b.height);
        ctx.strokeStyle = TITLE_ACCENT;
        ctx.lineWidth = 2;
        ctx.strokeRect(b.X + 1, b.Y + 1, b.width - 2, b.height - 2);
        ctx.lineWidth = 1;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 15px " + TITLE_UI_FONT;
        ctx.fillStyle = on ? "#fff" : TITLE_ACCENT;
        ctx.fillText("DEBUG", b.X + b.width/2, b.Y + b.height/2 + 1);
    },

    //設定の窓：ドローン君の見た目を選ぶ。選ぶとすぐ切り替わり、覚える。Esc か「閉じる」で閉じる
    updateSettings:function(){
        var h = -1;
        for(var i=0; i<skinCards.length; i++) if(skinCards[i].contains(MouseX,MouseY)) h = i;
        if(settingsClose.contains(MouseX,MouseY)) h = skinCards.length;
        if(h != this.setHover && h >= 0) sound.play("hover");
        this.setHover = h;
        for(var i=0; i<skinCards.length; i++){
            if(skinCards[i].clicked()){
                sound.play("click");
                droneSkin.set(droneSkin.list[i].id);
                return;
            }
        }
        if(settingsClose.clicked()){
            sound.play("click");
            this.closeSettings();
        }
    },
    closeSettings:function(){
        this.settings = false;
        this.hover = -1;
    },

    drawSettings:function(){
        //後ろを薄く隠す
        ctx.fillStyle = "rgba(247,247,244,0.85)";
        ctx.fillRect(0,0,CW,CH);
        //窓
        var px = CW/2 - SETTINGS_W/2, py = SETTINGS_Y;
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(px + 6, py + 6, SETTINGS_W, SETTINGS_H);
        ctx.fillStyle = "#fff";
        ctx.fillRect(px, py, SETTINGS_W, SETTINGS_H);
        ctx.strokeStyle = TITLE_INK;
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 1, py + 1, SETTINGS_W - 2, SETTINGS_H - 2);
        ctx.lineWidth = 1;
        ctx.fillStyle = TITLE_ACCENT;
        ctx.fillRect(px + 2, py + 2, 5, 44);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 20px " + TITLE_UI_FONT;
        ctx.fillStyle = TITLE_INK;
        ctx.fillText("設定", px + 26, py + 25);
        ctx.font = "bold 12px " + TITLE_UI_FONT;
        ctx.fillStyle = "#6a6f6c";
        ctx.fillText("ドローン君の見た目", px + 26, py + 58);

        //見た目のカード(ドローン君がゆっくり回って見える)
        for(var i=0; i<skinCards.length; i++){
            var c = skinCards[i], s = droneSkin.list[i];
            var sel = droneSkin.current == s.id, on = this.setHover == i;
            ctx.fillStyle = on && !sel ? "#f0f0ec" : "#fff";
            ctx.fillRect(c.X, c.Y, c.width, c.height);
            ctx.strokeStyle = sel || on ? TITLE_INK : "#c9ccc7";
            ctx.lineWidth = sel ? 3 : 2;
            ctx.strokeRect(c.X + 1, c.Y + 1, c.width - 2, c.height - 2);
            ctx.lineWidth = 1;
            var sh = droneSkin.sheets[s.id];
            if(sh){
                var col = Math.floor(this.t*sh.yaws/224) % sh.yaws;   //どの見た目も同じ速さで回す(1周約4秒)
                var bob = Math.round(Math.sin(this.t*0.08)*2);
                //2倍で描くので、画面の細かさも合わせて近い大きさの絵を使う(ドット絵は等倍の絵を拡大)
                var lv = sh.pixel ? 0 : (2*renderScale <= 2.5 ? 1 : 2);
                var src = sh[lv], f = DRONE_SIZE << lv;
                ctx.imageSmoothingEnabled = !sh.pixel;
                ctx.drawImage(src, col*f, (sh.elevs - 1)/2*f, f, f, c.X + c.width/2 - 40, c.Y + 22 + bob, 80, 80);
                ctx.imageSmoothingEnabled = false;
            }
            ctx.textAlign = "center";
            ctx.font = "bold 16px " + TITLE_UI_FONT;
            ctx.fillStyle = TITLE_INK;
            ctx.fillText(s.name, c.X + c.width/2, c.Y + 122);
            ctx.font = "11px " + TITLE_UI_FONT;
            ctx.fillStyle = "#8a8f8b";
            ctx.fillText(s.sub, c.X + c.width/2, c.Y + 143);
            //選んでいる印
            if(sel){
                ctx.fillStyle = TITLE_ACCENT;
                ctx.fillRect(c.X, c.Y, 62, 22);
                ctx.font = "bold 11px " + TITLE_UI_FONT;
                ctx.fillStyle = "#fff";
                ctx.fillText("使用中", c.X + 31, c.Y + 11);
            }
        }

        //閉じる
        var b = settingsClose, on = this.setHover == skinCards.length;
        ctx.fillStyle = on ? TITLE_INK : "#fff";
        ctx.fillRect(b.X, b.Y, b.width, b.height);
        ctx.strokeStyle = TITLE_INK;
        ctx.lineWidth = 2;
        ctx.strokeRect(b.X + 1, b.Y + 1, b.width - 2, b.height - 2);
        ctx.lineWidth = 1;
        ctx.textAlign = "center";
        ctx.font = "bold 15px " + TITLE_UI_FONT;
        ctx.fillStyle = on ? "#fff" : TITLE_INK;
        ctx.fillText("閉じる", b.X + b.width/2, b.Y + b.height/2 + 1);
        ctx.fillStyle = "#000";
    }
};

//Escで設定の窓を閉じる
document.addEventListener("keydown",function(e){
    if(page.number == 0 && startScreen.settings && e.code == "Escape") startScreen.closeSettings();
},false);
