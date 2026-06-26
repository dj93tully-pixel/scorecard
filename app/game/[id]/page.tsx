"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { computeRound } from "@/lib/wolf";
import { useGame } from "@/lib/useGame";
import { useHeader } from "@/lib/header-context";
import { liveSummary } from "@/lib/live";
import { ScoresTab } from "@/components/ScoresTab";
import { CardTab } from "@/components/CardTab";
import { PillTabs, PillTab } from "@/components/PillTabs";

const TABS: PillTab[] = [
  { id: "scores", label: "Scores" },
  { id: "card", label: "Card" },
];

export default function GamePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { game, round, loading, error, upsertEntry } = useGame(id);
  const { setHeader } = useHeader();
  const [tab, setTab] = useState<"scores" | "card">("scores");

  const computation = useMemo(() => (round ? computeRound(round) : null), [round]);
  const ticker = useMemo(
    () => (round && computation ? liveSummary(round, computation) : null),
    [round, computation]
  );

  // Drive the global header: game name + back + ticker + Edit (→ admin).
  useEffect(() => {
    setHeader({
      title: game?.name ?? "",
      backHref: "/",
      ticker,
      rightButton: {
        label: "Edit",
        onClick: () => router.push(`/admin?edit=${id}`),
        icon: <Settings className="h-4 w-4" />,
      },
    });
    return () => setHeader({});
  }, [game?.name, ticker, id, router, setHeader]);

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

  return (
    <div>
      <div className="mb-4 pt-3">
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
