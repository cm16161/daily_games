import { DC, DR, colOf, idx, rowOf } from './types';
import type { CellIdx, Dir, Mirror, Mirrors, PuzzleLayout } from './types';

const SLASH: readonly Dir[] = [1, 0, 3, 2];
const BACKSLASH: readonly Dir[] = [3, 2, 1, 0];

export function reflect(dir: Dir, m: Mirror): Dir {
  return (m === '/' ? SLASH : BACKSLASH)[dir];
}

export interface Point {
  x: number;
  y: number;
}

export interface BeamResult {
  /** Polyline in cell units: cell (r,c) has its centre at (c + 0.5, r + 0.5). */
  points: Point[];
  cells: CellIdx[];
  bounces: number;
  targetsHit: ReadonlySet<CellIdx>;
  end: 'edge' | 'obstacle' | 'loop';
  solved: boolean;
}

export interface BeamStart {
  cell: CellIdx;
  dir: Dir;
}

const centre = (r: number, c: number): Point => ({ x: c + 0.5, y: r + 0.5 });

export function simulateBeam(p: PuzzleLayout, mirrors: Mirrors, start?: BeamStart): BeamResult {
  const n = p.size;
  const obstacles = new Set(p.obstacles);
  const targets = new Set(p.targets);
  const targetsHit = new Set<CellIdx>();
  const cells: CellIdx[] = [];
  const seen = new Set<number>();

  let r = start ? rowOf(start.cell, n) : p.emitter.row;
  let c = start ? colOf(start.cell, n) : p.emitter.col;
  let dir: Dir = start ? start.dir : p.emitter.dir;
  const points: Point[] = [
    start ? centre(r, c) : { x: c + 0.5 - DC[dir] * 0.5, y: r + 0.5 - DR[dir] * 0.5 },
  ];
  let bounces = 0;
  let end: BeamResult['end'];

  for (;;) {
    if (r < 0 || r >= n || c < 0 || c >= n) {
      points.push({ x: c + 0.5 - DC[dir] * 0.5, y: r + 0.5 - DR[dir] * 0.5 });
      end = 'edge';
      break;
    }
    const cell = idx(r, c, n);
    if (obstacles.has(cell)) {
      points.push({ x: c + 0.5 - DC[dir] * 0.5, y: r + 0.5 - DR[dir] * 0.5 });
      end = 'obstacle';
      break;
    }
    const state = cell * 4 + dir;
    if (seen.has(state)) {
      points.push(centre(r, c));
      end = 'loop';
      break;
    }
    seen.add(state);
    cells.push(cell);
    if (targets.has(cell)) targetsHit.add(cell);
    const m = mirrors.get(cell);
    if (m && !targets.has(cell)) {
      points.push(centre(r, c));
      dir = reflect(dir, m);
      bounces++;
    }
    r += DR[dir];
    c += DC[dir];
  }

  return {
    points,
    cells,
    bounces,
    targetsHit,
    end,
    solved: targetsHit.size === p.targets.length,
  };
}
