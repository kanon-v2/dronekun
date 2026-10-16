//------------------------------------------------------------------------------
//  戦闘画面の奥の景色(battleBg.js の drawSky から呼ぶ)
//  ・空・雲・山・遠い街・近い街・地面を別々の層にして、奥ほどゆっくり左へ流す(ドローン君が前へ飛んでいる疾走感)。
//    ドローン君の動きと逆にも、近い層ほど大きくずらす(奥行き)。
//  ・空ごとに動く物を足す：昼(鳥・飛行機雲)・夕方(鳥・高架を走る電車)・夜(星・航空障害灯・探照灯)・戦場(煙・炎・照明弾・対空砲火・爆撃機・火の粉)
//  ・最後に紙の色を重ねて、敵や弾が見やすい明るさにそろえる(前は8割以上を白で隠していた)
//  層は起動後に一度だけ別のキャンバスに描いておき(空が変わったら描き直す)、毎フレームは貼るだけ。動く物は毎フレーム図形で描く。
//  WAVEの番号と時間だけで決まるので、協力プレイ・対戦でも通信は要らない
//  前の背景に戻して見比べるには、URL に #bgold を付ける
//------------------------------------------------------------------------------
const SCENE_HZ = 430;           //地平線の高さ(px)
const SCENE_TILE = 1920;        //流れる層の1周の幅(px。この幅で同じ景色がくり返す)
const SCENE_RES = 0.75;         //層を描いておく細かさ(ゲームの大きさの何倍。奥の景色なので少しぼけてよい)
const SCENE_FLOW = 1;           //景色が流れる速さの倍率(1：遠い街が1秒に約18px)
const SCENE_PARALLAX = 0.035;   //ドローン君が動いた分の何倍、景色を逆へずらすか(近い層ほどこれに層の倍率を掛ける)
//紙の色を重ねる濃さ(敵・弾の見やすさとの兼ね合い。大きいほど景色が薄い)
const SCENE_WASH = {
    day:  ["252,253,255", 0.42],
    dusk: ["255,247,240", 0.46],
    night:["200,212,240", 0.26],
    war:  ["236,214,200", 0.24]
};
const SCENE_HUD_WASH = 0.4;     //上の表示(耐久・WAVEなど)を読みやすくするため、画面の上のふちに足す紙の色の濃さ
const SCENE_HUD_H = 110;        //その高さ(px。下へ向かって薄くなる)
const SCENE_STREAKS = 8;        //風の筋の数(流れる速さを感じさせる)
const SCENE_EMBERS = 40;        //戦場で舞い上がる火の粉の数
//空ごとの色(sky：上から地平線まで4色　far/near：遠い街・近い街　win：明かりの色と点いている割合)
const SCENE_PAL = {
    day:{
        sky:["#4f9fe8","#86c2f4","#c4e3fa","#e8f5ff"], haze:"232,244,255",
        cloud:["#ffffff","#c9dcef"], mount:["#9cc0dd","#b9d4ea"],
        far:"#a9c6dd", farEdge:"#c6dbeb", farWin:["#d6e8f6",0.5],
        near:"#7e9fba", nearEdge:"#a8c3d8", nearWin:["#cfe6f7",0.45],
        ground:["#9ccb7e","#6fa35a"], post:"#5b7d52", line:"rgba(255,255,255,0.35)"
    },
    dusk:{
        sky:["#33406f","#8a5c8e","#e08a6c","#f6bb82"], haze:"246,178,130",
        cloud:["#ffb58f","#7a4f7c"], mount:["#7c5478","#9a6582"],
        far:"#6c4a6c", farEdge:"#a8708a", farWin:["#ffcf86",0.18],
        near:"#3d2c48", nearEdge:"#8a5a70", nearWin:["#ffc874",0.3],
        ground:["#3a2c44","#241a2e"], post:"#1c1424", line:"rgba(255,190,130,0.35)"
    },
    night:{
        sky:["#0a1028","#17234a","#2a3a68","#3d4f80"], haze:"80,100,150",
        cloud:["#8a98c4","#3a4672"], mount:["#1d2848","#26335a"],
        far:"#1a2444", farEdge:"#33426e", farWin:["#ffd890",0.25],
        near:"#0f1630", farTall:1, nearEdge:"#2c3a62", nearWin:["#ffd080",0.32],
        ground:["#121a32","#0a0f20"], post:"#060a16", line:"rgba(255,220,150,0.5)"
    },
    war:{
        sky:["#0a0a14","#1c1626","#3e2430","#7a3424"], haze:"200,90,50",
        cloud:["#5a3a3a","#2a1e24"], mount:["#2a1c22","#3a2228"],
        far:"#24181c", farEdge:"#5a2a24", farWin:["#ff8a40",0.08],
        near:"#140e12", nearEdge:"#4a2420", nearWin:["#ff7030",0.06],
        ground:["#1c1214","#100a0c"], post:"#0a0608", line:"rgba(255,120,60,0.4)"
    }
};
//層(speed：流れる速さの倍率　depth：ドローン君と逆へずらす倍率　y0〜y1：描く高さの範囲px)
const SCENE_LAYERS = [
    { id:"cloudFar",  speed:0.06, depth:0.4, y0:0,   y1:300 },
    { id:"mount",     speed:0.12, depth:0.6, y0:300, y1:445 },
    { id:"cloudNear", speed:0.22, depth:0.7, y0:20,  y1:330 },
    { id:"far",       speed:0.3,  depth:0.8, y0:280, y1:455 },
    { id:"near",      speed:0.75, depth:1.3, y0:270, y1:490 },
    { id:"ground",    speed:2.6,  depth:2.2, y0:470, y1:570 }
];

