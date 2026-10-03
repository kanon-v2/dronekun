var canvas = document.getElementById("Canvas");
var parent = document.getElementById("Bigbox");
var ctx = canvas.getContext("2d");
const CW = 960; //Canvas-Width
const CH = 540; //Canvas-Height
canvas.width = CW;
canvas.height = CH;
ctx.imageSmoothingEnabled = false;  //ドット絵をくっきり
//16:9画面を32:18分割してグリッド単位で管理
const GS = CW/32;  //=30px Grid-Size

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
//  タッチ：戦闘中は画面のどこをドラッグしても、指の動いた分だけ目標が動く
//          (指でドローン君が隠れないように)。衝撃波は右下のボタン。それ以外の画面はタップ
//------------------------------------------------------------------------------
var MouseX=canvas.width/2;      //ドローン君が向かう目標の座標
var MouseY=canvas.height/2;
var MouseIn=false;              //操作中か(マウスがキャンバスの外に出たら一時停止)
var Click=0;                    //このフレームでクリック・タップされたか
var inputMode="mouse";          //最後に使った操作方法："mouse"か"touch"
const TOUCH_SPEED = 1.3;        //ドラッグの距離に対する目標の移動量の倍率
var drag = { id:null, x:0, y:0 };

//ページのスクロールや拡大縮小があってもキャンバス上の座標になるよう換算
function toCanvasPos(e){
    var rect = canvas.getBoundingClientRect();
    return {
        x:(e.clientX - rect.left) * canvas.width / rect.width,
        y:(e.clientY - rect.top) * canvas.height / rect.height
    };
}
//戦闘中のタッチはドラッグ操作になる
function isTouchDrag(){
    //戦闘中と対戦の戦闘中はドラッグで動かす
    return inputMode == "touch" && (page.number == 1 || (page.number == 7 && versus.dragging()));
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
        //BGM/SEボタンと衝撃波ボタンはその場で処理。それ以外はドラッグ開始
        if(sound.tapButton(p.x,p.y)) return;
        if(mainScreen.touchBlastHit(p.x,p.y)){ Click = 1; return; }
        drag.id = e.pointerId;
        drag.x = p.x; drag.y = p.y;
        return;
    }
    MouseX = p.x;
    MouseY = p.y;
    Click = 1;
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
//  ・ふだんの絵(案E)：元の絵の2次元のテイストのまま、図形で描く(drawFlatDrone)。画像ファイルはない
//  ・ほかの絵(スキン)：tools/drone-art.html の3Dの絵を tools/bake-drone.ps1 で書き出した画像。
//    index.html#art=A のように選ぶ(案A～Dは feature/drone-art-3d-candidates ブランチに保留)
//------------------------------------------------------------------------------
const DRONE_FRAME = 160;    //シートの1コマの大きさ(px。等倍の4倍)
const DRONE_SIZE = 40;      //ゲームでの等倍の大きさ(px)
const DRONE_YAWS = 16;      //水平の向きの段数
const DRONE_ELEVS = 5;      //高さの段数
const DRONE_ELEV_LEVEL = 2; //ふだんの高さの段(正面・左右・後ろ)
const DRONE_ART_DEFAULT = "E";
var DRONE_ART = (location.hash.match(/art=([A-Z])/) || [0,DRONE_ART_DEFAULT])[1];

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

//案Eのシートを、等倍・2倍・4倍それぞれの大きさで直接描く(縮めないので、どの大きさでもくっきり)
function buildFlatSheets(){
    var list = [];
    for(var lv=0; lv<3; lv++){
        var k = 1 << lv, f = DRONE_SIZE*k;
        var c = document.createElement("canvas");
        c.width = f*DRONE_YAWS; c.height = f*DRONE_ELEVS;
        var g = c.getContext("2d");
        for(var r=0; r<DRONE_ELEVS; r++){
            for(var y=0; y<DRONE_YAWS; y++){
                g.save();
                g.translate(y*f, r*f);
                g.scale(k,k);
                drawFlatDrone(g, y*360/DRONE_YAWS, (r - DRONE_ELEV_LEVEL)/DRONE_ELEV_LEVEL);
                g.restore();
            }
        }
        c._key = "drone" + DRONE_ART + "/" + lv;
        list.push(c);
    }
    return list;
}

