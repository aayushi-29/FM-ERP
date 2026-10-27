import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, ForbiddenError } from "@/lib/auth/rbac";

// Shared by every API route so an auth/permission failure always comes back
// as the right status code with no stack trace or internal detail leaked
// (baseline §10: "avoid exposing stack traces, secrets, or sensitive
// fields"). Route handlers wrap their body in try/catch and call this in
// the catch block.
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input", issues: err.flatten().fieldErrors },
      { status: 400 }
    );
  }

  console.error(err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
