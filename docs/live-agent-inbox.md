# Connect Claude to synced projects

On Account, make an agent token and copy the one-time value. It can read your synced projects and submit proposals; it cannot apply changes or read your inbox. Revoke it on Account when no longer needed.

Run the displayed Claude Code command from this repository, or use the Claude Desktop config with an absolute path to scripts/mcp.ts. Set the public Supabase URL and publishable key in .env.local (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), or supply HAGGS_SUPABASE_URL and HAGGS_SUPABASE_KEY. HAGGS_TOKEN selects live mode; without it, the local bridge is unchanged. Never commit the agent token.

Open a project while signed in so it syncs. Project proposals appear under From Claude on Script. Apply uses existing payload validation; Dismiss deletes only the signed-in user's matching inbox row. Inbox polling pauses while the browser tab is hidden.

## Current limits

The approved RPC requires every proposal destination to exist in user_projects. The standalone canvas, series and playable MCP tools use reserved destinations that are not synced user projects. Their hooks now support account inbox reads, but those standalone tools cannot submit live proposals until those destinations have an approved persistence design. They continue to work locally. The live project workflow (draft, breakdown, fill, edits, board, takes, voices) is supported.

## Migration verification, 2026-10-29

Applied 20261029000000_agent_inbox.sql through the signed-in Supabase SQL editor for pxkfxnvexsekhmcoqjxm. The dashboard returned Success. No rows returned.

- agent_tokens count: 0; agent_inbox count: 0.
- agent_projects('not-a-real-token'): SQLSTATE 28000, “That agent token is not valid. Make a new one on the Account page.”
- has_function_privilege('anon', 'public.agent_owner(text)', 'execute'): false.
- Public-key GET /rest/v1/agent_inbox: HTTP 200, []. Public-key POST with a dummy user/project: HTTP 401, SQLSTATE 42501, row-level security violation. No test row was inserted.

No existing tables, Stripe settings, credit grants, storage policies or older migrations were changed. Additional code fixes preserve profile drafts on auth refresh, show legacy subscription allowances, and apply breakdowns to the addressed board.

The existing hosted /api/bridge/inbox endpoint was checked on 2026-10-29 and returned HTTP 404. The reported cross-board issue was therefore in the local inbox workflow before this change enables the account inbox.

Local verification: npm test passed all 968 tests; tsc --noEmit -p . passed. Regression tests cover target-board isolation, preservation of unsaved profile fields on same-user auth updates, and legacy Creator allowance (3,120 at a 20% cut) versus fixed Creator allowance (2,400). No financial transaction or paid generation was performed.
