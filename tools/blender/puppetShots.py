# 傀儡師戦の敵の弾(scripts/drone/puppetStage.js が使う)を Blender で描く
#   使い方(画面なしで動かす):
#     "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup --python tools/blender/puppetShots.py -- [出力.png]
#   出力(いつもは images/game/puppeteer/shots.png)：1コマ SIZE px を横に並べる
#     0 normal(赤)：漆を塗った木の玉(操り人形の関節の玉)。深い赤に、上塗りのつやと左上の強い光
#     1 small(オレンジ)：真ちゅうの小さな鈴(切れ目と、つまみの輪)
#   どれも玉の半径が コマの RADIUS の割合 になるように描く(ゲームでは弾の半径に合わせて縮めて貼る)。
#   光は舞台に合わせる(左上から暖かいスポットライト・右後ろから紫のふち)。
import bpy, sys, os, math
from mathutils import Vector

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ARGV = [a for a in ARGS if not a.startswith("--")]
OUT = os.path.abspath(ARGV[0] if ARGV else "images/game/puppeteer/shots.png")
SIZE = 64           # 1コマの大きさ(px)
RADIUS = 0.4        # 玉の半径(コマの幅に対する割合)。puppetStage.js の STAGE_SHOT_FILL と同じ
KINDS = ["normal", "small"]

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    return m, nt, b

def noise_bump(nt, b, scale, strength):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    z = nt.nodes.new("ShaderNodeTexNoise"); z.inputs["Scale"].default_value = scale
    nt.links.new(tc.outputs["Object"], z.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength
    nt.links.new(z.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return z

# 漆の赤：深い赤の下地に、厚い上塗り(つや)。木目がうっすら透ける
lacq, nt, b = material("lacquer")
b.inputs["Base Color"].default_value = (0.42, 0.015, 0.02, 1); b.inputs["Roughness"].default_value = 0.35
b.inputs["Coat Weight"].default_value = 1.0; b.inputs["Coat Roughness"].default_value = 0.04
b.inputs["Subsurface Weight"].default_value = 0.2; b.inputs["Subsurface Radius"].default_value = (0.3, 0.05, 0.05)
noise_bump(nt, b, 30, 0.05)
# 玉の穴のふち(真ちゅうの小さな座金)
brass, nt, b = material("brass")
b.inputs["Base Color"].default_value = (0.95, 0.58, 0.18, 1); b.inputs["Metallic"].default_value = 1.0; b.inputs["Roughness"].default_value = 0.28
noise_bump(nt, b, 50, 0.1)
dark, nt, b = material("dark")
b.inputs["Base Color"].default_value = (0.02, 0.012, 0.01, 1); b.inputs["Roughness"].default_value = 0.8

COLS = {}
def coll(name):
    c = bpy.data.collections.new(name); sc.collection.children.link(c); COLS[name] = c; return c

def put(o, c, m):
    for cc in list(o.users_collection): cc.objects.unlink(o)
    c.objects.link(o); o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o

# 0 漆の玉：少しつぶれた球に、糸を通す穴(上下)と座金
c = coll("normal")
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0, 0, 0))
o = put(bpy.context.object, c, lacq); o.scale = (1, 1, 0.92)
for s in (-1, 1):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.07, location=(0, 0, s*0.9))
    put(bpy.context.object, c, brass)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.15, depth=0.05, location=(0, 0, s*0.93))
    put(bpy.context.object, c, dark)

# 1 真ちゅうの鈴：球に横の切れ目(両はしが丸い穴)、上につまみの輪
c = coll("small")
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0, 0, 0))
bell = put(bpy.context.object, c, brass)
for s in (-1, 1):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.17, depth=1.0, location=(s*0.62, -0.7, -0.25), rotation=(math.pi/2, 0, 0))
    h = bpy.context.object; h.hide_render = True
    bo = bell.modifiers.new("hole", "BOOLEAN"); bo.object = h; bo.operation = "DIFFERENCE"; bo.solver = "FLOAT"
# 切れ目：穴と穴を結ぶ暗い溝(球を少し刻む帯)
bpy.ops.mesh.primitive_torus_add(major_radius=0.975, minor_radius=0.055, location=(0, 0, -0.25))
put(bpy.context.object, c, dark).scale = (1, 1, 1)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.9, location=(0, 0, 0))        # 中の暗がり(切れ目の奥)
put(bpy.context.object, c, dark)
bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.08, location=(0, 0, 1.08), rotation=(math.pi/2, 0, 0))
put(bpy.context.object, c, brass)

# ------------------------------------------------------------------ 光とカメラ
def sun(name, d, energy, color, size):
    L = bpy.data.lights.new(name, "SUN"); L.energy = energy; L.color = color; L.angle = math.radians(size)
    o = bpy.data.objects.new(name, L); sc.collection.objects.link(o)
    o.rotation_euler = (-Vector(d).normalized()).to_track_quat("-Z", "Y").to_euler()
sun("key", (-0.6, -0.6, 0.7), 4.5, (1.0, 0.88, 0.7), 8)      # 左上の手前から(つやの光が左上に)
sun("rim", (0.8, 0.6, -0.2), 4.0, (0.7, 0.5, 1.0), 6)        # 右後ろから紫のふち
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes["Background"]; bg.inputs["Color"].default_value = (0.45, 0.33, 0.25, 1); bg.inputs["Strength"].default_value = 0.6

cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = 1/RADIUS
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, -10, 0); cam.rotation_euler = (math.pi/2, 0, 0)

sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Khronos PBR Neutral"; sc.view_settings.look = "None"
try:
    sc.eevee.taa_render_samples = 64; sc.eevee.use_raytracing = True
except AttributeError: pass

import numpy as np
TMP = os.path.join(bpy.app.tempdir, "shot.png")
sheet = np.zeros((SIZE, SIZE*len(KINDS), 4), dtype=np.float32)
for i, k in enumerate(KINDS):
    for name, cc in COLS.items(): cc.hide_render = name != k
    sc.render.filepath = TMP; bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(TMP, check_existing=False)
    a = np.empty(SIZE*SIZE*4, dtype=np.float32); im.pixels.foreach_get(a); bpy.data.images.remove(im)
    sheet[:, i*SIZE:(i + 1)*SIZE] = a.reshape(SIZE, SIZE, 4)[::-1]
img = bpy.data.images.new("sheet", SIZE*len(KINDS), SIZE, alpha=True)
img.pixels.foreach_set(sheet[::-1].ravel()); img.filepath_raw = OUT; img.file_format = "PNG"; img.save()
print("書き出し:", OUT)
