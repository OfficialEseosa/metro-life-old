"""Self-built rounded crowd figure; keep it readable at city-map scale."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
parts=[]
def paint(obj,color):
 bpy.context.view_layer.objects.active=obj;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 attr=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
 for p in obj.data.polygons:
  for i in p.loop_indices:attr.data[i].color=color
  p.use_smooth=True
 parts.append(obj);return obj
skin=(.62,.34,.17,1);shirt=(.83,.95,.88,1);pants=(.045,.09,.14,1);shoe=(.82,.74,.58,1);hair=(.04,.023,.015,1)
def sphere(name,loc,scale,color,segments=8,rings=4):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;return paint(o,color)
def limb(name,a,b,radius,color):
 a,b=Vector(a),Vector(b);bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=radius,depth=(b-a).length,location=(a+b)/2);o=bpy.context.object;o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return paint(o,color)
head=sphere('Head',(0,0,1.52),(.21,.19,.24),skin)
for p in head.data.polygons:
 if sum(head.data.vertices[v].co.z for v in p.vertices)/len(p.vertices)>.11:
  for i in p.loop_indices:head.data.color_attributes['Color'].data[i].color=hair
sphere('Shirt',(0,0,1.03),(.23,.16,.36),shirt)
for side in [-1,1]:
 limb('Leg',(.11*side,0,.77),(.12*side,.01,.14),.085,pants)
 limb('Arm',(.2*side,0,1.24),(.29*side,-.015,.84),.065,shirt)
 sphere('Hand',(.29*side,-.015,.8),(.075,.07,.09),skin,4,3)
 sphere('Shoe',(.12*side,-.055,.09),(.11,.17,.09),shoe,4,3)
 # Two dark eye discs face the camera rather than fragile separate facial slivers.
 vertices=[(.075*side,-.18,1.54)]+[(.075*side+math.cos(i*math.tau/6)*.025,-.181,1.54+math.sin(i*math.tau/6)*.032) for i in range(6)]
 mesh=bpy.data.meshes.new('Eye');mesh.from_pydata(vertices,[],[(0,i+1,(i+1)%6+1) for i in range(6)]);obj=bpy.data.objects.new('Eye',mesh);bpy.context.collection.objects.link(obj);paint(obj,(.01,.012,.015,1))
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:obj.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();obj=bpy.context.object
mat=bpy.data.materials.new('Crowd palette');mat.use_nodes=True;shader=mat.node_tree.nodes.get('Principled BSDF');node=mat.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Color';mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color']);shader.inputs['Roughness'].default_value=.85;obj.data.materials.append(mat)
triangles=sum(len(p.vertices)-2 for p in obj.data.polygons);assert triangles<400,triangles
bpy.ops.export_scene.gltf(filepath=str(root/'frontend/public/models/landmarks/resident-lod.glb'),export_format='GLB',export_animations=False,export_yup=True)
report={'source':'self-built rounded figure','triangles':triangles};(root/'frontend/public/models/landmarks/resident-lod.json').write_bytes(json.dumps(report,indent=2).encode('utf-8'));print(report)
