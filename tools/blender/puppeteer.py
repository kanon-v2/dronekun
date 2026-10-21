# ボスの試作「傀儡師」(scripts/drone/puppeteer.js)の絵を Blender で描く
#   使い方(画面なしで動かす):
#     "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python tools/blender/puppeteer.py -- [出力のフォルダ] [--only body,mask,hand,bar] [--fast]
#   出力(いつもは images/game/puppeteer/)：
#     body.png  マント・頭巾・襟(裾がなびく BODY_FRAMES コマ。横に BODY_COLS コマずつ並べる)
#     mask.png  仮面(ひび3つ × 口の開き の16通り。番号 = ひびA + ひびB*2 + ひびC*4 + 口*8)
#     handL.png・handR.png  手(指がうごめく HAND_FRAMES コマ)
#     bar.png   操り板(十字)
#   ゲームと同じ座標で作る：ゲームの1px = 0.1(Blender の長さ)。原点は仮面の中心。x 右・z 上(ゲームの y の逆)・y 奥。
#   カメラは手前(-y)から、少し下から見上げる(画面の上にいるボスを見上げる向き)。絵はゲームの1px = PX 画素で描く。
#   ねらい：リアルで不気味に。中身のない空っぽのマント(前の裂け目の奥は闇)、ひびの入った古い磁器の仮面、
#   長すぎる指の青白い手、使い込まれた木の操り板。
import bpy, sys, os, math, random
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
FAST = "--fast" in ARGS
ONLY = ARGS[ARGS.index("--only") + 1].split(",") if "--only" in ARGS else ["body", "mask", "hand", "bar"]
ARGV = [a for i, a in enumerate(ARGS) if not a.startswith("--") and (i == 0 or ARGS[i - 1] != "--only")]
OUTDIR = os.path.abspath(ARGV[0] if ARGV else "images/game/puppeteer")
os.makedirs(OUTDIR, exist_ok=True)
TMP = os.path.join(bpy.app.tempdir or OUTDIR, "pup_frames")
os.makedirs(TMP, exist_ok=True)

U = 0.1             # ゲームの1px の長さ
PX = 3              # ゲームの1px を何画素で描くか(大きな画面でもぼやけないように)
CAM_TILT = 7        # 見上げる角度(度)
BODY_FRAMES = 16    # 裾がなびく1周のコマ数
BODY_COLS = 4
HAND_FRAMES = 8     # 指がうごめく1周のコマ数
# 絵の範囲(ゲームの px。原点からの左・上・幅・高さ)。puppeteer.js の PUP_ART と同じにする
AREA = {
    "body": (-76, -50, 152, 178),
    "mask": (-20, -24, 40, 48),
    "hand": (-22, -26, 44, 68),
    "bar":  (-28, -18, 56, 34),
}
SEED = 7

def G(gx, gy, d=0.0):
    """ゲームの座標(px)を Blender の位置に"""
    return Vector((gx*U, d, -gy*U))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
random.seed(SEED)

# ------------------------------------------------------------------ 材質の部品
class Nodes:
    """シェーダーのノードを短く書くための道具"""
    def __init__(self, mat):
        self.m = mat; self.nt = mat.node_tree; self.N = self.nt.nodes; self.L = self.nt.links
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
        """lo → 0、hi → 1(なめらか)。lo > hi なら逆向き"""
        r = self.N.new("ShaderNodeMapRange"); r.interpolation_type = "SMOOTHSTEP"
        r.inputs["From Min"].default_value = lo; r.inputs["From Max"].default_value = hi
        self.link(v, r.inputs["Value"]); return r.outputs["Result"]
    def noise(self, scale, detail=6, rough=0.6, dist=0.0, vec=None, out="Fac"):
        z = self.N.new("ShaderNodeTexNoise"); z.inputs["Scale"].default_value = scale; z.inputs["Detail"].default_value = detail
        z.inputs["Roughness"].default_value = rough; z.inputs["Distortion"].default_value = dist
        self.L.new(vec if vec is not None else self.tc.outputs["Object"], z.inputs["Vector"]); return z.outputs[out]
    def stretch(self, sx, sy, sz):
        """物の座標を軸ごとに伸び縮みさせる(縦に流れる汚れなど)"""
        mp = self.N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (sx, sy, sz)
        self.L.new(self.tc.outputs["Object"], mp.inputs["Vector"]); return mp.outputs["Vector"]
    def bsdf(self, color, rough, metal=0.0, **kw):
        b = self.N.new("ShaderNodeBsdfPrincipled")
        b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
        for k, v in kw.items(): b.inputs[k.replace("_", " ")].default_value = v
        return b.outputs[0]
    def mix(self, a, b, fac):
        x = self.N.new("ShaderNodeMixShader"); self.link(fac, x.inputs[0])
        self.L.new(a, x.inputs[1]); self.L.new(b, x.inputs[2]); return x.outputs[0]
    def bump(self, h, strength, dist=0.02):
        bp = self.N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength; bp.inputs["Distance"].default_value = dist
        self.L.new(h, bp.inputs["Height"]); return bp.outputs["Normal"]
    def out(self, s):
        o = self.N["Material Output"]; self.L.new(s, o.inputs["Surface"])
    def ao(self, dist=0.3):
        a = self.N.new("ShaderNodeAmbientOcclusion"); a.inputs["Distance"].default_value = dist
        return self.math("SUBTRACT", 1.0, a.outputs["AO"], True)    # 1 ほど奥まっている

def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.node_tree.nodes.remove(m.node_tree.nodes["Principled BSDF"])
    return m, Nodes(m)

def set_normal(sock_bsdf_output, normal):
    """bsdf() で作った面に凹凸をつなぐ"""
    node = sock_bsdf_output.node
    node.id_data.links.new(normal, node.inputs["Normal"])

# マント：黒に近いビロード(ひだの山だけが紫に照る)。裾ほど、ほこりで白ちゃけてすり切れている
velvet, n = material("velvet")
fab = n.bsdf((0.016, 0.010, 0.022), 0.9, Sheen_Weight=1.0, Sheen_Roughness=0.35, Sheen_Tint=(0.62, 0.45, 0.85, 1))
set_normal(fab, n.bump(n.noise(160, 2, 0.5), 0.15, 0.005))
dusty = n.bsdf((0.10, 0.085, 0.08), 1.0, Sheen_Weight=0.6, Sheen_Tint=(0.5, 0.45, 0.45, 1))
low = n.band(n.z, -6.0, -9.6)       # 裾のほう
dust = n.math("MULTIPLY", low, n.band(n.noise(3.5, 8, 0.7, 0.3), 0.42, 0.62), True)
dust = n.math("ADD", dust, n.math("MULTIPLY", n.ao(0.6), 0.25), True)
n.out(n.mix(fab, dusty, n.math("MULTIPLY", dust, 0.5)))

