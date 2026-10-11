"""New York heroes authored from the photo sheets in docs/landmarks.md."""
import os,runpy,math
lib=runpy.run_path(os.path.join(os.path.dirname(__file__),'build-atlanta-heroes.py'),run_name='landmark_helpers')
globals().update({k:v for k,v in lib.items() if not k.startswith('__')})

def empire():
 b=Build();stone='#d9d4c3';glass='#4b6577';b.box(0,0,.1,14,11,.2,'#c9d0cd')
 tiers=[(0,3.3,12,8.8),(3.3,6,9.2,7),(6,9,7.6,5.7),(9,27,5.6,4.3),(27,30,4.5,3.6),(30,32,3.4,2.8),(32,33.8,2.6,2.2)]
 for low,high,w,d in tiers:
  h=high-low;b.box(0,0,(high+low)/2,w,d,h,stone)
  for y in [-d/2-.015,d/2+.015]:windows(b,0,y,low+.12,w-.35,h-.24,max(3,round(w/.56)),max(1,round(h/.68)),glass,False)
  for x in [-w/2-.015,w/2+.015]:side_windows(b,x,0,low+.12,d-.35,h-.24,max(3,round(d/.6)),max(1,round(h/.75)),glass)
  for x in [-w/2+i*.56 for i in range(round(w/.56)+1)]:b.box(x,-d/2-.045,(high+low)/2,.075,.08,h,'#e5e0d1')
  for y in [-d/2+i*.6 for i in range(round(d/.6)+1)]:b.box(w/2+.045,y,(high+low)/2,.08,.075,h,'#e5e0d1')
  b.box(0,0,high+.08,w+.12,d+.12,.14,'#eee9da')
 # Four limestone fins and the mooring mast's narrow octagonal drum.
 lathe(b,0,0,[(33.8,1.45),(34.5,1.4),(34.7,1.1),(36.7,.65),(37.4,.4),(37.8,.4)],'#b7c2ca',16)
 for a in [i*math.pi/4 for i in range(8)]:b.line((1.15*math.cos(a),1.15*math.sin(a),34.4),(.4*math.cos(a),.4*math.sin(a),37.4),.045,'#e4e7e6',4)
 lathe(b,0,0,[(37.8,.23),(39,.2),(39.1,.12),(40.8,.06),(41.2,0)],'#d6dce0',12)
 for z in [38.4,39.1,39.8]:b.ring(0,0,z,.3,.3,.05,'#a1adb5',12)
 # Recessed Art Deco Fifth Avenue portal, with a tall patterned frame.
 b.box(0,-4.43,1.5,2,.04,2.6,'#344d59')
 for x in [-1.25,-1.05,1.05,1.25]:b.box(x,-4.48,1.5,.12,.13,2.7,'#e7debf')
 for z in [2.8,3,3.15]:b.box(0,-4.49,z,2.6,.15,.1,'#e7debf')
 for x in [-.6,0,.6]:b.line((x,-4.52,.3),(x,-4.52,2.6),.035,'#b6b5a2',4)
 b.finish('empire-limestone-ribs')

