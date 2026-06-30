// components/ResultsView.tsx
// Interactive results page for the Card tab. Standings of player bars (accordion,
// leader open by default); each expands to bet-type tiles (tappable filters), a
// horizontal scorecard whose "$" row + a cumulative trendline follow the active
// filter, and a global Gross/Net toggle that swaps the Score row. Presentation
// only — every value comes from buildResults (which re-reads the engines).

"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ResultsData, PlayerResults, BetType } from "@/lib/results";
import { formatMoney } from "@/lib/storage";

const BLUE = "#3B78FF";
const GREEN = "#16A06A";
const RED = "#E5484D";
const MUTED = "#9098A4";
const BORDER = "#EAECEF";
const INK = "#16181D";
const TOTAL_TINT = "#EEF4F0";
const TILE_ACTIVE = "#EAF1FF";

type Filter = BetType | "total";
const FILTER_LABEL: Record<Filter, string> = {
  total: "Total",
  original: "Original",
  press: "Press",
  hammer: "Hammer",
};

const moneyColor = (v: number) => (v > 0 ? GREEN : v < 0 ? RED : MUTED);
const dollars = (v: number) => (v === 0 ? "—" : formatMoney(v));

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

// ── Score cell — circle (under par) / square (over par) / plain (par) ────────
function ScoreCell({ score, par }: { score: number | null; par: number }) {
  if (score === null) return <span style={{ color: "#C4C8CE" }}>–</span>;
  const rel = score - par;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "19px",
    height: "19px",
    fontSize: "11px",
    fontWeight: 700,
    color: INK,
  } as const;
  if (rel === 0) return <span style={base}>{score}</span>;
  return (
    <span
      style={{
        ...base,
        border: `1.5px solid ${rel > 0 ? INK : BLUE}`,
        borderRadius: rel > 0 ? "3px" : "50%",
        color: rel > 0 ? INK : BLUE,
      }}
    >
      {score}
    </span>
  );
}

// ── One nine (OUT / IN): hole numbers, par band, score row, money row ────────
function Nine({
  cells,
  net,
  label,
}: {
  cells: { cell: PlayerResults["holes"][number]; m: number }[];
  net: boolean;
  label: "OUT" | "IN";
}) {
  const template = `34px repeat(${cells.length}, minmax(0,1fr)) 34px`;
  const scoreOf = (c: PlayerResults["holes"][number]) => (net ? c.net : c.gross);
  const parTotal = cells.reduce((s, x) => s + x.cell.par, 0);
  const scoreTotal = cells.reduce((s, x) => s + (scoreOf(x.cell) ?? 0), 0);
  const moneyTotal = cells.reduce((s, x) => s + x.m, 0);

  const Cell = ({ children, tint }: { children: React.ReactNode; tint?: boolean }) => (
    <div
      className="flex h-7 items-center justify-center tabular-nums"
      style={tint ? { background: "#F6F7F9" } : undefined}
    >
      {children}
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 320 }}>
        {/* hole numbers */}
        <div className="grid items-center text-[10px] font-bold" style={{ gridTemplateColumns: template, color: MUTED }}>
          <Cell>{label}</Cell>
          {cells.map((x) => (
            <Cell key={x.cell.hole}>{x.cell.hole}</Cell>
          ))}
          <Cell>{label}</Cell>
        </div>
        {/* par band */}
        <div className="grid items-center text-[10px]" style={{ gridTemplateColumns: template, background: "#F6F7F9", color: MUTED }}>
          <Cell tint>Par</Cell>
          {cells.map((x) => (
            <Cell key={x.cell.hole} tint>
              {x.cell.par}
            </Cell>
          ))}
          <Cell tint>{parTotal}</Cell>
        </div>
        {/* scores */}
        <div className="grid items-center" style={{ gridTemplateColumns: template }}>
          <Cell>
            <span className="text-[10px] font-semibold" style={{ color: MUTED }}>
              Score
            </span>
          </Cell>
          {cells.map((x) => (
            <Cell key={x.cell.hole}>
              <ScoreCell score={scoreOf(x.cell)} par={x.cell.par} />
            </Cell>
          ))}
          <Cell>
            <span className="text-xs font-bold" style={{ color: INK }}>
              {scoreTotal || "–"}
            </span>
          </Cell>
        </div>
        {/* money */}
        <div className="grid items-center" style={{ gridTemplateColumns: template, borderTop: `1px solid ${BORDER}` }}>
          <Cell>
            <span className="text-[10px] font-semibold" style={{ color: MUTED }}>
              $
            </span>
          </Cell>
          {cells.map((x) => (
            <Cell key={x.cell.hole}>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: x.m === 0 ? "#C4C8CE" : moneyColor(x.m) }}>
                {x.m === 0 ? "·" : formatMoney(x.m)}
              </span>
            </Cell>
          ))}
          <Cell>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: moneyColor(moneyTotal) }}>
              {dollars(moneyTotal)}
            </span>
          </Cell>
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
      {/* $0 baseline */}
      <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      {/* area + line */}
      <path d={area} fill={color} opacity={0.12} />
      <polyline points={linePts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* endpoint dot + label */}
      <circle cx={x(n - 1)} cy={y(final)} r={3} fill={color} />
      <text x={x(n - 1) + 6} y={y(final) + 4} fontSize={11} fontWeight={700} fill={color}>
        {formatMoney(final)}
      </text>
      {/* x ticks at 1 / 9 / 18 (first / middle / last) */}
      {[0, Math.floor((n - 1) / 2), n - 1].map((i, k) => (
        <text key={k} x={x(i)} y={H - 4} fontSize={9} fontWeight={600} fill={MUTED} textAnchor="middle">
          {i + 1}
        </text>
      ))}
    </svg>
  );
}

