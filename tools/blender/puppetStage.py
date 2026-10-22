# 傀儡師戦の背景「人形劇の舞台」を Blender で描く(scripts/drone/puppetStage.js が使う)
#   使い方(画面なしで動かす):
#     "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python tools/blender/puppetStage.py -- [出力のフォルダ] [--fast]
#   出力(いつもは images/game/puppeteer/)：
#     stage.jpg  奥：書き割りの夜空と紙の月(糸で吊る)・板で切り抜いた町並み(2列)・舞台の床
#     frame.png  手前：左右の緞帳(どんちょう)・上の垂れ幕・床のふちの脚光(フットライト)。まんなかは透明
#   --variant=2：stage2.jpg 第2幕「血の月」(赤い月・赤い照明・赤い窓)
#   --variant=3：stage3.jpg 第3幕「悪夢」(書き割りが裂けて奥の闇が見え、糸が増え、下から赤い光)
#   --curtain：curtain.png 幕間に下りてくる、閉じた緞帳(画面いっぱい。下のふちに金の房)
#   奥はドローン君の動きと逆へ少しずらして貼る(奥行き)ので、ゲームの画面より STAGE_OVER 倍だけ広く描く。
#   座標：x 右・z 上・y 奥(客席から舞台を見る)。舞台の口の幅を 9.6(ゲームの 960px)にそろえる。
import bpy, sys, os, math, random
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
FAST = "--fast" in ARGS
VARIANT = int(next((a.split("=")[1] for a in ARGS if a.startswith("--variant=")), "1"))
CURTAIN = "--curtain" in ARGS
V = VARIANT
ARGV = [a for a in ARGS if not a.startswith("--")]
OUTDIR = os.path.abspath(ARGV[0] if ARGV else "images/game/puppeteer")
os.makedirs(OUTDIR, exist_ok=True)

PX = 2              # ゲームの1px を何画素で描くか
STAGE_OVER = 1.06   # 奥の絵を画面よりこれだけ広く描く(ずらしても端が見えないように)。puppetStage.js の STAGE_OVER と同じ
SEED = 11
rnd = random.Random(SEED)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ 材質の部品(puppeteer.py と同じ書き方)
class Nodes:
    def __init__(self, mat):
        self.nt = mat.node_tree; self.N = self.nt.nodes; self.L = self.nt.links
        self.tc = self.N.new("ShaderNodeTexCoord")
        xyz = self.N.new("ShaderNodeSeparateXYZ"); self.L.new(self.tc.outputs["Object"], xyz.inputs[0])
        self.x, self.y, self.z = xyz.outputs["X"], xyz.outputs["Y"], xyz.outputs["Z"]
    def link(self, a, b):
        if isinstance(a, (int, float)): b.default_value = a
        else: self.L.new(a, b)
    def math(self, op, a, b=0.0, clamp=False):
        n = self.N.new("ShaderNodeMath"); n.operation = op; n.use_clamp = clamp
        self.link(a, n.inputs[0]); self.link(b, n.inputs[1]); return n.outputs[0]
    def band(self, v, lo, hi):
        r = self.N.new("ShaderNodeMapRange"); r.interpolation_type = "SMOOTHSTEP"
        r.inputs["From Min"].default_value = lo; r.inputs["From Max"].default_value = hi
        self.link(v, r.inputs["Value"]); return r.outputs["Result"]
    def noise(self, scale, detail=6, rough=0.6, dist=0.0, vec=None, out="Fac"):
        z = self.N.new("ShaderNodeTexNoise"); z.inputs["Scale"].default_value = scale; z.inputs["Detail"].default_value = detail
        z.inputs["Roughness"].default_value = rough; z.inputs["Distortion"].default_value = dist
        self.L.new(vec if vec is not None else self.tc.outputs["Object"], z.inputs["Vector"]); return z.outputs[out]
    def stretch(self, sx, sy, sz):
        mp = self.N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (sx, sy, sz)
        self.L.new(self.tc.outputs["Object"], mp.inputs["Vector"]); return mp.outputs["Vector"]
    def ramp(self, fac, stops):
        r = self.N.new("ShaderNodeValToRGB"); cr = r.color_ramp
        cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
        cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
        for p, c in stops[1:-1]:
            e = cr.elements.new(p); e.color = (*c, 1)
        self.link(fac, r.inputs["Fac"]); return r.outputs["Color"]
    def bsdf(self, color, rough, metal=0.0, **kw):
        b = self.N.new("ShaderNodeBsdfPrincipled")
        if isinstance(color, tuple): b.inputs["Base Color"].default_value = (*color, 1)
        else: self.L.new(color, b.inputs["Base Color"])
        b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
        for k, v in kw.items(): b.inputs[k.replace("_", " ")].default_value = v
        return b.outputs[0]
    def mix(self, a, b, fac):
        x = self.N.new("ShaderNodeMixShader"); self.link(fac, x.inputs[0])
        self.L.new(a, x.inputs[1]); self.L.new(b, x.inputs[2]); return x.outputs[0]
    def mixc(self, a, b, fac):
        x = self.N.new("ShaderNodeMix"); x.data_type = "RGBA"; self.link(fac, x.inputs["Factor"])
        for s, v in ((x.inputs[6], a), (x.inputs[7], b)):
            if isinstance(v, tuple): s.default_value = (*v, 1)
            else: self.L.new(v, s)
        return x.outputs[2]
    def bump(self, h, strength, dist=0.02):
        bp = self.N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength; bp.inputs["Distance"].default_value = dist
        self.L.new(h, bp.inputs["Height"]); return bp.outputs["Normal"]
    def emit(self, color, strength):
        e = self.N.new("ShaderNodeEmission")
        if isinstance(color, tuple): e.inputs["Color"].default_value = (*color, 1)
        else: self.L.new(color, e.inputs["Color"])
        e.inputs["Strength"].default_value = strength; return e.outputs[0]
    def add(self, a, b):
        x = self.N.new("ShaderNodeAddShader"); self.L.new(a, x.inputs[0]); self.L.new(b, x.inputs[1]); return x.outputs[0]
    def out(self, s):
        self.L.new(s, self.N["Material Output"].inputs["Surface"])
    def ao(self, dist=0.3):
        a = self.N.new("ShaderNodeAmbientOcclusion"); a.inputs["Distance"].default_value = dist
        return self.math("SUBTRACT", 1.0, a.outputs["AO"], True)

