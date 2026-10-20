//------------------------------------------------------------------------------
//  3Dの構造物(試作)：Blender で作った形を、ゲームの中で WebGL を使ってその場で描く
//------------------------------------------------------------------------------
//  形は tools/blender/relic.py --export で書き出した models/relicModel.js(RELIC_MODEL)。大きいので、使うときだけ読み込む。
//  丸い逆三角の青銅の枠に、水色に光る石。どの向きにも回せて、光の当たり方もその場で変わる(絵を書き出す方法との違い)。
//    青銅：金属のつや(GGX)・周りの映り込み・ふちのすれ(形のふちの印)・奥ほど緑青・茶色の錆の点
//    石：さざめく模様が流れ、まんなかほど白く光る。石の光が枠の内側を照らす
//  URL に #relic を付けると、戦闘画面の上のほうに浮かんで、ゆっくり回る(見比べ用。ゲームの進み方は変えない)。
//  見るだけのページは tools/relic3d.html。
const RELIC_FOV      = 22;       //カメラの画角(度。小さいほど遠近が弱い)
const RELIC_DIST     = 6.5;      //カメラの距離
const RELIC_CENTER   = [0, -0.08, -0.15];   //回す中心(形の座標)
const RELIC_SPIN     = 0.55;     //横に回る速さ(1秒あたりのラジアン)
const RELIC_TILT     = 0.35;     //縦にゆれる大きさ(ラジアン)
const RELIC_GAME_X   = 480;      //#relic のとき、戦闘画面に出す位置と大きさ(px)
const RELIC_GAME_Y   = 150;
const RELIC_GAME_SIZE = 190;

