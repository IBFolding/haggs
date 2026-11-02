import {camAt} from "./grey-camera";
import {figureSegments,type Segment} from "./grey-figure";
import {subjectFacing,type GreyFrame,type GreySubject} from "./grey";

export type FigureSample={frame:number;segments:Segment[]};
/** Bake the exact guide geometry at the export frame rate, including the moving-camera stop limit. */
export function bakeFigureMotion(grey:GreyFrame,subject:GreySubject,frames:number,fps:number):FigureSample[] {
 if(!Number.isInteger(frames)||frames<1||frames>2880||!Number.isFinite(fps)||fps<1||fps>60)throw Error("Walking export needs 1–2880 frames at 1–60 fps.");
 return Array.from({length:frames},(_,i)=>{
  const t=i/fps,cam=camAt(grey.cam,grey.camKeys,t),a=cam.angle*Math.PI/180;
  return {frame:i+1,segments:figureSegments(subject,t,grey.pose??"stand",subjectFacing(subject),{x:Math.sin(a)*cam.distance,z:-Math.cos(a)*cam.distance,min:3.2})};
 });
}
