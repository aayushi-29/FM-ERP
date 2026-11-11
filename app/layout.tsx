import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import "./globals.css";
import { GlassCursorEffect } from "./components/glass-cursor-effect";
import { CommandPalette } from "./components/command-palette";

export const metadata: Metadata = {
  title: {
    default: "Food Monk ERP",
    // Every route below sets its own short `title` (or computes one via
    // generateMetadata for a record's name) — this template is what turns
    // that into a distinct browser-tab title instead of every page reading
    // the same "Food Monk ERP".
    template: "%s · Food Monk ERP",
  },
  description: "Client, project, and NPD workflow management for Food Monk Innovations",
  icons: { icon: "/logo.png" },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading headers() here is what makes this (and therefore every route
  // under it) opt into dynamic rendering instead of being prerendered as
  // static HTML. That's required for the nonce-based CSP in middleware.ts:
  // a nonce is only valid for a single request, and a statically
  // prerendered page bakes its HTML (and whatever nonce was current at
  // build time) once, so a fresh per-request nonce can never match it.
  // Without this, Next.js can't tag its own inline hydration scripts with
  // the right nonce on static routes — e.g. /login was being prerendered
  // and every inline script on it kept getting blocked by the CSP.
  await headers();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="fm-backdrop" aria-hidden="true">
          <div className="fm-backdrop-blob-3" />
        </div>
        <GlassCursorEffect />
        {children}
        <CommandPalette />
      </body>
    </html>
  );
}