# マントの裏・頭巾の中：光を返さない闇
void, n = material("void")
n.out(n.bsdf((0.002, 0.0015, 0.003), 1.0))

# 襟：深い紫のしゅす(つや)。内側に色あせたしみ
satin, n = material("satin")
sat = n.bsdf((0.05, 0.022, 0.07), 0.32, Coat_Weight=0.3, Coat_Roughness=0.25)
stain = n.bsdf((0.025, 0.02, 0.022), 0.8)
n.out(n.mix(sat, stain, n.math("MULTIPLY", n.band(n.noise(2.5, 6, 0.7), 0.5, 0.7), 0.7)))

# 骨(襟の骨組み)：古い骨。くぼみに汚れ
bone, n = material("bone")
bb = n.bsdf((0.52, 0.47, 0.38), 0.6, Subsurface_Weight=0.1)
set_normal(bb, n.bump(n.noise(40, 4), 0.3, 0.01))
dirt = n.bsdf((0.12, 0.09, 0.06), 0.9)
n.out(n.mix(bb, dirt, n.math("ADD", n.math("MULTIPLY", n.ao(0.25), 1.4), n.math("MULTIPLY", n.band(n.noise(6, 6), 0.45, 0.7), 0.5), True)))

# 磁器の仮面：つやのある釉(うわぐすり)、細かい貫入(ひびの網)、くぼみの汚れ、目から垂れたしみ、絵の具(紫のしるし・赤い唇)
porcelain, n = material("porcelain")
glaze = n.bsdf((0.80, 0.76, 0.67), 0.28, Subsurface_Weight=0.15, Subsurface_Radius=(0.05, 0.03, 0.02), Coat_Weight=0.7, Coat_Roughness=0.08)
vo = n.N.new("ShaderNodeTexVoronoi"); vo.feature = "DISTANCE_TO_EDGE"; vo.inputs["Scale"].default_value = 9.0
n.L.new(n.tc.outputs["Object"], vo.inputs["Vector"])
craq = n.band(vo.outputs["Distance"], 0.035, 0.0)        # 貫入の線
craq = n.math("MULTIPLY", craq, n.band(n.noise(4, 4), 0.35, 0.6), True)
s = n.mix(glaze, n.bsdf((0.36, 0.30, 0.22), 0.5), n.math("MULTIPLY", craq, 0.75))
# くぼみ・ふちの汚れ(黄ばみ)
yell = n.math("ADD", n.math("MULTIPLY", n.ao(0.25), 1.2), n.math("MULTIPLY", n.band(n.noise(2.2, 8, 0.7), 0.5, 0.75), 0.45), True)
s = n.mix(s, n.bsdf((0.52, 0.43, 0.30), 0.55), n.math("MULTIPLY", yell, 0.75))
# 目から下へ垂れたしみ(涙の跡のように、灰色がかった赤黒い筋)。左右の目の下(|x| が 0.45～1.05)
ax = n.math("ABSOLUTE", n.x)
col = n.math("MULTIPLY", n.band(ax, 0.42, 0.62), n.band(ax, 1.08, 0.86), True)
streak = n.band(n.noise(1.0, 3, 0.5, 0.0, n.stretch(9.0, 9.0, 0.6)), 0.48, 0.62)
below = n.math("MULTIPLY", n.band(n.z, 0.4, 0.25), n.band(n.z, -1.7, -0.5), True)
tear = n.math("MULTIPLY", n.math("MULTIPLY", col, streak, True), below, True)
s = n.mix(s, n.bsdf((0.08, 0.05, 0.05), 0.35, Coat_Weight=0.6), n.math("MULTIPLY", tear, 0.9))
# 額のひし形(紫)
dia = n.math("ADD", ax, n.math("MULTIPLY", n.math("ABSOLUTE", n.math("SUBTRACT", n.z, 1.25)), 0.62))
s = n.mix(s, n.bsdf((0.20, 0.07, 0.36), 0.3, Coat_Weight=0.7), n.band(dia, 0.24, 0.20))
# 目の下の紫の線(縦の短い線)
ln = n.math("MULTIPLY", n.band(n.math("ABSOLUTE", n.math("SUBTRACT", ax, 0.76)), 0.035, 0.018), n.math("MULTIPLY", n.band(n.z, 0.1, 0.05), n.band(n.z, -0.5, -0.42), True), True)
s = n.mix(s, n.bsdf((0.22, 0.08, 0.40), 0.3, Coat_Weight=0.7), ln)
n.out(s)
# 唇の赤(彫った溝に塗った漆)
lacq, n = material("lacquer")
n.out(n.bsdf((0.16, 0.005, 0.015), 0.25, Coat_Weight=1.0, Coat_Roughness=0.05))
# ひびの中(暗い)・ひびのふちの欠け(釉がはがれた素地)
crack, n = material("crack")
n.out(n.bsdf((0.03, 0.02, 0.02), 0.9))
bisque, n = material("bisque")
bq = n.bsdf((0.55, 0.50, 0.43), 0.95)
set_normal(bq, n.bump(n.noise(90, 3), 0.5, 0.004))
n.out(bq)
# 目の奥の赤い光
eyeglow, n = material("eyeglow")
em = n.N.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (1.0, 0.06, 0.03, 1); em.inputs["Strength"].default_value = 3.0
n.out(em.outputs[0])
# 開いた口の奥(暗い赤)
maw, n = material("maw")
em = n.N.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (0.25, 0.01, 0.02, 1); em.inputs["Strength"].default_value = 0.15
n.out(em.outputs[0])

