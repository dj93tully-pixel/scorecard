"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GameSummary,
  listGames,
  createGame,
  deleteGame,
  subscribeGamesList,
} from "@/lib/games";
import { supabaseConfigured } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

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

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Games</h2>
        <p className="text-sm text-text-muted">
          Anyone with the link can open a game and edit it.
        </p>
      </div>

      {/* Create (admin) */}
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
          {creating ? "…" : "+ New"}
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-[#FDECEF] px-3 py-2 text-sm text-negative">{error}</p>
      )}

      {/* Games list */}
      {games === null ? (
        <p className="py-10 text-center text-text-muted">Loading…</p>
      ) : games.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border bg-card-bg p-8 text-center text-sm text-text-muted">
          No games yet. Create one above to get started.
        </div>
      ) : (
        <ul className="space-y-2">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg"
            >
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
              <button
                onClick={() => handleDelete(g.id, g.name)}
                className="px-3 py-4 text-sm font-semibold text-negative"
                aria-label={`Delete ${g.name}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
