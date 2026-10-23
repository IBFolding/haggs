import { readFileSync, writeFileSync } from "node:fs";
import { launch, cursorOn, record, sleep, moveTo, clickEl, byText, typeSlow, BASE } from "./lib.mjs";
const SNAP = "/Volumes/CODEX PROJECTS/HAGGS/haggs/.haggs/bridge/projects/cef8b810-00f3-4366-8f52-c8bbecf338d3.json";
const { browser, page } = await launch(); await cursorOn(page);
const go = (p) => page.goto(BASE + p, { waitUntil: "networkidle2", timeout: 120000 });
await go("/library");
const snap = JSON.parse(readFileSync(SNAP, "utf8")).project;
await page.evaluate(async (project) => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open("haggs", 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction("kv", "readwrite"); const st = tx.objectStore("kv");
  const idx = await new Promise((r) => { const g = st.get("projects/index"); g.onsuccess = () => r(g.result || []); });
  const sum = { id: project.id, name: project.name, updatedAt: Date.now(), shotCount: (project.boards || []).reduce((n, b) => n + b.shots.length, 0), boardCount: (project.boards || []).length };
  st.put(project, "projects/" + project.id); st.put([sum, ...idx.filter((x) => x.id !== project.id)], "projects/index");
  await new Promise((r) => (tx.oncomplete = r));
}, snap);
const segs = [];
// Each scene records for at least `min` seconds (its narration plus a breath), so picture and voice line up.
async function scene(name, min, setup, act) {
  try { await setup(); } catch (e) { console.log("SETUP FAILED", name, e.message); return; }
  const file = `seg2-${name}.webm`; const rec = await record(page, file); const t = Date.now();
  try { await act(); } catch (e) { console.log("SCENE FAILED", name, e.message); }
  while ((Date.now() - t) / 1000 < min) await sleep(100);
  await rec.stop(); segs.push({ name, file, seconds: (Date.now() - t) / 1000 }); console.log(name, "done", ((Date.now() - t) / 1000).toFixed(1));
}
const setup = (p, wait = 1500) => async () => { await go(p); await sleep(wait); };
const MIN = { home: 9.6, workflows: 14.8, canvas: 10.8, series: 10.4, seriesgen: 4, editor: 13.9, academy: 7.6, gpu: 5.6, mcp: 5.6, end: 5.9 };

await scene("home", MIN.home, setup("/"), async () => { await moveTo(page, 700, 520); await sleep(3000); await page.mouse.wheel({ deltaY: 700 }); await sleep(2800); await page.mouse.wheel({ deltaY: 700 }); await sleep(1500); });

await scene("workflows", MIN.workflows, setup("/workflows", 2000), async () => {
  for (let i = 0; i < 4; i++) { await page.mouse.wheel({ deltaY: 520 }); await sleep(1300); }
  await page.evaluate(() => window.scrollTo({ top: 0 })); await sleep(600);
  const card = await byText(page, "a.quick-card", "Relight a photo");
  await card.evaluate((n) => n.scrollIntoView({ block: "center" })); await sleep(500);
  await clickEl(page, card); await page.waitForSelector("textarea", { timeout: 60000 }); await sleep(2500);
});

await scene("canvas", MIN.canvas, setup("/workflows/build", 2500), async () => {
  const add = async (label) => { await clickEl(page, await byText(page, "button", "+ Add")); await sleep(500); await clickEl(page, await byText(page, "button[role=menuitem]", label)); await sleep(900); };
  await add("Edit the picture"); await add("Animate it"); await sleep(600);
  await clickEl(page, await byText(page, "button", "Best open")); await sleep(2500);
});

await scene("series", MIN.series, setup("/series", 5500), async () => {
  await clickEl(page, await byText(page, "[role=radio]", "Faceless channel")); await sleep(800);
  await clickEl(page, await byText(page, ".series-chips button", "Storybook watercolour")); await sleep(900);
  await clickEl(page, await byText(page, ".cv-sent button, .series-sent button", "Apply")); await sleep(1800);
});
await scene("seriesgen", 4, async () => {}, async () => {
  const btn = await byText(page, ".series-bar button", "Make 3 pictures"); await clickEl(page, btn);
  const t0 = Date.now();
  while ((await page.$$(".series-frame img")).length < 3 && Date.now() - t0 < 360000) await sleep(1000);
  await sleep(1500);
});

await go("/library"); await sleep(1200);
await scene("editor", MIN.editor, async () => { await go("/board/cef8b810-00f3-4366-8f52-c8bbecf338d3/cut?b=main"); await sleep(3500); }, async () => {
  await sleep(600);
  await clickEl(page, await byText(page, "button", "Play")); await sleep(2000);
  await clickEl(page, await byText(page, "[role=tab]", "Reshoot")); await sleep(1800);
  await clickEl(page, await byText(page, "[role=tab]", "Sound")); await sleep(500);
  await page.evaluate(() => document.querySelector(".tracks")?.scrollIntoView({ behavior: "smooth", block: "start" })); await sleep(2800);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await sleep(600);
  await clickEl(page, await byText(page, "[role=tab]", "Edit")); await sleep(600);
  const fix = await byText(page, "button", "Fix a frame"); await clickEl(page, fix); await sleep(700);
  await clickEl(page, await byText(page, "button", "Grab the frame")); await sleep(1500);
  await clickEl(page, await byText(page, "button", "Restyle")); await sleep(1500);
});

await scene("academy", MIN.academy, setup("/academy"), async () => { await sleep(1200); await clickEl(page, await byText(page, "button.academy-head", "Say it like a director")); await sleep(2800); });
await scene("gpu", MIN.gpu, setup("/workflows", 1800), async () => {
  const chip = await byText(page, "nav button", "Comfy"); await clickEl(page, chip); await sleep(1300);
  await page.evaluate(() => document.querySelector(".sheet")?.scrollTo({ top: 9999, behavior: "smooth" })); await sleep(2800);
});
await scene("mcp", MIN.mcp, setup("/", 1800), async () => {
  await page.evaluate(() => document.getElementById("mcp")?.scrollIntoView({ behavior: "smooth", block: "center" })); await sleep(3500);
});
await scene("end", MIN.end, setup("/"), async () => { await sleep(2000); });

await browser.close(); writeFileSync("segs-v2.json", JSON.stringify(segs, null, 1)); console.log("recorded", segs.length);
