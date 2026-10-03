//戦闘中とタイトル画面のタッチはドラッグ操作になる
function isTouchDrag(){
    //戦闘中・対戦の戦闘中・タイトル画面(設定の窓やデバッグのメニューを開いていないとき)はドラッグで動かす
    return inputMode == "touch" && (page.number == 1 || (page.number == 7 && versus.dragging())
        || (page.number == 0 && !startScreen.settings && !bossDebug.menu));
}
//タイトル画面のタップ：ドローン君の目標を覚えておき、ボタンを押し終わったら戻す(目標がボタンへ飛ばないように)
function tapAt(_p){
    if(page.number == 0 && inputMode == "touch" && !tapKeep) tapKeep = { x:MouseX, y:MouseY };
    MouseX = _p.x;
    MouseY = _p.y;
    Click = 1;
}
//押し終わったら目標を戻す(draw.js の更新のあと)
function endTap(){
    if(!tapKeep) return;
    MouseX = tapKeep.x;
    MouseY = tapKeep.y;
    tapKeep = null;
}var canvas = document.getElementById("Canvas");
var parent = document.getElementById("Bigbox");
var ctx = canvas.getContext("2d");
const CW = 960; //Canvas-Width
const CH = 540; //Canvas-Height
canvas.width = CW;
canvas.height = CH;
ctx.imageSmoothingEnabled = false;  //ドット絵をくっきり
//16:9画面を32:18分割してグリッド単位で管理
const GS = CW/32;  //=30px Grid-Size

//------------------------------------------------------------------------------
//  画面の細かさ(大きなモニター・高解像度の画面・全画面でもぼやけないように)
//  ゲームの座標はいつも CW×CH のまま。キャンバスの実際の大きさだけを「表示される大きさ×画素の密度」に合わせ、
//  描くときに全体を拡大する(ctx.setTransform)。キャンバスの中身を写し取るときは、元の位置に renderScale を掛ける。
//  細かさには上限があり(RENDER_MAX)、フレームレートがしばらく低いと1段ずつ下げる(draw.js の fps)
//------------------------------------------------------------------------------
const RENDER_MAX = 4;       //細かさの上限(ゲームの大きさの何倍で描くか。4で4Kの全画面)
const RENDER_FPS_LOW = 45;  //フレームレートがこれを下回る秒が
const RENDER_DROP_SEC = 3;  //この秒数続くと、細かさを1段下げる
var renderScale = 1;        //今の細かさ
var renderCap = RENDER_MAX; //今の上限(フレームレートが低いと下がる。ページを開き直すと戻る)
function fitCanvas(){
    var rect = canvas.getBoundingClientRect();
    var want = rect.width > 0 ? rect.width*(window.devicePixelRatio || 1)/CW : 1;
    var s = Math.max(1, Math.min(renderCap, Math.round(want*4)/4));    //細かく変えすぎない(1/4刻み)
    if(s == renderScale && canvas.width == Math.round(CW*s)) return;
    renderScale = s;
    canvas.width = Math.round(CW*s);    //大きさを変えると、描いた中身と ctx の設定が消えるので設定し直す
    canvas.height = Math.round(CH*s);
    ctx.setTransform(canvas.width/CW,0,0,canvas.height/CH,0,0);
    ctx.imageSmoothingEnabled = false;
    //CSS で大きさを決めていないページ(テスト用など)では、キャンバスの大きさがそのまま表示の大きさになって
    //広がり続けるので、表示の大きさを変える前のまま固定する
    if(rect.width > 0 && Math.abs(canvas.getBoundingClientRect().width - rect.width) > 1){
        canvas.style.width = rect.width + "px";
        canvas.style.height = rect.width*CH/CW + "px";
    }
}
//細かさの上限を1段下げる(フレームレートが低いとき。draw.js から)
function lowerRender(){
    if(renderScale <= 1) return false;
    renderCap = Math.max(1, Math.ceil(renderScale) - 1);
    fitCanvas();
    return true;
}
window.addEventListener("resize", fitCanvas);
document.addEventListener("fullscreenchange", fitCanvas);
fitCanvas();

const DEBUG = false;  //trueでマウス座標などを左上に表示

//------------------------------------------------------------------------------
//  ページ管理
//  0:スタート画面  1:メイン画面(戦闘)  2:強化画面  3:ゲームオーバー画面
//------------------------------------------------------------------------------
var page = {
    number:0,
    change:function(i){
        this.number = i;
        if(screens[i].enter) screens[i].enter();
        sound.onPage(i);
    }
};

//------------------------------------------------------------------------------
//  汎用的に利用する時間 約60回/s
//------------------------------------------------------------------------------
const MAXTIME = 600;
var time = 0;

//------------------------------------------------------------------------------
//  マウス・タッチ操作
//  マウス：ポインタの位置にドローン君が向かう。クリックで衝撃波・ボタン
//  タッチ：戦闘中とタイトル画面は、画面のどこをドラッグしても、指の動いた分だけ目標が動く
//          (指でドローン君が隠れないように)。衝撃波は右下のボタン。それ以外の画面はタップ
//          タイトル画面では、ボタンの上を触ったときだけタップとして押す(目標はボタンへ飛ばさない)
//------------------------------------------------------------------------------
var MouseX=CW/2;      //ドローン君が向かう目標の座標
var MouseY=CH/2;
var MouseIn=false;              //操作中か(マウスがキャンバスの外に出たら一時停止)
var Click=0;                    //このフレームでクリック・タップされたか
var inputMode="mouse";          //最後に使った操作方法："mouse"か"touch"
const TOUCH_SPEED = 1.3;        //ドラッグの距離に対する目標の移動量の倍率
var drag = { id:null, x:0, y:0 };
var tapKeep = null;     //タップでボタンを押す間だけ目標をタップの位置に移し、押し終わったら戻す(タイトル画面)

