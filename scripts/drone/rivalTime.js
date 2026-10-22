//------------------------------------------------------------------------------
//  ライバル「クロノ」の時を操る力(rival.js のつづき)
//  時の介入：クロノが時を操り、ドローン君にも直接はたらきかける
//    ・時の枷(shackle)：ドローン君のまわりに時計の輪が現れ、拍ごとに縮む。閉じたときに輪の中にいると、
//      ドローン君の時が遅くなる(動きも装備も遅い。CT_SHACKLE_K)。輪はドローン君を追いかけ、閉じる直前の1拍は一気に詰め寄る
//    ・加速世界(haste)：ドローン君のほかのすべて(敵・弾)の時が速くなる(CT_HASTE_K)。撃つのは拍の上のままなので、
//      弾の数は増えず、速さだけが上がる
//    ・時飛ばし(skip)：弾をばらまき、小節の後半に「1拍先」の弾の位置を薄く見せてから、小節の頭で世界を1拍先へ飛ばす
//      (ドローン君だけが取り残される。飛ばした間に弾の通り道にいると当たる)
//    ・時ノ奔流の加速の間は、ドローン君の時も少し遅くなる(CT_OD_DRONE_K)
//  異時間からの攻撃
//    ・時の裂け目(rift)：まわりに裂け目を開く。過去の裂け目(セピア)は少し前にドローン君がいた所、
//      未来の裂け目(水色)はこれから行く所(今の動きの先)を、拍ごとに順に撃つ
//    ・別の時間の自分(era。第二形態)：大きな裂け目から「過去のクロノ」(初めて会ったときの姿。刻み撃ち)と
//      「未来のクロノ」(傷だらけの姿。時計盤)を連れてくる。少し撃てば元の時間へ帰る
//  第二形態の見た目(強敵らしく)：体を大きく(RIVAL2_SCALE)、背中に時計の針の翼(拍で刻み、小節の頭で開く)、
//  光る目、まわりに暗い炎と歯車のかけら、長く暗い色のハチマキ
//  時の速さの仕組み：mainScreen.update が rivalTime.frame() で1コマごとに進め、加速・時飛ばしの分だけ敵と弾を余分に動かす。
//  ドローン君の時が遅い間は、drone.calcXY の追従が遅れ(rivalTime.delay)、装備は何コマかに1回だけ動く(rivalTime.armsStep)
//  協力プレイ：ホストが動かし、輪・裂け目などはゲストへ写す(coopMirror.js)。枷の輪はいちばん近いドローン君を追い、閉じたときは
//  ふたりとも判定する(ゲストの分はホストが判定して知らせる。出来事 8)。ゲストの時の遅さは coopMirror.guestFrame
//------------------------------------------------------------------------------
//時の枷
const CT_SHACKLE_K      = 0.42;         //枷をかけられたドローン君の時の速さ(動き・装備)
const CT_SHACKLE_BEATS  = [5,6,6,7];    //枷の長さ(拍。Lv.1～4)
const CT_SHACKLE_R      = [170,90];     //輪の半径(現れたとき・閉じるとき。px)
const CT_SHACKLE_TICKS  = 4;            //輪が閉じるまでの拍(拍ごとに1段ずつ縮む)
const CT_SHACKLE_FOLLOW = [1.4,1.8,2.2,2.6];    //輪がドローン君を追う速さ(px/フレーム。Lv.1～4)
const CT_SHACKLE_LUNGE  = 3;            //閉じる直前の1拍は、追う速さをこの倍にして詰め寄る(止まって待つとかかる・逃げ続けないとよけられない)
const CT_SHACKLE_RINGS  = [1,1,2,2];    //輪を出す回数(Lv.1～4。第二形態は1つ多い)
//加速世界
const CT_HASTE_K        = [1.45,1.5,1.6,1.7];   //敵・弾の時の速さ(Lv.1～4)
const CT_HASTE_BEATS    = 14;           //長さ(拍。はじめと終わりの1拍で速さが変わる)
//時飛ばし
const CT_SKIP_N         = [2,2,3,3];    //飛ばす回数(Lv.1～4)
const CT_SKIP_BEATS     = 1;            //1回に飛ばす長さ(拍)
const CT_SKIP_RING      = [10,12,14,16];    //小節の頭に放つ針の輪の数(Lv.1～4)
const CT_SKIP_SPEED     = 2.2;          //その速さ(弾幕の倍率を掛ける)
const CT_SKIP_SHOW      = 2;            //飛ばす何拍前から、1拍先の弾の位置を見せるか
//時の裂け目
const CT_RIFT_N         = [2,2,3,3];    //裂け目の数(Lv.1～4。第二形態は1つ多い)
const CT_RIFT_BEATS     = 16;           //裂け目が開いている長さ(拍)
const CT_RIFT_DIST      = [230,300];    //裂け目を開く所のドローン君からの距離
const CT_RIFT_PAST      = 2;            //過去の裂け目が狙う、何拍前のドローン君
const CT_RIFT_LEAD      = 50;           //未来の裂け目が先読みするいちばん長い時間(フレーム)
const CT_RIFT_SPEED     = 3.4;          //裂け目から飛ぶ針の速さ(弾幕の倍率を掛ける)
const CT_RIFT_FAN       = [1,1,3,3];    //1回に撃つ針の数(Lv.1～4)
//別の時間の自分(第二形態)
const CT_ERA_BEATS      = 32;           //連れてきた自分がいる長さ(拍)
const CT_ERA_HP         = 0.135;        //連れてきた自分の体力(第二形態の体力に対する割合)
const CT_ERA_OPEN       = 4;            //裂け目が開いてから出てくるまで(拍)
const CT_ERA_PAST       = { name:"過去のクロノ", tint:"35,60,115", k:1.1, line:"見つけたぞ、ドローン君！ 勝負だ！", col:"190,140,80" };
const CT_ERA_FUTURE     = { name:"未来のクロノ", tint:"30,26,40", k:1.45, line:"……この戦いの結末は、もう知っている", col:"120,230,255" };
const CT_ERA_LINE       = "過去と未来の俺が相手だ！";     //連れてくるとき(本物)
//時ノ奔流
const CT_OD_DRONE_K     = 0.72;         //加速の終わりのドローン君の時の速さ(取り残される)
//色
const CT_PAST           = "176,128,70"; //過去(セピア)
const CT_FUTURE         = "70,200,240"; //未来(水色)
const CT_SLOW           = "90,120,230"; //時が遅い(ドローン君の枷)
const CT_FAST           = "255,150,60"; //時が速い(加速世界)
//第二形態の見た目
const RIVAL2_SCALE      = 1.6;          //第二形態と分身の絵の大きさ(第一形態は RIVAL_SCALE)
const RIVAL2_SCARF      = "#a3122c";    //第二形態のハチマキ(暗い赤)
const RIVAL2_SCARF_HI   = "#ff6a7c";
const RIVAL2_SCARF_SEGS = [11,9];       //第二形態のハチマキの端の節の数(長くなびく)
const RIVAL2_GOLD       = "232,190,90"; //針の翼・歯車のふち(金)
const RIVAL2_WINGS      = [             //針の翼(片側。角度は真横からのラジアン(マイナスが上)・長さ・太さ。長さと太さは絵の大きさに合わせる)
    { a:-0.62, l:46, w:3.6 },
    { a:-0.30, l:58, w:4.2 },
    { a: 0.02, l:48, w:3.6 },
    { a: 0.34, l:34, w:3 }
];
const RIVAL2_WING_TICK  = 0.09;         //拍の頭に翼が跳ね上がる角度(ラジアン。すぐ戻る)
const RIVAL2_EYE        = "255,60,90";  //第二形態の目の光
const RIVAL_EYE         = "255,90,90";  //第一形態の目の光(弱く)

