import type { Stats } from '../types'

export type Difficulty = 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest'

const K = 32
export const EMPTY_STATS: Stats = { rating: 1500, solved: 0, failed: 0, streak: 0 }

export function elo(rating: number, opponent: number, isWin: boolean): number {
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400))
  return Math.round(rating + K * ((isWin ? 1 : 0) - expected))
}

export function difficultyFor(rating: number): Difficulty {
  if (rating < 1200) return 'easiest'
  if (rating < 1400) return 'easier'
  if (rating < 1700) return 'normal'
  if (rating < 2000) return 'harder'
  return 'hardest'
}

export function record(stats: Stats, puzzleRating: number | undefined, isWin: boolean): Stats {
  return {
    rating: puzzleRating === undefined ? stats.rating : elo(stats.rating, puzzleRating, isWin),
    solved: stats.solved + (isWin ? 1 : 0),
    failed: stats.failed + (isWin ? 0 : 1),
    streak: isWin ? stats.streak + 1 : 0,
  }
}
