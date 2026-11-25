import { dayDiff } from './date';

export interface Stats {
  played: number;
  streak: number;
  maxStreak: number;
  bestScore: number;
  lastSolvedDate: string | null;
}

export const EMPTY_STATS: Stats = {
  played: 0,
  streak: 0,
  maxStreak: 0,
  bestScore: 0,
  lastSolvedDate: null,
};

export function updateStats(prev: Stats, date: string, score: number): Stats {
  if (prev.lastSolvedDate === date) return prev;
  const continues = prev.lastSolvedDate != null && dayDiff(prev.lastSolvedDate, date) === 1;
  const streak = continues ? prev.streak + 1 : 1;
  return {
    played: prev.played + 1,
    streak,
    maxStreak: Math.max(prev.maxStreak, streak),
    bestScore: Math.max(prev.bestScore, score),
    lastSolvedDate: date,
  };
}

export function currentStreak(stats: Stats, today: string): number {
  if (stats.lastSolvedDate == null) return 0;
  return dayDiff(stats.lastSolvedDate, today) <= 1 ? stats.streak : 0;
}
