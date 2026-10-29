import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { canUploadType, canManageVisibility } from "@/lib/documents/scope";
import { UploadDocumentForm } from "./upload-document-form";
import { DocumentRow } from "./document-row";
import { Shell } from "@/app/components/shell";

export default async function DocumentsPage({ params }: { params: { id: string } }) {
  const user = await requireUserOrRedirect();
  await assertProjectAccessOrRedirect(user, params.id);

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!project) notFound();

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
      uploadedBy: { select: { name: true } },
      versions: {
        select: { id: true, versionNumber: true, fileName: true, fileSizeBytes: true, uploadedAt: true },
        orderBy: { versionNumber: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const uploadableTypes = (["CONTRACT", "TECHNICAL_SPEC", "FORMULATION_SUMMARY", "TRIAL_RECORD", "COMMERCIAL", "OTHER"] as const)
    .filter((t) => canUploadType(user.role, t));
  const canManage = canManageVisibility(user.role);

  return (
    <Shell user={user}>
      <p style={{ marginBottom: 4 }}>
        <Link href={`/projects/${project.id}`}>← {project.name}</Link>
      </p>
      <h1>Documents</h1>
      {user.role === "CLIENT" ? (
        <p style={{ color: "#777", fontSize: ".88rem" }}>Showing files approved for your organization.</p>
      ) : null}

      {documents.length === 0 ? (
        <p style={{ color: "#777" }}>No documents yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              document={{
                id: doc.id,
                type: doc.type,
                visibility: doc.visibility,
                uploadedByName: doc.uploadedBy.name,
                versions: doc.versions.map((v) => ({
                  id: v.id,
                  versionNumber: v.versionNumber,
                  fileName: v.fileName,
                  fileSizeBytes: v.fileSizeBytes,
                  uploadedAt: v.uploadedAt.toISOString(),
                })),
              }}
              canManage={canManage}
              canUploadVersion={canUploadType(user.role, doc.type) && !(user.role === "CLIENT" && doc.visibility !== "CLIENT_VISIBLE")}
            />
          ))}
        </ul>
      )}

      {uploadableTypes.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <UploadDocumentForm projectId={project.id} allowedTypes={uploadableTypes} canSetVisibility={canManage} />
        </div>
      ) : null}
    </Shell>
  );
}
