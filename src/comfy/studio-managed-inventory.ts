/** Dependency inventory for the ten shipped HaggsStudio graphs. No entry enables execution. */
export const STUDIO_MANAGED_INVENTORY=[
 {graph:'01-playable-world-room',needs:['HaggsStudio','native interactive widget'],output:'room and recording',status:'native-only'},
 {graph:'02-register-room-for-eden-live',needs:['HaggsStudio','Eden installation'],output:'Eden registration',status:'native-only'},
 {graph:'03-eden-neural-replay',needs:['HaggsStudio','Eden backend','Eden weights','GPU'],output:'neural replay',status:'unverified'},
 {graph:'04-generated-motion-to-h3',needs:['HaggsStudio','HY-Motion nodes and weights','H3 nodes and weights','GPU'],output:'motion data and H3 video',status:'unverified'},
 {graph:'05-saved-motion-bridge-preview',needs:['HaggsStudio','motion NPZ'],output:'motion data and pose guide',status:'preview-only'},
 {graph:'06-ltx-directed-vfx-inpainting',needs:['HaggsStudio','LTX inpainting nodes and weights','GPU'],output:'video',status:'unverified'},
 {graph:'06a-ltx-single-effect-inpainting',needs:['HaggsStudio','LTX inpainting nodes and weights','GPU'],output:'video',status:'unverified'},
 {graph:'07-vfx-placement-mask-preview',needs:['HaggsStudio'],output:'mask preview',status:'preview-only'},
 {graph:'08-vfx-reuse-existing-take',needs:['HaggsStudio','source video','generated take'],output:'composited video',status:'unverified'},
 {graph:'09-load-room-recording-no-model',needs:['HaggsStudio','existing room recording'],output:'recorded video',status:'native-only'},
] as const;
