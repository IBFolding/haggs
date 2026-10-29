/**
 * A featured code game: a side-scrolling platformer. A hedgehog courier runs
 * a meadow and a dusk forest with tight jumps, stompable beetles and bees, a
 * feather that lets it glide, checkpoints and moving platforms. Every tile and
 * backdrop is drawn in code, so it looks finished before any art is made.
 */
export const BRAMBLE_RUN = String.raw`const W = HAGGS.W, H = HAGGS.H, T = 40, ROWS = 14, g = HAGGS.ctx, rnd = HAGGS.rand(13);
const LEVELS = [
  { name: "Level 1: Clover Meadow", width: 112, sky: ["#8fd3ff", "#e3f6ff"], hill: ["#9fd77a", "#7cc35a"], ground: [[0, 22], [25, 40], [43, 60], [63, 84], [90, 112]],
    hills: [[36, 1], [37, 1], [38, 2], [39, 2], [72, 1], [73, 2], [74, 2]], plats: [[9, 13, 17], [8, 29, 33], [8, 46, 49], [9, 51, 55], [6, 66, 69], [9, 77, 80], [8, 96, 99]],
    thorns: [[11, 50], [11, 51], [11, 81], [11, 82]], acorns: [[11, 6], [11, 8], [11, 10], [8, 14], [8, 15], [8, 16], [7, 30], [7, 32], [10, 24], [10, 42], [6, 47], [6, 48], [5, 67], [5, 68], [11, 70], [8, 78], [10, 87], [7, 97], [7, 98], [11, 104]],
    beetles: [[11, 18], [11, 33], [11, 57], [11, 76], [11, 100]], bees: [[6, 88]], movers: [[10, 84, 89]], feather: [7, 31], checkpoint: 66, goal: 108 },
  { name: "Level 2: Dusk Thicket", width: 132, sky: ["#2d2156", "#f29a76"], hill: ["#3f3a6b", "#2e2a52"], ground: [[0, 15], [18, 28], [33, 44], [50, 62], [68, 80], [86, 98], [104, 132]],
    hills: [[24, 1], [25, 2], [26, 3], [58, 1], [59, 2], [90, 1], [91, 2], [110, 1], [111, 2], [112, 3], [113, 3]], plats: [[9, 9, 12], [7, 15, 17], [8, 29, 32], [6, 36, 39], [9, 45, 48], [7, 63, 66], [9, 81, 84], [6, 92, 95], [8, 99, 102], [5, 118, 121]],
    thorns: [[11, 22], [11, 39], [11, 40], [11, 74], [11, 75], [11, 76], [11, 107], [11, 108]], acorns: [[8, 10], [8, 11], [6, 16], [10, 20], [7, 30], [7, 31], [5, 37], [5, 38], [10, 47], [8, 46], [6, 64], [6, 65], [11, 70], [8, 82], [5, 93], [5, 94], [7, 100], [7, 101], [4, 119], [4, 120], [11, 125]],
    beetles: [[11, 6], [11, 26], [11, 42], [11, 55], [11, 72], [11, 90], [11, 116], [11, 124]], bees: [[6, 21], [5, 47], [6, 70], [5, 84], [6, 103], [5, 114]], movers: [[10, 44, 50], [9, 62, 68], [10, 98, 104]], feather: [8, 12], checkpoint: 68, goal: 128 },
];
let lv = 0, map = [], acorns = [], foes = [], movers = [], feather = null, check = null, goal = 0, L = LEVELS[0];
const P = { x: 0, y: 0, vx: 0, vy: 0, w: 26, h: 34, ground: false, coyote: 0, buffer: 0, face: 1, squash: 0, hurt: 0, lives: 3, glide: false, onMover: null, spawn: { x: 0, y: 0 } };
let camX = 0, score = 0, got = 0, banner = { t: 2.4, text: "" }, doneT = -1, won = false, clearT = -1, leaves = [];
for (let i = 0; i < 26; i++) leaves.push({ x: rnd() * W, y: rnd() * H, s: 0.5 + rnd(), r: rnd() * 6 });

function build(l) {
  L = LEVELS[l];
  map = []; for (let r = 0; r < ROWS; r++) map.push(new Array(L.width).fill("."));
  for (const [a, b] of L.ground) for (let c = a; c < b; c++) { map[12][c] = "#"; map[13][c] = "#"; }
  for (const [c, hgt] of L.hills) for (let k = 1; k <= hgt; k++) map[12 - k][c] = "#";
  for (const [r, a, b] of L.plats) for (let c = a; c <= b; c++) map[r][c] = "=";
  for (const [r, c] of L.thorns) map[r][c] = "^";
  acorns = L.acorns.map(([r, c]) => ({ x: c * T + T / 2, y: r * T + T / 2, t: rnd() * 6, got: false }));
  foes = L.beetles.map(([r, c]) => ({ kind: "beetle", x: c * T + 4, y: r * T + 8, w: 32, h: 30, vx: -60, vy: 0, dead: 0 }))
    .concat(L.bees.map(([r, c]) => ({ kind: "bee", x: c * T, y: r * T, w: 30, h: 28, base: r * T, x0: c * T, t: rnd() * 6, dead: 0 })));
  movers = L.movers.map(([r, a, b]) => ({ x: a * T, y: r * T, w: 3 * T, h: 16, a: a * T, b: (b - 3) * T, dir: 1, dx: 0 }));
  feather = L.feather ? { x: L.feather[1] * T + T / 2, y: L.feather[0] * T + T / 2, got: false } : null;
  check = { x: L.checkpoint * T, lit: false }; goal = L.goal * T;
  P.spawn = { x: 2 * T, y: 9 * T }; respawn(); P.glide = false;
  banner = { t: 2.4, text: L.name }; HAGGS.music(l === 0 ? "upbeat" : "heroic");
}
function respawn() { P.x = P.spawn.x; P.y = P.spawn.y; P.vx = 0; P.vy = 0; camX = Math.max(0, P.x - W * 0.35); }
const solidAt = (c, r) => r >= 0 && r < ROWS && c >= 0 && c < L.width && (map[r][c] === "#" || map[r][c] === "=");
const over = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function hurt(push) {
  if (P.hurt > 0 || doneT >= 0) return;
  P.lives--; P.hurt = 1.6; P.vy = -420; P.vx = push * 260; HAGGS.sound("hit"); HAGGS.shake(0.5); HAGGS.flash("#ff6b6b", 0.18);
  HAGGS.burst(P.x + P.w / 2 - camX, P.y + P.h / 2, { n: 18, color: ["#ffd0a8", "#ffffff"], speed: 220 });
  if (P.lives <= 0) { won = false; doneT = 1.4; HAGGS.music(null); HAGGS.sound("lose"); }
}
function moveX(dx) {
  P.x += dx;
  const r0 = Math.floor(P.y / T), r1 = Math.floor((P.y + P.h - 1) / T);
  if (dx > 0) { const c = Math.floor((P.x + P.w) / T); for (let r = r0; r <= r1; r++) if (solidAt(c, r)) { P.x = c * T - P.w; P.vx = 0; break; } }
  if (dx < 0) { const c = Math.floor(P.x / T); for (let r = r0; r <= r1; r++) if (solidAt(c, r)) { P.x = (c + 1) * T; P.vx = 0; break; } }
  P.x = Math.max(0, Math.min(L.width * T - P.w, P.x));
}
function moveY(dy) {
  P.y += dy;
  const c0 = Math.floor(P.x / T), c1 = Math.floor((P.x + P.w - 1) / T);
  if (dy > 0) { const r = Math.floor((P.y + P.h) / T); for (let c = c0; c <= c1; c++) if (solidAt(c, r)) { P.y = r * T - P.h; land(); return; } }
  if (dy < 0) { const r = Math.floor(P.y / T); for (let c = c0; c <= c1; c++) if (solidAt(c, r)) { P.y = (r + 1) * T; P.vy = 0; return; } }
}
function land() {
  if (!P.ground && P.vy > 420) { P.squash = 0.35; HAGGS.burst(P.x + P.w / 2 - camX, P.y + P.h, { n: 8, color: lv ? "#8f86c9" : "#c9a36b", speed: 120, life: 0.35, size: 3 }); }
  P.vy = 0; P.ground = true;
}
build(0);

HAGGS.start({
  update(dt) {
    banner.t -= dt;
    for (const l of leaves) { l.y += (20 + l.s * 30) * dt; l.x -= (10 + l.s * 20) * dt + (P.vx * dt) * 0.05; l.r += dt; if (l.y > H + 10) { l.y = -10; l.x = rnd() * W; } if (l.x < -10) l.x = W + 10; }
    if (doneT >= 0) { doneT -= dt; if (doneT <= 0) HAGGS.end({ won, score }); return; }
    if (clearT >= 0) { clearT -= dt; P.vx = 120; moveX(P.vx * dt); if (clearT <= 0) { clearT = -1; if (lv >= LEVELS.length - 1) { won = true; doneT = 0.2; } else build(++lv); } return; }
    const ax = HAGGS.axis().x, p = HAGGS.pointer;
    let move = ax, jumpHeld = HAGGS.key("a") || HAGGS.key("up");
    // Touch: hold the left or right third to run, tap the middle (or anywhere while running) to jump.
    if (p.down) { if (p.x < W / 3) move = -1; else if (p.x > (W * 2) / 3) move = 1; jumpHeld = jumpHeld || (p.y < H * 0.7 && p.x >= W / 3 && p.x <= (W * 2) / 3); }
    const jumpPressed = HAGGS.pressed("a") || HAGGS.pressed("up") || (p.pressed && p.x >= W / 3 && p.x <= (W * 2) / 3);

    const accel = P.ground ? 2600 : 1700, top = 270;
    if (move) { P.vx += move * accel * dt; P.face = move; } else { const f = (P.ground ? 2200 : 500) * dt; P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f; }
    P.vx = Math.max(-top, Math.min(top, P.vx));
    P.coyote = P.ground ? 0.1 : P.coyote - dt; P.buffer = jumpPressed ? 0.12 : P.buffer - dt;
    if (P.buffer > 0 && P.coyote > 0) { P.vy = -860; P.ground = false; P.coyote = 0; P.buffer = 0; P.squash = -0.3; HAGGS.sound("jump"); }
    if (!jumpHeld && P.vy < -260) P.vy *= 0.55;
    P.vy = Math.min(920, P.vy + 2200 * dt);
    if (P.glide && jumpHeld && P.vy > 110) { P.vy = 110; if (rnd() < dt * 20) HAGGS.burst(P.x + P.w / 2 - camX, P.y + P.h, { n: 1, color: "#ffffff", speed: 40, life: 0.4, size: 2.5 }); }
    P.squash *= 0.86; P.hurt -= dt;

    // Moving platforms carry what stands on them.
    for (const m of movers) { const nx = m.x + m.dir * 90 * dt; if (nx < m.a || nx > m.b) m.dir *= -1; m.dx = m.x; m.x = Math.max(m.a, Math.min(m.b, nx)); m.dx = m.x - m.dx; }
    if (P.onMover) moveX(P.onMover.dx);
    const wasGround = P.ground; P.ground = false; P.onMover = null;
    moveX(P.vx * dt); moveY(P.vy * dt);
    for (const m of movers) if (P.vy >= 0 && P.x + P.w > m.x && P.x < m.x + m.w && P.y + P.h >= m.y && P.y + P.h <= m.y + 18) { P.y = m.y - P.h; if (!wasGround) land(); P.vy = 0; P.ground = true; P.onMover = m; }
    if (!P.ground && wasGround && P.vy >= 0) P.coyote = 0.1;

    // Thorns, pits, pickups, the checkpoint and the gate.
    const c0 = Math.floor(P.x / T), c1 = Math.floor((P.x + P.w - 1) / T), r0 = Math.floor(P.y / T), r1 = Math.floor((P.y + P.h - 1) / T);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (r >= 0 && r < ROWS && map[r][c] === "^") hurt(-P.face);
    if (P.y > ROWS * T) { hurt(0); if (doneT < 0) { respawn(); P.hurt = 1.2; } }
    for (const a of acorns) if (!a.got && Math.abs(a.x - (P.x + P.w / 2)) < 26 && Math.abs(a.y - (P.y + P.h / 2)) < 28) { a.got = true; got++; score += 10; HAGGS.score(score); HAGGS.sound("coin"); HAGGS.burst(a.x - camX, a.y, { n: 10, color: ["#ffd34d", "#c98a3b"], speed: 150, life: 0.5 }); HAGGS.float("+10", a.x - camX, a.y - 20, { size: 16, color: "#ffd34d" }); }
    if (feather && !feather.got && Math.abs(feather.x - (P.x + P.w / 2)) < 30 && Math.abs(feather.y - (P.y + P.h / 2)) < 34) { feather.got = true; P.glide = true; HAGGS.sound("powerup"); HAGGS.flash("#ffffff", 0.2); HAGGS.float("Feather! Hold jump to glide", feather.x - camX, feather.y - 34, { size: 20, color: "#ffffff", life: 1.6 }); }
    if (!check.lit && P.x > check.x) { check.lit = true; P.spawn = { x: check.x, y: 9 * T }; HAGGS.sound("powerup"); HAGGS.float("Checkpoint", check.x - camX, 8 * T, { size: 20, color: "#ffcf6b" }); HAGGS.burst(check.x - camX + 10, 10 * T, { n: 30, color: ["#ffcf6b", "#fff3c4"], speed: 200 }); }
    if (P.x > goal) { clearT = 1.6; score += 200 + P.lives * 100; HAGGS.score(score); HAGGS.sound("win"); HAGGS.music(null); for (let k = 0; k < 4; k++) HAGGS.burst(W * (0.3 + k * 0.14), H * 0.35, { n: 30, color: ["#ff6fa8", "#ffd34d", "#7be06a", "#6fc3ff"], speed: 320, gravity: 420, life: 1.3 }); banner = { t: 1.6, text: lv >= LEVELS.length - 1 ? "Delivered!" : "Level clear!" }; }

    for (const f of foes) {
      if (f.dead) { f.dead -= dt; continue; }
      if (f.kind === "beetle") {
        f.vy = Math.min(900, f.vy + 2200 * dt); f.y += f.vy * dt;
        const below = Math.floor((f.y + f.h) / T), col = Math.floor((f.x + f.w / 2) / T);
        if (solidAt(col, below)) { f.y = below * T - f.h; f.vy = 0; }
        const ahead = Math.floor((f.vx > 0 ? f.x + f.w + 2 : f.x - 2) / T);
        if (solidAt(ahead, Math.floor((f.y + f.h / 2) / T)) || (f.vy === 0 && !solidAt(ahead, below)) || map[Math.floor((f.y + f.h / 2) / T)]?.[ahead] === "^") f.vx *= -1;
        f.x += f.vx * dt;
      } else { f.t += dt; f.y = f.base + Math.sin(f.t * 2.2) * 46; f.x = f.x0 + Math.sin(f.t * 0.9) * 60; }
      const box = { x: f.x, y: f.y, w: f.w, h: f.h };
      if (over(P, box)) {
        if (P.vy > 60 && P.y + P.h - f.y < 22) { f.dead = 0.4; P.vy = HAGGS.key("a") || HAGGS.key("up") ? -820 : -520; score += 50; HAGGS.score(score); HAGGS.sound("explode"); HAGGS.shake(0.2); HAGGS.burst(f.x + f.w / 2 - camX, f.y + f.h / 2, { n: 20, color: f.kind === "bee" ? ["#ffd34d", "#2a2230"] : ["#e2463c", "#2a2230"], speed: 220 }); HAGGS.float("+50", f.x - camX, f.y - 10, { size: 18 }); }
        else hurt(P.x < f.x ? -1 : 1);
      }
    }
    foes = foes.filter((f) => f.dead === 0 || f.dead > 0);
    camX += (Math.max(0, Math.min(L.width * T - W, P.x + P.face * 90 - W * 0.4)) - camX) * Math.min(1, dt * 6);
  },

  draw() {
    const t = HAGGS.time, sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, L.sky[0]); sky.addColorStop(1, L.sky[1]); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    HAGGS.draw(lv ? "dusk" : "meadow", W / 2, H / 2, W, H, { alpha: 0.6 });
    if (lv) { g.fillStyle = "rgba(255,240,210,.9)"; g.beginPath(); g.arc(760, 120, 46, 0, 6.283); g.fill(); }
    // Parallax: far hills, near hills, clouds.
    for (const [k, col, amp, base] of [[0.15, L.hill[0], 50, 330], [0.35, L.hill[1], 36, 390]]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, base - Math.sin((x + camX * k) / 140) * amp - Math.sin((x + camX * k) / 61) * amp * 0.3);
      g.lineTo(W, H); g.closePath(); g.fill();
    }
    g.fillStyle = lv ? "rgba(255,200,170,.35)" : "rgba(255,255,255,.85)";
    for (let i = 0; i < 6; i++) { const x = ((i * 260 - camX * 0.1 - t * 8) % (W + 300) + W + 300) % (W + 300) - 150, y = 70 + (i % 3) * 40; g.beginPath(); g.ellipse(x, y, 60, 18, 0, 0, 6.283); g.ellipse(x + 34, y - 10, 38, 16, 0, 0, 6.283); g.fill(); }

    g.save(); g.translate(-Math.round(camX), 0);
    const cA = Math.max(0, Math.floor(camX / T) - 1), cB = Math.min(L.width, cA + Math.ceil(W / T) + 3);
    for (let r = 0; r < ROWS; r++) for (let c = cA; c < cB; c++) {
      const ch = map[r][c], x = c * T, y = r * T;
      if (ch === "#") {
        g.fillStyle = lv ? "#4b3a5e" : "#9b6a3f"; g.fillRect(x, y, T, T);
        g.fillStyle = lv ? "#3c2f4d" : "#87593a"; g.fillRect(x + ((c * 7) % 22) + 4, y + ((r * 13) % 22) + 6, 6, 5); g.fillRect(x + ((c * 11) % 18) + 14, y + ((r * 5) % 18) + 18, 5, 4);
        if (r === 0 || map[r - 1][c] !== "#") { g.fillStyle = lv ? "#6c5fae" : "#69c24a"; g.fillRect(x, y, T, 12); g.fillStyle = lv ? "#8a7cd0" : "#86dc5f"; g.fillRect(x, y, T, 5); for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + 4 + k * 10, y + 12); g.lineTo(x + 8 + k * 10, y + 18); g.lineTo(x + 12 + k * 10, y + 12); g.fill(); } }
      } else if (ch === "=") {
        g.fillStyle = lv ? "#6d5a8a" : "#c58b4e"; g.fillRect(x, y, T, 16); g.fillStyle = lv ? "#55456d" : "#a8743f"; g.fillRect(x, y + 12, T, 4); g.fillRect(x + T - 3, y, 3, 16);
      } else if (ch === "^") {
        g.fillStyle = "#b54ac2"; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + k * 13, y + T); g.lineTo(x + 6 + k * 13, y + 14); g.lineTo(x + 13 + k * 13, y + T); g.fill(); }
      }
    }
    for (const m of movers) { g.fillStyle = lv ? "#8a7cd0" : "#e0a560"; g.beginPath(); g.roundRect(m.x, m.y, m.w, m.h, 6); g.fill(); g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(m.x + 6, m.y + m.h - 4, m.w - 12, 3); }
    // The checkpoint lantern and the goal gate.
    g.fillStyle = "#5a4030"; g.fillRect(check.x + 6, 10 * T - 20, 6, 2 * T + 20);
    g.fillStyle = check.lit ? "#ffcf6b" : "#8a7f73"; g.beginPath(); g.ellipse(check.x + 9, 10 * T - 28, 14, 18, 0, 0, 6.283); g.fill();
    if (check.lit) { g.globalAlpha = 0.3 + Math.sin(t * 4) * 0.1; g.fillStyle = "#ffcf6b"; g.beginPath(); g.arc(check.x + 9, 10 * T - 28, 40, 0, 6.283); g.fill(); g.globalAlpha = 1; }
    g.fillStyle = "#e8c07a"; g.fillRect(goal, 7 * T, 14, 5 * T); g.fillRect(goal + 4 * T - 14, 7 * T, 14, 5 * T); g.fillStyle = "#c8443a"; g.fillRect(goal - 10, 7 * T - 20, 4 * T + 20, 24);
    HAGGS.text("DELIVERY", goal + 2 * T, 7 * T - 2, { size: 16, align: "center", color: "#fff3e0" });
    for (let k = 0; k < 3; k++) { g.fillStyle = ["#ff6fa8", "#ffd34d", "#6fc3ff"][k]; g.beginPath(); g.ellipse(goal + 30 + k * 50, 7 * T + 30 + Math.sin(t * 3 + k) * 4, 10, 14, 0, 0, 6.283); g.fill(); }
    for (const a of acorns) if (!a.got) { a.t += 1 / 60; HAGGS.draw("acorn", a.x, a.y + Math.sin(a.t * 3) * 4, 28, 28); }
    if (feather && !feather.got) HAGGS.draw("feather", feather.x, feather.y + Math.sin(t * 2) * 6, 40, 40, { rot: Math.sin(t * 2) * 0.3 });
    for (const f of foes) {
      const s = f.dead > 0 ? 1 - f.dead : 0;
      HAGGS.draw(f.kind, f.x + f.w / 2, f.y + f.h / 2 + (f.kind === "beetle" ? Math.abs(Math.sin(t * 10 + f.x)) * -2 : 0), f.w * 1.35, f.h * 1.35 * (f.dead > 0 ? 0.4 : 1), { flipX: f.kind === "beetle" ? f.vx > 0 : Math.cos(f.t * 0.9) > 0, alpha: f.dead > 0 ? 1 - s : 1 });
    }
    const sq = P.squash, flash = P.hurt > 0 && Math.floor(P.hurt * 14) % 2;
    if (!flash) HAGGS.draw("hero", P.x + P.w / 2, P.y + P.h / 2 + 2 + sq * 10, 46 * (1 + sq * 0.6), 46 * (1 - sq * 0.6), { flipX: P.face > 0, rot: P.ground ? 0 : P.vx / 2400 });
    if (P.glide && !P.ground && (HAGGS.key("a") || HAGGS.key("up"))) HAGGS.draw("feather", P.x + P.w / 2, P.y - 6, 30, 30, { rot: Math.sin(t * 8) * 0.4 });
    g.restore();
    for (const l of leaves) { g.save(); g.translate(l.x, l.y); g.rotate(l.r); g.fillStyle = lv ? "rgba(255,190,140,.5)" : "rgba(120,190,80,.45)"; g.beginPath(); g.ellipse(0, 0, 6 * l.s, 3 * l.s, 0, 0, 6.283); g.fill(); g.restore(); }

    // HUD.
    g.fillStyle = "rgba(0,0,0,.28)"; g.beginPath(); g.roundRect(14, 12, 300, 44, 22); g.fill();
    for (let i = 0; i < 3; i++) HAGGS.draw("hero", 38 + i * 32, 34, 28, 28, { alpha: i < P.lives ? 1 : 0.25 });
    HAGGS.draw("acorn", 150, 34, 24, 24); HAGGS.text(String(got), 168, 42, { size: 18 });
    HAGGS.text("Score " + score, 300, 42, { size: 18, align: "right" });
    if (P.glide) HAGGS.draw("feather", 340, 34, 26, 26);
    g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(W - 220, 30, 200, 8); g.fillStyle = "#ffd34d"; g.fillRect(W - 220, 30, 200 * Math.min(1, P.x / goal), 8);
    if (banner.t > 0) { const k = Math.min(1, banner.t * 2); HAGGS.text(banner.text, W / 2, H * 0.36, { size: 40, align: "center", color: "rgba(255,255,255," + k + ")" }); }
    if (lv === 0 && t < 5) HAGGS.text("← → to run · Space or ↑ to jump (hold for higher) · jump on bugs", W / 2, H - 18, { size: 15, align: "center" });
  },
});`;