def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.node_tree.nodes.remove(m.node_tree.nodes["Principled BSDF"])
    return m, Nodes(m)

def set_normal(sock, normal):
    node = sock.node; node.id_data.links.new(normal, node.inputs["Normal"])

# 書き割りの空：布に描いた夕闇の空(明るめの黄土色から上は深い藍へ)。筆の跡のむら・布目・しみ・ところどころ絵の具の剥げ
sky, n = material("sky")
grad = n.band(n.z, 0.3, 5.2)
SKY_RAMP = {
    1:[(0.0, (0.55, 0.36, 0.20)), (0.3, (0.40, 0.22, 0.18)), (0.65, (0.16, 0.11, 0.18)), (1.0, (0.06, 0.05, 0.10))],
    2:[(0.0, (0.50, 0.14, 0.10)), (0.3, (0.34, 0.08, 0.08)), (0.65, (0.13, 0.04, 0.07)), (1.0, (0.05, 0.02, 0.05))],     # 血の月
    3:[(0.0, (0.26, 0.12, 0.22)), (0.3, (0.17, 0.07, 0.16)), (0.65, (0.07, 0.03, 0.09)), (1.0, (0.02, 0.01, 0.03))],     # 悪夢
}
col = n.ramp(grad, SKY_RAMP[V])
stroke = n.noise(1.0, 4, 0.6, 0.6, n.stretch(0.6, 0.6, 2.2))        # 横に流れる筆のむら
col = n.mixc(col, n.mixc(col, (0.0, 0.0, 0.0), 0.35), n.band(stroke, 0.45, 0.75))
stain = n.band(n.noise(0.7, 8, 0.7), 0.55, 0.8)                     # 古い布のしみ
col = n.mixc(col, (0.18, 0.12, 0.08), n.math("MULTIPLY", stain, 0.5))
cloth = n.N.new("ShaderNodeTexWave"); cloth.inputs["Scale"].default_value = 140; cloth.wave_type = "BANDS"
n.L.new(n.tc.outputs["Object"], cloth.inputs["Vector"])
b = n.bsdf(col, 0.95)
set_normal(b, n.bump(n.math("ADD", cloth.outputs["Fac"], n.noise(30, 3)), 0.15, 0.004))
n.out(b)

