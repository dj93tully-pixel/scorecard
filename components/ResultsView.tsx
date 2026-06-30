// components/ResultsView.tsx
// Interactive results page for the Card tab. Standings of player bars (accordion,
// leader open by default); each expands to bet-type tiles (tappable filters), an
// individual-press sub-selector (on the Press filter), a horizontal scorecard
// whose Score + "$" rows follow the active filter, and a cumulative trendline. A
// global Gross/Net toggle swaps the Score row. Below the standings: one giant
// all-players scorecard. Presentation only — values come from buildResults.

"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ResultsData, PlayerResults, BetType, ResultTee } from "@/lib/results";
import { formatToPar } from "@/lib/storage";
import { SettleUp } from "./SettleUp";

const BLUE = "#3B78FF";
const GREEN = "#16A06A";
const RED = "#E5484D";
const MUTED = "#9098A4";
const BORDER = "#EAECEF";
const INK = "#16181D";
const HAMMER = "#7C3AED"; // purple — matches the Scores tab hammer accent
const PRESS = "#E8590C"; // orange — matches the press accent
const TOTAL_TINT = "#EEF4F0";
const TILE_ACTIVE = "#EAF1FF";

// Money to at most one decimal: $2.50 → $2.5, $5 → $5.
function money1(v: number): string {
  const r = Math.round(v * 10) / 10;
  const sign = r > 0 ? "+" : r < 0 ? "-" : "";
  const abs = Math.abs(r);
  return `${sign}$${Number.isInteger(abs) ? abs : abs.toFixed(1)}`;
}

// Ledger style: signed +/- with no $ sign. +2.5 / -2.5, zero → placeholder.
function ledgerFmt(v: number, zero = "·"): string {
  const r = Math.round(v * 10) / 10;
  if (r === 0) return zero;
  const abs = Math.abs(r);
  const body = Number.isInteger(abs) ? `${abs}` : abs.toFixed(1);
  return r < 0 ? `-${body}` : `+${body}`;
}

type Filter = BetType | "total";
const FILTER_LABEL: Record<Filter, string> = {
  total: "Total",
  original: "Original",
  press: "Press",
  hammer: "Hammer",
};

const moneyColor = (v: number) => (v > 0 ? GREEN : v < 0 ? RED : MUTED);
const dollars = (v: number) => (v === 0 ? "—" : money1(v));

// ── Gross / Net segmented toggle ─────────────────────────────────────────────
function GrossNetToggle({ net, onChange }: { net: boolean; onChange: (net: boolean) => void }) {
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

// Concentric rings = strokes from par (cap 4). Under par = circles, over = squares.
const RING_GAP = "#F4F6FA"; // gap colour between rings
function ringStyle(rel: number, ring: string = INK): React.CSSProperties {
  if (rel === 0) return {};
  const n = Math.min(Math.abs(rel), 4);
  const layers: string[] = [];
  let spread = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      spread += 1.3;
      layers.push(`0 0 0 ${spread}px ${RING_GAP}`);
    }
    spread += 1.1;
    layers.push(`0 0 0 ${spread}px ${ring}`);
  }
  return { boxShadow: layers.join(", "), borderRadius: rel < 0 ? "50%" : "3px" };
}

// ── Score cell — concentric circles (under par) / squares (over par); 4+ over is
//    a solid dark square. Text is blue when the player got a pop on the hole. ──
function ScoreCell({ score, par, pop }: { score: number | null; par: number; pop: number }) {
  if (score === null) return <span style={{ color: "#C4C8CE" }}>–</span>;
  const rel = score - par;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "17px",
    height: "17px",
    fontSize: "11px",
    fontWeight: 700,
  } as const;
  const ink = pop > 0 ? BLUE : INK; // pops turn the number AND the box/circle blue
  // 4+ over par: solid square, white number.
  if (rel > 3) {
    return <span style={{ ...base, color: "#FFFFFF", background: ink, borderRadius: "3px" }}>{score}</span>;
  }
  return (
    <span style={{ ...base, color: ink, ...ringStyle(rel, ink) }}>
      {score}
    </span>
  );
}