def oneWtc():
 b=Build();r=4.3;t=3.8;z0=5.6;z1=32
 b.box(0,0,.08,13,13,.16,'#d1d9d7');b.box(0,0,z0/2,2*r,2*r,z0,'#8aaebd')
 B=[(-r,-r,z0),(r,-r,z0),(r,r,z0),(-r,r,z0)];T=[(0,-t,z1),(t,0,z1),(0,t,z1),(-t,0,z1)]
 for i in range(4):
  j=(i+1)%4;b.face([B[i],B[j],T[i]],['#76a8c7','#b4d0de','#6697b6','#a2c5d6'][i]);b.face([B[j],T[j],T[i]],['#91b8cb','#bfd7de','#80a8bc','#aac8d6'][i])
  for a,c in [(B[i],T[i]),(B[j],T[i]),(T[i],T[j])]:b.line(a,c,.045,'#dae7eb',4)
  for level in range(1,58):
   f=level/58;A=Vector(B[i]).lerp(Vector(T[i]),f);C=Vector(B[j]).lerp(Vector(T[i]),f);D=Vector(B[j]).lerp(Vector(T[j]),f)
   b.line(A,C,.018,'#c3d7e1',4);b.line(C,D,.018,'#c3d7e1',4)
  for col in range(1,12):
   f=col/12;b.line(Vector(B[i]).lerp(Vector(B[j]),f),T[i],.012,'#a1bfce',4)
 for axis in [-1,1]:
  for u in [-3.8+i*.4 for i in range(20)]:b.box(u,axis*4.34,z0/2,.045,.09,z0,'#d7e3e5')
 b.poly([(p[0],p[1]) for p in T],z1,'#9cb8c6')
 for z,rr in [(32.4,1.25),(33.2,1.1),(34,.85)]:b.ring(0,0,z,rr,rr,.12,'#bccad0',24)
 lathe(b,0,0,[(32,.35),(35,.28),(35.2,.2),(39,.16),(40.8,.07),(41,0)],'#dce4e7',12)
 for x,y in [(-1,-1),(-1,1),(1,-1),(1,1)]:b.line((x,y,32.5),(0,0,36.2),.025,'#bdced7',4)
 # Memorial context uses recessed black square pools with an inner dark opening.
 for y in [-4.2,4.2]:
  b.box(8.8,y,.15,5.5,5.5,.3,'#7a8d8d');b.box(8.8,y,.31,4.8,4.8,.02,'#294d5a');b.box(8.8,y,.33,1.5,1.5,.025,'#162b35')
 b.finish('one-wtc-eight-glass-facets')

def xz_prism(b,pts,y,depth,c):
 temp=Build();temp.poly(pts,0,c)
 for face,col in zip(temp.f,temp.c):
  vs=[temp.v[i] for i in face]
  for yy in [y-depth/2,y+depth/2]:b.face([(x,yy,z) for x,z,_ in vs],col)
 for a,d in zip(pts,pts[1:]+pts[:1]):b.face([(a[0],y-depth/2,a[1]),(d[0],y-depth/2,d[1]),(d[0],y+depth/2,d[1]),(a[0],y+depth/2,a[1])],c)

def brooklynBridge():
 b=Build();stone='#b9ad91';steel='#52616b';length=44;deck=5.2
 b.box(0,0,deck,8,length,.5,'#777c76');b.box(0,0,deck+.45,1.4,length,.3,'#c9bfa5')
 for x in [-3.9,-.85,.85,3.9]:b.line((x,-length/2,deck+.7),(x,length/2,deck+.7),.06,steel,5)
 for y in [-8,8]:
  b.box(0,y,2.4,8.2,3.7,4.8,stone)
  for x in [-3.45,0,3.45]:
   b.box(x,y,9.6,.95,2.6,9,stone)
   for z in [5.3+i*.6 for i in range(15)]:b.box(x,y,z,1.01,2.66,.045,'#d1c4a7')
  for x in [-1.73,1.73]:
   curve=[(x-1.24+1.24*(i/10)**1.7,10.7+2.5*i/10) for i in range(11)]
   curve += [(x+1.24-1.24*(i/10)**1.7,10.7+2.5*i/10) for i in range(9,-1,-1)]
   xz_prism(b,curve+[(x+1.24,14.3),(x-1.24,14.3)],y,2.6,stone)
  b.box(0,y,14.3,8.2,2.9,.35,'#d2c7ad');b.box(0,y,14.75,7.5,2.7,.5,stone)
  for x in [-3.3,0,3.3]:b.box(x,y,15.15,.9,2.9,.4,'#d4cbb6')
 # Four main cables: central catenary approximation and descending side spans.
 def cable(y):return 7+6.8*(y/8)**2 if abs(y)<=8 else 13.8-(abs(y)-8)/14*8
 for x in [-3.3,-2.85,2.85,3.3]:
  for i in range(88):
   y=-22+i*.5;b.line((x,y,cable(y)),(x,y+.5,cable(y+.5)),.045,steel,5)
   if i%2==0:b.line((x,y,deck+.25),(x,y,cable(y)),.018,'#7b8588',4)
  for tower in [-8,8]:
   for target in [tower+(j-5)*1.4 for j in range(11)]:b.line((x,tower,13.6),(x,target,deck+.3),.022,'#859092',4)
 for x in [-4,4]:
  b.line((x,-22,4.5),(x,22,4.5),.07,steel,4)
  for y in [-22+i for i in range(44)]:b.line((x,y,4.5),(x,y+1,5.4),.035,steel,4);b.line((x,y,5.4),(x,y+1,4.5),.035,steel,4)
 b.finish('brooklyn-gothic-stone-and-cables')

