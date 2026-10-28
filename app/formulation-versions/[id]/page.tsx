import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getProjectIdForFormulationVersion, CLIENT_SAFE_VERSION_SELECT } from "@/lib/npd/scope";
import { isExecutionUnlocked } from "@/lib/projects/execution-gate";
import { canReadInventory } from "@/lib/inventory/scope";
import { IngredientLines } from "./ingredient-lines";
import { TrialsSection } from "./trials-section";
import { VersionActions } from "./version-actions";
import { RevisionRequestsSection } from "./revision-requests-section";

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

    const revisionRequests = await prisma.revisionRequest.findMany({
      where: { formulationVersionId: params.id },
      select: {
        id: true,
        notes: true,
        status: true,
        createdAt: true,
        addressedAt: true,
        requestedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return (
      <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 600 }}>
        <h1>{version.formulation.product.name} — {version.formulation.name}</h1>
        <p style={{ color: "#555" }}>
          Version {version.versionNumber} · Approved
          {version.decidedAt ? ` on ${new Date(version.decidedAt).toLocaleDateString()}` : ""}
        </p>

        <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Rework requests</h2>
        <RevisionRequestsSection
          versionId={version.id}
          revisionRequests={revisionRequests.map((r) => ({
            id: r.id,
            notes: r.notes,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
            addressedAt: r.addressedAt ? r.addressedAt.toISOString() : null,
            requestedBy: r.requestedBy,
          }))}
          canFile
        />
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
      revisionRequests: {
        select: {
          id: true,
          notes: true,
          status: true,
          createdAt: true,
          addressedAt: true,
          requestedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!version) notFound();

  const openRevisionRequest = version.revisionRequests.find((r) => r.status === "OPEN") ?? null;

  // Project documents available to attach to a trial — only the id/type
  // (enough to label a dropdown option and link to the full document
  // page), not the full Documents-module query.
  const projectDocuments = await prisma.document.findMany({
    where: { projectId },
    select: { id: true, type: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // "Research -> identify ingredients -> ingredients selection" — the
  // catalog an ingredient line is picked from (lib/inventory/scope.ts's
  // canReadInventory governs the /raw-materials page too; NPD Executive,
  // who actually edits ingredient lines, always passes this check).
  const rawMaterials = canReadInventory(user.role)
    ? await prisma.rawMaterial.findMany({
        select: { id: true, name: true, defaultUnit: true, supplier: { select: { name: true } } },
        orderBy: { name: "asc" },
      })
    : [];

  const canEditDraft = user.role === "ADMIN" || user.role === "NPD_EXECUTIVE";
  const canDecide = user.role === "ADMIN" || user.role === "PROJECT_LEAD";
  const canRevise = canEditDraft && version.nextVersions.length === 0;
  const executionUnlocked = await isExecutionUnlocked(projectId);
  const linesEditable = canEditDraft && version.status === "DRAFT" && executionUnlocked;
  const trialsCreatable = canEditDraft && executionUnlocked; // scope narrows per-trial to the conductor

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
        openRevisionRequestId={openRevisionRequest?.id ?? null}
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

      {version.revisionRequests.length > 0 ? (
        <>
          <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Rework requests</h2>
          <RevisionRequestsSection
            versionId={version.id}
            revisionRequests={version.revisionRequests.map((r) => ({
              id: r.id,
              notes: r.notes,
              status: r.status,
              createdAt: r.createdAt.toISOString(),
              addressedAt: r.addressedAt ? r.addressedAt.toISOString() : null,
              requestedBy: r.requestedBy,
            }))}
            canFile={false}
          />
        </>
      ) : null}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Ingredient lines</h2>
      {canEditDraft && version.status === "DRAFT" && !executionUnlocked ? (
        <p style={{ color: "#b00020", fontSize: ".85rem", marginBottom: 8 }}>
          Locked: the 60% advance payment hasn&apos;t been verified yet, so ingredient lines
          can&apos;t be edited on this project.
        </p>
      ) : null}
      <IngredientLines
        versionId={version.id}
        // Prisma's Decimal is a class instance, not a plain serializable
        // value — it can't cross the server/client component boundary, so
        // it's stringified here before handing lines to the client form.
        lines={version.ingredientLines.map((line) => ({
          id: line.id,
          materialName: line.materialName,
          rawMaterialId: line.rawMaterialId,
          quantity: line.quantity.toString(),
          unit: line.unit,
          percentage: line.percentage ? line.percentage.toString() : null,
          technicalNotes: line.technicalNotes,
        }))}
        editable={linesEditable}
        rawMaterials={rawMaterials.map((m) => ({
          id: m.id,
          name: m.name,
          defaultUnit: m.defaultUnit,
          supplierName: m.supplier?.name ?? null,
        }))}
      />

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Trials</h2>
      {canEditDraft && !executionUnlocked ? (
        <p style={{ color: "#b00020", fontSize: ".85rem", marginBottom: 8 }}>
          Locked: the 60% advance payment hasn&apos;t been verified yet, so new trials can&apos;t
          be logged on this project.
        </p>
      ) : null}
      <TrialsSection
        versionId={version.id}
        trials={version.trials.map((t) => ({
          id: t.id,
          status: t.status,
          parameters: t.parameters,
          results: t.results,
          conductedById: t.conductedById,
          conductedAt: t.conductedAt.toISOString(),
          attachments: t.attachments,
        }))}
        canCreate={trialsCreatable}
        currentUserId={user.id}
        projectDocuments={projectDocuments.map((d) => ({ id: d.id, type: d.type, createdAt: d.createdAt.toISOString() }))}
      />
    </main>
  );
}