# 紙の月：黄ばんだ和紙。描いた欠け(クレーター)と、ふちの破れ・裏の骨組みの影
moon, n = material("moon")
MOON_COL = {1:((0.92, 0.80, 0.52), (0.62, 0.48, 0.28)), 2:((0.95, 0.22, 0.14), (0.55, 0.08, 0.06)), 3:((0.75, 0.30, 0.35), (0.35, 0.10, 0.15))}[V]
mc = n.mixc(MOON_COL[0], MOON_COL[1], n.band(n.noise(5, 6, 0.65), 0.45, 0.72))
mb = n.bsdf(mc, 0.9, Subsurface_Weight=0.3, Subsurface_Radius=(0.2, 0.15, 0.1))
set_normal(mb, n.bump(n.noise(40, 6), 0.3, 0.01))
n.out(n.add(mb, n.emit(mc, 0.25)))

# 切り抜きの町(板)：黒く塗った板に木目、ふちは塗りが剥げて木地が出る
flat, n = material("flat")
wood = n.N.new("ShaderNodeTexWave"); wood.wave_type = "BANDS"; wood.bands_direction = "Z"; wood.inputs["Scale"].default_value = 3
wood.inputs["Distortion"].default_value = 8; wood.inputs["Detail"].default_value = 4
n.L.new(n.tc.outputs["Object"], wood.inputs["Vector"])
paint = n.bsdf((0.012, 0.01, 0.016), 0.75)
set_normal(paint, n.bump(wood.outputs["Fac"], 0.15, 0.01))
bare = n.bsdf((0.30, 0.18, 0.09), 0.8)
n.out(n.mix(paint, bare, n.math("MULTIPLY", n.band(n.noise(9, 6), 0.62, 0.72), 0.85)))
# 窓の灯り(切り抜きの裏から透ける色紙)
win, n = material("window")
n.out(n.emit({1:(1.0, 0.62, 0.25), 2:(1.0, 0.18, 0.08), 3:(0.6, 0.2, 0.9)}[V], {1:2.2, 2:2.6, 3:1.2}[V]))

# 床：古い板張り。すり減った所が明るく、継ぎ目は暗い
floor, n = material("floor")
planks = n.N.new("ShaderNodeTexBrick"); planks.inputs["Scale"].default_value = 1.4
planks.inputs["Mortar Size"].default_value = 0.008; planks.offset = 0.5
planks.inputs["Color1"].default_value = (0.20, 0.11, 0.055, 1); planks.inputs["Color2"].default_value = (0.13, 0.07, 0.035, 1)
planks.inputs["Mortar"].default_value = (0.01, 0.006, 0.004, 1)
mp = n.N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (3.0, 0.12, 1.0)
n.L.new(n.tc.outputs["Object"], mp.inputs["Vector"]); n.L.new(mp.outputs["Vector"], planks.inputs["Vector"])
fc = n.mixc(planks.outputs["Color"], (0.34, 0.22, 0.12), n.math("MULTIPLY", n.band(n.noise(2, 6), 0.5, 0.75), 0.5))
fb = n.bsdf(fc, 0.45)
set_normal(fb, n.bump(planks.outputs["Fac"], 0.4, 0.01))
n.out(fb)

# 緞帳：深い赤のビロード(ひだの山が照る)。すそはほこり
curtain, n = material("curtain")
cb = n.bsdf((0.07, 0.005, 0.01), 0.8, Sheen_Weight=1.0, Sheen_Roughness=0.3, Sheen_Tint=(1.0, 0.45, 0.4, 1))
set_normal(cb, n.bump(n.noise(80, 2), 0.1, 0.004))
n.out(n.mix(cb, n.bsdf((0.12, 0.08, 0.07), 1.0), n.math("MULTIPLY", n.band(n.z, -4.6, -5.4), n.band(n.noise(4, 6), 0.4, 0.7), True)))
gold, n = material("gold")
gb = n.bsdf((0.72, 0.52, 0.22), 0.35, 1.0)
n.out(n.mix(gb, n.bsdf((0.12, 0.08, 0.03), 0.8), n.math("ADD", n.math("MULTIPLY", n.ao(0.15), 1.2), n.math("MULTIPLY", n.band(n.noise(10, 6), 0.5, 0.7), 0.6), True)))
string, n = material("string")
n.out(n.bsdf((0.32, 0.29, 0.26), 0.9) if V < 3 else n.add(n.bsdf((0.4, 0.15, 0.18), 0.9), n.emit((0.8, 0.1, 0.15), 0.4)))     # 悪夢では糸が赤く光る
lamp, n = material("lamp")
n.out(n.emit((1.0, 0.75, 0.4), 8.0))

