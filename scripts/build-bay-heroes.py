"""Bay Area heroes. Authoring sheets and aerial/street photo evidence precede this file."""
import os,runpy,math,json
lib=runpy.run_path(os.path.join(os.path.dirname(__file__),'build-new-york-heroes.py'),run_name='landmark_helpers')
globals().update({k:v for k,v in lib.items() if not k.startswith('__')})

def goldenGate():
 b=Build();orange='#bd4f39';light='#d46749';deck=5.4;length=58
 b.box(0,0,deck,5.6,length,.35,'#6e7b7e')
 for x in [-2.85,2.85]:b.line((x,-29,deck+.5),(x,29,deck+.5),.06,orange,5);b.line((x,-29,deck-.85),(x,29,deck-.85),.08,orange,5)
 for y in [-14,14]:
  b.box(0,y,1.8,7.6,4.2,3.6,'#b4bab0')
  for x in [-2.2,2.2]:
   # Tapered, fluted Art Deco legs with inset vertical ribs.
   xz_prism(b,[(x-.65,3.6),(x+.65,3.6),(x+.4,22),(x-.4,22)],y,1.7,orange)
   for dx in [-.3,0,.3]:b.line((x+dx,y-.88,4),(x+dx*.6,y-.88,22),.035,light,4)
  for z,w,h in [(7.4,5.3,.9),(13.5,5,.8),(18.5,4.8,.8),(22,5.5,.5)]:b.box(0,y,z,w,1.8,h,orange)
  for x in [-2.25,2.25]:b.box(x,y,22.45,1.1,1.95,.4,light)
  for z in [8.4,14.4,19.4]:
   for x in [-1.9,1.9]:b.face([(x,y-1,z-.6),(x,y-1,z),(x+(.4 if x<0 else -.4),y-1,z-.6)],light)
 def cable(y):return 8+13.8*(y/14)**2 if abs(y)<=14 else 21.8-(abs(y)-14)/15*15.8
 for x in [-2.8,2.8]:
  for i in range(116):
   y=-29+i*.5;b.line((x,y,cable(y)),(x,y+.5,cable(y+.5)),.075,orange,6)
   if i%2==0:b.line((x,y,deck+.2),(x,y,cable(y)),.025,light,4)
  for y in [-29+i for i in range(58)]:b.line((x,y,deck-.8),(x,y+1,deck+.15),.035,orange,4);b.line((x,y,deck+.15),(x,y+1,deck-.8),.035,orange,4)
 # Low-poly Marin rock/headland, where no city kit piece fits.
 for y in [-31,31]:
  ring=[(-7,y-4),(-3,y-6),(4,y-5),(8,y),(4,y+5),(-5,y+4)]
  for a,c in zip(ring,ring[1:]+ring[:1]):b.face([(a[0],a[1],0),(c[0],c[1],0),(0,y,3.6)],'#8c9f73')
 b.finish('golden-gate-art-deco-orange-steel')

def rotated_clock(b,x,y,z,r,angle):
 temp=Build();clock_face(temp,0,0,z,r)
 for face,c in zip(temp.f,temp.c):b.face([(x+u*math.cos(angle)-v*math.sin(angle),y+u*math.sin(angle)+v*math.cos(angle),zz) for u,v,zz in [temp.v[i] for i in face]],c)

