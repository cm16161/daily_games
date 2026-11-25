import { describe, expect, it } from 'vitest';
import { createRng, hashString } from '@shared/prng';

describe('prng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('2026-11-27');
    const b = createRng('2026-11-27');
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('differs for different seeds', () => {
    expect(hashString('2026-11-27')).not.toBe(hashString('2026-11-28'));
    const a = createRng('x');
    const b = createRng('y');
    expect([a.next(), a.next()]).not.toEqual([b.next(), b.next()]);
  });

  it('int stays in range inclusive', () => {
    const r = createRng('range');
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen.size).toBe(4);
  });
});
