//------------------------------------------------------------------------------
//  ふたりで協力プレイ
//  PeerJS(lib/peerjs.min.js)でブラウザ同士を直接つなぐ(WebRTC)。
//  最初のつなぎ合わせだけPeerJSの公開サーバー(0.peerjs.com)が仲介する。インターネット接続が必要。
//  部屋はホストが作る4文字のコードで指定する(招待リンク「…#join=コード」を開いても参加できる)
//
//  ・ホスト(部屋を作った人)の画面で敵・敵の弾・アイテムを動かし、状態をゲストへ送る
//  ・ゲストは自分のドローン君と武器を自分の画面で動かし、敵に与えたダメージ・
//    拾ったアイテム・衝撃波を「合計値」でホストへ送る(途中が抜けても合計なので狂わない)
//  ・被弾の判定は、それぞれが自分のドローン君について行う
//  ・強化・装備・パーツはそれぞれ別。敵の体力は2倍
//------------------------------------------------------------------------------
const COOP_TYPES  = ["bug","dasher","shooter","tank","spinner","bomber","kin","mdrone","heli","panzer","goldbug","carrier","queen","fortress","kai"];
const COOP_SHOTS  = ["normal","small","big","water","missile","dragon"];
const COOP_PICKS  = ["part","fuel","capsule"];
const COOP_MODES  = ["enter","idle","aim","dash","spiral","triple","laserAim","laser"];
const COOP_STATES = ["start","play","clear","over"];
const COOP_LIMIT  = 12000;  //1回に送る状態の大きさの上限(バイト)。超えるときはゲストから遠いものから削る
const COOP_HP_MUL = 2;      //協力プレイでの敵の体力の倍率
const COOP_ID_PREFIX = "dronekun-room-";  //PeerJSのIDの頭に付ける(ほかのアプリのIDとぶつからないように)
const COOP_CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";  //部屋コードに使う文字(見間違えやすい i l o 0 1 は使わない)
const COOP_TIMEOUT = 8000;  //相方から何も届かないまま、この時間(ミリ秒)たったら切断とみなす
const COOP_NO_REPLY = 12000; //ゲストがつながってから、この時間(ミリ秒)ホストから何も届かなければ入り直しを案内する
const P2_COLOR    = "40,130,230";

var enemySeq = 0;           //敵の通し番号(ホストとゲストで同じ敵を指すため)
var pickupSeq = 0;

//敵が狙うプレイヤー(いちばん近い、倒れていない方)
function nearestPlayer(_x,_y){
    var me = mainScreen.down ? null : drone;
    var p = coop.partnerTarget();
    if(!me && !p) return drone;
    if(!me) return p;
    if(!p) return me;
    return Math.hypot(p.X - _x, p.Y - _y) < Math.hypot(me.X - _x, me.Y - _y) ? p : me;
}
var aimAt = null;   //いま動かしている敵が狙っている相手(bosses.js・forces.jsから使う)

