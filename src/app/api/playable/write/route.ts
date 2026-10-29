import { cookies } from "next/headers";

import { CODE_TOKENS, ERROR_MARK, MODELS, codeEditRequest, codeFixRequest, codeIdeaRequest, type Quality } from "../../../../playable/code";
import { readSpec, type CodeSpec } from "../../../../playable/spec";
import { CLAUDE_COOKIE, claudeWorkspaceIn, keyIn } from "../../../../server/keys";
import { anthropicErrorReason, anthropicHeaders } from "../../../../writer/anthropic-config";
import type { DraftRequest } from "../../../../writer/draft";

/**
 * Claude writes a Playable code game on the person's own key, streamed as it
 * is written so the page can show progress and no request waits in silence.
 * The answer is plain text: Claude's reply as it arrives. A failure after the
 * stream has started ends it with a line starting ERROR_MARK.
 */

export const maxDuration = 300;

type Body = { mode?: unknown; quality?: unknown; idea?: unknown; genre?: unknown; three?: unknown; references?: unknown; game?: unknown; message?: unknown; error?: unknown };

const refuse = (reason: string, status: number, needsKey = false) => Response.json({ ok: false, reason, ...(needsKey ? { needsKey } : {}) }, { status });

function build(body: Body): DraftRequest {
  if (body.mode === "idea") {
    const references = Array.isArray(body.references) ? body.references.filter((r): r is { id: string; label: string } => typeof r?.id === "string" && typeof r?.label === "string").slice(0, 8) : [];
    return codeIdeaRequest({ idea: String(body.idea ?? ""), genre: typeof body.genre === "string" ? body.genre.slice(0, 40) : undefined, three: body.three === true, references });
  }
  const game = readSpec(body.game);
  if (game.template !== "code" || !game.code.trim()) throw new Error("That game couldn't be read.");
  if (body.mode === "fix") return codeFixRequest(game as CodeSpec, String(body.error ?? "The game stopped."));
  return codeEditRequest(game as CodeSpec, String(body.message ?? ""));
}

export async function POST(request: Request) {
  const jar = await cookies();
  const key = keyIn(jar, CLAUDE_COOKIE);
  if (!key) return refuse("Add a Claude key in Keys to make games from words. Featured games and Quick start work without one.", 401, true);
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return refuse("That request couldn't be read.", 400);
  let built: DraftRequest;
  try {
    built = build(body);
  } catch (caught) {
    return refuse(caught instanceof Error ? caught.message : "That can't be sent.", 400);
  }
  let headers: Record<string, string>;
  try {
    headers = anthropicHeaders(claudeWorkspaceIn(jar));
  } catch {
    return refuse("Enter an Anthropic workspace ID beginning wrkspc_, or leave it blank for a workspace-scoped key.", 400);
  }
  const quality: Quality = body.quality === "fast" ? "fast" : "quality";
  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      redirect: "error",
      headers: { ...headers, "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(295_000),
      body: JSON.stringify({ model: MODELS[quality], max_tokens: CODE_TOKENS, stream: true, system: built.system, messages: [{ role: "user", content: built.user }] }),
    });
  } catch {
    return refuse("Claude could not be reached. Nothing was charged that we know of; try again.", 502);
  }
  if (upstream.status === 401) return refuse("Claude rejected the key. Replace it in Keys.", 401, true);
  if (upstream.status === 429) return refuse("Your Claude account is rate-limited or out of credit. Nothing was retried.", 429);
  if (!upstream.ok || !upstream.body) return refuse(anthropicErrorReason(upstream.status, await upstream.text().catch(() => "")), 502);

  // Anthropic's event stream in, the reply's text out.
  const source = upstream.body.pipeThrough(new TextDecoderStream()).getReader();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let pending = "";
      let stopped: string | undefined;
      try {
        for (;;) {
          const { value, done } = await source.read();
          if (done) break;
          pending += value;
          let at: number;
          while ((at = pending.indexOf("\n\n")) >= 0) {
            const event = pending.slice(0, at);
            pending = pending.slice(at + 2);
            const data = event.split("\n").find((l) => l.startsWith("data: "))?.slice(6);
            if (!data) continue;
            const e = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string; stop_reason?: string }; error?: { message?: string } };
            if (e.type === "content_block_delta" && e.delta?.type === "text_delta" && e.delta.text) controller.enqueue(encoder.encode(e.delta.text));
            if (e.type === "message_delta" && e.delta?.stop_reason) stopped = e.delta.stop_reason;
            if (e.type === "error") throw new Error("Claude stopped part way. Nothing was retried; try again.");
          }
        }
        if (stopped === "max_tokens") controller.enqueue(encoder.encode(`${ERROR_MARK}Claude ran out of room before the game was finished. Try a smaller idea, or Fast.`));
      } catch (caught) {
        controller.enqueue(encoder.encode(`${ERROR_MARK}${caught instanceof Error && /Claude/.test(caught.message) ? caught.message : "The game stopped part way while being written. Try again."}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      void source.cancel();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
