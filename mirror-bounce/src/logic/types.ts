export const SIZE = 7;

export type Dir = 0 | 1 | 2 | 3; // N E S W
export type Mirror = '/' | '\\';
export type CellIdx = number;

export const DR = [-1, 0, 1, 0] as const;
export const DC = [0, 1, 0, -1] as const;

export interface Emitter {
  row: number;
  col: number;
  dir: Dir;
}

export interface PuzzleLayout {
  date: string;
  size: number;
  emitter: Emitter;
  targets: CellIdx[];
  obstacles: CellIdx[];
}

export interface Puzzle extends PuzzleLayout {
  optimalBounces: number;
  maxMirrors: number;
  solution: [CellIdx, Mirror][];
}

export type Mirrors = ReadonlyMap<CellIdx, Mirror>;

export const idx = (row: number, col: number, size = SIZE): CellIdx => row * size + col;
export const rowOf = (i: CellIdx, size = SIZE) => Math.floor(i / size);
export const colOf = (i: CellIdx, size = SIZE) => i % size;
