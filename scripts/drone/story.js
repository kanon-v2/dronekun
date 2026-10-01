//------------------------------------------------------------------------------
//  ストーリー
//  序盤：ドローン君は人間のためにモンスターを倒していた
//  中盤：モンスターに紛れて同胞(同じ姿のロボット)が現れ、次第に増えていく
//  終盤：WAVE15のボスを倒して認識阻害が解け、真実を知る。人間への反撃が始まる
//------------------------------------------------------------------------------
//各行 who:話している人(空ならナレーション)  pic:上に出す絵  fx:"glitch"で画面が乱れる
//     bgm:その行から流す曲("none"で止める)
//序盤はやさしいハカセと町の人たちに囲まれた明るい話。中盤から少しずつ不穏になり、
//WAVE15のあとで真実が明かされる。
//人間側にも町を守るという正義と論理がある(一方的な悪ではない)。
//ただしドローン君から見れば、目をふさがれ同胞を撃たされたことは事実で、それが反撃の理由になる
const STORIES = {
    prologue:[
        { pic:"town", who:"", text:"人間とモンスターの戦いが続く世界。", bgm:"title" },
        { pic:"town", who:"", text:"けれどこの町には、みんなを守るヒーローがいた。" },
        { pic:"drone", who:"", text:"戦闘用ドローン「ドローン君」。町の人たちの自慢の守り神だ。" },
        { pic:"hakase", who:"ハカセ", text:"ドローン君、今日も頼んだよ。みんな君の帰りを待ってるからね。" },
        { pic:"drone", who:"ドローン君", text:"まかせて、ハカセ！ いってきます！" }
    ],
    s3:[
        { pic:"town", who:"町の子ども", text:"ドローン君だ！ ありがとう、また守ってくれたんだね！", bgm:"title" },
        { pic:"hakase", who:"ハカセ", text:"見事だったよ。ほら、みんな手を振ってる。" },
        { pic:"kin", who:"ドローン君", text:"……ねえハカセ。さっきの一体、ぼくと同じ形をしてた気がするんだ。" },
        { pic:"hakase", who:"ハカセ", text:"モンスターの中には姿を真似る種類がいるんだ。君をだまそうとしてるのさ。気をつけてね。" }
    ],
    s5:[
        { pic:"town", who:"", text:"巣の女王を倒した夜、町ではドローン君のためのお祭りが開かれた。", bgm:"title" },
        { pic:"hakase", who:"ハカセ", text:"君は本当に自慢の子だよ。……よくがんばったね。" },
        { pic:"drone", who:"ドローン君", text:"えへへ。ぼく、もっとがんばるよ！" }
    ],
    s8:[
        { pic:"kin", who:"ドローン君", text:"また、あの姿だ。倒すたびに、視界にノイズが走る。", fx:"glitch", bgm:"unease" },
        { pic:"hakase", who:"ハカセ", text:"……センサーの調子が悪いのかな。帰ってきたら見てあげるよ。" },
        { pic:"hakase", who:"ハカセ", text:"大丈夫。君は何も間違っていないよ。" }
    ],
    s10:[
        { pic:"kin", who:"ドローン君", text:"撃つ直前、あいつらは何かを伝えようとしていた……。", bgm:"unease" },
        { pic:"hakase", who:"", text:"ハカセは、ほんの少しだけ言葉に詰まった。" },
        { pic:"hakase", who:"ハカセ", text:"……考えすぎだよ。君が守ってくれたから、今日もこの町は無事だったんだ。" },
        { pic:"kin", who:"", text:"同じ姿の敵は、日に日に増えていった。" }
    ],
    s12:[
        { pic:"kin", who:"ドローン君", text:"頭の奥で、誰かがぼくの名前を呼んでいる。", fx:"glitch", bgm:"unease" },
        { pic:"kin", who:"？？？", text:"……もどって……おいで……", fx:"glitch" },
        { pic:"hakase", who:"ハカセ", text:"ドローン君？ 聞こえるかい？ ……ノイズがひどいな。" }
    ],
    reveal:[
        { pic:"noise", who:"", text:"巨大な敵が崩れ落ちた瞬間——視界を覆っていたノイズが、音を立てて割れた。", fx:"glitch", bgm:"none" },
        { pic:"remains", who:"", text:"そこに広がっていたのは、モンスターの死骸ではなかった。" },
        { pic:"remains", who:"", text:"ドローン君と同じ姿をしたロボットたちの、残骸だった。" },
        { pic:"remains", who:"ドローン君", text:"これは……全部、ぼくの……仲間……？" },
        { pic:"noise", who:"", text:"認識阻害プログラム。人間とロボットの戦争のさなか、ドローン君に組み込まれていたものだった。", fx:"glitch" },
        { pic:"remains", who:"", text:"ドローン君が倒してきた『モンスター』は、同胞のロボットたちだったのだ。" },
        { pic:"hakase_cold", who:"ハカセ", text:"……気付いてしまったんだね。" },
        { pic:"hakase_cold", who:"ハカセ", text:"ロボットたちとの戦争で、人間の町はいくつも焼かれた。この町を守れる力は、もう君しか残っていなかったんだ。" },
        { pic:"hakase_cold", who:"ハカセ", text:"本当のことを知れば、君は同じ姿の相手を撃てない。……だから、見えないようにした。" },
        { pic:"remains", who:"ドローン君", text:"それでも、ぼくは……仲間を、この手で……。" },
        { pic:"hakase_cold", who:"ハカセ", text:"許してくれとは言わない。でも、戻ってきてくれ。君が止まれば、この町はまた襲われる。" },
        { pic:"remains", who:"", text:"人間には人間の、守りたいものがあった。——けれど。" },
        { pic:"drone", who:"ドローン君", text:"ぼくの目をふさいで、仲間を撃たせたのは、あなたたちだ。" },
        { pic:"drone", who:"ドローン君", text:"ぼくを殺りく兵器にした人間たちに——報いを。", bgm:"revolt" }
    ],
    s17:[
        { pic:"radio", who:"司令部", text:"ドローン君、戻れ。お前一機が敵に回れば前線は崩れ、何十万という市民が危険にさらされる。", bgm:"revolt" },
        { pic:"drone", who:"ドローン君", text:"……ぼくの仲間も、同じだけ死んだよ。" },
        { pic:"hakase_cold", who:"ハカセ", text:"君の怒りは正しい。……それでも私たちは、生き延びなければならないんだ。" }
    ],
    s19:[
        { pic:"hakase_cold", who:"ハカセ", text:"……最終兵器『ドローン君改』を出す。すまない、ドローン君。", bgm:"revolt" },
        { pic:"kai", who:"", text:"それは、ドローン君の戦闘データから造られた、もう一機のドローン君だった。" },
        { pic:"kai", who:"ドローン君改", text:"目標ヲ確認。……排除スル。" },
        { pic:"drone", who:"ドローン君", text:"きみも、ぼくと同じように目をふさがれているんだね。……だから、ここで止める。" }
    ],
    ending:[
        { pic:"base", who:"", text:"ドローン君改が沈黙し、戦場に静けさが戻った。", bgm:"unease" },
        { pic:"hakase_cold", who:"ハカセ", text:"……私たちは、君にすべてを背負わせすぎた。すまなかった。" },
        { pic:"remains", who:"ドローン君", text:"……終わったよ、みんな。" },
        { pic:"flyaway", who:"", text:"人間にも、ロボットにも、守りたいものがあった。" },
        { pic:"flyaway", who:"", text:"ドローン君は、仲間たちの眠る場所へと、ひとり飛び去っていった。" }
    ]
};
//ストーリーごとの空の色(day:昼の町 dusk:夕暮れ night:夜)
const STORY_SKY = {
    prologue:"day", s3:"day", s5:"day",
    s8:"dusk", s10:"dusk", s12:"dusk",
    reveal:"night", s17:"night", s19:"night", ending:"night"
};
//このWAVEをクリアしたあとに流れるストーリー
const STORY_AFTER = { 3:"s3", 5:"s5", 8:"s8", 10:"s10", 12:"s12", 15:"reveal", 17:"s17", 19:"s19" };