def ellipsoid(b,x,y,z,rx,ry,rz,c,n=20,m=12):
 for j in range(m):
  a=-math.pi/2+j*math.pi/m;aa=a+math.pi/m
  for i in range(n):
   q=i*2*math.pi/n;qq=q+2*math.pi/n;P=lambda t,u:(x+rx*math.cos(t)*math.cos(u),y+ry*math.cos(t)*math.sin(u),z+rz*math.sin(t))
   b.face([P(a,q),P(a,qq),P(aa,qq),P(aa,q)],c)

def arch_glass(b,x,y,z,w,h,c=GLASS):
 r=w/2;spring=h-r;pts=[(x-r,z),(x+r,z)]+[(x+r*math.cos(i*math.pi/20),z+spring+r*math.sin(i*math.pi/20)) for i in range(21)]
 # A recessed window needs a single surface, not invisible extrusion walls.
 temp=Build();temp.poly(pts,0,c)
 for face,col in zip(temp.f,temp.c):b.face([(u,y,v) for u,v,_ in [temp.v[i] for i in face]],col)

def clock_face(b,x,y,z,r):
 for i in range(48):
  a=i*math.pi/24;aa=(i+1)*math.pi/24;b.face([(x,y,z),(x+r*math.cos(a),y,z+r*math.sin(a)),(x+r*math.cos(aa),y,z+r*math.sin(aa))],'#f1e9ce')
  b.line((x+r*math.cos(a),y-.02,z+r*math.sin(a)),(x+r*math.cos(aa),y-.02,z+r*math.sin(aa)),.04,'#b19a62',4)
 for i in range(12):
  a=i*math.pi/6;b.line((x+r*.83*math.cos(a),y-.04,z+r*.83*math.sin(a)),(x+r*.95*math.cos(a),y-.04,z+r*.95*math.sin(a)),.018,'#485456',4)
 b.line((x,y-.06,z),(x-r*.1,y-.06,z+r*.65),.027,'#354449',4);b.line((x,y-.06,z),(x+r*.45,y-.06,z+.15*r),.027,'#354449',4)

