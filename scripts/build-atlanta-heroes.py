"""Remaining Atlanta heroes. Reference photographs and prior modelling sheets in docs/landmarks.md."""
import os,runpy,math
lib=runpy.run_path(os.path.join(os.path.dirname(__file__),'build-landmarks.py'),run_name='landmark_library')
globals().update({k:v for k,v in lib.items() if not k.startswith('__')})
CREAM='#e6dfcc';WHITE='#f6f5ed';GLASS='#6b9cae';BRICK='#b87759';SLATE='#6a777d'
def prism(b,pts,z,h,c):
 b.poly(pts,z+h,c)
 for a,d in zip(pts,pts[1:]+pts[:1]):b.face([(a[0],a[1],z),(d[0],d[1],z),(d[0],d[1],z+h),(a[0],a[1],z+h)],c)
def lathe(b,x,y,profile,c,n=24,pattern=False):
 for j in range(len(profile)-1):
  z,r=profile[j];zz,rr=profile[j+1]
  for i in range(n):
   a=i*2*math.pi/n;d=(i+1)*2*math.pi/n
   color=c if not pattern or (i+j)%3 else '#9b7859'
   b.face([(x+r*math.cos(a),y+r*math.sin(a),z),(x+r*math.cos(d),y+r*math.sin(d),z),(x+rr*math.cos(d),y+rr*math.sin(d),zz),(x+rr*math.cos(a),y+rr*math.sin(a),zz)],color)
def column(b,x,y,z,h,r=.16,c=CREAM):
 lathe(b,x,y,[(z,r*1.5),(z+.12,r*1.5),(z+.18,r),(z+h-.2,r*.85),(z+h-.15,r*1.4),(z+h,r*1.4)],c,8)
def arch(b,x,y,z,w,h,d=.15,c=CREAM):
 spring=h-w*.5;r=w*.5;t=w*.11
 for xx in [x-r+t/2,x+r-t/2]:b.box(xx,y,z+spring/2,t,d,spring,c)
 for i in range(12):
  a=i*math.pi/12;aa=(i+1)*math.pi/12
  for yy in [y-d/2,y+d/2]:b.face([(x+r*math.cos(a),yy,z+spring+r*math.sin(a)),(x+r*math.cos(aa),yy,z+spring+r*math.sin(aa)),(x+(r-t)*math.cos(aa),yy,z+spring+(r-t)*math.sin(aa)),(x+(r-t)*math.cos(a),yy,z+spring+(r-t)*math.sin(a))],c)
def windows(b,x,y,z,w,h,n,rows,c=GLASS,mullions=True):
 for j in range(rows):
  for i in range(n):
   px=x-w/2+(i+.5)*w/n;zz=z+(j+.5)*h/rows;ww=w/n*.68;hh=h/rows*.65
   b.face([(px-ww/2,y,zz-hh/2),(px+ww/2,y,zz-hh/2),(px+ww/2,y,zz+hh/2),(px-ww/2,y,zz+hh/2)],c)
   if mullions:
    b.face([(px-.015,y-.02,zz-hh/2),(px+.015,y-.02,zz-hh/2),(px+.015,y-.02,zz+hh/2),(px-.015,y-.02,zz+hh/2)],'#cbd0c9')
    b.face([(px-ww/2,y-.02,zz-.015),(px+ww/2,y-.02,zz-.015),(px+ww/2,y-.02,zz+.015),(px-ww/2,y-.02,zz+.015)],'#cbd0c9')
def text(b,body,x,y,z,size,c,vertical=False):
 for i,word in enumerate(body if vertical else [body]):
  bpy.ops.object.text_add(location=(x,y,z-i*size*1.1 if vertical else z));o=bpy.context.object;o.data.body=word;o.data.size=size;o.data.align_x='CENTER';o.data.resolution_u=2;o.rotation_euler=(math.pi/2,0,0);o.data.extrude=.005
  bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.data.calc_loop_triangles();v=[o.matrix_world@p.co for p in o.data.vertices]
  for tri in o.data.loop_triangles:b.face([tuple(v[j]) for j in tri.vertices],c)
  bpy.data.objects.remove(o,do_unlink=True)

def side_windows(b,x,y,z,w,h,n,rows,c=GLASS):
 # Reuse the detailed facade in a rotated local frame for east/west walls.
 temp=Build();windows(temp,0,0,z,w,h,n,rows,c,True)
 for face,col in zip(temp.f,temp.c):
  b.face([(x-p[1],y+p[0],p[2]) for p in [temp.v[i] for i in face]],col)
