//------------------------------------------------------------------------------
//  調整用パラメータ(単位：px, フレーム)
//------------------------------------------------------------------------------
const INVINCIBLE_TIME = 75;     //被弾後の無敵時間
const SHOT_SPEED      = 10;     //ドローンの弾の速さ
const FUEL_PER_PX     = 0.025;  //移動1pxあたりの燃料消費
const FUEL_REGEN      = 0.065;  //毎フレームの燃料回復
const FUEL_RESUME     = 20;     //燃料切れから復帰する燃料
const BLAST_COST      = 40;     //衝撃波の燃料消費
const BLAST_RADIUS    = 150;    //衝撃波の届く範囲(弾を消す範囲・締めの大爆発の範囲)
const BLAST_GUARD     = 30;     //衝撃波を出してから無敵の時間
const BLAST_SLOWMO    = 14;     //衝撃波を出した直後、周りがゆっくりになる時間
const MAGNET_RANGE    = 75;     //アイテムを吸い寄せる距離
const PICKUP_LIFE     = 600;    //アイテムが消えるまでの時間
const FUEL_DROP_RATE  = 0.12;   //燃料缶を落とす確率
const HIT_CORE        = 6;      //敵の弾に対するドローンの当たり判定(中心の小さな点)
const GRAZE_RANGE     = 22;     //弾がこの距離までかすめると「かすり」
const GRAZE_FUEL      = 1.5;    //かすり1回で回復する燃料

//敵の種類
const ENEMY_TYPES = {
    bug:     { r:11, hp:1, speed:1.3, score:10, parts:1 },   //ふらふら近づいてくる
    dasher:  { r:10, hp:1, speed:5.0, score:15, parts:1 },   //狙いを定めて一直線に突っ込んでくる
    shooter: { r:14, hp:2, speed:1.2, score:30, parts:2 },   //離れたところから扇状に弾を撃つ
    tank:    { r:20, hp:5, speed:0.6, score:50, parts:3 },   //遅いが硬い。大きな弾の輪を撃つ
    spinner: { r:15, hp:3, speed:1.1, score:40, parts:2 },   //止まって渦巻き状に弾をばらまく
    bomber:  { r:13, hp:2, speed:1.0, score:35, parts:2 }    //近づくと自爆して弾の輪をまき散らす
};

//敵の弾の種類(r:大きさ・当たり判定)
const SHOT_KINDS = {
    normal: { r:5 },    //赤
    small:  { r:3.5 },  //オレンジ・速め
    big:    { r:8 },    //紫・遅め
    water:  { r:4 },    //水色(ドローン君改の水鉄砲)
    missile:{ r:5 },    //追尾ミサイル(ドローン君改)
    dragon: { r:9 }     //追尾する黒い龍(ドローン君改)
};

//WAVEが進むほど弾が速く、多くなる(1.0～最大1.8倍)
function danmaku(){
    return Math.min(1.8, 1 + (game.wave - 1)*0.07);
}

//敵の弾を撃つ
function fireShot(_x,_y,_angle,_speed,_kind){
    var k = _kind || "normal";
    enemyShots.push({ x:_x, y:_y, vx:Math.cos(_angle)*_speed, vy:Math.sin(_angle)*_speed,
                      r:SHOT_KINDS[k].r, kind:k, grazed:false });
}
//_n発を等間隔の輪にして撃つ
function fireRing(_x,_y,_n,_speed,_offset,_kind){
    for(var i=0; i<_n; i++) fireShot(_x,_y,_offset + i*Math.PI*2/_n,_speed,_kind);
}
//_angleを中心に_n発を扇状に撃つ
function fireFan(_x,_y,_angle,_n,_spread,_speed,_kind){
    for(var i=0; i<_n; i++) fireShot(_x,_y,_angle + (i - (_n-1)/2)*_spread,_speed,_kind);
}

var enemies = [];
var enemyShots = [];    //敵の弾(ドローンの攻撃はequipment.jsのarms)
var pickups = [];       //パーツ・燃料缶
var effects = [];       //破片・衝撃波の輪
var popups = [];        //「+10」などの文字

//------------------------------------------------------------------------------
//  敵の生成
//------------------------------------------------------------------------------
//WAVEが進むほど強い敵が混ざる
function pickEnemyType(){
    var w = game.wave;
    //真実に気付いたあとは人間との戦い
    if(w > REVEAL_WAVE) return forces.pickHuman(w);
    var list = [["bug",10]];
    if(w >= 2) list.push(["dasher",3 + w]);
    if(w >= 2) list.push(["shooter",2 + w*0.8]);
    if(w >= 3) list.push(["spinner",1 + w*0.5]);
    if(w >= 4) list.push(["tank",1 + w*0.5]);
    if(w >= 5) list.push(["bomber",1 + w*0.4]);
    var sum = 0;
    for(var i=0; i<list.length; i++) sum += list[i][1];
    var r = Math.random() * sum;
    for(var i=0; i<list.length; i++){
        r -= list[i][1];
        if(r < 0) return list[i][0];
    }
    return "bug";
}

function makeEnemy(_type){
    var T = ENEMY_TYPES[_type];
    //WAVEが進むほど硬くなる
    //(協力プレイでは2倍)
    var hp = Math.ceil(T.hp * (1 + (game.wave-1)*0.2)) * coop.hpMul();
    var e = {
        id:++enemySeq,  //通し番号(協力プレイで同じ敵を指すため)
        type:_type, r:T.r, hp:hp, maxHp:hp, score:T.score, parts:T.parts,
        speed:T.speed * (1 + (game.wave-1)*0.06),
        x:0, y:0, vx:0, vy:0, flash:0, timer:0, t:Math.floor(Math.random()*100), dead:false,
        slow:0,         //EMPで遅くなっている時間
        wet:0,          //水鉄砲で濡れている時間
        bladeCd:0       //ブレードが再び当たるまでの時間
    };
    placeAtEdge(e);

    if(_type == "dasher"){
        //突進前に画面の端で狙いを定める(予告)
        e.x = Math.max(e.r+4, Math.min(e.x, CW-e.r-4));
        e.y = Math.max(e.r+4, Math.min(e.y, CH-e.r-4));
        e.timer = 60;
        e.aimX = 0; e.aimY = 1;
    }else if(_type == "shooter" || _type == "spinner"){
        setShooterTarget(e);
        e.timer = 60;
        e.spin = Math.random()*Math.PI*2;
        e.firing = 0;       //回転砲台が撃ち続ける残り時間
    }else if(_type == "tank"){
        e.timer = 120 + Math.floor(Math.random()*60);
    }else if(_type == "bomber"){
        e.timer = 300;      //この時間が過ぎると近くなくても自爆
        e.fuse = 0;         //自爆までの点滅時間
    }
    forces.init(e);         //同胞・人間の兵器の初期設定(forces.js)
    return e;
}

//画面の外周のどこかに置く
function placeAtEdge(_e){
    var side = Math.floor(Math.random()*4);
    var out = _e.r + 10;
    if(side == 0){ _e.x = Math.random()*CW; _e.y = -out; }
    else if(side == 1){ _e.x = CW + out; _e.y = Math.random()*CH; }
    else if(side == 2){ _e.x = Math.random()*CW; _e.y = CH + out; }
    else { _e.x = -out; _e.y = Math.random()*CH; }
}

