"""CC0 baseline street section in metres; V6 joins sections by street graph."""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts=[]
def box(name,x,y,z,w,d,h,color):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z));o=bpy.context.object;o.name=name;o.scale=(w,d,h)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    a=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for v in a.data:v.color=(*color,1)
    parts.append(o)
box('asphalt',0,0,-.04,6.4,6.4,.08,(.14,.17,.19))
for side in [-1,1]:
    box('sidewalk',side*4.2,0,.07,2,6.4,.16,(.58,.59,.56))
    box('curb',side*3.27,0,.075,.14,6.4,.15,(.72,.72,.65))
    box('white-edge',side*3.04,0,.003,.07,6.4,.006,(.9,.9,.78))
    box('yellow-centre',side*.075,0,.003,.045,3.0,.006,(.96,.66,.17))
    for y in [-1.6,1.6]:box('concrete-joint',side*4.2,y,.153,2,.018,.005,(.45,.47,.44))
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name='metre-street-section'
m=bpy.data.materials.new('street-colours');m.use_nodes=True
nodes=m.node_tree.nodes;c=nodes.new('ShaderNodeVertexColor');c.layer_name='Color';bsdf=nodes.get('Principled BSDF');m.node_tree.links.new(c.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.95;o.data.materials.append(m)
out=root/'frontend/public/models/streets';out.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out/'road_straight.glb'),export_format='GLB',use_selection=True,export_yup=True)
(out/'LICENSE.txt').write_text('Metro Life authored metre street section, CC0 1.0 Universal\nhttps://creativecommons.org/publicdomain/zero/1.0/\n',encoding='utf-8')
print('Metre street: two 3.2m lanes, two 2m sidewalks, 0.15m curb.')
