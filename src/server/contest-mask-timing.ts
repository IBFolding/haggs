import {execFile} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {ffprobeBin} from './ffmpeg';

const exec = promisify(execFile);
/** Fail closed unless every frame has the same relative timestamp in each input. */
export function assertAlignedFrameTimes(streams: number[][]) {
  if (streams.length !== 3 || streams.some(s => s.length < 2 || s.length > 1200 || s.some((n,i) => !Number.isFinite(n) || (i > 0 && n <= s[i-1]!)))) throw new Error('Could not verify mask video timing. Use clips with 2–1,200 decodable frames and valid timestamps. No generation was started.');
  const reference = streams[0]!;
  for (const stream of streams.slice(1)) {
    if (stream.length !== reference.length) throw new Error('The source, effect layer and tracked mask must have the same number of frames. No generation was started.');
    const start = stream[0]!, referenceStart = reference[0]!;
    if (stream.some((t,i) => Math.abs((t - start) - (reference[i]! - referenceStart)) > 0.002)) throw new Error('The source, effect layer and tracked mask must have matching frame timing. No generation was started.');
  }
}
export async function assertAlignedVideos(inputs: Uint8Array[]) {
  const dir = await mkdtemp(join(tmpdir(), 'haggs-mask-'));
  try {
    const streams: number[][] = [];
    let dimensions: string | undefined;
    for (let i=0;i<inputs.length;i++) {
      const path=join(dir,`input-${i}`);
      await writeFile(path,inputs[i]!);
      const {stdout}=await exec(ffprobeBin(), ['-v','error','-select_streams','v:0','-show_entries','stream=width,height:frame=best_effort_timestamp_time','-of','json',path], {timeout:30_000,maxBuffer:2_000_000});
      const result=JSON.parse(stdout) as {streams?:{width?:number;height?:number}[];frames?:{best_effort_timestamp_time?:string}[]};
      const stream=result.streams?.[0];
      if (!stream?.width || !stream.height) throw new Error('Could not verify mask video dimensions. No generation was started.');
      const size=`${stream.width}x${stream.height}`;
      if (dimensions && size !== dimensions) throw new Error('The source, effect layer and tracked mask must have matching dimensions. No generation was started.');
      dimensions=size;
      streams.push((result.frames ?? []).map(f => f.best_effort_timestamp_time === undefined ? NaN : Number(f.best_effort_timestamp_time)));
    }
    assertAlignedFrameTimes(streams);
  } catch (error) {
    if (error instanceof Error && /^(The source|Could not verify)/.test(error.message)) throw error;
    throw new Error('Could not verify tracked mask timing. Check that all three inputs are valid videos; no generation was started.');
  } finally { await rm(dir,{recursive:true,force:true}); }
}
