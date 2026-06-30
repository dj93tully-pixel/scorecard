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
  for (const p of people) {
    const cents = Math.round(p.amount * 100);
    if (cents > 0) creditors.push({ name: p.name, amt: cents });
    else if (cents < 0) debtors.push({ name: p.name, amt: -cents });
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