# 手の肌：血の気のない青白さ(少し紫)。光が少し透ける。関節は赤黒い
skin, n = material("skin")
sk = n.bsdf((0.60, 0.56, 0.60), 0.5, Subsurface_Weight=0.35, Subsurface_Radius=(0.06, 0.025, 0.02), Subsurface_Scale=0.5)
set_normal(sk, n.bump(n.noise(60, 4), 0.25, 0.006))
blot = n.bsdf((0.38, 0.33, 0.40), 0.55, Subsurface_Weight=0.2)
n.out(n.mix(sk, blot, n.math("ADD", n.math("MULTIPLY", n.band(n.noise(5, 6, 0.7), 0.45, 0.7), 0.6), n.math("MULTIPLY", n.ao(0.15), 1.2), True)))
knuck, n = material("knuckle")
kn = n.bsdf((0.42, 0.30, 0.33), 0.55, Subsurface_Weight=0.3, Subsurface_Radius=(0.05, 0.02, 0.02), Subsurface_Scale=0.5)
set_normal(kn, n.bump(n.noise(80, 5), 0.5, 0.005))      # しわ
n.out(kn)
# 袖口：マントと同じビロードが、上へ闇に溶けて消える(手だけが宙に浮いて見える)
sleeve, n = material("sleeve")
sl = n.bsdf((0.016, 0.010, 0.022), 0.9, Sheen_Weight=1.0, Sheen_Roughness=0.35, Sheen_Tint=(0.62, 0.45, 0.85, 1))
tr = n.N.new("ShaderNodeBsdfTransparent")
fade = n.math("ADD", n.band(n.z, 0.9, 1.6), n.math("MULTIPLY", n.noise(6, 4), 0.3), True)
n.out(n.mix(sl, tr.outputs[0], fade))
try: sleeve.surface_render_method = "BLENDED"
except Exception: pass
nail, n = material("nail")
n.out(n.bsdf((0.02, 0.015, 0.02), 0.15, Coat_Weight=1.0))

# 木(操り板)：黒ずんだ古い木目。手の当たる所はすれて光る
wood, n = material("wood")
wv = n.N.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "X"; wv.inputs["Scale"].default_value = 2.5
wv.inputs["Distortion"].default_value = 6; wv.inputs["Detail"].default_value = 4
n.L.new(n.tc.outputs["Object"], wv.inputs["Vector"])
rmp = n.N.new("ShaderNodeValToRGB"); rmp.color_ramp.elements[0].color = (0.05, 0.025, 0.012, 1); rmp.color_ramp.elements[1].color = (0.20, 0.11, 0.05, 1)
n.L.new(wv.outputs["Fac"], rmp.inputs["Fac"])
wb = n.N.new("ShaderNodeBsdfPrincipled"); n.L.new(rmp.outputs["Color"], wb.inputs["Base Color"]); wb.inputs["Roughness"].default_value = 0.55
set_normal(wb.outputs[0], n.bump(wv.outputs["Fac"], 0.25, 0.01))
n.out(n.mix(wb.outputs[0], n.bsdf((0.02, 0.012, 0.008), 0.9), n.math("MULTIPLY", n.ao(0.2), 1.5, True)))
brass, n = material("brass")
br = n.bsdf((0.62, 0.45, 0.22), 0.38, 1.0)
n.out(n.mix(br, n.bsdf((0.10, 0.08, 0.04), 0.8), n.math("ADD", n.math("MULTIPLY", n.band(n.noise(12, 6), 0.45, 0.65), 0.7), n.ao(0.15), True)))
gem, n = material("gem")
g1 = n.bsdf((0.4, 0.2, 0.7), 0.05, Emission_Color=(0.72, 0.42, 1.0, 1), Emission_Strength=5.0, Coat_Weight=1.0)
n.out(g1)

# ------------------------------------------------------------------ 形の道具
COLS = {}
def coll(name):
    c = bpy.data.collections.new(name); sc.collection.children.link(c); COLS[name] = c; return c

def obj(name, me, c, mats):
    o = bpy.data.objects.new(name, me); c.objects.link(o)
    for m in mats: o.data.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    return o

def mesh(name, verts, faces):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update(); return me

def face_camera(me):
    """面の向きを手前(-y)へそろえる(開いた面の厚みを奥へ付けるため)"""
    s = sum(p.normal.y*p.area for p in me.polygons)
    if s > 0: me.flip_normals()

def prim(kind, c, mat, loc, scale=(1, 1, 1), rot=(0, 0, 0), **kw):
    if kind == "sphere": bpy.ops.mesh.primitive_uv_sphere_add(segments=kw.get("seg", 24), ring_count=kw.get("rings", 14), radius=1, location=loc)
    elif kind == "cyl": bpy.ops.mesh.primitive_cylinder_add(vertices=kw.get("seg", 16), radius=1, depth=1, location=loc)
    elif kind == "cone": bpy.ops.mesh.primitive_cone_add(vertices=kw.get("seg", 12), radius1=1, radius2=kw.get("r2", 0), depth=1, location=loc)
    elif kind == "cube": bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    for cc in list(o.users_collection): cc.objects.unlink(o)
    c.objects.link(o)
    o.scale = scale; o.rotation_euler = rot
    o.data.materials.append(mat)
    if kind != "cube": bpy.ops.object.shade_smooth()
    return o

def capsule(c, mat, a, b, ra, rb, seg=12):
    """a から b へ太さ ra → rb の棒(指の骨・襟の骨)"""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length
    verts, faces = [], []
    rows = 6
    for i in range(rows + 1):
        t = i/rows; r = ra + (rb - ra)*t
        for k in range(seg):
            th = 2*math.pi*k/seg
            verts.append(Vector((math.cos(th)*r, math.sin(th)*r, t*L)))
    for i in range(rows):
        for k in range(seg):
            j = (k + 1) % seg
            faces.append((i*seg + k, i*seg + j, (i + 1)*seg + j, (i + 1)*seg + k))
    me = mesh("cap", verts, faces)
    o = obj("cap", me, c, [mat])
    o.location = a
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    for p in (a, b):
        prim("sphere", c, mat, p, (ra if p is a else rb,)*3, seg=12, rings=8)
    return o

# ------------------------------------------------------------------ 体：マント・頭巾・襟
BODY = coll("body")
CU, CV = 132, 56        # マントの面の細かさ(まわり・縦)
CLOAK_TOP, CLOAK_BOT = 6, 112      # マントの上と裾の高さ(ゲームの px)
rnd = random.Random(SEED)
# 裾のぎざぎざ(柱ごとの裾の長さ。0～1 の縦の位置)と、ほつれて長く垂れる切れ端
hem = []
for j in range(CU + 1):
    zig = 0.06*abs(((j*0.37) % 2) - 1)
    hem.append(0.86 + zig + rnd.uniform(-0.05, 0.05))
