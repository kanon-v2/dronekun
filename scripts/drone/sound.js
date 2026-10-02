//------------------------------------------------------------------------------
//  BGM・効果音(Web Audio APIで音を合成するので音声ファイルは不要)
//  ブラウザの決まりで、最初にクリックかキー入力があるまで音は鳴らない
//------------------------------------------------------------------------------
const BGM_VOLUME = 0.32;
const SE_VOLUME = 0.55;
const HEAVY_BOOM_LEN = 1.6;     //ボスの着地の重い衝撃音(heavyBoom)の長さ(秒)
const KAI_BOOT_LEN = 1.6;       //ドローン君改の始動音の長さ(秒)。mainScreen の KAI_BOOT_TIME(フレーム)と合わせる
//ドローン君改の始動でリレーが入る時刻(秒)。だんだん間隔が詰まる。mainScreen の見た目(光る・揺れる)もこれに合わせる
const KAI_RELAYS = [0.0, 0.34, 0.6, 0.79, 0.93, 1.04, 1.13, 1.2, 1.26, 1.31, 1.36, 1.4, 1.44, 1.48, 1.51, 1.54];

//同じ効果音が短時間に重なりすぎないよう、最低この間隔(秒)をあける
const SE_INTERVAL = {
    shot:0.045, typing:0.04, water:0.07, steam:0.08, hit:0.035, kill:0.03, blade:0.04, zap:0.06, explode:0.05,
    part:0.025, graze:0.04, enemyShot:0.06, mine:0.08, bug:0.08, dash:0.1, bossShot:0.05, summon:0.1, dragonBite:0.05
};

