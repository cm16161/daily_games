import { describe, expect, it } from 'vitest';
import { createRng } from '@shared/prng';
import { simulateBeam } from '../src/logic/beam';
import { solve } from '../src/logic/solver';
import { idx } from '../src/logic/types';
import type { CellIdx, Dir, Mirror, PuzzleLayout } from '../src/logic/types';
import { layout } from './helpers';

const E = 1, S = 2;
const opts = { maxBounces: 6, maxMirrors: 6, countLimit: 100 };

describe('solve', () => {
  it('finds a zero-bounce solution when targets are in line', () => {
    const p = layout({ emitter: [3, 0, E], targets: [[3, 1], [3, 4], [3, 6]] });
    expect(solve(p, opts)).toMatchObject({ optimalBounces: 0, optimalSolutionCount: 1, example: [] });
  });

  it('finds the unique one-bounce solution', () => {
    const p = layout({ emitter: [3, 0, E], targets: [[3, 2], [2, 4], [0, 4]] });
    expect(solve(p, opts)).toEqual({
      optimalBounces: 1,
      optimalSolutionCount: 1,
      example: [[idx(3, 4), '/']],
    });
  });

  it('finds the unique two-bounce solution', () => {
    const p = layout({ emitter: [0, 0, S], targets: [[2, 0], [4, 3], [5, 6]] });
    expect(solve(p, opts)).toEqual({
      optimalBounces: 2,
      optimalSolutionCount: 1,
      example: [[idx(4, 0), '\\'], [idx(4, 6), '\\']],
    });
  });

  it('counts every distinct optimal mirror set', () => {
    const p = layout({ emitter: [0, 0, E], targets: [[6, 6]], obstacles: [[0, 6]] });
    const r = solve(p, opts)!;
    expect(r.optimalBounces).toBe(2);
    expect(r.optimalSolutionCount).toBe(6);
  });

  it('stops counting at countLimit', () => {
    const p = layout({ emitter: [0, 0, E], targets: [[6, 6]], obstacles: [[0, 6]] });
    expect(solve(p, { ...opts, countLimit: 2 })!.optimalSolutionCount).toBe(2);
  });

  it('returns null when a target is unreachable', () => {
    const p = layout({
      emitter: [0, 0, S],
      targets: [[3, 3]],
      obstacles: [[2, 3], [4, 3], [3, 2], [3, 4]],
    });
    expect(solve(p, opts)).toBeNull();
  });

  it('respects the mirror cap', () => {
    const p = layout({ emitter: [0, 0, S], targets: [[2, 0], [4, 3], [5, 6]] });
    expect(solve(p, { maxBounces: 6, maxMirrors: 1 })).toBeNull();
    expect(solve(p, { maxBounces: 1, maxMirrors: 6 })).toBeNull();
  });

  it('agrees with exhaustive search over all placements of up to 2 mirrors on 5x5 boards', () => {
    const rng = createRng('solver-bruteforce');
    const size = 5;
    let checked = 0;
    for (let t = 0; t < 40; t++) {
      const cells = rng.shuffle([...Array(size * size).keys()]);
      const pos = rng.int(0, size - 1);
      const emitters: [number, number, Dir][] = [[0, pos, 2], [size - 1, pos, 0], [pos, 0, 1], [pos, size - 1, 3]];
      const p: PuzzleLayout = {
        date: 'bf',
        size,
        emitter: (([row, col, dir]) => ({ row, col, dir }))(rng.pick(emitters)),
        targets: cells.slice(0, 2),
        obstacles: cells.slice(2, 2 + rng.int(0, 4)),
      };
      const expected = bruteForce(p, 2);
      const got = solve(p, { maxBounces: 2, maxMirrors: 2, countLimit: 1000 });
      if (expected == null) {
        expect(got).toBeNull();
      } else {
        checked++;
        expect(got?.optimalBounces).toBe(expected.optimal);
        expect(got?.optimalSolutionCount).toBe(expected.count);
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

function bruteForce(p: PuzzleLayout, maxMirrors: number): { optimal: number; count: number } | null {
  const free = [...Array(p.size * p.size).keys()].filter((c) => !p.targets.includes(c) && !p.obstacles.includes(c));
  const options: [CellIdx, Mirror][] = free.flatMap((c) => [[c, '/'], [c, '\\']] as [CellIdx, Mirror][]);
  const best = new Map<number, Set<string>>();
  const consider = (placed: [CellIdx, Mirror][]) => {
    const r = simulateBeam(p, new Map(placed));
    if (!r.solved || r.bounces > maxMirrors) return;
    const onPath = new Set(r.cells.slice(0, lastTargetIndex(p, r.cells) + 1));
    const used = placed.filter(([c]) => onPath.has(c)).map(([c, m]) => `${c}${m}`).sort().join(',');
    const bounces = countBouncesUntilSolved(p, placed, r.cells);
    if (!best.has(bounces)) best.set(bounces, new Set());
    best.get(bounces)!.add(used);
  };
  consider([]);
  for (let i = 0; i < options.length; i++) {
    consider([options[i]]);
    for (let j = i + 1; j < options.length; j++) {
      if (options[i][0] !== options[j][0]) consider([options[i], options[j]]);
    }
  }
  if (best.size === 0) return null;
  const optimal = Math.min(...best.keys());
  return { optimal, count: best.get(optimal)!.size };
}

function lastTargetIndex(p: PuzzleLayout, cells: CellIdx[]): number {
  const remaining = new Set(p.targets);
  for (let i = 0; i < cells.length; i++) {
    remaining.delete(cells[i]);
    if (remaining.size === 0) return i;
  }
  return cells.length - 1;
}

function countBouncesUntilSolved(p: PuzzleLayout, placed: [CellIdx, Mirror][], cells: CellIdx[]): number {
  const m = new Map(placed);
  const end = lastTargetIndex(p, cells);
  let bounces = 0;
  for (let i = 0; i < end; i++) if (m.has(cells[i])) bounces++;
  return bounces;
}
