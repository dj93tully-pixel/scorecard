// components/CardTab.tsx
// Card tab = one big all-players scorecard + a by-hole money ledger up top, then
// the standings as "ledger badges" that drop down to each player's own detailed
// scorecard (scores + by-hole money), golf-pool style. Presentation only.

"use client";

import { CSSProperties, useRef, useState } from "react";
import { ChevronDown, Zap } from "lucide-react";
import { Round, Player } from "@/lib/wolf";
import { gameTypeOf } from "@/lib/gametypes";
import { pressedHoles } from "@/lib/engines/press";
import { formatMoney, formatToPar } from "@/lib/storage";
import { MoneyTrend } from "./MoneyTrend";

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
  // Per-player engine stats (e.g. Nassau front/back/overall money). Optional so
  // Wolf's RoundComputation still satisfies the shape.
  stats?: Record<string, Record<string, number | string>>;
}

// When a round has presses, the Card tab splits into three money views — the
// original bet, the press bets, and their total — each a full CardComputation.
// Per-player bet breakdown for the standings matrix: each player's money split
// into Original / Press / Hammer by nine (Front/Back, +Overall for Nassau), plus
// the column grand totals. hasPress/hasHammer drive which columns + tabs show.
export interface BetMatrix {
  hasPress: boolean;
  hasHammer: boolean;
  player: Record<
    string,
    {
      segs: { label: string; orig: number; press: number; hammer: number }[];
      orig: number;
      press: number;
      hammer: number;
    }
  >;
}

export type BetTab = "total" | "original" | "press" | "hammer";

