import motionGraph from '../../public/workflows/world-motion-vfx/workflows/04-generated-motion-to-h3.json';import type {UiWorkflow} from '../comfy/convert';
/** Editor graph preview only. Never submit without a runtime catalog and capability verification. */
export function prepareGeneratedMotionPreview(input:{motionPrompt:string;scene:string}):{graph:UiWorkflow;availability:'unavailable';requirements:string[]}{
 for(const text of [input.motionPrompt,input.scene])if(typeof text!=='string'||!text.trim()||text.length>4000)throw Error('Provide a motion description and scene.');
 const graph=structuredClone(motionGraph) as unknown as UiWorkflow;const nodes=graph.nodes;const motion=nodes.find(n=>String(n.id)==='10003'),scene=nodes.find(n=>String(n.id)==='900',),output=nodes.find(n=>String(n.id)==='707');
 if(motion?.type!=='HYMotionEncodeText'||scene?.type!=='HaggsMotionToMovie'||output?.type!=='SaveVideo'||!Array.isArray(motion.widgets_values)||!Array.isArray(scene.widgets_values))throw Error('Bundled graph contract is unavailable.');motion.widgets_values[0]=input.motionPrompt;scene.widgets_values[0]=input.scene;
 return {graph,availability:'unavailable',requirements:['HY-Motion nodes and weights','MiniMax H3 nodes and weights','HaggsStudio nodes','Compatible GPU and reference image','Verified provider and bounded billing']};
}
