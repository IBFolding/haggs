import type {OpenedApp} from '../app/workflow-actions';

/** A failed server action must not leave the workflow page loading forever. */
export async function openWorkflowSafely(open:()=>Promise<OpenedApp>):Promise<OpenedApp> {
 try { return await open(); }
 catch { return {ok:false,reason:"Couldn't open this workflow. Check your connection and try again."}; }
}
