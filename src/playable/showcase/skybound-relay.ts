import type { CodeSpec } from '../spec';

/** Original Haggs starter. Procedural meshes and local synth; no generated assets or provider calls. */
export const SKYBOUND_RELAY: CodeSpec = {
  version: 2, template: 'code', title: 'Skybound Relay', genre: '3D adventure',
  pitch: 'Restore three sky beacons, dodge the sentinels and bring the relay home through a floating garden.',
  controls: 'WASD or arrows to move · Space to jump · R to return to a beacon',
  aspect: '16:9', three: true, touch: 'pad',
  palette: { sky: '#102832', ground: '#264b40', accent: '#8df5b3', text: '#f4ffe9' }, art: { assets: [] },
  code: String.raw`
const W=HAGGS.W,H=HAGGS.H,rnd=HAGGS.rand(21);
const renderer=new THREE.WebGLRenderer({canvas:HAGGS.canvas,antialias:true});renderer.setSize(W,H,false);renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.shadowMap.enabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color('#142e39');scene.fog=new THREE.FogExp2('#142e39',.018);
const camera=new THREE.PerspectiveCamera(48,W/H,.1,180);const hemi=new THREE.HemisphereLight('#d9fff0','#334036',2.4);scene.add(hemi);
const sun=new THREE.DirectionalLight('#ffe4aa',3);sun.position.set(-12,24,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;scene.add(sun);
function mat(c){return new THREE.MeshStandardMaterial({color:c,roughness:.88});}
function box(w,h,d,x,y,z,color){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
const pads=[{x:0,z:10},{x:0,z:-2},{x:0,z:-14}];
pads.forEach((p,i)=>{box(12,1.1,10,p.x,-.6,p.z,'#426d54');const rock=new THREE.Mesh(new THREE.ConeGeometry(8,9,5),mat('#334d4b'));rock.rotation.z=Math.PI;rock.position.set(p.x,-5,p.z);scene.add(rock);for(let j=0;j<10;j++){const x=p.x+(rnd()-.5)*10,z=p.z+(rnd()-.5)*8;if(Math.abs(x)<2)continue;box(.22,1.5,.22,x,.75,z,'#735647');const bush=new THREE.Mesh(new THREE.ConeGeometry(.8,2,5),mat(i===1?'#79a873':'#599780'));bush.position.set(x,2,z);scene.add(bush);}});
box(3,.25,4,0,-.12,4,'#ae9272');box(3,.25,4,0,-.12,-8,'#ae9272');
const beacons=pads.map((p,i)=>{box(1.8,.4,1.8,0,.2,p.z-2,'#b3a47b');const orb=new THREE.Mesh(new THREE.OctahedronGeometry(.7),new THREE.MeshStandardMaterial({color:'#d5fba7',emissive:'#78b96a',emissiveIntensity:1.1}));orb.position.set(0,1.7,p.z-2);scene.add(orb);return {orb,on:false,z:p.z-2};});
const portal=box(2.6,3,.3,0,1.5,-18,'#425766');
const player=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.35,.7,4,8),mat('#edf7d3'));body.position.y=.75;body.castShadow=true;player.add(body);const pack=new THREE.Mesh(new THREE.BoxGeometry(.6,.6,.3),mat('#e9a775'));pack.position.set(0,.8,.4);player.add(pack);player.position.set(0,0,12);scene.add(player);
const enemies=[-1,-13].map((z,i)=>{const o=new THREE.Mesh(new THREE.IcosahedronGeometry(.6),mat('#ed9879'));o.position.set(2,1,z);scene.add(o);return {o,z,phase:i*2};});
let score=0,lives=4,vy=0,ground=true,inv=0,checkpoint=12,timer=0,lastStage=-1;
HAGGS.music('calm');HAGGS.score(0);
function reset(){player.position.set(0,0,checkpoint);vy=0;ground=true;inv=1.5;}
HAGGS.start({update(dt){timer+=dt;inv=Math.max(0,inv-dt);const axis=HAGGS.axis();const speed=4.4+beacons.filter(b=>b.on).length*.35;
player.position.x+=axis.x*speed*dt;player.position.z+=axis.y*speed*dt;player.position.x=Math.max(-6.5,Math.min(6.5,player.position.x));player.position.z=Math.max(-19,Math.min(15,player.position.z));
if(HAGGS.pressed('a')&&ground){vy=5.8;ground=false;HAGGS.sound('jump');}if(HAGGS.pressed('KeyR')||HAGGS.pressed('b'))reset();vy-=14*dt;player.position.y+=vy*dt;
const floor=pads.some(p=>Math.abs(player.position.x-p.x)<=6&&Math.abs(player.position.z-p.z)<=5)||Math.abs(player.position.x)<=1.5&&(player.position.z>=-10&&player.position.z<=6);
if(floor&&player.position.y<=0&&vy<=0){player.position.y=0;vy=0;ground=true;}else if(!floor)ground=false;
if(player.position.y<-7){lives--;HAGGS.sound('hit');if(lives<=0){HAGGS.end({won:false,score});return;}reset();}
if(Math.abs(axis.x)+Math.abs(axis.y)>.1){player.rotation.y=Math.atan2(axis.x,axis.y);body.rotation.z=Math.sin(timer*13)*.06;}
beacons.forEach((b,i)=>{b.orb.rotation.y+=dt;b.orb.position.y=1.7+Math.sin(timer*2+i)*.2;if(!b.on&&Math.hypot(player.position.x,player.position.z-b.z)<1.4){b.on=true;score+=100;checkpoint=b.z;HAGGS.score(score);HAGGS.sound('powerup');b.orb.material.emissive.set('#47e6a7');}});
enemies.forEach(e=>{e.o.position.x=Math.sin(timer*(1+score/450)+e.phase)*4;e.o.rotation.y+=dt;if(inv<=0&&Math.hypot(player.position.x-e.o.position.x,player.position.z-e.z)<1.05&&player.position.y<1){lives--;inv=2;HAGGS.sound('hit');if(lives<=0)HAGGS.end({won:false,score});}});
const stage=beacons.filter(b=>b.on).length;if(stage!==lastStage){lastStage=stage;if(stage===3){portal.material.color.set('#8df5b3');HAGGS.sound('win');}}
if(stage===3&&player.position.z<-17&&Math.abs(player.position.x)<1.6){HAGGS.end({won:true,score:score+lives*25});return;}
body.visible=inv<=0||Math.floor(timer*10)%2===0;
const target=new THREE.Vector3(player.position.x*.45,player.position.y+8,player.position.z+11);camera.position.lerp(target,1-Math.exp(-dt*4));camera.lookAt(player.position.x*.55,.6,player.position.z-2);
},draw(){renderer.render(scene,camera);HAGGS.text('SKYBOUND RELAY',24,32,{ctx:HAGGS.hud,size:22});HAGGS.text('Beacons '+beacons.filter(b=>b.on).length+'/3   Lives '+lives,24,61,{ctx:HAGGS.hud,size:17});HAGGS.text(beacons.every(b=>b.on)?'The relay is lit. Reach the green gate.':'Follow the bridges. Touch the three light crystals.',W/2,H-28,{ctx:HAGGS.hud,size:16,align:'center'});}});
` };
