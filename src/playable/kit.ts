import type { CodeSpec } from "./spec";

/**
 * The haggs game kit: the small runtime a code game is written against, and
 * the page it runs in. The page is an iframe's srcdoc, sandboxed to scripts
 * only (no same origin, so no haggs cookies, storage or account), with a
 * content security policy that blocks every network request except the
 * pinned three.js for 3D games. Pictures arrive already made and keyed, as
 * data links, so the game never fetches anything.
 *
 * The kit's script comes before the game's, so a game that doesn't even
 * parse is still caught and reported. `KIT_API` is what Claude is told about
 * the kit; keep it in step with `KIT_SOURCE`.
 */

export const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

/** Logical size per aspect: the game always draws in these units. */
export const SIZES = { "16:9": [960, 540], "9:16": [540, 960], "4:3": [960, 720], "1:1": [800, 800] } as const;

export const KIT_API = `The game runs inside the haggs game kit. Everything is on the global HAGGS object (and THREE, when 3D is on). There is no DOM to build, no network, no imports, no localStorage, no web fonts.

Size and drawing
- HAGGS.W, HAGGS.H: the logical size you draw in (for example 960×540 for 16:9). The kit scales it to fit any screen.
- HAGGS.ctx: a 2D canvas context in logical units. Clear and draw the whole frame yourself each draw().
- HAGGS.img(id): the picture for an asset id from your manifest. It is always drawable: the made picture once there is one, its emoji (or a coloured shape) until then. Sprites have transparent backgrounds and fill their square, so draw them at the size you want them seen.
- Imported Game Director atlases animate automatically in HAGGS.img/draw/texture using the action and looping chosen in the Art panel. Playback follows HAGGS.time and resets on Replay. These are visual sprites, not automatic collision or combat logic.
- HAGGS.draw(id, x, y, w, h, { rot = 0, flipX = false, alpha = 1, center = true }): draw an asset, centred on x, y by default.
- HAGGS.text(str, x, y, { size = 24, color = "#fff", align = "left", bold = true, shadow = true }): text in a clean system font.
- HAGGS.palette: { sky, ground, accent, text } from your manifest.

3D (only when the brief says 3D is on)
- THREE is three.js r170. Make the renderer on the kit's canvas: new THREE.WebGLRenderer({ canvas: HAGGS.canvas, antialias: true }); renderer.setSize(HAGGS.W, HAGGS.H, false). Never touch HAGGS.ctx in a 3D game.
- HAGGS.hud: a 2D context over the 3D view, in logical units, cleared by the kit every frame. Draw scores and prompts there (HAGGS.text and HAGGS.draw accept { ctx: HAGGS.hud }).
- HAGGS.texture(id): a THREE texture of an asset's picture, updated when the picture is made. Use it on planes, sprites and simple meshes; there are no 3D model files.

Input (keyboard, mouse and touch are all covered for you)
- HAGGS.key(name): held now. HAGGS.pressed(name): went down this frame. Names: "left", "right", "up", "down" (arrows and WASD), "a" (Space, Z, Enter, and the on-screen A button), "b" (X, Shift, and the on-screen B button), or any KeyboardEvent.code like "KeyE".
- HAGGS.axis(): { x, y } from -1 to 1, from the arrows, WASD or the on-screen stick.
- HAGGS.pointer: { x, y, down, pressed, released } in logical units, for mouse and taps.
- On phones the kit shows a stick and A/B buttons when the manifest says "touch": "pad"; with "touch": "tap" it shows nothing and you read HAGGS.pointer.

Running
- Your script runs once when the player presses Play. Set up, then call HAGGS.start({ update(dt) { … }, draw() { … } }). update gets seconds (fixed 1/60) and runs before draw.
- HAGGS.sound(name): a short synthesised effect: "jump", "coin", "hit", "shoot", "explode", "powerup", "click", "win", "lose".
- HAGGS.music(mood): a quiet procedural loop that plays until the game ends: "upbeat", "tense", "calm", "spooky" or "heroic"; HAGGS.music(null) stops it. Start it in your setup.

Juice (use it generously; the kit updates and draws it on top of your frame)
- HAGGS.burst(x, y, { n = 18, color, speed = 240, life = 0.7, size = 4, gravity = 0, up = 0, drag = 0.97 }): a particle burst; color can be a list.
- HAGGS.float(text, x, y, { color, size = 20, life = 0.9 }): words that rise and fade, e.g. "+50", "Combo x3".
- HAGGS.shake(amount = 0.5): screen shake, 0 to 1. HAGGS.flash(color = "#fff", seconds = 0.15): a full-screen flash.
- HAGGS.lerp(a, b, t), HAGGS.clamp(v, lo, hi), HAGGS.ease.out(t) / .inOut(t) / .back(t): for smooth motion and pops.
- HAGGS.score(n): report the score as it changes. HAGGS.end({ won, score }): the game is over; the kit shows the result and a Play again button.
- HAGGS.rand(seed): a seeded random function returning 0 to 1. HAGGS.time: seconds since Play.`;

