import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'frontend/public/models/landmarks/resident-lod.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
raw=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];extent=max(max(p[i] for p in raw)-min(p[i] for p in raw) for i in range(3));factor=2/extent
for o in meshes:o.scale*=factor;o.location*=factor
bpy.context.view_layer.update()
points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)));center=(lo+hi)/2;size=max(hi-lo)
bpy.ops.object.camera_add(location=center+Vector((size*1.2,-size*1.8,size*.7)));camera=bpy.context.object;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=size*1.5
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.world.color=(.5,.5,.5)
bpy.ops.object.light_add(type='AREA',location=center+Vector((size,-size,size*2)));bpy.context.object.data.energy=350; bpy.context.object.data.shape='DISK';bpy.context.object.data.size=size*2
scene.render.filepath=str(root/'evidence/m7/resident-render.png');bpy.ops.render.render(write_still=True)
