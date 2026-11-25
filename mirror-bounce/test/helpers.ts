import { idx } from '../src/logic/types';
import type { Dir, PuzzleLayout } from '../src/logic/types';

export type RC = [number, number];

export function layout(opts: {
  size?: number;
  emitter: [number, number, Dir];
  targets?: RC[];
  obstacles?: RC[];
}): PuzzleLayout {
  const size = opts.size ?? 7;
  const [row, col, dir] = opts.emitter;
  return {
    date: 'test',
    size,
    emitter: { row, col, dir },
    targets: (opts.targets ?? []).map(([r, c]) => idx(r, c, size)),
    obstacles: (opts.obstacles ?? []).map(([r, c]) => idx(r, c, size)),
  };
}

export const mirrors = (entries: [number, number, '/' | '\\'][], size = 7) =>
  new Map(entries.map(([r, c, m]) => [idx(r, c, size), m] as const));
