import * as THREE from 'three'
import { Builder } from './geometry'

const stone = '#e5d9bd', brick = '#a65c43', glass = '#5b8590', dark = '#35454b', white = '#f4f1e5', copper = '#648d7f'

export function landmarkGeometry(id: string) {
  const b = new Builder()
  const block = (x: number, z: number, w: number, h: number, d: number, color = stone) => {
    b.box(x, h / 2, z, w, h, d, color).box(x, h + .12, z, w + .25, .24, d + .25, white)
    b.windows(x, h / 2, z, w, h * .8, d, Math.max(2, Math.round(w)), Math.max(1, Math.round(h / 1.3)))
  }
  const door = (x: number, z: number, w = 1, h = 1.8) => b.box(x, h / 2, z, w, h, .08, dark)
  const pillars = (x: number, y: number, z: number, count: number, gap: number, height: number) => {
    for (let i = 0; i < count; i++) { const px = x + (i - (count - 1) / 2) * gap; b.cylinder(px, y, z, .18, height, white, 8).box(px, y + height / 2, z, .5, .18, .5, stone) }
  }
  switch (id) {
    case 'benz': {
      b.cylinder(0, 2.3, 0, 10.4, 4.6, dark, 8, 11.7)
      b.box(0, 1.2, 0, 7, .1, 10, '#6e914f')
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, next = a + Math.PI / 4, inner = a + .17
        const p = (angle: number, r: number, y: number) => [Math.sin(angle) * r, y, Math.cos(angle) * r]
        const A = p(a, 12, 5), B = p(next, 12, 5.6), C = p(inner + .38, 3.5, 5.8), D = p(inner, 3.5, 5.5)
        b.triangle([...A, ...B, ...C, ...A, ...C, ...D], i % 2 ? '#d5dce0' : '#b1bdc3')
        const L = p(a, 10.5, .3), R = p(next, 10.5, .3)
        b.triangle([...L, ...R, ...B, ...L, ...B, ...A], i % 2 ? '#99b3bc' : '#687d88')
        const middle = p(a + .3927, 11.6, 2.7)
        b.triangle([...L, ...middle, ...A], '#e6e9e8')
        b.line(A, C, .075, '#f0eee6').line(A, L, .09, '#c5cfd0')
        b.line(p(a, 3.7, 5.4), p(next, 3.7, 5.4), .12, '#8fbbb9')
      }
      for (let n = -3; n <= 3; n++) b.box(n, 1.27, 0, .05, .02, 9, '#c0ccb0')
      break
    }
    case 'arena': {
      const g = new THREE.CylinderGeometry(5.7, 6.1, 3.2, 32); g.scale(1.3, 1, 1)
      b.add(g, dark, 0, 1.6).box(0, 1.7, 5, 13, 3.4, 2, stone)
      const roof = new THREE.CylinderGeometry(5.9, 5.9, .4, 32); roof.scale(1.3, 1, 1); b.add(roof, '#d8ddd8', 0, 3.5)
      b.box(0, 1.8, 6.02, 12, 2.5, .05, glass); pillars(0, 2.2, 6.3, 5, 2.5, 4)
      break
    }
    case 'aquarium': {
      b.box(-1, 1.5, -1, 13, 3, 8, '#417990').dome(-2, 3, -1, 6, '#e1e7e7', .25)
      b.box(3.8, 2.1, 1, 5, 4.2, 7, '#678f9d')
      b.triangle([-5, 0, 5, 0, 0, 8, 0, 5.1, 6, -5, 0, 5, 0, 5.1, 6, -5, 4, 3], '#96bfca')
      b.triangle([0, 0, 8, 5, 0, 5, 5, 4, 3, 0, 0, 8, 5, 4, 3, 0, 5.1, 6], '#d5e1e1')
      b.line([-5, 4, 3], [0, 5.1, 6], .15, white).line([0, 5.1, 6], [5, 4, 3], .15, white)
      for(let i=0;i<4;i++)b.box(4.3,1+i*.7,4.52,3.8,.12,.04,'#2e6d89')
      for (let i = -4; i <= 4; i++) b.line([i, 0, 5.5], [i, 3.6 + (4 - Math.abs(i)) * .2, 5.5], .055, '#e2eeeb')
      break
    }
    case 'centennial': {
      b.box(0, .05, 0, 15, .1, 13, '#afbd82').box(0, .12, 0, 4, .1, 13, '#dfd4bc').box(0, .13, 0, 15, .1, 2, '#dfd4bc').box(0, .17, 3, 9, .1, 5, '#d3d0bd')
      for (let i = 0; i < 5; i++) b.torus((i % 3 - 1) * 2.1 + (i > 2 ? 1 : 0), .26, 2 + Math.floor(i / 3) * 1.5, 1.2, .16, '#6fa6af', Math.PI / 2)
      for (let i = -1; i <= 1; i++) b.cylinder(i * 4.5, 1.8, -4, .1, 3.6, stone, 6).box(i * 4.5, 3, -4, 1, 1.1, .05, ['#bf6e51', '#617d92', '#b6a05e'][i + 1])
      break
    }
    case 'piedmont': {
      b.sphere(0, -.05, 0, 11, '#85a46a', 1.2, .025, 1)
      b.sphere(2, .15, -1, 6.7, '#d4ccaa', 1.2, .035, .85).sphere(2, .2, -1, 6.3, '#527f85', 1.2, .025, .85)
      b.box(-5, 1.3, -1, 2.1, .4, 8, stone).torus(-5, .2, -1, 2.2, .4, stone, 0, Math.PI)
      block(5, 4.7, 4, 1.7, 2.5, stone); b.roof(5, 1.8, 4.7, 4.5, 1.1, 3, '#a26744'); pillars(5, .8, 6.2, 4, 1, 1.7)
      break
    }
    case 'beltline': {
      b.box(0, .12, 0, 3, .24, 21, '#d4cab1').box(.1, .27, 0, .07, .02, 20, '#a9935e')
      b.box(0, 1.6, 1, 4, .4, 5, '#766b5d')
      for (let s = -1; s <= 1; s += 2) { b.box(s * 2, 2.2, 1, .13, .8, 5, '#9a7555'); for (let z = -1; z <= 3; z++) b.box(s * 2, 1, z, .2, 2, .2, '#77664e') }
      b.torus(4, 1.7, -3, 1.6, .25, '#ba6f43').cylinder(4, .3, -3, 1, .4, stone)
      break
    }
    case 'ponce': {
      block(0, 0, 16, 6, 6.2, brick); block(0, 0, 4.3, 11, 6.8, brick)
      b.box(0,10.2,3.45,4.1,1.2,.12,'#e6d6b6').text(0,10.35,3.54,'PONCE',.16,'#784c3a').text(0,9.8,3.54,'CITY MARKET',.075,'#784c3a')
      for (let y = 1; y <= 6; y += 1.2) b.box(0, y, 0, 16.2, .12, 6.35, '#d3b797')
      for (let x = -7; x <= 7; x += 1.6) b.box(x, 3.1, 3.15, .18, 6, .18, '#b87654')
      b.box(0, .65, 3.4, 5.5, 1.3, .8, glass)
      for (let x = -5.7; x < -3; x += 1.8) for (let z = -1; z <= 1; z += 2) b.box(x, 7, z, .12, 2, .12, dark)
      b.cylinder(-4.8, 8.3, 0, 1.6, 1.7, '#737e74', 16).cylinder(-4.8, 9.3, 0, 1.7, .4, '#858b80', 16, 0)
      b.box(5,6.4,0,3,.5,2,'#d2b68c').box(5,7.2,0,.2,1.4,.2,white)
      break
    }
    case 'krog': {
      b.box(0, 1.2, 0, 11, 2.4, 5, '#a26445')
      for(let x=-4.2;x<=4.3;x+=2.8) b.roof(x,2.4,0,2.8,1.1,5.2,'#b8c5bb')
      b.box(0,1.1,2.58,8.5,1.8,.12,glass).box(0,2.1,3,10,.18,1,white)
      b.box(7,1.5,0,2,3,6,'#8b8a7b').torus(7,1.1,3.05,1,.22,'#bf8f63',0,Math.PI)
      for(let i=0;i<5;i++)b.box(6.15+i*.4,1.7,3.25,.3,1,.06,['#689c94','#c9826c','#d4b85d','#7c89aa','#a1b570'][i])
      break
    }
    case 'fox': {
      b.box(0, 2, 0, 9, 4, 7, brick).box(2, 2.8, -1, 5, 5.6, 5, brick)
      for (let y = .4; y < 5.6; y += .65) b.box(0, y, 3.55, 9.1, .18, .09, stone)
      for (let x = -3; x <= 3; x += 1.5) { door(x, 3.62, 1, 2.2); b.torus(x, 2.1, 3.7, .6, .12, stone, 0, Math.PI) }
      b.box(0, 2.6, 4.3, 5, .45, 1.7, '#c8ab66').box(0, 3.1, 4.75, 2.6, .6, .12, '#e7ce8b')
      b.box(-2.6,4.5,3.8,.9,4.1,.3,'#78423a');for(let i=0;i<3;i++)b.text(-2.6,5.7-i*1.15,4,'FOX'[i],.16,'#f6e5bd')
      b.cylinder(2.7, 5.9, -.5, 1.6, .8, stone)
      const onion = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(1.5, .1), new THREE.Vector2(1.85, 1), new THREE.Vector2(1.2, 1.8), new THREE.Vector2(.15, 2.6), new THREE.Vector2(0, 2.8)], 20)
      b.add(onion, copper, 2.7, 6.2, -.5)
      for (const x of [-4, 4]) {
        b.cylinder(x, 3.7, 2.6, .42, 7.4, brick, 12).cylinder(x, 6.6, 2.6, .65, .35, stone, 12).dome(x, 7.5, 2.6, .65, copper, 1.3).cylinder(x, 8.8, 2.6, .08, 1.2, '#c4a85d', 6, 0)
        for (let y = 1; y < 7; y += .6) b.cylinder(x, y, 2.6, .44, .14, stone, 12)
      }
      break
    }
    case 'high': {
      b.box(2, 2, -1, 6, 4, 7, '#ffffff').box(-3, 1.5, -1, 4, 3, 5, '#ffffff')
      b.add(new THREE.CylinderGeometry(3, 3, 6.3, 24, 1, false, 0, Math.PI / 2), '#ffffff', -1, 3.15, 2)
      b.box(0, 2.6, 3.4, 3, 5.2, .15, '#a8c2bf').box(1.6, 2.8, 3.55, .18, 5.6, .18, white)
      for(let i=0;i<9;i++){const a=i*Math.PI/18;const x=-1+Math.sin(a)*3.02,z=2+Math.cos(a)*3.02;b.box(x,2.7,z,.08,5.4,.08,'#c4d3ca',a)}
      b.line([-6, .2, 5], [-1, 2.3, 3.5], .3, stone)
      for (let x = 0; x < 5; x++) for (let z = -3; z < 2; z++) b.box(x,4.1,z,.6,.18,.75,'#d9e3e8')
      for (let y = .5; y < 4; y+=.75) b.box(2, y, 2.55, 6, .035, .04, '#bfcbd2')
      for(let x=-1;x<5;x+=.8)b.box(x,2,2.55,.035,4,.04,'#bfcbd2')
      break
    }
    case 'gatech': {
      block(0, 0, 9, 3.6, 5, brick); b.roof(0, 3.7, 0, 9.5, 2, 5.3, '#59616a')
      block(0, 1.4, 2.4, 7.5, 2.4, brick); b.roof(0, 7.6, 1.4, 2.8, 2.7, 2.8, '#4d5a62')
      for (const x of [-1.25, 1.25]) for (const z of [.15, 2.65]) b.cylinder(x, 8, z, .2, 1.2, stone, 6, 0)
      b.box(0, 6.5, 2.65, 2, .7, .04, '#4c5050').text(0,6.5,2.72,'TECH',.11,'#f2d881');door(0, 2.65)
      break
    }
    case 'gsu': {
      block(-2, 0, 6, 7, 5, '#b8b8aa');block(2, -1, 4, 9, 5, stone)
      b.cylinder(1.5, 3.4, 2, 2.3, 6.8, '#7ba2ae', 20).box(0, 1.2, 4.2, 6, 2.4, .7, '#385f78')
      b.box(0, .08, 6, 11, .15, 3, '#d5c9ad');break
    }
    case 'techVillage': {
      block(0, 0, 10, 6.5, 5, '#d4ccb9')
      for (let y = 1; y < 6; y += 1.2) b.box(0, y, 2.6, 10.1, .5, .04, '#45575b')
      b.box(2, 6.8, 0, 4, .2, 4, '#7f9b69');break
    }
    case 'lenox': {
      block(-4, 0, 6, 2.7, 7);block(4, 0, 6, 2.7, 7)
      b.box(0, 1.8, 2, 5, 3.6, 5, '#91b5b9').roof(0, 3.6, 2, 5.5, 1.8, 5.3, '#bbd0cd')
      for (let x = -2; x <= 2; x += 2) b.box(x, 2, 4.6, .18, 4, .2, white)
      b.box(0, .12, 6.3, 14, .2, 3.5, '#d5cdbb');break
    }
    case 'capitol': {
      block(0, 0, 16, 4.1, 7, stone);b.box(0, 4.4, 0, 8, .7, 7.5, '#77847e')
      b.box(0, 2.8, 4.4, 7, .45, 2, white);pillars(0, 1.5, 5, 6, 1.05, 2.7)
      b.roof(0, 3.2, 4.2, 7.5, 1.4, 2.4, stone)
      for (let i = 0; i < 4; i++) b.box(0, .12 + i * .15, 6.3 - i * .35, 8 - i * .3, .2, 2 - i * .1, white)
      b.cylinder(0, 6.2, -.2, 2.45, 3.6, stone, 24)
      for (let i = 0; i < 16; i++) {const a = i * Math.PI / 8;b.cylinder(Math.sin(a) * 2.47, 6.2, Math.cos(a) * 2.47 - .2, .12, 2.7, white, 6)}
      b.cylinder(0, 8, -.2, 2.7, .4, white, 24).dome(0, 8.2, -.2, 2.55, '#d7b453', 1.12)
      b.cylinder(0, 11.3, -.2, .48, .8, stone, 12).dome(0, 11.7, -.2, .6, '#d6b45e').cylinder(0, 12.5, -.2, .1, 1.2, '#e2c26b', 6)
      break
    }
    case 'mlk': {
      block(-4, 0, 4.6, 3.6, 5, '#9a4c3d');b.roof(-4, 3.7, 0, 5, 1.8, 5.3, dark)
      for (const x of [-6, -2]) {block(x, 2, 1.2, 5.2, 1.2, brick);b.cylinder(x, 5.6, 2, .75, 1, '#6c6c5e', 4, 0)}
      door(-4, 2.58, 1.5, 2);b.torus(-4, 3, 2.65, .65, .12, stone, 0, Math.PI)
      block(4, 0, 4, 3.2, 4, '#d9bb75');b.roof(4, 3.4, 0, 4.5, 1.2, 4.5, dark);b.box(4, 1.65, 2.7, 4.6, .15, 1.4, white);pillars(4, .85, 3.2, 4, 1.3, 1.7)
      b.box(0, .12, 5.5, 5, .2, 3, '#57908f').box(0, .35, 5.5, 2, .45, 1.4, white).box(0, .62, 5.5, 1.7, .15, 1.1, white)
      break
    }
    case 'l5p': {
      for (let i = -1; i <= 1; i++) {block(i * 3.5, 0, 3.2, 2.8 + (i + 1) * .3, 4, ['#b8684f', '#61918b', '#c6aa58'][i + 1]);b.box(i * 3.5, 1.8, 2.5, 3.4, .25, 1, '#ddcfb3')}
      b.sphere(-3.5, 2.3, 2.8, 1.5, '#d4cbb1', 1, 1.1, .25)
      b.sphere(-4.1, 2.7, 3.15, .4, dark, 1, 1, .15).sphere(-2.9, 2.7, 3.15, .4, dark, 1, 1, .15).box(-3.5, 1.5, 3.15, .95, 1, .05, dark)
      for(let i=0;i<4;i++)b.box(3+i*.6,1.5,2.03,.3,1,.05,['#bb7378','#70a2a1','#dbba65','#77749b'][i]);break
    }
    case 'truist': {
      const field=new THREE.Shape().moveTo(-7,-5).lineTo(7,-5).lineTo(7,2).lineTo(0,7).lineTo(-7,2).closePath();b.add(new THREE.ShapeGeometry(field),'#6f9959',0,.15,0,-Math.PI/2,Math.PI)
      const edge=[[-8,-5],[-8.5,1],[-6.5,5],[0,8],[6.5,5],[8.5,1],[8,-5]]
      for(let tier=0;tier<4;tier++)for(let i=1;i<edge.length;i++){const outer=1+tier*.09,inner=outer-.08,a=edge[i-1],c=edge[i],y=.5+tier*.6;b.triangle([a[0]*inner,y,a[1]*inner,c[0]*inner,y,c[1]*inner,c[0]*outer,y,c[1]*outer,a[0]*inner,y,a[1]*inner,c[0]*outer,y,c[1]*outer,a[0]*outer,y,a[1]*outer],'#647985',true);b.line([a[0]*outer,y,a[1]*outer],[c[0]*outer,y,c[1]*outer],.045,'#c3c9c8')}
      b.box(0,1,-5.1,15,1.8,.2,'#446249').box(4,2.7,-5.2,4.5,2,.25,dark)
      b.box(0,.2,3,3.4,.1,3.4,'#c9a57a',Math.PI/4).box(0,.27,3,2.5,.03,2.5,'#80a05b',Math.PI/4)
      for(const[x,z]of[[0,5.25],[-2.25,3],[0,.75],[2.25,3]])b.box(x,.31,z,.32,.06,.32,white,Math.PI/4)
      for(const[a,c]of[[[0,5.25],[-2.25,3]],[[-2.25,3],[0,.75]],[[0,.75],[2.25,3]],[[2.25,3],[0,5.25]]])b.line([a[0],.32,a[1]],[c[0],.32,c[1]],.025,white)
      b.cylinder(0,.32,3,.3,.06,'#c9a57a',12)
      for (const x of [-6, 6]) {block(x, 5.5, 2.3, 4, 2.3, brick);b.box(x,4.2,5.5,2.5,.2,2.5,stone)}
      for(const [x,z] of [[-8,-4],[8,-4],[-5,7],[5,7]])b.cylinder(x,3,z,.11,6,dark,6).box(x,6,z,2,.6,.3,white)
      break
    }
    case 'grady': {
      b.box(0, 6, -1, 9, 12, 4, '#c3b59a').box(0, 1.7, 2, 11, 3.4, 5, '#d9ccb5')
      for(let y=1;y<12;y+=1.05)b.box(0,y,1.02,8.8,.43,.08,glass).box(0,y,-3.02,8.8,.43,.08,glass)
      b.box(0,12.6,-1,1.7,1.7,.2,'#bd6d5d').box(0,12.6,-.87,.95,.26,.05,white).box(0,12.6,-.87,.26,.95,.05,white)
      b.box(0,1,4.6,4,2,.5,glass).box(0,2.3,5,5,.25,2,white);break
    }
    case 'atlAirport': {
      b.box(0,.14,0,40,.2,22,'#a3aca1')
      for(const z of [-9,9]){b.box(0,.28,z,40,.08,2,'#65726e');for(let x=-18;x<19;x+=3)b.box(x,.34,z,1.4,.02,.08,white)}
      b.box(0,1,0,35,2,2.5,'#e0ded2')
      for(let x=-15;x<=15;x+=5){b.box(x,.85,0,2,1.7,14,white);for(let z=-5;z<=5;z+=2)b.box(x+(z>0?1.5:-1.5),.9,z,1.5,.2,.5,'#94a6a7')}
      b.cylinder(17,3.2,3,.45,6.4,'#bcc8c3',10).cylinder(17,6.9,3,1.2,1.2,glass,8,1.4).cylinder(17,7.6,3,1.5,.25,white,8)
      for(const [x,z] of [[-11,5],[1,-5],[12,5]]){b.box(x,1.3,z,.4,.3,2.8,white).box(x,1.3,z,2.7,.12,.5,white).box(x,1.7,z-.9,.12,.7,.6,white)}
      break
    }
    default: throw Error(`Missing architecture: ${id}`)
  }
  return b.build()
}