def pediment(b,x,y,z,w,h,d,c=CREAM):
 for yy in [y-d/2,y+d/2]:b.face([(x-w/2,yy,z),(x+w/2,yy,z),(x,yy,z+h)],c)
 b.face([(x-w/2,y-d/2,z),(x,y-d/2,z+h),(x,y+d/2,z+h),(x-w/2,y+d/2,z)],'#c8c4b8')
 b.face([(x+w/2,y-d/2,z),(x+w/2,y+d/2,z),(x,y+d/2,z+h),(x,y-d/2,z+h)],'#d9d6ca')
def capitol():
 b=Build();b.box(0,0,.1,22,18,.2,'#ccd8bd')
 outline=[(-4,-5),(4,-5),(4,-4.5),(8.5,-4.5),(8.5,4.5),(4,4.5),(4,5),(-4,5),(-4,4.5),(-8.5,4.5),(-8.5,-4.5),(-4,-4.5)]
 prism(b,outline,0,5.4,CREAM);b.poly(outline,5.45,SLATE)
 # Four hipped slate wings rise toward the dome, with projecting corner pavilions.
 for x in [-6.3,6.3]:
  b.face([(x-2.2,-4.5,5.48),(x+2.2,-4.5,5.48),(x+1.4,0,6.35),(x-1.4,0,6.35)],SLATE)
  b.face([(x-2.2,4.5,5.48),(x-1.4,0,6.35),(x+1.4,0,6.35),(x+2.2,4.5,5.48)],SLATE)
  for xx in [x-2.2,x+2.2]:
   b.face([(xx,-4.5,5.48),(xx,4.5,5.48),(x+(1.4 if xx>x else -1.4),0,6.35)],SLATE)
 for x in [-8.53,8.53]:side_windows(b,x,0,1,8,4,7,3,'#577580')
 for y in [-4.55,4.55]:
  windows(b,0,y,1,16,4,15,3,'#577580',False)
  for z in [.65,2.05,3.35,5.1,5.45]:b.box(0,y,z,17.2,.18,.14,WHITE)
  for x in [-8,-4.5,4.5,8]:b.box(x,y,3.2,.25,.25,4.1,WHITE)
 # Raised frontal colonnade and triangular pediment, not a box portico.
 for x in [-3.1,-1.85,-.62,.62,1.85,3.1]:column(b,x,-6.7,1.3,4,.18)
 b.box(0,-6.1,5.5,7.5,2,.35,WHITE);pediment(b,0,-6.1,5.7,7.7,1.25,2)
 for i in range(7):b.box(0,-7.7+i*.21,.15+i*.16,8.2,.5+2-i*.2,.23,CREAM)
 for x in [-2,0,2]:b.box(x,-5.02,1.5,1.1,.04,2,'#486776');arch(b,x,-5.06,.6,1.3,2)
 # Tall drum, alternating columns/window recesses, ribbed gilded dome.
 lathe(b,0,0,[(5.5,2.35),(5.9,2.5),(6.1,2.15),(8.7,2.15),(8.9,2.45),(9.1,2.3)],CREAM,32)
 for i in range(16):
  a=i*math.pi/8;x=2.22*math.cos(a);y=2.22*math.sin(a);column(b,x,y,6.2,2.3,.12,WHITE)
 lathe(b,0,0,[(9.1,2.3),(9.6,2.27),(10.2,2.05),(10.8,1.65),(11.3,1.08),(11.65,.45),(11.75,.3)],'#dcb04c',32)
 for i in range(16):
  a=i*math.pi/8;pts=[(r*math.cos(a),r*math.sin(a),z+.015) for z,r in [(9.1,2.3),(9.6,2.27),(10.2,2.05),(10.8,1.65),(11.3,1.08),(11.65,.45)]]
  for p,q in zip(pts,pts[1:]):b.line(p,q,.025,'#f3d27a',4)
 lathe(b,0,0,[(11.7,.32),(12,.32),(12.3,.15),(12.5,.08)],'#d6b55f',12);b.line((0,0,12.4),(0,0,13.2),.09,'#d9bc7a');b.line((0,0,12.9),(.3,0,13.45),.035,'#e5ce94')
 b.finish('capitol-stone-gold')
