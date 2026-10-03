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
//  tools/drone-art.html で3Dの形から描き、tools/bake-drone.ps1 で1枚にまとめたもの。
//  横に水平の向き16段(22.5度ずつ。0が正面、増えると左を向く)、縦にカメラの高さ5段
//  (下から見上げる → 上から見下ろす)が並ぶ。1コマは DRONE_FRAME px で、ゲームでは DRONE_SIZE px に縮めて描く
//------------------------------------------------------------------------------
const DRONE_FRAME = 160;    //書き出した絵の1コマの大きさ(px)
const DRONE_SIZE = 40;      //ゲームでの等倍の大きさ(px)
const DRONE_YAWS = 16;      //水平の向きの段数
const DRONE_ELEVS = 5;      //カメラの高さの段数
const DRONE_ELEV_LEVEL = 2; //ふだんの高さの段(正面・左右・後ろ)
//試作の見比べ用：index.html#art=B のように案を選べる
var DRONE_ART = (location.hash.match(/art=([ABC])/) || [0,"A"])[1];

//縮めて描くときにぼやけたり、ちらついたりしないよう、1/2・1/4に縮めた絵も先に作っておく
var droneSheets = [];   //[1/4, 1/2, 等倍]の順。読み込み前は空
var droneSheetImg = new Image();
droneSheetImg.onload = function(){
    var list = [];
    var src = droneSheetImg, w = src.naturalWidth, h = src.naturalHeight;
    for(var i=0; i<2; i++){
        var c = document.createElement("canvas");
        c.width = w/2; c.height = h/2;
        var g = c.getContext("2d");
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
        g.drawImage(src,0,0,c.width,c.height);
        c._key = "drone" + DRONE_ART + "/" + (i + 1);
        list.unshift(c);
        src = c; w = c.width; h = c.height;
    }
    droneSheetImg._key = "drone" + DRONE_ART + "/0";
    list.push(droneSheetImg);
    droneSheets = list;
    //正面の絵だけを切り出したもの(ストーリーの残骸など、1枚の絵として使うところ向け)
    var f = DRONE_FRAME/2;
    Drone_front.width = Drone_front.height = f;
    var g = Drone_front.getContext("2d");
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(list[1],0,DRONE_ELEV_LEVEL*f,f,f,0,0,f,f);
};
droneSheetImg.src = "images/game/Drone/drone_" + DRONE_ART + ".png";
var Drone_front = document.createElement("canvas");
Drone_front.width = Drone_front.height = 1;   //読み込みが終わるまでは透明な1px
Drone_front._key = "droneFront";

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