def obj(name, me, mats):
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    for m in mats: o.data.materials.append(m)
    return o

def mesh(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update(); return me

def smooth(o):
    for p in o.data.polygons: p.use_smooth = True

FRAME = []      # 手前の絵(frame.png)に入れる物

# ------------------------------------------------------------------ 舞台
W = 9.6*STAGE_OVER          # 画面に入る幅(奥の絵)
H = 5.4*STAGE_OVER
FLOOR_Z = -2.35             # 舞台の床の高さ(画面の下から 0.35 ほど床が見える)
BACK_Y = 6.0                # 書き割りの奥行き

# 書き割り(奥の幕)：少したるんで波打つ布
bv, bf = [], []
NX, NZ = 80, 40
for i in range(NZ + 1):
    for j in range(NX + 1):
        x = -W*0.9 + W*1.8*j/NX; z = FLOOR_Z - 0.2 + (H + 3.0)*i/NZ
        y = BACK_Y + 0.08*math.sin(x*2.1 + z*0.4) + 0.05*math.sin(x*5.3)
        bv.append(Vector((x, y, z)))
for i in range(NZ):
    for j in range(NX):
        a = i*(NX + 1) + j; bf.append((a, a + 1, a + NX + 2, a + NX + 1))
# 悪夢：書き割りに縦の大きな裂け目(ぎざぎざ)。奥の闇が見える
TEARS = [(-3.1, 0.55, 0.2), (0.4, 0.75, -0.3), (3.6, 0.5, 0.5)] if V == 3 else []     # (横の位置, 最大の幅, 中心の高さ)
def torn(a, b, c_, d):
    cx = (bv[a].x + bv[c_].x)/2; cz = (bv[a].z + bv[c_].z)/2
    for (tx, tw, tz) in TEARS:
        w = tw*max(0, 1 - ((cz - tz)/2.6)**2) + 0.12*math.sin(cz*9 + tx*3) + 0.06*math.sin(cz*23 + tx)
        if abs(cx - tx - 0.15*math.sin(cz*2.3 + tx)) < w: return True
    return False
bf = [f_ for f_ in bf if not torn(*f_)]
back = obj("backdrop", mesh("backdrop", bv, bf), [sky]); smooth(back)

# 紙の月(糸で吊る。少し傾いている)
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.62, depth=0.03, location=(2.6, BACK_Y - 1.2, 1.55), rotation=(math.pi/2, 0, 0.08))
m = bpy.context.object; m.data.materials.append(moon)
# 三日月にする(右側を丸く切る)
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.55, depth=0.2, location=(2.85, BACK_Y - 1.2, 1.68), rotation=(math.pi/2, 0, 0))
cut = bpy.context.object; cut.hide_render = True
bo = m.modifiers.new("cres", "BOOLEAN"); bo.object = cut; bo.operation = "DIFFERENCE"; bo.solver = "EXACT"
for dx in (-0.25, 0.2):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.006, depth=4.0, location=(2.6 + dx, BACK_Y - 1.2, 1.55 + 2.4))
    bpy.context.object.data.materials.append(string)

# 星：紙の星を糸で吊る(ところどころ)
for k in range(9):
    x = rnd.uniform(-4.5, 4.5); z = rnd.uniform(1.0, 2.6)
    if abs(x - 2.6) < 0.9 and abs(z - 1.55) < 0.9: continue
    r = rnd.uniform(0.05, 0.1)
    pts = []
    for q in range(10):
        a = math.pi/2 + q*math.pi/5; rr = r if q % 2 == 0 else r*0.45
        pts.append(Vector((x + rr*math.cos(a), BACK_Y - 0.9, z + rr*math.sin(a))))
    st = obj("star", mesh("star", pts, [tuple(range(10))]), [moon])
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.004, depth=3.0, location=(x, BACK_Y - 0.9, z + r + 1.5))
    bpy.context.object.data.materials.append(string)

