// components/OverviewTab.tsx
// Second tab: the full scorecard on top, the live money ledger below.

import { Round, RoundComputation } from "@/lib/wolf";
import { ScorecardTab } from "./ScorecardTab";
import { LedgerTab } from "./LedgerTab";

export function OverviewTab({
  round,
  computation,
}: {
  round: Round;
  computation: RoundComputation;
}) {
  return (
    <div className="space-y-8">
      <ScorecardTab round={round} computation={computation} />
      <div className="h-px bg-divider" />
      <LedgerTab round={round} computation={computation} />
    </div>
  );
}
