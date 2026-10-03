//------------------------------------------------------------------------------
//  装備(武器)の定義
//  cd:攻撃間隔(フレーム)。Lv1～3の順。賢さが高いほど短くなる
//------------------------------------------------------------------------------
const WEAPONS = {
    gun:     { name:"実弾",     mark:"弾", color:"#333",
               desc:"近くの敵に弾を撃つ基本装備。",
               lvText:["弾を1発ずつ撃つ","連射速度アップ","2発同時に撃つ"],
               cd:[40,32,26] },
    missile: { name:"ミサイル", mark:"爆", color:"#d62",
               desc:"敵を追いかけて爆発する。群れに強い。",
               lvText:["1発ずつ発射","2発同時に発射","3発同時に発射"],
               cd:[120,105,90] },
    laser:   { name:"レーザー", mark:"光", color:"#d33",
               desc:"一直線上の敵をすべて貫く。燃料を8使う。",
               lvText:["威力2","威力3","威力4"],
               cd:[140,120,100] },
    bug:     { name:"虫射出",   mark:"虫", color:"#3a7",
               desc:"味方の虫を放つ。虫は自分で敵を探して噛みつく。",
               lvText:["虫は最大2匹","虫は最大3匹","虫は最大4匹"],
               cd:[150,130,110] },
    tesla:   { name:"電撃",     mark:"電", color:"#37d",
               desc:"近くの敵に電撃を放ち、周りの敵へ連鎖させる。",
               lvText:["3体に連鎖","4体に連鎖","5体に連鎖"],
               cd:[90,78,66] },
    mine:    { name:"地雷",     mark:"地", color:"#875",
               desc:"移動した跡に地雷をまく。敵が触れると爆発。",
               lvText:["地雷は最大5個","地雷は最大7個","地雷は最大9個"],
               cd:[45,38,30] },
    blade:   { name:"ブレード", mark:"刃", color:"#666",
               desc:"ドローンの周りを刃が回り、触れた敵を切る。",
               lvText:["刃2枚","刃3枚","刃4枚・威力2"],
               cd:[0,0,0] },
    water:   { name:"水鉄砲",   mark:"水", color:"#29a3d6",
               desc:"水をまき続ける。1滴は弱いが、敵を押し返して濡らす(少し遅くなる)。",
               lvText:["水を連射","連射速度アップ","2本同時に水を出す"],
               cd:[7,6,5] },
    emp:     { name:"EMP",      mark:"波", color:"#86c",
               desc:"周りに電磁波を放ち、敵を遅くする。燃料を10使う。",
               lvText:["範囲130・威力1","範囲150・威力2","範囲170・威力3"],
               cd:[220,190,160] }
};
const WEAPON_IDS = Object.keys(WEAPONS);
const MAX_WEAPON_LEVEL = 3;
const SLOT_COST = [0,8,16];     //装備枠を解放するのに必要なパーツ数(1枠目は最初から)
//ショップ(強化画面)：WAVEごとに品ぞろえが変わり、装備をパーツで買える。1WAVEで拾うパーツは序盤10〜30・終盤60〜90くらい
const SHOP_ITEMS = 3;               //並ぶ装備の数
const SHOP_NEW_COST = 20;           //持っていない装備を買う値段(パーツ)
const SHOP_LEVEL_COST = [0,15,25];  //持っている装備をLv.L→L+1にする値段 = SHOP_LEVEL_COST[L]
//撃ったときの効果音(電撃・虫射出はchain・spawnBugの中で鳴らす)
const FIRE_SE = { gun:"shot", missile:"missile", laser:"laser", mine:"mine", emp:"emp", water:"water" };
const WATER_DMG   = 0.35;   //水1滴のダメージ
const WATER_SPEED = 8;
const WATER_LIFE  = 30;     //水が届く距離はおよそ WATER_SPEED × WATER_LIFE
const WATER_PUSH  = 0.22;   //当たった敵を押し返す強さ
const WET_TIME    = 180;    //濡れている時間(3秒)
const LASER_FUEL = 8;
const EMP_FUEL = 10;

//------------------------------------------------------------------------------
//  シナジー(2つを同時に装備すると発動)
//------------------------------------------------------------------------------
const SYNERGIES = [
    { key:"pierce",     a:"gun",     b:"laser",   name:"徹甲弾",   desc:"実弾が敵を3体まで貫通する" },
    { key:"barrage",    a:"gun",     b:"missile", name:"弾幕",     desc:"実弾とミサイルの連射速度+30%" },
    { key:"chain",      a:"missile", b:"mine",    name:"連鎖爆破", desc:"爆発の範囲1.5倍、爆発が地雷を誘爆する" },
    { key:"parasite",   a:"missile", b:"bug",     name:"寄生弾",   desc:"ミサイルで倒した敵から味方の虫が生まれる" },
    { key:"shockbug",   a:"bug",     b:"tesla",   name:"電気虫",   desc:"虫が噛みつくと電撃が連鎖する" },
    { key:"swarm",      a:"bug",     b:"blade",   name:"群れ",     desc:"虫の最大数+2、虫の寿命2倍" },
    { key:"shockblade", a:"blade",   b:"tesla",   name:"放電刃",   desc:"刃が当たると電撃が連鎖する" },
    { key:"lightblade", a:"blade",   b:"laser",   name:"光刃",     desc:"刃が大きくなり、威力2倍" },
    { key:"magnet",     a:"emp",     b:"mine",    name:"磁気地雷", desc:"地雷が近くの敵を引き寄せる" },
    { key:"focus",      a:"emp",     b:"laser",   name:"収束",     desc:"減速中の敵へのレーザー威力2倍" },
    { key:"overload",   a:"emp",     b:"tesla",   name:"過負荷",   desc:"減速中の敵への電撃威力2倍" },
    { key:"short",      a:"water",   b:"tesla",   name:"漏電",     desc:"濡れた敵への電撃が2倍、連鎖が遠くまで届く" },
    { key:"steam",      a:"water",   b:"laser",   name:"水蒸気爆発", desc:"レーザーが濡れた敵に当たると蒸気爆発" }
];