//撃つ敵の次の移動先
function setShooterTarget(_e){
    _e.tx = 100 + Math.random()*(CW-200);
    _e.ty = 80 + Math.random()*(CH-160);
}

//------------------------------------------------------------------------------
//  演出
//------------------------------------------------------------------------------
function burst(_x,_y,_n,_color){
    for(var i=0; i<_n; i++){
        var a = Math.random()*Math.PI*2, s = 1 + Math.random()*4;
        effects.push({ x:_x, y:_y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:20+Math.random()*20, maxLife:40,
                       size:2+Math.random()*3, color:_color });
    }
}

function popup(_x,_y,_text,_color,_big){
    var life = _big ? 60 : 45;
    popups.push({ x:_x, y:_y, text:_text, life:life, maxLife:life, color:_color || "#000", big:!!_big });
}

//------------------------------------------------------------------------------
//  メイン画面処理
//------------------------------------------------------------------------------
var mainScreen = {
    state:"start",      //start:WAVE開始演出  play:戦闘中  clear:WAVEクリア  over:撃墜
    stateTime:0,
    paused:false,
    toSpawn:0,          //これから出てくる敵の数
    spawnTimer:0,
    hp:0,
    maxHp:0,
    fuel:0,
    maxFuel:0,
    invincible:0,
    reload:0,
    shake:0,
    noFuelMsg:0,
    fuelOut:false,      //燃料切れで追従が遅くなっているか(燃料が FUEL_RESUME まで戻ると解除)
    bonus:0,
    bossWave:false,     //このWAVEにボスが出るか
    rares:0,            //このWAVEに出たレア敵の数
    rareMsg:"",
    rareMsgTime:0,
    clock:0,            //このWAVEが始まってからのフレーム数(演出の間隔に使う)
    graze:0,            //このWAVEのかすり回数
    guard:0,            //衝撃波のあとの無敵時間(点滅しない無敵)
    slowmo:0,           //周りがゆっくりになっている残り時間
    tint:null,          //画面全体の色づけ(連鎖爆破など)

    enter:function(){
        enemies = []; enemyShots = []; pickups = []; effects = []; popups = [];
        this.down = false;      //協力プレイで倒れている(次のWAVEで復帰)
        if(coop.active){
            //WAVEごとにダメージの合計をリセット(敵の番号は通しなので混ざらない)
            coop.dmg = {}; coop.applied = {};
        }
        arms.reset();
        drone.applyStats();
        drone.slow = false;
        drone.X = CW/2; drone.Y = CH/2;
        //タッチはドラッグで動かすので、目標をドローン君の位置に戻しておく
        if(inputMode == "touch"){ MouseX = drone.X; MouseY = drone.Y; }
        this.maxHp = game.stat("armor") + (rogue.active ? rogue.maxHpBonus() : 0);
        //ローグライトは耐久を持ち越す(失っている分を引いて始める)
        this.hp = rogue.active ? Math.max(1, this.maxHp - rogue.lost) : this.maxHp;
        this.startHp = this.hp;
        this.maxFuel = game.stat("fuel") + (rogue.has("battery") ? 30 : 0);
        this.fuel = this.maxFuel;
        this.toSpawn = 6 + game.wave*3;
        this.bossWave = isBossWave(game.wave) && !rogue.active;
        if(this.bossWave){
            //ボスWAVEは雑魚が3分の1。最終WAVEはドローン君改との一騎打ち(雑魚なし)
            this.toSpawn = game.wave >= FINAL_WAVE ? 0 : Math.floor(this.toSpawn/3);
            sound.play("warning");
        }
        if(rogue.active){
            //ローグライト：敵の数とボスはマスの種類で決まる(rogue.js)
            this.bossWave = rogue.battleType == "boss";
            this.toSpawn = rogue.spawnCount();
            if(this.bossWave) sound.play("warning");
        }
        this.rares = 0;
        this.rareMsgTime = 0;
        this.spawned = 0;
        this.kinForced = false;
        this.clock = 0;
        this.graze = 0;
        this.guard = 0;
        this.slowmo = 0;
        dragonBlast.reset();
        this.tint = null;
        this.spawnTimer = 0;
        this.invincible = 0;
        this.reload = 30;
        this.shake = 0;
        this.fuelOut = false;
        this.noFuelMsg = 0;
        this.state = "start";
        this.stateTime = 0;
    },

    //----------------------------------------------------------------- 更新
    update:function(){
        //マウスがキャンバスの外にある間は一時停止
        //ゲストの画面はホストから届いた状態で動かす(coop.js)
        if(coop.isGuest()){ coop.guestStep(); return; }
        //協力プレイ中は一時停止しない(相方の画面は止まらないので)
        this.paused = coop.active ? false : !MouseIn;
        sound.duck(this.paused);
        if(this.paused) return;
        this.stateTime++;
        this.clock++;
        if(this.tint && --this.tint.life <= 0) this.tint = null;

        if(this.state != "over"){
            drone.update();
            this.updateFuel();
        }

        switch(this.state){
            case "start":
                //ボスWAVEはWARNINGを長めに見せてからボス登場
                if(this.stateTime >= (this.bossWave ? 150 : 60)){
                    this.state = "play";
                    this.stateTime = 0;
                    if(this.bossWave){
                        enemies.push(makeBoss(this.bossType()));
                        sound.music(null);
                        sound.music("boss");
                    }
                }
                break;
            case "play":
                this.spawn();
                if(Click == 1) this.blast();
                //全部倒したらWAVEクリア
                if(this.toSpawn == 0 && enemies.length == 0){
                    this.state = "clear";
                    this.stateTime = 0;
                    this.bonus = Math.ceil(game.wave/2);
                    game.parts += this.bonus;
                    sound.stopMusic();
                    sound.play("clear");
                    enemyShots = [];
                }
                break;
            case "clear":
                if(this.stateTime >= 150){
                    if(rogue.active){ rogue.battleWon(); return; }
                    var cleared = game.wave;
                    game.wave++;
                    //報酬を選ぶ回数(補給機のカプセル・ボス撃破の分が上乗せされている)
                    game.pendingReward = (game.pendingReward || 0) + 1;
                    //最終WAVEならエンディング、それ以外はストーリーがあれば見てから強化画面へ
                    if(cleared >= FINAL_WAVE){
                        storyScreen.start("ending",function(){ page.change(5); });
                    }else{
                        goUpgrade();
                    }
                    return;
                }
                break;
            case "over":
                if(this.stateTime >= 100){
                    if(rogue.active){ rogue.battleLost(); return; }
                    page.change(3);
                    return;
                }
                break;
        }

        //衝撃波の直後は、ドローン君と龍以外が1フレームおきにしか動かない(スローモーション)
        var frozen = false;
        if(this.slowmo > 0){
            this.slowmo--;
            frozen = this.slowmo % 2 == 0;
        }
        dragonBlast.update();
        if(!frozen){
            arms.update(this.state == "play" && !this.down);
            this.updateEnemies();
            this.updateShots();
            this.updatePickups();
        }
        this.updateEffects();
        if(this.invincible > 0) this.invincible--;
        if(this.guard > 0) this.guard--;
        if(this.shake > 0) this.shake--;
        if(this.noFuelMsg > 0) this.noFuelMsg--;
        if(this.rareMsgTime > 0) this.rareMsgTime--;
    },

    //動くと燃料を使い、止まっていると回復する。空になると追従が遅くなる
    updateFuel:function(){
        this.fuel -= drone.Speed * FUEL_PER_PX;
        this.fuel = Math.min(this.fuel + FUEL_REGEN*(rogue.has("regen") ? 1.5 : 1), this.maxFuel);
        if(this.fuel <= 0){
            this.fuel = 0;
            //燃料切れになった瞬間に音で知らせる
            if(!this.fuelOut) sound.play("error");
            this.fuelOut = true;
            drone.slow = true;
        }
        if(drone.slow && this.fuel >= FUEL_RESUME){
            drone.slow = false;
            this.fuelOut = false;
        }
    },

    spawn:function(){
        if(this.toSpawn <= 0) return;
        this.spawnTimer--;
        if(this.spawnTimer > 0) return;
        this.spawnTimer = Math.max(22, 75 - game.wave*5) * (0.6 + Math.random()*0.8);
        this.toSpawn--;
        this.spawned++;
        //同胞が紛れ込む(WAVE3では必ず1体は出る)
        //(ローグライトでは同胞は出ない。ストーリーのネタバレになるため)
        var forceKin = game.wave == 3 && !this.kinForced && this.spawned >= 4 && !rogue.active;
        if(forceKin || (!rogue.active && Math.random() < kinRate(game.wave))){
            this.kinForced = true;
            enemies.push(makeEnemy("kin"));
            return;
        }
        //まれにレア敵が出る(人間との戦いでは補給機だけ)
        if(game.wave >= 2 && this.rares < RARE_MAX && Math.random() < RARE_RATE*(rogue.has("lucky") ? 2 : 1)){
            var r = makeRare(game.wave <= REVEAL_WAVE && Math.random() < 0.6 ? "goldbug" : "carrier");
            enemies.push(r);
            this.rares++;
            this.rareMsg = "レア敵「" + r.name + "」出現！" + (r.type == "goldbug" ? "　逃げる前に倒せ" : "　撃ち落とすと報酬カプセル");
            this.rareMsgTime = 150;
            sound.play("rare");
            return;
        }
        enemies.push(makeEnemy(pickEnemyType()));
    },

    //クリック：燃料を使って周りの敵をまとめて攻撃し、敵の弾を消す
    blast:function(){
        if(this.fuel < this.blastCost()){
            this.noFuelMsg = 60;
            sound.play("error");
            return;
        }
        this.fuel -= this.blastCost();
        //ピンチを切り抜けられるよう、周りの弾はすぐ消して少しのあいだ無敵に
        for(var i=enemyShots.length-1; i>=0; i--){
            if(Math.hypot(enemyShots[i].x - drone.X, enemyShots[i].y - drone.Y) < BLAST_RADIUS){
                enemyShots.splice(i,1);
            }
        }
        this.guard = BLAST_GUARD;
        this.slowmo = BLAST_SLOWMO;
        //五龍が敵に食らいつき、戻ってきて大爆発する(dragons.js)
        dragonBlast.cast(drone.X,drone.Y);
        coop.onBlast(drone.X,drone.Y,true);
    },

    //タッチ操作用の衝撃波ボタン(右下)
    touchBlast:{ x:CW - 66, y:CH - 104, r:42 },
    touchBlastHit:function(_x,_y){
        var b = this.touchBlast;
        return Math.hypot(_x - b.x, _y - b.y) < b.r + 8;
    },
    drawTouchBlast:function(){
        var b = this.touchBlast;
        var ok = this.fuel >= this.blastCost();
        ctx.fillStyle = ok ? "rgba(220,40,40,0.85)" : "rgba(160,160,160,0.6)";
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r - 6,0,Math.PI*2); ctx.stroke();
        //燃料がたまっていく様子
        ctx.strokeStyle = ok ? "#fff" : "#555";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r + 3,-Math.PI/2,-Math.PI/2 + Math.PI*2*Math.min(1,this.fuel/this.blastCost())); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 15px sans-serif";
        ctx.fillText("衝撃波",b.x,b.y);
        ctx.fillStyle = "#000";
    },

    //衝撃波に使う燃料(ローグライトのアイテム「衝撃波コア」で減る)
    blastCost:function(){
        return rogue.has("core") ? 28 : BLAST_COST;
    },
    //このWAVEのボス(ローグライトはステージで決まる)
    bossType:function(){
        return rogue.active ? rogue.bossType() : bossTypeFor(game.wave);
    },

    canBeHit:function(){
        return (this.state == "play" || this.state == "start") && this.invincible == 0 && this.guard == 0 && !this.down;
    },

    damage:function(){
        this.hp--;
        this.invincible = INVINCIBLE_TIME*(rogue.has("shield") ? 1.6 : 1);
        //反撃装甲：周りの敵の弾を消す
        if(rogue.has("thorns")){
            for(var i=enemyShots.length-1; i>=0; i--){
                if(Math.hypot(enemyShots[i].x - drone.X, enemyShots[i].y - drone.Y) < 130) enemyShots.splice(i,1);
            }
            fx.ring(drone.X,drone.Y,130,"136,51,153",16,5);
        }
        sound.play("damage");
        this.shake = 12;
        burst(drone.X,drone.Y,10,"#c33");
        if(this.hp <= 0 && coop.active){
            //協力プレイ：倒れて次のWAVEまで休む。ふたりとも倒れたらゲームオーバー(coop.update)
            this.hp = 0;
            this.down = true;
            sound.play("destroyed");
            this.shake = 25;
            burst(drone.X,drone.Y,40,"#333");
            burst(drone.X,drone.Y,20,"#e44");
            if(coop.isHost() && (!coop.partner || coop.partner.down || coop.partner.page != 1)){
                this.state = "over";
                this.stateTime = 0;
                sound.stopMusic();
            }
            return;
        }
        if(this.hp <= 0){
            this.hp = 0;
            this.state = "over";
            sound.stopMusic();
            sound.play("destroyed");
            this.stateTime = 0;
            this.shake = 25;
            burst(drone.X,drone.Y,40,"#333");
            burst(drone.X,drone.Y,20,"#e44");
        }
    },

    //_src：何で攻撃したか("gun","missile"など。シナジーの判定に使う)
    hitEnemy:function(_e,_dmg,_src){
        //対戦の相手：ダメージを数えて相手へ送るだけ(相手の耐久は相手の画面で減らす。versus.js)
        if(_e.rival){ versus.hit(_e,_dmg,_src); return; }
        //ゲストの攻撃はダメージをホストへ送るだけ(敵を動かしているのはホスト)
        if(coop.isGuest()){ coop.guestHit(_e,_dmg,_src); return; }
        if(_e.dead) return;
        _e.hp -= _dmg;
        _e.flash = 6;
        if(_e.hp > 0){
            sound.play("hit");
            return;
        }
        sound.play("kill");
        //撃破：スコアとパーツを落とす
        _e.dead = true;
        arms.onKill(_e,_src);
        game.score += _e.score;
        popup(_e.x,_e.y - _e.r,"+" + _e.score);
        burst(_e.x,_e.y,8 + _e.r,"#444");
        for(var i=0; i<_e.parts; i++) this.drop("part",_e.x,_e.y);
        if(Math.random() < FUEL_DROP_RATE) this.drop("fuel",_e.x,_e.y);
        special.onKill(_e);
        this.revenge(_e);
        rogue.onKill(_e);
    },

    //撃ち返し：WAVE4から、小さな敵が倒れぎわにドローンを狙って弾を撃つ
    revenge:function(_e){
        if(game.wave < 4 || this.state != "play") return;
        if(_e.type != "bug" && _e.type != "dasher") return;
        if(Math.random() > Math.min(1, 0.3 + (game.wave - 4)*0.1)) return;
        var tgt = nearestPlayer(_e.x,_e.y);
        var dx = tgt.X - _e.x, dy = tgt.Y - _e.y;
        if(Math.hypot(dx,dy) < 90) return;  //目の前で撃たれるのは避けようがないので撃たない
        fireFan(_e.x,_e.y,Math.atan2(dy,dx),game.wave >= 9 ? 3 : 1,0.3,2.4*danmaku(),"small");
    },

    drop:function(_kind,_x,_y){
        var a = Math.random()*Math.PI*2, s = 1 + Math.random()*2.5;
        //報酬カプセルは長めに残る
        pickups.push({ id:++pickupSeq, kind:_kind, x:_x, y:_y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
                       life:_kind == "capsule" ? PICKUP_LIFE*2 : PICKUP_LIFE, t:0 });
    },

    updateEnemies:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead) continue;
            e.t++;
            if(e.flash > 0) e.flash--;
            //狙うのは近い方のプレイヤー(ひとりのときは自分)
            var tgt = nearestPlayer(e.x,e.y);
            aimAt = tgt;
            var dx = tgt.X - e.x, dy = tgt.Y - e.y, d = Math.hypot(dx,dy) || 1;
            e.face = Math.atan2(dy,dx);

            //レア敵・ボスの動きはbosses.js
            if(!special.update(e,dx,dy,d) && !forces.update(e,dx,dy,d)) switch(e.type){
                case "bug":
                    //ふらつきながらドローンに寄ってくる
                    var wig = Math.sin(e.t*0.1) * 0.8;
                    e.vx += ((dx/d - dy/d*wig) * e.speed - e.vx) * 0.04;
                    e.vy += ((dy/d + dx/d*wig) * e.speed - e.vy) * 0.04;
                    break;
                case "tank":
                    e.vx += (dx/d*e.speed - e.vx) * 0.03;
                    e.vy += (dy/d*e.speed - e.vy) * 0.03;
                    //ときどき大きな弾の輪を撃つ
                    if(--e.timer <= 0 && this.state == "play" && e.x > 0 && e.x < CW && e.y > 0 && e.y < CH){
                        fireRing(e.x,e.y,game.wave >= 8 ? 12 : 8,1.5*danmaku(),e.t*0.1,"big");
                        sound.play("bossShot");
                        e.timer = 170;
                    }
                    break;
                case "spinner":
                    var mx = e.tx - e.x, my = e.ty - e.y, md = Math.hypot(mx,my);
                    if(e.firing > 0){
                        //止まって回りながら渦巻き状に撃つ
                        e.vx = 0; e.vy = 0;
                        e.firing--;
                        e.spin += 0.28;
                        if(e.firing % 6 == 0 && this.state == "play"){
                            var arms = game.wave >= 7 ? 3 : 2;
                            fireRing(e.x,e.y,arms,2.1*danmaku(),e.spin,"small");
                            sound.play("enemyShot");
                        }
                        if(e.firing == 0){ e.timer = 100; setShooterTarget(e); }
                    }else if(md > 3){
                        e.vx = mx/md*e.speed; e.vy = my/md*e.speed;
                    }else{
                        e.vx = 0; e.vy = 0;
                        if(--e.timer <= 0) e.firing = 60;
                    }
                    break;
                case "bomber":
                    if(e.fuse > 0){
                        //点滅しながら止まり、最後に弾の輪をまき散らして消える
                        e.vx *= 0.85; e.vy *= 0.85;
                        if(--e.fuse == 0){
                            var n = Math.min(24, Math.round(12*danmaku()));
                            fireRing(e.x,e.y,n,2.3*danmaku(),Math.random(),"normal");
                            fireRing(e.x,e.y,Math.round(n/2),1.5*danmaku(),Math.random(),"big");
                            burst(e.x,e.y,20,"#c33");
                            effects.push({ ring:true, x:e.x, y:e.y, life:14, maxLife:14, R:60, color:"220,40,40" });
                            sound.play("explode");
                            e.dead = true;  //自爆なので報酬は無し
                        }
                    }else{
                        e.vx += (dx/d*e.speed - e.vx) * 0.04;
                        e.vy += (dy/d*e.speed - e.vy) * 0.04;
                        if((d < 130 || --e.timer <= 0) && this.state == "play"){
                            e.fuse = 45;
                            sound.play("error");
                        }
                    }
                    break;
                case "dasher":
                    if(e.timer > 0){
                        //狙っている間は止まってドローンの方を向く
                        e.timer--;
                        e.aimX = dx/d; e.aimY = dy/d;
                        e.vx *= 0.8; e.vy *= 0.8;
                        if(e.timer == 0){ e.vx = e.aimX*e.speed; e.vy = e.aimY*e.speed; sound.play("dash"); }
                    }
                    break;
                case "shooter":
                    var mx = e.tx - e.x, my = e.ty - e.y, md = Math.hypot(mx,my);
                    if(md > 3){
                        e.vx = mx/md*e.speed; e.vy = my/md*e.speed;
                    }else{
                        e.vx = 0; e.vy = 0;
                        e.timer--;
                        if(e.timer <= 0 && this.state == "play"){
                            //ドローンを狙って扇状に撃ったら、次の場所へ移動
                            fireFan(e.x,e.y,Math.atan2(dy,dx),game.wave >= 6 ? 5 : 3,0.26,2.8*danmaku(),"normal");
                            e.timer = 55;
                            sound.play("enemyShot");
                            setShooterTarget(e);
                        }
                    }
                    break;
            }
            //EMPを受けた敵は遅くなる
            var sp = 1;
            if(e.slow > 0){ e.slow--; sp = e.boss ? 0.7 : 0.4; }
            //水鉄砲で濡れた敵も少し遅くなる
            if(e.wet > 0){ e.wet--; sp *= 0.85; }
            e.x += e.vx*sp;
            e.y += e.vy*sp;
            if(e.dead) continue;  //逃げていったレア敵

            //突進した敵は画面の外に出たら消える(倒した扱いにはしない)
            if(e.type == "dasher" && e.timer <= 0 &&
               (e.x < -60 || e.x > CW+60 || e.y < -60 || e.y > CH+60)){
                e.dead = true;
                continue;
            }

            //体当たり：ドローンは被弾、敵もダメージを受けて弾き返される
            //体当たりの判定は自分のドローン君だけ(相方は相方の画面で判定する)
            var ld = Math.hypot(drone.X - e.x, drone.Y - e.y);
            if(ld < e.r + drone.R && this.canBeHit() && !e.harmless){
                this.damage();
                this.hitEnemy(e,1);
                if(!e.boss){ e.vx = -dx/d*5; e.vy = -dy/d*5; }
                if(e.type == "dasher") e.timer = 0;
            }
        }
        enemies = enemies.filter(function(e){ return !e.dead; });
    },

    //敵の弾
    //当たり判定はドローン中心の小さな点だけ。すれすれでよけると「かすり」で燃料が回復する
    updateShots:function(){
        for(var i=enemyShots.length-1; i>=0; i--){
            var b = enemyShots[i];
            if(b.homing){
                //追尾弾(ドローン君改のミサイル・龍)：少しずつドローン君の方へ曲がり、時間で消える
                var cur = Math.atan2(b.vy,b.vx);
                var ht = nearestPlayer(b.x,b.y);
                cur = turnTo(cur, Math.atan2(ht.Y - b.y, ht.X - b.x), b.turn);
                b.vx = Math.cos(cur)*b.speed;
                b.vy = Math.sin(cur)*b.speed;
                if(b.trail){
                    b.trail.unshift({ x:b.x, y:b.y });
                    if(b.trail.length > 16) b.trail.pop();
                }
                if(--b.life <= 0){
                    burst(b.x,b.y,6,"#a33");
                    enemyShots.splice(i,1);
                    continue;
                }
            }
            b.x += b.vx; b.y += b.vy;
            if(!b.homing && (b.x < -20 || b.x > CW+20 || b.y < -20 || b.y > CH+20)){
                enemyShots.splice(i,1);
                continue;
            }
            if(this.state == "over") continue;
            var d = Math.hypot(b.x - drone.X, b.y - drone.Y);
            var r = b.r || 5;
            if(d < r + HIT_CORE && this.canBeHit()){
                enemyShots.splice(i,1);
                this.damage();
            }else if(!b.grazed && d < r + GRAZE_RANGE*(rogue.has("graze") ? 1.6 : 1) && !this.down && (!coop.isGuest() || coop.grazeCd <= 0)){
                b.grazed = true;
                if(coop.isGuest()) coop.grazeCd = 6;   //ゲストの弾は届くたびに作り直すので、続けてかすらないように
                this.graze++;
                this.fuel = Math.min(this.maxFuel, this.fuel + GRAZE_FUEL*(rogue.has("graze") ? 2 : 1));
                game.score += 2;
                effects.push({ x:drone.X + (b.x - drone.X)*0.6, y:drone.Y + (b.y - drone.Y)*0.6,
                               vx:(Math.random()-0.5)*2, vy:(Math.random()-0.5)*2,
                               life:12, maxLife:12, size:2.5, glow:"80,160,255" });
                sound.play("graze");
            }
        }
    },

    updatePickups:function(){
        for(var i=pickups.length-1; i>=0; i--){
            var p = pickups[i];
            p.t++;
            p.life--;
            p.vx *= 0.9; p.vy *= 0.9;
            p.x += p.vx; p.y += p.vy;
            if(this.state == "over"){
                if(p.life <= 0) pickups.splice(i,1);
                continue;
            }
            //近くのアイテムは近い方のプレイヤーへ吸い寄せる(WAVEクリア時は全部)
            var mt = nearestPlayer(p.x,p.y);
            var mx = mt.X - p.x, my = mt.Y - p.y, md = Math.hypot(mx,my) || 1;
            if(this.state == "clear" || md < MAGNET_RANGE*(rogue.has("magnet") ? 2 : 1)){
                var s = Math.min(this.state == "clear" ? 12 : 6, md);
                p.x += mx/md*s; p.y += my/md*s;
            }
            //拾えるのは自分のドローン君だけ(相方が拾ったものは相方の画面から知らせが来る)
            var dx = drone.X - p.x, dy = drone.Y - p.y, d = Math.hypot(dx,dy) || 1;
            if(d < drone.R + 6 && !this.down){
                coop.onCollect(p);
                if(p.kind == "part"){
                    game.parts++;
                    sound.play("part");
                }else if(p.kind == "capsule"){
                    //WAVEクリア後に選べる報酬が1回増える
                    game.pendingReward = (game.pendingReward || 0) + 1;
                    popup(p.x,p.y - 10,"報酬カプセル！ 報酬+1","#b8860b");
                    sound.play("reward");
                }else{
                    this.fuel = Math.min(this.maxFuel, this.fuel + 40);
                    popup(p.x,p.y - 10,"燃料+40","#c33");
                    sound.play("fuel");
                }
                pickups.splice(i,1);
            }else if(p.life <= 0){
                pickups.splice(i,1);
            }
        }
    },

    updateEffects:function(){
        //演出が増えすぎたら古いものから消す(重くならないように)
        if(effects.length > 700) effects.splice(0, effects.length - 700);
        for(var i=effects.length-1; i>=0; i--){
            var f = effects[i];
            f.life--;
            if(!f.ring && !f.line && !f.flare){ f.x += f.vx; f.y += f.vy; f.vx *= 0.92; f.vy *= 0.92; }
            if(f.life <= 0) effects.splice(i,1);
        }
        for(var i=popups.length-1; i>=0; i--){
            popups[i].y -= 0.6;
            popups[i].life--;
            if(popups[i].life <= 0) popups.splice(i,1);
        }
    },

    //----------------------------------------------------------------- 描画
    draw:function(){
        ctx.save();
        if(this.shake > 0){
            ctx.translate((Math.random()-0.5)*this.shake, (Math.random()-0.5)*this.shake);
        }
        this.drawBackground();

        //自動攻撃の射程
        if(this.state != "over"){
            ctx.strokeStyle = "rgba(0,0,0,0.06)";
            ctx.beginPath();
            ctx.arc(drone.X,drone.Y,game.range(),0,Math.PI*2);
            ctx.stroke();
        }

        for(var i=0; i<pickups.length; i++) this.drawPickup(pickups[i]);
        //ボスの攻撃予告・レーザーは敵より奥に描く
        for(var i=0; i<enemies.length; i++) if(enemies[i].boss) special.drawAttack(enemies[i]);
        for(var i=0; i<enemies.length; i++) this.drawEnemy(enemies[i]);

        //ドローンの装備(弾・ミサイル・虫など)
        arms.draw(this.state != "over");
        //五龍の衝撃波
        dragonBlast.draw();

        //敵の弾(種類ごとに色と大きさが違う。白い芯で見やすく)
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            var r = b.r || 5;
            if(b.kind == "missile"){
                //ドローン君改のミサイル(黒い弾頭の赤い筒)
                ctx.save();
                ctx.translate(b.x,b.y);
                ctx.rotate(Math.atan2(b.vy,b.vx));
                ctx.fillStyle = "rgba(255,120,40,0.6)";
                ctx.beginPath(); ctx.arc(-9,0,4 + Math.random()*2,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#b01e28";
                ctx.fillRect(-8,-3.5,13,7);
                ctx.fillStyle = "#111";
                ctx.beginPath(); ctx.moveTo(5,-3.5); ctx.lineTo(10,0); ctx.lineTo(5,3.5); ctx.fill();
                ctx.restore();
                continue;
            }
            if(b.kind == "dragon"){
                //ドローン君改の黒い龍(胴体は通った跡)
                var tr = b.trail || [];
                for(var j=tr.length-1; j>=0; j--){
                    var k = 1 - j/16, rr = 2 + k*7;
                    ctx.fillStyle = "rgba(20,10,12,0.9)";
                    ctx.beginPath(); ctx.arc(tr[j].x,tr[j].y,rr + 1.5,0,Math.PI*2); ctx.fill();
                    ctx.fillStyle = "rgb(" + b.color + ")";
                    ctx.beginPath(); ctx.arc(tr[j].x,tr[j].y,rr,0,Math.PI*2); ctx.fill();
                }
                ctx.save();
                ctx.translate(b.x,b.y);
                ctx.rotate(Math.atan2(b.vy,b.vx));
                ctx.fillStyle = "#140a0c";
                ctx.beginPath(); ctx.ellipse(2,0,12,8,0,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle = "#140a0c"; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.moveTo(-2,-5); ctx.lineTo(-13,-13); ctx.moveTo(-2,5); ctx.lineTo(-13,13); ctx.stroke();
                ctx.lineWidth = 1;
                ctx.fillStyle = "#ff2030";
                ctx.beginPath(); ctx.arc(6,-3.5,2.2,0,Math.PI*2); ctx.arc(6,3.5,2.2,0,Math.PI*2); ctx.fill();
                ctx.restore();
                continue;
            }
            ctx.fillStyle = b.kind == "small" ? "#e8700a" : (b.kind == "big" ? "#8a3fd1" : (b.kind == "water" ? "#1f8fc4" : "#d22"));
            ctx.beginPath(); ctx.arc(b.x,b.y,r + 1,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(b.x,b.y,r*0.45,0,Math.PI*2); ctx.fill();
        }

        //ドローン(被弾後の無敵中は点滅、撃墜されたら消える)
        //協力プレイの相方
        coop.drawPartner();
        if(this.state != "over" && !this.down && Math.floor(this.invincible/4) % 2 == 0){
            drone.draw();
        }
        //敵の弾に対する当たり判定(中心の点)
        if(this.state != "over"){
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(drone.X,drone.Y,HIT_CORE*0.75 + 1.5,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = "#e22";
            ctx.beginPath(); ctx.arc(drone.X,drone.Y,HIT_CORE*0.75,0,Math.PI*2); ctx.fill();
        }

        this.drawEffects();
        ctx.font = "bold 14px sans-serif";
        if(this.fuelOut && this.state != "over" && !this.down){
            this.drawSlowMark("燃料切れ！止まると回復", "210,40,40", 38);
        }else if(this.noFuelMsg > 0){
            ctx.fillStyle = "#c33";
            ctx.fillText("燃料が足りない！",drone.X,drone.Y - 34);
        }
        ctx.restore();

        //連鎖爆破などで画面全体がうっすら色づく
        if(this.tint){
            ctx.fillStyle = "rgba(" + this.tint.color + "," + (0.16*this.tint.life/this.tint.maxLife) + ")";
            ctx.fillRect(0,0,CW,CH);
        }

        this.drawHud();
        coop.drawHud();
        if(this.down && this.state != "over"){
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 22px sans-serif";
            ctx.fillStyle = "rgba(200,40,40,0.9)";
            ctx.fillText("ダウン中……次のWAVEで復帰します。相方をたのむ！",CW/2,CH/2 + 80);
            ctx.fillStyle = "#000";
        }
        special.drawBossBar();
        //レア敵の出現案内
        if(this.rareMsgTime > 0){
            ctx.globalAlpha = Math.min(1, this.rareMsgTime/30);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 16px sans-serif";
            ctx.fillStyle = "#b8860b";
            ctx.fillText("★ " + this.rareMsg,CW/2,this.bossWave ? 100 : 70);
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#000";
        }
        this.drawBanner();

        if(this.paused){
            ctx.fillStyle = "rgba(255,255,255,0.75)";
            ctx.fillRect(0,0,CW,CH);
            ctx.fillStyle = "#000";
            ctx.textAlign = "center";
            ctx.font = "bold 40px serif";
            ctx.fillText("一時停止中",CW/2,CH/2 - 20);
            ctx.font = "18px sans-serif";
            ctx.fillText(inputMode == "touch" ? "画面をタッチすると再開します" : "キャンバスにマウスを戻すと再開します",CW/2,CH/2 + 25);
        }
        ctx.fillStyle = "#000";
    },

    //追従が遅くなっていることを、ドローン君のまわりで知らせる(気づかないまま鈍くなるのを防ぐ)
    //_color："r,g,b"　_dy：文字をドローン君の中心から何px上に出すか
    drawSlowMark:function(_text,_color,_dy){
        var a = 0.65 + 0.3*Math.sin(this.clock*0.25);    //点滅
        ctx.strokeStyle = "rgba(" + _color + "," + a + ")";
        ctx.lineWidth = 4;
        ctx.setLineDash([6,5]);
        ctx.beginPath(); ctx.arc(drone.X,drone.Y,drone.R + 16,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.strokeText(_text,drone.X,drone.Y - _dy);
        ctx.lineJoin = "miter";
        ctx.lineWidth = 1;
        ctx.fillStyle = "rgb(" + _color + ")";
        ctx.fillText(_text,drone.X,drone.Y - _dy);
        ctx.fillStyle = "#000";
    },

    //破片・衝撃波・文字(対戦画面からも使う)
    drawEffects:function(){
        //破片・衝撃波
        for(var i=0; i<effects.length; i++){
            var f = effects[i];
            var k = 1 - f.life/f.maxLife;   //0→1へ進む
            if(f.ring){
                //R・colorが無ければクリックの衝撃波。wで太さ
                ctx.strokeStyle = "rgba(" + (f.color || "220,40,40") + "," + (1-k) + ")";
                ctx.lineWidth = (f.w || 4)*(1 - k*0.5);
                ctx.beginPath(); ctx.arc(f.x,f.y,Math.max(1,(f.R || BLAST_RADIUS)*k),0,Math.PI*2); ctx.stroke();
                ctx.lineWidth = 1;
            }else if(f.flare){
                //光の玉(中心が濃く、外に向かって透明)
                var R = f.R*(0.5 + 0.5*Math.min(1,k*3));
                var g = ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,R);
                g.addColorStop(0,"rgba(" + f.color + "," + (0.9*(1-k)) + ")");
                g.addColorStop(0.4,"rgba(" + f.color + "," + (0.5*(1-k)) + ")");
                g.addColorStop(1,"rgba(" + f.color + ",0)");
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(f.x,f.y,R,0,Math.PI*2); ctx.fill();
            }else if(f.line){
                //導火線・残像などの線
                ctx.strokeStyle = "rgba(" + f.color + "," + (1-k) + ")";
                ctx.lineWidth = f.w*(1-k*0.6);
                ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(f.x2,f.y2); ctx.stroke();
                ctx.lineCap = "butt";
                ctx.lineWidth = 1;
            }else if(f.glow){
                //光る火花(色付きのにじみ＋芯)
                var a = Math.min(1, f.life/f.maxLife*2);
                ctx.fillStyle = "rgba(" + f.glow + "," + (0.3*a) + ")";
                ctx.beginPath(); ctx.arc(f.x,f.y,f.size*1.8,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "rgba(" + f.glow + "," + a + ")";
                ctx.beginPath(); ctx.arc(f.x,f.y,f.size*0.7,0,Math.PI*2); ctx.fill();
            }else{
                ctx.globalAlpha = Math.min(1, f.life/f.maxLife*2);
                ctx.fillStyle = f.color;
                ctx.fillRect(f.x - f.size/2, f.y - f.size/2, f.size, f.size);
                ctx.globalAlpha = 1;
            }
        }

        //文字(bigはシナジー名など。白いふちどりで目立たせ、ぽんと大きく出る)
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for(var i=0; i<popups.length; i++){
            var p = popups[i];
            ctx.globalAlpha = Math.min(1, p.life/20);
            if(p.big){
                var age = p.maxLife - p.life;
                var sc = age < 6 ? 1.6 - age*0.1 : 1;
                ctx.font = "900 " + Math.round(20*sc) + "px sans-serif";
                ctx.lineJoin = "round";
                ctx.lineWidth = 6;
                ctx.strokeStyle = "rgba(20,20,24,0.9)";
                ctx.strokeText(p.text,p.x,p.y);
                ctx.lineJoin = "miter";
                ctx.lineWidth = 1;
            }else{
                ctx.font = "bold 14px sans-serif";
            }
            ctx.fillStyle = p.color;
            ctx.fillText(p.text,p.x,p.y);
        }
        ctx.globalAlpha = 1;
    },

    drawBackground:function(){
        ctx.strokeStyle = "#f0f0f0";
        ctx.beginPath();
        for(var x=0; x<=CW; x+=GS){ ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,CH); }
        for(var y=0; y<=CH; y+=GS){ ctx.moveTo(0,y+0.5); ctx.lineTo(CW,y+0.5); }
        ctx.stroke();
    },

    drawEnemy:function(_e){
        var body = _e.flash > 0 ? "#fff" : null;
        ctx.save();
        ctx.translate(_e.x,_e.y);
        //レア敵・ボスの見た目はbosses.js
        if(!special.draw(_e,body) && !forces.draw(_e,body)) switch(_e.type){
            case "bug":
                //羽をぱたぱたさせる
                var wing = 4 + Math.abs(Math.sin(_e.t*0.5))*6;
                ctx.fillStyle = "#aaa";
                ctx.beginPath(); ctx.ellipse(-8,-6,wing,4,-0.5,0,Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(8,-6,wing,4,0.5,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = body || "#333";
                ctx.beginPath(); ctx.arc(0,0,_e.r,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = "#e33";
                ctx.fillRect(-5,-3,3,3); ctx.fillRect(2,-3,3,3);
                break;
            case "dasher":
                //突進の予告線
                if(_e.timer > 0){
                    ctx.strokeStyle = "rgba(220,40,40," + (0.15 + 0.25*(1 - _e.timer/60)) + ")";
                    ctx.setLineDash([6,6]);
                    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(_e.aimX*1200,_e.aimY*1200); ctx.stroke();
                    ctx.setLineDash([]);
                }
                var a = Math.atan2(_e.timer > 0 ? _e.aimY : _e.vy, _e.timer > 0 ? _e.aimX : _e.vx);
                ctx.rotate(a);
                ctx.fillStyle = body || (_e.timer > 0 && Math.floor(_e.t/5) % 2 == 0 ? "#c33" : "#222");
                ctx.beginPath();
                ctx.moveTo(_e.r+4,0); ctx.lineTo(-_e.r,-_e.r); ctx.lineTo(-_e.r*0.4,0); ctx.lineTo(-_e.r,_e.r);
                ctx.closePath(); ctx.fill();
                break;
            case "shooter":
                //砲身を狙っている相手に向ける
                ctx.rotate(_e.face || 0);
                ctx.fillStyle = "#666";
                ctx.fillRect(0,-3,_e.r+8,6);
                ctx.fillStyle = body || "#444";
                ctx.fillRect(-_e.r,-_e.r,_e.r*2,_e.r*2);
                //撃つ直前は赤く光る
                ctx.fillStyle = (_e.vx == 0 && _e.vy == 0 && _e.timer < 20) ? "#f33" : "#822";
                ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
                break;
            case "spinner":
                //回転砲台：回る十字の砲身
                ctx.save();
                ctx.rotate(_e.spin);
                ctx.fillStyle = "#666";
                var arms = game.wave >= 7 ? 3 : 2;
                for(var i=0; i<arms; i++){
                    ctx.rotate(Math.PI*2/arms);
                    ctx.fillRect(0,-3,_e.r + 7,6);
                }
                ctx.restore();
                ctx.fillStyle = body || "#3b3b44";
                ctx.beginPath(); ctx.arc(0,0,_e.r,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = _e.firing > 0 ? "#f80" : "#a52";
                ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
                break;
            case "bomber":
                //自爆機：とげのある丸。自爆直前は赤く点滅してふくらむ
                var blink = _e.fuse > 0 && Math.floor(_e.fuse/4) % 2 == 0;
                var sc = _e.fuse > 0 ? 1 + (45 - _e.fuse)/90 : 1;
                ctx.scale(sc,sc);
                ctx.fillStyle = body || (blink ? "#e22" : "#4a3a3a");
                ctx.beginPath();
                for(var i=0; i<16; i++){
                    var a = i*Math.PI/8, rr = i % 2 ? _e.r*0.75 : _e.r*1.15;
                    ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
                }
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = blink ? "#fff" : "#e33";
                ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
                break;
            case "tank":
                ctx.fillStyle = body || "#555";
                ctx.beginPath();
                for(var i=0; i<6; i++){
                    var ang = Math.PI/3*i + _e.t*0.01;
                    ctx.lineTo(Math.cos(ang)*_e.r, Math.sin(ang)*_e.r);
                }
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = "#222"; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
                ctx.fillStyle = "#e33";
                ctx.fillRect(-6,-4,4,4); ctx.fillRect(2,-4,4,4);
                break;
        }
        ctx.restore();

        //濡れている敵：水色のしずくがしたたる
        if(_e.wet > 0){
            ctx.fillStyle = "rgba(41,163,214," + Math.min(1,_e.wet/40) + ")";
            for(var i=0; i<2; i++){
                var ph = ((_e.t*0.04 + i*0.5) % 1);
                var dx = (i == 0 ? -0.45 : 0.4)*_e.r;
                ctx.beginPath(); ctx.arc(_e.x + dx, _e.y + _e.r*0.6 + ph*12, 2.2*(1 - ph*0.5),0,Math.PI*2); ctx.fill();
            }
            ctx.strokeStyle = "rgba(41,163,214,0.45)";
            ctx.beginPath(); ctx.arc(_e.x,_e.y,_e.r + 2,Math.PI*0.15,Math.PI*0.85); ctx.stroke();
        }

        //EMPで遅くなっている敵
        if(_e.slow > 0){
            ctx.strokeStyle = "rgba(130,90,200,0.8)";
            ctx.setLineDash([3,3]);
            ctx.beginPath(); ctx.arc(_e.x,_e.y,_e.r + 5,0,Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
        }

        //体力ゲージ(硬い敵が傷ついたとき)
        if(_e.maxHp > 1 && _e.hp < _e.maxHp && !_e.boss){
            var w = _e.r*2;
            ctx.fillStyle = "#ddd";
            ctx.fillRect(_e.x - w/2, _e.y - _e.r - 10, w, 4);
            ctx.fillStyle = "#c33";
            ctx.fillRect(_e.x - w/2, _e.y - _e.r - 10, w*_e.hp/_e.maxHp, 4);
        }
    },

    drawPickup:function(_p){
        //消える直前は点滅
        if(_p.life < 120 && Math.floor(_p.life/6) % 2 == 0) return;
        ctx.save();
        ctx.translate(_p.x,_p.y);
        if(_p.kind == "capsule"){
            //報酬カプセル：金色の箱が上下に揺れる
            ctx.translate(0,Math.sin(_p.t*0.1)*3);
            ctx.strokeStyle = "rgba(230,180,34,0.5)";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0,0,15 + Math.sin(_p.t*0.15)*2,0,Math.PI*2); ctx.stroke();
            ctx.lineWidth = 1;
            ctx.fillStyle = "#e6b422";
            ctx.fillRect(-9,-8,18,16);
            ctx.strokeStyle = "#7a5a00";
            ctx.strokeRect(-9.5,-8.5,19,17);
            ctx.fillStyle = "#7a5a00";
            ctx.font = "bold 12px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("!",0,1);
        }else if(_p.kind == "part"){
            ctx.rotate(_p.t*0.05);
            ctx.fillStyle = "#777";
            ctx.fillRect(-5,-5,10,10);
            ctx.strokeStyle = "#222";
            ctx.strokeRect(-5.5,-5.5,11,11);
            ctx.fillStyle = "#fff";
            ctx.fillRect(-1.5,-1.5,3,3);
        }else{
            ctx.fillStyle = "#d33";
            ctx.fillRect(-6,-8,12,16);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("F",0,1);
        }
        ctx.restore();
    },

    drawHud:function(){
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = "#000";

        //耐久
        ctx.fillText("耐久",14,20);
        for(var i=0; i<this.maxHp; i++){
            if(i < this.hp){
                ctx.fillStyle = "#d33";
                ctx.fillRect(56 + i*18,13,14,14);
            }else{
                ctx.strokeStyle = "#999";
                ctx.strokeRect(56.5 + i*18,13.5,13,13);
            }
        }

        //燃料
        ctx.fillStyle = "#000";
        ctx.fillText("燃料",14,44);
        var bw = 160;
        ctx.strokeStyle = "#000";
        ctx.strokeRect(56.5,37.5,bw,13);
        ctx.fillStyle = drone.slow ? "#d33" : (this.fuel >= this.blastCost() ? "#555" : "#aaa");
        ctx.fillRect(58,39,(bw-3)*this.fuel/this.maxFuel,10);
        //衝撃波に必要な量の目盛り
        ctx.fillStyle = "#d33";
        ctx.fillRect(57 + bw*this.blastCost()/this.maxFuel,34,2,20);
        if(drone.slow){
            ctx.fillStyle = "#d33";
            ctx.fillText("燃料切れ！",bw + 66,44);
        }

        //装備(下のゲージは次の攻撃までの溜まり具合)と発動中のシナジー
        var eq = arms.equipped();
        for(var i=0; i<eq.length; i++){
            var ix = 14 + i*30;
            drawWeaponIcon(eq[i],ix,60,24);
            ctx.fillStyle = "#ddd";
            ctx.fillRect(ix,86,24,3);
            ctx.fillStyle = "#333";
            ctx.fillRect(ix,86,24*Math.max(0,Math.min(1,arms.charge(eq[i]))),3);
        }
        var syn = activeSynergies();
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#c33";
        for(var i=0; i<syn.length; i++){
            ctx.fillText("◆" + syn[i].name,24 + eq.length*30,66 + i*16);
        }

        //右上：WAVE・残り・スコア・パーツ
        ctx.textAlign = "right";
        ctx.fillStyle = "#000";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(rogue.active ? rogue.label() : "WAVE " + game.wave + " / " + FINAL_WAVE,CW - 14,20);
        ctx.font = "bold 14px sans-serif";
        ctx.fillText("残りの敵 " + (this.toSpawn + enemies.length) + "　SCORE " + game.score + "　パーツ " + game.parts,CW - 14,44);
        if(this.graze > 0){
            ctx.font = "bold 12px sans-serif";
            ctx.fillStyle = "#3a7bd5";
            ctx.fillText("かすり " + this.graze,CW - 14,64);
        }

        //操作のヒント(最初の2WAVEだけ)
        var touch = inputMode == "touch";
        if(game.wave <= 2){
            ctx.textAlign = "left";
            ctx.font = "13px sans-serif";
            ctx.fillStyle = "#777";
            if(touch){
                ctx.fillText("画面のどこでもドラッグで移動（指の動いた分だけ動く）　／　右下のボタン：衝撃波（燃料" + this.blastCost() + "・弾も消す）",14,CH - 36);
            }else{
                ctx.fillText("敵には自動で攻撃します　／　クリック：衝撃波（燃料" + this.blastCost() + "・弾も消す）　／　動くと燃料を使い、止まると回復",14,CH - 36);
            }
            ctx.fillText("弾は中心の赤い点に当たらなければ大丈夫。すれすれでかすると燃料が回復",14,CH - 16);
        }
        if(touch && this.state != "over") this.drawTouchBlast();
        ctx.fillStyle = "#000";
    },

    drawBanner:function(){
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if(this.state == "start" && this.bossWave){
            //ボス接近の警告(点滅する赤い帯)
            var on = Math.floor(this.stateTime/15) % 2 == 0;
            ctx.globalAlpha = Math.min(1, (150 - this.stateTime)/20);
            ctx.fillStyle = "rgba(210,40,40," + (on ? 0.85 : 0.6) + ")";
            ctx.fillRect(0,CH/2 - 110,CW,100);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 56px serif";
            ctx.fillText("WARNING",CW/2,CH/2 - 72);
            ctx.font = "bold 18px sans-serif";
            ctx.fillText((rogue.active ? "ステージ" + rogue.stage : "WAVE " + game.wave) + "　ボス「" + BOSS_TYPES[this.bossType()].name + "」接近中",CW/2,CH/2 - 30);
            ctx.globalAlpha = 1;
        }else if(this.state == "start"){
            ctx.globalAlpha = Math.min(1, (60 - this.stateTime)/20);
            ctx.font = "bold 56px serif";
            ctx.fillStyle = "#000";
            ctx.fillText(rogue.active ? rogue.label() : "WAVE " + game.wave,CW/2,CH/2 - 60);
            ctx.globalAlpha = 1;
        }else if(this.state == "clear"){
            ctx.font = "bold 56px serif";
            ctx.fillStyle = "#000";
            ctx.fillText("WAVE CLEAR！",CW/2,CH/2 - 60);
            ctx.font = "bold 20px sans-serif";
            ctx.fillText("クリアボーナス　パーツ+" + this.bonus,CW/2,CH/2 - 10);
        }
    }
};
