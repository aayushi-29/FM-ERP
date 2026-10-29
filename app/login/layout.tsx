import type { Metadata } from "next";
import type { ReactNode } from "react";

// app/login/page.tsx is a "use client" component, which can't export
// `metadata` itself (that export only works in a Server Component) — this
// layout gives the route its tab title without changing the page.
export const metadata: Metadata = { title: "Sign In" };

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
