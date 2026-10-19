# Storyboard Workspace — Design

*haggs. Written 2026-10-18.*

## Intent

haggs today generates one shot at a time. You type a prompt, pick a model, press a
button with a dollar figure on it, and a tile appears. Refresh the page and it is
gone.

But nobody makes *one shot*. They make a sequence — and the hard part of a
sequence is not generating each frame, it is keeping the frames in a relationship
with each other. Shot 12 only works if it starts where shot 11 ended. Move shot 7
and you have silently broken four prompts downstream, and nothing tells you.

This design adds a workspace where the sequence is the object you work on: a
canvas you can move around, the shots laid out in story order, the subplots
visible as threads running through them, reordering that actually re-derives the
story rather than just renumbering it — and a way to package what you built so
somebody else can take it, swap the parts that are yours for the parts that are
theirs, and run it.

### Why now

Two pieces of this already exist in the repo, unwired, and they are the two
hardest pieces:

- `src/workflows/product-photoshoot/enhance.ts` is a pure brief-to-prompt
  expander. Same input, same prompt out, fully inspectable. It is the exact
  mechanism the workspace needs for assembling a shot's prompt from its
  neighbours — pointed at panels instead of products.
- `src/projects/light-again.ts` is a 54-panel shot list with act and location per
  panel, plus a real continuity finding (page 2 retells the whole arc). It is the
  data shape this workspace is for, written out by hand because there was nowhere
  to put it.

The seam is also already right. `providers/types.ts` defines a provider as
something that can `quote` and `run`. Nothing in this design touches it.

### What success looks like

You load a script, see the whole season on one canvas, drag a scene two slots
earlier, and the four shots whose prompts just changed light up as stale — with
the cost of re-running them showing before you commit. Then you export the whole
shape as a file, somebody else imports it, fills in their own subject and style,
and runs it against their own key.

---

## Goals

1. **One canvas, whole story.** Pan and zoom over every shot in order, at any
   zoom from "read the prompt" to "see the season".
2. **Subplots visible.** Threads run through the shots they touch, and where two
   threads meet is marked.
3. **Reorder re-derives.** Moving a shot recomputes order, running time,
   continuity, and every affected prompt — and says which renders are now stale.
4. **Script import.** Load a screenplay and get a populated board, not a blank one.
5. **Shareable templates.** Export the shape with the content hollowed into named
   slots. Someone else fills the slots and has a working project.
6. **It survives a refresh.** There is no persistence at all today.

## Non-goals

- Not a video editor. No trimming, no scrubbing footage, no audio sync, no export
  to a cut.
- Not realtime multiplayer. Sharing is a file, not a session.
- Not a hosted template gallery. That needs identity, hosting and moderation;
  the file format is the thing that has to be right first, and a gallery can be
  built on a good format later.
- Not a node graph. See below.
- No account system. Keys stay in the httpOnly cookie exactly as they are now.

## Anti-goals

These would mean failure even if every feature above shipped:

- **A canvas that needs tidying.** If a user can make a mess, they will, and then
  the tool costs them housekeeping forever.
- **Hidden prompts.** The project's stated reason to exist is that Higgsfield
  assembles prompts server-side and never shows you. A template whose prompt you
  cannot read would be the same product with our name on it.
- **Anything that spends money without being asked.** No auto-regeneration, ever.
- **A template DSL.** The moment templates need expressions, conditionals or
  inheritance, they stop being readable, and readable is the whole point.

---

## The central decision: lanes, not a graph

The request mentioned ComfyUI-style workflow cloning. ComfyUI has one genuinely
great property and one genuinely bad one, and they are separable.

The great property: a workflow is **one portable file** that reproduces somebody
else's setup on your machine, and you can swap pieces of it. We want that, and
this design takes it wholesale.

The bad property: the file is a **directed graph the user wires by hand**. Graphs
are maximally expressive, which is exactly why they are hard — the user is
responsible for layout, and spaghetti is the default state of any node editor
with more than twenty nodes. "Flawless and easy" and "hand-wired DAG" do not
coexist.

A story does not need a graph. A story is a **sequence** with **threads running
through it**. That is a much smaller structure, and it buys the key property:

> **Position on the canvas is meaning, not decoration.**

Horizontal position is story order. Vertical position is which thread a shot
belongs to. Both are derived from the data and laid out automatically. You cannot
drag a card into a bad arrangement, because dragging a card *is* editing the
story — drag it left and it moves earlier; drag it up and it changes thread.

