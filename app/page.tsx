"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, ChevronRight, ChevronDown } from "lucide-react";
import { GameSummary, listGames, subscribeGamesList } from "@/lib/games";
import { supabaseConfigured } from "@/lib/supabase";
import { useHeader } from "@/lib/header-context";

export default function Home() {
  const router = useRouter();
  const { setHeader } = useHeader();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  function refresh() {
    listGames()
      .then(setGames)
      .catch((e) => setError(e?.message ?? "Failed to load games."));
  }

  useEffect(() => {
    if (!supabaseConfigured) return;
    refresh();
    const unsub = subscribeGamesList(refresh);
    return unsub;
  }, []);

  useEffect(() => {
    setHeader({
      rightButton: {
        label: "Admin",
        onClick: () => router.push("/admin"),
        icon: <Settings className="h-4 w-4" />,
      },
    });
    return () => setHeader({});
  }, [router, setHeader]);

  if (!supabaseConfigured) {
    return (
      <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-6 text-sm text-text-muted">
        The games database isn&apos;t configured yet. Add{" "}
        <code className="rounded bg-page-bg px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-page-bg px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your
        environment.
      </div>
    );
  }

  const active = (games ?? []).filter((g) => g.published && !g.completed);
  const completed = (games ?? []).filter((g) => g.completed);

  function GameRow({
    g,
    variant,
  }: {
    g: GameSummary;
    variant: "active" | "completed";
  }) {
    const date = new Date(g.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const meta = [g.courseName, date].filter(Boolean).join(" · ");
    return (
      <li>
        <button
          onClick={() => router.push(`/game/${g.id}`)}
          className="relative flex w-full items-center gap-3 rounded-lg py-3 pr-2 text-left transition-colors hover:bg-[#E7EAF6] active:bg-[#E7EAF6]"
        >
          {/* Left accent rail (inset top/bottom) */}
          <span
            className="absolute bottom-2 left-0 top-2 w-1 rounded-[2px]"
            style={{ background: variant === "active" ? "#354CA1" : "#C4C8CE" }}
          />
          <span className="min-w-0 flex-1 pl-[18px]">
            {/* Line 1: title + status chip */}
            <span className="flex items-center gap-[9px]">
              <span className="truncate text-[17px] font-bold text-[#16181D]">{g.name}</span>
              {variant === "active" ? (
                <span className="flex shrink-0 items-center gap-1">
                  <span
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ background: "#354CA1" }}
                  />
                  <span className="text-[11px] font-bold tracking-[0.03em] text-[#2E4391]">
                    ACTIVE
                  </span>
                </span>
              ) : (
                <span className="shrink-0 text-[11px] font-bold tracking-[0.03em] text-[#9098A4]">
                  FINAL
                </span>
              )}
            </span>
            {/* Line 2: muted meta */}
            <span className="mt-0.5 block truncate text-[14px] text-[#878D96]">{meta}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0" style={{ color: "#C4C8CE" }} />
        </button>
      </li>
    );
  }

  return (
    <div className="mt-4 animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-bold">Games</h2>
        <p className="text-sm text-text-muted">Tap a game to score it.</p>
      </div>

      {error && (
        <p className="rounded-lg bg-tint-bad px-3 py-2 text-sm text-negative">{error}</p>
      )}

      {games === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[68px] w-full rounded-xl" />
          ))}
        </div>
      ) : active.length === 0 && completed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border bg-card-bg p-8 text-center text-sm text-text-muted">
          No games yet. Tap <span className="font-semibold">Admin</span> in the header to
          create and publish one.
        </div>
      ) : (
        <>
          <section className="space-y-1">
            <h3 className="px-[18px] text-[11px] font-bold uppercase tracking-[0.07em] text-text-faint">
              Active
            </h3>
            {active.length === 0 ? (
              <p className="px-[18px] text-sm text-text-faint">No active games.</p>
            ) : (
              <ul>
                {active.map((g) => (
                  <GameRow key={g.id} g={g} variant="active" />
                ))}
              </ul>
            )}
          </section>

          {completed.length > 0 && (
            <section className="space-y-1">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="flex w-full items-center gap-3 py-2"
                aria-expanded={showCompleted}
              >
                <span className="h-px flex-1" style={{ background: "#E1E4E8" }} />
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#9098A4]">
                  {completed.length} Completed
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      showCompleted ? "rotate-180" : ""
                    }`}
                  />
                </span>
                <span className="h-px flex-1" style={{ background: "#E1E4E8" }} />
              </button>
              {showCompleted && (
                <ul>
                  {completed.map((g) => (
                    <GameRow key={g.id} g={g} variant="completed" />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
