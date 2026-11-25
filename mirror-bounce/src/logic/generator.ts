import { createRng } from '@shared/prng';
import type { Rng } from '@shared/prng';
import { reflect } from './beam';
import { solve } from './solver';
import { DC, DR, SIZE, idx } from './types';
import type { CellIdx, Dir, Emitter, Mirror, Puzzle, PuzzleLayout } from './types';

export const MIN_OPTIMAL = 3;
export const MAX_OPTIMAL = 5;
export const MAX_ATTEMPTS = 3000;
const TARGET_COUNT = 3;
const EXTRA_MIRRORS = 2;
const OBSTACLES_MIN = 7;
const OBSTACLES_MAX = 11;
const NEAR_PATH_SHARE = 0.8;
const PAR_WEIGHTS: readonly [number, number][] = [
  [3, 0.3],
  [4, 0.4],
  [5, 0.3],
];

interface Walk {
  emitter: Emitter;
  pathCells: Set<CellIdx>;
  /** Non-mirror cells of each straight segment, in beam order. */
  segments: CellIdx[][];
  endObstacle: CellIdx | null;
}

function randomEmitter(rng: Rng, n: number): Emitter {
  const side = rng.int(0, 3);
  const k = rng.int(0, n - 1);
  switch (side) {
    case 0:
      return { row: 0, col: k, dir: 2 };
    case 1:
      return { row: k, col: n - 1, dir: 3 };
    case 2:
      return { row: n - 1, col: k, dir: 0 };
    default:
      return { row: k, col: 0, dir: 1 };
  }
}

function randomWalk(rng: Rng, n: number, bounces: number): Walk | null {
  const emitter = randomEmitter(rng, n);
  const pathCells = new Set<CellIdx>();
  const segments: CellIdx[][] = [];
  const inGrid = (r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n;
  const free = (r: number, c: number) => inGrid(r, c) && !pathCells.has(idx(r, c, n));

  let r = emitter.row;
  let c = emitter.col;
  let dir: Dir = emitter.dir;

  for (let b = 0; b < bounces; b++) {
    let run = 0;
    while (free(r + DR[dir] * (run + 1), c + DC[dir] * (run + 1))) run++;
    const seg: CellIdx[] = [];
    const steps = rng.int(1, Math.max(1, run));
    for (let s = 0; s < steps; s++) {
      if (!free(r, c)) return null;
      seg.push(idx(r, c, n));
      pathCells.add(idx(r, c, n));
      r += DR[dir];
      c += DC[dir];
    }
    if (!free(r, c)) return null;
    const mirror: Mirror = rng.chance(0.5) ? '/' : '\\';
    pathCells.add(idx(r, c, n));
    segments.push(seg);
    dir = reflect(dir, mirror);
    r += DR[dir];
    c += DC[dir];
    if (!free(r, c)) return null;
  }

  const last: CellIdx[] = [];
  let endObstacle: CellIdx | null = null;
  const stopEarly = rng.chance(0.3);
  while (free(r, c)) {
    last.push(idx(r, c, n));
    pathCells.add(idx(r, c, n));
    r += DR[dir];
    c += DC[dir];
    if (stopEarly && last.length >= 2 && free(r, c) && rng.chance(0.4)) {
      endObstacle = idx(r, c, n);
      break;
    }
  }
  if (inGrid(r, c) && endObstacle == null) return null;
  segments.push(last);
  return { emitter, pathCells, segments, endObstacle };
}

function pickTargets(rng: Rng, segments: CellIdx[][]): CellIdx[] | null {
  const last = segments[segments.length - 1];
  const earlier = segments.slice(0, -1).filter((s) => s.length > 0);
  if (last.length === 0 || earlier.length < TARGET_COUNT - 1) return null;
  const chosen = rng.shuffle(earlier).slice(0, TARGET_COUNT - 1);
  return [...chosen.map((s) => rng.pick(s)), rng.pick(last)];
}

export interface Candidate {
  layout: PuzzleLayout;
  optimalBounces: number;
  solutionCount: number;
  solution: [CellIdx, Mirror][];
  intendedBounces: number;
}

export function generateCandidate(date: string, attempt: number, par?: number): Candidate | null {
  const rng = createRng(`mirror-bounce:${date}:${attempt}`);
  const n = SIZE;
  const bounces = par ?? rng.int(MIN_OPTIMAL, MAX_OPTIMAL);
  const walk = randomWalk(rng, n, bounces);
  if (!walk) return null;
  const targets = pickTargets(rng, walk.segments);
  if (!targets) return null;

  const obstacles = new Set<CellIdx>();
  if (walk.endObstacle != null) obstacles.add(walk.endObstacle);
  const nearPath: CellIdx[] = [];
  const farFromPath: CellIdx[] = [];
  for (let i = 0; i < n * n; i++) {
    if (walk.pathCells.has(i) || obstacles.has(i)) continue;
    const r = Math.floor(i / n);
    const c = i % n;
    const adjacent = ([0, 1, 2, 3] as const).some((d) => {
      const nr = r + DR[d];
      const nc = c + DC[d];
      return nr >= 0 && nr < n && nc >= 0 && nc < n && walk.pathCells.has(idx(nr, nc, n));
    });
    (adjacent ? nearPath : farFromPath).push(i);
  }
  const obstacleCount = rng.int(OBSTACLES_MIN, OBSTACLES_MAX);
  const nearCount = Math.min(nearPath.length, Math.round(obstacleCount * NEAR_PATH_SHARE));
  for (const cell of rng.shuffle(nearPath).slice(0, nearCount)) obstacles.add(cell);
  for (const cell of rng.shuffle(farFromPath).slice(0, obstacleCount - nearCount)) obstacles.add(cell);

  const layout: PuzzleLayout = {
    date,
    size: n,
    emitter: walk.emitter,
    targets,
    obstacles: [...obstacles].sort((a, b) => a - b),
  };
  const result = solve(layout, { maxBounces: bounces, maxMirrors: bounces });
  if (!result) return null;
  return {
    layout,
    optimalBounces: result.optimalBounces,
    solutionCount: result.optimalSolutionCount,
    solution: result.example,
    intendedBounces: bounces,
  };
}

const toPuzzle = (c: Candidate): Puzzle => ({
  ...c.layout,
  optimalBounces: c.optimalBounces,
  maxMirrors: c.optimalBounces + EXTRA_MIRRORS,
  solution: c.solution,
});

export function dailyPar(date: string): number {
  const roll = createRng(`mirror-bounce:${date}:par`).next();
  let acc = 0;
  for (const [par, w] of PAR_WEIGHTS) {
    acc += w;
    if (roll < acc) return par;
  }
  return PAR_WEIGHTS[PAR_WEIGHTS.length - 1][0];
}

/**
 * Tries the day's target par first (unique optimum equal to the walk's bounce count). If that
 * never succeeds, settles for the first unique-optimal candidate of any par, then any candidate.
 */
export function generatePuzzle(date: string): Puzzle {
  const par = dailyPar(date);
  let fallback: Candidate | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const cand = generateCandidate(date, attempt, par);
    if (!cand || cand.optimalBounces < MIN_OPTIMAL) continue;
    const unique = cand.solutionCount === 1;
    if (unique && cand.optimalBounces === par) return toPuzzle(cand);
    if (!fallback || (unique && fallback.solutionCount > 1)) fallback = cand;
  }
  if (fallback) return toPuzzle(fallback);
  throw new Error(`No puzzle could be generated for ${date}`);
}
