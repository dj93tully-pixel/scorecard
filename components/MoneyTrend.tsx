// components/MoneyTrend.tsx
// Trendline panel (Card tab, all games): each player's current money plus a
// sparkline of how that money has moved hole by hole. Transparent — it sits on
// the page background rather than in its own card.

import { Round } from "@/lib/wolf";
import { formatMoney } from "@/lib/storage";

const POS = "#2BC081";
const NEG = "#F0524B";
const MUTED = "#8A90A0";

export function MoneyTrend({
  round,
  prefixLedgers,
}: {
  round: Round;
  // Ledger as the game would settle after each played hole, in hole order.
  prefixLedgers: Record<string, number>[];
}) {
  const players = round.players;
  const n = prefixLedgers.length;
  if (n === 0) return null;

  const current = prefixLedgers[n - 1];
  const valsOf = (id: string) => prefixLedgers.map((l) => l[id] ?? 0);
  const maxAbs = Math.max(1, ...players.flatMap((p) => valsOf(p.id).map(Math.abs)));

  const W = 96;
  const H = 28;
  const pad = 3;
  const x = (i: number) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad));
  const y = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - pad);
  const color = (v: number) => (v > 0 ? POS : v < 0 ? NEG : MUTED);

  const sorted = [...players].sort(
    (a, b) => (current[b.id] ?? 0) - (current[a.id] ?? 0)
  );

  return (
    <section className="space-y-2">
      <h2 className="text-xl font-bold">Trendline</h2>
      <div className="overflow-hidden">
        {sorted.map((p, idx) => {
          const vals = valsOf(p.id);
          const cur = current[p.id] ?? 0;
          const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-1 py-2 ${
                idx > 0 ? "border-t border-divider" : ""
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {p.name || "Unnamed"}
              </span>
              <svg width={W} height={H} className="shrink-0" aria-hidden>
                <line
                  x1={pad}
                  y1={H / 2}
                  x2={W - pad}
                  y2={H / 2}
                  stroke={MUTED}
                  strokeWidth="0.5"
                  strokeDasharray="2 2"
                  opacity="0.5"
                />
                {n > 1 && (
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={color(cur)}
                    strokeWidth="1.75"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                <circle cx={x(n - 1)} cy={y(cur)} r="2" fill={color(cur)} />
              </svg>
              <span
                className="w-14 text-right text-sm font-bold tabular-nums"
                style={{ color: color(cur) }}
              >
                {formatMoney(cur)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
