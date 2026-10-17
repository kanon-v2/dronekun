//------------------------------------------------------------------------------
//  BGMの試し聞き(開発用)。デバッグのメニュー(bossDebug.js)で選ぶと、ゲームの中の曲をその案で鳴らす
//  案は試聴ページで作ったもの。曲の並び(TRACKS のメロディ・和音)はそのままで、鳴らし方だけを替える
//    案D 和の怪談風(琴・尺八・太鼓・拍子木・おりん)／案F 尺八が主役／案H 管弦と篠笛／案I カリンバ
//  最終局面：ドローン君改の第二形態の曲(kai2)の代わりに、次のどれかを流す
//    原点回帰(finale)：今の音で作ったアレンジ
//    Lyria(monarch)：Google Lyria で作った録音の曲「The Monarch's Last Stand」。music/monarch.js(tools/music-loop.py で
//                    前奏のあとをループ用に切り抜いたもの)を、はじめて選んだときに読み込む(ふつうに遊ぶときは読まない)
//    Suno(triumph)：Suno で作った録音の曲「Triumph in D Major」。music/triumph.js(最後の山をくり返し、とどめを決めると
//                    元の曲の終わりへ進む)。動きは finaleTriumph.js
//  戦闘曲：序盤・中盤の戦闘曲・ボス戦の曲・ライバル戦の曲(heroic・battle・boss・rival)の代わりに、Suno でカバーした録音の曲
//          (sunoHeroic・sunoBattle・sunoBoss・sunoRival)を流す。music/sunoHeroic.js・sunoBattle.js・sunoBoss.js・sunoRival.js
//          (前奏のあとをループ用に切り抜いたもの。ライバル戦の曲は最後の山をくり返す)を、
//          はじめて選んだときに読み込む。
//          録音なので、WAVEが進んでも速くならない
//          人間との戦い(revolt)・タイトル(title)・強化画面(shop)の曲も、同じく Suno の曲(sunoRevolt「Final Surge」・
//          sunoTitle「遠景の丘」・sunoShop)に替える。music/sunoRevolt.js・sunoTitle.js・sunoShop.js
//  ふつうに遊ぶときの曲は、タイトルの「設定」で選ぶ(viewOpt.music。bgmTrial.useSetting)：標準は Suno の曲、クラシックは今の曲
//  最終局面(ドローン君改の第二形態)の戦いは、どちらでも Suno 版(finaleTriumph.js。FINALE_DEFAULT)。クラシックでは曲は今の曲(kai2)を流し、
//  戦いの時刻を決める Suno の曲は音を消して裏で流す(bgmTrial.clock・recTrack の mute)。曲と演出は合わないが、そのままにしている
//  録音の曲は、今の場面とこの先に使いそうなものだけを読み込んでおき(bgmTrial.prefetch)、ほかは手放す(曲を開いた音はメモリを多く使うため)
//  選んだものは覚えない(読み込み直すとはじめの選び方に戻る)
//  sound.music・sound.playStep を包んで差し替える(このファイルを読まないページは今のまま)
//------------------------------------------------------------------------------
const MONARCH_SRC = "music/monarch.js";   //Lyria の曲のファイル(BGM_MONARCH を作る)
const MONARCH_VOL = 0.4;                   //Lyria の曲の音量(今の最終局面の曲と同じくらいの大きさになるよう測った値)
const TRIUMPH_SRC = "music/triumph.js";   //Suno の曲のファイル(BGM_TRIUMPH を作る)
const TRIUMPH_VOL = 0.7;                   //Suno の曲の音量(Lyria の曲と同じくらいの大きさになるよう、平均の大きさの比から決めた値)
const SUNO_HEROIC_SRC = "music/sunoHeroic.js";  //Suno でカバーした序盤の戦闘曲のファイル(BGM_SUNO_HEROIC を作る)
const SUNO_HEROIC_VOL = 0.6;                    //その音量(今の序盤の戦闘曲と同じくらいの大きさになるよう測った値)
const SUNO_BATTLE_SRC = "music/sunoBattle.js";  //Suno でカバーした中盤の戦闘曲のファイル(BGM_SUNO_BATTLE を作る)
const SUNO_BATTLE_VOL = 0.65;                   //その音量(今の中盤の戦闘曲と同じくらいの大きさになるよう測った値)
const SUNO_BOSS_SRC = "music/sunoBoss.js";      //Suno でカバーしたボス戦の曲「Boss Rush Protocol」のファイル(BGM_SUNO_BOSS を作る)
const SUNO_BOSS_VOL = 0.9;                      //その音量(今のボス戦の曲と同じくらいの大きさになるよう測った値)
const SUNO_RIVAL_SRC = "music/sunoRival.js";    //Suno でカバーしたライバル戦の曲「Chronos Duel」のファイル(BGM_SUNO_RIVAL を作る)
const SUNO_RIVAL_VOL = 1.0;                     //その音量(ほかの Suno の曲と同じくらいの大きさになるよう、平均の大きさの比から決めた値)
const SUNO_REVOLT_SRC = "music/sunoRevolt.js";  //Suno の人間との戦い(WAVE16～)の曲「Final Surge」のファイル(BGM_SUNO_REVOLT を作る)
const SUNO_REVOLT_VOL = 0.8;                    //その音量(ほかの Suno の戦闘曲と同じくらいの大きさになるよう、平均の大きさの比から決めた値)
const SUNO_TITLE_SRC = "music/sunoTitle.js";    //Suno のタイトルの曲「遠景の丘」のファイル(BGM_SUNO_TITLE を作る)
const SUNO_TITLE_VOL = 0.65;                    //その音量(戦闘曲より少し小さめ。平均の大きさの比から決めた値)
const SUNO_SHOP_SRC = "music/sunoShop.js";      //Suno の強化画面の曲(无标题曲)のファイル(BGM_SUNO_SHOP を作る)
const SUNO_SHOP_VOL = 0.55;                     //その音量(戦闘曲より少し小さめ。平均の大きさの比から決めた値)
const FINALE_DEFAULT = 3;       //はじめの最終局面の曲(bgmTrial.finales の番号。3 は Suno)
const FIGHT_DEFAULT = 1;        //設定が標準のときの戦闘曲(bgmTrial.fights の番号。1 は Suno)

