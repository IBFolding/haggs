import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { GAME_DIRECTOR } from './game-director';
const root = new URL('../../public/workflows/game-director/', import.meta.url);
const seen = new Set<string>();
for (const g of GAME_DIRECTOR) test(`${g.title}: distinct graphs retain connected inputs and downloadable examples`, () => {
  assert.ok(existsSync(new URL(`${g.slug}-illustrative.webp`, root)));
  assert.ok(existsSync(new URL(g.preview ? `previews/${g.preview}` : 'previews/prepared-branch-player/player.html', root)));
  for (const kind of ['H3-local', 'preview-no-model']) {
    const bytes = readFileSync(new URL(`workflows/${kind}/${g.slug}.json`, root));
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.ok(!seen.has(hash)); seen.add(hash);
    const graph = JSON.parse(bytes.toString());
    const nodes = new Map(graph.nodes.map((n: { id: number }) => [n.id, n]));
    for (const [id, origin, slot, target, input] of graph.links) {
      const from = nodes.get(origin) as { outputs?: { links?: number[] }[] };
      const to = nodes.get(target) as { inputs?: { link?: number }[] };
      assert.ok(from && to, `dangling link ${id}`);
      assert.ok(from.outputs?.[slot]?.links?.includes(id), `output missing ${id}`);
      assert.equal(to.inputs?.[input]?.link, id, `input missing ${id}`);
    }
    const types = graph.nodes.map((n: {type:string}) => n.type);
    assert.ok(types.some((t:string) => t.startsWith('Haggs')));
    assert.ok(!types.includes('MinimaxHailuo03FirstLastFrameNode'), 'not the paid partner H3 node');
    assert.equal(types.includes('MiniMaxH3ReferenceToVideo'), kind === 'H3-local');
    assert.ok(types.includes(g.slug.startsWith('03-') ? 'HaggsBranchPlayer' : 'SaveVideo'));
    if (/^0[56]-/.test(g.slug)) assert.ok(types.includes('HaggsAtlasExport'));
  }
});
