/** Portable project files contain the user's video clips; they never leave the browser here. */
export type SceneClip={name:string;data:string};
export type SceneProject={schema:'haggs.scene-forge/1';labels:string[];clips:(SceneClip|null)[]};
export const SCENE_PROJECT_LIMIT=81_000_000;
const MAX_DATA=26_666_700;
export function sceneProject(labels:string[],clips:(SceneClip|null)[]):SceneProject {
 if(!Array.isArray(labels)||labels.length!==3||labels.some(s=>typeof s!=='string'||s.length>120)||!Array.isArray(clips)||clips.length!==3)throw Error('This project needs three choices and videos.');
 const clean=clips.map(clip=>{if(clip===null)return null;if(!clip||typeof clip.name!=='string'||!clip.name.trim()||clip.name.length>255||typeof clip.data!=='string'||clip.data.length>MAX_DATA||!/^data:video\/(mp4|webm);base64,[A-Za-z0-9+/]+={0,2}$/.test(clip.data))throw Error('This project contains an invalid video.');return {name:clip.name,data:clip.data};});
 return {schema:'haggs.scene-forge/1',labels:[...labels],clips:clean};
}
export function parseSceneProject(text:string):SceneProject {
 if(typeof text!=='string'||text.length>SCENE_PROJECT_LIMIT)throw Error('This project is too large.');
 let value:unknown;try{value=JSON.parse(text);}catch{throw Error('This is not a valid Scene Forge project.');}
 if(!value||typeof value!=='object'||Array.isArray(value)||(value as {schema?:unknown}).schema!=='haggs.scene-forge/1')throw Error('This is not a valid Scene Forge project.');
 const project=value as {labels:string[];clips:(SceneClip|null)[]};return sceneProject(project.labels,project.clips);
}
