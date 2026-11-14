import {createCompanion} from '../src/haggy/companion';
const args=process.argv.slice(2),origins:string[]=[];let port=3211;
for(let i=0;i<args.length;i++){if(args[i]==='--origin'){const url=new URL(args[++i]!);if(url.origin!==args[i])throw Error('Use an exact origin, with no path.');origins.push(url.origin);}else if(args[i]==='--port'){port=Number(args[++i]);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose a port from 1024 to 65535.');}else throw Error('Usage: npm run haggy:connect -- [--origin https://your-haggs.example] [--port 3211]');}
const printCode=(code:string)=>process.stdout.write(`\nPairing code (valid 10 minutes): ${code.match(/.{1,4}/g)!.join('-')}\nEnter it only in Haggy → Connect my AI. Do not send it in chat.\n`);
const app=createCompanion({origins,onPairCode:printCode});
app.server.on('error',()=>{process.stderr.write('Haggy connector could not listen. The port may already be in use.\n');process.exitCode=1;});
app.server.listen(port,'127.0.0.1',()=>{process.stdout.write(`Haggy personal AI connector: http://127.0.0.1:${port}\nUse your own Claude Code or Codex desktop login. No model runs until you send a message.\n`);printCode(app.pairCode());});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{app.stop();});
