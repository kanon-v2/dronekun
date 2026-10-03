//------------------------------------------------------------------------------
//  追加の装備：火炎放射・円盤・重力弾・バリア・狙撃・冷凍
//  equipment.js の WEAPONS・SYNERGIES・arms に足す(equipment.js のすぐあとに読み込む)。
//  arms.update・fire・reset・draw などから、ここの update2・fire2・reset2・draw2 を呼ぶ。
//  敵の状態：burn(燃えている残りフレーム)・frozen(凍っている残りフレーム)。
//    燃えている敵が削れるのはホスト(とひとり用・対戦の攻撃側)だけで数える(ゲストでも数えると2重になる)。
//    凍った敵は動かず攻撃もしない。次の一撃は2倍で氷が砕ける(mainScreen.hitEnemy)。ボスは凍らず遅くなるだけ。
//------------------------------------------------------------------------------
//火炎放射
const FIRE_RANGE = [90,110,130];    //炎が届く距離(px。レベルごと)
const FIRE_DMG = 0.2;               //炎1つが当たったときのダメージ
const BURN_TIME = [120,180,240];    //燃えている時間(フレーム。レベルごと)
const BURN_TICK = 20;               //燃えている敵が削れる間隔(フレーム)
const BURN_DMG = 0.35;              //燃えている敵が1回に削れる量
const FIELD_TIME = 180;             //ナパーム・焼夷地雷の炎が残る時間(フレーム)
const VEIL_R = 55;                  //蒸気幕が敵の弾を消す範囲(px)
//円盤
const DISC_SPEED = 9;               //投げたときの速さ
const DISC_BRAKE = 0.22;            //行きで速さが落ちる量(1フレームあたり。戻るまでにおよそ180px飛ぶ)
const DISC_DMG = 1.8;
//重力弾
const WELL_TIME = [120,150,180];    //渦が続く時間(フレーム。レベルごと)
const WELL_R = 110;                 //吸い寄せる範囲(px)
const WELL_PULL = [1.0,1.0,1.4];    //吸い寄せる強さ(px/フレーム。レベルごと)
const WELL_DMG = 0.6;               //渦の中心の敵が削れる量(15フレームごと)
//バリア
const BARRIER_N = [2,3,4];          //板の数(レベルごと)
const BARRIER_REGEN = [300,260,220];//板が戻るまでの時間(フレーム。レベルごと)
const BARRIER_R = 36;               //板が回る半径(px)
const VS_BARRIER_ABSORB = 8;        //対戦：板1枚で防ぐダメージ(相手の画面で数えたダメージから引く)
//狙撃
const SNIPE_DMG = [5,7,9];          //威力(レベルごと)
const MARK_TIME = 120;              //照準：実弾の威力が上がる時間(フレーム)
//冷凍
const FREEZE_TIME = [60,80,100];    //凍っている時間(フレーム。レベルごと)
const FREEZE_PARTNER = 80;          //協力プレイ：相方が凍らせた敵の凍る時間(相方のレベルはわからないので真ん中)
const ICE_SPEED = 7;
const ICE_DMG = 0.8;                //冷気の弾1発のダメージ

Object.assign(WEAPONS, {
    fire:    { name:"火炎放射", mark:"炎", color:"#e8571c",
               desc:"近くの敵へ炎を吹き続ける。当たった敵は燃えて少しずつ削れる。",
               lvText:["炎が届く距離90","届く距離110・長く燃える","届く距離130・もっと長く燃える"],
               cd:[6,5,4] },
    disc:    { name:"円盤",     mark:"盤", color:"#2a9d8f",
               desc:"円盤を投げる。敵を貫いて飛び、戻ってくるときにも当たる。",
               lvText:["円盤1枚","投げる間隔が短くなる","円盤2枚"],
               cd:[75,65,56] },
    gravity: { name:"重力弾",   mark:"引", color:"#5b3fa6",
               desc:"ゆっくり飛ぶ弾が止まって渦になり、まわりの敵を吸い寄せて削る。",
               lvText:["渦は2秒","渦は2.5秒","渦は3秒・吸い寄せが強い"],
               cd:[170,150,130] },
    barrier: { name:"バリア",   mark:"盾", color:"#c9a227",
               desc:"ドローンの周りを板が回り、触れた敵の弾を消す。消すと板はしばらく消える。",
               lvText:["板2枚","板3枚","板4枚・早く戻る"],
               cd:[0,0,0] },
    sniper:  { name:"狙撃",     mark:"狙", color:"#3d4f73",
               desc:"いちばん体力の多い敵を、画面のどこにいても大きく削る。",
               lvText:["威力5","威力7","威力9"],
               cd:[130,112,95] },
    freeze:  { name:"冷凍",     mark:"氷", color:"#5bb8de",
               desc:"冷気の弾で敵を凍らせて止める。凍った敵への次の一撃は2倍。",
               lvText:["凍る時間1秒","凍る時間1.3秒","凍る時間1.7秒・2発同時"],
               cd:[66,58,50] }
});
WEAPON_IDS.push("fire","disc","gravity","barrier","sniper","freeze");
Object.assign(FIRE_SE, { disc:"disc", gravity:"gravity", sniper:"snipe", freeze:"freeze" });

