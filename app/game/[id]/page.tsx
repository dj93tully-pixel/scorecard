"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { computeRound } from "@/lib/wolf";
import { useGame } from "@/lib/useGame";
import { setCompleted, deleteGame } from "@/lib/games";
import { useHeader } from "@/lib/header-context";
import { ScoresTab } from "@/components/ScoresTab";
import { CardTab } from "@/components/CardTab";
import { SetupTab } from "@/components/SetupTab";
import { PillTabs, PillTab } from "@/components/PillTabs";

const TABS: PillTab[] = [
  { id: "scores", label: "Scores" },
  { id: "card", label: "Card" },
];

export default function GamePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { game, round, loading, error, updateRound, upsertEntry, rename } = useGame(id);
  const { setHeader } = useHeader();
  const [tab, setTab] = useState<"scores" | "card">("scores");
  const [admin, setAdmin] = useState(false);

  // Drive the global header: game name + back + admin toggle.
  useEffect(() => {
    setHeader({
      title: game?.name ?? "",
      backHref: "/",
      admin: { active: admin, onToggle: () => setAdmin((v) => !v) },
    });
    return () => setHeader({});
  }, [game?.name, admin, setHeader]);

  const computation = useMemo(() => (round ? computeRound(round) : null), [round]);

  async function handleComplete() {
    if (!game) return;
    try {
      await setCompleted(id, !game.completed);
    } catch {
      /* realtime will reconcile */
    }
  }

  async function handleDelete() {
    if (!game) return;
    if (!window.confirm(`Delete "${game.name}"? This removes its scores for everyone.`)) return;
    try {
      await deleteGame(id);
      router.push("/");
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-text-muted">Loading game…</div>;
  }
  if (error || !game || !round || !computation) {
    return (
      <div className="mt-6 space-y-4 text-center">
        <p className="text-text-muted">{error ?? "Game not found."}</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-dark"
        >
          ← Back to games
        </button>
      </div>
    );
  }

  if (admin) {
    return (
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <label className="text-sm font-semibold">Game name</label>
          <input
            value={game.name}
            onChange={(e) => rename(e.target.value)}
            className="mt-1 w-full rounded-lg border border-card-border px-3 py-2"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleComplete}
              className="flex-1 rounded-lg border border-card-border py-2 text-sm font-semibold text-accent-on-light"
            >
              {game.completed ? "Reactivate game" : "Mark completed"}
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-negative"
            >
              Delete
            </button>
          </div>
        </div>
        <SetupTab round={round} updateRound={updateRound} />
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-3 mb-4 bg-page-bg px-3 py-3">
        <PillTabs
          tabs={TABS}
          activeId={tab}
          onChange={(t) => setTab(t as "scores" | "card")}
          ariaLabel="Game views"
        />
      </div>
      {tab === "scores" && (
        <ScoresTab round={round} computation={computation} upsertEntry={upsertEntry} />
      )}
      {tab === "card" && <CardTab round={round} computation={computation} />}
    </div>
  );
}