for _ in range(9):
    j0 = rnd.randrange(CU); w = rnd.randint(1, 3); extra = rnd.uniform(0.05, 0.13)
    for j in range(j0, j0 + w): hem[j % CU] = min(1.0, hem[j % CU] + extra*(1 - abs(j - j0 - w/2)/(w + 1)))
for _ in range(7):        # 短く裂けた所
    j0 = rnd.randrange(CU)
    hem[j0] -= rnd.uniform(0.08, 0.18)
hem[CU] = hem[0]
# 裂け目の両ふちは、裾まで長く垂れる
for j in (0, 1, CU - 1, CU): hem[j] = max(hem[j], 0.97)

def opening_at(v):
    """前の裂け目の半分の幅(角度)。上は閉じ、下ほど開く"""
    return 0.02 + 0.36*max(0, v - 0.16)**1.15

def hem_at(j):
    return hem[j]

def cloak_point(j, i, ph):
    """柱 j・段 i のマントの点(ph はなびきの位相)。
    まわりは前の裂け目をよけて並べ(裂け目のふちがなめらかになるように)、縦は柱ごとの裾の長さまで伸ばす(裾のぎざぎざ)"""
    v = i/CV*hem_at(j)
    op = opening_at(v)
    th = op + (2*math.pi - 2*op)*j/CU        # 前が 0。裂け目の右のふち → 後ろ → 左のふち
    if th > math.pi: th -= 2*math.pi
    gy = CLOAK_TOP + v*(CLOAK_BOT - CLOAK_TOP)
    r = 1.7 + 3.85*(v**0.85)                 # 首から裾へ広がる(ゲームで 17px → 55px)
    # ひだ：縦に流れる深いひだ(下ほど深い)。前の裂け目のふちは外へめくれる
    f = math.sin(th*7 + 0.9*math.sin(th*3)) ; f = math.copysign(abs(f)**0.7, f)
    r += (0.06 + 0.42*v**1.3)*f
    # なびき：裾ほど大きく、波がまわりを回る
    r += 0.22*v**2*math.sin(ph + th*2 + v*2.5)
    zz = 0.30*v**2.2*math.sin(ph*1 + th*5 + 1.3) + 0.12*v**2*math.sin(ph*2 + th*9)
    edge = max(0, 1 - (abs(th) - op)/0.35)
    r += 0.35*edge*v                         # 裂け目のふちは外へめくれる
    # 裾の切れ端はばらばらに揺れる
    tip = max(0, v - 0.8)/0.2
    x = r*math.sin(th) + 0.12*tip*math.sin(ph + j*1.7)
    y = -r*math.cos(th)*0.72
    return Vector((x, y, -gy*U + zz))

def keep_face(j, i):
    return True

cverts = [cloak_point(j, i, 0) for i in range(CV + 1) for j in range(CU + 1)]
cfaces = [(i*(CU + 1) + j, i*(CU + 1) + j + 1, (i + 1)*(CU + 1) + j + 1, (i + 1)*(CU + 1) + j)
          for i in range(CV) for j in range(CU) if keep_face(j, i)]
cme = mesh("cloak", cverts, cfaces)
# 外向きにそろえる(手前の面の法線が -y)
if sum(p.normal.y for p in cme.polygons if p.center.y < -0.5) > 0: cme.flip_normals()
cloak = obj("cloak", cme, BODY, [velvet, void])
sol = cloak.modifiers.new("thick", "SOLIDIFY"); sol.thickness = 0.05; sol.offset = -1; sol.material_offset = 1; sol.use_rim = True
sol.material_offset_rim = 0

def cloak_frame(ph):
    co = [c for j in range(1) for c in ()]      # (使わない)
    flat = []
    for i in range(CV + 1):
        for j in range(CU + 1):
            p = cloak_point(j, i, ph); flat += (p.x, p.y, p.z)
    cme.vertices.foreach_set("co", flat); cme.update()

# 頭巾：先が少しとがって後ろへ垂れる殻。前の口は仮面より少し大きく、奥は闇
HU, HV = 64, 40
hverts, hfaces = [], []
for i in range(HV + 1):
    a = math.pi*i/HV                         # 0 上 → π 下
    for j in range(HU + 1):
        b = 2*math.pi*j/HU
        r = 2.55 + 0.1*math.sin(b*6)*math.sin(a)          # 布のたるみ
        x = r*math.sin(a)*math.sin(b)
        y = -r*math.sin(a)*math.cos(b)*0.95 + 0.35
        z = r*math.cos(a)*1.08
        if a < 0.9:                          # 頭の先：後ろ上へとがる
            k = (0.9 - a)/0.9; z += 0.55*k*k; y += 0.6*k*k
        if z < -1.2: z = -1.2 - (-(z) - 1.2)*0.5     # 下は肩へ流れる
        hverts.append(Vector((x, y, z)))
for i in range(HV):
    for j in range(HU):
        p = hverts[i*(HU + 1) + j]
        # 前の口：仮面のまわり(楕円)をあける
        if p.y < 0 and (p.x/1.82)**2 + ((p.z + 0.05)/2.2)**2 < 1: continue
        hfaces.append((i*(HU + 1) + j, i*(HU + 1) + j + 1, (i + 1)*(HU + 1) + j + 1, (i + 1)*(HU + 1) + j))
hme = mesh("hood", hverts, hfaces)
hood = obj("hood", hme, BODY, [velvet, void])
hs = hood.modifiers.new("thick", "SOLIDIFY"); hs.thickness = 0.12; hs.offset = 1; hs.material_offset = 1
# 頭巾の奥の闇(中を照らさない)
prim("sphere", BODY, void, (0, 0.5, -0.05), (2.25, 1.6, 2.4), seg=32, rings=16)

