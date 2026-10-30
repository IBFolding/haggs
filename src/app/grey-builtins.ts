'use client';
import {uploadFile} from './upload-client';
export const GREY_PROPS=[
 {id:'builtin-lamp',name:'Floor lamp',image:'/grey-room/assets/floor-lamp.png'},
 {id:'builtin-chair',name:'Leather armchair',image:'/grey-room/assets/armchair.png'},
 {id:'builtin-table',name:'Walnut table',image:'/grey-room/assets/coffee-table.png'},
 {id:'builtin-plant',name:'Potted plant',image:'/grey-room/assets/plant.png'},
];
const transfers=new Map<string,Promise<string>>();
/** Starter images become ordinary project media before placement, so export can resolve them too. */
export async function sceneAssetUrl(url:string):Promise<string>{
 if(!GREY_PROPS.some(p=>p.image===url))return url;
 const pending=transfers.get(url);if(pending)return pending;
 const work=(async()=>{const response=await fetch(url);if(!response.ok)throw new Error('This starter asset could not be loaded.');const result=await uploadFile(new File([await response.blob()],url.split('/').at(-1)!,{type:'image/png'}));if(!result.ok)throw new Error(result.reason);return result.url;})();
 transfers.set(url,work);try{return await work;}catch(e){transfers.delete(url);throw e;}
}
