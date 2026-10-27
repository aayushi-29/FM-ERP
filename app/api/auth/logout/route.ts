import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, clearSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/origin";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();

  return NextResponse.json({ ok: true });
}
