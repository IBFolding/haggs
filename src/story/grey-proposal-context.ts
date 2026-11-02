import { z } from "zod";
import type { SceneProposalRequest } from "./grey-space";
import { spaceSchema, materialSchema } from "./grey-space";
import {referenceImagesSchema} from "../writer/image-input";
/** Bounded layout and explicitly selected inline previews only. Never media URLs or project records. */
export const proposalContextSchema = z.object({
  description:z.string().trim().min(1).max(4000),
  references:z.array(z.object({name:z.string().max(80)}).strict()).max(60),
  people:z.array(z.object({facing:z.number().finite().min(0).max(360).optional(),id:z.string().max(100),label:z.string().max(24),x:z.number().finite().min(-3).max(3),z:z.number().finite().min(-3).max(3)}).strict()).max(6),
  props:z.array(z.object({name:z.string().max(60),material:materialSchema.optional()}).strict()).max(100),
  camera:z.object({angle:z.number().finite().min(0).max(360),distance:z.number().finite().min(1).max(12),height:z.number().finite().min(.2).max(6),lens:z.number().finite().min(14).max(135)}).strict(),
  room:spaceSchema.optional(),
  images:referenceImagesSchema.optional(),
}).strict();
export type ProposalContext=z.infer<typeof proposalContextSchema>;
export function proposalContext(input:SceneProposalRequest):ProposalContext {
 return proposalContextSchema.parse({description:input.description,references:input.references.slice(0,60).map(r=>({name:r.name.slice(0,80)})),people:input.grey.subjects.map(({id,label,x,z,facing})=>({id,label,x,z,...(facing===undefined?{}:{facing})})),props:(input.scene.props??[]).slice(0,100).map(p=>({name:p.name.slice(0,60),...(p.material?{material:p.material}:{})})),camera:input.grey.cam,...(input.scene.space?{room:input.scene.space}:{})});
}
