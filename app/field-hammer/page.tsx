"use client";

import { useEffect, useState } from "react";
import { useFieldHammer } from "@/lib/useFieldHammer";
import { useHeader } from "@/lib/header-context";
import { PillTabs, PillTab } from "@/components/PillTabs";
import { FHSetup } from "@/components/fieldhammer/FHSetup";
import { FHPlay } from "@/components/fieldhammer/FHPlay";
import { FHLedger } from "@/components/fieldhammer/FHLedger";

const TABS: PillTab[] = [
  { id: "play", label: "Play" },
  { id: "ledger", label: "Ledger" },
];

export default function FieldHammerPage() {
  const fh = useFieldHammer();
  const { game, loaded, create, reset } = fh;
  const { setHeader } = useHeader();
  const [tab, setTab] = useState<"play" | "ledger">("play");

  useEffect(() => {
    setHeader({
      title: "Field Hammer",
      backHref: "/",
      rightButton: game
        ? {
            label: "New",
            onClick: () => {
              if (window.confirm("Start a new Field Hammer game? This clears the current one.")) {
                reset();
              }
            },
          }
        : undefined,
    });
    return () => setHeader({});
  }, [game, reset, setHeader]);

  if (!loaded) {
    return (
      <div className="mt-4 space-y-3">
        <div className="skeleton h-12 w-full rounded-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  if (!game) return <FHSetup onCreate={create} />;

  return (
    <div>
      <div
        className="sticky z-20 -mx-3 mb-4 bg-page-bg px-3 pb-2 pt-2"
        style={{ top: "var(--header-h, 88px)" }}
      >
        <PillTabs
          tabs={TABS}
          activeId={tab}
          onChange={(t) => setTab(t as "play" | "ledger")}
          ariaLabel="Field Hammer views"
        />
      </div>
      <div key={tab} className="animate-fade-in">
        {tab === "play" ? <FHPlay fh={fh} /> : <FHLedger fh={fh} />}
      </div>
    </div>
  );
}
