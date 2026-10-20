# 見本の構造物(丸い逆三角の青銅の枠に、水色に光る石がはまったもの)を Blender で描く(Blender の見比べ用)
#   使い方(画面なしで動かす):
#     "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python tools/blender/relic.py -- <出力.png> [大きさpx] [--worn]
#   --worn：錆(緑青と茶色の錆)・汚れ・欠け・角のすれを足す
#   --export <出力.js>：描かずに、形(三角形の頂点・法線・材質・ふちの印)を JS に書き出す(ゲームの中で WebGL で描く relic3d.js 用)
#   形は正面から見た輪郭(外・縁の内・口)を同じ数の点で作り、点どうしをつないで面にする。
#   辺ごとに斜めの面になり、角は外の角から口の角へ稜線が走る(額縁の留め継ぎ)。
#   座標：x 右・z 上・y 奥(カメラは手前 -y から見る)
import bpy, sys, os, math, random
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
WORN = "--worn" in ARGS
EXPORT = ARGS[ARGS.index("--export") + 1] if "--export" in ARGS else None
ARGV = [a for a in ARGS if not a.startswith("--") and a != EXPORT]
OUT = ARGV[0] if ARGV else os.path.join(bpy.app.tempdir, "relic.png")
SIZE = int(ARGV[1]) if len(ARGV) > 1 else 512

N_EDGE = 40      # 辺1本の点の数
N_CORNER = 3     # 角の丸み1つの点の数(少ないほど留め継ぎの稜線がくっきり。丸みはベベルで付ける)

# 輪郭：角(左上・右上・下)・辺の膨らみ(外向き)・角の丸み(辺の長さに対する割合)
OUTER = dict(c=[(-1.0, 0.76), (1.0, 0.76), (0.0, -0.95)], bulge=[0.07, 0.20, 0.20], round=0.07)
LIP   = dict(c=[(-0.93, 0.71), (0.93, 0.71), (0.0, -0.86)], bulge=[0.065, 0.18, 0.18], round=0.06)
INNER = dict(c=[(-0.56, 0.60), (0.56, 0.60), (0.0, -0.47)], bulge=[0.04, 0.10, 0.10], round=0.09)
DEPTH_LIP = 0.0       # 縁の高さ(手前ほど小さい y)
DEPTH_RIM = 0.10      # 外のふちの、奥へ回り込む深さ
DEPTH_MOUTH = 0.30    # 斜めの面が下りきる口の深さ
DEPTH_CORE = 0.36     # 石の面の深さ(まんなかは手前へふくらむ)
FACET_STEPS = 10      # 斜めの面を縁から口まで何段に分けるか(角のすれ・汚れを、ふちの近くだけに付けるため)
# 汚し(--worn)
CHIPS = [(14, 0.10), (52, 0.08), (75, 0.12), (98, 0.07), (121, 0.09), (40, 0.06)]   # 欠け：外のふちの点の番号と大きさ
SEED = 3
CORE_DOME = 0.08

def bez(a, c, b, t):
    return ((1-t)**2*a[0] + 2*(1-t)*t*c[0] + t*t*b[0], (1-t)**2*a[1] + 2*(1-t)*t*c[1] + t*t*b[1])

def outline(sp):
    """角を丸めた、辺の膨らんだ三角の輪郭(点の数はどの輪郭でも同じ)"""
    C = sp["c"]; pts = []
    cx = sum(p[0] for p in C)/3; cy = sum(p[1] for p in C)/3
    def edge(e, t):
        a, b = C[e], C[(e + 1) % 3]
        m = ((a[0] + b[0])/2, (a[1] + b[1])/2)
        nx, ny = m[0] - cx, m[1] - cy; L = math.hypot(nx, ny)
        ctl = (m[0] + nx/L*sp["bulge"][e]*2, m[1] + ny/L*sp["bulge"][e]*2)
        return bez(a, ctl, b, t)
    u = sp["round"]
    for e in range(3):
        for i in range(N_EDGE):
            pts.append(edge(e, u + (1 - 2*u)*i/(N_EDGE - 1)))
        # 次の角の丸み(辺の終わり → 角 → 次の辺の始まり)
        k = (e + 1) % 3
        a = edge(e, 1 - u); c = edge(k, u)
        for i in range(1, N_CORNER + 1):
            pts.append(bez(a, C[k], c, i/(N_CORNER + 1)))
    return pts

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ 材質
def principled(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]

