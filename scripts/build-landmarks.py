"""Blender background authoring. Run blender --background --python scripts/build-landmarks.py.
All coordinates are metres-like artistic scene units: X east, Y north, Z up.
References/proportions are in docs/landmarks.md. No downloaded art enters these GLBs.
"""
import bpy, math, os, json, random, sys
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OSM=json.load(open(os.path.join(ROOT,'frontend/src/scene/atl-osm.json')))
OUT=os.path.join(ROOT,'frontend/public/models/landmarks')
EVID=os.path.join(ROOT,'evidence/art-rebuild/blender')
os.makedirs(OUT,exist_ok=True);os.makedirs(EVID,exist_ok=True)
def rgb(h):
 h=h.lstrip('#');s=[int(h[i:i+2],16)/255 for i in (0,2,4)]
 return tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in s)+(1,)
def smooth(pts,steps=5,closed=False):
 result=[];n=len(pts)
 for i in range(n if closed else n-1):
  p0=Vector(pts[(i-1)%n] if closed else pts[max(0,i-1)]);p1=Vector(pts[i]);p2=Vector(pts[(i+1)%n]);p3=Vector(pts[(i+2)%n] if closed else pts[min(n-1,i+2)])
  for j in range(steps):
   t=j/steps;v=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);result.append(tuple(v))
 if not closed:result.append(pts[-1])
 return result
class Build:
 def __init__(self):self.v=[];self.f=[];self.c=[]
 def face(self,vs,c):
  n=len(self.v);self.v.extend(vs);self.f.append(tuple(range(n,n+len(vs))));self.c.append(rgb(c) if isinstance(c,str) else c)
 def poly(self,pts,z,c):
  if sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(pts,pts[1:]+pts[:1]))<0:pts=list(reversed(pts))
  vs=[Vector((x,y,z)) for x,y in pts]
  for t in tessellate_polygon([vs]):self.face([tuple(vs[v] if isinstance(v,int) else v) for v in t],c)
 def box(self,x,y,z,w,d,h,c):
  v=[(x+a*w/2,y+b*d/2,z+t*h/2) for t in (-1,1) for b in (-1,1) for a in (-1,1)]
  for f in [(0,2,3,1),(4,5,7,6),(0,1,5,4),(1,3,7,5),(3,2,6,7),(2,0,4,6)]:self.face([v[i] for i in f],c)
 def line(self,a,b,r,c,n=5):
  a,b=Vector(a),Vector(b);d=(b-a).normalized();u=d.cross(Vector((0,0,1)))
  if u.length<.01:u=d.cross(Vector((0,1,0)))
  u.normalize();v=d.cross(u);ring=lambda p:[tuple(p+r*(math.cos(i*2*math.pi/n)*u+math.sin(i*2*math.pi/n)*v)) for i in range(n)]
  A,B=ring(a),ring(b)
  for i in range(n):j=(i+1)%n;self.face([A[i],A[j],B[j],B[i]],c)
 def ring(self,x,y,z,rx,ry,width,c,n=64):
  for i in range(n):
   a=i*2*math.pi/n;b=(i+1)*2*math.pi/n
   self.face([(x+math.cos(a)*rx,y+math.sin(a)*ry,z),(x+math.cos(b)*rx,y+math.sin(b)*ry,z),(x+math.cos(b)*(rx-width),y+math.sin(b)*(ry-width),z),(x+math.cos(a)*(rx-width),y+math.sin(a)*(ry-width),z)],c)
 def path(self,pts,w,c,z=.08):
  for a,b in zip(pts,pts[1:]):
   dx,dy=b[0]-a[0],b[1]-a[1];l=math.hypot(dx,dy);nx,ny=-dy/l*w/2,dx/l*w/2
   self.face([(a[0]+nx,a[1]+ny,z),(a[0]-nx,a[1]-ny,z),(b[0]-nx,b[1]-ny,z),(b[0]+nx,b[1]+ny,z)],c)
 def finish(self,name,emission=False):
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(self.v,[],self.f);mesh.update()
  attr=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
  for p,c in zip(mesh.polygons,self.c):
   for j in p.loop_indices:attr.data[j].color=c
  obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
  mat=bpy.data.materials.new(name);mat.use_nodes=True;nodes=mat.node_tree.nodes;bs=nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.7
  vc=nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
  if emission:mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.7
  obj.data.materials.append(mat);return obj
