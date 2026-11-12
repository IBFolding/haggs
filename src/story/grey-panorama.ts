import {z} from 'zod';
export const panoramaSchema=z.object({url:z.string().max(15000000).refine(v=>/^\/(?!\/)|^https:\/\/|^data:image\/(jpeg|png|webp);base64,/.test(v)),name:z.string().min(1).max(120),yaw:z.number().finite().min(-180).max(180),exposure:z.number().finite().min(-3).max(3),showFloor:z.boolean()});
export type Panorama=z.infer<typeof panoramaSchema>;
export const readPanorama=(raw:unknown)=>panoramaSchema.safeParse(raw).data;
