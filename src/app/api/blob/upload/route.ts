import { handleBlobUpload } from "../../../../server/blob-upload";
import { privateMediaWrites } from "../../../../server/media-storage-config";
export async function POST(request: Request) { return handleBlobUpload(request, false); }
export async function GET() { return Response.json({ access: privateMediaWrites() ? "private" : "public" }, { headers: { "Cache-Control": "no-store" } }); }