def clear():bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def kit_template(relative):
 clear();bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'frontend/public/models',relative))
 obj=next(o for o in bpy.context.scene.objects if o.type=='MESH');obj.data.calc_loop_triangles();v=[obj.matrix_world@p.co for p in obj.data.vertices];minz=min(p.z for p in v);h=max(p.z for p in v)-minz
 # Kit colour atlas sampled at each face UV, baked to vertex colours for one park draw call.
 mat=obj.data.materials[0];img=next((n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image),None);pixels=list(img.pixels) if img else [];uv=obj.data.uv_layers.active
 parts=[]
 for tri in obj.data.loop_triangles:
  coords=[((v[i].x)/h,(v[i].y)/h,(v[i].z-minz)/h) for i in tri.vertices]
  color=rgb('#398c4b')
  if img and uv:
   u=sum(uv.data[i].uv.x for i in tri.loops)/3;vv=sum(uv.data[i].uv.y for i in tri.loops)/3;px=min(img.size[0]-1,max(0,int(u*img.size[0])));py=min(img.size[1]-1,max(0,int(vv*img.size[1])));index=(py*img.size[0]+px)*4;color=tuple(pixels[index:index+4])
  parts.append((coords,color))
 clear();return parts
TREE=kit_template('world/suburban/tree-large.glb')
TOWERS=[kit_template('world/commercial/building-skyscraper-'+c+'.glb') for c in ['a','b','c']]
def tree(b,x,y,h=2.5,angle=0,tint=1):
 for coords,c in TREE:
  color=rgb('#41914b') if sum(z for a,bb,z in coords)/3>.36 else rgb('#8a7151')
  b.face([(x+h*2.3*(a*math.cos(angle)-bb*math.sin(angle)),y+h*2.3*(a*math.sin(angle)+bb*math.cos(angle)),z*h+.04) for a,bb,z in coords],tuple(min(1,k*tint) for k in color[:3])+(1,))
def stadium():
 b=Build();halo=Build();b.box(0,0,.04,28,25,.08,'#d8dde1')
 # Elliptical seating bowl and pitch remain visible down through the oculus.
 b.box(0,0,.18,8,12,.12,'#49a84c')
 for y in range(-5,6):b.box(0,y,.25,7.4,.045,.015,'#f4f5ea')
 for r,z in [(6.4,.4),(7.1,.85),(7.8,1.35),(8.5,1.9),(9.1,2.5)]:b.ring(0,0,z,r,r*.9,.55,'#9c3445',64)
 P=lambda a,r,z:(math.cos(a)*r*1.12,math.sin(a)*r,z)
 # Sawtooth perimeter: every wing has its own sloping ridge and triangular facade fold.
 for i in range(8):
  a=i*math.pi/4+.15;aa=a+math.pi/4
  A=P(a,11.8,4.3);B=P(aa,12.1,5.6);C=P(a+.51,8.2,7.1);D=P(a+.22,9.4,4.2)
  U=P(a,7.65,6.55);V=P(aa,7.65,6.55)
  b.face([A,B,C],'#c7d0d6');b.face([A,C,U],'#dce5ec');b.face([B,V,C],'#b9cbd7');b.face([U,C,V],'#dce5ec')
  L=P(a,10.2,.4);R=P(aa,10.7,.4);fold=P(a+.4,11.9,2.1)
  if i not in (3,4):
   b.face([L,R,fold],'#a7bac7');b.face([L,fold,A],'#e3e9ee');b.face([fold,R,B],'#718795');b.face([A,fold,B],'#536779')
  b.line(L,A,.045,'#f0f2f5');b.line(A,B,.055,'#e4e9ed');b.line(A,fold,.045,'#e6ecf2')
  # Tall broad west glazed facets with tightly spaced mullions.
  if i in (3,4):
   b.face([L,R,B,A],'#76b4d1')
   for t in [j/12 for j in range(13)]:
    bottom=Vector(L).lerp(Vector(R),t);top=Vector(A).lerp(Vector(B),t);b.line(bottom,top,.018,'#e0e5ec',4)
   for t in [.2,.4,.6,.8]:b.line(Vector(L).lerp(Vector(A),t),Vector(R).lerp(Vector(B),t),.022,'#c7dae3',4)
   b.line(L,B,.065,'#f1f2ef');b.line(R,A,.065,'#eff2ef')
  # Swept triangular moving petal, white ribbed pillow surface; a clear open aperture.
  E=P(a+.22,7.7,6.55);F=P(aa+.22,7.7,6.55);G=P(a+.82,3.95,5.9);H=P(a+.57,4.3,5.9)
  # Raised ETFE pillows rather than an entirely flat fan.
  for u in range(8):
   for v in range(5):
    def pillow(s,t):
     p=Vector(E).lerp(Vector(F),s).lerp(Vector(H).lerp(Vector(G),s),t);p.z+=.16*math.sin(math.pi*s*8)*math.sin(math.pi*t);return tuple(p)
    b.face([pillow(u/8,v/5),pillow((u+1)/8,v/5),pillow((u+1)/8,(v+1)/5),pillow(u/8,(v+1)/5)],'#f4f7f6' if u%2 else '#e6eff4')
  b.face([E,H,D],'#dbe3ea')
  b.line(E,G,.055,'#fdfefb');b.line(F,G,.055,'#bbcbd5')
  for t in [j/9 for j in range(1,9)]:
   p=Vector(E).lerp(Vector(F),t);q=Vector(H).lerp(Vector(G),t);b.line(p,q,.025,'#cedce3',4)
  # Dark ring screen just under the aperture, clearly visible on the inner face.
  for j in range(8):
   u=a+j*math.pi/32;v=a+(j+1)*math.pi/32
   halo.face([P(u,4.7,4.6),P(v,4.7,4.6),P(v,4.7,5.25),P(u,4.7,5.25)],'#59c0e5' if j%3 else '#f09172')
 b.finish('benz-shell');halo.finish('benz-halo',True)
