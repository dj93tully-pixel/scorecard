// lib/useGame.ts
// Loads a game from Supabase, persists edits (debounced; per-hole upserts so
// concurrent edits to different holes don't clobber), and applies realtime
// updates from other players — while protecting fields THIS client just edited.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Round, HoleEntry } from "./wolf";
import {
  Game,
  getGame,
  saveEntry,
  saveSetup,
  renameGame,
  subscribeGame,
} from "./games";

const SUPPRESS_MS = 2500; // ignore remote echoes of our own very recent edits
const DEBOUNCE_MS = 350;

type Edits = Map<string, number>;

function mergeGame(prev: Game | null, fresh: Game, edits: Edits): Game {
  if (!prev) return fresh;
  const now = Date.now();
  const recent = (key: string) => now - (edits.get(key) ?? 0) < SUPPRESS_MS;

  const round: Round = { ...fresh.round };

  // Keep our just-edited setup; otherwise take the remote version.
  if (recent("setup")) {
    round.course = prev.round.course;
    round.players = prev.round.players;
    round.teeOrder = prev.round.teeOrder;
    round.settings = prev.round.settings;
  }

  // Merge entries hole-by-hole.
  const freshByHole = new Map(fresh.round.entries.map((e) => [e.hole, e]));
  const prevByHole = new Map(prev.round.entries.map((e) => [e.hole, e]));
  const holes = new Set<number>([...freshByHole.keys(), ...prevByHole.keys()]);
  const entries: HoleEntry[] = [];
  for (const h of holes) {
    if (recent(`entry:${h}`) && prevByHole.has(h)) {
      entries.push(prevByHole.get(h)!);
    } else if (freshByHole.has(h)) {
      entries.push(freshByHole.get(h)!);
    } else if (prevByHole.has(h)) {
      entries.push(prevByHole.get(h)!); // local-only, not yet round-tripped
    }
  }
  entries.sort((a, b) => a.hole - b.hole);
  round.entries = entries;

  const name = recent("name") ? prev.name : fresh.name;
  return { ...fresh, name, round };
}

export function useGame(id: string) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const edits = useRef<Edits>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getGame(id)
      .then((g) => {
        if (!active) return;
        setGame(g);
        setLoading(false);
        if (!g) setError("Game not found.");
      })
      .catch((e) => {
        if (!active) return;
        setError(e?.message ?? "Failed to load game.");
        setLoading(false);
      });

    const unsub = subscribeGame(id, () => {
      getGame(id)
        .then((fresh) => {
          if (!active || !fresh) return;
          setGame((prev) => mergeGame(prev, fresh, edits.current));
        })
        .catch(() => {});
    });

    return () => {
      active = false;
      unsub();
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, [id]);

  const scheduleSave = useCallback((key: string, fn: () => Promise<void>) => {
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      timers.current.delete(key);
      fn().catch((e) => setError(e?.message ?? "Save failed."));
    }, DEBOUNCE_MS);
    timers.current.set(key, t);
  }, []);

  const updateRound = useCallback(
    (patch: Partial<Round> | ((r: Round) => Round)) => {
      edits.current.set("setup", Date.now());
      setGame((prev) => {
        if (!prev) return prev;
        const round =
          typeof patch === "function" ? patch(prev.round) : { ...prev.round, ...patch };
        scheduleSave("setup", () => saveSetup(id, round));
        return { ...prev, round };
      });
    },
    [id, scheduleSave]
  );

  const upsertEntry = useCallback(
    (hole: number, patch: Partial<HoleEntry>, base: HoleEntry) => {
      edits.current.set(`entry:${hole}`, Date.now());
      setGame((prev) => {
        if (!prev) return prev;
        const idx = prev.round.entries.findIndex((e) => e.hole === hole);
        const entries = [...prev.round.entries];
        let entry: HoleEntry;
        if (idx === -1) {
          entry = { ...base, ...patch };
          entries.push(entry);
        } else {
          entry = { ...entries[idx], ...patch };
          entries[idx] = entry;
        }
        scheduleSave(`entry:${hole}`, () => saveEntry(id, entry));
        return { ...prev, round: { ...prev.round, entries } };
      });
    },
    [id, scheduleSave]
  );

  const rename = useCallback(
    (name: string) => {
      edits.current.set("name", Date.now());
      setGame((prev) => (prev ? { ...prev, name } : prev));
      scheduleSave("name", () => renameGame(id, name));
    },
    [id, scheduleSave]
  );

  return { game, round: game?.round ?? null, loading, error, updateRound, upsertEntry, rename };
}