/** The kit itself, run before the game's script. Plain ES2020, no template literals. */
export const KIT_SOURCE = String.raw`(function () {
  "use strict";
  var cfg = JSON.parse(document.getElementById("haggs-config").textContent);
  var post = function (m) { try { m.haggs = true; parent.postMessage(m, "*"); } catch (e) {} };
  var failed = false;
  function fail(message, line) {
    if (failed) return; failed = true;
    post({ type: "error", message: String(message).slice(0, 500), line: line || 0 });
    var o = document.getElementById("overlay");
    o.innerHTML = "<div class='card'><b>This game hit a bug</b><p></p></div>";
    o.querySelector("p").textContent = String(message).slice(0, 300);
    o.style.display = "flex";
  }
  window.addEventListener("error", function (e) { fail(e.message || "Something went wrong.", e.lineno); });
  window.addEventListener("unhandledrejection", function (e) { fail((e.reason && e.reason.message) || String(e.reason)); });

  var W = cfg.size[0], H = cfg.size[1];
  var canvas = document.getElementById("game"), hudCanvas = document.getElementById("hud");
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  [canvas, hudCanvas].forEach(function (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
  var ctx2d = null, hud = hudCanvas.getContext("2d"); hud.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ── assets ──
  var pictures = {}, textures = {}, atlases = {};
  function animateAtlases(seconds) {
    Object.keys(atlases).forEach(function (id) {
      var item = atlases[id], a = item.atlas;
      var clip = a.animations.find(function (c) { return c.name === a.selected; }) || a.animations[0];
      var count = clip.end_frame_exclusive - clip.start_frame;
      var elapsed = Math.floor(Math.max(0, seconds) * a.fps);
      var index = clip.start_frame + (a.loop ? elapsed % count : Math.min(count - 1, elapsed));
      if (index === item.last) return;
      item.last = index;
      var f = a.frames[index], c = pictures[id], g = c.getContext('2d');
      if (c.width !== f.width || c.height !== f.height) { c.width = f.width; c.height = f.height; }
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(item.image, f.x, f.y, f.width, f.height, 0, 0, c.width, c.height);
      if (textures[id]) textures[id].needsUpdate = true;
    });
  }
  function placeholder(a) {
    var sprite = a.kind !== "background";
    var c = document.createElement("canvas"); c.width = sprite ? 256 : W; c.height = sprite ? 256 : H;
    var g = c.getContext("2d");
    if (!sprite) {
      var grad = g.createLinearGradient(0, 0, 0, c.height); grad.addColorStop(0, cfg.palette.sky); grad.addColorStop(1, cfg.palette.ground);
      g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
      // Soft glows in the game's colours, so a scene reads as a place before its picture is made.
      var seed = 0; for (var q = 0; q < a.id.length; q++) seed = (seed * 31 + a.id.charCodeAt(q)) >>> 0;
      for (var k = 0; k < 6; k++) {
        seed = (seed * 1103515245 + 12345) >>> 0; var gx = (seed % 1000) / 1000 * c.width;
        seed = (seed * 1103515245 + 12345) >>> 0; var gy = (seed % 1000) / 1000 * c.height, gr = c.height * (0.25 + (k % 3) * 0.15);
        var glow = g.createRadialGradient(gx, gy, 0, gx, gy, gr); glow.addColorStop(0, k % 2 ? cfg.palette.accent + "22" : a.color + "33"); glow.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = glow; g.fillRect(0, 0, c.width, c.height);
      }
      return c;
    }
    if (a.emoji) {
      g.font = "200px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 14; g.fillText(a.emoji, 128, 140); return c;
    }
    g.fillStyle = a.color; g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 10; g.beginPath();
    var s = a.shape, r = 108;
    if (s === "square") { g.roundRect ? g.roundRect(20, 20, 216, 216, 36) : g.rect(20, 20, 216, 216); }
    else if (s === "triangle") { g.moveTo(128, 18); g.lineTo(238, 230); g.lineTo(18, 230); g.closePath(); }
    else if (s === "diamond") { g.moveTo(128, 14); g.lineTo(242, 128); g.lineTo(128, 242); g.lineTo(14, 128); g.closePath(); }
    else if (s === "star") { for (var i = 0; i < 10; i++) { var rr = i % 2 ? 46 : r, t = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(128 + rr * Math.cos(t), 128 + rr * Math.sin(t)); } g.closePath(); }
    else { g.arc(128, 128, r, 0, Math.PI * 2); }
    g.fill(); g.stroke(); return c;
  }
  var loading = cfg.assets.map(function (a) {
    pictures[a.id] = placeholder(a);
    if (!a.src) return Promise.resolve();
    return new Promise(function (done) {
      var im = new Image();
      im.onload = function () {
        if (a.atlas) {
          if (im.naturalWidth !== a.atlas.width || im.naturalHeight !== a.atlas.height) { done(); return; }
          pictures[a.id] = document.createElement('canvas');
          atlases[a.id] = { image: im, atlas: a.atlas, last: -1 }; animateAtlases(0);
        } else pictures[a.id] = im;
        if (textures[a.id]) { textures[a.id].image = pictures[a.id]; textures[a.id].needsUpdate = true; } done();
      };
      im.onerror = function () { done(); };
      im.src = a.src;
    });
  });

  // ── input ──
  var held = {}, down = {}, names = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", Space: "a", KeyZ: "a", Enter: "a", KeyX: "b", ShiftLeft: "b", ShiftRight: "b" };
  function press(n, on) { if (on && !held[n]) down[n] = true; held[n] = on; }
  addEventListener("keydown", function (e) { if (/^(Arrow|Space)/.test(e.code)) e.preventDefault(); press(e.code, true); if (names[e.code]) press(names[e.code], true); });
  addEventListener("keyup", function (e) { press(e.code, false); if (names[e.code]) press(names[e.code], false); });
  addEventListener("blur", function () { held = {}; });
  var pointer = { x: W / 2, y: H / 2, down: false, pressed: false, released: false };
  function place(e) { var r = canvas.getBoundingClientRect(); pointer.x = (e.clientX - r.left) / r.width * W; pointer.y = (e.clientY - r.top) / r.height * H; }
  var stage = document.getElementById("stage");
  stage.addEventListener("pointerdown", function (e) { if (e.target.closest && e.target.closest(".pad")) return; place(e); pointer.down = true; pointer.pressed = true; });
  addEventListener("pointermove", function (e) { place(e); });
  addEventListener("pointerup", function () { if (pointer.down) pointer.released = true; pointer.down = false; });
  var stick = { x: 0, y: 0 };
  if (cfg.touch === "pad" && matchMedia("(pointer: coarse)").matches) {
    var pad = document.getElementById("pad"); pad.style.display = "block";
    var knob = pad.querySelector(".knob"), base = pad.querySelector(".stick"), sid = null;
    var move = function (e) { var r = base.getBoundingClientRect(), dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2), m = Math.max(1, Math.hypot(dx, dy)); stick.x = dx / m; stick.y = dy / m; knob.style.transform = "translate(" + stick.x * 34 + "px," + stick.y * 34 + "px)"; };
    base.addEventListener("pointerdown", function (e) { sid = e.pointerId; base.setPointerCapture(sid); move(e); });
    base.addEventListener("pointermove", function (e) { if (e.pointerId === sid) move(e); });
    var end = function () { sid = null; stick.x = stick.y = 0; knob.style.transform = ""; };
    base.addEventListener("pointerup", end); base.addEventListener("pointercancel", end);
    ["a", "b"].forEach(function (n) { var b = pad.querySelector(".btn-" + n); b.addEventListener("pointerdown", function (e) { e.preventDefault(); press(n, true); }); b.addEventListener("pointerup", function () { press(n, false); }); b.addEventListener("pointerleave", function () { press(n, false); }); });
  }

  // ── sound ──
  var audio = null;
  function tone(type, f1, f2, dur, vol, noise) {
    if (!audio) return; var t = audio.currentTime, g = audio.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); g.connect(audio.destination);
    if (noise) { var buf = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; var src = audio.createBufferSource(); src.buffer = buf; src.connect(g); src.start(t); return; }
    var o = audio.createOscillator(); o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); o.connect(g); o.start(t); o.stop(t + dur);
  }
  var SOUNDS = { jump: ["square", 300, 620, 0.16, 0.12], coin: ["square", 880, 1500, 0.12, 0.1], hit: ["sawtooth", 220, 60, 0.22, 0.16], shoot: ["square", 900, 200, 0.1, 0.08], explode: ["", 0, 0, 0.4, 0.25, true], powerup: ["triangle", 300, 1200, 0.35, 0.14], click: ["square", 600, 600, 0.04, 0.06], win: ["triangle", 520, 1040, 0.6, 0.16], lose: ["sawtooth", 400, 90, 0.7, 0.14] };

  // ── juice: particles, floating words, shake, flashes ──
  var bits = [], words = [], shakeT = 0, shakeA = 0, flashT = 0, flashMax = 0, flashC = "#fff";
  function fxUpdate(dt) {
    for (var i = bits.length - 1; i >= 0; i--) { var b = bits[i]; b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= b.drag; b.vy *= b.drag; if ((b.t -= dt) <= 0) bits.splice(i, 1); }
    for (var j = words.length - 1; j >= 0; j--) { var w = words[j]; w.y -= 46 * dt; if ((w.t -= dt) <= 0) words.splice(j, 1); }
    shakeT = Math.max(0, shakeT - dt); flashT = Math.max(0, flashT - dt);
    var s = shakeT > 0 ? shakeA * (shakeT / 0.4) : 0;
    stage.style.transform = s ? "translate(" + ((Math.random() - 0.5) * s) + "px," + ((Math.random() - 0.5) * s) + "px)" : "";
  }
  function fxDraw() {
    var g = cfg.three ? hud : HAGGS.ctx; g.save();
    for (var i = 0; i < bits.length; i++) { var b = bits[i], k = Math.max(0, b.t / b.life); g.globalAlpha = k; g.fillStyle = b.c; g.beginPath(); g.arc(b.x, b.y, b.r * (0.4 + 0.6 * k), 0, 6.283); g.fill(); }
    g.globalAlpha = 1; g.restore();
    for (var j = 0; j < words.length; j++) { var w = words[j]; HAGGS.text(w.s, w.x, w.y, { size: w.size, color: w.c, align: "center", ctx: g }); }
    if (flashT > 0) { hud.save(); hud.globalAlpha = 0.55 * flashT / flashMax; hud.fillStyle = flashC; hud.fillRect(0, 0, W, H); hud.restore(); }
  }

  // ── music: a small procedural loop per mood ──
  var MOODS = { upbeat: [[0, 4, 7, 12, 7, 4], 0.13, "square"], tense: [[0, 3, 6, 3, 0, -1], 0.16, "sawtooth"], calm: [[0, 7, 12, 16, 12, 7], 0.24, "triangle"], spooky: [[0, 1, 6, 1, 0, -6], 0.26, "triangle"], heroic: [[0, 7, 9, 12, 9, 7], 0.15, "square"] };
  var musicTimer = null;
  function music(mood) {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    var m = MOODS[mood]; if (!m || !audio) return;
    var root = 220, n = 0, bars = [0, 5, 3, 7];
    musicTimer = setInterval(function () {
      if (!audio || !running) return;
      var bar = bars[Math.floor(n / m[0].length) % bars.length], semis = m[0][n % m[0].length] + bar;
      tone(m[2], root * Math.pow(2, semis / 12), root * Math.pow(2, semis / 12), m[1] * 0.9, 0.025);
      if (n % m[0].length === 0) tone("triangle", root / 2 * Math.pow(2, bar / 12), root / 2 * Math.pow(2, bar / 12), m[1] * m[0].length * 0.9, 0.035);
      n++;
    }, m[1] * 1000);
  }

  // ── the loop ──
  var game = null, running = false, last = 0, acc = 0, step = 1 / 60;
  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.1, (now - last) / 1000 || 0); last = now; acc += dt;
    try {
      while (acc >= step) { acc -= step; HAGGS.time += step; game.update && game.update(step); fxUpdate(step); down = {}; pointer.pressed = false; pointer.released = false; if (!running) return; }
      hud.clearRect(0, 0, W, H);
      animateAtlases(HAGGS.time);
      game.draw && game.draw();
      fxDraw();
    } catch (e) { running = false; fail(e && e.message ? e.message : String(e)); return; }
    requestAnimationFrame(frame);
  }
  var lastScore = null;

  var HAGGS = window.HAGGS = {
    W: W, H: H, canvas: canvas, hud: hud, palette: cfg.palette, time: 0,
    get ctx() { if (!ctx2d) { ctx2d = canvas.getContext("2d"); ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0); ctx2d.imageSmoothingQuality = "high"; } return ctx2d; },
    img: function (id) { return pictures[id] || pictures[Object.keys(pictures)[0]] || placeholder({ kind: "sprite", color: cfg.palette.accent, shape: "circle" }); },
    draw: function (id, x, y, w, h, o) {
      o = o || {}; var g = o.ctx || HAGGS.ctx, im = HAGGS.img(id); g.save(); g.globalAlpha = o.alpha == null ? 1 : o.alpha; g.translate(x, y);
      if (o.rot) g.rotate(o.rot); if (o.flipX) g.scale(-1, 1);
      if (o.center === false) g.drawImage(im, 0, 0, w, h); else g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
    },
    text: function (s, x, y, o) {
      o = o || {}; var g = o.ctx || (cfg.three ? hud : HAGGS.ctx); g.save(); g.font = (o.bold === false ? "500 " : "800 ") + (o.size || 24) + "px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      g.textAlign = o.align || "left"; g.textBaseline = o.baseline || "alphabetic";
      if (o.shadow !== false) { g.fillStyle = "rgba(0,0,0,.55)"; g.fillText(String(s), x + 2, y + 2); }
      g.fillStyle = o.color || "#fff"; g.fillText(String(s), x, y); g.restore();
    },
    texture: function (id) {
      if (!window.THREE) throw new Error("HAGGS.texture needs 3D on.");
      if (!textures[id]) { var t = new THREE.Texture(HAGGS.img(id)); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; textures[id] = t; }
      return textures[id];
    },
    // A tap shorter than a frame still counts for that frame.
    key: function (n) { return !!(held[n] || down[n]); },
    pressed: function (n) { return !!down[n]; },
    axis: function () { var k = HAGGS.key, x = (k("right") ? 1 : 0) - (k("left") ? 1 : 0) + stick.x, y = (k("down") ? 1 : 0) - (k("up") ? 1 : 0) + stick.y; var m = Math.max(1, Math.hypot(x, y)); return { x: x / m, y: y / m }; },
    pointer: pointer,
    sound: function (n) { var s = SOUNDS[n]; if (s) tone(s[0], s[1], s[2], s[3], s[4], s[5]); },
    music: music,
    burst: function (x, y, o) {
      o = o || {}; var n = Math.min(160, o.n || 18), sp = o.speed || 240;
      for (var i = 0; i < n && bits.length < 1200; i++) { var a = Math.random() * 6.283, v = sp * (0.25 + Math.random() * 0.75), life = (o.life || 0.7) * (0.6 + Math.random() * 0.4); bits.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.gravity || 0, drag: o.drag || 0.97, t: life, life: life, r: o.size || 4, c: Array.isArray(o.color) ? o.color[i % o.color.length] : o.color || cfg.palette.accent }); }
    },
    float: function (s, x, y, o) { o = o || {}; words.push({ s: String(s), x: x, y: y, t: o.life || 0.9, size: o.size || 20, c: o.color || "#fff" }); },
    shake: function (amount) { shakeA = Math.max(shakeA * (shakeT > 0 ? 1 : 0), (amount || 0.5) * 22); shakeT = 0.4; },
    flash: function (color, t) { flashC = color || "#fff"; flashMax = flashT = t || 0.15; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    clamp: function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    ease: { out: function (t) { return 1 - Math.pow(1 - t, 3); }, inOut: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }, back: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } },
    score: function (n) { if (n !== lastScore) { lastScore = n; post({ type: "score", score: Number(n) || 0 }); } },
    end: function (r) {
      if (!running) return; running = false; r = r || {}; music(null); stage.style.transform = "";
      post({ type: "end", won: !!r.won, score: Number(r.score) || 0 });
      HAGGS.sound(r.won ? "win" : "lose");
      var o = document.getElementById("overlay");
      o.innerHTML = "<div class='card'><b></b><p></p><button>Play again</button></div>";
      o.querySelector("b").textContent = r.won ? "You win!" : "Game over";
      o.querySelector("p").textContent = r.score != null ? "Score " + r.score : "";
      o.querySelector("button").onclick = function () { location.reload(); };
      o.style.display = "flex";
    },
    start: function (g) { game = g; running = true; last = performance.now(); acc = 0; requestAnimationFrame(frame); },
    rand: function (seed) { var a = (seed >>> 0) || 1; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
  };

  // ── start card ──
  var ready = Promise.all(loading).then(function () { return cfg.three ? new Promise(function (ok) { if (window.THREE) ok(); else window.__haggsThree = ok; }) : null; });
  var o = document.getElementById("overlay"), play = o.querySelector("button");
  ready.then(function () { play.disabled = false; play.textContent = "Play"; post({ type: "ready" }); });
  play.onclick = function () {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    o.style.display = "none";
    try { window.__haggsGame(HAGGS, window.THREE); } catch (e) { fail(e && e.message ? e.message : String(e)); }
    if (!game && !failed) fail("The game didn't call HAGGS.start.");
  };
})();`;

