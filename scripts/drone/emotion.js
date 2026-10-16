//------------------------------------------------------------------------------
//  感情を形にした攻撃の試作(怒り・悲しみ・恐怖・喜び)。デバッグのメニューの「攻撃の試作」で見られる
//  怒り：煮えたぎる核が鼓動を早めながら熱い破片を吐き散らし(狙いは荒い)、たまりきると爆発する。
//        地割れのような稲妻が走り、破片が全方向へ飛ぶ。破片は冷えると遅くなり、灰になって舞い落ちる。
//        色：画面が赤く熱を帯び、ふちが鼓動に合わせて脈打つ。爆発の瞬間は赤く焼ける。
//        音：鼓動(だんだん速く。そのたびに曲が押しつぶされる)・不協和なうなり(熱で開いていく)・爆発の咆哮・稲妻の裂ける音。
//  悲しみ：青白い大きな雫が、ドローン君の上へゆっくりついてきて涙をこぼす(涙の1粒ごとに短調の旋律の1音)。
//        涙は下にたまって淵になり、だんだん水かさが増す。淵の中では体が重く(付いていくのが遅い)、沈んでいく。
//        涙が水面に落ちると、しずくがはね上がる。ときどきしゃくり上げて、涙を上へ放る。
//        色：画面の色が抜けて青く沈む。音：曲がこもって遠くなり、低い和音が息をするように鳴る。水滴の音。
//  恐怖：画面が暗くなり、ドローン君のまわりの明かりだけが見える(だんだん狭まり、ときどきちらつく)。
//        暗がりに赤い目が開き(ドローン君の後ろ側に出やすい)、にらんでから暗い弾を撃つ。弾は忍び寄ってだんだん速くなる。
//        途中で目がいっせいに開いて囲む(驚かし)。音：曲がほとんど消え、うねる低音と高い弦の震え・ささやき・きしみ・叫び。
//  喜び：太陽が拍に合わせて跳ね、花びらの輪を撒く。花びらは拍の頭にぴょんと進んでうずを巻く(踊るように)。
//        はずむ玉は床で弾むたびに音階の音が鳴る。色：鮮やかになり、光の筋と紙吹雪。音：太鼓・手拍子・明るい和音。
//  shotLab の list・labStep・update・clear・steer・step・draw・drawFront・drawLab を包んで足す。
//  協力プレイには対応していない(ゲストの画面では弾がふつうに飛ぶだけ)。
//------------------------------------------------------------------------------
//怒り
const ANGER_SIMMER     = 160;      //煮えたぎる長さ(フレーム)。このあと爆発する
const ANGER_COOL       = 220;      //爆発のあと、冷めていく長さ(フレーム)
const ANGER_BEAT_SLOW  = 48;       //鼓動の間隔：落ち着いているとき(フレーム)
const ANGER_BEAT_FAST  = 15;       //鼓動の間隔：爆発の直前(フレーム)
const ANGER_SPIT_SLOW  = 26;       //破片を吐く間隔：はじめ(フレーム)
const ANGER_SPIT_FAST  = 7;        //破片を吐く間隔：爆発の直前(フレーム)
const ANGER_SPIT_AIM   = 0.35;     //狙いのぶれ(ラジアン。怒るほど +0.45 まで荒くなる)
const ANGER_SPIT_SPEED = 2.4;      //吐く破片の速さ(怒るほど +1.6。danmaku() を掛ける)
const ANGER_RING_N     = 28;       //爆発で飛び散る破片の数
const ANGER_RING_SPEED = 5;        //爆発の破片の速さ(danmaku() を掛ける)
const ANGER_COOL_RATE  = 0.011;    //破片が冷める速さ(熱 1 → 0。1フレームあたり)
const ANGER_DRAG       = 0.975;    //冷えていく破片の減速(1フレームごとに速さに掛ける。熱いうちは掛けない)
const ANGER_ASH_FALL   = 0.025;    //灰の落ちる加速(px/フレーム²)
const ANGER_ASH_MAX    = 1.4;      //灰の落ちる速さの上限
const ANGER_CRACKS     = 3;        //爆発で走る稲妻の本数(ドローン君へ1本、左右にずらして残り)
const ANGER_CRACK_SPREAD = 0.55;   //稲妻の向きのずれ(ラジアン)
const ANGER_CRACK_WARN = 45;       //稲妻の予告(細い線)の長さ(フレーム)
const ANGER_CRACK_HIT  = 14;       //稲妻が当たる長さ(フレーム)
const ANGER_CRACK_W    = 13;       //稲妻の当たる幅(線からの距離 px)
const ANGER_CRACK_SCAR = 40;       //焦げ跡が消えるまで(フレーム)
const ANGER_TINT       = 0.55;     //画面を赤く焼く強さ(いちばん怒ったとき)
//悲しみ
const SORROW_LEN       = 380;      //全体の長さ(フレーム)。最後に淵が引いて色が戻る
const SORROW_WEEP      = [20, 310];    //涙をこぼす間(フレーム)
const SORROW_TEAR_SLOW = 42;       //涙の間隔：はじめ(フレーム)
const SORROW_TEAR_FAST = 16;       //涙の間隔：いちばん泣いているとき(フレーム)
const SORROW_SKY_EVERY = 34;       //空から降る涙の間隔(フレーム。ドローン君の近くの列に)
const SORROW_FOLLOW    = 0.012;    //雫がドローン君の上へついてくる速さ(距離に掛ける)
const SORROW_GRAVITY   = 0.035;    //涙の落ちる加速(px/フレーム²)
const SORROW_TEAR_MAX  = 2.6;      //涙の落ちる速さの上限(danmaku() を掛ける)
const SORROW_SOBS      = [150, 195, 240];  //しゃくり上げる時刻(フレーム)
const SORROW_SOB_N     = 7;        //しゃくり上げで放る涙の数
const SORROW_POOL      = 150;      //淵のいちばん深いとき(画面の下からの高さ px)
const SORROW_POOL_FULL = 240;      //淵が満ちるまで(フレーム)
const SORROW_DRAIN_AT  = 300;      //淵が引き始める時刻(フレーム)
const SORROW_HEAVY     = 3;        //淵の中で、付いていく遅れを何倍にするか
const SORROW_SINK      = 45;       //淵の中で、目標を下へずらす(px。ゆっくり沈む)
const SORROW_SPLASH_N  = 2;        //涙が水面に落ちてはね上がるしずくの数
const SORROW_GREY      = 0.8;      //色の抜け方(いちばん悲しいとき)
const SORROW_BGM_CUT   = 600;      //曲をこもらせる周波数(Hz)
const SORROW_MELODY    = [76,74,72,71, 72,69,71,68, 69,72,71,74, 72,71,69,64];  //涙1粒ごとに鳴らす音(MIDIの番号。イ短調)

SHOT_KINDS.rage   = { r:4.5 };     //怒りの破片(熱で白→赤→黒い灰)
SHOT_KINDS.tear   = { r:5 };       //涙(青白いしずく)
//恐怖
const FEAR_LEN         = 380;      //全体の長さ(フレーム)。最後に明かりが戻る
const FEAR_DARK_IN     = 70;       //暗くなるまで(フレーム)
const FEAR_LIGHT_START = 150;      //暗くなりきったときの明かりの半径(px)
const FEAR_LIGHT_END   = 105;      //明かりはだんだん狭まって、この半径まで(px)
const FEAR_DARK        = 0.94;     //明かりの外の暗さ(0～1)
const FEAR_FLICKER     = 0.008;    //明かりがちらつく出やすさ(1フレームあたり)
const FEAR_EYE_EVERY   = 36;       //暗がりに目が開く間隔(フレーム)
const FEAR_EYE_DIST    = [210, 320];   //目の開く所のドローン君からの距離(px)
const FEAR_EYE_BEHIND  = 1.1;      //目はドローン君の後ろ(動いてきた向きの逆)±この角度に開く(ラジアン)
const FEAR_EYE_OPEN    = 22;       //目が開くまで(フレーム)
const FEAR_EYE_STARE   = 38;       //にらんでから撃つまで(フレーム)
const FEAR_EYE_CLOSE   = 16;       //撃ってから閉じるまで(フレーム)
const FEAR_SCARE_AT    = 215;      //驚かし(目がいっせいに囲む)の時刻(フレーム)
const FEAR_SCARE_N     = 8;        //驚かしの目の数
const FEAR_SCARE_R     = 230;      //驚かしの目の輪の半径(px)
const FEAR_SCARE_GAP   = 7;        //驚かしの目が順に撃つ間隔(フレーム)
const FEAR_SHOT_START  = 0.5;      //暗い弾のはじめの速さ(danmaku() を掛ける)
const FEAR_SHOT_ACCEL  = 1.045;    //暗い弾が1フレームごとに速くなる割合
const FEAR_SHOT_MAX    = 3.4;      //暗い弾の速さの上限(danmaku() を掛ける)
const FEAR_BGM_CUT     = 220;      //曲をこもらせる周波数(Hz。ほとんど聞こえない)
//喜び
const JOY_LEN          = 380;      //全体の長さ(フレーム)
const JOY_BEAT         = 24;       //拍の長さ(フレーム。150BPM)
const JOY_PETAL_N      = 12;       //花びらの輪の数
const JOY_PETAL_SPEED  = 2.4;      //花びらの速さ(拍の頭にぴょんと進み、拍の間はゆっくり。danmaku() を掛ける)
const JOY_PETAL_CURL   = 0.014;    //花びらの曲がり(ラジアン/フレーム。輪がうずを巻く)
const JOY_BALL_SPEED   = 4.2;      //はずむ玉を放る速さ
const JOY_GRAVITY      = 0.13;     //はずむ玉の落ちる加速(px/フレーム²)
const JOY_BOUNCE       = 0.86;     //はずむ玉が床ではね返る強さ
const JOY_BOUNCES      = 3;        //はずむ玉が床ではずむ回数(使い切ると下へ抜ける)
const JOY_FINALE       = [250, 310];   //最後の花のうず(フレーム)
const JOY_SAT          = 0.45;     //色を鮮やかにする強さ
const JOY_CHORDS       = [[60,64,67], [59,62,67], [57,60,64], [57,60,65]];   //拍ごとの和音(ハ長調 I-V-vi-IV。4拍ずつ)
const JOY_SCALE        = [72,74,76,79,81,84,86,88];   //はずむ玉の音(ハ長調の5音の音階)

