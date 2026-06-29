"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, ChevronRight } from "lucide-react";
import { GameSummary, listGames, subscribeGamesList } from "@/lib/games";
import { supabaseConfigured } from "@/lib/supabase";
import { useHeader } from "@/lib/header-context";
import { GAME_TYPES } from "@/lib/gametypes";

export default function Home() {
  const router = useRouter();
  const { setHeader } = useHeader();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  function GameRow({ g }: { g: GameSummary }) {
    return (
      <li
        className={`overflow-hidden rounded-xl border border-l-4 border-card-border bg-card-bg ${
          g.completed ? "border-l-card-border" : "border-l-primary"
        }`}
      >
        <button
          onClick={() => router.push(`/game/${g.id}`)}
          className="flex w-full items-center justify-between gap-2 px-4 py-5 text-left"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold">
              {!g.completed && (
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-alert ring-pulse" />
              )}
              <span className="truncate">{g.name}</span>
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-text-muted">
                {GAME_TYPES[g.gameType].label}
              </span>
            </span>
            {g.courseName && (
              <span className="mt-1 block truncate text-sm text-text-muted">
                {g.courseName}
              </span>
            )}
            <span className="mt-0.5 block text-xs text-text-faint">
              {g.completed ? "Completed · " : ""}
              {new Date(g.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-chevron" />
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
          <section className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
              Active
            </h3>
            {active.length === 0 ? (
              <p className="text-sm text-text-faint">No active games.</p>
            ) : (
              <ul className="space-y-2">
                {active.map((g) => (
                  <GameRow key={g.id} g={g} />
                ))}
              </ul>
            )}
          </section>

          {completed.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
                Completed
              </h3>
              <ul className="space-y-2 opacity-75">
                {completed.map((g) => (
                  <GameRow key={g.id} g={g} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
