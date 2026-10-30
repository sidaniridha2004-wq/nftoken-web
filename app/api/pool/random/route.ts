import { NextResponse } from "next/server";
import { poolGetWorking, poolPatch, type PublicPoolEntry } from "@/lib/pool";
import { extractCookieDict } from "@/lib/cookies";
import { fetchNftoken, ClientError } from "@/lib/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/pool/random
 * Selects a random working cookie from the pool, verifies or generates
 * a fresh login token on-the-fly, and returns the result.
 */
export async function POST() {
  const working = poolGetWorking();
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
      
      poolPatch(entry.id, {
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

      return NextResponse.json(response);
    } catch (err) {
      // If the cookie has gone bad, mark it dead so it's not shown anymore
      if (err instanceof ClientError) {
        poolPatch(entry.id, {
          status: "invalid",
          message: err.message,
          lastChecked: Date.now(),
        });
      }
      // Continue to next candidate
    }
  }

  return NextResponse.json(
    { error: "No currently active accounts could be verified. Please check back later." },
    { status: 404 },
  );
}
