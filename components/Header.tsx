// components/Header.tsx
// Global broadcast header: brand + current game name on the left, back +
// one action button on the right, and the NBC-peacock gradient line under it.

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { HackerTrackerMark } from "./HackerTrackerMark";
import { useHeader } from "@/lib/header-context";

export function Header() {
  const router = useRouter();
  const { config } = useHeader();
  const isAdmin = config.variant === "admin";
  const headerRef = useRef<HTMLElement>(null);

  // Expose the live header height so in-page tab bars can stick right below it.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header
      ref={headerRef}
      className="safe-top sticky top-0 z-30 bg-header-bg text-on-dark"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <HackerTrackerMark size={32} className="shrink-0" />
          <div className="min-w-0 flex-1 leading-tight">
            <h1 className="truncate text-lg font-bold uppercase tracking-tight">
              {config.title ? (
                <span style={isAdmin ? { color: "#F5B33F" } : undefined}>{config.title}</span>
              ) : (
                <>
                  <span style={{ color: "#F0A824" }}>HACKER</span>
                  <span style={{ color: "#FFC24D" }}>TRACKER</span>
                </>
              )}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(config.backHref || config.backOnClick) && (
            <button
              onClick={() =>
                config.backOnClick ? config.backOnClick() : router.push(config.backHref!)
              }
              className="flex items-center gap-1 rounded-lg bg-avatar-bg px-2.5 py-1.5 text-sm font-semibold text-on-dark"
            >
              <ChevronLeft className="h-4 w-4" />
              Games
            </button>
          )}
          {config.rightButton && (
            <button
              onClick={config.rightButton.onClick}
              className="flex items-center gap-1 rounded-lg bg-avatar-bg px-2.5 py-1.5 text-sm font-semibold text-on-dark"
            >
              {config.rightButton.icon}
              {config.rightButton.label}
            </button>
          )}
        </div>
      </div>

      {/* NBC peacock line */}
      <div className="h-[3px] w-full bg-signature-gradient" />
    </header>
  );
}
