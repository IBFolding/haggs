import type { MetadataRoute } from "next";

import { LESSONS } from "../academy/lessons";
import { CONTEST_EFFECTS, contestName } from "../comfy/contest-lab";
import { LTX_WORKFLOWS } from "../comfy/ltx";
import { FEATURED } from "../playable/featured";

export const SITE = "https://haggsfield.studio";

/** Static pages a visitor can open without signing in, or with a public id. */
const PAGES = [
  "/",
  "/photos",
  "/edit",
  "/characters",
  "/locations",
  "/accessories",
  "/comic",
  "/marketing",
  "/ads",
  "/video",
  "/draw",
  "/series",
  "/recreate",
  "/found",
  "/doctor",
  "/kinetic",
  "/sprites",
  "/explore",
  "/editor",
  "/workflows",
  "/academy",
  "/playable",
  "/pricing",
  "/docs",
  "/terms",
  "/privacy",
];

/** The bundled workflows the Workflows page links to (never a remote template, never a user's). */
function workflowNames(): string[] {
  const contest = CONTEST_EFFECTS.flatMap((e) => [contestName(e.slug, "ltx"), contestName(e.slug, "reuse")]);
  return ["import", "build", "haggs_scene_forge", ...LTX_WORKFLOWS.map((w) => w.name), ...contest];
}

/** Public lesson ids and featured game ids, one URL each. */
function dynamicIds(): string[] {
  const lessons = LESSONS.flatMap((l) => [`/academy/${l.id}`, `/academy/learn/${l.id}`]);
  const games = FEATURED.map((g) => `/playable/${g.id}`);
  return [...lessons, ...games, "/playable/neon-courier"];
}

/** Every URL the sitemap should carry: the live pages, then the catalog and lesson/game ids. */
export function sitemapPaths(): string[] {
  return [
    ...PAGES,
    "/workflows/community",
    ...workflowNames().map((n) => `/workflows/${encodeURIComponent(n)}`),
    ...dynamicIds(),
  ];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entry = (path: string, priority: number): MetadataRoute.Sitemap[number] =>
    path === "/"
      ? { url: SITE, lastModified: now, changeFrequency: "weekly", priority }
      : { url: `${SITE}${path}`, lastModified: now, changeFrequency: "monthly", priority };
  return [
    entry("/", 1),
    ...sitemapPaths().filter((p) => p !== "/").map((p) => entry(p, p.startsWith("/workflows/") || p.startsWith("/academy") || p.startsWith("/playable") ? 0.6 : 0.8)),
  ];
}
