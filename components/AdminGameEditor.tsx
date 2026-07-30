// components/AdminGameEditor.tsx
// Game settings for one game: name, Active/Complete status, delete, then the full
// Setup (players, course, money rules). Uses the live useGame hook so edits persist.

"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useGame } from "@/lib/useGame";
import { setCompleted, deleteGame } from "@/lib/games";
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

  async function changeStatus(completed: boolean) {
    if (!game || busy || completed === game.completed) return;
    setBusy(true);
    try {
      await setCompleted(id, completed);
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
          ← Back to games
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 animate-fade-in space-y-4">
      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">Offline?</span>
          <span>Changes saved on this device and will sync when you reconnect.</span>
        </div>
      )}

      <div className="rounded-xl border border-card-border bg-card-bg p-4">
        <label className="text-sm font-semibold">Game name</label>
        <input
          value={game.name}
          onChange={(e) => rename(e.target.value)}
          className="mt-1 w-full rounded-lg border border-card-border px-3 py-2"
        />

        <label className="mt-3 block text-sm font-semibold">Status</label>
        <div className="mt-1 flex items-center gap-2">
          <select
            value={game.completed ? "complete" : "active"}
            onChange={(e) => changeStatus(e.target.value === "complete")}
            disabled={busy}
            className="flex-1 rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            <option value="active">Active</option>
            <option value="complete">Complete</option>
          </select>
          <button
            onClick={handleDelete}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-negative"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      <SetupTab round={round} updateRound={updateRound} />
    </div>
  );
}
