// components/Header.tsx
// The global dark app header. Brand on the left; the current game name sits in
// the secondary slot; back + admin buttons live on the right (set by pages via
// the header context).

"use client";

import { useRouter } from "next/navigation";
import { WolfLogo } from "./WolfLogo";
import { useHeader } from "@/lib/header-context";

export function Header() {
  const router = useRouter();
  const { config } = useHeader();

  return (
    <header className="bg-header-bg text-on-dark">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <WolfLogo className="h-8 w-8 shrink-0 text-accent-on-dark" />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="text-lg font-bold tracking-wide">WOLF</h1>
          {config.title ? (
            <p className="truncate text-[12px] text-text-muted">{config.title}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {config.backHref && (
            <button
              onClick={() => router.push(config.backHref!)}
              className="rounded-lg bg-avatar-bg px-3 py-1.5 text-sm font-semibold text-on-dark"
            >
              ‹ Games
            </button>
          )}
          {config.admin && (
            <button
              onClick={config.admin.onToggle}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                config.admin.active
                  ? "bg-primary text-on-dark"
                  : "bg-avatar-bg text-on-dark"
              }`}
            >
              {config.admin.active ? "Done" : "⚙ Admin"}
            </button>
          )}
        </div>
      </div>
      <div className="h-1 w-full bg-signature-gradient" />
    </header>
  );
}
