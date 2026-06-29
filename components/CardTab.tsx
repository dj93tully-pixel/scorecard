// components/CardTab.tsx
// Card tab = one big all-players scorecard + a by-hole money ledger up top, then
// the standings as "ledger badges" that drop down to each player's own detailed
// scorecard (scores + by-hole money), golf-pool style. Presentation only.

"use client";

import { CSSProperties, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Round, Player } from "@/lib/wolf";
import { formatMoney, formatToPar } from "@/lib/storage";

// Minimal shape the Card view needs — satisfied by both Wolf's RoundComputation
// and the generic GameResult, so this one component serves every game type.
export interface CardComputation {
  ledger: Record<string, number>;
  pops: Record<string, Record<number, number>>;
  results: {
    hole: number;
    deltas: Record<string, number>;
    // For the by-hole summary: "—" = not played (skipped); other text used for
    // pushes/carries when no money moved. Optional so RoundComputation still fits.
    detail?: string;
    decided?: boolean;
  }[];
}

const INK = "#16181D";
const MUTED = "#8A90A0";
const SURFACE2 = "#F4F6FA";
const HAIRLINE = "rgba(22,24,29,0.08)";
const STRONG = "rgba(22,24,29,0.20)";
const POS = "#2BC081";
const NEG = "#F0524B";
const PRIMARY = "#2D78FF";

const RANK_RAIL = ["border-l-rank-1", "border-l-rank-2", "border-l-rank-3", "border-l-rank-4"];

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

// A pop on the hole is shown by coloring the score blue (same as the old dot).
// Worse than +3 → one solid black square with white text (instead of 4+ rings).
function StrokeCell({ gross, rel, pops }: { gross: number; rel: number; pops: number }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "17px",
    height: "17px",
    fontSize: "11px",
    fontWeight: 600,
  } as const;
  if (rel > 3) {
    return (
      <span style={{ ...base, color: "#FFFFFF", background: INK, borderRadius: "3px" }}>
        {gross}
      </span>
    );
  }
  return (
    <span style={{ ...base, color: pops > 0 ? PRIMARY : INK, ...ringStyle(rel) }}>
      {gross}
    </span>
  );
}