# 青銅：金属。細かいむら(つや)と、ごく弱い凹凸
bronze, nt, b = principled("bronze")
b.inputs["Base Color"].default_value = (0.66, 0.42, 0.22, 1)
b.inputs["Metallic"].default_value = 1.0
nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 18; nz.inputs["Detail"].default_value = 6
mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = 0.42; mr.inputs["To Max"].default_value = 0.6      # つや消し寄り(磨いた鏡のように周りを映さない)
nt.links.new(nz.outputs["Fac"], mr.inputs["Value"]); nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.04
nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])

# 口の内側の壁(暗い青銅)
wall, nt, b = principled("wall")
b.inputs["Base Color"].default_value = (0.25, 0.15, 0.08, 1); b.inputs["Metallic"].default_value = 1.0; b.inputs["Roughness"].default_value = 0.5

# 石：水面のようなさざめき(凹凸)と、まんなかほど白く強い光
core, nt, b = principled("core")
b.inputs["Base Color"].default_value = (0.0, 0.25, 0.32, 1)
b.inputs["Roughness"].default_value = 0.08
b.inputs["Coat Weight"].default_value = 1.0
tc = nt.nodes.new("ShaderNodeTexCoord")
grad = nt.nodes.new("ShaderNodeTexGradient"); grad.gradient_type = "SPHERICAL"
mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Location"].default_value = (0, -(DEPTH_CORE - CORE_DOME)*1.9, -0.12*1.9); mp.inputs["Scale"].default_value = (1.9, 1.9, 1.9)     # 光の中心を石のまんなか(手前の頂)に
nt.links.new(tc.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], grad.inputs["Vector"])
ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
cr.elements[0].position = 0.0; cr.elements[0].color = (0.0, 0.32, 0.42, 1)
cr.elements[1].position = 0.7; cr.elements[1].color = (0.8, 1.0, 1.0, 1)
e = cr.elements.new(0.4); e.color = (0.0, 0.75, 0.85, 1)
e = cr.elements.new(0.92); e.color = (1.0, 1.0, 1.0, 1)
nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
vo = nt.nodes.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = 30; vo.feature = "SMOOTH_F1"
nz2 = nt.nodes.new("ShaderNodeTexNoise"); nz2.inputs["Scale"].default_value = 7; nz2.inputs["Detail"].default_value = 4
mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "FLOAT"; mix.inputs["Factor"].default_value = 0.5
nt.links.new(vo.outputs["Distance"], mix.inputs["A"]); nt.links.new(nz2.outputs["Fac"], mix.inputs["B"])
bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 1.0; bp.inputs["Distance"].default_value = 0.03
nt.links.new(mix.outputs["Result"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
# 光の強さも、さざめきで少し揺らす(水の中のゆらぎ)
mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs["Factor"].default_value = 0.55
nt.links.new(ramp.outputs["Color"], mul.inputs["A"]); nt.links.new(mix.outputs["Result"], mul.inputs["B"])
nt.links.new(mul.outputs["Result"], b.inputs["Emission Color"])
b.inputs["Emission Strength"].default_value = 1.8
if WORN:
    # ほこりの膜(まだら)：光を少しさえぎる
    dz = nt.nodes.new("ShaderNodeTexNoise"); dz.inputs["Scale"].default_value = 5; dz.inputs["Detail"].default_value = 8
    nt.links.new(tc.outputs["Object"], dz.inputs["Vector"])
    dr = nt.nodes.new("ShaderNodeMapRange"); dr.inputs["From Min"].default_value = 0.48; dr.inputs["From Max"].default_value = 0.7; dr.inputs["To Max"].default_value = 0.65
    nt.links.new(dz.outputs["Fac"], dr.inputs["Value"])
    dust = nt.nodes.new("ShaderNodeBsdfPrincipled"); dust.inputs["Base Color"].default_value = (0.3, 0.27, 0.22, 1); dust.inputs["Roughness"].default_value = 1.0
    ms = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(dr.outputs["Result"], ms.inputs[0]); nt.links.new(b.outputs[0], ms.inputs[1]); nt.links.new(dust.outputs[0], ms.inputs[2])
    nt.links.new(ms.outputs[0], nt.nodes["Material Output"].inputs["Surface"])

# ------------------------------------------------------------------ 形
def ring(pts, depth, scale=1.0, lift=0.0):
    return [Vector((p[0]*scale, depth, p[1]*scale + lift)) for p in pts]

O = outline(OUTER); Lp = outline(LIP); I = outline(INNER)
n = len(O)
rings = [ring(O, DEPTH_RIM), ring(O, DEPTH_LIP + 0.02)]     # 外のふちの裏(奥へ回り込む)・外のふち
edge = [0.6, 1.0]           # ふちの印(角のすれを出す所。1 がふち)
LpR, IR = ring(Lp, DEPTH_LIP), ring(I, DEPTH_MOUTH)
for k in range(FACET_STEPS + 1):     # 縁の内 → 口(斜めの面)
    t = k/FACET_STEPS
    rings.append([a.lerp(b, t) for a, b in zip(LpR, IR)])
    edge.append(max(0.0, 1 - t*FACET_STEPS/2.5) if t < 0.5 else max(0.0, 1 - (1 - t)*FACET_STEPS/2.0)*0.8)
mouth = len(rings) - 1
rings.append(ring(I, DEPTH_CORE + 0.02, 0.97))     # 口の内側の壁の底
edge.append(0.0)
verts = [v for r in rings for v in r]
faces, mats = [], []
R = len(rings)
for ri in range(R):       # 最後は壁の底から外のふちの裏へつないで、閉じた形にする(欠けを削り取れるように)
    nx = (ri + 1) % R
    for i in range(n):
        j = (i + 1) % n
        faces.append((ri*n + i, ri*n + j, nx*n + j, nx*n + i))
        mats.append(1 if ri >= mouth else 0)
me = bpy.data.meshes.new("frame"); me.from_pydata(verts, [], faces); me.update()
# ふちの印：留め継ぎの稜線(角の丸みのまんなか)も、ふちとして扱う
mid = [e*(N_EDGE + N_CORNER) + N_EDGE + N_CORNER//2 for e in range(3)]
attr = me.attributes.new("edge", "FLOAT", "POINT")
for ri in range(R):
    for i in range(n):
        v = edge[ri]
        if 2 <= ri <= mouth and i in mid: v = max(v, 0.9)
        attr.data[ri*n + i].value = v
frame = bpy.data.objects.new("frame", me); sc.collection.objects.link(frame)
frame.data.materials.append(bronze); frame.data.materials.append(wall)
for p, m in zip(me.polygons, mats): p.material_index = m
# 角の稜線はくっきり、辺の中はなめらかに
for p in me.polygons: p.use_smooth = True
bpy.context.view_layer.objects.active = frame; frame.select_set(True)
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(25))
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode="OBJECT")
bv = frame.modifiers.new("bevel", "BEVEL"); bv.width = 0.02; bv.segments = 4; bv.limit_method = "ANGLE"; bv.angle_limit = math.radians(30)
frame.select_set(False)

# ------------------------------------------------------------------ 汚し(--worn)
if WORN:
    random.seed(SEED)
    # 欠け：でこぼこの石の形で、外のふちを削り取る。削れた面は地の金属(明るく、少しざらつく)
    chip, cnt, cb = principled("chip")
    cb.inputs["Base Color"].default_value = (0.78, 0.55, 0.34, 1); cb.inputs["Metallic"].default_value = 1.0; cb.inputs["Roughness"].default_value = 0.55
    cutters = bpy.data.collections.new("cutters"); sc.collection.children.link(cutters)
    tex = bpy.data.textures.new("chipNoise", "CLOUDS"); tex.noise_scale = 0.05
    for idx, r in CHIPS:
        p = O[idx % n]
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=(p[0], DEPTH_LIP - 0.01, p[1]))
        c = bpy.context.object
        for col in list(c.users_collection): col.objects.unlink(c)
        cutters.objects.link(c)
        c.scale = (1.0 + random.random()*0.6, 0.8 + random.random()*0.5, 0.7 + random.random()*0.5)
        c.rotation_euler = (random.random()*3, random.random()*3, random.random()*3)
        d = c.modifiers.new("rough", "DISPLACE"); d.texture = tex; d.strength = r*0.5
        c.data.materials.append(chip)
        c.hide_render = True
    bo = frame.modifiers.new("chips", "BOOLEAN"); bo.operation = "DIFFERENCE"; bo.operand_type = "COLLECTION"; bo.collection = cutters
    bo.solver = "EXACT"; bo.material_mode = "TRANSFER"

    # 青銅を汚す：地の青銅・角のすれ(地の金属が光る)・緑青(くぼみと大きなまだら)・茶色の錆の点・汚れ(くぼみと下のほう)
    nt = bronze.node_tree; base = nt.nodes["Principled BSDF"]; outn = nt.nodes["Material Output"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    def noise(scale, detail=8, rough=0.6, dist=0.0):
        z = nt.nodes.new("ShaderNodeTexNoise"); z.inputs["Scale"].default_value = scale; z.inputs["Detail"].default_value = detail
        z.inputs["Roughness"].default_value = rough; z.inputs["Distortion"].default_value = dist
        nt.links.new(tc.outputs["Object"], z.inputs["Vector"]); return z
    def band(src, lo, hi):
        r = nt.nodes.new("ShaderNodeMapRange"); r.interpolation_type = "SMOOTHSTEP"
        r.inputs["From Min"].default_value = lo; r.inputs["From Max"].default_value = hi
        nt.links.new(src, r.inputs["Value"]); return r.outputs["Result"]
    def math_(op, a, b):
        x = nt.nodes.new("ShaderNodeMath"); x.operation = op; x.use_clamp = True
        for k, v in enumerate((a, b)):
            if isinstance(v, (int, float)): x.inputs[k].default_value = v
            else: nt.links.new(v, x.inputs[k])
        return x.outputs[0]
    def shader(color, rough, metal=0.0):
        b = nt.nodes.new("ShaderNodeBsdfPrincipled")
        b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
        return b
    def mixs(a, b, fac):
        x = nt.nodes.new("ShaderNodeMixShader"); nt.links.new(fac, x.inputs[0])
        nt.links.new(a.outputs[0], x.inputs[1]); nt.links.new(b.outputs[0], x.inputs[2]); return x
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion"); ao.inputs["Distance"].default_value = 0.3
    crev = math_("SUBTRACT", 1.0, ao.outputs["AO"])                          # くぼみ(1 ほど奥まっている)
    ed = nt.nodes.new("ShaderNodeAttribute"); ed.attribute_name = "edge"
    big = noise(3.2, 10, 0.65, 0.4); small = noise(26, 6, 0.7)
    # 角のすれ：ふちの印 × 細かいむら
    wear = math_("MULTIPLY", band(ed.outputs["Fac"], 0.35, 0.9), band(small.outputs["Fac"], 0.42, 0.55))
    s1 = mixs(base, shader((0.86, 0.62, 0.38), 0.25, 1.0), wear)
    # 緑青：大きなまだらと、くぼみ(下ほど多い)
    low = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], low.inputs[0])
    lowz = band(low.outputs["Z"], 0.3, -0.9)
    pat = math_("ADD", band(big.outputs["Fac"], 0.5, 0.62), math_("MULTIPLY", band(crev, 0.08, 0.35), 1.3))
    pat = math_("MULTIPLY", math_("ADD", pat, math_("MULTIPLY", lowz, 0.25)), band(small.outputs["Fac"], 0.3, 0.6))
    pat = math_("MULTIPLY", pat, math_("SUBTRACT", 1.0, wear))
    s2 = mixs(s1, shader((0.16, 0.42, 0.36), 0.85), pat)
    # 茶色の錆の点
    vo = nt.nodes.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = 9; nt.links.new(tc.outputs["Object"], vo.inputs["Vector"])
    spot = math_("MULTIPLY", band(vo.outputs["Distance"], 0.22, 0.05), band(noise(5, 4).outputs["Fac"], 0.5, 0.58))
    s3 = mixs(s2, shader((0.28, 0.11, 0.04), 0.9), spot)
    # 汚れ：くぼみと下のほうに、暗い膜
    grime = math_("MULTIPLY", math_("ADD", band(crev, 0.05, 0.4), math_("MULTIPLY", lowz, 0.35)), 0.75)
    s4 = mixs(s3, shader((0.05, 0.035, 0.02), 1.0), grime)
    nt.links.new(s4.outputs[0], outn.inputs["Surface"])

