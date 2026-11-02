"use client";

import { useEffect, useRef, useState } from "react";
import type * as Three from "three";
import { CAM_SECONDS } from "../../../../story/grey-camera";
import { figureSegments } from "../../../../story/grey-figure";
import { subjectFacing, faceCamera, type GreyFrame } from "../../../../story/grey";
import { resolveScene, removeProp, type GreyScene } from "../../../../story/grey-scene";
import { keySpatialProp, duplicateSpatialProp, SPATIAL_DRAG_TYPE, readSpatialDrop, applySpatialDrop, spatialCameraAt, type SpatialDrop, MATERIALS, propMaterial, materialSchema, editSpatialProp, addStandInProp, moveSpatialProp, propPosition, roomSpace } from "../../../../story/grey-space";

type Props = { grey: GreyFrame; scene: GreyScene; vertical: boolean; time: number; playing: boolean; onSeek: (time:number) => void; onTogglePlay: () => void; onSetCameraKey: () => void; onGrey: (g: GreyFrame) => void; onCamera: (cam: GreyFrame["cam"]) => void; onScene: (s: GreyScene) => void };
type Engine = { THREE: typeof Three; renderer: Three.WebGLRenderer; camera: Three.PerspectiveCamera; world: Three.Scene; render: () => void };
function dispose(world: Three.Scene) {
  world.traverse(o => {
    if (!("geometry" in o)) return;
    const mesh = o as Three.Mesh;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(m => { if ("map" in m) (m.map as Three.Texture | null)?.dispose(); m.dispose(); });
  });
  world.clear();
}

