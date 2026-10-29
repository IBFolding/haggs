"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { EMPTY_PROFILE, SOCIALS, cleanProfile, readProfile, type Profile } from "../../account/profile";
import { exploreMessage, profileRow } from "../../community/explore";
import { PLANS, capacity } from "../../server/billing";
import { FileSyncNote } from "../file-sync-note";
import { FilesPanel } from "../files-panel";
import { Nav } from "../nav";
import { authed, supabase, useSession } from "../session";
import { SiteFooter } from "../site-footer";
import { uploadFile } from "../upload-client";

type PlanStatus = { plan: string | null; status: string; renews: number | null; ending?: true };
type Entry = { delta: number; kind: "renewal" | "topup" | "spend" | "refund"; memo: string | null; bucket: string; created_at: string };

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  active: { label: "Active", tone: "ok" },
  trialing: { label: "Trial", tone: "ok" },
  past_due: { label: "Payment due", tone: "bad" },
  unpaid: { label: "Unpaid", tone: "bad" },
  incomplete: { label: "Waiting for payment", tone: "warn" },
  paused: { label: "Paused", tone: "warn" },
};
const KIND: Record<Entry["kind"], string> = { renewal: "Monthly credits", topup: "Top-up", spend: "Made", refund: "Refunded" };
const n = (v: number) => v.toLocaleString("en-US");
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Your account: who you are, your plan and credits, what you spent them on, and your files. */
export default function Account() {
  const router = useRouter();
  const { session, ready } = useSession();
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [bal, setBal] = useState<{ plan: number; topup: number } | null>(null);
  const [topups, setTopups] = useState<{ id: string; usd: number; credits: number }[]>([]);
  const [ledger, setLedger] = useState<Entry[] | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [savedProfile, setSavedProfile] = useState<Profile>(EMPTY_PROFILE);
  const [profileNote, setProfileNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const pictureInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ready && !session) router.replace("/signin?next=/account");
    if (!session) return;
    const kept = readProfile(session.user.user_metadata?.profile);
    setProfile(kept); setSavedProfile(kept);
    void authed("/api/billing/status").then(async (r) => {
      const body = (await r.json()) as { status?: PlanStatus; topups?: typeof topups };
      setPlan(body.status ?? null);
      setTopups(body.topups ?? []);
    }).catch(() => setProblem("Your plan couldn't be read. Reload to try again."));
    // Credits and their history are read as the person themselves; the database only ever shows their own.
    const db = supabase();
    void db?.rpc("credits_balance").then(({ data }) => { const row = Array.isArray(data) ? data[0] : data; if (row) setBal({ plan: Number(row.plan) || 0, topup: Number(row.topup) || 0 }); });
    void db?.from("profiles").select("user_id").eq("user_id", session.user.id).maybeSingle().then(({ data }) => setIsPublic(Boolean(data)));
    void db?.from("credit_ledger").select("delta,kind,memo,bucket,created_at").order("created_at", { ascending: false }).limit(12).then(({ data }) => setLedger((data as Entry[] | null) ?? []));
  }, [ready, session, router]);

  async function go(path: string, body?: object) {
    setProblem(null); setBusy(path);
    const r = await authed(path, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) }).catch(() => null);
    const out = (await r?.json().catch(() => null)) as { ok: boolean; url?: string; reason?: string } | null;
    setBusy(null);
    if (out?.ok && out.url) window.location.href = out.url;
    else setProblem(out?.reason ?? "That couldn't open. Try again in a moment.");
  }

  async function saveProfile() {
    const clean = cleanProfile(profile);
    setBusy("profile"); setProfileNote(null);
    const r = await supabase()?.auth.updateUser({ data: { profile: clean } });
    setBusy(null);
    if (!r || r.error) return setProfileNote(r?.error?.message ?? "Your profile couldn't be saved.");
    // Once your page is up (you've shared something), it shows the profile you just saved.
    if (isPublic && session) {
      const row = profileRow(clean, session.user.id);
      const up = row ? await supabase()?.from("profiles").update(row).eq("user_id", session.user.id) : null;
      const bad = up?.error ? exploreMessage(up.error, "Your public page couldn't be updated.") : null;
      if (bad) { setProfile(clean); setSavedProfile(clean); return setProfileNote(`Saved here, but not on your page: ${bad}`); }
    }
    const dropped = Object.keys(profile.links).filter((k) => profile.links[k as keyof Profile["links"]]?.trim() && !clean.links[k as keyof Profile["links"]]);
    setProfile(clean); setSavedProfile(clean);
    setProfileNote(dropped.length ? `Saved. ${dropped.join(", ")} didn't look like a link to that site, so it was left out.` : "Saved.");
  }

  async function addPicture(file: File) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return setProfileNote("Choose a picture under 8 MB.");
    setBusy("picture");
    const r = await uploadFile(file);
    setBusy(null);
    if (!r.ok || r.kind !== "image") return setProfileNote(r.ok ? "Choose a picture." : r.reason);
    setProfile((p) => ({ ...p, picture: r.url }));
  }

  if (!session) return <div className="app"><Nav current="Account" /></div>;
  const info = PLANS.find((p) => p.id === plan?.plan) ?? null;
  const total = bal ? bal.plan + bal.topup : 0;
  const buys = capacity(total);
  const state = plan && plan.status !== "none" ? STATUS[plan.status] ?? { label: plan.status, tone: "warn" as const } : null;
  const changed = JSON.stringify(cleanProfile(profile)) !== JSON.stringify(cleanProfile(savedProfile));
  const initial = (profile.name || session.user.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="app">
      <Nav current="Account" />
      <div className="canvas">
        <div className="acct">
          <header className="acct-head">
            <h1>Account</h1>
            <p>Signed in as {session.user.email}</p>
          </header>

          <div className="acct-grid">
            <section className="acct-card acct-profile" aria-label="Profile">
              <div className="acct-card-head"><span className="eyebrow muted">Profile</span>{isPublic && savedProfile.handle ? <Link className="ex-mylink" href={`/u/${savedProfile.handle}`}>See your page →</Link> : <small>Private until you share something to Explore; then it&rsquo;s your public page</small>}</div>
              <div className="acct-who">
                <button className="acct-pic" onClick={() => pictureInput.current?.click()} disabled={busy !== null} aria-label="Change your picture">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {profile.picture ? <img src={profile.picture} alt="" /> : <span>{initial}</span>}
                  <i>{busy === "picture" ? "Adding…" : "Change"}</i>
                </button>
                <input ref={pictureInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void addPicture(f); }} />
                <div className="acct-names">
                  <label className="wf-field"><span>Name</span><input value={profile.name} maxLength={60} placeholder="Your name or studio" onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
                  <label className="wf-field"><span>Handle</span><span className="acct-handle"><i>@</i><input value={profile.handle} maxLength={31} placeholder="yourhandle" onChange={(e) => setProfile({ ...profile, handle: e.target.value })} /></span></label>
                </div>
              </div>
              <label className="wf-field"><span>About you <small>{profile.bio.length}/200</small></span><textarea rows={2} value={profile.bio} maxLength={200} placeholder="What you make: shorts, comics, ads for small brands…" onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></label>
              <div className="acct-socials">
                {SOCIALS.map((s) => (
                  <label key={s.id} className="acct-social"><span>{s.label}</span><input value={profile.links[s.id] ?? ""} placeholder="@handle or link" onChange={(e) => setProfile({ ...profile, links: { ...profile.links, [s.id]: e.target.value } })} /></label>
                ))}
                <label className="acct-social"><span>Website</span><input value={profile.links.website ?? ""} placeholder="yoursite.com" onChange={(e) => setProfile({ ...profile, links: { ...profile.links, website: e.target.value } })} /></label>
              </div>
              <div className="acct-actions">
                <button className="fire" disabled={!changed || busy !== null} onClick={() => void saveProfile()}>{busy === "profile" ? "Saving…" : "Save profile"}</button>
                {profileNote && <small role="status">{profileNote}</small>}
              </div>
            </section>

            <div className="acct-side">
              <section className="acct-card" aria-label="Plan">
                <div className="acct-card-head"><span className="eyebrow muted">Plan</span>{state && <em className={`acct-badge ${plan?.ending ? "warn" : state.tone}`}>{plan?.ending ? "Cancelled" : state.label}</em>}</div>
                {plan === null ? <p className="acct-muted">Reading your plan…</p> : info ? (
                  <>
                    <div className="acct-plan"><b>{info.name}</b><span>${info.monthly}<small>/month</small></span></div>
                    <p className="acct-muted">{info.credits ? `${n(info.credits)} credits every month · ${info.storageGB} GB of storage` : "Generation on your own Comfy key or GPU, at Comfy's price"}</p>
                    {plan.renews && <p className="acct-date">{plan.ending ? `Ends ${day(plan.renews)}. It won't renew; you keep it until then.` : `Renews ${day(plan.renews)}`}</p>}
                    {plan.status === "past_due" && <p className="library-error">The last payment didn&rsquo;t go through. Update your card under Payment and invoices to keep your plan.</p>}
                  </>
                ) : <p className="acct-muted">No plan yet. Plans include monthly credits and storage; or bring your own Comfy key.</p>}
                <div className="acct-actions">
                  <Link className="pill" href="/pricing">{info ? "Change plan" : "See plans"}</Link>
                  {info && <button className="pill" disabled={busy !== null} onClick={() => void go("/api/billing/portal")}>{busy === "/api/billing/portal" ? "Opening…" : plan?.ending ? "Renew or change payment" : "Payment, invoices or cancel"}</button>}
                </div>
                {info && <small className="acct-muted">Payment, invoices and cancelling open in Stripe&rsquo;s secure page and bring you back here.</small>}
              </section>

              <section className="acct-card" id="credits" aria-label="Credits">
                <div className="acct-card-head"><span className="eyebrow muted">Credits</span></div>
                {bal ? (
                  <>
                    <div className="acct-plan"><b>{n(total)}</b><span><small>credits left</small></span></div>
                    <p className="acct-muted">About {n(buys.clips)} four-second clips or {n(buys.pictures)} pictures at Comfy&rsquo;s list price.</p>
                    {info?.credits ? (
                      <div className="acct-meter" aria-label={`${n(bal.plan)} of ${n(info.credits)} monthly credits left`}>
                        <i style={{ width: `${Math.min(100, (bal.plan / info.credits) * 100)}%` }} />
                        <small>{n(bal.plan)} of {n(info.credits)} this month{plan?.renews && !plan.ending ? `, refilled ${day(plan.renews)}` : ""}</small>
                      </div>
                    ) : null}
                    <p className="acct-muted">{bal.topup ? `${n(bal.topup)} in top-ups, which never expire. ` : ""}Monthly credits are used first.</p>
                  </>
                ) : <p className="acct-muted">Reading your credits…</p>}
              </section>
            </div>
          </div>

          {topups.length > 0 && (
            <section className="acct-section" aria-label="Top up">
              <h2>Top up <small>one-off, never expire</small></h2>
              <div className="acct-packs">
                {topups.map((t) => {
                  const c = capacity(t.credits);
                  return (
                    <button key={t.id} className="acct-pack" disabled={busy !== null} onClick={() => void go("/api/billing/topup", { pack: t.id })}>
                      <b>{n(t.credits)}</b><small>credits</small>
                      <span>≈ {n(c.clips)} clips or {n(c.pictures)} pictures</span>
                      <em>${t.usd}</em>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="acct-section" aria-label="Recent activity">
            <h2>Recent activity</h2>
            {ledger === null ? <p className="acct-muted">Reading…</p> : ledger.length === 0 ? <p className="acct-muted">Nothing yet. What you make, top up and get each month shows here.</p> : (
              <ul className="acct-ledger">
                {ledger.map((e, i) => (
                  <li key={i}>
                    <span><b>{KIND[e.kind] ?? e.kind}</b>{e.memo && <small>{e.memo}</small>}</span>
                    <time>{day(Date.parse(e.created_at))}</time>
                    <em className={e.delta >= 0 ? "plus" : "minus"}>{e.delta >= 0 ? "+" : "−"}{n(Math.abs(e.delta))}</em>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {problem && <p className="library-error" role="alert">{problem}</p>}

          <section className="acct-section" aria-label="Your files">
            <h2>Your files</h2>
            <p className="acct-muted">Your projects follow you across devices while you are signed in. Deleting one here also removes it from your account.</p>
            <FileSyncNote />
            <FilesPanel />
          </section>

          <div className="acct-actions acct-out">
            <button className="plain" onClick={() => void supabase()?.auth.signOut().then(() => router.push("/"))}>Sign out</button>
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