def ferryBuilding():
 b=Build();stone='#d7d9cf';b.box(0,0,.12,27,11,.24,'#c1cbc5');b.box(0,0,1.9,24,5,3.6,stone)
 for y in [-2.54,2.54]:
  for x in [-11.2+i*1.4 for i in range(17)]:
   arch_glass(b,x,y,.4,1,1.4,'#516c72');arch(b,x,y-.025,.4,1.15,1.55,.12,CREAM)
   arch_glass(b,x,y,2.2,1,1.15,'#718b8c');arch(b,x,y-.025,2.2,1.15,1.3,.12,CREAM)
  b.box(0,y,1.95,24.2,.15,.18,CREAM)
 for x in [-12.03,12.03]:side_windows(b,x,0,.7,4,2.6,3,2,'#617a7d')
 for y in [-2.5,2.5]:b.face([(-12,y,3.7),(12,y,3.7),(12,0,4.6),(-12,0,4.6)],'#7f9290')
 b.box(0,0,4.65,24.3,.15,.16,CREAM)
 # Clock campanile: narrow stepped shaft, four clocks and genuinely open belfry.
 for z,w,h in [(4.3,3.2,.45),(6.2,2.7,3.4),(8.2,3.1,.4),(9.5,2.65,2.2),(10.7,3,.3)]:b.box(0,0,z,w,w,h,stone)
 for x in [-1.17,1.17]:
  for y in [-1.17,1.17]:column(b,x,y,10.85,1.7,.16,CREAM)
 b.box(0,0,12.6,3,3,.3,CREAM)
 for a in [i*math.pi/2 for i in range(4)]:rotated_clock(b,1.34*math.sin(a),-1.34*math.cos(a),9.55,.78,a)
 for x in [-1.2,1.2]:b.box(x,-1.39,6.2,.12,.1,2.6,'#b7bfb8')
 for y in [-1.5,1.5]:b.face([(-1.5,y,12.75),(1.5,y,12.75),(0,0,14.1)],'#7e8d88')
 for x in [-1.5,1.5]:b.face([(x,-1.5,12.75),(0,0,14.1),(x,1.5,12.75)],'#8e9d91')
 b.line((0,0,14.1),(0,0,15),.035,'#909e98',5)
 for x in [-8,0,8]:b.box(x,5,.35,2,6,.18,'#a8b9b5');b.box(x,7.5,.7,1.7,2,1,'#d8dfd6')
 b.finish('ferry-building-arcade-campanile')

def salesforce():
 b=Build();n=32
 # Rounded rectangular floor plan (superellipse), shrinking smoothly into a rounded crown.
 profile=[(0,3.35),(4,3.35),(12,3.22),(22,2.95),(28,2.67),(31,2.35),(32.5,1.95),(33.4,1.15),(33.8,.1)]
 def radius(z):
  for (a,r),(aa,rr) in zip(profile,profile[1:]):
   if a<=z<=aa:return r+(rr-r)*(z-a)/(aa-a)
  return .1
 def P(a,z,offset=0):
  r=radius(z)+offset;c,s=math.cos(a),math.sin(a);return(r*math.copysign(abs(c)**.62,c),r*.88*math.copysign(abs(s)**.62,s),z)
 for j in range(49):
  z=j*33.8/49;zz=(j+1)*33.8/49
  for i in range(n):
   a=i*math.pi/16;aa=(i+1)*math.pi/16;b.face([P(a,z),P(aa,z),P(aa,zz),P(a,zz)],'#80adc4' if i%4 else '#a2c1cd');b.face([P(a,zz-.055,.025),P(aa,zz-.055,.025),P(aa,zz,.025),P(a,zz,.025)],'#d5e1e3')
 for i in range(n):
  a=i*math.pi/16
  for (z,r),(zz,rr) in zip(profile,profile[1:]):b.line(P(a,z,.025),P(a,zz,.025),.025,'#c2d6de',4)
 b.box(0,0,.15,8,7,.3,'#c4d0ca')
 for x in [-2.7,2.7]:b.box(x,-3.02,1.6,.2,.2,3.2,'#dae4df')
 # Transit Center rooftop park beside tower, with local kit tree shapes baked to one batch.
 b.box(7,0,1.8,5,15,3.6,'#c8d4cf');b.box(7,0,3.67,4.8,14.8,.12,'#83b879');b.path(smooth([(6,-7),(8,-3),(6,1),(8,5),(7,7)]),.6,'#e4d8ba',3.76)
 # Trees are translated upward from the common template.
 temp=Build()
 for y in [-5,-2,1,4]:tree(temp,7,y,1.3)
 for face,c in zip(temp.f,temp.c):b.face([(x,y,z+3.75) for x,y,z in [temp.v[i] for i in face]],c)
 b.finish('salesforce-rounded-glass-sunshades')