//ページのスクロールや拡大縮小があってもキャンバス上の座標になるよう換算
function toCanvasPos(e){
    var rect = canvas.getBoundingClientRect();
    return {
        x:(e.clientX - rect.left) * CW / rect.width,
        y:(e.clientY - rect.top) * CH / rect.height
    };
}
//戦闘中とタイトル画面のタッチはドラッグ操作になる
function isTouchDrag(){
    //戦闘中・対戦の戦闘中・タイトル画面(設定の窓やデバッグのメニューを開いていないとき)はドラッグで動かす
    return inputMode == "touch" && (page.number == 1 || (page.number == 7 && versus.dragging())
        || (page.number == 0 && !startScreen.settings && !bossDebug.menu));
}
//タップ：その位置を押す。タイトル画面では、ドローン君の目標を覚えておき、押し終わったら戻す(目標がボタンへ飛ばないように)
function tapAt(_p){
    if(page.number == 0 && inputMode == "touch" && !tapKeep) tapKeep = { x:MouseX, y:MouseY };
    MouseX = _p.x;
    MouseY = _p.y;
    Click = 1;
}
//押し終わったら目標を戻す(draw.js で、クリックを処理した更新のあと)
function endTap(){
    if(!tapKeep) return;
    MouseX = tapKeep.x;
    MouseY = tapKeep.y;
    tapKeep = null;
}

canvas.addEventListener("pointerdown",function(e){
    var p = toCanvasPos(e);
    inputMode = e.pointerType == "mouse" ? "mouse" : "touch";
    MouseIn = true;
    if(inputMode == "touch"){
        e.preventDefault();
        try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    }
    if(isTouchDrag()){
        //BGM/SEボタンと衝撃波ボタンはその場で処理。タイトル画面のボタンはタップとして押す。それ以外はドラッグ開始
        if(sound.tapButton(p.x,p.y)) return;
        if(page.number != 0 && mainScreen.touchBlastHit(p.x,p.y)){ Click = 1; return; }   //戦闘中・対戦の戦闘中
        if(page.number == 0 && startScreen.touchUI(p.x,p.y)){ tapAt(p); return; }
        drag.id = e.pointerId;
        drag.x = p.x; drag.y = p.y;
        return;
    }
    tapAt(p);
},false);

canvas.addEventListener("pointermove",function(e){
    var p = toCanvasPos(e);
    if(e.pointerType == "mouse"){
        inputMode = "mouse";
        MouseX = p.x;
        MouseY = p.y;
        MouseIn = true;
        return;
    }
    if(isTouchDrag()){
        if(e.pointerId != drag.id) return;
        MouseX = Math.max(0, Math.min(CW, MouseX + (p.x - drag.x)*TOUCH_SPEED));
        MouseY = Math.max(0, Math.min(CH, MouseY + (p.y - drag.y)*TOUCH_SPEED));
        drag.x = p.x; drag.y = p.y;
    }else{
        MouseX = p.x;
        MouseY = p.y;
    }
    MouseIn = true;
},false);

function endDrag(e){
    if(e.pointerId == drag.id) drag.id = null;
}
canvas.addEventListener("pointerup",endDrag,false);
canvas.addEventListener("pointercancel",endDrag,false);
//指を離しても一時停止はしない。マウスが外に出たときだけ一時停止
canvas.addEventListener("pointerleave",function(e){ if(e.pointerType == "mouse") MouseIn = false; },false);
window.addEventListener("blur",function(){ MouseIn = false; },false);
//長押しメニューが出ないように
canvas.addEventListener("contextmenu",function(e){ if(inputMode == "touch") e.preventDefault(); },false);

//------------------------------------------------------------------------------
//  テスト用オブジェクト（マウスポジションの表示など）
//------------------------------------------------------------------------------
var test = {
    //マウスポインタの座標を左上に表示
    mousePositionDisplay:function(){
        ctx.textAlign = "left";
        ctx.fillStyle = "#000";
        ctx.font = "bold 20px serif";
        ctx.fillText(Math.floor(MouseX),50,50);
        ctx.fillText(Math.floor(MouseY),50,80);
        ctx.fillText(Math.floor(drone.X),50,110);
        ctx.fillText(Math.floor(drone.Y),50,140);
        ctx.fillText(drone.Speed.toFixed(2),50,170);
    }
};

//------------------------------------------------------------------------------
//  矩形
//------------------------------------------------------------------------------
//基準位置は上辺中央
var drawRect = function(_x,_y,_width,_height){
    this.width = _width;
    this.height = _height;
    this.X = _x - _width/2;
    this.Y = _y;
};

drawRect.prototype = {
    //塗りつぶして描画
    fill: function(_color){
        ctx.fillStyle = _color;
        ctx.fillRect( this.X , this.Y , this.width , this.height );
        ctx.fillStyle = "#000"
    },
    //枠のみ描画
    stroke: function(){
        ctx.strokeStyle = "black";
        ctx.strokeRect( this.X , this.Y , this.width , this.height );
    },
    //中心揃えで文字を配置
    text: function(_message){
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText( _message , this.X + this.width/2 , this.Y + this.height/2 );
    },
    //中心に画像を配置
    image: function(_image){
        ctx.drawImage(_image,this.X + this.width/2 - _image.naturalWidth/2 ,this.Y + this.height/2 - _image.naturalHeight/2)
    },
    //座標が矩形の中にあるか
    contains: function(_x,_y){
        return _x > this.X && _x < this.X + this.width && _y > this.Y && _y < this.Y + this.height;
    },
    //ボタンとして描画(ホバーで色が変わる。押せないときは灰色)
    button: function(_message,_enabled){
        if(_enabled === false){
            ctx.strokeStyle = "#bbb";
            ctx.strokeRect( this.X , this.Y , this.width , this.height );
            ctx.fillStyle = "#bbb";
        }else{
            if(this.contains(MouseX,MouseY)) this.fill("#eee");
            this.stroke();
            ctx.fillStyle = "#000";
        }
        this.text(_message);
        ctx.fillStyle = "#000";
    },
    //このフレームでクリックされたか
    clicked: function(){
        return Click == 1 && this.contains(MouseX,MouseY);
    }
}

