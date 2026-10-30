import { NextResponse } from "next/server";
import { poolPublic } from "@/lib/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/pool — public endpoint returning only working entries (no raw cookies). */
export async function GET() {
  const entries = await poolPublic();
  return NextResponse.json({ entries });
}
