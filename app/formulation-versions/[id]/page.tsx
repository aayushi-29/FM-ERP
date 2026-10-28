import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getProjectIdForFormulationVersion, CLIENT_SAFE_VERSION_SELECT } from "@/lib/npd/scope";
import { IngredientLines } from "./ingredient-lines";
import { TrialsSection } from "./trials-section";
import { VersionActions } from "./version-actions";

export default async function FormulationVersionPage({ params }: { params: { id: string } }) {
  const user = await requireUserOrRedirect();

  const projectId = await getProjectIdForFormulationVersion(params.id);
  if (!projectId) notFound();
  await assertProjectAccessOrRedirect(user, projectId);

  if (user.role === "CLIENT") {
    // "Approved summary only" — both a reduced field set and gated on
    // status, mirroring the API route's CLIENT branch exactly.
    const version = await prisma.formulationVersion.findUnique({
      where: { id: params.id, status: "APPROVED" },
      select: CLIENT_SAFE_VERSION_SELECT,
    });
    if (!version) notFound();

    return (
      <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 600 }}>
        <h1>{version.formulation.product.name} — {version.formulation.name}</h1>
        <p style={{ color: "#555" }}>
          Version {version.versionNumber} · Approved
          {version.decidedAt ? ` on ${new Date(version.decidedAt).toLocaleDateString()}` : ""}
        </p>
      </main>
    );
  }

  const version = await prisma.formulationVersion.findUnique({
    where: { id: params.id },
    include: {
      formulation: { select: { id: true, name: true, product: { select: { id: true, name: true } } } },
      author: { select: { id: true, name: true } },
      ingredientLines: { orderBy: { materialName: "asc" } },
      trials: {
        select: {
          id: true,
          status: true,
          parameters: true,
          results: true,
          conductedById: true,
          conductedAt: true,
          attachments: { select: { id: true, document: { select: { id: true, type: true } } } },
        },
        orderBy: { conductedAt: "desc" },
      },
      approvals: { include: { approver: { select: { id: true, name: true } } }, orderBy: { decidedAt: "desc" } },
      nextVersions: { select: { id: true } },
    },
  });
  if (!version) notFound();

  // Project documents available to attach to a trial — only the id/type
  // (enough to label a dropdown option and link to the full document
  // page), not the full Documents-module query.
  const projectDocuments = await prisma.document.findMany({
    where: { projectId },
    select: { id: true, type: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const canEditDraft = user.role === "ADMIN" || user.role === "NPD_EXECUTIVE";
  const canDecide = user.role === "ADMIN" || user.role === "PROJECT_LEAD";
  const canRevise = canEditDraft && version.nextVersions.length === 0;
  const linesEditable = canEditDraft && version.status === "DRAFT";
  const trialsCreatable = canEditDraft; // scope narrows per-trial to the conductor

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 760 }}>
      <p style={{ marginBottom: 4 }}>
        <Link href={`/formulations/${version.formulation.id}`}>← {version.formulation.product.name} / {version.formulation.name}</Link>
      </p>
      <h1>Version {version.versionNumber}</h1>
      <p style={{ color: "#555" }}>
        {version.status} · drafted by {version.author.name}
        {version.submittedAt ? ` · submitted ${new Date(version.submittedAt).toLocaleDateString()}` : ""}
        {version.decidedAt ? ` · decided ${new Date(version.decidedAt).toLocaleDateString()}` : ""}
      </p>

      {version.processNotes ? (
        <p style={{ whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 10, borderRadius: 6 }}>
          {version.processNotes}
        </p>
      ) : null}

      <VersionActions
        versionId={version.id}
        status={version.status}
        canEdit={canEditDraft}
        canDecide={canDecide}
        canRevise={canRevise}
      />

      {version.approvals.length > 0 ? (
        <>
          <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Decision history</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {version.approvals.map((a) => (
              <li key={a.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
                {a.decision} by {a.approver.name} on {new Date(a.decidedAt).toLocaleDateString()}
                {a.comment ? ` — "${a.comment}"` : ""}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Ingredient lines</h2>
      <IngredientLines
        versionId={version.id}
        // Prisma's Decimal is a class instance, not a plain serializable
        // value — it can't cross the server/client component boundary, so
        // it's stringified here before handing lines to the client form.
        lines={version.ingredientLines.map((line) => ({
          id: line.id,
          materialName: line.materialName,
          quantity: line.quantity.toString(),
          unit: line.unit,
          percentage: line.percentage ? line.percentage.toString() : null,
          technicalNotes: line.technicalNotes,
        }))}
        editable={linesEditable}
      />

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Trials</h2>
      <TrialsSection
        versionId={version.id}
        trials={version.trials}
        canCreate={trialsCreatable}
        currentUserId={user.id}
        projectDocuments={projectDocuments.map((d) => ({ id: d.id, type: d.type, createdAt: d.createdAt.toISOString() }))}
      />
    </main>
  );
}
