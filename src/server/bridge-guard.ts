/**
 * The bridge only answers this machine's own app in development: never in
 * production, and never a request another website's page sends.
 */
export function bridgeAllowed(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}
