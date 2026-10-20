# ドローン君を Blender で描いて、ゲームのシート(images/game/Drone/drone_案.png)に書き出す
#   使い方(画面なしで動かす):
#     "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python tools/blender/drone.py -- 案 [出力.png] [--views]
#   案：R(リアル。光・影・つやを Blender に計算させる)・T(トゥーン。段の付いた影とふちどり。標準の絵の画風に寄せる)
#   --views を付けると、シートの代わりに6方向を大きく描いた見比べ用の1枚にする
#   形は tools/drone-art.html の案D(元の絵のテイスト)と同じ寸法。座標はそのページの値(y が上・z が手前)を
#   Blender の向き(z が上・-y が手前)へ置きかえて使う(gl)。
import bpy, sys, os, math
import numpy as np
from mathutils import Vector

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = (ARGV[0] if ARGV else "R").upper()
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
OUT = ARGV[1] if len(ARGV) > 1 and not ARGV[1].startswith("--") else os.path.join(ROOT, "images", "game", "Drone", "drone_" + MODE + ".png")
VIEWS_ONLY = "--views" in ARGV

F = 160                                  # 1コマの大きさ(px。ゲームの40pxの4倍。common.js の DRONE_FRAME)
YAWS = 16                                # 水平の向きの段数(正で左を向く)
ELEVS = [-25, -5, 15, 35, 55]            # カメラの高さ(度。上の段から：見上げる → 見下ろす)
HALF = 1.26                              # 描く範囲の半分の幅(drone-art.html の案D)
CY = 0.46                                # 描く範囲の中心の高さ
SS = 2                                   # 大きく描いてから縮める倍率(ふちをなめらかに)
VIEWS = [("正面", 0, 15), ("上へ", 0, -25), ("下へ", 0, 55), ("左へ", 67.5, 15), ("右へ", -67.5, 15), ("後ろ", 180, 15)]

def gl(x, y, z):
    """drone-art.html の座標(y が上・z が手前)を Blender の座標へ"""
    return Vector((x, -z, y))

# ------------------------------------------------------------------ 場面を空にする
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ 材質
def mat(name, color, rough=0.4, metal=0.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    outn = nt.nodes.new("ShaderNodeOutputMaterial")
    if MODE == "T":
        # トゥーン：光の当たり方を3段に分けて塗る(明るい面・ふつう・影)。つやの点は1つだけ白く
        d = nt.nodes.new("ShaderNodeBsdfDiffuse"); d.inputs["Color"].default_value = (1, 1, 1, 1)
        s2r = nt.nodes.new("ShaderNodeShaderToRGB")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        cr = ramp.color_ramp; cr.interpolation = "CONSTANT"
        c = Vector(color)
        cr.elements[0].position = 0.0; cr.elements[0].color = (*(c*0.45), 1)
        cr.elements[1].position = 0.18; cr.elements[1].color = (*(c*0.8), 1)
        e = cr.elements.new(0.55); e.color = (*(c*1.15), 1)
        nt.links.new(d.outputs[0], s2r.inputs[0])
        nt.links.new(s2r.outputs["Color"], ramp.inputs["Fac"])
        em = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
        if emit:
            add = nt.nodes.new("ShaderNodeEmission"); add.inputs["Color"].default_value = (*emit, 1)
            mix = nt.nodes.new("ShaderNodeAddShader")
            nt.links.new(em.outputs[0], mix.inputs[0]); nt.links.new(add.outputs[0], mix.inputs[1])
            nt.links.new(mix.outputs[0], outn.inputs["Surface"])
        else:
            nt.links.new(em.outputs[0], outn.inputs["Surface"])
    else:
        b = nt.nodes.new("ShaderNodeBsdfPrincipled")
        b.inputs["Base Color"].default_value = (*color, 1)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
        if emit:
            b.inputs["Emission Color"].default_value = (*emit, 1)
            b.inputs["Emission Strength"].default_value = 1.0
        nt.links.new(b.outputs[0], outn.inputs["Surface"])
    return m

# 色はリニアの値(drone-art.html の案Dをもとに、胴体とふたは暗くした)
M_BODY  = mat("body",  (0.12, 0.125, 0.135), 0.36)     # 元の絵の暗い灰色(案Dの値は、案Dの光の弱さで暗く見えていた)
M_LID   = mat("lid",   (0.17, 0.175, 0.185), 0.32)
M_DARK  = mat("dark",  (0.06, 0.065, 0.07), 0.35)
M_METAL = mat("metal", (0.86, 0.85, 0.83), 0.2, 1.0)
M_BEZEL = mat("bezel", (0.9, 0.9, 0.87), 0.3)
M_LENS  = mat("lens",  (0.015, 0.015, 0.015), 0.05)
M_SHINE = mat("shine", (0.6, 0.6, 0.6), 0.5, 0.0, (0.55, 0.55, 0.55))

# ------------------------------------------------------------------ 形
def rbox(name, c, half, r, m):
    """角の丸い箱(c：中心 half：半分の大きさ。どちらも drone-art.html の座標)"""
    bpy.ops.mesh.primitive_cube_add(size=2, location=gl(*c))
    o = bpy.context.object; o.name = name
    o.scale = (half[0], half[2], half[1])
    bpy.ops.object.transform_apply(scale=True)
    if r > 0:
        bv = o.modifiers.new("bevel", "BEVEL"); bv.width = r; bv.segments = 4; bv.limit_method = "NONE"
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o

def cyl(name, c, r, h, m, seg=24):
    """縦の円柱(h：半分の高さ)"""
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h*2, location=gl(*c))
    o = bpy.context.object; o.name = name
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o

