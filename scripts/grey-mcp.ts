import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {AgentStore} from '../src/server/agent-remote';
import {view} from '../src/story/boards';
import {sceneForShot} from '../src/story/grey-source';
import {applyGreyActions,greyActionsSchema,sceneRevision} from '../src/story/grey-actions';

/** Local proposal transport only until the coordinated hosted schema supports Grey Room. */
export function registerGreyTools(server:McpServer,store:AgentStore,local:boolean){
 const text=(value:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(value)}]});
 const fail=(e:unknown)=>({isError:true,content:[{type:'text' as const,text:e instanceof Error?e.message:'Scene request failed.'}]});
 async function read(project:string,board:string,shot:string){
  const snap=await store.load(project);if(!snap)throw new Error('Project not accessible. Open it in Haggs first.');
  if(snap.project.boards?.length ? !snap.project.boards.some(b=>b.id===board) : board!=='main')throw new Error('Board not found.');
  const found=view(snap.project,board).shots.find(s=>s.id===shot);if(!found)throw new Error('Shot not found on this board.');
  return sceneForShot(found);
 }
 server.registerTool('haggs_get_grey_scene',{description:'Read one editable Grey Room scene and exact revision. Image props and lights are 2D preview layers, not 3D. Read before proposing changes. No generation or charges.',inputSchema:{project:z.string(),board:z.string(),shot:z.string()},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async({project,board,shot})=>{try{const scene=await read(project,board,shot);return text({scene,revision:sceneRevision(scene),representation:'2d-composite',proposalTransport:local?'local':'unavailable',supportedActions:['object.add','object.move','object.scale','object.rotate','object.remove','lighting.add','lighting.adjust']});}catch(e){return fail(e);}});
 server.registerTool('haggs_propose_grey_edits',{description:'Propose object/light edits for a local Grey Room shot. Requires revision from haggs_get_grey_scene. The user reviews and applies in Grey Room; no scene is changed by this tool. No paid jobs, camera solving or physical relighting.',inputSchema:{project:z.string(),board:z.string(),shot:z.string(),revision:z.string().max(2_000_000),summary:z.string().min(1).max(240),actions:greyActionsSchema},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},async({project,board,shot,revision,summary,actions})=>{try{if(!local)throw new Error('Grey Room proposals currently require the local bridge. Hosted routing is not enabled.');const scene=await read(project,board,shot);if(revision!==sceneRevision(scene))throw new Error('Scene changed. Read it again before proposing.');applyGreyActions(scene,actions);const sent=await store.propose(project,{kind:'grey',boardId:board,summary,payload:{shotId:shot,revision,actions}});return text({id:sent.id,next:'In Grey Room, open Quick commands & MCP assistance, check proposals, then review and apply.'});}catch(e){return fail(e);}});
}