//ゲームで使う形にそろえる：droneSheets は[等倍, 2倍, 4倍]の3枚
var droneSheets = [];   //用意できるまでは空
function useDroneSheets(_list){
    droneSheets = _list;
    //正面の絵だけを切り出したもの(ストーリーの残骸など、1枚の絵として使うところ向け)
    var f = DRONE_SIZE*2;
    Drone_front.width = Drone_front.height = f;
    var g = Drone_front.getContext("2d");
    g.drawImage(_list[1],0,DRONE_ELEV_LEVEL*f,f,f,0,0,f,f);
}
//書き出した画像のスキンは、縮めたものを先に作っておく(縮めて描くときにぼやけたり、ちらついたりしないよう)
var droneSheetImg = new Image();
droneSheetImg.onload = function(){
    var list = [droneSheetImg];
    droneSheetImg._key = "drone" + DRONE_ART + "/2";
    for(var i=1; i>=0; i--){
        var src = list[0];
        var c = document.createElement("canvas");
        c.width = src.width/2; c.height = src.height/2;
        var g = c.getContext("2d");
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
        g.drawImage(src,0,0,c.width,c.height);
        c._key = "drone" + DRONE_ART + "/" + i;
        list.unshift(c);
    }
    useDroneSheets(list);
};
//選んだ絵が見つからなければ、ふだんの絵にする
droneSheetImg.onerror = function(){
    DRONE_ART = DRONE_ART_DEFAULT;
    useDroneSheets(buildFlatSheets());
};
var Drone_front = document.createElement("canvas");
Drone_front.width = Drone_front.height = 1;   //用意できるまでは透明な1px
Drone_front._key = "droneFront";
if(DRONE_ART == DRONE_ART_DEFAULT) useDroneSheets(buildFlatSheets());
else droneSheetImg.src = "images/game/Drone/drone_" + DRONE_ART + ".png";

var t=0;

//------------------------------------------------------------------------------
//  ドローン君の見た目の動き
//  ・振り向き：向きの角度を少しずつ目標へ近づけ、いちばん近い角度の絵を出す(本当に回って見える)
//  ・傾き：横に動く方向へ機体を傾け、止まるとばねのように揺れ戻る
//  ・浮遊：ホバリングしているように少し上下にゆれる
//------------------------------------------------------------------------------
const TURN_RATE = 0.22;     //振り向きの速さ(1フレームで残りの角度の何割を回るか)
const TILT_PER_SPEED = 0.06; //横の速さ1px/フレームあたりの傾き(ラジアン)
const TILT_MAX = 0.4;       //最大の傾き(約23度)
//向き(0:正面 1:上 2:下 3:左 4:右 5:後ろ)ごとの、水平の向き(段)とカメラの高さ(段)
const DIR_YAW = [0, 0, 0, 3, -3, 8];
const DIR_ELEV = [2, 0, 4, 2, 2, 2];

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

//速度から向き(0:正面 1:上 2:下 3:左 4:右)を決める
function dirFromVel(_vx,_vy){
    if(Math.hypot(_vx,_vy) < 0.3) return 0;
    if(Math.abs(_vx) > Math.abs(_vy)) return _vx > 0 ? 4 : 3;
    return _vy > 0 ? 2 : 1;
}

var DroneLook = function(){
    this.shown = 0;     //向かっている向き(協力プレイ・対戦では相方へこれを送る)
    this.yaw = 0;       //今の水平の向き(段。小数)
    this.elev = DRONE_ELEV_LEVEL;   //今のカメラの高さ(段。小数)
    this.tilt = 0;
    this.tiltV = 0;
    this.t = Math.random()*100;
    this.tint = null;   //色違いにするときの色("r,g,b")
};
DroneLook.prototype = {
    //_dir：移動方向から決めた向き　_speedX：横の速さ
    update:function(_dir,_speedX){
        this.t++;
        this.shown = _dir;
        //近いほうの回り方で目標の向きへ(左から右へは正面を通って回る)
        var d = DIR_YAW[_dir] - this.yaw;
        d -= Math.round(d/DRONE_YAWS)*DRONE_YAWS;
        this.yaw += Math.abs(d) < 0.05 ? d : d*TURN_RATE;
        this.elev += (DIR_ELEV[_dir] - this.elev)*TURN_RATE;
        //傾きはばね：目標の角度へ引っぱられ、行きすぎて揺れながら落ち着く
        var target = Math.max(-TILT_MAX, Math.min(TILT_MAX, _speedX*TILT_PER_SPEED));
        this.tiltV += (target - this.tilt)*0.12;
        this.tiltV *= 0.86;
        this.tilt += this.tiltV;
    },
    //(_x,_y)を中心に描く。_scaleで拡大(省略時は等倍)
    draw:function(_x,_y,_scale){
        if(!droneSheets.length) return;
        var k = _scale || 1;
        //描く大きさに近い絵を使う(等倍なら1/4、2倍なら1/2)
        var lv = k <= 1.25 ? 0 : k <= 2.5 ? 1 : 2;
        var img = tintedImage(droneSheets[lv], this.tint);
        var f = DRONE_FRAME >> (2 - lv);
        var col = ((Math.round(this.yaw) % DRONE_YAWS) + DRONE_YAWS) % DRONE_YAWS;
        var row = Math.max(0, Math.min(DRONE_ELEVS - 1, Math.round(this.elev)));
        var bob = Math.sin(this.t*0.08)*1.5;
        var s = DRONE_SIZE*k;
        ctx.save();
        ctx.translate(_x, _y + bob*k);
        ctx.rotate(this.tilt);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, col*f, row*f, f, f, -s/2, -s/2, s, s);
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
        this.look.update(this.Direction, this.SpeedX);
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
        ctx.drawImage(Pointer,this.X,this.Y);
    }
};
