//------------------------------------------------------------------------------
//  ローグライト
//  ・3ステージ。各ステージは分岐マップ(5階層＋ボス)。行き先を選びながら進む
//    マス：戦闘・強敵・宝箱・ショップ・休憩・ボス
//  ・耐久はステージの中では戦闘をまたいで持ち越す(休憩で回復。ステージが変わると全回復)
//  ・戦闘の報酬・能力強化・装備は強化画面(upgradeScreen)をそのまま使う
//  ・アイテム：ランの間だけ効くパッシブ効果(宝箱・強敵・ボス・ショップで手に入る)
//  ・メタ進行：ランで集めた「コア」で永続強化(研究所)。条件を満たすと新しいアイテム・武器が解放される
//  ・ネタバレを避けるため、同胞・人間の兵器は出さない。ステージ3のボスはストーリーをクリアしていればドローン君改
//  画面：page 8 研究所(rogueHub) / page 9 マップ(rogueMap。宝箱・ショップ・休憩・結果もここ)
//------------------------------------------------------------------------------
const RG_STAGES = 3;              //ステージ数
const RG_LAYERS = 5;              //ボスの前の階層数
const RG_LEVEL_PER_STAGE = 5;     //ステージが1つ進むごとの難しさ(WAVE換算)の上がり幅
const RG_ELITE_PLUS = 2;          //強敵の難しさの上乗せ(WAVE換算)
const RG_SPAWN_BASE = 6;          //通常戦の敵の数 = RG_SPAWN_BASE + 難しさ × RG_SPAWN_PER
const RG_SPAWN_PER = 2;
const RG_ELITE_MUL = 1.4;         //強敵マスの敵の数の倍率
const RG_BASE_HP = 1;             //ローグライトでは耐久を持ち越すので、最初から少し多めに
const RG_REST_HEAL = 2;           //休憩で回復する耐久
const RG_REST_PARTS = 12;         //休憩で「整備する」を選んだときのパーツ
const RG_CHEST_PARTS = 15;        //宝箱にアイテムが残っていないときのパーツ
const RG_PRICE = { item:25, weapon:18, heal:10 };   //ショップの値段(パーツ)
const RG_CORE = { battle:1, elite:3, boss:5, clear:15 };  //コアの獲得量(ボスはステージ数を掛ける)
const RG_RUN_KEY = "dronekun_rogue_run";
const RG_META_KEY = "dronekun_rogue_meta";

//アイテム(ランの間だけ効く)。start:trueは最初から出る。それ以外は解放が必要
const RG_ITEMS = {
    armor:    { name:"装甲板",       mark:"甲", color:"#666",    start:true, desc:"最大耐久+1" },
    battery:  { name:"予備タンク",   mark:"槽", color:"#c63",    start:true, desc:"最大燃料+30" },
    regen:    { name:"再生回路",     mark:"再", color:"#3a7",    start:true, desc:"燃料の回復が1.5倍" },
    magnet:   { name:"強力磁石",     mark:"磁", color:"#a33",    start:true, desc:"アイテムを吸い寄せる距離が2倍" },
    scope:    { name:"照準器",       mark:"照", color:"#337",    start:true, desc:"射程+50" },
    piggy:    { name:"貯金箱",       mark:"貯", color:"#d8a",    start:true, desc:"敵が落とすパーツが1.5倍" },
    repair:   { name:"修理ドローン", mark:"修", color:"#2a8",    start:true, desc:"戦闘に勝つたび耐久が1回復" },
    midas:    { name:"黄金のネジ",   mark:"金", color:"#b8860b", start:true, desc:"戦闘に勝つたびパーツ+3" },
    overclock:{ name:"オーバークロック", mark:"速", color:"#d22", desc:"全装備の攻撃間隔が15%短い" },
    powder:   { name:"火薬袋",       mark:"火", color:"#e70",    desc:"敵を倒すと小さく爆発し、周りの敵にダメージ" },
    lucky:    { name:"幸運のお守り", mark:"運", color:"#6a3",    desc:"レア敵が2倍出やすい" },
    graze:    { name:"かすりセンサー", mark:"掠", color:"#38c",  desc:"かすりの範囲が1.6倍・燃料の回復が2倍" },
    thorns:   { name:"反撃装甲",     mark:"反", color:"#839",    desc:"被弾すると周りの敵の弾を消す" },
    shield:   { name:"衝撃吸収材",   mark:"吸", color:"#58a",    desc:"被弾後の無敵時間が1.6倍" },
    core:     { name:"衝撃波コア",   mark:"核", color:"#c33",    desc:"衝撃波の燃料が40→28" },
    vampire:  { name:"吸収装甲",     mark:"命", color:"#900",    desc:"敵を15体倒すごとに耐久が1回復" }
};
const RG_ITEM_IDS = Object.keys(RG_ITEMS);
const RG_START_WEAPONS = ["gun","missile","laser","bug","tesla","mine"];   //最初から出る武器
const RG_VAMPIRE_KILLS = 15;
const RG_POWDER_R = 55;           //火薬袋の爆発の範囲

//永続強化(研究所でコアを使う)。cost はレベルごとの値段
const RG_UPGRADES = [
    { key:"hp",    name:"装甲の研究",   desc:"最初の耐久+1",              cost:[8,20] },
    { key:"parts", name:"パーツの備蓄", desc:"最初のパーツ+6",            cost:[5,12,20] },
    { key:"slot",  name:"増設ラック",   desc:"最初から装備枠が2つ",        cost:[15] },
    { key:"item",  name:"お守り",       desc:"最初からアイテムを1つ持つ",  cost:[25] },
    { key:"rest",  name:"休憩の工夫",   desc:"休憩で回復する耐久+1",       cost:[6,14] },
    { key:"shop",  name:"なじみの店",   desc:"ショップの値段が2割引き",    cost:[12] }
];
const RG_START_PARTS = 6;         //「パーツの備蓄」1レベルあたり