def ball(name, c, r, m):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=gl(*c), segments=24, ring_count=12)
    o = bpy.context.object; o.name = name
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o

# 胴体・上のふた・角のガード
rbox("body", (0, 0, 0), (0.95, 0.56, 0.62), 0.12, M_BODY)
rbox("lid", (0, 0.52, 0), (0.91, 0.08, 0.58), 0.07, M_LID)
for sx in (-1, 1):
    for sy in (-1, 1):
        for sz in (-1, 1):
            rbox("guard", (sx*0.87, sy*0.48, sz*0.54), (0.1, 0.1, 0.1), 0.05, M_DARK)
# 目：黒い台・白い枠(4本の棒で囲む)・黒いレンズ・左上の小さなハイライト
for sx in (-1, 1):
    ex, ey = sx*0.42, 0.08
    rbox("eyebase", (ex, ey, 0.62), (0.215, 0.215, 0.03), 0.025, M_DARK)
    w = 0.03   # 枠の太さ(0.165 - 0.105 の半分ほど)
    rbox("frameT", (ex, ey + 0.135, 0.65), (0.165, w, 0.03), 0.012, M_BEZEL)
    rbox("frameB", (ex, ey - 0.135, 0.65), (0.165, w, 0.03), 0.012, M_BEZEL)
    rbox("frameL", (ex - 0.135, ey, 0.65), (w, 0.165, 0.03), 0.012, M_BEZEL)
    rbox("frameR", (ex + 0.135, ey, 0.65), (w, 0.165, 0.03), 0.012, M_BEZEL)
    rbox("lens", (ex, ey, 0.635), (0.11, 0.11, 0.03), 0.01, M_LENS)
    rbox("shine", (ex - 0.05, ey + 0.05, 0.667), (0.028, 0.028, 0.002), 0.0, M_SHINE)

# プロペラ(細い棒・根元と先の金具・平たい2枚の羽根・ハブ)
def rotor(base, top, ang, ln=0.32, wid=0.04, mr=0.03):
    bx, by, bz = base
    cyl("mast", (bx, by + top*0.5, bz), mr, top*0.5, M_DARK, 12)
    cyl("collar", (bx, by + 0.03, bz), mr*2.1 + 0.01, 0.035, M_METAL)
    cyl("cap", (bx, by + top, bz), mr*1.9 + 0.008, 0.04, M_METAL)
    blade = rbox("blade", (bx, by + top + 0.045, bz), (ln, 0.012, wid), 0.01, M_DARK)
    # 先ほど細く(先の頂点を寄せる)
    for v in blade.data.vertices:
        t = min(1.0, abs(v.co.x - gl(bx, 0, 0).x)/ln)
        v.co.y = gl(0, 0, bz).y + (v.co.y - gl(0, 0, bz).y)*(1 - 0.45*t)
    blade.rotation_euler = (0, 0, ang)
    ball("hub", (bx, by + top + 0.075, bz), mr*1.3, M_METAL)

rotor((-0.72, 0.58, 0.22), 0.78, 0.12)
rotor((0.72, 0.58, 0.22), 0.78, -0.1)
rotor((0.0, 0.58, -0.30), 0.92, 0.05)

# 羽根は自分の位置のまわりで回すので、原点を位置に合わせる
for o in bpy.data.objects:
    if o.name.startswith("blade"):
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
        o.select_set(False)

