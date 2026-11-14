/** Test-only runner: real MCP transport, deterministic model events, no AI API. */
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const provider=process.argv[2]??'claude';
let prompt='';for await(const part of process.stdin)prompt+=part.toString();
const project=/scoped to project ([^.]+)\./.exec(prompt)?.[1];if(!project)throw Error('Fixture needs a project.');
const write=(value:unknown)=>process.stdout.write(JSON.stringify(value)+'\n');
if(provider==='claude')write({type:'stream_event',event:{type:'content_block_delta',delta:{type:'text_delta',text:'I checked your selected project. '}}});
else write({type:'item.completed',item:{type:'agent_message',text:'I checked your selected project.'}});
if(process.env.HAGGY_FIXTURE_DELAY)await new Promise(resolve=>setTimeout(resolve,Number(process.env.HAGGY_FIXTURE_DELAY)));
process.stderr.write('fixture-private-diagnostic-not-for-browser\n');
const client=new Client({name:'haggy-fixture',version:'1'},{capabilities:{}}),loader=pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
const env=Object.fromEntries(Object.entries(process.env).filter(([,v])=>v!==undefined)) as Record<string,string>;
await client.connect(new StdioClientTransport({command:process.execPath,args:['--import',loader,fileURLToPath(new URL('../../../scripts/haggy-tools.ts',import.meta.url))],env,stderr:'pipe'}));
const tools=await client.listTools();if(!tools.tools.some(t=>t.name==='edit_shots'))throw Error('Missing MCP editing tool.');
const read=await client.callTool({name:'read_board',arguments:{project}});
const text=(read.content as {type:string;text?:string}[]).find(c=>c.type==='text')?.text??'{}';const board=JSON.parse(text);
if(!board.shots?.[0]?.id)throw Error('Fixture needs one shot.');
const outside=await client.callTool({name:'read_board',arguments:{project:'another-project'}});if(!outside.isError)throw Error('Cross-project tool call was allowed.');
const edit=await client.callTool({name:'edit_shots',arguments:{project,edits:[{shot:board.shots[0].id,seconds:2}]}});if(edit.isError)throw Error('MCP edit failed.');
if(provider==='claude'){write({type:'stream_event',event:{type:'content_block_delta',delta:{type:'text_delta',text:'The opening now holds for two seconds.'}}});write({type:'result',subtype:'success',is_error:false});}
else{write({type:'item.completed',item:{type:'agent_message',text:'The opening now holds for two seconds.'}});write({type:'turn.completed'});}
await client.close();
