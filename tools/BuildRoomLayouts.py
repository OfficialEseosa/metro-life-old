"""Deterministic authored metre-scale rooms: collision, approach stations, use slots and venue assignments."""
import json, copy, math
from collections import deque
from pathlib import Path
root=Path(__file__).resolve().parent.parent
path=root/'shared/interiors.json'
old=json.loads(path.read_text(encoding='utf-8'))
def slot(id,pose,x,z,y=None,face=math.pi,station=None):
 s=dict(id=id,pose=pose,x=x,z=z,face=face)
 if y is not None:s['y']=y
 if station:s['station']=station
 return s
def piece(id,kind,x,z,w,d,slots=None,angle=0):return dict(id=id,kind=kind,x=x,z=z,w=w,d=d,angle=angle,slots=slots or [])
def station(id,name,x,z,action='venue',face=math.pi):return dict(id=id,name=name,action=action,x=x,z=z,face=face)
def activity(station,pose):return dict(station=station,pose=pose)
def table(id,x,z):return piece(id,'table',x,z,1.5,1.3,[slot(id,'Eat',x,z+1.15,.61,station='table')])
def reception(x=-3.5,z=-2.8,w=3.5):return piece('reception','counter',x,z,w,1,[slot('service','Interact',x,z+1.15,station='desk')])
def room(kind,city):
 if kind=='home':
  layout=copy.deepcopy(old['home'] if city=='atl' else old['home']['variants'][city]);layout.pop('variants',None)
  # Clear approach outside the stove's expanded collision; slots live inside authored action geometry.
  for f in layout['furniture']:
   if f['kind']=='stove':
    f['slots'][0]['x']=f['x']+(-.9 if f['x']>0 else .9)
  return layout
 f=[];staff=[];stations=[];activities={};labels={}
 if kind=='work':
  main=(-1.7,-2.5) if city=='nyc' else (1.5,-2.4) if city=='bay' else (0,-2.2)
  f=[piece('desk-'+str(i),'desk',x,z,2,.8,[slot('desk-'+str(i),'Type',x,z+.9,.61,station='desk')]) for i,(x,z) in enumerate([main,(-3.5,.1),(3.5,.1)])]
  f += [piece('shelf','shelf',-4.8,-3.9,1.2,.7),piece('plant','plant',4.7,-3.8,.8,.8),table('lunch',3.5,-3.4)]
  stations=[station('desk','Work at a desk',main[0],main[1]+1.4,action='work'),station('table','Eat in the break area',3.5,-2.1,action='eat')]
  activities={k:activity('desk','Type') for k in ['job','work','learn','fun','social','rest','civic']};activities['food']=activity('table','Eat')
 elif kind=='cafe':
  # Two customer tables, a service counter and a staff-side register, never a computer dining station.
  f=[reception(-3.3,-2.8,3.4),table('table-0',1.7,-1),table('table-1',3.7,1.8),piece('shelf','shelf',-4.8,-4.2,1.2,.7)]
  stations=[station('counter','Order at the coffee counter',-3.3,-1.5,action='eat'),station('table','Enjoy a cafe meal',1.7,.35,action='eat'),station('desk','Help at the cafe counter',-1.15,-2.8,action='work',face=-math.pi/2)]
  f[0]['slots']=[slot('service','Interact',-1.3,-2.8,face=-math.pi/2,station='desk')]
  staff=[dict(id='barista',name='Barista',x=-3.3,z=-3.8,face=0)]
  activities={k:activity('table','Eat') for k in ['food','fun','social','rest','learn']};activities.update(job=activity('desk','Interact'),work=activity('desk','Interact'),civic=activity('desk','Interact'))
  labels={'COFFEE & BAKES':[-3.3,2.05,-4.86]}
 elif kind=='foodhall':
  f=[piece('stall-0','stall',-3.6,-3.7,3,1.15,[slot('service-0','Interact',-3.6,-2.45,station='desk')]),piece('stall-1','stall',1,-3.7,3,1.15,[slot('service-1','Interact',1,-2.45,station='desk')]),table('table-0',-3,.25),table('table-1',.3,.25),table('table-2',3.6,.25),piece('games','games',4.55,-2.7,1,1)]
  stations=[station('table','Eat at a food hall table',.3,1.65,action='eat'),station('desk','Help at a food stall',-3.6,-2.35,action='work'),station('games','Play rooftop games',4.55,-1.45)]
  f[-1]['slots']=[slot('games','Interact',4.55,-1.6,station='games')]
  staff=[dict(id='cook',name='Cook',x=-3.6,z=-4.55,face=0),dict(id='server',name='Server',x=1,z=-4.55,face=0)]
  activities={k:activity('table','Eat') for k in ['food','social','rest']};activities.update(job=activity('desk','Interact'),work=activity('desk','Interact'),fun=activity('games','Interact'),learn=activity('games','Interact'),civic=activity('desk','Interact'))
  labels={'PEACHTREE NOODLES':[-3.6,2.2,-4.85],'MAPLE ST. KITCHEN':[1,2.2,-4.85]}
 elif kind in ['theatre','club']:
  f=[piece('stage','stage',0,-3.55,6.7,2.3,[slot('performer','Cheer',0,-3.05,.36,face=0,station='stage')]),reception(-4.75,1.1,1.25)]
  f[1]['slots']=[slot('service','Interact',-3.55,1.1,face=-math.pi/2,station='desk')]
  stations=[station('stage','Perform on the stage',0,-1.8,action='perform'),station('desk','Help at the venue',-3.45,1.1,action='work',face=-math.pi/2)]
  staff=[dict(id='host',name='Venue host',x=-4.75,z=.12,face=0)]
  activities={k:activity('seats','Sit') for k in ['fun','learn','rest','social','civic']};activities.update(job=activity('desk','Interact'),work=activity('stage','Cheer'),food=activity('table','Eat'))
  if kind=='theatre':
   for row,z in enumerate([-.25,1.5]):
    for col,x in enumerate([-1.8,-.6,.6,1.8]):f.append(piece(f'seat-{row}-{col}','chair',x,z,.65,.65,[slot(f'seat-{row}-{col}','Sit',x,z,.61,station='seats')],math.pi))
   stations += [station('seats','Watch the starlit stage',2.8,1.5),station('table','Have refreshments',4.2,2.65,action='eat')];f.append(table('refreshments',4.2,1.3))
  else:
   f.append(piece('floor','dance',0,.1,4.6,3.8,[slot('dance-'+str(i),'Dance',dx,dz,station='dance') for i,(dx,dz) in enumerate([(-1.2,-.7),(0,-.7),(1.2,-.7),(-1.2,.9),(0,.9),(1.2,.9)])]))
   f.append(table('refreshments',4.3,1.1));stations += [station('dance','Enjoy the dance floor',0,.1,action='dance'),station('table','Have refreshments',4.3,2.45,action='eat')]
   activities.update({k:activity('dance','Dance') for k in ['fun','learn','rest','social','civic']})
 elif kind in ['stadium','arena']:
  # Lowered miniature playing surface with tiered seats visible from a walkable concourse.
  f=[piece('field' if kind=='stadium' else 'court',kind,0,-3.45,7,2.6),piece('stands','stands',0,-.8,5.6,1.65,[slot('stand-'+str(i),'Cheer',x,-1.65,.32,station='stands') for i,x in enumerate([-1.8,0,1.8])]),reception(-4.5,1.4,1.5),table('table-0',3.8,1.1)]
  f[2]['slots']=[slot('service','Interact',-3.25,1.4,face=-math.pi/2,station='desk')]
  stations=[station('stands','Watch from the stands',0,.6),station('desk','Help at the concourse',-3.15,1.4,action='work',face=-math.pi/2),station('table','Eat at the concourse table',3.8,2.45,action='eat')]
  staff=[dict(id='concessions',name='Concessions host',x=-4.5,z=.4,face=0)]
  activities={k:activity('stands','Cheer') for k in ['fun','learn','rest','social','civic']};activities.update(job=activity('desk','Interact'),work=activity('desk','Interact'),food=activity('table','Eat'))
 elif kind=='museum':
  f=[piece('gallery','gallery',0,-4.35,7.8,.35,[slot('art-view-'+str(i),'Interact',x,-2.8,station='gallery') for i,x in enumerate([-2.5,0,2.5])]),piece('bench','bench',0,-.3,3.3,.65,[slot('bench-0','Sit',-.8,-.3,.61,station='bench'),slot('bench-1','Sit',.8,-.3,.61,station='bench')]),reception(-4.5,1.3,1.5),table('table-0',3.9,1)]
  f[2]['slots']=[slot('service','Interact',-3.25,1.3,face=-math.pi/2,station='desk')]
  stations=[station('gallery','Browse and sketch the art',0,-2.6),station('bench','Rest in the gallery',2.25,-.3),station('desk','Help at the gallery desk',-3.15,1.3,action='work',face=-math.pi/2),station('table','Enjoy the museum cafe',3.9,2.35,action='eat')]
  staff=[dict(id='curator',name='Gallery attendant',x=-4.5,z=.3,face=0)]
  activities={k:activity('gallery','Interact') for k in ['fun','learn','social','civic']};activities.update(rest=activity('bench','Sit'),job=activity('desk','Interact'),work=activity('desk','Interact'),food=activity('table','Eat'))
 elif kind in ['hospital','airport']:
  f=[reception(-3.2,-3.25,4.1),piece('bench-0','bench',2.5,-2.3,3,.65,[slot('waiting-0','Sit',1.7,-2.3,.61,station='waiting'),slot('waiting-1','Sit',3.2,-2.3,.61,station='waiting')]),piece('bench-1','bench',2.5,.6,3,.65,[slot('waiting-2','Sit',1.7,.6,.61,station='waiting'),slot('waiting-3','Sit',3.2,.6,.61,station='waiting')]),piece('plant','plant',-4.8,1.4,.7,.7),table('table-0',-2.8,.6)]
  stations=[station('waiting','Wait by the gate' if kind=='airport' else 'Sit in the waiting area',2.5,1.95),station('desk','Speak to the gate agent' if kind=='airport' else 'Help at reception',-3.2,-1.95,action='work'),station('table','Take a refreshment break',-2.8,1.95,action='eat')]
  staff=[dict(id='agent' if kind=='airport' else 'nurse',name='Gate agent' if kind=='airport' else 'Reception nurse',x=-3.2,z=-4.2,face=0)]
  activities={k:activity('waiting','Sit') for k in ['fun','learn','rest','social','travel']};activities.update(job=activity('desk','Interact'),work=activity('desk','Interact'),civic=activity('desk','Interact'),food=activity('table','Eat'))
  labels={'GATE A12  /  DEPARTURES' if kind=='airport' else 'RECEPTION  /  CARE DESK':[-2.5,2.1,-4.85]}
 else:
  f=[piece('bench','bench',0,-2.8,3.3,.65,[slot('bench-0','Sit',-.8,-2.8,.61,station='bench'),slot('bench-1','Sit',.8,-2.8,.61,station='bench')]),table('picnic-0',-3,.1),table('picnic-1',3,.1),reception(-4.4,-3.5,1.6),piece('plant','plant',4.7,-3.8,.8,.8)]
  f[3]['slots']=[slot('ranger','Interact',-3.1,-3.5,face=-math.pi/2,station='desk')]
  stations=[station('bench','Enjoy the pavilion view',0,-1.5),station('table','Share a picnic',-3,1.45,action='eat'),station('desk','Speak at the visitor desk',-3,-3.5,action='work',face=-math.pi/2)]
  staff=[dict(id='ranger',name='Visitor host',x=-4.4,z=-4.4,face=0)]
  activities={k:activity('bench','Sit') for k in ['fun','learn','rest','social','civic']};activities.update(job=activity('desk','Interact'),work=activity('desk','Interact'),food=activity('table','Eat'))
 names={'work':'Office & co-working','cafe':'Neighborhood cafe','foodhall':'Market food hall','theatre':'Starlit theatre','club':'Live music club','stadium':'Stadium concourse','arena':'Arena concourse','museum':'Museum gallery','hospital':'Hospital lobby','airport':'Airport gate','pavilion':'Park pavilion'}
 layout=dict(name=names[kind],exit=dict(x=0,z=4),stations=stations,furniture=f,slots=[s for p in f for s in p['slots']],activities=activities,staff=staff,labels=[dict(text=k,x=v[0],y=v[1],z=v[2]) for k,v in labels.items()])
 layout['boxes']=[dict(x=p['x'],z=p['z'],w=p['w'],d=p['d'],a=p['angle']) for p in f if p['kind'] not in ['dance','stage','chair','bench']]
 return layout
