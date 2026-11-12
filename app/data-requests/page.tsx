import type { Metadata } from "next";
import { requireUserOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/app/components/shell";
import { DataRequestForm } from "./data-request-form";

export const metadata: Metadata = { title: "Your data" };

const STATUS_LABEL: Record<string, string> = { OPEN: "Pending", FULFILLED: "Fulfilled", DECLINED: "Declined" };

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
// Available to every signed-in role (staff and CLIENT alike) — anyone with
// an account here can ask for their own data or for it to be deleted.
export default async function DataRequestsPage() {
  const user = await requireUserOrRedirect();
  const requests = await prisma.dataSubjectRequest.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
  });

  return (
    <Shell user={user}>
      <h1>Your data</h1>
      <p className="fm-muted">
        You can ask for a copy of the personal data we hold about you, or ask us to delete your account and data.
        See our <a href="/legal/privacy">Privacy Policy</a> for what we collect and how long we keep it. We aim to
        respond within 30 days.
      </p>
      <DataRequestForm />

      <h2 style={{ marginTop: "2rem" }}>Your past requests</h2>
      {requests.length === 0 ? (
        <p className="fm-empty">No requests yet.</p>
      ) : (
        <ul className="fm-li">
          {requests.map((r) => (
            <li key={r.id}>
              {r.type === "EXPORT" ? "Data export" : "Account deletion"} — {STATUS_LABEL[r.status] ?? r.status}
              <span className="fm-li-meta">Requested {r.requestedAt.toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
