import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { SignOutButton } from "@/app/dashboard/sign-out-button";
import { NotificationBell } from "./notification-bell";

const ROLE_LABEL: Record<SessionUser["role"], string> = {
  ADMIN: "Admin",
  PROJECT_LEAD: "Project Lead",
  NPD_EXECUTIVE: "NPD Executive",
  CLIENT: "Client",
};

type NavLink = { href: string; label: string };

function linksForRole(role: SessionUser["role"]): NavLink[] {
  const links: NavLink[] = [{ href: "/dashboard", label: "Dashboard" }];
  if (role === "ADMIN" || role === "PROJECT_LEAD") {
    links.push({ href: "/leads", label: "Leads" }, { href: "/clients", label: "Clients" });
  }
  links.push({ href: "/projects", label: "Projects" });
  if (role === "ADMIN" || role === "PROJECT_LEAD" || role === "NPD_EXECUTIVE") {
    links.push({ href: "/raw-materials", label: "Materials" });
  }
  if (role === "ADMIN") {
    links.push({ href: "/admin/users", label: "Users" }, { href: "/admin/audit-log", label: "Audit log" });
  }
  return links;
}

export function Shell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const links = linksForRole(user.role);

  return (
    <>
      <header className="fm-shell-nav glass glass-sm" role="banner">
        <div className="fm-shell-nav-inner">
          <Link href="/dashboard" className="fm-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Food Monk Innovations" width={34} height={34} />
            <span>Food Monk ERP</span>
          </Link>

          <nav className="fm-shell-links" aria-label="Primary">
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="fm-shell-user">
            <NotificationBell />
            <div className="fm-shell-user-id">
              <span className="fm-shell-name">{user.name}</span>
              <span className="fm-badge fm-badge-gold">{ROLE_LABEL[user.role]}</span>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="fm-shell-main">{children}</main>
    </>
  );
}
