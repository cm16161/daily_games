import { describe, expect, it } from 'vitest';
import { formatShare, formatTime } from '../src/logic/share';

describe('share', () => {
  it('matches the spec example', () => {
    expect(formatShare('2026-11-27', 5, 4, 102_000)).toBe(
      'Mirror Bounce 2026-11-27 | 5 bounces (par 4) | 1:42',
    );
  });

  it('formats times', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9_999)).toBe('0:09');
    expect(formatTime(600_000)).toBe('10:00');
  });

  it('does not reveal mirror positions or the board', () => {
    const text = formatShare('2026-11-27', 3, 3, 30_000);
    expect(text).not.toMatch(/[/\\]/);
  });
});
