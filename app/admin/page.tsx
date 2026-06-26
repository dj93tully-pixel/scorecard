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
import { PillTabs, PillTab } from "@/components/PillTabs";

const TABS: PillTab[] = [
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

export default function AdminPage() {
  const router = useRouter();
  const { setHeader } = useHeader();
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "completed">("active");
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
    const edit = new URLSearchParams(window.location.search).get("edit");
    if (edit) setEditingId(edit);
    return unsub;
  }, []);

  // Header: New-game button (creates a draft and opens its editor). Hidden while editing.
  useEffect(() => {
    setHeader({
      title: editingId ? "Edit game" : "Admin",
      backHref: "/",
      rightButton: editingId
        ? undefined
        : {
            label: "New game",
            icon: <Plus className="h-4 w-4" />,
            primary: true,
            onClick: async () => {
              try {
                const id = await createGame("");
                setEditingId(id);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not create game.");
              }
            },
          },
    });
    return () => setHeader({});
  }, [editingId, setHeader]);

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

  // Active tab keeps drafts + published-active; completed tab is its own.
  const activeGames = (games ?? []).filter((g) => !g.completed);
  const completedGames = (games ?? []).filter((g) => g.completed);
  const shown = tab === "active" ? activeGames : completedGames;

  function Row({ g }: { g: GameSummary }) {
    const status = g.completed ? "Completed" : g.published ? "Active" : "Draft";
    const chip = g.completed
      ? "bg-surface-2 text-text-muted"
      : g.published
        ? "bg-pill-bg text-pill-text"
        : "bg-tint-caution text-text-primary";
    return (
      <li>
        <button
          onClick={() => setEditingId(g.id)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-card-border bg-card-bg px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold">{g.name}</span>
            <span className="mt-0.5 inline-flex items-center gap-2 text-xs text-text-muted">
              <span className={`rounded-full px-2 py-0.5 font-bold ${chip}`}>{status}</span>
              {new Date(g.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-chevron" />
        </button>
      </li>
    );
  }

  return (
    <div>
      <div className="mb-4 pt-3">
        <PillTabs
          tabs={TABS}
          activeId={tab}
          onChange={(t) => setTab(t as "active" | "completed")}
          ariaLabel="Admin views"
        />
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-tint-bad px-3 py-2 text-sm text-negative">{error}</p>
      )}

      {games === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-[60px] w-full rounded-xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border bg-card-bg p-8 text-center text-sm text-text-muted">
          {tab === "active"
            ? "No active games. Tap New game in the header to create one."
            : "No completed games yet."}
        </div>
      ) : (
        <ul className="animate-fade-in space-y-2">
          {shown.map((g) => (
            <Row key={g.id} g={g} />
          ))}
        </ul>
      )}
    </div>
  );
}
