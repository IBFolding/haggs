import type {Prop} from "./grey-scene";
import {propMaterial} from "./grey-space";
/** Application-owned geometry only; never embed a prop URL, name or arbitrary material. */
export function boxSvg(material:unknown):string {
 const color=propMaterial(material)?.color??"#8796a5";
 return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><path fill="${color}" d="M20 50 80 20 140 50 140 120 80 150 20 120Z"/><path fill="#000" fill-opacity=".25" d="M80 80 140 50 140 120 80 150Z"/></svg>`;
}
/** Derived preview, so legacy saved asset URLs stay intact and image layers are unchanged. */
export function propImage(prop:Pick<Prop,"primitive"|"material"|"url">):string {
 return prop.primitive==="box"?`data:image/svg+xml,${encodeURIComponent(boxSvg(prop.material))}`:prop.url;
}
