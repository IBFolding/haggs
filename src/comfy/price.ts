import jsonata from "jsonata";

import type { ApiPrompt, Catalog } from "./convert";
import { rateText } from "../story/price-text";

/**
 * What a workflow costs, worked out the way Comfy shows it on each paid node:
 * every partner node carries a price expression (JSONata) over its widget
 * values and which inputs are wired. Comfy's editor lower-cases choices
 * before evaluating, so this does too.
 */

type Badge = { engine?: string; depends_on?: { widgets?: { name: string; type: string }[]; inputs?: string[]; input_groups?: string[] }; expr: string };
type Result =
  | { type: "usd"; usd: number; format?: { suffix?: string; approximate?: boolean } }
  | { type: "range_usd"; min_usd: number; max_usd: number; format?: { suffix?: string; approximate?: boolean } }
  | { type: "list_usd"; usd: number[]; format?: { suffix?: string } }
  | { type: "text"; text: string };

export type NodePrice = { node: string; name: string; min: number; max: number; perSecond: boolean; label: string; approximate?: boolean };
export type Price = { nodes: NodePrice[]; min: number; max: number; perSecond: boolean; label: string };

const money = (n: number) => rateText(n);
export async function priceOf(prompt: ApiPrompt, catalog: Catalog): Promise<Price> {
  const nodes: NodePrice[] = [];
  for (const [id, node] of Object.entries(prompt)) {
    const def = catalog[node.class_type];
    const badge = def?.price_badge as Badge | undefined;
    if (!badge?.expr || (badge.engine && badge.engine !== "jsonata")) continue;
    const widgets: Record<string, unknown> = {};
    const inputs: Record<string, { connected: boolean }> = {};
    const inputGroups: Record<string, number> = {};
    for (const [key, value] of Object.entries(node.inputs)) {
      const wired = Array.isArray(value);
      inputs[key] = { connected: wired };
      if (!wired) widgets[key] = typeof value === "string" ? value.toLowerCase() : value;
    }
    for (const name of badge.depends_on?.inputs ?? []) inputs[name] ??= { connected: false };
    for (const group of badge.depends_on?.input_groups ?? []) inputGroups[group] = Object.entries(node.inputs).filter(([k, v]) => k.startsWith(`${group}.`) && Array.isArray(v)).length;
    let result: Result | undefined;
    try {
      result = (await jsonata(badge.expr).evaluate({ widgets, inputs, inputGroups })) as Result | undefined;
    } catch {
      continue;
    }
    if (!result) continue;
    const name = def?.display_name ?? node.class_type;
    const approximate = "format" in result && Boolean((result.format as {approximate?:boolean} | undefined)?.approximate);
    const perSecond = "format" in result && /second/i.test(result.format?.suffix ?? "");
    if (result.type === "usd") nodes.push({ node: id, name, approximate, min: result.usd, max: result.usd, perSecond, label: `${money(result.usd)}${perSecond ? "/s" : ""}` });
    else if (result.type === "range_usd") nodes.push({ node: id, name, approximate, min: result.min_usd, max: result.max_usd, perSecond, label: `${money(result.min_usd)}–${money(result.max_usd)}${perSecond ? "/s" : ""}` });
    else if (result.type === "list_usd" && result.usd.length) nodes.push({ node: id, name, approximate, min: Math.min(...result.usd), max: Math.max(...result.usd), perSecond, label: result.usd.map(money).join(" / ") });
    else if (result.type === "text") nodes.push({ node: id, name, approximate, min: 0, max: 0, perSecond: false, label: result.text });
  }
  const min = nodes.reduce((n, p) => n + p.min, 0);
  const max = nodes.reduce((n, p) => n + p.max, 0);
  const perSecond = nodes.some((p) => p.perSecond);
  const label = !nodes.length ? "open weights: no partner fee, only GPU time" : min === max ? `${money(min)}${perSecond ? " per second" : ""}` : `${money(min)}–${money(max)}${perSecond ? " per second" : ""}`;
  return { nodes, min, max, perSecond, label };
}