# 石：口の輪郭を何重にも縮めて、まんなかへふくらむ面にする
K = 14
cverts = [Vector((0, DEPTH_CORE - CORE_DOME, 0.12))]
cfaces = []
for k in range(1, K + 1):
    s = k/K
    for p in I:
        x, z = p[0]*0.97, p[1]*0.97
        cverts.append(Vector((x*s, DEPTH_CORE - CORE_DOME*(1 - s*s), (z - 0.12)*s + 0.12)))
for i in range(n):
    cfaces.append((0, 1 + i, 1 + (i + 1) % n))
for k in range(1, K):
    for i in range(n):
        a = 1 + (k - 1)*n; b2 = 1 + k*n; j = (i + 1) % n
        cfaces.append((a + i, b2 + i, b2 + j, a + j))
cm = bpy.data.meshes.new("core"); cm.from_pydata(cverts, [], cfaces); cm.update()
coreo = bpy.data.objects.new("core", cm); sc.collection.objects.link(coreo)
coreo.data.materials.append(core)
for p in cm.polygons: p.use_smooth = True
# 法線を手前(-y)へそろえる
bpy.context.view_layer.objects.active = coreo; coreo.select_set(True)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode="OBJECT")
coreo.select_set(False)
# 石の光が枠の内側を照らす
L = bpy.data.lights.new("coreGlow", "POINT"); L.energy = 1.5; L.color = (0.3, 0.9, 1.0); L.shadow_soft_size = 0.3
lo = bpy.data.objects.new("coreGlow", L); sc.collection.objects.link(lo); lo.location = (0, DEPTH_CORE - 0.25, 0.12)

