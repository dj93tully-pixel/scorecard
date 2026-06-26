"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { computeRound } from "@/lib/wolf";
import { useGame } from "@/lib/useGame";
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
  const [tab, setTab] = useState<"scores" | "card">("scores");
  const [admin, setAdmin] = useState(false);

  const computation = useMemo(() => (round ? computeRound(round) : null), [round]);

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

  return (
    <div>
      {/* Game header */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={() => router.push("/")}
          className="text-sm font-semibold text-accent-on-light"
        >
          ‹ Games
        </button>
        <span className="truncate text-sm font-bold">{game.name}</span>
        <button
          onClick={() => setAdmin((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
            admin ? "bg-primary text-on-dark" : "bg-card-bg text-accent-on-light border border-card-border"
          }`}
        >
          {admin ? "Done" : "⚙ Admin"}
        </button>
      </div>

      {admin ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-card-border bg-card-bg p-4">
            <label className="text-sm font-semibold">Game name</label>
            <input
              value={game.name}
              onChange={(e) => rename(e.target.value)}
              className="mt-1 w-full rounded-lg border border-card-border px-3 py-2"
            />
          </div>
          <SetupTab round={round} updateRound={updateRound} />
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