# ------------------------------------------------------------------ ふちどり(トゥーン)：裏返した殻を少し太らせて黒く塗る
#   殻の面は外向きのまま裏返してあるので、手前の面は裏向きになって消え(backface culling)、奥の面だけがふちからはみ出して見える
if MODE == "T":
    ink = bpy.data.materials.new("ink")
    ink.use_nodes = True
    nt = ink.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    o_ = nt.nodes.new("ShaderNodeOutputMaterial")
    e_ = nt.nodes.new("ShaderNodeEmission"); e_.inputs["Color"].default_value = (0.012, 0.012, 0.015, 1)
    nt.links.new(e_.outputs[0], o_.inputs["Surface"])
    ink.use_backface_culling = True
    for o in bpy.data.objects:
        if o.type != "MESH" or o.name.startswith("shine"): continue
        o.data.materials.append(ink)
        so = o.modifiers.new("outline", "SOLIDIFY")
        so.thickness = -0.028 if o.name.startswith(("body", "lid")) else -0.016
        so.offset = 1.0; so.use_flip_normals = True; so.material_offset = len(o.data.materials) - 1
        so.use_rim = False

# ------------------------------------------------------------------ カメラと光(光はカメラに付けて、どの向きでも同じ当たり方に)
tgt = bpy.data.objects.new("target", None); sc.collection.objects.link(tgt)
tgt.location = gl(0, CY, 0)
cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = HALF*2
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
tc = cam.constraints.new("TRACK_TO"); tc.target = tgt; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"

def cam_light(name, d, energy, color, size):
    """カメラから見た向き d(右・上・手前)から当たる平行光"""
    L = bpy.data.lights.new(name, "SUN"); L.energy = energy; L.color = color; L.angle = math.radians(size)
    o = bpy.data.objects.new(name, L); sc.collection.objects.link(o)
    o.parent = cam
    v = Vector(d).normalized()
    o.rotation_euler = (-v).to_track_quat("-Z", "Y").to_euler()
    return o

if MODE == "T":
    cam_light("key", (-0.55, 0.75, 0.45), 3.0, (1, 1, 1), 1)
else:
    cam_light("key", (-0.55, 0.75, 0.45), 4.0, (1.0, 0.97, 0.92), 6)
    cam_light("rim", (0.8, 0.25, -0.5), 3.5, (0.75, 0.85, 1.0), 4)
    cam_light("fill", (0.6, -0.1, 0.8), 0.6, (0.85, 0.9, 1.0), 20)

world = bpy.data.worlds.new("world"); sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.32, 0.34, 0.38, 1) if MODE == "R" else (0, 0, 0, 1)
bg.inputs["Strength"].default_value = 0.6 if MODE == "R" else 0.0

# ------------------------------------------------------------------ 描き方
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = F*SS
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard" if MODE == "T" else "Khronos PBR Neutral"     #リアルは色を変えずに明るい所だけ丸める
sc.view_settings.look = "None"
ee = sc.eevee
try:
    ee.taa_render_samples = 32
    ee.use_shadows = True
    if MODE == "R":
        ee.use_raytracing = True
        ee.fast_gi_method = "GLOBAL_ILLUMINATION"
except AttributeError:
    pass

TMP = os.path.join(bpy.app.tempdir, "drone_frame.png")
def render_view(yaw, elev):
    """向き(度)を決めて描き、F×F の配列(縦は上から、RGBA 0～1)を返す"""
    y, e = math.radians(yaw), math.radians(elev)
    cam.location = tgt.location + gl(math.cos(e)*math.sin(y), math.sin(e), math.cos(e)*math.cos(y))*6
    sc.render.filepath = TMP
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(TMP, check_existing=False)
    a = np.empty(img.size[0]*img.size[1]*4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    a = a.reshape(F*SS, F*SS, 4)[::-1]          # Blender の画像は下から並ぶ
    # 大きく描いた分を縮める(色は透明を掛けて平均し、ふちが黒ずまないように)
    a = a.reshape(F, SS, F, SS, 4)
    al = a[..., 3:4]
    rgb = (a[..., :3]*al).mean(axis=(1, 3)); al = al.mean(axis=(1, 3))
    rgb = np.where(al > 1e-4, rgb/np.maximum(al, 1e-4), 0)
    return np.concatenate([rgb, al], axis=2)

def save(arr):
    h, w = arr.shape[:2]
    img = bpy.data.images.new("sheet", w, h, alpha=True)
    img.pixels.foreach_set(arr[::-1].astype(np.float32).ravel())
    img.filepath_raw = OUT; img.file_format = "PNG"
    img.save()
    print("書き出し:", OUT, w, "x", h)

if VIEWS_ONLY:
    sheet = np.zeros((F, F*len(VIEWS), 4), dtype=np.float32)
    for i, v in enumerate(VIEWS):
        sheet[:, i*F:(i + 1)*F] = render_view(v[1], v[2])
else:
    sheet = np.zeros((F*len(ELEVS), F*YAWS, 4), dtype=np.float32)
    for r, e in enumerate(ELEVS):
        for k in range(YAWS):
            sheet[r*F:(r + 1)*F, k*F:(k + 1)*F] = render_view(k*360/YAWS, e)
        print("段", r + 1, "/", len(ELEVS))
save(sheet)