var coop = {
    available:false,    //この環境で協力プレイを使えるか(PeerJSとWebRTCがあるか)
    peer:null,          //自分のPeerJSの窓口
    conn:null,          //相方とのつながり
    connOpen:false,
    inRoom:false,       //部屋を作った・部屋に入ろうとしている
    remote:null,        //相方から最後に届いた状態
    lastRecv:0,
    active:false,       //協力プレイ中か
    mode:"coop",        //"coop"(協力プレイ)か "vs"(対戦。versus.js)。ゲストはホストから届いた値に合わせる
    role:null,          //"host" か "guest"
    code:null,
    waiting:false,      //ホストが相方を待っている
    partner:null,       //相方の状態
    look:new DroneLook(),
    snap:null,          //ゲスト：ホストから届いた最新の状態
    snapQ:-1,
    appliedQ:-1,
    framesSinceSnap:0,
    sendQ:0,
    step:0,
    //ゲスト→ホスト(合計値)
    dmg:{},             //{e12:[ダメージ×10, EMP回数, 水回数]}
    got:[],             //拾ったアイテムの番号(最近のもの)
    blast:[0,0,0],      //[衝撃波の回数, x, y]
    //拾ったパーツはふたりとも受け取る(拾った数の合計を送り合い、増えた分を足す)
    partsGot:0,         //自分が拾ったパーツの数(合計)
    partnerParts:0,     //相方が拾ったパーツのうち、自分にも足した数
    //コンティニュー(ふたりとも撃墜されたら、そのWAVEの強化画面からやり直す)
    checkpoint:null,    //強化画面で最後に覚えた進行状況(save.write が入れる)
    wantContinue:false, //自分がコンティニューを押した
    hostCn:false,       //ゲスト：ホストがコンティニューを押した
    //ホスト側で反映済みの値
    applied:{},
    gotDone:{},
    blastDone:0,
    blockDone:0,        //ホスト：ゲストのバリアが防いだ弾を、何個目まで消したか
    //出来事(衝撃波・ボス撃破・ジャスト衝撃波)
    events:[],
    evSeq:0,
    evSeen:0,
    localReady:false,
    msg:"",
    msgTime:0,
    grazeCd:0,
    struck:{},

    //------------------------------------------------------------ 準備・部屋
    init:function(){
        this.available = typeof Peer != "undefined" && typeof RTCPeerConnection != "undefined";
    },
    isHost:function(){ return this.active && this.role == "host"; },
    isGuest:function(){ return this.active && this.role == "guest"; },
    hpMul:function(){ return this.active ? COOP_HP_MUL : 1; },

    //招待リンク(このページのアドレスに #join=コード を付けたもの)
    inviteLink:function(){
        return location.href.split("#")[0] + "#join=" + this.code;
    },

    //部屋を作る：コードをPeerJSのIDにして、相方からつないでくるのを待つ
    //_mode："coop" か "vs"
    createRoom:function(_mode){
        if(!this.available || this.inRoom) return;
        this.mode = _mode || this.mode || "coop";
        var code = "";
        for(var i=0; i<4; i++) code += COOP_CODE_CHARS.charAt(Math.floor(Math.random()*COOP_CODE_CHARS.length));
        var self = this;
        this.inRoom = true;
        this.role = "host";
        this.code = code;
        this.msg = "部屋を作っています…";
        var peer = new Peer(COOP_ID_PREFIX + code, { debug:0 });
        this.peer = peer;
        peer.on("open",function(){
            if(self.peer != peer) return;
            self.waiting = true;
            self.msg = "";
        });
        peer.on("connection",function(c){
            //すでに相方がいる・もう始まっているときは断る(ふたりまで。途中からの参加はできない)
            if(self.conn || self.active || versus.active){ c.on("open",function(){ c.close(); }); return; }
            self.setupConn(c);
        });
        peer.on("error",function(e){
            if(self.peer != peer) return;
            //同じコードの部屋がもうあった：作り直す
            if(e.type == "unavailable-id"){ self.closePeer(); self.inRoom = false; self.createRoom(); return; }
            self.fail("部屋を作れませんでした（" + self.errorText(e) + "）");
        });
        peer.on("disconnected",function(){
            //仲介サーバーとの接続が切れた(相方とのつながりは続くことがある)。待っている間だけつなぎ直す
            if(self.peer == peer && self.waiting && !peer.destroyed) peer.reconnect();
        });
    },

    //部屋に入る：ホストのIDへつなぐ
    joinRoom:function(_code){
        if(!this.available || this.inRoom) return;
        var code = String(_code || "").toLowerCase().replace(/[^a-z0-9]/g,"");
        if(code.length != 4){ this.say("部屋コードは4文字です"); return; }
        var self = this;
        this.inRoom = true;
        this.role = "guest";
        this.code = code;
        this.msg = "部屋「" + code.toUpperCase() + "」につないでいます…";
        var peer = new Peer({ debug:0 });
        this.peer = peer;
        peer.on("open",function(){
            if(self.peer != peer) return;
            //状態は毎回まるごと送るので、途中が抜けても困らない「再送しない」つなぎ方にする(遅れがたまらない)
            self.setupConn(peer.connect(COOP_ID_PREFIX + code, { reliable:false, serialization:"json" }));
        });
        peer.on("error",function(e){
            if(self.peer != peer) return;
            if(e.type == "peer-unavailable") self.fail("部屋「" + code.toUpperCase() + "」が見つかりませんでした。コードを確かめてください");
            else self.fail("つなげませんでした（" + self.errorText(e) + "）");
        });
    },

    setupConn:function(_c){
        var self = this;
        this.conn = _c;
        var onOpen = function(){
            if(self.conn != _c || self.connOpen) return;
            self.connOpen = true;
            self.lastRecv = Date.now();
            if(self.role == "guest") self.msg = "ホストの応答を待っています…";
        };
        _c.on("open",onOpen);
        //つながった合図を取りこぼしても進めるよう、すでに開いている・データが届いたときも「つながった」とする
        if(_c.open) onOpen();
        _c.on("data",function(d){
            if(self.conn != _c || !d || typeof d != "object") return;
            onOpen();
            self.remote = d;
            self.lastRecv = Date.now();
        });
        _c.on("close",function(){
            if(self.conn != _c) return;
            self.conn = null;
            self.connOpen = false;
            self.partnerLeft();
        });
        _c.on("error",function(){});
    },

    errorText:function(_e){
        switch(_e && _e.type){
            case "network":
            case "server-error":
            case "socket-error":
            case "socket-closed": return "インターネットまたは仲介サーバーにつながりません";
            case "browser-incompatible": return "このブラウザは対応していません";
            case "webrtc": return "通信の確立に失敗しました";
        }
        return (_e && _e.type) || "不明なエラー";
    },

    //つなげなかった：部屋を閉じて、部屋選びの画面にメッセージを出す
    fail:function(_m){
        this.closePeer();
        this.inRoom = false;
        this.waiting = false;
        this.role = null;
        this.say(_m);
    },

    closePeer:function(){
        var c = this.conn, p = this.peer;
        this.conn = null;
        this.peer = null;
        this.connOpen = false;
        this.remote = null;
        if(c){ try{ c.close(); }catch(e){} }
        if(p){ try{ p.destroy(); }catch(e){} }
    },

    //ゲーム開始(ホストは相方がつないできたとき、ゲストはホストの状態が届いたとき)
    startGame:function(){
        if(this.mode == "vs"){
            //対戦：装備選びへ(versus.js)
            this.waiting = false;
            this.msg = "";
            versus.start(this.role == "host");
            return;
        }
        this.active = true;
        this.waiting = false;
        game.reset();
        enemySeq = 0;
        pickupSeq = 0;
        this.resetExchange();
        this.localReady = false;
        this.msg = "";
        storyScreen.start("prologue",function(){ page.change(2); });
    },

    resetExchange:function(){
        this.dmg = {}; this.got = []; this.blast = [0,0,0];
        this.partsGot = 0; this.partnerParts = 0;
        this.checkpoint = null; this.wantContinue = false; this.hostCn = false;
        this.applied = {}; this.gotDone = {}; this.blastDone = 0; this.blockDone = 0;
        arms.blockLog = [0];    //バリアで防いだ数(ゲスト→ホスト)
        this.events = []; this.evSeq = 0; this.evSeen = 0;
        this.snap = null; this.snapQ = -1; this.appliedQ = -1;
        this.partner = null;
        this.struck = {};
    },

    partnerLeft:function(){
        if(this.mode == "vs"){
            var fighting = versus.active;
            this.leave();
            if(fighting){
                startScreen.notice = "対戦相手との接続が切れたので、タイトルに戻りました";
                page.change(0);
            }else{
                this.say("相手との接続が切れました");
            }
            return;
        }
        if(this.role == "guest"){
            var playing = this.active;
            this.leave();
            if(playing){
                startScreen.notice = "ホストとの接続が切れたので、タイトルに戻りました";
                page.change(0);
            }else{
                this.say("ホストとの接続が切れました");
            }
        }else if(this.active){
            //最後に届いた状態を読み直して相方が残らないよう、届いたものも消す
            this.remote = null;
            this.partner = null;
            this.say("相方が退出しました。ひとりで続けます");
        }
    },

    leave:function(){
        this.closePeer();
        this.checkpoint = null; this.wantContinue = false; this.hostCn = false;
        this.partsGot = 0; this.partnerParts = 0;
        versus.active = false;
        this.inRoom = false;
        this.active = false;
        this.role = null;
        this.waiting = false;
        this.partner = null;
        this.localReady = false;
    },

    say:function(_m){ this.msg = _m; this.msgTime = 240; },

    //相方(敵の狙い用)
    partnerTarget:function(){
        if(!this.active || !this.partner || this.partner.down) return null;
        if(this.role == "host" && page.number == 1 && this.partner.page != 1) return null;
        return this.partner.pos;
    },

    //------------------------------------------------------------ 毎フレーム
    update:function(){
        if(this.msgTime > 0 && --this.msgTime == 0) this.msg = "";
        if(!this.inRoom) return;
        if(this.grazeCd > 0) this.grazeCd--;
        this.framesSinceSnap++;
        //しばらく何も届かなければ切断とみなす(相方がタブを閉じた・回線が切れた)。
        //始まる前は数えない(ホストが招待リンクを送るため別のアプリに切り替えている間は、ホストの画面が止まっているため)
        if((this.active || versus.active) && this.connOpen && Date.now() - this.lastRecv > COOP_TIMEOUT){
            this.closePeer();
            this.partnerLeft();
            return;
        }

        //ゲスト：つながったのにホストから何も届かないときは、入り直しを案内する
        if(this.role == "guest" && this.connOpen && !this.remote && Date.now() - this.lastRecv > COOP_NO_REPLY){
            this.msg = "ホストから応答がありません。いったん戻って、もう一度入り直してください";
        }

        //相方から最後に届いた状態
        var other = this.remote && this.remote.role == (this.role == "host" ? "guest" : "host") ? this.remote : null;

        //ゲストは、ホストから届いた遊び方(協力・対戦)に合わせる
        if(this.role == "guest" && other && other.m && !this.active && !versus.active) this.mode = other.m;
        if(this.mode == "vs"){
            if(!versus.active && other && (this.role == "guest" || (this.waiting && this.connOpen))) this.startGame();
            if(versus.active) versus.read(other && other.v);
            return;
        }

        if(this.role == "host"){
            if(this.waiting && this.connOpen && other){ this.startGame(); }
            if(other && other.g) this.readGuest(other.g);
            if(!this.active) return;
            //両方の準備ができたら出撃
            if(page.number == 2 && this.localReady && (!this.partner || this.partner.rd == game.wave)){
                this.localReady = false;
                page.change(1);
            }
            //コンティニュー：ふたりとも押したら(相方がいなければすぐ)やり直す。ゲストはこちらが強化画面へ戻ったのを見てついてくる
            if(page.number == 3 && this.wantContinue && (!this.partner || this.partner.cn)){
                this.continueGame();
                return;
            }
            //ふたりとも倒れたらゲームオーバー
            if(page.number == 1 && mainScreen.down && this.partner && this.partner.down && mainScreen.state != "over"){
                mainScreen.state = "over";
                mainScreen.stateTime = 0;
                sound.stopMusic();
            }
        }else{
            if(other && other.s) this.readHost(other.s);
        }
        this.readEvents(other);
    },

    //相方へ送る(2フレームに1回＝秒間30回)
    send:function(){
        if(!this.conn || !this.connOpen) return;
        if(++this.step % 2) return;
        try{
            if(this.mode == "vs") this.conn.send({ role:this.role, m:"vs", v:versus.build() });
            else if(this.role == "host") this.conn.send({ role:"host", m:"coop", s:this.buildHost() });
            else this.conn.send({ role:"guest", g:this.buildGuest() });
        }catch(e){}
    },

    phase:function(){
        switch(page.number){ case 1: return "b"; case 3: return "o"; case 5: return "e"; }
        return "u";
    },

    //------------------------------------------------------------ ホスト→ゲスト
    buildHost:function(){
        var s = { q:++this.sendQ, ph:this.phase(), w:game.wave, sc:game.score, ev:this.events, rd:this.localReady ? game.wave : 0, pc:this.partsGot, cn:this.wantContinue ? 1 : 0 };
        if(!this.active) return s;
        var M = mainScreen;
        var r = Math.round;
        s.h = [r(drone.X), r(drone.Y), drone.look.shown, M.hp, M.maxHp, M.down ? 1 : 0, page.number];
        if(page.number != 1) return s;
        s.st = COOP_STATES.indexOf(M.state);
        s.stt = M.stateTime;
        s.bw = M.bossWave ? 1 : 0;
        s.ts = M.toSpawn;
        //相方に近いものから順に送る(大きすぎるときは遠いものから削る)
        var gx = this.partner ? this.partner.pos.X : drone.X, gy = this.partner ? this.partner.pos.Y : drone.Y;
        var byDist = function(a,b){ return Math.hypot(a.x - gx, a.y - gy) - Math.hypot(b.x - gx, b.y - gy); };
        var ens = enemies.filter(function(e){ return !e.dead; }).sort(byDist);
        var shs = enemyShots.slice().sort(byDist);
        var pks = pickups.slice().sort(byDist);
        var arm = this.armsSummary();
        var caps = [90,220,45,1];   //敵・弾・アイテム・武器
        for(var tries=0; tries<30; tries++){
            s.e = []; s.b = null; s.bm = null; s.bk = null;
            for(var i=0; i<Math.min(caps[0],ens.length); i++) this.packEnemy(ens[i], s);
            s.s = [];
            for(var i=0; i<Math.min(caps[1],shs.length); i++){
                var b = shs[i];
                s.s.push(r(b.x), r(b.y), r(b.vx*10), r(b.vy*10), Math.max(0,COOP_SHOTS.indexOf(b.kind || "normal")));
            }
            s.p = [];
            for(var i=0; i<Math.min(caps[2],pks.length); i++){
                var p = pks[i];
                s.p.push(p.id, r(p.x), r(p.y), COOP_PICKS.indexOf(p.kind));
            }
            s.a = caps[3] ? arm : 0;
            if(JSON.stringify(s).length <= COOP_LIMIT) break;
            if(caps[3]){ caps[3] = 0; continue; }
            if(caps[1] > 30){ caps[1] -= 15; continue; }
            if(caps[2] > 8){ caps[2] -= 6; continue; }
            if(caps[0] > 15){ caps[0] -= 6; continue; }
            caps[1] = Math.max(0, caps[1] - 10);
        }
        return s;
    },

    packEnemy:function(_e,_s){
        var r = Math.round;
        var p1 = 0, p2 = 0;
        switch(_e.type){
            case "dasher":  p1 = r(Math.atan2(_e.aimY || 0,_e.aimX || 1)*100); p2 = (_e.tell || 0) + (_e.fake ? 8 : 0) + _e.timer*16; break;   //状態・フェイント・残り時間
            case "shooter": p1 = r((_e.face || 0)*100); p2 = r(_e.timer); break;
            case "spinner": p1 = r((_e.spin || 0)*100); p2 = _e.firing; break;
            case "bomber":  p2 = _e.fuse; break;
            case "kin":     p2 = _e.tintIdx || 0; break;
            case "heli":    p1 = r((_e.face || 0)*100); break;
            case "panzer":  p1 = r((_e.turret || 0)*100); break;
        }
        var flags = (_e.flash > 0 ? 1 : 0) | (_e.slow > 0 ? 2 : 0) | (_e.wet > 0 ? 4 : 0) | (_e.enraged ? 8 : 0)
                  | (_e.frozen > 0 ? 16 : 0) | (_e.burn > 0 ? 32 : 0) | (_e.countered ? 64 : 0);
        _s.e.push(_e.id, COOP_TYPES.indexOf(_e.type), r(_e.x), r(_e.y), r(Math.max(0,_e.hp)/_e.maxHp*100), p1, p2, flags);
        if(_e.boss){
            var aimA = Math.atan2(_e.aimY || 0,_e.aimX || 1);
            _s.b = [_e.id, COOP_MODES.indexOf(_e.mode), r((_e.angle || 0)*100), _e.count || 0, _e.phase || 0,
                    r((_e.bladeA || 0)*100), _e.circleT || 0, r(aimA*100)];
            if(_e.mines){ _s.bm = []; for(var i=0; i<_e.mines.length; i++) _s.bm.push(r(_e.mines[i].x), r(_e.mines[i].y), _e.mines[i].t); }
            if(_e.strikes){ _s.bk = []; for(var i=0; i<_e.strikes.length; i++) _s.bk.push(r(_e.strikes[i].x), r(_e.strikes[i].y), _e.strikes[i].t); }
        }
    },

    //自分の武器の見た目(相方の画面に描いてもらう)
    armsSummary:function(){
        var r = Math.round, a = {};
        var take = function(list,n,f){ var o = []; for(var i=0; i<Math.min(n,list.length); i++) f(list[i],o); return o; };
        a.b = take(arms.bullets,16,function(b,o){ o.push(r(b.x),r(b.y)); });
        a.m = take(arms.missiles,8,function(m,o){ o.push(r(m.x),r(m.y),r(m.ang*10)); });
        a.g = take(arms.bugs,6,function(b,o){ o.push(r(b.x),r(b.y)); });
        a.w = take(arms.drops,16,function(w,o){ o.push(r(w.x),r(w.y)); });
        a.n = take(arms.mines,9,function(m,o){ o.push(r(m.x),r(m.y)); });
        if(arms.has("blade") && !mainScreen.down){
            var B = arms.bladeInfo();
            a.bl = [B.n, B.R, B.size, arms.syn.lightblade ? 1 : 0, r(arms.bladeAngle*100)];
        }
        if(arms.beams.length){
            var L = arms.beams[arms.beams.length - 1];
            a.L = [r(L.x), r(L.y), r(L.dx*100), r(L.dy*100), L.life, L.focus ? 1 : 0, L.w];
        }
        arms.summary2(a);   //追加の装備(armsExtra.js)
        return a;
    },

    //------------------------------------------------------------ ゲスト→ホスト
    buildGuest:function(){
        var M = mainScreen, r = Math.round;
        var g = {
            x:r(drone.X), y:r(drone.Y), d:drone.look.shown, hp:M.hp, mh:M.maxHp, dn:M.down ? 1 : 0,
            pg:page.number, rd:this.localReady ? game.wave : 0,
            dm:this.dmg, got:this.got.slice(-30), bl:this.blast, ev:this.events, pc:this.partsGot, cn:this.wantContinue ? 1 : 0,
            br:arms.blockLog    //バリアで防いだ数と、最近防いだ位置(ホストで弾を消してもらう)
        };
        if(page.number == 1) g.a = this.armsSummary();
        if(JSON.stringify(g).length > COOP_LIMIT){ g.a = 0; }
        return g;
    },

    //ホスト：ゲストの状態を反映
    readGuest:function(_g){
        if(!this.partner) this.partner = { pos:{ X:_g.x, Y:_g.y }, look:new DroneLook() };
        var P = this.partner;
        P.tx = _g.x; P.ty = _g.y; P.dir = _g.d; P.hp = _g.hp; P.mh = _g.mh; P.down = !!_g.dn;
        P.page = _g.pg; P.rd = _g.rd; P.arms = _g.a || null;
        this.shareParts(_g.pc);
        P.cn = !!_g.cn;
        if(page.number != 1 || !this.active) return;
        //敵へのダメージ(合計値の増えた分だけ反映)
        var dm = _g.dm || {};
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i], k = "e" + e.id, v = dm[k];
            if(!v) continue;
            var done = this.applied[k] || [0,0,0,0,0];
            var d = (v[0] - done[0])/10;
            if(v[1] > done[1]) e.slow = 150;
            if(v[2] > done[2]) e.wet = WET_TIME;
            //相方が燃やした・凍らせた(armsExtra.js。相方のレベルはわからないので真ん中の長さ)
            if((v[3] || 0) > (done[3] || 0)) e.burn = Math.max(e.burn || 0, BURN_TIME[1]);
            if((v[4] || 0) > (done[4] || 0)) arms.freezeEnemy(e, FREEZE_PARTNER);
            this.applied[k] = [v[0], v[1], v[2], v[3] || 0, v[4] || 0];
            if(d > 0) mainScreen.hitEnemy(e, d, "partner");
        }
        //ゲストが拾ったアイテムを消す
        var got = _g.got || [];
        for(var i=0; i<got.length; i++){
            if(this.gotDone[got[i]]) continue;
            this.gotDone[got[i]] = true;
            for(var j=pickups.length-1; j>=0; j--) if(pickups[j].id == got[i]) pickups.splice(j,1);
        }
        //ゲストの衝撃波：まわりの敵の弾を消す
        var bl = _g.bl || [0,0,0];
        if(bl[0] > this.blastDone){
            this.blastDone = bl[0];
            for(var i=enemyShots.length-1; i>=0; i--){
                if(Math.hypot(enemyShots[i].x - bl[1], enemyShots[i].y - bl[2]) < BLAST_RADIUS) enemyShots.splice(i,1);
            }
        }
        //ゲストのバリアが防いだ弾：防いだ位置にいちばん近い弾を消す(新しく防いだ分だけ。最近の6つまで届く)
        var br = _g.br || [0];
        if(br[0] > this.blockDone){
            var n = Math.min(br[0] - this.blockDone, (br.length - 1)/2);
            this.blockDone = br[0];
            for(var k=br.length - n*2; k<br.length; k+=2){
                var best = -1, bd = 24;
                for(var i=0; i<enemyShots.length; i++){
                    var d = Math.hypot(enemyShots[i].x - br[k], enemyShots[i].y - br[k+1]);
                    if(d < bd){ bd = d; best = i; }
                }
                if(best >= 0) enemyShots.splice(best,1);
            }
        }
    },

    //ゲスト：ホストの状態を読んで、進行を合わせる
    readHost:function(_s){
        if(_s.q == this.snapQ) return;
        this.snapQ = _s.q;
        this.snap = _s;
        this.framesSinceSnap = 0;
        if(!this.active){
            //ホストの応答が来たらゲーム開始
            this.startGame();
            return;
        }
        if(_s.h){
            if(!this.partner) this.partner = { pos:{ X:_s.h[0], Y:_s.h[1] }, look:new DroneLook() };
            var P = this.partner;
            P.tx = _s.h[0]; P.ty = _s.h[1]; P.dir = _s.h[2]; P.hp = _s.h[3]; P.mh = _s.h[4]; P.down = !!_s.h[5]; P.page = _s.h[6];
            P.arms = _s.a || null;
        }
        game.score = _s.sc;
        this.shareParts(_s.pc);
        this.hostCn = !!_s.cn;
        //ホストがコンティニューして強化画面へ戻った：自分も押していれば一緒に戻る
        if(page.number == 3 && this.wantContinue && _s.ph == "u"){
            this.continueGame();
            return;
        }
        if(this.partner) this.partner.rd = _s.rd;
        //ホストが次のWAVEへ進んだ(WAVEクリア)
        if(_s.w > game.wave && page.number != 4){
            for(var w=game.wave; w<_s.w; w++){
                game.parts += Math.ceil(w/2);
                game.pendingReward = (game.pendingReward || 0) + 1;
            }
            game.wave = _s.w;
            this.localReady = false;
            if(game.wave > FINAL_WAVE) storyScreen.start("ending",function(){ page.change(5); });
            else goUpgrade();
            return;
        }
        if(_s.ph == "o" && page.number == 1){ page.change(3); return; }
        if(_s.ph == "b" && _s.w == game.wave && page.number == 2 && this.localReady){
            this.localReady = false;
            page.change(1);
        }
    },

    //------------------------------------------------------------ 出来事(衝撃波・ボス撃破・ジャスト衝撃波)
    addEvent:function(_type,_x,_y){
        this.events.push([++this.evSeq, _type, Math.round(_x), Math.round(_y)]);
        if(this.events.length > 6) this.events.shift();
    },
    readEvents:function(_other){
        if(!_other) return;
        var ev = (_other.s && _other.s.ev) || (_other.g && _other.g.ev) || [];
        for(var i=0; i<ev.length; i++){
            var e = ev[i];
            if(e[0] <= this.evSeen) continue;
            this.evSeen = e[0];
            if(e[1] == 1 && page.number == 1){
                //相方の衝撃波(見た目だけ)
                mainScreen.blastFx(e[2], e[3], true);
            }else if(e[1] == 2 && this.role == "guest"){
                //ボス撃破：ゲストにも報酬
                game.pendingReward = (game.pendingReward || 0) + 1;
                popup(e[2], e[3] - 60, "ボス撃破！ 報酬+1", "#c33");
            }else if(e[1] == 3 && page.number == 1){
                //相方のジャスト衝撃波：敵と弾を動かしているホストがゆっくりにする(ゲストの画面にもそのまま届く)
                if(this.role == "host") mainScreen.slowmo = Math.max(mainScreen.slowmo, JUST_COOP_SLOW);
                fx.ring(e[2], e[3], 90, JUST_COLOR, 22, 4);
                popup(e[2], Math.max(40, e[3] - 50), "JUST!", "rgb(" + JUST_COLOR + ")", true);
            }else if(e[1] == 4 && this.role == "host" && page.number == 1){
                //ゲストのジャスト・カウンター：その敵(突進・人間のドローン)をホストの画面で弾き返す(e[2] は敵の番号)
                for(var j=0; j<enemies.length; j++){
                    if(enemies[j].id == e[2] && COUNTER_TYPES.indexOf(enemies[j].type) >= 0) mainScreen.counter(enemies[j]);
                }
            }
        }
    },
    //衝撃波を出した(mainScreen.blast から)
    onBlast:function(_x,_y,_cast){
        if(!this.active) return;
        if(_cast) this.addEvent(1,_x,_y);
        if(this.role == "guest") this.blast = [this.blast[0] + 1, Math.round(_x), Math.round(_y)];
    },
    //ジャスト衝撃波を出した(mainScreen.justBlast から)。相方に知らせ、ホストが敵と弾をゆっくりにする
    onJust:function(_x,_y){
        if(!this.active) return;
        this.addEvent(3,_x,_y);
    },
    //ゲストがジャスト・カウンターで突進を弾き返した(mainScreen.counter から)。動かすのはホストなので知らせる
    onCounter:function(_e){
        if(this.isGuest()) this.addEvent(4,_e.id,0);
    },
    onBossKill:function(_e){
        if(this.isHost()) this.addEvent(2,_e.x,_e.y);
    },
    //ゲストがアイテムを拾った
    onCollect:function(_p){
        if(this.isGuest() && _p.id) this.got.push(_p.id);
        if(this.active && _p.kind == "part") this.partsGot++;
    },
    //コンティニュー：強化画面で覚えた状態に戻して、そのWAVEの強化画面からやり直す
    continueGame:function(){
        this.wantContinue = false;
        this.localReady = false;
        if(this.checkpoint) save.restore(this.checkpoint);
        goUpgrade();
    },
    //相方がコンティニューを押しているか(ゲームオーバー画面の表示用)
    partnerWantsContinue:function(){
        if(this.role == "host") return !!(this.partner && this.partner.cn);
        return this.hostCn;
    },

    //相方が拾ったパーツ(合計 _total)のうち、まだ足していない分を自分にも足す
    shareParts:function(_total){
        if(!this.active || !(_total > this.partnerParts)) return;
        var n = _total - this.partnerParts;
        this.partnerParts = _total;
        game.parts += n;
        if(page.number == 1 && this.partner) popup(this.partner.pos.X, this.partner.pos.Y - 24, "パーツ+" + n, "rgb(" + P2_COLOR + ")");
    },
    //ゲストの攻撃が当たった(ダメージはホストへ送る)
    guestHit:function(_e,_dmg,_src){
        if(_e.dead) return;
        var k = "e" + _e.id;
        var v = this.dmg[k] || (this.dmg[k] = [0,0,0,0,0]);
        v[0] += Math.round(_dmg*10);
        if(_src == "emp") v[1]++;
        if(_src == "water") v[2]++;
        if(_src == "fire") v[3]++;      //燃やした(armsExtra.js)
        if(_src == "freeze") v[4]++;    //凍らせた
        _e.flash = 6;
        sound.play("hit");
    },

    //------------------------------------------------------------ ゲストの戦闘画面
    //敵はホストから届いた状態を写したもの(動きは届くまでの間だけ先読み)
    guestStep:function(){
        var M = mainScreen, S = this.snap;
        M.paused = false;
        //ボスの着地の瞬間のヒットストップ(届いた状態だけは読んでおく)
        if(M.hitStop > 0){ M.hitStop--; this.guestSync(); return; }
        M.stateTime++;
        M.clock++;
        if(M.tint && --M.tint.life <= 0) M.tint = null;
        if(S && S.st != null && S.st >= 0){
            var st = COOP_STATES[S.st];
            if(st != M.state){
                if(st == "clear"){ sound.stopMusic(); sound.play("clear"); M.bonus = Math.ceil(game.wave/2); }
                if(st == "play" && M.state == "start" && S.bw) M.bossArrive();
                M.state = st;
                M.stateTime = S.stt;
            }
            M.toSpawn = S.ts;
            M.bossWave = !!S.bw;
        }
        if(M.state == "start" && M.bossWave) M.warningStep();
        //ボスの登場の演出中は、ボス(ホストから届く)と演出以外は止める
        if(M.cinematic()){
            if(M.bossFreeze) M.bossEntrance(true);
            this.guestSync();
            M.updateEffects();
            M.tickTimers();
            return;
        }
        if(!M.down && M.state != "over"){
            drone.update();
            M.updateFuel();
            if(Click == 1 && M.state == "play") M.blast();
        }
        this.guestSync();
        arms.update(M.state == "play" && !M.down);
        this.guestCollide();
        M.updateShots();
        M.updatePickups();
        M.updateEffects();
        if(M.invincible > 0) M.invincible--;
        if(M.guard > 0) M.guard--;
        if(M.noFuelMsg > 0) M.noFuelMsg--;
        if(M.rareMsgTime > 0) M.rareMsgTime--;
        M.tickTimers();
    },

    guestSync:function(){
        var S = this.snap;
        //届くまでの間は、速さで先に進めておく
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            e.x += e.vx; e.y += e.vy; e.t++;
            if(e.flash > 0) e.flash--;
            if(e.look) e.look.update(dirFromVel(e.vx,e.vy), e.vx);
        }
        if(!S || !S.e || this.appliedQ == S.q) return;
        var dt = Math.max(1, this.lastSyncGap || 2);
        this.lastSyncGap = 0;
        this.appliedQ = S.q;
        //敵
        var map = {};
        for(var i=0; i<enemies.length; i++) map[enemies[i].id] = enemies[i];
        var next = [], seen = {};
        for(var i=0; i<S.e.length; i+=8){
            var id = S.e[i], type = COOP_TYPES[S.e[i+1]];
            if(!type) continue;
            var e = map[id];
            var x = S.e[i+2], y = S.e[i+3];
            if(!e){
                var T = ENEMY_TYPES[type] || RARE_TYPES[type] || BOSS_TYPES[type] || { r:12 };
                e = { id:id, type:type, r:T.r, x:x, y:y, vx:0, vy:0, t:0, flash:0, dead:false, hp:100, maxHp:100,
                      slow:0, wet:0, bladeCd:0, timer:0, harmless:type == "kin",
                      boss:!!BOSS_TYPES[type], rare:!!RARE_TYPES[type], name:(RARE_TYPES[type] || BOSS_TYPES[type] || {}).name };
                if(type == "kin"){ e.look = new DroneLook(); }
                if(type == "kai"){ e.look = new DroneLook(); e.look.tint = "190,20,30"; e.mines = []; e.strikes = []; }
            }else{
                e.vx = (x - e.x)/dt*0.5 + e.vx*0.5;
                e.vy = (y - e.y)/dt*0.5 + e.vy*0.5;
            }
            e.x = x; e.y = y;
            e.hp = S.e[i+4];
            var p1 = S.e[i+5]/100, p2 = S.e[i+6], fl = S.e[i+7];
            if(fl & 1) e.flash = Math.max(e.flash,3);
            e.slow = (fl & 2) ? 2 : 0;
            e.wet = (fl & 4) ? 60 : 0;
            e.frozen = (fl & 16) ? 3 : 0;      //凍っている・燃えている(見た目だけ。数えるのはホスト)
            e.burn = (fl & 32) ? 3 : 0;
            e.enraged = !!(fl & 8);
            e.countered = (fl & 64) ? 3 : 0;   //弾き返した突進(ジャスト・カウンター。動かすのはホスト)
            switch(type){
                case "dasher":  e.aimX = Math.cos(p1); e.aimY = Math.sin(p1); e.tell = p2 & 7; e.fake = !!(p2 & 8); e.timer = p2 >> 4; break;
                case "shooter": e.face = p1; e.timer = p2; break;
                case "spinner": e.spin = p1; e.firing = p2; break;
                case "bomber":  e.fuse = p2; break;
                case "kin":     e.look.tint = KIN_COLORS[p2] || KIN_COLORS[0]; break;
                case "heli":    e.face = p1; break;
                case "panzer":  e.turret = p1; break;
            }
            next.push(e);
            seen[id] = true;
        }
        //ボスの細かい状態
        if(S.b){
            var b = null;
            for(var i=0; i<next.length; i++) if(next[i].id == S.b[0]) b = next[i];
            if(b){
                var nm = COOP_MODES[S.b[1]] || "idle";
                if(b.mode == "enter" && nm != "enter") special.bossLanded(b);   //降りきった瞬間の着地の演出
                b.mode = nm;
                b.angle = S.b[2]/100; b.count = S.b[3]; b.phase = S.b[4];
                b.bladeA = S.b[5]/100; b.circleT = S.b[6];
                b.aimX = Math.cos(S.b[7]/100); b.aimY = Math.sin(S.b[7]/100);
                if(b.type == "kai"){
                    b.mines = []; b.strikes = [];
                    var bm = S.bm || [], bk = S.bk || [];
                    for(var i=0; i<bm.length; i+=3) b.mines.push({ x:bm[i], y:bm[i+1], t:bm[i+2] });
                    for(var i=0; i<bk.length; i+=3) b.strikes.push({ x:bk[i], y:bk[i+1], t:bk[i+2] });
                }
            }
        }
        //いなくなった敵：近くなら撃破の演出(遠くのものは送る量を減らしただけかもしれない)
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(seen[e.id]) continue;
            e.dead = true;
            if(Math.hypot(e.x - drone.X, e.y - drone.Y) < 350){
                killBlast(e.x,e.y,e.r,e.type == "goldbug" ? "255,215,0" : null);
                sound.play("kill");
                delete this.dmg["e" + e.id];   //倒された敵のダメージの記録は送らなくてよい
            }
        }
        enemies = next;
        //敵の弾
        enemyShots = [];
        for(var i=0; i<S.s.length; i+=5){
            var kind = COOP_SHOTS[S.s[i+4]] || "normal";
            enemyShots.push({ x:S.s[i], y:S.s[i+1], vx:S.s[i+2]/10, vy:S.s[i+3]/10, r:SHOT_KINDS[kind].r, kind:kind,
                              grazed:false, color:"150,20,30" });
        }
        //アイテム(自分が拾ったものは出さない)
        var mine = {};
        for(var i=0; i<this.got.length; i++) mine[this.got[i]] = true;
        var old = {};
        for(var i=0; i<pickups.length; i++) old[pickups[i].id] = pickups[i];
        pickups = [];
        for(var i=0; i<S.p.length; i+=4){
            var id = S.p[i];
            if(mine[id]) continue;
            var p = old[id] || { id:id, vx:0, vy:0, t:0, life:PICKUP_LIFE };
            p.x = S.p[i+1]; p.y = S.p[i+2]; p.kind = COOP_PICKS[S.p[i+3]] || "part";
            pickups.push(p);
        }
    },

    //ゲスト：自分のドローン君が敵やボスの攻撃に当たったか
    guestCollide:function(){
        this.lastSyncGap = (this.lastSyncGap || 0) + 1;
        var M = mainScreen;
        if(M.down) return;
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead) continue;
            var d = Math.hypot(drone.X - e.x, drone.Y - e.y);
            if(d < e.r + drone.R && M.canBeHit() && !e.harmless && !e.countered){
                M.damage();
                M.hitEnemy(e,1);
            }
            if(!e.boss) continue;
            //レーザー
            if(e.mode == "laser"){
                var cx = Math.cos(e.angle), cy = Math.sin(e.angle), rx = drone.X - e.x, ry = drone.Y - e.y;
                if(rx*cx + ry*cy > 0 && Math.abs(rx*cy - ry*cx) < 11 + HIT_CORE && M.canBeHit()) M.damage();
            }
            if(e.type == "kai"){
                //ブレード
                var nB = e.phase >= 3 ? 4 : 3;
                for(var k=0; k<nB; k++){
                    var a = e.bladeA + k*Math.PI*2/nB;
                    if(Math.hypot(drone.X - (e.x + Math.cos(a)*64), drone.Y - (e.y + Math.sin(a)*64)) < 12 + HIT_CORE && M.canBeHit()) M.damage();
                }
                //落雷(予告が終わる瞬間に範囲内なら被弾)
                for(var k=0; k<e.strikes.length; k++){
                    var s = e.strikes[k], key = s.x + "_" + s.y;
                    if(s.t <= 3 && !this.struck[key]){
                        this.struck[key] = true;
                        if(Math.hypot(drone.X - s.x, drone.Y - s.y) < 34 && M.canBeHit()) M.damage();
                    }
                }
            }
        }
    },

    //------------------------------------------------------------ 描画
    drawPartner:function(){
        if(!this.active || !this.partner || this.partner.page != 1) return;
        var P = this.partner;
        if(P.tx == null) return;
        //届いた位置へなめらかに寄せる
        var ox = P.pos.X, oy = P.pos.Y;
        P.pos.X += (P.tx - P.pos.X)*0.35;
        P.pos.Y += (P.ty - P.pos.Y)*0.35;
        this.look.update(P.dir || 0, P.pos.X - ox);
        if(P.arms) this.drawArms(P.arms);
        if(P.down){
            ctx.globalAlpha = 0.35;
            this.look.draw(P.pos.X,P.pos.Y);
            ctx.globalAlpha = 1;
        }else{
            this.look.draw(P.pos.X,P.pos.Y);
        }
        //P1/P2の名札
        var label = this.role == "host" ? "P2" : "P1";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgb(" + P2_COLOR + ")";
        ctx.fillText(label + (P.down ? " ダウン" : ""), P.pos.X, P.pos.Y - 32);
        ctx.fillStyle = "#000";
    },

    //相方の武器(簡易表示)。_ox,_oy：ブレードの中心(省略時は相方の位置。対戦の相手にも使う)
    drawArms:function(_a,_ox,_oy){
        var P = this.partner;
        var ox = _ox != null ? _ox : (P ? P.pos.X : 0), oy = _oy != null ? _oy : (P ? P.pos.Y : 0);
        ctx.fillStyle = "#333";
        for(var i=0; _a.b && i<_a.b.length; i+=2) ctx.fillRect(_a.b[i] - 2,_a.b[i+1] - 2,4,4);
        for(var i=0; _a.m && i<_a.m.length; i+=3){
            ctx.save(); ctx.translate(_a.m[i],_a.m[i+1]); ctx.rotate(_a.m[i+2]/10);
            ctx.fillStyle = "#d62"; ctx.fillRect(-7,-2.5,11,5); ctx.restore();
        }
        ctx.fillStyle = "#2a6";
        for(var i=0; _a.g && i<_a.g.length; i+=2){ ctx.beginPath(); ctx.arc(_a.g[i],_a.g[i+1],5,0,Math.PI*2); ctx.fill(); }
        ctx.fillStyle = "#29a3d6";
        for(var i=0; _a.w && i<_a.w.length; i+=2){ ctx.beginPath(); ctx.arc(_a.w[i],_a.w[i+1],3,0,Math.PI*2); ctx.fill(); }
        ctx.fillStyle = "#875";
        for(var i=0; _a.n && i<_a.n.length; i+=2){ ctx.beginPath(); ctx.arc(_a.n[i],_a.n[i+1],7,0,Math.PI*2); ctx.fill(); }
        if(_a.bl && (_ox != null || P)){
            var n = _a.bl[0], R = _a.bl[1], sz = _a.bl[2], ang = _a.bl[4]/100;
            ctx.fillStyle = _a.bl[3] ? "rgb(" + SYN_COLOR.lightblade + ")" : "#555";
            for(var k=0; k<n; k++){
                var a = ang + k*Math.PI*2/n;
                ctx.save();
                ctx.translate(ox + Math.cos(a)*R, oy + Math.sin(a)*R);
                ctx.rotate(a*4);
                ctx.beginPath(); ctx.moveTo(sz,0); ctx.lineTo(0,sz*0.35); ctx.lineTo(-sz,0); ctx.lineTo(0,-sz*0.35); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
        }
        if(_a.L){
            var L = _a.L, k = L[4]/14;
            ctx.strokeStyle = L[5] ? "rgba(" + SYN_COLOR.focus + "," + k + ")" : "rgba(230,40,40," + k + ")";
            ctx.lineWidth = L[6]*2*k + 1;
            ctx.beginPath(); ctx.moveTo(L[0],L[1]); ctx.lineTo(L[0] + L[2]*12, L[1] + L[3]*12); ctx.stroke();
            ctx.lineWidth = 1;
        }
        arms.drawSummary2(_a, (_ox != null || P) ? ox : null, oy);  //追加の装備(armsExtra.js)
        ctx.fillStyle = "#000";
    },

    //上部の協力プレイ表示(相方の耐久)
    drawHud:function(){
        if(!this.active) return;
        var P = this.partner;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "rgb(" + P2_COLOR + ")";
        var label = this.role == "host" ? "P2" : "P1";
        if(P && P.mh){
            ctx.fillText(label + " 耐久",14,104);
            for(var i=0; i<P.mh; i++){
                if(i < P.hp){ ctx.fillRect(66 + i*14,98,11,11); }
                else{ ctx.strokeStyle = "rgba(" + P2_COLOR + ",0.5)"; ctx.strokeRect(66.5 + i*14,98.5,10,10); }
            }
        }else{
            ctx.fillText(label + "：接続待ち",14,104);
        }
        if(this.msg){
            ctx.textAlign = "center";
            ctx.fillText(this.msg,CW/2,CH - 60);
        }
        ctx.fillStyle = "#000";
    }
};

