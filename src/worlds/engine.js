// A lightweight procedural scene engine. Native Three.js; no remote inference, keys, or backend required.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { cameraAt, seeded, shotAt } from "./spec";

const PI = Math.PI;
const material = (hex, glow = 0, metalness = .22, roughness = .5) =>
  new THREE.MeshStandardMaterial({ color: hex, metalness, roughness, emissive: hex, emissiveIntensity: glow });
function buildObject(spec) {
  const root = new THREE.Group(); root.name = spec.id; root.userData.worldId = spec.id;
  const surface = material(spec.color, .03, .15, .6);
  const trim = material("#d7ccab", .05, .65, .3);
  const glow = material(spec.color, 1.25, .3, .18);
  const add = (geo, mat, xyz = [0, 0, 0], rot = [0, 0, 0]) => {
    const part = new THREE.Mesh(geo, mat);
    part.position.set(...xyz); part.rotation.set(...rot);
    part.castShadow = true; part.receiveShadow = true; root.add(part); return part;
  };
  switch (spec.kind) {
    case "island": {
      add(new THREE.CylinderGeometry(1.18, 1, .29, 11), surface);
      const peak = add(new THREE.ConeGeometry(1.05, 1.7, 11), material("#273c40", 0, .05, .88), [0, -.98, 0]); peak.rotation.z = PI;
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(.95 - i * .12, .022, 7, 72), i === 1 ? glow : trim, [0, -.13 + i * .12, 0], [-PI / 2, 0, 0]);
      for (let i = 0; i < 7; i++) { const a = i * 2 * PI / 7; add(new THREE.ConeGeometry(.08, .26, 5), trim, [Math.sin(a) * .8, .29, Math.cos(a) * .8]); }
      break;
    }
    case "portal":
      add(new THREE.TorusGeometry(1, .09, 12, 96), trim);
      add(new THREE.TorusGeometry(.83, .025, 8, 96), glow);
      { const ring = add(new THREE.TorusGeometry(1.18, .015, 8, 110), glow); ring.userData.spin = true; }
      for (let i = 0; i < 10; i++) { const a = i * PI / 5; add(new THREE.OctahedronGeometry(.075), glow, [Math.cos(a) * 1.04, Math.sin(a) * 1.04, 0]); }
      break;
    case "crystal":
      for (let i = 0; i < 4; i++) { const a = i * PI / 2; const c = add(new THREE.OctahedronGeometry(.28 + i % 2 * .09), i === 0 ? glow : surface, [Math.sin(a) * .22, .25, Math.cos(a) * .23]); c.scale.y = 1.5 + i * .3; }
      break;
    case "monolith":
      add(new THREE.CylinderGeometry(.2, .31, 1.7, 6), surface, [0, .85, 0]);
      add(new THREE.ConeGeometry(.3, .36, 6), trim, [0, 1.85, 0]);
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(.25, .015, 6, 40), glow, [0, .4 + i * .4, 0], [-PI / 2, 0, 0]);
      break;
    case "tower":
      add(new THREE.BoxGeometry(.7, 1, .7), material("#172332", .02, .45, .35));
      for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) add(new THREE.BoxGeometry(.12, .027, .01), glow, [-.22 + j * .2, -.4 + i * .16, .359]);
      add(new THREE.BoxGeometry(.78, .04, .78), trim, [0, .51, 0]);
      break;
    case "ground":
      add(new THREE.PlaneGeometry(120, 120), surface, [0, 0, 0], [-PI / 2, 0, 0]);
      break;
    case "rock":
      for (let i = 0; i < 4; i++) { const r = add(new THREE.DodecahedronGeometry(.45 + i * .05), surface, [(i - 2) * .3, .1, Math.sin(i * 2) * .3]); r.scale.set(1, .62, 1); }
      break;
    case "arch":
      for (let i = 0; i < 2; i++) add(new THREE.CylinderGeometry(.18, .3, 1.8, 7), surface, [i ? .86 : -.86, .85, 0]);
      add(new THREE.TorusGeometry(.86, .22, 8, 42, PI), surface, [0, 1.75, 0]);
      add(new THREE.TorusGeometry(.87, .025, 8, 64, PI), glow, [0, 1.75, .07]);
      break;
    case "orb":
      add(new THREE.IcosahedronGeometry(.48, 2), glow);
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(.67, .018, 6, 70), trim, [0, 0, 0], [i * 1.1, i * .4, i * .9]);
      break;
    case "cube": add(new THREE.BoxGeometry(1, 1, 1), surface); break;
    case "sphere": add(new THREE.SphereGeometry(.5, 28, 20), surface); break;
  }
  root.position.set(...spec.position); root.rotation.set(...spec.rotation);
  if (spec.kind === "tower") root.scale.set(spec.width || 1, spec.scale, spec.width || 1);
  else root.scale.setScalar(spec.scale);
  return root;
}
export class HaggsWorldEngine {
  constructor(canvas, onSelect = () => {}, onEdit = () => {}, onTick = () => {}) {
    this.canvas = canvas; this.onSelect = onSelect; this.onEdit = onEdit; this.onTick = onTick;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25; this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 16 / 9, .08, 550);
    this.camera.position.set(13, 7, 14);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0); this.controls.minDistance = .7; this.controls.maxDistance = 90;
    this.transform = new TransformControls(this.camera, canvas);
    this.scene.add(this.transform.getHelper());
    this.transform.addEventListener("dragging-changed", event => { this.controls.enabled = !event.value && !this.filmMode; });
    this.transform.addEventListener("objectChange", () => {
      if (!this.selected || !this.world) return;
      const o = this.world.objects.find(item => item.id === this.selected.userData.worldId);
      if (!o) return;
      o.position = this.selected.position.toArray().map(v => +v.toFixed(4));
      o.rotation = [this.selected.rotation.x, this.selected.rotation.y, this.selected.rotation.z].map(v => +v.toFixed(4));
      o.scale = this.selected.scale.y;
      if (o.kind === "tower") o.width = this.selected.scale.x;
      this.onSelect(o); this.onEdit();
    });
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.decoration = new THREE.Group(); this.scene.add(this.decoration);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.selected = null; this.time = 0; this.playing = false; this.filmMode = false; this.previous = 0;
    this.pointerListener = e => this.pick(e); canvas.addEventListener("pointerup", this.pointerListener);
    this.resizeListener = () => this.resize();
    this.observer = new ResizeObserver(this.resizeListener); this.observer.observe(canvas);
    this.loop = this.loop.bind(this); this.resize(); this.raf = requestAnimationFrame(this.loop);
  }
  resize() {
    const width = Math.max(1, this.canvas.clientWidth), height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false); this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
  }
  clear() {
    this.select(null);
    const release = root => root.traverse(node => {
      if (node.isMesh || node.isPoints) {
        node.geometry?.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of materials) m?.dispose();
      }
    });
    release(this.root); release(this.decoration);
    this.root.clear(); this.decoration.clear();
    for (const child of [...this.scene.children]) if (child.isLight) this.scene.remove(child);
  }
  load(world) {
    this.world = world; this.clear();
    const bg = world.preset === "neon" ? "#080c1d" : world.preset === "dunes" ? "#241c21" : "#091720";
    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.FogExp2(bg, .008 + world.environment.fog * .022);
    this.hemisphere = new THREE.HemisphereLight(world.preset === "dunes" ? "#ffe3bf" : "#b7f2ff", "#101521", 2.4); this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight(world.preset === "dunes" ? "#ffc38a" : "#e5fff1", 3.4);
    this.sun.position.set(-7, 13, 9); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -30; this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30; this.sun.shadow.camera.bottom = -30; this.scene.add(this.sun);
    this.rim = new THREE.PointLight(world.environment.accent, 100, 45, 2);
    this.rim.position.set(1, 5, 0); this.scene.add(this.rim);
    for (const o of world.objects) this.root.add(buildObject(o));
    const rand = seeded(world.seed + 817), positions = new Float32Array(450 * 3);
    for (let i = 0; i < 450; i++) { const a = rand() * PI * 2, r = 5 + rand() * 55; positions[i * 3] = Math.cos(a) * r; positions[i * 3 + 1] = rand() * 19 - 3; positions[i * 3 + 2] = Math.sin(a) * r; }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: world.preset === "dunes" ? "#ffe6ca" : "#d9fff0", size: .06, transparent: true, opacity: .65 }));
    this.decoration.add(this.stars);
    this.time = 0; this.camera.position.set(...world.film.shots[0].from); this.controls.target.set(0, 1.5, 0);
    this.updateEnvironment(); this.controls.update(); this.setTime(0);
  }
  updateEnvironment() {
    if (!this.world) return;
    const e = this.world.environment;
    if (this.scene.fog) this.scene.fog.density = .008 + e.fog * .022;
    if (this.sun) { this.sun.intensity = 1.2 + e.daylight * 4; this.sun.position.set(-7 + (1 - e.daylight) * 13, 7 + e.daylight * 13, 9); }
    if (this.hemisphere) this.hemisphere.intensity = 1 + e.daylight * 3;
    if (this.rim) this.rim.color.set(e.accent);
  }
  select(group) {
    this.transform.detach(); this.selected = group;
    if (group) this.transform.attach(group);
    const o = group && this.world ? this.world.objects.find(item => item.id === group.userData.worldId) : null;
    this.onSelect(o || null);
  }
  pick(event) {
    if (this.filmMode || this.transform.dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.root.children, true)[0];
    let node = hit?.object;
    while (node && !node.userData.worldId) node = node.parent;
    this.select(node?.userData.worldId ? node : null);
  }
  setTool(mode) { this.transform.setMode(mode); }
  add(kind) {
    if (!this.world) return;
    const id = `new-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999)}`;
    const o = { id, kind, position: this.controls.target.toArray().map(v => +v.toFixed(2)), rotation: [0, 0, 0], scale: 1, color: this.world.environment.accent };
    this.world.objects.push(o); const node = buildObject(o); this.root.add(node); this.select(node); this.onEdit(); return o;
  }
  removeSelected() {
    if (!this.selected || !this.world) return;
    const node = this.selected, id = node.userData.worldId;
    this.select(null); this.root.remove(node); this.world.objects = this.world.objects.filter(o => o.id !== id);
    node.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.onEdit();
  }
  setTime(time) {
    if (!this.world) return;
    this.time = Math.max(0, Math.min(this.world.film.duration, Number(time) || 0));
    this.root.traverse(node => { if (node.userData.spin) node.rotation.z = this.time * .2 * this.world.environment.motion; });
    if (this.stars) this.stars.rotation.y = this.time * .004 * this.world.environment.motion;
    if (this.filmMode) {
      const state = cameraAt(shotAt(this.world, this.time), this.time);
      this.camera.position.set(...state.position); this.camera.lookAt(...state.target);
      this.camera.fov = 2 * Math.atan(36 / (2 * state.lensMm)) * 180 / PI; this.camera.updateProjectionMatrix();
      this.controls.target.set(...state.target);
    }
  }
  setFilmMode(value) {
    this.filmMode = Boolean(value);
    this.controls.enabled = !this.filmMode; this.transform.getHelper().visible = !this.filmMode;
    if (this.filmMode) this.setTime(this.time);
    else { this.camera.fov = 48; this.camera.updateProjectionMatrix(); }
  }
  setCameraKey(shotIndex, end) {
    const shot = this.world?.film.shots[shotIndex]; if (!shot) return;
    const xyz = this.camera.position.toArray().map(v => +v.toFixed(3));
    const target = this.controls.target.toArray().map(v => +v.toFixed(3));
    if (end) { shot.to = xyz; shot.lookTo = target; }
    else { shot.from = xyz; shot.lookFrom = target; }
    this.onEdit();
  }
  screenshot() { this.renderer.render(this.scene, this.camera); return this.canvas.toDataURL("image/png"); }
  exportGLB() {
    const copy = this.root.clone(true);
    return new Promise((resolve, reject) => new GLTFExporter().parse(copy, buf => resolve(new Blob([buf], { type: "model/gltf-binary" })), reject, { binary: true, trs: true }));
  }
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    const delta = Math.min(.05, (now - (this.previous || now)) / 1000); this.previous = now;
    if (this.playing && this.world) { this.setTime(this.time + delta); if (this.time >= this.world.film.duration) this.playing = false; this.onTick(this.time, this.playing); }
    if (!this.filmMode) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    cancelAnimationFrame(this.raf); this.observer.disconnect(); this.canvas.removeEventListener("pointerup", this.pointerListener);
    this.clear(); this.controls.dispose(); this.transform.dispose(); this.renderer.dispose();
  }
}