//角の丸い四角の形を作る(このあと ctx.fill() や ctx.stroke() で描く)
function roundRectPath(_x,_y,_w,_h,_r){
    var r = Math.min(_r, _w/2, _h/2);
    ctx.beginPath();
    ctx.moveTo(_x + r,_y);
    ctx.arcTo(_x + _w,_y,_x + _w,_y + _h,r);
    ctx.arcTo(_x + _w,_y + _h,_x,_y + _h,r);
    ctx.arcTo(_x,_y + _h,_x,_y,r);
    ctx.arcTo(_x,_y,_x + _w,_y,r);
    ctx.closePath();
}

//------------------------------------------------------------------------------
//  ドローンの能力(メモ.txtの5項目)。レベル1～5
//------------------------------------------------------------------------------
//強化しても伸びは控えめ(ドローン君は非力。装備とシナジーで補う)
const STATS = [
    { key:"speed",    name:"追従速度", desc:"マウスに追いつく速さ",       values:[30,25,21,17,14] },    //追従の遅れ(小さいほど速い)
    { key:"accuracy", name:"追従精度", desc:"ふらつきの小ささ",           values:[40,32,25,18,12] },    //ふらつきの幅(px)
    { key:"armor",    name:"頑丈さ",   desc:"耐えられる被弾数",           values:[2,3,3,4,5] },         //最大耐久
    { key:"brain",    name:"賢さ",     desc:"全装備の攻撃頻度と射程",     values:[70,62,55,48,42] },    //攻撃間隔の目安(equipment.jsのarms.rate)
    { key:"fuel",     name:"燃料",     desc:"燃料タンクの大きさ",         values:[80,95,110,130,150] }
];
const MAX_LEVEL = 5;
const UPGRADE_COST = [0,5,10,16,24];  //レベルL→L+1に必要なパーツ数 = UPGRADE_COST[L]

//------------------------------------------------------------------------------
//  ゲームの進行状況
//------------------------------------------------------------------------------
const FINAL_WAVE  = 20;     //全20WAVE。20WAVEのボスを倒すとエンディング
const REVEAL_WAVE = 15;     //このWAVEのボスを倒すと真実に気付く。次のWAVEから人間との戦い

var game = {
    wave:1,
    parts:0,
    score:0,
    level:{},
    owned:{},               //持っている装備とそのレベル {gun:1, ...}
    slots:[],               //装備枠。空きはnull
    slotCount:1,            //解放済みの装備枠の数
    pendingReward:0,        //まだ選んでいない報酬の回数
    seen:{},                //見終わったストーリー {prologue:true, ...}
    reset:function(){
        this.seen = {};
        this.wave = 1;
        this.parts = 0;
        this.score = 0;
        for(var i=0; i<STATS.length; i++) this.level[STATS[i].key] = 1;
        this.owned = { gun:1 };
        this.slots = ["gun",null,null];
        this.slotCount = 1;
        this.pendingReward = 0;
    },
    //能力の現在値
    stat:function(_key){
        for(var i=0; i<STATS.length; i++){
            if(STATS[i].key == _key) return STATS[i].values[this.level[_key]-1];
        }
    },
    //自動攻撃の射程
    range:function(){
        return 170 + this.level.brain * 30;
    }
};
game.reset();

//------------------------------------------------------------------------------
//  セーブ(ブラウザのlocalStorageに保存。使えない環境では何もしない)
//------------------------------------------------------------------------------
var save = {
    KEY:"dronekun_save",
    BEST_KEY:"dronekun_best",
    //今の進行状況を文字列にする(セーブと、協力プレイのコンティニューに使う)
    data:function(){
        return JSON.stringify({
            wave:game.wave, parts:game.parts, score:game.score, level:game.level,
            owned:game.owned, slots:game.slots, slotCount:game.slotCount, pendingReward:game.pendingReward,
            seen:game.seen
        });
    },
    write:function(){
        //協力プレイはその場かぎり(ひとり用のセーブは上書きしない)。コンティニュー用にメモリにだけ覚えておく
        if(typeof coop != "undefined" && coop.active){
            coop.checkpoint = this.data();
            return;
        }
        try{
            localStorage.setItem(this.KEY, this.data());
        }catch(e){}
    },
    exists:function(){
        try{ return localStorage.getItem(this.KEY) != null; }catch(e){ return false; }
    },
    //読み込めたらtrue
    load:function(){
        try{
            return this.restore(localStorage.getItem(this.KEY));
        }catch(e){ return false; }
    },
    //data() で作った文字列から進行状況を戻す。戻せたらtrue
    restore:function(_s){
        try{
            var d = JSON.parse(_s);
            if(!d) return false;
            game.reset();
            game.wave = d.wave;
            game.parts = d.parts;
            game.score = d.score;
            for(var k in game.level){
                if(d.level && d.level[k]) game.level[k] = d.level[k];
            }
            //装備(古いセーブデータには無いので、そのときは初期装備のまま)
            if(d.owned) game.owned = d.owned;
            if(d.slots) game.slots = d.slots;
            if(d.slotCount) game.slotCount = d.slotCount;
            //古いセーブデータではtrue/falseなので回数に直す
            game.pendingReward = Number(d.pendingReward) || 0;
            game.seen = d.seen || {};
            return true;
        }catch(e){ return false; }
    },
    clear:function(){
        try{ localStorage.removeItem(this.KEY); }catch(e){}
    },
    getBest:function(){
        try{ return Number(localStorage.getItem(this.BEST_KEY)) || 0; }catch(e){ return 0; }
    },
    setBest:function(_score){
        try{ localStorage.setItem(this.BEST_KEY, _score); }catch(e){}
    }
};

