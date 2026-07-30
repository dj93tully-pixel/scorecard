// components/Header.tsx
// Global NBC broadcast header: brand + current game name on the left, back +
// one action button on the right, a live ticker strip beneath, and the
// NBC-peacock gradient line under it all.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { HackerTrackerMark } from "./HackerTrackerMark";
import { useHeader } from "@/lib/header-context";

// Ticker meta text — continuously scrolls in one direction, but only when it's
// wider than the available space. Uses two copies + a -50% loop so it wraps
// seamlessly. flex/items-center keeps it vertically aligned with "Hole N".
const GAP = 40; // px gap between the looping copies

function TickerMeta({ text }: { text: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [contentW, setContentW] = useState(0);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    function measure() {
      const box = boxRef.current;
      const span = textRef.current;
      if (!box || !span) return;
      const w = span.scrollWidth; // margin excluded → clean text width
      setContentW(w);
      setOverflow(w > box.clientWidth + 4);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [text]);

  const duration = Math.max(8, (contentW + GAP) / 35); // ~35 px/sec

  return (
    <div ref={boxRef} className="relative ml-1 flex min-w-0 flex-1 items-center overflow-hidden">
      <div
        className="flex shrink-0 whitespace-nowrap"
        style={
          overflow ? { animation: `marquee-loop ${duration}s linear infinite` } : undefined
        }
      >
        <span
          ref={textRef}
          className="text-[12px] text-text-muted"
          style={overflow ? { marginRight: GAP } : undefined}
        >
          {text}
        </span>
        {overflow && (
          <span aria-hidden className="text-[12px] text-text-muted" style={{ marginRight: GAP }}>
            {text}
          </span>
        )}
      </div>
    </div>
  );
}

export function Header() {
  const router = useRouter();
  const { config } = useHeader();
  const ticker = config.ticker;
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
      className={`safe-top sticky top-0 z-30 text-on-dark ${isAdmin ? "bg-[#1E1608]" : "bg-header-bg"}`}
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
                  <span style={{ color: "#FFFFFF" }}>HACKER</span>
                  <span style={{ color: "#20EBA0" }}>TRACKER</span>
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
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-1">
            <span
              className={`h-[6px] w-[6px] shrink-0 rounded-full ${
                ticker.live ? "bg-alert ring-pulse" : "bg-text-muted"
              }`}
            />
            <span className="shrink-0 text-[12px] font-semibold text-on-dark">
              {ticker.primary}
            </span>
            {ticker.meta && <TickerMeta text={ticker.meta} />}
          </div>
        </div>
      )}

      {/* NBC peacock line */}
      <div className="h-[3px] w-full bg-signature-gradient" />
    </header>
  );
}