/** One viewport reads the existing frame and compositing scene. No duplicate project store. */
export function GreySpaceView(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef(props); live.current = props;
  const engine = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [selected, select] = useState("");
  const [plan, setPlan] = useState(false);
  const [paint, setPaint] = useState<keyof typeof MATERIALS | null>(null);
  const [notice, setNotice] = useState("");
  const drag = useRef<{ id: string; object: Three.Object3D; x: number; z: number; offsetX: number; offsetZ: number } | null>(null);
  const spatial = roomSpace(props.scene.space);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    void import("three").then(THREE => {
      if (cancelled || !host.current) return;
      const node = host.current;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.setAttribute("aria-label", "Shared 3D room. Drag a figure or prop to move it.");
      renderer.domElement.setAttribute("role", "img");
      node.appendChild(renderer.domElement);
      const world = new THREE.Scene(); world.background = new THREE.Color("#22262d");
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, .05, 100);
      const render = () => renderer.render(world, camera);
      engine.current = { THREE, renderer, world, camera, render };
      const resize = new ResizeObserver(() => { renderer.setSize(node.clientWidth, node.clientHeight); render(); });
      resize.observe(node);
      const lost = (e: Event) => { e.preventDefault(); setError("3D preview interrupted. Reload to restore it; the controls and saved shot remain available."); };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      cleanup = () => { resize.disconnect(); renderer.domElement.removeEventListener("webglcontextlost", lost); dispose(world); renderer.dispose(); renderer.domElement.remove(); engine.current = null; };
      setReady(true);
    }).catch(() => { if (!cancelled) setError("3D preview is unavailable on this device. Continue with the original blockout and controls below."); });
    return () => { cancelled = true; cleanup(); };
  }, []);

  useEffect(() => {
    const e = engine.current; if (!e || !ready) return;
    const { THREE: T, world, camera, render } = e;
    dispose(world);
    let active = true;
    const material = (key: keyof typeof MATERIALS) => new T.MeshStandardMaterial({ ...MATERIALS[key], metalness: key === "metal" ? .65 : 0, side: T.DoubleSide });
    const floor = new T.Mesh(new T.PlaneGeometry(6, 6), material(spatial.floor)); floor.userData.surface = "floor"; floor.rotation.x = -Math.PI / 2; world.add(floor);
    const wall = new T.Mesh(new T.PlaneGeometry(6, 3.5), material(spatial.wall)); wall.userData.surface = "wall"; wall.position.set(0, 1.75, 3); world.add(wall);
    const grid = new T.GridHelper(6, 12, "#9babbc", "#555e68"); grid.position.y = .005; world.add(grid);
    world.add(new T.HemisphereLight("#e5eeff", "#56504b", 2));
    const sun = new T.DirectionalLight("#fff0db", 3);
    const az = props.grey.light.az * Math.PI / 180, el = props.grey.light.el * Math.PI / 180;
    sun.position.set(-Math.sin(az) * Math.cos(el) * 6, Math.sin(el) * 6, -Math.cos(az) * Math.cos(el) * 6); world.add(sun);
    const scene = resolveScene(props.scene, props.time);
    for (const light of scene.lights ?? []) {
      const lamp = new T.PointLight(light.color, light.intensity * 10, 12);
      lamp.position.set(-(light.x - .5) * 6, (1 - light.y) * 4 + .2, -1); world.add(lamp);
    }
    for (const subject of props.grey.subjects) {
      const group = new T.Group(); group.userData.id = `subject:${subject.id}`;
      group.position.set(-subject.x, 0, subject.z);
      const angle = props.grey.cam.angle * Math.PI / 180;
      for (const segment of figureSegments(subject, props.time, props.grey.pose ?? "stand", subjectFacing(subject), { x: Math.sin(angle) * props.grey.cam.distance, z: -Math.cos(angle) * props.grey.cam.distance, min: 3.2 })) {
        const a = new T.Vector3(-(segment.a.x - subject.x), segment.a.y, segment.a.z - subject.z);
        const b = new T.Vector3(-(segment.b.x - subject.x), segment.b.y, segment.b.z - subject.z);
        const length = a.distanceTo(b);
        const mesh = new T.Mesh(length < .001 ? new T.SphereGeometry(segment.r, 12, 8) : new T.CylinderGeometry(segment.r, segment.r, length, 8), new T.MeshStandardMaterial({ color: segment.face ? "#414852" : selected === group.userData.id ? "#51e6b1" : "#bec6d0" }));
        mesh.position.copy(a).add(b).multiplyScalar(.5);
        if (length > .001) mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        group.add(mesh);
      }
      world.add(group);
    }
    for (const prop of scene.props ?? []) {
      if (prop.hidden) continue;
      const pos = propPosition(prop), size = prop.w * 4;
      const palette = propMaterial(prop.material);
      const m = new T.MeshStandardMaterial({ roughness: palette?.roughness ?? .8, metalness: prop.material === "metal" ? .65 : 0, color: selected === `prop:${prop.id}` ? "#51e6b1" : palette?.color ?? "#a6b4c5", transparent: true, opacity: prop.opacity, side: T.DoubleSide });
      const box = prop.primitive === "box";
      const mesh = new T.Mesh(box ? new T.BoxGeometry(size, size, size) : new T.PlaneGeometry(size, size), m);
      mesh.position.set(-pos.x, size / 2, pos.z); mesh.rotation.y = box ? -prop.rotate * Math.PI / 180 : Math.PI;
      if (!box) { mesh.rotation.z = prop.rotate * Math.PI / 180; if (prop.flip) mesh.scale.x = -1; }
      mesh.userData.id = `prop:${prop.id}`; mesh.userData.locked = prop.locked; world.add(mesh);
      if (prop.url && !box) new T.TextureLoader().load(prop.url, texture => {
        if (!active) { texture.dispose(); return; }
        texture.colorSpace = T.SRGBColorSpace; m.map = texture; m.color.set(selected === `prop:${prop.id}` ? "#51e6b1" : palette?.color ?? "#ffffff"); m.needsUpdate = true; render();
      }, undefined, () => { /* The stand-in stays visible if an asset cannot be fetched. */ });
    }
    camera.aspect = props.vertical ? 9 / 16 : 16 / 9;
    if (plan) {
      const a=props.grey.cam.angle*Math.PI/180,cx=-Math.sin(a)*props.grey.cam.distance,cz=-Math.cos(a)*props.grey.cam.distance;
      const marker=new T.Mesh(new T.BoxGeometry(.45,.3,.35),new T.MeshBasicMaterial({color:"#51e6b1"}));
      marker.position.set(cx,.2,cz);marker.userData.id="camera:main";world.add(marker);
      world.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(cx,.05,cz),new T.Vector3(0,.05,0)]),new T.LineBasicMaterial({color:"#51e6b1",transparent:true,opacity:.4})));
      camera.fov = 50;
      const extent=[props.grey.cam,...(props.grey.camKeys??[])].map(c=>{const a=c.angle*Math.PI/180;return {x:Math.abs(Math.sin(a)*c.distance)+.7,z:Math.abs(Math.cos(a)*c.distance)+.7};});
      const reach=Math.max(10,Math.max(3.4,...extent.map(p=>p.x))/camera.aspect/Math.tan(25*Math.PI/180),Math.max(3.4,...extent.map(p=>p.z))/Math.tan(25*Math.PI/180));
      camera.position.set(0, reach, -.01); camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0);
    }
    else {
      const cam = props.grey.cam, a = cam.angle * Math.PI / 180;
      camera.fov = 2 * Math.atan(18 / cam.lens / camera.aspect) * 180 / Math.PI;
      camera.position.set(-Math.sin(a) * cam.distance, cam.height, -Math.cos(a) * cam.distance);
      camera.up.set(0, 1, 0); camera.lookAt(0, 1.2, 0);
    }
    camera.updateProjectionMatrix();
    if (plan && props.grey.camKeys?.length) {
      const points = props.grey.camKeys.map(k => { const a = k.angle * Math.PI / 180; return new T.Vector3(-Math.sin(a) * k.distance, .04, -Math.cos(a) * k.distance); });
      world.add(new T.Line(new T.BufferGeometry().setFromPoints(points), new T.LineBasicMaterial({ color: "#51e6b1" })));
      props.grey.camKeys.forEach(k=>{if(Math.abs(k.t-props.time)<.04)return;const a=k.angle*Math.PI/180;const dot=new T.Mesh(new T.SphereGeometry(.13,10,8),new T.MeshBasicMaterial({color:"#f5c451"}));dot.position.set(-Math.sin(a)*k.distance,.12,-Math.cos(a)*k.distance);dot.userData.seek=k.t;world.add(dot);});
    }
    render();
    return () => { active = false; };
  }, [props.grey, props.scene, props.vertical, props.time, ready, selected, plan, spatial.floor, spatial.wall]);

  function pointer(e: {clientX:number;clientY:number}) {
    const env = engine.current; if (!env || !host.current) return null;
    const rect = host.current.getBoundingClientRect(), ray = new env.THREE.Raycaster();
    ray.setFromCamera(new env.THREE.Vector2((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1), env.camera);
    return { env, ray };
  }
  function dropAt(drop: SpatialDrop, event: {clientX:number;clientY:number}) {
    const p=pointer(event);if(!p)return;props.onSeek(props.time);
    let next=props.scene;
    if(drop.kind==="box") {
      const point=new p.env.THREE.Vector3();
      if(p.ray.ray.intersectPlane(new p.env.THREE.Plane(new p.env.THREE.Vector3(0,1,0),0),point)) next=applySpatialDrop(props.scene,drop,{x:-point.x,z:point.z},props.time);
    } else {
      for(const hit of p.ray.intersectObjects(p.env.world.children,true)) {
        if(hit.object.userData.surface){next=applySpatialDrop(props.scene,drop,{surface:hit.object.userData.surface},props.time);break;}
        const id=hit.object.userData.id;
        if(typeof id==="string"&&id.startsWith("prop:")){next=applySpatialDrop(props.scene,drop,{propId:id.slice(5)},props.time);break;}
      }
    }
    if(next!==props.scene){props.onScene(next);if(drop.kind==="box")select(`prop:${next.props!.at(-1)!.id}`);setNotice(drop.kind==="box"?"Box placed.":"Material applied.");}
    else setNotice("Choose a room surface or an unlocked prop. A scene can hold up to 100 props.");
    setPaint(null);
  }
  function down(e: React.PointerEvent<HTMLDivElement>) {
    if(paint){dropAt({kind:"material",material:paint},e);return;}
    const p = pointer(e); if (!p) return;
    props.onSeek(props.time);
    for (const hit of p.ray.intersectObjects(p.env.world.children, true)) {
      if(typeof hit.object.userData.seek==="number"){props.onSeek(hit.object.userData.seek);select("camera:main");return;}
      let object = hit.object;
      while (!object.userData.id && object.parent && object.parent !== p.env.world) object = object.parent;
      if (!object.userData.id) continue;
      select(object.userData.id);
      if (object.userData.locked) return;
      const start = new p.env.THREE.Vector3();
      if (!p.ray.ray.intersectPlane(new p.env.THREE.Plane(new p.env.THREE.Vector3(0, 1, 0), 0), start)) return;
      drag.current = { id: object.userData.id, object, x: -object.position.x, z: object.position.z, offsetX: object.position.x - start.x, offsetZ: object.position.z - start.z };
      e.currentTarget.setPointerCapture(e.pointerId); return;
    }
  }
  function move(e: React.PointerEvent) {
    const d = drag.current, p = pointer(e); if (!d || !p) return;
    const target = new p.env.THREE.Vector3();
    if (!p.ray.ray.intersectPlane(new p.env.THREE.Plane(new p.env.THREE.Vector3(0, 1, 0), 0), target)) return;
    const limit=d.id==="camera:main"?12:3;
    d.x = Math.max(-limit, Math.min(limit, -(target.x + d.offsetX))); d.z = Math.max(-limit, Math.min(limit, target.z + d.offsetZ));
    const object = p.env.world.children.find(o => o.userData.id === d.id);
    if (object) { object.position.x = -d.x; object.position.z = d.z; } p.env.render();
  }
  function finish(cancel = false) {
    const d = drag.current; drag.current = null; if (!d) return;
    const p = live.current, id = d.id.slice(d.id.indexOf(":") + 1);
    if (cancel) { p.onGrey({ ...p.grey }); return; }
    if(d.id==="camera:main")p.onCamera(spatialCameraAt(p.grey.cam,d.x,d.z));
    else if (d.id.startsWith("subject:")) p.onGrey({ ...p.grey, subjects: p.grey.subjects.map(s => s.id === id ? { ...s, x: d.x, z: d.z } : s) });
    else p.onScene(moveSpatialProp(p.scene, id, d.x, d.z, p.time));
  }
  function nudge(axis: "x" | "z", delta: number) {
    props.onSeek(props.time);
    const id = selected.slice(selected.indexOf(":") + 1);
    if(selected==="camera:main"){const a=props.grey.cam.angle*Math.PI/180;props.onCamera(spatialCameraAt(props.grey.cam,Math.sin(a)*props.grey.cam.distance+(axis==="x"?delta:0),-Math.cos(a)*props.grey.cam.distance+(axis==="z"?delta:0)));}
    else if (selected.startsWith("subject:")) props.onGrey({ ...props.grey, subjects: props.grey.subjects.map(s => s.id === id ? { ...s, [axis]: Math.max(-3, Math.min(3, s[axis] + delta)) } : s) });
    else { const p = resolveScene(props.scene, props.time).props?.find(p => p.id === id); if (p) { const pos = propPosition(p); props.onScene(moveSpatialProp(props.scene, id, pos.x + (axis === "x" ? delta : 0), pos.z + (axis === "z" ? delta : 0), props.time)); } }
  }
  const selectedId=selected.slice(selected.indexOf(":")+1);
  const selectedProp=selected.startsWith("prop:")?resolveScene(props.scene,props.time).props?.find(p=>p.id===selectedId):undefined;
  const propTimes=(selectedProp?.keys??[]).map(k=>k.t).sort((a,b)=>a-b);
  const previousProp=propTimes.filter(t=>t<props.time-.05).at(-1),nextProp=propTimes.find(t=>t>props.time+.05);
  const selectedFigure=selected.startsWith("subject:")?props.grey.subjects.find(s=>s.id===selectedId):undefined;
  const keyTimes=(props.grey.camKeys??[]).map(k=>k.t).sort((a,b)=>a-b);
  const previous=keyTimes.filter(t=>t<props.time-.04).at(-1),nextKey=keyTimes.find(t=>t>props.time+.04);
  return <section className="gr-space" aria-label="Shared 3D scene">
    <label className="gr-space-brief">Describe the scene<textarea aria-label="Scene direction" placeholder="A quiet kitchen at dawn. Two people at the table, a slow push toward the window…" value={props.scene.direction ?? ""} maxLength={4000} onChange={e => props.onScene({ ...props.scene, direction: e.target.value })} /></label>
    <div className="gr-space-toolbar"><b>Build the scene</b><button className="pill" aria-pressed={plan} onClick={() => setPlan(!plan)}>{plan ? "Camera view" : "Arrange from above"}</button><button className="pill" draggable onDragStart={e=>{e.dataTransfer.setData(SPATIAL_DRAG_TYPE,JSON.stringify({kind:"box"}));e.dataTransfer.effectAllowed="copy";}} disabled={(props.scene.props?.length??0)>=100} onClick={() => props.onScene(addStandInProp(props.scene))}>Add box</button>
      {(["floor", "wall"] as const).map(surface => <label key={surface}>{surface === "floor" ? "Floor" : "Wall"}<select aria-label={`${surface} material`} value={spatial[surface]} onChange={e => props.onScene({ ...props.scene, space: { ...spatial, [surface]: e.target.value } })}>{Object.keys(MATERIALS).map(m => <option key={m}>{m}</option>)}</select></label>)}
    </div>
    <div className="gr-space-toolbar" aria-label="Material palette">{Object.keys(MATERIALS).map(key=>{const material=materialSchema.parse(key);return <button className="pill" key={key} draggable aria-pressed={paint===material} onDragStart={e=>{setPaint(null);e.dataTransfer.setData(SPATIAL_DRAG_TYPE,JSON.stringify({kind:"material",material}));e.dataTransfer.effectAllowed="copy";}} onClick={()=>{setPaint(paint===material?null:material);setNotice(paint===material?"Material placement cancelled.":"Tap a floor, wall or unlocked prop to apply the material.");}}>{material}</button>;})}</div>
    {paint&&<button className="plain" onClick={()=>{setPaint(null);setNotice("");}}>Cancel material placement</button>}
    <div ref={host} onDragOver={e=>{if(Array.from(e.dataTransfer.types).includes(SPATIAL_DRAG_TYPE)){e.preventDefault();e.dataTransfer.dropEffect="copy";}}} onDrop={e=>{e.preventDefault();const drop=readSpatialDrop(e.dataTransfer.getData(SPATIAL_DRAG_TYPE));if(drop)dropAt(drop,e);}} className="gr-space-canvas" style={{ aspectRatio: props.vertical ? "9 / 16" : "16 / 9", maxWidth: props.vertical ? "min(100%, 40vh)" : "min(100%, 106.6667vh)" }} onPointerDown={down} onPointerMove={move} onPointerUp={() => finish()} onPointerCancel={() => finish(true)} />
    <div className="gr-space-toolbar" aria-label="Viewport camera playback">
      <button className="pill" disabled={!keyTimes.length&&!props.scene.props?.some(p=>p.keys?.length)} onClick={props.onTogglePlay}>{props.playing?(keyTimes.length?"Pause camera":"Pause motion"):(keyTimes.length?"Preview camera":"Preview motion")}</button>
      <button className="pill" disabled={previous===undefined} onClick={()=>previous!==undefined&&props.onSeek(previous)}>Previous camera key</button>
      <button className="pill" disabled={nextKey===undefined} onClick={()=>nextKey!==undefined&&props.onSeek(nextKey)}>Next camera key</button>
      <button className="pill" onClick={()=>{props.onSeek(props.time);props.onSetCameraKey();}}>Save camera key</button>
      <label>Time<input aria-label="Viewport shot time" type="range" min={0} max={CAM_SECONDS} step={.05} value={props.time} onChange={e=>props.onSeek(Number(e.target.value))}/></label><output>{props.time.toFixed(1)} s</output>
    </div>
    {error && <p role="status">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    <div className="gr-space-toolbar"><label>Move<select aria-label="Select scene object" value={selected} onChange={e => select(e.target.value)}><option value="">Choose a figure, prop or camera</option><option value="camera:main">Camera</option>{props.grey.subjects.map(s => <option key={s.id} value={`subject:${s.id}`}>{s.label}</option>)}{props.scene.props?.map(p => <option key={p.id} value={`prop:${p.id}`}>{p.name}{p.locked ? " (locked)" : ""}</option>)}</select></label>{([ ["Left", "x", -.25], ["Right", "x", .25], ["Forward", "z", -.25], ["Back", "z", .25] ] as const).map(([label, axis, delta]) => <button className="pill" key={label} disabled={!selected||selectedProp?.locked} onClick={() => nudge(axis, delta)}>{label}</button>)}</div>
    {(selectedProp||selectedFigure)&&<div className="gr-space-toolbar" aria-label="Selected object controls">
      <label>Name<input aria-label="Selected object name" maxLength={selectedProp?60:24} value={selectedProp?.name??selectedFigure?.label??""} onChange={e=>selectedProp?props.onScene(editSpatialProp(props.scene,selectedId,{name:e.target.value},props.time)):props.onGrey({...props.grey,subjects:props.grey.subjects.map(s=>s.id===selectedId?{...s,label:e.target.value}:s)})}/></label>
      {selectedFigure&&<>
        <label>Facing<input aria-label="Selected figure facing" type="range" min={0} max={359} step={1} value={subjectFacing(selectedFigure)} onChange={e=>{props.onSeek(props.time);props.onGrey({...props.grey,subjects:props.grey.subjects.map(s=>s.id===selectedId?{...s,facing:Number(e.target.value)}:s)});}}/><output>{Math.round(subjectFacing(selectedFigure))}°</output></label>
        <button className="pill" onClick={()=>{props.onSeek(props.time);props.onGrey({...props.grey,subjects:props.grey.subjects.map(s=>s.id===selectedId?{...s,facing:faceCamera(s,props.grey.cam)}:s)});}}>Face camera</button>
      </>}
      {selectedProp&&<>
        <label>Material<select aria-label="Selected prop material" disabled={selectedProp.locked} value={selectedProp.material??""} onChange={e=>props.onScene(editSpatialProp(props.scene,selectedId,{material:materialSchema.safeParse(e.target.value).data},props.time))}><option value="">Original</option>{Object.keys(MATERIALS).map(m=><option key={m}>{m}</option>)}</select></label>
        <label>Size<input aria-label="Selected prop size" type="range" min={.03} max={1.5} step={.01} disabled={selectedProp.locked} value={selectedProp.w} onChange={e=>props.onScene(editSpatialProp(props.scene,selectedId,{w:Number(e.target.value)},props.time))}/></label>
        <label>Rotate<input aria-label="Selected prop rotation" type="range" min={0} max={359} step={1} disabled={selectedProp.locked} value={selectedProp.rotate} onChange={e=>props.onScene(editSpatialProp(props.scene,selectedId,{rotate:Number(e.target.value)},props.time))}/></label>
        <label><input aria-label="Lock selected prop" type="checkbox" checked={selectedProp.locked??false} onChange={e=>props.onScene(editSpatialProp(props.scene,selectedId,{locked:e.target.checked},props.time))}/>Locked</label>
        <label><input aria-label="Hide selected prop" type="checkbox" checked={selectedProp.hidden??false} onChange={e=>props.onScene(editSpatialProp(props.scene,selectedId,{hidden:e.target.checked},props.time))}/>Hidden</label>
      </>}
      {selectedProp&&<button className="pill" disabled={(props.scene.props?.length??0)>=100} onClick={()=>{const copied=duplicateSpatialProp(props.scene,selectedId);if(copied!==props.scene){props.onScene(copied);select(`prop:${copied.props!.at(-1)!.id}`);setNotice("Prop duplicated. The original and its source file are unchanged.");}}}>Duplicate selected prop</button>}
      <button className="pill" disabled={selectedProp?.locked} onClick={()=>{if(selectedProp)props.onScene(removeProp(props.scene,selectedId));else props.onGrey({...props.grey,subjects:props.grey.subjects.filter(s=>s.id!==selectedId)});select("");}}>Remove selected stand-in</button>
    </div>}
    {selectedProp&&<div className="gr-space-toolbar" aria-label="Selected prop motion">
      <button className="pill" disabled={selectedProp.locked} onClick={()=>{props.onSeek(props.time);props.onScene(keySpatialProp(props.scene,selectedId,props.time));}}>Save prop key</button>
      <button className="pill" disabled={selectedProp.locked||!propTimes.some(t=>Math.abs(t-props.time)<.05)} onClick={()=>{props.onSeek(props.time);props.onScene(keySpatialProp(props.scene,selectedId,props.time,true));}}>Remove prop key</button>
      <button className="pill" disabled={previousProp===undefined} onClick={()=>previousProp!==undefined&&props.onSeek(previousProp)}>Previous prop key</button>
      <button className="pill" disabled={nextProp===undefined||nextProp>CAM_SECONDS} onClick={()=>nextProp!==undefined&&props.onSeek(nextProp)}>Next prop key</button>
      <small>Save a starting key, move the time slider, then move or resize the prop. Keyed props animate automatically.</small>
    </div>}
    <p className="gr-hint">Drag Add box or a material into the room. On touch, choose a material then tap its surface. In the overhead view, drag the green camera marker to frame the shot; existing paths gain a key at the playhead. Select any object or the camera to use the move buttons. Changes save with this shot. Materials are colour studies; footage surfaces keep their existing texture controls.</p>
    <p className="gr-hint">The guide below carries materials and prop stand-ins into first frames and control videos. Image props use geometric stand-ins; their names describe the intended objects. Paid model output has not been verified.</p>
  </section>;
}
