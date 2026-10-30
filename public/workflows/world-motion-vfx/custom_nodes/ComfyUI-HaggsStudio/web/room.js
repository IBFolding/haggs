// Shared playable proxy: no external libraries. Eden standalone-host observation contract.
export const INITIAL={x:1.1,z:1.1,orbs:[false,false,false],won:false,tick:0};
export const BLOCKS=[{x:2,z:1.5,w:1,h:2},{x:4.2,z:3.7,w:1.4,h:.8}];
export const ORBS=[[5.8,1.1],[1.2,5.4],[5.6,5.4]];
const copy=()=>JSON.parse(JSON.stringify(INITIAL));
export function solid(x,z){const r=.19;return x<r||z<r||x>7-r||z>7-r||BLOCKS.some(b=>x>b.x-r&&x<b.x+b.w+r&&z>b.z-r&&z<b.z+b.h+r);}
export function step(state,keys,dt){
  const s={...state,orbs:[...state.orbs]};s.tick++;
  if(s.won)return s;
  let dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  let dz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
  const length=Math.hypot(dx,dz)||1;dx=dx/length*dt*2.5;dz=dz/length*dt*2.5;
  if(!solid(s.x+dx,s.z))s.x+=dx;if(!solid(s.x,s.z+dz))s.z+=dz;
  ORBS.forEach(([x,z],i)=>{if(Math.hypot(x-s.x,z-s.z)<.43)s.orbs[i]=true;});s.won=s.orbs.every(Boolean);return s;
}

export function draw(canvas,state,theme='dungeon',character='knight'){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const palettes={dungeon:['#182032','#637183','#90a5ba'],temple:['#062c3a','#247d86','#8adbc6'],spaceship:['#11162c','#414a75','#b8bef1']};
  const [bg,floor,wall]=palettes[theme]||palettes.dungeon;
  c.fillStyle=bg;c.fillRect(0,0,w,h);
  const project=(x,z,y=0)=>[w/2+(x-z)*w/18,h*.19+(x+z)*h/23-y*h/10];
  const polygon=(pts,color)=>{c.fillStyle=color;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill();c.strokeStyle='#172132';c.stroke();};
  const block=(x,z,bw,bh,y,color)=>{
    polygon([project(x,z,y),project(x+bw,z,y),project(x+bw,z+bh,y),project(x,z+bh,y)],color);
    polygon([project(x,z+bh,y),project(x+bw,z+bh,y),project(x+bw,z+bh),project(x,z+bh)],'#354558');
    polygon([project(x+bw,z,y),project(x+bw,z+bh,y),project(x+bw,z+bh),project(x+bw,z)],'#263344');
  };
  polygon([project(0,0),project(7,0),project(7,7),project(0,7)],floor);
  for(let i=0;i<=7;i++){c.strokeStyle='#324455';c.beginPath();c.moveTo(...project(i,0));c.lineTo(...project(i,7));c.stroke();c.beginPath();c.moveTo(...project(0,i));c.lineTo(...project(7,i));c.stroke();}
  block(0,0,7,.12,1,wall);block(0,0,.12,7,1,wall);
  const entities=BLOCKS.map(b=>({...b,type:'block'}));entities.push({x:state.x,z:state.z,type:'hero'});
  entities.sort((a,b)=>a.x+a.z-b.x-b.z);
  for(const e of entities){
    if(e.type==='block')block(e.x,e.z,e.w,e.h,1.05,wall);
    else{const [x,y]=project(e.x,e.z,.6);c.fillStyle={knight:'#edc77a',mage:'#b194f9',robot:'#7ae1dd'}[character]||'#edc77a';c.fillRect(x-9,y-5,18,28);c.beginPath();c.arc(x,y-12,10,0,Math.PI*2);c.fill();c.fillStyle='#172133';c.fillRect(x-6,y-15,12,4);}
  }
  ORBS.forEach(([x,z],i)=>{if(!state.orbs[i]){const p=project(x,z,.15);c.fillStyle='#8affbc';c.beginPath();c.arc(...p,7,0,Math.PI*2);c.fill();}});
}

export async function mountRoom(canvas,status,{session='',theme='dungeon',character='knight'}={}){
  let state=copy(),keys=new Set(),frames=[],recording=false,elapsed=0,last=0,acc=0;
  canvas.tabIndex=0;
  canvas.onkeydown=e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.code)){e.preventDefault();keys.add(e.code);}if(e.code==='Enter'){state=copy();keys.clear();}};
  canvas.onkeyup=e=>keys.delete(e.code);canvas.onblur=()=>keys.clear();
  canvas.onclick=()=>canvas.focus();
  const events=[];
  window.__gameTest={read:()=>({state:state.won?'WON':'RUNNING',player:{x:state.x,z:state.z},orbs:state.orbs,events:[...events],frame:state.tick,clock:state.tick/60}),reset:()=>{state=copy();}};
  // Eden's standalone host dispatches keyboard events at document/window scope.
  window.addEventListener('keydown',e=>{if(e.code)keys.add(e.code);if(e.code==='Enter')state=copy();});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  function loop(now){
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;acc+=dt;
    while(acc>=1/60){const before=state.orbs.filter(Boolean).length;state=step(state,keys,1/60);if(state.orbs.filter(Boolean).length>before)events.push({type:'orb.collected',time:state.tick/60});acc-=1/60;}
    draw(canvas,state,theme,character);
    if(recording){elapsed+=dt;while(frames.length<Math.floor(elapsed*24)&&frames.length<120)frames.push(canvas.toDataURL('image/jpeg',.82));if(frames.length>=120){recording=false;upload().catch(e=>status.textContent=e.message);}}
    if(!recording&&!status.dataset.saving)status.textContent=state.won?'All crystals collected! Enter restarts.':'Proxy preview • click room, use WASD • crystals '+state.orbs.filter(Boolean).length+'/3';
    requestAnimationFrame(loop);
  }
  async function upload(){
    status.dataset.saving='yes';status.textContent='Saving 5-second proxy recording…';
    try{const r=await fetch('/haggs-studio/session/'+session+'/record',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({frames,fps:24,events})});const j=await r.json();if(!r.ok)throw Error(j.error||'Recording failed');status.textContent='Saved '+j.frames+' frames. Queue Eden Replay in ComfyUI.';}
    catch(e){status.textContent=e.message;throw e;}
    finally{setTimeout(()=>{delete status.dataset.saving;},5000);}
  }
  requestAnimationFrame(loop);
  return {read:()=>state,startRecording:()=>{if(!session)throw Error('Create a ComfyUI session first');if(recording)return;frames=[];elapsed=0;recording=true;canvas.focus();},reset:()=>{state=copy();keys.clear();}};
}
