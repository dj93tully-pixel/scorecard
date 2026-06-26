import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WolfLogo } from "@/components/WolfLogo";

export const metadata: Metadata = {
  title: "Wolf — Golf Scorecard & Money Game",
  description: "Track scores, pops, and the Wolf money game live on the course.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0E1C",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page-bg">
        <header className="bg-header-bg text-on-dark">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            <WolfLogo className="h-8 w-8 text-accent-on-dark" />
            <div className="leading-tight">
              <h1 className="text-lg font-bold tracking-wide">WOLF</h1>
              <p className="text-[11px] uppercase tracking-widest text-text-muted">
                Scorecard &amp; Money Game
              </p>
            </div>
          </div>
          {/* Signature gradient strip */}
          <div className="h-1 w-full bg-signature-gradient" />
        </header>
        <main className="mx-auto max-w-2xl px-3 pb-28 pt-4">{children}</main>
      </body>
    </html>
  );
}
