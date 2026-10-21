# 傀儡師戦の舞台のドローン君(images/game/Drone/drone_P.png)を Blender で描く
#   使い方(画面なしで動かす):
#     "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python tools/blender/droneStage.py -- [出力.png] [--views] [--fast]
#   --views：シートの代わりに6方向を大きく並べた見比べ用の1枚
#   形は標準のドローン君(案D の寸法。feature/webgl-trial の tools/blender/drone.py と同じ)のまま、質感だけを
#   人形劇の舞台に合わせる：使い込まれたブリキのからくり人形。黒い漆塗りの胴に金の細い線、真ちゅうの角金具と鋲、
#   すり傷と塗りの剥げ、くぼみの汚れ。光は舞台の照明(左上から暖かいスポットライト・右後ろから紫のふち)。
#   シートの形式は common.js の buildBakedSheets(1コマ DRONE_FRAME = 160px、横に水平の向き・縦に高さ)。
import bpy, sys, os, math
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
FAST = "--fast" in ARGS
VIEWS_ONLY = "--views" in ARGS
ARGV = [a for a in ARGS if not a.startswith("--")]
OUT = os.path.abspath(ARGV[0] if ARGV else "images/game/Drone/drone_P.png")

F = 160                                  # 1コマの大きさ(px。ゲームの40pxの4倍)
YAWS = 16                                # 水平の向きの段数(正で左を向く)
ELEVS = [-25, -5, 15, 35, 55]            # カメラの高さ(度。上の段から：見上げる → 見下ろす)
HALF = 1.26                              # 描く範囲の半分の幅
CY = 0.46                                # 描く範囲の中心の高さ
SS = 2                                   # 大きく描いてから縮める倍率(ふちをなめらかに)
VIEWS = [(0, 15), (0, -25), (0, 55), (67.5, 15), (-67.5, 15), (180, 15)]

def gl(x, y, z):
    """形の座標(y が上・z が手前)を Blender の座標へ"""
    return Vector((x, -z, y))

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ------------------------------------------------------------------ 材質
def nodes(m):
    nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    return nt, nt.nodes.new("ShaderNodeOutputMaterial")

