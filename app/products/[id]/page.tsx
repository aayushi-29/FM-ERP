import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { isExecutionUnlocked } from "@/lib/projects/execution-gate";
import { NewFormulationForm } from "./new-formulation-form";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUserOrRedirect();
  if (user.role === "CLIENT") redirect("/forbidden");

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      projectId: true,
      project: { select: { name: true } },
      formulations: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          versions: {
            select: { id: true, versionNumber: true, status: true },
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!product) notFound();

  await assertProjectAccessOrRedirect(user, product.projectId);

  const executionUnlocked = await isExecutionUnlocked(product.projectId);
  const canCreate = (user.role === "ADMIN" || user.role === "NPD_EXECUTIVE") && executionUnlocked;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 700 }}>
      <p style={{ marginBottom: 4 }}>
        <Link href={`/projects/${product.projectId}/products`}>← {product.project.name} products</Link>
      </p>
      <h1>{product.name}</h1>
      {!executionUnlocked && (user.role === "ADMIN" || user.role === "NPD_EXECUTIVE") ? (
        <p style={{ color: "#b00020", fontSize: ".85rem" }}>
          Locked: the 60% advance payment hasn&apos;t been verified yet, so no new formulations
          can be drafted on this project.
        </p>
      ) : null}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Formulations</h2>
      {product.formulations.length === 0 ? (
        <p style={{ color: "#777" }}>No formulations yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {product.formulations.map((f) => {
            const latest = f.versions[0];
            return (
              <li key={f.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
                <Link href={`/formulations/${f.id}`}>{f.name}</Link>
                {latest ? (
                  <span style={{ color: "#777", fontSize: ".85rem" }}>
                    {" · v"}{latest.versionNumber} · {latest.status}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canCreate ? (
        <div style={{ marginTop: 16 }}>
          <NewFormulationForm productId={product.id} />
        </div>
      ) : null}
    </main>
  );
}
