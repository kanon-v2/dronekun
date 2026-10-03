//------------------------------------------------------------------------------
//  うろうろするドローン
//------------------------------------------------------------------------------
var drone_around = {
    //ドローンの座標計算
    X:0,
    Y:0,
    preX: Array(),
    preY: Array(),
    delay:10,
    getX: function(){
        t++;
        this.preX.push(this.X);
        if(this.preX.length >= 5)  this.preX.shift();
        this.X = Icon.X+Icon.width/2-DRONE_SIZE/2 + 50*Math.sin(Math.PI*t/120);
        return this.X;
    },
    getY: function(){
        this.preY.push(this.Y);
        if(this.preY.length >= 5)  this.preY.shift();
        this.Y = Icon.Y+Icon.height/2-DRONE_SIZE/2 + 50*Math.sin(Math.PI*t/90);
        return this.Y;
    },
    //ドローンの向いている方向と速度を検出
    Direction: 0,
    Speed:0,
    SpeedX:0,
    SpeedY:0,
    calcSpeed: function(){
        this.SpeedX = this.X - this.preX[1];
        this.SpeedY = this.Y - this.preY[1];
        this.Speed = Math.sqrt(this.SpeedX*this.SpeedX + this.SpeedY*this.SpeedY);
    },
    Threshold: 0,   //移動中か判定するための速度のしきい値
    keeptime:0,     //チャタリング防止
    getDirection: function(){
        if(this.keeptime == 0 || this.keeptime == 5){
            this.keeptime=0;
            this.keeptime++;
            if(this.Speed > this.Threshold){
                if(Math.abs(this.SpeedX) >= Math.abs(this.SpeedY)){
                    if(this.SpeedX > 0){
                        this.Direction = 4;
                    }else{
                        this.Direction = 3;
                    }
                }else{
                    if(this.SpeedY > 0){
                        this.Direction = 2;
                    }else{
                        this.Direction = 1;
                    }
                }
            }else{this.Direction = 0;}
        }else{this.keeptime++;}
    },

}


drone_around.look = new DroneLook();

//------------------------------------------------------------------------------
//  ドローン君の枠・ボタン
//------------------------------------------------------------------------------
var Icon = new drawRect(GS*5 , GS*3 , GS*8 , GS*8)
var nextButton = new drawRect(GS*22 , GS*14.4 , GS*14 , GS*2.4);
var toTitleButton = new drawRect(GS*5 , GS*15 , GS*8 , GS*1.6);

//タブ
var tabStats = new drawRect(380 , 72 , 160 , 32);
var tabEquip = new drawRect(545 , 72 , 160 , 32);

//能力強化タブ
var resetButton = new drawRect(825 , 72 , 210 , 32);
const RESET_CONFIRM_TIME = 180;     //リセットの確認を待つ時間(3秒)
const ROW_TOP = 115;
const ROW_H = 58;
var upgradeButtons = [];
for(var i=0; i<STATS.length; i++){
    upgradeButtons.push(new drawRect(GS*28.3 , ROW_TOP + i*ROW_H + 6 , GS*5 , 40));
}

//装備タブ：装備枠・所持品・説明欄
var slotRects = [];
var slotUnlockButtons = [];
for(var i=0; i<3; i++){
    slotRects.push(new drawRect(300 + i*212 + 100 , 118 , 200 , 60));
    slotUnlockButtons.push(new drawRect(300 + i*212 + 100 , 132 , 170 , 34));
}
var itemRects = [];
for(var i=0; i<WEAPON_IDS.length; i++){
    //5つずつ2段に並べる
    itemRects.push(new drawRect(300 + (i%5)*128 + 59 , 212 + Math.floor(i/5)*56 , 118 , 48));
}
var infoRect = new drawRect(615 , 324 , 630 , 102);

//報酬のカード
var rewardCards = [];
for(var i=0; i<3; i++){
    rewardCards.push(new drawRect(CW/2 + (i-1)*300 , 95 , 270 , 340));
}