//BGMの曲データ
//prog:1小節ごとのコード[ルート音(MIDI番号), 種類]  各パターンは16分音符16個で1小節
//lead:8分音符ごとのメロディ(MIDI番号、0は休み)。8小節分
const CHORD_TONES = { "M":[0,4,7], "m":[0,3,7], "M7":[0,4,7,11], "m7":[0,3,7,10] };
const TRACKS = {
    //タイトル・序盤のストーリー：明るく穏やかな Cmaj7 - Fmaj7 - Am7 - G
    title:{
        bpm:88,
        prog:[[48,"M7"],[41,"M7"],[45,"m7"],[43,"M"]],
        bass:"x.......x.......", bassType:"triangle", bassVol:0.22, bassOctUp:false,
        arp:"x.x.x.x.x.x.x.x.", arpOct:24, arpType:"triangle", arpVol:0.05,
        pad:0.025,
        kick:"x...............", snare:"................", hat:"....x.......x...",
        lead:null
    },
    //中盤のストーリー・エンディング：不安な Am7 - Fmaj7 - C - G
    unease:{
        bpm:84,
        prog:[[45,"m7"],[41,"M7"],[48,"M"],[43,"M"]],
        bass:"x.......x.......", bassType:"triangle", bassVol:0.22, bassOctUp:false,
        arp:"x.x.x.x.x.x.x.x.", arpOct:24, arpType:"triangle", arpVol:0.05,
        pad:0.025,
        kick:"x...............", snare:"................", hat:"....x.......x...",
        lead:null
    },
    //序盤の戦闘(WAVE1～7)：意気揚々な C - G - Am - F - C - G - F - G
    heroic:{
        bpm:150,
        prog:[[48,"M"],[43,"M"],[45,"m"],[41,"M"],[48,"M"],[43,"M"],[41,"M"],[43,"M"]],
        bass:"x.x.x.xxx.x.x.xx", bassType:"sawtooth", bassVol:0.12, bassOctUp:true,
        arp:"xxxxxxxxxxxxxxxx", arpOct:24, arpType:"square", arpVol:0.016,
        pad:0,
        kick:"x...x...x...x...", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.",
        lead:[
            72,0,76,0,79,0,84,0,
            83,0,79,0,74,0,79,0,
            81,0,84,0,88,0,84,81,
            77,0,81,0,84,0,81,0,
            79,0,79,81,79,0,76,0,
            74,0,79,0,83,0,86,0,
            84,0,81,77,0,81,0,84,
            86,0,0,0,83,0,79,0
        ]
    },
    //中盤の戦闘(WAVE8～15)：緊迫した Am - Am - F - G - Dm - Dm - E - E
    battle:{
        bpm:138,
        prog:[[45,"m"],[45,"m"],[41,"M"],[43,"M"],[38,"m"],[38,"m"],[40,"M"],[40,"M"]],
        bass:"x.xxx.xxx.xxx.xx", bassType:"sawtooth", bassVol:0.13, bassOctUp:true,
        arp:"xxxxxxxxxxxxxxxx", arpOct:24, arpType:"square", arpVol:0.018,
        pad:0,
        kick:"x...x...x...x...", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.",
        lead:[
            69,0,72,0,76,74,72,0,
            76,0,0,74,72,0,69,0,
            69,0,72,0,77,0,76,0,
            74,0,71,0,67,0,71,74,
            77,0,76,74,0,69,0,0,
            74,0,77,0,81,0,79,77,
            76,0,0,0,80,0,83,0,
            80,0,76,0,71,0,68,0
        ]
    },
    //ボス戦：Dm - Dm - B♭ - C - Dm - Dm - A - A(速く激しく)
    boss:{
        bpm:152,
        prog:[[38,"m"],[38,"m"],[46,"M"],[48,"M"],[38,"m"],[38,"m"],[45,"M"],[45,"M"]],
        bass:"xxxxxxxxxxxxxxxx", bassType:"sawtooth", bassVol:0.12, bassOctUp:true,
        arp:"x.xx.xx.x.xx.xx.", arpOct:24, arpType:"square", arpVol:0.02,
        pad:0,
        kick:"x..x..x.x..x..x.", snare:"....x.......x..x", hat:"x.x.x.x.x.x.x.x.",
        lead:[
            74,0,74,77,0,81,0,77,
            74,0,72,0,69,0,72,74,
            70,0,74,0,77,0,74,70,
            72,0,76,0,79,0,76,72,
            81,0,79,77,0,76,0,74,
            77,0,76,74,0,72,0,69,
            73,0,76,0,81,0,76,73,
            69,0,73,0,76,0,79,81
        ]
    },
    //人間との戦い(WAVE16～)：Em - Em - C - D - Em - Em - B - B(戦闘曲のメロディを低く暗く)
    revolt:{
        bpm:146,
        prog:[[40,"m"],[40,"m"],[36,"M"],[38,"M"],[40,"m"],[40,"m"],[35,"M"],[35,"M"]],
        bass:"x.xxx.xxx.xxx.xx", bassType:"sawtooth", bassVol:0.14, bassOctUp:true,
        arp:"x.xx.xx.x.xx.xx.", arpOct:24, arpType:"square", arpVol:0.018,
        pad:0.012,
        kick:"x..x..x.x..x..x.", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.",
        lead:[
            64,0,67,0,71,69,67,0,
            71,0,0,69,67,0,64,0,
            64,0,67,0,72,0,71,0,
            69,0,66,0,62,0,66,69,
            72,0,71,69,0,64,0,0,
            69,0,72,0,76,0,74,72,
            71,0,0,0,75,0,78,0,
            75,0,71,0,66,0,63,0
        ]
    },
    //強化画面：Fmaj7 - Em7 - Dm7 - Cmaj7
    shop:{
        bpm:96,
        prog:[[41,"M7"],[40,"m7"],[38,"m7"],[48,"M7"]],
        bass:"x.....x...x.....", bassType:"sine", bassVol:0.3, bassOctUp:false,
        arp:"x..x..x.x..x..x.", arpOct:24, arpType:"triangle", arpVol:0.05,
        pad:0.02,
        kick:"x.........x.....", snare:"................", hat:"..x...x...x...x.",
        lead:null
    }
};

