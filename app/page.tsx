"use client";

import { useEffect, useMemo, useState } from "react";
import { Round, HoleEntry, computeRound } from "@/lib/wolf";
import { loadRound, saveRound, newRound } from "@/lib/storage";
import { SetupTab } from "@/components/SetupTab";
import { ScoresTab } from "@/components/ScoresTab";
import { CardTab } from "@/components/CardTab";
import { PillTabs, PillTab } from "@/components/PillTabs";

type TabId = "scores" | "card" | "setup";

const TABS: PillTab[] = [
  { id: "scores", label: "Scores" },
  { id: "card", label: "Card" },
  { id: "setup", label: "Setup" },
];

const TAB_KEY = "wolf:activeTab";

export default function Home() {
  const [round, setRound] = useState<Round | null>(null);
  const [tab, setTab] = useState<TabId>("setup");

  // Hydrate round + active tab from localStorage on mount.
  useEffect(() => {
    const existing = loadRound();
    setRound(existing ?? newRound());
    try {
      const savedTab = window.localStorage.getItem(TAB_KEY) as TabId | null;
      if (savedTab && TABS.some((t) => t.id === savedTab)) setTab(savedTab);
      else if (existing) setTab("scores"); // returning user with a round in progress
    } catch {
      /* ignore */
    }
  }, []);

  // Persist round + tab on change.
  useEffect(() => {
    if (round) saveRound(round);
  }, [round]);

  function changeTab(id: string) {
    setTab(id as TabId);
    try {
      window.localStorage.setItem(TAB_KEY, id);
    } catch {
      /* ignore */
    }
  }

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
      if (idx === -1) entries.push({ ...base, ...patch });
      else entries[idx] = { ...entries[idx], ...patch };
      return { ...r, entries };
    });
  }

  return (
    <div>
      {/* Top pill tab bar — sticky beneath the dark app header */}
      <div className="sticky top-0 z-10 -mx-3 mb-4 bg-page-bg px-3 py-3">
        <PillTabs tabs={TABS} activeId={tab} onChange={changeTab} ariaLabel="Views" />
      </div>

      {tab === "scores" && (
        <ScoresTab round={round} computation={computation} upsertEntry={upsertEntry} />
      )}
      {tab === "card" && <CardTab round={round} computation={computation} />}
      {tab === "setup" && <SetupTab round={round} updateRound={updateRound} />}
    </div>
  );
}
