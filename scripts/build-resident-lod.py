"""Bake the repository's casual character into one small vertex-colour crowd mesh."""
import bpy, bmesh, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
data=json.loads((root/'evidence/m7/authoring/resident-baked.json').read_text(encoding='utf-8'))
mesh=bpy.data.meshes.new('Baked resident');mesh.from_pydata(data['vertices'],[],data['faces']);mesh.update()
obj=bpy.data.objects.new('Resident',mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
colors=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for poly,color in zip(mesh.polygons,data['colors']):
 for loop in poly.loop_indices:colors.data[loop].color=color
bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bm.to_mesh(mesh);bm.free();mesh.validate();mesh.update()
triangles=sum(len(p.vertices)-2 for p in obj.data.polygons)
mod=obj.modifiers.new('Crowd distance mesh','DECIMATE');mod.ratio=min(1,280/max(1,triangles));bpy.ops.object.modifier_apply(modifier=mod.name);obj.data.validate();obj.data.update()
mat=bpy.data.materials.new('Resident colours');mat.use_nodes=True
shader=mat.node_tree.nodes.get('Principled BSDF');node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Color';mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color']);shader.inputs['Roughness'].default_value=.85
obj.data.materials.append(mat)
for o in list(bpy.context.scene.objects):
 if o!=obj:bpy.data.objects.remove(o,do_unlink=True)
output=root/'frontend/public/models/landmarks/resident-lod.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_animations=False,export_yup=True,export_attributes=True)
report={'source':'models/chars/f_casual.glb','triangles':sum(len(p.vertices)-2 for p in obj.data.polygons)}
(root/'frontend/public/models/landmarks/resident-lod.json').write_bytes(json.dumps(report,indent=2).encode())
print(report)
