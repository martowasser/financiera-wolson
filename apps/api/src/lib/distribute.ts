/**
 * Distributes a total amount (in centavos) among owners using the
 * largest-remainder method so the sum always equals the total exactly.
 *
 * Percentages are integers in basis points where 10000 = 100.00%.
 */
export function distribute(
  totalCents: bigint,
  ownerships: { ownerId: string; percentBps: number }[],
): { ownerId: string; amount: bigint }[] {
  if (ownerships.length === 0) return [];

  const results = ownerships.map((o) => {
    const base = (totalCents * BigInt(o.percentBps)) / 10000n;
    const remainder = totalCents * BigInt(o.percentBps) - base * 10000n;
    return { ownerId: o.ownerId, amount: base, remainder };
  });

  const allocated = results.reduce((sum, r) => sum + r.amount, 0n);
  let remaining = totalCents - allocated;

  const sorted = [...results].sort((a, b) => {
    if (b.remainder > a.remainder) return 1;
    if (b.remainder < a.remainder) return -1;
    return 0;
  });

  for (const entry of sorted) {
    if (remaining <= 0n) break;
    entry.amount += 1n;
    remaining -= 1n;
  }

  return results.map(({ ownerId, amount }) => ({ ownerId, amount }));
}
