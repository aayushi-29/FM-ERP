import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/app/components/shell";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const formulation = await prisma.formulation.findUnique({ where: { id: params.id }, select: { name: true } });
  return { title: formulation?.name ?? "Formulation" };
}

export default async function FormulationDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUserOrRedirect();
  if (user.role === "CLIENT") redirect("/forbidden");

  const formulation = await prisma.formulation.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      product: { select: { id: true, name: true, projectId: true } },
      versions: {
        select: { id: true, versionNumber: true, status: true, createdAt: true, decidedAt: true },
        orderBy: { versionNumber: "desc" },
      },
    },
  });
  if (!formulation) notFound();

  await assertProjectAccessOrRedirect(user, formulation.product.projectId);

  return (
    <Shell user={user}>
      <p style={{ marginBottom: 4 }}>
        <Link href={`/products/${formulation.product.id}`}>← {formulation.product.name}</Link>
      </p>
      <h1>{formulation.name}</h1>

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Versions</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {formulation.versions.map((v) => (
          <li key={v.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <Link href={`/formulation-versions/${v.id}`}>v{v.versionNumber}</Link>
            <span style={{ color: "#777", fontSize: ".85rem" }}>
              {" · "}{v.status}
              {v.decidedAt ? ` · decided ${new Date(v.decidedAt).toLocaleDateString()}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
