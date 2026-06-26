"use client";

import { useEffect, useMemo, useState } from "react";
import { Round, HoleEntry, computeRound } from "@/lib/wolf";
import { loadRound, saveRound, newRound } from "@/lib/storage";
import { SetupTab } from "@/components/SetupTab";
import { ScoresTab } from "@/components/ScoresTab";
import { OverviewTab } from "@/components/OverviewTab";
import { TabBar, TabKey } from "@/components/TabBar";

export default function Home() {
  const [round, setRound] = useState<Round | null>(null);
  const [tab, setTab] = useState<TabKey>("scores");

  // Hydrate from localStorage on mount.
  useEffect(() => {
    const existing = loadRound();
    setRound(existing ?? newRound());
    // Brand-new rounds (nothing saved yet) start on Setup.
    if (!existing) setTab("setup");
  }, []);

  // Persist on every change.
  useEffect(() => {
    if (round) saveRound(round);
  }, [round]);

  const computation = useMemo(
    () => (round ? computeRound(round) : null),
    [round]
  );

  if (!round || !computation) {
    return <div className="py-20 text-center text-text-muted">Loading…</div>;
  }

  function updateRound(patch: Partial<Round> | ((r: Round) => Round)) {
    setRound((prev) => {
      if (!prev) return prev;
      return typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
    });
  }

  function upsertEntry(targetHole: number, patch: Partial<HoleEntry>, base: HoleEntry) {
    updateRound((r) => {
      const idx = r.entries.findIndex((e) => e.hole === targetHole);
      const entries = [...r.entries];
      if (idx === -1) {
        entries.push({ ...base, ...patch });
      } else {
        entries[idx] = { ...entries[idx], ...patch };
      }
      return { ...r, entries };
    });
  }

  return (
    <div>
      {tab === "scores" && (
        <ScoresTab round={round} computation={computation} upsertEntry={upsertEntry} />
      )}
      {tab === "overview" && (
        <OverviewTab round={round} computation={computation} />
      )}
      {tab === "setup" && <SetupTab round={round} updateRound={updateRound} />}

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
