/**
 * A featured code game: a little farm out back and a ramen stall out front.
 * Grow the ingredients, read the orders, build each bowl and serve it before
 * the customer gives up. Three days, an upgrade after each.
 */
export const NOODLE_PATCH = String.raw`const W = HAGGS.W, H = HAGGS.H, rnd = HAGGS.rand(9), g = HAGGS.ctx;
const DAY = 80, DAYS = 3, TARGET = 300;
const CROPS = { wheat: { label: "Noodles", grow: 5, gives: 2, color: "#f2c94c" }, scallion: { label: "Scallion", grow: 6, gives: 2, color: "#6fcf5b" }, mushroom: { label: "Mushroom", grow: 8, gives: 2, color: "#c08a5a" } };
const TOPPINGS = ["scallion", "mushroom", "egg"];
const CUSTOMERS = ["cat", "dog", "fox", "panda"];
const pantry = { wheat: 2, scallion: 1, mushroom: 0, egg: 1 };
let plots = [], seed = "wheat", eggs = 0, eggT = 4, bowl = [], seats = [null, null, null], spawnT = 2;
let day = 1, clock = DAY, coins = 0, served = 0, streak = 0, phase = "day", picks = [], perks = { grow: 1, pot: false, patience: 0, price: 0 }, doneT = -1, banner = { t: 2.4, text: "Day 1" };
const shake = (o) => Math.sin(HAGGS.time * 30) * o;

function makePlots(n) { const keep = plots; plots = []; for (let i = 0; i < n; i++) plots.push(keep[i] || { crop: null, t: 0, ripe: false, bounce: 0 }); }
makePlots(4);
const plotBox = (i) => ({ x: 52 + (i % 3) * 158, y: 178 + Math.floor(i / 3) * 132, w: 136, h: 110 });
const seedBox = (i) => ({ x: 52 + i * 120, y: 102, w: 108, h: 54 });
const seatX = (i) => 650 + i * 118;
const pantryBox = (i) => ({ x: 596 + i * 90, y: 462, w: 80, h: 64 });
const PANTRY = ["wheat", "scallion", "mushroom", "egg"];
const inside = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
HAGGS.music("calm");

function order() {
  const n = Math.min(3, 1 + Math.floor(rnd() * (1 + day)));
  const pool = TOPPINGS.slice().sort(() => rnd() - 0.5);
  return ["wheat"].concat(pool.slice(0, n));
}
function spawn() {
  const free = seats.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) return;
  const i = free[Math.floor(rnd() * free.length)], wait = 30 - day * 3 + perks.patience;
  seats[i] = { who: CUSTOMERS[Math.floor(rnd() * CUSTOMERS.length)], wants: order(), wait, max: wait, in: 0, mood: 0 };
  HAGGS.sound("click");
}
function same(a, b) { return a.length === b.length && a.every((x) => b.includes(x)); }
function serve(i) {
  const c = seats[i]; if (!c) return;
  const x = seatX(i);
  if (!bowl.length) { HAGGS.float("Make a bowl first", x, 190, { color: "#ffe9c2", size: 16 }); return; }
  if (!same(bowl, c.wants)) { c.mood = 0.6; HAGGS.sound("hit"); HAGGS.float("Not my order!", x, 190, { color: "#ff8a7a", size: 18 }); streak = 0; return; }
  const tip = Math.ceil((c.wait / c.max) * 8), pay = 8 + c.wants.length * 4 + tip + perks.price + Math.min(10, streak * 2);
  coins += pay; served++; streak++; HAGGS.score(coins);
  HAGGS.sound("coin"); HAGGS.burst(x, 220, { n: 26, color: ["#ffd34d", "#fff3c4", "#ff9f43"], speed: 240 });
  HAGGS.float("+" + pay + (streak > 1 ? "  streak x" + streak : ""), x, 180, { color: "#ffd34d", size: 22 });
  if (tip >= 7) HAGGS.float("Delicious!", x, 150, { color: "#ffffff", size: 16 });
  seats[i] = null; bowl = perks.pot ? ["wheat"] : [];
  if (perks.pot) pantry.wheat = Math.max(0, pantry.wheat - 1);
}
function endDay() {
  phase = "shop"; seats = [null, null, null]; bowl = [];
  const all = [
    { id: "plots", title: "Two more plots", says: "A bigger patch out back.", ok: plots.length < 6 },
    { id: "grow", title: "Compost", says: "Crops grow 30% faster.", ok: perks.grow > 0.6 },
    { id: "pot", title: "Big noodle pot", says: "Every new bowl starts with noodles.", ok: !perks.pot },
    { id: "patience", title: "Paper lanterns", says: "Customers wait 6s longer.", ok: perks.patience < 12 },
    { id: "price", title: "Secret broth", says: "Every bowl pays 4 more.", ok: perks.price < 8 },
  ].filter((p) => p.ok).sort(() => rnd() - 0.5);
  picks = all.slice(0, 3);
  HAGGS.sound("win");
}
function choose(p) {
  if (p.id === "plots") makePlots(plots.length + 2);
  if (p.id === "grow") perks.grow *= 0.7;
  if (p.id === "pot") perks.pot = true;
  if (p.id === "patience") perks.patience += 6;
  if (p.id === "price") perks.price += 4;
  day++; clock = DAY; phase = "day"; spawnT = 1.5; banner = { t: 2.4, text: "Day " + day + (day === DAYS ? ": the last rush" : "") };
  if (perks.pot) bowl = ["wheat"];
  HAGGS.sound("powerup"); HAGGS.flash("#fff6de", 0.2);
}

HAGGS.start({
  update(dt) {
    banner.t -= dt;
    if (doneT >= 0) { doneT -= dt; if (doneT <= 0) HAGGS.end({ won: coins >= TARGET, score: coins }); return; }
    const p = HAGGS.pointer;
    if (phase === "shop") {
      if (p.pressed) picks.forEach((pk, i) => { if (inside(p, { x: 150 + i * 230, y: 200, w: 210, h: 190 })) choose(pk); });
      return;
    }
    clock -= dt;
    if (clock <= 0) { if (day >= DAYS) { doneT = 1.4; HAGGS.music(null); if (coins >= TARGET) { HAGGS.flash("#ffe9a8", 0.4); for (let k = 0; k < 5; k++) HAGGS.burst(150 + k * 170, 200, { n: 40, color: ["#ff6fa8", "#ffd34d", "#7be06a", "#6fc3ff"], speed: 340, gravity: 400, life: 1.4 }); } } else endDay(); return; }

    for (const pl of plots) if (pl.crop && !pl.ripe) { pl.t += dt / perks.grow; if (pl.t >= CROPS[pl.crop].grow) { pl.ripe = true; pl.bounce = 1; HAGGS.sound("click"); } }
    for (const pl of plots) pl.bounce = Math.max(0, pl.bounce - dt * 2);
    eggT -= dt; if (eggT <= 0) { eggT = 7 * perks.grow; if (eggs < 3) { eggs++; HAGGS.sound("click"); } }
    if ((spawnT -= dt) <= 0 && clock > 8) { spawnT = 5 + rnd() * 5 - day; spawn(); }
    seats.forEach((c, i) => { if (!c) return; c.in = Math.min(1, c.in + dt * 3); c.mood = Math.max(0, c.mood - dt); c.wait -= dt; if (c.wait <= 0) { seats[i] = null; streak = 0; HAGGS.sound("lose"); HAGGS.float("Too slow…", seatX(i), 190, { color: "#ff8a7a", size: 18 }); } });

    if (p.pressed) {
      for (let i = 0; i < 3; i++) if (inside(p, seedBox(i))) { seed = Object.keys(CROPS)[i]; HAGGS.sound("click"); }
      plots.forEach((pl, i) => {
        if (!inside(p, plotBox(i))) return;
        const b = plotBox(i);
        if (!pl.crop) { pl.crop = seed; pl.t = 0; pl.ripe = false; HAGGS.sound("jump"); HAGGS.burst(b.x + b.w / 2, b.y + b.h - 20, { n: 10, color: ["#8a5a3b", "#6b4429"], speed: 120 }); }
        else if (pl.ripe) { const c = CROPS[pl.crop]; pantry[pl.crop] += c.gives; HAGGS.sound("coin"); HAGGS.float("+" + c.gives + " " + c.label, b.x + b.w / 2, b.y + 20, { color: "#ffffff", size: 16 }); HAGGS.burst(b.x + b.w / 2, b.y + b.h / 2, { n: 16, color: [c.color, "#ffffff"], speed: 180 }); pl.crop = null; pl.ripe = false; }
      });
      if (inside(p, { x: 40, y: 446, w: 150, h: 84 }) && eggs) { pantry.egg += eggs; HAGGS.sound("coin"); HAGGS.float("+" + eggs + " eggs", 115, 440, { color: "#fff6de", size: 16 }); eggs = 0; }
      PANTRY.forEach((k, i) => {
        if (!inside(p, pantryBox(i))) return;
        if (bowl.includes(k)) { HAGGS.float("Already in the bowl", 770, 380, { size: 14, color: "#ffe9c2" }); return; }
        if (pantry[k] <= 0) { HAGGS.float("Grow some first", pantryBox(i).x + 40, 450, { size: 14, color: "#ff8a7a" }); return; }
        pantry[k]--; bowl.push(k); HAGGS.sound("jump"); HAGGS.burst(770, 400, { n: 8, color: "#fff6de", speed: 90, up: 60, life: 0.6 });
      });
      if (inside(p, { x: 880, y: 380, w: 64, h: 40 }) && bowl.length) { bowl = []; HAGGS.sound("hit"); }
      seats.forEach((c, i) => { if (c && inside(p, { x: seatX(i) - 52, y: 120, w: 104, h: 210 })) serve(i); });
    }
    if (rnd() < dt * 6) HAGGS.burst(770 + (rnd() - 0.5) * 50, 360, { n: 1, color: "rgba(255,255,255,.6)", speed: 20, up: 70, life: 1.1, size: 7, drag: 0.99 });
  },

  draw() {
    const t = HAGGS.time;
    // Sky and hills.
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#ffd8a8"); sky.addColorStop(0.45, "#ffe9c9"); sky.addColorStop(1, "#cde7a8");
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    HAGGS.draw("farm", W / 2, H / 2, W, H, { alpha: 0.55 });
    g.fillStyle = "#9fcf6e"; g.beginPath(); g.ellipse(160, 560, 420, 200, 0, 0, 6.283); g.fill();
    g.fillStyle = "#8cc25e"; g.beginPath(); g.ellipse(520, 600, 380, 210, 0, 0, 6.283); g.fill();

    // The farm: seeds, plots, the hen.
    HAGGS.text("THE PATCH", 52, 86, { size: 16, color: "#6b4429", shadow: false });
    Object.keys(CROPS).forEach((k, i) => {
      const b = seedBox(i), on = seed === k;
      g.fillStyle = on ? "#fff6de" : "rgba(255,246,222,.55)"; g.strokeStyle = on ? "#e07a3f" : "rgba(107,68,41,.25)"; g.lineWidth = on ? 4 : 2;
      g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 14); g.fill(); g.stroke();
      HAGGS.draw(k, b.x + 26, b.y + b.h / 2, 34, 34); HAGGS.text(CROPS[k].label, b.x + 48, b.y + 33, { size: 13, color: "#6b4429", shadow: false });
    });
    plots.forEach((pl, i) => {
      const b = plotBox(i);
      g.fillStyle = "#7a4e2f"; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 16); g.fill();
      g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 3; for (let r = 1; r < 4; r++) { g.beginPath(); g.moveTo(b.x + 12, b.y + r * b.h / 4); g.lineTo(b.x + b.w - 12, b.y + r * b.h / 4); g.stroke(); }
      if (!pl.crop) { HAGGS.text("plant", b.x + b.w / 2, b.y + b.h / 2 + 6, { size: 14, align: "center", color: "rgba(255,246,222,.5)", shadow: false }); return; }
      const c = CROPS[pl.crop], k = Math.min(1, pl.t / c.grow), s = 26 + 44 * HAGGS.ease.out(k) + (pl.ripe ? Math.sin(t * 8) * 4 + pl.bounce * 16 : 0);
      for (let j = 0; j < 3; j++) HAGGS.draw(pl.crop, b.x + 30 + j * 38, b.y + b.h - 14 - s / 2 + (j === 1 ? -6 : 0), s * (j === 1 ? 1 : 0.8), s * (j === 1 ? 1 : 0.8), { rot: Math.sin(t * 2 + i + j) * 0.08 });
      if (!pl.ripe) { g.fillStyle = "rgba(0,0,0,.3)"; g.fillRect(b.x + 14, b.y + 8, b.w - 28, 7); g.fillStyle = c.color; g.fillRect(b.x + 14, b.y + 8, (b.w - 28) * k, 7); }
      else HAGGS.text("ready!", b.x + b.w / 2, b.y + 22, { size: 14, align: "center", color: "#fff6de" });
    });
    g.fillStyle = "#c0683b"; g.beginPath(); g.roundRect(40, 446, 150, 84, 14); g.fill();
    g.fillStyle = "#e9a16b"; g.beginPath(); g.moveTo(32, 452); g.lineTo(115, 410); g.lineTo(198, 452); g.closePath(); g.fill();
    HAGGS.draw("hen", 82, 486, 56, 56, { rot: Math.sin(t * 3) * 0.06 });
    for (let k = 0; k < eggs; k++) HAGGS.draw("egg", 130 + k * 18, 504 - Math.abs(Math.sin(t * 4 + k)) * 4, 24, 24);
    if (eggs) HAGGS.text("tap", 150, 470, { size: 12, color: "#fff6de" });

    // The stall: roof, curtain, customers, counter, pot, pantry.
    g.fillStyle = "#3b2a2a"; g.fillRect(572, 60, 388, 480);
    g.fillStyle = "#c8443a"; g.fillRect(560, 44, 412, 34);
    for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? "#d9584d" : "#b83a31"; g.fillRect(580 + k * 63, 78, 58, 42 + Math.sin(t * 2 + k) * 2); }
    HAGGS.text("NOODLE PATCH", 766, 106, { size: 22, align: "center", color: "#fff3e0" });
    for (const lx of [596, 936]) { g.fillStyle = "#ffcf6b"; g.beginPath(); g.ellipse(lx, 150 + Math.sin(t * 2 + lx) * 2, 14, 20, 0, 0, 6.283); g.fill(); }
    seats.forEach((c, i) => {
      if (!c) return;
      const x = seatX(i), y = 262 + (1 - c.in) * 60 + shake(c.mood * 4);
      HAGGS.draw(c.who, x, y, 92, 92, { alpha: c.in });
      // The order bubble.
      g.fillStyle = "#fff9ee"; g.beginPath(); g.roundRect(x - 52, 136, 104, 58, 14); g.fill();
      c.wants.forEach((k, j) => HAGGS.draw(k, x - 36 + j * 24 + (4 - c.wants.length) * 12, 160, 26, 26));
      const left = c.wait / c.max; g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x - 44, 184, 88, 6); g.fillStyle = left > 0.5 ? "#6fcf5b" : left > 0.25 ? "#f2c94c" : "#eb5757"; g.fillRect(x - 44, 184, 88 * left, 6);
    });
    g.fillStyle = "#8a5a3b"; g.fillRect(572, 320, 388, 28); g.fillStyle = "#6b4429"; g.fillRect(572, 348, 388, 10);
    HAGGS.draw("bowl", 770, 404, 92, 92);
    bowl.forEach((k, j) => HAGGS.draw(k, 742 + j * 20, 384 - (j % 2) * 8, 28, 28));
    HAGGS.text(bowl.length ? "tap a customer to serve" : "tap the pantry to build a bowl", 770, 448, { size: 12, align: "center", color: "#ffe9c2", shadow: false });
    if (bowl.length) { g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.roundRect(880, 380, 64, 40, 12); g.fill(); HAGGS.text("toss", 912, 406, { size: 14, align: "center", color: "#ffe9c2" }); }
    PANTRY.forEach((k, i) => {
      const b = pantryBox(i), n = pantry[k];
      g.fillStyle = n ? "rgba(255,246,222,.16)" : "rgba(255,246,222,.06)"; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 12); g.fill();
      HAGGS.draw(k, b.x + 28, b.y + 32, 38, 38, { alpha: n ? 1 : 0.35 });
      HAGGS.text("×" + n, b.x + b.w - 8, b.y + b.h - 10, { size: 16, align: "right", color: n ? "#fff3e0" : "#9c8a80" });
    });

    // HUD.
    g.fillStyle = "rgba(59,42,42,.82)"; g.beginPath(); g.roundRect(16, 14, 540, 46, 23); g.fill();
    HAGGS.text("Day " + day + "/" + DAYS, 36, 45, { size: 18 });
    g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(140, 32, 180, 10); g.fillStyle = clock < 12 ? "#ff8a7a" : "#ffcf6b"; g.fillRect(140, 32, 180 * Math.max(0, clock / DAY), 10);
    HAGGS.draw("coin", 352, 37, 26, 26); HAGGS.text(coins + " / " + TARGET, 372, 45, { size: 18, color: coins >= TARGET ? "#7be06a" : "#ffffff" });
    if (streak > 1) HAGGS.text("streak x" + streak, 540, 45, { size: 14, align: "right", color: "#ffd34d" });
    if (banner.t > 0) { const k = Math.min(1, banner.t * 2); g.fillStyle = "rgba(59,42,42," + 0.6 * k + ")"; g.fillRect(0, H / 2 - 46, W, 80); HAGGS.text(banner.text, W / 2, H / 2 + 8, { size: 40, align: "center", color: "rgba(255,243,224," + k + ")" }); }
    if (day === 1 && clock > DAY - 6) HAGGS.text("Plant, harvest, then build bowls from the pantry and serve them", W / 2, H - 14, { size: 15, align: "center" });

    if (phase === "shop") {
      g.fillStyle = "rgba(30,20,20,.72)"; g.fillRect(0, 0, W, H);
      HAGGS.text("Day " + day + " done · " + coins + " coins", W / 2, 140, { size: 34, align: "center" });
      HAGGS.text("Pick one upgrade for tomorrow", W / 2, 176, { size: 17, align: "center", bold: false, color: "#ffe9c2" });
      picks.forEach((pk, i) => {
        const x = 150 + i * 230, hover = inside(HAGGS.pointer, { x, y: 200, w: 210, h: 190 });
        g.fillStyle = hover ? "#fff6de" : "#f3e3c3"; g.beginPath(); g.roundRect(x, 200 - (hover ? 6 : 0), 210, 190, 18); g.fill();
        HAGGS.text(pk.title, x + 105, 262, { size: 20, align: "center", color: "#3b2a2a", shadow: false });
        HAGGS.text(pk.says, x + 105, 296, { size: 14, align: "center", bold: false, color: "#6b4429", shadow: false });
        HAGGS.text("choose", x + 105, 360, { size: 15, align: "center", color: "#c8443a", shadow: false });
      });
    }
  },
});`;
