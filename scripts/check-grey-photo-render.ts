import sharp from 'sharp';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {greyPlan} from '../src/story/grey-render';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'grey-photo-'));
try {
 const room=join(dir,'room.png'),mask=join(dir,'mask.png'),tex=join(dir,'tex.png'),out=join(dir,'out.mp4');
 await sharp({create:{width:64,height:64,channels:4,background:'#808080'}}).png().toFile(room);
 await sharp(Buffer.from('<svg width="64" height="64"><rect y="32" width="64" height="32" fill="#808080"/></svg>')).png().toFile(mask);
 await sharp({create:{width:64,height:64,channels:4,background:'#ff0000'}}).png().toFile(tex);
 const scene={source:{url:room,kind:'image' as const},surfaces:[{id:'floor',label:'Floor',strength:1,mask:{url:mask,kind:'image' as const,at:1,price:'test'},texture:{url:tex,name:'Red',scale:1}}]};
 const p=greyPlan(scene,{w:64,h:64},1,room);
 execFileSync('ffmpeg',['-y','-v','error',...p.inputs.flatMap(i=>[...i.args,'-i',i.ref]),'-filter_complex',p.filter,'-map','[out]','-t','1','-c:v','libx264','-pix_fmt','yuv420p',out]);
 const rgb=execFileSync('ffmpeg',['-v','error','-i',out,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
 const pixel=(x:number,y:number)=>Array.from(rgb.subarray((y*64+x)*3,(y*64+x)*3+3));
 const wall=pixel(32,16),floor=pixel(32,48);
 assert.ok(Math.abs(wall[0]!-wall[1]!)<6,'wall must stay neutral');
 assert.ok(floor[0]!>floor[1]!+100,'only selected floor becomes red');
 console.log('Real FFmpeg photo render passed:',{wall,floor});
} finally {rmSync(dir,{recursive:true,force:true});}