assignments={
 'atl':{'benz':'stadium','arena':'arena','aquarium':'museum','centennial':'pavilion','piedmont':'pavilion','beltline':'pavilion','ponce':'foodhall','krog':'cafe','fox':'theatre','high':'museum','gatech':'work','gsu':'work','techVillage':'work','lenox':'foodhall','capitol':'work','mlk':'museum','l5p':'club','truist':'stadium','grady':'hospital','atlAirport':'airport'},
 'nyc':{'timesSquare':'theatre','centralPark':'pavilion','empire':'work','grandCentral':'airport','msg':'arena','broadway':'theatre','met':'museum','apollo':'theatre','columbia':'work','highLine':'pavilion','wallStreet':'work','oneWtc':'work','brooklynBridge':'pavilion','dumbo':'work','williamsburgVenue':'club','chinatown':'cafe','fifthAve':'foodhall','cityHall':'work','liberty':'museum','yankee':'stadium','coney':'pavilion','presbyterian':'hospital','nycAirport':'airport'},
 'bay':{'goldenGate':'pavilion','ferryBuilding':'cafe','salesforce':'work','pier39':'foodhall','alcatraz':'museum','ggPark':'pavilion','dolores':'pavilion','missionEats':'foodhall','paintedLadies':'pavilion','chaseCenter':'arena','oraclePark':'stadium','sfChinatown':'foodhall','sfCityHall':'work','fillmore':'theatre','berkeleyCampus':'work','lakeMerritt':'pavilion','oaklandFox':'club','stanford':'work','sandHill':'work','techCampus':'work','ucsf':'hospital','bayAirport':'airport'}}
