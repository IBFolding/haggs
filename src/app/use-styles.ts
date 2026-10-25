"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { allStyles, createStyleStore, type AnyStyle, type CustomStyle } from "../styles/custom";
import { defaultKv } from "../story/kv";

/** The built-in looks plus the ones you made, kept in this browser. */
export function useStyles() {
  const store = useMemo(() => createStyleStore(defaultKv()), []);
  const [custom, setCustom] = useState<CustomStyle[]>([]);
  const refresh = useCallback(() => void store.list().then(setCustom).catch(() => undefined), [store]);
  useEffect(() => { refresh(); }, [refresh]);
  const all = useMemo<AnyStyle[]>(() => allStyles(custom), [custom]);
  return {
    store,
    custom,
    all,
    refresh,
    byId: (id: string | null | undefined): AnyStyle | null => (id ? (all.find((s) => s.id === id) ?? null) : null),
  };
}