//------------------------------------------------------------------------------
//  ドローン君の絵
//  向きごとの絵を1枚に並べたもの(シート)を使う。横に水平の向き16段(22.5度ずつ。0が正面、
//  増えると左を向く)、縦に高さ5段(見上げる → 見下ろす)。ゲームでは DRONE_SIZE px で描く
//  見た目(スキン)はタイトルの設定で選べる(droneSkin)
//  ・標準(E)：元の絵の2次元のテイストのまま、図形で描く(drawFlatDrone)。画像ファイルはない
//  ・クラシック(O)：元の6方向のドット絵(images/game/Drone/Drone_*.png)をシートに並べ直したもの
//  ・開発用：index.html#art=A のように選ぶと、tools/drone-art.html の3Dの絵を tools/bake-drone.ps1 で
//    書き出した images/game/Drone/drone_A.png を使う(案A～Dは feature/drone-art-3d-candidates ブランチに保管)
//------------------------------------------------------------------------------
const DRONE_FRAME = 160;    //書き出した画像のシートの1コマの大きさ(px。等倍の4倍)
const DRONE_SIZE = 40;      //ゲームでの等倍の大きさ(px)
//段の数はシートごとに持つ(sheets.yaws・sheets.elevs)。高さは、まんなかの段がふだんの高さ
const DRONE_YAWS = 16;      //画像の見た目(クラシック・書き出した3Dの絵)の水平の向きの段数
const DRONE_ELEVS = 5;      //同じく高さの段数
const FLAT_YAWS = 24;       //標準(図形で描く)の水平の向きの段数(15度ずつ)
const FLAT_ELEVS = 7;       //同じく高さの段数
const DRONE_ART_DEFAULT = "E";

//案Eの色(元の絵に合わせた灰色と黒)
var FLAT_COLOR = {
    body:"#2f3032",     //胴体の正面(影絵のように暗く)
    rim:"#6b6d70",      //正面の上のふち(ハイライトの線)
    shine:"#8a8c90",    //左上の角の光(ハイライト)
    top:"#47494c",      //見下ろしたときに見える上面
    under:"#1d1e1f",    //見上げたときに見える底面
    seam:"#232425",     //継ぎ目
    seamHi:"#45474a",   //継ぎ目の下の細いハイライト
    line:"#111112",     //ふちどり
    corner:"#18191a",   //角の暗いガード
    mast:"#1a1b1c",     //棒とプロペラ
    mastHi:"#55575a",   //棒とプロペラの光の当たる側
    eye:"#0b0b0c",      //目の黒
    frame:"#f2f2ef",    //目の白い枠
    glint:"#8e9093"     //目のハイライト
};

//案E：元の絵と同じ平らな塗りで描く。(_g は40×40の座標で描けるように拡大しておく)
//  胴体の箱の形は向きによって変えず、目・棒・後ろのふたなどの部品を、箱のまわりの円周上の角度として持ち、
//  向き(_yaw 度。正で左を向く)に合わせて横へすべらせる。裏に回った部品は描かない
//  _pitch：-1(見上げる)～1(見下ろす)。見下ろすと上面、見上げると底面が帯になって見え、目が上下に動く
function drawFlatDrone(_g,_yaw,_pitch){
    var C = FLAT_COLOR, g = _g;
    var L = 2, R = 38, T = 17, B = 38, CX = 20;     //胴体の左・右・上・下
    var band = Math.abs(_pitch)*5;                  //上面・底面の見える厚み
    var faceT = T + (_pitch > 0 ? band : 0), faceB = B - (_pitch < 0 ? band : 0);
    //円周上の角度 _a 度・半径 _r の部品の、横の位置と表を向いている度合い(1：正面、0以下：裏)
    function at(_a,_r){
        var a = (_yaw + _a)*Math.PI/180;
        return { x:CX - _r*Math.sin(a), z:Math.cos(a) };
    }
    function rrect(_x,_y,_w,_h,_r){
        g.beginPath();
        g.moveTo(_x + _r,_y); g.arcTo(_x + _w,_y,_x + _w,_y + _h,_r); g.arcTo(_x + _w,_y + _h,_x,_y + _h,_r);
        g.arcTo(_x,_y + _h,_x,_y,_r); g.arcTo(_x,_y,_x + _w,_y,_r); g.closePath();
    }

    //棒とプロペラ(奥のものから)。後ろの1本だけ少し高い
    var masts = [at(60,16), at(-60,16), at(180,7)];
    masts[0].top = 5.5; masts[1].top = 5.5; masts[2].top = 3.5;
    masts.sort(function(a,b){ return a.z - b.z; });
    for(var i=0; i<masts.length; i++){
        var m = masts[i];
        //見下ろすと上面の上に立つので、手前の棒ほど根元が下がる
        var dy = _pitch > 0 ? band*(0.5 + 0.5*m.z) : 0;
        g.fillStyle = C.mast;
        g.fillRect(m.x - 1, m.top + dy, 2, T + dy - m.top + 1);
        //プロペラ：横から見ると平たい棒、上下から見ると回っている円盤
        var ry = 0.7 + 1.7*Math.abs(_pitch);
        g.globalAlpha = Math.abs(_pitch) > 0.2 ? 0.6 : 1;
        g.beginPath(); g.ellipse(m.x, m.top + dy, 5.5, ry, 0, 0, Math.PI*2); g.fill();
        g.globalAlpha = 1;
        g.fillRect(m.x - 1.5, m.top + dy - 1.2, 3, 2.4);
        //棒とハブの左側に細い光
        g.fillStyle = C.mastHi;
        g.fillRect(m.x - 1, m.top + dy + 1.2, 0.6, T + dy - m.top - 1.2);
        g.fillRect(m.x - 1.5, m.top + dy - 1.2, 3, 0.6);
    }

    //胴体
    rrect(L,T,R - L,B - T,3);
    g.save();
    g.clip();
    g.fillStyle = C.body; g.fillRect(L,T,R - L,B - T);
    if(_pitch > 0){ g.fillStyle = C.top; g.fillRect(L,T,R - L,band); }
    if(_pitch < 0){ g.fillStyle = C.under; g.fillRect(L,faceB,R - L,band); }
    //正面の上のふちの明るい線と、下寄りの継ぎ目
    g.fillStyle = C.rim; g.fillRect(L,faceT,R - L,1.2);
    g.fillStyle = C.seam; g.fillRect(L,faceB - 4.5,R - L,0.8);
    g.fillStyle = C.seamHi; g.fillRect(L,faceB - 3.7,R - L,0.5);
    //左上の角の光(光は左上から当たる)
    g.fillStyle = C.shine;
    g.fillRect(L + 3,faceT + 0.2,7,0.8);
    g.fillRect(L + 0.6,faceT + 1.6,0.8,4);
    //横の通気口(3本の切れ込み)
    [90,-90].forEach(function(_a){
        var v = at(_a,17);
        if(v.z < 0.25) return;
        g.fillStyle = C.line;
        for(var k=-1; k<=1; k++) g.fillRect(v.x - 2.5*v.z, (faceT + faceB)/2 + k*2.6 - 0.5, 5*v.z, 1);
        //切れ込みの下のふちに光(暗い胴体の上でも見えるように)
        g.fillStyle = C.seamHi;
        for(var k=-1; k<=1; k++) g.fillRect(v.x - 2.5*v.z, (faceT + faceB)/2 + k*2.6 + 0.5, 5*v.z, 0.5);
    });
    //後ろのふた
    var h = at(180,15);
    if(h.z > 0.15){
        var hw = 14*h.z, hy = (faceT + faceB)/2 - 4;
        g.strokeStyle = C.seamHi; g.lineWidth = 0.5;
        g.strokeRect(h.x - hw/2 + 0.5, hy + 0.6, hw, 8);
        g.strokeStyle = C.line; g.lineWidth = 0.8;
        g.strokeRect(h.x - hw/2, hy, hw, 8);
        g.fillStyle = C.line;
        g.fillRect(h.x - hw/2 + 1.5*h.z, hy + 1.5, 1.4*h.z, 1.4);
        g.fillRect(h.x + hw/2 - 2.9*h.z, hy + 1.5, 1.4*h.z, 1.4);
    }
    //目(黒い縁・白い枠・黒い中・左上のハイライト)。横を向くほど細くなる
    var ey = (faceT + faceB)/2 - 1 + _pitch*1.5;
    [26,-26].forEach(function(_a){
        var e = at(_a,18);
        if(e.z < 0.12) return;
        g.save();
        g.translate(e.x, ey);
        g.scale(e.z, 1);
        g.fillStyle = C.eye;   g.fillRect(-4.5,-4.5,9,9);
        g.fillStyle = C.frame; g.fillRect(-3.3,-3.3,6.6,6.6);
        g.fillStyle = C.eye;   g.fillRect(-2.1,-2.1,4.2,4.2);
        g.fillStyle = C.glint; g.fillRect(-2.1,-2.1,1.4,1.4);
        g.restore();
    });
    g.restore();
    //角の暗いガード(L字)
    g.fillStyle = C.corner;
    [[L,T,1,1],[R,T,-1,1],[L,B,1,-1],[R,B,-1,-1]].forEach(function(c){
        g.fillRect(c[2] > 0 ? c[0] : c[0] - 4, c[3] > 0 ? c[1] : c[1] - 1.6, 4, 1.6);
        g.fillRect(c[2] > 0 ? c[0] : c[0] - 1.6, c[3] > 0 ? c[1] : c[1] - 4, 1.6, 4);
    });
    //ふちどり
    rrect(L,T,R - L,B - T,3);
    g.strokeStyle = C.line; g.lineWidth = 1;
    g.stroke();
}

