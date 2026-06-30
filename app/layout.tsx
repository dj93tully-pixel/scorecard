import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { HeaderProvider } from "@/lib/header-context";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "HACKERTRACKER",
  description: "Track scores, pops, and golf money games live on the course.",
  appleWebApp: {
    capable: true,
    title: "HACKERTRACKER",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
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
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      {/* Body is the dark chrome color so the iPhone safe-area (notch / status bar)
          above the header reads dark, not white. The light page background lives
          on <main>, not the body. */}
      <body className="flex min-h-screen flex-col bg-header-bg">
        <HeaderProvider>
          <Header />
          <main className="flex-1 bg-page-bg">
            <div className="mx-auto max-w-2xl px-3 pb-16">{children}</div>
          </main>
        </HeaderProvider>
      </body>
    </html>
  );
}
