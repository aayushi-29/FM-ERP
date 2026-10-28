import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="fm-landing">
      <section className="fm-landing-hero glass glass-strong glass-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Food Monk Innovations" width={76} height={76} className="fm-landing-logo" />
        <h1>Run every project the way you&apos;d plate it — with care.</h1>
        <p className="fm-landing-sub">
          Food Monk ERP keeps clients, projects, formulations, trials, and invoicing
          in one place — scoped to exactly what each person on your team is meant to see.
        </p>
        <div className="fm-landing-actions">
          <Link href={user ? "/dashboard" : "/login"} className="fm-btn">
            {user ? "Go to your dashboard" : "Sign in"}
          </Link>
        </div>
      </section>

      <section className="fm-landing-grid">
        <div className="glass glass-sm glass-card">
          <h3>Client &amp; project tracking</h3>
          <p className="fm-muted">Leads through delivery — tasks, milestones, documents, and who&apos;s assigned.</p>
        </div>
        <div className="glass glass-sm glass-card">
          <h3>Formulation &amp; trials</h3>
          <p className="fm-muted">Draft, submit, approve, and trial every version with a full decision history.</p>
        </div>
        <div className="glass glass-sm glass-card">
          <h3>Costing &amp; invoicing</h3>
          <p className="fm-muted">Cost sheets, expenses, and invoices — visible to the right role, nothing more.</p>
        </div>
      </section>
    </main>
  );
}
