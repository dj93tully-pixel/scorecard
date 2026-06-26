import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { HeaderProvider } from "@/lib/header-context";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Wolf",
  description: "Track scores, pops, and the Wolf money game live on the course.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0C0C0E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen bg-page-bg">
        <HeaderProvider>
          <Header />
          <main className="mx-auto max-w-2xl px-3 pb-16">{children}</main>
        </HeaderProvider>
      </body>
    </html>
  );
}
