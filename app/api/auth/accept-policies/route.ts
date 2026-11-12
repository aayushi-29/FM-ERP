import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";
import { CURRENT_POLICY_VERSION } from "@/lib/legal/policy";

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
// Records that a signed-in user has actually read and accepted the current
// Privacy Policy and Terms of Service, at a specific version, with a
// timestamp — not just a boolean. app/components/shell.tsx blocks normal
// page content for any signed-in user whose stored version doesn't match
// CURRENT_POLICY_VERSION, and app/accept-policies/page.tsx posts here.
const schema = z.object({
  accept: z.literal(true, { errorMap: () => ({ message: "You must check the box to continue" }) }),
});

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    const json = await request.json().catch(() => null);
    schema.parse(json);

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: { policiesAcceptedAt: now, policiesVersion: CURRENT_POLICY_VERSION },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "user.accepted_policies",
          targetType: "User",
          targetId: actor.id,
          after: { policiesVersion: CURRENT_POLICY_VERSION, acceptedAt: now.toISOString() },
        },
        tx
      );
    });

    return NextResponse.json({ ok: true, policiesVersion: CURRENT_POLICY_VERSION, acceptedAt: now.toISOString() });
  } catch (err) {
    return errorResponse(err);
  }
}
