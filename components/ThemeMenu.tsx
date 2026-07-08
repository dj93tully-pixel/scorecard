// components/ThemeMenu.tsx
// The HACKERTRACKER header brand doubles as a theme switcher. The logo mark +
// wordmark (+ a small caret) is a button that opens a dropdown listing the
// available themes (from lib/themes.ts). Selecting one applies it immediately
// (data-theme on <html>) and persists it to localStorage. Presentation only —
// nothing here touches game state.

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { HackerTrackerMark } from "./HackerTrackerMark";
import {
  THEMES,
  DEFAULT_THEME_ID,
  THEME_STORAGE_KEY,
  normalizeThemeId,
} from "@/lib/themes";

function applyTheme(id: string) {
  const theme = normalizeThemeId(id);
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage can throw in private mode — the in-memory theme still applies.
  }
}

export function ThemeMenu({ title }: { title?: string }) {
  const [open, setOpen] = useState(false);
  // SSR renders the default; sync to the real (inline-script-applied) theme
  // after mount so the checkmark matches without a hydration mismatch.
  const [active, setActive] = useState(DEFAULT_THEME_ID);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setActive(normalizeThemeId(document.documentElement.getAttribute("data-theme")));
  }, []);

  // Close on outside click / Esc; focus the active item when opening.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const activeIdx = Math.max(0, THEMES.findIndex((t) => t.id === active));
    itemRefs.current[activeIdx]?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, active]);

  const select = (id: string) => {
    applyTheme(id);
    setActive(normalizeThemeId(id));
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Arrow-key navigation between menu items.
  const onItemKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      itemRefs.current[(idx + 1) % THEMES.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      itemRefs.current[(idx - 1 + THEMES.length) % THEMES.length]?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-1 items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="HACKERTRACKER — change theme"
        className="flex min-w-0 flex-1 items-center gap-1 text-left"
      >
        <HackerTrackerMark size={32} className="shrink-0" />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-lg font-bold uppercase tracking-tight">
            {title ? (
              <span>{title}</span>
            ) : (
              <>
                <span style={{ color: "var(--wm-primary)" }}>HACKER</span>
                <span style={{ color: "var(--wm-accent)" }}>TRACKER</span>
              </>
            )}
          </h1>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-on-dark/70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          className="absolute left-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-xl border border-card-border bg-card-bg py-1 text-text-primary shadow-lg"
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Theme
          </div>
          {THEMES.map((t, idx) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => select(t.id)}
                onKeyDown={(e) => onItemKey(e, idx)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
              >
                <span>{t.label}</span>
                {isActive && <Check className="h-4 w-4 text-primary" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
