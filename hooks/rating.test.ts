import { describe, expect, test } from 'claude-code/testing'

import { EMPTY_STATS, difficultyFor, elo, record } from './rating'

describe('elo', () => {
  test('equal ratings move by half of K', () => {
    expect(elo(1500, 1500, true)).toBe(1516)
    expect(elo(1500, 1500, false)).toBe(1484)
  })

  test('beating a much stronger puzzle gains more than beating a weaker one', () => {
    expect(elo(1500, 1900, true) > elo(1500, 1100, true)).toBe(true)
    expect(elo(1500, 1100, false) < elo(1500, 1900, false)).toBe(true)
  })
})

describe('difficultyFor', () => {
  test('maps the rating bands to the Lichess difficulties', () => {
    expect(difficultyFor(900)).toBe('easiest')
    expect(difficultyFor(1199)).toBe('easiest')
    expect(difficultyFor(1200)).toBe('easier')
    expect(difficultyFor(1500)).toBe('normal')
    expect(difficultyFor(1800)).toBe('harder')
    expect(difficultyFor(2000)).toBe('hardest')
  })
})

describe('record', () => {
  test('a win counts, extends the streak and moves the rating', () => {
    const next = record(EMPTY_STATS, 1369, true)
    expect(next).toMatchObject({ solved: 1, failed: 0, streak: 1 })
    expect(next.rating > 1500).toBe(true)
  })

  test('a loss counts and resets the streak', () => {
    const next = record({ rating: 1500, solved: 3, failed: 1, streak: 3 }, 1369, false)
    expect(next).toMatchObject({ solved: 3, failed: 2, streak: 0 })
    expect(next.rating < 1500).toBe(true)
  })

  test('a puzzle without a rating leaves the rating alone', () => {
    expect(record(EMPTY_STATS, undefined, true)).toEqual({ rating: 1500, solved: 1, failed: 0, streak: 1 })
  })
})
