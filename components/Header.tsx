// components/Header.tsx
// Global NBC broadcast header: brand on the left, inline-editable game name,
// back + admin on the right, a live ticker strip beneath, and the NBC-peacock
// gradient line under it all.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings, Pencil, Check } from "lucide-react";
import { WolfLogo } from "./WolfLogo";
import { useHeader } from "@/lib/header-context";

export function Header() {
  const router = useRouter();
  const { config } = useHeader();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // Keep the draft in sync with the incoming title when not actively editing.
  useEffect(() => {
    if (!editing) setDraft(config.title ?? "");
  }, [config.title, editing]);

  function commitName() {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== config.title) config.onTitleChange?.(name);
  }

  const ticker = config.ticker;

  return (
    <header className="safe-top bg-header-bg text-on-dark">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <WolfLogo className="h-8 w-8 shrink-0 text-accent-on-dark" />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="text-lg font-bold uppercase tracking-[0.18em]">WOLF</h1>
          {config.title ? (
            config.onTitleChange ? (
              editing ? (
                <span className="mt-0.5 flex items-center gap-1">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitName();
                      if (e.key === "Escape") {
                        setDraft(config.title ?? "");
                        setEditing(false);
                      }
                    }}
                    className="min-w-0 flex-1 rounded bg-avatar-bg px-1.5 py-0.5 text-[12px] text-on-dark outline-none"
                  />
                  <button onClick={commitName} aria-label="Save name">
                    <Check className="h-3.5 w-3.5 text-accent-on-dark" />
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="editable-name mt-0.5 flex max-w-full items-center gap-1 text-[12px] text-text-muted"
                >
                  <span className="truncate">{config.title}</span>
                  <Pencil className="edit-pencil h-3 w-3 shrink-0" />
                </button>
              )
            ) : (
              <p className="truncate text-[12px] text-text-muted">{config.title}</p>
            )
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
          {config.admin && (
            <button
              onClick={config.admin.onToggle}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold ${
                config.admin.active ? "bg-primary text-on-dark" : "bg-avatar-bg text-on-dark"
              }`}
            >
              <Settings className="h-4 w-4" />
              {config.admin.active ? "Done" : "Admin"}
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
