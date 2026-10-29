"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string };

// Pulled out of Shell (a Server Component) because highlighting the active
// link needs the current pathname, and usePathname() only works in a
// Client Component.
export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="fm-shell-links" aria-label="Primary">
      {links.map((l) => {
        // Dashboard only lights up on an exact match (every other route
        // starts with "/"); everything else also lights up for its own
        // sub-pages, e.g. "/projects/abc123/documents" keeps "Projects"
        // highlighted.
        const isActive = pathname === l.href || (l.href !== "/dashboard" && pathname?.startsWith(`${l.href}/`));
        return (
          <Link key={l.href} href={l.href} aria-current={isActive ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
