import { NextResponse } from "next/server";
import { poolGetWorking, poolPatch, type PublicPoolEntry } from "@/lib/pool";
import { extractCookieDict } from "@/lib/cookies";
import { fetchNftoken, ClientError } from "@/lib/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/pool/random
 * Selects a random working cookie from the pool, verifies or generates
 * a fresh login token on-the-fly, and returns the result.
 */
export async function POST() {
  const working = await poolGetWorking();
  if (working.length === 0) {
    return NextResponse.json(
      { error: "No working accounts available in the pool right now." },
      { status: 404 },
    );
  }

  // Shuffle candidates to pick randomly
  const shuffled = [...working].sort(() => Math.random() - 0.5);

  for (const entry of shuffled) {
    try {
      const dict = extractCookieDict(entry.raw);
      // Generate a fresh live login URL
      const result = await fetchNftoken(dict);

      await poolPatch(entry.id, {
        status: "working",
        loginUrl: result.login_url,
        expires: result.expires,
        expiryText: result.expiry_text,
        lastChecked: Date.now(),
      });

      const response: PublicPoolEntry = {
        id: entry.id,
        label: entry.label,
        country: entry.country,
        preview: entry.preview,
        status: "working",
        loginUrl: result.login_url,
        expires: result.expires,
        expiryText: result.expiry_text,
        addedAt: entry.addedAt,
      };

      return NextResponse.json({ entry: response });
    } catch (err) {
      // If expired, update status so it is no longer picked
      if (err instanceof ClientError) {
        await poolPatch(entry.id, {
          status: "invalid",
          message: err.message,
          lastChecked: Date.now(),
        });
      }
      // Continue to next candidate in the shuffled list
    }
  }

  return NextResponse.json(
    { error: "Could not generate a live link. Please try again in a few moments." },
    { status: 503 },
  );
}
