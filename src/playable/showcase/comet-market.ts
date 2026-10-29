/** A featured 3D code game (beta): a night-market lane runner where every ten coins starts a Rush. */
export const COMET_MARKET = String.raw`const W = HAGGS.W, H = HAGGS.H, rnd = HAGGS.rand(11), LANES = [-2.6, 0, 2.6], GOAL = 1200;
const renderer = new THREE.WebGLRenderer({ canvas: HAGGS.canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(W, H, false);
const scene = new THREE.Scene();
scene.background = HAGGS.texture("sky");
scene.fog = new THREE.Fog(new THREE.Color(HAGGS.palette.sky), 30, 95);
const camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(4, 10, 6); scene.add(sun);

const roadTex = HAGGS.texture("road");
roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, 18);
const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 240), new THREE.MeshStandardMaterial({ map: roadTex }));
road.rotation.x = -Math.PI / 2; road.position.z = -100; scene.add(road);
const sideMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(HAGGS.palette.ground) });
for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(60, 240), sideMat); side.rotation.x = -Math.PI / 2; side.position.set(s * 34.5, -0.02, -100); scene.add(side); }

const hero = new THREE.Sprite(new THREE.SpriteMaterial({ map: HAGGS.texture("hero") }));
hero.scale.set(1.9, 1.9, 1); scene.add(hero);
const crateGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8), crateMat = new THREE.MeshStandardMaterial({ map: HAGGS.texture("crate") });
const coinMat = new THREE.SpriteMaterial({ map: HAGGS.texture("coin") });

const P = { lane: 1, x: 0, y: 0, vy: 0, lives: 3, hurt: 0 };
let things = [], dist = 0, speed = 16, coins = 0, spawnZ = -30, doneT = -1, won = false, swipeY = null, swipeX = null, rush = 0, district = 0, banner = 2.2;
const DISTRICTS = [["Lantern Row", "#1b1440"], ["Moon Bridge", "#0f2a44"], ["Rooftop Bazaar", "#3a1430"]];
const heroOnScreen = () => ({ x: W / 2 + P.x * 46, y: H * 0.66 - P.y * 30 });
HAGGS.music("upbeat");

function spawnRow(z) {
  const open = Math.floor(rnd() * 3);
  for (let l = 0; l < 3; l++) {
    if (l === open) { if (rnd() < 0.7) for (let k = 0; k < 3; k++) addCoin(l, z - k * 2.4); continue; }
    if (rnd() < 0.55 + Math.min(0.3, dist / 4000)) { const m = new THREE.Mesh(crateGeo, crateMat); m.position.set(LANES[l], 0.9, z); scene.add(m); things.push({ kind: "crate", lane: l, m }); }
  }
}
function addCoin(l, z) { const s = new THREE.Sprite(coinMat); s.scale.set(0.9, 0.9, 1); s.position.set(LANES[l], 1.1, z); scene.add(s); things.push({ kind: "coin", lane: l, m: s }); }
function score() { return Math.floor(dist) + coins * 25; }
function finish(w) { if (doneT >= 0) return; won = w; doneT = 1.2; HAGGS.score(score()); }
for (let z = -30; z > -110; z -= 13) spawnRow(z);
spawnZ = -110;

HAGGS.start({
  update(dt) {
    banner -= dt; rush -= dt;
    const d2 = Math.min(2, Math.floor(dist / 400));
    if (d2 !== district) { district = d2; banner = 2.2; HAGGS.sound("powerup"); HAGGS.flash("#ffffff", 0.2); scene.fog.color.set(DISTRICTS[d2][1]); }
    if (doneT >= 0) { doneT -= dt; speed *= 0.95; if (doneT <= 0) HAGGS.end({ won, score: score() }); }
    else {
      if (HAGGS.pressed("left")) P.lane = Math.max(0, P.lane - 1);
      if (HAGGS.pressed("right")) P.lane = Math.min(2, P.lane + 1);
      const p = HAGGS.pointer;
      if (p.pressed) { swipeX = p.x; swipeY = p.y; }
      if (p.released && swipeY !== null) {
        const dx = p.x - swipeX, dy = p.y - swipeY;
        if (dy < -40 && Math.abs(dy) > Math.abs(dx)) jump();
        else if (Math.abs(dx) > 30) P.lane = Math.max(0, Math.min(2, P.lane + Math.sign(dx)));
        else P.lane = Math.max(0, Math.min(2, P.lane + (p.x < W / 2 ? -1 : 1)));
        swipeY = null;
      }
      if (HAGGS.pressed("a") || HAGGS.pressed("up")) jump();
      speed = Math.min(34, 16 + dist / 70) * (rush > 0 ? 1.5 : 1);
      dist += speed * dt * 0.6;
      if (Math.floor(dist / 100) !== Math.floor((dist - speed * dt * 0.6) / 100)) HAGGS.score(score());
      if (dist >= GOAL) finish(true);
    }
    P.x += (LANES[P.lane] - P.x) * Math.min(1, dt * 14);
    P.vy -= 30 * dt; P.y = Math.max(0, P.y + P.vy * dt); if (P.y === 0) P.vy = Math.max(0, P.vy);
    P.hurt -= dt;
    hero.position.set(P.x, 1 + P.y, 0);
    hero.material.opacity = P.hurt > 0 && Math.floor(P.hurt * 12) % 2 ? 0.35 : 1; hero.material.transparent = true;
    roadTex.offset.y -= speed * dt / 13.3;

    const move = speed * dt;
    spawnZ += move;
    while (spawnZ > -97) { spawnRow(spawnZ - 13); spawnZ -= 13; }
    for (let i = things.length - 1; i >= 0; i--) {
      const t = things[i]; t.m.position.z += move;
      if (t.kind === "coin") t.m.material.rotation = HAGGS.time * 3;
      const near = Math.abs(t.m.position.z) < 1.1 && t.lane === P.lane;
      if (near && t.kind === "coin") {
        coins++; HAGGS.sound("coin"); scene.remove(t.m); things.splice(i, 1); HAGGS.score(score());
        const h = heroOnScreen(); HAGGS.burst(h.x, h.y - 40, { n: 10, color: ["#ffd34d", "#fff3a0"], speed: 180, life: 0.5 }); HAGGS.float("+25", h.x, h.y - 70, { color: "#ffd34d", size: 20 });
        if (coins % 10 === 0) { rush = 3.5; HAGGS.flash("#ffd34d", 0.25); HAGGS.shake(0.3); HAGGS.sound("powerup"); HAGGS.float("RUSH!", W / 2, H * 0.4, { size: 40, color: "#ffd34d", life: 1.2 }); }
        continue;
      }
      if (near && t.kind === "crate" && rush > 0) { const h = heroOnScreen(); HAGGS.burst(h.x, h.y - 30, { n: 26, color: ["#b5763a", "#ffd34d"], speed: 300 }); HAGGS.sound("explode"); HAGGS.shake(0.25); scene.remove(t.m); things.splice(i, 1); coins++; continue; }
      if (near && t.kind === "crate" && P.y < 1.6 && P.hurt <= 0 && doneT < 0) {
        P.lives--; P.hurt = 1.5; HAGGS.flash("#ff3c3c", 0.3); HAGGS.shake(0.7); HAGGS.sound("hit"); scene.remove(t.m); things.splice(i, 1);
        if (P.lives <= 0) finish(false);
        continue;
      }
      if (t.m.position.z > 8) { scene.remove(t.m); things.splice(i, 1); }
    }
    camera.fov = HAGGS.lerp(camera.fov, rush > 0 ? 76 : 62, Math.min(1, dt * 4)); camera.updateProjectionMatrix();
    camera.position.set(P.x * 0.6, 3.4 + P.y * 0.3, 7.2);
    camera.lookAt(P.x * 0.4, 1.2, -8);
  },
  draw() {
    renderer.render(scene, camera);
    const g = HAGGS.hud;
    if (rush > 0) { g.save(); g.globalAlpha = 0.25; g.strokeStyle = "#ffd34d"; g.lineWidth = 3; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283 + HAGGS.time * 3, r1 = 220 + (k % 3) * 40; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1); g.lineTo(W / 2 + Math.cos(a) * (r1 + 160), H / 2 + Math.sin(a) * (r1 + 160)); g.stroke(); } g.restore(); }
    HAGGS.text(Math.floor(dist) + " / " + GOAL + " m", 20, 42, { ctx: g, size: 26 });
    HAGGS.text("Coins " + coins, 20, 76, { ctx: g, size: 20, color: HAGGS.palette.accent });
    for (let i = 0; i < P.lives; i++) HAGGS.draw("hero", W - 34 - i * 40, 36, 34, 34, { ctx: g });
    g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(20, 92, W - 40, 8);
    g.fillStyle = HAGGS.palette.accent; g.fillRect(20, 92, (W - 40) * Math.min(1, dist / GOAL), 8);
    HAGGS.text("Rush in " + (10 - (coins % 10)) + (10 - (coins % 10) === 1 ? " coin" : " coins"), 20, 126, { ctx: g, size: 15, bold: false, color: "#ffe9a8" });
    if (banner > 0) HAGGS.text(DISTRICTS[district][0], W / 2, H * 0.3, { ctx: g, size: 40, align: "center", color: "rgba(255,255,255," + Math.min(1, banner) + ")" });
    if (HAGGS.time < 3) HAGGS.text("Swipe or ← → to change lanes, ↑ to jump. 10 coins = Rush", W / 2, H - 40, { ctx: g, size: 17, align: "center" });
  },
});
function jump() { if (P.y === 0 && doneT < 0) { P.vy = 11; HAGGS.sound("jump"); } }
`;
