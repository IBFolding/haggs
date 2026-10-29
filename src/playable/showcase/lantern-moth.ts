/** A featured code game, written against the haggs game kit: light is your health, your weapon and your way. */
export const LANTERN_MOTH = String.raw`const W = HAGGS.W, H = HAGGS.H, rnd = HAGGS.rand(21);
const STAGES = [
  { name: "The Night Garden", bg: "garden", lamps: [[170, 140], [790, 120], [480, 420], [150, 430]], spawn: 2.2, speed: 52 },
  { name: "The Lily Pond", bg: "pond", lamps: [[120, 270], [480, 90], [840, 270], [480, 460], [300, 280]], spawn: 1.5, speed: 66 },
  { name: "The Old Oak", bg: "oak", lamps: [[110, 110], [850, 110], [110, 440], [850, 440], [480, 120], [480, 450]], spawn: 1.05, speed: 80 },
];
const M = { x: W / 2, y: H / 2, flame: 100, vx: 0, vy: 0, flap: 0, hurt: 0, cool: 0 };
let stage = 0, lamps = [], shades = [], flies = [], score = 0, combo = 0, comboT = 0, spawnT = 2, banner = 0;
let finale = null, doneT = -1, won = false, dark = document.createElement("canvas");
dark.width = W; dark.height = H;
const dg = dark.getContext("2d");

function startStage(i) {
  stage = i; banner = 2.4; spawnT = 2.5;
  lamps = STAGES[i].lamps.map(([x, y]) => ({ x, y, lit: 0, pulse: rnd() * 6 }));
  shades.length = 0; flies.length = 0;
  for (let k = 0; k < 4; k++) addFly();
  HAGGS.music(i === 2 ? "spooky" : "calm");
}
function addFly() { flies.push({ x: 60 + rnd() * (W - 120), y: 60 + rnd() * (H - 120), t: rnd() * 6 }); }
function radius() { return 70 + M.flame * 1.45; }
function addShade(fast) {
  const side = Math.floor(rnd() * 4), s = STAGES[stage];
  const x = side === 0 ? -30 : side === 1 ? W + 30 : rnd() * W, y = side === 2 ? -30 : side === 3 ? H + 30 : rnd() * H;
  shades.push({ x, y, t: rnd() * 6, speed: s.speed * (fast ? 1.4 : 0.8 + rnd() * 0.5), hp: 1, fade: 0 });
}
function lampLight(x, y) { for (const l of lamps) if (l.lit >= 1 && Math.hypot(l.x - x, l.y - y) < 150) return l; return finale && finale.lit && Math.hypot(W / 2 - x, H / 2 - y) < finale.r ? { x: W / 2, y: H / 2 } : null; }
function hurt(n) {
  if (M.hurt > 0 || doneT >= 0) return;
  M.flame -= n; M.hurt = 1; combo = 0; HAGGS.sound("hit"); HAGGS.shake(0.6); HAGGS.flash("#2a0b3d", 0.25);
  HAGGS.burst(M.x, M.y, { n: 26, color: ["#7b5cff", "#2a1a55"], speed: 200 });
  if (M.flame <= 0) end(false);
}
function end(w) { if (doneT >= 0) return; won = w; doneT = 1.8; if (w) { score += Math.round(M.flame) * 20; HAGGS.score(score); HAGGS.burst(W / 2, H / 2, { n: 160, color: ["#ffd36b", "#fff6c9", "#ff9f43"], speed: 520, life: 1.4 }); HAGGS.flash("#fff6c9", 0.5); } }
function flare() {
  if (M.cool > 0 || M.flame < 22 || doneT >= 0) return;
  M.flame -= 18; M.cool = 0.55; HAGGS.sound("powerup"); HAGGS.shake(0.35); HAGGS.flash("#ffe9a8", 0.12);
  HAGGS.burst(M.x, M.y, { n: 60, color: ["#ffd36b", "#ffb347", "#fff6c9"], speed: 420, life: 0.6 });
  let got = 0;
  for (const s of shades) if (s.fade === 0 && Math.hypot(s.x - M.x, s.y - M.y) < 230) { s.fade = 0.01; got++; }
  if (got) {
    combo = comboT > 0 ? combo + got : got; comboT = 2.5;
    const gain = got * 50 * Math.max(1, combo);
    score += gain; HAGGS.score(score);
    HAGGS.float(combo > 1 ? "Combo x" + combo + "  +" + gain : "+" + gain, M.x, M.y - 50, { color: "#ffd36b", size: 24 });
  }
}
startStage(0);

HAGGS.start({
  update(dt) {
    banner -= dt; comboT -= dt; M.hurt -= dt; M.cool -= dt;
    if (doneT >= 0) { doneT -= dt; if (doneT <= 0) HAGGS.end({ won, score }); return; }
    const a = HAGGS.axis(), p = HAGGS.pointer;
    let tx = a.x, ty = a.y;
    if (p.down && !a.x && !a.y) { const dx = p.x - M.x, dy = p.y - M.y, d = Math.hypot(dx, dy); if (d > 12) { tx = dx / d; ty = dy / d; } }
    M.vx = HAGGS.lerp(M.vx, tx * 280, Math.min(1, dt * 8)); M.vy = HAGGS.lerp(M.vy, ty * 280, Math.min(1, dt * 8));
    M.x = HAGGS.clamp(M.x + M.vx * dt, 20, W - 20); M.y = HAGGS.clamp(M.y + M.vy * dt, 20, H - 20);
    M.flap += dt * (8 + Math.hypot(M.vx, M.vy) / 30);
    if (HAGGS.pressed("a") || HAGGS.pressed("b")) flare();
    M.flame = Math.min(100, M.flame - dt * (finale && finale.lit ? 1.2 : 2.3));
    if (M.flame <= 0) end(false);
    if (rnd() < dt * 18) HAGGS.burst(M.x + (rnd() - 0.5) * 10, M.y + 14, { n: 1, color: "#ffcf6b", speed: 30, life: 0.5, size: 2.5, up: 40 });

    for (const l of lamps) {
      l.pulse += dt;
      if (l.lit < 1 && Math.hypot(l.x - M.x, l.y - M.y) < 46) {
        l.lit += dt * 1.6;
        if (rnd() < dt * 30) HAGGS.burst(l.x, l.y - 10, { n: 2, color: "#ffd36b", speed: 80, life: 0.4, size: 2 });
        if (l.lit >= 1) { l.lit = 1; score += 200; HAGGS.score(score); HAGGS.sound("powerup"); HAGGS.float("Lamp lit!", l.x, l.y - 44, { color: "#ffd36b", size: 22 }); HAGGS.burst(l.x, l.y, { n: 50, color: ["#ffd36b", "#fff6c9"], speed: 300 }); HAGGS.shake(0.2); M.flame = Math.min(100, M.flame + 15); }
      }
    }
    for (let i = flies.length - 1; i >= 0; i--) {
      const f = flies[i]; f.t += dt; f.x += Math.cos(f.t * 1.3) * 22 * dt; f.y += Math.sin(f.t * 1.9) * 18 * dt;
      if (Math.hypot(f.x - M.x, f.y - M.y) < 34) {
        flies.splice(i, 1); M.flame = Math.min(100, M.flame + 14); score += 20; HAGGS.score(score); HAGGS.sound("coin");
        HAGGS.float("+light", f.x, f.y - 20, { color: "#fff3a0", size: 18 }); HAGGS.burst(f.x, f.y, { n: 14, color: "#fff3a0", speed: 160 });
      }
    }
    if (flies.length < 3 + stage && rnd() < dt * 0.9) addFly();

    const s = STAGES[stage], rate = finale && finale.lit ? 0.35 : s.spawn;
    if ((spawnT -= dt) <= 0) { spawnT = rate * (0.7 + rnd() * 0.6); addShade(finale && finale.lit); }
    const r = radius();
    for (let i = shades.length - 1; i >= 0; i--) {
      const sh = shades[i]; sh.t += dt;
      if (sh.fade > 0) { sh.fade += dt * 2.5; if (sh.fade >= 1) { HAGGS.burst(sh.x, sh.y, { n: 20, color: ["#9b7bff", "#c9b8ff", "#ffffff"], speed: 220 }); shades.splice(i, 1); } continue; }
      const dx = M.x - sh.x, dy = M.y - sh.y, d = Math.hypot(dx, dy) || 1;
      const lit = lampLight(sh.x, sh.y), inLantern = d < r * 0.75;
      let sp = sh.speed * (inLantern ? 0.45 : 1);
      if (lit) { const ax = sh.x - lit.x, ay = sh.y - lit.y, ad = Math.hypot(ax, ay) || 1; sh.x += (ax / ad) * 120 * dt; sh.y += (ay / ad) * 120 * dt; sp *= 0.2; if (rnd() < dt * 2) { sh.fade = 0.01; score += 10; HAGGS.score(score); } }
      sh.x += (dx / d) * sp * dt + Math.cos(sh.t * 3) * 20 * dt; sh.y += (dy / d) * sp * dt + Math.sin(sh.t * 2.4) * 20 * dt;
      if (d < 34) { hurt(20); sh.fade = 0.01; }
    }

    if (!finale && lamps.every((l) => l.lit >= 1)) {
      if (stage < STAGES.length - 1) { HAGGS.sound("win"); HAGGS.flash("#fff6c9", 0.3); score += 500; HAGGS.score(score); HAGGS.float("Stage clear  +500", W / 2, H / 2 - 40, { size: 30, color: "#ffd36b", life: 1.6 }); startStage(stage + 1); }
      else { finale = { lit: false, t: 0, r: 0 }; banner = 2.4; HAGGS.music("heroic"); }
    }
    if (finale) {
      if (!finale.lit && Math.hypot(W / 2 - M.x, H / 2 - M.y) < 52) { finale.lit = true; HAGGS.sound("powerup"); HAGGS.shake(0.8); HAGGS.flash("#ffe9a8", 0.4); HAGGS.burst(W / 2, H / 2, { n: 120, color: ["#ffd36b", "#fff6c9", "#ff9f43"], speed: 460 }); }
      if (finale.lit) { finale.t += dt; finale.r = 60 + finale.t * 18; if (finale.t >= 18) end(true); }
    }
  },

  draw() {
    const g = HAGGS.ctx, t = HAGGS.time;
    HAGGS.draw(STAGES[stage].bg, W / 2, H / 2, W, H);
    for (const l of lamps) HAGGS.draw("lamp", l.x, l.y + Math.sin(l.pulse * 2) * 2, 56, 56, { alpha: 0.55 + l.lit * 0.45 });
    if (finale) HAGGS.draw("great", W / 2, H / 2 + Math.sin(t * 2) * 4, finale.lit ? 120 + Math.sin(t * 6) * 6 : 96, finale.lit ? 120 + Math.sin(t * 6) * 6 : 96);
    for (const f of flies) HAGGS.draw("firefly", f.x, f.y, 26 + Math.sin(f.t * 8) * 4, 26 + Math.sin(f.t * 8) * 4);
    for (const sh of shades) HAGGS.draw("shade", sh.x, sh.y + Math.sin(sh.t * 4) * 5, 58 * (1 + sh.fade * 0.6), 58 * (1 + sh.fade * 0.6), { alpha: 0.9 * (1 - sh.fade), flipX: sh.x > M.x });
    const wing = 1 + Math.sin(M.flap) * 0.12;
    HAGGS.draw("moth", M.x, M.y, 62 * wing, 62 / wing, { rot: M.vx / 900, alpha: M.hurt > 0 && Math.floor(M.hurt * 14) % 2 ? 0.4 : 1 });

    // The dark, with holes where there is light.
    dg.globalCompositeOperation = "source-over"; dg.clearRect(0, 0, W, H);
    dg.fillStyle = "rgba(4,5,16,0.93)"; dg.fillRect(0, 0, W, H);
    dg.globalCompositeOperation = "destination-out";
    const hole = (x, y, r, k) => { const gr = dg.createRadialGradient(x, y, r * 0.15, x, y, r); gr.addColorStop(0, "rgba(0,0,0," + k + ")"); gr.addColorStop(1, "rgba(0,0,0,0)"); dg.fillStyle = gr; dg.beginPath(); dg.arc(x, y, r, 0, 6.283); dg.fill(); };
    hole(M.x, M.y, radius() * (1 + Math.sin(t * 9) * 0.03), 1);
    for (const l of lamps) hole(l.x, l.y, l.lit > 0 ? 40 + 110 * l.lit + Math.sin(l.pulse * 3) * 4 : 46 + Math.sin(l.pulse * 3) * 8, l.lit > 0 ? 0.95 : 0.55);
    for (const f of flies) hole(f.x, f.y, 34, 0.7);
    if (finale) hole(W / 2, H / 2, finale.lit ? finale.r : 70, finale.lit ? 1 : 0.6);
    g.drawImage(dark, 0, 0, W, H);
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.18;
    const warm = g.createRadialGradient(M.x, M.y, 0, M.x, M.y, radius()); warm.addColorStop(0, "#ffcf6b"); warm.addColorStop(1, "rgba(255,207,107,0)");
    g.fillStyle = warm; g.fillRect(M.x - radius(), M.y - radius(), radius() * 2, radius() * 2); g.restore();

    HAGGS.text("Score " + score, 20, 34, { size: 22 });
    g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(20, 46, 200, 10);
    g.fillStyle = M.flame < 30 ? "#ff7a59" : "#ffcf6b"; g.fillRect(20, 46, 2 * Math.max(0, M.flame), 10);
    HAGGS.text("Flame", 228, 56, { size: 13, bold: false, color: "#d8d2c0" });
    const left = lamps.filter((l) => l.lit < 1).length;
    HAGGS.text(finale ? (finale.lit ? "Hold the light: " + Math.max(0, Math.ceil(18 - finale.t)) + "s" : "Reach the Great Lantern") : "Lamps left: " + left, W - 20, 34, { size: 20, align: "right", color: HAGGS.palette.accent });
    if (banner > 0) {
      const k = Math.min(1, banner, 2.4 - banner + 0.2);
      HAGGS.text(finale && !finale.lit ? "Light the Great Lantern" : STAGES[stage].name, W / 2, H / 2 - 10, { size: 42, align: "center", color: "rgba(255,240,200," + k + ")" });
      HAGGS.text(stage === 0 && !finale ? "Touch each lamp to light it. Space flares your light at shadows." : "", W / 2, H / 2 + 26, { size: 17, align: "center", bold: false, color: "rgba(255,240,200," + k + ")" });
    }
  },
});`;
