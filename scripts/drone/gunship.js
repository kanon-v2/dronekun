//------------------------------------------------------------------------------
//  ボスの試作：強襲ヘリ「疾風」(種類 gunship。雑魚敵の heli とは別)
//  今までのボスと違って画面の外も使う。速く飛び回り、画面の外へ消えては別の所から仕掛けてくる。
//  ・ホバリング(hover)：画面の中を素早く跳び移りながら、機銃(gun)かロケット(rockets)を撃つ。いちばん攻撃しやすい時間
//  ・突撃(strafe)：画面の外へ抜け、通り道の予告(赤い帯)のあと、画面を一気に横切る。通った跡に弾を残す。
//    横切っている間にジャスト衝撃波を合わせると弾き返せて、きりもみになって大きなダメージ
//  ・包囲射撃(orbit)：画面の外をぐるりと回りながら、外から追尾ミサイルを撃ち込む
//  ・爆撃(bomb)：画面の上を横切りながら爆弾を落とす。爆弾は印の高さではじけて弾の輪になる
//  画面の前後(奥行き z。見え方は shotLab.depthAt と同じ)も使う：
//  ・奥からの砲撃と突っ込み(deep)：奥へ下がって小さくなり(sink)、地平線のあたりを横切りながら砲弾を撃ち込む(far。着く所に印)。
//    端まで来ると正面を向いて突っ込んでくる(charge)。着く直前に衝撃波を合わせると弾き返せる。そのまま手前を通り抜ける(flyby)
//  ・手前を横切る(front)：カメラのすぐ前を大きく薄い姿で横切り(near)、手前から画面へ撃ち込む。着く所はドローン君の高さに沿って並ぶ
//  奥はほかの敵より後ろ(drawAttack)、手前はいちばん手前(drawFront)に描く
//  画面の外にいる間は狙えず当たらない(phased)。いる所は画面のふちの印(drawFront)でわかる。
//  戦っている間は風の筋が流れ(drawUnder)、速く飛ぶほど残像が出る(疾走感)。
//  デバッグのメニューの「ヘリ(試作)」で戦える(bossDebug.gunship)。ふつうの周には出てこない。
//  協力プレイには対応していない(試作のため)。
//------------------------------------------------------------------------------
const HELI_HP_MUL     = 1.0;        //体力(ほかのボスと同じ式の値に掛ける)
const HELI_PATTERNS   = ["gun","strafe","rockets","deep","gun","orbit","rockets","front","gun","bomb"];   //攻撃の順番(gun・rockets はホバリング)
const HELI_HOVER_T    = [190,150];  //ホバリングして撃つ長さ(フレーム。ふだん・怒り)
const HELI_HOVER_Y    = [130,250];  //ホバリングの高さの範囲(上のHUDに重ならない)
const HELI_DART_EVERY = [55,85];    //ホバリング中に次の場所へ跳ぶ間隔(フレーム)
const HELI_SPRING     = 0.008;      //目標へ寄るばねの強さ(小さめの減衰で少し行きすぎる)
const HELI_DAMP       = 0.93;       //速さの減衰(1フレームごとに掛ける)
const HELI_MAX_SPEED  = 21;         //ばねで動くときの速さの上限(px/フレーム)
const HELI_GUN_EVERY  = [40,28];    //機銃の連射の間隔(フレーム)
const HELI_GUN_BURST  = [5,7];      //1回の連射の弾の数
const HELI_GUN_GAP    = 4;          //連射の弾と弾の間(フレーム)
const HELI_GUN_SPEED  = 4.2;        //機銃の弾の速さ(danmaku() を掛ける。上限1.3倍)
const HELI_ROCKET_AT  = [105,35];   //ロケットを撃つ時刻(ホバリングの残りフレーム。HELI_ROCKET_LOCK 足してもホバリングの長さより短く)
const HELI_ROCKET_LOCK = 36;        //ロケットの前に狙いを付ける長さ(この間、赤い照準が出る)
const HELI_ROCKET_N   = [5,7];      //1回に撃つロケットの数
const HELI_ROCKET_SPREAD = 0.16;    //ロケットの扇の間(ラジアン)
const HELI_ROCKET_V   = [1.2,7.5];  //ロケットの速さ(出たとき・いちばん速いとき)
const HELI_ROCKET_ACC = 0.22;       //ロケットの加速
const HELI_EXIT_ACC   = 1.1;        //画面の外へ去るときの加速
const HELI_OFF        = 170;        //画面の外で待つ位置(画面のふちからの距離)
const HELI_PASSES     = [2,3];      //突撃の回数(ふだん・怒り)
const HELI_PASS_SPEED = [16,19];    //突撃の速さ(px/フレーム)
const HELI_LANE_WARN  = [62,48];    //突撃の通り道の予告の長さ(フレーム)
const HELI_LANE_LOCK  = 22;         //予告の最後のこの間は、通り道が固まる(帯が濃くなる)
const HELI_LANE_GAP   = 16;         //突撃と突撃の間に画面の外で待つ長さ(フレーム)
const HELI_WAKE_EVERY = [4,3];      //突撃の跡に弾を残す間隔(フレーム)
const HELI_WAKE_SPEED = 1.3;        //跡の弾の速さ(上下へ散る)
const HELI_ORBIT_T    = [230,270];  //包囲射撃の長さ(フレーム)
const HELI_ORBIT_W    = [0.03,0.036];   //画面の外を回る速さ(ラジアン/フレーム)
const HELI_ORBIT_OUT  = 120;        //画面の外を回る輪の、画面のふちからの距離
const HELI_MISSILE_EVERY = [30,22]; //包囲射撃のミサイルの間隔(フレーム)
const HELI_BOMB_Y     = 125;        //爆撃で飛ぶ高さ(回転翼が上の体力ゲージに重ならない高さ)
const HELI_BOMB_SPEED = [7,8.5];    //爆撃で飛ぶ速さ
const HELI_BOMB_EVERY = [17,12];    //爆弾を落とす間隔(フレーム)
const HELI_BOMB_G     = 0.2;        //爆弾の重さ(落ちる加速)
const HELI_BOMB_RING  = [8,10];     //爆弾がはじけて出す弾の数
const HELI_BOMB_RUNS  = [1,2];      //爆撃で横切る回数
const HELI_PARRY_DMG  = 0.06;       //突撃を弾き返したときのダメージ(体力に掛ける)
const HELI_SPIN_T     = 70;         //弾き返されて、きりもみになる長さ(フレーム)
const HELI_TRAIL_SPEED = 8;         //この速さより速いと残像が出る
const HELI_CHOP_EVERY = 6;          //回転翼の音の間隔(フレーム)
//登場：画面の外で音 → 画面を一気に横切る → 反対から戻ってきて急ブレーキで止まる(フレーム)
const HELI_IN_PASS    = 40;         //横切り始める時刻
const HELI_IN_BACK    = 120;        //戻ってくる時刻
const HELI_IN_END     = 175;        //止まって戦いが始まる時刻
//奥行き(z。0 がドローン君の面、プラスが奥、マイナスが手前。見え方は shotLab.depthAt と同じ DEPTH_VP・DEPTH_K)
const HELI_FAR_Z      = 0.75;       //奥へ下がったときの奥行き
const HELI_FAR_Y      = 175;        //奥を飛ぶ高さ(画面の y。地平線のあたり)
const HELI_SINK_SPEED = 0.016;      //奥へ下がる速さ(1フレームに増える z)
const HELI_FAR_SPEED  = [6,7.5];    //奥を横切る速さ(画面の px/フレーム)
const HELI_FAR_EVERY  = [20,14];    //奥から砲弾を撃つ間隔(フレーム)
const HELI_SHELL_T    = 75;         //奥からの砲弾が着くまで(フレーム)
const HELI_SHELL_R    = 30;         //砲弾が着いたときに当たる範囲の半径
const HELI_SHELL_SHARDS = 6;        //砲弾が着いて散る破片の数(danmaku() を掛ける)
const HELI_RAM_T      = 80;         //奥から突っ込んでくる長さ(フレーム)
const HELI_RAM_LOCK   = 0.6;        //この割合までは狙いがドローン君を追い、そのあと止まる
const HELI_RAM_R      = 40;         //着いたときに当たる範囲の半径
const HELI_RAM_JUST   = 12;         //着くまでこのフレーム以内に衝撃波を出すと弾き返す(4 以内は PERFECT)
const HELI_RAM_DMG    = 0.08;       //弾き返したときのダメージ(体力に掛ける。PERFECT は1.5倍)
const HELI_FLYBY_T    = 20;         //着いたあと、手前を通り抜けて消えるまで(フレーム)
const HELI_FLYBY_Z    = 0.1;        //通り抜けるときの手前の奥行き(マイナスにして使う)
const HELI_NEAR_Z     = -0.075;     //手前を横切るときの奥行き(約2.1倍に見える)
const HELI_NEAR_Y     = 250;        //手前を横切る高さ
const HELI_NEAR_OFF   = 300;        //手前を横切る前に待つ位置(画面のふちからの距離。大きく見えるので遠め)
const HELI_NEAR_WARN  = [50,40];    //手前を横切る前の予告(フレーム)
const HELI_NEAR_SPEED = [13,15];    //手前を横切る速さ(px/フレーム)
const HELI_NEAR_EVERY = [6,5];      //手前から撃ち込む間隔(フレーム)
const HELI_NEAR_LEAD  = 70;         //撃ち込む所(ヘリの少し先)
const HELI_NEAR_SHELL_T = 34;       //手前からの弾が着くまで(フレーム)
const HELI_NEAR_R     = 22;         //手前からの弾が着いたときに当たる範囲の半径
const HELI_NEAR_ALPHA = 0.55;       //手前を横切る姿の濃さ(後ろが見えるように)
//奥行きの見せ方：背景(battleBg.far)も一緒に動かす
const HELI_BG_ZOOM    = 0.08;       //戦いの間、背景の空と街を少し大きく描く(battleBg.zoom。遠ざかってもふちが見えないように)
const HELI_BG_FAR     = 0.6;        //奥へ下がっている間、背景の空と街が遠ざかって暗くなる量(battleBg.far)
const HELI_BG_PUNCH   = -0.7;       //突っ込んできて着いた瞬間、背景がぐっと寄る量(マイナスで寄る)
const HELI_BG_EASE    = [0.03,0.08];    //背景が遠ざかる・戻る速さ(1フレームに近づく割合)
const HELI_BEACON     = 40;         //奥にいるときの赤い灯りの点滅の間隔(フレーム)
//倒したとき：煙を吐き、きりもみで奥の街へ落ちて、地平線で爆発する
const HELI_CRASH_T    = 110;        //落ちていく長さ(フレーム)
const HELI_CRASH_Z    = 0.8;        //落ちる先の奥行き
const HELI_CRASH_BURN = 150;        //落ちたあと、火と煙が上がっている長さ(フレーム)
//風の筋(疾走感)
const HELI_WIND_N     = 28;         //筋の数
const HELI_WIND_SPEED = [9,22];     //流れる速さ(px/フレーム)

