import { templateById } from "./adTemplates";
import type { StoryPopEvent } from "./storypop";

/**
 * Makes StoryPop's ad versions. A job holds the advertiser's style, brand and offer; the runner turns it into a prompt,
 * asks the image service for a picture, and settles the job so StoryPop can show it. Everything it touches is passed in,
 * so it can be tested without spending anything.
 */
export type AdJob = {
  id: string;
  ownerId: string;
  reference: string;
  input: { templateId?: string; brandKit?: { name?: string; description?: string; colors?: string[] } | null; offer?: string; cta?: string; version?: number };
};

export type AdRunnerDeps = {
  claim: (max: number) => Promise<AdJob[]>;
  /** Credits one ad picture costs. */
  priceCents: number;
  /** Takes the credits for a job from the StoryPop ad account. False when the account can't cover it. */
  spend: (jobId: string, cents: number) => Promise<boolean>;
  /** Gives back what a job spent. Safe to call twice. */
  refund: (jobId: string) => Promise<void>;
  generate: (prompt: string) => Promise<string | null>;
  settle: (jobId: string, status: "completed" | "failed", url?: string) => Promise<boolean>;
  notify: (event: StoryPopEvent) => Promise<boolean>;
};

const LOOKS = ["clean studio lighting, soft shadows, minimal backdrop", "bold graphic colour blocking, high contrast, punchy", "warm natural light, real-life setting, inviting"];
const STYLE: Record<string, string> = {
  "product-hero": "A single product hero shot, centred, lit like it matters, shallow depth of field.",
  "product-placement": "The product naturally placed in a lived-in scene, the product clearly visible but not staged.",
  "sponsor-card": "A clean title-card style background with space for a brand name, simple and elegant."
};

const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Builds the picture prompt. The advertiser's words are data inside a fixed frame, and the picture never contains text: StoryPop adds the headline and button itself. */
export function buildAdPrompt(input: AdJob["input"]): string | null {
  const template = templateById(input.templateId);
  if (!template) return null;
  const brand = input.brandKit ?? {};
  const colors = (brand.colors ?? []).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 3);
  const look = LOOKS[((Number(input.version) || 1) - 1) % LOOKS.length];
  return [
    `Vertical 9:16 advertising image. ${STYLE[template.id] ?? template.description}`,
    `Look: ${look}.`,
    brand.name ? `Brand: ${clean(brand.name, 60)}.` : "",
    brand.description ? `About the brand: ${clean(brand.description, 200)}.` : "",
    input.offer ? `Promoting: ${clean(input.offer, 120)}.` : "",
    colors.length ? `Use these brand colours: ${colors.join(", ")}.` : "",
    "No text, no letters, no logos, no watermarks anywhere in the image. Safe for all audiences."
  ].filter(Boolean).join(" ");
}

/** Claims queued jobs, pays for and makes each one, and settles it. A job that can't be made gets its credits back and is settled as failed, so StoryPop doesn't count the build. */
export async function runAdJobs(deps: AdRunnerDeps, max = 3): Promise<{ done: number; failed: number }> {
  const jobs = await deps.claim(max);
  let done = 0;
  let failed = 0;
  const fail = async (job: AdJob, reason: string) => {
    const settled = await deps.settle(job.id, "failed");
    if (settled) await deps.notify({ type: "job.failed", haggsUserId: job.ownerId, haggsJobId: job.id, reason, title: "Ad version" });
    failed += 1;
  };
  for (const job of jobs) {
    const prompt = buildAdPrompt(job.input);
    if (!prompt) {
      await fail(job, "That ad style isn't available yet");
      continue;
    }
    let funded = false;
    try {
      funded = await deps.spend(job.id, deps.priceCents);
    } catch {
      funded = false;
    }
    if (!funded) {
      await fail(job, "The ad builder is out of credits right now");
      continue;
    }
    let url: string | null = null;
    try {
      url = await deps.generate(prompt);
    } catch {
      url = null;
    }
    if (url) {
      const settled = await deps.settle(job.id, "completed", url);
      if (settled) await deps.notify({ type: "job.completed", haggsUserId: job.ownerId, haggsJobId: job.id, resultUrl: url, title: "Ad version" });
      done += 1;
    } else {
      await deps.refund(job.id).catch(() => undefined);
      await fail(job, "The image service didn't return a picture");
    }
  }
  return { done, failed };
}
