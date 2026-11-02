import { readPrivateMedia } from "../../../../server/private-media";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try { return await readPrivateMedia(`/api/media/${path.join("/")}`, request); }
  catch { return new Response("Media unavailable", { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
