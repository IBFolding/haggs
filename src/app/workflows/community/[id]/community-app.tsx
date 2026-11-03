"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { COMFYUI_INSTALL_URL, type CommunityEntry, type StudioSample, type ThirdPartyWorkflow } from "../../../../community/curated";
import { Nav } from "../../../nav";
import { SiteFooter } from "../../../site-footer";

const HANDOFF_KEY = "haggs.handoff";
const TALL = { aspectRatio: "auto", maxHeight: 560, objectFit: "contain" } as const;

/** One Community entry as an app page: a studio sample you can make one like, or a creator's workflow with how to run it. */
export function CommunityApp({ entry }: { entry: CommunityEntry }) {
  return (
    <div className="app">
      <Nav current="Workflows" />
      <div className="canvas"><div className="wf community-app">
        <p><Link className="plain" href="/workflows/community">← Community</Link></p>
        {entry.kind === "sample" ? <Sample s={entry.sample} /> : <ThirdParty w={entry.workflow} />}
      </div><SiteFooter /></div>
    </div>
  );
}

function Sample({ s }: { s: StudioSample }) {
  const router = useRouter();
  function makeLike() {
    // Same handoff Explore uses; the tool picks the words up when it opens. A private window just opens the tool empty.
    if (s.prompt) { try { sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ url: "", to: s.tool.href === "/video" ? "Video" : "Create", prompt: s.prompt })); } catch { /* nothing to hand over */ } }
    router.push(s.tool.href);
  }
  return (
    <>
      <span className="eyebrow">Made with haggs</span>
      <h1>{s.title}</h1>
      <div className="community-app-media">
        {s.kind === "video" ? <video src={s.src} poster={s.poster} style={s.tall ? TALL : undefined} muted loop playsInline controls preload="metadata" /> : <img src={s.src} alt={s.title} style={s.tall ? TALL : undefined} />}
      </div>
      <p>{s.note}</p>
      <small>Made with: {s.madeWith}</small>
      {s.prompt && <div className="ex-prompt"><span className="eyebrow muted">Prompt</span><p>{s.prompt}</p></div>}
      <div className="community-app-actions">
        <button className="fire" onClick={makeLike}>{s.prompt ? "Make one like this" : `Open ${s.tool.label}`} <span className="cost">priced next</span></button>
        {s.prompt && <button className="pill" onClick={() => void navigator.clipboard?.writeText(s.prompt!)}>Copy the prompt</button>}
      </div>
      <p className="wf-small">Opens {s.tool.label} here in haggs. You see the price before anything runs.</p>
    </>
  );
}

function ThirdParty({ w }: { w: ThirdPartyWorkflow }) {
  return (
    <>
      <span className="eyebrow">Workflow from another creator</span>
      <h1>{w.name}</h1>
      <p>{w.summary}</p>
      <p className="wf-note"><b>Runs:</b> {w.run.where}</p>
      <dl className="ex-facts community-app-facts">
        <div><dt>Creator</dt><dd><a href={w.creator.url} target="_blank" rel="noopener noreferrer">@{w.creator.name}</a></dd></div>
        <div><dt>Licence</dt><dd>{w.license}</dd></div>
        <div><dt>Source</dt><dd><a href={w.source} target="_blank" rel="noopener noreferrer">{w.source.replace("https://", "")}</a></dd></div>
      </dl>
      <h2>Needs</h2>
      <ul>{w.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
      <h2>Run it on your own computer</h2>
      <ol>{w.run.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <p>{w.notes}</p>
      <div className="community-app-actions">
        <a className="fire" href={w.source} target="_blank" rel="noopener noreferrer">Open the creator&rsquo;s page ↗</a>
        <a className="pill" href={COMFYUI_INSTALL_URL} target="_blank" rel="noopener noreferrer">Install ComfyUI ↗</a>
      </div>
      <p className="wf-small">haggs links to this work. It does not bundle, host, run or redistribute the creator&rsquo;s code, weights or nodes.</p>
    </>
  );
}