# 切り抜きの町：屋根の並びを板で切り抜き、窓は灯りの色紙。2列(奥ほど低く暗い)
def skyline(y, base, hmin, hmax, seed, tall=0.0):
    r = random.Random(seed)
    x = -W*0.62
    while x < W*0.62:
        w = r.uniform(0.35, 0.8); h = r.uniform(hmin, hmax) + (tall if r.random() < 0.12 else 0)
        z0 = base; z1 = base + h
        roof = r.choice(["flat", "gable", "tower"])
        pts = [(x, z0), (x + w, z0), (x + w, z1)]
        if roof == "gable": pts += [(x + w/2, z1 + w*0.45)]
        elif roof == "tower":
            pts += [(x + w*0.72, z1), (x + w*0.72, z1 + 0.35), (x + w*0.5, z1 + 0.6), (x + w*0.28, z1 + 0.35), (x + w*0.28, z1)]
        pts += [(x, z1)]
        verts = [Vector((px, y, pz)) for px, pz in pts] + [Vector((px, y + 0.05, pz)) for px, pz in pts]
        N_ = len(pts)
        faces = [tuple(range(N_ - 1, -1, -1)), tuple(range(N_, 2*N_))] + [(k, (k + 1) % N_, N_ + (k + 1) % N_, N_ + k) for k in range(N_)]
        obj("flat", mesh("flat", verts, faces), [flat])
        # 窓
        for wy in range(int(h/0.32)):
            for wx in range(max(1, int(w/0.22))):
                if r.random() < 0.35:
                    cx = x + 0.12 + wx*0.22; cz = z0 + 0.25 + wy*0.32
                    if cx + 0.06 > x + w - 0.05 or cz + 0.08 > z1 - 0.05: continue
                    q = [Vector((cx, y - 0.005, cz)), Vector((cx + 0.07, y - 0.005, cz)), Vector((cx + 0.07, y - 0.005, cz + 0.1)), Vector((cx, y - 0.005, cz + 0.1))]
                    obj("win", mesh("win", q, [(0, 1, 2, 3)]), [win])
        # 板を立てる支え(裏の角材。横から見えるように少しはみ出す)
        x += w + r.uniform(-0.05, 0.12)
skyline(BACK_Y - 0.7, FLOOR_Z - 0.1, 0.45, 1.0, SEED + 1, 0.7)    # ドローン君が町に溶けないよう、低くまばらに
skyline(BACK_Y - 2.2, FLOOR_Z - 0.1, 0.25, 0.6, SEED + 2)

# 上から垂れる糸：ほつれた操り糸が何本も。ところどころ小さな操り板が絡んだまま吊られている
for k in range({1:24, 2:30, 3:70}[V]):
    x = rnd.uniform(-4.6, 4.6); yy = rnd.uniform(-0.6, BACK_Y - 0.4); zb = rnd.uniform(-0.6, 2.4)
    L_ = 6.0 - zb
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.005, depth=L_, location=(x, yy, zb + L_/2), rotation=(0, rnd.uniform(-0.03, 0.03), 0))
    bpy.context.object.data.materials.append(string)
    if rnd.random() < 0.3:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, yy, zb)); o = bpy.context.object; o.scale = (0.32, 0.03, 0.035); o.rotation_euler = (0, rnd.uniform(-0.5, 0.5), 0); o.data.materials.append(flat)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, yy, zb - 0.06)); o = bpy.context.object; o.scale = (0.035, 0.03, 0.22); o.data.materials.append(flat)

# 床：手前から奥まで
fv = [Vector((-W, -2.0, FLOOR_Z)), Vector((W, -2.0, FLOOR_Z)), Vector((W, BACK_Y + 0.5, FLOOR_Z)), Vector((-W, BACK_Y + 0.5, FLOOR_Z))]
obj("floor", mesh("floor", fv, [(0, 1, 2, 3)]), [floor])

# ------------------------------------------------------------------ 手前：緞帳・垂れ幕・脚光(frame.png)
def drape(x0, x1, ztop, zbot, folds, gather, side, name):
    """ひだの寄った幕。gather：下のほうで横へ寄せる量(たくし上げ)"""
    NXd, NZd = 60, 50
    v, f = [], []
    for i in range(NZd + 1):
        t = i/NZd; z = ztop + (zbot - ztop)*t
        for j in range(NXd + 1):
            u = j/NXd
            # たくし上げ：まんなかの高さで細くくびれ、下はまた広がる
            pinch = gather*math.exp(-((t - 0.62)/0.18)**2)
            xa = x0 + (x1 - x0)*u
            xa = xa + (side*(x1 - x0 if side < 0 else x0 - x1))*0
            cx = x0 if side < 0 else x1          # 寄せる側(画面の外側)
            xa = cx + (xa - cx)*(1 - pinch)
            y = -1.5 - 0.12*math.sin(u*folds*2*math.pi)*(1 - 0.5*pinch) - 0.04*math.sin(u*folds*5.1*math.pi)
            v.append(Vector((xa, y, z)))
    for i in range(NZd):
        for j in range(NXd):
            a = i*(NXd + 1) + j; f.append((a, a + 1, a + NXd + 2, a + NXd + 1))
    o = obj(name, mesh(name, v, f), [curtain]); smooth(o)
    s = o.modifiers.new("t", "SOLIDIFY"); s.thickness = 0.03
    FRAME.append(o)
    return o
