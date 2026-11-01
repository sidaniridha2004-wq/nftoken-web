import { NextResponse } from "next/server";
import { poolRecheck, isDatabaseConnected } from "@/lib/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/check
 * Runs every 30 minutes (via Vercel Cron or external webhook).
 * Rechecks all existing pool cookies against Netflix, mints fresh tokens,
 * marks dead accounts, and updates the Upstash Redis database.
 */
export async function GET(request: Request) {
  // Optional auth: verify CRON_SECRET if configured in env vars
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await poolRecheck();
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    database: isDatabaseConnected() ? "connected" : "local",
    ...result,
  });
}
