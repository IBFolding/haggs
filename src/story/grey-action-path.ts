import {withKey,type GreyScene,type Key} from './grey-scene';
export type ActionPoint={x:number;y:number};
export function applyActionPath(scene:GreyScene,id:string,points:ActionPoint[],seconds:number):GreyScene {
 const prop=scene.props?.find(p=>p.id===id);if(!prop)throw Error('Select a prop or actor layer first.');if(prop.locked)throw Error('Unlock this layer before editing its path.');
 if(points.length<2||points.length>60||!Number.isFinite(seconds)||seconds<.25||seconds>6||points.some(p=>![p.x,p.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1)))throw Error('Draw 2–60 points within the plan and choose 0.25–6 seconds.');
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]!+Math.hypot(points[i]!.x-points[i-1]!.x,points[i]!.y-points[i-1]!.y));const distance=lengths.at(-1)!;if(distance<.01)throw Error('Draw a longer path.');
 // Replace position keys only. Opacity, rotation, width and other channels survive.
 let keys:Key[]|undefined=prop.keys?.map(({x:_x,y:_y,...rest})=>rest).filter(k=>Object.keys(k).length>1);
 for(let i=0;i<points.length;i++)keys=withKey(keys,seconds*lengths[i]!/distance,{x:points[i]!.x,y:points[i]!.y});
 return {...scene,props:scene.props!.map(p=>p.id===id?{...p,keys:keys!}:p)};
}
