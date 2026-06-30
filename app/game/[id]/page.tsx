"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { computeRound } from "@/lib/wolf";
import { useGame } from "@/lib/useGame";
import { useHeader } from "@/lib/header-context";
import { liveSummary, genericSummary } from "@/lib/live";
import { computeGame, gameTypeOf } from "@/lib/gametypes";
import { buildResults } from "@/lib/results";
import { ScoresTab } from "@/components/ScoresTab";
import { ResultsView } from "@/components/ResultsView";
import { ScoreEntryTab } from "@/components/ScoreEntryTab";
import { FieldHammerScores } from "@/components/fieldhammer/FieldHammerScores";
import { PillTabs, PillTab } from "@/components/PillTabs";

export default function GamePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { game, round, loading, error, upsertEntry } = useGame(id);
  const { setHeader } = useHeader();
  const [tab, setTab] = useState<"scores" | "card">("scores");

  // Remember each tab's own scroll position so switching tabs starts at that
  // tab's top by default, but returning to a tab you'd scrolled restores it.
  const scrollByTab = useRef<Record<string, number>>({ scores: 0, card: 0 });
  function switchTab(next: "scores" | "card") {
    if (next === tab) return;
    scrollByTab.current[tab] = window.scrollY; // save the outgoing tab
    setTab(next);
  }
  useLayoutEffect(() => {
    window.scrollTo(0, scrollByTab.current[tab] ?? 0); // restore the incoming tab
  }, [tab]);

  const isWolf = round ? gameTypeOf(round) === "wolf" : true;
  const isFieldHammer = round ? gameTypeOf(round) === "fieldhammer" : false;
  // Wolf uses its own engine + bespoke tabs; the other types share the generic
  // ScoreEntryTab / StandingsView driven by computeGame.
  const computation = useMemo(
    () => (round && isWolf ? computeRound(round) : null),
    [round, isWolf]
  );
  const gameResult = useMemo(
    () => (round && !isWolf ? computeGame(round) : null),
    [round, isWolf]
  );
  const ticker = useMemo(() => {
    if (!round) return null;
    if (isWolf && computation) return liveSummary(round, computation);
    if (!isWolf && gameResult) return genericSummary(round);
    return null;
  }, [round, isWolf, computation, gameResult]);

  // Read-only results for the Card tab's interactive page: per player, per hole,
  // split by bet type. Re-reads the engines — changes no settlement logic.
  const results = useMemo(() => (round ? buildResults(round) : null), [round]);

  const tabs: PillTab[] = [
    { id: "scores", label: "Score" },
    { id: "card", label: "Cards" },
  ];

  // Drive the global header: game name + back + ticker. Editing lives only in
  // the Admin section (reached from the main page), not here.
  useEffect(() => {
    setHeader({
      title: game?.name ?? "",
      backHref: "/",
      ticker,
    });
    return () => setHeader({});
  }, [game?.name, ticker, setHeader]);

  if (loading) {
    return (
      <div className="mt-4 space-y-3">
        <div className="skeleton h-12 w-full rounded-full" />
        <div className="skeleton h-40 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }
  if (error || !game || !round) {
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
      <div
        className="sticky z-20 -mx-3 mb-4 bg-page-bg px-3 pb-2 pt-2"
        style={{ top: "var(--header-h, 88px)" }}
      >
        <PillTabs
          tabs={tabs}
          activeId={tab}
          onChange={(t) => switchTab(t as "scores" | "card")}
          ariaLabel="Game views"
        />
      </div>
      <div key={tab} className="animate-fade-in">
        {tab === "scores" &&
          (isWolf && computation ? (
            <ScoresTab round={round} computation={computation} upsertEntry={upsertEntry} />
          ) : isFieldHammer ? (
            <FieldHammerScores round={round} upsertEntry={upsertEntry} />
          ) : (
            <ScoreEntryTab round={round} upsertEntry={upsertEntry} />
          ))}
        {tab === "card" && results && <ResultsView results={results} />}
      </div>
    </div>
  );
}
