"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { greyGenerationAvailability } from "./grey-shot-actions";
import type { MatteWhere } from "./grey-matte-run";

const KEY = "haggs.grey.where";
const listeners = new Set<() => void>();
const read = (): MatteWhere => { try { return localStorage.getItem(KEY) === "cloud" ? "cloud" : "gpu"; } catch { return "gpu"; } };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** Where the cut-out and area finder run: Your GPU (default) or Comfy Cloud, remembered per browser. Cloud is offered only when the owner switched it on. */
export function useMatteWhere() {
  const stored = useSyncExternalStore(subscribe, read, () => "gpu" as MatteWhere);
  const [cloudOk, setCloudOk] = useState(false);
  useEffect(() => { void greyGenerationAvailability().then((a) => setCloudOk(Boolean(a.matte))).catch(() => setCloudOk(false)); }, []);
  const where: MatteWhere = cloudOk ? stored : "gpu";
  const setWhere = (next: MatteWhere) => { try { localStorage.setItem(KEY, next); } catch { /* Session-only. */ } listeners.forEach((fn) => fn()); };
  return { where, setWhere, cloudOk };
}