def alcatraz():
 b=Build();data=json.load(open(os.path.join(ROOT,'frontend/src/scene/city-osm.json')));raw=max([f['points'] for f in data['cities']['bay']['footprints'] if f['tags'].get('natural')=='coastline'],key=len)
 # Principal-axis alignment keeps the real shoreline proportions; the authored buildings follow its ridge.
 cx=sum(x for x,y in raw)/len(raw);cy=sum(y for x,y in raw)/len(raw);pts=[(x-cx,-(y-cy)) for x,y in raw]
 xx=sum(x*x for x,y in pts);yy=sum(y*y for x,y in pts);xy=sum(x*y for x,y in pts);a=.5*math.atan2(2*xy,xx-yy)
 pts=[(x*math.cos(a)+y*math.sin(a),-x*math.sin(a)+y*math.cos(a)) for x,y in pts];scale=23/(max(x for x,y in pts)-min(x for x,y in pts));pts=[(x*scale,y*scale) for x,y in pts]
 b.poly([(x*.92,y*.92) for x,y in pts],2.6,'#a1b08c')
 for i,(p,q) in enumerate(zip(pts,pts[1:]+pts[:1])):b.face([(p[0],p[1],.05),(q[0],q[1],.05),(q[0]*.92,q[1]*.92,2.6),(p[0]*.92,p[1]*.92,2.6)],['#a9a799','#8c938a','#c1bba9'][i%3])
 b.box(0,0,4.3,12.5,4.2,3.4,'#d0c9af');b.box(0,0,6.1,12.7,4.4,.2,'#e4e4d9')
 for y in [-2.13,2.13]:
  windows(b,0,y,2.9,12,2.8,18,3,'#6a7f7c',False)
  for x in [-6+i*.7 for i in range(18)]:b.box(x,y,4.3,.1,.1,3.1,'#e1d7bb')
 for y in [-1.5,-.5,.5,1.5]:b.box(0,y,6.28,11.8,.25,.25,'#e9e9dd')
 for x in [-6.29,6.29]:side_windows(b,x,0,3,3.8,2.7,5,3,'#6a7f7c')
 # Lighthouse southwest, open rust water-tower frame northeast.
 lathe(b,-6,-3,[(2.6,.65),(3.2,.65),(3.3,.42),(8.8,.32),(9,.5),(9.2,.5),(9.7,.38),(10,0)],'#e7e6d6',8)
 lathe(b,-6,-3,[(9.2,.37),(9.55,.37)],'#779c9c',8)
 for x,y in [(5.2,2),(6.8,2),(5.2,3.6),(6.8,3.6)]:b.line((x,y,2.7),(6+(x-6)*.7,2.8+(y-2.8)*.7,7.5),.07,'#a38a6b',5)
 for z in [3.2,4.6,6]:
  for x in [5.2,6.8]:b.line((x,2,z),(x,3.6,z+1.3),.035,'#9c8c72',4);b.line((x,3.6,z),(x,2,z+1.3),.035,'#9c8c72',4)
 lathe(b,6,2.8,[(7.2,.95),(8.7,.95),(9,.2)],'#c8b49a',20)
 # Yard, dock barracks and winding ascent make the island a composition, not one prison slab.
 b.box(-1,4,2.7,7.5,2.2,.15,'#b9b6a1')
 for x in [-4.8,2.8]:b.box(x,4,3,.12,2.4,.6,'#b9b4a1')
 b.box(-1,-4.1,1.9,8,2.4,2.6,'#daddcd');b.box(-1,-4.1,3.3,8.2,2.6,.2,'#e6e9df')
 windows(b,-1,-5.33,.8,7.5,2.3,10,3,'#7d9690',False)
 for y in [-5.3,-2.9]:b.face([(-5,y,3.4),(3,y,3.4),(3,-4.1,4.1),(-5,-4.1,4.1)],'#e4e7dc')
 b.box(3.4,-6,.35,6,1.1,.3,'#b3bcb1');b.box(6,-7,.35,1.1,3,.3,'#b3bcb1')
 b.path(smooth([(-8,-1),(-6,2),(-2,3),(3,3),(7,1),(7,-2)]),.4,'#ded6bd',2.68)
 b.face([(5,-5,.5),(5.7,-5,.5),(6.7,-2,2.7),(6,-2,2.7)],'#cecbb6')
 temp=Build()
 for x,y in [(-8,1),(-5,3),(-4,-3),(7,0),(8,1)]:tree(temp,x,y,1.3)
 for face,c in zip(temp.f,temp.c):b.face([(x,y,z+2.6) for x,y,z in [temp.v[i] for i in face]],c)
 b.finish('alcatraz-osm-cliffs-cellhouse-and-towers')

