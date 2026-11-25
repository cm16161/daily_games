import { localDateKey } from '@shared/date';
import { loadJSON, saveJSON } from '@shared/storage';
import { EMPTY_STATS, currentStreak, updateStats } from '@shared/streak';
import type { Stats } from '@shared/streak';
import { simulateBeam } from '../logic/beam';
import { generatePuzzle } from '../logic/generator';
import { formatTime } from '../logic/share';
import { cycleCell, elapsedMs, fire, mirrorMap, restoreState, setCell } from '../logic/state';
import type { DayState } from '../logic/state';
import type { CellIdx, Mirror } from '../logic/types';
import { createBoard } from './board';
import { showResults } from './results';

const DAY_KEY = 'mirror-bounce:v1:day';
const STATS_KEY = 'mirror-bounce:v1:stats';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const today = localDateKey();
const puzzle = generatePuzzle(today);
let state: DayState = restoreState(puzzle, loadJSON<unknown>(DAY_KEY, null));
let stats: Stats = { ...EMPTY_STATS, ...loadJSON<Partial<Stats>>(STATS_KEY, {}) };
let firing = false;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const hud = {
  bounces: $('hud-bounces'),
  par: $('hud-par'),
  targets: $('hud-targets'),
  mirrors: $('hud-mirrors'),
  time: $('hud-time'),
};
const fireBtn = $<HTMLButtonElement>('fire');
const clearBtn = $<HTMLButtonElement>('clear');
const message = $('message');
const results = $('results');

$('date').textContent = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
hud.par.textContent = String(puzzle.optimalBounces);

const board = createBoard($('board'), puzzle, {
  onCycle: (cell) => update(cycleCell(puzzle, state, cell, Date.now()), cell),
  onSet: (cell, m) => update(setCell(puzzle, state, cell, m, Date.now()), cell, m),
});

function persist(): void {
  saveJSON(DAY_KEY, state);
}

function update(next: DayState, cell?: CellIdx, wanted?: Mirror | null): void {
  if (firing) return;
  if (next === state) {
    const atCap = state.mirrors.length >= puzzle.maxMirrors && wanted !== null;
    if (cell != null && atCap && !mirrorMap(state).has(cell)) {
      message.textContent = `Mirror limit reached (${puzzle.maxMirrors}). Remove one first.`;
    }
    return;
  }
  state = next;
  message.textContent = '';
  board.clearFiredBeam();
  persist();
  render();
}

function render(): void {
  const done = state.result != null;
  const beam = simulateBeam(puzzle, mirrorMap(state));
  board.render(mirrorMap(state), beam, done || firing);
  hud.bounces.textContent = String(beam.bounces);
  hud.bounces.classList.toggle('over', beam.solved && beam.bounces > puzzle.optimalBounces);
  hud.targets.textContent = `${beam.targetsHit.size}/${puzzle.targets.length}`;
  hud.mirrors.textContent = `${state.mirrors.length}/${puzzle.maxMirrors}`;
  renderTime();
  fireBtn.disabled = done || firing;
  clearBtn.disabled = done || firing || state.mirrors.length === 0;
}

function renderTime(): void {
  hud.time.textContent = formatTime(elapsedMs(state, Date.now()));
}

function finish(focus: boolean): void {
  if (!state.result) return;
  const streak = currentStreak(stats, today);
  showResults(results, today, state.result, stats, streak, focus);
}

async function onFire(): Promise<void> {
  if (firing || state.result) return;
  const { state: next, beam } = fire(puzzle, state, Date.now());
  firing = true;
  render();
  message.textContent = '';
  await board.showFiredBeam(beam, !reducedMotion);
  firing = false;

  if (next.result) {
    state = next;
    stats = updateStats(stats, today, next.result.total);
    persist();
    saveJSON(STATS_KEY, stats);
    render();
    message.textContent = 'All targets lit!';
    finish(true);
    return;
  }
  render();
  const missed = puzzle.targets.length - beam.targetsHit.size;
  const why = beam.end === 'obstacle' ? 'hit an obstacle' : 'left the grid';
  message.textContent = `The beam ${why} and missed ${missed} target${missed === 1 ? '' : 's'}.`;
}

fireBtn.addEventListener('click', () => void onFire());
clearBtn.addEventListener('click', () => {
  if (firing || state.result) return;
  update({ ...state, mirrors: [] });
  $<HTMLElement>('board').querySelector<HTMLButtonElement>('.cell[tabindex="0"]')?.focus();
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.key === 'f' || e.key === 'F') && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    void onFire();
  }
});

setInterval(() => {
  if (state.startedAt != null && !state.result) renderTime();
}, 250);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && localDateKey() !== today) location.reload();
});

render();
if (state.result) {
  void board.showFiredBeam(simulateBeam(puzzle, mirrorMap(state)), false);
  finish(false);
}
