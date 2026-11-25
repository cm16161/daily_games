import { simulateBeam } from './beam';
import type { BeamResult } from './beam';
import { computeScore } from './scoring';
import type { Score } from './scoring';
import type { CellIdx, Mirror, Mirrors, Puzzle } from './types';

export interface DayResult extends Score {
  bounces: number;
  optimal: number;
  elapsedMs: number;
}

export interface DayState {
  date: string;
  mirrors: [CellIdx, Mirror][];
  startedAt: number | null;
  result?: DayResult;
}

export const freshState = (date: string): DayState => ({ date, mirrors: [], startedAt: null });

export const mirrorMap = (s: DayState): Mirrors => new Map(s.mirrors);

export function isPlaceable(p: Puzzle, cell: CellIdx): boolean {
  return (
    cell >= 0 && cell < p.size * p.size && !p.targets.includes(cell) && !p.obstacles.includes(cell)
  );
}

export function setCell(p: Puzzle, s: DayState, cell: CellIdx, mirror: Mirror | null, now: number): DayState {
  if (s.result || !isPlaceable(p, cell)) return s;
  const map = new Map(s.mirrors);
  const current = map.get(cell) ?? null;
  if (current === mirror) return s;
  if (mirror == null) {
    map.delete(cell);
  } else {
    if (current == null && map.size >= p.maxMirrors) return s;
    map.set(cell, mirror);
  }
  return {
    ...s,
    mirrors: [...map].sort((a, b) => a[0] - b[0]),
    startedAt: s.startedAt ?? (mirror != null ? now : null),
  };
}

const CYCLE: Record<string, Mirror | null> = { none: '/', '/': '\\', '\\': null };

export function cycleCell(p: Puzzle, s: DayState, cell: CellIdx, now: number): DayState {
  const current = new Map(s.mirrors).get(cell) ?? 'none';
  return setCell(p, s, cell, CYCLE[current], now);
}

export function elapsedMs(s: DayState, now: number): number {
  if (s.result) return s.result.elapsedMs;
  return s.startedAt == null ? 0 : Math.max(0, now - s.startedAt);
}

export function fire(p: Puzzle, s: DayState, now: number): { state: DayState; beam: BeamResult } {
  const beam = simulateBeam(p, mirrorMap(s));
  if (s.result || !beam.solved) return { state: s, beam };
  const elapsed = elapsedMs(s, now);
  const score = computeScore({ bounces: beam.bounces, optimal: p.optimalBounces, elapsedMs: elapsed });
  return {
    state: { ...s, result: { ...score, bounces: beam.bounces, optimal: p.optimalBounces, elapsedMs: elapsed } },
    beam,
  };
}

/** Accepts untrusted JSON from storage; anything malformed or from another day yields a fresh state. */
export function restoreState(p: Puzzle, raw: unknown): DayState {
  const fresh = freshState(p.date);
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<DayState>;
  if (r.date !== p.date || !Array.isArray(r.mirrors)) return fresh;
  const mirrors = r.mirrors
    .filter(
      (e): e is [CellIdx, Mirror] =>
        Array.isArray(e) && Number.isInteger(e[0]) && (e[1] === '/' || e[1] === '\\') && isPlaceable(p, e[0]),
    )
    .slice(0, p.maxMirrors);
  const startedAt = typeof r.startedAt === 'number' ? r.startedAt : null;
  const result =
    r.result && typeof r.result === 'object' && typeof r.result.total === 'number' ? r.result : undefined;
  return { date: p.date, mirrors, startedAt, result };
}
