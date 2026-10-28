"use client";

import { useEffect, useState } from "react";

import { OPEN_COOKIE } from "../comfy/open-only";

/**
 * Two switches in the header. Pro shows the extra controls a model declares
 * (seed, negative prompt, CFG); it is only a view, so it lives in this
 * browser. Open weights only changes what may run, so it is a cookie the
 * server reads and enforces as well.
 */

const PRO = "haggs.pro";
const EVENT = "haggs:prefs";

export type Prefs = { pro: boolean; openOnly: boolean };

function read(): Prefs {
  let pro = false;
  try { pro = localStorage.getItem(PRO) === "1"; } catch { /* storage blocked: Simple */ }
  const openOnly = typeof document !== "undefined" && document.cookie.split("; ").includes(`${OPEN_COOKIE}=1`);
  return { pro, openOnly };
}

export function setPro(on: boolean) {
  try { if (on) localStorage.setItem(PRO, "1"); else localStorage.removeItem(PRO); } catch { /* a view preference only */ }
  window.dispatchEvent(new Event(EVENT));
}

export function setOpenOnly(on: boolean) {
  document.cookie = `${OPEN_COOKIE}=${on ? "1" : "0"}; path=/; max-age=${on ? 60 * 60 * 24 * 365 : 0}; samesite=lax`;
  window.dispatchEvent(new Event(EVENT));
}

/** Both switches, kept current across the page and other tabs. Simple and off until the browser has been read. */
export function usePrefs(): Prefs {
  const [prefs, setPrefs] = useState<Prefs>({ pro: false, openOnly: false });
  useEffect(() => {
    const sync = () => setPrefs(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, []);
  return prefs;
}
