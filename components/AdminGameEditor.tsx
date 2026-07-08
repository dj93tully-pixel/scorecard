// components/AdminGameEditor.tsx
// Admin editor for one game: name, publish/complete/delete, then the full Setup
// (players, course, money rules). Uses the live useGame hook so edits persist.

"use client";

import { useState } from "react";
import { Trash2, CheckCircle2, RotateCcw, Send, EyeOff } from "lucide-react";
import { useGame } from "@/lib/useGame";
import { setPublished, setCompleted, deleteGame } from "@/lib/games";
import { SetupTab } from "@/components/SetupTab";

export function AdminGameEditor({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const { game, round, loading, error, saveError, updateRound, rename } = useGame(id);
  const [busy, setBusy] = useState(false);

  async function togglePublished() {
    if (!game || busy) return;
    setBusy(true);
    try {
      await setPublished(id, !game.published);
    } finally {
      setBusy(false);
    }
  }

  async function toggleCompleted() {
    if (!game || busy) return;
    setBusy(true);
    try {
      await setCompleted(id, !game.completed);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!game) return;
    if (!window.confirm(`Delete "${game.name}"? This removes it for everyone.`)) return;
    await deleteGame(id);
    onClose();
  }

  if (loading) {
    return (
      <div className="mt-4 space-y-3">
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }
  if (error || !game || !round) {
    return (
      <div className="mt-4 space-y-3 text-center text-text-muted">
        <p>{error ?? "Game not found."}</p>
        <button
          onClick={onClose}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-dark"
        >
          ← Back to admin
        </button>
      </div>
    );
  }

  const statusLabel = game.completed ? "Completed" : game.published ? "Active" : "Draft";

  return (
    <div className="mt-4 animate-fade-in space-y-4">
      <button
        onClick={onClose}
        className="text-sm font-semibold text-accent-on-light"
      >
        ‹ All games
      </button>

      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Offline?</span>
          <span>Changes saved on this device and will sync when you reconnect.</span>
        </div>
      )}

      <div className="rounded-card border border-card-border bg-card-bg p-4">
        <label className="text-sm font-semibold">Game name</label>
        <input
          value={game.name}
          onChange={(e) => rename(e.target.value)}
          className="mt-1 w-full rounded-lg border border-card-border px-3 py-2"
        />

        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-text-muted">Status</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
              game.completed
                ? "bg-surface-2 text-text-muted"
                : game.published
                  ? "bg-pill-bg text-pill-text"
                  : "bg-tint-caution text-text-primary"
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={togglePublished}
            disabled={busy || game.completed}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-on-dark disabled:opacity-40"
          >
            {game.published ? (
              <>
                <EyeOff className="h-4 w-4" /> Unpublish
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Publish
              </>
            )}
          </button>
          <button
            onClick={toggleCompleted}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-card-border py-2 text-sm font-semibold text-accent-on-light disabled:opacity-40"
          >
            {game.completed ? (
              <>
                <RotateCcw className="h-4 w-4" /> Reactivate
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Complete
              </>
            )}
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-card-border py-2 text-sm font-semibold text-negative"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
        {!game.published && !game.completed && (
          <p className="mt-2 text-xs text-text-muted">
            This game is a draft — publish it to show it on the main page.
          </p>
        )}
      </div>

      <SetupTab round={round} updateRound={updateRound} />
    </div>
  );
}
