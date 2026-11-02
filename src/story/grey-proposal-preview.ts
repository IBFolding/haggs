import type { GreyFrame } from "./grey";
import type { GreyScene } from "./grey-scene";
import type { SceneProposal } from "./grey-space";
import { applySceneProposal, type ProposalSelection } from "./grey-proposal";
import { greyFrameSvg } from "./grey-control";
/** Local geometry only. The exact candidate shown is held for explicit apply; source records are untouched. */
export function previewSceneProposal(grey: GreyFrame, scene: GreyScene, proposal: SceneProposal, camera: boolean, selection: ProposalSelection, vertical: boolean, time: number) {
  const candidate=applySceneProposal(grey,scene,proposal,camera,selection);
  const size=vertical?{w:360,h:640}:{w:640,h:360};
  const t=Number.isFinite(time)?Math.max(0,Math.min(6,time)):0;
  return {candidate,before:greyFrameSvg(grey,t,size,scene),after:greyFrameSvg(candidate.grey,t,size,candidate.scene),
    peopleAdded:candidate.grey.subjects.length-grey.subjects.length,propsAdded:(candidate.scene.props?.length??0)-(scene.props?.length??0)};
}
