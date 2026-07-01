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
  // `error` is fatal LOAD failure only — it gates the whole screen. A failed
  // background save must NEVER set this (it would blank the scorecard); it uses
  // the non-fatal `saveError` instead.
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const edits = useRef<Edits>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // The latest save fn per key that hasn't landed a successful write yet — holds
  // both debounced-but-not-fired and failed-pending-retry saves, so we can flush
  // them on unmount / backgrounding / reconnect instead of dropping them.
  const pending = useRef<Map<string, () => Promise<void>>>(new Map());

  // Fire a pending save now (cancels its debounce timer). Keeps it queued for
  // retry on failure; clears it only after a successful write.
  const runSave = useCallback((key: string) => {
    const fn = pending.current.get(key);
    if (!fn) return;
    const t = timers.current.get(key);
    if (t) {
      clearTimeout(t);
      timers.current.delete(key);
    }
    fn()
      .then(() => {
        // Only clear if a newer edit hasn't since replaced this fn.
        if (pending.current.get(key) === fn) {
          pending.current.delete(key);
          if (pending.current.size === 0) setSaveError(null);
        }
      })
      .catch((e) => {
        setSaveError(e?.message ?? "Couldn’t save — will retry when back online.");
      });
  }, []);

  // Push out everything queued (used on unmount, backgrounding, reconnect).
  const flushPending = useCallback(() => {
    for (const key of [...pending.current.keys()]) runSave(key);
  }, [runSave]);

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

    // Commit queued edits before they can be lost, and retry failures.
    const onOnline = () => flushPending();
    const onHide = () => {
      if (document.visibilityState === "hidden") flushPending();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushPending);

    return () => {
      active = false;
      unsub();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushPending);
      flushPending(); // best-effort: fire any pending saves before tearing down
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, [id, flushPending]);

  const scheduleSave = useCallback(
    (key: string, fn: () => Promise<void>) => {
      pending.current.set(key, fn);
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      timers.current.set(key, setTimeout(() => runSave(key), DEBOUNCE_MS));
    },
    [runSave]
  );

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

  return {
    game,
    round: game?.round ?? null,
    loading,
    error,
    saveError,
    updateRound,
    upsertEntry,
    rename,
  };
}
