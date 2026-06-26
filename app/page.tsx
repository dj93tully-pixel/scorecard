"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
      <li className="flex items-center gap-2 rounded-xl border border-card-border bg-card-bg">
        <button
          onClick={() => router.push(`/game/${g.id}`)}
          className="flex flex-1 items-center justify-between gap-2 px-4 py-4 text-left"
        >
          <span>
            <span className="block font-semibold">{g.name}</span>
            <span className="block text-xs text-text-muted">
              {new Date(g.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </span>
          <span className="text-chevron">›</span>
        </button>
        {admin && (
          <div className="flex shrink-0 items-center gap-1 pr-2">
            <button
              onClick={() => handleComplete(g.id, !g.completed)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-accent-on-light"
            >
              {g.completed ? "Reactivate" : "Complete"}
            </button>
            <button
              onClick={() => handleDelete(g.id, g.name)}
              className="rounded-md px-2 py-1 text-xs font-semibold text-negative"
            >
              Delete
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="mt-4 space-y-6">
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
            className="shrink-0 rounded-lg bg-primary px-4 py-2.5 font-semibold text-on-dark disabled:opacity-50"
          >
            {creating ? "…" : "+ Create"}
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-lg bg-[#FDECEF] px-3 py-2 text-sm text-negative">{error}</p>
      )}

      {games === null ? (
        <p className="py-10 text-center text-text-muted">Loading…</p>
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
