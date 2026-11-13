"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Nav } from "../nav";
import { useSession } from "../session";
import { idbKv } from "../../story/kv";
import { renderSchema, type RenderInput } from "../../runpod/client";
import type { Intent } from "../../runpod/journal";
import {
  heldRunpod,
  connectRunpod,
  disconnectRunpod,
  runpodHealth,
  runpodExecutionEnabled,
  submitRunpod,
  statusRunpod,
  cancelRunpod,
  reconcileRunpod,
} from "./actions";
import styles from "../creators.module.css";
const terminal = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
  "REJECTED",
  "SUBMISSION_UNKNOWN",
  "SUBMITTING",
]);
export function RunpodStudio() {
  const { session } = useSession();
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState(""),
    [key, setKey] = useState(""),
    [held, setHeld] = useState<string | null>(null),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [health, setHealth] = useState(""),
    [workflow, setWorkflow] = useState(""),
    [outputNode, setOutputNode] = useState(""),
    [seconds, setSeconds] = useState(600),
    [files, setFiles] = useState<RenderInput["files"]>([]),
    [approved, setApproved] = useState(false),
    [intent, setIntent] = useState<Intent | null>(null),
    [requestId, setRequestId] = useState<string | null>(null),
    [providerId, setProviderId] = useState("");
  const polling = useRef(false),
    activeConnection = useRef<string | null>(null);
  activeConnection.current = connectionId;
  useEffect(() => {
    let active = true;
    setHeld(null);
    setConnectionId(null);
    setIntent(null);
    setRequestId(null);
    setHealth("");
    void (async () => {
      const [connection, flag] = await Promise.all([
        heldRunpod(),
        runpodExecutionEnabled(),
      ]);
      if (active) {
        setHeld(connection?.endpoint ?? null);
        setConnectionId(connection?.connectionId ?? null);
        setEnabled(flag);
      }
    })().catch(() => {
      if (active)
        setError(
          "Could not restore the connection. Do not resubmit an unknown job.",
        );
    });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);
  useEffect(() => {
    let active = true;
    setIntent(null);
    setRequestId(null);
    if (connectionId)
      void idbKv()
        .get<{ id: string; intent?: Intent }>(
          `runpod:last-request:${connectionId}`,
        )
        .then((saved) => {
          if (active && saved) {
            setRequestId(saved.id);
            setIntent(saved.intent ?? null);
          }
        })
        .catch(() =>
          setError(
            "Could not restore the original request. Do not submit another job until reconciled.",
          ),
        );
    return () => {
      active = false;
    };
  }, [connectionId]);
  async function remember(next: Intent) {
    await idbKv().set(`runpod:last-request:${next.connection}`, {
      id: next.id,
      intent: next,
    });
    if (activeConnection.current !== next.connection) return;
    setIntent(next);
    setRequestId(next.id);
  }
  async function refresh() {
    if (!requestId || polling.current) return;
    polling.current = true;
    try {
      const result = await statusRunpod(requestId);
      if (result.ok) await remember(result.intent);
      else setError(result.reason);
    } finally {
      polling.current = false;
    }
  }
  useEffect(() => {
    if (!intent || terminal.has(intent.state)) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      timer = setTimeout(async () => {
        if (live && document.visibilityState === "visible")
          await refresh().catch(() =>
            setError(
              "Status check interrupted; the original job may still be running.",
            ),
          );
        if (live) tick();
      }, 5000);
    };
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [intent?.state, requestId]);
  async function submit() {
    if (!connectionId) return;
    setBusy(true);
    setError("");
    try {
      const parsed = JSON.parse(workflow),
        input = renderSchema.parse({
          schema: "haggs.runpod/1",
          workflow: parsed,
          files,
          outputNode,
          executionSeconds: seconds,
        });
      const id = requestId ?? crypto.randomUUID();
      if (!requestId) {
        await idbKv().set(`runpod:last-request:${connectionId}`, { id });
        setRequestId(id);
      }
      const result = await submitRunpod(id, input, approved);
      if (result.ok) await remember(result.intent);
      else setError(result.reason);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not prepare this request.",
      );
    } finally {
      setBusy(false);
    }
  }
  const inFlight = Boolean(
    requestId &&
      (!intent ||
        !["COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT", "REJECTED"].includes(
          intent.state,
        )),
  );
  return (
    <div className="app">
      <Nav current="Workflows" />
      <main className={`canvas ${styles.root}`}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>
              Your RunPod account · Serverless
            </span>
            <h1>
              Generate on demand.
              <br />
              Scale down afterward.
            </h1>
            <p>
              Haggs submits one workflow to your queue and follows its job ID.
              Configure zero active workers and at most one worker in RunPod.
              Cold starts, execution, idle waiting and persistent storage have
              separate cost implications.
            </p>
            <Link className="plain" href="/guides/runpod-serverless">
              Worker setup and release checks
            </Link>
          </div>
          <div className={styles.panel}>
            <h2>
              {held ? "Endpoint connected" : "Set up your first endpoint"}
            </h2>
            <p className={styles.muted}>
              {held
                ? `Endpoint ${held}. A health check does not prove the worker or model setup.`
                : "An account alone is not a worker. Create and verify the custom endpoint before adding its credentials here."}
            </p>
            <span className={styles.badge}>
              {enabled
                ? "Execution enabled by host"
                : "Execution disabled · setup only"}
            </span>
          </div>
        </section>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        <div className={styles.split}>
          <section className={styles.panel}>
            <h2>Connection</h2>
            <label>
              Endpoint ID
              <input
                aria-label="RunPod endpoint ID"
                maxLength={100}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="Endpoint ID, not a Pod URL"
              />
            </label>
            <label>
              RunPod API key
              <input
                aria-label="RunPod API key"
                type="password"
                autoComplete="new-password"
                maxLength={1024}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter locally; never in chat"
              />
            </label>
            <button
              className="plain"
              disabled={busy || !endpoint || !key}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const result = await connectRunpod(endpoint.trim(), key);
                  if (result.ok) {
                    setHeld(result.endpoint);
                    setConnectionId(result.connectionId);
                    setHealth("");
                    setMessage(
                      "Endpoint health accepted. No worker-starting job was submitted.",
                    );
                  } else setError(result.reason);
                } finally {
                  setKey("");
                  setBusy(false);
                }
              }}
            >
              Check endpoint and connect
            </button>
            {held && (
              <>
                <button
                  className="plain"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const result = await runpodHealth();
                      if (result.ok) {
                        setHealth(JSON.stringify(result.health));
                        setMessage(
                          "Read-only health updated. No diagnostic render was started.",
                        );
                      } else setError(result.reason);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Read worker health
                </button>
                <button
                  className="plain"
                  disabled={busy}
                  onClick={async () => {
                    await disconnectRunpod();
                    setHeld(null);
                    setConnectionId(null);
                    setIntent(null);
                    setRequestId(null);
                    setMessage(
                      "Disconnected from Haggs. Existing jobs and provider resources are unchanged.",
                    );
                  }}
                >
                  Disconnect
                </button>
              </>
            )}
            {health && (
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {health}
              </pre>
            )}
            <p className={styles.muted}>
              Credentials are encrypted in an account-bound, HttpOnly cookie.
              Health checks do not confirm min/max worker settings or prove
              scale-to-zero. Verify those in RunPod.
            </p>
            <a
              href="https://console.runpod.io/serverless"
              target="_blank"
              rel="noreferrer"
            >
              Open RunPod Serverless dashboard →
            </a>
          </section>
          <section className={styles.panel}>
            <h2>Workflow request</h2>
            <p className={styles.muted}>
              This first adapter accepts ComfyUI API-format JSON and the Haggs
              worker contract. It does not send RunPod jobs from the existing
              closed-model generation buttons.
            </p>
            <label>
              Import API workflow
              <input
                aria-label="Import RunPod workflow"
                type="file"
                accept=".json,application/json"
                disabled={inFlight}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > 3 * 1024 * 1024)
                    return setError("Use a workflow under 3 MB.");
                  setWorkflow(await f.text());
                }}
              />
            </label>
            <label>
              API workflow JSON
              <textarea
                aria-label="RunPod workflow JSON"
                rows={8}
                value={workflow}
                disabled={inFlight}
                onChange={(e) =>
                  setWorkflow(e.target.value.slice(0, 3 * 1024 * 1024))
                }
              />
            </label>
            <label>
              Output node ID
              <input
                aria-label="RunPod output node ID"
                value={outputNode}
                disabled={inFlight}
                onChange={(e) => setOutputNode(e.target.value)}
              />
            </label>
            <label>
              Input media files
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,audio/flac"
                disabled={inFlight}
                onChange={async (e) => {
                  const selected = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (
                    selected.length > 8 ||
                    selected.reduce((n, f) => n + f.size, 0) > 10 * 1024 * 1024
                  )
                    return setError(
                      "Use at most eight files, under 10 MB combined.",
                    );
                  try {
                    const loaded = await Promise.all(
                      selected.map(async (f) => ({
                        name: f.name,
                        data: await new Promise<string>((resolve, reject) => {
                          const r = new FileReader();
                          r.onload = () =>
                            resolve(String(r.result).split(",")[1] ?? "");
                          r.onerror = reject;
                          r.readAsDataURL(f);
                        }),
                      })),
                    );
                    setFiles(loaded);
                  } catch {
                    setError("Input media could not be read.");
                  }
                }}
              />
            </label>
            <p className={styles.muted}>
              {files.map((f) => f.name).join(", ") || "No input files"}. File
              names must match the loader inputs in your workflow. Files are
              namespaced per request by the worker.
            </p>
            <label>
              Maximum active execution time (seconds)
              <input
                type="number"
                min={30}
                max={1800}
                value={seconds}
                disabled={inFlight}
                onChange={(e) => setSeconds(Number(e.target.value))}
              />
            </label>
            <p className={styles.muted}>
              This is an execution timeout, not a dollar cap. Startup, idle
              time, storage and provider retries may add cost. Check the current
              rate and account limits before approval.
            </p>
            <label>
              <input
                style={{ display: "inline", width: "auto" }}
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />{" "}
              I approve this compute-billed request on my RunPod account.
            </label>
            <button
              className="fire"
              disabled={busy || !held || !enabled || !approved || inFlight}
              onClick={() => void submit()}
            >
              {busy ? "Submitting…" : "Submit one workflow"}
            </button>
            <p className={styles.muted}>
              Haggs never automatically retries a submission. Request IDs
              persist before sending; reload resumes status checks rather than
              creating another job.
            </p>
            {requestId && (
              <section>
                <h3>Original request</h3>
                <p className={styles.muted}>{requestId}</p>
                <p role="status">
                  <b>
                    {intent?.state ??
                      "LOCAL REQUEST SAVED · server receipt not confirmed"}
                  </b>
                </p>
                {intent?.job && <p>RunPod job: {intent.job.id}</p>}
                <div className={styles.row}>
                  <button className="plain" onClick={() => void refresh()}>
                    Refresh original job
                  </button>
                  {intent?.job && !terminal.has(intent.state) && (
                    <button
                      className="plain"
                      onClick={async () => {
                        const r = await cancelRunpod(requestId);
                        if (r.ok)
                          setMessage(
                            "Cancellation requested. Refresh the original job to confirm its final state.",
                          );
                        else setError(r.reason);
                      }}
                    >
                      Request cancellation
                    </button>
                  )}
                </div>
                {((!intent?.job && intent?.state !== "REJECTED") ||
                  intent?.state === "SUBMISSION_UNKNOWN") && (
                  <>
                    <p className={styles.muted}>
                      Do not submit another job while acceptance is unknown.
                      Find the original job ID in the endpoint request history.
                    </p>
                    <label>
                      Original provider job ID
                      <input
                        value={providerId}
                        onChange={(e) => setProviderId(e.target.value)}
                      />
                    </label>
                    <button
                      className="plain"
                      disabled={!providerId}
                      onClick={async () => {
                        const r = await reconcileRunpod(
                          requestId,
                          providerId.trim(),
                        );
                        if (r.ok) await remember(r.intent);
                        else setError(r.reason);
                      }}
                    >
                      Attach original job ID
                    </button>
                  </>
                )}
                {intent?.state === "COMPLETED" &&
                  intent.job?.output?.artifacts.map((a) => (
                    <article key={a.url}>
                      {a.kind === "video" ? (
                        <video className={styles.video} src={a.url} controls />
                      ) : a.kind === "image" ? (
                        <img
                          className={styles.video}
                          src={a.url}
                          alt={a.name}
                        />
                      ) : (
                        <audio controls src={a.url} />
                      )}
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        download={a.name}
                      >
                        Download {a.name}
                      </a>
                      <p className={styles.muted}>
                        Signed link expires{" "}
                        {new Date(a.expiresAt).toLocaleString()}. Keep a copy;
                        provider request retention is not media storage.
                      </p>
                    </article>
                  ))}
                {intent &&
                  [
                    "COMPLETED",
                    "FAILED",
                    "CANCELLED",
                    "TIMED_OUT",
                    "REJECTED",
                  ].includes(intent.state) && (
                    <button
                      className="plain"
                      onClick={async () => {
                        await idbKv().remove(
                          `runpod:last-request:${connectionId}`,
                        );
                        setRequestId(null);
                        setIntent(null);
                        setApproved(false);
                      }}
                    >
                      Prepare a separate request
                    </button>
                  )}
              </section>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
