import type { BeamResult, Point } from '../logic/beam';
import { DC, DR, colOf, idx, rowOf } from '../logic/types';
import type { CellIdx, Mirror, Mirrors, Puzzle } from '../logic/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface BoardHandlers {
  onCycle(cell: CellIdx): void;
  onSet(cell: CellIdx, mirror: Mirror | null): void;
}

export interface BoardView {
  render(mirrors: Mirrors, beam: BeamResult | null, locked: boolean): void;
  showFiredBeam(beam: BeamResult, animate: boolean): Promise<void>;
  clearFiredBeam(): void;
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

const pointsAttr = (pts: Point[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

const polylineLength = (pts: Point[]) =>
  pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

function describeCell(p: Puzzle, cell: CellIdx, mirror: Mirror | undefined, hit: boolean): string {
  const where = `Row ${rowOf(cell, p.size) + 1}, column ${colOf(cell, p.size) + 1}`;
  if (p.obstacles.includes(cell)) return `${where}: obstacle`;
  if (p.targets.includes(cell)) return `${where}: target${hit ? ', lit' : ''}`;
  if (mirror === '/') return `${where}: mirror, forward slash`;
  if (mirror === '\\') return `${where}: mirror, backslash`;
  return `${where}: empty`;
}

export function createBoard(root: HTMLElement, p: Puzzle, handlers: BoardHandlers): BoardView {
  const n = p.size;
  const svg = el('svg', { viewBox: `-1 -1 ${n + 2} ${n + 2}`, 'aria-hidden': 'true' });
  const staticLayer = el('g', {});
  const mirrorLayer = el('g', {});
  const targetLayer = el('g', {});
  const preview = el('polyline', { class: 'svg-beam preview', points: '' });
  const fired = el('polyline', { class: 'svg-beam fired', points: '' });
  svg.append(staticLayer, preview, fired, mirrorLayer, targetLayer);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = idx(r, c, n);
      const isObstacle = p.obstacles.includes(cell);
      staticLayer.append(
        el('rect', {
          x: c + 0.05,
          y: r + 0.05,
          width: 0.9,
          height: 0.9,
          rx: 0.12,
          class: isObstacle ? 'svg-obstacle' : 'svg-cell',
        }),
      );
    }
  }

  const { row, col, dir } = p.emitter;
  const ex = col + 0.5 - DC[dir] * 0.62;
  const ey = row + 0.5 - DR[dir] * 0.62;
  const angle = [-90, 0, 90, 180][dir];
  const emitter = el('g', { transform: `translate(${ex} ${ey}) rotate(${angle})`, class: 'svg-emitter' });
  emitter.append(
    el('rect', { x: -0.3, y: -0.22, width: 0.42, height: 0.44, rx: 0.08 }),
    el('polygon', { points: '0.1,-0.17 0.34,0 0.1,0.17' }),
  );
  staticLayer.append(emitter);

  const targetEls = new Map<CellIdx, [SVGCircleElement, SVGCircleElement]>();
  for (const t of p.targets) {
    const cx = colOf(t, n) + 0.5;
    const cy = rowOf(t, n) + 0.5;
    const ring = el('circle', { cx, cy, r: 0.3, class: 'svg-target' });
    const core = el('circle', { cx, cy, r: 0.1, class: 'svg-target-core' });
    targetLayer.append(ring, core);
    targetEls.set(t, [ring, core]);
  }

  const grid = document.createElement('div');
  grid.className = 'cells';
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', 'Puzzle board');
  const buttons: HTMLButtonElement[] = [];
  for (let r = 0; r < n; r++) {
    const rowEl = document.createElement('div');
    rowEl.setAttribute('role', 'row');
    for (let c = 0; c < n; c++) {
      const cell = idx(r, c, n);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cell';
      b.setAttribute('role', 'gridcell');
      b.tabIndex = cell === 0 ? 0 : -1;
      b.dataset.cell = String(cell);
      if (p.obstacles.includes(cell) || p.targets.includes(cell)) b.setAttribute('aria-disabled', 'true');
      rowEl.append(b);
      buttons.push(b);
    }
    grid.append(rowEl);
  }

  root.replaceChildren(svg, grid);

  let locked = false;
  const placeable = (cell: CellIdx) => !p.obstacles.includes(cell) && !p.targets.includes(cell);

  const focusCell = (cell: CellIdx) => {
    for (const b of buttons) b.tabIndex = -1;
    buttons[cell].tabIndex = 0;
    buttons[cell].focus();
  };

  grid.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button.cell');
    if (!b) return;
    const cell = Number(b.dataset.cell);
    focusCell(cell);
    if (!locked && placeable(cell)) handlers.onCycle(cell);
  });

  grid.addEventListener('keydown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button.cell');
    if (!b) return;
    const cell = Number(b.dataset.cell);
    const r = rowOf(cell, n);
    const c = colOf(cell, n);
    const move: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (move[e.key]) {
      e.preventDefault();
      const [dr, dc] = move[e.key];
      focusCell(idx(Math.min(n - 1, Math.max(0, r + dr)), Math.min(n - 1, Math.max(0, c + dc)), n));
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      focusCell(idx(r, e.key === 'Home' ? 0 : n - 1, n));
      return;
    }
    if (locked || !placeable(cell)) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handlers.onCycle(cell);
    } else if (e.key === '/' || e.key === '\\') {
      e.preventDefault();
      handlers.onSet(cell, e.key);
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      handlers.onSet(cell, null);
    }
  });

  const setTargetsLit = (hit: ReadonlySet<CellIdx>) => {
    for (const [t, [ring, core]] of targetEls) {
      const on = hit.has(t);
      ring.classList.toggle('hit', on);
      core.classList.toggle('hit', on);
      core.setAttribute('r', on ? '0.2' : '0.1');
    }
  };

  let lastMirrors: Mirrors = new Map();
  let lastHit: ReadonlySet<CellIdx> = new Set();

  return {
    render(mirrors, beam, isLocked) {
      locked = isLocked;
      root.classList.toggle('locked', locked);
      lastMirrors = mirrors;
      mirrorLayer.replaceChildren(
        ...[...mirrors].map(([cell, m]) => {
          const x = colOf(cell, n);
          const y = rowOf(cell, n);
          return m === '/'
            ? el('line', { x1: x + 0.18, y1: y + 0.82, x2: x + 0.82, y2: y + 0.18, class: 'svg-mirror' })
            : el('line', { x1: x + 0.18, y1: y + 0.18, x2: x + 0.82, y2: y + 0.82, class: 'svg-mirror' });
        }),
      );
      preview.setAttribute('points', beam ? pointsAttr(beam.points) : '');
      lastHit = beam?.targetsHit ?? new Set();
      if (!fired.getAttribute('points')) setTargetsLit(lastHit);
      buttons.forEach((b, cell) => {
        b.setAttribute('aria-label', describeCell(p, cell, lastMirrors.get(cell), lastHit.has(cell)));
      });
    },

    showFiredBeam(beam, animate) {
      fired.setAttribute('points', pointsAttr(beam.points));
      preview.style.visibility = 'hidden';
      const length = polylineLength(beam.points);
      if (!animate || length === 0) {
        fired.style.strokeDasharray = '';
        fired.style.strokeDashoffset = '';
        setTargetsLit(beam.targetsHit);
        return Promise.resolve();
      }
      setTargetsLit(new Set());
      const duration = Math.min(1800, Math.max(500, length * 70));
      fired.style.transition = 'none';
      fired.style.strokeDasharray = `${length}`;
      fired.style.strokeDashoffset = `${length}`;
      fired.getBoundingClientRect();
      return new Promise((resolve) => {
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          fired.style.strokeDashoffset = `${length * (1 - t)}`;
          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            setTargetsLit(beam.targetsHit);
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    },

    clearFiredBeam() {
      fired.setAttribute('points', '');
      fired.style.strokeDasharray = '';
      fired.style.strokeDashoffset = '';
      preview.style.visibility = '';
      setTargetsLit(lastHit);
    },
  };
}