//解放(条件を満たすと、アイテム・武器が出るようになる)。stat の値が need 以上で解放
const RG_UNLOCKS = [
    { kind:"item",   id:"overclock", stat:"elites", need:1,   cond:"強敵を倒す" },
    { kind:"weapon", id:"blade",     stat:"elites", need:3,   cond:"強敵を合計3体倒す" },
    { kind:"item",   id:"powder",    stat:"boss1",  need:1,   cond:"ステージ1のボスを倒す" },
    { kind:"weapon", id:"water",     stat:"runs",   need:3,   cond:"ランを3回遊ぶ" },
    { kind:"weapon", id:"emp",       stat:"stage",  need:2,   cond:"ステージ2にたどり着く" },
    { kind:"item",   id:"lucky",     stat:"items",  need:5,   cond:"1回のランでアイテムを5個集める" },
    { kind:"item",   id:"graze",     stat:"grazes", need:200, cond:"かすりを合計200回" },
    { kind:"item",   id:"thorns",    stat:"kills",  need:300, cond:"敵を合計300体倒す" },
    { kind:"item",   id:"shield",    stat:"nohit",  need:1,   cond:"ステージ2以降の戦闘をノーダメージで勝つ" },
    { kind:"item",   id:"core",      stat:"boss2",  need:1,   cond:"ステージ2のボスを倒す" },
    { kind:"item",   id:"vampire",   stat:"clears", need:1,   cond:"ローグライトをクリアする" }
];

//マスの種類
const RG_NODES = {
    battle:{ name:"戦闘", mark:"戦", color:"#555",    desc:"敵と戦う。勝つと報酬カードとパーツ" },
    elite: { name:"強敵", mark:"強", color:"#c33",    desc:"手ごわい敵の群れ。勝つとアイテムも手に入る" },
    chest: { name:"宝箱", mark:"宝", color:"#b8860b", desc:"アイテムを1つ選んで手に入れる" },
    shop:  { name:"ショップ", mark:"店", color:"#2a8", desc:"パーツでアイテム・装備・修理を買える" },
    rest:  { name:"休憩", mark:"休", color:"#37c",    desc:"耐久を回復するか、整備してパーツを得る" },
    boss:  { name:"ボス", mark:"王", color:"#6a2c91", desc:"ステージの最後のボス。勝つと次のステージへ" }
};

function rgRand(_n){ return Math.floor(Math.random()*_n); }
function rgShuffle(_a){
    for(var i=_a.length-1; i>0; i--){ var j = rgRand(i+1), t = _a[i]; _a[i] = _a[j]; _a[j] = t; }
    return _a;
}

