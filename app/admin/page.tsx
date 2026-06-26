"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight } from "lucide-react";
import {
  GameSummary,
  listGames,
  createGame,
  subscribeGamesList,
} from "@/lib/games";
import { supabaseConfigured } from "@/lib/supabase";
import { useHeader } from "@/lib/header-context";
import { AdminGameEditor } from "@/components/AdminGameEditor";

export default function AdminPage() {
  const router = useRouter();
  const { setHeader } = useHeader();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
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
    // Deep link from a game's "Edit" button: /admin?edit=<id>
    const edit = new URLSearchParams(window.location.search).get("edit");
    if (edit) setEditingId(edit);
    return unsub;
  }, []);

  useEffect(() => {
    setHeader({ title: "Admin", backHref: "/" });
    return () => setHeader({});
  }, [setHeader]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const id = await createGame(newName);
      setNewName("");
      setEditingId(id); // jump straight into configuring + publishing it
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create game.");
    } finally {
      setCreating(false);
    }
  }

  if (!supabaseConfigured) {
    return (
      <div className="mt-6 rounded-xl border border-card-border bg-card-bg p-6 text-sm text-text-muted">
        The games database isn&apos;t configured yet.
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

  const drafts = (games ?? []).filter((g) => !g.published && !g.completed);
  const active = (games ?? []).filter((g) => g.published && !g.completed);
  const completed = (games ?? []).filter((g) => g.completed);

  function Group({
    title,
    items,
    tone,
  }: {
    title: string;
    items: GameSummary[];
    tone: "draft" | "active" | "completed";
  }) {
    if (items.length === 0) return null;
    const chip =
      tone === "active"
        ? "bg-pill-bg text-pill-text"
        : tone === "draft"
          ? "bg-tint-caution text-text-primary"
          : "bg-surface-2 text-text-muted";
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">
          {title}
        </h3>
        <ul className="space-y-2">
          {items.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => setEditingId(g.id)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{g.name}</span>
                  <span className="mt-0.5 inline-flex items-center gap-2 text-xs text-text-muted">
                    <span className={`rounded-full px-2 py-0.5 font-bold ${chip}`}>
                      {tone === "active" ? "Active" : tone === "draft" ? "Draft" : "Completed"}
                    </span>
                    {new Date(g.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-chevron" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="mt-4 animate-fade-in space-y-6">
      <div>
        <h2 className="text-xl font-bold">Admin</h2>
        <p className="text-sm text-text-muted">
          Create a game, set its rules, then publish it to the main page.
        </p>
      </div>

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
          {creating ? "…" : "New game"}
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-tint-bad px-3 py-2 text-sm text-negative">{error}</p>
      )}

      {games === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[60px] w-full rounded-xl" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border bg-card-bg p-8 text-center text-sm text-text-muted">
          No games yet. Create one above.
        </div>
      ) : (
        <>
          <Group title="Drafts" items={drafts} tone="draft" />
          <Group title="Active" items={active} tone="active" />
          <Group title="Completed" items={completed} tone="completed" />
        </>
      )}
    </div>
  );
}
