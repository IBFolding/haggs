# Contributing to haggs

haggs is an open-source film studio on Comfy, MIT licensed. Fixes, new Comfy workflows, new Series formats, new looks and
better docs are all welcome.

## Run it

```bash
npm install
cp .env.example .env.local    # add your own keys; everything is optional until you use it
npm run dev                   # http://localhost:3111
```

You bring your own Comfy key, or point haggs at your own ComfyUI under **Keys → Your own GPU**. Nothing you type is sent
anywhere except the provider you chose. See the README for what runs where.

## Before you open a pull request

```bash
npm run typecheck
npm test
```

Both must pass. The tests are plain `node --test` files next to the code (`src/**/*.spec.ts`), so a new behaviour gets a
spec in the same folder.

## How the code is arranged

- `src/story`, `src/comfy`, `src/providers`, `src/server`: logic with no UI in it. Most of it is pure functions with specs.
- `src/app`: the Next.js pages and components. Keep a page thin; put the rules in `src/story` or `src/comfy`.
- Anything that makes a picture, clip or sound goes through Comfy (Comfy Cloud or your own ComfyUI), and every button
  that can cost money shows its price first.
- `scripts/mcp.ts` is the MCP server; a tool that proposes work must wait for the person to press Apply.

## Style

Match the code around yours: names, comment density, how errors are worded. Write words in the interface for the person
using it, in plain language, and say what went wrong and how to fix it.

## Adding a workflow or an app

Workflows are checked against Comfy's node catalog. Add yours under `src/comfy`, flag which nodes call a partner API
(`api_node`) so haggs can mark it open or not, and add a spec that loads it.

## Reporting a problem

Use the issue templates. For anything that could expose someone's keys or files, read `SECURITY.md` first and do not
post it in public.
