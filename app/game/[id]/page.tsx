"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Round, computeRound } from "@/lib/wolf";
import { useGame } from "@/lib/useGame";
import { useHeader } from "@/lib/header-context";
import { liveSummary, genericSummary } from "@/lib/live";
import { computeGame, computeBaseGame, gameTypeOf } from "@/lib/gametypes";
import {
  computePressMoney,
  decomposePresses,
  hasAnyPress,
  listPresses,
  pressSubRound,
  RunResult,
} from "@/lib/engines/press";
import { nassauPressLedger } from "@/lib/engines/nassau";
import { ScoresTab } from "@/components/ScoresTab";
import { CardTab, CardComputation, PressViews } from "@/components/CardTab";
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

  // Both engines feed the same Card view (standings + ledger + scorecard + the
  // by-hole summary). For Wolf we synthesize each hole's note from its result.
  const cardComp: CardComputation | null = useMemo(() => {
    if (isWolf && computation && round) {
      // Fold press money (re-run Wolf over each press's holes) into the ledger.
      const press = computePressMoney(round, (r) => computeRound(r).ledger);
      const ledger: Record<string, number> = {};
      const stats: Record<string, Record<string, number>> = {};
      for (const id of Object.keys(computation.ledger)) {
        const original = computation.ledger[id] ?? 0;
        const pr = press[id] ?? 0;
        ledger[id] = original + pr;
        stats[id] = { original, press: pr };
      }
      return {
        ledger,
        pops: computation.pops,
        stats,
        results: computation.results.map((r) => ({
          hole: r.hole,
          deltas: r.deltas,
          decided: r.winner !== "push",
          detail:
            r.winner !== "push"
              ? ""
              : r.teamABest === null || r.teamBBest === null
                ? "—"
                : r.carriedToNext > 0
                  ? `Push — $${r.carriedToNext} carries`
                  : "Push",
        })),
      };
    }
    if (!isWolf && gameResult) {
      return {
        ledger: gameResult.ledger,
        pops: gameResult.pops,
        results: gameResult.holeResults,
        stats: gameResult.stats,
      };
    }
    return null;
  }, [isWolf, computation, gameResult, round]);

  // Once a press is in play, split the Card tab into original / press / total
  // money views (same card format, different ledger). null = no presses.
  const cardViews: PressViews | undefined = useMemo(() => {
    if (!round || !hasAnyPress(round)) return undefined;
    const gt = gameTypeOf(round);
    if (gt === "elevens") return undefined;
    const ids = round.players.map((p) => p.id);

    const makeViews = (
      base: RunResult,
      press: RunResult,
      pops: Record<string, Record<number, number>>,
      stats?: Record<string, Record<string, number | string>>
    ): PressViews => {
      const totalLedger: Record<string, number> = {};
      for (const pid of ids)
        totalLedger[pid] = (base.ledger[pid] ?? 0) + (press.ledger[pid] ?? 0);
      const pressByHole = new Map(press.holeResults.map((r) => [r.hole, r.deltas]));
      const totalResults = base.holeResults.map((hr) => {
        const pr = pressByHole.get(hr.hole) ?? {};
        const deltas: Record<string, number> = {};
        for (const pid of ids) deltas[pid] = (hr.deltas[pid] ?? 0) + (pr[pid] ?? 0);
        return {
          hole: hr.hole,
          deltas,
          decided: ids.some((pid) => deltas[pid] !== 0),
          detail: hr.detail,
        };
      });
      return {
        original: { ledger: base.ledger, pops, results: base.holeResults, stats },
        press: { ledger: press.ledger, pops, results: press.holeResults, stats },
        total: { ledger: totalLedger, pops, results: totalResults, stats },
      };
    };

    // Nassau settles its own presses; split via its stats (no per-hole money).
    if (gt === "nassau" && gameResult) {
      const zeroHoles = round.course.holes.map((h) => ({
        hole: h.number,
        deltas: Object.fromEntries(ids.map((id) => [id, 0])),
        decided: false,
        detail: "",
      }));
      const ledgerFrom = (key: string) =>
        Object.fromEntries(
          ids.map((id) => [id, Number(gameResult.stats[id]?.[key] ?? 0)])
        );
      const pops = gameResult.pops;
      const stats = gameResult.stats;
      return {
        original: { ledger: ledgerFrom("original"), pops, results: zeroHoles, stats },
        press: { ledger: ledgerFrom("press"), pops, results: zeroHoles, stats },
        total: { ledger: gameResult.ledger, pops, results: zeroHoles, stats },
      };
    }

    // Wolf: re-run computeRound over each press's holes.
    if (isWolf && computation) {
      const run = (r: Round): RunResult => {
        const c = computeRound(r);
        return {
          ledger: c.ledger,
          holeResults: c.results.map((rr) => ({
            hole: rr.hole,
            deltas: rr.deltas,
            decided: rr.winner !== "push",
            detail: rr.winner !== "push" ? "" : "Push",
          })),
        };
      };
      const { base, press } = decomposePresses(round, run);
      return makeViews(base, press, computation.pops);
    }

    // Other per-hole games: re-run the raw engine over each press's holes.
    if (gameResult) {
      const run = (r: Round): RunResult => {
        const g = computeBaseGame(r);
        return { ledger: g.ledger, holeResults: g.holeResults };
      };
      const { base, press } = decomposePresses(round, run);
      return makeViews(base, press, gameResult.pops, gameResult.stats);
    }

    return undefined;
  }, [round, isWolf, computation, gameResult]);

  // Trendline data: the total money (base + press) as it would settle after each
  // played hole, in hole order — for the Card tab's bottom trendline.
  const cardTrend = useMemo(() => {
    if (!round) return [];
    const holes = round.course.holes;
    const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
    const scored = (n: number) => {
      const e = entryByHole.get(n);
      return !!e && round.players.some((p) => typeof e.grossScores[p.id] === "number");
    };
    let lastIdx = -1;
    holes.forEach((h, i) => {
      if (scored(h.number)) lastIdx = i;
    });
    const out: Record<string, number>[] = [];
    for (let i = 0; i <= lastIdx; i++) {
      const upTo = new Set(holes.slice(0, i + 1).map((h) => h.number));
      const prefix: Round = { ...round, entries: round.entries.filter((e) => upTo.has(e.hole)) };
      if (isWolf) {
        const base = computeRound(prefix).ledger;
        const press = computePressMoney(prefix, (r) => computeRound(r).ledger);
        const ledger: Record<string, number> = {};
        for (const id of Object.keys(base)) ledger[id] = (base[id] ?? 0) + (press[id] ?? 0);
        out.push(ledger);
      } else {
        out.push(computeGame(prefix).ledger);
      }
    }
    return out;
  }, [round, isWolf]);

  // Per-press breakdown for the Card tab's Press view (one line per press).
  const pressList = useMemo(() => {
    if (!round || !hasAnyPress(round)) return [];
    const single =
      gameTypeOf(round) === "nassau"
        ? (holes: Set<number>) => nassauPressLedger(round, holes)
        : isWolf
          ? (holes: Set<number>) => computeRound(pressSubRound(round, holes)).ledger
          : (holes: Set<number>) => computeBaseGame(pressSubRound(round, holes)).ledger;
    return listPresses(round, single);
  }, [round, isWolf]);

  const tabs: PillTab[] = [
    { id: "scores", label: "Scores" },
    { id: "card", label: "Card" },
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
        {tab === "card" && cardComp && (
          <CardTab
            round={round}
            computation={cardComp}
            views={cardViews}
            trend={cardTrend}
            presses={pressList}
          />
        )}
      </div>
    </div>
  );
}
