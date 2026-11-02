"use server";
import type {run,runEdit} from './actions';
import {runWorkflow,quoteWorkflow} from './workflow-actions';
const HOLD='This Grey Room cloud media action is unavailable until its maximum charge can be protected by your cap. Use uploaded assets, manual editing or Your GPU cutouts. Your scene is unchanged.';
/** Do not let older Grey panels bypass the scene-planning budget via general studio actions. */
export async function runGreyAssetImage(..._args:Parameters<typeof run>):ReturnType<typeof run>{return {ok:false,reason:HOLD};}
export async function runGreyFinishing(..._args:Parameters<typeof runEdit>):ReturnType<typeof runEdit>{return {ok:false,reason:HOLD};}
/** Explicit local destination rejects partner nodes and never silently falls back to Comfy Cloud. */
export async function runGreyLocalWorkflow(source:Parameters<typeof runWorkflow>[0],values:Parameters<typeof runWorkflow>[1],files:Parameters<typeof runWorkflow>[2]):ReturnType<typeof runWorkflow>{return runWorkflow({...source,destination:'local'},values,files);}
export async function quoteGreyLocalWorkflow(source:Parameters<typeof quoteWorkflow>[0],values:Parameters<typeof quoteWorkflow>[1]):ReturnType<typeof quoteWorkflow>{return quoteWorkflow({...source,destination:'local'},values);}
