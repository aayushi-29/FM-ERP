import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { isSameOrigin } from "@/lib/security/origin";
import { isRateLimited } from "@/lib/security/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  // Rate-limit by email, not by IP alone: a shared office/NAT IP shouldn't
  // lock out every other user. See lib/security/rate-limit.ts for the
  // production caveat on this placeholder.
  if (isRateLimited(`login:${email.toLowerCase()}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Same generic error whether the email doesn't exist or the password is
  // wrong, and the same response shape either way — don't let a timing or
  // message difference reveal which emails are registered.
  const genericError = NextResponse.json(
    { error: "Invalid email or password" },
    { status: 401 }
  );

  if (!user || !user.active) return genericError;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return genericError;

  const token = await createSession(user.id);
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.id, name: user.name, role: user.role },
  });
}
