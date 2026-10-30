import {test} from 'node:test';
import assert from 'node:assert/strict';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {registerGreyTools} from '../../scripts/grey-mcp';
import {createAgentStore} from './agent-remote';
import {writeSnapshot,inbox} from './bridge';
import {addProp} from '../story/grey-scene';
import {createProject,newShot} from '../story/model';

test('MCP scene read → validated proposal → inbox; stale and wrong-board edits rejected',async()=>{
 const root=await mkdtemp(join(tmpdir(),'grey-mcp-'));
 const server=new McpServer({name:'test',version:'1'}),client=new Client({name:'test',version:'1'});
 try{
  const project=createProject('Grey test'),shot=newShot();shot.greyScene=addProp({}, {name:'Lamp',url:'/lamp.png'});project.shots=[shot];
  await writeSnapshot(root,{project,sheets:null});
  registerGreyTools(server,createAgentStore(root,{}),true);
  const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(b);await client.connect(a);
  const tools=await client.listTools();assert.equal(tools.tools.length,2);
  const read=await client.callTool({name:'haggs_get_grey_scene',arguments:{project:project.id,board:'main',shot:shot.id}});
  const parsed=JSON.parse((read.content as {text:string}[])[0]!.text);
  const args={project:project.id,board:'main',shot:shot.id,revision:parsed.revision,summary:'Shrink lamp',actions:[{type:'object.scale',id:shot.greyScene.props![0]!.id,factor:.5}]};
  const proposed=await client.callTool({name:'haggs_propose_grey_edits',arguments:args});assert.notEqual(proposed.isError,true);
  const pending=await inbox(root,project.id);assert.equal(pending.length,1);assert.equal(pending[0]!.kind,'grey');
  assert.equal(shot.greyScene.props![0]!.w,.25,'proposing must not change the scene');
  const stale=await client.callTool({name:'haggs_propose_grey_edits',arguments:{...args,revision:'old'}});assert.equal(stale.isError,true);
  const wrong=await client.callTool({name:'haggs_get_grey_scene',arguments:{project:project.id,board:'other',shot:'missing'}});assert.equal(wrong.isError,true);
 }finally{await client.close();await server.close();await rm(root,{recursive:true,force:true});}
});
