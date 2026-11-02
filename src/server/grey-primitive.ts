import sharp from "sharp";
import type {Prop} from "../story/grey-scene";
import {boxSvg} from "../story/grey-primitive-image";
/** Only application-owned geometry is rasterized. The prop URL and user SVG are never read. */
export async function primitivePng(prop:Prop):Promise<Buffer>{
 if(prop.primitive!=="box"||prop.hidden)throw Error("Unsupported or hidden primitive.");
 return sharp(Buffer.from(boxSvg(prop.material))).png().toBuffer();
}
