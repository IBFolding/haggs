import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ffmpegBin} from './ffmpeg';
import {assertAlignedFrameTimes, assertAlignedVideos} from './contest-mask-timing';

test('tracked masks require three streams with matching frame timestamps', () => {
  assert.doesNotThrow(()=>assertAlignedFrameTimes([[0,.5,1],[1,1.5,2],[0,.5,1]]));
  assert.throws(()=>assertAlignedFrameTimes([[0,.5],[0,.5],[0]]));
  assert.throws(()=>assertAlignedFrameTimes([[0,.5],[0,.4],[0,.5]]),/matching frame timing/);
  assert.throws(()=>assertAlignedFrameTimes([[0,.5],[0,0],[0,.5]]));
});
test('real videos with matching frames pass, but different rate or size fail', async () => {
  const dir = await mkdtemp(join(tmpdir(),'mask-test-'));
  try {
    const make = async (name:string,rate:number,size:string) => {
      const path=join(dir,name);
      execFileSync(ffmpegBin(),['-v','error','-f','lavfi','-i',`color=black:s=${size}:r=${rate}:d=1`,'-c:v','libx264','-pix_fmt','yuv420p',path]);
      return readFile(path);
    };
    const same=await make('same.mp4',2,'64x64');
    const wrongRate=await make('rate.mp4',3,'64x64');
    const wrongSize=await make('size.mp4',2,'96x64');
    await assertAlignedVideos([same,same,same]);
    await assert.rejects(assertAlignedVideos([same,same,wrongRate]),/same number of frames|matching frame timing/);
    await assert.rejects(assertAlignedVideos([same,same,wrongSize]),/matching dimensions/);
  } finally {await rm(dir,{recursive:true,force:true});}
});
