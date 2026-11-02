import sharp from "sharp";
import type {Prop} from "../story/grey-scene";
import {propMaterial} from "../story/grey-space";
/** Only application-owned geometry is rasterized. The prop URL and user SVG are never read. */
export async function primitivePng(prop:Prop):Promise<Buffer>{
 if(prop.primitive!=="box"||prop.hidden)throw Error("Unsupported or hidden primitive.");
 const color=propMaterial(prop.material)?.color??"#8796a5";
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><path fill="${color}" d="M20 50 80 20 140 50 140 120 80 150 20 120Z"/><path fill="#000" fill-opacity=".25" d="M80 80 140 50 140 120 80 150Z"/></svg>`;
 return sharp(Buffer.from(svg)).png().toBuffer();
}
