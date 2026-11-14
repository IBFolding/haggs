/** Job-scoped MCP tools. No filesystem, shell, generation, deletion or credentials exposed to the model. */
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema,ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {HAGGY_TOOLS} from '../src/agent/tool-definitions';
const url=process.env.HAGGY_BRIDGE_URL,token=process.env.HAGGY_JOB_TOKEN;
if(!url||!token||!/^http:\/\/127\.0\.0\.1:\d+\/runner\/[\w-]+$/.test(url))throw Error('Start these MCP tools through the Haggy connector.');
const server=new Server({name:'haggs',version:'1.0.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:HAGGY_TOOLS.map(t=>({name:t.name,description:t.description,inputSchema:t.input_schema}))}));
server.setRequestHandler(CallToolRequestSchema,async request=>{
 if(!HAGGY_TOOLS.some(t=>t.name===request.params.name))return {isError:true,content:[{type:'text',text:'Unsupported Haggs tool.'}]};
 try{const response=await fetch(url,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({name:request.params.name,input:request.params.arguments??{}}),signal:AbortSignal.timeout(100000)});const body=await response.json();return {content:[{type:'text',text:JSON.stringify(body.result??body).slice(0,60000)}],...(body.error||!response.ok?{isError:true}:{})};}
 catch{return {isError:true,content:[{type:'text',text:'The Haggy browser connection stopped. Do not repeat an uncertain edit.'}]};}
});
await server.connect(new StdioServerTransport());
