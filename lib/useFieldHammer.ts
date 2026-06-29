// lib/useFieldHammer.ts
// React state + localStorage for the active Field Hammer game, plus the hammer
// state machine (hammer the field / accept / fold / hammer back) and a memoized
// settlement computed via the pure lib/fieldHammer engine.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Player } from "@/lib/wolf";
import {
  FHGame,
  FHHole,
  FHPairLive,
  FHSettings,
  emptyHole,
  fhPopsForHole,
  loadFH,
  newFHGame,
  saveFH,
} from "./fieldHammerStore";
import {
  PairState,
  RoundHole,
  pairKey,
  settleRound,
  settleUp,
} from "./fieldHammer";

const getPair = (hole: FHHole, key: string): FHPairLive =>
  hole.pairings[key] ?? { doublings: 0 };

export function useFieldHammer() {
  const [game, setGame] = useState<FHGame | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setGame(loadFH());
    setLoaded(true);
  }, []);

  const update = useCallback((fn: (g: FHGame) => FHGame) => {
    setGame((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      saveFH(next);
      return next;
    });
  }, []);

  const create = useCallback((players: Player[], settings: FHSettings) => {
    const g = newFHGame(players, settings);
    saveFH(g);
    setGame(g);
  }, []);

  const reset = useCallback(() => {
    saveFH(null);
    setGame(null);
  }, []);

  const setScore = useCallback(
    (n: number, pid: string, score: number | null) => {
      update((g) => {
        const hole = { ...(g.holes[n] ?? emptyHole(n)) };
        const gs = { ...hole.grossScores };
        if (score === null) delete gs[pid];
        else gs[pid] = score;
        hole.grossScores = gs;
        return { ...g, holes: { ...g.holes, [n]: hole } };
      });
    },
    [update]
  );

  /** Propose a hammer on every eligible pairing the hammerer is in. */
  const hammerField = useCallback(
    (n: number, hammerer: string) => {
      update((g) => {
        const hole = { ...(g.holes[n] ?? emptyHole(n)) };
        const pairings = { ...hole.pairings };
        for (const opp of g.players.map((p) => p.id)) {
          if (opp === hammerer) continue;
          const key = pairKey(hammerer, opp);
          const st = getPair(hole, key);
          if (st.fold || st.pending) continue;
          if (st.doublings >= g.settings.linesCap) continue;
          if (st.lastHammerer === hammerer) continue; // no two in a row
          pairings[key] = { ...st, pending: hammerer };
        }
        hole.pairings = pairings;
        return { ...g, holes: { ...g.holes, [n]: hole } };
      });
    },
    [update]
  );

  /** The non-pending player accepts or folds a pending hammer on a pairing. */
  const respond = useCallback(
    (n: number, key: string, action: "accept" | "fold") => {
      update((g) => {
        const hole = { ...(g.holes[n] ?? emptyHole(n)) };
        const st = getPair(hole, key);
        if (!st.pending) return g;
        const [a, b] = key.split("|");
        const responder = st.pending === a ? b : a;
        const pairings = { ...hole.pairings };
        if (action === "accept") {
          pairings[key] = { doublings: st.doublings + 1, lastHammerer: st.pending };
        } else {
          const settleStake = g.settings.baseStake * 2 ** st.doublings;
          pairings[key] = {
            doublings: st.doublings,
            lastHammerer: st.lastHammerer,
            fold: { folder: responder, settleStake },
          };
        }
        hole.pairings = pairings;
        return { ...g, holes: { ...g.holes, [n]: hole } };
      });
    },
    [update]
  );

  /** An acceptor re-raises a pairing (becomes the new pending hammerer). */
  const hammerBack = useCallback(
    (n: number, key: string, hammerer: string) => {
      update((g) => {
        const hole = { ...(g.holes[n] ?? emptyHole(n)) };
        const st = getPair(hole, key);
        if (st.fold || st.pending) return g;
        if (st.doublings >= g.settings.linesCap) return g;
        if (st.lastHammerer === hammerer) return g; // alternation
        hole.pairings = { ...hole.pairings, [key]: { ...st, pending: hammerer } };
        return { ...g, holes: { ...g.holes, [n]: hole } };
      });
    },
    [update]
  );

  /** Withdraw an un-answered pending hammer. */
  const cancelHammer = useCallback(
    (n: number, key: string) => {
      update((g) => {
        const hole = { ...(g.holes[n] ?? emptyHole(n)) };
        const st = getPair(hole, key);
        if (!st.pending) return g;
        hole.pairings = {
          ...hole.pairings,
          [key]: { doublings: st.doublings, lastHammerer: st.lastHammerer },
        };
        return { ...g, holes: { ...g.holes, [n]: hole } };
      });
    },
    [update]
  );

  const settlement = useMemo(() => {
    if (!game) return null;
    const ids = game.players.map((p) => p.id);
    const holes: RoundHole[] = Object.values(game.holes).map((h) => ({
      number: h.number,
      grossScores: h.grossScores,
      pops: fhPopsForHole(game, h.number),
      pairings: Object.fromEntries(
        Object.entries(h.pairings).map(([k, v]) => {
          const ps: PairState = { doublings: v.doublings };
          if (v.fold) ps.fold = v.fold;
          return [k, ps];
        })
      ),
    }));
    const round = settleRound({
      players: ids,
      baseStake: game.settings.baseStake,
      carryTies: game.settings.carryTies,
      holes,
    });
    return { round, txns: settleUp(round.ledger) };
  }, [game]);

  return {
    game,
    loaded,
    create,
    reset,
    setScore,
    hammerField,
    respond,
    hammerBack,
    cancelHammer,
    settlement,
  };
}

export type FieldHammer = ReturnType<typeof useFieldHammer>;