const STYLE = `html,body{margin:0;height:100%;background:#000;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none}
#stage{position:fixed;inset:0;display:grid;place-items:center}
#game,#hud{grid-area:1/1;max-width:100vw;max-height:100vh;width:100vw;height:auto;aspect-ratio:var(--ar);object-fit:contain}
@media (min-aspect-ratio: var(--arn)){#game,#hud{width:auto;height:100vh}}
#hud{pointer-events:none}
#overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);font:15px system-ui,sans-serif;color:#fff}
.card{max-width:min(420px,86vw);padding:22px 24px;border-radius:18px;background:rgba(14,16,18,.88);border:1px solid rgba(255,255,255,.12);text-align:center;display:flex;flex-direction:column;gap:10px}
.card b{font-size:22px}.card p{margin:0;color:#c9cdd2;line-height:1.45}.card small{color:#8b929a}
.card button{margin-top:6px;padding:12px 18px;border:0;border-radius:999px;background:var(--accent);color:#0b0d0f;font:700 16px system-ui,sans-serif;cursor:pointer}
.card button:disabled{opacity:.6;cursor:wait}
#pad{display:none;position:fixed;inset:auto 0 0 0;height:0}
#pad .stick{position:fixed;left:22px;bottom:22px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.25);touch-action:none}
#pad .knob{position:absolute;left:35px;top:35px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.55)}
#pad .btn{position:fixed;bottom:30px;width:72px;height:72px;border-radius:50%;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.3);color:#fff;font:800 20px system-ui;display:grid;place-items:center;touch-action:none}
#pad .btn-a{right:26px}#pad .btn-b{right:112px;bottom:70px}`;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Inside a script element nothing may close it early. */
const inScript = (s: string) => s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");

