import type { ApiPrompt, Catalog } from "./convert";

/** The partner (paid API) nodes in a prompt, by class name. A workflow with none runs on open weights alone. */
export function partnerNodes(prompt: ApiPrompt, catalog: Catalog): string[] {
  const found = new Set<string>();
  for (const node of Object.values(prompt)) if ((catalog as Record<string, { api_node?: boolean }>)[node.class_type]?.api_node) found.add(node.class_type);
  return [...found];
}
