import { describe, it, expect } from 'vitest';
import { distribute } from './distribute.js';

describe('distribute (largest remainder method)', () => {
  it('distributes evenly when percentages divide exactly', () => {
    const result = distribute(10000n, [
      { ownerId: 'a', percentage: 5000 },
      { ownerId: 'b', percentage: 5000 },
    ]);

    expect(result).toEqual([
      { ownerId: 'a', amount: 5000n },
      { ownerId: 'b', amount: 5000n },
    ]);
  });

  it('distributes with remainder using largest remainder method', () => {
    // 3 owners at 33.33% each, total = 1,000,000 centavos
    const result = distribute(1000000n, [
      { ownerId: 'a', percentage: 3333 },
      { ownerId: 'b', percentage: 3333 },
      { ownerId: 'c', percentage: 3334 },
    ]);

    const total = result.reduce((sum, r) => sum + r.amount, 0n);
    expect(total).toBe(1000000n);

    // c has the highest percentage, should get the largest share
    const shareC = result.find(r => r.ownerId === 'c')!;
    expect(shareC.amount).toBeGreaterThanOrEqual(333400n);
  });

  it('always sums to total exactly', () => {
    // Edge case: uneven distribution
    const result = distribute(100n, [
      { ownerId: 'a', percentage: 3333 },
      { ownerId: 'b', percentage: 3333 },
      { ownerId: 'c', percentage: 3334 },
    ]);

    const total = result.reduce((sum, r) => sum + r.amount, 0n);
    expect(total).toBe(100n);
  });

  it('handles single owner at 100%', () => {
    const result = distribute(12345678n, [
      { ownerId: 'solo', percentage: 10000 },
    ]);

    expect(result).toEqual([{ ownerId: 'solo', amount: 12345678n }]);
  });

  it('handles zero total', () => {
    const result = distribute(0n, [
      { ownerId: 'a', percentage: 5000 },
      { ownerId: 'b', percentage: 5000 },
    ]);

    expect(result).toEqual([
      { ownerId: 'a', amount: 0n },
      { ownerId: 'b', amount: 0n },
    ]);
  });

  it('handles empty ownerships', () => {
    const result = distribute(10000n, []);
    expect(result).toEqual([]);
  });

  it('distributes 40/35/25 split correctly', () => {
    // Alberto 40%, Juan 35%, Néstor 25% of $100,000 (10,000,000 centavos)
    const result = distribute(10000000n, [
      { ownerId: 'alberto', percentage: 4000 },
      { ownerId: 'juan', percentage: 3500 },
      { ownerId: 'nestor', percentage: 2500 },
    ]);

    expect(result.find(r => r.ownerId === 'alberto')!.amount).toBe(4000000n);
    expect(result.find(r => r.ownerId === 'juan')!.amount).toBe(3500000n);
    expect(result.find(r => r.ownerId === 'nestor')!.amount).toBe(2500000n);

    const total = result.reduce((sum, r) => sum + r.amount, 0n);
    expect(total).toBe(10000000n);
  });
});
