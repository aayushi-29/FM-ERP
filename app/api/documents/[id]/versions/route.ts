import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canUploadType, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/documents/scope";
import { storage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

// A new version replaces nothing — baseline §9: "Preserve document
// versions and record actor, time, and relevant changes." The document's
// type/visibility stay whatever they already were; this route only ever
// adds a row to DocumentVersion. Who may add one is the same rule as who
// may create the document in the first place (lib/documents/scope.ts),
// not ownership of the specific document — e.g. any NPD Executive on the
// project can post a corrected TECHNICAL_SPEC, not only the one who
// uploaded v1, mirroring how the matrix grants the right by role+type,
// not by record ownership.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();

    const document = await prisma.document.findUnique({ where: { id: params.id } });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await assertProjectAccess(actor, document.projectId);

    if (!canUploadType(actor.role, document.type)) {
      throw new ForbiddenError(`Your role can't upload a ${document.type} document`);
    }
    if (actor.role === "CLIENT" && document.visibility !== "CLIENT_VISIBLE") {
      // A Client can't even see an internal document (404'd elsewhere) —
      // this guards the same boundary on the write path.
      throw new ForbiddenError("Not permitted");
    }

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(`File exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`);
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new ValidationError(`File type "${file.type || "unknown"}" isn't allowed`);
    }

    const latest = await prisma.documentVersion.findFirst({
      where: { documentId: params.id },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 150) || "upload";
    const storageKey = `${params.id}/${nextVersionNumber}-${safeName}`;

    const version = await prisma.$transaction(async (tx) => {
      await storage.save(storageKey, buffer);

      const created = await tx.documentVersion.create({
        data: {
          documentId: params.id,
          versionNumber: nextVersionNumber,
          storageKey,
          fileName: file.name.slice(0, 200),
          fileSizeBytes: file.size,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "document_version.uploaded",
          targetType: "DocumentVersion",
          targetId: created.id,
          after: { documentId: params.id, versionNumber: nextVersionNumber, fileName: created.fileName },
        },
        tx
      );
      await logProjectActivity(
        { projectId: document.projectId, actorId: actor.id, summary: `New version uploaded: ${created.fileName}` },
        tx
      );

      return created;
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
