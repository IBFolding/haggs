import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
/** Decode the selected range, retaining the actual final decoded frame. */
export async function extractTerminalFrame(binary:string,source:string,output:string,from:number,seconds:number):Promise<void>{
  if(!Number.isFinite(from)||from<0||from>7200||!Number.isFinite(seconds)||seconds<=0||seconds>120)throw Error('Invalid clip range');
  await execute(binary,['-loglevel','error','-y','-ss',String(from),'-i',source,'-t',String(seconds),'-an','-fps_mode','passthrough','-update','1',output],{timeout:120000});
}
