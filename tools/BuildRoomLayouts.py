"""Owned metre-scale room furniture, approach stations and animation hip slots."""
import json,copy,math
from pathlib import Path
root=Path(__file__).resolve().parent.parent
path=root/'shared/interiors.json'
data=json.loads(path.read_text(encoding='utf-8'))
def slot(id,pose,x,z,y=None,face=0):
 s=dict(id=id,pose=pose,x=x,z=z,face=face)
 if y is not None:s['y']=y
 return s
def piece(id,kind,x,z,w,d,slots=None,angle=0):return dict(id=id,kind=kind,x=x,z=z,w=w,d=d,angle=angle,slots=slots or [])
def make(kind,city):
 layout=copy.deepcopy(data[kind]);layout.pop('variants',None)
 if kind=='home':
  bed=(2.25,-1.65);stove=(-2.7,.1);shower=(-2.7,-1.9);chair=(2.5,1)
  if city=='nyc':bed=(-2.25,-1.65);stove=(2.7,.1);shower=(2.7,-1.9);chair=(-2.5,1)
  if city=='bay':bed=(2.25,.8);stove=(-2.7,-1.4);shower=(-2.7,1.3);chair=(1.5,-2)
  left=city=='nyc';bface=math.pi/2 if left else -math.pi/2;cface=math.pi/2 if left else -math.pi/2
  f=[piece('bed','bed',*bed,2,1.5,[slot('bed','Sleep',*bed,.78,bface)],math.pi if left else 0),piece('stove','stove',*stove,.9,1.1,[slot('stove','Interact',stove[0]+(-.65 if left else .65),stove[1],face=math.pi/2 if left else -math.pi/2)]),piece('shower','shower',*shower,1.1,1.5,[slot('shower','Interact',*shower,face=0)]),piece('chair','chair',*chair,.65,.65,[slot('chair','Sit',*chair,.61,cface)],cface)]
  for row in layout['stations']:
   item=next(p for p in f if p['id']==('chair' if row['id']=='couch' else row['id']))
   row['x']=item['x']+(-1.5 if item['x']>0 else 1.5);row['z']=item['z'];row['face']=item['slots'][0]['face']
 elif kind=='work':
  main=(-1.7,-2.5) if city=='nyc' else (1.5,-2.4) if city=='bay' else (0,-2.2)
  desks=[main,(-3.5,.1),(3.5,.1)]
  f=[piece('desk-'+str(i),'desk',x,z,2,.8,[slot('desk-'+str(i),'Type',x,z+.9,.61,math.pi)]) for i,(x,z) in enumerate(desks)]
  f += [piece('shelf','shelf',-4.8,-3.9,1.2,.7),piece('plant','plant',4.7,-3.8,.8,.8)]
  layout['stations'][0].update(x=main[0],z=main[1]+1.4)
 elif kind=='cafe':
  mirror=-1 if city=='bay' else 1
  tables=[(1.7,-1),(3.7,2)] if city=='nyc' else [(2.2,.3),(3.8,-2.9)]
  tables=[(x*mirror,z) for x,z in tables]
  f=[piece('counter','counter',-4.5*mirror,-1.8,1.4,4,[slot('counter','Interact',-3.1*mirror,-1.8,face=-math.pi/2*mirror)])]
  for i,(x,z) in enumerate(tables):f.append(piece('table-'+str(i),'table',x,z,1.5,1.3,[slot('table-'+str(i),'Eat',x,z+1.15,.61,math.pi)]))
  layout['stations'][0].update(x=-2.8*mirror,z=-.4,face=-math.pi/2*mirror)
  layout['stations'][1].update(x=tables[0][0],z=tables[0][1]+1.3,face=math.pi)
  layout['stations'][2].update(x=-2.8*mirror,z=-2.9,face=-math.pi/2*mirror)
  f.append(piece('register','desk',-2.8*mirror,-4.1,1.6,.6,[slot('register','Type',-2.8*mirror,-3.2,.61,math.pi)]))
 else:
  dance=(1,.3) if city=='bay' else (0,0);stage=(-1.6,-3.6) if city=='nyc' else (0,-3.6)
  f=[piece('floor','dance',*dance,4.6,4.2,[slot('dance-'+str(i),'Dance',dance[0]+dx,dance[1]+dz,face=math.pi) for i,(dx,dz) in enumerate([(-1.2,-.8),(0,-.8),(1.2,-.8),(-1.2,.8),(0,.8),(1.2,.8)])]),piece('stage','stage',*stage,6.7,2.3,[slot('stage','Cheer',stage[0],stage[1]+.5,face=0)]),piece('bar','counter',-4.5,.4,1.3,3,[slot('bar','Interact',-3.3,.4,face=-math.pi/2)])]
  layout['stations'][0].update(x=dance[0],z=dance[1]);layout['stations'][1].update(x=stage[0],z=stage[1]+.8)
 layout['furniture']=f;layout['slots']=[s for p in f for s in p['slots']]
 layout['boxes']=[dict(x=p['x'],z=p['z'],w=p['w'],d=p['d'],a=p['angle']) for p in f if p['kind'] not in ['dance','stage','chair']]
 return layout
for kind in list(data):
 variants={city:make(kind,city) for city in ['atl','nyc','bay']}
 data[kind]=copy.deepcopy(variants['atl']);data[kind]['variants']={k:v for k,v in variants.items() if k!='atl'}
temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8');temporary.replace(path)
print('Room layouts:',{k:{c:len(make(k,c)['slots']) for c in ['atl','nyc','bay']} for k in data})