SYNERGIES.push(
    { key:"napalm",       a:"missile", b:"fire",    name:"ナパーム",   desc:"ミサイルの爆発の跡が、しばらく燃え続ける" },
    { key:"incendiary",   a:"mine",    b:"fire",    name:"焼夷地雷",   desc:"地雷の爆発の跡が、しばらく燃え続ける" },
    { key:"steamveil",    a:"water",   b:"fire",    name:"蒸気幕",     desc:"炎が濡れた敵に当たると湯気が立ち、まわりの敵の弾を消す" },
    { key:"rotorblade",   a:"blade",   b:"disc",    name:"回転刃",     desc:"円盤が大きく速くなり、威力1.5倍" },
    { key:"thunderdisc",  a:"tesla",   b:"disc",    name:"雷盤",       desc:"円盤が当たるたびに電撃が連鎖する" },
    { key:"magdisc",      a:"emp",     b:"disc",    name:"磁力盤",     desc:"戻ってくる円盤が、敵を引き連れてくる" },
    { key:"implosion",    a:"missile", b:"gravity", name:"重力爆縮",   desc:"渦が消えるときに大爆発する" },
    { key:"pitfall",      a:"mine",    b:"gravity", name:"落とし穴",   desc:"渦の中心に地雷を置く" },
    { key:"lens",         a:"laser",   b:"gravity", name:"集光",       desc:"渦の中の敵へのレーザー威力2倍" },
    { key:"reflect",      a:"emp",     b:"barrier", name:"反射",       desc:"防いだ弾を敵へはね返す" },
    { key:"ironwall",     a:"blade",   b:"barrier", name:"鉄壁",       desc:"バリアの板が敵にも当たる" },
    { key:"waterfilm",    a:"water",   b:"barrier", name:"水の膜",     desc:"バリアの板+2枚" },
    { key:"piercesnipe",  a:"laser",   b:"sniper",  name:"貫通狙撃",   desc:"狙撃が後ろの敵も貫く" },
    { key:"marked",       a:"gun",     b:"sniper",  name:"照準",       desc:"狙撃のあと2秒間、実弾の威力2倍" },
    { key:"weakpoint",    a:"emp",     b:"sniper",  name:"弱点",       desc:"減速中の敵への狙撃が2倍" },
    { key:"deepfreeze",   a:"water",   b:"freeze",  name:"凍結",       desc:"濡れた敵は長く凍り、まわりの濡れた敵も凍る" },
    { key:"shatter",      a:"gun",     b:"freeze",  name:"粉砕",       desc:"凍った敵を倒すと、氷の破片が飛び散る" },
    { key:"superconduct", a:"tesla",   b:"freeze",  name:"超伝導",     desc:"凍った敵への電撃が1.5倍、連鎖が遠くまで届く" }
);
Object.assign(SYN_COLOR, {
    napalm:"255,110,30", incendiary:"240,90,20", steamveil:"170,190,210",
    rotorblade:"40,160,160", thunderdisc:"40,150,255", magdisc:"140,80,230",
    implosion:"120,70,220", pitfall:"150,110,60", lens:"200,60,255",
    reflect:"230,190,40", ironwall:"200,170,60", waterfilm:"41,163,214",
    piercesnipe:"235,40,60", marked:"255,170,30", weakpoint:"160,60,255",
    deepfreeze:"100,190,240", shatter:"170,220,255", superconduct:"60,140,255"
});