# 襟：首の後ろから両わきへ立つ、とがった高い襟。骨組みが透けて浮き出る
COLLAR_TIPS = [(-1.0, -24), (-0.55, -38), (-0.2, -27), (0.2, -27), (0.55, -38), (1.0, -24)]    # (横の位置 -1～1, 先の高さ px)
KU, KV = 90, 18
def collar_h(u):
    """横の位置 u(-1～1)での襟の先の高さ(ゲームの px。上がマイナス)。とがった先を結ぶ"""
    pts = [(-1.12, 4)] + COLLAR_TIPS + [(1.12, 4)]
    for k in range(len(pts) - 1):
        (u0, h0), (u1, h1) = pts[k], pts[k + 1]
        if u0 <= u <= u1:
            t = (u - u0)/(u1 - u0)
            # 先と先の間はえぐれる(弧)
            dip = math.sin(t*math.pi)*(9 if 0 < k < len(pts) - 2 else 0)
            return h0 + (h1 - h0)*t + dip
    return 4
kverts, kfaces = [], []
for i in range(KV + 1):
    for j in range(KU + 1):
        u = -1.1 + 2.2*j/KU
        top = collar_h(u); bot = 16
        gy = bot + (top - bot)*i/KV
        th = u*1.75                         # 後ろを回る角度(0 が真後ろ)
        r = 2.5 + 1.9*(i/KV)**1.2 + 0.25*abs(u)       # 上ほど外へ開く
        x = r*math.sin(th)*1.05; y = r*math.cos(th)*0.9 - 0.2 - 0.6*(i/KV)
        kverts.append(Vector((x, y, -gy*U)))
for i in range(KV):
    for j in range(KU):
        kfaces.append((i*(KU + 1) + j, i*(KU + 1) + j + 1, (i + 1)*(KU + 1) + j + 1, (i + 1)*(KU + 1) + j))
kme = mesh("collar", kverts, kfaces)
face_camera(kme)
collar = obj("collar", kme, BODY, [satin])
ks = collar.modifiers.new("thick", "SOLIDIFY"); ks.thickness = 0.06; ks.offset = 1
# 骨組み：襟の根元から各とがりの先へ
for (u, h) in COLLAR_TIPS:
    th = u*1.75; pts = []
    for i in range(0, KV + 1, 3):
        gy = 16 + (h - 16)*i/KV; r = 2.5 + 1.9*(i/KV)**1.2 + 0.25*abs(u) - 0.05
        pts.append(Vector((r*math.sin(th)*1.05, r*math.cos(th)*0.9 - 0.25 - 0.6*(i/KV), -gy*U)))
    for k in range(len(pts) - 1):
        capsule(BODY, bone, pts[k], pts[k + 1], 0.07 - 0.008*k, 0.062 - 0.008*k)

# ------------------------------------------------------------------ 仮面
MASK = coll("mask")
MA, MB, MD = 1.62, 2.06, 0.95      # 仮面の横・縦の半径と、ふくらみ

def mask_w(z):
    """高さ z での横の半径の倍率(あごへ細くなる面長の顔)"""
    k = max(0.0, -z/MB)
    return 1 - 0.30*k**1.6

def mask_y(x, z):
    """仮面の表の面の奥行き(手前がマイナス)"""
    q = 1 - (x/(MA*mask_w(z)))**2 - (z/MB)**2
    if q <= 0: return 0.0
    y = -MD*q**0.55
    y -= 0.09*math.exp(-((z - 0.66)/0.15)**2)*max(0, 1 - (x/1.2)**2)        # 眉の張り出し
    for s in (-1, 1):
        y += 0.24*math.exp(-((x - s*0.76)**2/0.12 + (z - 0.46)**2/0.05))    # 目のくぼみ(深く)
        y -= 0.09*math.exp(-((x - s*0.88)**2/0.06 + (z + 0.12)**2/0.07))    # 頬骨(高く張る)
        y += 0.12*math.exp(-((x - s*0.62)**2/0.05 + (z + 0.62)**2/0.10))    # 頬のこけ(深く)
    win = max(0, min(1, (0.4 - z)/0.25))*max(0, min(1, (z + 0.6)/0.1))
    y -= 0.17*math.exp(-x*x/0.03)*win*(0.6 + 0.4*(0.4 - z))                # 鼻すじ(細く高い)
    y -= 0.07*math.exp(-(x*x/0.12 + (z + 1.5)**2/0.05))                     # とがったあご
    return y

def bezq(a, c, b, t):
    return ((1 - t)**2*a[0] + 2*(1 - t)*t*c[0] + t*t*b[0], (1 - t)**2*a[1] + 2*(1 - t)*t*c[1] + t*t*b[1])

def eye_outline(s, n=20):
    """つり上がった細い目(ゲームの絵と同じ形を、少し長く)。(x, z) の点の並び"""
    up = [bezq((0.24, 0.24), (0.82, 0.95), (1.32, 0.74), t/n) for t in range(n + 1)]
    lo = [bezq((1.32, 0.74), (0.82, 0.40), (0.24, 0.24), t/n) for t in range(1, n)]
    return [(s*x, z) for x, z in up + lo]

# 開いた口(よろけたとき)：唇の線のまんなかが割れて開いた穴
mouth_pts = [(0.36*math.cos(2*math.pi*k/28), -1.02 + 0.22*math.sin(2*math.pi*k/28) - 0.05*math.cos(2*math.pi*k/28)**2) for k in range(28)]

def in_poly(x, z, poly):
    inside = False
    for k in range(len(poly)):
        (x0, z0), (x1, z1) = poly[k], poly[(k + 1) % len(poly)]
        if (z0 > z) != (z1 > z) and x < x0 + (z - z0)*(x1 - x0)/(z1 - z0): inside = not inside
    return inside

def snap_poly(x, z, poly):
    """輪郭のいちばん近い点"""
    best, bd = (x, z), 1e9
    for k in range(len(poly)):
        (x0, z0), (x1, z1) = poly[k], poly[(k + 1) % len(poly)]
        dx, dz = x1 - x0, z1 - z0; L = dx*dx + dz*dz or 1e-9
        t = max(0, min(1, ((x - x0)*dx + (z - z0)*dz)/L))
        px, pz = x0 + dx*t, z0 + dz*t; d = (px - x)**2 + (pz - z)**2
        if d < bd: best, bd = (px, pz), d
    return best

