import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../src/logic/generator';
import { cycleCell, elapsedMs, fire, freshState, restoreState, setCell } from '../src/logic/state';
import type { Puzzle } from '../src/logic/types';

const p: Puzzle = generatePuzzle('2026-11-27');
const free = [...Array(49).keys()].filter((c) => !p.targets.includes(c) && !p.obstacles.includes(c));

describe('state', () => {
  it('cycles empty -> / -> \\ -> empty and starts the timer on first placement', () => {
    let s = freshState(p.date);
    s = cycleCell(p, s, free[0], 1000);
    expect(s.mirrors).toEqual([[free[0], '/']]);
    expect(s.startedAt).toBe(1000);
    s = cycleCell(p, s, free[0], 2000);
    expect(s.mirrors).toEqual([[free[0], '\\']]);
    s = cycleCell(p, s, free[0], 3000);
    expect(s.mirrors).toEqual([]);
    expect(s.startedAt).toBe(1000);
  });

  it('refuses targets, obstacles and placements beyond the cap', () => {
    let s = freshState(p.date);
    expect(cycleCell(p, s, p.targets[0], 0)).toBe(s);
    expect(cycleCell(p, s, p.obstacles[0], 0)).toBe(s);
    for (let i = 0; i < p.maxMirrors; i++) s = setCell(p, s, free[i], '/', 0);
    expect(s.mirrors).toHaveLength(p.maxMirrors);
    expect(setCell(p, s, free[p.maxMirrors], '/', 0)).toBe(s);
    expect(setCell(p, s, free[0], '\\', 0).mirrors[0][1]).toBe('\\');
  });

  it('only completes the day when the fired beam solves the puzzle', () => {
    const s0 = setCell(p, freshState(p.date), free[0], '/', 0);
    expect(fire(p, s0, 5000).state.result).toBeUndefined();

    let s = freshState(p.date);
    for (const [cell, m] of p.solution) s = setCell(p, s, cell, m, 10_000);
    const { state, beam } = fire(p, s, 70_000);
    expect(beam.solved).toBe(true);
    expect(state.result).toMatchObject({ bounces: p.optimalBounces, elapsedMs: 60_000, quality: 1000, speed: 240 });
    expect(elapsedMs(state, 999_999)).toBe(60_000);
    expect(setCell(p, state, free[0], '/', 0)).toBe(state);
  });

  it('restores valid saved state and discards bad or stale data', () => {
    const s = setCell(p, freshState(p.date), free[0], '\\', 42);
    expect(restoreState(p, JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(restoreState(p, { ...s, date: '1999-01-01' })).toEqual(freshState(p.date));
    expect(restoreState(p, 'garbage')).toEqual(freshState(p.date));
    expect(restoreState(p, { ...s, mirrors: [[p.targets[0], '/'], [free[1], 'x'], [free[2], '/']] }).mirrors).toEqual([
      [free[2], '/'],
    ]);
  });
});
