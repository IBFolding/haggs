import type { ApiPrompt, Catalog } from './convert';

/** Empty loader inventories must fail too: the general validator skips empty combos. */
export function modelRequirements(prompt: ApiPrompt, catalog: Catalog): string[] {
  const issues: string[] = [];
  for (const node of Object.values(prompt)) {
    const def = catalog[node.class_type];
    if (!def) { issues.push(`Missing node ${node.class_type}. Add its required node package to the selected ComfyUI, then check again.`); continue; }
    for (const [name,value] of Object.entries(node.inputs)) {
      if (typeof value !== 'string' || !/\.(safetensors|ckpt|gguf|pt|pth|bin)$/i.test(value)) continue;
      const spec = def.input.required?.[name] ?? def.input.optional?.[name];
      const choices = Array.isArray(spec?.[0]) ? spec[0] : spec?.[0] === 'COMBO' ? spec[1]?.options : undefined;
      if (!Array.isArray(choices) || !choices.includes(value)) issues.push(`Model ${value} is not confirmed in ${node.class_type}.${name}. Add the exact model to the selected ComfyUI and refresh its catalog.`);
    }
  }
  return issues;
}