BOSS_TYPES.gunship = { name:"強襲ヘリ・疾風", r:30, en:"GUNSHIP HAYATE", title:"空を裂く疾風" };
COUNTER_TYPES.push("gunship");      //突撃をジャスト衝撃波で弾き返せる

var gunship = {
    wind:[],        //風の筋
    gust:0,         //風が強まる量(突撃・登場で上がり、だんだん戻る)
    shells:[],      //奥・手前から撃ち込まれた弾(着く所の印の中が当たる)
    wreck:null,     //倒れて奥の街へ落ちていく機体
    bgOwn:false,    //背景の遠ざかり(battleBg.far)をこのボスが動かしている(戻しきったら手放す)

    //いま戦っている強襲ヘリ(いなければnull)
    alive:function(){
        for(var i=0; i<enemies.length; i++) if(enemies[i].type == "gunship" && !enemies[i].dead) return enemies[i];
        return null;
    },
    //makeBoss のあとに足す値
    init:function(_b){
        _b.hp = _b.maxHp = Math.round(_b.hp*HELI_HP_MUL);
        _b.x = -HELI_OFF - 80; _b.y = 200;
        _b.look = 1;        //向き(1：右 -1：左。間の値は振り向いている途中)
        _b.tilt = 0;        //機体の傾き(進む向きへ機首が下がる・ブレーキで上がる)
        _b.pvx = 0;         //前のフレームの速さ(加速を求める)
        _b.gunA = 0;        //機銃の向き
        _b.trail = [];      //残像
        _b.spinA = 0;       //きりもみの回転
        _b.lockT = 0;       //ロケットの照準を出している残り
        _b.lockX = 0; _b.lockY = 0;
        _b.z = 0;           //奥行き(0：ドローン君の面 プラス：奥 マイナス：手前)
        this.wind = [];
        this.shells = [];
        this.wreck = null;
        this.gust = 1;
    },

    //------------------------------------------------------------------ 動き
    update:function(_e,_dx,_dy,_d){
        this.tickWind();
        this.chop(_e);
        this.stepShells();
        this.bgStep(_e);
        if(!special.bossCommon(_e)) return;
        var tgt = aimAt || drone;
        var rage = _e.enraged ? 1 : 0;
        switch(_e.mode){
            case "idle":
                this.next(_e);
                break;
            case "hover":
                this.spring(_e);
                //画面の中にいる間だけ時間を数えて撃つ(画面の外から戻ってくる間は撃たない)
                if(!this.onScreen(_e, 20)) break;
                if(--_e.timer <= 0){
                    _e.timer = randIn(HELI_DART_EVERY);
                    this.pickSpot(_e, true);
                }
                if(mainScreen.state == "play") this.hoverFire(_e, tgt, rage);
                if(--_e.count <= 0) this.next(_e);
                break;
            case "exit":
                //画面の外へ一気に抜ける
                _e.vx = Math.max(-26, Math.min(26, _e.vx + _e.side*HELI_EXIT_ACC));
                _e.vy *= 0.9;
                if(Math.abs(_e.x - CW/2) > CW/2 + HELI_OFF){
                    if(_e.after == "strafe"){ _e.runs = HELI_PASSES[rage]; this.lane(_e, tgt); }
                    else if(_e.after == "bomb"){ _e.runs = HELI_BOMB_RUNS[rage]; this.bombRun(_e); }
                    else if(_e.after == "front") this.nearStart(_e, tgt);
                    else this.orbitStart(_e);
                }
                break;
            case "lane":
                //画面の外で待ちながら、通り道をドローン君の高さに合わせる(最後の HELI_LANE_LOCK で固まる)
                _e.vx = 0; _e.vy = 0;
                if(_e.count > HELI_LANE_LOCK) _e.laneY = Math.max(70, Math.min(CH - 50, tgt.Y));
                _e.y += (_e.laneY - _e.y)*0.3;
                if(_e.count == HELI_LANE_LOCK) sound.play("tell");
                if(_e.count % 12 == 0 && _e.count > 0) this.sfx("warn");
                if(--_e.count <= 0){
                    _e.mode = "pass";
                    _e.y = _e.laneY;
                    _e.vx = _e.dir*HELI_PASS_SPEED[rage];
                    this.gust = 1;
                    this.sfx("pass");
                }
                break;
            case "pass":
                //通り道を一気に横切る。通った跡に、上下へ散る弾を残す
                _e.vx = _e.dir*HELI_PASS_SPEED[rage];
                _e.vy = (_e.laneY - _e.y)*0.2;
                if(this.onScreen(_e, 0) && _e.t % HELI_WAKE_EVERY[rage] == 0 && mainScreen.state == "play"){
                    var bx = _e.x - _e.dir*36;
                    for(var s=-1; s<=1; s+=2){
                        fireShot(bx, _e.y, s*Math.PI/2 + (Math.random() - 0.5)*0.5 - _e.dir*0.15*s, HELI_WAKE_SPEED*Math.min(1.3,danmaku()), "small");
                    }
                }
                if((_e.dir > 0 && _e.x > CW + HELI_OFF) || (_e.dir < 0 && _e.x < -HELI_OFF)){
                    if(--_e.runs > 0){ this.lane(_e, tgt); _e.count += HELI_LANE_GAP; }
                    else this.next(_e);
                }
                break;
            case "orbit":
                //画面の外をぐるりと回り、外から追尾ミサイルを撃ち込む
                _e.orbA += _e.orbDir*HELI_ORBIT_W[rage];
                var p = this.orbitAt(_e.orbA);
                _e.vx = p.x - _e.x; _e.vy = p.y - _e.y;
                if(_e.count % HELI_MISSILE_EVERY[rage] == 0 && mainScreen.state == "play") this.missile(_e, tgt);
                if(--_e.count <= 0) this.next(_e);
                break;
            case "bomb":
                //画面の上を横切りながら爆弾を落とす
                _e.vx = _e.dir*HELI_BOMB_SPEED[rage];
                _e.vy = (HELI_BOMB_Y + Math.sin(_e.t*0.08)*6 - _e.y)*0.1;
                if(_e.x > 40 && _e.x < CW - 40 && _e.t % HELI_BOMB_EVERY[rage] == 0 && mainScreen.state == "play") this.dropBomb(_e, tgt, rage);
                if((_e.dir > 0 && _e.x > CW + HELI_OFF) || (_e.dir < 0 && _e.x < -HELI_OFF)){
                    if(--_e.runs > 0) this.bombRun(_e);
                    else this.next(_e);
                }
                break;
            case "sink":
                //奥へ下がる(小さくなりながら地平線の方へ)
                _e.vx = 0; _e.vy = 0;
                _e.z = Math.min(HELI_FAR_Z, _e.z + HELI_SINK_SPEED);
                _e.x += (_e.farX - _e.x)*0.05;
                _e.y += (HELI_FAR_Y - _e.y)*0.06;
                if(_e.z >= HELI_FAR_Z){ _e.mode = "far"; _e.count = 0; }
                break;
            case "far":
                //奥の地平線のあたりを横切りながら、砲弾を撃ち込む。端まで来たら突っ込んでくる
                _e.vx = _e.dir*HELI_FAR_SPEED[rage];
                _e.vy = (HELI_FAR_Y + Math.sin(_e.t*0.07)*6 - _e.y)*0.1;
                if(++_e.count % HELI_FAR_EVERY[rage] == 0 && mainScreen.state == "play") this.farShell(_e, tgt);
                if((_e.dir > 0 && _e.x > CW - 120) || (_e.dir < 0 && _e.x < 120)) this.chargeStart(_e, tgt);
                break;
            case "charge":
                //奥から突っ込んでくる(正面の姿)。はじめは狙いが追い、止まってから着く
                _e.vx = 0; _e.vy = 0;
                var k = ++_e.count/HELI_RAM_T;
                if(k < HELI_RAM_LOCK){
                    _e.tx += (tgt.X - _e.tx)*0.08; _e.ty += (tgt.Y - _e.ty)*0.08;
                }else if(_e.count == Math.round(HELI_RAM_T*HELI_RAM_LOCK)) sound.play("tell");
                _e.z = _e.cz0*(1 - k)*(1 - k);     //後半で早く近づき、着く直前には印に重なる
                //見える大きさに合わせて近づく(遠い間はゆっくり、近づくと一気に)
                var s0 = this.scaleZ(_e.cz0), f = (this.scaleZ(_e.z) - s0)/(1 - s0);
                _e.x = _e.cx0 + (_e.tx - _e.cx0)*f;
                _e.y = _e.cy0 + (_e.ty - _e.cy0)*f;
                if(_e.count >= HELI_RAM_T){
                    if(mainScreen.state != "over" && Math.hypot(drone.X - _e.tx, drone.Y - _e.ty) < HELI_RAM_R + HIT_CORE && mainScreen.canBeHit()) mainScreen.damage();
                    _e.mode = "flyby"; _e.count = 0;
                    battleBg.far = HELI_BG_PUNCH;     //背景がぐっと寄る(そこから戻る)
                    fx.shake(10);
                    battleBg.ripple(_e.tx, _e.ty, 30, 8, 50, "220,60,60");
                    this.gust = 1.4;
                    sound.play("dash");
                }
                break;
            case "flyby":
                //手前を通り抜けて消え、画面の横から戻ってくる
                _e.vx = 0; _e.vy = 0;
                _e.z = -HELI_FLYBY_Z*(++_e.count)/HELI_FLYBY_T;
                _e.y -= 6;
                if(_e.count >= HELI_FLYBY_T){
                    _e.z = 0;
                    _e.x = _e.tx < CW/2 ? CW + HELI_OFF : -HELI_OFF;
                    _e.y = 200;
                    this.next(_e);
                }
                break;
            case "nearIn":
                //手前を横切る前：画面の外で待つ(ふちの印と回転翼の音で知らせる)
                _e.vx = 0; _e.vy = 0;
                _e.laneY = Math.max(80, Math.min(CH - 50, tgt.Y));
                if(_e.count % 12 == 0 && _e.count > 0) this.sfx("warn");
                if(--_e.count <= 0){
                    _e.mode = "near";
                    this.gust = 1.2;
                    this.sfx("pass");
                }
                break;
            case "near":
                //カメラのすぐ前を大きな影になって横切り、手前から画面の奥へ撃ち込む(着く所はドローン君の高さに沿って並ぶ)
                _e.vx = _e.dir*HELI_NEAR_SPEED[rage];
                _e.vy = (HELI_NEAR_Y + Math.sin(_e.t*0.05)*14 - _e.y)*0.1;
                _e.laneY += (tgt.Y - _e.laneY)*0.03;
                var ix = _e.x + _e.dir*HELI_NEAR_LEAD;
                if(_e.t % HELI_NEAR_EVERY[rage] == 0 && ix > 20 && ix < CW - 20 && mainScreen.state == "play") this.nearShell(_e, ix);
                this.gust = Math.max(this.gust, 0.6);
                if((_e.dir > 0 && _e.x > CW + HELI_NEAR_OFF) || (_e.dir < 0 && _e.x < -HELI_NEAR_OFF)){
                    _e.z = 0;
                    _e.x = _e.dir > 0 ? CW + HELI_OFF : -HELI_OFF;
                    this.next(_e);
                }
                break;
            case "spin":
                //弾き返されて、きりもみになる(煙を吐く)
                _e.vx *= 0.95; _e.vy = _e.vy*0.95 + 0.05;
                _e.spinA += 0.35*Math.min(1, _e.count/30 + 0.2);
                if(_e.t % 3 == 0){
                    var life = 30 + Math.random()*20;
                    effects.push({ smoke:true, x:_e.x, y:_e.y, vx:(Math.random() - 0.5), vy:-0.6,
                                   R0:6, R1:20, life:life, maxLife:life, color:"70,70,72" });
                }
                if(--_e.count <= 0){ _e.spinA = 0; this.next(_e); }
                break;
        }
        this.pose(_e, tgt);
    },

    //次の攻撃へ(ホバリングは画面の中の場所を選び、ばねで戻ってくる)
    next:function(_e){
        var p = HELI_PATTERNS[_e.pat++ % HELI_PATTERNS.length];
        if(p == "gun" || p == "rockets"){
            _e.mode = "hover";
            _e.sub = p;
            _e.count = HELI_HOVER_T[_e.enraged ? 1 : 0];
            _e.timer = randIn(HELI_DART_EVERY);
            _e.burst = 0;
            _e.gunT = 30;
            this.pickSpot(_e, false);
        }else if(p == "deep"){
            //今いる所から奥へ下がる(近いほうの端へ寄って、反対へ横切る)
            _e.mode = "sink";
            _e.farX = _e.x < CW/2 ? 140 : CW - 140;
            _e.dir = _e.farX < CW/2 ? 1 : -1;
            this.sfx("pass");
        }else{
            //近いほうの横から画面の外へ抜ける
            _e.mode = "exit";
            _e.after = p;
            _e.side = _e.x < CW/2 ? -1 : 1;
        }
    },
    //ホバリングする場所(_far：今いる所から離れた所へ跳ぶ)
    pickSpot:function(_e,_far){
        var x;
        for(var i=0; i<6; i++){
            x = 150 + Math.random()*(CW - 300);
            if(!_far || Math.abs(x - _e.x) > 260) break;
        }
        _e.hx = x;
        _e.hy = HELI_HOVER_Y[0] + Math.random()*(HELI_HOVER_Y[1] - HELI_HOVER_Y[0]);
    },
    //ばね：目標へ素早く寄り、少し行きすぎて止まる(上下に少しふわふわ)
    spring:function(_e){
        _e.vx = (_e.vx + (_e.hx - _e.x)*HELI_SPRING)*HELI_DAMP;
        _e.vy = (_e.vy + (_e.hy + Math.sin(_e.t*0.06)*8 - _e.y)*HELI_SPRING)*HELI_DAMP;
        var s = Math.hypot(_e.vx,_e.vy);
        if(s > HELI_MAX_SPEED){ _e.vx *= HELI_MAX_SPEED/s; _e.vy *= HELI_MAX_SPEED/s; }
    },
    //ホバリング中の攻撃：機銃の連射、またはロケットの斉射(前に照準を出す)
    hoverFire:function(_e,_tgt,_rage){
        if(_e.sub == "gun"){
            if(_e.burst > 0){
                if(--_e.gunT <= 0){
                    _e.burst--;
                    _e.gunT = _e.burst > 0 ? HELI_GUN_GAP : HELI_GUN_EVERY[_rage];
                    var m = this.muzzle(_e);
                    fireShot(m.x, m.y, Math.atan2(_tgt.Y - m.y, _tgt.X - m.x) + (Math.random() - 0.5)*0.08, HELI_GUN_SPEED*Math.min(1.3,danmaku()), "normal");
                    sound.play("enemyShot");
                }
            }else if(--_e.gunT <= 0){
                _e.burst = HELI_GUN_BURST[_rage];
                _e.gunT = 0;
            }
        }else{
            for(var i=0; i<HELI_ROCKET_AT.length; i++){
                if(_e.count == HELI_ROCKET_AT[i] + HELI_ROCKET_LOCK){
                    _e.lockT = HELI_ROCKET_LOCK;
                    sound.play("beamCharge");
                }
            }
            if(_e.lockT > 0){
                _e.lockX = _tgt.X; _e.lockY = _tgt.Y;
                if(--_e.lockT == 0) this.rockets(_e, _rage);
            }
        }
    },
    //機銃の口(機首の下)の位置
    muzzle:function(_e){
        var f = _e.look >= 0 ? 1 : -1;
        return { x:_e.x + f*34, y:_e.y + 15 };
    },
    //ロケットの斉射：照準の所へ扇に撃つ。はじめは遅く、だんだん速くなる
    rockets:function(_e,_rage){
        var n = HELI_ROCKET_N[_rage];
        var a0 = Math.atan2(_e.lockY - _e.y, _e.lockX - _e.x);
        for(var i=0; i<n; i++){
            var a = a0 + (i - (n - 1)/2)*HELI_ROCKET_SPREAD;
            enemyShots.push({ x:_e.x, y:_e.y + 10, vx:Math.cos(a)*HELI_ROCKET_V[0], vy:Math.sin(a)*HELI_ROCKET_V[0],
                              r:5, kind:"hrocket", t:0, delay:i*3, grazed:false });
        }
        sound.play("missile");
        fx.shake(4);
    },

    //突撃の予告：画面の外の、通り道の入口で待つ
    lane:function(_e,_tgt){
        _e.mode = "lane";
        //今いる側から入る(はじめは抜けた側。2回目からは通り抜けた側)
        var side = _e.x < CW/2 ? -1 : 1;
        _e.dir = -side;
        _e.x = side < 0 ? -HELI_OFF : CW + HELI_OFF;
        _e.laneY = Math.max(70, Math.min(CH - 50, _tgt.Y));
        _e.count = HELI_LANE_WARN[_e.enraged ? 1 : 0];
        _e.vx = 0; _e.vy = 0;
    },
    //爆撃：画面の上を横切る(今いる側から)
    bombRun:function(_e){
        _e.mode = "bomb";
        var side = _e.x < CW/2 ? -1 : 1;
        _e.dir = -side;
        _e.x = side < 0 ? -HELI_OFF : CW + HELI_OFF;
        _e.y = HELI_BOMB_Y;
        this.sfx("pass");
    },
    //爆弾：ドローン君の高さあたりではじける。落ちる所に印を出す(着く所は落としたときに計算しておく)
    dropBomb:function(_e,_tgt,_rage){
        var ty = Math.max(220, Math.min(CH - 30, _tgt.Y + (Math.random() - 0.5)*80));
        var b = { x:_e.x, y:_e.y + 18, vx:_e.dir*2.4, vy:0.6, r:7, kind:"hbomb", t:0, ty:ty, n:HELI_BOMB_RING[_rage], grazed:false };
        //着く所(印を出すため)
        var x = b.x, y = b.y, vx = b.vx, vy = b.vy;
        while(y < ty){ vy += HELI_BOMB_G; vx *= 0.99; x += vx; y += vy; }
        b.lx = x;
        enemyShots.push(b);
        this.sfx("drop");
    },

    //包囲射撃を始める(今いる所にいちばん近い輪の上から)
    orbitStart:function(_e){
        _e.mode = "orbit";
        _e.count = HELI_ORBIT_T[_e.enraged ? 1 : 0];
        _e.orbA = Math.atan2((_e.y - CH/2)/(CH/2 + HELI_ORBIT_OUT), (_e.x - CW/2)/(CW/2 + HELI_ORBIT_OUT));
        _e.orbDir = Math.random() < 0.5 ? 1 : -1;
        var p = this.orbitAt(_e.orbA);
        _e.x = p.x; _e.y = p.y;
    },
    orbitAt:function(_a){
        return { x:CW/2 + Math.cos(_a)*(CW/2 + HELI_ORBIT_OUT), y:CH/2 + Math.sin(_a)*(CH/2 + HELI_ORBIT_OUT) };
    },
    //画面の外からの追尾ミサイル(画面のふちから出す。外で消えないよう homing)
    missile:function(_e,_tgt){
        var x = Math.max(-6, Math.min(CW + 6, _e.x)), y = Math.max(-6, Math.min(CH + 6, _e.y));
        var a = Math.atan2(_tgt.Y - y, _tgt.X - x);
        enemyShots.push({ x:x, y:y, vx:Math.cos(a)*3, vy:Math.sin(a)*3, r:5, kind:"missile",
                          homing:true, turn:0.035, speed:3.7*Math.min(1.2,danmaku()), life:170, grazed:false });
        fx.flare(x, y, 30, "255,150,60", 10);
        sound.play("missile");
    },

    //見た目の向き・傾き・機銃の向き・残像。画面の外では狙えず当たらない
    pose:function(_e,_tgt){
        var ax = _e.vx - _e.pvx;
        _e.pvx = _e.vx;
        //向き：速く横へ動いていればその向き、そうでなければドローン君の方
        var want = Math.abs(_e.vx) > 1.5 ? (_e.vx > 0 ? 1 : -1) : (_tgt.X > _e.x ? 1 : -1);
        if(["lane","pass","bomb","far","sink","nearIn","near"].indexOf(_e.mode) >= 0) want = _e.dir;
        _e.look += (want - _e.look)*0.2;
        //傾き：進む向きへ機首を下げ、ブレーキでは上げる
        var tilt = Math.max(-0.5, Math.min(0.5, _e.vx*0.022 + ax*0.5));
        if(this.front(_e)) tilt = 0;
        _e.tilt += (tilt - _e.tilt)*0.15;
        _e.gunA = Math.atan2(_tgt.Y - _e.y, _tgt.X - _e.x);
        if(_e.lockT > 0) _e.gunA = Math.atan2(_e.lockY - _e.y, _e.lockX - _e.x);
        //残像
        if(Math.hypot(_e.vx,_e.vy) > HELI_TRAIL_SPEED && _e.t % 2 == 0 && this.layer(_e) == "plane"){
            _e.trail.unshift({ x:_e.x, y:_e.y, look:_e.look, tilt:_e.tilt, spinA:_e.spinA });
            if(_e.trail.length > 5) _e.trail.pop();
        }else if(_e.t % 3 == 0) _e.trail.pop();
        //画面の外・奥・手前にいる間は狙えず当たらない(突っ込んでくるときは着いた瞬間だけ当たる)
        var on = this.onScreen(_e, -_e.r) && Math.abs(_e.z) < 0.1 && _e.mode != "charge" && _e.mode != "flyby";
        _e.phased = !on;
        _e.harmless = !on;
    },
    //画面の中か(_m：画面のふちから外へ広げる量。マイナスなら内側へ)
    onScreen:function(_e,_m){
        return _e.x > -_m && _e.x < CW + _m && _e.y > -_m && _e.y < CH + _m;
    },

    //背景の空と街：ヘリが奥へ下がる間は遠ざかって暗くなり(ため)、突っ込んでくるにつれて戻る
    bgStep:function(_e){
        var want = 0;
        if(_e && !_e.dead){
            if(_e.mode == "sink" || _e.mode == "far") want = HELI_BG_FAR;
            else if(_e.mode == "charge"){ var k = 1 - _e.count/HELI_RAM_T; want = HELI_BG_FAR*k*k; }
        }
        var zoom = _e && !_e.dead ? HELI_BG_ZOOM : 0;
        if(want == 0 && zoom == 0 && !this.bgOwn) return;    //ほかの試作(finaleSync.js)が使っているときは触らない
        this.bgOwn = true;
        var f = battleBg.far;
        battleBg.far += (want - f)*(want > f ? HELI_BG_EASE[0] : HELI_BG_EASE[1]);
        battleBg.zoom += (zoom - battleBg.zoom)*0.03;
        if(want == 0 && zoom == 0 && Math.abs(battleBg.far) < 0.005 && battleBg.zoom < 0.002){ battleBg.far = 0; battleBg.zoom = 0; this.bgOwn = false; }
    },
    //倒されたとき(special.onKill を包んで呼ぶ)：機体は消え、代わりに奥の街へ落ちていく残骸を出す
    crash:function(_e){
        this.wreck = { x0:_e.x, y0:_e.y, t:0, dir:_e.x < CW/2 ? 1 : -1, look:_e.look, spinA:0, burn:0, hx:0, hy:0 };
        this.shells = [];
        this.sfx("pass");
    },
    //残骸を進める(mainScreen.updateEffects を包んで呼ぶ。WAVEクリアの間も動く)
    wreckStep:function(){
        if(!this.alive()) this.bgStep(null);
        var W = this.wreck;
        if(!W) return;
        if(W.burn > 0){
            //落ちたあと：火と煙が上がり続ける
            if(W.burn % 5 == 0){
                var life = 70 + Math.random()*40;
                effects.push({ smoke:true, x:W.hx + (Math.random() - 0.5)*8, y:W.hy, vx:(Math.random() - 0.5)*0.3, vy:-0.7 - Math.random()*0.4,
                               R0:4, R1:22 + Math.random()*14, life:life, maxLife:life, color:"60,58,60" });
            }
            if(++W.burn > HELI_CRASH_BURN) this.wreck = null;
            return;
        }
        W.t++;
        W.spinA += 0.08 + 0.3*W.t/HELI_CRASH_T;
        var P = this.wreckAt(W);
        if(W.t % 2 == 0){
            var life = 40 + Math.random()*20;
            effects.push({ smoke:true, x:P.x, y:P.y, vx:(Math.random() - 0.5)*0.4, vy:-0.3, R0:3*P.s + 2, R1:(14 + Math.random()*8)*P.s + 4,
                           life:life, maxLife:life, color:"70,68,70" });
        }
        if(W.t % 9 == 0) fx.sparks(P.x, P.y, 3, "255,150,60", 3*P.s + 1, 2);
        if(W.t >= HELI_CRASH_T){
            //地平線で爆発し、煙が立ちのぼる
            W.hx = P.x; W.hy = P.y; W.burn = 1;
            killBlast(P.x, P.y, 26);
            fx.flare(P.x, P.y, 110, "255,150,60", 26);
            fx.ring(P.x, P.y, 140, "255,170,90", 26, 4);
            fx.shake(10);
            battleBg.ripple(P.x, P.y, 30, 8, 70, "230,150,70");
            sound.play("explode");
            this.sfx("boom");
        }
    },
    //残骸の位置(下へ落ちながら奥へ遠ざかる。見え方は奥行きから)
    wreckAt:function(W){
        var k = W.t/HELI_CRASH_T;
        var z = HELI_CRASH_Z*Math.pow(k, 1.3);
        var x = W.x0 + W.dir*220*k, y = W.y0 + (CH + 80 - W.y0)*k*k;
        var s = this.scaleZ(z);
        return { x:DEPTH_VP.x + (x - DEPTH_VP.x)*s, y:DEPTH_VP.y + (y - DEPTH_VP.y)*s, s:s };
    },
    drawWreck:function(){
        var W = this.wreck;
        if(!W) return;
        if(W.burn > 0){
            //落ちた所の炎(ゆらぐ)
            var a = Math.min(1, (HELI_CRASH_BURN - W.burn)/40);
            enemyArt.halo(W.hx, W.hy - 3, 16 + Math.random()*5, "255,140,50", 0.8*a);
            ctx.fillStyle = "rgba(255,210,120," + (0.8*a) + ")";
            ctx.beginPath(); ctx.ellipse(W.hx, W.hy - 4, 4 + Math.random()*2, 7 + Math.random()*4, 0, 0, Math.PI*2); ctx.fill();
            return;
        }
        var P = this.wreckAt(W);
        ctx.save();
        ctx.translate(P.x, P.y);
        ctx.scale(P.s, P.s);
        this.art({ t:W.t*3, vx:0, lockT:0, gunA:0 }, null, { look:W.look, tilt:0.3*W.dir, spinA:W.spinA });
        ctx.restore();
        //燃えている所
        enemyArt.halo(P.x, P.y, 22*P.s + 6, "255,130,40", 0.7);
    },

    //奥行き z の大きさ(shotLab.depthAt と同じ)
    scaleZ:function(_z){
        return 1/Math.max(0.05, 1 + _z*DEPTH_K);
    },
    //どこに描くか("far"：敵より奥 "near"：いちばん手前 "plane"：ふつう)
    layer:function(_e){
        if(_e.z > 0.02) return "far";
        if(_e.z < -0.01) return "near";
        return "plane";
    },
    //正面の姿で描くか(突っ込んでくるとき)
    front:function(_e){
        return _e.mode == "charge" || _e.mode == "flyby";
    },

    //奥から突っ込んでくる(今いる奥の位置から、ドローン君のいる所へ)
    chargeStart:function(_e,_tgt){
        _e.mode = "charge";
        _e.count = 0;
        _e.cx0 = _e.x; _e.cy0 = _e.y; _e.cz0 = _e.z;
        _e.tx = _tgt.X; _e.ty = _tgt.Y;
        this.sfx("pass");
    },
    //手前を横切る前の位置へ(今いる側から入る)
    nearStart:function(_e,_tgt){
        _e.mode = "nearIn";
        var side = _e.x < CW/2 ? -1 : 1;
        _e.dir = -side;
        _e.x = side < 0 ? -HELI_NEAR_OFF : CW + HELI_NEAR_OFF;
        _e.y = HELI_NEAR_Y;
        _e.z = HELI_NEAR_Z;
        _e.laneY = Math.max(80, Math.min(CH - 50, _tgt.Y));
        _e.count = HELI_NEAR_WARN[_e.enraged ? 1 : 0];
    },
    //奥からの砲弾(ヘリの所から、撃ったときのドローン君の所へ)
    farShell:function(_e,_tgt){
        var s = this.scaleZ(_e.z), mx = _e.x + _e.look*30*s, my = _e.y + 12*s;
        this.shells.push({ x0:mx, y0:my, s0:s, tx:_tgt.X, ty:_tgt.Y, t:0, T:HELI_SHELL_T, R:HELI_SHELL_R, near:false });
        fx.flare(mx, my, 14, "255,150,90", 10);
        sound.play("bossShot");
    },
    //手前からの弾(大きく見えるところから、着く所へ縮みながら)
    nearShell:function(_e,_ix){
        var s = this.scaleZ(_e.z);
        this.shells.push({ x0:_e.x + _e.dir*34*s, y0:_e.y + 15*s, s0:s*1.4, tx:_ix, ty:_e.laneY + (Math.random() - 0.5)*36,
                           t:0, T:HELI_NEAR_SHELL_T, R:HELI_NEAR_R, near:true });
        sound.play("enemyShot");
    },
    //撃ち込まれた弾を進める：着いた瞬間、印の中にいれば被弾
    stepShells:function(){
        var ms = mainScreen, m = Math.min(1.3, danmaku());
        for(var i=this.shells.length - 1; i>=0; i--){
            var d = this.shells[i];
            if(++d.t < d.T) continue;
            if(ms.state != "over" && Math.hypot(drone.X - d.tx, drone.Y - d.ty) < d.R + HIT_CORE && ms.canBeHit()) ms.damage();
            if(d.near){
                fx.flare(d.tx, d.ty, d.R*1.6, "255,190,110", 8);
                fx.sparks(d.tx, d.ty, 5, "255,170,80", 4, 2.5);
            }else{
                var n = Math.round(HELI_SHELL_SHARDS*m), a0 = Math.random()*Math.PI*2;
                for(var j=0; j<n; j++) fireShot(d.tx, d.ty, a0 + j*Math.PI*2/n, 2*m, "small");
                fx.flare(d.tx, d.ty, d.R*1.8, "255,140,70", 12);
                fx.ring(d.tx, d.ty, d.R, "255,90,60", 12, 4);
                fx.shake(3);
                battleBg.ripple(d.tx, d.ty, 10, 6, 34, "255,110,70");
                this.sfx("boom");
            }
            this.shells.splice(i,1);
        }
    },
    //衝撃波を出したとき(shotLab.onBlast を包んで呼ぶ)：着く直前の突っ込みを弾き返す
    onBlast:function(){
        var e = this.alive();
        if(!e || e.mode != "charge") return;
        var left = HELI_RAM_T - e.count;
        if(left > HELI_RAM_JUST || Math.hypot(drone.X - e.tx, drone.Y - e.ty) > HELI_RAM_R + 40) return;
        var perfect = left <= 4;
        e.mode = "spin";
        e.count = HELI_SPIN_T;
        e.z = 0;
        e.x = e.tx; e.y = e.ty - 10;
        e.vx = (e.tx < CW/2 ? 1 : -1)*5; e.vy = -6;
        e.flash = 10;
        e.phased = false; e.harmless = false;     //すぐにダメージが入るよう(hitEnemy は当たらないボスを無視する)
        popup(e.tx, e.ty - 50, perfect ? "PERFECT" : "JUST", "rgb(" + JUST_COLOR + ")", true);
        fx.flare(e.x, e.y, 90, JUST_COLOR, 18);
        fx.ring(e.x, e.y, 150, JUST_COLOR, 24, 8);
        fx.sparks(e.x, e.y, 24, JUST_COLOR, 10, 3);
        fx.shake(16);
        mainScreen.hitStop = Math.max(mainScreen.hitStop, 8);
        sound.play("just");
        battleBg.far = HELI_BG_PUNCH*0.6;     //弾き返した瞬間も背景が寄る
        mainScreen.hitEnemy(e, Math.max(1, Math.round(e.maxHp*HELI_RAM_DMG*(perfect ? 1.5 : 1))), "counter");
    },

    //突撃をジャスト衝撃波で弾き返された：きりもみになり、大きなダメージ
    parry:function(_e){
        if(_e.mode != "pass") return;
        _e.mode = "spin";
        _e.count = HELI_SPIN_T;
        _e.vx = -_e.dir*7; _e.vy = -3;
        _e.flash = 10;
        fx.flare(_e.x, _e.y, 70, JUST_COLOR, 16);
        fx.ring(_e.x, _e.y, 120, JUST_COLOR, 22, 6);
        fx.sparks(_e.x, _e.y, 20, JUST_COLOR, 9, 3);
        fx.shake(12);
        popup(_e.x, _e.y - _e.r - 14, "カウンター！", "rgb(30,150,200)");
        mainScreen.hitEnemy(_e, Math.max(1, Math.round(_e.maxHp*HELI_PARRY_DMG)), "counter");
    },

    //------------------------------------------------------------------ 登場
    //画面の外で回転翼の音 → 画面を一気に横切る → 反対から戻ってきて急ブレーキで止まる
    entrance:function(_b){
        var t = ++mainScreen.introT;
        _b.t++;     //止まっている間も回転翼を回す(ふだんは mainScreen.updateEnemies が進める)
        this.tickWind();
        this.chop(_b);
        var y0 = 230;
        if(t < HELI_IN_PASS){
            _b.x = -HELI_OFF - 80; _b.y = y0; _b.vx = 0; _b.vy = 0;
        }else if(t < HELI_IN_BACK){
            //左から右へ一気に横切る(画面のまんなかで少し沈む)
            if(t == HELI_IN_PASS){ this.sfx("pass"); this.gust = 1; }
            _b.vx = 24; _b.vy = 0;
            _b.x = -HELI_OFF - 80 + (t - HELI_IN_PASS)*24;
            _b.y = y0 + Math.sin(Math.min(1, Math.max(0, _b.x/CW))*Math.PI)*30;
            if(_b.x > 0 && _b.x < CW) mainScreen.shake = Math.max(mainScreen.shake, 5);
        }else{
            //右から戻ってきて、ばねで止まる
            if(t == HELI_IN_BACK){
                _b.x = CW + HELI_OFF; _b.y = 190; _b.vx = -20; _b.vy = 0;
                _b.hx = CW*0.66; _b.hy = 180;
                this.sfx("pass");
                this.gust = 1;
            }
            _b.vx = (_b.vx + (_b.hx - _b.x)*0.012)*0.9;
            _b.vy = (_b.vy + (_b.hy - _b.y)*0.012)*0.9;
            _b.x += _b.vx; _b.y += _b.vy;
        }
        this.pose(_b, drone);
        if(t >= HELI_IN_END) this.arrived(_b);
    },
    //登場の終わり：風を巻き起こして止まり、名前を出して戦いが始まる
    arrived:function(_b){
        var M = mainScreen;
        _b.mode = "hover";
        _b.sub = "gun";
        _b.count = HELI_HOVER_T[0];
        _b.timer = randIn(HELI_DART_EVERY);
        _b.burst = 0; _b.gunT = 50;
        _b.pat = 1;     //最初のホバリング(gun)の次から
        _b.vx = 0; _b.vy = 0;
        fx.ring(_b.x, _b.y, 200, "200,220,240", 24, 6);
        fx.flare(_b.x, _b.y, 80, "255,240,210", 12);
        battleBg.ripple(_b.x, _b.y, 40, 8, 70, "120,170,230");
        fx.shake(14);
        sound.play("bossImpact");
        M.bossIntro = BOSS_INTRO_TIME;
        M.bossFreeze = false;
        M.droneIn = DRONE_IN_TIME;
        M.guard = Math.max(M.guard, 60);
        fx.ring(drone.X, drone.Y, 46, "80,160,255", 22, 3);
        fx.flare(drone.X, drone.Y, 40, "120,190,255", 18);
    },

    //------------------------------------------------------------------ 試作の弾(shotLab.step・draw を包んで足す)
    //動かしたら false、消すなら true。ロケット・爆弾でなければ null
    step:function(b){
        if(b.kind == "hrocket"){
            //少し遅れて火がつき、まっすぐ加速する
            b.t++;
            if(b.t > b.delay){
                var sp = Math.hypot(b.vx,b.vy) || 1;
                var ns = Math.min(HELI_ROCKET_V[1], sp + HELI_ROCKET_ACC);
                b.vx *= ns/sp; b.vy *= ns/sp;
                if(b.t % 2 == 0) effects.push({ smoke:true, x:b.x, y:b.y, vx:0, vy:0, R0:2, R1:7, life:16, maxLife:16, color:"150,150,150" });
            }
            return false;
        }
        if(b.kind == "hbomb"){
            b.t++;
            b.vy += HELI_BOMB_G;
            b.vx *= 0.99;
            if(b.y >= b.ty){
                //はじけて弾の輪になる
                fireRing(b.x, b.y, b.n, 2.1*Math.min(1.3,danmaku()), Math.random(), "small");
                fx.flare(b.x, b.y, 46, "255,150,60", 14);
                fx.ring(b.x, b.y, 60, "255,170,80", 14, 4);
                battleBg.ripple(b.x, b.y, 20, 4, 40, "230,150,70");
                sound.play("bossShot");
                this.sfx("boom");
                return true;
            }
            return false;
        }
        return null;
    },
    drawShot:function(b){
        if(b.kind == "hrocket"){
            ctx.save();
            ctx.translate(b.x,b.y);
            ctx.rotate(Math.atan2(b.vy,b.vx));
            if(b.t > b.delay){
                ctx.fillStyle = "rgba(255,150,50,0.75)";
                ctx.beginPath(); ctx.ellipse(-11,0,5 + Math.random()*4,3,0,0,Math.PI*2); ctx.fill();
            }
            ctx.fillStyle = "#2c2e31";
            ctx.fillRect(-8,-2.5,13,5);
            ctx.fillStyle = "#e5302b";
            ctx.beginPath(); ctx.moveTo(5,-2.5); ctx.lineTo(10,0); ctx.lineTo(5,2.5); ctx.fill();
            ctx.restore();
            return true;
        }
        if(b.kind == "hbomb"){
            ctx.save();
            ctx.translate(b.x,b.y);
            ctx.rotate(Math.atan2(b.vy,b.vx) - Math.PI/2);
            ctx.fillStyle = "#2c2e31";
            ctx.strokeStyle = "#141516"; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.ellipse(0,0,5.5,8,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-5,-7); ctx.lineTo(-6,-12); ctx.lineTo(6,-12); ctx.lineTo(5,-7); ctx.fill();     //尾翼
            ctx.fillStyle = (b.t >> 2) % 2 ? "#e5302b" : "#6e1a18";
            ctx.beginPath(); ctx.arc(0,3,2,0,Math.PI*2); ctx.fill();
            ctx.restore();
            return true;
        }
        return false;
    },

    //------------------------------------------------------------------ 音
    //回転翼の音：近いほど大きい(画面の外から近づいてくるのが聞こえる。奥では小さく、手前では大きく)
    chop:function(_e){
        if(_e.t % HELI_CHOP_EVERY != 0) return;
        var out = Math.max(0, _e.x - CW, -_e.x, _e.y - CH, -_e.y);
        this.sfx("chop", Math.min(1.6, this.scaleZ(_e.z || 0))/(1 + out/220));
    },
    sfx:function(_name,_k){
        if(!sound.seOn || !sound.ready()) return;
        var S = sound.seGain, now = sound.ctx.currentTime, k = _k == null ? 1 : _k;
        switch(_name){
            case "chop":
                sound.noise(0.07, 0.07*k, "lowpass", 320, 110, S);
                sound.tone("sine", 78, 52, 0.06, 0.06*k, S);
                break;
            case "pass":
                //風を切る音(近づいて高くなり、遠ざかって低くなる)
                sound.noise(0.5, 0.05, "bandpass", 300, 2200, S);
                sound.noise(0.7, 0.12, "bandpass", 2200, 260, S, now + 0.45);
                sound.tone("sawtooth", 210, 120, 1.0, 0.035, S, now + 0.1, 0.2, 900);
                break;
            case "warn":
                sound.tone("square", 990, 990, 0.05, 0.035, S, 0, 0, 3000);
                sound.tone("square", 740, 740, 0.05, 0.035, S, now + 0.08, 0, 3000);
                break;
            case "drop":
                sound.tone("sine", 1500, 420, 0.5, 0.03, S);
                break;
            case "boom":
                sound.noise(0.3, 0.12, "lowpass", 1200, 90, S);
                break;
        }
    },

    //------------------------------------------------------------------ 描画
    //風の筋を流す(戦っている間。登場と突撃で強まる)
    tickWind:function(){
        if(this.wind.length == 0){
            for(var i=0; i<HELI_WIND_N; i++) this.wind.push(this.newStreak(Math.random()*CW));
        }
        this.gust *= 0.985;
        var k = 1 + this.gust*1.2;
        for(var i=0; i<this.wind.length; i++){
            var w = this.wind[i];
            w.x -= w.sp*k;
            if(w.x + w.len < 0) this.wind[i] = this.newStreak(CW + Math.random()*200);
        }
    },
    newStreak:function(_x){
        var f = Math.random();
        return { x:_x, y:Math.random()*CH, len:40 + f*140, sp:HELI_WIND_SPEED[0] + f*(HELI_WIND_SPEED[1] - HELI_WIND_SPEED[0]), a:0.05 + f*0.12 };
    },
    //背景のすぐ上：風の筋(mainScreen.draw から)
    drawUnder:function(){
        this.drawWreck();
        if(!this.alive()){ this.shells = []; return; }
        if(this.wind.length == 0) return;
        ctx.lineCap = "round";
        for(var i=0; i<this.wind.length; i++){
            var w = this.wind[i];
            ctx.strokeStyle = "rgba(90,100,115," + (w.a*(1 + this.gust)) + ")";
            ctx.lineWidth = 1 + w.a*8;
            ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + w.len*(1 + this.gust*0.6), w.y); ctx.stroke();
        }
        ctx.lineCap = "butt";
        ctx.lineWidth = 1;
    },
    //敵より奥：奥にいるヘリ・撃ち込まれた弾と着く所の印・突っ込んでくる所の印・突撃の通り道の予告・爆弾の落ちる印・ロケットの照準・残像(special.drawAttack から)
    drawAttack:function(_e){
        if(this.layer(_e) == "far") this.drawBody(_e);
        this.drawShells(false);
        if(_e.mode == "charge"){
            //突っ込んでくる所(狙いを追う間は白い点線、止まると赤、弾き返せる間は水色)
            var left = HELI_RAM_T - _e.count, locked = _e.count >= HELI_RAM_T*HELI_RAM_LOCK, k = _e.count/HELI_RAM_T;
            var col = left <= HELI_RAM_JUST ? JUST_COLOR : (locked ? "220,40,40" : "255,255,255");
            ctx.fillStyle = "rgba(" + col + "," + (0.06 + 0.22*k*k) + ")";
            ctx.beginPath(); ctx.arc(_e.tx, _e.ty, HELI_RAM_R, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = "rgba(" + (col == "255,255,255" ? "120,120,130" : col) + "," + (locked ? 0.6 + 0.35*Math.sin(_e.t*0.5) : 0.6) + ")";
            ctx.lineWidth = 2.5;
            if(!locked) ctx.setLineDash([6,6]);
            ctx.beginPath(); ctx.arc(_e.tx, _e.ty, HELI_RAM_R, 0, Math.PI*2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.beginPath(); ctx.arc(_e.tx, _e.ty, HELI_RAM_R + 50*(1 - k), 0, Math.PI*2); ctx.stroke();
            ctx.lineWidth = 1;
        }
        if(_e.mode == "lane"){
            var warn = HELI_LANE_WARN[_e.enraged ? 1 : 0];
            var lock = _e.count <= HELI_LANE_LOCK;
            var k = 1 - _e.count/warn;
            var h = _e.r + drone.R;
            ctx.fillStyle = "rgba(220,40,40," + (lock ? 0.22 + 0.12*((_e.count >> 1) % 2) : 0.06 + 0.1*k) + ")";
            ctx.fillRect(0, _e.laneY - h, CW, h*2);
            ctx.strokeStyle = "rgba(220,40,40," + (lock ? 0.8 : 0.35) + ")";
            ctx.lineWidth = 2;
            ctx.setLineDash([14,10]);
            ctx.lineDashOffset = -_e.t*3*_e.dir;
            ctx.beginPath(); ctx.moveTo(0, _e.laneY - h); ctx.lineTo(CW, _e.laneY - h); ctx.moveTo(0, _e.laneY + h); ctx.lineTo(CW, _e.laneY + h); ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;
            //進む向きへ流れる矢印
            ctx.fillStyle = "rgba(220,40,40," + (lock ? 0.55 : 0.25) + ")";
            for(var x=((_e.t*6*_e.dir) % 90 + 90) % 90 - 90; x < CW + 90; x += 90){
                ctx.beginPath();
                ctx.moveTo(x - _e.dir*12, _e.laneY - 12); ctx.lineTo(x + _e.dir*6, _e.laneY); ctx.lineTo(x - _e.dir*12, _e.laneY + 12);
                ctx.lineTo(x - _e.dir*4, _e.laneY); ctx.closePath(); ctx.fill();
            }
            ctx.lineWidth = 1;
        }
        //爆弾の落ちる印(近づくほど縮んで濃くなる)
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.kind != "hbomb") continue;
            var p = Math.max(0, Math.min(1, (b.ty - b.y)/(b.ty - HELI_BOMB_Y)));
            ctx.strokeStyle = "rgba(220,40,40," + (0.25 + 0.5*(1 - p)) + ")";
            ctx.lineWidth = 2;
            var R = 10 + 22*p;
            ctx.beginPath(); ctx.arc(b.lx, b.ty, R, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(b.lx - 6, b.ty); ctx.lineTo(b.lx + 6, b.ty); ctx.moveTo(b.lx, b.ty - 6); ctx.lineTo(b.lx, b.ty + 6); ctx.stroke();
            ctx.lineWidth = 1;
        }
        //ロケットの照準
        if(_e.lockT > 0){
            var q = _e.lockT/HELI_ROCKET_LOCK;
            ctx.strokeStyle = "rgba(220,40,40," + (0.3 + 0.5*(1 - q)) + ")";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6,6]);
            ctx.beginPath(); ctx.moveTo(_e.x, _e.y + 10); ctx.lineTo(_e.lockX, _e.lockY); ctx.stroke();
            ctx.setLineDash([]);
            var R = 14 + 30*q;
            ctx.save();
            ctx.translate(_e.lockX, _e.lockY);
            ctx.rotate(q*2);
            ctx.lineWidth = 2;
            for(var i=0; i<4; i++){
                ctx.rotate(Math.PI/2);
                ctx.beginPath(); ctx.arc(0, 0, R, -0.45, 0.45); ctx.stroke();
            }
            ctx.restore();
            ctx.lineWidth = 1;
        }
        //残像(速く飛んでいるとき)
        for(var i=_e.trail.length - 1; i>=0; i--){
            var g = _e.trail[i];
            ctx.save();
            ctx.globalAlpha = 0.22*(1 - i/_e.trail.length);
            ctx.translate(g.x, g.y);
            this.art(_e, "#5a6470", g);
            ctx.restore();
        }
        ctx.globalAlpha = 1;
    },
    //いちばん手前：手前から撃ち込まれた弾・手前を横切る(通り抜ける)ヘリ・画面の外にいるときのふちの印(mainScreen.draw から)
    drawFront:function(){
        var e = this.alive();
        if(!e) return;
        this.drawShells(true);
        if(this.layer(e) == "near") this.drawBody(e);
        if(["sink","far","charge","flyby","near"].indexOf(e.mode) < 0) this.drawEdge(e);
    },
    //奥・手前にいるヘリ(大きさは奥行きから。奥はかすみ、手前は後ろが見えるよう薄く)
    drawBody:function(_e){
        var sc = this.scaleZ(_e.z), a = 1;
        if(_e.z > 0) a = 0.45 + 0.55*sc;
        else if(_e.mode == "flyby") a = 1 - _e.count/HELI_FLYBY_T;
        else a = HELI_NEAR_ALPHA;
        ctx.save();
        //手前を横切るときは、うしろに流れる影を重ねる
        if(_e.mode == "near"){
            for(var i=2; i>=1; i--){
                ctx.save();
                ctx.globalAlpha = a*0.25/i;
                ctx.translate(_e.x - _e.dir*i*34, _e.y);
                ctx.scale(sc, sc);
                this.art(_e, null);
                ctx.restore();
            }
        }
        ctx.globalAlpha = Math.max(0, a);
        ctx.translate(_e.x, _e.y);
        ctx.scale(sc, sc);
        if(this.front(_e)) this.artFront(_e, null); else this.art(_e, null);
        ctx.restore();
        ctx.globalAlpha = 1;
        //奥にいる間は、暗い背景でも見失わないよう赤い灯りが点滅する(大きさは奥行きによらない)
        if(_e.z > 0.1 && _e.t % HELI_BEACON < 8){
            var bx = _e.x - _e.look*60*sc, by = _e.y - 26*sc;
            enemyArt.halo(bx, by, 14, "255,60,50", 1);
            ctx.fillStyle = "#ff5040";
            ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, Math.PI*2); ctx.fill();
        }
    },
    //撃ち込まれた弾(_near：手前からの弾だけ / そうでなければ着く所の印と奥からの弾)
    drawShells:function(_near){
        for(var i=0; i<this.shells.length; i++){
            var d = this.shells[i], k = d.t/d.T;
            if(!_near){
                //着く所の印(外の輪が縮んで当たる範囲に重なる)
                ctx.fillStyle = "rgba(230,50,40," + (0.05 + 0.22*k*k) + ")";
                ctx.beginPath(); ctx.arc(d.tx, d.ty, d.R, 0, Math.PI*2); ctx.fill();
                ctx.strokeStyle = "rgba(220,40,40," + (0.3 + 0.5*k) + ")"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(d.tx, d.ty, d.R, 0, Math.PI*2); ctx.stroke();
                ctx.setLineDash([4,5]);
                ctx.beginPath(); ctx.arc(d.tx, d.ty, d.R + (d.near ? 24 : 46)*(1 - k), 0, Math.PI*2); ctx.stroke();
                ctx.setLineDash([]); ctx.lineWidth = 1;
            }
            if(d.near != _near) continue;
            //弾：奥からは小さく出て大きくなり、手前からは大きく出て縮む
            var x = d.x0 + (d.tx - d.x0)*k, y = d.y0 + (d.ty - d.y0)*k;
            var k2 = Math.max(0, k - 0.08), px = d.x0 + (d.tx - d.x0)*k2, py = d.y0 + (d.ty - d.y0)*k2;
            var R = 8*(d.s0 + (1 - d.s0)*k);
            ctx.strokeStyle = d.near ? "rgba(255,200,120,0.45)" : "rgba(120,110,120," + (0.25 + 0.3*k) + ")";
            ctx.lineWidth = Math.max(1, R*1.1); ctx.lineCap = "round";
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
            ctx.lineCap = "butt"; ctx.lineWidth = 1;
            ctx.fillStyle = "rgba(255,140,70,0.35)";
            ctx.beginPath(); ctx.arc(x, y, R*1.8 + 1, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#3a3340";
            ctx.beginPath(); ctx.arc(x, y, R + 1, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = "#ffb070";
            ctx.beginPath(); ctx.arc(x, y, R*0.5 + 0.5, 0, Math.PI*2); ctx.fill();
        }
    },
    //画面の外にいるときの、ふちの印(いる向きを指す矢印と小さなヘリ。近いほど大きい)
    drawEdge:function(e){
        if(e.x > 0 && e.x < CW && e.y > 0 && e.y < CH) return;
        var m = 30;
        var x = Math.max(m, Math.min(CW - m, e.x)), y = Math.max(m + 20, Math.min(CH - m, e.y));
        var out = Math.max(0, e.x - CW, -e.x, e.y - CH, -e.y);
        var k = Math.max(0.5, 1 - out/400);
        var a = Math.atan2(e.y - y, e.x - x);
        var warn = e.mode == "lane" || e.mode == "pass" || e.mode == "nearIn";
        var pulse = 0.6 + 0.4*Math.sin(e.t*(warn ? 0.6 : 0.25));
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = "rgba(255,255,255," + (0.75*k) + ")";
        ctx.beginPath(); ctx.arc(0, 0, 20*k, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(220,40,40," + pulse + ")";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        //矢印
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = "rgba(220,40,40," + pulse + ")";
        ctx.beginPath(); ctx.moveTo(30*k, 0); ctx.lineTo(20*k, -9*k); ctx.lineTo(20*k, 9*k); ctx.closePath(); ctx.fill();
        ctx.restore();
        //小さなヘリ
        ctx.scale(0.17*k, 0.17*k);
        this.art(e, "#2c2e31", { look:e.look, tilt:0, spinA:0 });
        ctx.restore();
        if(warn){
            ctx.font = "900 26px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "rgba(220,40,40," + pulse + ")";
            ctx.fillText("!", x + (e.x < CW/2 ? 34 : -34), y);
        }
        ctx.lineWidth = 1;
        ctx.fillStyle = "#000";
    },

    //強襲ヘリの正面の絵(奥から突っ込んでくるとき。横の絵と同じくらいの大きさ)
    artFront:function(_e,_body){
        var C = ENEMY_COLOR, A = enemyArt, t = _e.t;
        var body = _body || C.body, mid = _body || C.mid;
        ctx.save();
        ctx.scale(1.25, 1.25);
        ctx.rotate(Math.sin(t*0.12)*0.05);
        //脚
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10,14); ctx.lineTo(-15,25); ctx.moveTo(10,14); ctx.lineTo(15,25); ctx.stroke();
        ctx.fillStyle = C.ink; A.circle(-15,26,2.6); ctx.fill(); A.circle(15,26,2.6); ctx.fill();
        //小さな翼とロケットの筒(左右)
        ctx.beginPath(); ctx.rect(-42,0,84,6); A.fillInk(mid,1.3);
        for(var s=-1; s<=1; s+=2){
            A.circle(s*38,9,8); A.fillInk(mid,1.3);
            ctx.fillStyle = C.ink;
            for(var i=0; i<3; i++){ A.circle(s*38 + Math.cos(i*2.1 + 0.5)*3.6, 9 + Math.sin(i*2.1 + 0.5)*3.6, 1.4); ctx.fill(); }
        }
        //エンジン(左右の吸気口)
        for(var s=-1; s<=1; s+=2){
            A.circle(s*15,-25,6); A.fillInk(mid,1.3);
            ctx.fillStyle = C.ink; A.circle(s*15,-25,3); ctx.fill();
        }
        //胴体
        ctx.beginPath(); ctx.ellipse(0,-2,17,21,0,0,Math.PI*2); A.fillInk(body,1.8);
        if(!_body){
            ctx.fillStyle = C.red;
            ctx.fillRect(-16,3,32,3.5);
        }
        //窓(2人乗りが前後に並ぶ)
        ctx.beginPath(); ctx.moveTo(-11,-6); ctx.lineTo(-8,-20); ctx.lineTo(8,-20); ctx.lineTo(11,-6); ctx.closePath();
        A.fillInk(_body ? "#f4f4f4" : C.glass,1.2);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-9.5,-13); ctx.lineTo(9.5,-13); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-6,-17); ctx.lineTo(-2,-17); ctx.stroke();
        //機首のセンサーと機銃
        A.eye(0,9,3.6);
        A.circle(0,17,5); A.fillInk(mid,1.2);
        ctx.fillStyle = C.ink; A.circle(0,18,2); ctx.fill();
        //回転翼(正面から見ると横に長い線。羽根が回って伸び縮みする)
        ctx.fillStyle = C.ink; ctx.fillRect(-2.5,-38,5,10);
        ctx.fillStyle = "rgba(40,44,48,0.13)";
        ctx.beginPath(); ctx.ellipse(0,-38,88,5,0,0,Math.PI*2); ctx.fill();
        ctx.lineCap = "round";
        for(var i=0; i<4; i++){
            var a = t*0.55 + i*Math.PI/2;
            var bx = Math.cos(a)*88, by = Math.sin(a)*4;
            ctx.strokeStyle = by < 0 ? "rgba(25,27,30,0.35)" : "rgba(25,27,30,0.85)";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(0,-38); ctx.lineTo(bx,-38 + by); ctx.stroke();
        }
        ctx.lineCap = "butt";
        ctx.fillStyle = C.ink; A.circle(0,-38,3.2); ctx.fill();
        ctx.restore();
        ctx.lineWidth = 1;
    },

    //強襲ヘリの絵(横から見た攻撃ヘリ。右向きに描いて、向き look で左右を返す)
    //_pose：残像・ふちの印のときに、位置以外の姿勢(look・tilt・spinA)を渡す
    art:function(_e,_body,_pose){
        var C = ENEMY_COLOR, A = enemyArt, P = _pose || _e;
        var body = _body || C.body, mid = _body || C.mid;
        var lk = P.look;
        if(Math.abs(lk) < 0.1) lk = lk < 0 ? -0.1 : 0.1;
        var t = _e.t;
        ctx.save();
        ctx.rotate(P.tilt + (P.spinA || 0));
        ctx.scale(lk, 1);
        //尾：細長い尾と縦の尾翼・尾の回転翼
        ctx.beginPath(); ctx.moveTo(-18,-12); ctx.lineTo(-76,-9); ctx.lineTo(-76,-2); ctx.lineTo(-18,8); ctx.closePath();
        A.fillInk(body,1.5);
        ctx.beginPath(); ctx.moveTo(-64,-8); ctx.lineTo(-80,-28); ctx.lineTo(-87,-28); ctx.lineTo(-82,-3); ctx.closePath();
        A.fillInk(mid,1.4);
        ctx.beginPath(); ctx.rect(-74,-3,16,4); A.fillInk(mid,1.2);
        A.rotor(-80,-17,12,t*0.9,2,"rgba(25,27,30,0.75)",0.14);
        //胴体
        ctx.beginPath();
        ctx.moveTo(48,8);
        ctx.quadraticCurveTo(52,-4,40,-10);
        ctx.lineTo(18,-22);
        ctx.lineTo(-6,-24);
        ctx.lineTo(-24,-15);
        ctx.lineTo(-28,4);
        ctx.quadraticCurveTo(-20,17,0,17);
        ctx.lineTo(32,15);
        ctx.closePath();
        A.fillInk(body,1.8);
        //赤い線(見分けるための印)
        if(!_body){
            ctx.fillStyle = C.red;
            ctx.beginPath(); ctx.moveTo(-26,2); ctx.lineTo(44,4); ctx.lineTo(44,8); ctx.lineTo(-26,6); ctx.closePath(); ctx.fill();
        }
        //上のハイライト
        ctx.strokeStyle = C.light; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(-20,-14); ctx.lineTo(-6,-21); ctx.stroke();
        //エンジン
        A.roundRect(-24,-31,30,9,4); A.fillInk(mid,1.3);
        ctx.fillStyle = C.ink; ctx.fillRect(-27,-29,4,5);
        if(Math.abs(_e.vx) > 6 && !_body){
            ctx.fillStyle = "rgba(255,140,40," + (0.5 + Math.random()*0.4) + ")";
            ctx.beginPath(); ctx.ellipse(-31,-26.5,4 + Math.random()*4,2,0,0,Math.PI*2); ctx.fill();
        }
        //窓(2人乗り)
        ctx.beginPath(); ctx.moveTo(39,-10); ctx.lineTo(20,-21); ctx.lineTo(9,-21); ctx.lineTo(11,-9); ctx.closePath();
        A.fillInk(_body ? "#f4f4f4" : C.glass,1.2);
        ctx.beginPath(); ctx.moveTo(6,-22); ctx.lineTo(-6,-23); ctx.lineTo(-9,-11); ctx.lineTo(6,-10); ctx.closePath();
        A.fillInk(_body ? "#f4f4f4" : C.glass,1.2);
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(14,-18); ctx.lineTo(22,-18); ctx.moveTo(-3,-20); ctx.lineTo(2,-20); ctx.stroke();
        //機首のセンサー(赤い目)
        A.eye(45,0,3.4);
        //小さな翼とロケットの筒
        ctx.beginPath(); ctx.moveTo(-14,1); ctx.lineTo(10,3); ctx.lineTo(8,7); ctx.lineTo(-14,6); ctx.closePath(); A.fillInk(mid,1.2);
        A.roundRect(-16,8,26,9,4.5); A.fillInk(mid,1.3);
        ctx.fillStyle = C.ink;
        for(var i=0; i<3; i++){ A.circle(10,10 + i*2.6,1.1); ctx.fill(); }
        if(_e.lockT > 0 && !_body){
            //ロケットを撃つ前は筒の口が赤く光る
            A.halo(11,12.5,8,"229,48,43",1 - _e.lockT/HELI_ROCKET_LOCK);
        }
        //脚
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-14,17); ctx.lineTo(-16,23); ctx.moveTo(22,16); ctx.lineTo(24,22); ctx.stroke();
        ctx.fillStyle = C.ink; A.circle(-16,24,2.4); ctx.fill(); A.circle(24,23,2.4); ctx.fill();
        //機首の下の機銃(ドローン君の方を向く。体の傾きと向きを戻して求める)
        var ga = (_pose ? 0.6 : _e.gunA) - P.tilt - (P.spinA || 0);
        var gl = Math.atan2(Math.sin(ga), Math.cos(ga)*(lk < 0 ? -1 : 1));
        gl = Math.max(-0.2, Math.min(2.3, gl));
        ctx.save();
        ctx.translate(34,15);
        ctx.rotate(gl);
        ctx.fillStyle = C.ink; ctx.fillRect(0,-1.6,16,3.2);
        ctx.restore();
        A.circle(34,15,5); A.fillInk(mid,1.2);
        //回転翼の軸と主回転翼(横から見ると細い線。羽根が回って伸び縮みする)
        ctx.fillStyle = C.ink; ctx.fillRect(-7,-38,5,8);
        ctx.fillStyle = "rgba(40,44,48,0.13)";
        ctx.beginPath(); ctx.ellipse(-4.5,-38,84,5,0,0,Math.PI*2); ctx.fill();
        ctx.lineCap = "round";
        for(var i=0; i<4; i++){
            var a = t*0.55 + i*Math.PI/2;
            var bx = Math.cos(a)*84, by = Math.sin(a)*4;
            ctx.strokeStyle = by < 0 ? "rgba(25,27,30,0.35)" : "rgba(25,27,30,0.85)";
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-4.5,-38); ctx.lineTo(-4.5 + bx,-38 + by); ctx.stroke();
        }
        ctx.lineCap = "butt";
        ctx.fillStyle = C.ink; A.circle(-4.5,-38,3.2); ctx.fill();
        ctx.restore();
        ctx.lineWidth = 1;
    }
};