This is what makes the canvas impossible to mess up, and it is the single most
important decision here. The layout is never something you maintain.

**Where the urge to arrange things freely goes:** notes. A note is a free-floating
object you can put anywhere and never participates in the story. You get the
corkboard feeling without any risk of the arrangement corrupting the sequence.

**Considered and rejected:** a free-position mode for shot cards, with the order
held separately in the data. It is safe (the story lives in the data, not the
pixels), but it creates two sources of truth for "where is shot 7", and the user
has to keep them reconciled in their head. Rejected for the thing it costs:
tidying.

**If ComfyUI execution is genuinely wanted later**, it belongs behind the
existing `Provider` interface as another implementation — `comfy.ts` next to
`fal.ts` — not as this app's architecture. The seam already supports it.

---

## The canvas

```
            ┌─ thread lane: ELLIS ────────────────────────────────────
            │        ●━━━━━━━━━━━━━━━●              ●━━━━━━━━━
            │        │               │              │
  spine ━━━[01]━━━━[02]━━━━[03]━━━━[04]━━━━[05]━━━━[06]━━━━[07]━━━▶
            │                        │              │
            └─ thread lane: ROWAN ───●━━━━━━━━━━━━━━●━━━━━━━━━
                                     ▲
                                 tie point
```

- **The spine** is the horizontal ribbon through the middle: every shot, in order,
  always. It is the one thing that is never ambiguous.
- **Thread lanes** sit above and below. A ribbon runs along a lane and drops down
  to touch each shot that thread appears in.
- **A tie point** is a shot that two or more threads both touch. The card shows a
  junction mark and the ribbons visibly converge there. This is the answer to
  "show all subplots and how they tie together" — convergence is rendered, not
  described.
- **Gaps** are rendered too: a thread that has not been touched for more than N
  shots fades, which makes a dangling subplot visible at a glance rather than
  something you discover in a read-through.

### Zoom is semantic, not just scale

Three bands, because a card that merely shrinks becomes unreadable mush:

| Zoom | A shot card shows |
|---|---|
| Far | Thumbnail only, thread colour as a border. Seasons fit on screen. |
| Mid | Thumbnail, heading, duration, stale/queued state. The working zoom. |
| Near | The above plus the beat, the assembled prompt, model and cost. |

### Shot card states

Every state is visible on the card itself, because the alternative is a user who
does not know what they are looking at:

- **empty** — a beat with no render yet
- **queued / running** — generation in flight
- **rendered** — has media, prompt matches
- **stale** — has media, but the prompt has changed since it was made
- **failed** — carries the reason and a retry
- **locked** — excluded from reorder and recompute (see below)

---

## Reorder, and what "the story adjusts" means

This is the heart of it, and it is more than renumbering.

When the order changes, four things re-derive:

1. **Indices.** Shot numbers.
2. **Running time.** Sum of durations; per-act and per-thread subtotals.
3. **Continuity.** Each shot's "starts from" clause is re-derived from its new
   predecessor, and its handoff from its new successor.
4. **Prompts.** Each affected shot's prompt is re-assembled.

Point 3 is the one that matters and the one nothing else does. A shot's prompt
does not stand alone — it inherits from its neighbour. `light-again.ts`'s source
package states the rule explicitly: every shot must carry at least three
continuity anchors from the shot before it (one character, one environment, one
lighting/motion), and end on a handoff the next shot can pick up. Reorder the
shots and every one of those relationships silently points at the wrong frame.

So: **the prompt is a derived value, never a stored one.**

```
assemble(shot, previousShot, project.direction) -> string
```

A pure function, exactly the shape `enhance.ts` already is. Same inputs, same
prompt, diffable, readable on the card.

### Staleness falls out of this for free

```
stale  ⟺  shot.render exists  ∧  shot.render.promptHash ≠ hash(assembled prompt)
```

No flag to keep in sync, no invalidation logic to get wrong. The card is stale if
and only if the picture you are looking at was made from a different prompt than
the one currently assembled. Store the hash on the render at generation time and
the question answers itself forever.

### Nothing re-runs itself

A reorder can mark thirty shots stale. It never regenerates one of them. The
stale set is a selection you can act on, with the total cost shown before you
commit — the same promise the Generate button already makes, applied to a batch.
Auto-regeneration would be a tool that spends your money while you think.

**Locked shots** are excluded from recompute. When a shot is final and you do not
want a reorder elsewhere to touch it, lock it; its prompt freezes and it never
goes stale. This is the escape hatch that keeps the recompute rule from being
tyrannical.

