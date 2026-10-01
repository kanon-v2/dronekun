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
    return inputMode == "touch" && page.number == 1;
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
    write:function(){
        //協力プレイはその場かぎり(ひとり用のセーブは上書きしない)
        if(typeof coop != "undefined" && coop.active) return;
        try{
            localStorage.setItem(this.KEY, JSON.stringify({
                wave:game.wave, parts:game.parts, score:game.score, level:game.level,
                owned:game.owned, slots:game.slots, slotCount:game.slotCount, pendingReward:game.pendingReward,
                seen:game.seen
            }));
        }catch(e){}
    },
    exists:function(){
        try{ return localStorage.getItem(this.KEY) != null; }catch(e){ return false; }
    },
    //読み込めたらtrue
    load:function(){
        try{
            var d = JSON.parse(localStorage.getItem(this.KEY));
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
//  ドローン
//------------------------------------------------------------------------------
var Drone_front = new Image();
Drone_front.src = "images/game/Drone/Drone_front2.png";
var Drone_up = new Image();
Drone_up.src = "images/game/Drone/Drone_up.png";
var Drone_down = new Image();
Drone_down.src = "images/game/Drone/Drone_down.png";
var Drone_left = new Image();
Drone_left.src = "images/game/Drone/Drone_left.png";
var Drone_right = new Image();
Drone_right.src = "images/game/Drone/Drone_right.png";
var Drone_back = new Image();
Drone_back.src = "images/game/Drone/Drone_back.png";

var t=0;

//------------------------------------------------------------------------------
//  ドローン君の見た目の動き(6枚の絵のあいだをなめらかに見せる)
//  ・振り向き：絵を一瞬細く潰し、いちばん細いときに次の向きの絵に差し替えて戻す
//    (左右への振り向きは横に、上下への振り向きは縦に潰す)
//  ・傾き：横に動く方向へ機体を傾け、止まるとばねのように揺れ戻る
//  ・浮遊：ホバリングしているように少し上下にゆれる
//------------------------------------------------------------------------------
const TURN_FRAMES = 10;     //振り向きにかかるフレーム数
const TILT_PER_SPEED = 0.06; //横の速さ1px/フレームあたりの傾き(ラジアン)
const TILT_MAX = 0.4;       //最大の傾き(約23度)

//色違いのドローン君(同胞・ドローン君改)用に、絵に色を重ねたものを作って覚えておく
//(getImageDataを使わない方法なので、ローカルで開いても動く)
var tintCache = {};
function tintedImage(_img,_color){
    if(!_color || !_img.complete || !_img.naturalWidth) return _img;
    var key = _img.src + "|" + _color;
    if(tintCache[key]) return tintCache[key];
    var c = document.createElement("canvas");
    c.width = _img.naturalWidth;
    c.height = _img.naturalHeight;
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

//Direction 0:front　1:up  2:down  3:left  4:right  5:back
function droneImage(_dir){
    switch(_dir){
        case 1: return Drone_up;
        case 2: return Drone_down;
        case 3: return Drone_left;
        case 4: return Drone_right;
        case 5: return Drone_back;
    }
    return Drone_front;
}

var DroneLook = function(){
    this.shown = 0;     //今表示している向き
    this.to = 0;        //振り向いた先の向き
    this.turnT = 0;     //振り向き中の経過フレーム(0なら振り向いていない)
    this.vertical = false;
    this.tilt = 0;
    this.tiltV = 0;
    this.t = Math.random()*100;
    this.tint = null;   //色違いにするときの色("r,g,b")
};
DroneLook.prototype = {
    //_dir：移動方向から決めた向き　_speedX：横の速さ
    update:function(_dir,_speedX){
        this.t++;
        //振り向き(振り向き中に向きが変わったら、終わってから次の振り向きを始める)
        if(this.turnT == 0 && _dir != this.shown){
            this.to = _dir;
            this.turnT = 1;
            //上下の絵がからむ振り向き(左右を含まない)は縦に潰す
            var lr = function(d){ return d == 3 || d == 4; };
            this.vertical = !lr(this.shown) && !lr(_dir);
        }else if(this.turnT > 0){
            this.turnT++;
            if(this.turnT == Math.ceil(TURN_FRAMES/2)) this.shown = this.to;
            if(this.turnT >= TURN_FRAMES) this.turnT = 0;
        }
        //傾きはばね：目標の角度へ引っぱられ、行きすぎて揺れながら落ち着く
        var target = Math.max(-TILT_MAX, Math.min(TILT_MAX, _speedX*TILT_PER_SPEED));
        this.tiltV += (target - this.tilt)*0.12;
        this.tiltV *= 0.86;
        this.tilt += this.tiltV;
    },
    //(_x,_y)を中心に描く。_scaleで拡大(省略時は等倍)
    draw:function(_x,_y,_scale){
        var img = tintedImage(droneImage(this.shown), this.tint);
        var w = img.naturalWidth || img.width || 40, h = img.naturalHeight || img.height || 40;
        var k = _scale || 1;
        //振り向きの潰れ具合：1 → 0.12 → 1
        var sx = 1, sy = 1;
        if(this.turnT > 0){
            var s = Math.max(0.12, Math.abs(Math.cos(Math.PI*this.turnT/TURN_FRAMES)));
            if(this.vertical) sy = s; else sx = s;
        }
        var bob = Math.sin(this.t*0.08)*1.5;
        ctx.save();
        ctx.translate(Math.round(_x), Math.round(_y + bob*k));
        ctx.rotate(this.tilt);
        ctx.scale(sx*k,sy*k);
        //回転・縮小するときはなめらかに描いたほうがきれい
        ctx.imageSmoothingEnabled = this.turnT > 0 || Math.abs(this.tilt) > 0.02 || k != Math.round(k);
        ctx.drawImage(img,-w/2,-h/2);
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
    //Direction 0:front　1:up  2:down  3:left  4:right  5:back
    getImage: function(){
        switch(this.Direction){
            case 0: return Drone_front; break;
            case 1: return Drone_up;    break;
            case 2: return Drone_down;  break;
            case 3: return Drone_left;  break;
            case 4: return Drone_right; break;
            case 5: return Drone_back;  break;
        }
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