# ------------------------------------------------------------------ カメラと光
cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = 2.16
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -6, -0.08); cam.rotation_euler = (math.radians(90), 0, 0)

def area(name, loc, energy, color, size):
    Ld = bpy.data.lights.new(name, "AREA"); Ld.energy = energy; Ld.color = color; Ld.size = size
    o = bpy.data.objects.new(name, Ld); sc.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
area("key", (-3.5, -3.0, 3.0), 220, (1.0, 0.88, 0.74), 2.0)     # 左上から強く(面ごとの明るさの差を出す)       # 左上から(上と左の面を明るく)
area("rim", (3.5, -1.5, -1.0), 25, (0.7, 0.75, 0.95), 1.5)       # 右下から青い照り返し(背景の青を映す)
area("top", (0.0, -2.0, 5.0), 50, (1.0, 0.9, 0.8), 4.0)

# 金属は周りを映すので、上が明るく下が暗い、青みのスタジオにする
world = bpy.data.worlds.new("world"); sc.world = world; world.use_nodes = True
wn = world.node_tree; bgn = wn.nodes["Background"]
wtc = wn.nodes.new("ShaderNodeTexCoord"); sep = wn.nodes.new("ShaderNodeSeparateXYZ")
wr = wn.nodes.new("ShaderNodeValToRGB"); wcr = wr.color_ramp
wcr.elements[0].position = 0.35; wcr.elements[0].color = (0.03, 0.02, 0.015, 1)     # 下は暗い茶(紺だと青銅が緑がかる)
wcr.elements[1].position = 0.75; wcr.elements[1].color = (0.42, 0.28, 0.16, 1)     # 青銅に映る周り(暗い茶。明るすぎると銀色に見える)
mrw = wn.nodes.new("ShaderNodeMapRange"); mrw.inputs["From Min"].default_value = -1; mrw.inputs["From Max"].default_value = 1
wn.links.new(wtc.outputs["Generated"], sep.inputs[0]); wn.links.new(sep.outputs["Z"], mrw.inputs["Value"])
wn.links.new(mrw.outputs["Result"], wr.inputs["Fac"]); wn.links.new(wr.outputs["Color"], bgn.inputs["Color"])
bgn.inputs["Strength"].default_value = 0.3