//標準(E)のシートを、等倍・2倍・4倍それぞれの大きさで直接描く(縮めないので、どの大きさでもくっきり)
function buildFlatSheets(){
    var list = [], mid = (FLAT_ELEVS - 1)/2;
    for(var lv=0; lv<3; lv++){
        var k = 1 << lv, f = DRONE_SIZE*k;
        var c = document.createElement("canvas");
        c.width = f*FLAT_YAWS; c.height = f*FLAT_ELEVS;
        var g = c.getContext("2d");
        for(var r=0; r<FLAT_ELEVS; r++){
            for(var y=0; y<FLAT_YAWS; y++){
                g.save();
                g.translate(y*f, r*f);
                g.scale(k,k);
                drawFlatDrone(g, y*360/FLAT_YAWS, (r - mid)/mid);
                g.restore();
            }
        }
        list.push(c);
    }
    list.yaws = FLAT_YAWS; list.elevs = FLAT_ELEVS;
    return list;
}

//クラシック(O)：元の6方向の絵を、角度に合わせてシートのコマに割り当てる
//(正面±33.75度は正面、後ろ±33.75度は後ろ、そのあいだは左右。正面のまま見上げる・見下ろすと上・下の絵)
var ORIG_IMAGES = { front:"Drone_front2", up:"Drone_up", down:"Drone_down", left:"Drone_left", right:"Drone_right", back:"Drone_back" };
function origFrame(_col,_row){
    var a = _col*360/DRONE_YAWS;
    if(a > 180) a -= 360;
    var side = Math.abs(a) <= 33.75 ? "front" : Math.abs(a) >= 146.25 ? "back" : a > 0 ? "left" : "right";
    if(side == "front" && _row == 0) return "up";
    if(side == "front" && _row == DRONE_ELEVS - 1) return "down";
    return side;
}
//ドット絵なので、拡大はなめらかにせず、そのまま大きくする
function buildOrigSheets(_imgs){
    var list = [];
    for(var lv=0; lv<3; lv++){
        var f = DRONE_SIZE << lv;
        var c = document.createElement("canvas");
        c.width = f*DRONE_YAWS; c.height = f*DRONE_ELEVS;
        var g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        for(var r=0; r<DRONE_ELEVS; r++){
            for(var y=0; y<DRONE_YAWS; y++) g.drawImage(_imgs[origFrame(y,r)], y*f, r*f, f, f);
        }
        list.push(c);
    }
    list.pixel = true;
    list.yaws = DRONE_YAWS; list.elevs = DRONE_ELEVS;
    return list;
}