//------------------------------------------------------------------------------
var rivalTime = {
    droneK:1,       //ドローン君の時の速さ(1 ふつう。小さいほど遅い)
    worldK:1,       //敵・弾の時の速さ(1 ふつう。大きいほど速い)
    shackleF:0,     //時の枷の残り(フレーム。拍で決めて、フレームで数える)
    shackleT:0,     //時の枷の長さ(残りの表示用)
    haste:null,     //加速世界 { t:経過フレーム, T:長さ, k:いちばん速いとき }
    skipReq:0,      //このコマで飛ばすフレームの数
    skipFx:0,       //時飛ばしの閃光の残り
    acc:0,          //加速の余り
    armAcc:0,       //装備を動かす余り
    rings:[],       //時の枷の輪 { x, y, n:残りの拍, R }
    rifts:[],       //時の裂け目 { x, y, kind, open, life(拍), big, aim:{x,y} }
    trail:[],       //ドローン君の通った道(過去の裂け目が狙う)
    preview:0,      //時飛ばしの前に、1拍先を見せている間(フレーム)

    reset:function(){
        this.droneK = 1; this.worldK = 1;
        this.shackleF = 0; this.haste = null; this.skipReq = 0; this.skipFx = 0;
        this.acc = 0; this.armAcc = 0;
        this.rings = []; this.rifts = []; this.trail = []; this.preview = 0;
    },
    //クロノが去る・目覚める：時の介入をすべて解く
    clear:function(){
        var t = this.trail;
        this.reset();
        this.trail = t;
    },
    //1コマ(mainScreen.update から。ふだんの動きのあと)。このコマで敵と弾を余分に動かす回数を返す
    frame:function(){
        var e = rival.alive();
        if(!e || e.mode == "intro" || e.mode == "awaken"){
            if(this.droneK != 1 || this.worldK != 1 || this.rings.length || this.rifts.length || this.haste) this.clear();
            return 0;
        }
        //ドローン君の通った道(過去の裂け目のため。1拍ぶんより少し長く)
        this.trail.push({ x:drone.X, y:drone.Y });
        if(this.trail.length > 240) this.trail.shift();
        //ドローン君の時の速さ：時の枷・時ノ奔流の加速
        var k = 1;
        if(this.shackleF > 0){ this.shackleF--; k = CT_SHACKLE_K; }
        if(e.mode == "over" && e.ov && e.ov.ph == "accel") k = Math.min(k, 1 - (1 - CT_OD_DRONE_K)*(e.ov.u || 0));
        this.droneK = k;
        //敵・弾の時の速さ：加速世界(はじめと終わりの1拍でなめらかに)
        var w = 1;
        if(this.haste){
            var H = this.haste, bf = rival.beatF();
            //攻撃が終わった(ワープでよけた)ら、1拍で元の速さへ戻す
            if(e.mode != "haste" && H.T - H.t > bf){ H.T = H.t + Math.round(bf); H.from = 0; }
            var r = Math.min(1, H.t/bf, (H.T - H.t)/bf);
            w = 1 + (H.k - 1)*Math.max(0, r);
            if(++H.t >= H.T){ this.haste = null; w = 1; if(H.from !== 0) sound.play("timeResume"); }
        }
        this.worldK = w;
        //攻撃を途中でやめた(ワープでよけた・弾かれた)ときは、枷の輪・裂け目を閉じる
        if(e.mode != "shackle") this.rings = this.rings.filter(function(R){ return R.n <= 0; });
        if(e.mode != "rift" && e.mode != "era") for(var i=0; i<this.rifts.length; i++) this.rifts[i].life = Math.min(this.rifts[i].life, 0);
        if(e.mode != "skip") this.preview = 0;
        if(this.skipFx > 0) this.skipFx--;
        if(this.preview > 0) this.preview--;
        //時の枷の輪：ゆっくりドローン君へ寄る
        for(var i=0; i<this.rings.length; i++){
            var R = this.rings[i], tg = nearestPlayer(R.x, R.y), dx = tg.X - R.x, dy = tg.Y - R.y, d = Math.hypot(dx,dy), f = CT_SHACKLE_FOLLOW[e.lv]*w*(R.n == 1 ? CT_SHACKLE_LUNGE : 1);
            if(d > f){ R.x += dx/d*f; R.y += dy/d*f; } else { R.x = tg.X; R.y = tg.Y; }
            if(R.flash > 0) R.flash--;
        }
        this.rings = this.rings.filter(function(R){ return R.n > 0 || R.flash > 0; });
        //余分に動かす回数(加速の余り。時飛ばしの分は、敵を動かしたあとに takeSkip で)
        this.acc += w - 1;
        var n = Math.floor(this.acc);
        this.acc -= n;
        return n;
    },
    //このコマで時を飛ばすフレームの数(mainScreen.update から。クロノが飛ばしたコマのうちに飛ばす)
    takeSkip:function(){
        var n = this.skipReq;
        this.skipReq = 0;
        return n;
    },
    //ドローン君の追従の遅れ(drone.calcXY から)：時が遅いほど、目標へ近づくのが遅い
    delay:function(_d){
        return this.droneK >= 1 ? _d : (_d + 1)/this.droneK - 1;
    },
    //このコマで装備を動かすか(mainScreen.update から)。時が遅い間は何コマかに1回
    armsStep:function(){
        if(this.droneK >= 1){ this.armAcc = 0; return true; }
        this.armAcc += this.droneK;
        if(this.armAcc < 1) return false;
        this.armAcc -= 1;
        return true;
    },
    //ドローン君の時が遅いか・敵の時が速いか(表示用)
    slowed:function(){ return this.droneK < 0.99; },

    //------------------------------------------------------------ 攻撃の始まり(rival.nextAttack から)
    //知っている攻撃なら始めて true
    start:function(_e,_p){
        var s;
        switch(_p){
            case "shackle":
                s = rival.spot(_e, RIVAL_DIST);
                rival.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "shackle");
                return true;
            case "haste":
                s = rival.spot(_e, RIVAL_DIST);
                rival.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "haste");
                return true;
            case "skip":
                //時飛ばし：弾が画面に残るよう、まんなか寄りで
                s = rival.spot(_e, RIVAL_DIST);
                s = { x:(s.x + CW/2)/2, y:(s.y + RIVAL2_MIRROR_CY)/2 };
                if(Math.hypot(s.x - aimAt.X, s.y - aimAt.Y) < RIVAL_DIST[0]*0.7) s = rival.spot(_e, RIVAL_DIST);
                rival.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "skip");
                return true;
            case "rift":
                s = rival.spot(_e, RIVAL_DIST);
                rival.warp(_e, s.x, s.y, RIVAL_WARP_T[_e.lv], "rift");
                return true;
            case "era":
                rival.warp(_e, CW/2, 130, RIVAL_WARP_T[_e.lv], "era");
                return true;
        }
        return false;
    },
    //ワープで着いた(rival.arrive から)。知っている攻撃なら true
    arrive:function(_e){
        var lv = _e.lv, f2 = _e.form == 2 ? 1 : 0, bf = rival.beatF();
        switch(_e.next){
            case "shackle":
                _e.mode = "shackle";
                _e.rings = CT_SHACKLE_RINGS[lv] + f2;
                _e.count = Math.round((_e.rings*(CT_SHACKLE_TICKS + 2) + 6)*bf*1.6);    //曲が止まっても終わるように
                _e.ringWait = 1;
                rival.say(_e, "時の枷だ！");
                return true;
            case "haste":
                _e.mode = "haste";
                _e.count = Math.round(CT_HASTE_BEATS*bf);
                this.haste = { t:0, T:_e.count, k:CT_HASTE_K[lv] + 0.1*f2 };
                popup(_e.x, _e.y - 44, "時よ、加速しろ！", "rgb(220,110,30)");
                fx.ring(_e.x, _e.y, 160, CT_FAST, 22, 4);
                sound.play("timeStop");
                rivalSfx.riser(60/rival.bpm());
                return true;
            case "skip":
                _e.mode = "skip";
                _e.skips = CT_SKIP_N[lv] + f2;
                _e.count = Math.round((_e.skips*4 + 6)*bf*1.6);
                _e.skipArm = false;
                return true;
            case "rift":
                _e.mode = "rift";
                _e.count = Math.round((CT_RIFT_BEATS + 4)*bf*1.6);
                this.openRifts(_e, CT_RIFT_N[lv] + f2);
                rival.say(_e, "別の時間から撃ち抜く！");
                return true;
            case "era":
                _e.mode = "era";
                _e.count = Math.round((CT_ERA_BEATS + CT_ERA_OPEN + 4)*bf*1.6);
                _e.eraT = 0;
                _e.eraOut = false;
                this.rifts.push({ x:120, y:300, kind:"past", open:0, life:CT_ERA_OPEN + 2, big:true });
                this.rifts.push({ x:CW - 120, y:300, kind:"future", open:0, life:CT_ERA_OPEN + 2, big:true });
                rival.say(_e, CT_ERA_LINE);
                sound.play("timeStop");
                rivalSfx.chime();
                return true;
        }
        return false;
    },
    //攻撃の1コマ(rival.update から。知っている攻撃なら true)
    step:function(_e,_play,_toMe){
        var lv = _e.lv, bf = rival.beatF();
        switch(_e.mode){
            case "shackle":
                //時の枷：動き回って刻み撃ちしながら、拍ごとに輪を縮める。閉じたときに中にいると枷がかかる
                rival.strafe(_e);
                if(_e.onBeat && _play){
                    if(this.rings.length && this.rings[0].n > 0) this.ringTick(_e, this.rings[0]);
                    else if(_e.rings > 0 && --_e.ringWait <= 0){ this.ringStart(_e); _e.rings--; _e.ringWait = 2; }
                    else if(_e.rings <= 0 && !this.rings.length){ rival.rest(_e); return true; }
                    if(rival.downbeat(_e) || _e.enraged) rival.beatShot(_e, _toMe, 3);
                }
                if(--_e.count <= 0){ this.rings = []; rival.rest(_e); }
                return true;
            case "haste":
                //加速世界：動き回って刻み撃ち(敵と弾の時が速い)
                rival.strafe(_e);
                if(_e.onBeat && _play) rival.beatShot(_e, _toMe, RIVAL_SHOOT_N[lv]);
                if(_e.onHalf && _play) rivalSfx.tick(false);
                if(--_e.count <= 0) rival.rest(_e);
                return true;
            case "skip":
                //時飛ばし：小節の頭に針の輪を放ち、拍ごとに狙い撃つ。後半で1拍先を見せ、次の小節の頭で世界を飛ばす
                _e.vx *= 0.85; _e.vy *= 0.85;
                if(_e.onBeat && _play){
                    var q = ((_e.bi % 4) + 4) % 4;
                    if(q == 0){
                        if(_e.skipArm){ this.skip(_e); _e.skipArm = false; _e.skips--; }
                        if(_e.skips <= 0){ rival.rest(_e); return true; }
                        this.skipRing(_e);
                    }else{
                        rival.needles(_e, _e.x, _e.y, _toMe, _e.enraged ? 3 : 1, 0.18, rival.shotSpeed());
                        sound.play("shot");
                    }
                    if(q == 4 - CT_SKIP_SHOW){
                        _e.skipArm = true;
                        this.preview = Math.round(bf*CT_SKIP_SHOW) + 4;
                        popup(_e.x, _e.y - 44, "時を飛ばす…！", "rgb(150,80,220)");
                        rivalSfx.tick(true);
                    }
                }
                if(--_e.count <= 0){ this.preview = 0; rival.rest(_e); }
                return true;
            case "rift":
                //時の裂け目：少し動き回り、裂け目が拍ごとに順に撃つ(小節の頭は本物も1発)
                rival.strafe(_e);
                if(_e.onBeat && _play){
                    this.riftBeat(_e);
                    if(rival.downbeat(_e)){ rival.needles(_e, _e.x, _e.y, _toMe, 1, 0, rival.shotSpeed()); sound.play("shot"); }
                }
                if(_e.onBeat) this.riftLife();
                if(!this.rifts.length || --_e.count <= 0){ this.rifts = []; rival.rest(_e); }
                return true;
            case "era":
                //別の時間の自分：裂け目から過去と未来の自分が出てくる。本物は上で動き回り、小節の頭に扇
                _e.vx *= 0.9; _e.vy *= 0.9;
                if(_e.onBeat){
                    _e.eraT++;
                    this.riftLife();
                    if(_e.eraT == CT_ERA_OPEN && !_e.eraOut){ this.eraSpawn(_e); _e.eraOut = true; }
                    if(_play && rival.downbeat(_e) && _e.eraOut) rival.beatShot(_e, _toMe, RIVAL_SHOOT_N[lv]);
                }
                var left = enemies.some(function(c){ return c.era && c.owner == _e.id && !c.dead && c.mode != "fade"; });
                if((_e.eraOut && !left && _e.eraT > CT_ERA_OPEN + 4) || _e.eraT >= CT_ERA_BEATS + CT_ERA_OPEN || --_e.count <= 0){
                    this.eraEnd(_e);
                    rival.rest(_e);
                }
                return true;
        }
        return false;
    },

    //------------------------------------------------------------ 時の枷
    ringStart:function(_e){
        var tg = aimAt || drone;
        this.rings.unshift({ x:tg.X, y:tg.Y, n:CT_SHACKLE_TICKS, R:CT_SHACKLE_R[0], flash:0 });
        sound.play("timeStop");
        rivalSfx.tick(true);
    },
    //輪が1段縮む。閉じたときに中にいると、枷がかかる
    ringTick:function(_e,_R){
        _R.n--;
        _R.R = CT_SHACKLE_R[1] + (CT_SHACKLE_R[0] - CT_SHACKLE_R[1])*_R.n/CT_SHACKLE_TICKS;
        rivalSfx.tick(_R.n == 0);
        if(_R.n > 0) return;
        _R.flash = 16;
        fx.ring(_R.x, _R.y, CT_SHACKLE_R[1] + 20, CT_SLOW, 14, 4);
        var me = Math.hypot(drone.X - _R.x, drone.Y - _R.y) <= CT_SHACKLE_R[1] && !mainScreen.down;
        //協力プレイの相方(ゲスト)も輪の中にいれば、枷がかかったと知らせる(coop.readEvents)
        var P = coop.partnerTarget(), them = !!P && Math.hypot(P.X - _R.x, P.Y - _R.y) <= CT_SHACKLE_R[1];
        if(them) coop.addEvent(8, P.X, P.Y, Math.round(CT_SHACKLE_BEATS[_e.lv]*rival.beatF()));
        if(me) this.shackle(_e);
        else if(!them) popup(_R.x, _R.y - CT_SHACKLE_R[1] - 8, "かわした！", "rgb(30,150,200)");
    },
    //ドローン君に枷をかける(時が遅くなる)
    //_f：長さ(フレーム。協力プレイのゲストはホストから届く)
    shackle:function(_e,_f){
        this.shackleF = this.shackleT = _f || Math.round(CT_SHACKLE_BEATS[_e.lv || 0]*rival.beatF());
        popup(drone.X, drone.Y - 36, "時が…遅い！", "rgb(70,90,200)");
        drone.look.setFace("sad", 90);
        fx.shake(5);
        sound.play("slowIn");
        sound.play("timeStop");
    },

    //------------------------------------------------------------ 時飛ばし
    skipRing:function(_e){
        var from = enemyShots.length;
        fireRing(_e.x, _e.y, CT_SKIP_RING[_e.lv], CT_SKIP_SPEED*Math.min(1.3,danmaku()), _e.t*0.37, "chrono");
        for(var i=from; i<enemyShots.length; i++) enemyShots[i].cr = _e.id;
        fx.ring(_e.x, _e.y, 50, RIVAL2_GLOW, 12, 3);
        sound.play("shot");
        rivalSfx.tick(true);
    },
    //世界を1拍先へ飛ばす(このコマで敵と弾を1拍ぶん動かす。rivalTime.frame)
    skip:function(_e){
        this.skipReq += Math.round(rival.beatF()*CT_SKIP_BEATS);
        this.skipFx = 22;
        this.preview = 0;
        fx.shake(6);
        sound.play("timeResume");
        rivalSfx.rewind();
    },

    //------------------------------------------------------------ 時の裂け目
    //_n 個の裂け目を、ドローン君を囲むように開く(過去と未来をかわるがわる)
    openRifts:function(_e,_n){
        var a0 = Math.random()*Math.PI*2;
        for(var i=0; i<_n; i++){
            var a = a0 + i*Math.PI*2/_n + (Math.random() - 0.5)*0.5, r = randIn(CT_RIFT_DIST);
            var x = Math.max(50, Math.min(CW - 50, aimAt.X + Math.cos(a)*r)), y = Math.max(110, Math.min(CH - 50, aimAt.Y + Math.sin(a)*r*0.8));
            this.rifts.push({ x:x, y:y, kind:i % 2 ? "future" : "past", open:0, life:CT_RIFT_BEATS, big:false, slot:i, fire:0 });
        }
        sound.play("warpOut");
    },
    //裂け目が狙う所：過去は CT_RIFT_PAST 拍前にドローン君がいた所、未来は今の動きの先
    riftAim:function(_r){
        if(_r.kind == "past"){
            var back = Math.round(rival.beatF()*CT_RIFT_PAST), T = this.trail;
            var p = T[Math.max(0, T.length - 1 - back)] || { x:drone.X, y:drone.Y };
            return { x:p.x, y:p.y };
        }
        var sp = CT_RIFT_SPEED*Math.min(1.3,danmaku()), d = Math.hypot(drone.X - _r.x, drone.Y - _r.y);
        var lead = Math.min(CT_RIFT_LEAD, d/sp), T = this.trail, o = T[Math.max(0, T.length - 9)] || { x:drone.X, y:drone.Y };
        var vx = (drone.X - o.x)/8, vy = (drone.Y - o.y)/8;
        return { x:Math.max(10, Math.min(CW - 10, drone.X + vx*lead)), y:Math.max(10, Math.min(CH - 10, drone.Y + vy*lead)) };
    },
    //拍：次の番の裂け目が撃つ
    riftBeat:function(_e){
        var R = this.rifts.filter(function(r){ return !r.big && r.open >= 1; });
        if(!R.length) return;
        var r = R[((_e.bi % R.length) + R.length) % R.length], p = this.riftAim(r);
        var from = rival.needles(_e, r.x, r.y, Math.atan2(p.y - r.y, p.x - r.x), CT_RIFT_FAN[_e.lv], 0.16, CT_RIFT_SPEED*Math.min(1.3,danmaku()));
        for(var i=from; i<enemyShots.length; i++) enemyShots[i].era = r.kind;
        r.fire = 10;
        sound.play("shot");
        rivalSfx.tick(r.kind == "future");
    },
    //拍ごとに裂け目の残りを減らす
    riftLife:function(){
        for(var i=0; i<this.rifts.length; i++) this.rifts[i].life--;
    },
    //裂け目の開き具合を進める(描画のたび。1コマに1度)
    riftAnim:function(){
        if(this.riftF == mainScreen.clock) return;
        this.riftF = mainScreen.clock;
        for(var i=0; i<this.rifts.length; i++){
            var r = this.rifts[i];
            r.open = r.life > 0 ? Math.min(1, r.open + 0.06) : Math.max(0, r.open - 0.08);
            if(r.fire > 0) r.fire--;
        }
        this.rifts = this.rifts.filter(function(r){ return r.life > 0 || r.open > 0; });
    },

    //------------------------------------------------------------ 別の時間の自分(第二形態)
    eraSpawn:function(_e){
        var self = this, hp = Math.max(1, Math.round(_e.maxHp*CT_ERA_HP));
        ["past","future"].forEach(function(_k, i){
            var r = self.rifts.filter(function(q){ return q.big && q.kind == _k; })[0] || { x:i ? CW - 120 : 120, y:300 };
            var E = _k == "past" ? CT_ERA_PAST : CT_ERA_FUTURE;
            var c = rival.spawnClone(_e, r.x, r.y, "stay", { era:_k, name:E.name, orbit:i ? 0 : Math.PI, wx0:r.x, wy0:r.y });
            c.mode = "era";
            c.hp = c.maxHp = hp;
            c.look.tint = E.tint;
            c.look.setMood(_k == "past" ? "normal" : "fierce");
            c.glow = E.col;
            //未来の自分は時計盤を使う(rival.clockTick)
            if(_k == "future"){ c.hand = -Math.PI/2; c.hdir = -1; c.ticks = 999; c.tickT = 0; c.grow = 0; }
            rival.say(c, E.line);
            fx.flare(r.x, r.y, 70, E.col, 16);
            rival.flags(c);
        });
        fx.shake(8);
        sound.play("warpIn");
        sound.play("bossImpact");
    },
    //連れてきた自分の1コマ(rival.cloneUpdate から)：過去は動き回って刻み撃ち、未来はゆっくり動いて時計盤
    eraStep:function(_c,_o,_play,_dx,_dy){
        if(!_o) return;
        _c.bi = _o.bi; _c.onBeat = _o.onBeat;
        if(_c.sayT > 0) _c.sayT--;
        if(_c.era == "past"){
            rival.strafe(_c);
            if(_c.onBeat && _play) rival.beatShot(_c, Math.atan2(_dy,_dx), 3);
        }else{
            //未来：画面の上半分をゆっくり動き、長針を拍ごとに進めて撃つ
            var p = rival.clamp(aimAt.X + Math.cos(_c.orbit)*260, Math.min(260, aimAt.Y - 120));
            _c.orbit += 0.004;
            _c.vx += ((p.x - _c.x)*0.02 - _c.vx)*0.1;
            _c.vy += ((p.y - _c.y)*0.02 - _c.vy)*0.1;
            _c.grow = Math.min(1, (_c.grow || 0) + 1/rival.beatF());
            if(_c.onBeat && _play && _c.grow >= 1 && ((_c.bi % 2) + 2) % 2 == 0) rival.clockTick(_c);
        }
    },
    //連れてきた自分が元の時間へ帰る
    eraEnd:function(_e){
        for(var i=0; i<enemies.length; i++){
            var c = enemies[i];
            if(c.era && c.owner == _e.id && c.mode != "fade") rival.fade(c);
        }
        this.rifts = this.rifts.filter(function(r){ return !r.big; });
    },
    //連れてきた自分が倒された(rival.cloneKilled から)
    eraKilled:function(_c){
        var E = _c.era == "past" ? CT_ERA_PAST : CT_ERA_FUTURE;
        fx.flare(_c.x, _c.y, 60, E.col, 16);
        rival.shatter(_c, E.col);
        popup(_c.x, _c.y - _c.r - 8, _c.era == "past" ? "過去へ還った！" : "未来へ還った！", _c.era == "past" ? "rgb(150,100,40)" : "rgb(30,150,200)");
        sound.play("warpOut");
    },

    //------------------------------------------------------------------ 描画
    //敵より奥(rival.drawAttack から)：裂け目・枷の輪・未来の時計盤・1拍先の弾
    drawAttack:function(_e){
        this.riftAnim();
        for(var i=0; i<this.rifts.length; i++) this.drawRift(this.rifts[i], _e);
        //裂け目から次に撃つ所(番の裂け目から照準の線)
        if(_e.mode == "rift"){
            var R = this.rifts.filter(function(r){ return !r.big && r.open >= 1; });
            if(R.length){
                var r = R[(((_e.bi + 1) % R.length) + R.length) % R.length], p = this.riftAim(r), col = r.kind == "past" ? CT_PAST : CT_FUTURE;
                var fr = rival.viewBeat(_e); fr -= Math.floor(fr);
                ctx.save();
                ctx.strokeStyle = "rgba(" + col + "," + (0.25 + 0.5*fr) + ")";
                ctx.lineWidth = 1.5 + fr;
                ctx.setLineDash([5,6]);
                ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(p.x, p.y); ctx.stroke();
                ctx.setLineDash([]);
                this.drawMark(p.x, p.y, col, fr);
                ctx.restore();
            }
        }
        for(var i=0; i<this.rings.length; i++) this.drawRing(this.rings[i], _e);
        //未来の自分の時計盤
        for(var i=0; i<enemies.length; i++){
            var c = enemies[i];
            if(c.era == "future" && c.owner == _e.id && c.mode == "era") rival.drawClockAttack(c, CT_FUTURE);
        }
        if(this.preview > 0) this.drawPreview();
    },
    //照準の印(過去・未来の裂け目が撃つ所)
    drawMark:function(_x,_y,_col,_fr){
        var r = 14 - 5*_fr;
        ctx.strokeStyle = "rgba(" + _col + ",0.85)";
        ctx.lineWidth = 2;
        for(var i=0; i<4; i++){
            var a = i*Math.PI/2 + Math.PI/4;
            ctx.beginPath(); ctx.arc(_x, _y, r, a - 0.4, a + 0.4); ctx.stroke();
        }
    },
    //裂け目：縦に裂けた光のふち。中は別の時間の景色(過去はセピアにフィルムの傷、未来は水色に走査線と方眼)
    drawRift:function(_r,_e){
        var o = _r.open, H = (_r.big ? 130 : 62)*(0.4 + 0.6*o), W = (_r.big ? 40 : 18)*o, t = mainScreen.clock, past = _r.kind == "past";
        if(o <= 0) return;
        var col = past ? CT_PAST : CT_FUTURE;
        var edge = function(_s){
            ctx.beginPath();
            ctx.moveTo(_r.x, _r.y - H);
            for(var i=1; i<8; i++){
                var u = i/8, y = _r.y - H + 2*H*u, w = Math.sin(Math.PI*u)*W*_s;
                var j = ((i*37 + Math.floor(t/4)*13) % 7 - 3)*0.9*o;
                ctx.lineTo(_r.x + w + j, y);
            }
            ctx.lineTo(_r.x, _r.y + H);
            for(var i=7; i>=1; i--){
                var u = i/8, y = _r.y - H + 2*H*u, w = Math.sin(Math.PI*u)*W*_s;
                var j = ((i*53 + Math.floor(t/4)*7) % 7 - 3)*0.9*o;
                ctx.lineTo(_r.x - w + j, y);
            }
            ctx.closePath();
        };
        ctx.save();
        //外の光
        enemyArt.halo(_r.x, _r.y, H*0.9, col, 0.16*o);
        edge(1.35);
        ctx.fillStyle = "rgba(" + col + "," + (0.35*o) + ")";
        ctx.fill();
        //中の景色
        edge(1);
        ctx.fillStyle = past ? "rgb(70,48,26)" : "rgb(8,30,52)";
        ctx.fill();
        ctx.save();
        edge(1);
        ctx.clip();
        if(past){
            //セピアの光と、上下に流れるフィルムの傷
            ctx.fillStyle = "rgba(230,190,130,0.35)";
            ctx.fillRect(_r.x - W, _r.y - H*0.3, W*2, H*0.6);
            ctx.strokeStyle = "rgba(255,235,200,0.6)";
            ctx.lineWidth = 1;
            for(var i=0; i<3; i++){
                var x = _r.x + ((i*29 + t*3) % (W*2 + 1)) - W;
                ctx.beginPath(); ctx.moveTo(x, _r.y - H); ctx.lineTo(x + 2, _r.y + H); ctx.stroke();
            }
            if(t % 9 < 2){ ctx.fillStyle = "rgba(255,240,210,0.25)"; ctx.fillRect(_r.x - W, _r.y - H, W*2, H*2); }
        }else{
            //水色の方眼と、上へ流れる走査線
            ctx.strokeStyle = "rgba(120,230,255,0.35)";
            ctx.lineWidth = 1;
            for(var y = -H + ((t*2) % 12); y < H; y += 12){ ctx.beginPath(); ctx.moveTo(_r.x - W, _r.y + y); ctx.lineTo(_r.x + W, _r.y + y); ctx.stroke(); }
            ctx.fillStyle = "rgba(200,250,255,0.55)";
            ctx.fillRect(_r.x - W, _r.y + H - ((t*5) % (H*2)), W*2, 3);
        }
        ctx.restore();
        //光のふち
        edge(1);
        ctx.strokeStyle = "rgba(255,255,255," + (0.85*o) + ")";
        ctx.lineWidth = 2;
        ctx.stroke();
        edge(1.15);
        ctx.strokeStyle = "rgba(" + col + "," + (0.8*o) + ")";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        //撃った瞬間の光
        if(_r.fire > 0) enemyArt.halo(_r.x, _r.y, 34, col, 0.5*_r.fire/10);
        //過去・未来の文字
        ctx.globalAlpha = o;
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        var label = past ? "過去" : "未来";
        ctx.strokeText(label, _r.x, _r.y - H - 10);
        ctx.fillStyle = past ? "rgb(120,80,30)" : "rgb(20,120,170)";
        ctx.fillText(label, _r.x, _r.y - H - 10);
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //時の枷の輪：鎖の輪と文字盤の目盛り。拍ごとに1段縮み、閉じるまでの残りを点で見せる
    drawRing:function(_R,_e){
        var fr = rival.viewBeat(_e); fr -= Math.floor(fr);
        var R = _R.n > 0 ? _R.R - 4*Math.max(0, 1 - fr*6) : CT_SHACKLE_R[1];
        var a = _R.n > 0 ? 0.55 + 0.4*(1 - _R.n/CT_SHACKLE_TICKS) : _R.flash/16;
        var close = CT_SHACKLE_R[1];
        ctx.save();
        ctx.translate(_R.x, _R.y);
        //閉じる大きさ(点線)と、今の輪
        ctx.strokeStyle = "rgba(" + CT_SLOW + "," + (0.5*a) + ")";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3,5]);
        ctx.beginPath(); ctx.arc(0, 0, close, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(" + CT_SLOW + "," + (0.08*a) + ")";
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.fill();
        //鎖：輪の上に長円の輪をつなげる
        var n = Math.max(12, Math.round(R*2*Math.PI/14)), rot = -mainScreen.clock*0.01;
        for(var i=0; i<n; i++){
            var t = rot + i*Math.PI*2/n;
            ctx.save();
            ctx.translate(Math.cos(t)*R, Math.sin(t)*R);
            ctx.rotate(t + Math.PI/2);
            ctx.strokeStyle = "rgba(26,20,32," + (0.6*a) + ")";
            ctx.lineWidth = 3.4;
            ctx.beginPath(); ctx.ellipse(0, 0, 5.2, i % 2 ? 2.4 : 3.4, 0, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "rgba(" + CT_SLOW + "," + a + ")";
            ctx.lineWidth = 1.6;
            ctx.stroke();
            ctx.restore();
        }
        //閉じる直前の1拍(詰め寄る)：輪の外に強く光る線
        if(_R.n == 1){
            ctx.strokeStyle = "rgba(255,255,255," + (0.5 + 0.5*Math.sin(mainScreen.clock*0.8)) + ")";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, R + 8, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = "rgb(" + CT_SLOW + ")";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        //閉じるまでの残り(上に点)
        for(var i=0; i<CT_SHACKLE_TICKS; i++){
            var on = i < _R.n;
            ctx.fillStyle = on ? "rgba(" + CT_SLOW + "," + a + ")" : "rgba(255,255,255," + (0.6*a) + ")";
            ctx.beginPath(); ctx.arc((i - (CT_SHACKLE_TICKS - 1)/2)*12, -R - 12, on ? 3.5 : 2, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },
    //時飛ばしの前：1拍先の弾の位置を薄い輪で、今の位置からの道すじを線で見せる
    drawPreview:function(){
        var N = Math.round(rival.beatF()*CT_SKIP_BEATS)*this.worldK, a = Math.min(1, this.preview/8);
        ctx.save();
        ctx.lineWidth = 1;
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.held || (!b.vx && !b.vy)) continue;
            var x = b.x + b.vx*N, y = b.y + b.vy*N;
            ctx.strokeStyle = "rgba(" + RIVAL2_TIME + "," + (0.22*a) + ")";
            ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(x, y); ctx.stroke();
            ctx.strokeStyle = "rgba(" + RIVAL2_TIME + "," + (0.75*a) + ")";
            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
    },
    //ドローン君より手前(mainScreen.draw から。揺れ・拡大の中)：枷のかかったドローン君・加速の筋・時飛ばしの閃光
    drawFront:function(){
        if(page.number != 1) return;
        var t = mainScreen.clock;
        //加速世界：画面のふちを横に流れる光の筋と、あたたかい色
        if(this.worldK > 1.01){
            var k = (this.worldK - 1)/0.7;
            ctx.save();
            ctx.fillStyle = "rgba(255,170,80," + (0.07*k) + ")";
            ctx.fillRect(-40, -40, CW + 80, CH + 80);
            ctx.strokeStyle = "rgba(" + CT_FAST + "," + (0.35*k) + ")";
            ctx.lineWidth = 2;
            for(var i=0; i<14; i++){
                var y = (i*97) % CH, edgeY = y < CH/2 ? y*0.35 : CH - (CH - y)*0.35;
                var x = CW + 200 - ((t*26 + i*173) % (CW + 400)), L = 60 + (i % 4)*40;
                ctx.beginPath(); ctx.moveTo(x, edgeY); ctx.lineTo(x + L, edgeY); ctx.stroke();
            }
            ctx.restore();
        }
        //枷：ドローン君のまわりの鎖の輪と、遅く回る文字盤。遅れてついてくる残像
        if(this.slowed() && !mainScreen.down){
            var k = (1 - this.droneK)/(1 - CT_SHACKLE_K), x = drone.X, y = drone.Y;
            ctx.save();
            //画面のふちを青く沈める
            ctx.fillStyle = "rgba(30,40,110," + (0.12*k) + ")";
            ctx.fillRect(-40, -40, CW + 80, 40 + 50);
            ctx.fillRect(-40, CH - 50, CW + 80, 90);
            ctx.strokeStyle = "rgba(" + CT_SLOW + "," + (0.8*k) + ")";
            ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI*2); ctx.stroke();
            for(var i=0; i<12; i++){
                var a = i*Math.PI/6;
                ctx.beginPath(); ctx.moveTo(x + Math.cos(a)*23, y + Math.sin(a)*23); ctx.lineTo(x + Math.cos(a)*26, y + Math.sin(a)*26); ctx.stroke();
            }
            //遅く回る針
            var h = -Math.PI/2 + t*0.02;
            ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(h)*30, y + Math.sin(h)*30); ctx.stroke();
            //鎖のかけら(4方向から伸びる)
            if(this.shackleF > 0){
                for(var j=0; j<4; j++){
                    var a = j*Math.PI/2 + Math.PI/4 + Math.sin(t*0.05 + j)*0.1;
                    for(var m=0; m<3; m++){
                        var r = 32 + m*9;
                        ctx.save();
                        ctx.translate(x + Math.cos(a)*r, y + Math.sin(a)*r);
                        ctx.rotate(a + (m % 2 ? Math.PI/2 : 0));
                        ctx.strokeStyle = "rgba(" + CT_SLOW + "," + (0.7*k*(1 - m*0.25)) + ")";
                        ctx.lineWidth = 1.6;
                        ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 2.4, 0, 0, Math.PI*2); ctx.stroke();
                        ctx.restore();
                    }
                }
                //残りの時間(輪の外の弧)
                var u = this.shackleF/Math.max(1, this.shackleT);
                ctx.strokeStyle = "rgba(255,255,255,0.9)";
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(x, y, 31, -Math.PI/2, -Math.PI/2 + Math.PI*2*u); ctx.stroke();
                ctx.strokeStyle = "rgb(" + CT_SLOW + ")";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            ctx.restore();
        }
        //時飛ばし：白い閃光と、横にずれた走査線(コマが飛ぶ)
        if(this.skipFx > 0){
            var u = this.skipFx/22;
            ctx.save();
            ctx.fillStyle = "rgba(235,220,255," + (0.5*u*u) + ")";
            ctx.fillRect(-40, -40, CW + 80, CH + 80);
            for(var i=0; i<7; i++){
                var y = ((i*79 + this.skipFx*31) % CH), h = 3 + (i % 3)*4;
                ctx.fillStyle = i % 2 ? "rgba(" + RIVAL2_TIME + "," + (0.35*u) + ")" : "rgba(255,255,255," + (0.4*u) + ")";
                ctx.fillRect(-40 + ((i*53) % 30) - 15, y, CW + 80, h);
            }
            ctx.restore();
        }
    },
    //画面の上の表示(揺れ・拡大の外。rival.drawUi から)：今かかっている時の介入
    drawUi:function(){
        if(page.number != 1 || !rival.alive()) return;
        var tags = [];
        if(this.shackleF > 0) tags.push({ text:"時の枷　ドローン君の時が遅い", col:CT_SLOW });
        else if(this.slowed()) tags.push({ text:"時に取り残される", col:CT_SLOW });
        if(this.worldK > 1.01) tags.push({ text:"加速世界　×" + this.worldK.toFixed(1), col:CT_FAST });
        if(this.preview > 0) tags.push({ text:"時飛ばし　1拍先が見える", col:RIVAL2_TIME });
        if(this.skipFx > 0) tags.push({ text:"時が飛んだ！", col:RIVAL2_TIME });
        if(rival.borrowK > 1) tags.push({ text:"時の前借り　攻撃が強まった", col:RIVAL2_BORROW_COL });
        if(!tags.length) return;
        ctx.save();
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for(var i=0; i<tags.length; i++){
            var y = 112 + i*24, w = ctx.measureText(tags[i].text).width + 24;
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            enemyArt.roundRect(CW/2 - w/2, y - 10, w, 20, 6);
            ctx.fill();
            ctx.strokeStyle = "rgb(" + tags[i].col + ")";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "rgb(" + tags[i].col + ")";
            ctx.fillText(tags[i].text, CW/2, y + 1);
        }
        ctx.restore();
        ctx.lineWidth = 1;
    },

    //------------------------------------------------------------ 第二形態の見た目
    //体の絵の大きさ(第二形態と分身は大きい。連れてきた自分はそれぞれの大きさ)
    scale:function(_e){
        if(_e.era) return (_e.era == "past" ? CT_ERA_PAST : CT_ERA_FUTURE).k;
        return (!_e.echo && (_e.clone || rival.second(_e))) ? RIVAL2_SCALE : RIVAL_SCALE;
    },
    //暗い炎(体の後ろ。上へゆらめく紫の舌)と、回る歯車のかけら(translate済み)
    drawAura:function(_e,_k,_a){
        var t = _e.t || 0;
        ctx.save();
        ctx.globalAlpha = _a;
        for(var i=0; i<9; i++){
            var u = ((t*0.012 + i/9) % 1), a = i*2.4 + Math.sin(t*0.03 + i)*0.3;
            var x = Math.cos(a)*16*_k*(1 - u*0.3), y = 10*_k - u*44*_k, s = (9 - 6*u)*_k*0.8;
            ctx.fillStyle = "rgba(60,20,100," + (0.22*(1 - u)) + ")";
            ctx.beginPath();
            ctx.moveTo(x, y - s*2.2);
            ctx.quadraticCurveTo(x + s, y, x, y + s);
            ctx.quadraticCurveTo(x - s, y, x, y - s*2.2);
            ctx.fill();
        }
        //歯車のかけら(3つ。体のまわりを回る)
        for(var i=0; i<3; i++){
            var a = t*0.015 + i*Math.PI*2/3, r = 40*_k*0.8, x = Math.cos(a)*r, y = Math.sin(a)*r*0.55 + 4;
            this.drawGear(x, y, (i == 1 ? 6 : 4.5)*_k*0.75, t*0.04*(i % 2 ? -1 : 1), Math.sin(a) < 0 ? 0.55 : 0.9);
        }
        ctx.restore();
    },
    drawGear:function(_x,_y,_r,_rot,_a){
        ctx.save();
        ctx.translate(_x, _y);
        ctx.rotate(_rot);
        ctx.globalAlpha *= _a;
        ctx.beginPath();
        for(var i=0; i<16; i++){
            var a = i*Math.PI/8, r = i % 2 ? _r*0.72 : _r;
            ctx.lineTo(Math.cos(a - 0.12)*r, Math.sin(a - 0.12)*r);
            ctx.lineTo(Math.cos(a + 0.12)*r, Math.sin(a + 0.12)*r);
        }
        ctx.closePath();
        ctx.fillStyle = "rgb(" + RIVAL2_GOLD + ")";
        ctx.fill();
        ctx.strokeStyle = RIVAL_INK;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, _r*0.32, 0, Math.PI*2);
        ctx.fillStyle = RIVAL_INK; ctx.fill();
        ctx.restore();
    },
    //時計の針の翼(体の後ろ。translate済み)：両側に4本ずつ。拍ごとに外へ刻み、小節の頭で大きく開いて光る。
    //攻撃の構え・時が止まっている間は大きく広げる
    drawWings:function(_e,_k,_a){
        var b = rival.viewBeat(_e), bi = Math.floor(b), fr = b - bi, down = ((bi % 4) + 4) % 4 == 0;
        var pulse = Math.exp(-fr*6)*(down ? 1 : 0.4);
        var spread = (_e.mode == "aim" || _e.mode == "hold" || _e.mode == "rstop" || _e.mode == "twelve" || _e.mode == "over" || _e.mode == "skip") ? 0.14 : 0;
        var tick = RIVAL2_WING_TICK*pulse;
        var breathe = Math.sin((_e.t || 0)*0.05)*0.05;
        var L = _e.look, kk = _k/1.3;
        ctx.save();
        ctx.translate(0, Math.sin(L.t*0.08)*1.5*_k - 4*kk);
        ctx.rotate(L.tilt);
        ctx.globalAlpha = _a;
        for(var s=-1; s<=1; s+=2){
            for(var i=RIVAL2_WINGS.length - 1; i>=0; i--){
                //上の翼ほど大きく開く(扇)。拍の頭で跳ね上がり、すぐ戻る
                var f = 1 - i/(RIVAL2_WINGS.length - 1), W = RIVAL2_WINGS[i];
                var a = W.a - (spread + tick)*(0.4 + 0.6*f) + breathe*(0.5 + f);
                var dx = Math.cos(a)*s, dy = Math.sin(a), l = W.l*kk*(1 + 0.04*pulse), w = W.w*kk;
                this.drawBlade(s*15*kk, (-3 + i*2.5)*kk, dx, dy, l, w, pulse);
            }
        }
        ctx.restore();
    },
    //針の翼1本：付け根の輪・細い軸・先の矢じり(金のふち・赤い先)
    drawBlade:function(_x,_y,_dx,_dy,_l,_w,_p){
        var nx = -_dy, ny = _dx, tx = _x + _dx*_l, ty = _y + _dy*_l, hx = _x + _dx*_l*0.74, hy = _y + _dy*_l*0.74;
        ctx.lineJoin = "round";
        //軸
        ctx.beginPath();
        ctx.moveTo(_x + nx*_w*0.35, _y + ny*_w*0.35);
        ctx.lineTo(hx + nx*_w*0.3, hy + ny*_w*0.3);
        ctx.lineTo(hx + nx*_w*0.85, hy + ny*_w*0.85);
        ctx.lineTo(tx, ty);
        ctx.lineTo(hx - nx*_w*0.85, hy - ny*_w*0.85);
        ctx.lineTo(hx - nx*_w*0.3, hy - ny*_w*0.3);
        ctx.lineTo(_x - nx*_w*0.35, _y - ny*_w*0.35);
        ctx.closePath();
        ctx.fillStyle = "#2a1842";
        ctx.fill();
        ctx.strokeStyle = RIVAL_INK;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = "rgba(" + RIVAL2_GOLD + "," + (0.6 + 0.4*_p) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
        //先の赤い光
        ctx.fillStyle = "rgba(255,70,100," + (0.55 + 0.45*_p) + ")";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx + _dx*_l*0.12 + nx*_w*0.5, hy + _dy*_l*0.12 + ny*_w*0.5);
        ctx.lineTo(hx + _dx*_l*0.12 - nx*_w*0.5, hy + _dy*_l*0.12 - ny*_w*0.5);
        ctx.closePath();
        ctx.fill();
        //付け根の輪
        ctx.beginPath(); ctx.arc(_x + _dx*_w*0.6, _y + _dy*_w*0.6, _w*0.55, 0, Math.PI*2);
        ctx.fillStyle = "rgb(" + RIVAL2_GOLD + ")"; ctx.fill();
        ctx.strokeStyle = RIVAL_INK; ctx.lineWidth = 1; ctx.stroke();
    },
    //光る目(体の絵の目の上に重ねる。translate済み)：DroneLook と同じ弾み・傾き・振り向きで目の位置を出す
    drawEyes:function(_e,_k,_a,_f2){
        var L = _e.look, col = _f2 ? RIVAL2_EYE : RIVAL_EYE, face = L.shownFace();
        if(face == "blink" || face == "dizzy") return;
        ctx.save();
        ctx.translate(0, Math.sin(L.t*0.08)*1.5*_k);
        ctx.rotate(L.tilt);
        var ey = (6.5 + L.elev*1.5)*_k;
        for(var s=-1; s<=1; s+=2){
            var a = (L.yaw + s*26)*Math.PI/180, z = Math.cos(a);
            if(z < 0.2) continue;
            var x = -18*Math.sin(a)*_k;
            ctx.globalAlpha = _a*(_f2 ? 0.9 : 0.45)*z;
            enemyArt.halo(x, ey, (_f2 ? 7 : 5)*_k*0.75, col, _f2 ? 0.55 : 0.4);
            ctx.fillStyle = "rgb(" + col + ")";
            ctx.beginPath(); ctx.ellipse(x, ey, 2.3*_k*0.75*z, 1.5*_k*0.75, 0, 0, Math.PI*2); ctx.fill();
            //第二形態：目から流れる光の尾(動いている向きの逆へ)
            if(_f2){
                var vx = -(_e.vx + (_e.mvx || 0)), vy = -(_e.vy + (_e.mvy || 0)), sp = Math.hypot(vx,vy);
                var lx = sp > 0.5 ? vx/sp : s*0.9, ly = sp > 0.5 ? vy/sp : 0.2, len = (6 + Math.min(14, sp*2))*_k*0.75;
                ctx.strokeStyle = "rgba(" + col + ",0.55)";
                ctx.lineWidth = 1.6*_k*0.75;
                ctx.lineCap = "round";
                ctx.beginPath(); ctx.moveTo(x, ey); ctx.lineTo(x + lx*len, ey + ly*len); ctx.stroke();
            }
        }
        ctx.restore();
        ctx.globalAlpha = _a;
    },
    //連れてきた自分(translate済み。rival.drawClone から)：過去はセピアのフィルム、未来は暗い体に水色の光と傷
    drawEra:function(_c,_body,_a){
        var E = _c.era == "past" ? CT_ERA_PAST : CT_ERA_FUTURE, k = E.k, past = _c.era == "past";
        if(!_c.wfx || _c.wfx.k != k) _c.wfx = new RivalWarp(k);
        if(!_c.wfx.snap || _c.t % 20 == 0) _c.wfx.shoot(_c.look);
        enemyArt.halo(0, 0, 30*k, E.col, 0.2*_a);
        rival.drawBody(_c, _body, _a);
        //色を重ねる(体と同じ形の光)
        _c.wfx.drawGlow(0, 0, (past ? 0.42 : 0.22)*_a, past ? "200,150,90" : E.col);
        if(past){
            //フィルムの傷とちらつき
            ctx.save();
            ctx.globalAlpha = 0.5*_a;
            ctx.strokeStyle = "rgba(255,240,210,0.8)";
            ctx.lineWidth = 1;
            var x = ((_c.t*7) % 50) - 25;
            ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(x + 3, 30); ctx.stroke();
            if(_c.t % 11 < 2){ ctx.fillStyle = "rgba(255,240,210,0.3)"; ctx.fillRect(-30, -30, 60, 60); }
            ctx.restore();
        }else{
            //体を斜めに走る傷と、まわりの水色の破片
            ctx.save();
            ctx.globalAlpha = _a;
            ctx.strokeStyle = "rgba(" + E.col + ",0.9)";
            ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.moveTo(-14*k, -2*k); ctx.lineTo(-4*k, 5*k); ctx.lineTo(2*k, 2*k); ctx.lineTo(12*k, 12*k); ctx.stroke();
            for(var i=0; i<4; i++){
                var a = _c.t*0.03 + i*Math.PI/2, r = 30*k;
                ctx.fillStyle = "rgba(" + E.col + ",0.7)";
                ctx.save();
                ctx.translate(Math.cos(a)*r, Math.sin(a)*r*0.6);
                ctx.rotate(a*2);
                ctx.fillRect(-2.5, -2.5, 5, 5);
                ctx.restore();
            }
            ctx.restore();
        }
        //名前
        ctx.save();
        ctx.globalAlpha = _a;
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.strokeText(E.name, 0, -30*k);
        ctx.fillStyle = past ? "rgb(120,80,30)" : "rgb(20,110,160)";
        ctx.fillText(E.name, 0, -30*k);
        ctx.restore();
        ctx.lineWidth = 1;
    }
};