//------------------------------------------------------------------------------
//  ほかのファイルの処理を包んで、強襲ヘリを足す
//------------------------------------------------------------------------------
(function(){
    var makeBoss0 = makeBoss;
    makeBoss = function(_type){
        var b = makeBoss0(_type);
        if(_type == "gunship") gunship.init(b);
        return b;
    };
    var update0 = special.update;
    special.update = function(_e,_dx,_dy,_d){
        if(_e.type == "gunship"){ gunship.update(_e,_dx,_dy,_d); return true; }
        return update0.apply(this, arguments);
    };
    var draw0 = special.draw;
    special.draw = function(_e,_body){
        if(_e.type == "gunship"){
            if(gunship.layer(_e) == "plane"){ if(gunship.front(_e)) gunship.artFront(_e,_body); else gunship.art(_e,_body); }
            return true;
        }
        return draw0.apply(this, arguments);
    };
    var attack0 = special.drawAttack;
    special.drawAttack = function(_e){
        if(_e.type == "gunship"){ gunship.drawAttack(_e); return; }
        return attack0.apply(this, arguments);
    };
    var parry0 = special.parry;
    special.parry = function(_e){
        if(_e.type == "gunship"){ gunship.parry(_e); return; }
        return parry0.apply(this, arguments);
    };
    //突撃(pass)で画面の中にいる間だけ弾き返せる
    var canCounter0 = mainScreen.canCounter;
    mainScreen.canCounter = function(_e){
        if(_e.type == "gunship") return !_e.dead && _e.mode == "pass" && !_e.phased;
        return canCounter0.apply(this, arguments);
    };
    //登場：上から降りてくる代わりに、横から飛んでくる(gunship.entrance)
    var arrive0 = mainScreen.bossArrive;
    mainScreen.bossArrive = function(){
        if(bossTypeFor(game.wave) != "gunship") return arrive0.apply(this, arguments);
        sound.music(null);
        sound.music("boss");
        sound.play("bossAppear");
        this.bossFreeze = true;
        this.introT = 0;
    };
    var entrance0 = mainScreen.bossEntrance;
    mainScreen.bossEntrance = function(_visual){
        var b = gunship.alive();
        if(b && !_visual){ gunship.entrance(b); return; }
        return entrance0.apply(this, arguments);
    };
    //「ゴゴゴ」の文字は出さない(降りてこないので)
    var gogo0 = mainScreen.drawGogogo;
    mainScreen.drawGogogo = function(){
        if(gunship.alive()) return;
        return gogo0.apply(this, arguments);
    };
    //奥から突っ込んでくるのを、着く直前の衝撃波で弾き返す
    //倒されたら、奥の街へ落ちていく
    var kill0 = special.onKill;
    special.onKill = function(_e){
        var r = kill0.apply(this, arguments);
        if(_e.type == "gunship") gunship.crash(_e);
        return r;
    };
    var effects0 = mainScreen.updateEffects;
    mainScreen.updateEffects = function(){
        gunship.wreckStep();
        return effects0.apply(this, arguments);
    };
    var blast0 = shotLab.onBlast;
    shotLab.onBlast = function(){
        gunship.onBlast();
        return blast0.apply(this, arguments);
    };
    //ロケット・爆弾(試作の弾として動かして描く)
    var step0 = shotLab.step;
    shotLab.step = function(b){
        var r = gunship.step(b);
        if(r !== null) return r;
        return step0.apply(this, arguments);
    };
    var shotDraw0 = shotLab.draw;
    shotLab.draw = function(b){
        if(gunship.drawShot(b)) return true;
        return shotDraw0.apply(this, arguments);
    };
})();