def paintedLadies():
 b=Build();colors=['#e0d7ba','#bbced1','#d4bfc4','#c9cdb4','#cbbcd4','#d7c9ab'];trim='#f2ebda'
 # Sloping Steiner street and Alamo Square foreground.
 b.face([(-10,-6,0),(10,-6,1.1),(10,3,1.1),(-10,3,0)],'#94b77a');b.face([(-10,-4,.1),(10,-4,1.2),(10,-2.9,1.2),(-10,-2.9,.1)],'#8e9994')
 for i,c in enumerate(colors):
  x=-7.25+i*2.9;z=i*.16;w=2.45;d=4.2;h=4.6
  b.box(x,0,z+h/2+.35,w,d,h,c)
  for yy in [-2.1,2.1]:b.face([(x-w/2,yy,z+4.95),(x+w/2,yy,z+4.95),(x-.25,yy,z+6.15)],c)
  b.face([(x-w/2,-2.3,z+4.95),(x-.25,-2.3,z+6.15),(x-.25,2.3,z+6.15),(x-w/2,2.3,z+4.95)],'#687775')
  b.face([(x+w/2,-2.3,z+4.95),(x+w/2,2.3,z+4.95),(x-.25,2.3,z+6.15),(x-.25,-2.3,z+6.15)],'#7e8580')
  for p,q in [((x-w/2,-2.34,z+4.95),(x-.25,-2.34,z+6.15)),((x-.25,-2.34,z+6.15),(x+w/2,-2.34,z+4.95))]:b.line(p,q,.055,trim,5)
  for zz in [z+.6,z+2.65,z+4.7]:b.box(x,-2.17,zz,w+.15,.2,.14,trim)
  # Polygonal bay windows project through two storeys with their own cornice.
  bay=[(x-1.05,-2.1),(x-.85,-2.55),(x-.05,-2.55),(x+.22,-2.1)]
  prism(b,bay,z+.65,3.9,c)
  for zz in [z+1.15,z+3.1]:
   for a,q in zip(bay,bay[1:]):
    A=Vector((a[0],a[1],zz));C=Vector((q[0],q[1],zz));D=C.copy();D.z+=1.2;E=A.copy();E.z+=1.2;center=(A+C)/2;inset=.09
    b.face([A.lerp(C,inset),C.lerp(A,inset),D.lerp(E,inset),E.lerp(D,inset)],'#608894')
    for p,r in [(A,C),(C,D),(D,E),(E,A)]:b.line(p,r,.035,trim,4)
    b.line((center.x,center.y,zz),(center.x,center.y,zz+1.2),.025,trim,4)
  for zz in [z+2.6,z+4.6]:
   for a,q in zip(bay,bay[1:]+bay[:1]):b.line((a[0],a[1],zz),(q[0],q[1],zz),.065,trim,5)
  b.box(x+.72,-2.14,z+1.3,.52,.06,1.6,'#556e70');b.box(x+.72,-2.6,z+2.45,1,1,.14,trim)
  for xx in [x+.25,x+1.18]:column(b,xx,-2.9,z+.45,1.9,.055,trim)
  for j in range(5):b.box(x+.72,-3.5+j*.16,z+.12+j*.1,.9,.45,.15,'#ddd6c0')
  b.box(x-.25,-2.15,z+5.25,.4,.06,.45,'#5b7c86')
  for xx in [x-.8+i*.15 for i in range(8)]:b.line((xx,-2.4,z+4.9),(x-.25,-2.4,z+5.65),.016,trim,4)
 b.finish('painted-ladies-six-victorians')

