# haggs

An open-source film studio on Comfy: write it, board it, shoot it, cut it.
Higgsfield's speed, with the whole production in one place and every price
shown in dollars before you press.

Built for Comfy's **#OpenSourceHiggsfield** challenge. MIT licensed.

## What you can do

Every project has four tabs, and each project can hold several boards — a
sizzle, each episode — that share one cast and one set of places.

**Sheets** — the plan. Drop in scripts and haggs breaks them into scenes,
characters, places, story beats and a shot list. Or start from nothing: pick
a format (30-minute comedy, vertical drama, 60-minute drama, romance and
more), say your idea, and Claude drafts the script with the beats where the
hits put them, then fills the blanks you leave. Characters and places carry
identity locks and reference pictures, sent with every shot they're in.

**Board** — the story as a flow chart: a main line and subplot lanes, cards
you drag to re-work the order, threads that show each character's path.
Drop pictures anywhere to start scenes from them. **Animate stills** turns
every still on the board into video in one go, priced as a whole first.

**Cut** — the editor. Every take a shot has had is kept: roll again, star
favourites, flip between takes with ↑ ↓, trim, split at the playhead. Then:

- **Fix a frame** — grab one frame, fix it (FLUX Kontext), re-render the take from the fix
- **Swap across the scene** — change one thing in a take or the whole scene (Kling Omni, Runway Aleph)
- **Recast** — keep the performance, change who's in it (Higgsfield Genjutsu)
- **Voice and lip-sync** — dialogue from the sheets, spoken and synced onto the take (ElevenLabs, Sync)
- **Voice-over** — lines placed on shots that move with them when you reorder
- **Soundtrack** — your music under the whole cut, dipped under the voices
- **Render MP4** — the film, mixed, in one click (or an ffmpeg script to run anywhere)

**Media** — everything the project is made of. Change a shot's prompt and
roll it again from here.

**Create and Video** — the quick studio, with templates (AI influencer,
character sheet, product hero, product placement, product 360, bring a still
to life, dolly zoom…). **Save to project** puts anything you make to work: as
a take on a shot, a new shot, a character's face, a place's look, or in Media.

**Claude, over MCP.** `scripts/mcp.ts` is an MCP server: Claude can read your
projects and send drafts, looks, sheet edits, whole boards and finished takes
to a project's inbox. Nothing changes until you press Apply.

## What runs where

Generation runs on **Comfy** — Comfy Cloud workflows built from Comfy's own
API nodes (MiniMax H3, FLUX 3, FLUX Kontext, Kling Omni, Runway Aleph,
Higgsfield Genjutsu, ElevenLabs, Sync), or Comfy Router where your account
has it (`COMFY_ROUTE=router`). fal is a second route for the models it hosts.
You use your own keys; each run's price is on its button, from the providers'
published rates. Estimates, not invoices.

Projects live in your browser (IndexedDB). Export and import them as files.

## Run it

```bash
npm install
npm run dev          # http://localhost:3111
npm test             # the suite
npm run typecheck
```

Add keys from the key chip in the header, or in `.env.local` for development:

| Variable | For |
| --- | --- |
| `COMFY_API_KEY` | generation on Comfy |
| `FAL_KEY` | fal models (optional) |
| `ANTHROPIC_API_KEY` | Claude drafting scripts and filling sheets (optional) |
| `HAGGS_LOCAL_MEDIA` | a folder for finished renders, uploads and local footage (development) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sign-in (optional) |
| `STRIPE_API_KEY`, `STRIPE_PRICE_*` | subscriptions (optional; checkout stays off without them) |

To use Claude with your projects, the repo's `.mcp.json` registers the haggs
MCP server for Claude Code; for other clients run `npx tsx scripts/mcp.ts`.

### Development only

Keeping finished renders on disk, serving local footage (`/api/local`),
uploads, **Render MP4** and the Claude bridge all run only under `npm run dev`,
on this machine. A hosted deployment needs a file store in their place.

## Layout

```
src/
  app/        pages: landing, projects, the four project tabs, Create/Video/Edit, account
  sheets/     screenplay parsing, the sheets, formats, camera moves, v1 import
  story/      projects, boards, flow, takes, cut, references, proposals from Claude
  providers/  Comfy Cloud workflows and prices, Comfy Router, fal
  server/     local media, the Claude bridge, rendering, billing, auth
  writer/     Claude drafting and filling
scripts/      the MCP server, project import
```

## Licence

MIT. See `LICENSE`.
