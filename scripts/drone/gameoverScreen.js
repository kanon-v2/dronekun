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
    cx:CW/2,      //文字とボタンの中心(研究所の記録を出すときは左へ寄せる)

    enter:function(){
        var best = save.getBest();
        this.newRecord = game.score > best;
        if(this.newRecord) save.setBest(game.score);
        this.best = Math.max(best, game.score);
        //ひとり用：この周は終わり。集めたパーツ・能力・装備は残して、次の周はいちばん先のWAVEから(協力プレイも同じく協力プレイ用に残す。ふたりともコンティニューを押すと、覚えておいた状態から)
        this.coopMode = coop.active;
        coop.wantContinue = false;
        //この周の最後の装備と進み具合・パーツを残す(次の周はここから。協力プレイは協力プレイ用に)
        game.keepProgress();
        save.writeMeta();
        if(!this.coopMode) save.clear();
        //研究所へ送った記録(analysis.js)があれば右に出し、ほかは左へ寄せる
        this.t = 0;
        this.lab = !this.coopMode && analysis.report != null;
        this.cx = this.lab ? 290 : CW/2;
        retryButton.X = gameoverTitleButton.X = this.cx - retryButton.width/2;
    },
    update:function(){
        this.t++;
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
            startScreen.startRun(game.diff);   //同じ難易度で、いちばん先のWAVEから(強化画面で能力を上げ、出撃先を選び直せる)
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
        ctx.fillText("GAME OVER",this.cx,GS*3.5);

        ctx.font = "bold 22px sans-serif";
        ctx.fillText("WAVE " + game.wave + " で撃墜されました",this.cx,GS*6.3);
        ctx.fillText("SCORE " + game.score,this.cx,GS*7.6);
        ctx.font = "18px sans-serif";
        if(this.newRecord){
            ctx.fillStyle = "#d33";
            ctx.fillText("ハイスコア更新！",this.cx,GS*8.9);
        }else{
            ctx.fillText("ハイスコア " + this.best,this.cx,GS*8.9);
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
            ctx.fillText(msg,this.cx,GS*10.2);
            ctx.fillStyle = "#000";
            return;
        }
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#555";
        var keep = "この周で集めたパーツ " + (game.runParts || 0) + "（持っているパーツ " + game.parts + "）と装備は残ります";
        if(this.lab){
            ctx.font = "14px sans-serif";
            ctx.fillText(keep,this.cx,GS*10.2);
            analysis.drawReport(this.t);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
        }else ctx.fillText(keep,this.cx,GS*10.2);
        ctx.fillStyle = "#000";
        ctx.font = "bold 24px serif";
        retryButton.button("もう一度出撃（" + difficulty().name + "・WAVE" + game.reachOf(game.diff) + "から）");
        gameoverTitleButton.button("タイトルへ");
    }
};
