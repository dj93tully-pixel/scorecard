// lib/settle.ts
// "Who pays whom" — net a set of player balances into the fewest payments.
// Greedily matches the biggest debtor to the biggest creditor until everyone is
// square. Works in integer cents so floats don't drift; balances are expected to
// be zero-sum (the books always balance). Shared by the main settle-up and the
// side-bets tab — each just feeds it a different set of totals.

export interface Payment {
  from: string; // who pays
  to: string; // who collects
  amount: number; // dollars (positive)
}

export function settleUp(people: { name: string; amount: number }[]): Payment[] {
  const creditors: { name: string; amt: number }[] = [];
  const debtors: { name: string; amt: number }[] = [];
  // Round to integer cents. Sub-cent inputs (e.g. a stake split three ways) can make
  // the rounded set not net to exactly zero, which would leave the greedy loop with an
  // unpaid remainder. Fold that residual into the largest-magnitude balance so the
  // books balance and every payment reconciles.
  const rounded = people.map((p) => ({ name: p.name, cents: Math.round(p.amount * 100) }));
  const residual = rounded.reduce((s, r) => s + r.cents, 0);
  if (residual !== 0 && rounded.length > 0) {
    let idx = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (Math.abs(rounded[i].cents) > Math.abs(rounded[idx].cents)) idx = i;
    }
    rounded[idx].cents -= residual;
  }
  for (const r of rounded) {
    if (r.cents > 0) creditors.push({ name: r.name, amt: r.cents });
    else if (r.cents < 0) debtors.push({ name: r.name, amt: -r.cents });
  }
  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const out: Payment[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const pay = Math.min(c.amt, d.amt);
    if (pay > 0) out.push({ from: d.name, to: c.name, amount: pay / 100 });
    c.amt -= pay;
    d.amt -= pay;
    if (c.amt === 0) ci++;
    if (d.amt === 0) di++;
  }
  return out;
}
