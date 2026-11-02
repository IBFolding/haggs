import {referenceImageSchema,type ReferenceImage} from "../writer/image-input";
/** Removed references cannot remain selected. Preserve surviving choices and stable state identity. */
export function retainSelectedReferences(selected:string[],references:readonly {id:string}[]):string[]{
 const available=new Set(references.map(reference=>reference.id));
 const retained=selected.filter(id=>available.has(id));
 return retained.length===selected.length?selected:retained;
}
/** Browser-only, explicit selection. Originals remain unchanged; failures never fall back to a server URL proxy. */
export async function prepareReferencePreview(reference:{name:string;url:string}):Promise<ReferenceImage>{
 if(!/^(https:\/\/|\/(?!\/)|data:image\/(?:png|jpeg);base64,)/i.test(reference.url))throw Error("Use a saved PNG or JPEG reference image.");
 const img=new Image();img.crossOrigin="anonymous";img.referrerPolicy="no-referrer";
 await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>{img.onload=null;img.onerror=null;img.src="";reject(Error("The reference preview timed out."));},15000);
  img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error("This reference cannot be read here. Upload a PNG or JPEG copy to use it for image analysis."));};img.src=reference.url;
 });
 if(!img.naturalWidth||!img.naturalHeight||img.naturalWidth*img.naturalHeight>16_000_000)throw Error("Use a reference image under 16 megapixels.");
 const scale=Math.min(1,768/img.naturalWidth,768/img.naturalHeight),canvas=document.createElement("canvas");
 canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
 const ctx=canvas.getContext("2d");if(!ctx)throw Error("Reference preview is unavailable in this browser.");
 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 try{return referenceImageSchema.parse({name:reference.name.trim().slice(0,80)||"Reference",mediaType:"image/jpeg",data:canvas.toDataURL("image/jpeg",.8).split(",")[1]});}
 catch{throw Error("This reference cannot be prepared. Upload a smaller PNG or JPEG copy.");}
}
