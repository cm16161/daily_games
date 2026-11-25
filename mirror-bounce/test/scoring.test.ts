import { describe, expect, it } from 'vitest';
import { computeScore } from '../src/logic/scoring';

const s = (bounces: number, optimal: number, sec: number) =>
  computeScore({ bounces, optimal, elapsedMs: sec * 1000 });

describe('computeScore', () => {
  it('gives the maximum for an instant optimal solve', () => {
    expect(s(4, 4, 0)).toEqual({ quality: 1000, speed: 300, total: 1300 });
  });

  it('takes 150 per extra bounce, floored at 0', () => {
    expect(s(5, 4, 0).quality).toBe(850);
    expect(s(7, 4, 0).quality).toBe(550);
    expect(s(10, 4, 0).quality).toBe(100);
    expect(s(11, 4, 0).quality).toBe(0);
    expect(s(30, 4, 0).quality).toBe(0);
  });

  it('never rewards fewer bounces than optimal', () => {
    expect(s(2, 4, 0).quality).toBe(1000);
  });

  it('decays the speed bonus linearly over five minutes', () => {
    expect(s(3, 3, 60).speed).toBe(240);
    expect(s(3, 3, 150).speed).toBe(150);
    expect(s(3, 3, 299).speed).toBe(1);
    expect(s(3, 3, 300).speed).toBe(0);
    expect(s(3, 3, 3600).speed).toBe(0);
  });

  it('treats negative elapsed time (clock skew) as zero', () => {
    expect(s(3, 3, -10).speed).toBe(300);
  });

  it('sums quality and speed', () => {
    expect(s(5, 4, 102)).toEqual({ quality: 850, speed: 198, total: 1048 });
  });
});