data={}
for kind in ['home','work','cafe','club','theatre','foodhall','stadium','arena','museum','hospital','airport','pavilion']:
 data[kind]=room(kind,'atl');data[kind]['variants']={city:room(kind,city) for city in ['nyc','bay']};data[kind]['landmarks']={city:[loc for loc,t in rows.items() if t==kind] for city,rows in assignments.items()}
# Survey every approach route once; residents use these collision-checked aisle routes.
def stand(layout,x,z,home):
 if abs(x)>=(3.25 if home else 5.5) or abs(z)>=(2.75 if home else 4.5):return False
 for b in layout['boxes']:
  dx=x-b['x'];dz=z-b['z'];c=math.cos(b['a']);s=math.sin(b['a'])
  if abs(dx*c-dz*s)<b['w']/2+.3 and abs(dx*s+dz*c)<b['d']/2+.3:return False
 return True
for kind,base in data.items():
 for city,layout in [('atl',base),*base['variants'].items()]:
  start=(round(layout['exit']['x']*10),round(layout['exit']['z']*10));queue=deque([start]);previous={start:None}
  while queue:
   at=queue.popleft()
   for dx,dz in [(2,0),(-2,0),(0,2),(0,-2)]:
    nxt=(at[0]+dx,at[1]+dz)
    if nxt not in previous and stand(layout,nxt[0]/10,nxt[1]/10,kind=='home'):previous[nxt]=at;queue.append(nxt)
  layout['paths']={}
  for point in layout['stations']:
   assert stand(layout,point['x'],point['z'],kind=='home'),(kind,city,point['id'],'blocked')
   nearest=min(previous,key=lambda p:math.hypot(p[0]/10-point['x'],p[1]/10-point['z']))
   assert math.hypot(nearest[0]/10-point['x'],nearest[1]/10-point['z'])<.3,(kind,city,point['id'],'unreachable')
   route=[];at=nearest
   while at is not None:route.append([at[0]/10,at[1]/10]);at=previous[at]
   layout['paths'][point['id']]=list(reversed(route))+[[point['x'],point['z']]]
world=json.loads((root/'shared/world.json').read_text(encoding='utf-8'))
for city in world['cities']:assert set(assignments[city['id']])=={l['id'] for l in city['landmarks']}
path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
print('Authored 12 templates x 3 cities; all 65 landmark assignments covered.')
