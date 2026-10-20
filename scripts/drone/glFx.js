//------------------------------------------------------------------------------
//  WebGL の後処理(試作)
//------------------------------------------------------------------------------
//  ゲームのキャンバス(2D)を WebGL へ写し、シェーダーで歪ませ・明るい所をにじませて描き戻す。
//  キャンバス2Dでは重い・できない演出(縦横に歪む屈折・色のずれ・光のにじみ)を試すためのもの。
//  URL に #gl を付けたときだけ使う(#debug&gl のように並べてよい)。戦闘中に G キーで入り切りして見比べられる。
//  使えないとき(WebGL がない・キャンバスが汚染されている)は、呼んだ側が前の描き方に戻る(glFx.ready() が false)。
//  file:// で png ファイルを描いたキャンバスは汚染されて WebGL へ渡せないので、ゲームの画像は embedImages.js に埋めてある。
//  今は核弾頭(shotLab.js の drawNukeOver)の熱のゆらぎ・衝撃波の輪・閃光のにじみに使う。
const GLFX_MAX       = 4;        //一度に扱う「場」(爆心など)の数
const GLFX_BLOOM_DIV = 4;        //にじみを作る画像の縮め方(ゲームの大きさ 960×540 の1/4でぼかす。画面の細かさ renderScale によらず、光の広がりと重さが同じになるように)
const GLFX_BLOOM_THR = 0.55;     //これより明るい所だけにじませる(0～1)
const GLFX_BLUR_PASS = 2;        //ぼかしを重ねる回数(多いほど広くにじむ)
const GLFX_WIDE_DIV  = 16;       //遠くまで広がる淡いにじみを作る画像の縮め方(同じくゲームの大きさの1/16)
const GLFX_HAZE_FREQ = 0.03;     //かげろうの模様の細かさ(1pxあたり)
const GLFX_HAZE_RISE = 1.4;      //かげろうが立ちのぼる速さ(1秒あたり、模様の何個分)
const GLFX_RING_W    = 34;       //衝撃波の輪の屈折の幅(px)
const GLFX_RING_CA   = 0.4;      //衝撃波の輪の色のずれ(屈折の量に対する割合)
const GLFX_PROTECT   = 2;        //にじみを弱める円(キャラの体の上)の数の上限
const GLFX_PROTECT_K = 0.15;     //守る円の中に残すにじみの割合(体は光に埋もれず、まわりは光る)

