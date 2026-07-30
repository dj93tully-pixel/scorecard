"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, ChevronRight, MapPin, Calendar } from "lucide-react";
import { GameSummary, listGames, subscribeGamesList } from "@/lib/games";
import { supabaseConfigured } from "@/lib/supabase";
import { useHeader } from "@/lib/header-context";
import { GAME_TYPES } from "@/lib/gametypes";
import { PillTabs, PillTab } from "@/components/PillTabs";

const TABS: PillTab[] = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

export default function Home() {
  const router = useRouter();
  const { setHeader } = useHeader();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "completed">("active");

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
  const shown = tab === "active" ? active : completed;

  function GameRow({ g }: { g: GameSummary }) {
    return (
      <li
        className="overflow-hidden rounded-xl border bg-white"
        style={{ borderColor: "#E8EBEF" }}
      >
        <button
          onClick={() => router.push(`/game/${g.id}`)}
          className="flex w-full items-center justify-between gap-2 p-3 text-left"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold">
              {!g.completed && (
                <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-alert ring-pulse" />
              )}
              <span className="truncate">{g.name}</span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: "#F1F3F6", color: "#5A6675" }}
              >
                {GAME_TYPES[g.gameType].label}
              </span>
            </span>
            {g.courseName && (
              <span
                className="mt-1 flex items-center gap-1 truncate text-sm"
                style={{ color: "#7A828D" }}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{g.courseName}</span>
              </span>
            )}
            <span
              className="mt-0.5 flex items-center gap-1 text-xs"
              style={{ color: "#9CA3AD" }}
            >
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                {g.completed ? "Completed · " : ""}
                {new Date(g.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </span>
          </span>
          <span
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "#F1F3F6" }}
          >
            <ChevronRight className="h-3.5 w-3.5" style={{ color: "#9098A4" }} />
          </span>
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
        <div>
          <div
            className="sticky z-20 -mx-3 mb-4 bg-page-bg px-3 pb-2 pt-2"
            style={{ top: "var(--header-h, 88px)" }}
          >
            <PillTabs
              tabs={TABS}
              activeId={tab}
              onChange={(t) => setTab(t as "active" | "completed")}
              ariaLabel="Game views"
            />
          </div>

          {shown.length === 0 ? (
            <p className="text-sm text-text-faint">
              {tab === "active" ? "No active games." : "No completed games yet."}
            </p>
          ) : (
            <ul className="animate-fade-in space-y-2">
              {shown.map((g) => (
                <GameRow key={g.id} g={g} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
