import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canUploadType, canManageVisibility, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/documents/scope";
import { storage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

const DOCUMENT_TYPES = ["CONTRACT", "TECHNICAL_SPEC", "FORMULATION_SUMMARY", "TRIAL_RECORD", "COMMERCIAL", "OTHER"] as const;

// All four roles reach this route, each scoped differently (baseline §9:
// "a client-approved formulation summary is distinct from the full
// recipe" — so visibility, not role, is what gates a *read*). Client only
// ever sees CLIENT_VISIBLE rows; everyone else sees everything in a
// project they're assigned to.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(user, params.id);

    const documents = await prisma.document.findMany({
      where: {
        projectId: params.id,
        visibility: user.role === "CLIENT" ? "CLIENT_VISIBLE" : undefined,
      },
      select: {
        id: true,
        type: true,
        visibility: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true } },
        versions: {
          select: { id: true, versionNumber: true, fileName: true, fileSizeBytes: true, uploadedAt: true },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documents });
  } catch (err) {
    return errorResponse(err);
  }
}

const metaSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  // Only Admin/Project Lead's request is honored (lib/documents/scope.ts,
  // canManageVisibility) — everyone else's upload lands INTERNAL_ONLY no
  // matter what they send, so this field is accepted from all roles but
  // only acted on from two of them, below.
  visibility: z.enum(["INTERNAL_ONLY", "CLIENT_VISIBLE"]).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    await assertProjectAccess(actor, params.id);

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });

    const meta = metaSchema.parse({
      type: form.get("type"),
      visibility: form.get("visibility") || undefined,
    });

    if (!canUploadType(actor.role, meta.type)) {
      throw new ForbiddenError(`Your role can't upload a ${meta.type} document`);
    }

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

    const visibility = canManageVisibility(actor.role) ? meta.visibility ?? "INTERNAL_ONLY" : "INTERNAL_ONLY";

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 150) || "upload";

    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: { projectId: params.id, type: meta.type, visibility, uploadedById: actor.id },
      });

      const storageKey = `${created.id}/1-${safeName}`;
      await storage.save(storageKey, buffer);

      const version = await tx.documentVersion.create({
        data: {
          documentId: created.id,
          versionNumber: 1,
          storageKey,
          fileName: file.name.slice(0, 200),
          fileSizeBytes: file.size,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "document.uploaded",
          targetType: "Document",
          targetId: created.id,
          after: { type: meta.type, visibility, fileName: version.fileName },
        },
        tx
      );
      await logProjectActivity(
        { projectId: params.id, actorId: actor.id, summary: `Document uploaded: ${version.fileName}` },
        tx
      );

      return { ...created, firstVersion: version };
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
