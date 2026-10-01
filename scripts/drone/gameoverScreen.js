//------------------------------------------------------------------------------
//  ゲームオーバー画面のボタン
//------------------------------------------------------------------------------
var retryButton = new drawRect(canvas.width/2,GS*11,GS*14,GS*2.4);
var gameoverTitleButton = new drawRect(canvas.width/2,GS*14,GS*14,GS*2.4);

//------------------------------------------------------------------------------
//  ゲームオーバー画面処理
//------------------------------------------------------------------------------
var gameoverScreen = {
    best:0,
    newRecord:false,
    canRetry:false,
    enter:function(){
        var best = save.getBest();
        this.newRecord = game.score > best;
        if(this.newRecord) save.setBest(game.score);
        this.best = Math.max(best, game.score);
        //最後に強化画面で保存した状態からやり直せる(協力プレイはその場かぎりなので、やり直しは無し)
        this.coopMode = coop.active;
        this.canRetry = save.exists();
    },
    update:function(){
        if(this.coopMode){
            if(gameoverTitleButton.clicked()){
                sound.play("click");
                coop.leave();
                page.change(0);
            }
            return;
        }
        if(retryButton.clicked()){
            sound.play("click");
            if(this.canRetry && save.load()){
                goUpgrade();
            }else{
                game.reset();
                page.change(1);
            }
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
            ctx.font = "16px sans-serif";
            ctx.fillStyle = "#555";
            ctx.fillText("ふたりとも撃墜されました。協力プレイはここで終わりです",CW/2,GS*11.8);
            ctx.font = "bold 24px serif";
            ctx.fillStyle = "#000";
            gameoverTitleButton.button("タイトルへ");
            return;
        }
        retryButton.button(this.canRetry ? "直前のWAVEからやり直す" : "もう一度はじめから");
        gameoverTitleButton.button("タイトルへ");
    }
};
