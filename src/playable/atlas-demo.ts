import { readSpec, type Art, type CodeSpec } from './spec';

/** Hand-authored free demo: supplied deterministic guide exports, never model inference. */
export function atlasDemo(hero: Art, effect: Art): CodeSpec {
  return readSpec({ template: 'code', version: 2, title: 'Game Director atlas playground',
    pitch: 'Move a pose-guide character through a telegraph VFX preview. Deterministic workflow samples, not H3 footage.',
    genre: 'Animation playground', controls: 'Arrows / WASD to move, or tap a destination', aspect: '16:9', three: false, touch: 'tap',
    art: { assets: [{ ...hero, id: 'hero', label: 'Hero', kind: 'sprite' }, { ...effect, id: 'effect', label: 'Effect', kind: 'sprite' }] },
    code: `let x=240,y=300,target=null;
HAGGS.start({update(dt){
 const a=HAGGS.axis(); if(a.x||a.y){target=null;x+=a.x*240*dt;y+=a.y*240*dt;}
 if(HAGGS.pointer.pressed)target={x:HAGGS.pointer.x,y:HAGGS.pointer.y};
 if(target){const dx=target.x-x,dy=target.y-y,d=Math.hypot(dx,dy),step=Math.min(d,240*dt);if(d>1){x+=dx/d*step;y+=dy/d*step;}else target=null;}
 x=HAGGS.clamp(x,64,HAGGS.W-64);y=HAGGS.clamp(y,120,HAGGS.H-64);
},draw(){const g=HAGGS.ctx;g.fillStyle='#151c2c';g.fillRect(0,0,HAGGS.W,HAGGS.H);
 HAGGS.draw('effect',650,320,320,320);HAGGS.draw('hero',x,y,180,180);
 HAGGS.text('Game Director → Playable',32,42,{size:26});
 HAGGS.text('Deterministic guide atlases • no H3 generation',32,77,{size:17});
 HAGGS.text('Move with arrows or tap. Review actions and looping in Art.',32,HAGGS.H-25,{size:16});}});`
  }) as CodeSpec;
}