var bgmTrial = {
    list:[
        { v:"orig", name:"今の音", short:"今の音" },
        { v:"d", name:"案D 和の怪談風", short:"案D 和" },
        { v:"f", name:"案F 尺八が主役", short:"案F 尺八" },
        { v:"h", name:"案H 管弦と篠笛", short:"案H 管弦" },
        { v:"i", name:"案I カリンバ", short:"案I カリンバ" }
    ],
    pick:0,         //list の番号
    //ドローン君改の第二形態で流す曲(finales の番号。0 は今の曲)
    finales:[
        { v:null, name:"今の曲" },
        { v:"finale", name:"原点回帰" },
        { v:"monarch", name:"Lyria" },
        { v:"triumph", name:"Suno" }
    ],
    finale:FINALE_DEFAULT,
    //序盤・中盤の戦闘・ボス戦・ライバル戦・人間との戦い・タイトル・強化画面で流す曲(fights の番号。0 は今の曲)。v は 今の曲の名前 → 代わりに流す曲の名前
    fights:[
        { v:null, name:"今の曲" },
        { v:{ heroic:"sunoHeroic", battle:"sunoBattle", boss:"sunoBoss", rival:"sunoRival",
              revolt:"sunoRevolt", title:"sunoTitle", shop:"sunoShop" }, name:"Suno" }
    ],
    fight:FIGHT_DEFAULT,    //設定(viewOpt.music)に合わせる(下の useSetting)

    v:function(){ return this.list[this.pick].v; },
    name:function(){ return this.list[this.pick].name; },
    short:function(){ return this.list[this.pick].short; },
    //次の案へ。流れている曲をすぐその案で鳴らし直す(メニューで聞き比べられるように)
    next:function(){
        this.pick = (this.pick + 1) % this.list.length;
        this.restart();
    },
    finaleName:function(){ return this.finales[this.finale].name; },
    toggleFinale:function(){
        this.finale = (this.finale + 1) % this.finales.length;
        var v = this.finales[this.finale].v;
        if(v == "monarch") monarch.load();    //戦う前に読み込んでおく
        if(v == "triumph") triumph.load();
        if(this.isFinal(sound.trackName)) this.restart();
    },
    fightName:function(){ return this.fights[this.fight].name; },
    toggleFight:function(){
        this.fight = (this.fight + 1) % this.fights.length;
        var v = this.fights[this.fight].v;
        for(var k in v) recorded.list[v[k]].load();     //戦う前に読み込んでおく
        if(this.fightOf(sound.trackName)) this.restart();
    },
    //タイトルの設定(viewOpt.music)に合わせて戦闘曲を選び、流れている曲を鳴らし直す
    useSetting:function(){
        var f = viewOpt.music == "classic" ? 0 : FIGHT_DEFAULT;
        if(f == this.fight) return;
        this.fight = f;
        var n = sound.trackName;
        if(n && (this.fightOf(n) || this.isFinal(n))) this.restart();
    },
    //最終局面は Suno 版の戦いで、曲は今の曲か(Suno の曲は音を消して時刻だけ使う)
    clock:function(){ return this.finales[this.finale].v == "triumph" && !this.fight; },
    isFinal:function(_n){ return _n == "kai2" || _n == "finale" || _n == "monarch" || _n == "triumph"; },
    //戦闘曲(差し替えたものも)なら、もとの曲の名前。ちがえば null
    fightOf:function(_n){
        if(this.fights[1].v[_n]) return _n;
        for(var i=1; i<this.fights.length; i++){
            for(var k in this.fights[i].v) if(this.fights[i].v[k] == _n) return k;
        }
        return null;
    },
    restart:function(){
        var n = sound.trackName;
        if(!n || !sound.ready()) return;
        var fin = this.isFinal(n);
        var bpm = fin ? null : sound.bpm;   //戦闘の曲はWAVEで速くなっているので、そのまま
        sound.trackName = null;
        sound.music(fin ? "kai2" : this.fightOf(n) || n, bpm);
    },
    //実際に流す曲の名前
    trackFor:function(_name){
        if(_name == "kai2" && this.finale) return this.clock() ? "kai2" : this.finales[this.finale].v;
        var f = this.fights[this.fight].v;
        if(f && f[_name]) return f[_name];
        return _name;
    },
    //録音の曲を、今流す曲(_now。TRACKS の名前)とこの先に使いそうなものだけ読み込み、ほかは手放す(sound.music のたびに呼ぶ)
    //  この先：今のWAVEの戦闘曲・強化画面の曲・ボスWAVEはボス戦・ライバルのWAVEはライバル戦・最後のWAVEは最終局面。タイトルの曲はタイトルの画面でだけ
    prefetch:function(_now){
        var w = game.wave, want = {}, self = this;
        var add = function(_n){ want[self.trackFor(_n)] = true; };
        if(_now) want[_now] = true;
        add(w > REVEAL_WAVE ? "revolt" : w < 8 ? "heroic" : "battle");
        add(w > REVEAL_WAVE ? "revolt" : "shop");
        if(w % BOSS_EVERY == 0) add("boss");
        if(RIVAL_WAVES.indexOf(w) >= 0) add("rival");
        if(w >= FINAL_WAVE){ add("kai2"); if(this.clock()) want.triumph = true; }
        if(page.number == 0) add("title");
        for(var k in recorded.list){
            if(want[k]) recorded.list[k].load();
            else recorded.list[k].drop();
        }
    }
};

//録音の曲を流す(Lyria・Suno の最終局面・Suno の戦闘曲)。前奏は1回、そのあとは loopStart～loopEnd をくり返す
//_o：src(曲のファイル) key(ファイルが作る変数の名前) vol(音量)
//ファイルに終わり(endAt。tools/music-loop.py で付ける)があれば、finish() でくり返しを抜けて、元の曲の終わりまで流せる
function recTrack(_o){
    return {
        buf:null,       //読み込んだ曲(AudioBuffer)
        loading:false,
        src:null,       //流している音
        gain:null,
        mute:false,     //音を消して流す(時刻だけ使う。bgmTrial.clock)
        startAt:0,      //曲のどこから流し始めるか(秒。最終局面の試作 finaleSync.js・finaleTriumph.js が決める)
        ended:null,     //くり返しを抜けて終わりへ切り替えた { t:切り替えた時刻(sound.ctx), p:そのときの曲の時刻 }
        info:function(){ return window[_o.key]; },
        load:function(){
            if(this.buf || this.loading) return;
            this.loading = true;
            var self = this;
            var decode = function(){
                //ファイルは base64 の mp3(file:// で開いても読めるよう、JS に埋めてある)
                var b = atob(self.info().mp3), u = new Uint8Array(b.length);
                for(var i=0; i<b.length; i++) u[i] = b.charCodeAt(i);
                var wait = function(){
                    if(!sound.ctx){ setTimeout(wait, 200); return; }
                    sound.ctx.decodeAudioData(u.buffer, function(_b){ self.buf = _b; self.loading = false; },
                                              function(){ self.loading = false; });
                };
                wait();
            };
            if(this.info()){ decode(); return; }
            var el = document.createElement("script");
            el.src = _o.src;
            el.onload = decode;
            el.onerror = function(){ self.loading = false; };
            document.head.appendChild(el);
        },
        //曲の進みに合わせて呼ぶ(読み込みが終わっていて、まだ流していなければ流し始める)
        tick:function(_t){
            if(this.src) return;
            if(!this.buf){ this.load(); return; }
            var I = this.info(), ac = sound.ctx, s = ac.createBufferSource(), g = ac.createGain();
            s.buffer = this.buf;
            s.loop = true;
            s.loopStart = I.loopStart;
            s.loopEnd = I.loopEnd;
            g.gain.value = this.mute ? 0 : _o.vol;
            s.connect(g); g.connect(sound.bgmGain);     //BGMの音量・消音・こもらせ(ジャスト衝撃波)がそのまま効く
            s.start(_t, this.startAt);
            this.src = s; this.gain = g;
            this.at = _t - this.startAt;
            this.ended = null;
        },
        //スピーカーから出るまでの遅れ
        latency:function(){ var ac = sound.ctx; return ac.outputLatency || ac.baseLatency || 0; },
        //sound.ctx の時刻 _t に鳴らしている、元の曲の時刻(くり返しの分は戻す)
        songAt:function(_t){
            if(this.ended) return this.ended.p + (_t - this.ended.t);
            var I = this.info(), p = _t - this.at, A = I.loopStart, B = I.loopEnd;
            if(p >= B) p = A + (p - A) % (B - A);
            return p;
        },
        //曲のどこを鳴らしているか(秒。元の曲の時刻)。流していなければ -1
        //スピーカーから出るまでの遅れを引き、画面と耳がそろうようにする(曲に合わせて攻撃するため)
        pos:function(){
            if(!this.src) return -1;
            return this.songAt(sound.ctx.currentTime - this.latency());
        },
        //くり返しを抜けて、元の曲の終わりまで流す(終わりの付いたファイルだけ)。
        //終わりの部分(元の曲の endFrom 秒から)の同じ時刻へ、音の途切れなく切り替える。endFrom より前なら、そこまで待って切り替える
        finish:function(){
            var I = this.info();
            if(!this.src || this.ended || !I || I.endAt == null) return false;
            var ac = sound.ctx, T = ac.currentTime + 0.03, p = this.songAt(T);
            //くり返しのつなぎ目のすぐあと(画面の時刻はスピーカーの遅れの分だけ手前なので、まだつなぎ目の前)なら、
            //頭へ戻ったとみなさず、つなぎ目の先(終わりの部分)へ続ける。最後の和音がつなぎ目ちょうどの曲で、着く間際に押したとき用
            if(!this.ended && p - I.loopStart < 0.5 && T - this.at >= I.loopEnd) p = I.loopEnd + (p - I.loopStart);
            if(p < I.endFrom){ T += I.endFrom - p; p = I.endFrom; }
            var s = ac.createBufferSource();
            s.buffer = this.buf;
            s.connect(this.gain);
            s.start(T, I.endAt + (p - I.endFrom));
            try{ this.src.stop(T); }catch(e){}
            this.src = s;
            this.ended = { t:T, p:p };
            return true;
        },
        //開いた音を手放す(流している間は手放さない。ファイルは残るので、また使うときは開き直すだけ)
        drop:function(){
            if(!this.src) this.buf = null;
        },
        stop:function(){
            if(!this.src) return;
            try{ this.src.stop(); }catch(e){}
            this.src = null;
            this.ended = null;
        }
    };
}
//(_src：曲のファイル(JS)、_var：そのファイルが作る変数の名前、_vol：音量)
function recorded(_src,_var,_vol){ return recTrack({ src:_src, key:_var, vol:_vol }); }
var monarch = recorded(MONARCH_SRC, "BGM_MONARCH", MONARCH_VOL);
var triumph = recorded(TRIUMPH_SRC, "BGM_TRIUMPH", TRIUMPH_VOL);
var sunoHeroic = recorded(SUNO_HEROIC_SRC, "BGM_SUNO_HEROIC", SUNO_HEROIC_VOL);
var sunoBattle = recorded(SUNO_BATTLE_SRC, "BGM_SUNO_BATTLE", SUNO_BATTLE_VOL);
var sunoBoss = recorded(SUNO_BOSS_SRC, "BGM_SUNO_BOSS", SUNO_BOSS_VOL);
var sunoRival = recorded(SUNO_RIVAL_SRC, "BGM_SUNO_RIVAL", SUNO_RIVAL_VOL);     //曲の拍に合わせて戦う(rival.js の rival.beat)
var sunoRevolt = recorded(SUNO_REVOLT_SRC, "BGM_SUNO_REVOLT", SUNO_REVOLT_VOL);
var sunoTitle = recorded(SUNO_TITLE_SRC, "BGM_SUNO_TITLE", SUNO_TITLE_VOL);
var sunoShop = recorded(SUNO_SHOP_SRC, "BGM_SUNO_SHOP", SUNO_SHOP_VOL);
//TRACKS の名前 → 録音の曲
recorded.list = { monarch:monarch, triumph:triumph, sunoHeroic:sunoHeroic, sunoBattle:sunoBattle, sunoBoss:sunoBoss, sunoRival:sunoRival,
                  sunoRevolt:sunoRevolt, sunoTitle:sunoTitle, sunoShop:sunoShop };
