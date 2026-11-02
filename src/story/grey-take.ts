import type { GreyFrame } from "./grey";
import type { Shot } from "./model";
import type { GreyScene } from "./grey-scene";
import { addTake } from "./takes";
/** A completed request remembers its own input scene without undoing edits made while it ran. */
export function addGreyTake(shot: Shot, render: NonNullable<Shot["render"]>, origin: string, producedScene: GreyScene, currentScene: GreyScene, producedFrame?: GreyFrame, time=0): Shot {
  const next=addTake(shot,render,origin,producedScene);
  const greySetup=structuredClone({...(producedFrame?{frame:producedFrame}:{}),scene:producedScene,time:Number.isFinite(time)?Math.max(0,time):0});
  next.takes=next.takes!.map((take,i,all)=>i===all.length-1?{...take,greySetup}:take);
  return {...next,greyScene:currentScene};
}

/** Restore input staging explicitly; selected media, takes, trims and approvals remain current. */
export function restoreGreyTakeSetup(shot:Shot,takeId:string):Shot {
  const setup=shot.takes?.find(t=>t.id===takeId)?.greySetup;
  if(!setup)return shot;
  const {frame,scene}=structuredClone(setup);
  return {...shot,...(frame?{grey:frame}:{}),greyScene:scene};
}