MR, MS = 90, 180
def build_mask(name, c, holes):
    """仮面の面。穴(目・口)は、中の面を除いて、穴のふちの点を輪郭へ寄せて作る
    (穴を開ける計算(ブーリアン)は、仮面の面が消えることがあったので使わない)"""
    verts = [Vector((0, mask_y(0, 0), 0))]
    for i in range(1, MR + 1):
        rho = (i/MR)**0.9 if i < MR else 0.999
        for k in range(MS):
            a = 2*math.pi*k/MS
            z = MB*rho*math.sin(a); x = MA*mask_w(z)*rho*math.cos(a)
            verts.append(Vector((x, mask_y(x, z), z)))
    faces = [(0, 1 + k, 1 + (k + 1) % MS) for k in range(MS)]
    for i in range(1, MR):
        a0, a1 = 1 + (i - 1)*MS, 1 + i*MS
        faces += [(a0 + k, a1 + k, a1 + (k + 1) % MS, a0 + (k + 1) % MS) for k in range(MS)]
    keep, cut_v = [], {}
    for f in faces:
        cx = sum(verts[v].x for v in f)/len(f); cz = sum(verts[v].z for v in f)/len(f)
        hole = next((h for h in holes if in_poly(cx, cz, h)), None)
        if hole is None: keep.append(f)
        else:
            for v in f: cut_v[v] = hole
    used = set(v for f in keep for v in f)
    for v, h in cut_v.items():
        if v in used:
            x, z = snap_poly(verts[v].x, verts[v].z, h)
            verts[v] = Vector((x, mask_y(x, z), z))
    me = mesh(name, verts, keep); face_camera(me)
    o = obj(name, me, c, [porcelain])
    s = o.modifiers.new("thick", "SOLIDIFY"); s.thickness = 0.12; s.offset = -1; s.use_even_offset = True
    return o
EYES = [eye_outline(-1), eye_outline(1)]
mask = build_mask("mask", coll("maskClosed"), EYES)
MASK_OPEN = coll("maskOpen")
build_mask("maskOpen", MASK_OPEN, EYES + [mouth_pts])

def prism(c, pts, y0, y1, mat, name="prism"):
    """(x, z) の輪郭を奥行き y0～y1 に伸ばした柱(穴を開ける型・光る板)"""
    n = len(pts)
    verts = [Vector((x, y0, z)) for x, z in pts] + [Vector((x, y1, z)) for x, z in pts]
    faces = [tuple(range(n)), tuple(range(2*n - 1, n - 1, -1))] + [(k, (k + 1) % n, n + (k + 1) % n, n + k) for k in range(n)]
    me = mesh(name, verts, faces)
    o = bpy.data.objects.new(name, me); c.objects.link(o); o.data.materials.append(mat)
    return o

for s in (-1, 1):
    # 目の奥の赤い光：瞳の点だけ(目の穴の奥で、こちらをにらむ)
    pc = (s*0.86, 0.6)
    pts = [(pc[0] + 0.075*math.cos(2*math.pi*k/16), pc[1] + 0.06*math.sin(2*math.pi*k/16)) for k in range(16)]
    prism(MASK, pts, 0.12, 0.16, eyeglow, "eyeglow")
    L = bpy.data.lights.new("eyeL", "POINT"); L.energy = 4; L.color = (1.0, 0.12, 0.06); L.shadow_soft_size = 0.05
    lo = bpy.data.objects.new("eyeL", L); MASK.objects.link(lo); lo.location = (pc[0], 0.06, pc[1])
# 仮面の裏の闇(穴の奥が、後ろの絵に左右されず暗く見えるように)
prism(MASK, [(MA*0.85*mask_w(MB*0.85*math.sin(2*math.pi*k/40))*math.cos(2*math.pi*k/40), MB*0.85*math.sin(2*math.pi*k/40)) for k in range(40)], 0.2, 0.24, void, "back")

def on_mask(x, z, lift=0.012):
    return Vector((x, mask_y(x, z) - lift, z))

