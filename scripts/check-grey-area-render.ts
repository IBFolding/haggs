import assert from 'node:assert/strict';
import sharp from 'sharp';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {greyPlan} from '../src/story/grey-render';
import {prepareGreyTexture} from '../src/server/grey-texture';
const dir=mkdtempSync(join(tmpdir(),'grey-area-'));
try {
 const room=join(dir,'room.png'),mask=join(dir,'mask.png'),ref=join(dir,'replacement.png'),out=join(dir,'out.mp4');
 await sharp({create:{width:80,height:80,channels:4,background:'#808080'}}).png().toFile(room);
 await sharp(Buffer.from('<svg width="80" height="80"><rect x="20" y="20" width="40" height="40" fill="#808080"/></svg>')).png().toFile(mask);
 await sharp({create:{width:40,height:80,channels:4,background:'#ff0000'}}).png().toFile(ref);
 const scene={source:{url:room,kind:'image' as const},surfaces:[{id:'door',label:'Door',strength:1,mode:'replace' as const,selection:{aspect:1,points:[{x:.25,y:.25},{x:.75,y:.25},{x:.75,y:.75},{x:.25,y:.75}]},mask:{url:mask,kind:'image' as const,at:1,price:'manual'},texture:{url:ref,name:'Door',scale:1}}]};
 const plan=greyPlan(scene,{w:128,h:80},1,room);
 const paths:string[]=[];
 for (const [i,input] of plan.inputs.entries()) {
  if(input.role==='texture') { const target=join(dir,`texture-${i}.png`); await prepareGreyTexture(input,input.ref,{w:128,h:80},target); paths.push(target); }
  else paths.push(input.ref);
 }
 execFileSync('ffmpeg',['-y','-v','error',...plan.inputs.flatMap((i,n)=>[...i.args,'-i',paths[n]!]),'-filter_complex',plan.filter,'-map','[out]','-t','1','-c:v','libx264','-pix_fmt','yuv420p',out]);
 const rgb=execFileSync('ffmpeg',['-v','error','-i',out,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
 const pixel=(x:number,y:number)=>Array.from(rgb.subarray((y*128+x)*3,(y*128+x)*3+3));
 const untouched=pixel(32,12),replacement=pixel(64,40),outside=pixel(96,60);
 assert.ok(Math.abs(untouched[0]!-untouched[1]!)<6,'unselected image stays neutral');
 assert.ok(replacement[0]!>replacement[1]!+150,'selected region uses replacement image');
 assert.ok(Math.abs(outside[0]!-outside[1]!)<6,'replacement stays inside selected area');
 console.log('Area replacement FFmpeg render passed',{untouched,replacement,outside});
} finally {rmSync(dir,{recursive:true,force:true});}
