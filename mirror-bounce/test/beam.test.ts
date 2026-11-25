import { describe, expect, it } from 'vitest';
import { createRng } from '@shared/prng';
import { reflect, simulateBeam } from '../src/logic/beam';
import { idx } from '../src/logic/types';
import type { Dir, Mirror } from '../src/logic/types';
import { layout, mirrors } from './helpers';

const N = 0, E = 1, S = 2, W = 3;

describe('reflect', () => {
  it.each<[Dir, Mirror, Dir]>([
    [N, '/', E], [E, '/', N], [S, '/', W], [W, '/', S],
    [N, '\\', W], [W, '\\', N], [S, '\\', E], [E, '\\', S],
  ])('dir %i off %s -> %i', (d, m, out) => {
    expect(reflect(d, m)).toBe(out);
  });

  it('is an involution', () => {
    for (const m of ['/', '\\'] as const)
      for (const d of [N, E, S, W] as Dir[]) expect(reflect(reflect(d, m), m)).toBe(d);
  });
});

describe('simulateBeam', () => {
  it('travels straight to the far edge with no mirrors', () => {
    const r = simulateBeam(layout({ emitter: [3, 0, E] }), new Map());
    expect(r.end).toBe('edge');
    expect(r.bounces).toBe(0);
    expect(r.cells).toEqual([0, 1, 2, 3, 4, 5, 6].map((c) => idx(3, c)));
    expect(r.points).toEqual([{ x: 0, y: 3.5 }, { x: 7, y: 3.5 }]);
  });

  it('stops at an obstacle face', () => {
    const r = simulateBeam(layout({ emitter: [3, 0, E], obstacles: [[3, 4]] }), new Map());
    expect(r.end).toBe('obstacle');
    expect(r.cells).toHaveLength(4);
    expect(r.points.at(-1)).toEqual({ x: 4, y: 3.5 });
  });

  it('stops immediately if the entry cell is an obstacle', () => {
    const r = simulateBeam(layout({ emitter: [0, 2, S], obstacles: [[0, 2]] }), new Map());
    expect(r.end).toBe('obstacle');
    expect(r.cells).toEqual([]);
  });

  it('reflects off a mirror and counts the bounce', () => {
    const r = simulateBeam(layout({ emitter: [3, 0, E] }), mirrors([[3, 3, '/']]));
    expect(r.bounces).toBe(1);
    expect(r.cells).toEqual([idx(3, 0), idx(3, 1), idx(3, 2), idx(3, 3), idx(2, 3), idx(1, 3), idx(0, 3)]);
    expect(r.points).toEqual([{ x: 0, y: 3.5 }, { x: 3.5, y: 3.5 }, { x: 3.5, y: 0 }]);
  });

  it('counts a mirror hit twice as two bounces', () => {
    const m = mirrors([[3, 3, '/'], [1, 3, '/'], [1, 5, '\\'], [3, 5, '/']]);
    const r = simulateBeam(layout({ emitter: [3, 0, E] }), m);
    expect(r.bounces).toBe(5);
    expect(r.end).toBe('edge');
    expect(r.cells.at(-1)).toBe(idx(6, 3));
  });

  it('records targets the beam passes through and reports solved', () => {
    const p = layout({ emitter: [3, 0, E], targets: [[3, 1], [4, 3], [5, 5]] });
    const partial = simulateBeam(p, mirrors([[3, 3, '\\']]));
    expect([...partial.targetsHit]).toEqual([idx(3, 1), idx(4, 3)]);
    expect(partial.solved).toBe(false);

    const full = simulateBeam(p, mirrors([[3, 3, '\\'], [5, 3, '\\']]));
    expect(full.solved).toBe(true);
  });

  it('ignores a mirror sitting on a target cell', () => {
    const p = layout({ emitter: [3, 0, E], targets: [[3, 3]] });
    const r = simulateBeam(p, mirrors([[3, 3, '/']]));
    expect(r.bounces).toBe(0);
    expect(r.cells).toHaveLength(7);
  });

  it('detects a loop when started inside a closed mirror cycle', () => {
    const m = mirrors([[1, 1, '/'], [1, 4, '\\'], [4, 4, '/'], [4, 1, '\\']]);
    const r = simulateBeam(layout({ emitter: [0, 0, S] }), m, { cell: idx(1, 2), dir: E });
    expect(r.end).toBe('loop');
    expect(r.bounces).toBe(4);
  });

  it('never loops when fired from the edge emitter', () => {
    const rng = createRng('loop-property');
    for (let t = 0; t < 500; t++) {
      const entries: [number, number, Mirror][] = [];
      for (let k = rng.int(0, 20); k > 0; k--) entries.push([rng.int(0, 6), rng.int(0, 6), rng.pick(['/', '\\'] as const)]);
      const side = rng.int(0, 3) as Dir;
      const pos = rng.int(0, 6);
      const emitter: [number, number, Dir] =
        side === S ? [0, pos, S] : side === N ? [6, pos, N] : side === E ? [pos, 0, E] : [pos, 6, W];
      expect(simulateBeam(layout({ emitter }), mirrors(entries)).end).not.toBe('loop');
    }
  });
});
