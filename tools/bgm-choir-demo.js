//------------------------------------------------------------------------------
//  コーラス入りの試作曲(ゲームでは使わない。試聴ページ用)。bgmFull.js のあとに読み込み、BGM_FULL に足す
//    omen     怪談風(パラノマサイトの雰囲気を参考に新しく書いた)：都節寄りの音階、ささやく女声と「ウー→アー」とふくらむ合唱
//    confront 対峙(ゼノブレイドの雰囲気を参考に新しく書いた)：ニ短調の速い戦闘曲、男声の刻む合唱と、山場で高くのびる女声
//  書き方は bgmFull.js の先頭(choir・chant)を参照
//------------------------------------------------------------------------------
BGM_FULL.omen = {
    bpm:100, gain:0.85, intro:["I"], loop:["A","B","C","T"],
    sec:{
        //ささやきの合唱と太鼓だけで始まる
        I:{ bars:4, chords:"Em|F|Em|F", body:0,
            choir:{ type:"whisper", vowel:"u", to:"a", lo:64, vol:0.09, attack:0.8 },
            bass:"1...............", bassType:"triangle", bassVol:0.18,
            kick:"X...............", tom:"........l......." },
        A:{ bars:8, chords:"Em|F|Em|F|Am|G|F|E",
            lead:"o5 e4. f8 a4 b4 | o6 c2 o5 b4 a4 | b4. a8 f4 e4 | f2. r4 | a4. b8 o6 c4 e4 | d2 c4 o5 b4 | a4. b8 o6 c4 o5 a4 | b2 g+4 f4 |",
            leadCut:1800, leadVol:0.03,
            choir:{ type:"female", vowel:"u", lo:64, vol:0.035, attack:0.6 },
            arp:"0.2.1.3.0.2.1.3.", arpType:"triangle", arpVol:0.04, arpLen:1.4,
            bass:"1.....1.5.....8.", bassType:"sawtooth", bassVol:0.11,
            kick:"x.......x..x....", snare:"....g.......x...", hat:"..x...x...x...x.", fill:"soft" },
        //合唱が「ウー」から「アー」へふくらみ、男声が下から支える
        B:{ bars:8, chords:"Am|Am|F|F|Dm|Dm|E|E",
            lead:"o5 e2 a2 | o6 c2. o5 b4 | a2 o6 c2 | o5 b1 | a2 f2 | d2 e4 f4 | g+2 b2 | o6 e1 |",
            leadType:"triangle", leadVol:0.05,
            choir:[{ type:"female", vowel:"u", to:"a", lo:62, vol:0.05, attack:0.5 },
                   { type:"male", vowel:"o", lo:48, vol:0.045, attack:0.5 }],
            arp:"0...1...2...3...", arpType:"triangle", arpVol:0.04, arpLen:2,
            bass:"1.......5.......", bassType:"sawtooth", bassVol:0.11,
            kick:"x.......x.......", snare:"............x...", fill:"toms", riser:2 },
        //サビ：男声・女声の「アー」で和音を鳴らし、刻みと太鼓で進む
        C:{ bars:8, chords:"Am|F|G|Em|Am|F|Dm|E",
            lead:"o6 e2 c4 o5 b4 | a2 o6 c4 e4 | d2 o5 b4 g4 | b2 a4 g4 | o6 e2 f4 e4 | c2 o5 a4 o6 c4 | d4. c8 o5 a4 f4 | g+2 b2 |",
            leadVol:0.032, leadCut:2200, dbl:-12,
            choir:[{ type:"female", vowel:"a", lo:64, vol:0.05, attack:0.3 },
                   { type:"male", vowel:"a", lo:48, vol:0.045, attack:0.3 }],
            stab:"x.....x.....x...",
            bass:"1..1..1.1..1..1.", bassType:"sawtooth", bassVol:0.12,
            kick:"x..x..x.x...x...", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.", crash:true, fill:"snare" },
        //ささやきが旋律を歌って、はじめへ戻る
        T:{ bars:4, chords:"Em|F|Em|E", body:0,
            choir:{ type:"whisper", vowel:"u", lo:64, vol:0.07, attack:0.8 },
            chant:{ mml:"o5 e2. f4 | e1 | b2. a4 | g+1 |", type:"whisper", vowel:"u", to:"a", vol:0.1, attack:0.3 },
            bass:"1...............", bassType:"triangle", bassVol:0.18,
            kick:"X...............", tom:"............l.l." }
    }
};

BGM_FULL.confront = {
    bpm:152, intro:["I"], loop:["A","B","C","D"],
    sec:{
        //刻む低音と、男声の「アッ」の刻み
        I:{ bars:4, chords:"Dm|Dm|Bb|A",
            choir:{ type:"male", vowel:"a", lo:50, vol:0.075, attack:0.02, pat:"x..x..x.x..x..x." },
            bass:"1181118111811181", bassType:"sawtooth", bassVol:0.12,
            kick:"x..x..x.x..x..x.", crash:true, fill:"toms", riser:2 },
        A:{ bars:8, chords:"Dm|Bb|C|Dm|Dm|Bb|Gm|A",
            lead:"o5 d4 a4 g8 f8 e8 f8 | d2 f4 b-4 | g4. a8 g4 e4 | f2 d2 | d4 a4 o6 c8 o5 b-8 a8 g8 | f2 b-4 o6 d4 | o5 b-4. a8 g4 b-4 | a2 c+4 e4 |",
            choir:{ type:"male", vowel:"o", lo:48, vol:0.06, attack:0.05, pat:"x.......x......." },
            arp:"0123450123450123", arpType:"square", arpVol:0.015,
            bass:"1-811-811-811-81", bassType:"sawtooth", bassVol:0.12,
            kick:"x...x...x...x...", snare:"....x.......x...", hat:"x.x.x.x.x.x.x.x.", crash:true, fill4:true, fill:"snare" },
        //合唱が「オー」から「アー」へ高まっていく
        B:{ bars:8, chords:"Gm|Gm|Bb|Bb|F|F|A|A",
            lead:"o5 g2 b-2 | o6 d2 c4 o5 b-4 | o6 d2 f2 | d1 | c2 o5 a2 | o6 c2 f2 | e2 c+2 | e1 |",
            choir:[{ type:"male", vowel:"o", to:"a", lo:48, vol:0.07, attack:0.4 },
                   { type:"female", vowel:"u", to:"a", lo:62, vol:0.065, attack:0.5 }],
            bass:"1-8-1-8-1-8-1-8-", bassType:"sawtooth", bassVol:0.12,
            kick:"x...x...x...x...", snare:"........x.......", hat:"x.x.x.x.x.x.x.x.", fill:"build", riser:2 },
        //山場：女声が高く和音をのばし、男声が低い旋律を歌う
        C:{ bars:8, chords:"Dm|Bb|F|C|Gm|Bb|A|A",
            lead:"o6 d2 f4 e4 | d2 o5 b-4 o6 d4 | c2 o5 a4 o6 c4 | e2. r4 | d2 g4 f4 | f2 d4 f4 | e2 c+4 e4 | e2. r4 |",
            dbl:-12,
            choir:{ type:"female", vowel:"a", lo:62, vol:0.07, attack:0.25 },
            chant:{ mml:"o3 d1 | d1 | c1 | c1 | d1 | d1 | c+1 | c+1 |", type:"male", vowel:"a", vol:0.08, oct:12, attack:0.2 },
            stab:"x--x--x---x--x--",
            bass:"1181118111811181", bassType:"sawtooth", bassVol:0.12,
            kick:"x.x.x.x.x.x.x.x.", snare:"....x.......x...", hat:"x.o.x.o.x.o.x.o.", crash:true, fill4:true, fill:"toms" },
        //落として、男声の刻みとタムで盛り上げ直す
        D:{ bars:4, chords:"Dm|Dm|Bb|A",
            choir:{ type:"male", vowel:"o", lo:48, vol:0.075, attack:0.03, pat:"x...x...x...x..." },
            bass:"1...............", bassType:"sawtooth", bassVol:0.12,
            kick:"x.......x.......", tom:"h...m...l...l.l.", fill:"build", riser:2 }
    }
};