# ------------------------------------------------------------------ 描く
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Khronos PBR Neutral"; sc.view_settings.look = "None"     # 色を抜かずに、明るい所だけ丸める
try:
    sc.eevee.taa_render_samples = 64
    sc.eevee.use_raytracing = True
except AttributeError:
    pass
def export_js(path):
    """形を書き出す。座標はゲームの WebGL の向き(x 右・y 上・z 手前)に直し、
    位置は16bit・法線は8bitの整数にして base64 で埋める(ファイルを小さく)"""
    import struct, base64
    dg = bpy.context.evaluated_depsgraph_get()
    pos, nrm, att, idx, seen = [], [], [], [], {}
    for obj, mat_base in ((frame, 0), (coreo, 2)):
        ev = obj.evaluated_get(dg); m = ev.to_mesh()
        m.calc_loop_triangles()
        cn = m.corner_normals
        ea = m.attributes.get("edge")
        for tri in m.loop_triangles:
            # 材質：0 青銅・1 口の内側の壁・2 石。欠けの断面(削った石の材質)は青銅で、ふちの印を立てる(地の金属が出る)
            chipFace = mat_base == 0 and tri.material_index >= 2
            mi = 0 if chipFace else mat_base + (tri.material_index if mat_base == 0 else 0)
            for li, vi in zip(tri.loops, tri.vertices):
                v = m.vertices[vi].co; nn = cn[li].vector
                e = 1.0 if chipFace else (ea.data[vi].value if (ea and mat_base == 0) else 0.0)
                key = (round(v.x, 4), round(v.y, 4), round(v.z, 4), round(nn.x, 2), round(nn.y, 2), round(nn.z, 2), mi)
                k = seen.get(key)
                if k is None:
                    k = len(pos); seen[key] = k
                    pos.append((v.x, v.z, -v.y)); nrm.append((nn.x, nn.z, -nn.y)); att.append((int(max(0, min(1, e))*255), mi))
                idx.append(k)
        ev.to_mesh_clear()
    S = max(abs(c) for p in pos for c in p)*1.001
    b = lambda fmt, data: base64.b64encode(b"".join(struct.pack(fmt, *d) for d in data)).decode()
    js = ("// tools/blender/relic.py --export で書き出した形(手で直さない)。読むのは relic3d.js\n"
          "var RELIC_MODEL = {\n"
          "    scale:%.5f,      //位置は -1～1 の16bitの整数。これを掛けると元の大きさ\n"
          "    count:%d,        //頂点の数\n"
          "    pos:\"%s\",\n    nrm:\"%s\",\n    att:\"%s\",\n    idx:\"%s\"\n};\n") % (
        S, len(pos),
        b("<3h", [tuple(int(round(c/S*32767)) for c in p) for p in pos]),
        b("<3b", [tuple(int(round(max(-1, min(1, c))*127)) for c in n) for n in nrm]),
        b("<2B", att),
        b("<H", [(i,) for i in idx]))
    with open(path, "w", encoding="utf-8", newline="\n") as f: f.write(js)
    print("書き出し:", path, "頂点", len(pos), "三角形", len(idx)//3, "大きさ", len(js)//1024, "KB")

if EXPORT:
    export_js(EXPORT)
else:
    sc.render.filepath = OUT
    bpy.ops.render.render(write_still=True)
    print("書き出し:", OUT)