def liberty():
 b=Build();green='#69a995';dark='#4e8b78';stone='#c6b292'
 island=[(8.3*math.cos(i*math.pi/24),6.8*math.sin(i*math.pi/24)) for i in range(48)];prism(b,island,.05,.3,'#91ad7b')
 star=[((6 if i%2==0 else 4.5)*math.cos(i*math.pi/11),(6 if i%2==0 else 4.5)*math.sin(i*math.pi/11)) for i in range(22)];prism(b,star,.35,1.25,'#a8a796');b.poly(star,1.64,'#bac1ae')
 for z,w,h in [(1.85,5.1,.5),(2.3,4.5,.4),(9.4,3.7,.4),(10.1,3.9,.3),(10.7,3.3,.8)]:b.box(0,0,z,w,w,h,stone)
 for i in range(4):
  a=i*math.pi/2;Q=lambda u,v,z:(u*math.cos(a)-v*math.sin(a),u*math.sin(a)+v*math.cos(a),z)
  b.face([Q(-2.15,-2.15,2.5),Q(2.15,-2.15,2.5),Q(1.65,-1.65,9.2),Q(-1.65,-1.65,9.2)],stone)
  for u in [-1.15,1.15]:
   b.face([Q(u-.16,-2.14,3),Q(u+.16,-2.14,3),Q(u+.16,-1.72,8.7),Q(u-.16,-1.72,8.7)],'#dfccb0')
  for x in [-1.2,0,1.2]:
   # Gallery openings are slightly proud of the balcony backing plane.
   pts=[Q(x-.22,-1.91,9.7),Q(x+.22,-1.91,9.7),Q(x+.22,-1.91,10.2),Q(x-.22,-1.91,10.2)];b.face(pts,'#6b766f')
  for u in [-1.7+i*.34 for i in range(11)]:b.line(Q(u,-1.98,10.2),Q(u,-1.98,10.65),.035,'#e1d3b9',4)
 # Asymmetric robe, continuous folded mesh through hips and shoulders.
 profile=[(11.1,1.35,.8),(11.8,1.3,.8),(13,1.05,.72),(14.2,.92,.63),(15.4,.72,.5),(16.3,.85,.55),(17.1,1.05,.5),(17.7,.65,.44),(18,.3,.3)]
 for j in range(len(profile)-1):
  z,rx,ry=profile[j];zz,rxx,ryy=profile[j+1]
  for i in range(32):
   a=i*math.pi/16;aa=(i+1)*math.pi/16;P=lambda q,z,xx,yy:(xx*math.cos(q)*(1+.07*math.sin(q*10+z)),yy*math.sin(q)*(1+.07*math.sin(q*10+z)),z)
   b.face([P(a,z,rx,ry),P(aa,z,rx,ry),P(aa,zz,rxx,ryy),P(a,zz,rxx,ryy)],dark if i%5==0 else green)
 for i in range(7):b.line((-.85+i*.25,-.63,12.2),(.65-i*.18,-.51,16.9),.027,'#8bc0aa',4)
 # Raised right arm and naturally bent left arm/tablet.
 for a,c,r in [((-.8,0,17.4),(-1.45,-.05,18.6),.38),((-1.45,-.05,18.6),(-1.7,-.08,20.7),.24),((.8,0,17.3),(1.15,-.5,16.4),.3),((1.15,-.5,16.4),(.95,-.83,17.1),.22)]:b.line(a,c,r,green,12)
 ellipsoid(b,-1.7,-.08,20.7,.27,.24,.35,green);ellipsoid(b,0,-.03,18.65,.52,.43,.7,green)
 ellipsoid(b,0,.35,18.6,.46,.35,.55,dark)
 # Face ridge, nose, eyebrows and restrained dark eyes.
 b.face([(-.1,-.45,18.8),(.1,-.45,18.8),(.08,-.62,18.55),(-.08,-.62,18.55)],'#83b6a1')
 for x in [-.2,.2]:b.line((x-.06,-.45,18.79),(x+.06,-.45,18.79),.021,dark,4)
 b.line((-.13,-.43,18.4),(.13,-.43,18.4),.018,dark,4)
 lathe(b,0,0,[(18.88,.55),(19.1,.58),(19.15,.55)],green,28)
 for i in range(7):
  a=(i+1)*math.pi/8;start=(.5*math.cos(a),-.12,18.97+.38*math.sin(a));tip=(1.15*math.cos(a),-.12,18.97+1.2*math.sin(a));b.line(start,tip,.055,green,5)
 # Tablet's slanted planes cradle in the left arm.
 prism(b,[(.65,-.92),(1.5,-.75),(1.4,-.55),(.55,-.73)],16.1,1.6,'#5d9686')
 lathe(b,-1.7,-.08,[(20.7,.1),(21.4,.1),(21.45,.38),(21.7,.42),(21.8,.34)],green,20)
 lathe(b,-1.7,-.08,[(21.8,.25),(22,.37),(22.25,.26),(22.5,.32),(22.8,0)],'#e9bd60',16)
 b.finish('liberty-verdigris-folded-figure')

def grandCentral():
 b=Build();stone='#d8cfb9';b.box(0,0,.1,21,15,.2,'#bfc9c5');b.box(0,0,2.8,18,11,5.4,stone)
 for x in [-5.7,0,5.7]:
  arch_glass(b,x,-5.55,1,3.4,4,'#465e63');arch(b,x,-5.62,1,3.6,4.15,.16,CREAM)
  for dx in [-1,-.5,0,.5,1]:b.line((x+dx,-5.66,1.1),(x+dx,-5.66,3.8),.025,'#b7b5a2',4)
  for z in [1.5,2,2.5,3,3.5,4,4.5]:
   half=1.65 if z<=3.3 else math.sqrt(max(0,1.65**2-(z-3.3)**2));b.line((x-half,-5.68,z),(x+half,-5.68,z),.025,'#b7b5a2',4)
 for x in [-8,-6.95,-3.6,-2.55,2.55,3.6,6.95,8]:column(b,x,-5.85,.7,4.6,.2,CREAM)
 for z,w,d,h in [(5.3,18.4,11.4,.3),(5.7,18.7,11.7,.25),(6.1,18.2,11.3,.35)]:b.box(0,0,z,w,d,h,CREAM)
 # Green hipped shell: long ridge and sloping end facets, no rectangular roof slab.
 for a,c in [([(-9,-5.5,6.3),(9,-5.5,6.3),(7,0,7.8),(-7,0,7.8)],'#678e7b'),([(-9,5.5,6.3),(-7,0,7.8),(7,0,7.8),(9,5.5,6.3)],'#5b8174'),([(-9,-5.5,6.3),(-7,0,7.8),(-9,5.5,6.3)],'#729987'),([(9,-5.5,6.3),(9,5.5,6.3),(7,0,7.8)],'#729987')]:b.face(a,c)
 for x in [-8+i*.65 for i in range(25)]:b.line((x,-5.5,6.35),(x*.8,0,7.85),.018,'#9ab19b',4)
 for x in [-9.03,9.03]:side_windows(b,x,0,1,9.5,4,7,2,'#667e7c')
 # Central clock and symbolic sculptural trio; no brand mark.
 clock_face(b,0,-5.92,7.03,.62)
 for x,z in [(-1.35,7.15),(0,8),(1.35,7.15)]:
  ellipsoid(b,x,-5.6,z,.28,.3,.65,CREAM,12,8);ellipsoid(b,x,-5.6,z+.75,.19,.2,.22,CREAM,12,8)
 b.line((-.3,-5.6,8.3),(-.9,-5.6,8.65),.1,CREAM,6);b.line((.3,-5.6,8.3),(.9,-5.6,8.65),.1,CREAM,6)
 b.box(0,-7,.35,20,1.7,.5,'#879996');b.box(0,-7,.64,20,1.7,.08,'#7c8586')
 b.finish('grand-central-stone-roof-and-clock')

