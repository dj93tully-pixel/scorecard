// components/PillTabs.tsx
// Reusable ESPN-style segmented pill tab bar. Controlled component.
//
// VISUAL: a pill "track" (#EEF0F3) holding equal-width tabs; the active tab is a
// lifted white pill (#2E4391 text, soft shadow). Optional per-tab badge.
// A11y: role=tablist/tab, aria-selected, ←/→ arrow navigation, Enter/Space.

"use client";

import { useRef, KeyboardEvent } from "react";

export interface PillTab {
  id: string;
  label: string;
  badge?: number | string;
}

export function PillTabs({
  tabs,
  activeId,
  onChange,
  className = "",
  ariaLabel = "Views",
}: {
  tabs: PillTab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = (index + dir + tabs.length) % tabs.length;
      refs.current[next]?.focus();
      onChange(tabs[next].id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(tabs[index].id);
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`mx-auto flex w-full max-w-[480px] gap-[2px] rounded-full bg-divider p-[5px] ${className}`}
    >
      {tabs.map((t, i) => {
        const isActive = t.id === activeId;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            style={{
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.12)" : undefined,
            }}
            className={`relative flex-1 rounded-full py-[9px] text-[15px] font-medium transition-all duration-150 ${
              isActive
                ? "bg-white text-accent-on-light"
                : "bg-transparent text-text-faint"
            }`}
          >
            {t.label}
            {t.badge != null && t.badge !== "" && (
              <span className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[10px] font-bold leading-none text-on-dark">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
