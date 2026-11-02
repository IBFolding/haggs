import {z} from "zod";
export const MAX_REFERENCE_IMAGES=2;
export const MAX_REFERENCE_BYTES=512*1024;
export const referenceImageSchema=z.object({name:z.string().trim().min(1).max(80),mediaType:z.enum(["image/jpeg","image/png"]),data:z.string().min(4).max(Math.ceil(MAX_REFERENCE_BYTES/3)*4).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)}).strict();
export const referenceImagesSchema=z.array(referenceImageSchema).max(MAX_REFERENCE_IMAGES);
export type ReferenceImage=z.infer<typeof referenceImageSchema>;
/** Inline bytes only; this transport never asks the provider to fetch a supplied URL. */
export function writerMessage(user:string,images?:ReferenceImage[]) {
 if(!images?.length)return user;
 const checked=referenceImagesSchema.parse(images);
 return [...checked.flatMap(image=>[
  {type:"text" as const,text:`Visual reference: ${image.name}`},
  {type:"image" as const,source:{type:"base64" as const,media_type:image.mediaType,data:image.data}},
 ]),{type:"text" as const,text:user}];
}
