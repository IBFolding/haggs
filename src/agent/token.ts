/** The clear token exists only in the browser's one-time reveal. */
export async function makeAgentToken(source: Crypto = crypto) {
  const bytes = source.getRandomValues(new Uint8Array(32));
  const token = `hgs_${btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  const digest = await source.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const token_hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { token, token_hash };
}