var RELIC_VS = [
    "attribute vec3 a_pos; attribute vec3 a_nrm; attribute vec2 a_att;",
    "uniform mat4 u_proj; uniform mat4 u_rot; uniform float u_scale; uniform vec3 u_center;",
    "varying vec3 v_n; varying vec3 v_p; varying vec3 v_o; varying float v_edge; varying float v_mat;",
    "void main(){",
    "    vec3 o = a_pos*u_scale;",
    "    v_o = o;",
    "    vec4 w = u_rot*vec4(o - u_center, 1.0);",
    "    v_p = w.xyz; v_n = normalize((u_rot*vec4(a_nrm, 0.0)).xyz);",
    "    v_edge = a_att.x/255.0; v_mat = a_att.y;",
    "    gl_Position = u_proj*vec4(w.xyz - vec3(0.0, 0.0, " + RELIC_DIST.toFixed(2) + "), 1.0);",
    "}"
].join("\n");
var RELIC_FS = [
    "precision highp float;",
    "varying vec3 v_n; varying vec3 v_p; varying vec3 v_o; varying float v_edge; varying float v_mat;",
    "uniform float u_t; uniform vec3 u_key; uniform vec3 u_core; uniform float u_pulse;",
    "float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }",
    "float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);",
    "    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),",
    "               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }",
    "float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i=0; i<5; i++){ s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }",
    //GGX のつや(D・G・F をまとめた近似)
    "vec3 spec(vec3 N, vec3 V, vec3 L, float r, vec3 F0){",
    "    vec3 H = normalize(V + L); float nh = max(dot(N, H), 0.0), nl = max(dot(N, L), 0.0), nv = max(dot(N, V), 0.001);",
    "    float a = r*r, a2 = a*a, d = nh*nh*(a2 - 1.0) + 1.0, D = a2/(3.14159*d*d);",
    "    float k = (r + 1.0)*(r + 1.0)/8.0, G = nl/(nl*(1.0 - k) + k)*nv/(nv*(1.0 - k) + k);",
    "    vec3 F = F0 + (1.0 - F0)*pow(1.0 - max(dot(H, V), 0.0), 5.0);",
    "    return D*G*F/(4.0*nv + 0.001);",
    "}",
    //周りの映り込み：上は暖かく明るい、下は暗い茶、横に少し青(背景の夜空)
    "vec3 env(vec3 R){ return mix(vec3(0.05,0.035,0.03), vec3(0.75,0.6,0.45), smoothstep(-0.3, 0.8, R.y)) + vec3(0.05,0.1,0.25)*smoothstep(0.3, 1.0, abs(R.x)); }",
    "vec3 tone(vec3 x){ x = (x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14); return pow(clamp(x, 0.0, 1.0), vec3(1.0/2.2)); }",
    "void main(){",
    "    vec3 N = normalize(v_n);",
    //石の法線は奥向きに書き出されているので裏返す。裏返した法線がカメラに背を向けていれば、裏から見ている
    "    if(v_mat > 1.5) N = -N;",
    "    bool back = v_mat > 1.5 && N.z < 0.0;",
    "    if(v_mat < 1.5 ? !gl_FrontFacing : back) N = -N;",
    "    vec3 V = vec3(0.0, 0.0, 1.0), col;",
    "    vec3 Lc = u_core - v_p; float dc = length(Lc); Lc /= dc;",
    "    vec3 coreCol = vec3(0.25, 0.9, 1.0)*(0.9 + 0.5*u_pulse);",
    //石を後ろから見たときは、裏板(暗い青銅)として描く(形の裏はふさいでいないため)
    "    if(v_mat < 1.5 || back){",
    //青銅：奥(口のまわり)ほど緑青、ところどころ茶色の錆、ふちは地の金属が出て光る
    "        float n1 = fbm(v_o*3.2), n2 = noise(v_o*26.0);",
    "        float deep = smoothstep(-0.06, -0.3, v_o.z);",
    "        float wear = smoothstep(0.35, 0.9, v_edge)*smoothstep(0.42, 0.55, n2);",
    "        float pat = clamp(smoothstep(0.56, 0.7, n1)*0.8 + deep*0.55 + smoothstep(-0.2, -0.9, v_o.y)*0.2, 0.0, 1.0)*smoothstep(0.35, 0.6, fbm(v_o*11.0))*(1.0 - wear);",
    "        float rust = smoothstep(0.7, 0.76, fbm(v_o*7.0 + 3.0))*0.8;",
    "        vec3 alb = mix(vec3(0.66, 0.42, 0.22), vec3(0.86, 0.62, 0.38), wear);",
    "        if(v_mat > 0.5) alb *= 0.45;     //口の内側の壁・裏板",
    "        float metal = 1.0 - max(pat, rust);",
    "        alb = mix(alb, vec3(0.16, 0.42, 0.36), pat); alb = mix(alb, vec3(0.28, 0.11, 0.04), rust);",
    "        float r = mix(0.45 + 0.15*n1, 0.25, wear); r = mix(r, 0.9, max(pat, rust));",
    "        vec3 F0 = mix(vec3(0.04), alb, metal), dif = alb*(1.0 - metal);",
    "        vec3 Lk = normalize(u_key);",
    "        col = (dif/3.14159*max(dot(N, Lk), 0.0)*3.0 + spec(N, V, Lk, r, F0)*3.0)*vec3(1.0, 0.92, 0.8);",
    "        vec3 Lr = normalize(vec3(0.8, -0.3, -0.5));",
    "        col += (dif/3.14159*max(dot(N, Lr), 0.0) + spec(N, V, Lr, r, F0))*vec3(0.3, 0.45, 0.8);",
    //石の光が枠の内側を照らす
    "        float at = 1.0/(1.0 + dc*dc*6.0);",
    "        col += (dif/3.14159*max(dot(N, Lc), 0.0)*1.2 + spec(N, V, Lc, r, F0)*0.6)*coreCol*at*3.0;",
    "        vec3 R = reflect(-V, N);",
    "        col += env(R)*F0*(1.0 - r*0.7)*0.8 + dif*0.08;",
    "        col *= mix(1.0, 0.7, deep*(1.0 - wear));     //奥まった所は暗い(汚れ)",
    "    }else{",
    //石：さざめく水面(模様が流れる)。まんなかほど白く強い光
    "        vec3 q = vec3(v_o.xy*7.0, u_t*0.35);",
    "        float h = fbm(q), hx = fbm(q + vec3(0.04, 0.0, 0.0)), hy = fbm(q + vec3(0.0, 0.04, 0.0));",
    "        vec3 Nb = normalize(N + vec3(h - hx, h - hy, 0.0)*9.0);",
    "        float rr = length((v_o.xy - vec2(0.0, 0.12))/vec2(0.55, 0.5));",
    "        float k = clamp(1.0 - rr, 0.0, 1.0);",
    "        vec3 em = mix(vec3(0.0, 0.3, 0.4), vec3(0.0, 0.78, 0.9), smoothstep(0.0, 0.5, k));",
    "        em = mix(em, vec3(0.85, 1.0, 1.0), smoothstep(0.55, 0.95, k));",
    "        em *= (0.75 + 0.5*h)*(1.0 + 0.35*u_pulse);",
    "        col = em*1.6;",
    "        vec3 Lk = normalize(u_key);",
    "        col += spec(Nb, V, Lk, 0.12, vec3(0.04))*4.0;",
    "        col += env(reflect(-V, Nb))*pow(1.0 - max(dot(Nb, V), 0.0), 3.0)*0.6;",
    "    }",
    "    gl_FragColor = vec4(tone(col), 1.0);",
    "}"
].join("\n");

