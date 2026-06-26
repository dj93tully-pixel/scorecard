// components/Header.tsx
// Global NBC broadcast header: brand + current game name on the left, back +
// one action button on the right, a live ticker strip beneath, and the
// NBC-peacock gradient line under it all.

"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { WolfLogo } from "./WolfLogo";
import { useHeader } from "@/lib/header-context";

// Ticker meta text — scrolls (ping-pong) only when it's wider than the space.
function TickerMeta({ text }: { text: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    function measure() {
      const box = boxRef.current;
      const span = textRef.current;
      if (!box || !span) return;
      const over = span.scrollWidth - box.clientWidth;
      setShift(over > 4 ? over : 0);
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (boxRef.current) ro.observe(boxRef.current);
    if (textRef.current) ro.observe(textRef.current);
    return () => ro.disconnect();
  }, [text]);

  const animating = shift > 0;
  const duration = Math.max(5, shift / 22);
  const style: CSSProperties | undefined = animating
    ? ({
        "--marquee-shift": `-${shift}px`,
        animation: `marquee ${duration}s ease-in-out infinite alternate`,
      } as CSSProperties)
    : undefined;

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1 overflow-hidden">
      <span
        ref={textRef}
        style={style}
        className="inline-block whitespace-nowrap text-[12px] text-text-muted"
      >
        {text}
      </span>
    </div>
  );
}

export function Header() {
  const router = useRouter();
  const { config } = useHeader();
  const ticker = config.ticker;
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
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
        <WolfLogo className="h-7 w-7 shrink-0 text-accent-on-dark" />
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
