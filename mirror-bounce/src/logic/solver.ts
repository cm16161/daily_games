import { reflect } from './beam';
import { DC, DR, idx } from './types';
import type { CellIdx, Dir, Mirror, PuzzleLayout } from './types';

export interface SolveOptions {
  maxBounces: number;
  maxMirrors: number;
  /** Stop counting optimal solutions once this many distinct ones are found. */
  countLimit?: number;
}

export interface SolveResult {
  optimalBounces: number;
  optimalSolutionCount: number;
  example: [CellIdx, Mirror][];
}

const UNDECIDED = 0;
const STRAIGHT = 1;
const SLASH = 2;
const BACKSLASH = 3;
const CODE_TO_MIRROR: Record<number, Mirror> = { [SLASH]: '/', [BACKSLASH]: '\\' };

/**
 * Exact minimum-bounce search. Follows the beam from the emitter; at each empty cell it has
 * not yet decided it branches into straight, '/' or '\'. Decisions persist for the rest of the
 * branch so a revisited cell behaves consistently. Only mirrors the beam actually hits are ever
 * placed, so each distinct solution is a distinct mirror set.
 */
export function solve(p: PuzzleLayout, opts: SolveOptions): SolveResult | null {
  const n = p.size;
  const countLimit = opts.countLimit ?? 2;
  const blocked = new Uint8Array(n * n);
  for (const o of p.obstacles) blocked[o] = 1;
  const targetBit = new Int32Array(n * n);
  p.targets.forEach((t, i) => (targetBit[t] = 1 << i));
  const fullMask = (1 << p.targets.length) - 1;
  const decided = new Uint8Array(n * n);

  let limit = 0;
  let found: Map<string, [CellIdx, Mirror][]> = new Map();

  const record = () => {
    const sol: [CellIdx, Mirror][] = [];
    for (let i = 0; i < decided.length; i++) {
      if (decided[i] >= SLASH) sol.push([i, CODE_TO_MIRROR[decided[i]]]);
    }
    const key = sol.map(([c, m]) => `${c}${m}`).join(',');
    if (!found.has(key)) found.set(key, sol);
  };

  const dfs = (r: number, c: number, dir: Dir, bounces: number, mirrors: number, mask: number): void => {
    while (found.size < countLimit) {
      if (r < 0 || r >= n || c < 0 || c >= n) return;
      const cell = idx(r, c, n);
      if (blocked[cell]) return;
      if (targetBit[cell]) {
        mask |= targetBit[cell];
        if (mask === fullMask) {
          record();
          return;
        }
      } else {
        const d = decided[cell];
        if (d >= SLASH) {
          if (bounces === limit) return;
          dir = reflect(dir, CODE_TO_MIRROR[d]);
          bounces++;
        } else if (d === UNDECIDED) {
          decided[cell] = STRAIGHT;
          dfs(r + DR[dir], c + DC[dir], dir, bounces, mirrors, mask);
          if (bounces < limit && mirrors < opts.maxMirrors) {
            for (const code of [SLASH, BACKSLASH]) {
              decided[cell] = code;
              const nd = reflect(dir, CODE_TO_MIRROR[code]);
              dfs(r + DR[nd], c + DC[nd], nd, bounces + 1, mirrors + 1, mask);
            }
          }
          decided[cell] = UNDECIDED;
          return;
        }
      }
      r += DR[dir];
      c += DC[dir];
    }
  };

  for (limit = 0; limit <= opts.maxBounces; limit++) {
    found = new Map();
    dfs(p.emitter.row, p.emitter.col, p.emitter.dir, 0, 0, 0);
    if (found.size > 0) {
      return {
        optimalBounces: limit,
        optimalSolutionCount: found.size,
        example: found.values().next().value!,
      };
    }
  }
  return null;
}