var rogue = {
    active:false,       //ローグライトのランを遊んでいる(戦闘・強化画面の動きを切り替える)
    stage:1,
    map:null,           //[階層][マス] = { type, next:[次の階層のマスの番号], y, done }
    layer:-1,           //今いる階層(-1 はステージの入口)
    node:0,
    lost:0,             //失っている耐久(最大耐久 - 今の耐久)。最大耐久が増えると今の耐久も増える
    items:[],
    battleType:"battle",
    run:null,           //このランの記録 { kills, elites, grazes, cores, ... }
    meta:null,          //永続の記録(コア・強化・解放の条件の集計)

    //------------------------------------------------------------ 永続の記録
    loadMeta:function(){
        var m = null;
        try{ m = JSON.parse(localStorage.getItem(RG_META_KEY)); }catch(e){}
        if(!m) m = {};
        m.cores = m.cores || 0;
        m.up = m.up || {};
        m.stats = m.stats || {};
        var keys = ["runs","clears","elites","boss1","boss2","stage","items","grazes","kills","nohit","bestStage"];
        for(var i=0; i<keys.length; i++) m.stats[keys[i]] = m.stats[keys[i]] || 0;
        this.meta = m;
        return m;
    },
    saveMeta:function(){
        try{ localStorage.setItem(RG_META_KEY, JSON.stringify(this.meta)); }catch(e){}
    },
    up:function(_key){ return (this.meta && this.meta.up[_key]) || 0; },
    unlocked:function(_u){ return this.meta.stats[_u.stat] >= _u.need; },
    //今出てくるアイテム・武器
    itemPool:function(){
        var self = this;
        return RG_ITEM_IDS.filter(function(id){
            if(RG_ITEMS[id].start) return true;
            for(var i=0; i<RG_UNLOCKS.length; i++){
                var u = RG_UNLOCKS[i];
                if(u.kind == "item" && u.id == id) return self.unlocked(u);
            }
            return false;
        });
    },
    weaponPool:function(){
        var list = RG_START_WEAPONS.slice();
        for(var i=0; i<RG_UNLOCKS.length; i++){
            var u = RG_UNLOCKS[i];
            if(u.kind == "weapon" && this.unlocked(u)) list.push(u.id);
        }
        return list;
    },

    //------------------------------------------------------------ ランの保存
    saveRun:function(){
        if(!this.active) return;
        try{
            localStorage.setItem(RG_RUN_KEY, JSON.stringify({
                g:save.data(),
                r:{ stage:this.stage, map:this.map, layer:this.layer, node:this.node, lost:this.lost,
                    items:this.items, run:this.run }
            }));
        }catch(e){}
    },
    hasRun:function(){
        try{ return localStorage.getItem(RG_RUN_KEY) != null; }catch(e){ return false; }
    },
    runInfo:function(){
        try{ var d = JSON.parse(localStorage.getItem(RG_RUN_KEY)); return d ? d.r : null; }catch(e){ return null; }
    },
    clearRun:function(){
        try{ localStorage.removeItem(RG_RUN_KEY); }catch(e){}
    },
    //中断したランを続ける。続けられたらtrue
    resumeRun:function(){
        try{
            var d = JSON.parse(localStorage.getItem(RG_RUN_KEY));
            if(!d || !save.restore(d.g)) return false;
            var r = d.r;
            this.stage = r.stage; this.map = r.map; this.layer = r.layer; this.node = r.node;
            this.lost = r.lost; this.items = r.items || []; this.run = r.run;
            this.active = true;
            rogueMap.open("map");
            page.change(9);
            return true;
        }catch(e){ return false; }
    },

    //------------------------------------------------------------ ランの開始・終了
    startRun:function(){
        this.loadMeta();
        game.reset();
        //最初の装備は解放済みの武器からランダム(燃料を使うレーザー・EMPは最初の1つには向かないので除く)
        var ws = this.weaponPool().filter(function(id){ return id != "laser" && id != "emp"; });
        var w0 = ws[rgRand(ws.length)];
        game.owned = {}; game.owned[w0] = 1;
        game.slots = [w0, null, null];
        game.slotCount = 1 + this.up("slot");
        game.parts = this.up("parts") * RG_START_PARTS;
        game.seen = {};
        this.items = [];
        if(this.up("item")){
            var pool = this.itemPool();
            this.items.push(pool[rgRand(pool.length)]);
        }
        this.run = { kills:0, elites:0, grazes:0, cores:0, nodes:0, boss1:0, boss2:0, nohit:0, killsVamp:0 };
        this.meta.stats.runs++;
        this.meta.stats.stage = Math.max(this.meta.stats.stage, 1);
        this.saveMeta();
        this.stage = 1;
        this.newStage();
        this.active = true;
        this.saveRun();
        rogueMap.open("map");
        page.change(9);
    },

    newStage:function(){
        this.map = this.makeMap();
        this.layer = -1;
        this.node = 0;
        this.lost = 0;      //ステージが変わると全回復
    },

    //負け・クリア：コアと記録を永続の記録へ移して、結果を見せる
    endRun:function(_cleared){
        var s = this.meta.stats, r = this.run;
        if(_cleared){
            r.cores += RG_CORE.clear;
            s.clears++;
        }
        var before = this.unlockList();
        s.elites += r.elites; s.boss1 += r.boss1; s.boss2 += r.boss2;
        s.grazes += r.grazes; s.kills += r.kills; s.nohit += r.nohit;
        s.items = Math.max(s.items, this.items.length);
        s.stage = Math.max(s.stage, this.stage);
        s.bestStage = Math.max(s.bestStage, this.stage);
        this.meta.cores += r.cores;
        this.saveMeta();
        var after = this.unlockList();
        var fresh = [];
        for(var i=0; i<after.length; i++) if(before.indexOf(after[i]) < 0) fresh.push(after[i]);
        this.clearRun();
        this.active = false;
        rogueMap.open(_cleared ? "clear" : "over", { fresh:fresh, cores:r.cores });
        page.change(9);
    },
    //解放済みのものの名前の一覧(新しく解放されたものを見つけるため)
    unlockList:function(){
        var out = [];
        for(var i=0; i<RG_UNLOCKS.length; i++){
            var u = RG_UNLOCKS[i];
            if(this.unlocked(u)) out.push(u.kind == "item" ? "アイテム「" + RG_ITEMS[u.id].name + "」" : "武器「" + WEAPONS[u.id].name + "」");
        }
        return out;
    },

    //------------------------------------------------------------ マップ
    makeMap:function(){
        var layers = [];
        for(var l=0; l<RG_LAYERS; l++){
            var n = l == 0 ? 2 + rgRand(2) : 2 + rgRand(3);
            var layer = [];
            for(var j=0; j<n; j++) layer.push({ type:this.pickType(l), next:[], y:(j + 0.5)/n + (Math.random() - 0.5)*0.12/n, done:false });
            layers.push(layer);
        }
        layers.push([{ type:"boss", next:[], y:0.5, done:false }]);
        //つなぐ：近い位置どうしをつなぎ、ときどき隣にも分かれる。どこからも来られないマスは近くからつなぐ
        var add = function(_a,_k){ if(_a.next.indexOf(_k) < 0) _a.next.push(_k); };
        for(var l=0; l<layers.length - 1; l++){
            var A = layers[l], B = layers[l+1];
            var near = function(_pos){ var best = 0; for(var k=1; k<B.length; k++) if(Math.abs(B[k].y - _pos) < Math.abs(B[best].y - _pos)) best = k; return best; };
            for(var j=0; j<A.length; j++){
                var k = near(A[j].y);
                add(A[j],k);
                if(Math.random() < 0.45){
                    var k2 = k + (Math.random() < 0.5 ? -1 : 1);
                    if(k2 >= 0 && k2 < B.length) add(A[j],k2);
                }
            }
            for(var k=0; k<B.length; k++){
                var has = false;
                for(var j=0; j<A.length; j++) if(A[j].next.indexOf(k) >= 0) has = true;
                if(has) continue;
                var bj = 0;
                for(var j=1; j<A.length; j++) if(Math.abs(A[j].y - B[k].y) < Math.abs(A[bj].y - B[k].y)) bj = j;
                add(A[bj],k);
            }
            for(var j=0; j<A.length; j++) A[j].next.sort();
        }
        return layers;
    },
    //階層ごとのマスの種類(最初は戦闘だけ。ボスの手前は休憩・ショップが多め)
    pickType:function(_l){
        if(_l == 0) return "battle";
        if(_l == RG_LAYERS - 1){
            var r = Math.random();
            return r < 0.55 ? "rest" : (r < 0.8 ? "shop" : "battle");
        }
        var w = [["battle",46],["elite",_l >= 2 ? 16 : 0],["chest",13],["shop",11],["rest",_l >= 2 ? 10 : 4]];
        var sum = 0;
        for(var i=0; i<w.length; i++) sum += w[i][1];
        var x = Math.random()*sum;
        for(var i=0; i<w.length; i++){ x -= w[i][1]; if(x < 0) return w[i][0]; }
        return "battle";
    },
    //次に進めるマス([階層, 番号]の一覧)
    choices:function(){
        if(this.layer >= this.map.length - 1) return [];
        if(this.layer < 0){
            var out = [];
            for(var j=0; j<this.map[0].length; j++) out.push([0,j]);
            return out;
        }
        var cur = this.map[this.layer][this.node], out = [];
        for(var i=0; i<cur.next.length; i++) out.push([this.layer + 1, cur.next[i]]);
        return out;
    },
    //マスの難しさ(WAVE換算)
    level:function(_layer,_type){
        if(_type == "boss") return this.stage*RG_LEVEL_PER_STAGE;
        var lv = (this.stage - 1)*RG_LEVEL_PER_STAGE + _layer + 1;
        return _type == "elite" ? lv + RG_ELITE_PLUS : lv;
    },

    //マスへ進む
    go:function(_layer,_k){
        this.layer = _layer;
        this.node = _k;
        var n = this.map[_layer][_k];
        if(n.type == "battle" || n.type == "elite" || n.type == "boss"){
            this.battleType = n.type;
            game.wave = this.level(_layer, n.type);
            this.saveRun();
            page.change(1);
            return;
        }
        this.saveRun();
        rogueMap.open(n.type);
    },
    //宝箱・ショップ・休憩を終えた
    finishNode:function(){
        this.map[this.layer][this.node].done = true;
        this.run.nodes++;
        this.saveRun();
        rogueMap.open("map");
    },

    //------------------------------------------------------------ 戦闘(mainScreen から)
    spawnCount:function(){
        var n = RG_SPAWN_BASE + game.wave*RG_SPAWN_PER;
        if(this.battleType == "elite") n = Math.round(n*RG_ELITE_MUL);
        if(this.battleType == "boss") n = Math.floor(n/3);
        return n;
    },
    bossType:function(){
        if(this.stage == 1) return "queen";
        if(this.stage == 2) return "fortress";
        var cleared = false;
        try{ cleared = localStorage.getItem("dronekun_cleared") == "1"; }catch(e){}
        return cleared ? "kai" : "fortress";
    },
    maxHpBonus:function(){
        return RG_BASE_HP + this.up("hp") + (this.has("armor") ? 1 : 0);
    },
    label:function(){
        if(this.battleType == "boss") return "ステージ" + this.stage + "　ボス";
        return "ステージ" + this.stage + "　" + (this.layer + 1) + "階" + (this.battleType == "elite" ? "（強敵）" : "");
    },
    has:function(_id){
        return this.active && this.items.indexOf(_id) >= 0;
    },
    addItem:function(_id){
        if(this.items.indexOf(_id) >= 0) return;
        this.items.push(_id);
        sound.play("reward");
    },
    //敵を倒した(mainScreen.hitEnemy から)
    onKill:function(_e){
        if(!this.active) return;
        this.run.kills++;
        if(this.has("piggy")){
            //パーツ1.5倍(端数は確率で)
            var extra = _e.parts*0.5;
            var n = Math.floor(extra) + (Math.random() < extra % 1 ? 1 : 0);
            for(var i=0; i<n; i++) mainScreen.drop("part",_e.x,_e.y);
        }
        if(this.has("vampire") && ++this.run.killsVamp >= RG_VAMPIRE_KILLS){
            this.run.killsVamp = 0;
            if(mainScreen.hp < mainScreen.maxHp){
                mainScreen.hp++;
                popup(drone.X, drone.Y - 30, "耐久+1", "#900");
            }
        }
        if(this.has("powder")) arms.explode(_e.x, _e.y, RG_POWDER_R, 1, "powder");
    },
    //戦闘に勝った(WAVEクリアの演出のあと)
    battleWon:function(){
        var M = mainScreen, r = this.run, type = this.battleType;
        if(this.has("repair")) M.hp = Math.min(M.maxHp, M.hp + 1);
        if(this.has("midas")) game.parts += 3;
        this.lost = Math.max(0, M.maxHp - M.hp);
        r.grazes += M.graze;
        if(this.stage >= 2 && M.hp >= M.startHp) r.nohit++;
        r.nodes++;
        this.map[this.layer][this.node].done = true;
        game.pendingReward = (game.pendingReward || 0) + (type == "boss" ? 2 : 1);
        var getItem = false;
        if(type == "battle") r.cores += RG_CORE.battle;
        if(type == "elite"){ r.cores += RG_CORE.elite; r.elites++; getItem = true; }
        if(type == "boss"){
            r.cores += RG_CORE.boss*this.stage;
            if(this.stage == 1) r.boss1++;
            if(this.stage == 2) r.boss2++;
            getItem = true;
            if(this.stage >= RG_STAGES){ this.endRun(true); return; }
            this.stage++;
            this.newStage();
        }
        this.saveRun();
        //アイテムを選んでから強化画面へ
        if(getItem && rogueMap.makeChest()){
            rogueMap.open("chest", { after:"upgrade" });
            page.change(9);
            return;
        }
        page.change(2);
    },
    //撃墜された
    battleLost:function(){
        this.run.grazes += mainScreen.graze;
        this.endRun(false);
    },
    //強化画面で「出撃」の代わりにマップへ
    toMap:function(){
        rogueMap.open("map");
        page.change(9);
    }
};

