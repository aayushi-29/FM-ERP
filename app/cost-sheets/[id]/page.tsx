import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { canReadCosting } from "@/lib/costing/scope";

export default async function CostSheetDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUserOrRedirect();
  if (!canReadCosting(user.role)) redirect("/forbidden");

  const costSheet = await prisma.costSheet.findUnique({
    where: { id: params.id },
    include: {
      formulationVersion: { select: { versionNumber: true, formulation: { select: { name: true } } } },
      createdBy: { select: { name: true } },
      supersedes: { select: { id: true, createdAt: true, costPerUnit: true } },
      supersededBy: { select: { id: true, createdAt: true, costPerUnit: true } },
    },
  });
  if (!costSheet) notFound();

  await assertProjectAccessOrRedirect(user, costSheet.projectId);

  const rows: [string, string][] = [
    ["Price basis", costSheet.priceBasis],
    ["Ingredient cost", `${costSheet.ingredientCost.toString()} ${costSheet.currency}`],
    ["Yield %", costSheet.yieldPercent.toString()],
    ["Wastage %", costSheet.wastagePercent.toString()],
    ["Packaging", `${costSheet.packagingCost.toString()} ${costSheet.currency}`],
    ["Processing", `${costSheet.processingCost.toString()} ${costSheet.currency}`],
    ["Labour", `${costSheet.labourCost.toString()} ${costSheet.currency}`],
    ["Testing", `${costSheet.testingCost.toString()} ${costSheet.currency}`],
    ["Overhead", `${costSheet.overheadCost.toString()} ${costSheet.currency}`],
    ["Units per batch", costSheet.batchSizeUnits.toString()],
  ];

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <p style={{ marginBottom: 4 }}>
        <Link href={`/projects/${costSheet.projectId}/costing`}>← Costing &amp; Invoicing</Link>
      </p>
      <h1>{costSheet.formulationVersion.formulation.name} v{costSheet.formulationVersion.versionNumber}</h1>
      <p style={{ color: "#555" }}>
        Prepared by {costSheet.createdBy.name} on {new Date(costSheet.createdAt).toLocaleDateString()}
      </p>

      <div style={{ background: "#f7f7f7", padding: 14, borderRadius: 8, margin: "16px 0" }}>
        <p style={{ margin: 0, fontSize: "1.1rem" }}>
          <strong>{costSheet.costPerUnit.toString()} {costSheet.currency}</strong> / unit
        </p>
        <p style={{ margin: "2px 0 0", color: "#555" }}>
          {costSheet.costPerBatch.toString()} {costSheet.currency} per batch
        </p>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px 4px", color: "#555" }}>{label}</td>
              <td style={{ padding: "6px 4px" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {costSheet.notes ? (
        <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
          <strong>Notes: </strong>{costSheet.notes}
        </p>
      ) : null}

      {costSheet.supersedes ? (
        <p style={{ marginTop: 12, fontSize: ".88rem" }}>
          Recalculated from <Link href={`/cost-sheets/${costSheet.supersedes.id}`}>
            {costSheet.supersedes.costPerUnit.toString()} {costSheet.currency}/unit ({new Date(costSheet.supersedes.createdAt).toLocaleDateString()})
          </Link>
        </p>
      ) : null}
      {costSheet.supersededBy.length > 0 ? (
        <p style={{ marginTop: 4, fontSize: ".88rem" }}>
          Superseded by <Link href={`/cost-sheets/${costSheet.supersededBy[0]!.id}`}>
            {costSheet.supersededBy[0]!.costPerUnit.toString()} {costSheet.currency}/unit
          </Link>
        </p>
      ) : null}
    </main>
  );
}
