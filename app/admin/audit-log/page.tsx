import Link from "next/link";
import type { Metadata } from "next";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/app/components/shell";

export const metadata: Metadata = { title: "Audit Log" };

const PAGE_SIZE = 50;

function buildHref(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) qs.set(key, value);
  }
  const query = qs.toString();
  return query ? `/admin/audit-log?${query}` : "/admin/audit-log";
}

// Admin-only, read-only — mirrors the API route's filters (baseline §10:
// append-only, no edit/delete UI anywhere for this data). Filters are
// plain GET query params so a filtered view is a shareable/bookmarkable
// URL, not client-side state.
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { actorId?: string; targetType?: string; targetId?: string; action?: string; page?: string };
}) {
  const user = await requireRoleOrRedirect(["ADMIN"]);

  const actorId = searchParams.actorId || undefined;
  const targetType = searchParams.targetType || undefined;
  const targetId = searchParams.targetId || undefined;
  const action = searchParams.action || undefined;
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);

  const where = {
    ...(actorId ? { actorId } : {}),
    ...(targetType ? { targetType } : {}),
    ...(targetId ? { targetId } : {}),
    ...(action ? { action: { contains: action } } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterParams = { actorId, targetType, targetId, action };

  return (
    <Shell user={user}>
      <h1>Audit log</h1>
      <p style={{ color: "#555" }}>
        Admin-only, read-only — every sensitive action in the app writes here and nothing ever edits or deletes
        a row. {total} entr{total === 1 ? "y" : "ies"}
        {Object.values(filterParams).some(Boolean) ? " matching these filters" : ""}.
      </p>

      <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0" }}>
        <input name="actorId" placeholder="Actor ID" defaultValue={actorId ?? ""} style={{ padding: 6 }} />
        <input name="targetType" placeholder="Target type (e.g. Invoice)" defaultValue={targetType ?? ""} style={{ padding: 6 }} />
        <input name="targetId" placeholder="Target ID" defaultValue={targetId ?? ""} style={{ padding: 6 }} />
        <input name="action" placeholder="Action contains…" defaultValue={action ?? ""} style={{ padding: 6 }} />
        <button type="submit" style={{ padding: "6px 14px" }}>
          Filter
        </button>
        {Object.values(filterParams).some(Boolean) ? (
          <Link href="/admin/audit-log" style={{ alignSelf: "center" }}>
            Clear
          </Link>
        ) : null}
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th style={{ padding: "6px 8px" }}>When</th>
            <th style={{ padding: "6px 8px" }}>Actor</th>
            <th style={{ padding: "6px 8px" }}>Action</th>
            <th style={{ padding: "6px 8px" }}>Target</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: "16px 8px", color: "#888" }}>
                No audit entries match.
              </td>
            </tr>
          ) : (
            entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString()}</td>
                <td style={{ padding: "6px 8px" }}>
                  {e.actor.name} <span style={{ color: "#888" }}>({e.actor.email})</span>
                </td>
                <td style={{ padding: "6px 8px" }}>{e.action}</td>
                <td style={{ padding: "6px 8px" }}>
                  {e.targetType} <span style={{ color: "#888" }}>{e.targetId}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
        {page > 1 ? (
          <Link href={buildHref(filterParams, { page: String(page - 1) })}>&larr; Newer</Link>
        ) : (
          <span style={{ color: "#bbb" }}>&larr; Newer</span>
        )}
        <span style={{ color: "#555", fontSize: ".85rem" }}>
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link href={buildHref(filterParams, { page: String(page + 1) })}>Older &rarr;</Link>
        ) : (
          <span style={{ color: "#bbb" }}>Older &rarr;</span>
        )}
      </div>
    </Shell>
  );
}
