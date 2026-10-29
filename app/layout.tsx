import type { Metadata } from "next";
import type { ReactNode } from "react";
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

export default function RootLayout({ children }: { children: ReactNode }) {
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