def ribbon(c, pts, w0, w1, mat, lift=0.012, name="ribbon"):
    """仮面の表に沿った細い帯(ひび・唇の線)。pts は (x, z)"""
    verts, faces = [], []
    n = len(pts)
    for k in range(n):
        x, z = pts[k]
        a = pts[max(0, k - 1)]; b = pts[min(n - 1, k + 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1
        nx, nz = -dz/L, dx/L
        w = (w0 + (w1 - w0)*k/max(1, n - 1))/2
        verts += [on_mask(x + nx*w, z + nz*w, lift), on_mask(x - nx*w, z - nz*w, lift)]
    for k in range(n - 1):
        faces.append((2*k, 2*k + 1, 2*k + 3, 2*k + 2))
    me = mesh(name, verts, faces); face_camera(me)
    return obj(name, me, c, [mat])

# 唇：ほとんどまっすぐな、細く長すぎる笑み(赤い漆を塗った溝)。口の端だけが頬へ切れ上がる(作り笑い)
SMILE_C = coll("smile")         # 閉じた口(口を開いたときは消す)
def smile_pts(s):
    pts = [bezq((0.0, -1.0), (s*0.45, -1.02), (s*0.72, -0.93), t/14) for t in range(15)]
    pts += [bezq((s*0.72, -0.93), (s*0.9, -0.86), (s*1.0, -0.62), t/10) for t in range(1, 11)]
    return pts
for s in (-1, 1):
    ribbon(SMILE_C, smile_pts(s), 0.065, 0.014, lacq, 0.004, "smile")
for s in (-1, 1):       # 開いても、口の端の切れ上がりは残る
    ribbon(coll("mouthEnd") if s < 0 else COLS["mouthEnd"], smile_pts(s)[16:], 0.04, 0.012, lacq, 0.004, "smileEnd")
MOUTH_C = coll("mouth")
prism(MOUTH_C, [(x*0.9, z) for x, z in mouth_pts], 0.12, 0.16, maw, "maw")

# ひび：ゲームの絵の3本(幕が進むたびに増える)を、自然な割れ方にしたもの
def jitter(path, seed, amp=0.035, steps=4):
    r = random.Random(seed); out = [path[0]]
    for k in range(len(path) - 1):
        (x0, z0), (x1, z1) = path[k], path[k + 1]
        for s in range(1, steps + 1):
            t = s/steps
            j = amp if s < steps else 0
            out.append((x0 + (x1 - x0)*t + r.uniform(-j, j), z0 + (z1 - z0)*t + r.uniform(-j, j)))
    return out
def gpx(p):  # ゲームの px → 仮面の座標
    return (p[0]*U, -p[1]*U)
CRACKS = {
    "A": [[(5, -19.5), (2, -10), (6, -5), (4, 1), (6.5, 4)], [(2, -10), (-1.5, -7)]],
    "B": [[(-15, 3), (-7, 9), (-9, 15), (-8, 18)], [(-7, 9), (-2, 12)], [(-11, 6), (-13, 9.5)]],
    "C": [[(0, -20), (-3, -9), (1, 0), (-2, 9), (1, 18), (0, 20.5)], [(1, 0), (5, 3)], [(-2, 9), (-6, 11)]],
}
for key, paths in CRACKS.items():
    cc = coll("crack" + key)
    for pi_, p in enumerate(paths):
        pts = jitter([gpx(q) for q in p], hash(key)*7 + pi_)
        main = pi_ == 0
        ribbon(cc, pts, 0.07 if main else 0.05, 0.02, crack, 0.010, "crack")
        # ふちの欠け(釉がはがれて素地が見える)：ひびより太く、ところどころ
        r = random.Random(pi_ + 11)
        for k in range(0, len(pts) - 2, 2):
            if r.random() < 0.55:
                ribbon(cc, pts[k:k + 3], (0.16 if main else 0.1)*r.uniform(0.6, 1.2), 0.04, bisque, 0.006, "chip")

# ------------------------------------------------------------------ 手
HANDS = {"R": coll("handR"), "L": coll("handL")}
FINGER_PARTS = {"R": [], "L": []}      # コマごとに作り直す指

def build_hand(side, ph):
    """side "R"(ゲームの右の手。k=1)・"L"(左。k=0)。ph は指のうごめきの位相"""
    c = HANDS[side]; sgn = 1 if side == "R" else -1
    for o in FINGER_PARTS[side]:
        bpy.data.objects.remove(o, do_unlink=True)
    FINGER_PARTS[side] = []
    before = set(c.objects)
    kph = 0 if side == "L" else 1          # ゲームの sin(t*0.07 + f + k) と同じずれ
    # 4本の長い指：手の甲の下から垂れ、関節で手前へ曲がる
    for f in range(4):
        fo = f - 1.5
        base = Vector((fo*0.46*sgn, -0.25, -0.45 - 0.08*abs(fo)))
        curl = 0.45 + 0.28*math.sin(ph + f + kph)
        spread = fo*0.13*sgn
        lens = [1.2, 0.95, 0.7]                               # 人の指よりずっと長い
        if abs(fo) > 1: lens = [l*0.86 for l in lens]       # 小指・人さし指は少し短い
        d = Vector((math.sin(spread), 0, -math.cos(spread)))
        p = base; rads = [0.16, 0.13, 0.105, 0.08]
        ang = 0.15
        for k, L in enumerate(lens):
            ang += curl*(0.55 + 0.25*k)
            dk = Vector((d.x*math.cos(ang), -math.sin(ang), d.z*math.cos(ang)))
            q = p + dk*L
            capsule(c, skin, p, q, rads[k], rads[k + 1])
            # 関節のふくらみ(骨ばって、赤黒い)
            prim("sphere", c, knuck, p, (rads[k]*1.32, rads[k]*1.25, rads[k]*1.32), seg=14, rings=10)
            p = q
        # 黒く長い爪：先へ細くとがる
        tip = p + dk*0.42
        o = prim("cone", c, nail, (p + tip)/2, (0.075, 0.06, 0.42), seg=10)
        o.rotation_euler = dk.to_track_quat("Z", "Y").to_euler()
    # 親指：内側から、手前へ
    th0 = Vector((-0.75*sgn, -0.3, -0.1))
    th1 = th0 + Vector((0.25*sgn, -0.35, -0.55))
    th2 = th1 + Vector((0.2*sgn, -0.25, -0.35 - 0.1*math.sin(ph + 2)))
    capsule(c, skin, th0, th1, 0.15, 0.12); capsule(c, skin, th1, th2, 0.12, 0.085)
    prim("sphere", c, knuck, th1, (0.16,)*3, seg=14, rings=10)
    o = prim("cone", c, nail, th2 + (th2 - th1).normalized()*0.15, (0.07, 0.06, 0.32), seg=10)
    o.rotation_euler = (th2 - th1).to_track_quat("Z", "Y").to_euler()
    FINGER_PARTS[side] = [o for o in c.objects if o not in before]

def build_hand_static(side):
    c = HANDS[side]; sgn = 1 if side == "R" else -1
    # 手の甲：骨ばって薄い。腱が浮く
    prim("sphere", c, skin, (0, 0, 0), (0.98, 0.42, 0.72), seg=32, rings=20)
    for f in range(4):
        fo = f - 1.5
        capsule(c, skin, Vector((fo*0.18*sgn, -0.34, 0.45)), Vector((fo*0.44*sgn, -0.36, -0.42)), 0.055, 0.05)
    # 手首と、すり切れた袖口(上へ闇に消える)
    capsule(c, skin, Vector((0.05*sgn, 0.0, 0.3)), Vector((0.12*sgn, 0.1, 1.3)), 0.42, 0.36)
    SU, SV = 40, 10
    sv, sf = [], []
    rr = random.Random(5 if side == "R" else 9)
    hemz = [rr.uniform(0.0, 0.35) for _ in range(SU)]
    for i in range(SV + 1):
        for j in range(SU):
            a = 2*math.pi*j/SU; t = i/SV
            r = 0.62 + 0.25*t + 0.05*math.sin(a*5)
            z = 0.85 + t*1.9 - (hemz[j] if i == 0 else 0)
            sv.append(Vector((0.12*sgn + r*math.sin(a), 0.1 - r*math.cos(a)*0.8, z)))
    for i in range(SV):
        for j in range(SU):
            k = (j + 1) % SU
            sf.append((i*SU + j, i*SU + k, (i + 1)*SU + k, (i + 1)*SU + j))
    me = mesh("sleeve", sv, sf)
    o = obj("sleeve", me, c, [sleeve, sleeve])
    s = o.modifiers.new("thick", "SOLIDIFY"); s.thickness = 0.06; s.material_offset = 1

for side in ("R", "L"):
    build_hand_static(side)

# ------------------------------------------------------------------ 操り板
BAR = coll("bar")
o = prim("cube", BAR, wood, (0, 0, 0), (4.6, 0.32, 0.42)); bv = o.modifiers.new("bv", "BEVEL"); bv.width = 0.08; bv.segments = 3
o = prim("cube", BAR, wood, (0, -0.05, -0.1), (0.42, 0.34, 2.75)); bv = o.modifiers.new("bv", "BEVEL"); bv.width = 0.08; bv.segments = 3
o.location = (0, -0.05, -(-14 + 12)/2*U - 0.0)
o.location.z = -((-14 + 12)/2)*U
for x in (-2.35, 2.35):          # 横木の先の真ちゅうの金具と、糸を通す輪
    prim("cyl", BAR, brass, (x, 0, 0), (0.26, 0.26, 0.4), (0, math.pi/2, 0))
for (x, z) in ((-2.2, -0.0), (2.2, 0.0), (0, -1.2)):
    t = prim("sphere", BAR, brass, (x, -0.1, z - 0.28), (0.12, 0.12, 0.12), seg=12, rings=8)
bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.07, location=(0, -0.24, 0), rotation=(math.pi/2, 0, 0))
o = bpy.context.object; [cc.objects.unlink(o) for cc in list(o.users_collection)]; BAR.objects.link(o); o.data.materials.append(brass)
prim("sphere", BAR, gem, (0, -0.25, 0), (0.24, 0.16, 0.24), seg=16, rings=10)
L = bpy.data.lights.new("gemL", "POINT"); L.energy = 3; L.color = (0.7, 0.45, 1.0); L.shadow_soft_size = 0.1
lo = bpy.data.objects.new("gemL", L); BAR.objects.link(lo); lo.location = (0, -0.6, 0)

# ------------------------------------------------------------------ 光とカメラ
def area(name, loc, energy, color, size, target=(0, 0, -3)):
    Ld = bpy.data.lights.new(name, "AREA"); Ld.energy = energy; Ld.color = color; Ld.size = size
    o = bpy.data.objects.new(name, Ld); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o
area("key", (-9, -12, 9), 2600, (1.0, 0.9, 0.82), 6)              # 左上の手前から(ゲームの光の向き)
area("rimR", (10, 9, 5), 2200, (0.62, 0.42, 1.0), 4)               # 右の後ろから紫のふち
area("rimL", (-10, 8, 0), 1100, (0.45, 0.5, 1.0), 4)               # 左の後ろから青紫のふち
area("under", (0, -9, -16), 500, (0.9, 0.25, 0.3), 6, (0, 0, -2))  # 下から赤い照り返し(不気味に)
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.04, 0.07, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.25

cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam

sc.render.engine = "BLENDER_EEVEE"
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Khronos PBR Neutral"; sc.view_settings.look = "None"
try:
    sc.eevee.taa_render_samples = 16 if FAST else 96
    sc.eevee.use_raytracing = True
    sc.eevee.use_shadows = True
except AttributeError:
    pass

def frame_area(key, offset=(0, 0, 0)):
    left, top, w, h = AREA[key]
    sc.render.resolution_x = w*PX; sc.render.resolution_y = h*PX
    cam_d.ortho_scale = max(w, h)*U
    c = G(left + w/2, top + h/2) + Vector(offset)
    tilt = math.radians(CAM_TILT)
    cam.rotation_euler = (math.radians(90) + tilt, 0, 0)
    look = Vector((0, math.cos(tilt), math.sin(tilt)))
    cam.location = c - look*40

def show(names):
    for k, c in COLS.items(): c.hide_render = k not in names

def render(path):
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)

