import { NextResponse } from "next/server";
import { extractCookiesFromArchive } from "@/lib/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel serverless functions accept up to ~4.5MB request bodies.
const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024;

type ExtractResponse = {
  count: number;
  cookies: { source: string; cookie: string; label: string; country?: string }[];
};

/**
 * Accepts a multipart/form-data upload with a `file` field containing a .zip or
 * .rar archive of Netflix cookie text files. Extracts and rebuilds each cookie
 * header, de-duplicated by NetflixId. Nothing is stored or logged server-side.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_ARCHIVE_BYTES) {
    return NextResponse.json(
      { error: "Archive is too large (max 4 MB). Please split it into smaller files." },
      { status: 413 },
    );
  }

  let cookies: ExtractResponse["cookies"];
  try {
    const buffer = await file.arrayBuffer();
    cookies = await extractCookiesFromArchive(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the archive.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  return NextResponse.json(
    { count: cookies.length, cookies } satisfies ExtractResponse,
    { status: 200 },
  );
}
