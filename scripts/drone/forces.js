//------------------------------------------------------------------------------
//  同胞(色違いのドローン君)と人間の軍勢
//  ・WAVE3～15：モンスターに紛れて同胞が出てくる。15に近づくほど多くなる
//    同胞は攻撃してこない。ドローン君のまわりを回り、何かを伝えようとしている
//    (認識阻害のせいで、ドローン君の武器は同胞を敵として撃ってしまう)
//  ・WAVE16～：敵は人間の兵器になる(無機質なドローン・ヘリコプター・戦車)
//  ・人間の兵器の見た目は enemyArt.js
//------------------------------------------------------------------------------
ENEMY_TYPES.kin    = { r:14, hp:2, speed:1.8, score:10, parts:1 };  //同胞
ENEMY_TYPES.mdrone = { r:10, hp:1, speed:2.2, score:15, parts:1 };  //無機質なドローン：群れで突っ込んでくる
ENEMY_TYPES.heli   = { r:18, hp:3, speed:1.4, score:40, parts:2 };  //ヘリコプター：止まって3連射
ENEMY_TYPES.panzer = { r:22, hp:6, speed:0.5, score:60, parts:3 };  //戦車：砲塔を向けて大きな砲弾

const KIN_COLORS = ["80,140,230","60,170,110","220,160,30","150,90,210","230,100,60"];

//同胞が出てくる確率(WAVE3で約4%、WAVE15で45%)
function kinRate(_w){
    if(_w < 3 || _w > REVEAL_WAVE) return 0;
    return Math.min(0.45, 0.04 + (_w - 3)*0.035);
}

var forces = {
    //人間との戦い(WAVE16～)の敵の種類
    pickHuman:function(_w){
        var list = [["mdrone",10],["heli",4 + (_w - 16)],["panzer",3 + (_w - 16)*0.8]];
        var sum = 0;
        for(var i=0; i<list.length; i++) sum += list[i][1];
        var r = Math.random()*sum;
        for(var i=0; i<list.length; i++){
            r -= list[i][1];
            if(r < 0) return list[i][0];
        }
        return "mdrone";
    },

    //makeEnemyの最後に呼ばれる
    init:function(_e){
        _e.seed = Math.random()*Math.PI*2;
        switch(_e.type){
            case "kin":
                _e.harmless = true;     //体当たりしてこない
                _e.look = new DroneLook();
                _e.tintIdx = Math.floor(Math.random()*KIN_COLORS.length);
                _e.look.tint = KIN_COLORS[_e.tintIdx];
                break;
            case "mdrone":
                _e.timer = 60 + Math.floor(Math.random()*100);
                break;
            case "heli":
                setShooterTarget(_e);
                _e.timer = 60;
                _e.burst = 0;
                break;
            case "panzer":
                _e.timer = 90;
                _e.turret = 0;
                break;
        }
    },

    //対応する敵ならtrue
    update:function(_e,_dx,_dy,_d){
        var play = mainScreen.state == "play";
        switch(_e.type){
            case "kin":
                //ドローン君のまわりをゆっくり回る(撃たれてもついてくる)
                var R = 110 + Math.sin(_e.t*0.02 + _e.seed)*30;
                var a = _e.t*0.012 + _e.seed;
                var tx = aimAt.X + Math.cos(a)*R - _e.x, ty = aimAt.Y + Math.sin(a)*R - _e.y;
                var l = Math.hypot(tx,ty) || 1;
                var sp = Math.min(_e.speed, l*0.05);
                _e.vx += (tx/l*sp - _e.vx)*0.1;
                _e.vy += (ty/l*sp - _e.vy)*0.1;
                _e.look.update(dirFromVel(_e.vx,_e.vy), _e.vx);
                return true;

            case "mdrone":
                //ジグザグに揺れながら寄ってくる。WAVE17からはときどき撃つ
                var jx = Math.cos(_e.t*0.3 + _e.seed)*1.2, jy = Math.sin(_e.t*0.27 + _e.seed)*1.2;
                _e.vx += ((_dx/_d)*_e.speed + jx - _e.vx)*0.08;
                _e.vy += ((_dy/_d)*_e.speed + jy - _e.vy)*0.08;
                if(game.wave >= 17 && --_e.timer <= 0 && play && _d < 420){
                    fireShot(_e.x,_e.y,Math.atan2(_dy,_dx),2.6*danmaku(),"small");
                    sound.play("enemyShot");
                    _e.timer = 160;
                }
                return true;

            case "heli":
                //移動先まで飛んで止まり、狙って3連射
                var mx = _e.tx - _e.x, my = _e.ty - _e.y, md = Math.hypot(mx,my);
                if(_e.burst > 0){
                    _e.vx *= 0.9; _e.vy *= 0.9;
                    if(_e.t % 7 == 0 && play){
                        fireShot(_e.x,_e.y,Math.atan2(_dy,_dx),3.0*danmaku(),"normal");
                        sound.play("enemyShot");
                        if(--_e.burst == 0){ setShooterTarget(_e); _e.timer = 90; }
                    }
                }else if(md > 3){
                    _e.vx = mx/md*_e.speed; _e.vy = my/md*_e.speed;
                }else{
                    _e.vx = 0; _e.vy = 0;
                    if(--_e.timer <= 0) _e.burst = game.wave >= 18 ? 4 : 3;
                }
                return true;

            case "panzer":
                //ゆっくり近づき、砲塔をドローン君に向けて撃つ
                _e.vx += (_dx/_d*_e.speed - _e.vx)*0.03;
                _e.vy += (_dy/_d*_e.speed - _e.vy)*0.03;
                _e.turret = turnTo(_e.turret, Math.atan2(_dy,_dx), 0.03);
                if(--_e.timer <= 0 && play && _e.x > 0 && _e.x < CW && _e.y > 0 && _e.y < CH){
                    var mx2 = _e.x + Math.cos(_e.turret)*(_e.r + 12), my2 = _e.y + Math.sin(_e.turret)*(_e.r + 12);
                    fireShot(mx2,my2,_e.turret,2.0*danmaku(),"big");
                    if(game.wave >= 18) fireFan(mx2,my2,_e.turret,3,0.3,2.6*danmaku(),"small");
                    effects.push({ flare:true, x:mx2, y:my2, R:20, color:"255,180,80", life:8, maxLife:8 });
                    sound.play("bossShot");
                    _e.timer = 110;
                }
                return true;
        }
        return false;
    },

    //対応する敵ならtrue(translate済みで呼ばれる)
    draw:function(_e,_body){
        switch(_e.type){
            case "kin":
                //認識阻害が効いている間は、ときどき輪郭がずれる(ノイズ)
                if(!game.seen.reveal && (_e.t + Math.floor(_e.seed*10)) % 50 < 5){
                    ctx.globalAlpha = 0.5;
                    ctx.fillStyle = "rgba(255,0,60,0.5)";
                    ctx.fillRect(-18 + (Math.random()-0.5)*8,-6,36,4);
                    ctx.fillStyle = "rgba(0,200,255,0.5)";
                    ctx.fillRect(-18 + (Math.random()-0.5)*8,4,36,3);
                    _e.look.draw(-3,0);
                    _e.look.draw(3,0);
                    ctx.globalAlpha = 1;
                }
                if(_body){ ctx.globalAlpha = 0.5; }
                _e.look.draw(0,0);
                ctx.globalAlpha = 1;
                return true;
        }
        return false;
    }
};