export type FramePicture = { id: string; src?: string };

/**
 * The page a code game runs in. `pictures` are the made, keyed pictures as
 * data links (or links on `imageHosts` when they couldn't be keyed).
 */
export function srcdoc(spec: CodeSpec, pictures: Record<string, string>, imageHosts: string[] = []): string {
  const size = SIZES[spec.aspect];
  const config = {
    size,
    palette: spec.palette,
    three: spec.three,
    touch: spec.touch,
    assets: spec.art.assets.map((a) => ({ id: a.id, kind: a.kind, color: a.color, shape: a.shape, ...(a.emoji ? { emoji: a.emoji } : {}), ...(a.atlas ? { atlas: a.atlas } : {}), ...(pictures[a.id] ? { src: pictures[a.id] } : {}) })),
  };
  const hosts = imageHosts.filter((h) => /^https?:\/\/[a-z0-9.*:-]+$/i.test(h)).join(" ");
  const csp = [
    "default-src 'none'",
    `script-src 'unsafe-inline'${spec.three ? " https://cdn.jsdelivr.net" : ""}`,
    "style-src 'unsafe-inline'",
    `img-src data: blob:${hosts ? ` ${hosts}` : ""}`,
    "media-src data: blob:",
    "font-src data:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const ar = `${size[0]} / ${size[1]}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{--ar:${ar};--accent:${spec.palette.accent}}${STYLE.replace("var(--arn)", `${size[0]}/${size[1]}`)}</style></head><body>
<div id="stage"><canvas id="game"></canvas><canvas id="hud"></canvas></div>
<div id="pad"><div class="stick"><div class="knob"></div></div><div class="btn btn-b">B</div><div class="btn btn-a">A</div></div>
<div id="overlay"><div class="card"><b>${escapeHtml(spec.title)}</b><p>${escapeHtml(spec.pitch)}</p><small>${escapeHtml(spec.controls)}</small><button disabled>Loading…</button></div></div>
<script type="application/json" id="haggs-config">${inScript(JSON.stringify(config))}</script>
<script>${KIT_SOURCE}</script>
${spec.three ? `<script type="module">import * as THREE from "${THREE_URL}"; window.THREE = THREE; if (window.__haggsThree) window.__haggsThree();</script>` : ""}
<script>window.__haggsGame = function (HAGGS, THREE) {
${inScript(spec.code)}
};</script>
</body></html>`;
}
