"use client";

import { useEffect, useMemo, useState } from "react";
import { Round, HoleEntry, computeRound } from "@/lib/wolf";
import { loadRound, saveRound, newRound } from "@/lib/storage";
import { SetupTab } from "@/components/SetupTab";
import { PlayTab } from "@/components/PlayTab";
import { ScorecardTab } from "@/components/ScorecardTab";
import { LedgerTab } from "@/components/LedgerTab";
import { TabBar, TabKey } from "@/components/TabBar";

export default function Home() {
  const [round, setRound] = useState<Round | null>(null);
  const [tab, setTab] = useState<TabKey>("setup");
  const [hole, setHole] = useState(1);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    setRound(loadRound() ?? newRound());
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
    return (
      <div className="py-20 text-center text-text-muted">Loading…</div>
    );
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
      {tab === "setup" && (
        <SetupTab round={round} updateRound={updateRound} />
      )}
      {tab === "play" && (
        <PlayTab
          round={round}
          computation={computation}
          hole={hole}
          setHole={setHole}
          upsertEntry={upsertEntry}
        />
      )}
      {tab === "card" && (
        <ScorecardTab round={round} computation={computation} />
      )}
      {tab === "ledger" && (
        <LedgerTab round={round} computation={computation} />
      )}

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
