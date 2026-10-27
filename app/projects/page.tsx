import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, CLIENT_SAFE_PROJECT_SELECT } from "@/lib/projects/scope";

export default async function ProjectsPage() {
  const user = await requireUserOrRedirect();
  const visible = await getVisibleProjectIds(user);
  const where = visible === "ALL" ? undefined : { id: { in: visible } };

  const projects =
    user.role === "CLIENT"
      ? await prisma.project.findMany({ where, select: CLIENT_SAFE_PROJECT_SELECT })
      : await prisma.project.findMany({
          where,
          select: {
            id: true,
            name: true,
            status: true,
            targetDate: true,
            clientOrg: { select: { name: true } },
            lead: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        });

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 700 }}>
      <h1>Projects</h1>

      {projects.length === 0 ? (
        <p>No projects yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {projects.map((p) => (
            <li key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <Link href={`/projects/${p.id}`}>{p.name}</Link>
              <span style={{ color: "#777", fontSize: ".85rem", marginLeft: 8 }}>
                {p.status}
                {"clientOrg" in p && p.clientOrg ? ` · ${p.clientOrg.name}` : ""}
                {"lead" in p && p.lead ? ` · led by ${p.lead.name}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {user.role === "ADMIN" ? (
        <p style={{ marginTop: 20 }}>
          <Link href="/projects/new">+ New project</Link>
        </p>
      ) : null}
    </main>
  );
}