// ── One big all-players nine (scores or by-hole money) ──────────────────────
function BigNine({
  round,
  computation,
  holes,
  title,
  mode,
  net = false,
}: {
  round: Round;
  computation: CardComputation;
  holes: number[];
  title: string;
  mode: "scores" | "money";
  net?: boolean; // scores mode: show net (gross − pops) instead of gross
}) {
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const siByHole = new Map(round.course.holes.map((h) => [h.number, h.strokeIndex]));
  const resultByHole = new Map(computation.results.map((r) => [r.hole, r]));
  const grossOf = (pid: string, h: number) => entryByHole.get(h)?.grossScores[pid];
  const popsOf = (pid: string, h: number) => computation.pops[pid]?.[h] ?? 0;
  const moneyOf = (pid: string, h: number) => resultByHole.get(h)?.deltas[pid] ?? 0;
  const totalLabel = title === "Front" ? "OUT" : "IN";
  const parTotal = holes.reduce((s, h) => s + (parByHole.get(h) ?? 0), 0);
  const playerTotal = (pid: string) =>
    mode === "money"
      ? holes.reduce((s, h) => s + moneyOf(pid, h), 0)
      : holes.reduce((s, h) => {
          const g = grossOf(pid, h);
          if (typeof g !== "number") return s;
          return s + (net ? g - popsOf(pid, h) : g);
        }, 0);

  return (
    <div className="overflow-x-auto border-y border-card-border bg-surface-2">
      <table className="w-full border-collapse text-center">
        <thead>
          <tr className="text-[10px] font-semibold text-text-muted">
            <th className="sticky left-0 z-10 bg-surface-2 px-2 py-1.5 text-left">{title}</th>
            {holes.map((h) => (
              <th key={h} className="px-1.5 py-1.5">
                {h}
              </th>
            ))}
            <th className="px-1.5 py-1.5">{totalLabel}</th>
          </tr>
          {mode === "scores" && (
            <>
              <tr className="text-[9px] text-text-faint" style={{ background: HAIRLINE }}>
                <td className="sticky left-0 z-10 bg-surface-2 px-2 py-0.5 text-left">Par</td>
                {holes.map((h) => (
                  <td key={h} className="px-1.5 py-0.5">
                    {parByHole.get(h)}
                  </td>
                ))}
                <td className="px-1.5 py-0.5">{parTotal}</td>
              </tr>
              <tr className="text-[9px] text-text-faint">
                <td className="sticky left-0 z-10 bg-surface-2 px-2 py-0.5 text-left">Hcp</td>
                {holes.map((h) => (
                  <td key={h} className="px-1.5 py-0.5">
                    {siByHole.get(h)}
                  </td>
                ))}
                <td className="px-1.5 py-0.5" />
              </tr>
            </>
          )}
        </thead>
        <tbody>
          {round.players.map((p) => {
            const tot = playerTotal(p.id);
            return (
              <tr key={p.id} className="border-t" style={{ borderColor: HAIRLINE }}>
                <td className="sticky left-0 z-10 bg-surface-2 px-2 py-2 text-left text-xs font-semibold">
                  {(p.name || "?").slice(0, 8)}
                </td>
                {holes.map((h) => {
                  if (mode === "scores") {
                    const g = grossOf(p.id, h);
                    const pops = popsOf(p.id, h);
                    const par = parByHole.get(h) ?? 0;
                    const num = typeof g === "number" ? (net ? g - pops : g) : null;
                    return (
                      <td key={h} className="px-1.5 py-2">
                        {num !== null ? (
                          <StrokeCell
                            gross={num}
                            rel={num - par}
                            pops={net ? 0 : pops}
                          />
                        ) : pops > 0 ? (
                          // Future hole where this player gets a pop.
                          <span style={{ color: PRIMARY, fontWeight: 700 }}>–</span>
                        ) : (
                          <span className="text-text-faint">–</span>
                        )}
                      </td>
                    );
                  }
                  const m = moneyOf(p.id, h);
                  return (
                    <td
                      key={h}
                      className="px-1.5 py-2 text-[9px] font-bold tabular-nums"
                      style={{ color: m > 0 ? POS : m < 0 ? NEG : "#C4C8CE" }}
                    >
                      {m === 0 ? "·" : formatMoney(m)}
                    </td>
                  );
                })}
                <td
                  className="px-1.5 py-2 text-xs font-bold tabular-nums"
                  style={
                    mode === "money"
                      ? { color: tot > 0 ? POS : tot < 0 ? NEG : INK }
                      : undefined
                  }
                >
                  {mode === "scores" ? tot || "" : tot === 0 ? "–" : formatMoney(tot)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Single-player nine in the compact golf-pool card style ──────────────────
const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(9, 1fr)",
  gap: "1px",
  justifyItems: "center",
  alignItems: "center",
};
const numStyle: CSSProperties = { fontSize: "8px", color: MUTED, fontWeight: 600 };
const parStyle: CSSProperties = { fontSize: "8px", color: "#9AA1AD", fontWeight: 600, lineHeight: 1 };

function PlayerNine({
  round,
  computation,
  player,
  from,
  label,
  mode,
}: {
  round: Round;
  computation: CardComputation;
  player: Player;
  from: number;
  label: string;
  mode: "scores" | "money";
}) {
  const nums = Array.from({ length: 9 }, (_, i) => from + i);
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const resultByHole = new Map(computation.results.map((r) => [r.hole, r]));
  const grossOf = (h: number) => entryByHole.get(h)?.grossScores[player.id];
  const popsOf = (h: number) => computation.pops[player.id]?.[h] ?? 0;
  const moneyOf = (h: number) => resultByHole.get(h)?.deltas[player.id] ?? 0;
  const parTotal = nums.reduce((s, n) => s + (parByHole.get(n) ?? 0), 0);
  const total =
    mode === "scores"
      ? nums.reduce((s, n) => s + (grossOf(n) ?? 0), 0)
      : nums.reduce((s, n) => s + moneyOf(n), 0);

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: "3px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={gridStyle}>
          {nums.map((n) => {
            // Holes where this player gets a handicap stroke: blue + bold.
            const hasPop = mode === "scores" && popsOf(n) > 0;
            return (
              <span
                key={n}
                style={
                  hasPop
                    ? { fontSize: "8px", color: PRIMARY, fontWeight: 900 }
                    : numStyle
                }
              >
                {n}
              </span>
            );
          })}
        </div>
        {mode === "scores" && (
          <div
            style={{
              ...gridStyle,
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
        )}
        <div style={{ ...gridStyle, marginTop: "3px" }}>
          {nums.map((n) => {
            if (mode === "money") {
              const m = moneyOf(n);
              return (
                <span
                  key={n}
                  style={{ fontSize: "8.5px", fontWeight: 700, color: m > 0 ? POS : m < 0 ? NEG : "#C4C8CE" }}
                >
                  {m === 0 ? "·" : formatMoney(m)}
                </span>
              );
            }
            const g = grossOf(n);
            return typeof g === "number" ? (
              <StrokeCell key={n} gross={g} rel={g - (parByHole.get(n) ?? g)} pops={popsOf(n)} />
            ) : popsOf(n) > 0 ? (
              <span key={n} style={{ fontSize: "11px", color: PRIMARY, fontWeight: 700 }}>
                –
              </span>
            ) : (
              <span key={n} style={{ fontSize: "11px", color: INK, opacity: 0.35 }}>
                –
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
        {mode === "scores" && <span style={parStyle}>{parTotal || ""}</span>}
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: mode === "money" ? (total > 0 ? POS : total < 0 ? NEG : INK) : INK,
          }}
        >
          {mode === "scores" ? total || "–" : total === 0 ? "–" : formatMoney(total)}
        </span>
      </div>
    </div>
  );
}

// ── Ledger badge that drops down to the player's detailed scorecard ─────────
function LedgerCard({
  round,
  computation,
  player,
  rankIndex,
}: {
  round: Round;
  computation: CardComputation;
  player: Player;
  rankIndex: number; // 0-based; tied players share the same index
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"scores" | "money">("scores");
  const touch = useRef<{ x: number; y: number } | null>(null);

  const money = computation.ledger[player.id] ?? 0;
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  let toPar: number | null = null;
  for (const e of round.entries) {
    const g = e.grossScores[player.id];
    if (typeof g === "number") toPar = (toPar ?? 0) + g - (parByHole.get(e.hole) ?? g);
  }
  const moneyColor = money > 0 ? "text-positive" : money < 0 ? "text-negative" : "text-text-muted";

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

  return (
    <div
      className={`overflow-hidden rounded-xl border border-l-4 border-card-border bg-card-bg ${RANK_RAIL[Math.min(rankIndex, 3)]}`}
    >
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="w-4 text-center font-serif text-base font-bold text-text-faint">{rankIndex + 1}</span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-semibold">{player.name || "Unnamed"}</span>
          <span className="shrink-0 font-serif text-sm font-bold tabular-nums text-primary">
            {toPar === null ? "–" : formatToPar(toPar)}
          </span>
        </span>
        <span className={`font-serif text-lg font-extrabold tabular-nums ${moneyColor}`}>
          {formatMoney(money)}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="animate-fade-in"
          style={{ background: SURFACE2, borderTop: `1px solid ${STRONG}`, padding: "8px 10px 10px", touchAction: "pan-y" }}
        >
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
            <span className="text-[10px] text-text-faint">swipe ←→</span>
          </div>

          <div style={{ borderTop: `0.5px solid ${HAIRLINE}`, borderBottom: `0.5px solid ${HAIRLINE}`, padding: "5px 4px 6px", marginBottom: "6px" }}>
            <PlayerNine round={round} computation={computation} player={player} from={1} label="OUT" mode={view} />
          </div>
          <div style={{ borderTop: `0.5px solid ${HAIRLINE}`, borderBottom: `0.5px solid ${HAIRLINE}`, padding: "5px 4px 6px" }}>
            <PlayerNine round={round} computation={computation} player={player} from={10} label="IN" mode={view} />
          </div>
        </div>
      )}
    </div>
  );
}

export function CardTab({
  round,
  computation,
}: {
  round: Round;
  computation: CardComputation;
}) {
  const front = Array.from({ length: 9 }, (_, i) => i + 1);
  const back = Array.from({ length: 9 }, (_, i) => i + 10);
  const [scoreView, setScoreView] = useState<"gross" | "net">("gross");
  const net = scoreView === "net";
  const standings = [...round.players].sort(
    (a, b) => (computation.ledger[b.id] ?? 0) - (computation.ledger[a.id] ?? 0)
  );

  return (
    <div className="space-y-6">
      {/* Standings → tap a player to drop down their full scorecard */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted">Standings</h3>
        {standings.map((p) => {
          const m = computation.ledger[p.id] ?? 0;
          // Tie-aware rank: 1 + number of players strictly ahead.
          const rankIndex = standings.filter(
            (q) => (computation.ledger[q.id] ?? 0) > m
          ).length;
          return (
            <LedgerCard
              key={p.id}
              round={round}
              computation={computation}
              player={p}
              rankIndex={rankIndex}
            />
          );
        })}
      </section>

      {/* By-hole money ledger */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Ledger</h2>
        <BigNine round={round} computation={computation} holes={front} title="Front" mode="money" />
        <BigNine round={round} computation={computation} holes={back} title="Back" mode="money" />
      </section>

      {/* Big all-players scorecard */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Scorecard</h2>
          <div className="inline-flex rounded-full bg-divider p-[2px] text-[10px] font-medium">
            {(["gross", "net"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setScoreView(v)}
                style={scoreView === v ? { boxShadow: "0 1px 2px rgba(0,0,0,0.12)" } : undefined}
                className={`rounded-full px-[9px] py-0.5 capitalize transition ${
                  scoreView === v ? "bg-white text-accent-on-light" : "text-text-faint"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <BigNine round={round} computation={computation} holes={front} title="Front" mode="scores" net={net} />
        <BigNine round={round} computation={computation} holes={back} title="Back" mode="scores" net={net} />
        {/* Totals listed as part of the scorecard: name · total · +/- · money */}
        <Totals round={round} computation={computation} net={net} />
      </section>
    </div>
  );
}

// Per-player totals listed below the scorecard: name · money · +/- · total.
// `net` follows the scorecard's gross/net toggle so the total + to-par match it.
function Totals({
  round,
  computation,
  net,
}: {
  round: Round;
  computation: CardComputation;
  net: boolean;
}) {
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const rows = round.players
    .map((p) => {
      let total = 0;
      let toPar: number | null = null;
      for (const e of round.entries) {
        const g = e.grossScores[p.id];
        if (typeof g === "number") {
          const score = net ? g - (computation.pops[p.id]?.[e.hole] ?? 0) : g;
          total += score;
          toPar = (toPar ?? 0) + score - (parByHole.get(e.hole) ?? score);
        }
      }
      return { p, total, toPar, money: computation.ledger[p.id] ?? 0 };
    })
    .sort((a, b) => b.money - a.money);

  return (
    <div className="border-y border-card-border bg-surface-2">
      {rows.map(({ p, total, toPar, money }, i) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-2 px-2 py-2"
          style={i > 0 ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}
        >
          <span
            className="min-w-0 flex-1 truncate text-xs font-semibold"
            style={{ color: INK }}
          >
            {p.name || "Unnamed"}
          </span>
          <div className="flex items-center gap-4 text-xs tabular-nums">
            <span
              className="w-16 text-right font-bold"
              style={{ color: money > 0 ? POS : money < 0 ? NEG : MUTED }}
            >
              {formatMoney(money)}
            </span>
            <span className="w-10 text-right font-bold" style={{ color: PRIMARY }}>
              {toPar === null ? "–" : formatToPar(toPar)}
            </span>
            <span className="w-10 text-right font-bold" style={{ color: INK }}>
              {total || "–"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