// Hole-number cell (the press/hammer dots get their own thin row below the par).
function HoleHead({ n, style }: { n: number | string; style?: React.CSSProperties }) {
  return (
    <div className="flex h-7 items-center justify-center" style={style}>
      <span className="text-[10px] font-bold leading-none" style={{ color: MUTED }}>
        {n}
      </span>
    </div>
  );
}

// ── One nine of a player's scorecard: holes, par, score, money ───────────────
function Nine({
  cells,
  net,
  label,
  hammerHoles,
  pressHoles,
  activeHoles,
  pickShade = INK,
  hideMoney = false,
}: {
  cells: { cell: PlayerResults["holes"][number]; m: number }[];
  net: boolean;
  label: "OUT" | "IN";
  hammerHoles: Set<number>;
  pressHoles: Set<number>;
  activeHoles: Set<number> | null; // press view: only these holes carry data
  pickShade?: string; // 11s: this player's pick-dot shade
  hideMoney?: boolean; // 11s: drop the per-hole money row
}) {
  const template = `34px repeat(${cells.length}, minmax(0,1fr)) 34px`;
  const on = (h: number) => !activeHoles || activeHoles.has(h);
  const scoreOf = (c: PlayerResults["holes"][number]) => (net ? c.net : c.gross);
  const live = cells.filter((x) => on(x.cell.hole));
  const parTotal = live.reduce((s, x) => s + x.cell.par, 0);
  const scoreTotal = live.reduce((s, x) => s + (scoreOf(x.cell) ?? 0), 0);
  const moneyTotal = live.reduce((s, x) => s + x.m, 0);

  const Cell = ({ children, tint }: { children: React.ReactNode; tint?: boolean }) => (
    <div className="flex h-7 items-center justify-center tabular-nums" style={tint ? { background: "#F6F7F9" } : undefined}>
      {children}
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 320 }}>
        {/* hole numbers */}
        <div className="grid items-center" style={{ gridTemplateColumns: template }}>
          <HoleHead n={label} />
          {cells.map((x) => (
            <HoleHead key={x.cell.hole} n={x.cell.hole} />
          ))}
          <HoleHead n={label} />
        </div>
        {/* par band */}
        <div className="grid items-center text-[10px]" style={{ gridTemplateColumns: template, background: "#F6F7F9", color: MUTED }}>
          <Cell tint>Par</Cell>
          {cells.map((x) => (
            <Cell key={x.cell.hole} tint>
              {on(x.cell.hole) ? x.cell.par : "·"}
            </Cell>
          ))}
          <Cell tint>{parTotal}</Cell>
        </div>
        {/* press / hammer dots — thin row after par. On a press/hammer filter,
            only the holes that filter covers keep their dots (like scores/money). */}
        <div className="grid items-center" style={{ gridTemplateColumns: template }}>
          <div style={{ height: 9 }} />
          {cells.map((x) => (
            <div key={x.cell.hole} className="flex items-center justify-center" style={{ height: 9 }}>
              {on(x.cell.hole) && (
                <span className="flex items-center" style={{ gap: 1 }}>
                  {x.cell.picked && <span style={{ width: 4, height: 4, borderRadius: "50%", background: pickShade }} />}
                  {pressHoles.has(x.cell.hole) && <span style={{ width: 4, height: 4, borderRadius: "50%", background: PRESS }} />}
                  {hammerHoles.has(x.cell.hole) && <span style={{ width: 4, height: 4, borderRadius: "50%", background: HAMMER }} />}
                </span>
              )}
            </div>
          ))}
          <div style={{ height: 9 }} />
        </div>
        {/* scores */}
        <div className="grid items-center" style={{ gridTemplateColumns: template }}>
          <Cell>
            <span className="text-[10px] font-semibold" style={{ color: MUTED }}>Score</span>
          </Cell>
          {cells.map((x) =>
            on(x.cell.hole) ? (
              <Cell key={x.cell.hole}>
                <ScoreCell score={scoreOf(x.cell)} par={x.cell.par} pop={x.cell.pop} />
              </Cell>
            ) : (
              <Cell key={x.cell.hole}>
                <span style={{ color: "#C4C8CE" }}>·</span>
              </Cell>
            )
          )}
          <Cell>
            <span className="text-xs font-bold" style={{ color: INK }}>{scoreTotal || "–"}</span>
          </Cell>
        </div>
        {/* money (hidden for 11s — it settles on the sum of picked holes) */}
        {!hideMoney && (
          <div className="grid items-center" style={{ gridTemplateColumns: template, borderTop: `1px solid ${BORDER}` }}>
            <Cell>
              <span className="text-[10px] font-semibold" style={{ color: MUTED }}>$</span>
            </Cell>
            {cells.map((x) => {
              const show = on(x.cell.hole) && x.m !== 0;
              return (
                <Cell key={x.cell.hole}>
                  <span className="text-[9px] font-bold tabular-nums" style={{ color: show ? moneyColor(x.m) : "#C4C8CE" }}>
                    {show ? money1(x.m) : "·"}
                  </span>
                </Cell>
              );
            })}
            <Cell>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: moneyColor(moneyTotal) }}>{dollars(moneyTotal)}</span>
            </Cell>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cumulative trendline of the active bet type across holes ──────────────────
