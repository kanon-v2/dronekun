//------------------------------------------------------------------------------
//  協力プレイの「写し」(coop.js の続き)
//  ライバル(rival.js・rivalTime.js)とドローン君改の最終局面(finaleTriumph.js)は、ホストの画面で動かす状態が多く、
//  coop.packEnemy の小さな状態だけでは、ゲストの画面で同じに見えない。そこでホストは、これらの敵の中身(数と文字の値)と、
//  動きが書き換える演出の状態(背景の暗さ・柱・裂け目など)をそのまま送り、ゲストは自分の敵・状態に写して、同じ描き方で描く。
//  ・描くたびに進める見た目だけの値(ハチマキ・せりふを出したか・残像など)は写さない(MIRROR_SKIP)
//  ・当たり判定は、それぞれが自分のドローン君について行う。ホストの動きの中でしか判定していないもの(光の針・柱・奥からの砲撃・
//    改の突進・時戻しの巻き戻し)は、ゲストが写した状態から自分で判定する(guestHazards)
//  ・最終局面の曲は、ゲストもホストの曲の時刻に合わせて流す(ずれたら合わせ直す)。曲の時刻で決まる演出はホストの時刻で描く
//  ・ライバル戦の Suno の曲も、ホストの曲の時刻に合わせる(クロノは曲の拍で撃つので、聞こえる拍と攻撃がずれないように)
//  ・ゲストのジャスト衝撃波で改の突進を弾き返す・時の枷にかかる、はホストが判定して知らせる(出来事 7・8)
//------------------------------------------------------------------------------
const MIRROR_TYPES = ["chrono","chronoClone","kai"];   //中身を写す敵の種類
//写さない値：位置・速さ・体力の割合(packEnemy で届く)、見た目だけの値、大きすぎる記録(過去の自分の道すじなど)
const MIRROR_SKIP = { id:1, type:1, x:1, y:1, vx:1, vy:1, hp:1, flash:1, dead:1, look:1, wfx:1, scarf:1, scarfA:1, _pm:1, _pc:1,
                      arrT:1, said0:1, said1:1, said2:1, said3:1, saidA:1, trail:1, spd:1, awLast:1, fxMode:1, fxT:1,
                      trFlap:1, trNoise:1, trTwitch:1, trJx:1, trJr:1, trHeart:1, trBeat:1, hist:1, dh:1, _gm:1, _gb:1 };
const MIRROR_ARRAY_MAX = 160;   //これより長い配列は送らない(大きすぎる記録)
const MIRROR_DEPTH = 4;         //入れ子の深さの上限
//ホストの動きが書き換える、ほかの部分の状態 [もの, 名前の並び]
const MIRROR_MODULES = [
    ["rival",     ["timeK","borrowK"]],
    ["rivalTime", ["worldK","haste","skipFx","preview","rings","rifts"]],
    ["finaleTri", ["pillars","dawnK","dawnT0","dawnFlash","keepMusic","finished","cut","result"]],
    ["battleBg",  ["far","zoom","night","light"]],
    ["shotLab",   ["deeps"]]
];
//一瞬の演出の残り時間：ホストで新しく始まったら(増えたら)ゲストにも同じ値を入れる(ゲストは自分で減らす)
const MIRROR_KICKS = ["kaiDark","flashT","zoomT","beatT"];
//ゲストの画面でも弾の動き・絵に要る値(ふつうの弾は位置と速さだけ届く。coop.guestSync)
const SHOT_EXTRA = ["behind","held","rew","era","die","bk","popT","rewT","rvx","rvy","ang","cr","t0","t1","t2","t3","sx","sy","hx","hy","ax","ay","ph","max"];
const MIRROR_SONG_DRIFT = 0.25; //ゲストの最終局面の曲がホストの時刻からこれ(秒)よりずれたら合わせ直す
const MIRROR_SONG_RETRY = 600;  //曲を頼んでも、この時間(フレーム)たって別の曲のままなら、もう一度頼む
const MIRROR_SONG_GAP = 60;     //合わせ直したあと、次に合わせ直せるまで(フレーム。合わせ直した直後の時刻のゆれで続けて飛ばないように)

