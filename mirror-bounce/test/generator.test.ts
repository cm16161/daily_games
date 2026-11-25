import { describe, expect, it } from 'vitest';
import { simulateBeam } from '../src/logic/beam';
import { MAX_OPTIMAL, MIN_OPTIMAL, dailyPar, generatePuzzle } from '../src/logic/generator';
import { solve } from '../src/logic/solver';
import { colOf, rowOf } from '../src/logic/types';
import type { Puzzle } from '../src/logic/types';

const dates = Array.from({ length: 90 }, (_, i) =>
  new Date(Date.UTC(2026, 10, 1 + i * 4)).toISOString().slice(0, 10),
);

function fingerprint(p: Puzzle): string {
  return JSON.stringify([p.emitter, p.targets, p.obstacles, p.optimalBounces, p.solution]);
}

describe('generatePuzzle', () => {
  it('is deterministic for a given date', () => {
    for (const d of dates.slice(0, 10)) expect(generatePuzzle(d)).toEqual(generatePuzzle(d));
  });

  it('produces different puzzles on different dates', () => {
    const prints = new Set(dates.map((d) => fingerprint(generatePuzzle(d))));
    expect(prints.size).toBe(dates.length);
  });

  it('is pinned for a known date so a code change cannot silently alter shipped puzzles', () => {
    expect(fingerprint(generatePuzzle('2026-11-27'))).toMatchSnapshot();
  });

  it.each(dates)('%s is valid, solvable and unique-optimal', (date) => {
    const p = generatePuzzle(date);
    const n = p.size;
    expect(p.date).toBe(date);

    const { row, col, dir } = p.emitter;
    const onEntryEdge = [row === n - 1, col === 0, row === 0, col === n - 1][dir];
    expect(onEntryEdge).toBe(true);

    expect(new Set(p.targets).size).toBe(3);
    for (const t of p.targets) expect(p.obstacles).not.toContain(t);
    for (const c of [...p.targets, ...p.obstacles]) {
      expect(rowOf(c)).toBeLessThan(n);
      expect(colOf(c)).toBeLessThan(n);
    }

    expect(p.optimalBounces).toBeGreaterThanOrEqual(MIN_OPTIMAL);
    expect(p.optimalBounces).toBeLessThanOrEqual(MAX_OPTIMAL);
    expect(p.optimalBounces).toBe(dailyPar(date));
    expect(p.maxMirrors).toBe(p.optimalBounces + 2);

    const beam = simulateBeam(p, new Map(p.solution));
    expect(beam.solved).toBe(true);
    expect(beam.bounces).toBe(p.optimalBounces);
    expect(simulateBeam(p, new Map()).solved).toBe(false);

    const check = solve(p, { maxBounces: p.optimalBounces + 1, maxMirrors: p.maxMirrors, countLimit: 5 });
    expect(check?.optimalBounces).toBe(p.optimalBounces);
    expect(check?.optimalSolutionCount).toBe(1);
  });

  it('generates quickly', () => {
    const start = performance.now();
    for (const d of dates) generatePuzzle(d);
    expect((performance.now() - start) / dates.length).toBeLessThan(50);
  });
});
