// components/SettleUp.tsx
// "Who pays whom" list — feed it a set of {name, amount} balances and it shows
// the fewest payments to square up. Shared by the main Cards tab (game money) and
// the Side bets tab (junk money), which settle independently.

import { ArrowRight } from "lucide-react";
import { settleUp } from "@/lib/settle";

const GREEN = "#16A06A";
const MUTED = "#9098A4";
const BORDER = "#EAECEF";
const INK = "#16181D";

// Plain positive dollar amount: $5, $2.50.
function payAmount(v: number): string {
  return `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
}

export function SettleUp({
  people,
  title = "Settle up",
}: {
  people: { name: string; amount: number }[];
  title?: string;
}) {
  const payments = settleUp(people);
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {payments.length === 0 ? (
        <div
          className="rounded-xl border bg-white px-4 py-4 text-center text-sm"
          style={{ borderColor: BORDER, color: MUTED }}
        >
          All square — nobody owes anything.
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((pmt, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3"
              style={{ borderColor: BORDER }}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate font-semibold" style={{ color: INK }}>
                  {pmt.from}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" style={{ color: MUTED }} />
                <span className="truncate font-semibold" style={{ color: INK }}>
                  {pmt.to}
                </span>
              </span>
              <span
                className="shrink-0 font-serif text-base font-extrabold tabular-nums"
                style={{ color: GREEN }}
              >
                {payAmount(pmt.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
