import { handleBlobUpload } from "../../../../server/blob-upload";
export async function POST(request: Request) { return handleBlobUpload(request, true); }
