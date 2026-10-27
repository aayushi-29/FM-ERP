import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Users & settings: Admin manages, everyone else has no access by default
// (baseline §4 table, "Users & settings" row). No self-registration exists
// anywhere in the app — this is the only way a new login gets created.
const ROLE_VALUES = ["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE", "CLIENT"] as const;

const createUserSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).max(200),
    role: z.enum(ROLE_VALUES),
    password: z.string().min(10, "Password must be at least 10 characters"),
    clientOrgId: z.string().cuid().optional(),
  })
  .refine((data) => (data.role === "CLIENT" ? !!data.clientOrgId : true), {
    message: "clientOrgId is required for CLIENT accounts",
    path: ["clientOrgId"],
  })
  .refine((data) => (data.role !== "CLIENT" ? !data.clientOrgId : true), {
    message: "clientOrgId only applies to CLIENT accounts",
    path: ["clientOrgId"],
  });

export async function GET() {
  try {
    await requireRole(["ADMIN"]);

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        clientOrgId: true,
        clientOrg: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);
    const json = await request.json().catch(() => null);
    const input = createUserSchema.parse(json);

    if (!isPasswordStrongEnough(input.password)) {
      return NextResponse.json(
        { error: "Password is too short (minimum 10 characters)" },
        { status: 400 }
      );
    }

    const email = input.email.toLowerCase();

    if (input.clientOrgId) {
      const org = await prisma.clientOrganization.findUnique({ where: { id: input.clientOrgId } });
      if (!org) {
        return NextResponse.json({ error: "clientOrgId does not exist" }, { status: 400 });
      }
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: input.name,
          role: input.role,
          passwordHash,
          clientOrgId: input.clientOrgId ?? null,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "USER_CREATED",
          targetType: "User",
          targetId: created.id,
          after: { email: created.email, name: created.name, role: created.role },
        },
        tx
      );

      return created;
    });

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      { status: 201 }
    );
  } catch (err) {
    // Unique constraint on email — surface as a clean 409, not a 500.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    return errorResponse(err);
  }
}