// One individual press as its own card view (for the Press tab's sub-selector).
export interface PressCardView {
  label: string; // e.g. "9", "9×2", "18"
  holes: Set<number>; // the holes it covers
  comp: CardComputation;
}

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
  activeHoles,
}: {
  round: Round;
  computation: CardComputation;
  holes: number[];
  title: string;
  mode: "scores" | "money";
  net?: boolean; // scores mode: show net (gross − pops) instead of gross
  activeHoles?: Set<number>; // press view: only these holes show data (rest blank)
}) {
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const siByHole = new Map(round.course.holes.map((h) => [h.number, h.strokeIndex]));
  const resultByHole = new Map(computation.results.map((r) => [r.hole, r]));
  const grossOf = (pid: string, h: number) => entryByHole.get(h)?.grossScores[pid];
  const popsOf = (pid: string, h: number) => computation.pops[pid]?.[h] ?? 0;
  const moneyOf = (pid: string, h: number) => resultByHole.get(h)?.deltas[pid] ?? 0;
  const isActive = (h: number) => !activeHoles || activeHoles.has(h);
  const totalLabel = title === "Front" ? "OUT" : "IN";
  const parTotal = holes
    .filter(isActive)
    .reduce((s, h) => s + (parByHole.get(h) ?? 0), 0);
  const playerTotal = (pid: string) =>
    mode === "money"
      ? holes.filter(isActive).reduce((s, h) => s + moneyOf(pid, h), 0)
      : holes.filter(isActive).reduce((s, h) => {
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
                  // Press view: holes outside the press are left blank.
                  if (!isActive(h)) {
                    return <td key={h} className="px-1.5 py-2" />;
                  }
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
  net = false,
  activeHoles,
}: {
  round: Round;
  computation: CardComputation;
  player: Player;
  from: number;
  label: string;
  mode: "scores" | "money";
  net?: boolean; // scores mode: show net (gross − pops) instead of gross
  activeHoles?: Set<number>; // press view: only these holes show data (rest blank)
}) {
  const nums = Array.from({ length: 9 }, (_, i) => from + i);
  const isActive = (n: number) => !activeHoles || activeHoles.has(n);
  const entryByHole = new Map(round.entries.map((e) => [e.hole, e]));
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const resultByHole = new Map(computation.results.map((r) => [r.hole, r]));
  const grossOf = (h: number) => entryByHole.get(h)?.grossScores[player.id];
  const popsOf = (h: number) => computation.pops[player.id]?.[h] ?? 0;
  const moneyOf = (h: number) => resultByHole.get(h)?.deltas[player.id] ?? 0;
  // Score shown per hole — gross, or net when the toggle is on.
  const shownOf = (h: number) => {
    const g = grossOf(h);
    return typeof g === "number" ? (net ? g - popsOf(h) : g) : undefined;
  };
  const parTotal = nums
    .filter(isActive)
    .reduce((s, n) => s + (parByHole.get(n) ?? 0), 0);
  const total =
    mode === "scores"
      ? nums.filter(isActive).reduce((s, n) => s + (shownOf(n) ?? 0), 0)
      : nums.filter(isActive).reduce((s, n) => s + moneyOf(n), 0);

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
            // Press view: holes outside the press are left blank.
            if (!isActive(n)) return <span key={n} />;
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
            const num = shownOf(n);
            return typeof num === "number" ? (
              <StrokeCell
                key={n}
                gross={num}
                rel={num - (parByHole.get(n) ?? num)}
                pops={net ? 0 : popsOf(n)}
              />
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

// 11s: a player's net total + to-par over ONLY the holes they checked.
function elevenChosen(
  round: Round,
  computation: CardComputation,
  pid: string
): { score: number; toPar: number | null; any: boolean } {
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  let score = 0;
  let toPar: number | null = null;
  let any = false;
  for (const e of round.entries) {
    if (e.elevenPicks?.[pid] && typeof e.grossScores[pid] === "number") {
      const net = e.grossScores[pid] - (computation.pops[pid]?.[e.hole] ?? 0);
      score += net;
      toPar = (toPar ?? 0) + net - (parByHole.get(e.hole) ?? net);
      any = true;
    }
  }
  return { score, toPar, any };
}

// Gross/net pill toggle — sized to sit beside a section header.
function GrossNetToggle({
  net,
  onChange,
}: {
  net: boolean;
  onChange: (net: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-divider p-[2px] text-sm font-semibold">
      {(["gross", "net"] as const).map((v) => {
        const active = net === (v === "net");
        return (
          <button
            key={v}
            onClick={() => onChange(v === "net")}
            style={active ? { boxShadow: "0 1px 2px rgba(0,0,0,0.12)" } : undefined}
            className={`rounded-full px-3 py-0.5 capitalize transition ${
              active ? "bg-white text-accent-on-light" : "text-text-faint"
            }`}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

// ── Universal standings entry: ONE cohesive card per player. The always-visible
//    top shows the player (rank + name + to-par) and their bet-breakdown matrix —
//    rows Front/Back (+Overall for Nassau), columns Original/Press/Hammer/Total
//    (Total column tinted, totals row at the bottom). Tapping the card expands
//    that player's hole-by-hole scorecard below. `cols` is the visible column set
//    (chosen by the bet tab); `scoresOnly` forces the expand to scores. Values
//    come from the bet-breakdown matrix — presentation only.
const TINT = "#EEF2FB"; // shaded Total column

type Col = "orig" | "press" | "hammer" | "total";
const COL_LABEL: Record<Col, string> = {
  orig: "Original",
  press: "Press",
  hammer: "Hammer",
  total: "Total",
};
interface SegRow {
  label: string;
  orig: number;
  press: number;
  hammer: number;
}

function BetBreakdownBar({
  round,
  computation,
  player,
  rankIndex,
  scoreNet,
  segs,
  orig,
  press,
  hammer,
  cols,
  scoresOnly,
  pressHoles,
}: {
  round: Round;
  computation: CardComputation;
  player: Player;
  rankIndex: number;
  scoreNet: boolean;
  segs: SegRow[];
  orig: number;
  press: number;
  hammer: number;
  cols: Col[];
  scoresOnly: boolean;
  pressHoles?: Set<number> | null;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"scores" | "money">("scores");
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Blue to-par badge — over the visible holes, following the gross/net toggle.
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  let toPar: number | null = null;
  for (const e of round.entries) {
    if (pressHoles && !pressHoles.has(e.hole)) continue;
    const g = e.grossScores[player.id];
    if (typeof g === "number") {
      const s = scoreNet ? g - (computation.pops[player.id]?.[e.hole] ?? 0) : g;
      toPar = (toPar ?? 0) + s - (parByHole.get(e.hole) ?? s);
    }
  }
  // 11s: net-to-par over the player's chosen holes, shown as a blue badge.
  const chosen =
    gameTypeOf(round) === "elevens" ? elevenChosen(round, computation, player.id) : null;

  const colorOf = (v: number) => (v > 0 ? POS : v < 0 ? NEG : MUTED);
  const fmt = (v: number) => (v === 0 ? "—" : formatMoney(v));
  const segVal = (r: SegRow, c: Col) =>
    c === "orig"
      ? r.orig
      : c === "press"
        ? r.press
        : c === "hammer"
          ? r.hammer
          : r.orig + r.press + r.hammer;
  const totVal = (c: Col) =>
    c === "orig"
      ? orig
      : c === "press"
        ? press
        : c === "hammer"
          ? hammer
          : orig + press + hammer;
  const template = `minmax(0,1fr) ${cols.map((c) => (c === "total" ? "4.5rem" : "3.6rem")).join(" ")}`;
  const mode = scoresOnly ? "scores" : view;

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
    if (scoresOnly) return;
    setView(dx < 0 ? "money" : "scores");
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-l-4 border-card-border bg-card-bg"
      style={{ borderLeftColor: PRIMARY }}
    >
      <button onClick={() => setOpen((v) => !v)} className="block w-full text-left">
        {/* rank + name + to-par + chevron */}
        <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
          <span className="w-4 shrink-0 text-center font-serif text-base font-bold text-text-faint">
            {rankIndex + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">{player.name || "Unnamed"}</span>
          <span className="shrink-0 font-serif text-sm font-bold tabular-nums text-primary">
            {toPar === null ? "–" : formatToPar(toPar)}
          </span>
          {chosen?.any && (
            <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-on-dark">
              {formatToPar(chosen.toPar ?? 0)}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>

        {/* breakdown matrix */}
        <div className="overflow-x-auto pb-2.5">
          {/* column headers */}
          <div
            className="grid text-[9px] font-semibold uppercase tracking-wide text-text-faint"
            style={{ gridTemplateColumns: template }}
          >
            <div className="px-3 py-1 text-left">Segment</div>
            {cols.map((c) => (
              <div
                key={c}
                className="px-1.5 py-1 text-right"
                style={{ background: c === "total" ? TINT : undefined }}
              >
                {COL_LABEL[c]}
              </div>
            ))}
          </div>

          {/* per-segment rows */}
          {segs.map((r) => (
            <div key={r.label} className="grid items-center" style={{ gridTemplateColumns: template }}>
              <div className="px-3 py-1 text-left text-xs font-semibold" style={{ color: INK }}>
                {r.label}
              </div>
              {cols.map((c) => {
                const v = segVal(r, c);
                return (
                  <div
                    key={c}
                    className="px-1.5 py-1 text-right text-xs tabular-nums"
                    style={{ color: colorOf(v), background: c === "total" ? TINT : undefined }}
                  >
                    {fmt(v)}
                  </div>
                );
              })}
            </div>
          ))}

          {/* totals row — divider above, bold corner total */}
          <div
            className="grid items-center"
            style={{ gridTemplateColumns: template, borderTop: `1px solid ${STRONG}` }}
          >
            <div className="px-3 py-1.5 text-left text-xs font-bold" style={{ color: INK }}>
              Total
            </div>
            {cols.map((c) => {
              const v = totVal(c);
              const corner = c === "total";
              return (
                <div
                  key={c}
                  className={`px-1.5 py-1.5 text-right tabular-nums ${
                    corner ? "text-sm font-extrabold" : "text-xs font-bold"
                  }`}
                  style={{ color: colorOf(v), background: corner ? TINT : undefined }}
                >
                  {fmt(v)}
                </div>
              );
            })}
          </div>
        </div>
      </button>

      {/* Expanded: the player's hole-by-hole scorecard (same card). */}
      {open && (
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="animate-fade-in"
          style={{ background: SURFACE2, borderTop: `1px solid ${STRONG}`, padding: "8px 10px 10px", touchAction: "pan-y" }}
        >
          {!scoresOnly && (
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
          )}
          <div style={{ borderTop: `0.5px solid ${HAIRLINE}`, borderBottom: `0.5px solid ${HAIRLINE}`, padding: "5px 4px 6px", marginBottom: "6px" }}>
            <PlayerNine round={round} computation={computation} player={player} from={1} label="OUT" mode={mode} net={scoreNet} activeHoles={pressHoles ?? undefined} />
          </div>
          <div style={{ borderTop: `0.5px solid ${HAIRLINE}`, borderBottom: `0.5px solid ${HAIRLINE}`, padding: "5px 4px 6px" }}>
            <PlayerNine round={round} computation={computation} player={player} from={10} label="IN" mode={mode} net={scoreNet} activeHoles={pressHoles ?? undefined} />
          </div>
        </div>
      )}
    </div>
  );
}

export function CardTab({
  round,
  computation,
  betMatrix,
  trend,
  pressCards,
}: {
  round: Round;
  computation: CardComputation;
  betMatrix?: BetMatrix;
  trend?: Record<string, number>[]; // money after each played hole (trendline)
  pressCards?: PressCardView[]; // individual presses (Press-tab sub-selector)
}) {
  const front = Array.from({ length: 9 }, (_, i) => i + 1);
  const back = Array.from({ length: 9 }, (_, i) => i + 10);
  const [scoreView, setScoreView] = useState<"gross" | "net">("gross");
  const net = scoreView === "net";
  // Shared gross/net toggle for the standings dropdowns — flipping it in any one
  // player's scorecard updates the blue +/- on every standings row.
  const [scoreNet, setScoreNet] = useState(false);
  // The bet lens: Total shows the whole matrix; Original/Press/Hammer narrow it to
  // that one column and show scores in the scorecards.
  const [bet, setBet] = useState<BetTab>("total");
  // Within the Press tab: "total" (all presses) or a single press by index.
  const [pressView, setPressView] = useState<number | "total">("total");

  const gt = gameTypeOf(round);
  const noHoleMoney = gt === "elevens" || gt === "nassau";
  const hasPress = !!betMatrix?.hasPress;
  const hasHammer = !!betMatrix?.hasHammer;

  // Tabs that apply, in order: Total always; Original when anything is broken out;
  // Press / Hammer only when that bet exists in the round.
  const betTabs = (["total", "original", "press", "hammer"] as const).filter(
    (b) =>
      b === "total" ||
      (b === "original" && (hasPress || hasHammer)) ||
      (b === "press" && hasPress) ||
      (b === "hammer" && hasHammer)
  );
  const activeBet: BetTab = betTabs.includes(bet) ? bet : "total";
  const showToggle = betTabs.length > 1;

  // Visible matrix columns for the active tab. Only show a column if that bet
  // exists; with no press and no hammer it's just the Total column.
  const cols: Col[] =
    activeBet === "original"
      ? ["orig"]
      : activeBet === "press"
        ? ["press"]
        : activeBet === "hammer"
          ? ["hammer"]
          : [
              ...(hasPress || hasHammer ? (["orig"] as Col[]) : []),
              ...(hasPress ? (["press"] as Col[]) : []),
              ...(hasHammer ? (["hammer"] as Col[]) : []),
              "total" as Col,
            ];

  // Non-total tabs (and total/segment games) show scores in the scorecard.
  const scoresOnly = activeBet !== "total" || noHoleMoney;

  // Press tab: optionally scope the scorecards to one press's holes.
  const onePress =
    activeBet === "press" && typeof pressView === "number" ? pressCards?.[pressView] : undefined;
  const activeHoles =
    activeBet === "press" ? (onePress ? onePress.holes : pressedHoles(round)) : undefined;

  // Standings sort by the active column's per-player total.
  const colTotal = (pid: string) => {
    const pm = betMatrix?.player[pid];
    if (!pm) return computation.ledger[pid] ?? 0;
    const grand = pm.orig + pm.press + pm.hammer;
    return activeBet === "original"
      ? pm.orig
      : activeBet === "press"
        ? pm.press
        : activeBet === "hammer"
          ? pm.hammer
          : grand;
  };
  const standings = [...round.players].sort((a, b) => colTotal(b.id) - colTotal(a.id));

  // By-hole money ledger: only on the Total tab of per-hole games.
  const showLedger = !noHoleMoney && activeBet === "total";

  return (
    <div className="space-y-6">
      {/* Bet lens: Total / Original / Press / Hammer. Pinned below the tab bar. */}
      {showToggle && (
        <div
          className="sticky z-10 -mx-3 bg-page-bg px-3 py-2"
          style={{ top: "calc(var(--header-h, 88px) + 3.4rem)" }}
        >
          <div className="flex gap-1 rounded-full bg-divider p-1 text-sm font-semibold">
            {betTabs.map((b) => (
              <button
                key={b}
                onClick={() => setBet(b)}
                style={activeBet === b ? { boxShadow: "0 1px 2px rgba(0,0,0,0.12)" } : undefined}
                className={`flex-1 rounded-full py-1.5 capitalize transition ${
                  activeBet === b ? "bg-white text-accent-on-light" : "text-text-faint"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Press tab: pick the combined presses or an individual press. */}
          {activeBet === "press" && pressCards && pressCards.length > 0 && (
            <div className="mt-2 flex gap-1 overflow-x-auto">
              <button
                onClick={() => setPressView("total")}
                style={
                  pressView === "total"
                    ? { background: "#E8590C", borderColor: "#E8590C" }
                    : undefined
                }
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
                  pressView === "total"
                    ? "text-on-dark"
                    : "border-card-border bg-card-bg text-text-muted"
                }`}
              >
                Total
              </button>
              {pressCards.map((pc, i) => (
                <button
                  key={i}
                  onClick={() => setPressView(i)}
                  style={
                    pressView === i ? { background: "#E8590C", borderColor: "#E8590C" } : undefined
                  }
                  className={`flex shrink-0 items-center gap-0.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                    pressView === i
                      ? "text-on-dark"
                      : "border-card-border bg-card-bg text-text-muted"
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  {pc.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Standings → one bar per player: breakdown matrix up top, tap to expand */}
      <section className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Standings</h2>
          <GrossNetToggle net={scoreNet} onChange={setScoreNet} />
        </div>
        {standings.map((p) => {
          const t = colTotal(p.id);
          // Tie-aware rank: 1 + number of players strictly ahead.
          const rankIndex = standings.filter((q) => colTotal(q.id) > t).length;
          const pm = betMatrix?.player[p.id] ?? { segs: [], orig: 0, press: 0, hammer: 0 };
          return (
            <BetBreakdownBar
              key={p.id}
              round={round}
              computation={computation}
              player={p}
              rankIndex={rankIndex}
              scoreNet={scoreNet}
              segs={pm.segs}
              orig={pm.orig}
              press={pm.press}
              hammer={pm.hammer}
              cols={cols}
              scoresOnly={scoresOnly}
              pressHoles={activeHoles}
            />
          );
        })}
      </section>

      {/* By-hole money ledger (Total tab, per-hole games only) */}
      {showLedger && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Ledger</h2>
          <BigNine round={round} computation={computation} holes={front} title="Front" mode="money" activeHoles={activeHoles} />
          <BigNine round={round} computation={computation} holes={back} title="Back" mode="money" activeHoles={activeHoles} />
        </section>
      )}

      {/* Big all-players scorecard */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Scorecard</h2>
          <GrossNetToggle net={net} onChange={(n) => setScoreView(n ? "net" : "gross")} />
        </div>
        <BigNine round={round} computation={computation} holes={front} title="Front" mode="scores" net={net} activeHoles={activeHoles} />
        <BigNine round={round} computation={computation} holes={back} title="Back" mode="scores" net={net} activeHoles={activeHoles} />
        {/* Totals listed as part of the scorecard: name · total · +/- · money */}
        <Totals round={round} computation={computation} net={net} holes={activeHoles} />
      </section>

      {/* Money trendline over the holes played. */}
      {trend && trend.length > 0 && <MoneyTrend round={round} prefixLedgers={trend} />}
    </div>
  );
}

// Per-player totals listed below the scorecard: name · money · +/- · total.
// `net` follows the scorecard's gross/net toggle so the total + to-par match it.
function Totals({
  round,
  computation,
  net,
  holes,
}: {
  round: Round;
  computation: CardComputation;
  net: boolean;
  holes?: Set<number>; // limit the totals to these holes (press view)
}) {
  const parByHole = new Map(round.course.holes.map((h) => [h.number, h.par]));
  const isElevens = gameTypeOf(round) === "elevens";
  // Same order as the scorecard rows (round.players, unsorted).
  const rows = round.players.map((p) => {
    let total = 0;
    let toPar: number | null = null;
    for (const e of round.entries) {
      if (holes && !holes.has(e.hole)) continue;
      const g = e.grossScores[p.id];
      if (typeof g === "number") {
        const score = net ? g - (computation.pops[p.id]?.[e.hole] ?? 0) : g;
        total += score;
        toPar = (toPar ?? 0) + score - (parByHole.get(e.hole) ?? score);
      }
    }
    const chosenToPar = isElevens ? elevenChosen(round, computation, p.id).toPar : null;
    return { p, total, toPar, chosenToPar, money: computation.ledger[p.id] ?? 0 };
  });

  return (
    <div className="border-y border-card-border bg-surface-2">
      {rows.map(({ p, total, toPar, chosenToPar, money }, i) => (
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
            {isElevens && (
              <span className="w-10 text-right font-extrabold" style={{ color: PRIMARY }}>
                {chosenToPar === null ? "–" : formatToPar(chosenToPar)}
              </span>
            )}
            <span className="w-10 text-right font-bold" style={{ color: INK }}>
              {total || "–"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