def sfCityHall():
 b=Build();stone='#dcd6c5';gold='#d7b45b';roof='#748487'
 b.box(0,0,.1,30,18,.2,'#c5d0bf')
 # Four outer bars and central cross preserve two open roof courts.
 for x,y,w,d,h in [(0,-4.5,26,3,4.7),(0,4.5,26,3,4.7),(-11.5,0,3,6,4.7),(11.5,0,3,6,4.7),(0,0,8,6,5.8)]:
  b.box(x,y,h/2,w,d,h,stone);b.box(x,y,h+.12,w+.12,d+.12,.2,roof);b.box(x,y,h+.3,w+.25,d+.25,.15,CREAM)
 for x in [-11.8,-10.4,-9,-7.6,-6.2,6.2,7.6,9,10.4,11.8]:
  arch_glass(b,x,-6.04,.7,.8,1.2,'#697e7e');arch_glass(b,x,-6.04,2.2,.8,1.9,'#697e7e');column(b,x+.52,-6.15,1.9,2.6,.1,CREAM)
 for x in [-3.2,-1.92,-.64,.64,1.92,3.2]:column(b,x,-6.9,1.3,4.5,.22,CREAM)
 b.box(0,-6.2,5.9,8.3,2,.35,CREAM);pediment(b,0,-6.2,6.1,8.6,1.1,2,stone)
 for i in range(8):b.box(0,-8.4+i*.22,.16+i*.15,9,2.4-i*.2,.23,CREAM)
 for x in [-2,0,2]:arch_glass(b,x,-6.1,.6,1.2,2.3,'#4e6669');arch(b,x,-6.2,.6,1.4,2.5,.12,CREAM)
 lathe(b,0,0,[(5.8,3.65),(6.3,3.65),(6.5,3.1),(9.5,3.1),(9.7,3.5),(10,3.45)],stone,32)
 for i in range(24):
  a=i*math.pi/12;column(b,3.2*math.cos(a),3.2*math.sin(a),6.5,2.9,.12,CREAM)
  if i%3==0:lathe(b,3.5*math.cos(a),3.5*math.sin(a),[(6.3,.15),(7.2,.12),(7.4,0)],gold,8)
 profile=[(10,3.45),(10.8,3.4),(11.8,3.2),(12.9,2.7),(14,1.9),(14.8,1.1),(15.2,.85)]
 lathe(b,0,0,profile,roof,48)
 for i in range(24):
  a=i*math.pi/12;pts=[(r*math.cos(a),r*math.sin(a),z+.025) for z,r in profile]
  for p,q in zip(pts,pts[1:]):b.line(p,q,.045,gold,5)
 lathe(b,0,0,[(15.2,.9),(15.5,.9),(15.6,.55),(16.8,.55),(17,.7),(17.4,.35),(17.8,.1)],gold,16)
 b.line((0,0,17.7),(0,0,18.8),.06,gold,6)
 b.finish('sf-city-hall-courts-and-gilded-dome')

if __name__=='__main__':export_models([('goldenGate',goldenGate),('ferryBuilding',ferryBuilding),('salesforce',salesforce),('alcatraz',alcatraz),('paintedLadies',paintedLadies),('sfCityHall',sfCityHall)],'bay-heroes-report.json')
