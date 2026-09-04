import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { createSessionValue, SESSION_MAX_AGE_SECONDS } from "@/server/auth/session";

// Demo auth: the cookie is the whole session, so it is written by a small
// route instead of smuggling a Set-Cookie out of a tRPC batch response. This
// is auth infrastructure, not application data, which stays fully on tRPC.
export async function POST(request: NextRequest) {
  let userId: unknown;
  try {
    const body = (await request.json()) as { userId?: unknown };
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof userId !== "string") {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("demo_session", createSessionValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
