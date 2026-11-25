import { copyText } from '@shared/clipboard';
import type { Stats } from '@shared/streak';
import { formatShare, formatTime } from '../logic/share';
import type { DayResult } from '../logic/state';

function msUntilMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function showResults(
  section: HTMLElement,
  date: string,
  result: DayResult,
  stats: Stats,
  streak: number,
  focus: boolean,
): void {
  const extra = result.bounces - result.optimal;
  const bounceNote = extra <= 0 ? 'par' : `+${extra} over par`;
  section.innerHTML = `
    <h2 id="results-title" tabindex="-1">${extra <= 0 ? 'Perfect bounce!' : 'Solved!'}</h2>
    <table class="breakdown">
      <tbody>
        <tr><th scope="row">Bounces</th><td>${result.bounces} (${bounceNote})</td></tr>
        <tr><th scope="row">Solution quality</th><td>${result.quality}</td></tr>
        <tr><th scope="row">Time</th><td>${formatTime(result.elapsedMs)}</td></tr>
        <tr><th scope="row">Speed bonus</th><td>${result.speed}</td></tr>
        <tr class="total"><th scope="row">Score</th><td>${result.total}</td></tr>
      </tbody>
    </table>
    <div class="stats">
      <div><strong>${streak}</strong><span>Streak</span></div>
      <div><strong>${stats.maxStreak}</strong><span>Max streak</span></div>
      <div><strong>${stats.bestScore}</strong><span>Best</span></div>
    </div>
    <button type="button" class="btn primary" id="copy">Copy result</button>
    <p class="next" id="next"></p>
  `;
  section.hidden = false;

  const copy = section.querySelector<HTMLButtonElement>('#copy')!;
  copy.addEventListener('click', async () => {
    const ok = await copyText(formatShare(date, result.bounces, result.optimal, result.elapsedMs));
    copy.textContent = ok ? 'Copied!' : 'Copy failed';
    setTimeout(() => (copy.textContent = 'Copy result'), 1800);
  });

  const next = section.querySelector<HTMLElement>('#next')!;
  const tick = () => (next.textContent = `Next puzzle in ${formatCountdown(msUntilMidnight())}`);
  tick();
  setInterval(tick, 1000);

  if (focus) {
    section.querySelector<HTMLElement>('#results-title')!.focus();
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