def centennial():
 b=Build();water=Build();r=random.Random(47)
 # Actual OSM park outline, normalised locally to retain its nonrectangular boundary.
 shapes=[f['points'] for f in OSM['footprints'] if f['name']=='Centennial Olympic Park' and len(f['points'])>20]
 points=max(shapes,key=lambda p:abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p))))) if shapes else []
 if points:
  xs=[p[0] for p in points];ys=[p[1] for p in points];w=max(xs)-min(xs);d=max(ys)-min(ys)
  b.poly([((x-(max(xs)+min(xs))/2)*14/w,-(y-(max(ys)+min(ys))/2)*25/d+1.5) for x,y in points],.02,'#70ba65')
 else:b.poly([(-7,-11),(7,-11),(7,12),(5,14),(-6,14),(-7,10)],.02,'#70ba65')
 b.box(0,-6,.05,13,9,.08,'#bb735d')
 # Square brick paving bands; long lawn crossed by paths.
 for x in [-6,-3,0,3,6]:b.path([(x,-10),(x,-2)],.12,'#e7d5c2',.105)
 for y in [-10,-7.5,-5,-2.5]:b.path([(-6.5,y),(6.5,y)],.12,'#e7d5c2',.105)
 for x in [-6,6]:b.path([(x,-11),(x,13)],.65,'#cc8e71',.08)
 for y in [0,6,12]:b.path([(-7,y),(7,y)],.65,'#cc8e71',.08)
 b.path([(-6,0),(6,12)],.5,'#d09b7b');b.path([(6,0),(-6,12)],.5,'#d09b7b')
 b.box(0,-6,.11,8.6,4.2,.04,'#d2b3a1')
 for x,y in [(-2.4,-5.4),(0,-5.4),(2.4,-5.4),(-1.2,-6.7),(1.2,-6.7)]:
  b.ring(x,y,.143,1.3,1.3,.075,'#f3e8d4',40)
  for j in range(20):
   a=j*math.pi/10;px=x+1.3*math.cos(a);py=y+1.3*math.sin(a)
   water.line((px,py,.15),(px,py,.45+.45*(.5+.5*math.sin(j*1.3))),.025,'#b8efff',4)
 for x in [-5.8,5.8]:
  for y in [-9.5,-6.5,-3.5,.5]:
   b.line((x,y,0),(x,y,3.8),.045,'#d8d9cf',6);b.ring(x,y,3.5,.28,.28,.06,'#f5edda',12)
  for y in [2,4,6,8,10,12]:tree(b,x+r.uniform(-.3,.3),y,1.8+r.random()*.7,tint=.9+r.random()*.2)
 for x in [-4,-2,0,2,4]:
  b.line((x,-10.6,0),(x,-10.6,2.4),.025,'#eee9dc');b.face([(x,-10.6,2.4),(x+.6,-10.6,2.25),(x+.6,-10.6,1.9),(x,-10.6,2.05)],['#d96161','#6588c1','#e3bd55'][int(x)%3])
 # SkyView south of street, wheel upright across the skyline, enclosed gondolas.
 b.box(0,-12.5,.05,17,1.3,.1,'#748b9c');cx,cy,cz=5,-15.5,3.8;radius=3.3
 for depth in [-.14,.14]:
  pts=[(cx+radius*math.cos(i*math.pi/24),cy+depth,cz+radius*math.sin(i*math.pi/24)) for i in range(49)]
  for a,c in zip(pts,pts[1:]):b.line(a,c,.035,'#f4f6f5',4)
 for i in range(24):
  a=i*math.pi/12;x=cx+radius*math.cos(a);z=cz+radius*math.sin(a);b.line((cx,cy,cz),(x,cy,z),.018,'#eaf3f2',4);b.box(x,cy,z-.14,.28,.3,.32,'#bbdeea')
 for x in [cx-1.5,cx+1.5]:b.line((x,cy,0),(cx,cy,cz),.09,'#f3f3ef',6)
 # GWCC west, Coca-Cola museum northeast, no marks/logos. Actual canonical neighbours in scene.
 for y in [-3,2,7]:b.box(-11,y,1.2,5,4,2.4,'#b7c9d0');b.box(-11,y,2.5,5.3,4.2,.2,'#e4e9e7')
 b.box(4,16,1.25,6,4,2.5,'#c3d9b6');b.box(4,16,2.55,6.3,4.3,.15,'#d7e4e1');b.box(3,13.9,1.4,3,.08,2.4,'#78b8c9')
 b.finish('centennial-landscape');water.finish('centennial-jets',True)