drape(-6.4, -3.75, 3.4, -3.2, 9, 0.5, -1, "curtainL")
drape(3.75, 6.4, 3.4, -3.2, 9, 0.5, 1, "curtainR")
# たくし上げの金の房(ふさ)
for sx in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.04, location=(sx*4.95, -1.62, -0.55), rotation=(math.pi/2, 0, 0))
    o = bpy.context.object; o.data.materials.append(gold); FRAME.append(o)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.12, radius2=0.03, depth=0.4, location=(sx*4.9, -1.64, -0.9))
    o = bpy.context.object; o.data.materials.append(gold); FRAME.append(o)
# 上の垂れ幕：波形に垂れる短い幕と金の縁取り
vv, vf = [], []
NV = 160
for i in range(2):
    for j in range(NV + 1):
        x = -5.8 + 11.6*j/NV
        sag = 0.16*(0.5 - 0.5*math.cos(2*math.pi*((x + 5.8)/1.45)))
        z = 3.3 if i == 0 else 2.66 - sag
        y = -1.6 - 0.05*math.sin(x*9)
        vv.append(Vector((x, y, z)))
for j in range(NV):
    vf.append((j, j + 1, NV + 2 + j, NV + 1 + j))
o = obj("valance", mesh("valance", vv, vf), [curtain]); smooth(o); FRAME.append(o)
s = o.modifiers.new("t", "SOLIDIFY"); s.thickness = 0.03
pts = [vv[NV + 1 + j] + Vector((0, -0.03, 0)) for j in range(NV + 1)]
for j in range(0, NV, 2):
    a, b2 = pts[j], pts[j + 2] if j + 2 <= NV else pts[NV]
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.025, depth=(b2 - a).length, location=(a + b2)/2)
    c = bpy.context.object; c.rotation_euler = (b2 - a).to_track_quat("Z", "Y").to_euler(); c.data.materials.append(gold); FRAME.append(c)
# 脚光：床の手前のふちに並ぶ、笠つきの小さな灯り(光は舞台を下から照らす)
for k in range(9):
    x = -4.0 + k*1.0
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.17, radius2=0.08, depth=0.14, location=(x, -1.45, FLOOR_Z - 0.48), rotation=(-0.5, 0, 0))
    o = bpy.context.object; o.data.materials.append(gold); FRAME.append(o)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(x, -1.43, FLOOR_Z - 0.44))
    o = bpy.context.object; o.data.materials.append(lamp); FRAME.append(o)
# 舞台の前のふち(額縁の下の板)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -1.35, FLOOR_Z - 0.62))
o = bpy.context.object; o.scale = (12, 0.25, 0.36); o.data.materials.append(floor); FRAME.append(o)

# ------------------------------------------------------------------ 光
def spot(name, loc, target, energy, color, size, blend=0.4):
    L = bpy.data.lights.new(name, "SPOT"); L.energy = energy; L.color = color; L.spot_size = math.radians(size); L.spot_blend = blend
    L.shadow_soft_size = 0.25
    o = bpy.data.objects.new(name, L); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
def area(name, loc, target, energy, color, size):
    L = bpy.data.lights.new(name, "AREA"); L.energy = energy; L.color = color; L.size = size
    o = bpy.data.objects.new(name, L); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