def fox():
 b=Build();b.box(0,2.75,2.4,12,11.5,4.8,'#b99b7b');b.box(0,-4.5,3,12,3,6,'#d7b98e')
 for z in [.5,1.5,2.5,3.5,4.5,5.5]:b.box(0,-6.03,z,12.1,.07,.12,'#f1dfbd')
 for x in [-4,-1.5,1,3.5]:
  b.box(x,-6.09,2.2,1.7,.05,3,'#385f65');arch(b,x,-6.15,.75,2.1,3.5,.16,'#eed9ad')
  for z in [4.7,5.2]:b.box(x,-6.1,z,1.2,.05,.2,'#ece1ca')
 for x in [-5.4,5.4]:
  lathe(b,x,-5.3,[(0,.5),(6,.5),(6.2,.7),(6.4,.65),(7,.4),(7.6,.1)],'#d8c4a1',12)
  for z in [1,2,3,4,5,6]:lathe(b,x,-5.3,[(z,.52),(z+.12,.52)],'#f4e6cb',12)
 # Onion dome with contrasting turquoise and warm geometric facets.
 lathe(b,2,-3.7,[(5.7,1.7),(6.2,1.7),(6.6,1.9),(7.2,1.8),(7.9,1.3),(8.5,.5),(8.8,.1)],'#78ac9e',32,True)
 for x in [-3.7,5.2]:lathe(b,x,-3.7,[(5.8,.65),(6.2,.78),(6.6,.65),(7.1,.12)],'#7da99d',16)
 for x in [-5.7+i*.55 for i in range(22)]:b.box(x,-6,6.2,.24,.38,.32,'#eddbb8')
 # Red shaped sign with cream border, pale lettering, canopy and bulbs.
 b.box(-3.5,-6.8,5.1,1.35,.3,5.8,'#eee0bd');b.box(-3.5,-7,5.1,1.1,.15,5.5,'#b82b37');text(b,'FOX',-3.5,-7.1,6.55,1.05,'#fff1d2',True)
 b.box(-1,-7,2,6.5,2,.35,'#c2ac7f');b.box(-1,-8,2,6.7,.15,.65,'#ab3d3e');text(b,'FOX THEATRE',-1,-8.09,1.9,.42,WHITE)
 for x in [-4.1+i*.35 for i in range(19)]:b.box(x,-8.1,2.35,.07,.07,.07,'#fff0c3')
 b.finish('fox-moorish-palace')
def ponce():
 b=Build();b.box(0,0,.06,23,17,.12,'#d4cdbd')
 for x,y,w,d,h in [(0,4,21,4,8),(-8,-2,5,8,8),(8,-2,5,8,8)]:
  b.box(x,y,h/2,w,d,h,BRICK);b.box(x,y,h+.15,w+.2,d+.2,.3,CREAM)
  for yy in [y-d/2-.03,y+d/2+.03]:
   windows(b,x,yy,.6,w-.5,h-.9,max(3,int(w/1.4)),6,'#567e89',True)
   for z in [1.6,3.7,5.9,7.8]:b.box(x,yy,z,w,.08,.09,'#d9b697')
  for xx in [x-w/2+.3,x+w/2-.3]:b.box(xx,y,h/2,.23,d+.1,h,'#c98b69')
  for xx in [x-w/2-.04,x+w/2+.04]:side_windows(b,xx,y,.6,d-.4,h-.9,max(3,int(d/1.4)),6,'#567e89')
 b.box(-7.6,-5.1,5.2,3.5,3.5,10.4,BRICK);b.box(-7.6,-5.1,9.7,3.8,3.8,1.1,CREAM);pediment(b,-7.6,-5.1,10.4,4,1.2,4,SLATE)
 windows(b,-7.6,-6.88,1.2,3,7.5,2,6,'#4d7480',True)
 b.box(-6.6,-7,5.3,.75,.16,5,'#a94e3d');text(b,'PONCE',-6.6,-7.11,7.1,.65,WHITE,True)
 text(b,'PONCE CITY MARKET',0,1.8,8.6,.72,'#bf4d3e')
 for x in [-8,8]:arch(b,x,-6.1,.2,2.7,2.6,.2,CREAM)
 b.box(0,2,.18,10,5,.2,'#8eb768');b.path([(-5,-6),(-3,-3),(3,-3),(5,0)],.7,'#d8c4a1',.22)
 # Rooftop play deck and a restrained amusement slide/silo silhouette.
 b.box(5,3.8,8.3,6,3,.12,'#6ca575');b.path([(3,3),(4,4),(6,3),(7,4)],.3,'#dfbc74',8.4)
 lathe(b,7,4,[(8.2,.5),(9.3,.5),(9.6,0)],'#a9b3af',12)
 for i in range(3):tree(b,-2+i*2,-2,1.5)
 b.finish('ponce-brick-industrial-court')