def piedmont():
 b=Build();water=Build();r=random.Random(83)
 boundary=[(-13,-17),(9,-17),(14,-11),(13,6),(10,17),(-4,19),(-13,13)]
 b.poly(boundary,.02,'#6db964')
 lake=smooth([(1,-12),(-2,-11),(-4,-8),(-3,-5),(-1,-3),(-1,0),(0,3),(2,6),(4,5),(4,2),(5,0),(6,-1),(8,-2),(8,-5),(6,-7),(7,-9),(5,-11)],5,True)
 b.poly(lake,.07,'#d5c8a4');cx=sum(x for x,y in lake)/len(lake);cy=sum(y for x,y in lake)/len(lake)
 water.poly([(cx+(x-cx)*.96,cy+(y-cy)*.97) for x,y in lake],.18,'#4aadc4')
 b.poly([(2,-5.5),(3.2,-5),(3.9,-3.9),(3.4,-3),(2.2,-3.2),(1.8,-4.2)],.22,'#628f53');tree(b,2.8,-4.1,1.5)
 shore=[(x*1.13,y*1.1) for x,y in lake];b.path(shore+[shore[0]],.35,'#e6d3af',.095)
 b.path(smooth([(-12,-15),(-8,-10),(-6,-4),(-7,2),(-10,6),(-10,13),(-3,16),(5,15),(10,10),(11,3),(10,-7),(7,-14)]),.48,'#dfc9a5')
 b.path(smooth([(-8,-10),(-5,-9),(-4,-8)]),.4,'#dfc9a5')
 b.path(smooth([(-7,2),(-4,5),(0,8),(5,12)]),.4,'#dfc9a5')
 # Active Oval: running circuit, two baseball diamonds and open sports field.
 b.ring(-7,6,.1,4.1,6.3,.4,'#c9b49a',64)
 for y in [2.7,9.1]:
  b.poly([(-7,y-1.6),(-5.4,y),(-7,y+1.6),(-8.6,y)],.11,'#d0ae7b')
  b.path([(-7,y-1.4),(-5.6,y),(-7,y+1.4),(-8.4,y),(-7,y-1.4)],.04,'#f5ecd7',.12)
 # Stone bridge on lake southwest neck, railings and pavilion.
 b.box(-2.4,-8,.7,3.4,.65,.12,'#c9bfa9')
 for y in [-8.33,-7.67]:
  for j in range(12):
   a=j*math.pi/12;c=(j+1)*math.pi/12
   b.face([(-2.4+1.6*math.cos(a),y,.15+.45*math.sin(a)),(-2.4+1.6*math.cos(c),y,.15+.45*math.sin(c)),(-2.4+1.6*math.cos(c),y,.67),(-2.4+1.6*math.cos(a),y,.67)],'#c9c0a7')
  b.line((-4.1,y,1),(-.7,y,1),.045,'#eee6d5')
  for x in [-4+i*.3 for i in range(12)]:b.line((x,y,.75),(x,y,1),.025,'#eee5d6',4)
 for i in range(8):
  a=i*math.pi/4;c=(i+1)*math.pi/4;x=-4.7+.8*math.cos(a);y=-8+.8*math.sin(a)
  b.line((x,y,.2),(x,y,1.6),.055,'#f7f3e5',6);b.face([(x,y,1.65),(-4.7+.8*math.cos(c),-8+.8*math.sin(c),1.65),(-4.7,-8,2.2)],'#526e6b')
 # Open meadow stays empty. Canopy follows boundary and lake banks, never fills the lawn.
 for i in range(220):
  x=r.uniform(-12.8,12.8);y=r.uniform(-16,17)
  edge=abs(x)>10 or y<-13 or y>15;shorewood=(x>7 and y<7) or (-5<x<-3 and y<-3) or (x<0 and y<-10)
  if edge or shorewood:tree(b,x,y,1.8+r.random()*1.4,r.random()*6.28,.83+r.random()*.28)
 # Real kit towers immediately west. Baked to the same colour/material batch for the hero render.
 for i,(x,y,height) in enumerate([(-15,-10,11),(-15,0,16),(-15,11,13)]):
  for coords,color in TOWERS[i]:b.face([(x+a*6.5,y+bb*6.5,z*height) for a,bb,z in coords],color)
 # No kit crown matches these Atlanta silhouettes: author the small open crowns locally.
 for x,y,z,c in [(-15,0,16,'#d5b47a'),(-15,11,13,'#79a89a')]:
  b.box(x,y,z+.15,3.2,3.2,.3,c)
  for dx,dy in [(-1.5,-1.5),(1.5,-1.5),(1.5,1.5),(-1.5,1.5)]:
   b.line((x+dx,y+dy,z+.3),(x,y,z+3),.065,c,5)
   b.line((x+dx,y+dy,z+.3),(x-dx*.5,y-dy*.5,z+2.4),.04,c,4)
  b.line((x,y,z+3),(x,y,z+3.5),.05,c,5)
 b.finish('piedmont-landscape');water.finish('piedmont-lake')