var bgScene = {
    on:!/bgold/i.test(location.hash),   //#bgold で前の背景
    dist:0,             //流れた量(px。層ごとに speed を掛ける)
    flow:1,             //流れる速さ(ほかの演出から変えられる)
    name:"",            //描いてある空
    base:null,          //空(流れない)
    layers:{},          //層ごとのキャンバス
    tall:[],            //航空障害灯を付ける高い建物 { layer, x, y }
    rails:false,        //近い街に高架がある(夕方。電車が走る)

    //------------------------------------------------------------------ 描く
    draw:function(_name,_t,_dt){
        if(_name != this.name) this.paint(_name);
        this.dist += _dt*SCENE_FLOW*this.flow;
        var P = SCENE_PAL[_name], t = _t;
        this.blitBase();
        if(_name == "night" || _name == "war") this.stars(t, _name == "war");
        if(_name == "day") this.sunRays(t);
        this.blit("cloudFar");
        if(_name == "day") this.plane(t);
        if(_name == "war"){ this.bombers(t); this.flak(t); }
        this.blit("mount");
        if(_name == "night" || _name == "war") this.searchlights(t, _name == "war");
        this.blit("cloudNear");
        this.haze(P);
        if(_name == "war") this.horizonFire(t);
        this.blit("far");
        this.lights("far", t);
        if(_name == "war") this.smoke(t);
        this.blit("near");
        this.lights("near", t);
        if(this.rails) this.train(t);
        this.blit("ground");
        if(_name == "day" || _name == "dusk") this.birds(t, _name == "dusk");
        if(_name == "war"){ this.flares(t); this.embers(t); }
        this.streaks(t, _name);
        //紙の色を重ねて、敵・弾が見やすい明るさにそろえる
        var w = SCENE_WASH[_name];
        ctx.fillStyle = "rgba(" + w[0] + "," + w[1] + ")";
        ctx.fillRect(-20,-20,CW + 40,CH + 40);
        var g = ctx.createLinearGradient(0,0,0,SCENE_HUD_H);
        g.addColorStop(0, "rgba(" + w[0] + "," + SCENE_HUD_WASH + ")");
        g.addColorStop(1, "rgba(" + w[0] + ",0)");
        ctx.fillStyle = g;
        ctx.fillRect(-20,-20,CW + 40,SCENE_HUD_H + 20);
    },
    //ドローン君と逆へずらす量(_k：層の倍率)
    offX:function(_k){ return -(drone.X - CW/2)*SCENE_PARALLAX*_k; },
    offY:function(_k){ return -(drone.Y - CH/2)*SCENE_PARALLAX*0.5*_k; },
    //層の流れた量を、画面の上の位置(0〜SCENE_TILE)にする
    scrollOf:function(_L){ return (this.dist*_L.speed) % SCENE_TILE; },
    layer:function(_id){ for(var i=0; i<SCENE_LAYERS.length; i++) if(SCENE_LAYERS[i].id == _id) return SCENE_LAYERS[i]; },
    //層のキャンバスを、つなぎ目なく横に並べて貼る
    blit:function(_id){
        var L = this.layer(_id), c = this.layers[_id];
        if(!c) return;
        var x0 = -this.scrollOf(L) + this.offX(L.depth), y = L.y0 + this.offY(L.depth);
        x0 = x0 % SCENE_TILE; if(x0 > 0) x0 -= SCENE_TILE;
        for(var x=x0; x<CW + 20; x+=SCENE_TILE) ctx.drawImage(c, x, y, SCENE_TILE, L.y1 - L.y0);
    },
    blitBase:function(){
        var s = 1.04, w = CW*s, h = CH*s;
        ctx.drawImage(this.base, (CW - w)/2 + this.offX(0.25), (CH - h)/2 + this.offY(0.25), w, h);
    },
    //層の中の点(_x：層の1周の中の位置)が、今の画面のどこに見えるか(見えなければ null)
    screenX:function(_id,_x){
        var L = this.layer(_id);
        var x = (_x - this.scrollOf(L) + this.offX(L.depth)) % SCENE_TILE;
        if(x < -40) x += SCENE_TILE;
        return x > CW + 40 ? null : x;
    },

    //------------------------------------------------------------------ 層を描いておく
    paint:function(_name){
        this.name = _name;
        var P = SCENE_PAL[_name];
        //空(流れない。地平線より下は地面の色)
        if(!this.base){ this.base = document.createElement("canvas"); }
        this.base.width = Math.round(CW*0.5); this.base.height = Math.round(CH*0.5);
        var c = this.base.getContext("2d");
        c.setTransform(0.5,0,0,0.5,0,0);
        this.paintSky(c, _name, P);
        this.tall = [];
        this.rails = _name == "dusk";
        for(var i=0; i<SCENE_LAYERS.length; i++){
            var L = SCENE_LAYERS[i];
            var cv = this.layers[L.id] || (this.layers[L.id] = document.createElement("canvas"));
            cv.width = Math.round(SCENE_TILE*SCENE_RES); cv.height = Math.round((L.y1 - L.y0)*SCENE_RES);
            var x = cv.getContext("2d");
            x.setTransform(SCENE_RES,0,0,SCENE_RES,0,-L.y0*SCENE_RES);
            this["paint_" + L.id](x, _name, P);
        }
    },
    //決まった並びの乱数(0〜1)
    rnd:function(_i,_s){ return storyScreen.hash(_i,_s); },
    //横につながるように、はみ出した分を反対の端にも描く
    wrap:function(_x,_w,_fn){
        _fn(_x);
        if(_x + _w > SCENE_TILE) _fn(_x - SCENE_TILE);
        if(_x < 0) _fn(_x + SCENE_TILE);
    },
    paintSky:function(c,_name,P){
        var g = c.createLinearGradient(0,0,0,SCENE_HZ);
        g.addColorStop(0,P.sky[0]); g.addColorStop(0.45,P.sky[1]); g.addColorStop(0.82,P.sky[2]); g.addColorStop(1,P.sky[3]);
        c.fillStyle = g;
        c.fillRect(0,0,CW,CH);
        var glow = function(_x,_y,_r,_stops){
            var gg = c.createRadialGradient(_x,_y,0,_x,_y,_r);
            for(var i=0; i<_stops.length; i++) gg.addColorStop(_stops[i][0], _stops[i][1]);
            c.fillStyle = gg;
            c.beginPath(); c.arc(_x,_y,_r,0,Math.PI*2); c.fill();
        };
        if(_name == "day"){
            glow(800,90,220,[[0,"rgba(255,253,235,1)"],[0.12,"rgba(255,250,220,0.95)"],[0.3,"rgba(255,245,200,0.4)"],[1,"rgba(255,245,200,0)"]]);
            c.fillStyle = "#fffef4";
            c.beginPath(); c.arc(800,90,26,0,Math.PI*2); c.fill();
        }else if(_name == "dusk"){
            glow(200,SCENE_HZ - 40,360,[[0,"rgba(255,226,160,1)"],[0.12,"rgba(255,190,120,0.9)"],[0.4,"rgba(240,130,100,0.35)"],[1,"rgba(240,130,100,0)"]]);
            c.fillStyle = "#ffe6b0";
            c.beginPath(); c.arc(200,SCENE_HZ - 40,44,0,Math.PI*2); c.fill();
        }else{
            var war = _name == "war";
            var mx = war ? 600 : 640, my = 150;
            glow(mx,my,150,[[0, war ? "rgba(255,190,160,0.4)" : "rgba(210,225,255,0.45)"],[1,"rgba(210,225,255,0)"]]);
            c.fillStyle = war ? "#f2c2a8" : "#eef2ff";
            c.beginPath(); c.arc(mx,my,26,0,Math.PI*2); c.fill();
            //月の模様
            c.fillStyle = war ? "rgba(180,110,90,0.35)" : "rgba(160,175,215,0.35)";
            c.beginPath(); c.arc(mx - 8,my - 5,7,0,Math.PI*2); c.arc(mx + 9,my + 6,5,0,Math.PI*2); c.arc(mx + 3,my - 11,3.5,0,Math.PI*2); c.fill();
            if(war){
                //地平線の向こうが燃えている
                var fg = c.createLinearGradient(0,SCENE_HZ - 160,0,SCENE_HZ);
                fg.addColorStop(0,"rgba(255,90,40,0)");
                fg.addColorStop(1,"rgba(255,110,50,0.5)");
                c.fillStyle = fg;
                c.fillRect(0,SCENE_HZ - 160,CW,160);
            }
        }
        c.fillStyle = P.ground[1];
        c.fillRect(0,SCENE_HZ,CW,CH - SCENE_HZ);
    },
    //遠くの雲
    paint_cloudFar:function(c,_name,P){
        if(_name == "day"){
            for(var i=0; i<9; i++){
                var x = i*SCENE_TILE/9 + this.rnd(i,11)*120, y = 50 + this.rnd(i,12)*150, s = 0.5 + this.rnd(i,13)*0.5;
                this.wrap(x - 120*s, 240*s, function(_x){ bgScene.cumulus(c, _x + 120*s, y, s, P.cloud, 0.75); });
            }
        }else if(_name == "dusk"){
            for(var i=0; i<14; i++){
                var x = i*SCENE_TILE/14 + this.rnd(i,21)*60, y = 50 + this.rnd(i,22)*190, w = 120 + this.rnd(i,23)*200;
                this.wrap(x - w, w*2, function(_x){ bgScene.stratus(c, _x + w, y, w, P.cloud, 0.55); });
            }
        }else{
            //夜：月にかかる薄い雲　戦場：低く垂れこめる煙
            var war = _name == "war";
            for(var i=0; i<8; i++){
                var x = i*SCENE_TILE/8 + this.rnd(i,31)*90, y = (war ? 150 : 70) + this.rnd(i,32)*(war ? 140 : 160), w = 140 + this.rnd(i,33)*220;
                this.wrap(x - w, w*2, function(_x){ bgScene.stratus(c, _x + w, y, w, P.cloud, war ? 0.5 : 0.28); });
            }
        }
    },
    //近くの雲(昼・夕方だけ。大きく、少し速く流れる)
    paint_cloudNear:function(c,_name,P){
        if(_name == "day"){
            for(var i=0; i<4; i++){
                var x = i*SCENE_TILE/4 + this.rnd(i,41)*200, y = 120 + this.rnd(i,42)*160, s = 1 + this.rnd(i,43)*0.5;
                this.wrap(x - 130*s, 260*s, function(_x){ bgScene.cumulus(c, _x + 130*s, y, s, P.cloud, 0.9); });
            }
        }else if(_name == "dusk"){
            for(var i=0; i<5; i++){
                var x = i*SCENE_TILE/5 + this.rnd(i,51)*150, y = 90 + this.rnd(i,52)*170, w = 220 + this.rnd(i,53)*200;
                this.wrap(x - w, w*2, function(_x){ bgScene.stratus(c, _x + w, y, w, P.cloud, 0.75); });
            }
        }
    },
    //もこもこの雲(下に影、上に光の当たった白)
    cumulus:function(c,_x,_y,_s,_col,_a){
        var puffs = [[0,0,40],[-44,8,28],[42,6,30],[-18,-20,30],[20,-26,34],[-70,16,18],[72,14,20]];
        c.globalAlpha = _a;
        c.fillStyle = _col[1];
        c.beginPath();
        for(var i=0; i<puffs.length; i++){ var p = puffs[i]; c.moveTo(_x + p[0]*_s + p[2]*_s, _y + p[1]*_s + 6*_s); c.arc(_x + p[0]*_s, _y + p[1]*_s + 6*_s, p[2]*_s, 0, Math.PI*2); }
        c.fill();
        c.fillStyle = _col[0];
        c.beginPath();
        for(var i=0; i<puffs.length; i++){ var p = puffs[i]; c.moveTo(_x + p[0]*_s - 3*_s + p[2]*0.92*_s, _y + p[1]*_s - 2*_s); c.arc(_x + p[0]*_s - 3*_s, _y + p[1]*_s - 2*_s, p[2]*0.92*_s, 0, Math.PI*2); }
        c.fill();
        //平らな底
        c.fillStyle = _col[1];
        c.fillRect(_x - 80*_s, _y + 20*_s, 160*_s, 14*_s);
        c.globalAlpha = 1;
    },
    //横に長い雲(上は暗く、下のふちが光る)
    stratus:function(c,_x,_y,_w,_col,_a){
        c.globalAlpha = _a;
        c.fillStyle = _col[1];
        c.beginPath();
        c.ellipse(_x, _y, _w, 9, 0, 0, Math.PI*2);
        c.ellipse(_x - _w*0.3, _y - 6, _w*0.5, 8, 0, 0, Math.PI*2);
        c.ellipse(_x + _w*0.35, _y - 4, _w*0.4, 7, 0, 0, Math.PI*2);
        c.fill();
        c.fillStyle = _col[0];
        c.beginPath();
        c.ellipse(_x + 6, _y + 5, _w*0.85, 3.5, 0, 0, Math.PI*2);
        c.fill();
        c.globalAlpha = 1;
    },
    //山並み(1周の幅でつながる波を重ねる)
    paint_mount:function(c,_name,P){
        var T = SCENE_TILE, self = this;
        var ridge = function(_base,_amp,_seed,_col,_hi){
            c.fillStyle = _col;
            c.beginPath();
            c.moveTo(0,445);
            for(var x=0; x<=T; x+=8){
                var u = x/T*Math.PI*2;
                var y = _base - _amp*(0.5*Math.sin(u*2 + _seed) + 0.3*Math.sin(u*5 + _seed*2) + 0.2*Math.abs(Math.sin(u*13 + _seed*3)));
                c.lineTo(x,y);
            }
            c.lineTo(T,445);
            c.closePath();
            c.fill();
        };
        if(_name == "war"){
            ridge(SCENE_HZ - 50, 30, 1.3, P.mount[0]);
            ridge(SCENE_HZ - 25, 18, 4.1, P.mount[1]);
        }else{
            ridge(SCENE_HZ - 70, 45, 0.7, P.mount[0]);
            ridge(SCENE_HZ - 35, 22, 2.9, P.mount[1]);
        }
    },
    //遠い街
    paint_far:function(c,_name,P){
        this.city(c, { id:"far", seed:3, base:452, hmin:30, hmax:120, wmin:34, wmax:80, col:P.far, edge:P.farEdge, win:P.farWin, ruin:_name == "war", tallAt:95, winSize:3 });
    },
    //近い街(大きく濃い)。夕方は高架の線路を通す
    paint_near:function(c,_name,P){
        this.city(c, { id:"near", seed:7, base:488, hmin:40, hmax:170, wmin:60, wmax:130, col:P.near, edge:P.nearEdge, win:P.nearWin, ruin:_name == "war", tallAt:140, winSize:5, sparse:0.45 });
        if(_name == "dusk"){
            //高架(柱と桁)
            c.fillStyle = P.near;
            c.fillRect(0, 446, SCENE_TILE, 8);
            for(var x=20; x<SCENE_TILE; x+=96) c.fillRect(x, 454, 7, 40);
            c.fillStyle = P.nearEdge;
            c.fillRect(0, 446, SCENE_TILE, 1.5);
        }
    },
    //建物を並べる(_o：建物の大きさ・色・明かり・壊れているか)
    city:function(c,_o){
        var x = 0, i = 0;
        while(x < SCENE_TILE){
            var w = _o.wmin + (_o.wmax - _o.wmin)*this.rnd(i,_o.seed);
            var h = _o.hmin + (_o.hmax - _o.hmin)*Math.pow(this.rnd(i,_o.seed + 1), 1.5);
            var skip = _o.sparse && this.rnd(i,_o.seed + 5) < _o.sparse;   //近い街は、ところどころ低い建物ですき間をあける
            if(skip) h *= 0.35;
            (function(bx,bw,bh,bi){ bgScene.wrap(bx, bw, function(_x){ bgScene.building(c, _x, bw, bh, bi, _o); }); })(x, w, h, i);
            if(!skip && h > _o.tallAt) this.tall.push({ layer:_o.id, x:x + w/2, y:_o.base - h - (this.rnd(i,_o.seed + 3) < 0.5 ? 14 : 0), ph:this.rnd(i,9)*60 });
            x += w*(0.7 + 0.5*this.rnd(i,_o.seed + 2));
            i++;
        }
    },
    building:function(c,_x,_w,_h,_i,_o){
        var b = _o.base, top = b - _h, r = this.rnd(_i,_o.seed + 3), r2 = this.rnd(_i,_o.seed + 4);
        c.fillStyle = _o.col;
        if(_o.ruin && r2 < 0.55){
            //壊れた建物：上がぎざぎざに欠けている
            c.beginPath();
            c.moveTo(_x, b + 40);
            c.lineTo(_x, top + _h*0.2*r);
            var n = 4;
            for(var k=1; k<=n; k++) c.lineTo(_x + _w*k/n, top + _h*(0.05 + 0.4*this.rnd(_i*7 + k, 5)));
            c.lineTo(_x + _w, b + 40);
            c.closePath();
            c.fill();
        }else{
            c.fillRect(_x, top, _w, _h + 40);
            //屋上の形：段・アンテナ・給水塔
            if(r < 0.3) c.fillRect(_x + _w*0.2, top - _h*0.12, _w*0.6, _h*0.12 + 1);
            else if(r < 0.55){ c.fillRect(_x + _w*0.5 - 1, top - 14, 2, 14); c.fillRect(_x + _w*0.5 - 4, top - 6, 8, 2); }
            else if(r < 0.7){ c.fillRect(_x + _w*0.65, top - 9, 10, 7); c.fillRect(_x + _w*0.65 + 1, top - 2, 1.5, 2); c.fillRect(_x + _w*0.65 + 7.5, top - 2, 1.5, 2); }
        }
        //左から光が当たる明るいふち
        c.fillStyle = _o.edge;
        c.fillRect(_x, top + (_o.ruin && r2 < 0.55 ? _h*0.3 : 0), 2, _h);
        if(!(_o.ruin && r2 < 0.55)) c.fillRect(_x, top, _w, 1.5);
        //窓(明かりの点いた窓・ガラス)
        var s = _o.winSize, gx = s*2.4, gy = s*2.8;
        c.fillStyle = _o.win[0];
        for(var y=top + s*2; y<b - s*2; y+=gy){
            for(var xx=_x + s*1.5; xx<_x + _w - s*2; xx+=gx){
                if(this.rnd(xx*0.37 + y*0.11 + _i, _o.seed + 8) > _o.win[1]) continue;
                c.fillRect(xx, y, s, s*1.3);
            }
        }
    },
    //手前の地面：速く流れる柱(電柱・街灯・杭)で走っている感じを出す
    paint_ground:function(c,_name,P){
        var g = c.createLinearGradient(0,470,0,570);
        g.addColorStop(0,P.ground[0]); g.addColorStop(1,P.ground[1]);
        c.fillStyle = g;
        c.fillRect(0,476,SCENE_TILE,100);
        //道の線
        c.fillStyle = P.line;
        for(var x=0; x<SCENE_TILE; x+=120) c.fillRect(x, 512, 60, 3);
        c.fillStyle = "rgba(0,0,0,0.12)";
        c.fillRect(0,476,SCENE_TILE,3);
        //柱
        for(var i=0; i<8; i++){
            var x = i*SCENE_TILE/8 + 40;
            c.fillStyle = P.post;
            c.fillRect(x, 470 - 70, 5, 110);
            if(_name == "day" || _name == "war"){
                c.fillRect(x - 16, 404, 37, 3);    //電柱の腕
            }else{
                c.fillRect(x, 400, 22, 3);          //街灯
                c.fillStyle = P.line;
                c.fillRect(x + 16, 403, 8, 3);
            }
        }
        //電線(柱をゆるくつなぐ)
        if(_name == "day" || _name == "war"){
            c.strokeStyle = P.post;
            c.lineWidth = 1.2;
            c.beginPath();
            for(var i=0; i<=8; i++){
                var x0 = i*SCENE_TILE/8 + 42, x1 = x0 + SCENE_TILE/8;
                c.moveTo(x0, 405); c.quadraticCurveTo((x0 + x1)/2, 425, x1, 405);
            }
            c.stroke();
        }
    },

    //------------------------------------------------------------------ 動く物
    //星(またたく)
    stars:function(t,_war){
        var ox = this.offX(0.25), oy = this.offY(0.25);
        ctx.fillStyle = "#fff";
        for(var i=0; i<80; i++){
            var x = this.rnd(i,1)*CW + ox, y = this.rnd(i,2)*280 + oy;
            var a = (_war ? 0.3 : 0.5) + 0.45*Math.sin(t*0.03 + i*1.7);
            if(a <= 0.05) continue;
            ctx.globalAlpha = Math.min(1, a);
            var s = this.rnd(i,4) < 0.15 ? 2 : 1.2;
            ctx.fillRect(x,y,s,s);
        }
        ctx.globalAlpha = 1;
    },
    //昼の太陽からゆっくり回る光の筋
    sunRays:function(t){
        ctx.save();
        ctx.translate(800 + this.offX(0.25), 90 + this.offY(0.25));
        ctx.rotate(t*0.0015);
        ctx.fillStyle = "rgba(255,255,235,0.14)";
        for(var i=0; i<10; i++){
            ctx.rotate(Math.PI*2/10);
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(420,-26); ctx.lineTo(420,26); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    },
    //地平線のかすみ(遠いものほど空の色に溶ける)
    haze:function(P){
        var y = SCENE_HZ + this.offY(0.8);
        var g = ctx.createLinearGradient(0, y - 140, 0, y + 10);
        g.addColorStop(0, "rgba(" + P.haze + ",0)");
        g.addColorStop(1, "rgba(" + P.haze + ",0.55)");
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 140, CW, 150);
    },
    //飛行機と飛行機雲(ときどき遠くを横切る)
    plane:function(t){
        var P = 1500, u = (t % P)/P;
        var x = CW + 80 - u*(CW + 400), y = 70 + 20*Math.sin(Math.floor(t/P)) + this.offY(0.4);
        //飛行機雲(後ろほど太く薄い)
        var len = 300;
        var g = ctx.createLinearGradient(x, 0, x + len, 0);
        g.addColorStop(0, "rgba(255,255,255,0.85)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(x + 6, y - 1); ctx.lineTo(x + len, y - 4); ctx.lineTo(x + len, y + 4); ctx.lineTo(x + 6, y + 1); ctx.fill();
        ctx.fillStyle = "#e8eef6";
        ctx.fillRect(x - 6, y - 1.5, 14, 3);
        ctx.fillRect(x + 1, y - 5, 3, 10);
    },
    //鳥の群れ(羽ばたきながら、景色より速く横切る)
    birds:function(t,_dusk){
        var P = _dusk ? 900 : 1300, k = Math.floor(t/P), u = (t % P)/P;
        var bx = CW + 60 - u*(CW + 260), by = (_dusk ? 170 : 150) + 60*this.rnd(k,61) + this.offY(1);
        ctx.strokeStyle = _dusk ? "rgba(40,24,44,0.75)" : "rgba(60,80,100,0.6)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for(var i=0; i<7; i++){
            //先頭から左右へ「く」の字に並ぶ
            var j = Math.ceil(i/2), x = bx + j*17, y = by + (i % 2 ? -1 : 1)*j*9;
            var f = Math.sin(t*0.3 + i*1.3)*4;
            ctx.moveTo(x - 6, y - f); ctx.lineTo(x, y); ctx.lineTo(x + 6, y - f);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
    },
    //航空障害灯(高い建物の上で赤く点滅)と、夜の窓明かり
    lights:function(_id,t){
        if(this.name == "day" || this.name == "war") return;
        var on = (t % 90) < 45;
        if(!on) return;
        var L = this.layer(_id), oy = this.offY(L.depth);
        ctx.fillStyle = "rgba(255,60,50,0.95)";
        for(var i=0; i<this.tall.length; i++){
            var p = this.tall[i];
            if(p.layer != _id) continue;
            var x = this.screenX(_id, p.x);
            if(x == null) continue;
            ctx.fillRect(x - 1.5, p.y + oy - 3, 3, 3);
        }
    },
    //探照灯(地平線から空をゆっくりなでる光)
    searchlights:function(t,_war){
        var n = _war ? 4 : 2;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for(var i=0; i<n; i++){
            var bx = (i + 0.5)*CW/n + 60*Math.sin(i*2.1) + this.offX(0.8), by = SCENE_HZ + this.offY(0.8);
            var a = -Math.PI/2 + 0.55*Math.sin(t*(0.004 + i*0.0013) + i*2);
            var len = 520, w = 0.06;
            var g = ctx.createLinearGradient(bx, by, bx + Math.cos(a)*len, by + Math.sin(a)*len);
            var col = _war ? "255,210,170" : "200,220,255";
            g.addColorStop(0, "rgba(" + col + ",0.28)");
            g.addColorStop(1, "rgba(" + col + ",0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(a - w)*len, by + Math.sin(a - w)*len);
            ctx.lineTo(bx + Math.cos(a + w)*len, by + Math.sin(a + w)*len);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    },
    //高架を走る電車(景色より速く、右から左へ)
    train:function(t){
        var P = 720, u = (t % P)/P, len = 420;
        var x = CW + 40 - u*(CW + len + 400), y = 434 + this.offY(1.3);
        if(x > CW + 40 || x + len < -40) return;
        for(var k=0; k<5; k++){
            var cx = x + k*86;
            ctx.fillStyle = "#2a1f34";
            ctx.fillRect(cx, y, 82, 13);
            ctx.fillStyle = "rgba(255,210,140,0.9)";
            for(var w=0; w<7; w++) ctx.fillRect(cx + 6 + w*11, y + 3, 7, 4);
            ctx.fillStyle = "#8a5a70";
            ctx.fillRect(cx, y, 82, 1.5);
        }
        //先頭の灯り
        ctx.fillStyle = "rgba(255,240,200,0.9)";
        ctx.fillRect(x - 2, y + 6, 3, 3);
    },
    //戦場：地平線のあちこちで光る爆発
    horizonFire:function(t){
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for(var i=0; i<3; i++){
            var P = 140 + i*47, k = Math.floor((t + i*53)/P), u = ((t + i*53) % P)/P;
            if(u > 0.25) continue;
            var x = this.rnd(k*3 + i,71)*CW, y = SCENE_HZ - 6 + this.offY(0.8), a = (1 - u/0.25)*0.6, r = 70 + 50*this.rnd(k,72);
            var g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, "rgba(255,200,120," + a + ")");
            g.addColorStop(1, "rgba(255,90,40,0)");
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r*2, r*2);
        }
        ctx.restore();
    },
    //戦場：遠い街から立ちのぼる煙と、ふもとの炎(遠い街といっしょに流れる)
    smoke:function(t){
        var L = this.layer("far"), oy = this.offY(L.depth);
        for(var i=0; i<6; i++){
            var x = this.screenX("far", i*SCENE_TILE/6 + 130*this.rnd(i,81));
            if(x == null) continue;
            var by = 430 + oy;
            //炎
            ctx.fillStyle = "rgba(255,120,50," + (0.45 + 0.2*Math.sin(t*0.3 + i)) + ")";
            ctx.beginPath(); ctx.ellipse(x, by, 16, 6 + 2*Math.sin(t*0.25 + i*2), 0, 0, Math.PI*2); ctx.fill();
            //煙(風で左へ流れる)
            for(var j=0; j<7; j++){
                var p = ((t*0.5 + j*43 + i*29) % 300)/300;
                ctx.fillStyle = "rgba(34,24,28," + (0.5*(1 - p)) + ")";
                ctx.beginPath(); ctx.arc(x - p*90 + Math.sin(p*5 + i)*10, by - 10 - p*230, 10 + p*36, 0, Math.PI*2); ctx.fill();
            }
        }
    },
    //戦場：高い空を横切る爆撃機の影
    bombers:function(t){
        var P = 1100, u = (t % P)/P;
        var x0 = -60 + u*(CW + 300), y0 = 60 + this.offY(0.4);
        ctx.fillStyle = "rgba(20,14,20,0.75)";
        for(var i=0; i<5; i++){
            var x = x0 - Math.abs(i - 2)*26, y = y0 + (i - 2)*12;
            ctx.beginPath();
            ctx.moveTo(x + 9, y); ctx.lineTo(x - 7, y - 2); ctx.lineTo(x - 7, y + 2); ctx.closePath(); ctx.fill();
            ctx.fillRect(x - 2, y - 7, 3, 14);
        }
    },
    //戦場：空ではじける対空砲火
    flak:function(t){
        for(var i=0; i<4; i++){
            var P = 90 + i*23, k = Math.floor((t + i*31)/P), u = ((t + i*31) % P)/P;
            if(u > 0.5) continue;
            var x = this.rnd(k*5 + i,91)*CW, y = 40 + this.rnd(k*5 + i,92)*200 + this.offY(0.5);
            if(u < 0.06){
                ctx.fillStyle = "rgba(255,230,170," + (1 - u/0.06) + ")";
                ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.fill();
            }
            ctx.fillStyle = "rgba(40,30,34," + (0.55*(1 - u/0.5)) + ")";
            ctx.beginPath(); ctx.arc(x, y, 5 + u*24, 0, Math.PI*2); ctx.fill();
        }
    },
    //戦場：ゆっくり落ちる照明弾と、地上から上がる曳光弾
    flares:function(t){
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var P = 600, k = Math.floor(t/P), u = (t % P)/P;
        var x = 120 + this.rnd(k,101)*(CW - 240), y = 60 + u*220 + this.offY(0.6);
        var a = Math.min(1, u*8)*(1 - u);
        var g = ctx.createRadialGradient(x, y, 0, x, y, 110);
        g.addColorStop(0, "rgba(255,240,200," + (0.6*a) + ")");
        g.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - 110, y - 110, 220, 220);
        //曳光弾(点線で斜めに上がる)
        ctx.fillStyle = "rgba(255,200,120,0.8)";
        for(var i=0; i<3; i++){
            var Q = 200 + i*37, v = ((t + i*71) % Q)/Q;
            if(v > 0.5) continue;
            var sx = 150 + i*300 + this.offX(1), sy = SCENE_HZ + this.offY(1), dir = -1.2 + i*0.25;
            for(var j=0; j<6; j++){
                var d = (v*2)*500 - j*26;
                if(d < 0) continue;
                ctx.fillRect(sx + Math.cos(dir)*d, sy + Math.sin(dir)*d, 2.5, 2.5);
            }
        }
        ctx.restore();
    },
    //戦場：舞い上がる火の粉
    embers:function(t){
        ctx.fillStyle = "rgba(255,140,60,0.7)";
        for(var i=0; i<SCENE_EMBERS; i++){
            var v = 0.4 + this.rnd(i,111)*0.8, H = CH + 40;
            var y = CH + 20 - ((t*v + this.rnd(i,112)*H) % H);
            var x = (this.rnd(i,113)*CW - t*0.6*v + Math.sin(t*0.02 + i)*12) % CW;
            if(x < 0) x += CW;
            var s = 1 + this.rnd(i,114)*1.6;
            ctx.fillRect(x, y, s, s);
        }
    },
    //風の筋(画面の上をすばやく流れる。景色が流れる向きと同じ)
    streaks:function(t,_name){
        var col = _name == "day" ? "255,255,255" : (_name == "dusk" ? "255,220,190" : (_name == "night" ? "190,210,255" : "255,170,120"));
        for(var i=0; i<SCENE_STREAKS; i++){
            var sp = (6 + this.rnd(i,121)*6)*this.flow, len = 80 + this.rnd(i,122)*160, W = CW + len + 200;
            var x = CW + 100 - ((t*sp + this.rnd(i,123)*W) % W);
            var y = 30 + this.rnd(i + Math.floor((t*sp + this.rnd(i,123)*W)/W)*7, 124)*(CH - 60);
            var g = ctx.createLinearGradient(x, 0, x + len, 0);
            g.addColorStop(0, "rgba(" + col + ",0.35)");
            g.addColorStop(1, "rgba(" + col + ",0)");
            ctx.fillStyle = g;
            ctx.fillRect(x, y, len, 1.5);
        }
    }
};