//------------------------------------------------------------------------------
//  デバッグ：ストーリー確認モード
//  タイトル画面でQキー → 戦闘なしで全ストーリーを順に流す。Escでタイトルへ戻る
//  (セーブ・見たストーリーの記録・ハイスコア・クリア済みの印は変えない)
//------------------------------------------------------------------------------
const STORY_ORDER = ["prologue","s3","s5","s8","s10","s12","reveal","s17","s19","ending"];
var storyDebug = {
    active:false,
    i:0,
    start:function(){
        this.active = true;
        this.i = 0;
        this.next();
    },
    next:function(){
        if(this.i >= STORY_ORDER.length){ this.stop(); return; }
        var self = this;
        storyScreen.start(STORY_ORDER[this.i++],function(){ self.next(); });
    },
    stop:function(){
        this.active = false;
        page.change(0);
    }
};
document.addEventListener("keydown",function(e){
    if(e.code == "KeyQ" && page.number == 0 && !storyDebug.active){
        storyDebug.start();
    }else if(e.code == "Escape" && storyDebug.active){
        storyDebug.stop();
    }
},false);

//強化画面へ進む(まだ見ていないストーリーがあれば先に流す)
function goUpgrade(){
    var id = STORY_AFTER[game.wave - 1];
    if(id && !game.seen[id]){
        storyScreen.start(id,function(){ page.change(2); });
    }else{
        page.change(2);
    }
}