var relic3d = {
    ok:null, fail:"", cv:null, gl:null, n:0, ms:0, msAvg:0, t:0,
    on:/[#&]relic(&|$)/.test(location.hash),
    //形のデータを読み込む(はじめて使うときだけ。index.html では読まない)
    load:function(_done){
        if(typeof RELIC_MODEL != "undefined"){ _done(); return; }
        var s = document.createElement("script");
        s.src = "models/relicModel.js";
        s.onload = _done; s.onerror = function(){ relic3d.ok = false; relic3d.fail = "models/relicModel.js が読めない"; };
        document.head.appendChild(s);
    },
    init:function(){
        this.ok = false;
        if(typeof RELIC_MODEL == "undefined"){ this.ok = null; return; }
        var cv = document.createElement("canvas"), gl = null;
        try{ gl = cv.getContext("webgl", { alpha:true, antialias:true, premultipliedAlpha:true, depth:true }); }catch(e){}
        if(!gl){ this.fail = "WebGL が使えない"; return; }
        this.cv = cv; this.gl = gl;
        var sh = function(type, src){ var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
            if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ relic3d.fail = gl.getShaderInfoLog(s); return null; } return s; };
        var vs = sh(gl.VERTEX_SHADER, RELIC_VS), fs = sh(gl.FRAGMENT_SHADER, RELIC_FS);
        if(!vs || !fs) return;
        var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs);
        gl.bindAttribLocation(p, 0, "a_pos"); gl.bindAttribLocation(p, 1, "a_nrm"); gl.bindAttribLocation(p, 2, "a_att");
        gl.linkProgram(p);
        if(!gl.getProgramParameter(p, gl.LINK_STATUS)){ this.fail = gl.getProgramInfoLog(p); return; }
        this.prog = p;
        this.u = {};
        ["u_proj","u_rot","u_scale","u_center","u_t","u_key","u_core","u_pulse"].forEach(function(k){ relic3d.u[k] = gl.getUniformLocation(p, k); });
        //base64 の形を、そのまま GPU へ渡す(位置は16bit・法線は8bitの整数。WebGL が -1～1 に直す)
        var bin = function(b64){ var s = atob(b64), a = new Uint8Array(s.length); for(var i=0; i<s.length; i++) a[i] = s.charCodeAt(i); return a; };
        var M = RELIC_MODEL;
        var buf = function(target, data){ var b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
        this.bPos = buf(gl.ARRAY_BUFFER, bin(M.pos)); this.bNrm = buf(gl.ARRAY_BUFFER, bin(M.nrm)); this.bAtt = buf(gl.ARRAY_BUFFER, bin(M.att));
        var idx = bin(M.idx);
        this.bIdx = buf(gl.ELEMENT_ARRAY_BUFFER, idx);
        this.n = idx.length/2;
        this.ok = true;
    },
    ready:function(){
        if(this.ok === null) this.init();
        return this.ok === true;
    },
    //描いて、その絵(キャンバス)を返す。_px：絵の大きさ(画素)　_yaw・_pitch：向き(ラジアン)　_t：時刻(秒)
    render:function(_px, _yaw, _pitch, _t){
        if(!this.ready()) return null;
        var t0 = performance.now(), gl = this.gl, cv = this.cv;
        if(cv.width != _px){ cv.width = cv.height = _px; }
        gl.viewport(0, 0, _px, _px);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(this.prog);
        var f = 1/Math.tan(RELIC_FOV*Math.PI/360), nr = 0.1, fr = 30;
        gl.uniformMatrix4fv(this.u.u_proj, false, [f,0,0,0, 0,f,0,0, 0,0,(fr + nr)/(nr - fr),-1, 0,0,2*fr*nr/(nr - fr),0]);
        var cy = Math.cos(_yaw), sy = Math.sin(_yaw), cp = Math.cos(_pitch), sp = Math.sin(_pitch);
        //横(y軸)に回してから縦(x軸)に傾ける
        var R = [cy, sp*sy, -cp*sy, 0,  0, cp, sp, 0,  sy, -sp*cy, cp*cy, 0,  0, 0, 0, 1];
        gl.uniformMatrix4fv(this.u.u_rot, false, R);
        gl.uniform1f(this.u.u_scale, RELIC_MODEL.scale);
        gl.uniform3fv(this.u.u_center, RELIC_CENTER);
        gl.uniform1f(this.u.u_t, _t);
        //主な光は左上の前から、ゆっくり回る
        var la = _t*0.4;
        gl.uniform3f(this.u.u_key, -0.6 + 0.5*Math.sin(la), 0.7, 0.5 + 0.3*Math.cos(la));
        //石の光の位置(石の少し手前)を、同じように回す
        var c = [0 - RELIC_CENTER[0], 0.12 - RELIC_CENTER[1], -0.2 - RELIC_CENTER[2]];
        gl.uniform3f(this.u.u_core, R[0]*c[0] + R[4]*c[1] + R[8]*c[2], R[1]*c[0] + R[5]*c[1] + R[9]*c[2], R[2]*c[0] + R[6]*c[1] + R[10]*c[2]);
        gl.uniform1f(this.u.u_pulse, 0.5 + 0.5*Math.sin(_t*2.2));
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bPos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.SHORT, true, 6, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bNrm); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 3, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bAtt); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.UNSIGNED_BYTE, false, 2, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bIdx);
        gl.drawElements(gl.TRIANGLES, this.n, gl.UNSIGNED_SHORT, 0);
        this.ms = performance.now() - t0;
        this.msAvg = this.msAvg ? this.msAvg*0.9 + this.ms*0.1 : this.ms;
        return cv;
    },
    //ゲームのキャンバスに描く(_x・_y：まんなか、_size：大きさ。ゲームの座標)。石のまわりには、明るい光のにじみを重ねる
    draw:function(_g, _x, _y, _size, _yaw, _pitch, _t){
        var m = _g.getTransform(), px = Math.max(16, Math.round(_size*Math.abs(m.a)));
        var c = this.render(px, _yaw, _pitch, _t);
        if(!c) return false;
        _g.save();
        var pulse = 0.5 + 0.5*Math.sin(_t*2.2), front = Math.max(0, Math.cos(_yaw)*Math.cos(_pitch));
        _g.globalCompositeOperation = "lighter";
        var r = _size*0.45, gy = _y - _size*0.05;
        var G = _g.createRadialGradient(_x, gy, 0, _x, gy, r);
        G.addColorStop(0, "rgba(120,240,255," + (0.35*front*(0.8 + 0.4*pulse)) + ")"); G.addColorStop(1, "rgba(120,240,255,0)");
        _g.fillStyle = G; _g.fillRect(_x - r, gy - r, r*2, r*2);
        _g.globalCompositeOperation = "source-over";
        _g.drawImage(c, _x - _size/2, _y - _size/2, _size, _size);
        _g.restore();
        return true;
    }
};

//#relic：戦闘画面の上のほうに浮かべて、ゆっくり回す(HUD の手前で描く)
if(relic3d.on) relic3d.load(function(){
    var drawHud = mainScreen.drawHud;
    mainScreen.drawHud = function(){
        var t = performance.now()/1000;
        relic3d.draw(ctx, RELIC_GAME_X, RELIC_GAME_Y + Math.sin(t*1.3)*6, RELIC_GAME_SIZE, t*RELIC_SPIN, Math.sin(t*0.7)*RELIC_TILT, t);
        drawHud.call(this);
        if(relic3d.ok){
            ctx.save(); ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#0a7";
            ctx.fillText("3D(WebGL) " + relic3d.n/3 + "三角形  " + relic3d.msAvg.toFixed(2) + "ms", CW/2, 34);
            ctx.restore();
        }
    };
});
