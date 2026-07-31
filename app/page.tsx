"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings, MapPin, Calendar } from "lucide-react";
import {
  GameSummary,
  listGames,
  createGame,
  subscribeGamesList,
} from "@/lib/games";
import { supabaseConfigured } from "@/lib/supabase";
import { useHeader } from "@/lib/header-context";
import { GAME_TYPES, GAME_TYPE_LIST } from "@/lib/gametypes";
import { GameTypeId } from "@/lib/wolf";
import { PillTabs, PillTab } from "@/components/PillTabs";
import { AdminGameEditor } from "@/components/AdminGameEditor";

const TABS: PillTab[] = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

// Empty state: a large light-gray duplex-scope (matching the logo mark) with a
// watermark-style "No active / games" centered inside the reticle.
function NoGamesScope() {
  const GRAY = "#C4C8CE";
  return (
    <div className="flex flex-col items-center justify-center py-14 animate-fade-in">
      <div className="relative" style={{ width: 168, height: 168 }}>
        <svg viewBox="0 0 100 100" width="168" height="168" role="img" aria-label="No active games">
          <g stroke={GRAY} strokeLinecap="round" fill="none">
            <circle cx="50" cy="50" r="33" strokeWidth="2.2" />
            <line x1="50" y1="5" x2="50" y2="17" strokeWidth="3" />
            <line x1="50" y1="83" x2="50" y2="95" strokeWidth="3" />
            <line x1="5" y1="50" x2="17" y2="50" strokeWidth="3" />
            <line x1="83" y1="50" x2="95" y2="50" strokeWidth="3" />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
          <span className="font-bold" style={{ color: GRAY, fontSize: 13 }}>No active</span>
          <span className="font-bold" style={{ color: GRAY, fontSize: 13 }}>games</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { setHeader } = useHeader();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // Whenever the games list is showing (on mount, and on Back from the editor/picker
  // — which are in-page views, not routes, so the component never remounts), start at
  // the top rather than wherever the previous view was scrolled. Runs before paint so
  // there's no flash of the restored scroll position.
  useLayoutEffect(() => {
    if (!editingId && !picking) window.scrollTo(0, 0);
  }, [editingId, picking]);

  function refresh() {
    listGames()
      .then(setGames)
      .catch((e) => setError(e?.message ?? "Failed to load games."));
  }

  async function startGame(type: GameTypeId) {
    try {
      const id = await createGame("", type);
      setPicking(false);
      setEditingId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create game.");
    }
  }

  useEffect(() => {
    if (!supabaseConfigured) return;
    refresh();
    const unsub = subscribeGamesList(refresh);
    const edit = new URLSearchParams(window.location.search).get("edit");
    if (edit) setEditingId(edit);
    return unsub;
  }, []);

  // Header: a New-game button on the list. While picking a type or editing a game
  // (the management flow) the chrome warms to the "admin" variant + a title, so it
  // reads as a distinct mode from the games list and from scoring.
  useEffect(() => {
    const inFlow = editingId || picking;
    setHeader({
      title: editingId ? "Game Settings" : picking ? "New game" : undefined,
      variant: inFlow ? "admin" : undefined,
      backOnClick: inFlow
        ? () => {
            setEditingId(null);
            setPicking(false);
            refresh();
          }
        : undefined,
      rightButton: inFlow
        ? undefined
        : {
            label: "New game",
            icon: <Plus className="h-4 w-4" />,
            primary: true,
            onClick: () => setPicking(true),
          },
    });
    return () => setHeader({});
  }, [editingId, picking, setHeader]);

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

  if (editingId) {
    return (
      <AdminGameEditor
        id={editingId}
        onClose={() => {
          setEditingId(null);
          refresh();
        }}
      />
    );
  }

  if (picking) {
    return (
      <div className="mt-4 animate-fade-in space-y-3">
        <h2 className="text-xl font-bold">Pick a game</h2>
        {error && (
          <p className="rounded-lg bg-tint-bad px-3 py-2 text-sm text-negative">{error}</p>
        )}
        <ul className="space-y-2">
          {GAME_TYPE_LIST.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => startGame(t.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block font-bold">{t.label}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">{t.blurb}</span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-text-muted">
                  {t.players.min === t.players.max
                    ? `${t.players.max}p`
                    : `${t.players.min}–${t.players.max}p`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // The list is the owner's hub now, so it shows drafts (unpublished) too.
  const active = (games ?? []).filter((g) => !g.completed);
  const completed = (games ?? []).filter((g) => g.completed);
  const shown = tab === "active" ? active : completed;

  function GameRow({ g }: { g: GameSummary }) {
    return (
      <li
        className="relative overflow-hidden rounded-xl border bg-white"
        style={{ borderColor: "#E8EBEF" }}
      >
        {/* Tap the card to score the game */}
        <button
          onClick={() => router.push(`/game/${g.id}`)}
          className="flex w-full items-center p-3 pr-10 text-left"
        >
          <span className="min-w-0 flex-1">
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
        </button>
        {/* Small gear in the top-right corner — opens Game Settings */}
        <button
          onClick={() => setEditingId(g.id)}
          aria-label={`Game settings for ${g.name}`}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-text-muted active:bg-surface-2"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </li>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
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
        <NoGamesScope />
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
            tab === "active" ? (
              <NoGamesScope />
            ) : (
              <p className="text-sm text-text-faint">No completed games yet.</p>
            )
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
