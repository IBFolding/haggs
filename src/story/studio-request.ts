/** One payload path shared by uploaded first frames and bank-only references. */
export function sendStudioGeneration<T>(send:(model:string,prompt:string,settings:Record<string,unknown>,images?:string[],firstFrame?:boolean)=>Promise<T>, input:{model:string;prompt:string;settings:Record<string,unknown>;images:string[];references:string[]}):Promise<T> {
  return input.images.length
    ? send(input.model,input.prompt,input.settings,input.images,true)
    : input.references.length
      ? send(input.model,input.prompt,input.settings,input.references,false)
      : send(input.model,input.prompt,input.settings);
}
