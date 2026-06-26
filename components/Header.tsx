// components/Header.tsx
// Global NBC broadcast header: brand + current game name on the left, back +
// one action button on the right, a live ticker strip beneath, and the
// NBC-peacock gradient line under it all.

"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { WolfLogo } from "./WolfLogo";
import { useHeader } from "@/lib/header-context";

export function Header() {
  const router = useRouter();
  const { config } = useHeader();
  const ticker = config.ticker;

  return (
    <header className="safe-top sticky top-0 z-30 bg-header-bg text-on-dark">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <WolfLogo className="h-8 w-8 shrink-0 text-accent-on-dark" />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="text-lg font-bold uppercase tracking-[0.18em]">WOLF</h1>
          {config.title ? (
            <p className="truncate text-[12px] text-text-muted">{config.title}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {config.backHref && (
            <button
              onClick={() => router.push(config.backHref!)}
              className="flex items-center gap-1 rounded-lg bg-avatar-bg px-2.5 py-1.5 text-sm font-semibold text-on-dark"
            >
              <ChevronLeft className="h-4 w-4" />
              Games
            </button>
          )}
          {config.rightButton && (
            <button
              onClick={config.rightButton.onClick}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
                config.rightButton.primary
                  ? "bg-primary text-on-dark"
                  : "bg-avatar-bg text-on-dark"
              }`}
            >
              {config.rightButton.icon}
              {config.rightButton.label}
            </button>
          )}
        </div>
      </div>

      {/* Live ticker strip */}
      {ticker && (
        <div className="bg-ticker-bg">
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-1.5">
            <span
              className={`h-[6px] w-[6px] shrink-0 rounded-full ${
                ticker.live ? "bg-alert ring-pulse" : "bg-text-muted"
              }`}
            />
            <span className="shrink-0 text-[12px] font-semibold text-on-dark">
              {ticker.primary}
            </span>
            {ticker.meta && (
              <span className="truncate text-[12px] text-text-muted">{ticker.meta}</span>
            )}
          </div>
        </div>
      )}

      {/* NBC peacock line */}
      <div className="h-[3px] w-full bg-signature-gradient" />
    </header>
  );
}