//書き出した画像(開発用の3Dの絵)は、縮めたものを先に作っておく(縮めて描くときにぼやけたり、ちらついたりしないよう)
function buildBakedSheets(_img){
    var list = [_img];
    for(var i=0; i<2; i++){
        var src = list[0];
        var c = document.createElement("canvas");
        c.width = (src.naturalWidth || src.width)/2; c.height = (src.naturalHeight || src.height)/2;
        var g = c.getContext("2d");
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
        g.drawImage(src,0,0,c.width,c.height);
        list.unshift(c);
    }
    //段の数は画像の大きさから(書き出すときに段を増やしても、そのまま使える)
    list.yaws = Math.round((_img.naturalWidth || _img.width)/DRONE_FRAME);
    list.elevs = Math.round((_img.naturalHeight || _img.height)/DRONE_FRAME);
    return list;
}

//今使っているシート：[等倍, 2倍, 4倍]の3枚(用意できるまでは空)。pixel が true ならドット絵
var droneSheets = [];
//1枚の絵として使うところ(ストーリーの残骸など)向けに、正面の絵だけを切り出したもの
var Drone_front = document.createElement("canvas");
Drone_front.width = Drone_front.height = 1;   //用意できるまでは透明な1px
Drone_front._key = "droneFront";
function useDroneSheets(_list){
    droneSheets = _list;
    var f = DRONE_SIZE*2;
    Drone_front.width = Drone_front.height = f;
    Drone_front._key = "droneFront" + _list.id;   //色違いの覚えを、見た目ごとに分ける
    var g = Drone_front.getContext("2d");
    g.imageSmoothingEnabled = !_list.pixel;
    g.drawImage(_list[1],0,(_list.elevs - 1)/2*f,f,f,0,0,f,f);
}

//------------------------------------------------------------------------------
//  ドローン君の見た目(スキン)の選択。選んだものは localStorage に覚える
//------------------------------------------------------------------------------
var droneSkin = {
    KEY:"dronekun_skin",
    //タイトルの設定に並べるもの
    list:[
        { id:"E", name:"標準", sub:"いまのドローン君" },
        { id:"O", name:"クラシック", sub:"最初のころのドット絵" }
    ],
    current:DRONE_ART_DEFAULT,
    sheets:{},      //見た目ごとのシート(用意できたもの)
    waiting:{},     //読み込み中の見た目 → 用意できたら呼ぶもの
    //見た目のシートを用意する(用意できたら _then を呼ぶ。切り替えはしない)
    prepare:function(_id,_then){
        var self = this;
        if(this.sheets[_id]){ if(_then) _then(); return; }
        if(this.waiting[_id]){ if(_then) this.waiting[_id].push(_then); return; }
        this.waiting[_id] = _then ? [_then] : [];
        var done = function(_list){
            _list.id = _id;
            for(var i=0; i<_list.length; i++) _list[i]._key = "drone" + _id + "/" + i;
            self.sheets[_id] = _list;
            var w = self.waiting[_id];
            delete self.waiting[_id];
            for(var i=0; i<w.length; i++) w[i]();
        };
        if(_id == "E"){ done(buildFlatSheets()); return; }
        if(_id == "O"){
            var imgs = {}, left = 0;
            for(var k in ORIG_IMAGES) left++;
            for(var k in ORIG_IMAGES){
                imgs[k] = new Image();
                imgs[k].onload = function(){ if(--left == 0) done(buildOrigSheets(imgs)); };
                imgs[k].onerror = function(){ left = -1; self.fail(_id); };
                imgs[k].src = "images/game/Drone/" + ORIG_IMAGES[k] + ".png";
            }
            return;
        }
        var img = new Image();
        img.onload = function(){ done(buildBakedSheets(img)); };
        img.onerror = function(){ self.fail(_id); };
        img.src = "images/game/Drone/drone_" + _id + ".png";
    },
    //絵が見つからなければ標準にする
    fail:function(_id){
        delete this.waiting[_id];
        if(this.current == _id) this.use(DRONE_ART_DEFAULT);
    },
    //見た目を切り替える(覚えない)
    use:function(_id){
        var self = this;
        this.current = _id;
        this.prepare(_id,function(){ if(self.current == _id) useDroneSheets(self.sheets[_id]); });
    },
    //設定で選んだ見た目に切り替えて、覚える
    set:function(_id){
        this.use(_id);
        try{ localStorage.setItem(this.KEY,_id); }catch(e){}
    },
    //今の見た目が用意できたら _fn を呼ぶ(テスト・確認用)
    onReady:function(_fn){
        if(droneSheets.length && droneSheets.id == this.current){ _fn(); return; }
        this.prepare(this.current,function(){ setTimeout(_fn,0); });
    },
    //起動時：#art=A(開発用)があればそれ、なければ覚えている見た目
    init:function(){
        var m = location.hash.match(/art=([A-Z])/);
        if(m){ this.use(m[1]); return; }
        var id = DRONE_ART_DEFAULT;
        try{ id = localStorage.getItem(this.KEY) || id; }catch(e){}
        var ok = false;
        for(var i=0; i<this.list.length; i++) if(this.list[i].id == id) ok = true;
        this.use(ok ? id : DRONE_ART_DEFAULT);
    }
};
droneSkin.init();

var t=0;

//------------------------------------------------------------------------------
//  ドローン君の見た目の動き
//  ・振り向き：向きの角度(水平・高さ)をばねで目標へ近づけ、いちばん近い角度のコマを出す(本当に回って見える)。
//    ふわっと回り始め、少し行きすぎてから落ち着く。回っている間は機体を少し横に縮め、コマの切り替わりをなじませる
//  ・自分のドローン君は、動く向きそのものに向く(斜めに動けば、横を向きつつ見上げる・見下ろす)
//  ・傾き：横に動く方向へ機体を傾け、止まるとばねのように揺れ戻る
//  ・浮遊：ホバリングしているように少し上下にゆれる
//------------------------------------------------------------------------------
const TURN_SPRING = 0.07;   //振り向きのばねの強さ(大きいほど速く回る)
const TURN_DAMP = 0.7;      //振り向きの勢いの残り方(小さいほど行きすぎない)
const TURN_SQUASH = 0.12;   //いちばん速く回っているときに横に縮む割合
const TURN_SQUASH_SPEED = 12;   //縮みがいちばん大きくなる回る速さ(度/フレーム)
const TURN_MIN_SPEED = 0.3; //これより遅い動きでは、向く方向を変えない(px/フレーム)
const TILT_PER_SPEED = 0.06; //横の速さ1px/フレームあたりの傾き(ラジアン)
const TILT_MAX = 0.4;       //最大の傾き(約23度)
//向き(0:正面 1:上 2:下 3:左 4:右 5:後ろ)ごとの、水平の向き(度。正で左)と高さ(-1：見上げる ～ 1：見下ろす)
const DIR_YAW = [0, 0, 0, 67.5, -67.5, 180];
const DIR_ELEV = [0, -1, 1, 0, 0, 0];

