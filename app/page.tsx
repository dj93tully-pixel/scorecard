"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CheckCircle2, RotateCcw, ChevronRight } from "lucide-react";
import {
  GameSummary,
  listGames,
  createGame,
  deleteGame,
  setCompleted,
  subscribeGamesList,
} from "@/lib/games";
import { supabaseConfigured } from "@/lib/supabase";
import { useHeader } from "@/lib/header-context";

export default function Home() {
  const router = useRouter();
  const { setHeader } = useHeader();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [admin, setAdmin] = useState(false);

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

  // Register the header's Admin toggle (no back button on the home page).
  useEffect(() => {
    setHeader({ admin: { active: admin, onToggle: () => setAdmin((v) => !v) } });
    return () => setHeader({});
  }, [admin, setHeader]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createGame(newName);
      setNewName("");
      router.push(`/game/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create game.");
      setCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This removes its scores for everyone.`)) return;
    try {
      await deleteGame(id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete game.");
    }
  }

  async function handleComplete(id: string, completed: boolean) {
    try {
      await setCompleted(id, completed);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update game.");
    }
  }

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

  const active = (games ?? []).filter((g) => !g.completed);
  const completed = (games ?? []).filter((g) => g.completed);

  function GameRow({ g }: { g: GameSummary }) {
    return (
      <li
        className={`flex items-center gap-2 overflow-hidden rounded-xl border border-card-border bg-card-bg border-l-4 ${
          g.completed ? "border-l-card-border" : "border-l-primary"
        }`}
      >
        <button
          onClick={() => router.push(`/game/${g.id}`)}
          className="flex flex-1 items-center justify-between gap-2 px-4 py-4 text-left"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold">
              {!g.completed && (
                <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-alert ring-pulse" />
              )}
              <span className="truncate">{g.name}</span>
            </span>
            <span className="mt-0.5 block text-xs text-text-muted">
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
        {admin && (
          <div className="flex shrink-0 items-center gap-1 pr-2">
            <button
              onClick={() => handleComplete(g.id, !g.completed)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-accent-on-light"
            >
              {g.completed ? (
                <RotateCcw className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {g.completed ? "Reactivate" : "Complete"}
            </button>
            <button
              onClick={() => handleDelete(g.id, g.name)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-negative"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="mt-4 animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-bold">Games</h2>
        <p className="text-sm text-text-muted">
          {admin
            ? "Admin: create, complete, or delete games."
            : "Tap a game to open it. Anyone with the link can edit."}
        </p>
      </div>

      {/* Create (admin only) */}
      {admin && (
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New game name (e.g. Saturday at Pebble)"
            className="min-w-0 flex-1 rounded-lg border border-card-border px-3 py-2.5"
          />
          <button
            type="submit"
            disabled={creating}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-4 py-2.5 font-semibold text-on-dark disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {creating ? "…" : "Create"}
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-lg bg-tint-bad px-3 py-2 text-sm text-negative">{error}</p>
      )}

      {games === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[68px] w-full rounded-xl" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border bg-card-bg p-8 text-center text-sm text-text-muted">
          No games yet. Tap <span className="font-semibold">⚙ Admin</span> in the header to
          create one.
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