def lacquer(name, base, half):
    """黒い漆塗りのブリキ：つや(上塗り)・細かいすり傷・角の塗りの剥げ(下のブリキが光る)・面のふちの金の細い線。
    half は箱の半分の大きさ(Blender の向き)。角・ふちの位置を物の座標から出すのに使う"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt, outn = nodes(m)
    N, L = nt.nodes, nt.links
    tc = N.new("ShaderNodeTexCoord")
    sep = N.new("ShaderNodeSeparateXYZ"); L.new(tc.outputs["Object"], sep.inputs[0])
    def mth(op, a, b=0.0, clamp=True):
        x = N.new("ShaderNodeMath"); x.operation = op; x.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)): x.inputs[i].default_value = v
            else: L.new(v, x.inputs[i])
        return x.outputs[0]
    def band(v, lo, hi):
        r = N.new("ShaderNodeMapRange"); r.interpolation_type = "SMOOTHSTEP"
        r.inputs["From Min"].default_value = lo; r.inputs["From Max"].default_value = hi
        L.new(v, r.inputs["Value"]); return r.outputs["Result"]
    def noise(scale, detail=6, vec=None):
        z = N.new("ShaderNodeTexNoise"); z.inputs["Scale"].default_value = scale; z.inputs["Detail"].default_value = detail
        L.new(vec or tc.outputs["Object"], z.inputs["Vector"]); return z.outputs["Fac"]
    # 各軸の「ふちへの近さ」(0 まんなか ～ 1 ふち)
    near = [mth("DIVIDE", mth("ABSOLUTE", sep.outputs[a], 0, False), h, False) for a, h in zip("XYZ", half)]
    # 角・稜線：2つの軸がふちに近い所
    pair = [mth("MULTIPLY", band(near[i], 0.86, 0.99), band(near[j], 0.86, 0.99)) for i, j in ((0, 1), (1, 2), (0, 2))]
    edge = mth("MAXIMUM", mth("MAXIMUM", pair[0], pair[1]), pair[2])
    wear = mth("MULTIPLY", edge, band(noise(22), 0.38, 0.55))             # 角の剥げ(ところどころ)
    # 金の細い線：前の面(手前 -y)のふちから少し内側を1周
    front = band(mth("MULTIPLY", sep.outputs["Y"], -1.0, False), half[1]*0.9, half[1]*0.99)
    inner = mth("MAXIMUM", band(near[0], 0.80, 0.83), band(near[2], 0.78, 0.81))
    stripe = mth("MULTIPLY", front, mth("MULTIPLY", inner, mth("MAXIMUM", band(near[0], 0.87, 0.85), band(near[2], 0.86, 0.84))))
    # 面の色：漆 → 金の線 → 剥げたブリキ。くぼみに汚れ
    def bsdf(color, rough, metal=0.0, coat=0.0):
        b = N.new("ShaderNodeBsdfPrincipled")
        b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal; b.inputs["Coat Weight"].default_value = coat
        return b
    paint = bsdf(base, 0.3, 0.0, 0.8)
    # すり傷：細長く伸ばしたむらで、上塗りのつやを乱す
    mp = N.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (40, 40, 3); L.new(tc.outputs["Object"], mp.inputs["Vector"])
    scr = band(noise(1.0, 3, mp.outputs["Vector"]), 0.62, 0.7)
    rr = N.new("ShaderNodeMapRange"); rr.inputs["To Min"].default_value = 0.25; rr.inputs["To Max"].default_value = 0.55
    L.new(scr, rr.inputs["Value"]); L.new(rr.outputs["Result"], paint.inputs["Roughness"])
    bp = N.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.12; bp.inputs["Distance"].default_value = 0.004
    L.new(noise(60, 4), bp.inputs["Height"]); L.new(bp.outputs["Normal"], paint.inputs["Normal"])
    goldline = bsdf((0.75, 0.55, 0.22), 0.3, 1.0)
    tin = bsdf((0.72, 0.70, 0.66), 0.35, 1.0)
    ao = N.new("ShaderNodeAmbientOcclusion"); ao.inputs["Distance"].default_value = 0.15
    grime = mth("MULTIPLY", mth("SUBTRACT", 1.0, ao.outputs["AO"]), 1.5)
    dirt = bsdf((0.04, 0.03, 0.02), 0.9)
    def mix(a, b, f):
        x = N.new("ShaderNodeMixShader"); L.new(f, x.inputs[0]); L.new(a, x.inputs[1]); L.new(b, x.inputs[2]); return x.outputs[0]
    s = mix(paint.outputs[0], goldline.outputs[0], stripe)
    s = mix(s, tin.outputs[0], wear)
    s = mix(s, dirt.outputs[0], grime)
    L.new(s, outn.inputs["Surface"])
    return m

def plain(name, color, rough, metal=0.0, grime=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt, outn = nodes(m)
    N, L = nt.nodes, nt.links
    b = N.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal; b.inputs["Coat Weight"].default_value = coat
    if grime > 0:
        # 真ちゅうのくすみ：むらと、くぼみの黒ずみ
        tc = N.new("ShaderNodeTexCoord")
        z = N.new("ShaderNodeTexNoise"); z.inputs["Scale"].default_value = 30; L.new(tc.outputs["Object"], z.inputs["Vector"])
        ao = N.new("ShaderNodeAmbientOcclusion"); ao.inputs["Distance"].default_value = 0.08
        inv = N.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0; L.new(ao.outputs["AO"], inv.inputs[1])
        add = N.new("ShaderNodeMath"); add.operation = "ADD"; add.use_clamp = True
        L.new(inv.outputs[0], add.inputs[0])
        mr = N.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = 0.5; mr.inputs["From Max"].default_value = 0.75; mr.inputs["To Max"].default_value = grime
        L.new(z.outputs["Fac"], mr.inputs["Value"]); L.new(mr.outputs["Result"], add.inputs[1])
        d = N.new("ShaderNodeBsdfPrincipled"); d.inputs["Base Color"].default_value = (0.08, 0.05, 0.02, 1); d.inputs["Roughness"].default_value = 0.8
        mx = N.new("ShaderNodeMixShader"); L.new(add.outputs[0], mx.inputs[0]); L.new(b.outputs[0], mx.inputs[1]); L.new(d.outputs[0], mx.inputs[2])
        L.new(mx.outputs[0], outn.inputs["Surface"])
    else:
        L.new(b.outputs[0], outn.inputs["Surface"])
    return m

M_BRASS = plain("brass", (0.70, 0.50, 0.24), 0.35, 1.0, 0.6)
M_DARK  = plain("dark", (0.03, 0.028, 0.03), 0.4, 0.0, 0.0, 0.5)
M_IVORY = plain("ivory", (0.78, 0.72, 0.58), 0.45, 0.0, 0.35, 0.3)     # 目の枠：黄ばんだ象牙色の塗り
M_LENS  = plain("lens", (0.01, 0.01, 0.012), 0.03, 0.0, 0.0, 1.0)      # ガラスの目
M_SHINE = plain("shine", (1, 1, 1), 0.3)
M_SHINE.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1.0, 0.92, 0.8, 1)
M_SHINE.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 1.5

# ------------------------------------------------------------------ 形(標準のドローン君と同じ寸法)
def rbox(name, c, half, r, m):
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
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=h*2, location=gl(*c))
    o = bpy.context.object; o.name = name; o.data.materials.append(m); bpy.ops.object.shade_smooth()
    return o

def ball(name, c, r, m, seg=24):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=gl(*c), segments=seg, ring_count=seg//2)
    o = bpy.context.object; o.name = name; o.data.materials.append(m); bpy.ops.object.shade_smooth()
    return o

# 胴体・上のふた(漆塗りのブリキ)。half は Blender の向き(x, y 奥行き, z 高さ)
rbox("body", (0, 0, 0), (0.95, 0.56, 0.62), 0.12, lacquer("body", (0.022, 0.02, 0.026), (0.95, 0.62, 0.56)))
rbox("lid", (0, 0.52, 0), (0.91, 0.08, 0.58), 0.07, lacquer("lid", (0.06, 0.045, 0.05), (0.91, 0.58, 0.08)))
# 角の金具(真ちゅう)と、胴の前後のふちに並ぶ鋲
for sx in (-1, 1):
    for sy in (-1, 1):
        for sz in (-1, 1):
            rbox("guard", (sx*0.87, sy*0.48, sz*0.54), (0.11, 0.11, 0.11), 0.05, M_BRASS)
for sz in (-1, 1):
    for k in range(7):
        x = -0.6 + k*0.2
        ball("rivet", (x, -0.5, sz*0.625), 0.028, M_BRASS, 10)
        ball("rivet", (x, 0.44, sz*0.625), 0.028, M_BRASS, 10)
# 横腹のぜんまいの巻き鍵(からくり人形らしさ。後ろ寄り)
for sx in (-1, 1):
    cyl("keyShaft", (sx*1.02, 0.05, -0.3), 0.035, 0.08, M_BRASS, 12).rotation_euler = (0, math.pi/2, 0)
    k = rbox("keyWing", (sx*1.11, 0.05, -0.3), (0.025, 0.16, 0.07), 0.02, M_BRASS)
# 目：黒い台・象牙色の枠・ガラスのレンズ・左上の小さな光
for sx in (-1, 1):
    ex, ey = sx*0.42, 0.08
    rbox("eyebase", (ex, ey, 0.62), (0.215, 0.215, 0.03), 0.025, M_DARK)
    w = 0.03
    rbox("frameT", (ex, ey + 0.135, 0.65), (0.165, w, 0.03), 0.012, M_IVORY)
    rbox("frameB", (ex, ey - 0.135, 0.65), (0.165, w, 0.03), 0.012, M_IVORY)
    rbox("frameL", (ex - 0.135, ey, 0.65), (w, 0.165, 0.03), 0.012, M_IVORY)
    rbox("frameR", (ex + 0.135, ey, 0.65), (w, 0.165, 0.03), 0.012, M_IVORY)
    ball("lens", (ex, ey, 0.64), 0.105, M_LENS).scale = (1, 0.4, 1)
    rbox("shine", (ex - 0.05, ey + 0.05, 0.667), (0.028, 0.028, 0.002), 0.0, M_SHINE)

# プロペラ(真ちゅうの棒と金具・黒い羽根)
def rotor(base, top, ang, ln=0.32, wid=0.04, mr=0.03):
    bx, by, bz = base
    cyl("mast", (bx, by + top*0.5, bz), mr, top*0.5, M_BRASS, 12)
    cyl("collar", (bx, by + 0.03, bz), mr*2.1 + 0.01, 0.035, M_BRASS)
    cyl("cap", (bx, by + top, bz), mr*1.9 + 0.008, 0.04, M_BRASS)
    blade = rbox("blade", (bx, by + top + 0.045, bz), (ln, 0.012, wid), 0.01, M_DARK)
    for v in blade.data.vertices:
        t = min(1.0, abs(v.co.x - gl(bx, 0, 0).x)/ln)
        v.co.y = gl(0, 0, bz).y + (v.co.y - gl(0, 0, bz).y)*(1 - 0.45*t)
    blade.rotation_euler = (0, 0, ang)
    ball("hub", (bx, by + top + 0.075, bz), mr*1.3, M_BRASS)

rotor((-0.72, 0.58, 0.22), 0.78, 0.12)
rotor((0.72, 0.58, 0.22), 0.78, -0.1)
rotor((0.0, 0.58, -0.30), 0.92, 0.05)
for o in bpy.data.objects:
    if o.name.startswith("blade"):
        bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS"); o.select_set(False)

# ------------------------------------------------------------------ カメラと光(光はカメラに付けて、どの向きでも同じ当たり方に)
tgt = bpy.data.objects.new("target", None); sc.collection.objects.link(tgt); tgt.location = gl(0, CY, 0)
cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = HALF*2
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
tc = cam.constraints.new("TRACK_TO"); tc.target = tgt; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"

def cam_light(name, d, energy, color, size):
    L = bpy.data.lights.new(name, "SUN"); L.energy = energy; L.color = color; L.angle = math.radians(size)
    o = bpy.data.objects.new(name, L); sc.collection.objects.link(o); o.parent = cam
    o.rotation_euler = (-Vector(d).normalized()).to_track_quat("-Z", "Y").to_euler()
cam_light("key", (-0.55, 0.8, 0.4), 5.0, (1.0, 0.85, 0.62), 5)      # 舞台のスポットライト(左上から暖かく)
cam_light("rim", (0.8, 0.3, -0.55), 5.0, (0.62, 0.45, 1.0), 4)      # 右の後ろから紫のふち(傀儡師の光)
cam_light("fill", (0.4, -0.5, 0.8), 0.5, (1.0, 0.7, 0.45), 20)     # 下から脚光の照り返し
world = bpy.data.worlds.new("world"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.30, 0.22, 0.18, 1); bg.inputs["Strength"].default_value = 0.5   # 金属に映る周り(暖かい舞台)

sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = F*SS
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Khronos PBR Neutral"; sc.view_settings.look = "None"
try:
    sc.eevee.taa_render_samples = 8 if FAST else 32
    sc.eevee.use_shadows = True
    sc.eevee.use_raytracing = True
except AttributeError: pass

TMP = os.path.join(bpy.app.tempdir, "drone_frame.png")
def render_view(yaw, elev):
    y, e = math.radians(yaw), math.radians(elev)
    cam.location = tgt.location + gl(math.cos(e)*math.sin(y), math.sin(e), math.cos(e)*math.cos(y))*6
    sc.render.filepath = TMP
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(TMP, check_existing=False)
    a = np.empty(img.size[0]*img.size[1]*4, dtype=np.float32); img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    a = a.reshape(F*SS, F*SS, 4)[::-1].reshape(F, SS, F, SS, 4)
    al = a[..., 3:4]
    rgb = (a[..., :3]*al).mean(axis=(1, 3)); al = al.mean(axis=(1, 3))
    rgb = np.where(al > 1e-4, rgb/np.maximum(al, 1e-4), 0)
    return np.concatenate([rgb, al], axis=2)

def save(arr):
    h, w = arr.shape[:2]
    img = bpy.data.images.new("sheet", w, h, alpha=True)
    img.pixels.foreach_set(arr[::-1].astype(np.float32).ravel())
    img.filepath_raw = OUT; img.file_format = "PNG"; img.save()
    print("書き出し:", OUT, w, "x", h)

if VIEWS_ONLY:
    sheet = np.zeros((F, F*len(VIEWS), 4), dtype=np.float32)
    for i, v in enumerate(VIEWS): sheet[:, i*F:(i + 1)*F] = render_view(*v)
else:
    sheet = np.zeros((F*len(ELEVS), F*YAWS, 4), dtype=np.float32)
    for r, e in enumerate(ELEVS):
        for k in range(YAWS): sheet[r*F:(r + 1)*F, k*F:(k + 1)*F] = render_view(k*360/YAWS, e)
        print("段", r + 1, "/", len(ELEVS))
save(sheet)
