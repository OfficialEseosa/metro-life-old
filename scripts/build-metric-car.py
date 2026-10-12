"""Author a metre-sized sedan from Kenney CC0 parts; runtime uses uniform scale.

Preserve wheel/bumper sections, extend the body between its axles and lower the
roof section. This is mesh authoring, rather than a nonuniform scene transform.
"""
import bpy, json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'frontend/public/models/world/car/sedan.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:
    o.data.transform(o.matrix_world)
    o.matrix_world.identity()
points=[v.co for o in meshes for v in o.data.vertices]
lo=Vector([min(v[k] for v in points) for k in range(3)])
hi=Vector([max(v[k] for v in points) for k in range(3)])
factor=1.8/(hi.x-lo.x)
extra=(4.4-(hi.y-lo.y)*factor)/2
roof_drop=(hi.z-lo.z)*factor-1.45
for o in meshes:
    for v in o.data.vertices:
        v.co.x=(v.co.x-(lo.x+hi.x)/2)*factor
        y=(v.co.y-(lo.y+hi.y)/2)*factor
        # Keep the wheel shapes round. Only the centre body spans grow.
        v.co.y=y+extra*max(-1,min(1,y/.28))
        z=(v.co.z-lo.z)*factor
        v.co.z=z-roof_drop*max(0,min(1,(z-.84)/(.4)))
    o.data.update()
    o.name='metric-sedan'
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.join()
o=bpy.context.object
# Flat painted panels remain flat, wheel normals keep the stock kit styling.
out=root/'frontend/public/models/vehicles'
out.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out/'sedan.glb'),export_format='GLB',use_selection=True,export_yup=True)
size=[max(v.co[k] for v in o.data.vertices)-min(v.co[k] for v in o.data.vertices) for k in range(3)]
assert all(abs(a-b)<.002 for a,b in zip(size,[1.8,4.4,1.45])),size
(out/'LICENSE.txt').write_text('Kenney Car Kit, CC0 1.0 Universal\nhttps://kenney.nl/assets/car-kit\nhttps://creativecommons.org/publicdomain/zero/1.0/\nMetro Life sedan proportions authored from the supplied CC0 sedan.\n',encoding='utf-8')
print(json.dumps({'asset':'vehicles/sedan.glb','width_length_height':size,'source':'world/car/sedan.glb','licence':'CC0-1.0'}))
