import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { STUDIO_WORKFLOWS } from './world-motion-vfx';
const root = new URL('../../public/workflows/world-motion-vfx/', import.meta.url);
const seen = new Set<string>();
for (const group of STUDIO_WORKFLOWS) test(`${group.title}: all downloads and reciprocal graph bindings exist`, () => {
  assert.ok(existsSync(new URL(`${group.slug}-illustrative.webp`, root)));
  assert.ok(existsSync(new URL(`previews/${group.preview}`, root)));
  for (const file of group.files) {
    const bytes = readFileSync(new URL(`workflows/${file}.json`, root));
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
    assert.ok(graph.nodes.some((n: {type:string}) => n.type.startsWith('Haggs')));
  }
});
