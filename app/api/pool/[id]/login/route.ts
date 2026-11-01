import { NextResponse } from "next/server";
import { poolMintFreshToken, poolGetWorking } from "@/lib/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/pool/[id]/login
 * Dynamically generates a fresh live Netflix session token for this account
 * and redirects the user directly into Netflix.
 * Never expires because a new token is minted on every click.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Try minting a fresh token for this specific account
  const fresh = await poolMintFreshToken(id);
  if (fresh && fresh.loginUrl) {
    return NextResponse.redirect(fresh.loginUrl, { status: 302 });
  }

  // 2. If this account is dead, pick any other working account from the pool
  const working = await poolGetWorking();
  for (const alt of working) {
    if (alt.id === id) continue;
    const altFresh = await poolMintFreshToken(alt.id);
    if (altFresh && altFresh.loginUrl) {
      return NextResponse.redirect(altFresh.loginUrl, { status: 302 });
    }
  }

  // 3. Fallback: return to pool with notice
  const url = new URL("/", request.url);
  url.searchParams.set("error", "account_expired");
  return NextResponse.redirect(url, { status: 302 });
}

/**
 * POST /api/pool/[id]/login
 * Returns a JSON object with a freshly minted login URL (used by the "copy" button).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const fresh = await poolMintFreshToken(id);
  if (fresh && fresh.loginUrl) {
    return NextResponse.json(fresh);
  }

  return NextResponse.json(
    { error: "Account session could not be refreshed. It may have expired." },
    { status: 410 },
  );
}
