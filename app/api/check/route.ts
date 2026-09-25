import { NextResponse } from "next/server";
import { ClientError, UpstreamError, fetchNftoken } from "@/lib/client";
import { extractCookieDict } from "@/lib/cookies";
import { maskValue } from "@/lib/mask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COOKIE_CHARS = 64 * 1024;

export type CheckStatus = "working" | "invalid" | "error";

type CheckResponse = {
  status: CheckStatus;
  message?: string;
  login_url?: string;
  expires?: number | null;
  expiry_text?: string;
  netflix_id_preview: string;
};

/**
 * Validate a single cookie by asking Netflix for a token.
 *   working -> Netflix returned a token (the session is live)
 *   invalid -> no NetflixId, or Netflix returned no token (dead/expired)
 *   error   -> network/upstream failure (status unknown, try again later)
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { status: "invalid", message: "Empty request.", netflix_id_preview: "—" },
      { status: 400 },
    );
  }

  const rawCookie =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).cookie
      : undefined;

  if (typeof rawCookie !== "string" || !rawCookie.trim()) {
    return NextResponse.json(
      {
        status: "invalid",
        message: "No cookie provided.",
        netflix_id_preview: "—",
      } satisfies CheckResponse,
      { status: 200 },
    );
  }

  if (rawCookie.length > MAX_COOKIE_CHARS) {
    return NextResponse.json(
      {
        status: "invalid",
        message: "Cookie payload is too large.",
        netflix_id_preview: "—",
      } satisfies CheckResponse,
      { status: 200 },
    );
  }

  const cookieDict = extractCookieDict(rawCookie);
  const netflixId = cookieDict["NetflixId"];
  const preview = netflixId ? maskValue(netflixId) : "—";

  if (!netflixId) {
    return NextResponse.json(
      {
        status: "invalid",
        message: "No NetflixId found in this entry.",
        netflix_id_preview: preview,
      } satisfies CheckResponse,
      { status: 200 },
    );
  }

  try {
    const result = await fetchNftoken(cookieDict);
    return NextResponse.json(
      {
        status: "working",
        login_url: result.login_url,
        expires: result.expires,
        expiry_text: result.expiry_text,
        netflix_id_preview: preview,
      } satisfies CheckResponse,
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof ClientError) {
      return NextResponse.json(
        {
          status: "invalid",
          message: err.message,
          netflix_id_preview: preview,
        } satisfies CheckResponse,
        { status: 200 },
      );
    }
    if (err instanceof UpstreamError) {
      return NextResponse.json(
        {
          status: "error",
          message: err.message,
          netflix_id_preview: preview,
        } satisfies CheckResponse,
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        status: "error",
        message: "Unexpected error.",
        netflix_id_preview: preview,
      } satisfies CheckResponse,
      { status: 200 },
    );
  }
}
