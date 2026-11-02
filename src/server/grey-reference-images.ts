import sharp from "sharp";
import {MAX_REFERENCE_BYTES,referenceImagesSchema,type ReferenceImage} from "../writer/image-input";
/** Decode bounded raster bytes only, then re-encode without metadata. No URL fetch or persistent file. */
export async function prepareGreyReferenceImages(raw:ReferenceImage[]):Promise<ReferenceImage[]> {
 const images=referenceImagesSchema.parse(raw),out:ReferenceImage[]=[];
 for(const image of images){
  const bytes=Buffer.from(image.data,"base64");
  if(bytes.length>MAX_REFERENCE_BYTES||bytes.toString("base64")!==image.data)throw Error("Invalid reference image.");
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if(image.mediaType==="image/png"?!png:!jpeg)throw Error("Use a still PNG or JPEG reference.");
  const input=sharp(bytes,{limitInputPixels:4_000_000,failOn:"error"});
  const meta=await input.metadata();
  if(!meta.width||!meta.height||(meta.pages??1)>1||meta.format!==(image.mediaType==="image/png"?"png":"jpeg"))throw Error("Use a still PNG or JPEG reference.");
  const clean=await input.rotate().resize({width:768,height:768,fit:"inside",withoutEnlargement:true}).flatten({background:"#ffffff"}).jpeg({quality:80}).toBuffer();
  if(clean.length>MAX_REFERENCE_BYTES)throw Error("Reference preview is too large.");
  out.push({name:image.name,mediaType:"image/jpeg",data:clean.toString("base64")});
 }
 return out;
}