SHOT_KINDS.splash = { r:3 };       //水面ではね上がるしずく
SHOT_KINDS.dread  = { r:5 };       //恐怖の暗い弾(明かりの外ではほとんど見えない)
SHOT_KINDS.petal  = { r:4 };       //喜びの花びら
SHOT_KINDS.bouncy = { r:6 };       //喜びのはずむ玉

//------------------------------------------------------------------ 効果音(Web Audio。sound.seGain へつなぐ)
var emoSfx = {
    ctx:null, out:null, wet:null, shaper:null,
    growl:null,     //怒りのうなり(鳴り続ける)
    pad:null,       //悲しみの低い和音(鳴り続ける)
    rig:function(){
        var c = sound.ctx;
        if(this.ctx == c) return c;
        this.ctx = c;
        this.growl = null; this.pad = null;
        this.out = c.createGain();
        this.out.gain.value = 0.9;
        this.out.connect(sound.seGain);
        //残響(左右で別の減衰するノイズ)
        var rv = c.createConvolver(), n = Math.floor(c.sampleRate*2.6), b = c.createBuffer(2, n, c.sampleRate);
        for(var ch=0; ch<2; ch++){
            var d = b.getChannelData(ch);
            for(var i=0; i<n; i++) d[i] = (Math.random()*2 - 1)*Math.pow(1 - i/n, 2.5);
        }
        rv.buffer = b;
        this.wet = c.createGain();
        this.wet.gain.value = 0.5;
        this.wet.connect(rv); rv.connect(this.out);
        return c;
    },
    ok:function(){ return sound.seOn && sound.ready(); },
    //ひずませる形(怒りの音を荒くする)
    curve:function(_k){
        var n = 1024, a = new Float32Array(n);
        for(var i=0; i<n; i++){ var x = i*2/n - 1; a[i] = (1 + _k)*x/(1 + _k*Math.abs(x)); }
        return a;
    },
    env:function(_t,_v,_a,_decay){
        var g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, _t);
        g.gain.exponentialRampToValueAtTime(_v, _t + _a);
        g.gain.exponentialRampToValueAtTime(0.0001, _t + _a + _decay);
        return g;
    },
    osc:function(_type,_f0,_f1,_t,_dur,_vol,_wet,_dist){
        var c = this.ctx, o = c.createOscillator(), g = this.env(_t, _vol, 0.006, _dur);
        o.type = _type;
        o.frequency.setValueAtTime(_f0, _t);
        if(_f1 != _f0) o.frequency.exponentialRampToValueAtTime(_f1, _t + _dur);
        var last = o;
        if(_dist){
            var ws = c.createWaveShaper();
            ws.curve = this.curve(_dist);
            o.connect(ws); last = ws;
        }
        last.connect(g); g.connect(this.out);
        if(_wet) g.connect(this.wet);
        o.start(_t); o.stop(_t + _dur + 0.1);
    },
    noise:function(_type,_f0,_f1,_t,_dur,_vol,_wet){
        var c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = this.env(_t, _vol, 0.004, _dur);
        s.buffer = sound.noiseBuf;
        f.type = _type;
        f.frequency.setValueAtTime(_f0, _t);
        if(_f1 != _f0) f.frequency.exponentialRampToValueAtTime(_f1, _t + _dur);
        s.connect(f); f.connect(g); g.connect(this.out);
        if(_wet) g.connect(this.wet);
        s.start(_t, Math.random()*0.5); s.stop(_t + _dur + 0.1);
    },
    //鼓動(どくん・どくん)。_k：怒りの強さ(強いほど重く、ひずむ)
    heart:function(_k){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        this.osc("sine", 75, 38, t, 0.16, 0.5 + 0.3*_k, false, _k > 0.5 ? 2 : 0);
        this.osc("sine", 68, 34, t + 0.15, 0.2, 0.35 + 0.25*_k, false, 0);
        //鼓動のたびに曲を押しつぶす(胸の音で曲が聞こえなくなる)
        if(sound.bgmOn && !sound.ducked){
            var G = sound.bgmGain.gain;
            G.cancelScheduledValues(t);
            G.setTargetAtTime(BGM_VOLUME*(1 - 0.75*_k), t, 0.01);
            G.setTargetAtTime(BGM_VOLUME, t + 0.14, 0.09);
        }
    },
    //うなり(2つののこぎり波を半音ずらして重ね、ひずませる。熱でこもりが開き、大きくなる)。_k 0 で止まっていく
    growlSet:function(_k){
        if(!this.ok()){ return; }
        var c = this.rig(), t = c.currentTime;
        if(!this.growl){
            if(_k <= 0.01) return;
            var o1 = c.createOscillator(), o2 = c.createOscillator(), ws = c.createWaveShaper(), lp = c.createBiquadFilter(), g = c.createGain();
            o1.type = "sawtooth"; o2.type = "sawtooth";
            o1.frequency.value = 55; o2.frequency.value = 55*Math.pow(2, 1/12);   //半音のにごり
            ws.curve = this.curve(6);
            lp.type = "lowpass"; lp.frequency.value = 150;
            g.gain.value = 0.0001;
            o1.connect(ws); o2.connect(ws); ws.connect(lp); lp.connect(g); g.connect(this.out);
            o1.start(); o2.start();
            this.growl = { o1:o1, o2:o2, lp:lp, g:g };
        }
        var G = this.growl;
        G.g.gain.setTargetAtTime(0.13*_k, t, 0.1);
        G.lp.frequency.setTargetAtTime(150 + 1500*_k*_k, t, 0.1);
        G.o1.frequency.setTargetAtTime(55*(1 + 0.15*_k), t, 0.2);
        G.o2.frequency.setTargetAtTime(55*Math.pow(2, 1/12)*(1 + 0.18*_k), t, 0.2);
    },
    //爆発の咆哮
    roar:function(){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        this.noise("lowpass", 4000, 90, t, 1.4, 0.6, true);
        this.osc("sawtooth", 170, 32, t, 1.0, 0.35, true, 8);
        this.osc("sawtooth", 180, 34, t + 0.02, 0.9, 0.25, false, 8);
        this.osc("sine", 60, 28, t, 0.8, 0.6, false, 0);
    },
    //稲妻が裂ける
    crack:function(){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        this.noise("highpass", 6000, 1200, t, 0.18, 0.35, true);
        this.osc("square", 900, 90, t, 0.25, 0.12, false, 4);
    },
    //破片を吐く(短くはじける音。高さはばらばら)
    spit:function(_k){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        this.noise("bandpass", 1800 + Math.random()*1500, 600, t, 0.06, 0.12 + 0.1*_k, false);
    },
    //悲しみの低い和音(息をするようにふくらむ)。_k 0 で止まっていく
    padSet:function(_k,_breath){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        if(!this.pad){
            if(_k <= 0.01) return;
            var lp = c.createBiquadFilter(), g = c.createGain(), os = [];
            lp.type = "lowpass"; lp.frequency.value = 700;
            g.gain.value = 0.0001;
            [[110,"sine"], [164.8,"sine"], [220.6,"triangle"], [261.6,"sine"]].forEach(function(p){    //イ短調の和音(A・E・A・C)
                var o = c.createOscillator();
                o.type = p[1]; o.frequency.value = p[0];
                o.connect(lp); o.start(); os.push(o);
            });
            lp.connect(g); g.connect(this.out); g.connect(this.wet);
            this.pad = { os:os, g:g };
        }
        this.pad.g.gain.setTargetAtTime(0.07*_k*(0.6 + 0.4*_breath), t, 0.3);
    },
    //鳴り続ける音を止める
    stopLoops:function(){
        if(!this.ctx) return;
        var t = this.ctx.currentTime;
        if(this.growl){
            var G = this.growl;
            G.g.gain.setTargetAtTime(0.0001, t, 0.15);
            G.o1.stop(t + 1); G.o2.stop(t + 1);
            this.growl = null;
        }
        if(this.pad){
            var P = this.pad;
            P.g.gain.setTargetAtTime(0.0001, t, 0.4);
            P.os.forEach(function(o){ o.stop(t + 2.5); });
            this.pad = null;
        }
        if(this.dread){
            var D = this.dread;
            D.g.gain.setTargetAtTime(0.0001, t, 0.3);
            D.os.forEach(function(o){ o.stop(t + 2); });
            this.dread = null;
        }
    },
    //恐怖の音(鳴り続ける)：うなる低い2音(少しずらしてうねる)と、高い弦の細かい震え(半音でぶつかる)
    dread:null,
    dreadSet:function(_k){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        if(!this.dread){
            if(_k <= 0.01) return;
            var g = c.createGain(), os = [];
            g.gain.value = 0.0001;
            g.connect(this.out); g.connect(this.wet);
            [46, 49.3].forEach(function(f){
                var o = c.createOscillator(), og = c.createGain();
                o.type = "sine"; o.frequency.value = f; og.gain.value = 0.9;
                o.connect(og); og.connect(g); o.start(); os.push(o);
            });
            var bp = c.createBiquadFilter(), trem = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
            bp.type = "bandpass"; bp.frequency.value = 2000; bp.Q.value = 2;
            trem.gain.value = 0.05;
            lfo.frequency.value = 9; depth.gain.value = 0.05;
            lfo.connect(depth); depth.connect(trem.gain); lfo.start(); os.push(lfo);
            [1661, 1760].forEach(function(f){
                var o = c.createOscillator();
                o.type = "sawtooth"; o.frequency.value = f;
                o.connect(bp); o.start(); os.push(o);
            });
            bp.connect(trem); trem.connect(g);
            this.dread = { g:g, os:os };
        }
        this.dread.g.gain.setTargetAtTime(0.16*_k, t, 0.4);
    },
    //暗がりで目が開く(きしむ音)
    creak:function(){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        this.osc("sawtooth", 85, 58, t, 0.45, 0.05, true, 2);
        this.noise("bandpass", 320, 260, t, 0.4, 0.06, true);
    },
    //ささやき(どこからか)
    whisper:function(){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        for(var i=0; i<3; i++) this.noise("bandpass", 2200 + Math.random()*2200, 1800 + Math.random()*1500, t + i*0.13, 0.12, 0.05, true);
    },
    //暗い弾が飛び出す(低く吸い込む音)
    whoosh:function(){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        this.noise("lowpass", 300, 1400, t, 0.3, 0.12, false);
    },
    //驚かし(高い音がぶつかり合って上がる叫び)
    shriek:function(){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        [1250, 1330, 1420].forEach(function(f){ emoSfx.osc("sawtooth", f, f*1.9, t, 0.75, 0.07, true, 3); });
        this.noise("highpass", 3000, 6000, t, 0.6, 0.15, true);
        this.osc("sine", 55, 30, t, 0.6, 0.5, false, 0);
    },
    //喜びの拍：足もとの太鼓、2拍目と4拍目に手拍子、和音
    joyBeat:function(_i){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        this.osc("sine", 130, 50, t, 0.12, 0.3, false, 0);
        if(_i % 2) for(var j=0; j<2; j++) this.noise("bandpass", 1500, 1200, t + j*0.012, 0.08, 0.18, true);
        var ch = JOY_CHORDS[Math.floor(_i/4) % JOY_CHORDS.length];
        for(var j=0; j<ch.length; j++){
            var f = sound.freq(ch[j] + 12);
            this.osc("triangle", f, f, t, 0.22, 0.045, true, 0);
        }
    },
    //はずむ玉の音(澄んだ鈴)
    bell:function(_midi){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime, f = sound.freq(_midi);
        this.osc("sine", f, f, t, 0.5, 0.1, true, 0);
        this.osc("sine", f*4, f*4, t, 0.1, 0.02, true, 0);
    },
    //花びらがひらく(きらきら上がる音)
    bloom:function(){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        for(var i=0; i<4; i++){ var f = sound.freq(JOY_SCALE[i*2 % JOY_SCALE.length] + 12); this.osc("sine", f, f, t + i*0.035, 0.18, 0.035, true, 0); }
    },
    //涙の1音(オルゴールのような澄んだ音。長い残響)
    note:function(_midi){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime, f = sound.freq(_midi);
        this.osc("sine", f, f, t, 1.6, 0.16, true, 0);
        this.osc("sine", f*2, f*2, t, 0.5, 0.05, true, 0);
        this.osc("triangle", f*3.01, f*3.01, t, 0.15, 0.02, true, 0);
    },
    //水面に落ちた涙(ぽちゃん)
    drip:function(){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime, f = 1100 + Math.random()*700;
        this.osc("sine", f, f*0.45, t, 0.09, 0.12, true, 0);
    },
    //しゃくり上げ(息を吸う音と、下がっていくため息)
    sob:function(){
        if(!this.ok()) return;
        var c = this.rig(), t = c.currentTime;
        this.noise("bandpass", 700, 1300, t, 0.3, 0.12, true);
        this.osc("triangle", 330, 196, t + 0.12, 0.9, 0.08, true, 0);
    }
};