---

## Threads

```ts
type Thread = {
  id: string;
  name: string;              // "Ellis", "the waylight", "the time loop"
  color: string;
  kind: "character" | "plot" | "motif";
};
```

A shot carries `threadIds: string[]`. That is the whole model — threads are tags
with a rendering, not a separate structure to maintain.

The thread panel lists each thread with: shots touched, first and last
appearance, longest gap, and whether it resolves (touches a shot in the final
act). A thread that is introduced and never returned to is the most common
structural fault in a draft, and it should be one glance away.

---

## Loading a script

Import accepts three shapes, because the two real corpora on this machine are
different from each other:

1. **Screenplay** (Fountain, or markdown with scene headings). Parse `INT./EXT.`
   headings into scenes; paragraphs within a scene become candidate shots. The
   eight Waylight teleplays are the test corpus.
2. **Panel list** — page/panel/slug/act/location, the `light-again.ts` shape.
3. **Plain outline** — one beat per line, indentation for grouping. The escape
   hatch that always works.

### Thread detection is a suggestion, never magic

Character names in scene headings and dialogue cues give a candidate thread list
with the shots each appears in. It is presented as a proposal with checkboxes.
Auto-applying this would be wrong roughly as often as it was right, and a wrong
structural guess costs more to undo than to do by hand.

Import is **non-destructive**: it produces a new project. It never merges into
an existing board, because a bad merge is unrecoverable and a duplicate project
costs nothing.

---

## Templates

A template is a project with the content hollowed out into named slots.

```ts
type Template = {
  format: "haggs.template/1";
  name: string;
  author?: string;
  description: string;
  source?: { templateId: string; name: string; author?: string };  // remix chain
  slots: SlotDef[];
  direction: Direction;      // craft constants: camera, light, staging
  threads: Thread[];
  shots: TemplateShot[];     // beats, order, thread assignments, model + settings
};

type SlotDef = {
  key: string;               // referenced in text as {{key}}
  label: string;             // "What are we shooting?"
  kind: "text" | "image" | "model" | "direction";
  example: string;           // shown as placeholder — makes the template legible
                             // before you fill it
};
```

Substitution is `{{key}}` and nothing else. No expressions, no conditionals, no
inheritance. If a template needs logic, it is two templates.

### Using one

Import a file → you get a form of that template's slots, with examples filled in
as placeholders → fill them → you have a project. Every slot stays editable
afterwards: change `{{subject}}` later and every prompt that referenced it
re-assembles and the affected shots go stale. Swapping a part is the same
mechanism as filling it the first time.

### Sharing one

Export writes a single readable JSON file. Import takes a file or pasted JSON.
No server, no account, no gallery — the file is the unit of sharing, and it works
over email, a gist, a Discord message or a repo.

The format is plain, versioned and diffable **on purpose**. `modes.ts` already
has the argument written into its header comment: the marketplace equivalents are
"hidden prompt templates", and a template you cannot read is a template you
cannot trust, fork or fix. Ours is readable or it is not worth shipping.

`source` carries the remix chain, so a template built from someone else's keeps
their name attached without any infrastructure.

---

## Data model

```ts
type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  shots: Shot[];             // array order IS story order; no rank field
  threads: Thread[];
  notes: Note[];             // free-positioned, never part of the story
  direction: Direction;      // project-wide craft constants
  slotValues?: Record<string, string>;   // if made from a template
  source?: { templateId: string; name: string; author?: string };
};

type Shot = {
  id: string;
  heading: string;           // "INT. ALLEY — NIGHT"
  beat: string;              // one sentence: what happens
  threadIds: string[];
  seconds: number | null;
  model: { id: string; ratio: AspectRatio; count: number };
  direction?: Partial<Direction>;        // per-shot override of the constants
  render?: {
    url: string;
    kind: "image" | "video";
    usd: number | null;
    promptHash: string;      // what staleness is computed against
    at: number;
  };
  locked?: boolean;
};
```

`shots` array order being the story order — rather than a `rank` field — means
reorder is an array move and there is no way for order and position to disagree.

`Direction` is the `direction` shape from `modes.ts` (camera, light, staging,
constants) promoted to a shared type. It is the craft vocabulary that holds a set
together, and it already exists.

### Persistence

IndexedDB, project-scoped, autosaving. `open-higgsfield/src/openhiggsfield/idb.ts`
in the sibling repo is the working reference for this exact problem.

Project export/import is the same format family as templates — a project is a
template with every slot already filled.

