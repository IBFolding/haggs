"use client";

import { useRouter } from "next/navigation";

import { setOpenOnly } from "./prefs";

/** The green band: what Open weights only does, and a button that turns it on and opens the apps that run that way. */
export function OpenWeightsBand() {
  const router = useRouter();
  return (
    <div className="lp-openband">
      <div>
        <span>Open weights only</span>
        <h2>One switch. Zero partner calls.</h2>
      </div>
      <div>
        <p>Nothing runs on a partner model. Open-weights apps (Wan, Qwen, Z-Image, LivePortrait) need a configured, reachable ComfyUI for Your GPU, or paid GPU time on Comfy Cloud. Model availability and charges are checked per workflow.</p>
        <button onClick={() => { setOpenOnly(true); router.push("/workflows"); }}>Try it open-weights only →</button>
      </div>
    </div>
  );
}