def met():
 b=Build();stone='#e0d8c3';b.box(0,0,.1,29,20,.2,'#cbd2c4')
 # Long lower wings touch the central pavilion without coplanar side overlap.
 for x,w,d,h,y in [(0,12,8,6.5,-2),(-9.5,7,12,5.4,0),(9.5,7,12,5.4,0),(0,12,6,5.3,5)]:
  b.box(x,y,h/2,w,d,h,stone);b.box(x,y,h+.18,w+.2,d+.2,.32,CREAM)
  for xx in [x-w/2+.5+i*.8 for i in range(max(1,int(w/.8)-1))]:b.box(xx,y,h+.45,.3,.3,.28,stone)
  if x:
   for px in [x-2.2,x,x+2.2]:arch_glass(b,px,y-d/2-.04,.9,1.2,3.6,'#5b6d6a');arch(b,px,y-d/2-.09,.9,1.4,3.8,.1,CREAM)
  for yy in [y-d/2+.4+i*.8 for i in range(int(d/.8))]:b.box(x+w/2+.02,yy,h/2,.06,.16,h,'#c8c7b8')
 for x in [-4,0,4]:
  arch_glass(b,x,-6.04,1.5,2.8,4.3,'#43585b');arch(b,x,-6.1,1.5,3.1,4.5,.22,CREAM)
  b.box(x,-6.15,3.15,2.8,.15,.18,CREAM)
  for dx in [-.75,0,.75]:b.line((x+dx,-6.16,1.6),(x+dx,-6.16,4.2),.03,'#b7b6a2',4)
 for x in [-5.7,-4.95,-2.5,-1.75,1.75,2.5,4.95,5.7]:column(b,x,-6.5,1.25,4.65,.23,CREAM)
 b.box(0,-6.3,6.2,12.6,1.1,.42,CREAM);b.box(0,-6.3,6.65,12.9,1.2,.25,stone)
 for x in [-5.6,-2,2,5.6]:b.box(x,-6.3,7.05,.75,.8,.6,stone)
 for i in range(9):b.box(0,-9+i*.27,.18+i*.13,13,2.9-i*.27,.2,CREAM)
 # Broad roof skylights, courts and long glazed north gallery.
 for x in [-9.5,9.5]:
  b.box(x,0,5.8,4.8,7,.18,'#a5bec2')
  for yy in [-3+i*.5 for i in range(13)]:b.box(x,yy,5.92,4.8,.03,.04,'#dfe7df')
 for x in [-4,0,4]:b.box(x,5.2,5.65,2.5,4,.2,'#a7c0c5')
 for x in [-12,12]:tree(b,x,-8,1.4)
 b.finish('met-beaux-arts-pavilion-and-wings')

if __name__=='__main__':export_models([('empire',empire),('oneWtc',oneWtc),('brooklynBridge',brooklynBridge),('liberty',liberty),('grandCentral',grandCentral),('met',met)],'nyc-heroes-report.json')