var GLFX_VS = "attribute vec2 a; varying vec2 v; void main(){ v = a*0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }";
//どのシェーダーにも付ける頭：精度と、ゲームの座標を出す関数(u_m はキャンバスの拡大 a・d とずれ e・f)
var GLFX_HEAD = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "varying vec2 v;",
    "uniform vec2 u_res;",
    "uniform vec4 u_m;",
    "uniform vec4 u_b0[" + GLFX_MAX + "];",     //x, y, かげろうの強さ(px), かげろうの半径
    "uniform vec4 u_b1[" + GLFX_MAX + "];",     //輪の半径, 輪の屈折(px), にじむ半径, にじむ強さ
    "vec2 gamePos(vec2 uv){ return (vec2(uv.x, 1.0 - uv.y)*u_res - u_m.zw)/u_m.xy; }"
].join("\n") + "\n";
//明るい所を取り出して縮める(爆心のまわりだけ。HUDの白い文字などはにじませない)
var GLFX_BRIGHT = GLFX_HEAD + [
    "uniform sampler2D u_scene; uniform vec2 u_px; uniform float u_thr; uniform float u_full;",
    "void main(){",
    "    vec3 c = (texture2D(u_scene, v + u_px*vec2(-1.0,-1.0)).rgb + texture2D(u_scene, v + u_px*vec2(1.0,-1.0)).rgb",
    "            + texture2D(u_scene, v + u_px*vec2(-1.0,1.0)).rgb + texture2D(u_scene, v + u_px*vec2(1.0,1.0)).rgb)*0.25;",
    "    vec2 p = gamePos(v); float m = u_full;",
    "    for(int i=0; i<" + GLFX_MAX + "; i++){",
    "        vec4 A = u_b0[i], B = u_b1[i];",
    "        if(B.z > 0.0) m = max(m, B.w*(1.0 - smoothstep(0.0, B.z, length(p - A.xy))));",
    "    }",
    "    float l = max(max(c.r, c.g), c.b);",
    "    gl_FragColor = vec4(c*smoothstep(u_thr, 1.0, l)*m, 1.0);",
    "}"
].join("\n");
//ぼかし(9点のガウス。縦か横の一方向)
var GLFX_BLUR = [
    "precision mediump float; varying vec2 v; uniform sampler2D u_tex; uniform vec2 u_dir;",
    "void main(){",
    "    vec4 c = texture2D(u_tex, v)*0.227027;",
    "    c += (texture2D(u_tex, v + u_dir*1.0) + texture2D(u_tex, v - u_dir*1.0))*0.1945946;",
    "    c += (texture2D(u_tex, v + u_dir*2.0) + texture2D(u_tex, v - u_dir*2.0))*0.1216216;",
    "    c += (texture2D(u_tex, v + u_dir*3.0) + texture2D(u_tex, v - u_dir*3.0))*0.054054;",
    "    c += (texture2D(u_tex, v + u_dir*4.0) + texture2D(u_tex, v - u_dir*4.0))*0.016216;",
    "    gl_FragColor = c;",
    "}"
].join("\n");
//仕上げ：かげろう(立ちのぼる揺らぎ)と衝撃波の輪(レンズのような屈折と色のずれ)で歪めて写し、にじみを足す
var GLFX_FINAL = GLFX_HEAD + [
    "uniform sampler2D u_scene; uniform sampler2D u_bloom; uniform sampler2D u_wide; uniform float u_t; uniform float u_bk; uniform float u_bk2;",
    "uniform vec4 u_pr[" + GLFX_PROTECT + "];",      //にじみを弱める円 x, y, 半径, 使うか(1/0)
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }",
    "float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f);",
    "    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }",
    "void main(){",
    "    vec2 p = gamePos(v), off = vec2(0.0); float ca = 0.0; vec2 cdir = vec2(1.0, 0.0);",
    "    for(int i=0; i<" + GLFX_MAX + "; i++){",
    "        vec4 A = u_b0[i], B = u_b1[i];",
    "        vec2 d = p - A.xy; float r = length(d);",
    "        if(A.z > 0.0 && r < A.w){",
    "            float k = 1.0 - r*r/(A.w*A.w); k *= k;",
    "            vec2 q = p*" + GLFX_HAZE_FREQ.toFixed(4) + " + vec2(0.0, u_t*" + GLFX_HAZE_RISE.toFixed(4) + ");",
    "            vec2 n = vec2(noise(q), noise(q + vec2(7.3, 2.1))) + 0.5*vec2(noise(q*2.3 + 3.0), noise(q*2.3 + 9.0)) - 0.75;",
    "            off += n*A.z*k*1.6;",
    "        }",
    "        if(B.y > 0.0){",
    "            float s = (r - B.x)/" + GLFX_RING_W.toFixed(1) + ", k = exp(-s*s*2.0);",
    "            vec2 dir = d/max(r, 1.0);",
    "            off -= dir*B.y*s*k;",
    "            if(B.y*k*" + GLFX_RING_CA.toFixed(3) + " > ca){ ca = B.y*k*" + GLFX_RING_CA.toFixed(3) + "; cdir = dir; }",
    "        }",
    "    }",
    "    vec2 o = vec2(off.x, -off.y)*u_m.xy/u_res, uv = v + o;",
    "    vec3 col;",
    "    if(ca > 0.05){",
    "        vec2 c = vec2(cdir.x, -cdir.y)*ca*u_m.xy/u_res;",
    "        col = vec3(texture2D(u_scene, uv + c).r, texture2D(u_scene, uv).g, texture2D(u_scene, uv - c).b);",
    "    }else col = texture2D(u_scene, uv).rgb;",
    "    vec3 bl = texture2D(u_bloom, v).rgb*u_bk + texture2D(u_wide, v).rgb*u_bk2;",
    "    float keep = 1.0;",
    "    for(int i=0; i<" + GLFX_PROTECT + "; i++){",
    "        vec4 P = u_pr[i];",
    "        if(P.w > 0.0) keep = min(keep, mix(" + GLFX_PROTECT_K.toFixed(3) + ", 1.0, smoothstep(P.z*0.55, P.z, length(p - P.xy))));",
    "    }",
    //足し算ではなくスクリーン合成で重ねる(明るい所が白く飛んで、形が埋もれないように)
    "    col = 1.0 - (1.0 - col)*(1.0 - clamp(bl*keep, 0.0, 1.0));",
    "    gl_FragColor = vec4(col, 1.0);",
    "}"
].join("\n");
//光る物だけを描いた層(透明の上)をぼかした光：近くのにじみと遠くの淡いにじみを足して、透明を残したまま出す(色は透明を掛けた値)
var GLFX_GLOW = [
    "precision mediump float; varying vec2 v; uniform sampler2D u_bloom; uniform sampler2D u_wide; uniform float u_bk; uniform float u_bk2;",
    "void main(){ gl_FragColor = min(texture2D(u_bloom, v)*u_bk + texture2D(u_wide, v)*u_bk2, vec4(1.0)); }"
].join(" ");

