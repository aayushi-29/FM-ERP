import type { Metadata } from "next";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/app/components/shell";
import { ResolveRequestForm } from "./resolve-request-form";

export const metadata: Metadata = { title: "Data requests" };

const TYPE_LABEL: Record<string, string> = { EXPORT: "Data export", DELETE: "Account deletion" };
const STATUS_LABEL: Record<string, string> = { OPEN: "Pending", FULFILLED: "Fulfilled", DECLINED: "Declined" };

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
// Admin-only queue of data subject requests (app/data-requests/page.tsx is
// where users file them). Fulfilling an EXPORT or DELETE request is a
// manual action outside this app (pull the records, send them; deactivate
// or anonymize the account) — this page only records that it was done,
// same "deny-by-default, nothing happens automatically" posture as the
// rest of the app.
export default async function AdminDataRequestsPage() {
  const user = await requireRoleOrRedirect(["ADMIN"]);
  const requests = await prisma.dataSubjectRequest.findMany({
    include: { user: { select: { name: true, email: true } }, resolvedBy: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
  });

  return (
    <Shell user={user}>
      <h1>Data requests</h1>
      <p className="fm-muted">
        Requests from users to receive a copy of, or delete, their personal data. Fulfilling a request (sending
        the export, deleting/anonymizing the account) happens outside this page — use this to record that it was
        done.
      </p>
      {requests.length === 0 ? (
        <p className="fm-empty">No data requests yet.</p>
      ) : (
        <table className="fm-table">
          <thead>
            <tr>
              <th>From</th>
              <th>Type</th>
              <th>Requested</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.user.name}
                  <span className="fm-li-meta">{r.user.email}</span>
                  {r.note ? <span className="fm-li-meta">&ldquo;{r.note}&rdquo;</span> : null}
                </td>
                <td>{TYPE_LABEL[r.type] ?? r.type}</td>
                <td>{r.requestedAt.toLocaleDateString()}</td>
                <td>
                  {STATUS_LABEL[r.status] ?? r.status}
                  {r.resolvedBy ? <span className="fm-li-meta">by {r.resolvedBy.name}</span> : null}
                </td>
                <td>{r.status === "OPEN" ? <ResolveRequestForm id={r.id} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