var sound = {
    ctx:null,
    master:null, bgmGain:null, seGain:null,
    noiseBuf:null,
    bgmOn:true,
    seOn:true,
    ducked:false,
    last:{},        //効果音ごとの最後に鳴らした時刻
    partCombo:0,    //パーツを続けて拾うと音程が上がる
    partTime:0,

    //BGMの再生状態
    track:null,
    trackName:null,
    step:0,
    bar:0,
    arpIndex:0,
    nextTime:0,
    bpm:120,
    wantTrack:null, //音が使えるようになる前に指定された曲

    //------------------------------------------------------------ 準備
    load:function(){
        try{
            var s = JSON.parse(localStorage.getItem("dronekun_sound"));
            if(s){ this.bgmOn = s.bgm !== false; this.seOn = s.se !== false; }
        }catch(e){}
    },
    saveSetting:function(){
        try{ localStorage.setItem("dronekun_sound", JSON.stringify({ bgm:this.bgmOn, se:this.seOn })); }catch(e){}
    },

    //最初のクリック・キー入力で呼ぶ
    unlock:function(){
        if(!this.ctx){
            var AC = window.AudioContext || window.webkitAudioContext;
            if(!AC) return;
            this.ctx = new AC();
            var c = this.ctx;
            //音割れしないようコンプレッサーを通す
            var comp = c.createDynamicsCompressor();
            comp.connect(c.destination);
            this.master = c.createGain();
            this.master.gain.value = 0.9;
            this.master.connect(comp);
            this.bgmGain = c.createGain();
            this.bgmGain.gain.value = this.bgmOn ? BGM_VOLUME : 0;
            this.bgmGain.connect(this.master);
            this.seGain = c.createGain();
            this.seGain.gain.value = this.seOn ? SE_VOLUME : 0;
            this.seGain.connect(this.master);
            //ノイズ(爆発・ハイハットなど)の元
            this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
            var d = this.noiseBuf.getChannelData(0);
            for(var i=0; i<d.length; i++) d[i] = Math.random()*2 - 1;
            var self = this;
            setInterval(function(){ self.schedule(); }, 25);
        }
        //音が使えるようになってから、待っていた曲を流す(resumeは非同期)
        var self = this;
        var start = function(){
            if(self.wantTrack !== null && self.ready()){
                var w = self.wantTrack;
                self.wantTrack = null;
                self.music(w.name, w.bpm);
            }
        };
        if(this.ctx.state == "suspended") this.ctx.resume().then(start);
        else start();
    },
    ready:function(){
        return this.ctx && this.ctx.state == "running";
    },

    //------------------------------------------------------------ 音の部品
    freq:function(_midi){
        return 440 * Math.pow(2, (_midi - 69)/12);
    },
    //発振器1つ分の音。_f1を指定すると音程が_f0から_f1へ変化する
    tone:function(_type,_f0,_f1,_dur,_vol,_dest,_when,_attack,_cutoff){
        var c = this.ctx;
        var t = _when || c.currentTime;
        var a = _attack || 0.005;
        var o = c.createOscillator();
        o.type = _type;
        o.frequency.setValueAtTime(_f0, t);
        if(_f1 && _f1 != _f0) o.frequency.exponentialRampToValueAtTime(_f1, t + _dur);
        var g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(_vol, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + a + _dur);
        if(_cutoff){
            var f = c.createBiquadFilter();
            f.type = "lowpass";
            f.frequency.value = _cutoff;
            o.connect(f); f.connect(g);
        }else{
            o.connect(g);
        }
        g.connect(_dest);
        o.start(t);
        o.stop(t + a + _dur + 0.05);
    },
    //ノイズ。フィルターの周波数を_f0から_f1へ動かす
    noise:function(_dur,_vol,_filter,_f0,_f1,_dest,_when){
        var c = this.ctx;
        var t = _when || c.currentTime;
        var s = c.createBufferSource();
        s.buffer = this.noiseBuf;
        var f = c.createBiquadFilter();
        f.type = _filter;
        f.frequency.setValueAtTime(_f0, t);
        if(_f1 && _f1 != _f0) f.frequency.exponentialRampToValueAtTime(_f1, t + _dur);
        var g = c.createGain();
        g.gain.setValueAtTime(_vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + _dur);
        s.connect(f); f.connect(g); g.connect(_dest);
        s.start(t, Math.random()*0.5);
        s.stop(t + _dur + 0.05);
    },
    //重い衝撃音(エンジンのような低いうなりを少し含む)。ボスの着地に使う
    //  重低音(沈んでいく)＋ずらして重ねた低いのこぎり波(うなり)＋こもった轟き＋頭の破裂音とパンチ
    //  小さなスピーカーでも重さが伝わるよう、軽く歪ませて倍音を足す
    heavyBoom:function(_dest){
        var c = this.ctx, t = c.currentTime;
        var end = t + HEAVY_BOOM_LEN;
        var out = c.createGain();
        out.gain.value = 0.6;
        out.connect(_dest);
        var drive = c.createWaveShaper();
        if(!this.driveCurve){
            //tanh の形：大きな音ほどなめらかに頭打ちになる
            var n = 1024, curve = new Float32Array(n), k = 2.5;
            for(var i=0; i<n; i++){ var x = i*2/(n - 1) - 1; curve[i] = Math.tanh(k*x)/Math.tanh(k); }
            this.driveCurve = curve;
        }
        drive.curve = this.driveCurve;
        drive.connect(out);
        //音量の形：すっと立ち上がり、少し保って、ゆっくり消える
        var env = function(_v,_hold,_decay){
            var g = c.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(_v, t + 0.012);
            g.gain.setValueAtTime(_v, t + _hold);
            g.gain.exponentialRampToValueAtTime(0.0001, t + _hold + _decay);
            return g;
        };
        //1. 重低音
        var sub = c.createOscillator();
        sub.type = "sine";
        sub.frequency.setValueAtTime(100, t);
        sub.frequency.exponentialRampToValueAtTime(30, t + 1.15);
        var subG = env(0.8, 0.15, 1.3);
        sub.connect(subG); subG.connect(drive);
        //2. エンジンのうなり(少しずつずらした低い音が干渉して「ウォンウォン」と揺れる)
        var lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.Q.value = 7;
        lp.frequency.setValueAtTime(1400, t);
        lp.frequency.exponentialRampToValueAtTime(150, t + 1.3);
        var lfo = c.createOscillator(), lfoG = c.createGain();
        lfo.frequency.setValueAtTime(9, t);
        lfo.frequency.linearRampToValueAtTime(5, t + 1.3);
        lfoG.gain.value = 60;
        lfo.connect(lfoG); lfoG.connect(lp.frequency);
        var engG = env(0.22, 0.24, 1.1);
        lp.connect(engG); engG.connect(drive);
        var oscs = [sub, lfo];
        [55, 55.8, 82.6, 41.2].forEach(function(f){
            var o = c.createOscillator();
            o.type = "sawtooth";
            o.frequency.setValueAtTime(f, t);
            o.frequency.exponentialRampToValueAtTime(f*0.75, t + 1.3);
            o.connect(lp);
            oscs.push(o);
        });
        //3. こもった轟き
        var ns = c.createBufferSource();
        ns.buffer = this.noiseBuf;
        ns.loop = true;
        var nf = c.createBiquadFilter();
        nf.type = "lowpass";
        nf.frequency.setValueAtTime(900, t);
        nf.frequency.exponentialRampToValueAtTime(70, t + 1.15);
        var nG = env(0.55, 0.04, 1.2);
        ns.connect(nf); nf.connect(nG); nG.connect(out);
        oscs.push(ns);
        //4. 頭の破裂音と「ドン」のパンチ
        this.noise(0.07, 0.45, "highpass", 2200, 700, out);
        this.tone("square", 240, 40, 0.16, 0.16, out, 0, 0, 1400);
        for(var i=0; i<oscs.length; i++){ oscs[i].start(t); oscs[i].stop(end); }
    },

    //ドローン君改の始動音：リレーが「カチッ…カチッ、カチカチカチ」と間隔を詰めて入っていく(KAI_RELAYS)
    //  カチッと入るたびに、低い電気のうなりが1段ずつ大きくなる(電源が順に入っていく)
    kaiBoot:function(_dest){
        var c = this.ctx, t = c.currentTime, L = KAI_BOOT_LEN;
        for(var i=0; i<KAI_RELAYS.length; i++){
            this.relayClick(_dest, t + KAI_RELAYS[i], i);
        }
        //電気のうなり(50Hz・100Hz)。リレーが入るたびに段々大きく
        var hum = c.createGain();
        hum.gain.setValueAtTime(0.0001, t);
        for(var i=0; i<KAI_RELAYS.length; i++){
            hum.gain.setValueAtTime(0.0001 + 0.12*(i + 1)/KAI_RELAYS.length, t + KAI_RELAYS[i] + 0.01);
        }
        hum.gain.setValueAtTime(0.12, t + L - 0.03);
        hum.gain.exponentialRampToValueAtTime(0.0001, t + L + 0.04);
        var lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 400;
        lp.connect(hum); hum.connect(_dest);
        [[50,"sine",1],[100,"sawtooth",0.35]].forEach(function(h){
            var o = c.createOscillator(), g = c.createGain();
            o.type = h[1];
            o.frequency.value = h[0];
            g.gain.value = h[2];
            o.connect(g); g.connect(lp);
            o.start(t); o.stop(t + L + 0.1);
        });
    },
    //リレーの「カチッ」：接点が閉じる鋭い音＋小さな「コッ」＋すぐあとの跳ね返り
    relayClick:function(_dest,_when,_i){
        var pitch = 1 + ((_i*37) % 7 - 3)*0.05;    //1つずつ少し高さを変える(決まった並びで)
        this.noise(0.014, 0.6, "bandpass", 3200*pitch, 2400*pitch, _dest, _when);
        this.tone("square", 1300*pitch, 900*pitch, 0.012, 0.09, _dest, _when, 0.001, 5000);
        this.tone("sine", 190*pitch, 120*pitch, 0.03, 0.26, _dest, _when, 0.001);
        this.noise(0.008, 0.22, "bandpass", 2600*pitch, 2200*pitch, _dest, _when + 0.016);
    },

    //短いフレーズ(ジングル)
    jingle:function(_notes,_gap,_type,_vol,_len){
        var t = this.ctx.currentTime;
        for(var i=0; i<_notes.length; i++){
            if(_notes[i]) this.tone(_type, this.freq(_notes[i]), 0, _len || _gap*0.9, _vol, this.seGain, t + i*_gap, 0.01, 3000);
        }
    },

    //------------------------------------------------------------ 効果音
    play:function(_name){
        if(!this.seOn || !this.ready()) return;
        var now = this.ctx.currentTime;
        var min = SE_INTERVAL[_name] || 0;
        if(this.last[_name] && now - this.last[_name] < min) return;
        this.last[_name] = now;
        var S = this.seGain;
        switch(_name){
            //装備
            case "shot":    this.tone("square",900,420,0.05,0.07,S,0,0,2500); break;
            case "missile": this.noise(0.28,0.12,"bandpass",700,2800,S); this.tone("sawtooth",180,520,0.2,0.04,S,0,0,1500); break;
            case "laser":   this.tone("sawtooth",1800,180,0.28,0.11,S); this.tone("square",900,90,0.28,0.05,S,0,0,2000); break;
            case "bug":     this.tone("triangle",1200,2400,0.07,0.08,S); this.tone("triangle",1500,2800,0.06,0.06,S,now + 0.08); break;
            case "zap":
                for(var i=0; i<5; i++){
                    var f = 500 + Math.random()*1800;
                    this.tone("square",f,f*0.7,0.025,0.05,S,now + i*0.022,0,3500);
                }
                break;
            case "mine":    this.tone("square",320,320,0.03,0.05,S,0,0,1500); this.tone("square",640,640,0.03,0.04,S,now + 0.05,0,1500); break;
            case "blade":   this.tone("triangle",2200,1500,0.045,0.06,S); break;
            case "water":   this.noise(0.07,0.05,"bandpass",2500,1500,S); break;
            case "steam":   this.noise(0.6,0.22,"highpass",1200,3000,S); this.tone("sine",220,90,0.3,0.12,S); break;
            case "emp":     this.tone("sine",700,55,0.5,0.25,S); this.noise(0.4,0.06,"lowpass",1500,200,S); break;
            case "explode": this.noise(0.5,0.35,"lowpass",1400,70,S); this.tone("sine",130,38,0.4,0.28,S); break;
            //敵
            case "hit":       this.tone("square",240,170,0.03,0.04,S,0,0,1800); break;
            case "kill":      this.noise(0.14,0.13,"bandpass",2200,400,S); this.tone("square",520,120,0.1,0.05,S,0,0,2000); break;
            case "enemyShot": this.tone("square",520,300,0.07,0.035,S,0,0,1800); break;
            case "dash":      this.tone("sawtooth",260,900,0.22,0.05,S,0,0,1800); break;
            //ドローン
            case "damage":    this.tone("sawtooth",170,55,0.3,0.22,S,0,0,1200); this.noise(0.25,0.15,"lowpass",900,120,S); break;
            case "destroyed":
                this.noise(1.0,0.4,"lowpass",2000,50,S);
                this.tone("sawtooth",420,35,1.1,0.15,S,0,0,1500);
                break;
            case "blast":     this.noise(0.45,0.28,"lowpass",3500,180,S); this.tone("sine",220,45,0.4,0.32,S); break;
            case "error":     this.tone("square",196,196,0.07,0.05,S,0,0,1200); this.tone("square",196,196,0.07,0.05,S,now + 0.11,0,1200); break;
            case "part":
                //続けて拾うほど音程が上がる
                this.partCombo = (now - this.partTime < 0.45) ? Math.min(this.partCombo + 1, 12) : 0;
                this.partTime = now;
                this.tone("triangle",this.freq(84 + this.partCombo),0,0.07,0.07,S);
                break;
            case "fuel":      this.tone("triangle",660,1320,0.16,0.08,S); break;
            case "graze":     this.tone("triangle",2400,2000,0.03,0.035,S); break;
            //五龍の衝撃波：陣が浮かぶ音＋低くうなる咆哮
            case "dragon":
                this.jingle([72,79,84,91,96],0.035,"triangle",0.07,0.12);
                this.tone("sawtooth",110,48,0.95,0.16,S,now + 0.08,0.06,700);
                this.tone("sawtooth",117,52,0.95,0.12,S,now + 0.08,0.06,700);
                this.noise(0.9,0.14,"bandpass",700,180,S,now + 0.08);
                break;
            case "dragonBite":  this.tone("square",420,110,0.14,0.08,S,0,0,1600); this.noise(0.18,0.14,"lowpass",2500,300,S); break;
            case "dragonFinale":
                this.noise(1.4,0.45,"lowpass",3500,50,S);
                this.tone("sine",180,30,1.2,0.35,S);
                this.jingle([84,0,88,91,96],0.07,"triangle",0.05,0.2);
                break;
            //ストーリー
            case "glitch":
                for(var i=0; i<4; i++){
                    this.noise(0.06,0.18,"bandpass",800 + Math.random()*3000,200 + Math.random()*800,S,now + i*0.07 + Math.random()*0.03);
                }
                this.tone("square",60,40,0.3,0.08,S,0,0,800);
                break;
            case "typing":    this.tone("square",1400 + Math.random()*300,0,0.015,0.015,S,0,0,3000); break;
            //シナジー発動(きらっと上がる音)
            case "synergy":
                this.jingle([84,91,96],0.035,"triangle",0.07,0.1);
                this.noise(0.25,0.05,"highpass",6000,9000,S);
                break;
            //レア敵・ボス
            case "rare":      this.jingle([88,91,96,100],0.05,"triangle",0.07,0.12); break;
            case "warning":
                //サイレン(高低を2回ずつ)
                for(var i=0; i<4; i++){
                    this.tone("square",i % 2 ? 660 : 880,0,0.2,0.05,S,now + i*0.24,0.01,2000);
                }
                break;
            //ボスの接近(地鳴り)・登場(うなり声)・着地(重い衝撃)
            //地鳴り(ゴゴゴ)。短くして何度も鳴らし、「ッ」で途切れるようにする
            case "rumble":
                this.tone("sine",50,40,0.75,0.3,S,0,0.15);
                this.tone("sawtooth",38,32,0.75,0.08,S,0,0.15,220);
                this.noise(0.75,0.14,"lowpass",300,110,S);
                break;
            case "rumbleHard":
                this.tone("sine",56,42,0.62,0.42,S,0,0.08);
                this.tone("sawtooth",42,34,0.62,0.13,S,0,0.08,260);
                this.noise(0.62,0.22,"lowpass",420,130,S);
                break;
            //ドローン君改の登場：ゆっくりな心臓の鼓動(ドクン)・始動音・点火(ヴォン)
            case "heartbeat":
                this.tone("sine",72,44,0.15,0.7,S,0,0.004,300);
                this.noise(0.1,0.18,"lowpass",160,60,S);
                this.tone("sine",64,40,0.13,0.5,S,now + 0.22,0.004,300);
                break;
            case "kaiBoot":   this.kaiBoot(S); break;
            case "kaiIgnite":
                this.noise(0.7,0.5,"lowpass",2600,80,S);
                this.tone("sawtooth",150,58,0.6,0.2,S,0,0,900);
                this.tone("sine",95,38,0.7,0.5,S);
                this.tone("triangle",2400,1800,0.45,0.05,S);
                break;
            case "bossAppear":
                this.tone("sawtooth",150,62,1.1,0.16,S,0,0.05,700);
                this.tone("sawtooth",158,66,1.1,0.12,S,0,0.05,700);
                this.noise(1.0,0.16,"bandpass",500,140,S);
                break;
            //着地(ドンっ)：低いうなりを含む重い衝撃(heavyBoom)
            case "bossImpact": this.heavyBoom(S); break;
            case "summon":    this.tone("triangle",600,1400,0.12,0.06,S); this.tone("triangle",700,1600,0.12,0.05,S,now + 0.1); break;
            case "bossShot":  this.tone("square",300,160,0.08,0.05,S,0,0,1400); break;
            case "beamCharge":this.tone("sawtooth",120,900,1.1,0.06,S,0,0.05,1800); break;
            case "beam":      this.tone("sawtooth",110,90,0.8,0.14,S,0,0.01,900); this.noise(0.8,0.12,"bandpass",1600,600,S); break;
            case "bossDown":
                this.noise(1.6,0.45,"lowpass",2500,40,S);
                this.tone("sine",160,30,1.4,0.35,S);
                this.jingle([0,0,0,0,72,76,79,84],0.12,"square",0.05,0.25);
                break;
            //進行
            case "waveStart": this.jingle([69,72,76,81],0.09,"square",0.05); break;
            case "clear":     this.jingle([72,76,79,84,0,79,84],0.1,"square",0.06,0.16); break;
            case "gameover":  this.jingle([76,0,74,0,72,0,69],0.16,"triangle",0.1,0.3); break;
            case "reward":    this.jingle([79,83,86,91],0.06,"triangle",0.08); break;
            //画面の操作
            case "click":     this.tone("square",880,880,0.03,0.04,S,0,0,2500); break;
            case "hover":     this.tone("triangle",1500,1700,0.025,0.025,S,0,0,4000); break;   //タイトルのメニューにマウスが乗った
            case "buy":       this.tone("triangle",660,660,0.06,0.08,S); this.tone("triangle",990,990,0.1,0.08,S,now + 0.07); break;
        }
    },

    //------------------------------------------------------------ BGM
    //_name：TRACKSの名前。nullで止める
    music:function(_name,_bpm){
        if(!this.ready()){
            this.wantTrack = { name:_name, bpm:_bpm };
            return;
        }
        if(_name == this.trackName && this.track) return;
        this.trackName = _name;
        this.track = _name ? TRACKS[_name] : null;
        this.bpm = _bpm || (this.track ? this.track.bpm : 120);
        this.step = 0;
        this.bar = 0;
        this.arpIndex = 0;
        this.nextTime = this.ctx.currentTime + 0.08;
    },
    stopMusic:function(){
        if(this.wantTrack !== null) this.wantTrack = { name:null };
        this.trackName = null;
        this.track = null;
    },

    //少し先までの音符を予約する
    schedule:function(){
        if(!this.track || !this.ready()) return;
        var stepTime = 60 / this.bpm / 4;
        //タブを切り替えて戻ったときなどに一気に鳴らさない
        if(this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
        while(this.nextTime < this.ctx.currentTime + 0.12){
            this.playStep(this.nextTime, stepTime);
            this.nextTime += stepTime;
            this.step++;
            if(this.step >= 16){ this.step = 0; this.bar++; }
        }
    },

    playStep:function(_t,_st){
        var T = this.track, s = this.step, B = this.bgmGain;
        var chord = T.prog[this.bar % T.prog.length];
        var root = chord[0], tones = CHORD_TONES[chord[1]];

        //ベース
        if(T.bass.charAt(s) == "x"){
            var n = root + ((T.bassOctUp && s % 4 == 2) ? 12 : 0);
            this.tone(T.bassType, this.freq(n), 0, _st*1.6, T.bassVol, B, _t, 0.005, 700);
        }
        //アルペジオ
        if(T.arp.charAt(s) == "x"){
            var k = this.arpIndex++;
            var n = root + T.arpOct + tones[k % tones.length] + (Math.floor(k / tones.length) % 2) * 12;
            this.tone(T.arpType, this.freq(n), 0, _st*0.9, T.arpVol, B, _t, 0.005, 2400);
        }
        //和音(小節の頭で長く鳴らす)
        if(T.pad && s == 0){
            for(var i=0; i<tones.length; i++){
                this.tone("sine", this.freq(root + 24 + tones[i]), 0, _st*15, T.pad, B, _t, 0.25);
            }
        }
        //ドラム
        if(T.kick.charAt(s) == "x"){
            this.tone("sine", 150, 40, 0.14, 0.5, B, _t);
        }
        if(T.snare.charAt(s) == "x"){
            this.noise(0.14, 0.22, "highpass", 1200, 1200, B, _t);
            this.tone("triangle", 190, 150, 0.06, 0.12, B, _t);
        }
        if(T.hat.charAt(s) == "x"){
            this.noise(0.035, 0.07, "highpass", 7000, 7000, B, _t);
        }
        //メロディ(8分音符ごと)
        if(T.lead && s % 2 == 0){
            var n = T.lead[((this.bar % 8) * 8 + s/2) % T.lead.length];
            if(n) this.tone("square", this.freq(n), 0, _st*1.7, 0.035, B, _t, 0.01, 2600);
        }
    },

    //画面が変わったとき(page.changeから呼ばれる)
    onPage:function(_i){
        this.duck(false);
        switch(_i){
            case 0: this.music("title"); break;
            case 1:
                //WAVEが進むほどテンポが上がる。人間との戦いでは曲が変わる
                this.music(null);
                //序盤は明るく、同胞が増えてくる中盤から緊迫、人間との戦いでは暗い曲
                if(game.wave > REVEAL_WAVE) this.music("revolt");
                else if(game.wave < 8) this.music("heroic", TRACKS.heroic.bpm + (game.wave - 1)*2);
                else this.music("battle", TRACKS.battle.bpm + Math.min(game.wave - 1, 10) * 2);
                this.play("waveStart");
                break;
            case 2: this.music(game.wave > REVEAL_WAVE ? "revolt" : "shop"); break;
            case 3: this.stopMusic(); this.play("gameover"); break;
            case 4: break;  //ストーリーは行ごとに曲を決める(story.js)
            case 5: this.music("title"); break;
            case 6: this.music("title"); break;
        }
    },

    //一時停止中はBGMを小さくする
    duck:function(_on){
        if(_on == this.ducked) return;
        this.ducked = _on;
        this.applyVolume();
    },
    applyVolume:function(){
        if(!this.ctx) return;
        var t = this.ctx.currentTime;
        this.bgmGain.gain.setTargetAtTime(this.bgmOn ? (this.ducked ? BGM_VOLUME*0.3 : BGM_VOLUME) : 0, t, 0.05);
        this.seGain.gain.setTargetAtTime(this.seOn ? SE_VOLUME : 0, t, 0.02);
    },
    toggle:function(_which){
        if(_which == "bgm") this.bgmOn = !this.bgmOn;
        else this.seOn = !this.seOn;
        this.saveSetting();
        this.applyVolume();
    },

    //------------------------------------------------------------ 画面右下のON/OFFボタン
    buttons:[
        { key:"bgm", label:"BGM", rect:new drawRect(CW - 102, CH - 30, 50, 22) },
        { key:"se",  label:"SE",  rect:new drawRect(CW - 44,  CH - 30, 40, 22) }
    ],
    //戦闘中のタッチ用：座標がボタンの上ならON/OFFしてtrue
    tapButton:function(_x,_y){
        for(var i=0; i<this.buttons.length; i++){
            if(this.buttons[i].rect.contains(_x,_y)){
                this.toggle(this.buttons[i].key);
                return true;
            }
        }
        return false;
    },
    //ボタンが押されたらtrue(そのクリックはゲームに渡さない)
    handleClick:function(){
        //戦闘中のタッチはtapButtonで処理済み(MouseXは指の位置ではないので見ない)
        if(isTouchDrag()) return false;
        for(var i=0; i<this.buttons.length; i++){
            if(this.buttons[i].rect.clicked()){
                this.toggle(this.buttons[i].key);
                return true;
            }
        }
        return false;
    },
    draw:function(){
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for(var i=0; i<this.buttons.length; i++){
            var b = this.buttons[i], r = b.rect;
            var on = b.key == "bgm" ? this.bgmOn : this.seOn;
            var hover = r.contains(MouseX,MouseY);
            ctx.fillStyle = on ? (hover ? "#555" : "#333") : (hover ? "#eee" : "rgba(255,255,255,0.8)");
            ctx.fillRect(r.X, r.Y, r.width, r.height);
            ctx.strokeStyle = on ? "#333" : "#aaa";
            ctx.strokeRect(r.X + 0.5, r.Y + 0.5, r.width - 1, r.height - 1);
            ctx.fillStyle = on ? "#fff" : "#aaa";
            ctx.fillText(b.label, r.X + r.width/2, r.Y + r.height/2 + 1);
            if(!on){
                ctx.strokeStyle = "#aaa";
                ctx.beginPath();
                ctx.moveTo(r.X + 4, r.Y + r.height - 4);
                ctx.lineTo(r.X + r.width - 4, r.Y + 4);
                ctx.stroke();
            }
        }
        //まだ音が出せない(一度もクリックしていない)ときの案内
        if(!this.ready() && (this.bgmOn || this.seOn)){
            ctx.textAlign = "right";
            ctx.fillStyle = "#888";
            ctx.fillText(inputMode == "touch" ? "タップで音が鳴ります" : "クリックで音が鳴ります", CW - 140, CH - 19);
        }
        ctx.fillStyle = "#000";
    }
};
sound.load();

//最初の操作で音を使えるようにする(スマホのブラウザは指を離したときでないと許可されないことがある)
canvas.addEventListener("pointerdown", function(){ sound.unlock(); }, false);
canvas.addEventListener("pointerup", function(){ sound.unlock(); }, false);
canvas.addEventListener("touchend", function(){ sound.unlock(); }, false);
document.addEventListener("keydown", function(e){
    sound.unlock();
    //Mキー：BGM・効果音をまとめてON/OFF
    if(e.code == "KeyM"){
        var on = !(sound.bgmOn || sound.seOn);
        sound.bgmOn = on;
        sound.seOn = on;
        sound.saveSetting();
        sound.applyVolume();
    }
}, false);
//タブを切り替えている間は止める
document.addEventListener("visibilitychange", function(){
    if(!sound.ctx) return;
    if(document.hidden) sound.ctx.suspend();
    else sound.ctx.resume();
}, false);