function Trendline({ money }: { money: number[] }) {
  const cum: number[] = [];
  let run = 0;
  for (const m of money) {
    run += m;
    cum.push(run);
  }
  const n = cum.length;
  const W = 300;
  const H = 116;
  const padL = 8;
  const padR = 36;
  const padT = 12;
  const padB = 18;
  const final = cum[n - 1] ?? 0;
  const color = final >= 0 ? GREEN : RED;

  const lo = Math.min(0, ...cum);
  const hi = Math.max(0, ...cum);
  const span = hi - lo || 1;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - lo) / span) * (H - padT - padB);

  const linePts = cum.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M ${x(0)},${y(0)} L ${cum.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${x(n - 1)},${y(0)} Z`;
  const baseY = y(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cumulative winnings by hole">
      <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      <path d={area} fill={color} opacity={0.12} />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(final)} r={3} fill={color} />
      <text x={x(n - 1) + 6} y={y(final) + 4} fontSize={11} fontWeight={700} fill={color}>
        {money1(final)}
      </text>
      {[0, Math.floor((n - 1) / 2), n - 1].map((i, k) => (
        <text key={k} x={x(i)} y={H - 4} fontSize={9} fontWeight={600} fill={MUTED} textAnchor="middle">
          {i + 1}
        </text>
      ))}
    </svg>
  );
}

// ── A player's expanded detail: tiles → (press sub-selector) → scorecard → chart
function Detail({
  player,
  results,
  net,
  filter,
  setFilter,
  pressSel,
  setPressSel,
  pickShade,
}: {
  player: PlayerResults;
  results: ResultsData;
  net: boolean;
  filter: Filter;
  setFilter: (f: Filter) => void;
  pressSel: number | "all";
  setPressSel: (s: number | "all") => void;
  pickShade: string;
}) {
  const { betTypes, presses, pressHoles, hammerHoles } = results;
  const tiles: Filter[] = [...betTypes, "total"];
  const hammerSet = useMemo(() => new Set(hammerHoles), [hammerHoles]);
  const pressSet = useMemo(() => new Set(pressHoles), [pressHoles]);
  // Holes the hammer "affects": the hammered holes themselves, plus any hole the
  // hammer money landed on (carryover). Money is zero-sum, so a hole counts if
  // any player has a non-zero hammer delta there.
  const hammerActive = useMemo(() => {
    const s = new Set<number>(hammerHoles);
    player.holes.forEach((c, i) => {
      if (results.players.some((pl) => (pl.money.hammer[i] ?? 0) !== 0)) s.add(c.hole);
    });
    return s;
  }, [hammerHoles, results.players, player.holes]);

  // Active money + (for press) the holes the press covers.
  let active: number[];
  let activeHoles: Set<number> | null = null;
  let pill = FILTER_LABEL[filter];
  if (filter === "press") {
    if (pressSel === "all" || !presses[pressSel]) {
      active = player.money.press;
      activeHoles = new Set(pressHoles);
      pill = "Press";
    } else {
      active = presses[pressSel].money[player.id] ?? player.money.press;
      activeHoles = new Set(presses[pressSel].holes);
      pill = presses[pressSel].label;
    }
  } else if (filter === "hammer") {
    active = player.money.hammer;
    activeHoles = hammerActive; // only hammered + carryover holes show scores
  } else {
    active = player.money[filter];
  }

  const front = player.holes.map((cell, i) => ({ cell, m: active[i] })).filter((x) => x.cell.hole <= 9);
  const back = player.holes.map((cell, i) => ({ cell, m: active[i] })).filter((x) => x.cell.hole >= 10);

  const sumMoney = (type: Filter) => player.money[type].reduce((s, v) => s + v, 0);
  const liveHole = (h: number) => !activeHoles || activeHoles.has(h);
  const parTotal = player.holes.filter((c) => liveHole(c.hole)).reduce((s, c) => s + c.par, 0);
  const scoreTotal = player.holes
    .filter((c) => liveHole(c.hole))
    .reduce((s, c) => s + ((net ? c.net : c.gross) ?? 0), 0);
  const grand = active.reduce((s, v) => s + v, 0);

  return (
    <div style={{ background: "#FAFBFC", borderTop: `1px solid ${BORDER}`, padding: "10px" }}>
      {/* bet-type tiles (tappable filters) */}
      <div className="mb-2 flex gap-1.5 overflow-x-auto">
        {tiles.map((t) => {
          const on = filter === t;
          return (
            <button
              key={t}
              onClick={() => {
                // Tapping an already-active tile (other than Total) deselects it
                // back to Total — a toggle.
                const next = on && t !== "total" ? "total" : t;
                setFilter(next);
                if (next === "press") setPressSel("all");
              }}
              className="flex min-w-[68px] flex-1 flex-col items-start rounded-lg border px-2.5 py-1.5"
              style={{ borderColor: on ? BLUE : BORDER, background: on ? TILE_ACTIVE : "#FFFFFF" }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>
                {FILTER_LABEL[t]}
              </span>
              <span className="font-serif text-sm font-extrabold tabular-nums" style={{ color: moneyColor(sumMoney(t)) }}>
                {dollars(sumMoney(t))}
              </span>
            </button>
          );
        })}
      </div>

      {/* individual-press sub-selector (Press filter only) */}
      {filter === "press" && presses.length > 0 && (
        <div className="mb-3 flex gap-1 overflow-x-auto">
          {(["all", ...presses.map((_, i) => i)] as (number | "all")[]).map((s) => {
            const on = pressSel === s;
            const label = s === "all" ? "All" : presses[s as number].label;
            return (
              <button
                key={String(s)}
                onClick={() => setPressSel(s)}
                className="shrink-0 rounded-full border px-3 py-1 text-xs font-bold"
                style={
                  on
                    ? { background: BLUE, borderColor: BLUE, color: "#fff" }
                    : { borderColor: BORDER, color: MUTED, background: "#fff" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* horizontal scorecard */}
      <div className="overflow-hidden rounded-xl border bg-card-bg" style={{ borderColor: BORDER }}>
        <Nine cells={front} net={net} label="OUT" hammerHoles={hammerSet} pressHoles={pressSet} activeHoles={activeHoles} pickShade={pickShade} hideMoney={results.isElevens} />
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          <Nine cells={back} net={net} label="IN" hammerHoles={hammerSet} pressHoles={pressSet} activeHoles={activeHoles} pickShade={pickShade} hideMoney={results.isElevens} />
        </div>
        <div
          className="grid items-center text-xs font-bold tabular-nums"
          style={{ gridTemplateColumns: "1fr auto auto auto", background: TOTAL_TINT, borderTop: `1px solid ${BORDER}`, padding: "6px 10px", gap: "14px" }}
        >
          <span style={{ color: INK }}>Total</span>
          <span style={{ color: MUTED }}>Par {parTotal}</span>
          <span style={{ color: INK }}>Score {scoreTotal || "–"}</span>
          <span style={{ color: moneyColor(grand) }}>{dollars(grand)}</span>
        </div>
      </div>

      {/* winnings by hole — not meaningful for 11s (sum-of-picks game) */}
      {!results.isElevens && (
        <div className="mt-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>Winnings by hole</span>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide" style={{ background: TILE_ACTIVE, color: BLUE }}>
              {pill}
            </span>
          </div>
          <Trendline money={active} />
        </div>
      )}
    </div>
  );
}

// ── One player's standings bar (accordion) ───────────────────────────────────
function PlayerBar({
  player,
  rank,
  open,
  onToggle,
  results,
  net,
  filter,
  setFilter,
  pressSel,
  setPressSel,
  pickShade,
}: {
  player: PlayerResults;
  rank: number;
  open: boolean;
  onToggle: () => void;
  results: ResultsData;
  net: boolean;
  filter: Filter;
  setFilter: (f: Filter) => void;
  pressSel: number | "all";
  setPressSel: (s: number | "all") => void;
  pickShade: string;
}) {
  // Full-round score to par, following the gross/net toggle.
  let toPar: number | null = null;
  // 11s: the player's score is the sum of net/gross-to-par over their picked holes.
  let elevenToPar: number | null = null;
  for (const c of player.holes) {
    const s = net ? c.net : c.gross;
    if (s === null) continue;
    toPar = (toPar ?? 0) + s - c.par;
    if (c.picked) elevenToPar = (elevenToPar ?? 0) + s - c.par;
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card-bg" style={{ borderColor: BORDER, borderLeft: `4px solid ${open ? BLUE : "#AFC6FF"}` }}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="w-4 text-center font-serif text-base font-bold" style={{ color: MUTED }}>{rank}</span>
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate font-semibold" style={{ color: INK }}>{player.name}</span>
          <span className="shrink-0 font-serif text-sm font-bold tabular-nums" style={{ color: net ? BLUE : INK }}>
            {toPar === null ? "–" : formatToPar(toPar)}
          </span>
          {results.isElevens && (
            <span
              className="shrink-0 self-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
              style={{ background: BLUE, color: "#fff" }}
            >
              {elevenToPar === null ? "–" : formatToPar(elevenToPar)}
            </span>
          )}
        </span>
        <span className="font-serif text-lg font-extrabold tabular-nums" style={{ color: moneyColor(player.grand) }}>
          {money1(player.grand)}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: MUTED }} />
      </button>
      {open && (
        <Detail
          player={player}
          results={results}
          net={net}
          filter={filter}
          setFilter={setFilter}
          pressSel={pressSel}
          setPressSel={setPressSel}
          pickShade={pickShade}
        />
      )}
    </div>
  );
}

// ── Traditional course-style scorecard: full grid, green header band, a colored
//    tee-distance row per tee, shaded Par, Hcp, then player rows. Scorecard only.
const GRID = "#D5D9DE";
const HEADER_BG = "#1E7A46"; // scorecard header (green)
const LEDGER_HEADER = "#1E3A6E"; // ledger header (navy blue)

function hexToRgb(hex?: string): [number, number, number] | null {
  if (!hex) return null;
  const h = hex.replace("#", "");
  if (h.length < 6) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
// Readable text color over a tee color (dark text on light tees, white on dark).
function readable(hex?: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#FFFFFF";
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] > 150 ? "#1A1A1A" : "#FFFFFF";
}
// A very light tint of the tee color over white for the yardage band.
function tintOf(hex?: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#F7F8FA";
  const mix = (c: number) => Math.round(c * 0.12 + 255 * 0.88);
  return `rgb(${mix(rgb[0])},${mix(rgb[1])},${mix(rgb[2])})`;
}

// Shared grid cell for the traditional scorecard + ledger. `h` = row height (px).
function GridCell({
  children,
  bg,
  color,
  bold,
  left,
  h = 26,
  style,
}: {
  children: React.ReactNode;
  bg?: string;
  color?: string;
  bold?: boolean;
  left?: boolean;
  h?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="flex items-center text-[10px] tabular-nums"
      style={{
        height: h,
        background: bg ?? "#FFFFFF",
        color,
        fontWeight: bold ? 700 : undefined,
        justifyContent: left ? "flex-start" : "center",
        paddingLeft: left ? "6px" : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Header hole cell: white number on the header band.
function HeaderHoleCell({ n, bg = HEADER_BG }: { n: number | string; bg?: string }) {
  return (
    <div className="flex h-[26px] items-center justify-center" style={{ background: bg }}>
      <span className="text-[10px] font-bold leading-none text-white">{n}</span>
    </div>
  );
}

// Per-player pick-dot shades (11s) — distinct so you can tell whose pick is whose.
const PICK_SHADES = ["#16181D", "#2563EB", "#0D9488", "#B45309", "#7C3AED", "#BE185D"];

// A very thin row directly under the header for the press (orange) / hammer
// (purple) dots — plus 11s pick dots (one per player who picked, in their shade).
// Returns the cells as direct children of the surrounding grid. `trailing` =
// number of empty cells after the holes (OUT, and +/- on the scorecard).
function DotsRowFragment({
  holeNums,
  hammerHoles,
  pressHoles,
  trailing,
  pickers,
}: {
  holeNums: number[];
  hammerHoles: Set<number>;
  pressHoles: Set<number>;
  trailing: number;
  pickers?: { picked: Set<number>; shade: string }[];
}) {
  const blank = (k: string) => <div key={k} style={{ background: "#FFFFFF", height: 9 }} />;
  return (
    <>
      {blank("lead")}
      {holeNums.map((h) => (
        <div key={`dot${h}`} className="flex items-center justify-center" style={{ background: "#FFFFFF", height: 9 }}>
          <span className="flex items-center" style={{ gap: 1 }}>
            {pickers?.map((pk, i) =>
              pk.picked.has(h) ? (
                <span key={`p${i}`} style={{ width: 3, height: 3, borderRadius: "50%", background: pk.shade }} />
              ) : null
            )}
            {pressHoles.has(h) && <span style={{ width: 4, height: 4, borderRadius: "50%", background: PRESS }} />}
            {hammerHoles.has(h) && <span style={{ width: 4, height: 4, borderRadius: "50%", background: HAMMER }} />}
          </span>
        </div>
      ))}
      {Array.from({ length: trailing }, (_, i) => blank(`t${i}`))}
    </>
  );
}

function ScorecardNine({
  players,
  holeNums,
  net,
  label,
  hammerHoles,
  pressHoles,
  tees,
}: {
  players: PlayerResults[];
  holeNums: number[];
  net: boolean;
  label: "OUT" | "IN";
  hammerHoles: Set<number>;
  pressHoles: Set<number>;
  tees: ResultTee[];
}) {
  const template = `46px repeat(${holeNums.length}, minmax(0,1fr)) 28px 26px`;
  const parByHole = new Map(players[0]?.holes.map((c) => [c.hole, c.par]) ?? []);
  const siByHole = new Map(players[0]?.holes.map((c) => [c.hole, c.si]) ?? []);
  const parTotal = holeNums.reduce((s, h) => s + (parByHole.get(h) ?? 0), 0);
  // 11s pick dots — one per player who picked, in their standings-order shade.
  const pickers = players.map((p, i) => ({
    picked: new Set(p.holes.filter((c) => c.picked).map((c) => c.hole)),
    shade: PICK_SHADES[i % PICK_SHADES.length],
  }));

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 340, border: `1px solid ${GRID}` }}>
        <div style={{ display: "grid", gridTemplateColumns: template, gap: "1px", background: GRID }}>
          {/* HEADER band */}
          <GridCell bg={HEADER_BG} color="#fff" bold left>HOLE</GridCell>
          {holeNums.map((h) => (
            <HeaderHoleCell key={`hd${h}`} n={h} />
          ))}
          <GridCell bg={HEADER_BG} color="#fff" bold>{label}</GridCell>
          <GridCell bg={HEADER_BG} color="#fff" bold>+/-</GridCell>

          {/* TEE distance rows — one per tee, colored by tee */}
          {tees.map((t) => {
            const txt = readable(t.color);
            const band = tintOf(t.color);
            const nineTot = holeNums.reduce((s, h) => s + (t.distanceByHole[h] ?? 0), 0);
            const labelStyle = txt === "#1A1A1A" ? { boxShadow: "inset 0 0 0 1px #C2CAD8" } : undefined;
            return (
              <Fragment key={`tee-${t.name}`}>
                <GridCell bg={t.color ?? "#9098A4"} color={txt} bold left style={labelStyle}>
                  <span className="truncate">{t.name}</span>
                </GridCell>
                {holeNums.map((h) => (
                  <GridCell key={`${t.name}-${h}`} bg={band} color="#525861">{t.distanceByHole[h] ?? ""}</GridCell>
                ))}
                <GridCell bg={band} color="#525861" bold>{nineTot || ""}</GridCell>
                <GridCell bg={band}> </GridCell>
              </Fragment>
            );
          })}

          {/* PAR */}
          <GridCell h={18} bg="#E8EBF0" color={MUTED} bold left>Par</GridCell>
          {holeNums.map((h) => (
            <GridCell key={`par${h}`} h={18} bg="#E8EBF0" color={INK} bold>{parByHole.get(h)}</GridCell>
          ))}
          <GridCell h={18} bg="#E8EBF0" color={INK} bold>{parTotal}</GridCell>
          <GridCell h={18} bg="#E8EBF0"> </GridCell>

          {/* HCP */}
          <GridCell h={18} bg="#F4F6F8" color={MUTED} left>Hcp</GridCell>
          {holeNums.map((h) => (
            <GridCell key={`hcp${h}`} h={18} bg="#F4F6F8" color={MUTED}>{siByHole.get(h)}</GridCell>
          ))}
          <GridCell h={18} bg="#F4F6F8"> </GridCell>
          <GridCell h={18} bg="#F4F6F8"> </GridCell>

          {/* press / hammer dots + 11s pick dots — their own thin row, below Hcp */}
          <DotsRowFragment holeNums={holeNums} hammerHoles={hammerHoles} pressHoles={pressHoles} trailing={2} pickers={pickers} />

          {/* PLAYER rows */}
          {players.map((p) => {
            const idxByHole = new Map(p.holes.map((c, i) => [c.hole, i]));
            let scoreTot = 0;
            let toPar = 0;
            let anyScore = false;
            const holeCells = holeNums.map((h) => {
              const i = idxByHole.get(h);
              const c = i === undefined ? undefined : p.holes[i];
              const s = c ? (net ? c.net : c.gross) : null;
              if (s !== null) {
                scoreTot += s;
                toPar += s - (c?.par ?? 0);
                anyScore = true;
              }
              return (
                <GridCell key={`${p.id}-${h}`}>
                  <ScoreCell score={s} par={c?.par ?? 4} pop={c?.pop ?? 0} />
                </GridCell>
              );
            });
            return (
              <Fragment key={p.id}>
                <GridCell left>
                  <span className="truncate text-[11px] font-semibold" style={{ color: INK }}>{p.name}</span>
                </GridCell>
                {holeCells}
                <GridCell bold color={INK}>{scoreTot || "–"}</GridCell>
                <GridCell bold color={net ? BLUE : INK}>{anyScore ? formatToPar(toPar) : "–"}</GridCell>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── By-hole ledger, styled like the scorecard grid: green HOLE header + Par row
//    (no tee distances, no Hcp), then each player's per-hole total money. ──────
function LedgerNine({
  players,
  holeNums,
  label,
  hammerHoles,
  pressHoles,
}: {
  players: PlayerResults[];
  holeNums: number[];
  label: "OUT" | "IN";
  hammerHoles: Set<number>;
  pressHoles: Set<number>;
}) {
  const template = `46px repeat(${holeNums.length}, minmax(0,1fr)) 36px`;
  const parByHole = new Map(players[0]?.holes.map((c) => [c.hole, c.par]) ?? []);
  const parTotal = holeNums.reduce((s, h) => s + (parByHole.get(h) ?? 0), 0);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 330, border: `1px solid ${GRID}` }}>
        <div style={{ display: "grid", gridTemplateColumns: template, gap: "1px", background: GRID }}>
          {/* HEADER band */}
          <GridCell bg={LEDGER_HEADER} color="#fff" bold left>HOLE</GridCell>
          {holeNums.map((h) => (
            <HeaderHoleCell key={`hd${h}`} n={h} bg={LEDGER_HEADER} />
          ))}
          <GridCell bg={LEDGER_HEADER} color="#fff" bold>{label}</GridCell>

          {/* PAR */}
          <GridCell h={18} bg="#E8EBF0" color={MUTED} bold left>Par</GridCell>
          {holeNums.map((h) => (
            <GridCell key={`par${h}`} h={18} bg="#E8EBF0" color={INK} bold>{parByHole.get(h)}</GridCell>
          ))}
          <GridCell h={18} bg="#E8EBF0" color={INK} bold>{parTotal}</GridCell>

          {/* press / hammer dots — their own thin row, below Par */}
          <DotsRowFragment holeNums={holeNums} hammerHoles={hammerHoles} pressHoles={pressHoles} trailing={1} />

          {/* PLAYER money rows */}
          {players.map((p) => {
            const idxByHole = new Map(p.holes.map((c, i) => [c.hole, i]));
            let tot = 0;
            const cells = holeNums.map((h) => {
              const i = idxByHole.get(h);
              const m = i === undefined ? 0 : p.money.total[i];
              tot += m;
              return (
                <GridCell key={`${p.id}-${h}`} color={m === 0 ? "#C4C8CE" : moneyColor(m)} style={{ fontWeight: 600 }}>
                  {ledgerFmt(m)}
                </GridCell>
              );
            });
            return (
              <Fragment key={p.id}>
                <GridCell left>
                  <span className="truncate text-[11px] font-semibold" style={{ color: INK }}>{p.name}</span>
                </GridCell>
                {cells}
                {/* the sum column — heavier weight than the per-hole cells */}
                <GridCell color={moneyColor(tot)} style={{ fontWeight: 800 }}>{ledgerFmt(tot, "—")}</GridCell>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ResultsView({ results }: { results: ResultsData }) {
  const standings = useMemo(
    () => [...results.players].sort((a, b) => b.grand - a.grand),
    [results.players]
  );
  const [net, setNet] = useState(false);
  // No bar is open by default — the player must tap one.
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("total");
  const [pressSel, setPressSel] = useState<number | "all">("all");

  const hammerSet = useMemo(() => new Set(results.hammerHoles), [results.hammerHoles]);
  const pressSet = useMemo(() => new Set(results.pressHoles), [results.pressHoles]);
  const front = useMemo(() => standings[0]?.holes.filter((c) => c.hole <= 9).map((c) => c.hole) ?? [], [standings]);
  const back = useMemo(() => standings[0]?.holes.filter((c) => c.hole >= 10).map((c) => c.hole) ?? [], [standings]);

  const toggle = (id: string) => {
    if (openId === id) {
      setOpenId(null);
    } else {
      setOpenId(id);
      setFilter("total");
      setPressSel("all");
    }
  };

  return (
    <div className="space-y-6">
      {/* Standings header + Gross/Net — pinned for the whole card tab, since the
          toggle affects every section below, not just the standings. */}
      <div
        className="sticky z-20 -mx-3 flex items-center justify-between bg-page-bg px-3 py-2"
        style={{ top: "calc(var(--header-h, 88px) + 3.4rem)" }}
      >
        <h2 className="text-xl font-bold">Standings</h2>
        <GrossNetToggle net={net} onChange={setNet} />
      </div>
      <div className="space-y-2">
        {standings.map((p, idx) => {
          const rank = 1 + standings.filter((q) => q.grand > p.grand).length;
          return (
            <PlayerBar
              key={p.id}
              player={p}
              rank={rank}
              open={openId === p.id}
              onToggle={() => toggle(p.id)}
              results={results}
              net={net}
              filter={filter}
              setFilter={setFilter}
              pressSel={pressSel}
              setPressSel={setPressSel}
              pickShade={PICK_SHADES[idx % PICK_SHADES.length]}
            />
          );
        })}
      </div>

      {/* By-hole ledger — styled like the scorecard grid (HOLE + Par only). 11s
          settles on the sum of picked holes, so a per-hole ledger isn't relevant. */}
      {!results.isElevens && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Ledger</h2>
          <LedgerNine players={standings} holeNums={front} label="OUT" hammerHoles={hammerSet} pressHoles={pressSet} />
          <LedgerNine players={standings} holeNums={back} label="IN" hammerHoles={hammerSet} pressHoles={pressSet} />
        </section>
      )}

      {/* Traditional course-style all-players scorecard */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Scorecard</h2>
        <ScorecardNine players={standings} holeNums={front} net={net} label="OUT" hammerHoles={hammerSet} pressHoles={pressSet} tees={results.tees} />
        <ScorecardNine players={standings} holeNums={back} net={net} label="IN" hammerHoles={hammerSet} pressHoles={pressSet} tees={results.tees} />
      </section>

      {/* Who pays whom — the main game money only (side bets settle on their tab). */}
      <SettleUp people={results.players.map((p) => ({ name: p.name, amount: p.grand }))} />
    </div>
  );
}
