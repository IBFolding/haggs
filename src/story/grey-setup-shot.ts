import {commit,view} from "./boards";
import {defaultGrey} from "./grey";
import {normalizeScene,type GreyScene} from "./grey-scene";
import {newShot,type Project} from "./model";
/** A new, unrendered shot reuses staging without borrowing footage-bound masks or approvals. */
export function appendGreySetupShot(project:Project,boardId:string|undefined,shotId:string,scene:GreyScene,heading:string,beat:string) {
 const title=heading.trim().slice(0,160);if(!title)throw Error("Give the new shot a name.");
 const board=view(project,boardId),source=board.shots.find(s=>s.id===shotId);if(!source)throw Error("The source shot is no longer available.");
 const {source:_footage,matte:_matte,surfaces,...set}=structuredClone(normalizeScene(scene));
 const greyScene:GreyScene={...set,...(surfaces?{surfaces:surfaces.map(({mask:_mask,selection:_selection,...surface})=>({...surface,mode:"material" as const}))}:{})};
 const shot={...newShot(),heading:title,beat:beat.trim().slice(0,4000)||source.beat,seconds:source.seconds,threadIds:[...source.threadIds],model:structuredClone(source.model),grey:structuredClone(source.grey??defaultGrey()),greyScene};
 const at=board.shots.findIndex(s=>s.id===shotId);
 const next={...board,shots:[...board.shots.slice(0,at+1),shot,...board.shots.slice(at+1)]};
 return {project:commit(project,boardId,next),shot};
}
