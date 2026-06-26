// components/ScorecardTab.tsx
// Card tab: one expandable scorecard per player (golf-pool style). Tap a player
// to drop down their hole-by-hole card — monochrome score rings, no row color.
// Swipe (or tap the dots) to flip each nine between Scores and the by-hole Money
// ledger (+$ green / -$ red per hole).

"use client";

import { CSSProperties, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Round, RoundComputation, Player } from "@/lib/wolf";
import { coursePar, formatToPar, formatMoney } from "@/lib/storage";

const INK = "#16181D";
const MUTED = "#8A90A0";
const SURFACE2 = "#F4F6FA";
const HAIRLINE = "rgba(22,24,29,0.08)";
const STRONG = "rgba(22,24,29,0.20)";
const POS = "#2BC081";
const NEG = "#F0524B";
const PRIMARY = "#2D78FF";

// Concentric rings = strokes from par (cap 4). Under = circles, over = squares.
function ringStyle(rel: number): CSSProperties {
  if (rel === 0) return {};
  const n = Math.min(Math.abs(rel), 4);
  const layers: string[] = [];
  let spread = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      spread += 1.3;
      layers.push(`0 0 0 ${spread}px ${SURFACE2}`);
    }
    spread += 1.1;
    layers.push(`0 0 0 ${spread}px ${INK}`);
  }
  return { boxShadow: layers.join(", "), borderRadius: rel < 0 ? "50%" : "3px" };
}

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(9, 1fr)",
  gap: "1px",
  justifyItems: "center",
  alignItems: "center",
};
const numStyle: CSSProperties = { fontSize: "8px", color: MUTED, fontWeight: 600 };
const parStyle: CSSProperties = { fontSize: "8px", color: "#9AA1AD", fontWeight: 600, lineHeight: 1 };

