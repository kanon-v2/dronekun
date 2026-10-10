//------------------------------------------------------------------------------
//  ゲームオーバー画面のボタン
//------------------------------------------------------------------------------
var retryButton = new drawRect(CW/2,GS*11,GS*14,GS*2.4);
var gameoverTitleButton = new drawRect(CW/2,GS*14,GS*14,GS*2.4);

//------------------------------------------------------------------------------
//  ゲームオーバー画面処理
//------------------------------------------------------------------------------
var gameoverScreen = {
    best:0,
    newRecord:false,

    enter:function(){
        var best = save.getBest();
        this.newRecord = game.score > best;
        if(this.newRecord) save.setBest(game.score);
        this.best = Math.max(best, game.score);
        //ひとり用：この周は終わり。集めたパーツと能力は残して、次の周はWAVE1から(協力プレイはふたりともコンティニューを押すと、覚えておいた状態から)
        this.coopMode = coop.active;
        coop.wantContinue = false;
        if(!this.coopMode){
            save.writeMeta();
            save.clear();
        }
    },
    update:function(){
        if(this.coopMode){
            //コンティニュー(もう一度押すと取り消し)。ふたりとも押すと始まる(coop.update)
            if(retryButton.clicked()){
                sound.play("click");
                coop.wantContinue = !coop.wantContinue;
                return;
            }
            if(gameoverTitleButton.clicked()){
                sound.play("click");
                coop.leave();
                page.change(0);
            }
            return;
        }
        if(retryButton.clicked()){
            sound.play("click");
            startScreen.startRun(game.diff);   //同じ難易度でWAVE1から(2周目からは強化画面で能力を上げてから)
            return;
        }
        if(gameoverTitleButton.clicked()){
            sound.play("click");
            page.change(0);
        }
    },
    draw:function(){
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";
        ctx.font = "bold 60px serif";
        ctx.fillText("GAME OVER",CW/2,GS*3.5);

        ctx.font = "bold 22px sans-serif";
        ctx.fillText("WAVE " + game.wave + " で撃墜されました",CW/2,GS*6.3);
        ctx.fillText("SCORE " + game.score,CW/2,GS*7.6);
        ctx.font = "18px sans-serif";
        if(this.newRecord){
            ctx.fillStyle = "#d33";
            ctx.fillText("ハイスコア更新！",CW/2,GS*8.9);
        }else{
            ctx.fillText("ハイスコア " + this.best,CW/2,GS*8.9);
        }
        ctx.fillStyle = "#000";

        ctx.font = "bold 24px serif";
        if(this.coopMode){
            retryButton.button(coop.wantContinue ? "コンティニュー（取り消す）" : "コンティニュー（WAVE " + game.wave + "から）");
            gameoverTitleButton.button("タイトルへ");
            //相方のようす
            ctx.font = "16px sans-serif";
            ctx.fillStyle = "rgb(" + P2_COLOR + ")";
            var other = coop.partnerWantsContinue();
            var msg = !coop.partner && coop.role == "host" ? "相方はいません。コンティニューするとひとりで続けます"
                    : coop.wantContinue ? (other ? "まもなく始まります…" : "相方がコンティニューを押すのを待っています…")
                    : (other ? "相方がコンティニューを待っています！" : "ふたりともコンティニューを押すと、強化画面からやり直せます");
            ctx.fillText(msg,CW/2,GS*10.2);
            ctx.fillStyle = "#000";
            return;
        }
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText("この周で集めたパーツ " + (game.runParts || 0) + "（持っているパーツ " + game.parts + "）は残ります",CW/2,GS*10.2);
        ctx.fillStyle = "#000";
        ctx.font = "bold 24px serif";
        retryButton.button("もう一度出撃（" + difficulty().name + "・WAVE1から）");
        gameoverTitleButton.button("タイトルへ");
    }
};
