import { describe, expect, it } from 'vitest';
import { EMPTY_STATS, currentStreak, updateStats } from '@shared/streak';
import { dayDiff, localDateKey } from '@shared/date';

describe('streak', () => {
  it('starts at 1 and continues on consecutive days', () => {
    let s = updateStats(EMPTY_STATS, '2026-11-30', 900);
    s = updateStats(s, '2026-12-01', 1200);
    expect(s).toMatchObject({ streak: 2, maxStreak: 2, bestScore: 1200, played: 2 });
  });

  it('resets after a gap but keeps max', () => {
    let s = updateStats(EMPTY_STATS, '2026-11-01', 500);
    s = updateStats(s, '2026-11-02', 500);
    s = updateStats(s, '2026-11-05', 400);
    expect(s).toMatchObject({ streak: 1, maxStreak: 2, bestScore: 500 });
  });

  it('ignores a second result on the same day', () => {
    const s = updateStats(EMPTY_STATS, '2026-11-01', 500);
    expect(updateStats(s, '2026-11-01', 1300)).toBe(s);
  });

  it('currentStreak drops to 0 once a day is missed', () => {
    const s = updateStats(EMPTY_STATS, '2026-11-01', 500);
    expect(currentStreak(s, '2026-11-02')).toBe(1);
    expect(currentStreak(s, '2026-11-03')).toBe(0);
  });
});

describe('date', () => {
  it('formats local date', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('dayDiff spans month and DST boundaries', () => {
    expect(dayDiff('2026-02-28', '2026-03-01')).toBe(1);
    expect(dayDiff('2026-03-28', '2026-03-30')).toBe(2);
  });
});