//今の装備で発動しているシナジー
function activeSynergies(){
    return SYNERGIES.filter(function(s){
        return game.slots.indexOf(s.a) >= 0 && game.slots.indexOf(s.b) >= 0;
    });
}
//その装備が関係するシナジー
function synergiesOf(_id){
    return SYNERGIES.filter(function(s){ return s.a == _id || s.b == _id; });
}
function partnerOf(_s,_id){
    return _s.a == _id ? _s.b : _s.a;
}

//装備のアイコン(色付きの四角に一文字)
function drawWeaponIcon(_id,_x,_y,_size){
    var w = WEAPONS[_id];
    ctx.fillStyle = w.color;
    ctx.fillRect(_x,_y,_size,_size);
    ctx.fillStyle = "#fff";
    ctx.font = "bold " + Math.floor(_size*0.6) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(w.mark,_x + _size/2,_y + _size/2 + 1);
    ctx.fillStyle = "#000";
}

//日本語の文章を幅に合わせて折り返して描く。描いた行数を返す
function fillWrapText(_text,_x,_y,_width,_lineHeight){
    var line = "", lines = 0;
    for(var i=0; i<_text.length; i++){
        var c = _text.charAt(i);
        if(ctx.measureText(line + c).width > _width && line != ""){
            ctx.fillText(line,_x,_y + lines*_lineHeight);
            lines++;
            line = "";
        }
        line += c;
    }
    if(line != ""){
        ctx.fillText(line,_x,_y + lines*_lineHeight);
        lines++;
    }
    return lines;
}

//------------------------------------------------------------------------------
//  シナジーの演出
//------------------------------------------------------------------------------
//シナジーごとの色("r,g,b")
const SYN_COLOR = {
    pierce:"255,140,20", barrage:"255,170,30", chain:"255,100,20", parasite:"30,180,90",
    shockbug:"40,150,255", swarm:"30,180,90", shockblade:"40,150,255", lightblade:"235,30,60",
    magnet:"140,80,230", focus:"160,60,255", overload:"140,70,255",
    short:"20,170,230", steam:"90,140,190"
};
var fx = {
    lastShout:{},
    //光の玉
    flare:function(_x,_y,_R,_color,_life){
        effects.push({ flare:true, x:_x, y:_y, R:_R, color:_color, life:_life, maxLife:_life });
    },
    ring:function(_x,_y,_R,_color,_life,_w){
        effects.push({ ring:true, x:_x, y:_y, R:_R, color:_color, life:_life, maxLife:_life, w:_w });
    },
    //光る火花を飛び散らせる
    sparks:function(_x,_y,_n,_color,_speed,_size){
        for(var i=0; i<_n; i++){
            var a = Math.random()*Math.PI*2, s = _speed*(0.4 + Math.random()*0.8);
            effects.push({ x:_x, y:_y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:12 + Math.random()*16, maxLife:28,
                           size:(_size || 3)*(0.6 + Math.random()*0.6), glow:_color });
        }
    },
    line:function(_x,_y,_x2,_y2,_color,_w,_life){
        effects.push({ line:true, x:_x, y:_y, x2:_x2, y2:_y2, color:_color, w:_w, life:_life, maxLife:_life });
    },
    //画面全体をうっすら色づける
    tint:function(_color,_life){
        mainScreen.tint = { color:_color, life:_life, maxLife:_life };
    },
    shake:function(_n){
        mainScreen.shake = Math.max(mainScreen.shake, _n);
    },
    //シナジー発動の掛け声(同じシナジーは_cd フレームに1回まで)
    shout:function(_key,_x,_y,_cd){
        var now = mainScreen.clock;
        if(this.lastShout[_key] != null && now - this.lastShout[_key] < (_cd || 90)) return;
        this.lastShout[_key] = now;
        var s = SYNERGIES.filter(function(s){ return s.key == _key; })[0];
        popup(Math.max(70,Math.min(_x,CW-70)), Math.max(40,_y - 28), s.name + "！", "rgb(" + SYN_COLOR[_key] + ")", true);
        sound.play("synergy");
    }
};