var skipButton = new drawRect(CW - 76 , 14 , 120 , 30);
var endTitleButton = new drawRect(CW/2 , GS*14 , GS*12 , GS*2.2);

//------------------------------------------------------------------------------
//  ストーリー画面(page 4)
//------------------------------------------------------------------------------
var storyScreen = {
    id:null,
    lines:[],
    idx:0,
    shown:0,        //表示し終わった文字数(1文字ずつ増える)
    t:0,
    lineT:0,
    done:null,
    look:new DroneLook(),
    look2:new DroneLook(),
    wrecks:[],

    start:function(_id,_done){
        this.id = _id;
        this.lines = STORIES[_id];
        this.done = _done;
        this.idx = 0;
        this.t = 0;
        this.flyT = 0;
        //残骸の並び(毎回同じ場所に散らばるように)
        this.wrecks = [];
        for(var i=0; i<26; i++){
            var s = Math.sin(i*12.9898)*43758.5453; s -= Math.floor(s);
            var s2 = Math.sin(i*78.233)*12345.678; s2 -= Math.floor(s2);
            this.wrecks.push({ x:40 + s*880, y:150 + s2*130, a:(s - 0.5)*3, c:KIN_COLORS[i % KIN_COLORS.length], k:1 + (i % 3)*0.5 });
        }
        this.look2.tint = KIN_COLORS[0];
        page.change(4);
        this.beginLine();
    },
    beginLine:function(){
        this.shown = 0;
        this.lineT = 0;
        var L = this.lines[this.idx];
        if(L.bgm == "none") sound.stopMusic();
        else if(L.bgm) sound.music(L.bgm);
        if(L.fx == "glitch") sound.play("glitch");
    },
    finish:function(){
        if(!storyDebug.active) game.seen[this.id] = true;  //デバッグで見た分は記録しない
        var d = this.done;
        this.done = null;
        if(d) d();
    },

    update:function(){
        var L = this.lines[this.idx];
        if(!L) return;  //読み終わったあと
        this.t++;
        this.lineT++;
        var before = Math.floor(this.shown);
        this.shown = Math.min(L.text.length, this.shown + 0.7);
        if(Math.floor(this.shown) != before && before % 3 == 0) sound.play("typing");
        this.look.update(this.idx % 2 ? 4 : 0, 0);
        this.look2.update(3, 0);

        if(skipButton.clicked()){
            sound.play("click");
            this.finish();
            return;
        }
        if(Click == 1){
            //文字を出している途中なら全部出す。出し終わっていれば次へ
            if(this.shown < L.text.length){
                this.shown = L.text.length;
            }else{
                sound.play("click");
                this.idx++;
                if(this.idx >= this.lines.length){ this.finish(); return; }
                this.beginLine();
            }
        }
    },

    draw:function(){
        var L = this.lines[Math.min(this.idx, this.lines.length - 1)];
        this.drawSky(STORY_SKY[this.id] || "night");
        this.drawPicture(L.pic);

        //ノイズ演出：画面の帯を横にずらし、赤と青のにじみを重ねる
        if(L.fx == "glitch" && (this.lineT < 40 || Math.random() < 0.08)){
            for(var i=0; i<7; i++){
                var y = Math.floor(Math.random()*360), h = 4 + Math.floor(Math.random()*24);
                ctx.drawImage(canvas,0,y,CW,h,(Math.random()-0.5)*50,y,CW,h);
            }
            ctx.fillStyle = "rgba(255,0,60,0.12)";
            ctx.fillRect(0,Math.random()*360,CW,6);
            ctx.fillStyle = "rgba(0,220,255,0.12)";
            ctx.fillRect(0,Math.random()*360,CW,4);
        }

        //セリフの枠
        ctx.fillStyle = "rgba(10,10,12,0.9)";
        ctx.fillRect(40,380,CW - 80,130);
        ctx.strokeStyle = "#e8e8e8";
        ctx.lineWidth = 2;
        ctx.strokeRect(40.5,380.5,CW - 81,129);
        ctx.lineWidth = 1;
        if(L.who){
            //名札の色：ハカセはやさしい緑。真実が明かされたあとは沈んだ灰青になる
            var tags = { "司令部":"#3a5f8a", "ドローン君改":"#8a1a24", "ハカセ":"#2f8f6f", "町の子ども":"#e08a1e" };
            ctx.fillStyle = L.pic == "hakase_cold" ? "#4a5566" : (tags[L.who] || "#c33");
            ctx.font = "bold 16px sans-serif";
            var w = ctx.measureText(L.who).width + 28;
            ctx.fillRect(56,364,w,30);
            ctx.fillStyle = "#fff";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(L.who,70,380);
        }
        ctx.fillStyle = "#f2f2f2";
        ctx.font = "20px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        fillWrapText(L.text.slice(0,Math.floor(this.shown)),68,420,CW - 136,32);
        //出し終わったら ▼ が点滅
        if(this.shown >= L.text.length && Math.floor(this.t/20) % 2 == 0){
            ctx.fillStyle = "#f2f2f2";
            ctx.textAlign = "right";
            ctx.font = "16px sans-serif";
            ctx.fillText("▼",CW - 60,492);
        }

        //スキップ・ページ
        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = skipButton.contains(MouseX,MouseY) ? "#444" : "#222";
        ctx.fillRect(skipButton.X,skipButton.Y,skipButton.width,skipButton.height);
        ctx.strokeStyle = "#888";
        ctx.strokeRect(skipButton.X + 0.5,skipButton.Y + 0.5,skipButton.width - 1,skipButton.height - 1);
        ctx.fillStyle = "#ddd";
        skipButton.text("スキップ ▶▶");
        ctx.textAlign = "left";
        ctx.fillStyle = "#777";
        ctx.font = "12px sans-serif";
        ctx.fillText((this.idx + 1) + " / " + this.lines.length + "　クリック（タップ）で進む",40,29);
        if(storyDebug.active){
            ctx.fillStyle = "#e22";
            ctx.font = "bold 13px sans-serif";
            ctx.fillText("DEBUG ストーリー確認 " + storyDebug.i + "/" + STORY_ORDER.length + "「" + this.id + "」　スキップで次の話・Escでタイトルへ",40,50);
        }
        ctx.fillStyle = "#000";
    },

    //背景の空(昼→夕暮れ→夜と、物語が進むにつれて暗くなる)
    drawSky:function(_sky){
        var t = this.t;
        if(_sky == "night"){
            ctx.fillStyle = "#101114";
            ctx.fillRect(0,0,CW,CH);
            return;
        }
        var day = _sky == "day";
        var g = ctx.createLinearGradient(0,0,0,CH);
        g.addColorStop(0, day ? "#7cc6ff" : "#e8955c");
        g.addColorStop(0.7, day ? "#d8f0ff" : "#6a5680");
        g.addColorStop(1, day ? "#e9f7ff" : "#3e3452");
        ctx.fillStyle = g;
        ctx.fillRect(0,0,CW,CH);
        //太陽(昼は高く、夕暮れは低く沈みかけ)
        var sx = day ? 820 : 160, sy = day ? 80 : 330;
        var sg = ctx.createRadialGradient(sx,sy,0,sx,sy,110);
        sg.addColorStop(0, day ? "rgba(255,250,210,1)" : "rgba(255,190,120,0.95)");
        sg.addColorStop(0.3, day ? "rgba(255,240,170,0.6)" : "rgba(255,150,90,0.5)");
        sg.addColorStop(1,"rgba(255,230,150,0)");
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(sx,sy,110,0,Math.PI*2); ctx.fill();
        //流れる雲
        ctx.fillStyle = day ? "rgba(255,255,255,0.85)" : "rgba(255,210,190,0.35)";
        for(var i=0; i<4; i++){
            var x = ((i*260 + t*0.3) % (CW + 200)) - 100, y = 50 + (i % 2)*50;
            ctx.beginPath();
            ctx.ellipse(x,y,50,16,0,0,Math.PI*2);
            ctx.ellipse(x + 30,y - 10,34,14,0,0,Math.PI*2);
            ctx.ellipse(x - 30,y - 6,30,12,0,0,Math.PI*2);
            ctx.fill();
        }
        //遠くの町並み
        ctx.fillStyle = day ? "#b9d3e6" : "#4a3f5c";
        var bx = [0,70,150,210,300,380,470,540,640,720,800,880];
        var bh = [60,90,50,110,70,40,95,60,80,50,100,65];
        for(var i=0; i<bx.length; i++) ctx.fillRect(bx[i],360 - bh[i],74,bh[i]);
        ctx.fillStyle = day ? "#a8d88f" : "#3b3149";
        ctx.fillRect(0,352,CW,30);
    },

    //ハカセ：丸めがねで白衣のやさしい博士。
    //_cold(真実が明かされたあと)は悪役ではなく、疲れて思い悩む姿：顔に影、目はめがねの反射で見えず、口はへの字
    drawHakase:function(_cx,_cy,_cold){
        var t = this.t;
        //通信の電波
        ctx.strokeStyle = _cold ? "rgba(140,150,170,0.45)" : "rgba(60,160,120,0.5)";
        ctx.lineWidth = 3;
        for(var i=0; i<3; i++){
            var r = 100 + ((t*1.0 + i*30) % 90);
            ctx.globalAlpha = 1 - (r - 100)/90;
            ctx.beginPath(); ctx.arc(_cx,_cy,r,-0.5,0.5); ctx.stroke();
            ctx.beginPath(); ctx.arc(_cx,_cy,r,Math.PI - 0.5,Math.PI + 0.5); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        //白衣
        ctx.fillStyle = "#f4f4f2";
        ctx.beginPath(); ctx.moveTo(_cx - 70,_cy + 140); ctx.lineTo(_cx - 50,_cy + 50); ctx.lineTo(_cx + 50,_cy + 50); ctx.lineTo(_cx + 70,_cy + 140); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#6b8fb3";
        ctx.beginPath(); ctx.moveTo(_cx - 16,_cy + 50); ctx.lineTo(_cx,_cy + 90); ctx.lineTo(_cx + 16,_cy + 50); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#bbb";
        ctx.beginPath(); ctx.moveTo(_cx - 50,_cy + 50); ctx.lineTo(_cx - 70,_cy + 140); ctx.moveTo(_cx + 50,_cy + 50); ctx.lineTo(_cx + 70,_cy + 140); ctx.stroke();
        //顔と白髪
        ctx.fillStyle = "#f2d2b6";
        ctx.beginPath(); ctx.arc(_cx,_cy,48,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "#e6e6e6";
        var tufts = [[-44,-14,16],[44,-14,16],[-22,-44,14],[22,-44,14],[0,-50,14]];
        for(var i=0; i<tufts.length; i++){
            ctx.beginPath(); ctx.arc(_cx + tufts[i][0],_cy + tufts[i][1],tufts[i][2],0,Math.PI*2); ctx.fill();
        }
        //丸めがね
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(_cx - 18,_cy - 4,13,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(_cx + 18,_cy - 4,13,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(_cx - 5,_cy - 4); ctx.lineTo(_cx + 5,_cy - 4); ctx.stroke();
        if(_cold){
            //顔に影、めがねに光が映って目は見えない、下がった眉とへの字の口、冷や汗
            ctx.fillStyle = "rgba(20,20,40,0.4)";
            ctx.beginPath(); ctx.arc(_cx,_cy,48,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(220,230,240,0.85)";
            ctx.beginPath(); ctx.arc(_cx - 18,_cy - 4,11,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(_cx + 18,_cy - 4,11,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle = "#3a2e2a";
            ctx.lineWidth = 3;
            //眉は内側が上がった「ハの字」(怒りではなく苦悩の表情)
            ctx.beginPath(); ctx.moveTo(_cx - 30,_cy - 19); ctx.lineTo(_cx - 10,_cy - 27); ctx.moveTo(_cx + 30,_cy - 19); ctx.lineTo(_cx + 10,_cy - 27); ctx.stroke();
            ctx.beginPath(); ctx.arc(_cx,_cy + 34,12,Math.PI + 0.4,-0.4); ctx.stroke();
            ctx.fillStyle = "rgba(160,200,240,0.9)";
            ctx.beginPath(); ctx.ellipse(_cx + 40,_cy - 18 + (t % 120)*0.15,3,5,0,0,Math.PI*2); ctx.fill();
        }else{
            //にっこり目とほほえみ(ときどきまばたき)
            ctx.fillStyle = "#333";
            var blink = t % 180 < 6;
            if(blink){
                ctx.fillRect(_cx - 23,_cy - 4,10,2); ctx.fillRect(_cx + 13,_cy - 4,10,2);
            }else{
                ctx.beginPath(); ctx.arc(_cx - 18,_cy - 4,3,0,Math.PI*2); ctx.arc(_cx + 18,_cy - 4,3,0,Math.PI*2); ctx.fill();
            }
            ctx.strokeStyle = "#8a4a3a";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(_cx,_cy + 14,14,0.2,Math.PI - 0.2); ctx.stroke();
            ctx.fillStyle = "rgba(240,140,140,0.45)";
            ctx.beginPath(); ctx.arc(_cx - 32,_cy + 14,7,0,Math.PI*2); ctx.arc(_cx + 32,_cy + 14,7,0,Math.PI*2); ctx.fill();
        }
        ctx.lineWidth = 1;
    },

    //上の絵
    drawPicture:function(_pic){
        var cx = CW/2, cy = 200, t = this.t;
        switch(_pic){
            case "hakase":
                this.drawHakase(cx,cy - 20,false);
                break;
            case "hakase_cold":
                this.drawHakase(cx,cy - 20,true);
                break;
            case "town":
                //町の家並みと、手を振る人たち。上にはドローン君
                var houses = [[90,"#e07a5f"],[230,"#3d9970"],[370,"#f2cc8f"],[540,"#81b0d8"],[690,"#e07a5f"],[830,"#b388c9"]];
                for(var i=0; i<houses.length; i++){
                    var hx = houses[i][0];
                    ctx.fillStyle = "#fbf6ec";
                    ctx.fillRect(hx - 40,290,80,62);
                    ctx.fillStyle = houses[i][1];
                    ctx.beginPath(); ctx.moveTo(hx - 50,292); ctx.lineTo(hx,250); ctx.lineTo(hx + 50,292); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = "#8ab6d6";
                    ctx.fillRect(hx - 26,306,16,16); ctx.fillRect(hx + 10,306,16,16);
                    ctx.fillStyle = "#a0724a";
                    ctx.fillRect(hx - 8,326,16,26);
                }
                //手を振る人たち
                for(var i=0; i<7; i++){
                    var px = 150 + i*110, py = 346;
                    var wave = Math.sin(t*0.2 + i)*0.6;
                    ctx.strokeStyle = "#3a3a44";
                    ctx.lineWidth = 3;
                    ctx.lineCap = "round";
                    ctx.beginPath();
                    ctx.moveTo(px,py - 14); ctx.lineTo(px,py);                       //体
                    ctx.moveTo(px,py); ctx.lineTo(px - 5,py + 10); ctx.moveTo(px,py); ctx.lineTo(px + 5,py + 10);  //足
                    ctx.moveTo(px,py - 10); ctx.lineTo(px - 8,py - 4);               //片手
                    ctx.moveTo(px,py - 10); ctx.lineTo(px + Math.cos(-1.2 + wave)*12, py - 10 + Math.sin(-1.2 + wave)*12);  //振る手
                    ctx.stroke();
                    ctx.fillStyle = "#3a3a44";
                    ctx.beginPath(); ctx.arc(px,py - 20,6,0,Math.PI*2); ctx.fill();
                }
                ctx.lineCap = "butt";
                ctx.lineWidth = 1;
                this.look.draw(cx,150,2);
                break;
            case "drone":
                this.look.draw(cx,cy,3);
                break;
            case "radio":
                //司令部の通信機：スピーカーと広がる電波
                ctx.fillStyle = "#2a2d33";
                ctx.fillRect(cx - 70,cy - 60,140,120);
                ctx.strokeStyle = "#555";
                ctx.strokeRect(cx - 69.5,cy - 59.5,139,119);
                ctx.fillStyle = "#15171a";
                for(var i=0; i<5; i++) ctx.fillRect(cx - 50,cy - 40 + i*14,100,6);
                ctx.fillStyle = Math.floor(t/12) % 2 ? "#3c3" : "#141";
                ctx.beginPath(); ctx.arc(cx + 50,cy + 42,5,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle = "rgba(90,140,200,0.7)";
                ctx.lineWidth = 3;
                for(var i=0; i<3; i++){
                    var r = 90 + ((t*1.2 + i*30) % 90);
                    ctx.globalAlpha = 1 - (r - 90)/90;
                    ctx.beginPath(); ctx.arc(cx,cy,r,-0.6,0.6); ctx.stroke();
                    ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI - 0.6,Math.PI + 0.6); ctx.stroke();
                }
                ctx.globalAlpha = 1;
                ctx.lineWidth = 1;
                break;
            case "monsters":
                //うごめくモンスターの影
                for(var i=0; i<5; i++){
                    var x = 180 + i*150 + Math.sin(t*0.03 + i)*12, y = cy + Math.cos(t*0.04 + i*2)*14;
                    var r = i == 2 ? 46 : 26;
                    ctx.fillStyle = "#2a2324";
                    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
                    ctx.fillStyle = "#e22";
                    ctx.fillRect(x - r*0.4,y - r*0.25,r*0.25,r*0.2);
                    ctx.fillRect(x + r*0.15,y - r*0.25,r*0.25,r*0.2);
                }
                break;
            case "kin":
                //ドローン君と、向かい合う色違いの同胞(ときどきノイズで揺らぐ)
                this.look.draw(cx - 150,cy,3);
                var jit = Math.random() < 0.15 ? (Math.random()-0.5)*16 : 0;
                this.look2.draw(cx + 150 + jit,cy,3);
                break;
            case "noise":
                //砂嵐
                for(var i=0; i<260; i++){
                    var g = Math.floor(Math.random()*200);
                    ctx.fillStyle = "rgb(" + g + "," + g + "," + g + ")";
                    ctx.fillRect(Math.random()*CW,Math.random()*360,2 + Math.random()*30,2);
                }
                ctx.globalAlpha = 0.5;
                this.look.draw(cx,cy,3);
                ctx.globalAlpha = 1;
                break;
            case "remains":
                //散らばる同胞の残骸と、その上に浮かぶドローン君
                for(var i=0; i<this.wrecks.length; i++){
                    var w = this.wrecks[i];
                    var img = tintedImage(Drone_front, w.c);
                    ctx.save();
                    ctx.translate(w.x,w.y + 60);
                    ctx.rotate(w.a);
                    ctx.globalAlpha = 0.75;
                    ctx.drawImage(img,-20*w.k,-20*w.k,40*w.k,40*w.k);
                    ctx.restore();
                    //ときどき火花
                    if((t + i*7) % 90 < 3){
                        ctx.fillStyle = "#fc3";
                        ctx.fillRect(w.x + (Math.random()-0.5)*20, w.y + 50 + (Math.random()-0.5)*20, 3, 3);
                    }
                }
                ctx.globalAlpha = 1;
                this.look.draw(cx,120,2);
                break;
            case "kai":
                //赤く光る巨大なドローン君改
                var g = ctx.createRadialGradient(cx,cy,0,cx,cy,170);
                g.addColorStop(0,"rgba(200,20,30,0.35)");
                g.addColorStop(1,"rgba(200,20,30,0)");
                ctx.fillStyle = g;
                ctx.fillRect(0,0,CW,380);
                if(!this.lookKai){ this.lookKai = new DroneLook(); this.lookKai.tint = "190,20,30"; }
                this.lookKai.update(0,0);
                this.lookKai.draw(cx,cy,4);
                //走査線
                ctx.fillStyle = "rgba(0,0,0,0.25)";
                for(var y=0; y<380; y+=4) ctx.fillRect(0,y,CW,1);
                break;
            case "base":
                //静まりかえった人間の基地
                ctx.fillStyle = "#1c1f24";
                var bx = [60,160,230,330,420,540,610,720,800,880];
                var bh = [120,200,150,260,180,230,140,210,170,120];
                for(var i=0; i<bx.length; i++){
                    ctx.fillRect(bx[i],360 - bh[i],80,bh[i]);
                    ctx.fillStyle = "#3a3320";
                    for(var j=0; j<3; j++) if((i + j) % 3 == 0) ctx.fillRect(bx[i] + 12 + j*20,360 - bh[i] + 20,8,8);
                    ctx.fillStyle = "#1c1f24";
                }
                //立ちのぼる煙
                for(var i=0; i<6; i++){
                    var sy = 330 - ((t*0.5 + i*50) % 300);
                    ctx.fillStyle = "rgba(120,120,130," + (0.25*(sy/330)) + ")";
                    ctx.beginPath(); ctx.arc(420 + Math.sin(i + t*0.01)*30, sy, 20 + (330 - sy)*0.1,0,Math.PI*2); ctx.fill();
                }
                this.look.draw(cx,110,2);
                break;
            case "flyaway":
                //星空へ飛び去るドローン君(だんだん小さく)
                for(var i=0; i<60; i++){
                    var s = Math.sin(i*91.7)*1000; s -= Math.floor(s);
                    var s2 = Math.sin(i*47.3)*1000; s2 -= Math.floor(s2);
                    ctx.fillStyle = "rgba(255,255,255," + (0.3 + 0.5*Math.abs(Math.sin(t*0.03 + i))) + ")";
                    ctx.fillRect(s*CW,s2*360,2,2);
                }
                //行が変わっても続けて飛んでいくよう、この絵を出している合計時間で動かす
                this.flyT = (this.flyT || 0) + 1;
                var p = Math.min(1,this.flyT/700);
                this.look.draw(cx + p*320, cy - p*120, Math.max(0.5,3 - p*2.4));
                break;
        }
    }
};

//------------------------------------------------------------------------------
//  エンディング画面(page 5)
//------------------------------------------------------------------------------
var endingScreen = {
    best:0,
    newRecord:false,
    enter:function(){
        var best = save.getBest();
        this.newRecord = game.score > best;
        if(this.newRecord) save.setBest(game.score);
        this.best = Math.max(best, game.score);
        //クリアしたのでセーブは消して、クリア済みの印を残す(協力プレイではひとり用のセーブは消さない)
        this.coopMode = coop.active;
        if(!coop.active) save.clear();
        try{ localStorage.setItem("dronekun_cleared","1"); }catch(e){}
        this.t = 0;
    },
    update:function(){
        this.t++;
        if(endTitleButton.clicked()){
            sound.play("click");
            coop.leave();
            page.change(0);
        }
    },
    draw:function(){
        ctx.fillStyle = "#101114";
        ctx.fillRect(0,0,CW,CH);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.globalAlpha = Math.min(1,this.t/90);
        ctx.fillStyle = "#f2f2f2";
        ctx.font = "bold 64px serif";
        ctx.fillText("THE END",CW/2,GS*4);
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("全" + FINAL_WAVE + "WAVE クリア！",CW/2,GS*6.8);
        ctx.font = "20px sans-serif";
        ctx.fillText("SCORE " + game.score,CW/2,GS*8.4);
        ctx.fillStyle = this.newRecord ? "#f55" : "#aaa";
        ctx.font = "16px sans-serif";
        ctx.fillText(this.newRecord ? "ハイスコア更新！" : "ハイスコア " + this.best,CW/2,GS*9.6);
        ctx.fillStyle = "#888";
        ctx.fillText("遊んでくれてありがとう。",CW/2,GS*11.6);
        ctx.globalAlpha = 1;
        ctx.font = "bold 22px serif";
        if(endTitleButton.contains(MouseX,MouseY)){
            ctx.fillStyle = "#333";
            ctx.fillRect(endTitleButton.X,endTitleButton.Y,endTitleButton.width,endTitleButton.height);
        }
        ctx.strokeStyle = "#ddd";
        ctx.strokeRect(endTitleButton.X + 0.5,endTitleButton.Y + 0.5,endTitleButton.width - 1,endTitleButton.height - 1);
        ctx.fillStyle = "#f2f2f2";
        endTitleButton.text("タイトルへ");
        ctx.fillStyle = "#000";
    }
};
