import puppeteer from "puppeteer-core";
export const BASE = "http://localhost:3111";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function launch() {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", protocolTimeout: 1800000, defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1.5 }, args: ["--window-size=1280,720", "--hide-scrollbars", "--force-dark-mode", "--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.5 });
  return { browser, page };
}
// A visible cursor and click ripple, since a headless browser draws neither.
export async function cursorOn(page) {
  await page.evaluateOnNewDocument(() => {
    const hide = document.createElement("style"); hide.textContent = "nextjs-portal{display:none!important}"; (document.head || document.documentElement).appendChild(hide);
    const add = () => {
      if (document.getElementById("__cur")) return;
      const c = document.createElement("div"); c.id = "__cur";
      c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transition:transform .02s;background:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'><path d='M3 2l14 8-6 1.5L8 18z' fill='white' stroke='black' stroke-width='1.4' stroke-linejoin='round'/></svg>\") no-repeat;filter:drop-shadow(0 2px 3px #0008)";
      document.documentElement.appendChild(c);
      window.addEventListener("mousemove", (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
      window.addEventListener("mousedown", (e) => { const r = document.createElement("div"); r.style.cssText = `position:fixed;left:${e.clientX - 18}px;top:${e.clientY - 18}px;width:36px;height:36px;border-radius:50%;border:3px solid #d2f55a;z-index:2147483646;pointer-events:none;animation:__rip .5s ease-out forwards`; document.documentElement.appendChild(r); setTimeout(() => r.remove(), 520); }, true);
      const st = document.createElement("style"); st.textContent = "@keyframes __rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.6);opacity:0}}"; document.head.appendChild(st);
    };
    document.addEventListener("DOMContentLoaded", add); if (document.readyState !== "loading") add();
  });
}
let pos = { x: 960, y: 540 };
export async function moveTo(page, x, y, steps = 28) {
  const from = pos;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(14);
  }
  pos = { x, y };
}
export async function clickEl(page, el, opts = {}) {
  const box = await el.boundingBox(); if (!box) throw new Error("no box");
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await sleep(opts.pause ?? 180);
  await page.mouse.down(); await sleep(60); await page.mouse.up();
}
export async function byText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) { const t = await h.evaluate((n) => n.textContent || ""); if (t.includes(text)) return h; }
  throw new Error(`no ${selector} with "${text}"`);
}
export async function typeSlow(page, text, delay = 38) { await page.keyboard.type(text, { delay }); }
export async function record(page, path) { return page.screencast({ path, speed: 1, scale: 1.5 }); }
