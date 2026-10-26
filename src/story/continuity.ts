import type {Project,Shot} from "./model";
import {clipSeconds} from "./cut";
import {getModelCard} from "../catalog/models";
export function acceptsStartFrame(shot:Shot):boolean {try { const c=getModelCard(shot.model.id);return c.inputImages>0&&(c.capability==="image-to-video"||c.capability==="text-to-video"); } catch { return false; }}
export function continuityStale(project:Project,shot:Shot):boolean {
 const d=shot.startsFrom;if(!d)return false;const index=project.shots.findIndex(s=>s.id===shot.id);const source=project.shots[index-1];
 return !source?.render||source.id!==d.shotId||source.render.url!==d.sourceUrl||source.render.at!==d.sourceAt||(source.trimIn??0)!==d.from||clipSeconds(source)!==d.seconds;
}
export function previousClip(project:Project,shotId:string):Shot {
 const i=project.shots.findIndex(s=>s.id===shotId);if(i<=0)throw Error("The first shot has no previous shot.");const s=project.shots[i-1]!;
 if(s.render?.kind!=="video")throw Error("The previous shot needs a selected video clip before its last frame can be used.");return s;
}
