export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatShare(date: string, bounces: number, optimal: number, elapsedMs: number): string {
  const noun = bounces === 1 ? 'bounce' : 'bounces';
  return `Mirror Bounce ${date} | ${bounces} ${noun} (par ${optimal}) | ${formatTime(elapsedMs)}`;
}