function PlayerScorecard({
  round,
  computation,
  player,
}: {
  round: Round;
  computation: RoundComputation;
  player: Player;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"scores" | "money">("scores");
  const touch = useRef<{ x: number; y: number } | null>(null);

  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const resultByHole = new Map(computation.results.map((r) => [r.hole, r]));

  const grossOf = (h: number) => entryByHole.get(h)?.grossScores[player.id];
  const moneyOf = (h: number) => resultByHole.get(h)?.deltas[player.id] ?? 0;
  const popsOf = (h: number) => computation.pops[player.id]?.[h] ?? 0;

  const sumGross = (from: number, to: number) =>
    round.course.holes
      .filter((h) => h.number >= from && h.number <= to)
      .reduce((s, h) => s + (grossOf(h.number) ?? 0), 0);
  const sumMoney = (from: number, to: number) =>
    round.course.holes
      .filter((h) => h.number >= from && h.number <= to)
      .reduce((s, h) => s + moneyOf(h.number), 0);

  const totalGross = sumGross(1, 18);
  const totalMoney = sumMoney(1, 18);
  let toPar: number | null = null;
  for (const e of round.entries) {
    const g = e.grossScores[player.id];
    if (typeof g === "number") toPar = (toPar ?? 0) + g - (parByHole.get(e.hole) ?? g);
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(t.clientY - s.y)) return;
    setView(dx < 0 ? "money" : "scores");
  }

  // One nine rendered for the current view.
  function Nine({ from, label }: { from: number; label: string }) {
    const nums = Array.from({ length: 9 }, (_, i) => from + i);
    const parTotal = nums.reduce((s, n) => s + (parByHole.get(n) ?? 0), 0);
    const total = view === "scores" ? sumGross(from, from + 8) : sumMoney(from, from + 8);

    return (
      <div style={{ display: "flex", alignItems: "stretch", gap: "3px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={grid}>
            {nums.map((n) => (
              <span key={n} style={numStyle}>
                {n}
              </span>
            ))}
          </div>
          <div
            style={{
              ...grid,
              background: HAIRLINE,
              borderTop: `0.5px solid ${STRONG}`,
              borderBottom: `0.5px solid ${STRONG}`,
              padding: "1.5px 0",
              margin: "1px 0",
            }}
          >
            {nums.map((n) => (
              <span key={n} style={parStyle}>
                {parByHole.get(n) ?? ""}
              </span>
            ))}
          </div>
          <div style={{ ...grid, marginTop: "3px" }}>
            {nums.map((n) => {
              if (view === "money") {
                const m = moneyOf(n);
                return (
                  <span
                    key={n}
                    style={{
                      fontSize: "8.5px",
                      fontWeight: 700,
                      color: m > 0 ? POS : m < 0 ? NEG : "#C4C8CE",
                    }}
                  >
                    {m === 0 ? "·" : formatMoney(m)}
                  </span>
                );
              }
              const g = grossOf(n);
              if (typeof g !== "number") {
                return (
                  <span key={n} style={{ fontSize: "11px", color: INK, opacity: 0.35 }}>
                    –
                  </span>
                );
              }
              const pops = popsOf(n);
              return (
                <span key={n} style={{ position: "relative", display: "inline-flex" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "17px",
                      height: "17px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: INK,
                      ...ringStyle(g - (parByHole.get(n) ?? g)),
                    }}
                  >
                    {g}
                  </span>
                  {pops > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-1px",
                        right: "-2px",
                        display: "inline-flex",
                        gap: "1px",
                      }}
                    >
                      {Array.from({ length: pops }).map((_, i) => (
                        <span
                          key={i}
                          style={{
                            width: "3px",
                            height: "3px",
                            borderRadius: "9999px",
                            background: PRIMARY,
                          }}
                        />
                      ))}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <div
          style={{
            width: "30px",
            flexShrink: 0,
            borderLeft: `0.75px solid ${STRONG}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1px 0",
          }}
        >
          <span style={numStyle}>{label}</span>
          <span style={parStyle}>{parTotal || ""}</span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color:
                view === "money" ? (total > 0 ? POS : total < 0 ? NEG : INK) : INK,
            }}
          >
            {view === "money"
              ? total === 0
                ? "–"
                : formatMoney(total)
              : total || "–"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card-bg">
      {/* Collapsed header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1 truncate font-semibold">
          {player.name || "Unnamed"}
        </span>
        <span className="font-serif text-sm tabular-nums text-text-muted">
          {toPar === null ? "" : formatToPar(toPar)}
        </span>
        <span className="font-serif text-base font-bold tabular-nums">
          {totalGross || "–"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded scorecard */}
      {open && (
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="animate-fade-in"
          style={{
            background: SURFACE2,
            borderTop: `1px solid ${STRONG}`,
            padding: "8px 10px 10px",
            touchAction: "pan-y",
          }}
        >
          {/* View switch */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(["scores", "money"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`text-[10px] font-bold uppercase tracking-wide ${
                    view === v ? "text-text-primary" : "text-text-faint"
                  }`}
                >
                  {v === "scores" ? "Scores" : "Money"}
                </button>
              ))}
            </div>
            <span className="text-[10px] font-semibold text-text-muted">
              {view === "money" ? (
                <span className={totalMoney > 0 ? "text-positive" : totalMoney < 0 ? "text-negative" : ""}>
                  Total {formatMoney(totalMoney)}
                </span>
              ) : (
                <>
                  Total {totalGross || "–"}
                  {toPar !== null ? ` (${formatToPar(toPar)})` : ""}
                </>
              )}
            </span>
          </div>

          <div
            className="mb-2 rounded-md"
            style={{ borderTop: `0.5px solid ${HAIRLINE}`, borderBottom: `0.5px solid ${HAIRLINE}`, padding: "5px 4px 6px" }}
          >
            <div style={{ fontSize: "8px", textTransform: "uppercase", color: "#9AA1AD", fontWeight: 600, marginBottom: "2px" }}>
              Front
            </div>
            <Nine from={1} label="OUT" />
          </div>
          <div style={{ borderTop: `0.5px solid ${HAIRLINE}`, borderBottom: `0.5px solid ${HAIRLINE}`, padding: "5px 4px 6px" }}>
            <div style={{ fontSize: "8px", textTransform: "uppercase", color: "#9AA1AD", fontWeight: 600, marginBottom: "2px" }}>
              Back
            </div>
            <Nine from={10} label="IN" />
          </div>

          <p className="mt-2 text-center text-[10px] text-text-faint">
            Swipe ← Money · Scores → · ○ under par · ▢ over par ·{" "}
            <span className="inline-block h-[3px] w-[3px] rounded-full align-middle" style={{ background: PRIMARY }} />{" "}
            pop
          </p>
        </div>
      )}
    </div>
  );
}

export function ScorecardTab({
  round,
  computation,
}: {
  round: Round;
  computation: RoundComputation;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Scorecard</h2>
        <span className="text-sm text-text-muted">
          {round.course.name} · Par {coursePar(round.course)}
        </span>
      </div>

      <div className="space-y-2">
        {round.players.map((p) => (
          <PlayerScorecard
            key={p.id}
            round={round}
            computation={computation}
            player={p}
          />
        ))}
      </div>
    </div>
  );
}