//------------------------------------------------------------------------------
//  研究所(page 8)：永続強化・解放の一覧・ランの開始
//------------------------------------------------------------------------------
var rgUpButtons = [];
for(var i=0; i<RG_UPGRADES.length; i++) rgUpButtons.push(new drawRect(400, 104 + i*52, 110, 36));
var rgStartButton  = new drawRect(CW/2 - GS*7.5, GS*15.2, GS*9, GS*1.8);
var rgResumeButton = new drawRect(CW/2 + GS*2, GS*15.2, GS*9, GS*1.8);
var rgHubBackButton = new drawRect(CW - GS*3.6, GS*15.2, GS*6, GS*1.8);

var rogueHub = {
    confirm:0,      //中断中のランを捨てて始める確認の残り時間
    enter:function(){
        rogue.active = false;
        rogue.loadMeta();
        this.run = rogue.runInfo();
        this.confirm = 0;
    },
    update:function(){
        if(this.confirm > 0) this.confirm--;
        var m = rogue.meta;
        for(var i=0; i<RG_UPGRADES.length; i++){
            var U = RG_UPGRADES[i], lv = rogue.up(U.key);
            if(rgUpButtons[i].clicked() && lv < U.cost.length && m.cores >= U.cost[lv]){
                m.cores -= U.cost[lv];
                m.up[U.key] = lv + 1;
                rogue.saveMeta();
                sound.play("buy");
            }
        }
        if(rgStartButton.clicked()){
            if(this.run && this.confirm == 0){
                this.confirm = RESET_CONFIRM_TIME;
                sound.play("click");
                return;
            }
            sound.play("click");
            rogue.startRun();
            return;
        }
        if(this.run && rgResumeButton.clicked()){
            sound.play("click");
            if(!rogue.resumeRun()){ rogue.clearRun(); this.run = null; }
            return;
        }
        if(rgHubBackButton.clicked()){
            sound.play("click");
            page.change(0);
        }
    },
    draw:function(){
        var m = rogue.meta, s = m.stats;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "#000";
        ctx.font = "bold 30px serif";
        ctx.fillText("ローグライト　研究所", GS, GS*1.3);
        ctx.textAlign = "right";
        ctx.font = "bold 22px sans-serif";
        ctx.fillStyle = "#7a3cb0";
        ctx.fillText("コア " + m.cores, CW - GS, GS*1.3);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText("ラン " + s.runs + "回　クリア " + s.clears + "回　最高 ステージ" + Math.max(1, s.bestStage), CW - GS, 58);

        //永続強化
        ctx.textAlign = "left";
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "#000";
        ctx.fillText("永続強化（コアを使う）", GS, 80);
        for(var i=0; i<RG_UPGRADES.length; i++){
            var U = RG_UPGRADES[i], lv = rogue.up(U.key), y = 104 + i*52;
            ctx.textAlign = "left";
            ctx.fillStyle = "#000";
            ctx.font = "bold 15px sans-serif";
            ctx.fillText(U.name, GS, y + 10);
            ctx.font = "12px sans-serif";
            ctx.fillStyle = "#555";
            ctx.fillText(U.desc, GS, y + 28);
            for(var j=0; j<U.cost.length; j++){
                if(j < lv){ ctx.fillStyle = "#7a3cb0"; ctx.fillRect(GS*7.2 + j*18, y + 3, 13, 13); }
                else{ ctx.strokeStyle = "#aaa"; ctx.strokeRect(GS*7.2 + j*18 + 0.5, y + 3.5, 12, 12); }
            }
            ctx.font = "bold 13px sans-serif";
            if(lv >= U.cost.length) rgUpButtons[i].button("最大", false);
            else rgUpButtons[i].button("コア " + U.cost[lv], m.cores >= U.cost[lv]);
        }

        //解放
        ctx.textAlign = "left";
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "#000";
        ctx.fillText("解放（条件を満たすと出るようになる）", 480, 80);
        for(var i=0; i<RG_UNLOCKS.length; i++){
            var u = RG_UNLOCKS[i], ok = rogue.unlocked(u), y = 104 + i*27;
            var name = u.kind == "item" ? RG_ITEMS[u.id].name : WEAPONS[u.id].name;
            ctx.font = "bold 13px sans-serif";
            ctx.fillStyle = ok ? "#2a8" : "#999";
            ctx.fillText((ok ? "✔ " : "□ ") + (u.kind == "item" ? "アイテム" : "武器") + "「" + name + "」", 480, y);
            ctx.font = "12px sans-serif";
            ctx.fillStyle = ok ? "#777" : "#444";
            var prog = u.need > 1 && !ok ? "（" + Math.min(s[u.stat], u.need) + "/" + u.need + "）" : "";
            ctx.fillText(u.cond + prog, 700, y);
        }

        ctx.font = "bold 18px sans-serif";
        if(this.confirm > 0){
            rgStartButton.fill("#c33");
            ctx.fillStyle = "#fff";
            ctx.font = "bold 14px sans-serif";
            rgStartButton.text("もう一度押すと中断中のランを捨てます");
            ctx.fillStyle = "#000";
        }else{
            rgStartButton.button("新しいランを始める");
        }
        ctx.font = "bold 18px sans-serif";
        if(this.run) rgResumeButton.button("続きから（ステージ" + this.run.stage + "）");
        else rgResumeButton.button("続きから（なし）", false);
        ctx.font = "14px sans-serif";
        rgHubBackButton.button("タイトルへ");
        ctx.fillStyle = "#000";
    }
};

