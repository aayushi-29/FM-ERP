import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess } from "@/lib/auth/rbac";
import { storage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { errorResponse } from "@/lib/api/respond";

// Every download is authorized and audited individually — baseline §9:
// "Store files privately and authorize every upload, preview, download,
// and export," and §10/§13 explicitly call out file-download routes as a
// thing to test. There is deliberately no public/signed-URL shortcut
// here: every byte served passes through this permission check first.
export async function GET(
  _request: Request,
  { params }: { params: { id: string; versionId: string } }
) {
  try {
    const user = await requireUser();

    const document = await prisma.document.findUnique({ where: { id: params.id } });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await assertProjectAccess(user, document.projectId);

    if (user.role === "CLIENT" && document.visibility !== "CLIENT_VISIBLE") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const version = await prisma.documentVersion.findUnique({ where: { id: params.versionId } });
    if (!version || version.documentId !== params.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const bytes = await storage.read(version.storageKey);

    await logAudit({
      actorId: user.id,
      action: "document_version.downloaded",
      targetType: "DocumentVersion",
      targetId: version.id,
      after: { fileName: version.fileName },
    });

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${version.fileName.replace(/"/g, "")}"`,
        "Content-Length": String(version.fileSizeBytes),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