def high():
 b=Build();b.box(0,0,.06,22,18,.12,'#e6e5dc')
 # Meier L and quarter-circle cut-out. White panel seams and curved atrium glass.
 b.box(-4,-2,3,7,7,6,WHITE);b.box(1.5,1.5,3,4,7,6,WHITE)
 cx,cy=-.5,-2
 for i in range(24):
  a=-math.pi/2+i*math.pi/48;aa=-math.pi/2+(i+1)*math.pi/48;r=4.2
  for z,h,c in [(0,1.1,WHITE),(1.1,3.8,'#a7c2cd'),(4.9,1.1,WHITE)]:b.face([(cx+r*math.cos(a),cy+r*math.sin(a),z),(cx+r*math.cos(aa),cy+r*math.sin(aa),z),(cx+r*math.cos(aa),cy+r*math.sin(aa),z+h),(cx+r*math.cos(a),cy+r*math.sin(a),z+h)],c)
  b.line((cx+r*math.cos(a),cy+r*math.sin(a),1),(cx+r*math.cos(a),cy+r*math.sin(a),5),.035,WHITE,4)
  b.face([(cx,cy,6),(cx+r*math.cos(a),cy+r*math.sin(a),6),(cx+r*math.cos(aa),cy+r*math.sin(aa),6)],WHITE)
 for z in [1.1,2.4,3.7,4.9]:
  for i in range(24):
   a=-math.pi/2+i*math.pi/48;aa=-math.pi/2+(i+1)*math.pi/48;b.line((cx+4.23*math.cos(a),cy+4.23*math.sin(a),z),(cx+4.23*math.cos(aa),cy+4.23*math.sin(aa),z),.025,WHITE,4)
 # Piano gallery wings, north-facing roof scoops and glass link.
 for x,y,w,d in [(6,4,6,7),(-4,6,8,3)]:
  b.box(x,y,2,w,d,4,WHITE)
  for xx in [x-w/2+i*.45 for i in range(int(w/.45)+1)]:b.box(xx,y-d/2-.025,2,.04,.05,4,'#d2dddd')
  for xx in [x-w/2+.35+i*.6 for i in range(int(w/.6))]:
   for yy in [y-d/2+.35+i*.6 for i in range(int(d/.6))]:
    b.face([(xx-.2,yy-.2,4),(xx+.2,yy-.2,4),(xx+.2,yy+.2,4.35),(xx-.2,yy+.2,4.35)],WHITE);b.box(xx,yy+.21,4.17,.4,.025,.3,'#bbced4')
 b.box(2,4,1.6,2,2,3.2,'#97b5c5')
 # Broad descending ramp and square panel grid, original small abstract sculpture.
 b.face([(-2,-8,.2),(0,-8,.2),(0,-3,1.4),(-2,-3,1.4)],'#e9e9df')
 for z in [.8,2,3.2,4.4,5.6]:b.box(-4,-5.52,z,7,.035,.025,'#d4dcd9')
 for x in [-7,-5.8,-4.6,-3.4,-2.2,-1]:b.box(x,-5.52,3,.025,.035,6,'#d4dcd9')
 b.line((6,-4,0),(5,-4,2),.12,'#34434a');b.line((5,-4,2),(7,-4,3),.16,'#475762');b.line((5,-4,2),(4,-4,2.6),.14,'#34434a')
 b.finish('high-meier-piano-campus')
def aquarium():
 b=Build();b.box(0,1,1.9,20,12,3.8,'#d7e0de');b.box(0,1,3.9,20.5,12.2,.25,WHITE)
 # Broad sloped exhibit roof and blue sail, not a dome.
 b.face([(-10,-4,4),(10,-4,4),(10,7,5),(-10,7,5)],'#ebeff0')
 b.face([(-10,-4,0),(-10,-4,4),(-3,-5.2,5.7),(2,-5.4,4.6),(9,-4,3.2),(9,-4,0)],'#176ba4')
 b.face([(-10,-4,4),(-3,-5.2,5.7),(7,5,5.2),(10,7,5),(2,-5.4,4.6)],'#3688b6')
 # Curved forward arrival pavilion with glazing and a thin white sweeping canopy.
 for i in range(36):
  a=math.pi+i*math.pi/36;aa=math.pi+(i+1)*math.pi/36;P=lambda t,z,r=7:(-1+r*math.cos(t),-3+3.2*math.sin(t),z)
  b.face([P(a,.3),P(aa,.3),P(aa,2.7),P(a,2.7)],'#3786ad');b.face([P(a,2.7),P(aa,2.7),P(aa,2.95),P(a,2.95)],WHITE)
  b.face([(-1,-3,3),P(a,2.95),P(aa,2.95)],WHITE)
  if i%3==0:b.line(P(a,.3),P(a,2.7),.04,'#d8e6ea',4)
 for x in [-6,-3,0,3,6]:b.box(x,3,5.1,2,3,.07,'#90c4d7');b.box(x,3,5.14,.025,3,.04,WHITE)
 b.box(0,-7.5,.08,21,4,.16,'#dbd7c5');b.path(smooth([(-10,-9),(-5,-8),(1,-9),(8,-8)]),.5,'#a3bf83',.19)
 for x in [-8,-4,4,8]:tree(b,x,-8,1.4)
 text(b,'GEORGIA AQUARIUM',-1,-6.3,2.1,.5,WHITE)
 b.finish('aquarium-blue-sails')
export_models([('capitol',capitol),('fox',fox),('ponce',ponce),('high',high),('aquarium',aquarium)],'atl-heroes-report.json')
