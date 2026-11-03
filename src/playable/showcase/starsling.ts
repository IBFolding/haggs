/** A featured code game, written against the haggs game kit: slingshot between worlds to climb to the Sun. Everything is drawn in code, no pictures to make. */
export const STARSLING = String.raw`const W = HAGGS.W, H = HAGGS.H, ctx = HAGGS.ctx, rnd = HAGGS.rand((Date.now() % 100000) + 11);
const TOTAL = 8000, STAGE_AT = [0, 2600, 5400];
const STAGES = [
  { name: "DUSK MEADOW", tip: "Tap to let go. Land on the next world.", music: "upbeat" },
  { name: "NEBULA", tip: "Black holes bend your path. Graze them for bonus.", music: "tense" },
  { name: "STORM BELT", tip: "Worlds crumble. Meteors incoming. Reach the Sun!", music: "heroic" },
];
const RANKS = [["PEBBLE", 0, "#aab3d8"], ["SPARK", 1500, "#ffd166"], ["COMET", 5000, "#5ee7ff"], ["NOVA", 11000, "#ff7ad9"], ["SUPERNOVA", 20000, "#ffffff"]];
const PAL = [["#ffc29a", "#d65a7a"], ["#98f5da", "#2a9d8f"], ["#d4b8ff", "#6a4bd6"], ["#ffe49a", "#e07a2f"], ["#9fd0ff", "#3a63d6"], ["#ffaed0", "#b8386e"]];
const SKY = [["#1b1250", "#e8708a"], ["#0a1d4d", "#41309a"], ["#140922", "#6a2068"]];
const hexRgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mixRgb = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return "rgb(" + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",") + ")"; };
const stageOf = (h) => (h < STAGE_AT[1] ? 0 : h < STAGE_AT[2] ? 1 : 2);
const rankOf = (s) => { let r = 0; for (let i = 0; i < RANKS.length; i++) if (s >= RANKS[i][1]) r = i; return r; };
const fmt = (n) => Math.floor(n).toLocaleString("en-US");

let muted = false, paused = false, curMusic = null;
const sfx = (n) => { if (!muted) HAGGS.sound(n); };
const setMusic = (m) => { curMusic = m; HAGGS.music(muted ? null : m); };

let bestSaved = 0;
try { bestSaved = Number(localStorage.getItem("starsling-best")) || 0; } catch (e) { bestSaved = 0; }

let planets = [], stars = [], holes = [], meteors = [];
let pid = 0, camY = -H * 0.58, voidY = 700, bestY = 0, tm = 0, bonus = 0, shown = 0, chain = 0, shield = 0, inv = 0;
let mercy = 1, state = "play", stT = 0, released = false, captures = 0, curStage = 0, banner = { t: 0, text: "", tip: "" }, meteorT = 6, flashSun = 0, newBest = false, chainBest = 0, starsGot = 0;

const P = { x: 0, y: 0, vx: 0, vy: 0, mode: "orbit", pl: null, ang: Math.PI / 2, dir: 1, or: 72, lock: null, lockT: 0, trail: [], stretch: 0, bounced: false };

function addPlanet(x, y, r, type) {
  const pal = PAL[Math.floor(rnd() * PAL.length)];
  const p = { id: pid++, x, y, r, R: r + 30, type: type || "normal", c1: pal[0], c2: pal[1], kind: Math.floor(rnd() * 3), pulse: 0, t: 0, dead: false, sun: type === "sun", seed: rnd() * 100 };
  if (p.type === "crumble") { p.c1 = "#d8d0ea"; p.c2 = "#6b6485"; }
  if (p.sun) { p.c1 = "#fff6c8"; p.c2 = "#ffb02e"; p.R = r + 40; }
  planets.push(p);
  return p;
}

function gen() {
  const a = planets[planets.length - 1];
  if (a.sun) return;
  const h = -a.y, st = stageOf(h);
  if (h > TOTAL - 300) {
    const sun = addPlanet(W / 2, a.y - 250, 105, "sun");
    for (let i = 1; i <= 4; i++) stars.push({ x: a.x + (W / 2 - a.x) * (i / 5), y: a.y + (sun.y - a.y) * (i / 5), got: false });
    return;
  }
  let gap = 150 + rnd() * 50 + st * 12;
  if (planets.length < 4) gap = 135 + planets.length * 8;
  const y = a.y - gap, maxdx = Math.min(300, gap * 1.7);
  const x = HAGGS.clamp(a.x + (rnd() * 2 - 1) * maxdx, 70, W - 70);
  const r = 24 + rnd() * 20 - st * 2;
  const crumble = st === 2 && planets.length > 3 && a.type !== "crumble" && rnd() < 0.5;
  const p = addPlanet(x, y, r, crumble ? "crumble" : "normal");
  const curve = (rnd() - 0.5) * 80;
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    stars.push({ x: a.x + (x - a.x) * t + Math.sin(t * Math.PI) * curve, y: a.y + (y - a.y) * t, got: false });
  }
  if (rnd() < 0.4 && !crumble) for (let i = 0; i < 6; i++) { const q = (i / 6) * Math.PI * 2; stars.push({ x: x + Math.cos(q) * p.R, y: y + Math.sin(q) * p.R, got: false }); }
  if (st >= 1 && planets.length > 3 && rnd() < (st === 1 ? 0.42 : 0.5)) {
    const dx = x - a.x, dy = y - a.y, len = Math.hypot(dx, dy) || 1, side = rnd() < 0.5 ? -1 : 1;
    const hx = HAGGS.clamp((a.x + x) / 2 + (-dy / len) * 105 * side, 50, W - 50), hy = (a.y + y) / 2 + (dx / len) * 105 * side;
    if (Math.hypot(hx - a.x, hy - a.y) > 150 && Math.hypot(hx - x, hy - y) > 150) holes.push({ x: hx, y: hy, grazed: false, rot: rnd() * 6 });
  }
}

const first = addPlanet(W / 2, 0, 40, "normal");
first.c1 = "#ffc29a"; first.c2 = "#d65a7a"; first.kind = 1;
P.pl = first;
bestY = 0; shown = 0;
while (!planets[planets.length - 1].sun && planets[planets.length - 1].y > camY - 1500) gen();
orbitPos();
setMusic(STAGES[0].music);

function speedNow() { return 300 + 22 * curStage; }
function orbitPos() { P.x = P.pl.x + Math.cos(P.ang) * P.or; P.y = P.pl.y + Math.sin(P.ang) * P.or; }

function releaseNow(auto) {
  const v = speedNow();
  P.vx = -Math.sin(P.ang) * P.dir * v; P.vy = Math.cos(P.ang) * P.dir * v;
  P.mode = "fly"; P.lock = P.pl; P.lockT = 0.5; P.pl = null; P.stretch = 1;
  if (!auto) { released = true; sfx("shoot"); }
  HAGGS.burst(P.x, P.y - camY, { n: 10, color: ["#fff6c8", "#ffd166"], speed: 160, life: 0.45, size: 3 });
}

function flyStep(s, dt) {
  for (const p of planets) {
    if (p.dead || Math.abs(p.y - s.y) > 480) continue;
    if (p === s.lock && s.lockT > 0) continue;
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy), cap = p.R + 34;
    if (d < cap) return p;
    const reach = cap * 2.2;
    if (d < reach) { const k = 300 * (1 - (d - cap) / (reach - cap)); s.vx += (dx / d) * k * dt; s.vy += (dy / d) * k * dt; }
  }
  for (const h of holes) {
    const dx = h.x - s.x, dy = h.y - s.y, d = Math.hypot(dx, dy);
    if (d < 170 && d > 1) { const k = 720 * Math.pow(1 - d / 170, 1.5); s.vx += (dx / d) * k * dt; s.vy += (dy / d) * k * dt; }
  }
  const sp = Math.hypot(s.vx, s.vy), mx = 520;
  if (sp > mx) { s.vx *= mx / sp; s.vy *= mx / sp; }
  s.x += s.vx * dt; s.y += s.vy * dt; s.lockT -= dt;
  if (s.x < 16) { s.x = 16; s.vx = Math.abs(s.vx) * 0.92; s.bounced = true; }
  if (s.x > W - 16) { s.x = W - 16; s.vx = -Math.abs(s.vx) * 0.92; s.bounced = true; }
  return null;
}

let aimPts = [], aimTarget = null;
function computeAim() {
  aimPts = []; aimTarget = null;
  if (P.mode !== "orbit") return;
  const v = speedNow();
  const s = { x: P.x, y: P.y, vx: -Math.sin(P.ang) * P.dir * v, vy: Math.cos(P.ang) * P.dir * v, lock: P.pl, lockT: 0.5, bounced: false };
  const steps = [70, 54, 40][curStage];
  for (let i = 0; i < steps; i++) {
    const c = flyStep(s, 1 / 60);
    if (i % 3 === 0) aimPts.push([s.x, s.y]);
    if (c) { aimTarget = c; break; }
  }
}

function capture(p) {
  const rx = P.x - p.x, ry = P.y - p.y, d = Math.hypot(rx, ry) || 1;
  P.ang = Math.atan2(ry, rx);
  const tang = -Math.sin(P.ang) * P.vx + Math.cos(P.ang) * P.vy;
  P.dir = tang >= 0 ? 1 : -1;
  P.or = d; P.pl = p; P.mode = "orbit"; p.pulse = 1; p.t = 0; P.stretch = 0;
  const sx = p.x, sy = p.y - camY;
  const perfect = Math.abs(d - p.R) < 14;
  const prev = P.from;
  if (!prev || p.id !== prev.id) {
    captures++;
    if (!prev || p.y < prev.y - 20 || p.sun) chain++; else chain = 0;
    chainBest = Math.max(chainBest, chain);
    const mult = Math.min(8, 1 + Math.floor(chain / 2));
    let pts = 50 * mult;
    if (perfect) pts += 25 * mult;
    bonus += pts;
    HAGGS.float((perfect ? "PERFECT +" : "+") + pts, sx, sy - p.r - 34, { color: perfect ? "#ffd166" : "#ffffff", size: perfect ? 26 : 22, life: 1 });
    if (chain >= 2) HAGGS.float("CHAIN x" + mult, sx, sy - p.r - 66, { color: "#5ee7ff", size: 20, life: 0.9 });
    if (chain > 0 && chain % 6 === 0 && shield < 1) { shield = 1; HAGGS.float("SHIELD!", HAGGS.clamp(P.x, 80, W - 80), P.y - camY - 40, { color: "#8ef0ff", size: 26, life: 1.2 }); sfx("powerup"); }
    sfx(perfect ? "powerup" : "coin");
    HAGGS.burst(sx, sy, { n: perfect ? 34 : 20, color: [p.c1, p.c2, "#ffffff"], speed: 280, life: 0.7, size: 4 });
    if (perfect) HAGGS.flash("#fff3c4", 0.08);
  }
  if (p.sun) { state = "win"; stT = 0; bonus += 2000 + shield * 500; HAGGS.flash("#fff6c8", 0.5); HAGGS.shake(0.8); sfx("win"); setMusic(null); }
  P.from = p;
}

function hurt(why) {
  if (inv > 0 || state !== "play") return;
  if (why === "lost" && mercy > 0 && captures < 4) { mercy--; HAGGS.float("Oops! Try again", W / 2, 330, { color: "#ffe9a8", size: 28, life: 1.4 }); sfx("click"); rescue(); return; }
  if (shield > 0) {
    shield = 0; inv = 1.4; HAGGS.flash("#8ef0ff", 0.25); HAGGS.shake(0.6); sfx("hit");
    HAGGS.burst(P.x, P.y - camY, { n: 40, color: ["#8ef0ff", "#ffffff"], speed: 340, life: 0.8, size: 4 });
    HAGGS.float("SHIELD BROKEN", HAGGS.clamp(P.x, 100, W - 100), P.y - camY - 50, { color: "#8ef0ff", size: 22 });
    if (why === "lost") rescue();
    return;
  }
  state = "dying"; stT = 0;
  const f = Math.floor(-bestY / 10) + bonus;
  if (f > bestSaved) { newBest = bestSaved > 0 || f > 0; try { localStorage.setItem("starsling-best", String(Math.floor(f))); } catch (e) { newBest = false; } }
  HAGGS.burst(P.x, P.y - camY, { n: 70, color: ["#fff6c8", "#ffd166", "#ff7ad9"], speed: 420, life: 1.1, size: 5 });
  HAGGS.shake(1); HAGGS.flash("#ffffff", 0.2); sfx("explode"); setMusic(null);
}

function rescue() {
  let best = null, bd = 1e9;
  for (const p of planets) { if (p.dead || p.sun) continue; const d = Math.abs(p.y - (camY + H * 0.55)); if (d < bd) { bd = d; best = p; } }
  if (!best) return;
  P.pl = best; P.mode = "orbit"; P.or = best.R; P.ang = -Math.PI / 2; P.dir = 1; P.from = best; orbitPos();
  voidY = Math.max(voidY, camY + H + 420); chain = 0;
}

const btnPause = { x: W - 44, y: 52, r: 28 }, btnSound = { x: W - 108, y: 52, r: 28 };
const inBtn = (b) => Math.hypot(HAGGS.pointer.x - b.x, HAGGS.pointer.y - b.y) < b.r + 8;
document.addEventListener("visibilitychange", () => { if (document.hidden && state === "play") paused = true; });

function update(dt) {
  const ptr = HAGGS.pointer, pr = ptr.pressed;
  if (pr && inBtn(btnSound)) { muted = !muted; setMusic(curMusic); return; }
  if ((pr && inBtn(btnPause)) || HAGGS.pressed("KeyP") || HAGGS.pressed("Escape") || HAGGS.pressed("b")) { if (state === "play") paused = !paused; return; }
  if (HAGGS.pressed("KeyM")) { muted = !muted; setMusic(curMusic); }
  if (paused) { if (pr || HAGGS.pressed("a")) paused = false; return; }
  stT += dt;
  if (banner.t > 0) banner.t -= dt;
  for (const p of planets) { p.pulse = Math.max(0, p.pulse - dt * 3); }
  P.stretch = Math.max(0, P.stretch - dt * 4);

  if (state === "dying") {
    if (stT > 1.5) { HAGGS.end({ won: false, score: Math.floor(-bestY / 10) + bonus }); state = "over"; }
    return;
  }
  if (state === "over") return;
  tm += dt; inv = Math.max(0, inv - dt);
  const tapped = HAGGS.pressed("a") || HAGGS.pressed("up") || (pr && !inBtn(btnPause) && !inBtn(btnSound));

  if (state === "win") {
    P.ang += P.dir * (3 / Math.max(60, P.or)) * 60 * dt * 0.6; orbitPos();
    if (Math.floor(stT * 8) !== Math.floor((stT - dt) * 8)) HAGGS.burst(W / 2 + (rnd() - 0.5) * 400, 200 + rnd() * 300, { n: 16, color: ["#ffd166", "#ff7ad9", "#5ee7ff", "#ffffff"], speed: 300, life: 1, size: 4, gravity: 200 });
    if (stT > 3.2) { HAGGS.end({ won: true, score: Math.floor(-bestY / 10) + bonus }); state = "over"; }
    return;
  }

  if (P.mode === "orbit") {
    const v = speedNow(), pl = P.pl;
    P.or += (pl.R - P.or) * Math.min(1, dt * 6);
    P.ang += P.dir * (v / P.or) * dt;
    orbitPos();
    if (pl.type === "crumble") {
      pl.t += dt;
      if (pl.t > 1.0 && Math.floor(pl.t * 12) !== Math.floor((pl.t - dt) * 12)) HAGGS.burst(pl.x + (rnd() - 0.5) * pl.r, pl.y - camY + (rnd() - 0.5) * pl.r, { n: 3, color: pl.c2, speed: 90, life: 0.5, size: 3, gravity: 200 });
      if (pl.t > 1.9) { pl.dead = true; HAGGS.burst(pl.x, pl.y - camY, { n: 36, color: [pl.c1, pl.c2], speed: 320, life: 0.9, size: 5, gravity: 260 }); HAGGS.shake(0.5); sfx("explode"); releaseNow(true); }
    }
    if (tapped) { releaseNow(false); }
  } else {
    P.bounced = false;
    const cp = flyStep(P, dt);
    if (P.bounced) { sfx("click"); HAGGS.burst(P.x, P.y - camY, { n: 8, color: "#ffffff", speed: 120, life: 0.3, size: 3 }); }
    if (cp) capture(cp);
  }
  P.trail.push([P.x, P.y]); if (P.trail.length > 22) P.trail.shift();
  if (P.y < bestY) bestY = P.y;

  const st = stageOf(-bestY);
  if (st > curStage) { curStage = st; banner = { t: 3, text: "STAGE " + (st + 1) + " - " + STAGES[st].name, tip: STAGES[st].tip }; sfx("powerup"); HAGGS.flash("#ffffff", 0.2); setMusic(STAGES[st].music); }
  if (stT < 4 && curStage === 0 && banner.t <= 0 && tm < 0.1) banner = { t: 3, text: "STAGE 1 - " + STAGES[0].name, tip: STAGES[0].tip };

  if (released) {
    const vs = 28 + Math.min(55, tm * 0.45) + curStage * 10;
    voidY -= vs * dt;
  }
  voidY = Math.min(voidY, bestY + 660 - curStage * 40);
  const target = P.y - H * 0.58;
  if (target < camY) camY += (target - camY) * Math.min(1, dt * 5);
  while (!planets[planets.length - 1].sun && planets[planets.length - 1].y > camY - 1500) gen();
  planets = planets.filter((p) => p.y < camY + H + 500 && !p.dead);
  stars = stars.filter((s) => !s.got && s.y < camY + H + 300);
  holes = holes.filter((h) => h.y < camY + H + 300);

  const mult = Math.min(8, 1 + Math.floor(chain / 2));
  for (const s of stars) {
    if (Math.hypot(s.x - P.x, s.y - P.y) < 30) {
      s.got = true; starsGot++; bonus += 10 * mult; sfx("coin");
      HAGGS.burst(s.x, s.y - camY, { n: 8, color: ["#ffd166", "#fff6c8"], speed: 150, life: 0.4, size: 3 });
      HAGGS.float("+" + 10 * mult, s.x, s.y - camY - 14, { color: "#ffd166", size: 16, life: 0.6 });
    }
  }
  for (const h of holes) {
    const d = Math.hypot(h.x - P.x, h.y - P.y);
    if (d < 26) hurt("hole");
    else if (d < 62 && !h.grazed && P.mode === "fly") { h.grazed = true; bonus += 100; HAGGS.float("CLOSE CALL +100", h.x, h.y - camY - 40, { color: "#ff7ad9", size: 20, life: 1 }); sfx("powerup"); }
  }
  if (curStage >= 2) {
    meteorT -= dt;
    if (meteorT <= 0) {
      meteorT = Math.max(1.3, 2.6 - (-bestY - STAGE_AT[2]) / 2400 * 1.2) * (0.7 + rnd() * 0.6);
      const fromL = rnd() < 0.5, y = camY + H * (0.12 + rnd() * 0.6), sp = 400 + rnd() * 100;
      meteors.push({ x: fromL ? -40 : W + 40, y, vx: fromL ? sp : -sp, vy: (rnd() - 0.5) * 120, delay: 0.9, ty: y });
    }
  }
  for (const m of meteors) {
    if (m.delay > 0) { m.delay -= dt; continue; }
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (Math.hypot(m.x - P.x, m.y - P.y) < 22) { m.x = 9999; hurt("meteor"); }
    else if (Math.hypot(m.x - P.x, m.y - P.y) < 50 && !m.near) { m.near = true; bonus += 50; HAGGS.float("NEAR MISS +50", HAGGS.clamp(P.x, 100, W - 100), P.y - camY - 40, { color: "#ff9e5e", size: 18 }); }
  }
  meteors = meteors.filter((m) => m.x > -120 && m.x < W + 120);

  if (P.y > voidY - 8 && inv <= 0) hurt("lost");
  else if (P.y > camY + H + 40) hurt("lost");
  computeAim();
}

function glow(x, y, r, c, a) {
  const [R, G, B] = hexRgb(c), g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgba(" + R + "," + G + "," + B + "," + a + ")"); g.addColorStop(1, "rgba(" + R + "," + G + "," + B + ",0)");
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawBg() {
  const h = -camY;
  let a, b;
  const st = stageOf(h), edge = STAGE_AT[st + 1];
  if (st < 2 && h > edge - 600) { const t = HAGGS.clamp((h - (edge - 600)) / 800, 0, 1); a = mixRgb(SKY[st][0], SKY[st + 1][0], t); b = mixRgb(SKY[st][1], SKY[st + 1][1], t); }
  else { a = SKY[st][0]; b = SKY[st][1]; }
  if (a.indexOf("rgb") < 0) { a = mixRgb(a, a, 0); b = mixRgb(b, b, 0); }
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const sunT = HAGGS.clamp((h - (TOTAL - 2200)) / 2200, 0, 1);
  if (sunT > 0) glow(W / 2, -40, 700, "#ffb02e", 0.55 * sunT);
  for (let i = 0; i < 5; i++) {
    const f = 0.12, by = (((i * 331 + 120) - camY * f) % (H + 400) + H + 400) % (H + 400) - 200;
    glow(((i * 197) % W) + 40, by, 260, ["#ff7ad9", "#5ee7ff", "#a78bfa", "#ffb38a", "#7cf0c8"][i], 0.1);
  }
  const layers = [[0.08, 46, 1.2], [0.2, 34, 1.8], [0.42, 22, 2.6]];
  layers.forEach((L, k) => {
    for (let i = 0; i < L[1]; i++) {
      const x = ((i * 7919 + k * 131) % 997) / 997 * W;
      const y = ((((i * 104729 + k * 977) % 991) / 991 * H - camY * L[0]) % H + H) % H;
      const tw = 0.5 + 0.5 * Math.sin(tm * (1.5 + k) + i);
      ctx.globalAlpha = (0.35 + 0.5 * tw) * (0.5 + k * 0.25);
      ctx.fillStyle = "#fff"; ctx.fillRect(x, y, L[2], L[2]);
    }
  });
  ctx.globalAlpha = 1;
  if (curStage >= 2 && Math.sin(tm * 0.7) > 0.985) { ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fillRect(0, 0, W, H); }
}

function drawPlanet(p) {
  const x = p.x, y = p.y - camY;
  if (y < -260 || y > H + 260) return;
  let jx = 0, jy = 0;
  if (p.type === "crumble" && p.t > 1) { jx = (rnd() - 0.5) * 5; jy = (rnd() - 0.5) * 5; }
  const r = p.r * (1 + p.pulse * 0.14);
  if (p.sun) {
    glow(x, y, 520, "#ffb02e", 0.55); glow(x, y, 300, "#fff6c8", 0.6);
    ctx.save(); ctx.translate(x, y); ctx.rotate(tm * 0.15); ctx.fillStyle = "rgba(255,230,150,.16)";
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(500, -34); ctx.lineTo(500, 34); ctx.fill(); }
    ctx.restore();
  } else glow(x, y, r * 2.4, p.c2, 0.32);
  ctx.save();
  ctx.strokeStyle = p.sun ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.16)"; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -tm * 14;
  ctx.beginPath(); ctx.arc(x, y, p.R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.translate(jx, jy);
  if (p.kind === 2 && !p.sun) { ctx.strokeStyle = p.c1; ctx.globalAlpha = 0.55; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y, r * 1.7, r * 0.45, -0.35, Math.PI, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, p.c1); g.addColorStop(1, p.c2);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  if (p.kind === 0 || p.kind === 1) {
    ctx.fillStyle = "rgba(255,255,255,.14)";
    for (let i = 0; i < 3; i++) ctx.fillRect(x - r, y - r * 0.5 + i * r * 0.5 + Math.sin(p.seed + i) * 4, r * 2, r * 0.18);
  }
  if (p.type === "crumble") { ctx.strokeStyle = "rgba(40,30,60,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x + r * 0.5, y - r * 0.5); ctx.moveTo(x, y + r * 0.1); ctx.lineTo(x + r * 0.2, y + r * 0.8); ctx.stroke(); }
  const sh = ctx.createRadialGradient(x - r * 0.5, y - r * 0.5, r * 0.4, x, y, r * 1.1);
  sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(10,5,30,.3)");
  ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  if (p.kind === 2 && !p.sun) { ctx.strokeStyle = p.c1; ctx.globalAlpha = 0.8; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y, r * 1.7, r * 0.45, -0.35, 0, Math.PI); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.restore();
  if (aimTarget === p && P.mode === "orbit") {
    ctx.strokeStyle = "rgba(255,255,255," + (0.5 + 0.4 * Math.sin(tm * 8)) + ")"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, p.R + 12 + Math.sin(tm * 8) * 3, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawStar(s) {
  const x = s.x, y = s.y - camY;
  if (y < -30 || y > H + 30) return;
  const k = 11 + Math.sin(tm * 5 + s.x) * 1.5;
  glow(x, y, 26, "#ffd166", 0.35);
  ctx.save(); ctx.translate(x, y); ctx.rotate(tm * 1.2); ctx.fillStyle = "#fff0b0"; ctx.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? k * 0.38 : k, q = (i / 8) * Math.PI * 2; ctx.lineTo(Math.cos(q) * rr, Math.sin(q) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawHole(h) {
  const x = h.x, y = h.y - camY;
  if (y < -200 || y > H + 200) return;
  glow(x, y, 120, "#a855f7", 0.28);
  ctx.save(); ctx.translate(x, y);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(tm * (0.9 + i * 0.4)); ctx.strokeStyle = ["#ff7ad9", "#a78bfa", "#5ee7ff"][i]; ctx.globalAlpha = 0.75; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 44 - i * 8, 17 - i * 3, 0, 0, Math.PI * 1.4); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.fillStyle = "#04010a"; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawMeteor(m) {
  const y = m.y - camY;
  if (m.delay > 0) {
    const x = m.vx > 0 ? 30 : W - 30, a = 0.5 + 0.5 * Math.sin(tm * 18);
    ctx.fillStyle = "rgba(255,120,60," + a + ")"; ctx.beginPath(); const d = m.vx > 0 ? 1 : -1;
    ctx.moveTo(x + 18 * d, y); ctx.lineTo(x - 10 * d, y - 18); ctx.lineTo(x - 10 * d, y + 18); ctx.fill();
    HAGGS.text("!", x - 3 * d, y + 7, { size: 20, color: "#fff", shadow: false, align: "center" });
    return;
  }
  const L = 110, n = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / n) * L, ty = y - (m.vy / n) * L;
  const g = ctx.createLinearGradient(m.x, y, tx, ty); g.addColorStop(0, "rgba(255,170,80,.9)"); g.addColorStop(1, "rgba(255,80,40,0)");
  ctx.strokeStyle = g; ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(m.x, y); ctx.lineTo(tx, ty); ctx.stroke();
  glow(m.x, y, 40, "#ff9e5e", 0.6);
  ctx.fillStyle = "#fff0d0"; ctx.beginPath(); ctx.arc(m.x, y, 11, 0, Math.PI * 2); ctx.fill();
}

function drawVoid() {
  const top = voidY - camY;
  if (top > H + 40) return;
  const g = ctx.createLinearGradient(0, top - 70, 0, top + 120); g.addColorStop(0, "rgba(168,85,247,0)"); g.addColorStop(0.35, "rgba(168,85,247,.55)"); g.addColorStop(0.5, "rgba(8,3,20,.96)"); g.addColorStop(1, "#03010a");
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H + 5);
  for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, top + Math.sin(x * 0.03 + tm * 2.4) * 10 + Math.sin(x * 0.011 - tm) * 14);
  ctx.lineTo(W, H + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#03010a"; ctx.fillRect(0, top + 40, W, H);
  const danger = HAGGS.clamp(1 - (top - P.y + camY) / 260, 0, 1);
  if (danger > 0) { ctx.fillStyle = "rgba(255,40,100," + (0.12 * danger * (0.6 + 0.4 * Math.sin(tm * 10))) + ")"; ctx.fillRect(0, 0, W, H); }
}

function drawPlayer() {
  const x = P.x, y = P.y - camY;
  for (let i = 0; i < P.trail.length; i++) {
    const t = i / P.trail.length, q = P.trail[i];
    ctx.globalAlpha = t * 0.55; ctx.fillStyle = P.mode === "fly" ? "#ffd166" : "#fff6c8";
    ctx.beginPath(); ctx.arc(q[0], q[1] - camY, 2 + t * 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (state === "dying") return;
  const blink = inv > 0 && Math.floor(tm * 14) % 2 === 0;
  if (blink) ctx.globalAlpha = 0.4;
  glow(x, y, 46, "#ffe49a", 0.7);
  ctx.save(); ctx.translate(x, y);
  if (P.mode === "fly") ctx.rotate(Math.atan2(P.vy, P.vx));
  const sx = 1 + P.stretch * 0.5, sy = 1 - P.stretch * 0.25;
  ctx.scale(P.mode === "fly" ? sx * 1.15 : sx, sy);
  const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 12); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#ffcf5a");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (shield > 0) { ctx.strokeStyle = "rgba(142,240,255," + (0.6 + 0.3 * Math.sin(tm * 6)) + ")"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

function drawAim() {
  if (P.mode !== "orbit" || state !== "play") return;
  for (let i = 0; i < aimPts.length; i++) {
    const t = 1 - i / aimPts.length;
    ctx.globalAlpha = 0.25 + 0.6 * t * (aimTarget ? 1 : 0.7);
    ctx.fillStyle = aimTarget ? "#ffffff" : "#aab3d8";
    ctx.beginPath(); ctx.arc(aimPts[i][0], aimPts[i][1] - camY, 3.2 - i * 0.03, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function iconPause(b) {
  ctx.fillStyle = "rgba(10,6,30,.55)"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  if (paused) { ctx.beginPath(); ctx.moveTo(b.x - 6, b.y - 11); ctx.lineTo(b.x + 12, b.y); ctx.lineTo(b.x - 6, b.y + 11); ctx.fill(); }
  else { ctx.fillRect(b.x - 9, b.y - 11, 6, 22); ctx.fillRect(b.x + 3, b.y - 11, 6, 22); }
}
function iconSound(b) {
  ctx.fillStyle = "rgba(10,6,30,.55)"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(b.x - 11, b.y - 5); ctx.lineTo(b.x - 5, b.y - 5); ctx.lineTo(b.x + 3, b.y - 12); ctx.lineTo(b.x + 3, b.y + 12); ctx.lineTo(b.x - 5, b.y + 5); ctx.lineTo(b.x - 11, b.y + 5); ctx.fill();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
  if (muted) { ctx.beginPath(); ctx.moveTo(b.x + 8, b.y - 7); ctx.lineTo(b.x + 18, b.y + 7); ctx.moveTo(b.x + 18, b.y - 7); ctx.lineTo(b.x + 8, b.y + 7); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(b.x + 4, b.y, 8, -0.9, 0.9); ctx.stroke(); }
}

function drawHud() {
  const total = Math.floor(-bestY / 10) + bonus;
  shown += (total - shown) * 0.2; if (Math.abs(total - shown) < 1) shown = total;
  HAGGS.score(total);
  HAGGS.text(fmt(shown), 28, 70, { size: 46, color: "#ffffff" });
  const ri = rankOf(total), nr = RANKS[Math.min(RANKS.length - 1, ri + 1)];
  HAGGS.text(RANKS[ri][0], 30, 98, { size: 17, color: RANKS[ri][2] });
  if (ri < RANKS.length - 1) {
    const f = HAGGS.clamp((total - RANKS[ri][1]) / (nr[1] - RANKS[ri][1]), 0, 1);
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(30, 108, 170, 8);
    ctx.fillStyle = nr[2]; ctx.fillRect(30, 108, 170 * f, 8);
    HAGGS.text(nr[0] + " " + fmt(nr[1]), 30, 138, { size: 14, color: "rgba(255,255,255,.75)", bold: false });
  }
  if (bestSaved > 0) HAGGS.text("BEST " + fmt(bestSaved), 30, 160, { size: 14, color: "rgba(255,255,255,.6)", bold: false });
  const mult = Math.min(8, 1 + Math.floor(chain / 2));
  if (mult > 1) {
    HAGGS.text("x" + mult, W - 30, 130, { size: 40, color: mult >= 6 ? "#ff7ad9" : "#5ee7ff", align: "right" });
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i < chain % 6 || (chain > 0 && chain % 6 === 0) ? "#8ef0ff" : "rgba(255,255,255,.2)"; ctx.beginPath(); ctx.arc(W - 30 - i * 14, 150, 4, 0, Math.PI * 2); ctx.fill(); }
  } else if (chain === 1) HAGGS.text("chain 1", W - 30, 130, { size: 16, color: "rgba(255,255,255,.7)", align: "right" });
  if (shield > 0) HAGGS.text("SHIELD", W - 30, 178, { size: 16, color: "#8ef0ff", align: "right" });
  iconPause(btnPause); iconSound(btnSound);
  const x = 20, y0 = 230, y1 = H - 150, f = HAGGS.clamp(-bestY / TOTAL, 0, 1);
  ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(x - 2, y0, 4, y1 - y0);
  ctx.fillStyle = "#ffd166"; ctx.fillRect(x - 2, y1 - (y1 - y0) * f, 4, (y1 - y0) * f);
  glow(x, y0 - 4, 18, "#ffb02e", 0.9);
  ctx.fillStyle = "#fff6c8"; ctx.beginPath(); ctx.arc(x, y0 - 4, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y1 - (y1 - y0) * f, 6, 0, Math.PI * 2); ctx.fill();
  STAGE_AT.slice(1).forEach((s) => { const yy = y1 - (y1 - y0) * (s / TOTAL); ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.fillRect(x - 6, yy - 1, 12, 2); });
  if (banner.t > 0 && state === "play") {
    const a = HAGGS.clamp(Math.min(banner.t, 3 - banner.t) * 3, 0, 1), s = 0.9 + 0.1 * HAGGS.ease.back(HAGGS.clamp((3 - banner.t) * 3, 0, 1));
    ctx.globalAlpha = a; ctx.save(); ctx.translate(W / 2, 300); ctx.scale(s, s);
    HAGGS.text(banner.text, 0, 0, { size: 34, color: "#ffffff", align: "center" });
    HAGGS.text(banner.tip, 0, 36, { size: 18, color: "#ffe9a8", align: "center", bold: false });
    ctx.restore(); ctx.globalAlpha = 1;
  }
  if (!released && state === "play") {
    const p = 0.6 + 0.4 * Math.sin(tm * 4);
    ctx.globalAlpha = p; HAGGS.text("TAP / SPACE to let go", W / 2, H - 120, { size: 30, color: "#ffffff", align: "center" });
    HAGGS.text("follow the dotted path to the next world", W / 2, H - 86, { size: 17, color: "#ffe9a8", align: "center", bold: false }); ctx.globalAlpha = 1;
  } else if (captures === 1 && chain === 1 && state === "play" && tm < 20) {
    HAGGS.text("Climb higher each time to build your chain", W / 2, H - 100, { size: 18, color: "#ffe9a8", align: "center", bold: false });
  }
}

function drawCard(title, lines, accent) {
  ctx.fillStyle = "rgba(6,3,18,.72)"; ctx.beginPath(); ctx.roundRect(W / 2 - 220, 150, 440, 200, 24); ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.stroke();
  HAGGS.text(title, W / 2, 205, { size: title.length > 16 ? 30 : 38, color: accent, align: "center" });
  lines.forEach((l, i) => HAGGS.text(l, W / 2, 250 + i * 30, { size: i === 0 ? 26 : 19, color: "#fff", align: "center", bold: i === 0 }));
}

function draw() {
  drawBg();
  for (const h of holes) drawHole(h);
  for (const p of planets) drawPlanet(p);
  for (const s of stars) drawStar(s);
  drawAim();
  drawPlayer();
  for (const m of meteors) drawMeteor(m);
  drawVoid();
  drawHud();
  if (paused) {
    ctx.fillStyle = "rgba(6,3,18,.78)"; ctx.fillRect(0, 0, W, H);
    HAGGS.text("PAUSED", W / 2, H / 2 - 10, { size: 56, color: "#ffffff", align: "center" });
    HAGGS.text("tap or press P to resume", W / 2, H / 2 + 36, { size: 22, color: "#ffe9a8", align: "center", bold: false });
    iconPause(btnPause); iconSound(btnSound);
  }
  const total = Math.floor(-bestY / 10) + bonus, ri = rankOf(total);
  if (state === "dying" || state === "over") {
    const nr = RANKS[Math.min(RANKS.length - 1, ri + 1)];
    drawCard("LOST IN THE DARK", [fmt(total) + " pts   " + RANKS[ri][0], Math.floor(-bestY / 10) + " m high   " + starsGot + " stars   best chain " + chainBest, ri < RANKS.length - 1 ? fmt(nr[1] - total) + " to reach " + nr[0] : "Top rank!" + (newBest ? " NEW BEST" : "")], RANKS[ri][2]);
  }
  if (state === "win" || (state === "over" && P.pl && P.pl.sun)) {
    drawCard("YOU REACHED THE SUN", [fmt(total) + " pts   " + RANKS[ri][0], Math.floor(-bestY / 10) + " m   " + starsGot + " stars   best chain " + chainBest, "Can you do it faster?"], "#ffd166");
  }
}

HAGGS.start({ update, draw });
`;
