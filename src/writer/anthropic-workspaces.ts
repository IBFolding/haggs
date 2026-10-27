/** Read-only discovery, called only by the explicit settings action. Never retries inference or saves a choice. */
export type ClaudeWorkspace = { id: string; name: string };
export type WorkspaceDiscovery = { ok: true; workspaces: ClaudeWorkspace[] } | { ok: false; reason: string };
export async function discoverWorkspaces(key: string, fetchImpl: typeof fetch = fetch): Promise<WorkspaceDiscovery> {
  const workspaces = new Map<string, ClaudeWorkspace>();
  const cursors = new Set<string>();
  let after: string | undefined;
  try {
    for (let page = 0; page < 10; page++) {
      const url = new URL('https://api.anthropic.com/v1/organizations/workspaces');
      url.searchParams.set('include_default', 'true');
      url.searchParams.set('include_archived', 'false');
      url.searchParams.set('limit', '100');
      if (after) url.searchParams.set('after_id', after);
      const response = await fetchImpl(url, { method: 'GET', redirect: 'error', headers: { 'x-api-key': key, 'anthropic-version': '2026-10-21' }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
      if (response.status === 401 || response.status === 403) return { ok: false, reason: 'This key cannot list workspaces with its current permissions. A workspace-scoped key needs no workspace setting. For an unscoped key, choose the ID in Claude Console. No new access is required by Haggs.' };
      if (!response.ok) return { ok: false, reason: `Workspace discovery was unavailable (status ${response.status}). Your key and settings are unchanged.` };
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object') throw new Error('Invalid response');
      const body = data as { data?: unknown; has_more?: unknown; last_id?: unknown };
      if (!Array.isArray(body.data) || typeof body.has_more !== 'boolean') throw new Error('Invalid page');
      for (const item of body.data) {
        if (!item || typeof item !== 'object') throw new Error('Invalid workspace');
        const w = item as Record<string, unknown>;
        if (w.archived_at) continue;
        if (typeof w.id !== 'string' || !/^wrkspc_[A-Za-z0-9_-]{1,128}$/.test(w.id) || typeof w.name !== 'string') throw new Error('Invalid workspace');
        workspaces.set(w.id, { id: w.id, name: w.name.slice(0, 160) });
      }
      if (!body.has_more) return { ok: true, workspaces: [...workspaces.values()] };
      if (typeof body.last_id !== 'string' || !/^wrkspc_[A-Za-z0-9_-]{1,128}$/.test(body.last_id) || cursors.has(body.last_id)) throw new Error('Invalid cursor');
      after = body.last_id; cursors.add(after);
    }
    return { ok: false, reason: 'The workspace list was too large to finish safely. Choose a workspace in Claude Console; no setting was changed.' };
  } catch {
    return { ok: false, reason: 'Workspace discovery could not finish. Retry or use Claude Console. Your key and settings are unchanged.' };
  }
}
