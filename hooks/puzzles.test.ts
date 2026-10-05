import { describe, expect, test } from 'claude-code/testing'

import { fromChesscom, fromLichess, lichessUrl } from './puzzles'
import { CHESSCOM_DAILY, CHESSCOM_RANDOM, LICHESS_SAMPLE } from './samples'

describe('fromLichess', () => {
  test('replays the game and keeps the UCI solution', () => {
    const puzzle = fromLichess(LICHESS_SAMPLE)
    expect(puzzle).toMatchObject({ id: 'SVQOR', source: 'lichess', rating: 1369, solution: ['g3f3', 'f5g4', 'f6f5'], url: 'https://lichess.org/training/SVQOR' })
    expect(puzzle.fen.split(' ')[1]).toBe('b')
    expect(puzzle.themes).toEqual(['short', 'rookEndgame', 'endgame', 'mateIn2'])
  })

  test('refuses an answer without a solution', () => {
    let error = ''
    try {
      fromLichess({ game: { pgn: 'e4' }, puzzle: { id: 'x' } })
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error.includes('solution')).toBe(true)
  })
})

describe('fromChesscom', () => {
  test('resolves the SAN solution on the given position', () => {
    const puzzle = fromChesscom(CHESSCOM_DAILY)
    expect(puzzle).toMatchObject({ id: '2026-10-05', source: 'chesscom', fen: CHESSCOM_DAILY.fen, solution: ['e2f3'], themes: ['Nowhere Square'] })
    expect(puzzle.rating).toBeUndefined()
  })

  test('reads movetext glued to move numbers, black to move', () => {
    const puzzle = fromChesscom(CHESSCOM_RANDOM)
    expect(puzzle.solution).toHaveLength(7)
    expect(puzzle.solution[0]).toBe('e2a6')
    expect(puzzle.solution[6]).toBe('a3d6')
  })

  test('refuses an answer without a fen', () => {
    let error = ''
    try {
      fromChesscom({ pgn: '1. e4 *' })
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown)
    }
    expect(error.includes('fen')).toBe(true)
  })
})

describe('lichessUrl', () => {
  test('carries the difficulty', () => {
    expect(lichessUrl('harder')).toBe('https://lichess.org/api/puzzle/next?difficulty=harder')
  })
})
