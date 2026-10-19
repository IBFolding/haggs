/**
 * Runs against the live fal catalog. These pages are generated from platform
 * metadata, so this doubles as a drift alarm: if fal changes how it writes a
 * price, this fails here rather than silently quoting a wrong number.
 */
import { fetchPricing, formatRate } from "./pricing";

const ENDPOINTS = [
  "fal-ai/nano-banana-2",
  "fal-ai/flux-2-pro",
  "fal-ai/flux/dev",
  "fal-ai/flux-lora-fast-training",
  "fal-ai/kling-video/v3/pro/image-to-video",
  "fal-ai/veo3.1",
  "fal-ai/bytedance/seedance/v1/pro/text-to-video",
  "fal-ai/z-image/turbo",
];

const results = await Promise.all(ENDPOINTS.map((e) => fetchPricing(e)));

let unparsed = 0;
for (const pricing of results) {
  const ok = pricing.usdPerUnit !== null;
  if (!ok) unparsed += 1;
  console.log(
    `${ok ? "ok  " : "MISS"}  ${pricing.endpoint.padEnd(46)} ${formatRate(pricing).padEnd(18)} ${pricing.text.slice(0, 60)}`,
  );
}

console.log(`\n${results.length - unparsed}/${results.length} priced`);
if (unparsed > 0) process.exitCode = 1;
