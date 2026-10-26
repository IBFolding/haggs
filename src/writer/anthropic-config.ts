/** Non-secret Anthropic routing metadata. Never infer a workspace from a key. */
export const WORKSPACE_HELP = 'This Claude key requires a workspace ID. In Provider keys → Claude, enter its wrkspc_ ID from https://platform.claude.com/settings/workspaces. This is an Anthropic workspace, separate from the Haggs canvas. Your key does not need to be replaced.';
export function validateWorkspaceId(value: string | undefined): string | undefined {
  const id = value?.trim();
  if (!id) return undefined;
  if (!/^wrkspc_[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Enter an Anthropic workspace ID beginning wrkspc_, or leave it blank for a workspace-scoped key.');
  return id;
}
export function anthropicHeaders(workspaceId?: string): Record<string, string> {
  const id = validateWorkspaceId(workspaceId);
  return id ? { 'anthropic-workspace-id': id } : {};
}
export function anthropicOptions(apiKey: string, workspaceId?: string) {
  return { apiKey, defaultHeaders: anthropicHeaders(workspaceId), maxRetries: 0 };
}
/** Provider messages can contain request data. Only return our own static copy. */
export function anthropicErrorReason(status: number | undefined, detail = ''): string {
  if (/anthropic-workspace-id|not scoped to a workspace/i.test(detail)) return WORKSPACE_HELP;
  if ((status === 400 || status === 403) && /workspace/i.test(detail)) return 'Claude could not use that workspace. Check the Anthropic workspace ID in Provider keys and that your key’s account already has access to it. Nothing was retried.';
  return status ? `Claude could not complete this request (status ${status}). Check the request and provider settings. Nothing was retried.` : 'Claude could not be reached. Check Activity before retrying.';
}