//------------------------------------------------------------------------------
//  マップ(page 9)：分岐マップ・宝箱・ショップ・休憩・ランの結果
//------------------------------------------------------------------------------
const RG_MAP_X0 = 110, RG_MAP_X1 = CW - 90, RG_MAP_Y0 = 92, RG_MAP_Y1 = 400;
var rgUpgradeButton = new drawRect(CW - GS*10.6, GS*15.6, GS*7, GS*1.6);
var rgQuitButton    = new drawRect(CW - GS*3.6, GS*15.6, GS*6, GS*1.6);
//カード(_n 枚を中央にそろえて並べたときの _i 枚目)
function rgCard(_i,_n){ return new drawRect(CW/2 + (_i - (_n - 1)/2)*GS*7.6, GS*5, GS*7.2, GS*6.6); }
var rgLeaveButton = new drawRect(CW/2, GS*14.6, GS*10, GS*1.8);
var rgRestButtons = [new drawRect(CW/2 - GS*6, GS*7, GS*10, GS*4), new drawRect(CW/2 + GS*6, GS*7, GS*10, GS*4)];
var rgResultButton = new drawRect(CW/2, GS*14.6, GS*10, GS*1.8);

var rogueMap = {
    mode:"map",     //map / chest / shop / rest / over / clear
    opt:{},
    offers:[],      //宝箱・ショップの品
    t:0,

    open:function(_mode,_opt){
        this.mode = _mode;
        this.opt = _opt || {};
        this.t = 0;
        if(_mode == "chest" && !this.opt.ready) this.makeChest();
        if(_mode == "shop") this.makeShop();
    },
    enter:function(){},

    //宝箱の中身(まだ持っていないアイテムから3つ)。何も残っていなければfalse
    makeChest:function(){
        var pool = rogue.itemPool().filter(function(id){ return rogue.items.indexOf(id) < 0; });
        this.offers = rgShuffle(pool).slice(0,3).map(function(id){ return { kind:"item", id:id }; });
        this.opt.ready = true;
        return this.offers.length > 0;
    },
    price:function(_kind){
        return Math.round(RG_PRICE[_kind]*(rogue.up("shop") ? 0.8 : 1));
    },
    makeShop:function(){
        var items = rgShuffle(rogue.itemPool().filter(function(id){ return rogue.items.indexOf(id) < 0; })).slice(0,2);
        var ws = rgShuffle(rogue.weaponPool().filter(function(id){ return (game.owned[id] || 0) < MAX_WEAPON_LEVEL; }));
        this.offers = items.map(function(id){ return { kind:"item", id:id, price:rogueMap.price("item") }; });
        if(ws.length) this.offers.push({ kind:"weapon", id:ws[0], price:this.price("weapon") });
        this.offers.push({ kind:"heal", price:this.price("heal") });
    },

    update:function(){
        this.t++;
        switch(this.mode){
            case "map":   this.updateMap(); break;
            case "chest": this.updateChest(); break;
            case "shop":  this.updateShop(); break;
            case "rest":  this.updateRest(); break;
            default:
                if(this.t > 40 && rgResultButton.clicked()){
                    sound.play("click");
                    page.change(8);
                }
        }
    },

    //マスの位置
    pos:function(_l,_j){
        var n = rogue.map[_l][_j];
        return { x:RG_MAP_X0 + (_l + 1)*(RG_MAP_X1 - RG_MAP_X0)/(rogue.map.length), y:RG_MAP_Y0 + n.y*(RG_MAP_Y1 - RG_MAP_Y0) };
    },
    startPos:function(){ return { x:RG_MAP_X0 - 40, y:(RG_MAP_Y0 + RG_MAP_Y1)/2 }; },
    hoverNode:function(){
        for(var l=0; l<rogue.map.length; l++){
            for(var j=0; j<rogue.map[l].length; j++){
                var p = this.pos(l,j), r = rogue.map[l][j].type == "boss" ? 30 : 20;
                if(Math.hypot(MouseX - p.x, MouseY - p.y) < r + 4) return [l,j];
            }
        }
        return null;
    },
    updateMap:function(){
        if(rgUpgradeButton.clicked()){
            sound.play("click");
            page.change(2);
            return;
        }
        if(rgQuitButton.clicked()){
            sound.play("click");
            rogue.saveRun();
            rogue.active = false;
            page.change(0);
            return;
        }
        if(Click != 1) return;
        var h = this.hoverNode();
        if(!h) return;
        var ch = rogue.choices();
        for(var i=0; i<ch.length; i++){
            if(ch[i][0] == h[0] && ch[i][1] == h[1]){
                sound.play("click");
                rogue.go(h[0],h[1]);
                return;
            }
        }
    },
    updateChest:function(){
        for(var i=0; i<this.offers.length; i++){
            if(rgCard(i, this.offers.length).clicked()){
                rogue.addItem(this.offers[i].id);
                this.afterChest();
                return;
            }
        }
        //空の宝箱(全部持っている)：パーツをもらって進む
        if(this.offers.length == 0 && rgLeaveButton.clicked()){
            game.parts += RG_CHEST_PARTS;
            sound.play("reward");
            this.afterChest();
        }
    },
    afterChest:function(){
        if(this.opt.after == "upgrade"){
            rogue.saveRun();
            page.change(2);
            return;
        }
        rogue.finishNode();
    },
    updateShop:function(){
        for(var i=0; i<this.offers.length; i++){
            var o = this.offers[i];
            if(o.sold || !rgCard(i, this.offers.length).clicked()) continue;
            if(game.parts < o.price || (o.kind == "heal" && rogue.lost == 0)){ sound.play("error"); return; }
            game.parts -= o.price;
            if(o.kind == "item"){ rogue.addItem(o.id); o.sold = true; }
            else if(o.kind == "weapon"){
                game.owned[o.id] = (game.owned[o.id] || 0) + 1;
                if(game.owned[o.id] == 1){ var k = upgradeScreen.emptySlot(); if(k >= 0) game.slots[k] = o.id; }
                o.sold = true;
                sound.play("buy");
            }else{
                rogue.lost--;
                sound.play("buy");
            }
            rogue.saveRun();
            return;
        }
        if(rgLeaveButton.clicked()){
            sound.play("click");
            rogue.finishNode();
        }
    },
    restHeal:function(){ return RG_REST_HEAL + rogue.up("rest"); },
    updateRest:function(){
        if(rgRestButtons[0].clicked()){
            rogue.lost = Math.max(0, rogue.lost - this.restHeal());
            sound.play("fuel");
            rogue.finishNode();
            return;
        }
        if(rgRestButtons[1].clicked()){
            game.parts += RG_REST_PARTS;
            sound.play("buy");
            rogue.finishNode();
        }
    },

    //------------------------------------------------------------ 描画
    draw:function(){
        if(this.mode == "over" || this.mode == "clear"){ this.drawResult(); return; }
        this.drawTop();
        switch(this.mode){
            case "map":   this.drawMap(); break;
            case "chest": this.drawChest(); break;
            case "shop":  this.drawShop(); break;
            case "rest":  this.drawRest(); break;
        }
        this.drawItems();
    },

    maxHp:function(){ return game.stat("armor") + rogue.maxHpBonus(); },

    //上：ステージ・耐久・パーツ
    drawTop:function(){
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillStyle = "#000";
        ctx.font = "bold 24px serif";
        ctx.fillText("ステージ " + rogue.stage + " / " + RG_STAGES, GS, 30);
        ctx.font = "bold 14px sans-serif";
        ctx.fillText("耐久", 200, 30);
        var mh = this.maxHp(), hp = Math.max(0, mh - rogue.lost);
        for(var i=0; i<mh; i++){
            if(i < hp){ ctx.fillStyle = "#d33"; ctx.fillRect(240 + i*18, 23, 14, 14); }
            else{ ctx.strokeStyle = "#999"; ctx.strokeRect(240.5 + i*18, 23.5, 13, 13); }
        }
        ctx.fillStyle = "#000";
        ctx.textAlign = "right";
        ctx.font = "bold 16px sans-serif";
        ctx.fillText("パーツ " + game.parts + "　　このランのコア " + rogue.run.cores, CW - GS, 30);
    },

    drawMap:function(){
        var map = rogue.map, ch = rogue.choices(), h = this.hoverNode();
        var can = function(_l,_j){ for(var i=0; i<ch.length; i++) if(ch[i][0] == _l && ch[i][1] == _j) return true; return false; };
        //道
        ctx.lineWidth = 2;
        var sp = this.startPos();
        for(var j=0; j<map[0].length; j++){
            var p = this.pos(0,j);
            ctx.strokeStyle = rogue.layer < 0 ? "#999" : "#ddd";
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        }
        for(var l=0; l<map.length - 1; l++){
            for(var j=0; j<map[l].length; j++){
                var a = this.pos(l,j);
                for(var k=0; k<map[l][j].next.length; k++){
                    var b = this.pos(l + 1, map[l][j].next[k]);
                    var mine = l == rogue.layer && j == rogue.node;
                    ctx.strokeStyle = mine ? "#999" : "#e2e2e2";
                    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                }
            }
        }
        ctx.lineWidth = 1;
        //入口
        ctx.fillStyle = "#333";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("入口", sp.x, sp.y + 24);
        if(rogue.layer < 0) this.drawSelf(sp.x, sp.y);
        else{ ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, Math.PI*2); ctx.fill(); }
        //マス
        for(var l=0; l<map.length; l++){
            for(var j=0; j<map[l].length; j++){
                var n = map[l][j], T = RG_NODES[n.type], p = this.pos(l,j);
                var r = n.type == "boss" ? 30 : 20;
                var ok = can(l,j), here = l == rogue.layer && j == rogue.node;
                var past = l < rogue.layer || (l == rogue.layer && !here);
                ctx.globalAlpha = past && !n.done ? 0.3 : 1;
                if(ok){
                    //選べるマスはふちが光る
                    var a = 0.4 + 0.3*Math.sin(this.t*0.12);
                    ctx.fillStyle = "rgba(255,190,40," + a + ")";
                    ctx.beginPath(); ctx.arc(p.x, p.y, r + 8, 0, Math.PI*2); ctx.fill();
                }
                ctx.fillStyle = n.done ? "#ddd" : "#fff";
                ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = T.color;
                ctx.lineWidth = ok && h && h[0] == l && h[1] == j ? 4 : 2;
                ctx.stroke();
                ctx.lineWidth = 1;
                ctx.fillStyle = T.color;
                ctx.font = "bold " + (n.type == "boss" ? 24 : 17) + "px sans-serif";
                ctx.fillText(T.mark, p.x, p.y + 1);
                ctx.globalAlpha = 1;
                if(here) this.drawSelf(p.x, p.y - r - 18);
            }
        }
        //ボスの名前
        var bp = this.pos(map.length - 1, 0);
        ctx.fillStyle = RG_NODES.boss.color;
        ctx.font = "bold 13px sans-serif";
        ctx.fillText(BOSS_TYPES[rogue.bossType()].name, bp.x, bp.y + 46);

        //説明(マウスを乗せたマス)
        ctx.font = "13px sans-serif";
        ctx.fillStyle = "#555";
        if(h){
            var n = map[h[0]][h[1]], T = RG_NODES[n.type];
            var lv = n.type == "battle" || n.type == "elite" || n.type == "boss" ? "　（難しさ WAVE " + rogue.level(h[0], n.type) + " 相当）" : "";
            ctx.fillText("【" + T.name + "】" + T.desc + lv, CW/2, RG_MAP_Y1 + 32);
        }else{
            ctx.fillText(ch.length ? "光っているマスを選んで進んでください" : "", CW/2, RG_MAP_Y1 + 32);
        }

        ctx.font = "bold 15px sans-serif";
        rgUpgradeButton.button("強化・装備");
        ctx.font = "13px sans-serif";
        rgQuitButton.button("中断してタイトルへ");
        ctx.fillStyle = "#000";
    },
    drawSelf:function(_x,_y){
        drone.look.draw(_x, _y, 0.8);
    },

    //持っているアイテム(下の段。マウスを乗せると説明)
    drawItems:function(){
        var y = CH - 34, hover = null;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.font = "bold 12px sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText("アイテム", GS, y);
        for(var i=0; i<rogue.items.length; i++){
            var I = RG_ITEMS[rogue.items[i]], x = GS*3.3 + i*30;
            ctx.fillStyle = I.color;
            ctx.fillRect(x, y - 12, 24, 24);
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.font = "bold 14px sans-serif";
            ctx.fillText(I.mark, x + 12, y + 1);
            if(MouseX > x && MouseX < x + 24 && MouseY > y - 12 && MouseY < y + 12) hover = I;
        }
        if(rogue.items.length == 0){
            ctx.fillStyle = "#999";
            ctx.font = "12px sans-serif";
            ctx.fillText("なし", GS*3.3, y);
        }
        if(hover){
            ctx.textAlign = "left";
            ctx.font = "bold 13px sans-serif";
            ctx.fillStyle = "#000";
            ctx.fillText(hover.name + "：" + hover.desc, GS, y - 26);
        }
        ctx.fillStyle = "#000";
    },

    //カード(アイテム・装備・修理)
    drawCard:function(_rect,_o,_sub,_enabled){
        var hover = _enabled !== false && _rect.contains(MouseX, MouseY);
        ctx.fillStyle = _o.sold ? "#eee" : (hover ? "#fff8e0" : "#fff");
        ctx.fillRect(_rect.X, _rect.Y, _rect.width, _rect.height);
        ctx.strokeStyle = _enabled === false ? "#bbb" : "#000";
        ctx.strokeRect(_rect.X + 0.5, _rect.Y + 0.5, _rect.width, _rect.height);
        var name, desc, mark, color;
        if(_o.kind == "item"){ var I = RG_ITEMS[_o.id]; name = I.name; desc = I.desc; mark = I.mark; color = I.color; }
        else if(_o.kind == "weapon"){
            var W = WEAPONS[_o.id], lv = game.owned[_o.id] || 0;
            name = W.name + (lv ? "　Lv" + lv + "→" + (lv + 1) : "　NEW"); desc = W.desc; mark = W.mark; color = W.color;
        }else{ name = "修理"; desc = "耐久を1回復する"; mark = "修"; color = "#d33"; }
        var cx = _rect.X + _rect.width/2;
        ctx.globalAlpha = _o.sold ? 0.4 : 1;
        ctx.fillStyle = color;
        ctx.fillRect(cx - 24, _rect.Y + 18, 48, 48);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold 28px sans-serif";
        ctx.fillText(mark, cx, _rect.Y + 43);
        ctx.fillStyle = "#000";
        ctx.font = "bold 15px sans-serif";
        ctx.fillText(name, cx, _rect.Y + 88);
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "#444";
        ctx.textAlign = "left";
        versus.wrap(desc, _rect.X + 12, _rect.Y + 114, _rect.width - 24, 16, 4);
        ctx.textAlign = "center";
        if(_sub){
            ctx.font = "bold 15px sans-serif";
            ctx.fillStyle = _enabled === false ? "#aaa" : "#000";
            ctx.fillText(_sub, cx, _rect.Y + _rect.height - 18);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
    },
    drawHeading:function(_title,_sub){
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";
        ctx.font = "bold 30px serif";
        ctx.fillText(_title, CW/2, GS*2.5);
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "#555";
        ctx.fillText(_sub, CW/2, GS*3.7);
        ctx.fillStyle = "#000";
    },
    drawChest:function(){
        this.drawHeading(this.opt.after ? "アイテムを手に入れた！" : "宝箱", "アイテムを1つ選んでください（このランの間ずっと効きます）");
        for(var i=0; i<this.offers.length; i++) this.drawCard(rgCard(i, this.offers.length), this.offers[i], "これにする");
        if(this.offers.length == 0){
            ctx.font = "16px sans-serif";
            ctx.fillText("アイテムはもう全部持っています。", CW/2, GS*8);
            ctx.font = "bold 18px sans-serif";
            rgLeaveButton.button("かわりにパーツ+" + RG_CHEST_PARTS);
        }
    },
    drawShop:function(){
        this.drawHeading("ショップ", "パーツで買い物ができます（1つずつ）");
        for(var i=0; i<this.offers.length; i++){
            var o = this.offers[i];
            var ok = !o.sold && game.parts >= o.price && !(o.kind == "heal" && rogue.lost == 0);
            this.drawCard(rgCard(i, this.offers.length), o, o.sold ? "売り切れ" : "パーツ " + o.price, ok);
        }
        ctx.font = "bold 18px sans-serif";
        rgLeaveButton.button("店を出る");
    },
    drawRest:function(){
        this.drawHeading("休憩", "どちらかを選んでください");
        ctx.font = "bold 22px sans-serif";
        rgRestButtons[0].button("休む（耐久+" + this.restHeal() + "）");
        rgRestButtons[1].button("整備する（パーツ+" + RG_REST_PARTS + "）");
    },

    drawResult:function(){
        var r = rogue.run, clear = this.mode == "clear";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = clear ? "#c33" : "#000";
        ctx.font = "bold 50px serif";
        ctx.fillText(clear ? "ローグライト クリア！" : "ラン終了", CW/2, GS*3);
        ctx.fillStyle = "#000";
        ctx.font = "18px sans-serif";
        ctx.fillText((clear ? "全" + RG_STAGES + "ステージ突破" : "ステージ" + rogue.stage + "・" + Math.max(1, rogue.layer + 1) + "階で撃墜") +
                     "　倒した敵 " + r.kills + "　アイテム " + rogue.items.length + "個", CW/2, GS*5.5);
        ctx.font = "bold 24px sans-serif";
        ctx.fillStyle = "#7a3cb0";
        ctx.fillText("コア +" + this.opt.cores + "（研究所で永続強化に使えます）", CW/2, GS*7.2);
        var fresh = this.opt.fresh || [];
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "#2a8";
        for(var i=0; i<fresh.length; i++) ctx.fillText("解放！ " + fresh[i] + " が出るようになりました", CW/2, GS*9 + i*24);
        if(this.t > 40){
            ctx.font = "bold 18px sans-serif";
            rgResultButton.button("研究所へ");
        }
        ctx.fillStyle = "#000";
    }
};
