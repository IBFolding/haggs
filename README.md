# haggs

Higgsfield's create flow, mimicked and sharpened, running on fal.

## What it is

Their shape, because it works and people already know it:

- top nav, a canvas that stays empty until you make something
- a persistent bottom composer — attach, prompt, model pill, aspect pill, count stepper
- a searchable model picker that opens upward, rows badged with one-line descriptions
- a Generate button carrying the cost

## What's sharpened

| | Higgsfield | haggs |
| --- | --- | --- |
| Button | `Generate ⚡ 6.5` | `Generate $0.080` |
| Model picker | no prices shown | live rate on every row |
| Catalog | ~50 curated | window onto fal's ~1,499 |
| Access | $19–59/mo subscription | your own key, no subscription |
| Prompt | assembled server-side, never returned | yours |

Their button reads 6.5 credits. A credit is a unit you cannot value without
knowing your tier — `$1 = 15` credits on Starter, `$1 = 33` on Team. Ours reads
a dollar figure pulled from the provider at request time.

And because their picker hides the per-model rate, you cannot see that FLUX.1
Schnell runs at `$0.0030/megapixel` against FLUX.2 Pro's `$0.030` — a 10x
spread. Run `npm run demo` to see it.

## Run it

```bash
npm install
npm run dev          # http://localhost:3111
npm run demo         # live price table, no key used
npm run prices       # drift alarm against fal's live catalog
npm run typecheck
```

Browsing and pricing need no key — fal publishes prices openly. Only generation
needs one. Click **no key** in the top right and paste a fal key from
[fal.ai/dashboard/keys](https://fal.ai/dashboard/keys); it is posted once to a
server action and held in an httpOnly cookie, so it never reaches client JS.

## Layout

```
src/
  app/          the studio: nav, canvas, composer, model picker, key sheet
                actions.ts holds the key and is the only caller of the provider
  catalog/      models.ts is the picker; pricing.ts parses fal's live rates
  providers/    types.ts is the seam, fal.ts implements it
```

### The seam

`providers/types.ts` defines a provider as something that can `quote` and
`run`. fal implements it. Higgsfield would slot in beside it unchanged.

This is the one thing a provider-owned studio cannot ship: Higgsfield can never
route a generation to a cheaper provider, because the routing is the margin.
Same reason OpenRouter beat every individual LLM provider's playground.

### Pricing

fal publishes each model's schema and price at
`fal.ai/models/<endpoint>/llms.txt`, generated from the same metadata the
platform serves, so it cannot drift from the real endpoint.

The prices are prose and the prose is not uniform — four shapes across the
catalog (per image, per training run, tiered per megapixel, per second of
video, per clip). `pricing.ts` parses all four and keeps `usdPerUnit` null
rather than guess when a sentence will not yield one. `npm run prices` runs it
against the live catalog as a drift alarm.

## State

Working: model picker with live rates, cost on the button, aspect options
derived from the selected endpoint, count stepper clamped per model, key sheet,
generation wired end to end through fal's queue (submit → poll → collect),
errors surfaced into the grid.

**Never executed:** there is no fal key on this machine, so `run()` has been
typechecked and wired but never actually generated. Add a key to prove it.

Not built: the `+` attach button is a stub — image-to-video and editing need
fal CDN upload. No history, no gallery, no favourites.

### Dead code

`src/workflows/product-photoshoot/` (347 lines: a 10-mode taxonomy and a prompt
enhancer) is orphaned — nothing imports it since the composer rewrite. The
photographic direction in `modes.ts` is good and could seed a preset layer
later. Delete it or use it; leaving it is the worst of the three.

## Provenance

The flow is Higgsfield's and they were right about it. The mode taxonomy in the
orphaned workflow came from `higgsfield-ai/skills`, which is MIT. Their own
repos are MIT and Apache-2.0 throughout.

`wide-trace/open-higgsfield` — the "open-source alternative" — has **no licence
at all**, so it is all rights reserved. No code was taken from it.
