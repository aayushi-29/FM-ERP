import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { errorResponse } from "@/lib/api/respond";

const PAGE_SIZE = 50;

// Admin-only, read-only (baseline §10: "Audit log: Read-only; cannot
// edit/delete") — there is deliberately no PATCH/DELETE/POST on this
// route, matching the append-only convention enforced in lib/audit.ts.
// Optional filters narrow by actor, target, or action substring; results
// are always newest-first and offset-paginated since audit volume can
// grow large and nobody needs to jump to a specific page by number, just
// to page back through recent history.
export async function GET(request: Request) {
  try {
    await requireRole(["ADMIN"]);

    const url = new URL(request.url);
    const actorId = url.searchParams.get("actorId") ?? undefined;
    const targetType = url.searchParams.get("targetType") ?? undefined;
    const targetId = url.searchParams.get("targetId") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

    const where = {
      ...(actorId ? { actorId } : {}),
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
      ...(action ? { action: { contains: action } } : {}),
    };

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ entries, total, page, pageSize: PAGE_SIZE });
  } catch (err) {
    return errorResponse(err);
  }
}
