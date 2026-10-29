/**
 * A featured 3D code game: lead a swarm of sprouts through math gates, clash
 * with beetle squads and storm the Weed King. Everything on screen is built
 * from three.js shapes, so it looks finished before any art is made.
 */
export const SPROUT_SWARM = String.raw`const W = HAGGS.W, H = HAGGS.H, rnd = HAGGS.rand(5), MAX = 360, LANE = 3.4;
const R = new THREE.WebGLRenderer({ canvas: HAGGS.canvas, antialias: true });
R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); R.setSize(W, H, false);
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = HAGGS.texture("sky");
scene.fog = new THREE.Fog(new THREE.Color("#bfe6ff"), 45, 120);
const cam = new THREE.PerspectiveCamera(52, W / H, 0.1, 300);
scene.add(new THREE.HemisphereLight(0xfafcff, 0x7fae5a, 1.25));
const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
sun.position.set(-7, 16, 9); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 14, bottom: -14, near: 1, far: 60 });
scene.add(sun); scene.add(sun.target);

// ── the world: a garden path that scrolls ──
function stripes(a, b, w, h, n) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(0, (i * h) / n, w, h / n + 1); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
const pathTex = stripes("#f2d9a6", "#ead09a", 8, 64, 2); pathTex.repeat.set(1, 60);
const path = new THREE.Mesh(new THREE.PlaneGeometry(LANE * 2 + 0.6, 240), new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.95 }));
path.rotation.x = -Math.PI / 2; path.position.z = -100; path.receiveShadow = true; scene.add(path);
const grassTex = stripes("#7cc957", "#72bd4f", 8, 64, 2); grassTex.repeat.set(1, 60);
for (const s of [-1, 1]) {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(40, 240), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(s * (LANE + 20.3), -0.01, -100); grass.receiveShadow = true; scene.add(grass);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 240), new THREE.MeshStandardMaterial({ color: "#a8764a", roughness: 0.8 }));
  rail.position.set(s * (LANE + 0.45), 0.17, -100); rail.castShadow = true; scene.add(rail);
}
// Flowers and shrubs along the sides, recycled as the path scrolls.
const shrubs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: "#4fa63f", flatShading: true }), 40);
const blooms = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ flatShading: true }), 40);
shrubs.castShadow = true; scene.add(shrubs); scene.add(blooms);
const deco = [];
const BLOOM = ["#ff6fa8", "#ffd34d", "#ffffff", "#b08cff", "#ff8a3d"];
for (let i = 0; i < 40; i++) { deco.push({ x: (i % 2 ? 1 : -1) * (LANE + 1.8 + rnd() * 9), z: -rnd() * 120 + 10, s: 0.6 + rnd() * 0.9 }); blooms.setColorAt(i, new THREE.Color(BLOOM[i % BLOOM.length])); }
const dummy = new THREE.Object3D();

// ── the swarm ──
const bodyGeo = new THREE.SphereGeometry(0.26, 14, 10), leafGeo = new THREE.SphereGeometry(0.13, 8, 6), eyeGeo = new THREE.SphereGeometry(0.05, 6, 5);
const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ color: "#7be06a", roughness: 0.55 }), MAX);
const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: "#2f9e44", roughness: 0.6 }), MAX);
const eyes = new THREE.InstancedMesh(eyeGeo, new THREE.MeshBasicMaterial({ color: "#1b1b1b" }), MAX * 2);
for (const m of [bodies, leaves, eyes]) { m.frustumCulled = false; m.castShadow = m !== eyes; scene.add(m); }
const mx = new Float32Array(MAX), mz = new Float32Array(MAX), born = new Float32Array(MAX);
const slot = (i) => { const r = 0.34 * Math.sqrt(i + 0.5), a = i * 2.39996; return [r * Math.cos(a), r * Math.sin(a) * 0.85]; };
const spread = (n) => 0.34 * Math.sqrt(n + 0.5);

// ── beetles ──
const beetleBody = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 12, 9), new THREE.MeshStandardMaterial({ color: "#e2463c", roughness: 0.35, metalness: 0.1 }), 240);
const beetleHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: "#2a2230" }), 240);
for (const m of [beetleBody, beetleHead]) { m.frustumCulled = false; m.castShadow = true; scene.add(m); }

// ── gates ──
function labelTex(text, good) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 160; const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 160); grad.addColorStop(0, good ? "rgba(70,170,255,.92)" : "rgba(255,80,96,.92)"); grad.addColorStop(1, good ? "rgba(40,110,230,.92)" : "rgba(210,40,70,.92)");
  g.fillStyle = grad; g.beginPath(); g.roundRect ? g.roundRect(6, 6, 244, 148, 26) : g.rect(6, 6, 244, 148); g.fill();
  g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 8; g.stroke();
  g.fillStyle = "#fff"; g.font = "900 92px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 8; g.fillText(text, 128, 86);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const opText = (o) => (o.k === "+" ? "+" : o.k === "-" ? "−" : o.k === "x" ? "×" : "÷") + o.v;
const apply = (n, o) => Math.max(0, Math.min(MAX, Math.round(o.k === "+" ? n + o.v : o.k === "-" ? n - o.v : o.k === "x" ? n * o.v : n / o.v)));
const isGood = (o) => o.k === "+" || o.k === "x";
const postMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 }), postGeo = new THREE.CylinderGeometry(0.12, 0.12, 3, 8);
const sawGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.16, 18), sawMat = new THREE.MeshStandardMaterial({ color: "#c7ced6", metalness: 0.85, roughness: 0.25 });
const gemMat = new THREE.SpriteMaterial({ map: HAGGS.texture("gem") });

// ── levels ──
const LEVELS = [
  { name: "Level 1: The Veg Patch", events: 8, squads: [3, 7], saws: 0, boss: 0.45, gap: 17 },
  { name: "Level 2: Beetle Bridge", events: 11, squads: [6, 14], saws: 1, boss: 0.85, gap: 16 },
  { name: "Level 3: The Weed King", events: 14, squads: [10, 24], saws: 2, boss: 1, gap: 15 },
];
let level = 0, count = 10, cx = 0, events = [], fight = null, gems = 0, score = 0, doneT = -1, won = false, banner = { t: 0, text: "" }, bump = 0, lastPx = null, speed = 8.5, travelled = 0, length = 1, clearT = -1;

function makeGate(z, ops) {
  const group = new THREE.Group(); group.position.z = z; scene.add(group);
  const panels = ops.map((o, side) => {
    const x = side ? LANE / 2 + 0.1 : -LANE / 2 - 0.1;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(LANE - 0.3, 1.9), new THREE.MeshBasicMaterial({ map: labelTex(opText(o), isGood(o)), transparent: true, side: THREE.DoubleSide }));
    panel.position.set(x, 1.6, 0); group.add(panel);
    for (const px of [x - LANE / 2 + 0.2, x + LANE / 2 - 0.2]) { const post = new THREE.Mesh(postGeo, postMat); post.position.set(px, 1.5, 0); post.castShadow = true; group.add(post); }
    return panel;
  });
  return { type: "gates", z, ops, group, panels, used: false };
}
function goodOp(l) { const r = rnd(); return r < 0.35 ? { k: "x", v: r < 0.1 && l > 0 ? 3 : 2 } : { k: "+", v: 5 + Math.floor(rnd() * (8 + l * 6)) }; }
function badOp(l) { const r = rnd(); return r < 0.3 ? { k: "÷", v: 2 } : { k: "-", v: 3 + Math.floor(rnd() * (6 + l * 6)) }; }
function buildLevel(l) {
  for (const e of events) if (e.group) scene.remove(e.group);
  events = []; fight = null; travelled = 0;
  const L = LEVELS[l];
  // How a so-so run goes: the average of both gates each time, minus every fight.
  let z = -24, est = count;
  for (let i = 0; i < L.events; i++) {
    const r = rnd();
    if (i > 2 && i % 3 === 0) {
      const n = Math.round(L.squads[0] + rnd() * (L.squads[1] - L.squads[0]));
      const group = new THREE.Group(); group.position.z = z; scene.add(group);
      events.push({ type: "squad", z, n, x: (rnd() - 0.5) * 2.4, group, t: 0 }); est = Math.max(4, est - n);
    } else if (L.saws && i > 2 && r < 0.22 * L.saws) {
      const saw = new THREE.Mesh(sawGeo, sawMat); saw.castShadow = true; saw.position.y = 0.5;
      const group = new THREE.Group(); group.position.z = z; group.add(saw); scene.add(group);
      events.push({ type: "saw", z, group, saw, x0: (rnd() - 0.5) * 2, amp: 1.6 + rnd() * 1.2, t: rnd() * 6 }); est = Math.max(4, est - 3);
    } else {
      const good = goodOp(l), other = rnd() < 0.25 ? goodOp(l) : badOp(l), ops = rnd() < 0.5 ? [good, other] : [other, good];
      events.push(makeGate(z, ops)); est = Math.max(4, (apply(est, ops[0]) + apply(est, ops[1])) / 2);
    }
    for (let k = 0; k < 3; k++) if (rnd() < 0.5) { const s = new THREE.Sprite(gemMat); s.scale.set(0.8, 0.8, 1); const group = new THREE.Group(); const gz = z + 5 + k * 1.5; group.position.z = gz; s.position.set((rnd() - 0.5) * 2 * (LANE - 0.6), 0.8, 0); group.add(s); scene.add(group); events.push({ type: "gem", z: gz, x: s.position.x, group, s }); }
    z -= L.gap;
  }
  // The Weed King: a thorny tower with a crown, as strong as a good run can be.
  // Strong enough to need good choices, not a perfect run.
  const hp = Math.max(10, Math.round(est * L.boss));
  const group = new THREE.Group(); group.position.z = z - 4; scene.add(group);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 5, 9), new THREE.MeshStandardMaterial({ color: "#3d7a3a", flatShading: true })); stem.position.y = 2.5; stem.castShadow = true; group.add(stem);
  for (let k = 0; k < 10; k++) { const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 6), new THREE.MeshStandardMaterial({ color: "#c94f7c", flatShading: true })); const a = k * 2.4, y = 0.8 + (k % 5) * 0.9; thorn.position.set(Math.cos(a) * 1.7, y, Math.sin(a) * 1.7); thorn.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); group.add(thorn); }
  const crown = new THREE.Sprite(new THREE.SpriteMaterial({ map: HAGGS.texture("boss") })); crown.scale.set(3, 3, 1); crown.position.y = 6.4; group.add(crown);
  events.push({ type: "boss", z: z - 4, hp, max: hp, group, crown, stem, t: 0 });
  length = -(z - 4);
  banner = { t: 2.2, text: L.name };
  HAGGS.music(l === 2 ? "heroic" : "upbeat");
}
function toScreen(x, y, z) { const v = new THREE.Vector3(x, y, z).project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H }; }
function lose(n, why) {
  const before = count; count = Math.max(0, count - n);
  for (let i = count; i < before; i++) { const p = toScreen(cx + mx[i], 0.4, mz[i]); HAGGS.burst(p.x, p.y, { n: 4, color: why === "saw" ? ["#7be06a", "#ffffff"] : ["#7be06a", "#ffd34d"], speed: 160, life: 0.45, size: 3.5 }); }
  bump = 0.25;
  if (count <= 0 && doneT < 0) { won = false; doneT = 1.6; HAGGS.sound("lose"); HAGGS.shake(0.8); HAGGS.music(null); }
}
function grow(to) {
  for (let i = count; i < to; i++) { mx[i] = 0; mz[i] = 0; born[i] = 0; }
  count = to; bump = 0.35;
}
buildLevel(0);

HAGGS.start({
  update(dt) {
    banner.t -= dt; bump = Math.max(0, bump - dt);
    if (doneT >= 0) { doneT -= dt; if (doneT <= 0) HAGGS.end({ won, score }); }
    if (clearT >= 0) {
      clearT -= dt;
      if (clearT <= 0) { clearT = -1; if (level >= LEVELS.length - 1) { won = true; doneT = 0.1; } else { level++; count = Math.max(count, 10 + level * 4); buildLevel(level); } }
    }
    // Steer: drag, keys or the stick. The swarm keeps inside the path.
    const p = HAGGS.pointer, room = Math.max(0.3, LANE - 0.3 - spread(count) * 0.7);
    if (p.down) { if (lastPx !== null) cx += (p.x - lastPx) / W * 14; lastPx = p.x; } else lastPx = null;
    cx += HAGGS.axis().x * 7 * dt; cx = HAGGS.clamp(cx, -room, room);

    const moving = !fight && doneT < 0 && clearT < 0;
    const sp = moving ? speed + level * 1.5 : 0;
    travelled += sp * dt;
    pathTex.offset.y += sp * dt / 4; grassTex.offset.y += sp * dt / 4;
    for (const d of deco) { d.z += sp * dt; if (d.z > 12) d.z -= 130; }

    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      e.z += sp * dt; e.group.position.z = e.z;
      if (e.type === "gates" && !e.used && e.z > -0.2) {
        e.used = true; const side = cx < 0 ? 0 : 1, o = e.ops[side], to = apply(count, o), gain = to - count;
        e.panels[side].material.opacity = 0.25; e.panels[1 - side].material.opacity = 0.55;
        const s = toScreen(cx, 1.6, 0);
        if (to > count) { grow(to); HAGGS.sound("powerup"); HAGGS.float("+" + gain, s.x, s.y - 40, { color: "#7be06a", size: 34 }); HAGGS.burst(s.x, s.y, { n: 24, color: ["#7be06a", "#ffffff", "#ffd34d"], speed: 260 }); score += gain * 5; }
        else if (to < count) { lose(count - to, "gate"); HAGGS.sound("hit"); HAGGS.shake(0.35); HAGGS.float(String(gain), s.x, s.y - 40, { color: "#ff6b6b", size: 34 }); if (count <= 0) continue; }
        HAGGS.score(score);
      }
      if (e.type === "saw") {
        e.t += dt; const sx = e.x0 + Math.sin(e.t * 2.2) * e.amp; e.saw.position.x = sx; e.saw.rotation.y += dt * 14;
        if (Math.abs(e.z) < spread(count) + 1) {
          let hit = 0;
          for (let k = count - 1; k >= 0; k--) if (Math.abs(e.z - mz[k]) < 0.55 && Math.abs(sx - (cx + mx[k])) < 0.95) { mx[k] = mx[count - 1 - hit]; mz[k] = mz[count - 1 - hit]; hit++; }
          if (hit) { lose(hit, "saw"); HAGGS.sound("hit"); HAGGS.shake(0.25); const s = toScreen(sx, 0.6, e.z); HAGGS.burst(s.x, s.y, { n: 14, color: ["#ffffff", "#c7ced6"], speed: 300, life: 0.35, size: 2.5 }); }
        }
      }
      if (e.type === "gem" && e.z > -0.6 && e.z < 0.8 && Math.abs(e.x - cx) < spread(count) * 0.8 + 0.6) {
        gems++; score += 25; HAGGS.score(score); HAGGS.sound("coin"); const s = toScreen(e.x, 0.8, e.z); HAGGS.float("+25", s.x, s.y - 20, { color: "#9ef0ff", size: 18 }); HAGGS.burst(s.x, s.y, { n: 10, color: ["#9ef0ff", "#ffffff"], speed: 150 });
        scene.remove(e.group); events.splice(i, 1); continue;
      }
      if ((e.type === "squad" || e.type === "boss") && !fight && e.z > -(spread(count) + (e.type === "boss" ? 2.6 : 1.4))) { fight = { e, tick: 0, rate: 0.09 }; HAGGS.sound(e.type === "boss" ? "powerup" : "hit"); if (e.type === "boss") { HAGGS.flash("#fff3a0", 0.2); HAGGS.shake(0.4); } }
      if (e.z > 14) { scene.remove(e.group); events.splice(i, 1); }
    }

    if (fight) {
      const e = fight.e; fight.tick -= dt;
      while (fight.tick <= 0 && count > 0 && (e.type === "boss" ? e.hp > 0 : e.n > 0)) {
        fight.tick += fight.rate; fight.rate = Math.max(0.025, fight.rate * 0.96);
        if (e.type === "boss") { e.hp--; score += 10; } else { e.n--; score += 15; }
        lose(1, "fight"); HAGGS.sound(rnd() < 0.5 ? "shoot" : "hit");
        const s = toScreen(cx + (rnd() - 0.5) * 1.5, 0.6, e.z + (e.type === "boss" ? 1.8 : 0.4));
        HAGGS.burst(s.x, s.y, { n: 8, color: e.type === "boss" ? ["#c94f7c", "#7be06a"] : ["#e2463c", "#7be06a", "#ffffff"], speed: 220, life: 0.4 });
        if (rnd() < 0.25) HAGGS.shake(0.15);
      }
      HAGGS.score(score);
      if (count > 0 && (e.type === "boss" ? e.hp <= 0 : e.n <= 0)) {
        if (e.type === "boss") {
          scene.remove(e.group); events.splice(events.indexOf(e), 1);
          score += count * 50 + gems * 10; HAGGS.score(score);
          HAGGS.sound("win"); HAGGS.flash("#ffffff", 0.35); HAGGS.shake(0.9);
          for (let k = 0; k < 6; k++) HAGGS.burst(W * (0.15 + k * 0.14), H * 0.35, { n: 30, color: ["#ff6fa8", "#ffd34d", "#7be06a", "#6fc3ff", "#ffffff"], speed: 380, gravity: 500, life: 1.4, size: 5 });
          banner = { t: 2, text: level >= LEVELS.length - 1 ? "The garden is saved!" : "Weed King down!" }; clearT = 2.2; HAGGS.music(null);
        } else { scene.remove(e.group); events.splice(events.indexOf(e), 1); HAGGS.sound("explode"); }
        fight = null;
      }
    }
  },
  draw() {
    const t = HAGGS.time, sp = spread(count);
    // The swarm, easing into its spiral and bobbing as it runs.
    for (let i = 0; i < count; i++) {
      const [tx, tz] = slot(i); born[i] = Math.min(1, born[i] + 0.06);
      mx[i] += (tx - mx[i]) * 0.18; mz[i] += (tz - mz[i]) * 0.18;
      const run = fight || doneT >= 0 ? 0.35 : 1, bob = Math.abs(Math.sin(t * 13 + i * 1.7)) * 0.16 * run, s = HAGGS.ease.back(born[i]) * (1 + (bump > 0 && i % 3 === 0 ? bump * 0.4 : 0));
      const x = cx + mx[i], z = mz[i], y = 0.26 + bob;
      dummy.position.set(x, y, z); dummy.rotation.set(0, Math.sin(t * 6 + i) * 0.2, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x + 0.05, y + 0.27 * s, z); dummy.rotation.set(0.3, i, -0.6); dummy.scale.set(s, s * 0.45, s * 0.75); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(s);
      for (const ex of [-0.09, 0.09]) { dummy.position.set(x + ex * s, y + 0.06 * s, z - 0.22 * s); dummy.updateMatrix(); eyes.setMatrixAt(i * 2 + (ex > 0 ? 1 : 0), dummy.matrix); }
    }
    bodies.count = leaves.count = count; eyes.count = count * 2;
    bodies.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = eyes.instanceMatrix.needsUpdate = true;
    // Beetle squads in tight blobs.
    let b = 0;
    for (const e of events) {
      if (e.type === "squad") { e.t += 1 / 60; for (let k = 0; k < e.n && b < 240; k++, b++) { const [ox, oz] = slot(k); const x = e.x + ox, z = e.z + oz * 0.9, y = 0.25 + Math.abs(Math.sin(t * 9 + k)) * (fight && fight.e === e ? 0.12 : 0.03); dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 0.75, 1.2); dummy.updateMatrix(); beetleBody.setMatrixAt(b, dummy.matrix); dummy.position.set(x, y + 0.05, z + 0.35); dummy.scale.setScalar(1); dummy.updateMatrix(); beetleHead.setMatrixAt(b, dummy.matrix); } }
      if (e.type === "gem") e.s.material.rotation = t * 2;
      if (e.type === "boss") { e.t += 1 / 60; e.crown.position.y = 6.4 + Math.sin(e.t * 2) * 0.25; e.stem.scale.setScalar(0.6 + 0.4 * (e.hp / e.max) + (fight && fight.e === e ? Math.sin(t * 40) * 0.02 : 0)); }
    }
    beetleBody.count = beetleHead.count = b; beetleBody.instanceMatrix.needsUpdate = beetleHead.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < deco.length; i++) { const d = deco[i]; dummy.position.set(d.x, 0.5 * d.s, d.z); dummy.rotation.set(0, i, 0); dummy.scale.setScalar(d.s); dummy.updateMatrix(); shrubs.setMatrixAt(i, dummy.matrix); dummy.position.y = 1.1 * d.s; dummy.position.x += 0.4; dummy.updateMatrix(); blooms.setMatrixAt(i, dummy.matrix); }
    shrubs.instanceMatrix.needsUpdate = blooms.instanceMatrix.needsUpdate = true;
    // The camera pulls back as the swarm grows.
    const back = 9 + sp * 1.6;
    cam.position.set(HAGGS.lerp(cam.position.x || 0, cx * 0.55, 0.1), 7.5 + sp * 1.1, back);
    cam.lookAt(cx * 0.55, 0, -7 - sp);
    sun.position.set(cx - 7, 16, 9); sun.target.position.set(cx, 0, -4);
    R.render(scene, cam);

    // HUD: the count over the swarm, progress, gems.
    const g = HAGGS.hud, head = toScreen(cx, 1.1 + sp * 0.3, 0);
    const pop = 1 + bump * 1.2, label = String(count);
    g.save(); g.translate(head.x, head.y - 30); g.scale(pop, pop);
    g.fillStyle = "rgba(20,40,20,.75)"; g.beginPath(); g.roundRect ? g.roundRect(-34, -22, 68, 44, 22) : g.rect(-34, -22, 68, 44); g.fill();
    g.restore();
    HAGGS.text(label, head.x, head.y - 18, { ctx: g, size: 28 * pop, align: "center", color: "#ffffff" });
    for (const e of events) if (e.type === "squad" || e.type === "boss") {
      if (e.z < -60) continue;
      const s = toScreen(e.type === "boss" ? 0 : e.x, e.type === "boss" ? 5.4 : 1.4, e.z), y = Math.max(110, s.y);
      if (e.type === "boss") { g.fillStyle = "rgba(60,10,30,.7)"; g.beginPath(); g.roundRect ? g.roundRect(s.x - 46, y - 30, 92, 40, 20) : g.rect(s.x - 46, y - 30, 92, 40); g.fill(); }
      HAGGS.text(String(e.type === "boss" ? e.hp : e.n), s.x, y, { ctx: g, size: e.type === "boss" ? 30 : 24, align: "center", color: e.type === "boss" ? "#ffd34d" : "#ffd0cc" });
    }
    g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(24, 26, W - 48, 12);
    g.fillStyle = "#7be06a"; g.fillRect(24, 26, (W - 48) * Math.min(1, travelled / length), 12);
    HAGGS.text("Lv " + (level + 1), 24, 64, { ctx: g, size: 20 });
    HAGGS.text("💎 " + gems, W - 24, 64, { ctx: g, size: 20, align: "right" });
    if (banner.t > 0) { const k = Math.min(1, banner.t * 2); HAGGS.text(banner.text, W / 2, H * 0.3, { ctx: g, size: 36, align: "center", color: "rgba(255,255,255," + k + ")" }); }
    if (t < 4 && level === 0) HAGGS.text("Drag or ← → to steer through the best gate", W / 2, H - 46, { ctx: g, size: 18, align: "center" });
  },
});`;