var glFx = {
    on:/[#&]gl(&|$)/.test(location.hash),      //#gl で使う(G キーで入り切り)
    ok:null,        //null まだ試していない / true 使える / false 使えない
    fail:"",        //使えない理由
    ms:0,           //直近の後処理にかかった時間(ms。JavaScript の側だけ。GPU の時間は含まない)
    msAvg:0,
    used:false,     //このコマで使ったか(表示用)
    glows:0,        //光の層(glow)を描いた回数(テスト用)
    cv:null, gl:null, w:0, h:0, lw:0, lh:0,
    //使えるか(はじめて呼ばれたときに用意する)
    ready:function(){
        this.used = false;      //描くコマごとに呼ばれるので、ここで消す(post で使えたら立つ)
        if(!this.on) return false;
        if(this.ok === null) this.init();
        return this.ok;
    },
    init:function(){
        this.ok = false;
        var cv = document.createElement("canvas"), gl = null;
        //透明を残せるように alpha あり(光の層 glow で使う)。色は透明を掛けた値で扱う
        try{ gl = cv.getContext("webgl", { alpha:true, antialias:false, depth:false, stencil:false, premultipliedAlpha:true }); }catch(e){}
        if(!gl){ this.fail = "WebGL が使えない"; return; }
        this.cv = cv; this.gl = gl;
        var vs = this.shader(gl.VERTEX_SHADER, GLFX_VS);
        this.pBright = this.program(vs, GLFX_BRIGHT);
        this.pBlur   = this.program(vs, GLFX_BLUR);
        this.pFinal  = this.program(vs, GLFX_FINAL);
        this.pGlow   = this.program(vs, GLFX_GLOW);
        if(!this.pBright || !this.pBlur || !this.pFinal || !this.pGlow) return;
        this.buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        this.scene = this.texture();
        this.lowA = this.texture(); this.lowB = this.texture(); this.wideA = this.texture(); this.wideB = this.texture();
        this.fbA = gl.createFramebuffer(); this.fbB = gl.createFramebuffer(); this.fbC = gl.createFramebuffer(); this.fbD = gl.createFramebuffer();
        this.b0 = new Float32Array(GLFX_MAX*4); this.b1 = new Float32Array(GLFX_MAX*4);
        this.ok = true;
    },
    shader:function(_type, _src){
        var gl = this.gl, s = gl.createShader(_type);
        gl.shaderSource(s, _src); gl.compileShader(s);
        if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ this.fail = "シェーダーの誤り：" + gl.getShaderInfoLog(s); return null; }
        return s;
    },
    program:function(_vs, _fsSrc){
        var gl = this.gl, fs = this.shader(gl.FRAGMENT_SHADER, _fsSrc);
        if(!_vs || !fs) return null;
        var p = gl.createProgram();
        gl.attachShader(p, _vs); gl.attachShader(p, fs);
        gl.bindAttribLocation(p, 0, "a");
        gl.linkProgram(p);
        if(!gl.getProgramParameter(p, gl.LINK_STATUS)){ this.fail = "シェーダーの誤り：" + gl.getProgramInfoLog(p); return null; }
        p.u = {};
        var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for(var i=0; i<n; i++){ var name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, ""); p.u[name] = gl.getUniformLocation(p, name); }
        return p;
    },
    //大きさが2のべき乗でない画像も使えるよう、くり返さず・縮小画像を作らない
    texture:function(){
        var gl = this.gl, t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
    },
    //ゲームのキャンバスの細かさ(renderScale)が変わったら、作業用の画像も作り直す
    resize:function(){
        var gl = this.gl;
        if(this.w == canvas.width && this.h == canvas.height) return;
        this.w = this.cv.width = canvas.width; this.h = this.cv.height = canvas.height;
        //ぼかす画像はゲームの大きさに対して決める(キャンバスの画素に対して決めると、細かいほど光が小さくなる)
        this.lw = Math.ceil(CW/GLFX_BLOOM_DIV); this.lh = Math.ceil(CH/GLFX_BLOOM_DIV);
        this.ww = Math.ceil(CW/GLFX_WIDE_DIV); this.wh = Math.ceil(CH/GLFX_WIDE_DIV);
        [[this.lowA, this.fbA, this.lw, this.lh], [this.lowB, this.fbB, this.lw, this.lh], [this.wideA, this.fbC, this.ww, this.wh], [this.wideB, this.fbD, this.ww, this.wh]].forEach(function(p){
            gl.bindTexture(gl.TEXTURE_2D, p[0]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, p[2], p[3], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.bindFramebuffer(gl.FRAMEBUFFER, p[1]);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, p[0], 0);
        }, this);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    use:function(_p){
        var gl = this.gl, m = ctx.getTransform();
        gl.useProgram(_p);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        if(_p.u.u_res) gl.uniform2f(_p.u.u_res, this.w, this.h);
        if(_p.u.u_m) gl.uniform4f(_p.u.u_m, m.a, m.d, m.e, m.f);
        if(_p.u.u_b0){ gl.uniform4fv(_p.u.u_b0, this.b0); gl.uniform4fv(_p.u.u_b1, this.b1); }
    },
    pass:function(_fb, _w, _h, _tex0, _tex1, _tex2){
        var gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, _fb);
        gl.viewport(0, 0, _w, _h);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, _tex0);
        if(_tex1){ gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, _tex1); }
        if(_tex2){ gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, _tex2); }
        gl.activeTexture(gl.TEXTURE0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    //後処理をかけて、ゲームのキャンバスへ描き戻す
    //_list: [{ x, y, haze(かげろうの強さ px), hazeR(半径), ring(輪の半径), ringAmp(輪の屈折 px), bloomR(にじむ半径), bloom(にじむ強さ 0～1) }]
    //_t: 模様を動かす時刻(秒)
    //_opt: 画面全体にかけるとき { full:画面全体のにじみの強さ 0～1, thr:にじませる明るさ, bloom:近くのにじみ, wide:遠くまで広がる淡いにじみ,
    //       protect:[{ x, y, r }](キャラの体の上など、にじみを弱める円) }
    post:function(_list, _t, _opt){
        var o = _opt || {};
        this.used = false;
        if(!this.ready() || (!_list.length && !o.full)) return false;
        var t0 = performance.now(), gl = this.gl;
        this.resize();
        gl.bindTexture(gl.TEXTURE_2D, this.scene);
        try{ gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); }
        catch(e){ this.ok = false; this.fail = "キャンバスが汚染されていて WebGL へ渡せない(" + e.name + ")"; return false; }
        this.b0.fill(0); this.b1.fill(0);
        for(var i=0; i<_list.length && i<GLFX_MAX; i++){
            var s = _list[i];
            this.b0.set([s.x, s.y, s.haze || 0, s.hazeR || 1], i*4);
            this.b1.set([s.ring || 0, s.ringAmp || 0, s.bloomR || 0, s.bloom || 0], i*4);
        }
        //明るい所を取り出して縮める → 縦横にぼかす
        this.use(this.pBright);
        gl.uniform1i(this.pBright.u.u_scene, 0);
        //縮める元の4点は、キャンバスの細かさに合わせて離す(細かいほど1マスに入る画素が多い)
        gl.uniform2f(this.pBright.u.u_px, this.w/CW/this.w, this.h/CH/this.h);
        gl.uniform1f(this.pBright.u.u_thr, o.thr != null ? o.thr : GLFX_BLOOM_THR);
        gl.uniform1f(this.pBright.u.u_full, o.full || 0);
        this.pass(this.fbA, this.lw, this.lh, this.scene);
        this.use(this.pBlur);
        gl.uniform1i(this.pBlur.u.u_tex, 0);
        this.blur(this.fbA, this.fbB, this.lowA, this.lowB, this.lw, this.lh);
        //遠くまで広がるにじみは、ぼかしたあとの画像をさらに縮めて作る(元の画面から直接縮めると、小さな弾が拾われたり漏れたりしてちらつく)
        if(o.wide){
            gl.uniform2f(this.pBlur.u.u_dir, 1.5/this.lw, 1.5/this.lh);
            this.pass(this.fbC, this.ww, this.wh, this.lowA);
            this.blur(this.fbC, this.fbD, this.wideA, this.wideB, this.ww, this.wh);
        }
        //歪めて写し、にじみを足す
        this.use(this.pFinal);
        gl.uniform1i(this.pFinal.u.u_scene, 0);
        gl.uniform1i(this.pFinal.u.u_bloom, 1);
        gl.uniform1i(this.pFinal.u.u_wide, 2);
        gl.uniform1f(this.pFinal.u.u_t, _t || 0);
        gl.uniform1f(this.pFinal.u.u_bk, o.bloom != null ? o.bloom : 1);
        gl.uniform1f(this.pFinal.u.u_bk2, o.wide || 0);
        var pr = new Float32Array(GLFX_PROTECT*4), pl = o.protect || [];
        for(var i=0; i<pl.length && i<GLFX_PROTECT; i++) pr.set([pl[i].x, pl[i].y, pl[i].r, 1], i*4);
        gl.uniform4fv(this.pFinal.u.u_pr, pr);
        this.pass(null, this.w, this.h, this.scene, this.lowA, this.wideA);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(this.cv, 0, 0);
        ctx.restore();
        this.ms = performance.now() - t0;
        this.msAvg = this.msAvg ? this.msAvg*0.9 + this.ms*0.1 : this.ms;
        this.used = true;
        return true;
    },
    //光る物だけを描く層(透明。ゲームのキャンバスの 1/GLFX_BLOOM_DIV の大きさ)を用意して返す。
    //今の ctx の座標(寄り・揺れも)のまま描けるよう、縮めた変換を付けてある。描いたら glow() でにじませる
    layer:function(){
        if(!this.ready()) return null;
        this.resize();
        if(!this.lc){ this.lc = document.createElement("canvas"); this.lx = this.lc.getContext("2d"); }
        if(this.lc.width != this.lw || this.lc.height != this.lh){ this.lc.width = this.lw; this.lc.height = this.lh; }
        var m = ctx.getTransform(), k = this.lw/this.w;
        this.lx.setTransform(1, 0, 0, 1, 0, 0);
        this.lx.clearRect(0, 0, this.lw, this.lh);
        this.lx.setTransform(m.a*k, m.b*k, m.c*k, m.d*k, m.e*k, m.f*k);
        return this.lx;
    },
    //layer() に描いた物をぼかし、光としてゲームのキャンバスに重ねる(_bloom 近くのにじみ、_wide 遠くまで広がる淡いにじみ)
    glow:function(_bloom, _wide){
        if(!this.ok || !this.lc) return false;
        var gl = this.gl;
        //層を写す(透明のふちが黒ずまないよう、色に透明を掛けて読む)。lowB の中身を置きかえるので、フレームバッファにつなぎ直す
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, this.lowB);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.lc);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbB);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.lowB, 0);
        this.use(this.pBlur);
        gl.uniform1i(this.pBlur.u.u_tex, 0);
        gl.uniform2f(this.pBlur.u.u_dir, 0, 0);       //写すだけ
        this.pass(this.fbA, this.lw, this.lh, this.lowB);
        this.blur(this.fbA, this.fbB, this.lowA, this.lowB, this.lw, this.lh);
        if(_wide){
            gl.uniform2f(this.pBlur.u.u_dir, 1.5/this.lw, 1.5/this.lh);
            this.pass(this.fbC, this.ww, this.wh, this.lowA);
            this.blur(this.fbC, this.fbD, this.wideA, this.wideB, this.ww, this.wh);
        }
        this.use(this.pGlow);
        gl.uniform1i(this.pGlow.u.u_bloom, 1);
        gl.uniform1i(this.pGlow.u.u_wide, 2);
        gl.uniform1f(this.pGlow.u.u_bk, _bloom);
        gl.uniform1f(this.pGlow.u.u_bk2, _wide || 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.w, this.h);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.pass(null, this.w, this.h, this.lowB, this.lowA, _wide ? this.wideA : this.lowA);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(this.cv, 0, 0);
        ctx.restore();
        this.glows++;
        return true;
    },
    //縦横にぼかす(_fa の画像 _ta を、_tb を通して _ta へ戻す)
    blur:function(_fa, _fb, _ta, _tb, _w, _h){
        var gl = this.gl;
        for(var k=0; k<GLFX_BLUR_PASS; k++){
            gl.uniform2f(this.pBlur.u.u_dir, (k + 1)/_w, 0);
            this.pass(_fb, _w, _h, _ta);
            gl.uniform2f(this.pBlur.u.u_dir, 0, (k + 1)/_h);
            this.pass(_fa, _w, _h, _tb);
        }
    },
    //使っているかを画面の左上の下に小さく出す(#gl のときだけ)
    drawInfo:function(){
        if(!glFxWanted()) return;
        ctx.save();
        ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        var s = !this.on ? "WebGL 後処理：切(G で入)" : (this.ok === false ? "WebGL 後処理：使えない " + this.fail
              : "WebGL 後処理：入(G で切)" + (this.used ? "  " + this.msAvg.toFixed(2) + "ms" : ""));
        ctx.fillStyle = this.on && this.ok !== false ? "#0a7" : "#999";
        ctx.fillText(s, CW/2, 21);
        ctx.restore();
    }
};
//G キーで入り切り(URL に #gl があるときだけ。見比べ用)
//キーは位置(e.code)で見る(日本語入力がオンだと e.key が "Process" になり、効かないため)。
//開いたあとで URL に #gl を足したときも使えるよう、押すたび・URL が変わるたびに確かめる
function glFxWanted(){ return /[#&]gl(&|$)/.test(location.hash); }
window.addEventListener("keydown", function(e){
    if(e.code == "KeyG" && glFxWanted()) glFx.on = !glFx.on;
});
window.addEventListener("hashchange", function(){ glFx.on = glFxWanted(); });
