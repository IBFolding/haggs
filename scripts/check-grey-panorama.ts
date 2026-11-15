/** Optional local renderer proof. No model inference, network requests or provider charges. */
import {mkdtemp,mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import ffmpeg from 'ffmpeg-static';
import {blenderManifest,BLENDER_SCRIPT} from '../src/story/grey-blender';
import {defaultGrey} from '../src/story/grey';
const run=promisify(execFile),directory=await mkdtemp(join(tmpdir(),'haggs-panorama-proof-'));
if(!ffmpeg)throw Error('FFmpeg is unavailable. Rebuild ffmpeg-static before this check.');
const blender=process.env.BLENDER_BIN||'/Applications/Blender.app/Contents/MacOS/Blender';
const width=1024,height=512,pixels=Buffer.alloc(width*height*3);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const at=(y*width+x)*3;pixels[at]=x%64<4?255:Math.floor(x*255/width);pixels[at+1]=y%64<4?255:Math.floor(y*255/height);pixels[at+2]=80;}
await writeFile(join(directory,'sky.ppm'),Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`),pixels]));
await run(ffmpeg,['-y','-v','error','-i',join(directory,'sky.ppm'),'-frames:v','1',join(directory,'sky.png')]);
await run(ffmpeg,['-y','-v','error','-f','lavfi','-i','color=c=black@0:s=16x16,format=rgba','-frames:v','1',join(directory,'actor.png')]);
const manifest=blenderManifest({panorama:{url:'/sky.png',name:'Synthetic panorama fixture',yaw:35,exposure:0,showFloor:false}},{name:'Panorama renderer proof',size:{w:320,h:180},seconds:1/24,fps:24,footage:{url:'/actor.png',kind:'image'},grey:defaultGrey()});
await mkdir(join(directory,'assets'));
await copyFile(join(directory,'sky.png'),join(directory,manifest.panorama!.file));await copyFile(join(directory,'actor.png'),join(directory,manifest.actor!.file));
await writeFile(join(directory,'scene.json'),JSON.stringify(manifest));await writeFile(join(directory,'build_scene.py'),BLENDER_SCRIPT);
const result=await run(blender,['-b','--python-exit-code','1','-P',join(directory,'build_scene.py'),'-o',join(directory,'verified-####'),'-F','PNG','-f','1'],{timeout:120000,maxBuffer:4*1024*1024});
if(/Traceback|Error: Python/.test(result.stdout+result.stderr)||!result.stdout.includes('Haggs set ready'))throw Error('Blender did not complete the scene builder. A partial frame does not count as a pass.');
const image=await readFile(join(directory,'verified-0001.png'));
if(!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||image.readUInt32BE(16)!==320||image.readUInt32BE(20)!==180)throw Error('Expected a real 320×180 PNG result.');
const output=resolve('output/grey-panorama-check');await mkdir(output,{recursive:true});await writeFile(join(output,'verified.png'),image);await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2));
await writeFile(join(output,'receipt.json'),JSON.stringify({kind:'local-Blender-fixture',builderCompleted:true,pythonErrorsFatal:true,width:320,height:180,modelInference:false,providerCharges:false},null,2));
console.log(`Blender scene build and actual PNG render verified. Evidence: ${output}`);
