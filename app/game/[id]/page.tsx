"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { computeRound } from "@/lib/wolf";
import { useGame } from "@/lib/useGame";
import { setCompleted, deleteGame } from "@/lib/games";
import { useHeader } from "@/lib/header-context";
import { liveSummary } from "@/lib/live";
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

  const computation = useMemo(() => (round ? computeRound(round) : null), [round]);
  const ticker = useMemo(
    () => (round && computation ? liveSummary(round, computation) : null),
    [round, computation]
  );

  // Drive the global header: game name (inline-editable) + back + admin + ticker.
  useEffect(() => {
    setHeader({
      title: game?.name ?? "",
      onTitleChange: rename,
      backHref: "/",
      admin: { active: admin, onToggle: () => setAdmin((v) => !v) },
      ticker,
    });
    return () => setHeader({});
  }, [game?.name, admin, ticker, rename, setHeader]);

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
    return (
      <div className="mt-4 space-y-3">
        <div className="skeleton h-12 w-full rounded-full" />
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
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
      <div className="mt-4 animate-fade-in space-y-4">
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
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-card-border py-2 text-sm font-semibold text-accent-on-light"
            >
              {game.completed ? (
                <>
                  <RotateCcw className="h-4 w-4" /> Reactivate
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Mark completed
                </>
              )}
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg border border-card-border px-4 py-2 text-sm font-semibold text-negative"
            >
              <Trash2 className="h-4 w-4" /> Delete
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
      <div key={tab} className="animate-fade-in">
        {tab === "scores" && (
          <ScoresTab round={round} computation={computation} upsertEntry={upsertEntry} />
        )}
        {tab === "card" && <CardTab round={round} computation={computation} />}
      </div>
    </div>
  );
}