//------------------------------------------------------------------------------
//  強化画面処理(WAVEの合間。ここで自動セーブする)
//------------------------------------------------------------------------------
var upgradeScreen = {
    state:"main",   //reward:報酬を選ぶ  main:強化・装備の変更
    tab:"stats",
    offers:[],      //報酬の候補(装備のidか"parts")
    flash:[],       //強化した行を光らせる
    msg:"",
    msgTime:0,
    resetConfirm:0,     //リセットの確認中の残り時間(0なら確認中でない)
    resetMsgTime:0,
    resetRefund:0,

    enter:function(){
        save.write();
        this.flash = [];
        for(var i=0; i<STATS.length; i++) this.flash.push(0);
        this.msgTime = 0;
        this.resetConfirm = 0;
        this.resetMsgTime = 0;
        if(game.pendingReward){
            this.makeOffers();
            this.state = "reward";
        }else{
            this.state = "main";
        }
        //最初のフレームから枠の中に表示されるよう位置を計算しておく
        drone_around.getX();
        drone_around.getY();
    },

    //まだ最大レベルでない装備から3つ選ぶ。足りなければパーツで埋める
    makeOffers:function(){
        var pool = WEAPON_IDS.filter(function(id){ return (game.owned[id] || 0) < MAX_WEAPON_LEVEL; });
        for(var i=pool.length-1; i>0; i--){
            var j = Math.floor(Math.random()*(i+1));
            var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
        }
        this.offers = pool.slice(0,3);
        while(this.offers.length < 3) this.offers.push("parts");
    },

    takeReward:function(_id){
        if(_id == "parts"){
            game.parts += 5;
        }else if(game.owned[_id]){
            game.owned[_id]++;
        }else{
            game.owned[_id] = 1;
            //空いている装備枠があれば自動で装備
            var k = this.emptySlot();
            if(k >= 0) game.slots[k] = _id;
        }
        game.pendingReward--;
        save.write();
        sound.play("reward");
        //ボス撃破・報酬カプセルの分が残っていれば続けて選ぶ
        if(game.pendingReward > 0){
            this.makeOffers();
            return;
        }
        this.state = "main";
        this.tab = "equip";
    },

    emptySlot:function(){
        for(var i=0; i<game.slotCount; i++){
            if(!game.slots[i]) return i;
        }
        return -1;
    },
    ownedList:function(){
        return WEAPON_IDS.filter(function(id){ return game.owned[id]; });
    },
    say:function(_msg){
        this.msg = _msg;
        this.msgTime = 150;
        sound.play("error");
    },

    cost:function(_key){
        var lv = game.level[_key];
        return lv >= MAX_LEVEL ? 0 : UPGRADE_COST[lv];
    },
    canBuy:function(_key){
        return game.level[_key] < MAX_LEVEL && game.parts >= this.cost(_key);
    },

    //能力をすべてLv1に戻したときに返ってくるパーツ数(これまで強化に使った合計)
    refundValue:function(){
        var sum = 0;
        for(var i=0; i<STATS.length; i++){
            var lv = game.level[STATS[i].key];
            for(var l=1; l<lv; l++) sum += UPGRADE_COST[l];
        }
        return sum;
    },
    resetStats:function(){
        var refund = this.refundValue();
        game.parts += refund;
        for(var i=0; i<STATS.length; i++){
            game.level[STATS[i].key] = 1;
            this.flash[i] = 20;
        }
        save.write();
        this.resetRefund = refund;
        this.resetMsgTime = 150;
        sound.play("buy");
    },

    //装備を外す(1つは必ず残す)
    unequip:function(_id){
        if(arms.equipped().length <= 1){
            this.say("装備は最低1つ必要です");
            return;
        }
        game.slots[game.slots.indexOf(_id)] = null;
        save.write();
        sound.play("click");
    },
    equip:function(_id){
        var k = this.emptySlot();
        if(k < 0){
            this.say("空いている装備枠がありません。装備中のものをクリックすると外せます");
            return;
        }
        game.slots[k] = _id;
        save.write();
        sound.play("click");
    },

    //----------------------------------------------------------------- 更新
    update:function(){
        drone_around.getX();
        drone_around.getY();
        drone_around.calcSpeed();
        drone_around.getDirection();
        //速さは4フレーム前との差なので、1フレームあたりに直して傾きに使う
        drone_around.look.update(drone_around.Direction, drone_around.SpeedX/4);
        if(this.msgTime > 0) this.msgTime--;

        if(this.state == "reward"){
            for(var i=0; i<3; i++){
                if(rewardCards[i].clicked()){
                    this.takeReward(this.offers[i]);
                    return;
                }
            }
            return;
        }

        if(tabStats.clicked() && this.tab != "stats"){ this.tab = "stats"; sound.play("click"); }
        if(tabEquip.clicked() && this.tab != "equip"){ this.tab = "equip"; sound.play("click"); this.resetConfirm = 0; }
        if(this.resetConfirm > 0) this.resetConfirm--;
        if(this.resetMsgTime > 0) this.resetMsgTime--;

        if(this.tab == "stats"){
            //能力のリセット：1回目で確認、3秒以内にもう一度押すと確定
            if(resetButton.clicked() && this.refundValue() > 0){
                if(this.resetConfirm > 0){
                    this.resetConfirm = 0;
                    this.resetStats();
                }else{
                    this.resetConfirm = RESET_CONFIRM_TIME;
                    sound.play("click");
                }
            }
            for(var i=0; i<STATS.length; i++){
                var key = STATS[i].key;
                if(upgradeButtons[i].clicked() && this.canBuy(key)){
                    game.parts -= this.cost(key);
                    game.level[key]++;
                    this.flash[i] = 20;
                    save.write();
                    sound.play("buy");
                }
            }
        }else{
            //装備枠の解放
            var k = game.slotCount;
            if(k < 3 && slotUnlockButtons[k].clicked() && game.parts >= SLOT_COST[k]){
                game.parts -= SLOT_COST[k];
                game.slotCount++;
                save.write();
                sound.play("buy");
            }
            //装備枠をクリック：外す
            for(var i=0; i<game.slotCount; i++){
                if(slotRects[i].clicked() && game.slots[i]) this.unequip(game.slots[i]);
            }
            //所持品をクリック：装備する／外す
            var list = this.ownedList();
            for(var i=0; i<list.length; i++){
                if(itemRects[i].clicked()){
                    if(arms.has(list[i])) this.unequip(list[i]);
                    else this.equip(list[i]);
                }
            }
        }
        for(var i=0; i<STATS.length; i++){
            if(this.flash[i] > 0) this.flash[i]--;
        }

        if(nextButton.clicked()){
            //協力プレイは、ふたりとも準備できたら出撃(coop.update)。もう一度押すと取り消し
            if(coop.active){
                coop.localReady = !coop.localReady;
                sound.play("click");
                return;
            }
            page.change(1);
            return;
        }
        if(toTitleButton.clicked()){
            if(coop.active) coop.leave();
            sound.play("click");
            page.change(0);
            return;
        }
    },

    //----------------------------------------------------------------- 描画
    draw:function(){
        if(this.state == "reward"){
            this.drawReward();
            return;
        }
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";

        //見出し
        ctx.textAlign = "left";
        ctx.font = "bold 36px serif";
        ctx.fillText("ドローン君の強化",GS,GS*1.5);
        ctx.textAlign = "right";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("パーツ " + game.parts + "　　SCORE " + game.score,CW - GS,GS*1.5);

        //左：うろうろするドローン君と現在の性能
        Icon.stroke();
        //drone_aroundのX,Yは絵の左上なので、中心に直して描く
        drone_around.look.draw(drone_around.X + 20, drone_around.Y + 20);
        ctx.textAlign = "left";
        ctx.font = "15px sans-serif";
        var info = [
            "耐久　　" + game.stat("armor"),
            "燃料　　" + game.stat("fuel"),
            "攻撃速度 ×" + (1/arms.rate()).toFixed(2),
            "射程　　" + game.range() + "px"
        ];
        for(var i=0; i<info.length; i++){
            ctx.fillText(info[i],Icon.X + 4,Icon.Y + Icon.height + 22 + i*22);
        }

        //タブ
        ctx.font = "bold 16px sans-serif";
        this.drawTab(tabStats,"能力強化",this.tab == "stats");
        this.drawTab(tabEquip,"装備",this.tab == "equip");        ctx.strokeStyle = "#000";
        ctx.beginPath(); ctx.moveTo(300,104.5); ctx.lineTo(930,104.5); ctx.stroke();

        if(this.tab == "stats") this.drawStats();
        else this.drawEquip();

        ctx.font = "bold 26px serif";
        if(coop.active && coop.localReady){
            //準備完了：相方を待っている
            nextButton.fill("#333");
            ctx.fillStyle = "#fff";
            ctx.font = "bold 20px serif";
            nextButton.text("相方を待っています…（押すと取り消し）");
            ctx.fillStyle = "#000";
        }else{
            nextButton.button("WAVE " + game.wave + " へ出撃" + (coop.active ? "（準備完了）" : ""));
        }
        if(coop.active){
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgb(" + P2_COLOR + ")";
            var p = coop.partner;
            ctx.fillText("協力プレイ中（" + (coop.role == "host" ? "あなたはP1" : "あなたはP2") + "）　相方：" +
                         (!p ? "接続待ち" : (p.rd == game.wave ? "準備完了" : "強化中")),
                         nextButton.X + nextButton.width/2, nextButton.Y - 12);
            ctx.fillStyle = "#000";
        }
        ctx.font = "14px sans-serif";
        toTitleButton.button(coop.active ? "協力プレイをやめる" : "タイトルへ（保存済み）");
    },

    drawTab:function(_rect,_label,_selected){
        if(_selected){
            _rect.fill("#333");
            ctx.fillStyle = "#fff";
            _rect.text(_label);
            ctx.fillStyle = "#000";
        }else{
            _rect.button(_label);
        }
    },

    drawStats:function(){
        //能力のリセットボタン(確認中は赤くなる)
        var refund = this.refundValue();
        ctx.font = "bold 13px sans-serif";
        if(this.resetConfirm > 0){
            resetButton.fill("#c33");
            ctx.fillStyle = "#fff";
            resetButton.text("もう一度押すと確定（+" + refund + "）");
            ctx.fillStyle = "#000";
        }else{
            resetButton.button(refund > 0 ? "能力をリセット（パーツ+" + refund + "）" : "能力をリセット", refund > 0);
        }
        if(this.resetMsgTime > 0){
            ctx.textAlign = "right";
            ctx.fillStyle = "#c33";
            ctx.font = "bold 13px sans-serif";
            ctx.fillText("パーツ " + this.resetRefund + " 個を返却しました",930,62);
            ctx.fillStyle = "#000";
        }

        for(var i=0; i<STATS.length; i++){
            var s = STATS[i];
            var lv = game.level[s.key];
            var top = ROW_TOP + i*ROW_H;
            if(this.flash[i] > 0){
                ctx.fillStyle = "rgba(220,40,40," + this.flash[i]/40 + ")";
                ctx.fillRect(300,top,630,ROW_H - 4);
            }
            ctx.strokeStyle = "#ccc";
            ctx.beginPath(); ctx.moveTo(300,top + ROW_H - 3.5); ctx.lineTo(930,top + ROW_H - 3.5); ctx.stroke();

            ctx.textAlign = "left";
            ctx.fillStyle = "#000";
            ctx.font = "bold 20px sans-serif";
            ctx.fillText(s.name,GS*10.5,top + 16);
            ctx.font = "13px sans-serif";
            ctx.fillStyle = "#555";
            ctx.fillText(s.desc,GS*10.5,top + 38);

            //レベルの目盛り
            for(var j=0; j<MAX_LEVEL; j++){
                if(j < lv){
                    ctx.fillStyle = "#333";
                    ctx.fillRect(GS*16 + j*26,top + 14,20,20);
                }else{
                    ctx.strokeStyle = "#999";
                    ctx.strokeRect(GS*16 + j*26 + 0.5,top + 14.5,19,19);
                }
            }
            ctx.fillStyle = "#000";
            ctx.font = "bold 14px sans-serif";
            ctx.fillText("Lv." + lv,GS*16 + MAX_LEVEL*26 + 6,top + 24);

            ctx.font = "bold 16px sans-serif";
            if(lv >= MAX_LEVEL){
                upgradeButtons[i].button("MAX",false);
            }else{
                upgradeButtons[i].button("強化　パーツ" + this.cost(s.key),this.canBuy(s.key));
            }
        }
    },

    drawEquip:function(){
        var hover = null;

        //装備枠
        for(var i=0; i<3; i++){
            var r = slotRects[i];
            var id = game.slots[i];
            if(i >= game.slotCount){
                ctx.strokeStyle = "#bbb";
                ctx.setLineDash([4,4]);
                ctx.strokeRect(r.X + 0.5,r.Y + 0.5,r.width,r.height);
                ctx.setLineDash([]);
                ctx.font = "bold 15px sans-serif";
                if(i == game.slotCount){
                    slotUnlockButtons[i].button("枠を解放　パーツ" + SLOT_COST[i],game.parts >= SLOT_COST[i]);
                }else{
                    ctx.fillStyle = "#bbb";
                    r.text("ロック中");
                }
                continue;
            }
            if(r.contains(MouseX,MouseY)){
                r.fill("#f2f2f2");
                if(id) hover = id;
            }
            ctx.lineWidth = 2;
            r.stroke();
            ctx.lineWidth = 1;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            if(id){
                drawWeaponIcon(id,r.X + 10,r.Y + 10,40);
                ctx.fillStyle = "#000";
                ctx.font = "bold 17px sans-serif";
                ctx.textAlign = "left";
                ctx.fillText(WEAPONS[id].name,r.X + 60,r.Y + 22);
                ctx.font = "13px sans-serif";
                ctx.fillText("Lv." + game.owned[id],r.X + 60,r.Y + 42);
            }else{
                ctx.fillStyle = "#999";
                ctx.font = "15px sans-serif";
                r.text("空き");
            }
        }

        //所持品
        ctx.textAlign = "left";
        ctx.fillStyle = "#555";
        ctx.font = "13px sans-serif";
        ctx.fillText("所持している装備（クリックで装備する／外す）",300,198);
        var list = this.ownedList();
        for(var i=0; i<list.length; i++){
            var r = itemRects[i];
            var id = list[i];
            var on = arms.has(id);
            if(r.contains(MouseX,MouseY)){
                r.fill("#f2f2f2");
                hover = id;
            }
            ctx.strokeStyle = on ? "#000" : "#bbb";
            ctx.lineWidth = on ? 2 : 1;
            ctx.strokeRect(r.X,r.Y,r.width,r.height);
            ctx.lineWidth = 1;
            drawWeaponIcon(id,r.X + 8,r.Y + 8,32);
            ctx.textAlign = "left";
            ctx.fillStyle = "#000";
            ctx.font = "bold 15px sans-serif";
            ctx.fillText(WEAPONS[id].name,r.X + 48,r.Y + 17);
            ctx.font = "12px sans-serif";
            ctx.fillText("Lv." + game.owned[id],r.X + 48,r.Y + 35);
            if(on){
                ctx.fillStyle = "#c33";
                ctx.font = "bold 11px sans-serif";
                ctx.textAlign = "right";
                ctx.fillText("装備中",r.X + r.width - 6,r.Y + 35);
            }
        }

        //説明欄
        ctx.strokeStyle = "#ccc";
        ctx.strokeRect(infoRect.X + 0.5,infoRect.Y + 0.5,infoRect.width,infoRect.height);
        var x = infoRect.X + 12, y = infoRect.Y + 16;
        ctx.textAlign = "left";
        if(hover){
            var w = WEAPONS[hover];
            var lv = game.owned[hover];
            ctx.fillStyle = "#000";
            ctx.font = "bold 15px sans-serif";
            ctx.fillText(w.name + "  Lv." + lv + "：" + w.lvText[lv-1],x,y);
            ctx.font = "13px sans-serif";
            ctx.fillStyle = "#444";
            ctx.fillText(w.desc,x,y + 18);
            this.drawSynergyLines(hover,x,y + 35);
        }else{
            var syn = activeSynergies();
            ctx.fillStyle = "#000";
            ctx.font = "bold 15px sans-serif";
            ctx.fillText("発動中のシナジー",x,y);
            ctx.font = "13px sans-serif";
            if(syn.length == 0){
                ctx.fillStyle = "#777";
                ctx.fillText("相性の良い装備を2つ同時に装備すると発動。装備にマウスを乗せると相性が見られます",x,y + 22);
            }
            for(var i=0; i<syn.length && i<3; i++){
                ctx.fillStyle = "#c33";
                ctx.fillText("◆" + syn[i].name + "（" + WEAPONS[syn[i].a].name + "＋" + WEAPONS[syn[i].b].name + "）：" + syn[i].desc,x,y + 22 + i*18);
            }
            if(syn.length > 3){
                ctx.fillText("ほか" + (syn.length - 3) + "個",x + 520,y);
            }
        }
        if(this.msgTime > 0){
            ctx.textAlign = "right";
            ctx.fillStyle = "#c33";
            ctx.font = "bold 13px sans-serif";
            ctx.fillText(this.msg,infoRect.X + infoRect.width - 10,infoRect.Y - 12);
        }
        ctx.fillStyle = "#000";
    },

    //その装備の相性一覧(発動中は赤、相手を持っていれば黒、持っていなければ灰色)
    drawSynergyLines:function(_id,_x,_y){
        var list = synergiesOf(_id);
        //相性が4つある装備(電撃・レーザー)は少し小さく詰めて表示
        var lh = list.length >= 4 ? 14 : 16;
        ctx.font = list.length >= 4 ? "12px sans-serif" : "13px sans-serif";
        for(var i=0; i<list.length; i++){
            var s = list[i];
            var p = partnerOf(s,_id);
            var active = arms.has(s.a) && arms.has(s.b);
            ctx.fillStyle = active ? "#c33" : (game.owned[p] ? "#000" : "#999");
            ctx.fillText((active ? "◆" : "◇") + "＋" + WEAPONS[p].name + "「" + s.name + "」" + s.desc + (active ? "（発動中）" : ""),_x,_y + i*lh);
        }
    },

    drawReward:function(){
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#000";
        ctx.font = "bold 32px serif";
        ctx.fillText("WAVE " + (game.wave - 1) + " クリア報酬",CW/2,40);
        ctx.font = "16px sans-serif";
        ctx.fillText("1つ選んでください" + (game.pendingReward > 1 ? "（あと" + game.pendingReward + "回選べます）" : ""),CW/2,74);

        for(var i=0; i<3; i++){
            var r = rewardCards[i];
            var id = this.offers[i];
            if(r.contains(MouseX,MouseY)) r.fill("#f4f4f4");
            ctx.lineWidth = 2;
            r.stroke();
            ctx.lineWidth = 1;
            var cx = r.X + r.width/2;
            ctx.textAlign = "center";

            if(id == "parts"){
                ctx.fillStyle = "#777";
                ctx.fillRect(cx - 28,r.Y + 22,56,56);
                ctx.fillStyle = "#fff";
                ctx.fillRect(cx - 6,r.Y + 44,12,12);
                ctx.fillStyle = "#000";
                ctx.font = "bold 22px sans-serif";
                ctx.fillText("パーツ＋5",cx,r.Y + 104);
                ctx.font = "14px sans-serif";
                ctx.fillText("能力強化や装備枠の解放に使う",cx,r.Y + 140);
                continue;
            }

            var w = WEAPONS[id];
            var lv = game.owned[id] || 0;
            drawWeaponIcon(id,cx - 28,r.Y + 22,56);
            ctx.fillStyle = "#000";
            ctx.font = "bold 22px sans-serif";
            ctx.fillText(w.name,cx,r.Y + 104);
            ctx.font = "bold 15px sans-serif";
            if(lv == 0){
                ctx.fillStyle = "#c33";
                ctx.fillText("NEW！",cx,r.Y + 130);
            }else{
                ctx.fillText("Lv." + lv + " → Lv." + (lv + 1),cx,r.Y + 130);
            }

            ctx.textAlign = "left";
            ctx.fillStyle = "#333";
            ctx.font = "14px sans-serif";
            var lines = fillWrapText(w.desc,r.X + 16,r.Y + 160,r.width - 32,20);
            ctx.fillStyle = "#000";
            ctx.font = "bold 14px sans-serif";
            ctx.fillText("▶ " + w.lvText[lv],r.X + 16,r.Y + 172 + lines*20);

            //相性
            var list = synergiesOf(id);
            var y = r.Y + 210 + lines*20;
            ctx.font = "bold 13px sans-serif";
            ctx.fillStyle = "#555";
            ctx.fillText("相性の良い装備",r.X + 16,y);
            ctx.font = "13px sans-serif";
            for(var j=0; j<list.length; j++){
                var p = partnerOf(list[j],id);
                ctx.fillStyle = game.owned[p] ? "#c33" : "#777";
                ctx.fillText((game.owned[p] ? "◆" : "◇") + WEAPONS[p].name + "「" + list[j].name + "」" + (game.owned[p] ? "所持" : ""),r.X + 16,y + 20 + j*19);
            }
        }
        ctx.textAlign = "center";
        ctx.fillStyle = "#777";
        ctx.font = "13px sans-serif";
        ctx.fillText("◆赤は相性の良い装備を持っているもの。新しい装備は空いている装備枠に自動で入ります",CW/2,CH - 60);
        ctx.fillStyle = "#000";
    }
};
