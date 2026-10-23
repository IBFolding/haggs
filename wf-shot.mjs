import { launch, sleep, BASE } from "./lib.mjs";
const { browser, page } = await launch(); await page.goto(BASE + "/workflows", { waitUntil: "networkidle2", timeout: 120000 }); await sleep(2500);
await page.screenshot({ path: "wf-shot.png" }); await browser.close();