**This is step one.** Everything else assumes state that outlives a refresh, and
there is none today.

---

## What this adds to the app

The nav already has `Create / Explore / Video / Edit / Library`, of which only
Create is real. The workspace is a new surface, not a rewrite of the composer:

```
src/
  story/
    model.ts        Project, Shot, Thread, Direction + pure operations
                    (reorder, retime, recompute)
    assemble.ts     assemble(shot, prev, direction) -> prompt. The enhance.ts
                    pattern, pointed at shots
    import/
      screenplay.ts Fountain / markdown scene parsing
      panels.ts     the light-again.ts shape
      outline.ts    one beat per line
    template.ts     export / import / slot substitution
    store.ts        IndexedDB persistence
  app/
    board/          the canvas: spine, lanes, cards, notes, thread panel
```

`providers/`, `catalog/` and `actions.ts` are untouched. Generation still goes
through the existing server action and the existing provider seam — a shot's
`{ model, prompt, ratio, count }` is exactly the argument `run()` already takes.

---

## Build order

Each step is usable on its own, which matters because the value should not all
arrive at the end:

1. **Persistence + project shell.** Projects list, create, rename, autosave,
   export/import. Nothing else works without it.
2. **The spine.** Shots in order on a pannable, zoomable canvas. Add, edit, delete,
   reorder. No threads yet.
3. **Assembly + staleness.** `assemble()`, prompt on the card, `promptHash` on
   renders, stale state, batch re-run with a total cost. This is the first step
   where the workspace does something the composer cannot.
4. **Threads.** Lanes, ribbons, tie points, the thread panel, gap warnings.
5. **Script import.** Screenplay first (the Waylight corpus), then panels, then
   outline.
6. **Templates.** Export, import, slot filling, slot swapping, remix chain.

Steps 1–3 are the spine of the product. 4–6 are each independently valuable and
can be reordered against whatever is most wanted at the time.

---

## Left to the builder

- Card dimensions, lane heights, and the three zoom thresholds — these want to be
  found by eye against real content, not specified here.
- Canvas rendering approach. The constraint is that a season (~400 shots at the
  Waylight scale) must pan at 60fps, which likely means virtualising to the
  viewport; whether that is DOM, canvas or a hybrid is the builder's call.
- The gap threshold at which a thread reads as dangling. Start at 8 shots and
  tune it.
- Fountain parsing depth — a tolerant subset that handles the Waylight markdown is
  enough; full spec compliance is not required.
- Whether reorder animates. It should feel like the story moved, not like the DOM
  repainted, but the specific motion is a craft decision.

## Decisions made here that could be revisited

- **Lanes over free positioning.** The arguments are above. If users genuinely
  want a corkboard, notes are the pressure valve; if that proves insufficient,
  revisit before adding a second layout mode.
- **No auto-regeneration.** Deliberate and tied to the product's cost-transparency
  thesis. A "re-run stale automatically" toggle would be a reasonable opt-in
  later; it must never be the default.
- **No hosted gallery in v1.** The format is the contract; the gallery is an
  application of it and can come later without breaking anything.

---

# Part Two — The landing page, and connecting what exists

*Added 2026-10-18, same session.*

## Why there is a landing page at all

`open-higgsfield` serves the studio at `/` and has no landing page. That is right
for a tool someone already decided to use, and wrong for haggs, because haggs has
an argument to make and the argument is checkable.

Higgsfield's own site splits marketing from the product: a landing page sells the
models and the plans, and `/create` is the studio behind a subscription. We copy
the split and inherit none of the gate.

## The hero is a live price table, not a claim

This is the whole design of the landing page, and it falls out of something that
is already true in the code:

> **Pricing needs no key.** `rates()` in `app/actions.ts` reads fal's published
> prices. `demo.ts` already prints the live table in the terminal, with the
> spread between cheapest and dearest computed at the bottom.

So a stranger who has never signed in can be shown **real dollar rates, fetched
live, for every model in the catalog** — on first paint, with nothing to install
and no account. And the one number that lands hardest is already computed in
`demo.ts`: FLUX.1 Schnell at `$0.0030/megapixel` against FLUX.2 Pro's `$0.030` —
a 10× spread that Higgsfield's picker cannot show you, because it shows no rate
at all and prices in credits that are worth `$1 = 15` on one tier and `$1 = 33`
on another.

Porting `demo.ts`'s table to the landing page is a few hours of work and it is
the most persuasive asset the project has, because it is not a claim about the
product — it is the product, running, before signup.

### Page structure

