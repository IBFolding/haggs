/**
 * Starts the haggs MCP server (scripts/mcp.ts) from one bundled file.
 *
 *   node scripts/mcp-start.mjs
 *
 * Loading the server through tsx reads hundreds of small files, which on a
 * slow disk takes longer than an MCP client waits (Claude Code gives up after
 * 30 seconds). So the server is bundled once into scripts/mcp.bundle.mjs and
 * that one file is run. The bundle is made again whenever one of the repo's
 * own files it was made from has changed since.
 */

import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const bundle = join(here, "mcp.bundle.mjs");
const stamp = join(here, "mcp.bundle.json");

/** True when the bundle exists and none of the repo files it was made from is newer. */
async function fresh() {
  try {
    const made = JSON.parse(await readFile(stamp, "utf8"));
    const times = await Promise.all(made.inputs.map((f) => stat(join(root, f)).then((s) => s.mtimeMs)));
    return times.every((t) => t <= made.at) && (await stat(bundle)).mtimeMs >= made.at;
  } catch {
    return false;
  }
}

if (!(await fresh())) {
  const { build } = await import("esbuild");
  const at = Date.now();
  const result = await build({
    absWorkingDir: root,
    entryPoints: [join(here, "mcp.ts")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    metafile: true,
    logLevel: "silent",
    // Bundled CommonJS packages still call require for Node's own modules.
    banner: { js: 'import { createRequire as __haggsRequire } from "node:module"; const require = __haggsRequire(import.meta.url);' },
  });
  const inputs = Object.keys(result.metafile.inputs).filter((f) => !f.includes("node_modules"));
  await writeFile(stamp, JSON.stringify({ at, inputs }));
}

await import(pathToFileURL(bundle).href);