def sheet(paths, cols, out):
    """コマの絵を cols コマずつ横に並べて1枚にする"""
    ims = [bpy.data.images.load(p) for p in paths]
    w, h = ims[0].size
    rows = (len(ims) + cols - 1)//cols
    big = np.zeros((rows*h, cols*w, 4), dtype=np.float32)
    for k, im in enumerate(ims):
        a = np.empty(w*h*4, dtype=np.float32); im.pixels.foreach_get(a)
        a = a.reshape(h, w, 4)[::-1]           # 上から下の並びに
        r, cc = divmod(k, cols)
        big[r*h:(r + 1)*h, cc*w:(cc + 1)*w] = a
    img = bpy.data.images.new("sheet", cols*w, rows*h, alpha=True)
    img.pixels.foreach_set(big[::-1].ravel())
    img.filepath_raw = out; img.file_format = "PNG"; img.save()
    for im in ims: bpy.data.images.remove(im)
    print("書き出し:", out, cols*w, "x", rows*h)

# ------------------------------------------------------------------ 描く
if "body" in ONLY:
    show(["body"]); frame_area("body")
    paths = []
    for f in range(BODY_FRAMES):
        cloak_frame(2*math.pi*f/BODY_FRAMES)
        p = os.path.join(TMP, "body%02d.png" % f); render(p); paths.append(p)
        if FAST: break
    sheet(paths, BODY_COLS, os.path.join(OUTDIR, "body.png"))

if "mask" in ONLY:
    frame_area("mask")
    paths = []
    for k in range(16):
        a, b, cr, mo = k & 1, (k >> 1) & 1, (k >> 2) & 1, (k >> 3) & 1
        names = ["mask"] + (["crackA"] if a else []) + (["crackB"] if b else []) + (["crackC"] if cr else [])
        names += ["maskOpen", "mouth", "mouthEnd"] if mo else ["maskClosed", "smile"]
        show(names)
        p = os.path.join(TMP, "mask%02d.png" % k); render(p); paths.append(p)
    sheet(paths, 8, os.path.join(OUTDIR, "mask.png"))

if "hand" in ONLY:
    frame_area("hand")
    for side in ("L", "R"):
        # 左右の手は、それぞれの場所に置いて描く(光の向きを左右でそろえる)
        paths = []
        for f in range(HAND_FRAMES):
            build_hand(side, 2*math.pi*f/HAND_FRAMES)
            show(["hand" + side])
            p = os.path.join(TMP, "hand%s%02d.png" % (side, f)); render(p); paths.append(p)
            if FAST: break
        sheet(paths, HAND_FRAMES, os.path.join(OUTDIR, "hand%s.png" % side))

if "bar" in ONLY:
    show(["bar"]); frame_area("bar")
    p = os.path.join(TMP, "bar.png"); render(p)
    sheet([p], 1, os.path.join(OUTDIR, "bar.png"))