LIGHT = {
    1:dict(c=(1.0, 0.84, 0.58), ce=16000, l=(0.95, 0.65, 0.45), r=(0.6, 0.45, 1.0), f=(1.0, 0.7, 0.4), fe=900),
    2:dict(c=(1.0, 0.42, 0.32), ce=15000, l=(1.0, 0.3, 0.25), r=(0.85, 0.2, 0.35), f=(1.0, 0.35, 0.2), fe=1000),
    3:dict(c=(0.62, 0.42, 1.0), ce=9000, l=(0.5, 0.3, 0.9), r=(0.9, 0.15, 0.25), f=(0.95, 0.12, 0.18), fe=2200),
}[V]
area("fill", (0, -8, 3), (0, BACK_Y, 0.5), 500, (0.8, 0.7, 0.9), 10)                 # 客席の上からの、ぼんやりした明かり
spot("spotC", (0.0, -6, 8), (0.0, BACK_Y, 0.4), LIGHT["ce"], LIGHT["c"], 30, 0.6)            # まんなかの強いスポットライト(書き割りに丸い光)
spot("spotL", (-6, -4, 7), (-3.2, BACK_Y, -0.4), 2500, LIGHT["l"], 22)
spot("spotR", (6, -4, 7), (3.2, BACK_Y, 0.6), 3500, LIGHT["r"], 22)              # 右から紫がかった光
area("foot", (0, -1.6, FLOOR_Z - 0.3), (0, BACK_Y, 1.5), LIGHT["fe"], LIGHT["f"], 9)      # 脚光(下から)
area("curtainKey", (0, -7, 1), (0, -1.5, 0), 400, (1.0, 0.8, 0.6), 8)                  # 幕を照らす
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.015, 0.02, 1)

# ------------------------------------------------------------------ カメラ：客席のまんなかから、舞台の口がちょうど画面になるように
cam_d = bpy.data.cameras.new("cam"); cam_d.type = "PERSP"; cam_d.lens = 50; cam_d.sensor_fit = "HORIZONTAL"; cam_d.sensor_width = 36
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
# 舞台の口(y = -1.5)で幅 9.6×STAGE_OVER が写る距離
D = cam_d.lens/cam_d.sensor_width*9.6*STAGE_OVER
cam.location = (0, -1.5 - D, 0.0); cam.rotation_euler = (math.radians(90), 0, 0)

sc.render.engine = "BLENDER_EEVEE"
try:
    sc.eevee.taa_render_samples = 16 if FAST else 128
    sc.eevee.use_raytracing = True
    sc.eevee.use_shadows = True
except AttributeError: pass
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"

def render(path, w, h, fmt, transparent):
    sc.render.resolution_x = w; sc.render.resolution_y = h
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = fmt
    sc.render.image_settings.color_mode = "RGBA" if fmt == "PNG" else "RGB"
    if fmt == "JPEG": sc.render.image_settings.quality = 88
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("書き出し:", path, w, "x", h)

if CURTAIN:
    # 閉じた緞帳だけを、手前の絵と同じカメラで描く(ほかの物は隠す)
    for o in list(sc.objects):
        if o.type == "MESH": o.hide_render = True
    drape(-5.6, 5.6, 3.5, -3.3, 26, 0.0, -1, "curtainClosed")
    cc = sc.objects["curtainClosed"]; cc.location.y = -0.35; FRAME.remove(cc)
    for k in range(60):     # すその金の房
        x = -5.4 + k*0.18
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.05, radius2=0.015, depth=0.22, location=(x, -1.95, -3.25), rotation=(math.pi, 0, 0))
        bpy.context.object.data.materials.append(gold)
    cam.location = (0, -1.5 - D/STAGE_OVER, 0.0)
    render(os.path.join(OUTDIR, "curtain.png"), 960*PX, 540*PX, "PNG", True)
    sys.exit(0)
# 奥：手前の物を隠して描く(画面より STAGE_OVER 倍広い)
for o in FRAME: o.hide_render = True
render(os.path.join(OUTDIR, "stage.jpg" if V == 1 else "stage%d.jpg" % V), round(960*STAGE_OVER*PX), round(540*STAGE_OVER*PX), "JPEG", False)
if V != 1: sys.exit(0)      # 手前の絵は第1幕と同じ
# 手前：同じ広さのまま、奥の物は穴(透明)にして描く。ゲームでは画面の大きさで貼るので、カメラを寄せて画面ちょうどにする
for o in FRAME: o.hide_render = False
for o in sc.objects:
    if o.type == "MESH" and o not in FRAME: o.is_holdout = True
cam.location = (0, -1.5 - D/STAGE_OVER, 0.0)
render(os.path.join(OUTDIR, "frame.png"), 960*PX, 540*PX, "PNG", True)
