import { NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { poolRemove } from "@/lib/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/admin/pool/[id] — remove a single pool entry. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  const removed = await poolRemove(id);
  if (!removed) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
