import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isExecutionUnlocked } from "@/lib/projects/execution-gate";
import { NewProductForm } from "./new-product-form";

// Client is excluded from this page entirely (baseline §4: Products/
// Formulations have no Client row at all — their only NPD visibility is a
// single approved formulation version's summary, reached via a link shared
// elsewhere, not this listing).
export default async function ProductsPage({ params }: { params: { id: string } }) {
  const user = await requireUserOrRedirect();
  if (user.role === "CLIENT") redirect("/forbidden");
  await assertProjectAccessOrRedirect(user, params.id);

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const products = await prisma.product.findMany({
    where: { projectId: params.id },
    select: { id: true, name: true, createdAt: true, _count: { select: { formulations: true } } },
    orderBy: { createdAt: "desc" },
  });

  const executionUnlocked = await isExecutionUnlocked(params.id);
  const canCreate = (user.role === "ADMIN" || user.role === "NPD_EXECUTIVE") && executionUnlocked;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 700 }}>
      <p style={{ marginBottom: 4 }}>
        <Link href={`/projects/${project.id}`}>← {project.name}</Link>
      </p>
      <h1>Products</h1>
      {!executionUnlocked && (user.role === "ADMIN" || user.role === "NPD_EXECUTIVE") ? (
        <p style={{ color: "#b00020", fontSize: ".85rem" }}>
          Locked: the 60% advance payment hasn&apos;t been verified yet, so nothing can start on
          this project — no new products, formulations, or ingredient lines.
        </p>
      ) : null}

      {products.length === 0 ? (
        <p style={{ color: "#777" }}>No products yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {products.map((p) => (
            <li key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <Link href={`/products/${p.id}`}>{p.name}</Link>
              <span style={{ color: "#777", fontSize: ".85rem" }}>
                {" · "}{p._count.formulations} formulation{p._count.formulations === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <div style={{ marginTop: 16 }}>
          <NewProductForm projectId={project.id} />
        </div>
      ) : null}
    </main>
  );
}
