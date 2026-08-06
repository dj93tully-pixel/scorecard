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
import { JunkIcon, hasJunkIcon } from "./JunkChips";

const BLUE = "#3B78FF";
const GREEN = "#16A06A";
const RED = "#E5484D";
const MUTED = "#9098A4";
const BORDER = "#EAECEF";
const INK = "#16181D";
const HAMMER = "#7C3AED"; // purple — matches the Scores tab hammer accent
const PRESS = "#E8590C"; // orange — matches the press accent
const TILE_ACTIVE = "#EAF1FF";

// Money to cents: $5 → $5, $2.50 → $2.50, $0.75 → $0.75. Uses 2 decimals (matching
// formatMoney + settle-up) so the Card-tab standings/ledger never disagree with the
// amount a player is actually told to pay (1-decimal rounding turned $0.75 into $0.8).
function money1(v: number): string {
  const r = Math.round(v * 100) / 100;
  const sign = r > 0 ? "+" : r < 0 ? "-" : "";
  const abs = Math.abs(r);
  return `${sign}$${Number.isInteger(abs) ? abs : abs.toFixed(2)}`;
}

// Ledger style: signed +/- with no $ sign. +2.50 / -2.50, zero → placeholder. Also 2dp
// so per-hole cells reconcile with the row total and the settle-up.
function ledgerFmt(v: number, zero = "·"): string {
  const r = Math.round(v * 100) / 100;
  if (r === 0) return zero;
  const abs = Math.abs(r);
  const body = Number.isInteger(abs) ? `${abs}` : abs.toFixed(2);
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

// Scorecard marker dots (below the par band). Filled = the bet is live ON this hole
// (gray = base bet on every hole, orange = press, purple = hammer). Hollow purple ring =
// a hammered value was CARRIED into this hole (relevant, but no new money added there).
const filledDot = (color: string): React.CSSProperties => ({
  width: 4,
  height: 4,
  borderRadius: "50%",
  background: color,
});
const hollowRing = (color: string): React.CSSProperties => ({
  width: 5,
  height: 5,
  borderRadius: "50%",
  border: `1px solid ${color}`,
  boxSizing: "border-box",
});

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

// ── Players / Teams segmented toggle (team games only) ────────────────────────
function ViewToggle({ team, onChange }: { team: boolean; onChange: (team: boolean) => void }) {
  return (
    <div className="inline-flex rounded-full bg-divider p-[2px] text-sm font-semibold">
      {([false, true] as const).map((v) => {
        const active = team === v;
        return (
          <button
            key={String(v)}
            onClick={() => onChange(v)}
            style={active ? { boxShadow: "0 1px 2px rgba(0,0,0,0.12)" } : undefined}
            className={`rounded-full px-3 py-0.5 transition ${
              active ? "bg-white text-accent-on-light" : "text-text-faint"
            }`}
          >
            {v ? "Teams" : "Players"}
          </button>
        );
      })}
    </div>
  );
}

// Aggregate individual results into one pseudo-player per team: best-ball score
// per hole (the counting ball), summed money, summed junk. Zero-sum across teams.
function buildTeamPlayers(results: ResultsData): PlayerResults[] {
  if (!results.teams) return [];
  const byId = new Map(results.players.map((p) => [p.id, p]));
  const n = results.players[0]?.holes.length ?? 0;
  return results.teams.map((team) => {
    const members = team.playerIds.map((id) => byId.get(id)).filter((p): p is PlayerResults => !!p);
    const holes: PlayerResults["holes"] = Array.from({ length: n }, (_, i) => {
      const base = members[0].holes[i];
      const grosses = members.map((m) => m.holes[i].gross).filter((v): v is number => v !== null);
      const nets = members.map((m) => m.holes[i].net).filter((v): v is number => v !== null);
      return {
        hole: base.hole,
        par: base.par,
        si: base.si,
        gross: grosses.length ? Math.min(...grosses) : null,
        net: nets.length ? Math.min(...nets) : null,
        pop: 0,
        picked: false,
      };
    });
    const sumArr = (key: "original" | "press" | "hammer" | "total") =>
      Array.from({ length: n }, (_, i) => members.reduce((s, m) => s + (m.money[key][i] ?? 0), 0));
    const names = members.map((m) => (m.name || "Unnamed").split(/\s+/)[0]).join(" / ");
    return {
      id: `team-${team.label}`,
      name: names || `Team ${team.label}`,
      handicap: 0,
      holes,
      money: { original: sumArr("original"), press: sumArr("press"), hammer: sumArr("hammer"), total: sumArr("total") },
      grand: members.reduce((s, m) => s + m.grand, 0),
      junk: members.reduce((s, m) => s + m.junk, 0),
    };
  });
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
//    a solid dark square. Text is blue when the player got a pop on the hole.
//    Before a hole is scored, an upcoming pop shows as blue dot(s) (one per
//    stroke) in place of the "–", so players see where/how many pops they get. ──
function ScoreCell({ score, par, pop }: { score: number | null; par: number; pop: number }) {
  if (score === null) {
    if (pop > 0) {
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", color: BLUE, fontWeight: 800 }}>
          {Array.from({ length: Math.min(pop, 4) }).map((_, i) => (
            <span key={i}>–</span>
          ))}
        </span>
      );
    }
    return <span style={{ color: "#C4C8CE" }}>–</span>;
  }
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

// ── One nine of a player's scorecard: holes, par, score, money ───────────────
function Nine({
  cells,
  net,
  label,
  hammerHoles,
  pressCount,
  baseBetGame,
  carriedHammerHoles,
  activeHoles,
  filter,
  pickShade = INK,
  hideMoney = false,
}: {
  cells: { cell: PlayerResults["holes"][number]; m: number }[];
  net: boolean;
  label: "OUT" | "IN";
  hammerHoles: Set<number>;
  pressCount: Record<number, number>; // presses covering a hole → that many orange dots
  baseBetGame: boolean; // per-hole base bet exists → filled gray dot on non-carry holes
  carriedHammerHoles: Set<number>; // received a carried hammer → hollow purple ring
  activeHoles: Set<number> | null; // press view: only these holes carry data
  filter: Filter; // active bet filter — dots show only their own type unless "total"
  pickShade?: string; // 11s: this player's pick-dot shade
  hideMoney?: boolean; // 11s: drop the per-hole money row
}) {
  // Which dot families to draw for the active filter: Total shows all; each bet
  // filter shows only its own color (gray = base bet, orange = press, purple = hammer).
  const showBase = filter === "total" || filter === "original";
  const showPress = filter === "total" || filter === "press";
  const showHammer = filter === "total" || filter === "hammer";
  // Trailing OUT/IN total column is wider than the hole columns so a big 9-hole
  // money tally (e.g. hammered "+$240") doesn't overflow and overlap.
  const template = `36px repeat(${cells.length}, minmax(0,1fr)) 52px`;
  const on = (h: number) => !activeHoles || activeHoles.has(h);
  const scoreOf = (c: PlayerResults["holes"][number]) => (net ? c.net : c.gross);
  const live = cells.filter((x) => on(x.cell.hole));
  const parTotal = live.reduce((s, x) => s + x.cell.par, 0);
  const scoreTotal = live.reduce((s, x) => s + (scoreOf(x.cell) ?? 0), 0);
  const moneyTotal = live.reduce((s, x) => s + x.m, 0);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 340, border: `1px solid ${GRID}` }}>
        <div style={{ display: "grid", gridTemplateColumns: template, gap: "1px", background: GRID }}>
          {/* HEADER band — white hole numbers + OUT/IN (thin) */}
          <GridCell h={20} bg={HEADER_BG} color="#fff" bold left>HOLE</GridCell>
          {cells.map((x) => (
            <HeaderHoleCell key={`hd${x.cell.hole}`} n={x.cell.hole} h={20} />
          ))}
          <GridCell h={20} bg={HEADER_BG} color="#fff" bold>{label}</GridCell>

          {/* PAR */}
          <GridCell h={18} bg="#E8EBF0" color={MUTED} bold left>Par</GridCell>
          {cells.map((x) => (
            <GridCell key={`par${x.cell.hole}`} h={18} bg="#E8EBF0" color={INK} bold>
              {on(x.cell.hole) ? x.cell.par : "·"}
            </GridCell>
          ))}
          <GridCell h={18} bg="#E8EBF0" color={INK} bold>{parTotal}</GridCell>

          {/* press / hammer / base dots — thin row below Par */}
          <GridCell h={11}> </GridCell>
          {cells.map((x) => (
            <GridCell key={`dot${x.cell.hole}`} h={11}>
              {on(x.cell.hole) && (
                <span className="flex items-center" style={{ gap: 1 }}>
                  {x.cell.picked && <span style={filledDot(pickShade)} />}
                  {showBase && baseBetGame && <span style={filledDot(MUTED)} />}
                  {showHammer && carriedHammerHoles.has(x.cell.hole) && <span style={hollowRing(HAMMER)} />}
                  {showPress &&
                    Array.from({ length: pressCount[x.cell.hole] ?? 0 }).map((_, i) => (
                      <span key={`pr${i}`} style={filledDot(PRESS)} />
                    ))}
                  {showHammer && hammerHoles.has(x.cell.hole) && <span style={filledDot(HAMMER)} />}
                </span>
              )}
            </GridCell>
          ))}
          <GridCell h={11}> </GridCell>

          {/* SCORE */}
          <GridCell color={MUTED} bold left>Score</GridCell>
          {cells.map((x) => (
            <GridCell key={`sc${x.cell.hole}`}>
              {on(x.cell.hole) ? (
                <ScoreCell score={scoreOf(x.cell)} par={x.cell.par} pop={x.cell.pop} />
              ) : (
                <span style={{ color: "#C4C8CE" }}>·</span>
              )}
            </GridCell>
          ))}
          <GridCell bold color={INK}>{scoreTotal || "–"}</GridCell>

          {/* MONEY +/- (hidden for 11s — it settles on the sum of picked holes) */}
          {!hideMoney && (
            <>
              <GridCell h={20} color={MUTED} bold left>$</GridCell>
              {cells.map((x) => {
                const show = on(x.cell.hole) && x.m !== 0;
                return (
                  <GridCell key={`m${x.cell.hole}`} h={20}>
                    <span style={{ fontSize: 8.5, fontWeight: 700, color: show ? moneyColor(x.m) : "#C4C8CE" }}>
                      {show ? money1(x.m) : "·"}
                    </span>
                  </GridCell>
                );
              })}
              <GridCell h={20} bold>
                <span style={{ fontSize: 10, fontWeight: 700, color: moneyColor(moneyTotal) }}>{dollars(moneyTotal)}</span>
              </GridCell>
            </>
          )}
        </div>
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
  const { betTypes, presses, pressHoles, hammerHoles, carriedHammerHoles } = results;
  const tiles: Filter[] = [...betTypes, "total"];
  const hammerSet = useMemo(() => new Set(hammerHoles), [hammerHoles]);
  const carriedHammerSet = useMemo(() => new Set(carriedHammerHoles), [carriedHammerHoles]);
  // Holes the hammer "affects": the hammered holes themselves, every hole a carried
  // hammer rolled THROUGH (so a hammer thrown on 1 that pushes to 2 then wins on 3
  // shows all three), plus any hole a hammer delta actually landed on. Money is
  // zero-sum, so a hole counts if any player has a non-zero hammer delta there.
  const hammerActive = useMemo(() => {
    const s = new Set<number>(hammerHoles);
    for (const h of carriedHammerHoles) s.add(h);
    player.holes.forEach((c, i) => {
      if (results.players.some((pl) => (pl.money.hammer[i] ?? 0) !== 0)) s.add(c.hole);
    });
    return s;
  }, [hammerHoles, carriedHammerHoles, results.players, player.holes]);

  // Active money + (for press) the holes the press covers.
  let active: number[];
  let activeHoles: Set<number> | null = null;
  if (filter === "press") {
    if (pressSel === "all" || !presses[pressSel]) {
      active = player.money.press;
      activeHoles = new Set(pressHoles);
    } else {
      active = presses[pressSel].money[player.id] ?? player.money.press;
      activeHoles = new Set(presses[pressSel].holes);
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
  const popsTotal = player.holes.filter((c) => liveHole(c.hole)).reduce((s, c) => s + c.pop, 0);
  const scoreTotal = player.holes
    .filter((c) => liveHole(c.hole))
    .reduce((s, c) => s + ((net ? c.net : c.gross) ?? 0), 0);
  // Round score to-par (played holes only) for the summary "Total ±N".
  let roundToPar: number | null = null;
  for (const c of player.holes) {
    if (!liveHole(c.hole)) continue;
    const s = net ? c.net : c.gross;
    if (s === null) continue;
    roundToPar = (roundToPar ?? 0) + s - c.par;
  }
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
              <span className="text-sm font-extrabold tabular-nums" style={{ color: moneyColor(sumMoney(t)) }}>
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

      {/* horizontal scorecard — traditional grid look; front + back stacked, then
          a summary strip (matches the all-players scorecard at the bottom). */}
      <div className="space-y-2">
        <Nine cells={front} net={net} label="OUT" hammerHoles={hammerSet} pressCount={results.pressCountByHole} baseBetGame={results.baseBetGame} carriedHammerHoles={carriedHammerSet} activeHoles={activeHoles} filter={filter} pickShade={pickShade} hideMoney={results.isElevens} />
        <Nine cells={back} net={net} label="IN" hammerHoles={hammerSet} pressCount={results.pressCountByHole} baseBetGame={results.baseBetGame} carriedHammerHoles={carriedHammerSet} activeHoles={activeHoles} filter={filter} pickShade={pickShade} hideMoney={results.isElevens} />
        <div
          className="grid items-center rounded-md text-xs font-bold tabular-nums"
          style={{ gridTemplateColumns: popsTotal > 0 ? "1fr auto auto auto auto" : "1fr auto auto auto", background: "#EAF1FF", border: `1px solid ${GRID}`, padding: "6px 10px", gap: "14px" }}
        >
          <span style={{ color: INK }}>Total {roundToPar === null ? "–" : formatToPar(roundToPar)}</span>
          {popsTotal > 0 && <span style={{ color: BLUE }}>Pops ({popsTotal})</span>}
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
        <span className="w-4 text-center text-base font-bold" style={{ color: MUTED }}>{rank}</span>
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate font-semibold" style={{ color: INK }}>{player.name}</span>
          <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: net ? BLUE : INK }}>
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
        <span className="text-lg font-extrabold tabular-nums" style={{ color: moneyColor(player.grand) }}>
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
const HEADER_BG = "#1E3A6E"; // scorecard header (navy blue) — standings + all-players
const LEDGER_HEADER = "#1E7A46"; // ledger header (green)

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
function HeaderHoleCell({ n, bg = HEADER_BG, h = 26 }: { n: number | string; bg?: string; h?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ height: h, background: bg }}>
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
  pressCount,
  baseBetGame,
  carriedHammerHoles,
  trailing,
  pickers,
}: {
  holeNums: number[];
  hammerHoles: Set<number>;
  pressCount: Record<number, number>; // presses covering a hole → that many orange dots
  baseBetGame: boolean; // per-hole base bet exists → filled gray dot on non-carry holes
  carriedHammerHoles: Set<number>; // received a carried hammer → hollow purple ring
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
            {baseBetGame && <span style={filledDot(MUTED)} />}
            {carriedHammerHoles.has(h) && <span style={hollowRing(HAMMER)} />}
            {Array.from({ length: pressCount[h] ?? 0 }).map((_, i) => (
              <span key={`pr${i}`} style={filledDot(PRESS)} />
            ))}
            {hammerHoles.has(h) && <span style={filledDot(HAMMER)} />}
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
  pressCount,
  baseBetGame,
  carriedHammerHoles,
  tees,
}: {
  players: PlayerResults[];
  holeNums: number[];
  net: boolean;
  label: "OUT" | "IN";
  hammerHoles: Set<number>;
  pressCount: Record<number, number>;
  baseBetGame: boolean;
  carriedHammerHoles: Set<number>;
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
          <DotsRowFragment holeNums={holeNums} hammerHoles={hammerHoles} pressCount={pressCount} baseBetGame={baseBetGame} carriedHammerHoles={carriedHammerHoles} trailing={2} pickers={pickers} />

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
  pressCount,
  baseBetGame,
  carriedHammerHoles,
}: {
  players: PlayerResults[];
  holeNums: number[];
  label: "OUT" | "IN";
  hammerHoles: Set<number>;
  pressCount: Record<number, number>;
  baseBetGame: boolean;
  carriedHammerHoles: Set<number>;
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
          <DotsRowFragment holeNums={holeNums} hammerHoles={hammerHoles} pressCount={pressCount} baseBetGame={baseBetGame} carriedHammerHoles={carriedHammerHoles} trailing={1} />

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

// ── Side bets — one row per player showing the bets that affect their payout as
//    icons with counts, plus their junk total. Settles into the main who-pays-
//    whom below. A holder bet (snake) only shows on whoever holds it at the end.
function SideBets({ results }: { results: ResultsData }) {
  if (results.junkBets.length === 0) return null;
  const standings = [...results.players].sort((a, b) => b.junk - a.junk);
  const countsFor = (pid: string) =>
    results.junkBets
      .map((bet) => {
        // Holder bets (snake) settle only on the LAST trigger — earlier triggers
        // by other players don't affect the payout, so count just the final one.
        const relevant = bet.settle === "holder" ? bet.events.slice(-1) : bet.events;
        const n = relevant.filter((e) => e.players.includes(pid)).length;
        return { id: bet.id, label: bet.label, n };
      })
      .filter((x) => x.n > 0);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">Side bets</h2>
      <div className="space-y-2">
        {standings.map((p) => {
          const counts = countsFor(p.id);
          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
              style={{ borderColor: BORDER }}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-semibold" style={{ color: INK }}>
                  {p.name}
                </span>
                {counts.length > 0 ? (
                  <span className="flex flex-wrap items-center gap-1.5 text-sm" style={{ color: MUTED }}>
                    {counts.map((c) => (
                      <span
                        key={c.id}
                        className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-semibold tabular-nums"
                        style={{ borderColor: BORDER, background: "#F6F7F9" }}
                      >
                        {hasJunkIcon(c.id) ? (
                          <JunkIcon id={c.id} className="h-[18px] w-[18px]" />
                        ) : (
                          <span>{c.label}</span>
                        )}
                        {c.n}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-sm" style={{ color: MUTED }}>
                    none
                  </span>
                )}
              </span>
              <span
                className="shrink-0 font-serif text-base font-extrabold tabular-nums"
                style={{ color: moneyColor(p.junk) }}
              >
                {money1(p.junk)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
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
  // Players/Teams toggle — only offered when the game has ≥2 fixed teams.
  const [teamView, setTeamView] = useState(false);
  const hasTeams = (results.teams?.length ?? 0) >= 2;
  const teamPlayers = useMemo(() => buildTeamPlayers(results), [results]);
  const showTeam = teamView && hasTeams;
  const standingsRows = useMemo(
    () => [...(showTeam ? teamPlayers : results.players)].sort((a, b) => b.grand - a.grand),
    [showTeam, teamPlayers, results.players]
  );

  const hammerSet = useMemo(() => new Set(results.hammerHoles), [results.hammerHoles]);
  const carriedHammerSet = useMemo(() => new Set(results.carriedHammerHoles), [results.carriedHammerHoles]);
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
        className="sticky z-20 -mx-3 flex flex-wrap items-center justify-between gap-2 bg-page-bg px-3 py-2"
        style={{ top: "calc(var(--header-h, 88px) + 3.4rem)" }}
      >
        <h2 className="text-xl font-bold">Standings</h2>
        <div className="flex items-center gap-2">
          {hasTeams && (
            <ViewToggle
              team={teamView}
              onChange={(t) => {
                setTeamView(t);
                setOpenId(null);
              }}
            />
          )}
          <GrossNetToggle net={net} onChange={setNet} />
        </div>
      </div>
      <div className="space-y-2">
        {standingsRows.map((p, idx) => {
          const rank = 1 + standingsRows.filter((q) => q.grand > p.grand).length;
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
          <LedgerNine players={standings} holeNums={front} label="OUT" hammerHoles={hammerSet} pressCount={results.pressCountByHole} baseBetGame={results.baseBetGame} carriedHammerHoles={carriedHammerSet} />
          <LedgerNine players={standings} holeNums={back} label="IN" hammerHoles={hammerSet} pressCount={results.pressCountByHole} baseBetGame={results.baseBetGame} carriedHammerHoles={carriedHammerSet} />
        </section>
      )}

      {/* Traditional course-style all-players scorecard */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Scorecard</h2>
        <ScorecardNine players={standings} holeNums={front} net={net} label="OUT" hammerHoles={hammerSet} pressCount={results.pressCountByHole} baseBetGame={results.baseBetGame} carriedHammerHoles={carriedHammerSet} tees={results.tees} />
        <ScorecardNine players={standings} holeNums={back} net={net} label="IN" hammerHoles={hammerSet} pressCount={results.pressCountByHole} baseBetGame={results.baseBetGame} carriedHammerHoles={carriedHammerSet} tees={results.tees} />
        {(() => {
          const withPops = standings
            .map((p) => ({ name: p.name, pops: p.holes.reduce((s, c) => s + c.pop, 0) }))
            .filter((x) => x.pops > 0);
          if (withPops.length === 0) return null;
          return (
            <p className="px-1 text-xs" style={{ color: MUTED }}>
              * Pops: {withPops.map((x) => `${x.name} (${x.pops})`).join(", ")}
            </p>
          );
        })()}
      </section>

      {/* Side bets (junk) breakdown per player. */}
      <SideBets results={results} />

      {/* Who pays whom — main game money + side bets combined. */}
      <SettleUp people={results.players.map((p) => ({ name: p.name, amount: p.grand + p.junk }))} />
    </div>
  );
}