var coopMirror = {
    kick:{},        //ゲスト：最後に届いた一瞬の演出の値
    impactP:null,   //ゲスト：最後に写した改の突進の着いた瞬間(同じものを2度出さない)
    songT:null,     //ゲスト：ホストの最終局面の曲の時刻(届いたとき)
    songF:0,        //届いてからのフレーム数
    deepHit:{},     //ゲスト：奥からの砲撃を判定したもの
    pillarHit:{},
    pullPath:null,  //ゲスト：時戻しの間の自分の道すじ
    rivalT:null,        //ゲスト：ホストのライバル戦の曲の時刻(届いたとき)
    rivalCd:0,          //ゲスト：ライバル戦の曲を合わせ直してからの待ち
    songAsked:false,    //ゲスト：最終局面の曲を流し始めた
    songWait:0,         //流し始めてから、まだ別の曲のままのフレーム数
    syncCd:0,           //ゲスト：曲を合わせ直してからの待ち

    reset:function(){
        this.kick = {}; this.impactP = null; this.songT = null; this.songF = 0;
        this.deepHit = {}; this.pillarHit = {}; this.pullPath = null; this.songAsked = false; this.songWait = 0; this.syncCd = 0; this.rivalT = null; this.rivalCd = 0;
        if(coop.isGuest()) finaleTri.fakeT = null;
    },

    //------------------------------------------------------------ 値を送れる形にする
    //敵への参照は番号に({$e:番号})、数は小数2けたに丸める。送れないもの(絵・関数)は undefined
    enc:function(_v,_d){
        if(_v == null || typeof _v == "boolean" || typeof _v == "string") return _v;
        if(typeof _v == "number") return isFinite(_v) ? Math.round(_v*100)/100 : 0;
        if(typeof _v != "object" || _d > MIRROR_DEPTH) return undefined;
        if(Array.isArray(_v)){
            if(_v.length > MIRROR_ARRAY_MAX) return undefined;
            var a = [];
            for(var i=0; i<_v.length; i++){ var x = this.enc(_v[i], _d + 1); a.push(x === undefined ? null : x); }
            return a;
        }
        if(_v instanceof DroneLook || (typeof HTMLCanvasElement != "undefined" && _v instanceof HTMLCanvasElement)) return undefined;
        if(_v.id != null && _v.type != null && _v.r != null && _v.x != null) return { $e:_v.id };   //ほかの敵
        if(Object.getPrototypeOf(_v) != Object.prototype) return undefined;
        var o = {};
        for(var k in _v){
            var x = this.enc(_v[k], _d + 1);
            if(x !== undefined) o[k] = x;
        }
        return o;
    },
    dec:function(_v,_map){
        if(_v == null || typeof _v != "object") return _v;
        if(Array.isArray(_v)){ for(var i=0; i<_v.length; i++) _v[i] = this.dec(_v[i], _map); return _v; }
        if(_v.$e != null) return _map[_v.$e] || null;
        for(var k in _v) _v[k] = this.dec(_v[k], _map);
        return _v;
    },

    //------------------------------------------------------------ ホスト：送る
    build:function(){
        var m = { e:[] };
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.dead || MIRROR_TYPES.indexOf(e.type) < 0) continue;
            var o = {};
            for(var k in e){
                if(MIRROR_SKIP[k] || typeof e[k] == "function") continue;
                var x = this.enc(e[k], 1);
                if(x !== undefined) o[k] = x;
            }
            if(e.look) o._lk = [Math.round(e.look.yaw*10)/10, Math.round((e.look.elev || 0)*100)/100];
            m.e.push(e.id, o);
        }
        //ほかの部分の状態(ライバル・改の戦いの間だけ)
        if(m.e.length || battleBg.far || battleBg.night || shotLab.deeps.length){
            m.m = {};
            for(var i=0; i<MIRROR_MODULES.length; i++){
                var obj = window[MIRROR_MODULES[i][0]], keys = MIRROR_MODULES[i][1], o = {};
                for(var j=0; j<keys.length; j++){ var x = this.enc(obj[keys[j]], 1); o[keys[j]] = x === undefined ? null : x; }
                m.m[MIRROR_MODULES[i][0]] = o;
            }
            if(finaleTri.impact) m.im = this.enc(finaleTri.impact, 1);
            var T = finaleTri.boss();
            if(T && T.trSong && finaleTri.on()) m.mt = Math.round(finaleTri.pos()*1000)/1000;
        }
        //ライバル戦の Suno の曲の時刻(ふたりとも Suno の曲のときだけゲストが合わせる)
        if(rival.alive() && sound.trackName == RIVAL_SONG && typeof sunoRival != "undefined"){
            var rp = sunoRival.pos();
            if(rp >= 0) m.rt = Math.round(rp*1000)/1000;
        }
        var M = mainScreen, k = [];
        for(var i=0; i<MIRROR_KICKS.length; i++) k.push(Math.round(M[MIRROR_KICKS[i]] || 0));
        k.push(Math.round(M.zoomX || 0), Math.round(M.zoomY || 0));
        m.k = k;
        return m;
    },
    //弾の中身(SHOT_EXTRA のうち持っているもの)。なければ null
    shotExtra:function(_b){
        var o = null;
        for(var i=0; i<SHOT_EXTRA.length; i++){
            var v = _b[SHOT_EXTRA[i]];
            if(v === undefined || v === null) continue;
            if(!o) o = {};
            o[SHOT_EXTRA[i]] = typeof v == "number" ? Math.round(v*100)/100 : v;
        }
        return o;
    },

    //------------------------------------------------------------ ゲスト：写す(coop.guestSync で敵を作り直したあと)
    apply:function(_m){
        if(!_m) return;
        var map = {};
        for(var i=0; i<enemies.length; i++) map[enemies[i].id] = enemies[i];
        var E = _m.e || [];
        for(var i=0; i<E.length; i+=2){
            var e = map[E[i]], o = E[i+1];
            if(!e) continue;
            //前の動き(mode は coop.guestSync が先に新しいものへ書き換えるので、写したときの値を自分で覚えておく：_gm)
            var ov0 = e.ov, m0 = ov0 && ov0.m, h0 = ov0 && ov0.h, mode0 = e._gm;
            this.dec(o, map);
            for(var k in o){ if(k != "_lk") e[k] = o[k]; }
            if(o._lk && e.look && e.type == "kai" && e.trSong){ e.look.yaw = o._lk[0]; e.look.elev = o._lk[1]; }
            if(e.type == "kai" && e.trSong && !e._gb){
                //最終局面に入った：ホストの rebuild と同じく、記録・柱などを空にして始める(ゲストは rebuild を通らない)
                e._gb = true;
                finaleTri.reset();
                finaleTri.names();
            }
            //時ノ奔流の光の針：前に届いた角度から今の角度までになぎ払った所にいれば被弾(rival.beamHit)
            var O = e.ov;
            if(O && O.ph == "judge" && O.armed && m0 != null && ov0 && ov0.ph == "judge" && mainScreen.state == "play" && !mainScreen.down){
                rival.beamHit(e, m0, O.m);
                if(e.lv >= RIVAL_OD_HOUR_FROM && h0 != null) rival.beamHit(e, h0, O.h);
            }
            if(e.type == "chrono") this.rewindWatch(e, mode0);
            e._gm = e.mode;
        }
        //ほかの部分の状態
        if(_m.m){
            for(var name in _m.m){
                var obj = window[name], o = _m.m[name];
                for(var k in o){
                    var v = this.dec(o[k], map);
                    //裂け目の開き具合・撃った光は、ゲストが描くたびに進める(rivalTime.riftAnim)ので、前のものを引き継ぐ
                    if(name == "rivalTime" && k == "rifts" && v){
                        var old = obj.rifts || [];
                        for(var j=0; j<v.length; j++){
                            var q = old.filter(function(r){ return r.slot == v[j].slot && r.kind == v[j].kind && r.big == v[j].big; })[0];
                            v[j].open = q ? q.open : 0; v[j].fire = q ? q.fire : 0;
                        }
                    }
                    obj[k] = v == null && (k == "rings" || k == "rifts" || k == "pillars" || k == "deeps") ? [] : v;
                }
            }
        }else{
            battleBg.far = 0; battleBg.night = 0; battleBg.light = null; battleBg.zoom = 0;
            shotLab.deeps = []; rivalTime.rings = []; finaleTri.pillars = [];
        }
        //改の突進が着いた瞬間(ホストで弾き返せなかったときは、着く所にいれば被弾)
        if(_m.im && _m.im.p0 != this.impactP){
            this.impactP = _m.im.p0;
            finaleTri.impact = _m.im;
            var b = finaleTri.boss();
            var r = finaleTri.result;
            //(体力の区切りのムービーも同じ印を立てるので、ムービーの間と、突進の着いた所でない印は除く)
            var ram = b && b.trTx != null && !finaleTri.cut && Math.hypot(_m.im.x - b.trTx, _m.im.y - b.trTy) < 2;
            if(ram && (r == "hit" || r == "dodge") && mainScreen.state == "play"){
                if(Math.hypot(drone.X - b.trTx, drone.Y - b.trTy) < TR_RAM_R + HIT_CORE && mainScreen.canBeHit()) mainScreen.damage();
            }
        }
        //最終局面・ライバル戦の曲の時刻
        this.songT = _m.mt != null ? _m.mt : null;
        this.rivalT = _m.rt != null ? _m.rt : null;
        this.songF = 0;
        //一瞬の演出
        var M = mainScreen, k = _m.k || [];
        for(var i=0; i<MIRROR_KICKS.length; i++){
            var n = MIRROR_KICKS[i], v = k[i] || 0;
            if(v > (this.kick[n] || 0)) M[n] = Math.max(M[n] || 0, v);
            this.kick[n] = v;
        }
        if(k[MIRROR_KICKS.length] != null && (M.zoomT || 0) > 0){ M.zoomX = k[MIRROR_KICKS.length]; M.zoomY = k[MIRROR_KICKS.length + 1]; }
    },
    //弾の中身を写す(coop.guestSync から)
    applyShot:function(_b,_o){
        for(var k in _o) _b[k] = _o[k];
    },

    //------------------------------------------------------------ ゲスト：毎フレーム(coop.guestStep から)
    //最終局面の曲の時刻をホストに合わせる・時の枷の遅さ・自分で判定する当たり
    guestFrame:function(){
        var T = finaleTri, b = T.boss();
        this.songF++;
        this.followRival();
        if(this.songT != null && b && b.trSong){
            T.fakeT = this.songT + this.songF/60;
            this.followSong(T.fakeT);
        }else if(T.fakeT != null){
            T.fakeT = null;
        }
        //時の枷(ホストが判定して知らせる。出来事 8)・時ノ奔流の加速で、自分の時が遅くなる
        var R = rivalTime, e = rival.alive(), k = 1;
        if(R.shackleF > 0){ R.shackleF--; k = CT_SHACKLE_K; }
        if(e && e.mode == "over" && e.ov && e.ov.ph == "accel") k = Math.min(k, 1 - (1 - CT_OD_DRONE_K)*(e.ov.u || 0));
        R.droneK = k;
        //改の突進を迎え撃てるよう、衝撃波1回分のやる気は残す(ホストと同じ。finaleTri.aimStart)
        if(b && b.trApproach) mainScreen.yaruki = Math.max(mainScreen.yaruki, YARUKI_COST);
        //過去の裂け目が狙う所を描くため、自分の通った道も書いておく
        R.trail.push({ x:drone.X, y:drone.Y });
        if(R.trail.length > 240) R.trail.shift();
        if(this.pullPath && this.pullPath.length < 900) this.pullPath.push({ x:drone.X, y:drone.Y });
    },
    //最終局面の曲：ゲストもホストの時刻から流し、ずれたら合わせ直す。ホストがとどめを決めたら、最後の和音へ
    //(Suno の曲は "kai2" が "triumph" に置き換わって鳴る。今の曲の名前は bgmTrial.trackFor で比べる。
    // 流し直すのは1度だけ：毎フレーム流し直すと、録音の曲を開き直し続けて画面が止まる)
    followSong:function(_t){
        if(typeof triumph == "undefined" || !sound.ctx) return;
        if(this.syncCd > 0) this.syncCd--;
        if(sound.trackName != bgmTrial.trackFor("kai2")){
            if(finaleTri.keepMusic) return;
            if(this.songAsked && ++this.songWait < MIRROR_SONG_RETRY) return;    //頼んだ曲を読み込んでいる間は待つ
            this.songAsked = true;
            this.songWait = 0;
            triumph.startAt = Math.max(0, _t);
            sound.music(null);
            sound.music("kai2");
            return;
        }
        var p = triumph.pos();
        if(p < 0) return;     //読み込み中
        if(finaleTri.finished){ if(!triumph.ended) triumph.finish(); return; }
        if(Math.abs(p - _t) > MIRROR_SONG_DRIFT && this.syncCd <= 0){
            this.syncCd = MIRROR_SONG_GAP;
            triumph.jump(_t, TR_CUT_FADE);
        }
    },
    //ライバル戦の曲：ホストの曲の時刻からずれたら合わせ直す(曲を流し始める・第二形態で流し直すのは、ゲストも rival.music・awakenFx で同じようにする)
    followRival:function(){
        if(this.rivalCd > 0) this.rivalCd--;
        if(this.rivalT == null || typeof sunoRival == "undefined" || !sound.ctx || sound.trackName != RIVAL_SONG || !rival.alive()) return;
        var p = sunoRival.pos(), t = this.rivalT + this.songF/60;
        if(p < 0 || this.rivalCd > 0 || Math.abs(p - t) <= MIRROR_SONG_DRIFT) return;
        //(くり返しの切れ目をまたいだだけのずれは合わせない)
        var I = sunoRival.info ? sunoRival.info() : null;
        if(I && I.loopEnd && Math.abs(Math.abs(p - t) - (I.loopEnd - I.loopStart)) <= MIRROR_SONG_DRIFT) return;
        this.rivalCd = MIRROR_SONG_GAP;
        sunoRival.jump(t, 0.1);
    },
    //ゲストが自分で判定する当たり(coop.guestCollide から)
    guestHazards:function(){
        var M = mainScreen;
        if(M.down || M.state != "play") return;
        //奥からの砲撃(shotLab.deeps)：着く瞬間に着く所の輪の中にいれば被弾。ゲストは届いた残りから自分で数える
        var D = shotLab.deeps;
        for(var i=0; i<D.length; i++){
            var d = D[i], key = Math.round(d.tx) + "_" + Math.round(d.ty);
            d.t++;
            if(d.t < DEEP_TIME || this.deepHit[key]) continue;
            this.deepHit[key] = true;
            if(Math.hypot(drone.X - d.tx, drone.Y - d.ty) < DEEP_R + HIT_CORE && M.canBeHit()) M.damage();
        }
        //最終局面の光の柱(finaleTri.pillarStep と同じ)
        var T = finaleTri;
        if(T.pillars.length && T.boss()){
            var p = T.pos();
            for(var i=0; i<T.pillars.length; i++){
                var P = T.pillars[i];
                if(p < P.hit || p >= P.hit + TR_PILLAR_HIT) continue;
                var d = P.dir == "v" ? Math.abs(drone.X - P.c) : Math.abs(drone.Y - P.c);
                if(d < TR_PILLAR_W/2 + HIT_CORE*0.5 && M.canBeHit()) M.damage();
            }
        }
    },
    //時戻し(rival.js)：ゲストも自分の通った道を書き、ホストが時を戻した瞬間に、自分もその道を巻き戻される
    rewindWatch:function(_e,_mode0){
        if(_e.mode == "rewind" && _mode0 != "rewind" && _mode0 != "rstop") this.pullPath = [{ x:drone.X, y:drone.Y }];
        if(_mode0 == "rstop" && _e.mode != "rstop"){
            var path = this.pullPath;
            this.pullPath = null;
            if(path && path.length > 2 && !mainScreen.down){
                rival.pull = { path:path.reverse(), t:0, T:RIVAL2_REWIND_PULL };
                mainScreen.guard = Math.max(mainScreen.guard, RIVAL2_REWIND_PULL + RIVAL2_REWIND_PULL_GUARD);
                popup(drone.X, drone.Y - 34, "巻き戻される！", "rgb(150,80,220)");
            }
        }
    },
    //ゲストの画面で、ホストの世界が止まっているか(ライバルの登場・目覚めの演出の間)。止まっている間は動けず、当たらない
    worldHeld:function(){
        for(var i=0; i<enemies.length; i++){
            var e = enemies[i];
            if(e.type == "chrono" && (e.mode == "intro" || e.mode == "awaken")) return true;
        }
        return false;
    },

    //------------------------------------------------------------ ホスト：ゲストの操作への反応
    //ゲストのジャスト衝撃波で、改の突進を弾き返す(出来事 7。ゲストの位置で判定する)
    partnerBlast:function(_x,_y){
        finaleTri.onBlast(_x, _y);
    }
};