def render(id,eye,target,filename):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.6,.72,.85,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5;scene.view_settings.view_transform='Standard'
 bpy.ops.object.light_add(type='AREA',location=(-20,-25,40));bpy.context.object.data.energy=18000;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=25
 bpy.ops.object.camera_add(location=eye);cam=bpy.context.object;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=58 if id=='piedmont' else 38
 if filename.endswith('lake-side.png'):cam.data.ortho_scale=26
 if filename.endswith('street.png') or filename.endswith('lake-side.png'):cam.data.type='PERSP';cam.data.lens=32
 scene.camera=cam
 scene.render.filepath=os.path.join(EVID,filename);bpy.ops.render.render(write_still=True)
 for obj in list(scene.objects):
  if obj.type in ('CAMERA','LIGHT'):bpy.data.objects.remove(obj,do_unlink=True)
def export_models(specs,report_name='report.json'):
 report_file=os.path.join(EVID,report_name);report=json.load(open(report_file)) if os.path.exists(report_file) else {}
 if '--only' in sys.argv:specs=[(id,fn) for id,fn in specs if id in sys.argv[sys.argv.index('--only')+1].split(',')]
 for id,fn in specs:
  clear();fn();objs=[o for o in bpy.context.scene.objects if o.type=='MESH'];tri=sum(len(p.vertices)-2 for o in objs for p in o.data.polygons);assert tri<12000,(id,tri)
  bpy.ops.object.select_all(action='DESELECT')
  for o in objs:o.select_set(True)
  bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,id+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
  # Render the exported file, not authoring objects, to catch coordinate/material mistakes.
  clear();bpy.ops.import_scene.gltf(filepath=os.path.join(OUT,id+'.glb'))
  render(id,(-24,-30,30) if id=='benz' else (25,-34,36) if id=='centennial' else (29,-27,24),(0,0,2),id+'-aerial.png')
  if id=='benz':render(id,(-35,-19,7),(0,0,3),id+'-street.png')
  elif id=='piedmont':render(id,(9,-11,3),(-6,-5,4),id+'-lake-side.png')
  else:render(id,(8,-30,8),(0,0,3),id+'-street.png')
  report[id]={'triangles':tri,'materialBatches':len(objs),'glbBytes':os.path.getsize(os.path.join(OUT,id+'.glb'))}
 open(os.path.join(EVID,report_name),'w').write(json.dumps(report,indent=2));print('LANDMARK_REPORT',json.dumps(report))
if __name__=='__main__':export_models([('benz',stadium),('centennial',centennial),('piedmont',piedmont)])