//------------------------------------------------------------------------------
//  戦闘中の装備の動作
//------------------------------------------------------------------------------
var arms = {
    bullets:[],     //実弾
    missiles:[],
    mines:[],
    bugs:[],        //味方の虫
    drops:[],       //水鉄砲の水滴
    beams:[],       //レーザーの描画用
    bolts:[],       //電撃の描画用
    cd:{},          //各装備の次の攻撃までの時間
    syn:{},         //発動中のシナジー(keyがtrue)
    bladeAngle:0,
    chainCount:0,   //連鎖爆破の連鎖数
    chainTimer:0,

    //WAVE開始時に呼ぶ
    reset:function(){
        this.bullets = []; this.missiles = []; this.mines = []; this.bugs = []; this.beams = []; this.bolts = [];
        this.drops = [];
        this.chainCount = 0;
        this.chainTimer = 0;
        fx.lastShout = {};
        this.syn = {};
        var a = activeSynergies();
        for(var i=0; i<a.length; i++) this.syn[a[i].key] = true;
        this.cd = {};
        var eq = this.equipped();
        for(var i=0; i<eq.length; i++) this.cd[eq[i]] = 30 + i*15;  //最初の攻撃は少しずつずらす
        this.reset2();  //追加の装備(armsExtra.js)
    },

    equipped:function(){
        return game.slots.filter(function(id){ return id; });
    },
    has:function(_id){
        return game.slots.indexOf(_id) >= 0;
    },
    level:function(_id){
        return game.owned[_id] || 0;
    },
    //賢さによる攻撃間隔の倍率(Lv1:1.0 ～ Lv5:0.84)
    rate:function(){
        return (0.6 + 0.4 * game.stat("brain") / 70) * (1 - BUFF_RAPID*game.buff("rapid"));
    },
    cooldown:function(_id){
        var c = WEAPONS[_id].cd[this.level(_id)-1] * this.rate();
        if(this.syn.barrage && (_id == "gun" || _id == "missile")) c *= 0.7;
        return c;
    },
    //残りの待ち時間の割合(HUD用)
    charge:function(_id){
        if(_id == "blade" || _id == "barrier") return 1;
        return 1 - Math.max(0,this.cd[_id] || 0) / this.cooldown(_id);
    },

    //一番近い敵(画面内・射程内・除外リストにないもの)
    nearest:function(_x,_y,_range,_exclude){
        var best = _range, target = null;
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead || e.x < 0 || e.x > CW || e.y < 0 || e.y > CH) continue;
            if(_exclude && _exclude.indexOf(e) >= 0) continue;
            var d = Math.hypot(e.x - _x, e.y - _y);
            if(d < best){ best = d; target = e; }
        }
        return target;
    },
    //敵の動きを先読みした角度
    aim:function(_e,_speed){
        var d = Math.hypot(_e.x - drone.X, _e.y - drone.Y);
        var lead = d / _speed;
        return Math.atan2(_e.y + _e.vy*lead - drone.Y, _e.x + _e.vx*lead - drone.X);
    },

    //----------------------------------------------------------------- 更新
    //_firing：戦闘中ならtrue(攻撃する)。弾などはfalseでも動き続ける
    update:function(_firing){
        if(_firing){
            var eq = this.equipped();
            for(var i=0; i<eq.length; i++){
                var id = eq[i];
                if(id == "blade" || id == "barrier") continue;   //いつも動いている装備
                if(this.cd[id] > 0){ this.cd[id]--; continue; }
                //撃てる相手がいなければ待機して、見つかりしだい撃つ
                if(this.fire(id,this.level(id))){
                    this.cd[id] = this.cooldown(id);
                    if(FIRE_SE[id]) sound.play(FIRE_SE[id]);
                }
            }
        }
        this.bladeAngle += 0.08;
        this.updateBlades(_firing);
        this.updateBullets();
        this.updateMissiles();
        this.updateMines();
        this.updateBugs();
        this.updateDrops();
        this.update2(_firing);  //追加の装備(armsExtra.js)
        for(var i=this.beams.length-1; i>=0; i--){ if(--this.beams[i].life <= 0) this.beams.splice(i,1); }
        for(var i=this.bolts.length-1; i>=0; i--){ if(--this.bolts[i].life <= 0) this.bolts.splice(i,1); }
        if(this.chainTimer > 0 && --this.chainTimer == 0) this.chainCount = 0;
    },

    //撃ったらtrue
    fire:function(_id,_lv){
        var range = game.range();
        switch(_id){
            case "gun":
                var t = this.nearest(drone.X,drone.Y,range);
                if(!t) return false;
                var n = _lv >= 3 ? 2 : 1;
                var base = this.aim(t,SHOT_SPEED);
                for(var k=0; k<n; k++){
                    var a = base + (n == 2 ? (k - 0.5)*0.12 : 0);
                    this.bullets.push({ x:drone.X, y:drone.Y, vx:Math.cos(a)*SHOT_SPEED, vy:Math.sin(a)*SHOT_SPEED,
                                        life:60, pierce:this.syn.pierce ? 2 : 0, hit:[] });
                }
                //弾幕：銃口が光る
                if(this.syn.barrage){
                    fx.flare(drone.X + Math.cos(base)*18, drone.Y + Math.sin(base)*18, 18, SYN_COLOR.barrage, 6);
                }
                return true;

            case "missile":
                var t = this.nearest(drone.X,drone.Y,range*1.3);
                if(!t) return false;
                for(var k=0; k<_lv; k++){
                    //いったん上に打ち上げてから敵に向かう
                    var a = -Math.PI/2 + (k - (_lv-1)/2)*0.7 + (Math.random()-0.5)*0.3;
                    this.missiles.push({ x:drone.X, y:drone.Y, ang:a, sp:2, target:t, life:200 });
                }
                if(this.syn.barrage){
                    fx.flare(drone.X, drone.Y - 10, 26, SYN_COLOR.barrage, 8);
                    fx.shout("barrage", drone.X, drone.Y - 20, 480);
                }
                return true;

            case "laser":
                if(mainScreen.fuel < LASER_FUEL) return false;
                var t = this.nearest(drone.X,drone.Y,range*1.5);
                if(!t) return false;
                mainScreen.fuel -= LASER_FUEL;
                var dx = t.x - drone.X, dy = t.y - drone.Y, d = Math.hypot(dx,dy) || 1;
                dx /= d; dy /= d;
                var focused = false, steamHits = [];
                for(var i=0; i<enemies.length; i++){
                    var e = enemies[i];
                    var rx = e.x - drone.X, ry = e.y - drone.Y;
                    //ドローンより前方で、光線からの距離が近い敵に当たる
                    if(rx*dx + ry*dy < 0) continue;
                    if(Math.abs(rx*dy - ry*dx) < e.r + 6){
                        var m = 1;
                        if(this.syn.focus && e.slow > 0){
                            //収束：減速中の敵で光が弾ける
                            m = 2;
                            focused = true;
                            fx.flare(e.x, e.y, 40, SYN_COLOR.focus, 16);
                            fx.sparks(e.x, e.y, 10, SYN_COLOR.focus, 6, 3);
                            fx.ring(e.x, e.y, 34, SYN_COLOR.focus, 12, 4);
                        }
                        //集光：渦の中の敵には2倍
                        if(this.syn.lens && this.inWell(e)){
                            m *= 2;
                            fx.flare(e.x, e.y, 30, SYN_COLOR.lens, 12);
                            fx.shout("lens", e.x, e.y);
                        }
                        if(this.syn.steam && e.wet > 0) steamHits.push(e);
                        mainScreen.hitEnemy(e,(_lv+1)*m,"laser");
                    }
                }
                this.beams.push({ x:drone.X, y:drone.Y, dx:dx, dy:dy, life:focused ? 20 : 14, w:_lv+3, focus:focused });
                if(focused){
                    fx.shout("focus", drone.X, drone.Y);
                    fx.shake(5);
                }
                //水蒸気爆発：濡れていた敵が蒸発して周りを巻き込む
                for(var i=0; i<steamHits.length; i++) this.steamBurst(steamHits[i]);
                return true;

            case "bug":
                var max = _lv + 1 + (this.syn.swarm ? 2 : 0);
                if(this.bugs.length >= max) return false;
                this.spawnBug(drone.X,drone.Y);
                return true;

            case "tesla":
                var t = this.nearest(drone.X,drone.Y,200);
                if(!t) return false;
                this.chain(drone.X,drone.Y,t,_lv+2,[],null);
                return true;

            case "mine":
                if(drone.Speed < 1) return false;  //動いているときだけまく
                if(this.mines.length >= [5,7,9][_lv-1]) this.mines.shift();
                this.mines.push({ x:drone.X, y:drone.Y, arm:30, t:0, boom:false });
                return true;

            case "water":
                //射程は短め。水はばらつきながら飛ぶ
                var t = this.nearest(drone.X,drone.Y,WATER_SPEED*WATER_LIFE + 20);
                if(!t) return false;
                var base = this.aim(t,WATER_SPEED);
                var n = _lv >= 3 ? 2 : 1;
                for(var k=0; k<n; k++){
                    var a = base + (n == 2 ? (k - 0.5)*0.16 : 0) + (Math.random() - 0.5)*0.07;
                    var sp = WATER_SPEED*(0.9 + Math.random()*0.2);
                    this.drops.push({ x:drone.X + Math.cos(a)*14, y:drone.Y + Math.sin(a)*14,
                                      vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:WATER_LIFE, size:2.5 + Math.random()*1.5 });
                }
                return true;

            case "emp":
                var R = [130,150,170][_lv-1];
                if(!this.nearest(drone.X,drone.Y,R)) return false;
                if(mainScreen.fuel < EMP_FUEL) return false;
                mainScreen.fuel -= EMP_FUEL;
                for(var i=0; i<enemies.length; i++){
                    var e = enemies[i];
                    if(Math.hypot(e.x - drone.X, e.y - drone.Y) < R + e.r){
                        e.slow = 150;
                        mainScreen.hitEnemy(e,_lv,"emp");
                    }
                }
                effects.push({ ring:true, x:drone.X, y:drone.Y, life:18, maxLife:18, R:R, color:"130,90,200" });
                return true;
        }
        return this.fire2(_id,_lv);     //追加の装備(armsExtra.js)
    },

    //電撃：_firstから近くの敵へ次々に飛び移る
    //_synKey：シナジーから出た電撃なら"shockbug"・"shockblade"(色と太さが変わる)
    chain:function(_x,_y,_first,_jumps,_exclude,_synKey){
        var pts = [{x:_x, y:_y}], hit = _exclude.slice(), cur = _first;
        var overload = false, shorted = false;
        for(var j=0; j<_jumps && cur; j++){
            var m = 1, reach = 130;
            if(this.syn.overload && cur.slow > 0){ m *= 2; overload = true; }
            //漏電：濡れた敵には2倍で、そこから遠くまで飛び移る
            if(this.syn.short && cur.wet > 0){ m *= 2; reach = 195; shorted = true; }
            //超伝導：凍った敵には1.5倍で、そこから遠くまで飛び移る
            if(this.syn.superconduct && cur.frozen > 0){ m *= 1.5; reach = 195; fx.flare(cur.x, cur.y, 26, SYN_COLOR.superconduct, 10); fx.shout("superconduct", cur.x, cur.y); }
            pts.push({x:cur.x, y:cur.y});
            hit.push(cur);
            mainScreen.hitEnemy(cur,m,"tesla");
            cur = this.nearest(cur.x,cur.y,reach,hit);
        }
        if(pts.length < 2) return;
        //過負荷は紫の極太、漏電は水色、シナジーの電撃は青く光る太め、普通の電撃は細い青
        var key = overload ? "overload" : (shorted ? "short" : _synKey);
        var bolt = { pts:pts, life:key ? 14 : 10, maxLife:key ? 14 : 10,
                     color:key ? SYN_COLOR[key] : "50,110,220", w:overload ? 5 : (key ? 3.5 : 2), glow:!!key };
        this.bolts.push(bolt);
        if(key){
            for(var i=1; i<pts.length; i++){
                fx.flare(pts[i].x, pts[i].y, overload ? 38 : 26, SYN_COLOR[key], 12);
                fx.sparks(pts[i].x, pts[i].y, overload ? 8 : 5, SYN_COLOR[key], 5, 2.5);
            }
            fx.shout(key, pts[1].x, pts[1].y);
            if(overload) fx.shake(4);
        }
        sound.play("zap");
    },
    //水蒸気爆発：半径60の敵に2ダメージ。白い蒸気がもくもく広がる
    steamBurst:function(_e){
        var x = _e.x, y = _e.y;
        _e.wet = 0;
        for(var i=0; i<enemies.length; i++){
            var o = enemies[i];
            if(Math.hypot(o.x - x, o.y - y) < 60 + o.r) mainScreen.hitEnemy(o,2,"steam");
        }
        fx.flare(x, y, 70, "200,215,230", 22);
        fx.ring(x, y, 70, SYN_COLOR.steam, 16, 6);
        for(var i=0; i<14; i++){
            var a = Math.random()*Math.PI*2, s = 1.5 + Math.random()*3;
            effects.push({ x:x, y:y, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 0.8, life:24 + Math.random()*16, maxLife:40,
                           size:5 + Math.random()*4, glow:"170,190,210" });
        }
        fx.shake(5);
        fx.shout("steam", x, y);
        sound.play("steam");
    },

    //_eに当たったあと、周りの敵に連鎖させる(シナジー用)
    chainFrom:function(_e,_jumps,_synKey){
        var next = this.nearest(_e.x,_e.y,130,[_e]);
        if(next) this.chain(_e.x,_e.y,next,_jumps,[_e],_synKey);
    },

    explode:function(_x,_y,_R,_dmg,_src){
        if(this.syn.chain) _R *= 1.5;
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(Math.hypot(e.x - _x, e.y - _y) < _R + e.r) mainScreen.hitEnemy(e,_dmg,_src);
        }
        if(this.syn.chain){
            //連鎖爆破：範囲内の地雷も少し遅れて爆発する(導火線でつなぐ)
            for(var i=0; i<this.mines.length; i++){
                var m = this.mines[i];
                if(!m.boom && Math.hypot(m.x - _x, m.y - _y) < _R){
                    m.boom = true;
                    m.fuse = 6;
                    m.fromX = _x; m.fromY = _y;
                }
            }
            //大きな火の玉・二重の衝撃波・飛び散る火花
            fx.flare(_x, _y, _R*1.1, SYN_COLOR.chain, 20);
            fx.ring(_x, _y, _R*1.3, SYN_COLOR.chain, 22, 8);
            fx.ring(_x, _y, _R*0.8, "255,200,60", 14, 4);
            fx.sparks(_x, _y, 16, SYN_COLOR.chain, 7, 3.5);
            fx.shake(6);
        }else{
            effects.push({ ring:true, x:_x, y:_y, life:16, maxLife:16, R:_R, color:"230,120,40" });
        }
        burst(_x,_y,10,"#e84");
        sound.play("explode");
        //ナパーム・焼夷地雷：爆発の跡がしばらく燃える(armsExtra.js)
        if(this.syn.napalm && _src == "missile") this.addField(_x,_y,_R*0.8,"napalm");
        if(this.syn.incendiary && _src == "mine") this.addField(_x,_y,_R*0.8,"incendiary");
    },

    spawnBug:function(_x,_y){
        this.bugs.push({ x:_x, y:_y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4,
                         life:this.syn.swarm ? 1440 : 720, bite:0, t:Math.floor(Math.random()*100) });
        sound.play("bug");
    },

    //敵を倒したときに呼ばれる
    onKill:function(_e,_src){
        if(this.syn.parasite && _src == "missile"){
            //寄生弾：倒した敵から緑の飛沫とともに虫が生まれる
            this.spawnBug(_e.x,_e.y);
            fx.flare(_e.x, _e.y, 36, SYN_COLOR.parasite, 16);
            fx.sparks(_e.x, _e.y, 14, SYN_COLOR.parasite, 5, 3);
            fx.ring(_e.x, _e.y, 30, SYN_COLOR.parasite, 12, 3);
            fx.shout("parasite", _e.x, _e.y);
        }
        this.onKill2(_e);   //追加の装備(armsExtra.js)
    },

    updateBullets:function(){
        for(var i=0; i<this.bullets.length; i++){
            var b = this.bullets[i];
            b.x += b.vx; b.y += b.vy; b.life--;
            if(b.x < -10 || b.x > CW+10 || b.y < -10 || b.y > CH+10) b.life = 0;
            for(var j=0; j<enemies.length && b.life > 0; j++){
                var e = enemies[j];
                if(e.dead || b.hit.indexOf(e) >= 0) continue;
                if(Math.hypot(e.x - b.x, e.y - b.y) < e.r + 3){
                    mainScreen.hitEnemy(e,this.gunDmg(),"gun");    //照準の間は2倍(armsExtra.js)
                    b.hit.push(e);
                    if(this.syn.pierce){
                        //徹甲弾：当たるたびに火花。2体目以降を貫くと大きく弾ける
                        var big = b.hit.length >= 2;
                        fx.sparks(b.x, b.y, big ? 9 : 4, SYN_COLOR.pierce, big ? 6 : 4, 2.5);
                        fx.flare(b.x, b.y, big ? 30 : 16, SYN_COLOR.pierce, 8);
                        if(big) fx.shout("pierce", e.x, e.y);
                    }
                    if(b.pierce > 0) b.pierce--;
                    else b.life = 0;
                }
            }
        }
        this.bullets = this.bullets.filter(function(b){ return b.life > 0; });
    },

    updateMissiles:function(){
        for(var i=0; i<this.missiles.length; i++){
            var m = this.missiles[i];
            if(!m.target || m.target.dead) m.target = this.nearest(m.x,m.y,9999);
            if(m.target){
                //少しずつ敵の方へ曲がる
                var diff = Math.atan2(m.target.y - m.y, m.target.x - m.x) - m.ang;
                while(diff > Math.PI) diff -= Math.PI*2;
                while(diff < -Math.PI) diff += Math.PI*2;
                m.ang += Math.max(-0.12, Math.min(0.12, diff));
            }
            m.sp = Math.min(7, m.sp + 0.2);
            m.x += Math.cos(m.ang)*m.sp;
            m.y += Math.sin(m.ang)*m.sp;
            m.life--;
            if(this.syn.barrage){
                //弾幕：炎の尾を引く
                effects.push({ x:m.x - Math.cos(m.ang)*6, y:m.y - Math.sin(m.ang)*6,
                               vx:(Math.random()-0.5)*0.8, vy:(Math.random()-0.5)*0.8,
                               life:10 + Math.random()*6, maxLife:16, size:3.5, glow:SYN_COLOR.barrage });
                if(m.life % 3 == 0) effects.push({ x:m.x, y:m.y, vx:0, vy:0, life:18, maxLife:36, size:4, color:"#ccc" });
            }else if(m.life % 3 == 0){
                effects.push({ x:m.x, y:m.y, vx:0, vy:0, life:14, maxLife:28, size:3, color:"#bbb" });
            }
            if(m.target && Math.hypot(m.target.x - m.x, m.target.y - m.y) < m.target.r + 5){
                this.explode(m.x,m.y,50,2,"missile");
                m.life = 0;
            }else if(m.life <= 0){
                this.explode(m.x,m.y,50,2,"missile");
            }else if(m.x < -100 || m.x > CW+100 || m.y < -100 || m.y > CH+100){
                m.life = 0;
            }
        }
        this.missiles = this.missiles.filter(function(m){ return m.life > 0; });
    },

    updateMines:function(){
        for(var i=this.mines.length-1; i>=0; i--){
            var m = this.mines[i];
            m.t++;
            if(m.arm > 0) m.arm--;
            if(m.boom){
                //誘爆した地雷は導火線が燃え移ってから爆発する
                if(m.fuse > 0){
                    if(m.fuse == 6) fx.line(m.fromX, m.fromY, m.x, m.y, SYN_COLOR.chain, 5, 14);
                    m.fuse--;
                    continue;
                }
                this.mines.splice(i,1);
                if(m.fromX != null){
                    //連鎖が続くほど大きく表示し、画面が色づく
                    this.chainCount++;
                    this.chainTimer = 40;
                    fx.shout("chain", m.x, m.y, 120);
                    if(this.chainCount >= 2){
                        popup(m.x, m.y - 64, "連鎖×" + (this.chainCount + 1), "rgb(" + SYN_COLOR.chain + ")", true);
                    }
                    if(this.chainCount >= 3) fx.tint(SYN_COLOR.chain, 16);
                }
                if(m.pulled) fx.shout("magnet", m.x, m.y);
                this.explode(m.x,m.y,60,3,"mine");
                continue;
            }
            if(m.arm > 0) continue;
            //磁気地雷：周りから光の粒が吸い込まれていく
            if(this.syn.magnet && m.t % 4 == 0){
                var a = Math.random()*Math.PI*2;
                effects.push({ x:m.x + Math.cos(a)*110, y:m.y + Math.sin(a)*110, vx:-Math.cos(a)*9, vy:-Math.sin(a)*9,
                               life:12, maxLife:12, size:2.5, glow:SYN_COLOR.magnet });
            }
            for(var j=0; j<enemies.length; j++){
                var e = enemies[j];
                if(e.dead) continue;
                var d = Math.hypot(m.x - e.x, m.y - e.y);
                //磁気地雷：近くの敵を引き寄せる
                if(this.syn.magnet && d < 130 && d > 1 && !e.boss){
                    e.x += (m.x - e.x)/d*0.9;
                    e.y += (m.y - e.y)/d*0.9;
                    m.pulled = true;
                    if(m.t % 10 == 0) fx.line(m.x, m.y, e.x, e.y, SYN_COLOR.magnet, 2, 8);
                }
                if(d < e.r + 10) m.boom = true;
            }
        }
    },

    updateBugs:function(){
        for(var i=0; i<this.bugs.length; i++){
            var b = this.bugs[i];
            b.t++;
            b.life--;
            if(b.bite > 0) b.bite--;
            var t = this.nearest(b.x,b.y,9999);
            var tx, ty;
            if(t){
                tx = t.x; ty = t.y;
            }else{
                //敵がいなければドローンの周りを飛ぶ
                tx = drone.X + Math.cos(b.t*0.05)*40;
                ty = drone.Y + Math.sin(b.t*0.05)*40;
            }
            var dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx,dy) || 1;
            b.vx += (dx/d*3.2 - b.vx)*0.08;
            b.vy += (dy/d*3.2 - b.vy)*0.08;
            b.x += b.vx; b.y += b.vy;
            //群れ：虫が緑の光の尾を引く
            if(this.syn.swarm && b.t % 3 == 0){
                effects.push({ x:b.x, y:b.y, vx:0, vy:0, life:14, maxLife:14, size:2.5, glow:SYN_COLOR.swarm });
            }
            if(t && b.bite <= 0 && d < t.r + 6){
                mainScreen.hitEnemy(t,1,"bug");
                b.bite = 30;
                b.vx = -dx/d*3; b.vy = -dy/d*3;
                if(this.syn.shockbug){
                    fx.flare(t.x, t.y, 24, SYN_COLOR.shockbug, 10);
                    this.chainFrom(t,2,"shockbug");
                }
                if(this.syn.swarm && b.t % 2 == 0) fx.shout("swarm", b.x, b.y, 240);
            }
        }
        this.bugs = this.bugs.filter(function(b){ return b.life > 0; });
    },

    //水滴：当たると少しダメージ・押し返す・濡らす
    updateDrops:function(){
        for(var i=0; i<this.drops.length; i++){
            var w = this.drops[i];
            w.x += w.vx; w.y += w.vy;
            w.life--;
            for(var j=0; j<enemies.length && w.life > 0; j++){
                var e = enemies[j];
                if(e.dead) continue;
                if(Math.hypot(e.x - w.x, e.y - w.y) < e.r + w.size){
                    mainScreen.hitEnemy(e,WATER_DMG,"water");
                    e.wet = WET_TIME;
                    if(!e.boss){ e.x += w.vx*WATER_PUSH; e.y += w.vy*WATER_PUSH; }
                    //しぶき
                    for(var s=0; s<2; s++){
                        effects.push({ x:w.x, y:w.y, vx:-w.vx*0.2 + (Math.random()-0.5)*3, vy:-w.vy*0.2 + (Math.random()-0.5)*3,
                                       life:10, maxLife:10, size:2, glow:"41,163,214" });
                    }
                    w.life = 0;
                }
            }
        }
        this.drops = this.drops.filter(function(w){ return w.life > 0; });
    },

    bladeInfo:function(){
        var big = this.syn.lightblade;
        var lv = this.level("blade");
        var dmg = lv >= 3 ? 2 : 1;
        return { n:lv + 1, R:big ? 80 : 62, size:big ? 18 : 13, dmg:big ? dmg*2 : dmg };
    },
    updateBlades:function(_active){
        for(var i=0; i<enemies.length; i++){
            if(enemies[i].bladeCd > 0) enemies[i].bladeCd--;
        }
        if(!_active || !this.has("blade")) return;
        var B = this.bladeInfo();
        for(var k=0; k<B.n; k++){
            var a = this.bladeAngle + k*Math.PI*2/B.n;
            var bx = drone.X + Math.cos(a)*B.R, by = drone.Y + Math.sin(a)*B.R;
            for(var i=0; i<enemies.length; i++){
                var e = enemies[i];
                if(e.dead || e.bladeCd > 0) continue;
                if(Math.hypot(e.x - bx, e.y - by) < e.r + B.size){
                    e.bladeCd = 20;  //同じ敵に連続で当たりすぎないように
                    mainScreen.hitEnemy(e,B.dmg,"blade");
                    sound.play("blade");
                    if(this.syn.lightblade){
                        //光刃：赤い閃光と切り裂く線
                        fx.flare(bx, by, 34, SYN_COLOR.lightblade, 10);
                        fx.sparks(bx, by, 8, SYN_COLOR.lightblade, 6, 3);
                        var ca = a + Math.PI/2;
                        fx.line(e.x - Math.cos(ca)*30, e.y - Math.sin(ca)*30, e.x + Math.cos(ca)*30, e.y + Math.sin(ca)*30,
                                SYN_COLOR.lightblade, 5, 10);
                        fx.shout("lightblade", e.x, e.y);
                    }
                    if(this.syn.shockblade) this.chainFrom(e,2,"shockblade");
                }
            }
        }
    },

    //----------------------------------------------------------------- 描画
    draw:function(_showBlades){
        this.draw2(_showBlades);    //追加の装備(armsExtra.js。地面の炎・渦などは下に描く)
        //地雷
        for(var i=0; i<this.mines.length; i++){
            var m = this.mines[i];
            if(this.syn.magnet && m.arm <= 0){
                //磁気地雷：回転しながら縮んでいく渦
                ctx.strokeStyle = "rgba(" + SYN_COLOR.magnet + ",0.15)";
                ctx.beginPath(); ctx.arc(m.x,m.y,130,0,Math.PI*2); ctx.stroke();
                ctx.lineWidth = 2;
                for(var s=0; s<3; s++){
                    var ph = ((m.t*0.02 + s/3) % 1);
                    ctx.strokeStyle = "rgba(" + SYN_COLOR.magnet + "," + (0.5*ph) + ")";
                    ctx.beginPath();
                    ctx.arc(m.x,m.y,10 + 110*(1 - ph), m.t*0.08 + s*2.1, m.t*0.08 + s*2.1 + 1.6);
                    ctx.stroke();
                }
                ctx.lineWidth = 1;
            }
            ctx.fillStyle = "#875";
            ctx.beginPath(); ctx.arc(m.x,m.y,7,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = (m.arm <= 0 && Math.floor(m.t/15) % 2 == 0) ? "#f33" : "#533";
            ctx.fillRect(m.x-2,m.y-2,4,4);
        }

        //味方の虫(緑)
        for(var i=0; i<this.bugs.length; i++){
            var b = this.bugs[i];
            if(b.life < 90 && Math.floor(b.life/5) % 2 == 0) continue;  //寿命が近いと点滅
            var wing = 2 + Math.abs(Math.sin(b.t*0.6))*4;
            ctx.fillStyle = "rgba(60,170,110,0.5)";
            ctx.beginPath(); ctx.ellipse(b.x-4,b.y-3,wing,2.5,-0.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(b.x+4,b.y-3,wing,2.5,0.5,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "#2a6";
            ctx.beginPath(); ctx.arc(b.x,b.y,5,0,Math.PI*2); ctx.fill();
        }

        //ミサイル
        for(var i=0; i<this.missiles.length; i++){
            var m = this.missiles[i];
            ctx.save();
            ctx.translate(m.x,m.y);
            ctx.rotate(m.ang);
            ctx.fillStyle = "#d62";
            ctx.fillRect(-7,-2.5,11,5);
            ctx.fillStyle = "#333";
            ctx.beginPath(); ctx.moveTo(4,-2.5); ctx.lineTo(8,0); ctx.lineTo(4,2.5); ctx.fill();
            ctx.restore();
        }

        //水鉄砲の水(水色のしずく＋短い尾＋白いつや)
        for(var i=0; i<this.drops.length; i++){
            var w = this.drops[i];
            ctx.strokeStyle = "rgba(41,163,214,0.35)";
            ctx.lineWidth = w.size*1.6;
            ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(w.x,w.y); ctx.lineTo(w.x - w.vx*1.2, w.y - w.vy*1.2); ctx.stroke();
            ctx.fillStyle = "#29a3d6";
            ctx.beginPath(); ctx.arc(w.x,w.y,w.size,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.beginPath(); ctx.arc(w.x - w.size*0.3,w.y - w.size*0.3,w.size*0.35,0,Math.PI*2); ctx.fill();
        }
        ctx.lineCap = "butt";
        ctx.lineWidth = 1;

        //実弾(徹甲弾はオレンジに光る長い曳光弾)
        if(this.syn.pierce){
            ctx.lineCap = "round";
            for(var pass=0; pass<2; pass++){
                ctx.strokeStyle = pass == 0 ? "rgba(" + SYN_COLOR.pierce + ",0.3)" : "rgb(" + SYN_COLOR.pierce + ")";
                ctx.lineWidth = pass == 0 ? 9 : 3.5;
                ctx.beginPath();
                for(var i=0; i<this.bullets.length; i++){
                    var s = this.bullets[i];
                    ctx.moveTo(s.x,s.y);
                    ctx.lineTo(s.x - s.vx*2, s.y - s.vy*2);
                }
                ctx.stroke();
            }
            ctx.lineCap = "butt";
        }else{
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 3;
            ctx.beginPath();
            for(var i=0; i<this.bullets.length; i++){
                var s = this.bullets[i];
                ctx.moveTo(s.x,s.y);
                ctx.lineTo(s.x - s.vx*0.8, s.y - s.vy*0.8);
            }
            ctx.stroke();
        }
        ctx.lineWidth = 1;

        //ブレード
        if(_showBlades && this.has("blade")){
            var B = this.bladeInfo();
            for(var k=0; k<B.n; k++){
                var a = this.bladeAngle + k*Math.PI*2/B.n;
                var bx = drone.X + Math.cos(a)*B.R, by = drone.Y + Math.sin(a)*B.R;
                if(this.syn.lightblade){
                    //光刃：赤い光のにじみと、回転の軌跡の残像
                    var g = ctx.createRadialGradient(bx,by,0,bx,by,B.size*2);
                    g.addColorStop(0,"rgba(" + SYN_COLOR.lightblade + ",0.45)");
                    g.addColorStop(1,"rgba(" + SYN_COLOR.lightblade + ",0)");
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(bx,by,B.size*2,0,Math.PI*2); ctx.fill();
                    ctx.lineCap = "round";
                    for(var s=1; s<=4; s++){
                        ctx.strokeStyle = "rgba(" + SYN_COLOR.lightblade + "," + (0.35 - s*0.07) + ")";
                        ctx.lineWidth = B.size*0.9 - s*2;
                        ctx.beginPath(); ctx.arc(drone.X,drone.Y,B.R,a - s*0.13,a - (s-1)*0.13); ctx.stroke();
                    }
                    ctx.lineCap = "butt";
                    ctx.lineWidth = 1;
                }
                if(this.syn.shockblade){
                    //放電刃：刃の周りでパチパチと放電
                    ctx.strokeStyle = "rgba(" + SYN_COLOR.shockblade + ",0.9)";
                    ctx.lineWidth = 1.5;
                    for(var s=0; s<2; s++){
                        var sa = Math.random()*Math.PI*2, r1 = B.size*0.6, r2 = B.size*1.6;
                        ctx.beginPath();
                        ctx.moveTo(bx + Math.cos(sa)*r1, by + Math.sin(sa)*r1);
                        ctx.lineTo(bx + Math.cos(sa + 0.4)*(r1 + r2)/2 + (Math.random()-0.5)*6, by + Math.sin(sa + 0.4)*(r1 + r2)/2 + (Math.random()-0.5)*6);
                        ctx.lineTo(bx + Math.cos(sa)*r2, by + Math.sin(sa)*r2);
                        ctx.stroke();
                    }
                    ctx.lineWidth = 1;
                }
                ctx.save();
                ctx.translate(bx,by);
                ctx.rotate(a + this.bladeAngle*3);
                ctx.fillStyle = this.syn.lightblade ? "rgb(" + SYN_COLOR.lightblade + ")" : (this.syn.shockblade ? "#2a5fa8" : "#555");
                ctx.beginPath();
                ctx.moveTo(B.size,0); ctx.lineTo(0,B.size*0.35); ctx.lineTo(-B.size,0); ctx.lineTo(0,-B.size*0.35);
                ctx.closePath(); ctx.fill();
                ctx.restore();
            }
        }

        //レーザー(収束が起きたビームは紫の極太)
        for(var i=0; i<this.beams.length; i++){
            var L = this.beams[i];
            var k = L.life/(L.focus ? 20 : 14);
            var ex = L.x + L.dx*1200, ey = L.y + L.dy*1200;
            ctx.beginPath(); ctx.moveTo(L.x,L.y); ctx.lineTo(ex,ey);
            if(L.focus){
                ctx.strokeStyle = "rgba(" + SYN_COLOR.focus + "," + (0.25*k) + ")";
                ctx.lineWidth = L.w*7*k + 2;
                ctx.stroke();
                ctx.strokeStyle = "rgba(" + SYN_COLOR.focus + "," + k + ")";
                ctx.lineWidth = L.w*2.5*k + 1;
                ctx.stroke();
            }else{
                ctx.strokeStyle = "rgba(230,40,40," + k + ")";
                ctx.lineWidth = L.w*2*k + 1;
                ctx.stroke();
            }
            ctx.strokeStyle = "rgba(255,255,255," + k + ")";
            ctx.lineWidth = Math.max(1,L.w*0.6*k);
            ctx.stroke();
        }
        ctx.lineWidth = 1;

        //電撃(ギザギザの線。シナジーの電撃は光のにじみ付きで太い)
        for(var i=0; i<this.bolts.length; i++){
            var bolt = this.bolts[i];
            var p = bolt.pts;
            var jitter = bolt.glow ? 20 : 14;
            ctx.beginPath();
            ctx.moveTo(p[0].x,p[0].y);
            for(var j=1; j<p.length; j++){
                var ax = p[j-1].x, ay = p[j-1].y;
                for(var s=1; s<=5; s++){
                    var jit = s < 5 ? (Math.random()-0.5)*jitter : 0;
                    ctx.lineTo(ax + (p[j].x - ax)*s/5 + jit, ay + (p[j].y - ay)*s/5 + jit);
                }
            }
            var a = bolt.life/bolt.maxLife;
            if(bolt.glow){
                ctx.strokeStyle = "rgba(" + bolt.color + "," + (0.25*a) + ")";
                ctx.lineWidth = bolt.w*4;
                ctx.stroke();
            }
            ctx.strokeStyle = "rgba(" + bolt.color + "," + a + ")";
            ctx.lineWidth = bolt.w;
            ctx.stroke();
        }
        ctx.lineWidth = 1;
    }
};
