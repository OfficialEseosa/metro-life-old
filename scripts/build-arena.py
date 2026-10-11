"""State Farm Arena audit correction. References and proportions precede authoring."""
import os,runpy,math
lib=runpy.run_path(os.path.join(os.path.dirname(__file__),'build-atlanta-heroes.py'),run_name='landmark_helpers')
globals().update({k:v for k,v in lib.items() if not k.startswith('__')})

def arena():
 b=Build();b.box(0,0,.06,18,16,.12,'#d3d8ce')
 outline=[(-7.8,-6),(-7.8,6),(6.8,6),(7.8,4.8),(7.8,-4.8),(6.5,-6)]
 prism(b,outline,0,3.3,'#719ba8')
 roof=lambda x:3.5+1.35*math.cos(x/8.6*math.pi/2)
 # Barrel vault and its projecting curved fascia, not a disc or oval lid.
 for i in range(32):
  x=-8.6+i*17.2/32;xx=x+17.2/32
  b.face([(x,-6.8,roof(x)),(xx,-6.8,roof(xx)),(xx,6.5,roof(xx)),(x,6.5,roof(x))],'#dee5e4' if i%2 else '#f0f1e8')
  for y in [-6.8,6.5]:b.face([(x,y,roof(x)),(xx,y,roof(xx)),(xx,y,roof(xx)-.22),(x,y,roof(x)-.22)],'#d5dfdd')
  if i%2==0:b.line((x,-6.75,roof(x)+.025),(x,6.5,roof(x)+.025),.018,'#b4c5c7',4)
 for y in [-6.03,6.03]:
  for i in range(24):
   x=-7.8+i*.65;xx=x+.65;b.face([(x,y,3.3),(xx,y,3.3),(xx,y,roof(xx)-.25),(x,y,roof(x)-.25)],'#7097a2')
  for x in [-7.5+i*.55 for i in range(28)]:b.line((x,y,.15),(x,y,roof(x)-.25),.018,'#b4ccd0',4)
  for z in [.8,1.6,2.4,3.2]:b.line((-7.7,y,z),(7.7,y,z),.018,'#bad0d1',4)
 # Giant white structural letter frames, based on the real downtown facade.
 glyphs={
 'A':[((0,0),(.5,1)),((.5,1),(1,0)),((.22,.4),(.78,.4))],
 'T':[((0,1),(1,1)),((.5,1),(.5,0))],
 'L':[((0,1),(0,0)),((0,0),(1,0))],
 'N':[((0,0),(0,1)),((0,1),(1,0)),((1,0),(1,1))]}
 for i,ch in enumerate('ATLANTA'):
  x=-7.7+i*2.2
  for (u,v),(uu,vv) in glyphs[ch]:b.line((x+u*1.9,-6.3,.25+v*3.7),(x+uu*1.9,-6.3,.25+vv*3.7),.09,'#e6ece5',4)
 # Side support/service pavilion, glazing and metal overhangs.
 b.box(-6.5,1.3,2.1,3,8.5,4.2,'#c4c5b3');b.box(-6.5,1.3,4.3,3.3,8.8,.2,'#e1e4d9')
 windows(b,-6.5,-3,.7,2.6,2.6,5,4,'#4d7078',False)
 for y in [-4.5,0,4.5]:b.box(7.9,y,1.8,.16,3.5,3.6,'#536e74')
 for j in range(4):b.box(0,-7.5-j*.3,.12-j*.025,16,.5,.08,'#dfe2d7')
 b.finish('state-farm-curved-roof-atlanta-steel')

if __name__=='__main__':export_models([('arena',arena)],'arena-report.json')
