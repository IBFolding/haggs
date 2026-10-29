"use client";
import { useEffect, useRef, useState } from "react";
import { makeAgentToken } from "../../agent/token";
import { supabase, useSession } from "../session";
type Token = { id: string; name: string; created_at: string; last_used_at: string | null };
export function ConnectClaude() {
  const { session } = useSession();
  const user = session?.user.id;
  const currentUser = useRef(user); currentUser.current = user;
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("Claude");
  const [revealed, setRevealed] = useState<{ user: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setTokens([]); setRevealed(null); setError(null);
    if (user) void supabase()?.from("agent_tokens").select("id,name,created_at,last_used_at").eq("user_id", user).order("created_at", { ascending: false }).then(({ data, error }) => { if (active) { setTokens(data ?? []); if (error) setError(error.message); } });
    return () => { active = false; };
  }, [user]);
  async function make() {
    if (!user) return;
    setBusy(true); setError(null); setRevealed(null);
    try {
      const made = await makeAgentToken();
      const r = await supabase()?.from("agent_tokens").insert({ name: name.trim() || "Claude", token_hash: made.token_hash }).select("id,name,created_at,last_used_at").single();
      if (!r || r.error) throw new Error(r?.error?.message ?? "Couldn't create the token.");
      if (currentUser.current !== user) return;
      setTokens((all) => [r.data as Token, ...all]); setRevealed({ user, token: made.token });
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't create the token."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(null); setRevealed(null);
    try {
      const r = await supabase()?.from("agent_tokens").delete().eq("user_id", user!).eq("id", id);
      if (!r || r.error) throw new Error(r?.error?.message ?? "Couldn't revoke the token.");
      if (currentUser.current === user) setTokens((all) => all.filter((t) => t.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't revoke the token."); }
    finally { setBusy(false); }
  }
  const token = revealed && revealed.user === user ? revealed.token : null;
  const command = token ? `claude mcp add haggs --env HAGGS_TOKEN=${token} -- npx tsx scripts/mcp.ts` : "";
  const desktop = token ? JSON.stringify({ mcpServers: { haggs: { command: "npx", args: ["tsx", "/absolute/path/to/haggs/scripts/mcp.ts"], env: { HAGGS_TOKEN: token } } } }, null, 2) : "";
  return <section className="acct-card" aria-label="Connect Claude">
    <h2>Connect Claude</h2>
    <p>A token can read your synced projects and send proposals you approve. Nothing is applied until you press Apply.</p>
    {!user ? <p>Sign in first to connect Claude.</p> : <>
      <label className="wf-field"><span>Token name</span><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></label>
      <button disabled={busy || tokens.length >= 10} onClick={() => void make()}>Make a token</button>
      {token && <div><p>Copy this now. It is shown only here, once. Keep it private.</p><textarea aria-label="New agent token" readOnly value={token} /><button onClick={() => void navigator.clipboard.writeText(token).catch(() => setError("Copy failed. Select and copy the token manually."))}>Copy token</button>
        <p>Claude Code: run this from your Haggs repository.</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{command}</pre>
        <p>Claude Desktop: replace the absolute repository path below. The repository needs its public Supabase URL and publishable key in .env.local.</p><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{desktop}</pre>
        <button onClick={() => setRevealed(null)}>Done — hide token</button></div>}
      <ul>{tokens.map((t) => <li key={t.id}>{t.name} — created {new Date(t.created_at).toLocaleDateString()}, last used {t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "never"} <button disabled={busy} onClick={() => void revoke(t.id)}>Revoke</button></li>)}</ul>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