// ── A player's expanded detail: tiles → scorecard → trendline ────────────────
function Detail({
  player,
  betTypes,
  net,
  filter,
  setFilter,
}: {
  player: PlayerResults;
  betTypes: BetType[];
  net: boolean;
  filter: Filter;
  setFilter: (f: Filter) => void;
}) {
  const tiles: Filter[] = [...betTypes, "total"];
  const active = player.money[filter];

  const front = player.holes
    .map((cell, i) => ({ cell, m: active[i] }))
    .filter((x) => x.cell.hole <= 9);
  const back = player.holes
    .map((cell, i) => ({ cell, m: active[i] }))
    .filter((x) => x.cell.hole >= 10);

  const sumMoney = (type: Filter) => player.money[type].reduce((s, v) => s + v, 0);
  const parTotal = player.holes.reduce((s, c) => s + c.par, 0);
  const scoreTotal = player.holes.reduce((s, c) => s + ((net ? c.net : c.gross) ?? 0), 0);
  const grand = sumMoney(filter);

  return (
    <div style={{ background: "#FAFBFC", borderTop: `1px solid ${BORDER}`, padding: "10px" }}>
      {/* bet-type tiles (tappable filters) */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto">
        {tiles.map((t) => {
          const on = filter === t;
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
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

      {/* horizontal scorecard */}
      <div className="overflow-hidden rounded-xl border bg-card-bg" style={{ borderColor: BORDER }}>
        <Nine cells={front} net={net} label="OUT" />
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          <Nine cells={back} net={net} label="IN" />
        </div>
        {/* total strip */}
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

      {/* winnings by hole */}
      <div className="mt-4">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>
            Winnings by hole
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ background: TILE_ACTIVE, color: BLUE }}
          >
            {FILTER_LABEL[filter]}
          </span>
        </div>
        <Trendline money={active} />
      </div>
    </div>
  );
}

// ── One player's standings bar (accordion) ───────────────────────────────────
function PlayerBar({
  player,
  rank,
  open,
  onToggle,
  betTypes,
  net,
  filter,
  setFilter,
}: {
  player: PlayerResults;
  rank: number;
  open: boolean;
  onToggle: () => void;
  betTypes: BetType[];
  net: boolean;
  filter: Filter;
  setFilter: (f: Filter) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card-bg" style={{ borderColor: BORDER, borderLeft: `4px solid ${open ? BLUE : "#AFC6FF"}` }}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="w-4 text-center font-serif text-base font-bold" style={{ color: MUTED }}>
          {rank}
        </span>
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate font-semibold" style={{ color: INK }}>
            {player.name}
          </span>
          <span className="shrink-0 text-xs font-semibold" style={{ color: MUTED }}>
            +{player.handicap}
          </span>
        </span>
        <span className="font-serif text-lg font-extrabold tabular-nums" style={{ color: moneyColor(player.grand) }}>
          {formatMoney(player.grand)}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: MUTED }} />
      </button>
      {open && (
        <Detail player={player} betTypes={betTypes} net={net} filter={filter} setFilter={setFilter} />
      )}
    </div>
  );
}

export function ResultsView({ results }: { results: ResultsData }) {
  const standings = useMemo(
    () => [...results.players].sort((a, b) => b.grand - a.grand),
    [results.players]
  );
  const [net, setNet] = useState(false);
  const [openId, setOpenId] = useState<string | null>(() => standings[0]?.id ?? null);
  const [filter, setFilter] = useState<Filter>("total");

  const toggle = (id: string) => {
    if (openId === id) {
      setOpenId(null);
    } else {
      setOpenId(id);
      setFilter("total"); // opening a player resets the filter
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Standings</h2>
        <GrossNetToggle net={net} onChange={setNet} />
      </div>

      <div className="space-y-2">
        {standings.map((p) => {
          const rank = 1 + standings.filter((q) => q.grand > p.grand).length;
          return (
            <PlayerBar
              key={p.id}
              player={p}
              rank={rank}
              open={openId === p.id}
              onToggle={() => toggle(p.id)}
              betTypes={results.betTypes}
              net={net}
              filter={filter}
              setFilter={setFilter}
            />
          );
        })}
      </div>
    </div>
  );
}
