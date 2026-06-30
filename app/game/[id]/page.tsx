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
  eachPress,
  hasAnyPress,
  pressSubRound,
  RunResult,
} from "@/lib/engines/press";
import { segBreakdown } from "@/lib/engines/breakdown";
import { nassauPressLedger } from "@/lib/engines/nassau";
import { ScoresTab } from "@/components/ScoresTab";
import { CardTab, CardComputation, BetMatrix } from "@/components/CardTab";
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

  // Per-player bet-breakdown matrix for the Card tab: Front/Back (+Overall for
  // Nassau) split into Original / Press / Hammer / Total. Presentation only —
  // segBreakdown re-runs the engine with hammers off to isolate hammer money,
  // and reuses the press decomposition; nothing in settlement changes.
  const betMatrix: BetMatrix | undefined = useMemo(() => {
    if (!round) return undefined;
    const gt = gameTypeOf(round);
    const ids = round.players.map((p) => p.id);
    const hasPress = hasAnyPress(round);

    // Nassau: per-segment money lives in the engine stats; never hammered.
    if (gt === "nassau" && gameResult) {
      const player: BetMatrix["player"] = {};
      for (const id of ids) {
        const s = gameResult.stats[id] ?? {};
        player[id] = {
          segs: [
            { label: "Front", orig: Number(s.front ?? 0), press: Number(s.pressFront ?? 0), hammer: 0 },
            { label: "Back", orig: Number(s.back ?? 0), press: Number(s.pressBack ?? 0), hammer: 0 },
            { label: "Overall", orig: Number(s.overall ?? 0), press: Number(s.pressOverall ?? 0), hammer: 0 },
          ],
          orig: Number(s.original ?? 0),
          press: Number(s.press ?? 0),
          hammer: 0,
        };
      }
      return { hasPress, hasHammer: false, player };
    }

    // 11s: settles on a single net total — no nine split, no press, no hammer.
    if (gt === "elevens" && gameResult) {
      const player: BetMatrix["player"] = {};
      for (const id of ids)
        player[id] = { segs: [], orig: gameResult.ledger[id] ?? 0, press: 0, hammer: 0 };
      return { hasPress: false, hasHammer: false, player };
    }

    // Per-hole games (including Wolf): isolate hammer + press by nine.
    const run = (r: Round): RunResult => {
      if (isWolf) {
        const c = computeRound(r);
        return {
          ledger: c.ledger,
          holeResults: c.results.map((rr) => ({
            hole: rr.hole,
            deltas: rr.deltas,
            decided: rr.winner !== "push",
            detail: "",
          })),
        };
      }
      const g = computeBaseGame(r);
      return { ledger: g.ledger, holeResults: g.holeResults };
    };
    const b = segBreakdown(round, run);
    const player: BetMatrix["player"] = {};
    for (const id of ids)
      player[id] = { segs: b.segs[id], orig: b.orig[id], press: b.press[id], hammer: b.hammer[id] };
    return { hasPress, hasHammer: b.hasHammer, player };
  }, [round, isWolf, gameResult]);

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

  // Each individual press as its own card view, for the sub-selector inside the
  // Press tab (Total · ⚡9 · ⚡9×2 · ⚡18 …).
  const pressCards = useMemo(() => {
    if (!round || !hasAnyPress(round)) return [];
    const gt = gameTypeOf(round);
    const pops = (isWolf ? computation?.pops : gameResult?.pops) ?? {};
    const run = (holes: Set<number>): RunResult => {
      if (gt === "nassau") return { ledger: nassauPressLedger(round, holes), holeResults: [] };
      if (isWolf) {
        const c = computeRound(pressSubRound(round, holes));
        return {
          ledger: c.ledger,
          holeResults: c.results.map((rr) => ({
            hole: rr.hole,
            deltas: rr.deltas,
            detail: "",
            decided: rr.winner !== "push",
          })),
        };
      }
      const g = computeBaseGame(pressSubRound(round, holes));
      return { ledger: g.ledger, holeResults: g.holeResults };
    };
    const counts: Record<string, number> = {};
    return eachPress(round, run).map((pr) => {
      const base =
        pr.scope === "full"
          ? "18"
          : gt === "sixes"
            ? pr.hole <= 6
              ? "F6"
              : pr.hole <= 12
                ? "M6"
                : "B6"
            : pr.hole <= 9
              ? "F9"
              : "B9";
      counts[base] = (counts[base] ?? 0) + 1;
      const k = counts[base];
      return {
        label: `${base}${k > 1 ? `×${k}` : ""}`,
        holes: new Set(pr.holes),
        comp: {
          ledger: pr.result.ledger,
          pops,
          results: pr.result.holeResults,
          stats: {},
        } as CardComputation,
      };
    });
  }, [round, isWolf, computation, gameResult]);

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
            betMatrix={betMatrix}
            trend={cardTrend}
            pressCards={pressCards}
          />
        )}
      </div>
    </div>
  );
}