1. **Hero.** The one-line pitch, and the live price table immediately — above the
   fold, already populated, sorted cheapest first, with the spread called out.
   No carousel, no video loop.
2. **The comparison.** The table already written in `README.md` — button reads
   `$0.080` not `⚡ 6.5`; rates on every picker row; ~1,499 models not ~50; your
   key not a subscription; your prompt, not one assembled server-side and never
   returned.
3. **The storyboard workspace.** One still of the canvas with threads running
   through it, and the sentence that explains the thing nothing else does: move a
   shot and the prompts that depended on it go stale, visibly, before you spend
   anything.
4. **Templates.** What a shared template is, and that you can read it. The
   `modes.ts` header comment is the argument in its sharpest form — the
   marketplace equivalents are hidden prompt templates; ours is a file you can
   open.
5. **Start.** Two doors: *Open the studio* (works immediately — browsing and
   pricing need no key) and *Add a fal key* (only generation needs one).

### What the landing page must not do

- No fake social proof, no invented testimonials, no logo wall of companies that
  are not customers.
- No credits, anywhere, in any form.
- No "sign up to see pricing". The entire point is that the price is visible to
  someone who has not signed up.
- It must not be a second implementation of anything. The price table is the same
  `rates()` call the picker uses; the comparison is the same `README.md` text.

### SEO and metadata

Lift the pattern from `open-higgsfield/src/site.ts` wholesale — it is already
reasoned through, including why `OG_IMAGE` lives in `public/` rather than as an
`opengraph-image` file convention, and why route overrides go through
`openGraphFor()` instead of redeclaring the object. haggs currently has no
`site.ts`, no `sitemap.ts`, no `robots.ts` and no OG card. Copy all four, change
the identity constants.

---

## Connecting the parts

The nav in `studio.tsx` reads `Create / Explore / Video / Edit / Library` and
four of the five are dead buttons. They were copied from Higgsfield's shape
because, as the README says, "it works and people already know it". The shape is
right; it just has nothing behind it. Every one of them resolves against data the
catalog already carries.

| Nav | What connects it | New work |
|---|---|---|
| **Create** | the existing composer | none — it works today |
| **Explore** | bundled + imported templates; the gallery of shapes you can clone | template list UI |
| **Video** | `MODELS` filtered to `capability: "text-to-video" \| "image-to-video"` | a filter, not a surface |
| **Edit** | `capability: "image-edit"`, driven by the composer's `+` attach button, which is currently inert | wire attach → `images[]` on the request |
| **Library** | projects and past renders, from the IndexedDB store in step 1 | falls out of persistence |

Plus one new entry, **Board**, for the storyboard workspace.

`Video` and `Edit` are filters over `catalog/models.ts`, which already declares
`capability` on every card, and `providers/types.ts` already has `image-edit` and
both video capabilities in its `Capability` union. The seam was built for this;
nothing needs inventing.

### Routing

```
/            landing page            (no key, live prices)
/create      the composer            (today's studio)
/board       the storyboard canvas
/board/:id   one project
/explore     templates
/library     projects and renders
```

### The two dangling modules get homes

Both unwired directories in `src/` are wired by this design rather than deleted,
and each one proves a different half of it:

- **`workflows/product-photoshoot/`** becomes **the first bundled template.** It
  already has everything the template format needs: ten modes with trigger
  routing, a `direction` block per mode (camera, light, staging, constants), a
  variant axis, and a pure `enhance()` that assembles the prompt. Expressing it
  as a `haggs.template/1` file is the proof that the format can carry real work,
  and it is the strongest possible first example for `/explore` — the thing
  Higgsfield keeps on the server, shipped as a file you can read.

- **`projects/light-again.ts`** becomes **the first import fixture** for the panel
  importer. 54 panels with act and location, plus a genuine structural finding
  already recorded in the file (page 2 retells the whole arc and would resolve
  the story twice). That finding is exactly what the thread panel and the running
  time view are for — it is a worked example of the workspace catching something
  real, and it was found by hand because there was no tool.

Neither module needs rewriting. They need a surface, which is what this is.

### What "connected like we have them now" means concretely

The composer keeps working exactly as it does today — same single-shot flow, same
price on the button. The board does not replace it; a shot on the board opens the
same composer bound to that shot, and the same `run()` server action generates it.
One provider seam, one catalog, one key, one cost model, reached from more than
one surface.

The order this gets built in is unchanged from Part One: persistence first,
because the landing page is the only piece here that does not depend on it, and
everything else does.
