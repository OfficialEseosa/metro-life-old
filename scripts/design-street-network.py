"""Author one connected street graph per land mass, shared by paving, cars and walkers."""
import json, math, heapq
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
nav = json.loads((ROOT/'shared/navigation.json').read_text(encoding='utf-8'))['cities']
residents = json.loads((ROOT/'shared/resident-routes.json').read_text(encoding='utf-8'))
STEP = 2

def polygon(x,z,p):
    inside=False
    for a,b in zip(p,p[-1:]+p[:-1]):
        if (a[1]>z)!=(b[1]>z) and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]: inside=not inside
    return inside

def box(x,z,b,pad):
    a=b.get('a',0);dx=x-b['x'];dz=z-b['z']
    return abs(dx*math.cos(a)-dz*math.sin(a))<b['w']/2+pad and abs(dx*math.sin(a)+dz*math.cos(a))<b['d']/2+pad

output={'version':1,'cities':{}}
for city,n in nav.items():
    old=residents['cities'][city]['roads']; buckets={}
    for b in n['boxes']:
        r=math.hypot(b['w'],b['d'])/2+2
        for x in range(math.floor((b['x']-r)/8),math.floor((b['x']+r)/8)+1):
            for z in range(math.floor((b['z']-r)/8),math.floor((b['z']+r)/8)+1): buckets.setdefault((x,z),[]).append(b)
    def clear(x,z,pad=1.6):
        return (any(polygon(x,z,p) for p in n['land']) or any(box(x,z,b,-.35) for b in n['bridges'])) and not any(polygon(x,z,p) for p in n['water']) and not any(box(x,z,b,pad) for b in buckets.get((math.floor(x/8),math.floor(z/8)),[]))
    land=[p for polygon_ in n['land'] for p in polygon_]
    cells={(x,z) for x in range(math.floor(min(p[0] for p in land)),math.ceil(max(p[0] for p in land))+1,STEP) for z in range(math.floor(min(p[1] for p in land)),math.ceil(max(p[1] for p in land))+1,STEP) if clear(x,z)}
    def neighbours(p):
        for dx,dz in ((STEP,0),(-STEP,0),(0,STEP),(0,-STEP)):
            q=(p[0]+dx,p[1]+dz)
            if q in cells and clear((p[0]+q[0])/2,(p[1]+q[1])/2): yield q
    component={}; groups=[]
    for p in sorted(cells):
        if p in component: continue
        index=len(groups);queue=[p];component[p]=index
        for at in queue:
            for q in neighbours(at):
                if q not in component: component[q]=index;queue.append(q)
        groups.append(queue)
    preferred=set()
    for p in cells:
        if any(box(*p,r,.8) for r in old): preferred.add(p)
    terminals={}; access={}
    for id,door in {**n['doors'],**{'home:'+k:v for k,v in n['homes'].items()}}.items():
        start=(door['x'],door['z']); nearby=sorted(cells,key=lambda p:math.dist(start,p))[:80]
        # Access paths use the same swept building/water authority as walking.
        for end in nearby:
            steps=max(1,math.ceil(math.dist(start,end)/.2))
            if all(clear(start[0]+(end[0]-start[0])*i/steps,start[1]+(end[1]-start[1])*i/steps,.32) for i in range(steps+1)):
                terminals[id]=end;access[id]=[list(start),list(end)];break
    def path(start,targets):
        heap=[(0,0,start)];cost={start:0};parent={};end=None
        while heap:
            _,g,p=heapq.heappop(heap)
            if g!=cost.get(p):continue
            if p in targets:end=p;break
            for q in neighbours(p):
                ng=g+(1 if q in preferred else 1.6)
                if ng<cost.get(q,1e20):
                    cost[q]=ng;parent[q]=p;h=min(abs(q[0]-t[0])+abs(q[1]-t[1]) for t in targets)/STEP
                    heapq.heappush(heap,(ng+h,ng,q))
        if end is None:return []
        result=[end]
        while result[-1]!=start:result.append(parent[result[-1]])
        return result[::-1]
    edges=set();tree=set()
    for index,group in enumerate(groups):
        points=sorted(set(p for p in terminals.values() if component[p]==index))
        if not points:continue
        current={points.pop(0)};tree.update(current)
        while points:
            start=min(points,key=lambda p:min(math.dist(p,q) for q in current));points.remove(start)
            route=path(start,current)
            for a,b in zip(route,route[1:]):edges.add(tuple(sorted((a,b))))
            current.update(route);tree.update(route)
        # A little block loop makes cars circulate instead of only reversing at branches.
        points=sorted(current)
        for p in points[::max(1,len(points)//8)]:
            for q in neighbours(p):
                if q in current and tuple(sorted((p,q))) not in edges:edges.add(tuple(sorted((p,q))))
    ordered=sorted(tree);ids={p:i for i,p in enumerate(ordered)};adj=[[] for _ in ordered]
    for a,b in sorted(edges):adj[ids[a]].append(ids[b]);adj[ids[b]].append(ids[a])
    def height(p):
        near=min(old,key=lambda r:math.hypot(r['x']-p[0],r['z']-p[1])) if old else None
        return round(max(0,near['y']-.02) if near and math.hypot(near['x']-p[0],near['z']-p[1])<7 else 0,3)
    nodes=[[p[0],height(p),p[1]] for p in ordered]
    output['cities'][city]={'nodes':nodes,'links':adj,'edges':[[ids[a],ids[b]] for a,b in sorted(edges)],'access':{k:{'node':ids[p],'points':access[k]} for k,p in terminals.items()},'plazas':[ids[p] for p in sorted(set(terminals.values()))], 'width':3.2}
    # Residents and cars now read the same authored corridors. Keep park-specific loops intact.
    routes=[]
    for source,p in terminals.items():
        if source.startswith('home:'):continue
        choices=sorted(((id,q) for id,q in terminals.items() if id!=source and not id.startswith('home:') and component[q]==component[p]),key=lambda row:math.dist(p,row[1]))[:3]
        for target,q in choices:
            a,b=ids[p],ids[q];queue=[a];parent={a:None}
            for at in queue:
                if at==b:break
                for next_ in adj[at]:
                    if next_ not in parent:parent[next_]=at;queue.append(next_)
            if b not in parent:continue
            points=[];at=b
            while at is not None:points.append([nodes[at][0],nodes[at][2]]);at=parent[at]
            points.reverse();points=[access[source][0]]+points+[access[target][0]]
            routes.append({'from':source,'to':target,'points':points})
    residents['cities'][city]['routes']=routes
    residents['cities'][city]['roads']=[{'x':(nodes[a][0]+nodes[b][0])/2,'z':(nodes[a][2]+nodes[b][2])/2,'w':3.2,'d':math.dist(ordered[a],ordered[b]),'a':math.atan2(nodes[b][0]-nodes[a][0],nodes[b][2]-nodes[a][2]),'y':(nodes[a][1]+nodes[b][1])/2+.03,'pitch':0} for a,b in output['cities'][city]['edges']]
(ROOT/'shared/streets.json').write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf-8')
residents['version']=7
(ROOT/'shared/resident-routes.json').write_text(json.dumps(residents,separators=(',',':'))+'\n',encoding='utf-8')
