/**
 * Distributes a total amount (in centavos) among owners using the
 * largest-remainder method so the sum always equals the total exactly.
 *
 * Percentages are integers where 10000 = 100.00%.
 */
export function distribute(
  totalCents: bigint,
  ownerships: { ownerId: string; percentage: number }[],
): { ownerId: string; amount: bigint }[] {
  if (ownerships.length === 0) return [];

  // 1. Calculate base (floored) amount for each owner
  const results = ownerships.map((o) => {
    const base = (totalCents * BigInt(o.percentage)) / 10000n;
    // Fractional part lost (in 10000ths of a centavo) for sorting later
    const remainder = totalCents * BigInt(o.percentage) - base * 10000n;
    return {
      ownerId: o.ownerId,
      amount: base,
      remainder,
    };
  });

  // 2. Calculate how much is left to distribute
  const allocated = results.reduce((sum, r) => sum + r.amount, 0n);
  let remaining = totalCents - allocated;

  // 3. Sort by largest remainder (descending) — those who lost the most get a centavo first
  const sorted = [...results].sort((a, b) => {
    if (b.remainder > a.remainder) return 1;
    if (b.remainder < a.remainder) return -1;
    return 0;
  });

  // 4. Distribute remainder one centavo at a time
  for (const entry of sorted) {
    if (remaining <= 0n) break;
    entry.amount += 1n;
    remaining -= 1n;
  }

  // Return in original order
  return results.map(({ ownerId, amount }) => ({ ownerId, amount }));
}
