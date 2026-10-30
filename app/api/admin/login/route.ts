import { NextResponse } from "next/server";
import { login } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body?.password;
    if (typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }
    const token = login(password);
    if (!token) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
