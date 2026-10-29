/** A featured code game: a shooter whose wreckage is your fuel. Scrap flies to your hull and charges Overdrive. */
export const STARLIGHT_SALVAGE = String.raw`const W = HAGGS.W, H = HAGGS.H, rnd = HAGGS.rand(7);
const P = { x: 150, y: H / 2, cool: 0, lives: 3, hurt: 0, power: 1, tilt: 0, over: 0, overT: 0 };
let bullets = [], foes = [], shots = [], scrap = [], drops = [], stars = [];
let score = 0, wave = 0, waveT = 1.2, boss = null, doneT = -1, won = false, banner = { text: "Wave 1", t: 1.6 }, combo = 0, comboT = 0;
for (let i = 0; i < 120; i++) stars.push({ x: rnd() * W, y: rnd() * H, z: 0.25 + rnd() * 1.3 });
const hit = (a, b, ra, rb) => { const dx = a.x - b.x, dy = a.y - b.y, r = ra + rb; return dx * dx + dy * dy < r * r; };
HAGGS.music("upbeat");

function spawnWave() {
  wave++;
  if (wave > 5) { boss = { x: W + 180, y: H / 2, hp: 110, max: 110, t: 0, cool: 1.2, flash: 0, phase: 1 }; banner = { text: "The Salvage Queen", t: 2 }; HAGGS.music("tense"); HAGGS.sound("powerup"); return; }
  banner = { text: ["Wave 1: junk field", "Wave 2: gunners", "Wave 3: the swarm", "Wave 4: armoured", "Wave 5: everything"][wave - 1], t: 1.6 };
  const n = 6 + wave * 2;
  for (let i = 0; i < n; i++) {
    const kind = wave >= 2 && i % 3 === 2 ? "drone" : wave >= 3 && i % 4 === 1 ? "darter" : "scrap";
    const y = 70 + rnd() * (H - 140);
    foes.push({ kind, x: W + 60 + i * (kind === "darter" ? 40 : 85), y, base: y, hp: kind === "drone" ? 3 + (wave > 3 ? 1 : 0) : 1 + (wave > 3 ? 1 : 0), t: rnd() * 6, cool: 1.2 + rnd() * 2, flash: 0 });
  }
}
function hurtPlayer() {
  if (P.hurt > 0 || P.overT > 0 || doneT >= 0) return;
  P.lives--; P.hurt = 1.8; P.power = Math.max(1, P.power - 1); combo = 0;
  HAGGS.sound("hit"); HAGGS.shake(0.7); HAGGS.flash("#ff5d5d", 0.2); HAGGS.burst(P.x, P.y, { n: 30, color: ["#ff8a5c", "#ffd34d"], speed: 300 });
  if (P.lives <= 0) finish(false);
}
function finish(w) { if (doneT >= 0) return; won = w; doneT = 1.8; HAGGS.music(null); if (w) { HAGGS.burst(boss.x, boss.y, { n: 160, color: ["#ffd34d", "#ff6fb0", "#9ef0ff"], speed: 520, life: 1.3 }); HAGGS.flash("#fff3a0", 0.5); HAGGS.shake(1); } }
function kill(f, i) {
  foes.splice(i, 1);
  combo = comboT > 0 ? combo + 1 : 1; comboT = 1.6;
  const gain = (f.kind === "drone" ? 250 : f.kind === "darter" ? 150 : 100) * Math.min(8, combo);
  score += gain; HAGGS.score(score);
  HAGGS.burst(f.x, f.y, { n: 22, color: f.kind === "drone" ? ["#9ef0ff", "#ffffff"] : ["#ffb347", "#ff6f3c"], speed: 280 }); HAGGS.sound("explode"); HAGGS.shake(0.15);
  HAGGS.float(combo > 1 ? "x" + Math.min(8, combo) + "  +" + gain : "+" + gain, f.x, f.y - 24, { color: combo > 2 ? "#ffd34d" : "#ffffff", size: 16 + Math.min(8, combo) * 2 });
  for (let k = 0; k < 3 + (f.kind === "drone" ? 3 : 0); k++) scrap.push({ x: f.x, y: f.y, vx: (rnd() - 0.5) * 260, vy: (rnd() - 0.5) * 260, t: 0 });
  if (rnd() < 0.12) drops.push({ x: f.x, y: f.y, t: 0 });
}

HAGGS.start({
  update(dt) {
    for (const s of stars) { s.x -= (60 + 260 * s.z) * dt * (P.overT > 0 ? 2.2 : 1); if (s.x < -4) { s.x = W + 4; s.y = rnd() * H; } }
    banner.t -= dt; comboT -= dt;
    if (doneT >= 0) { doneT -= dt; if (doneT <= 0) HAGGS.end({ won, score }); return; }
    const ax = HAGGS.axis();
    P.x = HAGGS.clamp(P.x + ax.x * 360 * dt, 36, W * 0.62); P.y = HAGGS.clamp(P.y + ax.y * 360 * dt, 36, H - 36);
    P.tilt = HAGGS.lerp(P.tilt, ax.y * 0.35, Math.min(1, dt * 10));
    P.cool -= dt; P.hurt -= dt; P.overT -= dt;
    if (rnd() < dt * 40) HAGGS.burst(P.x - 30, P.y + (rnd() - 0.5) * 8, { n: 1, color: P.overT > 0 ? ["#ff6fb0", "#9ef0ff", "#ffd34d"] : "#ffb347", speed: 60, life: 0.35, size: 3, drag: 0.9 });
    if ((HAGGS.key("a") || HAGGS.pointer.down) && P.cool <= 0) {
      const over = P.overT > 0;
      P.cool = over ? 0.07 : 0.15;
      const spread = over ? [-0.22, -0.11, 0, 0.11, 0.22] : P.power === 1 ? [0] : P.power === 2 ? [-0.07, 0.07] : [-0.15, 0, 0.15];
      for (const a of spread) bullets.push({ x: P.x + 30, y: P.y, vx: Math.cos(a) * 820, vy: Math.sin(a) * 820 });
      HAGGS.sound("shoot");
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i]; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x > W + 20 || b.y < -20 || b.y > H + 20) { bullets.splice(i, 1); continue; }
      let gone = false;
      for (let j = foes.length - 1; j >= 0; j--) { const f = foes[j]; if (hit(b, f, 7, f.kind === "drone" ? 28 : 20)) { gone = true; f.hp--; f.flash = 0.08; if (f.hp <= 0) kill(f, j); break; } }
      if (!gone && boss && boss.x < W - 60 && hit(b, boss, 7, 82)) {
        gone = true; boss.hp--; boss.flash = 0.06; score += 25; HAGGS.score(score); HAGGS.burst(b.x, b.y, { n: 4, color: "#fff3a0", speed: 140, life: 0.3 });
        if (boss.phase === 1 && boss.hp < boss.max / 2) { boss.phase = 2; HAGGS.flash("#ff6fb0", 0.3); HAGGS.shake(0.6); HAGGS.float("She's angry!", boss.x, boss.y - 110, { color: "#ff6fb0", size: 26 }); }
        if (boss.hp <= 0) { score += 5000 + P.lives * 1500; HAGGS.score(score); HAGGS.sound("explode"); finish(true); }
      }
      if (gone) bullets.splice(i, 1);
    }
    for (const f of foes) {
      f.t += dt; f.flash -= dt;
      if (f.kind === "darter") { f.x -= 360 * dt; f.y = f.base + Math.sin(f.t * 7) * 16; }
      else { f.x -= (f.kind === "drone" ? 120 : 170 + wave * 14) * dt; f.y = f.base + Math.sin(f.t * (f.kind === "drone" ? 1.6 : 2.6)) * (f.kind === "drone" ? 60 : 34); }
      if (f.kind === "drone" && f.x < W - 40 && (f.cool -= dt) <= 0) { f.cool = 1.7 + rnd(); const a = Math.atan2(P.y - f.y, P.x - f.x); shots.push({ x: f.x - 20, y: f.y, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270 }); }
      if (hit(f, P, 20, 22)) { f.hp = 0; hurtPlayer(); }
    }
    for (let j = foes.length - 1; j >= 0; j--) { const f = foes[j]; if (f.hp <= 0) kill(f, j); else if (f.x < -70) foes.splice(j, 1); }
    if (boss) {
      boss.t += dt; boss.flash -= dt;
      boss.x = HAGGS.lerp(boss.x, W - 170, Math.min(1, dt * 1.2));
      boss.y = H / 2 + Math.sin(boss.t * (boss.phase === 2 ? 1.5 : 0.9)) * (H / 2 - 110);
      if ((boss.cool -= dt) <= 0) {
        boss.cool = boss.phase === 2 ? 0.6 : 1.1;
        const n = boss.phase === 2 ? 9 : 5, spin = boss.phase === 2 ? boss.t : 0;
        for (let k = 0; k < n; k++) { const a = Math.PI + (k - (n - 1) / 2) * 0.2 + Math.sin(spin) * 0.3; shots.push({ x: boss.x - 70, y: boss.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260 }); }
        HAGGS.sound("shoot");
      }
      if (hit(boss, P, 80, 22)) hurtPlayer();
    }
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; if (s.x < -20 || s.x > W + 20 || s.y < -20 || s.y > H + 20) { shots.splice(i, 1); continue; } if (hit(s, P, 8, 18)) { shots.splice(i, 1); hurtPlayer(); } }
    for (let i = scrap.length - 1; i >= 0; i--) {
      const s = scrap[i]; s.t += dt;
      const dx = P.x - s.x, dy = P.y - s.y, d = Math.hypot(dx, dy) || 1, pull = s.t > 0.35 ? 1400 / Math.max(60, d) * 60 : 0;
      s.vx = s.vx * 0.94 + (dx / d) * pull * dt; s.vy = s.vy * 0.94 + (dy / d) * pull * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (d < 26) {
        scrap.splice(i, 1); score += 5; P.over = Math.min(100, P.over + 4); HAGGS.sound("coin");
        if (P.over >= 100 && P.overT <= 0) { P.over = 0; P.overT = 6; HAGGS.flash("#9ef0ff", 0.3); HAGGS.shake(0.4); HAGGS.sound("powerup"); HAGGS.float("OVERDRIVE", P.x + 60, P.y - 40, { color: "#9ef0ff", size: 30, life: 1.2 }); }
      }
    }
    for (let i = drops.length - 1; i >= 0; i--) { const d = drops[i]; d.t += dt; d.x -= 110 * dt; if (hit(d, P, 18, 22)) { drops.splice(i, 1); P.power = Math.min(3, P.power + 1); HAGGS.sound("powerup"); HAGGS.float("Power up!", P.x, P.y - 34, { color: "#35e48a" }); continue; } if (d.x < -30) drops.splice(i, 1); }
    if (!boss && foes.length === 0 && (waveT -= dt) <= 0) { waveT = 1.4; spawnWave(); }
  },
  draw() {
    const g = HAGGS.ctx;
    HAGGS.draw("space", W / 2, H / 2, W, H);
    for (const s of stars) { g.fillStyle = "rgba(255,255,255," + (0.25 + s.z * 0.45) + ")"; g.fillRect(s.x, s.y, (1 + s.z * 2.2) * (P.overT > 0 ? 4 : 1), 1 + s.z); }
    for (const d of drops) HAGGS.draw("powerup", d.x, d.y, 40, 40, { rot: Math.sin(d.t * 4) * 0.3 });
    for (const s of scrap) HAGGS.draw("bit", s.x, s.y, 16, 16, { rot: s.t * 9 });
    for (const f of foes) HAGGS.draw(f.kind, f.x, f.y, f.kind === "drone" ? 70 : f.kind === "darter" ? 46 : 54, f.kind === "drone" ? 70 : f.kind === "darter" ? 46 : 54, { alpha: f.flash > 0 ? 0.45 : 1, rot: f.kind === "scrap" ? f.t * 1.5 : 0 });
    if (boss) HAGGS.draw("boss", boss.x, boss.y, 200 + Math.sin(boss.t * 3) * 6, 200 - Math.sin(boss.t * 3) * 6, { alpha: boss.flash > 0 ? 0.55 : 1 });
    for (const b of bullets) HAGGS.draw("bolt", b.x, b.y, 28, 12, { rot: Math.atan2(b.vy, b.vx) });
    for (const s of shots) HAGGS.draw("spark", s.x, s.y, 22, 22, { rot: HAGGS.time * 8 });
    if (doneT < 0 || won) HAGGS.draw("ship", P.x, P.y, 68, 68, { rot: P.tilt, alpha: P.hurt > 0 && Math.floor(P.hurt * 12) % 2 ? 0.3 : 1 });
    if (P.overT > 0) { g.save(); g.globalAlpha = 0.35 + Math.sin(HAGGS.time * 20) * 0.15; g.strokeStyle = "#9ef0ff"; g.lineWidth = 3; g.beginPath(); g.arc(P.x, P.y, 44, 0, 6.283); g.stroke(); g.restore(); }
    HAGGS.text("Score " + score, 20, 36, { size: 24 });
    for (let i = 0; i < P.lives; i++) HAGGS.draw("ship", W - 40 - i * 40, 28, 32, 32);
    g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(20, 48, 180, 8);
    g.fillStyle = P.overT > 0 ? "#ff6fb0" : "#9ef0ff"; g.fillRect(20, 48, P.overT > 0 ? 180 * P.overT / 6 : 1.8 * P.over, 8);
    HAGGS.text(P.overT > 0 ? "OVERDRIVE" : "Overdrive", 208, 57, { size: 12, color: "#9ef0ff", bold: P.overT > 0 });
    HAGGS.text(boss ? "Boss" : "Wave " + Math.max(1, wave) + " / 5", W / 2, 36, { size: 20, align: "center", color: HAGGS.palette.accent });
    if (boss) { g.fillStyle = "rgba(255,255,255,.15)"; g.fillRect(W / 2 - 160, 48, 320, 10); g.fillStyle = boss.phase === 2 ? "#ff6fb0" : HAGGS.palette.accent; g.fillRect(W / 2 - 160, 48, 320 * Math.max(0, boss.hp / boss.max), 10); }
    if (banner.t > 0) HAGGS.text(banner.text, W / 2, H / 2, { size: 44, align: "center", color: "rgba(255,255,255," + Math.min(1, banner.t) + ")" });
  },
});`;