bgmTrial.fight = viewOpt.music == "classic" ? 0 : FIGHT_DEFAULT;     //はじめはタイトルの設定のとおり

(function(){
    var actx = null;    //sound.ctx(ゲームの ctx はキャンバスなので別の名前にする)
    var rig = null;     //案D・F・H・I の配線(はじめて使うときに作る)
    //sound の再生状態を写したもの(試聴ページと同じ書き方で読めるように)
    var seq = { T:null, id:null, step:0, bar:0, arp:0 };

    function gainNode(_v,_to){ var g = actx.createGain(); g.gain.value = _v; if(_to) g.connect(_to); return g; }
    //残響の元(減衰するノイズ。左右で別のノイズにして広がりを出す)
    function impulse(_len,_decay){
        var rate = actx.sampleRate, n = Math.floor(rate*_len), b = actx.createBuffer(2, n, rate);
        for(var ch=0; ch<2; ch++){
            var d = b.getChannelData(ch);
            for(var i=0; i<n; i++) d[i] = (Math.random()*2 - 1) * Math.pow(1 - i/n, _decay);
        }
        return b;
    }
    function satCurve(_k){
        var n = 1024, c = new Float32Array(n);
        for(var i=0; i<n; i++){ var x = i/(n-1)*2 - 1; c[i] = Math.tanh(_k*x) / Math.tanh(_k); }
        return c;
    }
    //配線：軽い残響とこだま → 軽く歪ませて倍音を足す → まとめるコンプ → 音割れ止め → sound.bgmGain
    //  歪み・コンプの効き方を試聴ページとそろえるため、入口で BGM_VOLUME を掛け、出口で戻す
    //  (BGMのON/OFF・一時停止で小さくする・ゆっくりの間こもらせるのは、今までどおり sound.bgmGain から先で効く)
    function makeRig(){
        var r = { ctx:actx };
        var out = gainNode(1/BGM_VOLUME, sound.bgmGain);
        var lim = actx.createDynamicsCompressor();
        lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
        lim.connect(out);
        var glue = actx.createDynamicsCompressor();
        glue.threshold.value = -20; glue.knee.value = 10; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.2;
        glue.connect(lim);
        var sat = actx.createWaveShaper();
        sat.curve = satCurve(1.05);
        sat.connect(glue);
        var mix = gainNode(0.85, sat);
        //残響
        var conv = actx.createConvolver();
        conv.buffer = impulse(1.8, 3.4);
        var revWet = gainNode(0.55, mix);
        var revLo = actx.createBiquadFilter(); revLo.type = "highpass"; revLo.frequency.value = 250;
        conv.connect(revLo); revLo.connect(revWet);
        var revIn = gainNode(1, conv);
        //こだま(付点8分)。くり返すたびにこもっていく
        r.dl = actx.createDelay(2);
        var fb = gainNode(0.22);
        var dlf = actx.createBiquadFilter(); dlf.type = "lowpass"; dlf.frequency.value = 2800;
        r.dl.connect(dlf); dlf.connect(fb); fb.connect(r.dl);
        var dlWet = gainNode(0.35, mix);
        dlf.connect(dlWet);
        var dlIn = gainNode(1, r.dl);
        r.bgm = gainNode(BGM_VOLUME, mix);
        r.music = gainNode(1, r.bgm);
        r.drums = gainNode(1, r.bgm);
        r.revBgm = gainNode(BGM_VOLUME, revIn);
        r.dlyBgm = gainNode(BGM_VOLUME, dlIn);
        r.key = "";
        return r;
    }

    //試聴ページになかった曲は、似た曲の音量の調整値を使う
    var TRIAL_LIKE = { battle:"heroic", kai2:"boss", rival:"boss", shop:"title" };
    //和の怪談風で、曲ごとの主音(4小節ごとのおりんの高さ。0=C)
    var WA_TONIC = { title:0, unease:9, heroic:0, battle:9, boss:2, kai2:0, rival:4, revolt:4, shop:5 };
    //都節音階へ寄せる表(案Eのもの。ここでは使わないが stepWa が読む)
    var WA_SNAP = [0,1,1,5,5,5,7,7,8,8,12,12];
    var WA_TRIM = 0.36;     //和の怪談風・管弦・カリンバの全体の音量(今の音と同じくらいにそろえる)
    var SHAKU_TRIM = 1;     //案F の全体の音量
    //案F：メロディのない曲で尺八が吹く旋律(4小節でひと回り)。[8分音符の位置, 和音の何番目の音, オクターブ上げるか, 長さ(8分音符いくつ)]
    //案H の篠笛の短い節にも使う
    var SHAKU_PHRASES = [
        [[0,2,0,5],[6,1,0,2]],
        [[0,0,12,3],[4,2,0,4]],
        [[2,1,0,6]],
        [[0,2,0,3],[4,1,0,2],[6,0,0,2]]
    ];

    //出口・左右・残響・こだまへつなぐ
    function route(_node,_o){
        var c = actx, n = _node;
        if(_o.pan){ var p = c.createStereoPanner(); p.pan.value = _o.pan; n.connect(p); n = p; }
        n.connect(_o.dest);
        if(_o.rev) n.connect(gainNode(_o.rev, rig.revBgm));
        if(_o.dly) n.connect(gainNode(_o.dly, rig.dlyBgm));
    }
    //発振器の音。_o：type/wave f0 f1 dur vol dest when attack cutoff cut1 q detune pan rev dly vib
    function tone(_o){
        var c = actx, t = _o.when || c.currentTime, a = _o.attack || 0.005, dur = _o.dur;
        var g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(_o.vol, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
        var head = g;
        if(_o.cutoff){
            var f = c.createBiquadFilter();
            f.type = "lowpass";
            f.frequency.setValueAtTime(_o.cutoff, t);
            if(_o.cut1) f.frequency.exponentialRampToValueAtTime(_o.cut1, t + a + dur);
            if(_o.q) f.Q.value = _o.q;
            f.connect(g); head = f;
        }
        var dets = _o.detune ? [-_o.detune, _o.detune] : [0];
        var vib = null;
        if(_o.vib){
            //少し遅れてかかるビブラート
            var lfo = c.createOscillator(); lfo.frequency.value = 5.5;
            vib = c.createGain();
            vib.gain.setValueAtTime(0, t); vib.gain.linearRampToValueAtTime(_o.vib, t + 0.15);
            lfo.connect(vib); lfo.start(t); lfo.stop(t + a + dur + 0.05);
        }
        for(var i=0; i<dets.length; i++){
            var o = c.createOscillator();
            if(_o.wave) o.setPeriodicWave(_o.wave); else o.type = _o.type;
            o.frequency.setValueAtTime(_o.f0, t);
            if(_o.f1 && _o.f1 != _o.f0) o.frequency.exponentialRampToValueAtTime(_o.f1, t + (_o.glide || dur));
            o.detune.value = dets[i];
            if(vib) vib.connect(o.detune);
            if(dets.length > 1){ var og = gainNode(0.7, head); o.connect(og); } else o.connect(head);
            o.start(t); o.stop(t + a + dur + 0.05);
        }
        route(g, _o);
    }
    //ノイズ。_o：dur vol filter f0 f1 q dest when pan rev dly
    function noise(_o){
        var c = actx, t = _o.when || c.currentTime;
        var s = c.createBufferSource(); s.buffer = sound.noiseBuf;
        var f = c.createBiquadFilter(); f.type = _o.filter;
        f.frequency.setValueAtTime(_o.f0, t);
        if(_o.f1 && _o.f1 != _o.f0) f.frequency.exponentialRampToValueAtTime(_o.f1, t + _o.dur);
        if(_o.q) f.Q.value = _o.q;
        var g = c.createGain();
        g.gain.setValueAtTime(_o.vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + _o.dur);
        s.connect(f); f.connect(g);
        route(g, _o);
        s.start(t, Math.random()*0.5); s.stop(t + _o.dur + 0.05);
    }

    //案D・案F 和の怪談風：琴・尺八・低いうなり・太鼓・拍子木・鈴・おりん(_v が "e" のときの音階の寄せは、試聴ページの案Eのなごり)
    function waSnap(_n,_key){
        var pc = ((_n - _key) % 12 + 12) % 12;
        return _n - pc + WA_SNAP[pc];
    }
    function stepWa(_t,_st,_v){
        var T = seq.T, s = seq.step, M = rig.music, D = rig.drums, key = WA_TONIC[seq.id] || 0;
        var p = function(_n){ return _v == "e" ? waSnap(_n, key) : _n; };
        var chord = T.prog[seq.bar % T.prog.length], root = chord[0], tones = CHORD_TONES[chord[1]];
        var battle = T.bassType == "sawtooth";
        var F = _v == "f", dm = F ? 0.75 : 1;   //案F：打楽器を控えめに
        //ベース：静かな曲は丸い低音、戦闘の曲は太棹の三味線のように頭が硬くすぐ沈む音
        if(T.bass.charAt(s) == "x"){
            var n = p(root + ((T.bassOctUp && s % 4 == 2) ? 12 : 0));
            if(battle){
                tone({ type:"sawtooth", f0:sound.freq(n), dur:_st*1.2, vol:T.bassVol*0.9, dest:M, when:_t, attack:0.002, cutoff:1800, cut1:220, q:4 });
                tone({ type:"sine", f0:sound.freq(n), dur:_st*1.4, vol:T.bassVol*0.8, dest:M, when:_t });
            }else{
                tone({ type:"triangle", f0:sound.freq(n), dur:_st*2.2, vol:T.bassVol*1.1, dest:M, when:_t, cutoff:700 });
                tone({ type:"sine", f0:sound.freq(n - 12), dur:_st*2.4, vol:T.bassVol*0.4, dest:M, when:_t });
            }
        }
        //アルペジオ → 琴の爪弾き(爪の当たる音・はじいた直後に少し高く、すぐこもる)
        if(T.arp.charAt(s) == "x"){
            var k = seq.arp++;
            var n2 = p(root + T.arpOct + tones[k % tones.length] + (Math.floor(k / tones.length) % 2) * 12);
            var soft = T.arpType == "triangle", f = sound.freq(n2), pan = k % 2 ? 0.3 : -0.3;
            var v = T.arpVol * (soft ? 0.75 : 1.9) * (F ? 0.5 : 1);
            tone({ type:"sawtooth", f0:f*1.006, f1:f, glide:0.06, dur:_st*(soft ? 2.2 : 1.4), vol:v, dest:M, when:_t, attack:0.002, cutoff:4200, cut1:420, q:2, pan:pan, rev:0.3 });
            noise({ dur:0.018, vol:v*1.6, filter:"bandpass", f0:Math.min(f*3, 9000), q:5, dest:M, when:_t, pan:pan });
        }
        //和音 → 根音と5度の低いうなり(わずかにずらして揺らす)。小節の頭で長く
        if(s == 0){
            var dv = (T.pad || 0.01) * 1.1, dr = p(root + 12), d5 = p(root + 19);
            tone({ type:"sine", f0:sound.freq(dr), dur:_st*16, vol:dv, dest:M, when:_t, attack:0.4, detune:5 });
            tone({ type:"triangle", f0:sound.freq(d5), dur:_st*16, vol:dv*0.35, dest:M, when:_t, attack:0.6, cutoff:900, rev:0.4 });
        }
        //4小節ごとに、おりん(倍音が整数倍でない澄んだ金属の音)
        if(s == 0 && seq.bar % 4 == 0){
            var bf = sound.freq(key + 72), parts = [[1,0.035,3.2],[2.76,0.018,2.0],[5.4,0.009,1.1],[8.93,0.004,0.6]];
            for(var i=0; i<parts.length; i++) tone({ type:"sine", f0:bf*parts[i][0], dur:parts[i][2], vol:parts[i][1], dest:M, when:_t, attack:0.002, pan:0.15, rev:0.5 });
        }
        //キック → 太鼓(皮の響きを少し)
        if(T.kick.charAt(s) == "x"){
            tone({ type:"sine", f0:120, f1:48, dur:battle ? 0.22 : 0.4, vol:0.55*dm, dest:D, when:_t, attack:0.003 });
            noise({ dur:0.07, vol:0.18*dm, filter:"lowpass", f0:500, dest:D, when:_t, rev:0.15 });
        }
        //スネア → 拍子木(乾いた木の「カン」)
        if(T.snare.charAt(s) == "x"){
            tone({ type:"sine", f0:2100, dur:0.035, vol:0.16*dm, dest:D, when:_t, attack:0.001, rev:0.35 });
            tone({ type:"sine", f0:3180, dur:0.022, vol:0.07*dm, dest:D, when:_t, attack:0.001 });
            noise({ dur:0.025, vol:0.16*dm, filter:"bandpass", f0:2600, q:6, dest:D, when:_t });
        }
        //ハイハット → 鈴(細かい金属のさざめき)
        if(T.hat.charAt(s) == "x"){
            noise({ dur:0.04, vol:(0.035 + Math.random()*0.015)*dm, filter:"highpass", f0:8500, dest:D, when:_t, pan:-0.2 });
            tone({ type:"sine", f0:5600 + Math.random()*500, dur:0.05, vol:0.005, dest:D, when:_t, attack:0.001 });
        }
        //案F：尺八が主役。メロディは音をつなげてのばす(次の音まで。最大で8分音符4つ)。メロディのない曲は SHAKU_PHRASES を吹く
        if(F){
            if(T.lead && s % 2 == 0){
                var at = (seq.bar % 8) * 8 + s/2, ln2 = T.lead[at % T.lead.length];
                if(ln2){
                    var len = 1;
                    while(len < 4 && !T.lead[(at + len) % T.lead.length]) len++;
                    var after = !T.lead[(at + T.lead.length - 1) % T.lead.length];   //休みのあとは、深くすくい上げて入る
                    shaku(_t, sound.freq(ln2), _st*2*len*0.96, 0.07, after);
                }
            }else if(!T.lead){
                var ph = SHAKU_PHRASES[seq.bar % SHAKU_PHRASES.length];
                for(var i=0; i<ph.length; i++){
                    if(ph[i][0]*2 != s) continue;
                    var sn = root + 24 + tones[ph[i][1] % tones.length] + ph[i][2];
                    while(sn > 84) sn -= 12;
                    while(sn < 64) sn += 12;
                    shaku(_t, sound.freq(sn), _st*2*ph[i][3]*0.96, 0.04, true);
                }
            }
            return;
        }
        //メロディ → 尺八(少し低いところから音程をすべらせて入り、遅れてビブラート。息の音を混ぜる)
        if(T.lead && s % 2 == 0){
            var ln = T.lead[((seq.bar % 8) * 8 + s/2) % T.lead.length];
            if(ln){
                var lf = sound.freq(p(ln));
                tone({ type:"sine", f0:lf*0.966, f1:lf, glide:0.07, dur:_st*1.8, vol:0.045, dest:M, when:_t, attack:0.04, vib:12, rev:0.35, dly:0.2 });
                tone({ type:"triangle", f0:lf*0.966, f1:lf, glide:0.07, dur:_st*1.6, vol:0.012, dest:M, when:_t, attack:0.04, cutoff:2400 });
                noise({ dur:_st*1.4, vol:0.018, filter:"bandpass", f0:lf*2, q:3, dest:M, when:_t, rev:0.3 });
                noise({ dur:0.05, vol:0.03, filter:"highpass", f0:1500, dest:M, when:_t });
            }
        }
    }

    //尺八の1音(案F)。_bend：下から深くすくい上げて入る
    //  音の芯(正弦波)＋少しの倍音＋息の音。長い音は途中でふくらみ、遅れてビブラートが深くなり、最後に音程が少し落ちる
    function shaku(_t,_f,_dur,_vol,_bend){
        var c = actx, end = _t + _dur, long = _dur > 0.6, a = _bend ? 0.09 : 0.05;
        var g = c.createGain();
        g.gain.setValueAtTime(0.0001, _t);
        g.gain.exponentialRampToValueAtTime(_vol, _t + a);
        if(long) g.gain.linearRampToValueAtTime(_vol*1.2, _t + _dur*0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        var lfo = c.createOscillator();
        lfo.frequency.value = 4.8;
        var vib = c.createGain();
        vib.gain.setValueAtTime(0, _t);
        vib.gain.setValueAtTime(0, _t + Math.min(0.3, _dur*0.4));
        vib.gain.linearRampToValueAtTime(long ? 24 : 8, _t + _dur*0.85);
        lfo.connect(vib);
        lfo.start(_t); lfo.stop(end + 0.05);
        var parts = [["sine",1,1],["triangle",1,0.22],["sine",2,0.07]];
        for(var i=0; i<parts.length; i++){
            var o = c.createOscillator(), f = _f*parts[i][1];
            o.type = parts[i][0];
            o.frequency.setValueAtTime(f*(_bend ? 0.95 : 0.985), _t);
            o.frequency.exponentialRampToValueAtTime(f, _t + (_bend ? 0.14 : 0.05));
            if(long){
                o.frequency.setValueAtTime(f, end - 0.2);
                o.frequency.exponentialRampToValueAtTime(f*0.972, end);
            }
            vib.connect(o.detune);
            var og = c.createGain(); og.gain.value = parts[i][2];
            o.connect(og); og.connect(g);
            o.start(_t); o.stop(end + 0.05);
        }
        route(g, { dest:rig.music, rev:0.4, dly:0.18 });
        //息の音：吹き始めの「フッ」と、音の間ずっと混ざるかすれ
        noise({ dur:0.08, vol:_vol*(_bend ? 0.9 : 0.5), filter:"highpass", f0:1300, dest:rig.music, when:_t });
        noise({ dur:_dur*0.9, vol:_vol*0.32, filter:"bandpass", f0:Math.min(_f*1.5, 6000), q:1.5, dest:rig.music, when:_t, rev:0.3 });
    }

    //のびる音(弦・低音)：立ち上がり_atk 秒、のびて、終わりに_rel 秒で消える
    function held(_o){
        var c = actx, t = _o.when, end = t + _o.dur;
        var g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(_o.vol, t + _o.atk);
        g.gain.setValueAtTime(_o.vol, Math.max(t + _o.atk, end - _o.rel));
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        var f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = _o.cutoff || 2000;
        f.connect(g);
        var dets = _o.detune ? [-_o.detune, _o.detune] : [0];
        for(var i=0; i<dets.length; i++){
            var o = c.createOscillator(); o.type = _o.type;
            o.frequency.value = _o.f0; o.detune.value = dets[i];
            o.connect(f); o.start(t); o.stop(end + 0.05);
        }
        route(g, _o);
    }

    //篠笛の1音。_orn："grace" 上の音から打つ(指打ち)／"slide" 下からすくい上げる／なし
    //  澄んだ芯(正弦波)＋少しの倍音＋息。のびる音はふくらんで、遅れてビブラート
    function fue(_t,_f,_dur,_vol,_orn){
        var c = actx, end = _t + _dur, long = _dur > 0.5;
        var g = c.createGain();
        g.gain.setValueAtTime(0.0001, _t);
        g.gain.exponentialRampToValueAtTime(_vol, _t + 0.03);
        g.gain.linearRampToValueAtTime(_vol*(long ? 1.15 : 1), _t + _dur*0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, end + 0.08);
        var lfo = c.createOscillator(); lfo.frequency.value = 5.6;
        var vib = c.createGain();
        vib.gain.setValueAtTime(0, _t);
        vib.gain.setValueAtTime(0, _t + Math.min(0.25, _dur*0.4));
        vib.gain.linearRampToValueAtTime(long ? 18 : 5, _t + _dur*0.9);
        lfo.connect(vib); lfo.start(_t); lfo.stop(end + 0.15);
        var parts = [["sine",1,1],["triangle",1,0.18],["sine",2,0.1],["sine",3,0.035]];
        for(var i=0; i<parts.length; i++){
            var o = c.createOscillator(), f = _f*parts[i][1];
            o.type = parts[i][0];
            if(_orn == "grace"){
                o.frequency.setValueAtTime(f*Math.pow(2, 2/12), _t);
                o.frequency.setValueAtTime(f, _t + 0.045);
            }else if(_orn == "slide"){
                o.frequency.setValueAtTime(f*Math.pow(2, -1.5/12), _t);
                o.frequency.exponentialRampToValueAtTime(f, _t + 0.07);
            }else o.frequency.setValueAtTime(f, _t);
            vib.connect(o.detune);
            var og = c.createGain(); og.gain.value = parts[i][2];
            o.connect(og); og.connect(g);
            o.start(_t); o.stop(end + 0.15);
        }
        route(g, { dest:rig.music, rev:0.45, dly:0.15 });
        //息：吹き始めの「フッ」と、のびる間のかすれ
        noise({ dur:0.05, vol:_vol*0.55, filter:"highpass", f0:2500, dest:rig.music, when:_t });
        noise({ dur:_dur*0.9, vol:_vol*0.2, filter:"bandpass", f0:Math.min(_f*1.2, 8000), q:1.2, dest:rig.music, when:_t, rev:0.3 });
    }

    var I_TRIM = { title:0.44, unease:0.46, heroic:0.89, boss:0.95, revolt:1 };     //曲ごとの音量(今の音と同じくらいにそろえる)
    //カリンバの1音：金属の舌をはじいた澄んだ芯(すぐには消えない)＋高い倍音(すぐ消える。整数倍でない「キン」)＋はじく「コッ」
    function kalimba(_t,_f,_vol,_pan,_len){
        var c = actx, len = _len || 1.4;
        var parts = [[1,1,len],[2,0.06,len*0.3],[5.95,0.16,0.09],[8.6,0.05,0.04]];
        var out = c.createGain(); out.gain.value = 1;
        for(var i=0; i<parts.length; i++){
            var o = c.createOscillator(), f = _f*parts[i][0];
            o.type = "sine";
            o.frequency.setValueAtTime(f*1.004, _t);
            o.frequency.exponentialRampToValueAtTime(f, _t + 0.03);
            var g = c.createGain();
            g.gain.setValueAtTime(0.0001, _t);
            g.gain.exponentialRampToValueAtTime(_vol*parts[i][1], _t + 0.003);
            g.gain.exponentialRampToValueAtTime(0.0001, _t + parts[i][2]);
            o.connect(g); g.connect(out);
            o.start(_t); o.stop(_t + parts[i][2] + 0.05);
        }
        route(out, { dest:rig.music, pan:_pan, rev:0.3, dly:0.12 });
        noise({ dur:0.012, vol:_vol*0.5, filter:"bandpass", f0:Math.min(_f*4, 7000), q:2, dest:rig.music, when:_t, pan:_pan });
    }
    function stepI(_t,_st){
        var T = seq.T, s = seq.step, bar = seq.bar % 8, M = rig.music, D = rig.drums, battle = T.bassType == "sawtooth";
        var chord = T.prog[seq.bar % T.prog.length], root = chord[0], tones = CHORD_TONES[chord[1]];
        var barLen = _st*16;
        //やわらかい和音(小節の頭からのびる)。カリンバの響きを支える
        if(s == 0){
            for(var i=0; i<tones.length; i++){
                var n = root + 24 + tones[i];
                while(n > 69) n -= 12;
                held({ type:"triangle", f0:sound.freq(n), dur:barLen + 0.05, vol:battle ? 0.006 : 0.012, atk:0.35, rel:0.3, cutoff:1200, detune:6, dest:M, when:_t, rev:0.5, pan:(i - 1.5)*0.25 });
            }
        }
        //低音
        if(T.bass.charAt(s) == "x"){
            var bn = root + ((T.bassOctUp && s % 4 == 2) ? 12 : 0);
            if(battle){
                tone({ type:"sawtooth", f0:sound.freq(bn), dur:_st*1.4, vol:T.bassVol*0.8, dest:M, when:_t, cutoff:1100, cut1:260, q:3 });
                tone({ type:"sine", f0:sound.freq(bn), dur:_st*1.5, vol:T.bassVol*0.8, dest:M, when:_t });
            }else{
                held({ type:"sine", f0:sound.freq(bn), dur:_st*7.5, vol:0.06, atk:0.04, rel:0.3, cutoff:500, dest:M, when:_t });
                held({ type:"triangle", f0:sound.freq(bn), dur:_st*7.5, vol:0.04, atk:0.04, rel:0.3, cutoff:500, dest:M, when:_t });
            }
        }
        //アルペジオ → カリンバ(左右の親指で交互にはじくように、左右へ振る)。静かな曲は主役、戦闘の曲は控えめ
        if(T.arp.charAt(s) == "x"){
            var k = seq.arp++;
            var n2 = root + T.arpOct + tones[k % tones.length] + (Math.floor(k / tones.length) % 2) * 12;
            kalimba(_t, sound.freq(n2), battle ? 0.035 : 0.15, k % 2 ? 0.35 : -0.35, battle ? 0.6 : 1.6);
            //静かな曲：小節の頭は2本の舌を同時にはじいて、和音にする
            if(!battle && s == 0) kalimba(_t, sound.freq(n2 - 12 + (tones[2] || 7)), 0.09, 0, 1.8);
        }
        //打楽器(軽め)：キックはやわらかく、スネアは指で鳴らすような乾いた音、ハイハットはシェイカー
        if(T.kick.charAt(s) == "x"){
            tone({ type:"sine", f0:130, f1:45, dur:battle ? 0.16 : 0.3, vol:battle ? 0.5 : 0.35, dest:D, when:_t, attack:0.003 });
        }
        if(T.snare.charAt(s) == "x"){
            noise({ dur:0.1, vol:0.2, filter:"bandpass", f0:2200, q:1, dest:D, when:_t, rev:0.25 });
            noise({ dur:0.02, vol:0.12, filter:"highpass", f0:5000, dest:D, when:_t });
        }
        if(T.hat.charAt(s) == "x"){
            noise({ dur:0.05, vol:0.03 + (s % 4 == 2 ? 0.012 : 0), filter:"bandpass", f0:7000, q:1.5, dest:D, when:_t, pan:0.25 });
        }
        //メロディ(戦闘の曲)：カリンバが主役。消えていく音を、やわらかい笛のような音が下で少し支える
        if(T.lead && s % 2 == 0){
            var ln = T.lead[(bar*8 + s/2) % T.lead.length];
            if(ln){
                kalimba(_t, sound.freq(ln), 0.15, 0, 1.0);
                tone({ type:"sine", f0:sound.freq(ln), dur:_st*1.6, vol:0.012, dest:M, when:_t, attack:0.02, rev:0.2 });
            }
        }
    }


    //案H 管弦と篠笛：ドローン君の曲(TRACKS)を、弦・ハープ・太鼓のオーケストラ風に編曲する。篠笛は主役にせず、後半4小節で彩りに加わる
    var H_TRIM = { title:0.52, unease:0.54, heroic:0.74, boss:0.81, revolt:0.82 };     //曲ごとの音量(今の音と同じくらいにそろえる)
    function stepH(_t,_st){
        var T = seq.T, s = seq.step, bar = seq.bar % 8, M = rig.music, D = rig.drums, battle = T.bassType == "sawtooth";
        var chord = T.prog[seq.bar % T.prog.length], root = chord[0], tones = CHORD_TONES[chord[1]];
        var barLen = _st*16, late = bar >= 4;
        //弦の和音(小節の頭からのびる)
        if(s == 0){
            for(var i=0; i<tones.length; i++){
                var n = root + 24 + tones[i];
                while(n > 69) n -= 12;
                held({ type:"sawtooth", f0:sound.freq(n), dur:barLen + 0.05, vol:battle ? 0.007 : 0.011, atk:battle ? 0.12 : 0.45, rel:0.25,
                       cutoff:battle ? 1500 : 1300, detune:9, dest:M, when:_t, rev:0.55, pan:(i - 1.5)*0.25 });
            }
        }
        //低音：戦闘の曲は弦の低音で刻む、静かな曲はのびる低音
        if(T.bass.charAt(s) == "x"){
            var bn = root + ((T.bassOctUp && s % 4 == 2) ? 12 : 0);
            if(battle){
                tone({ type:"sawtooth", f0:sound.freq(bn), dur:_st*1.5, vol:0.1, dest:M, when:_t, cutoff:900, cut1:250, q:3 });
                tone({ type:"sine", f0:sound.freq(bn), dur:_st*1.6, vol:0.1, dest:M, when:_t });
            }else{
                held({ type:"triangle", f0:sound.freq(bn), dur:_st*7.5, vol:0.11, atk:0.06, rel:0.3, cutoff:600, dest:M, when:_t });
                held({ type:"sine", f0:sound.freq(bn - 12), dur:_st*7.5, vol:0.04, atk:0.08, rel:0.3, cutoff:400, dest:M, when:_t });
            }
        }
        //アルペジオ：戦闘の曲は弦の刻み、静かな曲はハープ
        if(T.arp.charAt(s) == "x"){
            var k = seq.arp++;
            var n2 = root + T.arpOct + tones[k % tones.length] + (Math.floor(k / tones.length) % 2) * 12;
            if(battle) tone({ type:"sawtooth", f0:sound.freq(n2 - 12), dur:_st*0.6, vol:0.016, dest:M, when:_t, attack:0.004, cutoff:2400, cut1:900, detune:6, pan:k % 2 ? 0.35 : -0.35, rev:0.2 });
            else tone({ type:"triangle", f0:sound.freq(n2), dur:_st*5, vol:0.03, dest:M, when:_t, attack:0.002, cutoff:3500, cut1:900, pan:k % 2 ? 0.4 : -0.1, rev:0.4 });
        }
        //打楽器
        if(battle){
            if(T.kick.charAt(s) == "x"){
                tone({ type:"sine", f0:110, f1:45, dur:0.3, vol:0.55, dest:D, when:_t, attack:0.003 });
                noise({ dur:0.06, vol:0.18, filter:"lowpass", f0:600, dest:D, when:_t, rev:0.2 });
            }
            if(T.snare.charAt(s) == "x"){
                noise({ dur:0.16, vol:0.26, filter:"bandpass", f0:1800, q:0.8, dest:D, when:_t, rev:0.3 });
                tone({ type:"triangle", f0:210, f1:150, dur:0.07, vol:0.14, dest:D, when:_t });
            }
            if(T.hat.charAt(s) == "x") noise({ dur:0.03, vol:0.04 + (s % 4 == 0 ? 0.015 : 0), filter:"highpass", f0:8000, dest:D, when:_t, pan:0.2 });
            //シンバル：1小節目と、篠笛が加わる5小節目の頭
            if(s == 0 && bar % 4 == 0) noise({ dur:1.8, vol:bar == 0 ? 0.09 : 0.06, filter:"highpass", f0:5000, dest:D, when:_t, rev:0.4 });
            //8小節目の後半：太鼓のフィル(16分で下がっていく)
            if(bar == 7 && s >= 8){
                tone({ type:"sine", f0:200 - (s - 8)*14, f1:70, dur:0.18, vol:0.3, dest:D, when:_t, attack:0.002 });
                noise({ dur:0.04, vol:0.1, filter:"lowpass", f0:900, dest:D, when:_t });
            }
        }else{
            //4小節ごとに、遠くで鳴る大太鼓
            if(s == 0 && bar % 4 == 0){
                tone({ type:"sine", f0:90, f1:40, dur:0.9, vol:0.35, dest:D, when:_t, attack:0.005, rev:0.4 });
                noise({ dur:0.1, vol:0.08, filter:"lowpass", f0:400, dest:D, when:_t, rev:0.4 });
            }
            //篠笛が加わる前の小節で、シンバルをふくらませる
            if(s == 0 && bar == 3){
                var sw = actx.createBufferSource(); sw.buffer = sound.noiseBuf; sw.loop = true;
                var sf = actx.createBiquadFilter(); sf.type = "highpass"; sf.frequency.value = 4500;
                var sg = actx.createGain();
                sg.gain.setValueAtTime(0.0001, _t);
                sg.gain.exponentialRampToValueAtTime(0.05, _t + barLen);
                sg.gain.exponentialRampToValueAtTime(0.0001, _t + barLen + 0.6);
                sw.connect(sf); sf.connect(sg);
                route(sg, { dest:D, rev:0.5 });
                sw.start(_t); sw.stop(_t + barLen + 0.7);
            }
        }
        //メロディ：弦(1オクターブ下に金管のような太い音を重ねる)。音は次の音までつなげる。後半4小節は篠笛が1オクターブ上で重なる
        if(T.lead && s % 2 == 0){
            var at = bar*8 + s/2, L = T.lead.length, ln = T.lead[at % L];
            if(ln){
                var len = 1;
                while(len < 4 && !T.lead[(at + len) % L]) len++;
                var dur = _st*2*len*0.95;
                held({ type:"sawtooth", f0:sound.freq(ln), dur:dur, vol:0.03, atk:0.03, rel:0.08, cutoff:3000, detune:7, dest:M, when:_t, rev:0.35 });
                held({ type:"sawtooth", f0:sound.freq(ln - 12), dur:dur, vol:0.018, atk:0.04, rel:0.08, cutoff:1800, detune:5, dest:M, when:_t, rev:0.25 });
                if(late){
                    var prev = T.lead[(at + L - 1) % L];
                    fue(_t, sound.freq(ln + (ln + 12 <= 91 ? 12 : 0)), dur, 0.04, !prev ? "slide" : len >= 3 ? "grace" : null);
                }
            }
        }else if(!T.lead && bar % 4 >= 2){
            //メロディのない静かな曲：3・4小節目と7・8小節目に、篠笛が短い節で答える
            var ph = SHAKU_PHRASES[bar % 4];
            for(var i=0; i<ph.length; i++){
                if(ph[i][0]*2 != s) continue;
                var sn = root + 24 + tones[ph[i][1] % tones.length] + ph[i][2];
                while(sn > 88) sn -= 12;
                while(sn < 72) sn += 12;
                fue(_t, sound.freq(sn), _st*2*ph[i][3]*0.96, 0.035, i == 0 ? "slide" : "grace");
            }
        }
    }

    //最終局面：原点回帰。音色は今の音のまま(矩形波・三角波・正弦波・ノイズ。sound.tone・noise で鳴らす)、32小節でひと回り
    //  1〜8小節  タイトルの和音を、ゆっくりした分散和音で(はじまりの記憶)
    //  9〜16小節 序盤の戦闘曲のメロディが戻ってくる(和音もその曲のまま。伴奏はタイトルの三角波)
    //  17〜24小節 1音上げて最高潮。メロディを1オクターブ下でも重ね、分散和音は16分、低音は刻み、タイトルの和音ものせる
    //  25〜32小節 タイトルの和音へ帰る。序盤の戦闘曲の頭のメロディを、半分の速さで三角波がなつかしく歌う
    var FINAL_PROG = [].concat(TRACKS.title.prog, TRACKS.title.prog, TRACKS.heroic.prog,
        TRACKS.heroic.prog.map(function(c){ return [c[0] + 2, c[1]]; }), TRACKS.title.prog, TRACKS.title.prog);
    TRACKS.finale = { bpm:132, prog:FINAL_PROG };
    TRACKS.monarch = { bpm:160 };   //録音の曲。音符は作らず、曲の進みだけ使う(monarch.tick)
    TRACKS.triumph = { bpm:160 };
    TRACKS.sunoHeroic = { bpm:150 };
    TRACKS.sunoBattle = { bpm:138 };
    TRACKS.sunoBoss = { bpm:153 };
    TRACKS.sunoRival = { bpm:170 };
    TRACKS.sunoRevolt = { bpm:145 };
    TRACKS.sunoTitle = { bpm:94 };
    TRACKS.sunoShop = { bpm:98 };
    var FINAL_ARP   = ["x...x...x...x...", "x.x.x.x.x.x.x.x.", "xxxxxxxxxxxxxxxx", "x.x.x.x.x.x.x.x."];
    var FINAL_KICK  = ["x...............", "x...x...x...x...", "x..x..x.x..x..x.", "x.......x......."];
    var FINAL_SNARE = ["................", "....x.......x...", "....x.......x..x", "................"];
    var FINAL_HAT   = ["....x.......x...", "x.x.x.x.x.x.x.x.", "x.x.x.x.x.x.x.x.", "..x...x...x...x."];
    function stepFinal(_t,_st){
        var S = sound, s = S.step, bar = S.bar % 32, sec = Math.floor(bar / 8), B = S.bgmGain, H = TRACKS.heroic;
        var chord = FINAL_PROG[bar], root = chord[0], tones = CHORD_TONES[chord[1]];
        //和音(タイトルの正弦波の和音)。メロディが戻ってくる2つ目の区切りだけは抜いて、戦闘曲の音にする
        if(s == 0 && sec != 1){
            for(var i=0; i<tones.length; i++) S.tone("sine", S.freq(root + 24 + tones[i]), 0, _st*15, sec == 2 ? 0.02 : 0.025, B, _t, 0.25);
        }
        //低音：はじめと終わりはタイトルの三角波、なかは戦闘曲ののこぎり波(最高潮はボス戦の16分の刻み)
        if(sec == 0 || sec == 3){
            if(TRACKS.title.bass.charAt(s) == "x") S.tone("triangle", S.freq(root), 0, _st*1.6, 0.22, B, _t, 0.005, 700);
        }else{
            var bp = sec == 2 ? TRACKS.boss.bass : H.bass;
            if(bp.charAt(s) == "x") S.tone("sawtooth", S.freq(root + (s % 4 == 2 ? 12 : 0)), 0, _st*1.6, 0.12, B, _t, 0.005, 700);
        }
        //分散和音：はじめはゆっくり、最高潮は戦闘曲の矩形波の16分
        if(FINAL_ARP[sec].charAt(s) == "x"){
            var k = S.arpIndex++;
            var n2 = root + 24 + tones[k % tones.length] + (Math.floor(k / tones.length) % 2) * 12;
            if(sec == 2) S.tone("square", S.freq(n2), 0, _st*0.9, 0.016, B, _t, 0.005, 2400);
            else S.tone("triangle", S.freq(n2), 0, _st*(sec == 0 ? 1.8 : 0.9), 0.05, B, _t, 0.005, 2400);
        }
        //ドラム(今の音のまま)
        if(FINAL_KICK[sec].charAt(s) == "x") S.tone("sine", 150, 40, 0.14, 0.5, B, _t);
        if(FINAL_SNARE[sec].charAt(s) == "x"){
            S.noise(0.14, 0.22, "highpass", 1200, 1200, B, _t);
            S.tone("triangle", 190, 150, 0.06, 0.12, B, _t);
        }
        if(FINAL_HAT[sec].charAt(s) == "x") S.noise(0.035, 0.07, "highpass", 7000, 7000, B, _t);
        //つなぎ：8小節目・16小節目の後半はスネアの連打でだんだん強く、次の頭でシンバル
        if((bar == 7 || bar == 15) && s >= 8){
            S.noise(0.08, 0.05 + (s - 8)*0.02, "highpass", 1200, 1200, B, _t);
            S.tone("triangle", 190, 150, 0.05, 0.04 + (s - 8)*0.01, B, _t);
        }
        if((bar == 8 || bar == 16) && s == 0) S.noise(1.4, 0.14, "highpass", 6000, 3000, B, _t);
        //メロディ
        if((sec == 1 || sec == 2) && s % 2 == 0){
            var ln = H.lead[((bar % 8) * 8 + s/2) % H.lead.length];
            if(ln){
                ln += sec == 2 ? 2 : 0;
                S.tone("square", S.freq(ln), 0, _st*1.7, 0.035, B, _t, 0.01, 2600);
                if(sec == 2) S.tone("triangle", S.freq(ln - 12), 0, _st*1.7, 0.05, B, _t, 0.01);
            }
        }
        //帰り道：序盤の戦闘曲の頭4小節のメロディを、半分の速さで(4分音符ごと)
        if(sec == 3 && s % 4 == 0){
            var ln2 = H.lead[(bar - 24)*4 + s/4];
            if(ln2) S.tone("triangle", S.freq(ln2), 0, _st*3.4, 0.06, B, _t, 0.02, 3000);
        }
    }

    //曲と案が変わったら、音量とこだまの間隔を合わせる
    function tune(_v){
        var key = _v + ":" + sound.trackName + ":" + sound.bpm;
        if(rig.key == key) return;
        rig.key = key;
        var like = TRIAL_LIKE[sound.trackName] || sound.trackName;
        var trim = WA_TRIM * (_v == "f" ? SHAKU_TRIM : 1);
        if(_v == "h") trim *= H_TRIM[like] || 1;
        if(_v == "i") trim *= I_TRIM[like] || 1;
        rig.bgm.gain.value = BGM_VOLUME * trim;
        rig.dl.delayTime.value = 0.75 * 60 / sound.bpm;
    }

    var music = sound.music, playStep = sound.playStep;
    var stopMusic = sound.stopMusic;
    sound.music = function(_name,_bpm){
        music.call(this, bgmTrial.trackFor(_name), _bpm);
        var clock = this.trackName == "kai2" && bgmTrial.clock();     //最終局面をクラシックの曲で：裏の Suno の曲は止めない
        for(var k in recorded.list) if(k != this.trackName && !(clock && k == "triumph")) recorded.list[k].stop();
        bgmTrial.prefetch(_name ? bgmTrial.trackFor(_name) : null);
    };
    sound.stopMusic = function(){
        stopMusic.call(this);
        for(var k in recorded.list) recorded.list[k].stop();
    };
    sound.playStep = function(_t,_st){
        if(this.trackName == "finale"){ stepFinal(_t, _st); return; }
        if(recorded.list[this.trackName]){ recorded.list[this.trackName].mute = false; recorded.list[this.trackName].tick(_t); return; }
        //最終局面をクラシックの曲で：Suno 版の戦いの時刻を決める曲を、音を消して流す
        if(this.trackName == "kai2" && bgmTrial.clock()){ triumph.mute = true; triumph.tick(_t); }
        var v = bgmTrial.v();
        if(v == "orig"){ playStep.call(this, _t, _st); return; }
        actx = this.ctx;
        if(!rig || rig.ctx != actx) rig = makeRig();
        tune(v);
        seq.T = this.track; seq.id = this.trackName;
        seq.step = this.step; seq.bar = this.bar; seq.arp = this.arpIndex;
        if(v == "h") stepH(_t, _st);
        else if(v == "i") stepI(_t, _st);
        else stepWa(_t, _st, v);
        this.arpIndex = seq.arp;
    };
})();
