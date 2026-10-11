"""Derive a distant neighbourhood row from our own Painted Ladies hero, never alter it."""
import bpy,os,json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'frontend/public/models/landmarks/paintedLadies.glb'))
for obj in list(bpy.context.scene.objects):
 if obj.type!='MESH':continue
 bpy.context.view_layer.objects.active=obj
 modifier=obj.modifiers.new('Distant streetscape','DECIMATE');modifier.ratio=.45;modifier.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=modifier.name)
triangles=sum(len(p.vertices)-2 for obj in bpy.context.scene.objects if obj.type=='MESH' for p in obj.data.polygons)
assert triangles<2200,triangles
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'frontend/public/models/landmarks/painted-row-lod.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
with open(os.path.join(ROOT,'evidence/hud-m4-audit/fabric-lod.json'),'w',newline='') as f:json.dump({'source':'paintedLadies.glb','triangles':triangles,'purpose':'Distant Victorian neighbourhood rows; hero remains unchanged'},f,indent=2)
print('FABRIC LOD',triangles)
