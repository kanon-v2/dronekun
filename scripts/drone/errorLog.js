//------------------------------------------------------------------------------
//  エラーの記録(開発モードのときだけ画面の左下に出す)
//  遊んでいて起きたエラーを、そのときの状況(ホスト／ゲスト・WAVE・画面・戦いの状態)と一緒に出す。
//  写真に撮って伝えられるように。同じエラーは1行にまとめて回数を数える。
//  いちばん先に読み込む(ほかのファイルを読み込む途中のエラーも拾うため)
//------------------------------------------------------------------------------
//開発モード(アドレスに #debug)。開いた瞬間に決めて覚える(招待リンクで参加するとアドレスの # 以降が消えるため)
var DEBUG_URL = /debug/.test(location.hash);
const ERROR_LOG_MAX = 5;        //画面に出すエラーの数(新しいものから)
const ERROR_LOG_TEXT = 80;      //1行の文字数の上限

var errorLog = {
    list:[],    //{ key, msg, at, where, n }

    //エラーを書き留める(_msg：文、_at：ファイル名:行)
    add:function(_msg, _at){
        var key = _msg + "@" + _at;
        for(var i=0; i<this.list.length; i++){
            if(this.list[i].key == key){ this.list[i].n++; return; }
        }
        this.list.push({ key:key, msg:_msg, at:_at, where:this.where(), n:1 });
        if(this.list.length > 20) this.list.shift();
    },
    //例外(try/catch で受けたもの)を書き留める
    addError:function(_e){
        var stack = String((_e && _e.stack) || "");
        var m = stack.match(/([\w.-]+\.js):(\d+)/);
        this.add(String((_e && _e.message) || _e), m ? m[1] + ":" + m[2] : "?");
    },
    //起きたときの状況
    where:function(){
        try{
            var role = typeof coop != "undefined" && coop.active ? (coop.role == "host" ? "ホスト" : "ゲスト") : (typeof versus != "undefined" && versus.active ? "対戦" : "ひとり");
            var s = role + " W" + game.wave + " 画面" + page.number;
            if(page.number == 1) s += " " + mainScreen.state + (mainScreen.down ? " 倒れ中" : "");
            if(page.number == 2) s += " " + upgradeScreen.state;
            if(page.number == 8) s += " " + coopDuel.phase;
            return s;
        }catch(e){ return "読み込み中"; }
    },
    draw:function(){
        if(!(typeof debugUrl == "function" ? debugUrl() : DEBUG_URL) || !this.list.length) return;
        var rows = this.list.slice(-ERROR_LOG_MAX);
        var lh = 18, h = rows.length*lh*2 + 10, y0 = CH - h - 4;
        ctx.save();
        ctx.fillStyle = "rgba(20,0,0,0.92)";
        ctx.fillRect(4, y0, CW*0.78, h);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = "bold 14px monospace";
        for(var i=0; i<rows.length; i++){
            var r = rows[i], y = y0 + 6 + i*lh*2;
            ctx.fillStyle = "#ff8080";
            ctx.fillText(((r.n > 1 ? "×" + r.n + " " : "") + r.msg).slice(0, ERROR_LOG_TEXT), 10, y);
            ctx.fillStyle = "#ffd0a0";
            ctx.fillText(("  " + r.at + "  [" + r.where + "]").slice(0, ERROR_LOG_TEXT), 10, y + lh);
        }
        ctx.restore();
    }
};
window.addEventListener("error", function(e){
    errorLog.add(String(e.message), (e.filename || "").split("/").pop() + ":" + e.lineno);
});
window.addEventListener("unhandledrejection", function(e){
    errorLog.addError(e.reason);
});
