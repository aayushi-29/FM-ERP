import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canReadInventory, canManageInventory } from "@/lib/inventory/scope";
import { storage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

// "Ingredient COA (Certificate of Analysis) should be uploaded in image
// format" — unlike the general Documents module (lib/documents/scope.ts),
// this upload accepts only image MIME types, enforced here rather than in
// the schema (schema.prisma's RawMaterialAttachment comment calls this
// out). A COA is usually a scanned/photographed lab certificate, so
// image-only rather than PDF is a deliberate, narrower allowlist than the
// Documents module's.
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — images only, no need for the 20MB document ceiling

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canReadInventory(user.role)) throw new ForbiddenError("Not permitted");

    const attachments = await prisma.rawMaterialAttachment.findMany({
      where: { rawMaterialId: params.id },
      select: { id: true, fileName: true, fileSizeBytes: true, uploadedAt: true, uploadedBy: { select: { id: true, name: true } } },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({ attachments });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageInventory(actor.role)) throw new ForbiddenError("Not permitted");

    const rawMaterial = await prisma.rawMaterial.findUnique({ where: { id: params.id } });
    if (!rawMaterial) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ValidationError(`Image exceeds the ${MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024}MB limit`);
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
      throw new ValidationError(`COA uploads must be an image (png, jpeg, or webp) — got "${file.type || "unknown"}"`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 150) || "coa";

    const attachment = await prisma.$transaction(async (tx) => {
      const storageKey = `raw-materials/${params.id}/${Date.now()}-${safeName}`;
      await storage.save(storageKey, buffer);

      const created = await tx.rawMaterialAttachment.create({
        data: {
          rawMaterialId: params.id,
          storageKey,
          fileName: file.name.slice(0, 200),
          fileSizeBytes: file.size,
          uploadedById: actor.id,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "raw_material_attachment.uploaded",
          targetType: "RawMaterialAttachment",
          targetId: created.id,
          after: { rawMaterialId: params.id, fileName: created.fileName },
        },
        tx
      );

      return created;
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