//------------------------------------------------------------------------------
//  協力プレイの部屋選び(page 6)
//------------------------------------------------------------------------------
var coopCreateButton = new drawRect(CW/2 , GS*5.6 , GS*12 , GS*2.2);
var coopJoinButton   = new drawRect(CW/2 , GS*8.6 , GS*12 , GS*2.2);
var coopCopyButton   = new drawRect(CW/2 - GS*4.2 , GS*11.6 , GS*7.6 , GS*1.5);
var coopShareButton  = new drawRect(CW/2 + GS*4.2 , GS*11.6 , GS*7.6 , GS*1.5);
var coopBackButton   = new drawRect(CW/2 , GS*15.3 , GS*8 , GS*1.6);

var coopScreen = {
    enter:function(){
        coop.init();
        if(!coop.inRoom) coop.msg = "";
    },
    update:function(){
        if(coopBackButton.clicked()){
            sound.play("click");
            coop.leave();
            page.change(0);
            return;
        }
        if(!coop.available) return;
        if(!coop.inRoom){
            if(coopCreateButton.clicked()){
                sound.play("click");
                coop.createRoom();
                return;
            }
            if(coopJoinButton.clicked()){
                sound.play("click");
                //コードの入力はブラウザの入力欄で(スマホでもキーボードが出る)
                var code = window.prompt("ホストの画面に出ている部屋コード（4文字）を入力してください", "");
                Click = 0;
                if(code) coop.joinRoom(code);
                return;
            }
        }else if(coop.role == "host" && coop.waiting){
            if(coopCopyButton.clicked()){
                sound.play("click");
                this.copyInvite();
                return;
            }
            if(navigator.share && coopShareButton.clicked()){
                sound.play("click");
                navigator.share({ title:"ドローン君 " + coopScreen.title(), text:"部屋コード " + coop.code.toUpperCase(), url:coop.inviteLink() }).catch(function(){});
                return;
            }
        }
    },

    //画面の題名(協力プレイか対戦か)
    title:function(){
        if(coop.mode == "vs") return "ふたりで対戦";
        if(coop.mode == "coop") return "ふたりで協力プレイ";
        return "ふたりで遊ぶ";   //招待リンクで開いて、まだ遊び方が届いていない
    },

    //招待リンクをコピー。できないブラウザでは、選んでコピーできる入力欄に出す
    copyInvite:function(){
        var link = coop.inviteLink();
        var fallback = function(){ window.prompt("このリンクをコピーして相方に送ってください", link); };
        if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(link).then(function(){ coop.say("招待リンクをコピーしました"); }, fallback);
        }else{
            fallback();
        }
    },

    draw:function(){
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";
        ctx.font = "bold 40px serif";
        ctx.fillText(this.title(),CW/2,GS*2.2);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText(coop.mode == "vs"
            ? "ドローン君同士の1対1。装備を3つ選んで戦います（インターネット接続が必要）"
            : coop.mode == null ? "招待された部屋につないでいます"
            : "ストーリーモードをふたりで。敵の体力は2倍、強化・装備はそれぞれ別です（インターネット接続が必要）",CW/2,GS*3.8);

        if(!coop.available){
            ctx.fillStyle = "#c33";
            ctx.font = "bold 15px sans-serif";
            ctx.fillText("この画面では協力プレイを使えません。",CW/2,GS*7.5);
            ctx.font = "14px sans-serif";
            ctx.fillStyle = "#555";
            ctx.fillText("ブラウザ同士を直接つなぐ機能（WebRTC）が使えない環境です。",CW/2,GS*8.6);
            ctx.fillText("Chrome・Edge・Safari・Firefox などの最新のブラウザで開いてください。",CW/2,GS*9.5);
        }else if(coop.inRoom && coop.role == "host"){
            if(coop.waiting){
                ctx.font = "15px sans-serif";
                ctx.fillStyle = "#555";
                ctx.fillText((coop.mode == "vs" ? "相手" : "相方") + "に部屋コードか招待リンクを送ってください。つながると始まります",CW/2,GS*5.4);
                //部屋コードを大きく
                ctx.font = "bold 64px monospace";
                ctx.fillStyle = "#000";
                ctx.fillText(coop.code.toUpperCase().split("").join(" "),CW/2,GS*7.8);
                ctx.font = "12px sans-serif";
                ctx.fillStyle = "#777";
                //長いアドレスは画面に収まるよう先頭を省く(コードの入った末尾を残す)
                var link = coop.inviteLink();
                while(link.length > 10 && ctx.measureText(link).width > CW - GS*2) link = "…" + link.slice(2);
                ctx.fillText(link,CW/2,GS*9.9);
                ctx.font = "bold 15px sans-serif";
                coopCopyButton.button("招待リンクをコピー");
                if(navigator.share) coopShareButton.button("リンクを送る（共有）");
                else coopShareButton.button("リンクを送る（共有）",false);
            }else{
                ctx.font = "bold 20px sans-serif";
                ctx.fillStyle = "#000";
                ctx.fillText(coop.msg || "部屋を作っています…",CW/2,GS*7.5);
            }
        }else if(coop.inRoom){
            ctx.font = "bold 20px sans-serif";
            ctx.fillStyle = "#000";
            ctx.fillText(coop.msg || "つないでいます…",CW/2,GS*7.5);
        }else{
            ctx.font = "bold 22px serif";
            coopCreateButton.button("部屋を作る（ホスト）");
            coopJoinButton.button("部屋に入る（コードを入力）");
            ctx.font = "13px sans-serif";
            ctx.fillStyle = "#777";
            ctx.fillText("招待リンクを開いた場合は、自動で部屋に入ります",CW/2,GS*11.6);
        }
        //エラーなどのお知らせ
        if(coop.msg && !(coop.inRoom && !coop.waiting)){
            ctx.fillStyle = "#c33";
            ctx.font = "bold 14px sans-serif";
            ctx.fillText(coop.msg,CW/2,GS*14.1);
        }
        ctx.font = "14px sans-serif";
        coopBackButton.button(coop.inRoom ? "やめてタイトルへ" : "タイトルへ");
        ctx.fillStyle = "#000";
    }
};

//招待リンク(…#join=コード)で開かれたら、少し待ってから自動で部屋に入る
(function(){
    var m = location.hash.match(/join=([a-z0-9]{4})/i);
    if(!m) return;
    var code = m[1].toLowerCase();
    //リンクを開き直したときに二重に入らないよう、アドレスから外しておく
    try{ history.replaceState(null, "", location.href.split("#")[0]); }catch(e){}
    setTimeout(function(){
        coop.init();
        if(!coop.available) return;
        coop.mode = null;   //協力プレイか対戦かは、ホストから届いてから決まる
        page.change(6);
        coop.joinRoom(code);
    }, 300);
})();