//色違いのドローン君(同胞・ドローン君改)用に、絵に色を重ねたものを作って覚えておく
//(getImageDataを使わない方法なので、ローカルで開いても動く)
var tintCache = {};
function tintedImage(_img,_color){
    if(!_color) return _img;
    var w = _img.naturalWidth || _img.width, h = _img.naturalHeight || _img.height;
    if(!w || _img.complete === false) return _img;
    var key = (_img._key || _img.src) + "|" + w + "|" + _color;   //大きさも入れる(読み込み前の仮の絵と区別する)
    if(tintCache[key]) return tintCache[key];
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var g = c.getContext("2d");
    g.drawImage(_img,0,0);
    g.globalCompositeOperation = "source-atop";  //絵のある部分だけに色を塗る
    g.fillStyle = "rgba(" + _color + ",0.6)";
    g.fillRect(0,0,c.width,c.height);
    tintCache[key] = c;
    return c;
}
//シートの1コマだけに色を重ねたもの(シートまるごとより軽い。使ったコマだけ作る)
const TINT_FRAME_MAX = 2000;    //覚えておくコマの数の上限(超えたら忘れて作り直す)
var tintFrames = {}, tintFrameCount = 0;
function tintedFrame(_sheet,_col,_row,_f,_color){
    var key = _sheet._key + "|" + _col + "," + _row + "|" + _color;
    var c = tintFrames[key];
    if(c) return c;
    if(++tintFrameCount > TINT_FRAME_MAX){ tintFrames = {}; tintFrameCount = 1; }
    c = document.createElement("canvas");
    c.width = c.height = _f;
    var g = c.getContext("2d");
    g.drawImage(_sheet, _col*_f, _row*_f, _f, _f, 0, 0, _f, _f);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(" + _color + ",0.6)";
    g.fillRect(0,0,_f,_f);
    tintFrames[key] = c;
    return c;
}

//速度から向き(0:正面 1:上 2:下 3:左 4:右)を決める
function dirFromVel(_vx,_vy){
    if(Math.hypot(_vx,_vy) < 0.3) return 0;
    if(Math.abs(_vx) > Math.abs(_vy)) return _vx > 0 ? 4 : 3;
    return _vy > 0 ? 2 : 1;
}

var DroneLook = function(){
    this.shown = 0;     //向かっている向き(協力プレイ・対戦では相方へこれを送る)
    this.yaw = 0;       //今の水平の向き(度。正で左)
    this.elev = 0;      //今の高さ(-1：見上げる ～ 1：見下ろす)
    this.yawV = 0;      //回る勢い
    this.elevV = 0;
    this.aimX = 0;      //動く向き(速さを渡されたとき。最後に十分速く動いた向きを覚える)
    this.aimY = 0;
    this.tilt = 0;
    this.tiltV = 0;
    this.t = Math.random()*100;
    this.tint = null;   //色違いにするときの色("r,g,b")
};
DroneLook.prototype = {
    //_dir：移動方向から決めた向き　_speedX：横の速さ　_speedY：縦の速さ(渡すと、動く向きそのものに向く)
    update:function(_dir,_speedX,_speedY){
        this.t++;
        this.shown = _dir;
        var ty = DIR_YAW[_dir], te = DIR_ELEV[_dir];
        if(_speedY !== undefined && _dir >= 1 && _dir <= 4){
            var s = Math.hypot(_speedX,_speedY);
            if(s > TURN_MIN_SPEED){ this.aimX = _speedX/s; this.aimY = _speedY/s; }
            if(this.aimX || this.aimY){
                ty = -this.aimX*DIR_YAW[3];
                te = this.aimY;
            }
        }
        //ばねで目標の向きへ(左から右へは、近いほうの回り方で正面を通る)
        var d = ty - this.yaw;
        d -= Math.round(d/360)*360;
        this.yawV = (this.yawV + d*TURN_SPRING)*TURN_DAMP;
        this.yaw += this.yawV;
        this.yaw -= Math.round(this.yaw/360)*360;
        this.elevV = (this.elevV + (te - this.elev)*TURN_SPRING)*TURN_DAMP;
        this.elev += this.elevV;
        //傾きはばね：目標の角度へ引っぱられ、行きすぎて揺れながら落ち着く
        var target = Math.max(-TILT_MAX, Math.min(TILT_MAX, _speedX*TILT_PER_SPEED));
        this.tiltV += (target - this.tilt)*0.12;
        this.tiltV *= 0.86;
        this.tilt += this.tiltV;
    },
    //(_x,_y)を中心に描く。_scaleで拡大(省略時は等倍)
    draw:function(_x,_y,_scale){
        var sh = droneSheets;
        if(!sh.length) return;
        var k = _scale || 1;
        //描く大きさに近い絵を使う(等倍・2倍・4倍)。ドット絵は等倍の絵をそのまま拡大する
        var pix = sh.pixel;
        var kk = k*renderScale;     //画面の上での実際の大きさ(大きなモニターでは細かく描く)
        var lv = pix ? 0 : kk <= 1.25 ? 0 : kk <= 2.5 ? 1 : 2;
        var f = DRONE_SIZE << lv;
        //角度にいちばん近いコマ(段の数は見た目ごとに違う)
        var col = ((Math.round(this.yaw/360*sh.yaws) % sh.yaws) + sh.yaws) % sh.yaws;
        var row = Math.max(0, Math.min(sh.elevs - 1, Math.round((this.elev + 1)/2*(sh.elevs - 1))));
        var img = sh[lv], sx = col*f, sy = row*f;
        if(this.tint){ img = tintedFrame(sh[lv], col, row, f, this.tint); sx = sy = 0; }
        var bob = Math.sin(this.t*0.08)*1.5;
        var s = DRONE_SIZE*k;
        //回っている間は、少し横に縮む
        var squash = 1 - TURN_SQUASH*Math.min(1, Math.abs(this.yawV)/TURN_SQUASH_SPEED);
        ctx.save();
        //ドット絵は、傾かず・縮まず・整数倍で描くときはくっきり描く(元の描き方と同じ)
        var smooth = !pix || Math.abs(this.tilt) > 0.02 || squash < 0.99 || kk != Math.round(kk);
        if(pix) ctx.translate(Math.round(_x), Math.round(_y + bob*k));
        else ctx.translate(_x, _y + bob*k);
        ctx.rotate(this.tilt);
        ctx.scale(squash, 1);
        ctx.imageSmoothingEnabled = smooth;
        ctx.drawImage(img, sx, sy, f, f, -s/2, -s/2, s, s);
        ctx.restore();
        ctx.imageSmoothingEnabled = false;
    }
};