Object.assign(arms, {
    flames:[],      //火炎放射の炎
    fields:[],      //燃え続ける地面(ナパーム・焼夷地雷)
    discs:[],
    wells:[],       //重力弾(飛んでいる弾と渦)
    plates:[],      //バリアの板(down：消えている残りフレーム)
    snipes:[],      //狙撃の描画用
    shards:[],      //冷凍の弾
    ghosts:[],      //協力プレイのゲスト：消した弾がホストから届き直しても、もう一度は数えないための印
    blockLog:[0],   //協力プレイのゲスト：防いだ数と、最近防いだ位置(ホストへ送って弾を消してもらう)
    barrierAngle:0,
    markT:0,        //照準：実弾の威力が上がっている残り時間
    fireSound:0,

    reset2:function(){
        this.flames = []; this.fields = []; this.discs = []; this.wells = []; this.snipes = []; this.shards = [];
        this.ghosts = [];   //(blockLog は協力プレイの間ずっと数え続ける。coop.resetExchange で戻す)
        this.markT = 0;
        this.plates = [];
        if(this.has("barrier")){
            var n = this.barrierCount();
            for(var i=0; i<n; i++) this.plates.push({ down:0 });
        }
    },
    barrierCount:function(){
        return BARRIER_N[this.level("barrier") - 1] + (this.syn.waterfilm ? 2 : 0);
    },
    //実弾1発のダメージ(照準の間は2倍)
    gunDmg:function(){
        return this.markT > 0 ? 2 : 1;
    },
    //渦の中にいるか(集光)
    inWell:function(_e){
        for(var i=0; i<this.wells.length; i++){
            var w = this.wells[i];
            if(w.open && Math.hypot(_e.x - w.x, _e.y - w.y) < WELL_R) return true;
        }
        return false;
    },
    //今の画面で一番体力の多い敵(狙撃)
    toughest:function(){
        var best = null;
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead || e.x < 0 || e.x > CW || e.y < 0 || e.y > CH) continue;   //(ほかの装備と同じく、同胞にも当たる)
            if(!best || e.hp > best.hp) best = e;
        }
        return best;
    },

    //----------------------------------------------------------------- 攻撃
    fire2:function(_id,_lv){
        var range = game.range();
        switch(_id){
            case "fire":
                var t = this.nearest(drone.X,drone.Y,FIRE_RANGE[_lv-1] + 20);
                if(!t) return false;
                var base = Math.atan2(t.y - drone.Y, t.x - drone.X);
                var reach = FIRE_RANGE[_lv-1];
                for(var k=0; k<2; k++){
                    var a = base + (Math.random() - 0.5)*0.45, sp = 4.5 + Math.random()*1.5;
                    this.flames.push({ x:drone.X + Math.cos(a)*12, y:drone.Y + Math.sin(a)*12, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
                                       life:Math.round(reach/sp), maxLife:Math.round(reach/sp), hit:[], burn:BURN_TIME[_lv-1] });
                }
                if(++this.fireSound % 4 == 0) sound.play("fire");
                return true;

            case "disc":
                var t = this.nearest(drone.X,drone.Y,range*1.2);
                if(!t) return false;
                var n = _lv >= 3 ? 2 : 1, big = this.syn.rotorblade;
                var base = Math.atan2(t.y - drone.Y, t.x - drone.X);
                for(var k=0; k<n; k++){
                    var a = base + (n == 2 ? (k - 0.5)*0.5 : 0), sp = DISC_SPEED*(big ? 1.25 : 1);
                    this.discs.push({ x:drone.X, y:drone.Y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, back:false, t:0,
                                      size:big ? 20 : 13, dmg:DISC_DMG*(big ? 1.5 : 1), hit:[] });
                }
                if(big) fx.shout("rotorblade", drone.X, drone.Y - 20, 300);
                return true;

            case "gravity":
                var t = this.nearest(drone.X,drone.Y,range*1.2);
                if(!t) return false;
                var a = Math.atan2(t.y - drone.Y, t.x - drone.X), d = Math.hypot(t.x - drone.X, t.y - drone.Y);
                this.wells.push({ x:drone.X, y:drone.Y, vx:Math.cos(a)*4, vy:Math.sin(a)*4, fly:Math.min(50, Math.round(d/4)),
                                  open:false, life:WELL_TIME[_lv-1], maxLife:WELL_TIME[_lv-1], pull:WELL_PULL[_lv-1], t:0 });
                return true;

            case "sniper":
                var t = this.toughest();
                if(!t) return false;
                var dmg = SNIPE_DMG[_lv-1];
                if(this.syn.weakpoint && t.slow > 0){
                    dmg *= 2;
                    fx.shout("weakpoint", t.x, t.y);
                    fx.ring(t.x, t.y, 40, SYN_COLOR.weakpoint, 14, 4);
                }
                var dx = t.x - drone.X, dy = t.y - drone.Y, d = Math.hypot(dx,dy) || 1;
                dx /= d; dy /= d;
                var ex = t.x, ey = t.y;
                //貫通狙撃：後ろの敵にも半分の威力で当たり、光線は画面の端まで伸びる
                if(this.syn.piercesnipe){
                    ex = drone.X + dx*1200; ey = drone.Y + dy*1200;
                    for(var i=0; i<enemies.length; i++){
                        var e = enemies[i];
                        if(e == t || e.dead) continue;
                        var rx = e.x - drone.X, ry = e.y - drone.Y;
                        if(rx*dx + ry*dy > d && Math.abs(rx*dy - ry*dx) < e.r + 6){
                            mainScreen.hitEnemy(e, dmg*0.5, "sniper");
                            fx.flare(e.x, e.y, 22, SYN_COLOR.piercesnipe, 10);
                            fx.shout("piercesnipe", e.x, e.y);
                        }
                    }
                }
                mainScreen.hitEnemy(t, dmg, "sniper");
                this.snipes.push({ x:drone.X, y:drone.Y, x2:ex, y2:ey, life:14, pierce:this.syn.piercesnipe });
                fx.flare(drone.X + dx*16, drone.Y + dy*16, 16, "255,230,180", 6);
                fx.flare(t.x, t.y, 30, "255,240,210", 10);
                fx.sparks(t.x, t.y, 8, "255,220,150", 6, 2.5);
                fx.shake(3);
                //照準：しばらく実弾が強くなる
                if(this.syn.marked){
                    this.markT = MARK_TIME;
                    fx.shout("marked", drone.X, drone.Y - 20, 240);
                }
                return true;

            case "freeze":
                var t = this.nearest(drone.X,drone.Y,180);
                if(!t) return false;
                var n = _lv >= 3 ? 2 : 1;
                var base = this.aim(t,ICE_SPEED);
                for(var k=0; k<n; k++){
                    var a = base + (n == 2 ? (k - 0.5)*0.22 : 0);
                    this.shards.push({ x:drone.X, y:drone.Y, vx:Math.cos(a)*ICE_SPEED, vy:Math.sin(a)*ICE_SPEED, life:34,
                                       time:FREEZE_TIME[_lv-1] });
                }
                return true;
        }
        return false;
    },

    //凍らせる(ボスは凍らず遅くなるだけ)
    freezeEnemy:function(_e,_time){
        if(_e.boss || _e.rare){ _e.slow = Math.max(_e.slow || 0, _time); return; }
        _e.frozen = Math.max(_e.frozen || 0, _time);
        _e.vx = 0; _e.vy = 0;
    },
    //凍った敵が砕けたときの演出(mainScreen.hitEnemy から)
    shatterFx:function(_e){
        fx.sparks(_e.x, _e.y, 8, "190,230,255", 5, 2.5);
        fx.ring(_e.x, _e.y, _e.r + 10, "160,215,245", 10, 3);
        sound.play("shatter");
    },

    //----------------------------------------------------------------- 更新
    update2:function(_firing){
        this.updateStatus();
        this.updateFlames();
        this.updateFields();
        this.updateDiscs();
        this.updateWells();
        this.updateBarrier(_firing);
        this.updateShards();
        for(var i=this.snipes.length-1; i>=0; i--){ if(--this.snipes[i].life <= 0) this.snipes.splice(i,1); }
        if(this.markT > 0) this.markT--;
    },

    //燃えている・凍っている敵
    updateStatus:function(){
        var guest = coop.isGuest();
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead) continue;
            if(e.frozen > 0) e.frozen--;
            if(e.burn > 0){
                e.burn--;
                if(!guest && e.burn % BURN_TICK == 0) mainScreen.hitEnemy(e, BURN_DMG, "fire");
                if(e.burn % 5 == 0){
                    effects.push({ x:e.x + (Math.random() - 0.5)*e.r*1.4, y:e.y + (Math.random() - 0.3)*e.r, vx:(Math.random() - 0.5)*0.4, vy:-1.2,
                                   life:14, maxLife:14, size:3, glow:"255,120,30" });
                }
            }
        }
    },

    updateFlames:function(){
        for(var i=0; i<this.flames.length; i++){
            var f = this.flames[i];
            f.x += f.vx; f.y += f.vy;
            f.vx *= 0.97; f.vy *= 0.97;
            f.life--;
            for(var j=0; j<enemies.length; j++){
                var e = enemies[j];
                if(e.dead || f.hit.indexOf(e) >= 0) continue;
                var size = 5 + (1 - f.life/f.maxLife)*8;
                if(Math.hypot(e.x - f.x, e.y - f.y) < e.r + size){
                    f.hit.push(e);
                    var wasWet = e.wet > 0;
                    mainScreen.hitEnemy(e, FIRE_DMG, "fire");
                    e.burn = Math.max(e.burn || 0, f.burn);
                    //蒸気幕：濡れた敵が湯気を吹き、まわりの敵の弾を消す
                    if(this.syn.steamveil && wasWet && !(e.veilCd > mainScreen.clock)){
                        e.veilCd = mainScreen.clock + 40;
                        e.wet = 0;
                        this.steamVeil(e.x, e.y);
                    }
                }
            }
        }
        this.flames = this.flames.filter(function(f){ return f.life > 0; });
    },
    steamVeil:function(_x,_y){
        for(var i=enemyShots.length-1; i>=0; i--){
            if(Math.hypot(enemyShots[i].x - _x, enemyShots[i].y - _y) < VEIL_R) enemyShots.splice(i,1);
        }
        for(var i=0; i<10; i++){
            var a = Math.random()*Math.PI*2, s = 1 + Math.random()*2.5;
            effects.push({ x:_x, y:_y, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 0.6, life:26 + Math.random()*14, maxLife:40,
                           size:6 + Math.random()*4, glow:"200,210,220" });
        }
        fx.ring(_x, _y, VEIL_R, SYN_COLOR.steamveil, 16, 5);
        fx.shout("steamveil", _x, _y);
        sound.play("steam");
    },

    //燃え続ける地面(ナパーム・焼夷地雷。explode から)
    addField:function(_x,_y,_R,_key){
        this.fields.push({ x:_x, y:_y, R:_R, life:FIELD_TIME, maxLife:FIELD_TIME, key:_key });
        fx.shout(_key, _x, _y, 180);
    },
    updateFields:function(){
        for(var i=0; i<this.fields.length; i++){
            var F = this.fields[i];
            F.life--;
            for(var j=0; j<enemies.length; j++){
                var e = enemies[j];
                if(!e.dead && Math.hypot(e.x - F.x, e.y - F.y) < F.R + e.r) e.burn = Math.max(e.burn || 0, 60);
            }
            if(F.life % 3 == 0){
                var a = Math.random()*Math.PI*2, r = Math.random()*F.R;
                effects.push({ x:F.x + Math.cos(a)*r, y:F.y + Math.sin(a)*r, vx:0, vy:-1 - Math.random(), life:16, maxLife:16,
                               size:3.5, glow:SYN_COLOR[F.key] });
            }
        }
        this.fields = this.fields.filter(function(F){ return F.life > 0; });
    },

    updateDiscs:function(){
        for(var i=0; i<this.discs.length; i++){
            var c = this.discs[i];
            c.t++;
            if(!c.back){
                //行き：だんだん遅くなり、止まったら戻り始める
                var sp = Math.hypot(c.vx,c.vy), ns = sp - DISC_BRAKE*(this.syn.rotorblade ? 1.25 : 1);
                if(ns <= 0.5){ c.back = true; c.hit = []; }
                else{ c.vx *= ns/sp; c.vy *= ns/sp; }
            }else{
                //帰り：ドローンへ向かって速くなる
                var dx = drone.X - c.x, dy = drone.Y - c.y, d = Math.hypot(dx,dy) || 1;
                var sp = Math.min(11, Math.hypot(c.vx,c.vy) + 0.4);
                c.vx = dx/d*sp; c.vy = dy/d*sp;
                if(d < 18 || c.t > 300){ c.done = true; continue; }
            }
            c.x += c.vx; c.y += c.vy;
            for(var j=0; j<enemies.length; j++){
                var e = enemies[j];
                if(e.dead) continue;
                var d2 = Math.hypot(e.x - c.x, e.y - c.y);
                //磁力盤：戻ってくる円盤が近くの敵を引き連れる
                if(this.syn.magdisc && c.back && d2 < 60 && !e.boss){
                    e.x += (c.x - e.x)*0.12; e.y += (c.y - e.y)*0.12;
                    if(c.t % 6 == 0) fx.line(c.x, c.y, e.x, e.y, SYN_COLOR.magdisc, 2, 6);
                    fx.shout("magdisc", c.x, c.y, 240);
                }
                if(c.hit.indexOf(e) >= 0 || d2 > e.r + c.size) continue;
                c.hit.push(e);
                mainScreen.hitEnemy(e, c.dmg, "disc");
                sound.play("blade");
                if(this.syn.thunderdisc){
                    fx.flare(e.x, e.y, 22, SYN_COLOR.thunderdisc, 10);
                    this.chainFrom(e, 2, "thunderdisc");
                }
            }
        }
        this.discs = this.discs.filter(function(c){ return !c.done; });
    },

    updateWells:function(){
        for(var i=0; i<this.wells.length; i++){
            var w = this.wells[i];
            w.t++;
            if(!w.open){
                //飛んでいる弾：決めた距離まで進んだら止まって渦になる
                w.x += w.vx; w.y += w.vy;
                if(--w.fly <= 0){
                    w.open = true;
                    fx.ring(w.x, w.y, WELL_R, "120,90,210", 16, 3);
                    //落とし穴：渦の中心に地雷を置く
                    if(this.syn.pitfall){
                        this.mines.push({ x:w.x, y:w.y, arm:0, t:0, boom:false });
                        fx.shout("pitfall", w.x, w.y);
                    }
                }
                continue;
            }
            w.life--;
            this.pullWell(w.x, w.y, w.pull);
            if(w.t % 15 == 0){
                for(var j=0; j<enemies.length; j++){
                    var e = enemies[j];
                    if(!e.dead && Math.hypot(e.x - w.x, e.y - w.y) < 36 + e.r) mainScreen.hitEnemy(e, WELL_DMG, "gravity");
                }
            }
            if(w.life <= 0){
                //重力爆縮：渦が消えるときに大爆発
                if(this.syn.implosion){
                    this.explode(w.x, w.y, 90, 3, "gravity");
                    fx.flare(w.x, w.y, 100, SYN_COLOR.implosion, 22);
                    fx.ring(w.x, w.y, 110, SYN_COLOR.implosion, 20, 7);
                    fx.shout("implosion", w.x, w.y);
                    fx.shake(7);
                }
                w.done = true;
            }
        }
        this.wells = this.wells.filter(function(w){ return !w.done; });
        //協力プレイのホスト：相方の渦も敵を吸い寄せる(敵を動かしているのはホスト)
        if(coop.active && coop.role == "host" && coop.partner && coop.partner.arms && coop.partner.arms.v){
            var v = coop.partner.arms.v;
            for(var i=0; i<v.length; i+=4) this.pullWell(v[i], v[i+1], 1.0);
        }
    },
    pullWell:function(_x,_y,_pull){
        for(var j=0; j<enemies.length; j++){
            var e = enemies[j];
            if(e.dead || e.boss || e.rival) continue;
            var dx = _x - e.x, dy = _y - e.y, d = Math.hypot(dx,dy);
            if(d < WELL_R && d > 4){ e.x += dx/d*_pull; e.y += dy/d*_pull; }
        }
    },

    //バリア：回る板が敵の弾に触れると、弾を消して板はしばらく消える
    platePos:function(_k,_n){
        var a = this.barrierAngle + _k*Math.PI*2/_n;
        return { x:drone.X + Math.cos(a)*BARRIER_R, y:drone.Y + Math.sin(a)*BARRIER_R, a:a };
    },
    updateBarrier:function(_active){
        this.barrierAngle += 0.05;
        for(var i=this.ghosts.length-1; i>=0; i--){
            var g = this.ghosts[i];
            g.x += g.vx; g.y += g.vy;
            if(--g.life <= 0) this.ghosts.splice(i,1);
        }
        if(!_active || !this.has("barrier") || mainScreen.down) return;
        var n = this.plates.length, regen = BARRIER_REGEN[this.level("barrier") - 1];
        for(var k=0; k<n; k++){
            var p = this.plates[k];
            if(p.down > 0){ if(--p.down == 0) fx.flare(this.platePos(k,n).x, this.platePos(k,n).y, 14, "230,200,90", 8); continue; }
            var P = this.platePos(k,n);
            for(var i=enemyShots.length-1; i>=0; i--){
                var s = enemyShots[i];
                if(Math.hypot(s.x - P.x, s.y - P.y) > s.r + 8) continue;
                enemyShots.splice(i,1);
                //ゲスト：ホストから届き直した同じ弾なら、板は減らさない
                if(this.isGhost(s)) continue;
                p.down = regen;
                this.blocked(s, P);
                break;
            }
            if(p.down > 0) continue;
            //鉄壁：板が敵にも当たる
            if(this.syn.ironwall){
                for(var i=0; i<enemies.length; i++){
                    var e = enemies[i];
                    if(e.dead || e.bladeCd > 0 || Math.hypot(e.x - P.x, e.y - P.y) > e.r + 9) continue;
                    e.bladeCd = 20;
                    mainScreen.hitEnemy(e, 1, "barrier");
                    fx.sparks(P.x, P.y, 5, SYN_COLOR.ironwall, 4, 2.5);
                    fx.shout("ironwall", P.x, P.y, 300);
                }
            }
        }
    },
    isGhost:function(_s){
        for(var i=0; i<this.ghosts.length; i++){
            if(Math.hypot(this.ghosts[i].x - _s.x, this.ghosts[i].y - _s.y) < 14) return true;
        }
        return false;
    },
    //弾を防いだ
    blocked:function(_s,_P){
        fx.flare(_P.x, _P.y, 18, "255,220,110", 8);
        fx.sparks(_P.x, _P.y, 5, "255,220,110", 4, 2);
        sound.play("block");
        if(coop.isGuest()){
            this.ghosts.push({ x:_s.x, y:_s.y, vx:_s.vx, vy:_s.vy, life:24 });
            this.blockLog[0]++;
            this.blockLog.push(Math.round(_s.x), Math.round(_s.y));
            if(this.blockLog.length > 13) this.blockLog.splice(1,2);    //最近の6つだけ送る
        }
        //反射：防いだ弾を敵へはね返す
        if(this.syn.reflect){
            var t = this.nearest(_P.x,_P.y,400);
            if(t){
                var a = Math.atan2(t.y - _P.y, t.x - _P.x);
                this.bullets.push({ x:_P.x, y:_P.y, vx:Math.cos(a)*SHOT_SPEED, vy:Math.sin(a)*SHOT_SPEED, life:60, pierce:0, hit:[], reflect:true });
                fx.line(_P.x, _P.y, _P.x + Math.cos(a)*30, _P.y + Math.sin(a)*30, SYN_COLOR.reflect, 3, 8);
                fx.shout("reflect", _P.x, _P.y, 180);
            }
        }
    },
    //対戦：受けたダメージを板1枚で防ぐ(versus.read から)。防いだあとのダメージを返す
    absorbVs:function(_inc){
        if(!this.has("barrier")) return _inc;
        for(var k=0; k<this.plates.length; k++){
            var p = this.plates[k];
            if(p.down > 0) continue;
            p.down = BARRIER_REGEN[this.level("barrier") - 1];
            var P = this.platePos(k,this.plates.length);
            fx.flare(P.x, P.y, 22, "255,220,110", 10);
            fx.ring(drone.X, drone.Y, BARRIER_R + 6, "230,190,40", 12, 3);
            sound.play("block");
            return Math.max(0, _inc - VS_BARRIER_ABSORB);
        }
        return _inc;
    },

    updateShards:function(){
        for(var i=0; i<this.shards.length; i++){
            var s = this.shards[i];
            s.x += s.vx; s.y += s.vy; s.life--;
            if(s.x < -10 || s.x > CW + 10 || s.y < -10 || s.y > CH + 10) s.life = 0;
            for(var j=0; j<enemies.length && s.life > 0; j++){
                var e = enemies[j];
                if(e.dead || Math.hypot(e.x - s.x, e.y - s.y) > e.r + 4) continue;
                s.life = 0;
                var time = s.time;
                //凍結：濡れた敵は長く凍り、まわりの濡れた敵も凍る
                if(this.syn.deepfreeze && e.wet > 0){
                    time = Math.round(time*1.5);
                    for(var k=0; k<enemies.length; k++){
                        var o = enemies[k];
                        if(o == e || o.dead || !(o.wet > 0) || Math.hypot(o.x - e.x, o.y - e.y) > 90) continue;
                        this.freezeEnemy(o, time);
                        mainScreen.hitEnemy(o, ICE_DMG, "freeze");
                        fx.line(e.x, e.y, o.x, o.y, SYN_COLOR.deepfreeze, 3, 10);
                    }
                    fx.ring(e.x, e.y, 90, SYN_COLOR.deepfreeze, 14, 4);
                    fx.shout("deepfreeze", e.x, e.y);
                }
                mainScreen.hitEnemy(e, ICE_DMG, "freeze");
                this.freezeEnemy(e, time);
                fx.sparks(e.x, e.y, 6, "180,225,250", 4, 2);
            }
        }
        this.shards = this.shards.filter(function(s){ return s.life > 0; });
    },

    //粉砕：凍った敵を倒すと氷の破片が飛び散る(onKill から)
    onKill2:function(_e){
        if(this.syn.shatter && _e.wasFrozen){
            for(var k=0; k<6; k++){
                var a = k*Math.PI/3 + Math.random()*0.3;
                this.bullets.push({ x:_e.x, y:_e.y, vx:Math.cos(a)*SHOT_SPEED*0.8, vy:Math.sin(a)*SHOT_SPEED*0.8, life:28, pierce:0, hit:[_e], ice:true });
            }
            fx.flare(_e.x, _e.y, 34, SYN_COLOR.shatter, 14);
            fx.ring(_e.x, _e.y, 40, SYN_COLOR.shatter, 12, 4);
            fx.shout("shatter", _e.x, _e.y);
        }
    },

    //----------------------------------------------------------------- 描画
    //燃えている・凍っている敵の上に重ねる(mainScreen.drawEnemy から)
    drawStatus:function(_e){
        if(_e.frozen > 0){
            //氷：うすい水色の膜と、角ばった氷の輪郭
            ctx.fillStyle = "rgba(170,225,250,0.45)";
            ctx.beginPath(); ctx.arc(_e.x, _e.y, _e.r + 4, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(90,170,220,0.9)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for(var i=0; i<6; i++){
                var a = i*Math.PI/3 + 0.3, rr = _e.r + (i % 2 ? 2 : 6);
                ctx.lineTo(_e.x + Math.cos(a)*rr, _e.y + Math.sin(a)*rr);
            }
            ctx.closePath(); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255,0.85)";
            ctx.beginPath(); ctx.moveTo(_e.x - _e.r*0.5, _e.y - _e.r*0.6); ctx.lineTo(_e.x - _e.r*0.1, _e.y - _e.r*0.9); ctx.stroke();
            ctx.lineWidth = 1;
        }
        if(_e.burn > 0){
            //炎：敵の下からゆらめく小さな炎
            for(var i=0; i<3; i++){
                var ph = (_e.t*0.2 + i*2.1), fx0 = _e.x + (i - 1)*_e.r*0.55, fy = _e.y + _e.r*0.3;
                var h = 7 + Math.sin(ph)*3;
                ctx.fillStyle = "rgba(255,120,30,0.8)";
                ctx.beginPath(); ctx.moveTo(fx0 - 3.5, fy); ctx.quadraticCurveTo(fx0, fy - h*1.6, fx0 + 3.5, fy); ctx.fill();
                ctx.fillStyle = "rgba(255,220,90,0.9)";
                ctx.beginPath(); ctx.moveTo(fx0 - 1.8, fy); ctx.quadraticCurveTo(fx0, fy - h, fx0 + 1.8, fy); ctx.fill();
            }
        }
    },

    draw2:function(_active){
        //燃え続ける地面
        for(var i=0; i<this.fields.length; i++){
            var F = this.fields[i], k = Math.min(1, F.life/40);
            ctx.fillStyle = "rgba(" + SYN_COLOR[F.key] + "," + (0.16*k) + ")";
            ctx.beginPath(); ctx.arc(F.x, F.y, F.R, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(" + SYN_COLOR[F.key] + "," + (0.4*k) + ")";
            ctx.setLineDash([4,5]);
            ctx.beginPath(); ctx.arc(F.x, F.y, F.R, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
        }
        //重力弾の渦：外へ広がる輪が中心へ吸い込まれていく
        for(var i=0; i<this.wells.length; i++){
            var w = this.wells[i];
            if(!w.open){
                ctx.fillStyle = "#3a2a6e";
                ctx.beginPath(); ctx.arc(w.x, w.y, 7, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "rgba(150,120,230,0.8)"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(w.x, w.y, 10, w.t*0.3, w.t*0.3 + 4); ctx.stroke();
                ctx.lineWidth = 1;
                continue;
            }
            this.drawWell(w.x, w.y, w.t, Math.min(1, w.life/30), this.syn.implosion || this.syn.lens);
        }
        //火炎放射の炎：黄色 → オレンジ → 赤 → 煙の灰色
        for(var i=0; i<this.flames.length; i++){
            var f = this.flames[i], age = 1 - f.life/f.maxLife, size = 5 + age*8;
            ctx.fillStyle = age < 0.3 ? "rgba(255,225,110,0.9)" : age < 0.6 ? "rgba(255,140,40,0.8)" : age < 0.85 ? "rgba(225,60,30,0.6)" : "rgba(120,110,105,0.4)";
            ctx.beginPath(); ctx.arc(f.x, f.y, size, 0, Math.PI*2); ctx.fill();
        }
        //冷凍の弾：白く光る氷の粒
        for(var i=0; i<this.shards.length; i++){
            var s = this.shards[i], a = Math.atan2(s.vy, s.vx);
            ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
            ctx.fillStyle = "rgba(150,215,245,0.4)";
            ctx.fillRect(-12, -2, 10, 4);
            ctx.fillStyle = "#e6f7ff"; ctx.strokeStyle = "#5bb8de"; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(0,-3.5); ctx.lineTo(-5,0); ctx.lineTo(0,3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
        }
        ctx.lineWidth = 1;
        //円盤：回る輪と、行きは進む向きの残像
        for(var i=0; i<this.discs.length; i++){
            var c = this.discs[i];
            this.drawDisc(c.x, c.y, c.size, c.t, this.syn.rotorblade, this.syn.thunderdisc);
        }
        //狙撃の光線：白い芯と、細く消えていく光
        for(var i=0; i<this.snipes.length; i++){
            var S = this.snipes[i], k = S.life/14;
            ctx.lineCap = "round";
            ctx.strokeStyle = S.pierce ? "rgba(" + SYN_COLOR.piercesnipe + "," + (0.5*k) + ")" : "rgba(255,200,120," + (0.5*k) + ")";
            ctx.lineWidth = 6*k + 1;
            ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.lineTo(S.x2, S.y2); ctx.stroke();
            ctx.strokeStyle = "rgba(255,255,255," + k + ")";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.lineCap = "butt";
        }
        ctx.lineWidth = 1;
        //バリアの板
        if(_active && this.has("barrier") && !mainScreen.down){
            var n = this.plates.length;
            for(var k=0; k<n; k++){
                var P = this.platePos(k,n);
                this.drawPlate(P.x, P.y, P.a, this.plates[k].down > 0, this.syn.ironwall);
            }
        }
        //照準：実弾が強い間は、ドローン君のまわりに照準の印
        if(this.markT > 0){
            var a = Math.min(1, this.markT/30);
            ctx.strokeStyle = "rgba(" + SYN_COLOR.marked + "," + (0.7*a) + ")";
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(drone.X, drone.Y, 26, 0, Math.PI*2); ctx.stroke();
            for(var i=0; i<4; i++){
                var q = i*Math.PI/2;
                ctx.beginPath(); ctx.moveTo(drone.X + Math.cos(q)*20, drone.Y + Math.sin(q)*20); ctx.lineTo(drone.X + Math.cos(q)*32, drone.Y + Math.sin(q)*32); ctx.stroke();
            }
            ctx.lineWidth = 1;
        }
    },
    //渦(相方の画面でも同じ絵を使う)
    drawWell:function(_x,_y,_t,_a,_glow){
        var col = _glow ? "150,90,240" : "110,85,200";
        ctx.fillStyle = "rgba(" + col + "," + (0.1*_a) + ")";
        ctx.beginPath(); ctx.arc(_x, _y, WELL_R, 0, Math.PI*2); ctx.fill();
        ctx.lineWidth = 2;
        for(var s=0; s<4; s++){
            var ph = ((_t*0.02 + s/4) % 1);
            ctx.strokeStyle = "rgba(" + col + "," + (0.55*(1 - ph)*_a) + ")";
            ctx.beginPath(); ctx.arc(_x, _y, 8 + (WELL_R - 8)*(1 - ph), _t*0.1 + s*1.6, _t*0.1 + s*1.6 + 2.2); ctx.stroke();
        }
        ctx.fillStyle = "rgba(30,15,60," + (0.9*_a) + ")";
        ctx.beginPath(); ctx.arc(_x, _y, 9, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(200,170,255," + _a + ")";
        ctx.beginPath(); ctx.arc(_x, _y, 12, -_t*0.2, -_t*0.2 + 4); ctx.stroke();
        ctx.lineWidth = 1;
    },
    drawDisc:function(_x,_y,_size,_t,_big,_shock){
        ctx.save();
        ctx.translate(_x,_y);
        ctx.rotate(_t*0.5);
        ctx.fillStyle = _big ? "rgba(40,160,160,0.25)" : "rgba(42,157,143,0.18)";
        ctx.beginPath(); ctx.arc(0,0,_size + 4,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "#1f6f66"; ctx.strokeStyle = "#141516"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0,0,_size,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#6fd3c4"; ctx.lineWidth = 2;
        for(var i=0; i<3; i++){ ctx.beginPath(); ctx.arc(0,0,_size*0.7,i*2.09,i*2.09 + 1.2); ctx.stroke(); }
        ctx.fillStyle = "#141516";
        ctx.beginPath(); ctx.arc(0,0,_size*0.25,0,Math.PI*2); ctx.fill();
        if(_shock){
            ctx.strokeStyle = "rgba(" + SYN_COLOR.thunderdisc + ",0.9)"; ctx.lineWidth = 1.5;
            var a = Math.random()*Math.PI*2;
            ctx.beginPath(); ctx.moveTo(Math.cos(a)*_size, Math.sin(a)*_size); ctx.lineTo(Math.cos(a + 0.3)*(_size + 7), Math.sin(a + 0.3)*(_size + 7)); ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //バリアの板(消えている間は点線の輪郭だけ)
    drawPlate:function(_x,_y,_a,_down,_iron){
        ctx.save();
        ctx.translate(_x,_y);
        ctx.rotate(_a + Math.PI/2);
        if(_down){
            ctx.strokeStyle = "rgba(201,162,39,0.35)"; ctx.setLineDash([2,2]);
            ctx.strokeRect(-8,-2.5,16,5);
            ctx.setLineDash([]);
        }else{
            ctx.fillStyle = _iron ? "#b08a1c" : "rgba(235,200,80,0.9)";
            ctx.strokeStyle = "#141516"; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.rect(-9,-3,18,6); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = "rgba(255,250,220,0.9)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-7,-1.2); ctx.lineTo(7,-1.2); ctx.stroke();
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },

    //----------------------------------------------------------------- 協力プレイ・対戦：相方の画面に描いてもらう分
    summary2:function(_a){
        var r = Math.round;
        var take = function(list,n,f){ var o = []; for(var i=0; i<Math.min(n,list.length); i++) f(list[i],o); return o; };
        if(this.flames.length) _a.f = take(this.flames,12,function(f,o){ o.push(r(f.x),r(f.y),r(10*(1 - f.life/f.maxLife))); });
        if(this.discs.length) _a.d = take(this.discs,4,function(c,o){ o.push(r(c.x),r(c.y),c.size); });
        var open = this.wells.filter(function(w){ return w.open; });
        if(open.length) _a.v = take(open,3,function(w,o){ o.push(r(w.x),r(w.y),w.t,r(10*Math.min(1, w.life/30))); });
        if(this.shards.length) _a.i = take(this.shards,6,function(s,o){ o.push(r(s.x),r(s.y)); });
        if(this.fields.length) _a.fl = take(this.fields,4,function(F,o){ o.push(r(F.x),r(F.y),r(F.R)); });
        if(this.snipes.length){ var S = this.snipes[this.snipes.length - 1]; _a.sn = [r(S.x),r(S.y),r(S.x2),r(S.y2),S.life]; }
        if(this.has("barrier") && !mainScreen.down){
            var mask = 0;
            for(var k=0; k<this.plates.length; k++) if(this.plates[k].down <= 0) mask |= 1 << k;
            _a.pl = [this.plates.length, r(this.barrierAngle*100), mask];
        }
    },
    //相方(対戦の相手)の追加の装備を描く(coop.drawArms から。_ox,_oy は相方のドローン君の位置)
    drawSummary2:function(_a,_ox,_oy){
        for(var i=0; _a.fl && i<_a.fl.length; i+=3){
            ctx.fillStyle = "rgba(255,110,30,0.14)";
            ctx.beginPath(); ctx.arc(_a.fl[i],_a.fl[i+1],_a.fl[i+2],0,Math.PI*2); ctx.fill();
        }
        for(var i=0; _a.v && i<_a.v.length; i+=4) this.drawWell(_a.v[i],_a.v[i+1],_a.v[i+2],_a.v[i+3]/10,false);
        for(var i=0; _a.f && i<_a.f.length; i+=3){
            var age = _a.f[i+2]/10;
            ctx.fillStyle = age < 0.4 ? "rgba(255,200,90,0.85)" : "rgba(235,90,30,0.6)";
            ctx.beginPath(); ctx.arc(_a.f[i],_a.f[i+1],5 + age*8,0,Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = "#e6f7ff";
        for(var i=0; _a.i && i<_a.i.length; i+=2){ ctx.beginPath(); ctx.arc(_a.i[i],_a.i[i+1],3.5,0,Math.PI*2); ctx.fill(); }
        for(var i=0; _a.d && i<_a.d.length; i+=3) this.drawDisc(_a.d[i],_a.d[i+1],_a.d[i+2],mainScreen.clock,false,false);
        if(_a.sn){
            var S = _a.sn, k = S[4]/14;
            ctx.strokeStyle = "rgba(255,230,190," + k + ")"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(S[0],S[1]); ctx.lineTo(S[2],S[3]); ctx.stroke();
            ctx.lineWidth = 1;
        }
        if(_a.pl && _ox != null){
            var n = _a.pl[0], ang = _a.pl[1]/100;
            for(var k=0; k<n; k++){
                var a = ang + k*Math.PI*2/n;
                this.drawPlate(_ox + Math.cos(a)*BARRIER_R, _oy + Math.sin(a)*BARRIER_R, a, !(_a.pl[2] & (1 << k)), false);
            }
        }
    }
});
