import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { SignOutButton } from "@/app/dashboard/sign-out-button";
import { NotificationBell } from "./notification-bell";
import { NavLinks } from "./nav-links";

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
  // 29 Oct 2026: dedicated Client Portal page (baseline §11) — confirmed
  // with the user, replacing the dashboard as the Client's primary landing
  // view, same as a company user's "Leads"/"Clients" links above.
  if (role === "CLIENT") {
    links.push({ href: "/portal", label: "Portal" });
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

          <NavLinks links={links} />

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