var drone = {
    //ドローンの座標計算
    X:CW/2,
    Y:CH/2,
    preX:CW/2,
    preY:CH/2,
    delay:30,       //追従の遅れ(追従速度)
    wobble:0,       //ふらつきの幅(追従精度)
    slow:false,     //燃料切れで遅くなっているか
    wt:0,           //ふらつき用の時間
    R:14,           //当たり判定の半径
    calcXY: function(){
        this.wt++;
        //追従精度が低いと、目標地点がマウスの周りをふらふらする
        var tx = MouseX + this.wobble * Math.sin(this.wt*0.051) * Math.cos(this.wt*0.017);
        var ty = MouseY + this.wobble * Math.sin(this.wt*0.037 + 1) * Math.cos(this.wt*0.023);
        var d = this.slow ? this.delay*3 : this.delay;

        this.preX = this.X;
        this.X = (tx + d * this.X) / (d+1);

        this.preY = this.Y;
        this.Y = (ty + d * this.Y) / (d+1);

        //画面の外には出ない
        this.X = Math.max(this.R, Math.min(this.X, CW - this.R));
        this.Y = Math.max(this.R, Math.min(this.Y, CH - this.R));
    },
    //強化レベルを反映
    applyStats: function(){
        this.delay = game.stat("speed");
        this.wobble = game.stat("accuracy");
    },
    //スタート画面用の初期状態
    resetStats: function(){
        this.delay = 30;
        this.wobble = 0;
        this.slow = false;
    },
    //ドローンの向いている方向と速度を検出
    Direction: 0,
    Speed:0,
    SpeedX:0,
    SpeedY:0,
    calcSpeed: function(){
        this.SpeedX = this.X - this.preX;
        this.SpeedY = this.Y - this.preY;
        this.Speed = Math.sqrt(this.SpeedX*this.SpeedX + this.SpeedY*this.SpeedY);
    },
    Threshold: 0.2,
    keeptime:0,     //チャタリング防止
    getDirection: function(){
        if(this.keeptime == 0 || this.keeptime >= 5){
            if(this.Speed > this.Threshold){
                this.keeptime=0;
                if(Math.abs(this.SpeedX) > Math.abs(this.SpeedY)){
                    if(this.SpeedX > 0){
                        this.Direction = 4;
                    }else{
                        this.Direction = 3;
                    }
                }else{
                    if(this.SpeedY > 0){
                        this.Direction = 2;
                    }else{
                        this.Direction = 1;
                    }
                }
            }else if(this.keeptime >= 100){this.Direction = 0;}
        }
        this.keeptime++;
    },
    //見た目の動き(振り向き・傾き・浮遊)
    look: new DroneLook(),
    //移動・向きの計算をまとめて行う
    update: function(){
        this.calcXY();
        this.calcSpeed();
        this.getDirection();
        this.look.update(this.Direction, this.SpeedX, this.SpeedY);   //縦の速さも渡して、斜めにも向く
    },
    draw: function(){
        this.look.draw(this.X, this.Y);
    }
}

//------------------------------------------------------------------------------
//  ポインタ
//------------------------------------------------------------------------------
var Pointer = new Image();
Pointer.src = "images/game/pointer3.png";
var pointer = {
    X: 0,
    Y: 0,
    calcXY: function(){
        this.X = MouseX-Pointer.naturalWidth/2;
        this.Y = MouseY-Pointer.naturalHeight/2;
    },
    draw: function(){
        if(!viewOpt.showPointer()) return;
        //ぼんやり光る絵なので、拡大するときはなめらかに(大きなモニターでカクカクしないように)
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(Pointer,this.X,this.Y);
        ctx.imageSmoothingEnabled = false;
    }
};

//------------------------------------------------------------------------------
//  戦闘画面の表示の設定(右下のボタンで切り替える。localStorage に覚える)
//  ・hitbox：ドローン君の中心の当たり判定の点
//  ・pointer：ポインタ(戦闘中だけ隠す。メニューなどの画面では操作に要るので出す)
//------------------------------------------------------------------------------
var viewOpt = {
    KEY:"dronekun_view",
    hitbox:true,
    pointer:true,
    load:function(){
        try{
            var d = JSON.parse(localStorage.getItem(this.KEY) || "{}");
            if(d.hitbox === false) this.hitbox = false;
            if(d.pointer === false) this.pointer = false;
        }catch(e){}
    },
    save:function(){
        try{ localStorage.setItem(this.KEY, JSON.stringify({ hitbox:this.hitbox, pointer:this.pointer })); }catch(e){}
    },
    toggle:function(_key){
        this[_key] = !this[_key];
        this.save();
    },
    //戦闘中か(戦闘画面と、対戦の戦闘中)
    inBattle:function(){
        return page.number == 1 || (page.number == 7 && versus.dragging());
    },
    showPointer:function(){
        return this.pointer || !this.inBattle();
    }
};
viewOpt.load();
