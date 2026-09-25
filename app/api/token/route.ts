import { NextResponse } from "next/server";
import { ClientError, UpstreamError, fetchNftoken } from "@/lib/client";
import { extractCookieDict } from "@/lib/cookies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COOKIE_CHARS = 64 * 1024;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please paste your Netflix cookie." },
      { status: 400 },
    );
  }

  const rawCookie =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).cookie
      : undefined;

  if (typeof rawCookie !== "string" || !rawCookie.trim()) {
    return NextResponse.json(
      { error: "Please paste your Netflix cookie." },
      { status: 400 },
    );
  }

  if (rawCookie.length > MAX_COOKIE_CHARS) {
    return NextResponse.json(
      { error: "Cookie payload is too large." },
      { status: 413 },
    );
  }

  const cookieDict = extractCookieDict(rawCookie);
  if (Object.keys(cookieDict).length === 0) {
    return NextResponse.json(
      { error: "No valid Netflix cookie found in the input." },
      { status: 400 },
    );
  }

  try {
    const result = await fetchNftoken(cookieDict);
    return NextResponse.json({
      login_url: result.login_url,
      expires: result.expires,
      expiry_text: result.expiry_text,
    });
  } catch (err) {
    if (err instanceof ClientError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof UpstreamError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
