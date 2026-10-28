import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canReadInventory } from "@/lib/inventory/scope";
import { storage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { errorResponse } from "@/lib/api/respond";

// Mirrors app/api/documents/[id]/versions/[versionId]/download/route.ts's
// pattern — authorize, then stream the bytes, no public URL shortcut.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canReadInventory(user.role)) throw new ForbiddenError("Not permitted");

    const attachment = await prisma.rawMaterialAttachment.findUnique({ where: { id: params.id } });
    if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const bytes = await storage.read(attachment.storageKey);

    await logAudit({
      actorId: user.id,
      action: "raw_material_attachment.downloaded",
      targetType: "RawMaterialAttachment",
      targetId: attachment.id,
      after: { fileName: attachment.fileName },
    });

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
        "Content-Length": String(attachment.fileSizeBytes),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
