export const QUALITY_MAX = 1000;
export const EXTRA_BOUNCE_PENALTY = 150;
export const SPEED_MAX = 300;
export const SPEED_WINDOW_MS = 5 * 60 * 1000;

export interface ScoreInput {
  bounces: number;
  optimal: number;
  elapsedMs: number;
}

export interface Score {
  quality: number;
  speed: number;
  total: number;
}

export function computeScore({ bounces, optimal, elapsedMs }: ScoreInput): Score {
  const extra = Math.max(0, bounces - optimal);
  const quality = Math.max(0, QUALITY_MAX - EXTRA_BOUNCE_PENALTY * extra);
  const remaining = Math.max(0, 1 - Math.max(0, elapsedMs) / SPEED_WINDOW_MS);
  const speed = Math.round(SPEED_MAX * remaining);
  return { quality, speed, total: quality + speed };
}