//------------------------------------------------------------------ 攻撃
var emotion = {
    cur:null,       //いま出ている感情 { kind:"anger"|"sorrow"|"fear"|"joy", t, x, y, … }(1つだけ)
    cracks:[],      //怒りの稲妻 { pts:[{x,y}], t }
    ripples:[],     //悲しみの水面の波紋 { x, t }
    bubbles:[],     //淵に沈んだドローン君の泡 { x, y, t }
    noteI:0,        //涙の旋律・はずむ玉の音階の次の音
    eyes:[],        //恐怖の暗がりの目 { x, y, t, stare:撃つまで, fired }
    confetti:[],    //喜びの紙吹雪(見た目だけ){ x, y, vx, vy, t, hue, spin }
    notes:[],       //喜びの音符(見た目だけ){ x, y, t, hue }

    //怒り：(_x,_y) に煮えたぎる核を置く
    anger:function(_x,_y){
        this.clear();
        this.cur = { kind:"anger", t:0, x:_x, y:_y, x0:_x, beat:0, beatT:0, spit:0, rage:0, flash:0,
                     seed:Math.random()*100 };
        return this.cur;
    },
    //悲しみ：(_x,_y) に大きな雫を置く
    sorrow:function(_x,_y){
        this.clear();
        this.cur = { kind:"sorrow", t:0, x:_x, y:_y, well:0, tearT:0, sky:0, level:0, grey:0, sob:0, inPool:false };
        this.noteI = 0;
        return this.cur;
    },
    //恐怖：画面が暗くなり、暗がりに目が開いて撃ってくる
    fear:function(){
        this.clear();
        this.cur = { kind:"fear", t:0, light:900, dark:0, flick:0, eyeT:0, beatT:0, scare:0 };
        return this.cur;
    },
    //喜び：(_x,_y) に跳ねる太陽を置く
    joy:function(_x,_y){
        this.clear();
        this.cur = { kind:"joy", t:0, x:_x, y:_y, y0:_y, vx:1.6, hop:0, glow:0, beatN:0, squash:0 };
        this.noteI = 0;
        return this.cur;
    },
    clear:function(){
        var had = !!this.cur;
        this.cur = null;
        this.cracks = []; this.ripples = []; this.bubbles = [];
        this.eyes = []; this.confetti = []; this.notes = [];
        emoSfx.stopLoops();
        if(had){ sound.timeWarp(false); sound.applyVolume(); }     //こもらせた曲・押しつぶした曲を戻す
    },
    //怒りの強さ(0～1。爆発の瞬間は1を超える)
    rage:function(){ return this.cur && this.cur.kind == "anger" ? this.cur.rage : 0; },
    //核からドローン君へ向かう(ずらした)向きへ、ジグザグの稲妻の道を作る
    makeCrack:function(_x,_y,_ang){
        var pts = [{ x:_x, y:_y }], step = 38, len = 0, a = _ang;
        while(len < 1100){
            len += step;
            a += (Math.random() - 0.5)*0.5;
            a = _ang + Math.max(-0.35, Math.min(0.35, a - _ang));     //大きくはそれない
            var p = pts[pts.length - 1];
            pts.push({ x:p.x + Math.cos(a)*step, y:p.y + Math.sin(a)*step });
            if(p.x < -40 || p.x > CW + 40 || p.y < -40 || p.y > CH + 40) break;
        }
        this.cracks.push({ pts:pts, t:0 });
    },
    nearCrack:function(c,_x,_y){
        for(var i=1; i<c.pts.length; i++){
            var a = c.pts[i-1], b = c.pts[i], dx = b.x - a.x, dy = b.y - a.y;
            var k = Math.max(0, Math.min(1, ((_x - a.x)*dx + (_y - a.y)*dy)/(dx*dx + dy*dy)));
            if(Math.hypot(_x - a.x - dx*k, _y - a.y - dy*k) < ANGER_CRACK_W) return true;
        }
        return false;
    },

    //動かす(shotLab.update から)
    update:function(){
        if(coop.isGuest()) return;
        var E = this.cur;
        if(E && E.kind == "anger") this.angerStep(E);
        if(E && E.kind == "sorrow") this.sorrowStep(E);
        if(E && E.kind == "fear") this.fearStep(E);
        if(E && E.kind == "joy") this.joyStep(E);
        this.eyeStep();
        for(var i=this.confetti.length-1; i>=0; i--){
            var C = this.confetti[i];
            C.t++; C.vy = Math.min(1.6, C.vy + 0.05); C.vx *= 0.98; C.x += C.vx + Math.sin(C.t*0.1 + C.hue)*0.6; C.y += C.vy;
            if(C.y > CH + 10) this.confetti.splice(i,1);
        }
        for(var i=this.notes.length-1; i>=0; i--){
            var N = this.notes[i];
            N.t++; N.y -= 0.9; N.x += Math.sin(N.t*0.12)*0.6;
            if(N.t > 50) this.notes.splice(i,1);
        }
        for(var i=this.cracks.length-1; i>=0; i--){
            var c = this.cracks[i];
            c.t++;
            var hitT = c.t - ANGER_CRACK_WARN;
            if(hitT >= 0 && hitT < ANGER_CRACK_HIT && mainScreen.state != "over" && this.nearCrack(c, drone.X, drone.Y) && mainScreen.canBeHit()) mainScreen.damage();
            if(c.t >= ANGER_CRACK_WARN + ANGER_CRACK_HIT + ANGER_CRACK_SCAR) this.cracks.splice(i,1);
        }
        for(var i=this.ripples.length-1; i>=0; i--) if(++this.ripples[i].t > 50) this.ripples.splice(i,1);
        for(var i=this.bubbles.length-1; i>=0; i--){
            var B = this.bubbles[i];
            B.t++; B.y -= 0.8; B.x += Math.sin(B.t*0.2)*0.4;
            if(B.t > 70 || !this.cur || B.y < CH - this.cur.level) this.bubbles.splice(i,1);
        }
    },
    angerStep:function(E){
        var t = E.t++, m = danmaku();
        var tg = nearestPlayer(E.x, E.y), aim = Math.atan2(tg.Y - E.y, tg.X - E.x);
        if(t < ANGER_SIMMER){
            //煮えたぎる：だんだん怒る。核は震え、鼓動が速くなり、破片を荒く吐く
            var k = t/ANGER_SIMMER;
            E.rage = k;
            E.x = E.x0 + (Math.random() - 0.5)*8*k;
            var gap = ANGER_BEAT_SLOW + (ANGER_BEAT_FAST - ANGER_BEAT_SLOW)*k;
            if(++E.beatT >= gap){ E.beatT = 0; E.beat = 1; emoSfx.heart(k); if(k > 0.6) fx.shake(2); }
            var every = ANGER_SPIT_SLOW + (ANGER_SPIT_FAST - ANGER_SPIT_SLOW)*k;
            if(++E.spit >= every && t > 20){
                E.spit = 0;
                var n = k > 0.7 ? 2 : 1;
                for(var i=0; i<n; i++){
                    var a = aim + (Math.random() - 0.5)*2*(ANGER_SPIT_AIM + 0.45*k);
                    shotLab.fire(E.x, E.y, a, (ANGER_SPIT_SPEED + 1.6*k)*m*(0.8 + Math.random()*0.4), "rage", { heat:1 });
                }
                emoSfx.spit(k);
            }
            if(t == ANGER_SIMMER - ANGER_CRACK_WARN){
                //稲妻の予告：ドローン君へ1本と、左右にずらして
                for(var i=0; i<ANGER_CRACKS; i++) this.makeCrack(E.x, E.y, aim + (i - (ANGER_CRACKS - 1)/2)*ANGER_CRACK_SPREAD);
            }
            emoSfx.growlSet(k);
        }else if(t == ANGER_SIMMER){
            //爆発：破片が全方向へ。画面が赤く焼ける
            E.rage = 1.4; E.flash = 1;
            var a0 = Math.random()*Math.PI*2;
            for(var i=0; i<ANGER_RING_N; i++){
                shotLab.fire(E.x, E.y, a0 + i*Math.PI*2/ANGER_RING_N + (Math.random() - 0.5)*0.12, ANGER_RING_SPEED*m*(0.75 + Math.random()*0.5), "rage", { heat:1.3 });
            }
            fx.shake(12);
            fx.sparks(E.x, E.y, 26, "255,120,40", 7, 4);
            fx.ring(E.x, E.y, 160, "255,60,30", 22, 8);
            battleBg.ripple(E.x, E.y, 18, 8, 50, "255,60,30");
            emoSfx.roar(); emoSfx.crack();
            emoSfx.growlSet(0);
        }else{
            //冷めていく：鼓動はゆっくりに戻り、赤みが引く
            var u = (t - ANGER_SIMMER)/ANGER_COOL;
            E.rage = Math.max(0, E.rage*0.985 - 0.002);
            E.x += (E.x0 - E.x)*0.1;
            if(++E.beatT >= ANGER_BEAT_FAST + (ANGER_BEAT_SLOW - ANGER_BEAT_FAST)*Math.min(1, u*1.5) && u < 0.8){ E.beatT = 0; E.beat = 0.6; emoSfx.heart(E.rage*0.6); }
            if(u >= 1) this.cur = null;
        }
        E.beat *= 0.86;
        E.flash *= 0.9;
    },
    sorrowStep:function(E){
        var t = E.t++, m = danmaku();
        var tg = nearestPlayer(E.x, E.y);
        //雫はドローン君の上へ、ゆっくりついてくる(悲しみはつきまとう)
        E.x += (tg.X - E.x)*SORROW_FOLLOW;
        E.y = 78 + Math.sin(t*0.03)*6;
        //色が抜ける・戻る、淵が満ちる・引く
        var on = t < SORROW_DRAIN_AT ? Math.min(1, t/90) : Math.max(0, 1 - (t - SORROW_DRAIN_AT)/(SORROW_LEN - SORROW_DRAIN_AT));
        E.grey = on;
        var full = t < SORROW_DRAIN_AT ? Math.min(1, t/SORROW_POOL_FULL) : on;
        E.level = SORROW_POOL*(1 - Math.cos(full*Math.PI))/2;
        //曲がこもって遠くなる(淵が引き始めたら戻す)
        if(on > 0.3 && !E.muffled && sound.bgmFilter){ E.muffled = true; sound.bgmFilter.frequency.setTargetAtTime(SORROW_BGM_CUT, sound.ctx.currentTime, 0.4); }
        if(t == SORROW_DRAIN_AT) sound.timeWarp(false);
        emoSfx.padSet(on, (1 + Math.sin(t*0.035))/2);
        //涙：雫の下にふくらんで、離れて落ちる(1粒ごとに旋律の1音)
        if(t >= SORROW_WEEP[0] && t < SORROW_WEEP[1]){
            var k = (t - SORROW_WEEP[0])/(SORROW_WEEP[1] - SORROW_WEEP[0]);
            var gap = SORROW_TEAR_SLOW + (SORROW_TEAR_FAST - SORROW_TEAR_SLOW)*Math.min(1, k*1.6);
            E.well = Math.min(1, E.well + 1/gap);
            if(E.well >= 1){
                E.well = 0;
                shotLab.fire(E.x, E.y + 34, Math.PI/2 + (Math.random() - 0.5)*0.5, 0.4, "tear", { max:SORROW_TEAR_MAX*m });
                emoSfx.note(SORROW_MELODY[this.noteI++ % SORROW_MELODY.length]);
            }
            //空からも、ドローン君の近くの列に
            if(t > 90 && ++E.sky >= SORROW_SKY_EVERY){
                E.sky = 0;
                var sx = Math.max(20, Math.min(CW - 20, tg.X + (Math.random() - 0.5)*260));
                shotLab.fire(sx, -10, Math.PI/2, 0.8, "tear", { max:SORROW_TEAR_MAX*m*0.9 });
            }
        }else{
            E.well = Math.max(0, E.well - 0.03);
        }
        //しゃくり上げ：雫が縮んで震え、涙を上へ放る(山なりに落ちてくる)
        if(SORROW_SOBS.indexOf(t) >= 0){
            E.sob = 1;
            for(var i=0; i<SORROW_SOB_N; i++){
                var a = -Math.PI/2 + (i - (SORROW_SOB_N - 1)/2)*0.42;
                shotLab.fire(E.x, E.y, a, 2.4*m*(0.85 + Math.random()*0.3), "tear", { max:SORROW_TEAR_MAX*m });
            }
            emoSfx.sob();
        }
        E.sob *= 0.94;
        //淵に沈んだドローン君：泡が上がる・あせる
        var inPool = drone.Y > CH - E.level;
        if(inPool && !E.inPool){ popup(drone.X, drone.Y - 30, "体が重い…", "#4a6a9a"); emoSfx.drip(); }
        E.inPool = inPool;
        if(inPool){
            drone.look.setFace("sad", 20);
            if(t % 9 == 0) this.bubbles.push({ x:drone.X + (Math.random() - 0.5)*16, y:drone.Y - 8, t:0 });
        }
        if(t >= SORROW_LEN){ this.clear(); }
    },
    fearStep:function(E){
        var t = E.t++;
        //暗くなる → 明かりがだんだん狭まる → 最後に戻る
        var into = Math.min(1, t/FEAR_DARK_IN), out = t > FEAR_LEN - 50 ? (t - (FEAR_LEN - 50))/50 : 0;
        E.dark = into*(1 - out);
        var narrow = FEAR_LIGHT_START + (FEAR_LIGHT_END - FEAR_LIGHT_START)*Math.min(1, t/(FEAR_LEN - 80));
        E.light = 900 + (narrow - 900)*E.dark;
        //明かりがちらつく(一瞬もっと暗くなる)
        if(E.flick > 0) E.flick--;
        else if(t > FEAR_DARK_IN && Math.random() < FEAR_FLICKER){ E.flick = 6 + Math.floor(Math.random()*10); emoSfx.whisper(); }
        //曲がほとんど聞こえなくなる(静けさが怖い)。終わりに戻す
        if(t == 20 && sound.bgmFilter) sound.bgmFilter.frequency.setTargetAtTime(FEAR_BGM_CUT, sound.ctx.currentTime, 0.6);
        if(t == FEAR_LEN - 50) sound.timeWarp(false);
        emoSfx.dreadSet(E.dark);
        //ゆっくりの鼓動(驚かしのあとはしばらく速い)
        var gap = t > FEAR_SCARE_AT && t < FEAR_SCARE_AT + 90 ? 20 : 42;
        if(E.dark > 0.5 && ++E.beatT >= gap){ E.beatT = 0; emoSfx.heart(0.35); }
        //暗がりの目：ドローン君の後ろ側に開いて、にらんでから撃つ
        if(t > FEAR_DARK_IN && t < FEAR_LEN - 60 && Math.abs(t - FEAR_SCARE_AT) > 40 && ++E.eyeT >= FEAR_EYE_EVERY){
            E.eyeT = 0;
            var a = shotLab.head + Math.PI + (Math.random() - 0.5)*2*FEAR_EYE_BEHIND;
            var d = FEAR_EYE_DIST[0] + Math.random()*(FEAR_EYE_DIST[1] - FEAR_EYE_DIST[0]);
            this.openEye(drone.X + Math.cos(a)*d, drone.Y + Math.sin(a)*d, FEAR_EYE_OPEN + FEAR_EYE_STARE);
            if(Math.random() < 0.4) emoSfx.whisper();
        }
        //驚かし：目がいっせいに開いて囲み、順に撃つ
        if(t == FEAR_SCARE_AT){
            var a0 = Math.random()*Math.PI*2;
            for(var i=0; i<FEAR_SCARE_N; i++){
                var a = a0 + i*Math.PI*2/FEAR_SCARE_N;
                this.openEye(drone.X + Math.cos(a)*FEAR_SCARE_R, drone.Y + Math.sin(a)*FEAR_SCARE_R*0.8, 30 + i*FEAR_SCARE_GAP, true);
            }
            E.scare = 1;
            fx.shake(8);
            emoSfx.shriek();
            drone.look.setFace("surprise", 40);
        }
        E.scare *= 0.93;
        if(E.dark > 0.5 && t % 30 == 0) drone.look.setFace("sad", 32);
        if(t >= FEAR_LEN) this.clear();
    },
    //暗がりに目を開く(画面の中に収める)
    openEye:function(_x,_y,_stare,_quiet){
        this.eyes.push({ x:Math.max(30, Math.min(CW - 30, _x)), y:Math.max(30, Math.min(CH - 30, _y)), t:0, stare:_stare, fired:false });
        if(!_quiet) emoSfx.creak();
    },
    eyeStep:function(){
        var m = danmaku();
        for(var i=this.eyes.length-1; i>=0; i--){
            var Y = this.eyes[i];
            Y.t++;
            if(!Y.fired && Y.t >= Y.stare){
                Y.fired = true;
                var tg = nearestPlayer(Y.x, Y.y);
                shotLab.fire(Y.x, Y.y, Math.atan2(tg.Y - Y.y, tg.X - Y.x), FEAR_SHOT_START*m, "dread", { max:FEAR_SHOT_MAX*m });
                emoSfx.whoosh();
            }
            if(Y.fired && Y.t >= Y.stare + FEAR_EYE_CLOSE) this.eyes.splice(i,1);
        }
    },
    joyStep:function(E){
        var t = E.t++, m = danmaku();
        E.glow = Math.max(0, Math.min(1, t/40)*(t > JOY_LEN - 40 ? (JOY_LEN - t)/40 : 1));
        //太陽は左右へ動きながら、拍ごとに跳ねる
        var ph = (t % JOY_BEAT)/JOY_BEAT;
        E.x += E.vx;
        if(E.x < 120 || E.x > CW - 120) E.vx = -E.vx;
        E.hop = Math.sin(ph*Math.PI);
        E.y = E.y0 + 20 - E.hop*40;
        E.squash *= 0.8;
        if(t % JOY_BEAT == 0 && t >= 16 && t < JOY_LEN - 30){
            var n = E.beatN++;
            E.squash = 1;
            emoSfx.joyBeat(n);
            var tg = nearestPlayer(E.x, E.y), aim = Math.atan2(tg.Y - E.y, tg.X - E.x);
            if(t < JOY_FINALE[0] || t >= JOY_FINALE[1]){
                //2拍ごとに花びらの輪(巻く向きを交互に)、3拍ごとにはずむ玉を2つ放る
                if(n % 2 == 0){
                    for(var i=0; i<JOY_PETAL_N; i++){
                        var pa = n*0.27 + i*Math.PI*2/JOY_PETAL_N;     //太陽のふちから(顔が隠れないように)
                        shotLab.fire(E.x + Math.cos(pa)*30, E.y + Math.sin(pa)*30, pa, JOY_PETAL_SPEED*m, "petal",
                                     { curl:(n % 4 ? -1 : 1)*JOY_PETAL_CURL, hue:(n*40 + i*30) % 360 });
                    }
                    emoSfx.bloom();
                }
                if(n % 3 == 1){
                    for(var i=-1; i<=1; i+=2){
                        var b = shotLab.fire(E.x, E.y, aim + i*0.5, JOY_BALL_SPEED, "bouncy", { left:JOY_BOUNCES, hue:Math.floor(Math.random()*360), sq:0 });
                        b.vy = -Math.abs(b.vy) - 2;     //上へ放って山なりに
                    }
                }
            }
            for(var i=0; i<6; i++) this.confetti.push({ x:E.x, y:E.y, vx:(Math.random() - 0.5)*6, vy:-2 - Math.random()*3, t:0, hue:Math.floor(Math.random()*360), spin:Math.random()*6 });
        }
        //最後の花のうず：くるくる回りながら花びらを撒く
        if(t >= JOY_FINALE[0] && t < JOY_FINALE[1] && t % 4 == 0){
            for(var i=0; i<3; i++) shotLab.fire(E.x + Math.cos(t*0.13 + i*Math.PI*2/3)*30, E.y + Math.sin(t*0.13 + i*Math.PI*2/3)*30, t*0.13 + i*Math.PI*2/3, JOY_PETAL_SPEED*m*0.9, "petal", { curl:JOY_PETAL_CURL*0.5, hue:(t*6 + i*120) % 360 });
        }
        if(t % 50 == 0) drone.look.setFace("happy", 40);
        if(t >= JOY_LEN) this.clear();
    },
    //今の拍の中の位置(0～1。喜びの間だけ。弾が拍に合わせて動く)
    beatPhase:function(){
        var E = this.cur;
        return E && E.kind == "joy" ? (E.t % JOY_BEAT)/JOY_BEAT : -1;
    },
    //淵の中では重く、沈んでいく(drone.calcXY から shotLab.steer 経由)
    steer:function(d,T){
        var E = this.cur;
        if(!E || E.kind != "sorrow" || mainScreen.state == "over") return;
        if(d.Y > CH - E.level){
            T.d = T.d*SORROW_HEAVY;
            T.y += SORROW_SINK;
        }
    },

    //試作の弾の動き(shotLab.step から)。null ならここの弾ではない。true なら消す
    step:function(b){
        if(b.t == null || coop.isGuest()) return null;
        switch(b.kind){
            case "rage":
                b.t++;
                b.heat = Math.max(0, b.heat - ANGER_COOL_RATE);
                if(b.heat < 0.6){ b.vx *= ANGER_DRAG; b.vy *= ANGER_DRAG; }
                if(b.heat < 0.25){
                    //灰になって、ゆらゆら舞い落ちる
                    b.r = 3;
                    b.vy = Math.min(ANGER_ASH_MAX, b.vy + ANGER_ASH_FALL);
                    b.vx += Math.sin(b.t*0.08 + b.x*0.01)*0.03;
                }
                return false;
            case "tear":
                b.t++;
                b.vy = Math.min(b.max || SORROW_TEAR_MAX, b.vy + SORROW_GRAVITY);
                b.vx *= 0.99;
                return this.intoPool(b, true);
            case "splash":
                b.t++;
                b.vy += 0.08;
                return b.vy > 0 && this.intoPool(b, false);
            case "dread":
                //はじめはゆっくり忍び寄り、だんだん速くなる
                b.t++;
                if(Math.hypot(b.vx, b.vy) < (b.max || FEAR_SHOT_MAX)){ b.vx *= FEAR_SHOT_ACCEL; b.vy *= FEAR_SHOT_ACCEL; }
                return false;
            case "petal":
                //拍の頭にぴょんと進み、拍の間はゆっくり(踊るように)。少しずつ曲がって輪がうずを巻く
                b.t++;
                var ph = this.beatPhase(), k = ph < 0 ? 1 : 0.35 + 2.2*Math.exp(-ph*6);
                b.dir = (b.dir != null ? b.dir : Math.atan2(b.vy, b.vx)) + (b.curl || 0);
                b.vx = Math.cos(b.dir)*b.base*k; b.vy = Math.sin(b.dir)*b.base*k;
                return false;
            case "bouncy":
                b.t++;
                b.vy += JOY_GRAVITY;
                b.sq *= 0.85;
                if((b.x < b.r && b.vx < 0) || (b.x > CW - b.r && b.vx > 0)) b.vx = -b.vx;
                if(b.left > 0 && b.y > CH - b.r && b.vy > 0){
                    //床ではずむ(1回ごとに音階の音と音符)
                    b.vy = -b.vy*JOY_BOUNCE; b.left--; b.sq = 1;
                    b.grazed = false;
                    emoSfx.bell(JOY_SCALE[this.noteI++ % JOY_SCALE.length]);
                    this.notes.push({ x:b.x, y:b.y - 10, t:0, hue:b.hue });
                }
                return false;
        }
        return null;
    },
    //水面に落ちたら消える(涙なら波紋としずく)
    intoPool:function(b,_tear){
        var E = this.cur;
        if(!E || E.kind != "sorrow" || E.level < 4 || b.y < CH - E.level) return false;
        this.ripples.push({ x:b.x, t:0 });
        if(_tear){
            for(var i=0; i<SORROW_SPLASH_N; i++){
                shotLab.fire(b.x, CH - E.level - 2, -Math.PI/2 + (i ? 1 : -1)*(0.25 + Math.random()*0.35), 2.2 + Math.random()*0.9, "splash");
            }
            emoSfx.drip();
        }
        return true;
    },
    //試作の弾の絵(shotLab.draw から)。描いたなら true
    draw:function(b){
        var now = b.t != null ? b.t : Math.floor(performance.now()/16);
        switch(b.kind){
            case "rage":
                var h = b.heat != null ? b.heat : 1, ang = Math.atan2(b.vy, b.vx) + (h < 0.25 ? now*0.1 : 0);
                ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(ang);
                if(h > 0.3){
                    //熱い破片：光がにじむ
                    ctx.globalCompositeOperation = "lighter";
                    ctx.fillStyle = "rgba(255," + Math.floor(60 + 80*Math.min(1,h)) + ",20," + (0.35*Math.min(1,h)) + ")";
                    ctx.beginPath(); ctx.arc(0, 0, 9 + 4*Math.min(1,h), 0, Math.PI*2); ctx.fill();
                    ctx.globalCompositeOperation = "source-over";
                }
                //熱で白 → 黄 → 赤 → 黒い灰
                var col = h > 0.85 ? "#fff6d0" : h > 0.6 ? "#ffc030" : h > 0.4 ? "#ff5a1a" : h > 0.25 ? "#a01810" : "#3a3434";
                var L = h < 0.25 ? 4 : 7 + 4*Math.min(1,h);
                ctx.fillStyle = col; ctx.strokeStyle = h < 0.25 ? "#1a1616" : "#400806"; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(L, 0); ctx.lineTo(-L*0.3, -L*0.45); ctx.lineTo(-L*0.15, -L*0.05); ctx.lineTo(-L*0.8, L*0.25); ctx.lineTo(-L*0.2, L*0.4);
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.restore(); ctx.lineWidth = 1;
                return true;
            case "tear":
                //しずく(丸い底が進む向き。上へ放られた涙は、とがった先が後ろ)
                var a = Math.atan2(b.vy, b.vx) - Math.PI/2, r = b.r || 5;
                ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
                ctx.fillStyle = "#6fa6e8"; ctx.strokeStyle = "#173a6e"; ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(0, -r*2.4);
                ctx.bezierCurveTo(r*0.6, -r*1.1, r*1.15, -r*0.2, r*1.1, r*0.25);
                ctx.arc(0, r*0.25, r*1.1, 0, Math.PI);
                ctx.bezierCurveTo(-r*1.15, -r*0.2, -r*0.6, -r*1.1, 0, -r*2.4);
                ctx.fill(); ctx.stroke();
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(-r*0.4, 0, r*0.32, 0, Math.PI*2); ctx.fill();
                ctx.restore(); ctx.lineWidth = 1;
                return true;
            case "splash":
                ctx.fillStyle = "#6fa6e8"; ctx.strokeStyle = "#173a6e"; ctx.lineWidth = 1.4;
                ctx.beginPath(); ctx.arc(b.x, b.y, (b.r || 3) + 0.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.lineWidth = 1;
                return true;
            case "dread":
                //黒紫のもや。ゆらぐふちと、赤くにじむ芯(明かりの中に入ると見える)
                var r = b.r || 5;
                ctx.fillStyle = "rgba(40,10,50,0.45)";
                ctx.beginPath();
                for(var i=0; i<=10; i++){ var a = i*Math.PI/5, rr = r*1.9 + Math.sin(now*0.3 + i*2.1)*2; ctx.lineTo(b.x + Math.cos(a)*rr, b.y + Math.sin(a)*rr); }
                ctx.fill();
                ctx.fillStyle = "#1a0a20"; ctx.strokeStyle = "#7a1030"; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(b.x, b.y, r + 1, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = "#e02040";
                ctx.beginPath(); ctx.arc(b.x, b.y, r*0.35, 0, Math.PI*2); ctx.fill();
                ctx.lineWidth = 1;
                return true;
            case "petal":
                //花びら(色は1枚ずつ。くるくる回る)
                var r = b.r || 4, hue = b.hue != null ? b.hue : 330;
                ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(now*0.15 + hue);
                ctx.fillStyle = "hsl(" + hue + ",85%,62%)"; ctx.strokeStyle = "hsl(" + hue + ",70%,32%)"; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.ellipse(0, 0, r*2, r*1.1, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = "#fff";
                ctx.beginPath(); ctx.arc(0, 0, r*0.45, 0, Math.PI*2); ctx.fill();
                ctx.restore(); ctx.lineWidth = 1;
                return true;
            case "bouncy":
                //つやのある色の玉(はずんだ瞬間はつぶれる)
                var r = b.r || 6, hue = b.hue != null ? b.hue : 50, sq = b.sq || 0;
                ctx.save(); ctx.translate(b.x, b.y); ctx.scale(1 + 0.35*sq, 1 - 0.3*sq);
                ctx.fillStyle = "hsl(" + hue + ",85%,58%)"; ctx.strokeStyle = "hsl(" + hue + ",70%,28%)"; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = "rgba(255,255,255,0.9)";
                ctx.beginPath(); ctx.arc(-r*0.35, -r*0.35, r*0.35, 0, Math.PI*2); ctx.fill();
                ctx.restore(); ctx.lineWidth = 1;
                return true;
        }
        return false;
    },

    //弾の下に描く(核・雫・稲妻)
    drawUnder:function(){
        var E = this.cur;
        for(var i=0; i<this.cracks.length; i++) this.drawCrack(this.cracks[i]);
        if(E && E.kind == "anger") this.drawAngerCore(E);
        if(E && E.kind == "sorrow") this.drawSorrowCore(E);
        if(E && E.kind == "joy") this.drawJoySun(E);
    },
    //喜びの太陽：回る光の筋の中で、拍ごとに跳ねてつぶれる。にこにこ顔
    drawJoySun:function(E){
        var t = E.t, g = E.glow, R = 22;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(E.x, E.y);
        ctx.rotate(t*0.01);
        ctx.fillStyle = "rgba(255,210,90," + (0.07*g) + ")";
        for(var i=0; i<12; i++){
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.arc(0, 0, 1200, i*Math.PI/6, i*Math.PI/6 + Math.PI/14);
            ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "rgba(255,200,80," + (0.25*g) + ")";
        ctx.beginPath(); ctx.arc(0, 0, R*2.2 + 6*E.squash, 0, Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(E.x, E.y);
        ctx.scale(1 + 0.25*E.squash, 1 - 0.2*E.squash);
        //とげの代わりに丸い光の粒
        ctx.fillStyle = "#ffb020";
        for(var i=0; i<10; i++){ var a = i*Math.PI/5 + t*0.03; ctx.beginPath(); ctx.arc(Math.cos(a)*(R + 7), Math.sin(a)*(R + 7), 4.5, 0, Math.PI*2); ctx.fill(); }
        ctx.fillStyle = "#ffd84a"; ctx.strokeStyle = "#b86a00"; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        //にこにこ顔(目は弧、ほっぺ)
        ctx.strokeStyle = "#6a3a00"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.arc(-7, -2, 4, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(7, -2, 4, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 4, 7, Math.PI*0.15, Math.PI*0.85); ctx.stroke();
        ctx.fillStyle = "rgba(255,110,110,0.6)";
        ctx.beginPath(); ctx.arc(-13, 5, 3.5, 0, Math.PI*2); ctx.arc(13, 5, 3.5, 0, Math.PI*2); ctx.fill();
        ctx.restore(); ctx.lineWidth = 1; ctx.lineCap = "butt";
    },
    drawCrack:function(c){
        var hitT = c.t - ANGER_CRACK_WARN, P = c.pts;
        var path = function(){ ctx.beginPath(); ctx.moveTo(P[0].x, P[0].y); for(var i=1; i<P.length; i++) ctx.lineTo(P[i].x, P[i].y); };
        ctx.lineJoin = "round"; ctx.lineCap = "round";
        if(hitT < 0){
            //予告：細い赤い線がちらつきながら太くなる
            var k = c.t/ANGER_CRACK_WARN;
            ctx.strokeStyle = "rgba(220,20,20," + (0.25 + 0.5*k*(c.t % 6 < 3 ? 1 : 0.5)) + ")";
            ctx.lineWidth = 1 + 3*k;
            ctx.setLineDash([10, 6]); path(); ctx.stroke(); ctx.setLineDash([]);
        }else if(hitT < ANGER_CRACK_HIT){
            //当たる間：赤い光・橙・白い芯(光を重ねてにじませる)
            var f = 1 - hitT/ANGER_CRACK_HIT;
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = "rgba(255,40,20," + (0.5*f) + ")"; ctx.lineWidth = ANGER_CRACK_W*2; path(); ctx.stroke();
            ctx.strokeStyle = "rgba(255,150,40," + (0.8*f) + ")"; ctx.lineWidth = 7; path(); ctx.stroke();
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = "rgba(255,255,230," + f + ")"; ctx.lineWidth = 2.5; path(); ctx.stroke();
        }else{
            //焦げ跡
            var s = 1 - (hitT - ANGER_CRACK_HIT)/ANGER_CRACK_SCAR;
            ctx.strokeStyle = "rgba(50,10,8," + (0.5*s) + ")"; ctx.lineWidth = 4; path(); ctx.stroke();
            ctx.strokeStyle = "rgba(255,90,30," + (0.4*s*s) + ")"; ctx.lineWidth = 1.5; path(); ctx.stroke();
        }
        ctx.lineWidth = 1; ctx.lineJoin = "miter"; ctx.lineCap = "butt";
    },
    //怒りの核：とげとげの塊。怒るほどとげが伸びてちらつき、中のひびが溶岩のように光る
    drawAngerCore:function(E){
        var t = E.t, k = Math.min(1, E.rage), after = t > ANGER_SIMMER;
        var R = after ? 12 + 10*Math.min(1, (t - ANGER_SIMMER)/ANGER_COOL) : 20 + 8*E.beat + 6*k;
        var spike = after ? 2 : 3 + 13*k;
        ctx.save(); ctx.translate(E.x, E.y);
        //熱のにじみ
        ctx.globalCompositeOperation = "lighter";
        for(var j=0; j<3; j++){
            ctx.fillStyle = "rgba(255,50,20," + ((0.08 + 0.1*E.beat)*k) + ")";
            ctx.beginPath(); ctx.arc(0, 0, R*(1.6 + j*0.6), 0, Math.PI*2); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
        var N = 18;
        ctx.beginPath();
        for(var i=0; i<=N*2; i++){
            var a = i*Math.PI/N + t*0.01, rr = i % 2 ? R : R + spike*(0.6 + 0.4*Math.sin(i*7.3 + E.seed) + (Math.random() - 0.5)*0.5*k);
            ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr);
        }
        ctx.closePath();
        ctx.fillStyle = after ? "#2a1a18" : "#4a0606";
        ctx.strokeStyle = after ? "#140c0c" : "#1a0202"; ctx.lineWidth = 2.5;
        ctx.fill(); ctx.stroke();
        //中のひび(怒るほど明るく、鼓動で光る)
        var glow = after ? 0.25*E.rage : 0.3 + 0.7*k*(0.6 + 0.4*E.beat);
        ctx.strokeStyle = "rgba(255," + Math.floor(120 + 100*k) + ",40," + glow + ")"; ctx.lineWidth = 2;
        ctx.beginPath();
        for(var i=0; i<5; i++){
            var a = i*1.3 + E.seed, x = 0, y = 0;
            ctx.moveTo(0, 0);
            for(var s=1; s<=3; s++){ a += Math.sin(E.seed*s + i)*0.6; x += Math.cos(a)*R*0.3; y += Math.sin(a)*R*0.3; ctx.lineTo(x, y); }
        }
        ctx.stroke();
        ctx.fillStyle = "rgba(255,240,200," + glow + ")";
        ctx.beginPath(); ctx.arc(0, 0, R*0.22*(1 + E.beat*0.5), 0, Math.PI*2); ctx.fill();
        ctx.restore(); ctx.lineWidth = 1;
    },
    //悲しみの雫：うつむくように垂れた大きな青白いしずく。下にこれから落ちる涙がふくらむ
    drawSorrowCore:function(E){
        var t = E.t, sob = E.sob, R = 24*(1 - 0.12*sob);
        var sway = Math.sin(t*0.025)*0.08 + (Math.random() - 0.5)*0.1*sob;
        ctx.save(); ctx.translate(E.x, E.y); ctx.rotate(sway);
        //うっすら光る輪
        ctx.fillStyle = "rgba(160,200,255,0.18)";
        ctx.beginPath(); ctx.arc(0, 4, R*2, 0, Math.PI*2); ctx.fill();
        //雫(上がとがり、下が丸く重い)
        ctx.fillStyle = "rgba(150,190,240,0.85)"; ctx.strokeStyle = "#2a4f80"; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -R*1.9);
        ctx.bezierCurveTo(R*0.7, -R*0.9, R*1.15, -R*0.1, R, R*0.4);
        ctx.arc(0, R*0.4, R, 0, Math.PI);
        ctx.bezierCurveTo(-R*1.15, -R*0.1, -R*0.7, -R*0.9, 0, -R*1.9);
        ctx.fill(); ctx.stroke();
        //中の暗いかげ(うつむいた重さ)
        ctx.fillStyle = "rgba(40,70,120,0.35)";
        ctx.beginPath(); ctx.ellipse(0, R*0.7, R*0.7, R*0.45, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath(); ctx.ellipse(-R*0.45, -R*0.1, R*0.16, R*0.3, -0.4, 0, Math.PI*2); ctx.fill();
        //これから落ちる涙(下にふくらんで、細い首でつながる)
        if(E.well > 0.05){
            var w = E.well, ty = R*1.4 + w*10, tr = 2 + 4*w;
            ctx.fillStyle = "rgba(170,210,255,0.95)"; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-tr*0.4, R*1.3); ctx.lineTo(tr*0.4, R*1.3);
            ctx.lineTo(tr, ty); ctx.arc(0, ty, tr, 0, Math.PI); ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        ctx.restore(); ctx.lineWidth = 1;
    },
    //いちばん手前：画面の色(怒りは赤く焼け、ふちが脈打つ。悲しみは色が抜けて青く沈み、淵が満ちる)
    drawFront:function(){
        var E = this.cur;
        var rage = this.rage(), flash = E && E.kind == "anger" ? E.flash : 0, beat = E && E.kind == "anger" ? E.beat : 0;
        if(rage > 0.01){
            var k = Math.min(1, rage);
            ctx.save();
            //熱を帯びた赤(かけ合わせて青・緑を沈める)
            ctx.globalCompositeOperation = "multiply";
            ctx.fillStyle = "rgba(255," + Math.floor(255 - 150*k) + "," + Math.floor(255 - 185*k) + "," + (ANGER_TINT*k) + ")";
            ctx.fillRect(0, 0, CW, CH);
            ctx.globalCompositeOperation = "source-over";
            //ふちの赤黒い影が鼓動で脈打つ(視野が狭くなる)
            var g = ctx.createRadialGradient(CW/2, CH/2, 180 - 60*beat*k, CW/2, CH/2, 560);
            g.addColorStop(0, "rgba(90,0,0,0)");
            g.addColorStop(1, "rgba(90,0,0," + (0.8*k*(0.6 + 0.4*beat)) + ")");
            ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
            ctx.restore();
        }
        if(flash > 0.02){
            ctx.fillStyle = "rgba(255,70,30," + (0.55*flash) + ")";
            ctx.fillRect(0, 0, CW, CH);
        }
        if(E && E.kind == "sorrow" && E.grey > 0.01){
            ctx.save();
            //色が抜けて、青く沈む
            ctx.globalCompositeOperation = "saturation";
            ctx.fillStyle = "rgba(128,128,128," + (SORROW_GREY*E.grey) + ")";
            ctx.fillRect(0, 0, CW, CH);
            ctx.globalCompositeOperation = "multiply";
            ctx.fillStyle = "rgba(150,175,215," + (0.7*E.grey) + ")";
            ctx.fillRect(0, 0, CW, CH);
            ctx.globalCompositeOperation = "source-over";
            ctx.restore();
        }
        if(E && E.kind == "sorrow" && E.level > 1) this.drawPool(E);
        if(E && E.kind == "fear") this.drawDark(E);
        if(this.eyes.length) this.drawEyes();
        if(E && E.kind == "joy" && E.glow > 0.01){
            ctx.save();
            //色が鮮やかになり、あたたかい光がさす
            ctx.globalCompositeOperation = "saturation";
            ctx.fillStyle = "rgba(255,0,0," + (JOY_SAT*E.glow) + ")";
            ctx.fillRect(0, 0, CW, CH);
            ctx.globalCompositeOperation = "screen";
            ctx.fillStyle = "rgba(255,225,150," + (0.08*E.glow*(1 + 0.5*E.squash)) + ")";
            ctx.fillRect(0, 0, CW, CH);
            ctx.restore();
        }
        //紙吹雪・音符
        for(var i=0; i<this.confetti.length; i++){
            var C = this.confetti[i];
            ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(C.t*0.15 + C.spin);
            ctx.scale(1, Math.cos(C.t*0.2 + C.spin));
            ctx.fillStyle = "hsl(" + C.hue + ",90%,60%)";
            ctx.fillRect(-4, -2.5, 8, 5);
            ctx.restore();
        }
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 18px sans-serif";
        for(var i=0; i<this.notes.length; i++){
            var N = this.notes[i];
            ctx.fillStyle = "hsla(" + N.hue + ",80%,45%," + (1 - N.t/50) + ")";
            ctx.fillText(i % 2 ? "♪" : "♫", N.x, N.y);
        }
    },
    //恐怖の闇：ドローン君のまわりの明かりだけが見える(ちらつくと狭まる)。驚かしの瞬間は赤黒くなる
    drawDark:function(E){
        if(E.dark <= 0.01) return;
        var L = E.light*(E.flick > 0 ? 0.6 + Math.random()*0.15 : 1), a = FEAR_DARK*E.dark;
        var g = ctx.createRadialGradient(drone.X, drone.Y, L*0.45, drone.X, drone.Y, L);
        g.addColorStop(0, "rgba(6,3,14,0)");
        g.addColorStop(0.7, "rgba(6,3,14," + (a*0.75) + ")");
        g.addColorStop(1, "rgba(6,3,14," + a + ")");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, CW, CH);
        if(E.scare > 0.02){
            ctx.fillStyle = "rgba(120,0,20," + (0.5*E.scare) + ")";
            ctx.fillRect(0, 0, CW, CH);
        }
        //暗い弾は、闇の中では赤い芯だけがかすかに見える(よける手がかり)
        ctx.fillStyle = "rgba(255,40,60," + (0.4*E.dark) + ")";
        for(var i=0; i<enemyShots.length; i++){
            var b = enemyShots[i];
            if(b.kind != "dread") continue;
            ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, Math.PI*2); ctx.fill();
        }
    },
    //暗がりの目：赤く光る2つの目が開き、ドローン君を目で追う。撃つ直前に見開く
    drawEyes:function(){
        for(var i=0; i<this.eyes.length; i++){
            var Y = this.eyes[i];
            var open = Y.fired ? 1 - (Y.t - Y.stare)/FEAR_EYE_CLOSE : Math.min(1, Y.t/FEAR_EYE_OPEN);
            if(!Y.fired && Y.stare - Y.t < 10) open = 1.3;      //撃つ直前に見開く
            if(open <= 0) continue;
            var look = Math.atan2(drone.Y - Y.y, drone.X - Y.x), lx = Math.cos(look)*2.5, ly = Math.sin(look)*2;
            ctx.save(); ctx.translate(Y.x, Y.y);
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = "rgba(255,30,40," + (0.18*Math.min(1,open)) + ")";
            ctx.beginPath(); ctx.ellipse(0, 0, 34, 16, 0, 0, Math.PI*2); ctx.fill();
            ctx.globalCompositeOperation = "source-over";
            for(var s=-1; s<=1; s+=2){
                ctx.fillStyle = "#ffdf40";
                ctx.beginPath(); ctx.ellipse(s*12, 0, 8, 6*Math.min(1.3, open), s*0.25, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = "#200";
                ctx.beginPath(); ctx.ellipse(s*12 + lx, ly, 1.8, 5*Math.min(1.2, open), 0, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }
    },
    //涙の淵：水面がゆれ、落ちた所に波紋。沈んだドローン君からは泡
    drawPool:function(E){
        var top = CH - E.level, t = E.t;
        var surf = function(x){ return top + Math.sin(x*0.02 + t*0.05)*3 + Math.sin(x*0.045 - t*0.03)*2; };
        ctx.beginPath(); ctx.moveTo(0, CH);
        for(var x=0; x<=CW; x+=16) ctx.lineTo(x, surf(x));
        ctx.lineTo(CW, CH); ctx.closePath();
        ctx.fillStyle = "rgba(40,80,150,0.38)"; ctx.fill();
        ctx.strokeStyle = "rgba(220,235,255,0.75)"; ctx.lineWidth = 2;
        ctx.beginPath();
        for(var x=0; x<=CW; x+=16) x ? ctx.lineTo(x, surf(x)) : ctx.moveTo(x, surf(x));
        ctx.stroke();
        //水の中の光のゆらぎ
        ctx.strokeStyle = "rgba(200,225,255,0.12)"; ctx.lineWidth = 6;
        ctx.beginPath();
        for(var i=0; i<5; i++){ var y = top + 20 + i*28; if(y > CH) break; ctx.moveTo(0, y); for(var x=0; x<=CW; x+=40) ctx.lineTo(x, y + Math.sin(x*0.03 + t*0.04 + i)*5); }
        ctx.stroke();
        for(var i=0; i<this.ripples.length; i++){
            var R = this.ripples[i], u = R.t/50;
            ctx.strokeStyle = "rgba(230,240,255," + (0.7*(1 - u)) + ")"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.ellipse(R.x, surf(R.x), 6 + 40*u, 2 + 7*u, 0, 0, Math.PI*2); ctx.stroke();
        }
        ctx.fillStyle = "rgba(230,240,255,0.6)";
        for(var i=0; i<this.bubbles.length; i++){
            var B = this.bubbles[i];
            ctx.beginPath(); ctx.arc(B.x, B.y, 2 + B.t*0.03, 0, Math.PI*2); ctx.fill();
        }
        ctx.lineWidth = 1;
    },

    //デバッグの「攻撃の試作」から(_T：その攻撃を始めてからのフレーム、_x,_y：砲台の位置)
    labStep:function(_id,_T,_x,_y){
        if(_T == 40){
            if(_id == "anger") this.anger(_x, _y + 10);
            if(_id == "sorrow") this.sorrow(_x, _y);
            if(_id == "fear") this.fear();
            if(_id == "joy") this.joy(_x, _y);
        }
    }
};

//shotLab を包んで、感情の攻撃を足す
(function(){
    shotLab.list.push(
        { id:"anger",  name:"感情：怒り",   note:"鼓動が速まり、荒く吐き散らして爆発。稲妻の予告線から離れる。破片は冷えると灰に" },
        { id:"sorrow", name:"感情：悲しみ", note:"涙がたまって淵になる。淵の中は体が重く沈む。水面では涙がはねる" },
        { id:"fear",   name:"感情：恐怖",   note:"明かりの外は見えない。目は後ろ側に開いて撃ってくる。暗い弾はだんだん速く" },
        { id:"joy",    name:"感情：喜び",   note:"花びらは拍に合わせてぴょんと進む。はずむ玉は床で弾むたびに音が鳴る" }
    );
    var labStep0 = shotLab.labStep;
    shotLab.labStep = function(){
        var r = labStep0.apply(this, arguments);
        var t = this.labT - 1, T = t % (SHOT_LAB_SEC*60);
        emotion.labStep(this.list[this.labIndex()].id, T, this.labX, 70);
        return r;
    };
    //感情の攻撃の間は、砲台を描かない(核・雫が砲台の代わり)
    var drawLab0 = shotLab.drawLab;
    shotLab.drawLab = function(){
        var id = this.list[this.labIndex()].id, x = this.labX;
        if(id == "anger" || id == "sorrow" || id == "fear" || id == "joy") this.labX = -999;
        var r = drawLab0.apply(this, arguments);
        this.labX = x;
        return r;
    };
    var clear0 = shotLab.clear;
    shotLab.clear = function(){ emotion.clear(); return clear0.apply(this, arguments); };
    var update0 = shotLab.update;
    shotLab.update = function(){ var r = update0.apply(this, arguments); emotion.update(); return r; };
    var steer0 = shotLab.steer;
    shotLab.steer = function(d,T){ var r = steer0.apply(this, arguments); emotion.steer(d,T); return r; };
    var step0 = shotLab.step;
    shotLab.step = function(b){
        var r = emotion.step(b);
        if(r !== null) return r;
        return step0.apply(this, arguments);
    };
    var draw0 = shotLab.draw;
    shotLab.draw = function(b){
        if(emotion.draw(b)) return true;
        return draw0.apply(this, arguments);
    };
    var under0 = shotLab.drawUnder;
    shotLab.drawUnder = function(){ var r = under0.apply(this, arguments); emotion.drawUnder(); return r; };
    var front0 = shotLab.drawFront;
    shotLab.drawFront = function(){ emotion.drawFront(); return front0.apply(this, arguments); };
})();
